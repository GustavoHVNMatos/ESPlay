/*
  ESPlay — engine para o console maker educacional ESPlay (ESP32)
  ----------------------------------------------------------------
  Cada jogo é um sketch curto que usa esta biblioteca:

    #include <ESPlay.h>
    ESPlay esp;

    void setup() { esp.begin("meujogo", "Meu Jogo", "tabuada"); }
    void loop()  { if (esp.tick(30)) { ...atualiza e desenha... } }

  A engine cuida de: 5 botões, display, número do aluno,
  estatísticas de aprendizado (salvas na flash/NVS) e do
  comando serial que o painel do professor usa para ler os dados.

  Display atual: OLED SSD1306 128x64 (I2C). Para migrar para o
  LCD ST7735 128x160 basta trocar o backend em ESPlay.cpp; os
  jogos usam width()/height() e continuam funcionando.
*/
#pragma once

#include <Arduino.h>
#include <Adafruit_GFX.h>

class Adafruit_SSD1306;

enum ESPlayButton : uint8_t {
  BTN_UP = 0,
  BTN_DOWN,
  BTN_LEFT,
  BTN_RIGHT,
  BTN_ACTION,
  BTN_COUNT
};

#define ESPLAY_HISTORY 10   // quantas últimas partidas ficam guardadas
#define ESPLAY_TAGS    16   // categorias de acerto/erro (ex.: tabuada 0..15)
#define ESPLAY_NO_TAG  255

struct ESPlayStats {
  uint32_t magic;
  int32_t  best;
  uint32_t plays;
  uint32_t hits;
  uint32_t misses;
  int32_t  last[ESPLAY_HISTORY];   // do mais antigo para o mais recente
  uint8_t  lastCount;
  uint16_t tagHits[ESPLAY_TAGS];
  uint16_t tagMisses[ESPLAY_TAGS];
};

class ESPlay {
 public:
  ESPlay();

  // Opcional: chamar ANTES de begin() se a carcaça usar outros pinos.
  void setPins(uint8_t up, uint8_t down, uint8_t left, uint8_t right, uint8_t action);

  // gameId: identificador curto, sem espaços (máx. 15 caracteres), ex. "pixelmath"
  // gameName: nome mostrado no painel (sem aspas)
  // tagName: o que as categorias representam, ex. "tabuada" (sem aspas)
  // askStudentId: pede o número do aluno na primeira vez
  bool begin(const char* gameId, const char* gameName,
             const char* tagName = "item", bool askStudentId = true);

  // Chamar a cada volta do loop(). Lê botões, atende a serial e
  // devolve true quando é hora de rodar um quadro (fps por segundo).
  bool tick(uint8_t fps = 30);

  // ---- Botões ----
  bool held(ESPlayButton b) const    { return _held[b]; }     // segurado agora
  bool pressed(ESPlayButton b) const { return _pressed[b]; }  // apertou neste quadro

  // ---- Vídeo ----
  int  width() const  { return _w; }
  int  height() const { return _h; }
  void clear();
  void show();
  void pixel(int x, int y, bool on = true);
  void line(int x0, int y0, int x1, int y1, bool on = true);
  void rect(int x, int y, int w, int h, bool on = true);
  void fillRect(int x, int y, int w, int h, bool on = true);
  void fillTriangle(int x0, int y0, int x1, int y1, int x2, int y2, bool on = true);
  void text(int x, int y, const char* s, uint8_t size = 1, bool on = true);
  void number(int x, int y, long n, uint8_t size = 1, bool on = true);
  void textCenter(int cx, int y, const char* s, uint8_t size = 1, bool on = true);   // centralizado em cx
  void numberCenter(int cx, int y, long n, uint8_t size = 1, bool on = true);
  Adafruit_GFX& gfx() { return *_g; }   // acesso avançado

  // ---- Aprendizado ----
  void recordHit(uint8_t tag = ESPLAY_NO_TAG);    // acerto (fica na RAM até gameOver)
  void recordMiss(uint8_t tag = ESPLAY_NO_TAG);   // erro
  bool gameOver(int score);                       // fecha a partida e grava na flash; true = novo recorde
  int  best() const { return _stats.best; }
  uint32_t plays() const { return _stats.plays; }
  const ESPlayStats& stats() const { return _stats; }

  // ---- Aluno ----
  uint16_t studentId() const { return _sid; }
  void setStudentId(uint16_t id);

 private:
  void handleSerial();
  void runCommand(char* cmd);
  void sendJson();
  void promptStudentId();
  void loadStats();
  void saveStats();

  uint8_t _pins[BTN_COUNT];
  bool _held[BTN_COUNT];
  bool _latch[BTN_COUNT];
  bool _pressed[BTN_COUNT];
  unsigned long _lastFrame;

  Adafruit_SSD1306* _oled;
  Adafruit_GFX* _g;
  int _w, _h;

  char _ns[16];
  const char* _gameName;
  const char* _tagName;
  ESPlayStats _stats;
  uint16_t _sid;
  bool _idChanged;

  char _cmd[24];
  uint8_t _cmdLen;
};
