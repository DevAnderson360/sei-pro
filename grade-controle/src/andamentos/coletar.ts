/**
 * A fila que consulta o andamento de cada processo. Sem rede aqui: quem consulta é `consultar` (injetado), o que
 * deixa a fila testável. Poucas requisições simultâneas e uma pausa curta entre elas, para não pesar no SEI; a
 * coleta é cancelável e para sozinha quando o SEI deixa de responder (sessão caída ou erros em sequência).
 */
import type { DadosAndamento } from '../modelo/andamentos';

export type DadosColeta = Omit<DadosAndamento, 'consultadoEm'>;

export interface AlvoColeta {
  id: string;
}

export interface ProgressoColeta {
  feitos: number;
  total: number;
  /** Consultas que não deram dado (processo sigiloso, histórico indisponível...). */
  semDados: number;
}

export type MotivoParada = 'concluida' | 'cancelada' | 'sessao' | 'erros';

export interface ResultadoColeta {
  motivo: MotivoParada;
  progresso: ProgressoColeta;
}

export interface OpcoesColeta<A extends AlvoColeta> {
  alvos: A[];
  /** Devolve os dados, `null` se o processo não tem o que mostrar. Lance erro com `sessao: true` se a sessão caiu. */
  consultar(alvo: A, sinal: AbortSignal): Promise<DadosColeta | null>;
  /** Chamado a cada processo resolvido. `falhou`: a consulta deu erro (não vale guardar "sem dados" no cache). */
  aoResolver(alvo: A, dados: DadosColeta | null, progresso: ProgressoColeta, falhou: boolean): void;
  sinal: AbortSignal;
  simultaneas?: number;
  pausaMs?: number;
  /** Erros seguidos que interrompem a coleta. */
  limiteErros?: number;
  esperar?(ms: number): Promise<void>;
}

/** Erro que interrompe a coleta inteira (sessão expirada): não adianta insistir nos demais. */
export class ErroSessaoColeta extends Error {
  readonly sessao = true;
}

export const SIMULTANEAS = 2;
export const PAUSA_MS = 250;
export const LIMITE_ERROS = 5;

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export async function coletar<A extends AlvoColeta>(o: OpcoesColeta<A>): Promise<ResultadoColeta> {
  const fila = [...o.alvos];
  const espera = o.esperar ?? dormir;
  const progresso: ProgressoColeta = { feitos: 0, total: fila.length, semDados: 0 };
  let motivo: MotivoParada = 'concluida';
  let errosSeguidos = 0;
  const limite = o.limiteErros ?? LIMITE_ERROS;

  async function trabalhador() {
    while (motivo === 'concluida') {
      if (o.sinal.aborted) { motivo = 'cancelada'; return; }
      const alvo = fila.shift();
      if (!alvo) return;
      try {
        const dados = await o.consultar(alvo, o.sinal);
        errosSeguidos = 0;
        progresso.feitos += 1;
        if (!dados) progresso.semDados += 1;
        o.aoResolver(alvo, dados, { ...progresso }, false);
      } catch (e) {
        if (o.sinal.aborted) { motivo = 'cancelada'; return; }
        if ((e as { sessao?: boolean }).sessao) { motivo = 'sessao'; return; }
        errosSeguidos += 1;
        progresso.feitos += 1;
        progresso.semDados += 1;
        o.aoResolver(alvo, null, { ...progresso }, true);
        if (errosSeguidos >= limite) { motivo = 'erros'; return; }
      }
      if (fila.length) await espera(o.pausaMs ?? PAUSA_MS);
    }
  }

  await Promise.all(Array.from({ length: Math.max(1, o.simultaneas ?? SIMULTANEAS) }, () => trabalhador()));
  return { motivo, progresso };
}
