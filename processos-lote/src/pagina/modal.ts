/** Configuracao do modal do Processos em Lote; a mecanica vive em `@comum/ui/modalIframe`. */
import type { ConfigModal } from "@comum/ui/modalIframe";
import { EVENTO_ABRIR } from "../modelo/constantes";

export const CONFIG_MODAL: ConfigModal = {
  evento: EVENTO_ABRIR,
  titulo: "Processos em Lote",
  atributoIframe: "data-spro-processos-lote-modal",
  seletorItemMenu: "#processosLotePro",
  classeAviso: "spro-processos-lote-aviso",
  textoSemModal: "Não foi possível abrir o Processos em Lote nesta tela. Recarregue a página (F5) e tente de novo.",
};

/**
 * Liga o modal so com a opcao `proclote` do legado ligada. Desligada, o item do menu normalmente nem existe
 * (sei-pro-all.js), mas o legado le a opcao por outro caminho: se as duas leituras divergirem e o item
 * aparecer, o clique nao pode sumir em silencio, entao `semOpcao` liga o aviso de "nao foi possivel abrir".
 */
export async function armarSeLigado(opcaoLigada: () => Promise<boolean>, armar: () => void, semOpcao?: () => void): Promise<boolean> {
  if (!(await opcaoLigada())) {
    semOpcao?.();
    return false;
  }
  armar();
  return true;
}
