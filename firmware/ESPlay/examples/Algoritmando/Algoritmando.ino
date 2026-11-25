/*
  Algoritmando — jogo educativo de sequencias logicas para o ESPlay
  -----------------------------------------------------------------
  Uma sequencia de 6 setas aparece com uma lacuna e o aluno aperta
  a seta (CIMA, BAIXO, ESQUERDA ou DIREITA) que completa o padrao.
  Ao errar, o jogo mostra a regra do padrao e a seta certa.

  Materia: Logica e programacao   |   Area: sequencias e padroes

  Requer a biblioteca ESPlay (instalar uma unica vez).
  Categorias no painel do professor:
    1 = Padrao de 2 comandos   |   2 = Padrao de 3 comandos
    3 = Padrao com oposto      |   4 = Padrao em pares
*/

#include <ESPlay.h>

ESPlay esp;

// ====== AJUSTES PARA O PROFESSOR ======
const int COMPLEXIDADE = 0;   // 0 = todos; 1 = 2 comandos; 2 = 2 e 3 comandos; 3 = opostos e pares
const int TEMPO_RODADA = 0;   // segundos por rodada (0 = sem limite)
const int QTD_RODADAS  = 10;  // rodadas por partida
// ======================================

enum Dir : uint8_t { DIR_CIMA = 0, DIR_BAIXO = 1, DIR_ESQ = 2, DIR_DIR = 3 };
const char* NOMES_DIR[] = {"CIMA", "BAIXO", "ESQ", "DIR"};

enum Tela { TITULO, JOGANDO, ACERTO, FEEDBACK, FIM };
Tela tela = TITULO;

uint8_t seq[6];
int lacuna = 5;
uint8_t respostaCerta = DIR_CIMA;
uint8_t catAtual = 1;
char regraAtual[28];

int rodadaAtual = 0;
int totalRodadas = 10;
int acertos = 0;
int score = 0;
bool novoRecorde = false;
bool tempoEsgotado = false;
int timerFrames = 0;
int esperaFrames = 0;

uint8_t oposto(uint8_t d) {
  if (d == DIR_CIMA) return DIR_BAIXO;
  if (d == DIR_BAIXO) return DIR_CIMA;
  if (d == DIR_ESQ) return DIR_DIR;
  return DIR_ESQ;
}

uint8_t sortearCategoria() {
  if (COMPLEXIDADE == 1) return 1;
  if (COMPLEXIDADE == 2) return (uint8_t)random(1, 3);
  if (COMPLEXIDADE == 3) return (uint8_t)random(3, 5);
  return (uint8_t)random(1, 5);
}

void gerarRodada() {
  catAtual = sortearCategoria();

  if (catAtual == 1) {
    uint8_t a = random(0, 4);
    uint8_t b;
    do { b = random(0, 4); } while (b == a);
    for (int i = 0; i < 6; i++) seq[i] = (i % 2 == 0) ? a : b;
    lacuna = random(4, 6);
    snprintf(regraAtual, sizeof(regraAtual), "REPETE: %s, %s", NOMES_DIR[a], NOMES_DIR[b]);
  } else if (catAtual == 2) {
    uint8_t a = random(0, 4);
    uint8_t b, c;
    do { b = random(0, 4); } while (b == a);
    do { c = random(0, 4); } while (c == a || c == b);
    uint8_t pat[3] = {a, b, c};
    for (int i = 0; i < 6; i++) seq[i] = pat[i % 3];
    lacuna = random(3, 6);
    snprintf(regraAtual, sizeof(regraAtual), "REPETE: %s,%s,%s", NOMES_DIR[a], NOMES_DIR[b], NOMES_DIR[c]);
  } else if (catAtual == 3) {
    uint8_t a = random(0, 4);
    uint8_t b = random(0, 4);
    uint8_t c = random(0, 4);
    seq[0] = a; seq[1] = oposto(a);
    seq[2] = b; seq[3] = oposto(b);
    seq[4] = c; seq[5] = oposto(c);
    int pares[3] = {1, 3, 5};
    lacuna = pares[random(0, 3)];
    snprintf(regraAtual, sizeof(regraAtual), "CADA SETA + OPOSTO");
  } else {
    uint8_t a = random(0, 4);
    uint8_t b, c;
    do { b = random(0, 4); } while (b == a);
    do { c = random(0, 4); } while (c == b);
    seq[0] = a; seq[1] = a;
    seq[2] = b; seq[3] = b;
    seq[4] = c; seq[5] = c;
    int pares[3] = {1, 3, 5};
    lacuna = pares[random(0, 3)];
    snprintf(regraAtual, sizeof(regraAtual), "EM PARES: 2x CADA");
  }

  respostaCerta = seq[lacuna];
  tempoEsgotado = false;
  timerFrames = (TEMPO_RODADA > 0) ? TEMPO_RODADA * 30 : 0;
  rodadaAtual++;
  tela = JOGANDO;
}

void novoJogo() {
  totalRodadas = (QTD_RODADAS > 0) ? QTD_RODADAS : 10;
  rodadaAtual = 0;
  acertos = 0;
  score = 0;
  novoRecorde = false;
  gerarRodada();
}

void avancarOuFim() {
  if (rodadaAtual >= totalRodadas) {
    novoRecorde = esp.gameOver(score);
    tela = FIM;
  } else {
    gerarRodada();
  }
}

void desenharSeta(int cx, int cy, uint8_t dir, bool on) {
  if (dir == DIR_CIMA) {
    esp.fillTriangle(cx, cy - 5, cx - 4, cy, cx + 4, cy, on);
    esp.fillRect(cx - 1, cy, 3, 5, on);
  } else if (dir == DIR_BAIXO) {
    esp.fillTriangle(cx, cy + 5, cx - 4, cy, cx + 4, cy, on);
    esp.fillRect(cx - 1, cy - 5, 3, 5, on);
  } else if (dir == DIR_ESQ) {
    esp.fillTriangle(cx - 5, cy, cx, cy - 4, cx, cy + 4, on);
    esp.fillRect(cx, cy - 1, 5, 3, on);
  } else {
    esp.fillTriangle(cx + 5, cy, cx, cy - 4, cx, cy + 4, on);
    esp.fillRect(cx - 5, cy - 1, 5, 3, on);
  }
}

void atualizar() {
  if (tela == TITULO || tela == FIM) {
    if (esp.pressed(BTN_ACTION)) novoJogo();
    return;
  }

  if (tela == ACERTO || tela == FEEDBACK) {
    esperaFrames--;
    if (esperaFrames <= 0 || esp.pressed(BTN_ACTION)) avancarOuFim();
    return;
  }

  // JOGANDO
  if (TEMPO_RODADA > 0) {
    timerFrames--;
    if (timerFrames <= 0) {
      esp.recordMiss(catAtual);
      tempoEsgotado = true;
      esperaFrames = 75;
      tela = FEEDBACK;
      return;
    }
  }

  int escolhida = -1;
  if (esp.pressed(BTN_UP)) escolhida = DIR_CIMA;
  else if (esp.pressed(BTN_DOWN)) escolhida = DIR_BAIXO;
  else if (esp.pressed(BTN_LEFT)) escolhida = DIR_ESQ;
  else if (esp.pressed(BTN_RIGHT)) escolhida = DIR_DIR;

  if (escolhida >= 0) {
    if ((uint8_t)escolhida == respostaCerta) {
      score += 10;
      acertos++;
      esp.recordHit(catAtual);
      esperaFrames = 18;
      tela = ACERTO;
    } else {
      esp.recordMiss(catAtual);
      tempoEsgotado = false;
      esperaFrames = 75;
      tela = FEEDBACK;
    }
  }
}

void desenhar() {
  int w = esp.width();
  int h = esp.height();
  esp.clear();

  if (tela == TITULO) {
    // 12 letras: usa size=1 com setas decorativas para caber com folga na largura
    esp.rect(4, 2, w - 8, 16, true);
    desenharSeta(14, 10, DIR_DIR, true);
    esp.textCenter(w / 2, 6, "ALGORITMANDO", 1);
    desenharSeta(w - 14, 10, DIR_ESQ, true);

    esp.text(0, 24, "Aluno:");
    esp.number(42, 24, esp.studentId());
    esp.text(0, 35, "Recorde:");
    esp.number(54, 35, esp.best());
    esp.textCenter(w / 2, h - 10, "Aperte ACAO", 1);
    esp.show();
    return;
  }

  if (tela == FIM) {
    esp.textCenter(w / 2, 0, "FIM DA RODADA", 1);
    esp.line(0, 10, w - 1, 10, true);
    char resumo[24];
    snprintf(resumo, sizeof(resumo), "Acertos: %d/%d", acertos, totalRodadas);
    esp.text(0, 15, resumo);
    esp.text(0, 26, "Pts:");
    esp.number(30, 26, score);
    if (novoRecorde) {
      esp.text(0, 38, "NOVO RECORDE!");
    } else {
      esp.text(0, 38, "Recorde:");
      esp.number(54, 38, esp.best());
    }
    esp.textCenter(w / 2, h - 10, "ACAO: jogar de novo", 1);
    esp.show();
    return;
  }

  if (tela == ACERTO) {
    esp.textCenter(w / 2, 14, "CORRETO!", 2);
    esp.textCenter(w / 2, 36, "+10 pontos", 1);
    esp.show();
    return;
  }

  if (tela == FEEDBACK) {
    esp.text(0, 0, tempoEsgotado ? "TEMPO ESGOTADO!" : "ERROU!");
    esp.text(0, 13, regraAtual);
    esp.text(0, 32, "Seta certa:");
    esp.rect(74, 26, 18, 18, true);
    desenharSeta(83, 35, respostaCerta, true);
    esp.text(96, 32, NOMES_DIR[respostaCerta]);
    esp.textCenter(w / 2, h - 10, "ACAO: continuar", 1);
    esp.show();
    return;
  }

  // JOGANDO
  char topo[24];
  if (TEMPO_RODADA > 0) {
    int seg = (timerFrames + 29) / 30;
    snprintf(topo, sizeof(topo), "%d/%d  %ds", rodadaAtual, totalRodadas, seg);
  } else {
    snprintf(topo, sizeof(topo), "%d/%d", rodadaAtual, totalRodadas);
  }
  esp.text(0, 0, topo);

  char pts[12];
  snprintf(pts, sizeof(pts), "P:%d", score);
  esp.text(w - (int)strlen(pts) * 6, 0, pts);

  esp.textCenter(w / 2, 12, "Qual seta completa?", 1);

  int box = 16;
  int gap = 3;
  int totalW = 6 * box + 5 * gap;
  int x0 = (w - totalW) / 2;
  int y0 = 26;

  for (int i = 0; i < 6; i++) {
    int bx = x0 + i * (box + gap);
    if (i == lacuna) {
      esp.fillRect(bx, y0, box, box, true);
      esp.text(bx + 5, y0 + 4, "?", 1, false);
    } else {
      esp.rect(bx, y0, box, box, true);
      desenharSeta(bx + box / 2, y0 + box / 2, seq[i], true);
    }
  }

  esp.textCenter(w / 2, h - 10, "Aperte a seta certa", 1);
  esp.show();
}

void setup() {
  esp.begin("algoritmando", "Algoritmando", "padrao");
}

void loop() {
  if (esp.tick(30)) {
    atualizar();
    desenhar();
  }
}
