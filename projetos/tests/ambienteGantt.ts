/**
 * Ambiente linkedom para a Frappe Gantt. O linkedom não tem layout: `getBBox`
 * mede o texto por 6 px/caractere, `scrollTo` não faz nada, as medidas do
 * elemento são 0 (a rolagem guarda o valor) e
 * `requestAnimationFrame` vira `setTimeout(0)` (use `esperarQuadro()`). O
 * `classList.add` recusa token com espaço, como o navegador (prova do ajuste 2).
 */

import { parseHTML } from "linkedom";

type Global = Record<string, unknown>;

export function instalarAmbienteGantt(): Document {
  const { window, document } = parseHTML("<!doctype html><html><body><div id='area'></div></body></html>");
  const g = globalThis as unknown as Global;
  g.window = window;
  g.document = document;
  g.HTMLElement = window.HTMLElement;
  g.SVGElement = window.SVGElement;
  if (typeof (globalThis as Global).navigator === "undefined")
    Object.defineProperty(globalThis, "navigator", { value: { userAgent: "linkedom" }, configurable: true });
  g.requestAnimationFrame = (cb: (t: number) => void) => setTimeout(() => cb(Date.now()), 0);
  const svgProto = window.SVGElement.prototype as unknown as Record<string, unknown>;
  svgProto.getBBox = function (this: Element) {
    const largura = this.tagName.toLowerCase() === "text" ? (this.textContent ?? "").length * 6 : Number(this.getAttribute("width")) || 0;
    return { x: Number(this.getAttribute("x")) || 0, y: Number(this.getAttribute("y")) || 0, width: largura, height: 12 };
  };
  const htmlProto = window.HTMLElement.prototype as unknown as Record<string, unknown>;
  htmlProto.scrollTo = () => {};
  // Sem layout, o linkedom devolve undefined e a Frappe faria contas com NaN (data inválida).
  Object.defineProperty(htmlProto, "scrollLeft", {
    get(this: { _rolagem?: number }) {
      return this._rolagem ?? 0;
    },
    set(this: { _rolagem?: number }, v: number) {
      this._rolagem = v;
    },
    configurable: true,
  });
  for (const medida of ["clientWidth", "offsetWidth", "scrollWidth"])
    Object.defineProperty(htmlProto, medida, { get: () => 0, configurable: true });
  const tokens = Object.getPrototypeOf(document.createElement("div").classList) as Record<string, unknown>;
  if (!tokens.__estrito) {
    const add = tokens.add as (...t: string[]) => void;
    tokens.add = function (this: unknown, ...t: string[]) {
      for (const x of t) if (/\s/.test(x)) throw new Error(`InvalidCharacterError: "${x}" tem espaço`);
      return add.apply(this, t);
    };
    tokens.__estrito = true;
  }
  return document as unknown as Document;
}

/** Deixa rodar os `requestAnimationFrame` pendentes (rótulos e decorações por barra). */
export function esperarQuadro(): Promise<void> {
  return new Promise((r) => setTimeout(r, 5));
}

export function area(doc: Document): HTMLElement {
  return doc.getElementById("area") as HTMLElement;
}
