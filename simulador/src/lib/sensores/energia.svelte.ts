// Bateria e conexão do celular no papel da bateria 18650 e da cobertura de rede do dispositivo
// (Battery Status API e navigator.onLine).

import type { EstadoSensor } from './tipos.ts';

interface GerenciadorBateria extends EventTarget {
	level: number;
	charging: boolean;
}

class Bateria {
	estado = $state<EstadoSensor>('inativo');
	erro = $state('');
	/** Carga de 0 a 100%. */
	nivel = $state(100);
	carregando = $state(false);

	private gerenciador: GerenciadorBateria | null = null;

	get suportada(): boolean {
		return typeof navigator !== 'undefined' && 'getBattery' in navigator;
	}

	async ativar(): Promise<boolean> {
		if (!this.suportada) {
			this.estado = 'indisponivel';
			this.erro = 'Este navegador não informa a bateria (iPhone e Firefox). Use o modo simulado.';
			return false;
		}
		try {
			const pedir = (navigator as unknown as { getBattery(): Promise<GerenciadorBateria> })
				.getBattery;
			this.gerenciador = await pedir.call(navigator);
			this.gerenciador.addEventListener('levelchange', this.atualizar);
			this.gerenciador.addEventListener('chargingchange', this.atualizar);
			this.atualizar();
			this.estado = 'ativo';
			this.erro = '';
			return true;
		} catch {
			this.estado = 'erro';
			this.erro = 'Não foi possível ler a bateria.';
			return false;
		}
	}

	parar(): void {
		this.gerenciador?.removeEventListener('levelchange', this.atualizar);
		this.gerenciador?.removeEventListener('chargingchange', this.atualizar);
		this.gerenciador = null;
		this.estado = 'inativo';
		this.erro = '';
	}

	private atualizar = () => {
		if (!this.gerenciador) return;
		this.nivel = Math.round(this.gerenciador.level * 100);
		this.carregando = this.gerenciador.charging;
	};
}

class Rede {
	estado = $state<EstadoSensor>('inativo');
	erro = $state('');
	conectada = $state(true);

	ativar(): Promise<boolean> {
		if (typeof window === 'undefined') return Promise.resolve(false);
		this.parar();
		window.addEventListener('online', this.atualizar);
		window.addEventListener('offline', this.atualizar);
		this.atualizar();
		this.estado = 'ativo';
		return Promise.resolve(true);
	}

	parar(): void {
		if (typeof window === 'undefined') return;
		window.removeEventListener('online', this.atualizar);
		window.removeEventListener('offline', this.atualizar);
		this.estado = 'inativo';
	}

	private atualizar = () => {
		this.conectada = navigator.onLine;
	};
}

export const bateria = new Bateria();
export const rede = new Rede();
