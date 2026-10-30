/**
 * Escopo = de quem, em qual unidade e para quem é visível. A chave entra no nome de cada entrada do
 * `chrome.storage.local`: `demandas/<host>|<login>|u:<idUnidade>/<un|eu>/<d|h>/<id>` (spec 4.1).
 */

import type { Escopo, Vis } from "./tipos";

export type TipoEntidade = "d" | "h";

export function chaveEscopo(e: Escopo): string {
  return `${e.host}|${e.login.trim().toLowerCase()}|u:${e.unidade}/${e.vis === "unidade" ? "un" : "eu"}`;
}

/** Prefixo de tudo do escopo (com a barra final). */
export function baseDoEscopo(e: Escopo): string {
  return `demandas/${chaveEscopo(e)}/`;
}

export function prefixoDe(e: Escopo, tipo: TipoEntidade): string {
  return `${baseDoEscopo(e)}${tipo}/`;
}

export function chaveMeta(e: Escopo): string {
  return `${baseDoEscopo(e)}meta`;
}

/** Os dois escopos da unidade atual (o painel mostra os dois juntos). */
export function escoposDaUnidade(host: string, login: string, unidade: string): { unidade: Escopo; eu: Escopo } {
  const base = { host, login: login.trim().toLowerCase(), unidade };
  return { unidade: { ...base, vis: "unidade" }, eu: { ...base, vis: "eu" } };
}

export function rotuloDaVis(vis: Vis): string {
  return vis === "unidade" ? "Toda a unidade" : "Só eu";
}
