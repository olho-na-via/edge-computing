// Acelerômetro e giroscópio do celular no papel do MPU-6050
// (DeviceMotionEvent para aceleração e giro, DeviceOrientationEvent para a inclinação).

import { AVISO_HTTPS, contextoSeguro, type EstadoSensor } from './tipos.ts';

const GRAUS_PARA_RAD = Math.PI / 180;
const TEMPO_SEM_DADOS = 2000;
const INTERVALO_PAINEL = 200;

/** No iOS, a permissão dos sensores de movimento é pedida por estas funções estáticas. */
interface ComPermissao {
	requestPermission?: () => Promise<'granted' | 'denied'>;
}

export interface LeituraMovimento {
	/** Aceleração com a gravidade, em g. */
	x: number;
	y: number;
	z: number;
	modulo: number;
	/** Giro em torno do eixo Z, em graus por segundo. */
	giro: number;
	/** Inclinação para a frente e para trás (-180 a 180 graus). */
	beta: number;
	/** Inclinação para os lados (-90 a 90 graus). */
	gamma: number;
}

class Movimento {
	estado = $state<EstadoSensor>('inativo');
	erro = $state('');
	/** Resumo para o painel, atualizado 5 vezes por segundo. */
	leitura = $state.raw<LeituraMovimento>({
		x: 0,
		y: 0,
		z: 1,
		modulo: 1,
		giro: 0,
		beta: 90,
		gamma: 0
	});

	// Última amostra, lida a cada volta do loop do firmware (não reativa de propósito: chega a 60 Hz)
	aceleracao = { x: 0, y: 0, z: 9.80665 }; // m/s²
	giro = { x: 0, y: 0, z: 0 }; // rad/s
	orientacao = { beta: 90, gamma: 0, valida: false };

	private recebeuDados = false;
	private temporizadores: ReturnType<typeof setTimeout>[] = [];
	// O Safari do iOS informa a aceleração com o sinal trocado em relação ao Android
	private sinal = 1;

	get suportado(): boolean {
		return typeof window !== 'undefined' && 'DeviceMotionEvent' in window;
	}

	/** Precisa ser chamado dentro de um toque: o iOS só mostra o pedido de permissão assim. */
	async ativar(): Promise<boolean> {
		if (!this.suportado) {
			this.estado = 'indisponivel';
			this.erro = contextoSeguro()
				? 'Este navegador não informa os sensores de movimento.'
				: AVISO_HTTPS;
			return false;
		}

		this.estado = 'pedindo';
		this.erro = '';
		try {
			const pedidos = [DeviceMotionEvent, DeviceOrientationEvent] as unknown as ComPermissao[];
			for (const tipo of pedidos) {
				if (typeof tipo?.requestPermission === 'function') {
					const resposta = await tipo.requestPermission();
					if (resposta !== 'granted') {
						this.estado = 'negado';
						this.erro = 'Permissão de movimento negada. Libere nas configurações do navegador.';
						return false;
					}
				}
			}
		} catch {
			this.estado = 'erro';
			this.erro = 'Não foi possível pedir a permissão de movimento.';
			return false;
		}

		const agente = navigator.userAgent;
		const ios =
			/iP(hone|ad|od)/.test(agente) || (/Macintosh/.test(agente) && navigator.maxTouchPoints > 1);
		this.sinal = ios ? -1 : 1;
		this.recebeuDados = false;
		this.encerrar();
		window.addEventListener('devicemotion', this.aoMover);
		window.addEventListener('deviceorientation', this.aoOrientar);
		this.estado = 'ativo';

		// Computadores têm a API, mas não têm o sensor: os eventos nunca chegam
		this.temporizadores.push(
			setTimeout(() => {
				if (this.recebeuDados || this.estado !== 'ativo') return;
				this.encerrar();
				this.estado = 'indisponivel';
				this.erro = 'Este aparelho não tem acelerômetro. Use o modo simulado.';
			}, TEMPO_SEM_DADOS),
			setInterval(() => this.atualizarPainel(), INTERVALO_PAINEL)
		);
		return true;
	}

	parar(): void {
		this.encerrar();
		this.estado = 'inativo';
		this.erro = '';
	}

	private aoMover = (evento: DeviceMotionEvent) => {
		const a = evento.accelerationIncludingGravity;
		if (a?.x == null || a.y == null || a.z == null) return;
		this.recebeuDados = true;
		this.aceleracao = { x: a.x * this.sinal, y: a.y * this.sinal, z: a.z * this.sinal };
		const r = evento.rotationRate;
		if (r) {
			this.giro = {
				x: (r.beta ?? 0) * GRAUS_PARA_RAD,
				y: (r.gamma ?? 0) * GRAUS_PARA_RAD,
				z: (r.alpha ?? 0) * GRAUS_PARA_RAD
			};
		}
	};

	private aoOrientar = (evento: DeviceOrientationEvent) => {
		if (evento.beta == null || evento.gamma == null) return;
		this.orientacao = { beta: evento.beta, gamma: evento.gamma, valida: true };
	};

	private atualizarPainel(): void {
		const g = 9.80665;
		const { x, y, z } = this.aceleracao;
		this.leitura = {
			x: x / g,
			y: y / g,
			z: z / g,
			modulo: Math.hypot(x, y, z) / g,
			giro: this.giro.z / GRAUS_PARA_RAD,
			beta: this.orientacao.beta,
			gamma: this.orientacao.gamma
		};
	}

	private encerrar(): void {
		if (typeof window === 'undefined') return;
		window.removeEventListener('devicemotion', this.aoMover);
		window.removeEventListener('deviceorientation', this.aoOrientar);
		// clearTimeout também cancela os intervalos
		this.temporizadores.forEach((t) => clearTimeout(t));
		this.temporizadores = [];
		this.orientacao = { beta: 90, gamma: 0, valida: false };
	}
}

export const movimento = new Movimento();
