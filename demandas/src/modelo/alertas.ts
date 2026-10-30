/** Faixas de tamanho do Texto Padrão e de quantidade (spec 4.3). Puro: quem mede é o motor. */

import { AVISO_ATIVAS, AVISO_PESO_TOTAL, AVISO_TEXTO, TETO_TEXTO } from "./constantes";

export type Faixa = "normal" | "aviso" | "bloqueio";

export function faixaDoTamanho(bytes: number | undefined, teto = TETO_TEXTO, aviso = AVISO_TEXTO): { faixa: Faixa; percentual: number } {
  if (bytes === undefined) return { faixa: "normal", percentual: 0 };
  const percentual = Math.round((bytes / teto) * 100);
  if (bytes >= teto) return { faixa: "bloqueio", percentual };
  if (bytes >= aviso) return { faixa: "aviso", percentual };
  return { faixa: "normal", percentual };
}

export const pesoTotalAlto = (bytes: readonly number[]): boolean => bytes.reduce((a, b) => a + b, 0) >= AVISO_PESO_TOTAL;
export const muitasAtivas = (qtd: number): boolean => qtd > AVISO_ATIVAS;
/** Criar, duplicar e restaurar travam no teto do texto das demandas ativas (`d`); editar, concluir e arquivar seguem. */
export const bloqueiaCriacao = (bytesTabelaD: number | undefined): boolean => faixaDoTamanho(bytesTabelaD).faixa === "bloqueio";
