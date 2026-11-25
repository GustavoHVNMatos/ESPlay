// Modo Menu (Opcional): combina de 2 a 5 jogos autorais em um único sketch com menu colorido 160x128.
// Inclui apenas os 5 jogos educativos oficiais do ESPlay.

import { $, $$, flash, selectNode, copyText, download } from './util.js';
import { GAMES_BY_PREVIEW, MenuGame } from './preview.js';

const AUTHORIAL_GAMES = [
  { id: 'pixelmath',    nome: 'PixelMath',    tag: 'tabuada',    ns: 'pm' },
  { id: 'acentoquest',  nome: 'AcentoQuest',  tag: 'tonicidade', ns: 'aq' },
  { id: 'ciclofis',     nome: 'CicloFis',     tag: 'mudanca',    ns: 'cf' },
  { id: 'regiomap',     nome: 'RegioMap',     tag: 'regiao',     ns: 'rm' },
  { id: 'algoritmando', nome: 'Algoritmando', tag: 'padrao',     ns: 'ag' },
];

const CPP_MODULES = {
  pixelmath: `namespace pm {
  const int colX[3] = {27, 80, 133};
  const int START_Y = 24, CATCH_Y = H - 28;
  enum Tela { TITULO, JOGANDO, FIM };
  Tela tela = TITULO;
  float ansY = START_Y, vel = 0.8f;
  int prevAnsY = START_Y, ansVal[3], correctIdx = 0, col = 1, prevCol = 1;
  int numA = 1, numB = 1, score = 0, ultima = 0;
  bool novoRec = false, dirty = true;

  void header() {
    tft.fillRect(0, 0, W, 19, COL_BG);
    tft.setTextSize(1); tft.setTextColor(ST7735_WHITE); tft.setCursor(4, 4);
    tft.print("P:"); tft.print(score);
    char conta[16]; snprintf(conta, sizeof(conta), "%d x %d = ?", numA, numB);
    int16_t x1, y1; uint16_t tw, th; tft.setTextSize(2); tft.getTextBounds(conta, 0, 0, &x1, &y1, &tw, &th);
    tft.setCursor(W - (int)tw - 4, 2); tft.setTextColor(ST7735_CYAN); tft.print(conta);
    tft.drawFastHLine(0, 19, W, COL_DKGRAY);
  }
  void gerar() {
    numA = random(1, 10); numB = random(1, 10); int c = numA * numB, w1, w2;
    do { w1 = c + random(-5, 6); } while (w1 == c || w1 < 0);
    do { w2 = c + random(-5, 6); } while (w2 == c || w2 == w1 || w2 < 0);
    correctIdx = random(0, 3); int u = 0;
    for (int i = 0; i < 3; i++) ansVal[i] = (i == correctIdx) ? c : (u++ == 0 ? w1 : w2);
    ansY = START_Y; prevAnsY = START_Y; header();
  }
  void drawP(int c, uint16_t color) { int px = colX[c]; tft.fillTriangle(px - 8, H - 3, px + 8, H - 3, px, H - 15, color); }
  void reset() { tela = TITULO; dirty = true; }
  void novo(int idx) {
    score = 0; col = 1; prevCol = 1; vel = 0.8f; novoRec = false; resetPend(idx);
    tft.fillScreen(COL_BG); gerar(); drawP(col, ST7735_GREEN); tela = JOGANDO;
  }
  void step(int idx, bool, bool, bool lPr, bool rPr, bool fPr) {
    if (tela != JOGANDO) {
      if (dirty) {
        tft.fillScreen(COL_BG);
        if (tela == TITULO) {
          drawCentered("PIXELMATH", 12, 2, ST7735_CYAN);
          drawCentered("Tabuada em 3 colunas", 36, 1, COL_GRAY);
          char b[24]; snprintf(b, sizeof(b), "Recorde: %ld", (long)gameStats[idx].best);
          drawCentered(b, 64, 1, ST7735_YELLOW);
          drawCentered("ACAO: jogar | Segure 2s: menu", 104, 1, ST7735_GREEN);
        } else {
          drawCentered("GAME OVER", 10, 2, ST7735_RED);
          char b[28]; snprintf(b, sizeof(b), "Era: %d x %d = %d", numA, numB, ultima);
          drawCentered(b, 38, 1, ST7735_YELLOW);
          snprintf(b, sizeof(b), "Pts: %d", score); drawCentered(b, 56, 2, ST7735_WHITE);
          drawCentered(novoRec ? "NOVO RECORDE!" : "ACAO: de novo", 84, 1, ST7735_GREEN);
          drawCentered("Segure ACAO 2s: menu", 108, 1, COL_GRAY);
        }
        dirty = false;
      }
      if (fPr) novo(idx);
      return;
    }
    if (lPr && col > 0) col--;
    if (rPr && col < 2) col++;
    if (col != prevCol) { drawP(prevCol, COL_BG); drawP(col, ST7735_GREEN); prevCol = col; }
    tft.fillRect(0, prevAnsY, W, 16, COL_BG);
    ansY += vel;
    if (ansY >= CATCH_Y) {
      if (col == correctIdx) {
        score += 10; recordHit(idx, numA); if (vel < 2.2f) vel += 0.05f;
        gerar(); drawP(col, ST7735_GREEN);
      } else {
        recordMiss(idx, numA); ultima = numA * numB; novoRec = finishGame(idx, score);
        tela = FIM; dirty = true; return;
      }
    }
    int yi = (int)ansY; tft.setTextSize(2); tft.setTextColor(ST7735_YELLOW);
    for (int i = 0; i < 3; i++) {
      char s[8]; snprintf(s, sizeof(s), "%d", ansVal[i]);
      int16_t x1, y1; uint16_t tw, th; tft.getTextBounds(s, 0, 0, &x1, &y1, &tw, &th);
      tft.setCursor(colX[i] - (int)tw / 2, yi); tft.print(s);
    }
    prevAnsY = yi;
  }
}`,

  acentoquest: `namespace aq {
  struct Pal { const char* w; uint8_t t0, tL, cat; const char* r; };
  const Pal BANCO[] = {
    {"CAFE",2,2,1,"ULTIMA SILABA FORTE"}, {"SOFA",2,2,1,"ULTIMA SILABA FORTE"},
    {"CAJU",2,2,1,"TERMINA EM U: OXITONA"}, {"ABACAXI",5,2,1,"TERMINA EM I: OXITONA"},
    {"TAMBOR",3,3,1,"TERMINA EM R: OXITONA"}, {"NARIZ",2,3,1,"TERMINA EM Z: OXITONA"},
    {"ANZOL",2,3,1,"TERMINA EM L: OXITONA"}, {"CORACAO",4,3,1,"TERMINA EM AO: OXITONA"},
    {"CADERNO",2,3,2,"PENULTIMA SILABA FORTE"}, {"JANELA",2,2,2,"PENULTIMA SILABA FORTE"},
    {"ESCOLA",2,2,2,"PENULTIMA SILABA FORTE"}, {"LAPIS",0,2,2,"PAROXITONA TERM. EM IS"},
    {"FACIL",0,2,2,"PAROXITONA TERM. EM L"}, {"ACUCAR",1,2,2,"PAROXITONA TERM. EM R"},
    {"AMIGO",1,2,2,"PENULTIMA SILABA FORTE"}, {"LIVRO",0,2,2,"PENULTIMA SILABA FORTE"},
    {"LAMPADA",0,3,3,"TODAS PROPAROXITONAS SAO ACENTUADAS"}, {"ARVORE",0,2,3,"TODAS PROPAROXITONAS SAO ACENTUADAS"},
    {"PASSARO",0,3,3,"TODAS PROPAROXITONAS SAO ACENTUADAS"}, {"OCULOS",0,1,3,"TODAS PROPAROXITONAS SAO ACENTUADAS"},
    {"RELAMPAGO",2,3,3,"TODAS PROPAROXITONAS SAO ACENTUADAS"}, {"TRIANGULO",3,2,3,"TODAS PROPAROXITONAS SAO ACENTUADAS"},
    {"XICARA",0,2,3,"TODAS PROPAROXITONAS SAO ACENTUADAS"}, {"FOSFORO",0,3,3,"TODAS PROPAROXITONAS SAO ACENTUADAS"}
  };
  const int N = sizeof(BANCO) / sizeof(BANCO[0]);
  const char* CATS[] = {"", "OXITONA", "PAROXITONA", "PROPAROXITONA"};
  const char* OPTS[] = {"1. OXITONA", "2. PAROXITONA", "3. PROPAROXITONA"};
  enum Tela { TITULO, JOGANDO, ACERTO, FEEDBACK, FIM };
  Tela tela = TITULO; int pool[N], pPos = 0, cur = 0, sel = 0, ac = 0, sc = 0, wait = 0;
  bool rec = false, dirty = true; Pal at;
  void shuf() { for (int i = 0; i < N; i++) pool[i] = i; for (int i = N - 1; i > 0; i--) { int j = random(0, i + 1); int t = pool[i]; pool[i] = pool[j]; pool[j] = t; } pPos = 0; }
  void prox() { if (pPos >= N) shuf(); at = BANCO[pool[pPos++]]; sel = 0; cur++; tela = JOGANDO; dirty = true; }
  void reset() { tela = TITULO; dirty = true; }
  void draw() {
    tft.fillScreen(COL_BG);
    if (tela == TITULO) {
      drawCentered("ACENTOQUEST", 12, 2, ST7735_CYAN); drawCentered("Tonicidade das palavras", 36, 1, COL_GRAY);
      drawCentered("ACAO: jogar | Segure 2s: menu", 104, 1, ST7735_GREEN);
    } else if (tela == FIM) {
      drawRoundResult("FIM DA RODADA", ac, 10, sc, rec);
    } else if (tela == ACERTO) {
      drawCentered("CORRETO!", 44, 2, ST7735_GREEN); drawCentered("+10 pontos", 72, 1, ST7735_YELLOW);
    } else if (tela == FEEDBACK) {
      drawCentered("ERROU! SILABA TONICA:", 6, 1, ST7735_RED);
      int len = strlen(at.w); uint8_t sz = (len * 12 <= W - 12) ? 2 : 1; int step = 6 * sz;
      int x0 = (W - (len * step - sz)) / 2;
      tft.fillRoundRect(x0 + at.t0 * step - 2, 22, at.tL * step - sz + 4, 8 * sz + 4, 3, ST7735_YELLOW);
      tft.setTextSize(sz);
      for (int i = 0; i < len; i++) {
        bool inv = (i >= at.t0 && i < at.t0 + at.tL);
        tft.setTextColor(inv ? COL_BG : ST7735_WHITE); tft.setCursor(x0 + i * step, 24); tft.print(at.w[i]);
      }
      drawCentered(CATS[at.cat], 52, 1, ST7735_CYAN);
      textoQuebrado(8, 68, W - 16, 11, at.r, ST7735_WHITE);
    } else {
      drawTopHud(cur, 10, sc);
      uint8_t sz = ((int)strlen(at.w) * 12 <= W - 12) ? 2 : 1;
      drawCentered(at.w, sz == 2 ? 26 : 30, sz, ST7735_CYAN);
      for (int i = 0; i < 3; i++) drawOptBtn(56 + i * 22, 18, OPTS[i], i == sel);
    }
  }
  void step(int idx, bool uPr, bool dPr, bool, bool, bool fPr) {
    if (tela == TITULO || tela == FIM) {
      if (fPr) { cur = 0; ac = 0; sc = 0; rec = false; resetPend(idx); shuf(); prox(); }
    } else if (tela == ACERTO || tela == FEEDBACK) {
      if (--wait <= 0 || fPr) { if (cur >= 10) { rec = finishGame(idx, sc); tela = FIM; dirty = true; } else prox(); }
    } else {
      if (uPr) { sel = (sel + 2) % 3; dirty = true; }
      if (dPr) { sel = (sel + 1) % 3; dirty = true; }
      if (fPr) {
        if ((uint8_t)(sel + 1) == at.cat) { sc += 10; ac++; recordHit(idx, at.cat); wait = 18; tela = ACERTO; }
        else { recordMiss(idx, at.cat); wait = 80; tela = FEEDBACK; }
        dirty = true;
      }
    }
    if (dirty) { draw(); dirty = false; }
  }
}`,

  ciclofis: `namespace cf {
  struct Fen { const char* t; uint8_t c; };
  const char* MUD[] = {"", "FUSAO", "VAPORIZACAO", "SOLIDIFICACAO", "CONDENSACAO", "SUBLIMACAO"};
  const char* SENT[] = {"", "SOLIDO PARA LIQUIDO", "LIQUIDO PARA GASOSO", "LIQUIDO PARA SOLIDO", "GASOSO PARA LIQUIDO", "SOLIDO PARA GASOSO"};
  const Fen BANCO[] = {
    {"Gelo derretendo no copo",1}, {"Manteiga na frigideira quente",1}, {"Sorvete derretendo ao sol",1}, {"Vela de cera derretendo",1},
    {"Agua fervendo na panela",2}, {"Roupa secando no varal",2}, {"Poca de chuva sumindo ao sol",2}, {"Alcool evaporando da mao",2},
    {"Agua virando gelo no freezer",3}, {"Chocolate derretido endurecendo",3}, {"Lava vulcanica virando rocha",3}, {"Cera liquida esfriando na mesa",3},
    {"Gotas no copo gelado por fora",4}, {"Espelho embacado apos o banho",4}, {"Orvalho na grama de madrugada",4}, {"Nuvem formando gotas de chuva",4},
    {"Naftalina sumindo no armario",5}, {"Gelo seco soltando fumaca",5}, {"Pastilha sanitaria sumindo no ar",5}, {"Neve evaporando sem virar agua",5}
  };
  const int N = sizeof(BANCO) / sizeof(BANCO[0]);
  enum Tela { TITULO, JOGANDO, ACERTO, FEEDBACK, FIM };
  Tela tela = TITULO; int pool[N], pPos = 0, cur = 0, sel = 0, ac = 0, sc = 0, wait = 0;
  uint8_t opts[3]; bool rec = false, dirty = true; Fen at;
  void shuf() { for (int i = 0; i < N; i++) pool[i] = i; for (int i = N - 1; i > 0; i--) { int j = random(0, i + 1); int t = pool[i]; pool[i] = pool[j]; pool[j] = t; } pPos = 0; }
  void prox() {
    if (pPos >= N) shuf(); at = BANCO[pool[pPos++]];
    uint8_t c[4]; int nc = 0; for (uint8_t x = 1; x <= 5; x++) if (x != at.c) c[nc++] = x;
    for (int i = nc - 1; i > 0; i--) { int j = random(0, i + 1); uint8_t t = c[i]; c[i] = c[j]; c[j] = t; }
    opts[0] = at.c; opts[1] = c[0]; opts[2] = c[1];
    for (int i = 2; i > 0; i--) { int j = random(0, i + 1); uint8_t t = opts[i]; opts[i] = opts[j]; opts[j] = t; }
    sel = 0; cur++; tela = JOGANDO; dirty = true;
  }
  void reset() { tela = TITULO; dirty = true; }
  void draw() {
    tft.fillScreen(COL_BG);
    if (tela == TITULO) {
      drawCentered("CICLOFIS", 12, 2, ST7735_CYAN); drawCentered("Mudancas de estado fisico", 36, 1, COL_GRAY);
      drawCentered("ACAO: jogar | Segure 2s: menu", 104, 1, ST7735_GREEN);
    } else if (tela == FIM) {
      drawRoundResult("FIM DA RODADA", ac, 10, sc, rec);
    } else if (tela == ACERTO) {
      drawCentered("CORRETO!", 44, 2, ST7735_GREEN); drawCentered("+10 pontos", 72, 1, ST7735_YELLOW);
    } else if (tela == FEEDBACK) {
      drawCentered("ERROU! ERA:", 10, 1, ST7735_RED);
      uint8_t sz = ((int)strlen(MUD[at.c]) * 12 <= W - 12) ? 2 : 1;
      drawCentered(MUD[at.c], sz == 2 ? 32 : 36, sz, ST7735_YELLOW);
      drawCentered(SENT[at.c], 66, 1, ST7735_CYAN);
    } else {
      drawTopHud(cur, 10, sc);
      textoQuebrado(6, 22, W - 12, 11, at.t, ST7735_WHITE);
      for (int i = 0; i < 3; i++) { char l[24]; snprintf(l, sizeof(l), "%d. %s", i + 1, MUD[opts[i]]); drawOptBtn(56 + i * 22, 18, l, i == sel); }
    }
  }
  void step(int idx, bool uPr, bool dPr, bool, bool, bool fPr) {
    if (tela == TITULO || tela == FIM) {
      if (fPr) { cur = 0; ac = 0; sc = 0; rec = false; resetPend(idx); shuf(); prox(); }
    } else if (tela == ACERTO || tela == FEEDBACK) {
      if (--wait <= 0 || fPr) { if (cur >= 10) { rec = finishGame(idx, sc); tela = FIM; dirty = true; } else prox(); }
    } else {
      if (uPr) { sel = (sel + 2) % 3; dirty = true; }
      if (dPr) { sel = (sel + 1) % 3; dirty = true; }
      if (fPr) {
        if (opts[sel] == at.c) { sc += 10; ac++; recordHit(idx, at.c); wait = 18; tela = ACERTO; }
        else { recordMiss(idx, at.c); wait = 60; tela = FEEDBACK; }
        dirty = true;
      }
    }
    if (dirty) { draw(); dirty = false; }
  }
}`,

  regiomap: `namespace rm {
  struct UF { const char* e; const char* c; uint8_t r; };
  const char* REGS[] = {"", "Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"};
  const UF BANCO[] = {
    {"ACRE","RIO BRANCO",1},{"AMAPA","MACAPA",1},{"AMAZONAS","MANAUS",1},{"PARA","BELEM",1},
    {"RONDONIA","PORTO VELHO",1},{"RORAIMA","BOA VISTA",1},{"TOCANTINS","PALMAS",1},
    {"ALAGOAS","MACEIO",2},{"BAHIA","SALVADOR",2},{"CEARA","FORTALEZA",2},{"MARANHAO","SAO LUIS",2},
    {"PARAIBA","JOAO PESSOA",2},{"PERNAMBUCO","RECIFE",2},{"PIAUI","TERESINA",2},
    {"RIO GRANDE DO NORTE","NATAL",2},{"SERGIPE","ARACAJU",2},
    {"DISTRITO FEDERAL","BRASILIA",3},{"GOIAS","GOIANIA",3},{"MATO GROSSO","CUIABA",3},{"MATO GROSSO DO SUL","CAMPO GRANDE",3},
    {"ESPIRITO SANTO","VITORIA",4},{"MINAS GERAIS","BELO HORIZONTE",4},{"RIO DE JANEIRO","RIO DE JANEIRO",4},{"SAO PAULO","SAO PAULO",4},
    {"PARANA","CURITIBA",5},{"RIO GRANDE DO SUL","PORTO ALEGRE",5},{"SANTA CATARINA","FLORIANOPOLIS",5}
  };
  const int N = sizeof(BANCO) / sizeof(BANCO[0]);
  enum Tela { TITULO, JOGANDO, ACERTO, FEEDBACK, FIM };
  Tela tela = TITULO; int pool[N], pPos = 0, opts[3], cur = 0, sel = 0, ac = 0, sc = 0, wait = 0, atIdx = 0;
  bool rec = false, dirty = true;
  void shuf() { for (int i = 0; i < N; i++) pool[i] = i; for (int i = N - 1; i > 0; i--) { int j = random(0, i + 1); int t = pool[i]; pool[i] = pool[j]; pool[j] = t; } pPos = 0; }
  void prox() {
    if (pPos >= N) shuf(); atIdx = pool[pPos++];
    int w1, w2; do { w1 = random(0, N); } while (w1 == atIdx); do { w2 = random(0, N); } while (w2 == atIdx || w2 == w1);
    opts[0] = atIdx; opts[1] = w1; opts[2] = w2;
    for (int i = 2; i > 0; i--) { int j = random(0, i + 1); int t = opts[i]; opts[i] = opts[j]; opts[j] = t; }
    sel = 0; cur++; tela = JOGANDO; dirty = true;
  }
  void reset() { tela = TITULO; dirty = true; }
  void draw() {
    tft.fillScreen(COL_BG);
    if (tela == TITULO) {
      drawCentered("REGIOMAP", 12, 2, ST7735_CYAN); drawCentered("Estados e capitais", 36, 1, COL_GRAY);
      drawCentered("ACAO: jogar | Segure 2s: menu", 104, 1, ST7735_GREEN);
    } else if (tela == FIM) {
      drawRoundResult("FIM DA RODADA", ac, 10, sc, rec);
    } else if (tela == ACERTO) {
      drawCentered("CORRETO!", 44, 2, ST7735_GREEN); drawCentered("+10 pontos", 72, 1, ST7735_YELLOW);
    } else if (tela == FEEDBACK) {
      const UF& u = BANCO[atIdx];
      drawCentered("RESPOSTA CERTA:", 10, 1, ST7735_RED); drawCentered(u.e, 32, 1, ST7735_WHITE);
      drawCentered(u.c, ((int)strlen(u.c) * 12 <= W - 12) ? 52 : 55, ((int)strlen(u.c) * 12 <= W - 12) ? 2 : 1, ST7735_GREEN);
      char reg[24]; snprintf(reg, sizeof(reg), "Regiao: %s", REGS[u.r]); drawCentered(reg, 80, 1, ST7735_YELLOW);
      drawCentered("ACAO: continuar", 108, 1, COL_GRAY);
    } else {
      drawTopHud(cur, 10, sc);
      drawCentered(BANCO[atIdx].e, 28, 1, ST7735_YELLOW);
      for (int i = 0; i < 3; i++) { char l[24]; snprintf(l, sizeof(l), "%d. %s", i + 1, BANCO[opts[i]].c); drawOptBtn(52 + i * 23, 19, l, i == sel); }
    }
  }
  void step(int idx, bool uPr, bool dPr, bool, bool, bool fPr) {
    if (tela == TITULO || tela == FIM) {
      if (fPr) { cur = 0; ac = 0; sc = 0; rec = false; resetPend(idx); shuf(); prox(); }
    } else if (tela == ACERTO) {
      if (--wait <= 0 || fPr) { if (cur >= 10) { rec = finishGame(idx, sc); tela = FIM; dirty = true; } else prox(); }
    } else if (tela == FEEDBACK) {
      if (fPr) { if (cur >= 10) { rec = finishGame(idx, sc); tela = FIM; dirty = true; } else prox(); }
    } else {
      if (uPr) { sel = (sel + 2) % 3; dirty = true; }
      if (dPr) { sel = (sel + 1) % 3; dirty = true; }
      if (fPr) {
        if (opts[sel] == atIdx) { sc += 10; ac++; recordHit(idx, BANCO[atIdx].r); wait = 18; tela = ACERTO; }
        else { recordMiss(idx, BANCO[atIdx].r); tela = FEEDBACK; }
        dirty = true;
      }
    }
    if (dirty) { draw(); dirty = false; }
  }
}`,

  algoritmando: `namespace ag {
  enum Dir : uint8_t { D_U = 0, D_D = 1, D_L = 2, D_R = 3 };
  const char* DN[] = {"CIMA", "BAIXO", "ESQ", "DIR"};
  enum Tela { TITULO, JOGANDO, ACERTO, FEEDBACK, FIM };
  Tela tela = TITULO; uint8_t seq[6], certa = 0, cat = 1; int lac = 5, cur = 0, ac = 0, sc = 0, wait = 0;
  char regra[28]; bool rec = false, dirty = true;
  uint8_t op(uint8_t d) { return d == D_U ? D_D : d == D_D ? D_U : d == D_L ? D_R : D_L; }
  void seta(int cx, int cy, uint8_t d, uint16_t col) {
    if (d == D_U) { tft.fillTriangle(cx, cy-6, cx-5, cy, cx+5, cy, col); tft.fillRect(cx-2, cy, 5, 6, col); }
    else if (d == D_D) { tft.fillTriangle(cx, cy+6, cx-5, cy, cx+5, cy, col); tft.fillRect(cx-2, cy-6, 5, 6, col); }
    else if (d == D_L) { tft.fillTriangle(cx-6, cy, cx, cy-5, cx, cy+5, col); tft.fillRect(cx, cy-2, 6, 5, col); }
    else { tft.fillTriangle(cx+6, cy, cx, cy-5, cx, cy+5, col); tft.fillRect(cx-6, cy-2, 6, 5, col); }
  }
  void gerar() {
    cat = (uint8_t)random(1, 5);
    if (cat == 1) {
      uint8_t a = random(0, 4), b; do { b = random(0, 4); } while (b == a);
      for (int i = 0; i < 6; i++) seq[i] = (i % 2 == 0) ? a : b; lac = random(4, 6);
      snprintf(regra, sizeof(regra), "REPETE: %s, %s", DN[a], DN[b]);
    } else if (cat == 2) {
      uint8_t a = random(0, 4), b, c; do { b = random(0, 4); } while (b == a); do { c = random(0, 4); } while (c == a || c == b);
      uint8_t p[3] = {a, b, c}; for (int i = 0; i < 6; i++) seq[i] = p[i % 3]; lac = random(3, 6);
      snprintf(regra, sizeof(regra), "REPETE: %s,%s,%s", DN[a], DN[b], DN[c]);
    } else if (cat == 3) {
      uint8_t a = random(0, 4), b = random(0, 4), c = random(0, 4);
      seq[0]=a; seq[1]=op(a); seq[2]=b; seq[3]=op(b); seq[4]=c; seq[5]=op(c);
      int ps[3]={1,3,5}; lac = ps[random(0, 3)]; snprintf(regra, sizeof(regra), "CADA SETA + OPOSTO");
    } else {
      uint8_t a = random(0, 4), b, c; do { b = random(0, 4); } while (b == a); do { c = random(0, 4); } while (c == b);
      seq[0]=a; seq[1]=a; seq[2]=b; seq[3]=b; seq[4]=c; seq[5]=c;
      int ps[3]={1,3,5}; lac = ps[random(0, 3)]; snprintf(regra, sizeof(regra), "EM PARES: 2x CADA");
    }
    certa = seq[lac]; cur++; tela = JOGANDO; dirty = true;
  }
  void reset() { tela = TITULO; dirty = true; }
  void draw() {
    tft.fillScreen(COL_BG);
    if (tela == TITULO) {
      tft.drawRoundRect(4, 8, W - 8, 24, 5, ST7735_CYAN);
      seta(15, 20, D_R, ST7735_YELLOW); drawCentered("ALGORITMANDO", 16, 1, ST7735_WHITE); seta(W - 15, 20, D_L, ST7735_YELLOW);
      drawCentered("Sequencias Logicas", 44, 1, COL_GRAY);
      drawCentered("ACAO: jogar | Segure 2s: menu", 104, 1, ST7735_GREEN);
    } else if (tela == FIM) {
      drawRoundResult("FIM DA PARTIDA", ac, 10, sc, rec);
    } else if (tela == ACERTO) {
      drawCentered("CORRETO!", 44, 2, ST7735_GREEN); drawCentered("+10 pontos", 72, 1, ST7735_YELLOW);
    } else if (tela == FEEDBACK) {
      drawCentered("ERROU!", 8, 2, ST7735_RED); drawCentered(regra, 32, 1, ST7735_YELLOW);
      tft.setTextSize(1); tft.setTextColor(ST7735_WHITE); tft.setCursor(18, 63); tft.print("Seta certa:");
      tft.drawRoundRect(88, 54, 24, 24, 4, ST7735_GREEN); seta(100, 66, certa, ST7735_GREEN);
      tft.setTextColor(ST7735_GREEN); tft.setCursor(118, 63); tft.print(DN[certa]);
    } else {
      drawTopHud(cur, 10, sc); drawCentered("Qual seta completa?", 26, 1, ST7735_WHITE);
      int x0 = (W - (6 * 22 + 5 * 4)) / 2;
      for (int i = 0; i < 6; i++) {
        int bx = x0 + i * 26;
        if (i == lac) { tft.fillRoundRect(bx, 50, 22, 22, 3, ST7735_YELLOW); tft.setTextSize(2); tft.setTextColor(COL_BG); tft.setCursor(bx + 6, 54); tft.print("?"); }
        else { tft.drawRoundRect(bx, 50, 22, 22, 3, ST7735_CYAN); seta(bx + 11, 61, seq[i], ST7735_WHITE); }
      }
      drawCentered("Aperte a seta certa", 98, 1, ST7735_CYAN);
    }
  }
  void step(int idx, bool uPr, bool dPr, bool lPr, bool rPr, bool fPr) {
    if (tela == TITULO || tela == FIM) {
      if (fPr) { cur = 0; ac = 0; sc = 0; rec = false; resetPend(idx); gerar(); }
    } else if (tela == ACERTO || tela == FEEDBACK) {
      if (--wait <= 0 || fPr) { if (cur >= 10) { rec = finishGame(idx, sc); tela = FIM; dirty = true; } else gerar(); }
    } else {
      int esc = -1;
      if (uPr) esc = D_U; else if (dPr) esc = D_D; else if (lPr) esc = D_L; else if (rPr) esc = D_R;
      if (esc >= 0) {
        if ((uint8_t)esc == certa) { sc += 10; ac++; recordHit(idx, cat); wait = 18; tela = ACERTO; }
        else { recordMiss(idx, cat); wait = 75; tela = FEEDBACK; }
        dirty = true;
      }
    }
    if (dirty) { draw(); dirty = false; }
  }
}`,
};

export function generateMenuIno(selectedIds) {
  const chosen = AUTHORIAL_GAMES.filter((g) => selectedIds.includes(g.id));
  if (chosen.length < 2) {
    return '// Selecione pelo menos 2 jogos autorais para gerar o sketch com menu.';
  }

  const metaArray = chosen
    .map((g) => `  {"${g.id}", "${g.nome}", "${g.tag}"}`)
    .join(',\n');

  const modules = chosen.map((g) => CPP_MODULES[g.id]).join('\n\n');
  const resetCases = chosen.map((g, i) => `    case ${i}: ${g.ns}::reset(); break;`).join('\n');
  const stepCases = chosen.map((g, i) => `    case ${i}: ${g.ns}::step(${i}, uPr, dPr, lPr, rPr, fShort); break;`).join('\n');

  return `/*
  ESPlay Multi-Jogos (${chosen.map((g) => g.nome).join(' + ')})
  ----------------------------------------------------------------
  Menu colorido opcional com ${chosen.length} jogos autorais no mesmo ESP32.
  Segure ACAO por 2 segundos durante qualquer jogo para voltar ao menu.

  Placa: ESP32 DevKit V1 (30 pinos)
  Display: TFT 1.8" 128x160 ST7735S (SPI, paisagem 160x128)
    SCL->18 | SDA->23 | RST->4 | DC->2 | CS->5 | BLK->3V3
  Botoes (INPUT_PULLUP para GND):
    CIMA->32 | BAIXO->33 | ESQUERDA->26 | DIREITA->27 | ACAO->25

  Bibliotecas: Adafruit GFX Library + Adafruit ST7735 and ST7789 Library
*/

#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>
#include <Preferences.h>

const bool PEDIR_ALUNO = true;

#define UP_BUTTON    32
#define DOWN_BUTTON  33
#define LEFT_BUTTON  26
#define RIGHT_BUTTON 27
#define FIRE_BUTTON  25

#define TFT_CS   5
#define TFT_DC   2
#define TFT_RST  4

Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_RST);
const int W = 160, H = 128;

#define COL_BG     ST7735_BLACK
#define COL_GRAY   0x7BEF
#define COL_DKGRAY 0x39E7

struct GameMeta { const char* id; const char* nome; const char* tag; };
const GameMeta GAMES[] = {
${metaArray}
};
const int NUM_GAMES = sizeof(GAMES) / sizeof(GAMES[0]);

struct ESPlayStats {
  uint32_t magic; int32_t best; uint32_t plays, hits, misses;
  int32_t last[10]; uint8_t lastCount; uint16_t tagHits[16], tagMisses[16];
};
ESPlayStats gameStats[NUM_GAMES];
uint32_t pendH[NUM_GAMES], pendM[NUM_GAMES];
uint16_t pendTH[NUM_GAMES][16], pendTM[NUM_GAMES][16];
uint16_t studentId = 0;
char serialBuf[24]; uint8_t serialLen = 0; bool idSaved = false;

int activeGame = -1; // -1 = menu
int menuItem = 0;
bool menuDirty = true, menuArmed = false;
unsigned long tickTimer = 0;

void drawCentered(const char* s, int y, uint8_t size, uint16_t color) {
  int16_t x1, y1; uint16_t w, h;
  tft.setTextSize(size); tft.getTextBounds(s, 0, 0, &x1, &y1, &w, &h);
  tft.setCursor((W - (int)w) / 2, y); tft.setTextColor(color); tft.print(s);
}

void drawTopHud(int cur, int total, int sc) {
  char t[16], p[12]; snprintf(t, sizeof(t), "%d/%d", cur, total); snprintf(p, sizeof(p), "Pts:%d", sc);
  tft.setTextSize(1);
  tft.setTextColor(ST7735_WHITE); tft.setCursor(4, 4); tft.print(t);
  tft.setTextColor(ST7735_YELLOW); tft.setCursor(W - (int)strlen(p) * 6 - 4, 4); tft.print(p);
  tft.drawFastHLine(0, 15, W, COL_DKGRAY);
}

void drawOptBtn(int y, int h, const char* txt, bool sel) {
  if (sel) {
    tft.fillRoundRect(6, y, W - 12, h, 4, ST7735_BLUE);
    tft.drawRoundRect(6, y, W - 12, h, 4, ST7735_CYAN);
    tft.setTextColor(ST7735_WHITE);
  } else {
    tft.drawRoundRect(6, y, W - 12, h, 4, COL_DKGRAY);
    tft.setTextColor(COL_GRAY);
  }
  tft.setTextSize(1); tft.setCursor(14, y + (h - 8) / 2); tft.print(txt);
}

void drawRoundResult(const char* title, int ac, int tot, int sc, bool rec) {
  drawCentered(title, 10, 1, ST7735_CYAN); tft.drawFastHLine(0, 22, W, COL_DKGRAY);
  char b[24]; snprintf(b, sizeof(b), "Acertos: %d/%d", ac, tot); drawCentered(b, 34, 1, ST7735_WHITE);
  snprintf(b, sizeof(b), "Pts: %d", sc); drawCentered(b, 52, 2, ST7735_YELLOW);
  drawCentered(rec ? "NOVO RECORDE!" : "ACAO: de novo", 78, 1, rec ? ST7735_GREEN : ST7735_WHITE);
  drawCentered("Segure ACAO 2s: menu", 108, 1, COL_GRAY);
}

void textoQuebrado(int x, int y, int maxLarg, int altLinha, const char* s, uint16_t color) {
  int maxChars = maxLarg / 6; if (maxChars < 4) maxChars = 4;
  int len = strlen(s), pos = 0, cy = y; tft.setTextSize(1); tft.setTextColor(color);
  while (pos < len) {
    while (pos < len && s[pos] == ' ') pos++; if (pos >= len) break;
    int fim = pos + maxChars;
    if (fim >= len) fim = len; else { int k = fim; while (k > pos && s[k] != ' ') k--; if (k > pos) fim = k; }
    char l[32]; int n = fim - pos; if (n >= (int)sizeof(l)) n = sizeof(l) - 1;
    memcpy(l, s + pos, n); l[n] = 0; tft.setCursor(x, cy); tft.print(l);
    cy += altLinha; pos = fim;
  }
}

void saveStudentId(uint16_t id) {
  studentId = id; idSaved = true;
  Preferences idp; idp.begin("esplay", false); idp.putUShort("sid", id); idp.end();
}

void loadAllStats() {
  for (int i = 0; i < NUM_GAMES; i++) {
    Preferences p; p.begin(GAMES[i].id, false);
    size_t n = p.getBytes("stats", &gameStats[i], sizeof(ESPlayStats));
    if (n != sizeof(ESPlayStats) || gameStats[i].magic != 0xE5A10001) {
      memset(&gameStats[i], 0, sizeof(ESPlayStats)); gameStats[i].magic = 0xE5A10001;
    }
    p.end();
  }
}

void saveOneStats(int i) {
  Preferences p; p.begin(GAMES[i].id, false);
  p.putBytes("stats", &gameStats[i], sizeof(ESPlayStats));
  p.end();
}

void resetPend(int i) { pendH[i] = pendM[i] = 0; memset(pendTH[i], 0, sizeof(pendTH[i])); memset(pendTM[i], 0, sizeof(pendTM[i])); }
void recordHit(int i, uint8_t tag) { pendH[i]++; if (tag < 16) pendTH[i][tag]++; }
void recordMiss(int i, uint8_t tag) { pendM[i]++; if (tag < 16) pendTM[i][tag]++; }

bool finishGame(int i, int sc) {
  ESPlayStats& st = gameStats[i];
  bool rec = sc > st.best; if (rec) st.best = sc;
  st.plays++; st.hits += pendH[i]; st.misses += pendM[i];
  for (int t = 0; t < 16; t++) { st.tagHits[t] += pendTH[i][t]; st.tagMisses[t] += pendTM[i][t]; }
  if (st.lastCount < 10) st.last[st.lastCount++] = sc;
  else { memmove(st.last, st.last + 1, sizeof(int32_t) * 9); st.last[9] = sc; }
  saveOneStats(i); resetPend(i); return rec;
}

void sendAllJson() {
  for (int i = 0; i < NUM_GAMES; i++) {
    const ESPlayStats& st = gameStats[i];
    Serial.print(F("{\\"esplay\\":1,\\"student\\":")); Serial.print(studentId);
    Serial.print(F(",\\"game\\":\\"")); Serial.print(GAMES[i].id);
    Serial.print(F("\\",\\"name\\":\\"")); Serial.print(GAMES[i].nome);
    Serial.print(F("\\",\\"tag\\":\\"")); Serial.print(GAMES[i].tag);
    Serial.print(F("\\",\\"best\\":")); Serial.print(st.best);
    Serial.print(F(",\\"plays\\":")); Serial.print(st.plays);
    Serial.print(F(",\\"hits\\":")); Serial.print(st.hits);
    Serial.print(F(",\\"misses\\":")); Serial.print(st.misses);
    Serial.print(F(",\\"last\\":["));
    for (int k = 0; k < st.lastCount; k++) { if (k) Serial.print(','); Serial.print(st.last[k]); }
    Serial.print(F("],\\"tagHits\\":["));
    for (int k = 0; k < 16; k++) { if (k) Serial.print(','); Serial.print(st.tagHits[k]); }
    Serial.print(F("],\\"tagMisses\\":["));
    for (int k = 0; k < 16; k++) { if (k) Serial.print(','); Serial.print(st.tagMisses[k]); }
    Serial.println(F("]}"));
  }
  Serial.println(F("ESPLAY_END"));
}

void handleSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\\n' || c == '\\r') {
      if (serialLen > 0) {
        serialBuf[serialLen] = 0; serialLen = 0;
        String cmd(serialBuf); cmd.trim(); cmd.toUpperCase();
        if (cmd == "ESPLAY?" || cmd == "DUMP") sendAllJson();
        else if (cmd.startsWith("ID ")) {
          int n = cmd.substring(3).toInt();
          if (n >= 1 && n <= 999) { saveStudentId((uint16_t)n); Serial.println(F("OK")); } else Serial.println(F("ERRO"));
        } else if (cmd == "RESET") {
          for (int i = 0; i < NUM_GAMES; i++) { memset(&gameStats[i], 0, sizeof(ESPlayStats)); gameStats[i].magic = 0xE5A10001; saveOneStats(i); }
          Serial.println(F("OK"));
        }
      }
    } else if (serialLen < sizeof(serialBuf) - 1) serialBuf[serialLen++] = c;
  }
}

void promptStudentId() {
  int n = studentId ? studentId : 1; bool prev[5] = {true,true,true,true,true};
  int pins[5] = {UP_BUTTON, DOWN_BUTTON, LEFT_BUTTON, RIGHT_BUTTON, FIRE_BUTTON};
  idSaved = false; bool dirty = true;
  while (!idSaved) {
    handleSerial();
    bool now[5]; for (int i = 0; i < 5; i++) now[i] = (digitalRead(pins[i]) == LOW);
    if (now[0] && !prev[0]) { n++; dirty = true; } if (now[1] && !prev[1]) { n--; dirty = true; }
    if (now[3] && !prev[3]) { n += 10; dirty = true; } if (now[2] && !prev[2]) { n -= 10; dirty = true; }
    if (n < 1) n = 1; if (n > 999) n = 999; bool ok = now[4] && !prev[4];
    for (int i = 0; i < 5; i++) prev[i] = now[i];
    if (dirty) {
      tft.fillScreen(COL_BG); drawCentered("SEU NUMERO", 12, 2, ST7735_CYAN);
      char b[8]; snprintf(b, sizeof(b), "%d", n); drawCentered(b, 46, 3, ST7735_YELLOW);
      drawCentered("CIMA/BAIXO: +-1  LADOS: +-10", 96, 1, COL_GRAY);
      drawCentered("ACAO: confirmar", 110, 1, ST7735_GREEN); dirty = false;
    }
    if (ok) { saveStudentId((uint16_t)n); tft.fillScreen(COL_BG); drawCentered("SALVO!", 52, 2, ST7735_GREEN); delay(600); }
    delay(20);
  }
}

${modules}

void drawMenu() {
  tft.fillScreen(COL_BG);
  drawCentered("ESPLAY", 7, 2, ST7735_RED);
  drawCentered("ESPLAY", 5, 2, ST7735_YELLOW);
  int h = (NUM_GAMES >= 5) ? 16 : 19;
  int step = (NUM_GAMES >= 5) ? 18 : 22;
  for (int i = 0; i < NUM_GAMES; i++) {
    int y = 24 + i * step;
    if (i == menuItem) {
      tft.fillRoundRect(10, y, 140, h, 4, ST7735_BLUE);
      tft.drawRoundRect(10, y, 140, h, 4, ST7735_CYAN);
      drawCentered(GAMES[i].nome, y + (h - 8) / 2, 1, ST7735_WHITE);
      tft.fillTriangle(17, y + 4, 17, y + h - 4, 24, y + h / 2, ST7735_YELLOW);
    } else {
      tft.drawRoundRect(10, y, 140, h, 4, COL_DKGRAY);
      drawCentered(GAMES[i].nome, y + (h - 8) / 2, 1, COL_GRAY);
    }
  }
  char b[28]; snprintf(b, sizeof(b), "Rec %s: %ld", GAMES[menuItem].nome, (long)gameStats[menuItem].best);
  drawCentered(b, 114, 1, ST7735_YELLOW);
}

void goToMenu() { activeGame = -1; menuDirty = true; menuArmed = false; }

void setup() {
  Serial.begin(115200);
  pinMode(UP_BUTTON, INPUT_PULLUP); pinMode(DOWN_BUTTON, INPUT_PULLUP);
  pinMode(LEFT_BUTTON, INPUT_PULLUP); pinMode(RIGHT_BUTTON, INPUT_PULLUP);
  pinMode(FIRE_BUTTON, INPUT_PULLUP);
  tft.initR(INITR_GREENTAB); tft.setRotation(1); tft.setTextWrap(false); tft.fillScreen(COL_BG);
  loadAllStats();
  Preferences idp; idp.begin("esplay", false); studentId = idp.getUShort("sid", 0); idp.end();
  bool forceId = (digitalRead(LEFT_BUTTON) == LOW) && (digitalRead(RIGHT_BUTTON) == LOW);
  if (PEDIR_ALUNO && (studentId == 0 || forceId)) promptStudentId();
  randomSeed(esp_random());
  goToMenu();
  tickTimer = millis();
}

void loop() {
  handleSerial();

  if (activeGame < 0) {
    static bool uLock = false, dLock = false;
    if (menuDirty) { drawMenu(); menuDirty = false; }
    if (!menuArmed && digitalRead(FIRE_BUTTON) == HIGH) menuArmed = true;
    if (digitalRead(UP_BUTTON) == LOW && !uLock) { menuItem = (menuItem + NUM_GAMES - 1) % NUM_GAMES; menuDirty = true; uLock = true; }
    if (digitalRead(UP_BUTTON) == HIGH) uLock = false;
    if (digitalRead(DOWN_BUTTON) == LOW && !dLock) { menuItem = (menuItem + 1) % NUM_GAMES; menuDirty = true; dLock = true; }
    if (digitalRead(DOWN_BUTTON) == HIGH) dLock = false;
    if (menuArmed && digitalRead(FIRE_BUTTON) == LOW) {
      delay(150); activeGame = menuItem;
      switch (activeGame) {
${resetCases}
      }
    }
    return;
  }

  static bool prevU = false, prevD = false, prevL = false, prevR = false, prevF = false, fArmed = false;
  static unsigned long fStart = 0;
  bool fNow = (digitalRead(FIRE_BUTTON) == LOW);
  if (!fNow) { fArmed = true; fStart = 0; }
  else if (fArmed) {
    if (fStart == 0) fStart = millis();
    else if (millis() - fStart > 2000) { fStart = 0; fArmed = false; prevF = false; goToMenu(); return; }
  }

  unsigned long now = millis();
  if (now - tickTimer < 33) return;
  tickTimer = now;

  bool uNow = (digitalRead(UP_BUTTON) == LOW), dNow = (digitalRead(DOWN_BUTTON) == LOW);
  bool lNow = (digitalRead(LEFT_BUTTON) == LOW), rNow = (digitalRead(RIGHT_BUTTON) == LOW);
  bool uPr = uNow && !prevU, dPr = dNow && !prevD, lPr = lNow && !prevL, rPr = rNow && !prevR;
  bool fValid = fNow && fArmed;
  bool fShort = (!fValid && prevF);
  prevU = uNow; prevD = dNow; prevL = lNow; prevR = rNow; prevF = fValid;

  switch (activeGame) {
${stepCases}
  }
}
`;
}

export function initMenu({ makeConsole, addRunner, onSend }) {
  const host = $('#menu-console');
  if (!host) return null;

  const con = makeConsole(host, 'Tela colorida 160x128 do console no modo menu');
  const menuGame = new MenuGame(con.scr, []);
  const runner = addRunner(con, menuGame, null);

  function selectedIds() {
    return $$('[data-menu-game]')
      .filter((el) => el.checked)
      .map((el) => el.getAttribute('data-menu-game'));
  }

  function refresh() {
    const ids = selectedIds();
    const items = ids
      .map((id) => AUTHORIAL_GAMES.find((g) => g.id === id))
      .filter(Boolean)
      .map((g) => ({
        id: g.id,
        nome: g.nome,
        tag: g.tag,
        Cls: GAMES_BY_PREVIEW[g.id],
        cfg: g.id === 'pixelmath' ? { v0: 0.8 } : { total: 10 },
      }));

    menuGame.setItems(items);
    menuGame.draw();
    $('#menu-code').textContent = generateMenuIno(ids);
    $('#menu-count').textContent = `${ids.length} de 5 jogos no menu`;
  }

  $$('[data-menu-game]').forEach((cb) => {
    cb.addEventListener('change', () => {
      if (selectedIds().length < 2) {
        cb.checked = true;
        $('#menu-status').textContent = 'O modo menu precisa de pelo menos 2 jogos selecionados (para 1 jogo só, use a biblioteca unitária acima).';
        return;
      }
      $('#menu-status').textContent = '';
      refresh();
    });
  });

  $('#menu-back').addEventListener('click', () => {
    menuGame.backToMenu();
    $('#menu-status').textContent = 'Voltou ao menu principal da prévia.';
  });

  $('#menu-copy-code').addEventListener('click', function () {
    const btn = this;
    const fail = () => { selectNode($('#menu-code')); flash(btn, 'Selecionado: Ctrl+C'); };
    copyText($('#menu-code').textContent, () => flash(btn, 'Copiado'), fail);
  });

  $('#menu-dl-code').addEventListener('click', () => {
    download('ESPlayMenu.ino', $('#menu-code').textContent, 'text/plain;charset=utf-8');
  });

  $('#menu-send-panel').addEventListener('click', () => {
    const played = menuGame.items.filter((it) => it.game.stats.plays > 0);
    const out = $('#menu-send-status');
    if (!played.length) {
      out.textContent = 'Entre em um jogo do menu e jogue uma partida até o fim primeiro.';
      return;
    }
    let novos = 0, iguais = 0;
    played.forEach((it) => {
      const s = it.game.stats;
      const res = onSend({
        esplay: 1, student: it.game.sid, game: it.id, name: it.nome, tag: it.tag,
        best: s.best, plays: s.plays, hits: s.hits, misses: s.misses,
        last: s.last.slice(), tagHits: s.tagHits.slice(), tagMisses: s.tagMisses.slice(),
      });
      if (res === 'novo') novos++;
      else if (res === 'igual') iguais++;
    });
    out.textContent = novos > 0
      ? `${novos} ${novos === 1 ? 'jogo enviado' : 'jogos enviados'} para o painel (aluno 7).`
      : 'Sem partidas novas desde o último envio.';
  });

  refresh();
  return { console: con, runner };
}
