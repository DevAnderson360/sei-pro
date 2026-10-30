import { type ConfigTema, esquemaResolvido } from "@comum/tema/config";
import { gerarFolha } from "@comum/tema/tokens";

export const ATRIBUTO_ESQUEMA = "data-spro-tema";
export const ATRIBUTO_ATIVO = "data-spro-tema-ativo";
const MARCA_ESTILO = "data-spro-tema-estilo";

/**
 * Aplica o tema ao documento: um único `<style>` (texto, nunca marcação), o esquema em
 * `data-spro-tema` e `color-scheme`, para controles nativos e barras de rolagem
 * acompanharem. Reaplicar troca o conteúdo; nunca duplica. Tema inativo remove tudo.
 */
export function aplicarTema(doc: Document, cfg: ConfigTema, sistemaEscuro: boolean, baseCss: string): void {
  if (!cfg.ativo) {
    removerTema(doc);
    return;
  }
  const esquema = esquemaResolvido(cfg, sistemaEscuro);
  const raiz = doc.documentElement;
  if (!raiz) return;

  let estilo = doc.querySelector(`style[${MARCA_ESTILO}]`);
  if (!estilo) {
    estilo = doc.createElement("style");
    estilo.setAttribute(MARCA_ESTILO, "");
    (doc.head ?? raiz).appendChild(estilo);
  }
  const texto = gerarFolha(cfg, esquema, baseCss);
  if (estilo.textContent !== texto) estilo.textContent = texto;

  raiz.setAttribute(ATRIBUTO_ATIVO, "");
  raiz.setAttribute(ATRIBUTO_ESQUEMA, esquema);
  raiz.style.colorScheme = esquema === "escuro" ? "dark" : "light";
}

/** Zero rastro: a página volta a ser exatamente a de antes. */
export function removerTema(doc: Document): void {
  for (const el of doc.querySelectorAll(`style[${MARCA_ESTILO}]`)) el.remove();
  const raiz = doc.documentElement;
  if (!raiz) return;
  raiz.removeAttribute(ATRIBUTO_ATIVO);
  raiz.removeAttribute(ATRIBUTO_ESQUEMA);
  raiz.style.removeProperty("color-scheme");
  if (!raiz.getAttribute("style")) raiz.removeAttribute("style");
}
