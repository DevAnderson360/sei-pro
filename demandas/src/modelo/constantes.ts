/** Limites do spec (seção 3 e 4.3) e chaves de armazenamento (seção 4.1). */

import type { Tabela, Vis } from "./tipos";

export const LIMITES = {
  titulo: 200,
  descricao: 2000,
  etiquetas: 10,
  etiquetaTexto: 40,
  processos: 5,
  checklistItens: 50,
  checklistTexto: 200,
  pausas: 20,
  observacao: 2000,
  comentario: 500,
  motivo: 200,
  /** Cada lado (`antes`/`depois`) de um registro do histórico. */
  registroValor: 400,
  /** Login e nome de quem gravou, rótulo da etapa, id do dispositivo. */
  rotulo: 100,
  /** Minutos: um ano de trabalho contínuo é o teto de um tempo informado. */
  tempoMin: 60 * 24 * 365,
  /** A chave da ordem manual (índice fracionário). */
  ordem: 1000,
  /** Demandas não arquivadas por escopo que o repositório aceita criar. */
  ativas: 3000,
  /** Registros do histórico que a exportação leva ao texto (os mais recentes); o resto fica no local e no arquivo. */
  historicoNoTexto: 1500,
  /** Registros do histórico que o local guarda por escopo; acima, a importação recusa e a gravação poda os mais antigos. */
  historicoLocal: 5000,
} as const;

/** Registro do histórico com `quando` antes disto (2000-01-01) vem de um relógio quebrado ou é forjado. */
export const QUANDO_MINIMO = Date.UTC(2000, 0, 1);

/** Relógio de outro computador adiantado que a mesclagem ainda aceita (1 dia). */
export const FOLGA_RELOGIO_MS = 86_400_000;

export const DIAS_LAPIDE_UNIDADE = 180;
export const DIAS_LAPIDE_EU = 90;
export const diasDeLapide = (vis: Vis): number => (vis === "unidade" ? DIAS_LAPIDE_UNIDADE : DIAS_LAPIDE_EU);

/** O CKEditor 5 baixa o conteúdo de todos os textos da unidade: teto e aviso por texto (spec 4.3). */
export const TETO_TEXTO = 100 * 1024;
export const AVISO_TEXTO = 80 * 1024;
export const AVISO_PESO_TOTAL = 200 * 1024;
export const AVISO_ARQUIVO = 5 * 1024 * 1024;
export const AVISO_ATIVAS = 800;

/** Quantidades que nenhum texto legítimo de 100 KB alcança: acima, o texto é tratado como inválido. */
export const TETOS_ENVELOPE: Readonly<Record<Tabela, number>> = { d: 3000, a: 10_000, h: 15_000 };

export const FORMATO = "seipro-demandas";
export const VERSAO = 1;

export const PREFIXO = "demandas/";
export const CHAVE_PREFERENCIAS = "demandas/preferencias";
export const CHAVE_LATERAL = "demandas/lateralAberto";
export const chaveSyncTexto = (chaveDoEscopo: string, tabela: Tabela): string => `demandas/sync/tp/${chaveDoEscopo}/${tabela}`;
export const chaveSyncArquivo = (host: string, login: string): string => `demandas/sync/arquivo/${host}|${login.trim().toLowerCase()}`;
