/**
 * Histórico de conversas, no IndexedDB da própria página do painel.
 *
 * Conversas novas guardam também o estado necessário para continuar o diálogo:
 * histórico enviado ao modelo, pseudônimos, uso e tarefas. Tudo permanece no
 * perfil local do navegador. Registros antigos, que têm somente a transcrição,
 * continuam disponíveis para leitura e exportação.
 *
 * Duas lojas: `conversas` guarda o resumo (título, data, gasto) e `itens`
 * guarda a transcrição. Assim a lista da tela não carrega megabytes de texto
 * para mostrar cinco linhas.
 *
 * Nada aqui é essencial: sem IndexedDB (janela anônima, perfil restrito), toda
 * função falha em silêncio e o agente segue funcionando sem histórico.
 */

import type { Pseudonimos } from "@nucleo/privacidade/anonimizar";
import type { Mensagem, RegistroUsoChamada, Tarefa, Uso } from "../motor/tipos";

export const VERSAO_ESTADO_CONVERSA = 1 as const;

export interface EstadoConversa {
  versao: typeof VERSAO_ESTADO_CONVERSA;
  historico: Mensagem[];
  transcricao: unknown[];
  uso: Uso;
  registrosUso: RegistroUsoChamada[];
  pseudonimos: ReturnType<Pseudonimos["exportar"]>;
  tarefas: Tarefa[];
}

export interface ResumoConversa {
  id: string;
  titulo: string;
  /** Última atualização, em ms. */
  quando: number;
  /** Host do SEI em que a conversa aconteceu. */
  host?: string;
  uso: Uso;
  mensagens: number;
  /** Ausente nos registros antigos, que são somente para leitura. */
  versaoEstado?: typeof VERSAO_ESTADO_CONVERSA;
}

export interface ConversaSalva extends ResumoConversa {
  itens: unknown[];
  estado?: EstadoConversa;
}

const BANCO = "agenteIA";
const RESUMOS = "conversas";
const ITENS = "itens";

function abrir(): Promise<IDBDatabase> {
  return new Promise((ok, erro) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => {
      const bd = pedido.result;
      if (!bd.objectStoreNames.contains(RESUMOS)) bd.createObjectStore(RESUMOS, { keyPath: "id" }).createIndex("quando", "quando");
      if (!bd.objectStoreNames.contains(ITENS)) bd.createObjectStore(ITENS, { keyPath: "id" });
    };
    pedido.onsuccess = () => ok(pedido.result);
    pedido.onerror = () => erro(pedido.error ?? new Error("IndexedDB indisponível."));
  });
}

/** Roda uma transação e devolve o resultado, fechando o banco no fim. */
async function transacao<T>(lojas: string[], modo: IDBTransactionMode, corpo: (t: IDBTransaction) => Promise<T> | T): Promise<T> {
  const bd = await abrir();
  try {
    const t = bd.transaction(lojas, modo);
    const valor = await corpo(t);
    await new Promise<void>((ok, erro) => {
      t.oncomplete = () => ok();
      t.onerror = t.onabort = () => erro(t.error ?? new Error("Transação recusada."));
    });
    return valor;
  } finally {
    bd.close();
  }
}

const comoPromessa = <T>(p: IDBRequest<T>): Promise<T> =>
  new Promise((ok, erro) => {
    p.onsuccess = () => ok(p.result);
    p.onerror = () => erro(p.error ?? new Error("Falha no IndexedDB."));
  });

export async function salvar(c: ConversaSalva): Promise<void> {
  const { itens, estado, ...dadosResumo } = c;
  const resumo: ResumoConversa = {
    ...dadosResumo,
    ...(estado ? { versaoEstado: estado.versao } : {}),
  };
  await transacao([RESUMOS, ITENS], "readwrite", (t) => {
    t.objectStore(RESUMOS).put(resumo);
    t.objectStore(ITENS).put({ id: c.id, itens, ...(estado ? { estado } : {}) });
  });
}

/** Resumos, do mais recente para o mais antigo. */
export async function listar(limite = 100): Promise<ResumoConversa[]> {
  return transacao([RESUMOS], "readonly", async (t) => {
    const todos = (await comoPromessa(t.objectStore(RESUMOS).getAll())) as ResumoConversa[];
    return todos.sort((a, b) => b.quando - a.quando).slice(0, limite);
  });
}

export async function obter(id: string): Promise<ConversaSalva | null> {
  return transacao([RESUMOS, ITENS], "readonly", async (t) => {
    const resumo = (await comoPromessa(t.objectStore(RESUMOS).get(id))) as ResumoConversa | undefined;
    if (!resumo) return null;
    const corpo = (await comoPromessa(t.objectStore(ITENS).get(id))) as { itens: unknown[]; estado?: EstadoConversa } | undefined;
    return { ...resumo, itens: corpo?.itens ?? [], ...(corpo?.estado ? { estado: corpo.estado } : {}) };
  });
}

/** Devolve o estado somente quando resumo e corpo usam o schema retomável atual. */
export function estadoRetomavel(c: ConversaSalva): EstadoConversa | null {
  const estado = c.estado;
  if (c.versaoEstado !== VERSAO_ESTADO_CONVERSA || estado?.versao !== VERSAO_ESTADO_CONVERSA) return null;
  if (!Array.isArray(estado.historico) || !Array.isArray(estado.transcricao) || !Array.isArray(estado.registrosUso) || !Array.isArray(estado.tarefas)) return null;
  return estado;
}

export async function remover(id: string): Promise<void> {
  await transacao([RESUMOS, ITENS], "readwrite", (t) => {
    t.objectStore(RESUMOS).delete(id);
    t.objectStore(ITENS).delete(id);
  });
}

export async function limpar(): Promise<void> {
  await transacao([RESUMOS, ITENS], "readwrite", (t) => {
    t.objectStore(RESUMOS).clear();
    t.objectStore(ITENS).clear();
  });
}

/** Apaga o que passou de `dias` (0 = guardar para sempre). Devolve quantas saíram. */
export async function podar(dias: number): Promise<number> {
  if (!dias) return 0;
  const limite = Date.now() - dias * 86_400_000;
  const velhas = (await listar(1000)).filter((c) => c.quando < limite);
  for (const c of velhas) await remover(c.id);
  return velhas.length;
}
