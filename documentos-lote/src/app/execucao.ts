/**
 * A execução do lote (spec §6.2/§6.4): o laço fica no app (o app não tem o cookie do SEI; cada pedido passa pela
 * aba), uma linha por vez pelo `ExecutorLote` do sei-comum, com o ritmo adaptativo, sobre uma LISTA FIXA de linhas
 * (as `pendente` do lote quando a rodada começa). A tela não é uma etapa: o app a mostra no lugar do corpo.
 *
 * O que manda aqui é não duplicar documento (nem processo) num SEI real:
 * 1. Grava antes de pedir (Ruling 18): antes do `criarProcesso`/`criar` de uma linha, o item vai ao repositório
 *    como `erro` INCERTO ("interrompido antes da confirmação"); o desfecho real o sobrescreve. Se o app morre no
 *    meio (modal fechado, aba navegada), a linha nunca fica `pendente` para uma retomada recriar às cegas.
 * 2. Incerto não se repete sozinho (Ruling 16): `incerto` da aba, prazo esgotado ou ponte caída viram `erro` com
 *    `incerto: true` e o que se sabe (id, número, link); a linha fica para conferência.
 * 3. Cada desfecho é gravado antes da linha seguinte (o executor espera `processar`).
 *
 * Desfechos: `naoAberto` → erro "Processo não está aberto na unidade" e segue; sessão expirada → o lote PAUSA e a
 * linha volta a `pendente` (nada foi criado; Continuar a refaz), salvo se a linha já criou o processo novo (aí
 * ela fica incerta: refazê-la criaria outro processo); erro comum → erro com o texto e segue.
 *
 * `rodar(indices)` aceita outra lista fixa (repetir as falhas, gravar as que ficaram de fora, retomar) sobre o
 * mesmo lote. Uma linha `pendente` que já traz `processo` (destino novo processo, repetição) pula o `criarProcesso`.
 */

import { type EstadoLote, ExecutorLote, type ItemLote as ItemExecutor, RitmoAdaptativo, type SaidaItem } from "@comum/lote/executor";
import type { Rpc } from "@comum/ponte/rpc";
import { h, icone } from "@comum/ui/dom";
import { CUSTO_DOCUMENTO_MS, CUSTO_PROCESSO_MS, PAUSA_MAXIMA, PRAZO_CRIAR_MS } from "../modelo/constantes";
import { estimarDuracao } from "../modelo/estimativa";
import { linkSeguro } from "../modelo/links";
import type { ItemLote, LoteDocumentos, RepositorioLote } from "../repositorio";
import { mensagemDe } from "./estado";
import { modeloSemTexto } from "./lote";
import { especificacaoDaLinha } from "./previa";
import { contagemDoLote, resumoDaContagem } from "./resultado";

export const MENSAGEM_NAO_ABERTO = "Processo não está aberto na unidade";
export const MENSAGEM_SESSAO = "Sessão do SEI expirada: entre de novo no SEI (nesta aba) e clique em Continuar.";
export const MENSAGEM_EM_VOO = "Interrompido antes da confirmação: confira o processo antes de repetir.";
export const MENSAGEM_PONTE =
  "A aba do SEI não respondeu. O documento da última linha pode ter sido criado (a aba ainda pode estar terminando o pedido): espere cerca de 1 minuto e confira o processo antes de clicar em Continuar. O lote está pausado.";
export const MENSAGEM_GRAVAR =
  "Não foi possível gravar o progresso do lote neste navegador. O lote está pausado para não perder o controle do que já foi criado.";
export const MENSAGEM_ASSUMIDO = "O lote foi descartado ou assumido por outra aba. Execução parada; nada mais foi enviado.";

const ERRO_RESPOSTA = "A aba do SEI deu uma resposta inesperada. Confira o processo antes de repetir esta linha.";

/** A linha em voo: se ninguém voltar para regravar, ela fica incerta, nunca pendente (Ruling 18). */
const EM_VOO: ItemLote = { situacao: "erro", erro: MENSAGEM_EM_VOO, incerto: true };

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const texto = (v: unknown): string => (typeof v === "string" ? v : "");

/** O que a execução sabe do processo criado pela própria linha (destino novo processo). */
interface ProcessoCriado {
  numero: string;
  link: string;
}

export interface DepsExecucao {
  rpc: Pick<Rpc, "chamar">;
  repo: RepositorioLote;
  /** Algo mudou (item, estado, motivo): a tela redesenha. Não deve lançar. */
  aoMudar(): void;
  /** Injetável para as provas não dormirem a pausa de verdade. */
  esperar?(ms: number): Promise<void>;
  agora?(): number;
}

type Saida = SaidaItem<undefined>;

export class ExecucaoDocumentos {
  readonly ritmo: RitmoAdaptativo;
  /** Por que o lote parou sozinho (sessão, ponte, gravação, outra aba); null quando não parou ou o usuário pausou. */
  motivo: string | null = null;
  /** Os índices (linhas do lote) da rodada atual: a lista fixa. */
  private recorte: number[] = [];
  private itensExecutor: ItemExecutor<number, undefined>[] = [];
  private executor: ExecutorLote<number, undefined> | null = null;
  private rodadaAtual: Promise<void> | null = null;
  /** Linhas que voltam a `pendente` no executor depois do desfecho (sessão expirada antes de criar). */
  private readonly devolver = new Set<number>();
  /** A linha com pedido em voo (fica fora da contagem: o item dela é o `erro` incerto provisório). */
  private emVoo: number | null = null;

  constructor(
    readonly lote: LoteDocumentos,
    private readonly d: DepsExecucao,
  ) {
    this.ritmo = new RitmoAdaptativo(lote.config.pausa, PAUSA_MAXIMA);
  }

  /** O estado do executor da rodada ("ocioso" antes da primeira). */
  get estado(): EstadoLote {
    return this.executor?.estado ?? "ocioso";
  }

  /** Há uma rodada com linha em voo ou por despachar (pausar a deixa terminar). */
  get rodando(): boolean {
    return this.rodadaAtual !== null;
  }

  /**
   * `feitos`/`total` são da rodada (a barra); `criadas`, `erros`, `incertas` e `fora` são do LOTE INTEIRO,
   * acumulados entre as rodadas, pela mesma `contagemDoLote` do resultado (os erros sem as incertas). A linha em voo
   * não conta.
   */
  get progresso(): { feitos: number; total: number; criadas: number; erros: number; incertas: number; fora: number } {
    let feitos = 0;
    for (const i of this.itensExecutor) if (i.situacao !== "pendente") feitos += 1;
    const c = contagemDoLote(this.lote, this.emVoo);
    return { feitos, total: this.recorte.length, criadas: c.criadas, erros: c.erros, incertas: c.incertas, fora: c.fora };
  }

  tempoRestante(): string {
    const { feitos, total } = this.progresso;
    const custo = CUSTO_DOCUMENTO_MS + (this.lote.config.destino.tipo === "novo-processo" ? CUSTO_PROCESSO_MS : 0);
    return estimarDuracao(total - feitos, this.ritmo.pausaMs(), custo);
  }

  /**
   * Uma rodada sobre uma lista fixa: `indices` (padrão: as linhas `pendente` do lote agora). Resolve ao concluir ou
   * ao pausar (pelo usuário ou por uma parada). Duas chamadas seguidas devolvem a mesma rodada.
   */
  rodar(indices?: number[]): Promise<void> {
    if (this.rodadaAtual) return this.rodadaAtual;
    this.recorte = (indices ?? this.lote.itens.map((_, k) => k)).filter((k) => this.lote.itens[k]?.situacao === "pendente");
    this.itensExecutor = this.recorte.map((k) => ({ indice: k, entrada: k, situacao: "pendente", tentativas: 0 }));
    this.motivo = null;
    this.executor = new ExecutorLote<number, undefined>(this.itensExecutor, {
      concorrencia: 1,
      pausaMs: () => this.ritmo.pausaMs(),
      processar: (k) => this.processar(k),
      aoMudar: (item) => {
        if (this.devolver.delete(item.indice)) {
          item.situacao = "pendente";
          item.erro = undefined;
        }
        this.avisar();
      },
      esperar: this.d.esperar,
    });
    return this.acompanhar(this.executor.iniciar());
  }

  /** A linha em voo termina; nada mais é despachado. */
  pausar(): void {
    this.executor?.pausar();
    this.avisar();
  }

  /** Continua depois de uma pausa (do usuário ou de uma parada). */
  continuar(): Promise<void> {
    const e = this.executor;
    if (e?.estado !== "pausado") return this.rodadaAtual ?? Promise.resolve();
    this.motivo = null;
    const p = this.acompanhar(e.continuar());
    this.avisar();
    return p;
  }

  /** Fechar o modal: pausa (a linha em voo termina e é gravada); o lote fica no repositório, retomável. */
  parar(): void {
    this.executor?.pausar();
  }

  private avisar(): void {
    try {
      this.d.aoMudar();
    } catch (e) {
      console.warn("[SEI Pro] documentos em lote: falha ao redesenhar", e);
    }
  }

  private acompanhar(p: Promise<void>): Promise<void> {
    const r = p.finally(() => {
      if (this.rodadaAtual === r) this.rodadaAtual = null;
      this.avisar();
    });
    this.rodadaAtual = r;
    return r;
  }

  /* ------------------------------------------------------------ uma linha */

  /** Grava o item (memória e repositório). false: não gravou (o motivo já está em `this.motivo`). */
  private async gravar(k: number, item: ItemLote): Promise<boolean> {
    try {
      if (!(await this.d.repo.marcar(this.lote.id, k, item))) {
        this.motivo = MENSAGEM_ASSUMIDO;
        return false;
      }
    } catch (e) {
      console.warn("[SEI Pro] documentos em lote: falha ao gravar o progresso", e);
      this.motivo = MENSAGEM_GRAVAR;
      return false;
    }
    this.lote.itens[k] = item;
    return true;
  }

  /**
   * Nada foi enviado nesta linha: ela volta a `pendente` (memória e, se der, repositório) e o lote pausa. O processo
   * que a linha já tinha (destino novo processo, repetição) continua com ela: a próxima tentativa não cria outro.
   */
  private async devolverPendente(k: number, motivo: string): Promise<Saida> {
    this.devolver.add(k);
    const atual = this.lote.itens[k];
    const pendente: ItemLote = { situacao: "pendente" };
    if (atual?.processo) pendente.processo = atual.processo;
    if (atual?.linkProcesso) pendente.linkProcesso = atual.linkProcesso;
    // Sem gravar, o motivo fica o da falha de gravação (ou da outra aba), que `gravar` já pôs.
    if (await this.gravar(k, pendente)) this.motivo = motivo;
    this.lote.itens[k] = pendente;
    return { situacao: "erro", erro: this.motivo ?? motivo, parar: true };
  }

  /** O desfecho da linha: gravado antes da próxima. Falha ao gravar para o lote (o item em voo, incerto, fica). */
  private async concluir(k: number, item: ItemLote, parar = false): Promise<Saida> {
    const gravou = await this.gravar(k, item);
    if (!gravou) this.lote.itens[k] = item;
    const saida: Saida = item.situacao === "criada" ? { situacao: "ok" } : { situacao: "erro", erro: item.erro ?? "Falha." };
    if (parar || !gravou) saida.parar = true;
    return saida;
  }

  private async processar(k: number): Promise<Saida> {
    const linha = this.lote.linhas[k];
    if (!linha) return { situacao: "erro", erro: "Linha inexistente no lote." };
    const cfg = this.lote.config;
    // Destino novo processo com o processo já criado (repetição de uma linha cujo documento falhou): só o `criar`.
    const anterior = this.lote.itens[k];
    const existente: ProcessoCriado | null =
      cfg.destino.tipo === "novo-processo" && anterior?.processo
        ? { numero: anterior.processo, link: linkSeguro(anterior.linkProcesso) }
        : null;

    // 1. Grava antes de pedir. Sem a gravação nada sai: a linha segue pendente e o lote para.
    if (!(await this.gravar(k, this.comProcesso(EM_VOO, existente)))) return this.devolverPendente(k, this.motivo ?? MENSAGEM_GRAVAR);

    const agora = this.d.agora ?? Date.now;
    const inicio = agora();
    this.emVoo = k;
    try {
      let processo: ProcessoCriado | null = existente;
      let alvo: { tipo: "tela" } | { tipo: "coluna"; numero: string } | { tipo: "novo-processo"; numero: string };
      if (existente) {
        alvo = { tipo: "novo-processo", numero: existente.numero };
      } else if (cfg.destino.tipo === "novo-processo") {
        const r = await this.criarProcesso(k, cfg.destino.idTipoProcesso, especificacaoDaLinha(cfg.destino.especificacao, linha.dados));
        if ("saida" in r) return r.saida;
        processo = r.processo;
        // O processo existe: a linha em voo passa a lembrar dele (se o app morrer agora, ele não se perde).
        if (!(await this.gravar(k, this.comProcesso(EM_VOO, processo)))) {
          // O processo existe e o repositório não o registrou (outra aba trocou o lote ou o storage falhou): ao
          // menos a memória (resumo, resultado) e a tela guardam o número. Nada mais é enviado nesta linha.
          console.warn("[SEI Pro] documentos em lote: processo criado e não registrado:", processo.numero);
          const aviso = `O processo ${processo.numero} foi criado, mas não ficou registrado neste navegador; o documento desta linha não foi criado. Confira o processo antes de repetir.`;
          this.lote.itens[k] = this.comProcesso({ ...EM_VOO, erro: aviso }, processo);
          this.motivo = `${this.motivo ?? MENSAGEM_GRAVAR} ${aviso}`;
          return { situacao: "erro", erro: aviso, parar: true };
        }
        alvo = { tipo: "novo-processo", numero: processo.numero };
      } else if (cfg.destino.tipo === "coluna") {
        alvo = { tipo: "coluna", numero: linha.destino ?? "" };
      } else {
        alvo = { tipo: "tela" };
      }

      const pedido: Record<string, unknown> = {
        alvo,
        modelo: modeloSemTexto(cfg.modelo),
        linha: linha.dados,
        colunaNome: cfg.colunaNome,
        modeloDescricao: cfg.modeloDescricao,
        nivel: linha.nivel ?? "publico",
        camposCruzados: cfg.camposCruzados,
      };
      if (linha.hipotese) pedido.hipotese = linha.hipotese;
      let r: unknown;
      try {
        r = await this.d.rpc.chamar<unknown>("criar", pedido, PRAZO_CRIAR_MS);
      } catch (e) {
        this.motivo = MENSAGEM_PONTE;
        return this.concluir(
          k,
          this.comProcesso(
            { situacao: "erro", erro: `A aba do SEI não respondeu (${mensagemDe(e)}). ${MENSAGEM_EM_VOO}`, incerto: true },
            processo,
          ),
          true,
        );
      }
      return this.desfechoDoCriar(k, r, processo, existente !== null);
    } finally {
      this.emVoo = null;
      this.ritmo.registrar(agora() - inicio);
    }
  }

  /** O item com o processo criado pela linha (destino novo processo), para o resultado e para não recriá-lo. */
  private comProcesso(item: ItemLote, p: ProcessoCriado | null): ItemLote {
    if (!p) return item;
    const saida: ItemLote = { ...item, processo: p.numero };
    if (p.link) saida.linkProcesso = p.link;
    return saida;
  }

  private async criarProcesso(k: number, idTipo: string, especificacao: string): Promise<{ processo: ProcessoCriado } | { saida: Saida }> {
    let r: unknown;
    try {
      r = await this.d.rpc.chamar<unknown>("criarProcesso", { idTipo, especificacao }, PRAZO_CRIAR_MS);
    } catch (e) {
      this.motivo = MENSAGEM_PONTE;
      const erro = `A aba do SEI não respondeu ao criar o processo (${mensagemDe(e)}). ${MENSAGEM_EM_VOO}`;
      return { saida: await this.concluir(k, { situacao: "erro", erro, incerto: true }, true) };
    }
    const x = ehObjeto(r) ? r : {};
    const criado = ehObjeto(x.criado) ? x.criado : {};
    if (x.situacao === "ok" && texto(criado.numero)) {
      return { processo: { numero: texto(criado.numero), link: linkSeguro(criado.url) } };
    }
    if (x.situacao === "erro" && x.incerto !== true) {
      // Comprovadamente não criado.
      if (x.sessao === true) return { saida: await this.devolverPendente(k, MENSAGEM_SESSAO) };
      return { saida: await this.concluir(k, { situacao: "erro", erro: texto(x.erro) || "Falha ao criar o processo." }) };
    }
    // Incerto (ou resposta fora do contrato): o processo pode existir. Não se repete; o link ajuda a conferir.
    const item: ItemLote = { situacao: "erro", erro: texto(x.erro) || ERRO_RESPOSTA, incerto: true };
    const link = linkSeguro(criado.url);
    if (link) item.linkProcesso = link;
    if (x.sessao === true) this.motivo = MENSAGEM_SESSAO;
    return { saida: await this.concluir(k, item, x.sessao === true) };
  }

  /** `processoAnterior`: o processo já existia antes desta tentativa (repetição): não foi criado agora. */
  private async desfechoDoCriar(k: number, r: unknown, processo: ProcessoCriado | null, processoAnterior = false): Promise<Saida> {
    const x = ehObjeto(r) ? r : {};
    const criado = ehObjeto(x.criado) ? x.criado : null;
    if (x.situacao === "ok" && criado && texto(criado.numero) && texto(criado.idDocumento)) {
      const item: ItemLote = {
        situacao: "criada",
        criado: { numero: texto(criado.numero), idDocumento: texto(criado.idDocumento), link: linkSeguro(criado.link) },
      };
      return this.concluir(k, this.comProcesso(item, processo));
    }
    if (x.situacao === "erro" && x.incerto !== true) {
      if (x.sessao === true) {
        // Nada foi criado nesta linha... salvo o processo novo: refazê-la criaria outro processo. Na repetição o
        // processo já existia e está registrado: a linha volta a pendente com ele (a próxima tentativa só cria o
        // documento), sem empurrar o usuário para "Repetir mesmo assim".
        if (!processo || processoAnterior) return this.devolverPendente(k, MENSAGEM_SESSAO);
        this.motivo = MENSAGEM_SESSAO;
        const erro = `A sessão do SEI expirou depois de criar o processo ${processo.numero}; o documento não foi criado. Confira antes de repetir.`;
        return this.concluir(k, this.comProcesso({ situacao: "erro", erro, incerto: true }, processo), true);
      }
      const erro = x.naoAberto === true ? MENSAGEM_NAO_ABERTO : texto(x.erro) || "Falha ao criar o documento.";
      return this.concluir(k, this.comProcesso({ situacao: "erro", erro }, processo));
    }
    // Incerto, "ok" sem número ou resposta fora do contrato: pode existir. O que se sabe vai para o resultado.
    const item: ItemLote = { situacao: "erro", erro: texto(x.erro) || ERRO_RESPOSTA, incerto: true };
    if (criado) {
      if (texto(criado.idDocumento)) item.idDocumento = texto(criado.idDocumento);
      if (texto(criado.numero)) item.numero = texto(criado.numero);
      const link = linkSeguro(criado.link);
      if (link) item.link = link;
    }
    if (x.sessao === true) this.motivo = MENSAGEM_SESSAO;
    return this.concluir(k, this.comProcesso(item, processo), x.sessao === true);
  }
}

/* ---------------------------------------------------------------- tela */

export interface AcoesExecucao {
  pausar(): void;
  continuar(): void;
  minimizar(): void;
}

/** Resumo do fim (e da pastilha): o mesmo texto e os mesmos números do resultado. */
export const resumoDoLote = resumoDaContagem;

/**
 * A tela de progresso: barra, contagem, tempo restante, o motivo de uma parada e Pausar/Continuar/Minimizar (sem
 * Cancelar: o X fecha e o lote fica retomável). `atualizar` redesenha só o que muda.
 */
export class TelaExecucao {
  readonly el: HTMLElement;
  private readonly texto: HTMLElement;
  private readonly barra: HTMLElement;
  private readonly contagem: HTMLElement;
  private readonly restante: HTMLElement;
  private readonly motivo: HTMLElement;
  private readonly fim: HTMLElement;
  private readonly botoes: HTMLElement;
  private readonly pausar: HTMLButtonElement;
  private readonly continuar: HTMLButtonElement;
  private concluido = false;

  constructor(
    private readonly ex: ExecucaoDocumentos,
    a: AcoesExecucao,
  ) {
    const botao = (rotulo: string, nome: Parameters<typeof icone>[0], fazer: () => void, classe = "") =>
      h("button", { type: "button", class: `spro-botao ${classe}`.trim(), onclick: fazer }, icone(nome, 15), rotulo);
    this.texto = h("p", { class: "dl-progresso-texto", role: "status" });
    this.barra = h("div", { class: "dl-barra-cheia" });
    this.contagem = h("p", { class: "dl-falhas" });
    this.restante = h("p", { class: "dl-restante" });
    this.motivo = h("p", { class: "dl-motivo", role: "alert", hidden: true });
    this.fim = h("p", { class: "dl-execucao-fim", role: "status", hidden: true });
    this.pausar = botao("Pausar", "relogio", () => a.pausar());
    this.continuar = botao("Continuar", "atualizar", () => a.continuar(), "primario");
    this.botoes = h(
      "div",
      { class: "dl-acoes" },
      this.pausar,
      this.continuar,
      h("span", { class: "dl-espaco" }),
      botao("Minimizar", "recolher", () => a.minimizar(), "fantasma"),
    );
    this.el = h(
      "section",
      { class: "dl-execucao", "aria-label": "Execução" },
      this.texto,
      h("div", { class: "dl-barra", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(ex.progresso.total) }, this.barra),
      this.contagem,
      this.restante,
      this.motivo,
      this.fim,
      h(
        "p",
        { class: "dl-nota" },
        "Os documentos já criados não são desfeitos ao pausar ou fechar. Minimizar libera a tela do SEI para leitura; fechar esta janela pausa o lote, que fica salvo para continuar depois.",
      ),
      this.botoes,
    );
    this.atualizar();
  }

  atualizar(): void {
    const p = this.ex.progresso;
    const pausado = this.ex.estado === "pausado";
    const rodando = this.ex.rodando;
    const pct = p.total ? Math.round((p.feitos / p.total) * 100) : 0;
    this.barra.setAttribute("style", `width:${pct}%`);
    this.barra.parentElement?.setAttribute("aria-valuemax", String(p.total));
    this.barra.parentElement?.setAttribute("aria-valuenow", String(p.feitos));
    if (this.concluido) this.texto.textContent = `Concluído: ${p.feitos} de ${p.total} processadas.`;
    else if (pausado && rodando)
      this.texto.textContent = `Pausando: aguardando o documento em andamento terminar... (${p.feitos} de ${p.total})`;
    else if (pausado) this.texto.textContent = `Pausado: ${p.feitos} de ${p.total} processadas.`;
    else this.texto.textContent = `Gravando ${Math.min(p.feitos + 1, p.total)} de ${p.total}...`;
    this.contagem.textContent = resumoDaContagem({ ...p, fora: 0 });
    this.restante.textContent = !pausado && !this.concluido ? `Tempo restante: ${this.ex.tempoRestante()}.` : "";
    this.motivo.hidden = !this.ex.motivo;
    this.motivo.replaceChildren(...(this.ex.motivo ? [icone("alerta", 16), h("span", {}, this.ex.motivo)] : []));
    this.pausar.hidden = this.concluido || pausado;
    this.continuar.hidden = this.concluido || !pausado || rodando;
  }

  /** Todas as linhas da rodada foram processadas: resumo mínimo (o app troca a tela pelo resultado em seguida). */
  concluida(): void {
    this.concluido = true;
    this.fim.textContent = resumoDoLote(this.ex.progresso);
    this.fim.hidden = false;
    this.atualizar();
  }
}
