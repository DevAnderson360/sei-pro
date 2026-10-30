/**
 * O modal "Ordem dos painéis": lista dos painéis da página, arrastável (ou pelos botões subir/descer,
 * para teclado e toque), com a caixa "Mostrar" de cada um. Só grava ao Salvar. Tudo por
 * `createElement`/`textContent`: nomes de painel entram como texto, nunca como HTML.
 *
 * Mesmo desenho dos diálogos dos Favoritos e dos Projetos: o `dialog.spro-dialogo` do base.css do
 * sei-comum, dentro de um Shadow DOM (como o balão dos Favoritos), para o CSS do SEI e o modo noturno
 * do legado não o alcançarem. `css` é o base.css + modal.css, que chegam de fora porque só o main.ts
 * importa `.css` (os testes rodam o código-fonte direto).
 */
import { icone } from '../../sei-comum/src/ui/dom';
import { type Config, ordenar, PROTEGIDOS, mover, salvarConfig } from './modelo';
import type { Painel } from './paineis';

interface Item {
  id: string;
  nome: string;
  mostrar: boolean;
  protegido: boolean;
}

function el<K extends keyof HTMLElementTagNameMap>(doc: Document, tag: K, classe: string, texto?: string): HTMLElementTagNameMap[K] {
  const e = doc.createElement(tag);
  e.className = classe;
  if (texto !== undefined) e.textContent = texto;
  return e;
}

function botao(doc: Document, classe: string, rotulo: string, texto?: string): HTMLButtonElement {
  const b = el(doc, 'button', classe, texto);
  b.type = 'button';
  if (!texto) {
    b.setAttribute('aria-label', rotulo);
    b.title = rotulo;
  }
  return b;
}

export interface OpcoesModal {
  css?: string;
  escuro?: boolean;
}

export const CLASSE_HOST = 'spro-pnl-host';

export function abrirModal(
  doc: Document,
  paineis: Painel[],
  cfg: Config,
  aoSalvar: (nova: Config) => void,
  opcoes: OpcoesModal = {},
): { fechar(): void } {
  doc.querySelectorAll(`.${CLASSE_HOST}`).forEach(antigo => antigo.remove());
  const naturais = paineis.map(p => p.id);
  const nomes = new Map(paineis.map(p => [p.id, p.nome]));
  const montar = (c: Config): Item[] =>
    ordenar(naturais, c).map(id => ({ id, nome: nomes.get(id) ?? id, mostrar: !c.ocultos.includes(id) || PROTEGIDOS.includes(id), protegido: PROTEGIDOS.includes(id) }));
  let itens = montar(cfg);
  let arrastando: string | null = null;
  let foco: { id: string; classe: string } | null = null;

  const host = el(doc, 'div', CLASSE_HOST);
  // Explícito nos dois sentidos: sem data-tema o diálogo seguiria o sistema, e não o SEI.
  host.setAttribute('data-tema', opcoes.escuro ? 'escuro' : 'claro');
  const raiz: ParentNode = host.attachShadow({ mode: 'open' });
  const estilo = doc.createElement('style');
  estilo.textContent = opcoes.css ?? '';
  const dialogo = el(doc, 'dialog', 'spro-dialogo spro-pnl-dialogo');
  dialogo.setAttribute('aria-labelledby', 'spro-pnl-titulo');
  const titulo = el(doc, 'h2', 'spro-pnl-titulo', 'Ordem dos painéis');
  titulo.id = 'spro-pnl-titulo';
  const fecharX = botao(doc, 'spro-botao-icone spro-pnl-x', 'Fechar (Esc)');
  fecharX.append(icone('fechar', 16, doc));
  const marca = el(doc, 'span', 'spro-dialogo-icone');
  marca.setAttribute('aria-hidden', 'true');
  marca.append(icone('ordenar', 18, doc));
  const cabecalho = doc.createElement('header');
  cabecalho.append(marca, titulo, fecharX);
  const dica = el(doc, 'p', 'spro-pnl-dica', 'Arraste pela alça, ou use as setas, para mudar a ordem. Desmarque "Mostrar" para ocultar um painel.');
  const lista = el(doc, 'ul', 'spro-pnl-lista');
  lista.setAttribute('role', 'list');
  const aviso = el(doc, 'div', 'spro-pnl-aviso');
  aviso.setAttribute('aria-live', 'polite');
  const restaurar = botao(doc, 'spro-botao spro-esquerda spro-pnl-restaurar', '', 'Restaurar padrão');
  const salvar = botao(doc, 'spro-botao primario spro-pnl-salvar', '', 'Salvar');
  const rodape = el(doc, 'div', 'spro-dialogo-rodape spro-pnl-rodape');
  rodape.append(restaurar, salvar);
  const corpo = el(doc, 'div', 'spro-dialogo-corpo');
  corpo.append(dica, lista, aviso, rodape);
  dialogo.append(cabecalho, corpo);
  raiz.append(estilo, dialogo);

  const limparMarcas = () => lista.querySelectorAll('.spro-pnl-antes, .spro-pnl-depois').forEach(e => e.classList.remove('spro-pnl-antes', 'spro-pnl-depois'));
  const posicao = (id: string) => itens.findIndex(i => i.id === id);
  const moverPara = (id: string, para: number, anunciar: boolean) => {
    const de = posicao(id);
    if (de < 0 || de === para) return;
    itens = mover(itens, de, para);
    if (anunciar) aviso.textContent = `${itens[posicao(id)]!.nome} na posição ${posicao(id) + 1} de ${itens.length}`;
    desenhar();
  };

  function desenharItem(item: Item, i: number): HTMLLIElement {
    const li = el(doc, 'li', 'spro-pnl-item');
    li.setAttribute('data-id', item.id);
    li.setAttribute('draggable', 'true');
    const alca = el(doc, 'span', 'spro-pnl-alca');
    alca.setAttribute('aria-hidden', 'true');
    alca.append(icone('alca', 16, doc));
    li.append(alca, el(doc, 'span', 'spro-pnl-nome', item.nome));
    if (item.protegido) {
      li.append(el(doc, 'span', 'spro-pnl-fixo', 'Sempre visível'));
    } else {
      const rotulo = el(doc, 'label', 'spro-pnl-mostrar');
      const caixa = doc.createElement('input');
      caixa.type = 'checkbox';
      caixa.checked = item.mostrar;
      caixa.setAttribute('aria-label', `Mostrar ${item.nome}`);
      caixa.addEventListener('change', () => { item.mostrar = caixa.checked; });
      rotulo.append(caixa, doc.createTextNode(' Mostrar'));
      li.append(rotulo);
    }
    const subir = botao(doc, 'spro-botao-icone pequeno spro-pnl-subir spro-pnl-seta', `Subir ${item.nome}`);
    subir.append(icone('subir', 16, doc));
    subir.disabled = i === 0;
    subir.addEventListener('click', () => { foco = { id: item.id, classe: i === 1 ? 'spro-pnl-descer' : 'spro-pnl-subir' }; moverPara(item.id, i - 1, true); });
    const descer = botao(doc, 'spro-botao-icone pequeno spro-pnl-descer spro-pnl-seta', `Descer ${item.nome}`);
    descer.append(icone('subir', 16, doc));
    descer.disabled = i === itens.length - 1;
    descer.addEventListener('click', () => { foco = { id: item.id, classe: i === itens.length - 2 ? 'spro-pnl-subir' : 'spro-pnl-descer' }; moverPara(item.id, i + 1, true); });
    li.append(subir, descer);

    li.addEventListener('dragstart', ev => {
      arrastando = item.id;
      if (ev.dataTransfer) {
        ev.dataTransfer.effectAllowed = 'move';
        ev.dataTransfer.setData('text/plain', item.id);
      }
      li.classList.add('spro-pnl-arrastando');
    });
    li.addEventListener('dragend', () => { arrastando = null; li.classList.remove('spro-pnl-arrastando'); limparMarcas(); });
    li.addEventListener('dragover', ev => {
      if (!arrastando || arrastando === item.id) return;
      ev.preventDefault();
      if (ev.dataTransfer) ev.dataTransfer.dropEffect = 'move';
      const caixa = li.getBoundingClientRect();
      limparMarcas();
      li.classList.add(ev.clientY > caixa.top + caixa.height / 2 ? 'spro-pnl-depois' : 'spro-pnl-antes');
    });
    li.addEventListener('drop', ev => {
      if (!arrastando || arrastando === item.id) return;
      ev.preventDefault();
      const caixa = li.getBoundingClientRect();
      const depois = ev.clientY > caixa.top + caixa.height / 2;
      const origem = arrastando;
      arrastando = null;
      limparMarcas();
      const semOrigem = itens.filter(x => x.id !== origem);
      const alvo = semOrigem.findIndex(x => x.id === item.id);
      moverPara(origem, alvo + (depois ? 1 : 0), true);
    });
    return li;
  }

  function desenhar() {
    lista.replaceChildren(...itens.map(desenharItem));
    if (foco) {
      lista.querySelector<HTMLElement>(`.spro-pnl-item[data-id="${foco.id}"] .${foco.classe}`)?.focus();
      foco = null;
    }
  }

  const fechar = () => {
    if (typeof dialogo.close === 'function' && dialogo.open) dialogo.close();
    host.remove();
  };
  fecharX.addEventListener('click', fechar);
  dialogo.addEventListener('close', () => host.remove());
  restaurar.addEventListener('click', () => {
    itens = montar({ v: 1, ordem: [], ocultos: [] });
    aviso.textContent = 'Ordem e visibilidade restauradas ao padrão';
    desenhar();
  });
  salvar.addEventListener('click', () => {
    const ids = itens.map(i => i.id);
    const ocultos = itens.filter(i => !i.mostrar).map(i => i.id);
    const nova = salvarConfig(cfg, ids, ocultos);
    // Na ordem natural e com tudo à mostra não há o que lembrar: some a escolha desses painéis (a dos
    // ausentes fica), em vez de fixar a ordem de hoje.
    if (ocultos.length === 0 && ids.every((id, i) => id === naturais[i])) nova.ordem = nova.ordem.filter(id => !naturais.includes(id));
    aoSalvar(nova);
    fechar();
  });

  desenhar();
  (doc.body ?? doc.documentElement).append(host);
  if (typeof dialogo.showModal === 'function') dialogo.showModal();
  else dialogo.setAttribute('open', '');
  return { fechar };
}
