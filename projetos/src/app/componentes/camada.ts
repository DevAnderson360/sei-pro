/**
 * Camada flutuante do app (balão da etapa, popover do filtro): um `<dialog>`
 * NÃO modal posto por `abrirFlutuante`. Sendo um `dialog[open]`, as listas dos
 * seletores e dos menus abertos dentro dela moram nela (`destinoDaCamada`), e
 * escolher uma opção não conta como "clique fora". Esc e clique fora fecham.
 * Ao abrir, o foco vai para o primeiro controle da camada; ao fechar, volta
 * para quem abriu (se o foco ainda estava nela ou se perdeu com ela).
 */

import { h } from "@comum/ui/dom";
import { abrirFlutuante } from "@comum/ui/flutuante";

export interface OpcoesCamada {
  classe: string;
  largura?: number;
  rotulo?: string;
  aoFechar?: () => void;
  /** Onde pôr o foco ao abrir (padrão: o primeiro controle da camada); `null` = não mexer no foco. */
  foco?: (el: HTMLElement) => HTMLElement | null | undefined;
}

export interface Camada {
  el: HTMLDialogElement;
  posicionar(): void;
  fechar(): void;
}

/** O que recebe foco pelo teclado (na ordem do documento). */
export const CONTROLES =
  "button:not([disabled]), a[href], input:not([disabled]):not([type='hidden']), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex='-1'])";

export function controlesDe(el: ParentNode): HTMLElement[] {
  return [...el.querySelectorAll<HTMLElement>(CONTROLES)];
}

const focavel = (el: Element | null | undefined): el is HTMLElement =>
  !!el && typeof (el as HTMLElement).focus === "function" && el.localName !== "body" && el.localName !== "html";

export function abrirCamada(ancora: Element, conteudo: Node, o: OpcoesCamada): Camada {
  const el = h("dialog", { class: `prj-camada ${o.classe}`, open: true, "aria-label": o.rotulo }, conteudo);
  let aberta = true;
  const doc = ancora.ownerDocument;
  // Quem abriu: a âncora, se recebe foco (botão, linha da lista); senão (barra do Gantt) quem tinha o foco.
  const voltar = ancora.matches?.(CONTROLES) && focavel(ancora) ? ancora : focavel(doc.activeElement) ? doc.activeElement : null;
  const esc = (ev: Event) => {
    if ((ev as KeyboardEvent).key === "Escape") fechar();
  };
  const flut = abrirFlutuante(ancora as HTMLElement, el, {
    largura: o.largura,
    larguraMinima: o.largura,
    alturaMaxima: 640,
    aoFechar: () => fechar(),
  });
  function fechar(): void {
    if (!aberta) return;
    aberta = false;
    const focoDentro = el.contains(doc.activeElement);
    doc.removeEventListener("keydown", esc, true);
    flut.fechar();
    // Foco que já saiu (clique em outro campo) fica onde está.
    const ativo = doc.activeElement;
    if (voltar?.isConnected && (focoDentro || !focavel(ativo))) voltar.focus({ preventScroll: true });
    o.aoFechar?.();
  }
  doc.addEventListener("keydown", esc, true);
  const alvo = o.foco ? o.foco(el) : controlesDe(el)[0];
  alvo?.focus({ preventScroll: true });
  return { el, posicionar: () => flut.posicionar(), fechar };
}
