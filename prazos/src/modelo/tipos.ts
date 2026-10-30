/**
 * Modelo do prazo de um processo: dois lugares podem guardá-lo (o controle de prazo
 * nativo do SEI e o texto do marcador) e `fundir` os junta numa visão só.
 */
import type { DataISO } from '../../../sei-comum/src/datas/dias';

export type { DataISO };

/** Prazo escrito no texto de um marcador: `Ate DD/MM/AAAA HH:mm` + texto livre. */
export interface PrazoMarcador {
  data: DataISO;
  /** "HH:mm" quando o texto traz hora; o vencimento sem hora vale 23:59. */
  hora?: string;
  /** Com "ate": é um vencimento. Sem: é a data inicial (mostra há quantos dias). */
  vencimento: boolean;
  /** O que sobra do texto do marcador, sem a data nem a hora. */
  texto: string;
}

export type EstadoNativo = 'noPrazo' | 'hoje' | 'atrasado' | 'concluido';

/** Prazo do controle nativo, lido do ícone da linha do Controle de Processos. */
export interface PrazoNativo {
  idControlePrazo: string;
  idProcedimento: string;
  /** Quem definiu por último (o SEI mostra a sigla no tooltip). */
  sigla: string;
  data: DataISO;
  estado: EstadoNativo;
  concluidoEm?: DataISO;
  /** Link assinado do ícone (abre a edição; é de onde sai a exclusão). */
  link: string;
}

export type Origem = 'nativo' | 'marcador' | 'ambos';

/** O prazo do processo, depois de juntar o nativo e o marcador. */
export interface PrazoProcesso {
  idProcedimento: string;
  origem: Origem;
  /** Vencimento (nativo, ou marcador com "ate"). */
  vencimento?: DataISO;
  hora?: string;
  /** Data inicial (marcador sem "ate"); só existe quando não há vencimento. */
  inicio?: DataISO;
  texto?: string;
  concluidoEm?: DataISO;
  idControlePrazo?: string;
  sigla?: string;
  linkNativo?: string;
}

export type Situacao = 'noPrazo' | 'hoje' | 'atrasado' | 'desde' | 'concluido';

export interface Resumo {
  situacao: Situacao;
  texto: string;
  dica: string;
  /** Menor primeiro; atrasados negativos. */
  ordem: number;
  /** `YYYY-MM-DD HH:mm:ss`: o contrato do tablesorter e do agrupamento do legado. */
  sorter: string;
}
