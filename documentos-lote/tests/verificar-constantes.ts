import {
  ATRIBUTO_ATIVO,
  EVENTO_ABRIR,
  JANELA_OUTRA_ABA_MS,
  PAUSA_MAXIMA,
  PRAZO_CRIAR_MS,
  PREFIXO_CHAVE,
  TETO,
} from "@dl/modelo/constantes";
import { checar } from "./util";

export function verificarConstantes(): void {
  checar("TETO é 2000", TETO === 2000, TETO);
  checar("EVENTO_ABRIR segue o padrão spro-*-abrir", /^spro-.*-abrir$/.test(EVENTO_ABRIR), EVENTO_ABRIR);
  checar("ATRIBUTO_ATIVO", ATRIBUTO_ATIVO === "data-seipro-documentos-lote", ATRIBUTO_ATIVO);
  checar("PREFIXO_CHAVE", PREFIXO_CHAVE === "docslote/", PREFIXO_CHAVE);
  checar("janela de outra aba", JANELA_OUTRA_ABA_MS === PRAZO_CRIAR_MS + PAUSA_MAXIMA, JANELA_OUTRA_ABA_MS);
}
