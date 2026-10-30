/**
 * Conferência do número SEI de um documento (diálogo da etapa e "Informar
 * documento"): a pesquisa rápida do cabeçalho leva à tela de trabalho do
 * processo onde o documento está, e o título dessa tela traz o protocolo. A
 * resposta vem por requisição (o navegador não carrega o iframe da árvore que
 * ela traz), então a árvore não é montada e nada se marca como recebido.
 */

import { parametros } from "@nucleo/links/links";
import { decodificarEntidades } from "@nucleo/sessao/dom";
import type { Pagina } from "@nucleo/sessao/http";
import type { DocumentoConferido } from "../ponte/tipos";

/** Número SEI com mais dígitos que isso não existe: nem pesquisa. */
const MAX_DIGITOS = 20;

export async function conferirDocumento(pesquisar: (ref: string) => Promise<Pagina>, numero: string): Promise<DocumentoConferido | null> {
  const n = numero.replace(/\D/g, "");
  if (!n || n.length > MAX_DIGITOS) return null;
  let p: Pagina;
  try {
    p = await pesquisar(n);
  } catch (e) {
    if ((e as { codigo?: unknown }).codigo === "SEI_NAO_ENCONTRADO") return null;
    throw e;
  }
  const q = parametros(p.url);
  // Sem processo aberto (resultado da pesquisa, acesso negado): não é um documento que o usuário alcança.
  if (q.get("acao") !== "procedimento_trabalhar") return null;
  const arvore = decodificarEntidades(p.doc.querySelector("#ifrArvore")?.getAttribute("src") ?? "");
  const idProcedimento = parametros(arvore).get("id_procedimento") ?? "";
  const idProtocolo = q.get("id_protocolo") ?? "";
  // O mesmo id do processo: o número digitado é do processo, não de um documento.
  if (!idProtocolo || idProtocolo === idProcedimento) return null;
  const protocolo = /^SEI\s*-\s*(.+)$/.exec(p.doc.querySelector("title")?.textContent?.trim() ?? "")?.[1]?.trim();
  return protocolo ? { numero: n, protocolo } : { numero: n };
}
