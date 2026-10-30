/**
 * Onde a configuração do Agente fica no `chrome.storage.local` e o que ela tem
 * de fábrica. Fora do `main.ts` para quem só lê ou grava a configuração (a
 * sincronia por arquivo) não carregar o painel inteiro junto.
 */

import { MODELO_PADRAO } from "../motor/provedor";
import { SEM_LIMITE } from "./gasto";
import type { Config } from "./main";

export const CHAVE_CONFIG = "agenteIA_config";

/** A configuração de fábrica; o que está guardado vai por cima. */
export function configPadrao(): Config {
  return {
    modoJanela: "painel",
    auxiliaresMaxParalelo: 3,
    auxiliaresMaxPassos: 14,
    rotinasPausadas: false,
    reais: true,
    guardar: true,
    dias: 30,
    servico: "openrouter",
    url: "",
    chave: "",
    modelo: MODELO_PADRAO,
    nomes: true,
    cnpj: false,
    ajustes: {},
    instrucoes: "",
    limites: SEM_LIMITE,
    cache: true,
    memoria: true,
    modeloAuxiliar: "",
  };
}
