/**
 * Alterar dados do documento: interessados, assuntos e observação, e a
 * pesquisa de contatos e assuntos pelo autocompletar da própria tela.
 *
 * Tela real do SEI 4.1.5 (`sei41/despacho_alterar.html`, SEI SP Treinamento)
 * servida por um servidor falso por baixo do transporte de verdade.
 *
 * Tela real do SEI 5.0.4 (`sei5/documento_alterar.html`, SEI MJ de homologacao, Latin-1, anonimizada):
 * `provasSei5`, com os mesmos asserts de campos, listas e autocompletar. O codigo nao precisou mudar.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { alterarDocumento, pesquisarAssuntos, pesquisarContatos } from "../src/dominio/documento";
import { aplicarModo, linkAutoCompletar } from "../src/dominio/lupas";
import type { Arvore, DocumentoArvore } from "../src/dominio/arvore";
import { lerLupa } from "../src/formulario/formulario";
import { Sei } from "../src/sei";
import { checar, fixture, lanca, secao } from "./util";

const AQUI = dirname(fileURLToPath(import.meta.url));
// A captura do SEI 5 e Latin-1 (como o servidor entrega); as do 4.1 estao em UTF-8.
const bruto = (n: string) => readFileSync(join(AQUI, "fixtures", n), n === TELA5 ? "latin1" : "utf8");
const urlDe = (n: string) => /^<!-- url: (.*?) -->/.exec(bruto(n))?.[1] ?? "";
const htmlDe = (n: string) => bruto(n).replace(/^<!-- url: .*? -->\n/, "");

const TELA = "sei41/despacho_alterar.html";
const TELA5 = "sei5/documento_alterar.html";
const LINK_ALTERAR = urlDe(TELA);
const LINK_ALTERAR5 = urlDe(TELA5);

interface Post {
  url: string;
  pares: Array<[string, string]>;
  /** Corpo cru, como saiu para o SEI (para conferir os bytes). */
  corpo: string;
  tipo: string;
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

const XML_CONTATOS =
  '<?xml version="1.0" encoding="iso-8859-1"?><itens><item id="200001" descricao="Fulano de Tal" complemento=""></item><item id="200002" descricao="Fulana Silva" complemento=""></item></itens>';
const XML_ASSUNTOS =
  '<?xml version="1.0" encoding="iso-8859-1"?><itens><item id="300001" descricao="01.01 - Organiza&#231;&#227;o" complemento=""></item></itens>';

function montar(o: { sigiloso?: boolean; xmlContatos?: string; sei5?: boolean } = {}) {
  const tela = o.sei5 ? TELA5 : TELA;
  const link = o.sei5 ? LINK_ALTERAR5 : LINK_ALTERAR;
  const estado = { posts: [] as Post[], gets: [] as string[] };
  const resp = (url: string, html: string) => {
    const bytes = new Uint8Array([...html].map((c) => c.charCodeAt(0) & 0xff));
    return { url, status: 200, arrayBuffer: async () => bytes.buffer } as unknown as Response;
  };
  const fetch = (async (u: string, init?: RequestInit) => {
    if (init?.method !== "POST") {
      estado.gets.push(u);
      if (/acao=documento_alterar/.test(u)) return resp(u, htmlDe(tela));
      return resp(u, "<html><body>?</body></html>");
    }
    const corpo = String(init.body ?? "");
    const pares = lerCorpo(corpo);
    const tipo = String((init.headers as Record<string, string> | undefined)?.["Content-Type"] ?? "");
    estado.posts.push({ url: u, pares, corpo, tipo });
    if (/acao_ajax=contato_auto_completar/.test(u)) return resp(u, o.xmlContatos ?? XML_CONTATOS);
    if (/acao_ajax=assunto_auto_completar/.test(u)) return resp(u, XML_ASSUNTOS);
    // Gravação: o SEI volta para a árvore.
    return resp(u.replace(/acao=documento_alterar/, "acao=arvore_visualizar"), "<html><body>ok</body></html>");
  }) as unknown as typeof globalThis.fetch;

  const sei = new Sei(link, null, { fetch });
  const documento: DocumentoArvore = {
    id: "160173",
    numero: "0104100",
    titulo: "Despacho",
    pasta: null,
    externo: false,
    formato: "interno",
    nivel: o.sigiloso ? "sigiloso" : "publico",
    assinado: false,
    assinaturas: [],
    cancelado: false,
    link: "",
    src: "",
    acoes: [link],
    botoes: [],
  };
  const arvore = { idProcedimento: "148265", protocolo: "99906.000001/2026-01", nivel: "publico", documentos: [documento] } as unknown as Arvore;
  Object.assign(sei, {
    localizar: async () => ({ idProcedimento: "148265", idDocumento: "160173", linkArvore: "" }),
    arvore: async () => arvore,
  });
  return { sei, estado };
}

const ESCRITA_PREVIA = { aplicar: false } as const;
const valorPost = (p: Post | undefined, nome: string) => p?.pares.find(([n]) => n === nome)?.[1];

export async function verificarDocumentoDados(): Promise<void> {
  secao("documento: links de autocompletar colhidos da tela (4.1)");
  const html = fixture(TELA).html;
  const lContato = linkAutoCompletar(html, "hdnIdInteressado");
  const lAssunto = linkAutoCompletar(html, "hdnIdAssunto");
  checar(
    "contato: link do interessado",
    !!lContato && lContato.startsWith("controlador_ajax.php?acao_ajax=contato_auto_completar_contexto_RI1225&") && lContato.includes("&infra_hash="),
    lContato,
  );
  checar("assunto: link do assunto", !!lAssunto && lAssunto.startsWith("controlador_ajax.php?acao_ajax=assunto_auto_completar_RI1223&"), lAssunto);
  checar("campo inexistente: null", linkAutoCompletar(html, "hdnIdNada") === null);
  const lExterno = linkAutoCompletar(fixture("sei41/pdf_alterar.html").html, "hdnIdInteressado");
  checar("documento externo tambem tem o autocompletar", !!lExterno && lExterno.includes("contato_auto_completar"), lExterno);

  await provasSei5();

  secao("documento: modos da lista");
  const a = { id: "1", texto: "A" };
  const b = { id: "2", texto: "B" };
  const c = { id: "3", texto: "C" };
  checar("acrescentar sem duplicar", JSON.stringify(aplicarModo([a, b], "acrescentar", [b, c])) === JSON.stringify([a, b, c]));
  checar("remover por id", JSON.stringify(aplicarModo([a, b, c], "remover", [{ id: "2", texto: "outro nome" }])) === JSON.stringify([a, c]));
  checar("substituir troca tudo (sem duplicar)", JSON.stringify(aplicarModo([a, b], "substituir", [c, c])) === JSON.stringify([c]));
  checar("id comparado por igualdade exata", aplicarModo([{ id: "12", texto: "x" }], "remover", [{ id: "1", texto: "y" }]).length === 1);

  secao("documento: interessados (fixture com CGE-CAUD e Cliente 1)");
  {
    const { sei, estado } = montar();
    const novo = { id: "200001", texto: "Fulano de Tal" };
    const r = await alterarDocumento(sei, "0104100", { interessados: { modo: "acrescentar", itens: [{ id: "100014318", texto: "Cliente 1" }, novo] } }, ESCRITA_PREVIA);
    const m = r.mudancas.find((x) => x.campo === "Interessados");
    checar("previa: antes e depois dos interessados", m?.antes === "CGE-CAUD; Cliente 1" && m.depois === "CGE-CAUD; Cliente 1; Fulano de Tal", m);
    checar("previa nao envia", estado.posts.length === 0 && !r.aplicado, estado.posts);
  }
  {
    const { sei, estado } = montar();
    const novo = { id: "200001", texto: "Fulano de Tal" };
    const r = await alterarDocumento(sei, "0104100", { interessados: { modo: "acrescentar", itens: [novo] } }, { aplicar: true });
    const post = estado.posts[0];
    const itens = lerLupa(valorPost(post, "hdnInteressados") ?? "");
    checar("gravacao: acrescenta mantendo os antigos", r.aplicado && itens.map((i) => i.id).join(",") === "100013362,100014318,200001", itens);
    checar("gravacao: flag de cadastro 2", valorPost(post, "hdnFlagDocumentoCadastro") === "2");
  }
  {
    const { sei, estado } = montar();
    await alterarDocumento(sei, "0104100", { interessados: { modo: "remover", itens: [{ id: "100013362", texto: "" }] } }, { aplicar: true });
    const itens = lerLupa(valorPost(estado.posts[0], "hdnInteressados") ?? "");
    checar("remover tira por id", itens.length === 1 && itens[0].id === "100014318", itens);
  }
  {
    const { sei, estado } = montar();
    await alterarDocumento(sei, "0104100", { interessados: { modo: "substituir", itens: [{ id: "200002", texto: "Fulana Silva" }] } }, { aplicar: true });
    const itens = lerLupa(valorPost(estado.posts[0], "hdnInteressados") ?? "");
    checar("substituir troca a lista inteira", itens.length === 1 && itens[0].id === "200002" && itens[0].texto === "Fulana Silva", itens);
  }
  {
    const { sei, estado } = montar();
    const r = await alterarDocumento(sei, "0104100", { interessados: { modo: "remover", itens: [{ id: "999", texto: "" }] } }, { aplicar: true });
    checar("remover quem nao esta: nada a alterar, sem envio", r.mudancas.length === 0 && estado.posts.length === 0 && !r.aplicado, r);
  }

  secao("documento: assuntos e observacao");
  {
    const { sei, estado } = montar();
    const assunto = { id: "300001", texto: "01.01 - Organização" };
    const r = await alterarDocumento(
      sei,
      "0104100",
      { assuntos: { modo: "acrescentar", itens: [assunto] }, interessados: { modo: "substituir", itens: [{ id: "200002", texto: "Fulana Silva" }] } },
      ESCRITA_PREVIA,
    );
    const mA = r.mudancas.find((x) => x.campo === "Assuntos");
    const mI = r.mudancas.find((x) => x.campo === "Interessados");
    checar("previa: antes e depois dos assuntos", mA?.antes === "" && mA.depois === assunto.texto, mA);
    checar("previa: antes e depois dos interessados", mI?.antes === "CGE-CAUD; Cliente 1" && mI.depois === "Fulana Silva", mI);
    checar("previa com as duas listas nao envia", estado.posts.length === 0);
  }
  {
    const { sei, estado } = montar();
    const assunto = { id: "300001", texto: "01.01 - Organização" };
    await alterarDocumento(sei, "0104100", { assuntos: { modo: "acrescentar", itens: [assunto] } }, { aplicar: true });
    const itens = lerLupa(valorPost(estado.posts[0], "hdnAssuntos") ?? "");
    checar("gravacao: assunto no hdnAssuntos", itens.length === 1 && itens[0].id === "300001", itens);
  }
  {
    const { sei, estado } = montar();
    const r = await alterarDocumento(sei, "0104100", { observacao: "" }, { aplicar: true });
    checar("observacao vazia (ja vazia na tela) nao gera mudanca", r.mudancas.length === 0 && estado.posts.length === 0, r);
  }
  {
    const { sei, estado } = montar();
    const r = await alterarDocumento(sei, "0104100", { observacao: "Conferido pela unidade" }, { aplicar: true });
    checar("observacao preenchida gera mudanca", r.mudancas.some((x) => x.campo.startsWith("Observa") && x.depois === "Conferido pela unidade"), r.mudancas);
    checar("observacao vai no txaObservacoes", valorPost(estado.posts[0], "txaObservacoes") === "Conferido pela unidade");
  }
  {
    const { sei, estado } = montar();
    const r = await alterarDocumento(sei, "0104100", { descricao: "Nova descricao" }, { aplicar: true });
    const post = estado.posts[0];
    checar("descricao continua como antes", r.aplicado && valorPost(post, "txtDescricao") === "Nova descricao");
    checar("sem tocar nas listas, os interessados da tela seguem no POST", lerLupa(valorPost(post, "hdnInteressados") ?? "").length === 2);
  }
  {
    const { sei, estado } = montar({ sigiloso: true });
    const e = await lanca(() => alterarDocumento(sei, "0104100", { observacao: "x" }, { aplicar: true }));
    checar("sigiloso continua recusado", e?.codigo === "SEI_SIGILOSO" && estado.gets.length === 0, e);
  }

  secao("documento: pesquisa de contatos e assuntos");
  {
    const { sei, estado } = montar();
    const contatos = await pesquisarContatos(sei, "0104100", "fulan");
    const ajax = estado.posts.find((p) => p.url.includes("controlador_ajax.php"));
    checar("contatos pelo autocompletar da tela", contatos.length === 2 && contatos[0].id === "200001" && contatos[0].texto === "Fulano de Tal", contatos);
    checar("link colhido e nao montado", !!ajax && ajax.url.includes("acao_ajax=contato_auto_completar_contexto_RI1225") && ajax.url.includes("infra_hash="), ajax?.url);
    checar("parametro palavras_pesquisa", valorPost(ajax, "palavras_pesquisa") === "fulan", ajax?.pares);
  }
  {
    const { sei, estado } = montar();
    const assuntos = await pesquisarAssuntos(sei, "0104100", "organiza");
    const ajax = estado.posts.find((p) => p.url.includes("controlador_ajax.php"));
    checar("assuntos pelo autocompletar da tela", assuntos.length === 1 && assuntos[0].texto === "01.01 - Organização", assuntos);
    checar("assunto: acao do autocompletar de assunto", !!ajax && ajax.url.includes("acao_ajax=assunto_auto_completar_RI1223") && valorPost(ajax, "palavras_pesquisa") === "organiza", ajax);
  }
  secao("documento: entidade HTML dupla no descricao do autocompletar (achado do SEI MJ)");
  {
    // O SEI 5 manda o atributo ja escapado dentro do XML: `&amp;quot;` vira `&quot;` depois do parser.
    const xml =
      '<?xml version="1.0" encoding="iso-8859-1"?><itens><item id="1" descricao="&amp;quot;ORGANIZA&amp;Ccedil;&amp;Atilde;O VIDA &amp;amp; SA&amp;Uacute;DE&amp;quot; - &amp;quot;OVS&amp;quot;" complemento=""></item><item id="2" descricao="&quot;ABC&quot; &amp; D" complemento=""></item></itens>';
    const { sei } = montar({ xmlContatos: xml });
    const r = await pesquisarContatos(sei, "0104100", "ong");
    checar("&amp;quot; vira aspas e acentos voltam", r[0]?.texto === '"ORGANIZA\u00C7\u00C3O VIDA & SA\u00DADE" - "OVS"', r[0]);
    checar("&quot; simples continua aspas e & unico preservado", r[1]?.texto === '"ABC" & D', r[1]);
  }
  secao("documento: pesquisa com acento vai como a tela do SEI envia (controlador_ajax decodifica UTF-8)");
  {
    // Assunto: prepararExecucao manda o valor cru; o infraAjaxPost codifica o corpo em UTF-8 (encodeURIComponent).
    const { sei, estado } = montar();
    await pesquisarAssuntos(sei, "0104100", "administra\u00E7\u00E3o");
    const ajax = estado.posts.find((p) => p.url.includes("acao_ajax=assunto_auto_completar"));
    checar("assunto: termo em UTF-8 uma vez", ajax?.corpo === "palavras_pesquisa=administra%C3%A7%C3%A3o", ajax?.corpo);
    checar("assunto: Content-Type sem charset ISO", !!ajax && !/8859/i.test(ajax.tipo), ajax?.tipo);
  }
  {
    // Contato: prepararExecucao ja aplica encodeURIComponent no valor e o infraAjaxPost codifica de novo;
    // o PHP faz fromUTF8(urldecode(...)) depois do decodificarPost.
    const { sei, estado } = montar();
    await pesquisarContatos(sei, "0104100", "Jo\u00E3o da Silva");
    const ajax = estado.posts.find((p) => p.url.includes("acao_ajax=contato_auto_completar"));
    checar("contato: termo codificado duas vezes (como a tela)", ajax?.corpo === "palavras_pesquisa=Jo%25C3%25A3o%2520da%2520Silva", ajax?.corpo);
  }
  {
    const { sei, estado } = montar();
    await pesquisarAssuntos(sei, "0104100", "a\u2014b");
    const ajax = estado.posts.find((p) => p.url.includes("acao_ajax=assunto_auto_completar"));
    checar("fora do Latin-1 vira o equivalente antes de codificar", ajax?.corpo === "palavras_pesquisa=a-b", ajax?.corpo);
  }
  {
    const { sei } = montar({ sigiloso: true });
    const e = await lanca(() => pesquisarContatos(sei, "0104100", "x"));
    checar("pesquisa em documento sigiloso recusada", e?.codigo === "SEI_SIGILOSO", e);
  }
}

/**
 * Mesma tela, agora capturada no SEI 5.0.4 (SEI MJ de homologacao, Termo de Compromisso, CK5), anonimizada.
 * Ela nasce sem interessados nem assuntos, entao as listas sao montadas do zero.
 */
async function provasSei5(): Promise<void> {
  secao("documento: tela real do SEI 5.0.4 (Latin-1, anonimizada)");
  const html = htmlDe(TELA5);
  const lContato = linkAutoCompletar(html, "hdnIdInteressado");
  const lAssunto = linkAutoCompletar(html, "hdnIdAssunto");
  checar("5: link do autocompletar de contato colhido", !!lContato && lContato.startsWith("controlador_ajax.php?acao_ajax=contato_auto_completar") && lContato.includes("&infra_hash="), lContato);
  checar("5: link do autocompletar de assunto colhido", !!lAssunto && lAssunto.startsWith("controlador_ajax.php?acao_ajax=assunto_auto_completar") && lAssunto.includes("&infra_hash="), lAssunto);
  checar("5: acentos da captura Latin-1 lidos certo", html.includes("Termo de Compromisso de Manuten\u00E7\u00E3o de Sigilo") && html.includes("Coordena\u00E7\u00E3o-Geral"));

  {
    const { sei, estado } = montar({ sei5: true });
    const novo = { id: "200001", texto: "Fulano de Tal" };
    const r = await alterarDocumento(sei, "0104100", { interessados: { modo: "acrescentar", itens: [novo] }, assuntos: { modo: "acrescentar", itens: [{ id: "300001", texto: "01.01 - Organiza\u00E7\u00E3o" }] } }, ESCRITA_PREVIA);
    const mI = r.mudancas.find((x) => x.campo === "Interessados");
    const mA = r.mudancas.find((x) => x.campo === "Assuntos");
    checar("5: previa de interessados e assuntos (tela sem nenhum)", mI?.antes === "" && mI.depois === "Fulano de Tal" && mA?.antes === "" && mA.depois === "01.01 - Organiza\u00E7\u00E3o", r.mudancas);
    checar("5: previa nao envia", estado.posts.length === 0 && !r.aplicado);
  }
  {
    const { sei, estado } = montar({ sei5: true });
    const r = await alterarDocumento(
      sei,
      "0104100",
      { interessados: { modo: "acrescentar", itens: [{ id: "200001", texto: "Fulano de Tal" }] }, assuntos: { modo: "substituir", itens: [{ id: "300001", texto: "A" }] }, observacao: "Conferido pela unidade", descricao: "Nova descri\u00E7\u00E3o" },
      { aplicar: true },
    );
    const post = estado.posts[0];
    checar("5: gravacao de interessado no hdnInteressados", r.aplicado && lerLupa(valorPost(post, "hdnInteressados") ?? "").map((i) => i.id).join(",") === "200001", post?.pares.filter(([n]) => n === "hdnInteressados"));
    checar("5: gravacao de assunto no hdnAssuntos", lerLupa(valorPost(post, "hdnAssuntos") ?? "").map((i) => i.id).join(",") === "300001");
    checar("5: observacao e descricao com acento", valorPost(post, "txaObservacoes") === "Conferido pela unidade" && valorPost(post, "txtDescricao") === "Nova descri\u00E7\u00E3o", post?.pares);
    checar("5: flag de cadastro 2 e form enviado a documento_alterar", valorPost(post, "hdnFlagDocumentoCadastro") === "2" && post.url.includes("acao=documento_alterar"), post?.url);
    checar("5: nivel publico mantido", valorPost(post, "hdnStaNivelAcessoLocal") === "0");
  }
  {
    const { sei, estado } = montar({ sei5: true });
    const r = await alterarDocumento(sei, "0104100", { descricao: "S\u00F3 a descri\u00E7\u00E3o" }, { aplicar: true });
    const post = estado.posts[0];
    checar("5: sem tocar nas listas elas seguem vazias no POST", r.aplicado && (valorPost(post, "hdnInteressados") ?? "") === "" && (valorPost(post, "hdnAssuntos") ?? "") === "");
    checar("5: tipo do documento (hdnIdSerie) preservado", valorPost(post, "hdnIdSerie") === "1180");
  }
  {
    const { sei, estado } = montar({ sei5: true });
    const contatos = await pesquisarContatos(sei, "0104100", "fulan");
    const ajax = estado.posts.find((p) => p.url.includes("controlador_ajax.php"));
    checar("5: contatos pelo autocompletar da tela", contatos.length === 2 && contatos[0].texto === "Fulano de Tal", contatos);
    checar("5: link colhido, nao montado", !!ajax && ajax.url.includes("acao_ajax=contato_auto_completar") && ajax.url.includes("infra_hash="), ajax?.url);
    checar("5: palavras_pesquisa", valorPost(ajax, "palavras_pesquisa") === "fulan", ajax?.pares);
  }
  {
    const { sei, estado } = montar({ sei5: true });
    const assuntos = await pesquisarAssuntos(sei, "0104100", "organiza");
    const ajax = estado.posts.find((p) => p.url.includes("acao_ajax=assunto_auto_completar"));
    checar("5: assuntos pelo autocompletar da tela", assuntos.length === 1 && assuntos[0].texto === "01.01 - Organiza\u00E7\u00E3o", assuntos);
    checar("5: assunto com acento vai em UTF-8", !!ajax, estado.posts.map((p) => p.url));
  }
  {
    const { sei, estado } = montar({ sei5: true });
    await pesquisarAssuntos(sei, "0104100", "administra\u00E7\u00E3o");
    const ajax = estado.posts.find((p) => p.url.includes("acao_ajax=assunto_auto_completar"));
    checar("5: termo com acento em UTF-8 uma vez", ajax?.corpo === "palavras_pesquisa=administra%C3%A7%C3%A3o", ajax?.corpo);
  }
}
