/**
 * Provas do content script: as telas reais do SEI (fixtures do núcleo) e os
 * mesmos contadores das outras provas do pacote (o módulo é o mesmo arquivo).
 * Ficam fora do tsconfig.json do pacote: o núcleo do SEI não segue
 * `noUncheckedIndexedAccess` (tsconfig.pagina.json).
 */

export { combo, telaSei, tique } from "../../../favoritos/tests/util";
export { botao, checar, disparar, instalarDom, lanca, secao } from "../util";
