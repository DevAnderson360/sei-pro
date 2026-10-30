/**
 * Os campos dos projetos do servidor do Atividades que a importação lê (spec 6.3), num lugar só: a aba
 * (pagina/atividades.ts) devolve ao app só eles, e o app (importacao/atividades.ts) só copia eles. O resto do que
 * o servidor manda (com quem o projeto é compartilhado, `config`, apelidos e requisições das demandas…) não sai
 * da aba. Sem dependências: entra no content script sem levar o modelo junto.
 */

export const CAMPOS_PROJETO = [
  "id_projeto",
  "nome_projeto",
  "sigla_unidade",
  "tipo_projeto",
  "processo_sei",
  "id_procedimento",
  "data_inicio",
  "data_fim",
  "ativo",
] as const;

export const CAMPOS_ETAPA = [
  "id_etapa",
  "id_dependencia",
  "nome_etapa",
  "processo_sei",
  "id_procedimento",
  "responsavel",
  "data_inicio_programado",
  "data_fim_programado",
  "data_inicio_progresso_automatico",
  "observacoes",
  "macroetapa",
  "grupo",
  "etiqueta",
  "data_inicio_execucao",
  "data_fim_execucao",
  "progresso_execucao",
  "documento_relacionado",
  "documento_sei",
  "data_inicio",
] as const;

export const CAMPOS_DEMANDA = ["id_demanda", "nome_atividade", "assunto", "data_entrega"] as const;

const objeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** Só as chaves de `campos` que o objeto tem de verdade (nada herdado). */
export function escolher<K extends string>(x: Record<string, unknown>, campos: readonly K[]): Partial<Record<K, unknown>> {
  const saida: Partial<Record<K, unknown>> = {};
  for (const k of campos) if (Object.hasOwn(x, k)) saida[k] = x[k];
  return saida;
}

function demandas(x: unknown): unknown {
  return Array.isArray(x) ? x.map((d) => (objeto(d) ? escolher(d, CAMPOS_DEMANDA) : d)) : x;
}

function etapa(e: unknown): unknown {
  if (!objeto(e)) return e;
  const saida: Record<string, unknown> = escolher(e, CAMPOS_ETAPA);
  if (Object.hasOwn(e, "id_demandas_titles")) saida.id_demandas_titles = demandas(e.id_demandas_titles);
  return saida;
}

/**
 * Cada projeto só com os campos lidos (com as etapas e as demandas também cortadas). O que não é objeto passa como
 * veio: quem confere a forma é o app. Nada é cortado em quantidade aqui (as etapas e as demandas a mais são
 * contadas do lado do app).
 */
export function soOsCampos(projetos: readonly unknown[]): unknown[] {
  return projetos.map((p) => {
    if (!objeto(p)) return p;
    const saida: Record<string, unknown> = escolher(p, CAMPOS_PROJETO);
    if (Object.hasOwn(p, "etapas")) saida.etapas = Array.isArray(p.etapas) ? p.etapas.map(etapa) : p.etapas;
    return saida;
  });
}
