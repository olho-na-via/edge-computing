// Placa ESP32 emulada.
// Recebe as grandezas físicas (do celular ou dos controles do painel) e as entrega ao firmware
// como os sinais elétricos do circuito: contagens do ADC, níveis dos pinos e linhas da UART da
// câmera. O que o firmware escreve (pinos, LCD, Serial, MQTT) fica guardado aqui.

export const HIGH = 1;
export const LOW = 0;
export const WL_CONNECTED = 3;
export const WL_DISCONNECTED = 6;
export const GRAVIDADE = 9.80665;

export const PINO_LDR = 34;
export const PINO_BATERIA = 35;
export const PINO_GPS = 32;
export const PINO_REDE = 33;
export const PINO_CHAVE = 25;
export const PINO_LED_VERDE = 19;
export const PINO_LED_AMARELO = 18;
export const PINO_LED_VERMELHO = 5;
export const PINO_LED_CAMERA = 17;
export const PINO_BUZZER = 16;

/** Classes que a visão computacional da câmera detecta, na ordem usada pelo firmware. */
export const CLASSES_CAMERA = [
	'buraco',
	'alagamento',
	'semaforo_apagado',
	'faixa_apagada'
] as const;

/** De quanto em quanto tempo a câmera repete a detecção enquanto vê o problema, em ms. */
const INTERVALO_DETECCAO = 500;

export interface Vetor {
	x: number;
	y: number;
	z: number;
}

/** O que os componentes do circuito estão "sentindo" neste instante. */
export interface Grandezas {
	/** Chave liga/desliga (pino 25): para cima = ligado. */
	chave: boolean;
	/** MPU-6050 respondendo no barramento I2C. */
	imuConectado: boolean;
	/** Aceleração com a gravidade, em m/s². */
	aceleracao: Vetor;
	/** Velocidade angular, em rad/s. */
	giro: Vetor;
	/** Temperatura do MPU-6050, em °C. */
	temperatura: number;
	/** Confiança (0 a 100%) com que a câmera vê cada classe de CLASSES_CAMERA. 0 = não vê. */
	camera: number[];
	/** Luz no LDR, de 0 a 100%. */
	luz: number;
	/** Carga da bateria, de 0 a 100%. */
	bateria: number;
	/** Sinal de GPS (na bancada, a chave do pino 32). */
	gpsSinal: boolean;
	latitude: number;
	longitude: number;
	/** Velocidade informada pelo GPS, em km/h. */
	velocidade: number;
	/** Cobertura de rede (na bancada, a chave do pino 33). */
	rede: boolean;
}

export function grandezasIniciais(): Grandezas {
	return {
		chave: true,
		imuConectado: true,
		aceleracao: { x: 0, y: 0, z: GRAVIDADE },
		giro: { x: 0, y: 0, z: 0 },
		temperatura: 26.5,
		camera: [0, 0, 0, 0],
		luz: 76,
		bateria: 88,
		gpsSinal: true,
		latitude: -23.555771,
		longitude: -46.66231,
		velocidade: 0,
		rede: true
	};
}

/** Para onde vai o que sai da placa. */
export interface Saidas {
	serial(linha: string): void;
	publicar(topico: string, mensagem: string): void;
	foto(nome: string): void;
}

type RetornoMqtt = (topico: string, conteudo: Uint8Array, tamanho: number) => void;

export class Placa {
	grandezas = grandezasIniciais();

	/** Equivalem ao EMULAR_PERIFERICOS do sketch.ino, um para cada periférico. */
	emularGps = true;
	emularCamera = true;

	/** Tempo desde a energização, em ms. Quem avança é o simulador. */
	tempo = 0;

	/** Último nível escrito em cada pino de saída. */
	readonly pinos = new Map<number, number>();
	/** Frequência do tone() no buzzer; 0 = em silêncio. */
	frequenciaBuzzer = 0;
	/** As duas linhas de 16 caracteres do LCD. */
	readonly telaLcd: [string, string] = [' '.repeat(16), ' '.repeat(16)];
	luzDeFundo = false;
	/** O firmware chamou ESP.restart(). */
	reinicioPedido = false;

	private readonly saidas: Saidas;
	private cursor = { coluna: 0, linha: 0 };
	private inicioWifi = -1;
	private mqttConectado = false;
	private retornoMqtt: RetornoMqtt | null = null;
	private readonly comandosRecebidos: { topico: string; conteudo: string }[] = [];
	private readonly topicosAssinados = new Set<string>();
	/** Caracteres que a câmera já enviou e o firmware ainda não leu. */
	private filaCamera = '';
	private ultimaDeteccao = -INTERVALO_DETECCAO;

	constructor(saidas: Saidas) {
		this.saidas = saidas;
	}

	// ---------- tempo e pinos ----------

	millis(): number {
		return Math.floor(this.tempo);
	}

	digitalRead(pino: number): number {
		const g = this.grandezas;
		// As chaves ligam o pino ao GND; para cima, o pull-up interno mantém HIGH
		if (pino === PINO_GPS) return g.gpsSinal ? HIGH : LOW;
		if (pino === PINO_REDE) return g.rede ? HIGH : LOW;
		if (pino === PINO_CHAVE) return g.chave ? HIGH : LOW;
		return this.pinos.get(pino) ?? LOW;
	}

	/** ADC de 12 bits: 0 a 4095. */
	analogRead(pino: number): number {
		const g = this.grandezas;
		// Módulo LDR: quanto mais luz, menor a tensão na saída AO
		if (pino === PINO_LDR) return Math.round(((100 - limitar(g.luz, 0, 100)) / 100) * 4095);
		if (pino === PINO_BATERIA) return Math.ceil((limitar(g.bateria, 0, 100) / 100) * 4095);
		return 0;
	}

	digitalWrite(pino: number, nivel: number | boolean): void {
		this.pinos.set(pino, nivel ? HIGH : LOW);
	}

	tone(pino: number, frequencia: number): void {
		if (pino === PINO_BUZZER) this.frequenciaBuzzer = frequencia;
	}

	noTone(pino: number): void {
		if (pino === PINO_BUZZER) this.frequenciaBuzzer = 0;
	}

	readonly ESP = {
		restart: () => {
			this.reinicioPedido = true;
		}
	};

	// ---------- UARTs ----------

	/**
	 * Entrada da UART da câmera. A ESP32-CAM roda a visão computacional e envia uma linha por
	 * detecção ("DET alagamento 87"), repetida enquanto o problema estiver na imagem.
	 */
	private cameraDisponivel(): number {
		if (this.tempo - this.ultimaDeteccao >= INTERVALO_DETECCAO) {
			this.ultimaDeteccao = this.tempo;
			CLASSES_CAMERA.forEach((classe, indice) => {
				const confianca = Math.round(limitar(this.grandezas.camera[indice] ?? 0, 0, 100));
				if (confianca > 0) this.filaCamera += `DET ${classe} ${confianca}\n`;
			});
		}
		return this.filaCamera.length;
	}

	private cameraLer(): string {
		const letra = this.filaCamera[0] ?? '';
		this.filaCamera = this.filaCamera.slice(1);
		return letra;
	}

	/** Serial Monitor. Na bancada (EMULAR_PERIFERICOS 1), as detecções da câmera chegam por aqui. */
	readonly Serial = {
		println: (linha: string) => this.saidas.serial(linha),
		available: () => this.cameraDisponivel(),
		read: () => this.cameraLer()
	};

	/** UART da ESP32-CAM: o comando "FOTO nome" dispara a captura; as detecções voltam por ela. */
	readonly Serial1 = {
		println: (linha: string) => {
			if (linha.startsWith('FOTO ')) this.saidas.foto(linha.slice(5));
		},
		available: () => this.cameraDisponivel(),
		read: () => this.cameraLer()
	};

	// ---------- MPU-6050 (Adafruit_MPU6050) ----------

	readonly acelerometro = {
		begin: () => this.grandezas.imuConectado,
		getEvent: () => {
			const g = this.grandezas;
			// Sensor solto com a placa ligada: o barramento devolve lixo, que o firmware descarta
			const aceleracao = g.imuConectado ? g.aceleracao : { x: NaN, y: NaN, z: NaN };
			return {
				aceleracao: { acceleration: aceleracao },
				giro: { gyro: g.giro },
				temp: { temperature: g.temperatura }
			};
		}
	};

	// ---------- LCD 16x2 I2C (LiquidCrystal_I2C) ----------

	readonly lcd = {
		init: () => {
			this.limparLcd();
		},
		clear: () => {
			this.limparLcd();
		},
		backlight: () => {
			this.luzDeFundo = true;
		},
		noBacklight: () => {
			this.luzDeFundo = false;
		},
		setCursor: (coluna: number, linha: number) => {
			this.cursor = { coluna, linha: linha === 1 ? 1 : 0 };
		},
		print: (texto: string) => {
			const { coluna, linha } = this.cursor;
			const atual = this.telaLcd[linha];
			const novo = (atual.slice(0, coluna) + texto + atual.slice(coluna + texto.length)).slice(
				0,
				16
			);
			this.telaLcd[linha] = novo.padEnd(16, ' ');
			this.cursor.coluna = Math.min(coluna + texto.length, 16);
		}
	};

	private limparLcd(): void {
		this.telaLcd[0] = ' '.repeat(16);
		this.telaLcd[1] = ' '.repeat(16);
	}

	// ---------- GPS (TinyGPSPlus), usado quando emularGps = false ----------

	readonly moduloGps = {
		location: {
			isValid: () => this.grandezas.gpsSinal,
			// Com sinal, o módulo entrega uma posição nova por segundo, mesmo parado
			age: () => (this.grandezas.gpsSinal ? 0 : Number.MAX_SAFE_INTEGER),
			lat: () => this.grandezas.latitude,
			lng: () => this.grandezas.longitude
		},
		speed: {
			kmph: () => this.grandezas.velocidade
		}
	};

	// ---------- Wi-Fi e MQTT (WiFi.h e PubSubClient) ----------

	readonly WiFi = {
		begin: () => {
			this.inicioWifi = this.tempo;
		},
		// A associação com o ponto de acesso leva cerca de 1,5 s
		status: () =>
			this.inicioWifi >= 0 && this.tempo - this.inicioWifi > 1500 ? WL_CONNECTED : WL_DISCONNECTED
	};

	readonly mqtt = {
		setCallback: (retorno: RetornoMqtt) => {
			this.retornoMqtt = retorno;
		},
		connected: () => this.mqttConectado,
		connect: (idCliente: string) => {
			this.mqttConectado = idCliente.length > 0 && this.WiFi.status() === WL_CONNECTED;
			return this.mqttConectado;
		},
		disconnect: () => {
			this.mqttConectado = false;
			this.topicosAssinados.clear();
		},
		// -2 = MQTT_CONNECT_FAILED, 0 = MQTT_CONNECTED
		state: () => (this.mqttConectado ? 0 : -2),
		subscribe: (topico: string) => {
			this.topicosAssinados.add(topico);
		},
		publish: (topico: string, mensagem: string) => {
			if (!this.mqttConectado) return false;
			this.saidas.publicar(topico, mensagem);
			return true;
		},
		// Entrega ao firmware os comandos que chegaram do broker
		loop: () => {
			while (this.comandosRecebidos.length > 0) {
				const { topico, conteudo } = this.comandosRecebidos.shift()!;
				const bytes = new TextEncoder().encode(conteudo);
				this.retornoMqtt?.(topico, bytes, bytes.length);
			}
		}
	};

	/**
	 * Comando vindo do broker (FIWARE). Só chega se o dispositivo estiver conectado e com o
	 * tópico assinado; devolve se foi entregue.
	 */
	receberDoBroker(topico: string, conteudo: string): boolean {
		if (!this.mqttConectado || !this.topicosAssinados.has(topico)) return false;
		this.comandosRecebidos.push({ topico, conteudo });
		return true;
	}
}

export function limitar(valor: number, minimo: number, maximo: number): number {
	return Math.min(Math.max(valor, minimo), maximo);
}
