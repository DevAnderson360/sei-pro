import { areaMemoria } from "@comum/armazenamento/area";
import type { Carimbo, Escopo } from "../src/modelo/tipos";
import { RepositorioDemandas } from "../src/repositorio";
import { C } from "./fabrica";

export const ESCOPO: Escopo = { host: "sei.exemplo.gov.br", login: "ana", unidade: "110000001", vis: "unidade" };

/** Um instante realista (12/10/2026): o histórico recusa `quando` anterior a 2000-01-01. */
export const T0 = 1_790_000_000_000;

/** Um repositório com relógio e ids controlados; `agora` anda com `avancar`. */
export function repoDeTeste(escopo: Escopo = ESCOPO, c: Partial<Carimbo> = {}, area = areaMemoria()) {
  const relogio = { agora: T0 };
  let n = 0;
  const repo = new RepositorioDemandas(
    area,
    escopo,
    () => ({ ...C, ...c, agora: relogio.agora }),
    () => `id${++n}`,
  );
  return { repo, area, relogio, avancar: (ms = 1_000) => (relogio.agora += ms) };
}
