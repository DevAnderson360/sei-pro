/**
 * Entrada de html/acoes-lote.html: conecta com a aba do SEI, abre o <dialog> do modal, segue o tema do SEI e
 * monta o app (tela de selecao; as demais telas entram nas tarefas seguintes).
 *
 * So o modo modal (`#modo=modal&tema=claro|escuro`), como o Processos em Lote: iframe transparente sobre a tela
 * do SEI, ligado a PROPRIA aba (pagina/main.ts), com o app num <dialog> com veu.
 */

import { areaChrome } from "@comum/armazenamento/area";
import { esperarConexaoDaAba } from "@comum/ponte/conexaoDaAba";
import type { Rpc, Tratador } from "@comum/ponte/rpc";
import { acompanharTemaDoPainel, aplicarTemaDoContexto } from "@comum/tema/painel";
import { criarAbrirModal, criarConfirmar } from "@comum/ui/dialogo";
import { h } from "@comum/ui/dom";
import { OP_RESTAURADO } from "@comum/ui/modalIframe";
import { CANAL_ACOES_LOTE } from "../modelo/constantes";
import { RepositorioAcoes } from "../repositorio";
import { AppAcoesLote, type ContextoApp } from "./app";

const parametros = new URLSearchParams(location.hash.slice(1));
document.documentElement.dataset.modo = "modal";
const temaDoEndereco = parametros.get("tema");
if (temaDoEndereco === "claro" || temaDoEndereco === "escuro") document.documentElement.dataset.tema = temaDoEndereco;
const raiz = document.getElementById("app")!;

// O ouvinte da porta e registrado ja, antes do `load` do iframe, que e quando o content script conecta.
const tratadoresDoApp: Record<string, Tratador> = {};
const conexao = esperarConexaoDaAba(CANAL_ACOES_LOTE, tratadoresDoApp);

void iniciarModal();

async function iniciarModal(): Promise<void> {
  const dlg = h("dialog", { class: "spro-dialogo al-modal", "aria-label": "Ações em Lote" });
  dlg.append(raiz);
  document.body.append(dlg);
  let rpc: Rpc | null = null;
  let app: AppAcoesLote | null = null;
  // Fechar o dialogo (X, Esc, veu) pede a aba que tire o iframe; sem o pedido a tela do SEI fica presa sob ele.
  // O pedido vai primeiro; depois o app para de disparar (a etapa em voo ja foi gravada como incerta).
  dlg.addEventListener("close", () => {
    void rpc?.chamar("fechar", undefined, 3000).catch(() => undefined);
    app?.destruir();
  });
  // Minimizado, o Esc nativo do <dialog> nao fecha a pastilha (a pagina e do usuario).
  dlg.addEventListener("cancel", (ev) => {
    if (document.documentElement.hasAttribute("data-minimizado")) ev.preventDefault();
  });
  raiz.replaceChildren(h("p", {}, "Carregando…"));
  dlg.showModal();
  try {
    rpc = await conexao;
    const ctx = await rpc.chamar<ContextoApp>("contexto");
    // Segue o SEI (modo noturno do SEI Pro e cor da barra), como o Processos em Lote.
    const html = document.documentElement;
    aplicarTemaDoContexto(html, ctx);
    const rpcAba = rpc;
    acompanharTemaDoPainel(document, {
      aoDesligar: async () => aplicarTemaDoContexto(html, await rpcAba.chamar<ContextoApp>("contexto")),
    });
    const ponte = rpc;
    app = new AppAcoesLote(raiz, {
      rpc: ponte,
      ctx,
      fechar: () => dlg.close(),
      confirmar: criarConfirmar(criarAbrirModal()),
      repo: new RepositorioAcoes(areaChrome(chrome.storage.local, "local"), ctx.host, ctx.login),
      aoFechar: (cb) => ponte.aoFechar(cb),
    });
    const aberto = app;
    tratadoresDoApp[OP_RESTAURADO] = () => {
      aberto.restaurado();
      return true;
    };
    await app.iniciar();
  } catch (e) {
    raiz.replaceChildren(
      h("p", { class: "spro-lista-erro" }, `Não foi possível abrir as Ações em Lote: ${e instanceof Error ? e.message : String(e)}`),
    );
  }
}
