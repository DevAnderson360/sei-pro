/**
 * Etapa 3, Cruzamento e destino: liga cada `##campo##` do modelo a uma coluna da planilha, diz de onde vem o nome
 * na árvore e a descrição, e escolhe ONDE os documentos serão criados:
 *   1. no processo da tela;
 *   2. em um processo novo por linha (tipo do processo + especificação, que aceita `##coluna##`);
 *   3. no processo indicado em uma coluna da planilha (cada linha traz o número do seu processo).
 * Também aceita colunas opcionais de nível de acesso e hipótese legal, e a pausa entre documentos.
 *
 * A tela guarda o que o usuário preencheu em `estado.cruzamento` (sobrevive ao Voltar) e só grava `estado.config`
 * quando está completa; incompleta, apaga a config. Se o modelo ou as colunas mudaram desde o último preenchimento
 * (comparação por referência: cada leitura cria objetos novos), o rascunho e a config velhos são descartados.
 *
 * A etapa seguinte depende do destino (verificação dos processos para o destino coluna, prévia para os demais):
 * `rotuloAvancar()` troca o texto do botão do rodapé.
 */

import { normalizarTexto } from "@comum/texto";
import { type Combo, criarCombo, type OpcaoCombo } from "@comum/ui/combobox";
import { h, icone } from "@comum/ui/dom";
import type { TipoProcesso } from "@pl/sei/tipos";
import {
  CUSTO_DOCUMENTO_MS,
  CUSTO_PROCESSO_MS,
  MAX_DESCRICAO,
  MAX_ESPECIFICACAO,
  PAUSA_MAXIMA,
  PAUSA_MINIMA,
  PAUSA_PADRAO,
} from "../modelo/constantes";
import type { Destino } from "../modelo/destinos";
import { estimarDuracao, limitarPausa } from "../modelo/estimativa";
import type { ConfigLote } from "../modelo/lote";
import { conferirVerificacao, type DepsEtapa, limparVerificacao, mensagemDe, type RascunhoCruzamento, type TelaEtapa } from "./estado";

export const ROTULO_COLUNA_NOME = "Coluna do nome na árvore";
export const ROTULO_TIPO_PROCESSO = "Tipo do processo";
export const ROTULO_COLUNA_PROCESSO = "Coluna do processo";
export const ROTULO_COLUNA_NIVEL = "Coluna do nível de acesso";
export const ROTULO_COLUNA_HIPOTESE = "Coluna da hipótese legal";
export const rotuloCampo = (campo: string): string => `Coluna do campo ##${campo}##`;

/** Valor da opção "nenhuma coluna" dos seletores opcionais. */
const NENHUMA = "__nenhuma__";
/** Prazo do `tiposProcesso` pela ponte: a aba lê a tela de escolha do tipo. */
const PRAZO_MS = 60_000;

type Destinos = RascunhoCruzamento["destino"];
type RespostaTipos = { situacao: "ok"; tipos: TipoProcesso[] } | { situacao: "erro"; erro: string; sessao?: true };

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";

export class TelaCruzamento implements TelaEtapa {
  readonly el: HTMLElement;
  private readonly rascunho: RascunhoCruzamento;
  private readonly colunas: string[];
  private readonly campos: string[];
  private readonly combosCampos: Combo[] = [];
  private readonly comboNome: Combo;
  private readonly comboTipo: Combo;
  private readonly comboProcesso: Combo;
  private readonly comboNivel: Combo;
  private readonly comboHipotese: Combo;
  private readonly descricao: HTMLInputElement;
  private readonly contador: HTMLElement;
  private readonly especificacao: HTMLInputElement;
  private readonly pausa: HTMLInputElement;
  private readonly estimativa: HTMLElement;
  private readonly radios: Record<Destinos, HTMLInputElement>;
  private readonly blocoNovo: HTMLElement;
  private readonly blocoColuna: HTMLElement;
  private readonly carregando: HTMLElement;
  private readonly erro: HTMLElement;
  private readonly tentar: HTMLButtonElement;
  private seq = 0;
  private pedindo = false;
  private destruida = false;

  constructor(private readonly d: DepsEtapa) {
    const e = d.estado;
    const modelo = e.modelo;
    this.colunas = e.colunas ?? [];
    this.campos = modelo?.campos ?? [];

    // Rascunho velho (de outro modelo ou outra planilha) não vale: recomeça, sem config.
    const base = e.baseCruzamento;
    if (!e.cruzamento || !modelo || base?.modelo !== modelo || base.colunas !== e.colunas) {
      e.cruzamento = this.rascunhoNovo();
      e.config = undefined;
      limparVerificacao(e);
      if (modelo && e.colunas) e.baseCruzamento = { modelo, colunas: e.colunas };
    }
    const r = e.cruzamento;
    this.rascunho = r;

    const opcoesColunas = (): OpcaoCombo[] => this.colunas.map((c) => ({ valor: c, rotulo: c }));
    const opcoesOpcionais = (): OpcaoCombo[] => [{ valor: NENHUMA, rotulo: "— nenhuma —" }, ...opcoesColunas()];
    const seletor = (
      rotulo: string,
      valor: string | undefined,
      opcoes: () => OpcaoCombo[],
      vazio: string,
      aoMudar: (v: string | undefined) => void,
    ): Combo =>
      criarCombo({
        rotulo,
        opcoes,
        valor: valor ? [valor] : [],
        vazio,
        busca: true,
        larguraLista: 380,
        aoMudar: (vs) => {
          const v = vs[0];
          aoMudar(v && v !== NENHUMA ? v : undefined);
          this.sincronizar();
        },
      });

    this.comboNome = seletor(ROTULO_COLUNA_NOME, r.colunaNome, opcoesColunas, "selecione a coluna", (v) => {
      r.colunaNome = v;
    });
    this.combosCampos = this.campos.map((campo) =>
      seletor(rotuloCampo(campo), r.cruzados[campo], opcoesOpcionais, "nenhuma coluna", (v) => {
        if (v) r.cruzados[campo] = v;
        else delete r.cruzados[campo];
      }),
    );
    this.comboTipo = seletor(
      ROTULO_TIPO_PROCESSO,
      r.idTipo,
      () => (this.d.estado.tiposProcesso ?? []).map((t) => ({ valor: t.id, rotulo: t.nome })),
      e.tiposProcesso ? "selecione o tipo do processo" : "carregando os tipos...",
      (v) => {
        r.idTipo = v;
      },
    );
    this.comboProcesso = seletor(ROTULO_COLUNA_PROCESSO, r.colunaProcesso, opcoesColunas, "selecione a coluna do processo", (v) => {
      r.colunaProcesso = v;
    });
    this.comboNivel = seletor(ROTULO_COLUNA_NIVEL, r.colunaNivel, opcoesOpcionais, "nenhuma (tudo público)", (v) => {
      r.colunaNivel = v;
    });
    this.comboHipotese = seletor(ROTULO_COLUNA_HIPOTESE, r.colunaHipotese, opcoesOpcionais, "nenhuma", (v) => {
      r.colunaHipotese = v;
    });

    this.descricao = h("input", {
      type: "text",
      class: "spro-campo",
      id: "dl-descricao",
      name: "dl-descricao",
      autocomplete: "off",
      placeholder: "Ex.: Contrato ##nome##",
    });
    this.descricao.value = r.descricao;
    this.contador = h("small", { class: "dl-contador" });
    this.descricao.addEventListener("input", () => {
      r.descricao = this.descricao.value;
      this.sincronizar();
    });

    this.especificacao = h("input", {
      type: "text",
      class: "spro-campo",
      id: "dl-especificacao",
      name: "dl-especificacao",
      autocomplete: "off",
      placeholder: "Ex.: Contrato ##nome##",
    });
    this.especificacao.value = r.especificacao;
    this.especificacao.addEventListener("input", () => {
      r.especificacao = this.especificacao.value;
      this.sincronizar();
    });

    this.pausa = h("input", {
      type: "number",
      class: "spro-campo",
      id: "dl-pausa",
      min: String(PAUSA_MINIMA),
      max: String(PAUSA_MAXIMA),
      step: "100",
    });
    this.pausa.value = r.pausa;
    this.pausa.addEventListener("input", () => {
      r.pausa = this.pausa.value;
      this.sincronizar();
    });
    this.pausa.addEventListener("change", () => {
      // Fora do intervalo vira o limite; vazio ou ilegível, o padrão.
      r.pausa = String(limitarPausa(this.pausa.value));
      this.pausa.value = r.pausa;
      this.sincronizar();
    });
    this.estimativa = h("small", { class: "dl-estimativa dl-dica", "aria-live": "polite" });

    const radio = (valor: Destinos): HTMLInputElement => {
      const el = h("input", { type: "radio", name: "dl-destino", value: valor });
      el.checked = r.destino === valor;
      el.addEventListener("change", () => {
        if (!el.checked) return;
        r.destino = valor;
        this.aoTrocarDestino();
      });
      return el;
    };
    this.radios = { tela: radio("tela"), "novo-processo": radio("novo-processo"), coluna: radio("coluna") };

    this.carregando = h("small", { class: "dl-carregando", "aria-live": "polite", hidden: true });
    this.erro = h("p", { class: "dl-erro", role: "alert", hidden: true });
    this.tentar = h(
      "button",
      { type: "button", class: "spro-botao", hidden: true, onclick: () => void this.carregarTipos() },
      icone("atualizar", 15),
      "Tentar de novo",
    );

    this.blocoNovo = h(
      "div",
      { class: "dl-subcampos" },
      h("div", { class: "dl-campo" }, h("span", { class: "dl-rotulo" }, ROTULO_TIPO_PROCESSO), this.comboTipo.el, this.carregando),
      h(
        "div",
        { class: "dl-campo" },
        h("label", { class: "dl-rotulo", for: "dl-especificacao" }, `Especificação do processo (até ${MAX_ESPECIFICACAO} caracteres)`),
        this.especificacao,
        h("small", { class: "dl-dica" }, "Pode usar ##coluna## para trazer o valor de cada linha. Opcional."),
      ),
      this.erro,
      h("div", { class: "dl-acoes" }, this.tentar),
    );
    this.blocoColuna = h(
      "div",
      { class: "dl-subcampos" },
      h("div", { class: "dl-campo" }, h("span", { class: "dl-rotulo" }, ROTULO_COLUNA_PROCESSO), this.comboProcesso.el),
      h(
        "small",
        { class: "dl-dica" },
        "Cada linha traz o número do processo onde o documento será criado. Os processos são conferidos antes (próxima etapa).",
      ),
    );

    const opcaoDestino = (valor: Destinos, titulo: string, dica: string, bloco?: HTMLElement) =>
      h(
        "div",
        { class: "dl-opcao-destino" },
        h(
          "label",
          { class: "dl-radio" },
          this.radios[valor],
          h("span", {}, h("strong", {}, titulo), h("small", { class: "dl-dica" }, dica)),
        ),
        bloco,
      );

    this.el = h(
      "section",
      { class: "dl-etapa-cruzamento", "aria-label": "Cruzamento e destino" },
      h("h2", {}, "Cruze o modelo com a planilha"),
      h(
        "div",
        { class: "dl-campo" },
        h("h3", {}, "Campos do modelo"),
        this.campos.length
          ? h(
              "div",
              { class: "dl-campos-lado" },
              ...this.campos.map((campo, i) =>
                h("div", { class: "dl-campo" }, h("span", { class: "dl-rotulo" }, h("code", {}, `##${campo}##`)), this.combosCampos[i]!.el),
              ),
            )
          : h("p", { class: "dl-nota" }, "O modelo não tem campos ##campo##: todos os documentos sairão com o mesmo texto."),
        h(
          "small",
          { class: "dl-dica" },
          "Campo sem coluna fica como está no texto (##campo##) e é apontado na revisão. Já vêm escolhidas as colunas de mesmo nome.",
        ),
      ),
      h(
        "div",
        { class: "dl-campos-lado" },
        h(
          "div",
          { class: "dl-campo" },
          h("span", { class: "dl-rotulo" }, ROTULO_COLUNA_NOME),
          this.comboNome.el,
          h("small", { class: "dl-dica" }, "Obrigatório. O nome tem no máximo 50 caracteres, sem acento."),
        ),
        h(
          "div",
          { class: "dl-campo" },
          h("label", { class: "dl-rotulo", for: "dl-descricao" }, "Descrição do documento"),
          this.descricao,
          this.contador,
        ),
      ),
      h(
        "div",
        { class: "dl-campo", role: "radiogroup", "aria-label": "Destino dos documentos" },
        h("h3", {}, "Onde criar os documentos"),
        opcaoDestino("tela", "No processo aberto na tela", "Todos os documentos vão para o processo desta janela."),
        opcaoDestino(
          "novo-processo",
          "Em um processo novo por linha",
          "Cria um processo para cada linha e o documento dentro dele.",
          this.blocoNovo,
        ),
        opcaoDestino("coluna", "No processo indicado em uma coluna", "Cada linha diz em que processo o documento entra.", this.blocoColuna),
      ),
      h(
        "div",
        { class: "dl-campo" },
        h("h3", {}, "Nível de acesso (opcional)"),
        h(
          "div",
          { class: "dl-campos-lado" },
          h("div", { class: "dl-campo" }, h("span", { class: "dl-rotulo" }, ROTULO_COLUNA_NIVEL), this.comboNivel.el),
          h("div", { class: "dl-campo" }, h("span", { class: "dl-rotulo" }, ROTULO_COLUNA_HIPOTESE), this.comboHipotese.el),
        ),
        h("small", { class: "dl-dica" }, "Sem coluna de nível, os documentos saem públicos. Nível restrito exige a hipótese legal."),
      ),
      h(
        "div",
        { class: "dl-campo" },
        h("label", { class: "dl-rotulo", for: "dl-pausa" }, "Pausa entre um documento e outro (ms)"),
        this.pausa,
        h("small", { class: "dl-dica" }, `Quanto maior a pausa, menor o impacto no servidor. De ${PAUSA_MINIMA} a ${PAUSA_MAXIMA} ms.`),
        this.estimativa,
      ),
    );
    this.aplicarVisibilidade();
    this.sincronizar();
  }

  async iniciar(): Promise<void> {
    if (this.rascunho.destino === "novo-processo") await this.carregarTipos();
  }

  destruir(): void {
    this.destruida = true;
    this.seq++;
    for (const c of [this.comboNome, ...this.combosCampos, this.comboTipo, this.comboProcesso, this.comboNivel, this.comboHipotese])
      c.fechar();
  }

  completa(): boolean {
    return this.montarConfig() !== null;
  }

  rotuloAvancar(): string {
    return this.rascunho.destino === "coluna" ? "Verificar processos" : "Revisar";
  }

  /* ------------------------------------------------------------ rascunho e config */

  private rascunhoNovo(): RascunhoCruzamento {
    const colunas = this.d.estado.colunas ?? [];
    const cruzados: Record<string, string> = {};
    // Pré-seleciona a coluna de nome IGUAL ao do campo.
    for (const campo of this.campos) if (colunas.includes(campo)) cruzados[campo] = campo;
    return { cruzados, descricao: "", destino: "tela", especificacao: "", pausa: String(PAUSA_PADRAO) };
  }

  /** A config pronta, ou null se algo obrigatório falta (e o que existe é válido para as colunas atuais). */
  private montarConfig(): ConfigLote | null {
    const e = this.d.estado;
    const r = this.rascunho;
    const modelo = e.modelo;
    const existe = (c: string | undefined): c is string => !!c && this.colunas.includes(c);
    if (!modelo || !existe(r.colunaNome)) return null;
    let destino: Destino;
    if (r.destino === "tela") destino = { tipo: "tela" };
    else if (r.destino === "novo-processo") {
      if (!r.idTipo) return null;
      destino = { tipo: "novo-processo", idTipoProcesso: r.idTipo, especificacao: r.especificacao.slice(0, MAX_ESPECIFICACAO) };
    } else {
      if (!existe(r.colunaProcesso)) return null;
      destino = { tipo: "coluna", coluna: r.colunaProcesso };
    }
    const camposCruzados: Record<string, string> = {};
    for (const campo of this.campos) {
      const c = r.cruzados[campo];
      if (existe(c)) camposCruzados[campo] = c;
    }
    const config: ConfigLote = {
      camposCruzados,
      colunaNome: r.colunaNome,
      modeloDescricao: r.descricao.slice(0, MAX_DESCRICAO),
      destino,
      pausa: limitarPausa(r.pausa),
      modelo,
    };
    if (existe(r.colunaNivel)) config.colunaNivel = r.colunaNivel;
    if (existe(r.colunaHipotese)) config.colunaHipotese = r.colunaHipotese;
    return config;
  }

  /** Refaz a config a partir do rascunho (ou a apaga), atualiza contador e estimativa e avisa o app. */
  private sincronizar(): void {
    if (this.destruida) return;
    this.d.estado.config = this.montarConfig() ?? undefined;
    // Outro destino, outra coluna do processo, nome, nível, hipótese: a verificação feita não vale mais.
    conferirVerificacao(this.d.estado);
    const tam = this.rascunho.descricao.length;
    this.contador.textContent =
      tam > MAX_DESCRICAO
        ? `${tam} de ${MAX_DESCRICAO} caracteres: o que passar de ${MAX_DESCRICAO} será cortado.`
        : `${tam} de ${MAX_DESCRICAO} caracteres. Aceita ##coluna##.`;
    const linhas = this.d.estado.registros?.length ?? 0;
    const custo = CUSTO_DOCUMENTO_MS + (this.rascunho.destino === "novo-processo" ? CUSTO_PROCESSO_MS : 0);
    this.estimativa.textContent = linhas
      ? `${linhas} ${linhas === 1 ? "linha" : "linhas"}: duração estimada ${estimarDuracao(linhas, limitarPausa(this.rascunho.pausa), custo)}.`
      : "";
    this.d.aoMudar();
  }

  /* ------------------------------------------------------------ destino */

  private aplicarVisibilidade(): void {
    this.blocoNovo.hidden = this.rascunho.destino !== "novo-processo";
    this.blocoColuna.hidden = this.rascunho.destino !== "coluna";
  }

  private aoTrocarDestino(): void {
    const r = this.rascunho;
    this.aplicarVisibilidade();
    if (r.destino === "coluna" && !r.colunaProcesso) {
      // Sugere a primeira coluna cujo nome contém "processo".
      const sugerida = this.colunas.find((c) => normalizarTexto(c).includes("processo"));
      if (sugerida) {
        r.colunaProcesso = sugerida;
        this.comboProcesso.definir([sugerida], false);
      }
    }
    if (r.destino === "novo-processo") void this.carregarTipos();
    this.sincronizar();
  }

  /** Pede os tipos de processo à aba, uma vez (ficam no estado). */
  private async carregarTipos(): Promise<void> {
    const e = this.d.estado;
    if (e.tiposProcesso || this.pedindo) return;
    this.pedindo = true;
    const s = ++this.seq;
    this.tentar.hidden = true;
    this.mostrarErro(null);
    this.carregando.hidden = false;
    this.carregando.textContent = "Carregando os tipos de processo...";
    let r: RespostaTipos;
    try {
      r = await this.d.rpc.chamar<RespostaTipos>("tiposProcesso", undefined, PRAZO_MS);
    } catch (err) {
      r = { situacao: "erro", erro: mensagemDe(err) };
    }
    this.pedindo = false;
    if (this.destruida || s !== this.seq) return;
    this.carregando.hidden = true;
    if (ehObjeto(r) && r.situacao === "ok" && Array.isArray(r.tipos) && r.tipos.length) {
      e.tiposProcesso = r.tipos;
      this.comboTipo.definirVazio("selecione o tipo do processo");
      this.comboTipo.atualizar();
      return;
    }
    const motivo = ehObjeto(r) && r.situacao === "erro" ? String(r.erro ?? "") : "nenhum tipo de processo disponível.";
    this.comboTipo.definirVazio("tipos indisponíveis");
    this.mostrarErro(`Não foi possível carregar os tipos de processo: ${motivo.trim() || "a aba do SEI não respondeu."}`);
    this.tentar.hidden = false;
  }

  private mostrarErro(texto: string | null): void {
    this.erro.hidden = !texto;
    this.erro.replaceChildren(...(texto ? [icone("alerta", 16), h("span", {}, texto)] : []));
  }
}
