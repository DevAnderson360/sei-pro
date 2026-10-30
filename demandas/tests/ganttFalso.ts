/**
 * Controlador do Gantt de mentira para as provas do app: a Frappe de verdade
 * precisa do ambiente do linkedom com medidas (ambienteGantt.ts); aqui só se
 * anota o que o app pediu (montar, atualizar, escala, realce, hoje, destruir).
 */

import { type Escala, MODOS } from "@projetos/gantt/escalas";
import type { Linha } from "@projetos/gantt/linhas";
import type { ControleGantt, montarGantt, OpcoesGantt } from "@projetos/gantt/montar";

export interface Anotacoes {
  montagens: number;
  linhas: Linha[][];
  escalas: Escala[];
  realces: string[];
  hoje: number;
  destruidos: number;
  /** Chamadas de `render()` da Frappe de mentira. */
  renders: number;
}

/** Frappe de mentira com as medidas que o preenchimento de largura lê. */
export interface MedidasFalsas {
  colunas: number;
  /** `clientWidth` do contêiner (mutável: simula a janela). */
  largura: number;
}

export function ganttFalso(o: { falhar?: boolean; medidas?: MedidasFalsas } = {}) {
  const a: Anotacoes = { montagens: 0, linhas: [], escalas: [], realces: [], hoje: 0, destruidos: 0, renders: 0 };
  let opcoes: OpcoesGantt | null = null;
  const montar: typeof montarGantt = (area, linhas, op): ControleGantt => {
    a.montagens += 1;
    opcoes = op;
    area.classList.add("spro-gantt");
    if (o.falhar) op.aoFalhar?.(new Error("Frappe quebrou"));
    else a.linhas.push([...linhas]);
    let escala = op.escala;
    const base = () => MODOS.find((m) => m.name === escala)?.column_width ?? 28;
    const frappe = o.medidas
      ? {
          dates: new Array(o.medidas.colunas).fill(0),
          config: { column_width: base() },
          // A largura segue a janela simulada (`medidas.largura`), como o `clientWidth` de verdade.
          $container: {
            get clientWidth() {
              return o.medidas?.largura ?? 0;
            },
            set clientWidth(_v: number) {},
            scrollLeft: 0,
          },
          render() {
            a.renders += 1;
          },
        }
      : null;
    // A Frappe de verdade refaz tudo (e volta à coluna da escala) ao trocar a escala ou atualizar.
    const refazer = () => {
      if (!frappe || !o.medidas) return;
      frappe.config.column_width = base();
      frappe.$container.clientWidth = o.medidas.largura;
    };
    if (frappe) frappe.$container.clientWidth = o.medidas?.largura ?? 0;
    return {
      get escala() {
        return escala;
      },
      gantt: frappe as unknown as ControleGantt["gantt"],
      trocarEscala(e) {
        escala = e;
        a.escalas.push(e);
        refazer();
      },
      atualizar(l) {
        a.linhas.push([...l]);
        refazer();
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
