/**
 * Executa um movimento do quadro no SEI, em fila (um por vez: o SEI não gosta de duas gravações de marcador na
 * mesma sessão ao mesmo tempo). Em marcador, primeiro ACRESCENTA e depois remove: se a segunda parte falhar, o
 * processo fica com os dois (e tentamos desfazer o acréscimo) em vez de ficar sem nenhum.
 */
import type { Movimento } from '../modelo/quadro';

export interface DepsMover {
  marcador(protocolo: string, m: { marcador: string; texto?: string; remover?: boolean }): Promise<void>;
  atribuir(protocolo: string, usuario: string | null): Promise<void>;
}

export type ResultadoMover = { ok: true; desfazer: Movimento } | { ok: false; erro: string };

const msg = (e: unknown): string => (e instanceof Error ? e.message : String(e));

export function inverso(m: Movimento): Movimento {
  if (m.tipo === 'atribuicao') return { ...m, para: m.de, de: m.para };
  const volta: Movimento = { tipo: 'marcador', id: m.id, protocolo: m.protocolo };
  if (m.adicionar) volta.remover = m.adicionar;
  if (m.remover) {
    volta.adicionar = m.remover;
    if (m.texto) volta.texto = m.texto;
  }
  return volta;
}

export async function executarMovimento(m: Movimento, d: DepsMover): Promise<ResultadoMover> {
  try {
    if (m.tipo === 'atribuicao') {
      await d.atribuir(m.protocolo, m.para);
      return { ok: true, desfazer: inverso(m) };
    }
    if (m.adicionar) await d.marcador(m.protocolo, { marcador: m.adicionar, ...(m.texto ? { texto: m.texto } : {}) });
    if (m.remover) {
      try {
        await d.marcador(m.protocolo, { marcador: m.remover, remover: true });
      } catch (e) {
        if (m.adicionar) await d.marcador(m.protocolo, { marcador: m.adicionar, remover: true }).catch(() => undefined);
        throw e;
      }
    }
    return { ok: true, desfazer: inverso(m) };
  } catch (e) {
    return { ok: false, erro: msg(e) };
  }
}

/** Fila: cada movimento só começa quando o anterior terminou. */
export function criarFila(d: DepsMover) {
  let cauda: Promise<unknown> = Promise.resolve();
  return {
    mover(m: Movimento): Promise<ResultadoMover> {
      const r = cauda.then(() => executarMovimento(m, d));
      cauda = r.catch(() => undefined);
      return r;
    },
  };
}
