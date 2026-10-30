/**
 * Edicoes dinamicas (responsavel, anotacao, marcadores): cada uma abre um modal no mesmo desenho do modal de Prazos,
 * mostra o estado atual, deixa mudar e grava no SEI. A tela muda NA HORA (atualizacao otimista) e volta atras, com
 * aviso, se o SEI recusar. Responsavel e marcadores podem valer tambem para os processos selecionados.
 */
import { criarCombo } from '../../../sei-comum/src/ui/combobox';
import { h, icone } from '../../../sei-comum/src/ui/dom';
import { alvosDaEdicao, aplicarAnotacao, aplicarMarcadores, aplicarResponsavel, MAX_ANOTACAO, MAX_TEXTO_MARCADOR, type MarcadorDesejado, opsParaProcesso, planoMarcadores, textoAnotacao } from '../modelo/edicoes';
import type { ExtrasQuadro } from '../modelo/quadro';
import type { Processo } from '../modelo/tipos';
import { abrirModalGrade } from './modal';
import { criarPostit } from './postit';
import { corDoMarcador } from './cores';

export interface DepsEdicao {
  raiz: ShadowRoot;
  extras(): Promise<ExtrasQuadro>;
  todos(): Processo[];
  selecionados(): ReadonlySet<string>;
  corDoMarcador(nome: string): string;
  /** Quem esta logado (autor da anotacao que acabou de criar). */
  autor: string;
  /** Muda o processo na tela; a linha nativa so o confirma depois. */
  aplicarLocal(id: string, novo: Processo): void;
  /** Gravacoes em serie (uma por vez) e contadas, para a sincronia nao desfazer a otimista. */
  gravar<T>(fn: () => Promise<T>): Promise<T>;
  atribuir(protocolo: string, sigla: string | null): Promise<void>;
  marcar(protocolo: string, m: { marcador: string; texto?: string; remover?: boolean }): Promise<void>;
  anotar(protocolo: string, a: { texto: string; prioridade: boolean }): Promise<void>;
  aviso(texto: string): void;
}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

async function aplicarEm(d: DepsEdicao, alvos: Processo[], otimista: (p: Processo) => Processo, gravar: (p: Processo) => Promise<void>, aoProgresso?: (feitos: number, total: number) => void): Promise<{ ok: number; falhas: string[] }> {
  let ok = 0;
  const falhas: string[] = [];
  let feitos = 0;
  for (const alvo of alvos) {
    const original = d.todos().find((p) => p.id === alvo.id) ?? alvo;
    d.aplicarLocal(original.id, otimista(original));
    try {
      await d.gravar(() => gravar(original));
      ok += 1;
    } catch (e) {
      d.aplicarLocal(original.id, original);
      falhas.push(`${original.protocolo}: ${msg(e)}`);
    }
    aoProgresso?.((feitos += 1), alvos.length);
  }
  return { ok, falhas };
}

function resumo(d: DepsEdicao, o: { ok: number; falhas: string[] }, oque: string): void {
  if (!o.falhas.length) d.aviso(`${oque}: ${o.ok} ${o.ok === 1 ? 'processo atualizado' : 'processos atualizados'}.`);
  else d.aviso(`${oque}: ${o.ok} ok, ${o.falhas.length} com erro — ${o.falhas[0]}`);
}

/** "Aplicar aos N selecionados" so aparece se ha outros selecionados alem deste. */
function caixaEstender(d: DepsEdicao, p: Processo, permite: (x: Processo) => boolean): { el: HTMLElement; marcado(): boolean; n(): number } | null {
  const outros = alvosDaEdicao(p, d.selecionados(), d.todos(), true, permite).filter((x) => x.id !== p.id);
  if (!outros.length) return null;
  const cb = h('input', { type: 'checkbox' });
  return {
    el: h('label', { class: 'spro-rotulo-linha spro-estender' }, cb, ` Aplicar também aos ${outros.length} ${outros.length === 1 ? 'outro selecionado' : 'outros selecionados'}`),
    marcado: () => cb.checked,
    n: () => outros.length,
  };
}

const rodape = (...filhos: Array<HTMLElement | null>) => h('div', { class: 'spro-dialogo-rodape' }, ...filhos);
const salvarBotao = (rotulo = 'Salvar') => h('button', { type: 'button', class: 'spro-botao primario' }, icone('check', 15), rotulo);

// ---------------------------------------------------------------- responsavel
export function editarResponsavel(d: DepsEdicao, p: Processo): void {
  let usuarios: Array<{ sigla: string; nome: string }> = [];
  let escolhido = p.atribuicao?.sigla ?? '';
  const combo = criarCombo({
    rotulo: 'Responsável', icone: 'pessoa', busca: true, larguraLista: 320, vazio: 'Escolher o responsável…',
    opcoes: () => [{ valor: '', rotulo: 'Sem responsável', descricao: 'Remove a atribuição' }, ...usuarios.map((u) => ({ valor: u.sigla, rotulo: u.nome === u.sigla ? u.sigla : u.nome, descricao: u.sigla }))],
    valor: [escolhido], aoMudar: ([v]) => { escolhido = v ?? ''; atualizar(); },
  });
  const estender = caixaEstender(d, p, () => true);
  const salvar = salvarBotao();
  const estado = h('p', { class: 'spro-suave' }, 'Carregando os usuários da unidade…');
  const atualizar = () => { salvar.disabled = !usuarios.length || escolhido === (p.atribuicao?.sigla ?? ''); };
  const modal = abrirModalGrade(d.raiz, {
    titulo: 'Responsável', subtitulo: p.protocolo, icone: 'pessoa',
    conteudo: h('div', { class: 'spro-form' }, h('label', { class: 'spro-campo-rotulo' }, 'Atribuir a', combo.el), estado, estender?.el ?? null, rodape(salvar)),
  });
  void d.extras().then((e) => {
    usuarios = e.responsaveis ?? [];
    estado.textContent = usuarios.length ? '' : 'Não foi possível ler os usuários da unidade.';
    combo.atualizar();
    atualizar();
  }).catch(() => { estado.textContent = 'Não foi possível ler os usuários da unidade.'; });
  atualizar();
  salvar.addEventListener('click', async () => {
    const destino = escolhido ? (usuarios.find((u) => u.sigla === escolhido) ?? { sigla: escolhido, nome: escolhido }) : null;
    const alvos = estender?.marcado() ? alvosDaEdicao(p, d.selecionados(), d.todos(), true, () => true) : [p];
    salvar.disabled = true;
    modal.fechar();
    resumo(d, await aplicarEm(d, alvos, (x) => aplicarResponsavel(x, destino), (x) => d.atribuir(x.protocolo, destino?.sigla ?? null)), destino ? `Responsável: ${destino.nome}` : 'Atribuição removida');
  });
}

// ---------------------------------------------------------------- anotacao
export function editarAnotacao(d: DepsEdicao, p: Processo): void {
  const postit = criarPostit({ texto: p.anotacao?.texto ?? '', prioridade: p.anotacao?.prioridade ?? false }, d.raiz);
  const salvar = salvarBotao();
  const remover = p.anotacao ? h('button', { type: 'button', class: 'spro-botao perigo' }, icone('lixeira', 15), 'Remover anotação') : null;
  const atualizar = () => {
    const t = textoAnotacao(postit.texto());
    const estourou = postit.texto().length > MAX_ANOTACAO;
    salvar.disabled = !t || estourou || (t === (p.anotacao?.texto ?? '') && postit.prioridade() === (p.anotacao?.prioridade ?? false));
  };
  postit.aoMudar(atualizar);
  const modal = abrirModalGrade(d.raiz, {
    titulo: 'Anotação', subtitulo: p.protocolo, icone: 'nota', largo: true,
    conteudo: h('div', { class: 'spro-form' }, postit.el,
      p.anotacao?.autor ? h('p', { class: 'spro-suave' }, `Última edição: ${p.anotacao.autor}`) : null, rodape(remover, salvar)),
  });
  postit.foco();
  atualizar();
  const gravar = async (texto: string, prioridade: boolean, oque: string) => {
    modal.fechar();
    resumo(d, await aplicarEm(d, [p], (x) => aplicarAnotacao(x, texto, prioridade, d.autor), (x) => d.anotar(x.protocolo, { texto, prioridade })), oque);
  };
  salvar.addEventListener('click', () => void gravar(textoAnotacao(postit.texto()), postit.prioridade(), 'Anotação salva'));
  remover?.addEventListener('click', () => void gravar('', false, 'Anotação removida'));
}

// ---------------------------------------------------------------- marcadores
export function editarMarcadores(d: DepsEdicao, p: Processo): void {
  let itens: MarcadorDesejado[] = p.marcadores.map((m) => ({ nome: m.nome, texto: m.texto }));
  let disponiveis: string[] = [];
  const lista = h('div', { class: 'spro-marcadores-lista' });
  const estender = caixaEstender(d, p, (x) => !x.sigiloso);
  const salvar = salvarBotao();
  const estado = h('p', { class: 'spro-suave' }, 'Carregando os marcadores da unidade…');
  const combo = criarCombo({
    rotulo: 'Adicionar marcador', icone: 'etiqueta', busca: true, larguraLista: 320, vazio: 'Adicionar marcador…',
    opcoes: () => disponiveis.filter((n) => !itens.some((i) => i.nome.toLowerCase() === n.toLowerCase())).map((n) => ({ valor: n, rotulo: n, cor: corDoMarcador(d.corDoMarcador(n)) })),
    aoMudar: ([v]) => { if (v) { itens = [...itens, { nome: v, texto: '' }]; combo.definir([], false); desenhar(); } },
  });
  const plano = () => planoMarcadores(p.marcadores, itens);
  function desenhar() {
    lista.replaceChildren(...(itens.length ? itens.map((it, i) => {
      const entrada = h('input', { type: 'text', class: 'spro-campo', maxlength: String(MAX_TEXTO_MARCADOR), placeholder: 'Texto do marcador (opcional)', 'aria-label': `Texto de ${it.nome}`, value: it.texto });
      entrada.addEventListener('input', () => { itens[i] = { ...it, texto: entrada.value }; salvar.disabled = !plano().length; });
      return h('div', { class: 'spro-marcador-linha' },
        h('span', { class: 'spro-marcador', title: it.nome }, h('i', { style: `background:${corDoMarcador(d.corDoMarcador(it.nome))}` }), it.nome),
        entrada,
        h('button', { type: 'button', class: 'spro-botao-icone pequeno', title: `Remover ${it.nome}`, 'aria-label': `Remover ${it.nome}`, onclick: () => { itens = itens.filter((_, j) => j !== i); desenhar(); } }, icone('fechar', 13)));
    }) : [h('p', { class: 'spro-suave' }, 'Nenhum marcador. Adicione abaixo.')]));
    combo.atualizar();
    salvar.disabled = !plano().length;
  }
  const modal = abrirModalGrade(d.raiz, { titulo: 'Marcadores', subtitulo: p.protocolo, icone: 'etiqueta', conteudo: h('div', { class: 'spro-form' }, lista, combo.el, estado, estender?.el ?? null, rodape(salvar)) });
  desenhar();
  void d.extras().then((e) => { disponiveis = e.marcadores ?? []; estado.textContent = disponiveis.length ? '' : 'Não foi possível ler os marcadores da unidade.'; desenhar(); }).catch(() => { estado.textContent = 'Não foi possível ler os marcadores da unidade.'; });
  salvar.addEventListener('click', async () => {
    const ops = plano();
    if (!ops.length) return;
    const alvos = estender?.marcado() ? alvosDaEdicao(p, d.selecionados(), d.todos(), true, (x) => !x.sigiloso) : [p];
    modal.fechar();
    resumo(d, await aplicarEm(d, alvos, (x) => aplicarMarcadores(x, opsParaProcesso(ops, x), d.corDoMarcador),
      async (x) => {
        for (const o of opsParaProcesso(ops, x)) {
          if (o.tipo === 'remover') await d.marcar(x.protocolo, { marcador: o.nome, remover: true });
          else await d.marcar(x.protocolo, { marcador: o.nome, texto: o.texto });
        }
      }), 'Marcadores');
  });
}
