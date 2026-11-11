// Modelo 3D completo do dispositivo Olho na Via para o site (three.js).
// Carrega o gabinete gerado por gerar_stl.mjs (modelo/gabinete.glb) e monta a eletrônica interna,
// o display, os LEDs, a antena e os suportes. Unidade: milímetro.

import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';

export const ESTADOS = {
  NORMAL: { linha1: 'NORMAL   ONLINE', linha2: '0.02g 0cm L76%', led: 'verde' },
  ATENCAO: { linha1: 'ATENCAO  ONLINE', linha2: 'Irregular 0.60g', led: 'amarelo' },
  CRITICO: { linha1: 'CRITICO  ONLINE', linha2: 'Buraco 1.50g', led: 'vermelho' },
  FALHA: { linha1: 'FALHA    ONLINE', linha2: 'GPS sem sinal', led: 'amarelo-piscando' },
};

const CORES_LED = { azul: 0x3d7bff, vermelho: 0xff2a1a, amarelo: 0xffc21a, verde: 0x7dff1a };
const LEDS = [['verde', -24], ['amarelo', -8], ['vermelho', 8], ['azul', 24]];

function criarMateriais() {
  const fisico = (cor, extra = {}) => new THREE.MeshPhysicalMaterial({ color: cor, roughness: 0.6, ...extra });
  const padrao = (cor, extra = {}) => new THREE.MeshStandardMaterial({ color: cor, roughness: 0.6, ...extra });
  return {
    corpo: fisico(0x16230e, { roughness: 0.78, clearcoat: 0.12, clearcoatRoughness: 0.7 }),
    verde: fisico(0x72c000, { roughness: 0.45, clearcoat: 0.2 }),
    branco: padrao(0xf7fafc, { roughness: 0.5 }),
    acrilicoFume: fisico(0x0c120a, { roughness: 0.04, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.55 }),
    acrilico: fisico(0xffffff, { roughness: 0.03, transmission: 0.92, thickness: 1, transparent: true, opacity: 0.35 }),
    pcbVerde: padrao(0x1d5c34, { roughness: 0.45 }),
    pcbPreto: padrao(0x161816, { roughness: 0.45 }),
    pcbRoxo: padrao(0x3f2a7c, { roughness: 0.45 }),
    pcbAzul: padrao(0x1d4d9e, { roughness: 0.45 }),
    metal: padrao(0xc7cbd0, { metalness: 1, roughness: 0.28 }),
    metalEscuro: padrao(0x2a2c2e, { metalness: 0.8, roughness: 0.4 }),
    ouro: padrao(0xd6a640, { metalness: 1, roughness: 0.3 }),
    borracha: padrao(0x101210, { roughness: 0.92 }),
    plasticoPreto: padrao(0x0e0f0e, { roughness: 0.5 }),
    conector: padrao(0xeeeadd, { roughness: 0.55 }),
    bateria: fisico(0x2f6fd6, { roughness: 0.35, clearcoat: 0.5 }),
    ceramica: padrao(0xd9cba6, { roughness: 0.7 }),
    lente: fisico(0x050608, { roughness: 0.05, metalness: 0.3, clearcoat: 1 }),
    cabo: padrao(0x1b1b1b, { roughness: 0.7 }),
    caboVermelho: padrao(0xc0392b, { roughness: 0.6 }),
    caboAmarelo: padrao(0xe0b020, { roughness: 0.6 }),
    caboAzul: padrao(0x2a62c9, { roughness: 0.6 }),
    ventosa: fisico(0xb9c4c9, { roughness: 0.25, transmission: 0.6, thickness: 2, transparent: true, opacity: 0.75 }),
    guidao: padrao(0x2b2d2f, { metalness: 0.6, roughness: 0.35 }),
    placaFurada: padrao(0xffffff, { roughness: 0.7, map: texturaPlacaFurada() }),
  };
}

function texturaPlacaFurada() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = 900;
  c.height = 500;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#c9a46c';
  ctx.fillRect(0, 0, c.width, c.height);
  const passo = 25.4;
  for (let x = passo / 2; x < c.width; x += passo) {
    for (let y = passo / 2; y < c.height; y += passo) {
      ctx.fillStyle = '#9b7a46';
      ctx.beginPath();
      ctx.arc(x, y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#3a2c18';
      ctx.beginPath();
      ctx.arc(x, y, 3.2, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// ---------- utilitários de geometria (mm) ----------

function malha(geo, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

function bloco(w, h, d, mat, x, y, z, raio = 0) {
  const geo = raio > 0 ? new RoundedBoxGeometry(w, h, d, 3, raio) : new THREE.BoxGeometry(w, h, d);
  return malha(geo, mat, x, y, z);
}

// Cilindro centrado em (x, y, z) com eixo 'x', 'y' ou 'z'
function cilindro(r, h, mat, eixo, x, y, z, lados = 32, rTopo = r) {
  const geo = new THREE.CylinderGeometry(rTopo, r, h, lados);
  if (eixo === 'z') geo.rotateX(Math.PI / 2);
  if (eixo === 'x') geo.rotateZ(-Math.PI / 2);
  return malha(geo, mat, x, y, z);
}

function caboEntre(pontos, raio, mat) {
  const curva = new THREE.CatmullRomCurve3(pontos.map((p) => new THREE.Vector3(...p)));
  return malha(new THREE.TubeGeometry(curva, 48, raio, 10), mat);
}

function rotulo(texto) {
  if (typeof document === 'undefined') return new THREE.Object3D();
  const div = document.createElement('div');
  div.className = 'rotulo-3d';
  div.textContent = texto;
  return new CSS2DObject(div);
}

// ---------- display LCD 16x2 com fonte 5x7 ----------

const FONTE = {
  ' ': '00000,00000,00000,00000,00000,00000,00000',
  '0': '01110,10001,10011,10101,11001,10001,01110', '1': '00100,01100,00100,00100,00100,00100,01110',
  '2': '01110,10001,00001,00010,00100,01000,11111', '3': '11111,00010,00100,00010,00001,10001,01110',
  '4': '00010,00110,01010,10010,11111,00010,00010', '5': '11111,10000,11110,00001,00001,10001,01110',
  '6': '00110,01000,10000,11110,10001,10001,01110', '7': '11111,00001,00010,00100,01000,01000,01000',
  '8': '01110,10001,10001,01110,10001,10001,01110', '9': '01110,10001,10001,01111,00001,00010,01100',
  A: '01110,10001,10001,10001,11111,10001,10001', B: '11110,10001,10001,11110,10001,10001,11110',
  C: '01110,10001,10000,10000,10000,10001,01110', D: '11100,10010,10001,10001,10001,10010,11100',
  E: '11111,10000,10000,11110,10000,10000,11111', F: '11111,10000,10000,11110,10000,10000,10000',
  G: '01110,10001,10000,10111,10001,10001,01111', H: '10001,10001,10001,11111,10001,10001,10001',
  I: '01110,00100,00100,00100,00100,00100,01110', L: '10000,10000,10000,10000,10000,10000,11111',
  M: '10001,11011,10101,10101,10001,10001,10001', N: '10001,10001,11001,10101,10011,10001,10001',
  O: '01110,10001,10001,10001,10001,10001,01110', P: '11110,10001,10001,11110,10000,10000,10000',
  R: '11110,10001,10001,11110,10100,10010,10001', S: '01111,10000,10000,01110,00001,00001,11110',
  T: '11111,00100,00100,00100,00100,00100,00100', U: '10001,10001,10001,10001,10001,10001,01110',
  V: '10001,10001,10001,10001,10001,01010,00100',
  a: '00000,00000,01110,00001,01111,10001,01111', b: '10000,10000,10110,11001,10001,10001,11110',
  c: '00000,00000,01110,10000,10000,10001,01110', d: '00001,00001,01101,10011,10001,10001,01111',
  e: '00000,00000,01110,10001,11111,10000,01110', f: '00110,01001,01000,11100,01000,01000,01000',
  g: '00000,01111,10001,10001,01111,00001,01110', h: '10000,10000,10110,11001,10001,10001,10001',
  i: '00100,00000,01100,00100,00100,00100,01110', l: '01100,00100,00100,00100,00100,00100,01110',
  m: '00000,00000,11010,10101,10101,10001,10001', n: '00000,00000,10110,11001,10001,10001,10001',
  o: '00000,00000,01110,10001,10001,10001,01110', p: '00000,00000,11110,10001,11110,10000,10000',
  r: '00000,00000,10110,11001,10000,10000,10000', s: '00000,00000,01110,10000,01110,00001,11110',
  u: '00000,00000,10001,10001,10001,10011,01101', v: '00000,00000,10001,10001,10001,01010,00100',
  z: '00000,00000,11111,00010,00100,01000,11111', '.': '00000,00000,00000,00000,00000,01100,01100',
  '%': '11000,11001,00010,00100,01000,10011,00011', '-': '00000,00000,00000,11111,00000,00000,00000',
};

function criarTelaLcd() {
  if (typeof document === 'undefined') return { textura: null, escrever() {} };
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');
  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  textura.anisotropy = 8;

  function escrever(linha1, linha2) {
    const fundo = ctx.createLinearGradient(0, 0, 0, canvas.height);
    fundo.addColorStop(0, '#b4d84a');
    fundo.addColorStop(1, '#93c02f');
    ctx.fillStyle = fundo;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const passo = 10.4;
    const ponto = 9;
    const margemX = (canvas.width - 16 * 6 * passo + passo) / 2;
    const margemY = (canvas.height - 2 * 9 * passo + passo) / 2;
    [linha1, linha2].forEach((linha, l) => {
      const texto = linha.padEnd(16, ' ').slice(0, 16);
      for (let c = 0; c < 16; c++) {
        const linhasGlifo = (FONTE[texto[c]] || FONTE[' ']).split(',');
        for (let gy = 0; gy < 8; gy++) {
          for (let gx = 0; gx < 5; gx++) {
            const aceso = gy < 7 && linhasGlifo[gy][gx] === '1';
            ctx.fillStyle = aceso ? '#16260a' : 'rgba(40, 70, 0, 0.10)';
            ctx.fillRect(margemX + (c * 6 + gx) * passo, margemY + (l * 9 + gy) * passo, ponto, ponto);
          }
        }
      }
    });
    textura.needsUpdate = true;
  }
  return { textura, escrever };
}

function texturaBrilho() {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.25, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

// ---------- módulos eletrônicos ----------

function esp32Cam(mat) {
  const g = new THREE.Group();
  g.add(bloco(27, 40, 1.6, mat.pcbPreto, 0, 12, -16));
  g.add(bloco(8.5, 8.5, 1.6, mat.plasticoPreto, 0, 22, -17.6));
  g.add(cilindro(3.6, 1.6, mat.plasticoPreto, 'z', 0, 22, -19.2));
  g.add(cilindro(2.4, 0.3, mat.lente, 'z', 0, 22, -20.1));
  g.add(bloco(3, 3, 1, mat.conector, -9, 30, -17.3));
  g.add(bloco(18, 25.5, 0.8, mat.pcbPreto, 0, 15, -14.8));
  g.add(bloco(15.8, 17.8, 2.4, mat.metal, 0, 13, -13.2, 0.3));
  g.add(bloco(14, 15, 2, mat.metal, 0, -1, -14.2, 0.2));
  return g;
}

function moduloLdr(mat) {
  const g = new THREE.Group();
  g.add(bloco(14, 32, 1.6, mat.pcbAzul, 24.5, 10, -18.7));
  g.add(cilindro(2.5, 2, mat.caboVermelho, 'z', 20, 22, -21.2));
  g.add(bloco(2.5, 10, 8.5, mat.plasticoPreto, 24.5, -2, -14));
  g.add(bloco(6, 5, 2, mat.pcbAzul, 27, 6, -16.9));
  return g;
}

function conversorDcDc(mat) {
  const g = new THREE.Group();
  g.add(bloco(22, 17, 1.6, mat.pcbAzul, -49, 31, -19.2));
  g.add(bloco(7, 7, 3.2, mat.plasticoPreto, -51, 31, -16.8, 0.6));
  g.add(cilindro(2.5, 5, mat.metal, 'z', -42, 35, -15.9));
  g.add(cilindro(2.5, 5, mat.metal, 'z', -42, 27, -15.9));
  g.add(bloco(4, 4, 1, mat.plasticoPreto, -56, 36, -17.9));
  return g;
}

function placaPrincipal(mat) {
  const g = new THREE.Group();
  g.add(bloco(90, 50, 1.6, mat.placaFurada, 0, 5, 0.8));
  // ESP32 DevKit sobre barras de pinos fêmea
  g.add(bloco(2.5, 50, 8.5, mat.plasticoPreto, 16.5, 9.5, -4.25));
  g.add(bloco(2.5, 50, 8.5, mat.plasticoPreto, 41.5, 9.5, -4.25));
  g.add(bloco(28, 55, 1.6, mat.pcbPreto, 29, 9.5, -9.3));
  g.add(bloco(18, 25.5, 0.8, mat.pcbPreto, 29, 23, -10.5));
  g.add(bloco(15.8, 17.8, 2.4, mat.metal, 29, 21, -12.1, 0.3));
  g.add(bloco(8, 5.5, 3, mat.metal, 29, -15.5, -11.6, 0.4));
  g.add(bloco(3.5, 3.5, 1.5, mat.metalEscuro, 21, -14, -10.8));
  g.add(bloco(3.5, 3.5, 1.5, mat.metalEscuro, 37, -14, -10.8));
  // MPU-6050 (GY-521)
  g.add(bloco(20, 2.5, 2.5, mat.plasticoPreto, -28, 1, -1.25));
  g.add(bloco(21, 16, 1.6, mat.pcbRoxo, -28, 8, -3.3));
  g.add(bloco(4, 4, 0.9, mat.plasticoPreto, -28, 9, -4.55));
  for (const [x, y] of [[-8, -12], [-38, 24], [4, 26]]) g.add(bloco(7, 5, 6, mat.conector, x, y, -3));
  for (const [x, y] of [[43.5, -17], [-43.5, -17], [43.5, 27], [-43.5, 27]]) g.add(cilindro(2.7, 1.8, mat.metal, 'z', x, y, -0.9, 20));
  return g;
}

function tBeam(mat) {
  const g = new THREE.Group();
  g.add(bloco(100, 1.6, 33, mat.pcbPreto, -10, -24.8, -5));
  g.add(bloco(77, 6, 21, mat.plasticoPreto, -12, -29, -5));
  const bateria = cilindro(9.3, 65, mat.bateria, 'x', -12, -35.3, -5, 40);
  g.add(bateria);
  g.add(cilindro(9.3, 1.2, mat.metal, 'x', -45, -35.3, -5, 40));
  g.add(cilindro(4, 1.5, mat.metal, 'x', 21, -35.3, -5, 24));
  g.add(bloco(25, 1, 25, mat.pcbPreto, -18, -23.5, -8));
  const gps = bloco(25, 4, 25, mat.ceramica, -18, -21, -8, 0.6);
  g.add(gps);
  g.add(bloco(14, 0.3, 14, mat.metal, -18, -18.9, -8));
  g.add(bloco(17, 2.5, 16, mat.metal, -47, -22.8, -6, 0.3));
  g.add(bloco(18, 2.8, 25, mat.metal, 22, -22.6, -6, 0.3));
  g.add(cilindro(1.2, 4, mat.ouro, 'y', -55, -22, 8, 16));
  return { grupo: g, bateria, gps };
}

function moduloLcd(mat, tela) {
  const g = new THREE.Group();
  const yc = 20;
  g.add(bloco(80, 36, 1.6, mat.pcbVerde, 0, yc, 13.8));
  g.add(bloco(71.2, 24.2, 7, mat.metalEscuro, 0, yc, 18.1, 0.4));
  const telaMat = new THREE.MeshStandardMaterial({
    map: tela.textura, emissiveMap: tela.textura, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.35,
  });
  const display = malha(new THREE.PlaneGeometry(66, 17.5), telaMat, 0, yc, 21.62);
  display.castShadow = false;
  g.add(display);
  g.add(bloco(42, 2.5, 8.5, mat.plasticoPreto, -18, yc + 15.5, 8.75));
  g.add(bloco(42, 19, 1.6, mat.pcbPreto, -12, yc + 6, 4.6));
  g.add(bloco(7, 7, 4.5, mat.pcbAzul, -26, yc + 7, 1.6, 0.5));
  g.add(bloco(9, 4, 1.5, mat.plasticoPreto, -6, yc + 5, 3.05));
  for (const sx of [1, -1]) for (const sy of [1, -1]) g.add(cilindro(2.6, 1.6, mat.metal, 'z', sx * 37.5, yc + sy * 15.5, 12.2, 20));
  return { grupo: g, display };
}

// ---------- montagem ----------

export async function criarDispositivo({ urlGabinete = new URL('./modelo/gabinete.glb', import.meta.url).href } = {}) {
  const mat = criarMateriais();
  const tela = criarTelaLcd();
  const raiz = new THREE.Group();
  raiz.name = 'olho-na-via';

  const gltf = await new GLTFLoader().loadAsync(urlGabinete);
  const pecas = {};
  gltf.scene.traverse((o) => {
    if (!o.isMesh) return;
    const geo = toCreasedNormals(o.geometry, THREE.MathUtils.degToRad(32));
    const material = { anelVerde: mat.verde, anelCamera: mat.verde, anelBotao: mat.verde, logoAsas: mat.verde, logoCentro: mat.branco }[o.name] || mat.corpo;
    pecas[o.name] = malha(geo, material);
    pecas[o.name].name = o.name;
  });

  // Grupos que se afastam na vista explodida
  const grupos = {};
  const criarGrupo = (nome, deslocamento) => {
    const g = new THREE.Group();
    g.name = nome;
    g.userData.deslocamento = new THREE.Vector3(...deslocamento);
    raiz.add(g);
    grupos[nome] = g;
    return g;
  };

  const frontal = criarGrupo('tampaFrontal', [0, 0, -120]);
  frontal.add(pecas.tampaFrontal, pecas.anelCamera);
  frontal.add(malha(new THREE.CylinderGeometry(9.15, 9.15, 2, 48).rotateX(Math.PI / 2), mat.acrilicoFume, 0, 22, -21));
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    const x = sx * (70 - 12 + 6 / Math.SQRT2);
    const y = sy * (47.5 - 12 + 6 / Math.SQRT2);
    frontal.add(cilindro(3.15, 1.5, mat.metal, 'z', x, y, -23.2, 24, 1.6));
  }
  // Prensa-cabo PG7 na lateral direita
  frontal.add(cilindro(7.5, 4, mat.plasticoPreto, 'x', 72, -20, -15, 6));
  frontal.add(cilindro(7, 6, mat.plasticoPreto, 'x', 77, -20, -15, 32, 5));
  frontal.add(cilindro(8, 2.5, mat.plasticoPreto, 'x', 66.3, -20, -15, 6));
  const caboEnergia = caboEntre([[80, -20, -15], [92, -21, -15], [100, -34, -15], [102, -80, -12]], 2.6, mat.cabo);
  frontal.add(caboEnergia);

  const camera = criarGrupo('camera', [0, 0, -78]);
  const cam = esp32Cam(mat);
  camera.add(cam, moduloLdr(mat), conversorDcDc(mat));

  const principal = criarGrupo('placaPrincipal', [0, 8, -36]);
  principal.add(placaPrincipal(mat));

  const radio = criarGrupo('tBeam', [0, -48, -14]);
  const tb = tBeam(mat);
  radio.add(tb.grupo);

  const anel = criarGrupo('anelVerde', [0, 0, 0]);
  anel.add(pecas.anelVerde);

  const lcdGrupo = criarGrupo('lcd', [0, 6, 56]);
  const lcd = moduloLcd(mat, tela);
  lcdGrupo.add(lcd.grupo);

  const traseira = criarGrupo('tampaTraseira', [0, 0, 112]);
  traseira.add(pecas.tampaTraseira, pecas.logoCentro, pecas.logoAsas, pecas.anelBotao);
  traseira.add(bloco(72, 25, 1, mat.acrilico, 0, 20, 22.3));
  // Placa dos LEDs, LEDs, buzzer e botão
  traseira.add(bloco(66, 12, 1.6, mat.placaFurada, 0, -6, 13));
  const leds = {};
  const brilho = texturaBrilho();
  for (const [cor, x] of LEDS) {
    const corLed = CORES_LED[cor];
    const ledMat = new THREE.MeshPhysicalMaterial({
      color: corLed, emissive: corLed, emissiveIntensity: 0, roughness: 0.15, transmission: 0.3, transparent: true, opacity: 0.92,
    });
    const corpoLed = new THREE.Group();
    corpoLed.add(cilindro(2.9, 1, ledMat, 'z', x, -6, 19.5, 24));
    corpoLed.add(cilindro(2.5, 5.5, ledMat, 'z', x, -6, 22.75, 24));
    const cupula = malha(new THREE.SphereGeometry(2.5, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).rotateX(Math.PI / 2), ledMat, x, -6, 25.5);
    corpoLed.add(cupula);
    corpoLed.add(cilindro(0.25, 6, mat.metal, 'z', x - 1.27, -6, 16, 8), cilindro(0.25, 6, mat.metal, 'z', x + 1.27, -6, 16, 8));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: brilho, color: corLed, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, opacity: 0 }));
    halo.position.set(x, -6, 27.5);
    halo.scale.set(16, 16, 1);
    corpoLed.add(halo);
    traseira.add(corpoLed);
    leds[cor] = { material: ledMat, halo };
  }
  traseira.add(cilindro(6, 8, mat.plasticoPreto, 'z', -50, -30, 17.6, 32));
  const botao = new THREE.Group();
  botao.add(cilindro(7.5, 1.4, mat.metal, 'z', 50, -30, 25.7, 40));
  botao.add(cilindro(4.7, 2.4, mat.caboAzul, 'z', 50, -30, 27.6, 32));
  botao.add(cilindro(6, 17, mat.plasticoPreto, 'z', 50, -30, 13.1, 32));
  botao.add(cilindro(8, 1.5, mat.metal, 'z', 50, -30, 20.8, 6));
  traseira.add(botao);
  // Antena LoRa com conector SMA no topo
  const antena = new THREE.Group();
  antena.add(cilindro(4.6, 2, mat.ouro, 'y', -52, 48.5, 12, 6));
  antena.add(cilindro(3.15, 6, mat.ouro, 'y', -52, 52.5, 12, 24));
  const haste = new THREE.Group();
  haste.position.set(-52, 55.5, 12);
  haste.add(cilindro(4.5, 12, mat.borracha, 'y', 0, 6, 0, 24));
  const corpoAntena = new THREE.Group();
  corpoAntena.position.set(0, 12, 0);
  corpoAntena.rotation.z = THREE.MathUtils.degToRad(12);
  corpoAntena.add(cilindro(4.5, 80, mat.borracha, 'y', 0, 40, 0, 24, 3.4));
  corpoAntena.add(malha(new THREE.SphereGeometry(3.4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), mat.borracha, 0, 80, 0));
  haste.add(corpoAntena);
  antena.add(haste);
  traseira.add(antena);

  // Cabos internos (somem na vista explodida)
  const cabos = new THREE.Group();
  cabos.add(caboEntre([[16, -14, -6], [8, -22, -8], [-4, -21, -12], [-20, -19.5, -15]], 0.9, mat.caboAmarelo));
  cabos.add(caboEntre([[29, 33, -10], [20, 40, -12], [10, 38, -14], [0, 33, -14]], 0.9, mat.caboAzul));
  cabos.add(caboEntre([[-4, 26, -3], [-10, 40, 2], [-22, 40, 6], [-24, 30, 5]], 0.9, mat.caboVermelho));
  cabos.add(caboEntre([[-55, -21, 8], [-58, -5, 10], [-56, 30, 12], [-52, 44, 12]], 0.8, mat.cabo));
  raiz.add(cabos);

  // Suporte do ônibus: rótula 1/4" no topo, braço e ventosa no para-brisa
  const suporteOnibus = new THREE.Group();
  suporteOnibus.add(cilindro(7, 4, mat.plasticoPreto, 'y', 0, 49.5, -15, 24));
  suporteOnibus.add(cilindro(3, 8, mat.metal, 'y', 0, 55.5, -15, 16));
  suporteOnibus.add(malha(new THREE.SphereGeometry(7, 24, 16), mat.plasticoPreto, 0, 63, -15));
  suporteOnibus.add(caboEntre([[0, 63, -15], [0, 76, -24], [0, 82, -40], [0, 82, -52]], 4.5, mat.plasticoPreto));
  suporteOnibus.add(cilindro(16, 12, mat.plasticoPreto, 'z', 0, 82, -58, 40));
  suporteOnibus.add(cilindro(34, 2.5, mat.ventosa, 'z', 0, 82, -65.5, 64, 18));
  suporteOnibus.add(bloco(26, 6, 10, mat.plasticoPreto, 0, 95, -57, 2));
  frontal.add(suporteOnibus);

  // Suporte do Kit Cidadão: rótula na base e abraçadeira no guidão
  const suporteKit = new THREE.Group();
  suporteKit.add(cilindro(7, 4, mat.plasticoPreto, 'y', 50, -49.5, -15, 24));
  suporteKit.add(cilindro(3, 8, mat.metal, 'y', 50, -55.5, -15, 16));
  suporteKit.add(malha(new THREE.SphereGeometry(7, 24, 16), mat.plasticoPreto, 50, -63, -15));
  suporteKit.add(cilindro(4.5, 18, mat.plasticoPreto, 'y', 50, -75, -15, 24));
  const abracadeira = malha(new THREE.TorusGeometry(15, 3.6, 16, 48), mat.plasticoPreto, 50, -97, -15);
  abracadeira.rotation.y = Math.PI / 2;
  suporteKit.add(abracadeira);
  suporteKit.add(cilindro(11, 220, mat.guidao, 'x', 50, -97, -15, 40));
  suporteKit.add(bloco(10, 8, 14, mat.plasticoPreto, 50, -81, -15, 2));
  suporteKit.visible = false;
  frontal.add(suporteKit);

  // Rótulos da vista explodida
  const rotulos = [];
  const adicionarRotulo = (texto, pai, x, y, z) => {
    const r = rotulo(texto);
    r.position.set(x, y, z);
    pai.add(r);
    rotulos.push(r);
  };
  adicionarRotulo('Câmera OV2640', camera, 0, -6, -24);
  adicionarRotulo('ESP32', principal, 29, 44, -14);
  adicionarRotulo('MPU-6050', principal, -30, 12, -6);
  adicionarRotulo('GPS + LoRa (T-Beam)', radio, -18, -16, -8);
  adicionarRotulo('Bateria 18650', radio, 30, -36, -5);
  adicionarRotulo('Display 16x2', lcdGrupo, 0, 40, 18);
  adicionarRotulo('LEDs de estado', traseira, -40, -6, 30);
  adicionarRotulo('Botão Reportar', traseira, 50, -40, 30);
  adicionarRotulo('Conversor 24 V → 5 V', camera, -49, 46, -20);
  for (const r of rotulos) r.visible = false;

  // ---------- estado, explosão e suporte ----------

  let estadoAtual = 'NORMAL';
  let explosao = 0;
  let suporte = 'onibus';
  let inicioFlash = -10;

  function definirEstado(estado) {
    estadoAtual = ESTADOS[estado] ? estado : 'NORMAL';
    const e = ESTADOS[estadoAtual];
    tela.escrever(e.linha1, e.linha2);
    if (estadoAtual === 'CRITICO') inicioFlash = performance.now() / 1000;
  }

  function acender(cor, intensidade) {
    leds[cor].material.emissiveIntensity = intensidade * 2.2;
    leds[cor].halo.material.opacity = intensidade * 0.9;
  }

  function definirExplosao(t) {
    explosao = THREE.MathUtils.clamp(t, 0, 1);
    const suave = explosao * explosao * (3 - 2 * explosao);
    for (const g of Object.values(grupos)) g.position.copy(g.userData.deslocamento).multiplyScalar(suave);
    cabos.visible = explosao < 0.02;
    caboEnergia.visible = suporte === 'onibus' && explosao < 0.02;
    for (const r of rotulos) r.visible = explosao > 0.6;
  }

  function definirSuporte(tipo) {
    suporte = ['onibus', 'kit', 'nenhum'].includes(tipo) ? tipo : 'onibus';
    suporteOnibus.visible = suporte === 'onibus';
    suporteKit.visible = suporte === 'kit';
    caboEnergia.visible = suporte === 'onibus' && explosao < 0.02;
  }

  function atualizar(tempo) {
    const e = ESTADOS[estadoAtual];
    for (const cor of Object.keys(leds)) acender(cor, 0);
    if (e.led === 'amarelo-piscando') acender('amarelo', Math.floor(tempo * 2) % 2 === 0 ? 1 : 0);
    else acender(e.led, 1);
    if (estadoAtual === 'CRITICO') {
      const fase = (tempo - inicioFlash) % 2.4;
      acender('azul', fase < 0.3 ? 1 : 0);
    }
  }

  definirEstado('NORMAL');
  definirExplosao(0);
  definirSuporte('onibus');

  return { grupo: raiz, definirEstado, definirExplosao, definirSuporte, atualizar, rotulos, pecas };
}
