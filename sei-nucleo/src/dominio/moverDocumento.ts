/**
 * Mover documento para outro processo (tela "Mover Documento", `documento_mover`).
 *
 * Tela do SEI 5 (`sei/web/documento_mover.php`): formulário `#frmDocumentoMover`
 * com `txtProcedimentoDestino`, `hdnIdProcedimentoDestino`, `txaMotivo` e o
 * botão `sbmMover`. O id do processo destino não se digita: a tela o descobre
 * pelo AJAX `protocolo_RI1023` (`infraAjaxComplementar`), que recebe
 * `idProcedimento=<protocolo digitado>` e responde
 *
 *   <complementos>
 *     <complemento nome="IdProcedimento">...</complemento>
 *     <complemento nome="ProtocoloProcedimentoFormatado">...</complemento>
 *     <complemento nome="NomeTipoProcedimento">...</complemento>
 *   </complementos>
 *
 * ou `<erros><erro descricao="Processo não encontrado."/></erros>`. Só acha
 * processo a que o usuário tem acesso (`ProcedimentoINT::pesquisarDigitadoRI1023`).
 *
 * Sucesso: o SEI redireciona para `acao_origem=documento_mover&resultado=1`.
 */

import { localizarDocumento, type DocumentoLocalizado } from "./documento";
import type { OpcoesEscrita, ResultadoEscrita } from "./escrita";
import { Formulario } from "../formulario/formulario";
import { linkDaAcao, parametros } from "../links/links";
import { decodificarEntidades } from "../sessao/dom";
import { ErroSei } from "../sessao/erros";
import type { Sei } from "../sei";

export interface ProcessoDestino {
  idProcedimento: string;
  protocolo: string;
  tipo: string;
}

async function documentoMovel(sei: Sei, numero: string, sinal?: AbortSignal): Promise<{ d: DocumentoLocalizado; link: string }> {
  const d = await localizarDocumento(sei, numero, { sinal });
  if (d.documento.nivel === "sigiloso" || d.arvore.nivel === "sigiloso") throw new ErroSei("SEI_SIGILOSO", "Documento sigiloso: o agente n\u00E3o atua nele.");
  const link = linkDaAcao(d.documento.acoes, "documento_mover");
  if (!link) {
    throw new ErroSei(
      "SEI_ACAO_INDISPONIVEL",
      `O SEI n\u00E3o oferece mover o documento ${d.documento.numero} para voc\u00EA (documento de outra unidade, assinado, ou processo fechado).`,
    );
  }
  return { d, link };
}

/** Desfaz o `formatarXMLAjax` do servidor e o `infraRemoverFormatacaoXML` do cliente (`&` vira `&amp;`, `<` vira `&amp;lt;`). */
function textoDoXml(s: string): string {
  return decodificarEntidades(decodificarEntidades(s)).trim();
}

/** Resposta do `infraAjaxComplementar`: `<complemento nome="X">valor</complemento>`, ou `<erro descricao="...">`. */
export function lerComplementos(xml: string): Record<string, string> {
  const erro = /<erro\s+descricao="([^"]*)"/.exec(xml);
  if (erro) {
    const msg = textoDoXml(erro[1]).replace(/\\n/g, "\n");
    throw new ErroSei(/n\u00E3o encontrad/i.test(msg) ? "SEI_NAO_ENCONTRADO" : "SEI_VALIDACAO", msg, msg);
  }
  const saida: Record<string, string> = {};
  for (const m of xml.matchAll(/<complemento\s+nome="([^"]+)"\s*>([\s\S]*?)<\/complemento>/g)) saida[m[1]] = textoDoXml(m[2]);
  return saida;
}

/**
 * Processo destino pelo protocolo digitado, pelo mesmo AJAX da tela de mover
 * do documento `numeroDoc` (o link do AJAX é colhido dessa tela).
 */
export async function resolverProcessoDestino(sei: Sei, numeroDoc: string, protocolo: string, sinal?: AbortSignal): Promise<ProcessoDestino> {
  if (!protocolo?.trim()) throw new ErroSei("ARGUMENTO_INVALIDO", "Informe o n\u00FAmero do processo destino.");
  const { link } = await documentoMovel(sei, numeroDoc, sinal);
  const tela = await sei.http.obter(link, { sinal });
  const ajax = /controlador_ajax\.php\?acao_ajax=protocolo_RI1023[^'"\s]*/.exec(tela.html)?.[0];
  if (!ajax) throw new ErroSei("SEI_VERSAO_NAO_SUPORTADA", "A tela de mover documento n\u00E3o tem a pesquisa do processo destino (protocolo_RI1023).");
  const resposta = await sei.http.enviar(decodificarEntidades(ajax), [["idProcedimento", protocolo.trim()]], { sinal, aceitarValidacao: true });
  const c = lerComplementos(resposta.html);
  if (!c.IdProcedimento) throw new ErroSei("SEI_NAO_ENCONTRADO", `Processo ${protocolo} n\u00E3o encontrado, ou voc\u00EA n\u00E3o tem acesso a ele.`);
  return { idProcedimento: c.IdProcedimento, protocolo: c.ProtocoloProcedimentoFormatado ?? protocolo.trim(), tipo: c.NomeTipoProcedimento ?? "" };
}

/** Move um documento para outro processo (destino já resolvido por `resolverProcessoDestino`). */
export async function moverDocumento(
  sei: Sei,
  numero: string,
  destino: { idProcedimento: string; protocolo: string },
  motivo: string,
  op: OpcoesEscrita,
): Promise<ResultadoEscrita> {
  if (!motivo?.trim()) throw new ErroSei("ARGUMENTO_INVALIDO", "Mover documento exige o motivo.");
  if (!destino?.idProcedimento) throw new ErroSei("ARGUMENTO_INVALIDO", "Processo destino n\u00E3o resolvido.");
  const { d, link } = await documentoMovel(sei, numero, op.sinal);
  const doc = d.documento;
  if (destino.idProcedimento === d.arvore.idProcedimento) {
    throw new ErroSei("ARGUMENTO_INVALIDO", `O documento ${doc.numero} j\u00E1 est\u00E1 no processo ${d.arvore.protocolo}.`);
  }
  const base: ResultadoEscrita = {
    alvo: doc.numero,
    mudancas: [
      { campo: "Processo", antes: d.arvore.protocolo, depois: destino.protocolo },
      { campo: "Motivo", antes: "", depois: motivo.trim() },
    ],
    aplicado: false,
    resumo: `Vai mover ${doc.titulo} (${doc.numero}) de ${d.arvore.protocolo} para ${destino.protocolo}.`,
  };
  if (!op.aplicar) return base;

  const form = await Formulario.abrir(sei.http, link, "#frmDocumentoMover", { sinal: op.sinal });
  form.definir({
    txtProcedimentoDestino: destino.protocolo,
    hdnIdProcedimentoDestino: destino.idProcedimento,
    txaMotivo: motivo.trim(),
  });
  await form.enviar({
    sinal: op.sinal,
    botao: "sbmMover",
    operacao: `a mudan\u00E7a do documento ${doc.numero} para ${destino.protocolo}`,
    sucesso: (p) => {
      const q = parametros(p.url);
      return q.get("acao_origem") === "documento_mover" && q.get("resultado") === "1";
    },
  });
  sei.invalidar(d.arvore.idProcedimento);
  sei.invalidar(destino.idProcedimento);
  sei.esquecer(numero);
  return { ...base, aplicado: true, resumo: `Documento ${doc.numero} movido de ${d.arvore.protocolo} para ${destino.protocolo}.` };
}
