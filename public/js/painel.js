// Painel do professor: leituras do console, histórico, turmas, nomes e arquivos.
// Tudo fica no navegador (localStorage). Nada é enviado a servidores.

import { $, $$, esc, zeros, flash, selectNode, copyText, download } from './util.js';

const KEY2 = 'esplay.painel.v2';
const KEY1 = 'esplay.painel.v1';
const NTAGS = 16;
const DAY = 864e5;

// leituras: cada vez que o professor lê um console, guarda-se uma foto dos números dele.
const state = { turmas: [], alunos: {}, leituras: [], customGames: {}, examples: true, filtro: 'todas', ficha: null, barsGame: null };
let seq = 0;
let gamesById = {};
let examplesCache = null;

const newId = () => Date.now().toString(36) + '-' + (seq++).toString(36);
const keyOf = (r) => (r.example ? 'ex-' : '') + r.student;
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const pct = (v) => Math.round(v * 100);

/* ================= Guardar e carregar ================= */
function load() {
  try {
    const raw = localStorage.getItem(KEY2);
    if (raw) {
      const o = JSON.parse(raw);
      state.turmas = o.turmas || [];
      state.alunos = o.alunos || {};
      state.leituras = o.leituras || [];
      state.customGames = o.customGames || {};
      state.examples = o.examples !== false;
      return;
    }
    const old = localStorage.getItem(KEY1); // versão anterior do painel
    if (old) {
      const o = JSON.parse(old);
      const t = Date.now();
      (o.records || []).forEach((r) => state.leituras.push({ ...r, id: newId(), ts: t }));
      if (o.examples === false) state.examples = false;
    }
  } catch (e) { /* sem armazenamento: o painel funciona só nesta visita */ }
}

function save() {
  try {
    localStorage.setItem(KEY2, JSON.stringify({ turmas: state.turmas, alunos: state.alunos, leituras: state.leituras, customGames: state.customGames, examples: state.examples }));
  } catch (e) { /* ignora */ }
}

/* ================= Dados de exemplo (com evolução) ================= */
// Distribui um total entre categorias na proporção dos pesos.
function alloc(total, w) {
  const sum = w.reduce((a, b) => a + b, 0);
  const out = w.map(() => 0);
  if (!sum || total <= 0) return out;
  const parts = w.map((x, i) => { const q = (total * x) / sum; out[i] = Math.floor(q); return [q - out[i], i]; });
  let left = total - out.reduce((a, b) => a + b, 0);
  parts.sort((a, b) => b[0] - a[0]);
  for (let j = 0; left > 0; j = (j + 1) % parts.length, left--) out[parts[j][1]]++;
  return out;
}

function buildExamples(now) {
  const turmas = [{ id: 'ex-a', nome: '5º ano A (exemplo)' }, { id: 'ex-b', nome: '6º ano B (exemplo)' }];
  // k leituras semanais; o acerto de cada semana vai de r0 a r1.
  const defs = [
    { n: 3, nome: 'Ana', turma: 'ex-a', plays: 12, k: 4, r0: 0.70, r1: 0.92, weak: [7, 8] },
    { n: 5, nome: 'Bruno', turma: 'ex-a', plays: 6, k: 3, r0: 0.72, r1: 0.78, weak: [6, 7, 8, 9] },
    { n: 8, nome: 'Carla', turma: 'ex-a', plays: 18, k: 4, r0: 0.86, r1: 0.94, weak: [8] },
    { n: 11, nome: 'Davi', turma: 'ex-b', plays: 3, k: 3, r0: 0.80, r1: 0.55, weak: [4, 7] },
    { n: 14, nome: 'Eva', turma: 'ex-b', plays: 9, k: 3, r0: 0.80, r1: 0.88, weak: [9, 7] },
    { n: 21, nome: 'Fábio', turma: 'ex-b', plays: 15, k: 4, r0: 0.76, r1: 0.92, weak: [6] },
  ];
  const alunos = {};
  const leituras = [];
  defs.forEach((d) => {
    alunos['ex-' + d.n] = { nome: d.nome, turmaId: d.turma };
    const wh = zeros(NTAGS), wm = zeros(NTAGS);
    for (let t = 1; t <= 9; t++) { wh[t] = d.weak.includes(t) ? 0.5 : 1; wm[t] = d.weak.includes(t) ? 4 : 1; }
    let plays = 0, hits = 0, best = 0;
    const scores = [];
    for (let i = 1; i <= d.k; i++) {
      const target = Math.round((d.plays * i) / d.k);
      const pp = target - plays; // partidas nesta semana (cada uma termina em 1 erro)
      const p = d.k === 1 ? d.r1 : d.r0 + ((d.r1 - d.r0) * (i - 1)) / (d.k - 1);
      const hp = Math.round((pp * p) / (1 - p)); // acertos nesta semana
      for (let q = 0; q < pp; q++) {
        const s = 10 * (Math.floor(hp / pp) + (q < hp % pp ? 1 : 0));
        scores.push(s);
        if (s > best) best = s;
      }
      plays = target;
      hits += hp;
      leituras.push({
        id: 'ex-' + d.n + '-' + i, ts: now - (d.k - i) * 7 * DAY, student: d.n, game: 'pixelmath', name: 'PixelMath', tag: 'tabuada',
        example: true, best, plays, hits, misses: plays, last: scores.slice(-10),
        tagHits: alloc(hits, wh), tagMisses: alloc(plays, wm),
      });
    }
  });
  return { turmas, alunos, leituras };
}

const examples = () => (examplesCache = examplesCache || buildExamples(Date.now()));

/* ================= Juntar os dados ================= */
function data() {
  const ex = state.examples ? examples() : { turmas: [], alunos: {}, leituras: [] };
  return {
    turmas: [...ex.turmas, ...state.turmas],
    alunos: { ...ex.alunos, ...state.alunos },
    leituras: [...ex.leituras, ...state.leituras],
  };
}

// Um grupo = um aluno em um jogo, com todas as suas leituras em ordem.
function groups(d) {
  const map = new Map();
  for (const r of d.leituras) {
    const gk = keyOf(r) + '|' + r.game;
    if (!map.has(gk)) map.set(gk, []);
    map.get(gk).push(r);
  }
  return [...map.entries()]
    .map(([gk, list]) => {
      list.sort((a, b) => a.ts - b.ts);
      const last = list[list.length - 1];
      return { gk, key: keyOf(last), game: last.game, list, last };
    })
    .sort((a, b) => a.last.student - b.last.student || a.game.localeCompare(b.game));
}

const turmaIdOf = (d, key) => (d.alunos[key] && d.alunos[key].turmaId) || null;
const turmaNome = (d, id) => { const t = d.turmas.find((x) => x.id === id); return t ? t.nome : null; };
const inFilter = (d) => (g) =>
  state.filtro === 'todas' ? true : state.filtro === 'sem' ? !turmaIdOf(d, g.key) : turmaIdOf(d, g.key) === state.filtro;

/* ================= Cálculos ================= */
// Acerto de cada período: diferença entre duas leituras seguidas.
function periodAcc(list) {
  return list.map((r, i) => {
    const p = list[i - 1];
    let h = r.hits, m = r.misses;
    if (p && r.hits >= p.hits && r.misses >= p.misses) { h = r.hits - p.hits; m = r.misses - p.misses; }
    const a = h + m;
    return { ts: r.ts, acc: a > 0 ? h / a : null };
  });
}

function metrics(r) {
  const att = r.hits + r.misses;
  const taxa = att ? r.hits / att : 0;
  let wt = -1, wr = 0;
  for (let t = 0; t < NTAGS; t++) {
    const a = r.tagHits[t] + r.tagMisses[t];
    if (a >= 3) { const e = r.tagMisses[t] / a; if (e > wr) { wr = e; wt = t; } }
  }
  return { taxa, wt, wr };
}

function nivel(taxa, plays) {
  if (!plays) return ['Sem dados', 'mid'];
  if (taxa < 0.7) return ['Precisa de apoio', 'bad'];
  if (taxa < 0.85) return ['Em desenvolvimento', 'mid'];
  return ['Consolidado', 'ok'];
}

function tagLabel(game, tag, n) {
  const g = gamesById[game] || state.customGames[game];
  if (g && g.tagRotulos && g.tagRotulos[n]) return g.tagRotulos[n];
  if (g && g.tagModelo) return g.tagModelo.replace('{n}', n);
  return cap(tag) + ' ' + n;
}
const weakLabel = (r, m) => (m.wt < 0 ? '—' : tagLabel(r.game, r.tag, m.wt));

/* ================= Desenhos ================= */
function spark(vals) {
  if (!vals.length) return '<span class="muted">—</span>';
  if (vals.length === 1) return '<span class="mono">' + vals[0] + '</span>';
  const w = 96, h = 26, p = 3;
  const mx = Math.max(...vals), mn = Math.min(...vals), span = mx - mn || 1;
  const pts = vals.map((v, i) => [p + (i * (w - 2 * p)) / (vals.length - 1), h - p - ((v - mn) / span) * (h - 2 * p)]);
  const last = pts[pts.length - 1];
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" role="img" aria-label="Valores: ${vals.join(', ')}"><polyline points="${pts.map((q) => q[0].toFixed(1) + ',' + q[1].toFixed(1)).join(' ')}"/><circle cx="${last[0].toFixed(1)}" cy="${last[1].toFixed(1)}" r="3"/></svg>`;
}

const fmtDay = (ts) => new Date(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
const fmtFull = (ts) => new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

function trend(accs) {
  const v = accs.filter((a) => a.acc !== null);
  if (v.length < 2) return '<span class="muted" title="Só uma leitura">—</span>';
  const diff = v[v.length - 1].acc - v[v.length - 2].acc;
  if (diff >= 0.05) return '<span class="trend up" title="Acerto subiu na última leitura">↑</span>';
  if (diff <= -0.05) return '<span class="trend down" title="Acerto caiu na última leitura">↓</span>';
  return '<span class="trend" title="Acerto estável">→</span>';
}

// Gráfico do acerto em cada leitura, com as linhas de 70% e 85% dos níveis.
// O eixo começa perto do menor valor (não em zero) para os pontos não ficarem amontoados no topo.
function chartAcc(points) {
  const w = 560, h = 190, l = 44, r = 20, t = 22, b = 34, pad = 26;
  const n = points.length;
  const lo = Math.max(0, Math.min(0.5, Math.floor(Math.min(...points.map((p) => p.acc)) * 10) / 10 - 0.1));
  const x = (i) => (n === 1 ? l + (w - l - r) / 2 : l + pad + ((w - l - r - 2 * pad) * i) / (n - 1));
  const y = (v) => t + (h - t - b) * (1 - (v - lo) / (1 - lo));
  const ticks = [lo, 0.7, 0.85, 1];
  let s = `<svg class="chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Acerto em cada leitura: ${points.map((p) => pct(p.acc) + '%').join(', ')}">`;
  ticks.forEach((v) => {
    s += `<line class="${v === 0.7 || v === 0.85 ? 'ch-ref' : 'ch-grid'}" x1="${l}" x2="${w - r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/>`;
    s += `<text class="ch-txt" x="${l - 6}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${pct(v)}%</text>`;
  });
  s += `<polyline class="ch-line" points="${points.map((p, i) => x(i).toFixed(1) + ',' + y(p.acc).toFixed(1)).join(' ')}"/>`;
  points.forEach((p, i) => {
    s += `<circle class="ch-pt" cx="${x(i).toFixed(1)}" cy="${y(p.acc).toFixed(1)}" r="4"/>`;
    s += `<text class="ch-txt strong" x="${x(i).toFixed(1)}" y="${(y(p.acc) - 10).toFixed(1)}" text-anchor="middle">${pct(p.acc)}%</text>`;
    s += `<text class="ch-txt" x="${x(i).toFixed(1)}" y="${h - 12}" text-anchor="middle">${fmtDay(p.ts)}</text>`;
  });
  return s + '</svg>';
}

/* ================= Tela ================= */
const setStatus = (msg) => { $('#p-status').textContent = msg; };

function renderFilter(d) {
  const sel = $('#f-turma');
  const opts = [['todas', 'Todas as turmas'], ...d.turmas.map((t) => [t.id, t.nome]), ['sem', 'Sem turma']];
  if (!opts.some((o) => o[0] === state.filtro)) state.filtro = 'todas';
  sel.innerHTML = opts.map(([v, t]) => `<option value="${esc(v)}"${v === state.filtro ? ' selected' : ''}>${esc(t)}</option>`).join('');
  const real = state.turmas.some((t) => t.id === state.filtro);
  $('#btn-rm-turma').disabled = !real;
}

function renderRows(d, shown) {
  const rows = shown.map((g) => {
    const r = g.last, m = metrics(r), n = nivel(m.taxa, r.plays), p = pct(m.taxa);
    const al = d.alunos[g.key] || {};
    const accs = periodAcc(g.list);
    const vals = accs.filter((a) => a.acc !== null).slice(-8).map((a) => pct(a.acc));
    const tn = turmaNome(d, al.turmaId);
    return `<tr>
      <td><b>${al.nome ? esc(al.nome) : 'Aluno ' + r.student}</b>${al.nome ? ' <span class="muted mono">nº ' + r.student + '</span>' : ''}${r.example ? ' <span class="tag soon">exemplo</span>' : ''}</td>
      <td>${tn ? esc(tn) : '<span class="muted">—</span>'}</td>
      <td>${esc(r.name)}</td>
      <td class="num">${r.plays}</td><td class="num">${r.best}</td>
      <td><div class="rate"><span class="mono">${p}%</span><i><b style="width:${p}%"></b></i></div></td>
      <td><span class="evo">${spark(vals)}${trend(accs)}</span></td>
      <td>${esc(weakLabel(r, m))}</td>
      <td><span class="tag ${n[1]}">${n[0]}</span></td>
      <td><button class="btn small" type="button" data-ficha="${esc(g.gk)}">Ficha</button></td>
    </tr>`;
  });
  $('#rows').innerHTML = rows.length
    ? rows.join('')
    : '<tr><td colspan="10" class="muted">Nenhum aluno aqui ainda. Leia um console pela USB, cole os dados ou abra uma cópia salva.</td></tr>';
}

function renderBars(shown) {
  const gameIds = [...new Set(shown.map((g) => g.game))];
  if (!gameIds.includes(state.barsGame)) state.barsGame = gameIds[0] || null;
  const nameOf = (id) => (shown.find((g) => g.game === id) || { last: {} }).last.name || id;
  const sel = $('#bars-game');
  sel.innerHTML = gameIds.map((id) => `<option value="${esc(id)}"${id === state.barsGame ? ' selected' : ''}>${esc(nameOf(id))}</option>`).join('');
  sel.disabled = gameIds.length < 2;

  const mine = shown.filter((g) => g.game === state.barsGame);
  const tH = zeros(NTAGS), tM = zeros(NTAGS);
  mine.forEach((g) => { for (let i = 0; i < NTAGS; i++) { tH[i] += g.last.tagHits[i]; tM[i] += g.last.tagMisses[i]; } });
  const tag = mine.length ? mine[0].last.tag : '';
  const items = [];
  for (let t = 0; t < NTAGS; t++) {
    const a = tH[t] + tM[t];
    if (a > 0) items.push({ t, e: tM[t] / a, a });
  }
  items.sort((x, y) => y.e - x.e || y.a - x.a);
  $('#bars-sub').textContent = mine.length ? `Taxa de erro por ${tag}, somando os alunos da lista.` : '';
  $('#bars').innerHTML = items.length
    ? items.map((it, i) => {
        const p = pct(it.e);
        return `<div class="bar"><span>${esc(tagLabel(state.barsGame, tag, it.t))}</span><div class="track"><div class="fill${i === 0 ? ' worst' : ''}" style="width:${p}%"></div></div><span class="pct">${p}%</span></div>`;
      }).join('')
    : '<p class="muted">Sem dados ainda.</p>';
}

function renderFicha(d, all) {
  const box = $('#ficha');
  const g = all.find((x) => x.gk === state.ficha);
  if (!g) { state.ficha = null; box.hidden = true; box.innerHTML = ''; return; }

  const r = g.last, ex = !!r.example, al = d.alunos[g.key] || {};
  const mine = all.filter((x) => x.key === g.key);
  const accs = periodAcc(g.list);
  const withAcc = accs.filter((a) => a.acc !== null);
  const m = metrics(r), n = nivel(m.taxa, r.plays);
  const dis = ex ? ' disabled' : '';

  const turmaOpts = ['<option value="">Sem turma</option>']
    .concat(d.turmas.filter((t) => !t.id.startsWith('ex-')).map((t) => `<option value="${esc(t.id)}"${al.turmaId === t.id ? ' selected' : ''}>${esc(t.nome)}</option>`))
    .join('');
  const exTurma = ex ? `<option selected>${esc(turmaNome(d, al.turmaId) || 'Sem turma')}</option>` : turmaOpts;

  const gameSel = mine.length > 1
    ? `<label class="field" for="ficha-game">Jogo<select id="ficha-game">${mine.map((x) => `<option value="${esc(x.gk)}"${x.gk === g.gk ? ' selected' : ''}>${esc(x.last.name)}</option>`).join('')}</select></label>`
    : '';

  const tH = r.tagHits, tM = r.tagMisses;
  const cats = [];
  for (let t = 0; t < NTAGS; t++) { const a = tH[t] + tM[t]; if (a > 0) cats.push({ t, e: tM[t] / a, a }); }
  cats.sort((x, y) => y.e - x.e || y.a - x.a);

  const hist = g.list.slice().reverse().map((x, i, arr) => {
    const ac = accs[g.list.length - 1 - i];
    const tot = x.hits + x.misses;
    return `<tr><td>${esc(fmtFull(x.ts))}</td><td class="num">${x.plays}</td><td class="num">${x.best}</td><td class="num">${ac.acc === null ? '—' : pct(ac.acc) + '%'}</td><td class="num">${tot ? pct(x.hits / tot) + '%' : '—'}</td></tr>`;
  }).join('');

  box.hidden = false;
  box.innerHTML = `
    <div class="ficha-head">
      <div>
        <p class="eyebrow">Ficha do aluno</p>
        <h3>${al.nome ? esc(al.nome) : 'Aluno ' + r.student}${ex ? ' <span class="tag soon">exemplo</span>' : ''}</h3>
        <p class="muted">Número no console: <b>${r.student}</b> · ${esc(r.name)}</p>
      </div>
      <button class="btn small" type="button" data-act="close">Fechar</button>
    </div>
    <form id="ficha-form" class="ficha-form">
      <label class="field" for="ficha-nome">Nome<input id="ficha-nome" type="text" maxlength="40" value="${esc(al.nome || '')}"${dis}></label>
      <label class="field" for="ficha-turma">Turma<select id="ficha-turma"${dis}>${exTurma}</select></label>
      ${gameSel}
      ${ex ? '' : '<button class="btn small primary" type="submit">Salvar</button>'}
    </form>
    <p class="note">${ex ? 'Aluno de exemplo: não dá para editar.' : 'O nome e a turma ficam só neste navegador. O console guarda apenas o número.'}</p>

    <p class="summary">Partidas <b>${r.plays}</b> · melhor pontuação <b>${r.best}</b> · acerto <b>${pct(m.taxa)}%</b> · <span class="tag ${n[1]}">${n[0]}</span></p>

    <div class="ficha-grid">
      <div>
        <h4>Acerto em cada leitura</h4>
        ${withAcc.length >= 2
          ? chartAcc(withAcc)
          : '<p class="muted">Só há uma leitura deste aluno. Leia o console de novo depois de novas partidas para ver a evolução.</p>'}
        <p class="note">Cada ponto compara os acertos e erros desde a leitura anterior. As linhas tracejadas marcam 70% e 85%. O eixo não começa em zero.</p>
      </div>
      <div>
        <h4>Onde mais erra</h4>
        <div class="bars">${cats.length
          ? cats.map((c, i) => { const p = pct(c.e); return `<div class="bar"><span>${esc(tagLabel(r.game, r.tag, c.t))}</span><div class="track"><div class="fill${i === 0 ? ' worst' : ''}" style="width:${p}%"></div></div><span class="pct">${p}%</span></div>`; }).join('')
          : '<p class="muted">Sem dados ainda.</p>'}</div>
        <h4 style="margin-top:20px;">Últimas pontuações</h4>
        <p class="evo">${spark(r.last)} <span class="mono muted">${r.last.join(' ')}</span></p>
      </div>
    </div>

    <h4>Leituras</h4>
    <div class="tablewrap"><table class="grid" style="min-width:520px;">
      <thead><tr><th>Data</th><th class="num">Partidas</th><th class="num">Melhor</th><th class="num">Acerto no período</th><th class="num">Acerto total</th></tr></thead>
      <tbody>${hist}</tbody>
    </table></div>
    ${ex ? '' : '<div class="ficha-foot"><button class="btn small" type="button" data-act="rm-aluno">Remover os dados deste aluno</button></div>'}
  `;
}

function render() {
  const d = data();
  const all = groups(d);
  renderFilter(d);
  const shown = all.filter(inFilter(d));
  renderRows(d, shown);
  renderBars(shown);
  renderFicha(d, all);
  $('#banner').hidden = !state.examples;
}

/* ================= Adicionar leituras ================= */
function normalize(o) {
  if (!o || o.esplay !== 1 || typeof o.student !== 'number') return null;
  const arr = (a) => { const r = zeros(NTAGS); if (a && a.length) for (let i = 0; i < NTAGS && i < a.length; i++) r[i] = +a[i] || 0; return r; };
  return {
    student: o.student, game: String(o.game || ''), name: String(o.name || o.game || ''), tag: String(o.tag || 'item'),
    best: +o.best || 0, plays: +o.plays || 0, hits: +o.hits || 0, misses: +o.misses || 0,
    last: (o.last || []).map(Number), tagHits: arr(o.tagHits), tagMisses: arr(o.tagMisses),
  };
}

// Devolve 'novo', 'igual' (nada mudou desde a última leitura) ou null (dados inválidos).
function addReading(o, opts) {
  const r = normalize(o);
  if (!r) return null;
  const prev = state.leituras.filter((x) => String(x.student) === String(r.student) && x.game === r.game).sort((a, b) => a.ts - b.ts).pop();
  if (prev && prev.plays === r.plays && prev.hits === r.hits && prev.misses === r.misses && prev.best === r.best &&
      prev.last.join(',') === r.last.join(',')) {
    if (opts && opts.focusGame) { state.barsGame = r.game; render(); }
    return 'igual';
  }
  state.leituras.push({ ...r, id: newId(), ts: Date.now() });
  if (opts && opts.focusGame) state.barsGame = r.game;
  save();
  render();
  return 'novo';
}

function registerGameMeta(meta) {
  if (!meta || !meta.id) return;
  state.customGames[meta.id] = {
    id: String(meta.id),
    nome: String(meta.nome || meta.id),
    tag: String(meta.tag || 'item'),
    tagRotulos: meta.tagRotulos || {},
  };
  save();
  render();
}

function addFromText(text) {
  const out = { novo: 0, igual: 0, ruim: 0 };
  text.split(/\r?\n/).forEach((ln) => {
    const i = ln.indexOf('{'), j = ln.lastIndexOf('}');
    if (i < 0 || j <= i) return;
    try { const res = addReading(JSON.parse(ln.slice(i, j + 1))); out[res || 'ruim']++; } catch (e) { out.ruim++; }
  });
  return out;
}

const reportAdd = (o) => {
  if (!o.novo && !o.igual) return 'Não encontrei dados válidos. Cole as linhas que começam com { no Monitor Serial.';
  const parts = [];
  if (o.novo) parts.push(o.novo + (o.novo === 1 ? ' leitura nova' : ' leituras novas'));
  if (o.igual) parts.push(o.igual + (o.igual === 1 ? ' sem partidas novas' : ' sem partidas novas'));
  return parts.join(', ') + '.';
};

/* ================= Arquivos: CSV e cópia ================= */
const csvCell = (v) => { const s = String(v); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
const csvLine = (a) => a.map(csvCell).join(';');
const num = (x) => String(Math.round(x * 1000) / 10).replace('.', ',');

function summaryCsv() {
  const d = data();
  const shown = groups(d).filter(inFilter(d));
  const head = ['aluno', 'nome', 'turma', 'jogo', 'partidas', 'melhor', 'acertos', 'erros', 'taxa_acerto_%', 'assunto_que_mais_erra', 'nivel', 'exemplo'];
  const lines = shown.map((g) => {
    const r = g.last, m = metrics(r), al = d.alunos[g.key] || {};
    return csvLine([r.student, al.nome || '', turmaNome(d, al.turmaId) || '', r.name, r.plays, r.best, r.hits, r.misses, num(m.taxa), weakLabel(r, m), nivel(m.taxa, r.plays)[0], r.example ? 'sim' : 'não']);
  });
  return [csvLine(head), ...lines].join('\r\n');
}

function historyCsv() {
  const d = data();
  const shown = groups(d).filter(inFilter(d));
  const head = ['data_hora', 'aluno', 'nome', 'turma', 'jogo', 'partidas', 'melhor', 'acertos', 'erros', 'acerto_no_periodo_%', 'exemplo'];
  const lines = [];
  shown.forEach((g) => {
    const al = d.alunos[g.key] || {};
    const accs = periodAcc(g.list);
    g.list.forEach((x, i) => {
      lines.push(csvLine([fmtFull(x.ts), x.student, al.nome || '', turmaNome(d, al.turmaId) || '', x.name, x.plays, x.best, x.hits, x.misses, accs[i].acc === null ? '' : num(accs[i].acc), x.example ? 'sim' : 'não']));
    });
  });
  return [csvLine(head), ...lines].join('\r\n');
}

// BOM no começo para o Excel reconhecer os acentos.
const BOM = '﻿';

function exportJson() {
  return JSON.stringify({ esplay_painel: 2, exportado: new Date().toISOString(), turmas: state.turmas, alunos: state.alunos, leituras: state.leituras, customGames: state.customGames }, null, 2);
}

function importData(o) {
  const res = { leituras: 0, turmas: 0, alunos: 0 };
  if (o && o.esplay_painel === 2) {
    (o.turmas || []).forEach((t) => { if (t && t.id && !state.turmas.some((x) => x.id === t.id)) { state.turmas.push({ id: String(t.id), nome: String(t.nome || '') }); res.turmas++; } });
    Object.entries(o.alunos || {}).forEach(([k, v]) => { if (!(k in state.alunos) && v) { state.alunos[k] = { nome: String(v.nome || ''), turmaId: v.turmaId || null }; res.alunos++; } });
    Object.entries(o.customGames || {}).forEach(([k, v]) => { if (!(k in state.customGames) && v) state.customGames[k] = v; });
    const ids = new Set(state.leituras.map((x) => x.id));
    (o.leituras || []).forEach((x) => {
      const r = normalize({ ...x, esplay: 1 });
      if (r && x.id && !ids.has(x.id)) { state.leituras.push({ ...r, id: String(x.id), ts: +x.ts || Date.now() }); ids.add(x.id); res.leituras++; }
    });
  } else if (o && Array.isArray(o.records)) { // cópia do painel antigo
    o.records.forEach((x) => { const r = normalize({ ...x, esplay: 1 }); if (r) { state.leituras.push({ ...r, id: newId(), ts: Date.now() }); res.leituras++; } });
  } else {
    return null;
  }
  save();
  render();
  return res;
}

/* ================= Iniciar ================= */
export function initPainel({ games }) {
  gamesById = Object.fromEntries((games || []).map((g) => [g.id, g]));
  load();
  render();

  // linhas da tabela -> ficha
  $('#rows').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ficha]');
    if (!b) return;
    state.ficha = b.getAttribute('data-ficha');
    render();
    $('#ficha').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  // ficha: fechar, remover, trocar de jogo, salvar nome e turma
  const ficha = $('#ficha');
  ficha.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    if (b.dataset.act === 'close') { state.ficha = null; render(); return; }
    if (b.dataset.act === 'rm-aluno') {
      if (b.dataset.arm !== '1') {
        b.dataset.arm = '1'; b.textContent = 'Clique de novo para remover';
        setTimeout(() => { b.dataset.arm = ''; b.textContent = 'Remover os dados deste aluno'; }, 3000);
        return;
      }
      const key = state.ficha.split('|')[0];
      state.leituras = state.leituras.filter((x) => String(x.student) !== key);
      delete state.alunos[key];
      state.ficha = null;
      save(); render();
      setStatus('Dados do aluno ' + key + ' removidos deste navegador.');
    }
  });
  ficha.addEventListener('change', (e) => {
    if (e.target.id === 'ficha-game') { state.ficha = e.target.value; render(); }
  });
  ficha.addEventListener('submit', (e) => {
    e.preventDefault();
    const key = state.ficha.split('|')[0];
    state.alunos[key] = { nome: $('#ficha-nome').value.trim(), turmaId: $('#ficha-turma').value || null };
    save(); render();
    setStatus('Nome e turma salvos.');
  });

  // turmas
  $('#f-turma').addEventListener('change', (e) => { state.filtro = e.target.value; render(); });
  $('#bars-game').addEventListener('change', (e) => { state.barsGame = e.target.value; render(); });
  $('#btn-add-turma').addEventListener('click', () => {
    const inp = $('#new-turma'), nome = inp.value.trim();
    if (!nome) { setStatus('Escreva o nome da turma.'); return; }
    const t = { id: 't' + newId(), nome };
    state.turmas.push(t);
    state.filtro = t.id;
    inp.value = '';
    save(); render();
    setStatus('Turma "' + nome + '" criada. Abra a ficha de um aluno para colocá-lo nela.');
  });
  $('#new-turma').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('#btn-add-turma').click(); } });
  $('#btn-rm-turma').addEventListener('click', function () {
    if (this.dataset.arm !== '1') {
      this.dataset.arm = '1'; this.textContent = 'Clique de novo para remover';
      setTimeout(() => { this.dataset.arm = ''; this.textContent = 'Remover turma'; }, 3000);
      return;
    }
    const id = state.filtro;
    state.turmas = state.turmas.filter((t) => t.id !== id);
    Object.values(state.alunos).forEach((a) => { if (a.turmaId === id) a.turmaId = null; });
    state.filtro = 'todas';
    this.dataset.arm = ''; this.textContent = 'Remover turma';
    save(); render();
    setStatus('Turma removida. Os alunos continuam na lista, sem turma.');
  });

  // colar dados
  $('#btn-paste').addEventListener('click', () => { const b = $('#pastebox'); b.hidden = !b.hidden; if (!b.hidden) $('#paste-area').focus(); });
  $('#paste-add').addEventListener('click', () => {
    const o = addFromText($('#paste-area').value);
    setStatus(reportAdd(o));
    if (o.novo || o.igual) $('#paste-area').value = '';
  });
  $('#rm-examples').addEventListener('click', () => { state.examples = false; save(); render(); setStatus('Exemplos removidos.'); });

  // arquivos
  $('#btn-csv').addEventListener('click', function () {
    const btn = this, csv = summaryCsv(), box = $('#csvbox'), area = $('#csv-area');
    area.value = csv;
    copyText(csv, () => { box.hidden = true; flash(btn, 'CSV copiado'); }, () => { box.hidden = false; area.focus(); area.select(); });
  });
  $('#btn-csv-dl').addEventListener('click', () => { download('esplay-resumo.csv', BOM + summaryCsv(), 'text/csv;charset=utf-8'); setStatus('Resumo baixado.'); });
  $('#btn-hist-dl').addEventListener('click', () => { download('esplay-historico.csv', BOM + historyCsv(), 'text/csv;charset=utf-8'); setStatus('Histórico baixado.'); });
  $('#btn-json-dl').addEventListener('click', () => {
    if (!state.leituras.length && !state.turmas.length) { setStatus('Ainda não há dados reais para salvar. Os exemplos não entram na cópia.'); return; }
    download('esplay-painel.json', exportJson(), 'application/json');
    setStatus('Cópia salva. Guarde o arquivo: ele tem nomes e turmas.');
  });
  $('#btn-json-up').addEventListener('click', () => $('#file-json').click());
  $('#file-json').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const res = importData(JSON.parse(await f.text()));
      setStatus(res ? `Cópia aberta: ${res.leituras} leituras, ${res.alunos} alunos e ${res.turmas} turmas adicionados.` : 'Esse arquivo não é uma cópia do painel ESPlay.');
    } catch (err) {
      setStatus('Não consegui ler esse arquivo.');
    }
  });
  $('#btn-clear').addEventListener('click', function () {
    if (this.dataset.arm !== '1') {
      this.dataset.arm = '1'; this.textContent = 'Clique de novo para apagar';
      setTimeout(() => { this.dataset.arm = ''; this.textContent = 'Limpar tudo'; }, 3000);
      return;
    }
    state.turmas = []; state.alunos = {}; state.leituras = []; state.customGames = {}; state.examples = false; state.filtro = 'todas'; state.ficha = null;
    save(); render();
    this.dataset.arm = ''; this.textContent = 'Limpar tudo';
    setStatus('Todos os dados foram apagados deste navegador.');
  });

  // leitura pela porta serial (Chrome e Edge no computador)
  $('#btn-serial').addEventListener('click', async () => {
    if (!('serial' in navigator)) { setStatus('Este navegador não tem acesso à porta USB. Use o Chrome ou o Edge no computador, ou use Colar dados.'); return; }
    let port, reader, writer, closed, got = '', timer;
    try {
      port = await navigator.serial.requestPort();
      await port.open({ baudRate: 115200 });
    } catch (e) {
      setStatus('Não foi possível abrir a porta. Se esta página estiver dentro de outra, abra-a em uma aba própria, ou use Colar dados.');
      return;
    }
    setStatus('Conectado. Aguardando o console responder (cerca de 3 segundos)…');
    try {
      const dec = new TextDecoderStream();
      closed = port.readable.pipeTo(dec.writable).catch(() => {});
      reader = dec.readable.getReader();
      writer = port.writable.getWriter();
      const enc = new TextEncoder();
      const send = () => writer.write(enc.encode('ESPLAY?\n')).catch(() => {});
      setTimeout(send, 1500);
      setTimeout(() => { if (!got) send(); }, 3500);
      timer = setTimeout(() => reader.cancel().catch(() => {}), 9000);
      let buf = '';
      while (true) {
        const res = await reader.read();
        if (res.done) break;
        buf += res.value;
        let k;
        while ((k = buf.indexOf('\n')) >= 0) {
          const line = buf.slice(0, k).trim();
          buf = buf.slice(k + 1);
          if (line.charAt(0) === '{') {
            try {
              const out = addReading(JSON.parse(line));
              if (out) { got = out; clearTimeout(timer); await reader.cancel(); }
            } catch (e) { /* linha que não é JSON */ }
          }
        }
      }
    } catch (e) { /* porta fechada */ } finally {
      try { if (writer) writer.releaseLock(); } catch (e) { /* ignora */ }
      try { if (closed) await closed; } catch (e) { /* ignora */ }
      try { await port.close(); } catch (e) { /* ignora */ }
    }
    setStatus(
      got === 'novo' ? 'Leitura salva. Troque de console e leia o próximo aluno.'
        : got === 'igual' ? 'Esse console não tem partidas novas desde a última leitura.'
        : 'O console não respondeu. Confira se há um jogo gravado com a biblioteca ESPlay e tente de novo.'
    );
  });

  return { addReading, registerGameMeta };
}
