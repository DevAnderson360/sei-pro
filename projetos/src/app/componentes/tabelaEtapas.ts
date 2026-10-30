/** Vista Lista do projeto (tela 1): tabela agrupada por fase. */

import { h } from "@comum/ui/dom";
import type { Linha, LinhaEtapa } from "../../gantt/linhas";
import { ROTULO_MARCO, ROTULO_SITUACAO, type SituacaoEtapa, situacaoMarco } from "../../modelo/situacao";
import type { DataISO } from "../../modelo/tipos";
import { dataLonga } from "../formato";
import { iconeSituacao } from "../icones";

export const TOM_SITUACAO: Record<SituacaoEtapa, string> = {
  concluida: "var(--spro-ok)",
  atrasada: "var(--spro-perigo)",
  andamento: "var(--spro-destaque)",
  futura: "var(--spro-suave)",
};

export function pilulaDaSituacao(l: Pick<LinhaEtapa, "etapa" | "situacao">, hoje: DataISO, extra = ""): HTMLElement {
  const e = l.etapa;
  const rotulo = e.marco ? ROTULO_MARCO[situacaoMarco(e, hoje)] : ROTULO_SITUACAO[l.situacao];
  const tom = e.marco && !e.concluidaEm && l.situacao !== "atrasada" ? "var(--spro-novidade)" : TOM_SITUACAO[l.situacao];
  return h("span", { class: "spro-pilula", style: `--tom:${tom}` }, `${rotulo}${extra}`);
}

export function barraDeProgresso(pct: number, tom = "var(--spro-destaque)"): HTMLElement {
  return h("span", { class: "prj-barra" }, h("i", { style: `width:${Math.max(0, Math.min(100, pct))}%;background:${tom}` }));
}

export function montarTabelaEtapas(
  linhas: readonly Linha[],
  o: { hoje: DataISO; aoClicar(id: string, ancora: Element): void },
): HTMLElement {
  const corpo = h("tbody", {});
  for (const l of linhas) {
    if (l.tipo === "fase") {
      corpo.append(
        h(
          "tr",
          { class: "prj-tab-grupo" },
          h("td", { colspan: "7" }, l.fase.nome, h("span", { class: "prj-tab-conta" }, ` ${l.resumo.feitas}/${l.resumo.total}`)),
        ),
      );
      continue;
    }
    if (l.tipo !== "etapa") continue;
    const e = l.etapa;
    const tr = h(
      "tr",
      { class: "prj-tab-linha", "data-id": l.id, tabindex: "0" },
      h("td", { class: "prj-tab-st" }, iconeSituacao(l.situacao, e.marco)),
      h(
        "td",
        { class: "prj-tab-nome" },
        e.nome,
        e.marco ? h("span", { class: "spro-pilula prj-pilula-marco", style: "--tom:var(--spro-novidade)" }, "marco") : null,
      ),
      h("td", {}, e.responsavel?.nome ?? "—"),
      h("td", {}, dataLonga(e.inicio)),
      h("td", {}, e.marco ? "—" : dataLonga(e.fim)),
      h("td", {}, pilulaDaSituacao(l, o.hoje)),
      h("td", { class: "prj-tab-prog" }, ...(e.marco ? [] : [barraDeProgresso(l.progresso, TOM_SITUACAO[l.situacao]), `${l.progresso}%`])),
    );
    tr.addEventListener("click", () => o.aoClicar(l.id, tr));
    tr.addEventListener("keydown", (ev) => {
      if ((ev as KeyboardEvent).key === "Enter") o.aoClicar(l.id, tr);
    });
    corpo.append(tr);
  }
  return h(
    "table",
    { class: "prj-tabela" },
    h("thead", {}, h("tr", {}, ...["", "Etapa", "Responsável", "Início", "Término", "Situação", "Progresso"].map((t) => h("th", {}, t)))),
    corpo,
  );
}
