/**
 * O balão do processo sob demanda (T11): o conteúdo, os formulários e o
 * `base.css` como texto (~40 KB) ficam num módulo à parte
 * (`pagina/pacoteBalao.ts` → `js/projetos/balao.js`), importado só quando o
 * usuário abre o primeiro balão. Os repositórios e o consentimento passam como
 * instâncias (o balão só importa os tipos deles); o que os dois pacotes usam em
 * comum fica num pedaço só (`js/projetos/pagina-comum.js`, divisão do esbuild),
 * então nada se duplica: nem o repositório, nem o "balão aberto agora".
 */

import type { BalaoPagina } from "./balao";
import type { DepsBalaoProcesso } from "./balaoProcesso";
import type { ProcessoNaTela } from "./conteudo";

/** O que quem abre o balão informa (o CSS é do próprio módulo do balão). */
export type DepsBalao = Omit<DepsBalaoProcesso, "cssBase">;

export interface ModuloBalao {
  abrirBalao(ancora: HTMLElement, processo: ProcessoNaTela, d: DepsBalao): Promise<BalaoPagina>;
}

/** Carrega na primeira vez que alguém pede, e de novo só se a carga falhou (a rede, a extensão atualizada). */
export function sobDemanda<T>(carregar: () => Promise<T>): () => Promise<T> {
  let carga: Promise<T> | null = null;
  return () => {
    carga ??= carregar().catch((e: unknown) => {
      carga = null;
      throw e;
    });
    return carga;
  };
}

/** `abrirBalao` que importa o módulo do balão na primeira abertura. */
export function abridorDoBalao(importar: () => Promise<ModuloBalao>): ModuloBalao["abrirBalao"] {
  const modulo = sobDemanda(importar);
  return async (ancora, processo, d) => (await modulo()).abrirBalao(ancora, processo, d);
}
