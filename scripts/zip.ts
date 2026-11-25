// Gera public/downloads/ESPlay.zip a partir de firmware/ESPlay (funciona no Windows, Linux e macOS).
// Uso: bun run zip
import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateRawSync } from "node:zlib";

const root = resolve(fileURLToPath(new URL("../", import.meta.url)));
const srcDir = resolve(root, "firmware/ESPlay");
const outFile = resolve(root, "public/downloads/ESPlay.zip");

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function collect(dir: string, acc: string[] = []): string[] {
  for (const name of readdirSync(dir).sort()) {
    const full = resolve(dir, name);
    if (statSync(full).isDirectory()) collect(full, acc);
    else acc.push(full);
  }
  return acc;
}

const files = collect(srcDir);
const localParts: Uint8Array[] = [];
const centralParts: Uint8Array[] = [];
let offset = 0;
const now = new Date();
const dosTime = ((now.getHours() & 31) << 11) | ((now.getMinutes() & 63) << 5) | ((now.getSeconds() >> 1) & 31);
const dosDate = (((Math.max(1980, now.getFullYear()) - 1980) & 127) << 9) | (((now.getMonth() + 1) & 15) << 5) | (now.getDate() & 31);

for (const full of files) {
  const entryName = "ESPlay/" + relative(srcDir, full).replace(/\\/g, "/");
  const nameBytes = new TextEncoder().encode(entryName);
  const raw = readFileSync(full);
  const compressed = deflateRawSync(raw);
  const crc = crc32(raw);

  const local = new DataView(new ArrayBuffer(30));
  local.setUint32(0, 0x04034b50, true);
  local.setUint16(4, 20, true);
  local.setUint16(6, 0x0800, true); // UTF-8
  local.setUint16(8, 8, true); // deflate
  local.setUint16(10, dosTime, true);
  local.setUint16(12, dosDate, true);
  local.setUint32(14, crc, true);
  local.setUint32(18, compressed.length, true);
  local.setUint32(22, raw.length, true);
  local.setUint16(26, nameBytes.length, true);
  local.setUint16(28, 0, true);

  localParts.push(new Uint8Array(local.buffer), nameBytes, compressed);

  const central = new DataView(new ArrayBuffer(46));
  central.setUint32(0, 0x02014b50, true);
  central.setUint16(4, 20, true);
  central.setUint16(6, 20, true);
  central.setUint16(8, 0x0800, true);
  central.setUint16(10, 8, true);
  central.setUint16(12, dosTime, true);
  central.setUint16(14, dosDate, true);
  central.setUint32(16, crc, true);
  central.setUint32(20, compressed.length, true);
  central.setUint32(24, raw.length, true);
  central.setUint16(28, nameBytes.length, true);
  central.setUint16(30, 0, true);
  central.setUint16(32, 0, true);
  central.setUint16(34, 0, true);
  central.setUint16(36, 0, true);
  central.setUint32(38, 0, true);
  central.setUint32(42, offset, true);

  centralParts.push(new Uint8Array(central.buffer), nameBytes);
  offset += 30 + nameBytes.length + compressed.length;
}

const centralSize = centralParts.reduce((s, p) => s + p.length, 0);
const eocd = new DataView(new ArrayBuffer(22));
eocd.setUint32(0, 0x06054b50, true);
eocd.setUint16(4, 0, true);
eocd.setUint16(6, 0, true);
eocd.setUint16(8, files.length, true);
eocd.setUint16(10, files.length, true);
eocd.setUint32(12, centralSize, true);
eocd.setUint32(16, offset, true);
eocd.setUint16(20, 0, true);

await Bun.write(outFile, new Blob([...localParts, ...centralParts, new Uint8Array(eocd.buffer)]));
console.log(`Gerado ${relative(root, outFile)} (${files.length} arquivos)`);
