// Olho na Via - dispositivo IoT de borda (Edge Computing & Computer Systems)
// Equipe: Erick Nathan Capito Pereira - RM573635
// Mede impacto, lamina d'agua, luz, GPS e bateria, decide o estado da via e avisa por LEDs, buzzer, LCD e MQTT.

#include <WiFi.h>
#include <PubSubClient.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <LiquidCrystal_I2C.h>

const char* PROJETO = "Olho na Via - Dispositivo IoT de borda v1.0";
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
const int PINO_BOTAO = 25;
const int PINO_ECHO = 14;
const int PINO_TRIG = 13;
const int PINO_LED_VERDE = 19;
const int PINO_LED_AMARELO = 18;
const int PINO_LED_VERMELHO = 5;
const int PINO_LED_CAMERA = 17;
const int PINO_BUZZER = 16;

// Limites de decisao (valores iniciais, calibrados no piloto)
const float GRAVIDADE = 9.80665;
const float IMPACTO_ATENCAO = 0.4;
const float IMPACTO_CRITICO = 1.0;
const float IMPACTO_MAXIMO = 8.0;
const float AGUA_ATENCAO = 5.0;
const float AGUA_CRITICO = 15.0;
const float ALTURA_SENSOR_AGUA = 50.0;
const float DISTANCIA_MINIMA = 2.0;
const float DISTANCIA_MAXIMA = 400.0;
const float LUZ_MINIMA = 30.0;
const unsigned long TEMPO_SEMAFORO_APAGADO = 10000;
const int BATERIA_MINIMA = 15;

// Tempos das tarefas e tamanhos de vetores
const unsigned long INTERVALO_LEITURA = 100;
const unsigned long INTERVALO_TELEMETRIA = 5000;
const unsigned long INTERVALO_LCD = 250;
const unsigned long TEMPO_FLASH = 300;
const unsigned long TEMPO_BOTAO = 300;
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

// Rota emulada do GPS (Av. Paulista, da Consolacao ao Paraiso)
const int PONTOS_ROTA = 8;
const double ROTA_LATITUDE[PONTOS_ROTA] = {-23.555771, -23.558103, -23.561414, -23.563987, -23.566296, -23.568921, -23.571130, -23.574720};
const double ROTA_LONGITUDE[PONTOS_ROTA] = {-46.662310, -46.660010, -46.655881, -46.652510, -46.649730, -46.646420, -46.643620, -46.641050};

WiFiClient clienteWifi;
PubSubClient mqtt(clienteWifi);
Adafruit_MPU6050 acelerometro;
LiquidCrystal_I2C lcd(0x27, 16, 2);

// Ultimas leituras para a media movel
float leiturasImpacto[TAMANHO_MEDIA];
float leiturasAgua[TAMANHO_MEDIA];
float leiturasLuz[TAMANHO_MEDIA];
int posicaoLeitura = 0;

// Valores medidos (ja suavizados)
float impacto = 0;
float agua = 0;
float luz = 100;
int bateria = 100;
float giroscopio = 0;
float temperatura = 0;
int pontoRota = 0;
double latitude = ROTA_LATITUDE[0];
double longitude = ROTA_LONGITUDE[0];

// Validade das leituras e condicoes de operacao
bool acelerometroConectado = false;
bool impactoValido = false;
bool aguaValida = false;
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

// Camera, alertas e botao
int totalFotos = 0;
String ultimaFoto = "nenhuma";
unsigned long fimFlash = 0;
bool buzzerLigado = false;
int botaoAnterior = HIGH;
unsigned long ultimoBotao = 0;

// Fila de eventos guardados sem rede
String filaOffline[TAMANHO_FILA];
int itensFila = 0;
String idCliente = "";

// Ultima execucao de cada tarefa (millis)
unsigned long ultimaLeitura = 0;
unsigned long ultimaTelemetria = 0;
unsigned long ultimoLcd = 0;

void setup() {
  Serial.begin(115200);
  Serial.println(PROJETO);
  Serial.println(EQUIPE);

  // Chaves e botao usam o resistor de pull-up interno
  pinMode(PINO_GPS, INPUT_PULLUP);
  pinMode(PINO_REDE, INPUT_PULLUP);
  pinMode(PINO_BOTAO, INPUT_PULLUP);
  pinMode(PINO_ECHO, INPUT);
  pinMode(PINO_TRIG, OUTPUT);
  pinMode(PINO_LED_VERDE, OUTPUT);
  pinMode(PINO_LED_AMARELO, OUTPUT);
  pinMode(PINO_LED_VERMELHO, OUTPUT);
  pinMode(PINO_LED_CAMERA, OUTPUT);
  pinMode(PINO_BUZZER, OUTPUT);

  // Media movel comeca com a via em condicao normal
  for (int i = 0; i < TAMANHO_MEDIA; i++) {
    leiturasImpacto[i] = 0;
    leiturasAgua[i] = 0;
    leiturasLuz[i] = 100;
  }

  Wire.begin();
  lcd.init();
  lcd.backlight();
  escreverLinha(0, "Olho na Via");
  escreverLinha(1, "Iniciando...");

  iniciarAcelerometro();

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

  verificarBotao();

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
  lerSensorAgua();
  lerLuz();
  lerBateria();
  lerChaves();
  posicaoLeitura = (posicaoLeitura + 1) % TAMANHO_MEDIA;
}

// Impacto = quanto a aceleracao vertical se afasta de 1 g
void lerAcelerometro() {
  if (!acelerometroConectado) {
    impactoValido = false;
    return;
  }

  sensors_event_t aceleracao, giro, temp;
  acelerometro.getEvent(&aceleracao, &giro, &temp);
  float eixoZ = aceleracao.acceleration.z / GRAVIDADE;

  // Leitura fora da faixa fisica e descartada
  if (isnan(eixoZ) || eixoZ > IMPACTO_MAXIMO || eixoZ < -IMPACTO_MAXIMO) {
    impactoValido = false;
    return;
  }

  impactoValido = true;
  leiturasImpacto[posicaoLeitura] = fabs(eixoZ - 1.0);
  impacto = calcularMedia(leiturasImpacto);
  giroscopio = giro.gyro.z * RAD_TO_DEG;
  temperatura = temp.temperature;
}

// Ultrassom a 50 cm do chao: lamina = altura - distancia ate a agua
void lerSensorAgua() {
  digitalWrite(PINO_TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(PINO_TRIG, HIGH);
  delayMicroseconds(10);
  digitalWrite(PINO_TRIG, LOW);

  unsigned long duracao = pulseIn(PINO_ECHO, HIGH, 30000);
  float distancia = duracao / 58.0;

  // Sem eco ou fora do alcance do sensor: leitura invalida
  if (duracao == 0 || distancia < DISTANCIA_MINIMA || distancia > DISTANCIA_MAXIMA) {
    aguaValida = false;
    return;
  }

  aguaValida = true;
  float lamina = ALTURA_SENSOR_AGUA - distancia;
  if (lamina < 0) {
    lamina = 0;
  }
  leiturasAgua[posicaoLeitura] = lamina;
  agua = calcularMedia(leiturasAgua);
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

// Chaves simulam sinal de GPS e cobertura de rede (para cima = ligado)
void lerChaves() {
  gpsComSinal = digitalRead(PINO_GPS) == HIGH;
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
  if (!aguaValida) {
    motivo = "sensor_agua";
    mensagemLcd = "Falha ultrassom";
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
  if (agua > AGUA_CRITICO) {
    motivo = "alagamento";
    mensagemLcd = String("Alagado ") + String(agua, 0) + "cm";
    return CRITICO;
  }
  if (tempoEscuro >= TEMPO_SEMAFORO_APAGADO) {
    motivo = "semaforo_apagado";
    mensagemLcd = "Semaforo apagado";
    return CRITICO;
  }
  if (impacto >= IMPACTO_ATENCAO) {
    motivo = "irregularidade";
    mensagemLcd = String("Irregular ") + String(impacto, 2) + "g";
    return ATENCAO;
  }
  if (agua >= AGUA_ATENCAO) {
    motivo = "agua_na_via";
    mensagemLcd = String("Agua na via ") + String(agua, 0) + "cm";
    return ATENCAO;
  }
  if (tempoEscuro > 0) {
    motivo = "luz_fraca";
    mensagemLcd = String("Luz fraca ") + (tempoEscuro / 1000) + "s";
    return ATENCAO;
  }

  motivo = "via_ok";
  mensagemLcd = String(impacto, 2) + "g " + String(agua, 0) + "cm L" + String(luz, 0) + "%";
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

// Simula a ESP32-CAM: LED azul como flash e nome da foto no evento
void capturarFoto() {
  totalFotos++;
  ultimaFoto = String("foto_") + totalFotos;
  fimFlash = millis() + TEMPO_FLASH;
  Serial.println(String("[CAMERA] ") + ultimaFoto + " capturada e anonimizada (rostos e placas desfocados)");
}

// Botao do Kit Cidadao: detecta o aperto (HIGH -> LOW) com protecao contra repique
void verificarBotao() {
  int leitura = digitalRead(PINO_BOTAO);

  if (leitura == LOW && botaoAnterior == HIGH && millis() - ultimoBotao > TEMPO_BOTAO) {
    ultimoBotao = millis();
    Serial.println("[KIT CIDADAO] Reporte manual do voluntario");
    capturarFoto();
    registrarEvento("reporte_manual");
  }

  botaoAnterior = leitura;
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
  mensagem += String("|h|") + String(agua, 1);
  mensagem += String("|l|") + String(luz, 0);
  mensagem += String("|b|") + bateria;
  mensagem += String("|g|") + String(giroscopio, 1);
  mensagem += String("|la|") + String(latitude, 6);
  mensagem += String("|lo|") + String(longitude, 6);
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

// Avanca para o proximo ponto da rota; sem sinal, a posicao fica parada
void avancarGps() {
  if (!gpsComSinal) {
    return;
  }
  pontoRota = (pontoRota + 1) % PONTOS_ROTA;
  latitude = ROTA_LATITUDE[pontoRota];
  longitude = ROTA_LONGITUDE[pontoRota];
}

// Resumo no Serial Monitor e envio periodico ao broker
void enviarTelemetria() {
  String linha = String("[TELEMETRIA] estado=") + NOMES_ESTADO[estadoAtual];
  linha += String(" impacto=") + String(impacto, 2) + "g";
  linha += String(" agua=") + String(agua, 1) + "cm";
  linha += String(" luz=") + String(luz, 0) + "%";
  linha += String(" bateria=") + bateria + "%";
  linha += String(" giro=") + String(giroscopio, 1) + "graus/s";
  linha += String(" temp=") + String(temperatura, 1) + "C";
  linha += String(" gps=") + String(latitude, 6) + "," + String(longitude, 6);
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
