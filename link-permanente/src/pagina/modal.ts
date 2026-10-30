/** Configuração do modal do Link Permanente; a mecânica vive em `@comum/ui/modalIframe`. */
import type { ConfigModal } from "@comum/ui/modalIframe";
import { EVENTO_ABRIR } from "../modelo/constantes";

export const CONFIG_MODAL: ConfigModal = {
  evento: EVENTO_ABRIR,
  titulo: "Pesquisar Link Permanente",
  atributoIframe: "data-spro-link-permanente-modal",
  seletorItemMenu: "#pesquisaLinkPermanentePro",
  classeAviso: "spro-link-permanente-aviso",
  textoSemModal: "Não foi possível abrir a pesquisa de link permanente nesta tela. Recarregue a página (F5) e tente de novo.",
};
