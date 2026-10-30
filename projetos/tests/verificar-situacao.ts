import { alertasDasEtapas, diasUteisDeAtraso } from "../src/modelo/alertas";
import { progressoDaEtapa, progressoPeloChecklist, progressoPeloTempo } from "../src/modelo/progresso";
import { resumoDeEtapas, resumoDoProjeto } from "../src/modelo/resumo";
import { situacaoEtapa, situacaoMarco } from "../src/modelo/situacao";
import { etapa, HOJE } from "./fabrica";
import { checar, secao } from "./util";

const ids = (l: Array<{ id: string }>) => l.map((e) => e.id).join();

export function verificarSituacao(): void {
  secao("projetos: situacao da etapa e do marco");
  checar("concluida vence tudo", situacaoEtapa(etapa({ id: "a", fim: "2026-01-01", concluidaEm: "2026-01-02" }), HOJE) === "concluida");
  checar("termino ontem e atrasada", situacaoEtapa(etapa({ id: "a", inicio: "2026-10-01", fim: "2026-10-05" }), HOJE) === "atrasada");
  checar("termino hoje ainda nao e atrasada", situacaoEtapa(etapa({ id: "a", inicio: "2026-10-01", fim: HOJE }), HOJE) === "andamento");
  checar("inicio hoje e em andamento", situacaoEtapa(etapa({ id: "a", inicio: HOJE, fim: "2026-10-09" }), HOJE) === "andamento");
  checar("inicio amanha e a iniciar", situacaoEtapa(etapa({ id: "a", inicio: "2026-10-07", fim: "2026-10-09" }), HOJE) === "futura");
  checar(
    "progresso manual antes do inicio poe em andamento (tela 2)",
    situacaoEtapa(etapa({ id: "a", inicio: "2026-10-07", fim: "2026-10-09", progresso: 10 }), HOJE) === "andamento",
  );
  checar(
    "progresso pelo tempo nao antecipa o andamento",
    situacaoEtapa(etapa({ id: "a", inicio: "2026-10-07", fim: "2026-10-09", medida: "tempo", progresso: 10 }), HOJE) === "futura",
  );
  const marco = (m: Parameters<typeof etapa>[0]) => etapa({ marco: true, ...m });
  checar("marco cumprido", situacaoMarco(marco({ id: "m", inicio: HOJE, fim: HOJE, concluidaEm: HOJE }), HOJE) === "cumprido");
  checar(
    "marco de ontem nao cumprido e atrasado",
    situacaoMarco(marco({ id: "m", inicio: "2026-10-05", fim: "2026-10-05" }), HOJE) === "atrasado",
  );
  checar("marco de hoje ainda e futuro", situacaoMarco(marco({ id: "m", inicio: HOJE, fim: HOJE }), HOJE) === "futuro");

  secao("projetos: progresso");
  checar("pelo tempo antes do inicio = 0", progressoPeloTempo("2026-10-07", "2026-10-09", HOJE) === 0);
  checar("pelo tempo no dia do inicio = 0", progressoPeloTempo(HOJE, "2026-10-09", HOJE) === 0);
  checar("pelo tempo no dia do termino = 100", progressoPeloTempo("2026-10-01", HOJE, HOJE) === 100);
  checar("pelo tempo depois do termino = 100", progressoPeloTempo("2026-09-01", "2026-09-30", HOJE) === 100);
  checar("pelo tempo 1 dia: antes 0", progressoPeloTempo("2026-10-07", "2026-10-07", HOJE) === 0);
  checar("pelo tempo 1 dia: no dia 100 (sem divisao por zero)", progressoPeloTempo(HOJE, HOJE, HOJE) === 100);
  checar("pelo tempo no meio: 15 de 22 dias uteis = 68", progressoPeloTempo("2026-09-15", "2026-10-15", HOJE) === 68);
  checar("pelo tempo so em fim de semana nao vira NaN", progressoPeloTempo("2026-10-10", "2026-10-11", "2026-10-10") === 0);
  checar("checklist vazio = 0", progressoPeloChecklist([]) === 0);
  checar("checklist 2 de 3 = 67", progressoPeloChecklist([{ feito: true }, { feito: true }, { feito: false }]) === 67);
  checar("concluida = 100 mesmo com manual 30", progressoDaEtapa(etapa({ id: "a", progresso: 30, concluidaEm: HOJE }), HOJE) === 100);
  checar("manual acima de 100 vira 100", progressoDaEtapa(etapa({ id: "a", progresso: 150 }), HOJE) === 100);
  checar("manual negativo vira 0", progressoDaEtapa(etapa({ id: "a", progresso: -5 }), HOJE) === 0);
  checar("manual NaN vira 0", progressoDaEtapa(etapa({ id: "a", progresso: Number.NaN }), HOJE) === 0);
  checar(
    "medida checklist usa os itens",
    progressoDaEtapa(
      etapa({
        id: "a",
        medida: "checklist",
        progresso: 90,
        checklist: [
          { id: "1", texto: "x", feito: true },
          { id: "2", texto: "y", feito: false },
        ],
      }),
      HOJE,
    ) === 50,
  );

  secao("projetos: resumos de fase e projeto");
  const curta = etapa({ id: "a", inicio: "2026-09-28", fim: "2026-10-02", concluidaEm: "2026-10-02" }); // 5 dias uteis, 100
  const longa = etapa({ id: "b", inicio: "2026-10-07", fim: "2026-10-28" }); // 15 dias uteis (12/10 feriado), 0
  const m = etapa({ id: "m", marco: true, inicio: "2026-10-30", fim: "2026-10-30" });
  const r = resumoDeEtapas([curta, longa, m], HOJE);
  checar("progresso ponderado: (5*100 + 15*0)/20 = 25, marco pesa 0", r.progresso === 25, r);
  checar("inicio e termino do resumo", r.inicio === "2026-09-28" && r.fim === "2026-10-30");
  checar("feitas/total", r.feitas === 1 && r.total === 3);
  const marcos = [
    etapa({ id: "m1", marco: true, inicio: "2026-10-01", fim: "2026-10-01", concluidaEm: "2026-10-01" }),
    etapa({ id: "m2", marco: true, inicio: "2026-10-20", fim: "2026-10-20" }),
  ];
  checar("so marcos: fracao de cumpridos", resumoDeEtapas(marcos, HOJE).progresso === 50);
  checar(
    "sem etapas: progresso 0 e sem datas",
    (() => {
      const v = resumoDeEtapas([], HOJE);
      return v.progresso === 0 && v.total === 0 && v.inicio === undefined;
    })(),
  );
  checar("removidas nao contam", resumoDeEtapas([curta, { ...longa, removidoEm: 5 }], HOJE).total === 1);
  checar("projeto sem etapas", resumoDoProjeto([], HOJE).situacao === "semEtapas");
  checar("projeto concluido", resumoDoProjeto([curta], HOJE).situacao === "concluido");
  const atrasada = etapa({ id: "x", inicio: "2026-09-01", fim: "2026-10-02" });
  const rp = resumoDoProjeto([curta, longa, atrasada], HOJE);
  checar("projeto atrasado e contagem", rp.situacao === "atrasado" && rp.atrasadas === 1, rp);
  checar("projeto em andamento", resumoDoProjeto([curta, longa], HOJE).situacao === "andamento");
  checar("projeto a iniciar", resumoDoProjeto([longa], HOJE).situacao === "aIniciar");
  {
    const impossivel = etapa({ id: "imp", inicio: "2026-13-45", fim: "2026-13-46", medida: "tempo" });
    let rr: ReturnType<typeof resumoDeEtapas> | undefined;
    try {
      rr = resumoDeEtapas([impossivel, curta], HOJE);
    } catch {
      rr = undefined;
    }
    checar(
      "resumo com data impossivel gravada nao lanca e usa so as datas validas",
      rr !== undefined && rr.inicio === curta.inicio && rr.fim === curta.fim && rr.total === 2,
      rr,
    );
  }

  secao("projetos: alertas");
  const lista = [
    etapa({ id: "atr", inicio: "2026-09-01", fim: "2026-10-02" }),
    etapa({ id: "mar", marco: true, inicio: "2026-10-05", fim: "2026-10-05" }),
    etapa({ id: "hoj", inicio: "2026-10-01", fim: HOJE }),
    etapa({ id: "sex", inicio: "2026-10-01", fim: "2026-10-09" }),
    etapa({ id: "seg", inicio: "2026-10-01", fim: "2026-10-13" }),
    etapa({ id: "d30", inicio: "2026-11-05", fim: "2026-11-20" }),
    etapa({ id: "d31", inicio: "2026-11-06", fim: "2026-11-20" }),
    etapa({ id: "ok", inicio: "2026-09-01", fim: "2026-10-02", concluidaEm: "2026-10-02" }),
    etapa({ id: "rem", inicio: "2026-09-01", fim: "2026-10-02", removidoEm: 9 }),
  ];
  const a = alertasDasEtapas(lista, HOJE);
  checar("atrasadas: com marco, sem concluida e sem removida", ids(a.atrasadas) === "atr,mar", ids(a.atrasadas));
  checar("vence nesta semana: de hoje ate sexta", ids(a.semana) === "hoj,sex", ids(a.semana));
  checar(
    "proximos 30 dias: inicio ou termino ate hoje+30 (05/11 entra, 06/11 nao)",
    ids(a.proximos30) === "hoj,sex,seg,d30",
    ids(a.proximos30),
  );
  checar("no sabado nada vence nesta semana", alertasDasEtapas([etapa({ id: "s", fim: "2026-10-10" })], "2026-10-10").semana.length === 0);
  checar("atraso em dias uteis (tela: 2)", diasUteisDeAtraso(lista[0]!, HOJE) === 2);
  checar("sem atraso = 0", diasUteisDeAtraso(lista[2]!, HOJE) === 0);
  checar("concluida nao tem atraso", diasUteisDeAtraso(lista[7]!, HOJE) === 0);
}
