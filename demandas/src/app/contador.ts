/**
 * O contador da aba "Demandas" do painel lateral (`demandas/contadorPainel`: as MINHAS demandas abertas e atrasadas da
 * unidade), com os dois que o gravam: o app do lateral (a cada leitura) e o content script do Controle de Processos (a
 * cada pintura das pílulas). Num módulo leve: o content script não puxa o app.
 */

import type { Area } from "@comum/armazenamento/area";
import { CHAVE_CONTADOR_DEMANDAS, TETO_CONTADOR_DEMANDAS } from "@comum/painel/contadores";
import { ehMinha, estaAberta } from "../modelo/minhas";
import type { Responsavel } from "../modelo/tipos";
import type { DemandaNaTela } from "./dados";

/**
 * Só as minhas, abertas (nem arquivadas nem concluídas) e atrasadas, até o teto do selo. O `prazo` de cada item já vem
 * calculado para o "hoje" do app.
 */
export function contarAtrasadasMinhas(itens: readonly DemandaNaTela[], eu: Responsavel, teto = TETO_CONTADOR_DEMANDAS): number {
  const n = itens.filter((x) => x.prazo === "atrasada" && estaAberta(x.demanda) && ehMinha(x.demanda, eu)).length;
  return Math.min(teto, n);
}

/**
 * Grava só quando muda, como inteiro de 0 até o teto do selo (o shell mostra de 1 ao teto; 0 tira o número). Um por
 * montagem do lateral e um por carga do Controle de Processos: a primeira contagem sempre grava (o de outra unidade
 * pode ter gravado no meio). Gravação recusada tenta de novo na próxima contagem, mesmo igual. Nunca rejeita.
 */
export function gravadorDoContador(area: Area, teto = TETO_CONTADOR_DEMANDAS): (n: number) => Promise<void> {
  let gravado: number | null = null;
  return async (n) => {
    if (!Number.isFinite(n)) return;
    const v = Math.min(teto, Math.max(0, Math.trunc(n)));
    if (v === gravado) return;
    gravado = v;
    try {
      await area.gravar({ [CHAVE_CONTADOR_DEMANDAS]: v });
    } catch {
      if (gravado === v) gravado = null;
    }
  };
}
