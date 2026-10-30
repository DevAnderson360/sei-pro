/**
 * Tipos de processo pela tela "Iniciar Processo" do menu (porta de getInitialProcUrl/getInitialProcHtml e
 * procLote_obterListaTipos, dist/js/sei-pro-docs-lote.js e sei-pro-proc-lote.js).
 *
 * A tela abre so com os tipos "mais usados"; a lista completa vem do POST do proprio formulario com
 * `hdnFiltroTipoProcedimento=T`. O formulario e escolhido pelo que a pagina REALMENTE tem, nunca pela versao:
 * o SEI 4.1.5 do Governo de SP ja serve `#frmProcedimentoEscolherTipo` (como o 5), e escolher pela versao
 * mandava o POST para lugar nenhum, em silencio.
 */

import { parametros } from "@nucleo/links/links";
import type { Sei } from "@nucleo/sei";
import { textoDe } from "@nucleo/sessao/dom";
import { ErroSei } from "@nucleo/sessao/erros";
import type { Pagina } from "@nucleo/sessao/http";
import { comCampos, ocultosHdn } from "./campos";

export interface TipoProcesso {
  id: string;
  nome: string;
}

/** Tipo listado com o link da escolha: assinado no SEI 3/4.0, `null` quando a tela escolhe por POST (links "#"). */
export interface TipoListado extends TipoProcesso {
  link: string | null;
}

const FORMULARIOS_LISTA = ["#frmProcedimentoEscolherTipo", "#frmIniciarProcessoEscolhaTipo"];

/** O formulario de escolha de tipo que a pagina tem, com `action`. */
export function formularioDaLista(pagina: Pagina): { form: Element; action: string } | null {
  for (const seletor of FORMULARIOS_LISTA) {
    const form = pagina.doc.querySelector(seletor);
    const action = form?.getAttribute("action")?.replace(/&amp;/g, "&");
    if (form && action) return { form, action };
  }
  return null;
}

/** Abre "Iniciar Processo" pelo link assinado do menu e devolve a tela com a lista COMPLETA de tipos. */
export async function abrirListaCompleta(sei: Sei): Promise<Pagina> {
  const inicial = await sei.http.obter(sei.linkMenu("procedimento_escolher_tipo"));
  const lista = formularioDaLista(inicial);
  if (!lista) {
    throw new ErroSei(
      "SEI_VERSAO_NAO_SUPORTADA",
      "N\u00E3o foi poss\u00EDvel abrir a lista de tipos de processo.",
      textoDe(inicial.doc.querySelector("title")),
    );
  }
  return sei.http.enviar(lista.action, comCampos(ocultosHdn(lista.form), [["hdnFiltroTipoProcedimento", "T"]]));
}

/**
 * Tipos da tabela `#tblTipoProcedimento`. O id vem do link (`id_tipo_procedimento=N`, comparado por parametro:
 * o seletor `*=` do legado casava o tipo 1 no link do 12) ou do `onclick="escolher(N)"` quando o link e "#".
 * O selo "(Ouvidoria)" do `<sup>` nao faz parte do nome do tipo.
 */
export function lerTipos(lista: Pagina): TipoListado[] {
  const tipos: TipoListado[] = [];
  const vistos = new Set<string>();
  for (const a of lista.doc.querySelectorAll("#tblTipoProcedimento a.ancoraOpcao")) {
    const href = (a.getAttribute("href") ?? "").replace(/&amp;/g, "&");
    const porLink = href && href !== "#" ? parametros(href).get("id_tipo_procedimento") : null;
    const id = porLink ?? /escolher\(\s*['"]?(\d+)/.exec(a.getAttribute("onclick") ?? "")?.[1] ?? "";
    if (!id || vistos.has(id)) continue;
    vistos.add(id);
    const selo = textoDe(a.querySelector("sup"));
    let nome = textoDe(a);
    if (selo && nome.endsWith(selo)) nome = nome.slice(0, -selo.length).trim();
    tipos.push({ id, nome, link: porLink ? href : null });
  }
  return tipos;
}

/** Tipos de processo que a unidade pode iniciar. */
export async function listarTipos(sei: Sei): Promise<TipoProcesso[]> {
  const tipos = lerTipos(await abrirListaCompleta(sei));
  if (!tipos.length) throw new ErroSei("SEI_NAO_ENCONTRADO", "N\u00E3o foi poss\u00EDvel carregar os tipos de processo.");
  return tipos.map(({ id, nome }) => ({ id, nome }));
}
