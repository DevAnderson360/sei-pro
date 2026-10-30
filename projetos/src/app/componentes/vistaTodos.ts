/**
 * "Todos" (tela 1): o portfólio. À esquerda os projetos (escopo, nome, pílula
 * "N atrasada" ou "feitas/total"); à direita um Gantt só leitura com uma barra
 * por projeto (cor pela situação). Clique abre o projeto. Na vista Lista, a
 * tabela de projetos.
 */

import { h, icone } from "@comum/ui/dom";
import type { Escala } from "../../gantt/escalas";
import { linhasDoPortfolio } from "../../gantt/linhas";
import { type ControleGantt, montarGantt } from "../../gantt/montar";
import { rotuloDaVis } from "../../modelo/escopo";
import type { DataISO } from "../../modelo/tipos";
import type { ProjetoNaTela } from "../dados";
import { dataLonga, plural } from "../formato";
import { barraDeProgresso } from "./tabelaEtapas";

export interface DadosVistaTodos {
  itens: readonly ProjetoNaTela[];
  mostrarLista: boolean;
  escala: Escala;
  hoje: DataISO;
}

export interface AcoesVistaTodos {
  /** Injetável nas provas (a Frappe de verdade precisa de medidas). */
  montarGantt?: typeof montarGantt;
  aoAbrir(id: string): void;
  /** A Frappe não montou (spec 9): o app cai para a vista Lista. */
  aoFalharGantt(erro: unknown): void;
}

function pilula(p: ProjetoNaTela): HTMLElement {
  const r = p.resumo;
  return r.atrasadas
    ? h("span", { class: "spro-pilula", style: "--tom:var(--spro-perigo)" }, plural(r.atrasadas, "atrasada", "atrasadas"))
    : h("span", { class: "spro-pilula" }, `${r.feitas}/${r.total}`);
}

export class VistaTodos {
  readonly el: HTMLElement;
  private readonly area: HTMLElement;
  private controle: ControleGantt | null = null;
  private coluna: HTMLElement | null = null;
  /** Projeto sob o mouse: o redesenho (Frappe e coluna) apaga o realce e o mouse nao se mexe. */
  private realcado: string | null = null;

  constructor(
    private d: DadosVistaTodos,
    private readonly acoes: AcoesVistaTodos,
  ) {
    this.el = h("div", { class: "prj-vista prj-vista-todos" });
    this.area = h("div", { class: "prj-gantt" });
    this.area.addEventListener("mouseover", (ev) => {
      this.realcado = (ev.target as Element | null)?.closest?.(".bar-wrapper")?.getAttribute("data-id") ?? null;
      this.realcarLinha(this.realcado);
    });
    this.area.addEventListener("mouseout", () => {
      this.realcado = null;
      this.realcarLinha(null);
    });
    this.montar();
  }

  private realcarLinha(id: string | null): void {
    for (const l of this.coluna?.querySelectorAll(".prj-realce") ?? []) l.classList.remove("prj-realce");
    if (!id || !this.coluna) return;
    [...this.coluna.querySelectorAll(".prj-lin-projeto")].find((l) => l.getAttribute("data-id") === id)?.classList.add("prj-realce");
  }

  private linha(p: ProjetoNaTela): HTMLElement {
    const el = h(
      "div",
      {
        class: "prj-lin prj-lin-projeto",
        "data-id": p.projeto.id,
        role: "button",
        tabindex: "0",
        title: `${p.projeto.nome} · ${rotuloDaVis(p.vis)}`,
      },
      h("span", { class: "prj-lin-escopo" }, icone(p.vis === "unidade" ? "predio" : "pessoa", 15)),
      h("span", { class: "prj-lin-nome" }, p.projeto.nome),
      pilula(p),
    );
    el.addEventListener("click", () => this.acoes.aoAbrir(p.projeto.id));
    el.addEventListener("keydown", (ev) => {
      if ((ev as KeyboardEvent).key === "Enter") this.acoes.aoAbrir(p.projeto.id);
    });
    el.addEventListener("mouseenter", () => {
      this.realcado = p.projeto.id;
      this.controle?.realcar(p.projeto.id, true);
    });
    el.addEventListener("mouseleave", () => {
      this.realcado = null;
      this.controle?.realcar(p.projeto.id, false);
    });
    return el;
  }

  /** Mesmas linhas do Gantt (arquivado e removido ficam de fora nos dois). */
  private visiveis(): ProjetoNaTela[] {
    const ids = new Set(this.linhas().map((l) => l.id));
    return this.d.itens.filter((i) => ids.has(i.projeto.id));
  }

  private desenharColuna(): HTMLElement {
    return h(
      "div",
      { class: "prj-lista" },
      h("div", { class: "prj-lista-cab" }, h("span", {}, "Projeto"), h("span", {}, "Etapas")),
      ...this.visiveis().map((p) => this.linha(p)),
    );
  }

  private linhas() {
    return linhasDoPortfolio(
      this.d.itens.map((i) => ({ projeto: i.projeto, vis: i.vis, etapas: i.etapas })),
      this.d.hoje,
    );
  }

  private reaplicarRealce(): void {
    const id = this.realcado;
    if (!id) return;
    if (!this.d.itens.some((i) => i.projeto.id === id)) {
      this.realcado = null;
      return;
    }
    this.controle?.realcar(id, true);
    this.realcarLinha(id);
  }

  private montar(): void {
    this.controle?.destruir();
    this.coluna = this.d.mostrarLista ? this.desenharColuna() : null;
    this.el.classList.toggle("prj-sem-lista", !this.d.mostrarLista);
    this.el.replaceChildren(...(this.coluna ? [this.coluna] : []), this.area);
    this.controle = (this.acoes.montarGantt ?? montarGantt)(this.area, this.linhas(), {
      escala: this.d.escala,
      hoje: this.d.hoje,
      mostrarLista: this.d.mostrarLista,
      moverDependentes: false,
      somenteLeitura: true,
      aoClicar: (id) => this.acoes.aoAbrir(id),
      aoFalhar: (e) => this.acoes.aoFalharGantt(e),
    });
    this.reaplicarRealce();
  }

  atualizar(d: DadosVistaTodos): void {
    const remontar = d.mostrarLista !== this.d.mostrarLista || d.hoje !== this.d.hoje || !this.controle;
    const escalaMudou = d.escala !== this.d.escala;
    this.d = d;
    if (remontar) {
      this.montar();
      return;
    }
    if (escalaMudou) this.controle?.trocarEscala(d.escala);
    this.controle?.atualizar(this.linhas());
    if (this.coluna) {
      const nova = this.desenharColuna();
      this.coluna.replaceWith(nova);
      this.coluna = nova;
    }
    this.reaplicarRealce();
  }

  rolarParaHoje(): void {
    this.controle?.rolarParaHoje();
  }

  destruir(): void {
    this.controle?.destruir();
    this.controle = null;
  }
}

export function montarTabelaProjetos(itens: readonly ProjetoNaTela[], o: { aoAbrir(id: string): void }): HTMLElement {
  const corpo = h("tbody", {});
  for (const p of itens) {
    const r = p.resumo;
    const tr = h(
      "tr",
      { class: "prj-tab-linha", "data-id": p.projeto.id, tabindex: "0" },
      h("td", { class: "prj-tab-nome" }, p.projeto.nome),
      h("td", {}, rotuloDaVis(p.vis)),
      h("td", {}, r.inicio ? dataLonga(r.inicio) : "—"),
      h("td", {}, r.fim ? dataLonga(r.fim) : "—"),
      h("td", {}, `${r.feitas}/${r.total}`),
      h("td", { class: "prj-tab-prog" }, barraDeProgresso(r.progresso), `${r.progresso}%`),
    );
    tr.addEventListener("click", () => o.aoAbrir(p.projeto.id));
    tr.addEventListener("keydown", (ev) => {
      if ((ev as KeyboardEvent).key === "Enter") o.aoAbrir(p.projeto.id);
    });
    corpo.append(tr);
  }
  return h(
    "table",
    { class: "prj-tabela" },
    h("thead", {}, h("tr", {}, ...["Projeto", "Onde", "Início", "Término", "Etapas", "Progresso"].map((t) => h("th", {}, t)))),
    corpo,
  );
}
