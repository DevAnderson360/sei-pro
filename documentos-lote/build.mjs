#!/usr/bin/env node
/**
 * Build do Documentos em Lote.
 *
 *   dist/js/init_documentos_lote.js  content script (IIFE, mundo isolado, todos os frames)
 *   dist/js/documentos-lote/app.js   app de html/documentos-lote.html (ESM): janela de Documentos em Lote
 *   dist/html/documentos-lote.html   copia de estatico/ 
 *   dist/css/documentos-lote.css     sei-comum/src/ui/base.css + sei-comum/src/ui/lista.css + estatico/documentos-lote.css
 * JS todo ASCII (portao de bytes abaixo).
 */
import { build } from "esbuild";
import { existsSync } from "node:fs";
import { copyFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(AQUI, "..", "dist");

// Opcoes comuns do esbuild, usadas por cada `build({ ...comum, ... })` das entradas.
const comum = {
  bundle: true,
  minify: true,
  target: ["chrome116", "firefox115"],
  // Acentos saem como \uXXXX: regra do projeto para JS da extensao.
  charset: "ascii",
  logLevel: "warning",
  legalComments: "none",
  loader: { ".css": "text" },
  banner: { js: "/* GERADO por documentos-lote/build.mjs. NAO EDITE ESTE ARQUIVO. Rode: npm run build */" },
};

// Entradas previstas. Uma cuja fonte ainda nao existe e pulada com aviso, para o build
// rodar desde o esqueleto e passar a gerar a saida sozinho quando o arquivo surgir.
const ENTRADAS = [
  { fonte: "src/app/main.ts", saida: "js/documentos-lote/app.js", format: "esm" },
  { fonte: "src/pagina/main.ts", saida: "js/init_documentos_lote.js", format: "iife" },
];

const SAIDAS = [];
for (const { fonte, saida, format } of ENTRADAS) {
  if (!existsSync(resolve(AQUI, fonte))) {
    console.log(`  (pulado) ${fonte} ainda nao existe; ${saida} nao foi gerado`);
    continue;
  }
  await mkdir(dirname(join(DIST, saida)), { recursive: true });
  await build({ ...comum, entryPoints: [resolve(AQUI, fonte)], outfile: join(DIST, saida), format });
  SAIDAS.push(saida);
}

// Pagina do app e CSS: base + lista (sei-comum, o desenho do Favoritos) + o do documentos-lote.
await mkdir(join(DIST, "html"), { recursive: true });
await mkdir(join(DIST, "css"), { recursive: true });
await copyFile(resolve(AQUI, "estatico/documentos-lote.html"), join(DIST, "html", "documentos-lote.html"));
const css = await Promise.all(
  ["../sei-comum/src/ui/base.css", "../sei-comum/src/ui/lista.css", "estatico/documentos-lote.css"].map((f) => readFile(resolve(AQUI, f), "utf8")),
);
await writeFile(join(DIST, "css", "documentos-lote.css"), `/* GERADO por documentos-lote/build.mjs. NAO EDITE ESTE ARQUIVO. */\n${css.join("\n")}`);

// Regra do projeto: JS da extensao so com ASCII (conferencia byte a byte, como no Favoritos).
for (const f of SAIDAS) {
  const bytes = await readFile(join(DIST, f));
  const i = bytes.findIndex((b) => b > 0x7f);
  if (i >= 0) {
    console.error(`ERRO: byte nao-ASCII em dist/${f} (posicao ${i}): ${bytes.subarray(Math.max(0, i - 40), i + 10).toString("utf8")}`);
    process.exit(1);
  }
}

const kb = async (f) => `${Math.round((await stat(join(DIST, f))).size / 1024)} KB`;
console.log("\nDocumentos em Lote -- build");
for (const f of [...SAIDAS, "html/documentos-lote.html", "css/documentos-lote.css"]) console.log(`  ${f.padEnd(26)} ${await kb(f)}`);
