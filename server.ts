// Servidor local do site ESPlay.
// Uso: bun run dev   ->   http://localhost:3000
import { resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const PUBLIC_DIR = resolve(fileURLToPath(new URL("./public/", import.meta.url)));
const PORT = Number(process.env.PORT ?? 3000);

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    let path = decodeURIComponent(new URL(req.url).pathname);
    if (path.endsWith("/")) path += "index.html";

    // impede acessar arquivos fora da pasta public/
    const full = resolve(PUBLIC_DIR, "." + path);
    if (full !== PUBLIC_DIR && !full.startsWith(PUBLIC_DIR + sep)) {
      return new Response("Acesso negado", { status: 403 });
    }

    const file = Bun.file(full);
    if (!(await file.exists())) {
      return new Response("Página não encontrada", { status: 404 });
    }

    // sem cache, para ver cada alteração ao atualizar a página
    return new Response(file, { headers: { "Cache-Control": "no-store" } });
  },
});

console.log(`ESPlay rodando em http://localhost:${server.port}`);
