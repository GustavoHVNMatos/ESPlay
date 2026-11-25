/*
  TesteBotoes — teste de hardware do ESPlay
  ------------------------------------------
  Grave este sketch logo depois de montar o console. Ao apertar
  cada botão, o desenho correspondente acende na tela.
  Se algum botão não acender, confira a solda e o pino:
    CIMA=GPIO32  BAIXO=GPIO33  ESQUERDA=GPIO25  DIREITA=GPIO26  ACAO=GPIO27
  Display: SDA=GPIO21, SCL=GPIO22.

  Este sketch não pede o número do aluno.
*/

#include <ESPlay.h>

ESPlay esp;

// desenha um quadrado: cheio quando o botão está apertado
void botao(int x, int y, bool ligado) {
  if (ligado) esp.fillRect(x, y, 14, 14, true);
  else        esp.rect(x, y, 14, 14, true);
}

void setup() {
  esp.begin("teste", "Teste de botoes", "item", false);
}

void loop() {
  if (!esp.tick(30)) return;

  esp.clear();
  esp.text(0, 0, "TESTE DE BOTOES");

  // cruzeta à esquerda
  botao(24, 14, esp.held(BTN_UP));
  botao(24, 46, esp.held(BTN_DOWN));
  botao(8,  30, esp.held(BTN_LEFT));
  botao(40, 30, esp.held(BTN_RIGHT));

  // botão de ação à direita
  if (esp.held(BTN_ACTION)) esp.gfx().fillCircle(100, 38, 9, 1);
  else                      esp.gfx().drawCircle(100, 38, 9, 1);
  esp.text(88, 54, "ACAO");

  esp.show();
}
