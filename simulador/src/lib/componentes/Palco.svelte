<script lang="ts">
	// Palco: o dispositivo em 3D ou o esquema 2D do circuito e, logo abaixo, uma faixa com os
	// atuadores (LCD, LEDs, buzzer) e a chave liga/desliga, legível no celular em qualquer vista.
	import { camera } from '../sensores/camera.svelte.ts';
	import { ROTULO_ESTADO, ROTULO_MOTIVO } from '../rotulos.ts';
	import { simulador } from '../simulador.svelte.ts';
	import { ROTULO_CLASSE } from '../visao/tipos.ts';
	import { visao } from '../visao/visao.svelte.ts';
	import Cena3D from './Cena3D.svelte';
	import Esquema2D from './Esquema2D.svelte';
	import Icone from './Icone.svelte';

	const VISTAS = [
		{ id: 'traseira', nome: 'Display' },
		{ id: 'frontal', nome: 'Câmera' },
		{ id: 'explodida', nome: 'Interno' },
		{ id: 'circuito', nome: 'Circuito' }
	] as const;
	type Vista = (typeof VISTAS)[number]['id'];

	let cena = $state<ReturnType<typeof Cena3D>>();
	let vista = $state<Vista>('traseira');
	let cameraAmpliada = $state(false);

	const estado = $derived(simulador.estado);
	const cameraAtiva = $derived(camera.estado === 'ativo');
	const leds = $derived([
		{ nome: 'verde', aceso: simulador.leds.verde, cor: '#72c000' },
		{ nome: 'amarelo', aceso: simulador.leds.amarelo, cor: '#e8bf1a' },
		{ nome: 'vermelho', aceso: simulador.leds.vermelho, cor: '#e0392b' },
		{ nome: 'azul', aceso: simulador.leds.azul, cor: '#3d7bff' }
	]);
	const tocando = $derived(simulador.buzzer && !simulador.pausado);

	function mostrar(nova: Vista) {
		vista = nova;
		if (nova === 'circuito') return;
		cena?.definirExplosao(nova === 'explodida');
		cena?.irPara(nova);
	}
</script>

<section
	class="palco"
	data-estado={simulador.ligado ? estado : 'DESLIGADO'}
	aria-label="Dispositivo"
>
	<div class="cena">
		<!-- O modelo 3D continua montado atrás do circuito: recriar o WebGL a cada troca é caro -->
		<div class="camada" class:oculta={vista === 'circuito'}>
			<Cena3D bind:this={cena} />
		</div>
		{#if vista === 'circuito'}
			<Esquema2D />
		{/if}

		{#if simulador.ligado}
			<div class="estado" role="status">
				<span class="ponto"></span>
				<span class="nome">{ROTULO_ESTADO[estado]}</span>
				<span class="motivo">{ROTULO_MOTIVO[simulador.telemetria.motivo] ?? ''}</span>
			</div>
		{:else}
			<button type="button" class="botao destaque ligar" onclick={() => simulador.ligar()}>
				<Icone nome="energia" />
				Ligar o dispositivo
			</button>
		{/if}

		{#if cameraAtiva}
			<button
				type="button"
				class="visor"
				class:ampliado={cameraAmpliada}
				class:flash={simulador.leds.azul}
				aria-label={cameraAmpliada ? 'Reduzir a imagem da câmera' : 'Ampliar a imagem da câmera'}
				onclick={() => (cameraAmpliada = !cameraAmpliada)}
			>
				<span class="imagem" class:espelhada={camera.frontal}>
					<video {@attach camera.conectar} playsinline muted autoplay></video>
					{#each visao.deteccoes as deteccao, i (i)}
						<span
							class="caixa"
							data-classe={deteccao.classe}
							style:left="{deteccao.x * 100}%"
							style:top="{deteccao.y * 100}%"
							style:width="{deteccao.largura * 100}%"
							style:height="{deteccao.altura * 100}%"
						>
							<span
								>{ROTULO_CLASSE[deteccao.classe] ?? deteccao.classe}
								{Math.round(deteccao.confianca * 100)}%</span
							>
						</span>
					{/each}
				</span>
				<span class="legenda">OV2640 · {visao.estado === 'ativo' ? 'IA ligada' : 'ao vivo'}</span>
			</button>
		{/if}

		<div class="vistas" role="group" aria-label="Vista do dispositivo">
			{#each VISTAS as item (item.id)}
				<button
					type="button"
					class:ativo={vista === item.id}
					aria-pressed={vista === item.id}
					onclick={() => mostrar(item.id)}
				>
					{item.nome}
				</button>
			{/each}
		</div>
	</div>

	<div class="faixa">
		<div class="lcd" class:apagado={!simulador.ligado} aria-label="Display LCD 16x2">
			<span>{simulador.lcd[0] || ' '}</span>
			<span>{simulador.lcd[1] || ' '}</span>
		</div>

		<ul class="leds" aria-label="LEDs de estado">
			{#each leds as led (led.nome)}
				<li
					class:aceso={led.aceso}
					style:--cor={led.cor}
					aria-label="LED {led.nome}: {led.aceso ? 'aceso' : 'apagado'}"
				></li>
			{/each}
		</ul>

		<span class="buzzer" class:tocando aria-label="Buzzer: {tocando ? 'tocando' : 'em silêncio'}">
			<Icone nome="som" tamanho={18} />
		</span>

		<button
			type="button"
			class="energia"
			role="switch"
			aria-checked={simulador.ligado}
			aria-label="Chave liga/desliga do dispositivo"
			onclick={() => simulador.alternarEnergia()}
		>
			<span class="alavanca"><Icone nome="energia" tamanho={14} /></span>
		</button>
	</div>
</section>

<style>
	.palco {
		--cor-estado: var(--secondary-300);
		display: grid;
		grid-template-rows: minmax(0, 1fr) auto;
		min-height: 0;
		overflow: hidden;
		background: var(--secondary-950);
	}

	.palco[data-estado='NORMAL'] {
		--cor-estado: var(--primary-500);
	}
	.palco[data-estado='ATENCAO'] {
		--cor-estado: var(--atencao-marca);
	}
	.palco[data-estado='CRITICO'] {
		--cor-estado: var(--critico);
	}
	.palco[data-estado='FALHA'] {
		--cor-estado: var(--falha);
	}

	.cena {
		position: relative;
		min-height: 0;
		overflow: hidden;
		background: radial-gradient(120% 90% at 50% 35%, #ffffff 0%, #eef3ea 60%, #e2eadc 100%);
		/* Moldura na cor do estado: dá para perceber a mudança sem ler nada */
		box-shadow: inset 0 0 0 3px color-mix(in srgb, var(--cor-estado) 60%, transparent);
		transition: box-shadow 300ms var(--ease-saida);
	}

	.palco[data-estado='DESLIGADO'] .cena {
		box-shadow: none;
	}

	.camada {
		position: absolute;
		inset: 0;
	}

	.camada.oculta {
		visibility: hidden;
	}

	.estado {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
		display: flex;
		align-items: center;
		gap: 0.5rem;
		max-width: calc(100% - 9rem);
		padding: 0.375rem 0.75rem 0.375rem 0.625rem;
		border-radius: 999px;
		background: var(--secondary-950);
		color: var(--branco);
		font-size: 0.8125rem;
		box-shadow: 0 4px 14px rgb(22 35 14 / 0.2);
	}

	.ponto {
		flex-shrink: 0;
		width: 0.625rem;
		height: 0.625rem;
		border-radius: 50%;
		background: var(--cor-estado);
	}

	.palco[data-estado='CRITICO'] .ponto,
	.palco[data-estado='FALHA'] .ponto {
		animation: pulsar 1s steps(2, jump-none) infinite;
	}

	@keyframes pulsar {
		50% {
			opacity: 0.25;
		}
	}

	.nome {
		font-weight: 800;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.motivo {
		overflow: hidden;
		color: var(--secondary-300);
		font-weight: 600;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.ligar {
		position: absolute;
		top: 0.75rem;
		left: 0.75rem;
		min-height: 2.75rem;
		font-weight: 800;
		box-shadow: 0 8px 22px rgb(114 192 0 / 0.35);
	}

	.visor {
		position: absolute;
		top: 0.75rem;
		right: 0.75rem;
		width: 6.5rem;
		min-height: 3rem;
		padding: 0;
		overflow: hidden;
		border: 2px solid var(--secondary-950);
		border-radius: var(--raio-menor);
		background: var(--secondary-950);
		box-shadow: 0 6px 16px rgb(22 35 14 / 0.3);
		transition: width 260ms var(--ease-gaveta);
	}

	.visor.ampliado {
		width: min(62%, 20rem);
	}

	/* A imagem inteira aparece, sem corte: as caixas do detector usam frações do quadro */
	.imagem {
		position: relative;
		display: block;
	}

	.imagem.espelhada {
		transform: scaleX(-1);
	}

	.visor video {
		display: block;
		width: 100%;
		height: auto;
	}

	.caixa {
		--cor: #e39a0f;
		position: absolute;
		border: 2px solid var(--cor);
		border-radius: 3px;
		box-sizing: border-box;
	}

	.caixa[data-classe='alagamento'] {
		--cor: #3d7bff;
	}
	.caixa[data-classe='buraco'] {
		--cor: #e0392b;
	}

	/* O rótulo só cabe com a imagem ampliada */
	.caixa span {
		display: none;
		position: absolute;
		top: 0;
		left: 0;
		padding: 0 0.25rem;
		background: var(--cor);
		color: var(--branco);
		font-size: 0.625rem;
		font-weight: 800;
		white-space: nowrap;
	}

	.visor.ampliado .caixa span {
		display: block;
	}

	.imagem.espelhada .caixa span {
		transform: scaleX(-1);
	}

	/* Flash: acompanha o LED azul da câmera */
	.visor.flash {
		border-color: #3d7bff;
		box-shadow: 0 0 0 4px rgb(61 123 255 / 0.45);
	}

	.visor.flash video {
		filter: brightness(1.6);
	}

	.legenda {
		position: absolute;
		right: 0;
		bottom: 0;
		left: 0;
		padding: 0.125rem 0.375rem;
		background: rgb(22 35 14 / 0.7);
		color: var(--branco);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.04em;
		text-align: left;
	}

	.vistas {
		position: absolute;
		bottom: 0.75rem;
		left: 0.75rem;
		display: flex;
		padding: 3px;
		border-radius: 999px;
		background: rgb(255 255 255 / 0.88);
		box-shadow: 0 2px 10px rgb(22 35 14 / 0.12);
		backdrop-filter: blur(6px);
	}

	.vistas button {
		min-height: 2rem;
		padding: 0 0.625rem;
		border: 0;
		border-radius: 999px;
		background: transparent;
		color: var(--secondary-800);
		font-size: 0.8125rem;
		font-weight: 700;
		white-space: nowrap;
	}

	.vistas button.ativo {
		background: var(--secondary-950);
		color: var(--branco);
	}

	/* Faixa do painel do dispositivo: o que o firmware mostra agora e a chave liga/desliga */
	.faixa {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 0.75rem;
	}

	.lcd {
		display: grid;
		min-width: 17ch;
		padding: 0.25rem 0.5rem;
		border-radius: 0.375rem;
		background: linear-gradient(#b4d84a, #93c02f);
		color: #16260a;
		font: 700 0.8125rem/1.25 var(--fonte-codigo);
		font-variant-ligatures: none;
		letter-spacing: 0.04em;
		white-space: pre;
	}

	.lcd.apagado {
		background: #3d4a35;
	}

	.leds {
		display: flex;
		gap: 0.4375rem;
		margin: 0 0 0 auto;
		padding: 0;
		list-style: none;
	}

	.leds li {
		width: 0.8125rem;
		height: 0.8125rem;
		border-radius: 50%;
		background: color-mix(in srgb, var(--cor) 28%, #16230e);
		box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.12);
	}

	.leds li.aceso {
		background: var(--cor);
		box-shadow:
			0 0 10px 2px var(--cor),
			inset 0 0 0 1px rgb(255 255 255 / 0.4);
	}

	.buzzer {
		display: grid;
		flex-shrink: 0;
		width: 1.75rem;
		height: 1.75rem;
		place-items: center;
		border-radius: 50%;
		color: var(--secondary-600);
	}

	.buzzer.tocando {
		background: var(--critico);
		color: var(--branco);
	}

	/* Chave liga/desliga: a mesma do modelo 3D e do circuito */
	.energia {
		position: relative;
		flex-shrink: 0;
		width: 3.25rem;
		height: 2rem;
		padding: 0;
		border: 0;
		border-radius: 999px;
		background: var(--secondary-700);
		transition: background-color 200ms var(--ease-saida);
	}

	.energia[aria-checked='true'] {
		background: var(--primary-500);
	}

	.alavanca {
		position: absolute;
		top: 3px;
		left: 3px;
		display: grid;
		width: 1.625rem;
		height: 1.625rem;
		place-items: center;
		border-radius: 50%;
		background: var(--branco);
		color: var(--secondary-950);
		box-shadow: 0 1px 4px rgb(22 35 14 / 0.4);
		transition: transform 200ms var(--ease-saida);
	}

	.energia[aria-checked='true'] .alavanca {
		transform: translateX(1.25rem);
	}

	.energia:focus-visible {
		outline-color: var(--branco);
	}

	@media (min-width: 64rem) {
		.palco {
			border-radius: 1.5rem;
		}

		.faixa {
			gap: 0.875rem;
			padding: 0.75rem 1rem;
		}

		.lcd {
			font-size: 1rem;
		}

		.vistas button {
			padding: 0 0.75rem;
		}
	}
</style>
