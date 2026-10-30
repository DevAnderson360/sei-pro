/** O cartão do quadro: prioridade, título, etiquetas (até 3), responsável, prazo, checklist e selo do escopo. */

import type { DataISO } from "@comum/datas/dias";
import { avatar } from "@comum/ui/avatar";
import { h, icone } from "@comum/ui/dom";
import { criarMenu, type EntradaMenu } from "@comum/ui/menu";
import type { DemandaNaTela } from "../dados";
import { barraDoChecklist, marcaDePrioridade, pilulaDoPrazo, seloDoEscopo } from "./pilulas";

export interface OpcoesCartao {
  hoje: DataISO;
  /** As entradas do menu de ações (o clique no cartão e o Enter abrem este menu). */
  itensDoMenu(): EntradaMenu[];
  /** Alt+seta para cima (-1) ou para baixo (1): reordena na coluna pelo teclado. */
  aoMoverNaColuna?(delta: -1 | 1): void;
}

export function montarCartao(x: DemandaNaTela, o: OpcoesCartao): HTMLElement {
  const d = x.demanda;
  const menu = criarMenu({
    rotulo: "Ações da demanda",
    icone: "menu",
    classe: "spro-botao-icone pequeno dem-cartao-menu",
    itens: o.itensDoMenu,
  });
  const etiquetas = d.etiquetas.length
    ? h(
        "div",
        { class: "dem-cartao-etiquetas" },
        ...d.etiquetas.slice(0, 3).map((e) => h("span", { class: "dem-etiqueta" }, e)),
        d.etiquetas.length > 3
          ? h("span", { class: "dem-etiqueta dem-etiqueta-mais", title: d.etiquetas.slice(3).join(", ") }, `+${d.etiquetas.length - 3}`)
          : null,
      )
    : null;
  const cartao = h(
    "article",
    {
      class: `dem-cartao${x.situacao === "arquivada" ? " dem-arquivada" : ""}`,
      draggable: "true",
      "data-id": d.id,
      "data-vis": x.vis,
      tabindex: "0",
    },
    marcaDePrioridade(d.prioridade),
    h(
      "div",
      { class: "dem-cartao-corpo" },
      h("div", { class: "dem-cartao-topo" }, h("span", { class: "dem-cartao-titulo" }, d.titulo), menu),
      d.etapa
        ? h(
            "div",
            { class: "dem-cartao-etapa", title: `Etapa do projeto: ${d.etapa.rotulo}` },
            icone("gantt", 12),
            h("span", {}, d.etapa.rotulo),
          )
        : null,
      etiquetas,
      h(
        "div",
        { class: "dem-cartao-base" },
        pilulaDoPrazo(x, o.hoje),
        barraDoChecklist(d),
        seloDoEscopo(x.vis),
        d.responsavel ? h("span", { class: "dem-cartao-resp" }, avatar(d.responsavel.nome, { tamanho: 20 })) : null,
      ),
    ),
  );
  const interativo = (el: EventTarget | null) => !!(el as Element | null)?.closest?.("a, button, input, textarea, [role='combobox']");
  cartao.addEventListener("click", (ev) => {
    if (!interativo(ev.target)) menu.click();
  });
  cartao.addEventListener("keydown", (ev) => {
    if (ev.target !== cartao) return;
    if (ev.key === "Enter") {
      ev.preventDefault();
      menu.click();
    } else if (ev.altKey && (ev.key === "ArrowUp" || ev.key === "ArrowDown")) {
      ev.preventDefault();
      o.aoMoverNaColuna?.(ev.key === "ArrowUp" ? -1 : 1);
    }
  });
  return cartao;
}
