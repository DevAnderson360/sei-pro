/**
 * O modal do histórico sobre a tela do SEI. A mecânica (iframe transparente,
 * trava de rolagem, porta única, fechamento idempotente, prazo de contato,
 * aviso sem modal) vive em `@comum/ui/modalIframe`, compartilhada com os outros
 * módulos; aqui só entra a configuração do Histórico e as assinaturas de antes.
 */

import type { Tratador } from "@comum/ponte/rpc";
import {
  avisarNaPagina as avisarComum,
  type ConfigModal,
  type ControleModal,
  criarControleModal as criarControleComum,
  type DepsControleModal as DepsComum,
  ligarAvisoSemModal as ligarAvisoComum,
  type ModalMontado,
  montarModal as montarModalComum,
  PRAZO_CONTATO_MS,
} from "@comum/ui/modalIframe";
import { EVENTO_ABRIR } from "../modelo/constantes";

export type { ControleModal, ModalMontado };
export { PRAZO_CONTATO_MS };

export const TEXTO_SEM_MODAL = "Não foi possível abrir o histórico nesta tela. Recarregue a página (F5) e tente de novo.";

const CONFIG: ConfigModal = {
  evento: EVENTO_ABRIR,
  titulo: "Histórico de processos visitados",
  atributoIframe: "data-spro-historico-modal",
  seletorItemMenu: "#historicoProcessosPro",
  textoSemModal: TEXTO_SEM_MODAL,
  classeAviso: "spro-historico-aviso",
};

/** Como antes: o Histórico não usa o Minimizar, então os tratadores só recebem `fechar`. */
export type DepsControleModal = Omit<DepsComum, "tratadores"> & {
  tratadores(fechar: () => void): Record<string, Tratador>;
};

export const montarModal = (doc: Document, o: { urlApp: string; temaEscuro: boolean; aoFechar?: () => void }): ModalMontado =>
  montarModalComum(doc, CONFIG, o);

export const criarControleModal = (doc: Document, d: DepsControleModal): ControleModal => criarControleComum(doc, CONFIG, d);

export const avisarNaPagina = (doc: Document, texto: string, ms?: number): HTMLElement => avisarComum(doc, CONFIG, texto, ms);

export const ligarAvisoSemModal = (doc: Document, ms?: number): (() => void) => ligarAvisoComum(doc, CONFIG, ms);
