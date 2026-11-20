<script lang="ts">
	// Esquema 2D do circuito, no estilo do Wokwi e do Tinkercad: a placa, os componentes e os fios.
	// Os componentes mostram o que o firmware está fazendo (LEDs, LCD, buzzer) e o que os sensores
	// estão lendo. Arraste para mover, use a roda do mouse ou a pinça para aproximar.
	// As chaves "liga/desliga" e "rede" podem ser tocadas.
	import { onMount } from 'svelte';
	import { rede } from '../sensores/energia.svelte.ts';
	import { simulador } from '../simulador.svelte.ts';
	import { ROTULOS_CAMERA } from '../visao/tipos.ts';
	import Icone from './Icone.svelte';

	// ---------- desenho ----------

	const AREA = { x: 30, y: 0, w: 960, h: 630 };
	// Em telas estreitas, começa na metade direita: ESP32, LCD, LEDs e buzzer
	const AREA_ESTREITA = { x: 395, y: -45, w: 600, h: 500 };

	const COR = {
		vermelho: '#d9372b',
		preto: '#16230e',
		verde: '#2e9e4f',
		laranja: '#f08a24',
		roxo: '#8b5cf6',
		azul: '#2a62c9',
		amarelo: '#d9a400'
	};

	// Pinos do ESP32 DevKit C, de cima para baixo (USB para baixo). O 1º fica em y = 170.
	const PINOS_ESQUERDA = '3V3 EN VP VN 34 35 32 33 25 26 27 14 12 GND 13 D2 D3 CMD 5V'.split(' ');
	const PINOS_DIREITA = 'GND 23 22 TX RX 21 GND 19 18 5 17 16 4 0 2 15 D1 D0 CLK'.split(' ');
	const USADOS_ESQUERDA = new Set([0, 4, 5, 7, 8, 9, 10, 13, 18]);
	const USADOS_DIREITA = new Set([0, 1, 2, 5, 6, 7, 8, 9, 10, 11, 12]);
	const yDoPino = (indice: number) => 170 + indice * 17;

	const FIOS: { cor: string; d: string }[] = [
		// 3V3: LDR, bateria, MPU-6050 e LCD
		{ cor: COR.vermelho, d: 'M250 162H280V239H250M280 170H430' },
		{ cor: COR.vermelho, d: 'M412 170V128H737V135M597 128V115' },
		// 5V: ESP32-CAM e GPS
		{ cor: COR.vermelho, d: 'M250 476H430M400 476V600H752V534H770' },
		// GND
		{ cor: COR.preto, d: 'M250 178H265V493H250M250 271H265M250 328H265M250 384H265M265 391H430' },
		{ cor: COR.preto, d: 'M550 170H720V135M614 170V115' },
		{
			cor: COR.preto,
			d: 'M550 272H720V517H770M692 289H720M692 306H720M692 323H720M692 340H720M622 418H606V446H720'
		},
		// Entradas: LDR, bateria, chave da rede e chave liga/desliga
		{ cor: COR.verde, d: 'M250 194H300V238H430' },
		{ cor: COR.verde, d: 'M250 255H430' },
		{ cor: COR.verde, d: 'M250 312H330V289H430' },
		{ cor: COR.verde, d: 'M250 368H345V306H430' },
		// UART da ESP32-CAM
		{ cor: COR.amarelo, d: 'M430 323H360V440H250' },
		{ cor: COR.azul, d: 'M250 457H375V340H430' },
		// I2C: SCL e SDA
		{ cor: COR.roxo, d: 'M550 204H771V135M631 204V115' },
		{ cor: COR.laranja, d: 'M550 255H754V135M648 255V115' },
		// LEDs e buzzer
		{ cor: COR.verde, d: 'M550 289H590M630 289H668' },
		{ cor: COR.verde, d: 'M550 306H590M630 306H668' },
		{ cor: COR.verde, d: 'M550 323H590M630 323H668' },
		{ cor: COR.verde, d: 'M550 340H590M630 340H668' },
		{ cor: COR.verde, d: 'M550 357H590V398H622' },
		// UART do GPS
		{ cor: COR.azul, d: 'M770 483H562V374H550' },
		{ cor: COR.amarelo, d: 'M550 187H574V500H770' }
	];

	// Pontos de solda onde um fio se divide
	const EMENDAS: [number, number, string][] = [
		[280, 170, COR.vermelho],
		[412, 170, COR.vermelho],
		[597, 128, COR.vermelho],
		[400, 476, COR.vermelho],
		[265, 271, COR.preto],
		[265, 328, COR.preto],
		[265, 384, COR.preto],
		[265, 391, COR.preto],
		[614, 170, COR.preto],
		[720, 289, COR.preto],
		[720, 306, COR.preto],
		[720, 323, COR.preto],
		[720, 340, COR.preto],
		[720, 446, COR.preto],
		[631, 204, COR.roxo],
		[648, 255, COR.laranja]
	];

	const leds = $derived([
		{ y: 289, nome: 'verde', gpio: 19, cor: '#72c000', aceso: simulador.leds.verde },
		{ y: 306, nome: 'amarelo', gpio: 18, cor: '#f2c21a', aceso: simulador.leds.amarelo },
		{ y: 323, nome: 'vermelho', gpio: 5, cor: '#e0392b', aceso: simulador.leds.vermelho },
		{ y: 340, nome: 'azul', gpio: 17, cor: '#3d7bff', aceso: simulador.leds.azul }
	]);

	// ---------- leituras ao vivo ----------

	const ligado = $derived(simulador.ligado);
	const t = $derived(simulador.telemetria);
	const tocando = $derived(simulador.buzzer && !simulador.pausado);
	const redeLigada = $derived(
		simulador.fontes.rede === 'celular' ? rede.conectada : simulador.ajustes.rede
	);
	const redeNoPainel = $derived(simulador.fontes.rede === 'simulado');
	// O problema que a câmera vê com mais confiança neste instante
	const maisVisto = $derived.by(() => {
		const visto = simulador.vistoPelaCamera;
		const maior = Math.max(...visto);
		return maior > 0 ? `IA: ${ROTULOS_CAMERA[visto.indexOf(maior)]} ${maior}%` : 'IA: nada à vista';
	});
	const decimal = (valor: number, casas: number) => valor.toFixed(casas).replace('.', ',');

	// ---------- mover e aproximar ----------

	let svg: SVGSVGElement;
	let vista = $state({ ...AREA });
	// Um arrasto não pode contar como toque nas chaves
	let arrastou = false;
	// Dedos na tela durante o arrasto: não aparecem na interface, então não precisam ser reativos
	// eslint-disable-next-line svelte/prefer-svelte-reactivity
	const ponteiros = new Map<number, { x: number; y: number }>();

	onMount(() => {
		if (svg.clientWidth < 520) vista = { ...AREA_ESTREITA };
	});

	function paraDesenho(clienteX: number, clienteY: number) {
		const matriz = svg.getScreenCTM();
		if (!matriz) return { x: vista.x + vista.w / 2, y: vista.y + vista.h / 2 };
		return new DOMPoint(clienteX, clienteY).matrixTransform(matriz.inverse());
	}

	/** Unidades do desenho por pixel da tela. */
	function escala() {
		const area = svg.getBoundingClientRect();
		return Math.max(vista.w / area.width, vista.h / area.height);
	}

	function aproximar(fator: number, clienteX?: number, clienteY?: number) {
		const area = svg.getBoundingClientRect();
		const ponto = paraDesenho(
			clienteX ?? area.left + area.width / 2,
			clienteY ?? area.top + area.height / 2
		);
		const largura = Math.min(Math.max(vista.w * fator, AREA.w / 6), AREA.w * 1.3);
		const proporcao = largura / vista.w;
		vista = {
			x: ponto.x - (ponto.x - vista.x) * proporcao,
			y: ponto.y - (ponto.y - vista.y) * proporcao,
			w: largura,
			h: vista.h * proporcao
		};
	}

	function interagir(elemento: SVGSVGElement) {
		const distancia = () => {
			const [a, b] = [...ponteiros.values()];
			return Math.hypot(a.x - b.x, a.y - b.y);
		};

		const aoApertar = (evento: PointerEvent) => {
			if (ponteiros.size === 0) arrastou = false;
			ponteiros.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });
		};

		const aoMover = (evento: PointerEvent) => {
			const anterior = ponteiros.get(evento.pointerId);
			if (!anterior) return;
			const antes = ponteiros.size === 2 ? distancia() : 0;
			ponteiros.set(evento.pointerId, { x: evento.clientX, y: evento.clientY });

			if (ponteiros.size === 2) {
				// Pinça: aproxima em torno do ponto entre os dois dedos
				const [a, b] = [...ponteiros.values()];
				arrastou = true;
				if (antes > 0) aproximar(antes / distancia(), (a.x + b.x) / 2, (a.y + b.y) / 2);
				return;
			}

			const dx = evento.clientX - anterior.x;
			const dy = evento.clientY - anterior.y;
			if (Math.abs(dx) + Math.abs(dy) > 3) arrastou = true;
			const unidade = escala();
			vista = { ...vista, x: vista.x - dx * unidade, y: vista.y - dy * unidade };
		};

		const aoSoltar = (evento: PointerEvent) => {
			ponteiros.delete(evento.pointerId);
		};

		// A roda do mouse precisa de um ouvinte não passivo para não rolar a página
		const aoRolar = (evento: WheelEvent) => {
			evento.preventDefault();
			aproximar(evento.deltaY > 0 ? 1.15 : 1 / 1.15, evento.clientX, evento.clientY);
		};

		elemento.addEventListener('pointerdown', aoApertar);
		window.addEventListener('pointermove', aoMover);
		window.addEventListener('pointerup', aoSoltar);
		window.addEventListener('pointercancel', aoSoltar);
		elemento.addEventListener('wheel', aoRolar, { passive: false });
		return () => {
			elemento.removeEventListener('pointerdown', aoApertar);
			window.removeEventListener('pointermove', aoMover);
			window.removeEventListener('pointerup', aoSoltar);
			window.removeEventListener('pointercancel', aoSoltar);
			elemento.removeEventListener('wheel', aoRolar);
			ponteiros.clear();
		};
	}

	function aoTocar(acao: () => void) {
		return () => {
			if (!arrastou) acao();
		};
	}

	function aoTeclar(acao: () => void) {
		return (evento: KeyboardEvent) => {
			if (evento.key !== 'Enter' && evento.key !== ' ') return;
			evento.preventDefault();
			acao();
		};
	}

	const alternarEnergia = () => simulador.alternarEnergia();
	const alternarRede = () => simulador.ajustar('rede', !simulador.ajustes.rede);
</script>

<div class="esquema">
	<svg
		bind:this={svg}
		{@attach interagir}
		viewBox="{vista.x} {vista.y} {vista.w} {vista.h}"
		role="group"
		aria-label="Esquema do circuito do dispositivo"
	>
		<!-- Fios -->
		<g fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
			{#each FIOS as fio (fio.d)}
				<path d={fio.d} stroke={fio.cor} />
			{/each}
		</g>
		{#each EMENDAS as [x, y, cor] (`${x}-${y}`)}
			<circle cx={x} cy={y} r="4" fill={cor} />
		{/each}

		<!-- ESP32 DevKit C -->
		<g>
			<rect x="430" y="140" width="120" height="380" rx="8" fill="#1d211c" />
			<rect x="446" y="146" width="88" height="18" rx="2" fill="#2c322a" />
			<path
				d="M452 160v-9h8v9m6 0v-9h8v9m6 0v-9h8v9m6 0v-9h8v9m6 0v-9h8"
				fill="none"
				stroke="#c9a94a"
			/>
			<rect x="460" y="176" width="60" height="78" rx="3" fill="#b9bfc4" />
			<text x="490" y="212" class="rotulo claro-fundo" text-anchor="middle">ESP32</text>
			<text x="490" y="226" class="legenda claro-fundo" text-anchor="middle">DevKit C</text>
			<rect x="472" y="500" width="36" height="26" rx="3" fill="#9aa0a6" />
			<circle
				cx="490"
				cy="280"
				r="4.5"
				fill={ligado ? '#ff4d3d' : '#4a2a26'}
				class:brilho={ligado}
			/>
			<text x="490" y="297" class="pino" text-anchor="middle">PWR</text>
			{#each PINOS_ESQUERDA as nome, indice (indice)}
				<rect x="426" y={yDoPino(indice) - 4} width="8" height="8" rx="1.5" fill="#d6a640" />
				<text x="438" y={yDoPino(indice) + 3} class="pino" class:usado={USADOS_ESQUERDA.has(indice)}
					>{nome}</text
				>
			{/each}
			{#each PINOS_DIREITA as nome, indice (indice)}
				<rect x="546" y={yDoPino(indice) - 4} width="8" height="8" rx="1.5" fill="#d6a640" />
				<text
					x="542"
					y={yDoPino(indice) + 3}
					class="pino"
					class:usado={USADOS_DIREITA.has(indice)}
					text-anchor="end">{nome}</text
				>
			{/each}
		</g>

		<!-- MPU-6050 -->
		<g>
			<path d="M597 100v15M614 100v15M631 100v15M648 100v15" stroke="#d6a640" stroke-width="3" />
			<rect x="584" y="44" width="78" height="56" rx="5" fill="#3f2a7c" />
			<rect x="612" y="52" width="22" height="18" rx="2" fill="#16181a" />
			<text x="623" y="83" class="legenda claro" text-anchor="middle">MPU-6050</text>
			<text x="623" y="94" class="pino claro" text-anchor="middle">VCC GND SCL SDA</text>
			<text x="623" y="34" class="valor" text-anchor="middle">
				{ligado ? `${decimal(t.impacto, 2)} g · ${t.inclinacao.toFixed(0)}°` : '—'}
			</text>
		</g>

		<!-- LCD 16x2 I2C -->
		<g>
			<path d="M720 120v15M737 120v15M754 120v15M771 120v15" stroke="#d6a640" stroke-width="3" />
			<rect x="700" y="18" width="252" height="102" rx="6" fill="#1d5c34" />
			<rect x="712" y="30" width="228" height="68" rx="3" fill="#16181a" />
			<rect x="718" y="36" width="216" height="56" rx="2" fill={ligado ? '#a4cc3d' : '#44523a'} />
			{#if ligado}
				<text x="726" y="60" class="lcd" textLength="200" lengthAdjust="spacing"
					>{simulador.lcd[0].padEnd(16, ' ')}</text
				>
				<text x="726" y="83" class="lcd" textLength="200" lengthAdjust="spacing"
					>{simulador.lcd[1].padEnd(16, ' ')}</text
				>
			{/if}
			<text x="745" y="113" class="pino claro" text-anchor="middle">GND VCC SDA SCL</text>
			<text x="940" y="113" class="pino claro" text-anchor="end">LCD 16x2 · I2C 0x27</text>
		</g>

		<!-- LEDs com resistores de 220 ohms -->
		{#each leds as led (led.nome)}
			<g>
				<rect x="590" y={led.y - 4.5} width="40" height="9" rx="4" fill="#d8c08c" />
				<path
					d="M600 {led.y - 4.5}v9M607 {led.y - 4.5}v9M614 {led.y - 4.5}v9"
					stroke="#b0392b"
					stroke-width="2.5"
				/>
				<path d="M668 {led.y}h24" stroke="#9aa0a6" stroke-width="2" />
				<circle
					cx="680"
					cy={led.y}
					r="6.5"
					fill={led.aceso ? led.cor : `color-mix(in srgb, ${led.cor} 30%, #20241f)`}
					stroke="#16230e"
					stroke-width="1"
					style:filter={led.aceso ? `drop-shadow(0 0 5px ${led.cor})` : 'none'}
				/>
				<text x="730" y={led.y + 3.5} class="legenda">{led.nome} · GPIO {led.gpio}</text>
			</g>
		{/each}
		<text x="610" y="278" class="pino escuro" text-anchor="middle">220 Ω</text>

		<!-- Buzzer -->
		<g>
			<circle cx="648" cy="408" r="24" fill="#16181a" />
			<circle cx="648" cy="408" r="6" fill="#3a3d3a" />
			<text x="632" y="401" class="pino claro">+</text>
			<text x="686" y="404" class="legenda">Buzzer</text>
			<text x="686" y="416" class="pino escuro">GPIO 16</text>
			{#if tocando}
				<g
					class="ondas"
					fill="none"
					stroke={COR.vermelho}
					stroke-width="2.5"
					stroke-linecap="round"
				>
					<path d="M660 378a16 16 0 0 1 14 14" />
					<path d="M664 368a26 26 0 0 1 20 20" />
				</g>
			{/if}
		</g>

		<!-- GPS -->
		<g>
			<rect x="770" y="466" width="190" height="88" rx="6" fill="#1d211c" />
			<rect x="906" y="476" width="44" height="44" rx="3" fill="#d9cba6" />
			<rect x="917" y="487" width="22" height="22" rx="1" fill="#c7cbd0" />
			<text x="778" y="486" class="pino claro">TX</text>
			<text x="778" y="503" class="pino claro">RX</text>
			<text x="778" y="520" class="pino claro">GND</text>
			<text x="778" y="537" class="pino claro">VCC</text>
			<text x="802" y="484" class="legenda claro">GPS · UART</text>
			<text x="802" y="505" class="valor claro">
				{ligado ? (t.gpsComSinal ? t.latitude.toFixed(5) : 'sem sinal') : '—'}
			</text>
			<text x="802" y="521" class="valor claro">
				{ligado && t.gpsComSinal ? t.longitude.toFixed(5) : ''}
			</text>
			<text x="802" y="541" class="pino claro">
				{ligado ? `${decimal(t.velocidade, 1)} km/h` : ''}
				{simulador.fontes.gps === 'celular' ? '· celular' : '· rota fixa'}
			</text>
		</g>

		<!-- Módulo LDR -->
		<g>
			<rect x="70" y="150" width="180" height="56" rx="6" fill="#1d4d9e" />
			<circle cx="102" cy="178" r="15" fill="#e2b866" stroke="#8a5a1c" stroke-width="2" />
			<path d="M92 172h20l-20 6h20l-20 6h20" fill="none" stroke="#8a5a1c" stroke-width="2" />
			<text x="242" y="165" class="pino claro" text-anchor="end">VCC</text>
			<text x="242" y="181" class="pino claro" text-anchor="end">GND</text>
			<text x="242" y="197" class="pino claro" text-anchor="end">AO</text>
			<text x="128" y="172" class="legenda claro">LDR · luz</text>
			<text x="128" y="192" class="valor claro">{ligado ? `${t.luz.toFixed(0)}%` : '—'}</text>
		</g>

		<!-- Bateria 18650 (no Wokwi, um potenciômetro) -->
		<g>
			<rect x="70" y="226" width="180" height="58" rx="6" fill="#2c322a" />
			<rect x="82" y="240" width="96" height="30" rx="6" fill="#16181a" stroke="#9aa0a6" />
			<rect
				x="85"
				y="243"
				width={ligado ? Math.max(0, (t.bateria / 100) * 90) : 0}
				height="24"
				rx="4"
				fill={t.bateria < 15 ? COR.vermelho : '#72c000'}
			/>
			<rect x="178" y="248" width="5" height="14" rx="1.5" fill="#9aa0a6" />
			<text x="242" y="242" class="pino claro" text-anchor="end">VCC</text>
			<text x="242" y="258" class="pino claro" text-anchor="end">SIG</text>
			<text x="242" y="274" class="pino claro" text-anchor="end">GND</text>
			<text x="190" y="252" class="legenda claro">Bateria</text>
			<text x="190" y="268" class="valor claro">{ligado ? `${t.bateria}%` : '—'}</text>
		</g>

		<!-- Chave da rede -->
		<!-- svelte-ignore a11y_no_noninteractive_tabindex -->
		<g
			class="chave"
			class:tocavel={redeNoPainel}
			role={redeNoPainel ? 'switch' : 'img'}
			aria-checked={redeNoPainel ? redeLigada : undefined}
			aria-label="Chave da cobertura de rede: {redeLigada ? 'ligada' : 'desligada'}"
			tabindex={redeNoPainel ? 0 : undefined}
			onclick={redeNoPainel ? aoTocar(alternarRede) : undefined}
			onkeydown={redeNoPainel ? aoTeclar(alternarRede) : undefined}
		>
			<rect x="130" y="300" width="120" height="40" rx="6" fill="#c7cbd0" />
			<rect x="144" y="310" width="62" height="20" rx="10" fill="#16181a" />
			<rect
				class="cursor"
				x={redeLigada ? 178 : 148}
				y="313"
				width="24"
				height="14"
				rx="7"
				fill={redeLigada ? '#72c000' : '#9aa0a6'}
			/>
			<text x="242" y="315" class="pino escuro" text-anchor="end">33</text>
			<text x="242" y="331" class="pino escuro" text-anchor="end">GND</text>
			<text x="122" y="317" class="legenda" text-anchor="end">Rede</text>
			<text x="122" y="331" class="pino escuro" text-anchor="end">
				{redeLigada ? 'com cobertura' : 'sem cobertura'}
			</text>
		</g>

		<!-- Chave liga/desliga -->
		<g
			class="chave tocavel"
			role="switch"
			aria-checked={ligado}
			aria-label="Chave liga/desliga do dispositivo"
			tabindex="0"
			onclick={aoTocar(alternarEnergia)}
			onkeydown={aoTeclar(alternarEnergia)}
		>
			<rect x="130" y="356" width="120" height="40" rx="6" fill="#c7cbd0" />
			<rect x="144" y="366" width="62" height="20" rx="10" fill="#16181a" />
			<rect
				class="cursor"
				x={ligado ? 178 : 148}
				y="369"
				width="24"
				height="14"
				rx="7"
				fill={ligado ? '#72c000' : '#9aa0a6'}
			/>
			<text x="242" y="371" class="pino escuro" text-anchor="end">25</text>
			<text x="242" y="387" class="pino escuro" text-anchor="end">GND</text>
			<text x="122" y="373" class="legenda" text-anchor="end">Liga / desliga</text>
			<text x="122" y="387" class="pino escuro" text-anchor="end">
				{ligado ? 'ligado' : 'desligado'}
			</text>
		</g>

		<!-- ESP32-CAM -->
		<g>
			<rect x="70" y="420" width="180" height="140" rx="6" fill="#16181a" />
			<rect x="88" y="436" width="62" height="62" rx="6" fill="#2c322a" />
			<circle cx="119" cy="467" r="22" fill="#0a0c0d" stroke="#72c000" stroke-width="2" />
			<circle cx="119" cy="467" r="9" fill="#1d2a3a" />
			<circle
				cx="168"
				cy="446"
				r="6"
				fill={simulador.leds.azul ? '#ffffff' : '#4d5350'}
				class:brilho={simulador.leds.azul}
			/>
			<text x="242" y="443" class="pino claro" text-anchor="end">U0R</text>
			<text x="242" y="460" class="pino claro" text-anchor="end">U0T</text>
			<text x="242" y="479" class="pino claro" text-anchor="end">5V</text>
			<text x="242" y="496" class="pino claro" text-anchor="end">GND</text>
			<text x="82" y="520" class="legenda claro">ESP32-CAM · OV2640</text>
			<text x="82" y="537" class="valor claro">
				{maisVisto}
			</text>
			<text x="82" y="551" class="pino claro">
				{ligado ? `${t.totalFotos} foto(s)` : ''}
				{simulador.fontes.camera === 'celular' ? '· câmera do celular' : '· emulada'}
			</text>
		</g>
	</svg>

	<div class="zoom" role="group" aria-label="Aproximação do esquema">
		<button type="button" aria-label="Aproximar" onclick={() => aproximar(1 / 1.4)}>
			<Icone nome="mais" tamanho={18} />
		</button>
		<button type="button" aria-label="Afastar" onclick={() => aproximar(1.4)}>
			<Icone nome="menos" tamanho={18} />
		</button>
		<button type="button" aria-label="Ver o circuito inteiro" onclick={() => (vista = { ...AREA })}>
			<Icone nome="ajustar" tamanho={18} />
		</button>
	</div>
</div>

<style>
	.esquema {
		position: absolute;
		inset: 0;
	}

	svg {
		display: block;
		width: 100%;
		height: 100%;
		font-family: var(--fonte);
		cursor: grab;
		touch-action: none;
		-webkit-user-select: none;
		user-select: none;
	}

	svg:active {
		cursor: grabbing;
	}

	text {
		fill: var(--secondary-950);
	}

	.rotulo {
		font-size: 13px;
		font-weight: 800;
	}

	.legenda {
		font-size: 10.5px;
		font-weight: 700;
	}

	.valor {
		font-size: 12px;
		font-weight: 800;
		font-variant-numeric: tabular-nums;
	}

	.pino {
		fill: #8d958a;
		font-size: 8px;
		font-weight: 700;
	}

	.pino.usado,
	.claro {
		fill: #f7fafc;
	}

	.pino.claro {
		fill: #c9d2c4;
	}

	.pino.escuro {
		fill: var(--secondary-700);
	}

	.claro-fundo {
		fill: #16230e;
	}

	.lcd {
		fill: #16260a;
		font: 700 17px var(--fonte-codigo);
		white-space: pre;
	}

	.brilho {
		filter: drop-shadow(0 0 5px currentColor);
		color: #ff4d3d;
	}

	.chave.tocavel {
		cursor: pointer;
	}

	.chave:focus-visible {
		outline: 2px solid var(--primary-600);
		outline-offset: 2px;
	}

	.cursor {
		transition: x 160ms var(--ease-saida);
	}

	.ondas {
		animation: soar 0.25s steps(2, jump-none) infinite;
	}

	@keyframes soar {
		50% {
			opacity: 0.2;
		}
	}

	.zoom {
		position: absolute;
		right: 0.75rem;
		bottom: 0.75rem;
		display: grid;
		overflow: hidden;
		border-radius: var(--raio-menor);
		background: rgb(255 255 255 / 0.9);
		box-shadow: 0 2px 10px rgb(22 35 14 / 0.14);
	}

	.zoom button {
		display: grid;
		width: 2.5rem;
		height: 2.5rem;
		place-items: center;
		border: 0;
		background: transparent;
		color: var(--secondary-950);
	}

	.zoom button + button {
		border-top: 1px solid var(--secondary-100);
	}
</style>
