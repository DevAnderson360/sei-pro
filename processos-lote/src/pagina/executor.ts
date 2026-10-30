/**
 * O que o app do Processos em Lote pede a aba do SEI: contexto, tipos de processo, o formulario do tipo e a
 * criacao de cada processo (que usa a sessao da aba, por isso roda aqui e nao no app).
 *
 * Tudo atravessa a ponte como JSON simples: o app nunca ve tipos de excecao, so `situacao`, `erro`, `parar`,
 * `incerto` e `aviso`. O formulario completo do tipo (com o `action` assinado e os campos ocultos) fica so na
 * memoria desta aba.
 */
import type { Tratador } from "@comum/ponte/rpc";
import type { Sei } from "@nucleo/sei";
import { ehErroSei } from "@nucleo/sessao/erros";
import type { LinhaLote } from "../modelo/linhas";
import type { Criado } from "../repositorio";
import { criacaoIncerta, criarProcesso } from "../sei/criar";
import { carregarFormTipo, type FormTipo } from "../sei/formularioTipo";
import { listarTipos } from "../sei/tipos";
import type { ContextoLote } from "./contexto";
import { type ChamadasPosAcao, tratadoresPosAcao } from "./posAcao";

/** As chamadas ao SEI, trocaveis nas provas para forcar cada desfecho sem rede. */
export interface ChamadasSei {
  listarTipos: typeof listarTipos;
  carregarFormTipo: typeof carregarFormTipo;
  criarProcesso: typeof criarProcesso;
}

export interface DepsExecutor {
  sei: Sei;
  ctx: ContextoLote;
  /** So no modal: tira o iframe da tela. */
  fechar?: () => void;
  minimizar?: (minimizado: boolean) => void;
  /** Abre o Link Permanente na mesma aba (o app ja gravou a entrada dele). */
  abrirLinkPermanente(): void;
  chamadas?: Partial<ChamadasSei>;
  /** As funcoes do nucleo das acoes depois da criacao, trocaveis nas provas. */
  chamadasPosAcao?: Partial<ChamadasPosAcao>;
}

export type ResultadoCriar =
  | { situacao: "ok"; criado: Criado; aviso?: string; incerto?: boolean }
  | { situacao: "erro"; erro: string; parar?: boolean };

/** No lugar do numero quando nao se sabe se o processo existe: a linha nao pode ser repetida as cegas. */
export const NUMERO_INCERTO = "(incerto: confira no Controle de Processos)";
export const NUMERO_NAO_IDENTIFICADO = "(numero nao identificado)";
export const ERRO_SEM_HIPOTESE = "Linha restrita sem hipótese legal: escolha uma hipótese no lote.";
export const AVISO_INCERTO =
  "O processo pode ter sido criado, mas o SEI não confirmou. Confira no Controle de Processos antes de repetir esta linha.";

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const sessaoExpirada = (e: unknown): boolean => ehErroSei(e) && e.codigo === "SEI_SESSAO_EXPIRADA";

/** Falha sem POST no meio (buscar o formulario, argumentos): erro comum, ou `parar` se a sessao acabou. */
function erroSemCriacao(e: unknown): ResultadoCriar {
  return sessaoExpirada(e) ? { situacao: "erro", erro: mensagem(e), parar: true } : { situacao: "erro", erro: mensagem(e) };
}

/**
 * O POST pode ter gravado: devolve "ok" incerto, nunca "erro" (o app trataria como repetivel e duplicaria).
 * Alem de `criacaoIncerta`, conta como incerto o `CANCELADO` (o aborto pode chegar depois do envio) e qualquer
 * erro que nao e `ErroSei` (vem do envio ou depois dele).
 */
function talvezCriado(e: unknown): boolean {
  return criacaoIncerta(e) || !ehErroSei(e) || e.codigo === "CANCELADO";
}

function resultadoIncerto(e: unknown): ResultadoCriar {
  const numero = (e as { numero?: unknown } | null)?.numero;
  return {
    situacao: "ok",
    incerto: true,
    criado: { numero: typeof numero === "string" && numero ? numero : NUMERO_INCERTO, idProcedimento: "", url: "" },
    aviso: AVISO_INCERTO,
  };
}

function resultadoOk(c: Criado & { aviso?: string }): ResultadoCriar {
  const r: ResultadoCriar = {
    situacao: "ok",
    criado: { numero: c.numero || NUMERO_NAO_IDENTIFICADO, idProcedimento: c.idProcedimento, url: c.url },
  };
  if (c.aviso) r.aviso = c.aviso;
  return r;
}

interface PedidoCriar {
  idTipo: string;
  linha: LinhaLote;
  nivelAcesso: "0" | "1";
  hipoteseLegal: string;
}

const ERRO_SEM_TIPO = "Tipo de processo não informado.";

function lerIdTipo(v: unknown): string {
  return typeof v === "string" ? v.trim() : "";
}

function lerPedido(args: unknown): PedidoCriar | string {
  const a = (args ?? {}) as Record<string, unknown>;
  const idTipo = lerIdTipo(a.idTipo);
  if (!idTipo) return ERRO_SEM_TIPO;
  const l = (a.linha ?? {}) as Record<string, unknown>;
  // Especificacao vazia e valida: o modo "quantidade" do legado abre processos sem especificacao. So a falta do campo
  // (pedido malformado) e recusada.
  if (typeof l.especificacao !== "string") return "Linha sem especificação.";
  const linha: LinhaLote = { especificacao: l.especificacao };
  if (typeof l.interessado === "string") linha.interessado = l.interessado;
  if (typeof l.observacao === "string") linha.observacao = l.observacao;
  if (l.nivelAcesso === "0" || l.nivelAcesso === "1") linha.nivelAcesso = l.nivelAcesso;
  const nivelAcesso = a.nivelAcesso === "1" ? "1" : "0";
  return { idTipo, linha, nivelAcesso, hipoteseLegal: typeof a.hipoteseLegal === "string" ? a.hipoteseLegal : "" };
}

export function tratadoresProcessosLote(d: DepsExecutor): Record<string, Tratador> {
  const c: ChamadasSei = { listarTipos, carregarFormTipo, criarProcesso, ...d.chamadas };
  /** Formularios por tipo, so nesta aba. Buscado uma vez e reaproveitado nos N POSTs (o `action` nao e nonce). */
  const formularios = new Map<string, FormTipo>();

  const buscarForm = async (idTipo: string): Promise<FormTipo> => {
    const f = await c.carregarFormTipo(d.sei, idTipo);
    formularios.set(idTipo, f);
    return f;
  };

  const criar = async (args: unknown): Promise<ResultadoCriar> => {
    const pedido = lerPedido(args);
    if (typeof pedido === "string") return { situacao: "erro", erro: pedido };
    const { idTipo, linha } = pedido;
    // O nivel da linha (coluna da planilha) vale sobre o do lote; a hipotese e a do lote.
    const dados = {
      especificacao: linha.especificacao,
      interessado: linha.interessado,
      observacao: linha.observacao,
      nivelAcesso: linha.nivelAcesso ?? pedido.nivelAcesso,
      hipoteseLegal: pedido.hipoteseLegal,
    };

    // O legado recusava restrito sem hipotese: o SEI pode aceitar e gravar um processo restrito sem base legal.
    // Barrado antes de qualquer requisicao (nem o formulario e buscado).
    if (dados.nivelAcesso === "1" && (!dados.hipoteseLegal.trim() || dados.hipoteseLegal.trim() === "null")) {
      return { situacao: "erro", erro: ERRO_SEM_HIPOTESE };
    }

    let form = formularios.get(idTipo);
    if (!form) {
      try {
        form = await buscarForm(idTipo);
      } catch (e) {
        return erroSemCriacao(e);
      }
    }

    try {
      return resultadoOk(await c.criarProcesso(d.sei, form, dados));
    } catch (e) {
      if (talvezCriado(e)) return resultadoIncerto(e);
      if (sessaoExpirada(e)) return erroSemCriacao(e);
    }

    // Comprovadamente nao criado: a sessao pode ter sido renovada e invalidado o formulario guardado. Refaz o
    // formulario UMA vez e repete (porta de procLote_criarComRetentativa); na segunda falha, a linha fica com o erro.
    try {
      form = await buscarForm(idTipo);
    } catch (e) {
      return erroSemCriacao(e);
    }
    try {
      return resultadoOk(await c.criarProcesso(d.sei, form, dados));
    } catch (e) {
      if (talvezCriado(e)) return resultadoIncerto(e);
      return erroSemCriacao(e);
    }
  };

  return {
    // Acoes depois da criacao: posAcaoOpcoes, posAcao e posAcaoBloco.
    ...tratadoresPosAcao(d.sei, d.chamadasPosAcao),
    contexto: () => {
      const { base: _base, ...publico } = d.ctx;
      return publico;
    },
    tipos: () => c.listarTipos(d.sei),
    formTipo: async (args) => {
      const idTipo = lerIdTipo((args as { idTipo?: unknown } | undefined)?.idTipo);
      if (!idTipo) throw new Error(ERRO_SEM_TIPO);
      const f = await buscarForm(idTipo);
      return { idTipo: f.idTipo, hipoteses: f.hipoteses, temAssuntos: f.assuntos !== "" };
    },
    criar,
    fechar: () => {
      if (!d.fechar) return false;
      d.fechar();
      return true;
    },
    minimizar: (args) => {
      if (!d.minimizar) return false;
      d.minimizar((args as { minimizado?: unknown } | undefined)?.minimizado === true);
      return true;
    },
    abrirLinkPermanente: () => {
      d.abrirLinkPermanente();
      return true;
    },
  };
}
