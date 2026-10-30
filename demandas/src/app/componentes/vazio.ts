/** Primeiro uso: nenhuma demanda ainda. */

import { h, icone } from "@comum/ui/dom";

export function montarVazio(o: { aoCriar(): void; desabilitado?: string }): HTMLElement {
  return h(
    "div",
    { class: "dem-vazio" },
    icone("check", 40),
    h("h3", {}, "Crie a primeira demanda"),
    h("p", {}, "Registre o que precisa ser feito, atribua a um responsável e acompanhe o prazo na tabela, no quadro ou no cronograma."),
    h(
      "button",
      {
        type: "button",
        class: "spro-botao primario",
        disabled: o.desabilitado !== undefined,
        title: o.desabilitado,
        onclick: o.aoCriar,
      },
      icone("mais", 15),
      "Nova demanda",
    ),
  );
}

export function montarNada(texto: string, acao?: { rotulo: string; fazer(): void }): HTMLElement {
  return h(
    "div",
    { class: "dem-nada" },
    h("span", {}, texto),
    acao ? h("button", { type: "button", class: "spro-botao fantasma pequeno", onclick: acao.fazer }, acao.rotulo) : null,
  );
}
