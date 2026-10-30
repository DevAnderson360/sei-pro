/**
 * Linhas → tarefas da Frappe. Cada linha vira exatamente UMA tarefa válida,
 * senão a lista à esquerda desalinha do Gantt: a Frappe descarta tarefa sem
 * data, com término antes do início ou com mais de 10 anos.
 */

import { hojeISO, somarDias } from "@comum/datas/dias";
import { ANO_MAX, ANO_MIN, dataValida, LIMITE_DIAS_ETAPA } from "../modelo/calendario";
import type { DataISO } from "../modelo/tipos";
import type { TarefaFrappe } from "../vendor/frappe-gantt/index";
import type { Linha } from "./linhas";

/** Teto de desenho: o mesmo da etapa (a Frappe recusa mais de 10 anos; `LIMITE_DIAS_ETAPA` fica abaixo). */
const TETO_DIAS = LIMITE_DIAS_ETAPA;

export function classesDaLinha(l: Linha): string {
  if (l.tipo === "fase") return l.resumo.total ? "st-fase" : "st-fase st-vazia";
  if (l.tipo === "projeto") {
    const s = l.resumo.situacao;
    const st =
      s === "concluido"
        ? "st-concluida"
        : s === "atrasado"
          ? "st-atrasada"
          : s === "andamento"
            ? "st-andamento"
            : s === "aIniciar"
              ? "st-futura"
              : "st-vazia";
    return `st-proj ${st}`;
  }
  return l.etapa.marco ? `st-marco st-${l.situacao}` : `st-${l.situacao}`;
}

const PRIMEIRO_DIA = `${ANO_MIN}-01-01`;
const ULTIMO_DIA = `${ANO_MAX}-12-31`;
const preso = (d: DataISO): DataISO => (d < PRIMEIRO_DIA ? PRIMEIRO_DIA : d > ULTIMO_DIA ? ULTIMO_DIA : d);

/**
 * Dado de fora malformado: data inexistente vira barra de 1 dia na outra data
 * da linha; sem nenhuma válida, em hoje (a linha nunca some nem derruba o Gantt).
 */
function datasDesenhaveis(inicio: DataISO, fim: DataISO): { start: DataISO; end: DataISO } {
  const okInicio = dataValida(inicio);
  const okFim = dataValida(fim);
  const ini = okInicio ? inicio : okFim ? fim : hojeISO();
  const fi = okFim ? fim : ini;
  const end = fi < ini ? ini : fi;
  // Presas à faixa do calendário (2000 a 2100): o Gantt nunca tem mais de ~100 anos, e "Ano" sempre cabe.
  const start = preso(ini);
  const fimPreso = preso(end);
  const teto = somarDias(start, TETO_DIAS);
  return { start, end: fimPreso > teto ? teto : fimPreso };
}

export function tarefasDoGantt(linhas: readonly Linha[]): TarefaFrappe[] {
  return linhas.map((l) => {
    if (l.tipo === "etapa") {
      return {
        id: l.id,
        name: l.etapa.nome,
        ...datasDesenhaveis(l.etapa.inicio, l.etapa.fim),
        progress: l.etapa.marco ? 0 : l.progresso,
        dependencies: l.dependeDe.join(","),
        custom_class: classesDaLinha(l),
      };
    }
    const nome = l.tipo === "fase" ? l.fase.nome : l.projeto.nome;
    const progresso = l.resumo.progresso;
    return {
      id: l.id,
      name: nome,
      ...datasDesenhaveis(l.inicio, l.fim),
      progress: progresso,
      dependencies: "",
      custom_class: classesDaLinha(l),
    };
  });
}
