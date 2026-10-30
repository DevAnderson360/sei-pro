import assert from 'node:assert/strict';
import { acompanharRecolhimento, ATRIBUTO_RECOLHIDO, estaRecolhido } from '../src/ativacao/recolher';
import { docDe, teste } from './util';

const pagina = () => docDe('<body><div id="collapseControle" class="collapseTabelaProcesso"></div><div id="divFiltro" class="collapseTabelaProcesso"></div><div id="spro-grade"></div></body>');

await teste('recolher: segue o displayNone que o botao do legado poe na familia .collapseTabelaProcesso', async () => {
  const doc = pagina();
  const host = doc.getElementById('spro-grade')!;
  // O linkedom nao tem MutationObserver: um observador falso guarda o callback e o teste o dispara como o navegador faria.
  let aviso: () => void = () => undefined;
  const Falso = class { constructor(f: () => void) { aviso = f; } observe() {} disconnect() {} } as unknown as typeof MutationObserver;
  const parar = acompanharRecolhimento(doc, host, Falso);
  assert.equal(host.hasAttribute(ATRIBUTO_RECOLHIDO), false);
  doc.getElementById('collapseControle')!.classList.add('displayNone');
  doc.getElementById('divFiltro')!.classList.add('displayNone');
  aviso();
  assert.equal(estaRecolhido(doc), true);
  assert.equal(host.hasAttribute(ATRIBUTO_RECOLHIDO), true);
  doc.getElementById('collapseControle')!.classList.remove('displayNone');
  doc.getElementById('divFiltro')!.classList.remove('displayNone');
  aviso();
  assert.equal(host.hasAttribute(ATRIBUTO_RECOLHIDO), false);
  parar();
});
await teste('recolher: ja nasce recolhido se o legado recolheu antes da grade montar; sem a familia nunca recolhe', () => {
  const doc = pagina();
  doc.getElementById('collapseControle')!.classList.add('displayNone');
  const host = doc.getElementById('spro-grade')!;
  acompanharRecolhimento(doc, host);
  assert.equal(host.hasAttribute(ATRIBUTO_RECOLHIDO), true);
  assert.equal(estaRecolhido(docDe('<body><div id="spro-grade" class="displayNone"></div></body>')), false);
});
