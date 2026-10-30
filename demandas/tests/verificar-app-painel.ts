import { barrasEmpilhadas, colunasPorMes, estrelas } from "../src/app/componentes/graficos";
import { montarPainel } from "../src/app/componentes/vistaPainel";
import { type DemandaNaTela, naTela } from "../src/app/dados";
import type { FiltroDemandas } from "../src/modelo/filtro";
import { appDeTeste, telaDoApp, texto } from "./apoioApp";
import { demanda, HOJE } from "./fabrica";
import { checar, secao, tique } from "./util";

const ana = { login: "ana", nome: "Ana Lima" };
const lista = (): DemandaNaTela[] =>
  [
    demanda({ id: "1", responsavel: ana, prazo: "2026-10-05", titulo: "Atrasada velha" }),
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
      concluidaEm: "2026-09-05",
      distribuidaEm: "2026-09-01",
      prazo: "2026-09-10",
      avaliacao: { nota: 2, por: "x", em: 1 },
    }),
    demanda({ id: "6", prazo: "2026-10-09" }),
  ].map((d) => naTela(d, "unidade", HOJE));

function painel(itens = lista(), periodo: "30" | "90" | "365" | "tudo" = "tudo") {
  const doc = telaDoApp();
  const filtros: FiltroDemandas[] = [];
  const periodos: string[] = [];
  const el = montarPainel({ itens, hoje: HOJE, periodo, aoFiltrarTabela: (f) => filtros.push(f), aoPeriodo: (p) => periodos.push(p) });
  doc.body.append(el);
  return { doc, el, filtros, periodos };
}
const bloco = (el: Element, b: string) => el.querySelector(`[data-bloco="${b}"]`) as HTMLElement;

export async function verificarAppPainel(): Promise<void> {
  secao("painel: situacao geral e atrasadas");
  {
    const p = painel();
    checar(
      "quatro blocos em section.dem-painel",
      p.el.matches("section.dem-painel") && p.el.querySelectorAll("article.dem-bloco").length === 4,
    );
    const cartoes = [...bloco(p.el, "situacao").querySelectorAll(".dem-cartao-conta")];
    checar("cinco cartoes de contagem", cartoes.length === 5);
    const conta = (s: string) => texto(bloco(p.el, "situacao").querySelector(`[data-situacao="${s}"] .dem-conta-n`));
    checar(
      "contagens: 2 nao iniciadas, 1 iniciada, 0 pausadas, 1 concluida, 1 avaliada (a de nota 2 e concluida em setembro)",
      conta("nao_iniciada") === "2" &&
        conta("iniciada") === "1" &&
        conta("pausada") === "0" &&
        conta("concluida") === "1" &&
        conta("avaliada") === "2",
      [conta("nao_iniciada"), conta("avaliada")],
    );
    (bloco(p.el, "situacao").querySelector('[data-situacao="iniciada"]') as HTMLElement).click();
    checar(
      "clicar no cartao filtra a Tabela por aquela situacao",
      p.filtros.length === 1 && JSON.stringify(p.filtros[0]) === '{"situacoes":["iniciada"]}',
    );
    const at = [...bloco(p.el, "situacao").querySelectorAll(".dem-atrasadas li")];
    checar(
      "atrasadas: a mais atrasada primeiro, com 'ha N dias'",
      at.length === 2 &&
        at[0]?.getAttribute("data-id") === "1" &&
        texto(at[0]?.querySelector(".dem-atrasada-dias")) === "há 7 dias" &&
        texto(at[1]?.querySelector(".dem-atrasada-dias")) === "há 3 dias",
    );
    const sem = painel([naTela(demanda({ id: "x" }), "unidade", HOJE)]);
    checar("sem atrasadas: 'Nenhuma demanda atrasada'", texto(bloco(sem.el, "situacao")).includes("Nenhuma demanda atrasada"));
  }

  secao("painel: carga por responsavel");
  {
    const p = painel();
    const g = bloco(p.el, "carga").querySelector("svg") as SVGElement;
    checar(
      "grafico com role img e resumo em texto",
      g.getAttribute("role") === "img" && (g.getAttribute("aria-label") ?? "").includes("Ana Lima"),
    );
    const linhas = [...g.querySelectorAll("[data-chave]")];
    checar(
      "uma linha por pessoa, 'Sem responsavel' incluido e destacado",
      linhas.length === 3 &&
        linhas.some((l) => l.getAttribute("data-chave") === "__sem__" && l.getAttribute("class")?.includes("dem-destacada")),
    );
    const ana1 = linhas.find((l) => l.getAttribute("data-chave") === "l:ana") as Element;
    checar(
      "cada parte tem <title> com o numero (leitor de tela)",
      [...ana1.querySelectorAll("rect > title")].map((t) => t.textContent).join("|") === "1 abertas|1 atrasadas|1 concluídas",
    );
    checar("os totais tambem aparecem como texto", texto(ana1.querySelector(".dem-g-total")) === "3");
    ana1.dispatchEvent(new (p.doc.defaultView as unknown as { Event: typeof Event }).Event("click", { bubbles: true }));
    checar("clicar na linha filtra a Tabela pela pessoa", JSON.stringify(p.filtros.at(-1)) === '{"responsaveis":["l:ana"]}');
    (bloco(p.el, "carga").querySelector('button[data-chave="__sem__"]') as HTMLElement).click();
    checar("o atalho por teclado faz o mesmo", JSON.stringify(p.filtros.at(-1)) === '{"responsaveis":["__sem__"]}');
    checar("legenda sempre presente", texto(bloco(p.el, "carga").querySelector(".dem-legenda")) === "AbertasAtrasadasConcluídas");
    const vazio = barrasEmpilhadas({ linhas: [] });
    checar("sem linhas nao quebra", vazio.getAttribute("role") === "img");
  }

  secao("painel: entregas por mes e prazo medio");
  {
    const p = painel();
    const b = bloco(p.el, "entregas");
    checar(
      "prazo medio com uma casa e virgula, e percentual",
      texto(b.querySelector(".dem-resumo")) === "prazo médio: 5,7 dias · 67% no prazo",
      texto(b.querySelector(".dem-resumo")),
    );
    const colunas = [...b.querySelectorAll(".dem-coluna-mes")];
    checar("uma coluna por mes, em ordem", colunas.map((c) => c.getAttribute("data-mes")).join() === "2026-09,2026-10");
    const out = colunas[1] as Element;
    checar(
      "outubro: no prazo e fora do prazo, com <title>",
      [...out.querySelectorAll("rect > title")].map((t) => t.textContent).join("|") === "1 no prazo|1 fora do prazo",
    );
    const svg = b.querySelector("svg") as SVGElement;
    checar(
      "grafico com role img e aria-label",
      svg.getAttribute("role") === "img" && (svg.getAttribute("aria-label") ?? "").includes("out/26: 1 no prazo, 1 fora do prazo"),
    );
    checar("legenda no prazo / fora do prazo", texto(b.querySelector(".dem-legenda")) === "No prazoFora do prazo");
    const vazio = painel([naTela(demanda({ id: "x" }), "unidade", HOJE)]);
    checar("sem entregas: mensagem", texto(bloco(vazio.el, "entregas")).includes("Ainda não há demandas concluídas neste período."));
    checar(
      "colunas limitam a 12 meses",
      colunasPorMes(
        Array.from({ length: 20 }, (_, i) => ({ mes: `2025-${String((i % 12) + 1).padStart(2, "0")}`, noPrazo: 1, foraDoPrazo: 0 })),
      ).querySelectorAll(".dem-coluna-mes").length === 12,
    );
  }

  secao("painel: estimado x gasto e nota");
  {
    const p = painel();
    const t = texto(bloco(p.el, "tempo").querySelector('[data-parte="tempo"]'));
    checar("estimado, gasto e desvio medio", t === "Estimado 1 h 30 min · Gasto 2 h · desvio médio +15 min por demanda", t);
    const n = bloco(p.el, "tempo").querySelector('[data-parte="nota"]') as HTMLElement;
    checar("nota media com virgula", texto(n).includes("Nota média 3,0"));
    const dist = n.querySelector(".dem-notas") as HTMLElement;
    checar(
      "distribuicao de 1 a 5 com role img",
      dist.getAttribute("role") === "img" &&
        dist.querySelectorAll(".dem-nota-linha").length === 5 &&
        texto(dist.querySelector('[data-nota="4"] .dem-nota-n')) === "1" &&
        texto(dist.querySelector('[data-nota="3"] .dem-nota-n')) === "0",
    );
    checar(
      "a barra proporcional usa a largura relativa",
      (dist.querySelector('[data-nota="4"] .dem-tom-nota') as HTMLElement).style.width === "100%",
    );
    const vazio = painel([naTela(demanda({ id: "x" }), "unidade", HOJE)]);
    checar("sem avaliacoes: mensagem", texto(bloco(vazio.el, "tempo")).includes("Nenhuma avaliação neste período."));
    checar("estrelas() sozinho", estrelas([0, 0, 0, 0, 0]).querySelectorAll(".dem-nota-linha").length === 5);
    const menos = painel([
      naTela(
        demanda({ id: "y", concluidaEm: "2026-10-05", prazo: "2026-10-10", tempoEstimadoMin: 90, tempoGastoMin: 60 }),
        "unidade",
        HOJE,
      ),
    ]);
    checar(
      "desvio negativo",
      texto(bloco(menos.el, "tempo").querySelector('[data-parte="tempo"]')).endsWith("desvio médio −30 min por demanda"),
    );
  }

  secao("painel: periodo");
  {
    const p = painel(lista(), "tudo");
    checar("com tudo, as duas entregas de setembro e outubro", p.el.querySelectorAll(".dem-coluna-mes").length === 2);
    (p.el.querySelector('[data-periodo="30"]') as HTMLElement).click();
    checar(
      "30 dias recalcula (setembro sai)",
      p.el.querySelectorAll(".dem-coluna-mes").length === 1 &&
        (p.el.querySelector('[data-periodo="30"]') as HTMLElement).getAttribute("aria-pressed") === "true",
    );
    checar("e avisa o app (grava a preferencia)", p.periodos.join() === "30");
    checar(
      "o que esta aberto nao some com o periodo",
      texto(bloco(p.el, "situacao").querySelector('[data-situacao="nao_iniciada"] .dem-conta-n')) === "2",
    );
    (p.el.querySelector('[data-periodo="30"]') as HTMLElement).click();
    checar("clicar no periodo atual nao repete o aviso", p.periodos.length === 1);
  }

  secao("painel: no app");
  {
    const t = appDeTeste();
    await t.repos.unidade.criar({ titulo: "A", prazo: "2026-10-05", distribuidaEm: "2026-10-01", responsavel: ana });
    await t.montar();
    (t.raiz.querySelector('[data-aba="painel"]') as HTMLElement).click();
    checar("a aba Painel mostra os quatro blocos", t.raiz.querySelectorAll(".dem-bloco").length === 4);
    (t.raiz.querySelector('[data-situacao="nao_iniciada"]') as HTMLElement).click();
    await tique(10);
    checar(
      "clicar no cartao troca para a Tabela",
      !!t.raiz.querySelector(".dem-tabela") && t.raiz.querySelector('[data-aba="tabela"]')?.getAttribute("aria-selected") === "true",
    );
    (t.raiz.querySelector('[data-aba="painel"]') as HTMLElement).click();
    (t.raiz.querySelector('[data-periodo="365"]') as HTMLElement).click();
    await tique(10);
    checar("o periodo escolhido vira preferencia", (await t.deps.preferencias.ler()).periodoPainel === "365");
  }

  secao("painel: pilulas do titulo (aplicarAlerta)");
  {
    const t = appDeTeste();
    const minhaAtrasada = await t.repos.unidade.criar({
      titulo: "Minha atrasada",
      prazo: "2026-10-05",
      distribuidaEm: "2026-10-01",
      responsavel: ana,
    });
    await t.repos.unidade.criar({
      titulo: "De outro",
      prazo: "2026-10-05",
      distribuidaEm: "2026-10-01",
      responsavel: { login: "carla", nome: "Carla Dias" },
    });
    const minhaSemana = await t.repos.unidade.criar({
      titulo: "Minha da semana",
      prazo: "2026-10-16",
      distribuidaEm: "2026-10-01",
      responsavel: ana,
    });
    const app = await t.montar();
    app.aplicarAlerta("atrasadas");
    await tique(10);
    const ids = () => [...t.raiz.querySelectorAll(".dem-tab-linha")].map((l) => l.getAttribute("data-id"));
    checar(
      "atrasadas: a Tabela com so as minhas atrasadas",
      t.raiz.querySelector('[data-aba="tabela"]')?.getAttribute("aria-selected") === "true" && ids().join() === minhaAtrasada.id,
      ids(),
    );
    app.aplicarAlerta("semana");
    await tique(10);
    checar("semana: so as minhas que vencem nos proximos 7 dias", ids().join() === minhaSemana.id, ids());
    checar("a visao escolhida vira preferencia", (await t.deps.preferencias.ler()).visao === "tabela");
    app.destruir();
    app.aplicarAlerta("atrasadas");
    checar("depois de destruido, o pedido nao faz nada", t.raiz.querySelector(".dem-tabela") === null);
  }
}
