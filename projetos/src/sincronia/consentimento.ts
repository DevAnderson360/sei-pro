/**
 * Consentimento dos Textos Padrão dos projetos, por pessoa, unidade e texto
 * (`host|login|idUnidade|un` e `…|eu`), no storage.sync (segue o perfil do
 * navegador, como nos Favoritos). O da unidade nasce do aviso único
 * ("Entendi", spec 6.1); o pessoal, do diálogo "Guardar no SEI" (convite).
 * Lido pelo content script (que grava no SEI) e pelo app (que pergunta).
 */

import type { Area } from "@comum/armazenamento/area";
import { chaveConsentimento, consentimentoNaArea, type PortaConsentimento } from "@comum/sincronia/consentimento";
import type { Vis } from "../modelo/tipos";

export const CHAVE_CONSENTIMENTO = "projetos/consentimento";
const CAMPO = "textoPadrao";

export function chaveDoConsentimento(host: string, login: string, idUnidade: string, vis: Vis): string {
  return chaveConsentimento(host, login, idUnidade, vis === "unidade" ? "un" : "eu");
}

export function consentimentoProjetos(sync: Area, host: string, login: string, idUnidade: string, vis: Vis): PortaConsentimento {
  return consentimentoNaArea({
    area: sync,
    chavePreferencias: CHAVE_CONSENTIMENTO,
    campo: CAMPO,
    chave: chaveDoConsentimento(host, login, idUnidade, vis),
  });
}
