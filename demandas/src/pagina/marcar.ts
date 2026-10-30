/**
 * Efeito de importação: marca o <html> para o legado (`marca.ts`). É o PRIMEIRO import de `main.ts`, então roda antes
 * de qualquer outro módulo do pacote ser avaliado: no `document_start`, a marca chega antes de a opção ser lida. A prova
 * empacota o content script e confere a ordem (tests/pagina/verificar-pagina.ts).
 */

import { marcarAtivo } from "./marca";

marcarAtivo(document);
