/**
 * Entrada deixada pelo Processos em Lote (números, um por linha) em
 * `chrome.storage.local`, logo antes de abrir este módulo. É consumida uma
 * vez: lê e apaga, para a segunda abertura não repetir os números antigos.
 */

import type { Area } from "@comum/armazenamento/area";
import { CHAVE_ENTRADA } from "../modelo/constantes";

/** Texto da entrada pendente, ou null (nada gravado, valor que não é texto, vazio ou storage com defeito). Nunca lança. */
export async function lerEntradaPendente(area: Area): Promise<string | null> {
  let valor: unknown;
  try {
    valor = (await area.obter(CHAVE_ENTRADA))[CHAVE_ENTRADA];
  } catch (e) {
    console.warn("[SEI Pro] link permanente: não foi possível ler a entrada pendente", e);
    return null;
  }
  // A chave sai mesmo quando o valor é lixo, para ele não voltar a cada abertura.
  try {
    await area.remover(CHAVE_ENTRADA);
  } catch (e) {
    // Sem apagar não há consumo único: devolver o texto o repetiria a cada abertura.
    console.warn("[SEI Pro] link permanente: não foi possível apagar a entrada pendente", e);
    return null;
  }
  return typeof valor === "string" && valor !== "" ? valor : null;
}
