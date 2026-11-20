// Realce de sintaxe do sketch.ino (C++ do Arduino), sem dependências.

export type TipoToken =
	| ''
	| 'comentario'
	| 'texto'
	| 'numero'
	| 'reservada'
	| 'tipo'
	| 'diretiva'
	| 'funcao'
	| 'constante'
	| 'arduino';

export interface Token {
	texto: string;
	tipo: TipoToken;
}

export interface Funcao {
	nome: string;
	/** Linha da declaração, começando em 1. */
	linha: number;
}

const RESERVADAS = new Set(
	'if else for while do return break continue switch case default const static struct class new sizeof true false'.split(
		' '
	)
);

const TIPOS = new Set(
	'void int float double bool char long short unsigned byte String size_t uint8_t uint16_t uint32_t int16_t int32_t WiFiClient PubSubClient Adafruit_MPU6050 LiquidCrystal_I2C TinyGPSPlus sensors_event_t'.split(
		' '
	)
);

const ARDUINO = new Set(
	'Serial Serial1 Serial2 WiFi Wire pinMode digitalWrite digitalRead analogRead millis delay delayMicroseconds pulseIn tone noTone map constrain random isnan fabs sqrt acos'.split(
		' '
	)
);

const PADRAO =
	/(\/\/.*$)|("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])')|(\b0x[0-9a-fA-F]+\b|\b\d+(?:\.\d+)?\b)|([A-Za-z_]\w*)|(\s+)|(.)/g;

function classificar(palavra: string, resto: string): TipoToken {
	if (RESERVADAS.has(palavra)) return 'reservada';
	if (TIPOS.has(palavra)) return 'tipo';
	if (ARDUINO.has(palavra)) return 'arduino';
	if (/^[A-Z][A-Z0-9_]+$/.test(palavra)) return 'constante';
	if (/^\s*\(/.test(resto)) return 'funcao';
	return '';
}

function realcarLinha(linha: string): Token[] {
	const tokens: Token[] = [];
	const acrescentar = (texto: string, tipo: TipoToken) => {
		const ultimo = tokens.at(-1);
		// Junta vizinhos do mesmo tipo: menos elementos na tela
		if (ultimo && ultimo.tipo === tipo) ultimo.texto += texto;
		else tokens.push({ texto, tipo });
	};

	// Diretiva do pré-processador: "#include <WiFi.h>", "#if !EMULAR_PERIFERICOS"
	const diretiva = /^(\s*#\s*\w+)(.*)$/.exec(linha);
	if (diretiva) {
		acrescentar(diretiva[1], 'diretiva');
		const inclusao = /^(\s*)(<[^>]+>)(.*)$/.exec(diretiva[2]);
		if (inclusao) {
			acrescentar(inclusao[1], '');
			acrescentar(inclusao[2], 'texto');
			linha = inclusao[3];
		} else {
			linha = diretiva[2];
		}
	}

	PADRAO.lastIndex = 0;
	let m: RegExpExecArray | null;
	while ((m = PADRAO.exec(linha)) !== null) {
		if (m[1]) acrescentar(m[1], 'comentario');
		else if (m[2] || m[3]) acrescentar(m[0], 'texto');
		else if (m[4]) acrescentar(m[4], 'numero');
		else if (m[5]) acrescentar(m[5], classificar(m[5], linha.slice(PADRAO.lastIndex)));
		else acrescentar(m[0], '');
	}
	return tokens;
}

/** Uma lista de tokens para cada linha do código. */
export function realcar(codigo: string): Token[][] {
	return codigo.replace(/\r\n/g, '\n').split('\n').map(realcarLinha);
}

/** Funções declaradas no nível do arquivo, na ordem em que aparecem. */
export function listarFuncoes(codigo: string): Funcao[] {
	const funcoes: Funcao[] = [];
	codigo
		.replace(/\r\n/g, '\n')
		.split('\n')
		.forEach((linha, indice) => {
			const m = /^(?:[A-Za-z_][\w*&]*\s+)+\**([A-Za-z_]\w*)\s*\([^;]*\)\s*\{\s*$/.exec(linha);
			if (m) funcoes.push({ nome: m[1], linha: indice + 1 });
		});
	return funcoes;
}

/** Para cada motivo, a linha (começando em 1) em que decidirEstado() o atribui. */
export function mapearMotivos(codigo: string): Map<string, number> {
	const motivos = new Map<string, number>();
	codigo
		.replace(/\r\n/g, '\n')
		.split('\n')
		.forEach((linha, indice) => {
			const m = /^\s+motivo = "(\w+)";/.exec(linha);
			if (m && !motivos.has(m[1])) motivos.set(m[1], indice + 1);
		});
	return motivos;
}
