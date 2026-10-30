/**
 * "Na caixa há N dias" e "novo desde a última visita".
 *
 * O SEI não põe a data de chegada na linha. Guardamos o instante em que o SEI Pro viu cada processo pela primeira
 * vez na unidade; o rótulo diz isso. Só se esquece um processo (poda) depois de uma carga COMPLETA: com a leitura
 * pela metade, quem estava na página ainda não lida seria apagado e voltaria como "novo".
 */
import { DIA_MS } from './contexto';
import type { Processo } from './tipos';

export interface EstadoIdade {
  /** id do processo -> primeira vez visto (ms). */
  vistoEm: Record<string, number>;
  /** Início da visita corrente (a mais recente com mais de `JANELA_VISITA` desde a anterior). */
  visitaAtual?: number;
  /** Início da visita anterior: referência de "novo". */
  visitaAnterior?: number;
}

/** Recarregar a página dentro da mesma meia hora é a MESMA visita. */
export const JANELA_VISITA = 30 * 60_000;
/** Teto de ids guardados, para o storage não crescer sem limite. */
export const MAX_REGISTROS = 5000;

export const estadoVazio = (): EstadoIdade => ({ vistoEm: {} });

export function normalizarEstado(bruto: unknown): EstadoIdade {
  if (!bruto || typeof bruto !== 'object') return estadoVazio();
  const b = bruto as Record<string, unknown>;
  const vistoEm: Record<string, number> = {};
  if (b.vistoEm && typeof b.vistoEm === 'object') {
    for (const [id, t] of Object.entries(b.vistoEm as Record<string, unknown>)) if (typeof t === 'number' && Number.isFinite(t) && t > 0) vistoEm[id] = t;
  }
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
  const e: EstadoIdade = { vistoEm };
  const atual = num(b.visitaAtual);
  const anterior = num(b.visitaAnterior);
  if (atual !== undefined) e.visitaAtual = atual;
  if (anterior !== undefined) e.visitaAnterior = anterior;
  return e;
}

/** Abre a visita: vira a página se a anterior passou da janela. Não muda o que já está dentro da janela. */
export function abrirVisita(e: EstadoIdade, agora: number): EstadoIdade {
  if (e.visitaAtual === undefined) return { ...e, visitaAtual: agora };
  if (agora - e.visitaAtual > JANELA_VISITA) return { ...e, visitaAnterior: e.visitaAtual, visitaAtual: agora };
  return e;
}

/**
 * Registra os processos vistos. `completo` = a leitura cobriu todas as páginas: só então somem os ausentes.
 * Devolve um estado novo (o recebido não é alterado).
 */
export function registrarVistos(e: EstadoIdade, ids: string[], agora: number, completo: boolean): EstadoIdade {
  const vistoEm = { ...e.vistoEm };
  for (const id of ids) if (vistoEm[id] === undefined) vistoEm[id] = agora;
  if (completo) {
    const presentes = new Set(ids);
    for (const id of Object.keys(vistoEm)) if (!presentes.has(id)) delete vistoEm[id];
  }
  const chaves = Object.keys(vistoEm);
  if (chaves.length > MAX_REGISTROS) {
    for (const id of chaves.sort((a, b) => vistoEm[b]! - vistoEm[a]!).slice(MAX_REGISTROS)) delete vistoEm[id];
  }
  return { ...e, vistoEm };
}

/** Põe `vistoEm` nos processos (nova lista; os objetos de entrada não são alterados). */
export function comIdade(processos: Processo[], e: EstadoIdade): Processo[] {
  return processos.map((p) => (e.vistoEm[p.id] !== undefined ? { ...p, vistoEm: e.vistoEm[p.id]! } : p));
}

export function rotuloIdade(dias: number | null): string {
  if (dias === null) return '';
  if (dias < 1) return 'hoje';
  if (dias === 1) return '1 dia';
  if (dias < 60) return `${dias} dias`;
  const meses = Math.floor(dias / 30);
  return meses < 24 ? `${meses} meses` : `${Math.floor(dias / 365)} anos`;
}

export const DICA_IDADE = 'Contado desde a primeira vez que o SEI Pro viu o processo nesta unidade (o SEI não informa a data de chegada).';
export { DIA_MS };
