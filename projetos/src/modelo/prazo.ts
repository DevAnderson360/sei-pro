/**
 * O prazo de uma etapa em poucas palavras, sempre visto de hoje (agenda do
 * lateral, balões da caixa e da árvore, faixa da árvore): "venceu 02/10",
 * "vence hoje", "até sex 09/10" (nesta semana), "até 15/10", "começa 16/10",
 * "marco 23/10", "concluída em 05/10". Data de outro ano vai com o ano.
 */

import { type DataISO, deISO } from "@comum/datas/dias";
import { diasUteisDeAtraso } from "./alertas";
import { dataNaFaixa, FERIADOS, sextaDaSemana, uteisEntre } from "./calendario";
import type { Etapa } from "./tipos";

const DIAS_DA_SEMANA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

type BasePrazo = Pick<Etapa, "inicio" | "fim" | "concluidaEm" | "marco">;

/** "02/10" no ano de hoje; "02/10/2027" em outro; "sem data" se não existe ou está fora de 2000-2100. */
export function dataDoPrazo(iso: DataISO, hoje: DataISO): string {
  if (!dataNaFaixa(iso)) return "sem data";
  const [a, m, d] = iso.split("-");
  return iso.slice(0, 4) === hoje.slice(0, 4) ? `${d}/${m}` : `${d}/${m}/${a}`;
}

export function textoDoPrazo(e: BasePrazo, hoje: DataISO): string {
  if (e.concluidaEm) {
    const quando = dataNaFaixa(e.concluidaEm) ? ` em ${dataDoPrazo(e.concluidaEm, hoje)}` : "";
    return `${e.marco ? "cumprido" : "concluída"}${quando}`;
  }
  if (!dataNaFaixa(e.fim)) return "sem data";
  if (e.fim < hoje) return `venceu ${dataDoPrazo(e.fim, hoje)}`;
  if (e.marco) return e.fim === hoje ? "marco hoje" : `marco ${dataDoPrazo(e.fim, hoje)}`;
  if (e.fim === hoje) return "vence hoje";
  if (dataNaFaixa(e.inicio) && e.inicio > hoje) return `começa ${dataDoPrazo(e.inicio, hoje)}`;
  if (e.fim <= sextaDaSemana(hoje)) return `até ${DIAS_DA_SEMANA[deISO(e.fim).getDay()] ?? ""} ${dataDoPrazo(e.fim, hoje)}`;
  return `até ${dataDoPrazo(e.fim, hoje)}`;
}

/** Atrasada (com os dias úteis de atraso) ou vencendo em até `limite` dias úteis. */
export type Urgencia = { tipo: "atrasada"; dias: number } | { tipo: "vence"; dias: number };

/** A faixa da árvore (spec 3.3): só etapa atrasada ou que vence em até 3 dias úteis; senão null. */
export function urgenciaDaEtapa(
  e: BasePrazo & Pick<Etapa, "removidoEm">,
  hoje: DataISO,
  limite = 3,
  feriados: ReadonlySet<DataISO> = FERIADOS,
): Urgencia | null {
  if (e.concluidaEm || e.removidoEm !== undefined || !dataNaFaixa(e.fim)) return null;
  if (e.fim < hoje) return { tipo: "atrasada", dias: diasUteisDeAtraso(e, hoje, feriados) };
  const dias = uteisEntre(hoje, e.fim, feriados);
  return dias <= limite ? { tipo: "vence", dias } : null;
}

/** "atrasada", "vence hoje", "vence em 1 dia útil", "vence em 3 dias úteis". */
export function textoDaUrgencia(u: Urgencia): string {
  if (u.tipo === "atrasada") return "atrasada";
  if (u.dias <= 0) return "vence hoje";
  return `vence em ${u.dias} ${u.dias === 1 ? "dia útil" : "dias úteis"}`;
}
