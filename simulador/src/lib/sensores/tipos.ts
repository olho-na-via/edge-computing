/** Situação de um sensor do celular. */
export type EstadoSensor =
	| 'inativo' // ainda não foi pedido
	| 'pedindo' // aguardando a permissão do navegador
	| 'ativo' // entregando leituras
	| 'negado' // a pessoa recusou a permissão
	| 'indisponivel' // o aparelho ou o navegador não tem este sensor
	| 'erro';

/** Câmera, GPS e sensores de movimento só existem em HTTPS ou em localhost. */
export function contextoSeguro(): boolean {
	return typeof window !== 'undefined' && window.isSecureContext;
}

export const AVISO_HTTPS = 'Abra o simulador por HTTPS (veja o README) para usar este sensor.';
