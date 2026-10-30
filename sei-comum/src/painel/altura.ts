/**
 * Lado do app de um painel embutido (iframe abaixo da lista do SEI): o iframe
 * cresce com o conteúdo (a página do SEI rola, não o iframe). O app mede a
 * própria altura e pede à aba (RPC `altura`). Enquanto um <dialog> está aberto
 * sem a sobreposição, pede uma altura mínima: o diálogo seria cortado.
 */

import type { Rpc } from "../ponte/rpc";

export interface AlturaDoApp {
  /** Altura mínima (diálogo aberto sem sobreposição); 0 = nenhuma. */
  minimo(px: number): void;
  /** Até onde desce a lista de um seletor ou menu aberto (ui/flutuante.ts); 0 = nenhum aberto. */
  extra(px: number): void;
  /** Mede de novo (fora da tela o Chrome suspende o ResizeObserver de iframe de outra origem). */
  medir(): void;
}

export function observarAltura(rpc: Pick<Rpc, "chamar">, raiz: HTMLElement = document.getElementById("app") ?? document.body): AlturaDoApp {
  let minimo = 0;
  let fundo = 0;
  let ultima = 0;
  const enviar = () => {
    const px = Math.max(Math.ceil(raiz.getBoundingClientRect().height) + 4, minimo, fundo);
    if (px === ultima) return;
    ultima = px;
    void rpc.chamar("altura", { px }).catch(() => undefined);
  };
  new ResizeObserver(enviar).observe(raiz);
  enviar();
  return {
    minimo(px) {
      minimo = px;
      enviar();
    },
    extra(px) {
      fundo = px;
      enviar();
    },
    // Ler a geometria força o layout mesmo com a renderização do iframe suspensa.
    medir: enviar,
  };
}
