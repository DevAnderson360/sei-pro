/**
 * Formulario de criacao de UM tipo de processo (porta de procLote_carregarFormTipo e procLote_obterFormTipo,
 * dist/js/sei-pro-proc-lote.js, e de getSerieForm, dist/js/sei-pro-docs-lote.js).
 *
 * Buscado UMA vez por lote e reaproveitado nos N POSTs: o `action` de `procedimento_gerar` traz o
 * `infra_hash` da sessao, que nao e de uso unico (comprovado no SEI 4.1.5).
 */

import { Formulario } from "@nucleo/formulario/formulario";
import type { Sei } from "@nucleo/sei";
import { textoDe } from "@nucleo/sessao/dom";
import { ErroSei } from "@nucleo/sessao/erros";
import type { Pagina } from "@nucleo/sessao/http";
import { comCampos, ocultosHdn } from "./campos";
import { carregarHipoteses } from "./hipoteses";
import { abrirListaCompleta, formularioDaLista, lerTipos } from "./tipos";

export interface FormTipo {
  idTipo: string;
  action: string;
  params: Array<[string, string]>;
  hipoteses: Array<{ id: string; nome: string }>;
  assuntos: string;
  interessados: string;
}

export async function carregarFormTipo(sei: Sei, idTipo: string): Promise<FormTipo> {
  const lista = await abrirListaCompleta(sei);
  return lerFormTipo(sei, await abrirFormularioDoTipo(sei, lista, idTipo), idTipo);
}

/**
 * Escolhe o tipo na lista completa. SEI 3/4.0: o link do tipo e assinado e basta segui-lo. SEI 4.1.5+/5: os
 * links sao "#" e a escolha vai por POST do proprio formulario com `hdnIdTipoProcedimento`; o SEI responde
 * redirecionando para `procedimento_gerar`, e a pagina final ja e o formulario (o legado lia a URL final e
 * buscava de novo; aqui se usa a resposta, que e a mesma tela).
 */
async function abrirFormularioDoTipo(sei: Sei, lista: Pagina, idTipo: string): Promise<Pagina> {
  const tipo = lerTipos(lista).find((t) => t.id === idTipo);
  if (!tipo) {
    throw new ErroSei(
      "ARGUMENTO_INVALIDO",
      "Erro ao selecionar o tipo de processo. Verifique se o tipo est\u00E1 dispon\u00EDvel no sistema e tente novamente.",
    );
  }
  const porPost = lista.doc.querySelector("#tblTipoProcedimento a.ancoraOpcao")?.getAttribute("href") === "#";
  if (!porPost && tipo.link) return sei.http.obter(tipo.link);
  const form = formularioDaLista(lista);
  if (!form) throw new ErroSei("SEI_VERSAO_NAO_SUPORTADA", "N\u00E3o foi poss\u00EDvel abrir a lista de tipos de processo.");
  return sei.http.enviar(form.action, comCampos(ocultosHdn(form.form), [["hdnIdTipoProcedimento", idTipo]]));
}

/**
 * Lupa serializada como o legado a montava a partir do `<select>` visivel: `valor \u00B1 texto` unidos por
 * `\u00A5`, espaco trocado por `+`. Sem `hdnAssuntos` preenchido, o POST volta em silencio para o formulario
 * ("Iniciar Processo") nas instalacoes que exigem assunto: quem o preenche e o JavaScript da pagina.
 */
function serializarSelect(pagina: Pagina, seletor: string): string {
  return [...pagina.doc.querySelectorAll(`${seletor} option`)]
    .map((o) => `${o.getAttribute("value") ?? o.textContent ?? ""}\u00B1${o.textContent ?? ""}`)
    .join("\u00A5")
    .replaceAll(" ", "+");
}

/** Le o formulario do tipo numa tela ja obtida (exportada para as provas com captura real). */
export async function lerFormTipo(sei: Sei, pagina: Pagina, idTipo: string): Promise<FormTipo> {
  const el = pagina.doc.querySelector("#frmProcedimentoCadastro");
  if (!el?.getAttribute("action")) {
    throw new ErroSei(
      "SEI_VERSAO_NAO_SUPORTADA",
      "O SEI n\u00E3o devolveu o formul\u00E1rio deste tipo de processo.",
      textoDe(pagina.doc.querySelector("title")),
    );
  }
  const form = Formulario.de(pagina, "#frmProcedimentoCadastro", sei.http);
  // O legado lia `#selInteressados`; a tela do SEI 4.1/5 chama a lupa de `selInteressadosProcedimento`.
  const interessados = pagina.doc.querySelector("#selInteressados") ? "#selInteressados" : "#selInteressadosProcedimento";
  return {
    idTipo: String(idTipo),
    action: form.action,
    params: form.pares(),
    hipoteses: await carregarHipoteses(sei, form),
    assuntos: serializarSelect(pagina, "#selAssuntos"),
    interessados: serializarSelect(pagina, interessados),
  };
}
