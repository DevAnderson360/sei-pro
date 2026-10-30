/**
 * Diálogo "Importar do servidor do Atividades" (spec 3.2 e 6.3): a lista dos
 * projetos com caixas (nome, unidade, etapas, arquivado; os ativos já
 * marcados), o destino ("Toda a unidade" por padrão) e o resumo do que vem.
 * Reimportar não duplica: os já importados aparecem como "atualiza". O projeto
 * com mais etapas que o limite e o excluído aqui (que não volta) aparecem com a
 * caixa desligada e não entram no resumo. Os nomes vêm do servidor e entram
 * sempre como texto.
 *
 * O diálogo não toca o repositório: `importar` chega pronto de quem abre (em
 * "Toda a unidade", pelo repositório com o "Entendi"). Resolver fecha; rejeitar
 * mostra o erro e deixa aberto.
 */

import type { AbrirModal } from "@comum/ui/dialogo";
import { h } from "@comum/ui/dom";
import type { ItemImportavel, ResultadoImportacaoAtividades } from "../../importacao/atividades";
import { LIMITES, MAXIMO_PROJETOS_ATIVIDADES } from "../../modelo/constantes";
import { rotuloDaVis } from "../../modelo/escopo";
import type { Vis } from "../../modelo/tipos";
import { plural } from "../formato";
import { caixaDeErros, campo, mensagensDoErro } from "./campos";

export interface ContextoImportar {
  abrirModal: AbrirModal;
  sigla: string;
  itens: readonly ItemImportavel[];
  /** Ids legados que já estão aqui (reimportar atualiza): `legadosImportados`. */
  jaImportados: ReadonlySet<number>;
  /** Ids legados excluídos aqui, em qualquer escopo (não voltam): `legadosExcluidos`. */
  excluidos?: ReadonlySet<number>;
  /** Veio do guardado pelo painel legado (o servidor falhou): o motivo. */
  avisoCache?: string;
  /** Projetos além dos 1000 que ficaram de fora da lista (`ProjetosDoAtividades.cortados`). */
  cortados?: number;
  /** Resolve = fecha; rejeitar mostra o erro e deixa aberto. */
  importar(ids: number[], vis: Vis): Promise<unknown>;
}

function cartao(valor: Vis, marcado: boolean, titulo: string, explica: string): HTMLElement {
  return h(
    "label",
    { class: "prj-opcao" },
    h("input", { type: "radio", name: "destino-importar", value: valor, checked: marcado }),
    h("div", {}, h("b", {}, titulo), h("span", {}, ` ${explica}`)),
  );
}

export function abrirImportarAtividades(c: ContextoImportar): { fechar(): void } {
  let modal: { fechar(): void } | null = null;
  const erros = caixaDeErros();
  const resumo = h("p", { class: "prj-dica prj-importar-resumo", "aria-live": "polite" });
  const importar = h("button", { type: "button", class: "spro-botao primario" }, "Importar");
  const caixas = c.itens.map((it) => {
    const caixa = h("input", { type: "checkbox", value: String(it.id) });
    const excluido = !!c.excluidos?.has(it.id);
    // A propriedade (e não o atributo): é o que o navegador lê depois, e o que o usuário muda.
    caixa.checked = !it.arquivado && !it.grande && !excluido;
    caixa.disabled = !!it.grande || excluido;
    caixa.addEventListener("change", () => {
      erros.mostrar([]);
      pintarResumo();
    });
    const detalhe = [
      it.unidade,
      it.grande ? `mais de ${LIMITES.etapasPorProjeto} etapas: não cabe num projeto` : plural(it.etapas, "etapa", "etapas"),
      it.arquivado ? "arquivado" : "",
      excluido ? "excluído aqui: não volta" : c.jaImportados.has(it.id) ? "já importado: atualiza" : "",
    ]
      .filter(Boolean)
      .join(" · ");
    return {
      it,
      caixa,
      el: h("label", { class: "prj-importar-item" }, caixa, h("b", {}, it.nome), h("span", { class: "prj-dica" }, ` ${detalhe}`)),
    };
  });
  const escolhidos = () => caixas.filter((x) => x.caixa.checked && !x.caixa.disabled).map((x) => x.it);
  const pintarResumo = () => {
    const e = escolhidos();
    resumo.textContent = e.length
      ? `Vêm ${plural(e.length, "projeto", "projetos")} e ${plural(
          e.reduce((n, x) => n + x.etapas, 0),
          "etapa",
          "etapas",
        )}. As demandas viram itens do checklist.`
      : c.itens.length
        ? "Marque ao menos um projeto."
        : "";
    importar.disabled = !e.length;
  };
  const cartoes = h(
    "div",
    { class: "prj-opcoes", role: "radiogroup", "aria-label": "Importar para" },
    cartao("unidade", true, `Toda a unidade (${c.sigla})`, `Quem usa o SEI Pro na ${c.sigla} vê e edita.`),
    cartao("eu", false, "Só eu", "Aparece só para você, nesta unidade."),
  );
  const destino = (): Vis => (cartoes.querySelector<HTMLInputElement>("input[value='eu']")?.checked ? "eu" : "unidade");
  let ocupado = false;
  importar.addEventListener("click", async () => {
    if (ocupado || !escolhidos().length) return;
    ocupado = true;
    importar.disabled = true;
    erros.mostrar([]);
    try {
      await c.importar(
        escolhidos().map((x) => x.id),
        destino(),
      );
      modal?.fechar();
    } catch (e) {
      erros.mostrar(mensagensDoErro(e));
    } finally {
      ocupado = false;
      importar.disabled = !escolhidos().length;
    }
  });
  pintarResumo();
  const conteudo = h(
    "div",
    { class: "prj-form prj-form-importar" },
    c.avisoCache
      ? h(
          "p",
          { class: "prj-dica prj-importar-cache" },
          `Não foi possível buscar no servidor do Atividades (${c.avisoCache}). Mostrando a última lista guardada neste navegador.`,
        )
      : null,
    c.cortados
      ? h(
          "p",
          { class: "prj-dica prj-importar-cortados" },
          `Vieram ${MAXIMO_PROJETOS_ATIVIDADES + c.cortados} projetos; aparecem só os ${MAXIMO_PROJETOS_ATIVIDADES} primeiros (${plural(c.cortados, "ficou", "ficaram")} de fora).`,
        )
      : null,
    c.itens.length
      ? h(
          "div",
          { class: "prj-importar-lista", role: "group", "aria-label": "Projetos do servidor do Atividades" },
          ...caixas.map((x) => x.el),
        )
      : h("p", { class: "prj-dica" }, "O servidor não tem projetos para você."),
    campo("Importar para", cartoes, { dica: "Reimportar depois atualiza o que você não mexeu aqui; nada se duplica." }),
    resumo,
    erros.el,
    h(
      "div",
      { class: "spro-dialogo-rodape" },
      h("button", { type: "button", class: "spro-botao", onclick: () => modal?.fechar() }, "Cancelar"),
      importar,
    ),
  );
  modal = c.abrirModal({ titulo: "Importar do servidor do Atividades", icone: "subir", conteudo });
  return { fechar: () => modal?.fechar() };
}

/** Até 5 nomes entre aspas (cada um até 60 caracteres) e "e mais N". */
function nomes(lista: readonly string[]): string {
  const curtos = lista.slice(0, 5).map((n) => `“${n.length > 60 ? `${n.slice(0, 59)}…` : n}”`);
  const resto = lista.length - curtos.length;
  if (resto > 0) return `${curtos.join(", ")} e mais ${resto}`;
  return curtos.length > 1 ? `${curtos.slice(0, -1).join(", ")}, ${curtos.at(-1)}` : (curtos[0] ?? "");
}

/** O aviso depois de importar (`destino` = o que foi escolhido no diálogo). */
export function mensagemDaImportacao(r: ResultadoImportacaoAtividades, destino: Vis): string {
  const frases: string[] = [];
  if (r.novos && r.atualizados)
    frases.push(`${plural(r.novos, "projeto importado", "projetos importados")} e ${plural(r.atualizados, "atualizado", "atualizados")}.`);
  else if (r.novos) frases.push(`${plural(r.novos, "projeto importado", "projetos importados")}.`);
  else if (r.atualizados) frases.push(`${plural(r.atualizados, "projeto atualizado", "projetos atualizados")}.`);
  else if (r.iguais) frases.push("Nada mudou: os projetos escolhidos já estavam como no servidor.");
  if (r.noOutroEscopo) {
    const outro = rotuloDaVis(destino === "unidade" ? "eu" : "unidade");
    frases.push(
      r.noOutroEscopo === 1 ? `1 já estava em “${outro}” e ficou lá.` : `${r.noOutroEscopo} já estavam em “${outro}” e ficaram lá.`,
    );
  }
  if (r.excluidosAqui)
    frases.push(r.excluidosAqui === 1 ? "1 excluído aqui não voltou." : `${r.excluidosAqui} excluídos aqui não voltaram.`);
  if (r.foraPorProjetos.length)
    frases.push(
      `${r.foraPorProjetos.length === 1 ? "Ficou" : "Ficaram"} de fora pelo limite de ${LIMITES.projetosAtivos} projetos ativos: ${nomes(r.foraPorProjetos)} (arquive ou exclua algum e importe de novo).`,
    );
  if (r.foraPorEtapas.length)
    frases.push(
      `${r.foraPorEtapas.length === 1 ? "Ficou de fora por ter" : "Ficaram de fora por terem"} mais de ${LIMITES.etapasPorProjeto} etapas: ${nomes(r.foraPorEtapas)}.`,
    );
  if (r.invalidos)
    frases.push(
      r.invalidos === 1
        ? "Um projeto veio com dados que não dá para usar e ficou de fora."
        : `${r.invalidos} projetos vieram com dados que não dá para usar e ficaram de fora.`,
    );
  return frases.join(" ");
}
