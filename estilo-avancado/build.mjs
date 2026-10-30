#!/usr/bin/env node
/**
 * Build do Estilo Avancado 2.
 *
 *   dist/js/init_estilo.js              content script (IIFE, mundo isolado, todos os frames)
 *   dist/js/estilo-avancado/opcoes.js   secao "Aparencia" da pagina de opcoes (quando existir)
 *
 * CSS importado no codigo entra como texto (loader "text").
 */
import { build } from "esbuild";
import { mkdir, readFile, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const DIST = resolve(AQUI, "..", "dist");

const comum = {
  bundle: true,
  minify: true,
  target: ["chrome116", "firefox115"],
  // Acentos saem como \uXXXX: regra do projeto para JS da extensao.
  charset: "ascii",
  logLevel: "warning",
  legalComments: "none",
  loader: { ".css": "text" },
  banner: { js: "/* GERADO por estilo-avancado/build.mjs. NAO EDITE ESTE ARQUIVO. Rode: npm run build */" },
};

await rm(join(DIST, "js", "estilo-avancado"), { recursive: true, force: true });
await mkdir(join(DIST, "js", "estilo-avancado"), { recursive: true });

const saidas = ["js/init_estilo.js"];
await build({ ...comum, entryPoints: [resolve(AQUI, "src/pagina/main.ts")], outfile: join(DIST, "js", "init_estilo.js"), format: "iife" });

if (existsSync(resolve(AQUI, "src/opcoes/main.ts"))) {
  await build({ ...comum, entryPoints: [resolve(AQUI, "src/opcoes/main.ts")], outfile: join(DIST, "js", "estilo-avancado", "opcoes.js"), format: "esm" });
  saidas.push("js/estilo-avancado/opcoes.js");
}

// Regra do projeto: JS da extensao so com ASCII (o grep BSD nao enxerga acento cru; confere-se por byte).
for (const f of saidas) {
  const bytes = await readFile(join(DIST, f));
  const i = bytes.findIndex((b) => b > 0x7f);
  if (i >= 0) {
    console.error(`ERRO: byte nao-ASCII em dist/${f} (posicao ${i}): ${bytes.subarray(Math.max(0, i - 40), i + 10).toString("utf8")}`);
    process.exit(1);
  }
}
console.log(`ok: ${saidas.join(", ")}`);
