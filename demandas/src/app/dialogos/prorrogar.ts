/** Prorrogar: novo prazo e motivo obrigatório; mostra o prazo atual e o original. */

import { h } from "@comum/ui/dom";
import { LIMITES } from "../../modelo/constantes";
import type { DadosProrrogacao } from "../../modelo/operacoes";
import type { Demanda } from "../../modelo/tipos";
import { dataDeFormulario, dataLonga } from "../formato";
import type { ContextoDialogo } from "../tipos";
import { caixaDeErros, campo, linhaDeCampos } from "./campos";
import { perguntar } from "./janela";

/** `sugerido`: o prazo que o campo já traz (o arraste do Cronograma); o texto de "prazo atual" segue o da demanda. */
export function abrirDialogoProrrogacao(c: ContextoDialogo, d: Demanda, sugerido?: string): Promise<DadosProrrogacao | null> {
  return perguntar<DadosProrrogacao>(c, {
    titulo: "Prorrogar prazo",
    icone: "calendario",
    montar(responder) {
      const erros = caixaDeErros();
      const prazo = h("input", { type: "date", class: "spro-campo", name: "prazo", value: sugerido ?? d.prazo });
      const motivo = h("input", { type: "text", class: "spro-campo", name: "motivo", maxlength: String(LIMITES.motivo) });
      const gravar = () => {
        const m: string[] = [];
        const novo = dataDeFormulario(prazo.value);
        if (!novo) m.push("Informe um prazo válido.");
        else if (novo === d.prazo) m.push("O novo prazo é igual ao atual.");
        else if (novo < d.distribuidaEm) m.push(`O prazo não pode ser antes da distribuição (${dataLonga(d.distribuidaEm)}).`);
        if (!motivo.value.trim()) m.push("Informe o motivo da mudança de prazo.");
        erros.mostrar(m);
        if (m.length || !novo) return;
        responder({ prazo: novo, motivo: motivo.value.trim() });
      };
      motivo.addEventListener("keydown", (ev) => {
        if (ev.key === "Enter") {
          ev.preventDefault();
          gravar();
        }
      });
      return h(
        "div",
        { class: "dem-form dem-form-prorrogar" },
        h("p", { class: "dem-dialogo-titulo" }, d.titulo),
        h(
          "p",
          { class: "dem-dica" },
          `Prazo atual: ${dataLonga(d.prazo)}`,
          d.prazoOriginal && d.prazoOriginal !== d.prazo ? ` · prazo original: ${dataLonga(d.prazoOriginal)}` : "",
        ),
        linhaDeCampos(campo("Novo prazo", prazo)),
        campo("Motivo", motivo, { dica: "Fica no histórico da demanda." }),
        erros.el,
        h(
          "div",
          { class: "spro-dialogo-rodape" },
          h("button", { type: "button", class: "spro-botao primario", onclick: gravar }, "Prorrogar"),
        ),
      );
    },
  });
}
