// Localização do celular no papel do módulo GPS (navigator.geolocation).

import { AVISO_HTTPS, contextoSeguro, type EstadoSensor } from './tipos.ts';

const RAIO_TERRA = 6371000;

class Gps {
	estado = $state<EstadoSensor>('inativo');
	erro = $state('');
	/** Tem posição válida (o "fix" do GPS). */
	sinal = $state(false);
	latitude = $state(0);
	longitude = $state(0);
	/** Velocidade em km/h. */
	velocidade = $state(0);
	/** Raio de erro da posição, em metros. */
	precisao = $state(0);

	private vigia: number | null = null;
	private anterior: { latitude: number; longitude: number; hora: number } | null = null;

	get suportado(): boolean {
		return typeof navigator !== 'undefined' && 'geolocation' in navigator;
	}

	ativar(): Promise<boolean> {
		if (!this.suportado) {
			this.estado = 'indisponivel';
			this.erro = contextoSeguro() ? 'Este navegador não informa a localização.' : AVISO_HTTPS;
			return Promise.resolve(false);
		}

		this.encerrar();
		this.estado = 'pedindo';
		this.erro = '';

		// Resolve na primeira resposta (posição ou recusa); depois o watchPosition segue atualizando
		return new Promise((resolver) => {
			let respondeu = false;
			const responder = (ok: boolean) => {
				if (respondeu) return;
				respondeu = true;
				resolver(ok);
			};

			this.vigia = navigator.geolocation.watchPosition(
				(posicao) => {
					this.aoReceber(posicao);
					responder(true);
				},
				(falha) => {
					this.aoFalhar(falha);
					responder(false);
				},
				{ enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
			);
		});
	}

	parar(): void {
		this.encerrar();
		this.estado = 'inativo';
		this.erro = '';
		this.sinal = false;
	}

	private aoReceber(posicao: GeolocationPosition): void {
		const { latitude, longitude, speed, accuracy } = posicao.coords;
		let velocidade = speed !== null && speed >= 0 ? speed * 3.6 : null;

		// Nem todo aparelho informa a velocidade: calcula pelo deslocamento entre duas posições
		if (velocidade === null) {
			const segundos = this.anterior ? (posicao.timestamp - this.anterior.hora) / 1000 : 0;
			if (this.anterior && segundos > 0.5) {
				const metros = distancia(
					this.anterior.latitude,
					this.anterior.longitude,
					latitude,
					longitude
				);
				// Deslocamento menor que o erro do GPS é ruído, não movimento
				velocidade = metros > accuracy / 2 ? (metros / segundos) * 3.6 : 0;
			} else {
				velocidade = this.velocidade;
			}
		}

		this.anterior = { latitude, longitude, hora: posicao.timestamp };
		this.latitude = latitude;
		this.longitude = longitude;
		this.velocidade = velocidade;
		this.precisao = accuracy;
		this.sinal = true;
		this.estado = 'ativo';
		this.erro = '';
	}

	private aoFalhar(falha: GeolocationPositionError): void {
		this.sinal = false;
		if (falha.code === falha.PERMISSION_DENIED) {
			this.encerrar();
			this.estado = 'negado';
			this.erro = 'Permissão de localização negada. Libere nas configurações do site.';
		} else {
			// Sem satélites ou sem resposta a tempo: o watchPosition continua tentando
			this.estado = 'ativo';
			this.erro = 'Sem sinal de GPS no momento. Vá para perto de uma janela ou área aberta.';
		}
	}

	private encerrar(): void {
		if (this.vigia !== null) navigator.geolocation.clearWatch(this.vigia);
		this.vigia = null;
		this.anterior = null;
	}
}

/** Distância em metros entre duas coordenadas (fórmula de haversine). */
function distancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
	const rad = Math.PI / 180;
	const dLat = (lat2 - lat1) * rad;
	const dLon = (lon2 - lon1) * rad;
	const a =
		Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * rad) * Math.cos(lat2 * rad) * Math.sin(dLon / 2) ** 2;
	return 2 * RAIO_TERRA * Math.asin(Math.sqrt(a));
}

export const gps = new Gps();
