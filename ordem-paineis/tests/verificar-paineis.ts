import assert from 'node:assert/strict';
import { configVazia } from '../src/modelo';
import { aplicar, listarPaineis } from '../src/paineis';
import { criar, ordemCss, paginaComPaineis } from './util';

const IDS = ['processosSEIPro', 'favoritesPro', 'atividadesPro'];
const cfg = (ordem: string[], ocultos: string[] = []) => ({ v: 1 as const, ordem, ocultos });

export async function verificarPaineis(teste: (nome: string, fn: () => void | Promise<void>) => Promise<void>): Promise<void> {
  await teste('listarPaineis: painéis do contêiner, na ordem do DOM, com nome conhecido ou o do título', () => {
    const d = paginaComPaineis([...IDS, 'novoPainel']);
    const lista = listarPaineis(d);
    assert.deepEqual(lista.map(p => p.id), [...IDS, 'novoPainel']);
    assert.deepEqual(lista.map(p => p.nome), ['Controle de Processos', 'Monitorados', 'Atividades', 'Painel novoPainel']);
    assert.ok(lista.every(p => p.oculto === false));
  });
  await teste('listarPaineis: sem contêiner ou fora da tela de caixa devolve lista vazia', () => {
    assert.deepEqual(listarPaineis(criar('<p>sem painéis</p>')), []);
    assert.deepEqual(listarPaineis(paginaComPaineis([])), []);
  });
  await teste('aplicar: sem personalização a página fica exatamente como o legado a montou', () => {
    const d = paginaComPaineis(IDS);
    const antes = d.body.innerHTML;
    aplicar(d, configVazia());
    assert.equal(d.body.innerHTML, antes);
  });
  await teste('aplicar: ordem vira CSS order, sem mover nenhum nó', () => {
    const d = paginaComPaineis(IDS);
    const nos = IDS.map(id => d.getElementById(id));
    aplicar(d, cfg(['favoritesPro', 'processosSEIPro']));
    assert.ok(d.getElementById('panelHomePro')!.classList.contains('spro-paineis-ativo'));
    assert.deepEqual(['favoritesPro', 'processosSEIPro', 'atividadesPro'].map(id => ordemCss(d.getElementById(id)!)), ['0', '1', '2']);
    assert.deepEqual([...d.getElementById('panelHomePro')!.children], nos, 'a ordem dos nós no DOM não muda');
  });
  await teste('aplicar: oculta pelo atributo; o protegido nunca é ocultado', () => {
    const d = paginaComPaineis(IDS);
    aplicar(d, { v: 1, ordem: [], ocultos: ['favoritesPro', 'processosSEIPro'] });
    assert.equal(d.getElementById('favoritesPro')!.hasAttribute('data-spro-oculto'), true);
    assert.equal(d.getElementById('processosSEIPro')!.hasAttribute('data-spro-oculto'), false);
    assert.equal(listarPaineis(d).find(p => p.id === 'favoritesPro')!.oculto, true);
  });
  await teste('aplicar: idempotente (segunda aplicação não escreve nada)', () => {
    const d = paginaComPaineis(IDS);
    aplicar(d, cfg(['atividadesPro'], ['favoritesPro']));
    const antes = d.body.innerHTML;
    let mutacoes = 0;
    const obs = new (d.defaultView as unknown as { MutationObserver: typeof MutationObserver }).MutationObserver(m => { mutacoes += m.length; });
    obs.observe(d.body, { attributes: true, childList: true, subtree: true });
    aplicar(d, cfg(['atividadesPro'], ['favoritesPro']));
    assert.equal(d.body.innerHTML, antes);
    assert.equal(mutacoes, 0);
    obs.disconnect();
  });
  await teste('aplicar: voltar à configuração vazia desfaz tudo', () => {
    const d = paginaComPaineis(IDS);
    // O linkedom reformata o atributo style ao remover uma propriedade; o que importa é o resto e as declarações.
    const sem = (html: string) => html.replace(/ style="[^"]*"/g, '');
    const antes = d.body.innerHTML;
    aplicar(d, cfg(['favoritesPro'], ['atividadesPro']));
    assert.notEqual(sem(d.body.innerHTML), sem(antes));
    aplicar(d, configVazia());
    assert.equal(sem(d.body.innerHTML), sem(antes));
    assert.equal(ordemCss(d.getElementById('favoritesPro')!), '');
    assert.equal(d.getElementById('favoritesPro')!.style.getPropertyValue('width'), '100%');
  });
  await teste('aplicar: ordem igual à natural, ou só com ids ausentes, não personaliza nada', () => {
    const d = paginaComPaineis(IDS);
    const antes = d.body.innerHTML;
    aplicar(d, cfg(IDS));
    assert.equal(d.body.innerHTML, antes);
    aplicar(d, cfg(['projetosGantt', 'fantasma'], ['projetosGantt']));
    assert.equal(d.body.innerHTML, antes);
  });
  await teste('aplicar: painel que não consta na configuração vai depois dos que constam', () => {
    const d = paginaComPaineis(['processosSEIPro', 'favoritesPro']);
    aplicar(d, cfg(['favoritesPro']));
    d.getElementById('panelHomePro')!.insertAdjacentHTML('beforeend', '<div class="panelHomePro" id="projetosGantt"></div>');
    aplicar(d, cfg(['favoritesPro']));
    assert.deepEqual(['favoritesPro', 'processosSEIPro', 'projetosGantt'].map(id => ordemCss(d.getElementById(id)!)), ['0', '1', '2']);
  });
}
