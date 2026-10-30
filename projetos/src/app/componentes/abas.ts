/**
 * Linha das abas (tela 1): "Todos (N)" e uma aba por projeto ativo (prédio =
 * toda a unidade, pessoa = só eu; ponto vermelho com etapa atrasada;
 * percentual). O excesso vai para "Mais N ▾". À direita: "+ Novo projeto",
 * o estado da sincronia e o botão de ajustes.
 */

import { h, icone } from "@comum/ui/dom";
import { criarMenu } from "@comum/ui/menu";
import { rotuloDaVis } from "../../modelo/escopo";
import type { ProjetoNaTela } from "../dados";
import type { EstadoSincronia } from "../sincronia";

export interface OpcoesAbas {
  ativos: readonly ProjetoNaTela[];
  /** "todos" ou o id do projeto aberto. */
  aberto: string;
  /** Quantas abas de projeto cabem (`limiteDeAbas`). */
  limite: number;
  sincronia: EstadoSincronia;
  /** Botão do menu de ajustes (montado pelo app). */
  menu: HTMLElement;
  aoEscolher(id: string): void;
  aoNovo(): void;
}

/** Quantas abas de projeto cabem na largura (sem medida, como nos testes: 3). */
export function limiteDeAbas(largura: number): number {
  if (!largura) return 3;
  return Math.max(1, Math.floor((largura - 400) / 190));
}

/** As abas visíveis: as primeiras `limite`, com a aberta sempre entre elas (no lugar da última). */
function visiveis(ativos: readonly ProjetoNaTela[], aberto: string, limite: number): ProjetoNaTela[] {
  const primeiras = ativos.slice(0, limite);
  if (aberto === "todos" || primeiras.some((p) => p.projeto.id === aberto)) return primeiras;
  const escolhida = ativos.find((p) => p.projeto.id === aberto);
  return escolhida ? [...primeiras.slice(0, -1), escolhida] : primeiras;
}

function aba(p: ProjetoNaTela, selecionada: boolean, aoEscolher: (id: string) => void): HTMLButtonElement {
  // O ponto vermelho e o ícone do escopo não têm texto: o rótulo diz tudo ao leitor de tela.
  const rotulo = [p.projeto.nome, rotuloDaVis(p.vis), p.resumo.atrasadas ? "com etapa atrasada" : "", `${p.resumo.progresso}%`]
    .filter(Boolean)
    .join(" · ");
  return h(
    "button",
    {
      type: "button",
      role: "tab",
      "aria-selected": String(selecionada),
      "aria-label": rotulo,
      "data-aba": p.projeto.id,
      title: `${p.projeto.nome} · ${rotuloDaVis(p.vis)}`,
      onclick: () => aoEscolher(p.projeto.id),
    },
    icone(p.vis === "unidade" ? "predio" : "pessoa", 15),
    h("span", { class: "prj-aba-nome" }, p.projeto.nome),
    p.resumo.atrasadas ? h("span", { class: "prj-aba-alerta", title: "Tem etapa atrasada" }) : null,
    h("span", { class: "prj-aba-prog" }, `${p.resumo.progresso}%`),
  );
}

/** "sincronizado", "pendente", "erro" ou "neste navegador", com a dica (title). */
export function indicadorDeSincronia(e: EstadoSincronia): HTMLElement {
  return h("span", { class: `prj-sinc prj-sinc-${e.tom}`, title: e.dica }, icone("nuvem", 15), e.rotulo);
}

export function montarAbas(o: OpcoesAbas): HTMLElement {
  const mostradas = visiveis(o.ativos, o.aberto, o.limite);
  const ids = new Set(mostradas.map((p) => p.projeto.id));
  const resto = o.ativos.filter((p) => !ids.has(p.projeto.id));
  // O tablist só tem abas (a11y): o "Mais N" fica no mesmo segmentado, mas fora dele.
  const tabs = h(
    "div",
    { class: "prj-abas-tabs", role: "tablist", "aria-label": "Projetos" },
    h(
      "button",
      {
        type: "button",
        role: "tab",
        "aria-selected": String(o.aberto === "todos"),
        "aria-label": `Todos os projetos (${o.ativos.length})`,
        "data-aba": "todos",
        title: "Todos os projetos (portfólio)",
        onclick: () => o.aoEscolher("todos"),
      },
      icone("camadas", 15),
      "Todos",
      h("span", { class: "prj-aba-prog" }, String(o.ativos.length)),
    ),
    ...mostradas.map((p) => aba(p, p.projeto.id === o.aberto, o.aoEscolher)),
  );
  const lista = h("div", { class: "spro-segmentado prj-abas-lista" }, tabs);
  if (resto.length)
    lista.append(
      criarMenu({
        rotulo: `Mais ${resto.length} ${resto.length === 1 ? "projeto" : "projetos"}`,
        icone: "chevron",
        texto: `Mais ${resto.length}`,
        classe: "prj-aba-mais",
        largura: 280,
        itens: () =>
          resto.map((p) => ({
            rotulo: p.projeto.nome,
            icone: p.vis === "unidade" ? "predio" : "pessoa",
            dica: `${p.resumo.progresso}%`,
            fazer: () => o.aoEscolher(p.projeto.id),
          })),
      }),
    );
  return h(
    "div",
    { class: "prj-abas" },
    lista,
    h(
      "button",
      { type: "button", class: "spro-botao fantasma prj-novo", title: "Novo projeto", onclick: o.aoNovo },
      icone("mais", 15),
      "Novo projeto",
    ),
    h("div", { class: "prj-abas-dir" }, indicadorDeSincronia(o.sincronia), o.menu),
  );
}
