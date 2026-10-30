/**
 * Hipoteses legais do formulario do tipo (porta de procLote_carregarHipoteses + getUrlHipoteseLegal/
 * getHipoteseLegal, dist/js/sei-functions-pro.js).
 *
 * Elas NAO vem no HTML: o `selHipoteseLegal` nasce vazio e a tela o preenche por AJAX
 * (`infraAjaxMontarSelect` em `hipotese_legal_select_nome_base_legal`), pelo link que ela mesma assinou no
 * script -- por isso a URL e procurada no HTML CRU. Quem faz isso e `hipotesesDoFormulario` do nucleo; aqui so
 * se descarta o primeiro item `value="null"` e se mantem a tolerancia do legado: sem resposta, lista vazia.
 *
 * ATENCAO: `SEI_REDE`/`SEI_EXCECAO` tambem viram `[]`, indistinguivel de "orgao sem hipoteses". Quem monta o lote
 * deve tratar lote RESTRITO sem lista de hipoteses carregada como validacao bloqueante (nao criar sem hipotese).
 */

import { hipotesesDoFormulario } from "@nucleo/dominio/escrita";
import type { Formulario } from "@nucleo/formulario/formulario";
import type { Sei } from "@nucleo/sei";
import { ehErroSei } from "@nucleo/sessao/erros";

export interface HipoteseLegal {
  id: string;
  nome: string;
}

export async function carregarHipoteses(sei: Sei, form: Formulario): Promise<HipoteseLegal[]> {
  try {
    const itens = await hipotesesDoFormulario(sei, form, "1");
    return itens.filter((i) => i.id && i.id !== "null").map((i) => ({ id: i.id, nome: i.texto }));
  } catch (e) {
    // Sessao encerrada e cancelamento nao sao "orgao sem hipoteses": quem chamou precisa saber.
    if (ehErroSei(e) && (e.codigo === "SEI_SESSAO_EXPIRADA" || e.codigo === "CANCELADO")) throw e;
    return [];
  }
}
