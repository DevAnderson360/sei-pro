/**
 * O que o painel mostra da unidade atual: os projetos dos dois escopos
 * ("Toda a unidade" e "Só eu") juntos, cada um com as suas fases e etapas, o
 * resumo e os alertas. Puro sobre `Dados` do repositório (o content script usa
 * o mesmo cálculo para as pílulas do título).
 */

import { alertasDasEtapas } from "../modelo/alertas";
import { porOrdem } from "../modelo/operacoes";
import { type ResumoProjeto, resumoDoProjeto } from "../modelo/resumo";
import type { DataISO, Etapa, Fase, Modelo, Projeto, Vis } from "../modelo/tipos";
import { MODELOS_EMBUTIDOS } from "../modelos/embutidos";
import type { Dados, RepositorioProjetos } from "../repositorio";

export interface ProjetoNaTela {
  projeto: Projeto;
  vis: Vis;
  fases: Fase[];
  etapas: Etapa[];
  resumo: ResumoProjeto;
}

export type ModeloNaTela = Modelo & { vis?: Vis };

export interface DadosUnidade {
  /** Projetos ativos, na ordem das abas. */
  ativos: ProjetoNaTela[];
  arquivados: ProjetoNaTela[];
  /** Embutidos primeiro; depois os salvos (com o escopo). */
  modelos: ModeloNaTela[];
}

/** Etapa viva com fase removida aparece "sem fase" (o id morto fica gravado; a tela não usa). */
export function etapasComFaseViva(etapas: readonly Etapa[], fases: readonly Fase[]): Etapa[] {
  const vivas = new Set(fases.map((f) => f.id));
  return etapas.map((e) => {
    if (!e.fase || vivas.has(e.fase)) return e;
    const { fase: _morta, ...resto } = e;
    return resto;
  });
}

export function montarUnidade(porVis: ReadonlyArray<{ vis: Vis; dados: Dados }>, hoje: DataISO): DadosUnidade {
  const todos: ProjetoNaTela[] = [];
  const modelos: ModeloNaTela[] = [...MODELOS_EMBUTIDOS];
  for (const { vis, dados } of porVis) {
    for (const projeto of dados.projetos) {
      const fases = dados.fases.filter((f) => f.projeto === projeto.id);
      const etapas = etapasComFaseViva(
        dados.etapas.filter((e) => e.projeto === projeto.id),
        fases,
      );
      todos.push({ projeto, vis, fases, etapas, resumo: resumoDoProjeto(etapas, hoje) });
    }
    modelos.push(...dados.modelos.map((m) => ({ ...m, vis })));
  }
  todos.sort((a, b) => porOrdem(a.projeto, b.projeto));
  return {
    ativos: todos.filter((p) => p.projeto.arquivadoEm === undefined),
    arquivados: todos.filter((p) => p.projeto.arquivadoEm !== undefined),
    modelos,
  };
}

export async function carregarUnidade(repos: Readonly<Record<Vis, RepositorioProjetos>>, hoje: DataISO): Promise<DadosUnidade> {
  const [un, eu] = await Promise.all([repos.unidade.dados(), repos.eu.dados()]);
  return montarUnidade(
    [
      { vis: "unidade", dados: un },
      { vis: "eu", dados: eu },
    ],
    hoje,
  );
}

export interface AlertasUnidade {
  atrasadas: number;
  semana: number;
  /** Ids dos projetos com etapa atrasada (a pílula abre o projeto se for só um). */
  comAtraso: string[];
  comSemana: string[];
}

export function alertasDaUnidade(ativos: ReadonlyArray<Pick<ProjetoNaTela, "projeto" | "etapas">>, hoje: DataISO): AlertasUnidade {
  const saida: AlertasUnidade = { atrasadas: 0, semana: 0, comAtraso: [], comSemana: [] };
  for (const { projeto, etapas } of ativos) {
    if (projeto.arquivadoEm !== undefined) continue;
    const a = alertasDasEtapas(etapas, hoje);
    saida.atrasadas += a.atrasadas.length;
    saida.semana += a.semana.length;
    if (a.atrasadas.length) saida.comAtraso.push(projeto.id);
    if (a.semana.length) saida.comSemana.push(projeto.id);
  }
  return saida;
}
