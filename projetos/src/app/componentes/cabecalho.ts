/**
 * Cabeçalho do cartão (tela 1): à esquerda o que identifica o projeto
 * (processo, ou "Processo sigiloso" sem o número, quem vê, "X de Y etapas concluídas", término, lápis); à direita os
 * 5 controles: Gantt|Lista, escala e Hoje (só no Gantt), Filtro e o primário
 * ("+ Etapa" no projeto, "+ Novo projeto" no Todos).
 */

import { h, icone } from "@comum/ui/dom";
import { ESCALAS, type Escala } from "../../gantt/escalas";
import { rotuloDaVis } from "../../modelo/escopo";
import { vinculoSemNumero } from "../../modelo/sigilo";
import type { ProjetoNaTela } from "../dados";
import { dataLonga, plural } from "../formato";
import type { Vista } from "../preferencias";

export interface OpcoesCabecalho {
  modo: "projeto" | "todos";
  projeto?: ProjetoNaTela;
  totais?: { ativos: number; arquivados: number };
  vista: Vista;
  escala: Escala;
  /** Botão do filtro (componentes/filtro.ts): fica o mesmo enquanto o filtro muda. */
  filtro: HTMLElement;
  aoVista(v: Vista): void;
  aoEscala(e: Escala): void;
  aoHoje(): void;
  aoPrimario(): void;
  aoEditarProjeto?: () => void;
  aoAbrirProcesso?: (ev: MouseEvent) => void;
}

const sep = () => h("span", { class: "prj-sep", "aria-hidden": "true" }, " · ");

function metaDoProjeto(o: OpcoesCabecalho, p: ProjetoNaTela): HTMLElement {
  const partes: Array<Node | string> = [];
  const proc = p.projeto.processo;
  if (proc?.protocolo)
    partes.push(
      h(
        "a",
        {
          href: "#",
          class: "prj-processo",
          title: "Abrir o processo",
          onclick: (ev: Event) => {
            ev.preventDefault();
            o.aoAbrirProcesso?.(ev as MouseEvent);
          },
        },
        proc.protocolo,
      ),
      sep(),
    );
  // O vínculo vazio do texto (processo sigiloso cujo número este computador não tem): só texto, sem link.
  else if (vinculoSemNumero(proc))
    partes.push(
      h(
        "span",
        { class: "prj-vis", title: "O número deste processo não está neste computador: o SEI Pro não o envia aos colegas." },
        icone("cadeado", 14),
        "Processo sigiloso",
      ),
      sep(),
    );
  partes.push(h("span", { class: "prj-vis" }, icone(p.vis === "unidade" ? "predio" : "pessoa", 14), rotuloDaVis(p.vis)), sep());
  const r = p.resumo;
  partes.push(r.total ? `${r.feitas} de ${plural(r.total, "etapa concluída", "etapas concluídas")}` : "sem etapas");
  if (r.fim) partes.push(sep(), `termina em ${dataLonga(r.fim)}`);
  partes.push(
    h(
      "button",
      {
        type: "button",
        class: "spro-botao-icone pequeno",
        "aria-label": "Editar projeto",
        title: "Editar projeto",
        onclick: () => o.aoEditarProjeto?.(),
      },
      icone("lapis", 15),
    ),
  );
  return h("div", { class: "prj-meta" }, ...partes);
}

function metaDoTodos(t: { ativos: number; arquivados: number }): HTMLElement {
  return h(
    "div",
    { class: "prj-meta" },
    icone("camadas", 14),
    plural(t.ativos, "projeto ativo", "projetos ativos"),
    ...(t.arquivados ? [sep(), plural(t.arquivados, "arquivado", "arquivados")] : []),
    sep(),
    "clique num projeto para abrir",
  );
}

function segmentado<T extends string>(
  rotulo: string,
  valores: readonly T[],
  atual: T,
  aoEscolher: (v: T) => void,
  icones?: Partial<Record<T, () => SVGSVGElement>>,
) {
  return h(
    "div",
    { class: "spro-segmentado", role: "group", "aria-label": rotulo },
    ...valores.map((v) =>
      h(
        "button",
        { type: "button", "aria-pressed": String(v === atual), onclick: () => aoEscolher(v) },
        icones?.[v]?.() ?? null,
        v === "gantt" ? "Gantt" : v === "lista" ? "Lista" : v,
      ),
    ),
  );
}

export function montarCabecalho(o: OpcoesCabecalho): HTMLElement {
  const gantt = o.vista === "gantt";
  const controles = h(
    "div",
    { class: "prj-ctl" },
    segmentado<Vista>("Vista", ["gantt", "lista"], o.vista, o.aoVista, {
      gantt: () => icone("gantt", 14),
      lista: () => icone("planilha", 14),
    }),
    gantt ? segmentado<Escala>("Escala", ESCALAS, o.escala, o.aoEscala) : null,
    gantt ? h("button", { type: "button", class: "spro-botao fantasma pequeno", onclick: o.aoHoje }, "Hoje") : null,
    o.filtro,
    h(
      "button",
      { type: "button", class: "spro-botao primario", onclick: o.aoPrimario },
      icone("mais", 15),
      o.modo === "todos" ? "Novo projeto" : "Etapa",
    ),
  );
  const meta = o.modo === "projeto" && o.projeto ? metaDoProjeto(o, o.projeto) : metaDoTodos(o.totais ?? { ativos: 0, arquivados: 0 });
  return h("div", { class: "prj-cab" }, meta, controles);
}
