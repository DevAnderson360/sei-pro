/**
 * Content script das Acoes em Lote (mundo isolado, document_start). Marca o documento de forma sincrona (o
 * `getDocumentosActions` do legado passa a so disparar o evento) e, so na janela de topo, com a opcao `acoesemlote`
 * ligada e o login lido, liga o modal ao botao da barra do processo. Sem contexto ou com a opcao desligada, o
 * clique no botao (se o legado o desenhar) mostra um aviso em vez de sumir.
 */

import { lerOpcaoLegada } from "@comum/opcoes/legadas";
import { corDoTemaSei, manterTemaNoContexto, seiEscuro } from "@comum/pagina/tema";
import type { PortaRpc } from "@comum/ponte/rpc";
import { criarControleModal, ligarAvisoSemModal } from "@comum/ui/modalIframe";
import { Sei } from "@nucleo/sei";
import { documentoTopo, paginaDe } from "@nucleo/sessao/pagina";
import { CANAL_ACOES_LOTE } from "../modelo/constantes";
import { type ContextoAcoes, contextoAcoes } from "./contexto";
import { tratadoresAcoesLote } from "./executor";
import { marcarAtivo } from "./marca";
import { armarSeLigado, CONFIG_MODAL } from "./modal";

marcarAtivo(document);

let avisoLigado = false;
function semModal(): void {
  if (avisoLigado) return;
  avisoLigado = true;
  ligarAvisoSemModal(document, CONFIG_MODAL);
}

const global = window as unknown as { __seiProAcoesLote?: boolean };
if (window === window.top && !global.__seiProAcoesLote) {
  global.__seiProAcoesLote = true;
  const iniciar = () =>
    void armarSeLigado(
      () => lerOpcaoLegada("acoesemlote"),
      () =>
        void principal().catch((e) => {
          console.warn("[SEI Pro] acoes em lote:", e);
          semModal();
        }),
      semModal,
    ).catch((e) => {
      // Opcao ilegivel: o legado ja so dispara o evento, entao sem ninguem ouvindo o clique sumiria em silencio.
      console.warn("[SEI Pro] acoes em lote: opcao ilegivel", e);
      semModal();
    });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
}

async function principal(): Promise<void> {
  const topo = documentoTopo();
  const ctx = contextoAcoes(topo, { temaEscuro: seiEscuro(document, localStorage), corTema: corDoTemaSei(topo) }, topo.location?.href);
  if (!ctx) {
    semModal();
    return;
  }
  manterTemaNoContexto(topo, localStorage, ctx);
  ligarModal(ctx);
}

function ligarModal(ctx: ContextoAcoes): void {
  const sei = new Sei(location.href, () => paginaDe(document, location.href));
  criarControleModal(document, CONFIG_MODAL, {
    // O tema vai no endereco: o app ja nasce com o esquema de cores do iframe (sem fundo opaco).
    urlApp: () => chrome.runtime.getURL(`html/acoes-lote.html#modo=modal&tema=${ctx.temaEscuro ? "escuro" : "claro"}`),
    temaEscuro: ctx.temaEscuro,
    conectar: () => chrome.runtime.connect({ name: CANAL_ACOES_LOTE }) as unknown as PortaRpc,
    tratadores: (fechar, minimizar) => tratadoresAcoesLote({ sei, ctx, fechar, minimizar }),
  });
}
