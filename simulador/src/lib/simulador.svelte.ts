// Estado central do simulador: liga a Placa emulada ao firmware, alimenta os sensores com as
// leituras do celular ou com os valores do painel, e publica as saídas (LEDs, LCD, buzzer,
// Serial, MQTT e fotos) de forma reativa para a interface.

import {
	DISPOSITIVO,
	Firmware,
	NOMES_ESTADO,
	TAMANHO_FILA,
	TOPICO_COMANDO,
	type NomeEstado
} from './firmware/firmware.ts';
import {
	GRAVIDADE,
	HIGH,
	PINO_LED_AMARELO,
	PINO_LED_CAMERA,
	PINO_LED_VERDE,
	PINO_LED_VERMELHO,
	CLASSES_CAMERA,
	Placa,
	type Grandezas
} from './firmware/placa.ts';
import { camera } from './sensores/camera.svelte.ts';
import { bateria, rede } from './sensores/energia.svelte.ts';
import { gps } from './sensores/gps.svelte.ts';
import { movimento } from './sensores/movimento.svelte.ts';
import { visao } from './visao/visao.svelte.ts';

/** Cada entrada do circuito que pode vir do celular ou do painel. */
export type Canal = 'camera' | 'visao' | 'movimento' | 'gps' | 'luz' | 'bateria' | 'rede';
export type Fonte = 'celular' | 'simulado';

export interface Leds {
	verde: boolean;
	amarelo: boolean;
	vermelho: boolean;
	azul: boolean;
}

export interface LinhaSerial {
	id: number;
	/** millis() do firmware quando a linha foi escrita. */
	tempo: number;
	/** Texto entre colchetes no começo da linha: ESTADO, MQTT, CAMERA... */
	etiqueta: string;
	texto: string;
}

export interface MensagemMqtt {
	id: number;
	tempo: number;
	/** Quantas vezes o dispositivo foi ligado até esta mensagem (a numeração das fotos recomeça a cada partida). */
	partida: number;
	topico: string;
	conteudo: string;
	/** Pares chave|valor do formato UltraLight. */
	campos: Record<string, string>;
}

export interface Foto {
	nome: string;
	/** Partida do dispositivo em que a foto foi tirada. */
	partida: number;
	tempo: number;
	/** JPEG em data URL. Fica só na memória desta aba. */
	url: string;
	latitude: number;
	longitude: number;
}

export interface Telemetria {
	tempo: number;
	estado: NomeEstado;
	/** Estado que as últimas leituras indicam, antes das 3 confirmações. */
	estadoLido: NomeEstado;
	motivo: string;
	impacto: number;
	/** Confiança (%) de cada classe vista pela câmera, na ordem de CLASSES_CAMERA. */
	visto: number[];
	luz: number;
	bateria: number;
	giroscopio: number;
	inclinacao: number;
	temperatura: number;
	latitude: number;
	longitude: number;
	velocidade: number;
	gpsComSinal: boolean;
	online: boolean;
	fila: string[];
	totalFotos: number;
}

/** Valores dos controles do painel, usados quando a fonte é "simulado". */
export interface Ajustes {
	/** Impacto mantido, em g (como o accelZ do MPU-6050 no Wokwi). */
	impacto: number;
	imuConectado: boolean;
	/** Confiança (0 a 100%) com que a visão computacional da câmera vê cada problema. */
	alagamento: number;
	buracoVisto: number;
	semaforoVisto: number;
	faixaVista: number;
	/** Luz no LDR, em %. */
	luz: number;
	/** Carga da bateria, em %. */
	bateria: number;
	gpsSinal: boolean;
	rede: boolean;
}

const AJUSTES_PADRAO: Ajustes = {
	impacto: 0,
	imuConectado: true,
	alagamento: 0,
	buracoVisto: 0,
	semaforoVisto: 0,
	faixaVista: 0,
	luz: 76,
	bateria: 88,
	gpsSinal: true,
	rede: true
};

export interface Cenario {
	id: string;
	nome: string;
	/** O que o firmware deve fazer neste cenário. */
	esperado: string;
	ajustes?: Partial<Ajustes>;
	/** Canais que passam para o modo simulado, para o cenário ter efeito. */
	canais?: Canal[];
	/** Solavanco de 0,8 s em vez de um valor mantido. */
	pulso?: boolean;
}

export const CENARIOS: Cenario[] = [
	{ id: 'normal', nome: 'Via normal', esperado: 'NORMAL, LED verde' },
	{
		id: 'buraco',
		nome: 'Buraco (impacto)',
		esperado: 'CRÍTICO por um instante: foto, buzzer e pré-chamado',
		canais: ['movimento'],
		pulso: true
	},
	{
		id: 'irregular',
		nome: 'Via irregular',
		esperado: 'ATENÇÃO: impacto entre 0,4 g e 1,0 g',
		ajustes: { impacto: 0.6 },
		canais: ['movimento']
	},
	{
		id: 'agua',
		nome: 'Água na via',
		esperado: 'ATENÇÃO: a câmera vê água com 30% a 50% de confiança',
		ajustes: { alagamento: 40 },
		canais: ['visao']
	},
	{
		id: 'alagamento',
		nome: 'Alagamento',
		esperado: 'CRÍTICO: a câmera vê alagamento com 50% ou mais de confiança',
		ajustes: { alagamento: 90 },
		canais: ['visao']
	},
	{
		id: 'buraco-camera',
		nome: 'Buraco à frente',
		esperado: 'CRÍTICO: a câmera vê um buraco com 50% ou mais de confiança',
		ajustes: { buracoVisto: 65 },
		canais: ['visao']
	},
	{
		id: 'faixa',
		nome: 'Faixa apagada',
		esperado: 'ATENÇÃO: a câmera vê a faixa de pedestre apagada',
		ajustes: { faixaVista: 60 },
		canais: ['visao']
	},
	{
		id: 'semaforo',
		nome: 'Semáforo apagado',
		esperado: 'ATENÇÃO (luz fraca) e, após 10 s no escuro, CRÍTICO',
		ajustes: { luz: 8 },
		canais: ['luz']
	},
	{
		id: 'bateria',
		nome: 'Bateria baixa',
		esperado: 'FALHA: bateria abaixo de 15%',
		ajustes: { bateria: 9 },
		canais: ['bateria']
	},
	{
		id: 'gps',
		nome: 'GPS sem sinal',
		esperado: 'FALHA: LED amarelo piscando',
		ajustes: { gpsSinal: false },
		canais: ['gps']
	},
	{
		id: 'rede',
		nome: 'Sem rede',
		esperado: 'Eventos vão para a fila offline (até 10)',
		ajustes: { rede: false },
		canais: ['rede']
	}
];

// Solavanco do cenário "Buraco": 1,6 g por 0,8 s passa de 1,0 g na média móvel por 3 leituras
const IMPACTO_PULSO = 1.6;
const DURACAO_PULSO = 800;
const INTERVALO_LOOP = 10;
const INTERVALO_TELEMETRIA = 100;
const LIMITE_SERIAL = 300;
const LIMITE_MENSAGENS = 60;
const LIMITE_FOTOS = 12;

const TELEMETRIA_INICIAL: Telemetria = {
	tempo: 0,
	estado: 'NORMAL',
	estadoLido: 'NORMAL',
	motivo: 'via_ok',
	impacto: 0,
	visto: [0, 0, 0, 0],
	luz: 0,
	bateria: 0,
	giroscopio: 0,
	inclinacao: 0,
	temperatura: 0,
	latitude: 0,
	longitude: 0,
	velocidade: 0,
	gpsComSinal: false,
	online: false,
	fila: [],
	totalFotos: 0
};

/** Buzzer passivo: onda quadrada na frequência do tone(). */
class Som {
	private contexto: AudioContext | null = null;
	private oscilador: OscillatorNode | null = null;
	private ganho: GainNode | null = null;

	/** Chamado dentro de um toque: o navegador só libera áudio depois de uma interação. */
	preparar(): void {
		if (typeof AudioContext === 'undefined') return;
		if (!this.contexto) {
			this.contexto = new AudioContext();
			this.oscilador = this.contexto.createOscillator();
			this.oscilador.type = 'square';
			this.ganho = this.contexto.createGain();
			this.ganho.gain.value = 0;
			this.oscilador.connect(this.ganho).connect(this.contexto.destination);
			this.oscilador.start();
		}
		void this.contexto.resume();
	}

	tocar(frequencia: number): void {
		if (!this.contexto || !this.oscilador || !this.ganho) return;
		this.oscilador.frequency.value = frequencia;
		this.ganho.gain.setTargetAtTime(0.04, this.contexto.currentTime, 0.004);
	}

	parar(): void {
		if (!this.contexto || !this.ganho) return;
		this.ganho.gain.setTargetAtTime(0, this.contexto.currentTime, 0.004);
	}
}

class Simulador {
	/** Dispositivo energizado (firmware rodando). */
	ligado = $state(false);
	pausado = $state(false);
	som = $state(true);

	fontes = $state<Record<Canal, Fonte>>({
		camera: 'simulado',
		movimento: 'simulado',
		gps: 'simulado',
		luz: 'simulado',
		bateria: 'simulado',
		rede: 'simulado',
		// Detecção pela imagem: "celular" = modelo de visão rodando sobre a câmera
		visao: 'simulado'
	});
	ajustes = $state<Ajustes>({ ...AJUSTES_PADRAO });
	/** Cenário de teste selecionado; null depois de qualquer ajuste manual. */
	cenario = $state<string | null>('normal');

	// Saídas do firmware
	leds = $state.raw<Leds>({ verde: false, amarelo: false, vermelho: false, azul: false });
	lcd = $state.raw<[string, string]>(['', '']);
	buzzer = $state(false);
	telemetria = $state.raw<Telemetria>(TELEMETRIA_INICIAL);
	serial = $state.raw<LinhaSerial[]>([]);
	mensagens = $state.raw<MensagemMqtt[]>([]);
	fotos = $state.raw<Foto[]>([]);
	/** Recado curto para a interface (comando não entregue, sensor que caiu...). */
	aviso = $state('');

	private placa: Placa | null = null;
	private firmware: Firmware | null = null;
	private temporizador: ReturnType<typeof setInterval> | undefined;
	private ultimoPasso = 0;
	private ultimaTelemetria = 0;
	private fimPulso = 0;
	private proximoId = 1;
	private partida = 0;
	private readonly alto = new Som();
	private trava: { release(): Promise<void> } | null = null;

	/** Confiança (%) de cada classe que a câmera "vê": do modelo de visão ou dos controles do painel. */
	get vistoPelaCamera(): number[] {
		if (this.fontes.visao === 'celular') {
			return CLASSES_CAMERA.map((classe) => visao.confiancas[classe] ?? 0);
		}
		const a = this.ajustes;
		return [a.buracoVisto, a.alagamento, a.semaforoVisto, a.faixaVista];
	}

	get estado(): NomeEstado {
		return this.telemetria.estado;
	}

	// ---------- energia ----------

	/** Chave para cima: energiza a placa e roda o setup(). Deve ser chamado dentro de um toque (áudio). */
	ligar(): void {
		if (this.ligado) return;
		this.alto.preparar();
		this.placa = new Placa({
			serial: (linha) => this.escreverSerial(linha),
			publicar: (topico, mensagem) => this.guardarMensagem(topico, mensagem),
			foto: (nome) => this.fotografar(nome)
		});
		this.firmware = new Firmware(this.placa);
		this.partida++;
		this.lerGrandezas(this.placa.grandezas);
		this.firmware.setup();
		this.fimPulso = 0;
		this.ultimaTelemetria = 0;
		this.ultimoPasso = performance.now();
		this.ligado = true;
		this.pausado = false;
		this.sincronizar(true);
		this.temporizador = setInterval(this.passo, INTERVALO_LOOP);
		void this.manterTelaAcesa();
	}

	/** Chave para baixo: o firmware apaga os atuadores e para. */
	desligar(): void {
		clearInterval(this.temporizador);
		if (this.placa && this.firmware) {
			// Uma última volta do loop com a chave desligada, para o firmware se despedir no Serial
			this.placa.grandezas.chave = false;
			this.firmware.loop();
		}
		this.placa = null;
		this.firmware = null;
		this.ligado = false;
		this.pausado = false;
		this.leds = { verde: false, amarelo: false, vermelho: false, azul: false };
		this.lcd = ['', ''];
		this.buzzer = false;
		this.alto.parar();
		this.telemetria = TELEMETRIA_INICIAL;
		void this.trava?.release().catch(() => {});
		this.trava = null;
	}

	/** Equivale ao botão EN (reset) do ESP32. */
	reiniciar(): void {
		this.desligar();
		this.serial = [];
		this.mensagens = [];
		this.fotos = [];
		this.ligar();
	}

	alternarPausa(): void {
		if (!this.ligado) return;
		this.pausado = !this.pausado;
		if (this.pausado) this.alto.parar();
		this.ultimoPasso = performance.now();
	}

	alternarSom(): void {
		this.som = !this.som;
		if (!this.som) this.alto.parar();
		else if (this.buzzer && !this.pausado) this.alto.tocar(this.placa?.frequenciaBuzzer || 1000);
	}

	// ---------- entradas ----------

	/**
	 * Troca a origem de um canal. Para "celular", pede a permissão ao navegador; se ela for
	 * negada ou o sensor não existir, o canal continua simulado e o motivo fica no módulo do sensor.
	 */
	async definirFonte(canal: Canal, fonte: Fonte): Promise<boolean> {
		if (fonte === 'simulado') {
			this.fontes[canal] = 'simulado';
			if (canal === 'camera') {
				camera.parar();
				visao.parar();
				this.fontes.visao = 'simulado';
				this.fontes.luz = 'simulado';
			}
			if (canal === 'movimento') movimento.parar();
			if (canal === 'gps') gps.parar();
			if (canal === 'bateria') bateria.parar();
			if (canal === 'rede') rede.parar();
			if (canal === 'visao') visao.parar();
			return true;
		}

		let ok = false;
		if (canal === 'camera') ok = await camera.ativar();
		// O LDR do simulador é a luminância da câmera: sem câmera, não há luz "real"
		if (canal === 'luz')
			ok = camera.estado === 'ativo' || (await this.definirFonte('camera', 'celular'));
		if (canal === 'movimento') ok = await movimento.ativar();
		if (canal === 'gps') ok = await gps.ativar();
		if (canal === 'bateria') ok = await bateria.ativar();
		if (canal === 'rede') ok = await rede.ativar();
		if (canal === 'visao') {
			// O modelo analisa a imagem da câmera: liga a câmera antes, se for preciso
			if (camera.estado !== 'ativo') {
				const comCamera = await camera.ativar();
				this.fontes.camera = comCamera ? 'celular' : 'simulado';
				if (comCamera) this.fontes.luz = 'celular';
			}
			ok = camera.estado === 'ativo' && (await visao.ativar());
		}

		this.fontes[canal] = ok ? 'celular' : 'simulado';
		if (canal === 'camera' && ok) {
			this.fontes.luz = 'celular';
			// Com a câmera ligada, a IA passa a procurar problemas na imagem (o modelo baixa em segundo plano)
			void this.definirFonte('visao', 'celular');
		}
		if (ok) this.cenario = null;
		return ok;
	}

	/** Liga todos os sensores do celular de uma vez. Devolve os canais que não puderam ser ligados. */
	async usarCelular(): Promise<Canal[]> {
		// Movimento primeiro: no iOS, o pedido de permissão precisa vir logo após o toque
		const canais: Canal[] = ['movimento', 'camera', 'gps', 'bateria', 'rede'];
		const falharam: Canal[] = [];
		for (const canal of canais) {
			if (!(await this.definirFonte(canal, 'celular'))) falharam.push(canal);
		}
		return falharam;
	}

	usarSimulado(): void {
		for (const canal of Object.keys(this.fontes) as Canal[])
			void this.definirFonte(canal, 'simulado');
	}

	/** Muda um controle do painel. */
	ajustar<Chave extends keyof Ajustes>(chave: Chave, valor: Ajustes[Chave]): void {
		this.ajustes[chave] = valor;
		this.cenario = null;
	}

	aplicarCenario(id: string): void {
		const cenario = CENARIOS.find((c) => c.id === id);
		if (!cenario) return;
		for (const canal of cenario.canais ?? []) void this.definirFonte(canal, 'simulado');
		this.ajustes = { ...AJUSTES_PADRAO, ...cenario.ajustes };
		this.cenario = id;
		if (cenario.pulso) this.passarEmBuraco();
	}

	/** Solavanco curto no acelerômetro simulado, como a roda caindo num buraco. */
	passarEmBuraco(): void {
		if (!this.placa) return;
		if (this.fontes.movimento !== 'simulado') void this.definirFonte('movimento', 'simulado');
		this.fimPulso = this.placa.tempo + DURACAO_PULSO;
	}

	/** Chave liga/desliga do dispositivo (no modelo 3D, no circuito e na faixa de atuadores). */
	alternarEnergia(): void {
		if (this.ligado) this.desligar();
		else this.ligar();
	}

	/** Comando remoto do FIWARE pedindo uma foto. Sem conexão, o broker não consegue entregar. */
	pedirFotoRemota(): void {
		const entregue = this.placa?.receberDoBroker(TOPICO_COMANDO, `${DISPOSITIVO}@foto|`) ?? false;
		this.avisar(
			entregue
				? 'Comando @foto enviado ao dispositivo.'
				: 'Dispositivo sem conexão com o broker: o comando não foi entregue.'
		);
	}

	limparSerial(): void {
		this.serial = [];
	}

	avisar(texto: string): void {
		this.aviso = texto;
		const atual = texto;
		setTimeout(() => {
			if (this.aviso === atual) this.aviso = '';
		}, 4000);
	}

	// ---------- laço principal ----------

	private passo = () => {
		const agora = performance.now();
		// Aba em segundo plano: o navegador segura os temporizadores. Limita o salto de tempo
		// para o firmware não "pular" 30 s de uma vez ao voltar.
		const delta = Math.min(agora - this.ultimoPasso, 1000);
		this.ultimoPasso = agora;
		if (this.pausado || !this.placa || !this.firmware) return;

		this.placa.tempo += delta;
		this.conferirFontes();
		this.lerGrandezas(this.placa.grandezas);
		this.firmware.loop();
		this.sincronizar(false);
	};

	/** Sensor do celular que parou de responder volta para o modo simulado. */
	private conferirFontes(): void {
		const situacoes: Record<Canal, string> = {
			camera: camera.estado,
			luz: camera.estado,
			movimento: movimento.estado,
			gps: gps.estado,
			bateria: bateria.estado,
			rede: rede.estado,
			visao: visao.estado
		};
		for (const canal of Object.keys(situacoes) as Canal[]) {
			const situacao = situacoes[canal];
			if (this.fontes[canal] === 'celular' && situacao !== 'ativo' && situacao !== 'pedindo') {
				this.fontes[canal] = 'simulado';
			}
		}
	}

	/** Monta o que cada sensor do circuito está sentindo neste instante. */
	private lerGrandezas(g: Grandezas): void {
		const { fontes, ajustes } = this;
		const placa = this.placa!;

		if (fontes.movimento === 'celular') {
			g.imuConectado = true;
			g.aceleracao = movimento.aceleracao;
			g.giro = movimento.giro;
		} else {
			// Parado sobre a mesa: 1 g no eixo Z, mais o ruído normal do sensor
			const pulso = placa.tempo < this.fimPulso ? IMPACTO_PULSO : 0;
			const ruido = (Math.random() - 0.5) * 0.03;
			g.imuConectado = ajustes.imuConectado;
			g.aceleracao = { x: 0, y: 0, z: (1 + ajustes.impacto + pulso + ruido) * GRAVIDADE };
			g.giro = { x: 0, y: 0, z: 0 };
		}

		g.camera = this.vistoPelaCamera;
		g.luz = fontes.luz === 'celular' ? camera.luminancia : ajustes.luz;
		g.bateria = fontes.bateria === 'celular' ? bateria.nivel : ajustes.bateria;

		placa.emularGps = fontes.gps !== 'celular';
		if (placa.emularGps) {
			g.gpsSinal = ajustes.gpsSinal;
		} else {
			g.gpsSinal = gps.sinal;
			g.latitude = gps.latitude;
			g.longitude = gps.longitude;
			g.velocidade = gps.velocidade;
		}

		g.rede = fontes.rede === 'celular' ? rede.conectada : ajustes.rede;
		g.chave = true;
		placa.emularCamera = fontes.camera !== 'celular';
	}

	/** Copia para a interface o que o firmware escreveu, só quando mudou. */
	private sincronizar(forcar: boolean): void {
		const placa = this.placa!;
		const firmware = this.firmware!;

		const leds: Leds = {
			verde: placa.pinos.get(PINO_LED_VERDE) === HIGH,
			amarelo: placa.pinos.get(PINO_LED_AMARELO) === HIGH,
			vermelho: placa.pinos.get(PINO_LED_VERMELHO) === HIGH,
			azul: placa.pinos.get(PINO_LED_CAMERA) === HIGH
		};
		const atuais = this.leds;
		if (
			leds.verde !== atuais.verde ||
			leds.amarelo !== atuais.amarelo ||
			leds.vermelho !== atuais.vermelho ||
			leds.azul !== atuais.azul
		) {
			this.leds = leds;
		}

		const tocando = placa.frequenciaBuzzer > 0;
		if (tocando !== this.buzzer) {
			this.buzzer = tocando;
			if (tocando && this.som) this.alto.tocar(placa.frequenciaBuzzer);
			else this.alto.parar();
		}

		if (placa.telaLcd[0] !== this.lcd[0] || placa.telaLcd[1] !== this.lcd[1]) {
			this.lcd = [placa.telaLcd[0], placa.telaLcd[1]];
		}

		if (forcar || placa.tempo - this.ultimaTelemetria >= INTERVALO_TELEMETRIA) {
			this.ultimaTelemetria = placa.tempo;
			this.telemetria = {
				tempo: placa.millis(),
				estado: NOMES_ESTADO[firmware.estadoAtual],
				estadoLido: NOMES_ESTADO[firmware.estadoLido],
				motivo: firmware.motivo,
				impacto: firmware.impacto,
				visto: [...firmware.visto],
				luz: firmware.luz,
				bateria: firmware.bateria,
				giroscopio: firmware.giroscopio,
				inclinacao: firmware.inclinacao,
				temperatura: firmware.temperatura,
				latitude: firmware.latitude,
				longitude: firmware.longitude,
				velocidade: firmware.velocidade,
				gpsComSinal: firmware.gpsComSinal,
				online: firmware.estaOnline(),
				fila: firmware.filaOffline.slice(0, firmware.itensFila),
				totalFotos: firmware.totalFotos
			};
		}
	}

	// ---------- saídas da placa ----------

	private escreverSerial(texto: string): void {
		const etiqueta = /^\[([^\]]+)\]/.exec(texto)?.[1] ?? '';
		const linha = { id: this.proximoId++, tempo: this.placa?.millis() ?? 0, etiqueta, texto };
		this.serial = [...this.serial.slice(-(LIMITE_SERIAL - 1)), linha];
	}

	private guardarMensagem(topico: string, conteudo: string): void {
		const mensagem = {
			id: this.proximoId++,
			tempo: this.placa?.millis() ?? 0,
			partida: this.partida,
			topico,
			conteudo,
			campos: lerUltraLight(conteudo)
		};
		this.mensagens = [...this.mensagens.slice(-(LIMITE_MENSAGENS - 1)), mensagem];
	}

	/** Pedido de foto do firmware à ESP32-CAM: aqui, um quadro da câmera do celular. */
	private fotografar(nome: string): void {
		const url = camera.capturar();
		if (!url) return;
		const foto = {
			nome,
			partida: this.partida,
			tempo: this.placa?.millis() ?? 0,
			url,
			latitude: this.firmware?.latitude ?? 0,
			longitude: this.firmware?.longitude ?? 0
		};
		this.fotos = [...this.fotos.slice(-(LIMITE_FOTOS - 1)), foto];
	}

	/** Evita que a tela do celular apague durante o teste (Screen Wake Lock, quando existe). */
	private async manterTelaAcesa(): Promise<void> {
		try {
			const travas = (
				navigator as unknown as {
					wakeLock?: { request(tipo: 'screen'): Promise<{ release(): Promise<void> }> };
				}
			).wakeLock;
			this.trava = (await travas?.request('screen')) ?? null;
		} catch {
			this.trava = null;
		}
	}
}

/** "ev|pre_chamado|s|CRITICO|..." vira { ev: 'pre_chamado', s: 'CRITICO', ... }. */
export function lerUltraLight(conteudo: string): Record<string, string> {
	const partes = conteudo.split('|');
	const campos: Record<string, string> = {};
	for (let i = 0; i + 1 < partes.length; i += 2) campos[partes[i]] = partes[i + 1];
	return campos;
}

export { TAMANHO_FILA };
export const simulador = new Simulador();
