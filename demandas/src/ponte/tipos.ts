/**
 * O que atravessa a ponte entre a aba do SEI (content script) e o app do painel (página da extensão). Sem DOM e sem
 * `@nucleo`: o app importa daqui sem puxar o núcleo do SEI para o pacote dele.
 */

import type { ContextoDemandas } from "../app/tipos";

export type { ContextoDemandas };

/** Nome da porta `chrome.runtime.connect` do painel embutido. */
export const CANAL_DEMANDAS = "seipro-demandas";

/** Porta do painel lateral: a aba do SEI conecta quando o lateral anuncia que abriu (`demandas/lateralAberto`). */
export const CANAL_LATERAL = "seipro-demandas-lateral";

/** Pílula de alerta do título do painel. */
export type TipoAlerta = "atrasadas" | "semana";

/**
 * Chave de roteamento da aba no painel lateral: host|login|u:<id da unidade>. Trocar de unidade (ou de usuário, ou de
 * SEI) troca a chave, e o lateral remonta com as demandas da unidade nova (nunca grava na antiga). Sem unidade, vazia:
 * o lateral não monta, e a aba recusa qualquer pedido de sincronia.
 */
export function chaveDaAba(ctx: Pick<ContextoDemandas, "host" | "login" | "unidade">): string {
  return ctx.unidade ? `${ctx.host}|${ctx.login.trim().toLowerCase()}|u:${ctx.unidade.id}` : "";
}

/**
 * "Abrir no painel" pedido de uma tela que não é a do painel: o lateral leva a aba ao Controle de Processos (onde o
 * painel monta e abre a demanda). O pedido fica no `chrome.storage.local` por pouco tempo e vale só para a mesma chave
 * da aba (mesmo SEI, usuário e unidade), uma vez.
 */
export const CHAVE_FOCO = "demandas/foco";
/** O pedido vale 1 minuto a partir de quando foi feito (`ate` = quando + isto). */
export const VALIDADE_FOCO = 60_000;

export interface PedidoDeFoco {
  chave: string;
  demanda: string;
  /** Até quando vale (ms). */
  ate: number;
}

/** Id de demanda: texto curto. */
export const idDeFocoValido = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

/**
 * O pedido guardado, se é desta chave e ainda vale; senão null. O valor vem do storage (qualquer página da extensão
 * ou content script grava ali): a forma é conferida campo a campo e só os campos conhecidos saem daqui. Prazo além de
 * 1 minuto à frente (relógio torto ou valor forjado) não vale: o pedido não pode ficar esperando para sempre.
 */
export function lerPedidoDeFoco(v: unknown, chave: string, agora: number): PedidoDeFoco | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const p = v as Partial<Record<keyof PedidoDeFoco, unknown>>;
  if (!chave || p.chave !== chave || !idDeFocoValido(p.demanda)) return null;
  if (typeof p.ate !== "number" || !Number.isFinite(p.ate) || p.ate < agora || p.ate > agora + VALIDADE_FOCO) return null;
  return { chave, demanda: p.demanda, ate: p.ate };
}
