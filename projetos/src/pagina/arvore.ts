/**
 * A tela do processo (spec 3.3 e 7), no frame da árvore (SEI 4.1, com o
 * visualizador aninhado, e SEI 5): o ícone dos projetos junto ao número do
 * processo (sempre: é por ele que se adiciona o processo a um projeto;
 * realçado se o processo está num projeto; ponto vermelho com etapa
 * atrasada), a faixa sob o número só quando há etapa atrasada ou vencendo em
 * até 3 dias úteis (a mais urgente, com "(+N)" das outras) e o balão
 * "Projetos deste processo", que o main monta com as ações.
 *
 * Só se lê o que este frame JÁ tem: os dados do processo vêm dos literais
 * `Nos[]` que a árvore aberta trouxe (`lerArvore` sobre a própria página) e os
 * documentos do "Concluir com documento…", dos nós desenhados (inclusive os
 * das pastas que o usuário abriu depois) e desses literais. Nenhuma
 * requisição: buscar a árvore de um processo aberto na unidade grava "Processo
 * recebido" em nome do usuário.
 *
 * Sigilo: a árvore de nível sigiloso marca os vínculos dos dois escopos
 * (`marcarSigilosos`, uma vez por carga) ANTES de o ícone aparecer, para o
 * balão não abrir (nem gravar) com o vínculo ainda sem a marca.
 *
 * O SEI redesenha o topo por JavaScript (o nó do processo é refeito): um
 * observador do #topmenu e do lugar da faixa recoloca o que sumiu. Recolocar
 * só acontece com o ícone (ou a faixa) fora da página e o que a recolocação
 * mudou não volta como trabalho (`takeRecords`): sem laço. Pintar mexe só em
 * atributos do ícone e nos filhos da faixa, que o observador não vê.
 */

import { icone } from "@comum/ui/dom";
import { type Arvore, lerArvore } from "@nucleo/dominio/arvore";
import { paginaDe } from "@nucleo/sessao/pagina";
import { textoDaUrgencia, type Urgencia, urgenciaDaEtapa } from "../modelo/prazo";
import type { DataISO, Etapa, Vis } from "../modelo/tipos";
import { chaveProtocolo, RE_DOCUMENTO, RE_ID_PROCEDIMENTO, type VinculoProcesso } from "../modelo/vinculos";
import { indiceDosEscopos, type RepositorioProjetos } from "../repositorio";
import { balaoAberto } from "./balaoAtual";
import type { DocumentoDaArvore, ProcessoNaTela } from "./conteudo";
import { instalarEstiloNaPagina } from "./estilo";

/** O nó do processo no topo da árvore: o alvo é o visualizador (4.1: o de fora, aninhado; 5: o único). */
export const NO_DO_PROCESSO = '#topmenu a[target="ifrVisualizacao"], #topmenu a[target="ifrConteudoVisualizacao"]';

export function processoDaArvore(a: Arvore): ProcessoNaTela {
  const p: ProcessoNaTela = { protocolo: a.protocolo.trim(), sigiloso: a.nivel === "sigiloso" };
  if (RE_ID_PROCEDIMENTO.test(a.idProcedimento)) p.idProcedimento = a.idProcedimento;
  if (a.tipo) p.tipo = a.tipo;
  return p;
}

/** O rótulo do nó desenhado de um documento: "Nome (número)", com o número SEI entre parênteses no fim. */
const ROTULO_DOCUMENTO = /^(.*?)\s*\((\d{5,20})\)$/;

/** O nó desenhado com o ícone de documento cancelado (`#anchorImg<id> img`). */
function desenhadoCancelado(doc: Document, id: string): boolean {
  return /documento_cancelado/.test(doc.getElementById(`anchorImg${id}`)?.querySelector("img")?.getAttribute("src") ?? "");
}

/**
 * Os documentos da árvore aberta, o mais recente primeiro, sem os cancelados e com o número na regra de documento
 * (`RE_DOCUMENTO`): a ordem é a da árvore desenhada (as pastas mais antigas em cima: a que o usuário abriu depois da
 * carga não está nos literais e vai para o fim da lista), com o título dos literais quando eles o têm; os dos
 * literais que a árvore ainda não desenhou (são da pasta carregada, a mais nova) entram por último na ordem deles.
 */
export function documentosDaArvore(doc: Document, a: Arvore | null): DocumentoDaArvore[] {
  const cancelados = new Set<string>();
  const literais = new Map<string, DocumentoDaArvore>();
  for (const x of a?.documentos ?? []) {
    if (x.cancelado) cancelados.add(x.numero);
    else if (RE_DOCUMENTO.test(x.numero) && !literais.has(x.numero)) literais.set(x.numero, { numero: x.numero, titulo: x.titulo });
  }
  const saida = new Map<string, DocumentoDaArvore>();
  for (const no of doc.querySelectorAll("#divArvore a[id^='anchor']")) {
    const id = no.id.slice("anchor".length);
    if (!/^\d+$/.test(id) || id === a?.idProcedimento) continue;
    const m = ROTULO_DOCUMENTO.exec((no.textContent ?? "").replace(/\s+/g, " ").trim());
    const numero = m?.[2];
    if (!numero || saida.has(numero) || cancelados.has(numero) || desenhadoCancelado(doc, id)) continue;
    saida.set(numero, literais.get(numero) ?? { numero, titulo: (m[1] ?? "").trim() });
  }
  for (const [numero, d] of literais) if (!saida.has(numero)) saida.set(numero, d);
  return [...saida.values()].reverse();
}

export interface Urgente {
  etapa: Etapa;
  vinculo: VinculoProcesso;
  urgencia: Urgencia;
}

/** As etapas ligadas que pedem a faixa: as atrasadas (a de mais dias primeiro) e depois as que vencem logo. */
export function urgentesDoProcesso(vinculos: readonly VinculoProcesso[], hoje: DataISO): Urgente[] {
  const lista = vinculos.flatMap((v) =>
    v.etapas.flatMap((e) => {
      const u = urgenciaDaEtapa(e, hoje);
      return u ? [{ etapa: e, vinculo: v, urgencia: u }] : [];
    }),
  );
  const peso = (u: Urgencia) => (u.tipo === "atrasada" ? -1 - u.dias : u.dias);
  return lista.sort((x, y) => peso(x.urgencia) - peso(y.urgencia));
}

export interface DepsArvore {
  doc: Document;
  url: string;
  repos: Readonly<Record<Vis, RepositorioProjetos>>;
  hoje(): DataISO;
  temaEscuro: boolean;
  /** O balão do processo junto do que foi clicado (o ícone ou a faixa); os documentos são lidos a cada desenho. */
  abrir(ancora: HTMLElement, processo: ProcessoNaTela, documentos: () => DocumentoDaArvore[]): void;
  /** Quanto esperar o SEI desenhar o nó do processo (padrão: 10 s). */
  esperarMs?: number;
  /** Espera antes de reler (mudanças seguidas viram uma). Padrão: 80 ms. */
  atraso?: number;
}

function esperar<T>(achar: () => T | null | undefined, prazoMs: number, intervaloMs = 200): Promise<T | null> {
  const inicio = Date.now();
  return new Promise((ok) => {
    const tentar = () => {
      const v = achar();
      if (v) return ok(v);
      if (Date.now() - inicio >= prazoMs) return ok(null);
      setTimeout(tentar, Math.min(intervaloMs, Math.max(1, prazoMs)));
    };
    tentar();
  });
}

/** Um por documento (o mesmo content script injetado duas vezes, ou chamado de novo, não instala outro). */
const instalados = new WeakSet<Document>();

/**
 * Ícone, faixa e o que os mantém. null sem os literais da árvore, sem o nó do processo desenhado em `esperarMs` ou
 * já instalado neste documento.
 */
export async function instalarNaArvore(d: DepsArvore): Promise<{ atualizar(): Promise<void>; parar(): void } | null> {
  let arvore: Arvore;
  try {
    arvore = lerArvore(paginaDe(d.doc, d.url));
  } catch {
    return null;
  }
  const processo = processoDaArvore(arvore);
  const chave = chaveProtocolo(processo.protocolo);
  if (!chave || instalados.has(d.doc)) return null;
  const no = await esperar(() => d.doc.querySelector(NO_DO_PROCESSO), d.esperarMs ?? 10_000);
  if (!no || instalados.has(d.doc) || no.parentElement?.querySelector(".spro-prj-ic")) return null;
  instalados.add(d.doc);
  let parado = false;
  // O sigilo da árvore, uma vez por carga e antes do ícone: um escopo de cada vez (cada pedido lê o escopo).
  if (processo.sigiloso)
    for (const r of [d.repos.unidade, d.repos.eu]) {
      try {
        await r.marcarSigilosos([processo.protocolo]);
      } catch (e) {
        // Memória do sigilo ilegível (falha fechada: nada gravado). A árvore segue; a próxima carga tenta de novo.
        console.warn("[SEI Pro] projetos: sigilo da árvore", e instanceof Error ? e.message : e);
      }
    }
  instalarEstiloNaPagina(d.doc);
  const documentos = () => documentosDaArvore(d.doc, arvore);
  const abrir = (alvo: HTMLElement) => (ev: Event) => {
    ev.preventDefault();
    ev.stopPropagation();
    // O mesmo ícone (ou a faixa) com o balão dele aberto: fecha.
    const aberto = balaoAberto();
    if (aberto?.ancora === alvo) {
      aberto.fechar();
      return;
    }
    d.abrir(alvo, processo, documentos);
  };
  const botao = d.doc.createElement("button");
  botao.type = "button";
  botao.className = "spro-prj-ic";
  botao.setAttribute("aria-haspopup", "dialog");
  botao.setAttribute("aria-expanded", "false");
  botao.classList.toggle("spro-prj-escuro", d.temaEscuro);
  botao.append(icone("gantt", 18));
  botao.addEventListener("click", abrir(botao));
  const faixa = d.doc.createElement("button");
  faixa.type = "button";
  faixa.className = "spro-prj-faixa";
  faixa.hidden = true;
  faixa.title = "Projetos deste processo";
  faixa.setAttribute("aria-haspopup", "dialog");
  faixa.setAttribute("aria-expanded", "false");
  faixa.classList.toggle("spro-prj-escuro", d.temaEscuro);
  faixa.addEventListener("click", abrir(faixa));

  // O ícone depois do número e da estrela dos Favoritos (que fica colada ao número); a faixa logo antes dos nós.
  const colocar = () => {
    const n = d.doc.querySelector(NO_DO_PROCESSO);
    if (n && !botao.isConnected) {
      const prox = n.nextElementSibling;
      (prox?.classList.contains("spro-fav-estrela") ? prox : n).after(botao);
    }
    if (!faixa.isConnected) (d.doc.querySelector("#divArvore") ?? n?.parentElement)?.before(faixa);
  };

  const texto = (forte: string, resto: string): HTMLElement => {
    const s = d.doc.createElement("span");
    const b = d.doc.createElement("b");
    b.textContent = forte;
    s.append(b, resto);
    return s;
  };
  const pintar = (vinculos: readonly VinculoProcesso[]) => {
    const n = new Set(vinculos.map((v) => `${v.vis}:${v.projeto.id}`)).size;
    const urgentes = urgentesDoProcesso(vinculos, d.hoje());
    const atraso = urgentes.some((u) => u.urgencia.tipo === "atrasada");
    const rotulo = n
      ? `Projetos deste processo (em ${n} ${n === 1 ? "projeto" : "projetos"}${atraso ? " · com etapa atrasada" : ""})`
      : "Adicionar este processo a um projeto";
    if (botao.hasAttribute("data-ativo") !== n > 0) botao.toggleAttribute("data-ativo", n > 0);
    if (botao.hasAttribute("data-atraso") !== atraso) botao.toggleAttribute("data-atraso", atraso);
    if (botao.getAttribute("aria-label") !== rotulo) {
      botao.setAttribute("aria-label", rotulo);
      botao.title = rotulo;
    }
    const primeira = urgentes[0];
    faixa.hidden = !primeira;
    faixa.classList.toggle("spro-prj-vence", primeira?.urgencia.tipo === "vence");
    if (!primeira) {
      faixa.replaceChildren();
      return;
    }
    const resto = urgentes.length - 1;
    faixa.replaceChildren(
      icone(atraso ? "alerta" : "relogio", 14),
      texto(primeira.etapa.nome, ` ${textoDaUrgencia(primeira.urgencia)} · ${primeira.vinculo.projeto.nome}${resto ? ` (+${resto})` : ""}`),
    );
  };

  let leitura = 0;
  const atualizar = async () => {
    const n = ++leitura;
    const indice = await indiceDosEscopos([d.repos.unidade, d.repos.eu]);
    // Duas leituras ao mesmo tempo: vale a mais nova.
    if (parado || n !== leitura) return;
    pintar(indice.get(chave) ?? []);
  };
  let agendado: ReturnType<typeof setTimeout> | null = null;
  const agendar = () => {
    if (parado || agendado) return;
    agendado = setTimeout(() => {
      agendado = null;
      void atualizar().catch((e) => console.warn("[SEI Pro] projetos: ícone da árvore", e));
    }, d.atraso ?? 80);
  };

  const Observador = d.doc.defaultView?.MutationObserver;
  const observador = Observador
    ? new Observador(() => {
        if (parado || (botao.isConnected && faixa.isConnected)) return;
        colocar();
        // A própria recolocação não volta como trabalho.
        observador?.takeRecords?.();
      })
    : null;
  colocar();
  const topo = d.doc.querySelector("#topmenu");
  if (observador && topo) observador.observe(topo, { childList: true, subtree: true });
  // O lugar da faixa sem a subárvore: abrir uma pasta (os nós dentro de #divArvore) não acorda o observador.
  if (observador && faixa.parentElement) observador.observe(faixa.parentElement, { childList: true });
  const paradas = [d.repos.unidade, d.repos.eu].map((r) => r.aoMudar(agendar));
  await atualizar();
  return {
    atualizar,
    parar() {
      parado = true;
      observador?.disconnect();
      for (const p of paradas) p();
      if (agendado) clearTimeout(agendado);
      agendado = null;
      instalados.delete(d.doc);
    },
  };
}
