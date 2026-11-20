<script lang="ts">
	// Cartão de um componente do circuito: nome, o que faz, de onde vem a leitura e os controles.
	import type { Snippet } from 'svelte';

	interface Props {
		/** Nome do componente no circuito (ex.: "MPU-6050"). */
		titulo: string;
		/** O que ele mede ou faz. */
		papel: string;
		/** Mensagem do sensor do celular (permissão negada, sensor ausente...). */
		erro?: string;
		/** Controle à direita do título, em geral o alternador Celular | Simulado. */
		fonte?: Snippet;
		children: Snippet;
	}

	let { titulo, papel, erro = '', fonte, children }: Props = $props();
</script>

<section class="cartao">
	<header>
		<div>
			<h3>{titulo}</h3>
			<p>{papel}</p>
		</div>
		{@render fonte?.()}
	</header>
	{#if erro}
		<p class="erro" role="alert">{erro}</p>
	{/if}
	{@render children()}
</section>

<style>
	.cartao {
		display: grid;
		gap: 0.625rem;
		padding: 0.875rem;
		border: 1px solid var(--secondary-100);
		border-radius: var(--raio);
		background: var(--branco);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}

	h3 {
		font-size: 1rem;
		font-weight: 800;
		line-height: 1.2;
	}

	header p {
		color: var(--secondary-700);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.erro {
		padding: 0.5rem 0.75rem;
		border-radius: var(--raio-menor);
		background: var(--atencao-fundo);
		color: var(--atencao);
		font-size: 0.8125rem;
		font-weight: 700;
	}
</style>
