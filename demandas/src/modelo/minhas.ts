/** "Minhas" demandas: as abertas cujo responsável sou eu (login igual; sem login, o nome sem acento e sem caixa). */

import { type DataISO, somarDias } from "@comum/datas/dias";
import { normalizarTexto } from "@comum/texto";
import { prazoDe } from "./situacao";
import type { Demanda, Responsavel } from "./tipos";

export function ehMinha(d: Pick<Demanda, "responsavel">, eu: Responsavel): boolean {
  const r = d.responsavel;
  if (!r) return false;
  if (r.login && eu.login) return r.login.trim().toLowerCase() === eu.login.trim().toLowerCase();
  return normalizarTexto(r.nome) === normalizarTexto(eu.nome);
}

/** Aberta: não arquivada e não concluída. */
export const estaAberta = (d: Pick<Demanda, "arquivadoEm" | "concluidaEm">): boolean => d.arquivadoEm === undefined && !d.concluidaEm;

/** As minhas abertas já vencidas (as pílulas do título e o selo da aba lateral). */
export function minhasAtrasadas<T extends Demanda>(lista: readonly T[], eu: Responsavel, hoje: DataISO): T[] {
  return lista.filter((d) => estaAberta(d) && ehMinha(d, eu) && prazoDe(d, hoje) === "atrasada");
}

/** As minhas abertas que vencem de hoje até daqui a 7 dias (não atrasadas). */
export function minhasDaSemana<T extends Demanda>(lista: readonly T[], eu: Responsavel, hoje: DataISO): T[] {
  const fim = somarDias(hoje, 7);
  return lista.filter((d) => estaAberta(d) && ehMinha(d, eu) && d.prazo >= hoje && d.prazo <= fim);
}
