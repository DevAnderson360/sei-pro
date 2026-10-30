/**
 * Aviso (toast) do painel embutido no rodapé da TELA do SEI. O aviso é o
 * genérico da sei-comum (`@comum/painel/aviso`); a classe e a animação seguem
 * com o prefixo de sempre (`spro-fav-aviso`, do CSS de pagina/estilo.ts).
 */

import { type AvisarNaPagina, avisoNaPagina as avisoNaPaginaComum } from "@comum/painel/aviso";

export type { AvisarNaPagina } from "@comum/painel/aviso";

export function avisoNaPagina(doc: Document, temaEscuro: boolean): AvisarNaPagina {
  return avisoNaPaginaComum(doc, temaEscuro, "spro-fav");
}
