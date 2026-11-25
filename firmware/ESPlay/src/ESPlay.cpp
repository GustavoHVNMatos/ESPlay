#include "ESPlay.h"
#include <Wire.h>
#include <Adafruit_SSD1306.h>
#include <Preferences.h>

#define ESPLAY_OLED_ADDR 0x3C
static const uint32_t STATS_MAGIC = 0xE5A10001;

static Preferences prefs;   // estatísticas do jogo (namespace = gameId)

ESPlay::ESPlay()
    : _lastFrame(0), _oled(nullptr), _g(nullptr), _w(128), _h(64),
      _gameName(""), _tagName("item"), _sid(0), _idChanged(false), _cmdLen(0) {
  // Padrão: CIMA, BAIXO, ESQUERDA, DIREITA, AÇÃO
  _pins[BTN_UP] = 32;
  _pins[BTN_DOWN] = 33;
  _pins[BTN_LEFT] = 25;
  _pins[BTN_RIGHT] = 26;
  _pins[BTN_ACTION] = 27;
  for (int i = 0; i < BTN_COUNT; i++) {
    _held[i] = _latch[i] = _pressed[i] = false;
  }
  _ns[0] = 0;
  memset(&_stats, 0, sizeof(_stats));
}

void ESPlay::setPins(uint8_t up, uint8_t down, uint8_t left, uint8_t right, uint8_t action) {
  _pins[BTN_UP] = up;
  _pins[BTN_DOWN] = down;
  _pins[BTN_LEFT] = left;
  _pins[BTN_RIGHT] = right;
  _pins[BTN_ACTION] = action;
}

bool ESPlay::begin(const char* gameId, const char* gameName, const char* tagName, bool askStudentId) {
  Serial.begin(115200);
  _gameName = gameName;
  _tagName = tagName;
  strncpy(_ns, gameId, sizeof(_ns) - 1);
  _ns[sizeof(_ns) - 1] = 0;

  for (int i = 0; i < BTN_COUNT; i++) pinMode(_pins[i], INPUT_PULLUP);

  // I2C padrão do ESP32: SDA=21, SCL=22
  Wire.begin();
  _oled = new Adafruit_SSD1306(128, 64, &Wire, -1);
  if (!_oled->begin(SSD1306_SWITCHCAPVCC, ESPLAY_OLED_ADDR)) {
    Serial.println(F("Falha ao iniciar o display. Verifique SDA(21)/SCL(22)."));
    for (;;) delay(1000);
  }
  _g = _oled;
  _w = _oled->width();
  _h = _oled->height();
  _g->setTextWrap(false);
  _g->setTextColor(1);

  prefs.begin(_ns, false);
  loadStats();

  Preferences idp;
  idp.begin("esplay", false);
  _sid = idp.getUShort("sid", 0);
  idp.end();

  // Segurar ESQUERDA + DIREITA ao ligar permite trocar o número do aluno.
  bool force = (digitalRead(_pins[BTN_LEFT]) == LOW) && (digitalRead(_pins[BTN_RIGHT]) == LOW);
  if (askStudentId && (_sid == 0 || force)) promptStudentId();

  randomSeed(esp_random());
  clear();
  show();
  return true;
}

// ---------------------------------------------------------------
// Loop / botões
// ---------------------------------------------------------------
bool ESPlay::tick(uint8_t fps) {
  handleSerial();

  // lê os botões a cada chamada para não perder toques rápidos
  for (int i = 0; i < BTN_COUNT; i++) {
    bool now = (digitalRead(_pins[i]) == LOW);
    if (now && !_held[i]) _latch[i] = true;
    _held[i] = now;
  }

  unsigned long ms = millis();
  if (ms - _lastFrame < (unsigned long)(1000 / fps)) return false;
  _lastFrame = ms;

  for (int i = 0; i < BTN_COUNT; i++) {
    _pressed[i] = _latch[i];
    _latch[i] = false;
  }
  return true;
}

// ---------------------------------------------------------------
// Vídeo
// ---------------------------------------------------------------
void ESPlay::clear() { _oled->clearDisplay(); }
void ESPlay::show() { _oled->display(); }
void ESPlay::pixel(int x, int y, bool on) { _g->drawPixel(x, y, on ? 1 : 0); }
void ESPlay::line(int x0, int y0, int x1, int y1, bool on) { _g->drawLine(x0, y0, x1, y1, on ? 1 : 0); }
void ESPlay::rect(int x, int y, int w, int h, bool on) { _g->drawRect(x, y, w, h, on ? 1 : 0); }
void ESPlay::fillRect(int x, int y, int w, int h, bool on) { _g->fillRect(x, y, w, h, on ? 1 : 0); }
void ESPlay::fillTriangle(int x0, int y0, int x1, int y1, int x2, int y2, bool on) {
  _g->fillTriangle(x0, y0, x1, y1, x2, y2, on ? 1 : 0);
}

void ESPlay::text(int x, int y, const char* s, uint8_t size, bool on) {
  _g->setTextSize(size);
  _g->setTextColor(on ? 1 : 0);
  _g->setCursor(x, y);
  _g->print(s);
}

void ESPlay::number(int x, int y, long n, uint8_t size, bool on) {
  char buf[16];
  snprintf(buf, sizeof(buf), "%ld", n);
  text(x, y, buf, size, on);
}

void ESPlay::textCenter(int cx, int y, const char* s, uint8_t size, bool on) {
  int w = (int)strlen(s) * 6 * size - size;   // fonte padrão: 6 px por caractere
  text(cx - w / 2, y, s, size, on);
}

void ESPlay::numberCenter(int cx, int y, long n, uint8_t size, bool on) {
  char buf[16];
  snprintf(buf, sizeof(buf), "%ld", n);
  textCenter(cx, y, buf, size, on);
}

// ---------------------------------------------------------------
// Estatísticas de aprendizado
// ---------------------------------------------------------------
void ESPlay::loadStats() {
  size_t n = prefs.getBytes("stats", &_stats, sizeof(_stats));
  if (n != sizeof(_stats) || _stats.magic != STATS_MAGIC) {
    memset(&_stats, 0, sizeof(_stats));
    _stats.magic = STATS_MAGIC;
  }
}

void ESPlay::saveStats() { prefs.putBytes("stats", &_stats, sizeof(_stats)); }

void ESPlay::recordHit(uint8_t tag) {
  _stats.hits++;
  if (tag < ESPLAY_TAGS && _stats.tagHits[tag] < 65535) _stats.tagHits[tag]++;
}

void ESPlay::recordMiss(uint8_t tag) {
  _stats.misses++;
  if (tag < ESPLAY_TAGS && _stats.tagMisses[tag] < 65535) _stats.tagMisses[tag]++;
}

// Grava só no fim da partida, para poupar ciclos de escrita da flash.
bool ESPlay::gameOver(int score) {
  bool record = score > _stats.best;
  if (record) _stats.best = score;
  _stats.plays++;

  if (_stats.lastCount < ESPLAY_HISTORY) {
    _stats.last[_stats.lastCount++] = score;
  } else {
    memmove(_stats.last, _stats.last + 1, sizeof(int32_t) * (ESPLAY_HISTORY - 1));
    _stats.last[ESPLAY_HISTORY - 1] = score;
  }
  saveStats();
  return record;
}

// ---------------------------------------------------------------
// Aluno
// ---------------------------------------------------------------
void ESPlay::setStudentId(uint16_t id) {
  _sid = id;
  _idChanged = true;
  Preferences idp;
  idp.begin("esplay", false);
  idp.putUShort("sid", id);
  idp.end();
}

void ESPlay::promptStudentId() {
  int n = _sid ? _sid : 1;
  bool prev[BTN_COUNT];
  for (int i = 0; i < BTN_COUNT; i++) prev[i] = true;   // ignora o que já estava apertado
  _idChanged = false;

  while (!_idChanged) {
    handleSerial();

    bool now[BTN_COUNT];
    for (int i = 0; i < BTN_COUNT; i++) now[i] = (digitalRead(_pins[i]) == LOW);
    auto edge = [&](int b) { return now[b] && !prev[b]; };

    if (edge(BTN_UP))    n += 1;
    if (edge(BTN_DOWN))  n -= 1;
    if (edge(BTN_RIGHT)) n += 10;
    if (edge(BTN_LEFT))  n -= 10;
    if (n < 1) n = 1;
    if (n > 999) n = 999;

    bool confirm = edge(BTN_ACTION);
    for (int i = 0; i < BTN_COUNT; i++) prev[i] = now[i];

    clear();
    textCenter(_w / 2, 0, "SEU NUMERO", 1);
    numberCenter(_w / 2, 16, n, 3);
    textCenter(_w / 2, 44, "CIMA/BAIXO: +-1", 1);
    textCenter(_w / 2, 54, "LADOS:+-10 ACAO:OK", 1);
    show();

    if (confirm) {
      setStudentId(n);
      clear();
      textCenter(_w / 2, 28, "SALVO!", 2);
      show();
      delay(700);
    }
    delay(15);
  }
}

// ---------------------------------------------------------------
// Serial — usada pelo painel do professor (Web Serial)
//   ESPLAY?  ou  DUMP  -> uma linha JSON com os dados
//   ID <n>              -> define o número do aluno (1..999)
//   RESET               -> apaga as estatísticas deste jogo
// ---------------------------------------------------------------
void ESPlay::handleSerial() {
  while (Serial.available()) {
    char c = (char)Serial.read();
    if (c == '\n' || c == '\r') {
      if (_cmdLen > 0) {
        _cmd[_cmdLen] = 0;
        runCommand(_cmd);
        _cmdLen = 0;
      }
    } else if (_cmdLen < sizeof(_cmd) - 1) {
      _cmd[_cmdLen++] = c;
    }
  }
}

void ESPlay::runCommand(char* cmd) {
  String c(cmd);
  c.trim();
  c.toUpperCase();

  if (c == "ESPLAY?" || c == "DUMP") {
    sendJson();
  } else if (c.startsWith("ID ")) {
    int n = c.substring(3).toInt();
    if (n >= 1 && n <= 999) {
      setStudentId((uint16_t)n);
      Serial.println(F("OK"));
    } else {
      Serial.println(F("ERRO"));
    }
  } else if (c == "RESET") {
    memset(&_stats, 0, sizeof(_stats));
    _stats.magic = STATS_MAGIC;
    saveStats();
    Serial.println(F("OK"));
  }
}

void ESPlay::sendJson() {
  Serial.print(F("{\"esplay\":1,\"student\":"));
  Serial.print(_sid);
  Serial.print(F(",\"game\":\""));
  Serial.print(_ns);
  Serial.print(F("\",\"name\":\""));
  Serial.print(_gameName);
  Serial.print(F("\",\"tag\":\""));
  Serial.print(_tagName);
  Serial.print(F("\",\"best\":"));
  Serial.print(_stats.best);
  Serial.print(F(",\"plays\":"));
  Serial.print(_stats.plays);
  Serial.print(F(",\"hits\":"));
  Serial.print(_stats.hits);
  Serial.print(F(",\"misses\":"));
  Serial.print(_stats.misses);

  Serial.print(F(",\"last\":["));
  for (int i = 0; i < _stats.lastCount; i++) {
    if (i) Serial.print(',');
    Serial.print(_stats.last[i]);
  }
  Serial.print(F("],\"tagHits\":["));
  for (int i = 0; i < ESPLAY_TAGS; i++) {
    if (i) Serial.print(',');
    Serial.print(_stats.tagHits[i]);
  }
  Serial.print(F("],\"tagMisses\":["));
  for (int i = 0; i < ESPLAY_TAGS; i++) {
    if (i) Serial.print(',');
    Serial.print(_stats.tagMisses[i]);
  }
  Serial.println(F("]}"));
}
