/** Os dados da tela: as demandas vivas dos dois escopos, com o estado derivado já calculado. */

import type { DataISO } from "@comum/datas/dias";
import type { UsuarioDaUnidade } from "@projetos/ponte/tipos";
import { diasDeAtraso, type EstadoPrazo, prazoDe, type Situacao, situacaoDe } from "../modelo/situacao";
import type { Demanda, Vis } from "../modelo/tipos";
import type { RepositorioDemandas } from "../repositorio";

export interface DemandaNaTela {
  demanda: Demanda;
  vis: Vis;
  situacao: Situacao;
  prazo: EstadoPrazo;
  diasAtraso: number;
}

export const naTela = (demanda: Demanda, vis: Vis, hoje: DataISO): DemandaNaTela => ({
  demanda,
  vis,
  situacao: situacaoDe(demanda),
  prazo: prazoDe(demanda, hoje),
  diasAtraso: diasDeAtraso(demanda, hoje),
});

export async function carregarDados(repos: Readonly<Record<Vis, RepositorioDemandas>>, hoje: DataISO): Promise<DemandaNaTela[]> {
  const [u, e] = await Promise.all([repos.unidade.dados(), repos.eu.dados()]);
  return [...u.map((d) => naTela(d, "unidade", hoje)), ...e.map((d) => naTela(d, "eu", hoje))].sort((a, b) =>
    a.demanda.ordem < b.demanda.ordem ? -1 : a.demanda.ordem > b.demanda.ordem ? 1 : a.demanda.id < b.demanda.id ? -1 : 1,
  );
}

export function responsaveisUsados(lista: readonly DemandaNaTela[]): UsuarioDaUnidade[] {
  return lista.flatMap((x) => (x.demanda.responsavel ? [x.demanda.responsavel] : []));
}

export function etiquetasUsadas(lista: readonly DemandaNaTela[]): string[] {
  const vistas = new Map<string, string>();
  for (const x of lista) for (const e of x.demanda.etiquetas) vistas.set(e.toLocaleLowerCase("pt-BR"), e);
  return [...vistas.values()].sort((a, b) => a.localeCompare(b, "pt-BR"));
}
