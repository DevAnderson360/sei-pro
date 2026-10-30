/**
 * Texto de PDF, no painel (página da extensão).
 *
 * Reaproveita o carregador do pdf.js das Ferramentas de PDF — mesmo worker
 * empacotado em `vendor/ferramentas-pdf/pdfjs/`, mesmas travas de segurança
 * (sem scripting e sem `eval` do documento). O pdf.js entra em chunk separado,
 * carregado só quando o agente lê o primeiro PDF.
 *
 * PDF digitalizado passa pelo OCR das Ferramentas de PDF (ver `extrairTextoPdf`
 * e, para o anexo do chat, `lerPdfParaAnexo`).
 */

import { MAX_PAGINAS_OCR, montarTexto, planejarLeitura, temCamadaDeTexto, type PaginaLida, type PlanoLeitura } from "./anexo";

const LIMITE_PAGINAS = 200;
/**
 * Páginas que o agente manda ao OCR. Cada uma custa segundos de CPU no painel,
 * que trava enquanto reconhece; o usuário não pediu o OCR, ele só pediu para
 * ler o documento. Precisando do resto, existem as Ferramentas de PDF.
 */
const PAGINAS_OCR = 5;
const SEM_TEXTO = "[PDF sem camada de texto (digitalizado).]";

interface DocPdf {
  numPages: number;
  getPage(n: number): Promise<{ getTextContent(): Promise<{ items: unknown[] }> }>;
}

/** Abre o PDF no pdf.js e entrega o documento a `corpo`, destruindo a tarefa no fim. */
async function comPdf<T>(bytes: Uint8Array, corpo: (doc: DocPdf) => Promise<T>): Promise<T> {
  const { carregarPdfJs, opcoesDocumento } = await import("@/lib/ferramentas/pdfjs");
  const pdfjs = await carregarPdfJs();
  // Cópia: o pdf.js TRANSFERE o buffer para o worker, e o original ficaria
  // "destacado" (inutilizável) para o OCR que pode vir depois.
  const tarefa = pdfjs.getDocument(opcoesDocumento(bytes.slice()));
  const doc = (await tarefa.promise) as unknown as DocPdf;
  try {
    return await corpo(doc);
  } finally {
    await tarefa.destroy();
  }
}

/** Mesmo `name` da `OperacaoCancelada` das Ferramentas de PDF: `mensagemDeErroPdf` reconhece as duas. */
class LeituraCancelada extends Error {
  constructor() {
    super("Operação cancelada");
    this.name = "OperacaoCancelada";
  }
}

/** Camada de texto das páginas `1..ate` (sem OCR); página digitalizada vem com texto vazio. */
async function paginasDeTexto(doc: DocPdf, ate: number, aoLer?: (n: number) => void, cancelado?: () => boolean): Promise<Array<PaginaLida & { camada: boolean }>> {
  const paginas: Array<PaginaLida & { camada: boolean }> = [];
  for (let n = 1; n <= ate; n += 1) {
    if (cancelado?.()) throw new LeituraCancelada();
    const conteudo = await (await doc.getPage(n)).getTextContent();
    let linha = "";
    const linhas: string[] = [];
    for (const item of conteudo.items as Array<{ str?: string; hasEOL?: boolean }>) {
      linha += item.str ?? "";
      if (item.hasEOL) {
        linhas.push(linha);
        linha = "";
      }
    }
    if (linha) linhas.push(linha);
    paginas.push({ n, texto: linhas.join("\n").replace(/[ \t]+/g, " ").trim(), camada: temCamadaDeTexto(conteudo.items as Array<{ str?: unknown }>) });
    aoLer?.(n);
  }
  return paginas;
}

/** Texto das páginas pela camada de texto do PDF (sem OCR). */
async function textoDoPdf(bytes: Uint8Array): Promise<string> {
  return comPdf(bytes, async (doc) => {
    const total = Math.min(doc.numPages, LIMITE_PAGINAS);
    const partes = (await paginasDeTexto(doc, total)).map((p) => `[página ${p.n}]\n${p.texto}`);
    if (doc.numPages > total) partes.push(`[... ${doc.numPages - total} páginas não lidas]`);
    const texto = partes.join("\n\n");
    return texto.replace(/\[página \d+\]\n?/g, "").trim() ? texto : SEM_TEXTO;
  });
}

/**
 * Texto de um PDF. Sem camada de texto (digitalizado), roda o OCR das
 * Ferramentas de PDF — que devolve um PDF pesquisável — e lê o texto dele.
 * Reaproveita o Tesseract já empacotado (`vendor/ferramentas-pdf/tesseract/`),
 * com o modelo de português, sem nada novo no pacote.
 */
export async function extrairTextoPdf(base64: string, o: { ocr?: boolean } = {}): Promise<string> {
  const bruto = atob(base64);
  const bytes = new Uint8Array(bruto.length);
  for (let i = 0; i < bruto.length; i += 1) bytes[i] = bruto.charCodeAt(i);
  const texto = await textoDoPdf(bytes);
  if (texto !== SEM_TEXTO || o.ocr === false) return texto;
  const { ocrPdf, ocrDisponivel } = await import("@/lib/ferramentas/ocr");
  if (!ocrDisponivel()) return `${SEM_TEXTO} Este navegador não suporta o OCR local.`;
  const r = await ocrPdf({ id: "agente", nome: "documento.pdf", tamanho: bytes.length, bytes }, { paginas: PAGINAS_OCR });
  if (r.semTexto) return `${SEM_TEXTO} O OCR não reconheceu texto.`;
  const resto = r.totalPaginas > r.paginasProcessadas ? ` de ${r.totalPaginas}; as demais não foram lidas` : "";
  return `[texto obtido por OCR de ${r.paginasProcessadas} página(s)${resto}; pode conter erros de reconhecimento]\n\n${await textoDoPdf(r.bytes)}`;
}

// ------------------------------------------------------------ anexo do chat

export interface EtapaLeitura {
  fase: "abrindo" | "texto" | "ocr";
  feitas: number;
  total: number;
}

export interface OpcoesAnexoPdf {
  aoProgredir?: (e: EtapaLeitura) => void;
  cancelado?: () => boolean;
  /** Chamado com o plano antes do OCR quando ele vai pesar; devolver false cancela. */
  confirmarOcr?: (p: PlanoLeitura) => Promise<boolean>;
}

export interface PdfLido {
  texto: string;
  paginas: number;
  /** Páginas que ficaram sem leitura, e por quê (para o chip). */
  naoLidas: number[];
  motivoNaoLidas?: string;
}

/**
 * Texto de um PDF anexado ao chat. Diferente da leitura de documento do SEI
 * (`extrairTextoPdf`), aqui a pessoa escolheu o arquivo: o OCR roda em todas
 * as páginas digitalizadas (até o teto da biblioteca), com aviso antes quando
 * forem mais de 20, e só nelas — num PDF misto, as páginas com texto não
 * passam pelo OCR. Cancelar descarta tudo.
 */
export async function lerPdfParaAnexo(bytes: Uint8Array, o: OpcoesAnexoPdf = {}): Promise<PdfLido> {
  o.aoProgredir?.({ fase: "abrindo", feitas: 0, total: 0 });
  const { total, lidas } = await comPdf(bytes, async (doc) => {
    const ate = Math.min(doc.numPages, LIMITE_PAGINAS);
    const lidas = await paginasDeTexto(doc, ate, (n) => o.aoProgredir?.({ fase: "texto", feitas: n, total: ate }), o.cancelado);
    return { total: doc.numPages, lidas };
  });
  const alemDoLimite = Array.from({ length: Math.max(0, total - LIMITE_PAGINAS) }, (_, i) => LIMITE_PAGINAS + 1 + i);
  const plano = planejarLeitura(lidas.length, (n) => Boolean(lidas[n - 1]?.camada));
  const pronto = (paginas: PaginaLida[], naoLidas: number[], motivo?: string): PdfLido => ({
    texto: montarTexto(paginas, { total, naoLidas, motivo }),
    paginas: total,
    naoLidas,
    ...(motivo ? { motivoNaoLidas: motivo } : {}),
  });
  const alemDosTetos = plano.foraDoOcr.length || alemDoLimite.length ? "acima do limite de leitura" : undefined;
  if (!plano.paraOcr.length && !plano.foraDoOcr.length) return pronto(lidas, alemDoLimite, alemDosTetos);

  const comTexto = lidas.filter((p) => p.camada);
  const { ocrPdf, ocrDisponivel } = await import("@/lib/ferramentas/ocr");
  if (!ocrDisponivel()) return pronto(comTexto, [...plano.paraOcr, ...plano.foraDoOcr, ...alemDoLimite], "este navegador não faz OCR");
  if (plano.avisar && o.confirmarOcr && !(await o.confirmarOcr(plano))) throw new LeituraCancelada();
  if (o.cancelado?.()) throw new LeituraCancelada();
  let r: Awaited<ReturnType<typeof ocrPdf>>;
  try {
    r = await ocrPdf(
      { id: "anexo", nome: "anexo.pdf", tamanho: bytes.length, bytes },
      {
        paginas: MAX_PAGINAS_OCR,
        // O `ocrPdf` conta todas as páginas (inclusive as que pula); o andamento mostra só as digitalizadas.
        aoProgredir: (feitas) => o.aoProgredir?.({ fase: "ocr", feitas: plano.paraOcr.filter((n) => n <= feitas).length, total: plano.paraOcr.length }),
        cancelado: o.cancelado,
      },
    );
  } catch (e) {
    if ((e as { name?: string } | null)?.name === "OperacaoCancelada" || o.cancelado?.()) throw e;
    // O OCR falhou (worker que não carrega, navegador sem suporte): as páginas
    // com texto continuam valendo, e o chip diz quais ficaram de fora.
    return pronto(comTexto, [...plano.paraOcr, ...plano.foraDoOcr, ...alemDoLimite], "o OCR falhou neste navegador");
  }
  const reconhecidas = await comPdf(r.bytes, (doc) => paginasDeTexto(doc, Math.min(doc.numPages, MAX_PAGINAS_OCR)));
  const paginas: PaginaLida[] = [...comTexto];
  const semLeitura: number[] = [];
  for (const n of plano.paraOcr) {
    const texto = reconhecidas[n - 1]?.texto ?? "";
    if (texto) paginas.push({ n, texto, ocr: true });
    else semLeitura.push(n);
  }
  const naoLidas = [...semLeitura, ...plano.foraDoOcr, ...alemDoLimite];
  return pronto(paginas, naoLidas, semLeitura.length ? "o OCR não reconheceu texto em parte delas" : alemDosTetos);
}
