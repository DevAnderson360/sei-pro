/** Em qual tela do SEI o content script está: a caixa (Controle de Processos) ou a árvore do processo. */

export type Tela = "caixa" | "arvore" | null;

/**
 * A caixa é o formulário do Controle de Processos; a árvore é o frame com o número do processo no topo (`#topmenu`)
 * e os nós (`#divArvore`), no SEI 4.1 e no 5 (a mesma regra dos Favoritos). Qualquer outra tela: null.
 */
export function qualTela(doc: Document): Tela {
  if (doc.querySelector("#frmProcedimentoControlar")) return "caixa";
  if (doc.querySelector("#topmenu") && doc.querySelector("#divArvore")) return "arvore";
  return null;
}
