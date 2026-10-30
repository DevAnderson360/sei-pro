/**
 * O app do Link Permanente: caixa de texto livre, o que foi reconhecido nela,
 * a pesquisa em lote e a tabela de resultado. Não toca o navegador direto
 * (aba do SEI, download, área de transferência e fechar chegam por `DepsApp`),
 * e por isso roda inteiro nos testes com linkedom. Mesma estrutura do
 * AppHistorico: o construtor monta o DOM fixo, `iniciar` lê o que pré-preenche
 * e `redesenhar` só troca as partes que mudam.
 */

import { ExecutorLote, type SaidaItem } from "@comum/lote/executor";
import type { Rpc } from "@comum/ponte/rpc";
import { extrairProtocolos, type ProtocoloReconhecido } from "@comum/texto/protocolos";
import { avisar } from "@comum/ui/aviso";
import type { AbrirModal } from "@comum/ui/dialogo";
import { h, icone } from "@comum/ui/dom";
import { copiarResultado, montarTabelaResultado, resultadoComoCsv } from "@comum/ui/tabelaResultado";
import type { ResultadoLocalizar } from "../pagina/executor";
import {
  COLUNAS,
  type ContextoApp,
  contarPorTipo,
  haParaRepetir,
  type ItemLink,
  itensVisiveis,
  linhasDosItens,
  MENSAGEM_SESSAO,
  rotulosReconhecidos,
  saidaDoLocalizar,
} from "./estado";

export interface DepsApp {
  /** `selecionados`, `localizar` (e `fechar`, pelo main), atendidos pela aba do SEI. */
  rpc: Pick<Rpc, "chamar">;
  ctx: ContextoApp;
  abrirModal: AbrirModal;
  baixar(nome: string, conteudo: string, tipo: string): void;
  clip: { write?: (itens: ClipboardItem[]) => Promise<void>; writeText(texto: string): Promise<void> };
  /** O construtor de ClipboardItem; sem ele a cópia sai só como texto. */
  ItemClip?: typeof ClipboardItem;
  fechar(): void;
  /** O Link Permanente é rápido: não encolhe para a pastilha (isso é do Processos em Lote). */
  minimizar?: never;
  /** Números que outro módulo (o Processos em Lote) deixou para esta janela; uso único. */
  lerEntradaPendente(): Promise<string | null>;
  /** Injetáveis nas provas: a pausa entre saídas e o aviso (que senão prende o Node por 7 s). */
  esperar?(ms: number): Promise<void>;
  avisar?(texto: string): void;
}

/** 3 pesquisas ao mesmo tempo e uma pausa curta entre as saídas: o ganho é de tempo, sem martelar o SEI. */
const CONCORRENCIA = 3;
const PAUSA_MS = 150;
/** `localizar` abre a página do processo pela pesquisa rápida; num SEI lento passa dos 15 s do padrão. */
const PRAZO_LOCALIZAR_MS = 30_000;

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));

const botaoAcao = (rotulo: string, nome: Parameters<typeof icone>[0], fazer: () => void, classe = "") =>
  h("button", { type: "button", class: `spro-botao pequeno ${classe}`.trim(), onclick: fazer }, icone(nome, 14), rotulo);

export class AppLinkPermanente {
  private itens: ItemLink[] = [];
  private executor: ExecutorLote<ProtocoloReconhecido, ResultadoLocalizar> | null = null;
  /** Cada pesquisa (ou Limpar) abre uma geração: resposta atrasada de uma anterior não redesenha nada. */
  private geracao = 0;
  private rodando = false;
  private sessaoCaiu = false;
  private destruido = false;
  private readonly parar: Array<() => void> = [];
  private readonly el: {
    caixa: HTMLTextAreaElement;
    reconhecidos: HTMLElement;
    pesquisar: HTMLButtonElement;
    progresso: HTMLElement;
    sessao: HTMLElement;
    resultado: HTMLElement;
    repetir: HTMLButtonElement;
    copiar: HTMLButtonElement;
    csv: HTMLButtonElement;
    tabela: HTMLElement;
  };

  constructor(
    private readonly raiz: HTMLElement,
    private readonly d: DepsApp,
  ) {
    const caixa = h("textarea", {
      class: "spro-campo lp-entrada",
      id: "lp-entrada",
      rows: "6",
      spellcheck: "false",
      placeholder: "Cole números de processo ou números SEI, um por linha ou no meio de um texto (e-mail, tabela, parágrafo).",
      "aria-keyshortcuts": "Control+Enter",
      "aria-describedby": "lp-reconhecidos",
    });
    caixa.addEventListener("input", () => this.atualizarReconhecidos());
    this.el = {
      caixa,
      reconhecidos: h("div", { class: "lp-reconhecidos", id: "lp-reconhecidos", "aria-live": "polite" }),
      pesquisar: h(
        "button",
        { type: "button", class: "spro-botao primario", title: "Pesquisar (Ctrl+Enter)", onclick: () => void this.pesquisar() },
        icone("busca", 15),
        "Pesquisar",
      ),
      progresso: h("span", { class: "lp-progresso", role: "status" }),
      sessao: h("p", { class: "lp-sessao", role: "alert", hidden: true }, icone("alerta", 16), MENSAGEM_SESSAO),
      resultado: h("section", { class: "lp-resultado", "aria-label": "Resultado", hidden: true }),
      repetir: botaoAcao("Tentar de novo só as que falharam", "atualizar", () => void this.repetir()),
      copiar: botaoAcao("Copiar com links", "copiar", () => void this.copiar()),
      csv: botaoAcao("Baixar CSV", "baixar", () => this.baixarCsv()),
      tabela: h("div", { class: "lp-tabela" }),
    };
    this.el.resultado.append(
      h("div", { class: "lp-resultado-acoes" }, this.el.repetir, h("span", { class: "lp-espaco" }), this.el.copiar, this.el.csv),
      this.el.tabela,
    );
    raiz.replaceChildren(
      h(
        "header",
        { class: "spro-lista-topo" },
        h("div", { class: "spro-lista-titulo" }, icone("documento", 18), h("h1", {}, "Pesquisar Link Permanente")),
        h(
          "div",
          { class: "spro-lista-topo-acoes" },
          h(
            "button",
            { type: "button", class: "spro-botao-icone", "aria-label": "Fechar", title: "Fechar (Esc)", onclick: () => this.d.fechar() },
            icone("fechar", 18),
          ),
        ),
      ),
      h("label", { class: "lp-rotulo", for: "lp-entrada" }, "Processos e documentos"),
      caixa,
      this.el.reconhecidos,
      h(
        "div",
        { class: "lp-acoes" },
        this.el.pesquisar,
        botaoAcao("Limpar", "lixeira", () => this.limpar(), "fantasma"),
        this.el.progresso,
      ),
      this.el.sessao,
      this.el.resultado,
    );

    // Ctrl+Enter pesquisa de qualquer ponto da janela; Esc fecha. Um diálogo aberto por cima
    // (abrirModal) cuida do próprio Esc: o app só age quando o evento é da sua janela.
    const teclado = (ev: KeyboardEvent) => {
      if (ev.defaultPrevented) return;
      const dialogo = (ev.target as HTMLElement | null)?.closest?.("dialog");
      if (dialogo && !dialogo.contains(this.raiz)) return;
      if (ev.key === "Enter" && (ev.ctrlKey || ev.metaKey)) {
        ev.preventDefault();
        void this.pesquisar();
      } else if (ev.key === "Escape") {
        // Sem isto o <dialog> também trataria o Esc; fechando por aqui, o caminho é um só (o `fechar`).
        ev.preventDefault();
        this.d.fechar();
      }
    };
    document.addEventListener("keydown", teclado);
    this.parar.push(() => document.removeEventListener("keydown", teclado));
    this.redesenhar();
  }

  /** Pré-preenche: os processos selecionados na tela do SEI e, se houver, a entrada deixada por outro módulo (vence). */
  async iniciar(): Promise<void> {
    let texto = "";
    try {
      const sel = await this.d.rpc.chamar<string[]>("selecionados");
      if (Array.isArray(sel)) texto = sel.join("\n");
    } catch (e) {
      // Fora da tela de controle não há seleção: a caixa só começa vazia.
      console.info("[SEI Pro] link permanente: sem processos selecionados", mensagem(e));
    }
    let pendente: string | null = null;
    try {
      pendente = await this.d.lerEntradaPendente();
    } catch (e) {
      console.warn("[SEI Pro] link permanente: entrada pendente ilegível", e);
    }
    if (this.destruido) return;
    if (pendente !== null) texto = pendente;
    // Só se o usuário ainda não começou a digitar enquanto a aba respondia.
    if (!this.el.caixa.value) this.el.caixa.value = texto;
    this.atualizarReconhecidos();
    this.el.caixa.focus({ preventScroll: true });
  }

  destruir(): void {
    this.destruido = true;
    this.geracao += 1;
    this.executor?.cancelar();
    for (const p of this.parar.splice(0)) p();
  }

  private atualizarReconhecidos(): void {
    const protocolos = extrairProtocolos(this.el.caixa.value);
    const rotulos = rotulosReconhecidos(contarPorTipo(protocolos));
    this.el.reconhecidos.replaceChildren(
      h("span", { class: "lp-reconhecidos-titulo" }, "Reconhecidos:"),
      ...(rotulos.length
        ? rotulos.map((r) => h("span", { class: "spro-pilula" }, r.texto, r.dica ? h("span", { class: "lp-dica" }, ` (${r.dica})`) : null))
        : [h("span", { class: "lp-nenhum" }, this.el.caixa.value.trim() ? "Nenhum número reconhecido." : "Nenhum ainda.")]),
    );
    this.el.pesquisar.disabled = this.rodando || protocolos.length === 0;
  }

  private async pesquisar(): Promise<void> {
    if (this.rodando || this.destruido) return;
    const protocolos = extrairProtocolos(this.el.caixa.value);
    if (protocolos.length === 0) return;
    this.executor?.cancelar();
    const geracao = ++this.geracao;
    this.itens = protocolos.map((entrada, indice) => ({ indice, entrada, situacao: "pendente", tentativas: 0 }));
    // Sem repetição automática: um erro fica erro até o usuário pedir "Tentar de novo".
    this.executor = new ExecutorLote<ProtocoloReconhecido, ResultadoLocalizar>(this.itens, {
      concorrencia: CONCORRENCIA,
      pausaMs: () => PAUSA_MS,
      processar: (p) => this.localizar(p.texto, geracao),
      aoMudar: () => {
        if (geracao === this.geracao) this.redesenhar();
      },
      esperar: this.d.esperar,
    });
    const executor = this.executor;
    await this.rodar(geracao, () => executor.iniciar());
  }

  /** "Tentar de novo": os itens com erro e, depois de uma parada pela sessão, os que nem chegaram a sair. */
  private async repetir(): Promise<void> {
    const executor = this.executor;
    if (!executor || this.rodando || this.destruido) return;
    await this.rodar(this.geracao, () => executor.repetirFalhas());
  }

  private async rodar(geracao: number, fazer: () => Promise<void>): Promise<void> {
    this.rodando = true;
    this.sessaoCaiu = false;
    this.redesenhar();
    try {
      await fazer();
    } finally {
      if (geracao === this.geracao) {
        this.rodando = false;
        this.redesenhar();
      }
    }
  }

  private async localizar(ref: string, geracao: number): Promise<SaidaItem<ResultadoLocalizar>> {
    try {
      const r = await this.d.rpc.chamar<ResultadoLocalizar>("localizar", { ref }, PRAZO_LOCALIZAR_MS);
      // Sessão caída: o executor pausa a fila (as próximas falhariam igual) e a tela diz o que fazer.
      if (r.situacao !== "ok" && r.parar && geracao === this.geracao) this.sessaoCaiu = true;
      return saidaDoLocalizar(r);
    } catch (e) {
      // Prazo esgotado, aba fechada: erro desta linha, que o "Tentar de novo" pode refazer.
      return { situacao: "erro", erro: mensagem(e) };
    }
  }

  private limpar(): void {
    this.geracao += 1;
    this.executor?.cancelar();
    this.executor = null;
    this.itens = [];
    this.rodando = false;
    this.sessaoCaiu = false;
    this.el.caixa.value = "";
    this.atualizarReconhecidos();
    this.redesenhar();
    this.el.caixa.focus({ preventScroll: true });
  }

  private async copiar(): Promise<void> {
    const linhas = linhasDosItens(this.itens);
    if (linhas.length === 0) return;
    const aviso = this.d.avisar ?? ((t: string) => avisar(t));
    try {
      const modo = await copiarResultado(linhas, COLUNAS, this.d.clip, this.d.ItemClip);
      aviso(modo === "rico" ? "Copiado com links clicáveis" : "Copiado como texto");
    } catch (e) {
      // A cópia rica pode ser recusada (permissão, foco): tenta só o texto antes de desistir.
      try {
        await copiarResultado(linhas, COLUNAS, { writeText: (t) => this.d.clip.writeText(t) });
        aviso("Copiado como texto");
      } catch {
        aviso(`Não foi possível copiar: ${mensagem(e)}`);
      }
    }
  }

  private baixarCsv(): void {
    const linhas = linhasDosItens(this.itens);
    if (linhas.length === 0) return;
    this.d.baixar("links-permanentes.csv", resultadoComoCsv(linhas, COLUNAS), "text/csv;charset=utf-8");
  }

  private redesenhar(): void {
    if (this.destruido) return;
    const linhas = linhasDosItens(this.itens);
    const temResultado = linhas.length > 0;
    this.el.resultado.hidden = !temResultado;
    this.el.copiar.hidden = !temResultado || this.rodando;
    this.el.csv.hidden = !temResultado || this.rodando;
    this.el.repetir.hidden = this.rodando || !haParaRepetir(this.itens);
    this.el.sessao.hidden = !this.sessaoCaiu;
    this.el.pesquisar.disabled = this.rodando || extrairProtocolos(this.el.caixa.value).length === 0;

    if (this.itens.length && this.executor) {
      const { feitos, total, falhas } = this.executor.progresso;
      const base = this.rodando ? `Pesquisando… ${feitos} de ${total}` : `${feitos} de ${total} pesquisados`;
      this.el.progresso.textContent = falhas ? `${base}, ${falhas} com erro` : base;
    } else this.el.progresso.textContent = "";

    if (!temResultado) {
      this.el.tabela.replaceChildren();
      return;
    }
    const tabela = montarTabelaResultado(document, linhas, COLUNAS);
    // O motivo do erro (prazo, sigilo) fica no título da linha: a coluna Situação já diz o essencial.
    const visiveis = itensVisiveis(this.itens);
    [...tabela.querySelectorAll("tbody tr")].forEach((tr, k) => {
      const erro = visiveis[k]?.erro;
      if (erro) tr.setAttribute("title", erro);
    });
    this.el.tabela.replaceChildren(tabela);
  }
}
