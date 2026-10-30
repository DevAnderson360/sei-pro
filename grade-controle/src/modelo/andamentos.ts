/**
 * Datas e unidade de envio tiradas do andamento (histórico) de cada processo. O SEI não mostra isso na lista:
 * a grade só sabe se consultar o andamento processo a processo (`andamentos/coletar.ts`) e guardar o resultado.
 * Aqui ficam só as regras puras: do texto do andamento para os dados, e dos dados para as faixas do agrupamento.
 */
import { diferencaDias, type DataISO } from '../../../sei-comum/src/datas/dias';

/** O que importa de um andamento do SEI (mesma forma de `Andamento` do núcleo). */
export interface AndamentoSei {
  /** "dd/mm/aaaa hh:mm", como o SEI mostra. */
  data: string;
  unidade: string;
  /** Nome (descrição) da unidade, quando o histórico o traz. */
  unidadeNome?: string;
  usuario: string;
  descricao: string;
}

export interface DadosAndamento {
  /** Quando o processo foi gerado (autuado). */
  autuacao?: DataISO;
  /** Último "Processo recebido na unidade" / "Reabertura" nesta unidade (ou a autuação, se foi gerado aqui). */
  recebimento?: DataISO;
  /** Último envio feito por esta unidade. */
  envio?: DataISO;
  /** Unidade citada no último "Processo remetido pela unidade X" desta unidade. */
  unidadeEnvio?: string;
  /** Instante (ms) em que o andamento foi consultado: dele vem a validade do cache. */
  consultadoEm: number;
}

export type CampoData = 'autuacao' | 'recebimento' | 'envio';

/** "25/09/2026 14:03" -> "2026-09-25". Texto fora do formato vira `undefined`. */
export function dataDoAndamento(texto: string): DataISO | undefined {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})/.exec(texto.trim());
  return m ? (`${m[3]}-${m[2]}-${m[1]}` as DataISO) : undefined;
}

const RECEBIDO = ['Processo recebido na unidade', 'Reabertura do processo na unidade'];
const GERADO = /^Processo (?:p\u00FAblico|restrito|sigiloso) gerado/i;
const REMETIDO = /^Processo remetido pela unidade\s+(.+)$/i;

/**
 * `andamentos` vem do mais recente para o mais antigo. `minhaUnidade` é a sigla da unidade atual: só valem os
 * registros dela. Cada dado só existe quando o andamento o traz; o que falta fica de fora (nunca é chutado).
 */
export interface UnidadeAtual {
  sigla: string;
  nome?: string;
}

/**
 * A sigla do histórico nem sempre é a do cabeçalho (no SEI MJ o cabeçalho mostra "TESTE" e o histórico, "Uni-Teste"),
 * mas o nome da unidade é o mesmo nos dois: vale a sigla OU o nome.
 */
export function ehMinhaUnidade(a: AndamentoSei, minha: UnidadeAtual): boolean {
  if (a.unidade.trim() === minha.sigla.trim() && minha.sigla.trim()) return true;
  return !!minha.nome?.trim() && a.unidadeNome?.trim() === minha.nome.trim();
}

export function extrairDados(andamentos: AndamentoSei[], minhaUnidade: UnidadeAtual | string): Omit<DadosAndamento, 'consultadoEm'> {
  const minha: UnidadeAtual = typeof minhaUnidade === 'string' ? { sigla: minhaUnidade } : minhaUnidade;
  const r: Omit<DadosAndamento, 'consultadoEm'> = {};
  const geracoes = andamentos.filter((a) => GERADO.test(a.descricao.trim()));
  // A geração é única; se houver mais de uma linha, vale a mais antiga (a última da lista).
  const ger = geracoes[geracoes.length - 1];
  const dataGer = ger ? dataDoAndamento(ger.data) : undefined;
  if (dataGer) r.autuacao = dataGer;
  for (const a of andamentos) {
    if (!ehMinhaUnidade(a, minha)) continue;
    const desc = a.descricao.trim();
    const data = dataDoAndamento(a.data);
    if (!data) continue;
    if (!r.recebimento && (RECEBIDO.includes(desc) || GERADO.test(desc))) r.recebimento = data;
    if (!r.envio) {
      const m = REMETIDO.exec(desc);
      if (m) {
        r.envio = data;
        r.unidadeEnvio = m[1]!.trim();
      }
    }
  }
  return r;
}

/** Faixas de idade de uma data, para agrupar. */
export const FAIXAS_DATA = [
  ['hoje', 'Hoje'],
  ['semana', 'Nos últimos 7 dias'],
  ['mes', 'Nos últimos 30 dias'],
  ['trimestre', 'Nos últimos 90 dias'],
  ['antigo', 'Há mais de 90 dias'],
  ['sem', 'Sem informação'],
] as const;
export type FaixaData = (typeof FAIXAS_DATA)[number][0];

export function faixaDaData(data: DataISO | undefined, hoje: DataISO): FaixaData {
  if (!data) return 'sem';
  const d = diferencaDias(data, hoje);
  if (Number.isNaN(d) || d < 0) return 'sem';
  return d < 1 ? 'hoje' : d <= 7 ? 'semana' : d <= 30 ? 'mes' : d <= 90 ? 'trimestre' : 'antigo';
}

/** O cache vale 24 horas. */
export const VALIDADE_MS = 24 * 60 * 60_000;
export const estaValido = (d: DadosAndamento, agora: number): boolean => agora - d.consultadoEm >= 0 && agora - d.consultadoEm < VALIDADE_MS;
