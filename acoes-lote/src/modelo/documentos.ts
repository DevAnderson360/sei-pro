/** Linhas da tabela de documentos e a elegibilidade estática de cada ação. Funções puras, sem DOM. */

import type { Arvore, NivelAcesso } from "@nucleo/dominio/arvore";
import { ACOES, type AcaoId } from "./acoes";

export interface LinhaDoc {
  id: string;
  numero: string;
  titulo: string;
  /** O tipo tirado do título (a árvore não traz a série): ver `tiposDosTitulos`. */
  tipo: string;
  externo: boolean;
  formato: string;
  nivel: NivelAcesso;
  assinado: boolean;
  assinaturas: string[];
  cancelado: boolean;
  /** Unidade geradora. */
  unidade: string;
  pasta: string | null;
  /** A árvore não traz a data; a prévia (Task 6) a preenche. */
  data?: string;
}

const palavras = (s: string): string[] => s.trim().split(/\s+/).filter(Boolean);

/**
 * Tipo pelo corte no primeiro token com dígito ("Autorização 01 para…" -> "Autorização", "Laudo teste B1.3" ->
 * "Laudo teste"); null quando o título não tem token com dígito (ou começa por um).
 */
function tipoPorDigito(titulo: string): string | null {
  const p = palavras(titulo);
  const i = p.findIndex((t) => /\d/.test(t));
  return i > 0 ? p.slice(0, i).join(" ") : null;
}

/**
 * Tipo do documento a partir do título. A árvore do SEI não traz a série, e o título é "tipo + número" ou
 * "tipo + nome na árvore" ("Despacho Maria Souza"). Com dígito, corta nele; sem dígito, o maior tipo de
 * `conhecidos` que seja prefixo por palavra; senão, a primeira palavra.
 */
export function tipoDoTitulo(titulo: string, conhecidos: ReadonlySet<string> = new Set()): string {
  const porDigito = tipoPorDigito(titulo);
  if (porDigito) return porDigito;
  const p = palavras(titulo);
  if (!p.length) return titulo.trim();
  const t = p.join(" ");
  let melhor = "";
  for (const k of conhecidos) if ((t === k || t.startsWith(`${k} `)) && k.length > melhor.length) melhor = k;
  return melhor || p[0]!;
}

/** Uma passada sobre todos os títulos: os tipos obtidos pelo dígito servem de dicionário para os demais. */
export function tiposDosTitulos(titulos: readonly string[]): string[] {
  const conhecidos = new Set<string>();
  for (const t of titulos) {
    const k = tipoPorDigito(t);
    if (k) conhecidos.add(k);
  }
  return titulos.map((t) => tipoDoTitulo(t, conhecidos));
}

export function linhasDaArvore(a: Arvore): LinhaDoc[] {
  const tipos = tiposDosTitulos(a.documentos.map((d) => d.titulo));
  return a.documentos.map((d, i) => ({
    id: d.id,
    numero: d.numero,
    titulo: d.titulo,
    tipo: tipos[i]!,
    externo: d.externo,
    formato: d.formato,
    nivel: d.nivel,
    assinado: d.assinado,
    assinaturas: d.assinaturas,
    cancelado: d.cancelado,
    unidade: d.unidadeGeradora ?? "",
    pasta: d.pasta,
  }));
}

export type Elegibilidade = { ok: true } | { ok: false; motivo: string };

export const MOTIVO_SIGILOSO = "Sigiloso: fora das Ações em Lote";

/** Parte estática da elegibilidade; o resto o SEI decide na prévia. Ordem: sigiloso, cancelado, regra da ação. */
export function elegivel(acao: AcaoId, l: LinhaDoc, processoSigiloso: boolean): Elegibilidade {
  if (processoSigiloso || l.nivel === "sigiloso") return { ok: false, motivo: MOTIVO_SIGILOSO };
  if (l.cancelado && acao !== "baixar") return { ok: false, motivo: "Documento cancelado" };
  if (acao === "duplicar" && l.externo) return { ok: false, motivo: "Só documento interno pode ser duplicado" };
  if (acao === "cancelar-assinatura" && !l.assinado) return { ok: false, motivo: "Documento sem assinatura" };
  if (acao === "assinar" && l.externo) return { ok: false, motivo: "Documento externo não se assina no SEI" };
  return { ok: true };
}

export function contarPorAcao(sel: LinhaDoc[], processoSigiloso: boolean): Record<AcaoId, number> {
  const r = {} as Record<AcaoId, number>;
  for (const { id } of ACOES) r[id] = sel.filter((l) => elegivel(id, l, processoSigiloso).ok).length;
  return r;
}
