/**
 * Lado da aba dos Documentos em Lote: a marca no <html> que o legado le, o contexto lido da tela do processo
 * (`procedimento_trabalhar`) e o modal.
 */

import { readFileSync } from "node:fs";
import { ATRIBUTO_ATIVO, EVENTO_ABRIR } from "@dl/modelo/constantes";
import { parametros } from "@nucleo/links/links";
import { decodificarEntidades } from "@nucleo/sessao/dom";
import { contextoDocumentos } from "../src/pagina/contexto";
import { marcarAtivo } from "../src/pagina/marca";
import { CONFIG_MODAL } from "../src/pagina/modal";
import { checar, igual, instalarDom, secao } from "./util";

const FIXTURE = new URL("../../sei-nucleo/tests/fixtures/sei41/trabalhar.html", import.meta.url);
const URL_TELA = "https://treinamento.sei.sp.gov.br/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=148265&infra_hash=zzz";

export async function verificarPagina(): Promise<void> {
  secao("Pagina: marca");
  const d0 = instalarDom();
  marcarAtivo(d0);
  checar("marca o html", d0.documentElement.getAttribute("data-seipro-documentos-lote") === "1");
  checar("a constante bate com o atributo", ATRIBUTO_ATIVO === "data-seipro-documentos-lote");

  secao("Pagina: contexto da tela do processo");
  {
    const html = readFileSync(FIXTURE, "latin1");
    const brutoSrc = /<iframe id="ifrArvore"[^>]*\ssrc="([^"]*)"/.exec(html)?.[1] ?? "";
    const linkEsperado = decodificarEntidades(brutoSrc);
    const idEsperado = parametros(linkEsperado).get("id_procedimento") ?? "";
    checar("fixture traz a arvore", linkEsperado.length > 0 && idEsperado === "148265", { linkEsperado, idEsperado });
    const doc = instalarDom(html);
    const ctx = contextoDocumentos(doc, { temaEscuro: true, corTema: "#123456" }, URL_TELA);
    checar("devolve contexto", ctx !== null);
    checar("idProcedimento e linkArvore da fixture", ctx?.idProcedimento === idEsperado && ctx?.linkArvore === linkEsperado, ctx);
    checar(
      "login, usuario e unidade",
      !!ctx?.login && ctx.login === ctx.login.toLowerCase() && !!ctx.nomeUsuario && !!ctx.unidadeSigla,
      ctx,
    );
    checar("tema, cor e base", ctx?.temaEscuro === true && ctx?.corTema === "#123456" && ctx?.base === URL_TELA, ctx);
    igual("origem: caminho ate o controlador.php, sem query", ctx?.origem, "https://treinamento.sei.sp.gov.br/sei/controlador.php");
    const ctx2 = contextoDocumentos(doc, { temaEscuro: true }, URL_TELA);
    checar("id da aba do SEI: gerado uma vez por pagina", !!ctx?.aba && ctx.aba === ctx2?.aba, [ctx?.aba, ctx2?.aba]);
  }
  {
    const html = readFileSync(FIXTURE, "latin1").replace(/<iframe id="ifrArvore"[^>]*><\/iframe>/, "");
    checar("sem #ifrArvore na fixture alterada", !html.includes('id="ifrArvore"'));
    const ctx = contextoDocumentos(instalarDom(html), { temaEscuro: false }, URL_TELA);
    checar("sem arvore: null", ctx === null, ctx);
  }
  {
    const ctx = contextoDocumentos(instalarDom("<html><body></body></html>"), { temaEscuro: false }, URL_TELA);
    checar("sem login e sem arvore: null", ctx === null, ctx);
  }

  secao("Pagina: config do modal");
  checar(
    "config do modal",
    CONFIG_MODAL.titulo === "Documentos em Lote" &&
      CONFIG_MODAL.seletorItemMenu === "#iconBatchDocs" &&
      CONFIG_MODAL.evento === EVENTO_ABRIR &&
      CONFIG_MODAL.atributoIframe === "data-spro-documentos-lote-modal",
  );
}
