/**
 * Os modos `pagina` (sem aba do SEI) e `lateral` (painel lateral do navegador) são de janela inteira: a página é
 * web-accessible, e um site qualquer a poderia pôr num iframe e induzir cliques (clickjacking) sobre excluir, arquivar
 * e concluir. Dentro de um quadro, recusa (o `lateral` só passa se todos os ancestrais forem a extensão). O `embutido` fica de fora: é o iframe legítimo do SEI e só recebe dados pela
 * porta da própria aba.
 */
export const MSG_PAGINA_EM_QUADRO = "Este modo só abre em tela cheia.";

export interface ContextoDoQuadro {
  noTopo: boolean;
  /** Todos os ancestrais do quadro são a própria extensão (`location.ancestorOrigins`); false se o navegador não informa. */
  ancestraisSaoDaExtensao: boolean;
}

/**
 * O `lateral` roda num iframe do shell do painel da própria extensão, então só pode estar num quadro cujos ancestrais
 * são todos a extensão. O `pagina` nunca abre em quadro.
 */
export function recusaDoModo(modo: string, { noTopo, ancestraisSaoDaExtensao }: ContextoDoQuadro): string | null {
  if (noTopo || modo === "embutido") return null;
  if (modo === "lateral" && ancestraisSaoDaExtensao) return null;
  return modo === "pagina" || modo === "lateral" ? MSG_PAGINA_EM_QUADRO : null;
}

export function ancestraisDaExtensao(loc: Pick<Location, "origin"> & { ancestorOrigins?: ArrayLike<string> }): boolean {
  const a = loc.ancestorOrigins;
  return !!a && a.length > 0 && Array.from(a).every((o) => o === loc.origin);
}
