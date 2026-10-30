import { checar, disparar, escolher, instalarDom as instalarDomBase, resumo, secao, tique } from "../../sei-comum/tests/util";

export { checar, disparar, escolher, resumo, secao, tique };

type Proto = object;
interface Janela {
  HTMLInputElement: { prototype: Proto };
  HTMLSelectElement: { prototype: Proto };
  HTMLOptionElement: { prototype: Proto };
}

/**
 * O linkedom nao emula `input.checked` nem `option.selected` como atributo, nem o valor padrao do <select> (a primeira
 * <option> quando nenhuma esta marcada). O codigo da pagina usa as duas coisas como
 * qualquer navegador; aqui o ambiente de teste passa a se comportar como um.
 */
function emularNavegador(doc: Document): void {
  const janela = doc.defaultView as unknown as Janela;
  Object.defineProperty(janela.HTMLInputElement.prototype, "checked", {
    configurable: true,
    get(this: Element) {
      return this.hasAttribute("checked");
    },
    set(this: Element, v: boolean) {
      if (v) this.setAttribute("checked", "");
      else this.removeAttribute("checked");
    },
  });
  Object.defineProperty(janela.HTMLOptionElement.prototype, "selected", {
    configurable: true,
    get(this: Element) {
      return this.hasAttribute("selected");
    },
    set(this: Element, v: boolean) {
      if (v) this.setAttribute("selected", "");
      else this.removeAttribute("selected");
    },
  });
  Object.defineProperty(janela.HTMLSelectElement.prototype, "value", {
    configurable: true,
    get(this: Element) {
      const opcoes = [...this.querySelectorAll("option")];
      const escolhida = opcoes.find((o) => o.hasAttribute("selected")) ?? opcoes[0];
      return escolhida ? (escolhida.getAttribute("value") ?? escolhida.textContent ?? "") : "";
    },
  });
}

/** `document` global do linkedom, comportando-se como um navegador nos controles de formulario. */
export function instalarDom(html = "<html><body></body></html>"): Document {
  const doc = instalarDomBase(html);
  emularNavegador(doc);
  return doc;
}
