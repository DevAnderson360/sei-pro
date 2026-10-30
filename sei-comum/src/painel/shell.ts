/**
 * Casca genérica do painel lateral da extensão (html/painel.html). O Chrome tem
 * UM painel lateral por extensão, e as ferramentas (favoritos, histórico,
 * agente) precisam dividi-lo: a casca mostra abas, e cada aba é a página da
 * própria ferramenta num iframe.
 *
 * Os iframes são preguiçosos (só carrega a aba aberta) e, uma vez carregados,
 * ficam vivos escondidos: trocar de aba não perde a conversa do agente nem a
 * rolagem dos favoritos.
 *
 * Quem pede o painel manda o background gravar `painelAba` no
 * `chrome.storage.session`: a casca lê ao abrir e segue as mudanças com o
 * painel já aberto.
 */

import type { Area } from "../armazenamento/area";
import { h, icone, type NomeIcone } from "../ui/dom";

export const CHAVE_ABA = "painelAba";

/**
 * O `storage.session` e um so para a extensao inteira, entao o pedido de aba leva a janela de quem pediu:
 * `{ aba, janela }`. O painel so segue o pedido da propria janela (uma `string` pura, sem janela, vale para
 * qualquer um: e o formato antigo e o do navegador sem API de janelas). A escolha feita no clique do proprio
 * painel fica numa chave por janela, para nao mexer no painel das outras.
 */
export const chaveAbaDaJanela = (janela: number): string => `${CHAVE_ABA}:${janela}`;

interface PedidoAba {
  aba: unknown;
  janela: number | null;
}

function lerPedido(v: unknown): PedidoAba {
  if (v && typeof v === "object") {
    const o = v as { aba?: unknown; janela?: unknown };
    return { aba: o.aba, janela: typeof o.janela === "number" ? o.janela : null };
  }
  return { aba: v, janela: null };
}

export interface DefAba {
  id: string;
  rotulo: string;
  icone: NomeIcone;
  caminho: string;
  titulo: string;
  /**
   * Selo de pendências: chave no storage.local com um número; `dica(n)` vira o title do botão. O valor vem de
   * fora (o storage): só um inteiro de 1 até `teto` (padrão: sem teto além do inteiro seguro) vira selo; o resto
   * (fração, negativo, texto, NaN, infinito, acima do teto) não mostra nada.
   */
  contador?: { chave: string; dica(n: number): string; teto?: number };
}

export interface DepsAbas {
  sessao: Area;
  /** chrome.storage.local: de onde saem os contadores das abas. */
  local?: Area;
  abas: DefAba[];
  url(caminho: string): string;
  /** Aba pedida pelo endereço (`#aba=agente`), quando o painel abre numa janela comum (Firefox). */
  abaDoEndereco?: string | null;
  /** Id da janela deste painel (`chrome.windows.getCurrent()`); sem ele, segue o pedido de qualquer janela. */
  janela?: () => Promise<number | null>;
}

export async function montarAbas(raiz: HTMLElement, d: DepsAbas): Promise<{ mostrar(aba: string): void; atual(): string }> {
  const defs = d.abas;
  const frames = new Map<string, HTMLIFrameElement>();
  const botoes = new Map<string, HTMLButtonElement>();
  const corpo = h("div", { class: "painel-corpo" });
  let atual: string = defs[0]?.id ?? "";

  const minhaJanela = await (d.janela?.() ?? Promise.resolve(null)).catch(() => null);
  // Pedido de outra janela nao e meu; pedido sem janela (formato antigo) vale para todos.
  const meu = (p: PedidoAba): boolean => p.janela === null || minhaJanela === null || p.janela === minhaJanela;

  const valida = (v: unknown): string | null => (defs.some((x) => x.id === v) ? (v as string) : null);

  const mostrar = (aba: string) => {
    const def = defs.find((x) => x.id === aba) ?? defs[0];
    if (!def) return;
    atual = def.id;
    if (!frames.has(def.id)) {
      const f = h("iframe", { src: d.url(def.caminho), title: def.titulo, allow: "clipboard-write" });
      frames.set(def.id, f);
      corpo.append(f);
    }
    for (const [id, f] of frames) f.hidden = id !== def.id;
    for (const [id, b] of botoes) b.setAttribute("aria-selected", String(id === def.id));
  };

  if (defs.length > 1) {
    const barra = h("nav", { class: "painel-abas", role: "tablist", "aria-label": "Ferramentas do painel" });
    for (const def of defs) {
      const b = h(
        "button",
        {
          type: "button",
          role: "tab",
          "aria-selected": "false",
          "aria-label": def.rotulo,
          title: def.rotulo,
          onclick: () => {
            mostrar(def.id);
            const chave = minhaJanela === null ? CHAVE_ABA : chaveAbaDaJanela(minhaJanela);
            void d.sessao.gravar({ [chave]: { aba: def.id, t: Date.now() } }).catch(() => undefined);
          },
        },
        icone(def.icone, 15),
        h("span", {}, def.rotulo),
        h("span", { class: "painel-conta", hidden: true }),
      );
      botoes.set(def.id, b);
      barra.append(b);
    }
    raiz.replaceChildren(barra, corpo);
  } else {
    raiz.replaceChildren(corpo);
  }

  if (d.local) {
    const local = d.local;
    for (const def of defs) {
      const c = def.contador;
      const b = botoes.get(def.id);
      if (!c || !b) continue;
      const teto = c.teto ?? Number.MAX_SAFE_INTEGER;
      const pintar = (v: unknown) => {
        const n = typeof v === "number" && Number.isInteger(v) && v > 0 && v <= teto ? v : 0;
        const conta = b.querySelector<HTMLElement>(".painel-conta");
        if (conta) {
          conta.textContent = String(n);
          conta.hidden = !n;
        }
        b.setAttribute("aria-label", n ? `${def.rotulo} (${n})` : def.rotulo);
        b.title = n ? c.dica(n) : def.rotulo;
      };
      pintar((await local.obter(c.chave).catch(() => ({}) as Record<string, unknown>))[c.chave]);
      local.aoMudar((m) => {
        if (c.chave in m) pintar(m[c.chave]?.novo);
      });
    }
  }
  const chaveMinha = minhaJanela === null ? null : chaveAbaDaJanela(minhaJanela);
  const lidas = await d.sessao.obter(chaveMinha ? [CHAVE_ABA, chaveMinha] : CHAVE_ABA).catch(() => ({}) as Record<string, unknown>);
  const pedido = lerPedido(lidas[CHAVE_ABA]);
  const propria = chaveMinha ? lerPedido(lidas[chaveMinha]) : { aba: undefined, janela: null };
  const tempo = (v: unknown): number => {
    const t = v && typeof v === "object" ? (v as { t?: unknown }).t : undefined;
    return typeof t === "number" ? t : 0;
  };
  // Vale o mais recente entre o pedido do background (para esta janela) e o ultimo clique neste painel.
  const doPedido = meu(pedido) ? valida(pedido.aba) : null;
  const doClique = valida(propria.aba);
  const gravada =
    doPedido && doClique ? (tempo(lidas[chaveMinha as string]) > tempo(lidas[CHAVE_ABA]) ? doClique : doPedido) : (doPedido ?? doClique);
  mostrar(valida(d.abaDoEndereco) ?? gravada ?? defs[0]?.id ?? "");
  d.sessao.aoMudar((m) => {
    if (!(CHAVE_ABA in m)) return;
    const p = lerPedido(m[CHAVE_ABA]?.novo);
    if (!meu(p)) return;
    const nova = valida(p.aba);
    if (nova && nova !== atual) mostrar(nova);
  });
  return { mostrar, atual: () => atual };
}
