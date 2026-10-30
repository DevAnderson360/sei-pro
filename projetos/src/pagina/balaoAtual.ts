/**
 * O balão da página aberto agora (um por vez). Fica fora de `pagina/balao.ts`
 * (T11): o ícone da caixa e o da árvore consultam este estado a cada clique (o
 * mesmo ícone fecha o balão dele), e estão no pacote da página, enquanto o
 * balão vem sob demanda; os dois pacotes enxergam o mesmo módulo
 * (`js/projetos/pagina-comum.js`).
 */

import type { BalaoPagina } from "./balao";

let aberto: BalaoPagina | null = null;

/** O balão aberto agora (um por documento de cada vez). */
export function balaoAberto(): BalaoPagina | null {
  return aberto;
}

/** O balão que acabou de abrir passa a ser o aberto. */
export function guardarBalaoAberto(b: BalaoPagina): void {
  aberto = b;
}

/** O balão que fechou deixa de ser o aberto (se ainda era: outro pode ter aberto depois). */
export function esquecerBalao(b: BalaoPagina): void {
  if (aberto === b) aberto = null;
}
