/**
 * "Abrir no painel" do lado da aba do SEI (spec 7):
 * - no Controle de Processos, abre o painel (se recolhido), rola até ele e
 *   pede ao app o projeto (`focarProjeto`), tentando por alguns segundos
 *   enquanto o iframe ainda não ligou;
 * - pedido do lateral numa outra tela de topo: vai ao Controle de Processos
 *   pelo link do MENU da própria tela (nunca URL montada) e deixa o pedido
 *   guardado (`projetos/foco`, alvo "painel") para o painel de lá;
 * - da árvore (sem painel na aba): o background abre o painel lateral na aba
 *   Projetos e o pedido fica guardado (alvo "lateral") para o app de lá.
 * O pedido guardado vale só para a mesma chave da aba e por 1 minuto (quem lê
 * confere a forma: `lerPedidoDeFoco`). O do painel vale uma vez (o painel o
 * apaga ao atender); o do lateral fica até vencer, porque dois laterais da
 * mesma chave (duas janelas) atendem os dois, cada um uma vez
 * (app/lateral/montagem.ts).
 */

import type { Area } from "@comum/armazenamento/area";
import { ErroRpc } from "@comum/ponte/rpc";
import { CHAVE_FOCO, lerPedidoDeFoco, type PedidoDeFoco, VALIDADE_FOCO } from "../ponte/tipos";

export interface PainelDaAba {
  painel: HTMLElement;
  corpo: HTMLElement;
  /** A porta com o app (`ligarPortaDoPainel(...).rpc`): null até o iframe carregar e ligar. */
  rpc(): { chamar(op: string, args?: unknown): Promise<unknown> } | null;
}

/** O pedido que ainda espera o app ligar, por painel: um pedido novo substitui o anterior (como as pílulas). */
const esperando = new WeakMap<HTMLElement, ReturnType<typeof setTimeout>>();

export function focarNoPainelDaAba(m: PainelDaAba, id: string, etapa?: string, o: { espera?: number } = {}): "painel" {
  if (m.corpo.hidden) m.painel.querySelector<HTMLButtonElement>(".spro-prj-recolher")?.click();
  m.painel.scrollIntoView?.({ behavior: "smooth", block: "start" });
  const espera = o.espera ?? 300;
  const anterior = esperando.get(m.painel);
  if (anterior !== undefined) clearTimeout(anterior);
  esperando.delete(m.painel);
  const pedir = (restam: number) => {
    esperando.delete(m.painel);
    const r = m.rpc();
    if (r) void r.chamar("focarProjeto", etapa ? { id, etapa } : { id }).catch(() => undefined);
    else if (restam > 0)
      esperando.set(
        m.painel,
        setTimeout(() => pedir(restam - 1), espera),
      );
  };
  pedir(Math.ceil(9000 / Math.max(1, espera)));
  return "painel";
}

function pedido(alvo: PedidoDeFoco["alvo"], chave: string, id: string, etapa: string | undefined, agora: number): PedidoDeFoco {
  const p: PedidoDeFoco = { alvo, chave, projeto: id, ate: agora + VALIDADE_FOCO };
  if (etapa) p.etapa = etapa;
  return p;
}

export interface DepsIrAoPainel {
  area: Area;
  chave: string;
  agora: number;
  /** O link do Controle de Processos no menu da tela (`linkDoMenu(paginaDe(document), "procedimento_controlar")`). */
  link(): string;
  ir(url: string): void;
}

/** Pedido do lateral numa tela sem o painel: o pedido guardado e a ida ao Controle de Processos pelo menu. */
export async function irAoPainel(d: DepsIrAoPainel, id: string, etapa?: string): Promise<"navegou"> {
  let link: string;
  try {
    link = d.link();
  } catch {
    throw new ErroRpc("SEM_MENU", "Esta tela do SEI não mostra o menu. Abra o Controle de Processos e tente de novo.");
  }
  await d.area.gravar({ [CHAVE_FOCO]: pedido("painel", d.chave, id, etapa, d.agora) });
  d.ir(link);
  return "navegou";
}

/** No Controle de Processos, com o painel montado: o pedido que o lateral deixou (uma vez). */
export async function atenderPedidoDoLateral(
  area: Area,
  chave: string,
  agora: number,
  m: PainelDaAba,
  o: { espera?: number } = {},
): Promise<boolean> {
  const p = lerPedidoDeFoco((await area.obter(CHAVE_FOCO))[CHAVE_FOCO], "painel", chave, agora);
  if (!p) return false;
  await area.remover(CHAVE_FOCO);
  focarNoPainelDaAba(m, p.projeto, p.etapa, o);
  return true;
}

export interface DepsFocoDaAba {
  /**
   * O painel desta aba: o montado no Controle de Processos; null quando a tela não o recebe (as outras telas, e a
   * visão por marcadores do Controle de Processos); rejeitada quando a montagem falhou.
   */
  painel: Promise<PainelDaAba | null>;
  area: Area;
  chave: string;
  agora(): number;
  link(): string;
  ir(url: string): void;
}

/**
 * O `focarNoPainel` que o lateral pede a esta aba: com o painel montado, rola até ele; sem o painel na tela (as
 * outras telas, e a visão por marcadores do Controle de Processos, que vem de parâmetro da URL que o link do menu
 * não leva), vai ao Controle de Processos pelo menu (a lista completa, onde o painel monta e atende o pedido); se a
 * montagem do painel falhou, erro (ir até ele cairia na mesma falha).
 */
export function focoDaAba(d: DepsFocoDaAba): (id: string, etapa?: string) => Promise<"painel" | "navegou"> {
  // A montagem que falha antes de o lateral pedir não vira rejeição solta.
  d.painel.catch(() => undefined);
  return async (id, etapa) => {
    let m: PainelDaAba | null;
    try {
      m = await d.painel;
    } catch {
      throw new ErroRpc(
        "SEM_PAINEL",
        "O painel de projetos não pôde ser aberto nesta página. Recarregue o Controle de Processos e tente de novo.",
      );
    }
    if (m) return focarNoPainelDaAba(m, id, etapa);
    return irAoPainel({ area: d.area, chave: d.chave, agora: d.agora(), link: d.link, ir: d.ir }, id, etapa);
  };
}

export interface DepsPedirLateral {
  area: Area;
  chave: string;
  agora: number;
  /** `chrome.runtime.sendMessage({ tipo: "abrirPainel", aba: "projetos" })` (o clique é o gesto que o Chrome exige). */
  abrir(): Promise<unknown>;
  /** Sem o background (Firefox sem painel): uma janela comum com o painel. */
  janela(): void;
}

/** Da árvore: abre o lateral na aba Projetos e deixa o pedido para o app de lá abrir o projeto (e o balão da etapa). */
export async function pedirLateral(d: DepsPedirLateral, id: string, etapa?: string): Promise<void> {
  // O pedido ao background vai antes de qualquer await (o gesto do usuário não atravessa um await); o que lança na
  // hora (contexto da extensão invalidado) cai na janela, como a recusa.
  const aberto = (async () => d.abrir())().catch(() => d.janela());
  await d.area.gravar({ [CHAVE_FOCO]: pedido("lateral", d.chave, id, etapa, d.agora) });
  await aberto;
}
