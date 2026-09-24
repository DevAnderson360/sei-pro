/**
 * O construtor de DOM do painel (`h`).
 *
 * Existe por um defeito real: `<textarea>` NÃO tem atributo `value` — o valor
 * inicial é o conteúdo do elemento. Como o `h` guardava tudo com
 * `setAttribute`, toda caixa de texto do Estúdio de Fluxo abria VAZIA, como se
 * o mapeamento tivesse sumido, inclusive a proposta que o usuário precisa
 * revisar antes de salvar.
 */

import { DOMParser } from "linkedom";
import { copiarTexto, h, markdownParaTexto } from "../src/painel/dom";
import { checar, secao } from "./util";

// `h` usa o `document` global; nos testes ele vem do linkedom.
const doc = new DOMParser().parseFromString("<html><body></body></html>", "text/html") as unknown as Document;
(globalThis as { document?: Document }).document = doc;

export async function verificarDom(): Promise<void> {
  secao("dom: h");
  checar("textarea mostra o valor guardado", h("textarea", { value: "Nota Técnica\nNT" }).value === "Nota Técnica\nNT", h("textarea", { value: "x" }).value);
  checar("textarea sem valor fica vazio", h("textarea", {}).value === "");
  checar("input continua funcionando", h("input", { type: "text", value: "abc" }).value === "abc");
  checar("classe vai para className", h("div", { class: "a b" }).className === "a b");
  checar("atributo booleano entra vazio", h("button", { disabled: true }).getAttribute("disabled") === "");
  checar("atributo false nao entra", h("button", { disabled: false }).hasAttribute("disabled") === false);
  checar("texto entra como no de texto", h("p", {}, "oi").textContent === "oi");

  secao("dom: texto para copiar");
  const convertido = markdownParaTexto("# T\u00EDtulo\n\nTexto com **negrito**, *it\u00E1lico* e `c\u00F3digo`.\n\n- um\n- dois\n\n1. primeiro\n2. segundo\n\n| Nome | Prazo |\n| --- | --- |\n| Ato | 10 dias |");
  checar("remove marcacao em linha", convertido.includes("Texto com negrito, it\u00E1lico e c\u00F3digo."), convertido);
  checar("preserva blocos e listas", convertido.includes("T\u00EDtulo\n\nTexto") && convertido.includes("\u2022 um\n\u2022 dois") && convertido.includes("1. primeiro\n2. segundo"), convertido);
  checar("tabela vira texto tabulado", convertido.includes("Nome\tPrazo\nAto\t10 dias") && !convertido.includes("---"), convertido);

  secao("dom: copiar texto");
  let copiado = "";
  await copiarTexto("resposta", { clipboard: { writeText: async (texto) => void (copiado = texto) }, fallback: () => false });
  checar("usa clipboard quando disponivel", copiado === "resposta", copiado);
  let alternativa = "";
  await copiarTexto("alternativa", { clipboard: { writeText: async () => { throw new Error("negado"); } }, fallback: (texto) => Boolean((alternativa = texto)) });
  checar("usa fallback quando clipboard falha", alternativa === "alternativa", alternativa);
  let falhou = false;
  await copiarTexto("x", { clipboard: null, fallback: () => false }).catch(() => (falhou = true));
  checar("informa falha quando nenhum metodo copia", falhou);
}
