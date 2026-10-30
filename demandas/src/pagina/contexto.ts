/** Contexto da aba: host, login, nome e unidade, lidos do cabeçalho do SEI. */

import { lerContexto } from "@nucleo/sei";
import type { ContextoDemandas } from "../ponte/tipos";

export function contextoDemandas(doc: Document, extras: { temaEscuro: boolean; corTema?: string }, url?: string): ContextoDemandas | null {
  // html vazio, como o carregador: `paginaDe` serializaria a página inteira (outerHTML) em toda janela de topo, só
  // para ler a versão do SEI, que nada daqui usa (`versao` fica "" até alguém precisar).
  const c = lerContexto({ url: url ?? doc.location?.href ?? "https://sei.invalido/sei/", status: 200, html: "", doc });
  if (!c.usuario.login) return null;
  const ctx: ContextoDemandas = {
    host: c.host,
    login: c.usuario.login.toLowerCase(),
    nome: c.usuario.nome,
    unidade: c.unidade.id ? { id: c.unidade.id, sigla: c.unidade.sigla, nome: c.unidade.nome } : null,
    versao: c.versao,
    temaEscuro: extras.temaEscuro,
  };
  if (extras.corTema) ctx.corTema = extras.corTema;
  return ctx;
}
