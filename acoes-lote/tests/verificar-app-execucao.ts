/**
 * Provas da execucao, da retomada e do resultado: DOM do linkedom, RPC falso, repositorio sobre a area em
 * memoria (com espiao das gravacoes) e espera instantanea. Os Review Focus 3, 4 e 5 do plano moram aqui.
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { ErroRpc } from "@comum/ponte/rpc";
import { resultadoComoCsv } from "@comum/ui/tabelaResultado";
import type { Sei } from "@nucleo/sei";
import { AppAcoesLote, type ContextoApp, type EstadoApp } from "../src/app/app";
import {
  BLOCO_NAO_CONFIRMADO,
  type ControleExecucao,
  type DepsExecucao,
  executarLote,
  MSG_SEM_RESPOSTA,
  TEXTO_EM_VOO,
} from "../src/app/execucao";
import { linhasDoResultado, montarResultado } from "../src/app/resultado";
import { AVISO_OUTRA_ABA, emOutraAba, textoRetomada } from "../src/app/retomada";
import { TelaExecucao } from "../src/app/telaExecucao";
import type { LinhaDoc } from "../src/modelo/documentos";
import { type LoteAcoes, type ParamsEtapa, planejar } from "../src/modelo/fila";
import { tratadoresAcoesLote } from "../src/pagina/executor";
import { RepositorioAcoes } from "../src/repositorio";
import { botao, checar, igual, instalarDom, secao, tique } from "./util";

const CTX: ContextoApp = {
  host: "sei.x.gov.br",
  login: "ana",
  nomeUsuario: "Ana Silva",
  unidadeSigla: "ANA/SUP",
  temaEscuro: false,
  idProcedimento: "99",
  origem: "https://sei.x.gov.br/sei/controlador.php",
};
const AGORA = 1_000_000;
const SENHA = "s3nh@-Secreta";
const TEXTO_SENHA = "Senha incorreta: o lote foi pausado para não bloquear sua conta.";

function linha(n: number, o: Partial<LinhaDoc> = {}): LinhaDoc {
  return {
    id: String(1000 + n),
    numero: String(5000 + n),
    titulo: `Despacho ${n}`,
    tipo: "Despacho",
    externo: false,
    formato: "html",
    nivel: "publico",
    assinado: false,
    assinaturas: [],
    cancelado: false,
    unidade: "ANA/SUP",
    pasta: null,
    ...o,
  };
}

function estado(etapas: ParamsEtapa[], n = 3): EstadoApp {
  const linhas = Array.from({ length: n }, (_, i) => linha(i + 1));
  const e: EstadoApp = {
    ctx: CTX,
    protocolo: "00001.000001/2026-11",
    sigiloso: false,
    linhas,
    selecionados: new Set(linhas.map((l) => l.id)),
    filtro: {},
    etapas,
    planos: [],
  };
  e.planos = planejar(linhas, etapas, false);
  return e;
}

type Args = Record<string, unknown>;
type Trat = (a: Args) => unknown | Promise<unknown>;

function rpcFalso(t: Record<string, Trat>) {
  const chamadas: Array<{ op: string; args: Args }> = [];
  return {
    chamadas,
    de: (op: string) => chamadas.filter((c) => c.op === op),
    rpc: {
      async chamar<T>(op: string, args?: unknown): Promise<T> {
        const a = (args ?? {}) as Args;
        chamadas.push({ op, args: a });
        const f = t[op];
        if (f) return (await f(a)) as T;
        if (op === "recarregarArvore" || op === "zipDescartar" || op === "minimizar") return true as T;
        throw new Error(`op ${op} inesperada`);
      },
    },
  };
}

function repoEspiao() {
  const area = areaMemoria();
  const gravados: string[] = [];
  const espiao: Area = {
    obter: (c) => area.obter(c),
    gravar: (i) => {
      gravados.push(JSON.stringify(i));
      return area.gravar(i);
    },
    remover: (c) => area.remover(c),
    aoMudar: (cb) => area.aoMudar(cb),
  };
  return { area, gravados, repo: new RepositorioAcoes(espiao, CTX.host, CTX.login) };
}

const ok = (resumo = "Feito.", dados?: Record<string, string>) => ({ situacao: "ok", resumo, mudancas: [], ...(dados ? { dados } : {}) });
const numeroDe = (a: Args): string => String(a.numero);

function deps(
  rpc: { chamar<T>(op: string, args?: unknown): Promise<T> },
  repo: RepositorioAcoes,
  o: Partial<DepsExecucao> = {},
): DepsExecucao {
  return { rpc, repo, aba: "aba-1", esperar: async () => undefined, agora: () => AGORA, ...o };
}

const situacoes = (e: EstadoApp, i = 0): string[] => e.planos.map((p) => p.etapas[i]!.situacao);

export async function verificarAppExecucao(): Promise<void> {
  instalarDom('<html><body><div id="r"></div></body></html>');

  secao("Execução: caminho feliz");
  {
    const { repo, area } = repoEspiao();
    const f = rpcFalso({ executar: () => ok() });
    const e = estado([{ acao: "ciencia" }]);
    let terminou = 0;
    const c = executarLote(e, undefined, deps(f.rpc, repo, { aoTerminar: () => terminou++ }));
    await c.rodada();
    igual("todas ok", situacoes(e), ["ok", "ok", "ok"]);
    igual(
      "um executar por documento, em ordem",
      f.de("executar").map((x) => numeroDe(x.args)),
      ["5001", "5002", "5003"],
    );
    checar(
      "executar leva o loteId",
      f.de("executar").every((x) => x.args.loteId === c.lote.id && !!c.lote.id),
    );
    checar(
      "sem senha fora do Assinar",
      f.de("executar").every((x) => !("senha" in x.args)),
    );
    igual("recarregarArvore uma vez", f.de("recarregarArvore").length, 1);
    igual("terminou uma vez", terminou, 1);
    igual("estado concluído", c.estado, "concluido");
    igual("progresso", c.progresso(), { feitos: 3, total: 3, falhas: 0 });
    igual("lote concluído sai do storage", Object.keys(await area.obter(null)), []);
  }

  secao("Execução: grava incerto antes de cada executar");
  {
    const { repo } = repoEspiao();
    const vistos: string[] = [];
    const f = rpcFalso({
      executar: async (a) => {
        const l = await repo.doProcesso("99");
        const p = l?.planos.find((x) => x.doc.numero === numeroDe(a));
        vistos.push(`${p?.etapas[0]?.situacao}|${p?.etapas[0]?.mensagem}`);
        return ok();
      },
    });
    const e = estado([{ acao: "ciencia" }], 2);
    await executarLote(e, undefined, deps(f.rpc, repo)).rodada();
    igual("incerto gravado antes de cada envio", vistos, [`incerto|${TEXTO_EM_VOO}`, `incerto|${TEXTO_EM_VOO}`]);
  }

  secao("Review Focus 3: sessão cai no documento 3 de 5 depois do envio");
  {
    const { repo } = repoEspiao();
    const f = rpcFalso({
      executar: (a) => {
        if (numeroDe(a) === "5003") throw new ErroRpc("PRAZO", "A aba do SEI não respondeu a tempo.");
        return ok();
      },
    });
    const e = estado([{ acao: "ciencia" }], 5);
    const c = executarLote(e, undefined, deps(f.rpc, repo));
    await c.rodada();
    igual("pausado", c.estado, "pausado");
    checar("motivo mostrado", !!c.motivo);
    igual(
      "documentos 4 e 5 não enviados",
      f.de("executar").map((x) => numeroDe(x.args)),
      ["5001", "5002", "5003"],
    );
    const salvo = await repo.doProcesso("99");
    igual(
      "no storage: 3 incerto, 4 e 5 pendentes",
      salvo?.planos.map((p) => p.etapas[0]!.situacao),
      ["ok", "ok", "incerto", "pendente", "pendente"],
    );
    // Retomada em outra instância (modal reaberto) a partir do registro.
    const e2 = estado([{ acao: "ciencia" }], 5);
    const f2 = rpcFalso({ executar: () => ok() });
    const c2 = executarLote(e2, undefined, deps(f2.rpc, repo, { lote: salvo! }));
    await c2.rodada();
    igual(
      "retomada não repete o 3",
      f2.de("executar").map((x) => numeroDe(x.args)),
      ["5004", "5005"],
    );
    igual("o 3 segue incerto", e2.planos[2]!.etapas[0]!.situacao, "incerto");
    igual("mesmo lote", c2.lote.id, salvo?.id);
  }

  secao("Sessão expirada antes do envio: pausa e o documento fica pendente");
  {
    const { repo } = repoEspiao();
    let caiu = false;
    const f = rpcFalso({
      executar: (a) => {
        if (numeroDe(a) === "5002" && !caiu) {
          caiu = true;
          return { situacao: "erro", erro: "A sessão do SEI expirou.", parar: true };
        }
        return ok();
      },
    });
    const e = estado([{ acao: "ciencia" }, { acao: "duplicar" }], 3);
    const c = executarLote(e, undefined, deps(f.rpc, repo));
    await c.rodada();
    igual("pausa", c.estado, "pausado");
    igual("motivo é o do SEI", c.motivo, "A sessão do SEI expirou.");
    igual(
      "etapa volta a pendente (nada gravado)",
      e.planos[1]!.etapas.map((x) => x.situacao),
      ["pendente", "pendente"],
    );
    await c.continuar();
    igual(
      "continuar refaz o 2 e segue",
      f
        .de("executar")
        .map((x) => numeroDe(x.args))
        .slice(3),
      ["5002", "5002", "5003", "5003"],
    );
    igual("concluído", c.estado, "concluido");
  }

  secao("Review Focus 5: senha errada pausa no primeiro documento");
  {
    const { repo, gravados } = repoEspiao();
    const f = rpcFalso({
      executar: (a) => (a.senha === "certa" ? ok() : { situacao: "erro", erro: TEXTO_SENHA, parar: true }),
    });
    const e = estado([{ acao: "assinar", cargo: "Diretor" }], 3);
    const c = executarLote(e, SENHA, deps(f.rpc, repo));
    await c.rodada();
    igual("um único executar", f.de("executar").length, 1);
    igual("com a senha só nos args", f.de("executar")[0]!.args.senha, SENHA);
    igual("pausado com o texto da senha", [c.estado, c.motivo], ["pausado", TEXTO_SENHA]);
    checar("precisa de senha para continuar", c.precisaSenha());
    await c.continuar("certa");
    igual(
      "continua com a senha nova",
      f
        .de("executar")
        .slice(1)
        .map((x) => x.args.senha),
      ["certa", "certa", "certa"],
    );
    checar("nenhuma gravação contém a senha", gravados.length > 0 && gravados.every((g) => !g.includes(SENHA) && !g.includes("certa")));
  }

  secao("Três incertos seguidos (rede) pausam");
  {
    const { repo } = repoEspiao();
    const f = rpcFalso({ executar: () => ({ situacao: "ok", resumo: "O SEI não confirmou.", mudancas: [], incerto: true }) });
    const e = estado([{ acao: "ciencia" }], 5);
    const c = executarLote(e, undefined, deps(f.rpc, repo));
    await c.rodada();
    igual("parou no terceiro", f.de("executar").length, 3);
    igual("mensagem exata", c.motivo, MSG_SEM_RESPOSTA);
    igual("situações", situacoes(e), ["incerto", "incerto", "incerto", "pendente", "pendente"]);
  }
  {
    const { repo } = repoEspiao();
    let n = 0;
    const f = rpcFalso({
      executar: () => (++n === 3 ? ok() : { situacao: "ok", resumo: "O SEI não confirmou.", mudancas: [], incerto: true }),
    });
    const c = executarLote(estado([{ acao: "ciencia" }], 5), undefined, deps(f.rpc, repo));
    await c.rodada();
    igual("um ok no meio zera a contagem", [f.de("executar").length, c.estado], [5, "concluido"]);
  }

  secao("Incerto derruba as etapas seguintes do documento");
  {
    const { repo } = repoEspiao();
    const f = rpcFalso({
      executar: (a) =>
        numeroDe(a) === "5001" && (a.etapa as ParamsEtapa).acao === "ciencia"
          ? { situacao: "ok", resumo: "O SEI não confirmou.", mudancas: [], incerto: true }
          : ok(),
    });
    const e = estado([{ acao: "ciencia" }, { acao: "duplicar" }], 2);
    await executarLote(e, undefined, deps(f.rpc, repo)).rodada();
    igual("duplicar do 1 pulado", e.planos[0]!.etapas[1]!.situacao, "pulado");
    igual(
      "o 2 segue inteiro",
      e.planos[1]!.etapas.map((x) => x.situacao),
      ["ok", "ok"],
    );
  }

  secao("repetirFalhas reabre só erro, nunca incerto");
  {
    const { repo } = repoEspiao();
    let rodada = 1;
    const f = rpcFalso({
      executar: (a) => {
        if (rodada === 1 && numeroDe(a) === "5001") return { situacao: "erro", erro: "Falhou." };
        if (rodada === 1 && numeroDe(a) === "5002") return { situacao: "ok", resumo: "O SEI não confirmou.", mudancas: [], incerto: true };
        return ok();
      },
    });
    const e = estado([{ acao: "ciencia" }, { acao: "duplicar" }], 3);
    const c = executarLote(e, undefined, deps(f.rpc, repo));
    await c.rodada();
    igual(
      "1 erro (e duplicar pulado), 2 incerto",
      [situacoes(e, 0), situacoes(e, 1)],
      [
        ["erro", "incerto", "ok"],
        ["pulado", "pulado", "ok"],
      ],
    );
    igual("falhas", c.progresso().falhas, 1);
    rodada = 2;
    const antes = f.de("executar").length;
    await c.repetirFalhas();
    const novas = f.de("executar").slice(antes);
    igual(
      "só o documento 1, as duas etapas",
      novas.map((x) => `${numeroDe(x.args)}:${(x.args.etapa as ParamsEtapa).acao}`),
      ["5001:ciencia", "5001:duplicar"],
    );
    igual("o incerto continua incerto", e.planos[1]!.etapas[0]!.situacao, "incerto");
    igual("recarregarArvore a cada término", f.de("recarregarArvore").length, 2);
  }

  secao("incluir-bloco {novo}: a etapa vira {id} no lote");
  {
    const { repo } = repoEspiao();
    const f = rpcFalso({
      executar: (a) => {
        const et = a.etapa as Extract<ParamsEtapa, { acao: "incluir-bloco" }>;
        return "novo" in et.bloco ? ok("Incluído.", { bloco: "77" }) : ok("Incluído.");
      },
    });
    const e = estado([{ acao: "incluir-bloco", bloco: { novo: "Meu bloco" } }], 3);
    let salvoNoMeio: LoteAcoes | null = null;
    const c = executarLote(e, undefined, deps(f.rpc, repo, { aoMudar: () => undefined }));
    await c.rodada();
    salvoNoMeio = c.lote;
    const esperado = { acao: "incluir-bloco", bloco: { id: "77", texto: "Meu bloco" } };
    igual("lote em memória", salvoNoMeio.etapas[0], esperado);
    igual("estado do app", e.etapas[0], esperado);
    igual(
      "documentos seguintes usam o id",
      f
        .de("executar")
        .slice(1)
        .map((x) => x.args.etapa),
      [esperado, esperado],
    );
  }
  {
    // Persistido: pausa depois do 1o e lê o registro.
    const { repo } = repoEspiao();
    let c: ControleExecucao | null = null;
    const f = rpcFalso({
      executar: () => {
        c?.pausar();
        return ok("Incluído.", { bloco: "88" });
      },
    });
    c = executarLote(estado([{ acao: "incluir-bloco", bloco: { novo: "B" } }], 3), undefined, deps(f.rpc, repo));
    await c.rodada();
    igual("persistido como {id}", (await repo.doProcesso("99"))?.etapas[0], { acao: "incluir-bloco", bloco: { id: "88", texto: "B" } });
  }

  secao("Bloco novo com criação incerta: {novo} nunca sai de novo");
  {
    // Mesma sessão: o envio da criação estoura o prazo (incerto + pausa); Continuar não reenvia {novo}.
    const { repo } = repoEspiao();
    const f = rpcFalso({
      executar: (a) => {
        if (numeroDe(a) === "5001") throw new ErroRpc("PRAZO", "A aba do SEI não respondeu a tempo.");
        return ok("Incluído.", { bloco: "99" });
      },
    });
    const e = estado(
      [
        { acao: "incluir-bloco", bloco: { novo: "Meu bloco" } },
        { acao: "assinar", cargo: "Diretor" },
      ],
      3,
    );
    const c = executarLote(e, SENHA, deps(f.rpc, repo));
    await c.rodada();
    igual("pausado no 1", [c.estado, f.de("executar").length], ["pausado", 1]);
    igual(
      "os outros já pulados",
      e.planos.slice(1).map((p) => p.etapas[0]!.mensagem),
      [BLOCO_NAO_CONFIRMADO, BLOCO_NAO_CONFIRMADO],
    );
    igual("e a etapa seguinte cai junto", e.planos[1]!.etapas[1]!.situacao, "pulado");
    await c.continuar();
    igual("continuar não envia nada", f.de("executar").length, 1);
    igual("concluído", c.estado, "concluido");
  }
  {
    // Retomada: registro com a criação incerta no 1 e os demais ainda pendentes com {novo}.
    const { repo } = repoEspiao();
    const etapas: ParamsEtapa[] = [{ acao: "incluir-bloco", bloco: { novo: "B" } }];
    const planos = planejar([linha(1), linha(2), linha(3)], etapas, false);
    planos[0]!.etapas[0] = { acao: "incluir-bloco", situacao: "incerto", mensagem: TEXTO_EM_VOO };
    const salvo: LoteAcoes = { id: "LB", idProcedimento: "99", protocolo: "p", criadoEm: 1, atualizadoEm: 1, aba: "x", etapas, planos };
    await repo.salvar(salvo);
    const f = rpcFalso({ executar: () => ok("Incluído.", { bloco: "5" }) });
    const e = estado(etapas, 3);
    const c = executarLote(e, undefined, deps(f.rpc, repo, { lote: (await repo.doProcesso("99"))! }));
    await c.rodada();
    igual("retomada sem executar {novo}", f.de("executar").length, 0);
    igual(
      "pendentes viram pulados com o motivo",
      e.planos.map((p) => p.etapas[0]!.situacao),
      ["incerto", "pulado", "pulado"],
    );
    igual(
      "motivo exato",
      e.planos[2]!.etapas[0]!.mensagem,
      "A criação do bloco não foi confirmada. Confira os blocos no SEI e inclua os documentos pelo bloco certo.",
    );
  }

  secao("Falha com dados.bloco: a etapa vira {id} mesmo sem ok");
  {
    const { repo } = repoEspiao();
    const f = rpcFalso({
      executar: (a) => {
        const et = a.etapa as Extract<ParamsEtapa, { acao: "incluir-bloco" }>;
        if ("novo" in et.bloco) return { situacao: "erro", erro: "Documento já está no bloco.", dados: { bloco: "77" } };
        return ok("Incluído.");
      },
    });
    const e = estado([{ acao: "incluir-bloco", bloco: { novo: "Meu bloco" } }], 3);
    const c = executarLote(e, undefined, deps(f.rpc, repo));
    await c.rodada();
    const esperado = { acao: "incluir-bloco", bloco: { id: "77", texto: "Meu bloco" } };
    igual("etapa regravada", e.etapas[0], esperado);
    igual(
      "os seguintes usam o id",
      f
        .de("executar")
        .slice(1)
        .map((x) => x.args.etapa),
      [esperado, esperado],
    );
    igual("o 1 fica com o erro", e.planos[0]!.etapas[0]!.situacao, "erro");
  }
  {
    // Inclusão incerta num bloco que foi criado: também regrava (o bloco existe).
    const { repo } = repoEspiao();
    const f = rpcFalso({
      executar: (a) => {
        const et = a.etapa as Extract<ParamsEtapa, { acao: "incluir-bloco" }>;
        if ("novo" in et.bloco)
          return { situacao: "ok", resumo: "O SEI não confirmou.", mudancas: [], incerto: true, dados: { bloco: "78" } };
        return ok("Incluído.");
      },
    });
    const e = estado([{ acao: "incluir-bloco", bloco: { novo: "B" } }], 2);
    const c = executarLote(e, undefined, deps(f.rpc, repo));
    await c.rodada();
    igual("incerto com dados.bloco regrava", e.etapas[0], { acao: "incluir-bloco", bloco: { id: "78", texto: "B" } });
    igual("e o 2 entra no bloco", [e.planos[1]!.etapas[0]!.situacao, f.de("executar").length], ["ok", 2]);
  }

  secao("Ponta a ponta com o executor real da aba: criação incerta nunca cria um segundo bloco");
  {
    const { repo } = repoEspiao();
    let criacoes = 0;
    const criarBloco = (async () => {
      criacoes++;
      if (criacoes === 1) throw new TypeError("Failed to fetch");
      return { alvo: "", mudancas: [], aplicado: true, resumo: "Bloco criado.", dados: { bloco: "900" } };
    }) as never;
    const incluirNoBloco = (async () => ({ alvo: "", mudancas: [], aplicado: true, resumo: "Incluído." })) as never;
    const ctxAba = { ...CTX, base: "https://x/b", linkArvore: "https://x/a" };
    const novaAba = () => tratadoresAcoesLote({ sei: {} as Sei, ctx: ctxAba, chamadas: { criarBloco, incluirNoBloco } });
    const rpcDe = (t: Record<string, (a: unknown) => unknown>, depois?: () => void) => ({
      async chamar<T>(op: string, args?: unknown): Promise<T> {
        if (op === "recarregarArvore" || op === "zipDescartar" || op === "minimizar") return true as T;
        const r = (await t[op]!(args)) as T;
        depois?.();
        return r;
      },
    });
    const etapas: ParamsEtapa[] = [{ acao: "incluir-bloco", bloco: { novo: "Meu bloco" } }];
    // O usuário pausa logo depois do 1o: o lote fica salvo para a retomada.
    let c: ControleExecucao | null = null;
    const e = estado(etapas, 3);
    c = executarLote(
      e,
      undefined,
      deps(
        rpcDe(novaAba(), () => c?.pausar()),
        repo,
      ),
    );
    await c.rodada();
    igual("o 1 fica incerto (não volta a pendente)", e.planos[0]!.etapas[0]!.situacao, "incerto");
    await c.continuar();
    await c.continuar();
    igual("Continuar não cria de novo nem trava em pausa", [criacoes, c.estado], [1, "concluido"]);
    igual(
      "os demais pulados com o motivo",
      e.planos.slice(1).map((p) => p.etapas[0]!.mensagem),
      [BLOCO_NAO_CONFIRMADO, BLOCO_NAO_CONFIRMADO],
    );
  }
  {
    // Reabertura: o modal fecha logo depois do 1o envio; outra instância dos tratadores retoma do lote salvo.
    const { repo } = repoEspiao();
    let criacoes = 0;
    const criarBloco = (async () => {
      criacoes++;
      if (criacoes === 1) throw new TypeError("Failed to fetch");
      return { alvo: "", mudancas: [], aplicado: true, resumo: "Bloco criado.", dados: { bloco: "900" } };
    }) as never;
    const incluirNoBloco = (async () => ({ alvo: "", mudancas: [], aplicado: true, resumo: "Incluído." })) as never;
    const ctxAba = { ...CTX, base: "https://x/b", linkArvore: "https://x/a" };
    const novaAba = () => tratadoresAcoesLote({ sei: {} as Sei, ctx: ctxAba, chamadas: { criarBloco, incluirNoBloco } });
    const etapas: ParamsEtapa[] = [{ acao: "incluir-bloco", bloco: { novo: "Meu bloco" } }];
    let c: ControleExecucao | null = null;
    const t1 = novaAba();
    const rpc1 = {
      async chamar<T>(op: string, args?: unknown): Promise<T> {
        if (op === "recarregarArvore" || op === "zipDescartar" || op === "minimizar") return true as T;
        const r = (await t1[op]!(args)) as T;
        c?.encerrar();
        return r;
      },
    };
    c = executarLote(estado(etapas, 3), undefined, deps(rpc1, repo));
    await c.rodada();
    const salvo = await repo.doProcesso("99");
    checar("lote salvo", !!salvo);
    const t2 = novaAba();
    const rpc2 = {
      async chamar<T>(op: string, args?: unknown): Promise<T> {
        if (op === "recarregarArvore" || op === "zipDescartar" || op === "minimizar") return true as T;
        return (await t2[op]!(args)) as T;
      },
    };
    const e2 = estado(etapas, 3);
    const c2 = executarLote(e2, undefined, deps(rpc2, repo, { lote: salvo! }));
    await c2.rodada();
    await c2.continuar();
    igual("retomada não cria um segundo bloco", criacoes, 1);
    igual("retomada termina", c2.estado, "concluido");
  }

  secao("Senha: Continuar depois de Pausar não pede de novo");
  {
    const { repo } = repoEspiao();
    let c: ControleExecucao | null = null;
    const f = rpcFalso({
      executar: (a) => {
        if (numeroDe(a) === "5001") c?.pausar();
        return ok();
      },
    });
    c = executarLote(estado([{ acao: "assinar", cargo: "Diretor" }], 3), SENHA, deps(f.rpc, repo));
    await c.rodada();
    igual("pausado com Assinar pendente", [c.estado, f.de("executar").length], ["pausado", 1]);
    checar("o controle ainda tem a senha: não pede", !c.precisaSenha());
    const doc = instalarDom('<html><body><div id="r"></div></body></html>');
    const tela = new TelaExecucao(c, { minimizar: () => undefined });
    doc.getElementById("r")!.append(tela.el);
    checar("campo de senha escondido", tela.el.querySelector("label.al-campo")!.hasAttribute("hidden"));
    botao(tela.el, "Continuar")!.click();
    await tique(10);
    await c.rodada();
    igual(
      "continuou com a senha guardada",
      f.de("executar").map((x) => x.args.senha),
      [SENHA, SENHA, SENHA],
    );
    checar("sem pedir senha", !(tela.el.textContent ?? "").includes("Digite a senha da assinatura."));
  }
  {
    // Senha errada: o controle esquece a senha e pede de novo.
    const { repo } = repoEspiao();
    const f = rpcFalso({ executar: () => ({ situacao: "erro", erro: TEXTO_SENHA, parar: true }) });
    const c = executarLote(estado([{ acao: "assinar", cargo: "Diretor" }], 2), SENHA, deps(f.rpc, repo));
    await c.rodada();
    checar("senha errada: pede de novo", c.precisaSenha());
  }

  secao("Tentar de novo só as falhas depois de Parar lote: só os documentos com erro");
  {
    const { repo } = repoEspiao();
    let c: ControleExecucao | null = null;
    let rodada = 1;
    const f = rpcFalso({
      executar: (a) => {
        if (rodada === 1 && numeroDe(a) === "5001") {
          c?.cancelar();
          return { situacao: "erro", erro: "Falhou." };
        }
        return ok();
      },
    });
    const e = estado([{ acao: "ciencia" }, { acao: "pdf" }], 3);
    const fp = f.rpc;
    const pdfs: unknown[] = [];
    const rpc = {
      async chamar<T>(op: string, args?: unknown): Promise<T> {
        if (op === "pdf") {
          pdfs.push((args as Args).numeros);
          return ok("PDF baixado.") as T;
        }
        return fp.chamar<T>(op, args);
      },
    };
    c = executarLote(e, undefined, deps(rpc, repo));
    await c.rodada();
    igual("parado com 2 e 3 pendentes", [c.estado, situacoes(e)], ["cancelado", ["erro", "pendente", "pendente"]]);
    rodada = 2;
    await c.repetirFalhas();
    igual(
      "só o documento 1 roda",
      f.de("executar").map((x) => numeroDe(x.args)),
      ["5001", "5001"],
    );
    igual("PDF só com o 1", pdfs, [["5001"]]);
    igual("2 e 3 continuam pendentes", situacoes(e).slice(1), ["pendente", "pendente"]);
  }

  secao("PDF no fim, uma vez, só com quem chegou sem falha");
  {
    const { repo } = repoEspiao();
    const f = rpcFalso({
      executar: (a) => (numeroDe(a) === "5002" ? { situacao: "erro", erro: "Falhou." } : ok()),
      pdf: () => ok("PDF baixado: x.pdf", { arquivo: "x.pdf", foraDoPdf: "5003" }),
    });
    const e = estado([{ acao: "ciencia" }, { acao: "pdf" }], 3);
    await executarLote(e, undefined, deps(f.rpc, repo)).rodada();
    igual(
      "pdf uma vez",
      f.de("pdf").map((x) => x.args.numeros),
      [["5001", "5003"]],
    );
    checar(
      "executar nunca leva pdf",
      f.de("executar").every((x) => (x.args.etapa as ParamsEtapa).acao !== "pdf"),
    );
    igual("situação do pdf por documento", situacoes(e, 1), ["ok", "pulado", "erro"]);
  }

  secao("Baixar em ZIP no fim: descarta, junta e fecha uma vez");
  {
    const { repo } = repoEspiao();
    const f = rpcFalso({
      zipAdicionar: (a) =>
        numeroDe(a) === "5002" ? { situacao: "erro", erro: "Sem acesso." } : ok("Guardado.", { arquivo: `${numeroDe(a)}.pdf` }),
      zipFechar: () => ok("ZIP baixado: d.zip", { arquivo: "d.zip" }),
    });
    const e = estado([{ acao: "baixar", modo: "zip" }], 3);
    const c = executarLote(e, undefined, deps(f.rpc, repo));
    await c.rodada();
    const ops = f.chamadas.map((x) => x.op);
    checar(
      "zipDescartar antes do primeiro zipAdicionar",
      ops.indexOf("zipDescartar") >= 0 && ops.indexOf("zipDescartar") < ops.indexOf("zipAdicionar"),
    );
    igual(
      "zipAdicionar por documento com loteId",
      f
        .de("zipAdicionar")
        .map((x) => `${numeroDe(x.args)}|${x.args.loteId === c.lote.id}`)
        .sort(),
      ["5001|true", "5002|true", "5003|true"],
    );
    igual("zipFechar uma vez", f.de("zipFechar").length, 1);
    igual("nenhum executar", f.de("executar").length, 0);
    igual("situações", situacoes(e), ["ok", "erro", "ok"]);
  }
  {
    const { repo } = repoEspiao();
    const f = rpcFalso({ executar: (a) => ok(`Arquivo baixado: ${numeroDe(a)}`) });
    const e = estado([{ acao: "baixar", modo: "arquivos" }], 2);
    await executarLote(e, undefined, deps(f.rpc, repo)).rodada();
    igual("baixar arquivos: executar por documento", f.de("executar").length, 2);
    igual("sem zip", f.de("zipFechar").length + f.de("zipAdicionar").length, 0);
  }

  secao("Parar lote: o que falta fica salvo e o ZIP é descartado");
  {
    const { repo } = repoEspiao();
    let c: ControleExecucao | null = null;
    const f = rpcFalso({
      executar: () => {
        c?.cancelar();
        return ok();
      },
    });
    let terminou = 0;
    c = executarLote(estado([{ acao: "ciencia" }], 3), undefined, deps(f.rpc, repo, { aoTerminar: () => terminou++ }));
    await c.rodada();
    igual("um só enviado", f.de("executar").length, 1);
    igual("cancelado", c.estado, "cancelado");
    igual("terminou (resultado)", terminou, 1);
    igual(
      "registro guarda o que falta",
      (await repo.doProcesso("99"))?.planos.map((p) => p.etapas[0]!.situacao),
      ["ok", "pendente", "pendente"],
    );
  }

  secao("Review Focus 4: fechar o modal no meio");
  {
    const { repo } = repoEspiao();
    const doc = instalarDom('<html><body><div id="r"></div></body></html>');
    let fechou: (() => void) | null = null;
    let soltar: (() => void) | null = null;
    const f = rpcFalso({
      arvore: () => ({ protocolo: "00001.000001/2026-11", sigiloso: false, linhas: [linha(1), linha(2), linha(3)] }),
      executar: (a) => {
        if (numeroDe(a) !== "5002") return ok();
        return new Promise((r) => {
          soltar = () => r(ok());
        });
      },
    });
    const app = new AppAcoesLote(doc.getElementById("r")!, {
      rpc: f.rpc,
      ctx: CTX,
      fechar: () => undefined,
      repo,
      aba: "aba-1",
      agora: () => AGORA,
      esperar: async () => undefined,
      aoFechar: (cb) => {
        fechou = cb;
      },
    });
    await app.iniciar();
    const e = app.estado!;
    e.etapas = [{ acao: "ciencia" }];
    e.planos = planejar(e.linhas, e.etapas, false);
    app.executar();
    await tique(10);
    igual("tela de execução", app.tela, "execucao");
    checar("doc 2 em voo", !!soltar);
    checar("aoFechar registrado", !!fechou);
    (fechou as unknown as () => void)();
    (soltar as unknown as () => void)();
    await tique(20);
    igual(
      "nada novo depois de fechar",
      f.de("executar").map((x) => numeroDe(x.args)),
      ["5001", "5002"],
    );
    const salvo = await repo.doProcesso("99");
    igual(
      "salvo com o que falta",
      salvo?.planos.map((p) => p.etapas[0]!.situacao),
      ["ok", "ok", "pendente"],
    );
    checar("sem o link (infra_hash) no storage", !JSON.stringify(salvo).includes("infra_hash"));

    // Reabrir: a mesma aba? Nao: outra instancia, com aba nova e muito depois.
    const doc2 = instalarDom('<html><body><div id="r"></div></body></html>');
    const f2 = rpcFalso({
      arvore: () => ({ protocolo: "00001.000001/2026-11", sigiloso: false, linhas: [linha(1), linha(2), linha(3)] }),
      executar: () => ok(),
    });
    const app2 = new AppAcoesLote(doc2.getElementById("r")!, {
      rpc: f2.rpc,
      ctx: CTX,
      fechar: () => undefined,
      repo,
      aba: "aba-2",
      agora: () => AGORA + 60_000,
      esperar: async () => undefined,
    });
    await app2.iniciar();
    const raiz2 = doc2.getElementById("r")!;
    checar("oferece retomar (2 de 3)", (raiz2.textContent ?? "").includes(textoRetomada(2, 3)), raiz2.textContent);
    igual("texto exato", textoRetomada(2, 3), "Há um lote de Ações em Lote parado neste processo (2 de 3). Continuar de onde parou?");
    checar("sem aviso de outra aba (antigo)", !(raiz2.textContent ?? "").includes(AVISO_OUTRA_ABA));
    checar("Continuar e Descartar, sem Cancelar", !!botao(raiz2, "Continuar") && !!botao(raiz2, "Descartar") && !botao(raiz2, "Cancelar"));
    botao(raiz2, "Continuar")!.click();
    await tique(20);
    igual(
      "retomada envia só o 3",
      f2.de("executar").map((x) => numeroDe(x.args)),
      ["5003"],
    );
    igual("resultado", app2.tela, "resultado");
  }

  secao("Retomada: outra aba, senha e Descartar");
  {
    const { repo } = repoEspiao();
    const etapas: ParamsEtapa[] = [{ acao: "assinar", cargo: "Diretor" }];
    const lote: LoteAcoes = {
      id: "L9",
      idProcedimento: "99",
      protocolo: "00001.000001/2026-11",
      criadoEm: AGORA - 60_000,
      atualizadoEm: AGORA - 5_000,
      aba: "aba-outra",
      etapas,
      planos: planejar([linha(1), linha(2)], etapas, false),
    };
    await repo.salvar(lote);
    const doc = instalarDom('<html><body><div id="r"></div></body></html>');
    const f = rpcFalso({
      arvore: () => ({ protocolo: "00001.000001/2026-11", sigiloso: false, linhas: [linha(1), linha(2)] }),
      executar: () => ok(),
    });
    const app = new AppAcoesLote(doc.getElementById("r")!, {
      rpc: f.rpc,
      ctx: CTX,
      fechar: () => undefined,
      repo,
      aba: "aba-1",
      agora: () => AGORA,
      esperar: async () => undefined,
    });
    await app.iniciar();
    const raiz = doc.getElementById("r")!;
    checar("aviso de outra aba", (raiz.textContent ?? "").includes(AVISO_OUTRA_ABA));
    igual("aviso exato", AVISO_OUTRA_ABA, "Este lote pode estar rodando em outra aba.");
    const senha = raiz.querySelector<HTMLInputElement>('input[type="password"]');
    checar("pede a senha (Assinar pendente)", !!senha);
    botao(raiz, "Continuar")!.click();
    await tique(10);
    igual("sem senha não envia", f.de("executar").length, 0);
    checar("explica", (raiz.textContent ?? "").includes("Digite a senha da assinatura."));
    senha!.value = SENHA;
    botao(raiz, "Continuar")!.click();
    await tique(10);
    // Lote recente de outra aba: o primeiro clique só arma o "Continuar mesmo assim".
    const mesmoAssim = botao(raiz, "Continuar mesmo assim");
    if (mesmoAssim) mesmoAssim.click();
    await tique(20);
    igual(
      "envia com a senha",
      f.de("executar").map((x) => x.args.senha),
      [SENHA, SENHA],
    );
    checar("senha nunca no storage", !JSON.stringify(await repo.doProcesso("99")).includes(SENHA));
  }
  {
    const { repo } = repoEspiao();
    const etapas: ParamsEtapa[] = [{ acao: "ciencia" }];
    await repo.salvar({
      id: "L8",
      idProcedimento: "99",
      protocolo: "p",
      criadoEm: 1,
      atualizadoEm: AGORA - 5_000,
      aba: "aba-1",
      etapas,
      planos: planejar([linha(1)], etapas, false),
    });
    const doc = instalarDom('<html><body><div id="r"></div></body></html>');
    const f = rpcFalso({ arvore: () => ({ protocolo: "p", sigiloso: false, linhas: [linha(1)] }) });
    const app = new AppAcoesLote(doc.getElementById("r")!, {
      rpc: f.rpc,
      ctx: CTX,
      fechar: () => undefined,
      repo,
      aba: "aba-1",
      agora: () => AGORA,
    });
    await app.iniciar();
    const raiz = doc.getElementById("r")!;
    checar("mesma aba: sem aviso", !(raiz.textContent ?? "").includes(AVISO_OUTRA_ABA));
    botao(raiz, "Descartar")!.click();
    await tique(10);
    igual("descartado", await repo.doProcesso("99"), null);
    igual("vai para a seleção", app.tela, "selecao");
  }

  secao("Tela de execução: Minimizar, Pausar, sem Cancelar");
  {
    const { repo } = repoEspiao();
    const doc = instalarDom('<html><body><div id="r"></div></body></html>');
    let soltar: (() => void) | null = null;
    const f = rpcFalso({
      arvore: () => ({ protocolo: "p", sigiloso: false, linhas: [linha(1), linha(2)] }),
      executar: () =>
        new Promise((r) => {
          soltar = () => r(ok());
        }),
    });
    const app = new AppAcoesLote(doc.getElementById("r")!, {
      rpc: f.rpc,
      ctx: CTX,
      fechar: () => undefined,
      repo,
      aba: "aba-1",
      agora: () => AGORA,
      esperar: async () => undefined,
    });
    await app.iniciar();
    app.estado!.etapas = [{ acao: "ciencia" }];
    app.estado!.planos = planejar(app.estado!.linhas, app.estado!.etapas, false);
    app.executar();
    await tique(10);
    const raiz = doc.getElementById("r")!;
    checar("sem Cancelar", !botao(raiz, "Cancelar"));
    checar("tem Parar lote", !!botao(raiz, "Parar lote"));
    checar(
      "dica da aba visivel",
      (raiz.textContent ?? "").includes(
        "Deixe esta aba do SEI vis\u00EDvel enquanto o lote roda: o navegador desacelera abas em segundo plano.",
      ),
      raiz.textContent,
    );
    botao(raiz, "Minimizar")!.click();
    await tique(5);
    igual(
      "minimizar pela ponte",
      f.de("minimizar").map((x) => x.args),
      [{ minimizado: true }],
    );
    checar("pastilha", (raiz.textContent ?? "").includes("1/2") || (raiz.textContent ?? "").includes("0/2"), raiz.textContent);
    botao(raiz, "Restaurar")!.click();
    await tique(5);
    igual(
      "restaurar pela ponte",
      f
        .de("minimizar")
        .map((x) => x.args)
        .at(-1),
      { minimizado: false },
    );
    botao(raiz, "Pausar")!.click();
    await tique(2);
    checar(
      "pausando espera a etapa em andamento",
      (raiz.textContent ?? "").includes("Pausando: aguardando a etapa em andamento terminar"),
      raiz.textContent,
    );
    (soltar as unknown as () => void)();
    await tique(20);
    igual("pausado após o em voo", f.de("executar").length, 1);
    checar("Continuar disponível", !!botao(raiz, "Continuar"));
  }

  secao("Resultado: linhas, colunas por etapa, duplicado e CSV");
  {
    const e = estado([{ acao: "alterar-nivel", nivel: "publico" }, { acao: "duplicar" }], 2);
    e.planos[0]!.etapas = [
      { acao: "alterar-nivel", situacao: "ok", mensagem: "Nível alterado." },
      { acao: "duplicar", situacao: "ok", mensagem: "Duplicado.", dados: { numero: "7777", idDocumento: "1" } },
    ];
    e.planos[1]!.etapas = [
      { acao: "alterar-nivel", situacao: "incerto", mensagem: "O SEI não confirmou." },
      { acao: "duplicar", situacao: "pulado", mensagem: "Etapa anterior sem confirmação do SEI" },
    ];
    const { linhas, colunas } = linhasDoResultado(e);
    igual("uma linha por documento", linhas.length, 2);
    igual("documento: só o título, sem repetir o tipo", linhas[0]!.campos.documento, e.planos[0]!.doc.titulo);
    const csv = resultadoComoCsv(linhas, colunas);
    const cab = csv.split(/\r?\n/)[0]!;
    checar("CSV com uma coluna por etapa", cab.includes("Alterar nível de acesso") && cab.includes("Duplicar"), cab);
    checar("número do duplicado", csv.includes("7777"));
    checar("incerto vira Confira", csv.includes("Confira"));
    igual(
      "link do documento montado sem infra_hash",
      linhas[0]!.link,
      "https://sei.x.gov.br/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=99&id_documento=1001",
    );
    checar("CSV sem infra_hash", !csv.includes("infra_hash"));
    const doc = instalarDom('<html><body><div id="r"></div></body></html>');
    let repetiu = 0;
    const el = montarResultado(doc, e, { repetirFalhas: () => repetiu++, baixar: () => undefined });
    igual("tabela com 2 linhas", el.querySelectorAll("tbody tr").length, 2);
    checar("sem falhas: sem Tentar de novo", !botao(el, "Tentar de novo só as falhas"));
    checar("Copiar e CSV", !!botao(el, "Copiar") && !!botao(el, "Baixar CSV"));
    checar("sem Cancelar", !botao(el, "Cancelar"));
    e.planos[0]!.etapas[1] = { acao: "duplicar", situacao: "erro", mensagem: "Falhou." };
    const el2 = montarResultado(doc, e, { repetirFalhas: () => repetiu++, baixar: () => undefined });
    botao(el2, "Tentar de novo só as falhas")!.click();
    igual("Tentar de novo só as falhas", repetiu, 1);
    let csvBaixado = "";
    const el3 = montarResultado(doc, e, { repetirFalhas: () => undefined, baixar: (_n, c) => (csvBaixado = c) });
    botao(el3, "Baixar CSV")!.click();
    checar("Baixar CSV entrega o CSV", csvBaixado.includes("Alterar nível de acesso"));
    let copiado = "";
    const el4 = montarResultado(doc, e, {
      repetirFalhas: () => undefined,
      baixar: () => undefined,
      clip: {
        writeText: async (t) => {
          copiado = t;
        },
      },
      avisar: () => undefined,
    });
    botao(el4, "Copiar")!.click();
    await tique(5);
    checar("Copiar entrega o texto, sem infra_hash", copiado.includes("5001") && !copiado.includes("infra_hash"), copiado);
  }

  secao("Resultado: Nova seleção e Atualizar relêem a árvore e voltam à seleção limpa");
  for (const via of ["Nova seleção", "Atualizar"] as const) {
    const doc = instalarDom('<html><body><div id="r"></div></body></html>');
    const f = rpcFalso({
      arvore: () => ({ protocolo: "00001.000001/2026-11", sigiloso: false, linhas: [linha(1), linha(2), linha(3)] }),
      executar: () => ok(),
    });
    const app = new AppAcoesLote(doc.getElementById("r")!, {
      rpc: f.rpc,
      ctx: CTX,
      fechar: () => undefined,
      repo: repoEspiao().repo,
      aba: "aba-1",
      agora: () => AGORA,
      esperar: async () => undefined,
    });
    await app.iniciar();
    const e = app.estado!;
    e.selecionados = new Set(e.linhas.map((l) => l.id));
    e.filtro = { texto: "Despacho", assinatura: "assinados" };
    e.etapas = [{ acao: "ciencia" }];
    e.planos = planejar(e.linhas, e.etapas, false);
    app.executar();
    await tique(20);
    igual(`${via}: no resultado`, app.tela, "resultado");
    const raiz = doc.getElementById("r")!;
    const nova = botao(raiz, "Nova seleção");
    checar(`${via}: botão Nova seleção primário`, !!nova && nova.classList.contains("primario"));
    const atualizar = raiz.querySelector<HTMLButtonElement>('button[aria-label="Atualizar"]');
    checar(`${via}: Atualizar visível no resultado`, !!atualizar && !atualizar.hidden);
    const antes = f.de("arvore").length;
    (via === "Nova seleção" ? nova : atualizar)!.click();
    await tique(10);
    igual(
      `${via}: releu a árvore forçando`,
      f
        .de("arvore")
        .slice(antes)
        .map((c) => c.args.forcar),
      [true],
    );
    igual(`${via}: de volta à seleção`, app.tela, "selecao");
    igual(`${via}: seleção limpa`, app.estado!.selecionados.size, 0);
    igual(`${via}: filtros limpos`, app.estado!.filtro, {});
    app.destruir();
  }

  secao("Outra aba: só com o lote rodando, gravado há pouco, por outra aba do SEI");
  {
    const base: LoteAcoes = {
      id: "L",
      idProcedimento: "99",
      protocolo: "p",
      criadoEm: 1,
      atualizadoEm: AGORA - 5_000,
      aba: "pagina-2",
      etapas: [],
      planos: [],
    };
    checar("rodando, recente, outra aba: avisa", emOutraAba({ ...base, estado: "rodando" }, "pagina-1", AGORA));
    checar("parado: não avisa", !emOutraAba({ ...base, estado: "parado" }, "pagina-1", AGORA));
    checar("mesma aba: não avisa", !emOutraAba({ ...base, estado: "rodando" }, "pagina-2", AGORA));
    checar("antigo: não avisa", !emOutraAba({ ...base, estado: "rodando", atualizadoEm: AGORA - 60_000 }, "pagina-1", AGORA));
    checar("registro sem estado (versão anterior) conta como rodando", emOutraAba(base, "pagina-1", AGORA));
  }
  {
    // Pausar e fechar na mesma aba do SEI, e reabrir logo: o id vem do contexto da aba, não da instância do app.
    const { repo } = repoEspiao();
    const ctxPagina: ContextoApp = { ...CTX, aba: "pagina-1" };
    let soltar: (() => void) | null = null;
    const arvore = () => ({ protocolo: "00001.000001/2026-11", sigiloso: false, linhas: [linha(1), linha(2), linha(3)] });
    const f = rpcFalso({
      arvore,
      executar: (a) =>
        numeroDe(a) !== "5002"
          ? ok()
          : new Promise((r) => {
              soltar = () => r(ok());
            }),
    });
    const doc = instalarDom('<html><body><div id="r"></div></body></html>');
    const app = new AppAcoesLote(doc.getElementById("r")!, {
      rpc: f.rpc,
      ctx: ctxPagina,
      fechar: () => undefined,
      repo,
      agora: () => AGORA,
      esperar: async () => undefined,
    });
    await app.iniciar();
    const e = app.estado!;
    e.etapas = [{ acao: "ciencia" }];
    e.planos = planejar(e.linhas, e.etapas, false);
    app.executar();
    await tique(10);
    igual(
      "rodando: gravado como rodando, com o id da aba do SEI",
      [(await repo.doProcesso("99"))?.estado, (await repo.doProcesso("99"))?.aba],
      ["rodando", "pagina-1"],
    );
    (app as unknown as { controle: { pausar(): void } }).controle.pausar();
    (soltar as unknown as () => void)();
    await tique(20);
    igual("pausado: gravado como parado", (await repo.doProcesso("99"))?.estado, "parado");
    app.destruir();
    await tique(5);

    const doc2 = instalarDom('<html><body><div id="r"></div></body></html>');
    const app2 = new AppAcoesLote(doc2.getElementById("r")!, {
      rpc: rpcFalso({ arvore, executar: () => ok() }).rpc,
      ctx: ctxPagina,
      fechar: () => undefined,
      repo,
      agora: () => AGORA + 1_000,
      esperar: async () => undefined,
    });
    await app2.iniciar();
    const raiz2 = doc2.getElementById("r")!;
    igual("reabrir na mesma aba logo depois: retomada", app2.tela, "retomada");
    checar("sem aviso de outra aba", !(raiz2.textContent ?? "").includes(AVISO_OUTRA_ABA), raiz2.textContent);
    checar("sem Continuar mesmo assim", !botao(raiz2, "Continuar mesmo assim") || botao(raiz2, "Continuar mesmo assim")!.hidden);
    app2.destruir();

    const salvo = (await repo.doProcesso("99"))!;
    await repo.salvar({ ...salvo, estado: "rodando", aba: "pagina-2", atualizadoEm: AGORA });
    const doc3 = instalarDom('<html><body><div id="r"></div></body></html>');
    const app3 = new AppAcoesLote(doc3.getElementById("r")!, {
      rpc: rpcFalso({ arvore, executar: () => ok() }).rpc,
      ctx: ctxPagina,
      fechar: () => undefined,
      repo,
      agora: () => AGORA + 1_000,
      esperar: async () => undefined,
    });
    await app3.iniciar();
    checar("outra aba com o lote rodando: avisa", (doc3.getElementById("r")!.textContent ?? "").includes(AVISO_OUTRA_ABA));
    app3.destruir();
  }
}
