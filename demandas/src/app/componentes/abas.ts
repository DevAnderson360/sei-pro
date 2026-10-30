/** As quatro visões: Tabela, Quadro, Cronograma e Painel. */

import { h, icone, type NomeIcone } from "@comum/ui/dom";
import type { PreferenciasDemandas } from "../../preferencias";

export type Visao = PreferenciasDemandas["visao"];

export const VISOES: ReadonlyArray<{ id: Visao; rotulo: string; icone: NomeIcone }> = [
  { id: "tabela", rotulo: "Tabela", icone: "planilha" },
  { id: "quadro", rotulo: "Quadro", icone: "camadas" },
  { id: "cronograma", rotulo: "Cronograma", icone: "gantt" },
  { id: "painel", rotulo: "Painel", icone: "painel" },
];

export function montarAbas(o: { visao: Visao; aoEscolher(v: Visao): void }): HTMLElement {
  return h(
    "div",
    { class: "dem-abas" },
    h(
      "div",
      { class: "spro-segmentado", role: "tablist", "aria-label": "Visões" },
      ...VISOES.map((v) =>
        h(
          "button",
          {
            type: "button",
            role: "tab",
            "aria-selected": String(v.id === o.visao),
            "data-aba": v.id,
            onclick: () => o.aoEscolher(v.id),
          },
          icone(v.icone, 15),
          v.rotulo,
        ),
      ),
    ),
  );
}
