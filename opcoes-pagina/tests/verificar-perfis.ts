import { adicionarPerfil, coletarPerfis, ligarLista, montarPerfil, restaurarPerfis } from "../src/perfis";
import { checar, disparar, instalarDom, secao } from "./util";

const campo = (p: Element, n: string) => p.querySelector(`[data-campo="${n}"]`) as HTMLInputElement;
const preencher = (p: Element, n: string, v: string) => {
  campo(p, n).value = v;
};
const lista = () => {
  instalarDom();
  const l = document.createElement("div");
  document.body.append(l);
  ligarLista(l);
  return l;
};
const perfis = (l: Element) => [...l.querySelectorAll(".perfil")];
const acao = (p: Element, a: string) => p.querySelector(`[data-acao="${a}"]`) as Element;

export function verificarPerfis(): void {
  secao("perfis: formulario virgem");
  let l = lista();
  restaurarPerfis(l, []);
  checar("sem nada gravado ha um formulario em branco", perfis(l).length === 1);
  checar(
    "formulario virgem nao vira base e nao conta como descartado",
    (() => {
      const r = coletarPerfis(l);
      return r.perfis.length === 0 && r.descartados === 0;
    })(),
  );

  secao("perfis: coletar e restaurar");
  const gravado = {
    baseName: "Atividades",
    baseTipo: "openai",
    conexaoTipo: "api",
    CLIENT_ID: "c",
    API_KEY: "k",
    spreadsheetId: "s",
    URL_API: "https://x/api",
    KEY_USER: "abc",
  };
  restaurarPerfis(l, [gravado, { ...gravado, baseName: "Outra", baseTipo: "gemini" }]);
  checar("um formulario por base", perfis(l).length === 2);
  checar(
    "preenche os campos",
    campo(perfis(l)[0], "baseName").value === "Atividades" && campo(perfis(l)[1], "baseTipo").value === "gemini",
  );
  const r = coletarPerfis(l);
  checar(
    "round-trip identico, com as 8 chaves na ordem do legado",
    JSON.stringify(r.perfis[0]) === JSON.stringify(gravado) && r.perfis.length === 2 && r.descartados === 0,
  );
  restaurarPerfis(l, [{ baseName: "So", baseTipo: "atividades", conexaoTipo: "api", URL_API: "", KEY_USER: "" }]);
  checar(
    "campos legados ausentes saem como string vazia",
    JSON.stringify(Object.keys(coletarPerfis(l).perfis[0])) ===
      JSON.stringify(["baseName", "baseTipo", "conexaoTipo", "CLIENT_ID", "API_KEY", "spreadsheetId", "URL_API", "KEY_USER"]) &&
      coletarPerfis(l).perfis[0].CLIENT_ID === "",
  );

  secao("perfis: obrigatorios");
  l = lista();
  restaurarPerfis(l, []);
  adicionarPerfil(l);
  preencher(perfis(l)[0], "baseName", "Boa");
  preencher(perfis(l)[1], "URL_API", "https://x");
  const c = coletarPerfis(l);
  checar(
    "base valida entra; a sem nome e descartada e contada",
    c.perfis.length === 1 && c.perfis[0].baseName === "Boa" && c.descartados === 1,
  );
  checar("campo obrigatorio vazio fica marcado", campo(perfis(l)[1], "baseName").classList.contains("campo-invalido"));
  preencher(perfis(l)[1], "baseName", "Agora");
  coletarPerfis(l);
  checar("marca some quando corrigido", !campo(perfis(l)[1], "baseName").classList.contains("campo-invalido"));

  secao("perfis: acoes");
  l = lista();
  restaurarPerfis(l, [
    { ...gravado, baseName: "A" },
    { ...gravado, baseName: "B" },
    { ...gravado, baseName: "C" },
  ]);
  const nomes = () =>
    perfis(l)
      .map((p) => campo(p, "baseName").value)
      .join();
  disparar(acao(perfis(l)[2], "subir"), "click");
  checar("subir", nomes() === "A,C,B");
  disparar(acao(perfis(l)[0], "descer"), "click");
  checar("descer", nomes() === "C,A,B");
  disparar(acao(perfis(l)[0], "subir"), "click");
  checar("subir o primeiro nao faz nada", nomes() === "C,A,B");
  disparar(acao(perfis(l)[1], "remover"), "click");
  checar("remover", nomes() === "C,B");
  disparar(acao(perfis(l)[0], "remover"), "click");
  disparar(acao(perfis(l)[0], "remover"), "click");
  checar(
    "remover a ultima limpa o formulario em vez de apagar tudo",
    perfis(l).length === 1 && campo(perfis(l)[0], "baseName").value === "" && coletarPerfis(l).perfis.length === 0,
  );
  const senha = campo(perfis(l)[0], "KEY_USER");
  checar("chave de acesso comeca oculta", senha.getAttribute("type") === "password");
  disparar(acao(perfis(l)[0], "revelar"), "click");
  checar("revelar troca para texto", campo(perfis(l)[0], "KEY_USER").getAttribute("type") === "text");
  disparar(acao(perfis(l)[0], "revelar"), "click");
  checar("oculta de novo", campo(perfis(l)[0], "KEY_USER").getAttribute("type") === "password");
  checar(
    "ids dos campos nao se repetem entre bases",
    (() => {
      adicionarPerfil(l);
      const ids = [...l.querySelectorAll("[id]")].map((e) => e.id);
      return new Set(ids).size === ids.length;
    })(),
  );
  checar("montarPerfil sem valores", montarPerfil().classList.contains("perfil"));
}
