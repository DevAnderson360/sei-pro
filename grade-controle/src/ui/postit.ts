/**
 * Editor da anotacao no desenho de post-it (o mesmo da anotacao abaixo da arvore do processo), com lista de tarefas.
 * Cada linha e uma <div> editavel; a linha de tarefa mostra uma caixa que se marca com um clique. O texto sai no
 * formato do SEI Pro ("[ ] item" / "[X] item"). Colar entra sempre como texto puro. Sem innerHTML.
 */
import { formatarData, hojeISO } from '../../../sei-comum/src/datas/dias';
import { h, icone } from '../../../sei-comum/src/ui/dom';
import { alternarFeito, alternarLista, escreverNota, type LinhaNota, lerNota } from '../modelo/checklist';
import { MAX_ANOTACAO } from '../modelo/edicoes';
import { iconeGrade } from './icones';

export interface Postit {
  el: HTMLElement;
  /** O texto no formato do SEI. */
  texto(): string;
  prioridade(): boolean;
  /** Avisa a cada mudanca (texto, tarefa, prioridade). */
  aoMudar(fn: () => void): void;
  foco(): void;
}

/** Largura do "gutter" onde mora a caixa da tarefa: um clique ali marca/desmarca. */
const GUTTER = 30;

export function lerLinhasDoEditor(raiz: HTMLElement): LinhaNota[] {
  const saida: LinhaNota[] = [];
  const linha = (no: Element | null, texto: string) => {
    const marca = no?.getAttribute('data-tarefa');
    saida.push({ marca: marca === null || marca === undefined ? null : marca === 'x', texto: texto.replace(/\u00a0/g, ' ').replace(/\n+$/, '') });
  };
  let solto = '';
  for (const n of Array.from(raiz.childNodes)) {
    if (n.nodeType === 3) solto += n.textContent ?? '';
    else if (n.nodeType === 1) {
      const e = n as HTMLElement;
      if (solto) { for (const t of solto.split('\n')) linha(null, t); solto = ''; }
      if (e.tagName === 'BR') linha(null, '');
      else linha(e, e.textContent ?? '');
    }
  }
  if (solto) for (const t of solto.split('\n')) linha(null, t);
  return saida.length ? saida : [{ marca: null, texto: '' }];
}

function desenhar(raiz: HTMLElement, linhas: readonly LinhaNota[]): void {
  const doc = raiz.ownerDocument;
  raiz.replaceChildren(...linhas.map((l) => {
    const d = doc.createElement('div');
    d.className = 'spro-pi-linha';
    if (l.marca !== null) d.setAttribute('data-tarefa', l.marca ? 'x' : 'o');
    if (l.texto) d.textContent = l.texto;
    else d.append(doc.createElement('br'));
    return d;
  }));
}

export function criarPostit(inicial: { texto: string; prioridade: boolean }, raizSombra: ShadowRoot): Postit {
  let prio = inicial.prioridade;
  let ouvinte: () => void = () => undefined;
  const editor = h('div', { class: 'spro-pi-editor', contenteditable: 'true', role: 'textbox', 'aria-multiline': 'true', 'aria-label': 'Anotação', spellcheck: 'true' });
  const contador = h('span', { class: 'spro-pi-contador' });
  const btnLista = h('button', { type: 'button', class: 'spro-pi-bt', 'data-tip': 'Lista de tarefas (nas linhas selecionadas)', 'aria-label': 'Lista de tarefas' }, icone('check', 16));
  const btnPrio = h('button', { type: 'button', class: 'spro-pi-bt', 'data-tip': 'Prioridade', 'aria-label': 'Prioridade' }, iconeGrade('prioridade', 16));
  const btnData = h('button', { type: 'button', class: 'spro-pi-bt', 'data-tip': 'Inserir a data de hoje', 'aria-label': 'Inserir a data de hoje' }, icone('calendario', 16));
  const barra = h('div', { class: 'spro-pi-barra' }, btnLista, btnData, btnPrio, contador);
  const raiz = h('div', { class: 'spro-pi' }, editor, barra);

  const linhas = () => lerLinhasDoEditor(editor);
  const texto = () => escreverNota(linhas());
  function atualizar() {
    raiz.classList.toggle('spro-pi-prio', prio);
    btnPrio.setAttribute('aria-pressed', String(prio));
    const n = texto().length;
    contador.textContent = `${n}/${MAX_ANOTACAO}`;
    contador.classList.toggle('spro-pi-estouro', n > MAX_ANOTACAO);
    ouvinte();
  }
  desenhar(editor, lerNota(inicial.texto));
  atualizar();

  /** Indices das linhas tocadas pela selecao (ou da linha do cursor). */
  function indicesSelecionados(): number[] {
    const sel = (raizSombra as unknown as { getSelection?: () => Selection | null }).getSelection?.() ?? raizSombra.ownerDocument.getSelection?.() ?? null;
    const filhos = Array.from(editor.children);
    const indiceDe = (no: Node | null): number => {
      let n: Node | null = no;
      while (n && n.parentNode !== editor) n = n.parentNode;
      return n ? filhos.indexOf(n as Element) : -1;
    };
    if (!sel || !sel.rangeCount) return [];
    const a = indiceDe(sel.anchorNode);
    const f = indiceDe(sel.focusNode);
    if (a < 0 && f < 0) return [];
    const [de, ate] = [Math.min(a < 0 ? f : a, f < 0 ? a : f), Math.max(a, f)];
    return Array.from({ length: ate - de + 1 }, (_, i) => de + i);
  }
  const aplicar = (novas: LinhaNota[]) => { desenhar(editor, novas); atualizar(); };

  // Os botoes nao podem roubar a selecao do editor.
  for (const b of [btnLista, btnData, btnPrio]) b.addEventListener('mousedown', (ev) => ev.preventDefault());
  btnLista.addEventListener('click', () => {
    const ls = linhas();
    const idx = indicesSelecionados();
    aplicar(alternarLista(ls, idx.length ? idx : ls.map((_, i) => i).filter((i) => i === ls.length - 1)));
    editor.focus();
  });
  btnPrio.addEventListener('click', () => { prio = !prio; atualizar(); });
  btnData.addEventListener('click', () => {
    editor.focus();
    const data = formatarData(hojeISO());
    if (!raizSombra.ownerDocument.execCommand?.('insertText', false, data)) { editor.append(data); atualizar(); }
  });

  editor.addEventListener('input', atualizar);
  editor.addEventListener('paste', (ev) => {
    ev.preventDefault();
    const t = ev.clipboardData?.getData('text/plain') ?? '';
    raizSombra.ownerDocument.execCommand?.('insertText', false, t.replace(/\r\n?/g, '\n'));
  });
  // Clique na caixa (gutter da esquerda) marca/desmarca a tarefa.
  editor.addEventListener('mousedown', (ev) => {
    const alvo = (ev.target as Element).closest?.('.spro-pi-linha') as HTMLElement | null;
    if (!alvo || !alvo.hasAttribute('data-tarefa')) return;
    const x = ev.clientX - alvo.getBoundingClientRect().left;
    if (x > GUTTER) return;
    ev.preventDefault();
    aplicar(alternarFeito(linhas(), Array.from(editor.children).indexOf(alvo)));
  });
  // Enter no fim de uma tarefa vazia encerra a lista (como nos editores de tarefas).
  editor.addEventListener('keydown', (ev) => {
    if (ev.key !== 'Enter' || ev.shiftKey) return;
    const sel = (raizSombra as unknown as { getSelection?: () => Selection | null }).getSelection?.() ?? raizSombra.ownerDocument.getSelection?.() ?? null;
    const i = indicesSelecionados();
    const ls = linhas();
    if (sel?.isCollapsed && i.length === 1 && ls[i[0]!]?.marca !== null && !ls[i[0]!]!.texto.trim()) {
      ev.preventDefault();
      aplicar(alternarLista(ls, [i[0]!]));
    }
  });

  return {
    el: raiz,
    texto,
    prioridade: () => prio,
    aoMudar: (fn) => { ouvinte = fn; },
    foco: () => { editor.focus(); },
  };
}
