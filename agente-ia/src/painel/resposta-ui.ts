/**
 * O rodapé da resposta do agente na conversa.
 *
 * Um botão só com ícone, discreto, para levar a resposta a um documento, a um
 * e-mail ou a um chamado. Copia o MARKDOWN que o agente escreveu — tabela e
 * lista coladas continuam sendo tabela e lista. O carimbo de tempo, quando
 * chega, entra neste mesmo rodapé (ver `main.ts`).
 */

import { h, icone } from "./dom";

const ROTULO = "Copiar a resposta";

export function rodapeDaResposta(texto: string): HTMLElement {
  const copiar = h("button", { class: "icone pequeno", title: ROTULO, "aria-label": ROTULO }, icone("copiar", 13));
  copiar.addEventListener("click", () => {
    void (async () => {
      try {
        await navigator.clipboard.writeText(texto);
        copiar.replaceChildren(icone("check", 13));
        copiar.title = "Copiado";
      } catch {
        // Acontece em janela sem foco: melhor dizer do que parecer que copiou.
        copiar.title = "Não foi possível copiar: clique no painel e tente de novo";
      }
      setTimeout(() => {
        copiar.replaceChildren(icone("copiar", 13));
        copiar.title = ROTULO;
      }, 2000);
    })();
  });
  return h("div", { class: "resposta-rodape" }, copiar);
}
