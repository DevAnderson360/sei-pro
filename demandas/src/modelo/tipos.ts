/**
 * Tipos do Gestor de Demandas (spec 3). Toda entidade guardada é `Entidade`
 * (carimbo da mesclagem por entidade, `@comum/sincronia/entidade`, mais quem a
 * alterou por último). Datas civis são `DataISO` ("AAAA-MM-DD", fuso local;
 * nunca `toISOString()`); instantes são milissegundos.
 */

import type { Carimbo, DataISO, DocumentoSei, Entidade, Escopo, ItemChecklist, Responsavel, Vinculo, Vis } from "@projetos/modelo/tipos";

export type { Carimbo, DataISO, DocumentoSei, Entidade, Escopo, ItemChecklist, Responsavel, Vinculo, Vis };

export type Prioridade = "normal" | "importante" | "urgente";

/** As três "tabelas" do Texto Padrão: demandas ativas, arquivadas e histórico. */
export type Tabela = "d" | "a" | "h";

export interface Pausa {
  inicio: number;
  fim?: number;
}

export interface Avaliacao {
  nota: 1 | 2 | 3 | 4 | 5;
  comentario?: string;
  /** Login de quem avaliou. */
  por: string;
  em: number;
}

/** Ligação com uma etapa do Gestor de Projetos; `rotulo` ("Projeto > Etapa") deixa exibir sem o Projetos. */
export interface EtapaRef {
  projeto: string;
  etapa: string;
  rotulo: string;
}

export interface Demanda extends Entidade {
  titulo: string;
  descricao?: string;
  responsavel?: Responsavel;
  distribuidaEm: DataISO;
  prazo: DataISO;
  /** Fixado na primeira prorrogação. */
  prazoOriginal?: DataISO;
  prioridade: Prioridade;
  etiquetas: string[];
  processos: Vinculo[];
  checklist: ItemChecklist[];
  tempoEstimadoMin?: number;
  tempoGastoMin?: number;
  etapa?: EtapaRef;
  iniciadaEm?: number;
  pausas: Pausa[];
  concluidaEm?: DataISO;
  observacaoConclusao?: string;
  documentoEntregue?: DocumentoSei;
  avaliacao?: Avaliacao;
  arquivadoEm?: number;
  /** Índice fracionário: ordem dentro da coluna do quadro. */
  ordem: string;
  criadoEm: number;
}

export type CampoHistorico =
  | "criacao"
  | "exclusao"
  | "restauracao"
  | "titulo"
  | "responsavel"
  | "prazo"
  | "prioridade"
  | "inicio"
  | "pausa"
  | "retomada"
  | "conclusao"
  | "reabertura"
  | "avaliacao"
  | "arquivamento"
  | "desarquivamento"
  | "etapa"
  | "visibilidade";

/** Registro de alteração: só se acrescenta; a mescla é a união. */
export interface Registro extends Entidade {
  demanda: string;
  quando: number;
  /** Login. */
  por: string;
  nome?: string;
  campo: CampoHistorico;
  antes?: string;
  depois?: string;
  /** Obrigatório na prorrogação. */
  motivo?: string;
}

/** Tudo de um escopo, inclusive lápides (sincronia, arquivo). `d` = todas as demandas, arquivadas ou não. */
export interface Entidades {
  d: Demanda[];
  h: Registro[];
}

export interface EnvelopeDemandas {
  formato: "seipro-demandas";
  versao: 1;
  tabela: Tabela;
  host: string;
  unidade: string;
  vis: Vis;
  /** Só no escopo "eu". */
  login?: string;
  gerado: number;
  /** Tabela `d` e `a` levam só `d`; a `h` leva só `h` (a outra lista vai vazia). */
  entidades: Entidades;
}
