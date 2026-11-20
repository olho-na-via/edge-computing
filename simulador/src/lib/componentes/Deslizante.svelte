<script lang="ts">
	// Controle deslizante com o valor à vista e as marcas dos limites de decisão do firmware.
	interface Props {
		rotulo: string;
		valor: number;
		minimo: number;
		maximo: number;
		passo?: number;
		unidade?: string;
		casas?: number;
		/** Limites do firmware mostrados sob a trilha (ex.: 0,4 g = atenção). */
		marcas?: { valor: number; texto: string }[];
		aoMudar: (valor: number) => void;
	}

	let {
		rotulo,
		valor,
		minimo,
		maximo,
		passo = 1,
		unidade = '',
		casas = 0,
		marcas = [],
		aoMudar
	}: Props = $props();

	const posicao = (v: number) => ((v - minimo) / (maximo - minimo)) * 100;
</script>

<label class="deslizante">
	<span class="cabecalho">
		<span>{rotulo}</span>
		<output class="numero">{valor.toFixed(casas).replace('.', ',')}{unidade}</output>
	</span>
	<input
		type="range"
		min={minimo}
		max={maximo}
		step={passo}
		value={valor}
		style:--preenchido="{posicao(valor)}%"
		oninput={(evento) => aoMudar(Number(evento.currentTarget.value))}
	/>
	{#if marcas.length > 0}
		<span class="marcas" aria-hidden="true">
			{#each marcas as marca (marca.valor)}
				<span style:left="{posicao(marca.valor)}%">{marca.texto}</span>
			{/each}
		</span>
	{/if}
</label>

<style>
	.deslizante {
		display: grid;
		gap: 0.25rem;
	}

	.cabecalho {
		display: flex;
		align-items: baseline;
		justify-content: space-between;
		font-size: 0.9375rem;
		font-weight: 600;
	}

	output {
		font-weight: 800;
	}

	input {
		width: 100%;
		height: 2rem;
		margin: 0;
		background: transparent;
		appearance: none;
		-webkit-appearance: none;
		touch-action: pan-y;
	}

	input::-webkit-slider-runnable-track {
		height: 0.5rem;
		border-radius: 999px;
		background: linear-gradient(
			to right,
			var(--primary-500) var(--preenchido),
			var(--secondary-200) var(--preenchido)
		);
	}

	input::-moz-range-track {
		height: 0.5rem;
		border-radius: 999px;
		background: var(--secondary-200);
	}

	input::-moz-range-progress {
		height: 0.5rem;
		border-radius: 999px;
		background: var(--primary-500);
	}

	input::-webkit-slider-thumb {
		width: 1.5rem;
		height: 1.5rem;
		margin-top: -0.5rem;
		border: 3px solid var(--branco);
		border-radius: 50%;
		background: var(--secondary-950);
		box-shadow: 0 1px 4px rgb(22 35 14 / 0.35);
		appearance: none;
		-webkit-appearance: none;
	}

	input::-moz-range-thumb {
		width: 1.125rem;
		height: 1.125rem;
		border: 3px solid var(--branco);
		border-radius: 50%;
		background: var(--secondary-950);
		box-shadow: 0 1px 4px rgb(22 35 14 / 0.35);
	}

	.marcas {
		position: relative;
		height: 1rem;
		/* As marcas seguem o centro do botão, que não chega às pontas da trilha */
		margin: 0 0.75rem;
	}

	.marcas span {
		position: absolute;
		transform: translateX(-50%);
		padding-top: 0.25rem;
		color: var(--secondary-700);
		font-size: 0.6875rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.marcas span::before {
		content: '';
		position: absolute;
		top: -0.125rem;
		left: 50%;
		width: 1.5px;
		height: 0.375rem;
		background: var(--secondary-500);
	}
</style>
