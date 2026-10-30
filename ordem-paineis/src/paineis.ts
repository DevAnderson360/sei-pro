/**
 * Os painéis da tela de Controle de Processos (`#panelHomePro > .panelHomePro`) e a aplicação da
 * configuração. A ordem é CSS (`order` num contêiner flex) e a visibilidade é um atributo: nenhum nó
 * muda de lugar, então os iframes dos painéis (Favoritos, Projetos) não recarregam. Sem
 * personalização, a página fica como o legado a montou.
 */
import { type Config, nomeConhecido, ordenar, PROTEGIDOS } from './modelo';

export const CONTEINER = '#panelHomePro';
export const CLASSE_ATIVO = 'spro-paineis-ativo';
export const ATRIBUTO_OCULTO = 'data-spro-oculto';

export interface Painel {
  id: string;
  nome: string;
  el: HTMLElement;
  oculto: boolean;
}

/** O nome do título do painel ("Favoritos"), sem o texto dos botões, para painéis que o módulo não conhece. */
function nomeDoTitulo(el: HTMLElement, id: string): string {
  const titulo = el.querySelector('.titlePanelHome');
  const texto = [...(titulo?.childNodes ?? [])]
    .filter(no => no.nodeType === 3)
    .map(no => no.textContent ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();
  return texto ? texto.slice(0, 40) : id;
}

/** Painéis na ordem do DOM (não a visual). */
export function listarPaineis(doc: Document): Painel[] {
  const conteiner = doc.querySelector(CONTEINER);
  if (!conteiner) return [];
  return [...conteiner.children]
    .filter((el): el is HTMLElement => el.classList.contains('panelHomePro') && !!el.id)
    .map(el => ({ id: el.id, nome: nomeConhecido(el.id) ?? nomeDoTitulo(el, el.id), el, oculto: el.hasAttribute(ATRIBUTO_OCULTO) }));
}

function definirOrdem(el: HTMLElement, valor: string | null): void {
  if (valor === null) {
    if (el.style.getPropertyValue('order') !== '') el.style.removeProperty('order');
  } else if (el.style.getPropertyValue('order') !== valor) el.style.setProperty('order', valor);
}

function definirOculto(el: HTMLElement, oculto: boolean): void {
  if (oculto !== el.hasAttribute(ATRIBUTO_OCULTO)) {
    if (oculto) el.setAttribute(ATRIBUTO_OCULTO, '');
    else el.removeAttribute(ATRIBUTO_OCULTO);
  }
}

/** Escreve só o que mudou: quem observa o DOM não deve ver mutação quando nada mudou. */
export function aplicar(doc: Document, cfg: Config): void {
  const conteiner = doc.querySelector<HTMLElement>(CONTEINER);
  if (!conteiner) return;
  const paineis = listarPaineis(doc);
  const ids = paineis.map(p => p.id);
  const ordem = ordenar(ids, cfg);
  const ocultos = new Set(cfg.ocultos.filter(id => !PROTEGIDOS.includes(id)));
  // Só conta o que muda algo na página: ids de painéis ausentes ou uma ordem igual à natural não personalizam.
  const efetiva = ordem.some((id, i) => id !== ids[i]) || ids.some(id => ocultos.has(id));
  if (!efetiva) {
    for (const p of paineis) {
      definirOrdem(p.el, null);
      definirOculto(p.el, false);
    }
    conteiner.classList.remove(CLASSE_ATIVO);
    return;
  }
  for (const p of paineis) {
    definirOrdem(p.el, String(ordem.indexOf(p.id)));
    definirOculto(p.el, ocultos.has(p.id));
  }
  if (!conteiner.classList.contains(CLASSE_ATIVO)) conteiner.classList.add(CLASSE_ATIVO);
}
