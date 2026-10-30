/**
 * Utilitários das provas da interface (linkedom): menus, seletores, teclas e
 * o `<dialog>` que o linkedom não tem. Mesma forma dos utilitários do
 * Favoritos e do Histórico, sem importar o núcleo do SEI.
 */

import { instalarDom } from "./util";

type Proto = Record<string, unknown>;

/** Documento novo como `document` global, com `<dialog>` funcionando (showModal/close/open). */
export function telaDoApp(html = '<html><body><div id="app"></div></body></html>'): Document {
  const doc = instalarDom(html);
  const proto = Object.getPrototypeOf(doc.createElement("dialog")) as Proto;
  const Ev = (doc.defaultView as unknown as { Event: typeof Event }).Event;
  proto.showModal = function (this: HTMLElement) {
    this.setAttribute("open", "");
  };
  proto.close = function (this: HTMLElement) {
    if (!this.hasAttribute("open")) return;
    this.removeAttribute("open");
    this.dispatchEvent(new Ev("close"));
  };
  Object.defineProperty(proto, "open", {
    configurable: true,
    get(this: HTMLElement) {
      return this.hasAttribute("open");
    },
  });
  return doc;
}

/**
 * O linkedom não acompanha o foco: aqui `focus()` passa a marcar o `activeElement` do documento,
 * que volta a ser o `body` quando o elemento focado sai da página (como no navegador).
 */
export function rastrearFoco(doc: Document): void {
  let proto = Object.getPrototypeOf(doc.createElement("button")) as Proto | null;
  while (proto && !Object.hasOwn(proto, "focus")) proto = Object.getPrototypeOf(proto) as Proto | null;
  if (!proto) throw new Error("sem focus() no linkedom");
  let ativo: HTMLElement | null = null;
  proto.focus = function (this: HTMLElement) {
    ativo = this;
  };
  Object.defineProperty(doc, "activeElement", { configurable: true, get: () => (ativo?.isConnected ? ativo : doc.body) });
}

/** Tecla do linkedom (o KeyboardEvent do Node não serve aos elementos dele). */
export function tecla(el: Element, key: string): void {
  const Ev = (el.ownerDocument.defaultView as unknown as { Event: typeof Event }).Event;
  const ev = new Ev("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "key", { value: key });
  el.dispatchEvent(ev);
}

/** Texto visível de um elemento, sem espaços repetidos. */
export const texto = (el: Element | null | undefined): string => (el?.textContent ?? "").replace(/\s+/g, " ").trim();

/** Itens do menu aberto pelo botão de rótulo `menu` (abre e fecha). */
export function itensDoMenu(raiz: ParentNode, menu: string): string[] {
  const b = raiz.querySelector<HTMLButtonElement>(`button[aria-haspopup="menu"][aria-label="${menu}"]`);
  if (!b) return [];
  b.click();
  // Itens comuns e marcáveis (menuitemcheckbox).
  const itens = [...b.ownerDocument.querySelectorAll(".spro-menu-pop [role^='menuitem']")].map((i) =>
    texto(i.querySelector(".spro-menu-rotulo")),
  );
  b.click();
  return itens;
}

/** Abre o menu pelo rótulo do botão e clica o item pelo texto. */
export function itemDoMenu(raiz: ParentNode, menu: string, item: string): boolean {
  const b = raiz.querySelector<HTMLButtonElement>(`button[aria-haspopup="menu"][aria-label="${menu}"]`);
  if (!b) return false;
  if (b.getAttribute("aria-expanded") !== "true") b.click();
  const alvo = [...b.ownerDocument.querySelectorAll<HTMLButtonElement>(".spro-menu-pop [role^='menuitem']")].find(
    (i) => texto(i.querySelector(".spro-menu-rotulo")) === item,
  );
  if (!alvo) {
    b.click();
    return false;
  }
  alvo.click();
  return true;
}

/** O seletor inteligente (combobox) pelo rótulo. */
export function combo(raiz: ParentNode, rotulo: string): HTMLButtonElement | null {
  return raiz.querySelector<HTMLButtonElement>(`button[role="combobox"][aria-label="${rotulo}"]`);
}

/** Opções que o seletor oferece agora (abre e fecha). */
export function opcoesDoCombo(raiz: ParentNode, rotulo: string): string[] {
  const b = combo(raiz, rotulo);
  if (!b) return [];
  b.click();
  const valores = [...b.ownerDocument.querySelectorAll(".spro-combo-pop [role='option']")].map((o) => o.getAttribute("data-valor") ?? "");
  b.click();
  return valores;
}

/** Escolhe uma opção do seletor: abre, clica e, na escolha múltipla, fecha de novo. */
export function escolherCombo(raiz: ParentNode, rotulo: string, valor: string): void {
  const b = combo(raiz, rotulo);
  if (!b) throw new Error(`seletor "${rotulo}" não encontrado`);
  if (b.getAttribute("aria-expanded") !== "true") b.click();
  const op = b.ownerDocument.querySelector<HTMLElement>(`.spro-combo-pop [role="option"][data-valor="${escaparValor(valor)}"]`);
  if (!op) throw new Error(`opção "${valor}" não encontrada em "${rotulo}"`);
  op.click();
  if (b.getAttribute("aria-expanded") === "true") b.click();
}

/** Digita no campo de busca do seletor aberto e clica "Criar “…”". */
export async function criarNoCombo(raiz: ParentNode, rotulo: string, valor: string): Promise<void> {
  const b = combo(raiz, rotulo);
  if (!b) throw new Error(`seletor "${rotulo}" não encontrado`);
  if (b.getAttribute("aria-expanded") !== "true") b.click();
  const doc = b.ownerDocument;
  const busca = doc.querySelector<HTMLInputElement>(".spro-combo-pop .spro-combo-busca");
  if (!busca) throw new Error(`seletor "${rotulo}" sem busca`);
  busca.value = valor;
  const Ev = (doc.defaultView as unknown as { Event: typeof Event }).Event;
  busca.dispatchEvent(new Ev("input", { bubbles: true }));
  const criar = doc.querySelector<HTMLButtonElement>(".spro-combo-pop .spro-combo-criar");
  if (!criar) throw new Error(`seletor "${rotulo}" sem "Criar"`);
  criar.click();
  await new Promise((r) => setTimeout(r, 5));
  if (b.getAttribute("aria-expanded") === "true") b.click();
}

/** Valor como aparece no seletor de atributo (aspas e barras escapadas). */
function escaparValor(v: string): string {
  return v.replace(/["\\]/g, "\\$&");
}

/** Muda o valor de um campo e avisa como o navegador ("input" e "change"). */
export function digitar(el: Element | null | undefined, valor: string): void {
  if (!el) throw new Error("campo não encontrado");
  (el as HTMLInputElement).value = valor;
  const Ev = (el.ownerDocument.defaultView as unknown as { Event: typeof Event }).Event;
  el.dispatchEvent(new Ev("input", { bubbles: true }));
  el.dispatchEvent(new Ev("change", { bubbles: true }));
}

/** Marca uma caixa ou rádio como o navegador faz (o linkedom não reflete o atributo). */
export function marcar(el: Element | null | undefined, ligado = true): void {
  if (!el) throw new Error("campo não encontrado");
  (el as HTMLInputElement).checked = ligado;
  const Ev = (el.ownerDocument.defaultView as unknown as { Event: typeof Event }).Event;
  el.dispatchEvent(new Ev("change", { bubbles: true }));
}
