/*
  RegioMap — jogo educativo de estados e capitais do Brasil para o ESPlay
  ----------------------------------------------------------------------
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

// ====== AJUSTES PARA O PROFESSOR ======
const int  REGIAO_FIXA   = 0;    // 0 = todas; 1=Norte; 2=Nordeste; 3=Centro-Oeste; 4=Sudeste; 5=Sul
const int  QTD_PERGUNTAS = 10;   // perguntas por partida (ex.: 5, 10, 15, 27)
const bool PEDIR_ALUNO   = true; // pede numero do aluno no primeiro uso
// ======================================

#define UP_BUTTON    32
#define DOWN_BUTTON  33
#define LEFT_BUTTON  26
#define RIGHT_BUTTON 27
#define FIRE_BUTTON  25

#define TFT_CS   5
#define TFT_DC   2
#define TFT_RST  4

Adafruit_ST7735 tft = Adafruit_ST7735(TFT_CS, TFT_DC, TFT_RST);

const int W = 160;
const int H = 128;

#define COL_BG     ST7735_BLACK
#define COL_GRAY   0x7BEF
#define COL_DKGRAY 0x39E7

// ---------- Estatisticas e serial (painel do professor) ----------
const char* GAME_ID   = "regiomap";
const char* GAME_NAME = "RegioMap";
const char* TAG_NAME  = "regiao";

struct ESPlayStats {
  uint32_t magic; int32_t best; uint32_t plays, hits, misses;
  int32_t last[10]; uint8_t lastCount; uint16_t tagHits[16], tagMisses[16];
};
Preferences prefs;
ESPlayStats stats;
uint16_t studentId = 0;
uint32_t pendHits = 0, pendMisses = 0;
uint16_t pendTH[16], pendTM[16];
char serialBuf[24]; uint8_t serialLen = 0; bool idSaved = false;

void drawCentered(const char* s, int y, uint8_t size, uint16_t color) {
  int16_t x1, y1; uint16_t w, h;
  tft.setTextSize(size);
  tft.getTextBounds(s, 0, 0, &x1, &y1, &w, &h);
  tft.setCursor((W - (int)w) / 2, y);
  tft.setTextColor(color);
  tft.print(s);
}

void saveStudentId(uint16_t id) {
  studentId = id; idSaved = true;
  Preferences idp; idp.begin("esplay", false); idp.putUShort("sid", id); idp.end();
}
void loadStats() {
  prefs.begin(GAME_ID, false);
  size_t n = prefs.getBytes("stats", &stats, sizeof(stats));
  if (n != sizeof(stats) || stats.magic != 0xE5A10001) { memset(&stats, 0, sizeof(stats)); stats.magic = 0xE5A10001; }
}
void saveStats() { prefs.putBytes("stats", &stats, sizeof(stats)); }

void sendJson() {
  Serial.print(F("{\"esplay\":1,\"student\":")); Serial.print(studentId);
  Serial.print(F(",\"game\":\"")); Serial.print(GAME_ID);
  Serial.print(F("\",\"name\":\"")); Serial.print(GAME_NAME);
  Serial.print(F("\",\"tag\":\"")); Serial.print(TAG_NAME);
  Serial.print(F("\",\"best\":")); Serial.print(stats.best);
  Serial.print(F(",\"plays\":")); Serial.print(stats.plays);
  Serial.print(F(",\"hits\":")); Serial.print(stats.hits);
  Serial.print(F(",\"misses\":")); Serial.print(stats.misses);
  Serial.print(F(",\"last\":["));
  for (int i = 0; i < stats.lastCount; i++) { if (i) Serial.print(','); Serial.print(stats.last[i]); }
  Serial.print(F("],\"tagHits\":["));
  for (int i = 0; i < 16; i++) { if (i) Serial.print(','); Serial.print(stats.tagHits[i]); }
  Serial.print(F("],\"tagMisses\":["));
  for (int i = 0; i < 16; i++) { if (i) Serial.print(','); Serial.print(stats.tagMisses[i]); }
  Serial.println(F("]}"));
}

void handleSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (serialLen > 0) {
        serialBuf[serialLen] = 0; serialLen = 0;
        String cmd(serialBuf); cmd.trim(); cmd.toUpperCase();
        if (cmd == "ESPLAY?" || cmd == "DUMP") sendJson();
        else if (cmd.startsWith("ID ")) {
          int n = cmd.substring(3).toInt();
          if (n >= 1 && n <= 999) { saveStudentId((uint16_t)n); Serial.println(F("OK")); }
          else Serial.println(F("ERRO"));
        } else if (cmd == "RESET") {
          memset(&stats, 0, sizeof(stats)); stats.magic = 0xE5A10001; saveStats(); Serial.println(F("OK"));
        }
      }
    } else if (serialLen < sizeof(serialBuf) - 1) serialBuf[serialLen++] = c;
  }
}

void recordHit(uint8_t tag) { pendHits++; if (tag < 16) pendTH[tag]++; }
void recordMiss(uint8_t tag) { pendMisses++; if (tag < 16) pendTM[tag]++; }
void resetPend() { pendHits = pendMisses = 0; memset(pendTH, 0, sizeof(pendTH)); memset(pendTM, 0, sizeof(pendTM)); }

bool finishGame(int sc) {
  bool rec = sc > stats.best; if (rec) stats.best = sc;
  stats.plays++; stats.hits += pendHits; stats.misses += pendMisses;
  for (int i = 0; i < 16; i++) { stats.tagHits[i] += pendTH[i]; stats.tagMisses[i] += pendTM[i]; }
  if (stats.lastCount < 10) stats.last[stats.lastCount++] = sc;
  else { memmove(stats.last, stats.last + 1, sizeof(int32_t) * 9); stats.last[9] = sc; }
  saveStats(); resetPend();
  return rec;
}

void promptStudentId() {
  int n = studentId ? studentId : 1;
  bool prev[5] = {true, true, true, true, true};
  int pins[5] = {UP_BUTTON, DOWN_BUTTON, LEFT_BUTTON, RIGHT_BUTTON, FIRE_BUTTON};
  idSaved = false; bool dirty = true;
  while (!idSaved) {
    handleSerial();
    bool now[5]; for (int i = 0; i < 5; i++) now[i] = (digitalRead(pins[i]) == LOW);
    if (now[0] && !prev[0]) { n++; dirty = true; }
    if (now[1] && !prev[1]) { n--; dirty = true; }
    if (now[3] && !prev[3]) { n += 10; dirty = true; }
    if (now[2] && !prev[2]) { n -= 10; dirty = true; }
    if (n < 1) n = 1; if (n > 999) n = 999;
    bool ok = now[4] && !prev[4];
    for (int i = 0; i < 5; i++) prev[i] = now[i];
    if (dirty) {
      tft.fillScreen(COL_BG);
      drawCentered("SEU NUMERO", 12, 2, ST7735_CYAN);
      char buf[8]; snprintf(buf, sizeof(buf), "%d", n);
      drawCentered(buf, 46, 3, ST7735_YELLOW);
      drawCentered("CIMA/BAIXO: +-1  LADOS: +-10", 96, 1, COL_GRAY);
      drawCentered("ACAO: confirmar", 110, 1, ST7735_GREEN);
      dirty = false;
    }
    if (ok) { saveStudentId((uint16_t)n); tft.fillScreen(COL_BG); drawCentered("SALVO!", 52, 2, ST7735_GREEN); delay(600); }
    delay(20);
  }
}

// ---------- Banco e logica do RegioMap ----------
struct UnidadeFed { const char* estado; const char* capital; uint8_t regiao; };

const char* NOMES_REGIOES[] = {"", "Norte", "Nordeste", "Centro-Oeste", "Sudeste", "Sul"};

const UnidadeFed BANCO[] = {
  {"ACRE",                "RIO BRANCO",     1},
  {"AMAPA",               "MACAPA",         1},
  {"AMAZONAS",            "MANAUS",         1},
  {"PARA",                "BELEM",          1},
  {"RONDONIA",            "PORTO VELHO",    1},
  {"RORAIMA",             "BOA VISTA",      1},
  {"TOCANTINS",           "PALMAS",         1},
  {"ALAGOAS",             "MACEIO",         2},
  {"BAHIA",               "SALVADOR",       2},
  {"CEARA",               "FORTALEZA",      2},
  {"MARANHAO",            "SAO LUIS",       2},
  {"PARAIBA",             "JOAO PESSOA",    2},
  {"PERNAMBUCO",          "RECIFE",         2},
  {"PIAUI",               "TERESINA",       2},
  {"RIO GRANDE DO NORTE", "NATAL",          2},
  {"SERGIPE",             "ARACAJU",        2},
  {"DISTRITO FEDERAL",    "BRASILIA",       3},
  {"GOIAS",               "GOIANIA",        3},
  {"MATO GROSSO",         "CUIABA",         3},
  {"MATO GROSSO DO SUL",  "CAMPO GRANDE",   3},
  {"ESPIRITO SANTO",      "VITORIA",        4},
  {"MINAS GERAIS",        "BELO HORIZONTE", 4},
  {"RIO DE JANEIRO",      "RIO DE JANEIRO", 4},
  {"SAO PAULO",           "SAO PAULO",      4},
  {"PARANA",              "CURITIBA",       5},
  {"RIO GRANDE DO SUL",   "PORTO ALEGRE",   5},
  {"SANTA CATARINA",      "FLORIANOPOLIS",  5}
};
const int NUM_UFS = sizeof(BANCO) / sizeof(BANCO[0]);

enum Tela { TITULO, JOGANDO, ACERTO, FEEDBACK, FIM };
Tela tela = TITULO;

int pool[NUM_UFS], poolTam = 0, poolPos = 0, ultimoIdx = -1;
int opcoesIdx[3];
int selecao = 0, perguntaAtual = 0, totalPerguntas = 10, acertos = 0, score = 0;
bool novoRecorde = false, needsRedraw = true;
int esperaFrames = 0, atualIdx = 0;
unsigned long tickTimer = 0;

void embaralharPool() {
  poolTam = 0;
  for (int i = 0; i < NUM_UFS; i++) if (REGIAO_FIXA < 1 || REGIAO_FIXA > 5 || BANCO[i].regiao == REGIAO_FIXA) pool[poolTam++] = i;
  if (poolTam == 0) for (int i = 0; i < NUM_UFS; i++) pool[poolTam++] = i;
  for (int i = poolTam - 1; i > 0; i--) { int j = random(0, i + 1); int tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp; }
  if (poolTam > 1 && pool[0] == ultimoIdx) { int tmp = pool[0]; pool[0] = pool[poolTam - 1]; pool[poolTam - 1] = tmp; }
  poolPos = 0;
}

void montarOpcoes(int corretaIdx) {
  int w1, w2;
  do { w1 = random(0, NUM_UFS); } while (w1 == corretaIdx);
  do { w2 = random(0, NUM_UFS); } while (w2 == corretaIdx || w2 == w1);
  opcoesIdx[0] = corretaIdx; opcoesIdx[1] = w1; opcoesIdx[2] = w2;
  for (int i = 2; i > 0; i--) { int j = random(0, i + 1); int tmp = opcoesIdx[i]; opcoesIdx[i] = opcoesIdx[j]; opcoesIdx[j] = tmp; }
}

void proximaPergunta() {
  if (poolPos >= poolTam) embaralharPool();
  atualIdx = pool[poolPos++]; ultimoIdx = atualIdx;
  montarOpcoes(atualIdx);
  selecao = 0; perguntaAtual++; tela = JOGANDO; needsRedraw = true;
}

void novoJogo() {
  totalPerguntas = (QTD_PERGUNTAS > 0) ? QTD_PERGUNTAS : 10;
  perguntaAtual = 0; acertos = 0; score = 0; ultimoIdx = -1; novoRecorde = false;
  resetPend(); embaralharPool(); proximaPergunta();
}

void avancarOuFim() {
  if (perguntaAtual >= totalPerguntas) { novoRecorde = finishGame(score); tela = FIM; needsRedraw = true; }
  else proximaPergunta();
}

void desenhar() {
  tft.fillScreen(COL_BG);

  if (tela == TITULO) {
    drawCentered("REGIOMAP", 12, 2, ST7735_CYAN);
    drawCentered("Estados e capitais", 36, 1, COL_GRAY);
    char buf[24];
    snprintf(buf, sizeof(buf), "Aluno: %d", studentId); drawCentered(buf, 58, 1, ST7735_WHITE);
    snprintf(buf, sizeof(buf), "Recorde: %ld", (long)stats.best); drawCentered(buf, 74, 1, ST7735_YELLOW);
    drawCentered("Aperte ACAO", 104, 1, ST7735_GREEN);
    return;
  }

  if (tela == FIM) {
    drawCentered("FIM DA RODADA", 10, 1, ST7735_CYAN);
    tft.drawFastHLine(0, 22, W, COL_DKGRAY);
    char buf[24];
    snprintf(buf, sizeof(buf), "Acertos: %d/%d", acertos, totalPerguntas); drawCentered(buf, 34, 1, ST7735_WHITE);
    snprintf(buf, sizeof(buf), "Pts: %d", score); drawCentered(buf, 52, 2, ST7735_YELLOW);
    if (novoRecorde) drawCentered("NOVO RECORDE!", 76, 1, ST7735_GREEN);
    else { snprintf(buf, sizeof(buf), "Recorde: %ld", (long)stats.best); drawCentered(buf, 76, 1, ST7735_WHITE); }
    drawCentered("ACAO: jogar de novo", 106, 1, ST7735_GREEN);
    return;
  }

  if (tela == ACERTO) {
    drawCentered("CORRETO!", 44, 2, ST7735_GREEN);
    drawCentered("+10 pontos", 72, 1, ST7735_YELLOW);
    return;
  }

  const UnidadeFed& uf = BANCO[atualIdx];

  if (tela == FEEDBACK) {
    drawCentered("RESPOSTA CERTA:", 10, 1, ST7735_RED);
    drawCentered(uf.estado, 32, 1, ST7735_WHITE);
    drawCentered(uf.capital, 52, ((int)strlen(uf.capital) * 12 <= W - 12) ? 2 : 1, ST7735_GREEN);
    char reg[24]; snprintf(reg, sizeof(reg), "Regiao: %s", NOMES_REGIOES[uf.regiao]);
    drawCentered(reg, 80, 1, ST7735_YELLOW);
    drawCentered("ACAO: continuar", 108, 1, COL_GRAY);
    return;
  }

  char topo[16], pts[12];
  snprintf(topo, sizeof(topo), "%d/%d", perguntaAtual, totalPerguntas);
  snprintf(pts, sizeof(pts), "Pts:%d", score);
  tft.setTextSize(1);
  tft.setTextColor(ST7735_WHITE); tft.setCursor(4, 4); tft.print(topo);
  tft.setTextColor(ST7735_YELLOW); tft.setCursor(W - (int)strlen(pts) * 6 - 4, 4); tft.print(pts);
  tft.drawFastHLine(0, 15, W, COL_DKGRAY);

  drawCentered(uf.estado, 28, 1, ST7735_YELLOW);

  for (int i = 0; i < 3; i++) {
    int oy = 52 + i * 23;
    char lin[24]; snprintf(lin, sizeof(lin), "%d. %s", i + 1, BANCO[opcoesIdx[i]].capital);
    if (i == selecao) {
      tft.fillRoundRect(6, oy, W - 12, 19, 4, ST7735_BLUE);
      tft.drawRoundRect(6, oy, W - 12, 19, 4, ST7735_CYAN);
      tft.setTextSize(1); tft.setTextColor(ST7735_WHITE);
      tft.setCursor(14, oy + 6); tft.print(lin);
    } else {
      tft.drawRoundRect(6, oy, W - 12, 19, 4, COL_DKGRAY);
      tft.setTextSize(1); tft.setTextColor(COL_GRAY);
      tft.setCursor(14, oy + 6); tft.print(lin);
    }
  }
}

void setup() {
  Serial.begin(115200);
  pinMode(UP_BUTTON, INPUT_PULLUP); pinMode(DOWN_BUTTON, INPUT_PULLUP);
  pinMode(LEFT_BUTTON, INPUT_PULLUP); pinMode(RIGHT_BUTTON, INPUT_PULLUP);
  pinMode(FIRE_BUTTON, INPUT_PULLUP);

  tft.initR(INITR_GREENTAB); tft.setRotation(1); tft.setTextWrap(false); tft.fillScreen(COL_BG);
  loadStats();
  Preferences idp; idp.begin("esplay", false); studentId = idp.getUShort("sid", 0); idp.end();
  bool forceId = (digitalRead(LEFT_BUTTON) == LOW) && (digitalRead(RIGHT_BUTTON) == LOW);
  if (PEDIR_ALUNO && (studentId == 0 || forceId)) promptStudentId();
  randomSeed(esp_random());
  needsRedraw = true; tickTimer = millis();
}

void loop() {
  handleSerial();
  unsigned long now = millis();
  if (now - tickTimer < 33) return;
  tickTimer = now;

  static bool prevU = false, prevD = false, prevF = false;
  bool uNow = (digitalRead(UP_BUTTON) == LOW), dNow = (digitalRead(DOWN_BUTTON) == LOW), fNow = (digitalRead(FIRE_BUTTON) == LOW);
  bool uPr = uNow && !prevU, dPr = dNow && !prevD, fPr = fNow && !prevF;
  prevU = uNow; prevD = dNow; prevF = fNow;

  if (tela == TITULO || tela == FIM) {
    if (fPr) novoJogo();
  } else if (tela == ACERTO) {
    esperaFrames--;
    if (esperaFrames <= 0 || fPr) avancarOuFim();
  } else if (tela == FEEDBACK) {
    if (fPr) avancarOuFim();
  } else if (tela == JOGANDO) {
    if (uPr) { selecao = (selecao + 2) % 3; needsRedraw = true; }
    if (dPr) { selecao = (selecao + 1) % 3; needsRedraw = true; }
    if (fPr) {
      const UnidadeFed& uf = BANCO[atualIdx];
      if (opcoesIdx[selecao] == atualIdx) {
        score += 10; acertos++; recordHit(uf.regiao); esperaFrames = 18; tela = ACERTO;
      } else {
        recordMiss(uf.regiao); tela = FEEDBACK;
      }
      needsRedraw = true;
    }
  }

  if (needsRedraw) { desenhar(); needsRedraw = false; }
}
