/** Ordenação multi-critério e estável. Sem valor, vai sempre para o fim (qualquer sentido). */
import type { Ctx } from './contexto';
import { diasNaCaixa, diasParado, resumoDoPrazo } from './derivados';
import type { CampoOrdem, CriterioOrdem, Processo } from './tipos';

const colador = new Intl.Collator('pt-BR', { numeric: true, sensitivity: 'base' });

/** Número do SEI por ano e depois sequência ("...000032/2025-82" -> 2025, 32); sem o padrão, comparação natural. */
export function chaveProtocolo(protocolo: string): [number, number] | null {
  const m = /(\d+)\/(\d{4})-\d+\s*$/.exec(protocolo);
  if (!m) return null;
  const sequencia = /(\d+)\s*$/.exec(m[1]!.split(/[.-]/).pop() ?? '')?.[1] ?? m[1]!;
  return [Number(m[2]), Number(sequencia)];
}

function compararProtocolo(a: string, b: string): number {
  const ka = chaveProtocolo(a);
  const kb = chaveProtocolo(b);
  if (ka && kb) return ka[0] - kb[0] || ka[1] - kb[1] || colador.compare(a, b);
  return colador.compare(a, b);
}

type Valor = number | string | null;

function valorDe(p: Processo, campo: Exclude<CampoOrdem, 'protocolo'>, ctx: Ctx): Valor {
  switch (campo) {
    case 'tipo':
      return p.tipo || null;
    case 'responsavel':
      return p.atribuicao?.sigla ?? null;
    case 'marcador':
      return p.marcadores[0]?.nome ?? null;
    case 'prazo': {
      const r = resumoDoPrazo(p, ctx);
      // Concluído e "desde" vão depois dos vencimentos reais (ordem enorme no resumo).
      return r ? r.ordem : null;
    }
    case 'caixa':
      // Mais antigo = mais dias; ordem crescente por "tempo na caixa" põe os recentes primeiro.
      return diasNaCaixa(p, ctx);
    case 'parado':
      return diasParado(p, ctx);
    case 'novo':
      return p.naoVisualizado ? 0 : 1;
  }
}

export function comparador(criterios: CriterioOrdem[], ctx: Ctx): (a: Processo, b: Processo) => number {
  return (a, b) => {
    for (const c of criterios) {
      let r: number;
      if (c.campo === 'protocolo') {
        r = compararProtocolo(a.protocolo, b.protocolo);
        if (c.decrescente) r = -r;
      } else {
        const va = valorDe(a, c.campo, ctx);
        const vb = valorDe(b, c.campo, ctx);
        if (va === null && vb === null) continue;
        if (va === null) return 1;
        if (vb === null) return -1;
        r = typeof va === 'number' && typeof vb === 'number' ? va - vb : colador.compare(String(va), String(vb));
        if (c.decrescente) r = -r;
      }
      if (r) return r;
    }
    return 0;
  };
}

export function ordenar(processos: Processo[], criterios: CriterioOrdem[], ctx: Ctx): Processo[] {
  if (!criterios.length) return processos;
  return [...processos].sort(comparador(criterios, ctx));
}

/** Clique no cabeçalho: alterna asc -> desc -> sem ordem; com `acrescentar` (Shift) mantém os outros critérios. */
export function alternarOrdem(atual: CriterioOrdem[], campo: CampoOrdem, acrescentar: boolean): CriterioOrdem[] {
  const i = atual.findIndex((c) => c.campo === campo);
  const proximo = i < 0 ? { campo, decrescente: false } : !atual[i]!.decrescente ? { campo, decrescente: true } : null;
  if (!acrescentar) return proximo ? [proximo] : [];
  if (i < 0) return [...atual, proximo!];
  const copia = [...atual];
  if (proximo) copia[i] = proximo;
  else copia.splice(i, 1);
  return copia;
}
