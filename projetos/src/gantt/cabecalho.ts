/**
 * Rótulos do cabeçalho de cima do Gantt (mês, ano). A Frappe prende o do mês corrente à esquerda (`position: sticky`,
 * classe `current-upper`) e os outros ficam absolutos. Dois defeitos: o preso fica uns pixels acima dos demais (o
 * `top` do sticky é só um limite, não um deslocamento) e, quando o mês seguinte começa a menos de um rótulo de
 * distância (escala Semana com o mês virando na segunda coluna), os dois se sobrepõem. Aqui o preso desce até a
 * altura dos outros e, se ainda assim encostar no seguinte, some: a data na linha de baixo já diz o mês.
 */

export interface CaixaRotulo {
  esquerda: number;
  direita: number;
  topo: number;
  /** O rótulo preso (`current-upper`). */
  preso: boolean;
}

export interface AjusteRotulos {
  /** Deslocamento vertical do rótulo preso, em px (0 quando já está alinhado ou não há outro para alinhar). */
  descer: number;
  /** Índices (na ordem recebida) dos rótulos a esconder. */
  esconder: number[];
}

/** Folga mínima entre dois rótulos vizinhos, em px. */
const FOLGA = 4;

export function planejarRotulos(caixas: readonly CaixaRotulo[]): AjusteRotulos {
  const iPreso = caixas.findIndex((c) => c.preso);
  const iOutro = caixas.findIndex((c) => !c.preso);
  const descer = iPreso >= 0 && iOutro >= 0 ? caixas[iOutro]!.topo - caixas[iPreso]!.topo : 0;
  const ordem = caixas.map((c, i) => ({ c, i })).sort((a, b) => a.c.esquerda - b.c.esquerda);
  const esconder: number[] = [];
  for (let k = 0; k + 1 < ordem.length; k++) {
    const a = ordem[k]!;
    const proximo = ordem[k + 1]!;
    if (a.c.direita + FOLGA > proximo.c.esquerda && a.c.preso) esconder.push(a.i);
  }
  return { descer, esconder };
}

/** Lê o layout, aplica o plano (sempre a partir do estado limpo) e devolve o que fez. */
export function arrumarRotulos(container: HTMLElement): AjusteRotulos {
  const rotulos = Array.from(container.querySelectorAll<HTMLElement>(".upper-text"));
  for (const r of rotulos) {
    r.style.transform = "";
    r.style.visibility = "";
  }
  const caixas = rotulos.map((r): CaixaRotulo => {
    const b = r.getBoundingClientRect();
    return { esquerda: b.left, direita: b.right, topo: b.top, preso: r.classList.contains("current-upper") };
  });
  // Sem layout (área escondida): nada a medir.
  if (!caixas.some((c) => c.direita > c.esquerda)) return { descer: 0, esconder: [] };
  const plano = planejarRotulos(caixas);
  const iPreso = caixas.findIndex((c) => c.preso);
  const preso = iPreso >= 0 ? rotulos[iPreso] : undefined;
  if (preso && plano.descer) preso.style.transform = `translateY(${plano.descer}px)`;
  for (const i of plano.esconder) rotulos[i]!.style.visibility = "hidden";
  return plano;
}

/** Mantém o cabeçalho arrumado na rolagem (a Frappe troca o rótulo preso) e quando a área ganha tamanho. */
export function manterRotulosArrumados(container: HTMLElement): () => void {
  const arrumar = (): void => void arrumarRotulos(container);
  container.addEventListener("scroll", arrumar, { passive: true });
  const observador = typeof ResizeObserver === "function" ? new ResizeObserver(arrumar) : null;
  observador?.observe(container);
  arrumar();
  return () => {
    container.removeEventListener("scroll", arrumar);
    observador?.disconnect();
  };
}
