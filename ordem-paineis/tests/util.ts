import { parseHTML } from 'linkedom';

export const criar = (html: string) => parseHTML(`<html><head></head><body>${html}</body></html>`).document as unknown as Document;

/** O contêiner do legado com os painéis pedidos, cada um com a barra de título do SEI Pro. */
export function paginaComPaineis(ids: string[], extra = ''): Document {
  const paineis = ids
    .map(id => `<div class="panelHomePro" id="${id}" data-order="" style="display: inline-block; width: 100%;"><div class="infraBarraLocalizacao titlePanelHome">Painel ${id}<button type="button" class="spro-fav-recolher"></button></div><div class="corpo-${id}"></div></div>`)
    .join('');
  return criar(`<form id="frmProcedimentoControlar"></form><div id="panelHomePro" style="display: inline-block; width: 100%;">${paineis}</div>${extra}`);
}

export const ordemCss = (el: Element) => (el as HTMLElement).style.getPropertyValue('order');

/** A raiz do modal (o Shadow DOM do host); vazia quando o modal não está aberto. */
export function raizModal(d: Document): ParentNode {
  const host = d.querySelector('.spro-pnl-host');
  return (host?.shadowRoot as ParentNode | null | undefined) ?? d.createDocumentFragment();
}
export const hostsAbertos = (d: Document) => d.querySelectorAll('.spro-pnl-host').length;
