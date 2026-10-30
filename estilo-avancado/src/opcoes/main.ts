/**
 * Seção "Aparência" na página de opções (html/options.html), acima da lista de opções.
 * Só aparece onde o Estilo Avançado está no manifest (Lab MV3): a página é a mesma em
 * todos os pacotes. Grava em chrome.storage.sync; o content script de cada aba reage sozinho.
 */

import { CHAVE_TEMA } from "@comum/tema/config";
import { h } from "@comum/ui/dom";
import { gravarTema } from "./gravar";
import { CSS_APARENCIA, montarSecaoAparencia } from "./secao";

async function iniciar(): Promise<void> {
  const manifesto = chrome.runtime.getManifest();
  const temNovo = (manifesto.content_scripts ?? []).some((c) => c.js?.includes("js/init_estilo.js"));
  const alvo = document.getElementById("geral-conteudo");
  if (!temNovo || !alvo?.parentElement) return;

  const consulta = matchMedia("(prefers-color-scheme: dark)");
  const secao = await montarSecaoAparencia({
    ler: async () => (await chrome.storage.sync.get(CHAVE_TEMA))[CHAVE_TEMA],
    gravar: gravarTema,
    sistemaEscuro: () => consulta.matches,
  });
  document.head.append(h("style", {}, CSS_APARENCIA));
  alvo.parentElement.insertBefore(h("div", { class: "secoes" }, secao), alvo);
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void iniciar(), { once: true });
else void iniciar();
