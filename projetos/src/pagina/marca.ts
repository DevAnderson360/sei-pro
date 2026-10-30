/**
 * Sinal para o legado: com este atributo no <html>, o `init.js` não carrega o
 * `sei-pro-projetos.js` (salvo com servidor do Atividades, quando os dois
 * convivem). O content script roda no document_start, então o atributo existe
 * antes do `$(document).ready` do legado. Só o manifest Lab traz o módulo novo.
 */
export const ATRIBUTO_ATIVO = "data-seipro-projetos";

export function marcarAtivo(doc: Document): void {
  doc.documentElement?.setAttribute(ATRIBUTO_ATIVO, "1");
}
