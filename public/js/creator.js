// Criador de jogos (quizzes): formulário de perguntas, categorias, prévia jogável e exportação .ino.

import { $, $$, esc, flash, selectNode, copyText, download } from './util.js';
import { CustomQuizGame, normalizeAscii } from './preview.js';

const STORAGE_KEY = 'esplay.criador.v1';

const TEMPLATES = {
  historia: {
    nome: 'Quiz Historia',
    id: 'quizhistoria',
    materia: 'História',
    ano: '6º ao 8º ano do Ensino Fundamental',
    tag: 'periodo',
    total: 0,
    tempo: 0,
    embaralhar: true,
    categorias: [
      { id: 1, nome: 'Brasil Colônia' },
      { id: 2, nome: 'Império' },
      { id: 3, nome: 'República' },
    ],
    perguntas: [
      {
        pergunta: 'Em que ano os portugueses chegaram ao Brasil?',
        opcoes: ['1492', '1500', '1530'],
        correta: 1,
        cat: 1,
        explicacao: 'Pedro Alvares Cabral chegou em 1500',
      },
      {
        pergunta: 'Qual foi o primeiro produto explorado pelos europeus?',
        opcoes: ['Pau-brasil', 'Cafe', 'Ouro'],
        correta: 0,
        cat: 1,
        explicacao: 'O pau-brasil foi extraido no inicio da colonizacao',
      },
      {
        pergunta: 'Quem proclamou a Independencia em 1822?',
        opcoes: ['Tiradentes', 'D. Pedro I', 'Deodoro'],
        correta: 1,
        cat: 2,
        explicacao: 'D. Pedro I proclamou em 7 de setembro de 1822',
      },
      {
        pergunta: 'Qual lei aboliu a escravidao no Brasil em 1888?',
        opcoes: ['Lei Aurea', 'Lei do Ventre Livre', 'Eusebio'],
        correta: 0,
        cat: 2,
        explicacao: 'A Lei Aurea foi assinada em 13 de maio de 1888',
      },
      {
        pergunta: 'Em que ano foi proclamada a Republica no Brasil?',
        opcoes: ['1822', '1889', '1930'],
        correta: 1,
        cat: 3,
        explicacao: 'A Republica foi proclamada em 15 de novembro de 1889',
      },
    ],
  },
  ingles: {
    nome: 'EnglishQuiz',
    id: 'englishquiz',
    materia: 'Inglês',
    ano: '4º ao 6º ano do Ensino Fundamental',
    tag: 'vocabulario',
    total: 0,
    tempo: 15,
    embaralhar: true,
    categorias: [
      { id: 1, nome: 'Cores' },
      { id: 2, nome: 'Animais' },
      { id: 3, nome: 'Números' },
    ],
    perguntas: [
      {
        pergunta: 'Como se diz AZUL em ingles?',
        opcoes: ['RED', 'BLUE', 'GREEN'],
        correta: 1,
        cat: 1,
        explicacao: 'BLUE significa azul',
      },
      {
        pergunta: 'Qual cor e YELLOW em portugues?',
        opcoes: ['Amarelo', 'Laranja', 'Roxo'],
        correta: 0,
        cat: 1,
        explicacao: 'YELLOW = amarelo',
      },
      {
        pergunta: 'O que significa BIRD?',
        opcoes: ['Peixe', 'Passaro', 'Gato'],
        correta: 1,
        cat: 2,
        explicacao: 'BIRD significa passaro',
      },
      {
        pergunta: 'Como se escreve CACHORRO em ingles?',
        opcoes: ['CAT', 'DOG', 'FROG'],
        correta: 1,
        cat: 2,
        explicacao: 'DOG = cachorro',
      },
      {
        pergunta: 'Qual numero e TWELVE?',
        opcoes: ['12', '20', '2'],
        correta: 0,
        cat: 3,
        explicacao: 'TWELVE = 12 (doze)',
      },
    ],
  },
};

const blankState = () => ({
  nome: 'Meu Quiz',
  id: 'meuquiz',
  materia: 'Geral',
  ano: 'Ensino Fundamental',
  tag: 'tema',
  total: 0,
  tempo: 0,
  embaralhar: true,
  categorias: [{ id: 1, nome: 'Geral' }],
  perguntas: [
    {
      pergunta: 'Qual planeta e conhecido como Planeta Vermelho?',
      opcoes: ['Marte', 'Jupiter', 'Saturno'],
      correta: 0,
      cat: 1,
      explicacao: 'Marte tem solo rico em oxido de ferro',
    },
  ],
});

const slugId = (s) =>
  normalizeAscii(s)
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, '')
    .slice(0, 15) || 'meuquiz';

const cleanTag = (s) =>
  normalizeAscii(s)
    .toLowerCase()
    .replace(/["'\\]/g, '')
    .trim()
    .slice(0, 15) || 'item';

const cppStr = (s) =>
  normalizeAscii(s)
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[\r\n]+/g, ' ')
    .trim();

function loadCreator() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && Array.isArray(parsed.perguntas)) return parsed;
    }
  } catch (e) { /* ignora */ }
  return structuredClone(TEMPLATES.historia);
}

function generateIno(st) {
  const validQs = st.perguntas.filter((q) => q.pergunta.trim() && q.opcoes.some((o) => o.trim()));
  if (!validQs.length) {
    return '// Adicione ao menos 1 pergunta com enunciado e alternativas para gerar o codigo.';
  }

  const gameId = slugId(st.id || st.nome);
  const gameName = cppStr(st.nome || 'Meu Quiz').slice(0, 24) || 'Meu Quiz';
  const tagName = cleanTag(st.tag || 'tema');
  const titleUpper = cppStr(st.nome || 'MEU QUIZ').toUpperCase().slice(0, 18);

  const catComment = st.categorias
    .map((c) => `//     ${c.id} = ${cppStr(c.nome)}`)
    .join('\n');

  const items = validQs
    .map((q) => {
      const ops = [0, 1, 2].map((i) => `"${cppStr(q.opcoes[i] || '-').slice(0, 18)}"`);
      const cat = Math.max(0, Math.min(15, parseInt(q.cat, 10) || 1));
      const cor = Math.max(0, Math.min(2, parseInt(q.correta, 10) || 0));
      return `  {"${cppStr(q.pergunta).slice(0, 64)}", {${ops.join(', ')}}, ${cor}, ${cat}, "${cppStr(q.explicacao || '').slice(0, 48)}"}`;
    })
    .join(',\n');

  return `/*
  ${gameName} — quiz criado no site do ESPlay
  -------------------------------------------------
  Materia: ${cppStr(st.materia || 'Geral')}   |   Area: ${tagName}

  Requer a biblioteca ESPlay (instalar uma unica vez).
  Categorias no painel do professor:
${catComment || '//     1 = Geral'}
*/

#include <ESPlay.h>

ESPlay esp;

// ====== AJUSTES PARA O PROFESSOR ======
const int  QTD_PERGUNTAS  = ${parseInt(st.total, 10) || 0};     // 0 = todas do banco
const int  TEMPO_PERGUNTA = ${parseInt(st.tempo, 10) || 0};     // segundos por pergunta (0 = sem limite)
const bool EMBARALHAR     = ${st.embaralhar ? 'true' : 'false'};  // sortear ordem das perguntas
// ======================================

struct Pergunta {
  const char* enunciado;
  const char* opcoes[3];
  uint8_t correta;      // 0, 1 ou 2
  uint8_t cat;          // categoria (0..15)
  const char* explicacao;
};

const Pergunta BANCO[] = {
${items}
};

const int NUM_PERGUNTAS = sizeof(BANCO) / sizeof(BANCO[0]);

enum Tela { TITULO, JOGANDO, ACERTO, FEEDBACK, FIM };
Tela tela = TITULO;

int ordem[NUM_PERGUNTAS];
int posOrdem = 0;
int perguntaAtual = 0;
int totalRodada = 0;
int selecao = 0;
int acertos = 0;
int score = 0;
bool novoRecorde = false;
bool tempoEsgotado = false;
int timerFrames = 0;
int esperaFrames = 0;
Pergunta atual;

void prepararOrdem() {
  for (int i = 0; i < NUM_PERGUNTAS; i++) ordem[i] = i;
  if (EMBARALHAR) {
    for (int i = NUM_PERGUNTAS - 1; i > 0; i--) {
      int j = random(0, i + 1);
      int tmp = ordem[i];
      ordem[i] = ordem[j];
      ordem[j] = tmp;
    }
  }
  posOrdem = 0;
}

void proximaPergunta() {
  if (posOrdem >= NUM_PERGUNTAS) prepararOrdem();
  atual = BANCO[ordem[posOrdem++]];
  selecao = 0;
  tempoEsgotado = false;
  timerFrames = (TEMPO_PERGUNTA > 0) ? TEMPO_PERGUNTA * 30 : 0;
  perguntaAtual++;
  tela = JOGANDO;
}

void novoJogo() {
  totalRodada = (QTD_PERGUNTAS > 0 && QTD_PERGUNTAS < NUM_PERGUNTAS) ? QTD_PERGUNTAS : NUM_PERGUNTAS;
  perguntaAtual = 0;
  acertos = 0;
  score = 0;
  novoRecorde = false;
  prepararOrdem();
  proximaPergunta();
}

void avancarOuFim() {
  if (perguntaAtual >= totalRodada) {
    novoRecorde = esp.gameOver(score);
    tela = FIM;
  } else {
    proximaPergunta();
  }
}

void textoQuebrado(int x, int y, int maxLarg, int altLinha, const char* s) {
  int maxChars = maxLarg / 6;
  if (maxChars < 4) maxChars = 4;
  int len = strlen(s);
  int pos = 0;
  int cy = y;
  while (pos < len) {
    while (pos < len && s[pos] == ' ') pos++;
    if (pos >= len) break;
    int fim = pos + maxChars;
    if (fim >= len) {
      fim = len;
    } else {
      int k = fim;
      while (k > pos && s[k] != ' ') k--;
      if (k > pos) fim = k;
    }
    char linha[32];
    int n = fim - pos;
    if (n >= (int)sizeof(linha)) n = sizeof(linha) - 1;
    memcpy(linha, s + pos, n);
    linha[n] = 0;
    esp.text(x, cy, linha, 1);
    cy += altLinha;
    pos = fim;
  }
}

void atualizar() {
  if (tela == TITULO || tela == FIM) {
    if (esp.pressed(BTN_ACTION)) novoJogo();
    return;
  }

  if (tela == ACERTO) {
    esperaFrames--;
    if (esperaFrames <= 0 || esp.pressed(BTN_ACTION)) avancarOuFim();
    return;
  }

  if (tela == FEEDBACK) {
    if (esp.pressed(BTN_ACTION)) avancarOuFim();
    return;
  }

  if (esp.pressed(BTN_UP)) selecao = (selecao + 2) % 3;
  if (esp.pressed(BTN_DOWN)) selecao = (selecao + 1) % 3;

  if (TEMPO_PERGUNTA > 0) {
    timerFrames--;
    if (timerFrames <= 0) {
      esp.recordMiss(atual.cat);
      tempoEsgotado = true;
      tela = FEEDBACK;
      return;
    }
  }

  if (esp.pressed(BTN_ACTION)) {
    if (selecao == atual.correta) {
      score += 10;
      acertos++;
      esp.recordHit(atual.cat);
      esperaFrames = 18;
      tela = ACERTO;
    } else {
      esp.recordMiss(atual.cat);
      tempoEsgotado = false;
      tela = FEEDBACK;
    }
  }
}

void desenhar() {
  int w = esp.width();
  int h = esp.height();
  esp.clear();

  if (tela == TITULO) {
    uint8_t sz = ((int)strlen("${titleUpper}") * 12 <= w - 4) ? 2 : 1;
    esp.textCenter(w / 2, sz == 2 ? 0 : 4, "${titleUpper}", sz);
    esp.text(0, 22, "Aluno:");
    esp.number(42, 22, esp.studentId());
    esp.text(0, 33, "Recorde:");
    esp.number(54, 33, esp.best());
    esp.textCenter(w / 2, h - 10, "Aperte ACAO", 1);
    esp.show();
    return;
  }

  if (tela == FIM) {
    esp.textCenter(w / 2, 0, "FIM DA RODADA", 1);
    esp.line(0, 10, w - 1, 10, true);
    char resumo[24];
    snprintf(resumo, sizeof(resumo), "Acertos: %d/%d", acertos, totalRodada);
    esp.text(0, 15, resumo);
    esp.text(0, 26, "Pts:");
    esp.number(30, 26, score);
    if (novoRecorde) {
      esp.text(0, 38, "NOVO RECORDE!");
    } else {
      esp.text(0, 38, "Recorde:");
      esp.number(54, 38, esp.best());
    }
    esp.textCenter(w / 2, h - 10, "ACAO: jogar de novo", 1);
    esp.show();
    return;
  }

  if (tela == ACERTO) {
    esp.textCenter(w / 2, 14, "CORRETO!", 2);
    esp.textCenter(w / 2, 36, "+10 pontos", 1);
    esp.show();
    return;
  }

  if (tela == FEEDBACK) {
    esp.text(0, 0, tempoEsgotado ? "TEMPO ESGOTADO!" : "RESPOSTA CERTA:");
    textoQuebrado(0, 12, w, 10, atual.opcoes[atual.correta]);
    if (atual.explicacao[0] != 0) {
      textoQuebrado(0, 26, w, 10, atual.explicacao);
    }
    esp.textCenter(w / 2, h - 10, "ACAO: continuar", 1);
    esp.show();
    return;
  }

  char topo[24];
  if (TEMPO_PERGUNTA > 0) {
    int seg = (timerFrames + 29) / 30;
    snprintf(topo, sizeof(topo), "%d/%d %ds", perguntaAtual, totalRodada, seg);
  } else {
    snprintf(topo, sizeof(topo), "%d/%d", perguntaAtual, totalRodada);
  }
  esp.text(0, 0, topo);

  char pts[12];
  snprintf(pts, sizeof(pts), "P:%d", score);
  esp.text(w - (int)strlen(pts) * 6, 0, pts);

  textoQuebrado(0, 10, w, 9, atual.enunciado);
  esp.line(0, 29, w - 1, 29, true);

  for (int i = 0; i < 3; i++) {
    int oy = 33 + i * 10;
    char lin[24];
    snprintf(lin, sizeof(lin), "%d. %.17s", i + 1, atual.opcoes[i]);
    if (i == selecao) {
      esp.fillRect(0, oy - 1, w, 9, true);
      esp.text(4, oy, lin, 1, false);
    } else {
      esp.text(4, oy, lin, 1, true);
    }
  }
  esp.show();
}

void setup() {
  esp.begin("${gameId}", "${gameName}", "${tagName}");
}

void loop() {
  if (esp.tick(30)) {
    atualizar();
    desenhar();
  }
}
`;
}

function generateLibrarySnippet(st) {
  const id = slugId(st.id || st.nome);
  const tagRotulos = Object.fromEntries(st.categorias.map((c) => [String(c.id), c.nome]));
  return JSON.stringify(
    {
      id,
      nome: st.nome || 'Meu Quiz',
      materia: st.materia || 'Geral',
      assunto: st.tag || 'Quiz personalizado',
      tag: cleanTag(st.tag || 'tema'),
      ano: st.ano || null,
      modelo: 'Quiz de múltipla escolha',
      status: 'disponivel',
      preview: null,
      arquivo: `games/${id}.ino`,
      resumo: `Quiz educativo criado para ${st.materia || 'a turma'}.`,
      treina: st.categorias.map((c) => c.nome).join(', '),
      comoJoga: [
        ['Cima e baixo', 'Alternam entre as 3 opções'],
        ['Ação', 'Confirma a escolha e inicia ou reinicia a partida'],
      ],
      categorias: st.categorias.map((c) => `${c.id} ${c.nome}`),
      tagRotulos,
      aoErrar: 'Mostra a alternativa correta e uma explicação curta.',
      professorAjusta: 'Quantidade de perguntas, tempo por pergunta e ordem embaralhada.',
      fimPartida: `${st.total > 0 ? st.total : st.perguntas.length} perguntas por rodada.`,
      observacao: null,
    },
    null,
    2
  );
}

export function initCreator({ makeConsole, addRunner, onSend, onRegisterMeta }) {
  let state = loadCreator();
  let idManual = false;

  const con = makeConsole($('#creator-console'), 'Tela do console com a prévia do jogo criado');
  const game = new CustomQuizGame(con.scr, state);
  const runner = addRunner(con, game, null);

  function save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch (e) { /* ignora */ }
  }

  function refreshJson() {
    const s = game.stats;
    const id = slugId(state.id || state.nome);
    const nome = cppStr(state.nome || 'Meu Quiz') || 'Meu Quiz';
    const tag = cleanTag(state.tag || 'tema');
    $('#creator-livejson').textContent =
      '{\n  "esplay": 1,\n  "student": ' + game.sid + ',\n  "game": "' + id + '",\n  "name": "' + nome + '",\n  "tag": "' + tag + '",\n' +
      '  "best": ' + s.best + ',\n  "plays": ' + s.plays + ',\n  "hits": ' + s.hits + ',\n  "misses": ' + s.misses + ',\n' +
      '  "last": [' + s.last.join(', ') + '],\n  "tagHits": [' + s.tagHits.join(', ') + '],\n  "tagMisses": [' + s.tagMisses.join(', ') + ']\n}';
  }
  game.onSave = refreshJson;

  function syncOutputs() {
    save();
    const valid = state.perguntas.filter((q) => q.pergunta.trim() && q.opcoes.some((o) => o.trim()));
    $('#creator-ino-name').textContent = (slugId(state.id || state.nome) || 'meuquiz') + '.ino';
    $('#creator-code').textContent = generateIno(state);
    $('#creator-lib-json').textContent = generateLibrarySnippet(state);
    $('#creator-qcount').textContent = `${valid.length} ${valid.length === 1 ? 'pergunta' : 'perguntas'}`;
    game.setQuiz(state);
    game.draw();
    refreshJson();
  }

  function renderMetaInputs() {
    $('#cr-nome').value = state.nome;
    $('#cr-id').value = state.id;
    $('#cr-materia').value = state.materia || '';
    $('#cr-ano').value = state.ano || '';
    $('#cr-tag').value = state.tag || '';
    $('#cr-total').value = String(state.total || 0);
    $('#cr-tempo').value = String(state.tempo || 0);
    $('#cr-emb').checked = state.embaralhar !== false;
  }

  function renderCategorias() {
    const box = $('#cr-cats');
    box.innerHTML = state.categorias
      .map(
        (c, idx) => `<div class="cat-item" data-cidx="${idx}">
          <span class="mono muted">${c.id}</span>
          <input type="text" maxlength="24" value="${esc(c.nome)}" aria-label="Nome da categoria ${c.id}" data-cat-name="${idx}">
          ${state.categorias.length > 1 ? `<button class="btn small" type="button" data-cat-rm="${idx}" aria-label="Remover categoria ${esc(c.nome)}">×</button>` : ''}
        </div>`
      )
      .join('');
    $('#cr-add-cat').disabled = state.categorias.length >= 15;
  }

  function renderQuestions() {
    const box = $('#cr-questions');
    if (!state.perguntas.length) {
      box.innerHTML = '<p class="muted">Nenhuma pergunta ainda. Clique em "+ Nova pergunta" para começar.</p>';
      return;
    }
    const catOpts = (sel) =>
      state.categorias
        .map((c) => `<option value="${c.id}"${Number(sel) === c.id ? ' selected' : ''}>${c.id}. ${esc(c.nome)}</option>`)
        .join('');

    box.innerHTML = state.perguntas
      .map(
        (q, qi) => `<div class="qcard" data-qi="${qi}">
          <div class="qcard-head">
            <b>Pergunta ${qi + 1}</b>
            <div class="qcard-acts">
              <button class="btn small" type="button" data-qact="up" ${qi === 0 ? 'disabled' : ''} aria-label="Subir pergunta ${qi + 1}">↑</button>
              <button class="btn small" type="button" data-qact="down" ${qi === state.perguntas.length - 1 ? 'disabled' : ''} aria-label="Descer pergunta ${qi + 1}">↓</button>
              <button class="btn small" type="button" data-qact="dup" aria-label="Duplicar pergunta ${qi + 1}">Duplicar</button>
              <button class="btn small" type="button" data-qact="rm" aria-label="Remover pergunta ${qi + 1}">Remover</button>
            </div>
          </div>
          <label class="field">Enunciado (até 64 caracteres, aparece sem acento no console)
            <input type="text" maxlength="64" data-qfield="pergunta" value="${esc(q.pergunta)}" placeholder="Ex.: Em que ano comecou a Republica?">
          </label>
          <div class="qcard-row">
            <label class="field">Categoria (para o painel do professor)
              <select data-qfield="cat">${catOpts(q.cat)}</select>
            </label>
            <label class="field">Explicação ao errar (opcional)
              <input type="text" maxlength="48" data-qfield="explicacao" value="${esc(q.explicacao || '')}" placeholder="Ex.: Proclamada em 1889">
            </label>
          </div>
          <div class="qopts" role="radiogroup" aria-label="Alternativas da pergunta ${qi + 1}">
            ${[0, 1, 2]
              .map(
                (oi) => `<div class="qopt">
                  <label class="qopt-mark">
                    <input type="radio" name="qcor-${qi}" value="${oi}" ${Number(q.correta) === oi ? 'checked' : ''} data-qcor="${oi}">
                    <span>Certa</span>
                  </label>
                  <input type="text" maxlength="18" value="${esc(q.opcoes[oi] || '')}" data-qopt="${oi}" placeholder="Alternativa ${oi + 1} (até 18 letras)" aria-label="Alternativa ${oi + 1} da pergunta ${qi + 1}">
                </div>`
              )
              .join('')}
          </div>
        </div>`
      )
      .join('');
  }

  function renderAll() {
    renderMetaInputs();
    renderCategorias();
    renderQuestions();
    syncOutputs();
  }

  /* ---------- Eventos dos metadados ---------- */
  $('#cr-nome').addEventListener('input', (e) => {
    state.nome = e.target.value;
    if (!idManual) {
      state.id = slugId(state.nome);
      $('#cr-id').value = state.id;
    }
    syncOutputs();
  });
  $('#cr-id').addEventListener('input', (e) => {
    idManual = true;
    state.id = slugId(e.target.value);
    syncOutputs();
  });
  $('#cr-id').addEventListener('blur', (e) => {
    e.target.value = state.id;
  });
  $('#cr-materia').addEventListener('input', (e) => { state.materia = e.target.value; syncOutputs(); });
  $('#cr-ano').addEventListener('input', (e) => { state.ano = e.target.value; syncOutputs(); });
  $('#cr-tag').addEventListener('input', (e) => { state.tag = e.target.value; syncOutputs(); });
  $('#cr-total').addEventListener('change', (e) => { state.total = parseInt(e.target.value, 10) || 0; syncOutputs(); });
  $('#cr-tempo').addEventListener('change', (e) => { state.tempo = parseInt(e.target.value, 10) || 0; syncOutputs(); });
  $('#cr-emb').addEventListener('change', (e) => { state.embaralhar = e.target.checked; syncOutputs(); });

  /* ---------- Eventos das categorias ---------- */
  $('#cr-add-cat').addEventListener('click', () => {
    if (state.categorias.length >= 15) return;
    const used = new Set(state.categorias.map((c) => c.id));
    let next = 1;
    while (used.has(next) && next <= 15) next++;
    if (next > 15) return;
    state.categorias.push({ id: next, nome: 'Tema ' + next });
    renderCategorias();
    renderQuestions();
    syncOutputs();
  });

  $('#cr-cats').addEventListener('input', (e) => {
    const idx = e.target.getAttribute('data-cat-name');
    if (idx === null) return;
    state.categorias[Number(idx)].nome = e.target.value;
    save();
    renderQuestions();
    $('#creator-code').textContent = generateIno(state);
    $('#creator-lib-json').textContent = generateLibrarySnippet(state);
  });

  $('#cr-cats').addEventListener('click', (e) => {
    const rm = e.target.getAttribute('data-cat-rm');
    if (rm === null || state.categorias.length <= 1) return;
    const removed = state.categorias.splice(Number(rm), 1)[0];
    const fallback = state.categorias[0].id;
    state.perguntas.forEach((q) => { if (Number(q.cat) === removed.id) q.cat = fallback; });
    renderCategorias();
    renderQuestions();
    syncOutputs();
  });

  /* ---------- Eventos das perguntas ---------- */
  $('#cr-add-q').addEventListener('click', () => {
    const firstCat = state.categorias[0] ? state.categorias[0].id : 1;
    state.perguntas.push({ pergunta: '', opcoes: ['', '', ''], correta: 0, cat: firstCat, explicacao: '' });
    renderQuestions();
    syncOutputs();
    const inputs = $$('[data-qfield="pergunta"]', $('#cr-questions'));
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  $('#cr-questions').addEventListener('input', (e) => {
    const card = e.target.closest('.qcard');
    if (!card) return;
    const qi = Number(card.getAttribute('data-qi'));
    const q = state.perguntas[qi];
    if (!q) return;

    const field = e.target.getAttribute('data-qfield');
    if (field === 'pergunta') q.pergunta = e.target.value;
    else if (field === 'explicacao') q.explicacao = e.target.value;
    else if (e.target.hasAttribute('data-qopt')) {
      const oi = Number(e.target.getAttribute('data-qopt'));
      q.opcoes[oi] = e.target.value;
    }
    syncOutputs();
  });

  $('#cr-questions').addEventListener('change', (e) => {
    const card = e.target.closest('.qcard');
    if (!card) return;
    const qi = Number(card.getAttribute('data-qi'));
    const q = state.perguntas[qi];
    if (!q) return;

    if (e.target.getAttribute('data-qfield') === 'cat') {
      q.cat = parseInt(e.target.value, 10) || 1;
    } else if (e.target.hasAttribute('data-qcor')) {
      q.correta = parseInt(e.target.getAttribute('data-qcor'), 10) || 0;
    }
    syncOutputs();
  });

  $('#cr-questions').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-qact]');
    if (!btn) return;
    const card = btn.closest('.qcard');
    const qi = Number(card.getAttribute('data-qi'));
    const act = btn.getAttribute('data-qact');
    if (act === 'up' && qi > 0) {
      [state.perguntas[qi - 1], state.perguntas[qi]] = [state.perguntas[qi], state.perguntas[qi - 1]];
    } else if (act === 'down' && qi < state.perguntas.length - 1) {
      [state.perguntas[qi + 1], state.perguntas[qi]] = [state.perguntas[qi], state.perguntas[qi + 1]];
    } else if (act === 'dup') {
      const copy = structuredClone(state.perguntas[qi]);
      state.perguntas.splice(qi + 1, 0, copy);
    } else if (act === 'rm') {
      state.perguntas.splice(qi, 1);
    }
    renderQuestions();
    syncOutputs();
  });

  /* ---------- Modelos, importar, exportar, copiar e painel ---------- */
  const setStatus = (msg) => { $('#cr-status').textContent = msg; };

  $('#cr-tpl-hist').addEventListener('click', () => {
    state = structuredClone(TEMPLATES.historia);
    idManual = false;
    renderAll();
    setStatus('Modelo de História carregado.');
  });
  $('#cr-tpl-ing').addEventListener('click', () => {
    state = structuredClone(TEMPLATES.ingles);
    idManual = false;
    renderAll();
    setStatus('Modelo de Inglês carregado.');
  });
  $('#cr-tpl-blank').addEventListener('click', () => {
    state = blankState();
    idManual = false;
    renderAll();
    setStatus('Quiz limpo para você começar do zero.');
  });

  $('#cr-json-dl').addEventListener('click', () => {
    const id = slugId(state.id || state.nome);
    download(`${id}-quiz.json`, JSON.stringify({ esplay_quiz: 1, ...state }, null, 2), 'application/json');
    setStatus('Arquivo do quiz salvo.');
  });
  $('#cr-json-up').addEventListener('click', () => $('#cr-file-json').click());
  $('#cr-file-json').addEventListener('change', async (e) => {
    const f = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      if (!o || !Array.isArray(o.perguntas)) throw new Error();
      state = {
        nome: String(o.nome || 'Meu Quiz'),
        id: slugId(o.id || o.nome || 'meuquiz'),
        materia: String(o.materia || 'Geral'),
        ano: String(o.ano || ''),
        tag: String(o.tag || 'tema'),
        total: parseInt(o.total, 10) || 0,
        tempo: parseInt(o.tempo, 10) || 0,
        embaralhar: o.embaralhar !== false,
        categorias: Array.isArray(o.categorias) && o.categorias.length ? o.categorias : [{ id: 1, nome: 'Geral' }],
        perguntas: o.perguntas,
      };
      idManual = true;
      renderAll();
      setStatus(`Quiz "${state.nome}" carregado.`);
    } catch (err) {
      setStatus('Não consegui ler esse arquivo de quiz.');
    }
  });

  $('#cr-copy-code').addEventListener('click', function () {
    const btn = this;
    const fail = () => { selectNode($('#creator-code')); flash(btn, 'Selecionado: Ctrl+C'); };
    copyText($('#creator-code').textContent, () => flash(btn, 'Copiado'), fail);
  });

  $('#cr-dl-code').addEventListener('click', () => {
    const id = slugId(state.id || state.nome);
    download(`${id}.ino`, $('#creator-code').textContent, 'text/plain;charset=utf-8');
  });

  $('#cr-copy-lib').addEventListener('click', function () {
    const btn = this;
    const fail = () => { selectNode($('#creator-lib-json')); flash(btn, 'Selecionado: Ctrl+C'); };
    copyText($('#creator-lib-json').textContent, () => flash(btn, 'Copiado'), fail);
  });

  $('#cr-restart').addEventListener('click', () => {
    game.setQuiz(state);
    game.draw();
    setStatus('Prévia reiniciada. Aperte Ação para jogar.');
  });

  $('#cr-send-panel').addEventListener('click', () => {
    const s = game.stats;
    const out = $('#cr-send-status');
    if (!s.plays) { out.textContent = 'Jogue uma partida até o fim primeiro.'; return; }
    const id = slugId(state.id || state.nome);
    const nome = cppStr(state.nome || 'Meu Quiz') || 'Meu Quiz';
    const tag = cleanTag(state.tag || 'tema');
    const tagRotulos = Object.fromEntries(state.categorias.map((c) => [String(c.id), c.nome]));

    if (onRegisterMeta) onRegisterMeta({ id, nome, tag, tagRotulos });
    const res = onSend({
      esplay: 1, student: game.sid, game: id, name: nome, tag,
      best: s.best, plays: s.plays, hits: s.hits, misses: s.misses,
      last: s.last.slice(), tagHits: s.tagHits.slice(), tagMisses: s.tagMisses.slice(),
    });
    out.textContent = res === 'igual'
      ? 'Sem partidas novas desde o último envio.'
      : `Enviado (${nome}). Veja o aluno 7 no painel do professor.`;
  });

  renderAll();

  return { console: con, runner };
}
