/** Fila de etapas, plano por documento e lote persistido. Funções puras, sem DOM. */

import { ACOES, type AcaoId } from "./acoes";
import { elegivel, type LinhaDoc } from "./documentos";

export type ModoLista = "acrescentar" | "remover" | "substituir";

export interface ItemLista {
  id: string;
  texto: string;
}

export type ParamsEtapa =
  | { acao: "ciencia" }
  | { acao: "excluir" }
  | { acao: "cancelar-assinatura" }
  | { acao: "duplicar" }
  | { acao: "baixar"; modo: "arquivos" | "zip" }
  | { acao: "pdf" }
  | { acao: "alterar-nivel"; nivel: "publico" | "restrito"; hipotese?: string }
  /** Sem senha, de propósito: ela só existe na memória de quem executa e nunca entra no lote. */
  | { acao: "assinar"; cargo: string }
  | { acao: "cancelar-documento"; motivo: string }
  | { acao: "incluir-bloco"; bloco: { id: string; texto: string } | { novo: string } }
  | {
      acao: "alterar-dados";
      descricao?: string;
      observacao?: string;
      nivel?: "publico" | "restrito";
      hipotese?: string;
      interessados?: { modo: ModoLista; itens: ItemLista[] };
      assuntos?: { modo: ModoLista; itens: ItemLista[] };
    }
  | { acao: "mover"; destino: { protocolo: string; idProcedimento: string; tipo: string }; motivo: string };

const rotulo = (id: AcaoId): string => ACOES.find((a) => a.id === id)!.rotulo;
const vazio = (s: string | undefined): boolean => !s?.trim();

/** Erros da fila (vazia quando válida). Cada regra acusa uma vez; a ordem segue a da lista de regras. */
export function validarFila(etapas: ParamsEtapa[]): string[] {
  if (etapas.length === 0) return ["Escolha ao menos uma ação."];
  const erros: string[] = [];
  const vistas = new Set<AcaoId>();
  etapas.forEach((e, i) => {
    if (vistas.has(e.acao)) erros.push(`A ação ${rotulo(e.acao)} aparece duas vezes.`);
    vistas.add(e.acao);
    if (ACOES.find((a) => a.id === e.acao)!.final && i !== etapas.length - 1) erros.push(`${rotulo(e.acao)} precisa ser a última etapa.`);
  });
  if (vistas.has("baixar") && vistas.has("pdf")) erros.push("Escolha baixar ou PDF, não os dois.");
  if (vistas.has("alterar-nivel") && vistas.has("alterar-dados"))
    erros.push("Use só Alterar dados para mudar o nível junto com outros campos.");
  for (const e of etapas) {
    if ((e.acao === "alterar-nivel" || e.acao === "alterar-dados") && e.nivel === "restrito" && vazio(e.hipotese)) {
      erros.push("Nível restrito exige hipótese legal.");
    }
    if (e.acao === "cancelar-documento" && vazio(e.motivo)) erros.push("Informe o motivo do cancelamento.");
    if (e.acao === "mover" && vazio(e.motivo)) erros.push("Informe o motivo da movimentação.");
    if (e.acao === "assinar" && vazio(e.cargo)) erros.push("Escolha o cargo da assinatura.");
    if (e.acao === "alterar-dados") {
      const algo =
        // Descrição e observação em branco significam "manter o atual": só preenchidas contam como mudança.
        !vazio(e.descricao) ||
        !vazio(e.observacao) ||
        e.nivel !== undefined ||
        (e.interessados?.itens.length ?? 0) > 0 ||
        (e.assuntos?.itens.length ?? 0) > 0;
      if (!algo) erros.push("Nada para alterar.");
    }
  }
  return erros;
}

export type SituacaoEtapa = "pendente" | "ok" | "pulado" | "erro" | "incerto";

export interface EtapaDoc {
  acao: AcaoId;
  situacao: SituacaoEtapa;
  mensagem?: string;
  dados?: Record<string, string>;
}

export interface PlanoDoc {
  doc: LinhaDoc;
  etapas: EtapaDoc[];
}

/** Motivo das etapas derrubadas por um erro ou pulo anterior (a repetição das falhas as reabre). */
export const ANTERIOR = "Etapa anterior não concluída";
/** Bloco novo cuja criação ficou sem confirmação do SEI: os demais documentos não tentam criar outro. */
export const BLOCO_NAO_CONFIRMADO =
  "A criação do bloco não foi confirmada. Confira os blocos no SEI e inclua os documentos pelo bloco certo.";

/** O que uma etapa deixa no documento, para a elegibilidade das seguintes (só estes efeitos). */
function aplicarEfeito(l: LinhaDoc, e: ParamsEtapa): LinhaDoc {
  switch (e.acao) {
    case "assinar":
      return { ...l, assinado: true };
    case "cancelar-assinatura":
      return { ...l, assinado: false };
    case "alterar-nivel":
      return { ...l, nivel: e.nivel };
    case "alterar-dados":
      return e.nivel ? { ...l, nivel: e.nivel } : l;
    default:
      return l;
  }
}

/** Um plano por documento selecionado, na ordem da seleção; cada etapa nasce pendente ou pulada com o motivo. */
export function planejar(sel: LinhaDoc[], etapas: ParamsEtapa[], processoSigiloso: boolean): PlanoDoc[] {
  return sel.map((doc) => {
    let atual = doc;
    let barrado = false;
    const lista: EtapaDoc[] = etapas.map((e) => {
      if (barrado) return { acao: e.acao, situacao: "pulado", mensagem: ANTERIOR };
      const el = elegivel(e.acao, atual, processoSigiloso);
      if (!el.ok) {
        barrado = true;
        return { acao: e.acao, situacao: "pulado", mensagem: el.motivo };
      }
      atual = aplicarEfeito(atual, e);
      return { acao: e.acao, situacao: "pendente" };
    });
    return { doc, etapas: lista };
  });
}

/** Índice da primeira etapa pendente, ou null. */
export function proximaEtapa(p: PlanoDoc): number | null {
  const i = p.etapas.findIndex((e) => e.situacao === "pendente");
  return i < 0 ? null : i;
}

/**
 * Grava o resultado de uma etapa (imutável). "erro" e "pulado" derrubam as etapas seguintes ainda pendentes.
 * "incerto" NÃO propaga: o SEI pode ter feito a ação, e quem executa decide se segue ou para.
 */
export function registrar(
  p: PlanoDoc,
  i: number,
  r: { situacao: SituacaoEtapa; mensagem?: string; dados?: Record<string, string> },
): PlanoDoc {
  const cai = r.situacao === "erro" || r.situacao === "pulado";
  const etapas = p.etapas.map((e, k): EtapaDoc => {
    if (k === i) {
      const n: EtapaDoc = { acao: e.acao, situacao: r.situacao };
      if (r.mensagem !== undefined) n.mensagem = r.mensagem;
      if (r.dados !== undefined) n.dados = r.dados;
      return n;
    }
    if (cai && k > i && e.situacao === "pendente") return { acao: e.acao, situacao: "pulado", mensagem: ANTERIOR };
    return e;
  });
  return { ...p, etapas };
}

export interface LoteAcoes {
  id: string;
  idProcedimento: string;
  protocolo: string;
  criadoEm: number;
  atualizadoEm: number;
  /** Id da aba do SEI que gravou por último (`ContextoAcoes.aba`). */
  aba: string;
  /** "rodando" só enquanto uma aba executa; pausar, parar, terminar e fechar gravam "parado". Ausente: rodando. */
  estado?: "rodando" | "parado";
  etapas: ParamsEtapa[];
  planos: PlanoDoc[];
}
