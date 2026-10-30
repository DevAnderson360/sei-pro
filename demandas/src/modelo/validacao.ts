/** Validação e limpeza dos campos da demanda (spec 3 e 4.3). Só devolve texto de problema; quem grava decide. */

import { type DataISO, deISO, hojeISO } from "@comum/datas/dias";
import { LIMITES } from "./constantes";
import type { Demanda, ItemChecklist } from "./tipos";

export class ErroValidacao extends Error {
  constructor(
    readonly campo: string,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroValidacao";
  }
}

const RE_DATA = /^\d{4}-\d{2}-\d{2}$/;

export function dataValida(x: unknown): x is DataISO {
  if (typeof x !== "string" || !RE_DATA.test(x)) return false;
  try {
    return hojeISO(deISO(x)) === x;
  } catch {
    return false;
  }
}

export const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;
export const idValido = (x: unknown): x is string => typeof x === "string" && RE_ID.test(x);

export const textoAte =
  (max: number) =>
  (x: unknown): x is string =>
    typeof x === "string" && x.length <= max;

/** Corta, tira vazias e repetidas (sem olhar a caixa) e limita a quantidade. */
export function etiquetasLimpas(lista: readonly string[]): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const bruta of lista) {
    const e = bruta.trim().slice(0, LIMITES.etiquetaTexto);
    const k = e.toLocaleLowerCase("pt-BR");
    if (!e || vistas.has(k)) continue;
    vistas.add(k);
    saida.push(e);
    if (saida.length === LIMITES.etiquetas) break;
  }
  return saida;
}

export function checklistLimpo(itens: readonly ItemChecklist[]): ItemChecklist[] {
  return itens
    .map((i) => ({ ...i, texto: i.texto.trim().slice(0, LIMITES.checklistTexto) }))
    .filter((i) => i.texto)
    .slice(0, LIMITES.checklistItens);
}

const PRIORIDADES = new Set(["normal", "importante", "urgente"]);
const tempoOk = (x: unknown) => x === undefined || (typeof x === "number" && Number.isInteger(x) && x >= 0 && x <= LIMITES.tempoMin);

/** Cada problema é "campo: mensagem". Vazio = a demanda é gravável. */
export function problemasDaDemanda(d: Pick<Demanda, "titulo" | "prazo" | "distribuidaEm"> & Partial<Demanda>): string[] {
  const p: string[] = [];
  if (typeof d.titulo !== "string" || !d.titulo.trim()) p.push("titulo: informe o título");
  else if (d.titulo.length > LIMITES.titulo) p.push(`titulo: passa de ${LIMITES.titulo} caracteres`);
  if (d.descricao !== undefined && !textoAte(LIMITES.descricao)(d.descricao)) p.push(`descricao: passa de ${LIMITES.descricao} caracteres`);
  if (!dataValida(d.distribuidaEm)) p.push("distribuidaEm: data inválida");
  if (!dataValida(d.prazo)) p.push("prazo: data inválida");
  else if (dataValida(d.distribuidaEm) && d.prazo < d.distribuidaEm) p.push("prazo: não pode ser antes da distribuição");
  if (d.prioridade !== undefined && !PRIORIDADES.has(d.prioridade)) p.push("prioridade: valor inválido");
  if ((d.etiquetas?.length ?? 0) > LIMITES.etiquetas) p.push(`etiquetas: no máximo ${LIMITES.etiquetas}`);
  if ((d.processos?.length ?? 0) > LIMITES.processos) p.push(`processos: no máximo ${LIMITES.processos}`);
  if ((d.checklist?.length ?? 0) > LIMITES.checklistItens) p.push(`checklist: no máximo ${LIMITES.checklistItens} itens`);
  if ((d.pausas?.length ?? 0) > LIMITES.pausas) p.push(`pausas: no máximo ${LIMITES.pausas}`);
  if (!tempoOk(d.tempoEstimadoMin)) p.push("tempoEstimadoMin: minutos inteiros e positivos");
  if (!tempoOk(d.tempoGastoMin)) p.push("tempoGastoMin: minutos inteiros e positivos");
  if (d.observacaoConclusao !== undefined && !textoAte(LIMITES.observacao)(d.observacaoConclusao))
    p.push(`observacaoConclusao: passa de ${LIMITES.observacao} caracteres`);
  return p;
}

export function conferirDemanda(d: Pick<Demanda, "titulo" | "prazo" | "distribuidaEm"> & Partial<Demanda>): void {
  const p = problemasDaDemanda(d)[0];
  if (!p) return;
  const i = p.indexOf(": ");
  throw new ErroValidacao(p.slice(0, i), p.slice(i + 2));
}
