import {
  BARRAS_DE_ACOES,
  barraDoLayout,
  larguraSuficiente,
  layoutDaPagina,
  menuDaPagina,
  recuoSobBarra,
  seletorDasAlavancas,
  type Layout,
} from './layout';

/** Layout em uso no `<html>`; some quando a função desliga. O CSS do módulo só vale com ele. */
export const ATRIBUTO_LAYOUT = 'data-spro-menu-suspenso';
/** `aberto` ou `fechado`: o único estado do módulo. A tela sempre começa fechada. */
export const ATRIBUTO_ESTADO = 'data-spro-menu';
/** O SEI antigo larga o iframe do processo pelo `body.seiSlim_hidemenu` (sei-functions-pro.js, setSizeIframePro). */
const CLASSE_SEM_COLUNA = 'seiSlim_hidemenu';
/** Variável CSS do recuo do topo do menu (ver `recuoSobBarra`); só existe no layout novo, com o menu aberto. */
const VARIAVEL_RECUO = '--spro-menu-recuo';
/** Presente só na aplicação inicial: sem ele o menu deslizaria para fora (piscando aberto) a cada tela que carrega. */
const ATRIBUTO_SEM_ANIMACAO = 'data-spro-menu-sem-animacao';
const ROTULO = 'Abrir ou fechar o menu';

/**
 * Menu lateral como camada por cima do conteúdo, aberta e fechada pelo ☰ da barra. Não guarda o estado entre
 * telas e não mexe nas classes do próprio SEI: tudo é atributo no `<html>`, desfeito ao desligar.
 */
export function iniciar(doc: Document) {
  const raiz = doc.documentElement;
  let layout: Layout | null = null;
  let aberto = false;
  let marcouCorpo = false;
  /** O que o módulo acrescentou a cada alavanca (e só isso), para devolver como estava. */
  const acrescimos = new Map<Element, string[]>();

  function alavancas(): Element[] {
    return layout ? [...doc.querySelectorAll(seletorDasAlavancas(layout))] : [];
  }
  function aplicar() {
    raiz.setAttribute(ATRIBUTO_ESTADO, aberto ? 'aberto' : 'fechado');
    for (const alavanca of alavancas()) alavanca.setAttribute('aria-expanded', String(aberto));
  }
  /** A barra de ações fixa cobre o alto do menu (campo de pesquisa): o conteúdo do menu desce a altura dela. */
  function recuar() {
    const menu = menuDaPagina(doc);
    const janela = doc.defaultView;
    if (!menu) return;
    let recuo = 0;
    if (layout === 'novo' && janela) {
      const alcance = menu.getBoundingClientRect();
      for (const barra of doc.querySelectorAll(BARRAS_DE_ACOES)) {
        const posicao = janela.getComputedStyle(barra).position;
        const caixa = barra.getBoundingClientRect();
        recuo = Math.max(recuo, recuoSobBarra(posicao === 'fixed' || posicao === 'sticky', caixa, alcance.top, alcance.width));
      }
    }
    if (recuo) menu.style.setProperty(VARIAVEL_RECUO, `${recuo}px`);
    else menu.style.removeProperty(VARIAVEL_RECUO);
  }
  function abrir() {
    if (!layout) return;
    aberto = true;
    aplicar();
    recuar();
    doc.defaultView?.addEventListener('scroll', recuar, true);
    doc.defaultView?.addEventListener('resize', recuar);
  }
  function fechar() {
    if (!layout) return;
    aberto = false;
    aplicar();
    doc.defaultView?.removeEventListener('scroll', recuar, true);
    doc.defaultView?.removeEventListener('resize', recuar);
  }
  function alternar() {
    if (aberto) fechar();
    else abrir();
  }

  // Captura no documento: chega antes do `onclick` inline do SEI (que esconde a coluna do jeito dele).
  function clique(evento: Event) {
    const alvo = evento.target as Element | null;
    if (!alvo || typeof alvo.closest !== 'function' || !layout || !larguraSuficiente(doc)) return;
    if (alvo.closest(seletorDasAlavancas(layout))) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
      alternar();
    } else if (aberto && !menuDaPagina(doc)?.contains(alvo)) {
      fechar();
    }
  }
  function tecla(evento: KeyboardEvent) {
    if (evento.key === 'Escape' && aberto && !evento.defaultPrevented) fechar();
    // A barra substitui o link nativo (que o teclado alcançava): Enter e Espaço nela fazem o mesmo que o clique.
    const alvo = evento.target as Element | null;
    if ((evento.key === 'Enter' || evento.key === ' ') && layout && alvo?.id === barraDoLayout(layout)) {
      evento.preventDefault();
      alternar();
    }
  }

  function ligar() {
    layout = layoutDaPagina(doc);
    if (!layout) return;
    raiz.setAttribute(ATRIBUTO_LAYOUT, layout);
    for (const alavanca of alavancas()) {
      const feitos: string[] = [];
      const dar = (nome: string, valor: string) => {
        if (alavanca.hasAttribute(nome)) return;
        alavanca.setAttribute(nome, valor);
        feitos.push(nome);
      };
      dar('aria-controls', 'divInfraAreaTelaE');
      if (alavanca.id.startsWith('divInfraBarra')) {
        dar('role', 'button');
        dar('tabindex', '0');
        dar('aria-label', ROTULO);
      }
      acrescimos.set(alavanca, feitos);
    }
    if (layout === 'antigo' && doc.body && !doc.body.classList.contains(CLASSE_SEM_COLUNA)) {
      doc.body.classList.add(CLASSE_SEM_COLUNA);
      marcouCorpo = true;
    }
    doc.addEventListener('click', clique, true);
    doc.addEventListener('keydown', tecla);
    aberto = false;
    raiz.setAttribute(ATRIBUTO_SEM_ANIMACAO, '');
    aplicar();
    // Dois quadros: o primeiro pinta o estado fechado, o segundo já pode animar.
    const janela = doc.defaultView;
    const soltar = () => raiz.removeAttribute(ATRIBUTO_SEM_ANIMACAO);
    if (janela?.requestAnimationFrame) janela.requestAnimationFrame(() => janela.requestAnimationFrame(soltar));
    else setTimeout(soltar, 50);
  }
  function desligar() {
    doc.defaultView?.removeEventListener('scroll', recuar, true);
    doc.defaultView?.removeEventListener('resize', recuar);
    menuDaPagina(doc)?.style.removeProperty(VARIAVEL_RECUO);
    doc.removeEventListener('click', clique, true);
    doc.removeEventListener('keydown', tecla);
    for (const [alavanca, feitos] of acrescimos) {
      alavanca.removeAttribute('aria-expanded');
      for (const nome of feitos) alavanca.removeAttribute(nome);
    }
    acrescimos.clear();
    if (marcouCorpo) doc.body?.classList.remove(CLASSE_SEM_COLUNA);
    marcouCorpo = false;
    raiz.removeAttribute(ATRIBUTO_LAYOUT);
    raiz.removeAttribute(ATRIBUTO_ESTADO);
    raiz.removeAttribute(ATRIBUTO_SEM_ANIMACAO);
    layout = null;
    aberto = false;
  }

  return {
    /** Liga ou desliga a função; repetir o mesmo valor não faz nada. */
    configurar(ligada: boolean) {
      if (ligada === (layout !== null)) return;
      if (ligada) ligar();
      else desligar();
    },
    abrir,
    fechar,
    alternar,
    aberto: () => aberto,
    encerrar: desligar,
  };
}
