/**
 * O balão sob demanda (D17): o conteúdo, os formulários e o `base.css` como texto ficam num módulo à parte
 * (`pagina/pacoteBalao.ts` -> `js/demandas/balao.js`), importado só quando o usuário abre o primeiro balão: o pacote da
 * página (e o carregador de todo frame) não carregam nada disso. O que os dois pacotes usam em comum fica num pedaço só
 * (divisão do esbuild).
 */

import type { BalaoPagina } from "@projetos/pagina/balao";
import { sobDemanda } from "@projetos/pagina/sobDemanda";
import type { DepsBalaoDemandas } from "./balaoDemandas";
import type { Detectado } from "./deteccao";

/** O que quem abre o balão informa (o CSS é do próprio módulo do balão). */
export type DepsBalao = Omit<DepsBalaoDemandas, "cssBase">;

export interface ModuloBalao {
  abrirBalao(ancora: HTMLElement, detectado: Detectado, d: DepsBalao): Promise<BalaoPagina>;
}

/** `abrirBalao` que importa o módulo do balão na primeira abertura. */
export function abridorDoBalao(importar: () => Promise<ModuloBalao>): ModuloBalao["abrirBalao"] {
  const modulo = sobDemanda(importar);
  return async (ancora, detectado, d) => (await modulo()).abrirBalao(ancora, detectado, d);
}
