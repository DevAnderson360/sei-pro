/**
 * Preferências locais do gestor de projetos (spec 5.4), numa chave só do
 * `chrome.storage.local` (`projetos/preferencias`). Valem para este navegador:
 * não vão ao Texto Padrão. Tudo que vem do armazenamento é conferido campo a
 * campo (versão antiga ou dado estranho volta ao padrão).
 */

import type { Area } from "@comum/armazenamento/area";
import { type Escala, ehEscala } from "../gantt/escalas";
import { CHAVE_PREFERENCIAS } from "../modelo/constantes";
import { chaveEscopo } from "../modelo/escopo";
import { type ChipSituacao, type FiltroEtapas, filtroVazio } from "../modelo/filtro";
import type { OrdemEtapas } from "../modelo/operacoes";

export type Vista = "gantt" | "lista";

export interface Preferencias {
  /** Lista de etapas à esquerda do Gantt (menu ajustes). */
  mostrarLista: boolean;
  /** Arrastar uma etapa leva as que dependem dela. */
  moverDependentes: boolean;
  ordemEtapas: OrdemEtapas;
  /** Escala por projeto (id → escala); sem registro, "Semana". */
  escalas: Record<string, Escala>;
  /** Escala da aba "Todos". */
  escalaTodos: Escala;
  vista: Vista;
  /** Aba aberta por unidade (`chaveAberto`) → id do projeto ou "todos". */
  abertos: Record<string, string>;
  /** Fases recolhidas (ids). */
  recolhidas: string[];
  filtro: FiltroEtapas;
  /** Painel lateral (P5). */
  modoLateral: "agenda" | "projetos";
  soMinhas: boolean;
  /** Painel embutido recolhido. */
  recolhido: boolean;
}

export const ESCALA_PADRAO: Escala = "Semana";

export const PREFERENCIAS_PADRAO: Preferencias = {
  mostrarLista: true,
  moverDependentes: true,
  ordemEtapas: "inicio",
  escalas: {},
  escalaTodos: "Mês",
  vista: "gantt",
  abertos: {},
  recolhidas: [],
  filtro: filtroVazio(),
  modoLateral: "agenda",
  soMinhas: false,
  recolhido: false,
};

/** Mapas e listas não crescem para sempre (projeto excluído deixa a entrada para trás). */
const TETO_MAPA = 200;
const TETO_LISTA = 500;
const CHIPS: readonly ChipSituacao[] = ["atrasadas", "andamento", "semana", "proximos30"];

const textos = (x: unknown, teto = TETO_LISTA): string[] =>
  Array.isArray(x) ? x.filter((v): v is string => typeof v === "string").slice(-teto) : [];

function mapa<T>(x: unknown, valido: (v: unknown) => v is T): Record<string, T> {
  if (!x || typeof x !== "object" || Array.isArray(x)) return {};
  const pares = Object.entries(x as Record<string, unknown>).filter((p): p is [string, T] => valido(p[1]));
  return Object.fromEntries(pares.slice(-TETO_MAPA));
}

function filtroDe(x: unknown): FiltroEtapas {
  const f = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  return {
    situacoes: textos(f.situacoes).filter((s): s is ChipSituacao => (CHIPS as readonly string[]).includes(s)),
    soMinhas: f.soMinhas === true,
    mostrarConcluidas: f.mostrarConcluidas !== false,
    responsaveis: textos(f.responsaveis),
    fases: textos(f.fases),
    etiquetas: textos(f.etiquetas),
  };
}

export function normalizarPreferencias(x: unknown): Preferencias {
  const p = (x && typeof x === "object" ? x : {}) as Record<string, unknown>;
  const d = PREFERENCIAS_PADRAO;
  const bool = (v: unknown, padrao: boolean) => (typeof v === "boolean" ? v : padrao);
  return {
    mostrarLista: bool(p.mostrarLista, d.mostrarLista),
    moverDependentes: bool(p.moverDependentes, d.moverDependentes),
    ordemEtapas: p.ordemEtapas === "nome" || p.ordemEtapas === "cadastro" ? p.ordemEtapas : "inicio",
    escalas: mapa(p.escalas, ehEscala),
    escalaTodos: ehEscala(p.escalaTodos) ? p.escalaTodos : d.escalaTodos,
    vista: p.vista === "lista" ? "lista" : "gantt",
    abertos: mapa(p.abertos, (v): v is string => typeof v === "string"),
    recolhidas: textos(p.recolhidas),
    filtro: filtroDe(p.filtro),
    modoLateral: p.modoLateral === "projetos" ? "projetos" : "agenda",
    soMinhas: bool(p.soMinhas, d.soMinhas),
    recolhido: bool(p.recolhido, d.recolhido),
  };
}

export async function lerPreferencias(area: Area): Promise<Preferencias> {
  return normalizarPreferencias((await area.obter(CHAVE_PREFERENCIAS))[CHAVE_PREFERENCIAS]);
}

/** Lê, mescla e grava (o content script grava `recolhido`; o app, o resto). */
export async function gravarPreferencias(area: Area, parcial: Partial<Preferencias>): Promise<Preferencias> {
  const nova = normalizarPreferencias({ ...(await lerPreferencias(area)), ...parcial });
  await area.gravar({ [CHAVE_PREFERENCIAS]: nova });
  return nova;
}

export function escalaDoProjeto(p: Preferencias, id: string): Escala {
  return p.escalas[id] ?? ESCALA_PADRAO;
}

/** A aba aberta é lembrada por unidade (o mesmo navegador serve mais de um SEI e de uma unidade). */
export function chaveAberto(host: string, login: string, unidade: string): string {
  return chaveEscopo({ host, login, unidade, vis: "unidade" }).replace(/\/un$/, "");
}
