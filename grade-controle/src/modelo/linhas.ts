/** Achata os grupos numa lista única de linhas (cabeçalho de grupo + processos), respeitando os recolhidos. */
import type { GrupoLista } from './grupos';
import type { Processo } from './tipos';

export type LinhaLista =
  | { tipo: 'grupo'; grupo: GrupoLista; recolhido: boolean }
  | { tipo: 'processo'; processo: Processo; grupo: string };

export function achatar(grupos: GrupoLista[], recolhidos: ReadonlySet<string>, comCabecalho: boolean): LinhaLista[] {
  const saida: LinhaLista[] = [];
  for (const g of grupos) {
    const recolhido = comCabecalho && recolhidos.has(g.chave);
    if (comCabecalho) saida.push({ tipo: 'grupo', grupo: g, recolhido });
    if (!recolhido) for (const p of g.itens) saida.push({ tipo: 'processo', processo: p, grupo: g.chave });
  }
  return saida;
}
