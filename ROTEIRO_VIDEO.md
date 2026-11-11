# Olho na Via · Roteiro do vídeo de Edge Computing

Vídeo narrado de **até 7 minutos** (YouTube, público ou não listado), como pede o briefing:

1. **A ideia:** quem é o cidadão, o problema em uma frase, onde o dispositivo fica e quais ODS atende.
2. **O circuito:** cada componente e por que ele está ali.
3. **A lógica:** limites, estados e decisão, mostrando o código.
4. **A simulação comentada:** mudar os sensores no Wokwi e mostrar todos os estados.

Cada cena tem **o que mostrar na tela**, **o que fazer** e **o que falar**. As falas somam cerca de 6 minutos em ritmo calmo, o que deixa uma folga para as esperas da simulação. Não precisa decorar: leia algumas vezes e fale com as suas palavras.

---

## Antes de gravar

**Preparar a tela**

- [ ] Projeto aberto no Wokwi, com a aba do `sketch.ino` à esquerda e o diagrama à direita.
- [ ] Zoom do diagrama ajustado para todos os componentes aparecerem.
- [ ] Som do navegador ligado (o buzzer do Wokwi toca no CRÍTICO).
- [ ] Segunda aba com o **HiveMQ Web Client** (`hivemq.com/demos/websocket-client`): clicar em *Connect* e assinar o tópico `/TEF/olhonavia001/#`.
- [ ] PDF da documentação aberto na página da capa (para a abertura) e na seção 01 (para a ideia).
- [ ] Gravação em 1080p, com o microfone testado e as notificações do computador desligadas.

**Conferir os valores iniciais no Wokwi** (antes de dar o play):

| Componente | Valor inicial |
|---|---|
| MPU-6050 | accelZ = 1 g (acelX e acelY = 0) |
| HC-SR04 | distance = 50 cm |
| LDR | lux = 500 |
| Potenciômetro (bateria) | perto do máximo (cerca de 88%) |
| Chaves GPS e rede | as duas para cima (ligadas) |

**Como mexer nos controles do Wokwi:** com a simulação rodando, clique no componente para abrir o controle deslizante (MPU-6050, HC-SR04 e LDR). Gire o potenciômetro arrastando o botão. Clique na chave para mudar a posição e clique no botão azul para apertá-lo.

---

## Cena 1 · Abertura (0:00 a 0:20)

**Tela:** capa do PDF ou logo do Olho na Via.

**Fala:**

> Olá! Eu sou o Erick Nathan Capito Pereira, RM 573635, do primeiro ano de Engenharia de Software da FIAP. Este é o Olho na Via, e neste vídeo eu vou apresentar o sensor do projeto: um dispositivo IoT com ESP32 que decide sozinho, mesmo sem internet.

---

## Cena 2 · A ideia (0:20 a 1:10)

**Tela:** seção 01 do PDF (ou um slide com o problema em uma frase e os ODS).

**Fala:**

> Em São Paulo, buracos, alagamentos e semáforos apagados só entram na fila de reparo quando alguém reclama. Em 2025 foram mais de 113 mil pedidos de tapa-buraco, e muita gente que sofre com o problema nem tem tempo de abrir um chamado.
>
> O cidadão que eu quero ajudar é quem usa a rua todo dia: o pedestre idoso, o ciclista, o motociclista, o passageiro de ônibus. E também a gestora da subprefeitura, que precisa saber o que é mais urgente.
>
> A ideia é instalar este dispositivo atrás do para-brisa dos ônibus, que já passam por todas as ruas, e entregá-lo também a voluntários, como taxistas e entregadores. Ele percebe o problema, avisa na hora e manda o evento para a Prefeitura.
>
> O projeto atende o ODS 11, cidades sustentáveis; o ODS 9, infraestrutura; o ODS 3, segurança no trânsito; e o ODS 13, adaptação às chuvas fortes.

---

## Cena 3 · O circuito (1:10 a 2:40)

**Tela:** diagrama do Wokwi. Passe o mouse sobre cada componente enquanto fala dele.

**Fala:**

> No centro está o **ESP32**, que é o cérebro: ele lê os sensores, decide e reage.
>
> *(apontar o MPU-6050)* Este é o **MPU-6050**, o acelerômetro. Quando a roda cai num buraco, a aceleração vertical dá um pico. Ele está no barramento I2C, nos pinos 21 e 22, junto com o **display LCD**, que mostra o estado e o valor medido.
>
> *(apontar o HC-SR04)* O **sensor ultrassônico** fica embaixo do ônibus, a 50 centímetros do chão, olhando para baixo. Se a distância até a água diminui, a lâmina d'água está subindo.
>
> *(apontar o LDR)* O **LDR** mede a luz do semáforo. Um semáforo funcionando sempre tem uma lâmpada acesa.
>
> *(apontar as chaves, o potenciômetro e o botão)* O dispositivo real usa uma placa T-Beam, com GPS, rádio LoRa e bateria, e uma ESP32-CAM. Como o Wokwi não tem esses módulos, eu troquei cada um por um componente simples. Esta **chave** simula a perda do sinal de GPS, e as coordenadas seguem uma rota real na Avenida Paulista. Esta outra chave corta a **rede**. O **potenciômetro** é o nível da bateria. E o **botão azul** é o voluntário reportando um problema.
>
> *(apontar os LEDs e o buzzer)* Para avisar quem está perto, tenho os **LEDs** verde, amarelo e vermelho, cada um com resistor de 220 ohms, o **LED azul**, que funciona como o flash da câmera, e o **buzzer**, que só toca quando a situação é crítica.

---

## Cena 4 · A lógica (2:40 a 4:00)

**Tela:** aba do `sketch.ino`. Use `Ctrl+F` para pular entre os trechos.

**Ação 1:** mostrar o bloco `// Limites de decisao` no início do arquivo.

> Todos os limites estão em constantes no começo do código. Para o impacto, a variação acima de **0,4 g** é ATENÇÃO, porque abaixo disso fica a vibração normal do veículo. Acima de **1 g**, a roda caiu num buraco que pode derrubar uma moto, e o estado é CRÍTICO. Para a água, **5 centímetros** já cobrem a sarjeta e escondem buracos, e acima de **15**, a altura de um meio-fio, a rua fica perigosa. Para o semáforo, são **10 segundos** sem luz, para não confundir com uma sombra.

**Ação 2:** buscar `int decidirEstado` e mostrar a função.

> A função `decidirEstado` escolhe entre quatro estados. Primeiro ela verifica se os dados são confiáveis: se o sensor não respondeu, se a leitura está fora da faixa física, se o GPS está sem sinal ou se a bateria está baixa, o estado é **FALHA**. Depois vem o **CRÍTICO**, depois a **ATENÇÃO** e, se nada disso acontecer, **NORMAL**.

**Ação 3:** buscar `float calcularMedia` e depois `void confirmarEstado`.

> Para não reagir a qualquer tremida, cada sensor usa uma **média móvel** das últimas cinco leituras. E o estado só muda depois de **três leituras seguidas** iguais. Isso evita que o LED fique piscando quando o valor está perto do limite.

**Ação 4:** buscar `void loop` e mostrar os três `if` com `millis()`.

> O loop não usa `delay`. Com `millis`, ele lê os sensores a cada 100 milissegundos, atualiza o display a cada 250 e envia a telemetria a cada 5 segundos. Quando o estado muda, ele monta uma mensagem no formato do FIWARE e publica por MQTT. Se estiver sem rede, guarda o evento numa **fila offline** e envia depois.

---

## Cena 5 · A simulação comentada (4:00 a 6:40)

**Tela:** diagrama e Serial Monitor visíveis (e o LCD em destaque). Dê o play.

### 5.1 · NORMAL (cerca de 15 s)

**Fazer:** dar o play e esperar o LCD mostrar `NORMAL   ONLINE`.

> Comecei a simulação. O LED verde está aceso, e o display mostra o estado NORMAL e a conexão online. No Serial, aparece a telemetria a cada cinco segundos, com impacto, água, luz, bateria e a posição do GPS.

### 5.2 · Buraco: ATENÇÃO e CRÍTICO (cerca de 30 s)

**Fazer:** clicar no MPU-6050 e colocar **accelZ = 1,6 g**.

> Agora o ônibus passa por uma irregularidade: a aceleração vertical foi para 1,6 g. A variação é de 0,6, então o estado vai para **ATENÇÃO**, com o LED amarelo e o display mostrando “Irregular”.

**Fazer:** colocar **accelZ = −0,5 g**.

> E agora um buraco de verdade: a variação passa de 1 g. O estado é **CRÍTICO**: LED vermelho, buzzer tocando e o LED azul piscando, que é a câmera tirando a foto. No Serial aparece o pré-chamado, com o motivo “buraco”, o nome da foto e as coordenadas.

**Fazer:** mostrar rapidamente a aba do HiveMQ com a mensagem recebida e voltar. Depois, colocar **accelZ = 1 g**.

> A mensagem chegou no broker, pronta para o FIWARE. Volto o acelerômetro ao normal, e o estado volta a NORMAL.

### 5.3 · Alagamento (cerca de 20 s)

**Fazer:** clicar no HC-SR04 e colocar **distance = 42 cm**.

> O sensor está a 50 centímetros do chão. Se a distância cai para 42, existem 8 centímetros de água: **ATENÇÃO**, “Agua na via”.

**Fazer:** colocar **distance = 30 cm**.

> Com 30 centímetros, a lâmina é de 20: **CRÍTICO**, “Alagado”. É esse evento que vira alerta para os cidadãos e para as ambulâncias evitarem a rua.

**Fazer:** voltar para **distance = 50 cm**.

### 5.4 · Semáforo apagado (cerca de 20 s, com a espera)

**Fazer:** clicar no LDR e colocar **lux = 5**. Falar enquanto espera os 10 segundos.

> Agora o semáforo apagou. Repare que o estado não vai direto para crítico: ele fica em **ATENÇÃO**, e o display conta os segundos sem luz. Isso evita alarme falso quando passa uma sombra ou o próprio ônibus cobre o sensor. Depois de 10 segundos sem luz…
>
> *(quando mudar)* …vira **CRÍTICO**: “Semaforo apagado”. O pré-chamado vai para a CET com a posição do cruzamento.

**Fazer:** voltar para **lux = 500**.

### 5.5 · FALHA (cerca de 25 s)

**Fazer:** clicar na **chave GPS** para baixo.

> Sem GPS, o evento não tem posição e perde o valor. Então o estado é **FALHA**: o LED amarelo pisca e o display mostra “GPS sem sinal”. As leituras desse período são descartadas.

**Fazer:** chave GPS para cima. Depois, girar o **potenciômetro** quase até o mínimo.

> Com a bateria abaixo de 15%, também é FALHA. Essa reserva serve para o dispositivo avisar a central e enviar o que estiver guardado antes de desligar.

**Fazer:** girar o potenciômetro de volta para perto do máximo.

### 5.6 · Sem rede: fila offline (cerca de 35 s)

**Fazer:** clicar na **chave rede** para baixo.

> Agora o ônibus entrou num túnel, sem cobertura. O display mostra “OFF” e o número de eventos na fila.

**Fazer:** colocar **accelZ = 1,6 g**, esperar a ATENÇÃO, colocar **accelZ = −0,5 g**, esperar o CRÍTICO e voltar para **accelZ = 1 g**.

> Mesmo sem internet, o dispositivo continua decidindo: LED, buzzer e foto funcionam normalmente. Cada evento vai para a fila. O display mostra três eventos guardados.

**Fazer:** clicar na **chave rede** para cima e esperar até 5 segundos.

> A cobertura voltou. Em poucos segundos ele reconecta e envia os eventos guardados, na ordem em que aconteceram. Nada se perdeu.

### 5.7 · Reporte do voluntário (cerca de 10 s)

**Fazer:** clicar no **botão azul**.

> Por último, o botão do Kit Cidadão: o voluntário vê um problema que o sensor não pegou, aperta o botão, a câmera tira a foto e o reporte segue com a posição do GPS.

### 5.8 · Extra, se sobrar tempo: foto remota (cerca de 15 s)

**Fazer:** na aba do HiveMQ, publicar `olhonavia001@foto|` no tópico `/TEF/olhonavia001/cmd` e voltar ao Wokwi.

> O caminho também funciona ao contrário: a gestora pode pedir uma foto do ponto pelo FIWARE, e o dispositivo responde que o comando foi executado.

---

## Cena 6 · Encerramento (6:40 a 7:00)

**Tela:** diagrama com o LED verde aceso, ou a capa do PDF.

**Fala:**

> Então é isso: um sensor que mede, decide e avisa sozinho, com ou sem internet, e que transforma cada ônibus da cidade num fiscal da rua. O link do Wokwi e a documentação técnica estão na entrega. Obrigado!

---

## Checklist final (critério do vídeo, 25 pontos)

| O briefing pede | Onde aparece no vídeo |
|---|---|
| Quem é o cidadão e o problema em uma frase | Cena 2 |
| Onde o dispositivo fica | Cena 2 (ônibus e voluntários) |
| Quais ODS atende | Cena 2 (11, 9, 3 e 13) |
| Cada componente e por que está ali | Cena 3 |
| Limites escolhidos | Cena 4, ação 1 |
| Estados e decisão, mostrando o código | Cena 4, ações 2 e 3 |
| Alterar os sensores e mostrar todos os estados | Cena 5: NORMAL (5.1), ATENÇÃO (5.2, 5.3, 5.4), CRÍTICO (5.2, 5.3, 5.4), FALHA (5.5) |
| Respostas locais visíveis e audíveis | LEDs, buzzer, LCD e flash em toda a Cena 5 |
| Funcionamento sem rede | Cena 5.6 |

**Dicas de gravação**

- Se passar de 7 minutos, corte primeiro o extra (5.8) e depois o potenciômetro da bateria (a FALHA já aparece com o GPS).
- Entre um teste e outro, sempre volte o controle ao valor inicial, senão o estado seguinte não aparece.
- Cada mudança leva cerca de meio segundo por causa da média móvel e da confirmação. Espere o LED mudar antes de seguir a fala.
- Se o MQTT demorar a conectar no começo, siga com a explicação: ele tenta de novo a cada 5 segundos.
