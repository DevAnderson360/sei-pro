/**
 * As ações que as vistas disparam (menu da linha e do cartão, arrastar no quadro, seleção em lote). Cada uma lê o
 * estado do repositório, pede o diálogo quando a transição precisa de dados e grava; erro vira aviso, nunca exceção.
 * Cancelar um diálogo não grava nada.
 */

import type { DataISO } from "@comum/datas/dias";
import { avisar } from "@comum/ui/aviso";
import type { EntradaMenu } from "@comum/ui/menu";
import type { ResultadoEtapa } from "../integracao/projetos";
import { bloqueiaCriacao } from "../modelo/alertas";
import {
  arquivar,
  cancelarAvaliacao,
  type DadosMovimento,
  desarquivar,
  iniciar,
  moverPara as operacoesMoverPara,
  pausar,
  prorrogar,
  reabrir,
  retomar,
  voltarANaoIniciada,
} from "../modelo/operacoes";
import { planoDoMovimento } from "../modelo/quadro";
import type { Situacao } from "../modelo/situacao";
import type { EtapaRef, Vis } from "../modelo/tipos";
import type { DemandaNaTela } from "./dados";
import { abrirDialogoAvaliacao } from "./dialogos/avaliar";
import { mensagensDoErro } from "./dialogos/campos";
import { abrirDialogoConclusao } from "./dialogos/concluir";
import { abrirHistorico } from "./dialogos/historico";
import { abrirDialogoProrrogacao } from "./dialogos/prorrogar";
import { avisarErro } from "./erros";
import { plural } from "./formato";
import type { ContextoDialogo, DepsApp } from "./tipos";

export type OperacaoDeLinha =
  | "iniciar"
  | "pausar"
  | "retomar"
  | "voltar"
  | "reabrir"
  | "cancelarAvaliacao"
  | "arquivar"
  | "desarquivar"
  | "excluir"
  | "restaurar"
  | "duplicar";

export const contextoDeDialogos = (deps: DepsApp): ContextoDialogo => deps;

/** O texto desta tabela `d` chegou ao teto: criar, duplicar e restaurar travam (editar, concluir e arquivar seguem). */
export async function criacaoBloqueada(deps: Pick<DepsApp, "tabelas">, vis: Vis): Promise<boolean> {
  try {
    return (await deps.tabelas()).some((t) => t.vis === vis && t.tabela === "d" && (t.faixa === "bloqueio" || bloqueiaCriacao(t.bytes)));
  } catch {
    return false;
  }
}

export const TEXTO_CRIACAO_BLOQUEADA =
  "O texto das demandas está no limite: criar, duplicar e restaurar estão bloqueados. Arquive as concluídas.";

async function excluir(deps: DepsApp, alvo: DemandaNaTela): Promise<void> {
  if (!(await deps.confirmar(`Excluir a demanda “${alvo.demanda.titulo}”?`, "Excluir"))) return;
  const repo = deps.repos[alvo.vis];
  await repo.remover(alvo.demanda.id);
  avisar("Demanda excluída.", {
    rotulo: "Desfazer",
    fazer: () => {
      repo.restaurar(alvo.demanda.id).catch(avisarErro);
    },
  });
}

export async function executarOperacao(deps: DepsApp, alvo: DemandaNaTela, op: OperacaoDeLinha): Promise<void> {
  const repo = deps.repos[alvo.vis];
  const id = alvo.demanda.id;
  try {
    switch (op) {
      case "iniciar":
        await repo.aplicar(id, iniciar);
        break;
      case "pausar":
        await repo.aplicar(id, pausar);
        break;
      case "retomar":
        await repo.aplicar(id, retomar);
        break;
      case "voltar":
        await repo.aplicar(id, voltarANaoIniciada);
        break;
      case "reabrir":
        await repo.aplicar(id, reabrir);
        break;
      case "cancelarAvaliacao":
        await repo.aplicar(id, cancelarAvaliacao);
        break;
      case "arquivar":
        await repo.aplicar(id, arquivar);
        break;
      case "desarquivar":
        await repo.aplicar(id, desarquivar);
        break;
      case "excluir":
        await excluir(deps, alvo);
        break;
      case "restaurar":
        if (await criacaoBloqueada(deps, alvo.vis)) return void avisar(TEXTO_CRIACAO_BLOQUEADA);
        await repo.restaurar(id);
        break;
      case "duplicar":
        if (await criacaoBloqueada(deps, alvo.vis)) return void avisar(TEXTO_CRIACAO_BLOQUEADA);
        await repo.duplicar(id);
        avisar("Demanda duplicada.");
        break;
    }
  } catch (e) {
    avisar(mensagensDoErro(e)[0] ?? "Não foi possível concluir a ação.");
  }
}

export async function prorrogarDemanda(deps: DepsApp, alvo: DemandaNaTela, sugerido?: DataISO): Promise<boolean> {
  const dados = await abrirDialogoProrrogacao(contextoDeDialogos(deps), alvo.demanda, sugerido);
  if (!dados) return false;
  try {
    await deps.repos[alvo.vis].aplicar(alvo.demanda.id, (d, c) => prorrogar(d, dados, c));
    return true;
  } catch (e) {
    avisarErro(e);
    return false;
  }
}

/**
 * O arraste do Cronograma mudou as datas. Distribuição: grava direto. Prazo: abre a prorrogação com o novo prazo já
 * preenchido (o motivo é obrigatório) e, se o diálogo for fechado, não grava nada (nem a distribuição). Devolve se gravou.
 */
export async function mudarDatas(deps: DepsApp, alvo: DemandaNaTela, inicio: DataISO, fim: DataISO): Promise<boolean> {
  const d = alvo.demanda;
  if (fim !== d.prazo && !(await prorrogarDemanda(deps, alvo, fim))) return false;
  if (inicio === d.distribuidaEm) return true;
  try {
    await deps.repos[alvo.vis].editar(d.id, { distribuidaEm: inicio });
    return true;
  } catch (e) {
    avisarErro(e);
    return fim !== d.prazo;
  }
}

/**
 * Move a demanda para outra situação (arrastar no quadro e "Mover para" do menu). Os movimentos que pedem dados abrem o
 * diálogo antes; cancelar não grava nada e a vista, que é redesenhada do estado (que não mudou), devolve o cartão.
 */
export async function moverPara(deps: DepsApp, alvo: DemandaNaTela, destino: Situacao): Promise<boolean> {
  const plano = planoDoMovimento(alvo.demanda, destino);
  if (plano.tipo === "recusar") {
    if (plano.mensagem) avisar(plano.mensagem);
    return false;
  }
  const repo = deps.repos[alvo.vis];
  const c = contextoDeDialogos(deps);
  let dados: DadosMovimento = {};
  let concluirEtapa = false;
  if (plano.tipo === "pedir") {
    if (plano.dados === "conclusao") {
      const resposta = await abrirDialogoConclusao(c, alvo.demanda);
      if (!resposta) return false;
      const { concluirEtapa: marcou, ...conclusao } = resposta;
      concluirEtapa = marcou === true;
      dados = { conclusao };
    } else {
      const avaliacao = await abrirDialogoAvaliacao(c, alvo.demanda);
      if (!avaliacao) return false;
      dados = { avaliacao };
    }
  }
  try {
    await repo.aplicar(alvo.demanda.id, (d, car) => operacoesMoverPara(d, destino, dados, car));
  } catch (e) {
    avisar(mensagensDoErro(e)[0] ?? "Não foi possível mover a demanda.");
    return false;
  }
  // A demanda já está concluída: o resultado da etapa só avisa (nunca desfaz a conclusão da demanda).
  const etapa = alvo.demanda.etapa;
  if (concluirEtapa && etapa && deps.concluirEtapa) await concluirEtapaLigada(deps.concluirEtapa, etapa);
  return true;
}

const AVISO_ETAPA: Record<ResultadoEtapa, string> = {
  concluida: "Etapa concluída no Gestor de Projetos.",
  ja_estava: "A etapa já estava concluída no Gestor de Projetos.",
  nao_encontrada: "A etapa não foi encontrada no Gestor de Projetos.",
};

async function concluirEtapaLigada(concluir: NonNullable<DepsApp["concluirEtapa"]>, etapa: EtapaRef): Promise<void> {
  try {
    avisar(AVISO_ETAPA[await concluir(etapa)]);
  } catch (e) {
    avisar(`A demanda foi concluída, mas a etapa não: ${mensagensDoErro(e)[0] ?? "erro ao gravar no Gestor de Projetos."}`);
  }
}

/** O menu de ações de uma demanda: só o que vale para a situação dela. */
export function entradasDoMenu(
  deps: DepsApp,
  alvo: DemandaNaTela,
  o: { aoEditar(alvo: DemandaNaTela): void; extras?: EntradaMenu[] },
): EntradaMenu[] {
  const op = (
    rotulo: string,
    icone: NonNullable<Extract<EntradaMenu, { rotulo: string }>["icone"]>,
    o2: OperacaoDeLinha,
    perigo = false,
  ): EntradaMenu => ({
    rotulo,
    icone,
    ...(perigo ? { perigo } : {}),
    fazer: () => void executarOperacao(deps, alvo, o2),
  });
  const editar: EntradaMenu = { rotulo: "Editar", icone: "lapis", fazer: () => o.aoEditar(alvo) };
  const prorrogarItem: EntradaMenu = { rotulo: "Prorrogar…", icone: "calendario", fazer: () => void prorrogarDemanda(deps, alvo) };
  const historico: EntradaMenu = {
    rotulo: "Histórico",
    icone: "historico",
    fazer: () => void abrirHistorico(contextoDeDialogos(deps), alvo.demanda),
  };
  const concluirItem: EntradaMenu = { rotulo: "Concluir…", icone: "check", fazer: () => void moverPara(deps, alvo, "concluida") };
  const base = ((): EntradaMenu[] => {
    switch (alvo.situacao) {
      case "nao_iniciada":
        return [
          op("Iniciar", "relogio", "iniciar"),
          editar,
          prorrogarItem,
          op("Duplicar", "copiar", "duplicar"),
          historico,
          "-",
          op("Excluir", "lixeira", "excluir", true),
        ];
      case "iniciada":
        return [
          op("Pausar", "relogio", "pausar"),
          concluirItem,
          op("Voltar a não iniciada", "restaurar", "voltar"),
          prorrogarItem,
          editar,
          historico,
        ];
      case "pausada":
        return [op("Retomar", "relogio", "retomar"), concluirItem, prorrogarItem, editar, historico];
      case "concluida":
        return [
          { rotulo: "Avaliar…", icone: "estrela", fazer: () => void moverPara(deps, alvo, "avaliada") },
          op("Reabrir", "restaurar", "reabrir"),
          op("Arquivar", "pasta", "arquivar"),
          editar,
          historico,
        ];
      case "avaliada":
        return [op("Cancelar avaliação", "fechar", "cancelarAvaliacao"), op("Arquivar", "pasta", "arquivar"), editar, historico];
      case "arquivada":
        return [op("Desarquivar", "restaurar", "desarquivar"), historico, "-", op("Excluir", "lixeira", "excluir", true)];
    }
  })();
  return o.extras?.length ? [...base, "-", ...o.extras] : base;
}

/** Seleção em lote: arquiva só as concluídas e avaliadas; o resto fica e o aviso conta. */
export async function arquivarSelecionadas(deps: DepsApp, itens: readonly DemandaNaTela[]): Promise<void> {
  let arquivadas = 0;
  let ignoradas = 0;
  try {
    for (const vis of ["unidade", "eu"] as const) {
      const ids = itens.filter((x) => x.vis === vis).map((x) => x.demanda.id);
      if (!ids.length) continue;
      const r = await deps.repos[vis].arquivarVarias(ids);
      arquivadas += r.arquivadas;
      ignoradas += r.ignoradas;
    }
    avisar(`${plural(arquivadas, "arquivada", "arquivadas")}${ignoradas ? `, ${plural(ignoradas, "ignorada", "ignoradas")}` : ""}.`);
  } catch (e) {
    avisarErro(e);
  }
}

export async function excluirSelecionadas(deps: DepsApp, itens: readonly DemandaNaTela[]): Promise<void> {
  if (!itens.length) return;
  if (!(await deps.confirmar(`Excluir ${plural(itens.length, "demanda", "demandas")}?`, "Excluir"))) return;
  try {
    for (const x of itens) await deps.repos[x.vis].remover(x.demanda.id);
    avisar(`${plural(itens.length, "demanda excluída", "demandas excluídas")}.`, {
      rotulo: "Desfazer",
      fazer: () => {
        for (const x of itens) deps.repos[x.vis].restaurar(x.demanda.id).catch(avisarErro);
      },
    });
  } catch (e) {
    avisarErro(e);
  }
}
