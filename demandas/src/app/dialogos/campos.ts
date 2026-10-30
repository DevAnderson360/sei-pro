/**
 * Peças dos formulários: campo com rótulo, linha de campos, seção recolhida com resumo à direita, caixa de erros e
 * o campo de processo SEI. Mesmo desenho do Projetos (prefixo `dem-`); o campo de processo é o dele (sem classe própria).
 */

import { h, icone } from "@comum/ui/dom";
import { ErroOperacao } from "../../modelo/operacoes";
import { ErroValidacao } from "../../modelo/validacao";
import { mensagemDoErro } from "../erros";

export { type CampoProcesso, campoProcesso, ERRO_PROTOCOLO, protocoloValido } from "@projetos/app/dialogos/campos";

type Filho = Node | string | null | undefined | false;

export function campo(rotulo: string, controle: Node, o: { opcional?: string; dica?: string; classe?: string } = {}): HTMLElement {
  return h(
    "div",
    { class: `dem-campo${o.classe ? ` ${o.classe}` : ""}` },
    h("span", { class: "dem-rotulo" }, rotulo, o.opcional ? h("span", { class: "dem-opcional" }, ` ${o.opcional}`) : null),
    controle,
    o.dica ? h("div", { class: "dem-dica" }, o.dica) : null,
  );
}

export function linhaDeCampos(...filhos: Filho[]): HTMLElement {
  return h("div", { class: "dem-linha" }, ...filhos);
}

export interface Secao {
  el: HTMLElement;
  /** Recalcula o resumo à direita. */
  resumir(): void;
  abrir(): void;
}

/** Seção recolhida: botão com ícone, título e resumo; o conteúdo aparece ao abrir. */
export function secao(id: string, ic: Element, titulo: string, resumo: () => string, conteudo: HTMLElement, aberta = false): Secao {
  const res = h("span", { class: "dem-sec-res" });
  const botao = h(
    "button",
    { type: "button", "aria-expanded": String(aberta) },
    h("span", { class: "dem-sec-seta" }, icone("chevron", 14)),
    ic,
    h("span", { class: "dem-sec-tit" }, titulo),
    res,
  );
  const el = h(
    "div",
    { class: `dem-sec${aberta ? " dem-sec-aberta" : ""}`, "data-secao": id },
    botao,
    h("div", { class: "dem-sec-conteudo" }, conteudo),
  );
  const alternar = (abrir: boolean) => {
    el.classList.toggle("dem-sec-aberta", abrir);
    botao.setAttribute("aria-expanded", String(abrir));
  };
  botao.addEventListener("click", () => alternar(!el.classList.contains("dem-sec-aberta")));
  const resumir = () => {
    res.textContent = resumo();
  };
  resumir();
  return { el, resumir, abrir: () => alternar(true) };
}

export function caixaDeErros(): { el: HTMLElement; mostrar(m: readonly string[]): void } {
  const el = h("div", { class: "dem-erros", role: "alert", hidden: true });
  return {
    el,
    mostrar(m) {
      el.replaceChildren(...m.map((t) => h("div", {}, t)));
      el.hidden = !m.length;
    },
  };
}

/** Mensagens de um erro do repositório (ErroValidacao), de uma transição (ErroOperacao), da cota ou de qualquer outro. */
export function mensagensDoErro(e: unknown): string[] {
  if (e instanceof ErroValidacao || e instanceof ErroOperacao) return [e.message];
  return [mensagemDoErro(e)];
}
