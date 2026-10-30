/**
 * Efeito de importação: marca o <html> para o legado (`marca.ts`). É o PRIMEIRO
 * import de `main.ts`, então roda antes de qualquer outro módulo do pacote ser
 * avaliado (o calendário de feriados de 2000 a 2100, o núcleo do SEI): no
 * `document_start`, a marca chega antes do `init.js` decidir se carrega o
 * `sei-pro-projetos.js`. A prova empacota o content script e confere a ordem
 * (tests/pagina/verificar-pagina.ts).
 */

import { marcarAtivo } from "./marca";

marcarAtivo(document);
