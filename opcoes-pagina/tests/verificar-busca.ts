import { filtrar, normalizar } from "../src/busca";
import { montarComplementos, montarGeral } from "../src/render";
import { checar, instalarDom, secao } from "./util";

const CTX = { lab: true, foraAntaq: true, homepage: "https://seipro.app" };
const ocultas = (r: ParentNode) => r.querySelectorAll(".opcao[data-busca-oculta]").length;

export function verificarBusca(): void {
  secao("busca");
  checar("normaliza acento e caixa", normalizar("  Árvore PRESCRIÇÕES ") === "arvore prescricoes");
  instalarDom();
  const raiz = document.createElement("div");
  raiz.append(montarGeral(CTX), montarComplementos(CTX));
  const secoes = [...raiz.querySelectorAll<HTMLElement>("details.secao")];
  const abertasAntes = secoes.map((s) => s.hasAttribute("open"));

  const n = filtrar(raiz, "prazos");
  checar(
    "acha 'Controlar Prazos'",
    n >= 1 && !(raiz.querySelector('[data-opcao="gerenciarprazos"]') as Element).hasAttribute("data-busca-oculta"),
  );
  checar("esconde o que nao casa", ocultas(raiz) > 50);
  checar(
    "abre a secao com resultado e esconde as sem",
    secoes[0].hasAttribute("open") && secoes[1].hasAttribute("data-busca-oculta") && secoes[2].hasAttribute("data-busca-oculta"),
  );
  checar("sem acento acha 'Árvore'", filtrar(raiz, "arvore") > 3);
  checar("termo sem resultado devolve 0", filtrar(raiz, "zzzzzz") === 0);
  checar(
    "limpar volta tudo e restaura as secoes abertas",
    filtrar(raiz, "") > 60 &&
      ocultas(raiz) === 0 &&
      secoes.map((s) => s.hasAttribute("open")).join() === abertasAntes.join() &&
      secoes.every((s) => !s.hasAttribute("data-busca-oculta")),
  );
}
