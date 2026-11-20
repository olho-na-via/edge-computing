<script lang="ts">
	// Painel de controle: para cada sensor do circuito, escolhe entre a leitura real do celular
	// e um valor simulado, e oferece os cenários de teste do roteiro.
	import { camera } from '../sensores/camera.svelte.ts';
	import { bateria, rede } from '../sensores/energia.svelte.ts';
	import { gps } from '../sensores/gps.svelte.ts';
	import { movimento } from '../sensores/movimento.svelte.ts';
	import { contextoSeguro } from '../sensores/tipos.ts';
	import { ROTULO_CLASSE } from '../visao/tipos.ts';
	import { visao } from '../visao/visao.svelte.ts';
	import { CENARIOS, simulador, type Canal, type Fonte } from '../simulador.svelte.ts';
	import Alternador from './Alternador.svelte';
	import CartaoSensor from './CartaoSensor.svelte';
	import Chave from './Chave.svelte';
	import Deslizante from './Deslizante.svelte';
	import Icone from './Icone.svelte';

	const FONTES: { valor: Fonte; texto: string }[] = [
		{ valor: 'celular', texto: 'Celular' },
		{ valor: 'simulado', texto: 'Simulado' }
	];
	const NOME_CANAL: Record<Canal, string> = {
		camera: 'câmera',
		movimento: 'movimento',
		gps: 'GPS',
		luz: 'luz',
		bateria: 'bateria',
		rede: 'rede',
		visao: 'visão computacional'
	};

	// Confiança simulada de cada classe que a câmera detecta
	const SIMULADAS = [
		{ chave: 'buracoVisto', rotulo: 'Buraco visto pela IA' },
		{ chave: 'alagamento', rotulo: 'Alagamento visto pela IA' },
		{ chave: 'semaforoVisto', rotulo: 'Semáforo apagado visto pela IA' },
		{ chave: 'faixaVista', rotulo: 'Faixa apagada vista pela IA' }
	] as const;

	let ocupado = $state<Canal | 'todos' | null>(null);
	const seguro = contextoSeguro();
	const todosReais = $derived(
		(['camera', 'movimento', 'gps'] as Canal[]).every(
			(canal) => simulador.fontes[canal] === 'celular'
		)
	);
	const cenarioAtual = $derived(CENARIOS.find((c) => c.id === simulador.cenario));

	async function trocar(canal: Canal, fonte: Fonte) {
		ocupado = canal;
		await simulador.definirFonte(canal, fonte);
		ocupado = null;
	}

	async function ligarTodos() {
		ocupado = 'todos';
		const falharam = await simulador.usarCelular();
		ocupado = null;
		if (falharam.length > 0) {
			simulador.avisar(`Ficaram simulados: ${falharam.map((c) => NOME_CANAL[c]).join(', ')}.`);
		}
	}

	const decimal = (valor: number, casas: number) => valor.toFixed(casas).replace('.', ',');
</script>

<div class="sensores">
	{#if !seguro}
		<p class="alerta" role="alert">
			Esta página não está em HTTPS. Câmera, GPS e acelerômetro do celular ficam bloqueados pelo
			navegador: rode <code>bun run dev:celular</code> e abra o endereço <code>https://</code>.
		</p>
	{/if}

	<div class="mestre">
		<div>
			<h2>Sensores do celular</h2>
			<p>Câmera, GPS e acelerômetro no lugar da OV2640, do GPS e do MPU-6050.</p>
		</div>
		{#if todosReais}
			<button type="button" class="botao pequeno" onclick={() => simulador.usarSimulado()}>
				Simular tudo
			</button>
		{:else}
			<button
				type="button"
				class="botao pequeno primario"
				disabled={ocupado !== null}
				onclick={ligarTodos}
			>
				{ocupado === 'todos' ? 'Pedindo permissão…' : 'Usar o celular'}
			</button>
		{/if}
	</div>

	<div class="cenarios">
		<p class="kicker">Cenários de teste</p>
		<div class="fichas" role="group" aria-label="Cenários de teste">
			{#each CENARIOS as cenario (cenario.id)}
				<button
					type="button"
					class:ativo={simulador.cenario === cenario.id}
					aria-pressed={simulador.cenario === cenario.id}
					disabled={!simulador.ligado}
					onclick={() => simulador.aplicarCenario(cenario.id)}
				>
					{cenario.nome}
				</button>
			{/each}
		</div>
		<p class="esperado">
			{#if !simulador.ligado}
				Ligue o dispositivo para testar os cenários.
			{:else if cenarioAtual}
				Esperado: {cenarioAtual.esperado}.
			{:else}
				Ajuste manual: os controles abaixo valem como estão.
			{/if}
		</p>
	</div>

	<CartaoSensor
		titulo="ESP32-CAM · OV2640"
		papel="Fotografa a via e detecta problemas pela imagem"
		erro={camera.erro}
	>
		{#snippet fonte()}
			<Alternador
				rotulo="Origem da câmera"
				opcoes={[
					{ valor: 'celular', texto: 'Celular' },
					{ valor: 'simulado', texto: 'Emulada' }
				]}
				valor={simulador.fontes.camera}
				ocupado={ocupado === 'camera'}
				aoMudar={(fonte) => trocar('camera', fonte)}
			/>
		{/snippet}
		{#if simulador.fontes.camera === 'celular'}
			<p class="leitura">
				Câmera {camera.frontal ? 'frontal' : 'traseira'} ao vivo no canto do modelo. As fotos ficam só
				nesta aba do navegador.
			</p>
		{:else}
			<p class="leitura">Sem imagem: a foto é só o LED azul piscando, como no Wokwi.</p>
		{/if}
		<div class="linha-fonte">
			<p class="subtitulo">Detecção pela imagem</p>
			<Alternador
				rotulo="Origem da detecção pela imagem"
				opcoes={[
					{ valor: 'celular', texto: 'IA' },
					{ valor: 'simulado', texto: 'Simulada' }
				]}
				valor={simulador.fontes.visao}
				ocupado={ocupado === 'visao' || visao.estado === 'pedindo'}
				aoMudar={(fonte) => trocar('visao', fonte)}
			/>
		</div>
		{#if visao.erro}
			<p class="erro-visao" role="alert">{visao.erro}</p>
		{/if}
		{#if visao.estado === 'pedindo'}
			<p class="leitura">Baixando e preparando o modelo de visão (38 MB na primeira vez)…</p>
		{:else if simulador.fontes.visao === 'celular'}
			<p class="leitura">
				O que o modelo vê agora. Com 30% de confiança o firmware entra em atenção; com 50%, em
				crítico (a faixa apagada fica só em atenção).
			</p>
			<ul class="deteccoes" aria-label="Ocorrências que o modelo vê agora">
				{#each visao.deteccoes as deteccao, i (i)}
					<li data-classe={deteccao.classe}>
						{ROTULO_CLASSE[deteccao.classe] ?? deteccao.classe}
						<span class="numero">{Math.round(deteccao.confianca * 100)}%</span>
					</li>
				{:else}
					<li class="nada">Nenhuma ocorrência na imagem</li>
				{/each}
			</ul>
			<p class="nota">
				Modelo YOLO de <code>visao-computacional</code> rodando no aparelho ({visao.provedor ===
				'webgpu'
					? 'WebGPU'
					: 'WebAssembly'}, {visao.tempo.toFixed(0)} ms por quadro). Buraco e semáforo apagado também
				continuam sendo percebidos pelo acelerômetro e pela luz.
			</p>
		{:else}
			{#each SIMULADAS as classe (classe.chave)}
				<Deslizante
					rotulo={classe.rotulo}
					valor={simulador.ajustes[classe.chave]}
					minimo={0}
					maximo={100}
					unidade="%"
					marcas={classe.chave === 'faixaVista'
						? [{ valor: 30, texto: 'atenção' }]
						: [
								{ valor: 30, texto: 'atenção' },
								{ valor: 50, texto: 'crítico' }
							]}
					aoMudar={(valor) => simulador.ajustar(classe.chave, valor)}
				/>
			{/each}
			<p class="nota">
				Estes controles fazem o papel das detecções que a ESP32-CAM envia ao firmware, linhas como
				<code>DET buraco 60</code>. Escolha “IA” para o modelo de visão analisar a câmera do
				aparelho.
			</p>
		{/if}
		<div class="acoes">
			{#if simulador.fontes.camera === 'celular'}
				<button type="button" class="botao pequeno" onclick={() => camera.alternarLente()}>
					<Icone nome="trocar" tamanho={16} />
					Trocar lente
				</button>
			{/if}
			<button
				type="button"
				class="botao pequeno"
				disabled={!simulador.ligado}
				onclick={() => simulador.pedirFotoRemota()}
			>
				<Icone nome="camera" tamanho={16} />
				Foto remota (@foto)
			</button>
		</div>
	</CartaoSensor>

	<CartaoSensor titulo="MPU-6050" papel="Impacto do buraco e inclinação" erro={movimento.erro}>
		{#snippet fonte()}
			<Alternador
				rotulo="Origem do acelerômetro"
				opcoes={FONTES}
				valor={simulador.fontes.movimento}
				ocupado={ocupado === 'movimento'}
				aoMudar={(fonte) => trocar('movimento', fonte)}
			/>
		{/snippet}
		{#if simulador.fontes.movimento === 'celular'}
			<dl class="grade numero">
				<div>
					<dt>X</dt>
					<dd>{decimal(movimento.leitura.x, 2)} g</dd>
				</div>
				<div>
					<dt>Y</dt>
					<dd>{decimal(movimento.leitura.y, 2)} g</dd>
				</div>
				<div>
					<dt>Z</dt>
					<dd>{decimal(movimento.leitura.z, 2)} g</dd>
				</div>
				<div>
					<dt>Módulo</dt>
					<dd>{decimal(movimento.leitura.modulo, 2)} g</dd>
				</div>
				<div>
					<dt>Giro Z</dt>
					<dd>{decimal(movimento.leitura.giro, 0)} °/s</dd>
				</div>
			</dl>
			<p class="leitura">Sacuda o celular para cima e para baixo: é o solavanco de um buraco.</p>
		{:else}
			<Deslizante
				rotulo="Impacto mantido"
				valor={simulador.ajustes.impacto}
				minimo={0}
				maximo={2}
				passo={0.05}
				casas={2}
				unidade=" g"
				marcas={[
					{ valor: 0.4, texto: 'atenção' },
					{ valor: 1, texto: 'crítico' }
				]}
				aoMudar={(valor) => simulador.ajustar('impacto', valor)}
			/>
			<div class="acoes">
				<button
					type="button"
					class="botao pequeno primario"
					disabled={!simulador.ligado}
					onclick={() => simulador.passarEmBuraco()}
				>
					Passar em um buraco
				</button>
			</div>
			<Chave
				rotulo="Sensor conectado (I2C)"
				ligada={simulador.ajustes.imuConectado}
				aoMudar={(ligada) => simulador.ajustar('imuConectado', ligada)}
			/>
		{/if}
	</CartaoSensor>

	<CartaoSensor titulo="GPS" papel="Posição e velocidade do veículo" erro={gps.erro}>
		{#snippet fonte()}
			<Alternador
				rotulo="Origem do GPS"
				opcoes={[
					{ valor: 'celular', texto: 'Celular' },
					{ valor: 'simulado', texto: 'Rota fixa' }
				]}
				valor={simulador.fontes.gps}
				ocupado={ocupado === 'gps'}
				aoMudar={(fonte) => trocar('gps', fonte)}
			/>
		{/snippet}
		{#if simulador.fontes.gps === 'celular'}
			<dl class="grade numero">
				<div>
					<dt>Latitude</dt>
					<dd>{gps.latitude.toFixed(6)}</dd>
				</div>
				<div>
					<dt>Longitude</dt>
					<dd>{gps.longitude.toFixed(6)}</dd>
				</div>
				<div>
					<dt>Velocidade</dt>
					<dd>{decimal(gps.velocidade, 1)} km/h</dd>
				</div>
				<div>
					<dt>Precisão</dt>
					<dd>± {gps.precisao.toFixed(0)} m</dd>
				</div>
			</dl>
		{:else}
			<p class="leitura">Av. Paulista, da Consolação ao Paraíso: um ponto a cada 5 s, a 30 km/h.</p>
			<Chave
				rotulo="Sinal de GPS"
				ligada={simulador.ajustes.gpsSinal}
				aoMudar={(ligada) => simulador.ajustar('gpsSinal', ligada)}
			/>
		{/if}
	</CartaoSensor>

	<CartaoSensor titulo="LDR" papel="Luz do semáforo à frente">
		{#snippet fonte()}
			<Alternador
				rotulo="Origem da luz"
				opcoes={[
					{ valor: 'celular', texto: 'Câmera' },
					{ valor: 'simulado', texto: 'Simulado' }
				]}
				valor={simulador.fontes.luz}
				ocupado={ocupado === 'luz' || ocupado === 'camera'}
				aoMudar={(fonte) => trocar('luz', fonte)}
			/>
		{/snippet}
		{#if simulador.fontes.luz === 'celular'}
			<p class="leitura">
				Luz medida pela imagem: <strong class="numero">{camera.luminancia.toFixed(0)}%</strong>.
				Tampe a lente por 10 s para simular o semáforo apagado.
			</p>
		{:else}
			<Deslizante
				rotulo="Luz"
				valor={simulador.ajustes.luz}
				minimo={0}
				maximo={100}
				unidade="%"
				marcas={[{ valor: 30, texto: 'mínimo' }]}
				aoMudar={(valor) => simulador.ajustar('luz', valor)}
			/>
		{/if}
	</CartaoSensor>

	<CartaoSensor titulo="Bateria" papel="Carga da 18650 do Kit Cidadão" erro={bateria.erro}>
		{#snippet fonte()}
			<Alternador
				rotulo="Origem da bateria"
				opcoes={FONTES}
				valor={simulador.fontes.bateria}
				ocupado={ocupado === 'bateria'}
				aoMudar={(fonte) => trocar('bateria', fonte)}
			/>
		{/snippet}
		{#if simulador.fontes.bateria === 'celular'}
			<p class="leitura">
				Bateria do aparelho: <strong class="numero">{bateria.nivel}%</strong>{bateria.carregando
					? ', carregando'
					: ''}.
			</p>
		{:else}
			<Deslizante
				rotulo="Carga"
				valor={simulador.ajustes.bateria}
				minimo={0}
				maximo={100}
				unidade="%"
				marcas={[{ valor: 15, texto: 'mínimo' }]}
				aoMudar={(valor) => simulador.ajustar('bateria', valor)}
			/>
		{/if}
	</CartaoSensor>

	<CartaoSensor titulo="Rede" papel="Cobertura para enviar ao broker MQTT">
		{#snippet fonte()}
			<Alternador
				rotulo="Origem da rede"
				opcoes={FONTES}
				valor={simulador.fontes.rede}
				ocupado={ocupado === 'rede'}
				aoMudar={(fonte) => trocar('rede', fonte)}
			/>
		{/snippet}
		{#if simulador.fontes.rede === 'celular'}
			<p class="leitura">
				Conexão do aparelho: <strong>{rede.conectada ? 'com internet' : 'sem internet'}</strong>.
				Ligue o modo avião para ver a fila offline encher.
			</p>
		{:else}
			<Chave
				rotulo="Cobertura de rede"
				ligada={simulador.ajustes.rede}
				aoMudar={(ligada) => simulador.ajustar('rede', ligada)}
			/>
		{/if}
	</CartaoSensor>
</div>

<style>
	.sensores {
		display: grid;
		gap: 0.75rem;
	}

	.alerta {
		padding: 0.75rem;
		border-radius: var(--raio);
		background: var(--atencao-fundo);
		color: var(--atencao);
		font-size: 0.875rem;
		font-weight: 700;
	}

	code {
		font-family: var(--fonte-codigo);
		font-size: 0.8125rem;
	}

	.mestre {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding: 0.875rem;
		border-radius: var(--raio);
		background: var(--primary-50);
	}

	h2 {
		font-size: 1.0625rem;
		font-weight: 800;
		line-height: 1.2;
	}

	.mestre p {
		margin-top: 0.125rem;
		color: var(--secondary-800);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.mestre .botao {
		flex-shrink: 0;
	}

	.cenarios {
		display: grid;
		gap: 0.5rem;
	}

	.fichas {
		display: flex;
		gap: 0.375rem;
		margin: 0 -0.75rem;
		padding: 0 0.75rem 0.125rem;
		overflow-x: auto;
		scrollbar-width: none;
	}

	.fichas::-webkit-scrollbar {
		display: none;
	}

	.fichas button {
		flex-shrink: 0;
		min-height: 2.25rem;
		padding: 0 0.875rem;
		border: 1.5px solid var(--secondary-200);
		border-radius: 999px;
		background: var(--branco);
		font-size: 0.875rem;
		font-weight: 700;
		white-space: nowrap;
		transition:
			background-color 150ms,
			border-color 150ms;
	}

	.fichas button.ativo {
		border-color: var(--primary-500);
		background: var(--primary-500);
	}

	.fichas button:disabled {
		opacity: 0.5;
	}

	.linha-fonte {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		padding-top: 0.625rem;
		border-top: 1px solid var(--secondary-100);
	}

	.subtitulo {
		font-size: 0.9375rem;
		font-weight: 800;
	}

	.erro-visao {
		padding: 0.5rem 0.75rem;
		border-radius: var(--raio-menor);
		background: var(--atencao-fundo);
		color: var(--atencao);
		font-size: 0.8125rem;
		font-weight: 700;
	}

	.deteccoes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.deteccoes li {
		display: inline-flex;
		gap: 0.375rem;
		padding: 0.25rem 0.625rem;
		border-radius: 999px;
		background: var(--secondary-100);
		font-size: 0.8125rem;
		font-weight: 700;
	}

	.deteccoes li[data-classe='alagamento'] {
		background: var(--azul-fundo);
		color: var(--azul);
	}

	.deteccoes li.nada {
		background: transparent;
		padding-left: 0;
		color: var(--secondary-700);
		font-weight: 600;
	}

	.nota {
		color: var(--secondary-700);
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.esperado,
	.leitura {
		color: var(--secondary-800);
		font-size: 0.875rem;
		font-weight: 600;
	}

	.acoes {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
	}

	.grade {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(6.5rem, 1fr));
		gap: 0.375rem;
		margin: 0;
	}

	.grade div {
		padding: 0.375rem 0.625rem;
		border-radius: var(--raio-menor);
		background: var(--secondary-50);
	}

	dt {
		color: var(--secondary-700);
		font-size: 0.6875rem;
		font-weight: 800;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	dd {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 800;
	}
</style>
