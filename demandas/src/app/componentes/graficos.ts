/**
 * Gráficos do painel, em SVG puro (sem biblioteca). O `h()` não cria SVG: `svg()` usa `createElementNS`.
 * Regras: cor só dos tokens `--spro-*` (classes `dem-tom-*` no CSS), texto sempre em tokens de texto, 2 px de
 * espaço entre os segmentos, nunca só a cor (cada parte tem `<title>` e, quando cabe, o número), `role="img"` com
 * `aria-label` que resume o gráfico em texto.
 */

import { h } from "@comum/ui/dom";
import type { Estatisticas } from "../../modelo/estatisticas";

const NS = "http://www.w3.org/2000/svg";

export function svg(
  tag: string,
  attrs: Record<string, string | number> = {},
  ...filhos: Array<Node | string | null | undefined>
): SVGElement {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  for (const f of filhos) if (f !== null && f !== undefined) el.append(f);
  return el as SVGElement;
}

const GAP = 2;
const titulo = (t: string): SVGElement => svg("title", {}, t);
const curto = (t: string, n: number): string => (t.length > n ? `${t.slice(0, n - 1)}…` : t);

export interface ParteDaBarra {
  valor: number;
  /** Sufixo da classe `dem-tom-*` (a cor vem do token no CSS). */
  tom: string;
  titulo: string;
}
export interface LinhaDeBarras {
  rotulo: string;
  partes: ParteDaBarra[];
  /** Chave que o app usa ao clicar na linha (vai em `data-chave`). */
  chave?: string;
  destacada?: boolean;
}

/** Barras horizontais empilhadas, uma por linha. A escala é a mesma em todas (a maior soma ocupa a faixa toda). */
export function barrasEmpilhadas(o: { linhas: LinhaDeBarras[]; rotuloEixo?: string }): SVGElement {
  const LARGURA = 520;
  const COL_ROTULO = 130;
  const COL_TOTAL = 34;
  const ALTURA_LINHA = 30;
  const trilho = LARGURA - COL_ROTULO - COL_TOTAL;
  const max = Math.max(1, ...o.linhas.map((l) => l.partes.reduce((s, p) => s + p.valor, 0)));
  const altura = Math.max(1, o.linhas.length) * ALTURA_LINHA + 4;
  const resumo = o.linhas.map((l) => `${l.rotulo}: ${l.partes.map((p) => `${p.valor} ${p.titulo}`).join(", ")}`).join("; ");
  const raiz = svg("svg", {
    class: "dem-grafico dem-barras",
    viewBox: `0 0 ${LARGURA} ${altura}`,
    role: "img",
    "aria-label": `${o.rotuloEixo ?? "Barras"}. ${resumo || "Sem dados"}`,
  });
  o.linhas.forEach((l, i) => {
    const y = 2 + i * ALTURA_LINHA;
    const total = l.partes.reduce((s, p) => s + p.valor, 0);
    const g = svg("g", {
      class: `dem-barra-linha${l.chave !== undefined ? " dem-clicavel" : ""}${l.destacada ? " dem-destacada" : ""}`,
      ...(l.chave !== undefined ? { "data-chave": l.chave } : {}),
    });
    g.append(
      titulo(`${l.rotulo}: ${l.partes.map((p) => `${p.valor} ${p.titulo}`).join(", ")}`),
      svg("rect", { class: "dem-barra-fundo", x: 0, y, width: LARGURA, height: ALTURA_LINHA - 2, rx: 4 }),
      svg("text", { class: "dem-g-rotulo", x: 6, y: y + 17 }, curto(l.rotulo, 18)),
    );
    const visiveis = l.partes.filter((p) => p.valor > 0);
    let x = COL_ROTULO;
    for (const p of visiveis) {
      const largura = Math.max(3, (p.valor / max) * trilho - (visiveis.length > 1 ? GAP : 0));
      g.append(
        svg("rect", { class: `dem-tom-${p.tom}`, x, y: y + 5, width: largura, height: 16, rx: 3 }, titulo(`${p.valor} ${p.titulo}`)),
      );
      if (largura >= 20)
        g.append(svg("text", { class: "dem-g-valor-dentro", x: x + largura / 2, y: y + 17, "text-anchor": "middle" }, String(p.valor)));
      x += largura + GAP;
    }
    g.append(svg("text", { class: "dem-g-total", x: LARGURA - 6, y: y + 17, "text-anchor": "end" }, String(total)));
    raiz.append(g);
  });
  return raiz;
}

const MESES_CURTOS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const rotuloMes = (mes: string): string => {
  const [a, m] = mes.split("-");
  return `${MESES_CURTOS[Number(m) - 1] ?? m}/${(a ?? "").slice(2)}`;
};

/** Colunas empilhadas por mês (no prazo e fora do prazo); mostra os últimos 12 meses com entrega. */
export function colunasPorMes(meses: Estatisticas["entregasPorMes"]): SVGElement {
  const lista = meses.slice(-12);
  const LARGURA = 520;
  const ALTURA = 170;
  const BASE = ALTURA - 24;
  const TOPO = 18;
  const passo = LARGURA / Math.max(lista.length, 1);
  const largura = Math.min(36, passo - 10);
  const max = Math.max(1, ...lista.map((m) => m.noPrazo + m.foraDoPrazo));
  const resumo = lista.map((m) => `${rotuloMes(m.mes)}: ${m.noPrazo} no prazo, ${m.foraDoPrazo} fora do prazo`).join("; ");
  const raiz = svg("svg", {
    class: "dem-grafico dem-colunas",
    viewBox: `0 0 ${LARGURA} ${ALTURA}`,
    role: "img",
    "aria-label": `Entregas por mês. ${resumo || "Sem entregas"}`,
  });
  raiz.append(svg("line", { class: "dem-g-base", x1: 0, x2: LARGURA, y1: BASE, y2: BASE }));
  lista.forEach((m, i) => {
    const cx = passo * i + passo / 2;
    const x = cx - largura / 2;
    const total = m.noPrazo + m.foraDoPrazo;
    const util = BASE - TOPO;
    const altNo = (m.noPrazo / max) * util;
    const altFora = (m.foraDoPrazo / max) * util;
    const g = svg(
      "g",
      { class: "dem-coluna-mes", "data-mes": m.mes },
      titulo(`${rotuloMes(m.mes)}: ${m.noPrazo} no prazo, ${m.foraDoPrazo} fora do prazo`),
    );
    if (m.noPrazo)
      g.append(
        svg(
          "rect",
          { class: "dem-tom-noprazo", x, y: BASE - altNo, width: largura, height: Math.max(altNo - (m.foraDoPrazo ? GAP : 0), 2), rx: 3 },
          titulo(`${m.noPrazo} no prazo`),
        ),
      );
    if (m.foraDoPrazo)
      g.append(
        svg(
          "rect",
          { class: "dem-tom-foraprazo", x, y: BASE - altNo - altFora, width: largura, height: Math.max(altFora, 2), rx: 3 },
          titulo(`${m.foraDoPrazo} fora do prazo`),
        ),
      );
    g.append(
      svg("text", { class: "dem-g-total", x: cx, y: BASE - altNo - altFora - 4, "text-anchor": "middle" }, String(total)),
      svg("text", { class: "dem-g-eixo", x: cx, y: ALTURA - 8, "text-anchor": "middle" }, rotuloMes(m.mes)),
    );
    raiz.append(g);
  });
  return raiz;
}

/** Distribuição das notas de 1 a 5: uma linha por nota, com a barra proporcional e o número. */
export function estrelas(distribuicao: [number, number, number, number, number]): HTMLElement {
  const max = Math.max(1, ...distribuicao);
  const resumo = distribuicao.map((n, i) => `${i + 1} ${i === 0 ? "estrela" : "estrelas"}: ${n}`).join(", ");
  const linhas = [4, 3, 2, 1, 0].map((i) => {
    const n = distribuicao[i] ?? 0;
    const barra = h("span", { class: "dem-tom-nota" });
    barra.style.width = `${(n / max) * 100}%`;
    return h(
      "div",
      { class: "dem-nota-linha", "data-nota": String(i + 1), title: `${i + 1} ${i === 0 ? "estrela" : "estrelas"}: ${n}` },
      h("span", { class: "dem-nota-rotulo" }, `${i + 1} ★`),
      h("span", { class: "dem-nota-trilho" }, barra),
      h("span", { class: "dem-nota-n" }, String(n)),
    );
  });
  return h("div", { class: "dem-notas", role: "img", "aria-label": `Distribuição das notas. ${resumo}` }, ...linhas);
}
