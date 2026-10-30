/**
 * Mini-Gantt do painel lateral (tela 3): sem Frappe, só posições em % sobre um
 * eixo de meses inteiros (do 1º dia do mês do primeiro início ao último dia do
 * mês do último término). Cada mês fica onde ele começa (por data, não em
 * colunas iguais); com muitos meses, só alguns rótulos (até 8), e o ano entra
 * quando muda ("jan/27"). Puro: o componente do lateral desenha.
 */

import { type DataISO, diferencaDias, somarDias } from "@comum/datas/dias";
import { dataNaFaixa } from "../modelo/calendario";
import type { SituacaoEtapa } from "../modelo/situacao";
import type { Linha } from "./linhas";

export interface MesMini {
  rotulo: string;
  /** % do eixo onde o mês começa. */
  pos: number;
}

export type LinhaMini =
  | { tipo: "fase"; id: string; nome: string }
  | { tipo: "etapa"; id: string; nome: string; situacao: SituacaoEtapa; marco: boolean; esquerda: number; largura: number };

export interface MiniGantt {
  meses: MesMini[];
  /** % do eixo de hoje; null fora do período. */
  hoje: number | null;
  linhas: LinhaMini[];
}

const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MAX_ROTULOS = 8;

const primeiroDoMes = (iso: DataISO): DataISO => `${iso.slice(0, 7)}-01`;
const proximoMes = (iso: DataISO): DataISO => {
  const a = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  return m === 12 ? `${a + 1}-01-01` : `${a}-${String(m + 1).padStart(2, "0")}-01`;
};
const arredondar = (n: number) => Math.round(n * 100) / 100;
const limitar = (n: number) => Math.max(0, Math.min(100, n));

export function miniGantt(linhas: readonly Linha[], hoje: DataISO): MiniGantt {
  const etapas = linhas.flatMap((l) => (l.tipo === "etapa" && dataNaFaixa(l.etapa.inicio) && dataNaFaixa(l.etapa.fim) ? [l.etapa] : []));
  const menor = etapas.reduce<DataISO>((m, e) => (e.inicio < m ? e.inicio : m), etapas[0]?.inicio ?? hoje);
  const maior = etapas.reduce<DataISO>((m, e) => (e.fim > m ? e.fim : m), etapas[0]?.fim ?? hoje);
  const comeco = primeiroDoMes(menor);
  const fim = somarDias(proximoMes(maior), -1);
  const total = diferencaDias(comeco, fim) + 1;
  const pos = (iso: DataISO) => arredondar(limitar((diferencaDias(comeco, iso) / total) * 100));
  const inicios: DataISO[] = [];
  for (let d = comeco; d <= fim; d = proximoMes(d)) inicios.push(d);
  const passo = Math.ceil(inicios.length / MAX_ROTULOS);
  // O ano entra no rótulo quando muda (no primeiro, não: é o do período).
  const meses = inicios
    .filter((_, i) => i % passo === 0)
    .map((d, i, l) => {
      const mes = MESES[Number(d.slice(5, 7)) - 1] ?? "";
      const mudouAno = i > 0 && l[i - 1]?.slice(0, 4) !== d.slice(0, 4);
      return { rotulo: mudouAno ? `${mes}/${d.slice(2, 4)}` : mes, pos: pos(d) };
    });
  const saida: LinhaMini[] = [];
  for (const l of linhas) {
    if (l.tipo === "fase") saida.push({ tipo: "fase", id: l.id, nome: l.fase.nome });
    else if (l.tipo === "etapa") {
      const e = l.etapa;
      const valida = dataNaFaixa(e.inicio) && dataNaFaixa(e.fim) && e.fim >= e.inicio;
      saida.push({
        tipo: "etapa",
        id: e.id,
        nome: e.nome,
        situacao: l.situacao,
        marco: e.marco,
        esquerda: valida ? pos(e.inicio) : 0,
        largura: valida ? arredondar(limitar(((diferencaDias(e.inicio, e.fim) + 1) / total) * 100)) : 0,
      });
    }
  }
  return { meses, hoje: hoje >= comeco && hoje <= fim ? pos(hoje) : null, linhas: saida };
}
