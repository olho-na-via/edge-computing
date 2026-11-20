# Olho na Via · Modelo 3D do dispositivo

Modelo 3D do dispositivo IoT do Olho na Via, feito com **three.js**. Ele tem dois usos:

1. **Impressão 3D:** gabinete em peças com malha fechada, já orientadas para a mesa (`stl/`).
2. **Landing page:** visualizador interativo com display aceso, LEDs por estado, vista explodida e as versões Ônibus e Kit Cidadão (`index.html`).
3. **Simulador do firmware:** o `../simulador` importa este mesmo `visualizador.js` e comanda o LCD, os LEDs, o buzzer e a chave liga/desliga em tempo real.

As medidas e a disposição interna seguem o `../COMPONENTES.md`.

## Arquivos

| Arquivo | Para que serve |
|---|---|
| `index.html` | Página de demonstração (seção de landing page) com o visualizador e os links dos STL |
| `visualizador.js` | Cena three.js: luzes, sombra, câmera, controles, rótulos e exportação GLB/PNG |
| `dispositivo.js` | Monta o dispositivo: gabinete, eletrônica interna, display 16×2, LEDs, antena e suportes |
| `pecas.js` | Geometria das peças imprimíveis (milímetros), com operações booleanas do `manifold-3d` |
| `gerar_stl.mjs` | Gera `stl/*.stl` e `modelo/gabinete.glb` e confere se as malhas estão fechadas |
| `modelo/gabinete.glb` | Gabinete em coordenadas de montagem, carregado pelo visualizador (342 KB) |
| `stl/` | Arquivos de impressão |
| `assets/` | Fonte Urbanist e logos |

## Ver no navegador

Os módulos ES e o `.glb` precisam de um servidor HTTP; abrir o arquivo direto (`file://`) não funciona.

```bash
cd edge-computing-e-computer-systems/modelo-3d
python -m http.server 8000
# abra http://localhost:8000
```

O `index.html` carrega o three.js 0.187 pelo CDN do jsDelivr (veja o `importmap`), então não precisa de `npm install` para visualizar.

## Usar na landing page

**Página estática:** copie a pasta inteira (sem `node_modules`) e coloque o mesmo `importmap` do `index.html` no `<head>`. Depois:

```html
<div id="modelo" style="height: 600px"></div>
<script type="module">
  import { criarVisualizador } from './modelo-3d/visualizador.js';
  const v = await criarVisualizador(document.getElementById('modelo'), { autoRotacao: true });
  v.definirEstado('CRITICO');   // NORMAL | ATENCAO | CRITICO | FALHA
</script>
```

Inclua também o estilo dos rótulos da vista explodida (classe `.rotulo-3d`, no `<style>` do `index.html`).

**React + Vite:** `npm install three`, copie `visualizador.js`, `dispositivo.js` e `modelo/gabinete.glb` (para `public/`) e chame o visualizador num `useEffect`:

```jsx
useEffect(() => {
  let v;
  criarVisualizador(ref.current, { urlGabinete: '/gabinete.glb' }).then((x) => { v = x; });
  return () => v?.destruir();
}, []);
```

### Funções do visualizador

| Função | O que faz |
|---|---|
| `definirEstado('NORMAL' \| 'ATENCAO' \| 'CRITICO' \| 'FALHA')` | Troca o texto do LCD e os LEDs (o CRÍTICO pisca o LED azul da câmera; a FALHA pisca o amarelo) |
| `definirAtuadores({ lcd, leds, buzzer, chave })` | Atuadores comandados de fora, em tempo real: `lcd: [linha1, linha2]` (qualquer texto ASCII), `leds: { verde, amarelo, vermelho, azul }` de 0 a 1, `buzzer` em `true`/`false` e `chave` (posição da chave liga/desliga; desligada, o LCD apaga). Cada chamada troca só o que foi informado; `definirEstado()` volta ao modo fixo |
| `definirOrientacao(x, y, z)` | Inclina o dispositivo (radianos), para acompanhar o giroscópio de um celular |
| `definirExplosao(0 a 1)` | Abre a vista explodida com rótulos dos componentes |
| `definirSuporte('onibus' \| 'kit' \| 'nenhum')` | Ventosa de para-brisa com cabo de 24 V, ou abraçadeira de guidão |
| `irPara('traseira' \| 'frontal' \| 'explodida')` | Move a câmera suavemente. Também aceita `{ posicao: [x, y, z], alvo: [x, y, z] }` |
| `definirAutoRotacao(true/false)` | Liga ou desliga o giro automático |
| `exportarGLB()` | Devolve um `Blob` com o modelo completo (para Blender, Keyshot ou renderizadores de IA) |
| `capturarImagem()` | PNG da vista atual, com fundo transparente |
| `destruir()` | Libera a cena (útil em React) |

### Opções de `criarVisualizador(container, opcoes)`

| Opção | Padrão | O que faz |
|---|---|---|
| `autoRotacao` | `true` | Giro automático até o primeiro toque |
| `fundoTransparente` | `true` | Sem cor de fundo, para usar o fundo da página |
| `urlGabinete` | `./modelo/gabinete.glb` | Endereço do GLB quando ele fica em outra pasta |
| `leve` | `false` | Sem sombras nem transmissão de luz nos acrílicos, para celulares |
| `ajustarZoom` | `false` | Afasta a câmera em telas estreitas, para o modelo caber |
| `vista` | `'traseira'` | Câmera inicial: nome de uma vista ou `{ posicao, alvo }` |
| `aoChave()` | — | Chamado quando a pessoa toca na chave liga/desliga do modelo |

## Impressão 3D

### Peças

| Arquivo | Peça | Cor sugerida | Medidas (mm) |
|---|---|---|---|
| `tampa-frontal.stl` | Frente: janela da câmera, furo do LDR, trilhos da ESP32-CAM, pontos 1/4" no topo e na base, prensa-cabo | verde-escuro `#16230E` | 140 × 95 × 18 |
| `anel-verde.stl` | Faixa verde entre as tampas, com os furos dos parafusos | verde `#72C000` | 140 × 95 × 6 |
| `tampa-traseira.stl` | Traseira: janela do LCD, 4 LEDs, furo da chave liga/desliga, grade do buzzer, logo, antena, ventilação e postes internos | verde-escuro `#16230E` | 140 × 95 × 24 |
| `anel-camera.stl` | Aro decorativo da lente | verde `#72C000` | Ø 19,6 × 1 |
| `anel-botao.stl` | Aro decorativo da chave liga/desliga | verde `#72C000` | Ø 18 × 1 |
| `logo-centro.stl` + `logo-asas.stl` | Preenchimento do logo gravado (opcional, multicor) | branco e verde | 0,6 de espessura |

O anel `anel-botao.stl` é o aro da chave liga/desliga (gangorra redonda de 12 mm): o arquivo manteve o nome de quando havia um botão nesse furo.

O gabinete montado mede **140 × 95 × 48 mm**. As três peças do corpo saem de um único sólido cortado em fatias, então encaixam sem folga.

`npm run stl` confere cada malha: hoje todas estão fechadas (nenhuma aresta aberta), condição para o fatiador não precisar consertar nada.

### Configuração sugerida

- **Material:** PETG ou ASA. PLA amolece atrás do para-brisa no sol.
- **Camada:** 0,2 mm · **perímetros:** 4 · **preenchimento:** 25% giroide · **sem suportes**.
- **Orientação:** os STL já saem com a face externa na mesa. Nas tampas, o furo do prensa-cabo e o da antena ficam na horizontal e imprimem sem suporte.
- **Logo multicor (AMS/MMU):** importe `tampa-traseira.stl`, `logo-centro.stl` e `logo-asas.stl` juntos, como um único objeto com três partes. Os três arquivos já estão alinhados. Sem multicor, imprima só a tampa: o logo fica gravado 0,6 mm.

### Ferragens

| Qtd | Item | Onde |
|---|---|---|
| 4 | Parafuso M3 × 30 cabeça escareada (DIN 7991) | Da frente, atravessa a tampa frontal e o anel |
| 4 | Inserto roscado M3 a quente (furo de 4,0 mm, 5–6 mm de altura) | Pilares da tampa traseira |
| 8 | Parafuso M3 × 6 autoatarraxante (ou M2,5) | LCD (4) e placa perfurada (4) nos postes |
| 2 | Porca 1/4"-20 | Encaixes sextavados do topo (ventosa) e da base (guidão) |
| 1 | Prensa-cabo PG7 | Lateral direita, só para o cabo de energia |
| 1 | Disco de acrílico fumê Ø 18 × 2 mm | Atrás da janela da câmera (encaixe interno) |
| 1 | Acrílico transparente 71,6 × 24,6 × 1 mm | Atrás da janela do LCD (encaixe interno) |

### Montagem

1. Coloque os insertos M3 nos 4 pilares da tampa traseira com o ferro de solda.
2. Coloque as porcas 1/4" nos encaixes sextavados do topo e da base (por dentro da tampa frontal).
3. Cole o disco fumê e o anel verde da câmera; cole o acrílico do LCD por dentro da tampa traseira.
4. Deslize a ESP32-CAM de baixo para cima nos trilhos, com a lente para a frente. O módulo LDR fica ao lado, com o sensor no furo de 5 mm.
5. Na tampa traseira: LEDs na placa de LEDs, buzzer no anel encaixe, chave liga/desliga com o anel verde, LCD nos 4 postes, placa perfurada (ESP32 + MPU-6050) nos postes mais longos.
6. T-Beam com a bateria deitado no fundo, conversor DC-DC no canto superior esquerdo da frente, antena SMA no furo do topo.
7. Feche: tampa frontal, anel verde e tampa traseira, com os 4 parafusos M3 pela frente.

## Gerar de novo

```bash
npm install
npm run stl      # recria stl/*.stl e modelo/gabinete.glb
```

Para mudar uma medida, edite o objeto `M` no começo do `pecas.js` (furos, posições, espessura de parede) e rode o comando de novo. O visualizador usa o novo `gabinete.glb` automaticamente.
