/** Mensagens de erro das ações do app. */

import { avisar } from "@comum/ui/aviso";
import { cotaCheia } from "@projetos/app/erros";
import { ErroOperacao } from "../modelo/operacoes";
import { ErroValidacao } from "../modelo/validacao";

export const TEXTO_COTA_CHEIA =
  "O navegador não tem mais espaço para guardar as demandas. Arquive as concluídas antigas e exporte o arquivo morto.";

/** Erro de validação ou de transição: a mensagem; cota cheia: a explicação; o resto: a mensagem crua. */
export function mensagemDoErro(e: unknown): string {
  if (e instanceof ErroValidacao || e instanceof ErroOperacao) return e.message;
  if (cotaCheia(e)) return TEXTO_COTA_CHEIA;
  return e instanceof Error ? e.message : String(e);
}

export function avisarErro(e: unknown): void {
  avisar(mensagemDoErro(e));
}
