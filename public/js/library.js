// Biblioteca de jogos: monta cards, filtros, prévias jogáveis e ficha a partir de games/games.json.

import { $, $$, esc, flash, selectNode, copyText, download } from './util.js';
import { GAMES_BY_PREVIEW } from './preview.js';

const isAvail = (g) => g.status === 'disponivel';

const KEY_CAPTIONS = {
  pixelmath: 'No teclado: setas esquerda e direita, e Espaço para o botão de ação. A prévia ainda usa a tela de 128×64 do primeiro protótipo.',
  acentoquest: 'No teclado: setas cima e baixo para alternar entre as opções e Espaço para confirmar. A prévia ainda usa a tela de 128×64 do primeiro protótipo.',
  ciclofis: 'No teclado: setas cima e baixo para alternar entre as opções e Espaço para confirmar. A prévia ainda usa a tela de 128×64 do primeiro protótipo.',
  regiomap: 'No teclado: setas cima e baixo para alternar entre as capitais e Espaço para confirmar. A prévia ainda usa a tela de 128×64 do primeiro protótipo.',
  algoritmando: 'No teclado: aperte as 4 setas (cima, baixo, esquerda, direita) para completar a sequência e Espaço para iniciar. A prévia ainda usa a tela de 128×64 do primeiro protótipo.',
};

// Definição dos ajustes por jogo: cada entrada controla a UI, a prévia e a substituição no código .ino.
const SETTINGS_UI = {
  pixelmath: {
    render: () => `
      <label class="field" for="opt-tab">Tabuada
        <select id="opt-tab">
          <option value="0">Todas</option>
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<option value="${n}">Só a do ${n}</option>`).join('')}
        </select>
      </label>
      <label class="field" for="opt-vel">Velocidade inicial
        <select id="opt-vel">
          <option value="0.5">Lenta</option>
          <option value="0.8">Média</option>
          <option value="1.2">Rápida</option>
        </select>
      </label>`,
    read: () => ({
      tabuada: parseInt($('#opt-tab').value, 10),
      v0: parseFloat($('#opt-vel').value),
    }),
    patchCode: (code, s) =>
      code
        .replace(/(TABUADA_FIXA\s*=\s*)\d+/, '$1' + s.tabuada)
        .replace(/(VELOCIDADE_INICIAL\s*=\s*)[\d.]+f/, '$1' + s.v0 + 'f'),
  },
  acentoquest: {
    render: () => `
      <label class="field" for="opt-cat">Classificação
        <select id="opt-cat">
          <option value="0">Todas</option>
          <option value="1">Só oxítonas</option>
          <option value="2">Só paroxítonas</option>
          <option value="3">Só proparoxítonas</option>
        </select>
      </label>
      <label class="field" for="opt-qtd">Perguntas por rodada
        <select id="opt-qtd">
          <option value="5">5 perguntas</option>
          <option value="10" selected>10 perguntas</option>
          <option value="15">15 perguntas</option>
        </select>
      </label>`,
    read: () => ({
      categoria: parseInt($('#opt-cat').value, 10),
      total: parseInt($('#opt-qtd').value, 10),
    }),
    patchCode: (code, s) =>
      code
        .replace(/(CATEGORIA_FIXA\s*=\s*)\d+/, '$1' + s.categoria)
        .replace(/(QTD_PERGUNTAS\s*=\s*)\d+/, '$1' + s.total),
  },
  ciclofis: {
    render: () => `
      <fieldset class="field-group">
        <legend>Mudanças de estado na rodada</legend>
        <div class="check-row">
          <label class="check"><input type="checkbox" data-cf="1" checked> Fusão</label>
          <label class="check"><input type="checkbox" data-cf="2" checked> Vaporização</label>
          <label class="check"><input type="checkbox" data-cf="3" checked> Solidificação</label>
          <label class="check"><input type="checkbox" data-cf="4" checked> Condensação</label>
          <label class="check"><input type="checkbox" data-cf="5" checked> Sublimação</label>
        </div>
      </fieldset>
      <label class="field" for="opt-tempo">Tempo por pergunta
        <select id="opt-tempo">
          <option value="0" selected>Sem limite</option>
          <option value="10">10 segundos</option>
          <option value="15">15 segundos</option>
          <option value="20">20 segundos</option>
        </select>
      </label>
      <label class="field" for="opt-qtd">Perguntas por rodada
        <select id="opt-qtd">
          <option value="5">5 perguntas</option>
          <option value="10" selected>10 perguntas</option>
          <option value="15">15 perguntas</option>
        </select>
      </label>`,
    read: () => {
      const cbs = $$('[data-cf]');
      const ativas = cbs.filter((c) => c.checked).map((c) => parseInt(c.getAttribute('data-cf'), 10));
      return {
        ativas: ativas.length ? ativas : [1, 2, 3, 4, 5],
        tempo: parseInt($('#opt-tempo').value, 10),
        total: parseInt($('#opt-qtd').value, 10),
      };
    },
    patchCode: (code, s) => {
      const has = (n) => (s.ativas.includes(n) ? 'true' : 'false');
      return code
        .replace(/(USAR_FUSAO\s*=\s*)(true|false)/, '$1' + has(1))
        .replace(/(USAR_VAPORIZACAO\s*=\s*)(true|false)/, '$1' + has(2))
        .replace(/(USAR_SOLIDIFICACAO\s*=\s*)(true|false)/, '$1' + has(3))
        .replace(/(USAR_CONDENSACAO\s*=\s*)(true|false)/, '$1' + has(4))
        .replace(/(USAR_SUBLIMACAO\s*=\s*)(true|false)/, '$1' + has(5))
        .replace(/(TEMPO_PERGUNTA\s*=\s*)\d+/, '$1' + s.tempo)
        .replace(/(QTD_PERGUNTAS\s*=\s*)\d+/, '$1' + s.total);
    },
  },
  regiomap: {
    render: () => `
      <label class="field" for="opt-reg">Região
        <select id="opt-reg">
          <option value="0">Todas as regiões</option>
          <option value="1">Norte</option>
          <option value="2">Nordeste</option>
          <option value="3">Centro-Oeste</option>
          <option value="4">Sudeste</option>
          <option value="5">Sul</option>
        </select>
      </label>
      <label class="field" for="opt-qtd">Perguntas por rodada
        <select id="opt-qtd">
          <option value="5">5 perguntas</option>
          <option value="10" selected>10 perguntas</option>
          <option value="15">15 perguntas</option>
          <option value="27">27 (todas)</option>
        </select>
      </label>`,
    read: () => ({
      regiao: parseInt($('#opt-reg').value, 10),
      total: parseInt($('#opt-qtd').value, 10),
    }),
    patchCode: (code, s) =>
      code
        .replace(/(REGIAO_FIXA\s*=\s*)\d+/, '$1' + s.regiao)
        .replace(/(QTD_PERGUNTAS\s*=\s*)\d+/, '$1' + s.total),
  },
  algoritmando: {
    render: () => `
      <label class="field" for="opt-comp">Complexidade
        <select id="opt-comp">
          <option value="0">Todos os padrões</option>
          <option value="1">Só 2 comandos</option>
          <option value="2">2 e 3 comandos</option>
          <option value="3">Opostos e pares</option>
        </select>
      </label>
      <label class="field" for="opt-tempo">Tempo por rodada
        <select id="opt-tempo">
          <option value="0" selected>Sem limite</option>
          <option value="8">8 segundos</option>
          <option value="12">12 segundos</option>
          <option value="15">15 segundos</option>
        </select>
      </label>
      <label class="field" for="opt-qtd">Rodadas por partida
        <select id="opt-qtd">
          <option value="5">5 rodadas</option>
          <option value="10" selected>10 rodadas</option>
          <option value="15">15 rodadas</option>
        </select>
      </label>`,
    read: () => ({
      complexidade: parseInt($('#opt-comp').value, 10),
      tempo: parseInt($('#opt-tempo').value, 10),
      total: parseInt($('#opt-qtd').value, 10),
    }),
    patchCode: (code, s) =>
      code
        .replace(/(COMPLEXIDADE\s*=\s*)\d+/, '$1' + s.complexidade)
        .replace(/(TEMPO_RODADA\s*=\s*)\d+/, '$1' + s.tempo)
        .replace(/(QTD_RODADAS\s*=\s*)\d+/, '$1' + s.total),
  },
};

export function initLibrary({ games, makeConsole, addRunner, onSend }) {
  const cardsBox = $('#cards');
  const chipsBox = $('#chips');
  const materias = [...new Set(games.map((g) => g.materia))];

  /* ---------- filtros e cards ---------- */
  chipsBox.innerHTML = ['todas', ...materias]
    .map((m, i) => `<button class="chip" type="button" data-f="${esc(m)}" aria-pressed="${i === 0}">${m === 'todas' ? 'Todas' : esc(m)}</button>`)
    .join('');

  cardsBox.innerHTML = games
    .map(
      (g) => `<button class="card ${isAvail(g) ? 'avail' : 'later'}" type="button" data-id="${esc(g.id)}" data-m="${esc(g.materia)}">
        <div class="meta"><span class="tag ${isAvail(g) ? 'ok' : 'soon'}">${isAvail(g) ? 'Disponível' : 'Em breve'}</span><span class="muted">${esc(g.materia)}</span></div>
        <h3>${esc(g.nome)}</h3>
        <p>${esc(g.resumo)}</p>
        <p class="muted small">${esc(g.assunto)} · ${esc(g.modelo)}</p>
      </button>`
    )
    .join('');

  $$('#chips .chip').forEach((c) => {
    c.addEventListener('click', () => {
      const f = c.getAttribute('data-f');
      $$('#chips .chip').forEach((x) => x.setAttribute('aria-pressed', x === c ? 'true' : 'false'));
      $$('#cards .card').forEach((card) => { card.hidden = !(f === 'todas' || card.getAttribute('data-m') === f); });
    });
  });

  /* ---------- prévia jogável e cache por jogo ---------- */
  const libCon = makeConsole($('#lib-console'), 'Tela do console para testar o jogo escolhido');
  const instances = new Map();
  const codeCache = new Map();
  let currentGameMeta = null;
  let currentGame = null;
  const libRun = addRunner(libCon, { step() {}, draw() {} }, null);

  const liveJson = (meta, g) => {
    const s = g.stats;
    return '{\n  "esplay": 1,\n  "student": ' + g.sid + ',\n  "game": "' + meta.id + '",\n  "name": "' + meta.nome + '",\n  "tag": "' + (meta.tag || 'item') + '",\n' +
      '  "best": ' + s.best + ',\n  "plays": ' + s.plays + ',\n  "hits": ' + s.hits + ',\n  "misses": ' + s.misses + ',\n' +
      '  "last": [' + s.last.join(', ') + '],\n  "tagHits": [' + s.tagHits.join(', ') + '],\n  "tagMisses": [' + s.tagMisses.join(', ') + ']\n}';
  };

  const refreshJson = () => {
    if (!currentGameMeta || !currentGame) return;
    $('#livejson').textContent = liveJson(currentGameMeta, currentGame);
  };

  const renderCode = () => {
    if (!currentGameMeta) return;
    const raw = codeCache.get(currentGameMeta.id);
    if (!raw) return;
    const ui = SETTINGS_UI[currentGameMeta.id];
    const cfg = ui ? ui.read() : {};
    $('#code').textContent = ui ? ui.patchCode(raw, cfg) : raw;
  };

  const loadCode = (meta) => {
    $('#code-filename').textContent = meta.nome + '.ino';
    if (codeCache.has(meta.id)) { renderCode(); return; }
    $('#code').textContent = '// Carregando código...';
    fetch(meta.arquivo)
      .then((r) => (r.ok ? r.text() : Promise.reject()))
      .then((t) => {
        codeCache.set(meta.id, t);
        if (currentGameMeta && currentGameMeta.id === meta.id) renderCode();
      })
      .catch(() => {
        $('#code').textContent = '// Não foi possível carregar ' + meta.arquivo + '. Rode o site pelo servidor: bun run dev';
      });
  };

  const applySettings = (e) => {
    if (!currentGameMeta || !currentGame) return;
    // Evita desmarcar todas as opções no CicloFis.
    if (currentGameMeta.id === 'ciclofis' && e && e.target && e.target.hasAttribute('data-cf')) {
      const checked = $$('[data-cf]').filter((c) => c.checked);
      if (!checked.length) {
        e.target.checked = true;
        return;
      }
    }
    const ui = SETTINGS_UI[currentGameMeta.id];
    if (!ui) return;
    const cfg = ui.read();
    renderCode();
    currentGame.setCfg(cfg);
    currentGame.draw();
  };

  $('#lib-fields').addEventListener('change', applySettings);

  $('#copy-code').addEventListener('click', function () {
    const btn = this;
    const fail = () => { selectNode($('#code')); flash(btn, 'Selecionado: Ctrl+C'); };
    copyText($('#code').textContent, () => flash(btn, 'Copiado'), fail);
  });

  $('#dl-code').addEventListener('click', () => {
    if (!currentGameMeta) return;
    download(currentGameMeta.nome + '.ino', $('#code').textContent, 'text/plain;charset=utf-8');
  });

  $('#send-panel').addEventListener('click', () => {
    if (!currentGameMeta || !currentGame) return;
    const s = currentGame.stats;
    const out = $('#send-status');
    if (!s.plays) { out.textContent = 'Jogue uma partida até o fim primeiro.'; return; }
    const res = onSend({
      esplay: 1, student: currentGame.sid, game: currentGameMeta.id, name: currentGameMeta.nome, tag: currentGameMeta.tag || 'item',
      best: s.best, plays: s.plays, hits: s.hits, misses: s.misses,
      last: s.last.slice(), tagHits: s.tagHits.slice(), tagMisses: s.tagMisses.slice(),
    });
    out.textContent = res === 'igual'
      ? 'Sem partidas novas desde o último envio.'
      : `Enviado (${currentGameMeta.nome}). Veja o aluno 7 no painel do professor.`;
  });

  /* ---------- detalhe do jogo escolhido ---------- */
  const list = (items) => '<ul>' + items.map((t) => `<li>${t}</li>`).join('') + '</ul>';

  function renderDetail(g) {
    const soon = !isAvail(g);
    $('#detail-head').innerHTML =
      `<p class="eyebrow">${esc(g.materia)} · ${esc(g.assunto)}</p>
       <h3 class="detail-title">${esc(g.nome)}</h3>
       <p>${esc(g.resumo)}</p>` +
      (soon
        ? '<div class="banner"><span><b>Em desenvolvimento.</b> A ficha do jogo já está definida. O código e a prévia entram depois dos testes no console.</span></div>'
        : '');

    const rows = [
      ['Ano escolar', esc(g.ano || 'A definir')],
      ['O que o aluno treina', g.treina && esc(g.treina)],
      ['Modelo de jogo', esc(g.modelo)],
      ['Como se joga', g.comoJoga && list(g.comoJoga.map(([b, a]) => `<b>${esc(b)}:</b> ${esc(a)}`))],
      ['Categorias que o painel mostra', g.categorias && list(g.categorias.map(esc))],
      ['Ao errar', g.aoErrar && esc(g.aoErrar)],
      ['O professor ajusta', g.professorAjusta && esc(g.professorAjusta)],
      ['Fim da partida', g.fimPartida && esc(g.fimPartida)],
      ['Observação', g.observacao && esc(g.observacao)],
    ].filter((r) => r[1]);

    $('#detail-ficha').innerHTML =
      `<div class="panel"><h3>Ficha do jogo</h3><div class="tablewrap"><table class="ficha-table"><tbody>` +
      rows.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('') +
      '</tbody></table></div></div>';
  }

  function select(id, scroll) {
    const g = games.find((x) => x.id === id);
    if (!g) return;
    $$('#cards .card').forEach((c) => c.setAttribute('aria-current', c.getAttribute('data-id') === id ? 'true' : 'false'));
    renderDetail(g);

    const GameClass = GAMES_BY_PREVIEW[g.preview];
    const playable = Boolean(GameClass);
    $('#detail-play').hidden = !playable;

    if (playable) {
      currentGameMeta = g;
      if (!instances.has(g.id)) {
        const inst = new GameClass(libCon.scr, {});
        inst.onSave = refreshJson;
        instances.set(g.id, inst);
      }
      currentGame = instances.get(g.id);
      libRun.game = currentGame;

      const ui = SETTINGS_UI[g.id];
      $('#lib-fields').innerHTML = ui ? ui.render() : '';
      if (ui) currentGame.setCfg(ui.read());

      $('#lib-caption').textContent = KEY_CAPTIONS[g.id] || KEY_CAPTIONS.pixelmath;
      $('canvas', libCon.host).setAttribute('aria-label', 'Tela do console com o jogo ' + g.nome);
      $('#send-status').textContent = '';

      currentGame.draw();
      refreshJson();
      if (g.arquivo) loadCode(g);
    }

    if (scroll) $('#detail').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }

  cardsBox.addEventListener('click', (e) => {
    const card = e.target.closest('.card');
    if (card) select(card.getAttribute('data-id'), true);
  });

  const first = games.find(isAvail) || games[0];
  if (first) select(first.id, false);

  return { select, console: libCon, runner: libRun };
}
