#!/usr/bin/env node
/** Build da pagina de opcoes: src/main.ts -> dist/html/options.js (IIFE, so ASCII). */
import { build } from "esbuild";
import { readFile, stat } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const saida = fileURLToPath(new URL("../dist/html/options.js", import.meta.url));
await build({
  entryPoints: [fileURLToPath(new URL("src/main.ts", import.meta.url))],
  outfile: saida,
  bundle: true,
  minify: true,
  format: "iife",
  target: ["chrome116", "firefox115"],
  // Acentos saem como \uXXXX: regra do projeto para JS da extensao.
  charset: "ascii",
  legalComments: "none",
  logLevel: "warning",
  banner: { js: "/* GERADO por opcoes-pagina/build.mjs. NAO EDITE ESTE ARQUIVO. Rode: npm run build */" },
});
const bytes = await readFile(saida);
const i = bytes.findIndex((b) => b > 0x7f);
if (i >= 0) {
  console.error(`ERRO: byte nao-ASCII em dist/html/options.js (posicao ${i}): ${bytes.subarray(Math.max(0, i - 40), i + 10).toString("utf8")}`);
  process.exit(1);
}
console.log(`Opcoes: dist/html/options.js gerado (${Math.round((await stat(saida)).size / 1024)} KB).`);
