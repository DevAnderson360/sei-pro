import assert from 'node:assert/strict';
import { executarAcaoNativa, exigeSelecao } from '../src/acoes/barra';
import { criarFila, executarMovimento, inverso, type DepsMover } from '../src/acoes/mover';
import { aplicarSelecao, caixaNativa, lerSelecao, observarSelecao } from '../src/acoes/selecao';
import { acoesDaBarra } from '../src/leitura/barra';
import { lerTabelas } from '../src/leitura/tabela';
import { carregarRestante, type Fonte, MAX_PAGINAS } from '../src/paginas/carregar';
import type { Movimento } from '../src/modelo/quadro';
import type { Grupo } from '../src/modelo/tipos';
import { ativarToggle, docDe, docFixture, teste } from './util';

/** Uma página do SEI com `ids` num grupo e o total no caption. */
function tabelaHtml(grupo: Grupo, ids: number[], total: number, porPagina = 100): string {
  const T = grupo === 'recebidos' ? 'Recebidos' : 'Gerados';
  const linhas = ids
    .map(
      (i) => `<tr id="P${i}" class="infraTrClara"><td><input class="infraCheckbox" name="chk${T}Item${i}" title="1.${i}/2026-1" type="checkbox" value="${i}" aria-label="Tipo Ofício / Especificação n${i}" onclick="infraSelecionarItens(this,'${T}');"></td><td></td><td><a class="processoVisualizado" href="controlador.php?acao=procedimento_trabalhar&id_procedimento=${i}">1.${i}/2026-1</a></td><td></td></tr>`,
    )
    .join('');
  return `<table id="tblProcessos${T}"><caption class="infraCaption">Processos (${total} registros - 1 a ${porPagina}):</caption><tbody>${linhas}</tbody></table>`;
}
const caixa = (grupo: Grupo, ids: number[], total: number, porPagina = 100): Document => ativarToggle(docDe(`<body>${tabelaHtml(grupo, ids, total, porPagina)}</body>`));

function fonteFalsa(paginas: Record<string, number[]>, falhaEm?: string) {
  const chamadas: string[] = [];
  const f: Fonte = {
    async pagina(grupo, n) {
      chamadas.push(`${grupo}:${n}`);
      if (falhaEm === `${grupo}:${n}`) throw new Error('SEI fora do ar');
      return caixa(grupo, paginas[`${grupo}:${n}`] ?? [], 0);
    },
    async restaurar() {
      chamadas.push('restaurar');
    },
  };
  return { f, chamadas };
}

// ---------------- carregar ----------------
await teste('carregar: lê as páginas que faltam, só dos itens novos, e volta à primeira', async () => {
  const inicial = lerTabelas(caixa('recebidos', [1, 2], 5, 2));
  const { f, chamadas } = fonteFalsa({ 'recebidos:1': [3, 4], 'recebidos:2': [5] });
  const progresso: number[] = [];
  const r = await carregarRestante(inicial, f, { aoProgresso: (p) => progresso.push(p.processos) });
  assert.deepEqual(r.processos.map((p) => p.id), ['3', '4', '5']);
  assert.ok(r.processos.every((p) => p.pagina > 0 && !p.naPaginaAtual));
  assert.equal(r.completo, true);
  assert.deepEqual(chamadas, ['recebidos:1', 'recebidos:2', 'restaurar']);
  assert.deepEqual(progresso, [4, 5]);
});
await teste('carregar: tudo já carregado não faz requisição nem restaura', async () => {
  const { f, chamadas } = fonteFalsa({});
  const r = await carregarRestante(lerTabelas(caixa('recebidos', [1, 2], 2, 2)), f);
  assert.deepEqual(chamadas, []);
  assert.equal(r.completo, true);
});
await teste('carregar: erro no meio devolve o parcial, marca incompleto e ainda restaura', async () => {
  const { f, chamadas } = fonteFalsa({ 'recebidos:1': [3, 4] }, 'recebidos:2');
  const r = await carregarRestante(lerTabelas(caixa('recebidos', [1, 2], 6, 2)), f);
  assert.deepEqual(r.processos.map((p) => p.id), ['3', '4']);
  assert.equal(r.completo, false);
  assert.match(r.erro!, /fora do ar/);
  assert.equal(chamadas.at(-1), 'restaurar');
});
await teste('carregar: página vazia ou repetida encerra (o SEI não pagina mais)', async () => {
  const { f, chamadas } = fonteFalsa({ 'recebidos:1': [1, 2] });
  const r = await carregarRestante(lerTabelas(caixa('recebidos', [1, 2], 10, 2)), f);
  assert.deepEqual(r.processos, []);
  assert.equal(r.completo, false);
  assert.deepEqual(chamadas, ['recebidos:1', 'restaurar']);
});
await teste('carregar: cancelamento para na hora e restaura', async () => {
  const ctl = new AbortController();
  const chamadas: string[] = [];
  const f: Fonte = {
    async pagina(g, n) {
      chamadas.push(`${g}:${n}`);
      ctl.abort();
      return caixa(g, [10 * n, 10 * n + 1], 0);
    },
    async restaurar() {
      chamadas.push('restaurar');
    },
  };
  const r = await carregarRestante(lerTabelas(caixa('recebidos', [1, 2], 20, 2)), f, { sinal: ctl.signal });
  assert.equal(r.completo, false);
  assert.deepEqual(chamadas, ['recebidos:1', 'restaurar']);
});
await teste('carregar: teto de páginas e os dois grupos', async () => {
  const dois = docDe(`<body>${tabelaHtml('recebidos', [1], 2, 1)}${tabelaHtml('gerados', [50], 2, 1)}</body>`);
  const { f, chamadas } = fonteFalsa({ 'recebidos:1': [2], 'gerados:1': [51] });
  const r = await carregarRestante(lerTabelas(dois), f);
  assert.deepEqual(r.processos.map((p) => `${p.grupo}:${p.id}`), ['recebidos:2', 'gerados:51']);
  assert.deepEqual(chamadas, ['recebidos:1', 'gerados:1', 'restaurar']);
  const infinito: Fonte = { pagina: async (g, n) => caixa(g, [1000 + n], 0), restaurar: async () => undefined };
  const r2 = await carregarRestante(lerTabelas(caixa('recebidos', [1], 99999, 1)), infinito, { maxPaginas: 5 });
  assert.equal(r2.processos.length, 4);
  assert.equal(r2.completo, false);
  assert.ok(MAX_PAGINAS >= 10);
});
await teste('carregar: falha em restaurar vira erro sem perder os dados', async () => {
  const f: Fonte = { pagina: async (g) => caixa(g, [3], 0), restaurar: async () => { throw new Error('caiu'); } };
  const r = await carregarRestante(lerTabelas(caixa('recebidos', [1, 2], 3, 2)), f);
  assert.equal(r.processos.length, 1);
  assert.match(r.erro!, /primeira página/);
});

// ---------------- seleção ----------------
await teste('seleção: marcar pela grade clica o checkbox nativo (dispara o onclick do SEI)', () => {
  const doc = caixa('recebidos', [1, 2, 3], 3);
  const cliques: string[] = [];
  doc.addEventListener('click', (e) => cliques.push((e.target as HTMLInputElement).value), true);
  const sem = aplicarSelecao(doc, new Set(['2', '9']));
  assert.deepEqual([...lerSelecao(doc)], ['2']);
  assert.deepEqual(sem, ['9'], 'id sem caixa nativa (outra página)');
  assert.deepEqual(cliques, ['2']);
  aplicarSelecao(doc, new Set(['2']));
  assert.deepEqual(cliques, ['2'], 'não clica de novo no que já está certo');
  aplicarSelecao(doc, new Set());
  assert.equal(lerSelecao(doc).size, 0);
});
await teste('seleção: caixa desabilitada é ignorada; caixaNativa encontra por id', () => {
  const doc = caixa('recebidos', [1, 2], 2);
  doc.querySelector<HTMLInputElement>('input[value="1"]')!.disabled = true;
  aplicarSelecao(doc, new Set(['1', '2']));
  assert.deepEqual([...lerSelecao(doc)], ['2']);
  assert.equal(caixaNativa(doc, '2')!.value, '2');
  assert.equal(caixaNativa(doc, '99'), null);
});
await teste('seleção: observar avisa quando o SEI muda a seleção e para ao cancelar', async () => {
  const doc = caixa('recebidos', [1, 2], 2);
  const vistos: string[][] = [];
  const parar = observarSelecao(doc, (ids) => vistos.push([...ids]));
  doc.querySelector<HTMLInputElement>('input[value="1"]')!.click();
  await Promise.resolve();
  assert.deepEqual(vistos, [['1']]);
  parar();
  doc.querySelector<HTMLInputElement>('input[value="2"]')!.click();
  await Promise.resolve();
  assert.equal(vistos.length, 1);
});

// ---------------- barra nativa ----------------
await teste('barra: o botão da grade clica o link nativo; ação que exige seleção recusa sem ela', () => {
  const doc = docFixture('caixa_prazos.html');
  const [enviar] = acoesDaBarra(doc);
  let cliques = 0;
  enviar!.elemento.addEventListener('click', () => cliques++);
  assert.equal(exigeSelecao(enviar!), true);
  assert.deepEqual(executarAcaoNativa(enviar!, 0), { ok: false, motivo: 'Marque ao menos um processo.' });
  assert.equal(cliques, 0);
  assert.deepEqual(executarAcaoNativa(enviar!, 2), { ok: true });
  assert.equal(cliques, 1);
});

// ---------------- mover ----------------
function depsFalsa(falhas: Record<string, string> = {}) {
  const log: string[] = [];
  const d: DepsMover = {
    async marcador(prot, m) {
      const chave = `${m.remover ? '-' : '+'}${m.marcador}`;
      log.push(`${prot} ${chave}${m.texto ? `(${m.texto})` : ''}`);
      if (falhas[chave]) throw new Error(falhas[chave]);
    },
    async atribuir(prot, u) {
      log.push(`${prot} @${u}`);
      if (falhas['@']) throw new Error(falhas['@']);
    },
  };
  return { d, log };
}
const movMarcador = (extra: Partial<Extract<Movimento, { tipo: 'marcador' }>> = {}): Movimento => ({ tipo: 'marcador', id: '1', protocolo: 'P1', remover: 'A', adicionar: 'B', ...extra });

await teste('mover: marcador acrescenta primeiro e depois remove; devolve o inverso para desfazer', async () => {
  const { d, log } = depsFalsa();
  const r = await executarMovimento(movMarcador({ texto: 'Até 20/10' }), d);
  assert.deepEqual(log, ['P1 +B(Até 20/10)', 'P1 -A']);
  assert.ok(r.ok);
  assert.deepEqual(r.ok && r.desfazer, { tipo: 'marcador', id: '1', protocolo: 'P1', remover: 'B', adicionar: 'A', texto: 'Até 20/10' });
});
await teste('mover: se acrescentar falha, nada foi removido', async () => {
  const { d, log } = depsFalsa({ '+B': 'marcador inexistente' });
  const r = await executarMovimento(movMarcador(), d);
  assert.deepEqual(log, ['P1 +B']);
  assert.deepEqual(r, { ok: false, erro: 'marcador inexistente' });
});
await teste('mover: se remover falha, o acréscimo é desfeito (o processo volta como estava)', async () => {
  const { d, log } = depsFalsa({ '-A': 'sem permissão' });
  const r = await executarMovimento(movMarcador(), d);
  assert.deepEqual(log, ['P1 +B', 'P1 -A', 'P1 -B']);
  assert.equal(r.ok, false);
});
await teste('mover: atribuição e seu inverso; só remover; só adicionar', async () => {
  const { d, log } = depsFalsa();
  const at: Movimento = { tipo: 'atribuicao', id: '1', protocolo: 'P1', para: 'beto', de: 'ana' };
  const r = await executarMovimento(at, d);
  assert.deepEqual(log, ['P1 @beto']);
  assert.deepEqual(r.ok && r.desfazer, { ...at, para: 'ana', de: 'beto' });
  assert.deepEqual(inverso(inverso(movMarcador({ texto: 't' }))), movMarcador({ texto: 't' }));
  const { d: d2, log: l2 } = depsFalsa();
  await executarMovimento({ tipo: 'marcador', id: '1', protocolo: 'P1', remover: 'A' }, d2);
  await executarMovimento({ tipo: 'marcador', id: '1', protocolo: 'P1', adicionar: 'C' }, d2);
  assert.deepEqual(l2, ['P1 -A', 'P1 +C']);
});
await teste('mover: a fila serializa (o segundo só começa depois do primeiro) e não trava após erro', async () => {
  const ordem: string[] = [];
  let solta!: () => void;
  const trava = new Promise<void>((r) => (solta = r));
  const d: DepsMover = {
    async marcador(prot, m) {
      ordem.push(`ini ${prot}`);
      if (prot === 'P1') await trava;
      if (prot === 'P2') throw new Error('x');
      ordem.push(`fim ${prot}${m.remover ? '-' : '+'}`);
    },
    async atribuir() {},
  };
  const fila = criarFila(d);
  const a = fila.mover({ tipo: 'marcador', id: '1', protocolo: 'P1', adicionar: 'A' });
  const b = fila.mover({ tipo: 'marcador', id: '2', protocolo: 'P2', adicionar: 'A' });
  const c = fila.mover({ tipo: 'marcador', id: '3', protocolo: 'P3', adicionar: 'A' });
  await Promise.resolve();
  assert.deepEqual(ordem, ['ini P1']);
  solta();
  const [ra, rb, rc] = await Promise.all([a, b, c]);
  assert.deepEqual([ra.ok, rb.ok, rc.ok], [true, false, true]);
  assert.deepEqual(ordem, ['ini P1', 'fim P1+', 'ini P2', 'ini P3', 'fim P3+']);
});
await teste('seleção: evento que nasce dentro da grade nao redesenha no meio do clique (o clique real do mouse perdia o change)', async () => {
  const doc = caixa('recebidos', [1, 2], 2);
  const host = doc.createElement('div');
  host.id = 'spro-grade';
  const dentro = doc.createElement('input');
  dentro.type = 'checkbox';
  host.append(dentro);
  doc.body.append(host);
  const vistos: string[][] = [];
  const parar = observarSelecao(doc, (ids) => vistos.push([...ids]));
  dentro.click();
  await Promise.resolve();
  assert.deepEqual(vistos, [], 'clique da grade e ignorado');
  doc.querySelector<HTMLInputElement>('input[value="1"]')!.click();
  await Promise.resolve();
  assert.deepEqual(vistos, [['1']], 'clique na linha nativa continua sendo observado');
  parar();
});
