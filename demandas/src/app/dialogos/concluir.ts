/**
 * Concluir: data (padrão hoje, nunca antes da distribuição), tempo gasto, observação e documento entregue (opcional). Com a
 * demanda ligada a uma etapa ainda aberta do Gestor de Projetos, oferece "Concluir também a etapa?" (desmarcado por padrão).
 */

import { h } from "@comum/ui/dom";
import { RE_DOCUMENTO } from "@projetos/modelo/vinculos";
import { LIMITES } from "../../modelo/constantes";
import type { DadosConclusao } from "../../modelo/operacoes";
import type { Demanda } from "../../modelo/tipos";
import { dataDeFormulario, dataLonga, lerTempo } from "../formato";
import type { ContextoDialogo } from "../tipos";
import { caixaDeErros, campo, linhaDeCampos } from "./campos";
import { perguntar } from "./janela";

/** O que o diálogo devolve: os dados da conclusão e, se marcou, o pedido para concluir também a etapa. */
export type RespostaConclusao = DadosConclusao & { concluirEtapa?: true };

export function abrirDialogoConclusao(c: ContextoDialogo, d: Demanda): Promise<RespostaConclusao | null> {
  return perguntar<RespostaConclusao>(c, {
    titulo: "Concluir demanda",
    icone: "check",
    montar(responder) {
      const erros = caixaDeErros();
      const data = h("input", { type: "date", class: "spro-campo", name: "data", value: c.hoje() });
      const tempo = h("input", {
        type: "text",
        class: "spro-campo",
        name: "tempo",
        placeholder: "1h30",
        value: "",
      });
      const observacao = h("textarea", { class: "spro-campo", name: "observacao", rows: "3", maxlength: String(LIMITES.observacao) });
      const documento = h("input", {
        type: "text",
        class: "spro-campo",
        name: "documento",
        inputmode: "numeric",
        placeholder: "Número SEI",
        maxlength: "30",
      });
      // "Concluir também a etapa?": só se a etapa ligada ainda está aberta no Projetos (a lista só traz as abertas).
      const marcaEtapa = h("input", { type: "checkbox", name: "concluirEtapa", id: "dem-concluir-etapa" });
      const linhaEtapa = h(
        "label",
        { class: "dem-opcao dem-concluir-etapa", for: "dem-concluir-etapa", hidden: true },
        marcaEtapa,
        h("span", {}, h("b", {}, "Concluir também a etapa?"), h("span", { class: "dem-concluir-etapa-nome" })),
      );
      const ligada = d.etapa;
      if (ligada)
        void c
          .etapasDoProjetos()
          .then((lista) => {
            // O nome e o escopo vêm do Projetos (agora), nunca do rótulo guardado na demanda (texto de um colega).
            const atual = lista.find((e) => e.projeto === ligada.projeto && e.etapa === ligada.etapa && !e.concluida);
            if (!atual) return;
            const nome = linhaEtapa.querySelector(".dem-concluir-etapa-nome");
            if (nome) nome.textContent = ` ${atual.rotulo} (${atual.vis === "unidade" ? "projeto de Toda a unidade" : "projeto Só eu"})`;
            linhaEtapa.hidden = false;
          })
          .catch(() => undefined);
      const gravar = () => {
        const m: string[] = [];
        const dia = dataDeFormulario(data.value);
        if (!dia) m.push("Informe uma data de conclusão válida.");
        else if (dia < d.distribuidaEm) m.push(`A conclusão não pode ser antes da distribuição (${dataLonga(d.distribuidaEm)}).`);
        const min = lerTempo(tempo.value);
        if (min === null) m.push("Tempo gasto inválido. Use 1h30, 1:30, 45min ou só os minutos.");
        else if (min !== undefined && min > LIMITES.tempoMin) m.push("Tempo gasto grande demais.");
        const numero = documento.value.trim();
        if (numero && !RE_DOCUMENTO.test(numero)) m.push("Número de documento inválido (só dígitos, até 20).");
        erros.mostrar(m);
        if (m.length || !dia) return;
        const r: RespostaConclusao = { data: dia };
        if (min !== undefined && min !== null) r.tempoGastoMin = min;
        if (observacao.value.trim()) r.observacao = observacao.value.trim();
        if (numero) r.documento = { numero };
        if (!linhaEtapa.hidden && marcaEtapa.checked) r.concluirEtapa = true;
        responder(r);
      };
      for (const i of [data, tempo, documento])
        i.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") {
            ev.preventDefault();
            gravar();
          }
        });
      return h(
        "div",
        { class: "dem-form dem-form-concluir" },
        h("p", { class: "dem-dialogo-titulo" }, d.titulo),
        linhaDeCampos(
          campo("Concluída em", data),
          campo("Tempo gasto", tempo, { opcional: "(opcional)", dica: "Ex.: 1h30, 1:30, 45min ou 90." }),
        ),
        campo("Observação", observacao, { opcional: "(opcional)" }),
        campo("Documento entregue", documento, { opcional: "(opcional)", dica: "Número SEI do documento." }),
        linhaEtapa,
        erros.el,
        h(
          "div",
          { class: "spro-dialogo-rodape" },
          h("button", { type: "button", class: "spro-botao primario", onclick: gravar }, "Concluir"),
        ),
      );
    },
  });
}
