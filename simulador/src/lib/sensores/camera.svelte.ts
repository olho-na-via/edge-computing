// Câmera do celular no papel da OV2640 da ESP32-CAM (MediaDevices.getUserMedia).
// Além da foto, mede a luminância média do quadro, que alimenta o LDR do circuito.

import { AVISO_HTTPS, contextoSeguro, type EstadoSensor } from './tipos.ts';

// Um quadro com exposição automática tem luminância média perto de 45%. O ganho leva uma cena
// bem iluminada para perto de 75%, a leitura típica do LDR à luz do dia.
const GANHO_LUMINANCIA = 1.6;
const INTERVALO_LUMINANCIA = 250;

class Camera {
	estado = $state<EstadoSensor>('inativo');
	erro = $state('');
	/** Luz estimada pela imagem, de 0 a 100%. */
	luminancia = $state(0);
	/** true = câmera frontal (selfie); false = traseira, que olha para a via. */
	frontal = $state(false);
	fluxo = $state.raw<MediaStream | null>(null);

	private video: HTMLVideoElement | null = null;
	private amostra: HTMLCanvasElement | null = null;
	private temporizador: ReturnType<typeof setInterval> | undefined;

	get suportada(): boolean {
		return typeof navigator !== 'undefined' && Boolean(navigator.mediaDevices?.getUserMedia);
	}

	async ativar(): Promise<boolean> {
		if (!this.suportada) {
			this.estado = 'indisponivel';
			this.erro = contextoSeguro() ? 'Este navegador não dá acesso à câmera.' : AVISO_HTTPS;
			return false;
		}

		this.estado = 'pedindo';
		this.erro = '';
		try {
			const fluxo = await navigator.mediaDevices.getUserMedia({
				audio: false,
				video: {
					facingMode: { ideal: this.frontal ? 'user' : 'environment' },
					width: { ideal: 1280 },
					height: { ideal: 720 }
				}
			});
			this.encerrarFluxo();
			this.fluxo = fluxo;
			this.estado = 'ativo';
			clearInterval(this.temporizador);
			this.temporizador = setInterval(() => this.medirLuminancia(), INTERVALO_LUMINANCIA);
			return true;
		} catch (falha) {
			const nome = falha instanceof DOMException ? falha.name : '';
			if (nome === 'NotAllowedError' || nome === 'SecurityError') {
				this.estado = 'negado';
				this.erro = 'Permissão da câmera negada. Libere nas configurações do site.';
			} else if (nome === 'NotFoundError' || nome === 'OverconstrainedError') {
				this.estado = 'indisponivel';
				this.erro = 'Nenhuma câmera encontrada neste aparelho.';
			} else {
				this.estado = 'erro';
				this.erro = 'A câmera está em uso por outro aplicativo ou falhou ao abrir.';
			}
			return false;
		}
	}

	parar(): void {
		clearInterval(this.temporizador);
		this.encerrarFluxo();
		this.estado = 'inativo';
		this.erro = '';
	}

	/** Troca entre a câmera traseira e a frontal. */
	async alternarLente(): Promise<void> {
		this.frontal = !this.frontal;
		if (this.estado === 'ativo') await this.ativar();
	}

	/**
	 * Liga o <video> da tela ao fluxo da câmera. Use com {@attach}: roda de novo quando o fluxo muda.
	 * A foto e a luminância saem deste elemento.
	 */
	conectar = (elemento: HTMLVideoElement) => {
		this.video = elemento;
		elemento.srcObject = this.fluxo;
		if (this.fluxo) elemento.play().catch(() => {});
		return () => {
			elemento.srcObject = null;
			if (this.video === elemento) this.video = null;
		};
	};

	/** Quadro atual da câmera, para o modelo de visão. null se a câmera não está pronta. */
	async quadro(): Promise<ImageBitmap | null> {
		const video = this.video;
		if (this.estado !== 'ativo' || !video || video.readyState < 2 || video.videoWidth === 0) {
			return null;
		}
		try {
			return await createImageBitmap(video);
		} catch {
			return null;
		}
	}

	/** Fotografa o quadro atual. Devolve um JPEG em data URL, ou null se a câmera não está pronta. */
	capturar(larguraMaxima = 640): string | null {
		const video = this.video;
		if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
		const escala = Math.min(1, larguraMaxima / video.videoWidth);
		const tela = document.createElement('canvas');
		tela.width = Math.round(video.videoWidth * escala);
		tela.height = Math.round(video.videoHeight * escala);
		const contexto = tela.getContext('2d');
		if (!contexto) return null;
		contexto.drawImage(video, 0, 0, tela.width, tela.height);
		return tela.toDataURL('image/jpeg', 0.72);
	}

	private medirLuminancia(): void {
		const video = this.video;
		if (!video || video.readyState < 2) return;
		this.amostra ??= Object.assign(document.createElement('canvas'), { width: 32, height: 24 });
		const contexto = this.amostra.getContext('2d', { willReadFrequently: true });
		if (!contexto) return;
		contexto.drawImage(video, 0, 0, 32, 24);
		const { data } = contexto.getImageData(0, 0, 32, 24);
		let soma = 0;
		for (let i = 0; i < data.length; i += 4) {
			soma += 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
		}
		const media = soma / (data.length / 4) / 255;
		this.luminancia = Math.min(100, media * 100 * GANHO_LUMINANCIA);
	}

	private encerrarFluxo(): void {
		this.fluxo?.getTracks().forEach((trilha) => trilha.stop());
		this.fluxo = null;
	}
}

export const camera = new Camera();
