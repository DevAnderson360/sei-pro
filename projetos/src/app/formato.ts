/**
 * Textos curtos do painel: datas, plurais e as linhas do histórico de alterações.
 *
 * O registro do histórico tem teto na importação (repositorio.ts, `entidadeValida`), mas a tela corta mais
 * curto, e o que já estava guardado antes do teto pode ser maior: o campo, os valores e o nome de quem mudou são
 * cortados aqui, num lugar só, para o diálogo "Histórico de alterações" e para a seção Histórico do diálogo da
 * etapa. O carimbo que não vira data (`dataValida`) aparece sem data, nunca "NaN".
 */

import { type DataISO, deISO, diferencaDias, formatarData, hojeISO } from "@comum/datas/dias";
import { SIGILOSO_DOCUMENTO, SIGILOSO_PROCESSO } from "../modelo/sigilo";
import type { CampoHistorico, Registro } from "../modelo/tipos";

export { formatarData as dataLonga };

/** "06/10". */
export function dataCurta(iso: DataISO): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

export function textoDiasUteis(n: number): string {
  return n === 1 ? "1 dia útil" : `${n} dias úteis`;
}

const ROTULO: Partial<Record<CampoHistorico, string>> = {
  nome: "nome",
  inicio: "início",
  fim: "término",
  responsavel: "responsável",
  progresso: "progresso",
  fase: "fase",
  dependencias: "dependências",
  processo: "processo",
  documento: "documento",
  base: "plano original",
};

const COM_ARTIGO: Partial<Record<CampoHistorico, string>> = {
  nome: "o nome",
  inicio: "o início",
  fim: "o término",
  responsavel: "o responsável",
  progresso: "o progresso",
  fase: "a fase",
  dependencias: "as dependências",
  processo: "o processo",
  documento: "o documento",
  base: "o plano original",
  visibilidade: "quem vê",
};

const MAX_CAMPO = 60;
const MAX_VALOR = 200;
const MAX_QUEM = 100;

/** Corta com "…" sem partir um caractere em dois: o par de substitutos de um emoji fica inteiro ou sai. */
function cortar(t: string, max: number): string {
  if (t.length <= max) return t;
  const c = t.charCodeAt(max - 1);
  const fim = c >= 0xd800 && c <= 0xdbff ? max - 1 : max;
  return `${t.slice(0, fim)}…`;
}

/**
 * O rótulo do campo, só das chaves da própria tabela: o campo vem do texto da unidade (versão mais nova ou
 * editado à mão) e "constructor" ou "toString" achariam a função do objeto ("function Object() …"). O campo
 * que esta versão não conhece aparece pelo nome, cortado.
 */
const rotuloDe = (tabela: Partial<Record<CampoHistorico, string>>, campo: CampoHistorico): string =>
  (Object.hasOwn(tabela, campo) ? tabela[campo] : undefined) ?? cortar(String(campo), MAX_CAMPO);

/** O texto de sigilo de cada campo (modelo/sigilo.ts): o número que não vai ao texto da unidade. */
const SIGILO: Partial<Record<CampoHistorico, string>> = { processo: SIGILOSO_PROCESSO, documento: SIGILOSO_DOCUMENTO };

/** O valor é o texto de sigilo do PRÓPRIO campo (uma etapa chamada "processo sigiloso" continua com o nome). */
const ehSigilo = (campo: CampoHistorico, v: string | undefined): boolean =>
  v !== undefined && Object.hasOwn(SIGILO, campo) && SIGILO[campo] === v;

const ehData = (s: string | undefined): boolean => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);

function valor(campo: CampoHistorico, v: string | undefined): string {
  if (v === undefined || v === "") return "—";
  if (ehSigilo(campo, v)) return "sigiloso";
  if (ehData(v)) return dataCurta(v);
  if (campo === "progresso") return `${cortar(v, MAX_VALOR)}%`;
  if (campo === "base") {
    const [a = "", b = ""] = v.split("/");
    if (ehData(a) && ehData(b)) return `${dataCurta(a)} a ${dataCurta(b)}`;
  }
  return cortar(v, MAX_VALOR);
}

/**
 * "término 25/09 → 02/10" (tela 2). `tipo` muda só a criação ("criou a etapa"). O texto de sigilo aparece
 * como "sigiloso" ("processo 50300.000001/2026-11 → sigiloso"); com os dois lados sigilosos, "trocou o
 * processo sigiloso".
 */
export function textoDoRegistro(r: Pick<Registro, "campo" | "antes" | "depois">, tipo?: "etapa" | "projeto" | "fase"): string {
  switch (r.campo) {
    case "criacao":
      return tipo ? `criou ${tipo === "fase" ? "a fase" : tipo === "etapa" ? "a etapa" : "o projeto"}` : "criou";
    case "exclusao":
      return "excluiu";
    case "restauracao":
      return "restaurou";
    case "conclusao":
      return r.depois ? `concluiu (${valor("conclusao", r.depois)})` : "reabriu";
    case "arquivamento":
      return r.depois === "arquivado" ? "arquivou" : "reativou";
    case "visibilidade":
      return `quem vê: ${valor(r.campo, r.antes)} → ${valor(r.campo, r.depois)}`;
    default:
      if (ehSigilo(r.campo, r.antes) && ehSigilo(r.campo, r.depois)) return `trocou ${rotuloDe(COM_ARTIGO, r.campo)} sigiloso`;
      return `${rotuloDe(ROTULO, r.campo)} ${valor(r.campo, r.antes)} → ${valor(r.campo, r.depois)}`;
  }
}

/** O carimbo vira uma data de verdade (um registro forjado ou antigo pode trazer qualquer número). */
export const dataValida = (ms: number): boolean => !Number.isNaN(new Date(ms).getTime());

/** "06/10" do carimbo, ou "--/--" se ele não vira data. */
export const dataCurtaDoCarimbo = (ms: number): string => (dataValida(ms) ? dataCurta(hojeISO(new Date(ms))) : "--/--");

/** "hoje", "ontem", "há 3 dias" (até 30) ou "em 01/07/2026"; "em data desconhecida" se o carimbo não vira data. */
export function quandoRelativo(ms: number, agora: number): string {
  if (!dataValida(ms) || !dataValida(agora)) return "em data desconhecida";
  const dias = diferencaDias(hojeISO(new Date(ms)), hojeISO(new Date(agora)));
  if (dias <= 0) return "hoje";
  if (dias === 1) return "ontem";
  if (dias <= 30) return `há ${dias} dias`;
  return `em ${formatarData(hojeISO(new Date(ms)))}`;
}

/** Quem mudou: o nome lido do SEI, o login ou "Alguém" (cortado: o nome vem do texto da unidade). */
export const quemDoRegistro = (r: Pick<Registro, "nome" | "por">): string => cortar(r.nome || r.por || "Alguém", MAX_QUEM);

/** Resumo da seção Histórico do diálogo da etapa: "Carla Dias alterou o término há 2 dias". */
export function resumoDoUltimoRegistro(r: Registro, agora: number): string {
  const quem = quemDoRegistro(r);
  let feito: string;
  if (r.campo === "criacao") feito = "criou a etapa";
  else if (r.campo === "conclusao") feito = r.depois ? "concluiu" : "reabriu";
  else if (r.campo === "exclusao") feito = "excluiu";
  else if (r.campo === "restauracao") feito = "restaurou";
  else feito = `alterou ${rotuloDe(COM_ARTIGO, r.campo)}`;
  return `${quem} ${feito} ${quandoRelativo(r.quando, agora)}`;
}

/** Data de formulário válida e dentro do calendário de feriados (2000 a 2100), ou null. */
export function dataDeFormulario(v: string): DataISO | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
  const ano = Number(v.slice(0, 4));
  if (ano < 2000 || ano > 2100) return null;
  return hojeISO(deISO(v)) === v ? v : null;
}
