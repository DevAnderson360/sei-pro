/**
 * Alertas (spec 5.3): atrasadas = não concluídas com término antes de hoje
 * (marcos incluídos); "vence nesta semana" = não concluídas com
 * hoje <= término <= sexta desta semana; "próximos 30 dias" = não concluídas
 * que começam ou terminam entre hoje e hoje + 30 dias corridos.
 */

import { somarDias } from "@comum/datas/dias";
import { FERIADOS, sextaDaSemana, uteisEntre } from "./calendario";
import type { DataISO, Etapa } from "./tipos";

export interface Alertas<T> {
  atrasadas: T[];
  semana: T[];
  proximos30: T[];
}

type BaseAlerta = Pick<Etapa, "inicio" | "fim" | "concluidaEm" | "removidoEm">;

export function alertasDasEtapas<T extends BaseAlerta>(etapas: readonly T[], hoje: DataISO): Alertas<T> {
  const sexta = sextaDaSemana(hoje);
  const limite30 = somarDias(hoje, 30);
  const saida: Alertas<T> = { atrasadas: [], semana: [], proximos30: [] };
  for (const e of etapas) {
    if (e.removidoEm !== undefined || e.concluidaEm) continue;
    if (e.fim < hoje) saida.atrasadas.push(e);
    if (e.fim >= hoje && e.fim <= sexta) saida.semana.push(e);
    const comeca = e.inicio >= hoje && e.inicio <= limite30;
    const termina = e.fim >= hoje && e.fim <= limite30;
    if (comeca || termina) saida.proximos30.push(e);
  }
  return saida;
}

/** Dias úteis de atraso ("Atrasada · 2 dias úteis"): 0 se não está atrasada. */
export function diasUteisDeAtraso(e: BaseAlerta, hoje: DataISO, feriados: ReadonlySet<DataISO> = FERIADOS): number {
  if (e.concluidaEm || e.fim >= hoje) return 0;
  return Math.max(0, uteisEntre(e.fim, hoje, feriados));
}
