/**
 * Ícones próprios do gestor de projetos (os comuns, inclusive o "gantt", vêm de
 * `@comum/ui/dom`): o modelo, o checklist, o progresso, voltar e abrir, e os ícones de
 * situação da etapa (tela 1). Tudo por `createElementNS`; as cores
 * de situação ficam no CSS (`.prj-st-*`), para valerem nos dois temas.
 */

import type { SituacaoEtapa } from "../modelo/situacao";

const NS = "http://www.w3.org/2000/svg";
type Forma = [string, Record<string, string>];

const FORMAS = {
  modelo: [
    ["rect", { x: "4", y: "4", width: "16", height: "16", rx: "2" }],
    ["path", { d: "M4 9.5h16M9.5 9.5V20" }],
  ],
  checklist: [["path", { d: "m4 7 2 2 3.5-3.5M4 15l2 2 3.5-3.5M13 8h7M13 16h7" }]],
  progresso: [
    ["path", { d: "M4 12a8 8 0 1 0 8-8" }],
    ["path", { d: "M12 4v8l5 3" }],
  ],
  // Lateral (P5): voltar aos projetos e "Abrir no painel"/"Ver no projeto".
  voltar: [["path", { d: "m15 6-6 6 6 6" }]],
  abrir: [
    ["path", { d: "M14 4h6v6M20 4l-9 9" }],
    ["path", { d: "M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" }],
  ],
} satisfies Record<string, Forma[]>;

export type NomeIconeProjetos = keyof typeof FORMAS;

function svg(tamanho: number, caixa: string, attrs: Record<string, string>): SVGSVGElement {
  const el = document.createElementNS(NS, "svg");
  const base: Record<string, string> = {
    viewBox: caixa,
    width: String(tamanho),
    height: String(tamanho),
    "aria-hidden": "true",
    focusable: "false",
    ...attrs,
  };
  for (const [k, v] of Object.entries(base)) el.setAttribute(k, v);
  return el;
}

function forma(tag: string, attrs: Record<string, string>): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
}

export function iconeProjetos(nome: NomeIconeProjetos, tamanho = 18): SVGSVGElement {
  const el = svg(tamanho, "0 0 24 24", {
    fill: "none",
    stroke: "currentColor",
    "stroke-width": "1.8",
    "stroke-linecap": "round",
    "stroke-linejoin": "round",
    class: "spro-icone",
  });
  for (const [tag, attrs] of FORMAS[nome] as Forma[]) el.append(forma(tag, attrs));
  return el;
}

/** Ícone de situação da linha da etapa (16 px): círculo cheio, metade, tracejado; losango no marco. */
export function iconeSituacao(situacao: SituacaoEtapa, marco: boolean): SVGSVGElement {
  const el = svg(16, "0 0 16 16", { class: `prj-st prj-st-${situacao}${marco ? " prj-st-marco" : ""}` });
  if (marco) {
    el.append(forma("path", { class: "prj-st-cor", d: situacao === "concluida" ? "M8 1.5 14.5 8 8 14.5 1.5 8z" : "M8 2 14 8 8 14 2 8z" }));
    return el;
  }
  if (situacao === "concluida") {
    el.append(
      forma("circle", { class: "prj-st-cor", cx: "8", cy: "8", r: "7" }),
      forma("path", { class: "prj-st-sinal", d: "m4.8 8.2 2.1 2.1 4.3-4.4" }),
    );
  } else if (situacao === "atrasada") {
    el.append(
      forma("circle", { class: "prj-st-cor", cx: "8", cy: "8", r: "7" }),
      forma("path", { class: "prj-st-sinal", d: "M8 4.2v4.6" }),
      forma("circle", { class: "prj-st-ponto", cx: "8", cy: "11.4", r: "1" }),
    );
  } else if (situacao === "andamento") {
    el.append(
      forma("circle", { class: "prj-st-cor", cx: "8", cy: "8", r: "6.2" }),
      forma("path", { class: "prj-st-meio", d: "M8 1.8a6.2 6.2 0 0 1 0 12.4z" }),
    );
  } else {
    el.append(forma("circle", { class: "prj-st-cor", cx: "8", cy: "8", r: "6.2" }));
  }
  return el;
}
