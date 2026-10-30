import { ATRIBUTO_ALTURA, ampliarAreas, FATOR_RESPIRO, restaurarAreas } from "../src/pagina/respiro";
import { checar, instalarDom, secao } from "./util";

export function verificarRespiro(): void {
  secao("respiro dos formularios");
  const html = `<html><body>
<div id="a" class="infraAreaDados" style="height:15em;"><label id="l1">x</label><input id="i1"><label>y</label><select></select></div>
<div id="b" class="infraAreaDados" style="height:10em;"><label>sem absoluto</label><input></div>
<div id="c" class="infraAreaDados"><label id="l3">sem height inline</label></div>
<div id="d" class="infraAreaDados" style="height:5em; color:red;"><label id="l4">z</label></div>
</body></html>`;
  const doc = instalarDom(html);
  const g = (id: string) => doc.getElementById(id) as HTMLElement;
  const absoluto = (el: Element) => ["l1", "l4"].includes(el.id);
  const altura = (el: Element) => (el.id === "a" ? 180 : 80);

  const n = ampliarAreas(doc, absoluto, altura);
  checar("amplia so as areas com linhas absolutas e altura inline", n === 2, n);
  checar("altura nova = original x fator", g("a").style.height === `${Math.round(180 * FATOR_RESPIRO)}px`, g("a").style.height);
  checar(
    "area sem filhos absolutos fica intacta",
    g("b").getAttribute("style") === "height:10em;" && !g("b").hasAttribute(ATRIBUTO_ALTURA),
  );
  checar("area sem height inline fica intacta", !g("c").hasAttribute("style"));
  checar("guarda a altura original", g("a").getAttribute(ATRIBUTO_ALTURA) === "15em");
  checar(
    "rodar de novo nao amplia duas vezes",
    ampliarAreas(doc, absoluto, altura) === 0 && g("a").style.height === `${Math.round(180 * FATOR_RESPIRO)}px`,
  );

  restaurarAreas(doc);
  checar("restaurar devolve a altura original e tira o atributo", g("a").style.height === "15em" && !g("a").hasAttribute(ATRIBUTO_ALTURA));
  checar(
    "restaurar preserva os outros estilos da area",
    g("d").getAttribute("style")?.includes("color") === true && !g("d").hasAttribute(ATRIBUTO_ALTURA),
  );
}
