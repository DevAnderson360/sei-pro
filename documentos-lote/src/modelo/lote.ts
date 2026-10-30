import type { Modelo } from "../sei/modelo";
import { TETO_BYTES_LOTE } from "./constantes";
import type { Destino } from "./destinos";

/** O que a tela de cruzamento decide e o lote carrega até o fim: modelo, colunas e pausa. */
export interface ConfigLote {
  /** Campo `##campo##` do modelo → coluna do arquivo. */
  camposCruzados: Record<string, string>;
  colunaNome: string;
  modeloDescricao: string;
  destino: Destino;
  colunaNivel?: string;
  colunaHipotese?: string;
  pausa: number;
  modelo: Modelo;
}

const MB = 1024 * 1024;

/** Megabytes com uma casa (arredondados para cima: o que passa do teto nunca aparece igual a ele), com vírgula. */
const emMb = (bytes: number) => String(Math.ceil((bytes / MB) * 10) / 10).replace(".", ",");

/** A recusa do lote (ou da planilha) que não cabe no armazenamento do navegador. */
export function mensagemLoteGrande(bytes: number): string {
  return `A planilha é grande demais para guardar o andamento do lote (${emMb(bytes)} MB; o limite é ${emMb(TETO_BYTES_LOTE)} MB). Divida em partes menores.`;
}
