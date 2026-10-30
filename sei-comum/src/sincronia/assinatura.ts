/**
 * Impressão digital de um conteúdo, igual em qualquer computador para o mesmo
 * dado: chaves do JSON em ordem, campos `undefined` fora. Quem chama põe as
 * listas em ordem (`porId`) e deixa de fora quem gravou e quando. Serve para
 * não regravar o que já está igual (Texto Padrão, arquivo).
 */

import { hashCurto } from "../texto";

export function jsonEstavel(v: unknown): string {
  if (Array.isArray(v)) return `[${v.map(jsonEstavel).join(",")}]`;
  if (v && typeof v === "object") {
    const o = v as Record<string, unknown>;
    return `{${Object.keys(o)
      .sort()
      .filter((k) => o[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${jsonEstavel(o[k])}`)
      .join(",")}}`;
  }
  return JSON.stringify(v);
}

/** Cópia ordenada pelo id (a lista original fica como estava). */
export function porId<T extends { id: string }>(lista: readonly T[]): T[] {
  return [...lista].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

/** Dois FNV-1a (o JSON e o JSON de trás para frente): 16 hexadecimais. */
export function assinaturaEstavel(v: unknown): string {
  const s = jsonEstavel(v);
  return `${hashCurto(s)}${hashCurto(s.split("").reverse().join(""))}`;
}
