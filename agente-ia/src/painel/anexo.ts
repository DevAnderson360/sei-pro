/**
 * Regras do anexo do chat (PDF e texto), sem navegador.
 *
 * O PDF nunca vai ao serviço de IA: o painel lê o arquivo neste computador e
 * manda só o texto. Aqui ficam as decisões que não dependem do pdf.js:
 * - quais páginas vão ao OCR (só as digitalizadas, até o teto da biblioteca);
 * - quando avisar que o OCR vai pesar (mais de 20 páginas digitalizadas — ler
 *   a camada de texto de um PDF digital é rápido mesmo com 200 páginas);
 * - como o texto é montado, marcando o que veio do OCR e o que ficou sem ler;
 * - o tamanho: vai inteiro por padrão, com teto duro, e a pessoa pode cortar.
 *   O corte acontece no fim de uma página e diz até onde o modelo leu.
 */

import { MAX_PAGINAS_OCR } from "@/lib/ferramentas/tesseract";

export { MAX_PAGINAS_OCR };

/** Acima disto, o painel avisa que o OCR pode deixar o computador lento. */
export const PAGINAS_AVISO_OCR = 20;
/** O "Cortar" do chip: o tamanho que o anexo tinha antes de aceitar PDF. */
export const LIMITE_CORTE = 60_000;
/**
 * Teto duro, mesmo "inteiro": metade do histórico que o motor mantém
 * (`LIMITE_HISTORICO`, 400 mil caracteres), para sobrar conversa.
 */
export const TETO_ANEXO = 200_000;

export interface PaginaLida {
  n: number;
  texto: string;
  /** O texto veio do OCR (página digitalizada). */
  ocr?: boolean;
}

export interface PlanoLeitura {
  total: number;
  comTexto: number[];
  /** Digitalizadas que o OCR vai ler. */
  paraOcr: number[];
  /** Digitalizadas além do teto do OCR: ficam sem leitura. */
  foraDoOcr: number[];
  avisar: boolean;
}

export function planejarLeitura(total: number, temTexto: (n: number) => boolean): PlanoLeitura {
  const comTexto: number[] = [];
  const paraOcr: number[] = [];
  const foraDoOcr: number[] = [];
  for (let n = 1; n <= total; n += 1) {
    if (temTexto(n)) comTexto.push(n);
    // O `ocrPdf` conta pela posição da página, não pelas digitalizadas.
    else if (n <= MAX_PAGINAS_OCR) paraOcr.push(n);
    else foraDoOcr.push(n);
  }
  return { total, comTexto, paraOcr, foraDoOcr, avisar: paraOcr.length > PAGINAS_AVISO_OCR };
}

/**
 * A página tem camada de texto? O MESMO critério do `ocrPdf` (algum trecho com
 * mais de 2 caracteres): se os dois discordassem, uma página digitalizada que
 * só traz o número da página seria tratada aqui como "com texto" e o OCR dela
 * seria jogado fora.
 */
export function temCamadaDeTexto(itens: Array<{ str?: unknown }>): boolean {
  return itens.some((it) => typeof it.str === "string" && it.str.trim().length > 2);
}

/** [3, 4, 5, 7] → "3–5, 7" */
export function faixas(ns: number[]): string {
  const ordenadas = [...new Set(ns)].sort((a, b) => a - b);
  const partes: string[] = [];
  for (let i = 0; i < ordenadas.length; ) {
    let j = i;
    while (j + 1 < ordenadas.length && ordenadas[j + 1] === ordenadas[j] + 1) j += 1;
    partes.push(j > i ? `${ordenadas[i]}–${ordenadas[j]}` : String(ordenadas[i]));
    i = j + 1;
  }
  return partes.join(", ");
}

export function montarTexto(paginas: PaginaLida[], extra: { total: number; naoLidas: number[]; semOcr?: boolean; motivo?: string }): string {
  const ocr = paginas.filter((p) => p.ocr).length;
  const partes: string[] = [];
  if (ocr) partes.push(`[texto de ${ocr} página(s) obtido por OCR; pode conter erros de reconhecimento]`);
  for (const p of [...paginas].sort((a, b) => a.n - b.n)) partes.push(`[página ${p.n}${p.ocr ? " — OCR" : ""}]\n${p.texto}`);
  if (extra.naoLidas.length) {
    const motivo = extra.motivo ?? (extra.semOcr ? "este navegador não faz OCR" : "");
    partes.push(`[páginas não lidas: ${faixas(extra.naoLidas)}${motivo ? ` (${motivo})` : ""}]`);
  }
  return partes.join("\n\n");
}

export type ModoAnexo = "inteiro" | "cortado";

export interface Anexo {
  nome: string;
  texto: string;
  /** Páginas do PDF (ausente no anexo de texto). */
  paginas?: number;
  modo: ModoAnexo;
  /** Páginas que ficaram sem leitura (digitalizadas sem OCR, além dos tetos). */
  naoLidas?: number[];
  motivoNaoLidas?: string;
}

const milhar = (n: number) => n.toLocaleString("pt-BR");

/** Corta em `limite`, no fim da última página que cabe inteira, e diz até onde. */
function cortar(a: Anexo, limite: number): string {
  const marca = /\[página (\d+)(?: — OCR)?\]\n/g;
  const inicios: Array<{ n: number; em: number }> = [];
  for (let m = marca.exec(a.texto); m; m = marca.exec(a.texto)) inicios.push({ n: Number(m[1]), em: m.index });
  // A página k cabe inteira quando a seguinte começa dentro do limite.
  let ultima = -1;
  for (let k = 0; k < inicios.length; k += 1) {
    const fim = k + 1 < inicios.length ? inicios[k + 1].em : a.texto.length;
    if (fim <= limite) ultima = k;
    else break;
  }
  if (ultima >= 0) {
    const fim = ultima + 1 < inicios.length ? inicios[ultima + 1].em : a.texto.length;
    const total = a.paginas ?? inicios[inicios.length - 1].n;
    return `${a.texto.slice(0, fim).trimEnd()}\n\n[o modelo leu até a página ${inicios[ultima].n} de ${total}]`;
  }
  return `${a.texto.slice(0, limite)}\n\n[o modelo leu ${milhar(limite)} de ${milhar(a.texto.length)} caracteres]`;
}

export function aplicarModo(a: Anexo): { texto: string; aviso?: string; podeCortar: boolean } {
  const limite = a.modo === "cortado" ? LIMITE_CORTE : TETO_ANEXO;
  if (a.texto.length <= limite) {
    const grande = a.texto.length > LIMITE_CORTE;
    return {
      texto: a.texto,
      podeCortar: grande,
      ...(grande
        ? {
            aviso: `${Math.round(a.texto.length / 1000)} mil caracteres (cerca de ${Math.round(a.texto.length / 4000)} mil tokens): o texto vai junto em cada resposta desta conversa.`,
          }
        : {}),
    };
  }
  const texto = cortar(a, limite);
  const ate = /\[o modelo leu ([^\]]+)\]$/.exec(texto)?.[1] ?? "";
  return {
    texto,
    podeCortar: a.modo === "inteiro",
    aviso: a.modo === "cortado" ? `Cortado: o modelo leu ${ate}.` : `Grande demais para uma conversa: o modelo leu ${ate}.`,
  };
}

export function mensagemDeErroPdf(e: unknown): string {
  const nome = (e as { name?: string } | null)?.name;
  if (nome === "PasswordException") return "Este PDF é protegido por senha.";
  if (nome === "OperacaoCancelada") return "Leitura cancelada.";
  return "Não foi possível ler este PDF (protegido por senha ou danificado).";
}
