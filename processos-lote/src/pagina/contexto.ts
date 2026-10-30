import { lerContexto } from "@nucleo/sei";
import { paginaDe } from "@nucleo/sessao/pagina";

export interface ContextoLote {
  host: string;
  login: string;
  temaEscuro: boolean;
  corTema?: string;
  /** Endereco da tela do SEI. Fica na aba: pode trazer o infra_hash e nunca vai para o app. */
  base: string;
}

/** Sem login lido nao ha sessao utilizavel: devolve null e o modulo mostra o aviso. */
export function contextoLote(doc: Document, o: { temaEscuro: boolean; corTema?: string }, url?: string): ContextoLote | null {
  const pagina = paginaDe(doc, url);
  const c = lerContexto(pagina);
  if (!c.usuario.login) return null;
  const ctx: ContextoLote = { host: c.host, login: c.usuario.login.toLowerCase(), temaEscuro: o.temaEscuro, base: pagina.url };
  if (o.corTema) ctx.corTema = o.corTema;
  return ctx;
}
