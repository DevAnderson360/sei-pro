/**
 * Onde o prazo vai ser gravado (decisão A do spec): o vencimento por data ou por dias vai ao
 * controle nativo do SEI quando ele existe e a data ainda não passou; hora, texto e marcador só
 * existem no marcador e só são gravados quando preenchidos; a data inicial ("contar desde") e o
 * prazo sem controle nativo vão só ao marcador. Função pura: o modal mostra o destino enquanto o
 * usuário preenche, e o serviço grava exatamente o que ela decidiu.
 */
import { type DataISO, somarDias, somarDiasUteis } from '../../../sei-comum/src/datas/dias';

export interface Entrada {
  ids: string[];
  /** Falso: é a data inicial ("há N dias"), que o nativo não aceita. */
  vencimento: boolean;
  contagem: 'data' | 'dias';
  data?: DataISO;
  dias?: number;
  uteis?: boolean;
  hora?: string;
  texto?: string;
  /** id ou nome do marcador em que gravar. */
  marcador?: string;
}

export interface Destino {
  nativo: boolean;
  marcador: boolean;
  erro?: string;
  /** Por que o prazo não vai (só) ao controle do SEI, ou o que acompanha. */
  aviso?: string;
  /** Vencimento em dias sem controle nativo: a data calculada aqui, com os feriados nacionais. */
  dataCalculada?: DataISO;
}

const VAZIO = (s: string | undefined) => !s || !s.trim();

export function decidir(e: Entrada, nativoDisponivel: boolean, hoje: DataISO, feriados: ReadonlySet<DataISO> = new Set()): Destino {
  if (e.ids.length === 0) return { nativo: false, marcador: false, erro: 'Selecione ao menos um processo.' };
  if (!e.vencimento) {
    if (!e.data) return { nativo: false, marcador: true, erro: 'Informe a data inicial.' };
    return {
      nativo: false,
      marcador: true,
      ...(VAZIO(e.marcador) ? { erro: 'Escolha o marcador em que a data inicial será gravada.' } : {}),
      aviso: 'A data inicial fica só no marcador: o controle de prazo do SEI só aceita vencimentos.',
    };
  }
  if (e.contagem === 'data' && !e.data) return { nativo: false, marcador: false, erro: 'Informe a data de vencimento.' };
  if (e.contagem === 'dias' && !(Number.isInteger(e.dias) && (e.dias ?? 0) >= 1 && (e.dias ?? 0) <= 999)) {
    return { nativo: false, marcador: false, erro: 'Informe o número de dias (1 a 999).' };
  }
  const passada = e.contagem === 'data' && !!e.data && e.data < hoje;
  const complemento = !VAZIO(e.hora) || !VAZIO(e.texto) || !VAZIO(e.marcador);
  if (nativoDisponivel && !passada) {
    if (complemento && VAZIO(e.marcador)) return { nativo: true, marcador: true, erro: 'Escolha o marcador em que a hora e o texto serão gravados.' };
    return {
      nativo: true,
      marcador: complemento,
      ...(complemento ? { aviso: 'O vencimento vai para o controle de prazo do SEI; a hora e o texto, para o marcador.' } : {}),
    };
  }
  const dataCalculada = e.contagem === 'dias' ? (e.uteis ? somarDiasUteis(hoje, e.dias!, feriados) : somarDias(hoje, e.dias!)) : undefined;
  return {
    nativo: false,
    marcador: true,
    ...(VAZIO(e.marcador) ? { erro: 'Escolha o marcador em que o prazo será gravado.' } : {}),
    aviso: passada
      ? 'A data já passou e o controle de prazo do SEI só aceita datas futuras: o prazo vai para o marcador.'
      : 'Este SEI não oferece o controle de prazo nativo (4.1.5 ou superior) ou o seu perfil não o permite: o prazo vai para o marcador.',
    ...(dataCalculada ? { dataCalculada } : {}),
  };
}
