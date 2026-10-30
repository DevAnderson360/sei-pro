#!/usr/bin/env node
/**
 * Sincroniza os 12 manifests da extensao.
 *
 * POR QUE EXISTE. Os manifests ja divergem entre si hoje: o
 * `web_accessible_resources` tem 130, 180 ou 182 entradas conforme o arquivo,
 * tres MV2 nao declaram sequer o `id` do Gecko, e os que declaram
 * `strict_min_version` o fazem em `applications.gecko` -- chave antiga, que o
 * Firefox atual IGNORA quando existe `browser_specific_settings`. Aplicar uma
 * mudanca a mao em doze arquivos e onde isso quebra, e um manifest esquecido
 * significa a funcionalidade morta em UM orgao so, com uma violacao de politica
 * de seguranca no console e nada mais.
 *
 * O que faz, de forma idempotente:
 *   1. Acrescenta ao WAR os recursos que o SEI precisa alcancar.
 *   2. Declara a politica de seguranca com 'wasm-unsafe-eval' (MV3 como objeto,
 *      MV2 como string -- as formas sao diferentes e nao intercambiaveis).
 *   3. Nos MV2, garante strict_min_version >= 102 em browser_specific_settings,
 *      porque abaixo disso o Firefox bloqueia WebAssembly em silencio.
 *
 * Uso:
 *   node tools/patch-manifests.mjs [--check]
 */

import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DIST = resolve(dirname(fileURLToPath(import.meta.url)), "..", "dist");
const conferir = process.argv.includes("--check");

/**
 * Recursos que uma pagina do SEI precisa poder alcancar.
 *
 * Os tres primeiros sao das Ferramentas de PDF: a pagina (para o SEI navegar
 * ate ela), o glue e o icone do botao.
 *
 * Os tres do meio sao os assets do Tesseract. Eles NAO estariam aqui se so a
 * pagina da extensao os usasse -- de la, sao mesma origem. Mas o OCR das
 * Ferramentas de IA roda DENTRO da pagina do SEI, e de la carregar um arquivo
 * da extensao exige que ele esteja declarado. Sem isso o OCR da IA volta a
 * buscar o motor na CDN, em silencio.
 *
 * Os tres ultimos sao do Estudio de Fluxo: a pagina em tela cheia (o botao da
 * barra do SEI e um link para ela), o bundle e o icone do botao. RECURSO NOVO
 * QUE NAO ENTRA AQUI APARECE COMO TEXTO ALTERNATIVO NO LUGAR DO ICONE.
 */
const RECURSOS_NOVOS = [
  "html/ferramentas-pdf.html",
  "js/sei-pro-ferramentaspdf.js",
  "icons/menu/ferramentas_pdf.svg",
  "vendor/ferramentas-pdf/tesseract/worker.min.js",
  "vendor/ferramentas-pdf/tesseract/core/tesseract-core-simd-lstm.wasm.js",
  "vendor/ferramentas-pdf/tesseract/lang/por.traineddata.gz",
  "html/fluxos.html",
  "js/estudio/estudio.js",
  "icons/menu/fluxos.svg",
];

/** Ancora: entrada ja presente nos 12, para inserir logo depois dela. */
const ANCORA = "html/options.html";

const ARQUIVO_ISOLADO = "js/init_ferramentaspdf.js";

const CSP = "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'";
const FIREFOX_MINIMO = "102.0";

/** Descobre a indentacao usada no arquivo, para nao reformatar o que existe. */
function indentacaoDe(texto) {
  const linha = texto.split("\n").find((l) => /^\s+"/.test(l));
  return linha ? linha.match(/^\s+/)[0].length : 2;
}

let mudou = 0;
let jaOk = 0;
const pendencias = [];

function anota(arquivo, oQue) {
  pendencias.push(`${arquivo}: ${oQue}`);
}

/** Insere os recursos logo apos a ancora, preservando a ordem existente. */
function comRecursos(lista, arquivo) {
  const faltando = RECURSOS_NOVOS.filter((r) => !lista.includes(r));
  if (faltando.length === 0) return null;
  anota(arquivo, `WAR +${faltando.length}`);
  const i = lista.indexOf(ANCORA);
  if (i === -1) {
    // Sem a ancora, acrescenta no fim em vez de falhar: melhor um manifest
    // correto com ordem diferente do que um manifest sem o recurso.
    return [...lista, ...faltando];
  }
  return [...lista.slice(0, i + 1), ...faltando, ...lista.slice(i + 1)];
}

for (const arquivo of readdirSync(DIST).filter((f) => /^manifest.*\.json$/.test(f))) {
  const caminho = join(DIST, arquivo);
  const original = readFileSync(caminho, "utf8");
  const m = JSON.parse(original);
  const mv3 = m.manifest_version === 3;

  // 1. web_accessible_resources
  if (mv3) {
    const blocos = m.web_accessible_resources ?? [];
    for (const bloco of blocos) {
      const novo = comRecursos(bloco.resources ?? [], arquivo);
      if (novo) bloco.resources = novo;
    }
  } else {
    const novo = comRecursos(m.web_accessible_resources ?? [], arquivo);
    if (novo) m.web_accessible_resources = novo;
  }

  // 2. Politica de seguranca. As formas MV2 e MV3 sao diferentes.
  if (mv3) {
    const atual = m.content_security_policy?.extension_pages;
    if (atual !== CSP) {
      m.content_security_policy = { ...(m.content_security_policy ?? {}), extension_pages: CSP };
      anota(arquivo, "CSP (extension_pages)");
    }
  } else if (m.content_security_policy !== CSP) {
    m.content_security_policy = CSP;
    anota(arquivo, "CSP (string)");
  }

  // 3. Firefox minimo, na chave que o Firefox atual realmente le.
  if (!mv3) {
    const bss = m.browser_specific_settings ?? {};
    const gecko = { ...(bss.gecko ?? {}) };
    const idHerdado = gecko.id ?? m.applications?.gecko?.id;
    const versaoAtual = parseInt(String(gecko.strict_min_version ?? "0"), 10);
    if (versaoAtual < 102) {
      gecko.strict_min_version = FIREFOX_MINIMO;
      if (idHerdado) gecko.id = idHerdado;
      m.browser_specific_settings = { ...bss, gecko };
      anota(arquivo, `Firefox >= ${FIREFOX_MINIMO}`);
      // A chave antiga fica, para nao quebrar ferramenta que ainda a leia, mas
      // passa a espelhar o mesmo minimo.
      if (m.applications?.gecko) m.applications.gecko.strict_min_version = FIREFOX_MINIMO;
    }
  }

  // Preserva o estilo do arquivo: os manifests divergem entre 2 e 4 espacos de
  // indentacao, e reserializar todos no mesmo formato produziria um diff de
  // centenas de linhas onde a mudanca real sao tres.
  // 4. Content script do mundo isolado das Ferramentas de PDF.
  //
  // Precisa ser declarado no manifest, e nao injetado por $.getScript como os
  // demais: so um content script DECLARADO roda no mundo isolado, que e o unico
  // com acesso a chrome.runtime. Sem ele, a pagina da ferramenta abre mas nunca
  // conecta ao SEI -- e as integracoes somem em silencio.
  const blocos = m.content_scripts ?? [];
  const jaTem = blocos.some((b) => (b.js ?? []).includes(ARQUIVO_ISOLADO));
  if (!jaTem) {
    // Entra no mesmo bloco que ja cobre as telas de trabalho do SEI, para
    // herdar exatamente os mesmos matches e exclude_matches.
    const alvo =
      blocos.find((b) => (b.js ?? []).some((j) => j.endsWith("js/init.js"))) ?? blocos[0];
    if (alvo) {
      alvo.js = [...(alvo.js ?? []), ARQUIVO_ISOLADO];
      anota(arquivo, "content script isolado");
    }
  }

  const saida = JSON.stringify(m, null, indentacaoDe(original)) + (original.endsWith("\n") ? "\n" : "");
  if (saida === original) {
    jaOk += 1;
    continue;
  }
  mudou += 1;
  if (!conferir) writeFileSync(caminho, saida, "utf8");
}

if (pendencias.length) {
  console.log(conferir ? "\nfaltando:" : "\naplicado:");
  for (const p of pendencias) console.log(`  ${p}`);
}
console.log(
  conferir
    ? `\n${mudou} manifest(s) precisam de ajuste, ${jaOk} ja em dia\n`
    : `\n${mudou} manifest(s) atualizados, ${jaOk} ja estavam em dia\n`,
);
if (conferir && mudou > 0) process.exit(1);
