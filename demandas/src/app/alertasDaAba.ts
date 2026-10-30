/** Os números das pílulas do título do painel embutido: as MINHAS demandas abertas, nos dois escopos da unidade. */

import type { DataISO } from "@comum/datas/dias";
import { minhasAtrasadas, minhasDaSemana } from "../modelo/minhas";
import type { Responsavel } from "../modelo/tipos";
import type { DemandaNaTela } from "./dados";

export function contarAlertas(itens: readonly DemandaNaTela[], eu: Responsavel, hoje: DataISO): { atrasadas: number; semana: number } {
  const lista = itens.map((x) => x.demanda);
  return { atrasadas: minhasAtrasadas(lista, eu, hoje).length, semana: minhasDaSemana(lista, eu, hoje).length };
}
