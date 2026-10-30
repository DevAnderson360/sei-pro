/**
 * Painel de estatísticas (spec 5.5): quatro blocos (situação e atrasadas, carga por responsável, entregas por mês e
 * prazo médio, estimado x gasto e nota). Os números vêm de `calcularEstatisticas`; o período é local ao painel
 * (recalcula na hora) e avisa o app para gravar a preferência. Cartões e linhas de pessoa levam à Tabela já filtrada.
 */

import { type DataISO, somarDias } from "@comum/datas/dias";
import { h } from "@comum/ui/dom";
import { calcularEstatisticas, type Estatisticas } from "../../modelo/estatisticas";
import type { FiltroDemandas } from "../../modelo/filtro";
import type { Situacao } from "../../modelo/situacao";
import type { PreferenciasDemandas } from "../../preferencias";
import type { DemandaNaTela } from "../dados";
import { plural, rotuloDaSituacao, tempoHumano } from "../formato";
import { barrasEmpilhadas, colunasPorMes, estrelas } from "./graficos";

type Periodo = PreferenciasDemandas["periodoPainel"];

export interface OpcoesPainel {
  itens: readonly DemandaNaTela[];
  hoje: DataISO;
  periodo: Periodo;
  aoFiltrarTabela(f: FiltroDemandas): void;
  aoPeriodo(p: Periodo): void;
}

const PERIODOS: ReadonlyArray<[Periodo, string]> = [
  ["30", "30 dias"],
  ["90", "90 dias"],
  ["365", "12 meses"],
  ["tudo", "Tudo"],
];
const CARTOES: readonly Situacao[] = ["nao_iniciada", "iniciada", "pausada", "concluida", "avaliada"];
const MAX_ATRASADAS = 8;

/** "6,3": uma casa decimal, vírgula. */
export const decimal = (n: number): string => n.toFixed(1).replace(".", ",");

function desvio(min: number): string {
  const r = Math.round(min);
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${tempoHumano(Math.abs(r))}`;
}

function blocoSituacao(e: Estatisticas, o: OpcoesPainel): HTMLElement {
  const cartoes = CARTOES.map((s) =>
    h(
      "button",
      {
        type: "button",
        class: "dem-cartao-conta",
        "data-situacao": s,
        "aria-label": `${rotuloDaSituacao[s]}: ${e.porSituacao[s]}. Ver na Tabela`,
        onclick: () => o.aoFiltrarTabela({ situacoes: [s] }),
      },
      h("span", { class: "dem-conta-n" }, String(e.porSituacao[s])),
      h("span", { class: "dem-conta-rotulo" }, rotuloDaSituacao[s]),
    ),
  );
  const atrasadas = e.atrasadas.length
    ? h(
        "ul",
        { class: "dem-atrasadas" },
        ...e.atrasadas
          .slice(0, MAX_ATRASADAS)
          .map((a) =>
            h(
              "li",
              { "data-id": a.id },
              h("span", { class: "dem-atrasada-titulo", title: a.titulo }, a.titulo),
              h("span", { class: "dem-atrasada-quem" }, a.responsavel?.nome ?? "Sem responsável"),
              h("span", { class: "dem-atrasada-dias" }, `há ${plural(a.diasAtraso, "dia", "dias")}`),
            ),
          ),
        e.atrasadas.length > MAX_ATRASADAS
          ? h("li", { class: "dem-atrasadas-mais" }, `e mais ${e.atrasadas.length - MAX_ATRASADAS}`)
          : null,
      )
    : h("p", { class: "dem-painel-vazio" }, "Nenhuma demanda atrasada");
  return h(
    "article",
    { class: "dem-bloco", "data-bloco": "situacao" },
    h("h3", {}, "Situação geral"),
    h("div", { class: "dem-contas" }, ...cartoes),
    h("h4", {}, "Atrasadas"),
    atrasadas,
  );
}

function blocoCarga(e: Estatisticas, o: OpcoesPainel): HTMLElement {
  const linhas = e.cargaPorResponsavel
    .filter((c) => c.abertas + c.concluidas > 0)
    .map((c) => ({
      rotulo: c.nome,
      chave: c.chave,
      destacada: c.chave === "__sem__",
      partes: [
        { valor: c.abertas - c.atrasadas, tom: "aberta", titulo: "abertas" },
        { valor: c.atrasadas, tom: "atrasada", titulo: "atrasadas" },
        { valor: c.concluidas, tom: "concluida", titulo: "concluídas" },
      ],
    }));
  const grafico = barrasEmpilhadas({ linhas, rotuloEixo: "Carga por responsável" });
  grafico.addEventListener("click", (ev) => {
    const chave = (ev.target as Element | null)?.closest?.("[data-chave]")?.getAttribute("data-chave");
    if (chave) o.aoFiltrarTabela({ responsaveis: [chave] });
  });
  const legenda = h(
    "p",
    { class: "dem-legenda" },
    ...(
      [
        ["aberta", "Abertas"],
        ["atrasada", "Atrasadas"],
        ["concluida", "Concluídas"],
      ] as const
    ).map(([tom, rotulo]) =>
      h("span", { class: "dem-legenda-item" }, h("i", { class: `dem-chip dem-chip-${tom}`, "aria-hidden": "true" }), rotulo),
    ),
  );
  // O mesmo atalho do clique no gráfico, para quem usa o teclado.
  const atalhos = h(
    "div",
    { class: "dem-atalhos", role: "group", "aria-label": "Ver na Tabela por pessoa" },
    ...linhas.map((l) =>
      h(
        "button",
        {
          type: "button",
          class: "spro-botao pequeno",
          "data-chave": l.chave,
          onclick: () => o.aoFiltrarTabela({ responsaveis: [l.chave] }),
        },
        l.rotulo,
      ),
    ),
  );
  return h(
    "article",
    { class: "dem-bloco", "data-bloco": "carga" },
    h("h3", {}, "Carga por responsável"),
    linhas.length ? h("div", {}, grafico, legenda, atalhos) : h("p", { class: "dem-painel-vazio" }, "Nenhuma demanda para mostrar."),
  );
}

function blocoEntregas(e: Estatisticas): HTMLElement {
  const sem = e.entregasPorMes.length === 0;
  return h(
    "article",
    { class: "dem-bloco", "data-bloco": "entregas" },
    h("h3", {}, "Entregas por mês"),
    sem
      ? h("p", { class: "dem-painel-vazio" }, "Ainda não há demandas concluídas neste período.")
      : h(
          "div",
          {},
          h(
            "p",
            { class: "dem-resumo" },
            h("strong", {}, `prazo médio: ${decimal(e.prazoMedioDias ?? 0)} dias`),
            " · ",
            h("strong", {}, `${e.percentualNoPrazo ?? 0}% no prazo`),
          ),
          colunasPorMes(e.entregasPorMes),
          h(
            "p",
            { class: "dem-legenda" },
            h("span", { class: "dem-legenda-item" }, h("i", { class: "dem-chip dem-chip-noprazo", "aria-hidden": "true" }), "No prazo"),
            h(
              "span",
              { class: "dem-legenda-item" },
              h("i", { class: "dem-chip dem-chip-foraprazo", "aria-hidden": "true" }),
              "Fora do prazo",
            ),
          ),
        ),
  );
}

function blocoTempoENota(e: Estatisticas): HTMLElement {
  const temTempo = e.desvioMedioMin !== null;
  const tempo = temTempo
    ? h(
        "p",
        { class: "dem-resumo", "data-parte": "tempo" },
        `Estimado ${tempoHumano(e.estimadoMin)} · Gasto ${tempoHumano(e.gastoMin)} · desvio médio ${desvio(e.desvioMedioMin ?? 0)} por demanda`,
      )
    : h("p", { class: "dem-painel-vazio", "data-parte": "tempo" }, "Nenhuma demanda concluída com tempo estimado e gasto neste período.");
  const nota =
    e.notaMedia !== null
      ? h(
          "div",
          { "data-parte": "nota" },
          h("p", { class: "dem-resumo" }, h("strong", {}, `Nota média ${decimal(e.notaMedia)}`)),
          estrelas(e.distribuicaoNotas),
        )
      : h("p", { class: "dem-painel-vazio", "data-parte": "nota" }, "Nenhuma avaliação neste período.");
  return h("article", { class: "dem-bloco", "data-bloco": "tempo" }, h("h3", {}, "Estimado × gasto e nota"), tempo, nota);
}

export function montarPainel(o: OpcoesPainel): HTMLElement {
  let periodo = o.periodo;
  const corpo = h("div", { class: "dem-painel-corpo" });
  const seletor = h("div", { class: "spro-segmentado", role: "group", "aria-label": "Período" });

  const pintar = (): void => {
    seletor.replaceChildren(
      ...PERIODOS.map(([id, rotulo]) =>
        h(
          "button",
          {
            type: "button",
            "data-periodo": id,
            "aria-pressed": String(id === periodo),
            onclick: () => {
              if (id === periodo) return;
              periodo = id;
              o.aoPeriodo(id);
              pintar();
            },
          },
          rotulo,
        ),
      ),
    );
    const e = calcularEstatisticas(
      o.itens.map((x) => x.demanda),
      { hoje: o.hoje, ...(periodo === "tudo" ? {} : { desde: somarDias(o.hoje, -Number(periodo)) }) },
    );
    corpo.replaceChildren(blocoSituacao(e, o), blocoCarga(e, o), blocoEntregas(e), blocoTempoENota(e));
  };
  pintar();
  return h(
    "section",
    { class: "dem-painel", "aria-label": "Painel de estatísticas" },
    h("div", { class: "dem-painel-cab" }, h("span", { class: "dem-painel-periodo" }, "Período das concluídas"), seletor),
    corpo,
  );
}
