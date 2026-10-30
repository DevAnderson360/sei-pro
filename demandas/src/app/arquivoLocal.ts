/** O seletor de arquivo comum (sem File System Access): o texto do arquivo escolhido, ou null se cancelou. */

import { h } from "@comum/ui/dom";
import { MENSAGEM_COPIA_GRANDE } from "./colaboracao";

/** Acima disto nem se lê o texto (o limite da cópia é conferido de novo na colaboração). */
const LIMITE_LEITURA = 60 * 1024 * 1024;

export function escolherArquivoLocal(aceitar = ".json,application/json"): Promise<string | null> {
  return new Promise<string | null>((ok, falha) => {
    const i = h("input", { type: "file", accept: aceitar });
    i.addEventListener("change", () => {
      const f = i.files?.[0];
      if (!f) return ok(null);
      if (f.size > LIMITE_LEITURA) return falha(new Error(MENSAGEM_COPIA_GRANDE));
      f.text().then(ok, falha);
    });
    i.addEventListener("cancel", () => ok(null));
    i.click();
  });
}
