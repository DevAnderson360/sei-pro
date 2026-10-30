/** Textos curtos do app: datas, tempo, rótulos de situação e de prazo, linhas do histórico. */

import { diferencaDias, formatarData, hojeISO } from "@comum/datas/dias";
import { dataDeFormulario, dataValida, plural, quandoRelativo, quemDoRegistro } from "@projetos/app/formato";
import type { EstadoPrazo, Situacao } from "../modelo/situacao";
import type { CampoHistorico, Registro } from "../modelo/tipos";
import type { DemandaNaTela } from "./dados";

export { dataDeFormulario, dataValida, formatarData as dataLonga, plural, quandoRelativo, quemDoRegistro };

/** "06/10". */
export function dataCurta(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

/** "1 h 30 min", "45 min", "2 h"; sem valor, "—". */
export function tempoHumano(min?: number): string {
  if (min === undefined) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** O tempo como se digita no campo: "1h30", "2h", "45min"; vazio sem valor. */
export function tempoParaCampo(min?: number): string {
  if (min === undefined) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m}min`;
  return m ? `${h}h${String(m).padStart(2, "0")}` : `${h}h`;
}

/** "1h30", "1:30", "90", "2h", "45min" -> minutos; vazio -> undefined; inválido -> null. */
export function lerTempo(texto: string): number | undefined | null {
  const t = texto.trim().toLowerCase().replace(/\s+/g, "");
  if (!t) return undefined;
  let m = /^(\d+)(?:h|:)(\d{1,2})(?:min)?$/.exec(t);
  if (m) return Number(m[2]) > 59 ? null : Number(m[1]) * 60 + Number(m[2]);
  m = /^(\d+)h$/.exec(t);
  if (m) return Number(m[1]) * 60;
  m = /^(\d+)(?:min)?$/.exec(t);
  if (m) return Number(m[1]);
  return null;
}

export const rotuloDaSituacao: Record<Situacao, string> = {
  nao_iniciada: "Não iniciada",
  iniciada: "Iniciada",
  pausada: "Pausada",
  concluida: "Concluída",
  avaliada: "Avaliada",
  arquivada: "Arquivada",
};

export const rotuloDaColuna: Record<Situacao, string> = {
  nao_iniciada: "Não iniciadas",
  iniciada: "Iniciadas",
  pausada: "Pausadas",
  concluida: "Concluídas",
  avaliada: "Avaliadas",
  arquivada: "Arquivadas",
};

/** A cor de cada situação (só tokens do base.css). */
export const tomDaSituacao: Record<Situacao, string> = {
  nao_iniciada: "var(--spro-fraco)",
  iniciada: "var(--spro-destaque)",
  pausada: "var(--spro-aviso)",
  concluida: "var(--spro-ok)",
  avaliada: "var(--spro-novidade)",
  arquivada: "var(--spro-suave)",
};

export const tomDoPrazo: Record<EstadoPrazo, string> = {
  atrasada: "var(--spro-perigo)",
  concluida_no_prazo: "var(--spro-ok)",
  concluida_fora_do_prazo: "var(--spro-aviso)",
  no_prazo: "var(--spro-suave)",
};

export function rotuloDoPrazo(d: Pick<DemandaNaTela, "prazo" | "diasAtraso" | "demanda">, hoje?: string): string {
  switch (d.prazo) {
    case "atrasada":
      return `Atrasada há ${plural(d.diasAtraso, "dia", "dias")}`;
    case "concluida_no_prazo":
      return "Entregue no prazo";
    case "concluida_fora_do_prazo":
      return "Entregue com atraso";
    default: {
      if (hoje === undefined) return "No prazo";
      if (d.demanda.prazo === hoje) return "Vence hoje";
      return `Vence em ${plural(diferencaDias(hoje, d.demanda.prazo), "dia", "dias")}`;
    }
  }
}

const ROTULO_CAMPO: Partial<Record<CampoHistorico, string>> = {
  titulo: "título",
  responsavel: "responsável",
  prazo: "prazo",
  prioridade: "prioridade",
  etapa: "etapa",
  visibilidade: "quem vê",
};

const vazio = (v: string | undefined) => (v === undefined || v === "" ? "—" : v);
const valor = (campo: CampoHistorico, v: string | undefined): string =>
  campo === "prazo" && v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? formatarData(v) : vazio(v);

/** "prazo 20/10/2026 → 27/10/2026"; o texto vem do texto da unidade, entra só como texto. */
export function textoDoRegistroDemanda(r: Pick<Registro, "campo" | "antes" | "depois">): string {
  switch (r.campo) {
    case "criacao":
      return "criou a demanda";
    case "exclusao":
      return "excluiu a demanda";
    case "restauracao":
      return "restaurou a demanda";
    case "inicio":
      return r.antes ? `voltou a não iniciada` : "iniciou";
    case "pausa":
      return "pausou";
    case "retomada":
      return "retomou";
    case "conclusao":
      return r.depois ? `concluiu (${valor("prazo", r.depois)})` : "concluiu";
    case "reabertura":
      return "reabriu";
    case "avaliacao":
      return r.depois ? `avaliou com nota ${r.depois}` : "cancelou a avaliação";
    case "arquivamento":
      return "arquivou";
    case "desarquivamento":
      return "desarquivou";
    default: {
      const rotulo = Object.hasOwn(ROTULO_CAMPO, r.campo) ? ROTULO_CAMPO[r.campo] : String(r.campo).slice(0, 40);
      return `${rotulo} ${valor(r.campo, r.antes)} → ${valor(r.campo, r.depois)}`;
    }
  }
}

/** Data do carimbo ("06/10/2026"), ou "--/--/----" se o carimbo não vira data. */
export const dataDoCarimbo = (ms: number): string => (dataValida(ms) ? formatarData(hojeISO(new Date(ms))) : "--/--/----");
