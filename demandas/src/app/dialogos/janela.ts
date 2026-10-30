/** Diálogo que devolve uma resposta: fechar pelo X ou pelo Esc é "nenhuma" (nada é gravado). Sem botão Cancelar. */

import type { NomeIcone } from "@comum/ui/dom";
import type { ContextoDialogo } from "../tipos";

export function perguntar<T>(
  c: Pick<ContextoDialogo, "abrirModal">,
  o: { titulo: string; icone?: NomeIcone; montar(responder: (r: T) => void): HTMLElement },
): Promise<T | null> {
  return new Promise((ok) => {
    let resposta: T | null = null;
    let modal: { fechar(): void } | null = null;
    const conteudo = o.montar((r) => {
      resposta = r;
      modal?.fechar();
    });
    modal = c.abrirModal({ titulo: o.titulo, ...(o.icone ? { icone: o.icone } : {}), conteudo, aoFechar: () => ok(resposta) });
  });
}
