// Copia os sketches standalone da pasta sketches/ para public/games/.
// Uso: bun run sync
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));

const pairs: [string, string][] = [
  ["sketches/TesteBotoes/TesteBotoes.ino", "public/games/testebotoes.ino"],
  ["sketches/PixelMath/PixelMath.ino", "public/games/pixelmath.ino"],
  ["sketches/AcentoQuest/AcentoQuest.ino", "public/games/acentoquest.ino"],
  ["sketches/CicloFis/CicloFis.ino", "public/games/ciclofis.ino"],
  ["sketches/RegioMap/RegioMap.ino", "public/games/regiomap.ino"],
  ["sketches/Algoritmando/Algoritmando.ino", "public/games/algoritmando.ino"],
];

for (const [from, to] of pairs) {
  await Bun.write(resolve(root, to), Bun.file(resolve(root, from)));
  console.log(`${from}  ->  ${to}`);
}
