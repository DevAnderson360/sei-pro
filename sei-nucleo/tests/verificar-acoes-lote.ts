/**
 * Duplicar e mover documento, PDF dos documentos escolhidos (Ações em Lote).
 *
 * Árvore real do SEI SP Treinamento 4.1.5 (`sei41/arvore_completa.html`) e as
 * telas reais de alteração, escolha de tipo e PDF, servidas por um servidor
 * falso por baixo do transporte de verdade (mesmo arranjo de
 * `verificar-documento-dados.ts`).
 *
 * SINTÉTICO (substituir por captura na Tarefa 13): a tela de mover
 * (`sei41/documento_mover.html`), o XML do `protocolo_RI1023`, a tela
 * `documento_selecionar` da lupa do PDF e a tela de cadastro do documento novo
 * (aqui derivada da tela de alteração, que usa o mesmo `#frmDocumentoCadastro`).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { lerArvore, type Arvore } from "../src/dominio/arvore";
import { criarDocumento, duplicarDocumento, tipoDoDocumento } from "../src/dominio/documento";
import { moverDocumento, resolverProcessoDestino } from "../src/dominio/moverDocumento";
import { gerarPdfDocumentos } from "../src/dominio/pdfProcesso";
import { lerLupa } from "../src/formulario/formulario";
import { Sei } from "../src/sei";
import { checar, fixture, lanca, secao } from "./util";

const AQUI = dirname(fileURLToPath(import.meta.url));
const bruto = (n: string) => readFileSync(join(AQUI, "fixtures", n), "utf8");
const urlDe = (n: string) => /^<!-- url: (.*?) -->/.exec(bruto(n))?.[1] ?? "";
const htmlDe = (n: string) => bruto(n).replace(/^<!-- url: .*? -->\n/, "");

const H0 = "0".repeat(64);
const RAIZ = "https://treinamento.sei.sp.gov.br/sei/";

interface Post {
  url: string;
  pares: Array<[string, string]>;
}

function lerCorpo(corpo: string): Array<[string, string]> {
  const dec = (s: string) => s.replace(/\+/g, " ").replace(/%([0-9A-F]{2})/gi, (_, h: string) => String.fromCharCode(Number.parseInt(h, 16)));
  return corpo
    ? corpo.split("&").map((p) => {
        const i = p.indexOf("=");
        return [dec(p.slice(0, i)), dec(p.slice(i + 1))] as [string, string];
      })
    : [];
}

const valor = (p: Post | undefined, nome: string) => p?.pares.find(([n]) => n === nome)?.[1];

/** Tela de alteração do Despacho 0103947 (id 160173), com ajustes pedidos pelo teste. */
function telaAlterar(o: { numero?: string; restrito?: boolean; observacao?: string; semInteressados?: boolean; assunto?: boolean }): string {
  let h = htmlDe("sei41/despacho_alterar.html");
  if (o.semInteressados) h = h.replace(/(<select id="selInteressados"[^>]*>)[\s\S]*?<\/select>/, "$1</select>");
  if (o.assunto) h = h.replace(/(<select id="selAssuntos"[^>]*>)\s*<\/select>/, '$1<option value="300001">01.01 - Organiza\u00E7\u00E3o</option></select>');
  if (o.numero !== undefined) h = h.replace(/(id="txtNumero"[^>]*value=")[^"]*"/, `$1${o.numero}"`);
  if (o.observacao !== undefined) h = h.replace(/(<textarea id="txaObservacoes"[^>]*>)<\/textarea>/, `$1${o.observacao}</textarea>`);
  if (o.restrito) {
    h = h
      .replace(/(id="optPublico"[^>]*?) checked="checked"/, "$1")
      .replace(/(id="optRestrito"[^>]*?value="1")/, '$1 checked="checked"')
      .replace(/(id="hdnStaNivelAcessoLocal"[^>]*value=")0"/, '$11"')
      .replace(/(id="hdnIdHipoteseLegal"[^>]*value=")"/, '$134"');
  }
  return h;
}

/** Tela de cadastro do documento novo: o mesmo `#frmDocumentoCadastro`, vazio e apontando para `documento_cadastrar`. */
function telaCadastro(preenchida = false): string {
  let h = htmlDe("sei41/despacho_alterar.html")
    .replace(/acao=documento_alterar&acao_origem=documento_alterar/g, "acao=documento_cadastrar&acao_origem=documento_cadastrar")
    .replace(/(id="txtDescricao"[^>]*value=")[^"]*"/, '$1"');
  // Preenchida: a tela de cadastro já traz interessados (os do processo) e um assunto sugerido pelo tipo.
  if (preenchida) h = h.replace(/(<select id="selAssuntos"[^>]*>)\s*<\/select>/, '$1<option value="300009">Assunto sugerido</option></select>');
  else h = h.replace(/(<select id="selInteressados"[^>]*>)[\s\S]*?<\/select>/, "$1</select>");
  return h;
}

const LINK_SELECIONAR_PDF = `controlador.php?acao=documento_selecionar&tipo_selecao=2&id_object=objLupaDocumentosApenas&id_procedimento=148265&tipo_selecao_documento=PDF&arvore=1&id_procedimento=148265&infra_sistema=100000100&infra_unidade_atual=110000001&infra_hash=${H0}`;

/** `documento_selecao.php` do SEI 5: uma linha por documento, `chkInfraItemN` com value = id_documento. */
function telaSelecao(docs: Array<[string, string]>, o: { paginaSeguinte?: boolean } = {}): string {
  const linhas = docs
    .map(([id, t], i) => `<tr class="infraTrClara"><td><input class="infraCheckbox" id="chkInfraItem${i}" name="chkInfraItem${i}" title="${t}" type="checkbox" value="${id}" onclick="infraSelecionarItens(this,'Infra');"/></td><td>${t}</td></tr>`)
    .join("\n");
  const paginar = o.paginaSeguinte ? `<a href="javascript:void(0);" onclick="infraAcaoPaginar('+',0,'Infra');">Pr&oacute;xima</a>` : "";
  return `<html><head><title>SEI - Selecionar Documentos</title></head><body>
<form id="frmDocumentoSelecao" method="post" action="controlador.php?acao=documento_selecionar&acao_origem=documento_selecionar&id_procedimento=148265&tipo_selecao_documento=PDF&infra_sistema=100000100&infra_unidade_atual=110000001&infra_hash=${H0}">
<input type="hidden" id="hdnInfraPaginaAtual" name="hdnInfraPaginaAtual" value="0"/>
<table class="infraTable"><tr><th class="infraTh"></th><th class="infraTh">Documento</th></tr>
${linhas}
</table>${paginar}
</form></body></html>`;
}

const XML_RI1023 =
  '<?xml version="1.0" encoding="iso-8859-1"?>\n<complementos>\n<complemento nome="IdProcedimento">150001</complemento>\n<complemento nome="ProtocoloProcedimentoFormatado">99906.000777/2026-11</complemento>\n<complemento nome="NomeTipoProcedimento">Licitação &amp; Contratos: &amp;lt;Pregão&amp;gt;</complemento>\n</complementos>';
const XML_RI1023_ERRO = '<?xml version="1.0" encoding="iso-8859-1"?>\n<erros><erro descricao="Processo não encontrado."></erro></erros>';
const XML_HIPOTESES = '<?xml version="1.0" encoding="iso-8859-1"?>\n<select>\n<option value="null"> </option><option value="34">Informação Pessoal (Art. 31 da Lei 12.527/2011)</option></select>';

const LINK_DOWNLOAD = `controlador.php?acao=exibir_arquivo&nome_arquivo=sei_pdf_abc.pdf&nome_download=SEI-99906.713-630.000032_2025-82.pdf&acao_origem=procedimento_gerar_pdf&acao_retorno=procedimento_gerar_pdf&infra_sistema=100000100&infra_unidade_atual=110000001&infra_hash=${H0}`;

interface Opcoes {
  alterar?: Parameters<typeof telaAlterar>[0];
  /** Tela de cadastro já com interessados e assunto. */
  cadastroPreenchido?: boolean;
  /** Tela de cadastro com o Número obrigatório (`lblNumero` infraLabelObrigatorio). */
  numeroObrigatorio?: boolean;
  /** Tela de cadastro com a lista de textos padrão (`selTextoPadrao`). */
  textosPadrao?: boolean;
  /** O tipo do original (5) não está na lista da unidade, mas há um tipo com "5" no nome. */
  semTipoOriginal?: boolean;
  processoSigiloso?: boolean;
  ri1023Erro?: boolean;
  moverSemResultado?: boolean;
  moverValidacao?: boolean;
  /** Páginas da lupa do PDF (cada uma, lista de [id, título]). */
  selecao?: Array<Array<[string, string]>>;
  pdfSemLink?: boolean;
  pdfValidacao?: boolean;
}

function montar(o: Opcoes = {}) {
  const estado = { posts: [] as Post[], gets: [] as string[], invalidados: [] as string[] };
  const resp = (url: string, html: string) => {
    const bytes = new Uint8Array([...html].map((c) => c.charCodeAt(0) & 0xff));
    return { url: new URL(url, RAIZ).href, status: 200, arrayBuffer: async () => bytes.buffer } as unknown as Response;
  };
  const telaTipos = () => {
    const h = htmlDe("sei41/p_documento_escolher_tipo.html");
    return o.semTipoOriginal ? h.replace(/escolher\(5\)("[^>]*>)Despacho</, "escolher(9005)$1Despacho 2025<") : h;
  };
  const paginas = o.selecao ?? [[["160173", "Despacho 0103947"], ["148268", "Despacho teste 0094793"]]];
  const fetch = (async (u: string, init?: RequestInit) => {
    if (init?.method !== "POST") {
      estado.gets.push(u);
      if (/acao=documento_alterar&/.test(u)) return resp(u, telaAlterar(o.alterar ?? {}));
      if (/acao=documento_escolher_tipo&/.test(u)) return resp(u, telaTipos());
      if (/acao=documento_mover&/.test(u)) return resp(u, htmlDe("sei41/documento_mover.html"));
      if (/acao=procedimento_gerar_pdf&/.test(u)) return resp(u, htmlDe("sei41/p_procedimento_gerar_pdf.html"));
      if (/acao=documento_selecionar&/.test(u)) return resp(u, telaSelecao(paginas[0], { paginaSeguinte: paginas.length > 1 }));
      return resp(u, "<html><body>?</body></html>");
    }
    const pares = lerCorpo(String(init.body ?? ""));
    estado.posts.push({ url: u, pares });
    const v = (n: string) => pares.find(([k]) => k === n)?.[1];
    if (/acao_ajax=protocolo_RI1023/.test(u)) return resp(u, o.ri1023Erro ? XML_RI1023_ERRO : XML_RI1023);
    if (/acao_ajax=hipotese_legal_select/.test(u)) return resp(u, XML_HIPOTESES);
    if (/acao=documento_escolher_tipo&/.test(u)) {
      if (v("hdnIdSerie")) {
        let h = telaCadastro(o.cadastroPreenchido);
        if (o.numeroObrigatorio) h = h.replace(/(id="lblNumero"[^>]*class=")infraLabelOpcional"/, '$1infraLabelObrigatorio"');
        if (o.textosPadrao) {
          h = h.replace(
            /(<form id="frmDocumentoCadastro"[^>]*>)/,
            '$1<select id="selTextoPadrao" name="selTextoPadrao"><option value="null" selected="selected"> </option><option value="5">OF\u00CDCIO</option><option value="51">Of\u00EDcio 5 anos</option></select>',
          );
        }
        return resp(`controlador.php?acao=documento_cadastrar&acao_origem=documento_escolher_tipo&id_serie=${v("hdnIdSerie")}&infra_hash=${H0}`, h);
      }
      return resp(u, telaTipos());
    }
    if (/acao=documento_cadastrar&/.test(u)) {
      return resp(`controlador.php?acao=arvore_visualizar&acao_origem=documento_gerar&id_procedimento=148265&id_documento=999001&infra_hash=${H0}`, "<html><body>ok</body></html>");
    }
    if (/acao=documento_mover&/.test(u)) {
      if (o.moverValidacao) return resp(u, `<html><body><textarea id="txaInfraValidacao" name="txaInfraValidacao" style="display:none">Documento não pode ser movido.</textarea></body></html>`);
      if (o.moverSemResultado) return resp(u, htmlDe("sei41/documento_mover.html"));
      return resp(`controlador.php?acao=documento_mover&acao_origem=documento_mover&resultado=1&id_procedimento=148265&id_documento=160172-77&arvore=1&infra_hash=${H0}`, "<html><head><script>parent.parent.document.getElementById('ifrArvore').src = 'x';</script></head></html>");
    }
    if (/acao=documento_selecionar&/.test(u)) {
      const n = Number(v("hdnInfraPaginaAtual") ?? "0");
      return resp(u, telaSelecao(paginas[n] ?? [], { paginaSeguinte: n + 1 < paginas.length }));
    }
    if (/acao=procedimento_gerar_pdf&/.test(u)) {
      if (o.pdfValidacao) return resp(u, `<html><body><textarea id="txaInfraValidacao" name="txaInfraValidacao" style="display:none">Nenhum documento selecionado.</textarea></body></html>`);
      const script = o.pdfSemLink ? "" : `document.getElementById('ifrDownload').src = '${LINK_DOWNLOAD}';`;
      return resp(u, `<html><head><script>function inicializar(){\n  ${script}\n}</script></head><body><form id="frmProcedimentoPdf"></form><iframe id="ifrDownload"></iframe></body></html>`);
    }
    return resp(u, "<html><body>?</body></html>");
  }) as unknown as typeof globalThis.fetch;

  const sei = new Sei(urlDe("sei41/arvore_completa.html"), null, { fetch });
  const arvore = lerArvore(fixture("sei41/arvore_completa.html"));
  if (o.processoSigiloso) arvore.nivel = "sigiloso";
  let criado = false;
  Object.assign(sei, {
    localizar: async (ref: string) => {
      const doc = arvore.documentos.find((d) => d.numero === ref);
      return { idProcedimento: arvore.idProcedimento, idDocumento: doc?.id, linkArvore: "" };
    },
    arvore: async () => {
      if (!criado && estado.posts.some((p) => /acao=documento_cadastrar&/.test(p.url))) {
        criado = true;
        arvore.documentos.push({ ...arvore.documentos[4], id: "999001", numero: "0109999", titulo: "Despacho Fulano de Tal", acoes: [] });
      }
      return arvore as Arvore;
    },
    invalidar: (id?: string) => {
      estado.invalidados.push(id ?? "*");
    },
  });
  return { sei, estado, arvore };
}

const PREVIA = { aplicar: false } as const;
const APLICAR = { aplicar: true } as const;
const ehCadastro = (p: Post) => /acao=documento_cadastrar&/.test(p.url);

export async function verificarAcoesLote(): Promise<void> {
  secao("acoes em lote: duplicar documento");
  {
    const { sei, estado } = montar({ alterar: { observacao: "Obs da unidade" } });
    const r = await duplicarDocumento(sei, "0103947", APLICAR);
    const escolha = estado.posts.find((p) => /acao=documento_escolher_tipo&/.test(p.url) && valor(p, "hdnIdSerie"));
    const post = estado.posts.find(ehCadastro);
    checar("tipo do original (hdnIdSerie 5) escolhido na tela de tipos", valor(escolha, "hdnIdSerie") === "5", escolha?.pares);
    checar("texto inicial = documento modelo (rdoTextoInicial D)", valor(post, "rdoTextoInicial") === "D", post?.pares);
    checar("txtProtocoloDocumentoTextoBase = numero do original", valor(post, "txtProtocoloDocumentoTextoBase") === "0103947");
    checar("descricao copiada", valor(post, "txtDescricao") === "Teste SEI Pro editor", valor(post, "txtDescricao"));
    const interessados = lerLupa(valor(post, "hdnInteressados") ?? "");
    checar("interessados copiados (tela de cadastro nasce vazia)", interessados.map((i) => i.id).join(",") === "100013362,100014318", interessados);
    checar("observacao copiada", valor(post, "txaObservacoes") === "Obs da unidade", valor(post, "txaObservacoes"));
    checar("nivel publico copiado", valor(post, "rdoNivelAcesso") === "0" && valor(post, "hdnStaNivelAcessoLocal") === "0");
    checar("flag de cadastro 2", valor(post, "hdnFlagDocumentoCadastro") === "2");
    checar("dados: id e numero do documento novo", r.aplicado && r.dados?.idDocumento === "999001" && r.dados?.numero === "0109999", r);
    checar("resumo usa o titulo do no novo na arvore", r.resumo.includes("duplicado: Despacho Fulano de Tal (0109999) no processo"), r.resumo);
    checar("arvore do processo invalidada", estado.invalidados.includes("148265"), estado.invalidados);
  }
  {
    const { sei, estado } = montar({ alterar: { numero: "A-12/2026" } });
    await duplicarDocumento(sei, "0103947", APLICAR);
    checar("numero nao numerico e copiado", valor(estado.posts.find(ehCadastro), "txtNumero") === "A-12/2026");
  }
  {
    const { sei, estado } = montar({ alterar: { numero: "123" } });
    await duplicarDocumento(sei, "0103947", APLICAR);
    checar("numero numerico nao e copiado (o SEI numera)", valor(estado.posts.find(ehCadastro), "txtNumero") === "");
  }
  {
    const { sei, estado } = montar({ alterar: { restrito: true } });
    await duplicarDocumento(sei, "0103947", APLICAR);
    const post = estado.posts.find(ehCadastro);
    checar("restrito: nivel e hipotese copiados", valor(post, "rdoNivelAcesso") === "1" && valor(post, "hdnIdHipoteseLegal") === "34" && valor(post, "selHipoteseLegal") === "34", post?.pares);
  }
  {
    const { sei, estado } = montar();
    const r = await duplicarDocumento(sei, "0103947", PREVIA);
    checar("previa: nada gravado", !r.aplicado && !estado.posts.some(ehCadastro) && !estado.posts.some((p) => valor(p, "hdnIdSerie")), estado.posts.map((p) => p.url));
    checar("previa: descreve a copia", r.mudancas.some((m) => m.depois.includes("0103947")), r.mudancas);
  }
  {
    const { sei, estado } = montar();
    const e = await lanca(() => duplicarDocumento(sei, "0103925", APLICAR));
    checar("externo recusado com SEI_ACAO_INDISPONIVEL", e?.codigo === "SEI_ACAO_INDISPONIVEL", e);
    checar("externo: nenhuma tela aberta", estado.gets.length === 0 && estado.posts.length === 0, estado);
  }

  {
    const { sei, estado } = montar({ semTipoOriginal: true });
    const e = await lanca(() => duplicarDocumento(sei, "0103947", APLICAR));
    checar("tipo do original fora da lista: SEI_ACAO_INDISPONIVEL (nao casa 'Despacho 2025' pelo '5')", e?.codigo === "SEI_ACAO_INDISPONIVEL" && /n\u00E3o est\u00E1 dispon\u00EDvel nesta unidade/.test(e.message ?? ""), e);
    checar("tipo do original fora da lista: nenhum cadastro", !estado.posts.some(ehCadastro) && !estado.posts.some((p) => valor(p, "hdnIdSerie")), estado.posts.map((p) => p.url));
  }
  {
    const { sei, estado } = montar({ alterar: { semInteressados: true }, cadastroPreenchido: true });
    await duplicarDocumento(sei, "0103947", APLICAR);
    const post = estado.posts.find(ehCadastro);
    checar("original sem interessados limpa os que a tela de cadastro trouxe", valor(post, "hdnInteressados") === "", valor(post, "hdnInteressados"));
    checar("original sem assuntos mantem o assunto que a tela trouxe", lerLupa(valor(post, "hdnAssuntos") ?? "").map((i) => i.id).join(",") === "300009", valor(post, "hdnAssuntos"));
  }
  {
    const { sei, estado } = montar({ alterar: { assunto: true }, cadastroPreenchido: true });
    await duplicarDocumento(sei, "0103947", APLICAR);
    const post = estado.posts.find(ehCadastro);
    checar("assuntos do original substituem os da tela, exatamente", lerLupa(valor(post, "hdnAssuntos") ?? "").map((i) => i.id).join(",") === "300001", valor(post, "hdnAssuntos"));
  }
  {
    const { sei, estado } = montar({ processoSigiloso: true });
    const e = await lanca(() => duplicarDocumento(sei, "0103947", APLICAR));
    checar("processo sigiloso: SEI_SIGILOSO sem abrir a tela de alteracao", e?.codigo === "SEI_SIGILOSO" && estado.gets.length === 0 && estado.posts.length === 0, { e, gets: estado.gets });
  }

  secao("acoes em lote: tipo por id exato e tipo do documento");
  {
    const { sei, estado } = montar();
    const r = await criarDocumento(sei, "148265", { tipo: "Ata", tipoId: "5" }, PREVIA);
    checar("tipoId vence o nome: previa cita o tipo de id 5 (Despacho), nao 'Ata'", r.resumo.includes("Despacho") && !r.resumo.includes("Ata"), r.resumo);
    checar("previa: nada gravado", !estado.posts.some((p) => valor(p, "hdnIdSerie")), estado.posts.map((p) => p.url));
  }
  {
    const { sei, estado } = montar();
    await criarDocumento(sei, "148265", { tipo: "Ata", tipoId: "5" }, APLICAR);
    const escolha = estado.posts.find((p) => /acao=documento_escolher_tipo&/.test(p.url) && valor(p, "hdnIdSerie"));
    checar("aplicar com tipoId: escolhe hdnIdSerie 5", valor(escolha, "hdnIdSerie") === "5", escolha?.pares);
  }
  {
    const { sei, estado } = montar();
    const e = await lanca(() => criarDocumento(sei, "148265", { tipo: "Despacho", tipoId: "99999" }, APLICAR));
    checar("tipoId inexistente: SEI_ACAO_INDISPONIVEL (o nome nao salva)", e?.codigo === "SEI_ACAO_INDISPONIVEL", e);
    checar("tipoId inexistente: nenhum cadastro", !estado.posts.some(ehCadastro) && !estado.posts.some((p) => valor(p, "hdnIdSerie")), estado.posts.map((p) => p.url));
  }
  {
    const { sei } = montar();
    const r = await criarDocumento(sei, "148265", { tipo: "Despacho" }, PREVIA);
    checar("sem tipoId: casamento por nome como antes", r.resumo.includes("Despacho"), r.resumo);
  }
  secao("acoes em lote: fases do cadastro (acompanharCadastro)");
  {
    const { sei } = montar();
    const fases: unknown[] = [];
    await criarDocumento(sei, "148265", { tipo: "Despacho", tipoId: "5", acompanharCadastro: (f) => fases.push(f) }, APLICAR);
    checar(
      "fases: enviando antes do POST, enviado com id e processo",
      JSON.stringify(fases) === JSON.stringify([{ fase: "enviando" }, { fase: "enviado", idDocumento: "999001", idProcedimento: "148265" }]),
      fases,
    );
  }
  {
    const { sei } = montar();
    const fases: unknown[] = [];
    await criarDocumento(sei, "148265", { tipo: "Despacho", tipoId: "5", acompanharCadastro: (f) => fases.push(f) }, PREVIA);
    checar("previa: nenhuma fase avisada", fases.length === 0, fases);
  }

  secao("acoes em lote: numero se exigido e texto padrao por id");
  {
    const { sei, estado } = montar();
    await criarDocumento(sei, "148265", { tipo: "Despacho", tipoId: "5", nomeArvore: "Fulano", numeroSeExigido: "Fulano" }, APLICAR);
    const post = estado.posts.find(ehCadastro);
    checar("Numero opcional: numeroSeExigido nao entra no txtNumero", valor(post, "txtNumero") === "" && valor(post, "txtNomeArvore") === "Fulano", post?.pares);
  }
  {
    const { sei, estado } = montar({ numeroObrigatorio: true });
    await criarDocumento(sei, "148265", { tipo: "Despacho", tipoId: "5", numeroSeExigido: "Fulano" }, APLICAR);
    checar("Numero obrigatorio: numeroSeExigido vai no txtNumero", valor(estado.posts.find(ehCadastro), "txtNumero") === "Fulano");
  }
  {
    const { sei, estado } = montar({ numeroObrigatorio: true });
    await criarDocumento(sei, "148265", { tipo: "Despacho", tipoId: "5", numero: "N-1", numeroSeExigido: "Fulano" }, APLICAR);
    checar("numero explicito vence numeroSeExigido", valor(estado.posts.find(ehCadastro), "txtNumero") === "N-1");
  }
  {
    const { sei, estado } = montar({ textosPadrao: true });
    await criarDocumento(sei, "148265", { tipo: "Despacho", tipoId: "5", textoPadraoId: "5" }, APLICAR);
    const post = estado.posts.find(ehCadastro);
    checar("textoPadraoId exato: T + id 5", valor(post, "rdoTextoInicial") === "T" && valor(post, "selTextoPadrao") === "5" && valor(post, "hdnIdTextoPadrao") === "5", post?.pares);
  }
  {
    const { sei, estado } = montar({ textosPadrao: true });
    const e = await lanca(() => criarDocumento(sei, "148265", { tipo: "Despacho", tipoId: "5", textoPadraoId: "6" }, APLICAR));
    checar("textoPadraoId fora da lista: SEI_ACAO_INDISPONIVEL sem cadastrar", e?.codigo === "SEI_ACAO_INDISPONIVEL" && !estado.posts.some(ehCadastro), e);
  }
  {
    // SEI 4.1: o texto padrao e escolhido por autocompletar (txtTextoPadrao + hdnIdTextoPadrao), sem select para conferir.
    const { sei, estado } = montar();
    await criarDocumento(sei, "148265", { tipo: "Despacho", tipoId: "5", textoPadraoId: "5" }, APLICAR);
    const post = estado.posts.find(ehCadastro);
    checar("textoPadraoId sem selTextoPadrao (autocompletar do 4.1): id no hdnIdTextoPadrao", valor(post, "rdoTextoInicial") === "T" && valor(post, "hdnIdTextoPadrao") === "5", post?.pares);
  }
  {
    const { sei } = montar();
    const t = await tipoDoDocumento(sei, "0103947");
    checar("tipoDoDocumento devolve id e nome da fixture", t.id === "5" && t.nome === "Despacho", t);
  }
  {
    const { sei } = montar({ semTipoOriginal: true });
    const t = await tipoDoDocumento(sei, "0103947");
    checar("tipoDoDocumento: id fora da lista da unidade nao lanca", t.id === "5" && t.nome.length > 0, t);
  }
  {
    const { sei, estado } = montar({ processoSigiloso: true });
    const e = await lanca(() => tipoDoDocumento(sei, "0103947"));
    checar("tipoDoDocumento: processo sigiloso lanca SEI_SIGILOSO", e?.codigo === "SEI_SIGILOSO", e);
    checar("tipoDoDocumento sigiloso: nenhuma tela de tipos pedida", !estado.gets.some((u) => /acao=documento_escolher_tipo&/.test(u)) && estado.posts.length === 0, estado.gets);
  }
  {
    const { sei } = montar();
    const e = await lanca(() => criarDocumento(sei, "148265", { tipo: "Despacho", tipoId: "99999" }, PREVIA));
    checar("mensagem do tipo ausente e neutra (sem 'original') e traz o id", !/original/.test(e?.message ?? "") && /99999/.test(e?.message ?? ""), e);
  }
  {
    // TODO(T17): apertar para o código exato quando houver captura real de documento externo
    const { sei } = montar();
    const e = await lanca(() => tipoDoDocumento(sei, "0103925"));
    checar("tipoDoDocumento: externo sem hdnIdSerie nao devolve tipo inventado", e?.codigo === "SEI_VERSAO_NAO_SUPORTADA" || e?.codigo === "SEI_ACAO_INDISPONIVEL", e);
  }

  secao("acoes em lote: mover documento");
  {
    const { sei, estado } = montar();
    const destino = await resolverProcessoDestino(sei, "0103925", "99906.000777/2026-11");
    const ajax = estado.posts.find((p) => p.url.includes("acao_ajax=protocolo_RI1023"));
    checar("RI1023: link colhido da tela de mover", !!ajax && ajax.url.includes("infra_hash="), ajax?.url);
    checar("RI1023: envia idProcedimento = protocolo digitado", valor(ajax, "idProcedimento") === "99906.000777/2026-11", ajax?.pares);
    checar("RI1023: id, protocolo e tipo", destino.idProcedimento === "150001" && destino.protocolo === "99906.000777/2026-11", destino);
    checar("RI1023: tipo com entidades desfeitas como o infraRemoverFormatacaoXML", destino.tipo === "Licitação & Contratos: <Pregão>", destino.tipo);
  }
  {
    const { sei } = montar({ ri1023Erro: true });
    const e = await lanca(() => resolverProcessoDestino(sei, "0103925", "999"));
    checar("RI1023 com <erro>: SEI_NAO_ENCONTRADO com a mensagem do SEI", e?.codigo === "SEI_NAO_ENCONTRADO" && /Processo não encontrado/.test(e.message ?? ""), e);
  }
  const destino = { idProcedimento: "150001", protocolo: "99906.000777/2026-11" };
  {
    const { sei, estado } = montar();
    const r = await moverDocumento(sei, "0103925", destino, "Juntado no processo errado", PREVIA);
    checar("previa: nada enviado", !r.aplicado && estado.posts.length === 0, estado.posts);
    checar("previa: origem -> destino", r.mudancas.some((m) => m.antes === "99906.713-630.000032/2025-82" && m.depois === destino.protocolo), r.mudancas);
  }
  {
    const { sei, estado } = montar();
    const r = await moverDocumento(sei, "0103925", destino, "Juntado no processo errado", APLICAR);
    const post = estado.posts.find((p) => /acao=documento_mover&/.test(p.url));
    checar("POST no action do #frmDocumentoMover", !!post && post.url.includes("acao_origem=documento_mover") && post.url.includes("id_documento=160172"), post?.url);
    checar("txtProcedimentoDestino", valor(post, "txtProcedimentoDestino") === destino.protocolo);
    checar("hdnIdProcedimentoDestino", valor(post, "hdnIdProcedimentoDestino") === "150001");
    checar("txaMotivo", valor(post, "txaMotivo") === "Juntado no processo errado");
    checar("sbmMover=Mover", valor(post, "sbmMover") === "Mover", post?.pares);
    checar("aplicado", r.aplicado, r);
    checar("invalida origem e destino", estado.invalidados.includes("148265") && estado.invalidados.includes("150001"), estado.invalidados);
  }
  {
    const { sei } = montar({ moverSemResultado: true });
    const e = await lanca(() => moverDocumento(sei, "0103925", destino, "x", APLICAR));
    checar("sem resultado=1: SEI_RESPOSTA_INESPERADA", e?.codigo === "SEI_RESPOSTA_INESPERADA", e);
  }
  {
    const { sei } = montar({ moverValidacao: true });
    const e = await lanca(() => moverDocumento(sei, "0103925", destino, "x", APLICAR));
    checar("validacao do SEI: SEI_VALIDACAO", e?.codigo === "SEI_VALIDACAO", e);
  }
  {
    const { sei } = montar();
    const e = await lanca(() => moverDocumento(sei, "0103925", destino, "  ", APLICAR));
    checar("motivo vazio: ARGUMENTO_INVALIDO", e?.codigo === "ARGUMENTO_INVALIDO", e);
    const e2 = await lanca(() => moverDocumento(sei, "0103947", destino, "x", PREVIA));
    checar("documento sem a acao de mover: SEI_ACAO_INDISPONIVEL", e2?.codigo === "SEI_ACAO_INDISPONIVEL", e2);
    const e3 = await lanca(() => moverDocumento(sei, "0103925", { idProcedimento: "148265", protocolo: "99906.713-630.000032/2025-82" }, "x", PREVIA));
    checar("destino = origem: ARGUMENTO_INVALIDO", e3?.codigo === "ARGUMENTO_INVALIDO", e3);
  }

  secao("acoes em lote: PDF dos documentos escolhidos");
  {
    const { sei, estado } = montar();
    const r = await gerarPdfDocumentos(sei, "99906.713-630.000032/2025-82", ["148268", "160174", "160173"]);
    const lupa = estado.gets.find((g) => g.includes("acao=documento_selecionar"));
    checar("lupa: link colhido de objLupaDocumentosApenas, sem alterar", !!lupa && lupa.endsWith(LINK_SELECIONAR_PDF), lupa);
    const post = estado.posts.find((p) => /acao=procedimento_gerar_pdf&/.test(p.url));
    checar("rdoTipo=A", valor(post, "rdoTipo") === "A", post?.pares);
    checar("hdnFlagGerar=1", valor(post, "hdnFlagGerar") === "1");
    const itens = lerLupa(valor(post, "hdnDocumentosApenas") ?? "");
    checar("hdnDocumentosApenas: so os oferecidos, na ordem pedida", itens.map((i) => i.id).join(",") === "148268,160173", itens);
    checar("hdnDocumentosApenas: texto da lupa", itens[0]?.texto === "Despacho teste 0094793", itens);
    checar("selDocumentosApenas fora do POST", valor(post, "selDocumentosApenas") === undefined);
    checar("foraDoPdf: o que a lupa nao ofereceu", r.foraDoPdf.join(",") === "160174", r.foraDoPdf);
    checar("link do ifrDownload", r.link === LINK_DOWNLOAD, r.link);
    checar("nome do arquivo (nome_download)", r.nome === "SEI-99906.713-630.000032_2025-82.pdf", r.nome);
  }
  {
    const { sei, estado } = montar({ selecao: [[["160173", "Despacho 0103947"]], [["160174", "Despacho Maria Souza 0103948"]]] });
    const r = await gerarPdfDocumentos(sei, "99906.713-630.000032/2025-82", ["160174", "160173"]);
    const pag = estado.posts.find((p) => /acao=documento_selecionar&/.test(p.url));
    checar("lupa paginada: pede a pagina seguinte", valor(pag, "hdnInfraPaginaAtual") === "1", pag?.pares);
    checar("lupa paginada: oferecidos das duas paginas", r.foraDoPdf.length === 0, r);
  }
  {
    const { sei, estado } = montar();
    const e = await lanca(() => gerarPdfDocumentos(sei, "99906.713-630.000032/2025-82", ["160174"]));
    checar("nenhum oferecido: SEI_ACAO_INDISPONIVEL sem gerar", e?.codigo === "SEI_ACAO_INDISPONIVEL" && !estado.posts.some((p) => /procedimento_gerar_pdf/.test(p.url)), e);
  }
  {
    const { sei } = montar({ pdfValidacao: true });
    const e = await lanca(() => gerarPdfDocumentos(sei, "99906.713-630.000032/2025-82", ["160173"]));
    checar("validacao do SEI: SEI_VALIDACAO", e?.codigo === "SEI_VALIDACAO", e);
  }
  {
    const { sei } = montar({ pdfSemLink: true });
    const e = await lanca(() => gerarPdfDocumentos(sei, "99906.713-630.000032/2025-82", ["160173"]));
    checar("resposta sem ifrDownload: SEI_RESPOSTA_INESPERADA", e?.codigo === "SEI_RESPOSTA_INESPERADA", e);
  }
}
