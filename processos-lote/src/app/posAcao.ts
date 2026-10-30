/**
 * Painel "Depois de criar" da tela de resultado: incluir os processos criados num bloco interno, aplicar um
 * marcador e acompanhar. Cada acao e opcional e independente (falha de uma nao impede as outras nem desfaz a
 * criacao), e o resultado de cada uma aparece por processo na coluna "Depois de criar" da tabela.
 *
 * O que manda aqui, como na criacao, e nao corromper dado real do SEI:
 * - So entram processos `ok` com numero CONFIRMADO e `idProcedimento`: linha incerta (ou com numero nao
 *   identificado) nunca e tocada; o painel diz quantas ficaram de fora e por que.
 * - Marcador e acompanhamento sao idempotentes no nucleo (o mesmo valor de novo vira "ja estava"): um `erro`
 *   neles, inclusive a ponte que nao respondeu, pode ser repetido sem risco.
 * - A inclusao em bloco e UM POST com todos os ids. Se a ponte cai ou o prazo estoura, o POST pode ter saido:
 *   todos ficam `nao-confirmado` ("confira o bloco N"). O painel guarda cada par bloco|processo nao confirmado
 *   (que um Aplicar em outro bloco nao apaga) e NUNCA o reenvia para aquele bloco: nem pelo "Tentar de novo as
 *   falhas" nem por um novo Aplicar. `fora-da-pagina` tambem nao e falha a repetir as cegas: o processo nao
 *   estava na pagina do Controle, e o caminho e fazer pelo Controle de Processos.
 * - Nada disto e gravado. Essa memoria vale so enquanto o painel existe: fechar o modal (ou voltar a etapa 1 com
 *   "Tentar de novo"/"Continuar") a apaga, e ai o painel novo nao sabe do que ficou nao confirmado. Marcador e
 *   acompanhamento continuam seguros de repetir (idempotentes); a inclusao em bloco, nao: depois de um "confira
 *   o bloco", o usuario precisa conferir o bloco antes de aplicar de novo.
 *
 * Modelo do lote (o escolhido na configuracao quando o lote comecou): o botao "Guardar estas acoes no modelo"
 * grava nele as acoes como estao no painel (so as ligadas; nenhuma ligada limpa). Se o modelo ja tem acoes, o
 * painel abre com elas ESCOLHIDAS, nunca aplicadas: o usuario ainda clica Aplicar. Marcador, grupo ou bloco do
 * modelo que nao esta nas listas carregadas deixa a acao desligada, com o aviso "nao existe mais nesta unidade".
 */

import { ExecutorLote, type ItemLote, type SaidaItem } from "@comum/lote/executor";
import { ErroRpc, type Rpc } from "@comum/ponte/rpc";
import { type Combo, criarCombo } from "@comum/ui/combobox";
import { h, icone } from "@comum/ui/dom";
import type { PosAcoes } from "../modelos";
import { NUMERO_INCERTO, NUMERO_NAO_IDENTIFICADO } from "../pagina/executor";
import type {
  ListaPosAcao,
  OpcaoBloco,
  Opcao as OpcaoSei,
  OpcoesPosAcao,
  ResultadoPosAcao,
  ResultadoPosAcaoBloco,
} from "../pagina/posAcao";
import { type ItemProc, MENSAGEM_SESSAO } from "./execucao";

export const PRAZO_OPCOES_MS = 60_000;
export const PRAZO_POS_ACAO_MS = 30_000;
export const PRAZO_POS_ACAO_BLOCO_MS = 60_000;
export const PAUSA_POS_ACAO_MS = 300;
export const MAX_TEXTO_MARCADOR = 250;
export const MAX_OBSERVACAO = 500;

export type AcaoPos = "bloco" | "marcador" | "acompanhar";
type AcaoProcesso = Exclude<AcaoPos, "bloco">;
export type SituacaoPos = "ok" | "ja-estava" | "erro" | "nao-confirmado" | "fora-da-pagina" | "aguardando";

export interface EstadoPos {
  situacao: SituacaoPos;
  mensagem?: string;
  /** Bloco: em qual bloco (id) e o numero que o usuario ve, para o "confira o bloco N". */
  idBloco?: string;
  numeroBloco?: string;
}

export const TEXTO_FORA_DA_PAGINA = "fora da página do Controle: faça pelo Controle de Processos";
const NAO_ENVIADO_SESSAO = "Não enviado: a sessão do SEI expirou.";

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/**
 * A aba ainda roda o content script de antes de uma atualizacao do SEI Pro e nao conhece a operacao pedida. Nada
 * foi enviado ao SEI (a ponte recusa antes de chamar qualquer tratador): e falha CERTA, que o usuario resolve
 * recarregando a pagina do SEI.
 */
export const MENSAGEM_RECARREGAR = "O SEI Pro foi atualizado: recarregue a página do SEI (F5) e tente de novo.";

function operacaoDesconhecida(e: unknown): boolean {
  if (e instanceof ErroRpc && e.codigo === "OP_DESCONHECIDA") return true;
  return e instanceof Error && e.message.startsWith("Operação desconhecida");
}

/** Processo em que as acoes podem rodar: criado, com numero confirmado e id do procedimento. */
export function elegivel(i: ItemProc): boolean {
  if (i.situacao !== "ok" || !i.resultado || i.resultado.incerto) return false;
  const { numero, idProcedimento } = i.resultado.criado;
  return numeroConfirmado(i) && !!numero && !!idProcedimento?.trim();
}

const ROTULO_ACAO: Record<AcaoPos, string> = { bloco: "Bloco", marcador: "Marcador", acompanhar: "Acompanhamento" };

function textoEstado(acao: AcaoPos, e: EstadoPos): string {
  switch (e.situacao) {
    case "ok":
      return acao === "bloco" ? "✔ incluído" : "✔ aplicado";
    case "ja-estava":
      return "↺ já estava";
    case "erro":
      return `✖ ${e.mensagem || "falhou"}`;
    case "nao-confirmado":
      return `? não confirmado: confira o bloco ${e.numeroBloco || e.idBloco || ""}`.trim();
    case "fora-da-pagina":
      return TEXTO_FORA_DA_PAGINA;
    default:
      return "aguardando";
  }
}

/** O texto da coluna "Depois de criar" de um processo: uma parte por acao que ja rodou (ou esta na fila). */
export function resumoDepois(estados: Partial<Record<AcaoPos, EstadoPos>> | undefined, outrosBlocos: EstadoPos[] = []): string {
  const e = estados ?? {};
  const partes: string[] = [];
  if (e.bloco) partes.push(`${ROTULO_ACAO.bloco}: ${textoEstado("bloco", e.bloco)}`);
  for (const b of outrosBlocos) partes.push(`${ROTULO_ACAO.bloco}: ${textoEstado("bloco", b)}`);
  for (const a of ["marcador", "acompanhar"] as const) if (e[a]) partes.push(`${ROTULO_ACAO[a]}: ${textoEstado(a, e[a]!)}`);
  return partes.join("; ");
}

interface ConfigPos {
  bloco?: { id: string; numero: string };
  marcador?: { nome: string; texto: string };
  acompanhar?: { grupo: string; observacao: string };
}

interface Plano {
  /** Uma chamada por bloco (o Aplicar tem um so; o "Tentar de novo" repete cada erro no bloco dele). */
  blocos: Array<{ cfg: NonNullable<ConfigPos["bloco"]>; itens: ItemProc[] }>;
  processos: Entrada[];
}

interface Entrada {
  item: ItemProc;
  acoes: AcaoProcesso[];
}

/** O modelo escolhido na configuracao quando o lote comecou. */
export interface ModeloPosAcao {
  nome: string;
  /** As acoes ja guardadas: o painel abre com elas escolhidas (nunca aplicadas sozinhas). */
  posAcoes?: PosAcoes;
  /** Grava as acoes no modelo; false se o modelo nao existe mais. */
  guardar(p: PosAcoes): Promise<boolean>;
}

export interface DepsPosAcao {
  rpc: Pick<Rpc, "chamar">;
  /** A tabela do resultado redesenha a coluna "Depois de criar". */
  aoMudar(): void;
  esperar?(ms: number): Promise<void>;
  /** Sem modelo, nao ha o botao de guardar nem acoes pre-escolhidas. */
  modelo?: ModeloPosAcao;
}

export class PainelPosAcao {
  readonly el: HTMLElement;
  /** Os processos em que as acoes podem rodar, na ordem das linhas. */
  readonly alvos: ItemProc[];
  /** Linhas criadas que ficaram de fora: incertas (sem numero confirmado) e com numero mas sem id do processo. */
  readonly deFora: number;
  readonly incertas: number;
  readonly semId: number;
  private readonly estados = new Map<number, Partial<Record<AcaoPos, EstadoPos>>>();
  private opcoes: OpcoesPosAcao | null = null;
  private carregando: Promise<void> | null = null;
  private rodada: Promise<void> | null = null;
  private executor: ExecutorLote<Entrada, null> | null = null;
  /**
   * O que ficou para depois quando a sessao caiu numa inclusao em bloco: os blocos seguintes do mesmo plano (o
   * "Tentar de novo" faz um por bloco) e os processos do marcador/acompanhamento, que o laco nem comecou. Os itens
   * ficam "aguardando" (nao enviados) e o Continuar os envia; uma rodada nova os descarta com aviso.
   */
  private pendentes: Plano | null = null;
  /** A configuracao com que cada acao rodou por ultimo: o "Tentar de novo as falhas" repete com ela. */
  private readonly usada: ConfigPos = {};
  private motivo: string | null = null;
  /** Uma frase do que a ultima tentativa nao fez (nada a enviar, execucao pausada descartada). */
  private nota: string | null = null;
  /**
   * Pares `idBloco|idProcedimento` com inclusao nao confirmada: o POST pode ter entrado. Nunca sai daqui (um
   * Aplicar em outro bloco nao apaga), e nada e reenviado ao mesmo bloco enquanto o painel existir.
   */
  private readonly naoConfirmados = new Map<string, { indice: number; idBloco: string; numeroBloco: string }>();
  private destruido = false;
  private aberto = false;
  /**
   * Acoes do modelo ainda nao conferidas contra uma lista carregada: comeca com todas as do modelo; sai a que foi
   * escolhida ou dada como "nao existe mais". Fica a de lista que nao carregou (reabrir o painel recarrega).
   */
  private readonly naoVerificadas = new Set<AcaoPos>();
  private readonly avisosModelo = new Map<AcaoPos, string>();
  private guardando = false;

  private readonly abrir: HTMLButtonElement;
  private readonly corpo: HTMLElement;
  private readonly avisos: HTMLElement;
  private readonly carregandoEl: HTMLElement;
  private readonly motivoEl: HTMLElement;
  private readonly status: HTMLElement;
  /** "N processos nao confirmados no bloco 12 tambem serao incluidos no 13" (so informa). */
  private readonly avisoBloco: HTMLElement;
  private readonly liga: Record<AcaoPos, HTMLInputElement>;
  private readonly comboBloco: Combo;
  private readonly comboMarcador: Combo;
  private readonly comboGrupo: Combo;
  private readonly textoMarcador: HTMLInputElement;
  private readonly observacao: HTMLTextAreaElement;
  private readonly botaoAplicar: HTMLButtonElement;
  private readonly botaoRepetir: HTMLButtonElement;
  private readonly botaoContinuar: HTMLButtonElement;
  private readonly botaoGuardar: HTMLButtonElement | null;
  /** Um aviso por acao do modelo que nao existe mais (ou cuja lista nao carregou). */
  private readonly avisosModeloEl: HTMLElement;

  constructor(
    itens: readonly ItemProc[],
    private readonly d: DepsPosAcao,
  ) {
    const ordenados = [...itens].sort((a, b) => a.indice - b.indice);
    this.alvos = ordenados.filter(elegivel);
    const fora = ordenados.filter((i) => i.situacao === "ok" && !elegivel(i));
    this.deFora = fora.length;
    this.semId = fora.filter((i) => numeroConfirmado(i) && !i.resultado?.criado.idProcedimento?.trim()).length;
    this.incertas = this.deFora - this.semId;

    const caixa = (acao: AcaoPos) => {
      const c = h("input", { type: "checkbox", class: "pl-pos-liga", "data-acao": acao });
      c.addEventListener("change", () => this.desenhar());
      return c;
    };
    this.liga = { bloco: caixa("bloco"), marcador: caixa("marcador"), acompanhar: caixa("acompanhar") };
    this.comboBloco = criarCombo({
      rotulo: "Bloco interno",
      opcoes: () => (this.opcoes?.blocos ?? []).map((b) => ({ valor: b.id, rotulo: rotuloBloco(b) })),
      vazio: "carregando...",
      busca: true,
      larguraLista: 380,
      aoMudar: (v) => this.ligarAoEscolher("bloco", v),
    });
    this.comboMarcador = criarCombo({
      rotulo: "Marcador",
      opcoes: () => (this.opcoes?.marcadores ?? []).map((m) => ({ valor: m.id, rotulo: m.nome })),
      vazio: "carregando...",
      busca: true,
      larguraLista: 320,
      aoMudar: (v) => this.ligarAoEscolher("marcador", v),
    });
    this.comboGrupo = criarCombo({
      rotulo: "Grupo de acompanhamento",
      opcoes: () => (this.opcoes?.grupos ?? []).map((g) => ({ valor: g.id, rotulo: g.nome })),
      vazio: "carregando...",
      busca: true,
      larguraLista: 320,
      aoMudar: (v) => this.ligarAoEscolher("acompanhar", v),
    });
    this.textoMarcador = h("input", {
      type: "text",
      class: "spro-campo",
      maxlength: String(MAX_TEXTO_MARCADOR),
      "aria-label": "Texto do marcador",
      placeholder: `Texto do marcador (opcional, até ${MAX_TEXTO_MARCADOR} caracteres)`,
    });
    this.observacao = h("textarea", {
      class: "spro-campo pl-pos-observacao",
      rows: "2",
      maxlength: String(MAX_OBSERVACAO),
      "aria-label": "Observação do acompanhamento",
      placeholder: `Observação (opcional, até ${MAX_OBSERVACAO} caracteres)`,
    });

    const botao = (rotulo: string, nome: Parameters<typeof icone>[0], fazer: () => void, classe = "") =>
      h("button", { type: "button", class: `spro-botao pequeno ${classe}`.trim(), onclick: fazer }, icone(nome, 14), rotulo);
    this.botaoAplicar = botao("Aplicar", "check", () => void this.aplicar(), "primario");
    this.botaoRepetir = botao("Tentar de novo as falhas", "atualizar", () => void this.repetirFalhas());
    this.botaoContinuar = botao("Continuar", "atualizar", () => void this.continuar());
    this.botaoGuardar = d.modelo ? botao("Guardar estas ações no modelo", "camadas", () => void this.guardarNoModelo()) : null;
    this.avisosModeloEl = h("div", { class: "pl-pos-avisos-modelo" });
    const pos = d.modelo?.posAcoes;
    if (pos?.bloco) this.naoVerificadas.add("bloco");
    if (pos?.marcador) this.naoVerificadas.add("marcador");
    if (pos?.acompanhar) this.naoVerificadas.add("acompanhar");
    this.avisos = h("div", { class: "pl-pos-avisos" });
    this.carregandoEl = h("p", { class: "pl-nota", hidden: true }, "Carregando as listas do SEI...");
    this.motivoEl = h("p", { class: "pl-motivo", role: "alert", hidden: true });
    this.status = h("p", { class: "pl-nota pl-pos-status", role: "status" });
    this.avisoBloco = h("p", { class: "pl-motivo pl-pos-aviso-bloco", hidden: true });

    const bloco = (acao: AcaoPos, titulo: string, ...campos: HTMLElement[]) =>
      h("fieldset", { class: "pl-pos-bloco" }, h("legend", {}, h("label", { class: "pl-pos-titulo" }, this.liga[acao], titulo)), ...campos);
    const n = this.alvos.length;
    this.corpo = h(
      "div",
      { class: "pl-pos-corpo", hidden: true },
      h(
        "p",
        { class: "pl-nota" },
        `Para ${n === 1 ? "o processo criado" : `os ${n} processos criados`} com número confirmado. Cada ação é opcional e independente das outras.`,
      ),
      this.incertas
        ? h(
            "p",
            { class: "pl-motivo pl-pos-de-fora" },
            icone("alerta", 16),
            `${this.incertas} ${this.incertas === 1 ? "linha ficou de fora" : "linhas ficaram de fora"}: o SEI não confirmou o número do processo (incerta). Confira no Controle de Processos e faça por lá.`,
          )
        : null,
      this.semId
        ? h(
            "p",
            { class: "pl-motivo pl-pos-sem-id" },
            icone("alerta", 16),
            `${this.semId} ${this.semId === 1 ? "linha ficou de fora" : "linhas ficaram de fora"}: o processo foi criado, mas o SEI não informou o identificador interno dele. Faça pelo Controle de Processos.`,
          )
        : null,
      this.carregandoEl,
      this.avisos,
      this.avisosModeloEl,
      bloco("bloco", "Incluir em bloco interno", this.comboBloco.el, this.avisoBloco),
      bloco("marcador", "Aplicar marcador", this.comboMarcador.el, this.textoMarcador),
      bloco("acompanhar", "Acompanhar", this.comboGrupo.el, this.observacao),
      this.motivoEl,
      this.status,
      h(
        "div",
        { class: "pl-acoes" },
        this.botaoAplicar,
        this.botaoRepetir,
        this.botaoContinuar,
        this.botaoGuardar ? h("span", { class: "pl-espaco" }) : null,
        this.botaoGuardar,
      ),
    );
    this.abrir = h(
      "button",
      {
        type: "button",
        class: "pl-pos-abrir",
        "aria-expanded": "false",
        onclick: () => this.alternar(),
      },
      icone("chevron", 14),
      h("strong", {}, "Depois de criar"),
      h("span", { class: "pl-nota" }, "incluir em bloco interno, aplicar marcador, acompanhar"),
    );
    this.el = h("section", { class: "pl-pos-acao", "aria-label": "Depois de criar" }, this.abrir, this.corpo);
    this.desenhar();
    // Modelo com acoes: o painel ja abre (e carrega as listas) para mostra-las escolhidas.
    if (temAcoes(d.modelo?.posAcoes) && this.alvos.length) this.alternar();
  }

  /** Ha algo a mostrar na coluna "Depois de criar". */
  get temResultados(): boolean {
    return this.estados.size > 0 || this.naoConfirmados.size > 0;
  }

  get rodando(): boolean {
    return this.rodada !== null;
  }

  /** O texto da coluna para uma linha (vazio para as que ficaram de fora). */
  depois(i: ItemProc): string {
    const atual = this.estados.get(i.indice);
    const b = atual?.bloco;
    // Um "confira o bloco N" por bloco ainda nao confirmado, mesmo que outro bloco tenha dado certo depois.
    const extras: EstadoPos[] = [];
    for (const x of this.naoConfirmados.values()) {
      if (x.indice !== i.indice) continue;
      if (b?.situacao === "nao-confirmado" && b.idBloco === x.idBloco) continue;
      extras.push({ situacao: "nao-confirmado", idBloco: x.idBloco, numeroBloco: x.numeroBloco });
    }
    return resumoDepois(atual, extras);
  }

  estado(indice: number, acao: AcaoPos): EstadoPos | undefined {
    return this.estados.get(indice)?.[acao];
  }

  /** Fechar o modal (ou sair do resultado): o processo em voo termina, nada novo e enviado. */
  destruir(): void {
    this.destruido = true;
    this.executor?.cancelar();
    this.comboBloco.fechar();
    this.comboMarcador.fechar();
    this.comboGrupo.fechar();
  }

  alternar(): void {
    this.aberto = !this.aberto;
    this.abrir.setAttribute("aria-expanded", String(this.aberto));
    this.corpo.hidden = !this.aberto;
    if (this.aberto) void this.carregar();
  }

  /**
   * As listas, uma vez: so de novo se a chamada inteira falhou (a ponte nao respondeu) ou se uma acao do modelo
   * ficou sem verificar porque a lista dela nao carregou (nunca durante uma rodada).
   */
  carregar(): Promise<void> {
    if (this.opcoes && (!this.naoVerificadas.size || this.rodada)) return Promise.resolve();
    if (this.carregando) return this.carregando;
    const primeiro = this.alvos[0];
    if (!primeiro?.resultado) return Promise.resolve();
    this.carregandoEl.hidden = false;
    this.avisos.replaceChildren();
    this.carregando = (async () => {
      try {
        const r = await this.d.rpc.chamar<OpcoesPosAcao>(
          "posAcaoOpcoes",
          { protocolo: primeiro.resultado!.criado.numero },
          PRAZO_OPCOES_MS,
        );
        if (this.destruido) return;
        const opcoes: OpcoesPosAcao = {
          marcadores: lista<OpcaoSei>(r?.marcadores),
          grupos: lista<OpcaoSei>(r?.grupos),
          blocos: lista<OpcaoBloco>(r?.blocos),
          avisos: lista<string>(r?.avisos).filter((a) => typeof a === "string"),
          falharam: lista<ListaPosAcao>(r?.falharam).filter((x) => x === "marcadores" || x === "grupos" || x === "blocos"),
        };
        // Sessao expirada: as listas vieram pela metade. Nao guarda; fechar e abrir o painel carrega de novo.
        if (r?.parar) this.motivo = MENSAGEM_SESSAO;
        else {
          this.opcoes = opcoes;
          this.aplicarModelo();
        }
        this.avisos.replaceChildren(...opcoes.avisos.map((a) => h("p", { class: "pl-motivo" }, icone("alerta", 16), a)));
      } catch (e) {
        if (this.destruido) return;
        this.avisos.replaceChildren(
          h(
            "p",
            { class: "pl-erro" },
            icone("alerta", 16),
            operacaoDesconhecida(e)
              ? MENSAGEM_RECARREGAR
              : `Não foi possível carregar as listas do SEI: ${mensagem(e)}. Feche e abra este painel para tentar de novo.`,
          ),
        );
      } finally {
        this.carregando = null;
        this.carregandoEl.hidden = true;
        if (!this.destruido) {
          const vazio = (n: number, texto: string) => (n ? texto : "nenhum disponível");
          this.comboBloco.definirVazio(vazio(this.opcoes?.blocos.length ?? 0, "selecione o bloco"));
          this.comboMarcador.definirVazio(vazio(this.opcoes?.marcadores.length ?? 0, "selecione o marcador"));
          this.comboGrupo.definirVazio(vazio(this.opcoes?.grupos.length ?? 0, "sem grupo"));
          this.desenhar();
        }
      }
    })();
    return this.carregando;
  }

  /* ------------------------------------------------------------ execucao */

  /** Roda as acoes ligadas. Dois cliques: a rodada em curso e a mesma. */
  aplicar(): Promise<void> {
    if (this.rodada) return this.rodada;
    const cfg = this.lerConfig();
    if (!cfg) return Promise.resolve();
    const plano: Plano = { blocos: [], processos: [] };
    let jaNoBloco = 0;
    let naoConfirmadosNoBloco = 0;
    if (cfg.bloco) {
      const b = cfg.bloco;
      const itens = this.alvos.filter((i) => {
        // Nao confirmado neste bloco (agora ou antes de um Aplicar em outro): o POST pode ter entrado. Nunca reenviado.
        if (this.naoConfirmados.has(chavePar(b.id, i))) {
          naoConfirmadosNoBloco += 1;
          return false;
        }
        // Ja incluido (ou ja estava) neste bloco: nada a fazer.
        const e = this.estado(i.indice, "bloco");
        if (e?.idBloco === b.id && (e.situacao === "ok" || e.situacao === "ja-estava")) {
          jaNoBloco += 1;
          return false;
        }
        return true;
      });
      if (itens.length) plano.blocos.push({ cfg: b, itens });
      this.usada.bloco = b;
    }
    const acoes: AcaoProcesso[] = [];
    if (cfg.marcador) {
      acoes.push("marcador");
      this.usada.marcador = cfg.marcador;
    }
    if (cfg.acompanhar) {
      acoes.push("acompanhar");
      this.usada.acompanhar = cfg.acompanhar;
    }
    if (acoes.length) plano.processos = this.alvos.map((item) => ({ item, acoes: [...acoes] }));
    if (!plano.blocos.length && !plano.processos.length) {
      const motivos: string[] = [];
      if (!this.alvos.length) motivos.push("nenhum processo criado com número confirmado");
      if (cfg.bloco && jaNoBloco)
        motivos.push(`${jaNoBloco} ${jaNoBloco === 1 ? "processo já está" : "processos já estão"} no bloco ${cfg.bloco.numero}`);
      if (cfg.bloco && naoConfirmadosNoBloco)
        motivos.push(
          `${naoConfirmadosNoBloco} ${naoConfirmadosNoBloco === 1 ? "processo tem" : "processos têm"} inclusão não confirmada no bloco ${cfg.bloco.numero} (confira o bloco)`,
        );
      this.nota = `Nada a enviar: ${motivos.join("; ") || "nenhuma ação a aplicar"}.`;
      this.desenhar();
      return Promise.resolve();
    }
    return this.executar(plano);
  }

  /** So os `erro` de cada acao, com a configuracao com que ela rodou. `nao-confirmado` e `fora-da-pagina` nao. */
  repetirFalhas(): Promise<void> {
    if (this.rodada) return this.rodada;
    const comErro = (acao: AcaoPos) => this.alvos.filter((i) => this.estado(i.indice, acao)?.situacao === "erro");
    const plano: Plano = { blocos: [], processos: [] };
    // Cada erro de bloco volta SO ao bloco a que pertence (o do estado, nunca o ultimo escolhido), um POST por
    // bloco, e nunca um par que ja ficou nao confirmado naquele bloco.
    const porBloco = new Map<string, Plano["blocos"][number]>();
    for (const i of comErro("bloco")) {
      const e = this.estado(i.indice, "bloco");
      if (!e?.idBloco || this.naoConfirmados.has(chavePar(e.idBloco, i))) continue;
      const grupo = porBloco.get(e.idBloco) ?? { cfg: { id: e.idBloco, numero: e.numeroBloco ?? "" }, itens: [] };
      grupo.itens.push(i);
      porBloco.set(e.idBloco, grupo);
    }
    plano.blocos = [...porBloco.values()];
    for (const item of this.alvos) {
      const acoes = (["marcador", "acompanhar"] as const).filter((a) => this.usada[a] && this.estado(item.indice, a)?.situacao === "erro");
      if (acoes.length) plano.processos.push({ item, acoes });
    }
    if (!plano.blocos.length && !plano.processos.length) {
      this.nota = "Nada a repetir: nenhuma falha que possa ser enviada de novo.";
      this.desenhar();
      return Promise.resolve();
    }
    return this.executar(plano);
  }

  /** Depois de uma parada (sessao expirada): o laco continua de onde parou; nada ja feito e reenviado. */
  continuar(): Promise<void> {
    if (this.rodada) return this.rodada;
    const e = this.executor;
    if (e?.estado === "pausado") {
      this.motivo = null;
      this.nota = null;
      return this.acompanhar(e.continuar());
    }
    const p = this.pendentes;
    if (p) {
      this.pendentes = null;
      return this.executar(p, true);
    }
    return Promise.resolve();
  }

  /** `retomada`: o plano e o que ficou pendente (Continuar), entao os "aguardando" dele nao sao "nao enviados". */
  private executar(plano: Plano, retomada = false): Promise<void> {
    this.motivo = null;
    this.nota = null;
    // Uma rodada nova substitui a pausada: o que ela nao chegou a enviar sai da fila (nao e resultado), e o
    // usuario fica sabendo.
    const naoEnviados = [...this.estados.values()].filter((e) => Object.values(e).some((x) => x?.situacao === "aguardando")).length;
    if (naoEnviados && !retomada)
      this.nota = `${naoEnviados} ${naoEnviados === 1 ? "processo da execução pausada não foi enviado" : "processos da execução pausada não foram enviados"}.`;
    this.pendentes = null;
    this.executor?.cancelar();
    this.executor = null;
    for (const [indice, e] of this.estados) {
      for (const a of Object.keys(e) as AcaoPos[]) if (e[a]?.situacao === "aguardando") delete e[a];
      if (!Object.keys(e).length) this.estados.delete(indice);
    }
    for (const b of plano.blocos) for (const i of b.itens) this.definir(i, "bloco", { situacao: "aguardando" });
    for (const p of plano.processos) for (const a of p.acoes) this.definir(p.item, a, { situacao: "aguardando" });
    return this.acompanhar(this.correr(plano));
  }

  private acompanhar(p: Promise<void>): Promise<void> {
    const r = p
      .catch((e) => console.warn("[SEI Pro] processos em lote: falha nas ações depois de criar", e))
      .finally(() => {
        if (this.rodada === r) this.rodada = null;
        this.mudou();
      });
    this.rodada = r;
    this.mudou();
    return r;
  }

  private async correr(plano: Plano): Promise<void> {
    for (const [k, b] of plano.blocos.entries()) {
      const parou = await this.rodarBloco(b.cfg, b.itens);
      if (this.destruido) return;
      if (parou) {
        this.motivo = MENSAGEM_SESSAO;
        // Os blocos seguintes (ainda "aguardando") e os processos ficam para o Continuar, nunca presos.
        const resto: Plano = { blocos: plano.blocos.slice(k + 1), processos: plano.processos };
        if (resto.blocos.length || resto.processos.length) this.pendentes = resto;
        return;
      }
    }
    if (!plano.processos.length || this.destruido) return;
    const itens: ItemLote<Entrada, null>[] = plano.processos.map((entrada, indice) => ({
      indice,
      entrada,
      situacao: "pendente",
      tentativas: 0,
    }));
    this.executor = new ExecutorLote<Entrada, null>(itens, {
      concorrencia: 1,
      pausaMs: () => PAUSA_POS_ACAO_MS,
      processar: (e) => this.processar(e),
      aoMudar: () => this.mudou(),
      esperar: this.d.esperar,
    });
    await this.executor.iniciar();
  }

  /** Uma chamada so, com todos os ids. Devolve se a sessao caiu. */
  private async rodarBloco(cfg: NonNullable<ConfigPos["bloco"]>, itens: ItemProc[]): Promise<boolean> {
    const porId = new Map(itens.map((i) => [i.resultado!.criado.idProcedimento.trim(), i]));
    const base = { idBloco: cfg.id, numeroBloco: cfg.numero };
    let r: ResultadoPosAcaoBloco;
    try {
      r = await this.d.rpc.chamar<ResultadoPosAcaoBloco>(
        "posAcaoBloco",
        { idBloco: cfg.id, idsProcedimento: [...porId.keys()] },
        PRAZO_POS_ACAO_BLOCO_MS,
      );
    } catch (e) {
      // Aba com o content script antigo: recusou antes de qualquer POST. Erro certo, repetivel depois do F5.
      if (operacaoDesconhecida(e)) {
        for (const i of itens) this.definir(i, "bloco", { situacao: "erro", mensagem: MENSAGEM_RECARREGAR, ...base });
        return false;
      }
      // A ponte nao respondeu: o POST pode ter saido. Nao confirmado, nunca erro (que seria repetivel).
      for (const i of itens) this.definir(i, "bloco", { situacao: "nao-confirmado", mensagem: mensagem(e), ...base });
      return false;
    }
    const vistos = new Set<string>();
    for (const x of lista<ResultadoPosAcaoBloco["resultados"][number]>(r?.resultados)) {
      const item = porId.get(String(x?.idProcedimento ?? "").trim());
      if (!item) continue;
      vistos.add(item.resultado!.criado.idProcedimento.trim());
      const situacao: SituacaoPos =
        x.situacao === "incluido"
          ? "ok"
          : x.situacao === "ja-estava" || x.situacao === "erro" || x.situacao === "fora-da-pagina"
            ? x.situacao
            : "nao-confirmado";
      const e: EstadoPos = { situacao, ...base };
      if (x.mensagem) e.mensagem = x.mensagem;
      this.definir(item, "bloco", e);
    }
    // Id que a aba nao devolveu: nao se sabe o que houve com ele no POST.
    for (const [id, item] of porId) {
      if (!vistos.has(id))
        this.definir(item, "bloco", { situacao: "nao-confirmado", mensagem: "A aba não informou o resultado.", ...base });
    }
    return r?.parar === true;
  }

  private async processar(e: Entrada): Promise<SaidaItem<null>> {
    let parar = false;
    for (const acao of e.acoes) {
      if (this.destruido) break;
      if (parar) {
        // A sessao caiu na acao anterior deste processo: esta nem saiu (erro, repetivel).
        this.definir(e.item, acao, { situacao: "erro", mensagem: NAO_ENVIADO_SESSAO });
        continue;
      }
      const r = await this.chamarPosAcao(acao, e.item);
      if (this.destruido) break;
      this.definir(e.item, acao, r.mensagem ? { situacao: r.situacao, mensagem: r.mensagem } : { situacao: r.situacao });
      if (r.parar) parar = true;
    }
    if (parar) this.motivo = MENSAGEM_SESSAO;
    return { situacao: "ok", parar };
  }

  private async chamarPosAcao(acao: AcaoProcesso, item: ItemProc): Promise<ResultadoPosAcao> {
    const criado = item.resultado!.criado;
    const args: Record<string, string> = { acao, protocolo: criado.numero, idProcedimento: criado.idProcedimento.trim() };
    if (acao === "marcador") {
      const m = this.usada.marcador!;
      // O nome: e por ele que o nucleo reconhece o marcador que o processo ja tem ("ja estava").
      args.marcador = m.nome;
      if (m.texto) args.texto = m.texto;
    } else {
      const a = this.usada.acompanhar!;
      if (a.grupo) args.grupo = a.grupo;
      if (a.observacao) args.observacao = a.observacao;
    }
    try {
      const r = await this.d.rpc.chamar<ResultadoPosAcao>("posAcao", args, PRAZO_POS_ACAO_MS);
      const situacao = r?.situacao === "ok" || r?.situacao === "ja-estava" ? r.situacao : "erro";
      const msg = typeof r?.mensagem === "string" ? r.mensagem : "";
      const saida: ResultadoPosAcao = { situacao, mensagem: situacao === "erro" && !msg ? "Resposta inesperada da aba do SEI." : msg };
      if (r?.parar === true) saida.parar = true;
      return saida;
    } catch (e) {
      // Idempotente no nucleo: a ponte que caiu vira erro, e repetir nao duplica.
      return { situacao: "erro", mensagem: operacaoDesconhecida(e) ? MENSAGEM_RECARREGAR : mensagem(e) };
    }
  }

  private definir(item: ItemProc, acao: AcaoPos, e: EstadoPos): void {
    const atual = this.estados.get(item.indice) ?? {};
    atual[acao] = e;
    this.estados.set(item.indice, atual);
    if (acao === "bloco" && e.situacao === "nao-confirmado" && e.idBloco) {
      this.naoConfirmados.set(chavePar(e.idBloco, item), { indice: item.indice, idBloco: e.idBloco, numeroBloco: e.numeroBloco ?? "" });
    }
  }

  /* ------------------------------------------------------------ modelo */

  /**
   * Poe as acoes do modelo no painel, com as listas ja carregadas: escolhe e liga cada uma que existe; a que nao
   * existe mais fica desligada com aviso (nunca aplicada em silencio). Nada e enviado ao SEI aqui.
   *
   * Lista que NAO carregou (falha, nao unidade sem itens) nao prova que o item sumiu: a acao fica desligada com
   * outro aviso e continua "nao verificada" (reabrir o painel recarrega as listas e tenta de novo), e o Guardar
   * conserva no modelo o que estava la para ela.
   */
  private aplicarModelo(): void {
    const pos = this.d.modelo?.posAcoes;
    const o = this.opcoes;
    if (!pos || !o) return;
    const falhou = new Set(o.falharam);
    const verificar = (
      acao: AcaoPos,
      lista: ListaPosAcao,
      oQue: string,
      nome: string,
      existe: () => boolean,
      escolher: () => void,
    ): void => {
      if (!this.naoVerificadas.has(acao)) return;
      if (falhou.has(lista)) {
        this.liga[acao].checked = false;
        this.avisosModelo.set(acao, `A lista não carregou; a ação do modelo não foi verificada. ${oQue} "${nome}" ficou desligado.`);
        return;
      }
      this.naoVerificadas.delete(acao);
      if (existe()) {
        escolher();
        this.liga[acao].checked = true;
        this.avisosModelo.delete(acao);
      } else {
        this.liga[acao].checked = false;
        this.avisosModelo.set(acao, `${oQue} "${nome}" do modelo não existe mais nesta unidade; a ação ficou desligada.`);
      }
    };
    if (pos.bloco) {
      const id = pos.bloco.id;
      verificar(
        "bloco",
        "blocos",
        "O bloco interno",
        pos.bloco.descricao || id,
        () => o.blocos.some((x) => x.id === id),
        () => this.comboBloco.definir([id]),
      );
    }
    if (pos.marcador) {
      const { id, texto } = pos.marcador;
      if (this.naoVerificadas.has("marcador")) this.textoMarcador.value = texto.slice(0, MAX_TEXTO_MARCADOR);
      verificar(
        "marcador",
        "marcadores",
        "O marcador",
        pos.marcador.nome || id,
        () => o.marcadores.some((x) => x.id === id),
        () => this.comboMarcador.definir([id]),
      );
    }
    if (pos.acompanhar) {
      const { grupo, observacao } = pos.acompanhar;
      if (this.naoVerificadas.has("acompanhar")) this.observacao.value = observacao.slice(0, MAX_OBSERVACAO);
      if (!grupo) {
        // Sem grupo e uma escolha valida (acompanhar sem grupo): nao depende de lista nenhuma.
        if (this.naoVerificadas.delete("acompanhar")) {
          this.comboGrupo.definir([]);
          this.liga.acompanhar.checked = true;
        }
      } else {
        verificar(
          "acompanhar",
          "grupos",
          "O grupo de acompanhamento",
          pos.acompanhar.nomeGrupo || grupo,
          () => o.grupos.some((x) => x.id === grupo),
          () => this.comboGrupo.definir([grupo]),
        );
      }
    }
    this.comboBloco.atualizar();
    this.comboMarcador.atualizar();
    this.comboGrupo.atualizar();
    this.avisosModeloEl.replaceChildren(
      ...(["bloco", "marcador", "acompanhar"] as const)
        .map((a) => this.avisosModelo.get(a))
        .filter((a): a is string => !!a)
        .map((a) => h("p", { class: "pl-motivo pl-pos-aviso-modelo" }, icone("alerta", 16), a)),
    );
  }

  /** As acoes ligadas como o modelo as guarda; null se alguma ligada esta incompleta (ou as listas nao vieram). */
  private lerPosAcoes(): PosAcoes | null {
    if (!this.opcoes) return null;
    const p: PosAcoes = {};
    if (this.liga.marcador.checked) {
      const m = this.opcoes.marcadores.find((x) => x.id === this.comboMarcador.valor()[0]);
      if (!m) return null;
      p.marcador = { id: m.id, nome: m.nome, texto: this.textoMarcador.value.trim().slice(0, MAX_TEXTO_MARCADOR) };
    }
    if (this.liga.acompanhar.checked) {
      const grupo = this.comboGrupo.valor()[0] ?? "";
      const nomeGrupo = grupo ? (this.opcoes.grupos.find((x) => x.id === grupo)?.nome ?? "") : "";
      p.acompanhar = { grupo, nomeGrupo, observacao: this.observacao.value.trim().slice(0, MAX_OBSERVACAO) };
    }
    if (this.liga.bloco.checked) {
      const b = this.opcoes.blocos.find((x) => x.id === this.comboBloco.valor()[0]);
      if (!b) return null;
      p.bloco = { id: b.id, descricao: b.descricao };
    }
    return p;
  }

  /**
   * Grava no modelo as acoes como estao no painel. A acao do modelo que nao pode ser verificada (lista que nao
   * carregou) e conservada como estava: nao se apaga o que nao se conferiu. So grava; nada vai ao SEI.
   */
  private async guardarNoModelo(): Promise<void> {
    const modelo = this.d.modelo;
    const lidas = this.lerPosAcoes();
    if (!modelo || !lidas || this.guardando) return;
    const guardadas = modelo.posAcoes ?? {};
    const conserva = (a: AcaoPos) => this.naoVerificadas.has(a) && !this.liga[a].checked;
    const marcador = conserva("marcador") ? guardadas.marcador : lidas.marcador;
    const acompanhar = conserva("acompanhar") ? guardadas.acompanhar : lidas.acompanhar;
    const bloco = conserva("bloco") ? guardadas.bloco : lidas.bloco;
    const p: PosAcoes = {};
    if (marcador) p.marcador = marcador;
    if (acompanhar) p.acompanhar = acompanhar;
    if (bloco) p.bloco = bloco;
    this.guardando = true;
    this.desenhar();
    let nota: string;
    try {
      const ok = await modelo.guardar(p);
      nota = !ok
        ? `O modelo "${modelo.nome}" não existe mais (talvez apagado em outra aba); nada foi guardado.`
        : temAcoes(p)
          ? `Ações guardadas no modelo "${modelo.nome}".`
          : `O modelo "${modelo.nome}" ficou sem ações depois de criar.`;
    } catch (e) {
      nota = `Não foi possível guardar as ações no modelo: ${mensagem(e)}`;
    } finally {
      this.guardando = false;
    }
    if (this.destruido) return;
    this.nota = nota;
    this.desenhar();
  }

  /* ------------------------------------------------------------ tela */

  /** Escolher numa lista liga a acao (o usuario ja disse o que quer). */
  private ligarAoEscolher(acao: AcaoPos, v: string[]): void {
    if (v.length) this.liga[acao].checked = true;
    this.desenhar();
  }

  /** A configuracao das acoes ligadas; null se nenhuma ou se alguma ligada esta incompleta. */
  private lerConfig(): ConfigPos | null {
    const cfg: ConfigPos = {};
    if (this.liga.bloco.checked) {
      const id = this.comboBloco.valor()[0];
      const b = this.opcoes?.blocos.find((x) => x.id === id);
      if (!b) return null;
      cfg.bloco = { id: b.id, numero: b.numero };
    }
    if (this.liga.marcador.checked) {
      const id = this.comboMarcador.valor()[0];
      const m = this.opcoes?.marcadores.find((x) => x.id === id);
      if (!m) return null;
      cfg.marcador = { nome: m.nome, texto: this.textoMarcador.value.trim().slice(0, MAX_TEXTO_MARCADOR) };
    }
    if (this.liga.acompanhar.checked) {
      // Grupo e opcional: sem ele, o processo e acompanhado sem grupo.
      cfg.acompanhar = { grupo: this.comboGrupo.valor()[0] ?? "", observacao: this.observacao.value.trim().slice(0, MAX_OBSERVACAO) };
    }
    return cfg.bloco || cfg.marcador || cfg.acompanhar ? cfg : null;
  }

  private mudou(): void {
    if (this.destruido) return;
    this.desenhar();
    try {
      this.d.aoMudar();
    } catch (e) {
      console.warn("[SEI Pro] processos em lote: falha ao redesenhar o resultado", e);
    }
  }

  private desenhar(): void {
    const rodando = this.rodada !== null;
    const pronto = !!this.opcoes && !this.carregando;
    this.botaoAplicar.disabled = rodando || !pronto || !this.lerConfig();
    if (this.botaoGuardar) this.botaoGuardar.disabled = this.guardando || !pronto || !this.lerPosAcoes();
    const erros = this.contar("erro");
    this.botaoRepetir.hidden = rodando || erros === 0;
    this.botaoContinuar.hidden = rodando || !(this.executor?.estado === "pausado" || this.pendentes !== null);
    this.motivoEl.hidden = !this.motivo;
    this.motivoEl.replaceChildren(...(this.motivo ? [icone("alerta", 16), this.motivo] : []));
    const status = rodando ? this.textoAndamento() : this.textoFinal();
    this.status.textContent = [this.nota, status].filter(Boolean).join(" ");
    const aviso = this.textoAvisoBloco();
    this.avisoBloco.hidden = !aviso;
    this.avisoBloco.textContent = aviso;
  }

  /** Bloco escolhido diferente de um bloco com inclusao nao confirmada: os mesmos processos entram no novo. */
  private textoAvisoBloco(): string {
    if (!this.liga.bloco.checked) return "";
    const id = this.comboBloco.valor()[0];
    const escolhido = this.opcoes?.blocos.find((b) => b.id === id);
    if (!escolhido) return "";
    const porBloco = new Map<string, { numero: string; n: number }>();
    for (const x of this.naoConfirmados.values()) {
      if (x.idBloco === escolhido.id) continue;
      const atual = porBloco.get(x.idBloco) ?? { numero: x.numeroBloco || x.idBloco, n: 0 };
      atual.n += 1;
      porBloco.set(x.idBloco, atual);
    }
    return [...porBloco.values()]
      .map(
        ({ numero, n }) =>
          `${n} ${n === 1 ? "processo não confirmado" : "processos não confirmados"} no bloco ${numero} também ${n === 1 ? "será incluído" : "serão incluídos"} no ${escolhido.numero}.`,
      )
      .join(" ");
  }

  private contar(s: SituacaoPos): number {
    let n = 0;
    for (const e of this.estados.values()) for (const x of Object.values(e)) if (x?.situacao === s) n += 1;
    return n;
  }

  private textoAndamento(): string {
    const total = this.contar("aguardando");
    return total ? `Aplicando... ${total} ${total === 1 ? "ação na fila" : "ações na fila"}.` : "Aplicando...";
  }

  private textoFinal(): string {
    if (!this.estados.size && !this.naoConfirmados.size) return "";
    const partes = [
      [this.contar("ok"), "feita", "feitas"],
      [this.contar("ja-estava"), "já estava", "já estavam"],
      [this.contar("erro"), "com erro", "com erro"],
      [this.naoConfirmados.size, "não confirmada (confira o bloco)", "não confirmadas (confira o bloco)"],
      [this.contar("fora-da-pagina"), "fora da página do Controle", "fora da página do Controle"],
      [this.contar("aguardando"), "não enviada", "não enviadas"],
    ] as const;
    const texto = partes
      .filter(([n]) => n > 0)
      .map(([n, um, varios]) => `${n} ${n === 1 ? um : varios}`)
      .join(", ");
    return texto ? `Ações: ${texto}.` : "";
  }
}

function numeroConfirmado(i: ItemProc): boolean {
  const n = i.resultado?.criado.numero;
  return !i.resultado?.incerto && !!n && n !== NUMERO_INCERTO && n !== NUMERO_NAO_IDENTIFICADO;
}

const temAcoes = (p: PosAcoes | undefined): boolean => !!p && !!(p.marcador || p.acompanhar || p.bloco);

const chavePar = (idBloco: string, i: ItemProc): string => `${idBloco}|${i.resultado?.criado.idProcedimento.trim() ?? ""}`;

function rotuloBloco(b: OpcaoBloco): string {
  return b.descricao ? `${b.numero} — ${b.descricao}` : b.numero;
}

/** Lista vinda da aba: o que nao for array vira vazio. */
function lista<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
