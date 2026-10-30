/**
 * O que o painel lateral mostra: a Agenda, o que fazer agora, em três grupos e o botão "Nova demanda". Puro, sobre os
 * dados do app.
 * - Atrasadas: demandas abertas com responsável e prazo vencido, da mais atrasada para a menos;
 * - Esta semana: abertas com responsável que vencem de hoje até daqui a 7 dias, pelo prazo;
 * - Sem responsável: abertas sem responsável, de qualquer prazo (separado: são as que alguém precisa assumir).
 * Cada demanda entra num grupo só. Com "Só as minhas" (o padrão), os dois primeiros grupos mostram só as minhas.
 * Nada aberto: "Tudo em dia".
 */

import { type DataISO, somarDias } from "@comum/datas/dias";
import { h, icone } from "@comum/ui/dom";
import { ehMinha, estaAberta } from "../../modelo/minhas";
import type { Responsavel } from "../../modelo/tipos";
import type { DemandaNaTela } from "../dados";
import { dataCurta, rotuloDoPrazo } from "../formato";

export type IdGrupoAgenda = "atrasadas" | "semana" | "semResponsavel";

export interface GrupoAgenda {
  id: IdGrupoAgenda;
  titulo: string;
  itens: DemandaNaTela[];
}

const TITULOS: Record<IdGrupoAgenda, string> = {
  atrasadas: "Atrasadas",
  semana: "Esta semana",
  semResponsavel: "Sem responsável",
};

/** Os grupos da Agenda (o vazio não aparece), com os itens já na ordem de cada grupo. */
export function gruposDaAgenda(itens: readonly DemandaNaTela[], o: { hoje: DataISO; eu: Responsavel; soMinhas?: boolean }): GrupoAgenda[] {
  const fim = somarDias(o.hoje, 7);
  const grupos: Record<IdGrupoAgenda, DemandaNaTela[]> = { atrasadas: [], semana: [], semResponsavel: [] };
  for (const x of itens) {
    const d = x.demanda;
    if (!estaAberta(d)) continue;
    if (!d.responsavel) {
      grupos.semResponsavel.push(x);
      continue;
    }
    if (o.soMinhas && !ehMinha(d, o.eu)) continue;
    if (d.prazo < o.hoje) grupos.atrasadas.push(x);
    else if (d.prazo <= fim) grupos.semana.push(x);
  }
  const porTitulo = (a: DemandaNaTela, b: DemandaNaTela) => (a.demanda.titulo < b.demanda.titulo ? -1 : 1);
  // Datas ISO comparam como texto: a mais antiga primeiro (a mais atrasada); empate pelo título.
  const porPrazo = (a: DemandaNaTela, b: DemandaNaTela) =>
    a.demanda.prazo < b.demanda.prazo ? -1 : a.demanda.prazo > b.demanda.prazo ? 1 : porTitulo(a, b);
  grupos.atrasadas.sort(porPrazo);
  grupos.semana.sort(porPrazo);
  grupos.semResponsavel.sort(porPrazo);
  return (Object.keys(grupos) as IdGrupoAgenda[])
    .filter((id) => grupos[id].length)
    .map((id) => ({ id, titulo: TITULOS[id], itens: grupos[id] }));
}

export interface OpcoesAgenda {
  hoje: DataISO;
  eu: Responsavel;
  /** Padrão: true. */
  soMinhas?: boolean;
  /** Clicar numa demanda: abre no painel da aba do SEI. */
  aoClicar(item: DemandaNaTela): void;
  aoNova(): void;
  /** Troca "Só as minhas" por "Todas" (ausente: sem o seletor). */
  aoAlternar?(soMinhas: boolean): void;
}

function linhaDaDemanda(x: DemandaNaTela, o: OpcoesAgenda, grupo: IdGrupoAgenda): HTMLElement {
  const quem = x.demanda.responsavel?.nome;
  return h(
    "button",
    {
      type: "button",
      class: "dem-lat-item",
      "data-id": x.demanda.id,
      title: "Abrir no painel do Controle de Processos",
      onclick: () => o.aoClicar(x),
    },
    h("span", { class: "dem-lat-titulo" }, x.demanda.titulo),
    h(
      "span",
      { class: `dem-lat-info${grupo === "atrasadas" ? " dem-lat-perigo" : ""}` },
      h("span", {}, grupo === "semResponsavel" ? `prazo ${dataCurta(x.demanda.prazo)}` : rotuloDoPrazo(x, o.hoje)),
      quem && o.soMinhas === false ? h("span", { class: "dem-lat-quem" }, quem) : null,
    ),
  );
}

export function montarAgenda(itens: readonly DemandaNaTela[], o: OpcoesAgenda): HTMLElement {
  const soMinhas = o.soMinhas !== false;
  const grupos = gruposDaAgenda(itens, { hoje: o.hoje, eu: o.eu, soMinhas });
  return h(
    "div",
    { class: "dem-lat-agenda" },
    h(
      "div",
      { class: "dem-lat-barra" },
      h("button", { type: "button", class: "spro-botao primario dem-nova", onclick: o.aoNova }, icone("mais", 15), "Nova demanda"),
      o.aoAlternar
        ? h(
            "button",
            {
              type: "button",
              class: "spro-botao fantasma pequeno dem-lat-filtro",
              "aria-pressed": String(soMinhas),
              title: soMinhas ? "Mostrar as demandas de todos" : "Mostrar só as minhas",
              onclick: () => o.aoAlternar?.(!soMinhas),
            },
            soMinhas ? "Só as minhas" : "Todas",
          )
        : null,
    ),
    grupos.length
      ? h(
          "div",
          { class: "dem-lat-grupos" },
          ...grupos.map((g) =>
            h(
              "section",
              { class: `dem-lat-grupo dem-lat-grupo-${g.id}`, "data-grupo": g.id },
              h("h3", { class: "dem-lat-grupo-titulo" }, g.titulo, h("span", { class: "dem-lat-conta" }, String(g.itens.length))),
              ...g.itens.map((x) => linhaDaDemanda(x, { ...o, soMinhas }, g.id)),
            ),
          ),
        )
      : h("p", { class: "dem-lat-nada" }, "Tudo em dia"),
  );
}
