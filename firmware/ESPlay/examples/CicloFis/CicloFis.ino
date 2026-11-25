/*
  CicloFis — jogo educativo de mudancas de estado fisico para o ESPlay
  --------------------------------------------------------------------
  Um fenomeno do dia a dia aparece na tela e o aluno escolhe qual
  mudanca de estado ele representa. Ao errar, o jogo pausa cerca de
  2 segundos mostrando a mudanca correta e o sentido dela.

  Materia: Ciencias   |   Area: mudancas de estado fisico

  Requer a biblioteca ESPlay (instalar uma unica vez).
  Categorias no painel do professor:
    1 = Fusao   |   2 = Vaporizacao   |   3 = Solidificacao
    4 = Condensacao   |   5 = Sublimacao
*/

#include <ESPlay.h>

ESPlay esp;

// ====== AJUSTES PARA O PROFESSOR ======
const bool USAR_FUSAO         = true;
const bool USAR_VAPORIZACAO   = true;
const bool USAR_SOLIDIFICACAO = true;
const bool USAR_CONDENSACAO   = true;
const bool USAR_SUBLIMACAO    = true;
const int  TEMPO_PERGUNTA     = 0;    // segundos por pergunta (0 = sem limite)
const int  QTD_PERGUNTAS      = 10;   // perguntas por partida
// ======================================

struct Fenomeno {
  const char* texto;
  uint8_t cat; // 1..5
};

const char* NOMES_MUD[] = {
  "",
  "FUSAO",
  "VAPORIZACAO",
  "SOLIDIFICACAO",
  "CONDENSACAO",
  "SUBLIMACAO"
};

const char* SENTIDOS[] = {
  "",
  "SOLIDO PARA LIQUIDO",
  "LIQUIDO PARA GASOSO",
  "LIQUIDO PARA SOLIDO",
  "GASOSO PARA LIQUIDO",
  "SOLIDO PARA GASOSO"
};

const Fenomeno BANCO[] = {
  // 1 Fusao
  {"Gelo derretendo no copo", 1},
  {"Manteiga na frigideira quente", 1},
  {"Sorvete derretendo ao sol", 1},
  {"Vela de cera derretendo", 1},
  // 2 Vaporizacao
  {"Agua fervendo na panela", 2},
  {"Roupa secando no varal", 2},
  {"Poca de chuva sumindo ao sol", 2},
  {"Alcool evaporando da mao", 2},
  // 3 Solidificacao
  {"Agua virando gelo no freezer", 3},
  {"Chocolate derretido endurecendo", 3},
  {"Lava vulcanica virando rocha", 3},
  {"Cera liquida esfriando na mesa", 3},
  // 4 Condensacao
  {"Gotas no copo gelado por fora", 4},
  {"Espelho embacado apos o banho", 4},
  {"Orvalho na grama de madrugada", 4},
  {"Nuvem formando gotas de chuva", 4},
  // 5 Sublimacao
  {"Naftalina sumindo no armario", 5},
  {"Gelo seco soltando fumaca", 5},
  {"Pastilha sanitaria sumindo no ar", 5},
  {"Neve evaporando sem virar agua", 5}
};

const int NUM_FENOMENOS = sizeof(BANCO) / sizeof(BANCO[0]);

enum Tela { TITULO, JOGANDO, ACERTO, FEEDBACK, FIM };
Tela tela = TITULO;

int pool[NUM_FENOMENOS];
int poolTam = 0;
int poolPos = 0;

uint8_t opcoes[3];
int selecao = 0;
int perguntaAtual = 0;
int totalPerguntas = 10;
int acertos = 0;
int score = 0;
bool novoRecorde = false;
bool tempoEsgotado = false;
int timerFrames = 0;
int esperaFrames = 0;
Fenomeno atual;

bool categoriaAtiva(uint8_t c) {
  if (c == 1) return USAR_FUSAO;
  if (c == 2) return USAR_VAPORIZACAO;
  if (c == 3) return USAR_SOLIDIFICACAO;
  if (c == 4) return USAR_CONDENSACAO;
  if (c == 5) return USAR_SUBLIMACAO;
  return false;
}

void embaralharPool() {
  poolTam = 0;
  for (int i = 0; i < NUM_FENOMENOS; i++) {
    if (categoriaAtiva(BANCO[i].cat)) pool[poolTam++] = i;
  }
  if (poolTam == 0) {
    for (int i = 0; i < NUM_FENOMENOS; i++) pool[poolTam++] = i;
  }
  for (int i = poolTam - 1; i > 0; i--) {
    int j = random(0, i + 1);
    int tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  poolPos = 0;
}

void montarOpcoes(uint8_t correta) {
  uint8_t cands[5];
  int nc = 0;
  for (uint8_t c = 1; c <= 5; c++) {
    if (c != correta && categoriaAtiva(c)) cands[nc++] = c;
  }
  for (uint8_t c = 1; c <= 5; c++) {
    if (c != correta && !categoriaAtiva(c)) cands[nc++] = c;
  }
  // Embaralha primeiros candidatos ativos, se houver ao menos 2 ativos
  int ativos = 0;
  for (uint8_t c = 1; c <= 5; c++) if (c != correta && categoriaAtiva(c)) ativos++;
  int lim = (ativos >= 2) ? ativos : nc;
  for (int i = lim - 1; i > 0; i--) {
    int j = random(0, i + 1);
    uint8_t tmp = cands[i];
    cands[i] = cands[j];
    cands[j] = tmp;
  }

  opcoes[0] = correta;
  opcoes[1] = cands[0];
  opcoes[2] = cands[1];
  for (int i = 2; i > 0; i--) {
    int j = random(0, i + 1);
    uint8_t tmp = opcoes[i];
    opcoes[i] = opcoes[j];
    opcoes[j] = tmp;
  }
}

void proximaPergunta() {
  if (poolPos >= poolTam) embaralharPool();
  atual = BANCO[pool[poolPos++]];
  montarOpcoes(atual.cat);
  selecao = 0;
  tempoEsgotado = false;
  timerFrames = (TEMPO_PERGUNTA > 0) ? TEMPO_PERGUNTA * 30 : 0;
  perguntaAtual++;
  tela = JOGANDO;
}

void novoJogo() {
  totalPerguntas = (QTD_PERGUNTAS > 0) ? QTD_PERGUNTAS : 10;
  perguntaAtual = 0;
  acertos = 0;
  score = 0;
  novoRecorde = false;
  embaralharPool();
  proximaPergunta();
}

void avancarOuFim() {
  if (perguntaAtual >= totalPerguntas) {
    novoRecorde = esp.gameOver(score);
    tela = FIM;
  } else {
    proximaPergunta();
  }
}

void textoQuebrado(int x, int y, int maxLarg, int altLinha, const char* s) {
  int maxChars = maxLarg / 6;
  if (maxChars < 4) maxChars = 4;
  int len = strlen(s);
  int pos = 0;
  int cy = y;
  while (pos < len) {
    while (pos < len && s[pos] == ' ') pos++;
    if (pos >= len) break;
    int fim = pos + maxChars;
    if (fim >= len) {
      fim = len;
    } else {
      int k = fim;
      while (k > pos && s[k] != ' ') k--;
      if (k > pos) fim = k;
    }
    char linha[32];
    int n = fim - pos;
    if (n >= (int)sizeof(linha)) n = sizeof(linha) - 1;
    memcpy(linha, s + pos, n);
    linha[n] = 0;
    esp.text(x, cy, linha, 1);
    cy += altLinha;
    pos = fim;
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
  if (esp.pressed(BTN_UP)) selecao = (selecao + 2) % 3;
  if (esp.pressed(BTN_DOWN)) selecao = (selecao + 1) % 3;

  if (TEMPO_PERGUNTA > 0) {
    timerFrames--;
    if (timerFrames <= 0) {
      esp.recordMiss(atual.cat);
      tempoEsgotado = true;
      esperaFrames = 60; // ~2 segundos
      tela = FEEDBACK;
      return;
    }
  }

  if (esp.pressed(BTN_ACTION)) {
    if (opcoes[selecao] == atual.cat) {
      score += 10;
      acertos++;
      esp.recordHit(atual.cat);
      esperaFrames = 18;
      tela = ACERTO;
    } else {
      esp.recordMiss(atual.cat);
      tempoEsgotado = false;
      esperaFrames = 60; // ~2 segundos
      tela = FEEDBACK;
    }
  }
}

void desenhar() {
  int w = esp.width();
  int h = esp.height();
  esp.clear();

  if (tela == TITULO) {
    esp.textCenter(w / 2, 0, "CICLOFIS", 2);
    esp.text(0, 22, "Aluno:");
    esp.number(42, 22, esp.studentId());
    esp.text(0, 33, "Recorde:");
    esp.number(54, 33, esp.best());
    esp.textCenter(w / 2, h - 10, "Aperte ACAO", 1);
    esp.show();
    return;
  }

  if (tela == FIM) {
    esp.textCenter(w / 2, 0, "FIM DA RODADA", 1);
    esp.line(0, 10, w - 1, 10, true);
    char resumo[24];
    snprintf(resumo, sizeof(resumo), "Acertos: %d/%d", acertos, totalPerguntas);
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
    esp.text(0, 0, tempoEsgotado ? "TEMPO ESGOTADO!" : "ERROU! ERA:");
    const char* nome = NOMES_MUD[atual.cat];
    uint8_t nSize = ((int)strlen(nome) * 12 <= w - 4) ? 2 : 1;
    esp.textCenter(w / 2, nSize == 2 ? 14 : 18, nome, nSize);
    esp.textCenter(w / 2, 36, SENTIDOS[atual.cat], 1);
    esp.textCenter(w / 2, h - 10, "Aguarde...", 1);
    esp.show();
    return;
  }

  // JOGANDO
  char topo[24];
  if (TEMPO_PERGUNTA > 0) {
    int seg = (timerFrames + 29) / 30;
    snprintf(topo, sizeof(topo), "%d/%d  %ds", perguntaAtual, totalPerguntas, seg);
  } else {
    snprintf(topo, sizeof(topo), "%d/%d", perguntaAtual, totalPerguntas);
  }
  esp.text(0, 0, topo);

  char pts[12];
  snprintf(pts, sizeof(pts), "P:%d", score);
  esp.text(w - (int)strlen(pts) * 6, 0, pts);

  textoQuebrado(0, 10, w, 9, atual.texto);
  esp.line(0, 29, w - 1, 29, true);

  for (int i = 0; i < 3; i++) {
    int oy = 33 + i * 10;
    char lin[22];
    snprintf(lin, sizeof(lin), "%d. %s", i + 1, NOMES_MUD[opcoes[i]]);
    if (i == selecao) {
      esp.fillRect(0, oy - 1, w, 9, true);
      esp.text(4, oy, lin, 1, false);
    } else {
      esp.text(4, oy, lin, 1, true);
    }
  }
  esp.show();
}

void setup() {
  esp.begin("ciclofis", "CicloFis", "mudanca");
}

void loop() {
  if (esp.tick(30)) {
    atualizar();
    desenhar();
  }
}
