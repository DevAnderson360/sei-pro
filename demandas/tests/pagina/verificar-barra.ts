/**
 * D17: o botao "Demandas" na barra de acoes do processo (`#divArvoreAcoes` do frame do visualizador) e o balao com as
 * demandas do processo. As telas sao as fixtures reais do SEI 4.1 (a barra: processo_visualizar.html; a arvore:
 * arvore.html, com os nos desenhados como o SEI os desenha por JavaScript). Cobre: a deteccao do processo e do documento
 * aberto so do DOM ja desenhado, o botao uma vez so e so no frame certo, a lista das demandas do processo nos dois
 * escopos, "Nova demanda" com os campos pre-preenchidos, "Iniciar" e "Concluir com este documento" (transicoes da D2 e
 * `documentoEntregue`), o sigilo, o consentimento da unidade e o que o pacote leva (e nao leva).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { areaMemoria } from "@comum/armazenamento/area";
import { consentimentoNaArea, type PortaConsentimento } from "@comum/sincronia/consentimento";
import { lerArvore } from "@nucleo/dominio/arvore";
import { paginaDe } from "@nucleo/sessao/pagina";
import { balaoAberto } from "@projetos/pagina/balaoAtual";
import { build } from "esbuild";
import { escoposDaUnidade } from "../../src/modelo/escopo";
import type { Vis } from "../../src/modelo/tipos";
import { tituloSugerido } from "../../src/pagina/acoes";
import { instalarNaBarra } from "../../src/pagina/arvore";
import { abrirBalaoDemandas, type DepsBalaoDemandas } from "../../src/pagina/balaoDemandas";
import { MENSAGEM_SEM_ENTENDI, METODOS_QUE_GRAVAM } from "../../src/pagina/consentir";
import { MENSAGEM_AGORA_NAO } from "../../src/pagina/conteudo";
import { type Detectado, detectarNaArvore } from "../../src/pagina/deteccao";
import { PALETA_ICONE } from "../../src/pagina/icone";
import { RepositorioDemandas } from "../../src/repositorio";
import { paraOTexto } from "../../src/sincronia/textoPadrao";
import { HOJE } from "../fabrica";
import { botao, checar, escolher, secao, telaSei, tique } from "./util";

const PASTA_PAGINA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "pagina");
const URL_ARVORE = "https://treinamento.sei.sp.gov.br/sei/controlador.php?acao=procedimento_visualizar&id_procedimento=148265";
const URL_BARRA = "https://treinamento.sei.sp.gov.br/sei/controlador.php?acao=arvore_visualizar&id_procedimento=148265";
const CAU = "99906.713-630.000032/2025-82";
const DIGITOS_CAU = "99906713630000032202582";

/** A arvore como o SEI a desenha: os nos em #divArvore; o selecionado leva a classe NO PROPRIO <a> (o legado a le assim). */
function arvore(o: { sigiloso?: boolean; selecionado?: string; cancelarUltimo?: boolean } = {}) {
  const { doc } = telaSei("sei41/arvore.html");
  for (const s of doc.querySelectorAll("script")) {
    let t = s.textContent ?? "";
    if (!t.includes("infraArvoreNo(")) continue;
    if (o.cancelarUltimo) t = t.replace('(0103989)","svg/documento_interno.svg', '(0103989)","svg/documento_cancelado.svg');
    if (o.sigiloso) t = t.replaceAll("Acesso Restrito", "Sigiloso");
    s.textContent = t;
  }
  const no = doc.createElement("a");
  no.id = "anchor148265";
  no.setAttribute("target", "ifrVisualizacao");
  no.textContent = CAU;
  doc.querySelector("#topmenu")!.append(no);
  const nos = doc.querySelector("#divArvore")!;
  const desenhar = (id: string, rotulo: string, href = "") => {
    const a = doc.createElement("a");
    a.id = `anchor${id}`;
    if (href) a.setAttribute("href", href);
    a.setAttribute("target", "ifrConteudoVisualizacao");
    a.textContent = rotulo;
    nos.append(a);
    return a;
  };
  desenhar("PASTA2", "II");
  // Uma pasta antiga que o usuario abriu depois da carga: os documentos dela nao estao nos literais da pagina.
  desenhar("170001", "Parecer 88 (0094500)", "controlador.php?acao=arvore_visualizar&id_documento=170001");
  desenhar("PASTA3", "III");
  desenhar("160223", "Despacho G3 Fixup Cancel L1 (0103984)", "controlador.php?acao=arvore_visualizar&id_documento=160223");
  desenhar("160224", "Despacho I2 Lote Depois (0103989)", "controlador.php?acao=arvore_visualizar&id_documento=160224");
  desenhar("160225", 'Relatório Vfinal V3 - "aspas" & 50% + 1-numerado (0103990)');
  const selecionar = (id: string | null) => {
    for (const a of nos.querySelectorAll(".infraArvoreNoSelecionado")) a.classList.remove("infraArvoreNoSelecionado");
    if (id) doc.getElementById(`anchor${id}`)?.classList.add("infraArvoreNoSelecionado");
  };
  selecionar(o.selecionado ?? null);
  return { doc, selecionar };
}

/** O frame da barra (o visualizador): a fixture real, que vira o `document` global (o `h()` monta nele). */
const barra = () => telaSei("sei41/processo_visualizar.html").doc;

function repos() {
  const area = areaMemoria();
  const esc = escoposDaUnidade("treinamento.sei.sp.gov.br", "pedro.soares", "110000001");
  let relogio = 1_790_000_000_000;
  const carimbo = () => ({ agora: ++relogio, dispositivo: "t", por: "pedro.soares", nome: "Pedro Soares" });
  let n = 0;
  const gerar = () => `d${++n}`;
  const r: Record<Vis, RepositorioDemandas> = {
    unidade: new RepositorioDemandas(area, esc.unidade, carimbo, gerar),
    eu: new RepositorioDemandas(area, esc.eu, carimbo, gerar),
  };
  return r;
}

/** Cada `marcarSigilosos` pedido aos repositorios ("vis:numero"). */
function espiarSigilo(r: Record<Vis, RepositorioDemandas>): string[] {
  const chamadas: string[] = [];
  for (const [vis, repo] of Object.entries(r)) {
    const marcar = repo.marcarSigilosos.bind(repo);
    repo.marcarSigilosos = (lista: readonly string[]) => {
      chamadas.push(`${vis}:${lista.join(",")}`);
      return marcar(lista);
    };
  }
  return chamadas;
}

/** O que vai ao Texto Padrao: o envelope da tabela depois do corte do sigilo (o mesmo `paraOTexto` do adaptador). */
async function paraOTextoDe(repo: RepositorioDemandas, tabela: "d" | "h"): Promise<string> {
  const { envelope, conhecidos } = await repo.exportarComConhecidos(tabela);
  return JSON.stringify(paraOTexto(envelope, conhecidos).envelope);
}

const EU = { login: "pedro.soares", nome: "Pedro Soares" };
const consentimento = (ligado: boolean): PortaConsentimento => {
  const c = consentimentoNaArea({ area: areaMemoria(), chavePreferencias: "demandas/consentimento", campo: "textoPadrao", chave: "k" });
  if (ligado) void c.definir("ligado");
  return c;
};

function deps(r: Record<Vis, RepositorioDemandas>, o: Partial<DepsBalaoDemandas> = {}): DepsBalaoDemandas {
  return {
    repos: r,
    hoje: () => HOJE,
    sigla: "TESTE",
    temaEscuro: false,
    cssBase: "",
    consentimento: consentimento(true),
    eu: EU,
    usuarios: async () => [EU, { login: "maria", nome: "Maria Souza" }],
    abrirNoPainel: () => undefined,
    ...o,
  };
}

const detectar = (a: ReturnType<typeof arvore>, urls: string[] = []) => detectarNaArvore(a.doc, URL_ARVORE, urls);

function verificarDeteccao(): void {
  secao("barra: o processo e o documento aberto, lidos so da arvore ja desenhada");
  const a = arvore({ selecionado: "160223" });
  const x = detectar(a);
  checar(
    "processo: protocolo, id e tipo do no do processo",
    x?.processo.protocolo === CAU && x.processo.idProcedimento === "148265" && !x.processo.sigiloso && !!x.processo.tipo,
    x?.processo,
  );
  checar(
    "documento: o no selecionado (numero SEI e nome sem o numero)",
    x?.documento?.numero === "0103984" && x.documento.titulo === "Despacho G3 Fixup Cancel L1" && x.documento.sigiloso === false,
    x?.documento,
  );
  a.selecionar("170001");
  const antigo = detectar(a);
  checar(
    "pasta aberta depois da carga (fora dos literais): o rotulo do no desenhado",
    antigo?.documento?.numero === "0094500" && antigo.documento.titulo === "Parecer 88",
    antigo?.documento,
  );
  a.selecionar("160225");
  checar(
    "titulo dos literais com entidades decodificadas",
    detectar(a)?.documento?.titulo === 'Relatório Vfinal V3 - "aspas" & 50% + 1-numerado',
  );
  a.selecionar(null);
  checar(
    "nenhum no selecionado e sem URL: sem documento (so o processo)",
    detectar(a)?.documento === null && !!detectar(a)?.processo.protocolo,
  );
  checar(
    "nenhum no selecionado: o id_documento da URL do visualizador",
    detectar(a, ["", "https://x/sei/controlador.php?acao=documento_visualizar&id_documento=160223"])?.documento?.numero === "0103984",
  );
  a.selecionar("148265");
  checar("o no do processo selecionado: sem documento", detectar(a)?.documento === null);
  const c = arvore({ selecionado: "160224", cancelarUltimo: true });
  checar("documento cancelado: sem documento", detectar(c)?.documento === null);
  const s = arvore({ sigiloso: true, selecionado: "160223" });
  checar("processo sigiloso da arvore", detectar(s)?.processo.sigiloso === true);
  const vazio = telaSei("sei41/caixa.html").doc;
  checar("tela sem os literais da arvore: nada (sem lancar)", detectarNaArvore(vazio, URL_ARVORE) === null);
  const arv = lerArvore(paginaDe(a.doc, URL_ARVORE));
  checar(
    "titulo sugerido: <nome do documento> <numero SEI>; sem documento, o texto do no do processo; sigiloso, vazio",
    tituloSugerido({ protocolo: CAU, sigiloso: false, tipo: "Tipo X" }, { numero: "0103984", titulo: "Despacho", sigiloso: false }) ===
      "Despacho 0103984" &&
      tituloSugerido({ protocolo: CAU, sigiloso: false, tipo: arv.tipo }, null) === arv.tipo &&
      tituloSugerido({ protocolo: CAU, sigiloso: true, tipo: "Tipo X" }, null) === "" &&
      tituloSugerido({ protocolo: CAU, sigiloso: true, tipo: "Tipo X" }, { numero: "0103984", titulo: "Despacho", sigiloso: false }) ===
        "Despacho" &&
      tituloSugerido({ protocolo: CAU, sigiloso: false }, { numero: "0103984", titulo: "Despacho", sigiloso: true }) === "",
  );
  checar(
    "titulo sugerido: o numero aparece uma vez so, nos dois formatos de no da arvore",
    tituloSugerido({ protocolo: CAU, sigiloso: false }, { numero: "0104018", titulo: "Despacho 0104018 (0104018)", sigiloso: false }) ===
      "Despacho 0104018" &&
      tituloSugerido({ protocolo: CAU, sigiloso: false }, { numero: "0104018", titulo: "Despacho 0104018", sigiloso: false }) ===
        "Despacho 0104018" &&
      tituloSugerido({ protocolo: CAU, sigiloso: false }, { numero: "0104018", titulo: "Despacho (0104018)", sigiloso: false }) ===
        "Despacho 0104018" &&
      tituloSugerido({ protocolo: CAU, sigiloso: true }, { numero: "0104018", titulo: "Despacho 0104018 (0104018)", sigiloso: false }) ===
        "Despacho",
  );
}

async function verificarBotao(): Promise<void> {
  secao("barra: o botao na #divArvoreAcoes, uma vez so e so no frame certo");
  const a = arvore({ selecionado: "160223" });
  const r = repos();
  const doc = barra();
  const abertos: Array<() => Detectado | null> = [];
  const mk = (d: Document, o: { esperarMs?: number } = {}) =>
    instalarNaBarra({
      doc: d,
      repos: r,
      hoje: () => HOJE,
      docArvore: () => ({ doc: a.doc, url: URL_ARVORE }),
      urls: () => [],
      abrir: (_anc, det) => void abertos.push(det),
      esperarMs: o.esperarMs ?? 50,
      atraso: 1,
    });
  // Fora do frame da barra (a propria arvore): nada.
  checar(
    "frame sem #divArvoreAcoes (a arvore): nenhum botao",
    (await mk(a.doc, { esperarMs: 30 })) === null && !a.doc.querySelector(".spro-dem-ic"),
  );
  const inst = await mk(doc);
  const ic = doc.querySelector<HTMLElement>("#divArvoreAcoes .spro-dem-ic")!;
  checar(
    "o botao dentro da barra, como botao que abre um dialogo, com o icone de demandas",
    !!inst &&
      ic.tagName === "A" &&
      ic.getAttribute("role") === "button" &&
      ic.getAttribute("aria-haspopup") === "dialog" &&
      ic.getAttribute("aria-expanded") === "false" &&
      ic.getAttribute("aria-label") === "Nova demanda deste processo" &&
      !!ic.querySelector("svg") &&
      !ic.hasAttribute("data-ativo"),
    ic?.outerHTML,
  );
  const env = ic.querySelector<HTMLElement>(".spro-dem-env")!;
  const svg = ic.querySelector("svg")!;
  const css = doc.getElementById("spro-dem-estilo-sei")?.textContent ?? "";
  const regraA = /\.spro-dem-ic\{([^}]*)\}/.exec(css)?.[1] ?? "";
  const regraEnv = /\.spro-dem-env\{([^}]*)\}/.exec(css)?.[1] ?? "";
  checar(
    "icone 40x40 em invólucro com margem 3px e linha de base; o <a> e inline, sem largura/altura fixas",
    svg.getAttribute("width") === "40" &&
      svg.getAttribute("height") === "40" &&
      svg.getAttribute("viewBox") === "0 0 40 40" &&
      regraEnv.includes("margin:3px") &&
      regraEnv.includes("vertical-align:baseline") &&
      regraEnv.includes("width:40px") &&
      regraEnv.includes("height:40px") &&
      regraA.includes("display:inline;") &&
      !/(^|;)(width|height|padding)\s*:/.test(regraA) &&
      !ic.hasAttribute("style") &&
      ic.getAttribute("tabindex") === "451" &&
      env.parentElement === ic,
    `${regraA} | ${regraEnv}`,
  );
  const cores = [...ic.querySelectorAll("[fill],[stroke]")].flatMap((e) => [e.getAttribute("fill"), e.getAttribute("stroke")]);
  const usadas = [...cores, ...(css.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [])]
    .filter((c): c is string => !!c && c !== "none" && c !== "#1a73e8")
    .map((c) => c.toLowerCase());
  const permitidas = PALETA_ICONE.map((c) => c.toLowerCase());
  checar(
    "nenhuma cor do icone/selo fora da paleta",
    usadas.every((c) => permitidas.includes(c)),
    usadas.join(),
  );
  const selo0 = ic.querySelector<HTMLElement>(".spro-dem-selo")!;
  checar("sem demandas: sem selo", selo0.hidden && (selo0.textContent ?? "") === "", selo0.outerHTML);
  checar(
    "nao instala duas vezes (o content script injetado de novo)",
    (await mk(doc)) === null && doc.querySelectorAll(".spro-dem-ic").length === 1,
  );
  ic.click();
  checar(
    "o clique abre o balao com o que a tela mostra NESTE clique",
    abertos.length === 1 && abertos[0]?.()?.documento?.numero === "0103984",
  );
  a.selecionar("160225");
  ic.click();
  checar("outro documento selecionado: o proximo clique ja le o novo", abertos[1]?.()?.documento?.numero === "0103990");

  secao("barra: o SEI redesenha a barra (sem duplicar e sem laco)");
  let inseridos = 0;
  const espia = new doc.defaultView!.MutationObserver((rs) => {
    for (const x of rs) for (const n of x.addedNodes) if ((n as Element).classList?.contains("spro-dem-ic")) inseridos++;
    if (inseridos > 5) inst?.parar();
  });
  espia.observe(doc.querySelector("#divArvoreAcoes")!, { childList: true });
  const barraEl = doc.querySelector("#divArvoreAcoes")!;
  const outro = doc.createElement("a");
  outro.className = "botaoSEI";
  barraEl.replaceChildren(outro);
  await tique(30);
  checar(
    "as acoes do no trocadas: o botao volta, uma vez so",
    doc.querySelectorAll("#divArvoreAcoes .spro-dem-ic").length === 1 && inseridos === 1 && barraEl.firstElementChild === outro,
    inseridos,
  );
  await tique(60);
  checar("sem laco: o botao recolocado nao pede outra colocacao", inseridos === 1, inseridos);
  inst?.parar();
  doc.querySelector(".spro-dem-ic")?.remove();
  await tique(30);
  checar("parado: nao recoloca", !doc.querySelector(".spro-dem-ic") && inseridos === 1);
  espia.disconnect();
  checar(
    "depois de parado, instala de novo no mesmo frame (a barra recarregada)",
    (await mk(doc)) !== null && !!doc.querySelector(".spro-dem-ic"),
  );
}

async function verificarIndicador(): Promise<void> {
  secao("barra: o indicador (demandas do processo e prazo vencido)");
  const a = arvore({ selecionado: "160223" });
  const r = repos();
  const doc = barra();
  const inst = await instalarNaBarra({
    doc,
    repos: r,
    hoje: () => HOJE,
    docArvore: () => ({ doc: a.doc, url: URL_ARVORE }),
    urls: () => [],
    abrir: () => undefined,
    esperarMs: 50,
    atraso: 1,
  });
  const ic = doc.querySelector<HTMLElement>(".spro-dem-ic")!;
  await r.unidade.criar({ titulo: "Outro processo", prazo: "2026-10-30", processos: [{ protocolo: "50300.000001/2026-11" }] });
  await tique(30);
  checar("demanda de outro processo: sem indicador", !ic.hasAttribute("data-ativo"));
  const d = await r.unidade.criar({ titulo: "Deste", prazo: "2026-10-30", processos: [{ protocolo: CAU }] });
  await tique(30);
  checar(
    "demanda deste processo: realcado, com a contagem no rotulo",
    ic.hasAttribute("data-ativo") && !ic.hasAttribute("data-atraso") && (ic.getAttribute("aria-label") ?? "").includes("(1 demanda)"),
    ic.getAttribute("aria-label"),
  );
  const selo = ic.querySelector<HTMLElement>(".spro-dem-selo")!;
  checar("1 demanda: selo mostra 1", !selo.hidden && selo.textContent === "1", selo.outerHTML);
  await r.eu.criar({ titulo: "Minha, pelos digitos", prazo: "2026-10-01", processos: [{ protocolo: DIGITOS_CAU }] });
  await tique(30);
  checar("2 demandas: selo mostra 2", !selo.hidden && selo.textContent === "2", selo.outerHTML);
  checar(
    "as dos dois escopos (o numero casa pelos digitos); prazo vencido: ponto de atraso",
    ic.hasAttribute("data-atraso") && (ic.getAttribute("aria-label") ?? "").includes("2 demandas · com prazo vencido"),
    ic.getAttribute("aria-label"),
  );
  for (let i = 0; i < 8; i++) await r.unidade.criar({ titulo: `Mais ${i}`, prazo: "2026-10-30", processos: [{ protocolo: CAU }] });
  await tique(40);
  checar("10 demandas: selo mostra 9+", !selo.hidden && selo.textContent === "9+", selo.textContent);
  void d;
  inst?.parar();
}

const juntar = (b: { raiz: ShadowRoot }, sel: string) =>
  [...b.raiz.querySelectorAll<HTMLElement>(sel)].map((e) => e.textContent ?? "").join("");
const nota = (b: { raiz: ShadowRoot }) => juntar(b, ".pb-nota");
const erro = (b: { raiz: ShadowRoot }) => juntar(b, ".pb-erro");
const entrada = (b: { raiz: ShadowRoot }, nome: string) => b.raiz.querySelector(`[name='${nome}']`) as HTMLInputElement;

async function verificarListaENova(): Promise<void> {
  secao("balao: as demandas ja ligadas ao processo (os dois escopos) e Nova demanda pre-preenchida");
  const a = arvore({ selecionado: "160223" });
  const x = detectar(a)!;
  const r = repos();
  const doc = barra();
  const ancora = doc.querySelector("#divArvoreAcoes")!.appendChild(doc.createElement("a")) as HTMLElement;
  const u = await r.unidade.criar({ titulo: "Da unidade", prazo: "2026-10-30", processos: [{ protocolo: CAU, idProcedimento: "148265" }] });
  const e = await r.eu.criar({ titulo: "Minha", prazo: "2026-10-01", processos: [{ protocolo: DIGITOS_CAU }] });
  await r.unidade.criar({ titulo: "De outro processo", prazo: "2026-10-30", processos: [{ protocolo: "50300.000001/2026-11" }] });
  const arq = await r.unidade.criar({ titulo: "Arquivada", prazo: "2026-10-30", processos: [{ protocolo: CAU }] });
  await r.unidade.aplicar(arq.id, (d, c) => ({
    demanda: { ...d, iniciadaEm: 1, concluidaEm: "2026-10-05", arquivadoEm: c.agora },
    registros: [],
  }));
  const b = await abrirBalaoDemandas(ancora, x, deps(r));
  const linhas = [...b.raiz.querySelectorAll<HTMLElement>(".pb-vinc[data-demanda]")];
  checar(
    "so as nao arquivadas deste processo, dos dois escopos (por digitos)",
    linhas
      .map((l) => l.getAttribute("data-demanda"))
      .sort()
      .join() === [u.id, e.id].sort().join(),
    linhas.map((l) => l.getAttribute("data-demanda")),
  );
  const linhaU = linhas.find((l) => l.getAttribute("data-demanda") === u.id)!;
  const linhaE = linhas.find((l) => l.getAttribute("data-demanda") === e.id)!;
  checar(
    "cada uma com situacao, titulo e prazo; a vencida marcada",
    (linhaU.textContent ?? "").includes("Não iniciada") &&
      (linhaU.textContent ?? "").includes("Da unidade") &&
      (linhaU.textContent ?? "").includes("30/10/2026") &&
      linhaE.classList.contains("pb-atrasada") &&
      (linhaE.textContent ?? "").includes("Atrasada"),
    linhaU.textContent,
  );
  checar(
    "acoes validas: nao iniciada tem Iniciar (e nao Concluir); sempre Abrir no painel",
    !!botao(linhaU, "Iniciar") && !botao(linhaU, "Concluir com este documento…") && !!botao(linhaU, "Abrir no painel"),
  );
  checar(
    "com demandas ligadas, o formulario de nova demanda fica atras do botao",
    !b.raiz.querySelector("[data-nova]") && !!botao(b.raiz, "Nova demanda deste processo"),
  );
  botao(b.raiz, "Nova demanda deste processo")!.click();
  checar(
    "campos pre-preenchidos: titulo (<documento> <nº SEI>), processo, responsavel (eu), prazo (hoje), prioridade, quem ve (unidade)",
    entrada(b, "titulo").getAttribute("value") === "Despacho G3 Fixup Cancel L1 0103984" &&
      (b.raiz.querySelector("[data-nova]")?.textContent ?? "").includes(`Processo ${CAU}`) &&
      [...b.raiz.querySelectorAll("select[name='responsavel'] option")].map((o) => o.textContent).join() ===
        "Pedro Soares (eu),Maria Souza" &&
      entrada(b, "prazo").getAttribute("value") === HOJE &&
      [...b.raiz.querySelectorAll("select[name='prioridade'] option[selected]")].map((o) => o.getAttribute("value")).join() === "normal" &&
      b.raiz.querySelector("[aria-label='Quem vê'] [aria-pressed='true']")?.textContent === "Toda a unidade",
  );
  // Prazo, prioridade e responsavel escolhidos (Toda a unidade, com o Entendi ja dado).
  entrada(b, "prazo").value = "2026-11-05";
  escolher(b.raiz.querySelector("select[name='prioridade']") as HTMLSelectElement, "urgente");
  escolher(b.raiz.querySelector("select[name='responsavel']") as HTMLSelectElement, "1");
  entrada(b, "titulo").value = "Analisar o despacho";
  botao(b.raiz, "Criar demanda")!.click();
  await tique(30);
  const nova = (await r.unidade.dados()).find((d) => d.titulo === "Analisar o despacho");
  checar(
    "Nova demanda grava com o vinculo do processo e os campos do formulario",
    !!nova &&
      nova.prazo === "2026-11-05" &&
      nova.prioridade === "urgente" &&
      nova.responsavel?.nome === "Maria Souza" &&
      nova.processos.length === 1 &&
      nova.processos[0]?.protocolo === CAU &&
      nova.processos[0]?.idProcedimento === "148265" &&
      !nova.processos[0]?.sigiloso,
    nova,
  );
  checar(
    "o historico anota a criacao e o balao redesenha com a frase e a nova demanda na lista",
    (await r.unidade.historico(nova?.id)).some((h) => h.campo === "criacao") &&
      (b.raiz.querySelector(".pb-ok")?.textContent ?? "").includes("criada (Toda a unidade)") &&
      b.raiz.querySelectorAll(".pb-vinc[data-demanda]").length === 3,
    b.raiz.querySelector(".pb-ok")?.textContent,
  );

  secao("balao: Nova demanda em Só eu (responsavel e o proprio usuario) e validacoes");
  botao(b.raiz, "Nova demanda deste processo")?.click();
  entrada(b, "titulo").value = "";
  botao(b.raiz, "Criar demanda")!.click();
  await tique(20);
  checar(
    "titulo vazio: a mensagem do repositorio, nada gravado",
    erro(b).includes("título") && (await r.unidade.dados()).length === 4,
    erro(b),
  );
  entrada(b, "titulo").value = "Só minha";
  botao(b.raiz, "Só eu")!.click();
  entrada(b, "prazo").value = "2026-02-30";
  botao(b.raiz, "Criar demanda")!.click();
  await tique(20);
  checar("prazo invalido (2026-02-30): recusado com a mensagem", erro(b).includes("prazo") && (await r.eu.dados()).length === 1, erro(b));
  entrada(b, "prazo").value = "2026-11-06";
  botao(b.raiz, "Criar demanda")!.click();
  await tique(30);
  const minha = (await r.eu.dados()).find((d) => d.titulo === "Só minha");
  checar(
    "Só eu: gravada no escopo eu, com eu como responsavel e o vinculo",
    !!minha &&
      minha.responsavel?.login === "pedro.soares" &&
      minha.processos[0]?.protocolo === CAU &&
      !(await r.unidade.dados()).some((d) => d.titulo === "Só minha"),
    minha,
  );
  b.fechar();
}

async function verificarSemDocumento(): Promise<void> {
  secao("balao: sem documento aberto o titulo e o texto do no do processo, e a conclusao sem documento");
  const a = arvore();
  const x = detectar(a)!;
  const r = repos();
  const doc = barra();
  const ancora = doc.querySelector("#divArvoreAcoes")!.appendChild(doc.createElement("a")) as HTMLElement;
  const b = await abrirBalaoDemandas(ancora, x, deps(r));
  checar(
    "sem demandas: o formulario ja aberto, titulo = texto do no do processo; sem documento",
    !!b.raiz.querySelector("[data-nova]") && entrada(b, "titulo").getAttribute("value") === x.processo.tipo && x.documento === null,
    entrada(b, "titulo").getAttribute("value"),
  );
  b.fechar();
}

async function verificarTransicoes(): Promise<void> {
  secao("balao: Iniciar e Concluir com este documento (transicoes da D2, documento pre-preenchido)");
  const a = arvore({ selecionado: "160223" });
  const x = detectar(a)!;
  const r = repos();
  const doc = barra();
  const ancora = doc.querySelector("#divArvoreAcoes")!.appendChild(doc.createElement("a")) as HTMLElement;
  const d = await r.unidade.criar({ titulo: "Trabalho", prazo: "2026-10-30", processos: [{ protocolo: CAU }] });
  const b = await abrirBalaoDemandas(ancora, x, deps(r));
  const linha = () => b.raiz.querySelector<HTMLElement>(`.pb-vinc[data-demanda='${d.id}']`)!;
  botao(linha(), "Iniciar")!.click();
  await tique(30);
  const ini = await r.unidade.obter(d.id);
  checar(
    "Iniciar: iniciada (D2), historico de inicio, e a linha passa a oferecer Concluir",
    ini?.iniciadaEm !== undefined &&
      (await r.unidade.historico(d.id)).some((h) => h.campo === "inicio") &&
      !botao(linha(), "Iniciar") &&
      !!botao(linha(), "Concluir com este documento…") &&
      (linha().textContent ?? "").includes("Iniciada"),
    ini,
  );
  botao(linha(), "Concluir com este documento…")!.click();
  checar(
    "o formulario de conclusao: data hoje e o documento aberto ja nos campos (numero SEI e titulo)",
    entrada(b, "data").getAttribute("value") === HOJE &&
      entrada(b, "numero").getAttribute("value") === "0103984" &&
      entrada(b, "titulo").getAttribute("value") === "Despacho G3 Fixup Cancel L1",
  );
  entrada(b, "tempo").value = "1h30";
  (b.raiz.querySelector("textarea[name='observacao']") as HTMLTextAreaElement).value = "Feito.";
  entrada(b, "data").value = "2026-02-30";
  botao(linha(), "Concluir")!.click();
  await tique(20);
  checar("data invalida: recusada, nada concluido", erro(b).includes("data") && !(await r.unidade.obter(d.id))?.concluidaEm, erro(b));
  entrada(b, "numero").value = "12ab";
  entrada(b, "data").value = HOJE;
  botao(linha(), "Concluir")!.click();
  await tique(20);
  checar("numero de documento invalido: recusado", erro(b).includes("documento") && !(await r.unidade.obter(d.id))?.concluidaEm, erro(b));
  entrada(b, "numero").value = "0103984";
  botao(linha(), "Concluir")!.click();
  await tique(30);
  const c = await r.unidade.obter(d.id);
  checar(
    "concluida (D2) com data, tempo (1h30 = 90 min), observacao e o documentoEntregue do documento aberto",
    c?.concluidaEm === HOJE &&
      c.tempoGastoMin === 90 &&
      c.observacaoConclusao === "Feito." &&
      c.documentoEntregue?.numero === "0103984" &&
      c.documentoEntregue.titulo === "Despacho G3 Fixup Cancel L1" &&
      !c.documentoEntregue.sigiloso &&
      (await r.unidade.historico(d.id)).some((h) => h.campo === "conclusao"),
    c,
  );
  checar(
    "a frase de conclusao no balao",
    (b.raiz.querySelector(".pb-ok")?.textContent ?? "").includes("concluída em"),
    b.raiz.querySelector(".pb-ok")?.textContent,
  );
  checar(
    "concluida: sem Iniciar nem Concluir (a transicao nao se repete)",
    !botao(b.raiz, "Iniciar") && !botao(b.raiz, "Concluir com este documento…"),
  );
  b.fechar();
}

async function verificarSigiloso(): Promise<void> {
  secao("barra e balao: processo sigiloso (o numero nunca vai ao Texto Padrao)");
  const a = arvore({ sigiloso: true, selecionado: "160223" });
  const x = detectar(a)!;
  const r = repos();
  const marcas = espiarSigilo(r);
  const doc = barra();
  const inst = await instalarNaBarra({
    doc,
    repos: r,
    hoje: () => HOJE,
    docArvore: () => ({ doc: a.doc, url: URL_ARVORE }),
    urls: () => [],
    abrir: () => undefined,
    esperarMs: 50,
    atraso: 1,
  });
  checar(
    "a arvore sigilosa marca os dois escopos ANTES do botao aparecer, uma vez",
    marcas.join() === `unidade:${CAU},eu:${CAU}` && !!doc.querySelector(".spro-dem-ic"),
    marcas,
  );
  marcas.length = 0;
  const ancora = doc.querySelector("#divArvoreAcoes")!.appendChild(doc.createElement("a")) as HTMLElement;
  const b = await abrirBalaoDemandas(ancora, x, deps(r));
  checar(
    "titulo sugerido sem numero (o titulo vai ao texto) e o aviso de sigilo no formulario",
    !!x.documento &&
      entrada(b, "titulo").getAttribute("value") === x.documento.titulo &&
      !(entrada(b, "titulo").getAttribute("value") ?? "").includes(x.documento.numero) &&
      (b.raiz.querySelector("[data-nova]")?.textContent ?? "").includes("sigiloso") &&
      !(b.raiz.querySelector("[data-nova]")?.textContent ?? "").includes(CAU),
  );
  entrada(b, "titulo").value = "Analise reservada";
  botao(b.raiz, "Criar demanda")!.click();
  await tique(30);
  const d = (await r.unidade.dados())[0];
  checar(
    "o vinculo local leva o numero e a marca de sigilo; marcarSigilosos chamado de novo na criacao",
    d?.processos[0]?.protocolo === CAU && d.processos[0].sigiloso === true && marcas.includes(`unidade:${CAU}`),
    { d, marcas },
  );
  const json = await paraOTextoDe(r.unidade, "d");
  const vazio = (JSON.parse(json) as { entidades: { d: Array<{ processos: Array<{ protocolo: string; sigiloso?: boolean }> }> } }).entidades
    .d[0]?.processos[0];
  checar(
    "o envelope (o que vai ao Texto Padrao) nao leva o numero, nem com pontuacao nem so digitos; o vinculo vai vazio e marcado",
    !json.includes(CAU) && !json.includes(DIGITOS_CAU) && !json.includes("99906") && vazio?.protocolo === "" && vazio.sigiloso === true,
    json,
  );
  // Concluir com o documento de processo sigiloso.
  botao(b.raiz, "Iniciar")!.click();
  await tique(30);
  botao(b.raiz, "Concluir com este documento…")!.click();
  botao(b.raiz, "Concluir")!.click();
  await tique(30);
  const c = (await r.unidade.dados())[0];
  const env2 = await paraOTextoDe(r.unidade, "d");
  const envH = await paraOTextoDe(r.unidade, "h");
  checar(
    "documento entregue de processo sigiloso: marcado sigiloso aqui e sem numero no envelope (e no historico)",
    c?.documentoEntregue?.numero === "0103984" &&
      c.documentoEntregue.sigiloso === true &&
      !env2.includes("0103984") &&
      !envH.includes("0103984") &&
      !envH.includes(CAU),
    { c },
  );
  b.fechar();
  inst?.parar();
}

async function verificarDocumentoSigilosoEmProcessoPublico(): Promise<void> {
  secao("balao: documento de nivel sigiloso num processo publico");
  const a = arvore({ selecionado: "160223" });
  const x = detectar(a)!;
  const r = repos();
  const doc = barra();
  const ancora = doc.querySelector("#divArvoreAcoes")!.appendChild(doc.createElement("a")) as HTMLElement;
  const d = await r.unidade.criar({ titulo: "Trab", prazo: "2026-10-30", processos: [{ protocolo: CAU }] });
  await r.unidade.aplicar(d.id, (m, c) => ({ demanda: { ...m, iniciadaEm: c.agora }, registros: [] }));
  const sigiloso: Detectado = { processo: x.processo, documento: { numero: "0103984", titulo: "Despacho", sigiloso: true } };
  const b = await abrirBalaoDemandas(ancora, sigiloso, deps(r));
  botao(b.raiz, "Nova demanda deste processo")!.click();
  checar("titulo sugerido vazio quando o documento e sigiloso", entrada(b, "titulo").getAttribute("value") === "");
  botao(b.raiz, "Concluir com este documento…")!.click();
  botao(b.raiz, "Concluir")!.click();
  await tique(30);
  const c = await r.unidade.obter(d.id);
  checar(
    "o documento sigiloso entregue vai marcado e sem numero no envelope",
    c?.documentoEntregue?.sigiloso === true && !(await paraOTextoDe(r.unidade, "d")).includes("0103984"),
    c?.documentoEntregue,
  );
  b.fechar();
}

async function verificarConsentimento(): Promise<void> {
  secao("balao: o Entendi do Texto Padrao antes da 1a gravacao em Toda a unidade");
  const a = arvore({ selecionado: "160223" });
  const x = detectar(a)!;
  const r = repos();
  const doc = barra();
  const ancora = doc.querySelector("#divArvoreAcoes")!.appendChild(doc.createElement("a")) as HTMLElement;
  const porta = consentimento(false);
  const b = await abrirBalaoDemandas(ancora, x, deps(r, { consentimento: porta }));
  botao(b.raiz, "Criar demanda")!.click();
  await tique(30);
  checar(
    "o aviso no proprio balao, e nada gravado ainda",
    !!b.raiz.querySelector(".pb-pergunta") && (await r.unidade.dados()).length === 0 && (await porta.estado()) !== "ligado",
  );
  checar(
    "o aviso do balao tem a frase de nao escrever dados sigilosos, como o app",
    (b.raiz.querySelector(".pb-pergunta")?.textContent ?? "").includes(
      "Não escreva dados sigilosos no título ou na descrição: ficam no Texto Padrão e todos da unidade os leem.",
    ),
  );
  botao(b.raiz, "Agora não")!.click();
  await tique(30);
  checar(
    "Agora nao: a frase neutra (status), nada gravado, consentimento intacto",
    nota(b) === MENSAGEM_AGORA_NAO && !erro(b) && (await r.unidade.dados()).length === 0 && (await porta.estado()) !== "ligado",
    nota(b),
  );
  checar(
    "a mensagem do app e a do balao falam de demandas",
    MENSAGEM_SEM_ENTENDI.includes("demandas") && MENSAGEM_AGORA_NAO.includes("demandas"),
  );
  botao(b.raiz, "Só eu")!.click();
  botao(b.raiz, "Criar demanda")!.click();
  await tique(30);
  checar(
    "Só eu: grava sem perguntar",
    !b.raiz.querySelector(".pb-pergunta") && (await r.eu.dados()).length === 1 && (await porta.estado()) !== "ligado",
  );
  botao(b.raiz, "Nova demanda deste processo")?.click();
  botao(b.raiz, "Toda a unidade")!.click();
  entrada(b, "titulo").value = "Da unidade";
  botao(b.raiz, "Criar demanda")!.click();
  await tique(30);
  botao(b.raiz, "Entendi")!.click();
  await tique(50);
  checar(
    "Entendi: grava o consentimento e a demanda; da proxima nao pergunta",
    (await porta.estado()) === "ligado" && (await r.unidade.dados()).length === 1 && !b.raiz.querySelector(".pb-pergunta"),
  );
  botao(b.raiz, "Nova demanda deste processo")?.click();
  entrada(b, "titulo").value = "Outra da unidade";
  botao(b.raiz, "Criar demanda")!.click();
  await tique(30);
  checar("ja consentido: grava direto", !b.raiz.querySelector(".pb-pergunta") && (await r.unidade.dados()).length === 2);
  b.fechar();

  secao("balao: fechar com a pergunta aberta e o toggle do botao");
  const r2 = repos();
  const b2 = await abrirBalaoDemandas(ancora, x, deps(r2, { consentimento: consentimento(false) }));
  checar("o balao aberto e o do botao (o mesmo botao fecha)", balaoAberto() === b2 && b2.ancora === ancora);
  botao(b2.raiz, "Criar demanda")!.click();
  await tique(20);
  b2.fechar();
  await tique(20);
  checar("fechar com a pergunta aberta e 'nao': nada gravado", (await r2.unidade.dados()).length === 0 && balaoAberto() === null);

  secao("balao: o consentimento cobre todos os metodos que gravam");
  // Os metodos PUBLICOS (os `private` nao entram) lidos do fonte do repositorio.
  const fonteRepo = readFileSync(join(PASTA_PAGINA, "..", "repositorio.ts"), "utf8").replace(/\r\n/g, "\n");
  const classe = fonteRepo.slice(
    fonteRepo.indexOf("export class RepositorioDemandas"),
    fonteRepo.indexOf("\n}\n", fonteRepo.indexOf("export class RepositorioDemandas")),
  );
  const gravam = [...classe.matchAll(/^ {2}(?:async )?([a-zA-Z]+)\(/gm)].map((m) => m[1] ?? "").filter((m) => m !== "constructor");
  const FORA = new Set(["registrar", "limpar", "lembrarSigilo", "marcarSigilosos"]);
  const LEITURA = /^(entidades|dados|obter|historico|exportarTabela|exportarComConhecidos|sigilosConhecidos|carimboAtual|aoMudar)$/;
  const sobra = gravam.filter((m) => !METODOS_QUE_GRAVAM.has(m) && !FORA.has(m) && !LEITURA.test(m));
  const faltam = [...METODOS_QUE_GRAVAM].filter((m) => !gravam.includes(m));
  checar(
    "todo metodo publico do repositorio ou grava (e pergunta) ou le ou esta na lista de excecoes",
    sobra.length === 0 && faltam.length === 0,
    { sobra, faltam },
  );
}

/** O que o pacote leva e nao leva: as mesmas regras do build.mjs, com a divisao do esbuild. */
async function verificarPacote(): Promise<void> {
  secao("pacote: o balao fora do pacote do carregador e da pagina; nenhum endereco proibido");
  const r = await build({
    entryPoints: [
      { in: join(PASTA_PAGINA, "principal.ts"), out: "pagina" },
      { in: join(PASTA_PAGINA, "pacoteBalao.ts"), out: "balao" },
    ],
    outdir: "saida",
    bundle: true,
    minify: true,
    write: false,
    format: "esm",
    splitting: true,
    chunkNames: "pagina-comum",
    metafile: true,
    charset: "ascii",
    target: ["chrome116", "firefox115"],
    logLevel: "silent",
    loader: { ".css": "text" },
  });
  const modulos = (arq: string) => {
    const o = Object.entries(r.metafile.outputs).find(([p]) => p.endsWith(arq))?.[1];
    return Object.keys(o?.inputs ?? {});
  };
  const leva = (arq: string, parte: string) => modulos(arq).some((m) => m.includes(parte));
  const DO_BALAO = [
    "pagina/conteudo.ts",
    "pagina/balaoDemandas.ts",
    "pagina/acoes.ts",
    "pagina/consentir.ts",
    "pagina/pacoteBalao.ts",
    "ui/base.css",
    "projetos/src/pagina/balao.ts",
  ];
  checar(
    "o pacote da pagina e o pedaco comum nao levam nada do balao",
    DO_BALAO.every((m) => !leva("pagina.js", m) && !leva("pagina-comum.js", m)),
    DO_BALAO.filter((m) => leva("pagina.js", m) || leva("pagina-comum.js", m)),
  );
  checar(
    "o balao leva o conteudo, as acoes e o base.css",
    leva("balao.js", "pagina/conteudo.ts") && leva("balao.js", "pagina/acoes.ts") && leva("balao.js", "ui/base.css"),
  );
  const pagina = r.outputFiles.find((f) => f.path.endsWith("pagina.js"))?.text ?? "";
  const estatico = /^import[^;]*balao\.js/m.test(pagina) || /(?:^|;)import\s*["']\.\/balao\.js["']/.test(pagina);
  checar(
    "o pacote da pagina so importa o balao por import() (nunca estatico)",
    !estatico && /import\(["']\.\/balao\.js["']\)/.test(pagina),
  );
  const todos = r.outputFiles.map((f) => f.text).join("\n");
  const proibidos = ["procedimento_visualizar", "arvore_montar", "procedimento_atribuicao_cadastrar"].filter((p) => todos.includes(p));
  checar("nenhum endereco proibido no pacote (nem no balao)", proibidos.length === 0, proibidos);
  checar("so ASCII", ![...todos].some((c) => c.charCodeAt(0) > 0x7f));
  checar(
    "sem innerHTML/outerHTML escritos nem atributo on*",
    !/\.(innerHTML|outerHTML)\s*=(?!=)|insertAdjacentHTML/.test(todos) && !/\bon[a-z]+\s*=\s*\\?["']/.test(todos),
  );
  const fonte = readFileSync(join(PASTA_PAGINA, "arvore.ts"), "utf8");
  checar("o botao nao monta URL do SEI nem busca a arvore", !/controlador\.php|fetch\(|XMLHttpRequest|abrirArvore/.test(fonte));
}

export async function verificarBarra(): Promise<void> {
  verificarDeteccao();
  await verificarBotao();
  await verificarIndicador();
  await verificarListaENova();
  await verificarSemDocumento();
  await verificarTransicoes();
  await verificarSigiloso();
  await verificarDocumentoSigilosoEmProcessoPublico();
  await verificarConsentimento();
  await verificarPacote();
  void URL_BARRA;
}
