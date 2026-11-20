// Arquivos da pasta da disciplina (../), importados pelo alias $edge do vite.config.ts.

declare module '$edge/sketch.ino?raw' {
	const codigo: string;
	export default codigo;
}

declare module '$edge/modelo-3d/modelo/gabinete.glb?url' {
	const url: string;
	export default url;
}

declare module '$edge/modelo-3d/visualizador.js' {
	export type CorLed = 'verde' | 'amarelo' | 'vermelho' | 'azul';

	export interface Atuadores {
		lcd?: [string, string];
		leds?: Partial<Record<CorLed, number>>;
		buzzer?: boolean;
		/** Posição da chave liga/desliga; desligada, o LCD apaga. */
		chave?: boolean;
	}

	export type NomeVista = 'traseira' | 'frontal' | 'explodida';

	/** Posição da câmera e ponto para onde ela olha, em milímetros. */
	export interface Vista {
		posicao: [number, number, number];
		alvo: [number, number, number];
	}

	export interface Visualizador {
		definirEstado(estado: 'NORMAL' | 'ATENCAO' | 'CRITICO' | 'FALHA'): void;
		definirAtuadores(atuadores: Atuadores): void;
		definirOrientacao(x: number, y: number, z: number): void;
		definirExplosao(t: number): void;
		definirSuporte(suporte: 'onibus' | 'kit' | 'nenhum'): void;
		definirAutoRotacao(ativo: boolean): void;
		irPara(vista: NomeVista | Vista): void;
		destruir(): void;
	}

	export interface OpcoesVisualizador {
		autoRotacao?: boolean;
		fundoTransparente?: boolean;
		urlGabinete?: string;
		leve?: boolean;
		ajustarZoom?: boolean;
		vista?: NomeVista | Vista;
		aoChave?: () => void;
	}

	export function criarVisualizador(
		container: HTMLElement,
		opcoes?: OpcoesVisualizador
	): Promise<Visualizador>;
}
