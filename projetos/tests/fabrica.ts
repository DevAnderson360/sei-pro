/** Entidades de teste com valores padrão: cada prova muda só o que importa para ela. */

import type { Carimbo, Etapa, Fase, Projeto } from "../src/modelo/tipos";

export const HOJE = "2026-10-06"; // terça-feira
export const C: Carimbo = { agora: 1_000, dispositivo: "dev-a", por: "ana", nome: "Ana Lima" };

export function etapa(m: Partial<Etapa> & { id: string }): Etapa {
  return {
    projeto: "p1",
    ordem: "a0",
    nome: `Etapa ${m.id}`,
    inicio: "2026-10-05",
    fim: "2026-10-09",
    marco: false,
    dependeDe: [],
    medida: "manual",
    progresso: 0,
    checklist: [],
    etiquetas: [],
    criadoEm: 1,
    atualizadoEm: 1,
    dispositivo: "dev-a",
    ...m,
  };
}

export function projeto(m: Partial<Projeto> & { id: string }): Projeto {
  return { nome: `Projeto ${m.id}`, etiquetas: [], ordem: "a0", criadoEm: 1, atualizadoEm: 1, dispositivo: "dev-a", ...m };
}

export function fase(m: Partial<Fase> & { id: string }): Fase {
  return { projeto: "p1", nome: `Fase ${m.id}`, ordem: "a0", atualizadoEm: 1, dispositivo: "dev-a", ...m };
}
