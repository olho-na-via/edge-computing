// O simulador depende de APIs que só existem no navegador (câmera, GPS, WebGL): não há o que
// renderizar no servidor.
export const ssr = false;

// Página única e só cliente: o build gera um site estático (adapter-static), servido direto pela Vercel.
export const prerender = true;
