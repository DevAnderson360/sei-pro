/**
 * O estado do app entre as etapas e o contrato de cada etapa (tela).
 *
 * O app guarda UM `EstadoApp` e passa a mesma referência a cada tela. A tela lê dele ao nascer (Voltar e Avançar
 * recriam a tela e ela mostra o que já foi escolhido, sem pedir de novo à aba) e escreve nele o que o usuário
 * decide. O app não conhece os campos: só pergunta `completa()` para habilitar o Avançar.
 *
 * Regra para as etapas seguintes: um campo só fica no estado quando está pronto para a próxima etapa (o modelo
 * lido, o arquivo válido). Enquanto lê ou depois de um erro, a tela apaga o seu campo, e o Avançar fica desabilitado.
 */

import type { Rpc } from "@comum/ponte/rpc";
import type { TipoProcesso } from "@pl/sei/tipos";
import type { CsvLido } from "../modelo/csv";
import type { LinhaDocumento } from "../modelo/destinos";
import type { ConfigLote } from "../modelo/lote";
import type { VerificacaoGuardada } from "../repositorio";
import type { Modelo, ModelosDisponiveis } from "../sei/modelo";

export interface EstadoApp {
  /* ---- Etapa 1: Modelo ---- */
  /** O que a aba listou (documentos da árvore, Textos Padrão, tipos): guardado para o Voltar não listar de novo. */
  disponiveis?: ModelosDisponiveis;
  /** Protocolo do processo da tela (o de onde o modelo foi listado). */
  protocolo?: string;
  /** O valor escolhido no seletor do modelo (`doc:NUMERO` ou `tp:ID`), mesmo antes de ler. */
  escolha?: string;
  /** O tipo escolhido para o Texto Padrão (id da lista `disponiveis.tipos`). */
  tipoTextoPadrao?: string;
  /** O modelo lido pela aba: só existe quando pronto (com tipo, no Texto Padrão). */
  modelo?: Modelo;

  /* ---- Etapa 2: Planilha ---- */
  nomeArquivo?: string;
  colunas?: string[];
  registros?: Record<string, string>[];
  codificacao?: CsvLido["codificacao"];
  /** Avisos da leitura do CSV (não bloqueiam). */
  avisosCsv?: string[];

  /* ---- Etapa 3: Cruzamento e destino ---- */
  /** Os tipos de processo da unidade (só pedidos se o destino for novo processo). */
  tiposProcesso?: TipoProcesso[];
  /** O que a tela tem preenchido (sobrevive ao Voltar); recomeça quando o modelo ou as colunas mudam. */
  cruzamento?: RascunhoCruzamento;
  /** O modelo e as colunas a que o `cruzamento` se refere (comparados por referência). */
  baseCruzamento?: { modelo: Modelo; colunas: string[] };
  /** Só existe quando a tela está completa; apagada quando incompleta ou quando o modelo/a planilha mudam. */
  config?: ConfigLote;

  /* ---- Etapa 4: Verificação (só no destino "processo da coluna") ---- */
  /** As linhas preparadas (`prepararLinhas`) da planilha com a config atual; as com `erroLinha` ficam de fora. */
  linhas?: LinhaDocumento[];
  /** Número do processo → o que a aba respondeu (sem `linkArvore`). Só os processos já respondidos. */
  verificacoes?: Record<string, VerificacaoGuardada>;
  /**
   * Índices (`LinhaDocumento.indice`) das linhas prontas para gravar: sem `erroLinha` e com o processo "ok". Só
   * existe com a verificação terminada e ao menos uma linha pronta (é o que habilita o Continuar).
   */
  prontas?: number[];
  /** A planilha (referência) e o que da config decide a verificação: igual ao voltar, não consulta de novo. */
  baseVerificacao?: { registros: Record<string, string>[]; chave: string };
}

/** O preenchimento bruto da etapa 3 (a `config` é derivada dele quando completo). */
export interface RascunhoCruzamento {
  /** Campo do modelo → coluna; só os campos com coluna escolhida. */
  cruzados: Record<string, string>;
  colunaNome?: string;
  descricao: string;
  destino: "tela" | "novo-processo" | "coluna";
  idTipo?: string;
  especificacao: string;
  colunaProcesso?: string;
  colunaNivel?: string;
  colunaHipotese?: string;
  /** Texto do campo (pode estar fora da faixa até ser corrigido). */
  pausa: string;
}

/** Id de cada etapa, na ordem do app. As próximas tarefas acrescentam as suas (cruzamento, verificação, prévia...). */
export type IdEtapa = "modelo" | "planilha" | "cruzamento" | "verificacao" | "previa";

/** O que o app entrega a cada tela de etapa. */
export interface DepsEtapa {
  rpc: Pick<Rpc, "chamar">;
  estado: EstadoApp;
  /** A tela mudou algo que conta para `completa()`: o app redesenha o rodapé (Avançar). */
  aoMudar(): void;
  /**
   * Monta o lote do estado atual, grava-o no repositório e troca o corpo pela tela de execução (a Prévia chama no
   * Iniciar). Rejeita, sem nada enviado ao SEI, se o lote não pôde ser montado ou gravado.
   */
  iniciarExecucao?(): Promise<void>;
  /** O host e o login da aba (a Prévia mede o lote com eles, como o Iniciar o montará). */
  ctx?: { host: string; login: string; idProcedimento?: string };
}

/** Uma tela de etapa. O app a cria ao entrar na etapa e a destrói ao sair (Avançar, Voltar ou fechar). */
export interface TelaEtapa {
  readonly el: HTMLElement;
  /** Tem o que a etapa seguinte precisa: habilita o Avançar. */
  completa(): boolean;
  /** Texto do botão do rodapé (padrão "Avançar"); o app o relê a cada `aoMudar()`. */
  rotuloAvancar?(): string;
  /**
   * A etapa cuida do próprio avanço (a Prévia: Iniciar começa a execução, que não é uma etapa). Sem isto, o app vai
   * à próxima etapa aplicável.
   */
  avancar?(): void;
  /** Chamado depois de `el` entrar na página (carregar listas da aba, por exemplo). */
  iniciar?(): Promise<void> | void;
  /** Para o que estiver pendente: resposta que chegar depois não pode mexer no estado. */
  destruir?(): void;
}

export interface DefinicaoEtapa {
  id: IdEtapa;
  /** Nome no indicador de etapas. */
  rotulo: string;
  criar(d: DepsEtapa): TelaEtapa;
  /** A etapa vale para este estado (padrão: sempre). Fora dela, o Avançar e o Voltar a pulam e o indicador a esconde. */
  aplicavel?(estado: EstadoApp): boolean;
}

/** O que da config decide a verificação (a pausa, a descrição e os campos não mudam o resultado). */
export function chaveVerificacao(cfg: ConfigLote): string {
  const coluna = cfg.destino.tipo === "coluna" ? cfg.destino.coluna : "";
  return JSON.stringify([coluna, cfg.colunaNome, cfg.colunaNivel ?? "", cfg.colunaHipotese ?? "", cfg.modelo.tipoId ?? ""]);
}

/**
 * O resultado da verificação (`linhas`, `verificacoes`, `prontas`) vale para o estado atual: destino coluna, a mesma
 * chave da config e a mesma planilha (referência) que foram verificadas.
 */
export function verificacaoVale(e: EstadoApp): boolean {
  const cfg = e.config;
  const base = e.baseVerificacao;
  return (
    cfg?.destino.tipo === "coluna" &&
    !!base &&
    !!e.registros &&
    base.registros === e.registros &&
    base.chave === chaveVerificacao(cfg) &&
    !!e.linhas &&
    !!e.verificacoes
  );
}

/** Apaga o resultado da verificação (outro destino, outra config, outro modelo ou outra planilha). */
export function limparVerificacao(e: EstadoApp): void {
  e.linhas = undefined;
  e.verificacoes = undefined;
  e.prontas = undefined;
  e.baseVerificacao = undefined;
}

/** Depois de a config mudar: o resultado da verificação some se não vale mais (só a pausa mudar não conta). */
export function conferirVerificacao(e: EstadoApp): void {
  if (e.baseVerificacao && !verificacaoVale(e)) limparVerificacao(e);
}

export const mensagemDe = (e: unknown): string => (e instanceof Error ? e.message : String(e));
