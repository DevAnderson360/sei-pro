/**
 * Tela de configuracao (1/3 do legado): aviso de cautela, tipo de processo, nivel de acesso e hipotese legal,
 * caixa de linhas (ou colunas de planilha), quantidade e pausa. Os erros aparecem no proprio formulario.
 *
 * Restrito exige hipotese ESCOLHIDA de uma lista CARREGADA: o lote restrito (ou com linha restrita pela coluna de
 * nivel) nao passa para a previa sem isso. A lista vazia e indistinguivel de "falhou ao buscar" (Task 12), entao
 * vazia tambem bloqueia, dizendo que nao carregou.
 *
 * Modelos salvos (linha "Modelo", acima do tipo): aplicar um modelo escolhe tipo, nivel, hipotese e pausa, nunca as
 * linhas. As acoes depois de criar do modelo nao aparecem aqui: o app leva o modelo escolhido ao painel do resultado
 * (que as mostra e as guarda); salvar de novo com o mesmo nome as mantem. Tipo ou hipotese que nao existe mais na lista carregada NAO e aplicado em silencio: o campo fica como
 * estava e o aviso aparece no proprio formulario.
 */

import type { Rpc } from "@comum/ponte/rpc";
import { normalizarTexto } from "@comum/texto";
import { type Combo, criarCombo } from "@comum/ui/combobox";
import type { AbrirModal } from "@comum/ui/dialogo";
import { h, icone } from "@comum/ui/dom";
import { TETO } from "../modelo/constantes";
import { limitarPausa } from "../modelo/estimativa";
import { type LinhaLote, lerLinhas } from "../modelo/linhas";
import { ErroModelo, LIMITE_NOME_MODELO, type ModeloLote, type RepositorioModelos } from "../modelos";
import type { Parametros } from "../repositorio";
import type { HipoteseLegal } from "../sei/hipoteses";
import type { TipoProcesso } from "../sei/tipos";
import type { PedidoPrevia } from "./previa";

/** Os campos como o usuario os deixou: Voltar da previa devolve exatamente isto. */
export interface ValoresConfig {
  idTipo: string;
  nivelAcesso: "0" | "1";
  hipoteseLegal: string;
  texto: string;
  quantidade: string;
  pausa: string;
  /** O modelo escolhido no seletor (so para o Voltar mostrar o mesmo; nao e reaplicado). */
  idModelo?: string;
}

/** O que o `formTipo` da aba devolve. */
export interface InfoFormTipo {
  idTipo: string;
  hipoteses: HipoteseLegal[];
  temAssuntos: boolean;
}

/** Guardado pelo app entre as telas: Voltar nao busca de novo a lista de tipos nem o formulario. */
export interface CacheConfig {
  tipos: TipoProcesso[] | null;
  forms: Map<string, InfoFormTipo>;
}

/** Texto do seletor de tipo sem escolha, conforme a lista: carregando, carregada ou indisponivel. */
export const VAZIO_TIPO = {
  carregando: "carregando tipos de processo...",
  carregado: "selecione o tipo de processo",
  falhou: "tipos indisponíveis",
} as const;

export const ERROS = {
  semTipo: "Selecione um tipo de processo e aguarde o carregamento do formulário.",
  semLinhas: "Informe as especificações (uma por linha) ou uma quantidade.",
  teto: `O limite por rodada é de ${TETO} processos. Divida a demanda em blocos menores.`,
  semHipotese: "Processos restritos exigem a escolha de uma hipótese legal.",
  hipotesesNaoCarregadas:
    "Não foi possível carregar as hipóteses legais deste tipo de processo, e processos restritos não podem ser criados sem uma. Use nível público, escolha outro tipo ou recarregue a página do SEI e tente de novo.",
  tipoDoModelo: "O tipo deste modelo não existe mais nesta unidade.",
  hipoteseDoModelo: "A hipótese legal deste modelo não existe mais nesta unidade.",
} as const;

export const ROTULO_MODELO = "Modelo do lote";

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));

/** As linhas do lote: as da caixa ou, com a caixa vazia, a quantidade (travada antes de alocar, como o legado). */
export function linhasDaEntrada(
  texto: string,
  quantidade: string,
): { linhas: LinhaLote[]; colunas: string[]; modoQuantidade: boolean; acimaDoTeto: boolean } {
  const lidas = lerLinhas(texto);
  if (lidas.linhas.length) return { ...lidas, modoQuantidade: false, acimaDoTeto: lidas.linhas.length > TETO };
  const bruta = Number.parseInt(quantidade, 10);
  const q = bruta > 0 ? Math.min(bruta, TETO + 1) : 0;
  return {
    linhas: Array.from({ length: Math.min(q, TETO) }, () => ({ especificacao: "" })),
    colunas: ["especificacao"],
    modoQuantidade: q > 0,
    acimaDoTeto: q > TETO,
  };
}

/**
 * Confirmacao sem Cancelar (regra dos modais do SEI Pro: o X e o Esc ja fecham). So o botao da acao: o clique
 * resolve `true`; fechar por X/Esc resolve `false`. A marca evita que o fechamento disparado pelo proprio clique
 * resolva `false` (o `aoFechar` roda nos dois casos).
 */
export function criarConfirmarSemCancelar(abrirModal: AbrirModal): (texto: string, rotuloOk?: string) => Promise<boolean> {
  return (texto, rotuloOk = "Confirmar") =>
    new Promise<boolean>((ok) => {
      let confirmado = false;
      let modal: { fechar(): void } | null = null;
      const botao = h(
        "button",
        {
          type: "button",
          class: "spro-botao perigo",
          onclick: () => {
            confirmado = true;
            modal?.fechar();
          },
        },
        rotuloOk,
      );
      modal = abrirModal({
        titulo: "Confirmar",
        icone: "alerta",
        conteudo: h("div", {}, h("p", {}, texto), h("div", { class: "spro-dialogo-rodape" }, botao)),
        aoFechar: () => ok(confirmado),
      });
    });
}

export interface DepsModelos {
  repo: RepositorioModelos;
  /** O nome do modelo e pedido num dialogo do app (sem Cancelar: o X e o Esc fecham). */
  abrirModal: AbrirModal;
  confirmar(texto: string, rotuloOk?: string): Promise<boolean>;
}

export interface DepsConfiguracao {
  rpc: Pick<Rpc, "chamar">;
  cache: CacheConfig;
  verPrevia(p: PedidoPrevia, valores: ValoresConfig): void;
  /** Sem isto a linha "Modelo" nao aparece. */
  modelos?: DepsModelos;
}

export class TelaConfiguracao {
  readonly el: HTMLElement;
  private readonly tipo: Combo;
  private readonly hipotese: Combo;
  private readonly linhaHipotese: HTMLElement;
  private readonly caixa: HTMLTextAreaElement;
  private readonly contador: HTMLElement;
  private readonly quantidade: HTMLInputElement;
  private readonly pausa: HTMLInputElement;
  private readonly erro: HTMLElement;
  private readonly carregando: HTMLElement;
  private readonly botaoPrevia: HTMLButtonElement;
  private readonly radios: HTMLInputElement[];
  private readonly modelo: Combo;
  private readonly botaoRenomear: HTMLButtonElement;
  private readonly botaoApagar: HTMLButtonElement;
  private modelos: ModeloLote[] = [];
  /** Cada aplicacao de modelo abre uma geracao: a hipotese de um modelo anterior nao chega depois. */
  private seqModelo = 0;
  private tipos: TipoProcesso[] = [];
  /** O formulario carregado para o tipo escolhido agora (null enquanto carrega ou se falhou). */
  private form: InfoFormTipo | null = null;
  /** Cada troca de tipo abre uma geracao: resposta atrasada de um tipo anterior nao vale. */
  private seq = 0;
  private destruida = false;

  constructor(
    private readonly d: DepsConfiguracao,
    v: Partial<ValoresConfig> = {},
  ) {
    this.tipo = criarCombo({
      rotulo: "Tipo de processo",
      opcoes: () => this.tipos.map((t) => ({ valor: t.id, rotulo: t.nome })),
      valor: v.idTipo ? [v.idTipo] : [],
      vazio: VAZIO_TIPO.carregando,
      busca: true,
      larguraLista: 420,
      aoMudar: (vs) => void this.selecionarTipo(vs[0] ?? ""),
    });
    this.hipotese = criarCombo({
      rotulo: "Hipótese legal",
      opcoes: () => (this.form?.hipoteses ?? []).map((x) => ({ valor: x.id, rotulo: x.nome })),
      valor: v.hipoteseLegal ? [v.hipoteseLegal] : [],
      vazio: "selecione a hipótese legal",
      busca: true,
      larguraLista: 420,
      aoMudar: () => this.limparErro(),
    });
    this.modelo = criarCombo({
      rotulo: ROTULO_MODELO,
      opcoes: () => this.modelos.map((m) => ({ valor: m.id, rotulo: m.nome })),
      valor: v.idModelo ? [v.idModelo] : [],
      vazio: "sem modelo",
      busca: true,
      larguraLista: 320,
      aoMudar: (vs) => {
        this.atualizarBotoesModelo();
        const m = this.modelos.find((x) => x.id === vs[0]);
        if (m) void this.aplicarModelo(m);
      },
    });
    this.botaoRenomear = h(
      "button",
      { type: "button", class: "spro-botao", hidden: true, onclick: () => this.renomearModelo() },
      icone("lapis", 15),
      "Renomear",
    );
    this.botaoApagar = h(
      "button",
      { type: "button", class: "spro-botao perigo", hidden: true, onclick: () => void this.apagarModelo() },
      icone("lixeira", 15),
      "Apagar",
    );
    const linhaModelo = d.modelos
      ? h(
          "div",
          { class: "pl-campo pl-modelo" },
          h("span", { class: "pl-rotulo" }, "Modelo"),
          h(
            "div",
            { class: "pl-modelo-linha" },
            this.modelo.el,
            h(
              "button",
              {
                type: "button",
                class: "spro-botao",
                title:
                  "Guarda o tipo, o nível, a hipótese e a pausa (não as linhas). As ações depois de criar são guardadas no modelo pelo painel do resultado.",
                onclick: () => this.salvarModelo(),
              },
              icone("camadas", 15),
              "Salvar como modelo…",
            ),
            this.botaoRenomear,
            this.botaoApagar,
          ),
        )
      : null;
    const radio = (valor: "0" | "1", rotulo: string) => {
      const r = h("input", { type: "radio", name: "pl-nivel", value: valor });
      r.checked = (v.nivelAcesso ?? "0") === valor;
      r.addEventListener("change", () => this.atualizar());
      return { r, el: h("label", { class: "pl-radio" }, r, rotulo) };
    };
    const pub = radio("0", "Público");
    const res = radio("1", "Restrito");
    this.radios = [pub.r, res.r];
    this.linhaHipotese = h(
      "div",
      { class: "pl-campo", hidden: true },
      h("span", { class: "pl-rotulo" }, "Hipótese legal"),
      this.hipotese.el,
    );
    this.caixa = h("textarea", {
      class: "spro-campo pl-linhas",
      id: "pl-linhas",
      rows: "7",
      spellcheck: "false",
      placeholder:
        "Uma especificação por linha (cole direto de uma coluna da planilha). Com colunas separadas por tabulação: especificação, interessado, observação e nível (a coluna interessado é lida, mas ainda não é aplicada ao processo). Deixe em branco para abrir processos sem especificação e informar apenas a quantidade abaixo.",
      "aria-keyshortcuts": "Control+Enter",
      "aria-describedby": "pl-contador",
    });
    this.caixa.value = v.texto ?? "";
    this.caixa.addEventListener("input", () => this.atualizar());
    this.contador = h("small", { class: "pl-contador", id: "pl-contador", "aria-live": "polite" });
    this.quantidade = h("input", { type: "number", class: "spro-campo", id: "pl-quantidade", min: "1", max: String(TETO) });
    this.quantidade.value = v.quantidade ?? "";
    this.quantidade.addEventListener("input", () => this.atualizar());
    this.pausa = h("input", { type: "number", class: "spro-campo", id: "pl-pausa", min: "200", max: "10000", step: "100" });
    this.pausa.value = v.pausa ?? "500";
    this.erro = h("p", { class: "pl-erro", role: "alert", hidden: true });
    this.carregando = h("small", { class: "pl-carregando", "aria-live": "polite" });
    this.botaoPrevia = h(
      "button",
      { type: "button", class: "spro-botao primario", title: "Ver prévia (Ctrl+Enter)", disabled: true, onclick: () => this.verPrevia() },
      icone("olho", 15),
      "Ver prévia",
    );
    this.el = h(
      "section",
      { class: "pl-configuracao", "aria-label": "Configuração" },
      // Titulo com classe propria e UM paragrafo de texto corrido com o negrito inline: um seletor de "strong" no
      // aviso pegava tambem o negrito do meio da frase e o quebrava em linha separada.
      h(
        "div",
        { class: "pl-cautela-forte" },
        h("div", { class: "pl-cautela-titulo" }, icone("alerta", 16), "Use com cautela."),
        h(
          "p",
          {},
          "A abertura de processos em lote gera uma sequência longa de requisições ao servidor. Em alguns órgãos isso deixa o SEI lento ",
          h("strong", {}, "para todos os usuários"),
          ", não só para você. Prefira executar ",
          h("strong", {}, "fora do horário comercial"),
          ", em blocos menores, e aumente a pausa entre processos se notar lentidão. Na dúvida, alinhe antes com a área de TI do seu órgão.",
        ),
      ),
      linhaModelo,
      h("div", { class: "pl-campo" }, h("span", { class: "pl-rotulo" }, "Tipo de processo a ser aberto"), this.tipo.el, this.carregando),
      h(
        "div",
        { class: "pl-campo" },
        h("span", { class: "pl-rotulo" }, "Nível de acesso dos processos"),
        h("div", { class: "pl-radios", role: "radiogroup", "aria-label": "Nível de acesso" }, pub.el, res.el),
      ),
      this.linhaHipotese,
      h(
        "div",
        { class: "pl-campo" },
        h("label", { class: "pl-rotulo", for: "pl-linhas" }, "Especificações, uma por linha"),
        this.caixa,
        this.contador,
      ),
      h(
        "div",
        { class: "pl-campos-lado" },
        h(
          "div",
          { class: "pl-campo" },
          h("label", { class: "pl-rotulo", for: "pl-quantidade" }, "Quantidade (usada apenas quando a caixa acima estiver vazia)"),
          this.quantidade,
        ),
        h(
          "div",
          { class: "pl-campo" },
          h("label", { class: "pl-rotulo", for: "pl-pausa" }, "Pausa entre um processo e outro (ms)"),
          this.pausa,
          h("small", { class: "pl-dica" }, "Quanto maior a pausa, menor o impacto no servidor. Mínimo de 200 ms."),
        ),
      ),
      this.erro,
      h("div", { class: "pl-acoes" }, h("span", { class: "pl-espaco" }), this.botaoPrevia),
    );
    this.atualizar();
  }

  /** Carrega os tipos (ou usa os do cache) e, se ja havia tipo escolhido (Voltar), o formulario dele. */
  async iniciar(): Promise<void> {
    try {
      if (!this.d.cache.tipos) {
        this.carregando.textContent = "Carregando os tipos de processo...";
        const tipos = await this.d.rpc.chamar<TipoProcesso[]>("tipos", undefined, 60_000);
        if (!Array.isArray(tipos) || tipos.length === 0) throw new Error("não foi possível carregar os tipos de processo");
        this.d.cache.tipos = tipos;
      }
      if (this.destruida) return;
      this.tipos = this.d.cache.tipos;
      this.carregando.textContent = "";
      this.tipo.definirVazio(VAZIO_TIPO.carregado);
      this.tipo.atualizar();
      // Os modelos so depois dos tipos: aplicar um confere o tipo na lista carregada.
      await this.carregarModelos();
      if (this.destruida) return;
      const atual = this.tipo.valor()[0];
      if (atual) await this.selecionarTipo(atual);
      else this.tipo.el.focus?.({ preventScroll: true });
    } catch (e) {
      if (this.destruida) return;
      this.carregando.textContent = "";
      this.tipo.definirVazio(VAZIO_TIPO.falhou);
      this.mostrarErro(`Não foi possível carregar os tipos de processo: ${mensagem(e)}`);
    }
  }

  destruir(): void {
    this.destruida = true;
    this.tipo.fechar();
    this.hipotese.fechar();
    this.modelo.fechar();
  }

  valores(): ValoresConfig {
    return {
      idTipo: this.tipo.valor()[0] ?? "",
      nivelAcesso: this.nivel(),
      hipoteseLegal: this.hipotese.valor()[0] ?? "",
      texto: this.caixa.value,
      quantidade: this.quantidade.value,
      pausa: this.pausa.value,
      idModelo: this.modelo.valor()[0] ?? "",
    };
  }

  private nivel(): "0" | "1" {
    return this.radios[1]?.checked ? "1" : "0";
  }

  private async selecionarTipo(idTipo: string): Promise<void> {
    const seq = ++this.seq;
    this.form = null;
    this.limparErro();
    this.atualizar();
    if (!idTipo) return;
    const guardado = this.d.cache.forms.get(idTipo);
    if (guardado) {
      this.form = guardado;
    } else {
      this.carregando.textContent = "Carregando o formulário do tipo e as hipóteses legais...";
      try {
        const f = await this.d.rpc.chamar<InfoFormTipo>("formTipo", { idTipo }, 60_000);
        if (seq !== this.seq || this.destruida) return;
        const info: InfoFormTipo = {
          idTipo: String(f?.idTipo ?? idTipo),
          hipoteses: Array.isArray(f?.hipoteses) ? f.hipoteses.filter((x) => x && typeof x.id === "string" && x.id && x.id !== "null") : [],
          temAssuntos: f?.temAssuntos === true,
        };
        this.d.cache.forms.set(idTipo, info);
        this.form = info;
      } catch (e) {
        if (seq !== this.seq || this.destruida) return;
        this.carregando.textContent = "";
        this.mostrarErro(`Não foi possível carregar o formulário deste tipo de processo: ${mensagem(e)}`);
        this.atualizar();
        return;
      }
    }
    this.carregando.textContent = "";
    // A hipotese escolhida antes (Voltar) so vale se existe na lista deste tipo.
    const h0 = this.hipotese.valor()[0];
    if (h0 && !this.form.hipoteses.some((x) => x.id === h0)) this.hipotese.definir([]);
    this.hipotese.atualizar();
    this.atualizar();
  }

  /** Contador, quantidade travada, linha da hipotese e o botao da previa. */
  private atualizar(): void {
    const e = linhasDaEntrada(this.caixa.value, this.quantidade.value);
    const n = e.modoQuantidade ? 0 : e.linhas.length;
    this.quantidade.disabled = n > 0;
    const qtd = Number.parseInt(this.quantidade.value, 10);
    if (n > 0) {
      const colunas = e.colunas.length > 1 ? ` Colunas: ${e.colunas.join(", ")}.` : "";
      this.contador.textContent = `${n} ${n === 1 ? "linha preenchida — será aberto 1 processo." : `linhas preenchidas — serão abertos ${n} processos.`}${colunas}`;
    } else if (qtd > 0) {
      this.contador.textContent = `Caixa vazia — serão abertos ${qtd} ${qtd === 1 ? "processo" : "processos"} sem especificação.`;
    } else {
      this.contador.textContent = "Nenhuma linha preenchida.";
    }
    const restritoPorLinha = !e.modoQuantidade && e.linhas.some((l) => l.nivelAcesso === "1");
    this.linhaHipotese.hidden = !(this.nivel() === "1" || restritoPorLinha);
    const idTipo = this.tipo.valor()[0];
    this.botaoPrevia.disabled = !idTipo || !this.form || this.form.idTipo !== idTipo;
  }

  /** Valida e passa para a previa; o erro fica no formulario. */
  verPrevia(): void {
    this.limparErro();
    const v = this.valores();
    const pausa = limitarPausa(v.pausa);
    this.pausa.value = String(pausa);
    v.pausa = String(pausa);
    if (!v.idTipo || !this.form || this.form.idTipo !== v.idTipo) {
      this.mostrarErro(ERROS.semTipo);
      return;
    }
    const e = linhasDaEntrada(v.texto, v.quantidade);
    if (e.acimaDoTeto) {
      this.mostrarErro(ERROS.teto);
      return;
    }
    if (!e.linhas.length) {
      this.mostrarErro(ERROS.semLinhas);
      return;
    }
    const restrito = v.nivelAcesso === "1" || (!e.modoQuantidade && e.linhas.some((l) => l.nivelAcesso === "1"));
    const hipotese = this.form.hipoteses.find((x) => x.id === v.hipoteseLegal);
    if (restrito) {
      if (this.form.hipoteses.length === 0) {
        this.mostrarErro(ERROS.hipotesesNaoCarregadas);
        return;
      }
      if (!hipotese) {
        this.mostrarErro(ERROS.semHipotese);
        return;
      }
    }
    const nomeTipo = this.tipos.find((t) => t.id === v.idTipo)?.nome ?? v.idTipo;
    this.d.verPrevia(
      {
        parametros: {
          idTipo: v.idTipo,
          nomeTipo,
          nivelAcesso: v.nivelAcesso,
          // So vai hipotese quando alguma linha e restrita (a aba exige; publico nao leva).
          hipoteseLegal: restrito && hipotese ? hipotese.id : "",
          nomeHipotese: restrito && hipotese ? hipotese.nome : "",
          pausa,
        },
        linhas: e.linhas,
        colunas: e.colunas,
        modoQuantidade: e.modoQuantidade,
      },
      v,
    );
  }

  /* ------------------------------------------------------------ modelos */

  private modeloEscolhido(): ModeloLote | undefined {
    const id = this.modelo.valor()[0];
    return id ? this.modelos.find((m) => m.id === id) : undefined;
  }

  private atualizarBotoesModelo(): void {
    const tem = !!this.modeloEscolhido();
    this.botaoRenomear.hidden = !tem;
    this.botaoApagar.hidden = !tem;
  }

  /** Relista; o escolhido que sumiu (apagado em outra aba) volta a "sem modelo". Falha nao derruba a tela. */
  private async carregarModelos(): Promise<void> {
    const repo = this.d.modelos?.repo;
    if (!repo) return;
    try {
      this.modelos = await repo.listar();
    } catch (e) {
      console.warn("[SEI Pro] processos em lote: falha ao ler os modelos", e);
      this.modelos = [];
    }
    if (this.destruida) return;
    if (!this.modeloEscolhido()) this.modelo.definir([]);
    this.modelo.atualizar();
    this.atualizarBotoesModelo();
  }

  /**
   * Nivel e pausa sempre; tipo so se existe na lista carregada (e entao o formulario dele, pelo mesmo caminho da
   * escolha manual); hipotese so se existe no formulario desse tipo. O que nao existe fica como estava, com aviso.
   */
  private async aplicarModelo(m: ModeloLote): Promise<void> {
    const vez = ++this.seqModelo;
    const p = m.parametros;
    this.limparErro();
    // Tipo que nao existe mais: nada do modelo e aplicado (nem nivel nem pausa), so o aviso.
    if (!this.tipos.some((t) => t.id === p.idTipo)) {
      this.mostrarErro(ERROS.tipoDoModelo);
      return;
    }
    for (const r of this.radios) r.checked = r.value === p.nivelAcesso;
    this.pausa.value = String(limitarPausa(p.pausa));
    this.tipo.definir([p.idTipo]);
    await this.selecionarTipo(p.idTipo);
    if (vez !== this.seqModelo || this.destruida) return;
    // Formulario que falhou (o erro ja esta na tela) ou outro tipo escolhido no meio: a hipotese nao vale.
    if (!this.form || this.form.idTipo !== p.idTipo || this.tipo.valor()[0] !== p.idTipo) return;
    if (p.hipoteseLegal) {
      if (this.form.hipoteses.some((x) => x.id === p.hipoteseLegal)) {
        this.hipotese.definir([p.hipoteseLegal]);
        this.hipotese.atualizar();
      } else {
        // Lista vazia e "nao carregou" (Task 12), nao "a hipotese sumiu": o aviso e o de sempre.
        this.mostrarErro(this.form.hipoteses.length ? ERROS.hipoteseDoModelo : ERROS.hipotesesNaoCarregadas);
      }
    }
    this.atualizar();
  }

  /** Os parametros como estao no formulario; null sem tipo com formulario carregado. */
  private parametrosAtuais(): Parametros | null {
    const idTipo = this.tipo.valor()[0];
    if (!idTipo || !this.form || this.form.idTipo !== idTipo) return null;
    const hipotese = this.form.hipoteses.find((x) => x.id === this.hipotese.valor()[0]);
    return {
      idTipo,
      nomeTipo: this.tipos.find((t) => t.id === idTipo)?.nome ?? idTipo,
      nivelAcesso: this.nivel(),
      hipoteseLegal: hipotese?.id ?? "",
      nomeHipotese: hipotese?.nome ?? "",
      pausa: limitarPausa(this.pausa.value),
    };
  }

  private salvarModelo(): void {
    const dm = this.d.modelos;
    if (!dm) return;
    this.limparErro();
    const parametros = this.parametrosAtuais();
    if (!parametros) {
      this.mostrarErro(ERROS.semTipo);
      return;
    }
    this.pedirNome(dm.abrirModal, {
      titulo: "Salvar como modelo",
      rotuloBotao: "Salvar modelo",
      sugestao: this.modeloEscolhido()?.nome ?? "",
      // Mesmo nome substitui (o repositorio decide): o dialogo avisa antes.
      aviso: (nome) =>
        this.modelos.some((m) => normalizarTexto(m.nome) === normalizarTexto(nome))
          ? "Já existe um modelo com este nome; ele será substituído."
          : "",
      gravar: async (nome) => {
        // Mesmo nome substitui so os parametros: as acoes depois de criar ja guardadas no modelo ficam.
        const existente = this.modelos.find((x) => normalizarTexto(x.nome) === normalizarTexto(nome));
        const m = await dm.repo.salvar(nome, parametros, existente?.posAcoes);
        await this.carregarModelos();
        if (this.destruida) return;
        this.modelo.definir([m.id]);
        this.atualizarBotoesModelo();
      },
    });
  }

  private renomearModelo(): void {
    const dm = this.d.modelos;
    const atual = this.modeloEscolhido();
    if (!dm || !atual) return;
    this.pedirNome(dm.abrirModal, {
      titulo: "Renomear modelo",
      rotuloBotao: "Renomear modelo",
      sugestao: atual.nome,
      aviso: () => "",
      gravar: async (nome) => {
        const r = await dm.repo.renomear(atual.id, nome);
        await this.carregarModelos();
        if (!r) throw new ErroModelo("Este modelo não existe mais (talvez apagado em outra aba).");
      },
    });
  }

  private async apagarModelo(): Promise<void> {
    const dm = this.d.modelos;
    const atual = this.modeloEscolhido();
    if (!dm || !atual) return;
    const sim = await dm.confirmar(`Apagar o modelo "${atual.nome}"? Os campos do formulário não mudam.`, "Apagar");
    if (!sim || this.destruida) return;
    this.limparErro();
    try {
      await dm.repo.apagar(atual.id);
    } catch (e) {
      // Falhou: a escolha fica (o modelo continua gravado).
      if (!this.destruida) this.mostrarErro(`Não foi possível apagar o modelo: ${mensagem(e)}`);
      return;
    }
    if (this.destruida) return;
    this.modelo.definir([]);
    await this.carregarModelos();
  }

  /** Dialogo do nome: so a acao principal (o X e o Esc fecham); o erro fica no proprio dialogo. */
  private pedirNome(
    abrirModal: AbrirModal,
    c: { titulo: string; rotuloBotao: string; sugestao: string; aviso(nome: string): string; gravar(nome: string): Promise<void> },
  ): void {
    const erro = h("p", { class: "pl-erro", role: "alert", hidden: true });
    const aviso = h("small", { class: "pl-dica", "aria-live": "polite" });
    const campo = h("input", {
      type: "text",
      class: "spro-campo",
      id: "pl-modelo-nome",
      maxlength: String(LIMITE_NOME_MODELO),
      autocomplete: "off",
      value: c.sugestao,
    });
    const mostrarAviso = () => {
      aviso.textContent = c.aviso(campo.value.trim());
    };
    campo.addEventListener("input", mostrarAviso);
    let modal: { fechar(): void } | null = null;
    let ocupado = false;
    const gravar = async () => {
      if (ocupado) return;
      erro.hidden = true;
      const nome = campo.value.trim();
      if (!nome) {
        erro.hidden = false;
        erro.replaceChildren(icone("alerta", 15), "Informe o nome do modelo.");
        return;
      }
      ocupado = true;
      botao.disabled = true;
      try {
        await c.gravar(nome);
        modal?.fechar();
      } catch (e) {
        erro.hidden = false;
        const texto = e instanceof ErroModelo ? e.message : `Não foi possível gravar o modelo neste navegador: ${mensagem(e)}`;
        erro.replaceChildren(icone("alerta", 15), texto);
      } finally {
        ocupado = false;
        botao.disabled = false;
      }
    };
    const botao = h("button", { type: "button", class: "spro-botao primario", onclick: () => void gravar() }, c.rotuloBotao);
    campo.addEventListener("keydown", (ev) => {
      // Enter que fecha uma composicao (IME, acentos mortos) nao grava.
      if (ev.key === "Enter" && !ev.isComposing) {
        ev.preventDefault();
        void gravar();
      }
    });
    mostrarAviso();
    modal = abrirModal({
      titulo: c.titulo,
      icone: "camadas",
      conteudo: h(
        "div",
        { class: "pl-modelo-dialogo" },
        h("div", { class: "pl-campo" }, h("label", { class: "pl-rotulo", for: "pl-modelo-nome" }, "Nome do modelo"), campo, aviso),
        erro,
        h("div", { class: "spro-dialogo-rodape" }, botao),
      ),
    });
    campo.focus?.({ preventScroll: true });
  }

  private mostrarErro(texto: string): void {
    this.erro.hidden = false;
    this.erro.replaceChildren(icone("alerta", 15), texto);
  }

  private limparErro(): void {
    this.erro.hidden = true;
    this.erro.replaceChildren();
  }
}
