/**
 * Regras do Cronograma que não dependem de tela: o que o arraste pode mexer e como lê as mudanças de datas da Frappe.
 * O desenho (lista + Gantt) fica em `app/componentes/vistaCronograma.ts`.
 */

import type { DataISO } from "@comum/datas/dias";
import type { MudancaDeDatas } from "@projetos/modelo/tipos";
import type { DemandaNaTela } from "../app/dados";

export const MSG_ENCERRADA = "Demanda encerrada: reabra para mudar as datas.";
export const MSG_GRUPO = "O grupo não tem datas próprias.";
export const MSG_INVERTIDA = "O prazo não pode ser antes da distribuição.";

/** Recusa (mensagem) a mudança que tocaria um grupo, uma demanda encerrada ou deixaria o fim antes do início. */
export function validarMudancas(porId: ReadonlyMap<string, DemandaNaTela>, mudancas: readonly MudancaDeDatas[]): string | null {
  for (const m of mudancas) {
    const alvo = porId.get(m.id);
    if (!alvo) return MSG_GRUPO;
    if (alvo.situacao === "concluida" || alvo.situacao === "avaliada" || alvo.situacao === "arquivada") return MSG_ENCERRADA;
    if (m.fim < m.inicio) return MSG_INVERTIDA;
  }
  return null;
}

export interface MudancaDaDemanda {
  alvo: DemandaNaTela;
  inicio: DataISO;
  fim: DataISO;
  mudouInicio: boolean;
  mudouFim: boolean;
}

/** Só as demandas cujas datas de fato mudaram (a Frappe pode devolver barras que apenas se mexeram na tela). */
export function mudancasDasDemandas(porId: ReadonlyMap<string, DemandaNaTela>, mudancas: readonly MudancaDeDatas[]): MudancaDaDemanda[] {
  const saida: MudancaDaDemanda[] = [];
  for (const m of mudancas) {
    const alvo = porId.get(m.id);
    if (!alvo) continue;
    const mudouInicio = m.inicio !== alvo.demanda.distribuidaEm;
    const mudouFim = m.fim !== alvo.demanda.prazo;
    if (mudouInicio || mudouFim) saida.push({ alvo, inicio: m.inicio, fim: m.fim, mudouInicio, mudouFim });
  }
  return saida;
}
