<script lang="ts">
	// Monitor serial: as mesmas linhas que o firmware escreve com Serial.println().
	import { tick } from 'svelte';
	import { formatarTempo } from '../rotulos.ts';
	import { simulador } from '../simulador.svelte.ts';
	import Chave from './Chave.svelte';

	let lista: HTMLOListElement;
	let ocultarTelemetria = $state(true);
	// Só acompanha o fim da lista enquanto a pessoa não rolou para cima para ler
	let acompanhar = true;

	const linhas = $derived(
		ocultarTelemetria
			? simulador.serial.filter(
					(linha) =>
						linha.etiqueta !== 'TELEMETRIA' && !linha.texto.startsWith('[MQTT] ev|telemetria')
				)
			: simulador.serial
	);

	$effect(() => {
		void linhas.length;
		if (!acompanhar) return;
		void tick().then(() => {
			lista.scrollTop = lista.scrollHeight;
		});
	});

	function aoRolar() {
		acompanhar = lista.scrollHeight - lista.scrollTop - lista.clientHeight < 32;
	}
</script>

<div class="serial">
	<div class="barra">
		<p class="kicker">Serial · 115200 baud</p>
		<button type="button" class="botao pequeno" onclick={() => simulador.limparSerial()}
			>Limpar</button
		>
	</div>
	<Chave
		rotulo="Ocultar a telemetria de 5 em 5 s"
		ligada={ocultarTelemetria}
		aoMudar={(ligada) => (ocultarTelemetria = ligada)}
	/>
	<ol class="linhas" bind:this={lista} onscroll={aoRolar} aria-live="off">
		{#each linhas as linha (linha.id)}
			<li data-etiqueta={linha.etiqueta}>
				<time>{formatarTempo(linha.tempo)}</time>
				<span>
					{#if linha.etiqueta}<b>[{linha.etiqueta}]</b>{linha.texto.slice(
							linha.etiqueta.length + 2
						)}
					{:else}{linha.texto}{/if}
				</span>
			</li>
		{:else}
			<li class="vazio">
				{simulador.ligado
					? 'Nenhuma linha ainda.'
					: 'Ligue o dispositivo para ver a saída do firmware.'}
			</li>
		{/each}
	</ol>
</div>

<style>
	.serial {
		display: grid;
		grid-template-rows: auto auto minmax(12rem, 1fr);
		gap: 0.375rem;
		height: 100%;
		min-height: 0;
	}

	.barra {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.linhas {
		min-height: 0;
		margin: 0;
		padding: 0.625rem 0.75rem;
		overflow-y: auto;
		border-radius: var(--raio);
		background: var(--secondary-950);
		color: var(--secondary-100);
		font: 500 0.75rem/1.55 var(--fonte-codigo);
		font-variant-ligatures: none;
		list-style: none;
		overscroll-behavior: contain;
	}

	li {
		display: grid;
		grid-template-columns: 3.25rem 1fr;
		gap: 0.5rem;
	}

	li span {
		overflow-wrap: anywhere;
	}

	time {
		color: var(--secondary-500);
		text-align: right;
	}

	b {
		color: var(--primary-400);
		font-weight: 700;
	}

	li[data-etiqueta='ESTADO'] b {
		color: var(--atencao-marca);
	}

	li[data-etiqueta='CAMERA'] b,
	li[data-etiqueta='KIT CIDADAO'] b {
		color: #7fa8ff;
	}

	li[data-etiqueta='OFFLINE'] b,
	li[data-etiqueta='REDE'] b {
		color: #ff9a8f;
	}

	li.vazio {
		display: block;
		color: var(--secondary-400);
	}
</style>
