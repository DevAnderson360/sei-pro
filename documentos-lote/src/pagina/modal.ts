/** Configuracao do modal dos Documentos em Lote; a mecanica vive em `@comum/ui/modalIframe`. */
import type { ConfigModal } from "@comum/ui/modalIframe";
import { EVENTO_ABRIR } from "@dl/modelo/constantes";

export const CONFIG_MODAL: ConfigModal = {
  evento: EVENTO_ABRIR,
  titulo: "Documentos em Lote",
  atributoIframe: "data-spro-documentos-lote-modal",
  seletorItemMenu: "#iconBatchDocs",
  classeAviso: "spro-documentos-lote-aviso",
  textoSemModal: "Não foi possível abrir os Documentos em Lote nesta tela. Recarregue a página (F5) e tente de novo.",
};

/**
 * Liga o modal so com a opcao `documentosemlote` do legado ligada. Desligada, o botao normalmente nem existe, mas o
 * legado le a opcao por outro caminho: se as duas leituras divergirem e o botao aparecer, o clique nao pode sumir
 * em silencio, entao `semOpcao` liga o aviso de "nao foi possivel abrir".
 */
export async function armarSeLigado(opcaoLigada: () => Promise<boolean>, armar: () => void, semOpcao?: () => void): Promise<boolean> {
  if (!(await opcaoLigada())) {
    semOpcao?.();
    return false;
  }
  armar();
  return true;
}
