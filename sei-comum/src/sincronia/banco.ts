/**
 * O IndexedDB da extensão (origem chrome-extension://): UM BANCO POR MÓDULO
 * (`seipro-favoritos`, `seipro-projetos`), versão 1, com dois depósitos:
 * `copias` (as cópias diárias, chave `id`, índice `dono`) e `arquivos` (o
 * handle do arquivo sincronizado, chave `host|login`). É exatamente o banco
 * que os Favoritos já tinham: abrir de novo com o mesmo nome não migra nada.
 *
 * Abre e fecha a cada operação (são poucas, e um banco aberto preso numa aba
 * impediria a próxima versão de criar depósitos).
 */

export const VERSAO_BANCO = 1;
export type Deposito = "copias" | "arquivos";

export const MENSAGEM_BANCO_BLOQUEADO =
  "O banco de cópias deste navegador está ocupado por outra janela do SEI Pro. Feche as outras abas do SEI e tente de novo.";

/**
 * Abre o banco do módulo. Outra conexão aberta numa versão antiga BLOQUEIA a abertura (`blocked`): em vez de
 * esperar sem prazo, rejeita com o que fazer; se o banco abrir depois, é fechado (ninguém mais o espera).
 */
export function abrirBanco(nome: string, fabrica: IDBFactory = globalThis.indexedDB): Promise<IDBDatabase> {
  return new Promise<IDBDatabase>((ok, erro) => {
    let desistiu = false;
    const r = fabrica.open(nome, VERSAO_BANCO);
    r.onupgradeneeded = () => {
      const db = r.result;
      if (!db.objectStoreNames.contains("copias")) db.createObjectStore("copias", { keyPath: "id" }).createIndex("dono", "dono");
      if (!db.objectStoreNames.contains("arquivos")) db.createObjectStore("arquivos");
    };
    r.onblocked = () => {
      desistiu = true;
      erro(new Error(MENSAGEM_BANCO_BLOQUEADO));
    };
    r.onsuccess = () => {
      if (desistiu) r.result.close();
      else ok(r.result);
    };
    r.onerror = () => erro(r.error);
  });
}

/**
 * Uma operação num depósito, numa transação própria; resolve quando a transação termina.
 * Rejeita no erro e também no abort (a cota excedida aborta a transação sem `error`).
 */
export function noDeposito<T>(
  nome: string,
  deposito: Deposito,
  modo: IDBTransactionMode,
  fazer: (s: IDBObjectStore) => IDBRequest<T>,
  fabrica?: IDBFactory,
): Promise<T> {
  return abrirBanco(nome, fabrica).then(
    (db) =>
      new Promise<T>((ok, erro) => {
        const t = db.transaction(deposito, modo);
        const r = fazer(t.objectStore(deposito));
        t.oncomplete = () => {
          ok(r.result);
          db.close();
        };
        t.onerror = () => {
          erro(t.error);
          db.close();
        };
        t.onabort = () => {
          erro(t.error ?? new Error("A transação do IndexedDB foi abortada."));
          db.close();
        };
      }),
  );
}
