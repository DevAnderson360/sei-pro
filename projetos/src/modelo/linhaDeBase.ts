/**
 * Linha de base = plano original (spec 5.4). Nasce com as datas da etapa.
 * Enquanto a etapa não começou (início ANTES da mudança e início da base,
 * os dois depois de hoje), mudar as datas leva a base junto. Depois de
 * começar, a base fica: o desvio é a diferença em dias úteis entre o término
 * original e o atual. Uma etapa adiada para o futuro depois de começar
 * continua com o plano original (o segundo replanejamento não o apaga).
 */

import { FERIADOS, uteisEntre } from "./calendario";
import type { DataISO, Etapa, LinhaDeBase } from "./tipos";

export function baseInicial(inicio: DataISO, fim: DataISO): LinhaDeBase {
  return { inicio, fim };
}

/** Datas novas de uma etapa já gravada, com a regra da base aplicada. */
export function aplicarDatas(
  e: Pick<Etapa, "inicio" | "fim" | "base">,
  inicio: DataISO,
  fim: DataISO,
  hoje: DataISO,
): { inicio: DataISO; fim: DataISO; base: LinhaDeBase } {
  const emPlanejamento = e.inicio > hoje && (e.base?.inicio ?? e.inicio) > hoje;
  if (emPlanejamento) return { inicio, fim, base: { inicio, fim } };
  return { inicio, fim, base: e.base ?? { inicio: e.inicio, fim: e.fim } };
}

/** "Redefinir plano original": a base passa a ser as datas atuais. */
export function redefinirBase(e: Pick<Etapa, "inicio" | "fim">): LinhaDeBase {
  return { inicio: e.inicio, fim: e.fim };
}

export function replanejada(e: Pick<Etapa, "inicio" | "fim" | "base">): boolean {
  return !!e.base && (e.base.inicio !== e.inicio || e.base.fim !== e.fim);
}

/** O que "Redefinir plano original" muda: a etapa replanejada (ou sem plano, de dado antigo). */
export function planoParaRedefinir(e: Pick<Etapa, "inicio" | "fim" | "base">): boolean {
  return replanejada(e) || !e.base;
}

/** Dias úteis entre o término original e o atual (positivo = atrasou o plano). 0 sem base. */
export function desvioUteis(e: Pick<Etapa, "fim" | "base">, feriados: ReadonlySet<DataISO> = FERIADOS): number {
  if (!e.base) return 0;
  return uteisEntre(e.base.fim, e.fim, feriados);
}
