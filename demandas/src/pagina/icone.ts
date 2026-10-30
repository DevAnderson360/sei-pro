/**
 * O ícone colorido do Gestor de Demandas (pessoa em círculo coral com selo verde de check), em formas chapadas. Serve ao
 * botão da barra de ações do processo (40 px, como os vizinhos) e ao título do painel do Controle (24 px). DOM seguro:
 * `createElementNS`, nunca `innerHTML`. A paleta é fechada (`PALETA_ICONE`): o teste reprova cor fora dela.
 */

export const PALETA_ICONE = ["#F2814F", "#fff", "#3FA672", "#2B5FB4"] as const;

const NS = "http://www.w3.org/2000/svg";

type Forma = readonly [string, Readonly<Record<string, string>>];

const FORMAS: readonly Forma[] = [
  ["circle", { cx: "20", cy: "20", r: "16", fill: "#F2814F" }],
  ["circle", { cx: "17", cy: "15", r: "4.6", fill: "#fff" }],
  ["path", { d: "M8.6 29.5a8.4 7 0 0 1 16.8 0z", fill: "#fff" }],
  ["circle", { cx: "29", cy: "29", r: "8.4", fill: "#3FA672", stroke: "#fff", "stroke-width": "1.4" }],
  [
    "path",
    {
      d: "M24.5 29.2l3.2 3.2 5.2-6",
      stroke: "#fff",
      "stroke-width": "2.6",
      fill: "none",
      "stroke-linecap": "round",
      "stroke-linejoin": "round",
    },
  ],
];

export function iconeColoridoDemandas(doc: Document, tamanho = 40): SVGSVGElement {
  const svg = doc.createElementNS(NS, "svg") as SVGSVGElement;
  svg.setAttribute("viewBox", "0 0 40 40");
  svg.setAttribute("width", String(tamanho));
  svg.setAttribute("height", String(tamanho));
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  for (const [tag, attrs] of FORMAS) {
    const el = doc.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
    svg.append(el);
  }
  return svg;
}
