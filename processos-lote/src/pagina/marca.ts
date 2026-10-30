/**
 * Sinal para o legado: com este atributo no <html>, o `initProcLoteModal` (sei-pro-proc-lote.js) so dispara o
 * evento de abrir e retorna, sem montar a janela antiga. O content script roda no document_start, entao o
 * atributo existe antes de qualquer clique no menu.
 */
import { ATRIBUTO_ATIVO } from "../modelo/constantes";

export function marcarAtivo(doc: Document): void {
  doc.documentElement?.setAttribute(ATRIBUTO_ATIVO, "1");
}
