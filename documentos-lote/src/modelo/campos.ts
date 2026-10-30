import { paraLatin1 } from "@comum/texto/latin1";
import { MAX_DESCRICAO } from "@dl/modelo/constantes";

const CAMPO = /##([^#]+?)##/g;

/** Nomes únicos entre `##…##` (sem os `#`), na ordem de aparição. O espaço não separável conta como espaço. */
export function extrairCampos(html: string): string[] {
  const vistos: string[] = [];
  for (const m of html.replace(/\u00A0/g, " ").matchAll(CAMPO)) {
    const nome = m[1] as string;
    if (!vistos.includes(nome)) vistos.push(nome);
  }
  return vistos;
}

/** Troca `##col##` pelo valor quando a coluna existe na linha; sem coluna, deixa o trecho literal (legado). */
export function preencherTexto(texto: string, linha: Record<string, string>, escapar: (v: string) => string = (v) => v): string {
  return texto.replace(CAMPO, (trecho, nome: string) => (Object.hasOwn(linha, nome) ? escapar(linha[nome] as string) : trecho));
}

/** Escapa `& < > " '` para entidades HTML, mantendo os acentos. */
export function escaparValor(v: string): string {
  return v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Descrição do documento: campos trocados, latin-1, no máximo 250 caracteres. */
export function descricaoDoc(modelo: string, linha: Record<string, string>): string {
  return paraLatin1(preencherTexto(modelo, linha)).slice(0, MAX_DESCRICAO).trim();
}
