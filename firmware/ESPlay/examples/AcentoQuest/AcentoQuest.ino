/*
  AcentoQuest — jogo educativo de tonicidade para o ESPlay
  --------------------------------------------------------
  Uma palavra aparece na tela e o aluno classifica:
  1. OXITONA, 2. PAROXITONA ou 3. PROPAROXITONA.
  Ao errar, a tela destaca a silaba tonica e mostra a regra.

  Materia: Portugues   |   Area: tonicidade das palavras

  Requer a biblioteca ESPlay (instalar uma unica vez).
  O painel do professor mostra acertos e erros por classificacao:
    1 = Oxitonas   |   2 = Paroxitonas   |   3 = Proparoxitonas
*/

#include <ESPlay.h>

ESPlay esp;

// ====== AJUSTES PARA O PROFESSOR ======
const int CATEGORIA_FIXA = 0;   // 0 = todas; 1 = oxitonas; 2 = paroxitonas; 3 = proparoxitonas
const int QTD_PERGUNTAS  = 10;  // perguntas por partida (ex.: 5, 10, 15)
// ======================================

struct Palavra {
  const char* texto;
  uint8_t tInicio;
  uint8_t tTam;
  uint8_t cat;          // 1=oxitona, 2=paroxitona, 3=proparoxitona
  const char* regra;
};

// Banco sem acentos para a fonte do console, evitando palavras ambiguas (como SABIA).
const Palavra BANCO[] = {
  // Oxitonas (1)
  {"CAFE",      2, 2, 1, "ULTIMA SILABA FORTE"},
  {"SOFA",      2, 2, 1, "ULTIMA SILABA FORTE"},
  {"CAJU",      2, 2, 1, "TERMINA EM U: OXITONA"},
  {"ABACAXI",   5, 2, 1, "TERMINA EM I: OXITONA"},
  {"TAMBOR",    3, 3, 1, "TERMINA EM R: OXITONA"},
  {"NARIZ",     2, 3, 1, "TERMINA EM Z: OXITONA"},
  {"ANZOL",     2, 3, 1, "TERMINA EM L: OXITONA"},
  {"CORACAO",   4, 3, 1, "TERMINA EM AO: OXITONA"},
  {"PARABENS",  4, 4, 1, "TERMINA EM ENS: OXITONA"},
  {"BAMBU",     3, 2, 1, "TERMINA EM U: OXITONA"},
  // Paroxitonas (2)
  {"CADERNO",   2, 3, 2, "PENULTIMA SILABA FORTE"},
  {"JANELA",    2, 2, 2, "PENULTIMA SILABA FORTE"},
  {"ESCOLA",    2, 2, 2, "PENULTIMA SILABA FORTE"},
  {"MENINO",    2, 2, 2, "PENULTIMA SILABA FORTE"},
  {"LAPIS",     0, 2, 2, "PAROXITONA TERM. EM IS"},
  {"FACIL",     0, 2, 2, "PAROXITONA TERM. EM L"},
  {"ACUCAR",    1, 2, 2, "PAROXITONA TERM. EM R"},
  {"ORGAO",     0, 2, 2, "PAROXITONA TERM. EM AO"},
  {"AMIGO",     1, 2, 2, "PENULTIMA SILABA FORTE"},
  {"LIVRO",     0, 2, 2, "PENULTIMA SILABA FORTE"},
  // Proparoxitonas (3)
  {"LAMPADA",   0, 3, 3, "TODAS PROPAROXITONAS SAO ACENTUADAS"},
  {"ARVORE",    0, 2, 3, "TODAS PROPAROXITONAS SAO ACENTUADAS"},
  {"PASSARO",   0, 3, 3, "TODAS PROPAROXITONAS SAO ACENTUADAS"},
  {"OCULOS",    0, 1, 3, "TODAS PROPAROXITONAS SAO ACENTUADAS"},
  {"RELAMPAGO", 2, 3, 3, "TODAS PROPAROXITONAS SAO ACENTUADAS"},
  {"TRIANGULO", 3, 2, 3, "TODAS PROPAROXITONAS SAO ACENTUADAS"},
  {"XICARA",    0, 2, 3, "TODAS PROPAROXITONAS SAO ACENTUADAS"},
  {"FOSFORO",   0, 3, 3, "TODAS PROPAROXITONAS SAO ACENTUADAS"},
  {"ABOBORA",   1, 2, 3, "TODAS PROPAROXITONAS SAO ACENTUADAS"},
  {"GRAMATICA", 3, 2, 3, "TODAS PROPAROXITONAS SAO ACENTUADAS"}
};

const int NUM_PALAVRAS = sizeof(BANCO) / sizeof(BANCO[0]);
const char* NOMES_CAT[] = {"", "OXITONA", "PAROXITONA", "PROPAROXITONA"};
const char* OPCOES[] = {"1. OXITONA", "2. PAROXITONA", "3. PROPAROXITONA"};

enum Tela { TITULO, JOGANDO, ACERTO, FEEDBACK, FIM };
Tela tela = TITULO;

int pool[NUM_PALAVRAS];
int poolTam = 0;
int poolPos = 0;

int perguntaAtual = 0;
int totalPerguntas = 10;
int selecao = 0;
int acertos = 0;
int score = 0;
bool novoRecorde = false;
int esperaFrames = 0;
Palavra atual;

void embaralharPool() {
  poolTam = 0;
  for (int i = 0; i < NUM_PALAVRAS; i++) {
    if (CATEGORIA_FIXA < 1 || CATEGORIA_FIXA > 3 || BANCO[i].cat == CATEGORIA_FIXA) {
      pool[poolTam++] = i;
    }
  }
  if (poolTam == 0) {
    for (int i = 0; i < NUM_PALAVRAS; i++) pool[poolTam++] = i;
  }
  for (int i = poolTam - 1; i > 0; i--) {
    int j = random(0, i + 1);
    int tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  poolPos = 0;
}

void proximaPergunta() {
  if (poolPos >= poolTam) embaralharPool();
  atual = BANCO[pool[poolPos++]];
  selecao = 0;
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

void desenharDestaqueTonica(int cy, const Palavra& p) {
  int w = esp.width();
  int len = strlen(p.texto);
  uint8_t size = (len * 12 <= w - 4) ? 2 : 1;
  int step = 6 * size;
  int wordW = len * step - size;
  int x0 = (w - wordW) / 2;

  int bx = x0 + p.tInicio * step - 1;
  int bw = p.tTam * step - size + 2;
  esp.fillRect(bx, cy - 1, bw, 8 * size + 2, true);

  for (int i = 0; i < len; i++) {
    char ch[2] = {p.texto[i], 0};
    bool inv = (i >= p.tInicio && i < p.tInicio + p.tTam);
    esp.text(x0 + i * step, cy, ch, size, !inv);
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

  if (esp.pressed(BTN_ACTION)) {
    uint8_t escolhida = (uint8_t)(selecao + 1);
    if (escolhida == atual.cat) {
      score += 10;
      acertos++;
      esp.recordHit(atual.cat);
      esperaFrames = 18;
      tela = ACERTO;
    } else {
      esp.recordMiss(atual.cat);
      esperaFrames = 85;
      tela = FEEDBACK;
    }
  }
}

void desenhar() {
  int w = esp.width();
  int h = esp.height();
  esp.clear();

  if (tela == TITULO) {
    esp.textCenter(w / 2, 0, "ACENTO", 2);
    esp.textCenter(w / 2, 16, "QUEST", 1);
    esp.text(0, 28, "Aluno:");
    esp.number(42, 28, esp.studentId());
    esp.text(0, 38, "Recorde:");
    esp.number(54, 38, esp.best());
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
    esp.text(0, 0, "ERROU! TONICA:");
    desenharDestaqueTonica(11, atual);
    esp.text(0, 30, NOMES_CAT[atual.cat]);
    textoQuebrado(0, 41, w, 10, atual.regra);
    esp.show();
    return;
  }

  // JOGANDO
  char prog[16];
  snprintf(prog, sizeof(prog), "%d/%d", perguntaAtual, totalPerguntas);
  esp.text(0, 0, prog);

  char pts[16];
  snprintf(pts, sizeof(pts), "P:%d", score);
  esp.text(w - (int)strlen(pts) * 6, 0, pts);

  uint8_t wSize = ((int)strlen(atual.texto) * 12 <= w - 4) ? 2 : 1;
  esp.textCenter(w / 2, 11, atual.texto, wSize);
  esp.line(0, 29, w - 1, 29, true);

  for (int i = 0; i < 3; i++) {
    int oy = 33 + i * 10;
    if (i == selecao) {
      esp.fillRect(0, oy - 1, w, 9, true);
      esp.text(4, oy, OPCOES[i], 1, false);
    } else {
      esp.text(4, oy, OPCOES[i], 1, true);
    }
  }
  esp.show();
}

void setup() {
  esp.begin("acentoquest", "AcentoQuest", "tonicidade");
}

void loop() {
  if (esp.tick(30)) {
    atualizar();
    desenhar();
  }
}
