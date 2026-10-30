/**
 * Escalas do Gantt em português (Dia, Semana, Mês, Ano), como na tela 1. As
 * medidas (cabeçalho 64 px = 28 + 26 + 10; linha 36 px = 22 + 14) alinham a
 * coluna da lista à esquerda com as linhas do Gantt.
 */

import type { ModoDeVisao } from "../vendor/frappe-gantt/index";

export type Escala = "Dia" | "Semana" | "Mês" | "Ano";

export const ESCALAS: readonly Escala[] = ["Dia", "Semana", "Mês", "Ano"];

export const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const maiuscula = (s: string): string => (s ? s[0]!.toUpperCase() + s.slice(1) : s);
const mes = (d: Date): string => maiuscula(MESES[d.getMonth()] ?? "");
const dois = (n: number): string => String(n).padStart(2, "0");

/** Medidas que a coluna da lista (P3) repete para ficar alinhada. */
export const MEDIDAS = {
  barra: 22,
  espaco: 14,
  cabecalhoSuperior: 28,
  cabecalhoInferior: 26,
  /** 28 + 26 + 10 (a Frappe soma 10). */
  cabecalho: 64,
  /** 22 + 14. */
  linha: 36,
} as const;

export const MODOS: ModoDeVisao[] = [
  {
    name: "Dia",
    padding: "7d",
    step: "1d",
    column_width: 28,
    date_format: "YYYY-MM-DD",
    lower_text: (d) => String(d.getDate()),
    upper_text: (d, ant) => (!ant || d.getMonth() !== ant.getMonth() ? `${mes(d)} ${d.getFullYear()}` : ""),
    thick_line: (d) => d.getDay() === 1,
  },
  {
    name: "Semana",
    padding: "14d",
    step: "7d",
    column_width: 64,
    date_format: "YYYY-MM-DD",
    lower_text: (d) => `${dois(d.getDate())}/${dois(d.getMonth() + 1)}`,
    upper_text: (d, ant) => (!ant || d.getMonth() !== ant.getMonth() ? mes(d) : ""),
    thick_line: (d) => d.getDate() <= 7,
    upper_text_frequency: 4,
  },
  {
    name: "Mês",
    padding: "1m",
    step: "1m",
    column_width: 120,
    date_format: "YYYY-MM",
    lower_text: (d) => mes(d),
    upper_text: (d, ant) => (!ant || d.getFullYear() !== ant.getFullYear() ? String(d.getFullYear()) : ""),
    thick_line: (d) => d.getMonth() % 3 === 0,
    snap_at: "1d",
  },
  {
    name: "Ano",
    padding: "1y",
    step: "1y",
    column_width: 160,
    date_format: "YYYY",
    lower_text: (d) => String(d.getFullYear()),
    upper_text: "",
    snap_at: "7d",
  },
];

/**
 * Arrastar só em Dia e Semana: na 1.2.2, em Mês e Ano a biblioteca converte a
 * posição em data com `parseInt` de meses/anos fracionários e devolve o dia 1
 * (prova no experimento do plano P2). Nessas escalas as datas ficam só leitura.
 */
export function escalaEditavel(e: Escala): boolean {
  return e === "Dia" || e === "Semana";
}

export function ehEscala(x: unknown): x is Escala {
  return typeof x === "string" && (ESCALAS as readonly string[]).includes(x);
}
