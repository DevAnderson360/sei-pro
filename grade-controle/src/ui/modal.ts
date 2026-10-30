/**
 * Modal da grade: o `<dialog class="spro-dialogo">` do base.css do sei-comum, dentro do Shadow DOM da propria grade
 * (o mesmo desenho do modal de Prazos). Sem botao Cancelar: o X e o Esc ja fecham. Texto do SEI entra como texto.
 */
import { h, icone, type NomeIcone } from '../../../sei-comum/src/ui/dom';

export interface OpcoesModalGrade {
  titulo: string;
  subtitulo?: string;
  icone?: NomeIcone;
  conteudo: HTMLElement;
  /** Modal mais largo (anotacao). */
  largo?: boolean;
  aoFechar?: () => void;
}

export function abrirModalGrade(raiz: ShadowRoot | HTMLElement, o: OpcoesModalGrade): { fechar(): void; dlg: HTMLDialogElement } {
  const doc = raiz.ownerDocument ?? document;
  for (const antigo of Array.from(raiz.querySelectorAll('dialog.spro-dialogo-grade'))) antigo.remove();
  const dlg = h('dialog', { class: `spro-dialogo spro-dialogo-grade${o.largo ? ' spro-dialogo-largo' : ''}`, 'aria-label': o.titulo });
  const fechar = () => {
    if (dlg.open) dlg.close();
    else dlg.remove();
  };
  dlg.append(
    h('header', {},
      o.icone ? h('span', { class: 'spro-dialogo-icone', 'aria-hidden': 'true' }, icone(o.icone, 18)) : null,
      h('h2', {}, o.titulo, o.subtitulo ? h('small', { class: 'spro-dialogo-sub' }, o.subtitulo) : null),
      h('button', { type: 'button', class: 'spro-botao-icone', 'aria-label': 'Fechar', title: 'Fechar (Esc)', onclick: fechar }, icone('fechar', 16))),
    h('div', { class: 'spro-dialogo-corpo' }, o.conteudo));
  dlg.addEventListener('close', () => {
    dlg.remove();
    o.aoFechar?.();
  });
  raiz.append(dlg);
  void doc;
  if (typeof dlg.showModal === 'function') dlg.showModal();
  else dlg.setAttribute('open', '');
  dlg.querySelector<HTMLElement>('.spro-combo, textarea, input:not([type=checkbox])')?.focus({ preventScroll: true });
  return { fechar, dlg };
}
