/**
 * Tela de resultado: uma linha por documento, uma coluna por etapa (situação por extenso e a mensagem), o link do
 * documento e o número do duplicado quando houver. Copiar (texto e HTML), CSV e "Tentar de novo só as falhas"
 * (reabre só `erro`; `incerto` aparece como "Confira" e nunca se repete).
 */

import { avisar } from "@comum/ui/aviso";
import { h, icone } from "@comum/ui/dom";
import {
  type ColunaResultado,
  copiarResultado,
  type LinhaResultado,
  montarTabelaResultado,
  resultadoComoCsv,
} from "@comum/ui/tabelaResultado";
import { ACOES } from "../modelo/acoes";
import type { PlanoDoc, SituacaoEtapa } from "../modelo/fila";
import type { EstadoApp } from "./app";

const TEXTO: Record<SituacaoEtapa, string> = {
  ok: "Feito",
  pulado: "Pulado",
  erro: "Erro",
  incerto: "Confira",
  pendente: "Não executado",
};

const rotulo = (id: string): string => ACOES.find((a) => a.id === id)?.rotulo ?? id;
const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Situação do documento, pela pior etapa: erro, a conferir, não executado; senão concluído (ou todo pulado). */
function resumoDoc(p: PlanoDoc): Pick<LinhaResultado, "situacao" | "rotulo"> {
  const s = new Set(p.etapas.map((e) => e.situacao));
  if (s.has("erro")) return { situacao: "erro", rotulo: "Erro" };
  if (s.has("incerto")) return { situacao: "pendente", rotulo: "Confira" };
  if (s.has("pendente")) return { situacao: "pendente", rotulo: "Não executado" };
  if (!s.has("ok")) return { situacao: "pulado", rotulo: "Pulado" };
  return { situacao: "ok", rotulo: "Concluído" };
}

export function linhasDoResultado(e: EstadoApp): { linhas: LinhaResultado[]; colunas: ColunaResultado[] } {
  const iDuplicar = e.etapas.findIndex((x) => x.acao === "duplicar");
  const colunas: ColunaResultado[] = [
    { chave: "numero", titulo: "Nº SEI", comoLink: true },
    { chave: "documento", titulo: "Documento" },
    ...e.etapas.map((x, i) => ({ chave: `etapa${i}`, titulo: rotulo(x.acao) })),
    ...(iDuplicar >= 0 ? [{ chave: "duplicado", titulo: "Nº do duplicado" }] : []),
  ];
  const linhas = e.planos.map((p): LinhaResultado => {
    const campos: Record<string, string> = {
      numero: p.doc.numero,
      // O título já começa pelo tipo ("Despacho 0103947"): repeti-lo duplicava o tipo.
      documento: p.doc.titulo || p.doc.tipo,
    };
    p.etapas.forEach((x, i) => {
      campos[`etapa${i}`] = x.mensagem ? `${TEXTO[x.situacao]}: ${x.mensagem}` : TEXTO[x.situacao];
    });
    if (iDuplicar >= 0) campos.duplicado = p.etapas[iDuplicar]?.dados?.numero ?? "";
    // Sem infra_hash: só o caminho até o controlador.php (como o Link Permanente); o SEI pede o hash ao abrir.
    const link = e.ctx.origem
      ? `${e.ctx.origem}?acao=procedimento_trabalhar&id_procedimento=${encodeURIComponent(e.ctx.idProcedimento)}&id_documento=${encodeURIComponent(p.doc.id)}`
      : "";
    return { ...resumoDoc(p), campos, ...(link ? { link } : {}) };
  });
  return { linhas, colunas };
}

export interface DepsResultado {
  repetirFalhas(): void;
  /** Volta à seleção, limpa, com a árvore relida. */
  novaSelecao?(): void;
  baixar(nome: string, conteudo: string, tipo: string): void;
  clip?: { write?: (i: ClipboardItem[]) => Promise<void>; writeText(t: string): Promise<void> };
  ItemClip?: typeof ClipboardItem;
  avisar?(texto: string): void;
  /** O lote foi parado antes do fim. */
  interrompido?: boolean;
}

export function montarResultado(doc: Document, e: EstadoApp, d: DepsResultado): HTMLElement {
  const { linhas, colunas } = linhasDoResultado(e);
  const conta = (r: string) => linhas.filter((l) => l.rotulo === r).length;
  const falhas = e.planos.some((p) => p.etapas.some((x) => x.situacao === "erro"));
  const partes = [
    `${linhas.length} ${linhas.length === 1 ? "documento" : "documentos"}`,
    `${conta("Concluído")} ${conta("Concluído") === 1 ? "concluído" : "concluídos"}`,
    conta("Erro") ? `${conta("Erro")} com erro` : "",
    conta("Confira") ? `${conta("Confira")} a conferir` : "",
    conta("Não executado") ? `${conta("Não executado")} não ${conta("Não executado") === 1 ? "executado" : "executados"}` : "",
    conta("Pulado") ? `${conta("Pulado")} ${conta("Pulado") === 1 ? "pulado" : "pulados"}` : "",
  ].filter(Boolean);
  const aviso = d.avisar ?? ((t: string) => avisar(t));
  const botao = (texto: string, nome: Parameters<typeof icone>[0], fazer: () => void, classe = "") =>
    h("button", { type: "button", class: `spro-botao ${classe}`.trim(), onclick: fazer }, icone(nome, 14), texto);

  async function copiar(): Promise<void> {
    const clip = d.clip ?? (typeof navigator !== "undefined" ? navigator.clipboard : undefined);
    if (!clip) return aviso("Não foi possível copiar: área de transferência indisponível.");
    const Item = d.ItemClip ?? (typeof ClipboardItem !== "undefined" ? ClipboardItem : undefined);
    try {
      const modo = await copiarResultado(linhas, colunas, clip, Item);
      aviso(modo === "rico" ? "Copiado com links clicáveis" : "Copiado como texto");
    } catch (erro) {
      aviso(`Não foi possível copiar: ${mensagem(erro)}`);
    }
  }

  const confira = linhas.some((l) => l.rotulo === "Confira");
  return h(
    "section",
    { class: "al-resultado", "aria-label": "Resultado" },
    h(
      "h2",
      { class: "al-titulo" },
      d.interrompido ? icone("alerta", 18) : icone("check", 18),
      d.interrompido ? "Lote parado" : "Lote concluído",
    ),
    h("p", { class: "al-dica" }, `${partes.join(" · ")}.`),
    confira
      ? h(
          "p",
          { class: "al-erro al-motivo" },
          icone("alerta", 16),
          "O SEI não confirmou algumas etapas (Confira): verifique esses documentos no processo. Elas não são repetidas.",
        )
      : null,
    h(
      "div",
      { class: "al-rodape" },
      d.novaSelecao ? botao("Nova seleção", "documento", () => d.novaSelecao?.(), "primario") : null,
      falhas ? botao("Tentar de novo só as falhas", "atualizar", () => d.repetirFalhas()) : null,
      botao("Copiar", "copiar", () => void copiar()),
      botao("Baixar CSV", "baixar", () => d.baixar("acoes-em-lote.csv", resultadoComoCsv(linhas, colunas), "text/csv;charset=utf-8")),
    ),
    h("div", { class: "al-tabela" }, montarTabelaResultado(doc, linhas, colunas)),
  );
}
