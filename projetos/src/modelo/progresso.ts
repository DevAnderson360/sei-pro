/**
 * Progresso da etapa (spec 5.3): concluída = 100; manual = o informado;
 * pelo tempo = dias úteis decorridos / dias úteis totais (0 antes do início,
 * 100 a partir do término); pelo checklist = feitos / total. Nunca divide por zero.
 */

import { somarDias } from "@comum/datas/dias";
import { duracaoUteis, FERIADOS } from "./calendario";
import type { DataISO, Etapa } from "./tipos";

const limitar = (n: number): number => Math.min(100, Math.max(0, Math.round(Number.isFinite(n) ? n : 0)));

export function progressoPeloTempo(inicio: DataISO, fim: DataISO, hoje: DataISO, feriados: ReadonlySet<DataISO> = FERIADOS): number {
  if (hoje < inicio) return 0;
  if (hoje >= fim) return 100;
  const total = duracaoUteis(inicio, fim, feriados);
  if (total === 0) return 0;
  // Decorridos: dias úteis ANTES de hoje (no primeiro dia ainda é 0%).
  const decorridos = duracaoUteis(inicio, somarDias(hoje, -1), feriados);
  return limitar((decorridos / total) * 100);
}

export function progressoPeloChecklist(itens: ReadonlyArray<{ feito: boolean }>): number {
  if (!itens.length) return 0;
  return limitar((itens.filter((i) => i.feito).length / itens.length) * 100);
}

type BaseProgresso = Pick<Etapa, "inicio" | "fim" | "concluidaEm" | "medida" | "progresso" | "checklist">;

export function progressoDaEtapa(e: BaseProgresso, hoje: DataISO, feriados: ReadonlySet<DataISO> = FERIADOS): number {
  if (e.concluidaEm) return 100;
  if (e.medida === "tempo") return progressoPeloTempo(e.inicio, e.fim, hoje, feriados);
  if (e.medida === "checklist") return progressoPeloChecklist(e.checklist);
  return limitar(e.progresso);
}
