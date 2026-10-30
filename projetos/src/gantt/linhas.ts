/**
 * Linhas da vista do projeto (lista à esquerda + Gantt à direita, uma linha
 * para cada, na mesma ordem) e do portfólio ("Todos": uma linha por projeto).
 * Puro: sem DOM e sem Frappe. Etapas sem fase vêm primeiro, sem cabeçalho;
 * depois cada fase (na ordem manual) com as suas etapas, se não recolhida.
 */

import { compararEtapas, type OrdemEtapas, porOrdem } from "../modelo/operacoes";
import { progressoDaEtapa } from "../modelo/progresso";
import { type ResumoFase, type ResumoProjeto, resumoDeEtapas, resumoDoProjeto } from "../modelo/resumo";
import { type SituacaoEtapa, situacaoEtapa } from "../modelo/situacao";
import type { DataISO, Etapa, Fase, Projeto, Vis } from "../modelo/tipos";

export interface LinhaFase {
  tipo: "fase";
  /** "fase-<id>": a Frappe usa o id em seletor CSS (sem ":" nem espaço). */
  id: string;
  fase: Fase;
  resumo: ResumoFase;
  recolhida: boolean;
  /** Datas da barra-resumo (fase vazia: hoje, e a barra fica invisível). */
  inicio: DataISO;
  fim: DataISO;
}

export interface LinhaEtapa {
  tipo: "etapa";
  id: string;
  etapa: Etapa;
  situacao: SituacaoEtapa;
  progresso: number;
  /** Só as dependências que estão na tela (a Frappe quebra ao arrastar com dependência ausente). */
  dependeDe: string[];
}

export interface LinhaProjeto {
  tipo: "projeto";
  id: string;
  projeto: Projeto;
  vis: Vis;
  resumo: ResumoProjeto;
  inicio: DataISO;
  fim: DataISO;
}

export type Linha = LinhaFase | LinhaEtapa | LinhaProjeto;

export const idLinhaFase = (faseId: string): string => `fase-${faseId}`;

export interface OpcoesLinhas {
  hoje: DataISO;
  ordem: OrdemEtapas;
  /** Ids de fases recolhidas. */
  recolhidas: ReadonlySet<string>;
  /** Ids das etapas que passam no filtro; ausente = todas. Com filtro, fase sem etapa visível some. */
  visiveis?: ReadonlySet<string>;
}

/** Fases e etapas podem vir do escopo inteiro: só as do `projeto` entram. */
export function linhasDoProjeto(dados: { projeto: string; fases: readonly Fase[]; etapas: readonly Etapa[] }, op: OpcoesLinhas): Linha[] {
  const fases = dados.fases.filter((f) => f.removidoEm === undefined && f.projeto === dados.projeto).sort(porOrdem);
  const idsFases = new Set(fases.map((f) => f.id));
  const vivas = dados.etapas.filter((e) => e.removidoEm === undefined && e.projeto === dados.projeto);
  const mostradas = op.visiveis ? vivas.filter((e) => op.visiveis!.has(e.id)) : vivas;
  const ordenar = compararEtapas(op.ordem);
  const linhaEtapa = (e: Etapa, naTela: ReadonlySet<string>): LinhaEtapa => ({
    tipo: "etapa",
    id: e.id,
    etapa: e,
    situacao: situacaoEtapa(e, op.hoje),
    progresso: progressoDaEtapa(e, op.hoje),
    dependeDe: e.dependeDe.filter((d) => naTela.has(d)),
  });
  const soltas = mostradas.filter((e) => !e.fase || !idsFases.has(e.fase)).sort(ordenar);
  const grupos = fases.map((f) => ({
    fase: f,
    todas: vivas.filter((e) => e.fase === f.id),
    mostradas: mostradas.filter((e) => e.fase === f.id).sort(ordenar),
  }));
  const naTela = new Set<string>([
    ...soltas.map((e) => e.id),
    ...grupos.filter((g) => !op.recolhidas.has(g.fase.id)).flatMap((g) => g.mostradas.map((e) => e.id)),
  ]);
  const linhas: Linha[] = soltas.map((e) => linhaEtapa(e, naTela));
  for (const g of grupos) {
    if (op.visiveis && !g.mostradas.length) continue;
    const resumo = resumoDeEtapas(g.todas, op.hoje);
    const recolhida = op.recolhidas.has(g.fase.id);
    linhas.push({
      tipo: "fase",
      id: idLinhaFase(g.fase.id),
      fase: g.fase,
      resumo,
      recolhida,
      inicio: resumo.inicio ?? op.hoje,
      fim: resumo.fim ?? op.hoje,
    });
    if (!recolhida) for (const e of g.mostradas) linhas.push(linhaEtapa(e, naTela));
  }
  return linhas;
}

/**
 * "Todos": uma linha por projeto ativo (arquivado fica no diálogo dos
 * arquivados; projeto sem etapas aparece, com a barra invisível em hoje).
 */
export function linhasDoPortfolio(
  itens: ReadonlyArray<{ projeto: Projeto; vis: Vis; etapas: readonly Etapa[] }>,
  hoje: DataISO,
): LinhaProjeto[] {
  return itens
    .filter((i) => i.projeto.removidoEm === undefined && i.projeto.arquivadoEm === undefined)
    .map((i) => {
      const resumo = resumoDoProjeto(
        i.etapas.filter((e) => e.projeto === i.projeto.id),
        hoje,
      );
      return {
        tipo: "projeto",
        id: i.projeto.id,
        projeto: i.projeto,
        vis: i.vis,
        resumo,
        inicio: resumo.inicio ?? hoje,
        fim: resumo.fim ?? hoje,
      };
    });
}
