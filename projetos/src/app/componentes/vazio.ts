/** Primeiro uso (tela 2, cena 4): nenhum projeto ativo na unidade. */

import { h, icone } from "@comum/ui/dom";
import { iconeProjetos } from "../icones";

export interface OpcoesVazio {
  aoCriar(): void;
  aoModelo(): void;
  /** Só com servidor do Atividades configurado e a importação do P4. */
  aoImportar?: () => void;
}

const NS = "http://www.w3.org/2000/svg";

function desenho(): SVGSVGElement {
  const svg = document.createElementNS(NS, "svg");
  for (const [k, v] of Object.entries({ width: "132", height: "70", viewBox: "0 0 132 70", fill: "none", "aria-hidden": "true" }))
    svg.setAttribute(k, v);
  const pecas: Array<[string, Record<string, string>]> = [
    ["rect", { class: "prj-vazio-ok", x: "4", y: "6", width: "48", height: "10", rx: "5" }],
    ["rect", { class: "prj-vazio-andamento", x: "40", y: "24", width: "56", height: "10", rx: "5" }],
    ["rect", { class: "prj-vazio-futura", x: "70", y: "42", width: "44", height: "10", rx: "5" }],
    ["path", { class: "prj-vazio-marco", d: "M122 47l6 6-6 6-6-6z" }],
    ["path", { class: "prj-vazio-seta", d: "M52 11h-6v18h-6" }],
    ["path", { class: "prj-vazio-seta", d: "M96 29h-6v18h-6" }],
    ["line", { class: "prj-vazio-hoje", x1: "64", y1: "0", x2: "64", y2: "70" }],
  ];
  for (const [tag, attrs] of pecas) {
    const el = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}

export function montarVazio(o: OpcoesVazio): HTMLElement {
  return h(
    "div",
    { class: "prj-vazio" },
    desenho(),
    h("h3", {}, "Acompanhe um trabalho do começo ao fim"),
    h(
      "p",
      {},
      "Divida em etapas, ponha as datas e veja tudo numa linha do tempo. Serve para uma revisão de norma, uma contratação, um plano anual…",
    ),
    h(
      "div",
      { class: "prj-vazio-botoes" },
      h("button", { type: "button", class: "spro-botao primario", onclick: o.aoCriar }, icone("mais", 15), "Criar projeto"),
      h("button", { type: "button", class: "spro-botao", onclick: o.aoModelo }, iconeProjetos("modelo", 15), "Começar de um modelo"),
    ),
    o.aoImportar
      ? h(
          "a",
          {
            href: "#",
            onclick: (ev: Event) => {
              ev.preventDefault();
              o.aoImportar?.();
            },
          },
          "Importar meus projetos do servidor do Atividades",
        )
      : null,
  );
}
