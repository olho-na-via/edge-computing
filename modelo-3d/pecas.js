// Peças imprimíveis do dispositivo Olho na Via (unidade: milímetro).
// Eixos do modelo: X = largura, Y = altura, Z = profundidade.
// A face traseira (display, LEDs, botão) fica em +Z; a face frontal (câmera, para-brisa) em -Z.
// O gabinete é um único sólido cortado em três peças: tampa frontal, anel verde e tampa traseira.
// As operações booleanas usam o manifold-3d, que sempre devolve malhas fechadas (prontas para o fatiador).

import * as THREE from 'three';
import Module from 'manifold-3d';

export const M = {
  largura: 140,
  altura: 95,
  profundidade: 48,
  raioCanto: 12,
  bisel: 2.5,
  parede: 2.4,
  corteFrontal: -6,
  corteTraseiro: 0,
  camera: { x: 0, y: 22 },
  ldr: { x: 20, y: 22 },
  lcd: { x: 0, y: 20 },
  leds: [-24, -8, 8, 24],
  ledY: -6,
  botao: { x: 50, y: -30 },
  buzzer: { x: -50, y: -30 },
  logo: { x: 0, y: -30, largura: 34 },
  antena: { x: -52, z: 12 },
  suporteTopo: { x: 0, z: -15 },
  suporteBase: { x: 50, z: -15 },
  prensaCabo: { y: -20, z: -15 },
  postesPlaca: [[43.5, -17], [-43.5, -17], [43.5, 27], [-43.5, 27]],
};

const zFrente = -M.profundidade / 2;
const zTras = M.profundidade / 2;
const zFrenteInterna = zFrente + M.parede;
const zTrasInterna = zTras - M.parede;
const yTopoInterno = M.altura / 2 - M.parede;

// Centro dos pilares dos parafusos M3, encostados nos cantos internos
export const PILARES = (() => {
  const cx = M.largura / 2 - M.raioCanto;
  const cy = M.altura / 2 - M.raioCanto;
  const d = 6 / Math.SQRT2;
  return [[1, 1], [-1, 1], [1, -1], [-1, -1]].map(([sx, sy]) => [sx * (cx + d), sy * (cy + d)]);
})();

// Ícone do Olho na Via (mesmo desenho de identidade-visual/icon-white-bg.svg)
const ICONE_VIEWBOX = { x: 63.3, y: 133.9, w: 384.9, h: 245.1 };
const ICONE_CENTRO = 'M251.246 136.011C257.834 135.676 265.393 136.178 271.893 136.984C275.659 144.707 279.348 153.138 282.956 160.983L304.228 207.23L356.978 321.965C334.566 355.364 301.101 374.858 260.799 376.936C251.275 377.321 241.738 376.599 232.38 374.791C199.55 368.367 172.975 349.552 154.465 322.004C155.147 320.104 156.645 317.074 157.521 315.171L163.145 302.949L180.899 264.348L239.477 136.994C243.382 136.476 247.31 136.149 251.246 136.011ZM247.825 361.068C253.023 361.066 258.378 361.134 263.561 361.056L263.581 336.426L247.815 336.422L247.825 361.068ZM263.583 287.175C258.514 287.129 253.445 287.121 248.377 287.15L247.872 287.34C247.681 289.067 247.804 293.866 247.805 295.788L247.822 311.793L263.197 311.791C263.577 311.46 263.551 311.551 263.567 310.878C263.626 308.255 263.599 305.566 263.599 302.943L263.583 287.175ZM247.814 237.9L247.821 262.501L263.575 262.495L263.581 237.9H247.814ZM263.581 188.612C258.367 188.608 253.016 188.541 247.815 188.613L247.825 213.217L263.573 213.207L263.581 188.612ZM263.583 151.653C258.5 151.608 252.897 151.532 247.821 151.648L247.825 163.96C253.008 163.959 258.39 164.035 263.555 163.947C263.597 159.849 263.605 155.751 263.583 151.653Z';
const ICONE_ASAS = 'M153.911 191.636C153.777 192.165 151.482 195.804 151.065 196.544C149.785 198.852 148.55 201.184 147.358 203.538C143.687 210.839 140.672 219.449 138.696 227.335C132.403 252.678 134.486 279.378 144.632 303.438C147.542 310.292 150.388 315.291 154.163 321.61C150.615 319.938 145.82 317.225 142.393 315.27C131.709 309.159 121.364 302.474 111.404 295.243C94.8509 283.336 80.0648 270.451 65.2561 256.513C91.4522 230.736 121.219 208.861 153.641 191.559L153.911 191.636ZM357.419 191.552C358.524 191.971 359.758 192.625 360.808 193.178C392.285 209.796 420.465 232.058 446.184 256.481C430.846 270.891 417.526 282.326 400.567 294.85C390.178 302.422 379.368 309.398 368.189 315.748C365.301 317.374 360.259 320.251 357.298 321.465C363.342 312.001 368.04 301.74 371.254 290.98C379.14 264.444 377.699 236.007 367.174 210.405C365.465 206.348 363.553 202.38 361.438 198.52C360.135 196.174 358.694 193.914 357.419 191.552Z';

let Manifold;
let CrossSection;

async function iniciar() {
  if (Manifold) return;
  const wasm = await Module();
  wasm.setup();
  Manifold = wasm.Manifold;
  CrossSection = wasm.CrossSection;
}

const LADOS = 64;

function caixa(x0, x1, y0, y1, z0, z1) {
  return Manifold.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0]);
}

// Cilindro (ou cone, se r0 != r1) ao longo de um eixo, de a até b
function cilindro(eixo, c1, c2, a, b, r0, r1 = r0, lados = LADOS) {
  let c = Manifold.cylinder(b - a, r0, r1, lados).translate([0, 0, a]);
  if (eixo === 'z') return c.translate([c1, c2, 0]);
  if (eixo === 'y') return c.rotate([-90, 0, 0]).translate([c1, 0, c2]);
  return c.rotate([0, 90, 0]).translate([0, c1, c2]);
}

function tubo(eixo, c1, c2, a, b, rExterno, rInterno) {
  return cilindro(eixo, c1, c2, a, b, rExterno).subtract(cilindro(eixo, c1, c2, a - 1, b + 1, rInterno));
}

function retanguloArredondado(w, h, r, passos = 16) {
  const pontos = [];
  const cantos = [[w / 2 - r, h / 2 - r, 0], [-w / 2 + r, h / 2 - r, 90], [-w / 2 + r, -h / 2 + r, 180], [w / 2 - r, -h / 2 + r, 270]];
  for (const [cx, cy, inicio] of cantos) {
    for (let i = 0; i <= passos; i++) {
      const a = THREE.MathUtils.degToRad(inicio + (90 * i) / passos);
      pontos.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
    }
  }
  return new CrossSection([pontos], 'NonZero');
}

// Bloco com cantos de raio R no plano XY e todas as arestas externas arredondadas (raio b)
function blocoArredondado() {
  const { largura: L, altura: A, profundidade: P, raioCanto: R, bisel: b } = M;
  const pecas = [];
  const passos = 6;
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
    for (let k = 0; k <= passos; k++) {
      const t = (Math.PI / 2) * (k / passos);
      const r = R - b + b * Math.cos(t);
      const meia = P / 2 - b + b * Math.sin(t);
      pecas.push(Manifold.cylinder(2 * meia, r, r, 96, true).translate([sx * (L / 2 - R), sy * (A / 2 - R), 0]));
    }
  }
  return Manifold.hull(pecas);
}

// Leitor simples de caminhos SVG (comandos M, L, H, V, C, Z) para contornos 2D em mm
function contornosDoCaminho(d) {
  const caminho = new THREE.ShapePath();
  const partes = d.match(/[MLHVCZmlhvcz]|-?\d*\.?\d+(?:e-?\d+)?/g);
  const vb = ICONE_VIEWBOX;
  const escala = M.logo.largura / vb.w;
  const px = (x) => (x - (vb.x + vb.w / 2)) * escala;
  const py = (y) => -(y - (vb.y + vb.h / 2)) * escala;
  let i = 0;
  let cmd = '';
  let x = 0;
  let y = 0;
  const num = () => parseFloat(partes[i++]);
  while (i < partes.length) {
    if (/[A-Za-z]/.test(partes[i])) cmd = partes[i++];
    if (cmd === 'Z' || cmd === 'z') continue;
    if (cmd === 'M') { x = num(); y = num(); caminho.moveTo(px(x), py(y)); cmd = 'L'; }
    else if (cmd === 'L') { x = num(); y = num(); caminho.lineTo(px(x), py(y)); }
    else if (cmd === 'H') { x = num(); caminho.lineTo(px(x), py(y)); }
    else if (cmd === 'V') { y = num(); caminho.lineTo(px(x), py(y)); }
    else if (cmd === 'C') {
      const x1 = num(); const y1 = num(); const x2 = num(); const y2 = num(); x = num(); y = num();
      caminho.bezierCurveTo(px(x1), py(y1), px(x2), py(y2), px(x), py(y));
    } else { i++; }
  }
  return caminho.subPaths.map((sub) => sub.getPoints(8).map((p) => [p.x + M.logo.x, p.y + M.logo.y]));
}

function logoExtrudado(caminhos, z0, z1) {
  const contornos = caminhos.flatMap(contornosDoCaminho);
  const secao = new CrossSection(contornos, 'EvenOdd');
  return Manifold.extrude(secao, z1 - z0).translate([0, 0, z0]);
}

function corpoDoGabinete() {
  const { largura: L, altura: A, profundidade: P, raioCanto: R, parede: e } = M;

  const interno = Manifold.extrude(retanguloArredondado(L - 2 * e, A - 2 * e, R - e), P - 2 * e, 0, 0, [1, 1], true);
  let corpo = blocoArredondado().subtract(interno);

  const reforcos = [corpo];
  for (const [x, y] of PILARES) reforcos.push(cilindro('z', x, y, zFrenteInterna - 0.6, zTrasInterna + 0.6, 4.2));

  // Câmera: anel interno para o acrílico e trilhos que seguram a ESP32-CAM
  reforcos.push(cilindro('z', M.camera.x, M.camera.y, zFrenteInterna - 0.6, zFrenteInterna + 2.6, 13));
  for (const s of [1, -1]) reforcos.push(caixa(s > 0 ? 13.5 : -17, s > 0 ? 17 : -13.5, -10, 34, zFrenteInterna - 0.4, -11));

  // Pontos de fixação 1/4" (ventosa no topo, suporte de guidão na base)
  reforcos.push(cilindro('y', M.suporteTopo.x, M.suporteTopo.z, 37, yTopoInterno + 0.8, 8));
  reforcos.push(cilindro('y', M.suporteBase.x, M.suporteBase.z, -yTopoInterno - 0.8, -37, 8));

  // Postes do LCD (furação 75 x 31 mm) e da placa principal
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    reforcos.push(cilindro('z', M.lcd.x + sx * 37.5, M.lcd.y + sy * 15.5, zTrasInterna - 7, zTrasInterna + 0.6, 2.75));
  }
  for (const [x, y] of M.postesPlaca) reforcos.push(cilindro('z', x, y, 1.6, zTrasInterna + 0.6, 3));

  // Encaixe do buzzer
  reforcos.push(tubo('z', M.buzzer.x, M.buzzer.y, zTrasInterna - 8, zTrasInterna + 0.4, 7.75, 6.2));

  corpo = Manifold.union(reforcos);

  const furos = [];
  for (const [x, y] of PILARES) {
    furos.push(cilindro('z', x, y, zFrente - 1, M.corteTraseiro - 0.3, 1.7, 1.7, 32));
    furos.push(cilindro('z', x, y, zFrente - 1, zFrente + 1.55, 4.25, 1.7, 32));
    furos.push(cilindro('z', x, y, M.corteTraseiro - 0.3, 7, 2.0, 2.0, 32));
  }

  furos.push(cilindro('z', M.camera.x, M.camera.y, zFrente - 1, zFrenteInterna + 3, 7));
  furos.push(cilindro('z', M.camera.x, M.camera.y, zFrente - 1, zFrente + 1, 10));
  furos.push(cilindro('z', M.camera.x, M.camera.y, zFrente + 2, zFrenteInterna + 3, 9.2));
  furos.push(cilindro('z', M.ldr.x, M.ldr.y, zFrente - 1, zFrenteInterna + 1, 2.6, 2.6, 32));
  for (const s of [1, -1]) furos.push(caixa(s > 0 ? 12.5 : -14.6, s > 0 ? 14.6 : -12.5, -11, 32, -16.95, -15.05));

  furos.push(cilindro('y', M.suporteTopo.x, M.suporteTopo.z, 36, M.altura / 2 + 1, 3.3, 3.3, 32));
  furos.push(cilindro('y', M.suporteTopo.x, M.suporteTopo.z, 36.5, 42.5, 6.6, 6.6, 6));
  furos.push(cilindro('y', M.suporteBase.x, M.suporteBase.z, -M.altura / 2 - 1, -36, 3.3, 3.3, 32));
  furos.push(cilindro('y', M.suporteBase.x, M.suporteBase.z, -42.5, -36.5, 6.6, 6.6, 6));
  furos.push(cilindro('x', M.prensaCabo.y, M.prensaCabo.z, M.largura / 2 - 5, M.largura / 2 + 1, 6.35));

  furos.push(caixa(M.lcd.x - 33, M.lcd.x + 33, M.lcd.y - 9, M.lcd.y + 9, zTrasInterna - 1, zTras + 1));
  furos.push(caixa(M.lcd.x - 36, M.lcd.x + 36, M.lcd.y - 12.5, M.lcd.y + 12.5, zTrasInterna - 1, zTrasInterna + 1.2));
  for (const sx of [1, -1]) for (const sy of [1, -1]) {
    furos.push(cilindro('z', M.lcd.x + sx * 37.5, M.lcd.y + sy * 15.5, zTrasInterna - 7.5, zTrasInterna - 1, 1.25, 1.25, 24));
  }
  for (const [x, y] of M.postesPlaca) furos.push(cilindro('z', x, y, 1, 9, 1.25, 1.25, 24));
  for (const x of M.leds) furos.push(cilindro('z', x, M.ledY, zTrasInterna - 1, zTras + 1, 2.6, 2.6, 32));
  furos.push(cilindro('z', M.botao.x, M.botao.y, zTrasInterna - 1, zTras + 1, 6.15));
  for (const [dx, dy] of [[0, 0], [3.5, 0], [-3.5, 0], [0, 3.5], [0, -3.5]]) {
    furos.push(cilindro('z', M.buzzer.x + dx, M.buzzer.y + dy, zTrasInterna - 1, zTras + 1, 0.8, 0.8, 16));
  }
  for (const y of [0, 6, 12, 18, 24]) furos.push(caixa(-M.largura / 2 - 1, -M.largura / 2 + 3, y - 1, y + 1, 5, 19));
  furos.push(cilindro('y', M.antena.x, M.antena.z, yTopoInterno - 1, M.altura / 2 + 1, 3.3, 3.3, 32));

  furos.push(logoExtrudado([ICONE_CENTRO, ICONE_ASAS], zTras - 0.6, zTras + 1));

  return corpo.subtract(Manifold.union(furos));
}

function fatia(corpo, z0, z1) {
  return corpo.intersect(caixa(-100, 100, -100, 100, z0, z1));
}

export function paraGeometria(manifold) {
  const malha = manifold.getMesh();
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(malha.vertProperties), 3));
  g.setIndex(new THREE.BufferAttribute(new Uint32Array(malha.triVerts), 1));
  return g;
}

// Constrói todas as peças em coordenadas de montagem (mm). Devolve objetos Manifold.
export async function construirPecas() {
  await iniciar();
  const corpo = corpoDoGabinete();
  return {
    tampaFrontal: fatia(corpo, -100, M.corteFrontal),
    anelVerde: fatia(corpo, M.corteFrontal, M.corteTraseiro),
    tampaTraseira: fatia(corpo, M.corteTraseiro, 100),
    anelCamera: tubo('z', M.camera.x, M.camera.y, zFrente, zFrente + 1, 9.8, 7.1),
    anelBotao: tubo('z', M.botao.x, M.botao.y, zTras, zTras + 1, 9, 6.3),
    logoCentro: logoExtrudado([ICONE_CENTRO], zTras - 0.6, zTras),
    logoAsas: logoExtrudado([ICONE_ASAS], zTras - 0.6, zTras),
  };
}

// Informações de cada peça para impressão
export const IMPRESSAO = {
  tampaFrontal: { arquivo: 'tampa-frontal', cor: 'verde-escuro #16230E', virar: false, nome: 'Tampa frontal (câmera)' },
  anelVerde: { arquivo: 'anel-verde', cor: 'verde #72C000', virar: false, nome: 'Anel verde central' },
  tampaTraseira: { arquivo: 'tampa-traseira', cor: 'verde-escuro #16230E', virar: true, nome: 'Tampa traseira (display)' },
  anelCamera: { arquivo: 'anel-camera', cor: 'verde #72C000', virar: false, nome: 'Anel da câmera' },
  anelBotao: { arquivo: 'anel-botao', cor: 'verde #72C000', virar: false, nome: 'Anel do botão' },
  logoCentro: { arquivo: 'logo-centro', cor: 'branco #F7FAFC', virar: true, nome: 'Logo: centro (multicor)' },
  logoAsas: { arquivo: 'logo-asas', cor: 'verde #72C000', virar: true, nome: 'Logo: asas (multicor)' },
};

// Posiciona a peça na mesa: face externa para baixo, Z para cima, centralizada em X e Y.
// Devolve também o deslocamento, para alinhar as peças do logo multicor com a tampa traseira.
export function orientarParaImpressao(geometria, virar) {
  const g = geometria.clone();
  if (virar) g.rotateY(Math.PI);
  g.computeBoundingBox();
  const c = g.boundingBox;
  const deslocamento = new THREE.Vector3(-(c.min.x + c.max.x) / 2, -(c.min.y + c.max.y) / 2, -c.min.z);
  g.translate(deslocamento.x, deslocamento.y, deslocamento.z);
  return { geometria: g, deslocamento };
}

// Acesso à classe Manifold (depois de construirPecas), útil para inspeções
export function classeManifold() {
  return Manifold;
}
