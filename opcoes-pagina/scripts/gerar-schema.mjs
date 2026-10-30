#!/usr/bin/env node
/**
 * PONTO DE PARTIDA, USO UNICO. Extrai o schema da pagina de opcoes legada
 * (tests/fixtures/options-legado.html) para src/schema-dados.ts. Depois de
 * gerado, o schema-dados.ts e mantido a mao: NAO rode de novo, sobrescreve.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseHTML } from "linkedom";

const AQUI = dirname(fileURLToPath(import.meta.url));
const { document: doc } = parseHTML(readFileSync(join(AQUI, "../tests/fixtures/options-legado.html"), "latin1"));
const norm = (s) => s.replace(/\s+/g, " ").trim();

// Linhas que so aparecem quando outra chave esta ligada/desligada (o legado fazia isso em changeConfigGeral).
const NIVEL = { de: "newdocnivel", quando: false, limparAoEsconder: true };
const PADRAO_DOC = [{ de: "newdocdefault", quando: true }];
const DEPENDENCIAS = {
  reaberturaprogramada_periodo: [{ de: "reaberturaprogramada", quando: true }],
  anotacaocontrolecoluna: [{ de: "mostraranotacaocontrole", quando: true }],
  sortbeforeupload: [{ de: "uploaddocsexternos", quando: true, limparAoEsconder: true }],
  certidaosigilo_nomedoc: [{ de: "certidaosigilo", quando: true }],
  newdocname: PADRAO_DOC,
  newdocobs: PADRAO_DOC,
  newdocespec: PADRAO_DOC,
  newdocformat: PADRAO_DOC,
  newdoctoday: PADRAO_DOC,
  newdocnivel: PADRAO_DOC,
  newproc_selfunidade: PADRAO_DOC,
  newdocsigilo: [...PADRAO_DOC, NIVEL],
};

// A linha pode estar dentro de uma tabela aninhada cuja <tr> externa e que tem display:none.
function escondidaPorAncestral(tr) {
  for (let t = tr; t; t = t.parentElement?.closest("tr"))
    if ((t.getAttribute("style") ?? "").replace(/\s/g, "").includes("display:none")) return true;
  return false;
}

function opcaoDe(ctrl) {
  const linha = ctrl.closest("tr");
  const nome = ctrl.getAttribute("data-name");
  const tipoAttr = ctrl.getAttribute("type");
  const tipo = ctrl.tagName === "SELECT" ? "selecao" : tipoAttr === "checkbox" ? "chave" : tipoAttr === "number" ? "numero" : "texto";
  const icone = linha
    .querySelector("i.iconPopup")
    .className.split(/\s+/)
    .filter((c) => c && c !== "iconPopup" && !/Color$/.test(c))
    .join(" ");
  const href = linha.querySelector("a[href]")?.getAttribute("href");
  const o = { nome, rotulo: norm(linha.querySelector(".info").textContent), tipo, icone };
  if (href) o.manual = href.match(/\/pages\/([A-Z0-9]+)\.html$/)?.[1] ?? href;
  if (tipo === "chave") o.padrao = ctrl.hasAttribute("checked");
  if (tipo === "numero") {
    o.padrao = Number(ctrl.getAttribute("value"));
    o.min = Number(ctrl.getAttribute("min"));
    o.max = Number(ctrl.getAttribute("max"));
  }
  if (tipo === "texto") {
    o.padrao = ctrl.getAttribute("value") ?? "";
    if (ctrl.getAttribute("maxlength")) o.maxLength = Number(ctrl.getAttribute("maxlength"));
  }
  if (tipo === "selecao") {
    o.escolhas = [...ctrl.querySelectorAll("option")].map((op) => ({
      valor: op.getAttribute("value") ?? "",
      rotulo: norm(op.textContent),
    }));
    o.padrao = o.escolhas[0]?.valor ?? "";
  }
  if (DEPENDENCIAS[nome]) o.dependencias = DEPENDENCIAS[nome];
  // As linhas "lab" tem display:none de fabrica e o CSS as mostra no Lab: nao sao "ocultas sempre".
  else if (!linha.classList.contains("lab") && escondidaPorAncestral(linha)) o.oculta = true;
  if (linha.classList.contains("lab")) o.visivelEm = "lab";
  if (linha.classList.contains("notatq")) o.visivelEm = "fora-antaq";
  return o;
}

const todos = [...doc.querySelectorAll('[id^="itemConfigGeral_"]')];
const complementos = todos.filter((c) => c.closest("#options-complements")).map(opcaoDe);
const IDS = ["controle", "editor", "arvore"];
const secoes = [...doc.querySelectorAll("#accordion > div")].map((corpo, i) => ({
  id: IDS[i],
  titulo: norm(corpo.previousElementSibling.textContent),
  opcoes: [...corpo.querySelectorAll('[id^="itemConfigGeral_"]')].map(opcaoDe),
}));

const nomes = new Set([...complementos, ...secoes.flatMap((s) => s.opcoes)].map((o) => o.nome));
for (const o of [...complementos, ...secoes.flatMap((s) => s.opcoes)])
  for (const d of o.dependencias ?? []) if (!nomes.has(d.de)) throw new Error(`${o.nome} depende de ${d.de}, que nao existe`);

const ts = `/**
 * As opcoes da pagina de configuracoes: fonte unica da verdade. Gerado uma vez a
 * partir do HTML legado (scripts/gerar-schema.mjs) e mantido a mao desde entao.
 * Ordem = ordem de exibicao. O \`nome\` e o data-name gravado em dataValues.
 */
import type { Opcao, Secao } from "./schema";

export const SECOES_GERAL: Secao[] = ${JSON.stringify(secoes, null, 2)};

export const OPCOES_COMPLEMENTOS: Opcao[] = ${JSON.stringify(complementos, null, 2)};
`;
writeFileSync(join(AQUI, "../src/schema-dados.ts"), ts);
console.log(`${complementos.length} complementos, ${secoes.map((s) => `${s.id}=${s.opcoes.length}`).join(" ")}`);
