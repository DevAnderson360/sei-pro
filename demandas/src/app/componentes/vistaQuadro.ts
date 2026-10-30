/**
 * Vista Quadro (spec 5.3): uma coluna por situação. Arrastar o cartão aplica a matriz do ciclo de vida; o que o quadro
 * decide (dados que o movimento pede, movimento recusado) mora em `modelo/quadro.ts` e em `acoes.moverPara`. Arrastar
 * por HTML5 nativo, sem biblioteca; a alternativa por teclado é o menu do cartão (Mover para) e Alt+setas.
 */

import type { DataISO } from "@comum/datas/dias";
import { h } from "@comum/ui/dom";
import type { EntradaMenu } from "@comum/ui/menu";
import { COLUNAS_DO_QUADRO, colunasDoQuadro } from "../../modelo/quadro";
import type { Situacao } from "../../modelo/situacao";
import type { DemandaNaTela } from "../dados";
import { plural, rotuloDaColuna } from "../formato";
import { montarCartao } from "./cartao";

export interface OpcoesQuadro {
  itens: readonly DemandaNaTela[];
  hoje: DataISO;
  mostrarArquivadas: boolean;
  concluidasDias: number;
  aoMover(alvo: DemandaNaTela, destino: Situacao): Promise<boolean>;
  aoReordenar(alvo: DemandaNaTela, antesId: string | null, depoisId: string | null): Promise<void>;
  itensDoMenu(alvo: DemandaNaTela): EntradaMenu[];
  /** "Ver mais" das concluídas e avaliadas antigas: o app aumenta os dias e grava a preferência. */
  aoVerMais?(): void;
}

/**
 * Os vizinhos de uma posição entre os cartões da coluna: só os do mesmo escopo contam (a ordem de cada escopo é
 * independente e o repositório só conhece os próprios).
 */
export function vizinhosNaColuna(
  coluna: readonly DemandaNaTela[],
  alvo: DemandaNaTela,
  posicao: number,
): { antes: string | null; depois: string | null } {
  const irmaos = coluna.filter((x) => x.demanda.id !== alvo.demanda.id);
  const mesmo = (x: DemandaNaTela | undefined) => (x && x.vis === alvo.vis ? x.demanda.id : undefined);
  let antes: string | null = null;
  for (let i = posicao - 1; i >= 0 && antes === null; i--) antes = mesmo(irmaos[i]) ?? null;
  let depois: string | null = null;
  for (let i = posicao; i < irmaos.length && depois === null; i++) depois = mesmo(irmaos[i]) ?? null;
  return { antes, depois };
}

export function montarQuadro(o: OpcoesQuadro): HTMLElement {
  const colunas = colunasDoQuadro(o.itens, { hoje: o.hoje, mostrarArquivadas: o.mostrarArquivadas, concluidasDias: o.concluidasDias });
  const porId = new Map(o.itens.map((x) => [x.demanda.id, x]));
  let arrastando: string | null = null;
  const raiz = h("div", { class: "dem-quadro" });
  const lista: Situacao[] = [...COLUNAS_DO_QUADRO, ...(o.mostrarArquivadas ? (["arquivada"] as const) : [])];

  /** Quantas concluídas ou avaliadas ficaram de fora pela janela de dias. */
  const ocultas = (s: Situacao) =>
    s === "concluida" || s === "avaliada" ? o.itens.filter((x) => x.situacao === s).length - colunas[s].length : 0;

  for (const s of lista) {
    const corpo = h("div", { class: "dem-coluna-corpo", "data-coluna": s });
    const cartoes = colunas[s];
    for (const [k, x] of cartoes.entries()) {
      corpo.append(
        montarCartao(x, {
          hoje: o.hoje,
          itensDoMenu: () => o.itensDoMenu(x),
          aoMoverNaColuna: (delta) => {
            // Alt+seta: passa por cima do vizinho (a posição entre os outros cartões é a de k ± 1).
            const alvoPos = k + delta;
            if (alvoPos < 0 || alvoPos >= cartoes.length) return;
            const v = vizinhosNaColuna(cartoes, x, alvoPos);
            void o.aoReordenar(x, v.antes, v.depois);
          },
        }),
      );
    }
    if (!cartoes.length) corpo.append(h("div", { class: "dem-coluna-vazia" }, "Nenhuma demanda"));
    corpo.addEventListener("dragover", (ev) => {
      if (!arrastando) return;
      ev.preventDefault(); // só quem tem drop liberado deixa soltar
      corpo.classList.add("dem-sobre");
    });
    corpo.addEventListener("dragleave", () => corpo.classList.remove("dem-sobre"));
    corpo.addEventListener("drop", (ev) => {
      ev.preventDefault();
      corpo.classList.remove("dem-sobre");
      const id = arrastando ?? (ev as DragEvent).dataTransfer?.getData("text/plain") ?? null;
      arrastando = null;
      const alvo = id ? porId.get(id) : undefined;
      if (!alvo) return;
      // Mesma coluna: reordenar antes do cartão sobre o qual caiu (ou no fim).
      if (alvo.situacao === s) {
        const irmaos = cartoes.filter((x) => x.demanda.id !== id);
        const sobre = (ev.target as Element).closest<HTMLElement>(".dem-cartao")?.dataset.id ?? null;
        const i = sobre ? irmaos.findIndex((x) => x.demanda.id === sobre) : irmaos.length;
        const v = vizinhosNaColuna(cartoes, alvo, i < 0 ? irmaos.length : i);
        void o.aoReordenar(alvo, v.antes, v.depois);
        return;
      }
      void o.aoMover(alvo, s);
    });
    const mais = ocultas(s);
    raiz.append(
      h(
        "section",
        { class: `dem-coluna dem-coluna-${s}`, "data-situacao": s, "aria-label": rotuloDaColuna[s] },
        h("header", {}, h("h3", {}, rotuloDaColuna[s]), h("span", { class: "dem-conta" }, String(cartoes.length))),
        corpo,
        mais > 0 && o.aoVerMais
          ? h(
              "button",
              { type: "button", class: "spro-botao fantasma pequeno dem-ver-mais", onclick: o.aoVerMais },
              `Ver mais (${plural(mais, "antiga", "antigas")})`,
            )
          : null,
      ),
    );
  }
  raiz.addEventListener("dragstart", (ev) => {
    const c = (ev.target as Element).closest<HTMLElement>(".dem-cartao");
    arrastando = c?.dataset.id ?? null;
    const dt = (ev as DragEvent).dataTransfer;
    dt?.setData("text/plain", arrastando ?? "");
    if (dt) dt.effectAllowed = "move";
    c?.classList.add("dem-arrastando");
  });
  raiz.addEventListener("dragend", () => {
    arrastando = null;
    for (const c of raiz.querySelectorAll(".dem-arrastando")) c.classList.remove("dem-arrastando");
    for (const c of raiz.querySelectorAll(".dem-sobre")) c.classList.remove("dem-sobre");
  });
  return raiz;
}
