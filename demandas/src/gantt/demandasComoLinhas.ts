/**
 * Adapta as demandas às linhas do Gantt do Projetos (lista à esquerda e Gantt à direita), reaproveitando
 * `montarGantt` inteiro. Cada demanda é uma "etapa" sintética de `distribuidaEm` a `prazo`; o grupo é uma "fase".
 * Sem dependências na v1 (R3 do roteiro).
 */

import type { DataISO } from "@comum/datas/dias";
import { idLinhaFase, type Linha, type LinhaEtapa, type LinhaFase } from "@projetos/gantt/linhas";
import { resumoDeEtapas } from "@projetos/modelo/resumo";
import type { Etapa, Fase } from "@projetos/modelo/tipos";
import type { DemandaNaTela } from "../app/dados";
import { chaveResponsavel, SEM_RESPONSAVEL } from "../modelo/filtro";
import type { Situacao } from "../modelo/situacao";

const ROTULO: Record<Situacao, string> = {
  nao_iniciada: "Não iniciada",
  iniciada: "Iniciada",
  pausada: "Pausada",
  concluida: "Concluída",
  avaliada: "Avaliada",
  arquivada: "Arquivada",
};
const ORDEM_SITUACAO: readonly Situacao[] = ["nao_iniciada", "iniciada", "pausada", "concluida", "avaliada", "arquivada"];

function situacaoDaLinha(x: DemandaNaTela): LinhaEtapa["situacao"] {
  if (x.situacao === "concluida" || x.situacao === "avaliada" || x.situacao === "arquivada") return "concluida";
  if (x.prazo === "atrasada") return "atrasada";
  if (x.situacao === "iniciada" || x.situacao === "pausada") return "andamento";
  return "futura";
}

function progresso(x: DemandaNaTela): number {
  const d = x.demanda;
  if (d.concluidaEm) return 100;
  if (d.checklist.length) return Math.round((d.checklist.filter((i) => i.feito).length / d.checklist.length) * 100);
  return x.situacao === "iniciada" || x.situacao === "pausada" ? 50 : 0;
}

function etapaSintetica(x: DemandaNaTela): Etapa {
  const d = x.demanda;
  return {
    id: d.id,
    projeto: "demandas",
    ordem: d.ordem,
    nome: d.titulo,
    inicio: d.distribuidaEm,
    fim: d.prazo < d.distribuidaEm ? d.distribuidaEm : d.prazo,
    marco: false,
    dependeDe: [],
    medida: "checklist",
    progresso: 0,
    checklist: d.checklist,
    etiquetas: d.etiquetas,
    ...(d.responsavel ? { responsavel: d.responsavel } : {}),
    ...(d.concluidaEm ? { concluidaEm: d.concluidaEm } : {}),
    criadoEm: d.criadoEm,
    atualizadoEm: d.atualizadoEm,
    dispositivo: d.dispositivo,
  };
}

export function demandasComoLinhas(itens: readonly DemandaNaTela[], o: { hoje: DataISO; agrupar: "responsavel" | "situacao" }): Linha[] {
  const grupos = new Map<string, { nome: string; itens: DemandaNaTela[]; ordem: number }>();
  for (const x of itens) {
    const chave = o.agrupar === "responsavel" ? chaveResponsavel(x.demanda.responsavel) : x.situacao;
    const nome = o.agrupar === "responsavel" ? (x.demanda.responsavel?.nome ?? "Sem responsável") : ROTULO[x.situacao];
    const g = grupos.get(chave) ?? {
      nome,
      itens: [],
      ordem: o.agrupar === "situacao" ? ORDEM_SITUACAO.indexOf(x.situacao) : chave === SEM_RESPONSAVEL ? 1 : 0,
    };
    g.itens.push(x);
    grupos.set(chave, g);
  }
  const ordenados = [...grupos.entries()].sort(([, a], [, b]) => a.ordem - b.ordem || a.nome.localeCompare(b.nome, "pt-BR"));
  const linhas: Linha[] = [];
  for (const [chave, g] of ordenados) {
    const resumo = resumoDeEtapas(g.itens.map(etapaSintetica), o.hoje);
    const fase: Fase = {
      id: chave.replace(/[^A-Za-z0-9_-]/g, "_"),
      projeto: "demandas",
      nome: g.nome,
      ordem: "a0",
      atualizadoEm: 0,
      dispositivo: "",
    };
    const cabeca: LinhaFase = {
      tipo: "fase",
      id: idLinhaFase(fase.id),
      fase,
      resumo,
      recolhida: false,
      inicio: resumo.inicio ?? o.hoje,
      fim: resumo.fim ?? o.hoje,
    };
    linhas.push(cabeca);
    for (const x of g.itens)
      linhas.push({
        tipo: "etapa",
        id: x.demanda.id,
        etapa: etapaSintetica(x),
        situacao: situacaoDaLinha(x),
        progresso: progresso(x),
        dependeDe: [],
      });
  }
  return linhas;
}
