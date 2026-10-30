/**
 * Verificação dos tokens de design compartilhados (dist/css/seipro-ui.css).
 *
 * POR QUE ISTO EXISTE: a folha das Ferramentas de PDF e a da página de opções
 * usam as mesmas variáveis de cor, e o tema escuro só funciona se TODA cor da
 * interface vier delas. Uma `var(--x)` sem definição é declaração inválida: a
 * borda ou o fundo some sem erro nenhum (já aconteceu aqui, com `--line`). E um
 * `#hex` solto numa regra fica claro no tema escuro: caixa branca num fundo
 * escuro, texto ilegível.
 */

import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const AQUI = dirname(fileURLToPath(import.meta.url));
const CSS = resolve(AQUI, "..", "..", "dist", "css");
const HTML = resolve(AQUI, "..", "..", "dist", "html");

let passou = 0;
let falhou = 0;

function checar(nome: string, condicao: boolean, detalhe?: string) {
  if (condicao) {
    passou += 1;
    console.log(`  ok    ${nome}`);
  } else {
    falhou += 1;
    console.log(`  FALHA ${nome}${detalhe ? ` -- ${detalhe}` : ""}`);
  }
}

const sem = (css: string) => css.replace(/\/\*[\s\S]*?\*\//g, "");
const ler = (f: string) => readFileSync(f, "utf8");

console.log("\n== tokens compartilhados ==");

let ui = "";
try {
  ui = ler(resolve(CSS, "seipro-ui.css"));
} catch {
  /* o teste abaixo acusa */
}
checar("dist/css/seipro-ui.css existe", ui.length > 0);

const uiLimpo = sem(ui);
const iDark = uiLimpo.indexOf("prefers-color-scheme: dark");
const claro = iDark === -1 ? uiLimpo : uiLimpo.slice(0, iDark);
const escuro = iDark === -1 ? "" : uiLimpo.slice(iDark);

const nomes = (trecho: string) => new Set([...trecho.matchAll(/(--[a-z0-9-]+)\s*:/g)].map((m) => m[1]));
const definidasClaro = nomes(claro);
const definidasEscuro = nomes(escuro);

checar("define os tokens do tema claro", definidasClaro.size >= 20, `${definidasClaro.size}`);
checar("tem o tema escuro (prefers-color-scheme: dark)", iDark !== -1);

// Tokens que não mudam entre os temas (medidas, fonte, sombra).
const FIXOS = new Set(["--raio", "--raio-sm", "--texto", "--verde", "--sombra", "--altura-controle"]);
const faltamNoEscuro = [...definidasClaro].filter((n) => !FIXOS.has(n) && !definidasEscuro.has(n));
checar("todo token de cor do tema claro tem par no escuro", faltamNoEscuro.length === 0, faltamNoEscuro.join(", "));

const PRIMEIRA_DE_FORA = new Set([
  // Variáveis que o pdf.js escreve em tempo de execução ou que a própria folha define no seletor.
  "--scale-factor", "--total-scale-factor", "--user-unit", "--scale-round-x", "--scale-round-y",
  "--min-font-size", "--min-font-size-inv", "--text-scale-factor", "--font-height", "--scale-x", "--rotate",
]);

const arquivos: Array<[string, string]> = [
  ["ferramentas-pdf.css", ler(resolve(CSS, "ferramentas-pdf.css"))],
  ["page.css (opcoes)", ler(resolve(HTML, "page.css"))],
];
const definidasEmQualquer = new Set<string>([...definidasClaro, ...definidasEscuro]);
for (const [, css] of arquivos) for (const n of nomes(sem(css))) definidasEmQualquer.add(n);

for (const [nome, css] of arquivos) {
  const usadas = new Set([...sem(css).matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]));
  const indefinidas = [...usadas].filter((n) => !definidasEmQualquer.has(n) && !PRIMEIRA_DE_FORA.has(n));
  checar(`${nome}: toda var(--x) usada esta definida`, indefinidas.length === 0, indefinidas.join(", "));
}

console.log("\n== nenhuma cor fixa fora do que representa papel e tarja ==");
const pdfCss = sem(arquivos[0][1]);
const marco = arquivos[0][1].indexOf("VISUALIZADOR DE TARJA");
checar("a folha tem o marco do visualizador", marco !== -1);
const antes = sem(arquivos[0][1].slice(0, marco));
const depois = sem(arquivos[0][1].slice(marco));
const hex = (t: string) => [...t.matchAll(/#[0-9a-fA-F]{3,8}\b/g)].map((m) => m[0].toLowerCase());
checar("interface (antes do visualizador): zero #hex fixo", hex(antes).length === 0, hex(antes).slice(0, 8).join(", "));
// No visualizador: a página do PDF é papel (#fff) e a tarja é preta (#000), nos dois temas.
const permitidas = new Set(["#fff", "#ffffff", "#000", "#000000"]);
checar(
  "visualizador: so #fff (papel) e #000 (tarja)",
  hex(depois).every((h) => permitidas.has(h)),
  hex(depois).filter((h) => !permitidas.has(h)).join(", "),
);
checar("a folha nao usa mais as variaveis antigas fora do remapeamento", !/var\(--(ink|ink-2|ink-3|line|line-forte|bg|bg-2|blue)\b/.test(pdfCss), "ainda ha var(--ink/--line/--bg/--blue)");

console.log("\n== as duas paginas carregam os tokens ==");
const link = /<link[^>]+seipro-ui\.css/;
const antesDoProprio = (html: string, proprio: string) => {
  const a = html.search(link);
  const b = html.indexOf(proprio);
  return a !== -1 && b !== -1 && a < b;
};
checar("options.html: seipro-ui.css antes do page.css", antesDoProprio(ler(resolve(HTML, "options.html")), "page.css"));
checar("ferramentas-pdf.html: seipro-ui.css antes do ferramentas-pdf.css", antesDoProprio(ler(resolve(HTML, "ferramentas-pdf.html")), "ferramentas-pdf.css"));

console.log(`\n${passou} ok, ${falhou} falha(s)\n`);
process.exit(falhou ? 1 : 0);
