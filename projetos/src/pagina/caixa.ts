/**
 * Ícone dos projetos na caixa do Controle de Processos (spec 3.3 e 7): só em
 * processo ligado a projeto (processo do projeto ou de alguma etapa), na
 * coluna dos ícones, logo depois da estrela dos Favoritos; ponto vermelho com
 * etapa ligada atrasada. O clique é delegado ao documento (o clone também abre
 * o balão; o mesmo ícone, com o balão aberto, fecha). Nenhuma requisição ao SEI.
 *
 * Duas fontes de trabalho, com custos diferentes:
 * - o storage mudou (`aoMudar` dos dois escopos): relê o índice e repinta;
 * - a tela mudou (paginação do legado acrescenta linhas, ou as clona para outra
 *   tabela ao agrupar; a célula dos ícones é redesenhada): só repinta, com o
 *   índice que já tem (sem ler o storage). Repintar não duplica: um ícone por
 *   linha, que volta se sumiu e sai quando o vínculo sai.
 * O que a própria pintura muda na tela não volta como trabalho: os registros do
 * observador que ela causou são descartados (`takeRecords`) e, por garantia,
 * só a inserção de linha ou célula de fora conta (atributo e o próprio ícone
 * inserido, não). Várias mudanças seguidas viram uma pintura (uma por `atraso`).
 *
 * Sigilo da linha: todo processo que a caixa mostra como sigiloso vai a
 * `marcarSigilosos` nos dois escopos, uma vez por carga cada número: os que uma
 * pintura vê pela primeira vez vão juntos, num pedido por escopo (uma leitura
 * do escopo para todos), e os pedidos vão um de cada vez. Marca os vínculos e
 * lembra o número que só ficou no histórico (o número não vai ao Texto Padrão).
 * A memória do sigilo ilegível (`ErroMemoriaSigilo`) só vai ao console: a caixa
 * segue.
 */

import { icone } from "@comum/ui/dom";
import { lerLinhaCaixa } from "@nucleo/dominio/caixa";
import { dataNaFaixa } from "../modelo/calendario";
import type { DataISO, Vis } from "../modelo/tipos";
import { chaveProtocolo, RE_ID_PROCEDIMENTO, type VinculoProcesso } from "../modelo/vinculos";
import { indiceDosEscopos, type RepositorioProjetos } from "../repositorio";
import { balaoAberto } from "./balaoAtual";
import type { ProcessoNaTela } from "./conteudo";
import { instalarEstiloNaPagina } from "./estilo";

/** Qualquer linha de processo da caixa, inclusive as que o legado clona para outras tabelas ao agrupar. */
const LINHAS = "tr[id^='P']";
const ICONE = "spro-prj-ic";

export interface DepsCaixa {
  doc: Document;
  repos: Readonly<Record<Vis, RepositorioProjetos>>;
  hoje(): DataISO;
  temaEscuro: boolean;
  /** O balão do processo (montado pelo main, que tem as ações). */
  abrir(ancora: HTMLElement, processo: ProcessoNaTela): void;
  /** Espera antes de refazer (mudanças seguidas viram uma). Padrão: 80 ms. */
  atraso?: number;
}

export function processoDaLinha(tr: Element): ProcessoNaTela | null {
  const l = lerLinhaCaixa(tr, tr.closest("#tblProcessosGerados") ? "gerados" : "recebidos");
  const protocolo = l?.protocolo.trim() ?? "";
  if (!l || !chaveProtocolo(protocolo)) return null;
  const p: ProcessoNaTela = { protocolo, sigiloso: l.sigiloso };
  if (RE_ID_PROCEDIMENTO.test(l.idProcedimento)) p.idProcedimento = l.idProcedimento;
  if (l.tipo) p.tipo = l.tipo;
  if (l.especificacao) p.especificacao = l.especificacao;
  return p;
}

/** Título e marcas do ícone; só o que mudou (os filhos não mudam: o observador da caixa não pode se ver mudando). */
export function pintarIcone(b: HTMLElement, vinculos: readonly VinculoProcesso[], hoje: DataISO, temaEscuro: boolean): void {
  const n = new Set(vinculos.map((v) => `${v.vis}:${v.projeto.id}`)).size;
  const atraso = vinculos.some((v) => v.etapas.some((e) => !e.concluidaEm && dataNaFaixa(e.fim) && e.fim < hoje));
  const rotulo = `Em ${n} ${n === 1 ? "projeto" : "projetos"}${atraso ? " · com etapa atrasada" : ""}`;
  if (b.hasAttribute("data-atraso") !== atraso) b.toggleAttribute("data-atraso", atraso);
  if (b.classList.contains("spro-prj-escuro") !== temaEscuro) b.classList.toggle("spro-prj-escuro", temaEscuro);
  if (b.getAttribute("aria-label") !== rotulo) {
    b.setAttribute("aria-label", rotulo);
    b.title = rotulo;
  }
}

function criarIcone(doc: Document): HTMLButtonElement {
  const b = doc.createElement("button");
  b.type = "button";
  b.className = ICONE;
  b.setAttribute("data-spro-caixa", "");
  b.setAttribute("aria-haspopup", "dialog");
  b.setAttribute("aria-expanded", "false");
  b.append(icone("gantt", 18));
  return b;
}

/** Depois da estrela dos Favoritos, na coluna dos ícones (a 2ª célula); sem estrela, no começo dela. */
function colocar(tr: Element, b: HTMLElement): boolean {
  const td = tr.querySelectorAll("td")[1];
  if (!td) return false;
  const estrela = td.querySelector(".spro-fav-estrela");
  if (estrela) estrela.after(b);
  else td.prepend(b);
  return true;
}

const ehIcone = (n: Node): boolean => n.nodeType === 1 && (n as Element).classList.contains(ICONE);

/** O registro do observador que pede pintura: linha ou célula acrescentada (fora o ícone) ou qualquer nó tirado. */
const pedePintura = (r: MutationRecord): boolean =>
  r.type === "childList" && (r.removedNodes.length > 0 || [...r.addedNodes].some((n) => !ehIcone(n)));

export function instalarIconesCaixa(d: DepsCaixa): { atualizar(): Promise<void>; parar(): void } {
  instalarEstiloNaPagina(d.doc);
  let indice = new Map<string, VinculoProcesso[]>();
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
          // Memória do sigilo ilegível (falha fechada: nada gravado). A caixa segue; a próxima carga tenta de novo.
          console.warn("[SEI Pro] projetos: sigilo da linha", e instanceof Error ? e.message : e);
        }
      }
    });
  };

  const Observador = d.doc.defaultView?.MutationObserver;
  const pintar = () => {
    if (parado) return;
    const hoje = d.hoje();
    const sigilosos: string[] = [];
    for (const tr of d.doc.querySelectorAll(LINHAS)) {
      const p = processoDaLinha(tr);
      if (p?.sigiloso) sigilosos.push(p.protocolo);
      const existentes = [...tr.querySelectorAll<HTMLElement>(`.${ICONE}`)];
      const vinculos = p ? (indice.get(chaveProtocolo(p.protocolo)) ?? []) : [];
      if (!vinculos.length) {
        for (const x of existentes) x.remove();
        continue;
      }
      const [b, ...sobra] = existentes;
      for (const x of sobra) x.remove();
      if (b) pintarIcone(b, vinculos, hoje, d.temaEscuro);
      else {
        const novo = criarIcone(d.doc);
        pintarIcone(novo, vinculos, hoje, d.temaEscuro);
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
    const novo = await indiceDosEscopos([d.repos.unidade, d.repos.eu]);
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
        void atualizar().catch((e) => console.warn("[SEI Pro] projetos: ícones da caixa", e));
      } else pintar();
    }, d.atraso ?? 80);
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
    const b = alvo?.closest?.(`.${ICONE}[data-spro-caixa]`) as HTMLElement | null;
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
