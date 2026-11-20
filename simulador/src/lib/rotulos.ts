// Textos de interface para os códigos que o firmware usa no Serial e no MQTT.

import type { NomeEstado } from './firmware/firmware.ts';

export const ROTULO_ESTADO: Record<NomeEstado, string> = {
	NORMAL: 'Normal',
	ATENCAO: 'Atenção',
	CRITICO: 'Crítico',
	FALHA: 'Falha'
};

export const ROTULO_MOTIVO: Record<string, string> = {
	via_ok: 'Via em ordem',
	buraco: 'Buraco na via',
	alagamento: 'Alagamento',
	semaforo_apagado: 'Semáforo apagado',
	irregularidade: 'Via irregular',
	agua_na_via: 'Água na via',
	buraco_suspeito: 'Possível buraco à frente',
	semaforo_suspeito: 'Possível semáforo apagado',
	faixa_apagada: 'Faixa de pedestre apagada',
	luz_fraca: 'Luz fraca',
	acelerometro: 'Acelerômetro sem resposta',
	gps_sem_sinal: 'GPS sem sinal',
	bateria_baixa: 'Bateria baixa'
};

export const ROTULO_EVENTO: Record<string, string> = {
	via_normalizada: 'Via normalizada',
	registro_ponto: 'Ponto registrado',
	pre_chamado: 'Pré-chamado',
	falha_sensor: 'Falha de sensor',
	foto_remota: 'Foto remota',
	telemetria: 'Telemetria'
};

/** millis() do firmware como "1:05.3" (minutos, segundos e décimos). */
export function formatarTempo(ms: number): string {
	const segundos = ms / 1000;
	const minutos = Math.floor(segundos / 60);
	return `${minutos}:${(segundos % 60).toFixed(1).padStart(4, '0')}`;
}
