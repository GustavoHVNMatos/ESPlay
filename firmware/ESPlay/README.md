# ESPlay — engine v0.1

Biblioteca para a Arduino IDE que serve de base a todos os jogos educativos do ESPlay.

## Instalação (uma única vez)

1. Arduino IDE → **Sketch → Incluir Biblioteca → Adicionar biblioteca .ZIP** → escolha `ESPlay.zip`.
2. Gerenciador de Bibliotecas: instale **Adafruit GFX Library** e **Adafruit SSD1306** *(a biblioteca do LCD ST7735 entra após confirmação dos pinos de hardware)*.
3. Gerenciador de Placas: instale **esp32 by Espressif Systems**.
4. Placa: *ESP32 Dev Module*.

Os exemplos ficam em **Arquivo → Exemplos → ESPlay**:
- **TesteBotoes** (teste de hardware)
- **PixelMath** (Matemática — tabuada)
- **AcentoQuest** (Português — tonicidade)
- **CicloFis** (Ciências — mudanças de estado)
- **RegioMap** (Geografia — estados e capitais)
- **Algoritmando** (Lógica e programação — sequências de setas)

## Hardware

| Peça | Pino |
|---|---|
| Display atual (OLED I2C SDA / SCL) | GPIO 21 / 22 |
| Display final (LCD ST7735 SPI) | *a confirmar com a equipe de hardware* |
| Botão CIMA | GPIO 32 |
| Botão BAIXO | GPIO 33 |
| Botão ESQUERDA | GPIO 25 |
| Botão DIREITA | GPIO 26 |
| Botão AÇÃO | GPIO 27 *(a confirmar com a carcaça)* |

Todos os botões ligam o pino ao GND (usam `INPUT_PULLUP`). Se a carcaça usar outros pinos, chame `esp.setPins(...)` antes de `esp.begin(...)`.

## Primeiro uso

1. Grave **TesteBotoes** e confirme que os 5 botões acendem na tela.
2. Grave um jogo (ex.: **PixelMath**). Na primeira vez o console pede o **número do aluno** (1 a 999): CIMA/BAIXO muda de 1 em 1, ESQUERDA/DIREITA de 10 em 10, AÇÃO confirma.
3. Para trocar o número depois: segure **ESQUERDA + DIREITA** ao ligar.

O número e os dados continuam na flash ao gravar outro jogo, desde que a opção *Erase All Flash Before Sketch Upload* esteja **desativada** na Arduino IDE.

## Estrutura de um jogo

```cpp
#include <ESPlay.h>
ESPlay esp;

void setup() { esp.begin("meujogo", "Meu Jogo", "tabuada"); }

void loop() {
  if (esp.tick(30)) {          // 30 quadros por segundo
    // ler botões:  esp.pressed(BTN_LEFT), esp.held(BTN_UP) ...
    // acerto/erro: esp.recordHit(categoria), esp.recordMiss(categoria)
    // fim:         bool recorde = esp.gameOver(pontos);
    // desenhar:    esp.clear(); esp.text(...); esp.show();
  }
}
```

Use `esp.width()` e `esp.height()` em vez de números fixos: assim todos os 5 jogos e os quizzes criados no site continuam funcionando quando o backend de vídeo migrar em `ESPlay.cpp` para o ST7735 128×160.

## Dados de aprendizado (por jogo e por aluno)

Gravados na flash ao fim de cada partida (`gameOver`): melhor pontuação, nº de partidas, acertos, erros, últimas 10 pontuações e acertos/erros por categoria (`tag` 0..15, ex.: tabuada do 7).

## Protocolo serial (115200 baud)

O painel do professor usa estes comandos, uma linha cada:

| Comando | Resposta |
|---|---|
| `ESPLAY?` ou `DUMP` | uma linha JSON com os dados |
| `ID <n>` | `OK` e define o número do aluno (1..999) |
| `RESET` | `OK` e apaga as estatísticas **deste jogo** |

Exemplo de resposta:

```json
{"esplay":1,"student":12,"game":"pixelmath","name":"PixelMath","tag":"tabuada","best":120,"plays":8,"hits":45,"misses":8,"last":[30,50,40],"tagHits":[0,3,2,...],"tagMisses":[0,0,1,...]}
```

## Limitações desta versão

- Display: o backend atual usa o OLED SSD1306 128x64 (`ESPlay.cpp`). Quando os pinos e a orientação do ST7735 forem confirmados, basta atualizar `ESPlay.h`, `ESPlay.cpp` e `library.properties`.
- Os acertos e erros da partida em andamento só vão para a flash no `gameOver`; desligar no meio perde essa partida.
- Os nomes de jogo e de categoria não podem conter aspas.
