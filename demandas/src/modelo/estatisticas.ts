/** Números do painel (spec 5.5). Puro: recebe as demandas e devolve tudo calculado. */

import { type DataISO, diferencaDias } from "@comum/datas/dias";
import { chaveResponsavel } from "./filtro";
import { diasDeAtraso, prazoDe, type Situacao, situacaoDe } from "./situacao";
import type { Demanda } from "./tipos";

export interface LinhaAtrasada {
  id: string;
  titulo: string;
  diasAtraso: number;
  responsavel?: Demanda["responsavel"];
}
export interface CargaResponsavel {
  chave: string;
  nome: string;
  abertas: number;
  atrasadas: number;
  concluidas: number;
}
export interface Estatisticas {
  porSituacao: Record<Situacao, number>;
  atrasadas: LinhaAtrasada[];
  cargaPorResponsavel: CargaResponsavel[];
  entregasPorMes: Array<{ mes: string; noPrazo: number; foraDoPrazo: number }>;
  prazoMedioDias: number | null;
  percentualNoPrazo: number | null;
  estimadoMin: number;
  gastoMin: number;
  desvioMedioMin: number | null;
  notaMedia: number | null;
  distribuicaoNotas: [number, number, number, number, number];
}

export function calcularEstatisticas(lista: readonly Demanda[], o: { hoje: DataISO; desde?: DataISO }): Estatisticas {
  const porSituacao: Record<Situacao, number> = { nao_iniciada: 0, iniciada: 0, pausada: 0, concluida: 0, avaliada: 0, arquivada: 0 };
  const atrasadas: LinhaAtrasada[] = [];
  const carga = new Map<string, CargaResponsavel>();
  const meses = new Map<string, { noPrazo: number; foraDoPrazo: number }>();
  const notas: [number, number, number, number, number] = [0, 0, 0, 0, 0];
  let somaDias = 0;
  let nConcluidas = 0;
  let noPrazo = 0;
  let estimado = 0;
  let gasto = 0;
  let desvio = 0;
  let nDesvio = 0;
  let somaNotas = 0;
  let nNotas = 0;

  for (const d of lista) {
    const s = situacaoDe(d);
    // Período corta o que foi concluído antes dele; o que está aberto sempre entra.
    if (d.concluidaEm && o.desde && d.concluidaEm < o.desde) continue;
    porSituacao[s] += 1;
    const chave = chaveResponsavel(d.responsavel);
    const c = carga.get(chave) ?? { chave, nome: d.responsavel?.nome ?? "Sem responsável", abertas: 0, atrasadas: 0, concluidas: 0 };
    carga.set(chave, c);
    if (d.concluidaEm) {
      c.concluidas += 1;
      nConcluidas += 1;
      somaDias += diferencaDias(d.distribuidaEm, d.concluidaEm);
      const no = prazoDe(d, o.hoje) === "concluida_no_prazo";
      if (no) noPrazo += 1;
      const mes = d.concluidaEm.slice(0, 7);
      const m = meses.get(mes) ?? { noPrazo: 0, foraDoPrazo: 0 };
      if (no) m.noPrazo += 1;
      else m.foraDoPrazo += 1;
      meses.set(mes, m);
      if (d.tempoEstimadoMin !== undefined && d.tempoGastoMin !== undefined) {
        estimado += d.tempoEstimadoMin;
        gasto += d.tempoGastoMin;
        desvio += d.tempoGastoMin - d.tempoEstimadoMin;
        nDesvio += 1;
      }
    } else if (s !== "arquivada") {
      c.abertas += 1;
      if (prazoDe(d, o.hoje) === "atrasada") {
        c.atrasadas += 1;
        atrasadas.push({
          id: d.id,
          titulo: d.titulo,
          diasAtraso: diasDeAtraso(d, o.hoje),
          ...(d.responsavel ? { responsavel: d.responsavel } : {}),
        });
      }
    }
    if (d.avaliacao) {
      notas[d.avaliacao.nota - 1] = (notas[d.avaliacao.nota - 1] ?? 0) + 1;
      somaNotas += d.avaliacao.nota;
      nNotas += 1;
    }
  }

  return {
    porSituacao,
    atrasadas: atrasadas.sort((a, b) => b.diasAtraso - a.diasAtraso || (a.id < b.id ? -1 : 1)),
    cargaPorResponsavel: [...carga.values()].sort((a, b) => b.abertas - a.abertas || a.nome.localeCompare(b.nome, "pt-BR")),
    entregasPorMes: [...meses.entries()].sort(([a], [b]) => (a < b ? -1 : 1)).map(([mes, v]) => ({ mes, ...v })),
    prazoMedioDias: nConcluidas ? somaDias / nConcluidas : null,
    percentualNoPrazo: nConcluidas ? Math.round((noPrazo / nConcluidas) * 100) : null,
    estimadoMin: estimado,
    gastoMin: gasto,
    desvioMedioMin: nDesvio ? desvio / nDesvio : null,
    notaMedia: nNotas ? somaNotas / nNotas : null,
    distribuicaoNotas: notas,
  };
}
