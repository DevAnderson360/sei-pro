/**
 * Em qual tela do SEI o content script está: a caixa (Controle de Processos) ou o frame da barra de ações do processo
 * (`#divArvoreAcoes`, onde o SEI desenha os botões do nó selecionado da árvore: no SEI 4.1 é o frame de fora
 * (`ifrConteudoVisualizacao`, que traz o `ifrVisualizacao` aninhado) e no SEI 5 o único visualizador). Não é a regra do
 * Projetos, que age no frame da árvore: o botão das demandas mora na barra.
 */

export type Tela = "caixa" | "arvore" | null;

export function qualTela(doc: Document): Tela {
  if (doc.querySelector("#frmProcedimentoControlar")) return "caixa";
  if (doc.querySelector("#divArvoreAcoes")) return "arvore";
  return null;
}
