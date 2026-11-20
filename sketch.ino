// Olho na Via - dispositivo IoT de borda (Edge Computing & Computer Systems)
// Equipe: Erick Nathan Capito Pereira - RM573635
// Mede impacto, inclinacao, luz, GPS e bateria, recebe da camera as deteccoes da visao computacional
// (buraco, alagamento, semaforo apagado e faixa de pedestre apagada),
// decide o estado da via e avisa por LEDs, buzzer, LCD e MQTT.
//
// O mesmo firmware roda em tres lugares:
//   - Bancada (EMULAR_PERIFERICOS 1): a camera e o GPS sao emulados, sem os modulos reais.
//     Para emular a camera vendo um problema, digite no Serial Monitor: DET alagamento 90
//     (ou DET buraco 60, DET semaforo_apagado 80, DET faixa_apagada 45)
//   - Simulador web (pasta simulador/): a camera, o GPS e o acelerometro do celular fazem o papel
//     da OV2640, do modulo GPS e do MPU-6050. La, "sensor real" equivale a EMULAR_PERIFERICOS 0.
//   - Montagem fisica: ESP32-CAM e GPS do T-Beam ligados por UART (veja COMPONENTES.md).

// 1 = bancada: o GPS percorre uma rota fixa, a foto e so o LED azul e as deteccoes
//     da camera chegam pelo Serial Monitor.
// 0 = montagem fisica: posicao e velocidade do GPS (NMEA), foto e deteccoes pela UART da ESP32-CAM.
#define EMULAR_PERIFERICOS 1

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <LiquidCrystal_I2C.h>
#if !EMULAR_PERIFERICOS
#include <TinyGPSPlus.h>  // so na montagem fisica: instale a biblioteca "TinyGPSPlus"
#endif

const char* PROJETO = "Olho na Via - Dispositivo IoT de borda v1.3";
const char* EQUIPE = "Erick Nathan Capito Pereira - RM573635";

// Rede e MQTT (para o FIWARE, troque o servidor pelo IP da VM)
const char* WIFI_REDE = "Wokwi-GUEST";
const char* WIFI_SENHA = "";
const int WIFI_CANAL = 6;
const char* MQTT_SERVIDOR = "broker.hivemq.com";
const int MQTT_PORTA = 1883;
const char* DISPOSITIVO = "olhonavia001";
const char* TOPICO_DADOS = "/TEF/olhonavia001/attrs";
const char* TOPICO_COMANDO = "/TEF/olhonavia001/cmd";
const char* TOPICO_RESPOSTA = "/TEF/olhonavia001/cmdexe";

// Pinos do ESP32
const int PINO_LDR = 34;
const int PINO_BATERIA = 35;
const int PINO_GPS = 32;
const int PINO_REDE = 33;
const int PINO_CHAVE = 25;
const int PINO_LED_VERDE = 19;
const int PINO_LED_AMARELO = 18;
const int PINO_LED_VERMELHO = 5;
const int PINO_LED_CAMERA = 17;
const int PINO_BUZZER = 16;
// UARTs da montagem fisica (sem uso com EMULAR_PERIFERICOS 1)
const int PINO_GPS_RX = 4;
const int PINO_GPS_TX = 23;
const int PINO_CAMERA_RX = 27;
const int PINO_CAMERA_TX = 26;

// Limites de decisao (valores iniciais, calibrados no piloto)
const float GRAVIDADE = 9.80665;
const float IMPACTO_ATENCAO = 0.4;
const float IMPACTO_CRITICO = 1.0;
const float IMPACTO_MAXIMO = 8.0;
const int CAMERA_ATENCAO = 30;
const int CAMERA_CRITICO = 50;
const float LUZ_MINIMA = 30.0;
const unsigned long TEMPO_SEMAFORO_APAGADO = 10000;
const int BATERIA_MINIMA = 15;

// Tempos das tarefas e tamanhos de vetores
const unsigned long INTERVALO_AMOSTRA = 20;
const unsigned long INTERVALO_LEITURA = 100;
const unsigned long INTERVALO_TELEMETRIA = 5000;
const unsigned long INTERVALO_LCD = 250;
const unsigned long TEMPO_FLASH = 300;
const unsigned long TEMPO_DETECCAO = 3000;
const unsigned long TEMPO_GPS_SEM_SINAL = 5000;
const int TAMANHO_MEDIA = 5;
const int LEITURAS_PARA_CONFIRMAR = 3;
const int TAMANHO_FILA = 10;

// Estados da maquina de estados
const int NORMAL = 0;
const int ATENCAO = 1;
const int CRITICO = 2;
const int FALHA = 3;
const char* NOMES_ESTADO[] = {"NORMAL", "ATENCAO", "CRITICO", "FALHA"};
const char* EVENTOS_ESTADO[] = {"via_normalizada", "registro_ponto", "pre_chamado", "falha_sensor"};

// Classes que a visao computacional da camera detecta (mesma ordem de NOMES_CLASSE)
const int CLASSE_BURACO = 0;
const int CLASSE_ALAGAMENTO = 1;
const int CLASSE_SEMAFORO = 2;
const int CLASSE_FAIXA = 3;
const int TOTAL_CLASSES = 4;
const char* NOMES_CLASSE[] = {"buraco", "alagamento", "semaforo_apagado", "faixa_apagada"};

// Rota emulada do GPS (Av. Paulista, da Consolacao ao Paraiso)
const int PONTOS_ROTA = 8;
const double ROTA_LATITUDE[PONTOS_ROTA] = {-23.555771, -23.558103, -23.561414, -23.563987, -23.566296, -23.568921, -23.571130, -23.574720};
const double ROTA_LONGITUDE[PONTOS_ROTA] = {-46.662310, -46.660010, -46.655881, -46.652510, -46.649730, -46.646420, -46.643620, -46.641050};
const float VELOCIDADE_ROTA = 30.0;

WiFiClient clienteWifi;
PubSubClient mqtt(clienteWifi);
Adafruit_MPU6050 acelerometro;
LiquidCrystal_I2C lcd(0x27, 16, 2);
#if !EMULAR_PERIFERICOS
TinyGPSPlus moduloGps;
#endif

// Ultimas leituras para a media movel
float leiturasImpacto[TAMANHO_MEDIA];
float leiturasLuz[TAMANHO_MEDIA];
int posicaoLeitura = 0;

// Valores medidos (ja suavizados)
float impacto = 0;
int visto[TOTAL_CLASSES];
float luz = 100;
int bateria = 100;
float giroscopio = 0;
float inclinacao = 0;
float temperatura = 0;
int pontoRota = 0;
double latitude = ROTA_LATITUDE[0];
double longitude = ROTA_LONGITUDE[0];
float velocidade = 0;

// Amostragem rapida do acelerometro (entre uma leitura e outra)
float picoImpacto = 0;
bool amostraValida = false;

// Validade das leituras e condicoes de operacao
bool acelerometroConectado = false;
bool impactoValido = false;
bool gpsComSinal = true;
bool redeDisponivel = true;
unsigned long inicioEscuro = 0;

// Controle de estado
int estadoAtual = NORMAL;
int estadoLido = NORMAL;
int estadoCandidato = NORMAL;
int contadorConfirmacao = 0;
String motivo = "via_ok";
String mensagemLcd = "";

// Camera, alertas e chave liga/desliga
int totalFotos = 0;
String ultimaFoto = "nenhuma";
unsigned long fimFlash = 0;
bool buzzerLigado = false;
String linhaCamera = "";
unsigned long ultimaDeteccao[TOTAL_CLASSES];
bool ligado = true;

// Fila de eventos guardados sem rede
String filaOffline[TAMANHO_FILA];
int itensFila = 0;
String idCliente = "";

// Ultima execucao de cada tarefa (millis)
unsigned long ultimaAmostra = 0;
unsigned long ultimaLeitura = 0;
unsigned long ultimaTelemetria = 0;
unsigned long ultimoLcd = 0;

void setup() {
  Serial.begin(115200);
  Serial.println(PROJETO);
  Serial.println(EQUIPE);

  // Chaves usam o resistor de pull-up interno
  pinMode(PINO_GPS, INPUT_PULLUP);
  pinMode(PINO_REDE, INPUT_PULLUP);
  pinMode(PINO_CHAVE, INPUT_PULLUP);
  pinMode(PINO_LED_VERDE, OUTPUT);
  pinMode(PINO_LED_AMARELO, OUTPUT);
  pinMode(PINO_LED_VERMELHO, OUTPUT);
  pinMode(PINO_LED_CAMERA, OUTPUT);
  pinMode(PINO_BUZZER, OUTPUT);

  // Media movel comeca com a via em condicao normal
  for (int i = 0; i < TAMANHO_MEDIA; i++) {
    leiturasImpacto[i] = 0;
    leiturasLuz[i] = 100;
  }

  for (int i = 0; i < TOTAL_CLASSES; i++) {
    visto[i] = 0;
    ultimaDeteccao[i] = 0;
  }

  Wire.begin();
  lcd.init();
  lcd.backlight();
  escreverLinha(0, "Olho na Via");
  escreverLinha(1, "Iniciando...");

  iniciarAcelerometro();

#if !EMULAR_PERIFERICOS
  Serial2.begin(9600, SERIAL_8N1, PINO_GPS_RX, PINO_GPS_TX);
  Serial1.begin(115200, SERIAL_8N1, PINO_CAMERA_RX, PINO_CAMERA_TX);
#endif

  // Wi-Fi conecta em segundo plano; o MQTT e tentado a cada 5 s no loop
  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_REDE, WIFI_SENHA, WIFI_CANAL);
  idCliente = String(DISPOSITIVO) + "-" + String(random(100000));
  mqtt.setServer(MQTT_SERVIDOR, MQTT_PORTA);
  mqtt.setBufferSize(512);
  mqtt.setCallback(receberComando);

  Serial.println("Estados: NORMAL | ATENCAO | CRITICO | FALHA");
}

void loop() {
  unsigned long agora = millis();

  verificarChave();
  if (!ligado) {
    return;
  }

  receberCamera();
  receberGps();

  // A cada 20 ms: amostra o acelerometro para nao perder o pico do buraco
  if (agora - ultimaAmostra >= INTERVALO_AMOSTRA) {
    ultimaAmostra = agora;
    amostrarAcelerometro();
  }

  // A cada 100 ms: mede, decide e confirma o estado
  if (agora - ultimaLeitura >= INTERVALO_LEITURA) {
    ultimaLeitura = agora;
    lerSensores();
    estadoLido = decidirEstado();
    confirmarEstado(estadoLido);
  }

  // A cada 5 s: GPS, conexao e telemetria
  if (agora - ultimaTelemetria >= INTERVALO_TELEMETRIA) {
    ultimaTelemetria = agora;
    if (!acelerometroConectado) {
      iniciarAcelerometro();
    }
    avancarGps();
    verificarConexao();
    enviarTelemetria();
  }

  // A cada 250 ms: atualiza o display
  if (agora - ultimoLcd >= INTERVALO_LCD) {
    ultimoLcd = agora;
    atualizarLcd();
  }

  atualizarAlertas();
  mqtt.loop();
}

// Liga o MPU-6050 com escala de 8 g
void iniciarAcelerometro() {
  acelerometroConectado = acelerometro.begin();
  if (acelerometroConectado) {
    acelerometro.setAccelerometerRange(MPU6050_RANGE_8_G);
    acelerometro.setGyroRange(MPU6050_RANGE_500_DEG);
    Serial.println("[IMU] MPU-6050 conectado");
  } else {
    Serial.println("[IMU] MPU-6050 sem resposta");
  }
}

void lerSensores() {
  lerAcelerometro();
  lerLuz();
  lerBateria();
  lerChaves();
  posicaoLeitura = (posicaoLeitura + 1) % TAMANHO_MEDIA;
}

// Amostra rapida: guarda o maior impacto ate a proxima leitura.
// Impacto = quanto o modulo da aceleracao se afasta de 1 g (vale com o dispositivo em qualquer posicao)
void amostrarAcelerometro() {
  if (!acelerometroConectado) {
    amostraValida = false;
    return;
  }

  sensors_event_t aceleracao, giro, temp;
  acelerometro.getEvent(&aceleracao, &giro, &temp);
  float eixoX = aceleracao.acceleration.x / GRAVIDADE;
  float eixoY = aceleracao.acceleration.y / GRAVIDADE;
  float eixoZ = aceleracao.acceleration.z / GRAVIDADE;

  // Leitura fora da faixa fisica do sensor (8 g por eixo) e descartada
  if (isnan(eixoX) || isnan(eixoY) || isnan(eixoZ) || fabs(eixoX) > IMPACTO_MAXIMO || fabs(eixoY) > IMPACTO_MAXIMO || fabs(eixoZ) > IMPACTO_MAXIMO) {
    amostraValida = false;
    return;
  }

  amostraValida = true;
  float modulo = sqrt(eixoX * eixoX + eixoY * eixoY + eixoZ * eixoZ);
  float desvio = fabs(modulo - 1.0);
  if (desvio > picoImpacto) {
    picoImpacto = desvio;
  }

  // Inclinacao = angulo entre o eixo Z do sensor e a vertical (0 = instalado na horizontal)
  if (modulo > 0.1) {
    inclinacao = acos(constrain(eixoZ / modulo, -1.0, 1.0)) * RAD_TO_DEG;
  }
  giroscopio = giro.gyro.z * RAD_TO_DEG;
  temperatura = temp.temperature;
}

// A cada 100 ms: o pico das amostras entra na media movel
void lerAcelerometro() {
  impactoValido = amostraValida;
  if (!impactoValido) {
    picoImpacto = 0;
    return;
  }

  leiturasImpacto[posicaoLeitura] = picoImpacto;
  picoImpacto = 0;
  impacto = calcularMedia(leiturasImpacto);
}

// Luz em % (no modulo LDR, mais luz = menor tensao) e tempo no escuro
void lerLuz() {
  int leitura = analogRead(PINO_LDR);
  leiturasLuz[posicaoLeitura] = 100.0 - leitura * 100.0 / 4095.0;
  luz = calcularMedia(leiturasLuz);

  if (luz < LUZ_MINIMA) {
    if (inicioEscuro == 0) {
      inicioEscuro = millis();
    }
  } else {
    inicioEscuro = 0;
  }
}

// Potenciometro simula a carga da bateria (0 a 100%)
void lerBateria() {
  bateria = map(analogRead(PINO_BATERIA), 0, 4095, 0, 100);
}

// Sinal de GPS e cobertura de rede. Na bancada, sao duas chaves (para cima = ligado)
void lerChaves() {
#if EMULAR_PERIFERICOS
  gpsComSinal = digitalRead(PINO_GPS) == HIGH;
#else
  gpsComSinal = moduloGps.location.isValid() && moduloGps.location.age() < TEMPO_GPS_SEM_SINAL;
#endif
  redeDisponivel = digitalRead(PINO_REDE) == HIGH;

  if (!redeDisponivel && mqtt.connected()) {
    mqtt.disconnect();
    Serial.println("[REDE] Sem cobertura. Eventos vao para a fila offline.");
  }
}

// Media movel das ultimas 5 leituras
float calcularMedia(float valores[]) {
  float soma = 0;
  for (int i = 0; i < TAMANHO_MEDIA; i++) {
    soma = soma + valores[i];
  }
  return soma / TAMANHO_MEDIA;
}

// Compara as medidas com os limites. Ordem: FALHA, CRITICO, ATENCAO, NORMAL
int decidirEstado() {
  if (!impactoValido) {
    motivo = "acelerometro";
    mensagemLcd = "Falha IMU";
    return FALHA;
  }
  if (!gpsComSinal) {
    motivo = "gps_sem_sinal";
    mensagemLcd = "GPS sem sinal";
    return FALHA;
  }
  if (bateria < BATERIA_MINIMA) {
    motivo = "bateria_baixa";
    mensagemLcd = String("Bateria ") + bateria + "%";
    return FALHA;
  }

  unsigned long tempoEscuro = 0;
  if (inicioEscuro > 0) {
    tempoEscuro = millis() - inicioEscuro;
  }

  if (impacto >= IMPACTO_CRITICO) {
    motivo = "buraco";
    mensagemLcd = String("Buraco ") + String(impacto, 2) + "g";
    return CRITICO;
  }
  if (visto[CLASSE_BURACO] >= CAMERA_CRITICO) {
    motivo = "buraco";
    mensagemLcd = String("Buraco cam ") + visto[CLASSE_BURACO] + "%";
    return CRITICO;
  }
  if (visto[CLASSE_ALAGAMENTO] >= CAMERA_CRITICO) {
    motivo = "alagamento";
    mensagemLcd = String("Alagado ") + visto[CLASSE_ALAGAMENTO] + "%";
    return CRITICO;
  }
  if (tempoEscuro >= TEMPO_SEMAFORO_APAGADO) {
    motivo = "semaforo_apagado";
    mensagemLcd = "Semaforo apagado";
    return CRITICO;
  }
  if (visto[CLASSE_SEMAFORO] >= CAMERA_CRITICO) {
    motivo = "semaforo_apagado";
    mensagemLcd = String("Semaf. cam ") + visto[CLASSE_SEMAFORO] + "%";
    return CRITICO;
  }
  if (impacto >= IMPACTO_ATENCAO) {
    motivo = "irregularidade";
    mensagemLcd = String("Irregular ") + String(impacto, 2) + "g";
    return ATENCAO;
  }
  if (visto[CLASSE_BURACO] >= CAMERA_ATENCAO) {
    motivo = "buraco_suspeito";
    mensagemLcd = String("Buraco cam ") + visto[CLASSE_BURACO] + "%";
    return ATENCAO;
  }
  if (visto[CLASSE_ALAGAMENTO] >= CAMERA_ATENCAO) {
    motivo = "agua_na_via";
    mensagemLcd = String("Agua na via ") + visto[CLASSE_ALAGAMENTO] + "%";
    return ATENCAO;
  }
  if (visto[CLASSE_SEMAFORO] >= CAMERA_ATENCAO) {
    motivo = "semaforo_suspeito";
    mensagemLcd = String("Semaf. cam ") + visto[CLASSE_SEMAFORO] + "%";
    return ATENCAO;
  }
  if (visto[CLASSE_FAIXA] >= CAMERA_ATENCAO) {
    motivo = "faixa_apagada";
    mensagemLcd = String("Faixa apag. ") + visto[CLASSE_FAIXA] + "%";
    return ATENCAO;
  }
  if (tempoEscuro > 0) {
    motivo = "luz_fraca";
    mensagemLcd = String("Luz fraca ") + (tempoEscuro / 1000) + "s";
    return ATENCAO;
  }

  motivo = "via_ok";
  mensagemLcd = String(impacto, 2) + "g Luz " + String(luz, 0) + "%";
  return NORMAL;
}

// So troca de estado apos 3 leituras seguidas iguais (evita oscilacao)
void confirmarEstado(int novoEstado) {
  if (novoEstado == estadoAtual) {
    contadorConfirmacao = 0;
    return;
  }

  if (novoEstado == estadoCandidato) {
    contadorConfirmacao++;
  } else {
    estadoCandidato = novoEstado;
    contadorConfirmacao = 1;
  }

  if (contadorConfirmacao >= LEITURAS_PARA_CONFIRMAR) {
    contadorConfirmacao = 0;
    mudarEstado(novoEstado);
  }
}

// Registra a troca de estado; no CRITICO tira foto para o pre-chamado
void mudarEstado(int novoEstado) {
  Serial.println(String("[ESTADO] ") + NOMES_ESTADO[estadoAtual] + " -> " + NOMES_ESTADO[novoEstado] + " | motivo: " + motivo);
  estadoAtual = novoEstado;

  if (estadoAtual == CRITICO) {
    capturarFoto();
  }

  registrarEvento(EVENTOS_ESTADO[estadoAtual]);
}

// Pede a foto a ESP32-CAM, que desfoca rostos e placas antes de salvar.
// O LED azul acende como flash e o nome da foto vai no evento
void capturarFoto() {
  totalFotos++;
  ultimaFoto = String("foto_") + totalFotos;
  fimFlash = millis() + TEMPO_FLASH;
#if !EMULAR_PERIFERICOS
  Serial1.println(String("FOTO ") + ultimaFoto);
#endif
  Serial.println(String("[CAMERA] ") + ultimaFoto + " capturada e anonimizada (rostos e placas desfocados)");
}

// A ESP32-CAM roda a visao computacional e avisa cada deteccao por UART, uma linha por vez:
// "DET alagamento 87" (classe e confianca em %). As classes sao buraco, alagamento,
// semaforo_apagado e faixa_apagada. Na bancada, a linha vem do Serial Monitor
void receberCamera() {
#if EMULAR_PERIFERICOS
  Stream& porta = Serial;
#else
  Stream& porta = Serial1;
#endif

  while (porta.available() > 0) {
    char letra = porta.read();
    if (letra == '\n') {
      tratarDeteccao(linhaCamera);
      linhaCamera = "";
    } else if (letra != '\r' && linhaCamera.length() < 40) {
      linhaCamera += letra;
    }
  }

  // Sem deteccao nova por 3 s: a camera nao ve mais aquele problema
  for (int i = 0; i < TOTAL_CLASSES; i++) {
    if (visto[i] > 0 && millis() - ultimaDeteccao[i] > TEMPO_DETECCAO) {
      visto[i] = 0;
    }
  }
}

// Guarda a confianca (0 a 100%) da classe detectada; linhas desconhecidas sao ignoradas
void tratarDeteccao(String linha) {
  int espaco = linha.lastIndexOf(' ');
  if (!linha.startsWith("DET ") || espaco <= 4) {
    return;
  }

  String classe = linha.substring(4, espaco);
  int confianca = constrain(linha.substring(espaco + 1).toInt(), 0, 100);
  for (int i = 0; i < TOTAL_CLASSES; i++) {
    if (classe == NOMES_CLASSE[i]) {
      visto[i] = confianca;
      ultimaDeteccao[i] = millis();
    }
  }
}

// Chave liga/desliga (para cima = ligado). Desligado: apaga tudo e espera; ao religar, reinicia.
// Na montagem fisica a chave tambem pode cortar a bateria; lida pelo firmware, ela funciona no simulador
void verificarChave() {
  bool chaveLigada = digitalRead(PINO_CHAVE) == HIGH;

  if (!chaveLigada && ligado) {
    ligado = false;
    Serial.println("[ENERGIA] Dispositivo desligado");
    mqtt.disconnect();
    digitalWrite(PINO_LED_VERDE, LOW);
    digitalWrite(PINO_LED_AMARELO, LOW);
    digitalWrite(PINO_LED_VERMELHO, LOW);
    digitalWrite(PINO_LED_CAMERA, LOW);
    noTone(PINO_BUZZER);
    buzzerLigado = false;
    lcd.clear();
    lcd.noBacklight();
  }

  if (chaveLigada && !ligado) {
    Serial.println("[ENERGIA] Dispositivo ligado");
    ESP.restart();
  }
}

// Publica o evento ou guarda na fila se estiver sem rede
void registrarEvento(String evento) {
  String mensagem = montarMensagem(evento);

  if (estaOnline()) {
    publicar(mensagem);
  } else {
    guardarNaFila(mensagem);
  }
}

// Mensagem no formato UltraLight do FIWARE (chave|valor)
String montarMensagem(String evento) {
  String mensagem = String("ev|") + evento;
  mensagem += String("|s|") + NOMES_ESTADO[estadoAtual];
  mensagem += String("|m|") + motivo;
  mensagem += String("|i|") + String(impacto, 2);
  mensagem += String("|a|") + visto[CLASSE_ALAGAMENTO];
  mensagem += String("|vb|") + visto[CLASSE_BURACO];
  mensagem += String("|vs|") + visto[CLASSE_SEMAFORO];
  mensagem += String("|vf|") + visto[CLASSE_FAIXA];
  mensagem += String("|l|") + String(luz, 0);
  mensagem += String("|b|") + bateria;
  mensagem += String("|g|") + String(giroscopio, 1);
  mensagem += String("|la|") + String(latitude, 6);
  mensagem += String("|lo|") + String(longitude, 6);
  mensagem += String("|v|") + String(velocidade, 1);
  mensagem += String("|n|") + String(inclinacao, 0);
  mensagem += String("|f|") + ultimaFoto;
  mensagem += String("|t|") + (millis() / 1000);
  return mensagem;
}

bool estaOnline() {
  return redeDisponivel && mqtt.connected();
}

String textoRede() {
  if (estaOnline()) {
    return "online";
  }
  return "offline";
}

void publicar(String mensagem) {
  mqtt.publish(TOPICO_DADOS, mensagem.c_str());
  Serial.println(String("[MQTT] ") + mensagem);
}

// Fila cheia: descarta o evento mais antigo para guardar o novo
void guardarNaFila(String mensagem) {
  if (itensFila == TAMANHO_FILA) {
    for (int i = 1; i < TAMANHO_FILA; i++) {
      filaOffline[i - 1] = filaOffline[i];
    }
    itensFila--;
  }

  filaOffline[itensFila] = mensagem;
  itensFila++;
  Serial.println(String("[OFFLINE] Evento guardado na fila (") + itensFila + "/" + TAMANHO_FILA + ")");
}

// Envia a fila na ordem em que os eventos aconteceram
void enviarFila() {
  if (itensFila == 0) {
    return;
  }

  Serial.println(String("[OFFLINE] Enviando ") + itensFila + " evento(s) guardado(s)");
  for (int i = 0; i < itensFila; i++) {
    publicar(filaOffline[i]);
  }
  itensFila = 0;
}

// Tenta conectar ao broker; ao conseguir, assina os comandos e esvazia a fila
void verificarConexao() {
  if (!redeDisponivel || mqtt.connected()) {
    return;
  }

  if (WiFi.status() != WL_CONNECTED) {
    Serial.println("[REDE] Aguardando Wi-Fi...");
    return;
  }

  Serial.println("[MQTT] Conectando ao broker...");
  if (mqtt.connect(idCliente.c_str())) {
    mqtt.subscribe(TOPICO_COMANDO);
    Serial.println(String("[MQTT] Conectado. Publicando em ") + TOPICO_DADOS);
    enviarFila();
  } else {
    Serial.println(String("[MQTT] Falha na conexao, codigo ") + mqtt.state());
  }
}

// Comando remoto do FIWARE: "olhonavia001@foto|" tira uma foto
void receberComando(char* topico, byte* conteudo, unsigned int tamanho) {
  String comando = "";
  for (unsigned int i = 0; i < tamanho; i++) {
    comando += (char)conteudo[i];
  }
  Serial.println(String("[MQTT] Comando recebido: ") + comando);

  if (comando.indexOf("@foto") >= 0) {
    capturarFoto();
    registrarEvento("foto_remota");
    String resposta = String(DISPOSITIVO) + "@foto|ok";
    mqtt.publish(TOPICO_RESPOSTA, resposta.c_str());
  }
}

// Montagem fisica: decodifica as sentencas NMEA que chegam do GPS
void receberGps() {
#if !EMULAR_PERIFERICOS
  while (Serial2.available() > 0) {
    moduloGps.encode(Serial2.read());
  }
#endif
}

// Atualiza posicao e velocidade; sem sinal, a posicao fica parada.
// Na bancada, avanca para o proximo ponto da rota emulada
void avancarGps() {
  if (!gpsComSinal) {
    velocidade = 0;
    return;
  }
#if EMULAR_PERIFERICOS
  pontoRota = (pontoRota + 1) % PONTOS_ROTA;
  latitude = ROTA_LATITUDE[pontoRota];
  longitude = ROTA_LONGITUDE[pontoRota];
  velocidade = VELOCIDADE_ROTA;
#else
  latitude = moduloGps.location.lat();
  longitude = moduloGps.location.lng();
  velocidade = moduloGps.speed.kmph();
#endif
}

// Resumo no Serial Monitor e envio periodico ao broker
void enviarTelemetria() {
  String linha = String("[TELEMETRIA] estado=") + NOMES_ESTADO[estadoAtual];
  linha += String(" impacto=") + String(impacto, 2) + "g";
  linha += String(" camera=buraco:") + visto[CLASSE_BURACO] + "%,alagamento:" + visto[CLASSE_ALAGAMENTO] + "%,semaforo:" + visto[CLASSE_SEMAFORO] + "%,faixa:" + visto[CLASSE_FAIXA] + "%";
  linha += String(" luz=") + String(luz, 0) + "%";
  linha += String(" bateria=") + bateria + "%";
  linha += String(" giro=") + String(giroscopio, 1) + "graus/s";
  linha += String(" incl=") + String(inclinacao, 0) + "graus";
  linha += String(" temp=") + String(temperatura, 1) + "C";
  linha += String(" gps=") + String(latitude, 6) + "," + String(longitude, 6);
  linha += String(" vel=") + String(velocidade, 1) + "km/h";
  linha += String(" rede=") + textoRede();
  linha += String(" fila=") + itensFila;
  Serial.println(linha);

  if (estaOnline()) {
    publicar(montarMensagem("telemetria"));
  }
}

// LED da cor do estado, amarelo piscando na FALHA e buzzer intermitente no CRITICO
void atualizarAlertas() {
  bool piscar = (millis() / 500) % 2 == 0;
  bool bipe = (millis() / 250) % 2 == 0;

  digitalWrite(PINO_LED_VERDE, estadoAtual == NORMAL);
  digitalWrite(PINO_LED_AMARELO, estadoAtual == ATENCAO || (estadoAtual == FALHA && piscar));
  digitalWrite(PINO_LED_VERMELHO, estadoAtual == CRITICO);
  digitalWrite(PINO_LED_CAMERA, millis() < fimFlash);

  bool tocar = estadoAtual == CRITICO && bipe;
  if (tocar && !buzzerLigado) {
    tone(PINO_BUZZER, 1000);
    buzzerLigado = true;
  }
  if (!tocar && buzzerLigado) {
    noTone(PINO_BUZZER);
    buzzerLigado = false;
  }
}

// Linha 1: estado e rede (OFF + tamanho da fila). Linha 2: motivo e valor
void atualizarLcd() {
  String status = "ONLINE";
  if (!estaOnline()) {
    status = String("OFF F") + itensFila;
  }
  escreverLinha(0, completar(NOMES_ESTADO[estadoAtual], 9) + status);

  if (estadoLido == estadoAtual) {
    escreverLinha(1, mensagemLcd);
  }
}

// Completa o texto com espacos para apagar o que sobrou da tela anterior
String completar(String texto, int tamanho) {
  while ((int)texto.length() < tamanho) {
    texto += " ";
  }
  return texto;
}

void escreverLinha(int linha, String texto) {
  lcd.setCursor(0, linha);
  lcd.print(completar(texto, 16));
}
