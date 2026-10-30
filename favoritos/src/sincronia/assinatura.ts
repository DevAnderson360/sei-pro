/**
 * Impressão digital do conteúdo de um envelope, igual em qualquer computador
 * para o mesmo dado: entidades e listas em ordem, chaves do JSON em ordem, sem
 * os campos de quem gravou e quando. Serve para não regravar o que já está igual.
 * A conta é a da sei-comum (`@comum/sincronia/assinatura`); aqui só se escolhe o que entra.
 */

import { assinaturaEstavel, porId } from "@comum/sincronia/assinatura";
import type { Envelope } from "../arquivo";
import { chaveEscopo } from "../modelo/escopo";

export function assinaturaEnvelope(env: Envelope): string {
  const escopos = [...env.escopos]
    .map((e) => ({ k: chaveEscopo(e.escopo), f: porId(e.favoritos), p: porId(e.pastas), e: porId(e.etiquetas) }))
    .sort((a, b) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0));
  return assinaturaEstavel(escopos);
}
