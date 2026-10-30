import { paraLatin1 } from "@comum/texto/latin1";
import { MAX_ESPECIFICACAO } from "./constantes";
import type { LinhaLote } from "./linhas";

export { estimarDuracao, limitarPausa } from "./estimativa";

/**
 * `nivel-invalido` e ERRO (trava o Iniciar: a linha cairia no nivel do lote, publico por padrao); `interessado` so
 * avisa que a coluna foi lida mas nao e aplicada nesta versao (o usuario sabe antes de criar, nao depois).
 */
export type AvisoLinha = "duplicada" | "vazia" | "truncada" | "convertida" | "nivel-invalido" | "interessado";

const BLOQUEANTES: readonly AvisoLinha[] = ["nivel-invalido"];

/** A linha nao pode ser criada como esta: o usuario corrige na configuracao ou tira a linha. */
export function bloqueia(avisos: readonly AvisoLinha[]): boolean {
  return avisos.some((a) => BLOQUEANTES.includes(a));
}

export interface LinhaPrevia {
  /** Posicao da linha na lista, comecando em 1. */
  indice: number;
  original: string;
  /** O que sera de fato postado no SEI: ja em latin-1, cortado em 100 e sem espacos nas pontas. */
  enviada: string;
  avisos: AvisoLinha[];
}

/** Mostra, antes de criar, o que cada linha vira e o que merece atencao. */
export function montarPrevia(linhas: LinhaLote[]): LinhaPrevia[] {
  const vistas = new Set<string>();
  return linhas.map((l, i) => {
    const original = l.especificacao;
    const convertida = paraLatin1(original);
    const enviada = convertida.slice(0, MAX_ESPECIFICACAO).trim();
    const avisos: AvisoLinha[] = [];
    if (convertida !== original) avisos.push("convertida");
    if (convertida.trim().length > MAX_ESPECIFICACAO) avisos.push("truncada");
    if (enviada === "") avisos.push("vazia");
    else {
      // Duplicada = a segunda ocorrencia do que seria enviado; a primeira nao leva aviso.
      if (vistas.has(enviada)) avisos.push("duplicada");
      vistas.add(enviada);
    }
    if (l.nivelInvalido !== undefined) avisos.push("nivel-invalido");
    if ((l.interessado ?? "") !== "") avisos.push("interessado");
    return { indice: i + 1, original, enviada, avisos };
  });
}
