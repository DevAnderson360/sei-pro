/**
 * Etapa Prévia (spec §6.1): o documento de uma linha pronta (padrão: a primeira; seletor para outra) com os campos
 * já trocados, em texto simples (é o que o usuário vai ler no SEI, não o HTML), o nome na árvore e a descrição
 * finais (sem acento no nome, trocas do latin-1, cortes), o nível de acesso da linha e o destino. O que fica
 * LITERAL no SEI aparece marcado: campo do modelo sem coluna cruzada e `##x##` da descrição ou da especificação
 * do novo processo que não corresponde a nenhuma coluna (comportamento do legado: não é erro, só aviso).
 *
 * O resumo diz quantas linhas serão gravadas e quantas ficam de fora (Ruling 19: as com erro na planilha em todos
 * os destinos e, no destino coluna, as do processo que não passou na verificação), com a duração estimada. O
 * botão do rodapé é Iniciar: a execução não é uma etapa; a Prévia chama `DepsEtapa.iniciarExecucao()` e o app
 * monta e grava o lote e troca o corpo pela tela de execução.
 */

import { paraLatin1 } from "@comum/texto/latin1";
import { extrairProtocolos } from "@comum/texto/protocolos";
import { type Combo, criarCombo } from "@comum/ui/combobox";
import { h, icone } from "@comum/ui/dom";
import { descricaoDoc, extrairCampos, preencherTexto } from "../modelo/campos";
import { CUSTO_DOCUMENTO_MS, CUSTO_PROCESSO_MS, MAX_ESPECIFICACAO } from "../modelo/constantes";
import type { LinhaDocumento } from "../modelo/destinos";
import { estimarDuracao } from "../modelo/estimativa";
import type { ConfigLote } from "../modelo/lote";
import { nomeNaArvore } from "../modelo/nomes";
import type { DepsEtapa, TelaEtapa } from "./estado";
import { mensagemDe } from "./estado";
import { ErroLoteGrande, linhasDoLote, montarLote } from "./lote";

export const ROTULO_LINHA_PREVIA = "Linha da prévia";

const CAMPO = /##([^#]+?)##/g;

const plural = (n: number, um: string, varios: string) => (n === 1 ? um : varios.replace("#", String(n)));

/** O nome do campo como o modelo o vê (o espaço não separável conta como espaço). */
const nomeDoCampo = (bruto: string) => bruto.replace(/\u00A0/g, " ");

/** Campo do modelo → valor da linha, só dos campos cruzados cuja coluna existe (o mesmo que o `criar` troca). */
export function valoresDosCampos(camposCruzados: Record<string, string>, dados: Record<string, string>): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [campo, coluna] of Object.entries(camposCruzados)) {
    if (Object.hasOwn(dados, coluna)) valores[nomeDoCampo(campo)] = dados[coluna] as string;
  }
  return valores;
}

/** A especificação do processo novo da linha, como vai à aba: campos trocados, latin-1, até 100 caracteres. */
export function especificacaoDaLinha(especificacao: string, dados: Record<string, string>): string {
  return paraLatin1(preencherTexto(especificacao, dados)).slice(0, MAX_ESPECIFICACAO).trim();
}

/** O texto com cada `##x##` que sobrou marcado (fica literal no SEI). Só nós de texto: nada vira HTML. */
function comLiteraisMarcados(texto: string): Array<Node | string> {
  const partes: Array<Node | string> = [];
  let desde = 0;
  for (const m of texto.matchAll(CAMPO)) {
    const ini = m.index ?? 0;
    if (ini > desde) partes.push(texto.slice(desde, ini));
    partes.push(h("mark", { class: "dl-literal", title: "Sem coluna correspondente: fica assim no SEI" }, m[0]));
    desde = ini + m[0].length;
  }
  if (desde < texto.length) partes.push(texto.slice(desde));
  return partes;
}

const marcado = (campo: string) => `##${campo}##`;

/** Só os dígitos: a planilha, a árvore e o texto podem escrever o mesmo número com outra pontuação. */
const digitos = (n: string | undefined) => (n ?? "").replace(/\D/g, "");

/** O texto cita o processo `protocolo` (o mesmo número, com qualquer pontuação). */
export function textoCitaProcesso(texto: string, protocolo: string): boolean {
  const alvo = digitos(protocolo);
  if (!alvo || !texto) return false;
  if (texto.includes(protocolo)) return true;
  return extrairProtocolos(texto).some((p) => p.tipo === "processo" && digitos(p.texto) === alvo);
}

export class TelaPrevia implements TelaEtapa {
  readonly el: HTMLElement;
  private readonly erro: HTMLElement;
  private readonly detalhe: HTMLElement;
  private linhas: LinhaDocumento[] = [];
  private prontas: LinhaDocumento[] = [];
  private escolhida: LinhaDocumento | null = null;
  private problema: string | null = null;
  /** O lote não caberia no armazenamento (teto de bytes): a prévia aparece, o Iniciar não. */
  private excesso: string | null = null;
  private ocupado = false;
  private destruida = false;
  private combo: Combo | null = null;

  constructor(private readonly d: DepsEtapa) {
    this.erro = h("p", { class: "dl-erro", role: "alert", hidden: true });
    this.detalhe = h("div", { class: "dl-previa-detalhe" });
    this.el = h("section", { class: "dl-etapa dl-previa", "aria-label": "Prévia" });
    this.preparar();
    this.montar();
  }

  completa(): boolean {
    return !this.ocupado && !this.problema && !this.excesso && this.prontas.length > 0;
  }

  rotuloAvancar(): string {
    return "Iniciar";
  }

  /** Iniciar: uma vez só (dois cliques não abrem dois lotes); se o app não conseguir, a tela volta a liberar. */
  avancar(): void {
    if (!this.completa() || !this.d.iniciarExecucao) return;
    this.ocupado = true;
    this.erro.hidden = true;
    this.d.aoMudar();
    void this.d.iniciarExecucao().catch((e: unknown) => {
      if (this.destruida) return;
      this.ocupado = false;
      this.mostrarErro(`Não foi possível iniciar; nada foi enviado ao SEI. ${mensagemDe(e)}`);
      this.d.aoMudar();
    });
  }

  destruir(): void {
    this.destruida = true;
    this.combo?.fechar();
  }

  /* ------------------------------------------------------------ estado */

  private preparar(): void {
    const r = linhasDoLote(this.d.estado);
    if ("erro" in r) {
      this.problema = r.erro;
      return;
    }
    this.linhas = r.linhas;
    this.prontas = r.linhas.filter((_, k) => r.situacoes[k] === "pendente");
    this.escolhida = this.prontas[0] ?? null;
    if (!this.escolhida) {
      this.problema = "Nenhuma linha pronta para gravar: corrija a planilha ou o cruzamento (Voltar).";
      return;
    }
    // O mesmo lote que o Iniciar montaria (e que ele confere de novo antes de gravar).
    try {
      montarLote(this.d.estado, this.d.ctx ?? { host: "", login: "" });
    } catch (e) {
      if (e instanceof ErroLoteGrande) this.excesso = e.message;
    }
  }

  private get cfg(): ConfigLote {
    return this.d.estado.config as ConfigLote;
  }

  /* ------------------------------------------------------------ desenho */

  private mostrarErro(texto: string): void {
    this.erro.replaceChildren(icone("alerta", 16), h("span", {}, texto));
    this.erro.hidden = false;
  }

  private montar(): void {
    if (this.problema || !this.escolhida) {
      this.mostrarErro(this.problema ?? "Nenhuma linha pronta para gravar.");
      this.el.replaceChildren(this.erro);
      return;
    }
    const cfg = this.cfg;
    const total = this.prontas.length;
    const fora = this.linhas.length - total;
    const custo = CUSTO_DOCUMENTO_MS + (cfg.destino.tipo === "novo-processo" ? CUSTO_PROCESSO_MS : 0);
    const resumo = h(
      "strong",
      { class: "dl-previa-resumo", "aria-live": "polite" },
      `${plural(total, "1 linha a gravar", "# linhas a gravar")}, ${fora === 0 ? "nenhuma fica de fora" : plural(fora, "1 fica de fora", "# ficam de fora")}.`,
    );
    const estimativa = h(
      "small",
      { class: "dl-previa-estimativa" },
      `Duração estimada: ${estimarDuracao(total, cfg.pausa, custo)} (pausa de ${cfg.pausa} ms entre documentos).`,
    );
    this.combo = criarCombo({
      rotulo: ROTULO_LINHA_PREVIA,
      opcoes: () =>
        this.prontas.map((l) => ({
          valor: String(l.indice),
          rotulo: `Linha ${l.indice + 2}: ${nomeNaArvore(l.dados[cfg.colunaNome] ?? "")}`,
        })),
      valor: [String(this.escolhida.indice)],
      larguraLista: 320,
      aoMudar: (vs) => {
        const l = this.prontas.find((x) => String(x.indice) === vs[0]);
        if (!l) return;
        this.escolhida = l;
        this.desenharLinha();
      },
    });
    this.el.replaceChildren(
      h(
        "p",
        { class: "dl-nota" },
        "Confira o documento de uma linha antes de iniciar. Os documentos saem sem assinatura e os já criados ",
        h("strong", {}, "não são desfeitos"),
        " ao pausar ou fechar.",
      ),
      h("div", { class: "dl-acoes" }, resumo),
      estimativa,
      this.avisosGerais(),
      h("div", { class: "dl-campo dl-previa-escolha" }, h("span", { class: "dl-rotulo" }, "Prévia da linha"), this.combo.el),
      this.detalhe,
      this.erro,
    );
    if (this.excesso) this.mostrarErro(this.excesso);
    this.desenharLinha();
  }

  /**
   * D1 (Ruling 21): o SEI copia o texto editável do modelo como está, inclusive o cabeçalho "Processo nº ... /
   * Interessado: ..." do processo em que o modelo está. Quando algum documento vai para OUTRO processo (novo processo
   * por linha, ou coluna com linha para outro número) e o texto do modelo cita o número desse processo, a Prévia
   * avisa. Só avisa: o texto do modelo nunca é mudado em silêncio, e o Iniciar continua liberado. Texto Padrão não
   * vem de processo nenhum: sem aviso.
   */
  private avisoProcessoDoModelo(): HTMLElement | null {
    const cfg = this.cfg;
    const protocolo = this.d.estado.protocolo;
    if (cfg.modelo.origem !== "documento" || !protocolo || !textoCitaProcesso(cfg.modelo.texto ?? "", protocolo)) return null;
    const outro =
      cfg.destino.tipo === "novo-processo" ||
      (cfg.destino.tipo === "coluna" && this.prontas.some((l) => digitos(l.destino) !== digitos(protocolo)));
    if (!outro) return null;
    return h(
      "p",
      { class: "dl-motivo dl-previa-processo-modelo", role: "note" },
      icone("alerta", 16),
      h(
        "span",
        {},
        "O texto do modelo cita o processo ",
        h("strong", {}, protocolo),
        ". Os documentos criados em outros processos vão manter esse número (e, provavelmente, o interessado do processo original), porque o SEI copia o texto do modelo como está. Antes de iniciar, tire do modelo os dados fixos do processo e do interessado: use campos ##campo## preenchidos pela planilha.",
      ),
    );
  }

  /** O que fica literal em TODAS as linhas: campo do modelo sem coluna; `##x##` da descrição/especificação sem coluna. */
  private avisosGerais(): HTMLElement {
    const cfg = this.cfg;
    const colunas = new Set(this.d.estado.colunas ?? Object.keys(this.escolhida?.dados ?? {}));
    const semColuna = cfg.modelo.campos.filter((c) => {
      const coluna = cfg.camposCruzados[c];
      return !coluna || !colunas.has(coluna);
    });
    const refsSem = (texto: string) => extrairCampos(texto).filter((c) => !colunas.has(c));
    const descricao = refsSem(cfg.modeloDescricao);
    const especificacao = cfg.destino.tipo === "novo-processo" ? refsSem(cfg.destino.especificacao) : [];
    const lista = (campos: string[]) => campos.map(marcado).join(", ");
    const caixa = h("div", { class: "dl-previa-avisos" });
    const processo = this.avisoProcessoDoModelo();
    if (processo) caixa.append(processo);
    if (semColuna.length) {
      caixa.append(
        h(
          "p",
          { class: "dl-motivo dl-previa-literais" },
          icone("alerta", 16),
          h(
            "span",
            {},
            `${plural(semColuna.length, "Campo do modelo sem coluna", "Campos do modelo sem coluna")} (fica${semColuna.length === 1 ? "" : "m"} como está no documento): ${lista(semColuna)}`,
          ),
        ),
      );
    }
    const refs: string[] = [];
    if (descricao.length) refs.push(`na descrição, ${lista(descricao)}`);
    if (especificacao.length) refs.push(`na especificação do processo novo, ${lista(especificacao)}`);
    if (refs.length) {
      caixa.append(
        h(
          "p",
          { class: "dl-motivo dl-previa-refs" },
          icone("alerta", 16),
          h("span", {}, `Sem coluna correspondente na planilha (fica literal no SEI): ${refs.join("; ")}.`),
        ),
      );
    }
    return caixa;
  }

  private desenharLinha(): void {
    const l = this.escolhida;
    if (!l || this.destruida) return;
    const cfg = this.cfg;
    const linha = (rotulo: string, classe: string, ...valor: Array<Node | string>) =>
      h("tr", {}, h("th", { scope: "row" }, rotulo), h("td", { class: classe }, ...valor));
    const descricao = cfg.modeloDescricao ? descricaoDoc(cfg.modeloDescricao, l.dados) : "";
    const nivel = l.nivel === "restrito" ? `Restrito (${l.hipotese ?? ""})` : "Público";
    const tabela = h(
      "table",
      { class: "dl-resumo" },
      h(
        "tbody",
        {},
        linha("Destino", "dl-previa-destino", this.destino(l)),
        linha("Nome na árvore", "dl-previa-nome", nomeNaArvore(l.dados[cfg.colunaNome] ?? "")),
        linha("Descrição", "dl-previa-descricao", ...(descricao ? comLiteraisMarcados(descricao) : ["(sem descrição)"])),
        linha("Nível de acesso", "dl-previa-nivel", nivel),
      ),
    );
    const texto = cfg.modelo.texto;
    const corpo = texto
      ? h(
          "div",
          { class: "dl-previa-texto", "aria-label": "Texto do documento" },
          ...comLiteraisMarcados(preencherTexto(texto, valoresDosCampos(cfg.camposCruzados, l.dados))),
        )
      : h("p", { class: "dl-nota" }, "O texto do modelo não pôde ser mostrado; os campos são trocados no documento criado.");
    this.detalhe.replaceChildren(tabela, h("h3", {}, "Texto do documento"), corpo);
  }

  private destino(l: LinhaDocumento): string {
    const d = this.cfg.destino;
    if (d.tipo === "coluna") return `Processo da coluna "${d.coluna}": ${l.destino ?? ""}`;
    if (d.tipo === "novo-processo") {
      const tipo = this.d.estado.tiposProcesso?.find((t) => t.id === d.idTipoProcesso)?.nome ?? `tipo ${d.idTipoProcesso}`;
      const espec = especificacaoDaLinha(d.especificacao, l.dados);
      return `Novo processo (${tipo}): ${espec || "(sem especificação)"}`;
    }
    return `Processo da tela: ${this.d.estado.protocolo ?? "o processo aberto nesta aba"}`;
  }
}
