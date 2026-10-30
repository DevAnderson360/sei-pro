/**
 * Reconhece protocolos do SEI em texto colado: número de processo (federal ou
 * de SP), número SEI de documento (6 a 10 dígitos soltos) e, na falta de
 * padrão, a linha curta e sem espaço (ex.: "Contrato-77"). Segue a ordem de
 * aparição e descarta repetições exatas: "00123456" e "123456" são distintos,
 * assim como "abc" e "ABC".
 */

export type TipoProtocolo = "processo" | "sei" | "outro";
export interface ProtocoloReconhecido {
  texto: string;
  tipo: TipoProtocolo;
}

// Prefixo de 3 a 6 dígitos: há órgãos com 3 (ex.: "026.00000052/2023-47"). O
// lookbehind impede começar no meio de outro número: sem ele, o CNPJ
// "12.345.678/0001-90" casaria a partir de "345.678/...".
const PROCESSO = /(?<![\d.])\d{3,6}\.\d[\d.-]*\/\d{4}-\d{2}/g;
// Depois do número, um "." só vale como ponto final de frase (seguido de espaço
// ou do fim do texto); "12345678.9", "12345678./" e "12345678.-" continuam fora.
const NUMERO_SEI = /(?<![\d./-])\d{6,10}(?![\d/-])(?!\.(?!\s|$))/g;
const LIMITE_OUTRO = 40;

export function extrairProtocolos(texto: string): ProtocoloReconhecido[] {
  const vistos = new Set<string>();
  const saida: ProtocoloReconhecido[] = [];
  const incluir = (p: ProtocoloReconhecido) => {
    if (vistos.has(p.texto)) return;
    vistos.add(p.texto);
    saida.push(p);
  };

  for (const linha of texto.split(/\r\n|\r|\n/)) {
    const achados: { indice: number; protocolo: ProtocoloReconhecido }[] = [];
    // Trechos de processo viram espaços para que seus dígitos não passem por nº SEI.
    const restante = linha.replace(PROCESSO, (m, indice: number) => {
      achados.push({ indice, protocolo: { texto: m, tipo: "processo" } });
      return " ".repeat(m.length);
    });
    for (const m of restante.matchAll(NUMERO_SEI)) {
      achados.push({ indice: m.index ?? 0, protocolo: { texto: m[0], tipo: "sei" } });
    }
    if (achados.length > 0) {
      achados.sort((a, b) => a.indice - b.indice);
      for (const a of achados) incluir(a.protocolo);
      continue;
    }
    const solta = linha.trim();
    if (solta && solta.length <= LIMITE_OUTRO && !/\s/.test(solta)) incluir({ texto: solta, tipo: "outro" });
  }
  return saida;
}
