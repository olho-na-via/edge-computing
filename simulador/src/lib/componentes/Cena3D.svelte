<script lang="ts">
	// Modelo 3D do dispositivo (../../../../modelo-3d), com os atuadores comandados pelo firmware:
	// LEDs, texto do LCD, buzzer e chave liga/desliga. Com o acelerômetro do celular ligado,
	// o modelo acompanha a inclinação do aparelho.
	import { onMount } from 'svelte';
	import urlGabinete from '$edge/modelo-3d/modelo/gabinete.glb?url';
	import type { NomeVista, Vista, Visualizador } from '$edge/modelo-3d/visualizador.js';
	import { limitar } from '../firmware/placa.ts';
	import { movimento } from '../sensores/movimento.svelte.ts';
	import { simulador } from '../simulador.svelte.ts';

	let container: HTMLDivElement;
	let visualizador = $state.raw<Visualizador | null>(null);
	let falha = $state('');

	const GRAUS_PARA_RAD = Math.PI / 180;

	// Vistas mais próximas que as da landing page: aqui o dispositivo aparece sem o suporte,
	// e o LCD precisa dar para ler na tela do celular
	const VISTAS: Record<NomeVista, Vista> = {
		traseira: { posicao: [116, 80, 332], alvo: [0, 4, 0] },
		frontal: { posicao: [-120, 75, -330], alvo: [0, 6, -4] },
		explodida: { posicao: [408, 180, 356], alvo: [0, -5, 20] }
	};

	onMount(() => {
		let desmontado = false;
		let criado: Visualizador | undefined;

		(async () => {
			try {
				// three.js só é baixado no navegador, depois que a página já apareceu
				const { criarVisualizador } = await import('$edge/modelo-3d/visualizador.js');
				criado = await criarVisualizador(container, {
					autoRotacao: false,
					ajustarZoom: true,
					vista: VISTAS.traseira,
					leve: matchMedia('(pointer: coarse)').matches,
					urlGabinete,
					aoChave: () => simulador.alternarEnergia()
				});
				if (desmontado) {
					criado.destruir();
					return;
				}
				criado.definirSuporte('nenhum');
				visualizador = criado;
			} catch {
				falha = 'Não foi possível carregar o modelo 3D neste navegador.';
			}
		})();

		return () => {
			desmontado = true;
			criado?.destruir();
		};
	});

	// Atuadores: o que o firmware escreveu nos pinos e no LCD
	$effect(() => {
		visualizador?.definirAtuadores({
			lcd: simulador.lcd,
			leds: {
				verde: Number(simulador.leds.verde),
				amarelo: Number(simulador.leds.amarelo),
				vermelho: Number(simulador.leds.vermelho),
				azul: Number(simulador.leds.azul)
			},
			buzzer: simulador.buzzer && !simulador.pausado,
			chave: simulador.ligado
		});
	});

	// Inclinação: com o celular em pé (beta = 90 graus), o dispositivo fica de frente
	$effect(() => {
		const v = visualizador;
		if (!v) return;
		if (simulador.fontes.movimento !== 'celular') {
			v.definirOrientacao(0, 0, 0);
			return;
		}

		let quadro = 0;
		const acompanhar = () => {
			const { beta, gamma, valida } = movimento.orientacao;
			if (valida) {
				v.definirOrientacao(
					limitar(beta - 90, -55, 55) * GRAUS_PARA_RAD,
					limitar(gamma, -45, 45) * GRAUS_PARA_RAD,
					0
				);
			}
			quadro = requestAnimationFrame(acompanhar);
		};
		quadro = requestAnimationFrame(acompanhar);
		return () => cancelAnimationFrame(quadro);
	});

	export function irPara(vista: NomeVista) {
		visualizador?.irPara(VISTAS[vista]);
	}

	export function definirExplosao(aberto: boolean) {
		visualizador?.definirExplosao(aberto ? 1 : 0);
	}
</script>

<div class="cena">
	<div class="tela" bind:this={container}></div>
	{#if falha}
		<p class="recado">{falha}</p>
	{:else if !visualizador}
		<p class="recado">Carregando o modelo 3D…</p>
	{/if}
</div>

<style>
	.cena {
		position: absolute;
		inset: 0;
	}

	/* O visualizador define position: relative neste elemento: a altura precisa ser explícita */
	.tela {
		position: relative;
		width: 100%;
		height: 100%;
		touch-action: none;
	}

	.recado {
		position: absolute;
		inset: 0;
		display: grid;
		place-items: center;
		padding: 1rem;
		color: var(--secondary-700);
		font-weight: 700;
		text-align: center;
		pointer-events: none;
	}

	/* Rótulos da vista explodida, criados pelo visualizador */
	.tela :global(.rotulo-3d) {
		padding: 0.25rem 0.625rem;
		border: 2px solid var(--primary-500);
		border-radius: 999px;
		background: var(--secondary-950);
		box-shadow: 0 4px 14px rgb(22 35 14 / 0.25);
		color: var(--branco);
		font: 700 0.75rem var(--fonte);
		white-space: nowrap;
		transform: translateY(-18px);
	}
</style>
