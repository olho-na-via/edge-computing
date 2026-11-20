/// <reference lib="webworker" />
// Detector de ocorrências na via, rodando fora da thread da página para não travar o firmware.
// É o mesmo modelo YOLO de ../../../../visao-computacional, exportado para ONNX
// (treino/exportar_onnx.py) e executado pelo onnxruntime-web: WebGPU quando o aparelho tem,
// WebAssembly quando não tem.

import * as ort from 'onnxruntime-web/webgpu';
import urlMjs from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.mjs?url';
import urlWasm from 'onnxruntime-web/ort-wasm-simd-threaded.jsep.wasm?url';
import type { Deteccao, PedidoVisao, RespostaVisao } from './tipos.ts';

const CONFIANCA_MINIMA = 0.25;
const IOU_MAXIMO = 0.5;
// Classe usada só no treino, para o modelo separar semáforo aceso de apagado
const CLASSE_AUXILIAR = 'semaforo_aceso';

let sessao: ort.InferenceSession | null = null;
let classes: string[] = [];
let tamanho = 480;
let tela: OffscreenCanvas;
let contexto: OffscreenCanvasRenderingContext2D;

const responder = (resposta: RespostaVisao) => postMessage(resposta);

async function carregar(urlModelo: string, urlInfo: string): Promise<void> {
	const info = (await (await fetch(urlInfo)).json()) as { tamanho: number; classes: string[] };
	classes = info.classes;
	tamanho = info.tamanho;
	tela = new OffscreenCanvas(tamanho, tamanho);
	contexto = tela.getContext('2d', { willReadFrequently: true })!;

	const modelo = await (await fetch(urlModelo)).arrayBuffer();
	ort.env.wasm.wasmPaths = { mjs: urlMjs, wasm: urlWasm };
	// Mais de uma thread exigiria isolamento de origem (COOP/COEP) no servidor
	ort.env.wasm.numThreads = 1;

	let provedor: 'webgpu' | 'wasm' = 'wasm';
	if ('gpu' in navigator) {
		try {
			sessao = await ort.InferenceSession.create(modelo, { executionProviders: ['webgpu'] });
			provedor = 'webgpu';
		} catch {
			sessao = null;
		}
	}
	sessao ??= await ort.InferenceSession.create(modelo, { executionProviders: ['wasm'] });
	responder({ tipo: 'pronto', provedor, tamanho });
}

/** Redimensiona o quadro para a entrada quadrada do modelo, com bordas cinza (letterbox). */
function preparar(quadro: ImageBitmap) {
	const escala = Math.min(tamanho / quadro.width, tamanho / quadro.height);
	const largura = Math.round(quadro.width * escala);
	const altura = Math.round(quadro.height * escala);
	const margemX = (tamanho - largura) / 2;
	const margemY = (tamanho - altura) / 2;
	contexto.fillStyle = 'rgb(114, 114, 114)';
	contexto.fillRect(0, 0, tamanho, tamanho);
	contexto.drawImage(quadro, margemX, margemY, largura, altura);

	// De RGBA intercalado para três planos R, G e B, de 0 a 1
	const { data } = contexto.getImageData(0, 0, tamanho, tamanho);
	const area = tamanho * tamanho;
	const entrada = new Float32Array(3 * area);
	for (let i = 0; i < area; i++) {
		entrada[i] = data[i * 4] / 255;
		entrada[i + area] = data[i * 4 + 1] / 255;
		entrada[i + 2 * area] = data[i * 4 + 2] / 255;
	}
	return { entrada, margemX, margemY, largura, altura };
}

function sobreposicao(a: Deteccao, b: Deteccao): number {
	const x1 = Math.max(a.x, b.x);
	const y1 = Math.max(a.y, b.y);
	const x2 = Math.min(a.x + a.largura, b.x + b.largura);
	const y2 = Math.min(a.y + a.altura, b.y + b.altura);
	const intersecao = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
	return intersecao / (a.largura * a.altura + b.largura * b.altura - intersecao);
}

async function detectar(quadro: ImageBitmap): Promise<void> {
	if (!sessao) return;
	const inicio = performance.now();
	const { entrada, margemX, margemY, largura, altura } = preparar(quadro);
	quadro.close();

	const tensor = new ort.Tensor('float32', entrada, [1, 3, tamanho, tamanho]);
	const saidas = await sessao.run({ [sessao.inputNames[0]]: tensor });
	const saida = saidas[sessao.outputNames[0]];
	const valores = saida.data as Float32Array;
	// Saída [1, 4 + classes, candidatos]: centro x, centro y, largura, altura e a nota de cada classe
	const candidatos = saida.dims[2];

	const achadas: Deteccao[] = [];
	for (let i = 0; i < candidatos; i++) {
		let melhor = 0;
		let indice = -1;
		for (let c = 0; c < classes.length; c++) {
			const nota = valores[(4 + c) * candidatos + i];
			if (nota > melhor) {
				melhor = nota;
				indice = c;
			}
		}
		if (melhor < CONFIANCA_MINIMA || classes[indice] === CLASSE_AUXILIAR) continue;

		// Do quadrado do modelo de volta para frações (0 a 1) do quadro original
		const w = valores[2 * candidatos + i];
		const h = valores[3 * candidatos + i];
		achadas.push({
			classe: classes[indice],
			confianca: melhor,
			x: (valores[i] - w / 2 - margemX) / largura,
			y: (valores[candidatos + i] - h / 2 - margemY) / altura,
			largura: w / largura,
			altura: h / altura
		});
	}

	// Supressão de não máximos: entre caixas da mesma classe muito sobrepostas, fica a mais confiante
	achadas.sort((a, b) => b.confianca - a.confianca);
	const deteccoes: Deteccao[] = [];
	for (const candidata of achadas) {
		const repetida = deteccoes.some(
			(d) => d.classe === candidata.classe && sobreposicao(d, candidata) > IOU_MAXIMO
		);
		if (!repetida) deteccoes.push(candidata);
	}

	responder({ tipo: 'deteccoes', deteccoes, tempo: performance.now() - inicio });
}

addEventListener('message', (evento: MessageEvent<PedidoVisao>) => {
	const pedido = evento.data;
	const tarefa =
		pedido.tipo === 'carregar'
			? carregar(pedido.urlModelo, pedido.urlInfo)
			: detectar(pedido.quadro);
	tarefa.catch((falha: unknown) =>
		responder({ tipo: 'erro', mensagem: falha instanceof Error ? falha.message : String(falha) })
	);
});
