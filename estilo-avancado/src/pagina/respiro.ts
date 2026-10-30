/**
 * Respiro nos formulários das telas internas do SEI. As linhas (rótulo + campo) vivem numa área de altura
 * fixa (`div.infraAreaDados` com `height` inline) e cada uma é posicionada em porcentagem; margens não
 * empurram nada. Ampliar a altura da área afasta as linhas proporcionalmente. Reversível: a altura original
 * fica em `data-spro-altura` e volta ao desligar o tema.
 */

export const ATRIBUTO_ALTURA = "data-spro-altura";
export const FATOR_RESPIRO = 1.3;

/** Áreas candidatas: altura fixa inline (em, px ou rem). */
const SELETOR_AREAS = 'div.infraAreaDados[style*="height"]';

type EhAbsoluto = (el: Element) => boolean;

function absolutoNoNavegador(el: Element): boolean {
  try {
    return el.ownerDocument.defaultView?.getComputedStyle(el).position === "absolute";
  } catch {
    return false;
  }
}

/** Amplia as áreas de formulário cujas linhas são absolutas. Devolve quantas ampliou. */
export function ampliarAreas(
  doc: Document,
  ehAbsoluto: EhAbsoluto = absolutoNoNavegador,
  altura = (el: Element) => el.getBoundingClientRect().height,
): number {
  let n = 0;
  for (const area of doc.querySelectorAll<HTMLElement>(SELETOR_AREAS)) {
    if (area.hasAttribute(ATRIBUTO_ALTURA)) continue;
    const linhas = [...area.querySelectorAll(":scope > label, :scope > input, :scope > select, :scope > textarea")];
    if (linhas.length === 0 || !linhas.some(ehAbsoluto)) continue;
    const h = altura(area);
    if (!(h > 0)) continue;
    area.setAttribute(ATRIBUTO_ALTURA, area.style.height);
    area.style.height = `${Math.round(h * FATOR_RESPIRO)}px`;
    n++;
  }
  return n;
}

/** Devolve a altura original de cada área ampliada. */
export function restaurarAreas(doc: Document): void {
  for (const area of doc.querySelectorAll<HTMLElement>(`[${ATRIBUTO_ALTURA}]`)) {
    const original = area.getAttribute(ATRIBUTO_ALTURA) ?? "";
    if (original) area.style.height = original;
    else area.style.removeProperty("height");
    area.removeAttribute(ATRIBUTO_ALTURA);
    if (!area.getAttribute("style")) area.removeAttribute("style");
  }
}

/** Liga o respiro: roda quando a página termina de carregar (as fontes mudam as alturas). Devolve o desligador. */
export function iniciarRespiro(doc: Document): () => void {
  const aplicar = () => void ampliarAreas(doc);
  if (doc.readyState === "loading") doc.addEventListener("DOMContentLoaded", aplicar, { once: true });
  else aplicar();
  const visao = doc.defaultView;
  visao?.addEventListener("load", aplicar, { once: true });
  return () => {
    doc.removeEventListener("DOMContentLoaded", aplicar);
    visao?.removeEventListener("load", aplicar);
    restaurarAreas(doc);
  };
}
