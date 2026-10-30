/**
 * Sinal para o legado: com este atributo no <html>, o `init.js` sabe que o Gestor de Demandas novo está ativo (o
 * legado de atividades segue em outro painel, intacto). O content script roda no `document_start`, então o atributo
 * existe antes do `$(document).ready` do legado. Só o manifest Lab traz o módulo novo.
 */
export const ATRIBUTO_ATIVO = "data-seipro-demandas";

export function marcarAtivo(doc: Document): void {
  doc.documentElement?.setAttribute(ATRIBUTO_ATIVO, "1");
}
