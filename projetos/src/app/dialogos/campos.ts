/**
 * Peças dos formulários (tela 2): campo com rótulo, linha de campos, seção
 * recolhida com resumo à direita, caixa de erros e o campo de processo SEI
 * (seletor com os processos da caixa e qualquer número digitado).
 */

import { normalizarTexto } from "@comum/texto";
import { type Combo, criarCombo, type OpcaoCombo } from "@comum/ui/combobox";
import { h, icone } from "@comum/ui/dom";
import { vinculoSemNumero } from "../../modelo/sigilo";
import type { Vinculo } from "../../modelo/tipos";
import { protocoloNoTexto, protocoloValido, RE_DOCUMENTO, RE_ID_PROCEDIMENTO, RE_PROTOCOLO } from "../../modelo/vinculos";
import type { DocumentoConferido, ProcessoDaCaixa } from "../../ponte/tipos";
import { cotaCheia, TEXTO_COTA_CHEIA } from "../erros";

type Filho = Node | string | null | undefined | false;

export function campo(rotulo: string, controle: Node, o: { opcional?: string; dica?: string; classe?: string } = {}): HTMLElement {
  return h(
    "div",
    { class: `prj-campo${o.classe ? ` ${o.classe}` : ""}` },
    h("span", { class: "prj-rotulo" }, rotulo, o.opcional ? h("span", { class: "prj-opcional" }, ` ${o.opcional}`) : null),
    controle,
    o.dica ? h("div", { class: "prj-dica" }, o.dica) : null,
  );
}

export function linhaDeCampos(...filhos: Filho[]): HTMLElement {
  return h("div", { class: "prj-linha" }, ...filhos);
}

export interface Secao {
  el: HTMLElement;
  /** Recalcula o resumo à direita. */
  resumir(): void;
  abrir(): void;
}

/** Seção recolhida (tela 2): botão com ícone, título e resumo; o conteúdo aparece ao abrir. */
export function secao(id: string, ic: Element, titulo: string, resumo: () => string, conteudo: HTMLElement, aberta = false): Secao {
  const res = h("span", { class: "prj-sec-res" });
  const botao = h(
    "button",
    { type: "button", "aria-expanded": String(aberta) },
    h("span", { class: "prj-sec-seta" }, icone("chevron", 14)),
    ic,
    h("span", { class: "prj-sec-tit" }, titulo),
    res,
  );
  const el = h(
    "div",
    { class: `prj-sec${aberta ? " prj-sec-aberta" : ""}`, "data-secao": id },
    botao,
    h("div", { class: "prj-sec-conteudo" }, conteudo),
  );
  const alternar = (abrir: boolean) => {
    el.classList.toggle("prj-sec-aberta", abrir);
    botao.setAttribute("aria-expanded", String(abrir));
  };
  botao.addEventListener("click", () => alternar(!el.classList.contains("prj-sec-aberta")));
  const resumir = () => {
    res.textContent = resumo();
  };
  resumir();
  return { el, resumir, abrir: () => alternar(true) };
}

export function caixaDeErros(): { el: HTMLElement; mostrar(m: readonly string[]): void } {
  const el = h("div", { class: "prj-erros", role: "alert", hidden: true });
  return {
    el,
    mostrar(m) {
      el.replaceChildren(...m.map((t) => h("div", {}, t)));
      el.hidden = !m.length;
    },
  };
}

/** Mensagens de um erro do repositório (ErroValidacao), da cota do navegador ou de qualquer outro. */
export function mensagensDoErro(e: unknown): string[] {
  const m = (e as { mensagens?: unknown })?.mensagens;
  if (Array.isArray(m) && m.length) return m.map(String);
  if (cotaCheia(e)) return [TEXTO_COTA_CHEIA];
  return [`Não foi possível salvar: ${e instanceof Error ? e.message : String(e)}`];
}

const VALOR_DIGITADO = "digitado:";
/** A opção do vínculo vazio do texto (nenhum número de processo tem ":"). */
const VALOR_SIGILOSO = "sigiloso:";

/**
 * O número digitado ou colado (`protocoloNoTexto`, a mesma regra da importação do Atividades). Nenhum pedaço
 * que passe, ou mais de um: fica o texto inteiro, que `protocoloValido` recusa.
 */
function protocoloLimpo(t: string): string {
  return protocoloNoTexto(t) ?? t.trim();
}

/** A regra mora em modelo/vinculos.ts (a importação do Atividades usa a mesma); fica exportada daqui também. */
export { protocoloValido };

/**
 * O vínculo de um processo da caixa: o número sem os espaços das pontas e o `idProcedimento` só quando é
 * número (vazio ou torto fica de fora). A caixa vem da página do SEI e não passa por `protocoloValido`.
 */
function vinculoDaCaixa(p: ProcessoDaCaixa): Vinculo {
  const v: Vinculo = { protocolo: p.protocolo.trim() };
  const id = typeof p.idProcedimento === "string" ? p.idProcedimento.trim() : "";
  if (RE_ID_PROCEDIMENTO.test(id)) v.idProcedimento = id;
  if (p.sigiloso) v.sigiloso = true;
  return v;
}

export const ERRO_PROTOCOLO = "Número de processo inválido.";

export interface CampoProcesso {
  combo: Combo;
  /** O vínculo escolhido; undefined = nenhum (no da etapa: herda o do projeto). */
  vinculo(): Vinculo | undefined;
  /**
   * O número escolhido não serve: o digitado não passa em `protocoloValido`; o da caixa está fora da forma
   * que os colegas aceitam (`RE_PROTOCOLO`; senão o projeto ficaria só neste computador).
   */
  invalido(): boolean;
}

/**
 * Seletor de processo: os da caixa (carregados quando chegam) e qualquer
 * número digitado ("Criar"). Processo sigiloso da caixa vem marcado; número
 * digitado que é de um processo da caixa herda os dados dele. O vínculo vazio
 * do texto (processo sigiloso cujo número este computador não tem) vem como a
 * opção "Processo sigiloso", já escolhida: salvar o mantém; só o vazio
 * escolhido pelo usuário o tira, e um número escolhido o substitui.
 */
export function campoProcesso(o: {
  rotulo: string;
  atual?: Vinculo;
  vazio: string;
  processos: () => Promise<ProcessoDaCaixa[]>;
  aoMudar?: () => void;
}): CampoProcesso {
  let caixa: ProcessoDaCaixa[] = [];
  const digitados = new Map<string, Vinculo>();
  const semNumero = vinculoSemNumero(o.atual);
  const opcoes = (): OpcaoCombo[] => {
    const lista: OpcaoCombo[] = [{ valor: "", rotulo: o.vazio }];
    if (semNumero)
      lista.push({ valor: VALOR_SIGILOSO, rotulo: "Processo sigiloso", descricao: "O número não está neste computador", icone: "cadeado" });
    if (o.atual?.protocolo && !caixa.some((p) => p.protocolo === o.atual?.protocolo))
      lista.push({ valor: o.atual.protocolo, rotulo: o.atual.protocolo, icone: o.atual.sigiloso ? "cadeado" : "pasta" });
    for (const p of caixa)
      lista.push({
        valor: p.protocolo,
        rotulo: p.protocolo,
        descricao: p.sigiloso ? "Sigiloso" : [p.tipo, p.especificacao].filter(Boolean).join(" · ") || undefined,
        icone: p.sigiloso ? "cadeado" : "pasta",
      });
    for (const [valor, v] of digitados) lista.push({ valor, rotulo: v.protocolo, icone: "pasta" });
    return lista;
  };
  const combo = criarCombo({
    rotulo: o.rotulo,
    opcoes,
    valor: [semNumero ? VALOR_SIGILOSO : (o.atual?.protocolo ?? "")],
    vazio: o.vazio,
    icone: "pasta",
    busca: true,
    larguraLista: 320,
    criar: (texto) => {
      const protocolo = protocoloLimpo(texto);
      if (!protocolo) return null;
      const daCaixa = caixa.find((p) => normalizarTexto(p.protocolo) === normalizarTexto(protocolo));
      if (daCaixa) return { valor: daCaixa.protocolo, rotulo: daCaixa.protocolo };
      digitados.set(`${VALOR_DIGITADO}${protocolo}`, { protocolo });
      return { valor: `${VALOR_DIGITADO}${protocolo}`, rotulo: protocolo };
    },
    rotuloCriar: (t) => `Usar o número “${protocoloLimpo(t)}”`,
    aoMudar: () => o.aoMudar?.(),
  });
  void o
    .processos()
    .then((lista) => {
      caixa = lista.filter((p) => typeof p?.protocolo === "string").map((p) => ({ ...p, protocolo: p.protocolo.trim() }));
      combo.atualizar();
    })
    .catch(() => undefined);
  return {
    combo,
    invalido() {
      const v = combo.valor()[0] ?? "";
      const digitado = digitados.get(v);
      if (digitado) return !protocoloValido(digitado.protocolo);
      const p = caixa.find((x) => x.protocolo === v);
      return !!p && (!p.protocolo || !RE_PROTOCOLO.test(p.protocolo));
    },
    vinculo() {
      const v = combo.valor()[0] ?? "";
      if (!v) return undefined;
      if (v === VALOR_SIGILOSO) return o.atual;
      const digitado = digitados.get(v);
      if (digitado) return digitado;
      const p = caixa.find((x) => x.protocolo === v);
      if (p) return vinculoDaCaixa(p);
      return o.atual?.protocolo === v ? o.atual : { protocolo: v };
    },
  };
}

/** A explicação do campo quando a etapa só tem o marcador do texto (documento de processo sigiloso sem o número). */
export const DICA_DOCUMENTO_SEM_NUMERO =
  "Documento de processo sigiloso: o número não está neste computador. Deixe em branco para mantê-lo; um número digitado o substitui.";

export const ERRO_DOCUMENTO = "Número de documento inválido.";

/** A pontuação que cola nas pontas de um número copiado de um texto ("(1234567)", "1234567,", "nº 1234567."). */
const PONTUACAO_DAS_PONTAS = /^[()[\],.;:]+|[()[\],.;:]+$/g;

/**
 * O número de documento digitado ou colado, sem os espaços das pontas (a regra que o repositório aceita de um
 * colega: vazio, ou só dígitos de 1 a 20, `RE_DOCUMENTO`). Colado de um texto ("Despacho 12 (1234567)", "SEI nº
 * 1234567."), cada pedaço separado por espaço perde a pontuação das pontas (`()[],.;:`) e vale o ÚNICO pedaço que
 * passa entre parênteses ou colchetes (o número SEI vem assim depois do nome do documento); sem nenhum entre eles,
 * o único que passa no texto todo. Nenhum, ou mais de um no mesmo nível: `null` (inválido: ambíguo). Nada é tirado
 * do meio de um pedaço: "1.234.567" e "12a" não viram outro número.
 */
function documentoLimpo(t: string): string | null {
  const inteiro = t.trim();
  if (!inteiro || RE_DOCUMENTO.test(inteiro)) return inteiro;
  const dentro: string[] = [];
  const todos: string[] = [];
  let nivel = 0;
  let pedaco = "";
  let entre = false;
  const fechar = () => {
    const limpo = pedaco.replace(PONTUACAO_DAS_PONTAS, "");
    if (RE_DOCUMENTO.test(limpo)) {
      todos.push(limpo);
      if (entre) dentro.push(limpo);
    }
    pedaco = "";
    entre = false;
  };
  for (const c of inteiro) {
    if (/\s/.test(c)) {
      fechar();
      continue;
    }
    if (c === "(" || c === "[") nivel++;
    else if (c === ")" || c === "]") nivel = Math.max(0, nivel - 1);
    else if (nivel > 0) entre = true;
    pedaco += c;
  }
  fechar();
  const escolhidos = dentro.length ? dentro : todos;
  return escolhidos.length === 1 ? (escolhidos[0] as string) : null;
}

/**
 * Campo do número SEI com a conferência pela pesquisa rápida (sem abrir a árvore). `semNumero`: a etapa só tem
 * o marcador do texto (documento de processo sigiloso cujo número este computador não tem): o campo vem vazio
 * e diz isso no lugar do "Número SEI". `invalido()`: o texto não passa na regra (o diálogo mostra
 * `ERRO_DOCUMENTO` e não salva); `numero()` é então vazio.
 */
export function campoDocumento(
  valor: string,
  conferir?: (numero: string) => Promise<DocumentoConferido | null>,
  aoMudar?: () => void,
  o: { semNumero?: boolean } = {},
): { el: HTMLElement; numero(): string; invalido(): boolean } {
  const input = h("input", {
    type: "text",
    class: "spro-campo",
    name: "documento",
    inputmode: "numeric",
    placeholder: o.semNumero ? "Documento de processo sigiloso" : "Número SEI",
    maxlength: "30",
    value: valor,
  });
  const ok = h("div", { class: "prj-docok", hidden: true });
  const numero = () => documentoLimpo(input.value) ?? "";
  let pedido = 0;
  input.addEventListener("change", () => {
    aoMudar?.();
    const n = numero();
    const meu = ++pedido;
    if (!n || !conferir) {
      ok.hidden = true;
      return;
    }
    void conferir(n)
      .then((r) => {
        if (meu !== pedido) return;
        ok.hidden = false;
        ok.classList.toggle("prj-docok-falta", !r);
        ok.replaceChildren(
          ...(r
            ? [icone("check", 14), r.protocolo ? `Documento encontrado no processo ${r.protocolo}` : "Documento encontrado no SEI"]
            : [icone("alerta", 14), "Não encontrado no SEI: confira o número."]),
        );
      })
      .catch(() => {
        if (meu === pedido) ok.hidden = true;
      });
  });
  return { el: h("div", {}, input, ok), numero, invalido: () => documentoLimpo(input.value) === null };
}
