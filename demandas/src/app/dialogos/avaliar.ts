/** Avaliar: cinco estrelas acessíveis (radiogroup, setas do teclado) e comentário opcional. */

import { h, icone } from "@comum/ui/dom";
import { LIMITES } from "../../modelo/constantes";
import type { DadosAvaliacao } from "../../modelo/operacoes";
import type { Demanda } from "../../modelo/tipos";
import type { ContextoDialogo } from "../tipos";
import { caixaDeErros, campo } from "./campos";
import { perguntar } from "./janela";

type Nota = DadosAvaliacao["nota"];
const NOTAS: readonly Nota[] = [1, 2, 3, 4, 5];

export function abrirDialogoAvaliacao(c: ContextoDialogo, d: Demanda): Promise<DadosAvaliacao | null> {
  return perguntar<DadosAvaliacao>(c, {
    titulo: "Avaliar demanda",
    icone: "estrela",
    montar(responder) {
      const erros = caixaDeErros();
      let nota: Nota | 0 = 0;
      const grupo = h("div", { class: "dem-estrelas", role: "radiogroup", "aria-label": "Nota" });
      const estrelas = NOTAS.map((n) =>
        h("button", {
          type: "button",
          role: "radio",
          class: "dem-estrela",
          "data-nota": String(n),
          "aria-label": `${n} ${n === 1 ? "estrela" : "estrelas"}`,
          "aria-checked": "false",
          tabindex: n === 1 ? "0" : "-1",
          onclick: () => escolher(n),
        }),
      );
      const pintar = () => {
        estrelas.forEach((b, i) => {
          const ligada = i < nota;
          b.setAttribute("aria-checked", String(i + 1 === nota));
          b.setAttribute("tabindex", (nota ? i + 1 === nota : i === 0) ? "0" : "-1");
          b.classList.toggle("dem-estrela-ligada", ligada);
          b.replaceChildren(icone(ligada ? "estrelaCheia" : "estrela", 24));
        });
      };
      const escolher = (n: number, foco = false) => {
        nota = Math.min(5, Math.max(1, n)) as Nota;
        pintar();
        if (foco) estrelas[nota - 1]?.focus?.({ preventScroll: true });
      };
      grupo.addEventListener("keydown", (ev) => {
        const k = ev.key;
        if (k === "ArrowRight" || k === "ArrowUp") escolher(nota + 1, true);
        else if (k === "ArrowLeft" || k === "ArrowDown") escolher((nota || 2) - 1, true);
        else if (k === "Home") escolher(1, true);
        else if (k === "End") escolher(5, true);
        else return;
        ev.preventDefault();
      });
      grupo.append(...estrelas);
      pintar();
      const comentario = h("textarea", { class: "spro-campo", name: "comentario", rows: "3", maxlength: String(LIMITES.comentario) });
      const propria = !!d.responsavel?.login && d.responsavel.login.toLowerCase() === c.contexto.login.toLowerCase();
      const gravar = () => {
        if (!nota) {
          erros.mostrar(["Escolha uma nota de 1 a 5."]);
          return;
        }
        erros.mostrar([]);
        const r: DadosAvaliacao = { nota };
        if (comentario.value.trim()) r.comentario = comentario.value.trim();
        responder(r);
      };
      return h(
        "div",
        { class: "dem-form dem-form-avaliar" },
        h("p", { class: "dem-dialogo-titulo" }, d.titulo),
        propria ? h("p", { class: "dem-dica dem-dica-propria" }, "Você é o responsável por esta demanda.") : null,
        campo("Nota", grupo),
        campo("Comentário", comentario, { opcional: "(opcional)" }),
        erros.el,
        h(
          "div",
          { class: "spro-dialogo-rodape" },
          h("button", { type: "button", class: "spro-botao primario", onclick: gravar }, "Avaliar"),
        ),
      );
    },
  });
}
