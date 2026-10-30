/** Valores calculados de um processo (prazo resumido, dias na caixa, "novo"), compartilhados por busca, ordem e grupos. */
import { resumir } from '../../../prazos/src/modelo/situacao';
import type { Resumo } from '../../../prazos/src/modelo/tipos';
import { diferencaDias } from '../../../sei-comum/src/datas/dias';
import type { Ctx } from './contexto';
import { DIA_MS } from './contexto';
import type { Processo } from './tipos';

export function resumoDoPrazo(p: Processo, ctx: Ctx): Resumo | null {
  return p.prazo ? resumir(p.prazo, ctx.hoje) : null;
}

/** Dias (inteiros) desde que o SEI Pro viu o processo; `null` sem registro. */
export function diasNaCaixa(p: Processo, ctx: Ctx): number | null {
  if (p.vistoEm === undefined) return null;
  return Math.max(0, Math.floor((ctx.agora - p.vistoEm) / DIA_MS));
}

/** Dias desde a última movimentação (só a visão detalhada do SEI informa); `null` sem a data. */
export function diasParado(p: Processo, ctx: Ctx): number | null {
  return p.ultimaMov ? Math.max(0, diferencaDias(p.ultimaMov, ctx.hoje)) : null;
}

/** Chegou depois da visita anterior (nunca na primeira vez: sem referência não há "novo"). */
export function novoDesdeUltimaVisita(p: Processo, ctx: Ctx): boolean {
  return ctx.visitaAnterior !== undefined && p.vistoEm !== undefined && p.vistoEm > ctx.visitaAnterior;
}

/** Dias até o vencimento (negativo = atrasado); `null` sem vencimento ou concluído. */
export function diasParaVencer(p: Processo, ctx: Ctx): number | null {
  const r = resumoDoPrazo(p, ctx);
  if (!r || r.situacao === 'concluido' || r.situacao === 'desde') return null;
  return r.ordem;
}

export const responsavelDe = (p: Processo): string => p.atribuicao?.sigla ?? '';
