<script lang="ts">
	// Telemetria: o que o firmware mediu (já com a média móvel) e o nível dos pinos de saída.
	import {
		BATERIA_MINIMA,
		CAMERA_ATENCAO,
		CAMERA_CRITICO,
		IMPACTO_ATENCAO,
		IMPACTO_CRITICO,
		LUZ_MINIMA,
		TAMANHO_FILA
	} from '../firmware/firmware.ts';
	import { ROTULO_ESTADO, ROTULO_MOTIVO, formatarTempo } from '../rotulos.ts';
	import { simulador } from '../simulador.svelte.ts';
	import { ROTULOS_CAMERA } from '../visao/tipos.ts';

	const t = $derived(simulador.telemetria);
	const decimal = (valor: number, casas: number) => valor.toFixed(casas).replace('.', ',');

	type Nivel = 'ok' | 'atencao' | 'critico';
	const nivelImpacto = $derived<Nivel>(
		t.impacto >= IMPACTO_CRITICO ? 'critico' : t.impacto >= IMPACTO_ATENCAO ? 'atencao' : 'ok'
	);
	// O que a câmera está vendo, segundo o firmware (já com a validade de 3 s)
	const vistos = $derived(
		t.visto
			.map((confianca, indice) => ({ nome: ROTULOS_CAMERA[indice], confianca }))
			.filter((item) => item.confianca > 0)
	);
	const nivelCamera = $derived.by<Nivel>(() => {
		const maior = Math.max(0, ...t.visto);
		return maior >= CAMERA_CRITICO ? 'critico' : maior >= CAMERA_ATENCAO ? 'atencao' : 'ok';
	});

	const pinos = $derived([
		{ gpio: 19, nome: 'LED verde', alto: simulador.leds.verde, cor: 'var(--primary-500)' },
		{ gpio: 18, nome: 'LED amarelo', alto: simulador.leds.amarelo, cor: 'var(--atencao-marca)' },
		{ gpio: 5, nome: 'LED vermelho', alto: simulador.leds.vermelho, cor: 'var(--critico)' },
		{ gpio: 17, nome: 'LED azul (câmera)', alto: simulador.leds.azul, cor: 'var(--azul)' },
		{ gpio: 16, nome: 'Buzzer (1 kHz)', alto: simulador.buzzer, cor: 'var(--secondary-950)' },
		// A chave para cima deixa o pino solto: o pull-up interno mantém HIGH
		{ gpio: 25, nome: 'Chave liga/desliga', alto: simulador.ligado, cor: 'var(--secondary-950)' }
	]);
</script>

{#if !simulador.ligado}
	<p class="vazio">Ligue o dispositivo para ver a telemetria.</p>
{:else}
	<div class="telemetria">
		<div class="resumo" data-estado={t.estado}>
			<div>
				<p class="kicker">Estado da via</p>
				<p class="estado">{ROTULO_ESTADO[t.estado]}</p>
				<p class="motivo">{ROTULO_MOTIVO[t.motivo] ?? t.motivo}</p>
			</div>
			<div class="relogio">
				<p class="kicker">Ligado há</p>
				<p class="numero">{formatarTempo(t.tempo)}</p>
			</div>
			{#if t.estadoLido !== t.estado}
				<p class="pendente">
					As leituras indicam {ROTULO_ESTADO[t.estadoLido]}: o estado só muda após 3 leituras
					iguais.
				</p>
			{/if}
		</div>

		<dl class="medidas numero">
			<div data-nivel={nivelImpacto}>
				<dt>Impacto</dt>
				<dd>{decimal(t.impacto, 2)} <small>g</small></dd>
			</div>
			<div class="larga" data-nivel={nivelCamera}>
				<dt>Câmera (visão computacional)</dt>
				<dd class="posicao">
					{#each vistos as item, i (item.nome)}{i > 0 ? ' · ' : ''}{item.nome}
						{item.confianca}%{:else}Nada à vista{/each}
				</dd>
			</div>
			<div data-nivel={t.luz < LUZ_MINIMA ? 'atencao' : 'ok'}>
				<dt>Luz</dt>
				<dd>{t.luz.toFixed(0)} <small>%</small></dd>
			</div>
			<div data-nivel={t.bateria < BATERIA_MINIMA ? 'critico' : 'ok'}>
				<dt>Bateria</dt>
				<dd>{t.bateria} <small>%</small></dd>
			</div>
			<div>
				<dt>Giro (eixo Z)</dt>
				<dd>{decimal(t.giroscopio, 1)} <small>°/s</small></dd>
			</div>
			<div>
				<dt>Inclinação</dt>
				<dd>{t.inclinacao.toFixed(0)} <small>°</small></dd>
			</div>
			<div>
				<dt>Velocidade</dt>
				<dd>{decimal(t.velocidade, 1)} <small>km/h</small></dd>
			</div>
			<div>
				<dt>Temperatura</dt>
				<dd>{decimal(t.temperatura, 1)} <small>°C</small></dd>
			</div>
			<div class="larga" data-nivel={t.gpsComSinal ? 'ok' : 'critico'}>
				<dt>Posição {t.gpsComSinal ? '' : '(sem sinal: última conhecida)'}</dt>
				<dd class="posicao">{t.latitude.toFixed(6)}, {t.longitude.toFixed(6)}</dd>
			</div>
			<div class="larga" data-nivel={t.online ? 'ok' : 'atencao'}>
				<dt>Broker MQTT</dt>
				<dd class="posicao">
					{t.online ? 'Online' : 'Offline'} · fila {t.fila.length}/{TAMANHO_FILA}
				</dd>
			</div>
		</dl>

		<div>
			<p class="kicker">Pinos do ESP32</p>
			<ul class="pinos">
				{#each pinos as pino (pino.gpio)}
					<li>
						<span class="led" class:aceso={pino.alto} style:--cor={pino.cor}></span>
						<span class="gpio numero">GPIO {pino.gpio}</span>
						<span class="nome">{pino.nome}</span>
						<span class="nivel" class:alto={pino.alto}>{pino.alto ? 'HIGH' : 'LOW'}</span>
					</li>
				{/each}
			</ul>
		</div>
	</div>
{/if}

<style>
	.vazio {
		padding: 2rem 1rem;
		color: var(--secondary-700);
		font-weight: 600;
		text-align: center;
	}

	.telemetria {
		display: grid;
		gap: 0.875rem;
	}

	.resumo {
		--cor: var(--ok);
		--fundo: var(--ok-fundo);
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem 1rem;
		padding: 0.875rem;
		border-radius: var(--raio);
		background: var(--fundo);
	}

	.resumo[data-estado='ATENCAO'] {
		--cor: var(--atencao);
		--fundo: var(--atencao-fundo);
	}
	.resumo[data-estado='CRITICO'] {
		--cor: var(--critico);
		--fundo: var(--critico-fundo);
	}
	.resumo[data-estado='FALHA'] {
		--cor: var(--falha);
		--fundo: var(--falha-fundo);
	}

	.estado {
		color: var(--cor);
		font-size: 1.75rem;
		font-weight: 900;
		line-height: 1.1;
		letter-spacing: -0.01em;
	}

	.motivo {
		font-size: 0.9375rem;
		font-weight: 700;
	}

	.relogio {
		text-align: right;
	}

	.relogio .numero {
		font-size: 1.125rem;
		font-weight: 800;
	}

	.pendente {
		grid-column: 1 / -1;
		color: var(--secondary-800);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.medidas {
		display: grid;
		grid-template-columns: repeat(2, minmax(0, 1fr));
		gap: 0.5rem;
		margin: 0;
	}

	.medidas div {
		padding: 0.625rem 0.75rem;
		border: 1px solid var(--secondary-100);
		border-left: 4px solid var(--secondary-200);
		border-radius: var(--raio-menor);
		background: var(--branco);
	}

	.medidas div[data-nivel='ok'] {
		border-left-color: var(--primary-500);
	}
	.medidas div[data-nivel='atencao'] {
		border-left-color: var(--atencao-marca);
	}
	.medidas div[data-nivel='critico'] {
		border-left-color: var(--critico);
	}

	.medidas .larga {
		grid-column: 1 / -1;
	}

	dt {
		color: var(--secondary-700);
		font-size: 0.75rem;
		font-weight: 700;
	}

	dd {
		margin: 0;
		font-size: 1.375rem;
		font-weight: 800;
		line-height: 1.2;
	}

	dd small {
		color: var(--secondary-700);
		font-size: 0.8125rem;
		font-weight: 700;
	}

	dd.posicao {
		font-size: 1rem;
	}

	.pinos {
		display: grid;
		margin: 0.375rem 0 0;
		padding: 0;
		border: 1px solid var(--secondary-100);
		border-radius: var(--raio-menor);
		background: var(--branco);
		list-style: none;
	}

	.pinos li {
		display: grid;
		grid-template-columns: auto 4.25rem 1fr auto;
		align-items: center;
		gap: 0.625rem;
		padding: 0.5rem 0.75rem;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.pinos li + li {
		border-top: 1px solid var(--secondary-100);
	}

	.led {
		width: 0.75rem;
		height: 0.75rem;
		border: 1.5px solid var(--secondary-300);
		border-radius: 50%;
	}

	.led.aceso {
		border-color: var(--cor);
		background: var(--cor);
		box-shadow: 0 0 8px var(--cor);
	}

	.gpio {
		font-family: var(--fonte-codigo);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.nivel {
		color: var(--secondary-600);
		font-family: var(--fonte-codigo);
		font-size: 0.75rem;
		font-weight: 700;
	}

	.nivel.alto {
		color: var(--ok);
	}
</style>
