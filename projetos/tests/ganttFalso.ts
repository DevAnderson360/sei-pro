/**
 * Controlador do Gantt de mentira para as provas do app: a Frappe de verdade
 * precisa do ambiente do linkedom com medidas (ambienteGantt.ts); aqui só se
 * anota o que o app pediu (montar, atualizar, escala, realce, hoje, destruir).
 */

import type { Escala } from "../src/gantt/escalas";
import type { Linha } from "../src/gantt/linhas";
import type { ControleGantt, montarGantt, OpcoesGantt } from "../src/gantt/montar";

export interface Anotacoes {
  montagens: number;
  linhas: Linha[][];
  escalas: Escala[];
  realces: string[];
  hoje: number;
  destruidos: number;
}

export function ganttFalso(o: { falhar?: boolean } = {}) {
  const a: Anotacoes = { montagens: 0, linhas: [], escalas: [], realces: [], hoje: 0, destruidos: 0 };
  let opcoes: OpcoesGantt | null = null;
  const montar: typeof montarGantt = (area, linhas, op): ControleGantt => {
    a.montagens += 1;
    opcoes = op;
    area.classList.add("spro-gantt");
    if (o.falhar) op.aoFalhar?.(new Error("Frappe quebrou"));
    else a.linhas.push([...linhas]);
    let escala = op.escala;
    return {
      get escala() {
        return escala;
      },
      gantt: null,
      trocarEscala(e) {
        escala = e;
        a.escalas.push(e);
      },
      atualizar(l) {
        a.linhas.push([...l]);
      },
      rolarParaHoje() {
        a.hoje += 1;
      },
      realcar(id, ligado) {
        a.realces.push(`${id}:${ligado}`);
      },
      destruir() {
        a.destruidos += 1;
      },
    };
  };
  return { montar, a, opcoes: () => opcoes };
}
