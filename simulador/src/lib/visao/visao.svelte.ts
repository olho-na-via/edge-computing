// Visão computacional no navegador: faz o papel da IA que roda na ESP32-CAM.
// Envia os quadros da câmera do celular ao worker do detector, um de cada vez, e guarda as
// ocorrências encontradas. A confiança de cada classe alimenta o firmware.

import { asset } from '$app/paths';
import { camera } from '../sensores/camera.svelte.ts';
import type { EstadoSensor } from '../sensores/tipos.ts';
import type { Deteccao, PedidoVisao, RespostaVisao } from './tipos.ts';

/** Pausa mínima entre duas inferências, para o celular não esquentar à toa. */
const INTERVALO_MINIMO = 150;

class Visao {
	/** 'pedindo' = baixando e preparando o modelo (38 MB na primeira vez). */
	estado = $state<EstadoSensor>('inativo');
	erro = $state('');
	deteccoes = $state.raw<Deteccao[]>([]);
	/** Para cada classe vista no último quadro, a maior confiança (0 a 100%). */
	confiancas = $state.raw<Record<string, number>>({});
	/** Tempo da última inferência, em ms. */
	tempo = $state(0);
	/** Onde o modelo está rodando. */
	provedor = $state<'webgpu' | 'wasm' | ''>('');

	private worker: Worker | null = null;
	private ocupado = false;
	private temporizador: ReturnType<typeof setTimeout> | undefined;
	private aoCarregar: ((ok: boolean) => void) | null = null;
	private carregando: Promise<boolean> | null = null;

	get suportada(): boolean {
		return typeof Worker !== 'undefined' && typeof OffscreenCanvas !== 'undefined';
	}

	/** Carrega o modelo e começa a analisar a câmera. A câmera precisa estar ligada. */
	ativar(): Promise<boolean> {
		if (this.estado === 'ativo') return Promise.resolve(true);
		if (this.carregando) return this.carregando;
		if (!this.suportada) {
			this.estado = 'indisponivel';
			this.erro = 'Este navegador não consegue rodar o modelo de visão. Use o modo simulado.';
			return Promise.resolve(false);
		}

		this.encerrar();
		this.estado = 'pedindo';
		this.erro = '';
		this.worker = new Worker(new URL('./detector.worker.ts', import.meta.url), { type: 'module' });
		this.worker.addEventListener('message', this.aoResponder);
		this.worker.addEventListener('error', () => this.falhar('O detector parou de responder.'));
		this.enviar({
			tipo: 'carregar',
			urlModelo: new URL(asset('modelos/olho_na_via.onnx'), location.href).href,
			urlInfo: new URL(asset('modelos/olho_na_via.json'), location.href).href
		});
		this.carregando = new Promise<boolean>((resolver) => {
			this.aoCarregar = resolver;
		}).finally(() => {
			this.carregando = null;
		});
		return this.carregando;
	}

	parar(): void {
		this.encerrar();
		this.estado = 'inativo';
		this.erro = '';
	}

	private aoResponder = (evento: MessageEvent<RespostaVisao>) => {
		const resposta = evento.data;
		if (resposta.tipo === 'pronto') {
			this.provedor = resposta.provedor;
			this.estado = 'ativo';
			this.aoCarregar?.(true);
			this.aoCarregar = null;
			void this.analisar();
		} else if (resposta.tipo === 'deteccoes') {
			this.ocupado = false;
			this.deteccoes = resposta.deteccoes;
			this.tempo = resposta.tempo;
			const confiancas: Record<string, number> = {};
			for (const deteccao of resposta.deteccoes) {
				const porcento = Math.round(deteccao.confianca * 100);
				confiancas[deteccao.classe] = Math.max(confiancas[deteccao.classe] ?? 0, porcento);
			}
			this.confiancas = confiancas;
			this.temporizador = setTimeout(() => void this.analisar(), INTERVALO_MINIMO);
		} else {
			this.falhar(`Falha no modelo de visão: ${resposta.mensagem}`);
		}
	};

	/** Manda o quadro atual da câmera ao detector; o próximo só sai quando este voltar. */
	private async analisar(): Promise<void> {
		if (this.estado !== 'ativo' || this.ocupado || !this.worker) return;
		const quadro = await camera.quadro();
		if (!quadro) {
			// Câmera desligada ou ainda sem imagem: nada à vista, tenta de novo daqui a pouco
			this.deteccoes = [];
			this.confiancas = {};
			this.temporizador = setTimeout(() => void this.analisar(), 500);
			return;
		}
		this.ocupado = true;
		this.enviar({ tipo: 'detectar', quadro }, [quadro]);
	}

	private enviar(pedido: PedidoVisao, transferir: Transferable[] = []): void {
		this.worker?.postMessage(pedido, transferir);
	}

	private falhar(mensagem: string): void {
		this.encerrar();
		this.estado = 'erro';
		this.erro = mensagem;
		this.aoCarregar?.(false);
		this.aoCarregar = null;
	}

	private encerrar(): void {
		this.aoCarregar?.(false);
		this.aoCarregar = null;
		clearTimeout(this.temporizador);
		this.worker?.terminate();
		this.worker = null;
		this.ocupado = false;
		this.deteccoes = [];
		this.confiancas = {};
		this.provedor = '';
	}
}

export const visao = new Visao();
