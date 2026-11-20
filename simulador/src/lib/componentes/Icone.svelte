<script lang="ts" module>
	const CAMINHOS = {
		codigo: 'M8.5 6.5 3 12l5.5 5.5M15.5 6.5 21 12l-5.5 5.5',
		pausa: 'M8.5 5v14M15.5 5v14',
		tocar: 'M7.5 4.8v14.4L19 12z',
		reiniciar: 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4.5V9H8',
		som: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM16 8.8a4.6 4.6 0 0 1 0 6.4M18.6 6.2a8.2 8.2 0 0 1 0 11.6',
		mudo: 'M4 9.5v5h3.5L12 18.5v-13L7.5 9.5zM16.5 9.5l5 5M21.5 9.5l-5 5',
		fechar: 'M6 6l12 12M18 6 6 18',
		camera: 'M4 8.5h3.2L9 6h6l1.8 2.5H20v10H4zM12 16.4a3.1 3.1 0 1 0 0-6.2 3.1 3.1 0 0 0 0 6.2z',
		energia: 'M12 3.5v8M6.6 6.8a7.6 7.6 0 1 0 10.8 0',
		mais: 'M12 5v14M5 12h14',
		menos: 'M5 12h14',
		ajustar: 'M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5',
		trocar: 'M4 8.5h13l-3-3M20 15.5H7l3 3',
		seta: 'M6 9.5l6 6 6-6'
	} as const;

	export type NomeIcone = keyof typeof CAMINHOS;
</script>

<script lang="ts">
	let { nome, tamanho = 20 }: { nome: NomeIcone; tamanho?: number } = $props();
</script>

<svg
	width={tamanho}
	height={tamanho}
	viewBox="0 0 24 24"
	fill="none"
	stroke="currentColor"
	stroke-width="2"
	stroke-linecap="round"
	stroke-linejoin="round"
	aria-hidden="true"
>
	<path d={CAMINHOS[nome]} />
</svg>
