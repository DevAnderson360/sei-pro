/**
 * Painel embutido no Controle de Processos, abaixo da lista: um iframe da
 * própria extensão (o app roda na origem dela: chrome.storage direto, CSS
 * isolado do SEI), dentro do contêiner do legado (#panelHomePro), para valer a
 * ordem entre painéis que o usuário já escolheu (optionsPro.orderPanelHome).
 * Favoritos (`favoritesPro`) e Projetos montam o seu com o mesmo código.
 *
 * Lado da aba: montar (título com a letra do título da tela, recolher
 * lembrado, iframe com o esquema de cores do app), os tratadores RPC que todo
 * painel atende (`altura`, `sobrepor`, `aviso`) e a porta nova a cada carga do iframe.
 */

import { aoMudarEsquemaSei, seiEscuro } from "../pagina/tema";
import { criarRpc, type PortaRpc, type Rpc, type Tratador } from "../ponte/rpc";
import { h, icone } from "../ui/dom";
import { type AvisarComAcoes, type AvisarNaPagina, validarPrefixo } from "./aviso";
import { criarSobreposicao, type Sobreposicao } from "./sobreposicao";

/** A ordem do painel `id` no `optionsPro` do legado (localStorage do SEI), ou null. */
export function ordemLegada(armazenamento: Pick<Storage, "getItem">, id: string): number | null {
  try {
    const op = JSON.parse(armazenamento.getItem("optionsPro") ?? "{}") as { orderPanelHome?: unknown };
    if (!Array.isArray(op.orderPanelHome)) return null;
    const item = op.orderPanelHome.find((i) => (i as { name?: unknown })?.name === id) as { index?: unknown } | undefined;
    const n = Number(item?.index);
    return item && Number.isFinite(n) ? n : null;
  } catch {
    return null;
  }
}

/** Mesma regra de `orderDivPanel` (sei-pro.js): antes do primeiro painel de ordem maior. */
export function inserirNaOrdem(container: Element, painel: Element, ordem: number | null): void {
  if (ordem !== null) {
    for (const outro of [...container.children]) {
      if (!outro.classList.contains("panelHomePro")) continue;
      const n = Number.parseInt(outro.getAttribute("data-order") ?? "", 10);
      if (Number.isFinite(n) && n > ordem) {
        outro.before(painel);
        return;
      }
    }
  }
  container.append(painel);
}

/**
 * O título do painel com a letra do título da tela ("Controle de Processos"). A classe
 * `infraBarraLocalizacao` já dá a mesma letra (o que o deixava pequeno era um `<span>`, que o SEI
 * encolhe). Copiar o estilo computado NA MONTAGEM falhava no SEI 5: os estilos da página ainda estão
 * carregando, e o valor copiado (pequeno, ou peso 400), por ser inline, vencia o da classe. Por isso o
 * peso é fixo e a letra só é conferida depois que a página termina de carregar.
 */
export function igualarAoTituloDoSei(
  doc: Document,
  titulo: HTMLElement,
  depoisDaCarga: (fn: () => void) => void = (fn) => aposCarregar(doc, fn),
): void {
  titulo.style.setProperty("font-weight", "600", "important");
  depoisDaCarga(() => copiarLetraDoTitulo(doc, titulo));
}

/** Copia tamanho e família do título da tela, se ele já tem letra de título (nunca a de texto comum). */
export function copiarLetraDoTitulo(doc: Document, titulo: HTMLElement): void {
  const ref = doc.querySelector("#divInfraBarraLocalizacao");
  const visao = doc.defaultView as (Window & { getComputedStyle?: Window["getComputedStyle"] }) | null;
  if (!ref || !visao?.getComputedStyle) return;
  try {
    const c = visao.getComputedStyle(ref);
    if (!(Number.parseFloat(c.fontSize) > 16)) return;
    titulo.style.fontSize = c.fontSize;
    if (c.fontFamily) titulo.style.fontFamily = c.fontFamily;
  } catch {
    /* sem estilo computado */
  }
}

/** Depois do `load` da página (estilos carregados) e mais um pouco, para o que o SEI aplica por script. */
function aposCarregar(doc: Document, fn: () => void): void {
  const visao = doc.defaultView;
  const agendar = () => visao?.setTimeout(fn, 1500);
  if (doc.readyState === "complete") agendar();
  else visao?.addEventListener("load", agendar, { once: true });
}

/** CSS mínimo do título, do botão de recolher e da animação do aviso, uma vez por documento e prefixo. */
export function instalarEstiloPainel(doc: Document, prefixo: string): void {
  const p = validarPrefixo(prefixo);
  const id = `${p}-painel-estilo`;
  if (doc.getElementById(id)) return;
  const s = doc.createElement("style");
  s.id = id;
  s.textContent = [
    `.${p}-titulo{display:flex!important;align-items:center;gap:8px}`,
    `.${p}-recolher{margin-left:4px;background:none;border:0;cursor:pointer;color:inherit;line-height:0;padding:2px;border-radius:4px}`,
    `.${p}-recolher:hover{background:rgb(127 127 127 / 14%)}`,
    `.${p}-recolher:focus-visible{outline:2px solid #1a73e8;outline-offset:1px}`,
    `@keyframes ${p}-aviso{from{opacity:0;transform:translate(-50%,10px)}}`,
    `@media (prefers-reduced-motion:reduce){.${p}-aviso{animation:none!important}}`,
  ].join("\n");
  (doc.head ?? doc.documentElement).append(s);
}

export interface OpcoesPainelEmbutido {
  /** id do painel (e nome na ordem do legado): "favoritesPro". Não pode repetir o de outro painel. */
  id: string;
  /** Texto do título ("Favoritos"). */
  titulo: string;
  /** Ícone antes do título (já com cor, se tiver). */
  icone: () => Element;
  urlApp: string;
  /** title do iframe (leitor de tela): "Favoritos do SEI Pro". */
  tituloIframe: string;
  /** Prefixo das classes na página do SEI: `<prefixo>-titulo`, `-corpo`, `-recolher`, `-aviso`. */
  prefixo: string;
  rotulos: { mostrar: string; recolher: string };
  /**
   * Mesmo esquema de cor do app: com esquemas diferentes, o navegador pinta um
   * fundo opaco atrás do iframe, e o diálogo sobreposto não teria fundo transparente.
   */
  temaEscuro?: boolean;
  recolhido: boolean;
  ordem: number | null;
  aoRecolher(recolhido: boolean): void;
  /** CSS do título/recolher/aviso; padrão: `instalarEstiloPainel(doc, prefixo)`. */
  estilo?: (doc: Document) => void;
  /** Altura do iframe antes de o app medir (px). */
  alturaInicial?: number;
}

export interface PainelMontado {
  painel: HTMLElement;
  iframe: HTMLIFrameElement;
  corpo: HTMLElement;
  /** Diálogo do app no meio da tela (sobreposicao.ts). */
  sobreposicao: Sobreposicao;
  /** Tira o painel da página, destravando antes a rolagem se havia diálogo aberto. */
  fechar(): void;
}

export function montarPainelEmbutido(doc: Document, o: OpcoesPainelEmbutido): PainelMontado | null {
  const form = doc.querySelector("#frmProcedimentoControlar");
  // #tblMarcadores: caixa filtrada por marcador, onde o legado também não punha painéis.
  if (!form || doc.querySelector("#tblMarcadores") || doc.getElementById(o.id)) return null;
  const p = validarPrefixo(o.prefixo);
  (o.estilo ?? ((d: Document) => instalarEstiloPainel(d, p)))(doc);
  let container = doc.querySelector("#panelHomePro");
  if (!container) {
    container = h("div", { id: "panelHomePro", style: "display: inline-block; width: 100%;" });
    form.after(container);
  }
  const iframe = h("iframe", {
    src: o.urlApp,
    title: o.tituloIframe,
    allow: "clipboard-write",
    style: `width: 100%; height: ${o.alturaInicial ?? 120}px; border: 0; display: block; color-scheme: ${o.temaEscuro ? "dark" : "light"};`,
  });
  // Com o fundo transparente, o iframe só continua transparente se o color-scheme dele bater com o do documento
  // de dentro (senão o Chrome pinta um fundo opaco). O tema do SEI pode mudar com o painel aberto.
  aoMudarEsquemaSei(doc, () => {
    iframe.style.colorScheme = seiEscuro(doc, localStorage) ? "dark" : "light";
  });
  const corpo = h("div", { class: `${p}-corpo`, hidden: o.recolhido }, iframe);
  const recolher = h("button", { type: "button", class: `${p}-recolher` });
  const pintar = () => {
    const fechado = corpo.hidden;
    const rotulo = fechado ? o.rotulos.mostrar : o.rotulos.recolher;
    recolher.setAttribute("aria-expanded", String(!fechado));
    recolher.setAttribute("aria-label", rotulo);
    recolher.title = rotulo;
    recolher.replaceChildren(icone(fechado ? "expandir" : "recolher", 18));
  };
  recolher.addEventListener("click", () => {
    corpo.hidden = !corpo.hidden;
    pintar();
    o.aoRecolher(corpo.hidden);
  });
  pintar();
  // O texto vai solto no div (como o do Controle de Processos): o SEI encolhe todo span.
  const titulo = h("div", { class: `infraBarraLocalizacao titlePanelHome ${p}-titulo` }, o.icone(), o.titulo, recolher);
  igualarAoTituloDoSei(doc, titulo);
  const painel = h(
    "div",
    {
      class: "panelHomePro",
      id: o.id,
      "data-order": o.ordem === null ? "" : String(o.ordem),
      style: "display: inline-block; width: 100%;",
    },
    titulo,
    corpo,
  );
  inserirNaOrdem(container, painel, o.ordem);
  const sobreposicao = criarSobreposicao(doc, iframe, corpo);
  return {
    painel,
    iframe,
    corpo,
    sobreposicao,
    fechar: () => {
      sobreposicao.ligar(false);
      painel.remove();
    },
  };
}

/** O que todo painel embutido atende: altura do iframe, sobreposição do diálogo e aviso no rodapé da tela. */
export function tratadoresDoPainel(d: {
  iframe: HTMLIFrameElement | null;
  sobreposicao?: Sobreposicao | null;
  avisar?: AvisarNaPagina | null;
  /** Aviso com mais de uma ação ("Informar documento" e "Desfazer"): devolve o índice clicado. */
  avisarAcoes?: AvisarComAcoes | null;
}): Record<string, Tratador> {
  return {
    altura: (args) => {
      const px = Number((args as { px?: unknown } | null)?.px);
      if (d.sobreposicao) d.sobreposicao.altura(px);
      else if (d.iframe && Number.isFinite(px)) d.iframe.style.height = `${Math.max(80, Math.min(Math.round(px), 20000))}px`;
      return true;
    },
    sobrepor: (args) => (d.sobreposicao ? d.sobreposicao.ligar((args as { ativo?: unknown } | null)?.ativo === true) : false),
    aviso: (args) => {
      const a = (args ?? {}) as { texto?: unknown; acao?: unknown; acoes?: unknown; ms?: unknown };
      const n = Number(a.ms);
      const ms = Number.isFinite(n) ? n : 7000;
      const texto = String(a.texto ?? "").slice(0, 400);
      const acoes = Array.isArray(a.acoes) ? a.acoes.slice(0, 3).map((x) => String(x).slice(0, 40)) : [];
      if (acoes.length > 1 && d.avisarAcoes) return d.avisarAcoes(texto, acoes, ms);
      if (!d.avisar) return false;
      return d.avisar(texto, a.acao ? String(a.acao).slice(0, 40) : undefined, ms);
    },
  };
}

/**
 * A cada carga do iframe, uma porta nova (o app só aceita a porta da própria aba:
 * ponte/conexaoDaAba.ts). Porta caída (app fechado ou extensão atualizada): ninguém
 * mais vai pedir para desligar a sobreposição, então ela sai aqui.
 */
export function ligarPortaDoPainel(
  m: Pick<PainelMontado, "iframe" | "sobreposicao" | "fechar">,
  conectar: () => PortaRpc,
  tratadores: Record<string, Tratador>,
): { fechar(): void; rpc(): Rpc | null } {
  let rpc: Rpc | null = null;
  m.iframe.addEventListener("load", () => {
    rpc?.fechar();
    rpc = criarRpc(conectar(), tratadores);
    rpc.aoFechar(() => m.sobreposicao.ligar(false));
  });
  return {
    fechar: () => {
      rpc?.fechar();
      m.fechar();
    },
    // A aba também chama o app (Projetos: a pílula de alerta do título pede o filtro).
    rpc: () => (rpc?.aberta ? rpc : null),
  };
}
