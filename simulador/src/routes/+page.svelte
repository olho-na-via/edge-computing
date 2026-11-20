<script lang="ts">
	import logo from '#lib/assets/logo.svg';
	import Icone from '#lib/componentes/Icone.svelte';
	import MonitorSerial from '#lib/componentes/MonitorSerial.svelte';
	import PainelCodigo from '#lib/componentes/PainelCodigo.svelte';
	import PainelEventos from '#lib/componentes/PainelEventos.svelte';
	import PainelSensores from '#lib/componentes/PainelSensores.svelte';
	import PainelTelemetria from '#lib/componentes/PainelTelemetria.svelte';
	import Palco from '#lib/componentes/Palco.svelte';
	import { TOPICO_DADOS } from '#lib/firmware/firmware.ts';
	import { simulador } from '#lib/simulador.svelte.ts';

	const ABAS = [
		{ id: 'sensores', nome: 'Sensores' },
		{ id: 'telemetria', nome: 'Telemetria' },
		{ id: 'serial', nome: 'Serial' },
		{ id: 'eventos', nome: 'Eventos' }
	] as const;
	type Aba = (typeof ABAS)[number]['id'];

	let aba = $state<Aba>('sensores');
	let codigoAberto = $state(false);

	const totalEventos = $derived(
		simulador.mensagens.filter((m) => m.topico === TOPICO_DADOS && m.campos.ev !== 'telemetria')
			.length
	);

	// Ao sair da página: desliga a placa e solta a câmera, o GPS e os sensores
	$effect(() => () => {
		simulador.desligar();
		simulador.usarSimulado();
	});
</script>

<svelte:head>
	<title>Simulador do dispositivo · Olho na Via</title>
	<meta
		name="description"
		content="Simulador web do dispositivo IoT do Olho na Via: o firmware do ESP32 rodando no navegador, com a câmera, o GPS e o acelerômetro do celular."
	/>
</svelte:head>

<div class="app" class:com-codigo={codigoAberto}>
	<header class="topo">
		<img class="logo" src={logo} alt="Olho na Via" />
		<h1>Simulador <span>do dispositivo</span></h1>

		<div class="acoes">
			{#if simulador.ligado}
				<button
					type="button"
					class="icone"
					aria-label={simulador.pausado ? 'Continuar a simulação' : 'Pausar a simulação'}
					aria-pressed={simulador.pausado}
					onclick={() => simulador.alternarPausa()}
				>
					<Icone nome={simulador.pausado ? 'tocar' : 'pausa'} />
				</button>
				<button
					type="button"
					class="icone"
					aria-label="Reiniciar o dispositivo (reset)"
					onclick={() => simulador.reiniciar()}
				>
					<Icone nome="reiniciar" />
				</button>
			{/if}
			<button
				type="button"
				class="icone"
				aria-label={simulador.som ? 'Silenciar o buzzer' : 'Ligar o som do buzzer'}
				aria-pressed={!simulador.som}
				onclick={() => simulador.alternarSom()}
			>
				<Icone nome={simulador.som ? 'som' : 'mudo'} />
			</button>
			<button
				type="button"
				class="codigo"
				class:ativo={codigoAberto}
				aria-expanded={codigoAberto}
				onclick={() => (codigoAberto = !codigoAberto)}
			>
				<Icone nome="codigo" tamanho={18} />
				Código
			</button>
		</div>
	</header>

	<main>
		<Palco />

		<section class="painel">
			<div class="abas" role="tablist" aria-label="Painéis do simulador">
				{#each ABAS as item (item.id)}
					<button
						type="button"
						role="tab"
						id="aba-{item.id}"
						aria-selected={aba === item.id}
						aria-controls="painel-aba"
						class:ativa={aba === item.id}
						onclick={() => (aba = item.id)}
					>
						{item.nome}
						{#if item.id === 'eventos' && totalEventos > 0}
							<span class="contagem numero">{totalEventos}</span>
						{/if}
					</button>
				{/each}
			</div>

			<div class="conteudo" id="painel-aba" role="tabpanel" aria-labelledby="aba-{aba}">
				{#if aba === 'sensores'}
					<PainelSensores />
				{:else if aba === 'telemetria'}
					<PainelTelemetria />
				{:else if aba === 'serial'}
					<MonitorSerial />
				{:else}
					<PainelEventos />
				{/if}
			</div>
		</section>

		<PainelCodigo aberto={codigoAberto} aoFechar={() => (codigoAberto = false)} />
	</main>

	{#if simulador.pausado}
		<p class="aviso" role="status">Simulação pausada: o firmware está parado no tempo.</p>
	{:else if simulador.aviso}
		<p class="aviso" role="status">{simulador.aviso}</p>
	{/if}
</div>

<style>
	.app {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		grid-template-columns: minmax(0, 1fr);
		height: 100dvh;
		overflow: hidden;
	}

	.topo {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: max(0.5rem, env(safe-area-inset-top)) max(0.75rem, env(safe-area-inset-right)) 0.5rem
			max(0.75rem, env(safe-area-inset-left));
	}

	.logo {
		flex-shrink: 0;
		width: auto;
		height: 1.875rem;
	}

	h1 {
		flex-shrink: 0;
		padding-left: 0.625rem;
		border-left: 2px solid var(--secondary-200);
		color: var(--primary-700);
		font-size: 0.6875rem;
		font-weight: 800;
		letter-spacing: 0.14em;
		line-height: 1.3;
		text-transform: uppercase;
	}

	h1 span {
		display: none;
	}

	/* Em celulares, o título não cabe ao lado dos quatro botões: fica só para leitores de tela */
	@media (max-width: 27rem) {
		h1 {
			position: absolute;
			width: 1px;
			height: 1px;
			padding: 0;
			overflow: hidden;
			border: 0;
			clip-path: inset(50%);
			white-space: nowrap;
		}
	}

	.acoes {
		display: flex;
		flex-shrink: 0;
		gap: 0.25rem;
		margin-left: auto;
	}

	.icone,
	.codigo {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		height: 2.5rem;
		border: 1.5px solid var(--secondary-200);
		border-radius: 999px;
		background: var(--branco);
		font-size: 0.875rem;
		font-weight: 700;
		transition:
			transform 150ms var(--ease-saida),
			background-color 150ms,
			border-color 150ms;
	}

	.icone {
		width: 2.5rem;
		padding: 0;
	}

	.codigo {
		padding: 0 0.75rem;
	}

	.icone:active,
	.codigo:active {
		transform: scale(0.95);
	}

	.icone[aria-pressed='true'],
	.codigo.ativo {
		border-color: var(--secondary-950);
		background: var(--secondary-950);
		color: var(--branco);
	}

	main {
		display: grid;
		grid-template-rows: min(46dvh, 25rem) minmax(0, 1fr);
		min-height: 0;
	}

	.painel {
		display: grid;
		grid-template-rows: auto minmax(0, 1fr);
		min-height: 0;
		border-top: 1px solid var(--secondary-100);
		background: var(--background);
	}

	.abas {
		display: flex;
		gap: 0.25rem;
		padding: 0.5rem 0.75rem;
		overflow-x: auto;
		border-bottom: 1px solid var(--secondary-100);
		background: var(--branco);
		scrollbar-width: none;
	}

	.abas::-webkit-scrollbar {
		display: none;
	}

	.abas button {
		display: inline-flex;
		flex: 1 0 auto;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		min-height: 2.5rem;
		padding: 0 0.75rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--secondary-700);
		font-size: 0.9375rem;
		font-weight: 700;
		transition:
			background-color 180ms var(--ease-saida),
			color 180ms;
	}

	.abas button.ativa {
		background: var(--secondary-950);
		color: var(--branco);
	}

	.contagem {
		min-width: 1.25rem;
		padding: 0 0.3125rem;
		border-radius: 999px;
		background: var(--primary-500);
		color: var(--secondary-950);
		font-size: 0.6875rem;
		font-weight: 800;
		line-height: 1.25rem;
	}

	.conteudo {
		min-height: 0;
		padding: 0.75rem max(0.75rem, env(safe-area-inset-right))
			max(0.75rem, env(safe-area-inset-bottom)) max(0.75rem, env(safe-area-inset-left));
		overflow-x: hidden;
		overflow-y: auto;
		overscroll-behavior: contain;
	}

	.aviso {
		position: fixed;
		z-index: 40;
		bottom: max(1rem, env(safe-area-inset-bottom));
		left: 50%;
		width: max-content;
		max-width: calc(100vw - 2rem);
		padding: 0.625rem 1rem;
		border-radius: 999px;
		background: var(--secondary-950);
		color: var(--branco);
		font-size: 0.875rem;
		font-weight: 700;
		text-align: center;
		box-shadow: 0 8px 24px rgb(22 35 14 / 0.3);
		transform: translateX(-50%);
		animation: sobe 320ms var(--ease-saida);
	}

	@keyframes sobe {
		from {
			opacity: 0;
			transform: translate(-50%, 0.75rem);
		}
	}

	/* Celular deitado (no suporte do painel do carro): modelo à esquerda, painéis à direita */
	@media (orientation: landscape) and (max-height: 34rem) {
		main {
			grid-template-rows: none;
			grid-template-columns: minmax(0, 0.9fr) minmax(0, 1.1fr);
		}

		.painel {
			border-top: 0;
			border-left: 1px solid var(--secondary-100);
		}
	}

	@media (min-width: 64rem) {
		.topo {
			padding: 0.875rem 1.25rem;
		}

		.logo {
			height: 2.125rem;
		}

		h1 {
			font-size: 0.75rem;
		}

		h1 span {
			display: inline;
		}

		main {
			grid-template-rows: none;
			grid-template-columns: minmax(0, 1fr) 26rem;
			gap: 1rem;
			padding: 0 1.25rem 1.25rem;
		}

		.com-codigo main {
			grid-template-columns: minmax(18rem, 1fr) 26rem minmax(22rem, 34rem);
		}

		.painel {
			overflow: hidden;
			border: 1px solid var(--secondary-100);
			border-radius: 1.5rem;
		}
	}
</style>
