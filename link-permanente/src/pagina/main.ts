/**
 * Content script do Link Permanente (mundo isolado, document_start). Marca o
 * documento de forma síncrona (o legado não carrega o código antigo) e, só na
 * janela de topo e com o login lido, liga o modal ao item do menu. Sem
 * contexto, o clique no item mostra um aviso em vez de sumir.
 */

import { corDoTemaSei, manterTemaNoContexto, seiEscuro } from "@comum/pagina/tema";
import type { PortaRpc } from "@comum/ponte/rpc";
import { criarControleModal, ligarAvisoSemModal } from "@comum/ui/modalIframe";
import { Sei } from "@nucleo/sei";
import { documentoTopo, paginaDe } from "@nucleo/sessao/pagina";
import { CANAL_LINK_PERMANENTE } from "../modelo/constantes";
import { type ContextoLink, contextoLink } from "./contexto";
import { tratadoresLinkPermanente } from "./executor";
import { marcarAtivo } from "./marca";
import { CONFIG_MODAL } from "./modal";

marcarAtivo(document);

let avisoLigado = false;
function semModal(): void {
  if (avisoLigado) return;
  avisoLigado = true;
  ligarAvisoSemModal(document, CONFIG_MODAL);
}

const global = window as unknown as { __seiProLinkPermanente?: boolean };
if (window === window.top && !global.__seiProLinkPermanente) {
  global.__seiProLinkPermanente = true;
  const iniciar = () =>
    void principal().catch((e) => {
      console.warn("[SEI Pro] link permanente:", e);
      semModal();
    });
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
}

async function principal(): Promise<void> {
  const topo = documentoTopo();
  const ctx = contextoLink(topo, { temaEscuro: seiEscuro(document, localStorage), corTema: corDoTemaSei(topo) }, topo.location?.href);
  if (!ctx) {
    semModal();
    return;
  }
  manterTemaNoContexto(topo, localStorage, ctx);
  ligarModal(ctx);
}

function ligarModal(ctx: ContextoLink): void {
  const sei = new Sei(location.href, () => paginaDe(document, location.href));
  criarControleModal(document, CONFIG_MODAL, {
    // O tema vai no endereço: o app já nasce com o esquema de cores do iframe (sem fundo opaco).
    urlApp: () => chrome.runtime.getURL(`html/link-permanente.html#modo=modal&tema=${ctx.temaEscuro ? "escuro" : "claro"}`),
    temaEscuro: ctx.temaEscuro,
    conectar: () => chrome.runtime.connect({ name: CANAL_LINK_PERMANENTE }) as unknown as PortaRpc,
    tratadores: (fechar, minimizar) => tratadoresLinkPermanente({ doc: document, sei, ctx, fechar, minimizar }),
  });
}
