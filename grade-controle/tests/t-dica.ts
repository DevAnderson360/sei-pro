import assert from 'node:assert/strict';
import { acharDica, ATRIBUTO_DICA, caminhoDe, instalarDicas, migrarTitulo, posicionar, vigiarTitulos } from '../src/ui/dica';
import { docDe, teste } from './util';

const R = (x: number, y: number, w: number, h: number) => ({ left: x, top: y, right: x + w, bottom: y + h, width: w, height: h }) as DOMRect;

await teste('dica: title vira data-tip, o title nativo sai e o nome acessivel e preservado', () => {
  const doc = docDe('<body><button id="b" title="Editar o prazo\nvence em 5 dias"><svg></svg></button><button id="c" title="X">texto</button></body>');
  const b = doc.getElementById('b')!;
  assert.equal(migrarTitulo(b), 'Editar o prazo\nvence em 5 dias');
  assert.equal(b.hasAttribute('title'), false);
  assert.equal(b.getAttribute(ATRIBUTO_DICA), 'Editar o prazo\nvence em 5 dias');
  assert.equal(b.getAttribute('aria-label'), 'Editar o prazo');
  const c = doc.getElementById('c')!;
  migrarTitulo(c);
  assert.equal(c.hasAttribute('aria-label'), false, 'com texto visivel nao precisa de aria-label');
});
await teste('dica: so atende elementos da grade; o resto do SEI continua com as suas dicas', () => {
  const doc = docDe('<body><div id="spro-grade"></div><a id="sei" title="do SEI"></a><button class="spro-grade-botao" id="bt" title="x"></button></body>');
  const sei = doc.getElementById('sei')!;
  assert.equal(acharDica([sei, doc.body]), null);
  const bt = doc.getElementById('bt')!;
  assert.equal(acharDica([bt, doc.body]), bt);
  const host = doc.getElementById('spro-grade')!;
  const dentro = doc.createElement('span');
  dentro.setAttribute('title', 'dentro');
  const filho = doc.createElement('i');
  assert.equal(acharDica([filho, dentro, host, doc.body]), dentro);
  assert.equal(acharDica([filho, host, doc.body]), null, 'chegar ao host sem achar nada');
});
await teste('dica: posiciona abaixo; sem espaco vai para cima; nunca sai da janela', () => {
  const j = { w: 1000, h: 600 };
  assert.deepEqual(posicionar(R(100, 100, 40, 20), { largura: 100, altura: 30 }, j), { x: 70, y: 128, acima: false });
  assert.equal(posicionar(R(100, 570, 40, 20), { largura: 100, altura: 30 }, j).acima, true);
  assert.equal(posicionar(R(0, 100, 10, 10), { largura: 100, altura: 30 }, j).x, 4);
  assert.equal(posicionar(R(990, 100, 10, 10), { largura: 100, altura: 30 }, j).x, 896);
});
await teste('dica: instalar cria um unico balao e desinstalar o remove', () => {
  const doc = docDe('<html><body></body></html>');
  (doc as unknown as { defaultView: unknown }).defaultView ??= { innerWidth: 1000, innerHeight: 600 };
  const parar = instalarDicas(doc);
  assert.equal(doc.querySelectorAll('#spro-dica-host').length, 1);
  parar();
  assert.equal(doc.querySelectorAll('#spro-dica-host').length, 0);
});
await teste('dica: vigiarTitulos converte de uma vez todos os title ja existentes (nenhum fica para o navegador)', () => {
  const doc = docDe('<body><div id="r"><button title="a"></button><span><i title="b"></i></span></div></body>');
  const raiz = doc.getElementById('r')!;
  vigiarTitulos(raiz);
  assert.equal(raiz.querySelectorAll('[title]').length, 0);
  assert.deepEqual([...raiz.querySelectorAll('[data-tip]')].map((e) => e.getAttribute('data-tip')), ['a', 'b']);
});
await teste('dica: caminhoDe sobe ate o documento', () => {
  const doc = docDe('<body><div id="a"><b id="b"></b></div></body>');
  const ids = caminhoDe(doc.getElementById('b')!).filter((n) => (n as Element).id).map((n) => (n as Element).id);
  assert.deepEqual(ids, ['b', 'a']);
});
await teste('dica: anotacao no balao — [ ] vira caixa, [X] vira caixa marcada com texto riscado, sem HTML', async () => {
  const { desenharNota } = await import('../src/ui/dica');
  const doc = docDe('<body><div id="b"></div></body>');
  const b = doc.getElementById('b')!;
  desenharNota(b, 'Aguardando parecer.\n\n[X] Minuta pronta\n[ ] <b>Parecer</b>', 'pedro em 10/10/2026');
  const ls = [...b.querySelectorAll('.nota-l')].map((l) => [l.getAttribute('data-t'), l.textContent]);
  assert.deepEqual(ls, [[null, 'Aguardando parecer.'], ['x', 'Minuta pronta'], ['o', '<b>Parecer</b>']]);
  assert.equal(b.querySelector('b'), null);
  assert.equal(b.querySelector('.nota-autor')!.textContent, 'pedro em 10/10/2026');
  assert.ok(acharDica([(() => { const e = doc.createElement('td'); e.setAttribute('data-tip-nota', 'x'); return e; })(), doc.getElementById('b')!].map((x) => x)) === null, 'fora da grade nao age');
});
