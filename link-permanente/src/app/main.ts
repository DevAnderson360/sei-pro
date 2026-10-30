/**
 * Entrada de html/link-permanente.html. Liga o app ao navegador: <dialog>,
 * download, área de transferência e a ponte com a aba do SEI.
 *
 * Só o modo modal (`#modo=modal&tema=claro|escuro`), como o do Histórico
 * (historico/src/app/main.ts): iframe transparente sobre a tela do SEI, ligado
 * à PRÓPRIA aba (pagina/main.ts), com o app num <dialog> com véu.
 */

import { areaChrome } from "@comum/armazenamento/area";
import { esperarConexaoDaAba } from "@comum/ponte/conexaoDaAba";
import type { Rpc } from "@comum/ponte/rpc";
import { acompanharTemaDoPainel, aplicarTemaDoContexto } from "@comum/tema/painel";
import { baixar, criarAbrirModal } from "@comum/ui/dialogo";
import { h } from "@comum/ui/dom";
import { CANAL_LINK_PERMANENTE } from "../modelo/constantes";
import { AppLinkPermanente } from "./app";
import { lerEntradaPendente } from "./entrada";
import type { ContextoApp } from "./estado";

const parametros = new URLSearchParams(location.hash.slice(1));
document.documentElement.dataset.modo = "modal";
// O tema do SEI já vem no endereço. Sem ele, até o contexto chegar valeria o do sistema, e com
// esquema de cores diferente do iframe o Chrome pinta o fundo opaco sobre a tela do SEI.
const temaDoEndereco = parametros.get("tema");
if (temaDoEndereco === "claro" || temaDoEndereco === "escuro") document.documentElement.dataset.tema = temaDoEndereco;
const raiz = document.getElementById("app")!;

// O ouvinte da porta é registrado já, antes do `load` do iframe, que é quando o content script conecta.
const conexao = esperarConexaoDaAba(CANAL_LINK_PERMANENTE);

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Diálogos do app: <dialog> modais irmãos do modal, e o mais novo fica por cima (top layer). */
const abrirModal = criarAbrirModal();

void iniciarModal();

async function iniciarModal(): Promise<void> {
  const dlg = h("dialog", { class: "spro-dialogo lp-modal", "aria-label": "Pesquisar Link Permanente" });
  // O CSS do modal mira `dialog.lp-modal #app`.
  dlg.append(raiz);
  document.body.append(dlg);
  let rpc: Rpc | null = null;
  let app: AppLinkPermanente | null = null;
  // Fechar o diálogo (X, Esc, véu) pede à aba que tire o iframe. O pedido vai PRIMEIRO:
  // sem ele, a tela do SEI fica presa sob o iframe transparente até o F5.
  dlg.addEventListener("close", () => {
    void rpc?.chamar("fechar", undefined, 3000).catch(() => undefined);
    try {
      app?.destruir();
    } catch (e) {
      console.warn("[SEI Pro] link permanente: falha ao desmontar o app", e);
    }
  });
  // Véu: o clique cai no próprio <dialog>, fora do retângulo dele. Começo e fim no véu,
  // para uma seleção de texto que termina fora não fechar a janela.
  const noVeu = (ev: MouseEvent) => {
    if (ev.target !== dlg) return false;
    const r = dlg.getBoundingClientRect();
    return ev.clientX < r.left || ev.clientX > r.right || ev.clientY < r.top || ev.clientY > r.bottom;
  };
  let comecouNoVeu = false;
  dlg.addEventListener("pointerdown", (ev) => {
    comecouNoVeu = noVeu(ev);
  });
  dlg.addEventListener("click", (ev) => {
    if (comecouNoVeu && noVeu(ev)) dlg.close();
    comecouNoVeu = false;
  });
  const mostrar = () => {
    if (!dlg.open) dlg.showModal();
  };
  try {
    rpc = await conexao;
    const ctx = await rpc.chamar<ContextoApp>("contexto");
    // Segue o SEI (modo noturno do SEI Pro e cor da barra), como o Histórico.
    const html = document.documentElement;
    aplicarTemaDoContexto(html, ctx);
    const rpcAba = rpc;
    acompanharTemaDoPainel(document, {
      aoDesligar: async () => aplicarTemaDoContexto(html, await rpcAba.chamar<ContextoApp>("contexto")),
    });
    // Criada aqui, dentro do try e depois da conexão, e não no topo do módulo: sem `chrome.storage` (contexto
    // invalidado, permissão) o erro cai no catch, que abre o diálogo com a mensagem e o pedido de fechar à aba.
    const areaLocal = areaChrome(chrome.storage.local, "local");
    app = new AppLinkPermanente(raiz, {
      rpc,
      ctx,
      abrirModal,
      baixar,
      clip: navigator.clipboard,
      ItemClip: typeof ClipboardItem === "function" ? ClipboardItem : undefined,
      fechar: () => dlg.close(),
      // A entrada deixada pelo Processos em Lote (chrome.storage.local), consumida uma vez.
      lerEntradaPendente: () => lerEntradaPendente(areaLocal),
    });
    mostrar();
    await app.iniciar();
  } catch (e) {
    app?.destruir();
    app = null;
    // Mesmo com erro o diálogo abre: é por ele que o usuário fecha o iframe que cobre a tela.
    raiz.replaceChildren(
      h("p", { class: "spro-lista-erro" }, `Não foi possível abrir a pesquisa de link permanente: ${mensagem(e)}`),
      h(
        "div",
        { class: "spro-dialogo-rodape" },
        h("button", { type: "button", class: "spro-botao", onclick: () => dlg.close() }, "Fechar"),
      ),
    );
    mostrar();
  }
}
