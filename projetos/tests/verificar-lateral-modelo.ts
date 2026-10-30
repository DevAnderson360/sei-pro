/**
 * Puros do P5: o prazo em palavras (agenda e balões), a urgência da faixa da
 * árvore, os grupos da Agenda, a linha do cartão do projeto e o mini-Gantt do
 * lateral (meses posicionados por data).
 */

import { montarUnidade } from "../src/app/dados";
import { agendaDaUnidade, linhaDoCartao } from "../src/app/lateral/agenda";
import { linhasDoProjeto } from "../src/gantt/linhas";
import { miniGantt } from "../src/gantt/miniGantt";
import { textoDaUrgencia, textoDoPrazo, urgenciaDaEtapa } from "../src/modelo/prazo";
import type { Etapa, Fase, Projeto } from "../src/modelo/tipos";
import { HOSTIL } from "./cenarioGantt";
import { etapa, fase, HOJE, projeto } from "./fabrica";
import { checar, secao } from "./util";

const unidade = (projetos: Projeto[], etapas: Etapa[], fases: Fase[] = []) =>
  montarUnidade([{ vis: "unidade", dados: { projetos, fases, etapas, modelos: [] } }], HOJE);

export function verificarLateralModelo(): void {
  secao("lateral: prazo em palavras (hoje = terca 06/10/2026)");
  const casos: Array<[string, Partial<Etapa>, string]> = [
    ["concluida", { concluidaEm: "2026-10-05" }, "concluída em 05/10"],
    ["marco cumprido", { marco: true, inicio: "2026-10-05", fim: "2026-10-05", concluidaEm: "2026-10-05" }, "cumprido em 05/10"],
    ["atrasada", { inicio: "2026-09-01", fim: "2026-10-02" }, "venceu 02/10"],
    ["marco futuro", { marco: true, inicio: "2026-10-23", fim: "2026-10-23" }, "marco 23/10"],
    ["marco hoje", { marco: true, inicio: HOJE, fim: HOJE }, "marco hoje"],
    ["vence hoje", { inicio: "2026-10-01", fim: HOJE }, "vence hoje"],
    ["comeca depois", { inicio: "2026-10-16", fim: "2026-10-30" }, "começa 16/10"],
    ["nesta semana, com o dia", { inicio: "2026-10-05", fim: "2026-10-09" }, "até sex 09/10"],
    ["depois desta semana", { inicio: "2026-10-01", fim: "2026-10-15" }, "até 15/10"],
    ["outro ano", { inicio: "2026-10-01", fim: "2027-01-29" }, "até 29/01/2027"],
  ];
  for (const [nome, m, esperado] of casos) {
    const t = textoDoPrazo(etapa({ id: "x", ...m }), HOJE);
    checar(`${nome}: "${esperado}"`, t === esperado, t);
  }

  secao("lateral: urgencia da faixa da arvore (atrasada ou ate 3 dias uteis)");
  const u = (m: Partial<Etapa>) => urgenciaDaEtapa(etapa({ id: "u", ...m }), HOJE);
  const atr = u({ inicio: "2026-09-01", fim: "2026-10-02" });
  checar("atrasada com os dias uteis", atr?.tipo === "atrasada" && atr.dias === 2 && textoDaUrgencia(atr) === "atrasada", atr);
  checar("vence hoje", textoDaUrgencia(u({ inicio: "2026-10-01", fim: HOJE }) ?? { tipo: "vence", dias: 99 }) === "vence hoje");
  const sexta = u({ fim: "2026-10-09" });
  checar("sexta: 3 dias uteis", sexta?.tipo === "vence" && sexta.dias === 3 && textoDaUrgencia(sexta) === "vence em 3 dias úteis");
  // 12/10/2026 é feriado nacional (segunda): a terça 13/10 está a 4 dias úteis, a segunda conta 3.
  checar("o feriado nao conta: segunda 12/10 (feriado) ainda e urgente", u({ fim: "2026-10-12" })?.dias === 3);
  checar("4 dias uteis: sem faixa", u({ fim: "2026-10-13" }) === null);
  checar("concluida: sem faixa", u({ fim: "2026-10-02", concluidaEm: "2026-10-02" }) === null);
  checar("lapide: sem faixa", u({ fim: "2026-10-02", removidoEm: 5 }) === null);
  checar("1 dia util no singular", textoDaUrgencia({ tipo: "vence", dias: 1 }) === "vence em 1 dia útil");

  secao("lateral: agenda em tres grupos, sem repetir etapa");
  const pA = projeto({ id: "pA", nome: "Revisão da Resolução", ordem: "a0" });
  const pB = projeto({ id: "pB", nome: HOSTIL, ordem: "a1" });
  const pArq = projeto({ id: "pArq", nome: "Arquivado", ordem: "a2", arquivadoEm: 9 });
  const eu = { login: "ana", nome: "Ana Lima" };
  const etapas = [
    etapa({
      id: "atr",
      projeto: "pA",
      nome: "Relatório",
      inicio: "2026-09-01",
      fim: "2026-10-02",
      responsavel: { login: "carla", nome: "Carla Dias" },
    }),
    etapa({ id: "atr2", projeto: "pB", nome: "Antiga", inicio: "2026-09-01", fim: "2026-09-20" }),
    etapa({
      id: "sem",
      projeto: "pB",
      nome: "Pesquisa",
      inicio: "2026-10-05",
      fim: "2026-10-09",
      responsavel: { login: "ana", nome: "Ana Lima" },
    }),
    etapa({ id: "p30", projeto: "pA", nome: "Consolidação", inicio: "2026-10-16", fim: "2026-11-06" }),
    etapa({ id: "p30b", projeto: "pA", nome: "Contribuições", inicio: "2026-09-15", fim: "2026-10-15" }),
    etapa({ id: "longe", projeto: "pA", nome: "Longa", inicio: "2026-09-01", fim: "2026-12-30" }),
    etapa({ id: "feita", projeto: "pA", nome: "Feita", inicio: "2026-09-01", fim: "2026-10-02", concluidaEm: "2026-10-01" }),
    etapa({ id: "arq", projeto: "pArq", nome: "De arquivado", inicio: "2026-09-01", fim: "2026-10-02" }),
  ];
  const d = unidade([pA, pB, pArq], etapas);
  const g = agendaDaUnidade(d.ativos, HOJE, { soMinhas: false, eu });
  const ids = (id: string) =>
    g
      .find((x) => x.id === id)
      ?.itens.map((i) => i.etapa.id)
      .join() ?? "";
  checar(
    "grupos na ordem, com titulo",
    g.map((x) => x.titulo).join() === "Atrasadas,Esta semana,Próximos 30 dias",
    g.map((x) => x.titulo),
  );
  checar("atrasadas: a que venceu antes primeiro", ids("atrasadas") === "atr2,atr", ids("atrasadas"));
  checar("esta semana", ids("semana") === "sem");
  checar(
    "proximos 30 dias: pela data que importa (termina 15/10 antes de comecar 16/10)",
    ids("proximos30") === "p30b,p30",
    ids("proximos30"),
  );
  const todas = g.flatMap((x) => x.itens.map((i) => i.etapa.id));
  checar(
    "concluida, longe e de projeto arquivado ficam fora",
    !todas.includes("feita") && !todas.includes("longe") && !todas.includes("arq"),
  );
  checar("sem repetir", new Set(todas).size === todas.length);
  const item = g[0]?.itens[0];
  checar(
    "o item traz o projeto, a situacao e o prazo",
    item?.projeto.projeto.nome === HOSTIL && item.situacao === "atrasada" && item.prazo === "venceu 20/09",
  );
  const minhas = agendaDaUnidade(d.ativos, HOJE, { soMinhas: true, eu });
  checar(
    "so as minhas: so a da Ana, e grupo vazio some",
    minhas.length === 1 && minhas[0]?.id === "semana" && minhas[0].itens[0]?.etapa.id === "sem",
  );
  checar("sem nada: nenhum grupo", agendaDaUnidade([], HOJE, { soMinhas: false, eu }).length === 0);

  secao("lateral: linha do cartao do projeto");
  const cartao = (etapasDoP: Etapa[]) => linhaDoCartao(unidade([projeto({ id: "c" })], etapasDoP).ativos[0]!, HOJE);
  checar("sem etapas", cartao([]).texto === "sem etapas");
  const comAtraso = cartao([
    etapa({ id: "a", projeto: "c", inicio: "2026-09-01", fim: "2026-10-02" }),
    etapa({ id: "b", projeto: "c", inicio: "2026-10-05", fim: "2026-12-10" }),
  ]);
  checar("com atraso: vermelho", comAtraso.texto === "1 atrasada · termina 10/12" && comAtraso.tom === "perigo", comAtraso);
  const normal = cartao([
    etapa({ id: "a", projeto: "c", inicio: "2026-09-01", fim: "2026-10-02", concluidaEm: "2026-10-02" }),
    etapa({ id: "b", projeto: "c", inicio: "2026-10-05", fim: "2027-01-29" }),
  ]);
  checar(
    "em dia: feitas de total e o termino com o ano",
    normal.texto === "1 de 2 · termina 29/01/2027" && normal.tom === "normal",
    normal,
  );
  const feito = cartao([etapa({ id: "a", projeto: "c", inicio: "2026-09-01", fim: "2026-09-30", concluidaEm: "2026-09-30" })]);
  checar("concluido: verde, com a data", feito.texto === "concluído em 30/09" && feito.tom === "ok", feito);

  secao("lateral: mini-Gantt com os meses por data");
  const f1 = fase({ id: "f1", projeto: "m", nome: "Instrução", ordem: "a0" });
  const ets = [
    etapa({ id: "n1", projeto: "m", fase: "f1", nome: HOSTIL, inicio: "2026-08-03", fim: "2026-08-21" }),
    etapa({ id: "mc", projeto: "m", fase: "f1", nome: "Publicação", marco: true, inicio: "2026-12-10", fim: "2026-12-10" }),
  ];
  const linhas = linhasDoProjeto({ projeto: "m", fases: [f1], etapas: ets }, { hoje: HOJE, ordem: "inicio", recolhidas: new Set() });
  const mg = miniGantt(linhas, HOJE);
  checar("cinco meses, de agosto a dezembro", mg.meses.map((m) => m.rotulo).join() === "ago,set,out,nov,dez", mg.meses);
  // Período de 01/08 a 31/12: 153 dias. Setembro começa no dia 31 (20,26%); hoje (06/10) no dia 66 (43,14%).
  checar("setembro onde ele comeca", mg.meses[1]?.pos === 20.26 && mg.meses[0]?.pos === 0, mg.meses);
  checar("hoje por data", mg.hoje === 43.14, mg.hoje);
  const [lf, l1, l2] = mg.linhas;
  checar("fase e etapas na ordem do painel", lf?.tipo === "fase" && lf.nome === "Instrução" && l1?.id === "n1" && l2?.id === "mc");
  checar(
    "barra: inicio e largura em % (03/08 a 21/08 = 19 dias)",
    l1?.tipo === "etapa" && l1.esquerda === 1.31 && l1.largura === 12.42 && l1.nome === HOSTIL,
    l1,
  );
  checar("marco: losango na data", l2?.tipo === "etapa" && l2.marco && l2.esquerda === 85.62, l2);
  const fora = miniGantt(
    linhasDoProjeto({ projeto: "m", fases: [], etapas: [ets[1]!] }, { hoje: HOJE, ordem: "inicio", recolhidas: new Set() }),
    HOJE,
  );
  checar("hoje fora do periodo: sem linha de hoje", fora.hoje === null && fora.meses.length === 1);
  const longo = miniGantt(
    linhasDoProjeto(
      { projeto: "m", fases: [], etapas: [etapa({ id: "l", projeto: "m", inicio: "2026-03-02", fim: "2028-02-28" })] },
      { hoje: HOJE, ordem: "inicio", recolhidas: new Set() },
    ),
    HOJE,
  );
  checar(
    "dois anos: no maximo 8 rotulos, e o ano quando muda",
    longo.meses.length === 8 && longo.meses[0]?.rotulo === "mar" && longo.meses[4]?.rotulo === "mar/27",
    longo.meses.map((m) => m.rotulo),
  );
  const virada = miniGantt(
    linhasDoProjeto(
      { projeto: "m", fases: [], etapas: [etapa({ id: "v", projeto: "m", inicio: "2026-11-02", fim: "2027-01-15" })] },
      { hoje: HOJE, ordem: "inicio", recolhidas: new Set() },
    ),
    HOJE,
  );
  checar("virada do ano", virada.meses.map((m) => m.rotulo).join() === "nov,dez,jan/27", virada.meses);
  const torta = miniGantt(
    linhasDoProjeto(
      { projeto: "m", fases: [], etapas: [etapa({ id: "t", projeto: "m", inicio: "2026-13-40", fim: "2026-10-09" })] },
      { hoje: HOJE, ordem: "inicio", recolhidas: new Set() },
    ),
    HOJE,
  );
  checar("data que nao existe: barra vazia, sem lancar", torta.linhas[0]?.tipo === "etapa" && torta.linhas[0].largura === 0);
  checar(
    "sem etapas: o mes de hoje",
    miniGantt([], HOJE)
      .meses.map((m) => m.rotulo)
      .join() === "out",
  );

  secao("lateral (rodada 1): ano fora de 2000-2100, data torta e lapide");
  const opcoes = { hoje: HOJE, ordem: "inicio" as const, recolhidas: new Set<string>() };
  const mini = (m: Partial<Etapa>) =>
    miniGantt(linhasDoProjeto({ projeto: "m", fases: [], etapas: [etapa({ id: "r", projeto: "m", ...m })] }, opcoes), HOJE);
  const g9999 = mini({ inicio: "2026-10-01", fim: "9999-12-31" });
  checar(
    "fim 9999: nao lanca, barra vazia e eixo do mes de hoje",
    g9999.linhas[0]?.tipo === "etapa" && g9999.linhas[0].largura === 0 && g9999.meses.length === 1,
    g9999,
  );
  const g1900 = mini({ inicio: "1900-01-01", fim: "2026-10-09" });
  checar("inicio 1900 nao distorce o eixo", g1900.meses.length === 1 && g1900.meses[0]?.rotulo === "out", g1900.meses);
  const g2100 = mini({ inicio: "2100-12-01", fim: "2101-01-10" });
  checar("inicio 2100 com fim 2101: nao lanca", g2100.linhas[0]?.tipo === "etapa" && g2100.linhas[0].largura === 0);
  const g100 = mini({ inicio: "2000-01-03", fim: "2100-12-30" });
  checar("seculo inteiro: no maximo 8 rotulos", g100.meses.length <= 8 && g100.meses.length > 0, g100.meses.length);

  const tortas: unknown[] = [null, "", "2026-13-40", "2026-02-31", "2026-10-07x", "9999-01-01", "1900-01-01"];
  for (const t of tortas) {
    const e = etapa({ id: "t", projeto: "pA", inicio: "2026-10-01", fim: t as string });
    let texto = "";
    let ok = true;
    try {
      texto = textoDoPrazo(e, HOJE);
      urgenciaDaEtapa(e, HOJE);
      agendaDaUnidade(unidade([projeto({ id: "pA" })], [e]).ativos, HOJE, { soMinhas: false, eu });
    } catch {
      ok = false;
    }
    checar(`fim ${JSON.stringify(t)}: nao lanca e diz "sem data"`, ok && texto === "sem data" && !texto.includes("undefined"), texto);
    checar(`fim ${JSON.stringify(t)}: sem faixa na arvore`, urgenciaDaEtapa(e, HOJE) === null);
  }
  const tInicio = textoDoPrazo(etapa({ id: "t", inicio: "2026-13-40", fim: "2026-10-30" }), HOJE);
  checar("inicio torto: segue pelo termino", tInicio === "até 30/10", tInicio);
  const tConc = textoDoPrazo(etapa({ id: "t", concluidaEm: "2026-13-40" }), HOJE);
  checar("concluidaEm torto: so concluida, sem data inventada", tConc === "concluída", tConc);

  const comLapide = linhaDoCartao(
    unidade(
      [projeto({ id: "c" })],
      [
        etapa({ id: "a", projeto: "c", inicio: "2026-09-01", fim: "2026-09-30", concluidaEm: "2026-09-30" }),
        etapa({ id: "b", projeto: "c", inicio: "2026-09-01", fim: "2026-10-05", concluidaEm: "2026-10-05", removidoEm: 5 }),
      ],
    ).ativos[0]!,
    HOJE,
  );
  checar("lapide nao entra no concluido em", comLapide.texto === "concluído em 30/09" && comLapide.tom === "ok", comLapide);
}
