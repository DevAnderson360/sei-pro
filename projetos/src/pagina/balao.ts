/**
 * Balão dos projetos na página do SEI (caixa e árvore), em Shadow DOM com o
 * CSS como texto (como o balão dos Favoritos): o CSS do SEI e o do legado não
 * o alcançam. Um aberto por vez; Esc e clique fora fecham (apertar a própria
 * âncora não fecha: o clique dela alterna); o foco que sai do balão também
 * fecha (Tab no último controle, Shift+Tab no primeiro, ou o foco que vai a
 * outro elemento da página); ao abrir, o foco vai para o primeiro controle e,
 * ao fechar, volta à âncora (o ícone que abriu), que mostra `aria-expanded`
 * enquanto o balão está aberto. O "aberto agora" mora em `pagina/balaoAtual.ts`
 * (os ícones, no pacote da página, consultam; este módulo vem sob demanda).
 */

import { balaoAberto, esquecerBalao, guardarBalaoAberto } from "./balaoAtual";

const ESTILO_BALAO = `:host{all:initial}
.pb{box-sizing:border-box;width:340px;max-width:var(--pb-max,340px);display:grid;gap:8px;padding:12px 14px;font:13px/1.4 var(--spro-fonte);color:var(--spro-texto);background:var(--spro-fundo);border:1px solid var(--spro-borda);border-radius:12px;box-shadow:var(--spro-sombra-3)}
.pb-cab{display:flex;align-items:center;gap:10px}
.pb-ic{display:grid;place-items:center;width:32px;height:32px;flex:none;border-radius:8px;color:var(--spro-destaque);background:var(--spro-destaque-suave)}
.pb-tit{flex:1;min-width:0;display:grid;line-height:1.25}
.pb-tit b{font-size:13.5px}
.pb-tit small{color:var(--spro-suave);font-variant-numeric:tabular-nums;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pb-vinc{display:grid;gap:4px;padding:8px 10px;border:1px solid var(--spro-borda);border-radius:10px}
.pb-proj{display:flex;align-items:center;gap:6px;min-width:0;color:var(--spro-suave);font-size:12px}
.pb-proj span{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pb-etapa{display:flex;align-items:center;gap:8px;min-width:0;font-weight:600}
.pb-etapa .pb-nome{min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.pb-data{margin-left:auto;color:var(--spro-suave);font-size:12px;font-weight:400;white-space:nowrap}
.pb-atrasada .pb-data{color:var(--spro-perigo)}
.pb-mais,.pb-vazio{color:var(--spro-suave);font-size:12px}
.pb-botoes{display:flex;flex-wrap:wrap;gap:6px;padding-top:4px}
.pb-rod{display:flex;flex-wrap:wrap;justify-content:flex-end;gap:8px;padding-top:4px}
.pb-form{display:grid;gap:10px;padding-top:10px;border-top:1px solid var(--spro-borda)}
.pb-vinc .pb-form{padding-top:8px}
.pb-form-como{display:grid;gap:10px}
.pb-campo{display:grid;gap:5px}
.pb-rotulo{font-size:12px;font-weight:600;color:var(--spro-suave)}
.pb-linha2{display:flex;gap:8px}
.pb-linha2>*{flex:1;min-width:0}
.pb-campo .spro-campo{box-sizing:border-box;width:100%}
.pb-dica{margin:0;color:var(--spro-suave);font-size:12px}
.pb-ok{margin:0;color:var(--spro-ok);font-size:12px}
.pb-erro{margin:0;color:var(--spro-perigo);font-size:12px}
.pb-nota{margin:0;color:var(--spro-suave);font-size:12px}
.pb-erro:empty,.pb-nota:empty,.pb-slot:empty{display:none}
.pb-pergunta{display:grid;gap:8px;padding:8px 10px;border:1px solid color-mix(in srgb,var(--spro-aviso) 35%,transparent);border-radius:8px;background:color-mix(in srgb,var(--spro-aviso) 8%,var(--spro-fundo))}
.pb-pergunta p{margin:0}
.pb .spro-segmentado{justify-self:start;flex-wrap:wrap}
.prj-st{flex:none}
.prj-st .prj-st-cor{fill:none;stroke-width:1.6}
.prj-st-concluida .prj-st-cor,.prj-st-atrasada .prj-st-cor{stroke:none}
.prj-st-concluida .prj-st-cor{fill:var(--spro-ok)}
.prj-st-atrasada .prj-st-cor{fill:var(--spro-perigo)}
.prj-st-andamento .prj-st-cor{stroke:var(--spro-destaque)}
.prj-st-andamento .prj-st-meio{fill:var(--spro-destaque)}
.prj-st-futura .prj-st-cor{stroke:var(--spro-borda-forte);stroke-dasharray:2.4 2}
.prj-st-sinal{fill:none;stroke:var(--spro-fundo);stroke-width:1.8;stroke-linecap:round;stroke-linejoin:round}
.prj-st-ponto{fill:var(--spro-fundo)}
.prj-st-marco.prj-st-andamento .prj-st-cor,.prj-st-marco.prj-st-futura .prj-st-cor{stroke:var(--spro-novidade);stroke-dasharray:none}
.prj-st-marco.prj-st-atrasada .prj-st-cor{fill:none;stroke:var(--spro-perigo)}`;

export interface OpcoesBalaoPagina {
  /** O texto de `sei-comum/src/ui/base.css` (só o `pagina/pacoteBalao.ts` importa `.css`, com o loader "text"). */
  cssBase: string;
  temaEscuro: boolean;
  rotulo: string;
  /** Depois de fechar (Esc, clique fora, "Fechar", outro balão): quem montou desiste do que esperava. */
  aoFechar?: () => void;
}

export interface BalaoPagina {
  /** A raiz de sombra (as provas e o conteúdo procuram nela). */
  raiz: ShadowRoot;
  /** O elemento que abriu (o ícone): o clique nele de novo fecha. */
  ancora: HTMLElement;
  /** Troca o conteúdo (depois de gravar: o balão mostra o novo estado no mesmo lugar, com o foco nele). */
  trocar(conteudo: HTMLElement): void;
  fechar(): void;
}

const FOCAVEIS = "button:not([disabled]), select, input, textarea, a[href]";

export function abrirBalaoNaPagina(ancora: HTMLElement, conteudo: HTMLElement, o: OpcoesBalaoPagina): BalaoPagina {
  balaoAberto()?.fechar();
  const doc = ancora.ownerDocument;
  const v = doc.defaultView;
  const host = doc.createElement("div");
  // Explícito nos dois sentidos: sem data-tema, o balão seguiria o sistema, e não o SEI.
  host.setAttribute("data-tema", o.temaEscuro ? "escuro" : "claro");
  host.className = "spro-prj-balao";
  const raiz = host.attachShadow({ mode: "open" });
  const estilo = doc.createElement("style");
  estilo.textContent = `${o.cssBase}\n${ESTILO_BALAO}`;
  const caixa = doc.createElement("div");
  caixa.setAttribute("role", "dialog");
  caixa.setAttribute("aria-label", o.rotulo);
  caixa.append(conteudo);
  raiz.append(estilo, caixa);
  const focarPrimeiro = () => caixa.querySelector<HTMLElement>(FOCAVEIS)?.focus?.({ preventScroll: true });
  const fora = (ev: Event) => {
    const caminho = ev.composedPath();
    if (!caminho.includes(host) && !caminho.includes(ancora)) b.fechar();
  };
  const tecla = (ev: Event) => {
    if ((ev as KeyboardEvent).key === "Escape") b.fechar();
  };
  // Tab no último controle ou Shift+Tab no primeiro: o foco sairia do balão (que fica no fim da página), então fecha
  // e volta à âncora, de onde o Tab segue na página.
  const tab = (ev: Event) => {
    const k = ev as KeyboardEvent;
    if (k.key !== "Tab") return;
    const focaveis = [...caixa.querySelectorAll<HTMLElement>(FOCAVEIS)];
    if (!focaveis.length) return;
    const limite = k.shiftKey ? focaveis[0] : focaveis[focaveis.length - 1];
    if (ev.target !== limite) return;
    ev.preventDefault();
    b.fechar();
  };
  // O foco que vai a outro elemento da página (fora da sombra) fecha; o que anda dentro do balão, ou some com um
  // redesenho (sem destino), não. Nem o que vai à âncora: é o clique nela (o mousedown foca antes do click), que
  // alterna; fechar aqui faria o click reabrir.
  const saiu = (ev: Event) => {
    const para = (ev as FocusEvent).relatedTarget as Node | null;
    if (!para || typeof para.nodeType !== "number" || para === host || raiz.contains(para)) return;
    if (para === ancora || ancora.contains(para)) return;
    b.fechar();
  };
  caixa.addEventListener("keydown", tab);
  caixa.addEventListener("focusout", saiu);
  let fechado = false;
  const b: BalaoPagina = {
    raiz,
    ancora,
    trocar(novo) {
      if (fechado) return;
      caixa.replaceChildren(novo);
      focarPrimeiro();
    },
    fechar() {
      if (fechado) return;
      fechado = true;
      host.remove();
      doc.removeEventListener("pointerdown", fora, true);
      doc.removeEventListener("keydown", tecla, true);
      esquecerBalao(b);
      ancora.setAttribute("aria-expanded", "false");
      if (ancora.isConnected) ancora.focus?.({ preventScroll: true });
      o.aoFechar?.();
    },
  };
  const r = ancora.getBoundingClientRect();
  // A largura útil da página (`clientWidth`, sem a barra de rolagem clássica; `innerWidth` a inclui e o balão ficaria
  // atrás dela): a posição e a largura máxima (`--pb-max`, herdada pela sombra) saem dela.
  const largura = doc.documentElement.clientWidth || v?.innerWidth || 1024;
  const maxima = Math.max(0, largura - 16);
  const esquerda = Math.max(8, Math.min(r.left, largura - Math.min(340, maxima) - 8)) + (v?.scrollX ?? 0);
  const posicionar = (topo: number) => {
    host.style.cssText = `position:absolute;z-index:2147483000;left:${Math.round(esquerda)}px;top:${Math.round(topo)}px;--pb-max:${maxima}px`;
  };
  posicionar(r.bottom + (v?.scrollY ?? 0) + 6);
  doc.body.append(host);
  // Sem lugar embaixo (a linha no fim da tela) e com lugar em cima: o balão abre para cima.
  const altura = host.getBoundingClientRect().height;
  const alturaJanela = doc.documentElement.clientHeight || v?.innerHeight || 0;
  if (altura && alturaJanela && r.bottom + 6 + altura > alturaJanela && r.top - 6 - altura > 0)
    posicionar(r.top + (v?.scrollY ?? 0) - 6 - altura);
  doc.addEventListener("pointerdown", fora, true);
  doc.addEventListener("keydown", tecla, true);
  ancora.setAttribute("aria-expanded", "true");
  guardarBalaoAberto(b);
  focarPrimeiro();
  return b;
}
