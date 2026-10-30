/**
 * A execucao do lote: o laco (ExecutorLote, 1 por vez, ritmo adaptativo) e a tela de progresso.
 *
 * O que manda aqui e nao duplicar processo num SEI real. Tres regras seguram isso:
 * 1. Grava antes de postar: cada linha e gravada como INCERTA (ok com numero provisorio) ANTES do `criar` e
 *    regravada com o desfecho depois. Se o app morre no meio (modal fechado, aba navegada, extensao recarregada), a
 *    linha em voo fica incerta no registro e a retomada nunca a repete as cegas.
 * 2. Incerto e "ok": o `criar` que estourou o prazo da ponte, caiu ou voltou `incerto` da aba vira ok com o numero
 *    provisorio e o aviso "confira no Controle de Processos"; so `erro` (garantidamente nao criado) e repetivel.
 * 3. Cada gravacao e esperada antes do proximo POST (o executor espera `processar`).
 */

import { ExecutorLote, type ItemLote, RitmoAdaptativo, type SaidaItem } from "@comum/lote/executor";
import type { Rpc } from "@comum/ponte/rpc";
import { h, icone } from "@comum/ui/dom";
import { PAUSA_MAXIMA, PRAZO_CRIAR_MS } from "../modelo/constantes";
import { estimarDuracao } from "../modelo/estimativa";
import type { LinhaLote } from "../modelo/linhas";
import { AVISO_INCERTO, NUMERO_INCERTO, NUMERO_NAO_IDENTIFICADO, type ResultadoCriar } from "../pagina/executor";
import type { Criado, LoteEmAndamento, RepositorioLote } from "../repositorio";

export const MENSAGEM_SESSAO = "A sessão do SEI expirou. Entre de novo e tente outra vez.";
export const MENSAGEM_PONTE =
  "A aba do SEI não respondeu a tempo. O processo da última linha pode ter sido criado: confira no Controle de Processos. O lote está pausado.";
export const MENSAGEM_INCERTO =
  "O SEI não confirmou a criação de um processo (ele pode existir). Confira no Controle de Processos antes de continuar. O lote está pausado.";
export const MENSAGEM_GRAVAR =
  "Não foi possível gravar o progresso do lote neste navegador. O lote está pausado para não perder o controle do que já foi criado.";

export const MENSAGEM_ASSUMIDO = "O lote foi descartado ou assumido por outra aba. Execução parada.";

export interface ResultadoItem {
  criado: Criado;
  aviso?: string;
  incerto?: boolean;
}

export type ItemProc = ItemLote<LinhaLote, ResultadoItem>;
type ItemGravado = LoteEmAndamento["itens"][number];

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** Linha em voo, gravada antes do POST: se ninguem voltar para regravar, ela fica incerta, nunca pendente. */
const ITEM_EM_VOO: ItemGravado = {
  situacao: "ok",
  criado: { numero: NUMERO_INCERTO, idProcedimento: "", url: "" },
  aviso: AVISO_INCERTO,
  incerto: true,
};

function incerto(aviso = AVISO_INCERTO): ResultadoItem {
  return { criado: { numero: NUMERO_INCERTO, idProcedimento: "", url: "" }, aviso, incerto: true };
}

/**
 * A resposta da aba vira resultado do item. Qualquer coisa fora do contrato (resposta malformada) conta como
 * incerta: o POST pode ter saido.
 */
export function resultadoDoCriar(
  r: unknown,
): { situacao: "ok"; resultado: ResultadoItem } | { situacao: "erro"; erro: string; parar: boolean } {
  const x = (r ?? {}) as Partial<Record<string, unknown>>;
  if (x.situacao === "erro") {
    return {
      situacao: "erro",
      erro: typeof x.erro === "string" && x.erro ? x.erro : "Falha ao criar o processo.",
      parar: x.parar === true,
    };
  }
  const c = (x.criado ?? null) as Partial<Criado> | null;
  if (x.situacao !== "ok" || !c || typeof c !== "object") return { situacao: "ok", resultado: incerto() };
  const resultado: ResultadoItem = {
    // O repositorio recusa "ok" sem numero: sem numero, o marcador do que aconteceu.
    criado: {
      numero: typeof c.numero === "string" && c.numero ? c.numero : x.incerto === true ? NUMERO_INCERTO : NUMERO_NAO_IDENTIFICADO,
      idProcedimento: typeof c.idProcedimento === "string" ? c.idProcedimento : "",
      url: typeof c.url === "string" ? c.url : "",
    },
  };
  if (typeof x.aviso === "string" && x.aviso) resultado.aviso = x.aviso;
  if (x.incerto === true) {
    resultado.incerto = true;
    if (!resultado.aviso) resultado.aviso = AVISO_INCERTO;
  }
  return { situacao: "ok", resultado };
}

/** O item como vai para o registro. */
export function itemGravado(i: ItemProc): ItemGravado {
  if (i.situacao === "ok" && i.resultado) {
    const g: ItemGravado = { situacao: "ok", criado: { ...i.resultado.criado } };
    if (i.resultado.aviso) g.aviso = i.resultado.aviso;
    if (i.resultado.incerto) g.incerto = true;
    return g;
  }
  if (i.situacao === "erro") return { situacao: "erro", erro: i.erro ?? "Falha ao criar o processo." };
  return { situacao: "pendente" };
}

/**
 * Itens do executor a partir do registro. Na retomada, `erro` volta a pendente (garantidamente nao criado) e `ok`
 * (incerto inclusive) fica como esta: nunca e recriado.
 */
export function itensDoLote(l: LoteEmAndamento): ItemProc[] {
  return l.linhas.map((entrada, indice) => {
    const g = l.itens[indice];
    if (g?.situacao === "ok" && g.criado) {
      const resultado: ResultadoItem = { criado: { ...g.criado } };
      if (g.aviso) resultado.aviso = g.aviso;
      if (g.incerto) resultado.incerto = true;
      return { indice, entrada, situacao: "ok", resultado, tentativas: 0 };
    }
    return { indice, entrada, situacao: "pendente", tentativas: 0 };
  });
}

export interface DepsExecucao {
  rpc: Pick<Rpc, "chamar">;
  repo: RepositorioLote;
  aoMudar(): void;
  esperar?(ms: number): Promise<void>;
  agora?(): number;
}

export type ModoRodada = "pendentes" | "falhas";

export class ExecucaoLote {
  readonly itens: ItemProc[];
  readonly ritmo: RitmoAdaptativo;
  /** Por que o lote parou sozinho (sessao, ponte, incerto, gravacao); null quando nao parou ou o usuario pausou. */
  motivo: string | null = null;
  private executor: ExecutorLote<LinhaLote, ResultadoItem> | null = null;
  private rodadaAtual: Promise<void> | null = null;

  constructor(
    readonly lote: LoteEmAndamento,
    private readonly d: DepsExecucao,
  ) {
    this.itens = itensDoLote(lote);
    this.ritmo = new RitmoAdaptativo(lote.parametros.pausa, PAUSA_MAXIMA);
  }

  get rodando(): boolean {
    return this.rodadaAtual !== null;
  }

  get estado(): string {
    return this.executor?.estado ?? "ocioso";
  }

  get progresso(): { feitos: number; total: number; falhas: number; restantes: number } {
    let feitos = 0;
    let falhas = 0;
    for (const i of this.itens) {
      if (i.situacao !== "pendente") feitos += 1;
      if (i.situacao === "erro") falhas += 1;
    }
    return { feitos, total: this.itens.length, falhas, restantes: this.itens.length - feitos };
  }

  tempoRestante(): string {
    return estimarDuracao(this.progresso.restantes, this.ritmo.pausaMs());
  }

  /**
   * Uma rodada sobre um recorte dos itens: os pendentes (inicio, retomada, "continuar os que faltam") ou so os com
   * erro ("Tentar de novo as falhas"). Cada rodada tem o seu executor: depois de cancelado, o anterior nao roda mais.
   */
  rodar(modo: ModoRodada): Promise<void> {
    if (this.rodadaAtual) return this.rodadaAtual;
    if (modo === "falhas") {
      for (const i of this.itens) {
        if (i.situacao === "erro") {
          i.situacao = "pendente";
          i.erro = undefined;
        }
      }
    }
    const recorte = this.itens.filter((i) => i.situacao === "pendente");
    this.motivo = null;
    this.executor = new ExecutorLote<LinhaLote, ResultadoItem>(recorte, {
      concorrencia: 1,
      pausaMs: () => this.ritmo.pausaMs(),
      processar: (linha, indice) => this.processar(linha, indice),
      // Erro de desenho nao pode rejeitar a rodada (o lote ficaria preso em "Criando"): o laco segue.
      aoMudar: () => {
        try {
          this.d.aoMudar();
        } catch (e) {
          console.warn("[SEI Pro] processos em lote: falha ao redesenhar", e);
        }
      },
      esperar: this.d.esperar,
    });
    return this.acompanhar(this.executor.iniciar());
  }

  pausar(): void {
    this.executor?.pausar();
  }

  /** Continua depois de uma pausa (do usuario ou de uma parada). */
  continuar(): Promise<void> {
    const e = this.executor;
    if (e?.estado !== "pausado") return this.rodadaAtual ?? Promise.resolve();
    this.motivo = null;
    return this.acompanhar(e.continuar());
  }

  /** O item em voo termina (como no legado); o resto fica pendente no registro, retomavel. */
  cancelar(): void {
    this.executor?.cancelar();
  }

  private acompanhar(p: Promise<void>): Promise<void> {
    const r = p.finally(() => {
      if (this.rodadaAtual === r) this.rodadaAtual = null;
    });
    this.rodadaAtual = r;
    return r;
  }

  private async processar(linha: LinhaLote, indice: number): Promise<SaidaItem<ResultadoItem>> {
    const p = this.lote.parametros;
    // 1. Grava antes de postar. Sem a gravacao nao ha POST: e "erro" (nada saiu) e o lote para.
    // `marcar` false = o registro sumiu ou e de outro lote (outra aba descartou ou assumiu): tambem nao posta.
    let gravou: boolean;
    try {
      gravou = await this.d.repo.marcar(indice, ITEM_EM_VOO, this.lote.id);
    } catch (e) {
      console.warn("[SEI Pro] processos em lote: falha ao gravar antes do POST", e);
      this.motivo = MENSAGEM_GRAVAR;
      return { situacao: "erro", erro: "Não foi possível gravar o progresso; nada foi enviado.", parar: true };
    }
    if (!gravou) {
      this.motivo = MENSAGEM_ASSUMIDO;
      return { situacao: "erro", erro: "Nada foi enviado: o lote foi descartado ou assumido por outra aba.", parar: true };
    }

    // 2. O POST, pela aba. Prazo esgotado ou ponte caida: o POST pode ter saido, entao e incerto e o lote para.
    const agora = this.d.agora ?? Date.now;
    const inicio = agora();
    let saida: SaidaItem<ResultadoItem>;
    try {
      const r = await this.d.rpc.chamar<ResultadoCriar>(
        "criar",
        { idTipo: p.idTipo, linha, nivelAcesso: p.nivelAcesso, hipoteseLegal: p.hipoteseLegal },
        PRAZO_CRIAR_MS,
      );
      const x = resultadoDoCriar(r);
      if (x.situacao === "ok") {
        saida = { situacao: "ok", resultado: x.resultado };
        if (x.resultado.incerto) {
          saida.parar = true;
          this.motivo = MENSAGEM_INCERTO;
        }
      } else {
        saida = { situacao: "erro", erro: x.erro };
        if (x.parar) {
          saida.parar = true;
          this.motivo = MENSAGEM_SESSAO;
        }
      }
    } catch (e) {
      console.warn("[SEI Pro] processos em lote: criar sem resposta", mensagem(e));
      saida = { situacao: "ok", resultado: incerto(`${AVISO_INCERTO} (${mensagem(e)})`), parar: true };
      this.motivo = MENSAGEM_PONTE;
    }
    this.ritmo.registrar(agora() - inicio);

    // 3. Regrava com o desfecho, antes do proximo POST.
    const final: ItemProc = { indice, entrada: linha, situacao: saida.situacao, tentativas: 0 };
    if (saida.resultado) final.resultado = saida.resultado;
    if (saida.erro) final.erro = saida.erro;
    try {
      if (!(await this.d.repo.marcar(indice, itemGravado(final), this.lote.id))) {
        saida.parar = true;
        this.motivo = MENSAGEM_ASSUMIDO;
      }
    } catch (e) {
      // A linha fica INCERTA no registro (gravada no passo 1): seguro. Mas o registro nao acompanha mais: para.
      console.warn("[SEI Pro] processos em lote: falha ao gravar o desfecho", e);
      saida.parar = true;
      this.motivo = MENSAGEM_GRAVAR;
    }
    return saida;
  }
}

/* ---------------------------------------------------------------- tela */

export interface AcoesExecucao {
  pausar(): void;
  continuar(): void;
  cancelar(): void;
  minimizar(): void;
}

/** A tela de progresso: barra, contagem, falhas, tempo restante e os botoes. `atualizar` redesenha so o que muda. */
export class TelaExecucao {
  readonly el: HTMLElement;
  private readonly texto: HTMLElement;
  private readonly barra: HTMLElement;
  private readonly falhas: HTMLElement;
  private readonly restante: HTMLElement;
  private readonly motivo: HTMLElement;
  private readonly pausar: HTMLButtonElement;
  private readonly continuar: HTMLButtonElement;
  private readonly cancelar: HTMLButtonElement;
  private cancelando = false;

  constructor(
    private readonly ex: ExecucaoLote,
    a: AcoesExecucao,
  ) {
    const botao = (rotulo: string, nome: Parameters<typeof icone>[0], fazer: () => void, classe = "") =>
      h("button", { type: "button", class: `spro-botao ${classe}`.trim(), onclick: fazer }, icone(nome, 15), rotulo);
    this.texto = h("p", { class: "pl-progresso-texto", role: "status" });
    this.barra = h("div", { class: "pl-barra-cheia" });
    this.falhas = h("p", { class: "pl-falhas" });
    this.restante = h("p", { class: "pl-restante" });
    this.motivo = h("p", { class: "pl-motivo", role: "alert", hidden: true });
    this.pausar = botao("Pausar", "relogio", () => a.pausar());
    this.continuar = botao("Continuar", "atualizar", () => a.continuar(), "primario");
    this.cancelar = botao(
      "Cancelar",
      "fechar",
      () => {
        this.cancelando = true;
        a.cancelar();
        this.atualizar();
      },
      "perigo",
    );
    this.el = h(
      "section",
      { class: "pl-execucao", "aria-label": "Execução" },
      this.texto,
      h("div", { class: "pl-barra", role: "progressbar", "aria-valuemin": "0", "aria-valuemax": String(ex.progresso.total) }, this.barra),
      this.falhas,
      this.restante,
      this.motivo,
      h(
        "p",
        { class: "pl-nota" },
        "Os processos já criados não são desfeitos pelo cancelamento. Minimizar libera a tela do SEI para leitura; mudar de página nesta aba interrompe o lote, que fica salvo para continuar depois.",
      ),
      h(
        "div",
        { class: "pl-acoes" },
        this.pausar,
        this.continuar,
        this.cancelar,
        h("span", { class: "pl-espaco" }),
        botao("Minimizar", "recolher", () => a.minimizar(), "fantasma"),
      ),
    );
    this.atualizar();
  }

  atualizar(): void {
    const { feitos, total, falhas } = this.ex.progresso;
    const rodando = this.ex.rodando;
    const pausado = this.ex.estado === "pausado";
    const pct = total ? Math.round((feitos / total) * 100) : 0;
    this.barra.setAttribute("style", `width:${pct}%`);
    this.barra.parentElement?.setAttribute("aria-valuenow", String(feitos));
    if (this.cancelando) this.texto.textContent = "Cancelando — aguardando o processo em andamento terminar...";
    else if (pausado && rodando)
      this.texto.textContent = `Pausando — aguardando o processo em andamento terminar... (${feitos} de ${total})`;
    else if (pausado) this.texto.textContent = `Pausado: ${feitos} de ${total} processados.`;
    else this.texto.textContent = `Criando ${Math.min(feitos + 1, total)} de ${total}...`;
    this.falhas.textContent = falhas ? `${falhas} ${falhas === 1 ? "falha" : "falhas"} até agora.` : "";
    this.restante.textContent = !pausado && !this.cancelando ? `Tempo restante: ${this.ex.tempoRestante()}.` : "";
    this.motivo.hidden = !this.ex.motivo;
    this.motivo.replaceChildren(...(this.ex.motivo ? [icone("alerta", 16), this.ex.motivo] : []));
    this.pausar.hidden = this.cancelando || pausado;
    this.continuar.hidden = this.cancelando || !pausado || rodando;
    this.cancelar.hidden = this.cancelando;
  }
}
