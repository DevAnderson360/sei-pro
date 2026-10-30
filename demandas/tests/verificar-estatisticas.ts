import { calcularEstatisticas } from "../src/modelo/estatisticas";
import { demanda, HOJE } from "./fabrica";
import { checar, secao } from "./util";

export function verificarEstatisticas(): void {
  const ana = { login: "ana", nome: "Ana Lima" };
  const lista = [
    demanda({ id: "1", responsavel: ana, prazo: "2026-10-05" }),
    demanda({ id: "2", responsavel: ana, iniciadaEm: 5, prazo: "2026-10-30", tempoEstimadoMin: 120 }),
    demanda({
      id: "3",
      responsavel: ana,
      iniciadaEm: 5,
      concluidaEm: "2026-10-04",
      distribuidaEm: "2026-10-01",
      prazo: "2026-10-10",
      tempoEstimadoMin: 60,
      tempoGastoMin: 90,
    }),
    demanda({
      id: "4",
      responsavel: { nome: "Carla Dias" },
      iniciadaEm: 5,
      concluidaEm: "2026-10-12",
      distribuidaEm: "2026-10-02",
      prazo: "2026-10-08",
      avaliacao: { nota: 4, por: "x", em: 1 },
      tempoEstimadoMin: 30,
      tempoGastoMin: 30,
    }),
    demanda({
      id: "5",
      concluidaEm: "2026-09-15",
      distribuidaEm: "2026-09-10",
      prazo: "2026-09-20",
      avaliacao: { nota: 2, por: "x", em: 1 },
    }),
    demanda({ id: "6", concluidaEm: "2026-08-01", distribuidaEm: "2026-07-25", prazo: "2026-08-05", arquivadoEm: 9 }),
  ];
  const e = calcularEstatisticas(lista, { hoje: HOJE });

  secao("Situacao geral e atrasadas");
  checar(
    "contagem por situacao",
    e.porSituacao.nao_iniciada === 1 &&
      e.porSituacao.iniciada === 1 &&
      e.porSituacao.concluida === 1 &&
      e.porSituacao.avaliada === 2 &&
      e.porSituacao.arquivada === 1 &&
      e.porSituacao.pausada === 0,
  );
  checar(
    "atrasadas so as nao concluidas, da mais atrasada",
    e.atrasadas.map((a) => a.id).join(",") === "1" && e.atrasadas[0]?.diasAtraso === 7,
  );

  secao("Carga por responsavel");
  const ana1 = e.cargaPorResponsavel.find((c) => c.chave === "l:ana");
  checar("abertas, atrasadas e concluidas da Ana", ana1?.abertas === 2 && ana1.atrasadas === 1 && ana1.concluidas === 1);
  checar(
    "sem responsavel aparece",
    e.cargaPorResponsavel.some((c) => c.chave === "__sem__"),
  );
  checar("ordem: mais abertas primeiro", e.cargaPorResponsavel[0]?.chave === "l:ana");

  secao("Entregas por mes e prazo medio");
  const set = e.entregasPorMes.find((m) => m.mes === "2026-09");
  const out = e.entregasPorMes.find((m) => m.mes === "2026-10");
  checar("setembro: 1 no prazo", set?.noPrazo === 1 && set.foraDoPrazo === 0);
  checar("agosto (arquivada) conta como entrega", e.entregasPorMes.find((m) => m.mes === "2026-08")?.noPrazo === 1);
  checar("outubro: 1 no prazo e 1 fora", out?.noPrazo === 1 && out.foraDoPrazo === 1);
  checar("meses em ordem", e.entregasPorMes.map((m) => m.mes).join(",") === "2026-08,2026-09,2026-10");
  checar("prazo medio em dias (distribuicao ate conclusao: 3, 10, 5 e 7)", Math.abs((e.prazoMedioDias ?? 0) - 6.25) < 0.01);
  checar("percentual no prazo (3 de 4)", e.percentualNoPrazo === 75);

  secao("Estimado x gasto e nota");
  checar("soma do estimado e do gasto das concluidas com os dois dados", e.estimadoMin === 90 && e.gastoMin === 120);
  checar("desvio medio (gasto - estimado)", e.desvioMedioMin === 15);
  checar("nota media e distribuicao", e.notaMedia === 3 && e.distribuicaoNotas.join(",") === "0,1,0,1,0");

  secao("Periodo");
  const p = calcularEstatisticas(lista, { hoje: HOJE, desde: "2026-10-01" });
  checar("periodo corta as concluidas antigas, nao as abertas", p.entregasPorMes.length === 1 && p.porSituacao.nao_iniciada === 1);
  checar("sem concluidas, medias sao nulas", calcularEstatisticas([demanda({ id: "x" })], { hoje: HOJE }).prazoMedioDias === null);
}
