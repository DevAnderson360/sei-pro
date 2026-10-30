/**
 * Filtro das etapas (spec 3.1, como nos Favoritos): os chips de situação valem
 * qualquer um (Atrasadas ou Em andamento ou Vence nesta semana ou Próximos 30
 * dias; "semana" é o filtro da pílula do título do painel); "Só as minhas"
 * e "Concluídas" (mostrar/ocultar) restringem; nos campos (responsável, fase,
 * etiqueta) vale qualquer valor dentro do campo, e os campos se somam (E).
 */

import { normalizarTexto } from "@comum/texto";
import { alertasDasEtapas } from "./alertas";
import { SEM_FASE } from "./constantes";
import { situacaoEtapa } from "./situacao";
import type { DataISO, Etapa, Responsavel } from "./tipos";

export type ChipSituacao = "atrasadas" | "andamento" | "semana" | "proximos30";

/** As listas são só leitura: um filtro novo é uma cópia com a lista trocada (o `FILTRO_VAZIO` é compartilhado). */
export interface FiltroEtapas {
  situacoes: readonly ChipSituacao[];
  soMinhas: boolean;
  mostrarConcluidas: boolean;
  /** Chaves de `chaveResponsavel`. */
  responsaveis: readonly string[];
  /** Ids de fase; `SEM_FASE` = as sem fase. */
  fases: readonly string[];
  /** Etiquetas como digitadas (comparadas sem acento e sem caixa). */
  etiquetas: readonly string[];
}

/** Filtro sem critério, novo a cada chamada (pode ser alterado à vontade). */
export function filtroVazio(): FiltroEtapas {
  return { situacoes: [], soMinhas: false, mostrarConcluidas: true, responsaveis: [], fases: [], etiquetas: [] };
}

/** Filtro sem critério compartilhado, congelado por inteiro (as listas também): `{ ...FILTRO_VAZIO, ... }` copia. */
export const FILTRO_VAZIO: Readonly<FiltroEtapas> = Object.freeze({
  situacoes: Object.freeze([] as ChipSituacao[]),
  soMinhas: false,
  mostrarConcluidas: true,
  responsaveis: Object.freeze([] as string[]),
  fases: Object.freeze([] as string[]),
  etiquetas: Object.freeze([] as string[]),
});

export interface Eu {
  login: string;
  nome?: string;
}

/** Mesma pessoa = mesmo login; sem login, mesmo nome (sem acento e sem caixa). */
export function chaveResponsavel(r: Responsavel): string {
  return r.login ? `login:${r.login.trim().toLowerCase()}` : `nome:${normalizarTexto(r.nome)}`;
}

export function ehMinha(e: Pick<Etapa, "responsavel">, eu: Eu): boolean {
  const r = e.responsavel;
  if (!r) return false;
  if (r.login) return r.login.trim().toLowerCase() === eu.login.trim().toLowerCase();
  return !!eu.nome && normalizarTexto(r.nome) === normalizarTexto(eu.nome);
}

/**
 * O filtro que vale onde ele está sendo usado. O filtro é um só (preferência), mas os ids de fase
 * são de um projeto: no outro projeto (e no Todos) eles não valem, nem para filtrar nem para contar.
 * `SEM_FASE` vale em qualquer lugar. `fases` = as do projeto aberto; sem elas (Todos), só `SEM_FASE`.
 * As fases de outro projeto continuam gravadas: voltam a valer quando ele é aberto de novo.
 */
export function filtroNoContexto(f: FiltroEtapas, fases?: ReadonlyArray<{ id: string }>): FiltroEtapas {
  if (!f.fases.length) return f;
  const validas = new Set([SEM_FASE, ...(fases ?? []).map((x) => x.id)]);
  const ficam = f.fases.filter((id) => validas.has(id));
  return ficam.length === f.fases.length ? f : { ...f, fases: ficam };
}

/** Quantos critérios estão ligados (o botão "Filtro" mostra o número). */
export function criteriosAtivos(f: FiltroEtapas): number {
  return (
    f.situacoes.length +
    (f.soMinhas ? 1 : 0) +
    (f.mostrarConcluidas ? 0 : 1) +
    (f.responsaveis.length ? 1 : 0) +
    (f.fases.length ? 1 : 0) +
    (f.etiquetas.length ? 1 : 0)
  );
}

export function filtrarEtapas<T extends Etapa>(etapas: readonly T[], f: FiltroEtapas, hoje: DataISO, eu: Eu): T[] {
  const vivas = etapas.filter((e) => e.removidoEm === undefined);
  const alertas = alertasDasEtapas(vivas, hoje);
  const porChip: Record<ChipSituacao, Set<string>> = {
    atrasadas: new Set(alertas.atrasadas.map((e) => e.id)),
    andamento: new Set(vivas.filter((e) => situacaoEtapa(e, hoje) === "andamento").map((e) => e.id)),
    semana: new Set(alertas.semana.map((e) => e.id)),
    proximos30: new Set(alertas.proximos30.map((e) => e.id)),
  };
  const etiquetas = new Set(f.etiquetas.map(normalizarTexto));
  return vivas.filter((e) => {
    if (!f.mostrarConcluidas && e.concluidaEm) return false;
    if (f.soMinhas && !ehMinha(e, eu)) return false;
    if (f.situacoes.length && !f.situacoes.some((s) => porChip[s].has(e.id))) return false;
    if (f.responsaveis.length && !(e.responsavel && f.responsaveis.includes(chaveResponsavel(e.responsavel)))) return false;
    if (f.fases.length && !f.fases.includes(e.fase ?? SEM_FASE)) return false;
    if (etiquetas.size && !e.etiquetas.some((x) => etiquetas.has(normalizarTexto(x)))) return false;
    return true;
  });
}

/** Números dos chips ("Atrasadas · N"), sobre todas as etapas vivas. */
export function contarChips(etapas: readonly Etapa[], hoje: DataISO): Record<ChipSituacao, number> {
  const vivas = etapas.filter((e) => e.removidoEm === undefined);
  const alertas = alertasDasEtapas(vivas, hoje);
  return {
    atrasadas: alertas.atrasadas.length,
    andamento: vivas.filter((e) => situacaoEtapa(e, hoje) === "andamento").length,
    semana: alertas.semana.length,
    proximos30: alertas.proximos30.length,
  };
}
