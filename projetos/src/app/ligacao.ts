/**
 * O app do painel com a sincronia e a colaboração (P4), como o main.ts monta: a
 * `Colaboracao` recebe os repositórios dos dois escopos da unidade; o
 * `AppProjetos` recebe os DELA (o da unidade pergunta o "Entendi" antes de
 * gravar), o estado da sincronia, os itens do menu ajustes, as faixas e a
 * importação do Atividades. Fica fora do main.ts para as provas montarem
 * exatamente o mesmo (o main.ts só põe o navegador: chrome.storage, diálogos,
 * download, seletor de arquivo e a porta da aba). O painel lateral (P5) monta
 * por aqui também, com `modo: "lateral"`: a mesma colaboração, o mesmo
 * "Entendi" antes de gravar em "Toda a unidade" e o mesmo arquivo ligado.
 *
 * Nada da colaboração impede o app de abrir: a memória do sigilo ilegível vira
 * um aviso curto (na colaboração) e uma falha ao iniciar só vai ao console.
 */

import { escoposDaUnidade } from "../modelo/escopo";
import { RepositorioProjetos } from "../repositorio";
import { AppProjetos, type DepsApp } from "./app";
import { Colaboracao, type DepsColaboracao } from "./colaboracao/colaboracao";

export interface DepsLigacao extends Omit<DepsColaboracao, "repos" | "app"> {
  raiz: HTMLElement;
  imprimir?: DepsApp["imprimir"];
  montarGantt?: DepsApp["montarGantt"];
  largura?: DepsApp["largura"];
  conferirDiaMs?: number;
  /** P5: o painel lateral (Agenda, cartões e mini-Gantt) e o contador da aba. */
  modo?: DepsApp["modo"];
  aoContar?: DepsApp["aoContar"];
  /** A janela do app: ao ganhar foco, o arquivo ligado confere se outro computador o mudou. */
  janela?: Pick<EventTarget, "addEventListener" | "removeEventListener">;
}

export interface AppLigado {
  app: AppProjetos;
  colab: Colaboracao;
  destruir(): void;
}

export async function ligarApp(d: DepsLigacao): Promise<AppLigado> {
  const unidade = d.ctx.unidade;
  if (!unidade) throw new Error("Abra o SEI numa unidade para ver os projetos.");
  const esc = escoposDaUnidade(d.ctx.host, d.ctx.login, unidade.id);
  let app: AppProjetos | null = null;
  const colab = new Colaboracao({
    ...d,
    repos: { unidade: new RepositorioProjetos(d.area, esc.unidade, d.carimbo), eu: new RepositorioProjetos(d.area, esc.eu, d.carimbo) },
    app: () => app,
  });
  const criado = new AppProjetos({
    raiz: d.raiz,
    ctx: d.ctx,
    area: d.area,
    // O da unidade com o "Entendi" (Proxy): nenhuma gravação do app em "Toda a unidade" passa sem ele.
    repos: colab.repos,
    rpc: d.rpc,
    abrirModal: d.abrirModal,
    confirmar: d.confirmar,
    baixar: d.baixar,
    hoje: d.hoje,
    agora: d.agora,
    imprimir: d.imprimir,
    montarGantt: d.montarGantt,
    largura: d.largura,
    conferirDiaMs: d.conferirDiaMs,
    modo: d.modo,
    aoContar: d.aoContar,
    aoRedesenhar: d.aoRedesenhar,
    sincronia: colab.provedor,
    extensoesMenu: colab.extensoesMenu,
    importarAtividades: () => colab.importarAtividades(),
    faixas: colab.faixas,
  });
  app = criado;
  await colab.iniciar().catch((e: unknown) => console.warn("[SEI Pro] projetos: a colaboração não iniciou:", e));
  try {
    await criado.iniciar();
  } catch (e) {
    // O app não abriu: a colaboração não fica ligada (ouvintes, arquivo ligado) sem ninguém que a desligue. No
    // lateral, a montagem seguinte (outra unidade) teria dois arquivos ligados sincronizando o mesmo arquivo.
    criado.destruir();
    colab.destruir();
    throw e;
  }
  const aoFocar = () => colab.aoGanharFoco();
  d.janela?.addEventListener("focus", aoFocar);
  return {
    app: criado,
    colab,
    destruir: () => {
      d.janela?.removeEventListener("focus", aoFocar);
      criado.destruir();
      colab.destruir();
    },
  };
}
