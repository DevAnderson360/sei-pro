/** Projeto de exemplo do Gantt: etapa solta, 3 fases (uma vazia), marco, concluída e um nome hostil. */

import { etapa, fase } from "./fabrica";

export const HOSTIL = '<img src=x onerror="alert(1)"> & "aspas" ção 🙂';

export function cenario() {
  const fases = [
    fase({ id: "f1", nome: "Instrução", ordem: "a0" }),
    fase({ id: "f2", nome: "Deliberação", ordem: "a1" }),
    fase({ id: "f3", nome: "Vazia", ordem: "a2" }),
  ];
  const etapas = [
    etapa({ id: "solta", nome: "Etapa solta", inicio: "2026-10-01", fim: "2026-10-02" }),
    etapa({
      id: "e1",
      nome: HOSTIL,
      fase: "f1",
      inicio: "2026-09-01",
      fim: "2026-10-02",
      base: { inicio: "2026-09-01", fim: "2026-09-25" },
    }),
    etapa({ id: "e2", nome: "Análise", fase: "f1", inicio: "2026-10-05", fim: "2026-10-09", dependeDe: ["e1"] }),
    etapa({ id: "m1", nome: "Reunião", fase: "f2", marco: true, inicio: "2026-10-20", fim: "2026-10-20", dependeDe: ["e2"] }),
    etapa({ id: "ok", nome: "Feita", fase: "f2", inicio: "2026-09-01", fim: "2026-09-05", concluidaEm: "2026-09-05" }),
  ];
  return { fases, etapas };
}
