/** Filtros e atalhos da seleção inteligente. Funções puras. */

import { normalizarTexto } from "@comum/texto";
import type { ContextoAcoes } from "../pagina/contexto";
import type { LinhaDoc } from "./documentos";

export interface Filtro {
  texto?: string;
  tipos?: string[];
  unidades?: string[];
  assinatura?: "todos" | "assinados" | "nao-assinados";
  nivel?: "todos" | "publico" | "restrito";
  origem?: "todos" | "internos" | "externos";
  /** Datas ISO (aaaa-mm-dd), comparadas como texto. */
  de?: string;
  ate?: string;
}

const norm = normalizarTexto;

export function filtrar(linhas: LinhaDoc[], f: Filtro): LinhaDoc[] {
  const texto = f.texto ? norm(f.texto) : "";
  const tipos = f.tipos?.length ? new Set(f.tipos.map(norm)) : null;
  const unidades = f.unidades?.length ? new Set(f.unidades.map(norm)) : null;
  return linhas.filter((l) => {
    if (texto && !norm(`${l.numero} ${l.titulo} ${l.tipo}`).includes(texto)) return false;
    if (tipos && !tipos.has(norm(l.tipo))) return false;
    if (unidades && !unidades.has(norm(l.unidade))) return false;
    if (f.assinatura === "assinados" && !l.assinado) return false;
    if (f.assinatura === "nao-assinados" && l.assinado) return false;
    if (f.nivel === "publico" && l.nivel !== "publico") return false;
    if (f.nivel === "restrito" && l.nivel !== "restrito") return false;
    if (f.origem === "internos" && l.externo) return false;
    if (f.origem === "externos" && !l.externo) return false;
    if (f.de || f.ate) {
      // Quem não tem data não pode ser honestamente filtrado por período: fica de fora.
      if (!l.data) return false;
      if (f.de && l.data < f.de) return false;
      if (f.ate && l.data > f.ate) return false;
    }
    return true;
  });
}

export type Atalho = "nao-assinados-minha-unidade" | "assinados-por-mim" | "externos";

/** Devolve os ids que o atalho marca. */
export function aplicarAtalho(a: Atalho, linhas: LinhaDoc[], ctx: Pick<ContextoAcoes, "unidadeSigla" | "nomeUsuario">): string[] {
  const unidade = norm(ctx.unidadeSigla);
  const nome = norm(ctx.nomeUsuario);
  switch (a) {
    case "nao-assinados-minha-unidade":
      return linhas.filter((l) => !l.assinado && !l.externo && !!unidade && norm(l.unidade) === unidade).map((l) => l.id);
    case "assinados-por-mim":
      // Nome inteiro (texto antes do primeiro " - "), nunca por inclusão: "Ana Silva" não é "Mariana Silva".
      return linhas.filter((l) => !!nome && l.assinaturas.some((s) => norm(s.split(" - ")[0] ?? s) === nome)).map((l) => l.id);
    case "externos":
      return linhas.filter((l) => l.externo).map((l) => l.id);
  }
}
