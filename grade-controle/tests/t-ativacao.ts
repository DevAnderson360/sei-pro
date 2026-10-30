import assert from 'node:assert/strict';
import { areaMemoria } from '../../sei-comum/src/armazenamento/area';
import { ATRIBUTO, ativarCedo, CHAVE_DICA, cssPrimeiraPintura, desativar, ESCURO, estaAtiva, gravarDica, ID_ESTILO, lerDica, marcarPronta, PRAZO_MS, PRONTA, TETO_MS, vigiar } from '../src/ativacao/inicio';
import { CLASSE_BOTAO, garantirBotao, ligarCliqueDoBotao, manterBotao, removerBotao } from '../src/ativacao/botao';
import { chaveVisao, criarArmazem, estadoUnidadeVazio } from '../src/persistencia/armazem';
import { visaoPadrao } from '../src/modelo/visoes';
import { docDe, teste } from './util';

const pagina = () => docDe('<html><head></head><body><div id="divInfraBarraLocalizacao"><button class="spro-fav-recolher"></button></div></body></html>');

await teste('ativação: marca o html, injeta o CSS que esconde as tabelas e desenha o esqueleto', () => {
  const doc = pagina();
  assert.equal(estaAtiva(doc), false);
  ativarCedo(doc, false);
  assert.equal(doc.documentElement.getAttribute(ATRIBUTO), '1');
  const css = doc.getElementById(ID_ESTILO)!.textContent!;
  for (const t of ['#tblProcessosRecebidos', '#tblProcessosGerados', '#tblProcessosDetalhado']) assert.ok(css.includes(`html[${ATRIBUTO}] ${t}`) && css.includes('display: none !important'), t);
  assert.ok(css.includes('::before') && css.includes('spro-grade-pulso') && css.includes('prefers-reduced-motion'));
  assert.ok(css.includes(`:not([${PRONTA}])`), 'o esqueleto some quando a grade fica pronta');
});
await teste('ativação: idempotente (um só <style>) e o escuro é marcado', () => {
  const doc = pagina();
  ativarCedo(doc, true);
  ativarCedo(doc, true);
  assert.equal(doc.querySelectorAll(`#${ID_ESTILO}`).length, 1);
  assert.equal(doc.documentElement.hasAttribute(ESCURO), true);
  ativarCedo(doc, false);
  assert.equal(doc.documentElement.hasAttribute(ESCURO), false);
});
await teste('ativação: sem <head> ainda (document_start) injeta no <html>', () => {
  const doc = docDe('<html></html>');
  doc.documentElement.removeChild(doc.head ?? doc.documentElement.firstChild!);
  ativarCedo(doc, false);
  assert.ok(doc.getElementById(ID_ESTILO));
});
await teste('ativação: pronta tira o esqueleto (o CSS só o mostra sem o atributo); desativar devolve tudo', () => {
  const doc = pagina();
  ativarCedo(doc, true);
  marcarPronta(doc);
  assert.equal(doc.documentElement.hasAttribute(PRONTA), true);
  desativar(doc);
  for (const a of [ATRIBUTO, PRONTA, ESCURO]) assert.equal(doc.documentElement.hasAttribute(a), false);
  assert.equal(doc.getElementById(ID_ESTILO), null);
});
await teste('ativação: CSS sem a marca não esconde nada (todas as regras dependem do atributo)', () => {
  const css = cssPrimeiraPintura().replace(/\/\*[\s\S]*?\*\//g, '');
  const regras = css.split('}').map((r) => r.split('{')[0]!.trim()).filter((s) => s && !s.startsWith('@') && !/^\d|^(0%|50%)/.test(s));
  assert.ok(regras.every((r) => r.split(',').every((s) => s.trim().startsWith(`html[${ATRIBUTO}]`) || s.trim().startsWith('}') || /^(0%|50%|100%)/.test(s.trim()) || s.trim() === '')), regras.join(' | '));
});
await teste('dica síncrona: grava, lê e sobrevive a storage quebrado', () => {
  const m = new Map<string, string>();
  const s = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) };
  assert.equal(lerDica(s), false);
  gravarDica(s, true);
  assert.equal(m.get(CHAVE_DICA), '1');
  assert.equal(lerDica(s), true);
  gravarDica(s, false);
  assert.equal(lerDica(s), false);
  const quebrado = { getItem: () => { throw new Error('bloqueado'); }, setItem: () => { throw new Error('bloqueado'); }, removeItem: () => { throw new Error('bloqueado'); } };
  assert.equal(lerDica(quebrado), false);
  assert.doesNotThrow(() => gravarDica(quebrado, true));
});
await teste('vigia: prazo depois do DOMContentLoaded devolve a nativa; pronta cancela tudo', () => {
  const tarefas: Array<{ f: () => void; ms: number; vivo: boolean }> = [];
  const relogio = { setTimeout: (f: () => void, ms: number) => tarefas.push({ f, ms, vivo: true }) - 1, clearTimeout: (id: unknown) => { if (typeof id === 'number' && tarefas[id]) tarefas[id]!.vivo = false; } };
  const motivos: string[] = [];
  const v = vigiar((m) => motivos.push(m), relogio);
  assert.equal(tarefas[0]!.ms, TETO_MS);
  v.iniciarContagem();
  assert.equal(tarefas[1]!.ms, PRAZO_MS);
  tarefas[1]!.f();
  assert.deepEqual(motivos, ['prazo']);
  assert.equal(tarefas[0]!.vivo, false, 'o teto é cancelado ao disparar');
  tarefas[0]!.f();
  assert.deepEqual(motivos, ['prazo'], 'dispara uma só vez');
  const v2 = vigiar((m) => motivos.push(m), relogio);
  v2.iniciarContagem();
  v2.pronta();
  const n = tarefas.length;
  tarefas[n - 1]!.f();
  tarefas[n - 2]!.f();
  assert.deepEqual(motivos, ['prazo'], 'pronta cancela os dois prazos');
});
await teste('vigia: teto desde o início e falha explícita', () => {
  const tarefas: Array<() => void> = [];
  const motivos: string[] = [];
  const v = vigiar((m) => motivos.push(m), { setTimeout: (f) => tarefas.push(f) - 1, clearTimeout: () => undefined });
  tarefas[0]!();
  assert.deepEqual(motivos, ['teto']);
  assert.equal(v.encerrada(), true);
  const v2 = vigiar((m) => motivos.push(m), { setTimeout: (f) => tarefas.push(f) - 1, clearTimeout: () => undefined });
  v2.falhou('erro de leitura');
  assert.deepEqual(motivos, ['teto', 'erro de leitura']);
});

// ---------------- botão ----------------
await teste('botão: entra ao lado da seta de recolher, sem rótulo e com tooltip; reflete o estado', () => {
  const doc = pagina();
  let n = 0;
  assert.equal(garantirBotao(doc, false, () => n++), true);
  const b = doc.querySelector<HTMLButtonElement>(`.${CLASSE_BOTAO}`)!;
  assert.equal(doc.getElementById('divInfraBarraLocalizacao')!.lastElementChild, b, 'o botao e o ultimo da barra');
  assert.equal(b.textContent!.trim(), '');
  const parar = ligarCliqueDoBotao(doc, () => n++);
  assert.match(b.getAttribute('data-tip')!, /Novo Controle/);
  assert.equal(b.hasAttribute('title'), false, 'sem o title nativo');
  assert.equal(b.getAttribute('aria-pressed'), 'false');
  b.click();
  assert.equal(n, 1);
  // O legado clona a barra de titulo e o clone perde os ouvintes: o clique delegado ao documento ainda funciona.
  const clone = b.cloneNode(true) as HTMLElement;
  b.replaceWith(clone);
  clone.click();
  assert.equal(n, 2);
  parar();
  garantirBotao(doc, true, () => n++);
  assert.match(clone.getAttribute('data-tip')!, /nativa/);
  assert.equal(clone.getAttribute('aria-pressed'), 'true');
  assert.equal(doc.querySelectorAll(`.${CLASSE_BOTAO}`).length, 1);
  removerBotao(doc);
  assert.equal(doc.querySelector(`.${CLASSE_BOTAO}`), null);
});
await teste('botão: fica DEPOIS do botão de ordenar os painéis, mesmo quando esse chega depois', () => {
  const doc = pagina();
  garantirBotao(doc, false, () => undefined);
  const barra = doc.getElementById('divInfraBarraLocalizacao')!;
  const ordenar = doc.createElement('button');
  ordenar.className = 'spro-pnl-botao';
  barra.append(ordenar); // o modulo de ordem dos paineis chega depois e se poe no fim
  assert.equal(barra.lastElementChild, ordenar);
  garantirBotao(doc, false, () => undefined);
  assert.equal(barra.lastElementChild!.className, CLASSE_BOTAO);
  assert.equal(ordenar.nextElementSibling!.className, CLASSE_BOTAO);
  assert.equal(barra.querySelectorAll(`.${CLASSE_BOTAO}`).length, 1);
});
await teste('botão: sem barra ainda devolve falso (o legado monta depois)', () => {
  assert.equal(garantirBotao(docDe('<html><body></body></html>'), false, () => undefined), false);
});
await teste('botão: sem a seta do legado vai para o fim da barra; manter e parar', () => {
  const doc = docDe('<html><body><div id="divInfraBarraLocalizacao">Controle</div></body></html>');
  const parar = manterBotao(doc, () => false, () => undefined);
  assert.equal(doc.getElementById('divInfraBarraLocalizacao')!.lastElementChild!.className, CLASSE_BOTAO);
  parar();
  assert.equal(doc.querySelector(`.${CLASSE_BOTAO}`), null);
});

// ---------------- persistência ----------------
await teste('persistência: estado da unidade em local; unidades não se misturam', async () => {
  const local = areaMemoria();
  const sync = areaMemoria();
  const a = criarArmazem({ local, sync }, '110000001');
  const b = criarArmazem({ local, sync }, '110000002');
  assert.deepEqual(await a.lerEstado(), estadoUnidadeVazio());
  await a.gravarVisao({ ...visaoPadrao(), busca: 'resp:eu', modo: 'quadro' });
  await a.gravarRecolhidos(['u:ana']);
  await a.gravarIdade({ vistoEm: { '1': 5 }, visitaAtual: 9 });
  const e = await a.lerEstado();
  assert.equal(e.visao.busca, 'resp:eu');
  assert.equal(e.visao.modo, 'quadro');
  assert.deepEqual(e.recolhidos, ['u:ana']);
  assert.deepEqual(e.idade, { vistoEm: { '1': 5 }, visitaAtual: 9 });
  assert.equal((await b.lerEstado()).visao.busca, '');
});
await teste('persistência: visões no sync, uma chave por visão; excluir remove a chave', async () => {
  const local = areaMemoria();
  const sync = areaMemoria();
  const a = criarArmazem({ local, sync }, 'u');
  assert.deepEqual(await a.lerVisoes(), []);
  const v1 = { ...visaoPadrao(), id: 'a', nome: 'Atrasados', busca: 'prazo:atrasado' };
  const v2 = { ...visaoPadrao(), id: 'b', nome: 'Minhas', busca: 'resp:eu' };
  await a.gravarVisoes([v1, v2]);
  assert.deepEqual((await a.lerVisoes()).map((v) => v.nome), ['Atrasados', 'Minhas']);
  await a.gravarVisoes([v2], [v1, v2]);
  assert.deepEqual((await a.lerVisoes()).map((v) => v.id), ['b']);
  assert.equal((await sync.obter(chaveVisao('a')))[chaveVisao('a')], undefined);
});
await teste('persistência: dado corrompido no storage vira estado vazio, sem lançar', async () => {
  const local = areaMemoria({ 'spro_grade:u': 'lixo' });
  const sync = areaMemoria({ spro_grade_v_ids: ['x', 5, null], 'spro_grade_v:x': 42 });
  const a = criarArmazem({ local, sync }, 'u');
  assert.deepEqual(await a.lerEstado(), estadoUnidadeVazio());
  assert.equal((await a.lerVisoes()).length, 1);
});
await teste('persistência: aoMudarVisoes dispara só para chaves das visões', async () => {
  const local = areaMemoria();
  const sync = areaMemoria();
  const a = criarArmazem({ local, sync }, 'u');
  let n = 0;
  const parar = a.aoMudarVisoes(() => n++);
  await sync.gravar({ outra: 1 });
  assert.equal(n, 0);
  await a.gravarVisoes([{ ...visaoPadrao(), id: 'a' }]);
  assert.ok(n >= 1);
  parar();
});
await teste('ativação: com a grade pronta o container nativo das tabelas some (sem o vazio de 200px antes do painel de baixo)', () => {
  const css = cssPrimeiraPintura();
  assert.ok(css.includes(`html[${ATRIBUTO}][${PRONTA}] #divTabelaProcesso { display: none !important; }`));
});
