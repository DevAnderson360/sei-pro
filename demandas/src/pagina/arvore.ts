/**
 * O botão "Demandas" na barra de ações do processo (D17), `#divArvoreAcoes` do frame do visualizador (SEI 4.1: o
 * `ifrConteudoVisualizacao`, com o `ifrVisualizacao` aninhado; SEI 5: o visualizador único). É o mesmo lugar onde o
 * Gestor de Atividades legado põe os ícones dele (`getInsertIconAtividade`).
 *
 * Só se lê o que o frame vizinho (a árvore) JÁ desenhou: o processo e o documento aberto vêm de `detectarNaArvore`.
 * Nenhuma requisição: buscar a árvore de um processo aberto na unidade grava "Processo recebido" em nome do usuário.
 *
 * O SEI redesenha a barra por JavaScript (`innerHTML` das ações do nó, a cada documento que se seleciona) e leva o
 * botão junto: um observador da barra o recoloca quando some, e o que a recolocação mudou não volta como trabalho
 * (`takeRecords`): sem laço. O frame que recarrega ganha um content script novo, que instala de novo.
 *
 * Sigilo: a árvore de nível sigiloso marca as demandas dos dois escopos (`marcarSigilosos`, uma vez por carga) ANTES do
 * botão aparecer, para o balão não abrir (nem gravar) com o vínculo ainda sem a marca.
 */

import { chaveProtocolo } from "@projetos/modelo/vinculos";
import { balaoAberto } from "@projetos/pagina/balaoAtual";
import { carregarDados } from "../app/dados";
import type { DataISO, Vis } from "../modelo/tipos";
import type { RepositorioDemandas } from "../repositorio";
import { type Detectado, detectarNaArvore } from "./deteccao";
import { instalarEstiloNaPagina } from "./estilo";
import { iconeColoridoDemandas } from "./icone";

export const BARRA = "#divArvoreAcoes";
const CLASSE = "spro-dem-ic";
export const ROTULO_BOTAO = "Demandas deste processo";

export interface DepsBarra {
  doc: Document;
  repos: Readonly<Record<Vis, RepositorioDemandas>>;
  hoje(): DataISO;
  /** O documento da árvore (o frame vizinho) já desenhado, ou null enquanto não chegou. */
  docArvore(): { doc: Document; url: string } | null;
  /** As URLs do visualizador (este frame e os aninhados): o `id_documento` quando nenhum nó está selecionado. */
  urls(): string[];
  /** O balão junto do botão, com o que a tela mostra NESTE clique (o documento selecionado muda). */
  abrir(ancora: HTMLElement, detectar: () => Detectado | null): void;
  /** Quanto esperar o SEI desenhar a barra e a árvore (padrão: 10 s). */
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

/** Botão e o que o mantém. null sem a barra, sem a árvore desenhada em `esperarMs` ou já instalado neste documento. */
export async function instalarNaBarra(d: DepsBarra): Promise<{ atualizar(): Promise<void>; parar(): void } | null> {
  if (instalados.has(d.doc)) return null;
  const detectar = (): Detectado | null => {
    const a = d.docArvore();
    return a ? detectarNaArvore(a.doc, a.url, d.urls()) : null;
  };
  const prazo = d.esperarMs ?? 10_000;
  const primeiro = await esperar(() => (d.doc.querySelector(BARRA) ? detectar() : null), prazo);
  if (!primeiro || instalados.has(d.doc) || d.doc.querySelector(`${BARRA} .${CLASSE}`)) return null;
  instalados.add(d.doc);
  const { processo } = primeiro;
  const chave = chaveProtocolo(processo.protocolo);
  let parado = false;
  // O sigilo da árvore, uma vez por carga e antes do botão: um escopo de cada vez.
  if (processo.sigiloso)
    for (const r of [d.repos.unidade, d.repos.eu]) {
      try {
        await r.marcarSigilosos([processo.protocolo]);
      } catch (e) {
        // Memória do sigilo ilegível (falha fechada: nada gravado). A barra segue; a próxima carga tenta de novo.
        console.warn("[SEI Pro] demandas: sigilo da árvore", e instanceof Error ? e.message : e);
      }
    }
  instalarEstiloNaPagina(d.doc);

  const botao = d.doc.createElement("a");
  botao.className = `botaoSEI ${CLASSE}`;
  botao.setAttribute("role", "button");
  botao.setAttribute("href", "#");
  botao.setAttribute("tabindex", "451");
  botao.setAttribute("aria-haspopup", "dialog");
  botao.setAttribute("aria-expanded", "false");
  botao.setAttribute("aria-label", ROTULO_BOTAO);
  botao.title = "Demandas";
  // O invólucro tem o tamanho do SVG (40 px) e a margem dos ícones vizinhos (3 px); o selo se põe sobre ele sem mudar a caixa.
  const env = d.doc.createElement("span");
  env.className = "spro-dem-env";
  env.append(iconeColoridoDemandas(d.doc, 40));
  const selo = d.doc.createElement("span");
  selo.className = "spro-dem-selo";
  selo.hidden = true;
  selo.setAttribute("aria-hidden", "true");
  env.append(selo);
  botao.append(env);
  botao.addEventListener("click", (ev) => {
    ev.preventDefault();
    ev.stopPropagation();
    // O mesmo botão com o balão dele aberto: fecha.
    const aberto = balaoAberto();
    if (aberto?.ancora === botao) {
      aberto.fechar();
      return;
    }
    d.abrir(botao, detectar);
  });
  botao.addEventListener("keydown", (ev) => {
    if (ev.key === " " || ev.key === "Enter") {
      ev.preventDefault();
      botao.click();
    }
  });

  const colocar = () => {
    const barra = d.doc.querySelector(BARRA);
    if (!barra || botao.isConnected) return;
    barra.append(botao);
  };

  const pintar = (ativas: number, atrasadas: number) => {
    const rotulo = ativas
      ? `${ROTULO_BOTAO} (${ativas} ${ativas === 1 ? "demanda" : "demandas"}${atrasadas ? " · com prazo vencido" : ""})`
      : "Nova demanda deste processo";
    const texto = ativas > 9 ? "9+" : String(ativas);
    if (selo.textContent !== (ativas ? texto : "")) selo.textContent = ativas ? texto : "";
    selo.hidden = !ativas;
    if (botao.hasAttribute("data-ativo") !== ativas > 0) botao.toggleAttribute("data-ativo", ativas > 0);
    if (botao.hasAttribute("data-atraso") !== atrasadas > 0) botao.toggleAttribute("data-atraso", atrasadas > 0);
    if (botao.getAttribute("aria-label") !== rotulo) {
      botao.setAttribute("aria-label", rotulo);
      botao.title = rotulo;
    }
  };

  let leitura = 0;
  const atualizar = async () => {
    const n = ++leitura;
    const todas = await carregarDados(d.repos, d.hoje());
    // Duas leituras ao mesmo tempo: vale a mais nova.
    if (parado || n !== leitura) return;
    const doProcesso = todas.filter(
      (x) => x.situacao !== "arquivada" && x.demanda.processos.some((p) => !!p.protocolo && chaveProtocolo(p.protocolo) === chave),
    );
    pintar(doProcesso.length, doProcesso.filter((x) => x.prazo === "atrasada").length);
  };
  let agendado: ReturnType<typeof setTimeout> | null = null;
  const agendar = () => {
    if (parado || agendado) return;
    agendado = setTimeout(() => {
      agendado = null;
      void atualizar().catch((e) => console.warn("[SEI Pro] demandas: botao da barra", e));
    }, d.atraso ?? 80);
  };

  const Observador = d.doc.defaultView?.MutationObserver;
  const observador = Observador
    ? new Observador(() => {
        if (parado || botao.isConnected) return;
        colocar();
        // A própria recolocação não volta como trabalho.
        observador?.takeRecords?.();
      })
    : null;
  colocar();
  const barra = d.doc.querySelector(BARRA);
  if (observador && barra) observador.observe(barra, { childList: true });
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
