/**
 * Executor de lote compartilhado pelo Link Permanente (3 em paralelo, sem nova
 * tentativa automatica) e por Processos em Lote (1 por vez, pausa adaptativa,
 * retomavel). Nao conhece SEI: quem chama entrega `processar`.
 */

export type Situacao = "pendente" | "ok" | "nao-encontrado" | "sem-acesso" | "erro" | "pulado";

export interface ItemLote<E, R> {
  indice: number;
  entrada: E;
  situacao: Situacao;
  resultado?: R;
  erro?: string;
  tentativas: number;
}

export interface SaidaItem<R> {
  situacao: Exclude<Situacao, "pendente" | "pulado">;
  resultado?: R;
  erro?: string;
  /** Registra o item e pausa o lote (ex.: captcha ou sessao caida). */
  parar?: boolean;
}

export interface OpcoesExecutor<E, R> {
  /** 1 = em sequencia. */
  concorrencia: number;
  /** Lida a cada despacho, para o ritmo poder mudar durante o lote. */
  pausaMs(): number;
  processar(entrada: E, indice: number): Promise<SaidaItem<R>>;
  aoMudar?(item: ItemLote<E, R>): void;
  /** Injetavel para as provas nao dormirem de verdade. */
  esperar?(ms: number): Promise<void>;
}

export type EstadoLote = "ocioso" | "rodando" | "pausado" | "cancelado" | "concluido";

const dormir = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class ExecutorLote<E, R> {
  private estadoAtual: EstadoLote = "ocioso";
  private emVoo = new Set<number>();
  private rodada: Promise<void> | null = null;

  constructor(
    private readonly itens: ItemLote<E, R>[],
    private readonly o: OpcoesExecutor<E, R>,
  ) {}

  get estado(): EstadoLote {
    return this.estadoAtual;
  }

  get progresso(): { feitos: number; total: number; falhas: number } {
    let feitos = 0;
    let falhas = 0;
    for (const i of this.itens) {
      if (i.situacao !== "pendente") feitos += 1;
      if (i.situacao === "erro") falhas += 1;
    }
    return { feitos, total: this.itens.length, falhas };
  }

  /** Resolve ao concluir, pausar ou cancelar. */
  iniciar(): Promise<void> {
    if (this.estadoAtual === "rodando" && this.rodada) return this.rodada;
    if (this.estadoAtual === "cancelado") return Promise.resolve();
    this.estadoAtual = "rodando";
    this.rodada = this.executar().finally(() => {
      this.rodada = null;
    });
    return this.rodada;
  }

  pausar(): void {
    if (this.estadoAtual === "rodando") this.estadoAtual = "pausado";
  }

  continuar(): Promise<void> {
    if (this.estadoAtual !== "pausado") return this.rodada ?? Promise.resolve();
    // Se a rodada anterior ainda esta terminando os itens em voo, ela mesma
    // volta a despachar ao ver o estado "rodando"; nao abre um segundo pool.
    if (this.rodada) {
      this.estadoAtual = "rodando";
      return this.rodada;
    }
    return this.iniciar();
  }

  cancelar(): void {
    if (this.estadoAtual === "rodando" || this.estadoAtual === "pausado") this.estadoAtual = "cancelado";
  }

  /** Reprocessa so os itens `erro`; `nao-encontrado` e resposta definitiva. */
  repetirFalhas(): Promise<void> {
    for (const i of this.itens) {
      if (i.situacao === "erro") {
        i.situacao = "pendente";
        i.erro = undefined;
        this.aviso(i);
      }
    }
    if (this.estadoAtual === "concluido" || this.estadoAtual === "ocioso" || this.estadoAtual === "pausado") this.estadoAtual = "ocioso";
    return this.iniciar();
  }

  private aviso(item: ItemLote<E, R>): void {
    this.o.aoMudar?.(item);
  }

  private proximo(): ItemLote<E, R> | null {
    for (const i of this.itens) {
      if (i.situacao === "pendente" && !this.emVoo.has(i.indice)) return i;
    }
    return null;
  }

  private async executar(): Promise<void> {
    const n = Math.max(1, Math.floor(this.o.concorrencia));
    const trabalhadores: Promise<void>[] = [];
    for (let k = 0; k < n; k += 1) trabalhadores.push(this.trabalhar());
    await Promise.all(trabalhadores);
    if (this.estadoAtual === "rodando") this.estadoAtual = "concluido";
  }

  private async trabalhar(): Promise<void> {
    const esperar = this.o.esperar ?? dormir;
    let primeiro = true;
    while (this.estadoAtual === "rodando") {
      const item = this.proximo();
      if (!item) return;
      if (!primeiro) await esperar(this.o.pausaMs());
      primeiro = false;
      // A espera pode ter durado o bastante para pausar/cancelar ou para outro
      // trabalhador pegar o mesmo item.
      if (this.estadoAtual !== "rodando" || item.situacao !== "pendente" || this.emVoo.has(item.indice)) continue;
      await this.rodarItem(item);
    }
  }

  private async rodarItem(item: ItemLote<E, R>): Promise<void> {
    this.emVoo.add(item.indice);
    item.tentativas += 1;
    let parar = false;
    try {
      const saida = await this.o.processar(item.entrada, item.indice);
      item.situacao = saida.situacao;
      item.resultado = saida.resultado;
      item.erro = saida.erro;
      parar = saida.parar === true;
    } catch (e) {
      item.situacao = "erro";
      item.erro = e instanceof Error ? e.message : String(e);
    } finally {
      this.emVoo.delete(item.indice);
    }
    this.aviso(item);
    // Cancelar vence a parada do item: nao rebaixa "cancelado" para "pausado".
    if (parar && this.estadoAtual === "rodando") this.estadoAtual = "pausado";
  }
}

/**
 * Mede a duracao das chamadas: as 5 primeiras fixam a linha de base; depois,
 * a media das ultimas 3 decide se o servidor esta lento (>= 2x: dobra a pausa
 * ate o teto) ou normal (< 1,5x: volta a pausa-base). Entre os dois, mantem.
 */
export class RitmoAdaptativo {
  private pausa: number;
  private base: number | null = null;
  private inicio: number[] = [];
  private janela: number[] = [];

  constructor(
    private readonly pausaBase: number,
    private readonly teto = 10000,
  ) {
    this.pausa = pausaBase;
  }

  registrar(duracaoMs: number): void {
    if (this.base === null) {
      this.inicio.push(duracaoMs);
      if (this.inicio.length >= 5) {
        this.base = this.inicio.reduce((a, b) => a + b, 0) / this.inicio.length;
      }
      return;
    }
    this.janela.push(duracaoMs);
    if (this.janela.length > 3) this.janela.shift();
    const media = this.janela.reduce((a, b) => a + b, 0) / this.janela.length;
    if (media >= 2 * this.base) this.pausa = Math.min(this.teto, this.pausa * 2);
    else if (media < 1.5 * this.base) this.pausa = this.pausaBase;
  }

  pausaMs(): number {
    return this.pausa;
  }
}
