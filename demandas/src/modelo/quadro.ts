/** O quadro (spec 5.3): as colunas e o que o arrastar faz. Puro. */

import { type DataISO, diferencaDias } from "@comum/datas/dias";
import type { DemandaNaTela } from "../app/dados";
import { dadosQueOMovimentoPede, movimentoPermitido } from "./operacoes";
import type { Situacao } from "./situacao";
import { situacaoBase, situacaoDe } from "./situacao";
import type { Demanda } from "./tipos";

export const COLUNAS_DO_QUADRO: readonly Situacao[] = ["nao_iniciada", "iniciada", "pausada", "concluida", "avaliada"];

export type PlanoMovimento =
  | { tipo: "aplicar" }
  | { tipo: "pedir"; dados: "conclusao" | "avaliacao" }
  | { tipo: "recusar"; mensagem: string };

export function colunasDoQuadro(
  itens: readonly DemandaNaTela[],
  o: { hoje: DataISO; mostrarArquivadas: boolean; concluidasDias: number },
): Record<Situacao, DemandaNaTela[]> {
  const colunas: Record<Situacao, DemandaNaTela[]> = {
    nao_iniciada: [],
    iniciada: [],
    pausada: [],
    concluida: [],
    avaliada: [],
    arquivada: [],
  };
  for (const x of itens) {
    if (x.situacao === "arquivada" && !o.mostrarArquivadas) continue;
    const feita = x.situacao === "concluida" || x.situacao === "avaliada";
    // Concluídas e avaliadas só mostram os últimos N dias; o resto fica na Tabela e no filtro "Arquivadas".
    if (feita && x.demanda.concluidaEm && diferencaDias(x.demanda.concluidaEm, o.hoje) > o.concluidasDias) continue;
    colunas[x.situacao].push(x);
  }
  return colunas;
}

export function planoDoMovimento(d: Demanda, destino: Situacao): PlanoMovimento {
  const de = situacaoDe(d);
  if (de === destino) return { tipo: "recusar", mensagem: "" };
  if (!movimentoPermitido(de, destino)) return { tipo: "recusar", mensagem: "Esse movimento não é permitido. Use o menu da demanda." };
  // Desarquivar volta ao estado de antes (derivado das datas): a outra coluna nao vale.
  if (de === "arquivada" && situacaoBase(d) !== destino)
    return { tipo: "recusar", mensagem: "A demanda volta ao estado de antes de ser arquivada." };
  const dados = dadosQueOMovimentoPede(de, destino);
  return dados ? { tipo: "pedir", dados } : { tipo: "aplicar" };
}
