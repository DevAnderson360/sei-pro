/**
 * Ponte da aba (src/pagina/executor.ts): o que os tratadores devolvem ao app. JSON simples, sem objeto de erro,
 * sem `infra_hash` e sem `linkArvore`; a releitura da abertura antes de criar no destino coluna; a sessão expirada
 * que pausa o lote; o documento criado (ou talvez criado) que nunca é recriado; e o "Abrir em nova aba" que só
 * abre endereço http(s) do próprio SEI.
 *
 * As chamadas ao SEI entram por `chamadas`; o `Sei` é um falso mínimo (arvore/esquecer), então cada desfecho é
 * forçado sem rede.
 */

import type { Tratador } from "@comum/ponte/rpc";
import type { Arvore } from "@nucleo/dominio/arvore";
import { ErroSei } from "@nucleo/sessao/erros";
import { ErroProcessoCriado } from "@pl/sei/criar";
import { EVENTO_ABRIR as EVENTO_LP } from "../../link-permanente/src/modelo/constantes";
import type { ContextoDocumentos } from "../src/pagina/contexto";
import { type Chamadas, dispararAbrirLinkPermanente, EVENTO_ABRIR_LINK_PERMANENTE, tratadoresDocumentosLote } from "../src/pagina/executor";
import { type DocumentoCriado, ErroDocumentoCriado, type PedidoCriar } from "../src/sei/criar";
import type { Modelo } from "../src/sei/modelo";
import type { ResultadoVerificacao } from "../src/sei/verificar";
import { checar, igual, instalarDom, secao } from "./util";

const H = "f".repeat(64);
const ORIGEM = "https://sei.x.gov.br/sei/controlador.php";
const LINK_ARVORE_TELA = `${ORIGEM}?acao=procedimento_visualizar&id_procedimento=900&infra_hash=${H}`;
const CTX: ContextoDocumentos = {
  host: "sei.x.gov.br",
  login: "ana",
  nomeUsuario: "Ana",
  unidadeSigla: "UNI",
  temaEscuro: false,
  base: `${ORIGEM}?acao=procedimento_trabalhar&id_procedimento=900&infra_hash=${H}`,
  linkArvore: LINK_ARVORE_TELA,
  idProcedimento: "900",
  origem: ORIGEM,
  aba: "aba-1",
};

const INCLUIR = (id: string) => `controlador.php?acao=documento_escolher_tipo&id_procedimento=${id}&infra_hash=${H}`;

function arvore(id: string, protocolo: string, s: "aberto" | "fechado" | "sigiloso" = "aberto"): Arvore {
  return {
    idProcedimento: id,
    protocolo,
    tipo: "Tipo",
    nivel: s === "sigiloso" ? "sigiloso" : "publico",
    marcadores: [],
    documentos: [],
    acoesProcesso: s === "fechado" ? [] : [INCLUIR(id)],
    botoesProcesso: [],
    linkProcesso: "",
    sinais: [],
    links: [],
    pagina: {} as never,
  } as unknown as Arvore;
}

const MODELO: Modelo = { origem: "documento", numero: "0100", titulo: "Oficio 1", tipoId: "12", tipoNome: "Oficio", campos: ["nome"] };
const DOC: DocumentoCriado = {
  idDocumento: "777",
  numero: "0200",
  link: `${ORIGEM}?acao=procedimento_trabalhar&id_procedimento=901&id_documento=777`,
};

/** Falso do `Sei`: a árvore por referência (aberta/fechada/sigilosa) e o registro de `esquecer`/`arvore`. */
function seiFalso(arvores: Record<string, Arvore | Error>) {
  const n = { esquecidos: [] as string[], arvores: [] as Array<{ ref: string; forcar?: boolean }> };
  const sei = {
    http: {},
    esquecer: (ref: string) => n.esquecidos.push(ref),
    arvore: async (ref: string, op: { forcar?: boolean } = {}) => {
      n.arvores.push({ ref, forcar: op.forcar });
      const a = arvores[ref];
      if (!a) throw new ErroSei("SEI_NAO_ENCONTRADO", `nada para ${ref}`);
      if (a instanceof Error) throw a;
      return a;
    },
  };
  return { sei, n };
}

function montar(o: { arvores?: Record<string, Arvore | Error>; chamadas?: Partial<Chamadas> } = {}) {
  const { sei, n } = seiFalso(o.arvores ?? {});
  const reg = { criar: [] as PedidoCriar[], abertas: [] as string[], fechar: 0, minimizar: [] as boolean[], abrirArvore: 0 };
  const chamadas: Partial<Chamadas> = {
    abrirArvore: async (_sei, link) => {
      reg.abrirArvore++;
      checar("abrirArvore recebe o link da tela", link === LINK_ARVORE_TELA, link);
      return arvore("900", "00001.000900/2026-00");
    },
    criarDocumentoDaLinha: async (_sei, p) => {
      reg.criar.push(p);
      return DOC;
    },
    ...o.chamadas,
  };
  const t = tratadoresDocumentosLote({
    sei: sei as never,
    ctx: CTX,
    fechar: () => reg.fechar++,
    minimizar: (m) => reg.minimizar.push(m),
    abrirJanela: (url) => reg.abertas.push(url),
    chamadas,
  });
  return { t, n, reg };
}

const BASE_PEDIDO = {
  modelo: MODELO,
  linha: { nome: "Maria", processo: "00002.000001/2026-11" },
  colunaNome: "nome",
  modeloDescricao: "Para ##nome##",
  nivel: "publico",
  camposCruzados: { nome: "nome" },
};
const PEDIDO_COLUNA = { ...BASE_PEDIDO, alvo: { tipo: "coluna", numero: "00002.000001/2026-11" } };
const PEDIDO_TELA = { ...BASE_PEDIDO, alvo: { tipo: "tela" } };

/** Todo retorno visto pelo app passa por aqui: nada de infra_hash nem linkArvore no JSON. */
const vistos: unknown[] = [];
async function chamar(t: Record<string, Tratador>, op: string, args?: unknown): Promise<Record<string, unknown>> {
  const r = await t[op]!(args);
  vistos.push({ op, r });
  return r as Record<string, unknown>;
}

export async function verificarExecutor(): Promise<void> {
  secao("Executor: contexto");
  {
    const { t } = montar();
    const c = await chamar(t, "contexto");
    checar("contexto sem base nem linkArvore", !("base" in c) && !("linkArvore" in c), c);
    checar(
      "contexto com o que o app usa",
      c.host === "sei.x.gov.br" && c.login === "ana" && c.unidadeSigla === "UNI" && c.aba === "aba-1",
      c,
    );
  }

  secao("Executor: criar no destino coluna relê a abertura antes");
  {
    const { t, n, reg } = montar({ arvores: { "00002.000001/2026-11": arvore("901", "00002.000001/2026-11", "fechado") } });
    const r = await chamar(t, "criar", PEDIDO_COLUNA);
    checar("processo que perdeu o link: naoAberto", r.situacao === "erro" && r.naoAberto === true && typeof r.erro === "string", r);
    checar("sem chamar criarDocumentoDaLinha", reg.criar.length === 0, reg.criar);
    checar(
      "arvore lida sem cache",
      n.arvores.some((a) => a.ref === "00002.000001/2026-11" && a.forcar === true),
      n.arvores,
    );
  }
  {
    const { t, reg } = montar({ arvores: { "00002.000001/2026-11": arvore("901", "00002.000001/2026-11", "sigiloso") } });
    const r = await chamar(t, "criar", PEDIDO_COLUNA);
    checar("sigiloso: erro sem criar", r.situacao === "erro" && !r.naoAberto && reg.criar.length === 0, r);
  }
  {
    const { t, reg } = montar({ arvores: { "00002.000001/2026-11": arvore("901", "00002.000001/2026-11") } });
    const r = await chamar(t, "criar", PEDIDO_COLUNA);
    igual("aberto: ok com o documento", r, { situacao: "ok", criado: DOC });
    const p = reg.criar[0];
    checar("processo = numero da coluna, origem do contexto", p?.processo === "00002.000001/2026-11" && p?.origem === ORIGEM, p);
    checar("pedido repassa modelo e linha", p?.modelo.tipoId === "12" && p?.linha.nome === "Maria" && p?.nivel === "publico", p);
  }
  {
    const { t, reg } = montar({
      arvores: { "00002.000001/2026-11": new ErroSei("SEI_SESSAO_EXPIRADA", "Sessão expirada.") },
    });
    const r = await chamar(t, "criar", PEDIDO_COLUNA);
    checar("sessao na releitura: sessao", r.situacao === "erro" && r.sessao === true && reg.criar.length === 0, r);
  }

  secao("Executor: criar no destino tela resolve o protocolo uma vez");
  {
    const { t, reg } = montar();
    await chamar(t, "criar", PEDIDO_TELA);
    await chamar(t, "criar", PEDIDO_TELA);
    checar("abrirArvore da tela 1 vez", reg.abrirArvore === 1, reg.abrirArvore);
    checar(
      "processo = protocolo da tela",
      reg.criar.every((p) => p.processo === "00001.000900/2026-00"),
      reg.criar,
    );
  }
  {
    const { t, reg } = montar();
    await chamar(t, "criar", { ...BASE_PEDIDO, alvo: { tipo: "novo-processo", numero: "00003.000001/2026-11" } });
    checar("novo-processo: processo = numero criado", reg.criar[0]?.processo === "00003.000001/2026-11", reg.criar);
  }

  secao("Executor: criar traduz as falhas em texto");
  {
    const { t } = montar({
      chamadas: {
        criarDocumentoDaLinha: async () => {
          throw new ErroSei("SEI_SESSAO_EXPIRADA", "Sessão expirada.");
        },
      },
    });
    const r = await chamar(t, "criar", PEDIDO_TELA);
    igual("sessao expirada: sessao", r, { situacao: "erro", erro: "Sessão expirada.", sessao: true });
  }
  {
    let chamadas = 0;
    const { t } = montar({
      chamadas: {
        criarDocumentoDaLinha: async () => {
          chamadas++;
          throw new ErroDocumentoCriado(DOC, new ErroSei("SEI_REDE", "caiu"));
        },
      },
    });
    const r = await chamar(t, "criar", PEDIDO_TELA);
    checar("criado com falha: erro incerto com os dados", r.situacao === "erro" && r.incerto === true, r);
    igual("dados conhecidos", r.criado, DOC);
    checar("erro e texto", typeof r.erro === "string" && (r.erro as string).includes("0200"), r);
    checar("sem recriar", chamadas === 1, chamadas);
  }
  {
    const { t } = montar({
      chamadas: {
        criarDocumentoDaLinha: async () => {
          throw new ErroDocumentoCriado({ idDocumento: "", numero: "", link: "" }, new ErroSei("SEI_REDE", "caiu"));
        },
      },
    });
    const r = await chamar(t, "criar", PEDIDO_TELA);
    checar("talvez criado: incerto sem criado", r.situacao === "erro" && r.incerto === true && !("criado" in r), r);
  }
  {
    const { t } = montar({
      chamadas: {
        criarDocumentoDaLinha: async () => {
          throw new ErroSei("SEI_VALIDACAO", "Tipo recusado.");
        },
      },
    });
    igual("validacao: erro simples", await chamar(t, "criar", PEDIDO_TELA), { situacao: "erro", erro: "Tipo recusado." });
  }
  {
    const { t, reg } = montar();
    const r = await chamar(t, "criar", { ...BASE_PEDIDO, alvo: { tipo: "coluna", numero: "  " } });
    checar("pedido sem numero: erro sem criar", r.situacao === "erro" && reg.criar.length === 0, r);
    const r2 = await chamar(t, "criar", { ...PEDIDO_TELA, modelo: undefined });
    checar("pedido sem modelo: erro sem criar", r2.situacao === "erro" && reg.criar.length === 0, r2);
  }

  secao("Executor: verificar");
  {
    const res: ResultadoVerificacao = {
      numero: "00002.000001/2026-11",
      status: "nao-aberto",
      idProcedimento: "901",
      linkArvore: `${ORIGEM}?acao=procedimento_visualizar&id_procedimento=901&infra_hash=${H}`,
      mensagem: "O processo não está aberto nesta unidade.",
    };
    const ordem: string[] = [];
    const { t, n, reg } = montar({
      chamadas: {
        verificarProcesso: async (_sei, numero, tipoId) => {
          ordem.push(`verificar:${numero}:${tipoId}:${n.esquecidos.length}`);
          return res;
        },
      },
    });
    const r = await chamar(t, "verificar", { numero: "00002.000001/2026-11", tipoId: "12" });
    igual("repassa o resultado sem linkArvore", r, {
      numero: "00002.000001/2026-11",
      status: "nao-aberto",
      idProcedimento: "901",
      mensagem: "O processo não está aberto nesta unidade.",
    });
    checar("sem deNovo nao esquece", n.esquecidos.length === 0, n.esquecidos);
    await chamar(t, "verificar", { numero: "00002.000001/2026-11", tipoId: "12", deNovo: true });
    checar(
      "deNovo: esquece antes de verificar",
      n.esquecidos[0] === "00002.000001/2026-11" && ordem[1] === "verificar:00002.000001/2026-11:12:1",
      {
        e: n.esquecidos,
        ordem,
      },
    );

    secao("Executor: abrirAba");
    const a = await chamar(t, "abrirAba", { numero: "00002.000001/2026-11" });
    checar("abre o processo verificado", a.aberto === true && reg.abertas.length === 1, { a, abertas: reg.abertas });
    const url = reg.abertas[0] ?? "";
    checar(
      "na tela do processo, sem infra_hash, mesmo host",
      url.startsWith(`${ORIGEM}?`) && url.includes("id_procedimento=901") && !url.includes("infra_hash"),
      url,
    );
    const sem = await chamar(t, "abrirAba", { numero: "99999.999999/2026-99" });
    checar("numero nunca verificado: nao abre", sem.aberto === false && reg.abertas.length === 1, sem);
    const idSolto = await chamar(t, "abrirAba", { idProcedimento: "123" });
    checar("id nunca registrado: nao abre", idSolto.aberto === false && reg.abertas.length === 1, idSolto);
    const idVerificado = await chamar(t, "abrirAba", { idProcedimento: "901" });
    checar("id registrado por verificar: abre", idVerificado.aberto === true && reg.abertas.length === 2, idVerificado);
    reg.abertas.pop();
    for (const u of [
      "javascript:alert(1)",
      "data:text/html,oi",
      "https://outro.gov.br/sei/controlador.php?acao=procedimento_trabalhar&id_procedimento=1",
      "ftp://sei.x.gov.br/x",
      "nao e url",
    ]) {
      const x = await chamar(t, "abrirAba", { url: u });
      checar(`recusa ${u.slice(0, 24)}`, x.aberto === false, x);
    }
    checar("nada aberto pelas recusas", reg.abertas.length === 1, reg.abertas);
    const ok = await chamar(t, "abrirAba", { url: DOC.link });
    checar("link do documento no mesmo host: abre", ok.aberto === true && reg.abertas[1] === DOC.link, { ok, abertas: reg.abertas });
  }
  {
    const { t } = montar({
      chamadas: {
        verificarProcesso: async (_sei, numero) => ({
          numero,
          status: "nao-encontrado",
          mensagem: "Abra uma tela do SEI (por exemplo, Controle de Processos) nesta aba.",
        }),
      },
    });
    const r = await chamar(t, "verificar", { numero: "1/2", tipoId: "12" });
    checar("sem tela base do SEI: erro-rede (tentar de novo), nao nao-encontrado", r.status === "erro-rede", r);
  }
  {
    const { t } = montar();
    const r = await chamar(t, "verificar", { numero: "", tipoId: "" });
    checar("verificar sem numero: nao-encontrado", r.status === "nao-encontrado", r);
  }

  secao("Executor: modelos");
  {
    const { t } = montar({
      chamadas: {
        listarModelos: async (_sei, ref) => {
          checar("listarModelos pelo protocolo da tela", ref === "00001.000900/2026-00", ref);
          return { documentos: [{ numero: "0100", titulo: "Oficio 1" }], textosPadrao: [], tipos: [{ id: "12", nome: "Oficio" }] };
        },
        lerModelo: async (_sei, escolha) => {
          if ("documento" in escolha && escolha.documento === "0300") {
            throw new ErroSei("SEI_ACAO_INDISPONIVEL", "O documento 0300 não pode ser alterado por você.");
          }
          return MODELO;
        },
      },
    });
    const l = await chamar(t, "listarModelos");
    checar("listarModelos ok", l.situacao === "ok" && (l.modelos as { documentos: unknown[] }).documentos.length === 1, l);
    igual("lerModelo ok", await chamar(t, "lerModelo", { documento: "0100" }), { situacao: "ok", modelo: MODELO });
    const e = await chamar(t, "lerModelo", { documento: "0300" });
    checar(
      "lerModelo sem Alterar Documento: erro em texto",
      e.situacao === "erro" && typeof e.erro === "string" && (e.erro as string).includes("0300"),
      e,
    );
    const inval = await chamar(t, "lerModelo", { qualquer: 1 });
    checar("lerModelo escolha invalida: erro", inval.situacao === "erro", inval);
  }

  secao("Executor: tipos e criarProcesso");
  {
    let forms = 0;
    let posts = 0;
    const respostas: Array<() => { numero: string; idProcedimento: string; url: string }> = [
      () => {
        throw new ErroSei("SEI_VALIDACAO", "recusado");
      },
      () => ({ numero: "00003.000001/2026-11", idProcedimento: "55", url: `${ORIGEM}?acao=procedimento_trabalhar&id_procedimento=55` }),
    ];
    const { t } = montar({
      chamadas: {
        listarTipos: async () => [{ id: "1", nome: "Tipo A" }],
        carregarFormTipo: async (_sei, idTipo) => {
          forms++;
          return {
            idTipo,
            action: `controlador.php?acao=procedimento_gerar&infra_hash=${H}`,
            params: [],
            hipoteses: [],
            assuntos: "",
            interessados: "",
          };
        },
        criarProcesso: async () => respostas[posts++]!(),
      },
    });
    igual("tiposProcesso", await chamar(t, "tiposProcesso"), { situacao: "ok", tipos: [{ id: "1", nome: "Tipo A" }] });
    const r = await chamar(t, "criarProcesso", { idTipo: "1", especificacao: "Lote" });
    checar("criarProcesso refaz o formulario 1 vez", r.situacao === "ok" && forms === 2 && posts === 2, { r, forms, posts });
    igual("criado do processo", r.criado, {
      numero: "00003.000001/2026-11",
      idProcedimento: "55",
      url: `${ORIGEM}?acao=procedimento_trabalhar&id_procedimento=55`,
    });
    const semTipo = await chamar(t, "criarProcesso", { especificacao: "x" });
    checar("criarProcesso sem tipo: erro", semTipo.situacao === "erro", semTipo);
    const semHip = await chamar(t, "criarProcesso", { idTipo: "1", especificacao: "x", nivelAcesso: "1" });
    checar("restrito sem hipotese: erro sem POST", semHip.situacao === "erro" && posts === 2, semHip);
  }
  {
    const { t } = montar({
      chamadas: {
        carregarFormTipo: async (_sei, idTipo) => ({ idTipo, action: "x", params: [], hipoteses: [], assuntos: "", interessados: "" }),
        criarProcesso: async () => {
          throw new ErroProcessoCriado("00003.000002/2026-11");
        },
      },
    });
    const r = await chamar(t, "criarProcesso", { idTipo: "1", especificacao: "x" });
    checar(
      "processo criado sem id, numero conhecido: ok com aviso",
      r.situacao === "ok" && typeof r.aviso === "string" && r.aviso !== "",
      r,
    );
    igual("numero conhecido segue como destino", r.criado, { numero: "00003.000002/2026-11" });
  }
  {
    const formSimples = async (_sei: unknown, idTipo: string) => ({
      idTipo,
      action: "x",
      params: [],
      hipoteses: [],
      assuntos: "",
      interessados: "",
    });
    const { t } = montar({
      chamadas: {
        carregarFormTipo: formSimples,
        criarProcesso: async () => {
          throw new ErroProcessoCriado("");
        },
      },
    });
    const r = await chamar(t, "criarProcesso", { idTipo: "1", especificacao: "x" });
    checar("processo criado sem id nem numero: erro incerto", r.situacao === "erro" && r.incerto === true && !("criado" in r), r);
    const { t: t2 } = montar({
      chamadas: {
        carregarFormTipo: formSimples,
        criarProcesso: async () => {
          throw new ErroSei("SEI_REDE", "caiu");
        },
      },
    });
    const r2 = await chamar(t2, "criarProcesso", { idTipo: "1", especificacao: "x" });
    checar("rede no POST: erro incerto", r2.situacao === "erro" && r2.incerto === true, r2);
  }
  {
    let posts = 0;
    const url = `${ORIGEM}?acao=procedimento_trabalhar&id_procedimento=56`;
    const { t, reg } = montar({
      chamadas: {
        carregarFormTipo: async (_sei, idTipo) => ({ idTipo, action: "x", params: [], hipoteses: [], assuntos: "", interessados: "" }),
        criarProcesso: async () => {
          posts++;
          return { numero: "", idProcedimento: "56", url, aviso: "numero nao identificado" };
        },
      },
    });
    const r = await chamar(t, "criarProcesso", { idTipo: "1", especificacao: "x" });
    checar("criado sem numero legivel: erro incerto (nao repetir)", r.situacao === "erro" && r.incerto === true && posts === 1, r);
    checar(
      "texto manda conferir no Controle de Processos",
      typeof r.erro === "string" && (r.erro as string).includes("Controle de Processos"),
      r,
    );
    igual("dados conhecidos do processo", r.criado, { idProcedimento: "56", url });
    const a = await chamar(t, "abrirAba", { idProcedimento: "56" });
    checar("abrirAba abre id registrado por criarProcesso", a.aberto === true && reg.abertas.length === 1, { a, abertas: reg.abertas });
  }
  {
    const { t } = montar({
      chamadas: {
        carregarFormTipo: async () => {
          throw new ErroSei("SEI_SESSAO_EXPIRADA", "Sessão expirada.");
        },
        listarTipos: async () => {
          throw new ErroSei("SEI_SESSAO_EXPIRADA", "Sessão expirada.");
        },
      },
    });
    const r = await chamar(t, "criarProcesso", { idTipo: "1", especificacao: "x" });
    checar("criarProcesso sessao: sessao", r.situacao === "erro" && r.sessao === true, r);
    const tp = await chamar(t, "tiposProcesso");
    checar("tiposProcesso sessao: sessao", tp.situacao === "erro" && tp.sessao === true, tp);
  }

  secao("Executor: fechar e minimizar");
  {
    const { t, reg } = montar();
    checar("fechar", (await t.fechar!(undefined)) === true && reg.fechar === 1);
    await t.minimizar!({ minimizado: true });
    await t.minimizar!({ minimizado: false });
    igual("minimizar", reg.minimizar, [true, false]);
  }

  secao("Executor: recarregarArvore (D2)");
  {
    const { sei } = seiFalso({});
    let recargas = 0;
    const comGancho = (recarregarArvore: () => void) =>
      tratadoresDocumentosLote({ sei: sei as never, ctx: CTX, fechar: () => {}, minimizar: () => {}, recarregarArvore });
    const ok = await chamar(
      comGancho(() => {
        recargas += 1;
      }),
      "recarregarArvore",
    );
    igual("recarregou: ok", ok, { situacao: "ok" });
    igual("uma recarga", recargas, 1);
    const falhou = await chamar(
      comGancho(() => {
        throw new Error("sem árvore na tela");
      }),
      "recarregarArvore",
    );
    igual("falha vira texto (não lança)", falhou, { situacao: "erro", erro: "sem árvore na tela" });

    // Padrão: recarrega o #ifrArvore da página de topo; sem ele, erro em texto.
    const doc = instalarDom('<html><body><iframe id="ifrArvore"></iframe></body></html>');
    const ifr = doc.getElementById("ifrArvore") as HTMLIFrameElement;
    let recarregado = 0;
    Object.defineProperty(ifr, "contentWindow", {
      value: { location: { reload: () => void recarregado++ } },
      configurable: true,
    });
    const padrao = tratadoresDocumentosLote({ sei: sei as never, ctx: CTX, fechar: () => {}, minimizar: () => {}, documento: () => doc });
    igual("padrão: ok", await chamar(padrao, "recarregarArvore"), { situacao: "ok" });
    igual("padrão: reload do contentWindow da árvore", recarregado, 1);
    const semArvore = instalarDom("<html><body></body></html>");
    const r = await chamar(
      tratadoresDocumentosLote({ sei: sei as never, ctx: CTX, fechar: () => {}, minimizar: () => {}, documento: () => semArvore }),
      "recarregarArvore",
    );
    checar("sem árvore na tela: erro em texto", r.situacao === "erro" && typeof r.erro === "string" && r.erro !== "", r);
  }

  secao("Executor: abrirLinkPermanente dispara o evento do Link Permanente (Tarefa 14b)");
  {
    const { t } = montar();
    checar("sem o gancho na aba: false", (await t.abrirLinkPermanente!(undefined)) === false);
    let abertos = 0;
    const { sei } = seiFalso({});
    const t2 = tratadoresDocumentosLote({
      sei: sei as never,
      ctx: CTX,
      fechar: () => {},
      minimizar: () => {},
      abrirLinkPermanente: () => {
        abertos += 1;
      },
    });
    checar("com o gancho: true e uma abertura", (await t2.abrirLinkPermanente!(undefined)) === true && abertos === 1, abertos);
    const doc = instalarDom();
    const vistos: string[] = [];
    doc.addEventListener(EVENTO_ABRIR_LINK_PERMANENTE, (ev) => vistos.push(ev.type));
    dispararAbrirLinkPermanente(doc);
    igual("evento no document com o nome do Link Permanente", vistos, ["spro-link-permanente-abrir"]);
    igual("mesma string do pacote link-permanente", EVENTO_ABRIR_LINK_PERMANENTE, EVENTO_LP);
  }

  secao("Executor: nada de infra_hash nem linkArvore para o app");
  {
    const json = JSON.stringify(vistos);
    checar(`${vistos.length} retornos varridos`, vistos.length > 20, vistos.length);
    checar("sem infra_hash", !json.includes("infra_hash"), json.match(/.{40}infra_hash.{20}/)?.[0]);
    checar("sem linkArvore", !json.includes("linkArvore"));
    checar("sem procedimento_visualizar", !json.includes("procedimento_visualizar"));
  }
}
