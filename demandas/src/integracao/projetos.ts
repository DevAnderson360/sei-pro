/**
 * A ponte com o Gestor de Projetos (vínculo opcional de uma demanda com uma etapa). Só LEITURA dos repositórios do
 * Projetos (`dados()`: projetos, fases e etapas vivos), exceto `concluirEtapaDaDemanda`, que só conclui a etapa
 * ainda aberta (`concluirSeAberta`) e só quando o usuário marca "Concluir também a etapa?". O Projetos não é alterado.
 *
 * O app roda na origem da extensão e lê o `chrome.storage.local` direto (os mesmos repositórios do Projetos): não há RPC
 * para as etapas. Sem o Projetos (nenhum dado), tudo devolve vazio.
 */

import type { Area } from "@comum/armazenamento/area";
import { escoposDaUnidade } from "@projetos/modelo/escopo";
import { RepositorioProjetos } from "@projetos/repositorio";
import type { DemandaNaTela } from "../app/dados";
import type { EtapaDoProjeto } from "../app/tipos";
import type { Carimbo, DataISO, EtapaRef, Vis } from "../modelo/tipos";

export type ReposProjetos = Readonly<Record<Vis, RepositorioProjetos>>;

export type ResultadoEtapa = "concluida" | "ja_estava" | "nao_encontrada";

const VISES: readonly Vis[] = ["unidade", "eu"];

/**
 * Os dois escopos do Projetos desta unidade e deste usuário (as mesmas chaves do `chrome.storage.local` que o Projetos
 * grava). O `carimbo` só é chamado por `concluirEtapaDaDemanda` (a única escrita); a leitura nunca o usa.
 */
export function reposDosProjetos(area: Area, ctx: { host: string; login: string }, unidade: string, carimbo: () => Carimbo): ReposProjetos {
  const esc = escoposDaUnidade(ctx.host, ctx.login, unidade);
  return { unidade: new RepositorioProjetos(area, esc.unidade, carimbo), eu: new RepositorioProjetos(area, esc.eu, carimbo) };
}

/**
 * As etapas vivas e ainda não concluídas dos projetos ATIVOS (não arquivados) dos dois escopos da unidade, com o rótulo
 * "Projeto > Etapa", na ordem dos projetos e, dentro de cada um, das etapas (índice fracionário: comparado com `<`).
 * Um escopo que não lê não esconde o outro.
 */
export async function etapasAbertasDaUnidade(repos: ReposProjetos): Promise<EtapaDoProjeto[]> {
  const saida: EtapaDoProjeto[] = [];
  for (const vis of VISES) {
    let dados: Awaited<ReturnType<RepositorioProjetos["dados"]>>;
    try {
      dados = await repos[vis].dados();
    } catch {
      continue;
    }
    const projetos = dados.projetos.filter((p) => p.arquivadoEm === undefined);
    for (const p of projetos) {
      const doProjeto = dados.etapas.filter((e) => e.projeto === p.id && !e.concluidaEm);
      doProjeto.sort((a, b) => (a.ordem < b.ordem ? -1 : a.ordem > b.ordem ? 1 : a.id < b.id ? -1 : 1));
      for (const e of doProjeto) saida.push({ projeto: p.id, etapa: e.id, rotulo: `${p.nome} > ${e.nome}`, concluida: false, vis });
    }
  }
  return saida;
}

/**
 * Conclui a etapa ligada, se ainda estiver aberta. Concluída por outra pessoa, ou removida (ou o projeto), não é erro:
 * devolve `ja_estava` ou `nao_encontrada` e quem chamou só avisa. Erro de gravação (cota cheia, validação) sobe.
 */
export async function concluirEtapaDaDemanda(repos: ReposProjetos, ref: EtapaRef, hoje: DataISO): Promise<ResultadoEtapa> {
  let jaEstava = false;
  // Mesmo id nos dois escopos nao acontece, mas a etapa que o dialogo mostrou e a ABERTA: uma concluida nao a esconde.
  for (const vis of VISES) {
    const repo = repos[vis];
    let achada: Awaited<ReturnType<RepositorioProjetos["dados"]>>["etapas"][number] | undefined;
    try {
      achada = (await repo.dados()).etapas.find((e) => e.id === ref.etapa && e.projeto === ref.projeto);
    } catch {
      continue;
    }
    if (!achada) continue;
    if (achada.concluidaEm) {
      jaEstava = true;
      continue;
    }
    return (await repo.concluirSeAberta(ref.etapa, hoje)) ? "concluida" : "ja_estava";
  }
  return jaEstava ? "ja_estava" : "nao_encontrada";
}

/** As demandas ligadas a uma etapa (para o futuro balão do Projetos; nada no Projetos muda nesta entrega). */
export function demandasDaEtapa(itens: readonly DemandaNaTela[], etapaId: string): DemandaNaTela[] {
  return itens.filter((x) => x.demanda.etapa?.etapa === etapaId);
}
