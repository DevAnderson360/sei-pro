import { lerContexto } from "@nucleo/sei";
import { paginaDe } from "@nucleo/sessao/pagina";

export interface ContextoLink {
  host: string;
  login: string;
  temaEscuro: boolean;
  corTema?: string;
  /** Endereço da tela do SEI; só a origem e o caminho entram no link (nunca o infra_hash). */
  base: string;
}

/** Sem login lido não há sessão utilizável: devolve null e o módulo mostra o aviso. */
export function contextoLink(doc: Document, o: { temaEscuro: boolean; corTema?: string }, url?: string): ContextoLink | null {
  const pagina = paginaDe(doc, url);
  const c = lerContexto(pagina);
  if (!c.usuario.login) return null;
  const ctx: ContextoLink = { host: c.host, login: c.usuario.login.toLowerCase(), temaEscuro: o.temaEscuro, base: pagina.url };
  if (o.corTema) ctx.corTema = o.corTema;
  return ctx;
}
