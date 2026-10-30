/**
 * Tipos do gestor de projetos (spec 5.2). Toda entidade guardada é `Versionada`
 * (carimbo da mesclagem por entidade, `@comum/sincronia/entidade`) e leva quem a
 * alterou por último (`alteradoPor`, o login). Datas civis são `DataISO`
 * ("AAAA-MM-DD", fuso local; nunca `toISOString()`).
 */

import type { DataISO } from "@comum/datas/dias";
import type { Versionada } from "@comum/sincronia/entidade";

export type { DataISO };

/** "unidade": Texto Padrão compartilhado da unidade; "eu": só o usuário (nesta unidade). */
export type Vis = "unidade" | "eu";

export interface Escopo {
  host: string;
  /** Sempre em minúsculas na chave (ver `chaveEscopo`). */
  login: string;
  /** id da unidade no SEI. */
  unidade: string;
  vis: Vis;
}

export interface Entidade extends Versionada {
  /** Login de quem gravou a versão atual (o histórico guarda o resto). */
  alteradoPor?: string;
}

export interface Vinculo {
  protocolo: string;
  idProcedimento?: string;
  /** Sigiloso: o número nunca vai ao Texto Padrão nem ao Agente (vai como vínculo vazio). */
  sigiloso?: boolean;
}

export interface Projeto extends Entidade {
  nome: string;
  processo?: Vinculo;
  /** Texto livre (o "Tipo de projeto" e o "Grupo" do legado viram etiquetas). */
  etiquetas: string[];
  /** Índice fracionário (ordem das abas). */
  ordem: string;
  criadoEm: number;
  arquivadoEm?: number;
  origem?: { atividades?: number };
}

export interface Fase extends Entidade {
  projeto: string;
  nome: string;
  ordem: string;
}

export type Medida = "manual" | "tempo" | "checklist";

export interface ItemChecklist {
  id: string;
  texto: string;
  feito: boolean;
}

export interface Responsavel {
  login?: string;
  nome: string;
}

export interface DocumentoSei {
  /** Número SEI. */
  numero: string;
  titulo?: string;
  /**
   * Documento de processo sigiloso: nunca vai ao Texto Padrão. Marca gravada aqui quando a etapa é
   * sigilosa (modelo/sigilo.ts) e que fica, mesmo que a etapa deixe de ser (troca de processo).
   */
  sigiloso?: boolean;
}

export interface LinhaDeBase {
  inicio: DataISO;
  fim: DataISO;
}

export interface Etapa extends Entidade {
  projeto: string;
  fase?: string;
  ordem: string;
  nome: string;
  inicio: DataISO;
  /** Inclusive. Marco: igual ao início. */
  fim: DataISO;
  marco: boolean;
  /** Ids de etapas do MESMO projeto. */
  dependeDe: string[];
  responsavel?: Responsavel;
  medida: Medida;
  /** 0 a 100; só vale com medida "manual". */
  progresso: number;
  checklist: ItemChecklist[];
  processo?: Vinculo;
  documento?: DocumentoSei;
  etiquetas: string[];
  observacoes?: string;
  concluidaEm?: DataISO;
  /** Plano original (spec 5.4). */
  base?: LinhaDeBase;
  criadoEm: number;
  origem?: { atividades?: number };
}

/** Registro de alteração: só se acrescenta; a mescla é a união. */
export interface Registro extends Entidade {
  /** id da entidade alterada (projeto, fase ou etapa). */
  alvo: string;
  projeto: string;
  quando: number;
  /** Login. */
  por: string;
  /** Nome do usuário lido do SEI. */
  nome?: string;
  campo: CampoHistorico;
  antes?: string;
  depois?: string;
}

export type CampoHistorico =
  | "criacao"
  | "exclusao"
  | "restauracao"
  | "nome"
  | "inicio"
  | "fim"
  | "responsavel"
  | "conclusao"
  | "progresso"
  | "fase"
  | "dependencias"
  | "processo"
  | "documento"
  | "arquivamento"
  | "visibilidade"
  | "base";

export interface EtapaModelo {
  nome: string;
  /** Índice em `Modelo.fases`. */
  fase?: number;
  /** Dias úteis contados do início do projeto (0 = o primeiro dia). */
  aPartirDe: number;
  /** Dias úteis ocupados (inclusive). Marco: 0. */
  duracao: number;
  marco: boolean;
  /** Índices em `Modelo.etapas`. */
  dependeDe: number[];
  checklist: string[];
}

export interface Modelo extends Entidade {
  nome: string;
  descricao?: string;
  fases: string[];
  etapas: EtapaModelo[];
  criadoEm: number;
}

/** Quando, de onde e por quem: é o que a mesclagem e o histórico usam. */
export interface Carimbo {
  agora: number;
  dispositivo: string;
  /** Login de quem grava (vira `alteradoPor`). */
  por?: string;
  /** Nome do usuário (vai para o `Registro`). */
  nome?: string;
}

/** Tudo de um escopo, inclusive lápides (sincronia, arquivo). */
export interface Entidades {
  p: Projeto[];
  f: Fase[];
  e: Etapa[];
  h: Registro[];
  m: Modelo[];
}

/** Envelope do Texto Padrão e do arquivo (spec 6.1). */
export interface EnvelopeProjetos {
  formato: "seipro-projetos";
  versao: 1;
  host: string;
  unidade: string;
  vis: Vis;
  /** Só no escopo "eu". */
  login?: string;
  /** Quando foi gerado (ms). */
  gerado: number;
  entidades: Entidades;
}

/** Mudança de datas (arraste no Gantt ou deslocamento de dependentes). */
export interface MudancaDeDatas {
  id: string;
  inicio: DataISO;
  fim: DataISO;
}
