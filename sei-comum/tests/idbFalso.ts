/**
 * IndexedDB mínimo em memória, só o que `banco.ts` usa: open com upgrade,
 * depósitos com keyPath e índice, get/put/delete/getAll e a transação que
 * termina depois. Conta as atualizações de versão de cada banco.
 * `abortarProxima` faz a próxima transação abortar (como a cota excedida no
 * commit: só o evento `abort`, com o erro na transação, sem `complete` nem `error`).
 */

interface DepositoFalso {
  keyPath?: string;
  indices: Map<string, string>;
  dados: Map<unknown, unknown>;
}

interface BancoFalso {
  versao: number;
  depositos: Map<string, DepositoFalso>;
}

export function idbFalso(): {
  fabrica: IDBFactory;
  bancos: Map<string, BancoFalso>;
  atualizacoes: Map<string, number>;
  abortarProxima(nome?: string): void;
} {
  const bancos = new Map<string, BancoFalso>();
  const atualizacoes = new Map<string, number>();
  let abortar: string | null = null;
  const pedido = <T>(result: T) => ({ result });
  const fabrica = {
    open(nome: string, versao: number) {
      const r: { result?: unknown; error: null; onupgradeneeded?: () => void; onsuccess?: () => void; onerror?: () => void } = {
        error: null,
      };
      setTimeout(() => {
        const banco = bancos.get(nome) ?? { versao: 0, depositos: new Map<string, DepositoFalso>() };
        bancos.set(nome, banco);
        r.result = {
          objectStoreNames: { contains: (n: string) => banco.depositos.has(n) },
          createObjectStore(n: string, o?: { keyPath?: string }) {
            const dep: DepositoFalso = { keyPath: o?.keyPath, indices: new Map(), dados: new Map() };
            banco.depositos.set(n, dep);
            return { createIndex: (indice: string, campo: string) => dep.indices.set(indice, campo) };
          },
          transaction(n: string) {
            const dep = banco.depositos.get(n);
            if (!dep) throw new Error(`depósito inexistente: ${n}`);
            const loja = {
              get: (k: unknown) => pedido(structuredClone(dep.dados.get(k))),
              put: (v: Record<string, unknown>, k?: unknown) => {
                const chave = dep.keyPath ? v[dep.keyPath] : k;
                dep.dados.set(chave, structuredClone(v));
                return pedido(chave);
              },
              delete: (k: unknown) => {
                dep.dados.delete(k);
                return pedido(undefined);
              },
              index: (i: string) => ({
                getAll: (valor: unknown) =>
                  pedido(
                    [...dep.dados.values()]
                      .filter((x) => (x as Record<string, unknown>)[dep.indices.get(i) ?? ""] === valor)
                      .map((x) => structuredClone(x)),
                  ),
              }),
            };
            const t: {
              error: { name: string; message: string } | null;
              oncomplete?: () => void;
              onerror?: () => void;
              onabort?: () => void;
              objectStore: () => typeof loja;
            } = {
              error: null,
              objectStore: () => loja,
            };
            const aborta = abortar;
            abortar = null;
            setTimeout(() => {
              if (aborta === null) return t.oncomplete?.();
              t.error = { name: aborta, message: `transação abortada (${aborta})` };
              t.onabort?.();
            }, 0);
            return t;
          },
          close: () => undefined,
        };
        if (banco.versao < versao) {
          banco.versao = versao;
          atualizacoes.set(nome, (atualizacoes.get(nome) ?? 0) + 1);
          r.onupgradeneeded?.();
        }
        r.onsuccess?.();
      }, 0);
      return r;
    },
  };
  return {
    fabrica: fabrica as unknown as IDBFactory,
    bancos,
    atualizacoes,
    abortarProxima: (nome = "QuotaExceededError") => {
      abortar = nome;
    },
  };
}
