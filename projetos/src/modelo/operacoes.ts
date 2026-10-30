/**
 * Operações puras (molde: `favoritos/src/modelo/operacoes.ts`): nada aqui toca
 * o armazenamento nem o DOM. Toda gravação recebe o carimbo (quando, de onde,
 * quem), que é o que a mesclagem e o histórico usam.
 */

import { somarDias } from "@comum/datas/dias";
import { FERIADOS, fimPorDuracao, proximoUtil } from "./calendario";
import { DIAS_ETAPA_NOVA } from "./constantes";
import { baseInicial } from "./linhaDeBase";
import type {
  Carimbo,
  DataISO,
  DocumentoSei,
  Entidade,
  Etapa,
  Fase,
  ItemChecklist,
  LinhaDeBase,
  Medida,
  Projeto,
  Responsavel,
  Vinculo,
} from "./tipos";
import { checklistLimpo, etiquetasLimpas, nomeLimpo } from "./validacao";

export type OrdemEtapas = "inicio" | "nome" | "cadastro";

type Mudancas<T> = Partial<Omit<T, "id" | "atualizadoEm" | "dispositivo">>;

/** Chaves com `undefined` saem do objeto: o storage guarda menos e "apagar campo" fica explícito. */
export function semVazios<T extends object>(o: T): T {
  for (const k of Object.keys(o)) if ((o as Record<string, unknown>)[k] === undefined) delete (o as Record<string, unknown>)[k];
  return o;
}

/**
 * Carimbo da gravação: o relógio, mas sempre acima do carimbo que o item já tem. Um item que chegou
 * com o relógio de outro computador adiantado não fica imune à edição local (senão a versão dele
 * venceria todas as mesclagens até o relógio daqui alcançar o dele).
 */
function carimboSeguinte(item: Entidade, agora: number): number {
  return Number.isFinite(item.atualizadoEm) ? Math.max(agora, item.atualizadoEm + 1) : agora;
}

export function editar<T extends Entidade>(item: T, mudancas: Mudancas<T>, c: Carimbo): T {
  return semVazios({
    ...item,
    ...mudancas,
    atualizadoEm: carimboSeguinte(item, c.agora),
    dispositivo: c.dispositivo,
    alteradoPor: c.por ?? item.alteradoPor,
  } as T);
}

export function remover<T extends Entidade>(item: T, c: Carimbo): T {
  return editar(item, { removidoEm: c.agora } as Mudancas<T>, c);
}

export function restaurar<T extends Entidade>(item: T, c: Carimbo): T {
  return editar(item, { removidoEm: undefined } as Mudancas<T>, c);
}

/** Ordem manual: chave fracionária com < e >, desempate pelo id. */
export function porOrdem(a: { ordem: string; id: string }, b: { ordem: string; id: string }): number {
  if (a.ordem !== b.ordem) return a.ordem < b.ordem ? -1 : 1;
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

/** Ordenação das etapas escolhida no menu (spec 3.1): início, nome ou cadastro. */
export function compararEtapas(ordem: OrdemEtapas): (a: Etapa, b: Etapa) => number {
  if (ordem === "nome") return (a, b) => a.nome.localeCompare(b.nome, "pt-BR", { sensitivity: "base" }) || porOrdem(a, b);
  if (ordem === "cadastro") return (a, b) => a.criadoEm - b.criadoEm || porOrdem(a, b);
  return (a, b) => (a.inicio !== b.inicio ? (a.inicio < b.inicio ? -1 : 1) : a.fim !== b.fim ? (a.fim < b.fim ? -1 : 1) : porOrdem(a, b));
}

export interface DadosNovoProjeto {
  nome: string;
  processo?: Vinculo;
  etiquetas?: string[];
  origem?: { atividades?: number };
  arquivadoEm?: number;
}

export function novoProjeto(d: DadosNovoProjeto, id: string, ordem: string, c: Carimbo): Projeto {
  return semVazios({
    id,
    nome: nomeLimpo(d.nome),
    processo: d.processo,
    etiquetas: etiquetasLimpas(d.etiquetas ?? []),
    ordem,
    criadoEm: c.agora,
    arquivadoEm: d.arquivadoEm,
    origem: d.origem,
    atualizadoEm: c.agora,
    dispositivo: c.dispositivo,
    alteradoPor: c.por,
  });
}

export function novaFase(projeto: string, nome: string, id: string, ordem: string, c: Carimbo): Fase {
  return semVazios({
    id,
    projeto,
    nome: nomeLimpo(nome),
    ordem,
    atualizadoEm: c.agora,
    dispositivo: c.dispositivo,
    alteradoPor: c.por,
  });
}

export interface DadosNovaEtapa {
  projeto: string;
  nome: string;
  inicio: DataISO;
  fim: DataISO;
  fase?: string;
  marco?: boolean;
  dependeDe?: string[];
  responsavel?: Responsavel;
  medida?: Medida;
  progresso?: number;
  checklist?: ItemChecklist[];
  processo?: Vinculo;
  documento?: DocumentoSei;
  etiquetas?: string[];
  observacoes?: string;
  concluidaEm?: DataISO;
  /** Sem base, ela nasce com as datas da etapa (a importação traz o programado do legado). */
  base?: LinhaDeBase;
  origem?: { atividades?: number };
}

export function novaEtapa(d: DadosNovaEtapa, id: string, ordem: string, c: Carimbo): Etapa {
  const marco = !!d.marco;
  const fim = marco ? d.inicio : d.fim;
  const base = d.base ?? baseInicial(d.inicio, fim);
  return semVazios({
    id,
    projeto: d.projeto,
    fase: d.fase,
    ordem,
    nome: nomeLimpo(d.nome),
    inicio: d.inicio,
    fim,
    marco,
    dependeDe: [...new Set(d.dependeDe ?? [])],
    responsavel: d.responsavel,
    medida: d.medida ?? "manual",
    progresso: Math.min(100, Math.max(0, Math.round(d.progresso ?? 0))),
    checklist: checklistLimpo(d.checklist ?? []),
    processo: d.processo,
    documento: d.documento,
    etiquetas: etiquetasLimpas(d.etiquetas ?? []),
    observacoes: d.observacoes?.trim() ? d.observacoes : undefined,
    concluidaEm: d.concluidaEm,
    base: marco ? { inicio: base.inicio, fim: base.inicio } : base,
    criadoEm: c.agora,
    origem: d.origem,
    atualizadoEm: c.agora,
    dispositivo: c.dispositivo,
    alteradoPor: c.por,
  });
}

/**
 * Concluir com 1 clique: a data de hoje (spec 3.2); o documento é opcional (ausente = fica o que a
 * etapa tinha; `null` = tira o documento, como "Informar documento" com o campo vazio).
 */
export function concluir(e: Etapa, hoje: DataISO, c: Carimbo, documento?: DocumentoSei | null): Etapa {
  return editar(e, { concluidaEm: hoje, documento: documento === null ? undefined : (documento ?? e.documento) }, c);
}

export function reabrir(e: Etapa, c: Carimbo): Etapa {
  return editar(e, { concluidaEm: undefined }, c);
}

/**
 * "Adicionar etapa… (Enter)" (spec 3.1): começa no primeiro dia útil depois do
 * término da última etapa (sem etapas: hoje, ou o próximo dia útil) e dura 5
 * dias úteis.
 */
export function datasDaEtapaNova(
  etapas: ReadonlyArray<Pick<Etapa, "fim" | "removidoEm">>,
  hoje: DataISO,
  feriados: ReadonlySet<DataISO> = FERIADOS,
): { inicio: DataISO; fim: DataISO } {
  const ultimo = etapas.reduce<DataISO | undefined>(
    (m, e) => (e.removidoEm === undefined && (m === undefined || e.fim > m) ? e.fim : m),
    undefined,
  );
  const inicio = proximoUtil(ultimo ? somarDias(ultimo, 1) : hoje, feriados);
  return { inicio, fim: fimPorDuracao(inicio, DIAS_ETAPA_NOVA, feriados) };
}
