import { CHAVE_TEMA, type ConfigTema } from "@comum/tema/config";
import { h } from "@comum/ui/dom";
import { CSS_APARENCIA, montarCorpoAparencia } from "../opcoes/secao";

const ID_HOST = "spro-estilo2-modal";

/** Variáveis que o CSS da seção espera (as da página de opções), nos dois esquemas. */
const VARIAVEIS: Record<"claro" | "escuro", string> = {
  claro:
    "--linha:#e3e6eb;--tinta:#1f2328;--tinta-2:#5b6470;--superficie:#fff;--azul:#1f5fbf;--azul-claro:#e8f0fb;--sobre-azul:#fff;--fundo-modal:#fff;--sombra:0 24px 64px rgb(0 0 0/28%)",
  escuro:
    "--linha:#2f343a;--tinta:#e8eaed;--tinta-2:#9aa0a8;--superficie:#1a1d21;--azul:#5f9dff;--azul-claro:#1d2635;--sobre-azul:#0b1220;--fundo-modal:#141619;--sombra:0 24px 64px rgb(0 0 0/60%)",
};

const CSS_MODAL = `
:host{all:initial}
.fundo{position:fixed;inset:0;z-index:2147483600;display:grid;place-items:center;padding:16px;background:rgb(10 12 16/55%);font:14px/1.45 system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;color:var(--tinta);animation:entra .14s ease-out}
@keyframes entra{from{opacity:0}}
.caixa{width:min(680px,100%);max-height:calc(100vh - 32px);display:flex;flex-direction:column;border:1px solid var(--linha);border-radius:16px;background:var(--fundo-modal);box-shadow:var(--sombra);overflow:hidden}
.topo{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid var(--linha)}
.topo h2{margin:0;font-size:17px;font-weight:700}
.fechar{display:grid;place-items:center;width:36px;height:36px;border:0;border-radius:10px;background:transparent;color:var(--tinta-2);font-size:22px;line-height:1;cursor:pointer}
.fechar:hover{background:var(--azul-claro);color:var(--tinta)}
.corpo{overflow:auto}
.chave{position:relative;display:inline-block;width:44px;height:26px;cursor:pointer}
.chave input{position:absolute;inset:0;width:100%;height:100%;margin:0;opacity:0;cursor:pointer}
.trilho{position:absolute;inset:0;border-radius:999px;background:var(--linha);transition:background .15s}
.trilho::after{content:"";position:absolute;top:3px;left:3px;width:20px;height:20px;border-radius:50%;background:#fff;box-shadow:0 1px 3px rgb(0 0 0/30%);transition:transform .15s}
.chave input:checked+.trilho{background:var(--azul)}
.chave input:checked+.trilho::after{transform:translateX(18px)}
.chave input:focus-visible+.trilho{outline:2px solid var(--azul);outline-offset:2px}
.btn{min-height:38px;padding:0 14px;border:1px solid var(--linha);border-radius:10px;background:var(--superficie);color:var(--tinta);font:600 14px system-ui,sans-serif;cursor:pointer}
.btn:hover{border-color:var(--azul)}
.secao-corpo{display:block}
[data-inativo]{opacity:.5;pointer-events:none}
button:focus-visible{outline:2px solid var(--azul);outline-offset:2px}
`;

export interface DepsModal {
  ler: () => Promise<unknown>;
  gravar: (cfg: ConfigTema) => Promise<void>;
  sistemaEscuro: () => boolean;
}

/**
 * Modal "Aparência" aberto pelo botão de paleta da barra do SEI. Mesmo conteúdo da seção das opções
 * (a gravação vai para o mesmo chrome.storage.sync, então as duas telas ficam em sincronia).
 * Fica num Shadow DOM: nem o CSS do SEI nem o tema novo interferem nele. Devolve o fechador.
 */
export async function abrirModalAparencia(doc: Document, deps: DepsModal): Promise<() => void> {
  doc.getElementById(ID_HOST)?.remove();
  const escuro =
    doc.documentElement.getAttribute("data-spro-tema") === "escuro" ||
    (!doc.documentElement.hasAttribute("data-spro-tema") && deps.sistemaEscuro());
  const host = doc.createElement("div");
  host.id = ID_HOST;
  const raiz = host.attachShadow({ mode: "open" });
  const { conteudo, atualizar } = await montarCorpoAparencia(deps);

  const fechar = () => {
    doc.removeEventListener("keydown", aoTecla, true);
    chrome.storage.onChanged.removeListener(aoMudar);
    host.remove();
  };
  const aoTecla = (ev: KeyboardEvent) => {
    if (ev.key === "Escape") {
      ev.stopPropagation();
      fechar();
    }
  };
  // O que muda por fora (página de opções, outra aba) aparece aqui sem reabrir.
  const aoMudar = (m: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area === "sync" && m[CHAVE_TEMA]) atualizar(m[CHAVE_TEMA].newValue);
  };
  chrome.storage.onChanged.addListener(aoMudar);
  doc.addEventListener("keydown", aoTecla, true);

  const caixa = h(
    "div",
    { class: "caixa", role: "dialog", "aria-modal": "true", "aria-label": "Aparência do SEI" },
    h(
      "div",
      { class: "topo" },
      h("h2", {}, "Aparência do SEI"),
      h("button", { type: "button", class: "fechar", "aria-label": "Fechar", onclick: fechar }, "×"),
    ),
    h("div", { class: "corpo" }, conteudo),
  );
  const fundo = h("div", { class: "fundo" }, caixa);
  fundo.addEventListener("mousedown", (ev) => {
    if (ev.target === fundo) fechar();
  });
  raiz.append(h("style", {}, `:host{${VARIAVEIS[escuro ? "escuro" : "claro"]}}${CSS_MODAL}${CSS_APARENCIA}`), fundo);
  (doc.body ?? doc.documentElement).append(host);
  caixa.querySelector<HTMLElement>(".fechar")?.focus();
  return fechar;
}
