/**
 * O botao de recolher/expandir do painel (a seta ao lado do titulo) e do legado: `toggleTablePro` poe/tira a classe
 * `displayNone` em `.collapseTabelaProcesso` (#collapseControle, #divFiltro, #divTabelaProcesso...). A grade nao e
 * um desses elementos, entao seguimos o estado deles: recolhido = `displayNone` no #collapseControle (ou em qualquer
 * outro da familia). O host da grade recebe `data-spro-recolhido`, que o CSS da pagina esconde.
 */
export const ATRIBUTO_RECOLHIDO = 'data-spro-recolhido';
const FAMILIA = '.collapseTabelaProcesso';

export function estaRecolhido(doc: Document): boolean {
  const alvos = [...doc.querySelectorAll(FAMILIA)].filter((e) => e.id !== 'spro-grade');
  return alvos.length > 0 && alvos.some((e) => e.classList.contains('displayNone'));
}

export function acompanharRecolhimento(doc: Document, host: HTMLElement, Observador: typeof MutationObserver | undefined = doc.defaultView?.MutationObserver): () => void {
  const aplicar = () => host.toggleAttribute(ATRIBUTO_RECOLHIDO, estaRecolhido(doc));
  aplicar();
  if (!Observador) return () => undefined;
  const mo = new Observador(aplicar);
  mo.observe(doc.body ?? doc.documentElement, { attributes: true, attributeFilter: ['class'], subtree: true });
  return () => mo.disconnect();
}
