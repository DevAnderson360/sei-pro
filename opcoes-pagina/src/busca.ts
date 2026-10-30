/** Busca por rotulo: sem acento, sem caixa. Abre as secoes com resultado e esconde as sem. */
export const normalizar = (s: string): string => s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().trim();

const OCULTA = "data-busca-oculta";

/** Devolve quantas linhas casam. Termo vazio desfaz tudo e restaura as secoes como estavam. */
export function filtrar(raiz: ParentNode, termo: string): number {
  const alvo = normalizar(termo);
  const linhas = [...raiz.querySelectorAll<HTMLElement>(".opcao")];
  const secoes = [...raiz.querySelectorAll<HTMLElement>("details.secao")];
  if (alvo === "") {
    for (const l of linhas) l.removeAttribute(OCULTA);
    for (const s of secoes) {
      s.removeAttribute(OCULTA);
      const antes = s.getAttribute("data-aberta-antes");
      if (antes !== null) {
        if (antes === "1") s.setAttribute("open", "");
        else s.removeAttribute("open");
        s.removeAttribute("data-aberta-antes");
      }
    }
    return linhas.filter((l) => !l.hasAttribute("hidden")).length;
  }
  let achadas = 0;
  for (const l of linhas) {
    const casa = !l.hasAttribute("hidden") && normalizar(l.querySelector(".rotulo")?.textContent ?? "").includes(alvo);
    if (casa) {
      l.removeAttribute(OCULTA);
      achadas += 1;
    } else l.setAttribute(OCULTA, "");
  }
  for (const s of secoes) {
    if (s.getAttribute("data-aberta-antes") === null) s.setAttribute("data-aberta-antes", s.hasAttribute("open") ? "1" : "0");
    const tem = s.querySelector(`.opcao:not([${OCULTA}])`) !== null;
    if (tem) {
      s.removeAttribute(OCULTA);
      s.setAttribute("open", "");
    } else s.setAttribute(OCULTA, "");
  }
  return achadas;
}
