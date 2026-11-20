<script lang="ts">
	// Chave liga/desliga, como as chaves deslizantes do circuito no Wokwi.
	interface Props {
		rotulo: string;
		ligada: boolean;
		aoMudar: (ligada: boolean) => void;
		desativada?: boolean;
	}

	let { rotulo, ligada, aoMudar, desativada = false }: Props = $props();
</script>

<label class="chave" class:desativada>
	<span>{rotulo}</span>
	<input
		type="checkbox"
		role="switch"
		checked={ligada}
		disabled={desativada}
		onchange={(evento) => aoMudar(evento.currentTarget.checked)}
	/>
	<span class="trilho" aria-hidden="true"></span>
</label>

<style>
	.chave {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		min-height: 2.75rem;
		font-size: 0.9375rem;
		font-weight: 600;
		cursor: pointer;
		-webkit-user-select: none;
		user-select: none;
	}

	.chave.desativada {
		opacity: 0.5;
		cursor: not-allowed;
	}

	input {
		position: absolute;
		opacity: 0;
		pointer-events: none;
	}

	.trilho {
		position: relative;
		flex-shrink: 0;
		width: 2.75rem;
		height: 1.625rem;
		border-radius: 999px;
		background: var(--secondary-300);
		transition: background-color 200ms var(--ease-saida);
	}

	.trilho::after {
		content: '';
		position: absolute;
		top: 3px;
		left: 3px;
		width: 1.25rem;
		height: 1.25rem;
		border-radius: 50%;
		background: var(--branco);
		box-shadow: 0 1px 3px rgb(22 35 14 / 0.3);
		transition: transform 200ms var(--ease-saida);
	}

	input:checked + .trilho {
		background: var(--primary-600);
	}

	input:checked + .trilho::after {
		transform: translateX(1.125rem);
	}

	input:focus-visible + .trilho {
		outline: 2px solid var(--primary-600);
		outline-offset: 2px;
	}
</style>
