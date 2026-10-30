/**
 * O content script do Gestor de Demandas: a marca no document_start (antes de qualquer outro módulo e antes de ler a
 * opção), a opção desligada por padrão, o carregador (só o topo com unidade importa o pacote), o painel embutido na
 * caixa (uma vez só, na ordem lida do localStorage) e o portão de "nada busca a árvore do processo".
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { build } from "esbuild";
import { carregarDemandas, type DepsCarregador, oQueCarregar, PACOTE_PAGINA, temUnidade } from "../../src/pagina/carregador";
import { contextoDemandas } from "../../src/pagina/contexto";
import { ATRIBUTO_ATIVO, marcarAtivo } from "../../src/pagina/marca";
import { lerOpcaoDemandas } from "../../src/pagina/opcao";
import { ID_PAINEL, montarPainelDemandas, ordemDoPainel } from "../../src/pagina/painel";
import { qualTela } from "../../src/pagina/tela";
import { chaveDaAba } from "../../src/ponte/tipos";
import { checar, instalarDom, secao, telaSei } from "./util";

const PASTA_PAGINA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "pagina");

/** A primeira linha `import` de src/pagina/main.ts (depois do comentário de cabeçalho). */
function primeiroImport(): string {
  const codigo = readFileSync(join(PASTA_PAGINA, "main.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return codigo.split("\n").find((l) => l.startsWith("import")) ?? "";
}

/** Empacota o carregador como o build.mjs (IIFE, minificado, ASCII). */
async function empacotar(entrada: string, formato: "iife" | "esm"): Promise<string> {
  const r = await build({
    entryPoints: [join(PASTA_PAGINA, entrada)],
    bundle: true,
    minify: true,
    write: false,
    format: formato,
    charset: "ascii",
    target: ["chrome116", "firefox115"],
    logLevel: "silent",
    loader: { ".css": "text" },
  });
  return r.outputFiles[0]?.text ?? "";
}

/**
 * Avalia o carregador numa VM em que marcar o <html> interrompe a avaliação e `chrome` avisa se for tocado: a marca tem
 * de vir antes de qualquer outro módulo e antes de a opção ser lida.
 */
async function marcaNoPacote(): Promise<{ atributo?: string; chromeAntes?: number; erro?: string }> {
  const codigo = await empacotar("main.ts", "iife");
  const contexto = createContext({}) as Record<string, unknown>;
  let toques = 0;
  Object.defineProperty(contexto, "chrome", {
    get() {
      toques += 1;
      return undefined;
    },
  });
  const saida: { atributo?: string; chromeAntes?: number; erro?: string } = {};
  contexto.window = contexto;
  contexto.document = {
    documentElement: {
      setAttribute(nome: string) {
        saida.atributo = nome;
        saida.chromeAntes = toques;
        throw new Error("marcado");
      },
    },
  };
  try {
    runInContext(codigo, contexto);
    saida.erro = "o pacote nao marcou o <html>";
  } catch (e) {
    if (saida.atributo === undefined) saida.erro = String(e);
  }
  return saida;
}

/** O mesmo arquivo injetado duas vezes (matches que se sobrepõem): um só carregamento. */
async function injetadoDuasVezes(): Promise<{ esperas: number; marcado: boolean }> {
  const codigo = await empacotar("main.ts", "iife");
  const contexto = createContext({}) as Record<string, unknown>;
  let esperas = 0;
  contexto.window = contexto;
  contexto.top = contexto;
  contexto.location = { href: "https://x/sei/" };
  contexto.document = {
    readyState: "loading",
    documentElement: { setAttribute: () => undefined },
    addEventListener: (nome: string) => {
      if (nome === "DOMContentLoaded") esperas += 1;
    },
  };
  runInContext(codigo, contexto);
  runInContext(codigo, contexto);
  return { esperas, marcado: contexto.__seiProDemandas === true };
}

const dadosDaOpcao = (valor: unknown) => ({
  get: async () => ({ dataValues: JSON.stringify([{ configGeral: [{ name: "gerenciardemandas", value: valor }] }]) }),
});

export async function verificarPagina(): Promise<void> {
  secao("pagina: marca para o legado e contexto");
  const { doc, pagina } = telaSei("sei41/caixa.html");
  marcarAtivo(doc);
  checar("marca o <html>", ATRIBUTO_ATIVO === "data-seipro-demandas" && doc.documentElement.hasAttribute("data-seipro-demandas"));
  checar("main.ts: o primeiro import e o modulo que marca", /^import\s+["']\.\/marcar["'];/m.test(primeiroImport()), primeiroImport());
  const ordem = await marcaNoPacote();
  checar(
    "pacote do content script: a marca vem antes de qualquer outro modulo e antes de tocar o chrome (a opcao)",
    ordem.atributo === ATRIBUTO_ATIVO && ordem.chromeAntes === 0,
    ordem,
  );
  const dupla = await injetadoDuasVezes();
  checar("o mesmo arquivo injetado duas vezes liga uma vez so (window.__seiProDemandas)", dupla.marcado && dupla.esperas === 1, dupla);
  const ctx = contextoDemandas(doc, { temaEscuro: true, corTema: "#155b9c" }, pagina.url);
  checar(
    "contexto do cabecalho do SEI",
    ctx?.host === "treinamento.sei.sp.gov.br" &&
      ctx.login === "pedro.soares" &&
      ctx.nome === "Pedro Soares" &&
      ctx.unidade?.id === "110000001" &&
      ctx.temaEscuro &&
      ctx.corTema === "#155b9c",
    ctx,
  );
  checar("sem usuario no cabecalho, sem contexto", contextoDemandas(instalarDom(), { temaEscuro: false }) === null);
  checar(
    "chave da aba: host|login|u:unidade; sem unidade, vazia",
    ctx !== null && chaveDaAba(ctx) === "treinamento.sei.sp.gov.br|pedro.soares|u:110000001",
  );
  checar("chave sem unidade e vazia", chaveDaAba({ host: "h", login: "a", unidade: null }) === "");

  secao("pagina: a opcao (ligada por padrao)");
  checar("sem configuracao: ligada", (await lerOpcaoDemandas({ get: async () => ({}) })) === true);
  checar(
    "opcao ausente da lista: ligada (quem salvou as configuracoes antes de existir a opcao nao a perde)",
    (await lerOpcaoDemandas({ get: async () => ({ dataValues: '[{"configGeral":[]}]' }) })) === true,
  );
  checar("falsa: desligada", (await lerOpcaoDemandas(dadosDaOpcao(false))) === false);
  checar("marcada: ligada", (await lerOpcaoDemandas(dadosDaOpcao(true))) === true);

  secao("pagina: o carregador decide pela tela");
  const tela = (nome: string) => telaSei(`sei41/${nome}`);
  const decide = (nome: string, topo: boolean) => {
    const t = tela(nome);
    return oQueCarregar({ topo, doc: t.doc, url: t.pagina.url });
  };
  checar("topo do Controle de Processos: carrega", decide("caixa.html", true) === "topo");
  checar("topo de outra tela com unidade (Textos Padrao): carrega", decide("texto_padrao_listar.html", true) === "topo");
  checar("frame da arvore do processo (sem a barra de acoes): nada", decide("arvore.html", false) === null);
  checar(
    "frame da barra de acoes do processo (SEI 4.1: visualizador de fora e com documento): o pacote da pagina (D17)",
    ["processo_visualizar.html", "doc_arvore_visualizar.html"].every((n) => decide(n, false) === "arvore"),
  );
  checar(
    "outros frames (editor, PDF): nada",
    ["editor.html", "pdf_visualizar.html", "despacho_visualizar.html"].every((n) => decide(n, false) === null),
  );
  checar("topo sem o cabecalho do SEI (editor em janela propria): nada", decide("editor.html", true) === null);
  checar("topo vazio: nada", oQueCarregar({ topo: true, doc: instalarDom(), url: "https://sei.x.gov.br/sei/" }) === null);
  const caixa = tela("caixa.html");
  checar("temUnidade na caixa", temUnidade(caixa.doc, caixa.pagina.url));
  checar("qualTela: caixa", qualTela(caixa.doc) === "caixa");
  checar("qualTela: barra de acoes", qualTela(tela("processo_visualizar.html").doc) === "arvore");

  const chamadas = { opcao: 0, importar: [] as string[], principal: 0, arvore: 0 };
  const deps = (o: { topo: boolean; ligada: boolean; doc?: Document; url?: string }): DepsCarregador => ({
    topo: o.topo,
    doc: o.doc ?? caixa.doc,
    url: o.url ?? caixa.pagina.url,
    opcaoLigada: async () => {
      chamadas.opcao += 1;
      return o.ligada;
    },
    importar: async (caminho) => {
      chamadas.importar.push(caminho);
      return {
        principalTopo: async () => {
          chamadas.principal += 1;
        },
        principalArvore: async () => {
          chamadas.arvore += 1;
        },
      };
    },
  });
  checar(
    "opcao desligada: nao importa o pacote",
    (await carregarDemandas(deps({ topo: true, ligada: false }))) === null && chamadas.importar.length === 0 && chamadas.opcao === 1,
  );
  checar(
    "opcao ligada, topo com unidade: importa o pacote da pagina e liga",
    (await carregarDemandas(deps({ topo: true, ligada: true }))) === "topo" &&
      chamadas.importar.join() === PACOTE_PAGINA &&
      chamadas.principal === 1,
    chamadas,
  );
  chamadas.opcao = 0;
  chamadas.importar.length = 0;
  checar(
    "frame que nao e de topo: para no carregador (nem le a opcao nem importa)",
    (await carregarDemandas(deps({ topo: false, ligada: true }))) === null && chamadas.opcao === 0 && chamadas.importar.length === 0,
  );
  const barra = tela("processo_visualizar.html");
  checar(
    "frame da barra de acoes, opcao ligada: importa o pacote e liga so a parte da arvore (D17)",
    (await carregarDemandas(deps({ topo: false, ligada: true, doc: barra.doc, url: barra.pagina.url }))) === "arvore" &&
      chamadas.importar.join() === PACOTE_PAGINA &&
      chamadas.arvore === 1 &&
      chamadas.principal === 1,
    chamadas,
  );
  chamadas.opcao = 0;
  chamadas.importar.length = 0;
  checar(
    "frame da barra de acoes, opcao desligada: le a opcao e nao importa nada",
    (await carregarDemandas(deps({ topo: false, ligada: false, doc: barra.doc, url: barra.pagina.url }))) === null &&
      chamadas.opcao === 1 &&
      chamadas.importar.length === 0,
  );
  chamadas.opcao = 0;
  checar(
    "topo sem unidade: nada lido",
    (await carregarDemandas(deps({ topo: true, ligada: true, doc: instalarDom(), url: "https://sei.x.gov.br/sei/" }))) === null &&
      chamadas.opcao === 0,
  );

  secao("pagina: painel no Controle de Processos");
  const { doc: docP } = telaSei("sei41/caixa.html");
  let recolhidos: boolean[] = [];
  const mp = montarPainelDemandas(docP, {
    urlApp: "chrome-extension://abc/html/demandas.html#modo=embutido",
    temaEscuro: false,
    recolhido: false,
    ordem: null,
    aoRecolher: (r) => recolhidos.push(r),
  })!;
  checar(
    "painel no #panelHomePro com o id demandasPro",
    ID_PAINEL === "demandasPro" && mp.painel.id === "demandasPro" && mp.painel.parentElement?.id === "panelHomePro",
  );
  const titulo = mp.painel.querySelector(".spro-dem-titulo") as HTMLElement;
  checar(
    "titulo Gestor de Demandas com o icone proprio",
    (titulo.textContent ?? "").includes("Demandas") &&
      titulo.querySelector("svg")?.getAttribute("width") === "24" &&
      titulo.querySelector("svg")?.getAttribute("viewBox") === "0 0 40 40" &&
      !!titulo.querySelector('svg circle[fill="#F2814F"]'),
  );
  checar("iframe do app no modo embutido", mp.iframe.getAttribute("src")?.endsWith("#modo=embutido") === true);
  checar(
    "nao monta duas vezes",
    montarPainelDemandas(docP, { urlApp: "x", recolhido: false, ordem: null, aoRecolher: () => undefined }) === null,
  );
  const ordens = (o: unknown) => ({ getItem: () => JSON.stringify({ orderPanelHome: o }) });
  checar(
    "ordem lida do localStorage (orderPanelHome); sem o painel, null; nao herda a ordem do legado",
    ordemDoPainel(ordens([{ name: "demandasPro", index: 3 }])) === 3 &&
      ordemDoPainel(ordens([{ name: "projetosPro", index: 4 }])) === null &&
      ordemDoPainel(ordens([])) === null,
  );
  (mp.painel.querySelector(".spro-dem-recolher") as HTMLButtonElement).click();
  checar("recolher lembra", recolhidos.join() === "true" && mp.corpo.hidden === true);
  recolhidos = [];

  secao("pagina: nada le a arvore do processo nem monta link do SEI");
  const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const fontes = readdirSync(PASTA_PAGINA)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => ({ f, codigo: semComentario(readFileSync(join(PASTA_PAGINA, f), "utf8")) }));
  const PROIBIDOS = [
    /@nucleo\/dominio\/arvore/,
    /@nucleo\/dominio\/opcoes/,
    /\blistarOpcoes\b/,
    /\babrirArvore\b/,
    /\.arvore\(/,
    /\bnew Sei\(/,
    /procedimento_visualizar|arvore_montar|procedimento_atribuicao_cadastrar/,
    /controlador\.php/,
  ];
  // O leitor da arvore JA desenhada (`lerArvore`, so analise de texto) mora em deteccao.ts e so la.
  const achados = fontes.flatMap(({ f, codigo }) =>
    PROIBIDOS.filter((re) => re.test(codigo) && !(f === "deteccao.ts" && re.source === "@nucleo\\/dominio\\/arvore")).map(
      (re) => `${f}: ${re}`,
    ),
  );
  checar(
    "content script: sem leitura de arvore, sem formulario de atribuicao, sem URL montada",
    fontes.length >= 10 && achados.length === 0,
    achados.length ? achados : fontes.map((x) => x.f),
  );
  const pacote = await empacotar("principal.ts", "esm");
  const carregador = await empacotar("main.ts", "iife");
  const proibidoNoBundle = ["procedimento_visualizar", "arvore_montar", "procedimento_atribuicao_cadastrar"].filter(
    (p) => pacote.includes(p) || carregador.includes(p),
  );
  checar("bundles (carregador e pacote da pagina): nenhum endereco proibido", proibidoNoBundle.length === 0, proibidoNoBundle);
  checar("carregador leve (<= 16 KB): nada pesado entra nele", carregador.length <= 16 * 1024, carregador.length);
  checar("os dois bundles so em ASCII", ![...(pacote + carregador)].some((c) => c.charCodeAt(0) > 0x7f));
}
