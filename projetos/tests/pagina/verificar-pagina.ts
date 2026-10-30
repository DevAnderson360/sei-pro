import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createContext, runInContext } from "node:vm";
import { areaMemoria } from "@comum/armazenamento/area";
import { avisoComAcoesNaPagina } from "@comum/painel/aviso";
import { icone } from "@comum/ui/dom";
import { ErroSei } from "@nucleo/sessao/erros";
import type { Pagina } from "@nucleo/sessao/http";
import { build } from "esbuild";
import { escoposDaUnidade } from "../../src/modelo/escopo";
import { atividadesConfigurado, contextoProjetos } from "../../src/pagina/contexto";
import { conferirDocumento } from "../../src/pagina/documento";
import { processosDaCaixa, tratadoresProjetos } from "../../src/pagina/executor";
import { ATRIBUTO_ATIVO, marcarAtivo } from "../../src/pagina/marca";
import { ID_PAINEL, ligarAlertas, montarPainelProjetos, ordemDoPainel, pintarAlertas } from "../../src/pagina/painel";
import { type DepsUsuarios, responsaveisUsados, usuariosDaCaixa, usuariosDaUnidade } from "../../src/pagina/usuarios";
import type { ContextoProjetos, UsuarioDaUnidade } from "../../src/ponte/tipos";
import { RepositorioProjetos } from "../../src/repositorio";
import { HOJE } from "../fabrica";
import { botao, checar, instalarDom, lanca, secao, telaSei, tique } from "./util";

const DIA = 86_400_000;
const PASTA_PAGINA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "pagina");

const nomes = (l: readonly UsuarioDaUnidade[]) => l.map((u) => u.login ?? u.nome).join();

/** A primeira linha `import` de src/pagina/main.ts (depois do comentário de cabeçalho). */
function primeiroImport(): string {
  const codigo = readFileSync(join(PASTA_PAGINA, "main.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  return codigo.split("\n").find((l) => l.startsWith("import")) ?? "";
}

/**
 * Empacota o content script como o build.mjs (IIFE, minificado) e o avalia numa VM em que marcar o
 * <html> interrompe a avaliação. Conta quantas datas (AAAA-MM-DD) já tinham entrado num Set até ali:
 * o calendário de feriados de 2000 a 2100 põe umas 1.400; com a marca primeiro, nenhuma.
 */
async function marcaNoPacote(): Promise<{ atributo?: string; feriadosAntes?: number; erro?: string }> {
  const r = await build({
    entryPoints: [join(PASTA_PAGINA, "main.ts")],
    bundle: true,
    minify: true,
    write: false,
    format: "iife",
    charset: "ascii",
    target: ["chrome116", "firefox115"],
    logLevel: "silent",
    loader: { ".css": "text" },
  });
  const contexto = createContext({}) as Record<string, unknown>;
  runInContext(
    "globalThis.__feriados = 0; const add = Set.prototype.add; Set.prototype.add = function (v) {" +
      ' if (typeof v === "string" && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(v)) globalThis.__feriados++; return add.call(this, v); };',
    contexto,
  );
  const saida: { atributo?: string; feriadosAntes?: number; erro?: string } = {};
  contexto.window = contexto;
  contexto.document = {
    documentElement: {
      setAttribute(nome: string) {
        saida.atributo = nome;
        saida.feriadosAntes = contexto.__feriados as number;
        throw new Error("marcado");
      },
    },
  };
  try {
    runInContext(r.outputFiles[0]?.text ?? "", contexto);
    saida.erro = "o pacote nao marcou o <html>";
  } catch (e) {
    if (saida.atributo === undefined) saida.erro = String(e);
  }
  return saida;
}

export async function verificarPagina(): Promise<void> {
  secao("pagina: marca para o legado e contexto");
  const { doc, pagina } = telaSei("sei41/caixa.html");
  marcarAtivo(doc);
  checar(
    "marca o <html> (o init.js le)",
    ATRIBUTO_ATIVO === "data-seipro-projetos" && doc.documentElement.hasAttribute("data-seipro-projetos"),
  );
  checar("main.ts: o primeiro import e o modulo que marca", /^import\s+["']\.\/marcar["'];/m.test(primeiroImport()), primeiroImport());
  const ordem = await marcaNoPacote();
  checar(
    "pacote do content script: a marca vem antes de qualquer outro modulo (nenhum feriado calculado antes)",
    ordem.atributo === ATRIBUTO_ATIVO && ordem.feriadosAntes === 0,
    ordem,
  );
  const ctx = contextoProjetos(doc, { temaEscuro: true, corTema: "#155b9c", atividades: false }, pagina.url);
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
  checar("sem usuario no cabecalho, sem contexto", contextoProjetos(instalarDom(), { temaEscuro: false, atividades: false }) === null);
  const loja = (v: string | null) => ({ getItem: () => v });
  checar(
    "servidor do Atividades: URL_API preenchida basta (o login por host grava KEY_USER vazio)",
    atividadesConfigurado(loja('{"URL_API":"https://x/api","KEY_USER":"k"}')) &&
      atividadesConfigurado(loja('{"URL_API":"https://x/api","KEY_USER":"","CLIENT_ID":"c"}')) &&
      atividadesConfigurado(loja('{"URL_API":"https://x/api"}')) &&
      !atividadesConfigurado(loja('{"URL_API":"","KEY_USER":"k"}')) &&
      !atividadesConfigurado(loja("nao e json")) &&
      !atividadesConfigurado(loja(null)),
  );
  // A mesma regra da guarda do init.js (servidorAtividadesConfiguradoPro), que decide se o legado carrega.
  const init = readFileSync(join(PASTA_PAGINA, "..", "..", "..", "dist", "js", "init.js"), "utf8").replace(/\r\n/g, "\n");
  const guarda = init.match(/function servidorAtividadesConfiguradoPro\(\) \{[\s\S]*?\n {12}\}\n/)?.[0] ?? "";
  const doInit = (v: string | null): boolean => {
    const ctxVm = createContext({ localStorage: { getItem: () => v }, resultado: undefined as unknown });
    runInContext(`${guarda}\nresultado = servidorAtividadesConfiguradoPro();`, ctxVm);
    return ctxVm.resultado === true;
  };
  const casos = [
    null,
    "",
    "null",
    "{}",
    "nao e json",
    "[]",
    '{"URL_API":""}',
    '{"URL_API":5}',
    '{"URL_API":"https://x/api"}',
    '{"URL_API":"https://x/api","KEY_USER":""}',
    '{"URL_API":"https://x/api","KEY_USER":"k"}',
    '{"KEY_USER":"k"}',
  ];
  const divergem = casos.filter((v) => doInit(v) !== atividadesConfigurado(loja(v)));
  checar("app e init.js: a mesma definicao de servidor do Atividades", guarda !== "" && divergem.length === 0, divergem);

  secao("pagina: painel no Controle de Processos");
  const { doc: docP } = telaSei("sei41/caixa.html");
  let recolhidos: boolean[] = [];
  const mp = montarPainelProjetos(docP, {
    urlApp: "chrome-extension://abc/html/projetos.html#modo=embutido",
    temaEscuro: false,
    recolhido: false,
    ordem: null,
    aoRecolher: (r) => recolhidos.push(r),
  })!;
  checar(
    "painel proprio (id diferente do legado) no #panelHomePro",
    ID_PAINEL === "projetosPro" && mp.painel.id === "projetosPro" && mp.painel.parentElement?.id === "panelHomePro",
  );
  const titulo = mp.painel.querySelector(".spro-prj-titulo") as HTMLElement;
  checar("titulo Projetos com icone gantt", (titulo.textContent ?? "").includes("Projetos") && !!titulo.querySelector("svg path"));
  checar("iframe do app no modo embutido", mp.iframe.getAttribute("src")?.endsWith("#modo=embutido") === true);
  checar(
    "nao monta duas vezes",
    montarPainelProjetos(docP, { urlApp: "x", recolhido: false, ordem: null, aoRecolher: () => undefined }) === null,
  );
  const ordens = (o: unknown) => ({ getItem: () => JSON.stringify({ orderPanelHome: o }) });
  checar(
    "ordem: a do painel novo; sem ela, a do legado (projetosGantt)",
    ordemDoPainel(ordens([{ name: "projetosPro", index: 2 }])) === 2 &&
      ordemDoPainel(ordens([{ name: "projetosGantt", index: 4 }])) === 4 &&
      ordemDoPainel(ordens([])) === null,
  );
  const tipos: string[] = [];
  pintarAlertas(titulo, { atrasadas: 1, semana: 2 }, false, (t) => tipos.push(t));
  const pilulas = [...titulo.querySelectorAll(".spro-prj-pilula")].map((p) => p.textContent);
  checar("pilulas com plural certo", pilulas.join("|") === "1 atrasada|2 vencem nesta semana");
  botao(titulo, "2 vencem nesta semana")!.click();
  botao(titulo, "1 atrasada")!.click();
  checar("clique avisa o tipo", tipos.join() === "semana,atrasadas");
  // As formas de um ícone (path d, circle cx/cy/r): a pílula usa o do @comum (tela aprovada: alerta e relógio).
  const formas = (svg: Element | null | undefined) =>
    [...(svg?.querySelectorAll("path, circle") ?? [])]
      .map((f) => ["d", "cx", "cy", "r"].map((a) => f.getAttribute(a) ?? "").join(" "))
      .join("|");
  const pAtrasadas = titulo.querySelector(".spro-prj-atrasadas");
  const pSemana = titulo.querySelector(".spro-prj-semana");
  checar(
    "pilulas com os icones da tela (alerta nas atrasadas, relogio na semana), so decorativos",
    formas(pAtrasadas?.querySelector("svg")) === formas(icone("alerta")) &&
      formas(pSemana?.querySelector("svg")) === formas(icone("relogio")) &&
      formas(icone("alerta")) !== formas(icone("relogio")) &&
      pAtrasadas?.querySelector("svg")?.getAttribute("aria-hidden") === "true",
  );
  const estiloAlertas = docP.getElementById("spro-prj-alertas-estilo")?.textContent ?? "";
  checar(
    "caixa das pilulas escondida de verdade quando vazia (a pagina do SEI nao tem a regra [hidden] da base)",
    /\.spro-prj-alertas\[hidden\]\s*\{\s*display:\s*none/.test(estiloAlertas),
  );
  pintarAlertas(titulo, { atrasadas: 0, semana: 0 }, false, () => undefined);
  checar(
    "sem alertas, sem pilulas (e sem caixa vazia ocupando lugar)",
    !titulo.querySelector(".spro-prj-pilula") && (titulo.querySelector(".spro-prj-alertas") as HTMLElement).hidden,
  );
  pintarAlertas(titulo, { atrasadas: 3, semana: 0 }, true, () => undefined);
  checar("modo noturno marca as pilulas", titulo.querySelector(".spro-prj-alertas")?.classList.contains("spro-prj-escuro") === true);
  (mp.painel.querySelector(".spro-prj-recolher") as HTMLButtonElement).click();
  checar(
    "recolher lembra (pilulas continuam no titulo)",
    recolhidos.join() === "true" && mp.corpo.hidden && !!titulo.querySelector(".spro-prj-pilula"),
  );
  recolhidos = [];

  secao("pagina: pilulas ligadas aos projetos da unidade");
  const { doc: docA } = telaSei("sei41/caixa.html");
  const abertos: boolean[] = [];
  const mA = montarPainelProjetos(docA, { urlApp: "x", recolhido: true, ordem: null, aoRecolher: (r) => abertos.push(r) })!;
  const areaA = areaMemoria();
  const escA = escoposDaUnidade("sei.x", "ana", "1");
  let relogio = 1_000;
  const carimbo = () => ({ agora: ++relogio, dispositivo: "t", por: "ana", nome: "Ana Lima" });
  const repoUn = new RepositorioProjetos(areaA, escA.unidade, carimbo);
  const repoEu = new RepositorioProjetos(areaA, escA.eu, carimbo);
  const pUn = await repoUn.criarProjeto({ nome: "Da unidade" });
  const pEu = await repoEu.criarProjeto({ nome: "So meu" });
  // HOJE = terça 06/10/2026: término 01/10 atrasado; término 09/10 (sexta) vence nesta semana.
  await repoUn.criarEtapa({ projeto: pUn.id, nome: "Atrasada", inicio: "2026-09-28", fim: "2026-10-01" });
  await repoEu.criarEtapa({ projeto: pEu.id, nome: "Sexta", inicio: "2026-10-05", fim: "2026-10-09" });
  const pedidos: Array<{ op: string; args: unknown }> = [];
  let rpcPronto: { chamar(op: string, args?: unknown): Promise<unknown> } | null = null;
  let consultas = 0;
  ligarAlertas(mA, {
    temaEscuro: false,
    repos: { unidade: repoUn, eu: repoEu },
    rpc: () => {
      consultas += 1;
      return rpcPronto;
    },
    hoje: () => HOJE,
    atraso: 1,
    espera: 5,
  });
  await tique(30);
  const tituloA = mA.painel.querySelector(".spro-prj-titulo") as HTMLElement;
  const textos = () => [...tituloA.querySelectorAll(".spro-prj-pilula")].map((p) => p.textContent).join("|");
  checar("conta as etapas dos dois escopos da unidade", textos() === "1 atrasada|1 vence nesta semana", textos());
  await repoEu.criarEtapa({ projeto: pEu.id, nome: "Outra atrasada", inicio: "2026-09-21", fim: "2026-09-25" });
  await tique(30);
  checar("refaz a cada gravacao", textos() === "2 atrasadas|1 vence nesta semana", textos());
  botao(tituloA, "2 atrasadas")!.click();
  checar("clique com o painel recolhido abre o painel (e lembra)", !mA.corpo.hidden && abertos.join() === "false");
  await tique(20);
  checar("app ainda nao ligou: tenta de novo, sem pedir nada ainda", pedidos.length === 0 && consultas >= 3, consultas);
  rpcPronto = {
    chamar: async (op, args) => {
      pedidos.push({ op, args });
      return true;
    },
  };
  await tique(30);
  checar("quando o app liga, pede o alerta uma vez", JSON.stringify(pedidos) === '[{"op":"alerta","args":{"tipo":"atrasadas"}}]', pedidos);
  botao(tituloA, "1 vence nesta semana")!.click();
  await tique();
  checar(
    "app ligado: pede na hora, sem mexer no painel aberto",
    pedidos.length === 2 && JSON.stringify(pedidos[1]?.args) === '{"tipo":"semana"}' && abertos.join() === "false",
  );

  secao("pagina: usuarios da unidade (lista parcial: nada le a arvore)");
  const daCaixa = usuariosDaCaixa(doc);
  checar(
    "atribuicoes da caixa (login e nome)",
    daCaixa.length === 2 && daCaixa.some((u) => u.login === "pedro.soares" && u.nome === "Pedro Soares"),
    daCaixa,
  );
  checar(
    "responsaveis ja usados nas etapas da unidade",
    JSON.stringify(
      responsaveisUsados([
        { etapas: [{ responsavel: { login: "bruno", nome: "Bruno Reis" } }, {}] },
        { etapas: [{ responsavel: { nome: "Dora Alves" } }] },
      ]),
    ) === '[{"login":"bruno","nome":"Bruno Reis"},{"nome":"Dora Alves"}]',
  );
  const area = areaMemoria();
  const CHAVE = "projetos/usuarios/x|u:1";
  const deps = (agora: number, extra: Partial<DepsUsuarios> = {}): DepsUsuarios => ({
    area,
    chave: CHAVE,
    agora,
    daCaixa: [{ login: "bruno", nome: "Bruno Reis" }],
    usados: [{ nome: "Dora Alves" }, { nome: "bruno reis" }, { login: "Carla", nome: "Carla Dias" }],
    eu: { login: "ana", nome: "Ana Lima" },
    buscarCompleta: null,
    ...extra,
  });
  const p1 = await usuariosDaUnidade(deps(1_000));
  checar(
    "sem fonte completa: eu primeiro, depois caixa e responsaveis ja usados, pelo nome, sem repetir",
    nomes(p1) === "ana,bruno,carla,Dora Alves",
    p1,
  );
  const salvo = (await area.obter(CHAVE))[CHAVE] as { completa?: unknown; lista?: unknown };
  checar(
    "guarda so o que a caixa mostrou (nem o eu nem os usados: a chave e da unidade, nao do login)",
    salvo?.completa === false && JSON.stringify(salvo.lista) === '[{"login":"bruno","nome":"Bruno Reis"}]',
    salvo,
  );
  const p2 = await usuariosDaUnidade(deps(1_000 + DIA - 1, { daCaixa: [{ login: "edu", nome: "Edu Melo" }], usados: [] }));
  checar("no mesmo dia, junta quem ja apareceu na caixa", nomes(p2) === "ana,bruno,edu", p2);
  const p3 = await usuariosDaUnidade(deps(1_000 + DIA, { daCaixa: [{ login: "edu", nome: "Edu Melo" }], usados: [] }));
  checar("passado 1 dia, quem sumiu da caixa sai da lista", nomes(p3) === "ana,edu", p3);
  const lixo = areaMemoria({ [CHAVE]: { quando: 5, completa: false, lista: [{ nome: 3 }, null, { login: "x" }, { nome: "Ok" }] } });
  checar(
    "cache estranho nao quebra (so entradas com nome)",
    nomes(await usuariosDaUnidade(deps(6, { area: lixo, daCaixa: [], usados: [] }))) === "ana,Ok",
  );

  secao("pagina: fonte completa de usuarios (encaixe para uma fonte segura)");
  const area2 = areaMemoria();
  let buscas = 0;
  let falhar = false;
  const fonte = async () => {
    buscas += 1;
    if (falhar) throw new Error("sem acesso");
    return [
      { login: "carla", nome: "Carla Dias" },
      { login: "ana", nome: "Ana Lima" },
    ];
  };
  const comFonte = (agora: number) => deps(agora, { area: area2, usados: [], buscarCompleta: fonte });
  const u1 = await usuariosDaUnidade(comFonte(1_000));
  checar("primeira vez: lista completa + caixa, eu primeiro, sem repetir", nomes(u1) === "ana,bruno,carla" && buscas === 1, u1);
  await usuariosDaUnidade(comFonte(1_000 + DIA - 1));
  checar("cache de 1 dia: nao busca de novo", buscas === 1);
  falhar = true;
  const u3 = await usuariosDaUnidade(comFonte(1_000 + DIA + 1));
  checar("venceu e a busca falhou: fica a lista anterior + caixa", buscas === 2 && nomes(u3) === "ana,bruno,carla", u3);
  await usuariosDaUnidade(comFonte(1_000 + DIA + 2));
  checar("sem lista completa, tenta de novo na proxima", buscas === 3);

  secao("pagina: nada le a arvore do processo nem monta link do SEI (ruling da T12)");
  const semComentario = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
  const fontes = readdirSync(PASTA_PAGINA)
    .filter((f) => f.endsWith(".ts"))
    .map((f) => ({ f, codigo: semComentario(readFileSync(join(PASTA_PAGINA, f), "utf8")) }));
  const PROIBIDOS = [
    // P5: a árvore JÁ aberta é lida no próprio frame (pagina/arvore.ts, conferido abaixo); buscar, nunca.
    /@nucleo\/dominio\/opcoes/,
    /\blistarOpcoes\b/,
    /\babrirArvore\b/,
    /\.arvore\(/,
    /\bnew Sei\(/,
    /procedimento_visualizar|arvore_montar/,
    /controlador\.php/,
  ];
  const achados = fontes.flatMap(({ f, codigo }) => PROIBIDOS.filter((re) => re.test(codigo)).map((re) => `${f}: ${re}`));
  checar(
    "content script: sem leitura de arvore, sem lista do formulario de atribuicao, sem URL montada",
    fontes.length >= 7 && achados.length === 0,
    achados.length ? achados : fontes.map((x) => x.f),
  );
  const daArvore = fontes.filter((x) => /@nucleo\/dominio\/arvore/.test(x.codigo));
  checar(
    "da arvore, so o lerArvore sobre a propria pagina do frame (pagina/arvore.ts), sem buscar nem acao",
    daArvore.map((x) => x.f).join() === "arvore.ts" &&
      /lerArvore\(paginaDe\(d\.doc, d\.url\)\)/.test(daArvore[0]?.codigo ?? "") &&
      !/\babrirArvore\b|\bacaoNaArvore\b/.test(daArvore[0]?.codigo ?? ""),
    daArvore.map((x) => x.f),
  );
  const principal = fontes.find((x) => x.f === "principal.ts")?.codigo ?? "";
  checar("main liga os usuarios sem fonte completa", /buscarCompleta:\s*null/.test(principal));

  secao("pagina: conferir numero SEI pela pesquisa rapida");
  const { pagina: trab } = telaSei("sei41/trabalhar.html");
  const comUrl = (url: string): Pagina => ({ ...trab, url, html: trab.html, doc: trab.doc });
  const pesquisas: string[] = [];
  const doc1 = await conferirDocumento(async (ref) => {
    pesquisas.push(ref);
    return comUrl("https://sei.x/sei/controlador.php?acao=procedimento_trabalhar&id_protocolo=999&infra_hash=0");
  }, "SEI 1240001");
  checar(
    "documento: protocolo do processo pelo titulo da tela",
    pesquisas.join() === "1240001" && doc1?.numero === "1240001" && doc1.protocolo === "99906.713-630.000032/2025-82",
    doc1,
  );
  checar(
    "numero de processo (nao de documento): nao serve",
    (await conferirDocumento(
      async () => comUrl("https://sei.x/sei/controlador.php?acao=procedimento_trabalhar&id_protocolo=148265"),
      "148265",
    )) === null,
  );
  checar(
    "pesquisa que nao abre processo (resultado da pesquisa, acesso negado): null",
    (await conferirDocumento(async () => comUrl("https://sei.x/sei/controlador.php?acao=protocolo_pesquisa_rapida"), "77")) === null,
  );
  checar(
    "nada encontrado: null",
    (await conferirDocumento(async () => {
      throw new ErroSei("SEI_NAO_ENCONTRADO", "Nada encontrado");
    }, "77")) === null,
  );
  checar(
    "sessao caiu: o erro sobe",
    (
      await lanca(() =>
        conferirDocumento(async () => {
          throw new ErroSei("SEI_SESSAO_EXPIRADA", "Sessao expirada");
        }, "77"),
      )
    )?.codigo === "SEI_SESSAO_EXPIRADA",
  );
  const antes = pesquisas.length;
  const vazios = [await conferirDocumento(async () => trab, "abc"), await conferirDocumento(async () => trab, "1".repeat(25))];
  checar("sem digitos ou longo demais: nem pesquisa", vazios.every((v) => v === null) && pesquisas.length === antes);

  secao("pagina: executor RPC");
  const { doc: docE } = telaSei("sei41/caixa.html");
  const form = docE.querySelector("#frmProtocoloPesquisaRapida") as HTMLFormElement;
  const campo = docE.querySelector("#txtPesquisaRapida") as HTMLInputElement;
  const enviados: Array<{ valor: string; alvo: string | null }> = [];
  (form as unknown as { requestSubmit: () => void }).requestSubmit = () => {
    enviados.push({ valor: campo.value, alvo: form.getAttribute("target") });
  };
  const caixa = processosDaCaixa(docE);
  checar(
    "processos da caixa sem requisicao; sigiloso sem especificacao",
    caixa.length > 3 && caixa.some((p) => p.sigiloso) && caixa.every((p) => !p.sigiloso || !p.especificacao),
  );
  const { doc: docT } = telaSei("sei41/caixa.html");
  docT.querySelector("#tblProcessosRecebidos tr[id^='P'] input[type=checkbox]")?.setAttribute("title", "  50300.000999/2026-10 ");
  const caixaT = processosDaCaixa(docT);
  checar(
    "processos da caixa: numero sem os espacos das pontas",
    caixaT.some((p) => p.protocolo === "50300.000999/2026-10") && caixaT.every((p) => p.protocolo === p.protocolo.trim()),
    caixaT.map((p) => p.protocolo),
  );
  const CTX = { host: "h", login: "l", nome: "n", unidade: null, versao: "", temaEscuro: false, atividades: true } as ContextoProjetos;
  const trat = tratadoresProjetos({
    doc: docE,
    ctx: CTX,
    iframe: null,
    avisarAcoes: avisoComAcoesNaPagina(docE, false, "spro-prj"),
    usuarios: async () => [{ nome: "X" }],
    conferir: async (n) => ({ numero: n }),
  });
  checar("contexto e atividades", (await trat.contexto?.(null)) === CTX && (await trat.atividadesDisponivel?.(null)) === true);
  await trat.abrirDocumento?.({ numero: "SEI nº 1240001" });
  checar(
    "abrir documento: pesquisa rapida em aba nova",
    enviados[0]?.valor === "1240001" && enviados[0]?.alvo === "_blank" && form.getAttribute("target") !== "_blank",
  );
  checar(
    "abrir documento sem numero: erro claro",
    (await lanca(() => trat.abrirDocumento?.({ numero: "abc" })))?.codigo === "ARGUMENTO_INVALIDO",
  );
  checar(
    "usuarios e conferir passam adiante",
    JSON.stringify(await trat.usuariosDaUnidade?.(null)) === '[{"nome":"X"}]' &&
      JSON.stringify(await trat.conferirDocumento?.({ numero: "12" })) === '{"numero":"12"}',
  );
  const resposta = trat.aviso?.({
    texto: "Concluída.",
    acao: "Informar documento",
    acoes: ["Informar documento", "Desfazer"],
    ms: 200,
  }) as Promise<number>;
  botao(docE.body, "Desfazer")!.click();
  checar("aviso com duas acoes na tela do SEI", (await resposta) === 1);
  await tique();
}
