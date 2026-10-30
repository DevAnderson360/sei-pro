/**
 * O botão alternador, sem rótulo e com tooltip, na barra de título do Controle de Processos: ao lado da seta de
 * recolher do legado (`.spro-fav-recolher`) e do botão de ordenar painéis (`.spro-pnl-botao`). O legado monta a
 * barra DEPOIS do carregamento, então esperamos por ela e a reencontramos se for refeita.
 */
import { iconeGrade } from '../ui/icones';

export const CLASSE_BOTAO = 'spro-grade-botao';
const BARRA = '#processosSEIPro .titlePanelHome, #processosSEIPro #divInfraBarraLocalizacao, #divInfraBarraLocalizacao.titlePanelHome, #divInfraBarraLocalizacao';
const ROTULO_LIGAR = 'Usar o Novo Controle de Processos';
const ROTULO_DESLIGAR = 'Voltar à visão nativa do SEI';

/** Põe (ou atualiza) o botão. Devolve `false` se a barra ainda não existe. */
export function garantirBotao(doc: Document, ativo: boolean, alternar: () => void): boolean {
  const barra = doc.querySelector<HTMLElement>(BARRA);
  if (!barra) return false;
  const rotulo = ativo ? ROTULO_DESLIGAR : ROTULO_LIGAR;
  let botao = barra.querySelector<HTMLButtonElement>(`.${CLASSE_BOTAO}`);
  if (!botao) {
    botao = doc.createElement('button');
    botao.type = 'button';
    botao.className = CLASSE_BOTAO;
    // Sem ouvinte proprio: o legado CLONA a barra de titulo (`$.fn.moveTo`) e o clone perde os ouvintes. O clique e
    // delegado ao documento em `ligarCliqueDoBotao` e funciona em qualquer copia do botao.
    botao.append(iconeGrade('grade', 18, doc));
    barra.append(botao);
  }
  // Depois do botao de ordenar os paineis (que chega depois, de outro modulo): sempre o ultimo da barra.
  const ordenar = [...barra.children].filter((c) => c.classList.contains('spro-pnl-botao')).at(-1);
  if (ordenar && ordenar.compareDocumentPosition(botao) & 2 /* DOCUMENT_POSITION_PRECEDING */) ordenar.after(botao);
  botao.setAttribute('data-tip', rotulo);
  botao.removeAttribute('title');
  botao.setAttribute('aria-label', rotulo);
  botao.setAttribute('aria-pressed', String(ativo));
  return true;
}

/** Um ouvinte so, no documento (captura): vale para o botao original e para qualquer clone dele. */
export function ligarCliqueDoBotao(doc: Document, alternar: () => void): () => void {
  const ouvinte = (ev: Event) => {
    const alvo = (ev.composedPath?.()[0] ?? ev.target) as Element | null;
    if (!alvo?.closest?.(`.${CLASSE_BOTAO}`)) return;
    ev.preventDefault();
    ev.stopPropagation();
    alternar();
  };
  doc.addEventListener('click', ouvinte, true);
  return () => doc.removeEventListener('click', ouvinte, true);
}

export const removerBotao = (doc: Document): void => {
  for (const b of doc.querySelectorAll(`.${CLASSE_BOTAO}`)) b.remove();
};

/** Mantém o botão no lugar enquanto a opção estiver ligada. Devolve a função que para de vigiar. */
export function manterBotao(doc: Document, estado: () => boolean, alternar: () => void): () => void {
  const aplicar = () => garantirBotao(doc, estado(), alternar);
  aplicar();
  const Obs = doc.defaultView?.MutationObserver;
  if (!Obs || !doc.body) return () => removerBotao(doc);
  let agendado = false;
  const mo = new Obs(() => {
    if (agendado) return;
    agendado = true;
    queueMicrotask(() => {
      agendado = false;
      mo.disconnect();
      aplicar();
      mo.observe(doc.body, { childList: true, subtree: true });
    });
  });
  mo.observe(doc.body, { childList: true, subtree: true });
  return () => {
    mo.disconnect();
    removerBotao(doc);
  };
}

export const atualizarBotao = (doc: Document, ativo: boolean, alternar: () => void): void => void garantirBotao(doc, ativo, alternar);
