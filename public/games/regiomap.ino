/*
  RegioMap — jogo educativo de estados e capitais do Brasil para o ESPlay
  ----------------------------------------------------------------------
  O nome de um estado aparece no topo e o aluno escolhe a capital certa
  entre 3 opcoes. Ao errar, a tela congela mostrando o estado, a capital
  correta e a regiao ate o aluno apertar ACAO.

  Materia: Geografia   |   Area: estados e capitais do Brasil

  Requer a biblioteca ESPlay (instalar uma unica vez).
  Categorias no painel do professor:
    1 = Norte   |   2 = Nordeste   |   3 = Centro-Oeste
    4 = Sudeste |   5 = Sul
*/

#include <ESPlay.h>

ESPlay esp;

// ====== AJUSTES PARA O PROFESSOR ======
const int REGIAO_FIXA   = 0;   // 0 = todas; 1=Norte; 2=Nordeste; 3=Centro-Oeste; 4=Sudeste; 5=Sul
const int QTD_PERGUNTAS = 10;  // perguntas por partida (ex.: 5, 10, 15, 27)
// ======================================

struct UnidadeFed {
  const char* estado;
  const char* capital;
  uint8_t regiao; // 1..5
};

const char* NOMES_REGIOES[] = {
  "",
  "Norte",
  "Nordeste",
  "Centro-Oeste",
  "Sudeste",
  "Sul"
};

// Todas as 27 unidades da federacao (26 estados e o Distrito Federal)
const UnidadeFed BANCO[] = {
  // 1 Norte (7)
  {"ACRE",                "RIO BRANCO",     1},
  {"AMAPA",               "MACAPA",         1},
  {"AMAZONAS",            "MANAUS",         1},
  {"PARA",                "BELEM",          1},
  {"RONDONIA",            "PORTO VELHO",    1},
  {"RORAIMA",             "BOA VISTA",      1},
  {"TOCANTINS",           "PALMAS",         1},
  // 2 Nordeste (9)
  {"ALAGOAS",             "MACEIO",         2},
  {"BAHIA",               "SALVADOR",       2},
  {"CEARA",               "FORTALEZA",      2},
  {"MARANHAO",            "SAO LUIS",       2},
  {"PARAIBA",             "JOAO PESSOA",    2},
  {"PERNAMBUCO",          "RECIFE",         2},
  {"PIAUI",               "TERESINA",       2},
  {"RIO GRANDE DO NORTE", "NATAL",          2},
  {"SERGIPE",             "ARACAJU",        2},
  // 3 Centro-Oeste (4)
  {"DISTRITO FEDERAL",    "BRASILIA",       3},
  {"GOIAS",               "GOIANIA",        3},
  {"MATO GROSSO",         "CUIABA",         3},
  {"MATO GROSSO DO SUL",  "CAMPO GRANDE",   3},
  // 4 Sudeste (4)
  {"ESPIRITO SANTO",      "VITORIA",        4},
  {"MINAS GERAIS",        "BELO HORIZONTE", 4},
  {"RIO DE JANEIRO",      "RIO DE JANEIRO", 4},
  {"SAO PAULO",           "SAO PAULO",      4},
  // 5 Sul (3)
  {"PARANA",              "CURITIBA",       5},
  {"RIO GRANDE DO SUL",   "PORTO ALEGRE",   5},
  {"SANTA CATARINA",      "FLORIANOPOLIS",  5}
};

const int NUM_UFS = sizeof(BANCO) / sizeof(BANCO[0]);

enum Tela { TITULO, JOGANDO, ACERTO, FEEDBACK, FIM };
Tela tela = TITULO;

int pool[NUM_UFS];
int poolTam = 0;
int poolPos = 0;
int ultimoIndice = -1;

int opcoesIdx[3];
int selecao = 0;
int perguntaAtual = 0;
int totalPerguntas = 10;
int acertos = 0;
int score = 0;
bool novoRecorde = false;
int esperaFrames = 0;
int atualIdx = 0;

void embaralharPool() {
  poolTam = 0;
  for (int i = 0; i < NUM_UFS; i++) {
    if (REGIAO_FIXA < 1 || REGIAO_FIXA > 5 || BANCO[i].regiao == REGIAO_FIXA) {
      pool[poolTam++] = i;
    }
  }
  if (poolTam == 0) {
    for (int i = 0; i < NUM_UFS; i++) pool[poolTam++] = i;
  }
  for (int i = poolTam - 1; i > 0; i--) {
    int j = random(0, i + 1);
    int tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }
  if (poolTam > 1 && pool[0] == ultimoIndice) {
    int tmp = pool[0];
    pool[0] = pool[poolTam - 1];
    pool[poolTam - 1] = tmp;
  }
  poolPos = 0;
}

void montarOpcoes(int corretaIdx) {
  int w1, w2;
  do { w1 = random(0, NUM_UFS); } while (w1 == corretaIdx);
  do { w2 = random(0, NUM_UFS); } while (w2 == corretaIdx || w2 == w1);

  opcoesIdx[0] = corretaIdx;
  opcoesIdx[1] = w1;
  opcoesIdx[2] = w2;
  for (int i = 2; i > 0; i--) {
    int j = random(0, i + 1);
    int tmp = opcoesIdx[i];
    opcoesIdx[i] = opcoesIdx[j];
    opcoesIdx[j] = tmp;
  }
}

void proximaPergunta() {
  if (poolPos >= poolTam) embaralharPool();
  atualIdx = pool[poolPos++];
  ultimoIndice = atualIdx;
  montarOpcoes(atualIdx);
  selecao = 0;
  perguntaAtual++;
  tela = JOGANDO;
}

void novoJogo() {
  totalPerguntas = (QTD_PERGUNTAS > 0) ? QTD_PERGUNTAS : 10;
  perguntaAtual = 0;
  acertos = 0;
  score = 0;
  ultimoIndice = -1;
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

void atualizar() {
  if (tela == TITULO || tela == FIM) {
    if (esp.pressed(BTN_ACTION)) novoJogo();
    return;
  }

  if (tela == ACERTO) {
    esperaFrames--;
    if (esperaFrames <= 0 || esp.pressed(BTN_ACTION)) avancarOuFim();
    return;
  }

  if (tela == FEEDBACK) {
    if (esp.pressed(BTN_ACTION)) avancarOuFim();
    return;
  }

  // JOGANDO
  if (esp.pressed(BTN_UP)) selecao = (selecao + 2) % 3;
  if (esp.pressed(BTN_DOWN)) selecao = (selecao + 1) % 3;

  if (esp.pressed(BTN_ACTION)) {
    const UnidadeFed& uf = BANCO[atualIdx];
    if (opcoesIdx[selecao] == atualIdx) {
      score += 10;
      acertos++;
      esp.recordHit(uf.regiao);
      esperaFrames = 18;
      tela = ACERTO;
    } else {
      esp.recordMiss(uf.regiao);
      tela = FEEDBACK;
    }
  }
}

void desenhar() {
  int w = esp.width();
  int h = esp.height();
  esp.clear();

  if (tela == TITULO) {
    esp.textCenter(w / 2, 0, "REGIOMAP", 2);
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

  const UnidadeFed& uf = BANCO[atualIdx];

  if (tela == FEEDBACK) {
    esp.text(0, 0, "RESPOSTA CERTA:");
    esp.text(0, 13, uf.estado);
    esp.text(0, 25, uf.capital);
    char reg[24];
    snprintf(reg, sizeof(reg), "Regiao: %s", NOMES_REGIOES[uf.regiao]);
    esp.text(0, 38, reg);
    esp.textCenter(w / 2, h - 10, "ACAO: continuar", 1);
    esp.show();
    return;
  }

  // JOGANDO
  char prog[16];
  snprintf(prog, sizeof(prog), "%d/%d", perguntaAtual, totalPerguntas);
  esp.text(0, 0, prog);

  char pts[12];
  snprintf(pts, sizeof(pts), "P:%d", score);
  esp.text(w - (int)strlen(pts) * 6, 0, pts);

  esp.textCenter(w / 2, 14, uf.estado, 1);
  esp.line(0, 27, w - 1, 27, true);

  for (int i = 0; i < 3; i++) {
    int oy = 32 + i * 10;
    char lin[24];
    snprintf(lin, sizeof(lin), "%d. %s", i + 1, BANCO[opcoesIdx[i]].capital);
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
  esp.begin("regiomap", "RegioMap", "regiao");
}

void loop() {
  if (esp.tick(30)) {
    atualizar();
    desenhar();
  }
}
