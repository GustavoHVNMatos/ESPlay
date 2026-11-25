// Copia os exemplos de jogos da biblioteca ESPlay para o site.
// Uso: bun run sync
// Assim o código mostrado na biblioteca de jogos é sempre o mesmo do firmware.
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));

const pairs: [string, string][] = [
  ["firmware/ESPlay/examples/PixelMath/PixelMath.ino", "public/games/pixelmath.ino"],
  ["firmware/ESPlay/examples/AcentoQuest/AcentoQuest.ino", "public/games/acentoquest.ino"],
  ["firmware/ESPlay/examples/CicloFis/CicloFis.ino", "public/games/ciclofis.ino"],
  ["firmware/ESPlay/examples/RegioMap/RegioMap.ino", "public/games/regiomap.ino"],
  ["firmware/ESPlay/examples/Algoritmando/Algoritmando.ino", "public/games/algoritmando.ino"],
];

for (const [from, to] of pairs) {
  await Bun.write(resolve(root, to), Bun.file(resolve(root, from)));
  console.log(`${from}  ->  ${to}`);
}
