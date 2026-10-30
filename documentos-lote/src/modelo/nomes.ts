import { paraLatin1 } from "@comum/texto/latin1";
import { MAX_NOME_ARVORE } from "@dl/modelo/constantes";

/** Nome na árvore: sem acento (mantém º ª °), latin-1, no máximo 50 caracteres. */
export function nomeNaArvore(valor: string): string {
  const semAcento = valor.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return paraLatin1(semAcento.slice(0, MAX_NOME_ARVORE)).slice(0, MAX_NOME_ARVORE).trim();
}
