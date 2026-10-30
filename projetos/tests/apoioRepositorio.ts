/** Repositório de teste: área em memória, relógio que anda 1 ms por gravação e ids previsíveis. */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import type { Escopo } from "../src/modelo/tipos";
import { RepositorioProjetos } from "../src/repositorio";

export const ESCOPO_UN: Escopo = { host: "sei.x.gov.br", login: "ana", unidade: "110", vis: "unidade" };
export const ESCOPO_EU: Escopo = { ...ESCOPO_UN, vis: "eu" };

/** Relógio que dois repositórios podem compartilhar (como o Date.now() de um navegador). */
export interface Relogio {
  agora: number;
}

/**
 * Início do relógio de teste: 01/10/2026. O registro do histórico com `quando` antes de 2000 é recusado na
 * importação (revisão final da P4, item 3): com o relógio em 1970 (1_000 ms), nenhum registro criado numa prova
 * passaria para outro escopo ou outro computador.
 */
export const RELOGIO_INICIAL = Date.UTC(2026, 9, 1, 12);

export function novoRepo(
  escopo: Escopo = ESCOPO_UN,
  area: Area = areaMemoria(),
  prefixoId = "id",
  relogio: Relogio = { agora: RELOGIO_INICIAL },
) {
  let n = 0;
  const repo = new RepositorioProjetos(
    area,
    escopo,
    () => ({ agora: ++relogio.agora, dispositivo: "dev-a", por: escopo.login, nome: "Ana Lima" }),
    () => `${prefixoId}${++n}`,
  );
  return { repo, area, relogio: () => relogio.agora };
}
