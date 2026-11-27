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

## Hardware validado

- **Placa:** ESP32 DevKit V1 (30 pinos)
- **Display:** TFT 1.8" 128×160 ST7735S (SPI, paisagem `160×128`, `INITR_GREENTAB`, `setRotation(1)`)
- **Alimentação:** externa via cabo USB (PC, notebook ou power bank externo)
- **Ligações do display:** `VCC/BLK -> 3V3`, `GND -> GND`, `SCL -> GPIO 18`, `SDA -> GPIO 23`, `RST -> GPIO 4`, `DC -> GPIO 2`, `CS -> GPIO 5`
- **Botões (`INPUT_PULLUP` para GND):** `CIMA -> 32`, `BAIXO -> 33`, `ESQUERDA -> 26`, `DIREITA -> 27`, `AÇÃO -> 25`
- **Bibliotecas Arduino:** `Adafruit GFX Library` e `Adafruit ST7735 and ST7789 Library` (além de `Preferences` do core ESP32). Os sketches são autônomos e não dependem de biblioteca externa do ESPlay.

## Estrutura

```
server.ts                     servidor Bun
scripts/sync.ts               copia os sketches da pasta sketches/ para public/games/
sketches/                     sketches Arduino autônomos (TesteBotoes + 5 jogos autorais)
public/
  index.html                  página única
  styles.css
  img/case-esplay.png         render da carcaça oficial
  img/esquema-ligacoes.svg    diagrama visual das ligações elétricas
  sw.js                       cache offline para hospedagem HTTPS
  js/main.js                  ponto de entrada e roteamento de teclado
  js/util.js                  funções pequenas
  js/stlviewer.js             visualizador 3D WebGL/Canvas do STL
  js/preview.js               tela colorida ST7735S 160×128, 5 jogos, quiz e menu
  js/library.js               biblioteca unitária de jogos (lê games.json)
  js/menu.js                  gerador opcional do Modo Menu Multi-Jogos
  js/creator.js               criador de jogos (quizzes) com prévia e exportação .ino
  js/painel.js                painel do professor (Web Serial, histórico, turmas, CSV/JSON)
  games/games.json            dados dos 5 jogos autorais
  games/*.ino                 códigos autônomos exibidos/baixados no site
  downloads/CaseESPboyV5.stl  STL oficial da carcaça (190 × 135 × 28 mm)
```

Os arquivos em `public/js` são módulos ES: o site precisa ser aberto pelo servidor (`bun run dev`), não com duplo clique no HTML.

## Fluxo para editar um sketch

1. Edite o arquivo em `sketches/<Nome>/<Nome>.ino`.
2. Rode `bun run sync` (ou `bun scripts/sync.ts`) para atualizar `public/games/`.

## Publicar gratuitamente (HTTPS obrigatório para USB / Web Serial)

A pasta `public/` é o site inteiro (sem etapa de build) e já inclui suporte offline (`sw.js`) quando publicada em HTTPS:

1. **GitHub Pages (recomendado se usar GitHub):** já existe o workflow pronto em `.github/workflows/pages.yml`. Suba o projeto na branch `main` e ative **Settings → Pages → Source: GitHub Actions**.
2. **Cloudflare Pages:** conecte o repositório e defina **Build output directory** como `public` (sem build command), ou faça upload direto da pasta `public/`.
3. **Netlify:** o arquivo `netlify.toml` já aponta `publish = "public"` — basta conectar o repositório ou arrastar a pasta `public/` no painel do Netlify Drop.
