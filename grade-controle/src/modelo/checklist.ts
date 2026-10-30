/**
 * A anotacao do SEI e texto puro de ate 500 caracteres. A lista de tarefas do SEI Pro mora DENTRO desse texto:
 * "[ ] item" (a fazer) e "[X] item" (feito), uma por linha, o mesmo formato da anotacao da arvore do processo. Assim
 * uma anotacao escrita aqui continua legivel (e com caixas) la, e vice-versa.
 */
export interface LinhaNota {
  /** `null` = linha comum; `false` = tarefa a fazer; `true` = tarefa feita. */
  marca: boolean | null;
  texto: string;
}

const RE = /^\s*\[( |x|X)\]\s?(.*)$/;

export function lerNota(texto: string): LinhaNota[] {
  return texto.replace(/\r\n?/g, '\n').split('\n').map((l) => {
    const m = RE.exec(l);
    return m ? { marca: m[1] !== ' ', texto: m[2]! } : { marca: null, texto: l };
  });
}

export function escreverNota(linhas: readonly LinhaNota[]): string {
  return linhas.map((l) => (l.marca === null ? l.texto : `${l.marca ? '[X]' : '[ ]'} ${l.texto}`)).join('\n');
}

/** Liga a lista nas linhas pedidas; se TODAS ja eram tarefas, desliga (volta a texto comum). */
export function alternarLista(linhas: readonly LinhaNota[], indices: readonly number[]): LinhaNota[] {
  const alvo = new Set(indices.filter((i) => i >= 0 && i < linhas.length));
  if (!alvo.size) return [...linhas];
  const todas = [...alvo].every((i) => linhas[i]!.marca !== null);
  return linhas.map((l, i) => (alvo.has(i) ? { ...l, marca: todas ? null : (l.marca ?? false) } : l));
}

export function alternarFeito(linhas: readonly LinhaNota[], i: number): LinhaNota[] {
  return linhas.map((l, j) => (j === i && l.marca !== null ? { ...l, marca: !l.marca } : l));
}

export function contarTarefas(linhas: readonly LinhaNota[]): { feitas: number; total: number } {
  const t = linhas.filter((l) => l.marca !== null);
  return { feitas: t.filter((l) => l.marca).length, total: t.length };
}

/** "[X] texto" -> "☑ texto", "[ ] texto" -> "☐ texto": o resumo na celula da grade. */
export function resumoDaNota(texto: string): string {
  return lerNota(texto)
    .filter((l) => l.marca !== null || l.texto.trim())
    .map((l) => (l.marca === null ? l.texto : `${l.marca ? '☑' : '☐'} ${l.texto}`))
    .join(' / ');
}
