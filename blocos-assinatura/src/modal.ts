/**
 * O modal "Retornar bloco disponibilizado": o mesmo desenho dos diálogos dos Favoritos, do Histórico,
 * dos Projetos e da Ordem dos painéis (`dialog.spro-dialogo` do base.css do sei-comum, dentro de um
 * Shadow DOM, para o CSS do SEI e o modo noturno do legado não o alcançarem).
 *
 * A tela de inclusão vive num iframe da visualização; o modal é montado no documento do TOPO, para
 * cobrir a janela inteira (árvore, barra de ações e conteúdo), e não só o quadro do iframe. Tudo por
 * `createElement`/`textContent`: descrição de bloco entra como texto, nunca como HTML.
 *
 * `css` é o base.css + modal.css, que chegam de fora porque só o main.ts importa `.css` (os testes
 * rodam o código-fonte direto).
 */
import { icone } from '../../sei-comum/src/ui/dom';

export const CLASSE_HOST = 'spro-blk-host';

export interface Modal {
  host: HTMLElement;
  /** A raiz do Shadow DOM, onde estão todos os controles abaixo. */
  raiz: ParentNode;
  dialogo: HTMLDialogElement;
  titulo: HTMLElement;
  explicacao: HTMLElement;
  status: HTMLElement;
  lista: HTMLFieldSetElement;
  confirmar: HTMLButtonElement;
  /** O X do cabeçalho (`data-spro-fechar`): não há botão Cancelar/Fechar no rodapé. */
  fecharX: HTMLButtonElement;
  abrir(): void;
  remover(): void;
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, classe = '', texto?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  if (classe) e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function botao(doc: Document, classe: string, texto: string): HTMLButtonElement {
  const b = el(doc, 'button', classe, texto);
  b.type = 'button';
  return b;
}

export function criarModal(topo: Document, opcoes: { css?: string; escuro?: boolean } = {}): Modal {
  topo.querySelectorAll(`.${CLASSE_HOST}`).forEach(antigo => antigo.remove());
  const host = el(topo, 'div', CLASSE_HOST);
  // Explícito nos dois sentidos: sem data-tema o diálogo seguiria o sistema, e não o SEI.
  host.setAttribute('data-tema', opcoes.escuro ? 'escuro' : 'claro');
  const raiz = host.attachShadow({ mode: 'open' });
  const estilo = topo.createElement('style');
  estilo.textContent = opcoes.css ?? '';

  const dialogo = el(topo, 'dialog', 'spro-dialogo spro-blk-dialogo');
  dialogo.setAttribute('aria-labelledby', 'spro-blk-titulo');
  const titulo = el(topo, 'h2', '', 'Retornar bloco disponibilizado');
  titulo.id = 'spro-blk-titulo';
  const marca = el(topo, 'span', 'spro-dialogo-icone');
  marca.setAttribute('aria-hidden', 'true');
  marca.append(icone('restaurar', 18, topo));
  const fecharX = botao(topo, 'spro-botao-icone', '');
  fecharX.setAttribute('aria-label', 'Fechar');
  fecharX.title = 'Fechar (Esc)';
  fecharX.dataset.sproFechar = '';
  fecharX.append(icone('fechar', 16, topo));
  const cabecalho = topo.createElement('header');
  cabecalho.append(marca, titulo, fecharX);

  const explicacao = el(topo, 'p', 'spro-blk-texto',
    'O retorno cancela a disponibilização para outras unidades e libera o bloco para incluir novos documentos. Depois da inclusão, você pode disponibilizá-lo novamente.');
  const status = el(topo, 'p', 'spro-blk-status', 'Carregando blocos disponibilizados…');
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  const lista = el(topo, 'fieldset', 'spro-blk-lista');
  lista.hidden = true;
  lista.append(el(topo, 'legend', '', 'Selecione o bloco'));

  const confirmar = botao(topo, 'spro-botao primario', 'Retornar bloco');
  confirmar.dataset.sproConfirmar = '';
  confirmar.disabled = true;
  const rodape = el(topo, 'div', 'spro-dialogo-rodape');
  rodape.append(confirmar);
  const corpo = el(topo, 'div', 'spro-dialogo-corpo');
  corpo.append(explicacao, status, lista, rodape);
  dialogo.append(cabecalho, corpo);
  raiz.append(estilo, dialogo);

  const remover = () => {
    if (typeof dialogo.close === 'function' && dialogo.open) dialogo.close();
    host.remove();
  };
  dialogo.addEventListener('close', () => host.remove());
  return {
    host, raiz, dialogo, titulo, explicacao, status, lista, confirmar, fecharX, remover,
    abrir() {
      (topo.body ?? topo.documentElement).append(host);
      if (typeof dialogo.showModal === 'function') dialogo.showModal();
      else dialogo.setAttribute('open', '');
    },
  };
}
