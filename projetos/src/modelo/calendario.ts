/**
 * Dias úteis do projeto: segunda a sexta, menos os feriados nacionais
 * (`@comum/datas/feriados`, os mesmos dos prazos dos Favoritos). Tudo em
 * `DataISO` local: `deISO` usa o meio-dia (sem efeito de horário de verão) e
 * `dataDe` lê getFullYear/getMonth/getDate. `toISOString()` daria o dia
 * seguinte a partir das 21h em Brasília.
 */

import { type DataISO, deISO, diasUteisEntre, diferencaDias, ehDiaUtil, hojeISO, somarDias, somarDiasUteis } from "@comum/datas/dias";
import { conjuntoDeFeriados, type Feriado, feriadosNacionais } from "@comum/datas/feriados";

export const ANO_MIN = 2000;
export const ANO_MAX = 2100;
/**
 * Teto de dias úteis (cerca de 10 anos) para qualquer contagem ou soma. Modelos e
 * etapas podem vir de um Texto Padrão editável à mão: sem teto, `aPartirDe: 1e9` ou
 * `Infinity` faria a página do SEI girar dia a dia para sempre.
 */
export const MAX_DIAS_UTEIS = 2600;
/** Dias corridos que cabem em `MAX_DIAS_UTEIS` úteis com folga (2600 × 7/5 = 3640 + feriados). */
const MAX_DIAS_CORRIDOS = 3700;
/** Etapa com mais dias corridos que isto (cerca de 10 anos) é rejeitada na digitação e na importação: travaria o desenho das barras. */
export const LIMITE_DIAS_ETAPA = Math.ceil((MAX_DIAS_UTEIS * 7) / 5);

/** Inteiro entre `min` e `max`; não finito (NaN, ±Infinity) vira `senao`. */
function limitar(n: number, min: number, max: number, senao: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return senao;
  return Math.min(max, Math.max(min, Math.trunc(n)));
}

function anos(de: number, ate: number): number[] {
  return Array.from({ length: ate - de + 1 }, (_, i) => de + i);
}

/** Feriados nacionais de 2000 a 2100 (cerca de 1.400 datas, calculadas uma vez). */
export const FERIADOS: ReadonlySet<DataISO> = conjuntoDeFeriados(anos(ANO_MIN, ANO_MAX));

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

/** "AAAA-MM-DD" que existe no calendário (2026-02-30 não passa). */
export function dataValida(iso: unknown): iso is DataISO {
  if (typeof iso !== "string" || !RE_DATA.test(iso)) return false;
  return hojeISO(deISO(iso)) === iso;
}

/**
 * Data válida com o ano entre `ANO_MIN` e `ANO_MAX`: a faixa dos feriados pré-calculados e a que o
 * Gantt desenha. É a regra das datas de etapa na digitação, no arraste e na importação.
 */
export function dataNaFaixa(iso: unknown): iso is DataISO {
  if (!dataValida(iso)) return false;
  const ano = Number(iso.slice(0, 4));
  return ano >= ANO_MIN && ano <= ANO_MAX;
}

/** Date (qualquer hora) → dia civil LOCAL. */
export function dataDe(d: Date): DataISO {
  return hojeISO(d);
}

/** Dia civil → meia-noite local (o que a Frappe usa para posicionar barras). */
export function meiaNoite(iso: DataISO): Date {
  const d = deISO(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function ehUtil(iso: DataISO, feriados: ReadonlySet<DataISO> = FERIADOS): boolean {
  return ehDiaUtil(iso, feriados);
}

/** A própria data, se for dia útil; senão o próximo dia útil. */
export function proximoUtil(iso: DataISO, feriados: ReadonlySet<DataISO> = FERIADOS): DataISO {
  let d = iso;
  // Uma semana basta; o limite protege de um conjunto de feriados que cubra todos os dias.
  for (let i = 0; i < 366 && !ehDiaUtil(d, feriados); i++) d = somarDias(d, 1);
  return d;
}

/**
 * Dias úteis em [inicio, fim], inclusive, até `MAX_DIAS_UTEIS`. 0 quando fim < inicio, quando não há
 * dia útil no período ou quando uma data não existe (2026-13-45 passa no formato e faria
 * `diasUteisEntre` andar dia a dia até o ano 10000 antes de lançar).
 */
export function duracaoUteis(inicio: DataISO, fim: DataISO, feriados: ReadonlySet<DataISO> = FERIADOS): number {
  if (!dataValida(inicio) || !dataValida(fim) || fim < inicio) return 0;
  if (diferencaDias(inicio, fim) > MAX_DIAS_CORRIDOS) return MAX_DIAS_UTEIS;
  return Math.min(MAX_DIAS_UTEIS, (ehDiaUtil(inicio, feriados) ? 1 : 0) + diasUteisEntre(inicio, fim, feriados));
}

/**
 * Término de uma etapa que começa em `inicio` e dura `duracao` dias úteis
 * (inclusive). O início vai para o próximo dia útil; duração < 1 ou não finita
 * vale 1 e acima de `MAX_DIAS_UTEIS` vale o teto.
 */
export function fimPorDuracao(inicio: DataISO, duracao: number, feriados: ReadonlySet<DataISO> = FERIADOS): DataISO {
  const comeco = proximoUtil(inicio, feriados);
  const n = limitar(duracao, 1, MAX_DIAS_UTEIS, 1);
  return n === 1 ? comeco : somarDiasUteis(comeco, n - 1, feriados);
}

/** Dias úteis depois de `a` até `b` (inclusive); negativo quando b < a. Limitado a ±`MAX_DIAS_UTEIS`; 0 com data que não existe. */
export function uteisEntre(a: DataISO, b: DataISO, feriados: ReadonlySet<DataISO> = FERIADOS): number {
  if (!dataValida(a) || !dataValida(b)) return 0;
  const corridos = diferencaDias(a, b);
  if (Math.abs(corridos) > MAX_DIAS_CORRIDOS) return corridos > 0 ? MAX_DIAS_UTEIS : -MAX_DIAS_UTEIS;
  return limitar(diasUteisEntre(a, b, feriados), -MAX_DIAS_UTEIS, MAX_DIAS_UTEIS, 0);
}

/** Soma `n` dias úteis (negativo volta). `n` não finito vale 0; o módulo é limitado a `MAX_DIAS_UTEIS`. */
export function somarUteis(iso: DataISO, n: number, feriados: ReadonlySet<DataISO> = FERIADOS): DataISO {
  const q = limitar(n, -MAX_DIAS_UTEIS, MAX_DIAS_UTEIS, 0);
  return q === 0 ? iso : somarDiasUteis(iso, q, feriados);
}

/** Feriados (com nome) entre duas datas, inclusive: para o destaque do Gantt na escala Dia. */
export function feriadosNoPeriodo(inicio: DataISO, fim: DataISO): Feriado[] {
  if (fim < inicio) return [];
  const de = Number(inicio.slice(0, 4));
  const ate = Number(fim.slice(0, 4));
  return anos(de, ate)
    .flatMap((ano) => feriadosNacionais(ano))
    .filter((f) => f.data >= inicio && f.data <= fim);
}

/** Sexta-feira da semana (segunda a domingo) de `hoje`. */
export function sextaDaSemana(hoje: DataISO): DataISO {
  const dia = deISO(hoje).getDay(); // 0 = domingo
  const desdeSegunda = (dia + 6) % 7;
  return somarDias(hoje, 4 - desdeSegunda);
}
