/**
 * O que o app pede a aba: os metodos do RPC, os argumentos conferidos (vem de dado compartilhado), a recusa de pedido de
 * outra unidade (Review Focus 8: a troca de unidade ou de usuario com o painel aberto nao grava na unidade antiga) e a
 * lista parcial de usuarios.
 */

import { areaMemoria } from "@comum/armazenamento/area";
import { ErroRpc } from "@comum/ponte/rpc";
import type { StatusSync } from "@comum/sincronia/motor";
import { escoposDaUnidade } from "../../src/modelo/escopo";
import { MENSAGEM_UNIDADE_MUDOU, processosDaCaixa, tratadoresDemandas } from "../../src/pagina/executor";
import type { ResultadoSincronizar } from "../../src/pagina/sincronia";
import { usuariosDaCaixa, usuariosDaUnidade } from "../../src/pagina/usuarios";
import { type ContextoDemandas, chaveDaAba } from "../../src/ponte/tipos";
import { RepositorioDemandas } from "../../src/repositorio";
import { checar, lanca, secao, telaSei } from "./util";

const CTX: ContextoDemandas = {
  host: "treinamento.sei.sp.gov.br",
  login: "pedro.soares",
  nome: "Pedro Soares",
  unidade: { id: "110000001", sigla: "TESTE", nome: "Teste" },
  versao: "4.1.5",
  temaEscuro: false,
};

const OK: StatusSync = { estado: "ok", quando: 1, pendente: false };
const RESULTADO: ResultadoSincronizar = {
  unidade: { d: OK, a: OK, h: OK },
  eu: null,
};

const codigoDoErro = async (f: () => unknown): Promise<string> => {
  const e = await lanca(async () => f());
  return e instanceof ErroRpc ? e.codigo : String(e);
};

export async function verificarExecutor(): Promise<void> {
  secao("executor: metodos do RPC e argumentos conferidos");
  const { doc } = telaSei("sei41/caixa.html");
  const aberturas: unknown[] = [];
  let usuariosPedidos = 0;
  const base = {
    doc,
    ctx: CTX,
    iframe: null,
    usuarios: async () => {
      usuariosPedidos += 1;
      return [{ login: "pedro.soares", nome: "Pedro Soares" }];
    },
    sincronia: null,
  };
  const t = tratadoresDemandas(base);
  checar(
    "os metodos do Demandas (e so eles, mais os do painel embutido)",
    ["contexto", "usuarios", "processosDaCaixa", "abrirProcesso", "sincronizarAgora", "apagarPessoal", "altura", "sobrepor", "aviso"].every(
      (m) => typeof t[m] === "function",
    ) &&
      !("conferirDocumento" in t) &&
      !("atividades" in t),
    Object.keys(t),
  );
  checar("contexto devolve o da aba", (await t.contexto?.(undefined)) === CTX);
  const us = (await t.usuarios?.(undefined)) as Array<{ login?: string }>;
  checar("usuarios chama a lista parcial", us.length === 1 && usuariosPedidos === 1);
  const caixa = processosDaCaixa(doc);
  checar(
    "processosDaCaixa le a caixa que esta na tela (sem requisicao)",
    caixa.length > 0 && caixa.every((p) => typeof p.protocolo === "string" && typeof p.sigiloso === "boolean"),
    caixa.length,
  );
  checar("processosDaCaixa pelo RPC", ((await t.processosDaCaixa!(undefined)) as unknown[]).length === caixa.length);

  // abrirProcesso: a pesquisa rapida da propria tela; os argumentos vem de dado compartilhado (Texto Padrao do colega).
  const recusado = async (args: unknown) => (await codigoDoErro(() => t.abrirProcesso?.(args))) === "ARGUMENTO_INVALIDO";
  checar(
    "protocolo com espaco no meio, aspas ou script: recusado",
    (await recusado({ protocolo: "1 2" })) && (await recusado({ protocolo: '1"><script>' })) && (await recusado({ protocolo: "" })),
  );
  checar("protocolo que nao e texto: recusado", (await recusado({ protocolo: 5 })) && (await recusado(null)));
  checar(
    "id nao numerico: recusado",
    (await recusado({ id: "12ab", protocolo: "99906.713-630.000032/2025-82" })) &&
      (await recusado({ id: 1e21, protocolo: "1.2" })) &&
      (await recusado({ id: {}, protocolo: "1.2" })),
  );
  void aberturas;

  secao("executor: o Abrir no painel do lateral (focarNoPainel)");
  checar("sem painel nesta aba: SEM_PAINEL", (await codigoDoErro(() => t.focarNoPainel?.({ id: "d1" }))) === "SEM_PAINEL");
  checar(
    "id invalido: recusado",
    (await codigoDoErro(() => t.focarNoPainel?.({ id: "" }))) === "ARGUMENTO_INVALIDO" &&
      (await codigoDoErro(() => t.focarNoPainel?.({ id: 7 }))) === "ARGUMENTO_INVALIDO" &&
      (await codigoDoErro(() => t.focarNoPainel?.(null))) === "ARGUMENTO_INVALIDO",
  );
  const focados: string[] = [];
  const comFoco = tratadoresDemandas({
    ...base,
    focarNoPainel: async (id) => {
      focados.push(id);
      return "navegou" as const;
    },
  });
  checar("com o foco da aba: repassa o id", (await comFoco.focarNoPainel?.({ id: "d1" })) === "navegou" && focados.join() === "d1");

  secao("executor: sincronia (SEM_SINCRONIA e a chave da unidade)");
  checar(
    "sincronizarAgora sem sincronia: SEM_SINCRONIA",
    (await codigoDoErro(() => t.sincronizarAgora?.({ chave: chaveDaAba(CTX) }))) === "SEM_SINCRONIA",
  );
  checar(
    "apagarPessoal sem sincronia: SEM_SINCRONIA",
    (await codigoDoErro(() => t.apagarPessoal?.({ chave: chaveDaAba(CTX) }))) === "SEM_SINCRONIA",
  );

  // Uma sincronia falsa que grava num repositorio da unidade DESTA aba: o pedido de outra chave nao pode chegar a ela.
  const area = areaMemoria();
  const esc = escoposDaUnidade(CTX.host, CTX.login, "110000001");
  const repo = new RepositorioDemandas(area, esc.unidade, () => ({
    agora: 1_790_000_000_000,
    dispositivo: "d",
    por: "pedro.soares",
    nome: "Pedro",
  }));
  let rodadas = 0;
  let apagadas = 0;
  const comSincronia = tratadoresDemandas({
    ...base,
    sincronia: {
      agora: async () => {
        rodadas += 1;
        await repo.criar({ titulo: "gravada por uma rodada", prazo: "2026-12-01" });
        return RESULTADO;
      },
      apagarPessoal: async () => {
        apagadas += 1;
        return true;
      },
    },
  });
  const semChave1 = await lanca(async () => comSincronia.sincronizarAgora?.(undefined));
  const semChave2 = await lanca(async () => comSincronia.sincronizarAgora?.({}));
  const semChave3 = await lanca(async () => comSincronia.apagarPessoal?.(undefined));
  checar(
    "sem a chave da aba: recusado, e nada roda",
    [semChave1, semChave2, semChave3].every((e) => e instanceof ErroRpc && e.codigo === "UNIDADE_MUDOU") && rodadas === 0 && apagadas === 0,
  );
  checar("com a chave desta aba: roda", (await comSincronia.sincronizarAgora?.({ chave: chaveDaAba(CTX) })) === RESULTADO && rodadas === 1);
  checar(
    "com a chave desta aba, de novo: roda",
    (await comSincronia.sincronizarAgora?.({ chave: chaveDaAba(CTX) })) === RESULTADO && rodadas === 2,
  );
  const antiga = chaveDaAba({ ...CTX, unidade: { id: "999", sigla: "OUTRA", nome: "Outra" } });
  const outroUsuario = chaveDaAba({ ...CTX, login: "ana" });
  const gravadasAntes = (await repo.dados()).length;
  const e1 = await lanca(async () => comSincronia.sincronizarAgora?.({ chave: antiga }));
  const e2 = await lanca(async () => comSincronia.sincronizarAgora?.({ chave: outroUsuario }));
  const e3 = await lanca(async () => comSincronia.apagarPessoal?.({ chave: antiga }));
  const e4 = await lanca(async () => comSincronia.sincronizarAgora?.({ chave: 5 }));
  checar(
    "chave de outra unidade ou de outro usuario: recusada com o aviso, e nada e gravado",
    [e1, e2, e3, e4].every((e) => e instanceof ErroRpc && e.codigo === "UNIDADE_MUDOU" && e.message === MENSAGEM_UNIDADE_MUDOU) &&
      rodadas === 2 &&
      apagadas === 0 &&
      (await repo.dados()).length === gravadasAntes,
    { rodadas, apagadas },
  );
  checar("a chave com a unidade nova tem outra forma (o lateral remonta)", antiga !== chaveDaAba(CTX) && outroUsuario !== chaveDaAba(CTX));
  checar(
    "apagarPessoal com a chave desta aba: roda",
    (await comSincronia.apagarPessoal?.({ chave: chaveDaAba(CTX) })) === true && apagadas === 1,
  );

  secao("executor: usuarios parciais (a caixa, os ja usados e eu; nada le a arvore)");
  const daCaixa = usuariosDaCaixa(doc);
  checar(
    "atribuicoes da caixa (login e nome)",
    daCaixa.length === 2 && daCaixa.some((u) => u.login === "pedro.soares" && u.nome === "Pedro Soares"),
    daCaixa,
  );
  const areaU = areaMemoria();
  const lista = await usuariosDaUnidade({
    area: areaU,
    chave: "projetos/usuarios/x|u:1",
    agora: 1_000,
    daCaixa: [{ login: "bruno", nome: "Bruno Reis" }],
    usados: [{ nome: "Dora Alves" }, { login: "Carla", nome: "Carla Dias" }],
    eu: { login: "ana", nome: "Ana Lima" },
    buscarCompleta: null,
  });
  checar(
    "eu primeiro, depois a caixa e os usados, sem repetir",
    lista.map((u) => u.login ?? u.nome).join() === "ana,bruno,carla,Dora Alves",
    lista,
  );
}
