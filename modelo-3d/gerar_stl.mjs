// Gera os arquivos de impressão (./stl) e o modelo do gabinete para o site (./modelo/gabinete.glb).
// Também confere se cada malha é fechada (manifold), condição para o fatiador imprimir sem erros.
// Uso: npm install && npm run stl

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { construirPecas, IMPRESSAO, orientarParaImpressao, paraGeometria } from './pecas.js';

// O GLTFExporter usa FileReader, que não existe no Node
globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((b) => { this.result = b; this.onloadend?.(); });
  }
  readAsDataURL(blob) {
    blob.arrayBuffer().then((b) => {
      this.result = `data:${blob.type};base64,${Buffer.from(b).toString('base64')}`;
      this.onloadend?.();
    });
  }
};

const raiz = path.dirname(fileURLToPath(import.meta.url));
const pastaStl = path.join(raiz, 'stl');
const pastaModelo = path.join(raiz, 'modelo');
fs.mkdirSync(pastaStl, { recursive: true });
fs.mkdirSync(pastaModelo, { recursive: true });

// Conta arestas que não são compartilhadas por exatamente 2 triângulos
function arestasAbertas(geometria) {
  const indice = geometria.index;
  const arestas = new Map();
  for (let t = 0; t < indice.count; t += 3) {
    for (let k = 0; k < 3; k++) {
      const a = indice.getX(t + k);
      const b = indice.getX(t + ((k + 1) % 3));
      const ch = a < b ? `${a}_${b}` : `${b}_${a}`;
      arestas.set(ch, (arestas.get(ch) || 0) + 1);
    }
  }
  let abertas = 0;
  for (const n of arestas.values()) if (n !== 2) abertas++;
  return abertas;
}

const inicio = Date.now();
const pecas = await construirPecas();
console.log(`Peças construídas em ${((Date.now() - inicio) / 1000).toFixed(1)} s\n`);

const geometrias = {};
for (const chave of Object.keys(IMPRESSAO)) geometrias[chave] = paraGeometria(pecas[chave]);

const exportadorStl = new STLExporter();
const traseira = orientarParaImpressao(geometrias.tampaTraseira, true);
let problemas = 0;

for (const [chave, info] of Object.entries(IMPRESSAO)) {
  let geometria;
  if (chave === 'logoCentro' || chave === 'logoAsas') {
    const d = traseira.deslocamento;
    geometria = geometrias[chave].clone().rotateY(Math.PI).translate(d.x, d.y, d.z);
  } else {
    geometria = orientarParaImpressao(geometrias[chave], info.virar).geometria;
  }
  const dados = exportadorStl.parse(new THREE.Mesh(geometria), { binary: true });
  fs.writeFileSync(path.join(pastaStl, `${info.arquivo}.stl`), Buffer.from(dados.buffer));

  geometria.computeBoundingBox();
  const t = new THREE.Vector3();
  geometria.boundingBox.getSize(t);
  const abertas = arestasAbertas(geometria);
  const genero = pecas[chave].genus();
  problemas += abertas;
  console.log(`${info.arquivo.padEnd(15)} ${t.x.toFixed(1)} x ${t.y.toFixed(1)} x ${t.z.toFixed(1)} mm  ` +
    `${String(pecas[chave].numTri()).padStart(6)} triângulos  volume ${(pecas[chave].volume() / 1000).toFixed(1)} cm³  ` +
    `gênero ${genero}  ${abertas === 0 ? 'malha fechada' : `${abertas} arestas abertas`}`);
}

const cena = new THREE.Scene();
cena.name = 'gabinete-olho-na-via';
for (const chave of Object.keys(IMPRESSAO)) {
  const malha = new THREE.Mesh(geometrias[chave], new THREE.MeshStandardMaterial({ name: chave }));
  malha.name = chave;
  cena.add(malha);
}
const glb = await new GLTFExporter().parseAsync(cena, { binary: true });
fs.writeFileSync(path.join(pastaModelo, 'gabinete.glb'), Buffer.from(glb));

console.log(`\nSTL em ${pastaStl}`);
console.log(`GLB em ${path.join(pastaModelo, 'gabinete.glb')} (${(fs.statSync(path.join(pastaModelo, 'gabinete.glb')).size / 1024).toFixed(0)} KB)`);
console.log(problemas === 0 ? 'Todas as malhas estão fechadas.' : `Atenção: ${problemas} arestas abertas no total.`);
