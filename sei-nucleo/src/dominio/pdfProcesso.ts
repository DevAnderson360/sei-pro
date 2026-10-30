/**
 * PDF de documentos escolhidos de um processo (tela "Gerar Arquivo PDF do
 * Processo", `procedimento_gerar_pdf`, opção "Apenas selecionados").
 *
 * Tela do SEI 5 (`sei/web/procedimento_pdf.php`) e real do 4.1.5
 * (`sei41/p_procedimento_gerar_pdf.html`): formulário `#frmProcedimentoPdf`
 * com `rdoTipo` (T/E/A), a lupa `selDocumentosApenas → hdnDocumentosApenas` e
 * `hdnFlagGerar`. O servidor descarta EM SILÊNCIO os ids que não estão em
 * `DocumentoRN::listarSelecao` (sem PDF, cancelados, sem acesso): para dizer ao
 * usuário quais ficaram de fora, os ids são conferidos antes na própria lupa
 * (`documento_selecionar`, `documento_selecao.php`), que lista exatamente esses
 * documentos, um `chkInfraItemN` por linha com `value` = id do documento.
 *
 * Resposta com sucesso: a mesma tela, com
 * `document.getElementById('ifrDownload').src = '<link exibir_arquivo>'`.
 */

import { acaoNaArvore, type Arvore } from "./arvore";
import { Formulario, type ItemLupa } from "../formulario/formulario";
import { linkDaAcao, linksAssinados, parametros } from "../links/links";
import { decodificarEntidades } from "../sessao/dom";
import { ErroSei } from "../sessao/erros";
import type { Pagina } from "../sessao/http";
import type { Sei } from "../sei";

export interface PdfGerado {
  /** Link assinado `exibir_arquivo` do PDF gerado. */
  link: string;
  /** Nome de download proposto pelo SEI (`nome_download`). */
  nome: string;
  /** Ids pedidos que o SEI não oferece para PDF (ficaram fora do arquivo). */
  foraDoPdf: string[];
}

/** Paginação nativa do infra: há uma página seguinte. */
const temPaginaSeguinte = (p: Pagina) => /infraAcaoPaginar\(\s*['"]\+['"]/.test(p.html);
const MAX_PAGINAS = 50;

/** Link do PDF do processo inteiro (sem `id_documento`, que é o PDF de um documento só). */
function linkPdfDoProcesso(arv: Arvore): string | null {
  const l = acaoNaArvore(arv, "procedimento_gerar_pdf");
  if (l && !parametros(l).has("id_documento")) return l;
  return (
    [...arv.acoesProcesso, ...arv.links].find((x) => {
      const p = parametros(x);
      return p.get("acao") === "procedimento_gerar_pdf" && !p.has("id_documento") && p.get("id_procedimento") === arv.idProcedimento;
    }) ?? null
  );
}

function lerOferecidos(p: Pagina, saida: Map<string, string>): void {
  for (const chk of p.doc.querySelectorAll("input[type=checkbox][id^=chkInfraItem]")) {
    const id = chk.getAttribute("value") ?? "";
    if (id && !saida.has(id)) saida.set(id, decodificarEntidades(chk.getAttribute("title") ?? ""));
  }
}

/** Documentos que a lupa "Apenas selecionados" oferece: id → texto da lupa. */
async function documentosOferecidos(sei: Sei, tela: Pagina, sinal?: AbortSignal): Promise<Map<string, string>> {
  const link = linkDaAcao(linksAssinados(tela.html), "documento_selecionar", { id_object: "objLupaDocumentosApenas" });
  if (!link) throw new ErroSei("SEI_VERSAO_NAO_SUPORTADA", "A tela de PDF do processo n\u00E3o tem a sele\u00E7\u00E3o de documentos.");
  const saida = new Map<string, string>();
  let pagina = await sei.http.obter(link, { sinal });
  for (let n = 0; ; n++) {
    lerOferecidos(pagina, saida);
    if (!temPaginaSeguinte(pagina)) break;
    const form = Formulario.de(pagina, "#frmDocumentoSelecao", sei.http);
    if (n + 1 >= MAX_PAGINAS || !form.tem("hdnInfraPaginaAtual")) {
      throw new ErroSei("SEI_VERSAO_NAO_SUPORTADA", "N\u00E3o foi poss\u00EDvel consultar todas as p\u00E1ginas da sele\u00E7\u00E3o de documentos do PDF.");
    }
    pagina = await form.definir({ hdnInfraPaginaAtual: String(n + 1), hdnInfraItemId: "", hdnInfraItensSelecionados: "" }).enviar({ sinal });
  }
  return saida;
}

/**
 * Gera o PDF só com `idsDocumentos` (na ordem pedida) e devolve o link do
 * arquivo. Os ids que o SEI não oferece vão para `foraDoPdf`; documento
 * sigiloso fica sempre de fora. Erro de validação do SEI → `SEI_VALIDACAO`.
 */
export async function gerarPdfDocumentos(sei: Sei, refProcesso: string, idsDocumentos: string[], sinal?: AbortSignal): Promise<PdfGerado> {
  const arv = await sei.arvore(refProcesso, { sinal });
  if (arv.nivel === "sigiloso") throw new ErroSei("SEI_SIGILOSO", "Processo sigiloso: o agente n\u00E3o atua nele.");
  const link = linkPdfDoProcesso(arv);
  if (!link) throw new ErroSei("SEI_ACAO_INDISPONIVEL", `O SEI n\u00E3o oferece gerar PDF do processo ${arv.protocolo} para voc\u00EA.`);

  const form = await Formulario.abrir(sei.http, link, "#frmProcedimentoPdf", { sinal });
  const oferecidos = await documentosOferecidos(sei, form.pagina, sinal);
  const sigilosos = new Set(arv.documentos.filter((d) => d.nivel === "sigiloso").map((d) => d.id));

  const pedidos = [...new Set(idsDocumentos)];
  const dentro: ItemLupa[] = [];
  const foraDoPdf: string[] = [];
  for (const id of pedidos) {
    if (oferecidos.has(id) && !sigilosos.has(id)) dentro.push({ id, texto: oferecidos.get(id) || id });
    else foraDoPdf.push(id);
  }
  if (!dentro.length) {
    throw new ErroSei("SEI_ACAO_INDISPONIVEL", `Nenhum dos documentos escolhidos pode entrar no PDF do processo ${arv.protocolo} (sem PDF, cancelado ou sem acesso).`);
  }

  form.definir({ rdoTipo: "A", hdnFlagGerar: "1" }).definirLupa("selDocumentosApenas", dentro);
  const resposta = await form.enviar({ sinal, operacao: `a gera\u00E7\u00E3o do PDF do processo ${arv.protocolo}` });
  const m = /getElementById\(\s*['"]ifrDownload['"]\s*\)\.src\s*=\s*['"]([^'"]+)['"]/.exec(resposta.html);
  if (!m) {
    throw new ErroSei("SEI_RESPOSTA_INESPERADA", `O SEI n\u00E3o devolveu o PDF do processo ${arv.protocolo}.`);
  }
  const arquivo = decodificarEntidades(m[1]);
  return { link: arquivo, nome: parametros(arquivo).get("nome_download") ?? "", foraDoPdf };
}
