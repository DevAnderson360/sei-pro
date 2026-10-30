/**
 * Acoes depois da criacao, lado da aba: o que `posAcaoOpcoes`, `posAcao` e `posAcaoBloco` devolvem ao app.
 *
 * As funcoes do nucleo entram pelo `chamadasPosAcao` do executor, entao cada desfecho (sucesso, "ja estava",
 * erro, sessao expirada, excecao depois do POST) e forcado sem rede, e cada chamada e contada: linha sem
 * `idProcedimento` nao pode gerar nenhuma.
 */

import type { ResultadoEscrita } from "@nucleo/dominio/escrita";
import { ErroSei } from "@nucleo/sessao/erros";
import type { ContextoLote } from "../src/pagina/contexto";
import { tratadoresProcessosLote } from "../src/pagina/executor";
import type { ChamadasPosAcao } from "../src/pagina/posAcao";
import { checar, igual, secao } from "./util";

const CTX: ContextoLote = { host: "sei.x.gov.br", login: "ana", temaEscuro: false, base: "https://sei.x.gov.br/sei/" };
const SESSAO = () => new ErroSei("SEI_SESSAO_EXPIRADA", "Sessão expirada.");

interface Registro {
  nome: string;
  args: unknown[];
}

/** Monta os tratadores com o nucleo falso; `impl` sobrescreve so o que a prova precisa. */
function montar(impl: Partial<ChamadasPosAcao> = {}) {
  const chamadas: Registro[] = [];
  const nunca = (nome: string) =>
    (async (...args: unknown[]) => {
      chamadas.push({ nome, args });
      throw new Error(`${nome} nao devia ser chamado`);
    }) as never;
  const base: ChamadasPosAcao = {
    definirMarcador: nunca("definirMarcador"),
    definirAcompanhamento: nunca("definirAcompanhamento"),
    listarOpcoes: nunca("listarOpcoes"),
    listarBlocosInternosParaProcessos: nunca("listarBlocosInternosParaProcessos"),
    incluirProcessosEmBlocoInterno: nunca("incluirProcessosEmBlocoInterno"),
  };
  const contadas = Object.fromEntries(
    Object.entries({ ...base, ...impl }).map(([nome, fn]) => [
      nome,
      (...args: unknown[]) => {
        if (nome in impl) chamadas.push({ nome, args });
        return (fn as (...a: unknown[]) => unknown)(...args);
      },
    ]),
  ) as unknown as ChamadasPosAcao;
  const t = tratadoresProcessosLote({ sei: {} as never, ctx: CTX, abrirLinkPermanente: () => {}, chamadasPosAcao: contadas });
  return { t, chamadas };
}

const escrita = (r: Partial<ResultadoEscrita>): ResultadoEscrita => ({
  alvo: "00001.000001/2026-11",
  mudancas: [],
  aplicado: false,
  resumo: "",
  ...r,
});
const PROC = { protocolo: "00001.000001/2026-11", idProcedimento: "55" };

export async function verificarPosAcao(): Promise<void> {
  secao("Pos-acao: linha incerta nunca vai ao SEI");
  {
    const { t, chamadas } = montar({ definirMarcador: async () => escrita({ aplicado: true }) });
    const r1 = (await t.posAcao({ acao: "marcador", protocolo: PROC.protocolo, idProcedimento: "", marcador: "Urgente" })) as Record<
      string,
      unknown
    >;
    checar("idProcedimento vazio => erro", r1.situacao === "erro" && typeof r1.mensagem === "string" && !!r1.mensagem, r1);
    const r2 = (await t.posAcao({ acao: "marcador", protocolo: "  ", idProcedimento: "55", marcador: "Urgente" })) as Record<
      string,
      unknown
    >;
    checar("protocolo vazio => erro", r2.situacao === "erro", r2);
    const r3 = (await t.posAcao({ acao: "acompanhar", protocolo: PROC.protocolo })) as Record<string, unknown>;
    checar("idProcedimento ausente => erro", r3.situacao === "erro", r3);
    const r4 = (await t.posAcao({ acao: "bloco", ...PROC })) as Record<string, unknown>;
    checar("acao desconhecida (bloco nao passa por aqui) => erro", r4.situacao === "erro", r4);
    const r5 = (await t.posAcao({ acao: "marcador", ...PROC, marcador: "" })) as Record<string, unknown>;
    checar("marcador sem nome => erro", r5.situacao === "erro", r5);
    const r6 = (await t.posAcao(undefined)) as Record<string, unknown>;
    checar("sem argumentos => erro", r6.situacao === "erro", r6);
    igual("zero chamadas ao nucleo", chamadas.length, 0);
  }

  secao("Pos-acao: marcador");
  {
    const { t, chamadas } = montar({
      definirMarcador: async () =>
        escrita({ aplicado: true, mudancas: [{ campo: "Marcador", antes: "", depois: "Urgente" }], resumo: "Marcador aplicado." }),
    });
    const r = await t.posAcao({ acao: "marcador", ...PROC, marcador: "Urgente", texto: "ver hoje" });
    igual("aplicado => ok com o resumo", r, { situacao: "ok", mensagem: "Marcador aplicado." });
    igual("uma chamada", chamadas.length, 1);
    const [, ref, m, op] = chamadas[0].args as [unknown, string, Record<string, unknown>, Record<string, unknown>];
    igual("pelo protocolo, com aplicar", [ref, m, op], [PROC.protocolo, { marcador: "Urgente", texto: "ver hoje" }, { aplicar: true }]);
  }
  {
    const { t, chamadas } = montar({ definirMarcador: async () => escrita({ resumo: "Nada a alterar: o marcador já está assim." }) });
    const r = await t.posAcao({ acao: "marcador", ...PROC, marcador: "Urgente" });
    igual("ja igual => ja-estava", r, { situacao: "ja-estava", mensagem: "Nada a alterar: o marcador já está assim." });
    const m = (chamadas[0].args as unknown[])[2] as Record<string, unknown>;
    checar("sem texto: nao manda texto (o nucleo conserva o atual)", !("texto" in m), m);
  }
  {
    const { t } = montar({
      definirMarcador: async () => escrita({ mudancas: [{ campo: "Marcador", antes: "", depois: "X" }], resumo: "Vai marcar." }),
    });
    const r = (await t.posAcao({ acao: "marcador", ...PROC, marcador: "X" })) as Record<string, unknown>;
    checar("nao aplicado com mudancas => erro", r.situacao === "erro", r);
  }
  {
    const { t } = montar({
      definirMarcador: async () => {
        throw new ErroSei("SEI_NAO_ENCONTRADO", "Marcador não existe.");
      },
    });
    const r = await t.posAcao({ acao: "marcador", ...PROC, marcador: "Sumiu" });
    igual("erro do nucleo => erro com a mensagem, sem parar", r, { situacao: "erro", mensagem: "Marcador não existe." });
  }
  {
    const { t } = montar({
      definirMarcador: async () => {
        throw SESSAO();
      },
    });
    const r = await t.posAcao({ acao: "marcador", ...PROC, marcador: "Urgente" });
    igual("sessao expirada => parar", r, { situacao: "erro", mensagem: "Sessão expirada.", parar: true });
  }
  {
    const { t } = montar({
      definirMarcador: async () => {
        throw "texto solto";
      },
    });
    const r = (await t.posAcao({ acao: "marcador", ...PROC, marcador: "Urgente" })) as Record<string, unknown>;
    checar("excecao que nao e Error vira erro em JSON", r.situacao === "erro" && r.mensagem === "texto solto" && !("parar" in r), r);
  }

  secao("Pos-acao: acompanhar");
  {
    const { t, chamadas } = montar({
      definirAcompanhamento: async () =>
        escrita({ aplicado: true, mudancas: [{ campo: "Grupo", antes: "", depois: "G" }], resumo: "Acompanhamento registrado." }),
    });
    const r = await t.posAcao({ acao: "acompanhar", ...PROC, grupo: "G", observacao: "obs" });
    igual("aplicado => ok", r, { situacao: "ok", mensagem: "Acompanhamento registrado." });
    const [, ref, a, op] = chamadas[0].args as [unknown, string, unknown, unknown];
    igual("argumentos", [ref, a, op], [PROC.protocolo, { grupo: "G", observacao: "obs" }, { aplicar: true }]);
  }
  {
    const { t, chamadas } = montar({ definirAcompanhamento: async () => escrita({ resumo: "Nada a alterar: já está assim." }) });
    const r = await t.posAcao({ acao: "acompanhar", ...PROC });
    igual("ja acompanhado igual => ja-estava", r, { situacao: "ja-estava", mensagem: "Nada a alterar: já está assim." });
    igual("sem grupo nem observacao: objeto vazio", (chamadas[0].args as unknown[])[2], {});
  }
  {
    const { t } = montar({
      definirAcompanhamento: async () => {
        throw SESSAO();
      },
    });
    const r = await t.posAcao({ acao: "acompanhar", ...PROC, grupo: "G" });
    igual("sessao expirada => parar", r, { situacao: "erro", mensagem: "Sessão expirada.", parar: true });
  }
  {
    const { t } = montar({
      definirAcompanhamento: async () => {
        throw new ErroSei("SEI_ACAO_INDISPONIVEL", "Sem acompanhamento.");
      },
    });
    const r = await t.posAcao({ acao: "acompanhar", ...PROC, grupo: "G" });
    igual("erro => erro", r, { situacao: "erro", mensagem: "Sem acompanhamento." });
  }

  secao("Pos-acao: bloco");
  {
    const { t, chamadas } = montar({
      incluirProcessosEmBlocoInterno: async () => [
        { idProcedimento: "55", situacao: "incluido" },
        { idProcedimento: "56", situacao: "ja-estava" },
        { idProcedimento: "57", situacao: "fora-da-pagina" },
        { idProcedimento: "58", situacao: "erro", erro: "Processo sigiloso." },
        { idProcedimento: "59", situacao: "nao-confirmado", erro: "Não confirmado: confira o bloco 12." },
      ],
    });
    const r = (await t.posAcaoBloco({ idBloco: " 9 ", idsProcedimento: ["55", "56", "57", "58", "59"] })) as {
      resultados: Array<Record<string, unknown>>;
      parar?: boolean;
    };
    igual("uma chamada so (um POST para todos)", chamadas.length, 1);
    igual("bloco e ids repassados", (chamadas[0].args as unknown[]).slice(1), ["9", ["55", "56", "57", "58", "59"]]);
    igual(
      "situacoes 1:1",
      r.resultados.map((x) => [x.idProcedimento, x.situacao]),
      [
        ["55", "incluido"],
        ["56", "ja-estava"],
        ["57", "fora-da-pagina"],
        ["58", "erro"],
        ["59", "nao-confirmado"],
      ],
    );
    checar("sem parar", !("parar" in r), r);
    checar("erro leva a mensagem do nucleo", r.resultados[3].mensagem === "Processo sigiloso.", r.resultados[3]);
    checar("nao-confirmado leva a mensagem do nucleo", r.resultados[4].mensagem === "Não confirmado: confira o bloco 12.", r.resultados[4]);
    checar(
      "fora-da-pagina ganha uma mensagem",
      typeof r.resultados[2].mensagem === "string" && !!r.resultados[2].mensagem,
      r.resultados[2],
    );
    checar("incluido sem mensagem", !("mensagem" in r.resultados[0]), r.resultados[0]);
    checar("JSON simples", JSON.stringify(JSON.parse(JSON.stringify(r))) === JSON.stringify(r));
  }
  {
    const { t, chamadas } = montar({ incluirProcessosEmBlocoInterno: async () => [] });
    const r1 = (await t.posAcaoBloco({ idBloco: "9", idsProcedimento: ["", " "] })) as { resultados: Array<Record<string, unknown>> };
    checar(
      "so ids vazios => um erro por entrada, nada enviado",
      r1.resultados.length === 2 &&
        r1.resultados.every(
          (x) => x.idProcedimento === "" && x.situacao === "erro" && String(x.mensagem).includes("Processo sem número confirmado"),
        ),
      r1,
    );
    const r2 = (await t.posAcaoBloco({ idBloco: "", idsProcedimento: ["55"] })) as { resultados: Array<Record<string, unknown>> };
    igual(
      "bloco vazio => erro",
      r2.resultados.map((x) => [x.idProcedimento, x.situacao]),
      [["55", "erro"]],
    );
    const r3 = (await t.posAcaoBloco({ idBloco: "9", idsProcedimento: [] })) as { resultados: unknown[] };
    igual("lista vazia => nada", r3.resultados, []);
    const r4 = (await t.posAcaoBloco({ idBloco: "9", idsProcedimento: "55" })) as { resultados: unknown[] };
    igual("ids que nao sao lista => nada", r4.resultados, []);
    igual("zero chamadas ao nucleo", chamadas.length, 0);
  }
  {
    // Id vazio no meio: so os validos vao ao nucleo; o vazio vira erro e continua na resposta.
    const { t, chamadas } = montar({ incluirProcessosEmBlocoInterno: async () => [{ idProcedimento: "55", situacao: "incluido" }] });
    const r = (await t.posAcaoBloco({ idBloco: "9", idsProcedimento: ["55", "", "56"] })) as { resultados: Array<Record<string, unknown>> };
    igual("so os ids nao vazios vao ao nucleo", (chamadas[0]?.args as unknown[] | undefined)?.slice(1), ["9", ["55", "56"]]);
    igual(
      "vazio vira erro; o que o nucleo nao devolveu vira nao-confirmado",
      r.resultados.map((x) => [x.idProcedimento, x.situacao]),
      [
        ["55", "incluido"],
        ["", "erro"],
        ["56", "nao-confirmado"],
      ],
    );
    checar("erro do vazio diz por que", String(r.resultados[1]?.mensagem).includes("Processo sem número confirmado"), r.resultados[1]);
    checar("lacuna do nucleo tem mensagem", typeof r.resultados[2]?.mensagem === "string" && !!r.resultados[2]?.mensagem, r.resultados[2]);
  }
  {
    const { t } = montar({
      incluirProcessosEmBlocoInterno: async () => {
        throw new Error("rede caiu");
      },
    });
    const r = (await t.posAcaoBloco({ idBloco: "9", idsProcedimento: ["55", "56"] })) as {
      resultados: Array<Record<string, unknown>>;
      parar?: boolean;
    };
    igual(
      "excecao => todos nao-confirmado (pode ter sido depois do POST)",
      r.resultados.map((x) => [x.idProcedimento, x.situacao]),
      [
        ["55", "nao-confirmado"],
        ["56", "nao-confirmado"],
      ],
    );
    checar(
      "com a mensagem",
      r.resultados.every((x) => String(x.mensagem).includes("rede caiu")),
      r,
    );
    checar("sem parar", !("parar" in r), r);
  }
  {
    const { t } = montar({
      incluirProcessosEmBlocoInterno: async () => {
        throw SESSAO();
      },
    });
    const r = (await t.posAcaoBloco({ idBloco: "9", idsProcedimento: ["55", "55", "56"] })) as {
      resultados: Array<Record<string, unknown>>;
      parar?: boolean;
    };
    checar("sessao expirada => parar", r.parar === true, r);
    igual(
      "e nao-confirmado, sem repetir id",
      r.resultados.map((x) => [x.idProcedimento, x.situacao]),
      [
        ["55", "nao-confirmado"],
        ["56", "nao-confirmado"],
      ],
    );
  }

  secao("Pos-acao: opcoes");
  {
    const { t, chamadas } = montar({
      listarOpcoes: async (_sei, lista) => (lista === "marcadores" ? [{ id: "1", nome: "Urgente" }] : [{ id: "2", nome: "Grupo A" }]),
      listarBlocosInternosParaProcessos: async () => [{ id: "9", numero: "12", descricao: "Bloco de teste" }],
    });
    const r = await t.posAcaoOpcoes({ protocolo: PROC.protocolo });
    igual("tres listas, sem avisos", r, {
      marcadores: [{ id: "1", nome: "Urgente" }],
      grupos: [{ id: "2", nome: "Grupo A" }],
      blocos: [{ id: "9", numero: "12", descricao: "Bloco de teste" }],
      avisos: [],
      falharam: [],
    });
    igual(
      "listas pedidas pelo protocolo",
      chamadas.filter((c) => c.nome === "listarOpcoes").map((c) => (c.args as unknown[]).slice(1, 3)),
      [
        ["marcadores", PROC.protocolo],
        ["grupos_acompanhamento", PROC.protocolo],
      ],
    );
  }
  {
    const { t } = montar({
      listarOpcoes: async (_sei, lista) => {
        if (lista === "grupos_acompanhamento") throw new ErroSei("SEI_ACAO_INDISPONIVEL", "Sem tela de acompanhamento.");
        return [{ id: "1", nome: "Urgente" }];
      },
      listarBlocosInternosParaProcessos: async () => [{ id: "9", numero: "12", descricao: "B" }],
    });
    const r = (await t.posAcaoOpcoes({ protocolo: PROC.protocolo })) as Record<string, unknown> & { avisos: string[] };
    igual(
      "as outras listas chegam",
      [r.marcadores, r.blocos],
      [[{ id: "1", nome: "Urgente" }], [{ id: "9", numero: "12", descricao: "B" }]],
    );
    igual("a que falhou vem vazia", r.grupos, []);
    checar(
      "um aviso nomeando a lista",
      r.avisos.length === 1 && /grupos/i.test(r.avisos[0]) && r.avisos[0].includes("Sem tela de acompanhamento."),
      r.avisos,
    );
    checar("sem parar", !("parar" in r), r);
    igual("falharam nomeia a lista", r.falharam, ["grupos"]);
  }
  {
    const { t } = montar({
      listarOpcoes: async () => [{ id: "1", nome: "Urgente" }],
      listarBlocosInternosParaProcessos: async () => {
        throw new ErroSei("SEI_VERSAO_NAO_SUPORTADA", "Lista paginada.");
      },
    });
    const r = (await t.posAcaoOpcoes({ protocolo: PROC.protocolo })) as Record<string, unknown> & { avisos: string[] };
    checar("blocos falhando: aviso de blocos", r.avisos.length === 1 && /blocos/i.test(r.avisos[0]), r.avisos);
    igual("blocos vazio", r.blocos, []);
  }
  {
    const { t } = montar({
      listarOpcoes: async (_sei, lista) => {
        if (lista === "marcadores") throw SESSAO();
        return [{ id: "2", nome: "G" }];
      },
      listarBlocosInternosParaProcessos: async () => [],
    });
    const r = (await t.posAcaoOpcoes({ protocolo: PROC.protocolo })) as Record<string, unknown> & { avisos: string[] };
    checar("sessao expirada numa lista => parar no topo", r.parar === true, r);
    igual("marcadores vazio", r.marcadores, []);
    checar(
      "aviso de marcadores",
      r.avisos.some((a) => /marcadores/i.test(a)),
      r.avisos,
    );
  }
  {
    const { t, chamadas } = montar({
      listarOpcoes: async () => [],
      listarBlocosInternosParaProcessos: async () => [{ id: "9", numero: "12", descricao: "B" }],
    });
    const r = (await t.posAcaoOpcoes({ protocolo: "" })) as Record<string, unknown> & { avisos: string[] };
    igual("protocolo vazio => os blocos vem (nao precisam de processo)", r.blocos, [{ id: "9", numero: "12", descricao: "B" }]);
    checar(
      "marcadores e grupos vazios, um aviso so deles",
      r.avisos.length === 1 &&
        /marcadores/i.test(r.avisos[0]) &&
        /grupos/i.test(r.avisos[0]) &&
        !/blocos/i.test(r.avisos[0]) &&
        JSON.stringify([r.marcadores, r.grupos]) === "[[],[]]",
      r,
    );
    igual(
      "so a lista de blocos foi pedida",
      chamadas.map((c) => c.nome),
      ["listarBlocosInternosParaProcessos"],
    );
    igual("sem protocolo: marcadores e grupos em falharam", r.falharam, ["marcadores", "grupos"]);
  }
}
