import type { RegistroUsoChamada, Uso } from "./tipos";

export function usoVazio(): Uso {
  return { entrada: 0, cache: 0, gravacaoCache: 0, saida: 0, raciocinio: 0, total: 0, custo: 0 };
}

/** Completa dados antigos e respostas parciais sem contar reasoning duas vezes. */
export function normalizarUso(uso?: Partial<Uso>): Uso {
  const entrada = uso?.entrada ?? 0;
  const saida = uso?.saida ?? 0;
  return {
    entrada,
    cache: uso?.cache ?? 0,
    gravacaoCache: uso?.gravacaoCache ?? 0,
    saida,
    raciocinio: uso?.raciocinio ?? 0,
    total: uso?.total ?? entrada + saida,
    custo: uso?.custo ?? 0,
  };
}

export function somarUso(a: Partial<Uso>, b: Partial<Uso>): Uso {
  const x = normalizarUso(a);
  const y = normalizarUso(b);
  return {
    entrada: x.entrada + y.entrada,
    cache: x.cache + y.cache,
    gravacaoCache: x.gravacaoCache + y.gravacaoCache,
    saida: x.saida + y.saida,
    raciocinio: x.raciocinio + y.raciocinio,
    total: x.total + y.total,
    custo: x.custo + y.custo,
  };
}

export function criarRegistroUsoChamada(modelo: string, uso: Partial<Uso>, criadoEm = Date.now(), id = crypto.randomUUID()): RegistroUsoChamada {
  return { id, modelo, criadoEm, ...normalizarUso(uso) };
}
