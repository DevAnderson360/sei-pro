/**
 * O ícone das demandas na grade do Controle de Processos (D18): em cada linha cujo processo tenha ao menos uma demanda
 * relacionada (não arquivada, nos dois escopos da unidade), na coluna dos ícones, depois do ícone dos Projetos (ou da
 * estrela dos Favoritos). O clique abre o balão "Demandas deste processo" da D17 (o menu suspenso, ancorado ao ícone);
 * o mesmo ícone, com o balão aberto, o fecha. Nenhuma requisição ao SEI: só a lista que a página JÁ desenhou
 * (`lerLinhaCaixa`) e o storage local. Molde: `projetos/src/pagina/caixa.ts`.
 *
 * Duas fontes de trabalho, com custos diferentes:
 * - o storage mudou (`aoMudar` dos dois escopos): relê o índice (protocolo -> demandas) e repinta;
 * - a tela mudou (paginação, filtro, "Ver todos", clone do legado ao agrupar, célula redesenhada): só repinta, com o
 *   índice que já tem. Repintar não duplica: um ícone por linha. O que a própria pintura muda não volta como trabalho
 *   (`takeRecords` e o filtro dos registros de dentro do ícone). Várias mudanças seguidas viram uma pintura.
 *
 * Sigilo da linha: todo processo que a grade mostra como sigiloso vai a `marcarSigilosos` nos dois escopos, uma vez por
 * carga cada número (os novos de uma pintura, num pedido por escopo). O vínculo local guarda o número e por isso casa
 * normalmente; o ícone e o balão nunca levam a especificação da linha.
 */

import { lerLinhaCaixa } from "@nucleo/dominio/caixa";
import { chaveProtocolo, RE_ID_PROCEDIMENTO } from "@projetos/modelo/vinculos";
import { balaoAberto } from "@projetos/pagina/balaoAtual";
import { carregarDados, type DemandaNaTela } from "../app/dados";
import type { DataISO, Vis } from "../modelo/tipos";
import type { RepositorioDemandas } from "../repositorio";
import type { ProcessoNaTela } from "./deteccao";
import { instalarEstiloNaPagina } from "./estilo";
import { iconeColoridoDemandas } from "./icone";
import { qualTela } from "./tela";

/** Qualquer linha de processo da grade, inclusive as que o legado clona para outras tabelas ao agrupar. */
const LINHAS = "tr[id^='P']";
export const ICONE_CAIXA = "spro-dem-cx";
const TAMANHO = 20;

export type IndiceDemandas = ReadonlyMap<string, readonly DemandaNaTela[]>;

export interface DepsCaixa {
  doc: Document;
  repos: Readonly<Record<Vis, RepositorioDemandas>>;
  hoje(): DataISO;
  /** O balão do processo (montado pelo principal, que tem as ações). */
  abrir(ancora: HTMLElement, processo: ProcessoNaTela): void;
  /** Espera antes de refazer (mudanças seguidas viram uma). Padrão: 16 ms, um quadro. */
  atraso?: number;
}

/**
 * Protocolo (só dígitos) -> demandas que o citam. Só as vivas e não arquivadas (a mesma regra do balão e do botão da
 * barra: arquivada não conta); uma demanda com o mesmo processo citado duas vezes conta uma vez.
 */
export function indiceDeDemandas(lista: readonly DemandaNaTela[]): Map<string, DemandaNaTela[]> {
  const indice = new Map<string, DemandaNaTela[]>();
  for (const x of lista) {
    if (x.situacao === "arquivada") continue;
    for (const k of new Set(x.demanda.processos.filter((p) => !!p.protocolo).map((p) => chaveProtocolo(p.protocolo ?? "")))) {
      if (!k) continue;
      const ja = indice.get(k);
      if (ja) ja.push(x);
      else indice.set(k, [x]);
    }
  }
  return indice;
}

/** O índice dos dois escopos, numa leitura de cada. */
export async function indiceDosEscopos(
  repos: Readonly<Record<Vis, RepositorioDemandas>>,
  hoje: DataISO,
): Promise<Map<string, DemandaNaTela[]>> {
  return indiceDeDemandas(await carregarDados(repos, hoje));
}

/** O processo da linha, como o balão o recebe (sem a especificação: o balão não a usa e a do sigiloso nunca sai). */
export function processoDaLinha(tr: Element): ProcessoNaTela | null {
  const l = lerLinhaCaixa(tr, tr.closest("#tblProcessosGerados") ? "gerados" : "recebidos");
  const protocolo = l?.protocolo.trim() ?? "";
  if (!l || !chaveProtocolo(protocolo)) return null;
  const p: ProcessoNaTela = { protocolo, sigiloso: l.sigiloso };
  if (RE_ID_PROCEDIMENTO.test(l.idProcedimento)) p.idProcedimento = l.idProcedimento;
  if (l.tipo) p.tipo = l.tipo;
  return p;
}

export const rotuloDoIcone = (n: number): string => `${n} ${n === 1 ? "demanda" : "demandas"} neste processo`;

/** Rótulo e selo de contagem; só o que mudou (o observador da grade não pode se ver mudando). */
export function pintarIcone(b: HTMLElement, n: number): void {
  const rotulo = rotuloDoIcone(n);
  if (b.getAttribute("aria-label") !== rotulo) {
    b.setAttribute("aria-label", rotulo);
    b.title = rotulo;
  }
  const selo = b.querySelector<HTMLElement>(`.${ICONE_CAIXA}-n`);
  if (!selo) return;
  const texto = n >= 2 ? (n > 9 ? "9+" : String(n)) : "";
  if (selo.textContent !== texto) selo.textContent = texto;
  if (selo.hidden !== !texto) selo.hidden = !texto;
}

function criarIcone(doc: Document): HTMLButtonElement {
  const b = doc.createElement("button");
  b.type = "button";
  b.className = ICONE_CAIXA;
  b.setAttribute("data-spro-dem-caixa", "");
  b.setAttribute("aria-haspopup", "dialog");
  b.setAttribute("aria-expanded", "false");
  b.append(iconeColoridoDemandas(doc, TAMANHO));
  const selo = doc.createElement("span");
  selo.className = `${ICONE_CAIXA}-n`;
  selo.hidden = true;
  selo.setAttribute("aria-hidden", "true");
  b.append(selo);
  return b;
}

/** Depois do ícone dos Projetos, ou da estrela dos Favoritos, na coluna dos ícones (a 2ª célula); sem eles, no começo. */
function colocar(tr: Element, b: HTMLElement): boolean {
  const td = tr.querySelectorAll("td")[1];
  if (!td) return false;
  const antes = td.querySelector(".spro-prj-ic") ?? td.querySelector(".spro-fav-estrela");
  if (antes) antes.after(b);
  else td.prepend(b);
  return true;
}

const ehIcone = (n: Node): boolean => n.nodeType === 1 && (n as Element).classList.contains(ICONE_CAIXA);
const dentroDoIcone = (n: Node): boolean => (n.nodeType === 1 ? (n as Element) : n.parentElement)?.closest?.(`.${ICONE_CAIXA}`) != null;

/** O registro do observador que pede pintura: linha ou célula acrescentada (fora o ícone) ou nó tirado de fora do ícone. */
const pedePintura = (r: MutationRecord): boolean =>
  r.type === "childList" && !dentroDoIcone(r.target) && (r.removedNodes.length > 0 || [...r.addedNodes].some((n) => !ehIcone(n)));

export function instalarIconesCaixa(d: DepsCaixa): { atualizar(): Promise<void>; parar(): void } {
  // Só a tela "caixa" (o Controle de Processos); em qualquer outra, nada é instalado.
  if (qualTela(d.doc) !== "caixa") return { atualizar: async () => undefined, parar: () => undefined };
  instalarEstiloNaPagina(d.doc);
  let indice: IndiceDemandas = new Map();
  let parado = false;

  // O sigilo da linha: uma vez por carga cada número; os novos de uma pintura num pedido por escopo, um de cada vez.
  const marcados = new Set<string>();
  let fila: Promise<void> = Promise.resolve();
  const marcarSigilosos = (protocolos: readonly string[]) => {
    const novos: string[] = [];
    for (const p of protocolos) {
      const k = chaveProtocolo(p);
      if (!k || marcados.has(k)) continue;
      marcados.add(k);
      novos.push(p);
    }
    if (!novos.length) return;
    fila = fila.then(async () => {
      for (const r of [d.repos.unidade, d.repos.eu]) {
        if (parado) return;
        try {
          await r.marcarSigilosos(novos);
        } catch (e) {
          // Memória do sigilo ilegível (falha fechada: nada gravado). A grade segue; a próxima carga tenta de novo.
          console.warn("[SEI Pro] demandas: sigilo da linha", e instanceof Error ? e.message : e);
        }
      }
    });
  };

  const Observador = d.doc.defaultView?.MutationObserver;
  const pintar = () => {
    if (parado) return;
    const sigilosos: string[] = [];
    for (const tr of d.doc.querySelectorAll(LINHAS)) {
      const p = processoDaLinha(tr);
      if (p?.sigiloso) sigilosos.push(p.protocolo);
      const existentes = [...tr.querySelectorAll<HTMLElement>(`.${ICONE_CAIXA}`)];
      const demandas = p ? (indice.get(chaveProtocolo(p.protocolo)) ?? []) : [];
      if (!demandas.length) {
        for (const x of existentes) x.remove();
        continue;
      }
      const [b, ...sobra] = existentes;
      for (const x of sobra) x.remove();
      if (b) pintarIcone(b, demandas.length);
      else {
        const novo = criarIcone(d.doc);
        pintarIcone(novo, demandas.length);
        colocar(tr, novo);
      }
    }
    marcarSigilosos(sigilosos);
    // O que esta pintura mudou não volta como trabalho (a tela já está como ela deixou).
    observador?.takeRecords?.();
  };

  let leitura = 0;
  const atualizar = async () => {
    const n = ++leitura;
    const novo = await indiceDosEscopos(d.repos, d.hoje());
    // Duas leituras ao mesmo tempo: vale a mais nova.
    if (parado || n !== leitura) return;
    indice = novo;
    pintar();
  };

  let agendado: ReturnType<typeof setTimeout> | null = null;
  let reler = false;
  const agendar = (comLeitura: boolean) => {
    if (parado) return;
    reler ||= comLeitura;
    if (agendado) return;
    agendado = setTimeout(() => {
      agendado = null;
      if (reler) {
        reler = false;
        void atualizar().catch((e) => console.warn("[SEI Pro] demandas: ícones da grade", e));
      } else pintar();
    }, d.atraso ?? 16);
  };

  // O da janela do documento (no navegador é o mesmo global; nas provas, o do linkedom).
  const observador = Observador
    ? new Observador((registros) => {
        if (registros.some(pedePintura)) agendar(false);
      })
    : null;
  const alvo = d.doc.querySelector("#frmProcedimentoControlar") ?? d.doc.body;
  if (observador && alvo) observador.observe(alvo, { childList: true, subtree: true });
  const paradas = Object.values(d.repos).map((r) => r.aoMudar(() => agendar(true)));

  // Captura no documento: o ícone responde antes de qualquer ouvinte da linha do SEI (e o clone também).
  const clique = (ev: Event) => {
    // composedPath: a grade nova do controle (Shadow DOM) clona o icone; o alvo retargetado seria o host.
    const alvo = (ev.composedPath?.()[0] ?? ev.target) as Element | null;
    const b = alvo?.closest?.(`.${ICONE_CAIXA}[data-spro-dem-caixa]`) as HTMLElement | null;
    if (!b) return;
    ev.preventDefault();
    ev.stopPropagation();
    const aberto = balaoAberto();
    if (aberto?.ancora === b) {
      aberto.fechar();
      return;
    }
    const tr = b.closest(LINHAS) ?? d.doc.getElementById(`P${b.getAttribute("data-spro-id") ?? ""}`);
    const p = tr ? processoDaLinha(tr) : null;
    if (p) d.abrir(b, p);
  };
  d.doc.addEventListener("click", clique, true);
  return {
    atualizar,
    parar() {
      parado = true;
      observador?.disconnect();
      for (const p of paradas) p();
      if (agendado) clearTimeout(agendado);
      agendado = null;
      d.doc.removeEventListener("click", clique, true);
    },
  };
}
