// Visualizador 3D do dispositivo Olho na Via, pronto para ser incorporado na landing page.
// Uso:
//   import { criarVisualizador } from './visualizador.js';
//   const v = await criarVisualizador(document.querySelector('#modelo'), { autoRotacao: true });
//   v.definirEstado('CRITICO'); v.definirExplosao(1); v.definirSuporte('kit');
// No simulador do firmware, os atuadores vêm de fora:
//   v.definirAtuadores({ lcd: ['CRITICO  ONLINE', 'Buraco 1.20g'], leds: { vermelho: 1 }, buzzer: true, chave: true });

import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { CSS2DRenderer } from 'three/addons/renderers/CSS2DRenderer.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { criarDispositivo } from './dispositivo.js';

const VISTAS = {
  traseira: { posicao: [260, 160, 450], alvo: [0, 18, 0] },
  frontal: { posicao: [-250, 120, -360], alvo: [0, 12, -20] },
  explodida: { posicao: [520, 230, 420], alvo: [0, -10, 0] },
};

export async function criarVisualizador(container, opcoes = {}) {
  // leve: sem sombras nem transmissão de luz (celulares) · ajustarZoom: afasta a câmera em telas estreitas
  // aoChave(): toque na chave liga/desliga do modelo
  // vista: nome de uma das VISTAS ou { posicao: [x, y, z], alvo: [x, y, z] } para a câmera inicial
  const { autoRotacao = true, fundoTransparente = true, urlGabinete, leve = false, ajustarZoom = false, aoChave, vista } = opcoes;
  const resolverVista = (v) => (typeof v === 'string' ? VISTAS[v] : v);
  const vistaInicial = resolverVista(vista) || VISTAS.traseira;

  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: fundoTransparente, preserveDrawingBuffer: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, leve ? 1.5 : 2));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = !leve;
  renderer.shadowMap.type = THREE.PCFShadowMap;
  container.appendChild(renderer.domElement);

  const rotulosRenderer = new CSS2DRenderer();
  rotulosRenderer.domElement.style.position = 'absolute';
  rotulosRenderer.domElement.style.inset = '0';
  rotulosRenderer.domElement.style.pointerEvents = 'none';
  container.style.position ||= 'relative';
  container.appendChild(rotulosRenderer.domElement);

  const cena = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  cena.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  cena.environmentIntensity = 0.75;
  if (!fundoTransparente) cena.background = new THREE.Color(0xf7fafc);

  const camera = new THREE.PerspectiveCamera(30, 1, 5, 5000);
  camera.position.set(...vistaInicial.posicao);

  const principal = new THREE.DirectionalLight(0xffffff, 2.2);
  principal.position.set(160, 260, 220);
  principal.castShadow = true;
  principal.shadow.mapSize.set(2048, 2048);
  principal.shadow.camera.left = -520;
  principal.shadow.camera.right = 520;
  principal.shadow.camera.top = 520;
  principal.shadow.camera.bottom = -520;
  principal.shadow.camera.far = 1500;
  principal.shadow.radius = 6;
  principal.shadow.bias = -0.0004;
  cena.add(principal);
  const contorno = new THREE.DirectionalLight(0xd8f0b8, 1.1);
  contorno.position.set(-240, 120, -200);
  cena.add(contorno);

  const sombra = new THREE.Mesh(new THREE.PlaneGeometry(2000, 2000), new THREE.ShadowMaterial({ opacity: 0.1 }));
  sombra.rotation.x = -Math.PI / 2;
  sombra.position.y = -125;
  sombra.receiveShadow = true;
  cena.add(sombra);

  const controles = new OrbitControls(camera, renderer.domElement);
  controles.enableDamping = true;
  controles.dampingFactor = 0.08;
  controles.minDistance = 160;
  controles.maxDistance = 1100;
  controles.target.set(...vistaInicial.alvo);
  controles.autoRotate = autoRotacao;
  controles.autoRotateSpeed = 0.8;
  controles.addEventListener('start', () => { controles.autoRotate = false; });

  const dispositivo = await criarDispositivo(urlGabinete ? { urlGabinete, leve } : { leve });
  cena.add(dispositivo.grupo);

  // Toque na chave liga/desliga: só vale se ela for a primeira peça atingida (não vale por trás do gabinete)
  const raio = new THREE.Raycaster();
  const ponteiro = new THREE.Vector2();

  function tocouNaChave(evento) {
    const area = renderer.domElement.getBoundingClientRect();
    ponteiro.set(((evento.clientX - area.left) / area.width) * 2 - 1, -((evento.clientY - area.top) / area.height) * 2 + 1);
    raio.setFromCamera(ponteiro, camera);
    const atingido = raio.intersectObject(dispositivo.grupo, true).find((i) => i.object.isMesh);
    for (let o = atingido?.object; o; o = o.parent) if (o === dispositivo.chave) return true;
    return false;
  }

  function aoApertar(evento) {
    if (!aoChave || !tocouNaChave(evento)) return;
    evento.stopPropagation();
    aoChave();
  }

  // Fase de captura: o toque na chave não chega aos controles de órbita
  container.addEventListener('pointerdown', aoApertar, true);

  function ajustarTamanho() {
    const { clientWidth: w, clientHeight: h } = container;
    renderer.setSize(w, h, false);
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    rotulosRenderer.setSize(w, h);
    camera.aspect = w / Math.max(h, 1);
    if (ajustarZoom) camera.zoom = Math.min(1, camera.aspect / 1.1);
    camera.updateProjectionMatrix();
  }
  const observador = new ResizeObserver(ajustarTamanho);
  observador.observe(container);
  ajustarTamanho();

  let explosaoAlvo = 0;
  let explosaoAtual = 0;
  let transicaoCamera = null;
  const inicio = performance.now();
  const agora = () => (performance.now() - inicio) / 1000;

  function animar() {
    const tempo = agora();
    if (Math.abs(explosaoAlvo - explosaoAtual) > 0.001) {
      explosaoAtual += (explosaoAlvo - explosaoAtual) * 0.09;
      dispositivo.definirExplosao(explosaoAtual);
    }
    if (transicaoCamera) {
      const t = Math.min((tempo - transicaoCamera.inicio) / 1.2, 1);
      const k = t * t * (3 - 2 * t);
      camera.position.lerpVectors(transicaoCamera.dePos, transicaoCamera.paraPos, k);
      controles.target.lerpVectors(transicaoCamera.deAlvo, transicaoCamera.paraAlvo, k);
      if (t === 1) transicaoCamera = null;
    }
    dispositivo.atualizar(tempo);
    controles.update();
    renderer.render(cena, camera);
    rotulosRenderer.render(cena, camera);
  }
  renderer.setAnimationLoop(animar);

  // Aceita o nome de uma das VISTAS ou { posicao, alvo }
  function irPara(nome) {
    const v = resolverVista(nome);
    if (!v) return;
    transicaoCamera = {
      inicio: agora(),
      dePos: camera.position.clone(), paraPos: new THREE.Vector3(...v.posicao),
      deAlvo: controles.target.clone(), paraAlvo: new THREE.Vector3(...v.alvo),
    };
  }

  async function exportarGLB() {
    const rotulosVisiveis = dispositivo.rotulos.map((r) => r.visible);
    dispositivo.rotulos.forEach((r) => { r.visible = false; });
    const dados = await new GLTFExporter().parseAsync(dispositivo.grupo, { binary: true, onlyVisible: true });
    dispositivo.rotulos.forEach((r, i) => { r.visible = rotulosVisiveis[i]; });
    return new Blob([dados], { type: 'model/gltf-binary' });
  }

  function capturarImagem() {
    renderer.render(cena, camera);
    return renderer.domElement.toDataURL('image/png');
  }

  return {
    dispositivo,
    definirEstado: (e) => dispositivo.definirEstado(e),
    definirAtuadores: (a) => dispositivo.definirAtuadores(a),
    definirOrientacao: (x, y, z) => dispositivo.definirOrientacao(x, y, z),
    definirExplosao: (t) => { explosaoAlvo = t; },
    definirSuporte: (s) => dispositivo.definirSuporte(s),
    definirAutoRotacao: (ativo) => { controles.autoRotate = ativo; },
    irPara,
    exportarGLB,
    capturarImagem,
    destruir() {
      renderer.setAnimationLoop(null);
      observador.disconnect();
      container.removeEventListener('pointerdown', aoApertar, true);
      renderer.dispose();
      container.innerHTML = '';
    },
  };
}
