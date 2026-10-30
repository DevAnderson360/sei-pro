/**
 * O contador da aba "Projetos" do painel lateral (`projetos/contadorPainel`, etapas atrasadas da unidade), com os
 * dois que o gravam: o app do lateral (a cada leitura) e o content script do Controle de Processos (a cada pintura
 * das pílulas). Num módulo leve: o content script não puxa o app.
 */

import type { Area } from "@comum/armazenamento/area";
import { CHAVE_CONTADOR_PAINEL, TETO_CONTADOR_PAINEL } from "../modelo/constantes";

/**
 * O contador da aba "Projetos" do painel (`projetos/contadorPainel`): grava só quando muda, como inteiro de 0 até o
 * teto do selo (o shell mostra de 1 ao teto; 0 tira o número). Um por montagem do lateral e um por carga do
 * Controle de Processos: a primeira contagem sempre grava (o de outra unidade pode ter gravado no meio). Gravação
 * recusada tenta de novo na próxima contagem, mesmo igual.
 */
export function gravadorDoContador(area: Area, teto = TETO_CONTADOR_PAINEL): (n: number) => void {
  let gravado: number | null = null;
  return (n) => {
    if (!Number.isFinite(n)) return;
    const v = Math.min(teto, Math.max(0, Math.trunc(n)));
    if (v === gravado) return;
    gravado = v;
    void area.gravar({ [CHAVE_CONTADOR_PAINEL]: v }).catch(() => {
      if (gravado === v) gravado = null;
    });
  };
}
