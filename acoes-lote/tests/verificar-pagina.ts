/**
 * Lado da aba das Acoes em Lote: a marca no <html> que o legado le, o contexto lido da tela do processo
 * (`procedimento_trabalhar`) e o modal.
 */

import { readFileSync } from "node:fs";
import { parametros } from "@nucleo/links/links";
import { decodificarEntidades } from "@nucleo/sessao/dom";
import { ATRIBUTO_ATIVO, CANAL_ACOES_LOTE, EVENTO_ABRIR, PREFIXO_STORAGE } from "../src/modelo/constantes";
import { contextoAcoes } from "../src/pagina/contexto";
import { marcarAtivo } from "../src/pagina/marca";
import { CONFIG_MODAL } from "../src/pagina/modal";
import { checar, igual, instalarDom, secao } from "./util";

const FIXTURE = new URL("../../sei-nucleo/tests/fixtures/sei41/trabalhar.html", import.meta.url);
const URL_TELA = "https://treinamento.sei.sp.gov.br/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=148265&infra_hash=zzz";

export async function verificarPagina(): Promise<void> {
  secao("Pagina: constantes");
  igual(
    "canal, evento, atributo e prefixo",
    [CANAL_ACOES_LOTE, EVENTO_ABRIR, ATRIBUTO_ATIVO, PREFIXO_STORAGE],
    ["spro-acoes-lote", "spro-acoes-lote-abrir", "data-seipro-acoes-lote", "acoes-lote/"],
  );

  secao("Pagina: marca");
  const d0 = instalarDom();
  marcarAtivo(d0);
  checar("marca o html", d0.documentElement.getAttribute(ATRIBUTO_ATIVO) === "1");

  secao("Pagina: contexto da tela do processo");
  {
    const html = readFileSync(FIXTURE, "latin1");
    const brutoSrc = /<iframe id="ifrArvore"[^>]*\ssrc="([^"]*)"/.exec(html)?.[1] ?? "";
    const linkEsperado = decodificarEntidades(brutoSrc);
    const idEsperado = parametros(linkEsperado).get("id_procedimento") ?? "";
    checar("fixture traz a arvore", linkEsperado.length > 0 && idEsperado === "148265", { linkEsperado, idEsperado });
    const doc = instalarDom(html);
    const ctx = contextoAcoes(doc, { temaEscuro: true, corTema: "#123456" }, URL_TELA);
    checar("devolve contexto", ctx !== null);
    checar("idProcedimento e linkArvore da fixture", ctx?.idProcedimento === idEsperado && ctx?.linkArvore === linkEsperado, ctx);
    checar(
      "login, usuario e unidade",
      !!ctx?.login && ctx.login === ctx.login.toLowerCase() && !!ctx.nomeUsuario && !!ctx.unidadeSigla,
      ctx,
    );
    checar("tema, cor e base", ctx?.temaEscuro === true && ctx?.corTema === "#123456" && ctx?.base === URL_TELA, ctx);
    igual("origem: caminho ate o controlador.php, sem query", ctx?.origem, "https://treinamento.sei.sp.gov.br/sei/controlador.php");
    const ctx2 = contextoAcoes(doc, { temaEscuro: true }, URL_TELA);
    checar("id da aba do SEI: gerado uma vez por pagina", !!ctx?.aba && ctx.aba === ctx2?.aba, [ctx?.aba, ctx2?.aba]);
  }
  {
    const html = readFileSync(FIXTURE, "latin1").replace(/<iframe id="ifrArvore"[^>]*><\/iframe>/, "");
    checar("sem #ifrArvore na fixture alterada", !html.includes('id="ifrArvore"'));
    const ctx = contextoAcoes(instalarDom(html), { temaEscuro: false }, URL_TELA);
    checar("sem arvore: null", ctx === null, ctx);
  }

  secao("Pagina: config do modal");
  checar(
    "config do modal",
    CONFIG_MODAL.titulo === "Ações em Lote" &&
      CONFIG_MODAL.seletorItemMenu === "#iconBatchActions" &&
      CONFIG_MODAL.evento === EVENTO_ABRIR &&
      CONFIG_MODAL.atributoIframe === "data-spro-acoes-lote-modal",
  );
}
