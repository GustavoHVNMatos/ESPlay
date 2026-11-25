/*
  PixelMath — jogo educativo de tabuada para o ESPlay
  ----------------------------------------------------
  Uma conta de multiplicação aparece no topo e 3 respostas caem
  em 3 colunas. Use ESQUERDA/DIREITA para ficar na coluna da
  resposta certa antes que elas cheguem embaixo. Errar termina
  o jogo e mostra qual era a resposta correta.

  Matéria: Matemática   |   Área: tabuada (multiplicação)

  Requer a biblioteca ESPlay (instalar uma única vez).
  O painel do professor lê, por tabuada, quantos acertos e erros
  cada aluno teve (categoria = primeiro número da conta).
*/

#include <ESPlay.h>

ESPlay esp;

// ====== AJUSTES PARA O PROFESSOR ======
const int   TABUADA_FIXA       = 0;     // 0 = todas as tabuadas; 1..9 = só aquela
const float VELOCIDADE_INICIAL = 0.5f;  // pixels por quadro (menor = mais devagar)
const float VELOCIDADE_MAXIMA  = 1.5f;
const float ACELERACAO         = 0.03f; // aumento a cada acerto
// ======================================

enum Tela { TITULO, JOGANDO, FIM };
Tela tela = TITULO;

int colX[3];
int startY, catchY;

float ansY = 0;
float velocidade = VELOCIDADE_INICIAL;
int ansValue[3];
int correctIndex = 0;
int playerCol = 1;
int numA = 1, numB = 1;
int score = 0;
bool novoRecorde = false;
int ultimaConta = 0;   // resposta certa da conta em que o aluno errou

void gerarPergunta() {
  numA = (TABUADA_FIXA >= 1 && TABUADA_FIXA <= 9) ? TABUADA_FIXA : random(1, 10);
  numB = random(1, 10);
  int correct = numA * numB;

  int wrong1, wrong2;
  do { wrong1 = correct + random(-5, 6); } while (wrong1 == correct || wrong1 < 0);
  do { wrong2 = correct + random(-5, 6); } while (wrong2 == correct || wrong2 == wrong1 || wrong2 < 0);

  correctIndex = random(0, 3);
  int usedWrong = 0;
  for (int i = 0; i < 3; i++) {
    if (i == correctIndex) {
      ansValue[i] = correct;
    } else {
      ansValue[i] = (usedWrong == 0) ? wrong1 : wrong2;
      usedWrong++;
    }
  }
  ansY = startY;
}

void novoJogo() {
  score = 0;
  playerCol = 1;
  velocidade = VELOCIDADE_INICIAL;
  novoRecorde = false;
  gerarPergunta();
  tela = JOGANDO;
}

void atualizar() {
  if (tela == TITULO) {
    if (esp.pressed(BTN_ACTION)) novoJogo();
    return;
  }

  if (tela == FIM) {
    if (esp.pressed(BTN_ACTION)) novoJogo();
    return;
  }

  // JOGANDO
  if (esp.pressed(BTN_LEFT) && playerCol > 0) playerCol--;
  if (esp.pressed(BTN_RIGHT) && playerCol < 2) playerCol++;

  ansY += velocidade;

  if (ansY >= catchY) {
    if (playerCol == correctIndex) {
      score += 10;
      esp.recordHit(numA);
      velocidade += ACELERACAO;
      if (velocidade > VELOCIDADE_MAXIMA) velocidade = VELOCIDADE_MAXIMA;
      gerarPergunta();
    } else {
      esp.recordMiss(numA);
      ultimaConta = numA * numB;
      novoRecorde = esp.gameOver(score);   // grava os dados na flash
      tela = FIM;
    }
  }
}

void desenhar() {
  int w = esp.width();
  int h = esp.height();
  esp.clear();

  if (tela == TITULO) {
    esp.textCenter(w / 2, 0, "PIXELMATH", 2);
    esp.text(0, 22, "Aluno:");
    esp.number(40, 22, esp.studentId());
    esp.text(0, 33, "Recorde:");
    esp.number(50, 33, esp.best());
    esp.textCenter(w / 2, 52, "Aperte ACAO", 1);
    esp.show();
    return;
  }

  if (tela == FIM) {
    esp.textCenter(w / 2, 0, "GAME OVER", 2);

    esp.text(0, 20, "Era: ");
    esp.number(30, 20, numA);
    esp.text(40, 20, "x");
    esp.number(50, 20, numB);
    esp.text(60, 20, "=");
    esp.number(70, 20, ultimaConta);

    esp.text(0, 31, "Pts:");
    esp.number(30, 31, score);
    if (novoRecorde) {
      esp.text(0, 42, "NOVO RECORDE!");
    } else {
      esp.text(0, 42, "Recorde:");
      esp.number(50, 42, esp.best());
    }
    esp.textCenter(w / 2, 54, "ACAO: jogar de novo", 1);
    esp.show();
    return;
  }

  // JOGANDO
  esp.text(0, 0, "P:");
  esp.number(12, 0, score);

  char conta[16];
  snprintf(conta, sizeof(conta), "%d x %d = ?", numA, numB);
  esp.textCenter(w / 2 + 10, 0, conta, 1);

  for (int i = 0; i < 3; i++) {
    esp.numberCenter(colX[i], (int)ansY, ansValue[i], 1);
  }

  int px = colX[playerCol];
  esp.fillTriangle(px - 6, h - 1, px + 6, h - 1, px, h - 7);
  esp.show();
}

void setup() {
  esp.begin("pixelmath", "PixelMath", "tabuada");

  int w = esp.width();
  int h = esp.height();
  for (int i = 0; i < 3; i++) colX[i] = w * (2 * i + 1) / 6;   // 3 colunas centralizadas
  startY = 12;
  catchY = h - 16;
}

void loop() {
  if (esp.tick(30)) {
    atualizar();
    desenhar();
  }
}
