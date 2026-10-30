/** O botão que abre o modal, na barra de título do Controle de Processos. */
import { icone } from '../../sei-comum/src/ui/dom';
import { listarPaineis } from './paineis';

export const CLASSE_BOTAO = 'spro-pnl-botao';
const ROTULO = 'Ordenar e ocultar painéis';
/** O legado chama a barra de #divInfraBarraLocalizacao e a marca com .titlePanelHome. */
const BARRA = '#processosSEIPro .titlePanelHome, #processosSEIPro #divInfraBarraLocalizacao, #divInfraBarraLocalizacao.titlePanelHome';

/** Põe o botão (uma vez só) quando há 2 ou mais painéis; tira quando sobra um. Só escreve se mudou. */
export function garantirBotao(doc: Document, abrir: () => void): void {
  const existente = doc.querySelector(`.${CLASSE_BOTAO}`);
  const barra = doc.querySelector<HTMLElement>(BARRA);
  if (!barra || listarPaineis(doc).length < 2) {
    existente?.remove();
    return;
  }
  if (existente && barra.contains(existente)) return;
  existente?.remove();
  const botao = doc.createElement('button');
  botao.type = 'button';
  botao.className = CLASSE_BOTAO;
  botao.title = ROTULO;
  botao.setAttribute('aria-label', ROTULO);
  botao.append(icone('ordenar', 18, doc));
  botao.addEventListener('click', ev => {
    ev.preventDefault();
    ev.stopPropagation();
    abrir();
  });
  barra.append(botao);
}

export const removerBotao = (doc: Document): void => {
  doc.querySelector(`.${CLASSE_BOTAO}`)?.remove();
};
