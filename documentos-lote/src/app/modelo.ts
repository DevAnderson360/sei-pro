/**
 * Etapa 1, Modelo: um documento gerado da árvore do processo ou um Texto Padrão da unidade (RPC `listarModelos`).
 * Escolhido o modelo, a aba o lê (`lerModelo`, só leitura) e a tela mostra o tipo e os `##campos##` encontrados.
 *
 * Texto Padrão não tem tipo de documento: o usuário escolhe um da lista da unidade antes de ler (como o legado).
 * Modelo sem campos só avisa (todos os documentos sairão com o mesmo texto), não bloqueia.
 *
 * Cada escolha abre uma geração (`seq`): a resposta atrasada de uma escolha anterior não vale.
 */

import { type Combo, criarCombo, type OpcaoCombo } from "@comum/ui/combobox";
import { h, icone } from "@comum/ui/dom";
import type { EscolhaModelo, Modelo, ModelosDisponiveis } from "../sei/modelo";
import { type DepsEtapa, limparVerificacao, mensagemDe, type TelaEtapa } from "./estado";

export const ROTULO_MODELO = "Modelo";
export const ROTULO_TIPO = "Tipo do documento";

/** Prazo do `listarModelos` e do `lerModelo` pela ponte: a aba lê a árvore e páginas do SEI. */
const PRAZO_MS = 60_000;

const PREFIXO_DOC = "doc:";
const PREFIXO_TP = "tp:";

type RespostaListar =
  | { situacao: "ok"; protocolo: string; modelos: ModelosDisponiveis }
  | { situacao: "erro"; erro: string; sessao?: true };
type RespostaLer = { situacao: "ok"; modelo: Modelo } | { situacao: "erro"; erro: string; sessao?: true };

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object";

/** Mensagem de falha ao ler: a da aba, com a saída sugerida quando ela não traz uma. */
export function mensagemFalhaModelo(erro: string, sessao?: boolean): string {
  const texto = erro.trim() || "A aba do SEI não respondeu.";
  if (sessao) return `${texto} Entre de novo no SEI e abra esta janela outra vez.`;
  return /escolha outro/i.test(texto) ? texto : `${texto} Escolha outro modelo ou tente de novo.`;
}

export class TelaModelo implements TelaEtapa {
  readonly el: HTMLElement;
  private readonly modelo: Combo;
  private readonly tipo: Combo;
  private readonly linhaTipo: HTMLElement;
  private readonly carregando: HTMLElement;
  private readonly erro: HTMLElement;
  private readonly tentar: HTMLButtonElement;
  private readonly info: HTMLElement;
  private seq = 0;
  private destruida = false;

  constructor(private readonly d: DepsEtapa) {
    const e = d.estado;
    this.modelo = criarCombo({
      rotulo: ROTULO_MODELO,
      opcoes: () => this.opcoes(),
      valor: e.escolha ? [e.escolha] : [],
      vazio: e.disponiveis ? "selecione o modelo" : "carregando os modelos...",
      busca: true,
      larguraLista: 460,
      aoMudar: (vs) => this.escolher(vs[0] ?? ""),
    });
    this.tipo = criarCombo({
      rotulo: ROTULO_TIPO,
      opcoes: () => (this.d.estado.disponiveis?.tipos ?? []).map((t) => ({ valor: t.id, rotulo: t.nome })),
      valor: e.tipoTextoPadrao ? [e.tipoTextoPadrao] : [],
      vazio: "selecione o tipo do documento",
      busca: true,
      larguraLista: 420,
      aoMudar: (vs) => this.escolherTipo(vs[0] ?? ""),
    });
    this.linhaTipo = h(
      "div",
      { class: "dl-campo", hidden: !e.escolha?.startsWith(PREFIXO_TP) },
      h("span", { class: "dl-rotulo" }, "Tipo do documento a criar"),
      this.tipo.el,
      h("small", { class: "dl-dica" }, "O Texto Padrão não tem tipo: escolha o tipo dos documentos que serão criados."),
    );
    this.carregando = h("small", { class: "dl-carregando", "aria-live": "polite", hidden: true });
    this.erro = h("p", { class: "dl-erro", role: "alert", hidden: true });
    this.tentar = h(
      "button",
      { type: "button", class: "spro-botao", hidden: true, onclick: () => void this.listar() },
      icone("atualizar", 15),
      "Tentar de novo",
    );
    this.info = h("div", { class: "dl-info-modelo" });
    this.el = h(
      "section",
      { class: "dl-etapa-modelo", "aria-label": "Modelo" },
      h("h2", {}, "Escolha o modelo"),
      h(
        "p",
        { class: "dl-nota" },
        "O modelo é um documento gerado no SEI deste processo ou um Texto Padrão da unidade. Os trechos ",
        h("code", {}, "##campo##"),
        " do modelo serão trocados pelo valor da coluna de mesmo nome da planilha, em cada linha.",
      ),
      h("div", { class: "dl-campo" }, h("span", { class: "dl-rotulo" }, "Modelo"), this.modelo.el, this.carregando),
      this.linhaTipo,
      this.erro,
      h("div", { class: "dl-acoes" }, this.tentar),
      this.info,
    );
    this.desenharInfo();
  }

  async iniciar(): Promise<void> {
    if (!this.d.estado.disponiveis) await this.listar();
  }

  destruir(): void {
    this.destruida = true;
    this.seq++;
    this.modelo.fechar();
    this.tipo.fechar();
  }

  completa(): boolean {
    const m = this.d.estado.modelo;
    if (!m) return false;
    return m.origem === "documento" || !!m.tipoId;
  }

  /* ------------------------------------------------------------ lista */

  private opcoes(): OpcaoCombo[] {
    const disp = this.d.estado.disponiveis;
    if (!disp) return [];
    return [
      ...disp.documentos.map((doc) => ({
        valor: `${PREFIXO_DOC}${doc.numero}`,
        rotulo: doc.titulo || doc.numero,
        descricao: `Documento ${doc.numero} deste processo`,
        icone: "documento" as const,
      })),
      ...disp.textosPadrao.map((tp) => ({
        valor: `${PREFIXO_TP}${tp.id}`,
        rotulo: tp.nome,
        descricao: "Texto Padrão da unidade",
        icone: "nota" as const,
      })),
    ];
  }

  private async listar(): Promise<void> {
    const s = ++this.seq;
    this.tentar.hidden = true;
    this.mostrarErro(null);
    this.mostrarCarregando("Carregando os documentos do processo e os Textos Padrão da unidade...");
    let r: RespostaListar;
    try {
      r = await this.d.rpc.chamar<RespostaListar>("listarModelos", undefined, PRAZO_MS);
    } catch (e) {
      r = { situacao: "erro", erro: mensagemDe(e) };
    }
    if (this.destruida || s !== this.seq) return;
    this.mostrarCarregando(null);
    if (!ehObjeto(r) || r.situacao !== "ok" || !ehObjeto(r.modelos)) {
      const erro = ehObjeto(r) && r.situacao === "erro" ? r.erro : "Resposta inesperada da aba do SEI.";
      this.modelo.definirVazio("modelos indisponíveis");
      this.mostrarErro(`Não foi possível listar os modelos: ${erro}`);
      this.tentar.hidden = false;
      return;
    }
    this.d.estado.disponiveis = r.modelos;
    this.d.estado.protocolo = r.protocolo;
    const vazio = !r.modelos.documentos.length && !r.modelos.textosPadrao.length;
    this.modelo.definirVazio(vazio ? "nenhum modelo disponível" : "selecione o modelo");
    this.modelo.atualizar();
    this.tipo.atualizar();
    if (vazio) {
      this.mostrarErro(
        "Este processo não tem documento gerado no SEI e a unidade não tem Texto Padrão: não há modelo para escolher. Crie o documento modelo no processo e abra esta janela de novo.",
      );
    }
  }

  /* ------------------------------------------------------------ escolha */

  private escolher(valor: string): void {
    const e = this.d.estado;
    if (valor === e.escolha) return;
    e.escolha = valor || undefined;
    e.modelo = undefined;
    e.config = undefined;
    limparVerificacao(e);
    this.seq++;
    this.mostrarErro(null);
    this.mostrarCarregando(null);
    this.desenharInfo();
    const tp = valor.startsWith(PREFIXO_TP);
    this.linhaTipo.hidden = !tp;
    if (valor.startsWith(PREFIXO_DOC)) void this.ler({ documento: valor.slice(PREFIXO_DOC.length) });
    else if (tp && e.tipoTextoPadrao) this.lerTextoPadrao();
    this.d.aoMudar();
  }

  private escolherTipo(id: string): void {
    const e = this.d.estado;
    if (id === e.tipoTextoPadrao) return;
    e.tipoTextoPadrao = id || undefined;
    if (!e.escolha?.startsWith(PREFIXO_TP)) return;
    e.modelo = undefined;
    e.config = undefined;
    limparVerificacao(e);
    this.seq++;
    this.mostrarErro(null);
    this.desenharInfo();
    if (e.tipoTextoPadrao) this.lerTextoPadrao();
    this.d.aoMudar();
  }

  private lerTextoPadrao(): void {
    const e = this.d.estado;
    const tipoId = e.tipoTextoPadrao ?? "";
    const tipoNome = e.disponiveis?.tipos.find((t) => t.id === tipoId)?.nome;
    void this.ler({ textoPadrao: (e.escolha ?? "").slice(PREFIXO_TP.length), tipoId, ...(tipoNome ? { tipoNome } : {}) });
  }

  private async ler(escolha: EscolhaModelo): Promise<void> {
    const s = ++this.seq;
    this.mostrarCarregando("Lendo o modelo...");
    let r: RespostaLer;
    try {
      r = await this.d.rpc.chamar<RespostaLer>("lerModelo", escolha, PRAZO_MS);
    } catch (e) {
      r = { situacao: "erro", erro: mensagemDe(e) };
    }
    if (this.destruida || s !== this.seq) return;
    this.mostrarCarregando(null);
    if (ehObjeto(r) && r.situacao === "ok" && ehObjeto(r.modelo)) {
      this.d.estado.modelo = r.modelo;
      this.d.estado.config = undefined;
      limparVerificacao(this.d.estado);
    } else {
      const falha = ehObjeto(r) && r.situacao === "erro" ? r : { erro: "Resposta inesperada da aba do SEI.", sessao: undefined };
      this.mostrarErro(mensagemFalhaModelo(String(falha.erro ?? ""), !!falha.sessao));
    }
    this.desenharInfo();
    this.d.aoMudar();
  }

  /* ------------------------------------------------------------ desenho */

  private mostrarCarregando(texto: string | null): void {
    this.carregando.hidden = !texto;
    this.carregando.textContent = texto ?? "";
  }

  private mostrarErro(texto: string | null): void {
    this.erro.hidden = !texto;
    this.erro.replaceChildren(...(texto ? [icone("alerta", 16), h("span", {}, texto)] : []));
  }

  private desenharInfo(): void {
    const m = this.d.estado.modelo;
    if (!m) {
      this.info.replaceChildren();
      return;
    }
    const origem =
      m.origem === "documento"
        ? h("p", {}, "Documento ", h("strong", {}, m.titulo || m.numero), ` (nº ${m.numero})`)
        : h("p", {}, "Texto Padrão ", h("strong", {}, m.nome));
    const tipo = h("p", {}, "Tipo dos documentos a criar: ", h("strong", {}, m.tipoNome || m.tipoId || "—"));
    const campos = m.campos.length
      ? h(
          "div",
          { class: "dl-campo" },
          h("span", { class: "dl-rotulo" }, `Campos dinâmicos encontrados (${m.campos.length})`),
          h("ul", { class: "dl-lista-nomes" }, ...m.campos.map((c) => h("li", {}, h("code", {}, `##${c}##`)))),
        )
      : h(
          "p",
          { class: "dl-motivo" },
          icone("alerta", 16),
          h("span", {}, "Nenhum campo dinâmico encontrado no modelo (##campo##): todos os documentos sairão com o mesmo texto."),
        );
    this.info.replaceChildren(origem, tipo, campos);
  }
}
