/** Modo noturno do SEI Pro: o legado guarda no localStorage da origem do SEI. */
export function temaEscuroLegado(armazenamento: Pick<Storage, "getItem">): boolean {
  try {
    return !!armazenamento.getItem("darkModePro");
  } catch {
    return false;
  }
}

/** Esquema que o Estilo Avançado aplicou neste documento (o content script o grava no <html>); null = desligado. */
export function esquemaDoEstilo2(doc: Document): "claro" | "escuro" | null {
  const v = doc.documentElement?.getAttribute("data-spro-tema");
  return v === "claro" || v === "escuro" ? v : null;
}

/** O SEI está escuro? O Estilo Avançado manda quando está ligado (inclusive para dizer "claro"); senão vale o modo noturno antigo. */
export function seiEscuro(doc: Document, armazenamento: Pick<Storage, "getItem">): boolean {
  const novo = esquemaDoEstilo2(doc);
  return novo ? novo === "escuro" : temaEscuroLegado(armazenamento);
}

/** Avisa quando o esquema do Estilo Avançado muda (modo, sistema, ligar ou desligar). Devolve o desligador. */
export function aoMudarEsquemaSei(doc: Document, cb: () => void): () => void {
  const Observador =
    (doc.defaultView as unknown as { MutationObserver?: typeof MutationObserver } | null)?.MutationObserver ?? globalThis.MutationObserver;
  if (typeof Observador !== "function" || !doc.documentElement) return () => {};
  const o = new Observador(cb);
  o.observe(doc.documentElement, { attributes: true, attributeFilter: ["data-spro-tema"] });
  return () => o.disconnect();
}

/**
 * Mantém `temaEscuro` e `corTema` do contexto da aba em dia quando o Estilo Avançado muda (o RPC
 * `contexto` devolve este objeto vivo): os painéis em iframe o pedem de novo ao desligar o estilo.
 */
export function manterTemaNoContexto(
  doc: Document,
  armazenamento: Pick<Storage, "getItem">,
  ctx: { temaEscuro: boolean; corTema?: string | undefined },
): () => void {
  return aoMudarEsquemaSei(doc, () => {
    ctx.temaEscuro = seiEscuro(doc, armazenamento);
    const cor = corDoTemaSei(doc);
    if (cor) ctx.corTema = cor;
  });
}

/** Cor do tema do SEI (a barra do sistema): SEI 4+ marca com `infraCorBarraSistema`, o 3.x usa a barra direto. */
export function corDoTemaSei(doc: Document): string | undefined {
  const visao = doc.defaultView;
  for (const seletor of [".infraCorBarraSistema", "#divInfraBarraSistema", "#divInfraBarraSistemaE"]) {
    const el = doc.querySelector(seletor);
    if (!el) continue;
    try {
      const cor = destaqueDaCorSei(visao?.getComputedStyle?.(el).backgroundColor ?? "");
      if (cor) return cor;
    } catch {
      /* sem estilo computado */
    }
  }
  return undefined;
}

/** Cor do texto sobre a cor da etiqueta (as do legado podem ser escuras). */
export function corDoTexto(hex: string): string {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})/i.exec(hex);
  if (!m) return "#1f2328";
  const [r, g, b] = [m[1], m[2], m[3]].map((x) => Number.parseInt(x ?? "0", 16));
  return (r! * 299 + g! * 587 + b! * 114) / 1000 > 140 ? "#1f2328" : "#ffffff";
}

/**
 * Cor de destaque a partir da barra do SEI (o tema escolhido pelo órgão), já
 * no formato do getComputedStyle (`rgb(21, 94, 158)`) ou em hex. Cinza e
 * transparente não servem (fica o azul padrão); cor clara demais é escurecida
 * até o texto branco ficar legível sobre ela (botão primário, número do processo).
 */
export function destaqueDaCorSei(css: string): string | null {
  const t = css.trim().toLowerCase();
  let rgb: number[] | null = null;
  const hex = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/.exec(t);
  if (hex) rgb = [hex[1], hex[2], hex[3]].map((x) => Number.parseInt(x ?? "0", 16));
  const fn = /^rgba?\(\s*(\d+)[,\s]+(\d+)[,\s]+(\d+)(?:[,\s/]+([\d.]+%?))?\s*\)$/.exec(t);
  if (fn) {
    const alfa = fn[4] === undefined ? 1 : fn[4].endsWith("%") ? Number.parseFloat(fn[4]) / 100 : Number.parseFloat(fn[4]);
    if (alfa < 0.9) return null;
    rgb = [fn[1], fn[2], fn[3]].map((x) => Number(x));
  }
  if (!rgb || rgb.some((x) => !Number.isFinite(x) || x < 0 || x > 255)) return null;
  const [r, g, b] = rgb as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  if (max === 0 || (max - min) / max < 0.25) return null;
  let cor: [number, number, number] = [r, g, b];
  for (let i = 0; i < 12 && corDoTexto(paraHex(cor)) !== "#ffffff"; i++)
    cor = cor.map((x) => Math.round(x * 0.88)) as [number, number, number];
  return paraHex(cor);
}

function paraHex(c: readonly number[]): string {
  return `#${c.map((x) => x.toString(16).padStart(2, "0")).join("")}`;
}
