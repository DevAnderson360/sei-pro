/**
 * Content script dos Documentos em Lote (mundo isolado, document_start). Marca o documento de forma sincrona (o
 * `initDocLoteModalSelecaoDoc` do legado passa a so disparar o evento) e, so na janela de topo, com a opcao
 * `documentosemlote` ligada e o login lido, liga o modal ao botao da barra do processo. Sem contexto ou com a
 * opcao desligada, o clique no botao (se o legado o desenhar) mostra um aviso em vez de sumir.
 */

import { lerOpcaoLegada } from "@comum/opcoes/legadas";
import { corDoTemaSei, manterTemaNoContexto, seiEscuro } from "@comum/pagina/tema";
import type { PortaRpc } from "@comum/ponte/rpc";
import { criarControleModal, ligarAvisoSemModal } from "@comum/ui/modalIframe";
import { CANAL_DOCUMENTOS_LOTE } from "@dl/modelo/constantes";
import { Sei } from "@nucleo/sei";
import { documentoTopo, paginaDe } from "@nucleo/sessao/pagina";
import { type ContextoDocumentos, contextoDocumentos } from "./contexto";
import { dispararAbrirLinkPermanente, tratadoresDocumentosLote } from "./executor";
import { marcarAtivo } from "./marca";
import { armarSeLigado, CONFIG_MODAL } from "./modal";

marcarAtivo(document);

let avisoLigado = false;
function semModal(): void {
  if (avisoLigado) return;
  avisoLigado = true;
  ligarAvisoSemModal(document, CONFIG_MODAL);
}

const global = window as unknown as { __seiProDocumentosLote?: boolean };
if (window === window.top && !global.__seiProDocumentosLote) {
  global.__seiProDocumentosLote = true;
  const iniciar = () =>
    void armarSeLigado(
      () => lerOpcaoLegada("documentosemlote"),
      () =>
        void principal().catch((e) => {
          console.warn("[SEI Pro] documentos em lote:", e);
          semModal();
        }),
      semModal,
    ).catch((e) => {
      // Opcao ilegivel: o legado ja so dispara o evento, entao sem ninguem ouvindo o clique sumiria em silencio.
      console.warn("[SEI Pro] documentos em lote: opcao ilegivel", e);
      semModal();
    });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
}

async function principal(): Promise<void> {
  const topo = documentoTopo();
  const ctx = contextoDocumentos(topo, { temaEscuro: seiEscuro(document, localStorage), corTema: corDoTemaSei(topo) }, topo.location?.href);
  if (!ctx) {
    semModal();
    return;
  }
  manterTemaNoContexto(topo, localStorage, ctx);
  ligarModal(ctx);
}

function ligarModal(ctx: ContextoDocumentos): void {
  const sei = new Sei(location.href, () => paginaDe(document, location.href));
  criarControleModal(document, CONFIG_MODAL, {
    // O tema vai no endereco: o app ja nasce com o esquema de cores do iframe (sem fundo opaco).
    urlApp: () => chrome.runtime.getURL(`html/documentos-lote.html#modo=modal&tema=${ctx.temaEscuro ? "escuro" : "claro"}`),
    temaEscuro: ctx.temaEscuro,
    conectar: () => chrome.runtime.connect({ name: CANAL_DOCUMENTOS_LOTE }) as unknown as PortaRpc,
    tratadores: (fechar, minimizar) =>
      tratadoresDocumentosLote({ sei, ctx, fechar, minimizar, abrirLinkPermanente: () => dispararAbrirLinkPermanente(document) }),
  });
}
