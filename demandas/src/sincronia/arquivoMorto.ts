import { type DataISO, diferencaDias } from "@comum/datas/dias";
import { TETOS_ENVELOPE } from "../modelo/constantes";
import { situacaoBase } from "../modelo/situacao";
import type { Demanda, Entidades, Escopo, Registro, Vis } from "../modelo/tipos";

export const FORMATO_ARQUIVO_MORTO = "seipro-demandas-arquivo";

export function candidatasAoArquivamento(demandas: readonly Demanda[], o: { hoje: DataISO; dias: number }): Demanda[] {
  return demandas.filter((d) => {
    if (d.removidoEm !== undefined || d.arquivadoEm !== undefined || !d.concluidaEm) return false;
    const s = situacaoBase(d);
    return (s === "concluida" || s === "avaliada") && diferencaDias(d.concluidaEm, o.hoje) > o.dias;
  });
}

export function estimarLiberacao(candidatas: readonly Demanda[]): { quantidade: number; bytes: number } {
  return { quantidade: candidatas.length, bytes: new TextEncoder().encode(JSON.stringify(candidatas)).length };
}

export interface ArquivoMorto {
  formato: typeof FORMATO_ARQUIVO_MORTO;
  versao: 1;
  host: string;
  unidade: string;
  vis: Vis;
  login: string;
  gerado: number;
  ate: DataISO;
  demandas: Demanda[];
  registros: Registro[];
}

export function montarArquivoMorto(ent: Entidades, escopo: Escopo, antesDe: DataISO, agora: number): ArquivoMorto {
  const demandas = ent.d.filter(
    (d) => d.removidoEm === undefined && d.arquivadoEm !== undefined && d.concluidaEm !== undefined && d.concluidaEm < antesDe,
  );
  const ids = new Set(demandas.map((d) => d.id));
  return {
    formato: FORMATO_ARQUIVO_MORTO,
    versao: 1,
    host: escopo.host,
    unidade: escopo.unidade,
    vis: escopo.vis,
    login: escopo.login.trim().toLowerCase(),
    gerado: agora,
    ate: antesDe,
    demandas,
    registros: ent.h.filter((r) => ids.has(r.demanda)),
  };
}

export const nomeDoArquivoMorto = (_escopo: Escopo, antesDe: DataISO): string => `demandas-arquivo-${antesDe}.json`;

/** Mais itens do que o teto do envelope (`TETOS_ENVELOPE`): nenhum arquivo legitimo chega la. */
export function arquivoMortoGrandeDemais(bruto: unknown): boolean {
  if (typeof bruto !== "object" || bruto === null) return false;
  const b = bruto as Partial<ArquivoMorto>;
  return (
    (Array.isArray(b.demandas) && b.demandas.length > TETOS_ENVELOPE.a) ||
    (Array.isArray(b.registros) && b.registros.length > TETOS_ENVELOPE.h)
  );
}

export function lerArquivoMorto(bruto: unknown): ArquivoMorto | null {
  const b = bruto as Partial<ArquivoMorto> | null;
  if (!b || typeof b !== "object" || b.formato !== FORMATO_ARQUIVO_MORTO || b.versao !== 1) return null;
  if (!Array.isArray(b.demandas) || !Array.isArray(b.registros)) return null;
  if (arquivoMortoGrandeDemais(b)) return null;
  return b as ArquivoMorto;
}
