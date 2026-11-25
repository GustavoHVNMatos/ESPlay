/*
  TesteBotoes — teste de hardware do ESPlay (ESP32 + ST7735S 160x128)
  --------------------------------------------------------------------
  Grave este sketch logo depois de montar o console. Ao apertar
  cada botao, o desenho correspondente acende na tela colorida.

  Display TFT 1.8" ST7735S (160x128 paisagem, VSPI):
    GND -> GND | VCC -> 3V3 | SCL -> GPIO 18 | SDA -> GPIO 23
    RST -> GPIO 4 | DC -> GPIO 2 | CS -> GPIO 5 | BLK -> 3V3

  Botoes (para GND, com INPUT_PULLUP):
    CIMA=32  BAIXO=33  ESQUERDA=26  DIREITA=27  ACAO=25

  Bibliotecas: Adafruit GFX Library + Adafruit ST7735 and ST7789 Library
*/

#include <SPI.h>
#include <Adafruit_GFX.h>
#include <Adafruit_ST7735.h>

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
#define COL_DKGRAY 0x39E7

bool prevState[5] = {false, false, false, false, false};

void drawBtn(int x, int y, const char* label, uint16_t color, bool on) {
  tft.fillRect(x, y, 22, 22, on ? color : COL_BG);
  tft.drawRect(x, y, 22, 22, color);
  tft.setTextSize(1);
  tft.setTextColor(on ? COL_BG : color);
  tft.setCursor(x + 8, y + 7);
  tft.print(label);
}

void drawAction(bool on) {
  int cx = 124, cy = 72, r = 16;
  tft.fillCircle(cx, cy, r, on ? ST7735_YELLOW : COL_BG);
  tft.drawCircle(cx, cy, r, ST7735_YELLOW);
  tft.setTextSize(2);
  tft.setTextColor(on ? COL_BG : ST7735_YELLOW);
  tft.setCursor(cx - 5, cy - 7);
  tft.print("A");
}

void drawAll(bool cur[5]) {
  drawBtn(36, 32, "U", ST7735_CYAN, cur[0]);
  drawBtn(36, 84, "D", ST7735_CYAN, cur[1]);
  drawBtn(10, 58, "L", ST7735_GREEN, cur[2]);
  drawBtn(62, 58, "R", ST7735_GREEN, cur[3]);
  drawAction(cur[4]);
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

  tft.setTextSize(1);
  tft.setTextColor(ST7735_YELLOW);
  tft.setCursor(10, 6);
  tft.print("TESTE DE BOTOES ESPLAY");
  tft.drawFastHLine(0, 18, W, COL_DKGRAY);

  tft.setTextColor(COL_DKGRAY);
  tft.setCursor(8, 114);
  tft.print("32:U 33:D 26:L 27:R 25:A");

  bool init[5] = {false, false, false, false, false};
  drawAll(init);
}

void loop() {
  bool cur[5] = {
    digitalRead(UP_BUTTON) == LOW,
    digitalRead(DOWN_BUTTON) == LOW,
    digitalRead(LEFT_BUTTON) == LOW,
    digitalRead(RIGHT_BUTTON) == LOW,
    digitalRead(FIRE_BUTTON) == LOW
  };
  bool changed = false;
  for (int i = 0; i < 5; i++) {
    if (cur[i] != prevState[i]) { prevState[i] = cur[i]; changed = true; }
  }
  if (changed) drawAll(cur);
  delay(20);
}
