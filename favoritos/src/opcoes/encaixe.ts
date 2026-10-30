/**
 * Onde a seção do favoritos entra na página de opções: logo depois da linha
 * (div.opcao[data-opcao]) da chave. A página é gerada por opcoes-pagina/.
 */

import { h } from "@comum/ui/dom";

/** Coloca o painel logo depois da linha da chave; null se a chave não está numa linha da página de opções. */
export function encaixar(chave: HTMLInputElement, el: HTMLElement): HTMLElement | null {
  const linha = chave.closest("[data-opcao]");
  if (!linha) return null;
  const nova = h("div", { class: "spro-fav-opcoes-linha" }, el);
  linha.after(nova);
  return nova;
}
