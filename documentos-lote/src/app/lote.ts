/**
 * O lote a partir do estado do app: quais linhas vão para a execução (`pendente`) e quais ficam de fora (`fora`),
 * e o `LoteDocumentos` que é gravado no repositório ANTES da primeira linha (spec §6.2).
 *
 * Quem fica de fora (Ruling 19): a linha com erro na planilha (`erroLinha`) em qualquer destino e, no destino
 * coluna, a linha cujo processo não passou na verificação. No destino coluna a verificação só vale pelo
 * `situacoesIniciais`/`verificacaoVale` (nunca `estado.prontas` cru); nos outros destinos o app prepara as linhas
 * ele mesmo (a Verificação não rodou e `estado.linhas` pode ser de uma passagem antiga pelo destino coluna).
 */

import { novoId } from "@comum/id";
import { TETO_BYTES_LOTE } from "../modelo/constantes";
import { type LinhaDocumento, prepararLinhas } from "../modelo/destinos";
import { type ConfigLote, mensagemLoteGrande } from "../modelo/lote";
import type { ItemLote, LoteDocumentos, SituacaoLinha, VerificacaoGuardada } from "../repositorio";
import type { Modelo } from "../sei/modelo";
import { type EstadoApp, mensagemDe, verificacaoVale } from "./estado";
import { ROTULO_STATUS, situacoesIniciais } from "./verificacao";

export interface LinhasDoLote {
  linhas: LinhaDocumento[];
  /** Na ordem de `linhas`. */
  situacoes: SituacaoLinha[];
}

/** As linhas e a situação inicial de cada uma, ou o motivo de ainda não haver lote para montar. */
export function linhasDoLote(estado: EstadoApp): LinhasDoLote | { erro: string } {
  const cfg = estado.config;
  if (!cfg) return { erro: "Complete o cruzamento e o destino na etapa anterior." };
  if (cfg.destino.tipo === "coluna") {
    if (!verificacaoVale(estado) || !estado.linhas) {
      return { erro: "Verifique de novo os processos de destino: a planilha ou o cruzamento mudou depois da verificação." };
    }
    return { linhas: estado.linhas, situacoes: situacoesIniciais(estado) };
  }
  let linhas: LinhaDocumento[];
  try {
    linhas = prepararLinhas(estado.registros ?? [], cfg);
  } catch (e) {
    return { erro: mensagemDe(e) };
  }
  return { linhas, situacoes: linhas.map((l) => (l.erroLinha ? "fora" : "pendente")) };
}

/** O modelo como vai para o lote e para o `criar`: sem o texto da prévia (só a tela o usa). */
export function modeloSemTexto(m: Modelo): Modelo {
  const { texto: _texto, ...resto } = m;
  return resto;
}

/** A config do lote (o modelo sem o texto da prévia). */
const configDoLote = (cfg: ConfigLote): ConfigLote => ({ ...cfg, modelo: modeloSemTexto(cfg.modelo) });

/** Só o que o lote pode guardar das verificações: nunca `linkArvore` (traz o infra_hash). */
function verificacoesGuardaveis(v: Record<string, VerificacaoGuardada> | undefined): Record<string, VerificacaoGuardada> {
  const saida: Record<string, VerificacaoGuardada> = {};
  for (const [numero, r] of Object.entries(v ?? {})) {
    const g: VerificacaoGuardada = { numero: r.numero, status: r.status };
    if (r.idProcedimento) g.idProcedimento = r.idProcedimento;
    if (r.mensagem) g.mensagem = r.mensagem;
    saida[numero] = g;
  }
  return saida;
}

/** O resultado de uma verificação em texto ("Não aberto na unidade: Enviado para outra unidade"). */
export function motivoDaVerificacao(v: VerificacaoGuardada): string {
  return v.mensagem ? `${ROTULO_STATUS[v.status]}: ${v.mensagem}` : ROTULO_STATUS[v.status];
}

/** Por que a linha ficou de fora, em texto (vai no item `fora`, para o resultado). */
function motivoFora(l: LinhaDocumento, verificacoes: Record<string, VerificacaoGuardada>): string | undefined {
  if (l.erroLinha) return l.erroLinha;
  const v = l.destino ? verificacoes[l.destino] : undefined;
  return v ? motivoDaVerificacao(v) : undefined;
}

export interface OpcoesLote {
  agora?(): number;
  /** Para as provas. */
  id?: string;
}

/** O tamanho do lote como `gravar` o guarda (o JSON, sem o texto do modelo). */
export function tamanhoDoLote(l: LoteDocumentos): number {
  return JSON.stringify({ ...l, config: configDoLote(l.config) }).length;
}

/** O lote não cabe no teto de bytes do armazenamento (TETO_BYTES_LOTE): nada é gravado nem enviado. */
export class ErroLoteGrande extends Error {
  constructor(readonly bytes: number) {
    super(mensagemLoteGrande(bytes));
    this.name = "ErroLoteGrande";
  }
}

/**
 * O lote novo do estado atual. Lança (com a mensagem para o usuário) se ainda não há o que gravar ou se o lote passa
 * do teto de bytes (`ErroLoteGrande`): a cota do `chrome.storage.local` é dividida com os outros módulos e cada
 * `marcar` regrava o lote inteiro. A checagem vem antes de qualquer gravação ou pedido ao SEI.
 */
export function montarLote(
  estado: EstadoApp,
  ctx: { host: string; login: string; idProcedimento?: string },
  o: OpcoesLote = {},
): LoteDocumentos {
  const r = linhasDoLote(estado);
  if ("erro" in r) throw new Error(r.erro);
  const cfg = estado.config as ConfigLote;
  if (!r.situacoes.includes("pendente")) throw new Error("Nenhuma linha pronta para gravar.");
  const verificacoes = cfg.destino.tipo === "coluna" ? verificacoesGuardaveis(estado.verificacoes) : {};
  const itens: ItemLote[] = r.linhas.map((l, k) => {
    if (r.situacoes[k] === "pendente") return { situacao: "pendente" };
    const erro = motivoFora(l, verificacoes);
    return erro ? { situacao: "fora", erro } : { situacao: "fora" };
  });
  const agora = (o.agora ?? Date.now)();
  const lote: LoteDocumentos = {
    id: o.id ?? novoId(),
    host: ctx.host,
    login: ctx.login,
    iniciadoEm: agora,
    atualizadoEm: agora,
    config: configDoLote(cfg),
    linhas: r.linhas,
    itens,
    verificacoes,
  };
  if (estado.protocolo) lote.protocoloTela = estado.protocolo;
  // A ordem da planilha: o armazenamento não a preserva nas chaves de `dados` (D4).
  if (estado.colunas?.length) lote.colunas = [...estado.colunas];
  // O alvo "tela" é a tela ATUAL da aba: a retomada e a repetição conferem que é o mesmo processo.
  if (cfg.destino.tipo === "tela" && ctx.idProcedimento) lote.idProcedimentoTela = ctx.idProcedimento;
  const bytes = tamanhoDoLote(lote);
  if (bytes > TETO_BYTES_LOTE) throw new ErroLoteGrande(bytes);
  return lote;
}
