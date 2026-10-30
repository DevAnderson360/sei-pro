/**
 * A tela do processo (sei41/arvore.html, com os nós desenhados como o SEI os
 * desenha por JavaScript: a pasta carregada, com os documentos dos literais, e
 * uma pasta mais antiga que o usuário abriu depois da carga): o processo e os
 * documentos lidos só da árvore já aberta, o ícone junto ao número (SEI 4.1 e
 * SEI 5), a faixa só com atraso ou vencimento em até 3 dias úteis (a mais
 * urgente primeiro, com "(+N)"), o redesenho do topo sem duplicar e sem laço,
 * o sigilo da árvore (marca uma vez por carga, antes do ícone; etapa nova sem
 * nome sugerido; documento marcado; nada de número no histórico) e o balão
 * "Projetos deste processo" com "Concluir com documento…" e "Adicionar a um
 * projeto". No fim, o que a revisão da T7 pediu nos balões (notas-t8): foco nos
 * redesenhos internos, Tab para fora fecha, "Agora não" neutro, conferir antes
 * do "Entendi", o teto da duração e o "Processo do projeto" que já é.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { areaMemoria } from "@comum/armazenamento/area";
import { consentimentoNaArea } from "@comum/sincronia/consentimento";
import { lerArvore } from "@nucleo/dominio/arvore";
import { paginaDe } from "@nucleo/sessao/pagina";
import { comConsentimento } from "../../src/app/colaboracao/consentir";
import { MAX_DIAS_UTEIS } from "../../src/modelo/calendario";
import { escoposDaUnidade } from "../../src/modelo/escopo";
import type { Vis } from "../../src/modelo/tipos";
import { ErroValidacao } from "../../src/modelo/validacao";
import { chaveProtocolo } from "../../src/modelo/vinculos";
import { concluirComDocumento } from "../../src/pagina/adicionar";
import { documentosDaArvore, instalarNaArvore, processoDaArvore } from "../../src/pagina/arvore";
import { balaoAberto } from "../../src/pagina/balaoAtual";
import { abrirBalaoProcesso, type DepsBalaoProcesso } from "../../src/pagina/balaoProcesso";
import { type DocumentoDaArvore, MENSAGEM_AGORA_NAO, type ProcessoNaTela } from "../../src/pagina/conteudo";
import { RepositorioProjetos } from "../../src/repositorio";
import { HOSTIL } from "../cenarioGantt";
import { HOJE } from "../fabrica";
import { escolher } from "../util";
import { botao, checar, lanca, secao, telaSei, tique } from "./util";

const URL_ARVORE = "https://treinamento.sei.sp.gov.br/sei/controlador.php?acao=procedimento_visualizar&id_procedimento=148265";
const CAU = "99906.713-630.000032/2025-82";

/**
 * A árvore como o SEI a desenha: o nó do processo no #topmenu (o alvo muda do 4.1 para o 5) e os nós em #divArvore
 * (`anchorImg<id>` com o ícone e `anchor<id>` com o rótulo). Na pasta carregada (a III, a mais nova), os documentos
 * dos literais, um deles cancelado; antes dela, a pasta II, mais antiga, que o usuário abriu depois da carga (os
 * documentos dela estão desenhados, mas não nos literais da página), também com um cancelado.
 */
/** As telas que entraram em laço de recolocação do ícone (o disjuntor de `tela` cortou o laço). */
const lacos: string[] = [];

function tela(alvo: "ifrConteudoVisualizacao" | "ifrVisualizacao", o: { sigiloso?: boolean; desenhar?: boolean } = {}) {
  const { doc } = telaSei("sei41/arvore.html");
  // Disjuntor: um laço de recolocação do ícone (que travaria a suíte: o observador do linkedom roda em microtarefa e
  // os timers nunca chegam) é cortado tirando o topo, e vira FALHA no fim (`lacos`).
  let colocacoes = 0;
  const disjuntor = new doc.defaultView!.MutationObserver((rs) => {
    for (const x of rs) for (const n of x.addedNodes) if ((n as Element).classList?.contains("spro-prj-ic")) colocacoes++;
    if (colocacoes <= 20) return;
    disjuntor.disconnect();
    lacos.push(alvo);
    doc.querySelector("#topmenu")?.replaceChildren();
  });
  disjuntor.observe(doc.querySelector("#topmenu")!, { childList: true, subtree: true });
  for (const s of doc.querySelectorAll("script")) {
    let t = s.textContent ?? "";
    if (!t.includes("infraArvoreNo(")) continue;
    t = t.replace('(0103989)","svg/documento_interno.svg', '(0103989)","svg/documento_cancelado.svg');
    if (o.sigiloso) t = t.replaceAll("Acesso Restrito", "Sigiloso");
    s.textContent = t;
  }
  const no = doc.createElement("a");
  no.id = "anchor148265";
  no.setAttribute("target", alvo);
  no.textContent = CAU;
  doc.querySelector("#topmenu")!.append(no);
  const arvore = doc.querySelector("#divArvore")!;
  const desenhar = (id: string, rotulo: string, img = "documento_interno") => {
    const ic = doc.createElement("a");
    ic.id = `anchorImg${id}`;
    const im = doc.createElement("img");
    im.setAttribute("src", `svg/${img}.svg?18`);
    ic.append(im);
    const a = doc.createElement("a");
    a.id = `anchor${id}`;
    const sp = doc.createElement("span");
    sp.textContent = rotulo;
    a.append(sp);
    arvore.append(ic, a);
  };
  if (o.desenhar !== false) {
    desenhar("PASTA1", "I", "processo_fechado");
    desenhar("PASTA2", "II", "processo_aberto");
    desenhar("170001", "Parecer 88 (0094500)");
    desenhar("170002", "Ofício 3 (0094501)", "documento_cancelado");
    desenhar("PASTA3", "III", "processo_aberto");
    desenhar("160223", "Despacho G3 Fixup Cancel L1 (0103984)");
    desenhar("160224", "Despacho I2 Lote Depois (0103989)", "documento_cancelado");
    desenhar("160225", 'Relatório Vfinal V3 - "aspas" & 50% + 1-numerado (0103990)', "documento_pdf");
    desenhar("160226", "Despacho V1 nº 1ª & Cia Final (0103991)");
  }
  return { doc, no };
}

async function repos() {
  const area = areaMemoria();
  const esc = escoposDaUnidade("treinamento.sei.sp.gov.br", "pedro.soares", "110000001");
  let relogio = 1_000;
  const carimbo = () => ({ agora: ++relogio, dispositivo: "t", por: "pedro.soares", nome: "Pedro Soares" });
  const r: Record<Vis, RepositorioProjetos> = {
    unidade: new RepositorioProjetos(area, esc.unidade, carimbo),
    eu: new RepositorioProjetos(area, esc.eu, carimbo),
  };
  return r;
}

/** Cada `marcarSigilosos` pedido aos repositórios ("vis:numero,numero"). */
function espiarSigilo(r: Record<Vis, RepositorioProjetos>): string[] {
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

/**
 * O linkedom não acompanha o foco: o espião anota quem recebeu `focus()`. O método é do `Element`, mas outra prova
 * pode ter deixado uma cópia própria num protótipo mais abaixo (o do botão): troca em todos os que a têm.
 */
function espiarFoco(doc: Document): { focados: Element[]; restaurar(): void } {
  const donos = new Map<object, unknown>();
  for (const tag of ["button", "select", "input", "a", "div"]) {
    let proto = Object.getPrototypeOf(doc.createElement(tag)) as object | null;
    for (; proto; proto = Object.getPrototypeOf(proto) as object | null)
      if (Object.hasOwn(proto, "focus") && !donos.has(proto)) donos.set(proto, (proto as { focus: unknown }).focus);
  }
  const focados: Element[] = [];
  for (const dono of donos.keys())
    (dono as { focus: () => void }).focus = function (this: Element) {
      focados.push(this);
    };
  return {
    focados,
    restaurar: () => {
      for (const [dono, original] of donos) (dono as { focus: unknown }).focus = original;
    },
  };
}

/** Evento do linkedom com as propriedades de teclado/foco que ele não preenche. */
function evento(doc: Document, tipo: string, props: Record<string, unknown>): Event {
  const Ev = (doc.defaultView as unknown as { Event: typeof Event }).Event;
  const ev = new Ev(tipo, { bubbles: true, cancelable: true });
  for (const [k, v] of Object.entries(props)) Object.defineProperty(ev, k, { value: v });
  return ev;
}

async function verificarLeitura(): Promise<void> {
  secao("arvore: o processo e os documentos da arvore ja aberta");
  const t = tela("ifrConteudoVisualizacao");
  const arv = lerArvore(paginaDe(t.doc, URL_ARVORE));
  const p = processoDaArvore(arv);
  checar("processo dos literais da propria pagina", p.protocolo === CAU && p.idProcedimento === "148265" && !p.sigiloso && !!p.tipo, p);
  const docs = documentosDaArvore(t.doc, arv);
  checar(
    "documentos na ordem da arvore desenhada, o mais recente primeiro (a pasta antiga aberta depois vai para o fim)",
    docs.map((d) => d.numero).join() === "0103991,0103990,0103984,0094500",
    docs,
  );
  checar(
    "titulo dos literais com &amp; decodificado; o do no desenhado sem o numero",
    docs[0]?.titulo === "Despacho V1 nº 1ª & Cia Final" && docs.at(-1)?.titulo === "Parecer 88",
    docs.map((d) => d.titulo),
  );
  checar(
    "o cancelado fica de fora (o dos literais e o desenhado com o icone de cancelado)",
    !docs.some((d) => d.numero === "0103989" || d.numero === "0094501"),
  );
  const semDesenho = tela("ifrConteudoVisualizacao", { desenhar: false });
  checar(
    "sem nada desenhado: os dos literais, o mais recente primeiro",
    documentosDaArvore(semDesenho.doc, lerArvore(paginaDe(semDesenho.doc, URL_ARVORE)))
      .map((d) => d.numero)
      .join() === "0103991,0103990,0103984",
  );
  const soDesenho = documentosDaArvore(t.doc, null);
  checar(
    "sem os literais: so os desenhados (nunca o numero de um no que nao e documento)",
    soDesenho.map((d) => d.numero).join() === "0103991,0103990,0103984,0094500" &&
      soDesenho[1]?.titulo.startsWith('Relatório Vfinal V3 - "aspas"'),
    soDesenho,
  );
}

async function verificarIconeEFaixa(): Promise<void> {
  secao("arvore: icone junto ao numero e faixa com atraso (SEI 4.1)");
  const t = tela("ifrConteudoVisualizacao");
  const r = await repos();
  const proj = await r.unidade.criarProjeto({ nome: HOSTIL, processo: { protocolo: CAU, idProcedimento: "148265" } });
  const air = await r.unidade.criarEtapa({ projeto: proj.id, nome: "Relatório de AIR", inicio: "2026-09-01", fim: "2026-10-01" });
  const estrela = t.doc.createElement("button");
  estrela.className = "spro-fav-estrela";
  t.no.after(estrela);
  const abertos: Array<{ ancora: HTMLElement; p: ProcessoNaTela; docs: () => DocumentoDaArvore[] }> = [];
  const inst = await instalarNaArvore({
    doc: t.doc,
    url: URL_ARVORE,
    repos: r,
    hoje: () => HOJE,
    temaEscuro: false,
    esperarMs: 50,
    atraso: 1,
    abrir: (ancora, processo, documentos) => void abertos.push({ ancora, p: processo, docs: documentos }),
  });
  const ic = t.doc.querySelector<HTMLElement>("#topmenu .spro-prj-ic")!;
  // O espião das recolocações do ícone, desde a instalação: um laço de recolocação vira FALHA (a contagem), e não uma
  // suíte travada, porque o espião para a instalação depois de 5.
  let inseridos = 0;
  const espia = new t.doc.defaultView!.MutationObserver((rs) => {
    for (const x of rs) for (const n of x.addedNodes) if ((n as Element).classList?.contains("spro-prj-ic")) inseridos++;
    if (inseridos > 5) inst?.parar();
  });
  espia.observe(t.doc.querySelector("#topmenu")!, { childList: true, subtree: true });
  checar("depois do numero e da estrela", !!inst && estrela.nextElementSibling === ic);
  checar("realcado (ligado) e com o ponto de atraso", !!ic?.hasAttribute("data-ativo") && !!ic?.hasAttribute("data-atraso"));
  checar(
    "botao que abre um dialogo, com o rotulo",
    ic.tagName === "BUTTON" &&
      ic.getAttribute("aria-haspopup") === "dialog" &&
      ic.getAttribute("aria-expanded") === "false" &&
      ic.getAttribute("aria-label") === "Projetos deste processo (em 1 projeto · com etapa atrasada)",
    ic.getAttribute("aria-label"),
  );
  const faixa = t.doc.querySelector<HTMLElement>(".spro-prj-faixa")!;
  checar(
    "faixa sob o numero (antes dos nos), com a etapa e o projeto como texto",
    !faixa.hidden &&
      faixa.nextElementSibling?.id === "divArvore" &&
      (faixa.querySelector("b")?.textContent ?? "") === "Relatório de AIR" &&
      (faixa.textContent ?? "").includes(`atrasada · ${HOSTIL}`) &&
      !(faixa.textContent ?? "").includes("(+") &&
      !faixa.querySelector("img") &&
      faixa.getAttribute("aria-haspopup") === "dialog",
    faixa.textContent,
  );
  checar(
    "nao instala duas vezes",
    (await instalarNaArvore({
      doc: t.doc,
      url: URL_ARVORE,
      repos: r,
      hoje: () => HOJE,
      temaEscuro: false,
      esperarMs: 50,
      abrir: () => undefined,
    })) === null,
  );
  faixa.click();
  checar(
    "a faixa abre o balao (junto dela), com os documentos da arvore",
    abertos.length === 1 && abertos[0]?.ancora === faixa && abertos[0].p.protocolo === CAU && abertos[0].docs()[0]?.numero === "0103991",
  );
  ic.click();
  checar("o icone tambem", abertos.length === 2 && abertos[1]?.ancora === ic);

  secao("arvore: a faixa so com atraso ou vencendo em ate 3 dias uteis");
  await r.unidade.concluirEtapa(air.id, HOJE);
  const perto = await r.unidade.criarEtapa({ projeto: proj.id, nome: "Minuta", inicio: "2026-10-01", fim: "2026-10-08" });
  await tique(30);
  checar(
    "vence em 2 dias uteis: faixa de vencimento",
    !faixa.hidden &&
      faixa.classList.contains("spro-prj-vence") &&
      (faixa.textContent ?? "").includes("vence em 2 dias úteis") &&
      !ic?.hasAttribute("data-atraso"),
    faixa.textContent,
  );
  await r.unidade.editarEtapa(perto.id, { fim: "2026-10-13" }, HOJE);
  await tique(30);
  checar("a 4 dias uteis (o feriado de 12/10 nao conta): sem faixa, icone so realcado", faixa.hidden && !!ic?.hasAttribute("data-ativo"));

  secao("arvore: o SEI redesenha o topo (sem duplicar e sem laco)");
  checar("ate aqui (pinturas, faixa, cliques), o icone nunca foi recolocado", inseridos === 0, inseridos);
  ic.remove();
  await tique(30);
  checar("o icone volta, uma vez so", t.doc.querySelectorAll("#topmenu .spro-prj-ic").length === 1 && inseridos === 1, inseridos);
  const novo = t.doc.createElement("a");
  novo.id = "anchor148265";
  novo.setAttribute("target", "ifrConteudoVisualizacao");
  novo.textContent = CAU;
  t.doc.querySelector("#topmenu")!.replaceChildren(novo);
  await tique(30);
  checar(
    "o topo inteiro redesenhado: o icone logo depois do numero novo, uma vez",
    novo.nextElementSibling === ic && t.doc.querySelectorAll("#topmenu .spro-prj-ic").length === 1 && inseridos === 2,
    inseridos,
  );
  await tique(60);
  checar("sem laco: o icone recolocado nao pede outra colocacao", inseridos === 2, inseridos);
  faixa.remove();
  await tique(30);
  checar("a faixa tirada volta antes dos nos", faixa.isConnected && faixa.nextElementSibling?.id === "divArvore");
  inst?.parar();
  ic.remove();
  await tique(30);
  checar("parado: nao recoloca", !ic.isConnected && inseridos === 2);
  espia.disconnect();
}

async function verificarUrgentes(): Promise<void> {
  secao("arvore: a mais urgente primeiro, com (+N)");
  const t = tela("ifrConteudoVisualizacao");
  const r = await repos();
  const p1 = await r.unidade.criarProjeto({ nome: "Revisão", processo: { protocolo: CAU } });
  await r.unidade.criarEtapa({ projeto: p1.id, nome: "Minuta", inicio: "2026-10-01", fim: "2026-10-08" });
  await r.unidade.criarEtapa({ projeto: p1.id, nome: "Ofício", inicio: "2026-09-28", fim: "2026-10-05" });
  const p2 = await r.eu.criarProjeto({ nome: "Pessoal" });
  // O mesmo processo sem a pontuação: casa pelos dígitos.
  await r.eu.criarEtapa({
    projeto: p2.id,
    nome: "Leitura",
    inicio: "2026-09-01",
    fim: "2026-10-01",
    processo: { protocolo: chaveProtocolo(CAU) },
  });
  const inst = await instalarNaArvore({
    doc: t.doc,
    url: URL_ARVORE,
    repos: r,
    hoje: () => HOJE,
    temaEscuro: false,
    esperarMs: 50,
    atraso: 1,
    abrir: () => undefined,
  });
  const faixa = t.doc.querySelector<HTMLElement>(".spro-prj-faixa")!;
  checar(
    "a de mais dias de atraso primeiro, e as outras contadas",
    (faixa.querySelector("b")?.textContent ?? "") === "Leitura" && (faixa.textContent ?? "").endsWith("atrasada · Pessoal (+2)"),
    faixa.textContent,
  );
  checar(
    "o icone conta os projetos dos dois escopos",
    t.doc.querySelector("#topmenu .spro-prj-ic")?.getAttribute("aria-label") ===
      "Projetos deste processo (em 2 projetos · com etapa atrasada)",
  );
  inst?.parar();
}

async function verificarSei5(): Promise<void> {
  secao("arvore: SEI 5 (o alvo e o visualizador unico) e processo fora de projeto");
  const t5 = tela("ifrVisualizacao");
  const vazio = await repos();
  const inst = await instalarNaArvore({
    doc: t5.doc,
    url: URL_ARVORE,
    repos: vazio,
    hoje: () => HOJE,
    temaEscuro: true,
    esperarMs: 50,
    abrir: () => undefined,
  });
  const ic5 = t5.doc.querySelector<HTMLElement>("#topmenu .spro-prj-ic");
  checar(
    "icone mesmo sem projeto (e por ele que se adiciona), sem realce nem faixa",
    !!ic5 &&
      t5.no.nextElementSibling === ic5 &&
      !ic5.hasAttribute("data-ativo") &&
      ic5.getAttribute("aria-label") === "Adicionar este processo a um projeto",
  );
  checar(
    "faixa escondida e o modo noturno",
    (t5.doc.querySelector(".spro-prj-faixa") as HTMLElement).hidden && ic5?.classList.contains("spro-prj-escuro") === true,
  );
  const css = t5.doc.getElementById("spro-prj-estilo-sei")?.textContent ?? "";
  checar(
    "modo noturno: o icone da faixa atrasada e o da que vence com as cores claras (contraste no fundo escuro)",
    css.includes(".spro-prj-faixa.spro-prj-escuro svg{color:#ff7d73}") &&
      css.includes(".spro-prj-faixa.spro-prj-escuro.spro-prj-vence svg{color:#e8b04a}"),
  );
  checar(
    "na arvore o icone usa a mesma geometria do botao dos Monitorados (inline-block, linha de base, 24 px) e fica alinhado a eles",
    css.includes(
      "#topmenu .spro-prj-ic{display:inline-block;width:26px;height:24px;padding:0;margin:0 1px;line-height:0;vertical-align:baseline}",
    ) && css.includes("#topmenu .spro-prj-ic svg{display:block;width:18px;height:18px;margin:3px auto}"),
  );
  inst?.parar();
  checar(
    "sem o no do processo desenhado: nada",
    (await instalarNaArvore({
      doc: telaSei("sei41/arvore.html").doc,
      url: URL_ARVORE,
      repos: vazio,
      hoje: () => HOJE,
      temaEscuro: false,
      esperarMs: 20,
      abrir: () => undefined,
    })) === null,
  );
  const semArvore = telaSei("sei41/caixa.html").doc;
  checar(
    "pagina sem os literais da arvore: nada",
    (await instalarNaArvore({
      doc: semArvore,
      url: URL_ARVORE,
      repos: vazio,
      hoje: () => HOJE,
      temaEscuro: false,
      esperarMs: 20,
      abrir: () => undefined,
    })) === null,
  );
}

async function verificarSigilo(): Promise<void> {
  secao("arvore: processo sigiloso na arvore marca os vinculos, uma vez por carga e antes do icone");
  const ts = tela("ifrConteudoVisualizacao", { sigiloso: true });
  const rs = await repos();
  const ps = await rs.unidade.criarProjeto({ nome: "Apuração", processo: { protocolo: CAU, idProcedimento: "148265" } });
  const es = await rs.unidade.criarEtapa({ projeto: ps.id, nome: "Instrução", inicio: "2026-10-01", fim: "2026-10-20" });
  const pe = await rs.eu.criarProjeto({ nome: "Meu" });
  const ee = await rs.eu.criarEtapa({ projeto: pe.id, nome: "Ler", inicio: "2026-10-01", fim: "2026-10-20", processo: { protocolo: CAU } });
  const chamadas = espiarSigilo(rs);
  const historico = async () => [...(await rs.unidade.historico()), ...(await rs.eu.historico())];
  const idsAntes = new Set((await historico()).map((x) => x.id));
  const instS = await instalarNaArvore({
    doc: ts.doc,
    url: URL_ARVORE,
    repos: rs,
    hoje: () => HOJE,
    temaEscuro: false,
    esperarMs: 50,
    atraso: 1,
    abrir: () => undefined,
  });
  checar(
    "o icone so aparece com a marca feita (o balao nao abre antes dela)",
    !!ts.doc.querySelector("#topmenu .spro-prj-ic") &&
      (await rs.unidade.obterProjeto(ps.id))?.processo?.sigiloso === true &&
      (await rs.eu.obterEtapa(ee.id))?.processo?.sigiloso === true,
  );
  await tique(30);
  await instS?.atualizar();
  await tique(30);
  checar(
    "uma marca por escopo nesta carga (mesmo com releituras)",
    [...chamadas].sort().join("|") === `eu:${CAU}|unidade:${CAU}`,
    chamadas,
  );
  checar(
    "marcar nao gera registro no historico",
    (await historico()).every((x) => idsAntes.has(x.id)),
  );
  instS?.parar();

  secao("arvore: o balao de processo sigiloso");
  const consentimento = consentimentoNaArea({
    area: areaMemoria(),
    chavePreferencias: "projetos/consentimento",
    campo: "textoPadrao",
    chave: "k",
  });
  await consentimento.definir("ligado");
  const arvS = lerArvore(paginaDe(ts.doc, URL_ARVORE));
  const bs = await abrirBalaoProcesso(ts.no, processoDaArvore(arvS), {
    modo: "arvore",
    repos: rs,
    hoje: () => HOJE,
    sigla: "TESTE",
    temaEscuro: false,
    cssBase: "",
    consentimento,
    documentos: () => documentosDaArvore(ts.doc, arvS),
    abrirNoPainel: () => undefined,
  });
  checar("sigiloso: a etapa nova sem nome sugerido", (bs.raiz.querySelector("input[name='nome']") as HTMLInputElement).value === "");
  const vinc = [...bs.raiz.querySelectorAll<HTMLElement>(".pb-vinc")].find((v) => v.getAttribute("data-projeto") === ps.id)!;
  botao(vinc, "Concluir com documento…")!.click();
  escolher(bs.raiz.querySelector("select[name='documento']") as HTMLSelectElement, "0103991");
  botao(bs.raiz, "Concluir")!.click();
  await tique(40);
  const ec = await rs.unidade.obterEtapa(es.id);
  checar(
    "documento de etapa de processo sigiloso: marcado (o numero fica so neste computador)",
    ec?.concluidaEm === HOJE && ec.documento?.numero === "0103991" && ec.documento.sigiloso === true,
    ec?.documento,
  );
  escolher(bs.raiz.querySelector("select[name='projeto']") as HTMLSelectElement, `unidade:${ps.id}`);
  (bs.raiz.querySelector("input[name='nome']") as HTMLInputElement).value = "Diligência";
  botao(bs.raiz, "Adicionar")!.click();
  await tique(40);
  const nova = (await rs.unidade.dados()).etapas.find((e) => e.nome === "Diligência");
  const novos = (await historico()).filter((x) => !idsAntes.has(x.id));
  checar(
    "a etapa nova entra com o processo marcado e nada do numero do processo no historico",
    nova?.processo?.sigiloso === true &&
      novos.length > 0 &&
      !JSON.stringify(novos).includes(CAU) &&
      !JSON.stringify(novos).includes(chaveProtocolo(CAU)),
    novos,
  );
  bs.fechar();
}

async function verificarBalaoArvore(): Promise<void> {
  secao("arvore: balao com concluir com documento");
  const rb = await repos();
  const pb = await rb.unidade.criarProjeto({ nome: "Revisão", processo: { protocolo: CAU, idProcedimento: "148265" } });
  const e1 = await rb.unidade.criarEtapa({ projeto: pb.id, nome: "Relatório de AIR", inicio: "2026-09-01", fim: "2026-10-01" });
  const consentimento = consentimentoNaArea({
    area: areaMemoria(),
    chavePreferencias: "projetos/consentimento",
    campo: "textoPadrao",
    chave: "k",
  });
  await consentimento.definir("ligado");
  const tb = tela("ifrConteudoVisualizacao");
  const arvB = lerArvore(paginaDe(tb.doc, URL_ARVORE));
  const painel: string[] = [];
  const balao = await abrirBalaoProcesso(tb.no, processoDaArvore(arvB), {
    modo: "arvore",
    repos: rb,
    hoje: () => HOJE,
    sigla: "TESTE",
    temaEscuro: false,
    cssBase: "",
    consentimento,
    documentos: () => documentosDaArvore(tb.doc, arvB),
    abrirNoPainel: (id, etapa) => void painel.push(`${id}:${etapa ?? "-"}`),
  });
  const raiz = balao.raiz;
  checar(
    "titulo e o formulario de adicionar ja aberto",
    (raiz.querySelector(".pb-tit b")?.textContent ?? "") === "Projetos deste processo" && !!raiz.querySelector("select[name='projeto']"),
  );
  checar(
    "sem especificacao na arvore: o nome padrao e o tipo",
    (raiz.querySelector("input[name='nome']") as HTMLInputElement).value === arvB.tipo,
  );
  botao(raiz, "Concluir com documento…")!.click();
  const sel = raiz.querySelector("select[name='documento']") as HTMLSelectElement;
  checar(
    "o combo com os documentos da arvore aberta, o mais recente primeiro",
    [...sel.options].map((o) => o.value).join() === ",0103991,0103990,0103984,0094500",
    [...sel.options].map((o) => o.value),
  );
  const data = raiz.querySelector("input[name='data']") as HTMLInputElement;
  data.value = "2026-13-40";
  botao(raiz, "Concluir")!.click();
  await tique(20);
  checar(
    "data que nao existe: a mensagem, nada gravado",
    (raiz.querySelector(".pb-erro")?.textContent ?? "").includes("data") && !(await rb.unidade.obterEtapa(e1.id))?.concluidaEm,
  );
  escolher(sel, "0094500");
  data.value = HOJE;
  botao(raiz, "Concluir")!.click();
  await tique(40);
  const concluida = await rb.unidade.obterEtapa(e1.id);
  checar(
    "concluida hoje com o documento (numero e titulo do no desenhado)",
    concluida?.concluidaEm === HOJE && concluida.documento?.numero === "0094500" && concluida.documento.titulo === "Parecer 88",
    concluida,
  );
  checar(
    "o balao se refaz: a frase e a etapa sai das abertas (sem concluir de novo)",
    (balao.raiz.querySelector(".pb-ok")?.textContent ?? "").includes("concluída em 06/10") &&
      !balao.raiz.querySelector(".pb-etapa") &&
      !botao(balao.raiz, "Concluir com documento…"),
  );
  botao(balao.raiz, "Abrir no painel")!.click();
  checar(
    "Abrir no painel (aqui, o lateral): o projeto, ainda dentro do clique, e o balao fecha",
    painel.join() === `${pb.id}:-` && !balaoAberto(),
  );

  secao("arvore: titulo hostil de documento desenhado e so texto");
  const th = tela("ifrConteudoVisualizacao");
  const hostil = th.doc.createElement("a");
  hostil.id = "anchor170009";
  hostil.textContent = `${HOSTIL} (0094509)`;
  th.doc.querySelector("#divArvore")!.prepend(hostil);
  await rb.unidade.criarEtapa({ projeto: pb.id, nome: "Outra", inicio: "2026-10-01", fim: "2026-10-20" });
  const arvH = lerArvore(paginaDe(th.doc, URL_ARVORE));
  const docsH = documentosDaArvore(th.doc, arvH);
  checar(
    "o titulo do no desenhado vem inteiro, como texto",
    docsH.at(-1)?.titulo === HOSTIL && docsH.at(-1)?.numero === "0094509",
    docsH.at(-1),
  );
  const bh = await abrirBalaoProcesso(th.no, processoDaArvore(arvH), {
    modo: "arvore",
    repos: rb,
    hoje: () => HOJE,
    sigla: "TESTE",
    temaEscuro: false,
    cssBase: "",
    consentimento,
    documentos: () => documentosDaArvore(th.doc, arvH),
    abrirNoPainel: () => undefined,
  });
  botao(bh.raiz, "Concluir com documento…")!.click();
  const opcaoHostil = [...bh.raiz.querySelectorAll("select[name='documento'] option")].find((o) => o.getAttribute("value") === "0094509");
  checar(
    "no combo do balao: texto, nenhum elemento criado",
    (opcaoHostil?.textContent ?? "") === `${HOSTIL} (0094509)` && !bh.raiz.querySelector("img"),
    opcaoHostil?.textContent,
  );
  bh.fechar();
}

async function verificarRevisaoT7(): Promise<void> {
  secao("baloes (notas da T7): foco nos redesenhos internos e o Como no lugar");
  const t = tela("ifrConteudoVisualizacao");
  const cru = await repos();
  const pu = await cru.unidade.criarProjeto({ nome: "Revisão", processo: { protocolo: CAU, idProcedimento: "148265" } });
  const a1 = await cru.unidade.criarEtapa({ projeto: pu.id, nome: "Minuta", inicio: "2026-10-01", fim: "2026-10-20" });
  await cru.unidade.criarEtapa({ projeto: pu.id, nome: "Parecer", inicio: "2026-10-01", fim: "2026-10-22" });
  const pessoal = await cru.eu.criarProjeto({ nome: "Pessoal" });
  const consentimento = consentimentoNaArea({
    area: areaMemoria(),
    chavePreferencias: "projetos/consentimento",
    campo: "textoPadrao",
    chave: "k",
  });
  const arv = lerArvore(paginaDe(t.doc, URL_ARVORE));
  const deps = (o: Partial<DepsBalaoProcesso> = {}): DepsBalaoProcesso => ({
    modo: "arvore",
    repos: cru,
    hoje: () => HOJE,
    sigla: "TESTE",
    temaEscuro: false,
    cssBase: "",
    consentimento,
    documentos: () => documentosDaArvore(t.doc, arv),
    abrirNoPainel: () => undefined,
    ...o,
  });
  const foco = espiarFoco(t.doc);
  try {
    let b = await abrirBalaoProcesso(t.no, processoDaArvore(arv), deps());
    checar(
      "o projeto sugerido e o primeiro ainda nao ligado",
      (b.raiz.querySelector("select[name='projeto']") as HTMLSelectElement).value === `eu:${pessoal.id}`,
    );
    const vinc = () => b.raiz.querySelector<HTMLElement>(`.pb-vinc[data-projeto='${pu.id}']`)!;
    botao(vinc(), "Concluir com documento…")!.click();
    checar(
      "Concluir com documento…: o foco vai ao primeiro controle do formulario",
      foco.focados.at(-1) === vinc().querySelector("select[name='etapa']"),
    );
    botao(vinc(), "Cancelar")!.click();
    checar("Cancelar: o foco volta ao Concluir com documento…", foco.focados.at(-1) === botao(vinc(), "Concluir com documento…"));
    const como = () => [...b.raiz.querySelectorAll<HTMLButtonElement>("[aria-label='Como'] button")];
    const antes = como();
    botao(b.raiz, "Ligar a uma etapa")!.click();
    checar(
      "o segmentado Como muda no lugar (os mesmos botoes, aria-pressed atualizado; o foco fica onde estava)",
      como().length === 3 &&
        como().every((x, i) => x === antes[i] && x.isConnected) &&
        antes[1]?.getAttribute("aria-pressed") === "true" &&
        antes[0]?.getAttribute("aria-pressed") === "false",
    );
    botao(b.raiz, "Nova etapa")!.click();
    checar(
      "a duracao vai ate o teto dos dias uteis",
      (b.raiz.querySelector("input[name='duracao']") as HTMLInputElement).getAttribute("max") === String(MAX_DIAS_UTEIS),
    );
    b.fechar();

    const naCaixa = await abrirBalaoProcesso(t.no, processoDaArvore(arv), deps({ modo: "caixa" }));
    botao(naCaixa.raiz, "Adicionar a outro projeto")!.click();
    checar(
      "caixa: Adicionar a outro projeto poe o foco no primeiro controle (o projeto)",
      foco.focados.at(-1) === naCaixa.raiz.querySelector("select[name='projeto']"),
    );
    naCaixa.fechar();

    secao("baloes (notas da T7): Tab para fora do balao fecha e o foco volta ao icone");
    b = await abrirBalaoProcesso(t.no, processoDaArvore(arv), deps());
    const focaveis = () => [...b.raiz.querySelectorAll<HTMLElement>("button:not([disabled]), select, input, textarea, a[href]")];
    const meio = focaveis()[2]!;
    meio.dispatchEvent(evento(t.doc, "keydown", { key: "Tab", shiftKey: false }));
    checar("Tab num controle do meio: segue aberto", balaoAberto() === b);
    const ultimo = focaveis().at(-1)!;
    const tabFim = evento(t.doc, "keydown", { key: "Tab", shiftKey: false });
    ultimo.dispatchEvent(tabFim);
    checar(
      "Tab no ultimo controle: fecha e o foco volta ao icone",
      !balaoAberto() && foco.focados.at(-1) === t.no && tabFim.defaultPrevented,
    );
    b = await abrirBalaoProcesso(t.no, processoDaArvore(arv), deps());
    focaveis()[0]!.dispatchEvent(evento(t.doc, "keydown", { key: "Tab", shiftKey: true }));
    checar("Shift+Tab no primeiro: fecha", !balaoAberto() && foco.focados.at(-1) === t.no);
    b = await abrirBalaoProcesso(t.no, processoDaArvore(arv), deps());
    focaveis()[1]!.dispatchEvent(evento(t.doc, "focusout", { relatedTarget: focaveis()[2] }));
    focaveis()[1]!.dispatchEvent(evento(t.doc, "focusout", { relatedTarget: null }));
    checar("foco que anda dentro do balao (ou some com o redesenho): segue aberto", balaoAberto() === b);
    focaveis()[1]!.dispatchEvent(evento(t.doc, "focusout", { relatedTarget: t.doc.querySelector("#divConsultarAndamento a") }));
    checar("foco que sai para a pagina: fecha", !balaoAberto() && foco.focados.at(-1) === t.no);

    secao("baloes (notas da T7): Agora nao e neutro, e o que ja nao pode gravar nao pede o Entendi");
    b = await abrirBalaoProcesso(t.no, processoDaArvore(arv), deps());
    escolher(b.raiz.querySelector("select[name='projeto']") as HTMLSelectElement, `unidade:${pu.id}`);
    (b.raiz.querySelector("input[name='nome']") as HTMLInputElement).value = "Digitada";
    botao(b.raiz, "Adicionar")!.click();
    await tique(20);
    checar("Toda a unidade: o aviso no balao", !!b.raiz.querySelector(".pb-pergunta"));
    botao(b.raiz, "Agora não")!.click();
    await tique(20);
    const nota = b.raiz.querySelector<HTMLElement>(".pb-form > .pb-nota");
    checar(
      "Agora nao: a frase neutra (status, sem o alerta vermelho), nada gravado, o que foi digitado fica",
      nota?.textContent === MENSAGEM_AGORA_NAO &&
        nota.getAttribute("role") === "status" &&
        !(b.raiz.querySelector(".pb-form > .pb-erro")?.textContent ?? "") &&
        (b.raiz.querySelector("input[name='nome']") as HTMLInputElement).value === "Digitada" &&
        !(await cru.unidade.dados()).etapas.some((e) => e.nome === "Digitada"),
      nota?.textContent,
    );
    checar(
      "a frase e a do balao (sem o Só eu, que o balao nao tem)",
      MENSAGEM_AGORA_NAO === "Nada foi gravado: os projetos de “Toda a unidade” só mudam depois do “Entendi”.",
    );
    botao(b.raiz, "Adicionar")!.click();
    await tique(10);
    checar("de novo: o aviso volta e a frase anterior sai", !!b.raiz.querySelector(".pb-pergunta") && !(nota?.textContent ?? ""));
    botao(b.raiz, "Agora não")!.click();
    await tique(10);
    // A etapa foi concluída por outra tela depois de o formulário abrir: a mensagem, sem perguntar o "Entendi".
    botao(b.raiz.querySelector<HTMLElement>(`.pb-vinc[data-projeto='${pu.id}']`)!, "Concluir com documento…")!.click();
    await cru.unidade.concluirEtapa(a1.id, "2026-10-02");
    botao(b.raiz, "Concluir")!.click();
    await tique(20);
    checar(
      "concluida por outra tela: a mensagem, sem o aviso do Entendi, e a data fica",
      !b.raiz.querySelector(".pb-pergunta") &&
        (b.raiz.querySelector(".pb-vinc .pb-erro")?.textContent ?? "").includes("já foi concluída") &&
        (await consentimento.estado()) === "nao-perguntado" &&
        (await cru.unidade.obterEtapa(a1.id))?.concluidaEm === "2026-10-02",
    );
    b.fechar();
    let perguntas = 0;
    const comPergunta = {
      unidade: comConsentimento(cru.unidade, async () => {
        perguntas++;
        return false;
      }),
      eu: cru.eu,
    };
    const aberta = (await cru.unidade.dados()).etapas.find((e) => e.id !== a1.id)!.id;
    const docRuim = await lanca(() => concluirComDocumento(comPergunta, "unidade", aberta, { numero: "12a" }, HOJE));
    const jaConcluida = await lanca(() => concluirComDocumento(comPergunta, "unidade", a1.id, undefined, HOJE));
    checar(
      "documento fora da regra ou etapa ja concluida: a mensagem antes de perguntar",
      docRuim instanceof ErroValidacao && jaConcluida instanceof ErroValidacao && perguntas === 0,
      { docRuim: docRuim?.message, jaConcluida: jaConcluida?.message, perguntas },
    );
    const valido = await lanca(() => concluirComDocumento(comPergunta, "unidade", aberta, { numero: "0103991" }, HOJE));
    checar("valido: ai sim pergunta", valido instanceof ErroValidacao && perguntas === 1);

    secao("baloes (notas da T7): Processo do projeto quando ja e este processo");
    b = await abrirBalaoProcesso(t.no, processoDaArvore(arv), deps());
    escolher(b.raiz.querySelector("select[name='projeto']") as HTMLSelectElement, `unidade:${pu.id}`);
    botao(b.raiz, "Processo do projeto")!.click();
    const antesDoProjeto = await cru.unidade.obterProjeto(pu.id);
    botao(b.raiz, "Adicionar")!.click();
    await tique(30);
    checar(
      "nao regrava nem pergunta o Entendi, e diz que ja e",
      !b.raiz.querySelector(".pb-pergunta") &&
        (b.raiz.querySelector(".pb-ok")?.textContent ?? "") === "Este já é o processo do projeto." &&
        (await cru.unidade.obterProjeto(pu.id))?.atualizadoEm === antesDoProjeto?.atualizadoEm &&
        (await consentimento.estado()) === "nao-perguntado",
      b.raiz.querySelector(".pb-ok")?.textContent,
    );
    b.fechar();
  } finally {
    foco.restaurar();
  }
}

function verificarLigacao(): void {
  secao("arvore: a ligacao no content script (carregador e principal.ts)");
  const pasta = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "pagina");
  const codigo = readFileSync(join(pasta, "principal.ts"), "utf8");
  // T11: quem decide é o carregador (main.ts + carregador.ts, provados em verificar-carregador.ts): nos frames, só o
  // da árvore importa o pacote, e ele chama a principalArvore.
  const carregador = readFileSync(join(pasta, "carregador.ts"), "utf8");
  checar(
    "nos frames, so o da arvore segue: o carregador chama a principalArvore",
    /if \(!o\.topo\) return qualTela\(o\.doc\) === "arvore" \? "arvore" : null;/.test(carregador) &&
      /carga === "arvore" \? pacote\.principalArvore\(\) : pacote\.principalTopo\(\)/.test(carregador),
  );
  checar(
    "o contexto da arvore vem do cabecalho da janela de topo",
    /contextoProjetos\(topo, \{[^}]*\}, topo\.location\?\.href\)/.test(codigo) && /const topo = documentoTopo\(\);/.test(codigo),
  );
  checar(
    "Abrir no painel na arvore: o lateral direto do clique (sem await antes do pedido ao background)",
    /abrirNoPainel: \(id, etapa\) => abrirLateral\(\{ ctx, area \}, id, etapa\)/.test(codigo) &&
      /abrir: \(\) => chrome\.runtime\.sendMessage\(\{ tipo: "abrirPainel", aba: "projetos" \}\)/.test(codigo),
  );
}

async function verificarIconeAlterna(): Promise<void> {
  secao("arvore: o icone (ou a faixa) com o balao aberto fecha, mesmo com o foco saindo do balao para ele");
  const t = tela("ifrConteudoVisualizacao");
  const r = await repos();
  const p = await r.unidade.criarProjeto({ nome: "Revisão", processo: { protocolo: CAU } });
  await r.unidade.criarEtapa({ projeto: p.id, nome: "Minuta", inicio: "2026-09-01", fim: "2026-10-01" });
  const consentimento = consentimentoNaArea({
    area: areaMemoria(),
    chavePreferencias: "projetos/consentimento",
    campo: "textoPadrao",
    chave: "k",
  });
  const inst = await instalarNaArvore({
    doc: t.doc,
    url: URL_ARVORE,
    repos: r,
    hoje: () => HOJE,
    temaEscuro: false,
    esperarMs: 50,
    atraso: 1,
    abrir: (ancora, processo, documentos) =>
      void abrirBalaoProcesso(ancora, processo, {
        modo: "arvore",
        repos: r,
        hoje: () => HOJE,
        sigla: "TESTE",
        temaEscuro: false,
        cssBase: "",
        consentimento,
        documentos,
        abrirNoPainel: () => undefined,
      }),
  });
  const ic = t.doc.querySelector<HTMLElement>("#topmenu .spro-prj-ic")!;
  const faixa = t.doc.querySelector<HTMLElement>(".spro-prj-faixa")!;
  /** O clique do usuário na âncora com o foco dentro do balão: pointerdown, o foco sai para a âncora, click. */
  const clicarComFocoDentro = async (alvo: HTMLElement) => {
    alvo.dispatchEvent(evento(t.doc, "pointerdown", {}));
    const dentro = balaoAberto()?.raiz.querySelector<HTMLElement>("button");
    dentro?.dispatchEvent(evento(t.doc, "focusout", { relatedTarget: alvo }));
    const abertoAntesDoClique = balaoAberto();
    alvo.click();
    await tique(30);
    return abertoAntesDoClique;
  };
  ic.click();
  await tique(30);
  checar("abre", balaoAberto()?.ancora === ic && ic.getAttribute("aria-expanded") === "true");
  const antes = await clicarComFocoDentro(ic);
  checar(
    "o foco que sai do balao para o proprio icone nao fecha; o clique dele fecha (e nao reabre)",
    antes?.ancora === ic && balaoAberto() === null && ic.getAttribute("aria-expanded") === "false",
  );
  faixa.click();
  await tique(30);
  checar("a faixa abre", balaoAberto()?.ancora === faixa);
  await clicarComFocoDentro(faixa);
  checar("e a faixa fecha do mesmo jeito", balaoAberto() === null && faixa.getAttribute("aria-expanded") === "false");
  inst?.parar();
}

async function verificarLarguraUtil(): Promise<void> {
  secao("balao: a largura util da pagina (sem a barra de rolagem classica)");
  const t = tela("ifrConteudoVisualizacao");
  const r = await repos();
  const consentimento = consentimentoNaArea({
    area: areaMemoria(),
    chavePreferencias: "projetos/consentimento",
    campo: "textoPadrao",
    chave: "k",
  });
  // A janela tem 520 px, 20 da barra de rolagem: sobram 500 para a página.
  Object.defineProperty(t.doc.defaultView!, "innerWidth", { value: 520, configurable: true });
  Object.defineProperty(t.doc.documentElement, "clientWidth", { value: 500, configurable: true });
  t.no.getBoundingClientRect = () => ({
    left: 400,
    right: 420,
    top: 10,
    bottom: 30,
    width: 20,
    height: 20,
    x: 400,
    y: 10,
    toJSON: () => ({}),
  });
  const arv = lerArvore(paginaDe(t.doc, URL_ARVORE));
  const b = await abrirBalaoProcesso(t.no, processoDaArvore(arv), {
    modo: "arvore",
    repos: r,
    hoje: () => HOJE,
    sigla: "TESTE",
    temaEscuro: false,
    cssBase: "",
    consentimento,
    documentos: () => [],
    abrirNoPainel: () => undefined,
  });
  const estilo = t.doc.querySelector(".spro-prj-balao")?.getAttribute("style") ?? "";
  const css = b.raiz.querySelector("style")?.textContent ?? "";
  checar(
    "o balao cabe nos 500 px da pagina (e nao nos 520 da janela, atras da barra)",
    /left:152px/.test(estilo) && /--pb-max:484px/.test(estilo),
    estilo,
  );
  checar("a largura maxima vem da pagina, nao de 100vw", css.includes("max-width:var(--pb-max") && !css.includes("100vw"));
  b.fechar();
  // Frame estreito (a árvore): 300 px úteis, o balão encolhe para 284 e encosta na margem.
  Object.defineProperty(t.doc.documentElement, "clientWidth", { value: 300, configurable: true });
  const estreito = await abrirBalaoProcesso(t.no, processoDaArvore(arv), {
    modo: "arvore",
    repos: r,
    hoje: () => HOJE,
    sigla: "TESTE",
    temaEscuro: false,
    cssBase: "",
    consentimento,
    documentos: () => [],
    abrirNoPainel: () => undefined,
  });
  const estiloEstreito = t.doc.querySelector(".spro-prj-balao")?.getAttribute("style") ?? "";
  checar(
    "frame estreito: o balao encolhe e encosta na margem",
    /left:8px/.test(estiloEstreito) && /--pb-max:284px/.test(estiloEstreito),
    estiloEstreito,
  );
  estreito.fechar();
}

export async function verificarArvore(): Promise<void> {
  verificarLigacao();
  await verificarLeitura();
  await verificarIconeEFaixa();
  await verificarUrgentes();
  await verificarSei5();
  await verificarSigilo();
  await verificarBalaoArvore();
  await verificarRevisaoT7();
  await verificarIconeAlterna();
  await verificarLarguraUtil();
  checar("nenhuma arvore das provas entrou em laco de recolocacao do icone", lacos.length === 0, lacos);
}
