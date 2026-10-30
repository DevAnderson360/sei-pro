import { ESCALAS, escalaEditavel, MEDIDAS, MODOS } from "../src/gantt/escalas";
import { idLinhaFase, type Linha, linhasDoPortfolio, linhasDoProjeto } from "../src/gantt/linhas";
import { classesDaLinha, tarefasDoGantt } from "../src/gantt/tarefas";
import { cenario } from "./cenarioGantt";
import { etapa, fase, HOJE, projeto } from "./fabrica";
import { checar, secao } from "./util";

export function verificarLinhas(): void {
  secao("projetos: escalas do Gantt");
  checar("4 escalas em portugues", ESCALAS.join() === "Dia,Semana,Mês,Ano" && MODOS.map((m) => m.name).join() === ESCALAS.join());
  checar(
    "cabecalho 64 e linha 36 (alinham com a lista)",
    MEDIDAS.cabecalho === MEDIDAS.cabecalhoSuperior + MEDIDAS.cabecalhoInferior + 10 && MEDIDAS.linha === MEDIDAS.barra + MEDIDAS.espaco,
  );
  const semana = MODOS[1]!;
  const sup = semana.upper_text as (d: Date, a: Date | null, l: string) => string;
  const inf = semana.lower_text as (d: Date, a: Date | null, l: string) => string;
  checar("semana: texto inferior dd/mm", inf(new Date(2026, 9, 6), null, "pt-BR") === "06/10");
  checar(
    "semana: mes so quando muda",
    sup(new Date(2026, 9, 6), new Date(2026, 8, 29), "pt-BR") === "Outubro" &&
      sup(new Date(2026, 9, 13), new Date(2026, 9, 6), "pt-BR") === "",
  );
  const dia = MODOS[0]!.upper_text as (d: Date, a: Date | null, l: string) => string;
  checar("dia: mes e ano", dia(new Date(2026, 2, 2), null, "pt-BR") === "Março 2026");
  checar(
    "arrastar so em Dia e Semana",
    escalaEditavel("Dia") && escalaEditavel("Semana") && !escalaEditavel("Mês") && !escalaEditavel("Ano"),
  );

  secao("projetos: linhas do projeto e do portfolio");
  const { fases, etapas } = cenario();
  const ids = (ls: Linha[]) => ls.map((l) => l.id).join();
  const base = { hoje: HOJE, ordem: "inicio" as const, recolhidas: new Set<string>() };
  const todas = linhasDoProjeto({ projeto: "p1", fases, etapas }, base);
  checar(
    "soltas primeiro; fases na ordem; fase vazia aparece",
    ids(todas) === `solta,${idLinhaFase("f1")},e1,e2,${idLinhaFase("f2")},ok,m1,${idLinhaFase("f3")}`,
    ids(todas),
  );
  const f1 = todas.find((l) => l.tipo === "fase" && l.fase.id === "f1");
  checar(
    "resumo da fase: feitas/total e datas",
    f1?.tipo === "fase" && f1.resumo.total === 2 && f1.inicio === "2026-09-01" && f1.fim === "2026-10-09",
  );
  const vazia = todas.find((l) => l.tipo === "fase" && l.fase.id === "f3");
  checar("fase vazia tem barra em hoje", vazia?.tipo === "fase" && vazia.inicio === HOJE && vazia.fim === HOJE);
  const recolhida = linhasDoProjeto({ projeto: "p1", fases, etapas }, { ...base, recolhidas: new Set(["f1"]) });
  checar(
    "fase recolhida esconde as etapas",
    ids(recolhida) === `solta,${idLinhaFase("f1")},${idLinhaFase("f2")},ok,m1,${idLinhaFase("f3")}`,
  );
  const m1 = recolhida.find((l) => l.id === "m1");
  checar("dependencia de etapa escondida sai da linha", m1?.tipo === "etapa" && m1.dependeDe.length === 0);
  const filtrada = linhasDoProjeto({ projeto: "p1", fases, etapas }, { ...base, visiveis: new Set(["e2"]) });
  checar("com filtro, fase sem etapa visivel some", ids(filtrada) === `${idLinhaFase("f1")},e2`);
  checar(
    "ordem por nome",
    ids(linhasDoProjeto({ projeto: "p1", fases: [], etapas }, { ...base, ordem: "nome" })).startsWith("e1,e2,solta"),
  );
  checar(
    "removida nao aparece",
    !ids(linhasDoProjeto({ projeto: "p1", fases, etapas: [...etapas, etapa({ id: "x", removidoEm: 1 })] }, base)).includes("x"),
  );
  const outros = linhasDoProjeto(
    { projeto: "p1", fases: [...fases, fase({ id: "fx", projeto: "p2" })], etapas: [...etapas, etapa({ id: "ex", projeto: "p2" })] },
    base,
  );
  checar("fase e etapa de outro projeto nao entram", !ids(outros).includes("fx") && !ids(outros).includes("ex"));
  const port = linhasDoPortfolio(
    [
      { projeto: projeto({ id: "p1" }), vis: "unidade", etapas },
      { projeto: projeto({ id: "p2" }), vis: "eu", etapas: [] },
      { projeto: projeto({ id: "p3", arquivadoEm: 5 }), vis: "eu", etapas: [] },
    ],
    HOJE,
  );
  checar(
    "portfolio: uma linha por projeto ativo, inclusive sem etapas (arquivado fora)",
    port.length === 2 && port[1]?.inicio === HOJE && port[1]?.resumo.situacao === "semEtapas",
  );

  secao("projetos: tarefas da Frappe");
  const t = tarefasDoGantt(todas);
  checar("uma tarefa por linha (alinhamento)", t.length === todas.length);
  const te1 = t.find((x) => x.id === "e1");
  checar("classe por situacao", te1?.custom_class === "st-atrasada");
  checar("classe do marco", t.find((x) => x.id === "m1")?.custom_class === "st-marco st-futura");
  checar("classe da fase vazia", t.find((x) => x.id === idLinhaFase("f3"))?.custom_class === "st-fase st-vazia");
  checar("classe do projeto", classesDaLinha(port[1]!) === "st-proj st-vazia" && classesDaLinha(port[0]!) === "st-proj st-atrasada");
  checar("dependencias como texto", t.find((x) => x.id === "e2")?.dependencies === "e1");
  const torta = tarefasDoGantt(
    linhasDoProjeto(
      {
        projeto: "p1",
        fases: [],
        etapas: [etapa({ id: "t", inicio: "2026-10-09", fim: "2026-10-01" }), etapa({ id: "l", inicio: "2026-01-01", fim: "2040-01-01" })],
      },
      base,
    ),
  );
  checar("termino antes do inicio vira 1 dia (a Frappe descartaria)", torta.find((x) => x.id === "t")?.end === "2026-10-09");
  checar("mais de 10 anos e cortado no desenho", (torta.find((x) => x.id === "l")?.end ?? "") < "2036-01-01");

  const malformadas = linhasDoProjeto(
    {
      projeto: "p1",
      fases: [],
      etapas: [
        etapa({ id: "a", inicio: "x", fim: "2026-10-09" }),
        etapa({ id: "b", inicio: "2026-10-01", fim: "2026-02-30" }),
        etapa({ id: "c", inicio: "x", fim: "y" }),
      ],
    },
    base,
  );
  let tm: ReturnType<typeof tarefasDoGantt> = [];
  let lancou = false;
  try {
    tm = tarefasDoGantt(malformadas);
  } catch {
    lancou = true;
  }
  const valida = (x: string | undefined) => /^\d{4}-\d{2}-\d{2}$/.test(x ?? "");
  checar("data malformada nao derruba o Gantt e mantem 1 tarefa por linha", !lancou && tm.length === malformadas.length && tm.length === 3);
  checar(
    "inicio invalido usa o fim; fim invalido usa o inicio; ambos invalidos usam hoje",
    tm.find((x) => x.id === "a")?.start === "2026-10-09" &&
      tm.find((x) => x.id === "b")?.end === "2026-10-01" &&
      valida(tm.find((x) => x.id === "c")?.start) &&
      tm.every((x) => valida(x.start) && valida(x.end) && x.end >= x.start),
  );
}
