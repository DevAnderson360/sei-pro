/**
 * Contrato dos contadores das abas do painel lateral: quem grava (o app da
 * ferramenta, o content script) e quem pinta o selo (o shell,
 * favoritos/src/shell/painel.ts) leem daqui, para a chave e o teto não se
 * separarem.
 */

/** As etapas atrasadas da unidade da aba do SEI (projetos: o app do lateral e o Controle de Processos gravam). */
export const CHAVE_CONTADOR_PROJETOS = "projetos/contadorPainel";

/**
 * O maior número de etapas atrasadas que existe: 2 escopos (Só eu e Toda a unidade) x 100 projetos ativos x 300
 * etapas (`LIMITES` em projetos/src/modelo/constantes.ts, conferido pela prova do projetos). Acima disso o valor do
 * storage é torto e a aba fica sem número. Literal, e não a conta: o esbuild não descarta `2 * 100 * 300` e a sobra
 * entraria nos bundles que importam daqui.
 */
export const TETO_CONTADOR_PROJETOS = 60000;

/** As demandas ABERTAS E ATRASADAS que são MINHAS na unidade da aba do SEI (demandas: o app do lateral e o Controle de Processos gravam). */
export const CHAVE_CONTADOR_DEMANDAS = "demandas/contadorPainel";

/** O teto do selo da aba "Demandas": acima disto o valor do storage é torto e a aba fica sem número. Literal, como o dos projetos. */
export const TETO_CONTADOR_DEMANDAS = 60000;
