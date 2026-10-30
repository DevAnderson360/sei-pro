import {
  ATRIBUTO_ADAPTADO,
  ATRIBUTO_ORIGINAL,
  alternarOriginal,
  iniciarRemapeamento,
  limparParaGravar,
  VAR_FUNDO,
  VAR_TEXTO,
} from "../src/pagina/documentos";
import { checar, instalarDom, secao, tique } from "./util";

const HTML = `<html><head></head><body>
<p>Sem cor propria</p>
<table><tr>
<td id="cinza" style="background-color:#ccc">Cinza</td>
<td id="vermelho" style="color: red">Vermelho</td>
<td id="amarelo" bgcolor="#ffff00"><font id="fonte" color="#0000ff">Azul no amarelo</font></td>
<td id="transp" style="background-color: transparent">Transparente</td>
</tr></table>
<img id="img" src="x.png" style="background-color:#fff">
</body></html>`;

/** O linkedom nao tem MutationObserver: um falso guarda o callback para o teste dispara-lo. */
let aoMudar: ((r: unknown[]) => void) | null = null;
class ObservadorFalso {
  constructor(cb: (r: unknown[]) => void) {
    aoMudar = cb;
  }
  observe(): void {}
  disconnect(): void {}
}

export async function verificarDocumentos(): Promise<void> {
  secao("remapeamento de documentos");
  (globalThis as { MutationObserver?: unknown }).MutationObserver = ObservadorFalso;
  const doc = instalarDom(HTML);
  const original = doc.documentElement.outerHTML;
  const parar = iniciarRemapeamento(doc, { botao: true });
  await tique(30);

  const el = (id: string) => doc.getElementById(id) as HTMLElement;
  checar("fundo cinza adaptado", el("cinza").getAttribute(ATRIBUTO_ADAPTADO) === "f" && !!el("cinza").style.getPropertyValue(VAR_FUNDO));
  checar(
    "texto vermelho adaptado",
    el("vermelho").getAttribute(ATRIBUTO_ADAPTADO) === "t" && !!el("vermelho").style.getPropertyValue(VAR_TEXTO),
  );
  checar("bgcolor amarelo adaptado", el("amarelo").getAttribute(ATRIBUTO_ADAPTADO) === "f");
  checar("<font color> adaptado", el("fonte").getAttribute(ATRIBUTO_ADAPTADO) === "t");
  checar("fundo transparente nao e marcado", !el("transp").hasAttribute(ATRIBUTO_ADAPTADO));
  checar("imagem intacta", !el("img").hasAttribute(ATRIBUTO_ADAPTADO) && el("img").getAttribute("style") === "background-color:#fff");
  checar(
    "a cor original do elemento nao foi sobrescrita",
    (el("cinza").style.getPropertyValue("background-color") || "").includes("#ccc") ||
      (el("cinza").getAttribute("style") ?? "").includes("#ccc"),
  );
  checar(
    "um unico estilo e um unico botao",
    doc.querySelectorAll("style[data-spro-tema-doc]").length === 1 && doc.querySelectorAll("[data-spro-ver-original]").length === 1,
  );

  iniciarRemapeamento(doc, { botao: true });
  await tique(10);
  checar(
    "ligar duas vezes nao duplica estilo nem botao",
    doc.querySelectorAll("style[data-spro-tema-doc]").length === 1 && doc.querySelectorAll("[data-spro-ver-original]").length === 1,
  );

  const novo = doc.createElement("span");
  novo.setAttribute("style", "color:#00ff00");
  doc.body.appendChild(novo);
  aoMudar?.([{ type: "childList", addedNodes: [novo], target: doc.body }]);
  await tique(30);
  checar("conteudo inserido depois tambem e adaptado", novo.getAttribute(ATRIBUTO_ADAPTADO) === "t");

  checar(
    "ver original liga e desliga",
    alternarOriginal(doc) === true &&
      doc.documentElement.hasAttribute(ATRIBUTO_ORIGINAL) &&
      alternarOriginal(doc) === false &&
      !doc.documentElement.hasAttribute(ATRIBUTO_ORIGINAL),
  );

  novo.remove();

  // Gravacao: a limpeza tira atributo e variaveis.
  const copia = doc.body.cloneNode(true) as HTMLElement;
  limparParaGravar(copia);
  checar("limparParaGravar remove atributos e variaveis", !/data-spro-adaptado|--spro-doc/.test(copia.outerHTML), copia.outerHTML);
  checar("limparParaGravar preserva a cor original", copia.outerHTML.includes("#ccc") && copia.outerHTML.includes("red"));

  parar();
  const depois = doc.documentElement.outerHTML.replace(/\s+/g, " ");
  checar("desligar: zero rastro no DOM", !/data-spro|--spro-doc/.test(depois), depois.slice(0, 400));
  checar("desligar: o documento volta exatamente ao HTML de antes", depois === original.replace(/\s+/g, " "), depois);

  // Lote: muitos elementos nao travam e sao todos processados.
  const grande = instalarDom("<html><head></head><body></body></html>");
  for (let i = 0; i < 1300; i++) {
    const p = grande.createElement("p");
    p.setAttribute("style", "color:#cc0000");
    grande.body.appendChild(p);
  }
  const parar2 = iniciarRemapeamento(grande);
  for (let i = 0; i < 100 && grande.querySelectorAll(`[${ATRIBUTO_ADAPTADO}]`).length < 1300; i++) await tique(30);
  checar(
    "1.300 elementos processados em lotes",
    grande.querySelectorAll(`[${ATRIBUTO_ADAPTADO}]`).length === 1300,
    grande.querySelectorAll(`[${ATRIBUTO_ADAPTADO}]`).length,
  );
  parar2();
  checar("1.300 elementos limpos ao desligar", grande.querySelectorAll(`[${ATRIBUTO_ADAPTADO}]`).length === 0);
}
