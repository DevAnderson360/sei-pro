/**
 * O armazém de Texto Padrão do núcleo para os textos das demandas (uma tabela por texto), com só o que ele usa da
 * sessão: o HTTP e o link do MENU (`linkDoMenu`) colhido da tela. Sem a classe `Sei`, o pacote do content script não leva
 * a leitura da árvore de processo (o portão do build confere), e o armazém só usa o menu e os links da própria lista
 * de Textos Padrão: nunca URL montada. O menu é lido na hora de cada rodada (a tela de agora).
 */

import type { ArmazemTexto } from "@comum/sincronia/controlePagina";
import { criarArmazemTextoPadrao } from "@nucleo/dominio/textoPadrao";
import { linkDoMenu } from "@nucleo/links/links";
import { criarHttp } from "@nucleo/sessao/http";
import { paginaDe } from "@nucleo/sessao/pagina";
import type { Tabela, Vis } from "../modelo/tipos";
import { descricaoDoTexto, nomeDoTexto } from "../sincronia/textoPadrao";

/** A tela tem o item "Textos Padrão" (`texto_padrao_interno_listar`), o que o armazém usa para achar a lista: sem requisição. */
export function armazemNaTela(doc: Document, url: string): boolean {
  try {
    linkDoMenu(paginaDe(doc, url), "texto_padrao_interno_listar");
    return true;
  } catch {
    return false;
  }
}

export function armazemDoTexto(doc: Document, url: string, vis: Vis, tabela: Tabela, login: string): ArmazemTexto {
  const sessao = { http: criarHttp(url), linkMenu: (acao: string) => linkDoMenu(paginaDe(doc, url), acao) };
  const a = criarArmazemTextoPadrao(sessao, { nome: nomeDoTexto(vis, login, tabela), descricao: descricaoDoTexto(vis, tabela) });
  return {
    ler: () => a.ler(),
    gravar: (h) => a.gravar(h),
    gravarConferindo: (h, c) => a.gravarConferindo(h, c),
    excluir: () => a.excluir(),
    localizar: () => a.localizar(),
  };
}
