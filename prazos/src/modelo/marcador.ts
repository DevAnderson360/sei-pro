/**
 * O prazo escrito no texto do marcador. Regras do legado (`setControlePrazo`), com um acerto:
 * "ate" só conta como palavra inteira. O legado procurava a sílaba em qualquer lugar, então
 * "Atendimento 12/10/2026" virava vencimento.
 */
import { deISO, formatarData, hojeISO } from '../../../sei-comum/src/datas/dias';
import type { DataISO, PrazoMarcador } from './tipos';

const DATA = /(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(\d{4})/;
const HORA = /\b([01]?\d|2[0-3]):([0-5]\d)\b/;
/** "ate"/"até" como palavra inteira (o `\b` do JS não entende letra acentuada). */
const ATE = /(?<!\p{L})at[e\u00E9](?!\p{L})/iu;


/** "31/02/2026" casa com o padrão e não existe: o `Date` rola para março. */
function dataValida(dia: string, mes: string, ano: string): DataISO | null {
  const iso = `${ano}-${mes}-${dia}`;
  try {
    return hojeISO(deISO(iso)) === iso ? iso : null;
  } catch {
    return null;
  }
}

const dois = (n: string) => n.padStart(2, '0');

export function lerMarcador(texto: string): PrazoMarcador | null {
  const bruto = texto.replace(/\r\n?/g, '\n');
  const m = DATA.exec(bruto);
  if (!m) return null;
  const data = dataValida(m[1]!, m[2]!, m[3]!);
  if (!data) return null;
  const hm = HORA.exec(bruto);
  const hora = hm ? `${dois(hm[1]!)}:${hm[2]}` : undefined;
  const vencimento = ATE.test(bruto);
  // O que sobra: sem "Ate", sem a data nem a hora que o SEI Pro escreveu.
  let sobra = bruto.replace(ATE, '').replace(DATA, '');
  if (hm) sobra = sobra.replace(HORA, '');
  sobra = sobra
    .replace(/[ \t]+/g, ' ')
    .replace(/^[ \t]*\n+|\n+[ \t]*$/g, '')
    .trim();
  return { data, hora, vencimento, texto: sobra };
}

/** `Ate DD/MM/AAAA HH:mm` (vencimento) ou `DD/MM/AAAA HH:mm`, e o texto livre numa segunda linha. */
export function formatarMarcador(p: { vencimento: boolean; data: DataISO; hora?: string; texto?: string }): string {
  const cabecalho = `${p.vencimento ? 'Ate ' : ''}${formatarData(p.data)} ${p.hora || '23:59'}`;
  const texto = (p.texto ?? '').trim();
  return texto ? `${cabecalho}\n${texto}` : cabecalho;
}
