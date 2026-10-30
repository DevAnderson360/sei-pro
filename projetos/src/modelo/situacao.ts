/**
 * Situação da etapa (spec 5.3), sempre calculada, nunca gravada. Datas como
 * "AAAA-MM-DD" comparam certo com < e >.
 */

import type { DataISO, Etapa } from "./tipos";

export type SituacaoEtapa = "concluida" | "atrasada" | "andamento" | "futura";
export type SituacaoMarco = "cumprido" | "atrasado" | "futuro";

type BaseSituacao = Pick<Etapa, "inicio" | "fim" | "concluidaEm" | "marco" | "medida" | "progresso">;

export function situacaoEtapa(e: BaseSituacao, hoje: DataISO): SituacaoEtapa {
  if (e.concluidaEm) return "concluida";
  if (e.fim < hoje) return "atrasada";
  if (e.inicio <= hoje) return "andamento";
  // Tela 2: "entra em andamento sozinha na data de início (ou ao mexer no progresso)".
  if (!e.marco && e.medida === "manual" && e.progresso > 0) return "andamento";
  return "futura";
}

export function situacaoMarco(e: BaseSituacao, hoje: DataISO): SituacaoMarco {
  if (e.concluidaEm) return "cumprido";
  if (e.fim < hoje) return "atrasado";
  return "futuro";
}

export const ROTULO_SITUACAO: Record<SituacaoEtapa, string> = {
  concluida: "Concluída",
  atrasada: "Atrasada",
  andamento: "Em andamento",
  futura: "A iniciar",
};

export const ROTULO_MARCO: Record<SituacaoMarco, string> = {
  cumprido: "Marco cumprido",
  atrasado: "Marco atrasado",
  futuro: "Marco",
};
