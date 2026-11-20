import adapter from '@sveltejs/adapter-static';
import { sveltekit } from '@sveltejs/kit/vite';
import basicSsl from '@vitejs/plugin-basic-ssl';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

// Pasta da disciplina: o simulador lê o sketch.ino e o modelo 3D direto dela, sem cópias.
const pastaEdge = fileURLToPath(new URL('..', import.meta.url));

export default defineConfig(({ mode }) => ({
	plugins: [
		sveltekit({
			compilerOptions: {
				// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
				runes: ({ filename }) =>
					filename.split(/[/\\]/).includes('node_modules') ? undefined : true
			},
			adapter: adapter()
		}),
		// `bun run dev:celular`: HTTPS com certificado autoassinado. Câmera, GPS e acelerômetro
		// só funcionam em contexto seguro (HTTPS ou localhost).
		...(mode === 'celular' ? [basicSsl()] : [])
	],
	resolve: {
		alias: { $edge: pastaEdge },
		// O modelo 3D fica fora desta pasta: sem isto, ele carregaria uma segunda cópia do three.
		dedupe: ['three']
	},
	server: {
		fs: { allow: [pastaEdge] }
	}
}));
