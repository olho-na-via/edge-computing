<script lang="ts" generics="Valor extends string">
	// Controle segmentado: escolhe uma entre poucas opções (ex.: Celular | Simulado).
	interface Props {
		rotulo: string;
		opcoes: { valor: Valor; texto: string }[];
		valor: Valor;
		aoMudar: (valor: Valor) => void;
		/** Mostra a opção como "em andamento" (ex.: aguardando a permissão do navegador). */
		ocupado?: boolean;
	}

	let { rotulo, opcoes, valor, aoMudar, ocupado = false }: Props = $props();
</script>

<div class="alternador" role="radiogroup" aria-label={rotulo} aria-busy={ocupado}>
	{#each opcoes as opcao (opcao.valor)}
		<button
			type="button"
			role="radio"
			aria-checked={opcao.valor === valor}
			class:ativo={opcao.valor === valor}
			disabled={ocupado}
			onclick={() => opcao.valor !== valor && aoMudar(opcao.valor)}
		>
			{opcao.texto}
		</button>
	{/each}
</div>

<style>
	.alternador {
		display: inline-flex;
		flex-shrink: 0;
		padding: 3px;
		border-radius: 999px;
		background: var(--secondary-100);
	}

	button {
		min-height: 2rem;
		padding: 0 0.75rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--secondary-800);
		font-size: 0.8125rem;
		font-weight: 700;
		white-space: nowrap;
		transition:
			background-color 180ms var(--ease-saida),
			color 180ms;
	}

	button.ativo {
		background: var(--secondary-950);
		color: var(--branco);
	}

	button:disabled {
		opacity: 0.6;
	}
</style>
