/**
 * Codificação para guardar dados num campo de texto do SEI (Texto Padrão):
 * JSON → gzip (CompressionStream) → base64url, em parágrafos de 2.000
 * caracteres, depois de um parágrafo legível que avisa o que é aquilo.
 *
 * Base64url só tem `[A-Za-z0-9_-]`: passa pelo filtro de XSS do SEI, sobrevive
 * ao Latin-1 e ao escape duplo que o SEI 5 aplica na leitura (prova P1). Um
 * parágrafo com qualquer outra coisa depois do legível significa que alguém
 * editou o texto: a leitura devolve `null` e quem chamou trata como inválido.
 *
 * A volta tem teto no tamanho DESCOMPACTADO (`LIMITE_DESCOMPACTADO`): poucos KB
 * de gzip podem virar centenas de MB (o Texto Padrão da unidade é de todos e
 * pode ser editado à mão), e o `JSON.parse` disso travaria a aba.
 */

const BLOCO = 2000;

/** 8 MB de JSON: dezenas de vezes o que cabe num Texto Padrão de 100 KB comprimido. */
export const LIMITE_DESCOMPACTADO = 8 * 1024 * 1024;

/** O conteúdo descompactado passou do limite: quem lê trata como texto inválido. */
export class ErroConteudoGrande extends Error {
  constructor(limite: number) {
    super(`O conteúdo descompactado passa de ${Math.round(limite / 1024 / 1024)} MB.`);
    this.name = "ErroConteudoGrande";
  }
}

async function transformar(bytes: Uint8Array, t: CompressionStream | DecompressionStream): Promise<Uint8Array> {
  const saida = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(t);
  return new Uint8Array(await new Response(saida).arrayBuffer());
}

function paraBase64url(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function deBase64url(texto: string): Uint8Array {
  if (!/^[A-Za-z0-9_-]*$/.test(texto)) throw new Error("Conteúdo fora do formato base64url.");
  const b64 = texto
    .replace(/-/g, "+")
    .replace(/_/g, "/")
    .padEnd(Math.ceil(texto.length / 4) * 4, "=");
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

export async function codificar(valor: unknown): Promise<string> {
  const json = new TextEncoder().encode(JSON.stringify(valor));
  return paraBase64url(await transformar(json, new CompressionStream("gzip")));
}

/** Descompacta lendo aos pedaços e desiste (cancelando o fluxo) assim que passa de `limite` bytes. */
async function descompactar(bytes: Uint8Array, limite: number): Promise<Uint8Array> {
  const leitor = new Blob([bytes as Uint8Array<ArrayBuffer>]).stream().pipeThrough(new DecompressionStream("gzip")).getReader();
  const partes: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      await leitor.cancel().catch(() => undefined);
      throw new ErroConteudoGrande(limite);
    }
    partes.push(value);
  }
  const saida = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    saida.set(p, pos);
    pos += p.byteLength;
  }
  return saida;
}

export async function decodificar(texto: string, limite = LIMITE_DESCOMPACTADO): Promise<unknown> {
  const bytes = await descompactar(deBase64url(texto), limite);
  return JSON.parse(new TextDecoder().decode(bytes));
}

const escapar = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function paraParagrafos(legivel: string, b64: string, bloco = BLOCO): string {
  const partes = [`<p>${escapar(legivel)}</p>`];
  for (let i = 0; i < b64.length; i += bloco) partes.push(`<p>${b64.slice(i, i + bloco)}</p>`);
  return partes.join("\n");
}

/** Desfaz até dois níveis de escape do HTML (o SEI 5 devolve o conteúdo escapado mais uma vez). */
function desescapar(html: string): string {
  let s = html;
  for (let i = 0; i < 2 && /&lt;\s*\/?p[\s>&]/i.test(s); i++) {
    s = s
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&");
  }
  return s;
}

/** Os blocos depois do parágrafo legível, juntos; `null` se não houver ou se algum foi editado. */
export function deParagrafos(html: string): string | null {
  const paragrafos = [...desescapar(html).matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map((m) => (m[1] ?? "").trim());
  const blocos = paragrafos.slice(1);
  if (!blocos.length || !blocos.every((b) => /^[A-Za-z0-9_-]+$/.test(b))) return null;
  return blocos.join("");
}
