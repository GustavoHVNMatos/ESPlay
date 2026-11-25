/*
  Algoritmando — jogo educativo de sequencias logicas para o ESPlay
  -----------------------------------------------------------------
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
const int  COMPLEXIDADE = 0;    // 0 = todos; 1 = 2 comandos; 2 = 2 e 3 comandos; 3 = opostos e pares
const int  TEMPO_RODADA = 0;    // segundos por rodada (0 = sem limite)
const int  QTD_RODADAS  = 10;   // rodadas por partida
const bool PEDIR_ALUNO  = true; // pede numero do aluno no primeiro uso
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
const char* GAME_ID   = "algoritmando";
const char* GAME_NAME = "Algoritmando";
const char* TAG_NAME  = "padrao";

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

// ---------- Logica do Algoritmando ----------
enum Dir : uint8_t { DIR_CIMA = 0, DIR_BAIXO = 1, DIR_ESQ = 2, DIR_DIR = 3 };
const char* NOMES_DIR[] = {"CIMA", "BAIXO", "ESQ", "DIR"};

enum Tela { TITULO, JOGANDO, ACERTO, FEEDBACK, FIM };
Tela tela = TITULO;

uint8_t seq[6];
int lacuna = 5;
uint8_t respostaCerta = DIR_CIMA;
uint8_t catAtual = 1;
char regraAtual[28];

int rodadaAtual = 0, totalRodadas = 10, acertos = 0, score = 0;
bool novoRecorde = false, tempoEsgotado = false, needsRedraw = true;
int timerFrames = 0, esperaFrames = 0, ultimoSegExibido = -1;
unsigned long tickTimer = 0;

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
    uint8_t a = random(0, 4), b;
    do { b = random(0, 4); } while (b == a);
    for (int i = 0; i < 6; i++) seq[i] = (i % 2 == 0) ? a : b;
    lacuna = random(4, 6);
    snprintf(regraAtual, sizeof(regraAtual), "REPETE: %s, %s", NOMES_DIR[a], NOMES_DIR[b]);
  } else if (catAtual == 2) {
    uint8_t a = random(0, 4), b, c;
    do { b = random(0, 4); } while (b == a);
    do { c = random(0, 4); } while (c == a || c == b);
    uint8_t pat[3] = {a, b, c};
    for (int i = 0; i < 6; i++) seq[i] = pat[i % 3];
    lacuna = random(3, 6);
    snprintf(regraAtual, sizeof(regraAtual), "REPETE: %s,%s,%s", NOMES_DIR[a], NOMES_DIR[b], NOMES_DIR[c]);
  } else if (catAtual == 3) {
    uint8_t a = random(0, 4), b = random(0, 4), c = random(0, 4);
    seq[0] = a; seq[1] = oposto(a); seq[2] = b; seq[3] = oposto(b); seq[4] = c; seq[5] = oposto(c);
    int pares[3] = {1, 3, 5}; lacuna = pares[random(0, 3)];
    snprintf(regraAtual, sizeof(regraAtual), "CADA SETA + OPOSTO");
  } else {
    uint8_t a = random(0, 4), b, c;
    do { b = random(0, 4); } while (b == a);
    do { c = random(0, 4); } while (c == b);
    seq[0] = a; seq[1] = a; seq[2] = b; seq[3] = b; seq[4] = c; seq[5] = c;
    int pares[3] = {1, 3, 5}; lacuna = pares[random(0, 3)];
    snprintf(regraAtual, sizeof(regraAtual), "EM PARES: 2x CADA");
  }

  respostaCerta = seq[lacuna];
  tempoEsgotado = false; ultimoSegExibido = -1;
  timerFrames = (TEMPO_RODADA > 0) ? TEMPO_RODADA * 30 : 0;
  rodadaAtual++; tela = JOGANDO; needsRedraw = true;
}

void novoJogo() {
  totalRodadas = (QTD_RODADAS > 0) ? QTD_RODADAS : 10;
  rodadaAtual = 0; acertos = 0; score = 0; novoRecorde = false;
  resetPend(); gerarRodada();
}

void avancarOuFim() {
  if (rodadaAtual >= totalRodadas) { novoRecorde = finishGame(score); tela = FIM; needsRedraw = true; }
  else gerarRodada();
}

void desenharSeta(int cx, int cy, uint8_t dir, uint16_t color) {
  if (dir == DIR_CIMA) {
    tft.fillTriangle(cx, cy - 6, cx - 5, cy, cx + 5, cy, color);
    tft.fillRect(cx - 2, cy, 5, 6, color);
  } else if (dir == DIR_BAIXO) {
    tft.fillTriangle(cx, cy + 6, cx - 5, cy, cx + 5, cy, color);
    tft.fillRect(cx - 2, cy - 6, 5, 6, color);
  } else if (dir == DIR_ESQ) {
    tft.fillTriangle(cx - 6, cy, cx, cy - 5, cx, cy + 5, color);
    tft.fillRect(cx, cy - 2, 6, 5, color);
  } else {
    tft.fillTriangle(cx + 6, cy, cx, cy - 5, cx, cy + 5, color);
    tft.fillRect(cx - 6, cy - 2, 6, 5, color);
  }
}

void desenhar() {
  tft.fillScreen(COL_BG);

  if (tela == TITULO) {
    tft.drawRoundRect(4, 8, W - 8, 24, 5, ST7735_CYAN);
    desenharSeta(15, 20, DIR_DIR, ST7735_YELLOW);
    drawCentered("ALGORITMANDO", 16, 1, ST7735_WHITE);
    desenharSeta(W - 15, 20, DIR_ESQ, ST7735_YELLOW);
    drawCentered("Sequencias Logicas", 44, 1, COL_GRAY);
    char buf[24];
    snprintf(buf, sizeof(buf), "Aluno: %d", studentId); drawCentered(buf, 62, 1, ST7735_WHITE);
    snprintf(buf, sizeof(buf), "Recorde: %ld", (long)stats.best); drawCentered(buf, 78, 1, ST7735_YELLOW);
    drawCentered("Aperte ACAO", 104, 1, ST7735_GREEN);
    return;
  }

  if (tela == FIM) {
    drawCentered("FIM DA PARTIDA", 8, 1, ST7735_CYAN);
    tft.drawFastHLine(0, 20, W, COL_DKGRAY);
    char resumo[24];
    snprintf(resumo, sizeof(resumo), "Acertos: %d/%d", acertos, totalRodadas); drawCentered(resumo, 32, 1, ST7735_WHITE);
    snprintf(resumo, sizeof(resumo), "Pts: %d", score); drawCentered(resumo, 50, 2, ST7735_YELLOW);
    if (novoRecorde) drawCentered("NOVO RECORDE!", 74, 1, ST7735_GREEN);
    else { snprintf(resumo, sizeof(resumo), "Recorde: %ld", (long)stats.best); drawCentered(resumo, 74, 1, ST7735_WHITE); }
    drawCentered("ACAO: jogar de novo", 104, 1, ST7735_GREEN);
    return;
  }

  if (tela == ACERTO) {
    drawCentered("CORRETO!", 44, 2, ST7735_GREEN);
    drawCentered("+10 pontos", 72, 1, ST7735_YELLOW);
    return;
  }

  if (tela == FEEDBACK) {
    if (tempoEsgotado) drawCentered("TEMPO ESGOTADO!", 10, 1, ST7735_RED);
    else drawCentered("ERROU!", 8, 2, ST7735_RED);
    drawCentered(regraAtual, 32, 1, ST7735_YELLOW);
    tft.setTextSize(1); tft.setTextColor(ST7735_WHITE); tft.setCursor(18, 63); tft.print("Seta certa:");
    tft.drawRoundRect(88, 54, 24, 24, 4, ST7735_GREEN);
    desenharSeta(100, 66, respostaCerta, ST7735_GREEN);
    tft.setTextColor(ST7735_GREEN); tft.setCursor(118, 63); tft.print(NOMES_DIR[respostaCerta]);
    drawCentered("ACAO: continuar", 108, 1, COL_GRAY);
    return;
  }

  char topo[24], pts[16];
  if (TEMPO_RODADA > 0) {
    int seg = (timerFrames + 29) / 30; ultimoSegExibido = seg;
    snprintf(topo, sizeof(topo), "%d/%d  %ds", rodadaAtual, totalRodadas, seg);
  } else snprintf(topo, sizeof(topo), "%d/%d", rodadaAtual, totalRodadas);
  tft.setTextSize(1); tft.setTextColor(ST7735_WHITE); tft.setCursor(4, 4); tft.print(topo);
  snprintf(pts, sizeof(pts), "Pts:%d", score);
  tft.setTextColor(ST7735_YELLOW); tft.setCursor(W - (int)strlen(pts) * 6 - 4, 4); tft.print(pts);
  tft.drawFastHLine(0, 15, W, COL_DKGRAY);

  drawCentered("Qual seta completa?", 26, 1, ST7735_WHITE);
  int box = 22, gap = 4, x0 = (W - (6 * box + 5 * gap)) / 2, y0 = 50;
  for (int i = 0; i < 6; i++) {
    int bx = x0 + i * (box + gap);
    if (i == lacuna) {
      tft.fillRoundRect(bx, y0, box, box, 3, ST7735_YELLOW);
      tft.setTextSize(2); tft.setTextColor(COL_BG); tft.setCursor(bx + 6, y0 + 4); tft.print("?");
    } else {
      tft.drawRoundRect(bx, y0, box, box, 3, ST7735_CYAN);
      desenharSeta(bx + box / 2, y0 + box / 2, seq[i], ST7735_WHITE);
    }
  }
  drawCentered("Aperte a seta certa", 98, 1, ST7735_CYAN);
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

  static bool prevU = false, prevD = false, prevL = false, prevR = false, prevF = false;
  bool uNow = (digitalRead(UP_BUTTON) == LOW), dNow = (digitalRead(DOWN_BUTTON) == LOW);
  bool lNow = (digitalRead(LEFT_BUTTON) == LOW), rNow = (digitalRead(RIGHT_BUTTON) == LOW);
  bool fNow = (digitalRead(FIRE_BUTTON) == LOW);
  bool uPr = uNow && !prevU, dPr = dNow && !prevD, lPr = lNow && !prevL, rPr = rNow && !prevR, fPr = fNow && !prevF;
  prevU = uNow; prevD = dNow; prevL = lNow; prevR = rNow; prevF = fNow;

  if (tela == TITULO || tela == FIM) {
    if (fPr) novoJogo();
  } else if (tela == ACERTO || tela == FEEDBACK) {
    esperaFrames--;
    if (esperaFrames <= 0 || fPr) avancarOuFim();
  } else if (tela == JOGANDO) {
    if (TEMPO_RODADA > 0) {
      timerFrames--;
      int segAtual = (timerFrames + 29) / 30;
      if (segAtual != ultimoSegExibido) needsRedraw = true;
      if (timerFrames <= 0) {
        recordMiss(catAtual); tempoEsgotado = true; esperaFrames = 75; tela = FEEDBACK; needsRedraw = true;
      }
    }
    if (tela == JOGANDO) {
      int escolhida = -1;
      if (uPr) escolhida = DIR_CIMA; else if (dPr) escolhida = DIR_BAIXO;
      else if (lPr) escolhida = DIR_ESQ; else if (rPr) escolhida = DIR_DIR;
      if (escolhida >= 0) {
        if ((uint8_t)escolhida == respostaCerta) {
          score += 10; acertos++; recordHit(catAtual); esperaFrames = 18; tela = ACERTO;
        } else {
          recordMiss(catAtual); tempoEsgotado = false; esperaFrames = 75; tela = FEEDBACK;
        }
        needsRedraw = true;
      }
    }
  }

  if (needsRedraw) { desenhar(); needsRedraw = false; }
}
