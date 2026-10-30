/** Cabeçalho: título, escopo (As duas | Toda a unidade | Só eu), Nova demanda e o menu de ajustes. */

import { h, icone } from "@comum/ui/dom";
import type { PreferenciasDemandas } from "../../preferencias";
import type { Indicador } from "../estadoSincronia";

export type EscopoNaTela = PreferenciasDemandas["escopo"];

export interface OpcoesCabecalho {
  escopo: EscopoNaTela;
  /** Texto que explica por que "Nova demanda" está desabilitada; ausente = habilitada. */
  novaDesabilitada?: string;
  /** O estado da sincronia (com a colaboração ligada): clicar abre o diálogo Sincronização. */
  indicador?: Indicador;
  aoIndicador?(): void;
  menu: HTMLElement;
  /** No painel embutido o título é do painel do SEI: o app não o repete. */
  semTitulo?: boolean;
  aoEscopo(e: EscopoNaTela): void;
  aoNova(): void;
}

const ESCOPOS: ReadonlyArray<[EscopoNaTela, string]> = [
  ["ambos", "As duas"],
  ["unidade", "Toda a unidade"],
  ["eu", "Só eu"],
];

export function montarCabecalho(o: OpcoesCabecalho): HTMLElement {
  return h(
    "div",
    { class: "dem-cab" },
    o.semTitulo ? null : h("h2", { class: "dem-titulo" }, "Demandas"),
    h(
      "div",
      { class: "dem-ctl" },
      h(
        "div",
        { class: "spro-segmentado", role: "group", "aria-label": "Quem vê" },
        ...ESCOPOS.map(([id, rotulo]) =>
          h(
            "button",
            { type: "button", "aria-pressed": String(id === o.escopo), "data-escopo": id, onclick: () => o.aoEscopo(id) },
            rotulo,
          ),
        ),
      ),
      h(
        "button",
        {
          type: "button",
          class: "spro-botao primario dem-nova",
          disabled: o.novaDesabilitada !== undefined,
          title: o.novaDesabilitada,
          onclick: o.aoNova,
        },
        icone("mais", 15),
        "Nova demanda",
      ),
      o.indicador
        ? h(
            "button",
            {
              type: "button",
              class: "dem-sinc",
              "data-tom": o.indicador.tom,
              title: o.indicador.dica,
              "aria-label": `Sincronização: ${o.indicador.rotulo}`,
              onclick: () => o.aoIndicador?.(),
            },
            icone("nuvem", 14),
            h("span", { class: "dem-sinc-rotulo" }, o.indicador.rotulo),
          )
        : null,
      o.menu,
    ),
  );
}
