import assert from 'node:assert/strict';
import { criar, inclusao, servidor, url } from './servidor';
import { opcaoLegadaLigada } from '../../sei-comum/src/opcoes/legadas';
const modulo = await import('../src/controle').catch(() => null);
assert.equal(typeof modulo?.iniciar, 'function', 'tela deve instalar o botão de retorno');
const iniciar = modulo!.iniciar;
const esperar = () => new Promise(resolve => setTimeout(resolve, 20));
function tela() {
  const doc = criar(inclusao);
  // Linkedom não implementa value do select nem checked do input como no navegador.
  const selectProto = Object.getPrototypeOf(doc.createElement('select'));
  Object.defineProperty(selectProto, 'value', { configurable: true,
    get() { return this.querySelector('option[selected]')?.value ?? ''; },
    set(valor: string) { for (const opcao of this.options) opcao.selected = false; for (const opcao of this.options) if (opcao.value === valor) opcao.selected = true; },
  });
  const inputProto = Object.getPrototypeOf(doc.createElement('input'));
  Object.defineProperty(inputProto, 'checked', { configurable: true,
    get() { return this.hasAttribute('checked'); },
    set(valor: boolean) { this.toggleAttribute('checked', valor); },
  });
  const proto = Object.getPrototypeOf(doc.createElement('dialog'));
  proto.showModal = function() { this.setAttribute('open', ''); };
  proto.close = function() { this.removeAttribute('open'); this.dispatchEvent(new doc.defaultView!.Event('close')); };
  (doc.querySelector('input[type=checkbox]') as HTMLInputElement).checked = true;
  return doc;
}
/** A raiz do modal (o Shadow DOM do host, no documento onde ele foi montado); vazia se não há modal. */
const R = (d: Document): ParentNode => (d.querySelector('.spro-blk-host')?.shadowRoot as ParentNode | null | undefined) ?? d.createDocumentFragment();
function clicar(doc: Document, seletor: string, onde: Document = doc) {
  const el = doc.querySelector<HTMLElement>(seletor) ?? R(onde).querySelector<HTMLElement>(seletor);
  assert.ok(el, `controle presente: ${seletor}`);
  el.click();
}
function escolher(doc: Document, onde: Document = doc) {
  const radio = R(onde).querySelector<HTMLInputElement>('input[type=radio]')!;
  radio.checked = true;
  radio.dispatchEvent(new doc.defaultView!.Event('change', { bubbles: true }));
}

const s = servidor(), doc = tela();
let mudancas = 0, chosen = 0;
doc.querySelector('#selBloco')!.addEventListener('change', () => mudancas++);
doc.querySelector('#selBloco')!.addEventListener('chosen:updated', () => chosen++);
const controle = iniciar({ doc, url, sei: s.sei });
controle.configurar(false);
assert.equal(doc.querySelectorAll('.spro-blocos-retornar').length, 0);
controle.configurar(true); controle.configurar(true);
assert.equal(doc.querySelectorAll('.spro-blocos-retornar').length, 2);
clicar(doc, '.spro-blocos-retornar'); await esperar();
assert.equal(R(doc).querySelectorAll('input[type=radio]').length, 1);
assert.equal(s.estado.posts, 0);
assert.equal(R(doc).querySelector('img'), null, 'descrição deve ser texto');
assert.equal(R(doc).querySelector<HTMLButtonElement>('[data-spro-confirmar]')!.disabled, true);
escolher(doc);
clicar(doc, '[data-spro-confirmar]'); clicar(doc, '[data-spro-confirmar]'); await esperar();
assert.equal(s.estado.posts, 1);
assert.equal(doc.querySelector('#selBloco option[selected]')!.getAttribute('value'), '11');
assert.deepEqual([...doc.querySelectorAll('#selBloco option')].map(o => o.getAttribute('value')), ['', '12', '11', '3']);
assert.equal((doc.querySelector('input[type=checkbox]') as HTMLInputElement).checked, true);
assert.equal(doc.querySelector<HTMLInputElement>('#hdnDocumentosItensSelecionados')!.value, 'doc1');
assert.equal(mudancas, 0, 'onchange nativo não deve submeter o formulário');
assert.equal(chosen, 1, 'Chosen deve receber atualização sem change');
assert.match(R(doc).querySelector('[role=status]')!.textContent!, /selecionado/);
const sucesso = R(doc).querySelector('dialog')!;
assert.equal(!!sucesso.querySelector('fieldset'), false, 'sucesso não deve manter a seleção de blocos');
assert.equal(sucesso.querySelector('h2')!.textContent, 'Bloco retornado');
assert.equal(sucesso.querySelectorAll('p').length, 1, 'remove explicação inicial após o retorno');
assert.equal(sucesso.querySelector('[data-spro-confirmar]'), null, 'o botão de confirmar sai depois do retorno');
assert.equal(sucesso.querySelectorAll('footer button, .spro-dialogo-rodape button').length, 0, 'sem botões no rodapé depois do retorno');
clicar(doc, '[data-spro-fechar]');
assert.equal(doc.querySelector('.spro-blk-host'), null);
controle.configurar(false); await esperar();
assert.equal(doc.querySelectorAll('.spro-blocos-retornar').length, 0);
controle.fechar();
console.log('OK: confirmação explícita, uma escrita, texto seguro, documentos e dropdown preservados');

const falho = servidor(); falho.estado.rejeitar = true;
const df = tela(), cf = iniciar({ doc: df, url, sei: falho.sei }); cf.configurar(true);
clicar(df, '.spro-blocos-retornar'); await esperar(); escolher(df); clicar(df, '[data-spro-confirmar]'); await esperar();
assert.equal(df.querySelector('#selBloco option[value="11"]'), null);
assert.match(R(df).querySelector('[role=status]')!.textContent!, /não/i);
assert.equal(R(df).querySelector<HTMLButtonElement>('[data-spro-confirmar]')!.disabled, false);
cf.fechar();

const cancelado = servidor(), dc = tela(), cc = iniciar({doc: dc, url, sei: cancelado.sei}); cc.configurar(true);
clicar(dc, '.spro-blocos-retornar'); await esperar(); clicar(dc, '[data-spro-fechar]');
assert.equal(cancelado.estado.posts, 0); cc.fechar();
const vazio = servidor(); vazio.estado.semAcao = true;
const dv = tela(), cv = iniciar({doc: dv, url, sei: vazio.sei}); cv.configurar(true);
clicar(dv, '.spro-blocos-retornar'); await esperar();
assert.equal(R(dv).querySelectorAll('input[type=radio]').length, 0);
assert.match(R(dv).querySelector('[role=status]')!.textContent!, /Nenhum/); cv.fechar();

const tardio = servidor(); let soltar!: () => void;
tardio.estado.tardar = new Promise(resolve => { soltar = resolve; });
const dt = tela(), ct = iniciar({doc: dt, url, sei: tardio.sei}); ct.configurar(true);
clicar(dt, '.spro-blocos-retornar'); ct.configurar(false); soltar(); await esperar();
assert.equal(dt.querySelector('.spro-blk-host'), null);
assert.equal(dt.querySelectorAll('.spro-blocos-retornar').length, 0);
assert.equal(tardio.estado.posts, 0); ct.fechar();

const fora = tela(), co = iniciar({doc: fora, url: url.replace('bloco_escolher', 'procedimento_controlar'), sei: servidor().sei}); co.configurar(true);
assert.equal(fora.querySelector('.spro-blocos-retornar'), null); co.fechar();
const dinamica = tela(), cd = iniciar({doc: dinamica, url, sei: servidor().sei}); cd.configurar(true);
dinamica.querySelector('#divInfraBarraComandosInferior')!.innerHTML = '<button>Incluir</button>'; await esperar();
assert.equal(dinamica.querySelectorAll('.spro-blocos-retornar').length, 2); cd.fechar();
assert.equal(opcaoLegadaLigada(undefined, 'retornarblocodisponibilizado'), true);
assert.equal(opcaoLegadaLigada(JSON.stringify([{configGeral:[{name:'retornarblocodisponibilizado', value:false}]}]), 'retornarblocodisponibilizado'), false);
console.log('OK: erros, cancelar, lista vazia, preferência, resposta tardia, contexto e remontagem');

const avisoServidor = servidor(); avisoServidor.estado.descricao = 'inexistente';
const da = tela(), ca = iniciar({ doc: da, url, sei: avisoServidor.sei }); ca.configurar(true);
clicar(da, '.spro-blocos-retornar'); await esperar(); escolher(da);
avisoServidor.estado.falharRestauracao = true;
clicar(da, '[data-spro-confirmar]'); await esperar();
assert.equal(da.querySelector('#selBloco option[selected]')!.getAttribute('value'), '11');
assert.match(R(da).querySelector('[role=status]')!.textContent!, /selecionado/);
assert.match(R(da).querySelector('[role=status]')!.textContent!, /filtros/);
assert.equal(R(da).querySelector('[data-spro-confirmar]'), null);
ca.fechar();
console.log('OK: retorno confirmado atualiza seletor e apresenta aviso de restauração');

// O modal sobe para o documento do topo (a tela de inclusão fica num iframe) e some com a tela.
const topoServ = servidor(), dI = tela(), dT = tela();
const cT = iniciar({ doc: dI, url, sei: topoServ.sei, topo: dT, css: '.x{}' }); cT.configurar(true);
clicar(dI, '.spro-blocos-retornar'); await esperar();
assert.equal(dI.querySelector('.spro-blk-host'), null, 'nada de modal dentro do iframe');
assert.equal(dT.querySelectorAll('.spro-blk-host').length, 1, 'modal montado no topo');
assert.equal(R(dT).querySelectorAll('input[type=radio]').length, 1);
assert.match(R(dT).querySelector('style')!.textContent!, /\.x\{\}/, 'o CSS vai para dentro do Shadow DOM');
escolher(dI, dT); clicar(dI, '[data-spro-confirmar]', dT); await esperar();
assert.equal(topoServ.estado.posts, 1);
assert.equal(dI.querySelector('#selBloco option[selected]')!.getAttribute('value'), '11', 'o seletor atualizado é o da tela de inclusão');
cT.configurar(false);
assert.equal(dT.querySelector('.spro-blk-host'), null, 'desligar remove o modal do topo');
cT.fechar();
const sair = servidor(), dI2 = tela(), dT2 = tela(), cS = iniciar({ doc: dI2, url, sei: sair.sei, topo: dT2 }); cS.configurar(true);
clicar(dI2, '.spro-blocos-retornar'); await esperar();
cS.fechar();
assert.equal(dT2.querySelector('.spro-blk-host'), null, 'sair da tela (pagehide) fecha o modal do topo');
console.log('OK: modal no padrão do SEI Pro, montado no topo e removido com a tela');
