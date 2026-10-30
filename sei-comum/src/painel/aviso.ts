/**
 * Aviso (toast) do painel embutido no rodapé da TELA do SEI: dentro do iframe,
 * que cresce com a lista, um aviso preso embaixo ficaria fora da vista.
 *
 * Lado da aba (`avisoNaPagina`): estilo em linha (a página do SEI não tem a
 * base visual) e cores fixas, legíveis nos dois temas; a promessa diz se o
 * usuário clicou a ação ("Desfazer"). A animação `<prefixo>-aviso` vem do CSS
 * do painel (embutido.ts, `instalarEstiloPainel`).
 * Lado do app (`emissorDeAvisoPelaPagina`): manda o aviso para a aba; com
 * diálogo sobreposto, ou se a aba não responde, o app mostra ele mesmo.
 */

import type { Rpc } from "../ponte/rpc";
import { type EmissorAviso, listaDeAcoes, mostrarAviso } from "../ui/aviso";
import { h } from "../ui/dom";

export type AvisarNaPagina = (texto: string, acao: string | undefined, ms: number) => Promise<boolean>;
/** Mais de uma ação: a promessa diz o índice da ação clicada, ou -1. */
export type AvisarComAcoes = (texto: string, acoes: readonly string[], ms: number) => Promise<number>;

const caixa = (prefixo: string) =>
  "position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483646;display:flex;align-items:center;gap:12px;" +
  "max-width:min(560px,calc(100vw - 24px));box-sizing:border-box;padding:10px 10px 10px 16px;" +
  "font:13px/1.35 system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;color:#f3f5f8;background:#1f2329;" +
  "border:1px solid rgb(255 255 255 / 8%);border-radius:12px;box-shadow:0 10px 24px -6px rgb(16 24 40 / 30%),0 24px 56px -12px rgb(16 24 40 / 35%);" +
  `animation:${prefixo}-aviso 220ms cubic-bezier(.2,.8,.2,1)`;
const BOTAO =
  "flex:none;padding:5px 10px;font:inherit;font-weight:600;color:#9cc3ff;background:rgb(255 255 255 / 7%);border:0;border-radius:6px;cursor:pointer";

/** Prefixo das classes do painel na página do SEI (entra em CSS: só letras minúsculas, dígitos e hífen). */
export function validarPrefixo(prefixo: string): string {
  if (!/^[a-z][a-z0-9-]*$/.test(prefixo)) throw new Error(`Prefixo de classe inválido: ${prefixo}`);
  return prefixo;
}

export function avisoComAcoesNaPagina(doc: Document, temaEscuro: boolean, prefixo = "spro-painel"): AvisarComAcoes {
  const classe = `${validarPrefixo(prefixo)}-aviso`;
  return (texto, acoes, ms) =>
    new Promise<number>((resolver) => {
      for (const velho of doc.querySelectorAll(`.${classe}`)) velho.remove();
      let feito = false;
      const terminar = (indice: number) => {
        if (feito) return;
        feito = true;
        el.remove();
        resolver(indice);
      };
      const el = h(
        "div",
        { class: classe, role: "status", style: caixa(prefixo) + (temaEscuro ? ";background:#2b3036" : "") },
        h("span", { style: "flex:1" }, texto),
        ...acoes.map((rotulo, i) => h("button", { type: "button", style: BOTAO, onclick: () => terminar(i) }, rotulo)),
      );
      (doc.body ?? doc.documentElement).append(el);
      setTimeout(() => terminar(-1), Math.max(10, Math.min(ms, 60_000)));
    });
}

export function avisoNaPagina(doc: Document, temaEscuro: boolean, prefixo = "spro-painel"): AvisarNaPagina {
  const avisar = avisoComAcoesNaPagina(doc, temaEscuro, prefixo);
  return (texto, acao, ms) => avisar(texto, acao ? [acao] : [], ms).then((i) => i === 0);
}

/** Emissor de avisos do app embutido (ui/aviso.ts `definirEmissorDeAviso`): o aviso vai para o rodapé da tela do SEI. */
export function emissorDeAvisoPelaPagina(rpc: Pick<Rpc, "chamar">, doc: Document = document): EmissorAviso {
  return (texto, acao, ms) => {
    // Com diálogo aberto, o iframe já cobre a tela: o aviso fica no próprio app.
    if (doc.documentElement.dataset.sobreposto) return false;
    const acoes = listaDeAcoes(acao);
    // `acao` (a primeira) continua indo: é o que uma aba de versão anterior entende.
    const rotulos = acoes.length > 1 ? acoes.map((a) => a.rotulo) : undefined;
    rpc
      .chamar<boolean | number>("aviso", { texto, acao: acoes[0]?.rotulo, acoes: rotulos, ms }, ms + 5000)
      .then((r) => {
        const i = typeof r === "number" ? r : r === true ? 0 : -1;
        acoes[i]?.fazer();
      })
      .catch(() => mostrarAviso(doc, texto, acao, ms));
    return true;
  };
}
