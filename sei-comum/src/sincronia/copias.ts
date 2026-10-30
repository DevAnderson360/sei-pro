/**
 * Cópias diárias: uma por dia, de tudo o que o usuário tem no módulo, no
 * IndexedDB da extensão (banco do módulo); ficam as 14 mais recentes. É a rede
 * de segurança de tudo o resto (um colega que apagou o texto, uma importação
 * errada, a lixeira que venceu).
 *
 * Restaurar é do módulo (ele sabe o envelope), mas a regra é uma só e está em
 * `recarimbarAtivos`: traz de volta o que estava ATIVO na cópia, com carimbo
 * novo para vencer remoções posteriores, e deixa em paz o que entrou depois.
 */

import type { DataISO } from "../datas/dias";
import { noDeposito } from "./banco";
import type { Versionada } from "./entidade";

export const MAX_COPIAS = 14;

export interface Dono {
  host: string;
  login: string;
}

export interface Copia<E = unknown> {
  /** host|login|dia */
  id: string;
  dono: string;
  dia: DataISO;
  quando: number;
  /** Itens ativos na cópia (o que o diálogo mostra). */
  quantidade: number;
  envelope: E;
}

export interface ArmazemCopias<E = unknown> {
  listar(dono: Dono): Promise<Copia<E>[]>;
  gravar(c: Copia<E>): Promise<void>;
  apagar(id: string): Promise<void>;
}

export const chaveDono = (d: Dono): string => `${d.host}|${d.login.toLowerCase()}`;

const maisNovaPrimeiro = (a: { dia: DataISO }, b: { dia: DataISO }) => (a.dia < b.dia ? 1 : -1);

/** Faz a cópia de hoje, se ainda não há; `exportar` só roda quando vai mesmo copiar. */
export async function fazerCopiaDoDia<E>(
  armazem: ArmazemCopias<E>,
  dono: Dono,
  hoje: DataISO,
  quando: number,
  exportar: () => Promise<{ envelope: E; quantidade: number }>,
): Promise<boolean> {
  const existentes = await armazem.listar(dono);
  if (existentes.some((x) => x.dia === hoje)) return false;
  const { envelope, quantidade } = await exportar();
  await armazem.gravar({ id: `${chaveDono(dono)}|${hoje}`, dono: chaveDono(dono), dia: hoje, quando, quantidade, envelope });
  const sobra = [...existentes, { dia: hoje } as Copia<E>].sort(maisNovaPrimeiro).slice(MAX_COPIAS);
  for (const x of sobra) if (x.id) await armazem.apagar(x.id);
  return true;
}

/** Os ativos da lista, recarimbados (vencem as remoções feitas depois da cópia). */
export function recarimbarAtivos<T extends Versionada>(lista: readonly T[], c: { agora: number; dispositivo: string }): T[] {
  return lista.filter((x) => x.removidoEm === undefined).map((x) => ({ ...x, atualizadoEm: c.agora, dispositivo: c.dispositivo }));
}

/** Para os testes (e como recuo quando o IndexedDB falha). */
export function copiasEmMemoria<E = unknown>(): ArmazemCopias<E> {
  const dados = new Map<string, Copia<E>>();
  return {
    async listar(dono) {
      return [...dados.values()].filter((c) => c.dono === chaveDono(dono)).sort(maisNovaPrimeiro);
    },
    async gravar(c) {
      dados.set(c.id, structuredClone(c));
    },
    async apagar(id) {
      dados.delete(id);
    },
  };
}

/** O depósito "copias" do banco do módulo (banco.ts). */
export function copiasNoIndexedDB<E = unknown>(banco: string, fabrica?: IDBFactory): ArmazemCopias<E> {
  return {
    async listar(dono) {
      const todas = await noDeposito<Copia<E>[]>(
        banco,
        "copias",
        "readonly",
        (s) => s.index("dono").getAll(chaveDono(dono)) as IDBRequest<Copia<E>[]>,
        fabrica,
      );
      return todas.sort(maisNovaPrimeiro);
    },
    async gravar(c) {
      await noDeposito(banco, "copias", "readwrite", (s) => s.put(c), fabrica);
    },
    async apagar(id) {
      await noDeposito(banco, "copias", "readwrite", (s) => s.delete(id), fabrica);
    },
  };
}
