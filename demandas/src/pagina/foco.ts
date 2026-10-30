/**
 * "Abrir no painel" do lado da aba do SEI: o lateral pede (`focarNoPainel {id}`) e a aba
 * - no Controle de Processos, com o painel montado: abre o painel (se recolhido), rola até ele e pede ao app a demanda
 *   (`focarDemanda`), tentando por alguns segundos enquanto o iframe ainda não ligou;
 * - em outra tela de topo (sem painel, ou na visão por marcadores do Controle de Processos): vai ao Controle de
 *   Processos pelo link do MENU da própria tela (nunca URL montada) e deixa o pedido guardado (`demandas/foco`) para o
 *   painel de lá.
 * O pedido guardado vale só para a mesma chave da aba e por 1 minuto, e uma vez (o painel o apaga ao atender); quem lê
 * confere a forma (`lerPedidoDeFoco`).
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

export function focarNoPainelDaAba(m: PainelDaAba, id: string, o: { espera?: number } = {}): "painel" {
  if (m.corpo.hidden) m.painel.querySelector<HTMLButtonElement>(".spro-dem-recolher")?.click();
  m.painel.scrollIntoView?.({ behavior: "smooth", block: "start" });
  const espera = o.espera ?? 300;
  const anterior = esperando.get(m.painel);
  if (anterior !== undefined) clearTimeout(anterior);
  esperando.delete(m.painel);
  const pedir = (restam: number) => {
    esperando.delete(m.painel);
    const r = m.rpc();
    if (r) void r.chamar("focarDemanda", { id }).catch(() => undefined);
    else if (restam > 0)
      esperando.set(
        m.painel,
        setTimeout(() => pedir(restam - 1), espera),
      );
  };
  pedir(Math.ceil(9000 / Math.max(1, espera)));
  return "painel";
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
export async function irAoPainel(d: DepsIrAoPainel, id: string): Promise<"navegou"> {
  let link: string;
  try {
    link = d.link();
  } catch {
    throw new ErroRpc("SEM_MENU", "Esta tela do SEI não mostra o menu. Abra o Controle de Processos e tente de novo.");
  }
  const pedido: PedidoDeFoco = { chave: d.chave, demanda: id, ate: d.agora + VALIDADE_FOCO };
  await d.area.gravar({ [CHAVE_FOCO]: pedido });
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
  const p = lerPedidoDeFoco((await area.obter(CHAVE_FOCO))[CHAVE_FOCO], chave, agora);
  if (!p) return false;
  await area.remover(CHAVE_FOCO);
  focarNoPainelDaAba(m, p.demanda, o);
  return true;
}

export interface DepsFocoDaAba {
  /**
   * O painel desta aba: o montado no Controle de Processos; null quando a tela não o recebe (as outras telas, e a visão
   * por marcadores); rejeitada quando a montagem falhou.
   */
  painel: Promise<PainelDaAba | null>;
  area: Area;
  chave: string;
  agora(): number;
  link(): string;
  ir(url: string): void;
}

/**
 * O `focarNoPainel` que o lateral pede a esta aba: com o painel montado, rola até ele; sem o painel na tela, vai ao
 * Controle de Processos pelo menu (onde o painel monta e atende o pedido); se a montagem do painel falhou, erro (ir até
 * ele cairia na mesma falha).
 */
export function focoDaAba(d: DepsFocoDaAba): (id: string) => Promise<"painel" | "navegou"> {
  // A montagem que falha antes de o lateral pedir não vira rejeição solta.
  d.painel.catch(() => undefined);
  return async (id) => {
    let m: PainelDaAba | null;
    try {
      m = await d.painel;
    } catch {
      throw new ErroRpc(
        "SEM_PAINEL",
        "O painel de demandas não pôde ser aberto nesta página. Recarregue o Controle de Processos e tente de novo.",
      );
    }
    if (m) return focarNoPainelDaAba(m, id);
    return irAoPainel({ area: d.area, chave: d.chave, agora: d.agora(), link: d.link, ir: d.ir }, id);
  };
}
