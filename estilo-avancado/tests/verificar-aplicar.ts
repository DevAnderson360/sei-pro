import { CONFIG_PADRAO } from "@comum/tema/config";
import { ATRIBUTO_ATIVO, ATRIBUTO_ESQUEMA, aplicarTema, removerTema } from "../src/pagina/aplicar";
import { gravarCache, lerCache } from "../src/pagina/cache";
import { checar, instalarDom, secao } from "./util";

const ligado = { ...CONFIG_PADRAO, ativo: true };

export function verificarAplicar(): void {
  secao("aplicar tema");
  const doc = instalarDom("<html><head></head><body><p>oi</p></body></html>");
  const antes = doc.documentElement.outerHTML;

  aplicarTema(doc, ligado, false, "/*base*/");
  checar("cria um unico <style>", doc.querySelectorAll("style[data-spro-tema-estilo]").length === 1);
  aplicarTema(doc, ligado, false, "/*base*/");
  aplicarTema(doc, { ...ligado, corBarra: "#0b6e99", paleta: "livre" }, false, "/*base*/");
  checar("reaplicar nao duplica", doc.querySelectorAll("style[data-spro-tema-estilo]").length === 1);
  checar("o estilo traz a folha base e a cor nova", (doc.querySelector("style")?.textContent ?? "").includes("/*base*/"));
  checar(
    "marca ativo e esquema claro",
    doc.documentElement.hasAttribute(ATRIBUTO_ATIVO) && doc.documentElement.getAttribute(ATRIBUTO_ESQUEMA) === "claro",
  );
  checar("color-scheme light", doc.documentElement.style.colorScheme === "light");

  aplicarTema(doc, ligado, true, "");
  checar("auto + sistema escuro -> escuro", doc.documentElement.getAttribute(ATRIBUTO_ESQUEMA) === "escuro");
  aplicarTema(doc, { ...ligado, modo: "claro" }, true, "");
  checar("modo claro ignora o sistema", doc.documentElement.getAttribute(ATRIBUTO_ESQUEMA) === "claro");

  aplicarTema(doc, { ...ligado, ativo: false }, false, "");
  checar("ativo:false remove o <style>", doc.querySelectorAll("style[data-spro-tema-estilo]").length === 0);
  checar("ativo:false: zero rastro no HTML", doc.documentElement.outerHTML === antes, doc.documentElement.outerHTML);
  removerTema(doc);
  checar("remover duas vezes e inofensivo", doc.documentElement.outerHTML === antes);

  secao("cache do tema");
  const mem = new Map<string, string>();
  const arm = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => void mem.set(k, v) };
  checar("sem cache -> null", lerCache(arm) === null);
  gravarCache(arm, ligado);
  checar("round-trip", lerCache(arm)?.ativo === true);
  mem.set("spro_tema_cache", "{lixo");
  checar("cache corrompido -> padrao desligado, sem lancar", lerCache(arm)?.ativo === false);
  const quebrado = {
    getItem: () => {
      throw new Error("bloqueado");
    },
    setItem: () => {
      throw new Error("bloqueado");
    },
  };
  checar("storage bloqueado nao lanca", lerCache(quebrado) === null);
  gravarCache(quebrado, ligado);
  checar("gravar com storage bloqueado nao lanca", true);
}
