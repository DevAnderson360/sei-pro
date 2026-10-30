import type { DataISO } from '../../../sei-comum/src/datas/dias';
import type { DadosAndamento } from './andamentos';

/** O que as regras puras precisam saber do momento e do usuário. Passado de fora: nada aqui lê relógio nem DOM. */
export interface Ctx {
  hoje: DataISO;
  /** Milissegundos desde a época. */
  agora: number;
  /** Login do usuário logado, para `resp:eu`. */
  eu?: string;
  /** Instante da visita anterior, para "novo desde a última visita". */
  visitaAnterior?: number;
  /** Dados do andamento por id de processo (cache de até 24 h): só os agrupamentos por data de recebimento etc. leem. */
  andamentos?: Readonly<Record<string, DadosAndamento>>;
}

export const DIA_MS = 86_400_000;
