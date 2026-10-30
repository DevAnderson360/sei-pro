/**
 * Entrada de html/processos-lote.html. Liga o app ao navegador: <dialog>, armazenamento, download, area de
 * transferencia e a ponte com a aba do SEI.
 *
 * So o modo modal (`#modo=modal&tema=claro|escuro`), como o Link Permanente (link-permanente/src/app/main.ts):
 * iframe transparente sobre a tela do SEI, ligado a PROPRIA aba (pagina/main.ts), com o app num <dialog> com veu.
 * Minimizado (html[data-minimizado], posto pelo app), o mesmo <dialog> ocupa a pastilha do canto, e o Esc nao o
 * fecha: a pagina e do usuario e o lote segue rodando.
 */

import { areaChrome } from "@comum/armazenamento/area";
import { esperarConexaoDaAba } from "@comum/ponte/conexaoDaAba";
import type { Rpc, Tratador } from "@comum/ponte/rpc";
import { acompanharTemaDoPainel, aplicarTemaDoContexto } from "@comum/tema/painel";
import { baixar, criarAbrirModal, criarConfirmar } from "@comum/ui/dialogo";
import { h } from "@comum/ui/dom";
import { OP_RESTAURADO } from "@comum/ui/modalIframe";
import { CANAL_PROCESSOS_LOTE, CHAVE_ENTRADA_LINK } from "../modelo/constantes";
import { RepositorioModelos } from "../modelos";
import { RepositorioLote } from "../repositorio";
import { AppProcessosLote, type ContextoApp } from "./app";

const parametros = new URLSearchParams(location.hash.slice(1));
document.documentElement.dataset.modo = "modal";
// O tema do SEI ja vem no endereco: sem ele, ate o contexto chegar valeria o do sistema, e com esquema de cores
// diferente do iframe o Chrome pinta o fundo opaco sobre a tela do SEI.
const temaDoEndereco = parametros.get("tema");
if (temaDoEndereco === "claro" || temaDoEndereco === "escuro") document.documentElement.dataset.tema = temaDoEndereco;
const raiz = document.getElementById("app")!;

// O ouvinte da porta e registrado ja, antes do `load` do iframe, que e quando o content script conecta. Os
// tratadores (o que a aba pede ao app) sao lidos a cada pedido: o `restaurado` entra quando o app existir.
const tratadoresDoApp: Record<string, Tratador> = {};
const conexao = esperarConexaoDaAba(CANAL_PROCESSOS_LOTE, tratadoresDoApp);

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Dialogos do app: <dialog> modais irmaos do modal, e o mais novo fica por cima (top layer). */
const abrirModal = criarAbrirModal();

void iniciarModal();

async function iniciarModal(): Promise<void> {
  const dlg = h("dialog", { class: "spro-dialogo pl-modal", "aria-label": "Processos em Lote" });
  // O CSS do modal mira `dialog.pl-modal #app`.
  dlg.append(raiz);
  document.body.append(dlg);
  let rpc: Rpc | null = null;
  let app: AppProcessosLote | null = null;
  const minimizado = () => document.documentElement.hasAttribute("data-minimizado");
  // Fechar o dialogo (X, Esc, veu) pede a aba que tire o iframe. O pedido vai PRIMEIRO: sem ele, a tela do SEI
  // fica presa sob o iframe transparente ate o F5. O app pausa o lote (o processo em voo ja foi gravado como
  // incerto antes do POST, entao nada e repetido na retomada).
  dlg.addEventListener("close", () => {
    void rpc?.chamar("fechar", undefined, 3000).catch(() => undefined);
    try {
      app?.destruir();
    } catch (e) {
      console.warn("[SEI Pro] processos em lote: falha ao desmontar o app", e);
    }
  });
  // Minimizado, o Esc nativo do <dialog> nao fecha a pastilha.
  dlg.addEventListener("cancel", (ev) => {
    if (minimizado()) ev.preventDefault();
  });
  // Veu: o clique cai no proprio <dialog>, fora do retangulo dele. Comeco e fim no veu, para uma selecao de texto
  // que termina fora nao fechar a janela. Minimizado nao ha veu.
  const noVeu = (ev: MouseEvent) => {
    if (ev.target !== dlg || minimizado()) return false;
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
    // Segue o SEI (modo noturno do SEI Pro e cor da barra), como o Historico.
    const html = document.documentElement;
    aplicarTemaDoContexto(html, ctx);
    const rpcAba = rpc;
    acompanharTemaDoPainel(document, {
      aoDesligar: async () => aplicarTemaDoContexto(html, await rpcAba.chamar<ContextoApp>("contexto")),
    });
    const area = areaChrome(chrome.storage.local, "local");
    const escopo = `${ctx.host}|${ctx.login}`;
    app = new AppProcessosLote(raiz, {
      rpc,
      ctx,
      repo: new RepositorioLote(area, escopo),
      modelos: new RepositorioModelos(area, escopo),
      area,
      abrirModal,
      confirmar: criarConfirmar(abrirModal),
      baixar,
      clip: navigator.clipboard,
      ItemClip: typeof ClipboardItem === "function" ? ClipboardItem : undefined,
      fechar: () => dlg.close(),
      minimizar: async (m) => {
        await rpcAba.chamar("minimizar", { minimizado: m });
      },
      // Uso unico: o Link Permanente le e apaga ao abrir.
      gravarEntradaLink: (texto) => area.gravar({ [CHAVE_ENTRADA_LINK]: texto }),
    });
    // A aba restaurou a janela (clique no item do menu com a pastilha): o app sai da pastilha.
    const appAberto = app;
    tratadoresDoApp[OP_RESTAURADO] = () => {
      appAberto.restaurado();
      return true;
    };
    mostrar();
    await app.iniciar();
  } catch (e) {
    app?.destruir();
    app = null;
    // Mesmo com erro o dialogo abre: e por ele que o usuario fecha o iframe que cobre a tela.
    raiz.replaceChildren(
      h("p", { class: "spro-lista-erro" }, `Não foi possível abrir o Processos em Lote: ${mensagem(e)}`),
      h(
        "div",
        { class: "spro-dialogo-rodape" },
        h("button", { type: "button", class: "spro-botao", onclick: () => dlg.close() }, "Fechar"),
      ),
    );
    mostrar();
  }
}
