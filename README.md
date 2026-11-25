# Site do ESPlay

Site estático (HTML, CSS e JavaScript puros) com um servidor local em Bun.

## Rodar

```bash
bun run dev
```

Abra http://localhost:3000. Para usar outra porta: `PORT=4000 bun run dev` (no Windows PowerShell: `$env:PORT=4000; bun run dev`).

O servidor desliga o cache do navegador. Salvou o arquivo, é só atualizar a página.

Não precisa instalar nada com `bun install`: o projeto não tem dependências.

O `localhost` conta como endereço seguro, então a leitura do console pela USB (Web Serial) funciona no Chrome e no Edge.

## O que editar para mudar cada coisa

| Quero mudar | Arquivo | Onde |
|---|---|---|
| Textos, seções, lista de peças, tabela de pinos, STL | `public/index.html` | seções `#sobre`, `#construa` e `#guia` |
| Jogos da biblioteca (cards, filtros, ficha) | `public/games/games.json` | um objeto por jogo (veja abaixo) |
| Cores, fontes, espaçamentos | `public/styles.css` | bloco `:root` no topo (claro) e os dois blocos escuros logo abaixo |
| Alunos de exemplo do painel, níveis (70% e 85%) | `public/js/painel.js` | dados de exemplo e função `nivel` |
| Tela simulada e lógica dos 5 jogos + quiz | `public/js/preview.js` | `W`, `H`, `Screen`, classes dos jogos e `CustomQuizGame` |
| Visualizador 3D da carcaça STL | `public/js/stlviewer.js` | `initStlViewer` (lê `public/downloads/CaseESPboyV4.stl`) |
| Cards, filtros, ajustes do professor e ficha na tela | `public/js/library.js` | `SETTINGS_UI`, `KEY_CAPTIONS` |
| Criador de jogos (modelos e gerador de `.ino`) | `public/js/creator.js` | `TEMPLATES` e `generateIno` |
| Código mostrado e copiado na biblioteca | `public/games/*.ino` | gerados a partir de `firmware/ESPlay/examples/` via `bun run sync` |
| Backend do display físico (OLED -> ST7735) e pinos | `firmware/ESPlay/src/ESPlay.h` e `ESPlay.cpp` | `begin()`, `clear()`, `show()` e construtor |

## Estrutura

```
server.ts                 servidor Bun
scripts/sync.ts           copia os 5 jogos da biblioteca para o site
scripts/zip.ts            gera o public/downloads/ESPlay.zip
public/
  index.html              página única
  styles.css
  img/case-esplay.png     imagem renderizada da carcaça final
  js/main.js              ponto de entrada e teclado
  js/util.js              funções pequenas
  js/stlviewer.js         visualizador 3D WebGL/Canvas do STL
  js/preview.js           tela simulada, botões, 5 jogos e motor de quiz
  js/library.js           biblioteca de jogos (lê games.json)
  js/creator.js           criador de jogos com prévia e exportação .ino
  js/painel.js            painel do professor
  games/games.json        dados dos 5 jogos
  games/*.ino             código exibido na biblioteca
  downloads/CaseESPboyV4.stl  carcaça final para impressão 3D
  downloads/ESPlay.zip    biblioteca para a Arduino IDE
firmware/ESPlay/          código-fonte da biblioteca ESPlay (src, examples)
```

Os arquivos em `public/js` são módulos ES: o site precisa ser aberto pelo servidor (`bun run dev`), não com duplo clique no HTML.

## games.json

Cada jogo tem: `id` (igual ao `gameId` do sketch), `nome`, `materia`, `assunto`, `tag`, `status` (`disponivel` ou `em-breve`), `ano`, `modelo`, `resumo`, `treina`, `comoJoga` (lista de `[botão, ação]`), `categorias`, `tagRotulos` (nome de cada categoria 0 a 15), `aoErrar`, `professorAjusta`, `fimPartida`, `observacao`, `arquivo` (o `.ino`) e `preview` (`pixelmath`, `acentoquest`, `ciclofis`, `regiomap` ou `algoritmando`). Para o PixelMath, `tagModelo` ("Tabuada do {n}") dá o nome das categorias.

As matérias dos filtros saem sozinhas dos jogos.

## Painel do professor

Os dados ficam só no navegador (localStorage, chave `esplay.painel.v2`): leituras do console, turmas, nomes dos alunos e rótulos de jogos criados no Criador. Nada é enviado a servidor. O professor pode baixar CSV (separado por `;`, abre no Excel em português) e uma cópia em JSON para abrir em outro computador.

## Fluxo para mexer no firmware

1. Edite a biblioteca ou os exemplos em `firmware/ESPlay/`.
2. `bun run sync` copia os 5 sketches para `public/games/`.
3. Atualize o `public/downloads/ESPlay.zip` (`bun run zip` no Linux/macOS, ou compacte a pasta `firmware/ESPlay` no Windows mantendo `ESPlay/` como raiz do zip).

## Publicar

A pasta `public/` é o site inteiro e pode ir para o GitHub Pages, Netlify ou qualquer hospedagem estática. O servidor Bun só serve para testar localmente.
