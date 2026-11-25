// Funções pequenas usadas pelos outros arquivos.

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
export const zeros = (n) => Array.from({ length: n }, () => 0);

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// Troca o texto de um botão por alguns segundos.
export function flash(btn, msg, ms = 1800) {
  const old = btn.getAttribute('data-label') || btn.textContent;
  btn.setAttribute('data-label', old);
  btn.textContent = msg;
  setTimeout(() => { btn.textContent = old; }, ms);
}

export function selectNode(node) {
  const r = document.createRange();
  r.selectNodeContents(node);
  const s = window.getSelection();
  s.removeAllRanges();
  s.addRange(r);
}

// Copia um texto; se o navegador recusar, chama onFail para mostrar o texto selecionável.
export function copyText(text, onOk, onFail) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(onOk, onFail);
  } else {
    onFail();
  }
}

// Baixa um arquivo de texto gerado na hora.
export function download(name, text, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

// Lê games/games.json uma única vez.
let gamesPromise = null;
export function loadGames() {
  if (!gamesPromise) {
    gamesPromise = fetch('games/games.json')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('games.json'))))
      .catch(() => ({ games: [] }));
  }
  return gamesPromise;
}
