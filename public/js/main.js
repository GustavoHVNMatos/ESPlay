// Ponto de entrada: liga a prévia da página inicial, a biblioteca, o criador de jogos e o painel do professor.

import { $, loadGames } from './util.js';
import { makeConsole, PixelMath, addRunner, startLoop, fontsReady, reduced } from './preview.js';
import { initLibrary } from './library.js';
import { initCreator } from './creator.js';
import { initPainel } from './painel.js';
import { initStlViewer } from './stlviewer.js';

// Console da página inicial: joga sozinho e erra de vez em quando.
function initHero() {
  const con = makeConsole($('#hero-console'), 'Tela do console jogando PixelMath');
  const game = new PixelMath(con.scr, { v0: 0.9, vmax: 1.6 });
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

// Roteamento de teclado entre a prévia da Biblioteca e a prévia do Criador de jogos.
function bindKeyboard(lib, creator) {
  let active = 'lib';
  const libSec = $('#biblioteca');
  const crSec = $('#criador');

  if (libSec) libSec.addEventListener('pointerdown', () => { active = 'lib'; });
  if (crSec) crSec.addEventListener('pointerdown', () => { active = 'creator'; });

  const pickConsole = () => {
    const libVisible = lib.runner.visible && !$('#detail-play').hidden;
    const crVisible = creator.runner.visible;
    if (active === 'creator' && crVisible) return creator.console;
    if (active === 'lib' && libVisible) return lib.console;
    if (crVisible) return creator.console;
    if (libVisible) return lib.console;
    return null;
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
    lib.console.ctl.up(m);
    creator.console.ctl.up(m);
  });
}

async function main() {
  const [data] = await Promise.all([loadGames(), fontsReady]);
  const games = data.games || [];

  initHero();
  initStlViewer($('#stl-viewer'), 'downloads/CaseESPboyV4.stl');
  const painel = initPainel({ games });
  const send = (r) => painel.addReading(r, { focusGame: true });

  const lib = initLibrary({ games, makeConsole, addRunner, onSend: send });
  const creator = initCreator({
    makeConsole,
    addRunner,
    onSend: send,
    onRegisterMeta: (meta) => painel.registerGameMeta(meta),
  });

  bindKeyboard(lib, creator);
  startLoop();
}

main();
