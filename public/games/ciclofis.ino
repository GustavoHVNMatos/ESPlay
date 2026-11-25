/*
  CicloFis — jogo educativo de mudancas de estado fisico para o ESPlay
  --------------------------------------------------------------------
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
const bool USAR_FUSAO         = true;
const bool USAR_VAPORIZACAO   = true;
const bool USAR_SOLIDIFICACAO = true;
const bool USAR_CONDENSACAO   = true;
const bool USAR_SUBLIMACAO    = true;
const int  TEMPO_PERGUNTA     = 0;    // segundos por pergunta (0 = sem limite)
const int  QTD_PERGUNTAS      = 10;   // perguntas por partida
const bool PEDIR_ALUNO        = true; // pede numero do aluno no primeiro uso
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
const char* GAME_ID   = "ciclofis";
const char* GAME_NAME = "CicloFis";
const char* TAG_NAME  = "mudanca";

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

// ---------- Banco e logica do CicloFis ----------
struct Fenomeno { const char* texto; uint8_t cat; };

const char* NOMES_MUD[] = {"", "FUSAO", "VAPORIZACAO", "SOLIDIFICACAO", "CONDENSACAO", "SUBLIMACAO"};
const char* SENTIDOS[] = {
  "",
  "SOLIDO PARA LIQUIDO",
  "LIQUIDO PARA GASOSO",
  "LIQUIDO PARA SOLIDO",
  "GASOSO PARA LIQUIDO",
  "SOLIDO PARA GASOSO"
};

const Fenomeno BANCO[] = {
  {"Gelo derretendo no copo", 1},
  {"Manteiga na frigideira quente", 1},
  {"Sorvete derretendo ao sol", 1},
  {"Vela de cera derretendo", 1},
  {"Agua fervendo na panela", 2},
  {"Roupa secando no varal", 2},
  {"Poca de chuva sumindo ao sol", 2},
  {"Alcool evaporando da mao", 2},
  {"Agua virando gelo no freezer", 3},
  {"Chocolate derretido endurecendo", 3},
  {"Lava vulcanica virando rocha", 3},
  {"Cera liquida esfriando na mesa", 3},
  {"Gotas no copo gelado por fora", 4},
  {"Espelho embacado apos o banho", 4},
  {"Orvalho na grama de madrugada", 4},
  {"Nuvem formando gotas de chuva", 4},
  {"Naftalina sumindo no armario", 5},
  {"Gelo seco soltando fumaca", 5},
  {"Pastilha sanitaria sumindo no ar", 5},
  {"Neve evaporando sem virar agua", 5}
};
const int NUM_FENOMENOS = sizeof(BANCO) / sizeof(BANCO[0]);

enum Tela { TITULO, JOGANDO, ACERTO, FEEDBACK, FIM };
Tela tela = TITULO;

int pool[NUM_FENOMENOS], poolTam = 0, poolPos = 0;
uint8_t opcoes[3];
int selecao = 0, perguntaAtual = 0, totalPerguntas = 10, acertos = 0, score = 0;
bool novoRecorde = false, tempoEsgotado = false, needsRedraw = true;
int timerFrames = 0, esperaFrames = 0, ultimoSeg = -1;
Fenomeno atual;
unsigned long tickTimer = 0;

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
  for (int i = 0; i < NUM_FENOMENOS; i++) if (categoriaAtiva(BANCO[i].cat)) pool[poolTam++] = i;
  if (poolTam == 0) for (int i = 0; i < NUM_FENOMENOS; i++) pool[poolTam++] = i;
  for (int i = poolTam - 1; i > 0; i--) {
    int j = random(0, i + 1); int tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
  }
  poolPos = 0;
}

void montarOpcoes(uint8_t correta) {
  uint8_t cands[5]; int nc = 0, ativos = 0;
  for (uint8_t c = 1; c <= 5; c++) if (c != correta && categoriaAtiva(c)) { cands[nc++] = c; ativos++; }
  for (uint8_t c = 1; c <= 5; c++) if (c != correta && !categoriaAtiva(c)) cands[nc++] = c;
  int lim = (ativos >= 2) ? ativos : nc;
  for (int i = lim - 1; i > 0; i--) { int j = random(0, i + 1); uint8_t tmp = cands[i]; cands[i] = cands[j]; cands[j] = tmp; }
  opcoes[0] = correta; opcoes[1] = cands[0]; opcoes[2] = cands[1];
  for (int i = 2; i > 0; i--) { int j = random(0, i + 1); uint8_t tmp = opcoes[i]; opcoes[i] = opcoes[j]; opcoes[j] = tmp; }
}

void proximaPergunta() {
  if (poolPos >= poolTam) embaralharPool();
  atual = BANCO[pool[poolPos++]];
  montarOpcoes(atual.cat);
  selecao = 0; tempoEsgotado = false; ultimoSeg = -1;
  timerFrames = (TEMPO_PERGUNTA > 0) ? TEMPO_PERGUNTA * 30 : 0;
  perguntaAtual++; tela = JOGANDO; needsRedraw = true;
}

void novoJogo() {
  totalPerguntas = (QTD_PERGUNTAS > 0) ? QTD_PERGUNTAS : 10;
  perguntaAtual = 0; acertos = 0; score = 0; novoRecorde = false;
  resetPend(); embaralharPool(); proximaPergunta();
}

void avancarOuFim() {
  if (perguntaAtual >= totalPerguntas) { novoRecorde = finishGame(score); tela = FIM; needsRedraw = true; }
  else proximaPergunta();
}

void textoQuebrado(int x, int y, int maxLarg, int altLinha, const char* s, uint16_t color) {
  int maxChars = maxLarg / 6; if (maxChars < 4) maxChars = 4;
  int len = strlen(s), pos = 0, cy = y;
  tft.setTextSize(1); tft.setTextColor(color);
  while (pos < len) {
    while (pos < len && s[pos] == ' ') pos++;
    if (pos >= len) break;
    int fim = pos + maxChars;
    if (fim >= len) fim = len;
    else { int k = fim; while (k > pos && s[k] != ' ') k--; if (k > pos) fim = k; }
    char linha[32]; int n = fim - pos; if (n >= (int)sizeof(linha)) n = sizeof(linha) - 1;
    memcpy(linha, s + pos, n); linha[n] = 0;
    tft.setCursor(x, cy); tft.print(linha);
    cy += altLinha; pos = fim;
  }
}

void desenhar() {
  tft.fillScreen(COL_BG);

  if (tela == TITULO) {
    drawCentered("CICLOFIS", 12, 2, ST7735_CYAN);
    drawCentered("Mudancas de estado fisico", 36, 1, COL_GRAY);
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

  if (tela == FEEDBACK) {
    drawCentered(tempoEsgotado ? "TEMPO ESGOTADO!" : "ERROU! ERA:", 10, 1, ST7735_RED);
    const char* nome = NOMES_MUD[atual.cat];
    uint8_t nSize = ((int)strlen(nome) * 12 <= W - 12) ? 2 : 1;
    drawCentered(nome, nSize == 2 ? 32 : 36, nSize, ST7735_YELLOW);
    drawCentered(SENTIDOS[atual.cat], 66, 1, ST7735_CYAN);
    drawCentered("Aguarde...", 108, 1, COL_GRAY);
    return;
  }

  // JOGANDO
  char topo[20], pts[12];
  if (TEMPO_PERGUNTA > 0) {
    int seg = (timerFrames + 29) / 30; ultimoSeg = seg;
    snprintf(topo, sizeof(topo), "%d/%d  %ds", perguntaAtual, totalPerguntas, seg);
  } else snprintf(topo, sizeof(topo), "%d/%d", perguntaAtual, totalPerguntas);
  snprintf(pts, sizeof(pts), "Pts:%d", score);
  tft.setTextSize(1);
  tft.setTextColor(ST7735_WHITE); tft.setCursor(4, 4); tft.print(topo);
  tft.setTextColor(ST7735_YELLOW); tft.setCursor(W - (int)strlen(pts) * 6 - 4, 4); tft.print(pts);
  tft.drawFastHLine(0, 15, W, COL_DKGRAY);

  textoQuebrado(6, 22, W - 12, 11, atual.texto, ST7735_WHITE);

  for (int i = 0; i < 3; i++) {
    int oy = 56 + i * 22;
    char lin[24]; snprintf(lin, sizeof(lin), "%d. %s", i + 1, NOMES_MUD[opcoes[i]]);
    if (i == selecao) {
      tft.fillRoundRect(6, oy, W - 12, 18, 4, ST7735_BLUE);
      tft.drawRoundRect(6, oy, W - 12, 18, 4, ST7735_CYAN);
      tft.setTextSize(1); tft.setTextColor(ST7735_WHITE);
      tft.setCursor(14, oy + 5); tft.print(lin);
    } else {
      tft.drawRoundRect(6, oy, W - 12, 18, 4, COL_DKGRAY);
      tft.setTextSize(1); tft.setTextColor(COL_GRAY);
      tft.setCursor(14, oy + 5); tft.print(lin);
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
  } else if (tela == ACERTO || tela == FEEDBACK) {
    esperaFrames--;
    if (esperaFrames <= 0 || fPr) avancarOuFim();
  } else if (tela == JOGANDO) {
    if (TEMPO_PERGUNTA > 0) {
      timerFrames--;
      int seg = (timerFrames + 29) / 30;
      if (seg != ultimoSeg) needsRedraw = true;
      if (timerFrames <= 0) {
        recordMiss(atual.cat); tempoEsgotado = true; esperaFrames = 60; tela = FEEDBACK; needsRedraw = true;
      }
    }
    if (tela == JOGANDO) {
      if (uPr) { selecao = (selecao + 2) % 3; needsRedraw = true; }
      if (dPr) { selecao = (selecao + 1) % 3; needsRedraw = true; }
      if (fPr) {
        if (opcoes[selecao] == atual.cat) {
          score += 10; acertos++; recordHit(atual.cat); esperaFrames = 18; tela = ACERTO;
        } else {
          recordMiss(atual.cat); tempoEsgotado = false; esperaFrames = 60; tela = FEEDBACK;
        }
        needsRedraw = true;
      }
    }
  }

  if (needsRedraw) { desenhar(); needsRedraw = false; }
}
