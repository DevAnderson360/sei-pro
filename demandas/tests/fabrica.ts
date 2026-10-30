import type { Carimbo, Demanda, Registro } from "../src/modelo/tipos";

export const HOJE = "2026-10-12"; // segunda-feira
export const C: Carimbo = { agora: 1_000, dispositivo: "dev-a", por: "ana", nome: "Ana Lima" };

export function demanda(m: Partial<Demanda> & { id: string }): Demanda {
  return {
    titulo: `Demanda ${m.id}`,
    distribuidaEm: "2026-10-01",
    prazo: "2026-10-20",
    prioridade: "normal",
    etiquetas: [],
    processos: [],
    checklist: [],
    pausas: [],
    ordem: "a0",
    criadoEm: 1,
    atualizadoEm: 1,
    dispositivo: "dev-a",
    ...m,
  };
}

export function registro(m: Partial<Registro> & { id: string; demanda: string }): Registro {
  return { quando: 1, por: "ana", campo: "criacao", atualizadoEm: 1, dispositivo: "dev-a", ...m };
}
