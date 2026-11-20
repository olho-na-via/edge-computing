# Olho na Via · Dispositivo IoT: componentes e briefing de renderização 3D

Documento de apoio à entrega de **Edge Computing & Computer Systems** (Global Solution 2026.2 · CitizenTech).
Ele tem duas partes:

1. **Montagem física:** todos os componentes, ligações e cuidados para construir o dispositivo real.
2. **Briefing de renderização 3D:** tudo o que outro modelo de IA (ou um designer) precisa para criar uma imagem bonita e fiel do protótipo.

O firmware (`sketch.ino`), o simulador web (`simulador/`) e a documentação técnica em PDF ficam nesta mesma pasta.

---

## 1. O que é o dispositivo

Uma caixa compacta instalada **atrás do para-brisa dos ônibus** (alimentada pelos 24 V do veículo) ou levada por **voluntários** em carro ou moto (com bateria própria). Ela:

- sente o **buraco** pelo acelerômetro (pico de aceleração, com o dispositivo em qualquer posição);
- vê pela câmera quatro problemas: **buraco**, **alagamento**, **semáforo apagado** e **faixa de pedestre apagada**. A ESP32-CAM roda a visão computacional (o modelo de `visao-computacional/`) e avisa o ESP32 a cada detecção. Para o buraco e o semáforo, a câmera é uma segunda fonte, além do acelerômetro e da luz;
- percebe o **semáforo apagado** pela falta de luz;
- sabe **onde** está pelo GPS;
- **decide sozinha** entre 4 estados (NORMAL, ATENÇÃO, CRÍTICO, FALHA) e avisa com LEDs, buzzer e um display;
- tira uma **foto anonimizada** quando o problema é crítico ou quando a central pede (comando remoto);
- envia o evento por **LoRa / Wi-Fi (MQTT)** ou guarda numa **fila offline** quando não há cobertura;
- tem uma **chave liga/desliga** no painel: desligado, apaga LEDs, display e buzzer; ao religar, reinicia.

Há um único modelo de dispositivo com **dois kits de fixação**:

| Versão | Onde fica | Energia | Fixação |
|---|---|---|---|
| **Unidade Ônibus** | Atrás do para-brisa, no canto superior direito | 24 V do ônibus por conversor DC-DC (bateria como reserva) | Ventosa com braço articulado ou fita VHB no para-brisa |
| **Kit Cidadão** | Painel do carro ou guidão da moto do voluntário | Bateria 18650 interna, recarregável | Suporte de guidão (encaixe de 1/4 de volta) ou base adesiva de painel |

---

## 2. Lista de componentes (BOM)

### 2.1 Eletrônica principal

| Qtd | Componente | Modelo / especificação | Função no dispositivo | Interface | Preço estimado* |
|---|---|---|---|---|---|
| 1 | **ESP32 DevKit** | ESP32-WROOM-32, 38 pinos (DevKit C v4 ou DevKit V1) | Cérebro: lê sensores, decide o estado, controla alertas e comunicação | — | R$ 40–60 |
| 1 | **ESP32-CAM** | AI-Thinker, câmera OV2640 (2 MP), slot microSD | Fotografa a via à frente, desfoca rostos e placas antes de salvar e roda a visão computacional que detecta buraco, alagamento, semáforo apagado e faixa de pedestre apagada | UART com o ESP32 | R$ 60–90 |
| 1 | Programador ESP32-CAM | Placa ESP32-CAM-MB (USB) | Gravar o firmware da câmera (só na bancada) | USB | R$ 15–25 |
| 1 | Cartão microSD | 16 GB, classe 10 | Guarda as fotos até o envio | SPI interno da CAM | R$ 25–35 |
| 1 | **MPU-6050** | Módulo GY-521 (acelerômetro + giroscópio de 6 eixos) | Detecta o impacto do buraco e a inclinação do dispositivo; giroscópio registra curvas | I2C (0x68) | R$ 15–25 |
| 1 | **TTGO T-Beam** | LilyGO T-Beam v1.2, **915 MHz** (faixa usada no Brasil), GPS NEO-6M ou NEO-M8N, LoRa SX1276, gerenciador de energia AXP, suporte para bateria 18650 | GPS, rádio LoRa e bateria com carregamento | UART com o ESP32 | R$ 250–350 |
| 1 | Antena LoRa | 915 MHz, conector SMA (ou IPEX + pigtail SMA) | Alcance do rádio | — | R$ 20–30 |
| 1 | Bateria | Li-ion 18650, 3.000–3.500 mAh, com proteção | Autonomia do Kit Cidadão e reserva no ônibus | Suporte do T-Beam | R$ 25–40 |
| 1 | **Display LCD 16×2** | LCD 1602 com módulo I2C PCF8574 (backlight verde-amarelado ou azul) | Mostra estado, conexão, motivo e valor medido | I2C (0x27) | R$ 25–35 |

### 2.2 Sensores e interface adicionais

| Qtd | Componente | Modelo / especificação | Função | Interface | Preço estimado* |
|---|---|---|---|---|---|
| 1 | Módulo LDR | Fotorresistor com saída analógica (AO) | Luz do semáforo (a câmera é a segunda fonte: também avisa quando vê o semáforo apagado) | ADC | R$ 5–10 |
| 1 | LED 5 mm verde | difuso | Estado NORMAL | GPIO | R$ 1 |
| 1 | LED 5 mm amarelo | difuso | Estado ATENÇÃO (pisca em FALHA) | GPIO | R$ 1 |
| 1 | LED 5 mm vermelho | difuso | Estado CRÍTICO | GPIO | R$ 1 |
| 1 | LED 5 mm azul | alto brilho | Indicador de foto (flash) | GPIO | R$ 1 |
| 4 | Resistor 220 Ω | 1/4 W | Limitar a corrente dos LEDs | — | R$ 1 |
| 1 | Buzzer passivo | 3,3–5 V, 12 mm | Alerta sonoro intermitente no CRÍTICO (`tone()` a 1 kHz) | GPIO | R$ 5 |
| 1 | Chave liga/desliga | Gangorra redonda de painel, 12 mm, 2 posições (I/O) | Liga e desliga o dispositivo: o firmware apaga tudo e, ao religar, reinicia | GPIO (pull-up interno) | R$ 5–10 |

O alagamento e a faixa de pedestre apagada não têm sensor próprio: quem detecta é a ESP32-CAM da tabela 2.1.

### 2.3 Energia, montagem e acabamento

| Qtd | Componente | Especificação | Uso |
|---|---|---|---|
| 1 | Conversor DC-DC automotivo | Entrada 8–36 V, saída 5 V / 3 A (ex.: XL4015 ou módulo automotivo selado) | Alimentação a partir dos 24 V do ônibus |
| 1 | Porta-fusível + fusível lâmina | 2 A | Proteção do circuito do ônibus |
| 1 | Diodo de proteção | Schottky 3 A (ex.: SS34) | Proteção contra inversão de polaridade |
| 1 | Gabinete | Impresso em 3D em PETG ou ASA (resistente a sol e calor), aprox. 140 × 95 × 48 mm | Caixa do dispositivo |
| 1 | Janela frontal | Acrílico fumê 2 mm | Proteção da lente da câmera e do LDR |
| 1 | Janela traseira | Acrílico transparente 2 mm | Proteção do display |
| 1 | Suporte de para-brisa | Ventosa de 70 mm com braço articulado e rosca 1/4" | Unidade Ônibus |
| 1 | Suporte de guidão / painel | Encaixe de 1/4 de volta + base de guidão ou adesiva | Kit Cidadão |
| 1 | Prensa-cabo | PG7 | Entrada do cabo de energia de 24 V |
| 1 | Placa de circuito | Placa perfurada 7 × 9 cm (protótipo) ou PCB própria | Base do ESP32, do MPU-6050 e das ligações |
| — | Conectores e fios | JST-XH 2,54 mm, fios 24 AWG, termo-retrátil | Ligações internas desmontáveis |
| — | Fixação | Parafusos M3 × 8, espaçadores de nylon M3 × 10, insertos roscados M3 | Fixar placas e fechar a tampa |
| 1 | Junta de vedação | Cordão de silicone 2 mm | Vedação IP54 da tampa |

\* Preços de varejo estimados em novembro de 2026, sem ganho de escala. Confira com fornecedores antes de comprar. Somando as tabelas 2.1 e 2.2, a eletrônica fica entre cerca de **R$ 500 e R$ 720**. Os itens de montagem da tabela 2.3 não têm preço listado; com eles, o protótipo físico deve ficar na faixa de **R$ 600 a R$ 800**, acima da estimativa de R$ 300 do Sumário Executivo porque inclui o T-Beam e a câmera.

### 2.4 Itens que existem só no simulador

O simulador web (pasta `simulador/`, veja `simulador/README.md`) roda o mesmo `sketch.ino` no navegador. Estes controles representam recursos do dispositivo e **não entram na montagem física**:

| No simulador | Representa | Na montagem física |
|---|---|---|
| Controle “Sinal de GPS” (ou o GPS do celular) | Perda do sinal de GPS | O próprio módulo GPS do T-Beam informa se tem sinal (fix) |
| Chave “Rede” no circuito | Perda da cobertura LoRa / 4G / Wi-Fi | Estado real do rádio |
| Controle “Carga” (ou a bateria do celular) | Nível de carga da bateria | Leitura do gerenciador de energia (AXP) do T-Beam |
| Webcam ou câmera do celular com o modelo de IA | Imagem e detecções da ESP32-CAM; as classes são `buraco`, `alagamento`, `semaforo_apagado` e `faixa_apagada` | A ESP32-CAM envia a linha `DET <classe> <confiança %>` pela UART |
| Broker MQTT simulado na aba (aba Eventos) | Envio por LoRa / 4G para o FIWARE | Gateway LoRa ou modem 4G ligado ao broker do FIWARE |

A chave liga/desliga do circuito não é um substituto: é a chave do painel, no mesmo GPIO 25 da montagem física. No `sketch.ino`, `EMULAR_PERIFERICOS` escolhe entre periféricos emulados (1) e os módulos reais por UART (0).

---

## 3. Ligações da montagem física

As ligações do ESP32 principal são **as mesmas do simulador**, para que o `sketch.ino` funcione sem mudanças na parte de sensores e alertas. Para usar a ESP32-CAM e o GPS reais, troque `#define EMULAR_PERIFERICOS` para `0` e instale a biblioteca TinyGPSPlus.

| Componente | Pino do componente | ESP32 | Observação |
|---|---|---|---|
| MPU-6050 | SDA · SCL · VCC · GND | GPIO 21 · GPIO 22 · 3V3 · GND | Barramento I2C compartilhado com o LCD |
| LCD 16×2 I2C | SDA · SCL · VCC · GND | GPIO 21 · GPIO 22 · **5V** · GND | Em 5 V o contraste fica correto; confira os pull-ups do módulo I2C |
| Módulo LDR | AO · VCC · GND | GPIO 34 · 3V3 · GND | ADC1, funciona junto com o Wi-Fi |
| LED verde · amarelo · vermelho · azul | ânodo (via 220 Ω) · cátodo | GPIO 19 · 18 · 5 · 17 / GND | — |
| Buzzer passivo | + · − | GPIO 16 / GND | — |
| Chave liga/desliga | terminal 1 · terminal 2 | GPIO 25 / GND | `INPUT_PULLUP`: contato aberto = ligado, fechado para o GND = desligado. A chave também pode cortar a bateria |
| ESP32-CAM | U0R · U0T · 5V · GND | TX GPIO 26 · RX GPIO 27 · 5V · GND | UART a 115200 bps: a câmera envia `DET <classe> <confiança %>`, uma linha por detecção (ex.: `DET alagamento 87`; classes `buraco`, `alagamento`, `semaforo_apagado` e `faixa_apagada`), e recebe o comando `FOTO`; fonte de 5 V com pelo menos 2 A no pico |
| TTGO T-Beam | RX · TX · GND | TX GPIO 23 · RX GPIO 4 · GND | UART do GPS (NMEA a 9600 bps, lido com a TinyGPSPlus: posição e velocidade); use GPIOs livres do conector do T-Beam conforme o pinout da revisão da placa |

**Alternativa mais enxuta:** o T-Beam já tem um ESP32. Numa segunda versão, ele pode ser o cérebro do dispositivo, ligado direto ao MPU-6050, ao LCD, aos LEDs e à ESP32-CAM, e o ESP32 DevKit sai da montagem. O DevKit continua útil na bancada e na simulação.

### 3.1 Cuidados elétricos

- **Nunca ligue o rádio LoRa sem antena:** o transmissor pode queimar.
- Use **915 MHz** (faixa de uso livre no Brasil, regulada pela Anatel). Módulos de 433 ou 868 MHz não são indicados.
- A ESP32-CAM tem picos de corrente quando liga o flash e o Wi-Fi: alimente-a direto pelo conversor de 5 V, não pelo pino 3V3 do DevKit.
- No ônibus, a tensão oscila na partida do motor: o conversor DC-DC precisa aceitar picos e ter fusível e diodo de proteção.
- O MPU-6050 deve ficar **bem preso à base do gabinete**, perto do centro da caixa, para medir o impacto do veículo e não a vibração da tampa. O impacto usa o módulo da aceleração, então vale em qualquer posição; a inclinação enviada é o ângulo entre o eixo Z do sensor e a vertical.
- Câmera e LDR olham para fora pelo para-brisa; display, LEDs e chave liga/desliga ficam voltados para dentro.
- A câmera precisa enxergar a pista à frente: é ela que detecta o alagamento e a faixa apagada e confirma o buraco e o semáforo apagado. Mantenha limpo o trecho do para-brisa na frente da lente.
- Nada no dispositivo pode exigir ação do motorista nem atrapalhar a visão da via.

---

## 4. Briefing para a renderização 3D

> Copie esta seção inteira para o modelo de IA ou para o designer. As medidas são aproximadas e servem para manter as proporções coerentes com os componentes reais.

### 4.1 Objetivo da imagem

Mostrar o **dispositivo físico do Olho na Via** como um produto real, bem acabado e confiável: algo que uma prefeitura instalaria em 1.500 ônibus e que um entregador levaria na moto. A imagem vai para a documentação técnica, para a apresentação do projeto e para o vídeo da disciplina.

Tom: **tecnologia cívica, simples e confiável**. Nada de visual militar ou de vigilância. A câmera olha o asfalto, não as pessoas.

### 4.2 Identidade visual

| Elemento | Valor |
|---|---|
| Verde da marca | `#72C000` (destaques, faixa lateral, anel da chave, logo) |
| Escuro da marca | `#16230E` (corpo principal do gabinete) |
| Fundo claro | `#F7FAFC` (fundo de estúdio) |
| Tipografia | Urbanist (geométrica, cantos arredondados), peso 700–900 nos títulos |
| Logo | Olho estilizado com uma estrada no centro e o texto “olho na via.” (ponto final em verde). Arquivos em `../identidade-visual/` (`icon-white-bg.svg`, `both-green-bg.svg`, `text-white-bg.svg`) |
| Grafismo | Faixas tracejadas verticais, como a sinalização de uma estrada |

### 4.3 Forma do gabinete

- **Dimensões:** cerca de **140 mm (largura) × 95 mm (altura) × 48 mm (profundidade)**.
- **Forma:** bloco retangular com cantos bem arredondados (raio de 12 mm) e laterais levemente afinadas; lembra um pequeno roteador ou uma câmera de painel premium.
- **Material:** plástico fosco texturizado (PETG / ASA impresso e acabado), cor `#16230E`. Uma **faixa verde `#72C000`** de 6 mm contorna a junção entre a frente e a traseira.
- **Logo:** ícone do olho com estrada gravado na face traseira, entre o buzzer e a chave liga/desliga, preenchido em branco e verde (impressão multicor).
- **Parafusos:** quatro M3 escareados nos cantos da face frontal, encostada no para-brisa e fora da vista.

### 4.4 Face frontal (voltada para a rua, encostada no para-brisa)

- **Lente da câmera** (ESP32-CAM, OV2640) no centro-superior: círculo de 14 mm atrás de uma janela de **acrílico fumê**, com um anel fino verde ao redor.
- **Janela pequena do LDR** (5 mm) ao lado da lente.
- Nada mais na frente: superfície limpa, para não refletir no para-brisa.
- No topo, o **braço articulado da ventosa** (Unidade Ônibus) com rosca de 1/4".

### 4.5 Face traseira (voltada para dentro do ônibus ou para o voluntário)

- **Display LCD 16×2** (área visível de 64 × 16 mm) no terço superior, atrás de acrílico transparente. Texto exibido, em fonte de matriz de pontos:
  - linha 1: `NORMAL   ONLINE`
  - linha 2: `0.02g Luz 76%`
  - (variação para uma imagem de alerta: `CRITICO  ONLINE` / `Buraco 1.20g`)
- Abaixo do display, uma **barra de 4 LEDs** redondos de 5 mm, alinhados, da esquerda para a direita: verde (NORMAL), amarelo (ATENÇÃO), vermelho (CRÍTICO) e azul (câmera).
- **Chave liga/desliga** no canto inferior direito: gangorra redonda de 12 mm, corpo preto e tecla branca com a marca “I” em verde, dentro de um anel verde. Na posição ligada, o lado “I” fica afundado.
- **Grade do buzzer** (5 furos de 1,5 mm) no canto inferior esquerdo.

### 4.6 Laterais, topo e base

- **Topo:** antena LoRa curta (tipo “rubber duck”, 10 cm, preta, conector SMA) saindo do canto superior esquerdo, levemente inclinada.
- **Lateral direita:** prensa-cabo PG7 por onde entra só o cabo de energia de 24 V.
- **Lateral esquerda:** cinco fendas de ventilação.
- **Base:** segundo ponto de fixação 1/4" (para o suporte de guidão do Kit Cidadão) e uma etiqueta com QR code e o identificador `olhonavia001`.

### 4.7 Alagamento: detectado pela câmera, sem peça externa

Não há sensor fora do veículo nem cabo descendo até o para-choque. A água na pista é vista pela **câmera do próprio gabinete**, com IA. Em renderizações do ônibus, mostre a detecção como uma **caixa translúcida verde sobre a água**, com um rótulo pequeno (`ALAGAMENTO 90%`), do mesmo jeito que o buraco da cena 4.

### 4.8 Vista explodida (interna)

Da frente para trás, alinhado em camadas:

1. Tampa frontal com janela fumê e anel verde da câmera.
2. **ESP32-CAM** (placa de 40 × 27 mm, lente OV2640 com cabo flat) presa num suporte inclinado de 10° para baixo, olhando a via.
3. Placa perfurada principal com o **ESP32 DevKit** (55 × 28 mm) e o **MPU-6050** (GY-521, 21 × 16 mm, roxo) no centro da caixa, com conectores JST brancos.
4. **TTGO T-Beam** (cerca de 100 × 33 mm, PCB preta) com a **bateria 18650** azul ou verde no suporte e o módulo GPS com antena cerâmica quadrada voltada para o topo.
5. **Conversor DC-DC** pequeno com dissipador, fusível de lâmina e LED vermelho de energia.
6. Tampa traseira com o **LCD 1602** (PCB verde de 80 × 36 mm com o módulo I2C preto soldado atrás), a barra de LEDs, o buzzer e a chave liga/desliga.

Use linhas finas de chamada em verde `#72C000` com rótulos em Urbanist: “Câmera OV2640”, “ESP32”, “MPU-6050”, “GPS + LoRa (T-Beam)”, “Bateria 18650”, “Display 16×2”, “LEDs de estado”, “Chave liga/desliga”.

### 4.9 Cenas sugeridas

| # | Cena | Enquadramento | Detalhes |
|---|---|---|---|
| 1 | **Hero de produto** | 3/4 frontal-lateral, câmera a 30° | Fundo `#F7FAFC` com degradê suave, sombra de contato, iluminação de estúdio com softbox; LCD aceso em `NORMAL ONLINE`, LED verde aceso |
| 2 | **Traseira em alerta** | Frontal da face traseira | LCD em `CRITICO ONLINE` / `Buraco 1.20g`, LED vermelho aceso e brilho azul do flash; fundo escuro `#16230E` |
| 3 | **Vista explodida** | Isométrica | Camadas separadas no eixo da profundidade, rótulos verdes, fundo claro |
| 4 | **Instalado no ônibus** | De dentro do ônibus, atrás do motorista, olhando pela janela | Dispositivo no canto superior direito do para-brisa; Av. Paulista ao entardecer; à frente, um buraco no asfalto destacado por uma caixa verde translúcida (como a detecção da IA); pessoas e placas de carros sem detalhes identificáveis |
| 5 | **Kit Cidadão na moto** | Close no guidão | Entregador de capacete (rosto não visível), dispositivo no suporte de guidão, LED amarelo aceso, rua molhada de São Paulo |
| 6 | **Rua alagada** | Externa, nível do chão, à frente do ônibus | Ônibus chegando a um trecho alagado; dispositivo visível atrás do para-brisa; sobre a água, uma caixa de detecção verde translúcida com o rótulo `ALAGAMENTO 90%`, como a visão da câmera; LCD em `CRITICO ONLINE` / `Alagado 90%` num detalhe |

### 4.10 Diretrizes de estilo

- Fotorrealista, materiais PBR, renderização 4K, profundidade de campo leve.
- Plásticos foscos, acrílico com reflexos sutis, PCBs com detalhes realistas (componentes SMD, serigrafia legível só nos nomes dos módulos).
- Paleta restrita: escuro `#16230E`, verde `#72C000`, branco frio `#F7FAFC`; LEDs são os únicos pontos de cor extra.
- **Evitar:** logos de outras marcas, aparência de câmera de segurança, cabos soltos, rostos ou placas legíveis, ambientes futuristas exagerados.

### 4.11 Prompt pronto (português)

```
Renderização 3D fotorrealista de um dispositivo IoT cívico chamado "Olho na Via", em estúdio,
vista 3/4. Gabinete compacto de 140 x 95 x 48 mm, cantos arredondados, plástico fosco verde-escuro
(#16230E) com uma faixa verde-limão (#72C000) contornando a junção das tampas. Na face traseira,
um display LCD 16x2 aceso mostrando "NORMAL   ONLINE" e "0.02g Luz 76%" em matriz de pontos,
abaixo uma fileira de quatro LEDs redondos (verde aceso, amarelo, vermelho e azul) e uma chave
liga/desliga tipo gangorra, redonda, de 12 mm, preta com tecla branca, dentro de um anel verde.
No topo, uma antena LoRa curta preta. Na lateral,
o logo de um olho estilizado com uma estrada tracejada no centro e o texto "olho na via." com
o ponto em verde. Braço de ventosa para para-brisa no topo. Fundo claro (#F7FAFC), iluminação
de softbox, sombra de contato suave, materiais PBR, 4K, profundidade de campo leve, estilo de
foto de produto premium, sem outras marcas.
```

### 4.12 Prompt pronto (inglês)

```
Photorealistic 3D product render of a civic IoT device called "Olho na Via", studio shot,
3/4 view. Compact enclosure 140 x 95 x 48 mm with generously rounded corners, matte textured
dark green plastic (#16230E) and a 6 mm lime green (#72C000) band around the seam. Rear face:
a lit 16x2 character LCD showing "NORMAL   ONLINE" and "0.02g Luz 76%" in dot-matrix font,
below it a row of four round 5 mm LEDs (green lit, amber, red, blue with a small camera icon)
and a 12 mm round black on/off rocker switch with a white rocker, set in a green ring. A short
black LoRa rubber-duck antenna on top, a windshield suction-cup mount arm, a PG7 cable gland
with a single power cable on the right side.
Side logo: a stylized eye whose pupil is a dashed road, with the lowercase wordmark
"olho na via." where the final dot is green. Clean light background (#F7FAFC), softbox
lighting, soft contact shadow, PBR materials, 4K, shallow depth of field, premium consumer
electronics photography, no other brands, no readable faces or license plates.
```

### 4.13 Prompt da vista explodida (inglês)

```
Isometric exploded-view 3D render of the "Olho na Via" IoT device, layers separated along the
depth axis on a light background (#F7FAFC): front cover with smoked acrylic camera window and
green ring; ESP32-CAM board with OV2640 lens on a 10-degree bracket; main perfboard with an
ESP32 DevKit and a purple GY-521 MPU-6050 module with white JST connectors; LilyGO T-Beam board
with an 18650 battery and a square ceramic GPS antenna; small DC-DC converter with heatsink and
blade fuse; rear cover with green 1602 LCD, row of four LEDs, buzzer grille and a round 12 mm
on/off rocker switch.
Thin lime green (#72C000) callout lines with labels in a geometric rounded sans-serif:
"Câmera OV2640", "ESP32", "MPU-6050", "GPS + LoRa (T-Beam)", "Bateria 18650", "Display 16x2",
"LEDs de estado", "Chave liga/desliga". Clean technical illustration style, PBR materials, 4K.
```

### 4.14 Referências para anexar ao pedido

- **Modelo 3D pronto:** pasta `modelo-3d/` (three.js). O botão “Baixar GLB” do visualizador exporta o dispositivo completo para Blender ou Keyshot, e “Baixar imagem” gera um PNG de referência.

- Logos e ícone: pasta `../identidade-visual/` (`both-white-bg.png`, `icon-white-bg.png`, `text-green-bg.png`).
- Circuito: `documentacao/figuras/circuito.svg` (ligações reais do protótipo).
- Fotos de referência dos módulos (busca de imagem): “ESP32-CAM AI-Thinker OV2640”, “LilyGO T-Beam v1.2 18650”, “GY-521 MPU-6050”, “LCD 1602 I2C PCF8574”, “12mm round rocker switch”.
