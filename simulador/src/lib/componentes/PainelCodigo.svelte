<script lang="ts">
	// Painel retrátil com o firmware (../../../../sketch.ino), com realce de sintaxe.
	// No celular é uma gaveta que sobe da base; em telas largas, uma coluna ao lado.
	// A linha de decidirEstado() que explica o estado atual fica marcada.
	import codigo from '$edge/sketch.ino?raw';
	import { listarFuncoes, mapearMotivos, realcar } from '../codigo/realce.ts';
	import { ROTULO_MOTIVO } from '../rotulos.ts';
	import { simulador } from '../simulador.svelte.ts';
	import Icone from './Icone.svelte';

	let { aberto, aoFechar }: { aberto: boolean; aoFechar: () => void } = $props();

	const linhas = realcar(codigo);
	const funcoes = listarFuncoes(codigo);
	const linhasDosMotivos = mapearMotivos(codigo);

	let rolagem = $state<HTMLDivElement>();
	// As 700 linhas só entram na página na primeira vez que o painel abre
	let jaAbriu = $state(false);
	$effect(() => {
		if (aberto) jaAbriu = true;
	});

	const motivo = $derived(simulador.ligado ? simulador.telemetria.motivo : '');
	const linhaAtiva = $derived(linhasDosMotivos.get(motivo) ?? 0);

	function irPara(linha: number) {
		rolagem
			?.querySelector(`[data-linha="${linha}"]`)
			?.scrollIntoView({ block: 'center', behavior: 'smooth' });
	}

	function aoEscolherFuncao(evento: Event & { currentTarget: HTMLSelectElement }) {
		const linha = Number(evento.currentTarget.value);
		if (linha > 0) irPara(linha);
		evento.currentTarget.value = '';
	}
</script>

<svelte:window onkeydown={(evento) => aberto && evento.key === 'Escape' && aoFechar()} />

<button
	type="button"
	class="fundo"
	class:aberto
	aria-label="Fechar o código"
	tabindex="-1"
	onclick={aoFechar}
></button>

<aside class="codigo" class:aberto aria-label="Código do firmware" inert={!aberto}>
	<header>
		<div class="titulo">
			<h2>sketch.ino</h2>
			<p>Firmware do ESP32 · {linhas.length} linhas</p>
		</div>
		<button type="button" class="fechar" aria-label="Fechar o código" onclick={aoFechar}>
			<Icone nome="fechar" />
		</button>
	</header>

	<div class="barra">
		<label class="funcoes">
			<span class="kicker">Ir para</span>
			<select onchange={aoEscolherFuncao} aria-label="Ir para a função">
				<option value="">Escolha uma função…</option>
				{#each funcoes as funcao (funcao.linha)}
					<option value={funcao.linha}>{funcao.nome}()</option>
				{/each}
			</select>
		</label>
		{#if linhaAtiva > 0}
			<button type="button" class="decisao" onclick={() => irPara(linhaAtiva)}>
				<span class="ponto"></span>
				Decisão atual: {ROTULO_MOTIVO[motivo] ?? motivo} · linha {linhaAtiva}
			</button>
		{/if}
	</div>

	<div class="rolagem" bind:this={rolagem}>
		{#if jaAbriu}
			<div class="fonte">
				{#each linhas as tokens, indice (indice)}
					<div class="linha" class:ativa={indice + 1 === linhaAtiva} data-linha={indice + 1}>
						<span class="n">{indice + 1}</span>
						<span class="t"
							>{#each tokens as token, i (i)}{#if token.tipo}<span class="t-{token.tipo}"
										>{token.texto}</span
									>{:else}{token.texto}{/if}{/each}</span
						>
					</div>
				{/each}
			</div>
		{/if}
	</div>
</aside>

<style>
	.codigo {
		position: fixed;
		z-index: 30;
		right: 0;
		bottom: 0;
		left: 0;
		display: grid;
		grid-template-rows: auto auto minmax(0, 1fr);
		height: 92dvh;
		border-radius: 1.25rem 1.25rem 0 0;
		background: var(--secondary-950);
		color: var(--secondary-100);
		box-shadow: 0 -12px 40px rgb(22 35 14 / 0.35);
		transform: translateY(100%);
		visibility: hidden;
		transition:
			transform 420ms var(--ease-gaveta),
			visibility 0s 420ms;
	}

	.codigo.aberto {
		transform: none;
		visibility: visible;
		transition: transform 420ms var(--ease-gaveta);
	}

	.fundo {
		position: fixed;
		z-index: 29;
		inset: 0;
		border: 0;
		background: rgb(22 35 14 / 0.45);
		opacity: 0;
		pointer-events: none;
		transition: opacity 300ms;
	}

	.fundo.aberto {
		opacity: 1;
		pointer-events: auto;
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.875rem 0.875rem 0.5rem 1.125rem;
	}

	h2 {
		color: var(--branco);
		font: 700 1rem/1.2 var(--fonte-codigo);
	}

	.titulo p {
		color: var(--secondary-400);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.fechar {
		display: grid;
		width: 2.75rem;
		height: 2.75rem;
		place-items: center;
		border: 0;
		border-radius: 50%;
		background: rgb(255 255 255 / 0.08);
		color: var(--branco);
	}

	.barra {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem 0.75rem;
		padding: 0 1.125rem 0.75rem;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
	}

	.funcoes {
		display: flex;
		flex: 1 1 14rem;
		align-items: center;
		gap: 0.5rem;
	}

	.funcoes .kicker {
		flex-shrink: 0;
		color: var(--secondary-400);
	}

	select {
		width: 100%;
		min-height: 2.5rem;
		padding: 0 0.75rem;
		border: 1px solid rgb(255 255 255 / 0.16);
		border-radius: 999px;
		background: var(--secondary-900);
		color: var(--branco);
		/* 16px: abaixo disso o iOS dá zoom na página ao focar */
		font: 600 1rem var(--fonte);
	}

	.decisao {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		min-height: 2.5rem;
		padding: 0 0.875rem;
		border: 0;
		border-radius: 999px;
		background: var(--primary-500);
		color: var(--secondary-950);
		font-size: 0.8125rem;
		font-weight: 800;
		text-align: left;
	}

	.ponto {
		flex-shrink: 0;
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 50%;
		background: var(--secondary-950);
	}

	.rolagem {
		min-height: 0;
		overflow: auto;
		overscroll-behavior: contain;
		padding-bottom: max(1rem, env(safe-area-inset-bottom));
	}

	.fonte {
		padding: 0.5rem 0;
		font: 500 0.75rem/1.6 var(--fonte-codigo);
		font-variant-ligatures: none;
		tab-size: 2;
	}

	.linha {
		display: grid;
		grid-template-columns: 3rem minmax(0, 1fr);
		padding-right: 0.75rem;
		border-left: 3px solid transparent;
	}

	.linha.ativa {
		border-left-color: var(--primary-500);
		background: rgb(114 192 0 / 0.16);
	}

	.n {
		padding-right: 0.75rem;
		color: var(--secondary-600);
		text-align: right;
		-webkit-user-select: none;
		user-select: none;
	}

	/* No celular as linhas quebram, para ler sem rolar para os lados */
	.t {
		white-space: pre-wrap;
		overflow-wrap: anywhere;
	}

	.t :global(.t-comentario) {
		color: var(--secondary-500);
		font-style: italic;
	}
	.t :global(.t-texto) {
		color: var(--primary-200);
	}
	.t :global(.t-numero) {
		color: var(--atencao-marca);
	}
	.t :global(.t-reservada) {
		color: var(--primary-400);
		font-weight: 700;
	}
	.t :global(.t-tipo) {
		color: var(--primary-300);
	}
	.t :global(.t-diretiva) {
		color: #ff9a8f;
	}
	.t :global(.t-funcao) {
		color: var(--branco);
		font-weight: 700;
	}
	.t :global(.t-constante) {
		color: #e9d98a;
	}
	.t :global(.t-arduino) {
		color: #7fd0c0;
	}

	@media (min-width: 64rem) {
		.fundo {
			display: none;
		}

		/* Coluna ao lado do painel: entra no fluxo da grade da página */
		.codigo {
			position: static;
			display: none;
			height: auto;
			min-height: 0;
			border-radius: 1.5rem;
			box-shadow: none;
			transform: none;
			transition: none;
		}

		.codigo.aberto {
			display: grid;
		}

		.fonte {
			font-size: 0.8125rem;
		}

		.t {
			white-space: pre;
			overflow-wrap: normal;
		}

		.linha {
			grid-template-columns: 3.25rem max-content;
		}
	}
</style>
