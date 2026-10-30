import assert from 'node:assert/strict';
import { type Config, configVazia } from '../src/modelo';
import { abrirModal } from '../src/modal';
import { listarPaineis } from '../src/paineis';
import { hostsAbertos, paginaComPaineis, raizModal } from './util';

const IDS = ['processosSEIPro', 'favoritesPro', 'atividadesPro', 'projetosGantt'];
const cfg = (ordem: string[], ocultos: string[] = []): Config => ({ v: 1, ordem, ocultos });

const itens = (d: Document) => [...raizModal(d).querySelectorAll<HTMLElement>('.spro-pnl-item')];
const ids = (d: Document) => itens(d).map(i => i.getAttribute('data-id'));
const botao = (d: Document, id: string, classe: string) => raizModal(d).querySelector<HTMLButtonElement>(`.spro-pnl-item[data-id="${id}"] .${classe}`)!;
const caixa = (d: Document, id: string) => raizModal(d).querySelector<HTMLInputElement>(`.spro-pnl-item[data-id="${id}"] input[type=checkbox]`);
/** O linkedom não alterna a caixa no click: o teste define o valor e dispara o `change`, como o navegador. */
function alternar(d: Document, id: string, marcada: boolean) {
  const c = caixa(d, id)!;
  c.checked = marcada;
  c.dispatchEvent(new (d.defaultView as unknown as { Event: typeof Event }).Event('change', { bubbles: true }));
}
const rodape = (d: Document, classe: string) => raizModal(d).querySelector<HTMLButtonElement>(`.spro-pnl-rodape .${classe}`)!;

function abrir(c: Config = configVazia(), presentes = IDS) {
  const d = paginaComPaineis(presentes);
  const salvos: Config[] = [];
  const modal = abrirModal(d, listarPaineis(d), c, novo => salvos.push(novo));
  return { d, salvos, modal };
}

function evento(d: Document, tipo: string, extra: Record<string, unknown> = {}) {
  const ev = new (d.defaultView as unknown as { Event: typeof Event }).Event(tipo, { bubbles: true, cancelable: true });
  const dados = new Map<string, string>();
  Object.defineProperty(ev, 'dataTransfer', { value: { effectAllowed: '', dropEffect: '', setData: (k: string, v: string) => dados.set(k, v), getData: (k: string) => dados.get(k) ?? '' } });
  for (const [k, v] of Object.entries(extra)) Object.defineProperty(ev, k, { value: v });
  return ev;
}

export async function verificarModal(teste: (nome: string, fn: () => void | Promise<void>) => Promise<void>): Promise<void> {
  await teste('modal: lista os painéis na ordem efetiva; o Controle de Processos não tem caixa "Mostrar"', () => {
    const { d } = abrir(cfg(['favoritesPro']));
    assert.deepEqual(ids(d), ['favoritesPro', 'processosSEIPro', 'atividadesPro', 'projetosGantt']);
    assert.equal(caixa(d, 'processosSEIPro'), null);
    assert.equal(caixa(d, 'favoritesPro')!.checked, true);
    assert.match(raizModal(d).querySelector('.spro-pnl-item[data-id="processosSEIPro"]')!.textContent!, /Controle de Processos/);
    assert.equal(raizModal(d).querySelector('dialog')!.hasAttribute('open'), true);
  });
  await teste('modal: painéis ocultos aparecem desmarcados (para poder reexibir)', () => {
    const { d } = abrir(cfg([], ['atividadesPro']));
    assert.equal(caixa(d, 'atividadesPro')!.checked, false);
    assert.equal(caixa(d, 'favoritesPro')!.checked, true);
  });
  await teste('modal: descer e subir mudam a ordem; as pontas ficam desabilitadas', () => {
    const { d } = abrir();
    assert.equal(botao(d, 'processosSEIPro', 'spro-pnl-subir').disabled, true);
    assert.equal(botao(d, 'projetosGantt', 'spro-pnl-descer').disabled, true);
    botao(d, 'processosSEIPro', 'spro-pnl-descer').click();
    assert.deepEqual(ids(d), ['favoritesPro', 'processosSEIPro', 'atividadesPro', 'projetosGantt']);
    botao(d, 'projetosGantt', 'spro-pnl-subir').click();
    assert.deepEqual(ids(d), ['favoritesPro', 'processosSEIPro', 'projetosGantt', 'atividadesPro']);
    assert.equal(botao(d, 'favoritesPro', 'spro-pnl-subir').disabled, true);
  });
  await teste('modal: cada movimento é anunciado a leitores de tela', () => {
    const { d } = abrir();
    botao(d, 'favoritesPro', 'spro-pnl-descer').click();
    assert.match(raizModal(d).querySelector('[aria-live]')!.textContent!, /Monitorados.*posição 3 de 4/);
  });
  await teste('modal: arrastar e soltar (antes e depois do alvo)', () => {
    const { d } = abrir();
    const origem = itens(d)[0]!;
    origem.dispatchEvent(evento(d, 'dragstart'));
    const alvo = raizModal(d).querySelector<HTMLElement>('.spro-pnl-item[data-id="atividadesPro"]')!;
    alvo.dispatchEvent(evento(d, 'dragover', { clientY: 10 })); // retângulo zerado: 10 > ponto médio => depois
    alvo.dispatchEvent(evento(d, 'drop', { clientY: 10 }));
    assert.deepEqual(ids(d), ['favoritesPro', 'atividadesPro', 'processosSEIPro', 'projetosGantt']);
    const dois = raizModal(d).querySelector<HTMLElement>('.spro-pnl-item[data-id="favoritesPro"]')!;
    dois.dispatchEvent(evento(d, 'dragstart'));
    const topo = raizModal(d).querySelector<HTMLElement>('.spro-pnl-item[data-id="projetosGantt"]')!;
    topo.dispatchEvent(evento(d, 'dragover', { clientY: -10 })); // antes
    topo.dispatchEvent(evento(d, 'drop', { clientY: -10 }));
    assert.deepEqual(ids(d), ['atividadesPro', 'processosSEIPro', 'favoritesPro', 'projetosGantt']);
  });
  await teste('modal: soltar sobre si mesmo ou sem arrasto não muda nada', () => {
    const { d } = abrir();
    const alvo = itens(d)[1]!;
    alvo.dispatchEvent(evento(d, 'drop', { clientY: 5 }));
    alvo.dispatchEvent(evento(d, 'dragstart'));
    alvo.dispatchEvent(evento(d, 'drop', { clientY: 5 }));
    assert.deepEqual(ids(d), IDS);
  });
  await teste('modal: Salvar entrega a configuração, preservando ids ausentes, e fecha', () => {
    const { d, salvos } = abrir(cfg(['projetosGantt', 'fantasma'], ['fantasma']), ['processosSEIPro', 'favoritesPro', 'projetosGantt']);
    botao(d, 'favoritesPro', 'spro-pnl-subir').click();
    alternar(d, 'projetosGantt', false);
    rodape(d, 'spro-pnl-salvar').click();
    assert.equal(salvos.length, 1);
    assert.deepEqual(salvos[0], { v: 1, ordem: ['projetosGantt', 'favoritesPro', 'processosSEIPro', 'fantasma'], ocultos: ['projetosGantt', 'fantasma'] });
    assert.equal(hostsAbertos(d), 0);
  });
  await teste('modal: o X e o evento de fechar do <dialog> não gravam (não há botão Cancelar)', () => {
    const a = abrir();
    assert.equal(raizModal(a.d).querySelector('.spro-pnl-cancelar'), null);
    botao(a.d, 'processosSEIPro', 'spro-pnl-descer').click();
    raizModal(a.d).querySelector<HTMLButtonElement>('.spro-pnl-x')!.click();
    assert.equal(a.salvos.length, 0);
    assert.equal(hostsAbertos(a.d), 0);
    const b = abrir();
    raizModal(b.d).querySelector('dialog')!.dispatchEvent(new (b.d.defaultView as unknown as { Event: typeof Event }).Event('close'));
    assert.equal(b.salvos.length, 0);
    assert.equal(hostsAbertos(b.d), 0);
  });
  await teste('modal: Restaurar padrão volta à ordem natural com tudo visível', () => {
    const { d, salvos } = abrir(cfg(['projetosGantt', 'favoritesPro'], ['atividadesPro']));
    rodape(d, 'spro-pnl-restaurar').click();
    assert.deepEqual(ids(d), IDS);
    assert.equal(caixa(d, 'atividadesPro')!.checked, true);
    rodape(d, 'spro-pnl-salvar').click();
    assert.deepEqual(salvos[0], { v: 1, ordem: [], ocultos: [] });
  });
  await teste('modal: abrir de novo não empilha diálogos', () => {
    const { d, modal } = abrir();
    abrirModal(d, listarPaineis(d), configVazia(), () => {});
    assert.equal(hostsAbertos(d), 1);
    modal.fechar();
  });
  await teste('modal: usa o desenho compartilhado (dialog.spro-dialogo) com o CSS e o tema recebidos', () => {
    const d = paginaComPaineis(IDS);
    abrirModal(d, listarPaineis(d), configVazia(), () => {}, { css: '.x{color:red}', escuro: true });
    const host = d.querySelector('.spro-pnl-host')!;
    assert.equal(host.getAttribute('data-tema'), 'escuro');
    assert.equal(host.shadowRoot!.querySelector('style')!.textContent, '.x{color:red}');
    assert.ok(host.shadowRoot!.querySelector('dialog.spro-dialogo > header .spro-dialogo-icone'));
    assert.ok(host.shadowRoot!.querySelector('dialog.spro-dialogo .spro-dialogo-rodape .spro-botao.primario'));
    assert.equal(d.querySelector('dialog'), null, 'nada do modal vaza para o DOM da página');
    const claro = abrir();
    assert.equal(claro.d.querySelector('.spro-pnl-host')!.getAttribute('data-tema'), 'claro');
  });
}
