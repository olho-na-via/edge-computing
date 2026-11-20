# prompts.md · Uso de Inteligência Artificial no Edge Computing

Este arquivo documenta como ferramentas de Inteligência Artificial foram usadas na entrega de **Edge Computing & Computer Systems** do **Olho na Via**: o firmware, o modelo 3D, a visão computacional e o simulador web. Ele registra apenas interações que de fato aconteceram.

## 1. Ferramentas utilizadas

| Ferramenta | Tipo | Finalidade no projeto |
| --- | --- | --- |
| **Claude Code** (Anthropic) | Agente de programação no terminal | Ler o documento do desafio e o contexto do projeto; escrever o firmware, o modelo 3D, a visão computacional, o simulador e a documentação; treinar o modelo de visão; testar o simulador no navegador. |
| **Whisper** (OpenAI) | Transcrição de fala | Gerar as legendas do vídeo de entrega a partir da minha narração. |

## 2. O papel da IA: copiloto, não autora das decisões

O código deste repositório foi escrito pela ferramenta. O que ela implementou, porém, partiu de decisões e materiais que eu trouxe:

- **O hardware** (ESP32, ESP32-CAM, MPU-6050, TTGO T-Beam e painel LCD) foi escolhido por mim antes do primeiro pedido (seção 4.1).
- **O problema e o contexto** vêm do Sumário Executivo do projeto: o ônibus como fiscal da rua, as quatro ocorrências (buraco, alagamento, semáforo apagado e faixa apagada) e a resposta sem internet.
- **Os datasets** do detector foram pré-selecionados por mim: RDD2022 (buraco e faixa de pedestre desgastada), S2TLD (semáforo apagado) e City Risks (acúmulo de água). A IA baixou, converteu as anotações para as quatro classes e treinou o modelo (veja `visao-computacional/README.md`).
- **As correções de rumo** foram minhas: trocar o botão de reportar por uma chave liga/desliga, tirar o sensor de água, pedir o esquema 2D do circuito e ajustar a sensibilidade da câmera depois de testar com a webcam (seção 4.5).

O trabalho seguiu sempre o mesmo ciclo: eu fazia o pedido com as referências, a IA lia o projeto e implementava, eu testava o resultado e pedia ajustes.

## 3. Fluxo de desenvolvimento

| Etapa | O que foi feito | Minha participação |
| --- | --- | --- |
| **1. Firmware e documentação** | `sketch.ino` com 4 estados, média móvel, confirmação, `millis()` e fila offline; documentação técnica em PDF e `COMPONENTES.md`. | Escolhi as peças e pedi código simples, no nível visto em aula. |
| **2. Modelo 3D** | Gabinete em three.js para a landing page e peças em STL para impressão (`modelo-3d/`). | Pedi que o mesmo modelo servisse para imprimir e para a landing page. |
| **3. Visão computacional** | Detector YOLO das quatro classes, com caixas, rótulos, confiança e FPS, para webcam, imagem e vídeo (`visao-computacional/`). | Defini as quatro classes e os datasets; pedi as imagens de teste para mostrar ao professor. |
| **4. Simulador web** | SvelteKit rodando o firmware no navegador, com os sensores do celular, o modelo 3D, o esquema 2D, o painel de código e o modelo de visão no navegador (`simulador/`). | Escrevi o briefing completo e corrigi o rumo depois de testar. |
| **5. Deploy** | Ajuste do build para a Vercel, levando junto o modelo 3D e o `sketch.ino`. | Fiz o deploy e trouxe o erro do build. |
| **6. Vídeo e entrega** | Roteiro e slides de apoio, edição e legendas do vídeo, revisão contra o desafio, README e este arquivo. | Gravei o vídeo e decidi usar o simulador no lugar do Wokwi, com a liberação do professor. |

## 4. Prompts utilizados

Os pedidos estão transcritos como foram enviados.

### 4.1 Dispositivo, firmware e documentação

> Construa agora o dispositivo IoT que será disponibilizado para instalação nos onibus e voluntários.
>
> Siga os padrões do Wokwi, a base já está em @diagram.json @libraries.txt @sketch.ino
>
> Estava planejando em utilizar um ESP32, um ESP32 CAM para câmera, um MPU-6050 para acelerometro e giroscópio, uma Placa ESP32 TTGO T-Beam com Suporte de Bateria, GPS e LoRa e um painel LCD.
>
> A construção do Wokwi por enquanto será apenas um protótipo, então pode ser simples mas que represente todos os recursos disponíveis na aplicação, se não houver um componente específico, substitua por outro. O código deve ser limpo, não deve conter comentários e não deve utilizar de funções muito complexas, pois não vimos em sala de aula. Também crie uma documentação técnica em PDF seguindo o mesmo padrão do sumário executivo. Além disso, em um markdown, documente todos os componentes necessários para montagem e informações que considerar relevante para eu solicitar para outro modelo de IA construir uma renderização 3D mais bonita do protótipo.
>
> As informações sobre os entregáveis estão no arquivo @Desafio-FIAP-GS-CitizenTech 1ES Paulista e Lins.pdf entre as páginas 35 e 38.

> Adicione comentários curtos.
>
> Além disso, crie um roteiro para o vídeo explicativo com as falas que eu devo falar e o que eu devo fazer na demonstração.

**Resposta:** a ferramenta montou o circuito e o `sketch.ino`, trocando por componentes equivalentes o que o simulador não tinha (câmera, GPS e bateria). Também escreveu a documentação técnica, o `COMPONENTES.md` com a lista de peças e o briefing de renderização 3D.

### 4.2 Modelo 3D

> Construa o modelo 3D do projeto, lembre-se que ele será utilizado para impressão e também será utilizado na landing page do projeto. Utilize a biblioteca three.js Lembre-se das informações que você colocou em @COMPONENTES.md

**Resposta:** a ferramenta criou o visualizador em three.js, com display aceso, LEDs por estado e vista explodida, e as peças do gabinete em STL, com malhas fechadas e já orientadas para a mesa de impressão.

### 4.3 Visão computacional

> Quero fazer um complemento para a disciplina de Edge Computing, construa uma aplicação python.
>
> O objetivo da aplicação é realizar o processamento visual e a detecção automatizada de quatro classes na via urbana:
> 1. Buracos / avarias no asfalto
> 2. Semáforos apagados (sem nenhuma fase luminosa acesa)
> 3. Alagamentos / acúmulo de água na pista
> 4. Faixas de pedestre apagadas ou desgastadas
>
> Você pode procurar por datasets na internet ou fazer da maneira que achar melhor. Adicione um feedback Visual: Exiba caixas delimitadoras (bounding boxes), rótulos das classes identificadas, nível de confiança e um contador de quadros por segundo (FPS) em tempo real.
>
> Ele utilizará a webcam ou possibilitará fazer o upload de uma imagem ou vídeo.

> Obtenha 10 imagens de testes para eu mostrar pro professor hoje na aula e coloque na pasta @visao-computacional/testes-professor/.
>
> Logo em seguida, me ensine a executar a aplicação com essas imagens de teste

**Resposta:** a ferramenta montou o dataset de 7.231 imagens de treino a partir do RDD2022, do S2TLD e do City Risks e treinou um YOLO11s. Para separar o semáforo apagado do aceso, acrescentou uma checagem de cor. Os resultados por classe e as limitações estão no `visao-computacional/README.md`.

### 4.4 Simulador web

> ### Contexto & Objetivo
> Os simuladores embarcados tradicionais (Wokwi/Tinkercad) não possuem suporte nativo para módulos de câmera (como ESP32-CAM/OV2640).
>
> Sua tarefa é expandir o projeto existente em `@simulador` para criar um **simulador web interativo em Svelte**, capaz de rodar diretamente no browser do smartphone. O objetivo é simular o funcionamento completo do sistema embarcado desenvolvido na matéria `@edge-computing-e-computer-systems`, utilizando as **APIs nativas do navegador do celular** (Câmera, Geolocation, DeviceOrientation, etc.) para alimentar o fluxo de dados dos sensores.
>
> ### Diretrizes de Desenvolvimento & UX
>
> 1. **Arquitetura & Stack:**
>    - Utilize **Svelte** aproveitando a estrutura de código base já existente em `@simulador`.
>    - Garanta **design responsivo (mobile-first)** e mantenha 100% de consistência com a **identidade visual** já definida na aplicação.
>
> 2. **Mapeamento de Hardware vs. APIs Web Mobile:**
>    - **Câmera:** Utilize a `MediaDevices.getUserMedia()` (Webcam/Câmera traseira do celular) para simular o feed de dados da câmera do microcontrolador.
>    - **GPS:** Utilize a API `navigator.geolocation` para obter latitude, longitude e velocidade em tempo real.
>    - **Giroscópio / Acelerômetro:** Utilize a API `DeviceMotionEvent` / `DeviceOrientationEvent` para capturar os dados de inclinação e aceleração do dispositivo.
>
> 3. **Interface & Componentes do Simulador:**
>    - **Visualização 3D / Hardware:** Exiba o modelo 3D do circuito/embarcado com os atuadores ativos (LEDs acendendo/piscando dinamicamente de acordo com o estado do sistema, Display LCD/OLED atualizando com telemetria realista, etc.).
>    - **Código Fonte Arduino (.ino):** Crie um painel lateral/aba retrátil exibindo o código firmware do projeto (`.ino`), destacado com syntax highlighting.
>    - **Painel de Controle / Debug:** Permita alternar entre sensores reais (APIs do smartphone) e valores *mockados/simulados* para testes manuais.
>
> 4. **Flexibilidade Técnica:**
>    - Você tem total liberdade para refatorar o código Arduino (`.ino`), ajustar a esquematização de componentes ou modificar a ponte de comunicação no Svelte para garantir a melhor integração e fluidez na execução da web app, por consequencia você deverá alterar o modelo 3D também provavelmente.
>
> ### Entregáveis Esperados
> 1. Estrutura atualizada dos componentes Svelte na pasta do `@simulador`.
> 2. Implementação das rotinas de captura de APIs do navegador (Câmera, GPS e Giroscópio) encapsuladas em *stores* ou *helpers*.
> 3. Atualização/ajuste no código `.ino` para alinhamento com a lógica visual do simulador.
> 4. Instruções de execução local e testes no dispositivo móvel.

**Resposta:** a ferramenta portou o firmware para TypeScript, criou a placa virtual e os sensores (celular ou simulado) e ligou o modelo 3D aos LEDs, ao LCD e ao buzzer. Também criou o painel de código com destaque de sintaxe e os cenários de teste.

### 4.5 Ajustes no simulador

> O botão de "reportar" não existirá, ele apenas servirá para ligar e desligar o dispositivo, então mude para um botão switch.
>
> E também não precisa do sensor para a agua, os alagamentos serão identificados pela camera.
>
> Além disso, você esqueceu de colocar a esquematização 2D dos componentes, assim como é feito no wokwi ou tinkercad, exemplo:

> Atualize os documentos e coloque o modelo de visão no navegador.

> Diminua a porcentagem para considerar os alertas, estou testando com a webcam e colocando uma foto pelo celular.

> Ele só está detectando alagamento? Estou mostrando a imagem de um buraco, está com 37% de detecção e não mostra o evento.

> Quero que olhe para outras classes além de alagamento também.

**Resposta:** a chave liga/desliga entrou no firmware, no modelo 3D e no circuito, e o sensor de água saiu. A ferramenta também desenhou o esquema 2D e passou a rodar o modelo de visão no navegador (ONNX em um Web Worker). Os limites da câmera foram ajustados para 30% (atenção) e 50% (crítico), e todas as classes passaram a gerar eventos.

### 4.6 Deploy na Vercel

> Ajuste o projeto do simulador para deploy na vercel. Está dando o seguinte erro no build, imagino que tenha que inserir o modelo 3D junto do app.
>
> Error: ENOENT: no such file or directory, open '/vercel//modelo-3d/modelo/gabinete.glb'

**Resposta:** a ferramenta configurou o deploy a partir da raiz do repositório, com o `.vercelignore` enviando só o `simulador/`, o `modelo-3d/` e o `sketch.ino`.

### 4.7 Vídeo de entrega e documentação final

> Utilizando o Hyperframes, FFMpeg, Whisper e os conhecimentos de edição de vídeo que você possui, faça a edição completa do vídeo de entrega para a disciplina de edge computing seguindo os padrões do @Desafio-FIAP-GS-CitizenTech 1ES Paulista e Lins.pdf.
>
> Você deve cortar o vídeo, juntá-los e legendar. Os vídeos base estão anexados.

> Irei utilizar o simulador que eu construi ao invés do Wokwi, o professor liberou.

> Corrija a documentação, remova as partes que fala sobre o wokwi, troque para citar o simulador.
>
> Além disso, remova todos os arquivos desnecessários do github, mantenha apenas o sketch.ino, modelo-3d, visao-computacional, simulador, etc remova as skills do claude
>
> Remova a parte do PDF que diz "Como gerar este PDF de novo"
>
> Adicione um README explicativo com vídeos do simulador e projeto.

**Resposta:** a ferramenta cortou, juntou e legendou as minhas gravações. Também trocou o Wokwi pelo simulador na documentação técnica, limpou o repositório e escreveu o README com os vídeos do modelo 3D e do simulador.
