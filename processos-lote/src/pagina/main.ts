/**
 * Content script do Processos em Lote (mundo isolado, document_start). Marca o documento de forma sincrona (o
 * `initProcLoteModal` do legado passa a so disparar o evento) e, so na janela de topo, com a opcao `proclote`
 * ligada e o login lido, liga o modal ao item do menu. Sem contexto ou com a opcao desligada, o clique no item
 * (se o legado o desenhar) mostra um aviso em vez de sumir.
 */

import { lerOpcaoLegada } from "@comum/opcoes/legadas";
import { corDoTemaSei, manterTemaNoContexto, seiEscuro } from "@comum/pagina/tema";
import type { PortaRpc } from "@comum/ponte/rpc";
import { criarControleModal, ligarAvisoSemModal } from "@comum/ui/modalIframe";
import { Sei } from "@nucleo/sei";
import { documentoTopo, paginaDe } from "@nucleo/sessao/pagina";
import { CANAL_PROCESSOS_LOTE } from "../modelo/constantes";
import { type ContextoLote, contextoLote } from "./contexto";
import { tratadoresProcessosLote } from "./executor";
import { marcarAtivo } from "./marca";
import { armarSeLigado, CONFIG_MODAL } from "./modal";

/** Evento do content script do Link Permanente (link-permanente/src/modelo/constantes.ts); pacote separado. */
const EVENTO_ABRIR_LINK_PERMANENTE = "spro-link-permanente-abrir";

marcarAtivo(document);

let avisoLigado = false;
function semModal(): void {
  if (avisoLigado) return;
  avisoLigado = true;
  ligarAvisoSemModal(document, CONFIG_MODAL);
}

const global = window as unknown as { __seiProProcessosLote?: boolean };
if (window === window.top && !global.__seiProProcessosLote) {
  global.__seiProProcessosLote = true;
  const iniciar = () =>
    void armarSeLigado(
      () => lerOpcaoLegada("proclote"),
      () =>
        void principal().catch((e) => {
          console.warn("[SEI Pro] processos em lote:", e);
          semModal();
        }),
      semModal,
    ).catch((e) => {
      // Opcao ilegivel: o legado ja so dispara o evento, entao sem ninguem ouvindo o clique sumiria em silencio.
      console.warn("[SEI Pro] processos em lote: opcao ilegivel", e);
      semModal();
    });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
}

async function principal(): Promise<void> {
  const topo = documentoTopo();
  const ctx = contextoLote(topo, { temaEscuro: seiEscuro(document, localStorage), corTema: corDoTemaSei(topo) }, topo.location?.href);
  if (!ctx) {
    semModal();
    return;
  }
  manterTemaNoContexto(topo, localStorage, ctx);
  ligarModal(ctx);
}

function ligarModal(ctx: ContextoLote): void {
  const sei = new Sei(location.href, () => paginaDe(document, location.href));
  criarControleModal(document, CONFIG_MODAL, {
    // O tema vai no endereco: o app ja nasce com o esquema de cores do iframe (sem fundo opaco).
    urlApp: () => chrome.runtime.getURL(`html/processos-lote.html#modo=modal&tema=${ctx.temaEscuro ? "escuro" : "claro"}`),
    temaEscuro: ctx.temaEscuro,
    conectar: () => chrome.runtime.connect({ name: CANAL_PROCESSOS_LOTE }) as unknown as PortaRpc,
    tratadores: (fechar, minimizar) =>
      tratadoresProcessosLote({
        sei,
        ctx,
        fechar,
        minimizar,
        abrirLinkPermanente: () => document.dispatchEvent(new CustomEvent(EVENTO_ABRIR_LINK_PERMANENTE)),
      }),
  });
}
