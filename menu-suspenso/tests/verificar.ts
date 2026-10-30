import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { ATRIBUTO_ESTADO, ATRIBUTO_LAYOUT, iniciar } from '../src/controle';
import { layoutDaPagina, recuoSobBarra } from '../src/layout';
import { opcaoLegadaMarcada } from '../../sei-comum/src/opcoes/legadas';

let n = 0;
async function teste(nome: string, fn: () => void | Promise<void>) {
  await fn();
  console.log(`OK ${++n}: ${nome}`);
}
const NOVO = `<nav><div id="divInfraBarraSistemaPadraoE" title="Logo" onclick="infraMenuSistemaEsquemaPro()"><span id="logo">sei</span>
<a id="lnkInfraMenuSistema" href="#" title="Exibir/Ocultar Menu do Sistema"><img id="icone" title="Exibir/Ocultar Menu do Sistema"></a></div></nav>
<div id="divInfraAreaTela"><div id="divInfraAreaTelaE"><div id="divInfraSidebarMenu"><ul id="infraMenu"><li><a id="item" href="#">Item</a></li></ul></div></div>
<div id="divInfraAreaTelaD"><p id="fora">Conteúdo</p></div></div>`;
const ANTIGO = `<div id="divInfraBarraSistemaE"><a id="lnkInfraMenuSistema" href="#"></a></div>
<div id="divInfraAreaTelaE"><ul><li id="item">Item</li></ul></div><div id="divInfraAreaTelaD"><p id="fora">x</p></div>`;
const criar = (html: string) =>
  parseHTML(`<html><head></head><body>${html}</body></html>`).document as unknown as Document;
const clicar = (d: Document, id: string) => {
  const evento = new d.defaultView!.Event('click', { bubbles: true, cancelable: true });
  d.getElementById(id)!.dispatchEvent(evento);
  return evento;
};
const tecla = (d: Document, key: string, em: Element | Document = d) => {
  const evento = new d.defaultView!.Event('keydown', { bubbles: true, cancelable: true });
  Object.defineProperty(evento, 'key', { value: key });
  em.dispatchEvent(evento);
  return evento;
};
const estado = (d: Document) => d.documentElement.getAttribute(ATRIBUTO_ESTADO);

await teste('layout: ul#infraMenu é o SEI novo, menu sem ela é o antigo, sem menu é nada', () => {
  assert.equal(layoutDaPagina(criar(NOVO)), 'novo');
  assert.equal(layoutDaPagina(criar(ANTIGO)), 'antigo');
  assert.equal(layoutDaPagina(criar('<p>popup</p>')), null);
});
await teste('opção ausente deixa desligada e só a escolha salva liga', () => {
  assert.equal(opcaoLegadaMarcada(undefined, 'menususpenso'), false);
  assert.equal(opcaoLegadaMarcada(JSON.stringify([{ configGeral: [{ name: 'menususpenso', value: true }] }]), 'menususpenso'), true);
});
await teste('desligada, a página fica intocada', () => {
  const d = criar(NOVO);
  const antes = d.documentElement.outerHTML;
  const c = iniciar(d);
  c.configurar(false);
  clicar(d, 'logo');
  assert.equal(d.documentElement.outerHTML, antes);
  c.encerrar();
});
await teste('ligar começa fechado e marca o layout', () => {
  const d = criar(NOVO);
  iniciar(d).configurar(true);
  assert.equal(d.documentElement.getAttribute(ATRIBUTO_LAYOUT), 'novo');
  assert.equal(estado(d), 'fechado');
});
// Que o onclick inline do SEI não rode só se prova no navegador (o DOM simulado não tem fase de captura).
await teste('o logo e o link Menu alternam e o clique é consumido', () => {
  const d = criar(NOVO);
  const c = iniciar(d);
  c.configurar(true);
  const e1 = clicar(d, 'logo');
  assert.equal(estado(d), 'aberto');
  assert.equal(e1.defaultPrevented, true);
  clicar(d, 'icone');
  assert.equal(estado(d), 'fechado');
  clicar(d, 'lnkInfraMenuSistema');
  assert.equal(estado(d), 'aberto');
  c.encerrar();
});
await teste('clique no menu mantém aberto; clique fora e Esc fecham, sem engolir o clique', () => {
  const d = criar(NOVO);
  const c = iniciar(d);
  c.configurar(true);
  c.abrir();
  const dentro = clicar(d, 'item');
  assert.equal(estado(d), 'aberto');
  assert.equal(dentro.defaultPrevented, false);
  const fora = clicar(d, 'fora');
  assert.equal(estado(d), 'fechado');
  assert.equal(fora.defaultPrevented, false);
  c.abrir();
  tecla(d, 'Enter');
  assert.equal(estado(d), 'aberto');
  tecla(d, 'Escape');
  assert.equal(estado(d), 'fechado');
  c.encerrar();
});
await teste('aria-expanded e rótulo acompanham e voltam ao desligar, sem tocar no título', () => {
  const d = criar(NOVO);
  const barra = d.getElementById('divInfraBarraSistemaPadraoE')!;
  const c = iniciar(d);
  c.configurar(true);
  assert.equal(barra.getAttribute('aria-expanded'), 'false');
  assert.equal(barra.getAttribute('title'), 'Logo');
  assert.equal(barra.getAttribute('role'), 'button');
  assert.equal(barra.getAttribute('tabindex'), '0');
  c.abrir();
  assert.equal(barra.getAttribute('aria-expanded'), 'true');
  c.configurar(false);
  assert.equal(barra.getAttribute('title'), 'Logo');
  assert.equal(barra.hasAttribute('aria-expanded'), false);
  assert.equal(barra.hasAttribute('role') || barra.hasAttribute('aria-label') || barra.hasAttribute('aria-controls'), false);
  assert.equal(d.getElementById('lnkInfraMenuSistema')!.getAttribute('title'), 'Exibir/Ocultar Menu do Sistema');
  assert.equal(d.documentElement.hasAttribute(ATRIBUTO_LAYOUT), false);
  assert.equal(d.documentElement.hasAttribute(ATRIBUTO_ESTADO), false);
});
await teste('desligar tira os ouvintes: o clique volta a ser do SEI', () => {
  const d = criar(NOVO);
  const c = iniciar(d);
  c.configurar(true);
  c.configurar(false);
  assert.equal(clicar(d, 'logo').defaultPrevented, false);
  assert.equal(d.documentElement.hasAttribute(ATRIBUTO_ESTADO), false);
});
await teste('ligar duas vezes não duplica ouvinte (um clique, uma troca)', () => {
  const d = criar(NOVO);
  const c = iniciar(d);
  c.configurar(true);
  c.configurar(true);
  clicar(d, 'logo');
  assert.equal(estado(d), 'aberto');
  c.encerrar();
});
await teste('SEI antigo: alterna e põe o body sem coluna só enquanto ligado', () => {
  const d = criar(ANTIGO);
  const c = iniciar(d);
  c.configurar(true);
  assert.equal(d.documentElement.getAttribute(ATRIBUTO_LAYOUT), 'antigo');
  assert.equal(d.body.classList.contains('seiSlim_hidemenu'), true);
  clicar(d, 'lnkInfraMenuSistema');
  assert.equal(estado(d), 'aberto');
  c.configurar(false);
  assert.equal(d.body.classList.contains('seiSlim_hidemenu'), false);
});
await teste('SEI antigo: classe que já estava no body não é removida ao desligar', () => {
  const d = criar(ANTIGO);
  d.body.classList.add('seiSlim_hidemenu');
  const c = iniciar(d);
  c.configurar(true);
  c.configurar(false);
  assert.equal(d.body.classList.contains('seiSlim_hidemenu'), true);
});
await teste('teclado: Enter e Espaço na barra alternam; em outro elemento, não', () => {
  const d = criar(NOVO);
  const barra = d.getElementById('divInfraBarraSistemaPadraoE')!;
  const c = iniciar(d);
  c.configurar(true);
  assert.equal(tecla(d, 'Enter', barra).defaultPrevented, true);
  assert.equal(estado(d), 'aberto');
  tecla(d, ' ', barra);
  assert.equal(estado(d), 'fechado');
  assert.equal(tecla(d, 'Enter', d.getElementById('item')!).defaultPrevented, false);
  assert.equal(estado(d), 'fechado');
  c.encerrar();
});
await teste('janela estreita (menu de celular do SEI): o clique é do SEI', () => {
  const d = criar(NOVO);
  Object.defineProperty(d.defaultView, 'innerWidth', { value: 500, configurable: true });
  const c = iniciar(d);
  c.configurar(true);
  assert.equal(clicar(d, 'logo').defaultPrevented, false);
  assert.equal(estado(d), 'fechado');
  Object.defineProperty(d.defaultView, 'innerWidth', { value: 1200, configurable: true });
  assert.equal(clicar(d, 'logo').defaultPrevented, true);
  assert.equal(estado(d), 'aberto');
  c.encerrar();
});
await teste('recuo sob a barra de ações: só com a barra fixa sobre a largura do menu', () => {
  assert.equal(recuoSobBarra(true, { left: 16, bottom: 103 }, 50, 320), 61);
  assert.equal(recuoSobBarra(false, { left: 16, bottom: 103 }, 50, 320), 0);
  assert.equal(recuoSobBarra(true, { left: 400, bottom: 103 }, 50, 320), 0);
  assert.equal(recuoSobBarra(true, { left: 16, bottom: 40 }, 50, 320), 0);
});
await teste('ligar não deixa a marca de "sem animação" para sempre e desligar a tira', async () => {
  const d = criar(NOVO);
  const c = iniciar(d);
  c.configurar(true);
  assert.equal(d.documentElement.hasAttribute('data-spro-menu-sem-animacao'), true);
  await new Promise((r) => setTimeout(r, 120));
  assert.equal(d.documentElement.hasAttribute('data-spro-menu-sem-animacao'), false);
  c.configurar(false);
  c.configurar(true);
  c.configurar(false);
  assert.equal(d.documentElement.hasAttribute('data-spro-menu-sem-animacao'), false);
});
await teste('desligar tira o recuo do menu', () => {
  const d = criar(NOVO);
  const menu = d.getElementById('divInfraAreaTelaE')!;
  menu.style.setProperty('--spro-menu-recuo', '60px');
  const c = iniciar(d);
  c.configurar(true);
  c.configurar(false);
  assert.equal(menu.style.getPropertyValue('--spro-menu-recuo'), '');
});
await teste('página sem menu: ligar não faz nada', () => {
  const d = criar('<p>popup</p>');
  const c = iniciar(d);
  c.configurar(true);
  assert.equal(d.documentElement.hasAttribute(ATRIBUTO_LAYOUT), false);
  c.encerrar();
});
console.log(`${n} verificações passaram.`);
