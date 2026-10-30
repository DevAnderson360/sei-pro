/**
 * Tela de previa: substitui a confirmacao do legado (2/3) por uma linha por especificacao, com o que sera
 * enviado ao SEI e o que merece atencao (repetida, vazia, cortada, caracteres trocados com o trecho em destaque).
 * As repetidas saem com um clique; Voltar devolve a configuracao como estava.
 */

import { paraLatin1 } from "@comum/texto/latin1";
import { h, icone } from "@comum/ui/dom";
import { MAX_ESPECIFICACAO } from "../modelo/constantes";
import type { LinhaLote } from "../modelo/linhas";
import { type AvisoLinha, bloqueia, estimarDuracao, type LinhaPrevia, montarPrevia } from "../modelo/previa";
import type { Parametros } from "../repositorio";

/** O que a configuracao entrega a previa. */
export interface PedidoPrevia {
  parametros: Parametros;
  linhas: LinhaLote[];
  colunas: string[];
  /** Caixa vazia e quantidade informada: processos sem especificacao (regra do legado). */
  modoQuantidade: boolean;
}

export const TEXTO_AVISO: Record<AvisoLinha, string> = {
  duplicada: "repetida",
  vazia: "vazia: sem especificação",
  truncada: "cortada em 100 caracteres",
  convertida: "caracteres trocados",
  "nivel-invalido": "nível não reconhecido: use Público ou Restrito (ou 0/1)",
  interessado: "interessado: não é aplicado nesta versão",
};

export interface Parte {
  texto: string;
  marcado: boolean;
}

/**
 * O texto que sera enviado, em trechos, com o que a conversao para latin-1 trocou marcado. A conversao e caractere
 * a caractere (depois do NFC), entao cada caractere original vira o seu trecho; depois corta em 100 e tira os
 * espacos das pontas, como `montarPrevia` (os trechos juntos dao exatamente `LinhaPrevia.enviada`).
 */
export function partesEnviadas(original: string): Parte[] {
  const partes: Parte[] = [];
  const nfc = String(original ?? "").normalize("NFC");
  for (let i = 0; i < nfc.length; i++) {
    const c = nfc[i] as string;
    const t = paraLatin1(c);
    const marcado = t !== c;
    const ultima = partes[partes.length - 1];
    if (ultima && ultima.marcado === marcado) ultima.texto += t;
    else partes.push({ texto: t, marcado });
  }
  // Corta em MAX_ESPECIFICACAO caracteres do texto convertido.
  let resto = MAX_ESPECIFICACAO;
  const cortadas: Parte[] = [];
  for (const p of partes) {
    if (resto <= 0) break;
    const texto = p.texto.slice(0, resto);
    resto -= texto.length;
    if (texto) cortadas.push({ texto, marcado: p.marcado });
  }
  // Tira os espacos das pontas (o trecho marcado de um nbsp vira espaco e tambem sai, como no envio).
  while (cortadas.length && !cortadas[0]!.texto.trimStart()) cortadas.shift();
  if (cortadas[0]) cortadas[0].texto = cortadas[0].texto.trimStart();
  while (cortadas.length && !cortadas[cortadas.length - 1]!.texto.trimEnd()) cortadas.pop();
  const fim = cortadas[cortadas.length - 1];
  if (fim) fim.texto = fim.texto.trimEnd();
  return cortadas;
}

const NOMES_NIVEL: Record<string, string> = { "0": "Público", "1": "Restrito" };

export interface AcoesPrevia {
  voltar(): void;
  iniciar(linhas: LinhaLote[]): void;
}

export class TelaPrevia {
  readonly el: HTMLElement;
  private linhas: LinhaLote[];
  private readonly corpo: HTMLElement;
  private readonly erro: HTMLElement;
  private readonly iniciarBotao: HTMLButtonElement;
  private ocupado = false;

  constructor(
    private readonly pedido: PedidoPrevia,
    private readonly a: AcoesPrevia,
  ) {
    this.linhas = [...pedido.linhas];
    this.corpo = h("div", { class: "pl-previa-corpo" });
    this.erro = h("p", { class: "pl-erro", role: "alert", hidden: true });
    this.iniciarBotao = h(
      "button",
      { type: "button", class: "spro-botao primario", title: "Iniciar (Ctrl+Enter)", onclick: () => this.iniciar() },
      icone("check", 15),
      "Iniciar",
    );
    this.el = h(
      "section",
      { class: "pl-previa", "aria-label": "Prévia" },
      h(
        "p",
        {},
        "Confira antes de iniciar. Depois de começar, os processos já criados ",
        h("strong", {}, "não são desfeitos"),
        " pelo cancelamento.",
      ),
      this.corpo,
      h(
        "div",
        { class: "spro-aviso pl-cautela" },
        icone("alerta", 16),
        h(
          "span",
          {},
          "Se o SEI ficar lento para os colegas, pause ou cancele e retome fora do horário comercial com uma pausa maior. O lote fica salvo: dá para continuar de onde parou.",
        ),
      ),
      this.erro,
      h(
        "div",
        { class: "pl-acoes" },
        h("button", { type: "button", class: "spro-botao", onclick: () => this.a.voltar() }, "Voltar"),
        h("span", { class: "pl-espaco" }),
        this.iniciarBotao,
      ),
    );
    this.desenhar();
  }

  /** Linha com erro (nivel nao reconhecido): enquanto houver, nada comeca. */
  private comErro(): number {
    return montarPrevia(this.linhas).filter((l) => bloqueia(l.avisos)).length;
  }

  private travado(): boolean {
    return this.linhas.length === 0 || this.comErro() > 0;
  }

  /** Iniciar uma vez so: dois cliques nao podem abrir dois lotes. */
  iniciar(): void {
    if (this.ocupado || this.travado()) return;
    this.ocupado = true;
    this.iniciarBotao.disabled = true;
    this.a.iniciar([...this.linhas]);
  }

  /** O app devolve o controle (falha ao gravar o lote, por exemplo). */
  liberar(erro?: string): void {
    this.ocupado = false;
    this.iniciarBotao.disabled = this.travado();
    this.erro.hidden = !erro;
    this.erro.textContent = erro ?? "";
  }

  private removerComErro(): void {
    const previa = montarPrevia(this.linhas);
    this.linhas = this.linhas.filter((_, k) => !bloqueia(previa[k]?.avisos ?? []));
    this.desenhar();
  }

  private removerRepetidas(): void {
    const previa = montarPrevia(this.linhas);
    this.linhas = this.linhas.filter((_, k) => !previa[k]?.avisos.includes("duplicada"));
    this.desenhar();
  }

  private desenhar(): void {
    const p = this.pedido.parametros;
    const previa = montarPrevia(this.linhas);
    const repetidas = previa.filter((l) => l.avisos.includes("duplicada")).length;
    const restritasPorLinha = this.linhas.filter((l) => l.nivelAcesso === "1").length;
    const nivel =
      p.nivelAcesso === "1"
        ? `Restrito — ${p.nomeHipotese}`
        : restritasPorLinha
          ? `Público (${restritasPorLinha} restrita(s) pela planilha — ${p.nomeHipotese})`
          : "Público";
    const linhaResumo = (rotulo: string, valor: string) => h("tr", {}, h("th", { scope: "row" }, rotulo), h("td", {}, valor));
    const total = this.linhas.length;
    const resumo = h(
      "table",
      { class: "pl-resumo" },
      h(
        "tbody",
        {},
        linhaResumo("Processos a abrir", String(total)),
        linhaResumo("Tipo", p.nomeTipo),
        linhaResumo("Nível de acesso", nivel),
        linhaResumo("Pausa entre processos", `${p.pausa} ms`),
        linhaResumo("Tempo estimado", estimarDuracao(total, p.pausa)),
      ),
    );
    const partes: Node[] = [resumo];
    if (this.pedido.modoQuantidade) {
      partes.push(
        h(
          "p",
          { class: "pl-nota" },
          `${total} ${total === 1 ? "processo sem especificação" : "processos sem especificação"} (caixa vazia: vale a quantidade).`,
        ),
      );
    } else {
      const comErro = previa.filter((l) => bloqueia(l.avisos)).length;
      if (comErro) {
        // Nivel nao reconhecido: cair no nivel do lote poderia criar publico o que a planilha queria restrito.
        partes.push(
          h(
            "div",
            { class: "pl-acoes pl-erro", role: "alert" },
            h(
              "span",
              {},
              `${comErro} ${comErro === 1 ? "linha com nível de acesso não reconhecido" : "linhas com nível de acesso não reconhecido"}: corrija na configuração (Voltar) ou tire a linha para iniciar.`,
            ),
            h(
              "button",
              { type: "button", class: "spro-botao pequeno", onclick: () => this.removerComErro() },
              icone("lixeira", 14),
              `Remover linhas com erro (${comErro})`,
            ),
          ),
        );
      }
      if (repetidas) {
        partes.push(
          h(
            "div",
            { class: "pl-acoes" },
            h("span", {}, `${repetidas} ${repetidas === 1 ? "linha repetida" : "linhas repetidas"} (mesmo texto enviado).`),
            h(
              "button",
              { type: "button", class: "spro-botao pequeno", "aria-label": "Remover repetidas", onclick: () => this.removerRepetidas() },
              icone("lixeira", 14),
              `Remover repetidas (${repetidas})`,
            ),
          ),
        );
      }
      partes.push(this.tabela(previa));
    }
    this.corpo.replaceChildren(...partes);
    if (!this.ocupado) this.iniciarBotao.disabled = this.travado();
  }

  private tabela(previa: LinhaPrevia[]): HTMLElement {
    const extras = (["interessado", "observacao", "nivel"] as const).filter((c) =>
      this.linhas.some((l) => (c === "nivel" ? l.nivelAcesso !== undefined || l.nivelInvalido !== undefined : (l[c] ?? "") !== "")),
    );
    const titulos: Record<(typeof extras)[number], string> = { interessado: "Interessado", observacao: "Observação", nivel: "Nível" };
    const cab = h(
      "tr",
      {},
      h("th", {}, "Nº"),
      h("th", {}, "Especificação"),
      h("th", {}, "Será enviada"),
      ...extras.map((c) => h("th", {}, titulos[c])),
      h("th", {}, "Avisos"),
    );
    // Nivel da linha: o da planilha, o valor recusado (com o erro ao lado) ou o do lote, nunca em branco.
    const nivelDoLote = `${NOMES_NIVEL[this.pedido.parametros.nivelAcesso] ?? "Público"} (do lote)`;
    const nivelDa = (l: LinhaLote): string =>
      l.nivelInvalido !== undefined ? l.nivelInvalido : l.nivelAcesso ? (NOMES_NIVEL[l.nivelAcesso] ?? "") : nivelDoLote;
    const corpo = h("tbody", {});
    previa.forEach((p, k) => {
      const l = this.linhas[k] as LinhaLote;
      const enviada = h("td", { class: "pl-enviada" });
      for (const parte of partesEnviadas(p.original)) enviada.append(parte.marcado ? h("mark", {}, parte.texto) : parte.texto);
      const avisos = h(
        "td",
        { class: "pl-avisos" },
        ...p.avisos.map((a) => h("span", { class: `spro-pilula pl-aviso-${a}` }, TEXTO_AVISO[a])),
      );
      corpo.append(
        h(
          "tr",
          { class: bloqueia(p.avisos) ? "pl-linha-erro" : p.avisos.includes("duplicada") ? "pl-repetida" : "" },
          h("td", {}, String(p.indice)),
          h("td", { class: "pl-original" }, p.original),
          enviada,
          ...extras.map((c) => h("td", {}, c === "nivel" ? nivelDa(l) : (l[c] ?? ""))),
          avisos,
        ),
      );
    });
    return h("div", { class: "pl-tabela" }, h("table", { class: "spro-resultado" }, h("thead", {}, cab), corpo));
  }
}
