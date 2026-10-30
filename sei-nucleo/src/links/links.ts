/**
 * Links assinados do SEI.
 *
 * O SEI só aceita navegação por link com `infra_hash` calculado pelo servidor
 * sobre os parâmetros exatos da URL (`InfraSessao::validarLink`). Link sem
 * hash, com hash de outro link ou com parâmetro alterado DESLOGA o usuário.
 * Por isso a regra deste módulo é: link se COLHE da página, nunca se monta.
 *
 * A única exceção aceita pelo SEI é a entrada no processo
 * (`procedimento_trabalhar&id_procedimento=N`), usada pelo legado há anos; nas
 * versões que a recusam, o núcleo cai para a pesquisa rápida.
 *
 * Substitui no legado: `getLinksInText`, `getLinkMenuAcaoPro`,
 * `getLinksArvoreAjax`, `getLinkArvoreProcessoPro` e as buscas em
 * `arrayLinksArvore`/`arrayLinksArvoreAll` (inclusive o bug do `.join()` de
 * dois links, que produzia hash inválido e encerrava a sessão).
 */

import { ErroSei } from "../sessao/erros";
import type { Pagina } from "../sessao/http";

const RE_LINK = /controlador(?:_ajax)?\.php\?acao=[^"'\s<>\\]*?infra_hash=[0-9a-f]{64,192}/g;

/** Todos os links assinados de um HTML (em atributos, scripts ou texto), sem repetição. */
export function linksAssinados(html: string): string[] {
  const vistos = new Set<string>();
  for (const m of html.replace(/&amp;/g, "&").matchAll(RE_LINK)) vistos.add(m[0]);
  return [...vistos];
}

/** Parâmetros de um link do SEI. */
export function parametros(link: string): URLSearchParams {
  const i = link.indexOf("?");
  return new URLSearchParams(i >= 0 ? link.slice(i + 1) : "");
}

export function acaoDe(link: string): string {
  return parametros(link).get("acao") ?? "";
}

/**
 * O link assinado de uma ação, ou `null`.
 *
 * Casa a ação EXATA (`documento_alterar` não casa `documento_alterar_recebido`)
 * e, se pedido, parâmetros específicos (`{id_documento: '123'}`). Devolve um
 * link só — nunca junta candidatos.
 */
export function linkDaAcao(
  fonte: string | string[],
  acao: string | RegExp,
  filtro: Readonly<Record<string, string>> = {},
): string | null {
  const lista = Array.isArray(fonte) ? fonte : linksAssinados(fonte);
  for (const l of lista) {
    const p = parametros(l);
    const a = p.get("acao") ?? "";
    if (typeof acao === "string" ? a !== acao : !acao.test(a)) continue;
    if (Object.entries(filtro).every(([k, v]) => p.get(k) === v)) return l;
  }
  return null;
}

/** Remove `infra_hash` e ids de sessão de um texto que vai sair do SEI (para o modelo, para log). */
export function semAssinaturas(texto: string): string {
  return texto.replace(/(controlador(?:_ajax)?\.php\?)[^\s"'<>]*/g, "$1\u2026").replace(/infra_hash=[0-9a-f]+/g, "infra_hash=\u2026");
}

/**
 * Link assinado de um item do menu principal (ex.: `procedimento_controlar`), colhido da tela `base`
 * (uma tela com o menu). Procura primeiro no menu: a mesma ação aparece em outros lugares da tela com
 * parâmetros extras (ex.: `procedimento_controlar&tipo_filtro=M` é a caixa filtrada por marcador, e
 * usá-la mudaria a visão do usuário). Fora do `Sei` para quem só precisa do menu (o armazém de Texto
 * Padrão no content script dos Projetos, sem levar a árvore do processo para o pacote).
 */
export function linkDoMenu(base: Pick<Pagina, "doc" | "html">, acao: string): string {
  const menu = [...base.doc.querySelectorAll("#infraMenu a[href], #main-menu a[href], .infraMenu a[href]")]
    .map((a) => a.getAttribute("href") ?? "")
    .join("\n");
  const candidatos = linksAssinados(menu).filter((l) => parametros(l).get("acao") === acao);
  const todos = candidatos.length ? candidatos : linksAssinados(base.html).filter((l) => parametros(l).get("acao") === acao);
  const l = todos.sort((a, b) => [...parametros(a).keys()].length - [...parametros(b).keys()].length)[0];
  if (!l) throw new ErroSei("SEI_ACAO_INDISPONIVEL", `O menu do SEI não oferece "${acao}" para este usuário.`);
  return l;
}
