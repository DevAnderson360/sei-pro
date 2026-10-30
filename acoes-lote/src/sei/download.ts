/**
 * Downloads das Ações em Lote. Tudo na aba, com a sessão da aba: os bytes vêm do SEI para esta janela e saem por um
 * `<a download>` com blob URL. Nada passa pelo app nem por servidor.
 */
import { h } from "@comum/ui/dom";
import { zipSync } from "fflate";

const MAX_NOME = 120;
/** Caracteres que o sistema de arquivos recusa. */
const PROIBIDOS = /[\\/:*?"<>|]/g;

function limpar(s: string): string {
  return [...s]
    .map((ch) => (ch.charCodeAt(0) < 32 ? " " : ch))
    .join("")
    .replace(PROIBIDOS, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * `<numero> - <titulo>` sem `\ / : * ? " < > |`, no máximo 120 caracteres contando a extensão (que nunca é cortada).
 * `ext` vem com ou sem ponto.
 */
export function nomeArquivo(numero: string, titulo: string, ext = ""): string {
  const e = ext ? `.${limpar(ext.replace(/^\./, "")).replace(/\s/g, "")}` : "";
  const base = limpar([limpar(numero), limpar(titulo)].filter(Boolean).join(" - ")) || "documento";
  const corte = Math.max(1, MAX_NOME - e.length);
  // Por pontos de código: cortar no meio de um par substituto deixaria meio emoji no nome.
  return `${[...base].slice(0, corte).join("").trim()}${e}`;
}

/** Extensão do nome devolvido pelo SEI (ou "" se não tiver). */
export function extensaoDe(nome: string): string {
  const m = /\.([A-Za-z0-9]{1,8})$/.exec(nome.trim());
  return m ? m[1].toLowerCase() : "";
}

/**
 * HTML de documento interno em bytes UTF-8, declarando UTF-8. O SEI serve em ISO-8859-1 e declara isso no
 * `<meta>` (e às vezes no `<?xml?>`); o texto aqui já foi decodificado, então gravar em UTF-8 com a declaração
 * antiga quebrava os acentos ao abrir o arquivo ("versÃ£o"). Sem declaração e com `<head>`, ganha uma.
 */
export function htmlEmUtf8(html: string): Uint8Array {
  let declarou = false;
  let t = html
    .replace(/(<\?xml\b[^>]*?\bencoding\s*=\s*["'])[\w.:-]+/i, (_, a: string) => `${a}utf-8`)
    .replace(/(<meta\b[^>]*?\bcharset\s*=\s*["']?)[\w.:-]+/gi, (_, a: string) => {
      declarou = true;
      return `${a}utf-8`;
    });
  if (!declarou) t = t.replace(/<head\b[^>]*>/i, (m) => `${m}<meta charset="utf-8">`);
  return new TextEncoder().encode(t);
}

/** Dispara o download de `bytes` no documento (a aba do SEI, janela de cima). */
export function baixarBytes(bytes: Uint8Array, nome: string, tipo = "application/octet-stream"): void {
  const url = URL.createObjectURL(new Blob([bytes as BlobPart], { type: tipo }));
  const a = h("a", { href: url, download: nome, style: "display:none" });
  document.body.append(a);
  a.click();
  a.remove();
  // O navegador já enfileirou o download; soltar o blob logo cortaria arquivos grandes.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}

/** Arquivos esperando o ZIP, só na memória desta aba. Nomes repetidos ganham " (2)", " (3)"... antes da extensão. */
export class AcumuladorZip {
  private readonly arquivos = new Map<string, Uint8Array>();

  get tamanho(): number {
    return this.arquivos.size;
  }

  adicionar(nome: string, bytes: Uint8Array): string {
    let final = nome;
    for (let n = 2; this.arquivos.has(final); n++) {
      const ponto = nome.lastIndexOf(".");
      final = ponto > 0 ? `${nome.slice(0, ponto)} (${n})${nome.slice(ponto)}` : `${nome} (${n})`;
    }
    this.arquivos.set(final, bytes);
    return final;
  }

  /** Monta o ZIP e esvazia o acumulador (mesmo se não houver nada: devolve null). */
  fechar(): Uint8Array | null {
    if (!this.arquivos.size) return null;
    const dados: Record<string, Uint8Array> = {};
    for (const [n, b] of this.arquivos) dados[n] = b;
    this.arquivos.clear();
    return zipSync(dados);
  }

  descartar(): void {
    this.arquivos.clear();
  }
}
