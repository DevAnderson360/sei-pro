import assert from 'node:assert/strict';
import { coletar, ErroSessaoColeta } from '../src/andamentos/coletar';
import { dataDoAndamento, estaValido, extrairDados, faixaDaData, VALIDADE_MS, type AndamentoSei } from '../src/modelo/andamentos';
import { agrupar } from '../src/modelo/grupos';
import { criarArmazem } from '../src/persistencia/armazem';
import { areaMemoria as areaFalsa } from '../../sei-comum/src/armazenamento/area';
import { CTX, proc, teste } from './util';

const a = (data: string, unidade: string, descricao: string): AndamentoSei => ({ data, unidade, usuario: 'x', descricao });

// Do mais recente para o mais antigo, como o SEI entrega.
const HISTORICO: AndamentoSei[] = [
  a('02/10/2026 10:00', 'GABIN', 'Processo remetido pela unidade GABIN'),
  a('01/10/2026 09:00', 'GABIN', 'Processo recebido na unidade'),
  a('30/09/2026 16:00', 'SECRETARIA', 'Processo remetido pela unidade SECRETARIA'),
  a('29/09/2026 08:00', 'SECRETARIA', 'Processo recebido na unidade'),
  a('28/09/2026 08:00', 'SECRETARIA', 'Processo público gerado'),
];

teste('andamentos: converte a data do SEI e ignora lixo', () => {
  assert.equal(dataDoAndamento('25/09/2026 14:03'), '2026-09-25');
  assert.equal(dataDoAndamento('ontem'), undefined);
});

teste('andamentos: tira autuacao, recebimento, envio e unidade de envio so da unidade atual', () => {
  assert.deepEqual(extrairDados(HISTORICO, 'GABIN'), { autuacao: '2026-09-28', recebimento: '2026-10-01', envio: '2026-10-02', unidadeEnvio: 'GABIN' });
  assert.deepEqual(extrairDados(HISTORICO, 'SECRETARIA'), { autuacao: '2026-09-28', recebimento: '2026-09-29', envio: '2026-09-30', unidadeEnvio: 'SECRETARIA' });
});

teste('andamentos: o que o andamento nao traz fica de fora (nada e chutado)', () => {
  assert.deepEqual(extrairDados([a('01/10/2026 09:00', 'OUTRA', 'Processo recebido na unidade')], 'GABIN'), {});
  assert.deepEqual(extrairDados([], 'GABIN'), {});
});

teste('andamentos: processo gerado na propria unidade vale como recebimento; reabertura tambem', () => {
  assert.equal(extrairDados([a('28/09/2026 08:00', 'GABIN', 'Processo restrito gerado')], 'GABIN').recebimento, '2026-09-28');
  const r = extrairDados([a('05/10/2026 08:00', 'GABIN', 'Reabertura do processo na unidade'), a('28/09/2026 08:00', 'GABIN', 'Processo público gerado')], 'GABIN');
  assert.equal(r.recebimento, '2026-10-05');
  assert.equal(r.autuacao, '2026-09-28');
});

teste('andamentos: a sigla do historico pode diferir da do cabecalho: vale tambem o nome da unidade (SEI MJ)', () => {
  const mj: AndamentoSei[] = [
    { data: '16/10/2026 19:01', unidade: 'Uni-Teste', unidadeNome: 'Unidade para testes do sistema SEI', usuario: 'x', descricao: 'Processo recebido na unidade' },
    { data: '28/08/2026 17:50', unidade: 'Uni-Teste', unidadeNome: 'Unidade para testes do sistema SEI', usuario: 'x', descricao: 'Processo remetido pela unidade Suporte-SEI' },
    { data: '28/08/2026 17:49', unidade: 'Suporte-SEI', unidadeNome: 'Suporte', usuario: 'x', descricao: 'Processo recebido na unidade' },
  ];
  assert.deepEqual(extrairDados(mj, { sigla: 'TESTE', nome: 'Unidade para testes do sistema SEI' }), { recebimento: '2026-10-16', envio: '2026-08-28', unidadeEnvio: 'Suporte-SEI' });
  assert.deepEqual(extrairDados(mj, { sigla: 'TESTE' }), {}, 'sem o nome, sigla diferente nao casa');
});

teste('andamentos: faixas de data', () => {
  assert.equal(faixaDaData('2026-10-11', '2026-10-11'), 'hoje');
  assert.equal(faixaDaData('2026-10-05', '2026-10-11'), 'semana');
  assert.equal(faixaDaData('2026-09-20', '2026-10-11'), 'mes');
  assert.equal(faixaDaData('2026-08-01', '2026-10-11'), 'trimestre');
  assert.equal(faixaDaData('2025-01-01', '2026-10-11'), 'antigo');
  assert.equal(faixaDaData(undefined, '2026-10-11'), 'sem');
  assert.equal(faixaDaData('2026-12-01', '2026-10-11'), 'sem');
});

teste('andamentos: o cache vale 24 horas', () => {
  assert.ok(estaValido({ consultadoEm: 1000 }, 1000 + VALIDADE_MS - 1));
  assert.ok(!estaValido({ consultadoEm: 1000 }, 1000 + VALIDADE_MS));
  assert.ok(!estaValido({ consultadoEm: 5000 }, 1000), 'relogio voltou: nao vale');
});

teste('andamentos: agrupar por data e por unidade de envio usa o contexto', () => {
  const p1 = proc(); const p2 = proc(); const p3 = proc();
  const ctx = { ...CTX, andamentos: { [p1.id]: { recebimento: '2026-10-11', unidadeEnvio: 'GABIN', consultadoEm: CTX.agora }, [p2.id]: { recebimento: '2026-09-01', unidadeEnvio: 'COGER', consultadoEm: CTX.agora } } };
  const porData = agrupar([p1, p2, p3], 'recebimento', ctx).map((g) => [g.rotulo, g.itens.length]);
  assert.deepEqual(porData, [['Hoje', 1], ['Nos últimos 90 dias', 1], ['Sem informação', 1]]);
  const porUnidade = agrupar([p1, p2, p3], 'unidadeEnvio', ctx).map((g) => g.rotulo);
  assert.deepEqual(porUnidade, ['COGER', 'GABIN', 'Sem informação']);
});

teste('andamentos: o cache por unidade e usuario descarta o vencido e o malformado', async () => {
  const local = areaFalsa();
  const arm = criarArmazem({ local, sync: areaFalsa() }, '10', 'ana');
  const agora = 10_000_000_000;
  await arm.gravarAndamentos({ '1': { recebimento: '2026-10-01', consultadoEm: agora - 1000 }, '2': { consultadoEm: agora - VALIDADE_MS - 1 } });
  const lido = await arm.lerAndamentos(agora);
  assert.deepEqual(Object.keys(lido), ['1']);
  const outro = criarArmazem({ local, sync: areaFalsa() }, '10', 'bia');
  assert.deepEqual(await outro.lerAndamentos(agora), {}, 'outro usuario nao ve o cache');
  await local.gravar({ 'spro_grade_and:10:ana': { itens: { '3': { consultadoEm: 'x' }, '4': { recebimento: '<script>', consultadoEm: agora } } } });
  assert.deepEqual(await arm.lerAndamentos(agora), { '4': { consultadoEm: agora } });
});

teste('coleta: consulta todos, com no maximo as simultaneas pedidas', async () => {
  let ativos = 0; let pico = 0;
  const alvos = Array.from({ length: 7 }, (_, i) => ({ id: String(i) }));
  const vistos: string[] = [];
  const r = await coletar({
    alvos, sinal: new AbortController().signal, simultaneas: 2, pausaMs: 0, esperar: async () => undefined,
    consultar: async (al) => { ativos += 1; pico = Math.max(pico, ativos); await new Promise((x) => setTimeout(x, 2)); ativos -= 1; return al.id === '3' ? null : { recebimento: '2026-10-01' }; },
    aoResolver: (al) => { vistos.push(al.id); },
  });
  assert.equal(r.motivo, 'concluida');
  assert.equal(vistos.length, 7);
  assert.equal(pico, 2);
  assert.deepEqual(r.progresso, { feitos: 7, total: 7, semDados: 1 });
});

teste('coleta: cancelar para sem consultar o resto', async () => {
  const ctl = new AbortController();
  let n = 0;
  const r = await coletar({
    alvos: Array.from({ length: 10 }, (_, i) => ({ id: String(i) })), sinal: ctl.signal, simultaneas: 1, pausaMs: 0, esperar: async () => undefined,
    consultar: async () => { n += 1; if (n === 3) ctl.abort(); return {}; },
    aoResolver: () => undefined,
  });
  assert.equal(r.motivo, 'cancelada');
  assert.ok(n <= 4);
});

teste('coleta: sessao caida interrompe a coleta inteira; erros seguidos tambem', async () => {
  const r1 = await coletar({
    alvos: [{ id: '1' }, { id: '2' }, { id: '3' }], sinal: new AbortController().signal, simultaneas: 1, pausaMs: 0, esperar: async () => undefined,
    consultar: async (al) => { if (al.id === '2') throw new ErroSessaoColeta('caiu'); return {}; }, aoResolver: () => undefined,
  });
  assert.equal(r1.motivo, 'sessao');
  assert.equal(r1.progresso.feitos, 1);
  const falhas: boolean[] = [];
  const r2 = await coletar({
    alvos: Array.from({ length: 20 }, (_, i) => ({ id: String(i) })), sinal: new AbortController().signal, simultaneas: 1, pausaMs: 0, limiteErros: 3, esperar: async () => undefined,
    consultar: async () => { throw new Error('boom'); }, aoResolver: (_a, _d, _p, f) => { falhas.push(f); },
  });
  assert.equal(r2.motivo, 'erros');
  assert.deepEqual(falhas, [true, true, true]);
});
