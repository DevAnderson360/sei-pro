import { parametros } from "@nucleo/links/links";
import { lerContexto } from "@nucleo/sei";
import { decodificarEntidades } from "@nucleo/sessao/dom";
import { paginaDe } from "@nucleo/sessao/pagina";

export interface ContextoAcoes {
  host: string;
  login: string;
  nomeUsuario: string;
  unidadeSigla: string;
  temaEscuro: boolean;
  corTema?: string;
  /** Endereco da tela do SEI. Fica na aba: pode trazer o infra_hash e nunca vai para o app. */
  base: string;
  /** Endereco da arvore do processo, lido do `#ifrArvore` da tela (colhido da pagina, nunca montado). */
  linkArvore: string;
  idProcedimento: string;
  /**
   * Caminho até o `controlador.php` do SEI (esquema, host e diretório, sem query nem infra_hash). Vai para o app,
   * que monta com ele o link de cada documento no resultado (o mesmo formato do Link Permanente).
   */
  origem: string;
  /**
   * Id da aba do SEI: gerado uma vez por página pelo content script. Identifica quem grava o lote, para o aviso
   * de "rodando em outra aba" (o app nasce de novo a cada abertura do modal; a página, não).
   */
  aba?: string;
}

let abaDaPagina: string | null = null;

/** Id desta página do SEI (o content script roda uma vez por página): o mesmo em toda chamada. */
export function idDaAba(): string {
  abaDaPagina ??= globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return abaDaPagina;
}

/** `https://h/sei/controlador.php?...&infra_hash=x` -> `https://h/sei/controlador.php`; endereço inválido -> "". */
export function origemDoSei(base: string): string {
  try {
    const url = new URL(base);
    const diretorio = url.pathname
      .replace(/\/+$/, "")
      .replace(/controlador\.php$/, "")
      .replace(/\/+$/, "");
    return `${url.origin}${diretorio}/controlador.php`;
  } catch {
    return "";
  }
}

/** Sem login lido ou sem arvore (tela que nao e `procedimento_trabalhar`) nao ha o que fazer: devolve null. */
export function contextoAcoes(doc: Document, o: { temaEscuro: boolean; corTema?: string }, url?: string): ContextoAcoes | null {
  const pagina = paginaDe(doc, url);
  const c = lerContexto(pagina);
  if (!c.usuario.login) return null;
  const src = pagina.doc.querySelector("#ifrArvore")?.getAttribute("src");
  if (!src) return null;
  const linkArvore = decodificarEntidades(src);
  const idProcedimento = parametros(linkArvore).get("id_procedimento") ?? "";
  if (!idProcedimento) return null;
  const ctx: ContextoAcoes = {
    host: c.host,
    login: c.usuario.login.toLowerCase(),
    nomeUsuario: c.usuario.nome ?? "",
    unidadeSigla: c.unidade.sigla ?? "",
    temaEscuro: o.temaEscuro,
    base: pagina.url,
    linkArvore,
    idProcedimento,
    origem: origemDoSei(pagina.url),
    aba: idDaAba(),
  };
  if (o.corTema) ctx.corTema = o.corTema;
  return ctx;
}
