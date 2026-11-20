# Olho na Via · Simulador web do dispositivo

Os simuladores prontos não têm câmera nem GPS. Este simulador roda o firmware do dispositivo (`../sketch.ino`) no navegador e usa os sensores do **celular** no lugar dos módulos que faltam:

| No dispositivo                              | No simulador                                                                                                                                   | API do navegador                                         |
| ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------- |
| ESP32-CAM (OV2640)                          | Câmera do celular: imagem ao vivo e foto no evento                                                                                             | `MediaDevices.getUserMedia()`                            |
| Visão computacional (IA na ESP32-CAM)       | O modelo YOLO de `../visao-computacional` rodando no navegador sobre a câmera do celular: buraco, alagamento, semáforo apagado e faixa apagada | onnxruntime-web (WebGPU ou WebAssembly) em um Web Worker |
| GPS do T-Beam                               | Localização do celular: latitude, longitude e velocidade                                                                                       | `navigator.geolocation.watchPosition()`                  |
| MPU-6050                                    | Acelerômetro e giroscópio do celular: impacto, giro, inclinação                                                                                | `DeviceMotionEvent`, `DeviceOrientationEvent`            |
| Módulo LDR                                  | Luminância média da imagem da câmera                                                                                                           | canvas sobre o vídeo da câmera                           |
| Bateria 18650                               | Bateria do celular (Chrome no Android)                                                                                                         | `navigator.getBattery()`                                 |
| Cobertura de rede                           | Conexão do celular                                                                                                                             | `navigator.onLine`                                       |
| LEDs, LCD 16×2, buzzer e chave liga/desliga | Modelo 3D (`../modelo-3d`), circuito 2D, faixa de atuadores e som a 1 kHz                                                                      | WebGL (three.js), SVG, Web Audio                         |
| Broker MQTT                                 | Simulado na própria aba: nada é enviado para fora                                                                                              | —                                                        |

Cada sensor tem uma chave **Celular | Simulado**. Tudo começa simulado, então o simulador também funciona no computador e sem nenhuma permissão.

## Rodar no computador

Requer [Bun](https://bun.com) 1.3 ou mais novo.

```bash
cd edge-computing-e-computer-systems/simulador
bun install
bun run dev
```

Abra `http://localhost:5173`, ligue o dispositivo e escolha um cenário de teste.

## Testar no celular

Câmera, GPS e acelerômetro só funcionam em **contexto seguro**: HTTPS ou `localhost`. Abrir `http://192.168.x.x:5173` no celular não basta. Há dois caminhos.

### Opção 1 · Wi-Fi com HTTPS (Android e iPhone)

```bash
bun run dev:celular
```

1. Celular e computador na mesma rede Wi-Fi.
2. O terminal mostra o endereço `Network: https://192.168.x.x:5173/`. Abra esse endereço no celular.
3. O certificado é autoassinado, gerado na hora: o navegador avisa que a conexão não é particular. Toque em **Avançado → Continuar** (Chrome) ou **Mostrar detalhes → Visitar este site** (Safari).
4. Se a página não abrir, libere o Bun no firewall do Windows para redes privadas.

### Opção 2 · Cabo USB (Android, sem aviso de certificado)

Com a depuração USB ativada no celular e o `adb` instalado:

```bash
bun run dev
adb reverse tcp:5173 tcp:5173
```

Abra `http://localhost:5173` no Chrome do celular. Para o navegador, `localhost` já é contexto seguro.

### No celular

1. Ligue o dispositivo: botão **Ligar o dispositivo** ou a chave liga/desliga (na faixa abaixo do modelo, no modelo 3D ou no circuito).
2. Na aba **Sensores**, toque em **Usar o celular** e aceite os pedidos de câmera, localização e movimento. Cada sensor também pode ser ligado sozinho, no cartão dele.
3. Se uma permissão for negada ou o aparelho não tiver o sensor, aquele cartão mostra o motivo e continua simulado.

| Para ver                                                          | Faça                                                                                                                                                                                                                                                                           |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Buraco (CRÍTICO)                                                  | Sacuda o celular para cima e para baixo por cerca de 1 s                                                                                                                                                                                                                       |
| Via irregular (ATENÇÃO)                                           | Balance o celular de leve                                                                                                                                                                                                                                                      |
| Semáforo apagado                                                  | Tampe a lente da câmera: ATENÇÃO (“Luz fraca”) e, depois de 10 s, CRÍTICO                                                                                                                                                                                                      |
| Buraco, alagamento, semáforo apagado ou faixa apagada pela câmera | Aponte a câmera para o problema (ou para uma foto dele): a caixa aparece na imagem. Com 30% de confiança, o estado vai para ATENÇÃO; com 50%, CRÍTICO, com foto (a faixa apagada fica só em ATENÇÃO). Sem nada por perto, troque a detecção para “Simulada” e use os controles |
| Foto remota                                                       | Toque em **Foto remota (@foto)**: a foto da câmera aparece na aba **Eventos**                                                                                                                                                                                                  |
| Fila offline                                                      | Ligue o modo avião, provoque um evento (um alagamento, por exemplo) e volte a conectar                                                                                                                                                                                         |
| GPS sem sinal                                                     | Negue ou desative a localização: o estado vai para FALHA                                                                                                                                                                                                                       |
| Inclinação                                                        | Incline o celular: o modelo 3D acompanha                                                                                                                                                                                                                                       |
| Desligar                                                          | Mova a chave liga/desliga: LEDs, LCD e buzzer apagam; ao religar, o firmware reinicia                                                                                                                                                                                          |

Observações por sistema:

- **iPhone (Safari):** o pedido de movimento só aparece depois de um toque, por isso ele é feito pelo botão **Usar o celular**. O Safari não informa a bateria: esse canal fica simulado.
- **Android (Chrome):** se o movimento for negado, libere “Sensores de movimento” nas configurações do site.
- A luz medida pela câmera é uma estimativa (a câmera ajusta a exposição sozinha). Serve para o teste de tampar a lente, não como luxímetro.

## O que há na tela

- **Modelo 3D** (vistas **Display**, **Câmera** e **Interno**): o mesmo de `../modelo-3d`, com os LEDs, o LCD, o buzzer e a chave liga/desliga comandados pelo firmware. Arraste para girar.
- **Circuito** (vista **Circuito**): esquema 2D, com o ESP32, os componentes e os fios. Os LEDs acendem, o LCD mostra o texto do firmware e cada sensor mostra a leitura atual. Arraste para mover, use a roda do mouse, a pinça ou os botões para aproximar. As chaves **liga/desliga** e **rede** podem ser tocadas.
- **Faixa de atuadores:** LCD, LEDs, buzzer e chave liga/desliga em 2D, legíveis em qualquer vista.
- **Sensores:** origem de cada sensor (celular ou simulado), valores simulados e cenários de teste.
- **Imagem da câmera:** no canto do palco, com as caixas do que o modelo de visão encontrou. Toque para ampliar.
- **Telemetria:** o que o firmware mediu, já com a média móvel, e o nível dos pinos do ESP32.
- **Serial:** as linhas do `Serial.println()`.
- **Eventos:** mensagens publicadas no broker simulado, fila offline e fotos.
- **Código:** painel retrátil com o `sketch.ino` e realce de sintaxe. A linha de `decidirEstado()` que explica o estado atual fica marcada.

## Como o firmware roda no navegador

```
sensores do celular ─┐
                     ├─> Placa (placa.ts) ──> Firmware (firmware.ts) ──> pinos, LCD, Serial, MQTT ──> interface
controles do painel ─┘   ADC, pinos, UART       mesma lógica do sketch.ino
```

- `src/lib/firmware/firmware.ts` é o `sketch.ino` em TypeScript, função por função, com os mesmos nomes, limites e tempos. **Ao mudar a lógica, mude os dois arquivos.**
- `src/lib/firmware/placa.ts` emula a placa: entrega as leituras como o circuito entregaria (contagens do ADC de 12 bits, nível dos pinos, linhas da UART da câmera) e guarda o que o firmware escreve.
- As detecções da câmera chegam ao firmware como chegariam da ESP32-CAM: uma linha por classe, como `DET buraco 61`, por UART, repetida enquanto o problema estiver na imagem. A confiança vem do modelo de visão (`src/lib/visao/`), que analisa um quadro da câmera por vez em um Web Worker, ou dos controles do painel. A mesma linha também pode ser digitada na aba Serial.
- O firmware usa as quatro classes do modelo (buraco, alagamento, semáforo apagado e faixa apagada). Buraco e semáforo apagado também continuam sendo percebidos pelo acelerômetro e pela luz: a câmera é uma segunda fonte. A checagem de cor do semáforo (`semaforo.py`) não foi portada.
- O painel **Código** lê o `../sketch.ino` de verdade, sem cópia.
- “Celular” no GPS e na câmera corresponde a `EMULAR_PERIFERICOS 0` no `sketch.ino`; “Simulado” corresponde a `EMULAR_PERIFERICOS 1`, o modo de bancada.

## Estrutura

| Caminho                                | Papel                                                                             |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| `src/lib/simulador.svelte.ts`          | Estado central: liga placa e firmware, escolhe as fontes, cenários, buzzer, fotos |
| `src/lib/firmware/`                    | Placa emulada e firmware portado                                                  |
| `src/lib/sensores/camera.svelte.ts`    | Câmera: fluxo de vídeo, luminância e captura de foto                              |
| `src/lib/sensores/gps.svelte.ts`       | Localização e velocidade                                                          |
| `src/lib/sensores/movimento.svelte.ts` | Acelerômetro, giroscópio e orientação (com o pedido de permissão do iOS)          |
| `src/lib/sensores/energia.svelte.ts`   | Bateria e conexão                                                                 |
| `src/lib/codigo/realce.ts`             | Realce de sintaxe do `.ino`, sem dependências                                     |
| `src/lib/visao/`                       | Modelo de visão no navegador: worker do detector (ONNX), pré e pós-processamento  |
| `static/modelos/olho_na_via.onnx`      | Modelo exportado por `../visao-computacional/treino/exportar_onnx.py` (38 MB)     |
| `src/lib/componentes/Cena3D.svelte`    | Modelo 3D com os atuadores ao vivo                                                |
| `src/lib/componentes/Esquema2D.svelte` | Circuito 2D: placa, componentes, fios, zoom e arrasto                             |
| `src/lib/componentes/`                 | Palco e painéis de sensores, telemetria, serial, eventos e código                 |
| `src/routes/+page.svelte`              | Página única do simulador                                                         |
| `vite.config.ts`                       | Alias `$edge` para a pasta da disciplina e HTTPS no modo `celular`                |

## Comandos

```bash
bun run dev           # desenvolvimento em http://localhost:5173
bun run dev:celular   # HTTPS na rede local, para abrir no celular
bun run check         # tipos (svelte-check)
bun run lint          # prettier e eslint
bun run build         # build estático de produção (adapter-static, em ./build)
bun run preview       # serve o build localmente
bun run test:e2e      # testes no navegador (Playwright baixa o Chromium na primeira vez)
```

Em produção, o servidor também precisa estar atrás de HTTPS para os sensores funcionarem.

## Deploy na Vercel

O simulador lê `../sketch.ino` e `../modelo-3d` (alias `$edge`), então o deploy sai da **raiz do repositório**, não desta pasta:

- Projeto `olho-na-via-simulador` com **Root Directory = `simulador`** e “Include files outside the root directory” ligado.
- O `.vercelignore` da raiz envia só `simulador/`, `modelo-3d/` e `sketch.ino`.

```bash
cd ..                 # raiz do repositório edge-computing
vercel deploy         # preview
vercel deploy --prod  # produção
```

## Limitações

- O modelo de visão roda com entrada de 480 px (no treino foram 768 px), para caber no tempo de um celular: objetos pequenos e distantes são menos detectados. Em um computador sem WebGPU, cada quadro levou cerca de 0,5 s; em celulares, espere de 1 a alguns segundos. O firmware só confirma o estado depois de 3 leituras, e o modelo acerta cerca de metade dos alagamentos do conjunto de validação (veja `../visao-computacional/README.md`).
- A foto não é anonimizada aqui: o desfoque de rostos e placas é tarefa da ESP32-CAM real. No simulador, a foto fica só na memória da aba e some ao recarregar.
- O broker MQTT é simulado. Para ver mensagens reais no HiveMQ ou no FIWARE, use a montagem física.
