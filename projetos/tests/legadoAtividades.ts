/** Projetos como o servidor do Atividades devolve (`padrao.projetos`, backend/functions.php listProjetos/listEtapas). */

export const SENTINELA = "0000-00-00 00:00:00";

export function etapaLegada(m: Record<string, unknown> & { id_etapa: unknown }): Record<string, unknown> {
  return {
    id_projeto: 42,
    id_dependencia: false,
    id_demandas: false,
    id_demandas_titles: false,
    nome_etapa: `Etapa ${m.id_etapa}`,
    processo_sei: false,
    id_procedimento: false,
    config: [],
    responsavel: false,
    data_inicio_programado: "2026-03-02 00:00:00",
    data_fim_programado: "2026-03-13 00:00:00",
    data_inicio_progresso_automatico: SENTINELA,
    data_fim_progresso_automatico: SENTINELA,
    observacoes: false,
    macroetapa: false,
    grupo: false,
    etiqueta: false,
    data_inicio_execucao: SENTINELA,
    data_fim_execucao: false,
    progresso_execucao: false,
    documento_relacionado: false,
    id_documento_sei: false,
    documento_sei: false,
    ativo: true,
    data_inicio: "2026-02-20 10:00:00",
    data_fim: SENTINELA,
    datetime: "2026-02-20 10:00:00",
    primarykey: "id_etapa",
    ...m,
  };
}

export function projetoLegado(m: Record<string, unknown> & { id_projeto: unknown }): Record<string, unknown> {
  return {
    etapas: [],
    id_unidade: 7,
    sigla_unidade: "SEPRO",
    projetos_compartilhados: false,
    id_cadeia_valor: false,
    id_tipo_projeto: 3,
    tipo_projeto: "Normativo",
    config: [],
    nome_projeto: `Projeto ${m.id_projeto}`,
    processo_sei: "50300.000123/2026-01",
    id_procedimento: 9911,
    data_inicio: "2026-02-20 10:00:00",
    data_fim: SENTINELA,
    ativo: true,
    datetime: "2026-02-20 10:00:00",
    primarykey: "id_projeto",
    ...m,
  };
}

/** Um projeto com tudo o que o mapeamento da spec 6.3 cobre. */
export function projetoCompleto(): Record<string, unknown> {
  return projetoLegado({
    id_projeto: 42,
    nome_projeto: "Revisão da Resolução 1",
    etapas: [
      etapaLegada({
        id_etapa: 1,
        nome_etapa: "Minuta",
        macroetapa: "Instrução",
        grupo: "Jurídico",
        etiqueta: "urgente; revisão",
        responsavel: "Ana Lima",
        observacoes: "Ver parecer",
        documento_sei: "1234567",
        documento_relacionado: "Nota Técnica 5",
        data_inicio_execucao: "2026-03-03 09:00:00",
        data_fim_execucao: "2026-03-12 18:00:00",
        progresso_execucao: "100",
        id_demandas_titles: [
          { id_demanda: 900, nome_atividade: "Elaborar minuta", data_entrega: "2026-03-10 12:00:00" },
          { id_demanda: 901, nome_atividade: false, assunto: "Revisar", data_entrega: SENTINELA },
        ],
      }),
      etapaLegada({
        id_etapa: 2,
        nome_etapa: "Consulta pública",
        macroetapa: "Consulta",
        id_dependencia: 1,
        data_inicio_programado: "2026-03-16 00:00:00",
        data_fim_programado: "2026-04-15 00:00:00",
        data_inicio_progresso_automatico: "2026-03-16 00:00:00",
        processo_sei: "50300.000777/2026-02",
        id_procedimento: 7788,
      }),
      etapaLegada({
        id_etapa: 3,
        nome_etapa: "Sem datas",
        data_inicio_programado: SENTINELA,
        data_fim_programado: SENTINELA,
        id_dependencia: 99,
        macroetapa: "Instrução",
      }),
    ],
  });
}
