/**
 * Os 3 modelos de exemplo (spec 5.4), sempre disponíveis e nunca gravados:
 * textos neutros, sem nome de pessoa. Datas em dias úteis a partir do início
 * (`aPartirDe`) e duração em dias úteis (marco: 0). A "Revisão normativa"
 * começando em 03/08/2026 dá exatamente as datas da tela 1.
 */

import type { EtapaModelo, Modelo } from "../modelo/tipos";

const etapa = (
  nome: string,
  fase: number,
  aPartirDe: number,
  duracao: number,
  dependeDe: number[] = [],
  checklist: string[] = [],
): EtapaModelo => ({
  nome,
  fase,
  aPartirDe,
  duracao,
  marco: false,
  dependeDe,
  checklist,
});

const marco = (nome: string, fase: number, aPartirDe: number, dependeDe: number[] = []): EtapaModelo => ({
  nome,
  fase,
  aPartirDe,
  duracao: 0,
  marco: true,
  dependeDe,
  checklist: [],
});

const embutido = (id: string, nome: string, descricao: string, fases: string[], etapas: EtapaModelo[]): Modelo => ({
  id,
  nome,
  descricao,
  fases,
  etapas,
  criadoEm: 0,
  atualizadoEm: 0,
  dispositivo: "embutido",
});

export const PREFIXO_EMBUTIDO = "embutido:";

export const MODELOS_EMBUTIDOS: readonly Modelo[] = [
  embutido(
    `${PREFIXO_EMBUTIDO}revisao-normativa`,
    "Revisão normativa",
    "Instrução, consulta pública e deliberação de uma norma.",
    ["Instrução", "Consulta pública", "Deliberação"],
    [
      etapa("Nota técnica preliminar", 0, 0, 15),
      etapa("Análise jurídica", 0, 15, 14, [0]),
      etapa(
        "Relatório de AIR",
        0,
        21,
        18,
        [0],
        ["Levantar dados do setor", "Identificar alternativas regulatórias", "Analisar custos e benefícios"],
      ),
      marco("Aviso de consulta publicado", 1, 30, [1]),
      etapa("Período de contribuições", 1, 30, 22, [3]),
      etapa("Consolidação das contribuições", 1, 52, 15, [4]),
      etapa("Minuta final", 2, 67, 14, [5, 2]),
      marco("Reunião de Diretoria", 2, 84, [6]),
      marco("Publicação no DOU", 2, 89, [7]),
    ],
  ),
  embutido(
    `${PREFIXO_EMBUTIDO}pregao-eletronico`,
    "Contratação por pregão eletrônico",
    "Planejamento, seleção do fornecedor e contrato.",
    ["Planejamento", "Seleção", "Contrato"],
    [
      etapa("Documento de formalização da demanda", 0, 0, 5),
      etapa("Estudo técnico preliminar", 0, 5, 15, [0]),
      etapa("Pesquisa de preços", 0, 10, 10, [0]),
      etapa("Termo de referência", 0, 20, 10, [1]),
      etapa("Parecer jurídico", 0, 30, 10, [3, 2]),
      marco("Edital publicado", 1, 40, [4]),
      marco("Sessão pública do pregão", 1, 50, [5]),
      etapa("Julgamento e habilitação", 1, 50, 5, [6]),
      marco("Adjudicação e homologação", 1, 55, [7]),
      marco("Contrato assinado", 2, 60, [8]),
      etapa("Designação da fiscalização", 2, 60, 3, [9]),
    ],
  ),
  embutido(
    `${PREFIXO_EMBUTIDO}plano-anual`,
    "Plano anual",
    "Um ano de trabalho dividido em trimestres.",
    ["1º trimestre", "2º trimestre", "3º trimestre", "4º trimestre"],
    [0, 1, 2, 3].flatMap((t) => {
      const base = t * 63;
      const i = t * 3;
      const anterior = t === 0 ? [] : [i - 1];
      return [
        etapa(`Planejamento do ${t + 1}º trimestre`, t, base, 5, anterior),
        etapa(`Execução do ${t + 1}º trimestre`, t, base + 5, 55, [i]),
        marco(`Relatório do ${t + 1}º trimestre`, t, base + 60, [i + 1]),
      ];
    }),
  ),
];

export function ehEmbutido(id: string): boolean {
  return id.startsWith(PREFIXO_EMBUTIDO);
}
