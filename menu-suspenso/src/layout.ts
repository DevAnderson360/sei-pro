/**
 * O SEI tem dois layouts de tela e o menu muda de lugar entre eles:
 * - `novo` (SEI 4.1+ e 5): a barra azul traz o logo e o menu é uma coluna de um flex;
 * - `antigo` (SEI 3 e 4.0): o menu é uma coluna flutuante ao lado do conteúdo.
 * O mesmo critério do legado (`isNewSEI`): o menu novo é a lista `ul#infraMenu` dentro de `#divInfraSidebarMenu`.
 */
export type Layout = 'novo' | 'antigo';

/** Quem alterna o menu: o bloco logo da barra e o link nativo "Menu". */
const ALAVANCAS: Record<Layout, string> = {
  novo: '#divInfraBarraSistemaPadraoE, #lnkInfraMenuSistema',
  antigo: '#divInfraBarraSistemaE, #lnkInfraMenuSistema',
};

/** `null` quando a página não tem menu lateral (popups, iframes, telas simples). */
export function layoutDaPagina(doc: Document): Layout | null {
  if (!doc.getElementById('divInfraAreaTelaE')) return null;
  return doc.querySelector('#divInfraSidebarMenu ul#infraMenu') ? 'novo' : 'antigo';
}

/** Id do bloco do logo na barra: é ele que vira o botão. */
export const barraDoLayout = (layout: Layout) => (layout === 'novo' ? 'divInfraBarraSistemaPadraoE' : 'divInfraBarraSistemaE');
export const menuDaPagina = (doc: Document) => doc.getElementById('divInfraAreaTelaE');
export const seletorDasAlavancas = (layout: Layout) => ALAVANCAS[layout];

/** Abaixo disso o SEI troca a barra e usa o menu de celular dele: a camada suspensa não se aplica. */
export const LARGURA_MINIMA = 768;
export const larguraSuficiente = (doc: Document) => (doc.defaultView?.innerWidth ?? LARGURA_MINIMA) >= LARGURA_MINIMA;

/**
 * Barra de ações do Controle de Processos: quando fixa, fica por cima de tudo (z-index 99999), menu inclusive.
 * Ao fixar, o legado põe uma CÓPIA dela no fluxo (mesmo id, estática) antes da original: por isso são todas
 * as barras, e vale a que estiver fixa, nunca a primeira que o seletor achar.
 */
export const BARRAS_DE_ACOES = 'div.barraBotoesSEI';
const FOLGA_DA_BARRA = 8;

interface Caixa {
  left: number;
  bottom: number;
}
/**
 * Quanto o conteúdo do menu precisa descer para não ficar sob a barra fixa: do topo do menu até a base da
 * barra, mais uma folga. Zero quando a barra não está fixa ou não alcança a largura do menu.
 */
export function recuoSobBarra(fixa: boolean, barra: Caixa, topoDoMenu: number, larguraDoMenu: number): number {
  if (!fixa || barra.left >= larguraDoMenu || barra.bottom <= topoDoMenu) return 0;
  return Math.ceil(barra.bottom - topoDoMenu + FOLGA_DA_BARRA);
}
