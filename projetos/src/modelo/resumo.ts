/**
 * Resumos derivados (spec 5.3): projeto e fase a partir das suas etapas.
 * Progresso = média ponderada pela duração em dias úteis; marco pesa 0; etapa
 * comum pesa pelo menos 1 (a que cai só em fim de semana não some da conta).
 * Só marcos: a fração de cumpridos.
 */

import { alertasDasEtapas } from "./alertas";
import { dataValida, duracaoUteis, FERIADOS } from "./calendario";
import { progressoDaEtapa } from "./progresso";
import { situacaoEtapa } from "./situacao";
import type { DataISO, Etapa } from "./tipos";

export type SituacaoProjeto = "concluido" | "atrasado" | "andamento" | "aIniciar" | "semEtapas";

export interface ResumoFase {
  inicio?: DataISO;
  fim?: DataISO;
  progresso: number;
  feitas: number;
  total: number;
}

export interface ResumoProjeto extends ResumoFase {
  atrasadas: number;
  /** Vencem até a sexta desta semana. */
  semana: number;
  situacao: SituacaoProjeto;
}

const ativas = (etapas: readonly Etapa[]) => etapas.filter((e) => e.removidoEm === undefined);

/**
 * Data que não existe (gravada por versão antiga ou à mão) não entra no início e no término do resumo
 * (sem nenhuma válida, ficam ausentes e a linha ancora em hoje) e pesa 1 no progresso.
 */
export function resumoDeEtapas(etapas: readonly Etapa[], hoje: DataISO, feriados: ReadonlySet<DataISO> = FERIADOS): ResumoFase {
  const lista = ativas(etapas);
  if (!lista.length) return { progresso: 0, feitas: 0, total: 0 };
  let inicio: DataISO | undefined;
  let fim: DataISO | undefined;
  let soma = 0;
  let peso = 0;
  let feitas = 0;
  for (const e of lista) {
    if (dataValida(e.inicio) && (inicio === undefined || e.inicio < inicio)) inicio = e.inicio;
    if (dataValida(e.fim) && (fim === undefined || e.fim > fim)) fim = e.fim;
    if (e.concluidaEm) feitas += 1;
    const p = e.marco ? 0 : Math.max(1, duracaoUteis(e.inicio, e.fim, feriados));
    soma += p * progressoDaEtapa(e, hoje, feriados);
    peso += p;
  }
  const progresso = peso > 0 ? Math.round(soma / peso) : Math.round((feitas / lista.length) * 100);
  const r: ResumoFase = { progresso, feitas, total: lista.length };
  if (inicio !== undefined) r.inicio = inicio;
  if (fim !== undefined) r.fim = fim;
  return r;
}

export function resumoDoProjeto(etapas: readonly Etapa[], hoje: DataISO, feriados: ReadonlySet<DataISO> = FERIADOS): ResumoProjeto {
  const base = resumoDeEtapas(etapas, hoje, feriados);
  const lista = ativas(etapas);
  const alertas = alertasDasEtapas(lista, hoje);
  let situacao: SituacaoProjeto;
  if (!lista.length) situacao = "semEtapas";
  else if (base.feitas === lista.length) situacao = "concluido";
  else if (alertas.atrasadas.length) situacao = "atrasado";
  else if (lista.some((e) => situacaoEtapa(e, hoje) !== "futura")) situacao = "andamento";
  else situacao = "aIniciar";
  return { ...base, atrasadas: alertas.atrasadas.length, semana: alertas.semana.length, situacao };
}
