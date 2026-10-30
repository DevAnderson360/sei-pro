import { CUSTO_REQUISICAO_MS, PAUSA_MAXIMA, PAUSA_MINIMA, PAUSA_PADRAO } from "./constantes";

/** Duracao aproximada de uma execucao (porta de procLote_estimarDuracao). */
export function estimarDuracao(total: number, pausaMs: number): string {
  const ms = total * (pausaMs + CUSTO_REQUISICAO_MS);
  const minutos = Math.round(ms / 60000);
  if (minutos < 1) return "menos de um minuto";
  if (minutos < 60) return `cerca de ${minutos} ${minutos === 1 ? "minuto" : "minutos"}`;
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  return `cerca de ${horas} h${resto ? ` ${resto} min` : ""}`;
}

/** Pausa valida entre processos: ausente ou ilegivel = padrao; fora da faixa = o limite mais proximo. */
export function limitarPausa(valor: unknown): number {
  const n = typeof valor === "number" ? valor : Number.parseInt(String(valor ?? ""), 10);
  if (!Number.isFinite(n)) return PAUSA_PADRAO;
  return Math.min(PAUSA_MAXIMA, Math.max(PAUSA_MINIMA, Math.round(n)));
}
