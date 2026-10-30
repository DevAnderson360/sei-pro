import assert from 'node:assert/strict';
import { configVazia, deLegado, mover, nomeConhecido, normalizar, ordenar, personalizada, PROTEGIDOS, salvarConfig } from '../src/modelo';

export async function verificarModelo(teste: (nome: string, fn: () => void | Promise<void>) => Promise<void>): Promise<void> {
  await teste('normalizar: valor inválido vira configuração vazia, sem lançar', () => {
    for (const lixo of [null, undefined, 42, 'x', [], { ordem: 'a' }, { ordem: [1, {}, null], ocultos: 'b' }]) {
      assert.deepEqual(normalizar(lixo), configVazia());
    }
  });
  await teste('normalizar: tira duplicados, ids inválidos e o painel protegido dos ocultos', () => {
    const cfg = normalizar({ v: 1, ordem: ['favoritesPro', 'favoritesPro', '<b>', 'atividadesPro', ''], ocultos: ['processosSEIPro', 'projetosGantt', 'projetosGantt'] });
    assert.deepEqual(cfg, { v: 1, ordem: ['favoritesPro', 'atividadesPro'], ocultos: ['projetosGantt'] });
  });
  await teste('normalizar: limita o tamanho da lista', () => {
    const muitos = Array.from({ length: 200 }, (_, i) => `p${i}`);
    assert.equal(normalizar({ ordem: muitos }).ordem.length, 50);
  });
  await teste('personalizada: só com ordem ou ocultos', () => {
    assert.equal(personalizada(configVazia()), false);
    assert.equal(personalizada({ v: 1, ordem: ['a'], ocultos: [] }), true);
    assert.equal(personalizada({ v: 1, ordem: [], ocultos: ['a'] }), true);
  });
  await teste('ordenar: ids salvos primeiro, na ordem salva; o resto no natural; ausentes ignorados', () => {
    const cfg = { v: 1 as const, ordem: ['favoritesPro', 'fantasma', 'processosSEIPro'], ocultos: [] };
    assert.deepEqual(ordenar(['processosSEIPro', 'atividadesPro', 'favoritesPro', 'projetosGantt'], cfg), ['favoritesPro', 'processosSEIPro', 'atividadesPro', 'projetosGantt']);
  });
  await teste('ordenar: sem configuração mantém a ordem natural', () => {
    assert.deepEqual(ordenar(['b', 'a', 'c'], configVazia()), ['b', 'a', 'c']);
  });
  await teste('salvarConfig: guarda a ordem mostrada e preserva ids ausentes (ordem e ocultos)', () => {
    const anterior = { v: 1 as const, ordem: ['projetosGantt', 'favoritesPro'], ocultos: ['projetosGantt'] };
    const novo = salvarConfig(anterior, ['processosSEIPro', 'favoritesPro'], ['favoritesPro']);
    assert.deepEqual(novo, { v: 1, ordem: ['processosSEIPro', 'favoritesPro', 'projetosGantt'], ocultos: ['favoritesPro', 'projetosGantt'] });
  });
  await teste('salvarConfig: o painel protegido nunca fica oculto', () => {
    const novo = salvarConfig(configVazia(), ['processosSEIPro', 'favoritesPro'], ['processosSEIPro']);
    assert.deepEqual(novo.ocultos, []);
    assert.deepEqual(PROTEGIDOS, ['processosSEIPro']);
  });
  await teste('deLegado: lê orderPanelHome do optionsPro e ordena pelo índice', () => {
    const op = JSON.stringify({ orderPanelHome: [{ name: 'favoritesPro', index: 2 }, { name: 'processosSEIPro', index: 0 }, { name: 'atividadesPro', index: 1 }] });
    assert.deepEqual(deLegado(op), { v: 1, ordem: ['processosSEIPro', 'atividadesPro', 'favoritesPro'], ocultos: [] });
  });
  await teste('deLegado: ausente, vazio ou corrompido devolve null', () => {
    for (const x of [null, '', '{', '{}', JSON.stringify({ orderPanelHome: [] }), JSON.stringify({ orderPanelHome: 'x' })]) assert.equal(deLegado(x), null);
  });
  await teste('mover: sem mutar, com limites', () => {
    const l = ['a', 'b', 'c', 'd'];
    assert.deepEqual(mover(l, 0, 2), ['b', 'c', 'a', 'd']);
    assert.deepEqual(mover(l, 3, 0), ['d', 'a', 'b', 'c']);
    assert.deepEqual(mover(l, 1, 99), ['a', 'c', 'd', 'b']);
    assert.deepEqual(mover(l, 1, -5), ['b', 'a', 'c', 'd']);
    assert.deepEqual(mover(l, 9, 0), l);
    assert.deepEqual(l, ['a', 'b', 'c', 'd']);
  });
  await teste('nomeConhecido: rótulos dos painéis do Pro; desconhecido é null', () => {
    assert.equal(nomeConhecido('favoritesPro'), 'Monitorados');
    assert.equal(nomeConhecido('processosSEIPro'), 'Controle de Processos');
    assert.equal(nomeConhecido('projetosPro'), 'Projetos');
    assert.equal(nomeConhecido('outro'), null);
  });
}
