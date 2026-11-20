<script lang="ts">
	// Eventos: o que chegou ao broker MQTT (simulado nesta aba) e o que espera na fila offline.
	import { TAMANHO_FILA, TOPICO_DADOS } from '../firmware/firmware.ts';
	import { ROTULO_EVENTO, ROTULO_MOTIVO, formatarTempo } from '../rotulos.ts';
	import { lerUltraLight, simulador } from '../simulador.svelte.ts';

	// Mais recentes primeiro; a telemetria periódica aparece só como contagem
	const eventos = $derived(
		simulador.mensagens
			.filter((m) => m.topico === TOPICO_DADOS && m.campos.ev !== 'telemetria')
			.reverse()
	);
	const telemetrias = $derived(simulador.mensagens.filter((m) => m.campos.ev === 'telemetria'));
	const fila = $derived(simulador.telemetria.fila.map((conteudo) => lerUltraLight(conteudo)));
	const fotoDe = (nome: string, partida: number) =>
		simulador.fotos.find((foto) => foto.nome === nome && foto.partida === partida);
	// Só estes eventos tiram foto; os outros repetem o nome da última no campo "f"
	const COM_FOTO = new Set(['pre_chamado', 'foto_remota']);
</script>

<div class="eventos">
	{#if fila.length > 0}
		<section>
			<p class="kicker">Fila offline · {fila.length}/{TAMANHO_FILA}</p>
			<ul>
				{#each fila as campos, i (i)}
					<li class="evento na-fila">
						<div class="texto">
							<p class="titulo">{ROTULO_EVENTO[campos.ev] ?? campos.ev}</p>
							<p class="detalhe">Guardado aos {campos.t} s · envia quando a rede voltar</p>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	<section>
		<p class="kicker">Publicados em {TOPICO_DADOS}</p>
		<p class="nota">
			O broker é simulado nesta aba: nada sai do seu navegador. Telemetrias periódicas recebidas:
			<strong class="numero">{telemetrias.length}</strong>.
		</p>
		<ul>
			{#each eventos as mensagem (mensagem.id)}
				{@const campos = mensagem.campos}
				{@const tirouFoto = COM_FOTO.has(campos.ev)}
				{@const foto = tirouFoto ? fotoDe(campos.f, mensagem.partida) : undefined}
				<li class="evento" data-estado={campos.s}>
					{#if foto}
						<img src={foto.url} alt="Foto {campos.f} da câmera do celular" />
					{/if}
					<div class="texto">
						<p class="titulo">
							{ROTULO_EVENTO[campos.ev] ?? campos.ev}
							<span class="estado">{campos.s}</span>
						</p>
						<p class="detalhe">
							{ROTULO_MOTIVO[campos.m] ?? campos.m} · {formatarTempo(mensagem.tempo)}
						</p>
						<p class="valores numero">
							{campos.i} g · câmera: buraco {campos.vb}%, alagamento {campos.a}%, semáforo {campos.vs}%,
							faixa
							{campos.vf}% · luz {campos.l}% · {campos.v} km/h
						</p>
						<p class="valores numero">{campos.la}, {campos.lo}</p>
						{#if tirouFoto && !foto}
							<p class="valores">{campos.f} (câmera emulada: sem imagem)</p>
						{/if}
					</div>
				</li>
			{:else}
				<li class="vazio">
					{simulador.ligado
						? 'Nenhum evento ainda. Teste um cenário ou peça uma foto remota.'
						: 'Ligue o dispositivo para registrar eventos.'}
				</li>
			{/each}
		</ul>
	</section>
</div>

<style>
	.eventos {
		display: grid;
		gap: 1rem;
	}

	section {
		display: grid;
		gap: 0.5rem;
	}

	.nota {
		color: var(--secondary-800);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	ul {
		display: grid;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.evento {
		--cor: var(--primary-500);
		display: flex;
		gap: 0.75rem;
		padding: 0.75rem;
		border: 1px solid var(--secondary-100);
		border-left: 4px solid var(--cor);
		border-radius: var(--raio-menor);
		background: var(--branco);
	}

	.evento[data-estado='ATENCAO'] {
		--cor: var(--atencao-marca);
	}
	.evento[data-estado='CRITICO'] {
		--cor: var(--critico);
	}
	.evento[data-estado='FALHA'] {
		--cor: var(--falha);
	}

	.evento.na-fila {
		--cor: var(--secondary-400);
		border-style: dashed;
		border-left-style: solid;
	}

	img {
		flex-shrink: 0;
		width: 5.5rem;
		height: 4.125rem;
		border-radius: 0.5rem;
		object-fit: cover;
		background: var(--secondary-100);
	}

	.texto {
		min-width: 0;
	}

	.titulo {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9375rem;
		font-weight: 800;
	}

	.estado {
		padding: 0.0625rem 0.5rem;
		border-radius: 999px;
		background: var(--secondary-100);
		font-size: 0.6875rem;
		font-weight: 800;
		letter-spacing: 0.06em;
	}

	.detalhe {
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.valores {
		color: var(--secondary-700);
		font-size: 0.75rem;
		font-weight: 600;
		overflow-wrap: anywhere;
	}

	.vazio {
		padding: 1.5rem 1rem;
		color: var(--secondary-700);
		font-weight: 600;
		text-align: center;
	}
</style>
