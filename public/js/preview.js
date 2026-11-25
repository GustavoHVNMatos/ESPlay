// Prévia do console no navegador: tela simulada, botões e os jogos do ESPlay.
// Atenção: a tela simulada ainda usa 128x64 (OLED do primeiro protótipo) até a
// confirmação dos pinos, orientação e sketch do display LCD ST7735 128x160.

import { $, $$, zeros } from './util.js';

// TODO (hardware): ao migrar para a prévia colorida 128x160 (ou 160x128), ajustar W, H e cores aqui.
export const W = 128;
export const H = 64;
const OFF = [5, 7, 11];
const ON = [191, 227, 255];

export const reduced = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

export const fontsReady =
  document.fonts && document.fonts.load
    ? Promise.race([document.fonts.load('8px Silkscreen'), new Promise((r) => setTimeout(r, 1800))])
    : Promise.resolve();

export function normalizeAscii(str) {
  return String(str || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\x20-\x7E]/g, ' ');
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ---------- Tela ---------- */
export class Screen {
  constructor(cv) {
    this.cv = cv;
    cv.width = W;
    cv.height = H;
    this.ctx = cv.getContext('2d');
    this.off = document.createElement('canvas');
    this.off.width = W;
    this.off.height = H;
    this.g = this.off.getContext('2d', { willReadFrequently: true });
    this.g.textBaseline = 'top';
  }
  clear() {
    this.g.fillStyle = '#000';
    this.g.fillRect(0, 0, W, H);
    this.g.fillStyle = '#fff';
  }
  font(size) {
    this.g.font = 8 * (size || 1) + 'px Silkscreen, monospace';
  }
  text(x, y, s, size = 1, on = true) {
    this.font(size);
    this.g.fillStyle = on ? '#fff' : '#000';
    this.g.fillText(String(s), x, y);
  }
  measure(s, size = 1) {
    this.font(size);
    return Math.round(this.g.measureText(String(s)).width);
  }
  textCenter(cx, y, s, size = 1, on = true) {
    this.text(Math.round(cx - this.measure(s, size) / 2), y, s, size, on);
  }
  line(x0, y0, x1, y1, on = true) {
    const g = this.g;
    g.strokeStyle = on ? '#fff' : '#000';
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x0 + 0.5, y0 + 0.5);
    g.lineTo(x1 + 0.5, y1 + 0.5);
    g.stroke();
  }
  rect(x, y, w, h, on = true) {
    const g = this.g;
    g.strokeStyle = on ? '#fff' : '#000';
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  fillRect(x, y, w, h, on = true) {
    this.g.fillStyle = on ? '#fff' : '#000';
    this.g.fillRect(x, y, w, h);
  }
  tri(x0, y0, x1, y1, x2, y2, on = true) {
    const g = this.g;
    g.fillStyle = on ? '#fff' : '#000';
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.lineTo(x2, y2);
    g.closePath();
    g.fill();
  }
  wrapText(x, y, maxW, lineH, s, size = 1, on = true) {
    const words = String(s || '').split(/\s+/).filter(Boolean);
    let line = '';
    let cy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (this.measure(test, size) <= maxW || !line) {
        line = test;
      } else {
        this.text(x, cy, line, size, on);
        cy += lineH;
        line = w;
      }
    }
    if (line) {
      this.text(x, cy, line, size, on);
      cy += lineH;
    }
    return cy;
  }
  drawArrow(cx, cy, dir, on = true) {
    // 0: cima, 1: baixo, 2: esquerda, 3: direita
    if (dir === 0) {
      this.tri(cx, cy - 5, cx - 4, cy, cx + 4, cy, on);
      this.fillRect(cx - 1, cy, 3, 5, on);
    } else if (dir === 1) {
      this.tri(cx, cy + 5, cx - 4, cy, cx + 4, cy, on);
      this.fillRect(cx - 1, cy - 5, 3, 5, on);
    } else if (dir === 2) {
      this.tri(cx - 5, cy, cx, cy - 4, cx, cy + 4, on);
      this.fillRect(cx, cy - 1, 5, 3, on);
    } else {
      this.tri(cx + 5, cy, cx, cy - 4, cx, cy + 4, on);
      this.fillRect(cx - 5, cy - 1, 5, 3, on);
    }
  }
  show() {
    const d = this.g.getImageData(0, 0, W, H).data;
    const o = this.ctx.createImageData(W, H);
    for (let i = 0; i < W * H; i++) {
      const on = d[i * 4] > 110;
      o.data[i * 4] = on ? ON[0] : OFF[0];
      o.data[i * 4 + 1] = on ? ON[1] : OFF[1];
      o.data[i * 4 + 2] = on ? ON[2] : OFF[2];
      o.data[i * 4 + 3] = 255;
    }
    this.ctx.putImageData(o, 0, 0);
  }
}

/* ---------- Botões ---------- */
export class Ctl {
  constructor() { this.held = {}; this.latch = {}; this.pr = {}; this.btns = {}; }
  down(n) { if (!this.held[n]) this.latch[n] = true; this.held[n] = true; this.mark(n, true); }
  up(n) { this.held[n] = false; this.mark(n, false); }
  tap(n) { this.latch[n] = true; this.mark(n, true); setTimeout(() => this.mark(n, false), 110); }
  snap() { this.pr = this.latch; this.latch = {}; }
  pressed(n) { return !!this.pr[n]; }
  mark(n, on) { const b = this.btns[n]; if (b) b.classList.toggle('on', on); }
}

export function makeConsole(host, label) {
  host.innerHTML =
    '<div class="console"><div class="bezel"><canvas class="screen" role="img" aria-label="' + label + '"></canvas></div>' +
    '<div class="controls"><div class="dpad">' +
    '<button type="button" class="pad" data-btn="up" aria-label="Cima"></button>' +
    '<button type="button" class="pad" data-btn="left" aria-label="Esquerda"></button>' +
    '<button type="button" class="pad" data-btn="right" aria-label="Direita"></button>' +
    '<button type="button" class="pad" data-btn="down" aria-label="Baixo"></button>' +
    '</div><button type="button" class="pad act" data-btn="action" aria-label="Ação"><span>A</span></button></div></div>';
  const scr = new Screen($('canvas', host));
  const ctl = new Ctl();
  $$('.pad', host).forEach((b) => {
    const n = b.getAttribute('data-btn');
    ctl.btns[n] = b;
    b.addEventListener('pointerdown', (e) => { e.preventDefault(); ctl.down(n); });
    ['pointerup', 'pointerleave', 'pointercancel'].forEach((ev) => b.addEventListener(ev, () => ctl.up(n)));
  });
  return { scr, ctl, host };
}

/* ---------- Base comum dos jogos ---------- */
const newStats = () => ({ best: 0, plays: 0, hits: 0, misses: 0, last: [], tagHits: zeros(16), tagMisses: zeros(16) });

export class BaseGame {
  constructor(scr, cfg) {
    this.s = scr;
    this.cfg = { ...(cfg || {}) };
    this.sid = 7;
    this.stats = newStats();
    this.resetPend();
    this.tela = 'TITULO';
    this.score = 0;
    this.recorde = false;
    this.onSave = null;
  }
  resetPend() { this.pend = { hits: 0, misses: 0, th: zeros(16), tm: zeros(16) }; }
  rnd(a, b) { return a + Math.floor(Math.random() * (b - a)); }
  setCfg(c) { Object.assign(this.cfg, c); this.tela = 'TITULO'; this.resetPend(); }
  recordHit(tag) {
    this.pend.hits++;
    if (tag >= 0 && tag < 16) this.pend.th[tag]++;
  }
  recordMiss(tag) {
    this.pend.misses++;
    if (tag >= 0 && tag < 16) this.pend.tm[tag]++;
  }
  fim() {
    const st = this.stats, p = this.pend;
    this.recorde = this.score > st.best;
    if (this.recorde) st.best = this.score;
    st.plays++;
    st.hits += p.hits;
    st.misses += p.misses;
    for (let i = 0; i < 16; i++) { st.tagHits[i] += p.th[i]; st.tagMisses[i] += p.tm[i]; }
    st.last.push(this.score);
    if (st.last.length > 10) st.last.shift();
    this.resetPend();
    if (this.onSave) this.onSave();
  }
  drawRoundEnd(acertos, total) {
    const s = this.s;
    s.textCenter(W / 2, 0, 'FIM DA RODADA', 1);
    s.line(0, 10, W - 1, 10, true);
    s.text(0, 15, 'Acertos: ' + acertos + '/' + total);
    s.text(0, 26, 'Pts: ' + this.score);
    s.text(0, 38, this.recorde ? 'NOVO RECORDE!' : 'Recorde: ' + this.stats.best);
    s.textCenter(W / 2, H - 10, 'ACAO: jogar de novo', 1);
  }
  drawTopProg(cur, total, rightTxt, timerSec) {
    const s = this.s;
    const left = timerSec > 0 ? `${cur}/${total} ${timerSec}s` : `${cur}/${total}`;
    s.text(0, 0, left);
    s.text(W - s.measure(rightTxt), 0, rightTxt);
  }
  drawOptions(labels, selected, y0 = 32) {
    const s = this.s;
    labels.forEach((lbl, i) => {
      const oy = y0 + i * 10;
      if (i === selected) {
        s.fillRect(0, oy - 1, W, 9, true);
        s.text(4, oy, lbl, 1, false);
      } else {
        s.text(4, oy, lbl, 1, true);
      }
    });
  }
}

/* ---------- 1. PixelMath ---------- */
export class PixelMath extends BaseGame {
  constructor(scr, cfg) {
    super(scr, { tabuada: 0, v0: 0.5, vmax: 1.5, acc: 0.03, ...(cfg || {}) });
    this.colX = [0, 1, 2].map((i) => Math.round((W * (2 * i + 1)) / 6));
    this.startY = 12;
    this.catchY = H - 16;
    this.playerCol = 1;
    this.vel = this.cfg.v0;
    this.ansY = 0;
    this.qid = 0;
    this.ans = [0, 0, 0];
    this.correctIndex = 0;
    this.a = 1;
    this.b = 1;
    this.ultima = 0;
  }
  gerar() {
    const t = this.cfg.tabuada;
    let w1, w2, u = 0;
    this.a = t >= 1 && t <= 9 ? t : this.rnd(1, 10);
    this.b = this.rnd(1, 10);
    const c = this.a * this.b;
    do { w1 = c + this.rnd(-5, 6); } while (w1 === c || w1 < 0);
    do { w2 = c + this.rnd(-5, 6); } while (w2 === c || w2 === w1 || w2 < 0);
    this.correctIndex = this.rnd(0, 3);
    for (let i = 0; i < 3; i++) {
      if (i === this.correctIndex) this.ans[i] = c;
      else { this.ans[i] = u === 0 ? w1 : w2; u++; }
    }
    this.ansY = this.startY;
    this.qid++;
  }
  novo() {
    this.score = 0;
    this.playerCol = 1;
    this.vel = this.cfg.v0;
    this.recorde = false;
    this.resetPend();
    this.gerar();
    this.tela = 'JOGANDO';
  }
  step(ctl) {
    if (this.tela !== 'JOGANDO') { if (ctl.pressed('action')) this.novo(); return; }
    if (ctl.pressed('left') && this.playerCol > 0) this.playerCol--;
    if (ctl.pressed('right') && this.playerCol < 2) this.playerCol++;
    this.ansY += this.vel;
    if (this.ansY >= this.catchY) {
      if (this.playerCol === this.correctIndex) {
        this.score += 10;
        this.recordHit(this.a);
        this.vel = Math.min(this.cfg.vmax, this.vel + this.cfg.acc);
        this.gerar();
      } else {
        this.recordMiss(this.a);
        this.ultima = this.a * this.b;
        this.fim();
        this.tela = 'FIM';
      }
    }
  }
  draw() {
    const s = this.s;
    s.clear();
    if (this.tela === 'TITULO') {
      s.textCenter(W / 2, 0, 'PIXELMATH', 2);
      s.text(0, 22, 'Aluno: ' + this.sid);
      s.text(0, 33, 'Recorde: ' + this.stats.best);
      s.textCenter(W / 2, 52, 'Aperte ACAO');
    } else if (this.tela === 'FIM') {
      s.textCenter(W / 2, 0, 'GAME OVER', 2);
      s.text(0, 20, 'Era: ' + this.a + ' x ' + this.b + ' = ' + this.ultima);
      s.text(0, 31, 'Pts: ' + this.score);
      s.text(0, 42, this.recorde ? 'NOVO RECORDE!' : 'Recorde: ' + this.stats.best);
      s.textCenter(W / 2, 54, 'ACAO: jogar de novo');
    } else {
      s.text(0, 0, 'P:' + this.score);
      s.textCenter(W / 2 + 10, 0, this.a + ' x ' + this.b + ' = ?');
      for (let i = 0; i < 3; i++) s.textCenter(this.colX[i], Math.round(this.ansY), this.ans[i]);
      const px = this.colX[this.playerCol];
      s.tri(px - 6, H - 1, px + 6, H - 1, px, H - 7);
    }
    s.show();
  }
}

/* ---------- 2. AcentoQuest ---------- */
const ACENTO_BANCO = [
  { w: 'CAFE', t0: 2, tLen: 2, cat: 1, r: 'ULTIMA SILABA FORTE' },
  { w: 'SOFA', t0: 2, tLen: 2, cat: 1, r: 'ULTIMA SILABA FORTE' },
  { w: 'CAJU', t0: 2, tLen: 2, cat: 1, r: 'TERMINA EM U: OXITONA' },
  { w: 'ABACAXI', t0: 5, tLen: 2, cat: 1, r: 'TERMINA EM I: OXITONA' },
  { w: 'TAMBOR', t0: 3, tLen: 3, cat: 1, r: 'TERMINA EM R: OXITONA' },
  { w: 'NARIZ', t0: 2, tLen: 3, cat: 1, r: 'TERMINA EM Z: OXITONA' },
  { w: 'ANZOL', t0: 2, tLen: 3, cat: 1, r: 'TERMINA EM L: OXITONA' },
  { w: 'CORACAO', t0: 4, tLen: 3, cat: 1, r: 'TERMINA EM AO: OXITONA' },
  { w: 'PARABENS', t0: 4, tLen: 4, cat: 1, r: 'TERMINA EM ENS: OXITONA' },
  { w: 'BAMBU', t0: 3, tLen: 2, cat: 1, r: 'TERMINA EM U: OXITONA' },
  { w: 'CADERNO', t0: 2, tLen: 3, cat: 2, r: 'PENULTIMA SILABA FORTE' },
  { w: 'JANELA', t0: 2, tLen: 2, cat: 2, r: 'PENULTIMA SILABA FORTE' },
  { w: 'ESCOLA', t0: 2, tLen: 2, cat: 2, r: 'PENULTIMA SILABA FORTE' },
  { w: 'MENINO', t0: 2, tLen: 2, cat: 2, r: 'PENULTIMA SILABA FORTE' },
  { w: 'LAPIS', t0: 0, tLen: 2, cat: 2, r: 'PAROXITONA TERM. EM IS' },
  { w: 'FACIL', t0: 0, tLen: 2, cat: 2, r: 'PAROXITONA TERM. EM L' },
  { w: 'ACUCAR', t0: 1, tLen: 2, cat: 2, r: 'PAROXITONA TERM. EM R' },
  { w: 'ORGAO', t0: 0, tLen: 2, cat: 2, r: 'PAROXITONA TERM. EM AO' },
  { w: 'AMIGO', t0: 1, tLen: 2, cat: 2, r: 'PENULTIMA SILABA FORTE' },
  { w: 'LIVRO', t0: 0, tLen: 2, cat: 2, r: 'PENULTIMA SILABA FORTE' },
  { w: 'LAMPADA', t0: 0, tLen: 3, cat: 3, r: 'TODAS PROPAROXITONAS SAO ACENTUADAS' },
  { w: 'ARVORE', t0: 0, tLen: 2, cat: 3, r: 'TODAS PROPAROXITONAS SAO ACENTUADAS' },
  { w: 'PASSARO', t0: 0, tLen: 3, cat: 3, r: 'TODAS PROPAROXITONAS SAO ACENTUADAS' },
  { w: 'OCULOS', t0: 0, tLen: 1, cat: 3, r: 'TODAS PROPAROXITONAS SAO ACENTUADAS' },
  { w: 'RELAMPAGO', t0: 2, tLen: 3, cat: 3, r: 'TODAS PROPAROXITONAS SAO ACENTUADAS' },
  { w: 'TRIANGULO', t0: 3, tLen: 2, cat: 3, r: 'TODAS PROPAROXITONAS SAO ACENTUADAS' },
  { w: 'XICARA', t0: 0, tLen: 2, cat: 3, r: 'TODAS PROPAROXITONAS SAO ACENTUADAS' },
  { w: 'FOSFORO', t0: 0, tLen: 3, cat: 3, r: 'TODAS PROPAROXITONAS SAO ACENTUADAS' },
  { w: 'ABOBORA', t0: 1, tLen: 2, cat: 3, r: 'TODAS PROPAROXITONAS SAO ACENTUADAS' },
  { w: 'GRAMATICA', t0: 3, tLen: 2, cat: 3, r: 'TODAS PROPAROXITONAS SAO ACENTUADAS' },
];
const ACENTO_CATS = ['', 'OXITONA', 'PAROXITONA', 'PROPAROXITONA'];
const ACENTO_OPTS = ['1. OXITONA', '2. PAROXITONA', '3. PROPAROXITONA'];

export class AcentoQuest extends BaseGame {
  constructor(scr, cfg) {
    super(scr, { categoria: 0, total: 10, ...(cfg || {}) });
    this.pool = [];
    this.cur = 0;
    this.sel = 0;
    this.acertos = 0;
    this.wait = 0;
    this.atual = ACENTO_BANCO[0];
  }
  refillPool() {
    const f = this.cfg.categoria;
    let list = ACENTO_BANCO.filter((x) => f < 1 || f > 3 || x.cat === f);
    if (!list.length) list = ACENTO_BANCO.slice();
    this.pool = shuffle(list.slice());
  }
  proxima() {
    if (!this.pool.length) this.refillPool();
    this.atual = this.pool.pop();
    this.sel = 0;
    this.cur++;
    this.tela = 'JOGANDO';
  }
  novo() {
    this.score = 0;
    this.acertos = 0;
    this.cur = 0;
    this.recorde = false;
    this.resetPend();
    this.pool = [];
    this.proxima();
  }
  avancar() {
    if (this.cur >= (this.cfg.total || 10)) {
      this.fim();
      this.tela = 'FIM';
    } else {
      this.proxima();
    }
  }
  step(ctl) {
    if (this.tela === 'TITULO' || this.tela === 'FIM') {
      if (ctl.pressed('action')) this.novo();
      return;
    }
    if (this.tela === 'ACERTO' || this.tela === 'FEEDBACK') {
      this.wait--;
      if (this.wait <= 0 || ctl.pressed('action')) this.avancar();
      return;
    }
    if (ctl.pressed('up')) this.sel = (this.sel + 2) % 3;
    if (ctl.pressed('down')) this.sel = (this.sel + 1) % 3;
    if (ctl.pressed('action')) {
      if (this.sel + 1 === this.atual.cat) {
        this.score += 10;
        this.acertos++;
        this.recordHit(this.atual.cat);
        this.wait = 18;
        this.tela = 'ACERTO';
      } else {
        this.recordMiss(this.atual.cat);
        this.wait = 85;
        this.tela = 'FEEDBACK';
      }
    }
  }
  draw() {
    const s = this.s;
    s.clear();
    if (this.tela === 'TITULO') {
      s.textCenter(W / 2, 0, 'ACENTO', 2);
      s.textCenter(W / 2, 16, 'QUEST', 1);
      s.text(0, 28, 'Aluno: ' + this.sid);
      s.text(0, 38, 'Recorde: ' + this.stats.best);
      s.textCenter(W / 2, H - 10, 'Aperte ACAO');
    } else if (this.tela === 'FIM') {
      this.drawRoundEnd(this.acertos, this.cfg.total || 10);
    } else if (this.tela === 'ACERTO') {
      s.textCenter(W / 2, 14, 'CORRETO!', 2);
      s.textCenter(W / 2, 36, '+10 pontos', 1);
    } else if (this.tela === 'FEEDBACK') {
      const p = this.atual;
      s.text(0, 0, 'ERROU! TONICA:');
      const sz = s.measure(p.w, 2) <= W - 6 ? 2 : 1;
      const x0 = Math.round((W - s.measure(p.w, sz)) / 2);
      const pre = p.w.slice(0, p.t0);
      const ton = p.w.slice(p.t0, p.t0 + p.tLen);
      const suf = p.w.slice(p.t0 + p.tLen);
      const preW = pre ? s.measure(pre, sz) : 0;
      const tonW = s.measure(ton, sz);
      s.fillRect(x0 + preW - 1, 10, tonW + 2, 8 * sz + 2, true);
      if (pre) s.text(x0, 11, pre, sz, true);
      s.text(x0 + preW, 11, ton, sz, false);
      if (suf) s.text(x0 + preW + tonW, 11, suf, sz, true);
      s.text(0, 30, ACENTO_CATS[p.cat]);
      s.wrapText(0, 41, W, 10, p.r, 1, true);
    } else {
      this.drawTopProg(this.cur, this.cfg.total || 10, 'P:' + this.score, 0);
      const sz = s.measure(this.atual.w, 2) <= W - 6 ? 2 : 1;
      s.textCenter(W / 2, 11, this.atual.w, sz);
      s.line(0, 29, W - 1, 29, true);
      this.drawOptions(ACENTO_OPTS, this.sel, 33);
    }
    s.show();
  }
}

/* ---------- 3. CicloFis ---------- */
const CICLO_MUD = ['', 'FUSAO', 'VAPORIZACAO', 'SOLIDIFICACAO', 'CONDENSACAO', 'SUBLIMACAO'];
const CICLO_SENT = [
  '',
  'SOLIDO PARA LIQUIDO',
  'LIQUIDO PARA GASOSO',
  'LIQUIDO PARA SOLIDO',
  'GASOSO PARA LIQUIDO',
  'SOLIDO PARA GASOSO',
];
const CICLO_BANCO = [
  { t: 'Gelo derretendo no copo', c: 1 },
  { t: 'Manteiga na frigideira quente', c: 1 },
  { t: 'Sorvete derretendo ao sol', c: 1 },
  { t: 'Vela de cera derretendo', c: 1 },
  { t: 'Agua fervendo na panela', c: 2 },
  { t: 'Roupa secando no varal', c: 2 },
  { t: 'Poca de chuva sumindo ao sol', c: 2 },
  { t: 'Alcool evaporando da mao', c: 2 },
  { t: 'Agua virando gelo no freezer', c: 3 },
  { t: 'Chocolate derretido endurecendo', c: 3 },
  { t: 'Lava vulcanica virando rocha', c: 3 },
  { t: 'Cera liquida esfriando na mesa', c: 3 },
  { t: 'Gotas no copo gelado por fora', c: 4 },
  { t: 'Espelho embacado apos o banho', c: 4 },
  { t: 'Orvalho na grama de madrugada', c: 4 },
  { t: 'Nuvem formando gotas de chuva', c: 4 },
  { t: 'Naftalina sumindo no armario', c: 5 },
  { t: 'Gelo seco soltando fumaca', c: 5 },
  { t: 'Pastilha sanitaria sumindo no ar', c: 5 },
  { t: 'Neve evaporando sem virar agua', c: 5 },
];

export class CicloFis extends BaseGame {
  constructor(scr, cfg) {
    super(scr, { ativas: [1, 2, 3, 4, 5], tempo: 0, total: 10, ...(cfg || {}) });
    this.pool = [];
    this.opts = [1, 2, 3];
    this.cur = 0;
    this.sel = 0;
    this.acertos = 0;
    this.wait = 0;
    this.timer = 0;
    this.timeout = false;
    this.atual = CICLO_BANCO[0];
  }
  activeCats() {
    const a = (this.cfg.ativas || []).filter((x) => x >= 1 && x <= 5);
    return a.length ? a : [1, 2, 3, 4, 5];
  }
  refillPool() {
    const at = this.activeCats();
    this.pool = shuffle(CICLO_BANCO.filter((x) => at.includes(x.c)));
  }
  proxima() {
    if (!this.pool.length) this.refillPool();
    this.atual = this.pool.pop();
    const at = this.activeCats().filter((c) => c !== this.atual.c);
    const rest = [1, 2, 3, 4, 5].filter((c) => c !== this.atual.c && !at.includes(c));
    const cands = shuffle(at).concat(shuffle(rest));
    this.opts = shuffle([this.atual.c, cands[0], cands[1]]);
    this.sel = 0;
    this.timeout = false;
    this.timer = (this.cfg.tempo || 0) * 30;
    this.cur++;
    this.tela = 'JOGANDO';
  }
  novo() {
    this.score = 0;
    this.acertos = 0;
    this.cur = 0;
    this.recorde = false;
    this.resetPend();
    this.pool = [];
    this.proxima();
  }
  avancar() {
    if (this.cur >= (this.cfg.total || 10)) {
      this.fim();
      this.tela = 'FIM';
    } else {
      this.proxima();
    }
  }
  step(ctl) {
    if (this.tela === 'TITULO' || this.tela === 'FIM') {
      if (ctl.pressed('action')) this.novo();
      return;
    }
    if (this.tela === 'ACERTO' || this.tela === 'FEEDBACK') {
      this.wait--;
      if (this.wait <= 0 || ctl.pressed('action')) this.avancar();
      return;
    }
    if (ctl.pressed('up')) this.sel = (this.sel + 2) % 3;
    if (ctl.pressed('down')) this.sel = (this.sel + 1) % 3;
    if (this.cfg.tempo > 0) {
      this.timer--;
      if (this.timer <= 0) {
        this.recordMiss(this.atual.c);
        this.timeout = true;
        this.wait = 60;
        this.tela = 'FEEDBACK';
        return;
      }
    }
    if (ctl.pressed('action')) {
      if (this.opts[this.sel] === this.atual.c) {
        this.score += 10;
        this.acertos++;
        this.recordHit(this.atual.c);
        this.wait = 18;
        this.tela = 'ACERTO';
      } else {
        this.recordMiss(this.atual.c);
        this.timeout = false;
        this.wait = 60;
        this.tela = 'FEEDBACK';
      }
    }
  }
  draw() {
    const s = this.s;
    s.clear();
    if (this.tela === 'TITULO') {
      s.textCenter(W / 2, 0, 'CICLOFIS', 2);
      s.text(0, 22, 'Aluno: ' + this.sid);
      s.text(0, 33, 'Recorde: ' + this.stats.best);
      s.textCenter(W / 2, H - 10, 'Aperte ACAO');
    } else if (this.tela === 'FIM') {
      this.drawRoundEnd(this.acertos, this.cfg.total || 10);
    } else if (this.tela === 'ACERTO') {
      s.textCenter(W / 2, 14, 'CORRETO!', 2);
      s.textCenter(W / 2, 36, '+10 pontos', 1);
    } else if (this.tela === 'FEEDBACK') {
      s.text(0, 0, this.timeout ? 'TEMPO ESGOTADO!' : 'ERROU! ERA:');
      const nome = CICLO_MUD[this.atual.c];
      const sz = s.measure(nome, 2) <= W - 4 ? 2 : 1;
      s.textCenter(W / 2, sz === 2 ? 14 : 18, nome, sz);
      s.textCenter(W / 2, 36, CICLO_SENT[this.atual.c], 1);
      s.textCenter(W / 2, H - 10, 'Aguarde...', 1);
    } else {
      const seg = this.cfg.tempo > 0 ? Math.ceil(this.timer / 30) : 0;
      this.drawTopProg(this.cur, this.cfg.total || 10, 'P:' + this.score, seg);
      s.wrapText(0, 10, W, 9, this.atual.t, 1, true);
      s.line(0, 29, W - 1, 29, true);
      this.drawOptions(this.opts.map((c, i) => `${i + 1}. ${CICLO_MUD[c]}`), this.sel, 33);
    }
    s.show();
  }
}

/* ---------- 4. RegioMap ---------- */
const REG_NOMES = ['', 'Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
const REG_UFS = [
  { e: 'ACRE', c: 'RIO BRANCO', r: 1 },
  { e: 'AMAPA', c: 'MACAPA', r: 1 },
  { e: 'AMAZONAS', c: 'MANAUS', r: 1 },
  { e: 'PARA', c: 'BELEM', r: 1 },
  { e: 'RONDONIA', c: 'PORTO VELHO', r: 1 },
  { e: 'RORAIMA', c: 'BOA VISTA', r: 1 },
  { e: 'TOCANTINS', c: 'PALMAS', r: 1 },
  { e: 'ALAGOAS', c: 'MACEIO', r: 2 },
  { e: 'BAHIA', c: 'SALVADOR', r: 2 },
  { e: 'CEARA', c: 'FORTALEZA', r: 2 },
  { e: 'MARANHAO', c: 'SAO LUIS', r: 2 },
  { e: 'PARAIBA', c: 'JOAO PESSOA', r: 2 },
  { e: 'PERNAMBUCO', c: 'RECIFE', r: 2 },
  { e: 'PIAUI', c: 'TERESINA', r: 2 },
  { e: 'RIO GRANDE DO NORTE', c: 'NATAL', r: 2 },
  { e: 'SERGIPE', c: 'ARACAJU', r: 2 },
  { e: 'DISTRITO FEDERAL', c: 'BRASILIA', r: 3 },
  { e: 'GOIAS', c: 'GOIANIA', r: 3 },
  { e: 'MATO GROSSO', c: 'CUIABA', r: 3 },
  { e: 'MATO GROSSO DO SUL', c: 'CAMPO GRANDE', r: 3 },
  { e: 'ESPIRITO SANTO', c: 'VITORIA', r: 4 },
  { e: 'MINAS GERAIS', c: 'BELO HORIZONTE', r: 4 },
  { e: 'RIO DE JANEIRO', c: 'RIO DE JANEIRO', r: 4 },
  { e: 'SAO PAULO', c: 'SAO PAULO', r: 4 },
  { e: 'PARANA', c: 'CURITIBA', r: 5 },
  { e: 'RIO GRANDE DO SUL', c: 'PORTO ALEGRE', r: 5 },
  { e: 'SANTA CATARINA', c: 'FLORIANOPOLIS', r: 5 },
];

export class RegioMap extends BaseGame {
  constructor(scr, cfg) {
    super(scr, { regiao: 0, total: 10, ...(cfg || {}) });
    this.pool = [];
    this.lastUf = null;
    this.opts = [];
    this.cur = 0;
    this.sel = 0;
    this.acertos = 0;
    this.wait = 0;
    this.atual = REG_UFS[0];
  }
  refillPool() {
    const f = this.cfg.regiao;
    let list = REG_UFS.filter((u) => f < 1 || f > 5 || u.r === f);
    if (!list.length) list = REG_UFS.slice();
    shuffle(list);
    if (list.length > 1 && list[list.length - 1] === this.lastUf) {
      [list[0], list[list.length - 1]] = [list[list.length - 1], list[0]];
    }
    this.pool = list;
  }
  proxima() {
    if (!this.pool.length) this.refillPool();
    this.atual = this.pool.pop();
    this.lastUf = this.atual;
    const others = shuffle(REG_UFS.filter((u) => u !== this.atual));
    this.opts = shuffle([this.atual, others[0], others[1]]);
    this.sel = 0;
    this.cur++;
    this.tela = 'JOGANDO';
  }
  novo() {
    this.score = 0;
    this.acertos = 0;
    this.cur = 0;
    this.lastUf = null;
    this.recorde = false;
    this.resetPend();
    this.pool = [];
    this.proxima();
  }
  avancar() {
    if (this.cur >= (this.cfg.total || 10)) {
      this.fim();
      this.tela = 'FIM';
    } else {
      this.proxima();
    }
  }
  step(ctl) {
    if (this.tela === 'TITULO' || this.tela === 'FIM') {
      if (ctl.pressed('action')) this.novo();
      return;
    }
    if (this.tela === 'ACERTO') {
      this.wait--;
      if (this.wait <= 0 || ctl.pressed('action')) this.avancar();
      return;
    }
    if (this.tela === 'FEEDBACK') {
      if (ctl.pressed('action')) this.avancar();
      return;
    }
    if (ctl.pressed('up')) this.sel = (this.sel + 2) % 3;
    if (ctl.pressed('down')) this.sel = (this.sel + 1) % 3;
    if (ctl.pressed('action')) {
      if (this.opts[this.sel] === this.atual) {
        this.score += 10;
        this.acertos++;
        this.recordHit(this.atual.r);
        this.wait = 18;
        this.tela = 'ACERTO';
      } else {
        this.recordMiss(this.atual.r);
        this.tela = 'FEEDBACK';
      }
    }
  }
  draw() {
    const s = this.s;
    s.clear();
    if (this.tela === 'TITULO') {
      s.textCenter(W / 2, 0, 'REGIOMAP', 2);
      s.text(0, 22, 'Aluno: ' + this.sid);
      s.text(0, 33, 'Recorde: ' + this.stats.best);
      s.textCenter(W / 2, H - 10, 'Aperte ACAO');
    } else if (this.tela === 'FIM') {
      this.drawRoundEnd(this.acertos, this.cfg.total || 10);
    } else if (this.tela === 'ACERTO') {
      s.textCenter(W / 2, 14, 'CORRETO!', 2);
      s.textCenter(W / 2, 36, '+10 pontos', 1);
    } else if (this.tela === 'FEEDBACK') {
      s.text(0, 0, 'RESPOSTA CERTA:');
      s.text(0, 13, this.atual.e);
      s.text(0, 25, this.atual.c);
      s.text(0, 38, 'Regiao: ' + REG_NOMES[this.atual.r]);
      s.textCenter(W / 2, H - 10, 'ACAO: continuar');
    } else {
      this.drawTopProg(this.cur, this.cfg.total || 10, 'P:' + this.score, 0);
      s.textCenter(W / 2, 14, this.atual.e, 1);
      s.line(0, 27, W - 1, 27, true);
      this.drawOptions(this.opts.map((u, i) => `${i + 1}. ${u.c}`), this.sel, 32);
    }
    s.show();
  }
}

/* ---------- 5. Algoritmando ---------- */
const DIR_NOMES = ['CIMA', 'BAIXO', 'ESQ', 'DIR'];
const oposto = (d) => (d === 0 ? 1 : d === 1 ? 0 : d === 2 ? 3 : 2);

export class Algoritmando extends BaseGame {
  constructor(scr, cfg) {
    super(scr, { complexidade: 0, tempo: 0, total: 10, ...(cfg || {}) });
    this.seq = [0, 0, 0, 0, 0, 0];
    this.lacuna = 5;
    this.certa = 0;
    this.cat = 1;
    this.regra = '';
    this.cur = 0;
    this.acertos = 0;
    this.wait = 0;
    this.timer = 0;
    this.timeout = false;
  }
  sortearCat() {
    const c = this.cfg.complexidade;
    if (c === 1) return 1;
    if (c === 2) return this.rnd(1, 3);
    if (c === 3) return this.rnd(3, 5);
    return this.rnd(1, 5);
  }
  gerar() {
    this.cat = this.sortearCat();
    if (this.cat === 1) {
      const a = this.rnd(0, 4);
      let b;
      do { b = this.rnd(0, 4); } while (b === a);
      this.seq = [a, b, a, b, a, b];
      this.lacuna = this.rnd(4, 6);
      this.regra = `REPETE: ${DIR_NOMES[a]}, ${DIR_NOMES[b]}`;
    } else if (this.cat === 2) {
      const a = this.rnd(0, 4);
      let b, c;
      do { b = this.rnd(0, 4); } while (b === a);
      do { c = this.rnd(0, 4); } while (c === a || c === b);
      this.seq = [a, b, c, a, b, c];
      this.lacuna = this.rnd(3, 6);
      this.regra = `REPETE: ${DIR_NOMES[a]},${DIR_NOMES[b]},${DIR_NOMES[c]}`;
    } else if (this.cat === 3) {
      const a = this.rnd(0, 4), b = this.rnd(0, 4), c = this.rnd(0, 4);
      this.seq = [a, oposto(a), b, oposto(b), c, oposto(c)];
      this.lacuna = [1, 3, 5][this.rnd(0, 3)];
      this.regra = 'CADA SETA + OPOSTO';
    } else {
      const a = this.rnd(0, 4);
      let b, c;
      do { b = this.rnd(0, 4); } while (b === a);
      do { c = this.rnd(0, 4); } while (c === b);
      this.seq = [a, a, b, b, c, c];
      this.lacuna = [1, 3, 5][this.rnd(0, 3)];
      this.regra = 'EM PARES: 2x CADA';
    }
    this.certa = this.seq[this.lacuna];
    this.timeout = false;
    this.timer = (this.cfg.tempo || 0) * 30;
    this.cur++;
    this.tela = 'JOGANDO';
  }
  novo() {
    this.score = 0;
    this.acertos = 0;
    this.cur = 0;
    this.recorde = false;
    this.resetPend();
    this.gerar();
  }
  avancar() {
    if (this.cur >= (this.cfg.total || 10)) {
      this.fim();
      this.tela = 'FIM';
    } else {
      this.gerar();
    }
  }
  step(ctl) {
    if (this.tela === 'TITULO' || this.tela === 'FIM') {
      if (ctl.pressed('action')) this.novo();
      return;
    }
    if (this.tela === 'ACERTO' || this.tela === 'FEEDBACK') {
      this.wait--;
      if (this.wait <= 0 || ctl.pressed('action')) this.avancar();
      return;
    }
    if (this.cfg.tempo > 0) {
      this.timer--;
      if (this.timer <= 0) {
        this.recordMiss(this.cat);
        this.timeout = true;
        this.wait = 75;
        this.tela = 'FEEDBACK';
        return;
      }
    }
    let esc = -1;
    if (ctl.pressed('up')) esc = 0;
    else if (ctl.pressed('down')) esc = 1;
    else if (ctl.pressed('left')) esc = 2;
    else if (ctl.pressed('right')) esc = 3;
    if (esc >= 0) {
      if (esc === this.certa) {
        this.score += 10;
        this.acertos++;
        this.recordHit(this.cat);
        this.wait = 18;
        this.tela = 'ACERTO';
      } else {
        this.recordMiss(this.cat);
        this.timeout = false;
        this.wait = 75;
        this.tela = 'FEEDBACK';
      }
    }
  }
  draw() {
    const s = this.s;
    s.clear();
    if (this.tela === 'TITULO') {
      s.rect(4, 2, W - 8, 16, true);
      s.drawArrow(14, 10, 3, true);
      s.textCenter(W / 2, 6, 'ALGORITMANDO', 1);
      s.drawArrow(W - 14, 10, 2, true);
      s.text(0, 24, 'Aluno: ' + this.sid);
      s.text(0, 35, 'Recorde: ' + this.stats.best);
      s.textCenter(W / 2, H - 10, 'Aperte ACAO');
    } else if (this.tela === 'FIM') {
      this.drawRoundEnd(this.acertos, this.cfg.total || 10);
    } else if (this.tela === 'ACERTO') {
      s.textCenter(W / 2, 14, 'CORRETO!', 2);
      s.textCenter(W / 2, 36, '+10 pontos', 1);
    } else if (this.tela === 'FEEDBACK') {
      s.text(0, 0, this.timeout ? 'TEMPO ESGOTADO!' : 'ERROU!');
      s.text(0, 13, this.regra);
      s.text(0, 32, 'Seta certa:');
      s.rect(74, 26, 18, 18, true);
      s.drawArrow(83, 35, this.certa, true);
      s.text(96, 32, DIR_NOMES[this.certa]);
      s.textCenter(W / 2, H - 10, 'ACAO: continuar');
    } else {
      const seg = this.cfg.tempo > 0 ? Math.ceil(this.timer / 30) : 0;
      this.drawTopProg(this.cur, this.cfg.total || 10, 'P:' + this.score, seg);
      s.textCenter(W / 2, 12, 'Qual seta completa?', 1);
      const box = 16, gap = 3, x0 = Math.round((W - (6 * box + 5 * gap)) / 2), y0 = 26;
      for (let i = 0; i < 6; i++) {
        const bx = x0 + i * (box + gap);
        if (i === this.lacuna) {
          s.fillRect(bx, y0, box, box, true);
          s.text(bx + 5, y0 + 4, '?', 1, false);
        } else {
          s.rect(bx, y0, box, box, true);
          s.drawArrow(bx + box / 2, y0 + box / 2, this.seq[i], true);
        }
      }
      s.textCenter(W / 2, H - 10, 'Aperte a seta certa');
    }
    s.show();
  }
}

/* ---------- 6. Quiz Personalizado (Criador de jogos) ---------- */
export class CustomQuizGame extends BaseGame {
  constructor(scr, cfg) {
    super(scr, { nome: 'Meu Quiz', total: 0, tempo: 0, embaralhar: true, perguntas: [], ...(cfg || {}) });
    this.pool = [];
    this.cur = 0;
    this.sel = 0;
    this.acertos = 0;
    this.wait = 0;
    this.timer = 0;
    this.timeout = false;
    this.atual = null;
    this.roundTotal = 0;
  }
  setQuiz(cfg) {
    Object.assign(this.cfg, cfg);
    this.stats = newStats();
    this.resetPend();
    this.tela = 'TITULO';
    if (this.onSave) this.onSave();
  }
  refillPool() {
    const qs = (this.cfg.perguntas || []).filter((q) => q && q.pergunta && q.opcoes && q.opcoes.length >= 2);
    this.pool = this.cfg.embaralhar ? shuffle(qs.slice()) : qs.slice();
  }
  proxima() {
    if (!this.pool.length) this.refillPool();
    this.atual = this.pool.shift();
    this.sel = 0;
    this.timeout = false;
    this.timer = (this.cfg.tempo || 0) * 30;
    this.cur++;
    this.tela = 'JOGANDO';
  }
  novo() {
    this.refillPool();
    if (!this.pool.length) return;
    const lim = this.cfg.total || 0;
    this.roundTotal = lim > 0 ? Math.min(lim, this.pool.length) : this.pool.length;
    this.score = 0;
    this.acertos = 0;
    this.cur = 0;
    this.recorde = false;
    this.resetPend();
    this.proxima();
  }
  avancar() {
    if (this.cur >= this.roundTotal) {
      this.fim();
      this.tela = 'FIM';
    } else {
      this.proxima();
    }
  }
  step(ctl) {
    if (this.tela === 'TITULO' || this.tela === 'FIM') {
      if (ctl.pressed('action')) this.novo();
      return;
    }
    if (!this.atual) { this.tela = 'TITULO'; return; }
    const nOpts = this.atual.opcoes.length;
    if (this.tela === 'ACERTO') {
      this.wait--;
      if (this.wait <= 0 || ctl.pressed('action')) this.avancar();
      return;
    }
    if (this.tela === 'FEEDBACK') {
      if (ctl.pressed('action')) this.avancar();
      return;
    }
    if (ctl.pressed('up')) this.sel = (this.sel + nOpts - 1) % nOpts;
    if (ctl.pressed('down')) this.sel = (this.sel + 1) % nOpts;
    if (this.cfg.tempo > 0) {
      this.timer--;
      if (this.timer <= 0) {
        this.recordMiss(this.atual.cat || 1);
        this.timeout = true;
        this.tela = 'FEEDBACK';
        return;
      }
    }
    if (ctl.pressed('action')) {
      if (this.sel === this.atual.correta) {
        this.score += 10;
        this.acertos++;
        this.recordHit(this.atual.cat || 1);
        this.wait = 18;
        this.tela = 'ACERTO';
      } else {
        this.recordMiss(this.atual.cat || 1);
        this.timeout = false;
        this.tela = 'FEEDBACK';
      }
    }
  }
  draw() {
    const s = this.s;
    s.clear();
    const title = normalizeAscii(this.cfg.nome || 'MEU QUIZ').toUpperCase();
    const nQs = (this.cfg.perguntas || []).filter((q) => q && q.pergunta).length;
    if (this.tela === 'TITULO') {
      const sz = s.measure(title, 2) <= W - 4 ? 2 : 1;
      s.textCenter(W / 2, sz === 2 ? 0 : 4, title.slice(0, 20), sz);
      s.text(0, 22, 'Aluno: ' + this.sid);
      s.text(0, 32, 'Recorde: ' + this.stats.best);
      s.textCenter(W / 2, H - 10, nQs ? 'Aperte ACAO' : 'Sem perguntas');
    } else if (this.tela === 'FIM') {
      this.drawRoundEnd(this.acertos, this.roundTotal || 1);
    } else if (this.tela === 'ACERTO') {
      s.textCenter(W / 2, 14, 'CORRETO!', 2);
      s.textCenter(W / 2, 36, '+10 pontos', 1);
    } else if (this.tela === 'FEEDBACK' && this.atual) {
      s.text(0, 0, this.timeout ? 'TEMPO ESGOTADO!' : 'RESPOSTA CERTA:');
      const certa = normalizeAscii(this.atual.opcoes[this.atual.correta] || '');
      s.wrapText(0, 12, W, 10, certa, 1, true);
      if (this.atual.explicacao) {
        s.wrapText(0, 26, W, 10, normalizeAscii(this.atual.explicacao), 1, true);
      }
      s.textCenter(W / 2, H - 10, 'ACAO: continuar');
    } else if (this.atual) {
      const seg = this.cfg.tempo > 0 ? Math.ceil(this.timer / 30) : 0;
      this.drawTopProg(this.cur, this.roundTotal, 'P:' + this.score, seg);
      s.wrapText(0, 10, W, 9, normalizeAscii(this.atual.pergunta), 1, true);
      s.line(0, 29, W - 1, 29, true);
      const opts = this.atual.opcoes.map((o, i) => `${i + 1}. ${normalizeAscii(o).slice(0, 17)}`);
      this.drawOptions(opts, this.sel, 33);
    }
    s.show();
  }
}

export const GAMES_BY_PREVIEW = {
  pixelmath: PixelMath,
  acentoquest: AcentoQuest,
  ciclofis: CicloFis,
  regiomap: RegioMap,
  algoritmando: Algoritmando,
};

/* ---------- Laço de execução (30 quadros por segundo) ---------- */
const runners = [];
const STEP = 1000 / 30;
let lastT = 0;
let acc = 0;
let started = false;

function loop(t) {
  if (!lastT) lastT = t;
  acc += t - lastT;
  lastT = t;
  if (acc > 250) acc = 250;
  let n = 0;
  while (acc >= STEP) {
    acc -= STEP;
    n++;
    for (const r of runners) {
      if (!r.visible) continue;
      if (r.bot) r.bot();
      r.con.ctl.snap();
      r.game.step(r.con.ctl);
    }
  }
  if (n) for (const r of runners) if (r.visible) r.game.draw();
  requestAnimationFrame(loop);
}

export function addRunner(con, game, bot) {
  const r = { con, game, bot, visible: true };
  runners.push(r);
  if ('IntersectionObserver' in window) {
    new IntersectionObserver((es) => {
      r.visible = es[0].isIntersecting;
      if (r.visible) game.draw();
    }).observe(con.host);
  }
  game.draw();
  return r;
}

export function startLoop() {
  if (started) return;
  started = true;
  requestAnimationFrame(loop);
}
