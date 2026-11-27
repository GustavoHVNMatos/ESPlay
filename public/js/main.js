// Ponto de entrada: liga a prévia da página inicial, visualizador 3D, biblioteca, modo menu, criador de jogos e painel.

import { $, loadGames } from './util.js';
import { makeConsole, PixelMath, addRunner, startLoop, fontsReady, reduced } from './preview.js';
import { initLibrary } from './library.js';
import { initMenu } from './menu.js';
import { initCreator } from './creator.js';
import { initPainel } from './painel.js';
import { initStlViewer } from './stlviewer.js';

// Console da página inicial: joga sozinho e erra de vez em quando.
function initHero() {
  const con = makeConsole($('#hero-console'), 'Tela colorida 160x128 do console jogando PixelMath');
  const game = new PixelMath(con.scr, { v0: 1.0, vmax: 2.2 });
  let wait = 0, lastQ = -1, target = 1, tick = 0;
  const bot = () => {
    if (reduced) return;
    if (game.tela !== 'JOGANDO') {
      if (++wait > 50) { wait = 0; con.ctl.tap('action'); }
      return;
    }
    if (game.qid !== lastQ) {
      lastQ = game.qid;
      target = Math.random() < 0.07 ? (game.correctIndex + 1) % 3 : game.correctIndex;
    }
    if (++tick % 6 === 0) {
      if (game.playerCol < target) con.ctl.tap('right');
      else if (game.playerCol > target) con.ctl.tap('left');
    }
  };
  addRunner(con, game, bot);
}

// Roteamento de teclado entre Biblioteca, Modo Menu e Criador de jogos.
function bindKeyboard(targets) {
  let active = 'lib';

  targets.forEach((t) => {
    const sec = $(t.selector);
    if (sec) sec.addEventListener('pointerdown', () => { active = t.id; });
  });

  const pickConsole = () => {
    const pref = targets.find((t) => t.id === active && t.isReady());
    if (pref) return pref.ref.console;
    const any = targets.find((t) => t.isReady());
    return any ? any.ref.console : null;
  };

  const keyMap = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

  document.addEventListener('keydown', (e) => {
    const tg = e.target && e.target.tagName;
    if (tg === 'INPUT' || tg === 'TEXTAREA' || tg === 'SELECT') return;
    let m = keyMap[e.key];
    if (!m && (e.key === ' ' || e.key === 'Spacebar') && tg !== 'BUTTON' && tg !== 'A') m = 'action';
    if (!m) return;
    const con = pickConsole();
    if (!con) return;
    if (e.repeat) { e.preventDefault(); return; }
    e.preventDefault();
    con.ctl.down(m);
  });

  document.addEventListener('keyup', (e) => {
    const m = keyMap[e.key] || (e.key === ' ' || e.key === 'Spacebar' ? 'action' : null);
    if (!m) return;
    targets.forEach((t) => { if (t.ref && t.ref.console) t.ref.console.ctl.up(m); });
  });
}

function initTheme() {
  const btn = $('#btn-theme');
  if (!btn) return;
  const apply = (mode) => {
    if (mode === 'dark' || mode === 'light') document.documentElement.setAttribute('data-theme', mode);
    else document.documentElement.removeAttribute('data-theme');
    const isDark = mode === 'dark' || (!mode && matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    btn.textContent = isDark ? 'Tema: Escuro' : 'Tema: Claro';
    btn.setAttribute('aria-pressed', String(isDark));
  };
  let saved = '';
  try { saved = localStorage.getItem('esplay.theme') || ''; } catch (e) { /* ignora */ }
  apply(saved);
  btn.addEventListener('click', () => {
    const curDark = document.documentElement.getAttribute('data-theme') === 'dark' ||
      (!document.documentElement.getAttribute('data-theme') && matchMedia && matchMedia('(prefers-color-scheme: dark)').matches);
    const next = curDark ? 'light' : 'dark';
    try { localStorage.setItem('esplay.theme', next); } catch (e) { /* ignora */ }
    apply(next);
  });
}

async function main() {
  initTheme();
  if (location.protocol === 'https:' && 'serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  }
  const [data] = await Promise.all([loadGames(), fontsReady]);
  const games = data.games || [];

  initHero();
  initStlViewer($('#stl-viewer'), 'downloads/CaseESPboyV5.stl');
  const painel = initPainel({ games });
  const send = (r) => painel.addReading(r, { focusGame: true });

  const lib = initLibrary({ games, makeConsole, addRunner, onSend: send });
  const menu = initMenu({ makeConsole, addRunner, onSend: send });
  const creator = initCreator({
    makeConsole,
    addRunner,
    onSend: send,
    onRegisterMeta: (meta, opts) => painel.registerGameMeta(meta, opts),
  });

  bindKeyboard([
    { id: 'lib', selector: '#biblioteca', ref: lib, isReady: () => lib && lib.runner.visible && !$('#detail-play').hidden },
    { id: 'menu', selector: '#menu-jogos', ref: menu, isReady: () => menu && menu.runner.visible },
    { id: 'creator', selector: '#criador', ref: creator, isReady: () => creator && creator.runner.visible },
  ]);
  startLoop();
}

main();
