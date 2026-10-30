/** Lista virtualizada: quais linhas desenhar. Pura, para testar sem layout. */
export interface Janela {
  inicio: number;
  fim: number;
  /** Altura (px) dos espaçadores antes e depois. */
  antes: number;
  depois: number;
}

export function calcularJanela(total: number, altura: number, rolagem: number, visivel: number, sobra = 8): Janela {
  const h = Math.max(1, altura);
  // Sem layout (testes, aba em segundo plano) a altura visível é 0: desenha um bloco razoável.
  const alvo = visivel > 0 ? visivel : h * 40;
  const inicio = Math.max(0, Math.min(total, Math.floor(rolagem / h) - sobra));
  const fim = Math.min(total, Math.ceil((rolagem + alvo) / h) + sobra);
  return { inicio, fim, antes: inicio * h, depois: Math.max(0, total - fim) * h };
}
