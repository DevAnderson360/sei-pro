/**
 * Lado do SEI do Processos em Lote, com um `Http` falso sobre fixtures SINTETICAS (tests/fixtures/LEIAME.txt).
 *
 * O `Http` falso grava cada chamada (metodo, url, pares) e responde pela rota: e assim que as provas comparam
 * exatamente o que iria para o SEI, sem rede. A unica captura real usada e a de `procedimento_alterar` do SEI 4.1.5
 * (sei-nucleo/tests/fixtures/sei41), que tem o mesmo `#frmProcedimentoCadastro` da criacao.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Sei } from "@nucleo/sei";
import { codificarLatin1 } from "@nucleo/sessao/codificacao";
import { analisarHtml, definirAnalisador } from "@nucleo/sessao/dom";
import { ErroSei } from "@nucleo/sessao/erros";
import type { Http, OpcoesHttp, Pagina } from "@nucleo/sessao/http";
import { DOMParser } from "linkedom";
import { criacaoIncerta, criarProcesso, ErroProcessoCriado } from "../src/sei/criar";
import { carregarFormTipo, type FormTipo, lerFormTipo } from "../src/sei/formularioTipo";
import { listarTipos } from "../src/sei/tipos";
import { checar, igual, lanca, secao } from "./util";

const parser = new DOMParser();
definirAnalisador((html) => parser.parseFromString(html, "text/html") as unknown as Document);

const AQUI = dirname(fileURLToPath(import.meta.url));
const BASE = "https://sei.exemplo.gov.br/sei/";

function pagina(url: string, html: string): Pagina {
  let doc: Document | null = null;
  return {
    url,
    status: 200,
    html,
    get doc() {
      if (!doc) doc = analisarHtml(html);
      return doc;
    },
  };
}

/** Fixture com a primeira linha `<!-- url: ... -->` (a URL final da resposta). */
function fixture(nome: string, dir = join(AQUI, "fixtures")): Pagina {
  const bruto = readFileSync(join(dir, nome), "utf8");
  const url = /^<!-- url: (.*?) -->/.exec(bruto)?.[1] ?? `${BASE}controlador.php`;
  return pagina(url, bruto.replace(/^<!-- url: .*? -->\n/, ""));
}

type Pares = Array<[string, string]>;
interface Chamada {
  metodo: "GET" | "POST";
  url: string;
  campos: Pares;
}
interface Rota {
  metodo: "GET" | "POST";
  /** Trecho da URL pedida (depois de resolver contra a raiz). */
  contem: string;
  quando?: (campos: Pares) => boolean;
  resposta: () => Pagina;
}

function httpFalso(rotas: Rota[]): Http & { chamadas: Chamada[] } {
  const base = new URL(BASE);
  const absoluta = (url: string) => new URL(url.replace(/&amp;/g, "&"), base).href;
  const chamadas: Chamada[] = [];
  const responder = async (metodo: "GET" | "POST", url: string, campos: Pares): Promise<Pagina> => {
    const abs = absoluta(url);
    chamadas.push({ metodo, url: abs, campos });
    const rota = rotas.find((r) => r.metodo === metodo && abs.includes(r.contem) && (!r.quando || r.quando(campos)));
    if (!rota) throw new Error(`rota nao prevista: ${metodo} ${abs} ${JSON.stringify(campos)}`);
    return rota.resposta();
  };
  return {
    base,
    absoluta,
    chamadas,
    obter: (url: string, _op?: OpcoesHttp) => responder("GET", url, []),
    enviar: (url: string, campos: ReadonlyArray<readonly [string, string]>, _op?: OpcoesHttp) =>
      responder(
        "POST",
        url,
        campos.map(([n, v]) => [n, v] as [string, string]),
      ),
    baixar: async () => {
      throw new Error("baixar nao previsto");
    },
  };
}

/** `Sei` de verdade (linkMenu na tela base, ajax) com o transporte trocado pelo falso. */
function seiCom(http: Http): Sei {
  const menu = fixture("menu.html");
  const sei = new Sei(menu.url, () => menu);
  (sei as unknown as { http: Http }).http = http;
  return sei;
}

const valor = (campos: Pares, nome: string) => campos.find(([n]) => n === nome)?.[1];

const HIPOTESES: Rota = {
  metodo: "POST",
  contem: "acao_ajax=hipotese_legal_select_nome_base_legal",
  resposta: () => pagina(`${BASE}controlador_ajax.php`, readFileSync(join(AQUI, "fixtures", "hipoteses.xml"), "utf8")),
};

function rotasSei5(formDoTipo = "form_tipo.html"): Rota[] {
  return [
    { metodo: "GET", contem: "acao=procedimento_escolher_tipo&infra_item_menu=153", resposta: () => fixture("escolher_tipo_sei5.html") },
    {
      metodo: "POST",
      contem: "acao=procedimento_escolher_tipo&acao_origem=procedimento_escolher_tipo",
      quando: (c) => !valor(c, "hdnIdTipoProcedimento"),
      resposta: () => fixture("lista_completa_sei5.html"),
    },
    {
      metodo: "POST",
      contem: "acao=procedimento_escolher_tipo&acao_origem=procedimento_escolher_tipo",
      quando: (c) => valor(c, "hdnIdTipoProcedimento") === "12",
      resposta: () => fixture(formDoTipo),
    },
    HIPOTESES,
  ];
}

function rotasSei3(): Rota[] {
  return [
    { metodo: "GET", contem: "acao=procedimento_escolher_tipo&infra_item_menu=153", resposta: () => fixture("escolher_tipo_sei3.html") },
    {
      metodo: "POST",
      contem: "acao=procedimento_escolher_tipo&acao_origem=procedimento_escolher_tipo",
      resposta: () => fixture("lista_completa_sei3.html"),
    },
    {
      metodo: "GET",
      contem:
        "acao=procedimento_gerar&acao_origem=procedimento_escolher_tipo&acao_retorno=procedimento_escolher_tipo&id_tipo_procedimento=12&",
      resposta: () => fixture("form_tipo.html"),
    },
    { metodo: "GET", contem: "id_tipo_procedimento=100&", resposta: () => fixture("sem_formulario.html") },
    HIPOTESES,
  ];
}

const TIPOS = [
  { id: "100", nome: "Licita\u00E7\u00E3o" },
  { id: "12", nome: "Gest\u00E3o de Contrato" },
  { id: "1", nome: "Ouvidoria: Den\u00FAncia" },
];

const ASSUNTOS = "501\u00B1Contratos:+gest\u00E3o+e+fiscaliza\u00E7\u00E3o\u00A5502\u00B1Licita\u00E7\u00F5es+em+geral";

async function verificarTipos(): Promise<void> {
  secao("listarTipos");

  const http5 = httpFalso(rotasSei5());
  igual("SEI 4.1.5+/5 (#frmProcedimentoEscolherTipo): lista completa, sem o (Ouvidoria)", await listarTipos(seiCom(http5)), TIPOS);
  igual(
    "abre a tela do menu e posta os ocultos hdn* com hdnFiltroTipoProcedimento=T",
    http5.chamadas.map((c) => [c.metodo, c.campos]),
    [
      ["GET", []],
      [
        "POST",
        [
          ["hdnInfraTipoPagina", "1"],
          ["hdnFiltroTipoProcedimento", "T"],
          ["hdnIdTipoProcedimento", ""],
        ],
      ],
    ],
  );
  checar("GET pelo link assinado do menu", http5.chamadas[0]?.url.includes("infra_item_menu=153") === true, http5.chamadas[0]?.url);

  const http3 = httpFalso(rotasSei3());
  igual("SEI 3/4.0 (#frmIniciarProcessoEscolhaTipo)", await listarTipos(seiCom(http3)), TIPOS);
  igual("filtro T no SEI 3", http3.chamadas[1]?.campos, [["hdnFiltroTipoProcedimento", "T"]]);

  const semForm = httpFalso([{ metodo: "GET", contem: "infra_item_menu=153", resposta: () => fixture("sem_formulario.html") }]);
  const e = await lanca(() => listarTipos(seiCom(semForm)));
  checar("tela sem nenhum dos dois formularios lanca ErroSei", e?.codigo === "SEI_VERSAO_NAO_SUPORTADA", e);
}

async function verificarFormTipo(): Promise<FormTipo> {
  secao("carregarFormTipo");

  const http5 = httpFalso(rotasSei5());
  const form = await carregarFormTipo(seiCom(http5), "12");
  const escolha = http5.chamadas[2];
  checar(
    "SEI 5: o tipo e escolhido por POST (links '#')",
    escolha?.metodo === "POST" && valor(escolha.campos, "hdnIdTipoProcedimento") === "12",
    escolha,
  );
  checar("o POST da escolha leva o filtro T da lista completa", valor(escolha?.campos ?? [], "hdnFiltroTipoProcedimento") === "T", escolha);
  igual("idTipo", form.idTipo, "12");
  checar(
    "action do #frmProcedimentoCadastro, sem &amp;",
    form.action.startsWith("controlador.php?acao=procedimento_gerar&acao_origem=procedimento_gerar&id_tipo_procedimento=12&"),
    form.action,
  );
  igual("hipoteses por AJAX, sem value=null", form.hipoteses, [
    { id: "34", nome: "Controle Interno (Art. 26, \u00A7 3\u00BA, da Lei n\u00BA 10.180/2001)" },
    { id: "7", nome: "Informa\u00E7\u00E3o Pessoal (Art. 31 da Lei n\u00BA 12.527/2011)" },
  ]);
  const ajax = http5.chamadas.find((c) => c.url.includes("controlador_ajax.php"));
  checar("AJAX pela URL assinada achada no HTML cru", ajax?.url.includes(`infra_hash=${"d".repeat(64)}`) === true, ajax?.url);
  igual("AJAX pede o nivel restrito", valor(ajax?.campos ?? [], "staNivelAcesso"), "1");
  igual("assuntos: valor \u00B1 texto, unidos por \u00A5, espaco vira +", form.assuntos, ASSUNTOS);
  igual("interessados no mesmo formato", form.interessados, "77\u00B1Fulano+de+Tal");
  checar("params traz os campos do formulario", valor(form.params, "hdnNomeTipoProcedimento") === "Gest\u00E3o de Contrato", form.params);

  const http3 = httpFalso(rotasSei3());
  const form3 = await carregarFormTipo(seiCom(http3), "12");
  checar(
    "SEI 3: o tipo e escolhido pelo link (id exato: 12, nao 1)",
    http3.chamadas[2]?.metodo === "GET" && http3.chamadas[2].url.includes("id_tipo_procedimento=12&"),
    http3.chamadas[2],
  );
  igual("SEI 3: mesmo formulario", form3.assuntos, ASSUNTOS);

  const sem = await lanca(() => carregarFormTipo(seiCom(httpFalso(rotasSei3())), "100"));
  checar(
    "sem #frmProcedimentoCadastro: erro claro",
    sem?.codigo === "SEI_VERSAO_NAO_SUPORTADA" && /formul\u00E1rio deste tipo/.test(sem.message ?? ""),
    sem,
  );

  const fora = await lanca(() => carregarFormTipo(seiCom(httpFalso(rotasSei5())), "999"));
  checar("tipo fora da lista: ARGUMENTO_INVALIDO", fora?.codigo === "ARGUMENTO_INVALIDO", fora);

  // Captura real do SEI 4.1.5 (alterar processo): o mesmo formulario, com a lupa de interessados
  // `selInteressadosProcedimento` e o AJAX das hipoteses no HTML cru.
  const real = fixture("p_procedimento_alterar.html", join(AQUI, "..", "..", "sei-nucleo", "tests", "fixtures", "sei41"));
  const httpReal = httpFalso([HIPOTESES]);
  const formReal = await lerFormTipo(seiCom(httpReal), real, "7");
  igual(
    "captura real: assuntos",
    formReal.assuntos,
    "1287\u00B1004.01.05.002+-+Processo+de+contrata\u00E7\u00E3o+de+servi\u00E7o+de+inform\u00E1tica+e+automa\u00E7\u00E3o",
  );
  igual(
    "captura real: interessados de selInteressadosProcedimento",
    formReal.interessados,
    "100013362\u00B1CGE-CAUD\u00A5100014318\u00B1Cliente+1",
  );
  igual("captura real: hipoteses pelo AJAX", formReal.hipoteses.length, 2);
  return form;
}

async function verificarCriacao(form: FormTipo): Promise<void> {
  secao("criarProcesso");

  const criado: Rota = {
    metodo: "POST",
    contem: "acao=procedimento_gerar&acao_origem=procedimento_gerar",
    resposta: () => fixture("criado.html"),
  };
  const http = httpFalso([criado]);
  const r = await criarProcesso(seiCom(http), form, {
    especificacao: "  Contrato 12 \u2014 aditivo \u201Curgente\u201D  ",
    observacao: "Obs \u2013 lote",
    nivelAcesso: "1",
    hipoteseLegal: "34",
  });
  igual("numero do <title>, id do #ifrArvore, link sem assinatura", r, {
    numero: "99906.713-630.000005/2026-91",
    idProcedimento: "4242",
    url: `${BASE}controlador.php?acao=procedimento_trabalhar&id_procedimento=4242`,
  });
  const post = http.chamadas[0];
  checar("POST no action do formulario", post?.url === new URL(form.action, BASE).href, post?.url);
  igual("pares exatos (ordem do formulario; novos no fim)", post?.campos, [
    ["hdnIdTipoProcedimento", "12"],
    ["hdnNomeTipoProcedimento", "Gest\u00E3o de Contrato"],
    ["txtDescricao", 'Contrato 12 - aditivo "urgente"'],
    ["hdnAssuntos", ASSUNTOS],
    ["hdnInteressados", "77\u00B1Fulano+de+Tal"],
    ["txaObservacoes", "Obs - lote"],
    ["rdoProtocolo", "M"],
    ["hdnFlagProcedimentoCadastro", "2"],
    ["rdoNivelAcesso", "1"],
    ["selHipoteseLegal", "34"],
  ]);
  const corpo = codificarLatin1(post?.campos ?? []);
  checar("corpo sem %u (travessao virou hifen) e sem UTF-8", !/%u/i.test(corpo) && !/%E2/i.test(corpo), corpo);

  const publico = httpFalso([criado]);
  await criarProcesso(seiCom(publico), form, { especificacao: "x".repeat(130), nivelAcesso: "0", hipoteseLegal: "34" });
  const pub = publico.chamadas[0]?.campos ?? [];
  igual("publico: hipotese vazia", valor(pub, "selHipoteseLegal"), "");
  igual("publico: rdoNivelAcesso 0", valor(pub, "rdoNivelAcesso"), "0");
  igual("especificacao cortada em 100", valor(pub, "txtDescricao")?.length, 100);
  igual("sem observacao: vazia", valor(pub, "txaObservacoes"), "");

  const comInteressado = await criarProcesso(seiCom(httpFalso([criado])), form, {
    especificacao: "A",
    interessado: "Fulano de Tal",
    nivelAcesso: "0",
    hipoteseLegal: "",
  });
  igual("interessado ja na lista: sem aviso", comInteressado.aviso, undefined);
  const httpIgn = httpFalso([criado]);
  const ignorado = await criarProcesso(seiCom(httpIgn), form, {
    especificacao: "A",
    interessado: "Beltrano",
    nivelAcesso: "0",
    hipoteseLegal: "",
  });
  igual("interessado fora da lista: aviso", ignorado.aviso, "interessado ignorado");
  igual("e a linha segue com a lista do formulario", valor(httpIgn.chamadas[0]?.campos ?? [], "hdnInteressados"), "77\u00B1Fulano+de+Tal");
  igual("o processo e criado mesmo assim", ignorado.numero, "99906.713-630.000005/2026-91");

  const volta = httpFalso([{ metodo: "POST", contem: "acao=procedimento_gerar", resposta: () => fixture("form_tipo.html") }]);
  const e = await lanca(() => criarProcesso(seiCom(volta), form, { especificacao: "A", nivelAcesso: "0", hipoteseLegal: "" }));
  checar("URL final do formulario: SEI_RESPOSTA_INESPERADA", e?.codigo === "SEI_RESPOSTA_INESPERADA", e);

  const semNumero = httpFalso([
    {
      metodo: "POST",
      contem: "acao=procedimento_gerar",
      resposta: () => {
        const p = fixture("criado.html");
        return pagina(p.url, p.html.replace(/<title>[^<]*<\/title>/, "<title>SEI - Processo</title>"));
      },
    },
  ]);
  const sn = await criarProcesso(seiCom(semNumero), form, { especificacao: "A", nivelAcesso: "0", hipoteseLegal: "" });
  igual("<title> sem numero ('Processo' e descartado)", sn.numero, "");
  igual("confirmado + id + sem numero: retorna com aviso", sn.aviso, "numero nao identificado");
  igual("e o id segue", sn.idProcedimento, "4242");

  // Confirmado (URL de prova) sem id: nem #ifrArvore nem id_procedimento na URL final.
  const semId = (titulo: string) =>
    httpFalso([
      {
        metodo: "POST",
        contem: "acao=procedimento_gerar",
        resposta: () => {
          const p = fixture("criado.html");
          const html = p.html
            .replace(/<iframe id="ifrArvore"[^>]*><\/iframe>/, "")
            .replace(/<title>[^<]*<\/title>/, `<title>${titulo}</title>`);
          return pagina(p.url.replace("&id_procedimento=4242", ""), html);
        },
      },
    ]);
  const ec = await lanca(() =>
    criarProcesso(seiCom(semId("Processo - 99906.000007/2026-11")), form, { especificacao: "A", nivelAcesso: "0", hipoteseLegal: "" }),
  );
  checar("confirmado sem id: ErroProcessoCriado", ec instanceof ErroProcessoCriado, ec);
  checar(
    "com criado === true e codigo SEI_RESPOSTA_INESPERADA",
    ec instanceof ErroProcessoCriado && ec.criado === true && ec.codigo === "SEI_RESPOSTA_INESPERADA",
    ec,
  );
  igual("e o numero do <title>", (ec as ErroProcessoCriado | null)?.numero, "99906.000007/2026-11");
  const ec2 = await lanca(() =>
    criarProcesso(seiCom(semId("SEI - Processo")), form, { especificacao: "A", nivelAcesso: "0", hipoteseLegal: "" }),
  );
  igual("confirmado sem id e sem numero: numero vazio", (ec2 as ErroProcessoCriado | null)?.numero, "");

  secao("criacaoIncerta");
  const falha = (codigo: "SEI_REDE" | "SEI_EXCECAO" | "SEI_VALIDACAO" | "SEI_SESSAO_EXPIRADA") =>
    httpFalso([
      {
        metodo: "POST",
        contem: "acao=procedimento_gerar",
        resposta: () => {
          throw new ErroSei(codigo, codigo);
        },
      },
    ]);
  const doEnvio = async (codigo: "SEI_REDE" | "SEI_EXCECAO" | "SEI_VALIDACAO" | "SEI_SESSAO_EXPIRADA") =>
    lanca(() => criarProcesso(seiCom(falha(codigo)), form, { especificacao: "A", nivelAcesso: "0", hipoteseLegal: "" }));
  checar("ErroProcessoCriado: incerta", criacaoIncerta(ec));
  checar("SEI_REDE no envio: incerta", criacaoIncerta(await doEnvio("SEI_REDE")));
  checar("SEI_EXCECAO no envio: incerta", criacaoIncerta(await doEnvio("SEI_EXCECAO")));
  checar("SEI_VALIDACAO: nao criado", !criacaoIncerta(await doEnvio("SEI_VALIDACAO")));
  checar("SEI_SESSAO_EXPIRADA: nao criado", !criacaoIncerta(await doEnvio("SEI_SESSAO_EXPIRADA")));
  checar("nao confirmado (formulario de volta): nao criado", e !== null && !criacaoIncerta(e));
  checar("erro que nao e ErroSei: nao criado", !criacaoIncerta(new Error("x")));
  checar(
    "detalhe do nao confirmado sem travessao",
    !/\u2014/.test((e as ErroSei | null)?.detalhe ?? "\u2014"),
    (e as ErroSei | null)?.detalhe,
  );
}

export async function verificarSei(): Promise<void> {
  await verificarTipos();
  const form = await verificarFormTipo();
  await verificarCriacao(form);
}
