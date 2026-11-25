/*
  PixelMath — jogo educativo de tabuada para o ESPlay
  ----------------------------------------------------
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
const int   TABUADA_FIXA       = 0;     // 0 = todas as tabuadas; 1..9 = so aquela
const float VELOCIDADE_INICIAL = 0.8f;  // pixels por quadro (menor = mais devagar)
const float VELOCIDADE_MAXIMA  = 2.2f;
const float ACELERACAO         = 0.05f; // aumento a cada acerto
const bool  PEDIR_ALUNO        = true;  // pede numero do aluno no primeiro uso
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
const char* GAME_ID   = "pixelmath";
const char* GAME_NAME = "PixelMath";
const char* TAG_NAME  = "tabuada";

struct ESPlayStats {
  uint32_t magic;
  int32_t  best;
  uint32_t plays;
  uint32_t hits;
  uint32_t misses;
  int32_t  last[10];
  uint8_t  lastCount;
  uint16_t tagHits[16];
  uint16_t tagMisses[16];
};

Preferences prefs;
ESPlayStats stats;
uint16_t studentId = 0;
uint32_t pendHits = 0, pendMisses = 0;
uint16_t pendTH[16], pendTM[16];
char serialBuf[24];
uint8_t serialLen = 0;
bool idSaved = false;

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
  if (n != sizeof(stats) || stats.magic != 0xE5A10001) {
    memset(&stats, 0, sizeof(stats)); stats.magic = 0xE5A10001;
  }
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
  bool rec = sc > stats.best;
  if (rec) stats.best = sc;
  stats.plays++;
  stats.hits += pendHits; stats.misses += pendMisses;
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
  idSaved = false;
  bool dirty = true;
  while (!idSaved) {
    handleSerial();
    bool now[5];
    for (int i = 0; i < 5; i++) now[i] = (digitalRead(pins[i]) == LOW);
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
    if (ok) {
      saveStudentId((uint16_t)n);
      tft.fillScreen(COL_BG);
      drawCentered("SALVO!", 52, 2, ST7735_GREEN);
      delay(600);
    }
    delay(20);
  }
}

// ---------- Logica do PixelMath ----------
enum Tela { TITULO, JOGANDO, FIM };
Tela tela = TITULO;

const int colX[3] = {27, 80, 133};
const int START_Y = 24;
const int CATCH_Y = H - 28;

float ansY = START_Y;
int prevAnsY = START_Y;
float velocidade = VELOCIDADE_INICIAL;
int ansValue[3];
int correctIndex = 0;
int playerCol = 1;
int prevPlayerCol = 1;
int numA = 1, numB = 1;
int score = 0;
bool novoRecorde = false;
int ultimaConta = 0;
bool screenDirty = true;
unsigned long tickTimer = 0;

void drawHeader() {
  tft.fillRect(0, 0, W, 19, COL_BG);
  tft.setTextSize(1);
  tft.setTextColor(ST7735_WHITE);
  tft.setCursor(4, 4);
  tft.print("P:"); tft.print(score);

  char conta[16];
  snprintf(conta, sizeof(conta), "%d x %d = ?", numA, numB);
  tft.setTextSize(2);
  int16_t x1, y1; uint16_t tw, th;
  tft.getTextBounds(conta, 0, 0, &x1, &y1, &tw, &th);
  tft.setCursor(W - (int)tw - 4, 2);
  tft.setTextColor(ST7735_CYAN);
  tft.print(conta);

  tft.drawFastHLine(0, 19, W, COL_DKGRAY);
}

void gerarPergunta() {
  numA = (TABUADA_FIXA >= 1 && TABUADA_FIXA <= 9) ? TABUADA_FIXA : random(1, 10);
  numB = random(1, 10);
  int correct = numA * numB;

  int wrong1, wrong2;
  do { wrong1 = correct + random(-5, 6); } while (wrong1 == correct || wrong1 < 0);
  do { wrong2 = correct + random(-5, 6); } while (wrong2 == correct || wrong2 == wrong1 || wrong2 < 0);

  correctIndex = random(0, 3);
  int used = 0;
  for (int i = 0; i < 3; i++) {
    ansValue[i] = (i == correctIndex) ? correct : (used++ == 0 ? wrong1 : wrong2);
  }
  ansY = START_Y;
  prevAnsY = START_Y;
  drawHeader();
}

void drawPlayer(int col, uint16_t color) {
  int px = colX[col];
  tft.fillTriangle(px - 8, H - 3, px + 8, H - 3, px, H - 15, color);
}

void novoJogo() {
  score = 0;
  playerCol = 1;
  prevPlayerCol = 1;
  velocidade = VELOCIDADE_INICIAL;
  novoRecorde = false;
  resetPend();
  tft.fillScreen(COL_BG);
  gerarPergunta();
  drawPlayer(playerCol, ST7735_GREEN);
  tela = JOGANDO;
}

void drawStaticScreen() {
  tft.fillScreen(COL_BG);
  if (tela == TITULO) {
    drawCentered("PIXELMATH", 12, 2, ST7735_CYAN);
    drawCentered("Tabuada em 3 colunas", 36, 1, COL_GRAY);
    char buf[24];
    snprintf(buf, sizeof(buf), "Aluno: %d", studentId);
    drawCentered(buf, 58, 1, ST7735_WHITE);
    snprintf(buf, sizeof(buf), "Recorde: %ld", (long)stats.best);
    drawCentered(buf, 74, 1, ST7735_YELLOW);
    drawCentered("Aperte ACAO", 104, 1, ST7735_GREEN);
  } else if (tela == FIM) {
    drawCentered("GAME OVER", 10, 2, ST7735_RED);
    char buf[28];
    snprintf(buf, sizeof(buf), "Era: %d x %d = %d", numA, numB, ultimaConta);
    drawCentered(buf, 38, 1, ST7735_YELLOW);
    snprintf(buf, sizeof(buf), "Pts: %d", score);
    drawCentered(buf, 56, 2, ST7735_WHITE);
    if (novoRecorde) drawCentered("NOVO RECORDE!", 80, 1, ST7735_GREEN);
    else { snprintf(buf, sizeof(buf), "Recorde: %ld", (long)stats.best); drawCentered(buf, 80, 1, ST7735_YELLOW); }
    drawCentered("ACAO: jogar de novo", 106, 1, ST7735_GREEN);
  }
  screenDirty = false;
}

void setup() {
  Serial.begin(115200);
  pinMode(UP_BUTTON, INPUT_PULLUP);
  pinMode(DOWN_BUTTON, INPUT_PULLUP);
  pinMode(LEFT_BUTTON, INPUT_PULLUP);
  pinMode(RIGHT_BUTTON, INPUT_PULLUP);
  pinMode(FIRE_BUTTON, INPUT_PULLUP);

  tft.initR(INITR_GREENTAB);
  tft.setRotation(1);
  tft.setTextWrap(false);
  tft.fillScreen(COL_BG);

  loadStats();
  Preferences idp; idp.begin("esplay", false); studentId = idp.getUShort("sid", 0); idp.end();
  bool forceId = (digitalRead(LEFT_BUTTON) == LOW) && (digitalRead(RIGHT_BUTTON) == LOW);
  if (PEDIR_ALUNO && (studentId == 0 || forceId)) promptStudentId();
  randomSeed(esp_random());
  screenDirty = true;
  tickTimer = millis();
}

void loop() {
  handleSerial();
  unsigned long now = millis();
  if (now - tickTimer < 33) return;
  tickTimer = now;

  static bool prevL = false, prevR = false, prevF = false;
  bool lNow = (digitalRead(LEFT_BUTTON) == LOW);
  bool rNow = (digitalRead(RIGHT_BUTTON) == LOW);
  bool fNow = (digitalRead(FIRE_BUTTON) == LOW);
  bool lPr = lNow && !prevL, rPr = rNow && !prevR, fPr = fNow && !prevF;
  prevL = lNow; prevR = rNow; prevF = fNow;

  if (tela != JOGANDO) {
    if (screenDirty) drawStaticScreen();
    if (fPr) novoJogo();
    return;
  }

  if (lPr && playerCol > 0) playerCol--;
  if (rPr && playerCol < 2) playerCol++;

  if (playerCol != prevPlayerCol) {
    drawPlayer(prevPlayerCol, COL_BG);
    drawPlayer(playerCol, ST7735_GREEN);
    prevPlayerCol = playerCol;
  }

  tft.fillRect(0, prevAnsY, W, 16, COL_BG);
  ansY += velocidade;

  if (ansY >= CATCH_Y) {
    if (playerCol == correctIndex) {
      score += 10;
      recordHit(numA);
      velocidade += ACELERACAO;
      if (velocidade > VELOCIDADE_MAXIMA) velocidade = VELOCIDADE_MAXIMA;
      gerarPergunta();
      drawPlayer(playerCol, ST7735_GREEN);
    } else {
      recordMiss(numA);
      ultimaConta = numA * numB;
      novoRecorde = finishGame(score);
      tela = FIM;
      screenDirty = true;
      return;
    }
  }

  int yInt = (int)ansY;
  tft.setTextSize(2);
  tft.setTextColor(ST7735_YELLOW);
  for (int i = 0; i < 3; i++) {
    char numStr[8]; snprintf(numStr, sizeof(numStr), "%d", ansValue[i]);
    int16_t x1, y1; uint16_t tw, th;
    tft.getTextBounds(numStr, 0, 0, &x1, &y1, &tw, &th);
    tft.setCursor(colX[i] - (int)tw / 2, yInt);
    tft.print(numStr);
  }
  prevAnsY = yInt;
}
