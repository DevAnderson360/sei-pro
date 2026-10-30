/**
 * A execução do lote: o laço (ExecutorLote, unidade = documento, ritmo adaptativo) e a tela de progresso.
 *
 * O que manda aqui é nunca aplicar duas vezes a mesma ação num SEI real. As regras que seguram isso:
 * 1. Grava antes de enviar: toda etapa que escreve é gravada como `incerto` ANTES do `executar` e regravada com o
 *    desfecho depois. Se o app morre no meio (modal fechado, aba navegada), a etapa em voo fica incerta no registro
 *    e a retomada nunca a repete. Sem a gravação, nada é enviado.
 * 2. `incerto` nunca se repete sozinho, nem por "Tentar de novo só as falhas" (que reabre só `erro`): vai para o
 *    resultado como "Confira". As etapas seguintes do mesmo documento são puladas (o efeito é desconhecido).
 * 3. `parar` (sessão, captcha, senha errada) pausa o lote; a etapa volta a pendente, porque o SEI a recusou, e
 *    continuar a refaz. Três `incerto` seguidos (o SEI não responde) também pausam.
 * 4. Fechar o modal (`encerrar`) não dispara mais nada; o que estava em voo é regravado quando volta.
 *
 * `pdf` e `baixar` em ZIP rodam uma vez no fim, sobre os documentos que chegaram até eles sem falha.
 * A senha da assinatura fica só na memória deste controle e só vai nos argumentos do `executar` do Assinar.
 */

import { ExecutorLote, type ItemLote, RitmoAdaptativo, type SaidaItem } from "@comum/lote/executor";
import type { Rpc } from "@comum/ponte/rpc";
import { ACOES } from "../modelo/acoes";
import {
  ANTERIOR,
  BLOCO_NAO_CONFIRMADO,
  type EtapaDoc,
  type LoteAcoes,
  type ParamsEtapa,
  type PlanoDoc,
  proximaEtapa,
  registrar,
} from "../modelo/fila";
import type { RepositorioAcoes } from "../repositorio";
import type { EstadoApp } from "./app";

export const MSG_SEM_RESPOSTA = "O SEI não está respondendo. O lote foi pausado.";
export const MSG_PONTE = "A aba do SEI não respondeu. Confira o documento antes de continuar. O lote foi pausado.";
export const MSG_GRAVAR = "Não foi possível gravar o progresso do lote neste navegador. Nada foi enviado e o lote foi pausado.";
/** A etapa gravada antes do envio: se ninguém voltar para regravá-la, ela fica assim no registro. */
export const TEXTO_EM_VOO = "Enviado ao SEI sem confirmação. Confira o documento.";
export const ANTERIOR_INCERTA = "Etapa anterior sem confirmação do SEI";
const FORA_DO_PDF = "Ficou de fora do PDF.";

const PRAZO_EXECUTAR_MS = 120_000;
const PRAZO_ARQUIVO_MS = 300_000;
const PAUSA_BASE_MS = 300;
const PAUSA_MAXIMA_MS = 10_000;
const INCERTOS_PARA_PAUSAR = 3;
const LEITURAS_EM_PARALELO = 3;

type RespostaEtapa =
  | { situacao: "ok"; resumo: string; mudancas?: unknown[]; dados?: Record<string, string>; incerto?: boolean }
  | { situacao: "pulado" | "erro"; erro: string; parar?: boolean; dados?: Record<string, string> };

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const novoIdPadrao = (): string => globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
const escreve = (e: ParamsEtapa): boolean => ACOES.find((a) => a.id === e.acao)!.escreve;
/** Etapa que roda uma vez no fim, sobre todos os documentos (não por documento). */
const ehDoFim = (e: ParamsEtapa | undefined): boolean => e?.acao === "pdf" || (e?.acao === "baixar" && e.modo === "zip");

/** Resposta fora do contrato conta como incerta: o envio pode ter saído. */
function respostaValida(r: unknown): RespostaEtapa | null {
  const x = (r ?? {}) as Partial<Record<string, unknown>>;
  if (x.situacao === "ok") return x as RespostaEtapa;
  if ((x.situacao === "erro" || x.situacao === "pulado") && typeof x.erro === "string") return x as RespostaEtapa;
  return null;
}

/** Marca a etapa como incerta e pula as pendentes seguintes do documento. */
function registrarIncerto(p: PlanoDoc, i: number, msg: string): PlanoDoc {
  const r = registrar(p, i, { situacao: "incerto", mensagem: msg });
  return { ...r, etapas: r.etapas.map((e, k) => (k > i && e.situacao === "pendente" ? pulaPorIncerto(e) : e)) };
}
const pulaPorIncerto = (e: EtapaDoc): EtapaDoc => ({ acao: e.acao, situacao: "pulado", mensagem: ANTERIOR_INCERTA });

/** Na retomada: pendente depois de uma etapa incerta (o app morreu em voo) também não segue. */
function normalizarRetomada(p: PlanoDoc): PlanoDoc {
  const i = p.etapas.findIndex((e) => e.situacao === "incerto");
  if (i < 0) return p;
  return { ...p, etapas: p.etapas.map((e, k) => (k > i && e.situacao === "pendente" ? pulaPorIncerto(e) : e)) };
}

export { BLOCO_NAO_CONFIRMADO };

/**
 * Bloco novo cuja criação ficou incerta: reenviar `{novo}` poderia criar um segundo bloco (o cache da aba não
 * sobrevive ao modal, e um envio que estourou o prazo nem chegou a preenchê-lo). Toda etapa pendente naquela
 * posição vira pulada (e derruba as seguintes); o `{novo}` nunca mais sai neste lote.
 */
function barrarBlocoIncerto(lote: LoteAcoes): void {
  lote.etapas.forEach((et, i) => {
    if (et.acao !== "incluir-bloco" || !("novo" in et.bloco)) return;
    if (!lote.planos.some((p) => p.etapas[i]?.situacao === "incerto")) return;
    lote.planos.forEach((p, k) => {
      if (p.etapas[i]?.situacao === "pendente") lote.planos[k] = registrar(p, i, { situacao: "pulado", mensagem: BLOCO_NAO_CONFIRMADO });
    });
  });
}

export interface DepsExecucao {
  rpc: Pick<Rpc, "chamar">;
  repo: Pick<RepositorioAcoes, "salvar" | "descartar">;
  /** Id da aba do SEI: identifica quem gravou o lote por último. */
  aba: string;
  /** Lote salvo a retomar; sem ele, nasce um lote novo dos planos do estado. */
  lote?: LoteAcoes;
  aoMudar?(): void;
  /** Concluído ou parado de vez (não na pausa). */
  aoTerminar?(): void;
  esperar?(ms: number): Promise<void>;
  agora?(): number;
  novoId?(): string;
}

export type EstadoExecucao = "rodando" | "pausado" | "cancelado" | "concluido";

export interface ControleExecucao {
  readonly lote: LoteAcoes;
  readonly estado: EstadoExecucao;
  /** Por que o lote parou sozinho; null quando não parou ou o usuário pausou. */
  readonly motivo: string | null;
  /** Há uma rodada em curso (inclusive terminando o documento em voo depois de pausar). */
  readonly rodando: boolean;
  /** A rodada em curso: resolve ao pausar, parar ou concluir. */
  rodada(): Promise<void>;
  pausar(): void;
  continuar(senha?: string): Promise<void>;
  /** "Parar lote": a etapa em voo termina; o que falta fica salvo, retomável. */
  cancelar(): void;
  repetirFalhas(): Promise<void>;
  /** Modal fechado: nada novo é disparado, e não há volta nesta instância. */
  encerrar(): void;
  progresso(): { feitos: number; total: number; falhas: number };
  /**
   * Continuar pede a senha: há etapa Assinar pendente e este controle não a tem (retomada depois de reabrir, ou
   * pausa por senha errada). Depois de um simples Pausar, a senha guardada segue valendo.
   */
  precisaSenha(): boolean;
}

class Execucao implements ControleExecucao {
  readonly lote: LoteAcoes;
  estado: EstadoExecucao = "rodando";
  motivo: string | null = null;
  private senha: string | undefined;
  private readonly ritmo = new RitmoAdaptativo(PAUSA_BASE_MS, PAUSA_MAXIMA_MS);
  private executor: ExecutorLote<number, true> | null = null;
  private atual: Promise<void> | null = null;
  private incertosSeguidos = 0;
  private encerrado = false;
  /** "Tentar de novo só as falhas": só os documentos reabertos rodam (os parados pelo usuário ficam). */
  private recorte: Set<number> | null = null;
  private readonly agora: () => number;

  constructor(
    private readonly e: EstadoApp,
    senha: string | undefined,
    private readonly d: DepsExecucao,
  ) {
    this.senha = senha;
    this.agora = d.agora ?? Date.now;
    if (d.lote) {
      this.lote = d.lote;
      this.lote.planos = this.lote.planos.map(normalizarRetomada);
      barrarBlocoIncerto(this.lote);
    } else {
      const t = this.agora();
      this.lote = {
        id: (d.novoId ?? novoIdPadrao)(),
        idProcedimento: e.ctx.idProcedimento,
        protocolo: e.protocolo,
        criadoEm: t,
        atualizadoEm: t,
        aba: d.aba,
        etapas: e.etapas.map((x) => structuredClone(x)),
        planos: e.planos,
      };
    }
    // O estado do app passa a olhar o lote: o resultado e a etapa reescrita (bloco novo) são os mesmos.
    e.etapas = this.lote.etapas;
    e.planos = this.lote.planos;
  }

  get planos(): PlanoDoc[] {
    return this.lote.planos;
  }

  get rodando(): boolean {
    return this.atual !== null;
  }

  rodada(): Promise<void> {
    return this.atual ?? Promise.resolve();
  }

  progresso(): { feitos: number; total: number; falhas: number } {
    let feitos = 0;
    let falhas = 0;
    for (const p of this.planos) {
      if (proximaEtapa(p) === null) feitos += 1;
      if (p.etapas.some((x) => x.situacao === "erro")) falhas += 1;
    }
    return { feitos, total: this.planos.length, falhas };
  }

  precisaSenha(): boolean {
    if (this.senha) return false;
    return this.planos.some((p) => p.etapas.some((x) => x.acao === "assinar" && x.situacao === "pendente"));
  }

  /** Começa a primeira rodada (o lote inteiro é gravado antes de qualquer envio). */
  iniciar(): void {
    this.atual = this.acompanhar(this.primeira());
  }

  private async primeira(): Promise<void> {
    if (ehDoFim(this.lote.etapas.at(-1)) && this.lote.etapas.at(-1)!.acao === "baixar") {
      await this.d.rpc.chamar("zipDescartar").catch(() => undefined);
    }
    try {
      await this.salvar();
    } catch (e) {
      console.warn("[SEI Pro] ações em lote: falha ao gravar o lote", e);
      this.parar(MSG_GRAVAR);
      return;
    }
    await this.rodar();
  }

  pausar(): void {
    if (this.estado !== "rodando") return;
    this.estado = "pausado";
    this.executor?.pausar();
    this.gravarParado();
    this.avisar();
  }

  /** O registro passa a dizer "parado" já (sem esperar a etapa em voo), para quem reabrir não ver outra aba. */
  private gravarParado(): void {
    void this.salvar().catch((e) => console.warn("[SEI Pro] ações em lote: falha ao gravar a pausa", e));
  }

  async continuar(senha?: string): Promise<void> {
    if (this.encerrado || this.estado !== "pausado") return this.rodada();
    if (senha) this.senha = senha;
    if (this.atual) await this.atual;
    if (this.encerrado || this.estado !== "pausado" || this.atual) return this.rodada();
    this.estado = "rodando";
    this.motivo = null;
    this.atual = this.acompanhar(this.rodar());
    this.avisar();
    return this.rodada();
  }

  cancelar(): void {
    if (this.estado !== "rodando" && this.estado !== "pausado") return;
    this.estado = "cancelado";
    this.executor?.cancelar();
    // Pausado não há rodada para terminar: termina já.
    if (!this.atual) this.atual = this.acompanhar(this.terminar());
    this.avisar();
  }

  async repetirFalhas(): Promise<void> {
    if (this.encerrado || this.atual) return this.rodada();
    const reabertos = new Set<number>();
    this.lote.planos = this.planos.map((p, k) => {
      let reabriu = false;
      const etapas = p.etapas.map((x): EtapaDoc => {
        if (x.situacao === "erro" || (reabriu && x.situacao === "pulado" && x.mensagem === ANTERIOR)) {
          reabriu = true;
          return { acao: x.acao, situacao: "pendente" };
        }
        return x;
      });
      if (!reabriu) return p;
      reabertos.add(k);
      return { ...p, etapas };
    });
    this.e.planos = this.lote.planos;
    this.recorte = reabertos;
    this.estado = "rodando";
    this.motivo = null;
    this.atual = this.acompanhar(this.primeira());
    this.avisar();
    return this.rodada();
  }

  encerrar(): void {
    if (this.encerrado) return;
    this.encerrado = true;
    this.senha = undefined;
    if (this.estado === "rodando") this.estado = "pausado";
    this.executor?.pausar();
    // Lote concluído já saiu do registro: gravar agora o traria de volta.
    if (this.estado !== "concluido" && this.estado !== "cancelado") this.gravarParado();
  }

  private acompanhar(p: Promise<void>): Promise<void> {
    const r: Promise<void> = p
      .catch((e) => {
        console.warn("[SEI Pro] ações em lote: falha na execução", e);
        this.parar(mensagem(e));
      })
      .finally(() => {
        if (this.atual === r) this.atual = null;
        this.avisar();
      });
    return r;
  }

  private avisar(): void {
    try {
      this.d.aoMudar?.();
    } catch (e) {
      console.warn("[SEI Pro] ações em lote: falha ao redesenhar", e);
    }
  }

  private parar(motivo: string): void {
    this.motivo = motivo;
    const rodava = this.estado === "rodando";
    if (rodava) this.estado = "pausado";
    this.executor?.pausar();
    if (rodava) this.gravarParado();
  }

  private pode(): boolean {
    return !this.encerrado && this.estado === "rodando";
  }

  private async salvar(): Promise<void> {
    this.lote.atualizadoEm = this.agora();
    this.lote.aba = this.d.aba;
    this.lote.estado = this.estado === "rodando" && !this.encerrado ? "rodando" : "parado";
    await this.d.repo.salvar({ ...this.lote, planos: [...this.planos] });
  }

  private definir(k: number, p: PlanoDoc): void {
    this.planos[k] = p;
  }

  /** Uma rodada: os documentos com etapa pendente (fora as do fim), depois a etapa do fim. */
  private async rodar(): Promise<void> {
    if (!this.pode()) return this.depoisDaRodada();
    this.incertosSeguidos = 0;
    // Continuar depois de uma criação de bloco incerta não pode reenviar `{novo}`.
    barrarBlocoIncerto(this.lote);
    const docs = this.planos.flatMap((p, k) => {
      const i = proximaEtapa(p);
      return i !== null && !ehDoFim(this.lote.etapas[i]) && this.noRecorte(k) ? [k] : [];
    });
    const itens: ItemLote<number, true>[] = docs.map((k, indice) => ({ indice, entrada: k, situacao: "pendente", tentativas: 0 }));
    const executor = new ExecutorLote<number, true>(itens, {
      // Escrita uma por vez; um lote só de leitura (baixar arquivos) lê 3 por vez.
      concorrencia: this.lote.etapas.some(escreve) ? 1 : LEITURAS_EM_PARALELO,
      pausaMs: () => this.ritmo.pausaMs(),
      processar: (k) => this.processar(k),
      aoMudar: () => this.avisar(),
      ...(this.d.esperar ? { esperar: this.d.esperar } : {}),
    });
    this.executor = executor;
    await executor.iniciar();
    if (!this.pode() || executor.estado !== "concluido") return this.depoisDaRodada();
    await this.faseDoFim();
    if (!this.pode()) return this.depoisDaRodada();
    this.estado = "concluido";
    await this.terminar();
  }

  private noRecorte(k: number): boolean {
    return this.recorte === null || this.recorte.has(k);
  }

  /** Pausa: nada a fazer (o registro já está gravado). Cancelado: termina. */
  private async depoisDaRodada(): Promise<void> {
    if (this.estado === "cancelado" && !this.encerrado) await this.terminar();
  }

  private async processar(k: number): Promise<SaidaItem<true>> {
    let primeira = true;
    for (;;) {
      if (!this.pode()) return { situacao: "ok" };
      const p = this.planos[k]!;
      const i = proximaEtapa(p);
      if (i === null || ehDoFim(this.lote.etapas[i])) break;
      if (!primeira) await (this.d.esperar ?? dormir)(this.ritmo.pausaMs());
      primeira = false;
      if (!this.pode()) return { situacao: "ok" };
      const saida = await this.etapa(k, i);
      if (saida) return saida;
    }
    return { situacao: this.planos[k]!.etapas.some((x) => x.situacao === "erro") ? "erro" : "ok" };
  }

  /** Uma etapa de um documento; devolve a saída do item só quando o lote para. */
  private async etapa(k: number, i: number): Promise<SaidaItem<true> | null> {
    const etapa = this.lote.etapas[i]!;
    const p = this.planos[k]!;
    const grava = escreve(etapa);
    if (grava) {
      this.definir(k, registrar(p, i, { situacao: "incerto", mensagem: TEXTO_EM_VOO }));
      try {
        await this.salvar();
      } catch (e) {
        console.warn("[SEI Pro] ações em lote: falha ao gravar antes do envio", e);
        this.definir(k, p);
        this.parar(MSG_GRAVAR);
        return { situacao: "erro", erro: MSG_GRAVAR, parar: true };
      }
      // A gravação pode ter durado o bastante para o modal fechar ou o usuário pausar: nada sai.
      if (!this.pode()) {
        this.definir(k, p);
        await this.salvar().catch(() => undefined);
        return { situacao: "ok" };
      }
    }
    const args: Record<string, unknown> = { etapa, numero: p.doc.numero, loteId: this.lote.id };
    if (etapa.acao === "assinar") args.senha = this.senha ?? "";
    const inicio = this.agora();
    let r: RespostaEtapa | null = null;
    let falha: string | null = null;
    try {
      r = respostaValida(await this.d.rpc.chamar("executar", args, PRAZO_EXECUTAR_MS));
      if (!r) falha = "resposta inesperada da aba";
    } catch (e) {
      falha = mensagem(e);
    }
    this.ritmo.registrar(this.agora() - inicio);
    let parar: string | null = null;
    if (falha !== null) {
      if (!grava) this.incertosSeguidos = 0;
      // O envio pode ter saído: escrita fica incerta; leitura é só erro (repetir não estraga nada).
      this.definir(
        k,
        grava ? registrarIncerto(p, i, `${TEXTO_EM_VOO} (${falha})`) : registrar(p, i, { situacao: "erro", mensagem: falha }),
      );
      parar = MSG_PONTE;
    } else if (r!.situacao === "ok") {
      if (r!.incerto) {
        this.definir(k, registrarIncerto(p, i, r!.resumo));
        // Bloco criado e inclusão incerta: o bloco existe, os seguintes entram nele.
        this.reescreverBloco(i, r!.dados);
        this.incertosSeguidos += 1;
        if (this.incertosSeguidos >= INCERTOS_PARA_PAUSAR) parar = MSG_SEM_RESPOSTA;
      } else {
        this.incertosSeguidos = 0;
        this.definir(k, registrar(p, i, { situacao: "ok", mensagem: r!.resumo, ...(r!.dados ? { dados: r!.dados } : {}) }));
        this.reescreverBloco(i, r!.dados);
      }
    } else {
      this.incertosSeguidos = 0;
      if (r!.parar) {
        // O SEI recusou (sessão, captcha, senha): nada foi aplicado, a etapa volta a pendente.
        this.definir(k, registrar(p, i, { situacao: "pendente" }));
        parar = r!.erro;
        // Assinatura recusada (senha errada, em geral): a senha guardada não serve mais; continuar pede outra.
        if (etapa.acao === "assinar") this.senha = undefined;
      } else {
        this.definir(k, registrar(p, i, { situacao: r!.situacao, mensagem: r!.erro }));
      }
      // Bloco novo criado e inclusão recusada: a etapa vira `{id}` mesmo assim, para ninguém criar outro bloco.
      this.reescreverBloco(i, r!.dados);
    }
    // Criação de bloco incerta: os documentos seguintes não tentam de novo (nem aqui, nem ao continuar).
    barrarBlocoIncerto(this.lote);
    try {
      await this.salvar();
    } catch (e) {
      // A etapa fica como gravada antes do envio (incerta): seguro, mas o registro não acompanha mais.
      console.warn("[SEI Pro] ações em lote: falha ao gravar o desfecho", e);
      parar ??= MSG_GRAVAR;
    }
    this.avisar();
    if (parar !== null) {
      this.parar(parar);
      return { situacao: "erro", erro: parar, parar: true };
    }
    return null;
  }

  /** Bloco novo criado: a etapa vira `{id}` no lote, para os documentos seguintes e para a retomada. */
  private reescreverBloco(i: number, dados: Record<string, string> | undefined): void {
    const et = this.lote.etapas[i];
    if (et?.acao !== "incluir-bloco" || !("novo" in et.bloco) || !dados?.bloco) return;
    this.lote.etapas[i] = { acao: "incluir-bloco", bloco: { id: dados.bloco, texto: et.bloco.novo } };
  }

  /** PDF ou ZIP: uma vez, sobre quem chegou à última etapa sem falha. */
  private async faseDoFim(): Promise<void> {
    const f = this.lote.etapas.length - 1;
    const et = this.lote.etapas[f];
    if (!ehDoFim(et)) return;
    const ks = this.planos.flatMap((p, k) => (proximaEtapa(p) === f && this.noRecorte(k) ? [k] : []));
    if (ks.length === 0) return;
    if (et!.acao === "pdf") await this.pdf(f, ks);
    else await this.zip(f, ks);
    await this.salvar().catch((e) => {
      console.warn("[SEI Pro] ações em lote: falha ao gravar", e);
      this.parar(MSG_GRAVAR);
    });
  }

  private aplicarATodos(f: number, ks: number[], r: { situacao: "ok" | "erro" | "pulado"; mensagem: string }): void {
    for (const k of ks) this.definir(k, registrar(this.planos[k]!, f, r));
  }

  private async pdf(f: number, ks: number[]): Promise<void> {
    const numeros = ks.map((k) => this.planos[k]!.doc.numero);
    let r: RespostaEtapa | null;
    try {
      r = respostaValida(await this.d.rpc.chamar("pdf", { numeros }, PRAZO_ARQUIVO_MS));
    } catch (e) {
      this.aplicarATodos(f, ks, { situacao: "erro", mensagem: mensagem(e) });
      return;
    }
    if (!r) return this.aplicarATodos(f, ks, { situacao: "erro", mensagem: "Resposta inesperada da aba ao gerar o PDF." });
    if (r.situacao !== "ok") {
      if (r.parar) return this.parar(r.erro);
      return this.aplicarATodos(f, ks, { situacao: r.situacao, mensagem: r.erro });
    }
    const fora = new Set((r.dados?.foraDoPdf ?? "").split(",").filter(Boolean));
    for (const k of ks) {
      const n = this.planos[k]!.doc.numero;
      this.definir(
        k,
        registrar(this.planos[k]!, f, fora.has(n) ? { situacao: "erro", mensagem: FORA_DO_PDF } : { situacao: "ok", mensagem: r.resumo }),
      );
    }
  }

  /** O acumulador é refeito do zero a cada vez (uma pausa no meio ou um modal reaberto o perdem). */
  private async zip(f: number, ks: number[]): Promise<void> {
    await this.d.rpc.chamar("zipDescartar").catch(() => undefined);
    const guardados: number[] = [];
    const fila = [...ks];
    const trabalhar = async (): Promise<void> => {
      for (let k = fila.shift(); k !== undefined && this.pode(); k = fila.shift()) {
        const p = this.planos[k]!;
        let r: RespostaEtapa | null;
        try {
          r = respostaValida(await this.d.rpc.chamar("zipAdicionar", { numero: p.doc.numero, loteId: this.lote.id }, PRAZO_ARQUIVO_MS));
        } catch (e) {
          r = { situacao: "erro", erro: mensagem(e) };
        }
        if (!r) r = { situacao: "erro", erro: "Resposta inesperada da aba." };
        if (r.situacao === "ok") guardados.push(k);
        else if (r.parar) this.parar(r.erro);
        else this.definir(k, registrar(this.planos[k]!, f, { situacao: r.situacao, mensagem: r.erro }));
      }
    };
    await Promise.all(Array.from({ length: Math.min(LEITURAS_EM_PARALELO, ks.length) }, trabalhar));
    if (!this.pode() || guardados.length === 0) return;
    guardados.sort((a, b) => a - b);
    let r: RespostaEtapa | null;
    try {
      r = respostaValida(await this.d.rpc.chamar("zipFechar", { nome: `Documentos ${this.lote.protocolo}` }, PRAZO_ARQUIVO_MS));
    } catch (e) {
      r = { situacao: "erro", erro: mensagem(e) };
    }
    if (!r) r = { situacao: "erro", erro: "Resposta inesperada da aba ao fechar o ZIP." };
    if (r.situacao === "ok") this.aplicarATodos(f, guardados, { situacao: "ok", mensagem: r.resumo });
    else if (r.parar) this.parar(r.erro);
    else this.aplicarATodos(f, guardados, { situacao: r.situacao, mensagem: r.erro });
  }

  /** Fim (concluído ou parado de vez): árvore recarregada uma vez; sem nada pendente, o registro sai. */
  private async terminar(): Promise<void> {
    this.senha = undefined;
    this.recorte = null;
    if (this.estado === "cancelado" && ehDoFim(this.lote.etapas.at(-1)) && this.lote.etapas.at(-1)!.acao === "baixar") {
      await this.d.rpc.chamar("zipDescartar").catch(() => undefined);
    }
    await this.d.rpc.chamar("recarregarArvore").catch((e) => console.warn("[SEI Pro] ações em lote: árvore não recarregada", e));
    const pendente = this.planos.some((p) => proximaEtapa(p) !== null);
    if (!pendente) await this.d.repo.descartar(this.lote.id).catch((e) => console.warn("[SEI Pro] ações em lote: falha ao descartar", e));
    else await this.salvar().catch((e) => console.warn("[SEI Pro] ações em lote: falha ao gravar", e));
    if (this.encerrado) return;
    try {
      this.d.aoTerminar?.();
    } catch (e) {
      console.warn("[SEI Pro] ações em lote: falha ao mostrar o resultado", e);
    }
  }
}

const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Cria o controle e começa a rodar (lote novo dos planos do estado, ou `deps.lote` na retomada). */
export function executarLote(e: EstadoApp, senha: string | undefined, deps: DepsExecucao): ControleExecucao {
  const c = new Execucao(e, senha, deps);
  c.iniciar();
  return c;
}
