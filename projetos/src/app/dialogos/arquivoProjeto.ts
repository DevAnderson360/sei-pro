/**
 * "Enviar projeto por arquivo…" (escolher o projeto, quando o painel está no Todos) e "Receber projeto de
 * arquivo…" (prévia + "Receber em"), do menu ajustes. Com um projeto aberto, enviar baixa direto (sem diálogo).
 *
 * O diálogo não toca o repositório: `enviar` e `receber` chegam prontos de quem abre (o "Receber" em "Toda a
 * unidade" passa pelo "Entendi", no repositório com o consentimento). Os dois seguem a mesma regra: resolver
 * fecha; rejeitar mostra o erro e deixa aberto (no enviar, a memória do sigilo ilegível não gera arquivo e a
 * mensagem aparece aqui). O nome do projeto vem do arquivo de outra pessoa e entra sempre como texto.
 */

import { criarCombo } from "@comum/ui/combobox";
import type { AbrirModal } from "@comum/ui/dialogo";
import { h } from "@comum/ui/dom";
import type { PreviaRecebido } from "../../arquivo/projetoArquivo";
import type { Vis } from "../../modelo/tipos";
import type { ProjetoNaTela } from "../dados";
import { mensagemDoErro } from "../erros";
import { dataLonga, plural } from "../formato";
import { caixaDeErros, campo, mensagensDoErro } from "./campos";

const NOTA_ENVIO = "O arquivo leva as fases e as etapas, sem o histórico e sem o número de processo sigiloso.";

/** Liga o botão principal a uma ação assíncrona: um clique por vez (desligado enquanto espera); o erro vai para `erro`. */
function acaoDoBotao(botao: HTMLButtonElement, fazer: () => Promise<void>, erro: (e: unknown) => void): void {
  let ocupado = false;
  botao.addEventListener("click", async () => {
    if (ocupado) return;
    ocupado = true;
    botao.disabled = true;
    try {
      await fazer();
    } catch (e) {
      erro(e);
    } finally {
      ocupado = false;
      botao.disabled = false;
    }
  });
}

export function abrirEnviarProjeto(c: {
  abrirModal: AbrirModal;
  projetos: readonly ProjetoNaTela[];
  /** Gera e baixa o arquivo do projeto escolhido. */
  enviar(p: ProjetoNaTela): unknown;
}): { fechar(): void } {
  let modal: { fechar(): void } | null = null;
  const erros = caixaDeErros();
  const escolha = criarCombo({
    rotulo: "Projeto",
    opcoes: () =>
      c.projetos.map((p) => ({ valor: p.projeto.id, rotulo: p.projeto.nome, descricao: plural(p.etapas.length, "etapa", "etapas") })),
    valor: c.projetos[0] ? [c.projetos[0].projeto.id] : [],
    vazio: "Escolher um projeto…",
    busca: c.projetos.length > 7,
    aoMudar: () => erros.mostrar([]),
  });
  const baixar = h("button", { type: "button", class: "spro-botao primario" }, "Baixar arquivo");
  acaoDoBotao(
    baixar,
    async () => {
      const p = c.projetos.find((x) => x.projeto.id === escolha.valor()[0]);
      if (!p) return;
      await c.enviar(p);
      modal?.fechar();
    },
    // A mensagem como veio (a da memória do sigilo, a da cota, a do repositório): nada foi baixado.
    (e) => erros.mostrar([mensagemDoErro(e)]),
  );
  const conteudo = h(
    "div",
    { class: "prj-form prj-form-enviar" },
    campo("Projeto", escolha.el, { dica: NOTA_ENVIO }),
    erros.el,
    h(
      "div",
      { class: "spro-dialogo-rodape" },
      h("button", { type: "button", class: "spro-botao", onclick: () => modal?.fechar() }, "Cancelar"),
      baixar,
    ),
  );
  modal = c.abrirModal({ titulo: "Enviar projeto por arquivo", icone: "baixar", conteudo });
  return { fechar: () => modal?.fechar() };
}

function cartao(valor: Vis, marcado: boolean, titulo: string, explica: string): HTMLElement {
  return h(
    "label",
    { class: "prj-opcao" },
    h("input", { type: "radio", name: "destino-recebido", value: valor, checked: marcado }),
    h("div", {}, h("b", {}, titulo), h("span", {}, ` ${explica}`)),
  );
}

/** Prévia do arquivo e o destino; `receber` resolve = fecha; rejeitar = mostra o erro e fica. */
export function abrirReceberProjeto(c: {
  abrirModal: AbrirModal;
  sigla: string;
  previa: PreviaRecebido;
  receber(vis: Vis): Promise<unknown>;
}): { fechar(): void } {
  let modal: { fechar(): void } | null = null;
  const erros = caixaDeErros();
  const p = c.previa;
  const periodo = p.inicio && p.fim ? ` · de ${dataLonga(p.inicio)} a ${dataLonga(p.fim)}` : "";
  // "5 etapas em 2 fases"; sem fases, só "5 etapas".
  const emFases = p.fases ? ` em ${plural(p.fases, "fase", "fases")}` : "";
  const cartoes = h(
    "div",
    { class: "prj-opcoes", role: "radiogroup", "aria-label": "Receber em" },
    cartao("unidade", true, `Toda a unidade (${c.sigla})`, `Quem usa o SEI Pro na ${c.sigla} vê e edita.`),
    cartao("eu", false, "Só eu", "Aparece só para você, nesta unidade."),
  );
  const destino = (): Vis => (cartoes.querySelector<HTMLInputElement>("input[value='eu']")?.checked ? "eu" : "unidade");
  const receber = h("button", { type: "button", class: "spro-botao primario" }, "Receber projeto");
  acaoDoBotao(
    receber,
    async () => {
      await c.receber(destino());
      modal?.fechar();
    },
    (e) => erros.mostrar(mensagensDoErro(e)),
  );
  const conteudo = h(
    "div",
    { class: "prj-form prj-form-receber" },
    h("div", { class: "prj-previa" }, h("b", {}, p.nome), h("span", {}, ` ${plural(p.etapas, "etapa", "etapas")}${emFases}${periodo}`)),
    campo("Receber em", cartoes, { dica: "Vira um projeto novo (uma cópia): não junta com o original de quem enviou." }),
    erros.el,
    h(
      "div",
      { class: "spro-dialogo-rodape" },
      h("button", { type: "button", class: "spro-botao", onclick: () => modal?.fechar() }, "Cancelar"),
      receber,
    ),
  );
  modal = c.abrirModal({ titulo: "Receber projeto de arquivo", icone: "subir", conteudo });
  return { fechar: () => modal?.fechar() };
}
