/**
 * Provas da camada da página: as telas reais do SEI (fixtures do núcleo) e os mesmos contadores das outras provas do
 * pacote (o módulo é o mesmo arquivo). Ficam à parte do `verificar.ts` principal só pelo núcleo do SEI, que não segue
 * todas as regras de tipo do pacote (tsconfig.pagina.json).
 */

export { combo, telaSei, tique } from "../../../favoritos/tests/util";
export { botao, checar, disparar, escolher, instalarDom, lanca, secao } from "../util";
