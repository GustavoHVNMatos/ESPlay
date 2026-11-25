// Prévia colorida do console ESPlay no navegador: tela ST7735S 160x128 (modo paisagem),
// botões (UP=32, DOWN=33, LEFT=26, RIGHT=27, ACTION=25), os 5 jogos autorais, Quiz e Menu.

import { $, $$, zeros } from './util.js';

export const W = 160;
export const H = 128;

export const COL = {
  BG: '#000000',
  WHITE: '#FFFFFF',
  YELLOW: '#FFE600',
  CYAN: '#00E5FF',
  GREEN: '#22E55A',
  RED: '#FF3838',
  BLUE: '#2563EB',
  ORANGE: '#FF9500',
  GRAY: '#8A94A6',
  DKGRAY: '#3A4252',
};

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

/* ---------- Tela ST7735S 160x128 colorida ---------- */
export class Screen {
  constructor(cv) {
    this.cv = cv;
    cv.width = W;
    cv.height = H;
    this.g = cv.getContext('2d');
    this.g.textBaseline = 'top';
    this.g.imageSmoothingEnabled = false;
  }
  clear(color = COL.BG) {
    this.g.fillStyle = color;
    this.g.fillRect(0, 0, W, H);
  }
  font(size) {
    this.g.font = 8 * (size || 1) + 'px Silkscreen, monospace';
  }
  text(x, y, s, size = 1, color = COL.WHITE) {
    this.font(size);
    this.g.fillStyle = color;
    this.g.fillText(String(s), x, y);
  }
  measure(s, size = 1) {
    this.font(size);
    return Math.round(this.g.measureText(String(s)).width);
  }
  textCenter(cx, y, s, size = 1, color = COL.WHITE) {
    this.text(Math.round(cx - this.measure(s, size) / 2), y, s, size, color);
  }
  line(x0, y0, x1, y1, color = COL.WHITE) {
    const g = this.g;
    g.strokeStyle = color;
    g.lineWidth = 1;
    g.beginPath();
    g.moveTo(x0 + 0.5, y0 + 0.5);
    g.lineTo(x1 + 0.5, y1 + 0.5);
    g.stroke();
  }
  rect(x, y, w, h, color = COL.WHITE) {
    const g = this.g;
    g.strokeStyle = color;
    g.lineWidth = 1;
    g.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
  }
  fillRect(x, y, w, h, color = COL.WHITE) {
    this.g.fillStyle = color;
    this.g.fillRect(x, y, w, h);
  }
  _rrPath(x, y, w, h, r) {
    const g = this.g;
    const rad = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + rad, y);
    g.lineTo(x + w - rad, y);
    g.quadraticCurveTo(x + w, y, x + w, y + rad);
    g.lineTo(x + w, y + h - rad);
    g.quadraticCurveTo(x + w, y + h, x + w - rad, y + h);
    g.lineTo(x + rad, y + h);
    g.quadraticCurveTo(x, y + h, x, y + h - rad);
    g.lineTo(x, y + rad);
    g.quadraticCurveTo(x, y, x + rad, y);
    g.closePath();
  }
  roundRect(x, y, w, h, r, color = COL.WHITE) {
    this.g.strokeStyle = color;
    this.g.lineWidth = 1;
    this._rrPath(x + 0.5, y + 0.5, w - 1, h - 1, r);
    this.g.stroke();
  }
  fillRoundRect(x, y, w, h, r, color = COL.WHITE) {
    this.g.fillStyle = color;
    this._rrPath(x, y, w, h, r);
    this.g.fill();
  }
  tri(x0, y0, x1, y1, x2, y2, color = COL.WHITE) {
    const g = this.g;
    g.fillStyle = color;
    g.beginPath();
    g.moveTo(x0, y0);
    g.lineTo(x1, y1);
    g.lineTo(x2, y2);
    g.closePath();
    g.fill();
  }
  wrapText(x, y, maxW, lineH, s, size = 1, color = COL.WHITE) {
    const words = String(s || '').split(/\s+/).filter(Boolean);
    let line = '';
    let cy = y;
    for (const w of words) {
      const test = line ? line + ' ' + w : w;
      if (this.measure(test, size) <= maxW || !line) {
        line = test;
      } else {
        this.text(x, cy, line, size, color);
        cy += lineH;
        line = w;
      }
    }
    if (line) {
      this.text(x, cy, line, size, color);
      cy += lineH;
    }
    return cy;
  }
  drawArrow(cx, cy, dir, color = COL.WHITE) {
    if (dir === 0) {
      this.tri(cx, cy - 6, cx - 5, cy, cx + 5, cy, color);
      this.fillRect(cx - 2, cy, 5, 6, color);
    } else if (dir === 1) {
      this.tri(cx, cy + 6, cx - 5, cy, cx + 5, cy, color);
      this.fillRect(cx - 2, cy - 6, 5, 6, color);
    } else if (dir === 2) {
      this.tri(cx - 6, cy, cx, cy - 5, cx, cy + 5, color);
      this.fillRect(cx, cy - 2, 6, 5, color);
    } else {
      this.tri(cx + 6, cy, cx, cy - 5, cx, cy + 5, color);
      this.fillRect(cx - 6, cy - 2, 6, 5, color);
    }
  }
  show() { /* renderização direta em cores no canvas */ }
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
  drawTitle(titulo, subtitulo) {
    const s = this.s;
    const sz = s.measure(titulo, 2) <= W - 12 ? 2 : 1;
    s.textCenter(W / 2, sz === 2 ? 12 : 16, titulo, sz, COL.CYAN);
    s.textCenter(W / 2, 36, subtitulo, 1, COL.GRAY);
    s.textCenter(W / 2, 58, 'Aluno: ' + this.sid, 1, COL.WHITE);
    s.textCenter(W / 2, 74, 'Recorde: ' + this.stats.best, 1, COL.YELLOW);
    s.textCenter(W / 2, 104, 'Aperte ACAO', 1, COL.GREEN);
  }
  drawRoundEnd(acertos, total) {
    const s = this.s;
    s.textCenter(W / 2, 10, 'FIM DA RODADA', 1, COL.CYAN);
    s.line(0, 22, W - 1, 22, COL.DKGRAY);
    s.textCenter(W / 2, 34, 'Acertos: ' + acertos + '/' + total, 1, COL.WHITE);
    s.textCenter(W / 2, 52, 'Pts: ' + this.score, 2, COL.YELLOW);
    s.textCenter(W / 2, 76, this.recorde ? 'NOVO RECORDE!' : 'Recorde: ' + this.stats.best, 1, this.recorde ? COL.GREEN : COL.WHITE);
    s.textCenter(W / 2, 106, 'ACAO: jogar de novo', 1, COL.GREEN);
  }
  drawTopProg(cur, total, rightTxt, timerSec) {
    const s = this.s;
    const left = timerSec > 0 ? `${cur}/${total}  ${timerSec}s` : `${cur}/${total}`;
    s.text(4, 4, left, 1, timerSec > 0 && timerSec <= 3 ? COL.RED : COL.WHITE);
    s.text(W - s.measure(rightTxt) - 4, 4, rightTxt, 1, COL.YELLOW);
    s.line(0, 15, W - 1, 15, COL.DKGRAY);
  }
  drawOptions(labels, selected, y0 = 56, step = 22, h = 18) {
    const s = this.s;
    labels.forEach((lbl, i) => {
      const oy = y0 + i * step;
      if (i === selected) {
        s.fillRoundRect(6, oy, W - 12, h, 4, COL.BLUE);
        s.roundRect(6, oy, W - 12, h, 4, COL.CYAN);
        s.text(14, oy + Math.round((h - 8) / 2), lbl, 1, COL.WHITE);
      } else {
        s.roundRect(6, oy, W - 12, h, 4, COL.DKGRAY);
        s.text(14, oy + Math.round((h - 8) / 2), lbl, 1, COL.GRAY);
      }
    });
  }
}

/* ---------- 1. PixelMath ---------- */
export class PixelMath extends BaseGame {
  constructor(scr, cfg) {
    super(scr, { tabuada: 0, v0: 0.8, vmax: 2.2, acc: 0.05, ...(cfg || {}) });
    this.colX = [27, 80, 133];
    this.startY = 24;
    this.catchY = H - 28;
    this.playerCol = 1;
    this.vel = this.cfg.v0;
    this.ansY = this.startY;
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
      this.drawTitle('PIXELMATH', 'Tabuada em 3 colunas');
    } else if (this.tela === 'FIM') {
      s.textCenter(W / 2, 10, 'GAME OVER', 2, COL.RED);
      s.textCenter(W / 2, 38, 'Era: ' + this.a + ' x ' + this.b + ' = ' + this.ultima, 1, COL.YELLOW);
      s.textCenter(W / 2, 56, 'Pts: ' + this.score, 2, COL.WHITE);
      s.textCenter(W / 2, 80, this.recorde ? 'NOVO RECORDE!' : 'Recorde: ' + this.stats.best, 1, this.recorde ? COL.GREEN : COL.YELLOW);
      s.textCenter(W / 2, 106, 'ACAO: jogar de novo', 1, COL.GREEN);
    } else {
      s.text(4, 4, 'P:' + this.score, 1, COL.WHITE);
      const conta = this.a + ' x ' + this.b + ' = ?';
      s.text(W - s.measure(conta, 2) - 4, 2, conta, 2, COL.CYAN);
      s.line(0, 19, W - 1, 19, COL.DKGRAY);
      for (let i = 0; i < 3; i++) {
        s.textCenter(this.colX[i], Math.round(this.ansY), this.ans[i], 2, COL.YELLOW);
      }
      const px = this.colX[this.playerCol];
      s.tri(px - 8, H - 3, px + 8, H - 3, px, H - 15, COL.GREEN);
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
      this.drawTitle('ACENTOQUEST', 'Tonicidade das palavras');
    } else if (this.tela === 'FIM') {
      this.drawRoundEnd(this.acertos, this.cfg.total || 10);
    } else if (this.tela === 'ACERTO') {
      s.textCenter(W / 2, 44, 'CORRETO!', 2, COL.GREEN);
      s.textCenter(W / 2, 72, '+10 pontos', 1, COL.YELLOW);
    } else if (this.tela === 'FEEDBACK') {
      const p = this.atual;
      s.textCenter(W / 2, 6, 'ERROU! SILABA TONICA:', 1, COL.RED);
      const sz = s.measure(p.w, 2) <= W - 12 ? 2 : 1;
      const x0 = Math.round((W - s.measure(p.w, sz)) / 2);
      const pre = p.w.slice(0, p.t0);
      const ton = p.w.slice(p.t0, p.t0 + p.tLen);
      const suf = p.w.slice(p.t0 + p.tLen);
      const preW = pre ? s.measure(pre, sz) : 0;
      const tonW = s.measure(ton, sz);
      s.fillRoundRect(x0 + preW - 2, 22, tonW + 4, 8 * sz + 4, 3, COL.YELLOW);
      if (pre) s.text(x0, 24, pre, sz, COL.WHITE);
      s.text(x0 + preW, 24, ton, sz, COL.BG);
      if (suf) s.text(x0 + preW + tonW, 24, suf, sz, COL.WHITE);
      s.textCenter(W / 2, 52, ACENTO_CATS[p.cat], 1, COL.CYAN);
      s.wrapText(8, 68, W - 16, 11, p.r, 1, COL.WHITE);
      s.textCenter(W / 2, 112, 'ACAO: continuar', 1, COL.GRAY);
    } else {
      this.drawTopProg(this.cur, this.cfg.total || 10, 'Pts:' + this.score, 0);
      const sz = s.measure(this.atual.w, 2) <= W - 12 ? 2 : 1;
      s.textCenter(W / 2, sz === 2 ? 26 : 30, this.atual.w, sz, COL.CYAN);
      this.drawOptions(ACENTO_OPTS, this.sel, 56, 22, 18);
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
      this.drawTitle('CICLOFIS', 'Mudancas de estado fisico');
    } else if (this.tela === 'FIM') {
      this.drawRoundEnd(this.acertos, this.cfg.total || 10);
    } else if (this.tela === 'ACERTO') {
      s.textCenter(W / 2, 44, 'CORRETO!', 2, COL.GREEN);
      s.textCenter(W / 2, 72, '+10 pontos', 1, COL.YELLOW);
    } else if (this.tela === 'FEEDBACK') {
      s.textCenter(W / 2, 10, this.timeout ? 'TEMPO ESGOTADO!' : 'ERROU! ERA:', 1, COL.RED);
      const nome = CICLO_MUD[this.atual.c];
      const sz = s.measure(nome, 2) <= W - 12 ? 2 : 1;
      s.textCenter(W / 2, sz === 2 ? 32 : 36, nome, sz, COL.YELLOW);
      s.textCenter(W / 2, 66, CICLO_SENT[this.atual.c], 1, COL.CYAN);
      s.textCenter(W / 2, 108, 'Aguarde...', 1, COL.GRAY);
    } else {
      const seg = this.cfg.tempo > 0 ? Math.ceil(this.timer / 30) : 0;
      this.drawTopProg(this.cur, this.cfg.total || 10, 'Pts:' + this.score, seg);
      s.wrapText(6, 22, W - 12, 11, this.atual.t, 1, COL.WHITE);
      this.drawOptions(this.opts.map((c, i) => `${i + 1}. ${CICLO_MUD[c]}`), this.sel, 56, 22, 18);
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
      this.drawTitle('REGIOMAP', 'Estados e capitais');
    } else if (this.tela === 'FIM') {
      this.drawRoundEnd(this.acertos, this.cfg.total || 10);
    } else if (this.tela === 'ACERTO') {
      s.textCenter(W / 2, 44, 'CORRETO!', 2, COL.GREEN);
      s.textCenter(W / 2, 72, '+10 pontos', 1, COL.YELLOW);
    } else if (this.tela === 'FEEDBACK') {
      s.textCenter(W / 2, 10, 'RESPOSTA CERTA:', 1, COL.RED);
      s.textCenter(W / 2, 32, this.atual.e, 1, COL.WHITE);
      const sz = s.measure(this.atual.c, 2) <= W - 12 ? 2 : 1;
      s.textCenter(W / 2, 52, this.atual.c, sz, COL.GREEN);
      s.textCenter(W / 2, 80, 'Regiao: ' + REG_NOMES[this.atual.r], 1, COL.YELLOW);
      s.textCenter(W / 2, 108, 'ACAO: continuar', 1, COL.GRAY);
    } else {
      this.drawTopProg(this.cur, this.cfg.total || 10, 'Pts:' + this.score, 0);
      s.textCenter(W / 2, 28, this.atual.e, 1, COL.YELLOW);
      this.drawOptions(this.opts.map((u, i) => `${i + 1}. ${u.c}`), this.sel, 52, 23, 19);
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
      s.roundRect(4, 8, W - 8, 24, 5, COL.CYAN);
      s.drawArrow(15, 20, 3, COL.YELLOW);
      s.textCenter(W / 2, 16, 'ALGORITMANDO', 1, COL.WHITE);
      s.drawArrow(W - 15, 20, 2, COL.YELLOW);
      s.textCenter(W / 2, 44, 'Sequencias Logicas', 1, COL.GRAY);
      s.textCenter(W / 2, 62, 'Aluno: ' + this.sid, 1, COL.WHITE);
      s.textCenter(W / 2, 78, 'Recorde: ' + this.stats.best, 1, COL.YELLOW);
      s.textCenter(W / 2, 104, 'Aperte ACAO', 1, COL.GREEN);
    } else if (this.tela === 'FIM') {
      s.textCenter(W / 2, 8, 'FIM DA PARTIDA', 1, COL.CYAN);
      s.line(0, 20, W - 1, 20, COL.DKGRAY);
      s.textCenter(W / 2, 32, 'Acertos: ' + this.acertos + '/' + (this.cfg.total || 10), 1, COL.WHITE);
      s.textCenter(W / 2, 50, 'Pts: ' + this.score, 2, COL.YELLOW);
      s.textCenter(W / 2, 74, this.recorde ? 'NOVO RECORDE!' : 'Recorde: ' + this.stats.best, 1, this.recorde ? COL.GREEN : COL.WHITE);
      s.textCenter(W / 2, 104, 'ACAO: jogar de novo', 1, COL.GREEN);
    } else if (this.tela === 'ACERTO') {
      s.textCenter(W / 2, 44, 'CORRETO!', 2, COL.GREEN);
      s.textCenter(W / 2, 72, '+10 pontos', 1, COL.YELLOW);
    } else if (this.tela === 'FEEDBACK') {
      s.textCenter(W / 2, this.timeout ? 10 : 8, this.timeout ? 'TEMPO ESGOTADO!' : 'ERROU!', this.timeout ? 1 : 2, COL.RED);
      s.textCenter(W / 2, 32, this.regra, 1, COL.YELLOW);
      s.text(18, 63, 'Seta certa:', 1, COL.WHITE);
      s.roundRect(88, 54, 24, 24, 4, COL.GREEN);
      s.drawArrow(100, 66, this.certa, COL.GREEN);
      s.text(118, 63, DIR_NOMES[this.certa], 1, COL.GREEN);
      s.textCenter(W / 2, 108, 'ACAO: continuar', 1, COL.GRAY);
    } else {
      const seg = this.cfg.tempo > 0 ? Math.ceil(this.timer / 30) : 0;
      this.drawTopProg(this.cur, this.cfg.total || 10, 'Pts:' + this.score, seg);
      s.textCenter(W / 2, 26, 'Qual seta completa?', 1, COL.WHITE);
      const box = 22, gap = 4, x0 = Math.round((W - (6 * box + 5 * gap)) / 2), y0 = 50;
      for (let i = 0; i < 6; i++) {
        const bx = x0 + i * (box + gap);
        if (i === this.lacuna) {
          s.fillRoundRect(bx, y0, box, box, 3, COL.YELLOW);
          s.text(bx + 6, y0 + 4, '?', 2, COL.BG);
        } else {
          s.roundRect(bx, y0, box, box, 3, COL.CYAN);
          s.drawArrow(bx + box / 2, y0 + box / 2, this.seq[i], COL.WHITE);
        }
      }
      s.textCenter(W / 2, 98, 'Aperte a seta certa', 1, COL.CYAN);
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
      const sz = s.measure(title, 2) <= W - 12 ? 2 : 1;
      s.textCenter(W / 2, sz === 2 ? 12 : 16, title.slice(0, 22), sz, COL.CYAN);
      s.textCenter(W / 2, 36, 'Quiz personalizado', 1, COL.GRAY);
      s.textCenter(W / 2, 58, 'Aluno: ' + this.sid, 1, COL.WHITE);
      s.textCenter(W / 2, 74, 'Recorde: ' + this.stats.best, 1, COL.YELLOW);
      s.textCenter(W / 2, 104, nQs ? 'Aperte ACAO' : 'Sem perguntas', 1, nQs ? COL.GREEN : COL.RED);
    } else if (this.tela === 'FIM') {
      this.drawRoundEnd(this.acertos, this.roundTotal || 1);
    } else if (this.tela === 'ACERTO') {
      s.textCenter(W / 2, 44, 'CORRETO!', 2, COL.GREEN);
      s.textCenter(W / 2, 72, '+10 pontos', 1, COL.YELLOW);
    } else if (this.tela === 'FEEDBACK' && this.atual) {
      s.textCenter(W / 2, 10, this.timeout ? 'TEMPO ESGOTADO!' : 'RESPOSTA CERTA:', 1, COL.RED);
      const certa = normalizeAscii(this.atual.opcoes[this.atual.correta] || '');
      s.wrapText(8, 30, W - 16, 11, certa, 1, COL.GREEN);
      if (this.atual.explicacao) {
        s.wrapText(8, 62, W - 16, 11, normalizeAscii(this.atual.explicacao), 1, COL.WHITE);
      }
      s.textCenter(W / 2, 108, 'ACAO: continuar', 1, COL.GRAY);
    } else if (this.atual) {
      const seg = this.cfg.tempo > 0 ? Math.ceil(this.timer / 30) : 0;
      this.drawTopProg(this.cur, this.roundTotal, 'Pts:' + this.score, seg);
      s.wrapText(6, 20, W - 12, 10, normalizeAscii(this.atual.pergunta), 1, COL.WHITE);
      const opts = this.atual.opcoes.map((o, i) => `${i + 1}. ${normalizeAscii(o).slice(0, 20)}`);
      this.drawOptions(opts, this.sel, 56, 22, 18);
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

/* ---------- 7. Modo Menu Multi-Jogos (opcional, somente jogos autorais) ---------- */
export class MenuGame {
  constructor(scr, items) {
    this.s = scr;
    this.items = [];
    this.menuIdx = 0;
    this.active = null;
    this.holdFrames = 0;
    this.onChange = null;
    this.setItems(items || []);
  }
  setItems(items) {
    const oldStats = new Map(this.items.map((it) => [it.id, it.game.stats]));
    this.items = items.map((it) => {
      const g = new it.Cls(this.s, it.cfg || {});
      if (oldStats.has(it.id)) g.stats = oldStats.get(it.id);
      g.onSave = () => { if (this.onChange) this.onChange(); };
      return { ...it, game: g };
    });
    this.menuIdx = 0;
    this.active = null;
    this.holdFrames = 0;
    if (this.onChange) this.onChange();
  }
  backToMenu() {
    if (!this.active) return;
    this.active = null;
    this.holdFrames = 0;
    this.draw();
    if (this.onChange) this.onChange();
  }
  step(ctl) {
    if (!this.items.length) return;
    if (!this.active) {
      if (ctl.pressed('up')) this.menuIdx = (this.menuIdx + this.items.length - 1) % this.items.length;
      if (ctl.pressed('down')) this.menuIdx = (this.menuIdx + 1) % this.items.length;
      if (ctl.pressed('action')) {
        this.active = this.items[this.menuIdx];
        this.active.game.tela = 'TITULO';
        this.holdFrames = 0;
      }
      return;
    }
    if (ctl.held.action) {
      this.holdFrames++;
      if (this.holdFrames >= 60) { this.backToMenu(); return; }
    } else {
      this.holdFrames = 0;
    }
    this.active.game.step(ctl);
  }
  draw() {
    if (this.active) {
      this.active.game.draw();
      return;
    }
    const s = this.s;
    s.clear();
    s.textCenter(W / 2, 7, 'ESPLAY', 2, COL.RED);
    s.textCenter(W / 2, 5, 'ESPLAY', 2, COL.YELLOW);

    const n = this.items.length;
    const h = n >= 5 ? 16 : 19;
    const step = n >= 5 ? 18 : 22;
    const y0 = 24;

    this.items.forEach((it, i) => {
      const y = y0 + i * step;
      const sel = i === this.menuIdx;
      if (sel) {
        s.fillRoundRect(10, y, 140, h, 4, COL.BLUE);
        s.roundRect(10, y, 140, h, 4, COL.CYAN);
        s.textCenter(W / 2, y + Math.round((h - 8) / 2), it.nome.toUpperCase(), 1, COL.WHITE);
        s.tri(17, y + 4, 17, y + h - 4, 24, y + Math.round(h / 2), COL.YELLOW);
      } else {
        s.roundRect(10, y, 140, h, 4, COL.DKGRAY);
        s.textCenter(W / 2, y + Math.round((h - 8) / 2), it.nome.toUpperCase(), 1, COL.GRAY);
      }
    });

    const cur = this.items[this.menuIdx];
    const rec = cur ? cur.game.stats.best : 0;
    s.textCenter(W / 2, 114, `Rec ${cur ? cur.nome : ''}: ${rec}`, 1, COL.YELLOW);
    s.show();
  }
}

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
