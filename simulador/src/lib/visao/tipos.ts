// Mensagens trocadas entre a página e o worker do detector.

/** Uma ocorrência encontrada na imagem. A caixa vem em frações (0 a 1) do quadro. */
export interface Deteccao {
	/** buraco, semaforo_apagado, alagamento ou faixa_apagada. */
	classe: string;
	/** De 0 a 1. */
	confianca: number;
	x: number;
	y: number;
	largura: number;
	altura: number;
}

export type PedidoVisao =
	| { tipo: 'carregar'; urlModelo: string; urlInfo: string }
	| { tipo: 'detectar'; quadro: ImageBitmap };

export type RespostaVisao =
	| { tipo: 'pronto'; provedor: 'webgpu' | 'wasm'; tamanho: number }
	| { tipo: 'deteccoes'; deteccoes: Deteccao[]; tempo: number }
	| { tipo: 'erro'; mensagem: string };

export const ROTULO_CLASSE: Record<string, string> = {
	buraco: 'Buraco',
	semaforo_apagado: 'Semáforo apagado',
	alagamento: 'Alagamento',
	faixa_apagada: 'Faixa apagada'
};

/** Rótulos na ordem de CLASSES_CAMERA (firmware/placa.ts). */
export const ROTULOS_CAMERA = ['Buraco', 'Alagamento', 'Semáforo apagado', 'Faixa apagada'];
