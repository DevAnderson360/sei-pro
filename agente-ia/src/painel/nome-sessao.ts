/** Metadados locais; ausentes nos registros anteriores a esta funcionalidade. */
export interface NomeSessao {
  processo?: string;
  tituloOriginal?: string;
}

export function tituloSessao(primeiraMensagem?: string, nome: NomeSessao = {}): string {
  if (nome.tituloOriginal !== undefined) return nome.tituloOriginal;
  const texto = primeiraMensagem?.replace(/\s+/g, " ").trim() || "Conversa";
  if (!nome.processo || texto.startsWith(nome.processo)) return texto.slice(0, Math.max(70, nome.processo?.length ?? 0));
  return `${nome.processo} — ${texto.slice(0, 70)}`;
}

/** Somente resultados de leituras individuais; listagens gerais nao vinculam a sessao. */
export function processoDaLeitura(op: string, resultado: unknown): string | undefined {
  if (!["processo.consultar", "processo.arvore", "documento.ler"].includes(op)) return;
  if (!resultado || typeof resultado !== "object") return;
  const r = resultado as Record<string, unknown>;
  const valor = op === "documento.ler" ? r.processo : r.protocolo;
  return typeof valor === "string" && valor.trim() ? valor.trim() : undefined;
}
