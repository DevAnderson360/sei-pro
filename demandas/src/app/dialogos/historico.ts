/** Histórico da demanda: do registro mais recente ao mais antigo (data, quem, o que mudou, motivo da prorrogação). */

import { h } from "@comum/ui/dom";
import type { Demanda, Registro } from "../../modelo/tipos";
import { dataDoCarimbo, quemDoRegistro, textoDoRegistroDemanda } from "../formato";
import type { ContextoDialogo } from "../tipos";

export function linhaDoRegistroDemanda(r: Registro): HTMLElement {
  return h(
    "li",
    { class: "dem-hist-linha", "data-registro": r.id },
    h("span", { class: "dem-hist-data" }, dataDoCarimbo(r.quando)),
    h("span", { class: "dem-hist-quem" }, quemDoRegistro(r)),
    h("span", { class: "dem-hist-que" }, textoDoRegistroDemanda(r)),
    r.motivo ? h("span", { class: "dem-hist-motivo" }, `Motivo: ${r.motivo}`) : null,
  );
}

export async function abrirHistorico(c: ContextoDialogo, d: Demanda): Promise<void> {
  const lista = h("ul", { class: "dem-hist" });
  let regs: Registro[] = [];
  try {
    const dois = await Promise.all([c.repos.unidade.historico(d.id), c.repos.eu.historico(d.id)]);
    regs = dois.flat().sort((a, b) => b.quando - a.quando || (a.id < b.id ? 1 : -1));
  } catch {
    lista.append(h("li", { class: "dem-hist-vazio" }, "Não foi possível ler o histórico."));
  }
  if (!lista.children.length) {
    if (regs.length) lista.append(...regs.map(linhaDoRegistroDemanda));
    else lista.append(h("li", { class: "dem-hist-vazio" }, "Nenhuma alteração registrada."));
  }
  await new Promise<void>((ok) => {
    c.abrirModal({
      titulo: "Histórico da demanda",
      icone: "historico",
      conteudo: h("div", { class: "dem-form dem-form-historico" }, h("p", { class: "dem-dialogo-titulo" }, d.titulo), lista),
      aoFechar: () => ok(),
    });
  });
}
