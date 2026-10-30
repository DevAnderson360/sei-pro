/**
 * Junta o prazo nativo e o do marcador de um mesmo processo.
 *
 * - O nativo manda na data. O marcador acrescenta hora e texto SÓ quando a data dele é a mesma
 *   (senão alguém mudou o nativo pelo SEI e o marcador ficou defasado: não entra).
 * - Marcador "desde" (sem vencimento) só aparece quando não há prazo nativo.
 * - Prazo concluído no nativo continua aparecendo, sem alerta.
 */
import type { PrazoMarcador, PrazoNativo, PrazoProcesso } from './tipos';

export function fundir(idProcedimento: string, nativo?: PrazoNativo | null, marcador?: PrazoMarcador | null): PrazoProcesso | null {
  if (nativo) {
    const base: PrazoProcesso = {
      idProcedimento,
      origem: 'nativo',
      vencimento: nativo.data,
      idControlePrazo: nativo.idControlePrazo,
      sigla: nativo.sigla,
      linkNativo: nativo.link,
      ...(nativo.concluidoEm ? { concluidoEm: nativo.concluidoEm } : {}),
    };
    if (marcador?.vencimento && marcador.data === nativo.data) {
      return { ...base, origem: 'ambos', hora: marcador.hora, texto: marcador.texto || undefined };
    }
    return base;
  }
  if (!marcador) return null;
  const base: PrazoProcesso = { idProcedimento, origem: 'marcador', hora: marcador.hora, texto: marcador.texto || undefined };
  return marcador.vencimento ? { ...base, vencimento: marcador.data } : { ...base, inicio: marcador.data };
}
