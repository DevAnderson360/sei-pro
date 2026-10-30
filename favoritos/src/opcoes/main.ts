/**
 * Seção do favoritos na página de opções (html/options.html), logo abaixo da
 * chave "Processos Favoritos". Só aparece onde o favoritos novo está no
 * manifest: a página de opções é a mesma em todos os pacotes.
 */

import { areaChrome } from "@comum/armazenamento/area";
import { h } from "@comum/ui/dom";
import { temPainelLateral } from "../modelo/exibicao";
import { encaixar } from "./encaixe";
import { montarOpcoesExibicao } from "./exibicao";

const CSS = `.spro-fav-opcoes-linha{border-top:1px solid var(--linha,#ddd);background:var(--papel,#f7f7f7);padding:6px 20px 14px 44px}
.spro-fav-opcoes{display:grid;gap:6px;font-size:13px}
.spro-fav-opcoes fieldset{border:0;margin:0;padding:0;display:grid;gap:3px}
.spro-fav-opcoes legend{padding:0;margin-bottom:2px;font-weight:600}
.spro-fav-opcoes label{display:flex;gap:6px;align-items:center;cursor:pointer}
.spro-fav-opcoes-nota{margin:2px 0 0;opacity:.7}`;

async function iniciar(): Promise<void> {
  const manifesto = chrome.runtime.getManifest();
  const temNovo = (manifesto.content_scripts ?? []).some((c) => c.js?.includes("js/init_favoritos.js"));
  const chave = document.getElementById("itemConfigGeral_gerenciarfavoritos") as HTMLInputElement | null;
  if (!temNovo || !chave) return;
  const el = await montarOpcoesExibicao({ sync: areaChrome(chrome.storage.sync, "sync"), lateralDisponivel: temPainelLateral(manifesto) });
  const nova = encaixar(chave, el);
  if (!nova) return;
  document.head.append(h("style", {}, CSS));
  // A seção só faz sentido com a funcionalidade ligada.
  const seguir = () => {
    nova.hidden = !chave.checked;
  };
  chave.addEventListener("change", seguir);
  // O options.js marca as chaves depois de ler as opções, sem disparar "change".
  setInterval(seguir, 1000);
  seguir();
}

if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => void iniciar(), { once: true });
else void iniciar();
