/**
 * O app do Processos em Lote: configuracao, previa, execucao (com retomada) e resultado, mais a pastilha de
 * progresso quando minimizado. Nao toca o navegador direto (aba do SEI, armazenamento, download, area de
 * transferencia, fechar e minimizar chegam por `DepsApp`), e por isso roda inteiro nos testes com linkedom.
 *
 * Minimizado: o app pede a aba (`deps.minimizar(true)`, que chama o `minimizar` da ponte) para encolher o iframe
 * numa pastilha de 320x64 no canto (sei-comum/src/ui/modalIframe.ts). A aba nao avisa o app de volta: quem sabe
 * que esta minimizado e o proprio app, que pediu. Ele marca `html[data-minimizado]` (o CSS solta o <dialog> para
 * ocupar a pastilha, sem veu) e desenha so a pastilha com `feitos/total` e o botao Restaurar.
 */

import type { Area } from "@comum/armazenamento/area";
import type { Rpc } from "@comum/ponte/rpc";
import { avisar } from "@comum/ui/aviso";
import type { AbrirModal } from "@comum/ui/dialogo";
import { h, icone } from "@comum/ui/dom";
import { copiarResultado, resultadoComoCsv } from "@comum/ui/tabelaResultado";
import { AVISO_INTERESSADO, JANELA_OUTRA_ABA_MS } from "../modelo/constantes";
import type { LinhaLote } from "../modelo/linhas";
import type { ModeloLote, RepositorioModelos } from "../modelos";
import type { ContextoLote } from "../pagina/contexto";
import type { LoteEmAndamento, RepositorioLote } from "../repositorio";
import { type CacheConfig, criarConfirmarSemCancelar, type InfoFormTipo, TelaConfiguracao, type ValoresConfig } from "./configuracao";
import { ExecucaoLote, MENSAGEM_ASSUMIDO, type ModoRodada, TelaExecucao } from "./execucao";
import { elegivel, type ModeloPosAcao, PainelPosAcao } from "./posAcao";
import { type PedidoPrevia, TelaPrevia } from "./previa";
import { atualizarTabelaResultado, colunasDoResultado, linhasDoResultado, montarTelaResultado, numerosParaLink } from "./resultado";

/** O que o tratador `contexto` devolve: o da aba sem a base (que leva o infra_hash). */
export type ContextoApp = Omit<ContextoLote, "base">;

export interface DepsApp {
  /**
   * `tipos`, `formTipo`, `criar`, `abrirLinkPermanente`, as acoes depois de criar (`posAcaoOpcoes`, `posAcao`,
   * `posAcaoBloco`) e `fechar`/`minimizar` (pelo main), atendidos pela aba.
   */
  rpc: Pick<Rpc, "chamar">;
  ctx: ContextoApp;
  /** O lote em andamento deste `host|login`. */
  repo: RepositorioLote;
  /** Os modelos salvos deste `host|login` (mesma area). */
  modelos: RepositorioModelos;
  /** A mesma area do repositorio (chrome.storage.local no navegador). */
  area: Area;
  abrirModal: AbrirModal;
  confirmar(texto: string, rotuloOk?: string): Promise<boolean>;
  baixar(nome: string, conteudo: string, tipo: string): void;
  clip: { write?: (itens: ClipboardItem[]) => Promise<void>; writeText(texto: string): Promise<void> };
  ItemClip?: typeof ClipboardItem;
  fechar(): void;
  /** Pastilha (true) ou tela cheia (false), pedido a aba. */
  minimizar(minimizado: boolean): Promise<void>;
  /** Deixa os numeros para o Link Permanente ler ao abrir (chrome.storage.local, CHAVE_ENTRADA_LINK). */
  gravarEntradaLink(texto: string): Promise<void>;
  /** Injetaveis nas provas: a pausa entre processos, o aviso e o relogio. */
  esperar?(ms: number): Promise<void>;
  avisar?(texto: string): void;
  agora?(): number;
}

type Tela = "carregando" | "retomar" | "configuracao" | "previa" | "execucao" | "resultado";

/**
 * Criado que o usuario precisa conferir: incerto ou com aviso de verdade (numero nao identificado...). O
 * "interessado ignorado" sozinho NAO conta: a previa ja avisou que a coluna nao e aplicada, o processo existe e tem
 * numero, e segurar o registro faria a proxima abertura mostrar este resultado de novo.
 */
export function precisaConferir(r: { aviso?: string; incerto?: boolean } | undefined): boolean {
  if (!r) return false;
  if (r.incerto) return true;
  const outros = (r.aviso ?? "")
    .split(";")
    .map((a) => a.trim())
    .filter((a) => a !== "" && a !== AVISO_INTERESSADO);
  return outros.length > 0;
}

/** Linhas criadas que o usuario precisa conferir (ver `precisaConferir`). */
const aConferir = (ex: ExecucaoLote): number => ex.itens.filter((i) => i.situacao === "ok" && precisaConferir(i.resultado)).length;

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const novoId = (): string => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

export class AppProcessosLote {
  private tela: Tela = "carregando";
  private minimizado = false;
  private destruido = false;
  private readonly cache: CacheConfig = { tipos: null, forms: new Map<string, InfoFormTipo>() };
  private valores: Partial<ValoresConfig> = {};
  private config: TelaConfiguracao | null = null;
  private previa: TelaPrevia | null = null;
  private execucao: ExecucaoLote | null = null;
  private telaExecucao: TelaExecucao | null = null;
  /** O painel "Depois de criar" da tela de resultado (so com processo criado e confirmado). */
  private posAcao: PainelPosAcao | null = null;
  /**
   * O modelo escolhido na configuracao quando ESTE lote comecou (pelo id do lote): o painel "Depois de criar" abre
   * com as acoes dele e guarda nele as do painel. So em memoria: um lote retomado depois de fechar nao tem modelo.
   */
  private modeloDoLote: { idLote: string; idModelo: string } | null = null;
  private readonly parar: Array<() => void> = [];
  private readonly conteudo: HTMLElement;
  private readonly cabecalho: HTMLElement;
  private readonly pastilha: HTMLElement;

  constructor(
    private readonly raiz: HTMLElement,
    private readonly d: DepsApp,
  ) {
    this.conteudo = h("div", { class: "pl-conteudo" });
    this.pastilha = h("div", { class: "pl-pastilha", hidden: true });
    this.cabecalho = h(
      "header",
      { class: "spro-lista-topo" },
      h("div", { class: "spro-lista-titulo" }, icone("documento", 18), h("h1", {}, "Processos em Lote")),
      h(
        "div",
        { class: "spro-lista-topo-acoes" },
        h(
          "button",
          { type: "button", class: "spro-botao-icone", "aria-label": "Fechar", title: "Fechar (Esc)", onclick: () => this.d.fechar() },
          icone("fechar", 18),
        ),
      ),
    );
    raiz.replaceChildren(this.cabecalho, this.conteudo, this.pastilha);

    // Esc fecha (minimizado, nao: a pagina e do usuario); Ctrl+Enter avanca (previa, iniciar). Um dialogo aberto por
    // cima (abrirModal/confirmar) cuida do proprio teclado.
    const teclado = (ev: KeyboardEvent) => {
      if (ev.defaultPrevented) return;
      const dialogo = (ev.target as HTMLElement | null)?.closest?.("dialog");
      if (dialogo && !dialogo.contains(this.raiz)) return;
      if (ev.key === "Escape") {
        ev.preventDefault();
        if (!this.minimizado) this.d.fechar();
      } else if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
        if (this.tela === "configuracao") {
          ev.preventDefault();
          this.config?.verPrevia();
        } else if (this.tela === "previa") {
          ev.preventDefault();
          this.previa?.iniciar();
        }
      }
    };
    document.addEventListener("keydown", teclado);
    this.parar.push(() => document.removeEventListener("keydown", teclado));
    this.mostrar("carregando", h("p", { class: "pl-nota" }, "Carregando..."));
  }

  /** Lote incompleto deste host|login: oferece continuar ou descartar; senao, a configuracao. */
  async iniciar(): Promise<void> {
    let lote: LoteEmAndamento | null = null;
    try {
      lote = await this.d.repo.ler();
    } catch (e) {
      console.warn("[SEI Pro] processos em lote: registro ilegivel", e);
    }
    if (this.destruido) return;
    const meu = lote && lote.host === this.d.ctx.host && lote.login.toLowerCase() === this.d.ctx.login.toLowerCase();
    if (lote && meu && this.d.repo.pendentes(lote).length > 0) {
      this.telaRetomar(lote);
      return;
    }
    // Nada pendente, mas linha incerta (ou criada com aviso de verdade): e justamente o que o usuario precisa conferir.
    if (lote && meu && lote.itens.some((i) => i.situacao === "ok" && precisaConferir(i))) {
      void this.finalizar(this.novaExecucao(lote));
      return;
    }
    // Tudo criado e confirmado (o app saiu antes de descartar): nada a retomar.
    if (lote && meu) await this.d.repo.descartar(lote.id).catch(() => undefined);
    this.telaConfiguracao();
  }

  /** Fechar o modal: o lote em execucao PAUSA (o processo em voo termina e e gravado) e fica retomavel. */
  destruir(): void {
    this.destruido = true;
    this.execucao?.pausar();
    // As acoes depois de criar nao sao gravadas: fechar so para (o processo em voo termina, nada novo sai).
    this.posAcao?.destruir();
    this.config?.destruir();
    for (const p of this.parar.splice(0)) p();
  }

  /* ------------------------------------------------------------ telas */

  private mostrar(tela: Tela, el: HTMLElement): void {
    if (this.tela === "configuracao" && tela !== "configuracao") {
      this.config?.destruir();
      this.config = null;
    }
    // Saindo do resultado (Tentar de novo, Continuar os que faltam): as acoes param para nao correr junto.
    if (tela !== "resultado" || this.tela !== "resultado") {
      this.posAcao?.destruir();
      this.posAcao = null;
    }
    this.tela = tela;
    this.conteudo.replaceChildren(el);
    this.desenharPastilha();
  }

  private telaConfiguracao(): void {
    const tela = new TelaConfiguracao(
      {
        rpc: this.d.rpc,
        cache: this.cache,
        // Confirmacao propria, sem Cancelar; o `confirmar` do app (descartar lote) fica como esta.
        modelos: { repo: this.d.modelos, abrirModal: this.d.abrirModal, confirmar: criarConfirmarSemCancelar(this.d.abrirModal) },
        verPrevia: (p, v) => {
          this.valores = v;
          this.telaPrevia(p);
        },
      },
      this.valores,
    );
    this.mostrar("configuracao", tela.el);
    this.config = tela;
    void tela.iniciar();
  }

  private telaPrevia(p: PedidoPrevia): void {
    const tela = new TelaPrevia(p, {
      voltar: () => this.telaConfiguracao(),
      iniciar: (linhas) => void this.iniciarLote(p, linhas),
    });
    this.previa = tela;
    this.mostrar("previa", tela.el);
  }

  private telaRetomar(lote: LoteEmAndamento): void {
    // Escrita recente: o lote pode estar rodando em outra aba (minimizado, por exemplo). Continuar aqui duplicaria.
    const desde = (this.d.agora ?? Date.now)() - (lote.atualizadoEm ?? 0);
    const recente = desde < JANELA_OUTRA_ABA_MS;
    const ok = lote.itens.filter((i) => i.situacao === "ok").length;
    const incertos = lote.itens.filter((i) => i.situacao === "ok" && i.incerto).length;
    const total = lote.itens.length;
    const faltam = this.d.repo.pendentes(lote).length;
    const quando = new Date(lote.iniciadoEm);
    const data = Number.isFinite(quando.getTime()) ? quando.toLocaleString("pt-BR") : "";
    const erro = h("p", { class: "pl-erro", role: "alert", hidden: true });
    const mesmoAssim = h(
      "button",
      { type: "button", class: "spro-botao perigo", hidden: true, onclick: () => void this.retomar(lote, mesmoAssim, erro) },
      icone("atualizar", 15),
      "Continuar mesmo assim",
    );
    const continuar = h(
      "button",
      {
        type: "button",
        class: "spro-botao primario",
        onclick: () => {
          // Lote recente: o primeiro clique so arma o segundo, explicito.
          if (recente) {
            continuar.hidden = true;
            mesmoAssim.hidden = false;
            mesmoAssim.focus?.({ preventScroll: true });
            return;
          }
          void this.retomar(lote, continuar, erro);
        },
      },
      icone("atualizar", 15),
      "Continuar de onde parou",
    );
    const descartar = h(
      "button",
      {
        type: "button",
        class: "spro-botao perigo",
        onclick: async () => {
          const sim = await this.d.confirmar(
            "Descartar o lote em andamento? Os processos já criados continuam no SEI; só o registro do que falta é apagado.",
            "Descartar",
          );
          if (!sim || this.destruido) return;
          await this.d.repo.descartar(lote.id).catch((e) => console.warn("[SEI Pro] processos em lote: falha ao descartar", e));
          this.telaConfiguracao();
        },
      },
      icone("lixeira", 15),
      "Descartar",
    );
    const p = lote.parametros;
    this.mostrar(
      "retomar",
      h(
        "section",
        { class: "pl-retomar", "aria-label": "Lote em andamento" },
        h("h2", {}, "Há um lote em andamento"),
        h(
          "p",
          {},
          `Tipo: ${p.nomeTipo || p.idTipo}${p.nivelAcesso === "1" ? ` (restrito — ${p.nomeHipotese})` : ""}${data ? `, iniciado em ${data}` : ""}. `,
          h("strong", {}, `${ok} de ${total}`),
          ` ${total === 1 ? "processo criado" : "processos criados"}; ${faltam} a criar.`,
        ),
        incertos
          ? h(
              "p",
              { class: "pl-motivo" },
              icone("alerta", 16),
              `${incertos} ${incertos === 1 ? "linha ficou incerta" : "linhas ficaram incertas"} (o SEI não confirmou). Elas não serão repetidas: confira no Controle de Processos.`,
            )
          : null,
        recente
          ? h(
              "p",
              { class: "pl-motivo pl-outra-aba", role: "alert" },
              icone("alerta", 16),
              `Este lote foi atualizado há ${Math.max(0, Math.round(desde / 1000))} segundos e pode estar em execução em outra aba do SEI. Só continue se tiver certeza de que a outra execução parou.`,
            )
          : null,
        erro,
        h("div", { class: "pl-acoes" }, descartar, h("span", { class: "pl-espaco" }), continuar, mesmoAssim),
      ),
    );
  }

  /** Continuar: recarrega o formulario do tipo na aba e roda so os pendentes (os `ok` nunca sao recriados). */
  private async retomar(lote: LoteEmAndamento, botao: HTMLButtonElement, erro: HTMLElement): Promise<void> {
    botao.disabled = true;
    erro.hidden = true;
    try {
      await this.d.rpc.chamar("formTipo", { idTipo: lote.parametros.idTipo }, 60_000);
    } catch (e) {
      if (this.destruido) return;
      botao.disabled = false;
      erro.hidden = false;
      erro.textContent = `Não foi possível carregar o formulário do tipo de processo: ${mensagem(e)}`;
      return;
    }
    if (this.destruido) return;
    // Assume o lote com um id novo, a partir do registro FRESCO: outra aba que ainda o execute perde o `marcar` e
    // para antes do proximo POST.
    let assumido: LoteEmAndamento | null = null;
    try {
      assumido = await this.d.repo.assumir(lote.id, novoId());
    } catch (e) {
      console.warn("[SEI Pro] processos em lote: falha ao assumir o lote", e);
    }
    if (this.destruido) return;
    if (!assumido) {
      botao.disabled = false;
      erro.hidden = false;
      erro.textContent = "O lote mudou desde que esta janela abriu (outra aba o descartou ou assumiu). Feche e abra de novo.";
      return;
    }
    this.executar(assumido, "pendentes");
  }

  /** Grava o lote inteiro ANTES do primeiro POST; sem a gravacao, nada sai. */
  private async iniciarLote(p: PedidoPrevia, linhas: LinhaLote[]): Promise<void> {
    const lote: LoteEmAndamento = {
      id: novoId(),
      host: this.d.ctx.host,
      login: this.d.ctx.login,
      iniciadoEm: (this.d.agora ?? Date.now)(),
      parametros: { ...p.parametros },
      linhas: linhas.map((l) => ({ ...l })),
      itens: linhas.map(() => ({ situacao: "pendente" as const })),
    };
    try {
      await this.d.repo.gravar(lote);
    } catch (e) {
      this.previa?.liberar(`Não foi possível gravar o lote neste navegador; nada foi enviado ao SEI. ${mensagem(e)}`);
      return;
    }
    if (this.destruido) return;
    const idModelo = this.valores.idModelo;
    this.modeloDoLote = idModelo ? { idLote: lote.id, idModelo } : null;
    this.executar(lote, "pendentes");
  }

  /** O modelo deste lote como o painel o usa, lido de novo (pode ter mudado); null sem modelo ou se sumiu. */
  private async modeloParaPainel(ex: ExecucaoLote): Promise<ModeloPosAcao | null> {
    const ref = this.modeloDoLote;
    if (!ref || ref.idLote !== ex.lote.id) return null;
    let modelo: ModeloLote | undefined;
    try {
      modelo = (await this.d.modelos.listar()).find((m) => m.id === ref.idModelo);
    } catch (e) {
      console.warn("[SEI Pro] processos em lote: falha ao ler o modelo do lote", e);
    }
    if (!modelo) return null;
    const id = modelo.id;
    const saida: ModeloPosAcao = {
      nome: modelo.nome,
      guardar: async (p) => !!(await this.d.modelos.definirPosAcoes(id, p)),
    };
    if (modelo.posAcoes) saida.posAcoes = modelo.posAcoes;
    return saida;
  }

  private novaExecucao(lote: LoteEmAndamento): ExecucaoLote {
    const ex = new ExecucaoLote(lote, {
      rpc: this.d.rpc,
      repo: this.d.repo,
      aoMudar: () => this.aoMudar(),
      esperar: this.d.esperar,
      agora: this.d.agora,
    });
    this.execucao = ex;
    return ex;
  }

  private executar(lote: LoteEmAndamento, modo: ModoRodada): void {
    const ex = this.execucao && this.execucao.lote.id === lote.id ? this.execucao : this.novaExecucao(lote);
    // Dois cliques (Tentar de novo, Continuar os que faltam): a rodada em curso e a mesma, nao abre outra tela.
    if (ex.rodando) return;
    void this.rodar(() => ex.rodar(modo));
  }

  private async rodar(fazer: () => Promise<void>): Promise<void> {
    const ex = this.execucao;
    if (!ex) return;
    const tela = new TelaExecucao(ex, {
      pausar: () => {
        ex.pausar();
        this.aoMudar();
      },
      continuar: () => {
        if (!ex.rodando) void this.rodar(() => ex.continuar());
      },
      cancelar: () => {
        ex.cancelar();
        // Pausado nao ha rodada para terminar: o resultado sai ja.
        if (!ex.rodando) void this.finalizar(ex);
      },
      minimizar: () => void this.minimizar(true),
    });
    this.telaExecucao = tela;
    this.mostrar("execucao", tela.el);
    const rodada = fazer();
    this.aoMudar();
    await rodada;
    if (this.destruido || this.execucao !== ex) return;
    if (ex.estado === "pausado") {
      this.aoMudar();
      return;
    }
    await this.finalizar(ex);
  }

  private aoMudar(): void {
    if (this.destruido) return;
    this.telaExecucao?.atualizar();
    this.desenharPastilha();
  }

  /**
   * Fim (concluido ou cancelado): sem nada pendente, com erro ou a conferir (`precisaConferir`), o registro some;
   * senao fica, retomavel ou para conferir ao reabrir.
   *
   * Parada por "assumido/descartado" nunca descarta: o registro ja e de outra aba (ou nao existe). E todo descarte
   * leva o id do proprio lote, para nao apagar um lote mais novo gravado por outra aba.
   */
  private async finalizar(ex: ExecucaoLote): Promise<void> {
    const { falhas, restantes } = ex.progresso;
    const conferir = aConferir(ex);
    const assumido = ex.motivo === MENSAGEM_ASSUMIDO;
    if (!assumido && falhas === 0 && restantes === 0 && conferir === 0) {
      await this.d.repo.descartar(ex.lote.id).catch((e) => console.warn("[SEI Pro] processos em lote: falha ao descartar", e));
    }
    if (this.destruido) return;
    this.telaExecucao = null;
    const interrompido = ex.estado === "cancelado" || restantes > 0;
    // So com processo criado e confirmado: as linhas incertas nunca entram nas acoes.
    const temAlvo = ex.itens.some(elegivel);
    const modelo = temAlvo ? await this.modeloParaPainel(ex) : null;
    if (this.destruido) return;
    let tela: HTMLElement | null = null;
    const painel = temAlvo
      ? new PainelPosAcao(ex.itens, {
          rpc: this.d.rpc,
          esperar: this.d.esperar,
          aoMudar: () => {
            if (tela && !this.destruido) atualizarTabelaResultado(tela, ex.itens, painel);
          },
          ...(modelo ? { modelo } : {}),
        })
      : null;
    tela = montarTelaResultado(
      ex.itens,
      interrompido,
      {
        copiar: () => void this.copiar(),
        baixarCsv: () => this.baixarCsv(),
        repetirFalhas: () => this.executar(ex.lote, "falhas"),
        continuarPendentes: () => this.executar(ex.lote, "pendentes"),
        gerarLinks: () => void this.gerarLinks(),
        descartarENovo:
          falhas === 0 && restantes === 0 && conferir > 0
            ? async () => {
                await this.d.repo.descartar(ex.lote.id).catch((e) => console.warn("[SEI Pro] processos em lote: falha ao descartar", e));
                if (this.destruido) return;
                this.execucao = null;
                this.telaConfiguracao();
              }
            : undefined,
      },
      painel,
    );
    this.mostrar("resultado", tela);
    this.posAcao = painel;
  }

  /* ------------------------------------------------------------ resultado */

  private async copiar(): Promise<void> {
    const ex = this.execucao;
    if (!ex) return;
    const linhas = linhasDoResultado(ex.itens, this.posAcao);
    const colunas = colunasDoResultado(this.posAcao);
    const aviso = this.d.avisar ?? ((t: string) => avisar(t));
    try {
      const modo = await copiarResultado(linhas, colunas, this.d.clip, this.d.ItemClip);
      aviso(modo === "rico" ? "Copiado com links clicáveis" : "Copiado como texto");
    } catch (e) {
      // A copia rica pode ser recusada (permissao, foco): tenta so o texto antes de desistir.
      try {
        await copiarResultado(linhas, colunas, { writeText: (t) => this.d.clip.writeText(t) });
        aviso("Copiado como texto");
      } catch {
        aviso(`Não foi possível copiar: ${mensagem(e)}`);
      }
    }
  }

  private baixarCsv(): void {
    const ex = this.execucao;
    if (!ex) return;
    this.d.baixar(
      "processos-em-lote.csv",
      resultadoComoCsv(linhasDoResultado(ex.itens, this.posAcao), colunasDoResultado(this.posAcao)),
      "text/csv;charset=utf-8",
    );
  }

  /** Os numeros criados (sem os incertos) vao para o Link Permanente, que abre ja com eles; esta janela fecha. */
  private async gerarLinks(): Promise<void> {
    const ex = this.execucao;
    if (!ex) return;
    const numeros = numerosParaLink(ex.itens);
    if (!numeros.length) return;
    const aviso = this.d.avisar ?? ((t: string) => avisar(t));
    try {
      await this.d.gravarEntradaLink(numeros.join("\n"));
      await this.d.rpc.chamar("abrirLinkPermanente");
    } catch (e) {
      aviso(`Não foi possível abrir o Pesquisar Link Permanente: ${mensagem(e)}`);
      return;
    }
    this.d.fechar();
  }

  /* ------------------------------------------------------------ pastilha */

  private async minimizar(m: boolean): Promise<void> {
    if (this.destruido || m === this.minimizado) return;
    try {
      // Primeiro a aba: se ela nao encolher o iframe, o app nao pode virar pastilha numa tela cheia.
      await this.d.minimizar(m);
    } catch (e) {
      console.warn("[SEI Pro] processos em lote: nao foi possivel minimizar", e);
      return;
    }
    if (this.destruido) return;
    this.marcarMinimizado(m);
  }

  /**
   * A aba ja restaurou a janela (clique no item do menu com a pastilha, `OP_RESTAURADO` do modalIframe): o app so
   * volta a desenhar a tela cheia, sem pedir nada a aba.
   */
  restaurado(): void {
    if (this.destruido || !this.minimizado) return;
    this.marcarMinimizado(false);
  }

  private marcarMinimizado(m: boolean): void {
    this.minimizado = m;
    const html = this.raiz.ownerDocument.documentElement;
    if (m) html.setAttribute("data-minimizado", "1");
    else html.removeAttribute("data-minimizado");
    this.cabecalho.hidden = m;
    this.conteudo.hidden = m;
    this.desenharPastilha();
  }

  private desenharPastilha(): void {
    this.pastilha.hidden = !this.minimizado;
    if (!this.minimizado) return;
    const ex = this.execucao;
    const p = ex?.progresso ?? { feitos: 0, total: 0, falhas: 0, restantes: 0 };
    // A parada com motivo (sessao, outra aba, incerto) vem antes do "Pausado" generico.
    const estado =
      this.tela === "resultado"
        ? "Concluído"
        : ex?.motivo
          ? `Parado: ${ex.motivo}`
          : ex?.estado === "pausado" && !ex.rodando
            ? "Pausado"
            : "Criando";
    this.pastilha.replaceChildren(
      h(
        "div",
        { class: "pl-pastilha-texto" },
        h("strong", {}, "Processos em Lote"),
        h(
          "span",
          { class: "pl-pastilha-conta", role: "status" },
          `${p.feitos}/${p.total} · ${estado}`,
          p.falhas ? ` (${p.falhas} com erro)` : "",
        ),
      ),
      h(
        "button",
        {
          type: "button",
          class: "spro-botao pequeno",
          "aria-label": "Restaurar",
          title: "Restaurar a janela",
          onclick: () => void this.minimizar(false),
        },
        icone("expandir", 14),
        "Restaurar",
      ),
    );
  }
}
