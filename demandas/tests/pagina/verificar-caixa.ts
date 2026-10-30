/**
 * D18: o icone das demandas na grade do Controle de Processos (sei41/caixa.html, a fixture real): indice por protocolo
 * nos dois escopos (pela chave, so digitos), icone so na linha com demanda (as duas tabelas), contagem e rotulo, nada
 * fora da tela "caixa", clique com o balao da D17 (as demandas certas, Esc, foco), Iniciar e Concluir pelo balao
 * atualizando o repositorio e o icone, reaplicacao depois do redesenho da grade (sem duplicar, sem laco), sigilo da
 * linha e o que o pacote leva (e nao leva).
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { areaMemoria } from "@comum/armazenamento/area";
import { consentimentoNaArea } from "@comum/sincronia/consentimento";
import { balaoAberto } from "@projetos/pagina/balaoAtual";
import { build } from "esbuild";
import { escoposDaUnidade } from "../../src/modelo/escopo";
import type { Vis } from "../../src/modelo/tipos";
import { abrirBalaoDemandas } from "../../src/pagina/balaoDemandas";
import { indiceDeDemandas, instalarIconesCaixa, processoDaLinha, rotuloDoIcone } from "../../src/pagina/caixa";
import { PALETA_ICONE } from "../../src/pagina/icone";
import { RepositorioDemandas } from "../../src/repositorio";
import { HOJE } from "../fabrica";
import { botao, checar, disparar, secao, telaSei, tique } from "./util";

const PASTA_PAGINA = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "pagina");
const CAU = "99906.713-630.000032/2025-82";
const DIGITOS_CAU = "99906713630000032202582";
const EXPEDIENTE = "012.00000178/2025-23";
const GERADO = "99906.713-630.000022/2026-28";
const GERADO_ARQUIVADO = "99906.713-630.000019/2026-12";
const SIGILOSO = "034.00000265/2026-31";
const EU = { login: "pedro.soares", nome: "Pedro Soares" };

function cenario() {
  const { doc } = telaSei("sei41/caixa.html");
  const area = areaMemoria();
  const esc = escoposDaUnidade("treinamento.sei.sp.gov.br", "pedro.soares", "110000001");
  let relogio = 1_790_000_000_000;
  const carimbo = () => ({ agora: ++relogio, dispositivo: "t", por: "pedro.soares", nome: "Pedro Soares" });
  let n = 0;
  const gerar = () => `d${++n}`;
  const repos: Record<Vis, RepositorioDemandas> = {
    unidade: new RepositorioDemandas(area, esc.unidade, carimbo, gerar),
    eu: new RepositorioDemandas(area, esc.eu, carimbo, gerar),
  };
  return { doc, area, repos };
}
type Cenario = ReturnType<typeof cenario>;

const linha = (doc: Document, id: string) => doc.getElementById(`P${id}`) as HTMLElement;
const icones = (el: ParentNode) => el.querySelectorAll(".spro-dem-cx").length;
const seloDe = (el: ParentNode) => el.querySelector<HTMLElement>(".spro-dem-cx-n");

async function povoar(c: Cenario) {
  const a = await c.repos.unidade.criar({
    titulo: "Parecer do CAU",
    prazo: "2026-10-30",
    processos: [{ protocolo: CAU, idProcedimento: "148265" }],
  });
  // Pelos digitos e em "Só eu": o mesmo processo, escrito sem pontuacao.
  const b = await c.repos.eu.criar({ titulo: "Minha do CAU", prazo: "2026-10-01", processos: [{ protocolo: DIGITOS_CAU }] });
  const e = await c.repos.unidade.criar({ titulo: "Expediente", prazo: "2026-10-30", processos: [{ protocolo: EXPEDIENTE }] });
  const g = await c.repos.eu.criar({ titulo: "Do gerado", prazo: "2026-10-30", processos: [{ protocolo: GERADO }] });
  const arq = await c.repos.unidade.criar({ titulo: "Arquivada", prazo: "2026-10-30", processos: [{ protocolo: GERADO_ARQUIVADO }] });
  await c.repos.unidade.aplicar(arq.id, (d, k) => ({
    demanda: { ...d, iniciadaEm: 1, concluidaEm: "2026-10-05", arquivadoEm: k.agora },
    registros: [],
  }));
  await c.repos.unidade.criar({ titulo: "De outro processo", prazo: "2026-10-30", processos: [{ protocolo: "50300.000001/2026-11" }] });
  return { a, b, e, g, arq };
}

function ligar(c: Cenario, abertos: Array<{ ancora: HTMLElement; protocolo: string }> = []) {
  return instalarIconesCaixa({
    doc: c.doc,
    repos: c.repos,
    hoje: () => HOJE,
    atraso: 1,
    abrir: (ancora, p) => void abertos.push({ ancora, protocolo: p.protocolo }),
  });
}

async function verificarIndiceEIcones(): Promise<void> {
  secao("grade: o indice por protocolo (dois escopos, so vivas e nao arquivadas) e o icone so nas linhas com demanda");
  const c = cenario();
  const d = await povoar(c);
  const todas = [
    ...(await c.repos.unidade.dados()).map((x) => ({ demanda: x })),
    ...(await c.repos.eu.dados()).map((x) => ({ demanda: x })),
  ];
  checar("tem demandas para indexar", todas.length === 6, todas.length);
  const abertos: Array<{ ancora: HTMLElement; protocolo: string }> = [];
  const caixa = ligar(c, abertos);
  await caixa.atualizar();
  checar("tres processos com demanda, tres icones (recebidos e gerados)", icones(c.doc) === 3, icones(c.doc));
  const cau = linha(c.doc, "148265");
  const icCau = cau.querySelector<HTMLElement>(".spro-dem-cx")!;
  checar(
    "CAU: duas demandas (uma por escopo, casadas pelos digitos)",
    icCau.getAttribute("aria-label") === "2 demandas neste processo",
    icCau.getAttribute("aria-label"),
  );
  checar("title igual ao rotulo", icCau.title === "2 demandas neste processo");
  checar("selo de contagem azul com 2", seloDe(icCau)?.hidden === false && seloDe(icCau)?.textContent === "2");
  const exp = linha(c.doc, "150098").querySelector<HTMLElement>(".spro-dem-cx")!;
  checar(
    "Expediente: uma demanda, sem selo",
    exp.getAttribute("aria-label") === rotuloDoIcone(1) && seloDe(exp)?.hidden === true && seloDe(exp)?.textContent === "",
  );
  checar(
    "na tabela de gerados tambem",
    icones(linha(c.doc, "160259")) === 1 && linha(c.doc, "160259").closest("#tblProcessosGerados") !== null,
  );
  checar("so arquivada: sem icone", icones(linha(c.doc, "160210")) === 0);
  checar("processo sem demanda: sem icone", icones(linha(c.doc, "112825")) === 0 && icones(linha(c.doc, "154676")) === 0);
  checar(
    "botao que abre um dialogo, fechado; na coluna dos icones (2a celula)",
    icCau.tagName === "BUTTON" &&
      icCau.getAttribute("aria-haspopup") === "dialog" &&
      icCau.getAttribute("aria-expanded") === "false" &&
      icCau.parentElement === cau.querySelectorAll("td")[1],
  );
  checar(
    "o mesmo desenho colorido da D17 (paleta fechada) em 20 px",
    (() => {
      const svg = icCau.querySelector("svg")!;
      const cores = [...svg.querySelectorAll("*")]
        .flatMap((n) => [n.getAttribute("fill"), n.getAttribute("stroke")])
        .filter((x): x is string => !!x && x !== "none");
      return svg.getAttribute("width") === "20" && cores.every((x) => (PALETA_ICONE as readonly string[]).includes(x));
    })(),
  );
  const idx = indiceDeDemandas([
    {
      demanda: { ...d.a, processos: [{ protocolo: "99906.713-630.000032/2025-82" }, { protocolo: DIGITOS_CAU }] },
      situacao: "nao_iniciada",
    } as never,
  ]);
  checar("a mesma demanda citando o processo duas vezes conta uma", idx.get(DIGITOS_CAU)?.length === 1);
  const ze = indiceDeDemandas([{ demanda: { ...d.e, processos: [{ protocolo: EXPEDIENTE }] }, situacao: "nao_iniciada" } as never]);
  checar(
    "zeros a esquerda contam (a chave e so digitos): o zero tirado nao e o mesmo processo",
    ze.has("01200000178202523") && !ze.has("1200000178202523"),
  );

  secao("grade: o processo da linha (sem especificacao)");
  clicar(icCau);
  checar(
    "clique pede o balao com o protocolo da linha",
    abertos.length === 1 && abertos[0]?.protocolo === CAU && abertos[0].ancora === icCau,
  );
  const p = processoDaLinha(cau)!;
  checar(
    "protocolo, idProcedimento, tipo; sem especificacao",
    p.protocolo === CAU && p.idProcedimento === "148265" && !p.sigiloso && !!p.tipo && !("especificacao" in p),
    p,
  );
  caixa.parar();
}

const clicar = (el: HTMLElement) => el.click();

async function verificarAtivacao(): Promise<void> {
  secao("grade: so na tela caixa (e o carregador so liga com a opcao)");
  const { doc } = telaSei("sei41/processo_visualizar.html");
  const c = { ...cenario(), doc };
  await povoar(c);
  const caixa = ligar(c);
  await caixa.atualizar();
  checar("fora do Controle de Processos: nenhum icone", icones(doc) === 0);
  caixa.parar();
  const fonte = readFileSync(join(PASTA_PAGINA, "principal.ts"), "utf8");
  checar("o principalTopo so liga a grade na caixa", /if \(naCaixa\) \{\s*try \{\s*ligarCaixa/.test(fonte));
}

async function verificarBalaoEAcoes(): Promise<void> {
  secao("grade: o clique abre o balao com as demandas certas; Iniciar e Concluir atualizam o repositorio e o icone");
  const c = cenario();
  const d = await povoar(c);
  const consentimento = consentimentoNaArea({
    area: areaMemoria(),
    chavePreferencias: "demandas/consentimento",
    campo: "textoPadrao",
    chave: "k",
  });
  await consentimento.definir("ligado");
  const painel: string[] = [];
  const focados: Element[] = [];
  const proto = Object.getPrototypeOf(c.doc.createElement("button")) as { focus: () => void };
  const focoOriginal = proto.focus;
  proto.focus = function (this: Element) {
    focados.push(this);
  };
  const caixa = instalarIconesCaixa({
    doc: c.doc,
    repos: c.repos,
    hoje: () => HOJE,
    atraso: 1,
    abrir: (ancora, processo) =>
      void abrirBalaoDemandas(
        ancora,
        { processo, documento: null },
        {
          repos: c.repos,
          hoje: () => HOJE,
          sigla: "TESTE",
          temaEscuro: false,
          cssBase: "",
          consentimento,
          eu: EU,
          usuarios: async () => [EU],
          abrirNoPainel: (id) => void painel.push(id),
        },
      ),
  });
  await caixa.atualizar();
  const ic = () => linha(c.doc, "148265").querySelector<HTMLElement>(".spro-dem-cx")!;
  ic().click();
  await tique(30);
  const aberto = balaoAberto();
  checar(
    "abre, ancorado ao icone, e o icone diz que esta aberto",
    aberto?.ancora === ic() && ic().getAttribute("aria-expanded") === "true",
  );
  const linhas = [...(aberto?.raiz.querySelectorAll<HTMLElement>(".pb-vinc[data-demanda]") ?? [])].map((l) =>
    l.getAttribute("data-demanda"),
  );
  checar("so as demandas deste processo (dos dois escopos)", linhas.sort().join() === [d.a.id, d.b.id].sort().join(), linhas);
  checar(
    "o balao e o do processo da linha",
    aberto?.raiz.querySelector("[role='dialog']")?.getAttribute("aria-label") === `Demandas do processo ${CAU}`,
  );
  checar("o foco vai ao primeiro controle do balao", focados.length > 0 && focados.at(-1)?.closest?.("button") !== null);
  const linhaA = () => aberto!.raiz.querySelector<HTMLElement>(`.pb-vinc[data-demanda='${d.a.id}']`)!;
  checar(
    "situacao, prazo e Iniciar / Abrir no painel",
    (linhaA().textContent ?? "").includes("Não iniciada") &&
      (linhaA().textContent ?? "").includes("30/10/2026") &&
      !!botao(linhaA(), "Iniciar") &&
      !!botao(linhaA(), "Abrir no painel"),
  );

  // Esc fecha e o foco volta ao icone.
  const antes = focados.length;
  const Ev = c.doc.defaultView as unknown as { Event: typeof Event };
  const esc = new Ev.Event("keydown", { bubbles: true });
  Object.defineProperty(esc, "key", { value: "Escape" });
  c.doc.body.dispatchEvent(esc);
  await tique(10);
  checar(
    "Esc fecha o balao, o icone volta a 'fechado' e recebe o foco",
    balaoAberto() === null && ic().getAttribute("aria-expanded") === "false" && focados.length > antes && focados.at(-1) === ic(),
  );

  // Iniciar pelo balao.
  ic().click();
  await tique(30);
  const b2 = balaoAberto()!;
  const l2 = () => b2.raiz.querySelector<HTMLElement>(`.pb-vinc[data-demanda='${d.a.id}']`)!;
  botao(l2(), "Iniciar")!.click();
  await tique(40);
  const ini = await c.repos.unidade.obter(d.a.id);
  checar(
    "Iniciar: gravada no repositorio e o balao oferece Concluir",
    ini?.iniciadaEm !== undefined && !!botao(l2(), "Concluir com este documento…"),
    ini?.iniciadaEm,
  );
  checar(
    "o icone segue com 2 (reatividade ao storage, sem duplicar)",
    icones(linha(c.doc, "148265")) === 1 && seloDe(ic())?.textContent === "2",
  );
  botao(l2(), "Concluir com este documento…")!.click();
  botao(l2(), "Concluir")!.click();
  await tique(40);
  const fim = await c.repos.unidade.obter(d.a.id);
  checar("Concluir: gravada no repositorio", fim?.concluidaEm === HOJE, fim?.concluidaEm);
  b2.fechar();

  // A demanda que sai (arquivada por outra tela / aba): o icone se ajusta pelo storage.
  await c.repos.eu.aplicar(d.b.id, (x, k) => ({
    demanda: { ...x, iniciadaEm: 1, concluidaEm: "2026-10-05", arquivadoEm: k.agora },
    registros: [],
  }));
  await tique(60);
  checar(
    "arquivar uma das duas: a contagem cai para 1 (o selo some) e o rotulo acompanha",
    ic().getAttribute("aria-label") === rotuloDoIcone(1) && seloDe(ic())?.hidden === true,
    ic().getAttribute("aria-label"),
  );
  await c.repos.unidade.aplicar(d.a.id, (x, k) => ({ demanda: { ...x, arquivadoEm: k.agora }, registros: [] }));
  await tique(60);
  checar("arquivar a ultima: o icone sai da linha", icones(linha(c.doc, "148265")) === 0);
  const nova = await c.repos.eu.criar({ titulo: "Nova", prazo: "2026-10-30", processos: [{ protocolo: CAU }] });
  await tique(60);
  checar(
    "criar uma demanda: o icone aparece sozinho",
    icones(linha(c.doc, "148265")) === 1 && nova.id !== "",
    icones(linha(c.doc, "148265")),
  );
  proto.focus = focoOriginal;
  caixa.parar();
}

async function verificarRedesenho(): Promise<void> {
  secao("grade: reaplicacao depois do redesenho (celula, clone, linhas novas), sem duplicar e sem laco");
  const c = cenario();
  await povoar(c);
  const leituras = { n: 0 };
  for (const r of Object.values(c.repos)) {
    const dados = r.dados.bind(r);
    r.dados = () => {
      leituras.n++;
      return dados();
    };
  }
  const caixa = ligar(c);
  await caixa.atualizar();
  await tique(40);
  const base = leituras.n;
  checar("a carga lê cada escopo uma vez", base === 2, base);
  await tique(60);
  checar("parado sozinho: nenhuma leitura nova (o icone inserido nao redispara)", leituras.n === base, leituras.n - base);
  linha(c.doc, "148265").querySelector(".spro-dem-cx")?.remove();
  await tique(30);
  checar("celula redesenhada: o icone volta uma vez, sem reler o storage", icones(linha(c.doc, "148265")) === 1 && leituras.n === base);
  linha(c.doc, "112825").querySelectorAll("td")[1]!.append(c.doc.createElement("span"));
  await tique(30);
  checar("mudanca de fora na grade: nada duplica", icones(c.doc) === 3, icones(c.doc));
  const corpo = linha(c.doc, "148265").parentElement!;
  const clone = linha(c.doc, "148265").cloneNode(true) as HTMLElement;
  clone.id = "P148265";
  const tabela = c.doc.createElement("table");
  const tb = c.doc.createElement("tbody");
  tb.append(clone);
  tabela.append(tb);
  c.doc.querySelector("#frmProcedimentoControlar")!.append(tabela);
  await tique(30);
  checar("o clone do legado (agrupar) leva um icone so", icones(clone) === 1 && icones(c.doc) === 4, icones(c.doc));
  tabela.remove();
  // Paginacao / "Ver todos": centenas de linhas novas de uma vez.
  const modelo = linha(c.doc, "148265").cloneNode(true) as HTMLElement;
  modelo.querySelector(".spro-dem-cx")?.remove();
  const novas: HTMLElement[] = [];
  for (let i = 0; i < 300; i++) {
    const tr = modelo.cloneNode(true) as HTMLElement;
    tr.id = `P9${String(i).padStart(5, "0")}`;
    novas.push(tr);
  }
  corpo.append(...novas);
  for (let i = 0; i < 100 && !novas.every((tr) => icones(tr) === 1); i++) await tique(5);
  checar(
    "300 linhas novas: um icone em cada, sem reler o storage",
    novas.every((tr) => icones(tr) === 1) && leituras.n === base,
    leituras.n - base,
  );
  await tique(40);
  checar("e para de novo", leituras.n === base);
  caixa.parar();
  linha(c.doc, "148265").querySelector(".spro-dem-cx")?.remove();
  await tique(30);
  checar("parado: nao repinta", icones(linha(c.doc, "148265")) === 0);
}

async function verificarSigilo(): Promise<void> {
  secao("grade: processo sigiloso (o numero casa, a especificacao nunca aparece, a marca vai aos vinculos)");
  const c = cenario();
  const s = await c.repos.unidade.criar({ titulo: "Do sigiloso", prazo: "2026-10-30", processos: [{ protocolo: SIGILOSO }] });
  const chamadas: string[] = [];
  for (const [vis, repo] of Object.entries(c.repos)) {
    const marcar = repo.marcarSigilosos.bind(repo);
    repo.marcarSigilosos = (lista: readonly string[]) => {
      chamadas.push(`${vis}:${lista.join(",")}`);
      return marcar(lista);
    };
  }
  const consentimento = consentimentoNaArea({
    area: areaMemoria(),
    chavePreferencias: "demandas/consentimento",
    campo: "textoPadrao",
    chave: "k",
  });
  await consentimento.definir("ligado");
  const caixa = instalarIconesCaixa({
    doc: c.doc,
    repos: c.repos,
    hoje: () => HOJE,
    atraso: 1,
    abrir: (ancora, processo) =>
      void abrirBalaoDemandas(
        ancora,
        { processo, documento: null },
        {
          repos: c.repos,
          hoje: () => HOJE,
          sigla: "TESTE",
          temaEscuro: false,
          cssBase: "",
          consentimento,
          eu: EU,
          usuarios: async () => [EU],
          abrirNoPainel: () => undefined,
        },
      ).catch((e) => checar("o balao abre sem erro", false, e)),
  });
  await caixa.atualizar();
  await tique(40);
  const li = linha(c.doc, "157584");
  checar(
    "o sigiloso casa pelo numero guardado aqui: um icone, uma demanda",
    icones(li) === 1 && li.querySelector(".spro-dem-cx")?.getAttribute("aria-label") === rotuloDoIcone(1),
  );
  checar(
    "a linha sigilosa e marcada nos dois escopos, uma vez",
    chamadas.sort().join("|") === `eu:${SIGILOSO}|unidade:${SIGILOSO}`,
    chamadas,
  );
  checar("o vinculo da demanda passa a sigiloso", (await c.repos.unidade.obter(s.id))?.processos[0]?.sigiloso === true);
  const p = processoDaLinha(li)!;
  checar("a linha sigilosa nao leva especificacao", p.sigiloso && !("especificacao" in p));
  li.querySelector<HTMLElement>(".spro-dem-cx")!.click();
  await tique(40);
  const texto = balaoAberto()?.raiz.querySelector("[role='dialog']")?.textContent ?? "";
  checar("o menu abre e lista a demanda", texto.includes("Do sigiloso"), texto.slice(0, 200));
  checar(
    "o menu nao mostra a especificacao da linha nem o aviso sem querer",
    !texto.includes("Dilação de prazo") && !texto.includes("BO 0001"),
  );
  caixa.parar();
  void disparar;
}

async function verificarPacote(): Promise<void> {
  secao("grade: o que o pacote da pagina leva (e nao leva)");
  const r = await build({
    entryPoints: [join(PASTA_PAGINA, "principal.ts")],
    bundle: true,
    write: false,
    format: "esm",
    charset: "ascii",
    target: ["chrome116"],
    logLevel: "silent",
    loader: { ".css": "text" },
    splitting: true,
    minify: true,
    outdir: "saida",
  });
  const todos = r.outputFiles.map((f) => f.text).join("\n");
  const proibidos = ["procedimento_visualizar", "arvore_montar", "procedimento_atribuicao_cadastrar"].filter((p) => todos.includes(p));
  checar("nenhum endereco proibido no pacote", proibidos.length === 0, proibidos);
  checar("so ASCII", ![...todos].some((ch) => ch.charCodeAt(0) > 0x7f));
  const fonte = readFileSync(join(PASTA_PAGINA, "caixa.ts"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  checar(
    "a grade nao faz requisicao nem monta URL do SEI nem busca a arvore",
    !/fetch\(|XMLHttpRequest|controlador\.php|criarHttp|abrirArvore|lerArvore/.test(fonte),
  );
  checar(
    "DOM seguro: sem innerHTML/outerHTML nem on*=",
    !/\.(innerHTML|outerHTML)\s*=(?!=)|insertAdjacentHTML/.test(fonte) && !/\bon[a-z]+\s*=\s*["']/.test(fonte),
  );
}

export async function verificarCaixa(): Promise<void> {
  await verificarIndiceEIcones();
  await verificarAtivacao();
  await verificarBalaoEAcoes();
  await verificarRedesenho();
  await verificarSigilo();
  await verificarPacote();
}
