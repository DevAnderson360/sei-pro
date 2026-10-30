/** Faixas de aviso no topo: texto do Texto Padrão perto do limite ou passado dele, muitas demandas ativas, peso total. */

import { h, icone } from "@comum/ui/dom";
import { muitasAtivas, pesoTotalAlto } from "../../modelo/alertas";
import { AVISO_PESO_TOTAL, TETO_TEXTO } from "../../modelo/constantes";
import type { EstadoTabela } from "../../sincronia/orquestrador";

const kb = (bytes: number | undefined) => `${Math.round((bytes ?? 0) / 1024)}`;

const NOME: Record<EstadoTabela["tabela"], [string, string]> = {
  d: ["As demandas", "As demandas da unidade"],
  a: ["As demandas arquivadas", "As demandas arquivadas da unidade"],
  h: ["O histórico das demandas", "O histórico das demandas da unidade"],
};

function faixa(tom: "aviso" | "bloqueio", texto: string, aoArquivarAntigas: () => void): HTMLElement {
  return h(
    "div",
    { class: `dem-faixa ${tom}`, role: tom === "bloqueio" ? "alert" : "status" },
    icone("alerta", 16),
    h("span", { class: "dem-faixa-texto" }, texto),
    h("button", { type: "button", class: "spro-botao pequeno", onclick: aoArquivarAntigas }, "Arquivar concluídas antigas…"),
  );
}

export function montarFaixas(o: { tabelas: readonly EstadoTabela[]; ativas: number; aoArquivarAntigas(): void }): HTMLElement | null {
  const itens: HTMLElement[] = [];
  const limite = `${kb(TETO_TEXTO)} KB`;
  for (const t of o.tabelas) {
    if (t.faixa === "normal") continue;
    const de = t.vis === "unidade" ? "da unidade" : "pessoais";
    const nome = t.vis === "unidade" ? NOME[t.tabela][0] : `${NOME[t.tabela][0]} pessoais`;
    const uso = `${kb(t.bytes)} KB de ${limite}, ${t.percentual}%`;
    if (t.faixa === "aviso") itens.push(faixa("aviso", `${nome} estão perto do limite do Texto Padrão (${uso}).`, o.aoArquivarAntigas));
    else
      itens.push(
        faixa(
          "bloqueio",
          `${t.tabela === "d" ? `As demandas ${de}` : nome} passaram do limite do Texto Padrão (${uso}). ${t.tabela === "d" ? "Criar, duplicar e restaurar estão bloqueados; editar, concluir e arquivar continuam." : "O texto não é gravado enquanto passar do limite."}`,
          o.aoArquivarAntigas,
        ),
      );
  }
  if (muitasAtivas(o.ativas))
    itens.push(faixa("aviso", "Muitas demandas ativas deixam a tela lenta. Arquive as concluídas.", o.aoArquivarAntigas));
  for (const vis of ["unidade", "eu"] as const) {
    const bytes = o.tabelas.filter((t) => t.vis === vis && t.bytes !== undefined).map((t) => t.bytes as number);
    if (pesoTotalAlto(bytes))
      itens.push(
        faixa(
          "aviso",
          `Os textos de demandas ${vis === "unidade" ? "da unidade" : "pessoais"} somam mais de ${kb(AVISO_PESO_TOTAL)} KB (${kb(bytes.reduce((a, b) => a + b, 0))} KB). Isso pode deixar o editor do SEI lento.`,
          o.aoArquivarAntigas,
        ),
      );
  }
  return itens.length ? h("div", { class: "dem-faixas" }, ...itens) : null;
}
