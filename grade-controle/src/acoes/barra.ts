/** Repassa o clique de um botão da grade ao link nativo da barra de ações do SEI. */
import type { AcaoNativa } from '../leitura/barra';

/** `acaoControleProcessos('url', true, ...)`: o segundo argumento diz se a ação exige processos marcados. */
export function exigeSelecao(a: AcaoNativa): boolean {
  return /acaoControleProcessos\(\s*['"][^'"]*['"]\s*,\s*true/.test(a.elemento.getAttribute('onclick') ?? '');
}

export function executarAcaoNativa(a: AcaoNativa, selecionados: number): { ok: boolean; motivo?: string } {
  if (exigeSelecao(a) && selecionados === 0) return { ok: false, motivo: 'Marque ao menos um processo.' };
  a.elemento.click();
  return { ok: true };
}
