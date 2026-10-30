/**
 * Link guardável e mostrável: só http(s) e nunca com infra_hash (o hash é da sessão; o resultado é guardado, copiado
 * e exportado). Qualquer outra coisa (`javascript:`, `data:`, valor que não é texto) vira "".
 */
export function linkSeguro(v: unknown): string {
  const s = typeof v === "string" ? v : "";
  if (!s || /infra_hash/i.test(s) || !/^https?:\/\//i.test(s)) return "";
  return s;
}
