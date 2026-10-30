/** Valores que os filtros rápidos oferecem (com contagem), a partir do que está carregado. */
import type { Ctx } from './contexto';
import { FAIXAS_PRAZO, faixaDoPrazo } from './grupos';
import type { Processo } from './tipos';

export interface Faceta {
  /** Valor para o operador (`resp:<valor>`). */
  valor: string;
  rotulo: string;
  n: number;
}

const colador = new Intl.Collator('pt-BR', { sensitivity: 'base', numeric: true });

function contar(processos: Processo[], chaves: (p: Processo) => Array<{ valor: string; rotulo: string }>): Faceta[] {
  const m = new Map<string, Faceta>();
  for (const p of processos) {
    for (const c of chaves(p)) {
      const f = m.get(c.valor) ?? { valor: c.valor, rotulo: c.rotulo, n: 0 };
      f.n += 1;
      m.set(c.valor, f);
    }
  }
  return [...m.values()].sort((a, b) => b.n - a.n || colador.compare(a.rotulo, b.rotulo));
}

export interface Facetas {
  responsaveis: Faceta[];
  tipos: Faceta[];
  marcadores: Faceta[];
  prazos: Faceta[];
}

export function facetasDe(processos: Processo[], ctx: Ctx): Facetas {
  const prazos = contar(processos, (p) => {
    const f = faixaDoPrazo(p, ctx);
    const rotulo = FAIXAS_PRAZO.find((x) => x[0] === f)![1];
    const valor = f === 'atrasado' ? 'atrasado' : f === 'hoje' ? 'hoje' : f === 'semana' ? 'semana' : f === 'sem' ? 'sem' : f === 'concluido' ? 'concluido' : '';
    return valor ? [{ valor, rotulo }] : [];
  });
  return {
    responsaveis: contar(processos, (p) => (p.atribuicao ? [{ valor: p.atribuicao.sigla, rotulo: `${p.atribuicao.nome} (${p.atribuicao.sigla})` }] : [{ valor: 'sem', rotulo: 'Sem responsável' }])),
    tipos: contar(processos, (p) => (p.tipo ? [{ valor: p.tipo, rotulo: p.tipo }] : [])),
    marcadores: contar(processos, (p) => (p.marcadores.length ? p.marcadores.map((m) => ({ valor: m.nome, rotulo: m.nome })) : [{ valor: 'sem', rotulo: 'Sem marcador' }])),
    prazos,
  };
}
