/**
 * O `chrome.storage` como o Chrome entrega: o `onChanged` chega depois, com
 * `{ newValue, oldValue }` por chave (sem `oldValue` na chave nova, sem
 * `newValue` na chave removida) e o nome da área. As provas que precisam do
 * caminho de produção passam por aqui e pelo `areaChrome` real: o
 * `areaMemoria` já fala `{ novo, antigo }` e esconde a tradução.
 *
 * Instala um `chrome` global (guardando o anterior): `restaurar()` no fim, depois
 * de parar os ouvintes (o `areaChrome` tira o ouvinte pelo `chrome` global).
 */

import { type Area, areaChrome } from "../src/armazenamento/area";

type Mudancas = Record<string, chrome.storage.StorageChange>;
type Ouvinte = (m: Mudancas, area: string) => void;

export interface ChromeFalso {
  local: Area;
  sync: Area;
  session: Area;
  /** O que o falso entregou ao `onChanged`, cru (a prova confere o formato do Chrome). */
  entregues: Array<{ area: string; mudancas: Mudancas }>;
  ouvintes(): number;
  restaurar(): void;
}

export function instalarChromeStorage(): ChromeFalso {
  const ouvintes = new Set<Ouvinte>();
  const entregues: ChromeFalso["entregues"] = [];
  const areaFalsa = (nome: string): chrome.storage.StorageArea => {
    const dados = new Map<string, unknown>();
    const avisar = (m: Mudancas) => {
      if (!Object.keys(m).length) return;
      entregues.push({ area: nome, mudancas: structuredClone(m) });
      // O Chrome avisa depois de gravar, cada ouvinte com a sua cópia.
      setTimeout(() => {
        for (const o of [...ouvintes]) o(structuredClone(m), nome);
      }, 0);
    };
    const lista = (chaves: unknown): string[] =>
      chaves === null || chaves === undefined ? [...dados.keys()] : typeof chaves === "string" ? [chaves] : (chaves as string[]);
    return {
      get: async (chaves?: unknown) => {
        const saida: Record<string, unknown> = {};
        for (const k of lista(chaves)) if (dados.has(k)) saida[k] = structuredClone(dados.get(k));
        return saida;
      },
      set: async (itens: Record<string, unknown>) => {
        const m: Mudancas = {};
        for (const [k, v] of Object.entries(itens)) {
          const c: chrome.storage.StorageChange = { newValue: structuredClone(v) };
          if (dados.has(k)) c.oldValue = structuredClone(dados.get(k));
          m[k] = c;
          dados.set(k, structuredClone(v));
        }
        avisar(m);
      },
      remove: async (chaves: string | string[]) => {
        const m: Mudancas = {};
        for (const k of typeof chaves === "string" ? [chaves] : chaves) {
          if (!dados.has(k)) continue;
          m[k] = { oldValue: structuredClone(dados.get(k)) };
          dados.delete(k);
        }
        avisar(m);
      },
    } as unknown as chrome.storage.StorageArea;
  };
  const g = globalThis as { chrome?: unknown };
  const anterior = g.chrome;
  const local = areaFalsa("local");
  const sync = areaFalsa("sync");
  const session = areaFalsa("session");
  g.chrome = {
    ...((anterior as object | undefined) ?? {}),
    storage: {
      local,
      sync,
      session,
      onChanged: {
        addListener: (o: Ouvinte) => void ouvintes.add(o),
        removeListener: (o: Ouvinte) => void ouvintes.delete(o),
        hasListener: (o: Ouvinte) => ouvintes.has(o),
      },
    },
  };
  return {
    local: areaChrome(local, "local"),
    sync: areaChrome(sync, "sync"),
    session: areaChrome(session, "session"),
    entregues,
    ouvintes: () => ouvintes.size,
    restaurar: () => {
      g.chrome = anterior;
    },
  };
}
