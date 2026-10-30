/**
 * Decorações por cima da Frappe, desenhadas no gancho `after_render` (ajuste 4):
 * marco em losango, fase como barra-resumo fina (rótulo acima quando a lista
 * está escondida) e linha de base (traço cinza fino sob a barra com "plano
 * original") quando a etapa foi replanejada. Tudo por `createElementNS` e
 * `textContent`; cada chamada apaga a decoração anterior da barra (idempotente).
 */

import { diferencaDias } from "@comum/datas/dias";
import { dataValida, meiaNoite } from "../modelo/calendario";
import { replanejada } from "../modelo/linhaDeBase";
import type { DataISO } from "../modelo/tipos";
import dateUtils from "../vendor/frappe-gantt/date_utils";
import type Gantt from "../vendor/frappe-gantt/index";
import type { BarraFrappe } from "../vendor/frappe-gantt/index";
import type { Linha } from "./linhas";

const NS = "http://www.w3.org/2000/svg";
export const CLASSE_DECORACAO = "spro-deco";
/** Meia diagonal do losango do marco, em px. */
export const RAIO_MARCO = 9;

export interface OpcoesDecoracao {
  /** Com a lista à esquerda, o rótulo da fase sai do Gantt (a lista já mostra). */
  mostrarLista: boolean;
}

/** Largura de um dia na escala atual (mês = 30 dias e ano = 365, como a Frappe mede as barras). */
export function pxPorDia(g: Gantt): number {
  return g.config.column_width / dateUtils.convert_scales(g.config.view_mode.step, "day");
}

/** Posição horizontal de um dia, pela mesma conta que a Frappe usa para o início das barras. */
export function xDaData(g: Gantt, iso: DataISO): number {
  return (dateUtils.diff(meiaNoite(iso), g.gantt_start, g.config.unit) / g.config.step) * g.config.column_width;
}

function svg<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>): SVGElementTagNameMap[K] {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, String(v));
  return el;
}

const numero = (el: Element, attr: string): number => Number(el.getAttribute(attr)) || 0;

export function decorarBarra(g: Gantt, barra: BarraFrappe, linha: Linha | undefined, op: OpcoesDecoracao): void {
  for (const velho of [...barra.group.querySelectorAll(`.${CLASSE_DECORACAO}`)]) velho.remove();
  if (!linha) return;
  const x = numero(barra.$bar, "x");
  const largura = numero(barra.$bar, "width");
  const { y, height: altura } = barra;
  const rotulo = barra.group.querySelector<SVGTextElement>(".bar-label");

  if (linha.tipo === "fase") {
    for (const r of [barra.$bar, barra.$bar_progress]) {
      if (!r) continue;
      r.setAttribute("y", String(y + altura / 2 + 2));
      r.setAttribute("height", "5");
      r.setAttribute("rx", "2.5");
      r.setAttribute("ry", "2.5");
    }
    if (rotulo) {
      if (op.mostrarLista) rotulo.setAttribute("display", "none");
      else {
        rotulo.removeAttribute("display");
        rotulo.classList.add("big");
        rotulo.setAttribute("x", String(x + 2));
        rotulo.setAttribute("y", String(y + altura / 2 - 6));
      }
    }
    return;
  }

  if (linha.tipo !== "etapa") return;
  const e = linha.etapa;
  if (e.marco) {
    const cx = x + largura / 2;
    const cy = y + altura / 2;
    const s = RAIO_MARCO;
    const losango = svg("path", {
      class: `${CLASSE_DECORACAO} spro-marco`,
      d: `M${cx} ${cy - s}L${cx + s} ${cy}L${cx} ${cy + s}L${cx - s} ${cy}Z`,
    });
    barra.group.insertBefore(losango, barra.group.firstChild);
    if (rotulo) {
      rotulo.classList.add("big");
      rotulo.setAttribute("x", String(cx + s + 6));
    }
  }
  // Base com data que não existe (dado antigo ou editado à mão) não desenha: lançar aqui, no
  // requestAnimationFrame da Frappe, deixaria as barras seguintes sem decoração.
  if (e.base && dataValida(e.base.inicio) && dataValida(e.base.fim) && replanejada(e)) {
    const xb = xDaData(g, e.base.inicio);
    const wb = (diferencaDias(e.base.inicio, e.base.fim) + 1) * pxPorDia(g);
    barra.group.append(
      svg("rect", { class: `${CLASSE_DECORACAO} spro-base`, x: xb, y: y + altura + 2, width: wb, height: 3, rx: 1.5, ry: 1.5 }),
    );
    const texto = svg("text", { class: `${CLASSE_DECORACAO} spro-base-txt`, x: xb + wb + 4, y: y + altura + 3.5 });
    texto.textContent = "plano original";
    barra.group.append(texto);
  }
}

export function decorar(g: Gantt, linhas: ReadonlyMap<string, Linha>, op: OpcoesDecoracao): void {
  for (const b of g.bars) decorarBarra(g, b, linhas.get(b.task.id), op);
}
