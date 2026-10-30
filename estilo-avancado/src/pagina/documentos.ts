import { adaptarCor } from "@comum/tema/adaptar";

/**
 * Remapeamento de cores do corpo de documentos no tema escuro. Só exibição: a cor original
 * nunca é sobrescrita. A cor adaptada vai em variáveis CSS próprias no elemento e uma regra
 * (com prioridade sobre o inline) a aplica enquanto o atributo `data-spro-adaptado` existir.
 * Desligar remove atributo, variáveis e regra: zero rastro. "Ver original" volta ao papel
 * branco e às cores de origem sem desfazer nada.
 */

export const ATRIBUTO_ADAPTADO = "data-spro-adaptado";
export const ATRIBUTO_ORIGINAL = "data-spro-original";
export const VAR_TEXTO = "--spro-doc-texto";
export const VAR_FUNDO = "--spro-doc-fundo";
const MARCA_ESTILO = "data-spro-tema-doc";
const MARCA_BOTAO = "data-spro-ver-original";
const LOTE = 400;

const CANDIDATOS = "[style],[bgcolor],[color],font,td,th,table";
const IGNORADOS = new Set(["IMG", "CANVAS", "SVG", "IFRAME", "EMBED", "OBJECT", "VIDEO", "SCRIPT", "STYLE", "LINK"]);

const REGRAS = `
:root[data-spro-tema="escuro"]:not([${ATRIBUTO_ORIGINAL}]) [${ATRIBUTO_ADAPTADO}~="t"] { color: var(${VAR_TEXTO}) !important; }
:root[data-spro-tema="escuro"]:not([${ATRIBUTO_ORIGINAL}]) [${ATRIBUTO_ADAPTADO}~="f"] { background-color: var(${VAR_FUNDO}) !important; }
:root[${ATRIBUTO_ORIGINAL}] body { background: #fff; color: #000; }
[${MARCA_BOTAO}] { position: fixed; bottom: 12px; left: 12px; z-index: 2147483000; padding: 4px 10px;
  font: 12px/1.4 var(--spro-fonte, system-ui, sans-serif); color: var(--spro-texto); background: var(--spro-fundo);
  border: 1px solid var(--spro-borda-forte); border-radius: var(--spro-raio, 8px); cursor: pointer; box-shadow: var(--spro-sombra-2); }
[${MARCA_BOTAO}]:hover { background: var(--spro-destaque); color: var(--spro-destaque-texto); }
[${MARCA_BOTAO}][aria-pressed="true"] { outline: 2px solid var(--spro-destaque); }
`;

export interface OpcoesRemapeamento {
  /** Seletores das raízes do conteúdo; padrão: o `body`. */
  raizes?: string[];
  /** Mostra o botão "Ver original". */
  botao?: boolean;
}

function valorInline(el: Element, propriedade: "color" | "background-color", atributo: "color" | "bgcolor"): string {
  const estilo = (el as HTMLElement).style;
  const inline =
    estilo?.getPropertyValue?.(propriedade) || (propriedade === "background-color" ? estilo?.getPropertyValue?.("background") : "") || "";
  return inline || el.getAttribute(atributo) || "";
}

/** Cor própria do elemento: inline/atributo; no navegador, também a do estilo computado (classes do documento). */
function corPropria(el: Element, papel: "texto" | "fundo"): string {
  const prop = papel === "texto" ? "color" : "background-color";
  const atributo = papel === "texto" ? "color" : "bgcolor";
  const direto = valorInline(el, prop, atributo);
  if (direto) return direto;
  if (papel === "fundo" && /^(TD|TH|TABLE)$/.test(el.tagName)) {
    try {
      return el.ownerDocument.defaultView?.getComputedStyle(el).backgroundColor ?? "";
    } catch {
      return "";
    }
  }
  return "";
}

function adaptarElemento(el: Element, estilosOriginais: Map<Element, string | null>): void {
  if (IGNORADOS.has(el.tagName.toUpperCase()) || el.closest?.(`[${MARCA_BOTAO}]`)) return;
  let marca = "";
  const guardar = () => {
    if (!estilosOriginais.has(el)) estilosOriginais.set(el, el.getAttribute("style"));
  };
  const texto = adaptarCor(corPropria(el, "texto"), "texto");
  if (texto) {
    guardar();
    (el as HTMLElement).style.setProperty(VAR_TEXTO, texto);
    marca += "t";
  }
  const fundo = adaptarCor(corPropria(el, "fundo"), "fundo");
  if (fundo) {
    guardar();
    (el as HTMLElement).style.setProperty(VAR_FUNDO, fundo);
    marca += "f";
  }
  if (marca) el.setAttribute(ATRIBUTO_ADAPTADO, marca);
}

/** Remove tudo que o remapeamento pôs num elemento (ou nos seus descendentes). */
export function limparParaGravar(raiz: Element): void {
  for (const el of [raiz, ...raiz.querySelectorAll(`[${ATRIBUTO_ADAPTADO}]`)]) {
    if (!el.hasAttribute(ATRIBUTO_ADAPTADO)) continue;
    el.removeAttribute(ATRIBUTO_ADAPTADO);
    const estilo = (el as HTMLElement).style;
    estilo.removeProperty(VAR_TEXTO);
    estilo.removeProperty(VAR_FUNDO);
    if (!el.getAttribute("style")) el.removeAttribute("style");
  }
}

function agendar(fn: () => void): void {
  const w = globalThis as unknown as { requestIdleCallback?: (cb: () => void) => number };
  if (typeof w.requestIdleCallback === "function") w.requestIdleCallback(fn);
  else setTimeout(fn, 0);
}

/**
 * Liga o remapeamento no documento. Devolve o desligador. Chamar de novo sem desligar antes
 * é seguro (o estilo e o botão são únicos e os elementos já marcados são pulados).
 */
export function iniciarRemapeamento(doc: Document, opcoes: OpcoesRemapeamento = {}): () => void {
  const raizes = (opcoes.raizes ?? ["body"]).flatMap((s) => [...doc.querySelectorAll(s)]);
  if (raizes.length === 0) return () => {};

  if (!doc.querySelector(`style[${MARCA_ESTILO}]`)) {
    const estilo = doc.createElement("style");
    estilo.setAttribute(MARCA_ESTILO, "");
    estilo.textContent = REGRAS;
    (doc.head ?? doc.documentElement).appendChild(estilo);
  }

  const vistos = new WeakSet<Element>();
  // O atributo style volta byte a byte ao que era (remover a variavel o reserializaria).
  const estilosOriginais = new Map<Element, string | null>();
  let fila: Element[] = [];
  let agendado = false;
  let ligado = true;

  const processar = () => {
    agendado = false;
    if (!ligado) return;
    for (const el of fila.splice(0, LOTE)) {
      if (vistos.has(el)) continue;
      vistos.add(el);
      adaptarElemento(el, estilosOriginais);
    }
    if (fila.length > 0) {
      agendado = true;
      agendar(processar);
    }
  };
  const enfileirar = (el: Element) => {
    if (el.nodeType !== 1) return;
    if (el.matches?.(CANDIDATOS)) fila.push(el);
    for (const filho of el.querySelectorAll?.(CANDIDATOS) ?? []) fila.push(filho);
    if (!agendado && fila.length > 0) {
      agendado = true;
      agendar(processar);
    }
  };

  for (const r of raizes) enfileirar(r);

  let observador: MutationObserver | null = null;
  if (typeof MutationObserver === "function") {
    observador = new MutationObserver((registros) => {
      for (const r of registros) {
        if (r.type === "childList") for (const n of r.addedNodes) enfileirar(n as Element);
        else if (r.type === "attributes" && r.target.nodeType === 1) {
          vistos.delete(r.target as Element);
          enfileirar(r.target as Element);
        }
      }
    });
    for (const r of raizes) observador.observe(r, { childList: true, subtree: true });
  }

  if (opcoes.botao) instalarBotao(doc);

  return () => {
    ligado = false;
    observador?.disconnect();
    fila = [];
    limparParaGravar(doc.documentElement);
    for (const [el, estilo] of estilosOriginais) {
      if (estilo === null) el.removeAttribute("style");
      else el.setAttribute("style", estilo);
    }
    estilosOriginais.clear();
    for (const el of doc.querySelectorAll(`style[${MARCA_ESTILO}], [${MARCA_BOTAO}]`)) el.remove();
    doc.documentElement.removeAttribute(ATRIBUTO_ORIGINAL);
  };
}

/** Alterna entre o documento adaptado e o original (papel branco, como será assinado). */
export function alternarOriginal(doc: Document): boolean {
  const raiz = doc.documentElement;
  const original = !raiz.hasAttribute(ATRIBUTO_ORIGINAL);
  if (original) raiz.setAttribute(ATRIBUTO_ORIGINAL, "");
  else raiz.removeAttribute(ATRIBUTO_ORIGINAL);
  const b = doc.querySelector(`[${MARCA_BOTAO}]`);
  b?.setAttribute("aria-pressed", String(original));
  return original;
}

function instalarBotao(doc: Document): void {
  if (doc.querySelector(`[${MARCA_BOTAO}]`) || !doc.body) return;
  const b = doc.createElement("button");
  b.type = "button";
  b.setAttribute(MARCA_BOTAO, "");
  b.setAttribute("aria-pressed", "false");
  b.title = "Mostra o documento com as cores originais, como será assinado";
  b.textContent = "Ver original";
  b.addEventListener("click", () => alternarOriginal(doc));
  doc.body.appendChild(b);
}
