/** Contexto da aba (spec 7): host, login, nome e unidade, lidos do cabeçalho do SEI. */

import { lerContexto } from "@nucleo/sei";
import type { ContextoProjetos } from "../ponte/tipos";

export function contextoProjetos(
  doc: Document,
  extras: { temaEscuro: boolean; corTema?: string; atividades: boolean },
  url?: string,
): ContextoProjetos | null {
  // html vazio, como o carregador: `paginaDe` serializaria a pagina inteira (outerHTML) em toda janela de topo, so
  // para ler a versao do SEI, que nada daqui usa (`versao` fica "" ate alguem precisar).
  const c = lerContexto({ url: url ?? doc.location?.href ?? "https://sei.invalido/sei/", status: 200, html: "", doc });
  if (!c.usuario.login) return null;
  const ctx: ContextoProjetos = {
    host: c.host,
    login: c.usuario.login.toLowerCase(),
    nome: c.usuario.nome,
    unidade: c.unidade.id ? { id: c.unidade.id, sigla: c.unidade.sigla, nome: c.unidade.nome } : null,
    versao: c.versao,
    temaEscuro: extras.temaEscuro,
    atividades: extras.atividades,
  };
  if (extras.corTema) ctx.corTema = extras.corTema;
  return ctx;
}

/**
 * Servidor do Atividades configurado: o legado grava `configBasePro_atividades` com URL_API (e KEY_USER,
 * que fica vazio no login por host). Basta a URL_API preenchida: é a mesma regra da guarda do init.js
 * (`servidorAtividadesConfiguradoPro`), que decide se o legado carrega; as duas não podem divergir.
 */
export function atividadesConfigurado(armazenamento: Pick<Storage, "getItem">): boolean {
  try {
    const c = JSON.parse(armazenamento.getItem("configBasePro_atividades") ?? "null") as { URL_API?: unknown } | null;
    return !!c && typeof c === "object" && typeof c.URL_API === "string" && c.URL_API !== "";
  } catch {
    return false;
  }
}
