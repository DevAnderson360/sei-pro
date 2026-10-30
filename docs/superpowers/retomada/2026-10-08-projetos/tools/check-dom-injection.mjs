#!/usr/bin/env node
/**
 * Portao de empacotamento: garante que arquivo ja convertido nao volte a injetar HTML
 * cru nem a carregar acao em atributo on*.
 *
 * POR QUE EXISTE. A conversao e manual e longa; sem um portao, o primeiro trecho novo
 * escrito no estilo antigo reabre a pendencia da AMO sem ninguem perceber.
 *
 * Uso:
 *   node tools/check-dom-injection.mjs          (reprova com codigo 1 se houver ERRO)
 *   node tools/check-dom-injection.mjs --todos  (mostra tambem os arquivos ainda nao convertidos)
 */
import { existsSync, readFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// Cresce a cada camada concluida. Arquivo fora desta lista nao e verificado.
const ARQUIVOS_CONVERTIDOS = [
  'dist/js/sei-legis.js',
  'dist/js/init.js',
  'dist/js/sei-pro-proc-lote.js',
  'dist/js/sei-pro-docs-lote.js',
  'dist/js/sei-pro-prescricoes.js'
];

// Bundles gerados dos pacotes em TypeScript (DOM so por h() da sei-comum). Valem so os
// ERROS: os avisos de .append(variavel) sao o proprio h() minificado, sempre com no DOM.
const ARQUIVOS_GERADOS = [
  'dist/js/init_favoritos.js',
  'dist/js/favoritos/app.js',
  'dist/js/favoritos/painel.js',
  'dist/js/favoritos/opcoes.js',
  'dist/js/init_historico.js',
  'dist/js/historico/app.js',
  'dist/js/init_projetos.js',
  'dist/js/projetos/pagina.js',
  'dist/js/projetos/balao.js',
  'dist/js/projetos/pagina-comum.js',
  'dist/js/projetos/app.js'
];

// on<evento>="  dentro de literal. Nao casa com "el.onclick = fn" (sem aspas apos o =).
const RE_HANDLER = /\bon(click|change|blur|focus|input|keyup|keydown|keypress|submit|mouseover|mouseout|mouseenter|mouseleave|mousedown|mouseup|mousemove|dblclick|contextmenu|paste|copy|cut|drag|dragstart|dragend|dragover|dragenter|dragleave|drop|wheel|reset|invalid|select|scroll|load|error|toggle|animationend|transitionend)\s*=\s*(\\?["'])/g;
// .html(qualquer coisa) -- getter .html() continua permitido.
const RE_HTML = /\.html\(\s*(?!\))/g;
const RE_INNER = /\.innerHTML\s*=|insertAdjacentHTML\s*\(/g;
// insercao com literal de marcacao
const RE_INSERE_LITERAL = /\.(append|prepend|before|after|replaceWith)\(\s*(['"`])\s*</g;
// Insercao com QUALQUER argumento que nao comece por $( -- variavel, chamada, map().join(),
// concatenacao. Nao da para saber estaticamente se e HTML, entao vira aviso para conferencia.
// Antes isto so casava com variavel simples, e deixava passar o caso mais comum de todos:
// .append(lista.map(...).join('')), que e exatamente onde o dado do SEI vira marcacao.
// createTextNode nao parseia HTML: e a forma correta de inserir texto, nao um caso a conferir.
const RE_INSERE_VAR = /\.(append|prepend|before|after|replaceWith)\(\s*(?!\$\()(?!document\.createTextNode)(?!['"`]\s*<)([^)\n]{1,80})\)/g;

function linhaDe(texto, indice) { return texto.slice(0, indice).split('\n').length; }

function varrer(caminho) {
  const texto = readFileSync(resolve(RAIZ, caminho), 'utf8');
  const erros = [], avisos = [];
  const achar = (re, lista, rotulo) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(texto))) lista.push(`${caminho}:${linhaDe(texto, m.index)}  ${rotulo}: ${m[0].trim()}`);
  };
  achar(RE_HANDLER, erros, 'acao em atributo on*');
  achar(RE_HTML, erros, 'use htmlPro no lugar de .html(...)');
  achar(RE_INNER, erros, 'use htmlPro no lugar de innerHTML/insertAdjacentHTML');
  achar(RE_INSERE_LITERAL, erros, 'use htmlPro para inserir marcacao');
  achar(RE_INSERE_VAR, avisos, 'conferir: se a variavel for HTML, use htmlPro');
  return { erros, avisos };
}

// --- Auditoria de MODO de insercao -------------------------------------------------
// POR QUE EXISTE. A conversao trocou `$(x).append(html)` por `htmlPro($(x), html)`, e
// htmlPro SEM o terceiro argumento e 'html': SUBSTITUI o conteudo em vez de acrescentar.
// Numa varredura automatica isso passa despercebido -- e passou: 12 pontos de
// sei-pro-docs-lote.js perderam o modo, um deles apagando o <select> de Tipo de Documento
// logo depois de cria-lo. Aqui a contagem por verbo e comparada com a do ponto de partida
// do branch: se um `append` sumiu sem virar htmlPro(..., 'append'), o numero acusa.
const VERBOS = ['append', 'prepend', 'before', 'after', 'replaceWith'];
const MODO = { append: 'append', prepend: 'prepend', before: 'before', after: 'after', replaceWith: 'replace' };

// Equivalentes por DOM API: quando a conversao troca marcacao por construcao de no, a
// insercao continua existindo -- so mudou de forma. Sem contar isto, o detector acusa
// init.js, que virou appendChild de proposito.
const DOM_API = { append: ['appendChild'], prepend: ['insertBefore'], before: ['insertBefore'],
                  after: [], replaceWith: ['replaceChild'] };

function contarVerbos(texto) {
  const c = {};
  for (const v of VERBOS) {
    const direto = (texto.match(new RegExp('\\.' + v + '\\(', 'g')) || []).length;
    const viaHelper = (texto.match(new RegExp("(?:htmlPro|reescreverDocumentoPro)\\([\\s\\S]*?'" + MODO[v] + "'\\s*\\)", 'g')) || []).length;
    let viaDom = 0;
    for (const m of DOM_API[v]) viaDom += (texto.match(new RegExp('\\.' + m + '\\(', 'g')) || []).length;
    c[v] = direto + viaHelper + viaDom;
  }
  return c;
}

function auditarModos(caminho, refBase) {
  let antigo;
  try {
    antigo = execSync(`git show ${refBase}:${caminho}`, { cwd: RAIZ, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  } catch (e) { return []; }
  const novo = readFileSync(resolve(RAIZ, caminho), 'utf8');
  const a = contarVerbos(antigo), b = contarVerbos(novo);
  const achados = [];
  for (const v of VERBOS) {
    if (b[v] < a[v]) achados.push(`${caminho}  modo de insercao perdido: '${v}' caiu de ${a[v]} para ${b[v]} (htmlPro sem o 3o argumento SUBSTITUI o conteudo)`);
  }
  return achados;
}

let totalErros = 0, totalAvisos = 0;
for (const caminho of ARQUIVOS_CONVERTIDOS) {
  const { erros, avisos } = varrer(caminho);
  totalErros += erros.length;
  totalAvisos += avisos.length;
  for (const e of erros) console.error('ERRO   ' + e);
  for (const a of avisos) console.warn('AVISO  ' + a);
}

for (const caminho of ARQUIVOS_GERADOS) {
  // Pacote de um modulo que ainda nao chegou a esta copia (ex.: o Projetos antes do merge no master).
  if (!existsSync(resolve(RAIZ, caminho))) { console.log('(nao gerado nesta copia: ' + caminho + ')'); continue; }
  const { erros } = varrer(caminho);
  totalErros += erros.length;
  for (const e of erros) console.error('ERRO   ' + e);
}

// A auditoria de modo compara com o ponto de partida do branch.
const REF_BASE = process.env.SPRO_REF_BASE || 'master';
for (const caminho of ARQUIVOS_CONVERTIDOS) {
  for (const m of auditarModos(caminho, REF_BASE)) { console.error('ERRO   ' + m); totalErros++; }
}

if (process.argv.includes('--todos')) {
  console.log(`\n(${ARQUIVOS_CONVERTIDOS.length} arquivo(s) sob a regra; os demais ainda nao foram convertidos)`);
}
console.log(`\ncheck-dom-injection: ${totalErros} erro(s), ${totalAvisos} aviso(s)`);
process.exit(totalErros > 0 ? 1 : 0);
