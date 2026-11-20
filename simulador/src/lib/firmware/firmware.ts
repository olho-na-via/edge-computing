// Firmware do Olho na Via em TypeScript: a mesma lógica do ../../../../sketch.ino, função por função,
// com os mesmos nomes, limites e tempos. O que no ESP32 é uma chamada do Arduino (digitalRead,
// analogRead, lcd.print, mqtt.publish...) aqui é uma chamada à Placa emulada.
//
// Ao mudar a lógica, mude os dois arquivos: o painel "Código" do simulador mostra o sketch.ino.

import {
	GRAVIDADE,
	HIGH,
	LOW,
	PINO_BATERIA,
	CLASSES_CAMERA,
	PINO_BUZZER,
	PINO_CHAVE,
	PINO_GPS,
	PINO_LDR,
	PINO_LED_AMARELO,
	PINO_LED_CAMERA,
	PINO_LED_VERDE,
	PINO_LED_VERMELHO,
	PINO_REDE,
	WL_CONNECTED,
	limitar,
	type Placa
} from './placa.ts';

export const PROJETO = 'Olho na Via - Dispositivo IoT de borda v1.3';
export const EQUIPE = 'Erick Nathan Capito Pereira - RM573635';

// Rede e MQTT
export const MQTT_SERVIDOR = 'broker.hivemq.com';
export const DISPOSITIVO = 'olhonavia001';
export const TOPICO_DADOS = '/TEF/olhonavia001/attrs';
export const TOPICO_COMANDO = '/TEF/olhonavia001/cmd';
export const TOPICO_RESPOSTA = '/TEF/olhonavia001/cmdexe';

// Limites de decisão
export const IMPACTO_ATENCAO = 0.4;
export const IMPACTO_CRITICO = 1.0;
export const IMPACTO_MAXIMO = 8.0;
export const CAMERA_ATENCAO = 30;
export const CAMERA_CRITICO = 50;
export const LUZ_MINIMA = 30.0;
export const TEMPO_SEMAFORO_APAGADO = 10000;
export const BATERIA_MINIMA = 15;

// Tempos das tarefas e tamanhos de vetores
export const INTERVALO_AMOSTRA = 20;
export const INTERVALO_LEITURA = 100;
export const INTERVALO_TELEMETRIA = 5000;
export const INTERVALO_LCD = 250;
export const TEMPO_FLASH = 300;
export const TEMPO_DETECCAO = 3000;
export const TEMPO_GPS_SEM_SINAL = 5000;
export const TAMANHO_MEDIA = 5;
export const LEITURAS_PARA_CONFIRMAR = 3;
export const TAMANHO_FILA = 10;

// Estados da máquina de estados
export const NORMAL = 0;
export const ATENCAO = 1;
export const CRITICO = 2;
export const FALHA = 3;
export const NOMES_ESTADO = ['NORMAL', 'ATENCAO', 'CRITICO', 'FALHA'] as const;
export const EVENTOS_ESTADO = ['via_normalizada', 'registro_ponto', 'pre_chamado', 'falha_sensor'];
export type NomeEstado = (typeof NOMES_ESTADO)[number];

// Classes que a visão computacional da câmera detecta (mesma ordem de NOMES_CLASSE)
export const CLASSE_BURACO = 0;
export const CLASSE_ALAGAMENTO = 1;
export const CLASSE_SEMAFORO = 2;
export const CLASSE_FAIXA = 3;
export const TOTAL_CLASSES = 4;
export const NOMES_CLASSE = CLASSES_CAMERA;

// Rota emulada do GPS (Av. Paulista, da Consolação ao Paraíso)
export const PONTOS_ROTA = 8;
export const ROTA_LATITUDE = [
	-23.555771, -23.558103, -23.561414, -23.563987, -23.566296, -23.568921, -23.57113, -23.57472
];
export const ROTA_LONGITUDE = [
	-46.66231, -46.66001, -46.655881, -46.65251, -46.64973, -46.64642, -46.64362, -46.64105
];
export const VELOCIDADE_ROTA = 30.0;

const RAD_TO_DEG = 180 / Math.PI;

export class Firmware {
	private readonly placa: Placa;

	// Últimas leituras para a média móvel
	leiturasImpacto = new Array<number>(TAMANHO_MEDIA).fill(0);
	leiturasLuz = new Array<number>(TAMANHO_MEDIA).fill(100);
	posicaoLeitura = 0;

	// Valores medidos (já suavizados)
	impacto = 0;
	/** Confiança (%) da última detecção de cada classe pela câmera; 0 = nada. */
	visto = new Array<number>(TOTAL_CLASSES).fill(0);
	luz = 100;
	bateria = 100;
	giroscopio = 0;
	inclinacao = 0;
	temperatura = 0;
	pontoRota = 0;
	latitude = ROTA_LATITUDE[0];
	longitude = ROTA_LONGITUDE[0];
	velocidade = 0;

	// Amostragem rápida do acelerômetro (entre uma leitura e outra)
	picoImpacto = 0;
	amostraValida = false;

	// Validade das leituras e condições de operação
	acelerometroConectado = false;
	impactoValido = false;
	gpsComSinal = true;
	redeDisponivel = true;
	inicioEscuro = 0;

	// Controle de estado
	estadoAtual = NORMAL;
	estadoLido = NORMAL;
	estadoCandidato = NORMAL;
	contadorConfirmacao = 0;
	motivo = 'via_ok';
	mensagemLcd = '';

	// Câmera, alertas e chave liga/desliga
	totalFotos = 0;
	ultimaFoto = 'nenhuma';
	fimFlash = 0;
	buzzerLigado = false;
	linhaCamera = '';
	ultimaDeteccao = new Array<number>(TOTAL_CLASSES).fill(0);
	ligado = true;

	// Fila de eventos guardados sem rede
	filaOffline: string[] = [];
	itensFila = 0;
	idCliente = '';

	// Última execução de cada tarefa (millis)
	ultimaAmostra = 0;
	ultimaLeitura = 0;
	ultimaTelemetria = 0;
	ultimoLcd = 0;

	constructor(placa: Placa) {
		this.placa = placa;
	}

	setup(): void {
		const { Serial, lcd, WiFi, mqtt } = this.placa;
		Serial.println(PROJETO);
		Serial.println(EQUIPE);

		// Média móvel começa com a via em condição normal
		for (let i = 0; i < TAMANHO_MEDIA; i++) {
			this.leiturasImpacto[i] = 0;
			this.leiturasLuz[i] = 100;
		}

		lcd.init();
		lcd.backlight();
		this.escreverLinha(0, 'Olho na Via');
		this.escreverLinha(1, 'Iniciando...');

		this.iniciarAcelerometro();

		// Wi-Fi conecta em segundo plano; o MQTT é tentado a cada 5 s no loop
		WiFi.begin();
		this.idCliente = `${DISPOSITIVO}-${Math.floor(Math.random() * 100000)}`;
		mqtt.setCallback((topico, conteudo, tamanho) => this.receberComando(topico, conteudo, tamanho));

		Serial.println('Estados: NORMAL | ATENCAO | CRITICO | FALHA');
	}

	loop(): void {
		const agora = this.placa.millis();

		this.verificarChave();
		if (!this.ligado) {
			return;
		}

		this.receberCamera();
		this.receberGps();

		// A cada 20 ms: amostra o acelerômetro para não perder o pico do buraco
		if (agora - this.ultimaAmostra >= INTERVALO_AMOSTRA) {
			this.ultimaAmostra = agora;
			this.amostrarAcelerometro();
		}

		// A cada 100 ms: mede, decide e confirma o estado
		if (agora - this.ultimaLeitura >= INTERVALO_LEITURA) {
			this.ultimaLeitura = agora;
			this.lerSensores();
			this.estadoLido = this.decidirEstado();
			this.confirmarEstado(this.estadoLido);
		}

		// A cada 5 s: GPS, conexão e telemetria
		if (agora - this.ultimaTelemetria >= INTERVALO_TELEMETRIA) {
			this.ultimaTelemetria = agora;
			if (!this.acelerometroConectado) {
				this.iniciarAcelerometro();
			}
			this.avancarGps();
			this.verificarConexao();
			this.enviarTelemetria();
		}

		// A cada 250 ms: atualiza o display
		if (agora - this.ultimoLcd >= INTERVALO_LCD) {
			this.ultimoLcd = agora;
			this.atualizarLcd();
		}

		this.atualizarAlertas();
		this.placa.mqtt.loop();
	}

	// Liga o MPU-6050 com escala de 8 g
	iniciarAcelerometro(): void {
		this.acelerometroConectado = this.placa.acelerometro.begin();
		if (this.acelerometroConectado) {
			this.placa.Serial.println('[IMU] MPU-6050 conectado');
		} else {
			this.placa.Serial.println('[IMU] MPU-6050 sem resposta');
		}
	}

	lerSensores(): void {
		this.lerAcelerometro();
		this.lerLuz();
		this.lerBateria();
		this.lerChaves();
		this.posicaoLeitura = (this.posicaoLeitura + 1) % TAMANHO_MEDIA;
	}

	// Amostra rápida: guarda o maior impacto até a próxima leitura.
	// Impacto = quanto o módulo da aceleração se afasta de 1 g (vale com o dispositivo em qualquer posição)
	amostrarAcelerometro(): void {
		if (!this.acelerometroConectado) {
			this.amostraValida = false;
			return;
		}

		const { aceleracao, giro, temp } = this.placa.acelerometro.getEvent();
		const eixoX = aceleracao.acceleration.x / GRAVIDADE;
		const eixoY = aceleracao.acceleration.y / GRAVIDADE;
		const eixoZ = aceleracao.acceleration.z / GRAVIDADE;

		// Leitura fora da faixa física do sensor (8 g por eixo) é descartada
		if (
			Number.isNaN(eixoX) ||
			Number.isNaN(eixoY) ||
			Number.isNaN(eixoZ) ||
			Math.abs(eixoX) > IMPACTO_MAXIMO ||
			Math.abs(eixoY) > IMPACTO_MAXIMO ||
			Math.abs(eixoZ) > IMPACTO_MAXIMO
		) {
			this.amostraValida = false;
			return;
		}

		this.amostraValida = true;
		const modulo = Math.sqrt(eixoX * eixoX + eixoY * eixoY + eixoZ * eixoZ);
		const desvio = Math.abs(modulo - 1.0);
		if (desvio > this.picoImpacto) {
			this.picoImpacto = desvio;
		}

		// Inclinação = ângulo entre o eixo Z do sensor e a vertical (0 = instalado na horizontal)
		if (modulo > 0.1) {
			this.inclinacao = Math.acos(limitar(eixoZ / modulo, -1.0, 1.0)) * RAD_TO_DEG;
		}
		this.giroscopio = giro.gyro.z * RAD_TO_DEG;
		this.temperatura = temp.temperature;
	}

	// A cada 100 ms: o pico das amostras entra na média móvel
	lerAcelerometro(): void {
		this.impactoValido = this.amostraValida;
		if (!this.impactoValido) {
			this.picoImpacto = 0;
			return;
		}

		this.leiturasImpacto[this.posicaoLeitura] = this.picoImpacto;
		this.picoImpacto = 0;
		this.impacto = this.calcularMedia(this.leiturasImpacto);
	}

	// Luz em % (no módulo LDR, mais luz = menor tensão) e tempo no escuro
	lerLuz(): void {
		const leitura = this.placa.analogRead(PINO_LDR);
		this.leiturasLuz[this.posicaoLeitura] = 100.0 - (leitura * 100.0) / 4095.0;
		this.luz = this.calcularMedia(this.leiturasLuz);

		if (this.luz < LUZ_MINIMA) {
			if (this.inicioEscuro === 0) {
				this.inicioEscuro = this.placa.millis();
			}
		} else {
			this.inicioEscuro = 0;
		}
	}

	// Carga da bateria (0 a 100%)
	lerBateria(): void {
		this.bateria = Math.trunc((this.placa.analogRead(PINO_BATERIA) * 100) / 4095);
	}

	// Sinal de GPS e cobertura de rede. Na bancada, são duas chaves (para cima = ligado)
	lerChaves(): void {
		const { placa } = this;
		if (placa.emularGps) {
			this.gpsComSinal = placa.digitalRead(PINO_GPS) === HIGH;
		} else {
			this.gpsComSinal =
				placa.moduloGps.location.isValid() && placa.moduloGps.location.age() < TEMPO_GPS_SEM_SINAL;
		}
		this.redeDisponivel = placa.digitalRead(PINO_REDE) === HIGH;

		if (!this.redeDisponivel && placa.mqtt.connected()) {
			placa.mqtt.disconnect();
			placa.Serial.println('[REDE] Sem cobertura. Eventos vao para a fila offline.');
		}
	}

	// Média móvel das últimas 5 leituras
	calcularMedia(valores: number[]): number {
		let soma = 0;
		for (let i = 0; i < TAMANHO_MEDIA; i++) {
			soma = soma + valores[i];
		}
		return soma / TAMANHO_MEDIA;
	}

	// Compara as medidas com os limites. Ordem: FALHA, CRITICO, ATENCAO, NORMAL
	decidirEstado(): number {
		if (!this.impactoValido) {
			this.motivo = 'acelerometro';
			this.mensagemLcd = 'Falha IMU';
			return FALHA;
		}
		if (!this.gpsComSinal) {
			this.motivo = 'gps_sem_sinal';
			this.mensagemLcd = 'GPS sem sinal';
			return FALHA;
		}
		if (this.bateria < BATERIA_MINIMA) {
			this.motivo = 'bateria_baixa';
			this.mensagemLcd = `Bateria ${this.bateria}%`;
			return FALHA;
		}

		let tempoEscuro = 0;
		if (this.inicioEscuro > 0) {
			tempoEscuro = this.placa.millis() - this.inicioEscuro;
		}

		if (this.impacto >= IMPACTO_CRITICO) {
			this.motivo = 'buraco';
			this.mensagemLcd = `Buraco ${this.impacto.toFixed(2)}g`;
			return CRITICO;
		}
		if (this.visto[CLASSE_BURACO] >= CAMERA_CRITICO) {
			this.motivo = 'buraco';
			this.mensagemLcd = `Buraco cam ${this.visto[CLASSE_BURACO]}%`;
			return CRITICO;
		}
		if (this.visto[CLASSE_ALAGAMENTO] >= CAMERA_CRITICO) {
			this.motivo = 'alagamento';
			this.mensagemLcd = `Alagado ${this.visto[CLASSE_ALAGAMENTO]}%`;
			return CRITICO;
		}
		if (tempoEscuro >= TEMPO_SEMAFORO_APAGADO) {
			this.motivo = 'semaforo_apagado';
			this.mensagemLcd = 'Semaforo apagado';
			return CRITICO;
		}
		if (this.visto[CLASSE_SEMAFORO] >= CAMERA_CRITICO) {
			this.motivo = 'semaforo_apagado';
			this.mensagemLcd = `Semaf. cam ${this.visto[CLASSE_SEMAFORO]}%`;
			return CRITICO;
		}
		if (this.impacto >= IMPACTO_ATENCAO) {
			this.motivo = 'irregularidade';
			this.mensagemLcd = `Irregular ${this.impacto.toFixed(2)}g`;
			return ATENCAO;
		}
		if (this.visto[CLASSE_BURACO] >= CAMERA_ATENCAO) {
			this.motivo = 'buraco_suspeito';
			this.mensagemLcd = `Buraco cam ${this.visto[CLASSE_BURACO]}%`;
			return ATENCAO;
		}
		if (this.visto[CLASSE_ALAGAMENTO] >= CAMERA_ATENCAO) {
			this.motivo = 'agua_na_via';
			this.mensagemLcd = `Agua na via ${this.visto[CLASSE_ALAGAMENTO]}%`;
			return ATENCAO;
		}
		if (this.visto[CLASSE_SEMAFORO] >= CAMERA_ATENCAO) {
			this.motivo = 'semaforo_suspeito';
			this.mensagemLcd = `Semaf. cam ${this.visto[CLASSE_SEMAFORO]}%`;
			return ATENCAO;
		}
		if (this.visto[CLASSE_FAIXA] >= CAMERA_ATENCAO) {
			this.motivo = 'faixa_apagada';
			this.mensagemLcd = `Faixa apag. ${this.visto[CLASSE_FAIXA]}%`;
			return ATENCAO;
		}
		if (tempoEscuro > 0) {
			this.motivo = 'luz_fraca';
			this.mensagemLcd = `Luz fraca ${Math.floor(tempoEscuro / 1000)}s`;
			return ATENCAO;
		}

		this.motivo = 'via_ok';
		this.mensagemLcd = `${this.impacto.toFixed(2)}g Luz ${this.luz.toFixed(0)}%`;
		return NORMAL;
	}

	// Só troca de estado após 3 leituras seguidas iguais (evita oscilação)
	confirmarEstado(novoEstado: number): void {
		if (novoEstado === this.estadoAtual) {
			this.contadorConfirmacao = 0;
			return;
		}

		if (novoEstado === this.estadoCandidato) {
			this.contadorConfirmacao++;
		} else {
			this.estadoCandidato = novoEstado;
			this.contadorConfirmacao = 1;
		}

		if (this.contadorConfirmacao >= LEITURAS_PARA_CONFIRMAR) {
			this.contadorConfirmacao = 0;
			this.mudarEstado(novoEstado);
		}
	}

	// Registra a troca de estado; no CRITICO tira foto para o pré-chamado
	mudarEstado(novoEstado: number): void {
		this.placa.Serial.println(
			`[ESTADO] ${NOMES_ESTADO[this.estadoAtual]} -> ${NOMES_ESTADO[novoEstado]} | motivo: ${this.motivo}`
		);
		this.estadoAtual = novoEstado;

		if (this.estadoAtual === CRITICO) {
			this.capturarFoto();
		}

		this.registrarEvento(EVENTOS_ESTADO[this.estadoAtual]);
	}

	// Pede a foto à ESP32-CAM, que desfoca rostos e placas antes de salvar.
	// O LED azul acende como flash e o nome da foto vai no evento
	capturarFoto(): void {
		this.totalFotos++;
		this.ultimaFoto = `foto_${this.totalFotos}`;
		this.fimFlash = this.placa.millis() + TEMPO_FLASH;
		if (!this.placa.emularCamera) {
			this.placa.Serial1.println(`FOTO ${this.ultimaFoto}`);
		}
		this.placa.Serial.println(
			`[CAMERA] ${this.ultimaFoto} capturada e anonimizada (rostos e placas desfocados)`
		);
	}

	// A ESP32-CAM roda a visão computacional e avisa cada detecção por UART, uma linha por vez:
	// "DET alagamento 87" (classe e confiança em %). Na bancada, a linha vem do Serial Monitor
	receberCamera(): void {
		const porta = this.placa.emularCamera ? this.placa.Serial : this.placa.Serial1;

		while (porta.available() > 0) {
			const letra = porta.read();
			if (letra === '\n') {
				this.tratarDeteccao(this.linhaCamera);
				this.linhaCamera = '';
			} else if (letra !== '\r' && this.linhaCamera.length < 40) {
				this.linhaCamera += letra;
			}
		}

		// Sem detecção nova por 3 s: a câmera não vê mais aquele problema
		for (let i = 0; i < TOTAL_CLASSES; i++) {
			if (this.visto[i] > 0 && this.placa.millis() - this.ultimaDeteccao[i] > TEMPO_DETECCAO) {
				this.visto[i] = 0;
			}
		}
	}

	// Guarda a confiança (0 a 100%) da classe detectada; linhas desconhecidas são ignoradas
	tratarDeteccao(linha: string): void {
		const espaco = linha.lastIndexOf(' ');
		if (!linha.startsWith('DET ') || espaco <= 4) {
			return;
		}

		const classe = linha.substring(4, espaco);
		const confianca = limitar(Math.trunc(Number(linha.substring(espaco + 1))) || 0, 0, 100);
		for (let i = 0; i < TOTAL_CLASSES; i++) {
			if (classe === NOMES_CLASSE[i]) {
				this.visto[i] = confianca;
				this.ultimaDeteccao[i] = this.placa.millis();
			}
		}
	}

	// Chave liga/desliga (para cima = ligado). Desligado: apaga tudo e espera; ao religar, reinicia
	verificarChave(): void {
		const { placa } = this;
		const chaveLigada = placa.digitalRead(PINO_CHAVE) === HIGH;

		if (!chaveLigada && this.ligado) {
			this.ligado = false;
			placa.Serial.println('[ENERGIA] Dispositivo desligado');
			placa.mqtt.disconnect();
			placa.digitalWrite(PINO_LED_VERDE, LOW);
			placa.digitalWrite(PINO_LED_AMARELO, LOW);
			placa.digitalWrite(PINO_LED_VERMELHO, LOW);
			placa.digitalWrite(PINO_LED_CAMERA, LOW);
			placa.noTone(PINO_BUZZER);
			this.buzzerLigado = false;
			placa.lcd.clear();
			placa.lcd.noBacklight();
		}

		if (chaveLigada && !this.ligado) {
			placa.Serial.println('[ENERGIA] Dispositivo ligado');
			placa.ESP.restart();
		}
	}

	// Publica o evento ou guarda na fila se estiver sem rede
	registrarEvento(evento: string): void {
		const mensagem = this.montarMensagem(evento);

		if (this.estaOnline()) {
			this.publicar(mensagem);
		} else {
			this.guardarNaFila(mensagem);
		}
	}

	// Mensagem no formato UltraLight do FIWARE (chave|valor)
	montarMensagem(evento: string): string {
		let mensagem = `ev|${evento}`;
		mensagem += `|s|${NOMES_ESTADO[this.estadoAtual]}`;
		mensagem += `|m|${this.motivo}`;
		mensagem += `|i|${this.impacto.toFixed(2)}`;
		mensagem += `|a|${this.visto[CLASSE_ALAGAMENTO]}`;
		mensagem += `|vb|${this.visto[CLASSE_BURACO]}`;
		mensagem += `|vs|${this.visto[CLASSE_SEMAFORO]}`;
		mensagem += `|vf|${this.visto[CLASSE_FAIXA]}`;
		mensagem += `|l|${this.luz.toFixed(0)}`;
		mensagem += `|b|${this.bateria}`;
		mensagem += `|g|${this.giroscopio.toFixed(1)}`;
		mensagem += `|la|${this.latitude.toFixed(6)}`;
		mensagem += `|lo|${this.longitude.toFixed(6)}`;
		mensagem += `|v|${this.velocidade.toFixed(1)}`;
		mensagem += `|n|${this.inclinacao.toFixed(0)}`;
		mensagem += `|f|${this.ultimaFoto}`;
		mensagem += `|t|${Math.floor(this.placa.millis() / 1000)}`;
		return mensagem;
	}

	estaOnline(): boolean {
		return this.redeDisponivel && this.placa.mqtt.connected();
	}

	textoRede(): string {
		if (this.estaOnline()) {
			return 'online';
		}
		return 'offline';
	}

	publicar(mensagem: string): void {
		this.placa.mqtt.publish(TOPICO_DADOS, mensagem);
		this.placa.Serial.println(`[MQTT] ${mensagem}`);
	}

	// Fila cheia: descarta o evento mais antigo para guardar o novo
	guardarNaFila(mensagem: string): void {
		if (this.itensFila === TAMANHO_FILA) {
			for (let i = 1; i < TAMANHO_FILA; i++) {
				this.filaOffline[i - 1] = this.filaOffline[i];
			}
			this.itensFila--;
		}

		this.filaOffline[this.itensFila] = mensagem;
		this.itensFila++;
		this.placa.Serial.println(
			`[OFFLINE] Evento guardado na fila (${this.itensFila}/${TAMANHO_FILA})`
		);
	}

	// Envia a fila na ordem em que os eventos aconteceram
	enviarFila(): void {
		if (this.itensFila === 0) {
			return;
		}

		this.placa.Serial.println(`[OFFLINE] Enviando ${this.itensFila} evento(s) guardado(s)`);
		for (let i = 0; i < this.itensFila; i++) {
			this.publicar(this.filaOffline[i]);
		}
		this.itensFila = 0;
	}

	// Tenta conectar ao broker; ao conseguir, assina os comandos e esvazia a fila
	verificarConexao(): void {
		const { placa } = this;
		if (!this.redeDisponivel || placa.mqtt.connected()) {
			return;
		}

		if (placa.WiFi.status() !== WL_CONNECTED) {
			placa.Serial.println('[REDE] Aguardando Wi-Fi...');
			return;
		}

		placa.Serial.println('[MQTT] Conectando ao broker...');
		if (placa.mqtt.connect(this.idCliente)) {
			placa.mqtt.subscribe(TOPICO_COMANDO);
			placa.Serial.println(`[MQTT] Conectado. Publicando em ${TOPICO_DADOS}`);
			this.enviarFila();
		} else {
			placa.Serial.println(`[MQTT] Falha na conexao, codigo ${placa.mqtt.state()}`);
		}
	}

	// Comando remoto do FIWARE: "olhonavia001@foto|" tira uma foto
	receberComando(_topico: string, conteudo: Uint8Array, tamanho: number): void {
		let comando = '';
		for (let i = 0; i < tamanho; i++) {
			comando += String.fromCharCode(conteudo[i]);
		}
		this.placa.Serial.println(`[MQTT] Comando recebido: ${comando}`);

		if (comando.indexOf('@foto') >= 0) {
			this.capturarFoto();
			this.registrarEvento('foto_remota');
			const resposta = `${DISPOSITIVO}@foto|ok`;
			this.placa.mqtt.publish(TOPICO_RESPOSTA, resposta);
		}
	}

	// Montagem física: decodifica as sentenças NMEA que chegam do GPS.
	// No simulador não há o que decodificar: a Placa já entrega a posição do celular pronta.
	receberGps(): void {}

	// Atualiza posição e velocidade; sem sinal, a posição fica parada.
	// Na bancada, avança para o próximo ponto da rota emulada
	avancarGps(): void {
		if (!this.gpsComSinal) {
			this.velocidade = 0;
			return;
		}
		if (this.placa.emularGps) {
			this.pontoRota = (this.pontoRota + 1) % PONTOS_ROTA;
			this.latitude = ROTA_LATITUDE[this.pontoRota];
			this.longitude = ROTA_LONGITUDE[this.pontoRota];
			this.velocidade = VELOCIDADE_ROTA;
		} else {
			this.latitude = this.placa.moduloGps.location.lat();
			this.longitude = this.placa.moduloGps.location.lng();
			this.velocidade = this.placa.moduloGps.speed.kmph();
		}
	}

	// Resumo no Serial Monitor e envio periódico ao broker
	enviarTelemetria(): void {
		let linha = `[TELEMETRIA] estado=${NOMES_ESTADO[this.estadoAtual]}`;
		linha += ` impacto=${this.impacto.toFixed(2)}g`;
		linha += ` camera=buraco:${this.visto[CLASSE_BURACO]}%,alagamento:${this.visto[CLASSE_ALAGAMENTO]}%,semaforo:${this.visto[CLASSE_SEMAFORO]}%,faixa:${this.visto[CLASSE_FAIXA]}%`;
		linha += ` luz=${this.luz.toFixed(0)}%`;
		linha += ` bateria=${this.bateria}%`;
		linha += ` giro=${this.giroscopio.toFixed(1)}graus/s`;
		linha += ` incl=${this.inclinacao.toFixed(0)}graus`;
		linha += ` temp=${this.temperatura.toFixed(1)}C`;
		linha += ` gps=${this.latitude.toFixed(6)},${this.longitude.toFixed(6)}`;
		linha += ` vel=${this.velocidade.toFixed(1)}km/h`;
		linha += ` rede=${this.textoRede()}`;
		linha += ` fila=${this.itensFila}`;
		this.placa.Serial.println(linha);

		if (this.estaOnline()) {
			this.publicar(this.montarMensagem('telemetria'));
		}
	}

	// LED da cor do estado, amarelo piscando na FALHA e buzzer intermitente no CRITICO
	atualizarAlertas(): void {
		const { placa } = this;
		const piscar = Math.floor(placa.millis() / 500) % 2 === 0;
		const bipe = Math.floor(placa.millis() / 250) % 2 === 0;

		placa.digitalWrite(PINO_LED_VERDE, this.estadoAtual === NORMAL);
		placa.digitalWrite(
			PINO_LED_AMARELO,
			this.estadoAtual === ATENCAO || (this.estadoAtual === FALHA && piscar)
		);
		placa.digitalWrite(PINO_LED_VERMELHO, this.estadoAtual === CRITICO);
		placa.digitalWrite(PINO_LED_CAMERA, placa.millis() < this.fimFlash);

		const tocar = this.estadoAtual === CRITICO && bipe;
		if (tocar && !this.buzzerLigado) {
			placa.tone(PINO_BUZZER, 1000);
			this.buzzerLigado = true;
		}
		if (!tocar && this.buzzerLigado) {
			placa.noTone(PINO_BUZZER);
			this.buzzerLigado = false;
		}
	}

	// Linha 1: estado e rede (OFF + tamanho da fila). Linha 2: motivo e valor
	atualizarLcd(): void {
		let status = 'ONLINE';
		if (!this.estaOnline()) {
			status = `OFF F${this.itensFila}`;
		}
		this.escreverLinha(0, this.completar(NOMES_ESTADO[this.estadoAtual], 9) + status);

		if (this.estadoLido === this.estadoAtual) {
			this.escreverLinha(1, this.mensagemLcd);
		}
	}

	// Completa o texto com espaços para apagar o que sobrou da tela anterior
	completar(texto: string, tamanho: number): string {
		while (texto.length < tamanho) {
			texto += ' ';
		}
		return texto;
	}

	escreverLinha(linha: number, texto: string): void {
		this.placa.lcd.setCursor(0, linha);
		this.placa.lcd.print(this.completar(texto, 16));
	}
}
