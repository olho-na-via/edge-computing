# Olho na Via · Dispositivo IoT: componentes e briefing de renderização 3D

Documento de apoio à entrega de **Edge Computing & Computer Systems** (Global Solution 2026.2 · CitizenTech).
Ele tem duas partes:

1. **Montagem física:** todos os componentes, ligações e cuidados para construir o dispositivo real.
2. **Briefing de renderização 3D:** tudo o que outro modelo de IA (ou um designer) precisa para criar uma imagem bonita e fiel do protótipo.

A simulação no Wokwi (`diagram.json` + `sketch.ino`) e a documentação técnica em PDF ficam nesta mesma pasta.

---

## 1. O que é o dispositivo

Uma caixa compacta instalada **atrás do para-brisa dos ônibus** (alimentada pelos 24 V do veículo) ou levada por **voluntários** em carro ou moto (com bateria própria). Ela:

- sente o **buraco** pelo acelerômetro (pico de aceleração vertical);
- mede a **lâmina d'água** com um sensor ultrassônico voltado para o chão;
- percebe o **semáforo apagado** pela falta de luz;
- sabe **onde** está pelo GPS;
- **decide sozinha** entre 4 estados (NORMAL, ATENÇÃO, CRÍTICO, FALHA) e avisa com LEDs, buzzer e um display;
- tira uma **foto anonimizada** quando o problema é crítico ou quando o voluntário aperta o botão;
- envia o evento por **LoRa / Wi-Fi (MQTT)** ou guarda numa **fila offline** quando não há cobertura.

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
| 1 | **ESP32-CAM** | AI-Thinker, câmera OV2640 (2 MP), slot microSD | Fotografa a via à frente; desfoca rostos e placas antes de salvar | UART com o ESP32 | R$ 60–90 |
| 1 | Programador ESP32-CAM | Placa ESP32-CAM-MB (USB) | Gravar o firmware da câmera (só na bancada) | USB | R$ 15–25 |
| 1 | Cartão microSD | 16 GB, classe 10 | Guarda as fotos até o envio | SPI interno da CAM | R$ 25–35 |
| 1 | **MPU-6050** | Módulo GY-521 (acelerômetro + giroscópio de 6 eixos) | Detecta o impacto vertical do buraco; giroscópio registra curvas | I2C (0x68) | R$ 15–25 |
| 1 | **TTGO T-Beam** | LilyGO T-Beam v1.2, **915 MHz** (faixa usada no Brasil), GPS NEO-6M ou NEO-M8N, LoRa SX1276, gerenciador de energia AXP, suporte para bateria 18650 | GPS, rádio LoRa e bateria com carregamento | UART com o ESP32 | R$ 250–350 |
| 1 | Antena LoRa | 915 MHz, conector SMA (ou IPEX + pigtail SMA) | Alcance do rádio | — | R$ 20–30 |
| 1 | Bateria | Li-ion 18650, 3.000–3.500 mAh, com proteção | Autonomia do Kit Cidadão e reserva no ônibus | Suporte do T-Beam | R$ 25–40 |
| 1 | **Display LCD 16×2** | LCD 1602 com módulo I2C PCF8574 (backlight verde-amarelado ou azul) | Mostra estado, conexão, motivo e valor medido | I2C (0x27) | R$ 25–35 |

### 2.2 Sensores e interface adicionais

| Qtd | Componente | Modelo / especificação | Função | Interface | Preço estimado* |
|---|---|---|---|---|---|
| 1 | Sensor ultrassônico (bancada) | HC-SR04 | Lâmina d'água no protótipo | GPIO (TRIG/ECHO) | R$ 10–15 |
| 1 | Sensor ultrassônico (ônibus) | **JSN-SR04T** à prova d'água, sonda com cabo de 2,5 m | Lâmina d'água sob o para-choque, olhando para o chão | GPIO (TRIG/ECHO) | R$ 50–70 |
| 1 | Módulo LDR | Fotorresistor com saída analógica (AO) | Luz do semáforo (no produto final, a câmera e a IA fazem isso) | ADC | R$ 5–10 |
| 1 | LED 5 mm verde | difuso | Estado NORMAL | GPIO | R$ 1 |
| 1 | LED 5 mm amarelo | difuso | Estado ATENÇÃO (pisca em FALHA) | GPIO | R$ 1 |
| 1 | LED 5 mm vermelho | difuso | Estado CRÍTICO | GPIO | R$ 1 |
| 1 | LED 5 mm azul | alto brilho | Indicador de foto (flash) | GPIO | R$ 1 |
| 4 | Resistor 220 Ω | 1/4 W | Limitar a corrente dos LEDs | — | R$ 1 |
| 1 | Buzzer passivo | 3,3–5 V, 12 mm | Alerta sonoro intermitente no CRÍTICO (`tone()` a 1 kHz) | GPIO | R$ 5 |
| 1 | Botão de pressão | 12 mm, de painel, tampa azul, IP65 | “Reportar”: o voluntário registra um problema que o sensor não vê | GPIO (pull-up interno) | R$ 8–12 |
| 2 | Resistores 1 kΩ e 2 kΩ | 1/4 W | Divisor de tensão do ECHO (5 V → 3,3 V) | — | R$ 1 |

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
| 1 | Prensa-cabo | PG7 | Entrada do cabo de 24 V e da sonda ultrassônica |
| 1 | Placa de circuito | Placa perfurada 7 × 9 cm (protótipo) ou PCB própria | Base do ESP32, do MPU-6050 e das ligações |
| — | Conectores e fios | JST-XH 2,54 mm, fios 24 AWG, termo-retrátil | Ligações internas desmontáveis |
| — | Fixação | Parafusos M3 × 8, espaçadores de nylon M3 × 10, insertos roscados M3 | Fixar placas e fechar a tampa |
| 1 | Junta de vedação | Cordão de silicone 2 mm | Vedação IP54 da tampa |

\* Preços de varejo estimados em novembro de 2026, sem ganho de escala. Confira com fornecedores antes de comprar. O total do protótipo físico fica entre **R$ 650 e R$ 900**, acima da estimativa de R$ 300 do Sumário Executivo porque inclui o T-Beam, a câmera e o sensor à prova d'água.

### 2.4 Itens que existem só na simulação do Wokwi

O Wokwi não tem câmera, GPS, LoRa nem bateria. Estes componentes do `diagram.json` representam esses recursos e **não entram na montagem física**:

| No Wokwi | Representa | Na montagem física |
|---|---|---|
| Chave deslizante “GPS” | Perda do sinal de GPS | O próprio módulo GPS do T-Beam informa se tem sinal (fix) |
| Chave deslizante “rede” | Perda da cobertura LoRa / 4G / Wi-Fi | Estado real do rádio |
| Potenciômetro “bateria” | Nível de carga da bateria | Leitura do gerenciador de energia (AXP) do T-Beam |
| LED azul + botão | ESP32-CAM | ESP32-CAM real (o LED azul e o botão continuam no painel) |
| Wi-Fi `Wokwi-GUEST` + broker público | Envio por LoRa / 4G para o FIWARE | Gateway LoRa ou modem 4G ligado ao broker do FIWARE |

---

## 3. Ligações da montagem física

As ligações do ESP32 principal são **as mesmas do Wokwi**, para que o `sketch.ino` funcione sem mudanças na parte de sensores e alertas.

| Componente | Pino do componente | ESP32 | Observação |
|---|---|---|---|
| MPU-6050 | SDA · SCL · VCC · GND | GPIO 21 · GPIO 22 · 3V3 · GND | Barramento I2C compartilhado com o LCD |
| LCD 16×2 I2C | SDA · SCL · VCC · GND | GPIO 21 · GPIO 22 · **5V** · GND | Em 5 V o contraste fica correto; confira os pull-ups do módulo I2C |
| HC-SR04 / JSN-SR04T | TRIG · ECHO · VCC · GND | GPIO 13 · GPIO 14 (**via divisor 1 kΩ / 2 kΩ**) · 5V · GND | O ECHO sai em 5 V; o ESP32 aceita só 3,3 V |
| Módulo LDR | AO · VCC · GND | GPIO 34 · 3V3 · GND | ADC1, funciona junto com o Wi-Fi |
| LED verde · amarelo · vermelho · azul | ânodo (via 220 Ω) · cátodo | GPIO 19 · 18 · 5 · 17 / GND | — |
| Buzzer passivo | + · − | GPIO 16 / GND | — |
| Botão “Reportar” | terminal 1 · terminal 2 | GPIO 25 / GND | `INPUT_PULLUP` |
| ESP32-CAM | U0R · U0T · 5V · GND | TX GPIO 26 · RX GPIO 27 · 5V · GND | UART para o comando “foto”; fonte de 5 V com pelo menos 2 A no pico |
| TTGO T-Beam | RX · TX · GND | TX GPIO 23 · RX GPIO 4 · GND | UART para GPS e LoRa; use GPIOs livres do conector do T-Beam conforme o pinout da revisão da placa |

**Alternativa mais enxuta:** o T-Beam já tem um ESP32. Numa segunda versão, ele pode ser o cérebro do dispositivo, ligado direto ao MPU-6050, ao LCD, aos LEDs e à ESP32-CAM, e o ESP32 DevKit sai da montagem. O DevKit continua útil na bancada e na simulação.

### 3.1 Cuidados elétricos

- **Nunca ligue o rádio LoRa sem antena:** o transmissor pode queimar.
- Use **915 MHz** (faixa de uso livre no Brasil, regulada pela Anatel). Módulos de 433 ou 868 MHz não são indicados.
- A ESP32-CAM tem picos de corrente quando liga o flash e o Wi-Fi: alimente-a direto pelo conversor de 5 V, não pelo pino 3V3 do DevKit.
- No ônibus, a tensão oscila na partida do motor: o conversor DC-DC precisa aceitar picos e ter fusível e diodo de proteção.
- O MPU-6050 deve ficar **bem preso à base do gabinete**, perto do centro da caixa e com o eixo Z na vertical, para medir o impacto do veículo e não a vibração da tampa.
- Câmera e LDR olham para fora pelo para-brisa; display, LEDs e botão ficam voltados para dentro.
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
| Verde da marca | `#72C000` (destaques, faixa lateral, anel do botão, logo) |
| Escuro da marca | `#16230E` (corpo principal do gabinete) |
| Fundo claro | `#F7FAFC` (fundo de estúdio) |
| Tipografia | Urbanist (geométrica, cantos arredondados), peso 700–900 nos títulos |
| Logo | Olho estilizado com uma estrada no centro e o texto “olho na via.” (ponto final em verde). Arquivos em `../identidade-visual/` (`icon-white-bg.svg`, `both-green-bg.svg`, `text-white-bg.svg`) |
| Grafismo | Faixas tracejadas verticais, como a sinalização de uma estrada |

### 4.3 Forma do gabinete

- **Dimensões:** cerca de **140 mm (largura) × 95 mm (altura) × 48 mm (profundidade)**.
- **Forma:** bloco retangular com cantos bem arredondados (raio de 12 mm) e laterais levemente afinadas; lembra um pequeno roteador ou uma câmera de painel premium.
- **Material:** plástico fosco texturizado (PETG / ASA impresso e acabado), cor `#16230E`. Uma **faixa verde `#72C000`** de 6 mm contorna a junção entre a frente e a traseira.
- **Logo:** ícone do olho com estrada gravado na face traseira, entre o buzzer e o botão, preenchido em branco e verde (impressão multicor).
- **Parafusos:** quatro M3 escareados nos cantos da face frontal, encostada no para-brisa e fora da vista.

### 4.4 Face frontal (voltada para a rua, encostada no para-brisa)

- **Lente da câmera** (ESP32-CAM, OV2640) no centro-superior: círculo de 14 mm atrás de uma janela de **acrílico fumê**, com um anel fino verde ao redor.
- **Janela pequena do LDR** (5 mm) ao lado da lente.
- Nada mais na frente: superfície limpa, para não refletir no para-brisa.
- No topo, o **braço articulado da ventosa** (Unidade Ônibus) com rosca de 1/4".

### 4.5 Face traseira (voltada para dentro do ônibus ou para o voluntário)

- **Display LCD 16×2** (área visível de 64 × 16 mm) no terço superior, atrás de acrílico transparente. Texto exibido, em fonte de matriz de pontos:
  - linha 1: `NORMAL   ONLINE`
  - linha 2: `0.02g 0cm L76%`
  - (variação para uma imagem de alerta: `CRITICO  ONLINE` / `Buraco 1.20g`)
- Abaixo do display, uma **barra de 4 LEDs** redondos de 5 mm, alinhados, da esquerda para a direita: verde (NORMAL), amarelo (ATENÇÃO), vermelho (CRÍTICO) e azul (câmera).
- **Botão “Reportar”** azul de 12 mm no canto inferior direito, com anel verde e um ícone de “+” ou de alerta.
- **Grade do buzzer** (5 furos de 1,5 mm) no canto inferior esquerdo.

### 4.6 Laterais, topo e base

- **Topo:** antena LoRa curta (tipo “rubber duck”, 10 cm, preta, conector SMA) saindo do canto superior esquerdo, levemente inclinada.
- **Lateral direita:** prensa-cabo PG7 por onde entram o cabo de energia de 24 V e o cabo fino da sonda ultrassônica.
- **Lateral esquerda:** cinco fendas de ventilação.
- **Base:** segundo ponto de fixação 1/4" (para o suporte de guidão do Kit Cidadão) e uma etiqueta com QR code e o identificador `olhonavia001`.

### 4.7 Sonda de lâmina d'água (só na Unidade Ônibus)

Pequena cápsula cilíndrica preta à prova d'água (JSN-SR04T, cerca de 22 mm de diâmetro), presa **sob o para-choque dianteiro do ônibus, apontando para o chão**, ligada ao gabinete por um cabo fino. Em renderizações do ônibus, ela aparece discreta, perto da placa ou do engate.

### 4.8 Vista explodida (interna)

Da frente para trás, alinhado em camadas:

1. Tampa frontal com janela fumê e anel verde da câmera.
2. **ESP32-CAM** (placa de 40 × 27 mm, lente OV2640 com cabo flat) presa num suporte inclinado de 10° para baixo, olhando a via.
3. Placa perfurada principal com o **ESP32 DevKit** (55 × 28 mm) e o **MPU-6050** (GY-521, 21 × 16 mm, roxo) no centro da caixa, com conectores JST brancos.
4. **TTGO T-Beam** (cerca de 100 × 33 mm, PCB preta) com a **bateria 18650** azul ou verde no suporte e o módulo GPS com antena cerâmica quadrada voltada para o topo.
5. **Conversor DC-DC** pequeno com dissipador, fusível de lâmina e LED vermelho de energia.
6. Tampa traseira com o **LCD 1602** (PCB verde de 80 × 36 mm com o módulo I2C preto soldado atrás), a barra de LEDs, o buzzer e o botão.

Use linhas finas de chamada em verde `#72C000` com rótulos em Urbanist: “Câmera OV2640”, “ESP32”, “MPU-6050”, “GPS + LoRa (T-Beam)”, “Bateria 18650”, “Display 16×2”, “LEDs de estado”, “Botão Reportar”.

### 4.9 Cenas sugeridas

| # | Cena | Enquadramento | Detalhes |
|---|---|---|---|
| 1 | **Hero de produto** | 3/4 frontal-lateral, câmera a 30° | Fundo `#F7FAFC` com degradê suave, sombra de contato, iluminação de estúdio com softbox; LCD aceso em `NORMAL ONLINE`, LED verde aceso |
| 2 | **Traseira em alerta** | Frontal da face traseira | LCD em `CRITICO ONLINE` / `Buraco 1.20g`, LED vermelho aceso e brilho azul do flash; fundo escuro `#16230E` |
| 3 | **Vista explodida** | Isométrica | Camadas separadas no eixo da profundidade, rótulos verdes, fundo claro |
| 4 | **Instalado no ônibus** | De dentro do ônibus, atrás do motorista, olhando pela janela | Dispositivo no canto superior direito do para-brisa; Av. Paulista ao entardecer; à frente, um buraco no asfalto destacado por uma caixa verde translúcida (como a detecção da IA); pessoas e placas de carros sem detalhes identificáveis |
| 5 | **Kit Cidadão na moto** | Close no guidão | Entregador de capacete (rosto não visível), dispositivo no suporte de guidão, LED amarelo aceso, rua molhada de São Paulo |
| 6 | **Lâmina d'água** | Externa, nível do chão | Frente do ônibus atravessando uma rua alagada, sonda sob o para-choque, onda de ultrassom estilizada em verde até a superfície da água |

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
um display LCD 16x2 aceso mostrando "NORMAL   ONLINE" e "0.02g 0cm L76%" em matriz de pontos,
abaixo uma fileira de quatro LEDs redondos (verde aceso, amarelo, vermelho e azul) e um botão
azul de 12 mm com anel verde escrito "Reportar". No topo, uma antena LoRa curta preta. Na lateral,
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
a lit 16x2 character LCD showing "NORMAL   ONLINE" and "0.02g 0cm L76%" in dot-matrix font,
below it a row of four round 5 mm LEDs (green lit, amber, red, blue with a small camera icon)
and a 12 mm blue push button with a green ring labeled "Reportar". A short black LoRa rubber-duck
antenna on top, a windshield suction-cup mount arm, a PG7 cable gland on the right side.
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
blade fuse; rear cover with green 1602 LCD, row of four LEDs, buzzer grille and blue button.
Thin lime green (#72C000) callout lines with labels in a geometric rounded sans-serif:
"Câmera OV2640", "ESP32", "MPU-6050", "GPS + LoRa (T-Beam)", "Bateria 18650", "Display 16x2",
"LEDs de estado", "Botão Reportar". Clean technical illustration style, PBR materials, 4K.
```

### 4.14 Referências para anexar ao pedido

- **Modelo 3D pronto:** pasta `modelo-3d/` (three.js). O botão “Baixar GLB” do visualizador exporta o dispositivo completo para Blender ou Keyshot, e “Baixar imagem” gera um PNG de referência.

- Logos e ícone: pasta `../identidade-visual/` (`both-white-bg.png`, `icon-white-bg.png`, `text-green-bg.png`).
- Circuito: `documentacao/figuras/circuito.svg` (ligações reais do protótipo).
- Fotos de referência dos módulos (busca de imagem): “ESP32-CAM AI-Thinker OV2640”, “LilyGO T-Beam v1.2 18650”, “GY-521 MPU-6050”, “LCD 1602 I2C PCF8574”, “JSN-SR04T waterproof ultrasonic”.
