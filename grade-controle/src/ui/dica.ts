/**
 * Dica (tooltip) moderna no lugar do `title` nativo do navegador e do tooltip do SEI. Um unico balao, num Shadow DOM
 * proprio no fim do <html>, atende a grade inteira (inclusive o que mora dentro do Shadow DOM da grade, dos modais e
 * das listas) e o botao alternador do titulo. So age em elementos DA GRADE: o resto do SEI continua com os seus.
 *
 * O texto vem de `data-tip`. Quem ainda usa `title` e convertido na primeira vez que o mouse passa: o atributo sai
 * (o navegador nao mostra o dele) e o texto vira `data-tip`; sem nome acessivel, o `title` vira `aria-label`.
 */
import { lerNota } from '../modelo/checklist';

export const ATRIBUTO_DICA = 'data-tip';
/** Dica de anotacao: o texto bruto da nota (com [ ] e [X]) e o autor; o balao desenha as caixas e risca o feito. */
export const ATRIBUTO_NOTA = 'data-tip-nota';
export const ATRIBUTO_AUTOR = 'data-tip-autor';
/** Aparece na hora: sem espera entre o mouse chegar e o balao. */
const ATRASO_MS = 0;
const CSS = `
:host { all: initial; }
.dica { position: fixed; inset: auto; margin: 0; border: 0; overflow: visible; z-index: 2147483647; max-width: 320px; padding: 6px 10px; font: 12px/1.45 system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color: #fff; white-space: pre-line; pointer-events: none; background: #1b1f24; border-radius: 8px; box-shadow: 0 6px 18px rgb(0 0 0 / 28%); opacity: 0; transform: translateY(2px); transition: opacity 120ms ease, transform 120ms ease; }
.dica.claro { color: #1b1f24; background: #fff; box-shadow: 0 6px 18px rgb(0 0 0 / 22%), 0 0 0 1px rgb(0 0 0 / 10%); }
.dica.on { opacity: 1; transform: none; }
.nota { display: flex; flex-direction: column; gap: 3px; }
.nota-l { position: relative; min-height: 1.45em; }
.nota-l[data-t] { padding-left: 22px; }
.nota-l[data-t]::before { content: ""; position: absolute; left: 1px; top: 0.2em; box-sizing: border-box; width: 14px; height: 14px; border: 1.6px solid currentColor; border-radius: 4px; opacity: 0.75; }
.nota-l[data-t="x"] { text-decoration: line-through; opacity: 0.8; }
.nota-l[data-t="x"]::before { content: "\\2713"; opacity: 1; text-align: center; font: 700 11px/11px system-ui; color: #fff; background: #4a8f5a; border-color: #4a8f5a; }
.nota-autor { margin-top: 4px; font-size: 11px; opacity: 0.7; }
.dica[hidden] { display: none; }
@media (prefers-reduced-motion: reduce) { .dica { transition: none; } }
`;

type Alvo = Element;

const ehElemento = (n: EventTarget): n is Element => (n as Node).nodeType === 1;

const daGrade = (caminho: EventTarget[]): boolean =>
  caminho.some((n) => ehElemento(n) && (n.id === 'spro-grade' || n.classList.contains('spro-grade-botao')));

export function acharDica(caminho: EventTarget[]): Alvo | null {
  if (!daGrade(caminho)) return null;
  for (const n of caminho) {
    if (!ehElemento(n)) continue;
    if (n.id === 'spro-grade') return null;
    if (n.hasAttribute(ATRIBUTO_DICA) || n.hasAttribute(ATRIBUTO_NOTA) || n.hasAttribute('title')) return n;
  }
  return null;
}

/** `title` -> `data-tip` (o navegador deixa de mostrar o dele). Devolve o texto. */
export function migrarTitulo(el: Element): string {
  const titulo = el.getAttribute('title');
  if (titulo) {
    if (!el.hasAttribute(ATRIBUTO_DICA)) el.setAttribute(ATRIBUTO_DICA, titulo);
    if (!el.hasAttribute('aria-label') && !(el.textContent ?? '').trim()) el.setAttribute('aria-label', titulo.split('\n')[0]!);
    el.removeAttribute('title');
  }
  return el.getAttribute(ATRIBUTO_DICA) ?? '';
}

/** A nota no balao: caixa para `[ ]`, caixa marcada e texto riscado para `[X]`. So nos de texto: nada vira HTML. */
export function desenharNota(balao: HTMLElement, texto: string, autor: string): void {
  const doc = balao.ownerDocument;
  const raiz = doc.createElement('div');
  raiz.className = 'nota';
  for (const l of lerNota(texto)) {
    if (l.marca === null && !l.texto.trim()) continue;
    const d = doc.createElement('div');
    d.className = 'nota-l';
    if (l.marca !== null) d.setAttribute('data-t', l.marca ? 'x' : 'o');
    d.textContent = l.texto;
    raiz.append(d);
  }
  if (autor) {
    const a = doc.createElement('div');
    a.className = 'nota-autor';
    a.textContent = autor;
    raiz.append(a);
  }
  balao.replaceChildren(raiz);
}

/** Ganchos entre `vigiarTitulos` (quem converte) e `instalarDicas` (quem mostra o balao). */
let aoRedesenhar: (() => void) | null = null;

/**
 * Converte `title` em `data-tip` assim que o atributo aparece (e nos elementos novos): a grade redesenha as linhas
 * com frequencia, e um elemento recem-criado com `title` mostraria o balao nativo do navegador antes de qualquer
 * evento do mouse. O MutationObserver roda como microtarefa, bem antes do navegador mostrar o dele.
 */
export function vigiarTitulos(raiz: Node): () => void {
  const converter = (no: Node) => {
    if (no.nodeType !== 1) return;
    const el = no as Element;
    if (el.hasAttribute('title')) migrarTitulo(el);
    for (const filho of Array.from(el.querySelectorAll('[title]'))) migrarTitulo(filho);
  };
  converter(raiz.nodeType === 11 ? (raiz as ShadowRoot).host : raiz);
  if (raiz.nodeType === 11) for (const filho of Array.from((raiz as ShadowRoot).querySelectorAll('[title]'))) migrarTitulo(filho);
  const Obs = (raiz.ownerDocument ?? (raiz as Document)).defaultView?.MutationObserver;
  if (!Obs) return () => undefined;
  const mo = new Obs((registros) => {
    for (const r of registros) {
      if (r.type === 'attributes') converter(r.target);
      else for (const n of Array.from(r.addedNodes)) converter(n);
    }
    aoRedesenhar?.();
  });
  mo.observe(raiz, { attributes: true, attributeFilter: ['title'], childList: true, subtree: true });
  return () => mo.disconnect();
}

/** O caminho de `el` ate o documento, atravessando Shadow DOM (como o `composedPath` de um evento). */
export function caminhoDe(el: Node): Node[] {
  const c: Node[] = [];
  let n: Node | null = el;
  while (n) {
    c.push(n);
    n = n.nodeType === 11 ? ((n as ShadowRoot).host ?? null) : n.parentNode;
  }
  return c;
}

export function posicionar(alvo: DOMRect, dica: { largura: number; altura: number }, janela: { w: number; h: number }): { x: number; y: number; acima: boolean } {
  const m = 8;
  let y = alvo.bottom + m;
  let acima = false;
  if (y + dica.altura > janela.h - 4 && alvo.top - m - dica.altura >= 4) {
    y = alvo.top - m - dica.altura;
    acima = true;
  }
  let x = alvo.left + alvo.width / 2 - dica.largura / 2;
  x = Math.max(4, Math.min(x, janela.w - dica.largura - 4));
  return { x: Math.round(x), y: Math.round(Math.max(4, y)), acima };
}

export function instalarDicas(doc: Document, escuro: () => boolean = () => false): () => void {
  const win = doc.defaultView;
  if (!win) return () => undefined;
  const host = doc.createElement('div');
  host.id = 'spro-dica-host';
  const sombra = host.attachShadow({ mode: 'open' });
  const estilo = doc.createElement('style');
  estilo.textContent = CSS;
  const balao = doc.createElement('div');
  balao.className = 'dica';
  balao.setAttribute('role', 'tooltip');
  balao.hidden = true;
  // popover: vai para a camada de topo e fica ACIMA dos modais (<dialog>.showModal), que cobririam um balao comum.
  balao.setAttribute('popover', 'manual');
  sombra.append(estilo, balao);
  doc.documentElement.append(host);

  let alvo: Alvo | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let visivel = false;
  let ponteiro: { x: number; y: number } | null = null;

  function ocultar() {
    clearTimeout(timer);
    alvo = null;
    visivel = false;
    balao.classList.remove('on');
    balao.hidden = true;
    try {
      if (balao.matches?.(':popover-open')) balao.hidePopover();
    } catch {
      /* sem popover */
    }
  }
  function mostrar() {
    if (!alvo || !alvo.isConnected) return reavaliar();
    const nota = alvo.getAttribute(ATRIBUTO_NOTA);
    const texto = nota !== null ? nota : migrarTitulo(alvo);
    if (!texto) return ocultar();
    if (nota !== null) desenharNota(balao, nota, alvo.getAttribute(ATRIBUTO_AUTOR) ?? '');
    else balao.textContent = texto;
    balao.classList.toggle('claro', !escuro());
    balao.hidden = false;
    try {
      if (typeof balao.showPopover === 'function' && !balao.matches(':popover-open')) balao.showPopover();
    } catch {
      /* sem popover: fica no fluxo normal */
    }
    const r = alvo.getBoundingClientRect();
    const b = balao.getBoundingClientRect();
    const p = posicionar(r, { largura: b.width, altura: b.height }, { w: win!.innerWidth, h: win!.innerHeight });
    balao.style.left = `${p.x}px`;
    balao.style.top = `${p.y}px`;
    balao.classList.add('on');
    visivel = true;
  }
  /** O que esta debaixo do ponteiro agora, atravessando os Shadow DOM (a grade redesenha elementos sob o mouse parado). */
  function sob(x: number, y: number): Element | null {
    let el = doc.elementFromPoint(x, y);
    for (let i = 0; i < 4 && el?.shadowRoot; i++) {
      const dentro = el.shadowRoot.elementFromPoint(x, y);
      if (!dentro || dentro === el) break;
      el = dentro;
    }
    return el;
  }
  function reavaliar() {
    if (!ponteiro) return ocultar();
    const el = sob(ponteiro.x, ponteiro.y);
    const novo = el ? acharDica(caminhoDe(el)) : null;
    if (novo === alvo && alvo?.isConnected) return;
    const estava = visivel;
    ocultar();
    if (!novo) return;
    migrarTitulo(novo);
    alvo = novo;
    if (estava || ATRASO_MS === 0) mostrar();
    else timer = setTimeout(mostrar, ATRASO_MS);
  }
  aoRedesenhar = () => {
    if (alvo && !alvo.isConnected) reavaliar();
  };
  /**
   * Quem decide e o `pointermove` (e o `pointerover`/`mouseover`, o que chegar primeiro): em alguns navegadores e
   * situacoes (janela sem foco, elemento recriado sob o ponteiro) o `pointerover` nao chega, mas o movimento sempre.
   */
  const aoApontar = (ev: Event) => {
    const pe = ev as PointerEvent;
    if (typeof pe.clientX === 'number') ponteiro = { x: pe.clientX, y: pe.clientY };
    const el = acharDica(ev.composedPath());
    if (el === alvo && alvo?.isConnected) return;
    ocultar();
    if (!el) return;
    migrarTitulo(el); // o title sai ja: o balao nativo do navegador nao pode aparecer
    alvo = el;
    if (ATRASO_MS > 0) timer = setTimeout(mostrar, ATRASO_MS);
    else mostrar();
  };
  const aoFocar = (ev: Event) => {
    const el = acharDica(ev.composedPath());
    if (!el || !(el as HTMLElement).matches?.(':focus-visible')) return;
    ocultar();
    migrarTitulo(el);
    alvo = el;
    mostrar();
  };
  const aoSairDaJanela = () => ocultar();
  doc.addEventListener('pointerover', aoApontar, true);
  doc.addEventListener('mouseover', aoApontar, true);
  doc.addEventListener('pointermove', aoApontar, true);
  doc.addEventListener('mousemove', aoApontar, true);
  doc.addEventListener('focusin', aoFocar, true);
  doc.addEventListener('focusout', ocultar, true);
  doc.addEventListener('pointerdown', ocultar, true);
  doc.addEventListener('keydown', ocultar, true);
  doc.addEventListener('scroll', ocultar, true);
  doc.documentElement.addEventListener('pointerleave', aoSairDaJanela);
  return () => {
    ocultar();
    aoRedesenhar = null;
    doc.removeEventListener('pointerover', aoApontar, true);
    doc.removeEventListener('mouseover', aoApontar, true);
    doc.removeEventListener('pointermove', aoApontar, true);
    doc.removeEventListener('mousemove', aoApontar, true);
    doc.documentElement.removeEventListener('pointerleave', aoSairDaJanela);
    doc.removeEventListener('focusin', aoFocar, true);
    doc.removeEventListener('focusout', ocultar, true);
    doc.removeEventListener('pointerdown', ocultar, true);
    doc.removeEventListener('keydown', ocultar, true);
    doc.removeEventListener('scroll', ocultar, true);
    host.remove();
  };
}
