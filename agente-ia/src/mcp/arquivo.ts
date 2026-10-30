import type { Baixado } from "../painel/baixados";
import type { ContextoTool } from "../motor/tools";
import { hashArquivo } from "../seguranca/hash";

/** Os bytes ficam na ponte SEI -> conector, fora dos argumentos produzidos pela IA. */
export async function conteudoDoBaixado(b: Baixado, ctx: ContextoTool): Promise<string> {
  if (!b.sha256) throw new Error("Baixe o documento novamente para registrar o conteúdo aprovado antes de transferi-lo ao MCP.");
  const r = await ctx.sei<{
    numero: string; processo: string;
    arquivo?: { base64: string; tamanho: number };
  }>("documento.baixar", { numero: b.documento });
  // A operação já recusa documentos internos e sigilosos. Na resposta com
  // bytes ela não inclui `baixavel`, que só existe em somenteMetadados.
  if (r.numero !== b.documento || r.processo !== b.processo || !r.arquivo?.base64) {
    throw new Error("O documento não corresponde ao download aprovado. Baixe-o novamente.");
  }
  if (r.arquivo.base64.length > 4 * Math.ceil(25 * 1024 * 1024 / 3)) throw new Error("Arquivo acima do limite de 25 MB.");
  const bruto = atob(r.arquivo.base64);
  const bytes = Uint8Array.from(bruto, (c) => c.charCodeAt(0));
  if (bytes.length > 25 * 1024 * 1024 || bytes.length !== b.tamanho || await hashArquivo(bytes) !== b.sha256) {
    throw new Error("O conteúdo do documento mudou desde o download aprovado. Baixe-o novamente antes de anexar.");
  }
  return r.arquivo.base64;
}
