import { areaMemoria } from "@comum/armazenamento/area";
import { LIMITES } from "../src/modelo/constantes";
import { validarDependencias, violacoesDeDatas } from "../src/modelo/dependencias";
import { ErroValidacao } from "../src/modelo/validacao";
import { aplicarModelo, datasDoModelo, previaDoModelo } from "../src/modelos/aplicar";
import { ehEmbutido, MODELOS_EMBUTIDOS } from "../src/modelos/embutidos";
import { modeloDoProjeto } from "../src/modelos/salvar";
import { ESCOPO_UN, novoRepo } from "./apoioRepositorio";
import { C } from "./fabrica";
import { checar, lanca, secao } from "./util";

const [REVISAO, PREGAO, ANUAL] = MODELOS_EMBUTIDOS;

export async function verificarModelos(): Promise<void> {
  secao("projetos: modelos embutidos");
  checar("3 modelos embutidos", MODELOS_EMBUTIDOS.length === 3 && MODELOS_EMBUTIDOS.every((m) => ehEmbutido(m.id)));
  checar(
    "revisao: 9 etapas em 3 fases",
    REVISAO!.etapas.length === 9 && REVISAO!.fases.join() === "Instrução,Consulta pública,Deliberação",
  );
  checar("pregao: 11 etapas em 3 fases", PREGAO!.etapas.length === 11 && PREGAO!.fases.join() === "Planejamento,Seleção,Contrato");
  checar("plano anual: 4 trimestres", ANUAL!.fases.length === 4 && ANUAL!.etapas.length === 12);
  let n = 0;
  for (const m of MODELOS_EMBUTIDOS) {
    const { etapas } = aplicarModelo(m, "2026-01-05", { projeto: "p", carimbo: C, novoId: () => `x${++n}` });
    checar(
      `${m.nome}: sem violacao de datas nem ciclo`,
      violacoesDeDatas(etapas).length === 0 && etapas.every((e) => validarDependencias(e, etapas) === null),
    );
  }

  secao("projetos: aplicar modelo (dias uteis e feriados)");
  const datas = datasDoModelo(REVISAO!, "2026-08-03");
  const texto = datas.map((d) => `${d.inicio.slice(5)}>${d.fim.slice(5)}`).join(" ");
  checar(
    "revisao em 03/08/2026 da as datas da tela 1",
    texto === "08-03>08-21 08-24>09-11 09-01>09-25 09-15>09-15 09-15>10-15 10-16>11-06 11-09>11-27 12-03>12-03 12-10>12-10",
    texto,
  );
  const pv = previaDoModelo(REVISAO!, "2026-08-03");
  checar("previa: 9 etapas em 3 fases, termina 10/12/2026", pv.etapas === 9 && pv.fases === 3 && pv.termina === "2026-12-10");
  checar(
    "previa: 3 primeiras etapas",
    pv.primeiras.map((e) => e.nome).join() === "Nota técnica preliminar,Análise jurídica,Relatório de AIR",
  );
  checar("comecar num sabado vai para o proximo dia util", datasDoModelo(REVISAO!, "2026-10-10")[0]?.inicio === "2026-10-13");
  checar(
    "virada de ano: 31/12 + 1 dia util pula 01/01",
    datasDoModelo({ etapas: [{ ...REVISAO!.etapas[0]!, aPartirDe: 1 }] }, "2026-12-31")[0]?.inicio === "2027-01-04",
  );
  const sab = datasDoModelo(REVISAO!, "2026-12-26");
  checar(
    "sabado atravessando o ano: comeca na segunda 28/12 e pula 01/01",
    sab[0]?.inicio === "2026-12-28" && sab.every((d) => d.inicio.slice(5) !== "01-01" && d.fim.slice(5) !== "01-01"),
    sab[0]?.inicio,
  );
  checar(
    "sabado atravessando o ano: nenhum inicio ou fim em fim de semana",
    sab.every(
      (d) => ![0, 6].includes(new Date(`${d.inicio}T12:00:00`).getDay()) && ![0, 6].includes(new Date(`${d.fim}T12:00:00`).getDay()),
    ),
  );
  checar("modelo sem etapas: previa sem termino", previaDoModelo({ fases: [], etapas: [] }, "2026-10-06").termina === undefined);
  let k = 0;
  const { fases, etapas } = aplicarModelo(REVISAO!, "2026-08-03", { projeto: "p1", carimbo: C, novoId: () => `n${++k}` });
  checar("fases em ordem", fases.map((f) => f.nome).join() === REVISAO!.fases.join() && fases[0]!.ordem < fases[1]!.ordem);
  const minuta = etapas.find((e) => e.nome === "Minuta final")!;
  const air = etapas.find((e) => e.nome === "Relatório de AIR")!;
  checar("dependencias remapeadas para ids novos", minuta.dependeDe.length === 2 && minuta.dependeDe.includes(air.id));
  checar("checklist vira itens nao feitos", air.checklist.length === 3 && air.checklist.every((i) => !i.feito && i.id));
  checar(
    "marco com uma data",
    etapas.filter((e) => e.marco).every((e) => e.inicio === e.fim),
  );
  checar("etapa ligada a fase", air.fase === fases[0]!.id);
  const ruim = { ...REVISAO!, etapas: [{ ...REVISAO!.etapas[0]!, dependeDe: [0, 7, -1] }] };
  checar(
    "indice invalido e auto-dependencia saem",
    aplicarModelo(ruim, "2026-08-03", { projeto: "p", carimbo: C, novoId: () => `z${++k}` }).etapas[0]?.dependeDe.length === 0,
  );

  secao("projetos: modelo hostil nao trava");
  const hEt = { nome: "h", aPartirDe: 1e9, duracao: Number.POSITIVE_INFINITY, marco: false, dependeDe: [], checklist: [] };
  const hostil = {
    ...REVISAO!,
    etapas: [hEt, { ...hEt, aPartirDe: Number.NaN, duracao: Number.NaN }, { ...hEt, aPartirDe: -5, duracao: -1e9 }],
  };
  const t0 = Date.now();
  const ap = aplicarModelo(hostil, "2026-08-03", { projeto: "p", carimbo: C, novoId: () => `h${++k}` });
  const pvh = previaDoModelo(hostil, "2026-08-03");
  checar("modelo hostil: aplicar e previa terminam rapido", Date.now() - t0 < 3000 && ap.etapas.length === 3 && pvh.etapas === 3);
  checar(
    "modelo hostil: datas dentro de 11 anos e fim >= inicio",
    ap.etapas.every((e) => e.fim >= e.inicio && e.fim < "2038-01-01"),
  );
  const enorme = { ...REVISAO!, etapas: Array.from({ length: 5000 }, () => ({ ...REVISAO!.etapas[0]! })) };
  checar(
    "modelo com milhares de etapas e cortado no limite",
    aplicarModelo(enorme, "2026-08-03", { projeto: "p", carimbo: C, novoId: () => `g${++k}` }).etapas.length === LIMITES.etapasPorProjeto,
  );
  const longo = modeloDoProjeto(
    {
      fases: [],
      etapas: [{ ...ap.etapas[0]!, id: "e1", inicio: "2026-01-05", fim: "2100-01-05", removidoEm: undefined, dependeDe: [] }],
    },
    "Longo",
    "ml",
    C,
  );
  checar("salvar como modelo com etapa de 74 anos termina e fica no teto", longo.etapas[0]!.duracao <= 2600);

  secao("projetos: salvar como modelo (ida e volta)");
  const volta = modeloDoProjeto({ fases, etapas }, "Minha revisão", "m1", C);
  const ida = REVISAO!.etapas.map((e) => `${e.aPartirDe}/${e.duracao}`).join();
  checar("ida e volta: mesmos dias uteis e duracoes", volta.etapas.map((e) => `${e.aPartirDe}/${e.duracao}`).join() === ida);
  checar(
    "ida e volta: mesmas dependencias",
    JSON.stringify(volta.etapas.map((e) => e.dependeDe)) === JSON.stringify(REVISAO!.etapas.map((e) => e.dependeDe)),
  );
  checar("ida e volta: fases e checklist", volta.fases.join() === REVISAO!.fases.join() && volta.etapas[2]?.checklist.length === 3);
  checar("modelo de projeto vazio", modeloDoProjeto({ fases: [], etapas: [] }, "Vazio", "m2", C).etapas.length === 0);

  secao("projetos: modelos no repositorio");
  const { repo } = novoRepo(ESCOPO_UN, areaMemoria(), "r");
  const p = await repo.criarProjetoDeModelo({ nome: "Revisão 2026" }, PREGAO!, "2026-10-06");
  const d = await repo.dados();
  checar(
    "projeto de modelo com fases e etapas",
    d.fases.length === 3 && d.etapas.length === 11 && d.etapas.every((e) => e.projeto === p.id),
  );
  const salvo = await repo.salvarComoModelo(p.id, "  Meu pregão ", "uso interno");
  checar(
    "salvar como modelo grava no escopo",
    salvo.nome === "Meu pregão" && (await repo.dados()).modelos.length === 1 && salvo.etapas.length === 11,
  );
  checar("renomear modelo", (await repo.renomearModelo(salvo.id, "Pregão TI")).nome === "Pregão TI");
  const erro = await lanca(() => repo.renomearModelo(salvo.id, ""));
  checar("modelo sem nome recusado", erro instanceof ErroValidacao && erro.mensagens.join() === "Informe o nome do modelo.");
  await repo.removerModelo(salvo.id);
  checar("remover modelo", (await repo.dados()).modelos.length === 0);
  for (let i = 0; i < LIMITES.modelos; i++) await repo.salvarComoModelo(p.id, `M${i}`);
  const cheio = await lanca(() => repo.salvarComoModelo(p.id, "mais um"));
  checar("51o modelo recusado", cheio instanceof ErroValidacao && cheio.mensagens.join() === "Limite de 50 modelos. Exclua algum.");

  secao("projetos: modelos no repositorio - uma gravacao e um aviso");
  let gravacoes = 0;
  const base = areaMemoria();
  const area = {
    ...base,
    gravar: async (i: Record<string, unknown>) => {
      gravacoes++;
      return base.gravar(i);
    },
    aoMudar: base.aoMudar.bind(base),
  } as typeof base;
  const { repo: r2 } = novoRepo(ESCOPO_UN, area, "s");
  let avisos = 0;
  r2.aoMudar(() => avisos++);
  const q = await r2.criarProjetoDeModelo({ nome: "Plano" }, ANUAL!, "2026-12-26");
  checar("criarProjetoDeModelo: 1 gravacao e 1 aviso", gravacoes === 1 && avisos === 1, `${gravacoes} gravacoes, ${avisos} avisos`);
  const dq = await r2.dados();
  checar(
    "criarProjetoDeModelo: 12 etapas em 4 fases gravadas",
    dq.etapas.length === 12 && dq.fases.length === 4 && dq.projetos[0]?.id === q.id,
  );
  gravacoes = 0;
  avisos = 0;
  await r2.salvarComoModelo(q.id, "Plano salvo");
  checar("salvarComoModelo: 1 gravacao e 1 aviso", gravacoes === 1 && avisos === 1, `${gravacoes} gravacoes, ${avisos} avisos`);
  const ruimM = { ...ANUAL!, etapas: [{ ...ANUAL!.etapas[0]!, nome: "" }] };
  gravacoes = 0;
  const recusa = await lanca(() => r2.criarProjetoDeModelo({ nome: "Ruim" }, ruimM, "2026-10-06"));
  checar("modelo invalido recusado sem gravar nada", recusa instanceof ErroValidacao && gravacoes === 0);
}
