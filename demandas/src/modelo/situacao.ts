/**
 * O estado da demanda NÃO é um campo: deriva das datas e das pausas (spec 3.1), como no legado.
 * O semáforo do prazo é ortogonal ao estado.
 */

import { type DataISO, diferencaDias } from "@comum/datas/dias";
import type { Demanda } from "./tipos";

export type SituacaoBase = "nao_iniciada" | "iniciada" | "pausada" | "concluida" | "avaliada";
export type Situacao = SituacaoBase | "arquivada";
export type EstadoPrazo = "no_prazo" | "atrasada" | "concluida_no_prazo" | "concluida_fora_do_prazo";

type CamposDeEstado = Pick<Demanda, "avaliacao" | "concluidaEm" | "pausas" | "iniciadaEm">;

/** O estado sem olhar o arquivamento (o que a demanda volta a ser ao desarquivar). */
export function situacaoBase(d: CamposDeEstado): SituacaoBase {
  if (d.avaliacao) return "avaliada";
  if (d.concluidaEm) return "concluida";
  const ultima = d.pausas[d.pausas.length - 1];
  if (ultima && ultima.fim === undefined) return "pausada";
  if (d.iniciadaEm !== undefined) return "iniciada";
  return "nao_iniciada";
}

export function situacaoDe(d: CamposDeEstado & Pick<Demanda, "arquivadoEm">): Situacao {
  return d.arquivadoEm !== undefined ? "arquivada" : situacaoBase(d);
}

/** Datas ISO comparam como texto. */
export function prazoDe(d: Pick<Demanda, "prazo" | "concluidaEm">, hoje: DataISO): EstadoPrazo {
  if (d.concluidaEm) return d.concluidaEm <= d.prazo ? "concluida_no_prazo" : "concluida_fora_do_prazo";
  return d.prazo < hoje ? "atrasada" : "no_prazo";
}

export function diasDeAtraso(d: Pick<Demanda, "prazo" | "concluidaEm">, hoje: DataISO): number {
  return prazoDe(d, hoje) === "atrasada" ? diferencaDias(d.prazo, hoje) : 0;
}
