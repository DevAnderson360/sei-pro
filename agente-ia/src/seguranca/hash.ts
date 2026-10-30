/** SHA-256 em hexadecimal: identidade do arquivo aprovado num download (ver `tools/baixar.ts`). */
export async function hashArquivo(bytes: Uint8Array): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes as BufferSource);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
