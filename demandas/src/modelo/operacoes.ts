/**
 * Transições do ciclo de vida (spec 3.2), puras: devolvem a demanda nova e os registros do histórico, ou lançam
 * `ErroOperacao`. Quem grava (o repositório) carimba o histórico com id, quando e quem.
 */

import { LIMITES } from "./constantes";
import { type Situacao, situacaoBase, situacaoDe } from "./situacao";
import type { CampoHistorico, Carimbo, DataISO, Demanda, DocumentoSei } from "./tipos";
import { dataValida } from "./validacao";

export type CodigoErro = "transicao_invalida" | "dados_invalidos";

export class ErroOperacao extends Error {
  constructor(
    readonly codigo: CodigoErro,
    mensagem: string,
  ) {
    super(mensagem);
    this.name = "ErroOperacao";
  }
}

export interface RegistroNovo {
  demanda: string;
  campo: CampoHistorico;
  antes?: string;
  depois?: string;
  motivo?: string;
}

export interface Resultado {
  demanda: Demanda;
  registros: RegistroNovo[];
}

export interface DadosConclusao {
  data: DataISO;
  tempoGastoMin?: number;
  observacao?: string;
  documento?: DocumentoSei;
}
export interface DadosAvaliacao {
  nota: 1 | 2 | 3 | 4 | 5;
  comentario?: string;
}
export interface DadosProrrogacao {
  prazo: DataISO;
  motivo: string;
}
export interface DadosMovimento {
  conclusao?: DadosConclusao;
  avaliacao?: DadosAvaliacao;
}

const transicao = (msg: string) => new ErroOperacao("transicao_invalida", msg);
const dados = (msg: string) => new ErroOperacao("dados_invalidos", msg);

/** A demanda com o carimbo da gravação; `tirar` remove campos opcionais. */
function carimbar(d: Demanda, c: Carimbo, mudar: Partial<Demanda>, tirar: ReadonlyArray<keyof Demanda> = []): Demanda {
  const r = { ...d, ...mudar, atualizadoEm: c.agora, dispositivo: c.dispositivo } as Record<string, unknown>;
  if (c.por) r.alteradoPor = c.por;
  for (const k of tirar) delete r[k as string];
  return r as unknown as Demanda;
}

function exigir(d: Demanda, ok: (b: ReturnType<typeof situacaoBase>) => boolean, msg: string): void {
  if (d.arquivadoEm !== undefined) throw transicao("A demanda está arquivada. Desarquive antes.");
  if (!ok(situacaoBase(d))) throw transicao(msg);
}

const registro = (d: Demanda, campo: CampoHistorico, extra: Partial<RegistroNovo> = {}): RegistroNovo => ({
  demanda: d.id,
  campo,
  ...extra,
});

export function iniciar(d: Demanda, c: Carimbo): Resultado {
  exigir(d, (s) => s === "nao_iniciada", "Só uma demanda não iniciada pode ser iniciada.");
  return { demanda: carimbar(d, c, { iniciadaEm: c.agora }), registros: [registro(d, "inicio", { depois: "iniciada" })] };
}

export function voltarANaoIniciada(d: Demanda, c: Carimbo): Resultado {
  exigir(d, (s) => s === "iniciada", "Só uma demanda iniciada volta a não iniciada.");
  return {
    demanda: carimbar(d, c, { pausas: [] }, ["iniciadaEm"]),
    registros: [registro(d, "inicio", { antes: "iniciada", depois: "não iniciada" })],
  };
}

export function pausar(d: Demanda, c: Carimbo): Resultado {
  exigir(d, (s) => s === "iniciada", "Só uma demanda iniciada pode ser pausada.");
  if (d.pausas.length >= LIMITES.pausas) throw dados(`Uma demanda aceita até ${LIMITES.pausas} pausas.`);
  return { demanda: carimbar(d, c, { pausas: [...d.pausas, { inicio: c.agora }] }), registros: [registro(d, "pausa")] };
}

const fecharPausa = (d: Demanda, agora: number): Demanda["pausas"] =>
  d.pausas.map((p, i) => (i === d.pausas.length - 1 && p.fim === undefined ? { ...p, fim: agora } : p));

export function retomar(d: Demanda, c: Carimbo): Resultado {
  exigir(d, (s) => s === "pausada", "Só uma demanda pausada pode ser retomada.");
  return { demanda: carimbar(d, c, { pausas: fecharPausa(d, c.agora) }), registros: [registro(d, "retomada")] };
}

export function concluir(d: Demanda, x: DadosConclusao, c: Carimbo): Resultado {
  exigir(d, (s) => s === "iniciada" || s === "pausada", "Só uma demanda iniciada ou pausada pode ser concluída.");
  if (!dataValida(x.data)) throw dados("Data de conclusão inválida.");
  if (x.data < d.distribuidaEm) throw dados("A conclusão não pode ser antes da distribuição.");
  const t = x.tempoGastoMin;
  if (t !== undefined && !(Number.isInteger(t) && t >= 0 && t <= LIMITES.tempoMin))
    throw dados("Tempo gasto inválido (minutos inteiros e positivos).");
  const obs = x.observacao?.trim();
  if (obs && obs.length > LIMITES.observacao) throw dados(`A observação passa de ${LIMITES.observacao} caracteres.`);
  const mudar: Partial<Demanda> = { concluidaEm: x.data, pausas: fecharPausa(d, c.agora) };
  if (t !== undefined) mudar.tempoGastoMin = t;
  if (obs) mudar.observacaoConclusao = obs;
  if (x.documento) mudar.documentoEntregue = x.documento;
  return { demanda: carimbar(d, c, mudar), registros: [registro(d, "conclusao", { depois: x.data })] };
}

export function reabrir(d: Demanda, c: Carimbo): Resultado {
  exigir(d, (s) => s === "concluida", "Só uma demanda concluída (e não avaliada) pode ser reaberta.");
  return {
    demanda: carimbar(d, c, {}, ["concluidaEm", "tempoGastoMin", "observacaoConclusao", "documentoEntregue"]),
    registros: [registro(d, "reabertura", { antes: d.concluidaEm })],
  };
}

export function avaliar(d: Demanda, x: DadosAvaliacao, c: Carimbo): Resultado {
  exigir(d, (s) => s === "concluida", "Só uma demanda concluída pode ser avaliada.");
  if (![1, 2, 3, 4, 5].includes(x.nota)) throw dados("A nota vai de 1 a 5.");
  const comentario = x.comentario?.trim();
  if (comentario && comentario.length > LIMITES.comentario) throw dados(`O comentário passa de ${LIMITES.comentario} caracteres.`);
  const avaliacao = { nota: x.nota, ...(comentario ? { comentario } : {}), por: c.por ?? "", em: c.agora };
  return { demanda: carimbar(d, c, { avaliacao }), registros: [registro(d, "avaliacao", { depois: String(x.nota) })] };
}

export function cancelarAvaliacao(d: Demanda, c: Carimbo): Resultado {
  exigir(d, (s) => s === "avaliada", "Só uma demanda avaliada tem avaliação a cancelar.");
  return {
    demanda: carimbar(d, c, {}, ["avaliacao"]),
    registros: [registro(d, "avaliacao", { antes: String(d.avaliacao?.nota ?? ""), depois: "" })],
  };
}

export function arquivar(d: Demanda, c: Carimbo): Resultado {
  exigir(d, (s) => s === "concluida" || s === "avaliada", "Só uma demanda concluída ou avaliada pode ser arquivada.");
  return { demanda: carimbar(d, c, { arquivadoEm: c.agora }), registros: [registro(d, "arquivamento")] };
}

export function desarquivar(d: Demanda, c: Carimbo): Resultado {
  if (d.arquivadoEm === undefined) throw transicao("A demanda não está arquivada.");
  return { demanda: carimbar(d, c, {}, ["arquivadoEm"]), registros: [registro(d, "desarquivamento")] };
}

export function prorrogar(d: Demanda, x: DadosProrrogacao, c: Carimbo): Resultado {
  exigir(d, (s) => s === "nao_iniciada" || s === "iniciada" || s === "pausada", "Só uma demanda em andamento tem prazo a prorrogar.");
  const motivo = x.motivo.trim();
  if (!motivo) throw dados("Informe o motivo da mudança de prazo.");
  if (motivo.length > LIMITES.motivo) throw dados(`O motivo passa de ${LIMITES.motivo} caracteres.`);
  if (!dataValida(x.prazo)) throw dados("Prazo inválido.");
  if (x.prazo === d.prazo) throw dados("O novo prazo é igual ao atual.");
  if (x.prazo < d.distribuidaEm) throw dados("O prazo não pode ser antes da distribuição.");
  return {
    demanda: carimbar(d, c, { prazo: x.prazo, prazoOriginal: d.prazoOriginal ?? d.prazo }),
    registros: [registro(d, "prazo", { antes: d.prazo, depois: x.prazo, motivo })],
  };
}

type Chave = `${Situacao}>${Situacao}`;
const MATRIZ: ReadonlyMap<Chave, "conclusao" | "avaliacao" | null> = new Map<Chave, "conclusao" | "avaliacao" | null>([
  ["nao_iniciada>iniciada", null],
  ["iniciada>nao_iniciada", null],
  ["iniciada>pausada", null],
  ["pausada>iniciada", null],
  ["iniciada>concluida", "conclusao"],
  ["pausada>concluida", "conclusao"],
  ["concluida>iniciada", null],
  ["concluida>avaliada", "avaliacao"],
  ["avaliada>concluida", null],
  ["concluida>arquivada", null],
  ["avaliada>arquivada", null],
  ["arquivada>concluida", null],
  ["arquivada>avaliada", null],
]);

export const movimentoPermitido = (de: Situacao, para: Situacao): boolean => MATRIZ.has(`${de}>${para}`);

/** O que o diálogo precisa coletar antes de o movimento ser aplicado (null: nada). */
export function dadosQueOMovimentoPede(de: Situacao, para: Situacao): "conclusao" | "avaliacao" | null {
  return MATRIZ.get(`${de}>${para}`) ?? null;
}

export function moverPara(d: Demanda, destino: Situacao, x: DadosMovimento, c: Carimbo): Resultado {
  const de = situacaoDe(d);
  if (!movimentoPermitido(de, destino)) throw transicao("Esse movimento não é permitido.");
  switch (`${de}>${destino}` as Chave) {
    case "nao_iniciada>iniciada":
      return iniciar(d, c);
    case "iniciada>nao_iniciada":
      return voltarANaoIniciada(d, c);
    case "iniciada>pausada":
      return pausar(d, c);
    case "pausada>iniciada":
      return retomar(d, c);
    case "iniciada>concluida":
    case "pausada>concluida":
      if (!x.conclusao) throw dados("Faltam os dados da conclusão.");
      return concluir(d, x.conclusao, c);
    case "concluida>iniciada":
      return reabrir(d, c);
    case "concluida>avaliada":
      if (!x.avaliacao) throw dados("Faltam os dados da avaliação.");
      return avaliar(d, x.avaliacao, c);
    case "avaliada>concluida":
      return cancelarAvaliacao(d, c);
    case "concluida>arquivada":
    case "avaliada>arquivada":
      return arquivar(d, c);
    default: {
      // arquivada>concluida | arquivada>avaliada: desarquivar só vale se o destino é o estado de antes.
      if (situacaoBase(d) !== destino) throw transicao("A demanda volta ao estado de antes de ser arquivada.");
      return desarquivar(d, c);
    }
  }
}
