/** Peças pequenas repetidas nas vistas: pílula da situação e do prazo, barra do checklist, selo do escopo, marca da prioridade. */

import type { DataISO } from "@comum/datas/dias";
import { h } from "@comum/ui/dom";
import type { Demanda, Prioridade, Vis } from "../../modelo/tipos";
import type { DemandaNaTela } from "../dados";
import { rotuloDaSituacao, rotuloDoPrazo, tomDaSituacao, tomDoPrazo } from "../formato";

export function pilulaDaSituacao(d: DemandaNaTela): HTMLElement {
  return h(
    "span",
    { class: "spro-pilula dem-situacao", style: `--tom:${tomDaSituacao[d.situacao]}`, "data-situacao": d.situacao },
    h("span", {}, rotuloDaSituacao[d.situacao]),
  );
}

export function pilulaDoPrazo(d: DemandaNaTela, hoje?: DataISO): HTMLElement {
  return h(
    "span",
    { class: `spro-pilula dem-prazo dem-prazo-${d.prazo}`, style: `--tom:${tomDoPrazo[d.prazo]}`, "data-prazo": d.prazo },
    h("span", {}, rotuloDoPrazo(d, hoje)),
  );
}

/** "3/5" com a proporção feita; sem checklist, nada. */
export function barraDoChecklist(d: Demanda): HTMLElement | null {
  const total = d.checklist.length;
  if (!total) return null;
  const feitos = d.checklist.filter((i) => i.feito).length;
  return h(
    "span",
    { class: "dem-barra", title: `${feitos} de ${total} itens feitos` },
    h("span", { class: "dem-barra-trilho", "aria-hidden": "true" }, h("i", { style: `width:${Math.round((feitos / total) * 100)}%` })),
    `${feitos}/${total}`,
  );
}

export function seloDoEscopo(vis: Vis): HTMLElement | null {
  return vis === "eu" ? h("span", { class: "dem-selo-eu", title: "Só você vê esta demanda" }, "Só eu") : null;
}

const ROTULO_PRIORIDADE: Record<Prioridade, string> = { normal: "Normal", importante: "Importante", urgente: "Urgente" };

/** A barra colorida da prioridade; `normal` não desenha. */
export function marcaDePrioridade(p: Prioridade): HTMLElement | null {
  if (p === "normal") return null;
  return h("span", {
    class: `dem-prio ${p}`,
    title: `Prioridade ${ROTULO_PRIORIDADE[p].toLowerCase()}`,
    role: "img",
    "aria-label": `Prioridade ${ROTULO_PRIORIDADE[p].toLowerCase()}`,
  });
}
