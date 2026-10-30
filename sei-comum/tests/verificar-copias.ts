import { abrirBanco, noDeposito } from "../src/sincronia/banco";
import { type Copia, copiasEmMemoria, copiasNoIndexedDB, fazerCopiaDoDia, recarimbarAtivos } from "../src/sincronia/copias";
import { idbFalso } from "./idbFalso";
import { checar, secao, tique } from "./util";

const dono = { host: "sei.exemplo.gov.br", login: "Pedro" };

export async function verificarBancoECopias(): Promise<void> {
  secao("copias diarias");
  const copias = copiasEmMemoria<{ itens: number }>();
  let exportacoes = 0;
  const exportar = async () => {
    exportacoes++;
    return { envelope: { itens: 3 }, quantidade: 3 };
  };
  checar("primeira do dia: copia", await fazerCopiaDoDia(copias, dono, "2026-10-01", 1, exportar));
  checar(
    "segunda no mesmo dia: nao duplica, e nem exporta",
    !(await fazerCopiaDoDia(copias, dono, "2026-10-01", 2, exportar)) && exportacoes === 1,
  );
  for (let d = 2; d <= 20; d++) await fazerCopiaDoDia(copias, dono, `2026-10-${String(d).padStart(2, "0")}`, d, exportar);
  const lista = await copias.listar(dono);
  checar(
    "guarda as 14 mais recentes, a mais nova primeiro",
    lista.length === 14 && lista[0]?.dia === "2026-10-20" && lista.at(-1)?.dia === "2026-10-07",
    lista.map((c) => c.dia),
  );
  checar(
    "id e dono por host|login (login sem caixa)",
    lista[0]?.id === "sei.exemplo.gov.br|pedro|2026-10-20" && lista[0]?.quantidade === 3,
  );
  checar("outro dono nao ve", (await copias.listar({ host: dono.host, login: "ana" })).length === 0);
  const itens = [
    { id: "1", atualizadoEm: 1, dispositivo: "A" },
    { id: "2", atualizadoEm: 1, dispositivo: "A", removidoEm: 1 },
  ];
  const recarimbados = recarimbarAtivos(itens, { agora: 99, dispositivo: "B" });
  checar(
    "restaurar: so os ativos, recarimbados (vencem remocoes posteriores)",
    recarimbados.length === 1 &&
      recarimbados[0]?.atualizadoEm === 99 &&
      recarimbados[0]?.dispositivo === "B" &&
      itens[0]?.atualizadoEm === 1,
  );

  secao("IndexedDB: um banco por modulo");
  const idb = idbFalso();
  const doProjetos = copiasNoIndexedDB<{ x: number }>("seipro-projetos", idb.fabrica);
  await doProjetos.gravar({
    id: "sei.exemplo.gov.br|pedro|2026-10-06",
    dono: "sei.exemplo.gov.br|pedro",
    dia: "2026-10-06",
    quando: 1,
    quantidade: 1,
    envelope: { x: 1 },
  });
  await doProjetos.gravar({
    id: "sei.exemplo.gov.br|pedro|2026-10-07",
    dono: "sei.exemplo.gov.br|pedro",
    dia: "2026-10-07",
    quando: 2,
    quantidade: 1,
    envelope: { x: 2 },
  });
  const doBanco = await doProjetos.listar(dono);
  checar(
    "grava e lista pelo dono, a mais nova primeiro",
    doBanco.map((c) => c.dia).join() === "2026-10-07,2026-10-06" && doBanco[0]?.envelope.x === 2,
  );
  const banco = idb.bancos.get("seipro-projetos");
  checar(
    "banco do modulo, versao 1, com os dois depositos",
    banco?.versao === 1 && banco.depositos.has("copias") && banco.depositos.has("arquivos") && !idb.bancos.has("seipro-favoritos"),
  );
  await doProjetos.apagar("sei.exemplo.gov.br|pedro|2026-10-06");
  checar("apagar", (await doProjetos.listar(dono)).length === 1);

  secao("IndexedDB: o banco que os Favoritos ja tem nao migra");
  const antigo: Copia<{ favoritos: number }> = {
    id: "sei.exemplo.gov.br|pedro|2026-09-30",
    dono: "sei.exemplo.gov.br|pedro",
    dia: "2026-09-30",
    quando: 1,
    quantidade: 5,
    envelope: { favoritos: 5 },
  };
  (await abrirBanco("seipro-favoritos", idb.fabrica)).close();
  await noDeposito("seipro-favoritos", "copias", "readwrite", (s) => s.put(antigo), idb.fabrica);
  const lidas = await copiasNoIndexedDB<{ favoritos: number }>("seipro-favoritos", idb.fabrica).listar(dono);
  checar(
    "abrir de novo acha a copia antiga e nao roda upgrade",
    lidas[0]?.envelope.favoritos === 5 && idb.atualizacoes.get("seipro-favoritos") === 1,
    idb.atualizacoes,
  );

  secao("IndexedDB: transacao abortada (cota excedida) rejeita, nao fica pendurada");
  const idb2 = idbFalso();
  idb2.abortarProxima();
  const desfecho = await Promise.race([
    noDeposito("seipro-teste", "copias", "readwrite", (s) => s.put({ id: "x" }), idb2.fabrica).then(
      () => "resolveu",
      (e: { name?: string } | null) => `rejeitou:${e?.name}`,
    ),
    tique(50).then(() => "pendurada"),
  ]);
  checar("a promessa rejeita com o erro da transacao", desfecho === "rejeitou:QuotaExceededError", desfecho);
  const copiasDepois = copiasNoIndexedDB<{ x: number }>("seipro-teste", idb2.fabrica);
  const falha = await copiasDepois
    .gravar({ id: "h|p|2026-10-06", dono: "h|p", dia: "2026-10-06", quando: 1, quantidade: 1, envelope: { x: 1 } })
    .then(
      () => null,
      (e: unknown) => e,
    );
  checar("a transacao seguinte grava normalmente", falha === null && (await copiasDepois.listar({ host: "h", login: "p" })).length === 1);

  secao("IndexedDB: banco bloqueado por outra aba rejeita com mensagem clara, nao fica pendurado");
  let fechados = 0;
  const bloqueada = {
    open() {
      const r: { result?: unknown; onblocked?: () => void; onsuccess?: () => void } = {};
      setTimeout(() => r.onblocked?.(), 1);
      // A outra aba fecha depois: o banco abre tarde e tem de ser fechado (ninguém mais o espera).
      setTimeout(() => {
        r.result = { close: () => void fechados++ };
        r.onsuccess?.();
      }, 20);
      return r;
    },
  } as unknown as IDBFactory;
  const bloqueio = await Promise.race([
    abrirBanco("seipro-teste", bloqueada).then(
      () => "resolveu",
      (e: { message?: string } | null) => `rejeitou:${e?.message}`,
    ),
    tique(10).then(() => "pendurada"),
  ]);
  checar(
    "o bloqueio rejeita com o que fazer",
    bloqueio ===
      "rejeitou:O banco de cópias deste navegador está ocupado por outra janela do SEI Pro. Feche as outras abas do SEI e tente de novo.",
    bloqueio,
  );
  await tique(30);
  checar("o banco que abre depois do bloqueio e fechado", fechados === 1, fechados);
}
