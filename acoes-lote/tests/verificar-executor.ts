/**
 * Executor da aba das Ações em Lote: cada ParamsEtapa chama a função certa do núcleo (com `aplicar` certo), o
 * mapeamento de erros, a árvore com datas, o processo de destino e os downloads. Sem rede: `ChamadasSei` falsas.
 */

import type { Arvore } from "@nucleo/dominio/arvore";
import type { ResultadoEscrita } from "@nucleo/dominio/escrita";
import type { Sei } from "@nucleo/sei";
import { ErroSei } from "@nucleo/sessao/erros";
import { unzipSync } from "fflate";
import { BLOCO_NAO_CONFIRMADO, type ParamsEtapa } from "../src/modelo/fila";
import type { ContextoAcoes } from "../src/pagina/contexto";
import { type ChamadasSei, type DepsExecutor, mapearErro, tratadoresAcoesLote } from "../src/pagina/executor";
import { AcumuladorZip, nomeArquivo } from "../src/sei/download";
import { checar, igual, secao } from "./util";

const CTX: ContextoAcoes = {
  host: "sei.x.gov.br",
  login: "ana",
  nomeUsuario: "Ana",
  unidadeSigla: "UNID",
  temaEscuro: false,
  base: "https://sei.x.gov.br/sei/controlador.php?acao=procedimento_trabalhar&infra_hash=zzz",
  linkArvore: "https://sei.x.gov.br/sei/controlador.php?acao=procedimento_visualizar&id_procedimento=55&infra_hash=yyy",
  idProcedimento: "55",
  origem: "https://sei.x.gov.br/sei/controlador.php",
};

const RESULTADO: ResultadoEscrita = {
  alvo: "0001",
  mudancas: [{ campo: "X", antes: "a", depois: "b" }],
  aplicado: false,
  resumo: "Vai fazer.",
};

interface Chamada {
  fn: string;
  args: unknown[];
}

function doc(id: string, numero: string, titulo: string, nivel: "publico" | "restrito" | "sigiloso" = "publico") {
  return {
    id,
    numero,
    titulo,
    pasta: null,
    externo: false,
    formato: "interno",
    nivel,
    assinado: false,
    assinaturas: [],
    cancelado: false,
    unidadeGeradora: "UNID",
    link: `https://sei.x.gov.br/sei/controlador.php?acao=arvore_visualizar&id_documento=${id}&infra_hash=hh`,
    src: "",
    acoes: [],
    botoes: [],
  };
}

function arvoreFalsa(nivel: "publico" | "sigiloso" = "publico"): Arvore {
  return {
    idProcedimento: "55",
    protocolo: "00001.000001/2026-11",
    tipo: "Tipo",
    nivel,
    marcadores: [],
    documentos: [doc("10", "0001234", "Despacho 1"), doc("11", "0000123", "Oficio 2"), doc("12", "0009999", "Nota 3", "sigiloso")],
    acoesProcesso: [],
    botoesProcesso: [],
    linkProcesso: "",
    links: [],
  } as unknown as Arvore;
}

/** Chamadas falsas que registram tudo; `sobrescrever` força o desfecho de cada prova. */
function falso(sobrescrever: Partial<ChamadasSei> = {}, extra: Partial<DepsExecutor> = {}) {
  const log: Chamada[] = [];
  const reg =
    <T>(fn: string, ret: () => T) =>
    (...args: unknown[]): T => {
      log.push({ fn, args: args.slice(1) });
      return ret();
    };
  const baixados: Array<{ nome: string; bytes: Uint8Array; tipo: string }> = [];
  const chamadas = {
    darCiencia: reg("darCiencia", async () => RESULTADO),
    excluirDocumento: reg("excluirDocumento", async () => RESULTADO),
    cancelarDocumento: reg("cancelarDocumento", async () => RESULTADO),
    cancelarAssinatura: reg("cancelarAssinatura", async () => RESULTADO),
    assinarDocumento: reg("assinarDocumento", async () => ({ ...RESULTADO, dados: { cargos: "Diretor|Analista" } })),
    alterarDocumento: reg("alterarDocumento", async () => RESULTADO),
    duplicarDocumento: reg("duplicarDocumento", async () => ({ ...RESULTADO, dados: { documento: "0005" } })),
    pesquisarContatos: reg("pesquisarContatos", async () => [{ id: "1", texto: "Fulano" }]),
    pesquisarAssuntos: reg("pesquisarAssuntos", async () => [{ id: "2", texto: "Assunto" }]),
    resolverProcessoDestino: reg("resolverProcessoDestino", async () => ({
      idProcedimento: "77",
      protocolo: "00002.000002/2026-22",
      tipo: "Outro",
    })),
    moverDocumento: reg("moverDocumento", async () => RESULTADO),
    gerarPdfDocumentos: reg("gerarPdfDocumentos", async () => ({ link: "https://x/pdf", nome: "Processo.pdf", foraDoPdf: ["11"] })),
    listarBlocosParaInclusao: reg("listarBlocosParaInclusao", async () => [{ id: "9", numero: "123", descricao: "Bloco A" }]),
    incluirNoBloco: reg("incluirNoBloco", async () => RESULTADO),
    criarBloco: reg("criarBloco", async () => ({ ...RESULTADO, dados: { bloco: "456" } })),
    andamentos: reg("andamentos", async () => ({
      protocolo: "p",
      total: 3,
      andamentos: [
        { data: "20/10/2026 10:00", unidade: "U", usuario: "u", descricao: "Documento 0001234 foi assinado" },
        { data: "05/10/2026 09:00", unidade: "U", usuario: "u", descricao: "Gerado documento publico 0001234 (Despacho)" },
        { data: "07/10/2026 09:00", unidade: "U", usuario: "u", descricao: "Gerado documento publico 12345678 (Outro)" },
      ],
    })),
    abrirArvore: reg("abrirArvore", async () => arvoreFalsa()),
    invalidar: reg("invalidar", () => undefined),
    conteudo: reg("conteudo", async () => ({ titulo: "Despacho 1", numero: "0001234", html: "<p>oi</p>" })),
    baixarLink: reg("baixarLink", async () => ({ bytes: new Uint8Array([1, 2, 3]), tipo: "application/pdf", nome: "x.pdf" })),
    hipoteses: reg("hipoteses", async () => [{ id: "5", texto: "Hipotese" }]),
    ...sobrescrever,
  } as unknown as ChamadasSei;
  const t = tratadoresAcoesLote({
    sei: {} as Sei,
    ctx: CTX,
    chamadas,
    baixar: (bytes, nome, tipo) => baixados.push({ bytes, nome, tipo }),
    ...extra,
  });
  return { t, log, baixados };
}

const falha = (e: unknown) => async () => {
  throw e;
};
const prev = (t: ReturnType<typeof falso>["t"], etapa: ParamsEtapa, numero = "0001234") =>
  t.previa({ etapa, numero }) as Promise<Record<string, unknown>>;
const exec = (t: ReturnType<typeof falso>["t"], etapa: ParamsEtapa, numero = "0001234", senha?: string, loteId = "L1") =>
  t.executar({ etapa, numero, senha, loteId }) as Promise<Record<string, unknown>>;

export async function verificarExecutor(): Promise<void> {
  secao("Executor: contexto sem infra_hash");
  {
    const { t } = falso();
    const c = (await t.contexto(undefined)) as Record<string, unknown>;
    checar("sem base nem linkArvore", !("base" in c) && !("linkArvore" in c) && !JSON.stringify(c).includes("infra_hash"), c);
    igual("campos publicos", [c.host, c.login, c.idProcedimento], ["sei.x.gov.br", "ana", "55"]);
    igual("origem sem query", c.origem, "https://sei.x.gov.br/sei/controlador.php");
  }

  secao("Executor: cada etapa chama a funcao certa (previa e executar)");
  {
    const casos: Array<{ nome: string; etapa: ParamsEtapa; fn: string; args: (c: Chamada) => unknown; senha?: string }> = [
      { nome: "ciencia", etapa: { acao: "ciencia" }, fn: "darCiencia", args: (c) => [c.args[0], c.args[1]] },
      { nome: "excluir", etapa: { acao: "excluir" }, fn: "excluirDocumento", args: (c) => [c.args[0]] },
      { nome: "cancelar-assinatura", etapa: { acao: "cancelar-assinatura" }, fn: "cancelarAssinatura", args: (c) => [c.args[0]] },
      { nome: "duplicar", etapa: { acao: "duplicar" }, fn: "duplicarDocumento", args: (c) => [c.args[0]] },
      {
        nome: "cancelar-documento",
        etapa: { acao: "cancelar-documento", motivo: "Erro" },
        fn: "cancelarDocumento",
        args: (c) => [c.args[0], c.args[1]],
      },
      {
        nome: "alterar-nivel publico",
        etapa: { acao: "alterar-nivel", nivel: "publico", hipotese: "7" },
        fn: "alterarDocumento",
        args: (c) => [c.args[0], c.args[1]],
      },
      {
        nome: "assinar",
        etapa: { acao: "assinar", cargo: "Diretor" },
        fn: "assinarDocumento",
        args: (c) => [c.args[0], (c.args[1] as { cargo: string }).cargo],
        senha: "segredo",
      },
      {
        nome: "mover",
        etapa: { acao: "mover", destino: { protocolo: "00002.000002/2026-22", idProcedimento: "77", tipo: "Outro" }, motivo: "Errado" },
        fn: "moverDocumento",
        args: (c) => [c.args[0], c.args[1], c.args[2]],
      },
      {
        nome: "incluir-bloco existente",
        etapa: { acao: "incluir-bloco", bloco: { id: "123", texto: "123 - A" } },
        fn: "incluirNoBloco",
        args: (c) => [c.args[0], c.args[1]],
      },
    ];
    const esperado: Record<string, unknown> = {
      ciencia: ["0001234", {}],
      excluir: ["0001234"],
      "cancelar-assinatura": ["0001234"],
      duplicar: ["0001234"],
      "cancelar-documento": ["0001234", "Erro"],
      "alterar-nivel publico": ["0001234", { nivel: "publico" }],
      assinar: ["0001234", "Diretor"],
      mover: ["0001234", { idProcedimento: "77", protocolo: "00002.000002/2026-22" }, "Errado"],
      "incluir-bloco existente": ["123", ["0001234"]],
    };
    for (const k of casos) {
      for (const aplicar of [false, true]) {
        const { t, log } = falso();
        const r = await (aplicar ? exec(t, k.etapa, "0001234", k.senha) : prev(t, k.etapa));
        const c = log.find((x) => x.fn === k.fn);
        checar(`${k.nome} ${aplicar ? "executar" : "previa"}: ok`, r.situacao === "ok" && r.resumo === "Vai fazer.", r);
        checar(`${k.nome} ${aplicar ? "executar" : "previa"}: chamou ${k.fn}`, !!c, log);
        if (!c) continue;
        igual(`${k.nome} ${aplicar ? "executar" : "previa"}: argumentos`, k.args(c), esperado[k.nome]);
        const opcoes = c.args[c.args.length - 1];
        igual(`${k.nome} ${aplicar ? "executar" : "previa"}: aplicar`, (opcoes as { aplicar: boolean }).aplicar, aplicar);
      }
    }
    const { t, log } = falso();
    await exec(t, { acao: "assinar", cargo: "Diretor" }, "0001234", "segredo");
    igual("assinar executar leva a senha", (log[0].args[1] as { senha: string }).senha, "segredo");
    const p = falso();
    await prev(p.t, { acao: "assinar", cargo: "Diretor" });
    checar("assinar previa nao leva senha", !("senha" in (p.log[0].args[1] as object)), p.log[0]);
    const sem = falso();
    const rSem = await exec(sem.t, { acao: "assinar", cargo: "Diretor" });
    checar("assinar sem senha para antes de chamar", rSem.situacao === "erro" && rSem.parar === true && sem.log.length === 0, rSem);
  }

  secao("Executor: alterar-nivel restrito e alterar-dados");
  {
    const a = falso();
    await exec(a.t, { acao: "alterar-nivel", nivel: "restrito", hipotese: "7" });
    igual("restrito leva hipotese", a.log[0].args[1], { nivel: "restrito", hipotese: "7" });

    const b = falso();
    await exec(b.t, { acao: "alterar-dados", descricao: "   ", observacao: "", nivel: "publico" });
    igual("descricao e observacao em branco ficam undefined", b.log[0].args[1], { nivel: "publico" });
    checar("sem as chaves", !("descricao" in (b.log[0].args[1] as object)) && !("observacao" in (b.log[0].args[1] as object)));

    const c = falso();
    await exec(c.t, {
      acao: "alterar-dados",
      descricao: "Nova",
      observacao: "Obs",
      interessados: { modo: "acrescentar", itens: [{ id: "1", texto: "F" }] },
      assuntos: { modo: "substituir", itens: [] },
    });
    igual("preenchidos vao; lista vazia nao", c.log[0].args[1], {
      descricao: "Nova",
      observacao: "Obs",
      interessados: { modo: "acrescentar", itens: [{ id: "1", texto: "F" }] },
    });
  }

  secao("Executor: erros");
  {
    const dep = async (e: unknown, etapa: ParamsEtapa = { acao: "ciencia" }, aplicar = true, senha?: string) => {
      const { t } = falso({ darCiencia: falha(e), excluirDocumento: falha(e), assinarDocumento: falha(e) });
      return aplicar ? exec(t, etapa, "0001234", senha) : prev(t, etapa);
    };
    {
      const r = await dep(new ErroSei("SEI_VALIDACAO", "Usu\u00E1rio j\u00E1 deu ci\u00EAncia neste documento."));
      igual(
        "ciencia repetida vira ok com resumo proprio",
        { s: r.situacao, r: r.resumo, i: r.incerto },
        { s: "ok", r: "Ci\u00EAncia j\u00E1 registrada no documento 0001234.", i: undefined },
      );
      const e = await dep(new ErroSei("SEI_VALIDACAO", "x", "USUARIO JA DEU CIENCIA neste documento."));
      igual("ciencia repetida tambem pelo detalhe, sem acento e em caixa alta", e.situacao, "ok");
      const o = await dep(new ErroSei("SEI_VALIDACAO", "Usuario ja deu ciencia."), { acao: "excluir" });
      igual("a mesma mensagem em outra acao continua erro", o.situacao, "erro");
    }
    igual("sessao expirada para", await dep(new ErroSei("SEI_SESSAO_EXPIRADA", "Sessao acabou.")), {
      situacao: "erro",
      erro: "Sessao acabou.",
      parar: true,
    });
    igual("captcha para", await dep(new ErroSei("SEI_VALIDACAO", "Digite o codigo do Captcha.")), {
      situacao: "erro",
      erro: "Digite o codigo do Captcha.",
      parar: true,
    });
    igual(
      "senha errada: texto exato e para",
      await dep(new ErroSei("SEI_VALIDACAO", "Senha inválida.", "x"), { acao: "assinar", cargo: "Diretor" }, true, "s"),
      { situacao: "erro", erro: "Senha incorreta: o lote foi pausado para não bloquear sua conta.", parar: true },
    );
    igual(
      "senha sem acento e caixa alta",
      await dep(
        new ErroSei("SEI_RESPOSTA_INESPERADA", "O SEI nao registrou (SENHA ou cargo?)"),
        { acao: "assinar", cargo: "D" },
        true,
        "s",
      ),
      { situacao: "erro", erro: "Senha incorreta: o lote foi pausado para não bloquear sua conta.", parar: true },
    );
    igual("senha so vale na assinatura", await dep(new ErroSei("SEI_VALIDACAO", "Informe a senha do bloco.")), {
      situacao: "erro",
      erro: "Informe a senha do bloco.",
    });
    igual("sigiloso vira pulado com o texto fixo", await dep(new ErroSei("SEI_SIGILOSO", "Documento sigiloso: o agente não atua nele.")), {
      situacao: "pulado",
      erro: "Sigiloso: fora das Ações em Lote",
    });
    igual(
      "indisponivel vira pulado com a mensagem do nucleo",
      await dep(new ErroSei("SEI_ACAO_INDISPONIVEL", "O SEI nao oferece ciencia.")),
      {
        situacao: "pulado",
        erro: "O SEI nao oferece ciencia.",
      },
    );
    igual("validacao comum e erro", await dep(new ErroSei("SEI_VALIDACAO", "Motivo invalido.")), {
      situacao: "erro",
      erro: "Motivo invalido.",
    });
    igual("erro depois do POST (nao-ErroSei) e incerto", await dep(new TypeError("boom")), {
      situacao: "ok",
      resumo: "O SEI não confirmou. Confira o documento antes de repetir.",
      mudancas: [],
      incerto: true,
    });
    igual("CANCELADO durante o envio e incerto", (await dep(new ErroSei("CANCELADO", "Cancelado."))).incerto, true);
    igual("SEI_REDE no envio e incerto", (await dep(new ErroSei("SEI_REDE", "Falha."))).incerto, true);
    igual("na previa nada e incerto", await dep(new TypeError("boom"), { acao: "ciencia" }, false), { situacao: "erro", erro: "boom" });
    igual("previa com CANCELADO e erro", (await dep(new ErroSei("CANCELADO", "Cancelado."), { acao: "ciencia" }, false)).situacao, "erro");
    const r = mapearErro(new ErroSei("SEI_NAO_ENCONTRADO", "Sumiu."), { aplicou: true });
    igual("nao encontrado e erro mesmo aplicando", r, { situacao: "erro", erro: "Sumiu." });
    igual("etapa desconhecida", await (falso().t.previa({ etapa: { acao: "x" }, numero: "1" }) as Promise<unknown>), {
      situacao: "erro",
      erro: "Ação desconhecida.",
    });
    igual("sem documento", await (falso().t.previa({ etapa: { acao: "ciencia" }, numero: " " }) as Promise<unknown>), {
      situacao: "erro",
      erro: "Documento não informado.",
    });
  }

  secao("Executor: arvore com datas");
  {
    const { t, log } = falso();
    const r = (await t.arvore({})) as {
      protocolo: string;
      sigiloso: boolean;
      linhas: Array<{ numero: string; data?: string }>;
      datasIndisponiveis?: boolean;
    };
    igual("protocolo e sigiloso", [r.protocolo, r.sigiloso], ["00001.000001/2026-11", false]);
    igual(
      "data = andamento mais antigo que cita o numero inteiro",
      r.linhas.map((l) => [l.numero, l.data]),
      [
        ["0001234", "2026-10-05"],
        ["0000123", undefined],
        ["0009999", undefined],
      ],
    );
    checar("numero curto nao casa dentro de um maior", !r.linhas.find((l) => l.numero === "0000123")?.data);
    checar("sem datasIndisponiveis", r.datasIndisponiveis === undefined);
    igual("abriu pelo link da pagina", ((log.find((x) => x.fn === "abrirArvore")?.args ?? []) as string[])[0], CTX.linkArvore);
    await t.arvore({});
    igual("segunda chamada usa a memoria", log.filter((x) => x.fn === "abrirArvore").length, 1);
    await t.arvore({ forcar: true });
    igual(
      "forcar refaz (e invalida o cache do nucleo)",
      [log.filter((x) => x.fn === "abrirArvore").length, log.filter((x) => x.fn === "invalidar").length],
      [2, 1],
    );
    await t.recarregarArvore(undefined);
    await t.arvore({});
    igual("recarregarArvore limpa", log.filter((x) => x.fn === "abrirArvore").length, 3);
    checar("nada do SEI vaza (base/link)", !JSON.stringify(r).includes("infra_hash"));
    checar(
      "linhas sem link (a arvore do nucleo traz link com infra_hash)",
      r.linhas.every((l) => !("link" in l)),
    );
  }
  {
    const { t } = falso({ andamentos: falha(new ErroSei("SEI_ACAO_INDISPONIVEL", "sem historico")) as never });
    const r = (await t.arvore({})) as { linhas: Array<{ data?: string }>; datasIndisponiveis?: boolean };
    checar("historico falhou: sem data e com flag", r.datasIndisponiveis === true && r.linhas.every((l) => l.data === undefined), r);
  }
  {
    const { t, log } = falso({ abrirArvore: (async () => arvoreFalsa("sigiloso")) as never });
    const r = (await t.arvore({})) as { sigiloso: boolean; datasIndisponiveis?: boolean };
    checar(
      "processo sigiloso: sinaliza e nao lê historico",
      r.sigiloso === true && r.datasIndisponiveis === true && !log.some((x) => x.fn === "andamentos"),
      r,
    );
  }

  secao("Executor: destino do mover");
  {
    const a = falso();
    const r = await (a.t.destino({ protocolo: "00002.000002/2026-22", numero: "0001234" }) as Promise<unknown>);
    igual("destino valido", r, { situacao: "ok", destino: { protocolo: "00002.000002/2026-22", idProcedimento: "77", tipo: "Outro" } });
    checar("destino nao abre arvore nenhuma (nem a do destino)", !a.log.some((x) => x.fn === "abrirArvore" || x.fn === "arvoreDe"), a.log);

    const i = falso({ resolverProcessoDestino: (async () => ({ idProcedimento: "55", protocolo: "p", tipo: "t" })) as never });
    igual("destino igual ao atual", await (i.t.destino({ protocolo: "p", numero: "0001234" }) as Promise<unknown>), {
      situacao: "erro",
      erro: "O processo de destino é o próprio processo aberto.",
    });
    const n = falso({ resolverProcessoDestino: falha(new ErroSei("SEI_NAO_ENCONTRADO", "Processo x nao encontrado.")) as never });
    igual("nao encontrado", await (n.t.destino({ protocolo: "x", numero: "0001234" }) as Promise<unknown>), {
      situacao: "erro",
      erro: "Processo x nao encontrado.",
    });
    igual("sem protocolo", await (falso().t.destino({ protocolo: " ", numero: "1" }) as Promise<unknown>), {
      situacao: "erro",
      erro: "Informe o número do processo de destino.",
    });
  }

  secao("Executor: incluir em bloco novo cria uma vez");
  {
    const { t, log } = falso();
    const etapa: ParamsEtapa = { acao: "incluir-bloco", bloco: { novo: " Meu bloco " } };
    const p = await prev(t, etapa);
    checar("previa nao cria", !log.some((x) => x.fn === "criarBloco") && p.situacao === "ok", log);
    const primeiro = await exec(t, etapa, "0001234");
    igual("item que cria devolve dados.bloco", primeiro.dados, { bloco: "456" });
    await exec(t, etapa, "0000123");
    igual("criou uma vez", log.filter((x) => x.fn === "criarBloco").length, 1);
    igual("criou de assinatura com a descricao aparada", log.find((x) => x.fn === "criarBloco")?.args[0], {
      tipo: "assinatura",
      descricao: "Meu bloco",
    });
    igual(
      "incluiu cada documento no bloco criado",
      log.filter((x) => x.fn === "incluirNoBloco").map((x) => [x.args[0], x.args[1]]),
      [
        ["456", ["0001234"]],
        ["456", ["0000123"]],
      ],
    );
    const outro = await exec(t, { acao: "incluir-bloco", bloco: { novo: "Outro" } }, "0001234");
    const r1 = await exec(t, etapa, "0001234");
    igual("dados.bloco no item que cria e nos seguintes", [r1.dados], [{ bloco: "456" }]);
    const base0 = log.filter((x) => x.fn === "criarBloco").length;
    const outroLote = await exec(t, etapa, "0001234", undefined, "L2");
    igual(
      "outro loteId com a mesma descricao cria de novo",
      [outroLote.situacao, log.filter((x) => x.fn === "criarBloco").length],
      ["ok", base0 + 1],
    );
    await exec(t, etapa, "0000123", undefined, "L2");
    igual("mesmo loteId reaproveita", log.filter((x) => x.fn === "criarBloco").length, base0 + 1);
    const semLote = (await t.executar({ etapa, numero: "0001234" })) as Record<string, unknown>;
    igual("executar sem loteId e recusado", semLote, { situacao: "erro", erro: "Lote não informado." });
    igual("outra descricao no mesmo lote cria outro bloco", outro.situacao, "ok");
  }
  {
    let tentativas = 0;
    const { t, log } = falso({
      criarBloco: (async () => {
        tentativas++;
        throw new TypeError("rede");
      }) as never,
    });
    const etapa: ParamsEtapa = { acao: "incluir-bloco", bloco: { novo: "B" } };
    const r1 = await exec(t, etapa);
    const r2 = await exec(t, etapa, "0000123");
    igual(
      "primeira criacao incerta: ok + incerto (nunca erro que o app repete)",
      [r1.situacao, r1.incerto, r1.parar],
      ["ok", true, undefined],
    );
    checar("o resumo fala do bloco", String(r1.resumo).includes('A criação do bloco "B" não foi confirmada'), r1);
    igual("com a marca no cache: pulado com o motivo", r2, { situacao: "pulado", erro: BLOCO_NAO_CONFIRMADO });
    igual("nao tenta criar de novo", tentativas, 1);
    checar("nao incluiu", !log.some((x) => x.fn === "incluirNoBloco"));
  }
  {
    // Criou o bloco, mas a inclusao falhou: a falha leva o numero do bloco (o app regrava a etapa como {id}).
    const { t, log } = falso({ incluirNoBloco: falha(new ErroSei("SEI_VALIDACAO", "Documento ja esta no bloco.")) as never });
    const etapa: ParamsEtapa = { acao: "incluir-bloco", bloco: { novo: "B" } };
    igual("erro com dados.bloco", await exec(t, etapa), { situacao: "erro", erro: "Documento ja esta no bloco.", dados: { bloco: "456" } });
    await exec(t, etapa, "0000123");
    igual("o seguinte nao cria outro", log.filter((x) => x.fn === "criarBloco").length, 1);
  }
  {
    const { t } = falso({ incluirNoBloco: falha(new TypeError("rede")) as never });
    const r = await exec(t, { acao: "incluir-bloco", bloco: { novo: "B" } });
    igual("inclusao incerta tambem leva dados.bloco", [r.situacao, r.incerto, r.dados], ["ok", true, { bloco: "456" }]);
  }

  secao("Executor: recarregarArvore recarrega a arvore visivel (uma vez, sem montar URL)");
  {
    const eventos: string[] = [];
    const SRC = "controlador.php?acao=procedimento_visualizar&id_procedimento=55&infra_hash=yyy";
    const iframe = (reload: () => void) => ({
      contentWindow: { location: { reload } },
      getAttribute: (n: string) => (n === "src" ? SRC : null),
      setAttribute: (n: string, v: string) => eventos.push(`set:${n}=${v}`),
    });
    const docFalso = (ifr: unknown) => ({ querySelector: (sel: string) => (sel === "#ifrArvore" ? ifr : null) }) as unknown as Document;
    const { t, log } = falso({}, { documento: () => docFalso(iframe(() => eventos.push("reload"))) });
    igual("devolve true", await t.recarregarArvore(undefined), true);
    igual("recarregou o iframe uma vez", eventos, ["reload"]);
    igual("e limpou o cache do nucleo", log.filter((x) => x.fn === "invalidar").length, 1);
    eventos.length = 0;
    const { t: t2 } = falso(
      {},
      {
        documento: () =>
          docFalso(
            iframe(() => {
              throw new Error("bloqueado");
            }),
          ),
      },
    );
    await t2.recarregarArvore(undefined);
    igual("reload falhou: regrava o proprio src", eventos, [`set:src=${SRC}`]);
    const { t: t3 } = falso({}, { documento: () => docFalso(null) });
    igual("sem #ifrArvore nao quebra", await t3.recarregarArvore(undefined), true);
    const { t: t4 } = falso(
      {},
      {
        documento: () => {
          throw new Error("sem topo");
        },
      },
    );
    igual("sem documento de topo nao quebra", await t4.recarregarArvore(undefined), true);
  }

  secao("Executor: listas de apoio");
  {
    const { t, log } = falso();
    igual("blocos", await t.blocos(undefined), [{ id: "123", texto: "123 - Bloco A" }]);
    igual("cargos", await t.cargos({ numero: "0001234" }), ["Diretor", "Analista"]);
    checar(
      "cargos e previa sem senha",
      ((log.find((x) => x.fn === "assinarDocumento")?.args ?? [])[2] as { aplicar: boolean }).aplicar === false,
    );
    igual("contatos", await t.contatos({ termo: " fu " }), [{ id: "1", texto: "Fulano" }]);
    igual("contatos: termo aparado e documento de referencia da arvore", log.find((x) => x.fn === "pesquisarContatos")?.args, [
      "0001234",
      "fu",
    ]);
    igual("assuntos", await t.assuntos({ termo: "a", numero: "0000123" }), [{ id: "2", texto: "Assunto" }]);
    igual("hipoteses restrito", await t.hipoteses({ nivel: "restrito" }), [{ id: "5", texto: "Hipotese" }]);
    igual("hipoteses leva nivel 1", log.find((x) => x.fn === "hipoteses")?.args, ["0001234", "1"]);
    igual("hipoteses publico e vazio", await t.hipoteses({ nivel: "publico" }), []);
    igual("fechar e minimizar sem modal", [await t.fechar(undefined), await t.minimizar({ minimizado: true })], [false, false]);
  }
  {
    const f: string[] = [];
    const t = tratadoresAcoesLote({ sei: {} as Sei, ctx: CTX, fechar: () => f.push("f"), minimizar: (m) => f.push(`m${m}`) });
    await t.fechar(undefined);
    await t.minimizar({ minimizado: true });
    igual("fechar e minimizar chegam ao modal", f, ["f", "mtrue"]);
  }

  secao("Executor: downloads");
  {
    const { t, baixados, log } = falso();
    const r = (await t.baixarArquivo({ numero: "0001234" })) as { situacao: string; dados?: Record<string, string> };
    igual(
      "interno baixa .html",
      [r.situacao, baixados[0]?.nome, new TextDecoder().decode(baixados[0]?.bytes)],
      ["ok", "0001234 - Despacho 1.html", "<p>oi</p>"],
    );
    checar(
      "usou a sessao da aba (conteudo)",
      log.some((x) => x.fn === "conteudo"),
    );

    const ext = falso({
      conteudo: (async () => ({
        titulo: "Contrato",
        numero: "0005",
        arquivo: { bytes: new Uint8Array([9]), tipo: "application/pdf", nome: "contrato.final.PDF" },
      })) as never,
    });
    await ext.t.baixarArquivo({ numero: "0005" });
    igual("externo mantem a extensao", [ext.baixados[0].nome, ext.baixados[0].tipo], ["0005 - Contrato.pdf", "application/pdf"]);

    const sig = falso({ conteudo: falha(new ErroSei("SEI_SIGILOSO", "x")) as never });
    igual("sigiloso nao baixa", await sig.t.baixarArquivo({ numero: "1" }), {
      situacao: "pulado",
      erro: "Sigiloso: fora das Ações em Lote",
    });
    checar("nada baixado", sig.baixados.length === 0);

    const ex = await exec(t, { acao: "baixar", modo: "arquivos" });
    checar("executar baixar arquivos baixa", ex.situacao === "ok" && baixados.length === 2, ex);
  }
  {
    const { t, baixados } = falso();
    await t.zipAdicionar({ numero: "0001234", loteId: "L1" });
    await t.zipAdicionar({ numero: "0001234", loteId: "L1" });
    await exec(t, { acao: "baixar", modo: "zip" }, "0001234");
    checar("zip so guarda ate fechar", baixados.length === 0);
    const r = (await t.zipFechar({ nome: "Meu lote?" })) as { situacao: string };
    igual("zip fecha e baixa", [r.situacao, baixados[0]?.nome, baixados[0]?.tipo], ["ok", "Meu lote.zip", "application/zip"]);
    const conteudo = unzipSync(baixados[0].bytes);
    igual("tres entradas, nomes unicos", Object.keys(conteudo).sort(), [
      "0001234 - Despacho 1 (2).html",
      "0001234 - Despacho 1 (3).html",
      "0001234 - Despacho 1.html",
    ]);
    igual("zip limpo depois de fechar", (await t.zipFechar({ nome: "x" })) as unknown, {
      situacao: "erro",
      erro: "Nenhum arquivo foi guardado para o ZIP.",
    });
  }
  secao("Executor: HTML baixado com o charset coerente com os bytes (o SEI declara iso-8859-1)");
  {
    const SEI =
      '<?xml version="1.0" encoding="iso-8859-1"?><html><head><meta http-equiv="Content-Type" content="text/html; charset=iso-8859-1" /></head><body><p>vers\u00E3o</p></body></html>';
    const conteudoSei = (async () => ({ titulo: "Despacho 1", numero: "0001234", html: SEI })) as never;
    const confere = (nome: string, bytes: Uint8Array | undefined) => {
      const texto = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      checar(`${nome}: bytes em UTF-8 com o acento`, texto.includes("<p>vers\u00E3o</p>"), texto);
      checar(
        `${nome}: declara utf-8 e nunca iso-8859-1`,
        /charset=utf-8/.test(texto) && /encoding="utf-8"/.test(texto) && !/8859/i.test(texto),
        texto,
      );
    };
    const a = falso({ conteudo: conteudoSei });
    await a.t.baixarArquivo({ numero: "0001234" });
    confere("baixar arquivos", a.baixados[0]?.bytes);
    const z = falso({ conteudo: conteudoSei });
    await z.t.zipAdicionar({ numero: "0001234", loteId: "L" });
    await z.t.zipFechar({ nome: "z" });
    confere("zip", unzipSync(z.baixados[0]!.bytes)["0001234 - Despacho 1.html"]);
    const semMeta = falso({
      conteudo: (async () => ({
        titulo: "D",
        numero: "1",
        html: "<html><head><title>x</title></head><body>\u00E7</body></html>",
      })) as never,
    });
    await semMeta.t.baixarArquivo({ numero: "1" });
    checar(
      "sem declaracao: ganha meta charset utf-8 no head",
      new TextDecoder().decode(semMeta.baixados[0]?.bytes).startsWith('<html><head><meta charset="utf-8"><title>'),
      new TextDecoder().decode(semMeta.baixados[0]?.bytes),
    );
  }
  {
    const { t, baixados } = falso();
    await t.zipAdicionar({ numero: "0001234", loteId: "A" });
    await t.zipAdicionar({ numero: "0001234", loteId: "B" });
    await t.zipFechar({ nome: "z" });
    igual("outro loteId descarta o que sobrou do lote cancelado", Object.keys(unzipSync(baixados[0].bytes)), ["0001234 - Despacho 1.html"]);
    await t.zipAdicionar({ numero: "0001234", loteId: "C" });
    igual("zipDescartar", await t.zipDescartar(undefined), true);
    igual("zip vazio depois de descartar", ((await t.zipFechar({ nome: "z" })) as { situacao: string }).situacao, "erro");
    await t.zipAdicionar({ numero: "0001234", loteId: "D" });
    await t.zipFechar({ nome: "x".repeat(300) });
    checar(
      "nome do zip tem no maximo 120 com a extensao",
      baixados[1].nome.length === 120 && baixados[1].nome.endsWith(".zip"),
      baixados[1].nome.length,
    );
  }
  {
    const { t, baixados, log } = falso();
    const r = (await t.pdf({ numeros: ["0001234", "0000123"] })) as { situacao: string; dados?: Record<string, string>; resumo?: string };
    igual("pdf pede os ids pela ordem pedida, com o protocolo", log.find((x) => x.fn === "gerarPdfDocumentos")?.args, [
      "00001.000001/2026-11",
      ["10", "11"],
    ]);
    igual(
      "pdf baixa o link",
      [log.find((x) => x.fn === "baixarLink")?.args, baixados[0]?.nome, baixados[0]?.tipo],
      [["https://x/pdf"], "Processo.pdf", "application/pdf"],
    );
    igual("pdf informa o que ficou de fora (em numeros SEI)", [r.situacao, r.dados?.foraDoPdf], ["ok", "0000123"]);
    igual("pdf com numero fora da arvore", await t.pdf({ numeros: ["9"] }), {
      situacao: "erro",
      erro: "O documento 9 não está na árvore do processo.",
    });
    igual("pdf vazio", await t.pdf({ numeros: [] }), { situacao: "erro", erro: "Nenhum documento para o PDF." });
  }

  secao("Executor: nome de arquivo");
  {
    igual("limpa caracteres proibidos", nomeArquivo("0001", 'A\\B/C:D*E?F"G<H>I|J'), "0001 - A B C D E F G H I J");
    const longo = nomeArquivo("0001234", "x".repeat(300), "pdf");
    checar(
      "corta em 120 contando a extensao",
      longo.length === 120 && longo.endsWith(".pdf") && longo.startsWith("0001234 - x"),
      longo.length,
    );
    const emoji = nomeArquivo("1", `${"x".repeat(111)}\u{1F600}${"y".repeat(20)}`, "pdf");
    checar(
      "corte por pontos de codigo nao parte o emoji",
      !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(emoji) && emoji.includes("\u{1F600}"),
      emoji,
    );
    igual("sem titulo", nomeArquivo("0001", "  "), "0001");
    igual("com extensao", nomeArquivo("0001", "Oficio", ".HTML"), "0001 - Oficio.HTML");
    const z = new AcumuladorZip();
    z.adicionar("a.txt", new Uint8Array([1]));
    checar("acumulador esvazia ao fechar", z.fechar() !== null && z.tamanho === 0 && z.fechar() === null);
  }
}
