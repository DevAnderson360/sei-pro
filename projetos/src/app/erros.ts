/**
 * Mensagens de erro das ações do app. A gravação no `chrome.storage.local`
 * recusada por falta de espaço (spec 9) vira uma explicação com o que fazer,
 * em vez do texto cru do navegador ("QUOTA_BYTES quota exceeded").
 */

import { avisar } from "@comum/ui/aviso";

export const TEXTO_COTA_CHEIA = "O espaço do navegador para o SEI Pro está cheio. Arquive ou exclua projetos antigos.";

/** O navegador recusou a gravação por cota: Chrome diz "QUOTA_BYTES quota exceeded"; outros, `QuotaExceededError`. */
export function cotaCheia(e: unknown): boolean {
  const x = e as { name?: unknown; message?: unknown } | null;
  const texto = `${typeof x?.name === "string" ? x.name : ""} ${typeof x?.message === "string" ? x.message : typeof e === "string" ? e : ""}`;
  return /quota/i.test(texto);
}

/** Erro de uma ação: a mensagem do repositório (ErroValidacao), a da cota cheia (spec 9) ou a do erro. */
export function mensagemDoErro(e: unknown): string {
  const m = (e as { mensagens?: unknown })?.mensagens;
  if (Array.isArray(m) && m.length) return m.map(String).join(" ");
  if (cotaCheia(e)) return TEXTO_COTA_CHEIA;
  return e instanceof Error ? e.message : String(e);
}

/**
 * O painel lateral trocou de unidade com uma pergunta aberta (o "Entendi" da unidade velha): o "não" é da troca, não
 * do usuário. Nada foi gravado e ninguém avisa (a montagem diz uma vez o que foi fechado, já na unidade nova).
 */
export class CanceladoNaTroca extends Error {
  constructor() {
    super("O painel trocou de unidade: o que estava aberto foi fechado sem gravar.");
    this.name = "CanceladoNaTroca";
  }
}

/** O aviso de erro de uma ação; o cancelamento da troca de unidade fica em silêncio. */
export function avisarErro(e: unknown): void {
  if (e instanceof CanceladoNaTroca) return;
  avisar(mensagemDoErro(e));
}
