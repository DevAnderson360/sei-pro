/** Preferências locais do Gestor de Demandas (storage.local, `demandas/preferencias`). */

import type { Area } from "@comum/armazenamento/area";
import { type Escala, ehEscala } from "@projetos/gantt/escalas";
import { CHAVE_PREFERENCIAS } from "./modelo/constantes";

export interface PreferenciasDemandas {
  visao: "tabela" | "quadro" | "cronograma" | "painel";
  escopo: "ambos" | "unidade" | "eu";
  concluidasNoQuadroDias: number;
  agrupamentoCronograma: "responsavel" | "situacao";
  escalaCronograma: Escala;
  periodoPainel: "30" | "90" | "365" | "tudo";
  /** Painel embutido recolhido (o content script grava; o app, o resto). */
  recolhido: boolean;
}

export const PADRAO: PreferenciasDemandas = {
  visao: "quadro",
  escopo: "ambos",
  concluidasNoQuadroDias: 30,
  agrupamentoCronograma: "responsavel",
  escalaCronograma: "Semana",
  periodoPainel: "90",
  recolhido: false,
};

const VISOES = new Set(["tabela", "quadro", "cronograma", "painel"]);
const ESCOPOS = new Set(["ambos", "unidade", "eu"]);
const AGRUPAMENTOS = new Set(["responsavel", "situacao"]);
const PERIODOS = new Set(["30", "90", "365", "tudo"]);

/** Valor gravado à mão ou por uma versão futura nunca quebra: o que não vale volta ao padrão. */
export function normalizar(bruto: unknown): PreferenciasDemandas {
  const b = (typeof bruto === "object" && bruto !== null ? bruto : {}) as Record<string, unknown>;
  const dias =
    typeof b.concluidasNoQuadroDias === "number" && b.concluidasNoQuadroDias >= 1 && b.concluidasNoQuadroDias <= 3650
      ? Math.floor(b.concluidasNoQuadroDias)
      : PADRAO.concluidasNoQuadroDias;
  return {
    visao: VISOES.has(b.visao as string) ? (b.visao as PreferenciasDemandas["visao"]) : PADRAO.visao,
    escopo: ESCOPOS.has(b.escopo as string) ? (b.escopo as PreferenciasDemandas["escopo"]) : PADRAO.escopo,
    concluidasNoQuadroDias: dias,
    agrupamentoCronograma: AGRUPAMENTOS.has(b.agrupamentoCronograma as string)
      ? (b.agrupamentoCronograma as PreferenciasDemandas["agrupamentoCronograma"])
      : PADRAO.agrupamentoCronograma,
    escalaCronograma: ehEscala(b.escalaCronograma) ? b.escalaCronograma : PADRAO.escalaCronograma,
    periodoPainel: PERIODOS.has(b.periodoPainel as string)
      ? (b.periodoPainel as PreferenciasDemandas["periodoPainel"])
      : PADRAO.periodoPainel,
    recolhido: typeof b.recolhido === "boolean" ? b.recolhido : PADRAO.recolhido,
  };
}

export async function lerPreferencias(area: Area): Promise<PreferenciasDemandas> {
  return normalizar((await area.obter(CHAVE_PREFERENCIAS))[CHAVE_PREFERENCIAS]);
}

export async function gravarPreferencias(area: Area, parcial: Partial<PreferenciasDemandas>): Promise<PreferenciasDemandas> {
  const novo = normalizar({ ...(await lerPreferencias(area)), ...parcial });
  await area.gravar({ [CHAVE_PREFERENCIAS]: novo });
  return novo;
}
