/**
 * A caixa do Controle de Processos (sei41/caixa.html): o ícone só em processo
 * ligado, depois da estrela dos Favoritos, com o ponto de atraso, sem
 * duplicar a cada mutação (nem no clone do legado), sem laço de mutação e sem
 * reler o storage a cada mudança da tela; todo processo sigiloso visto marca os
 * vínculos (e lembra o número que só ficou no histórico), uma vez por carga, e a
 * memória do sigilo ilegível não derruba a caixa; e o balão em Shadow DOM: "Em N
 * projetos", o prazo das etapas, "Abrir no painel", "Adicionar a outro projeto"
 * (nova etapa, ligar, processo do projeto) com o "Entendi" da unidade (o mesmo
 * consentimento da P4), Esc, clique fora e o foco de volta.
 */

import { areaMemoria } from "@comum/armazenamento/area";
import { consentimentoNaArea } from "@comum/sincronia/consentimento";
import { MENSAGEM_SEM_ENTENDI } from "../../src/app/colaboracao/consentir";
import { prefixoMemoriaSigilo } from "../../src/modelo/constantes";
import { escoposDaUnidade } from "../../src/modelo/escopo";
import { ErroMemoriaSigilo } from "../../src/modelo/memoriaSigilo";
import type { Vis } from "../../src/modelo/tipos";
import { ErroValidacao } from "../../src/modelo/validacao";
import { chaveProtocolo } from "../../src/modelo/vinculos";
import { adicionarAoProjeto, concluirComDocumento } from "../../src/pagina/adicionar";
import { balaoAberto } from "../../src/pagina/balaoAtual";
import { abrirBalaoProcesso, type DepsBalaoProcesso } from "../../src/pagina/balaoProcesso";
import { instalarIconesCaixa } from "../../src/pagina/caixa";
import { MENSAGEM_AGORA_NAO, type ProcessoNaTela } from "../../src/pagina/conteudo";
import { RepositorioProjetos } from "../../src/repositorio";
import { HOSTIL } from "../cenarioGantt";
import { HOJE } from "../fabrica";
import { escolher } from "../util";
import { botao, checar, disparar, lanca, secao, telaSei, tique } from "./util";

const HOST = "treinamento.sei.sp.gov.br";
const LOGIN = "pedro.soares";
const CAU = "99906.713-630.000032/2025-82";
const EXPEDIENTE = "012.00000178/2025-23";
const SIGILOSO = "034.00000265/2026-31";
const OFICIO = "99991.000052/2023-22";

async function cenario() {
  const { doc } = telaSei("sei41/caixa.html");
  const area = areaMemoria();
  const esc = escoposDaUnidade(HOST, LOGIN, "110000001");
  let relogio = 1_000;
  const carimbo = () => ({ agora: ++relogio, dispositivo: "t", por: LOGIN, nome: "Pedro Soares" });
  const repos: Record<Vis, RepositorioProjetos> = {
    unidade: new RepositorioProjetos(area, esc.unidade, carimbo),
    eu: new RepositorioProjetos(area, esc.eu, carimbo),
  };
  const revisao = await repos.unidade.criarProjeto({ nome: HOSTIL, processo: { protocolo: CAU, idProcedimento: "148265" } });
  const atrasada = await repos.unidade.criarEtapa({
    projeto: revisao.id,
    nome: "Relatório de AIR",
    inicio: "2026-09-01",
    fim: "2026-10-01",
  });
  await repos.unidade.criarEtapa({ projeto: revisao.id, nome: "Consolidação", inicio: "2026-10-16", fim: "2026-11-06" });
  const pessoal = await repos.eu.criarProjeto({ nome: "Plano pessoal" });
  const ligada = await repos.eu.criarEtapa({
    projeto: pessoal.id,
    nome: "Pesquisa",
    inicio: "2026-10-05",
    fim: "2026-10-09",
    processo: { protocolo: EXPEDIENTE },
  });
  const apuracao = await repos.unidade.criarProjeto({ nome: "Apuração", processo: { protocolo: SIGILOSO, idProcedimento: "157584" } });
  return { doc, area, repos, revisao, atrasada, pessoal, ligada, apuracao };
}

const linha = (doc: Document, id: string) => doc.getElementById(`P${id}`) as HTMLElement;
const icones = (el: ParentNode) => el.querySelectorAll(".spro-prj-ic").length;

/** Conta as leituras do storage pelos repositórios (cada `dados()` lê o escopo inteiro). */
function contarLeituras(repos: Record<Vis, RepositorioProjetos>): { n: number } {
  const c = { n: 0 };
  for (const r of Object.values(repos)) {
    const dados = r.dados.bind(r);
    r.dados = () => {
      c.n++;
      return dados();
    };
  }
  return c;
}

/**
 * Anota cada número pedido a `marcarSigilosos` ("vis:numero") e cada pedido inteiro em `lotes` ("vis:numero,numero"):
 * um pedido é uma leitura do escopo.
 */
function espiarSigilo(repos: Record<Vis, RepositorioProjetos>, lotes: string[] = []): string[] {
  const chamadas: string[] = [];
  for (const [vis, r] of Object.entries(repos)) {
    const marcar = r.marcarSigilosos.bind(r);
    r.marcarSigilosos = (lista: readonly string[]) => {
      for (const p of lista) chamadas.push(`${vis}:${p}`);
      lotes.push(`${vis}:${[...lista].sort().join(",")}`);
      return marcar(lista);
    };
  }
  return chamadas;
}

async function verificarIcones(): Promise<void> {
  secao("caixa: icone so em processo ligado");
  const c = await cenario();
  const sigilo = espiarSigilo(c.repos);
  // A estrela dos Favoritos já está na linha do expediente (o ícone vem logo depois dela).
  const estrela = c.doc.createElement("button");
  estrela.className = "spro-fav-estrela";
  linha(c.doc, "150098").querySelectorAll("td")[1]!.prepend(estrela);
  const abertos: Array<{ ancora: HTMLElement; p: ProcessoNaTela }> = [];
  const caixa = instalarIconesCaixa({
    doc: c.doc,
    repos: c.repos,
    hoje: () => HOJE,
    temaEscuro: false,
    atraso: 1,
    abrir: (ancora, p) => void abertos.push({ ancora, p }),
  });
  await caixa.atualizar();
  checar("tres processos ligados, tres icones", icones(c.doc) === 3, icones(c.doc));
  checar("processo sem projeto: sem icone", icones(linha(c.doc, "112825")) === 0 && icones(linha(c.doc, "160259")) === 0);
  const cau = linha(c.doc, "148265").querySelector<HTMLElement>(".spro-prj-ic")!;
  checar(
    "ponto vermelho e rotulo com a etapa atrasada",
    cau.hasAttribute("data-atraso") && cau.getAttribute("aria-label") === "Em 1 projeto · com etapa atrasada",
    cau.getAttribute("aria-label"),
  );
  checar(
    "botao que abre um dialogo, fechado",
    cau.tagName === "BUTTON" && cau.getAttribute("aria-haspopup") === "dialog" && cau.getAttribute("aria-expanded") === "false",
  );
  checar("na coluna dos icones (2a celula)", cau.parentElement === linha(c.doc, "148265").querySelectorAll("td")[1]);
  checar("logo depois da estrela dos Monitorados", estrela.nextElementSibling?.classList.contains("spro-prj-ic") === true);
  const exp = linha(c.doc, "150098").querySelector<HTMLElement>(".spro-prj-ic")!;
  checar(
    "etapa ligada (so eu) sem atraso: sem ponto",
    !exp.hasAttribute("data-atraso") && exp.getAttribute("aria-label") === "Em 1 projeto",
  );

  secao("caixa: linha sigilosa marca os vinculos");
  await tique(30);
  const ap = await c.repos.unidade.obterProjeto(c.apuracao.id);
  checar(
    "o processo do projeto passa a sigiloso (o numero fica neste computador)",
    ap?.processo?.sigiloso === true && ap.processo.protocolo === SIGILOSO,
  );

  secao("caixa: sem duplicar a cada mutacao, nem no clone do legado");
  await caixa.atualizar();
  await caixa.atualizar();
  linha(c.doc, "112825").querySelectorAll("td")[1]!.append(c.doc.createElement("span"));
  await tique(30);
  checar("uma vez por linha", icones(linha(c.doc, "148265")) === 1 && icones(c.doc) === 3, icones(c.doc));
  checar(
    "o sigiloso da tela: marcar uma vez por carga em cada escopo (mesmo com releituras e mutacoes)",
    [...sigilo].sort().join() === `eu:${SIGILOSO},unidade:${SIGILOSO}`,
    sigilo,
  );
  // O legado redesenha a célula dos ícones (o ícone some): o observador o põe de volta, uma vez.
  linha(c.doc, "148265").querySelector(".spro-prj-ic")?.remove();
  await tique(30);
  checar("celula redesenhada: o icone volta uma vez", icones(linha(c.doc, "148265")) === 1);
  const tabela = c.doc.createElement("table");
  const corpo = c.doc.createElement("tbody");
  const clone = linha(c.doc, "148265").cloneNode(true) as HTMLElement;
  corpo.append(clone);
  tabela.append(corpo);
  c.doc.querySelector("#frmProcedimentoControlar")!.append(tabela);
  await tique(30);
  checar("o clone leva o icone, sem ganhar outro", icones(clone) === 1 && icones(c.doc) === 4);
  clone.querySelector<HTMLElement>(".spro-prj-ic")!.click();
  checar(
    "clique no clone abre o balao com os dados da linha",
    abertos.length === 1 && abertos[0]?.p.protocolo === CAU && abertos[0].p.idProcedimento === "148265" && !abertos[0].p.sigiloso,
    abertos[0]?.p,
  );
  checar("a especificacao da linha vai junto (nome padrao da etapa)", (abertos[0]?.p.especificacao ?? "").startsWith("CAU"));

  secao("caixa: desligar o processo tira o icone");
  await c.repos.unidade.editarProjeto(c.revisao.id, { processo: undefined });
  await tique(30);
  checar("sem vinculo: o icone sai", icones(linha(c.doc, "148265")) === 0);
  caixa.parar();
  await c.repos.unidade.editarProjeto(c.revisao.id, { processo: { protocolo: CAU, idProcedimento: "148265" } });
  await tique(30);
  checar("parado: nao repinta", icones(linha(c.doc, "148265")) === 0);
}

async function verificarSemLaco(): Promise<void> {
  secao("caixa: o proprio icone nao redispara trabalho (sem laco de mutacao)");
  const l = await cenario();
  const leituras = contarLeituras(l.repos);
  // Cada pintura pergunta o dia uma vez: o espião conta as pinturas.
  let pinturas = 0;
  const hoje = () => {
    pinturas++;
    return HOJE;
  };
  const caixa = instalarIconesCaixa({ doc: l.doc, repos: l.repos, hoje, temaEscuro: false, atraso: 1, abrir: () => undefined });
  await caixa.atualizar();
  // A marca do sigiloso grava uma vez (e a gravação relê e repinta uma vez); depois disso, nada.
  await tique(40);
  checar("a carga: duas pinturas (a primeira e a da marca do sigiloso), nada mais", pinturas === 2, pinturas);
  const base = leituras.n;
  const basePinturas = pinturas;
  await tique(60);
  checar(
    "parado sozinho: nenhuma leitura nem pintura nova (o icone inserido nao redispara)",
    leituras.n === base && pinturas === basePinturas,
    { leituras: leituras.n - base, pinturas: pinturas - basePinturas },
  );
  linha(l.doc, "112825").querySelectorAll("td")[1]!.append(l.doc.createElement("span"));
  linha(l.doc, "148265").querySelector(".spro-prj-ic")?.remove();
  await tique(30);
  checar(
    "mudanca do SEI na tela: uma pintura (o icone volta) sem reler o storage, e o icone recolocado nao pede outra",
    leituras.n === base && pinturas === basePinturas + 1 && icones(linha(l.doc, "148265")) === 1,
    { leituras: leituras.n - base, pinturas: pinturas - basePinturas, icones: icones(linha(l.doc, "148265")) },
  );

  secao("caixa: paginacao do legado com centenas de linhas");
  const corpo = linha(l.doc, "148265").parentElement!;
  const modelo = linha(l.doc, "148265").cloneNode(true) as HTMLElement;
  modelo.querySelector(".spro-prj-ic")?.remove();
  const novas: HTMLElement[] = [];
  for (let i = 0; i < 400; i++) {
    const tr = modelo.cloneNode(true) as HTMLElement;
    tr.id = `P9${String(i).padStart(5, "0")}`;
    novas.push(tr);
  }
  const t0 = performance.now();
  corpo.append(...novas);
  await tique(5);
  for (let i = 0; i < 100 && !novas.every((tr) => icones(tr) === 1); i++) await tique(5);
  const ms = Math.round(performance.now() - t0);
  checar(
    `400 linhas de uma vez: um icone em cada, sem reler o storage (${ms} ms no linkedom)`,
    novas.every((tr) => icones(tr) === 1) && leituras.n === base,
    { semIcone: novas.filter((tr) => icones(tr) !== 1).length, leituras: leituras.n - base },
  );
  checar("numa pintura so (e menos de 3 s no linkedom)", pinturas === basePinturas + 2 && ms < 3000, {
    pinturas: pinturas - basePinturas,
    ms,
  });
  await tique(40);
  checar("e para de novo", leituras.n === base && pinturas === basePinturas + 2);
  caixa.parar();
}

async function verificarSigiloDaLinha(): Promise<void> {
  secao("caixa: todo processo sigiloso visto marca, mesmo sem vinculo (o numero do historico)");
  const s = await cenario();
  // O SEI passa a mostrar o ofício como sigiloso; o número dele só ficou num registro do histórico da unidade.
  linha(s.doc, "112825").querySelector("input[type=checkbox]")!.setAttribute("aria-label", "Sigiloso / Tipo Ofício");
  const trocou = await s.repos.unidade.criarProjeto({ nome: "Trocou de processo", processo: { protocolo: OFICIO } });
  await s.repos.unidade.editarProjeto(trocou.id, { processo: { protocolo: "50300.000666/2026-06" } });
  const lotes: string[] = [];
  const chamadas = espiarSigilo(s.repos, lotes);
  const caixa = instalarIconesCaixa({ doc: s.doc, repos: s.repos, hoje: () => HOJE, temaEscuro: false, atraso: 1, abrir: () => undefined });
  await caixa.atualizar();
  await tique(40);
  await caixa.atualizar();
  linha(s.doc, "160259").querySelectorAll("td")[1]!.append(s.doc.createElement("span"));
  await tique(40);
  checar(
    "os dois sigilosos da tela, nos dois escopos, uma vez cada",
    [...chamadas].sort().join() === [`eu:${OFICIO}`, `eu:${SIGILOSO}`, `unidade:${OFICIO}`, `unidade:${SIGILOSO}`].sort().join(),
    chamadas,
  );
  const lote = [OFICIO, SIGILOSO].sort().join(",");
  checar(
    "os sigilosos da mesma pintura num pedido so por escopo (uma leitura do escopo para todos)",
    [...lotes].sort().join("|") === `eu:${lote}|unidade:${lote}`,
    lotes,
  );
  const chave = `${prefixoMemoriaSigilo(HOST, LOGIN)}p/${chaveProtocolo(OFICIO)}`;
  checar("o numero que so estava no historico fica na memoria do sigilo (local)", (await s.area.obter(chave))[chave] === "local");
  checar("sem vinculo: sem icone", icones(linha(s.doc, "112825")) === 0 && icones(s.doc) === 3);
  caixa.parar();

  secao("caixa: memoria do sigilo ilegivel nao derruba a caixa");
  const f = await cenario();
  for (const r of Object.values(f.repos))
    r.marcarSigilosos = async () => {
      throw new ErroMemoriaSigilo(new Error("falha simulada"));
    };
  const avisos: unknown[] = [];
  const warn = console.warn;
  console.warn = (...a: unknown[]) => void avisos.push(a);
  const cf = instalarIconesCaixa({ doc: f.doc, repos: f.repos, hoje: () => HOJE, temaEscuro: false, atraso: 1, abrir: () => undefined });
  const erro = await lanca(() => cf.atualizar());
  await tique(30);
  console.warn = warn;
  checar("os icones aparecem do mesmo jeito e o erro so vai ao console", erro === null && icones(f.doc) === 3 && avisos.length >= 1, {
    erro,
    avisos: avisos.length,
  });
  cf.parar();
}

async function verificarBalao(): Promise<void> {
  secao("caixa: balao do processo");
  const b = await cenario();
  const sync = areaMemoria();
  const consentimento = consentimentoNaArea({ area: sync, chavePreferencias: "projetos/consentimento", campo: "textoPadrao", chave: "k" });
  const painel: string[] = [];
  const ancora = linha(b.doc, "148265").querySelectorAll("td")[1]!.appendChild(b.doc.createElement("button"));
  // O linkedom não acompanha o foco: o espião anota quem recebeu `focus()`.
  const focados: Element[] = [];
  const proto = Object.getPrototypeOf(ancora) as { focus: () => void };
  const focoOriginal = proto.focus;
  proto.focus = function (this: Element) {
    focados.push(this);
  };
  const processo: ProcessoNaTela = {
    protocolo: CAU,
    idProcedimento: "148265",
    sigiloso: false,
    tipo: "Processo de contratação",
    especificacao: "CAU contrato",
  };
  const deps = (o: Partial<DepsBalaoProcesso> = {}): DepsBalaoProcesso => ({
    modo: "caixa",
    repos: b.repos,
    hoje: () => HOJE,
    sigla: "TESTE",
    temaEscuro: false,
    cssBase: "",
    consentimento,
    documentos: () => [],
    abrirNoPainel: (id, etapa) => void painel.push(`${id}:${etapa ?? "-"}`),
    ...o,
  });
  const abrir = () => abrirBalaoProcesso(ancora, processo, deps());
  let balao = await abrir();
  const r = balao.raiz;
  const texto = (sel: string) => (r.querySelector(sel)?.textContent ?? "").trim();
  checar("Shadow DOM com o titulo e o numero", texto(".pb-tit b") === "Em 1 projeto" && texto(".pb-tit small") === CAU);
  checar("o projeto como texto (nome hostil nao vira HTML)", texto(".pb-proj span").startsWith(HOSTIL) && !r.querySelector("img"));
  const etapas = [...r.querySelectorAll(".pb-etapa")];
  checar(
    "as etapas abertas com o prazo; a atrasada em vermelho",
    etapas.length === 2 &&
      (etapas[0]?.textContent ?? "").includes("venceu 01/10") &&
      etapas[0]?.classList.contains("pb-atrasada") === true &&
      (etapas[1]?.textContent ?? "").includes("começa 16/10"),
    etapas.map((e) => e.textContent),
  );
  checar("role dialog com rotulo", r.querySelector("[role='dialog']")?.getAttribute("aria-label") === `Projetos do processo ${CAU}`);
  checar("o foco vai para o primeiro controle do balao (o Fechar)", focados.at(-1) === botao(r, "Fechar"), focados.at(-1)?.outerHTML);
  checar("a ancora diz que o balao esta aberto", ancora.getAttribute("aria-expanded") === "true");
  botao(r, "Abrir no painel")!.click();
  checar(
    "Abrir no painel: o projeto e a etapa mais urgente; o balao fecha",
    painel.join() === `${b.revisao.id}:${b.atrasada.id}` && !balaoAberto() && ancora.getAttribute("aria-expanded") === "false",
  );

  secao("caixa: adicionar a outro projeto (nova etapa)");
  balao = await abrir();
  botao(balao.raiz, "Adicionar a outro projeto")!.click();
  const f = () => balao.raiz.querySelector(".pb-form") as HTMLElement;
  const sel = f().querySelector("select[name='projeto']") as HTMLSelectElement;
  checar("projeto sugerido: o primeiro ainda nao ligado", sel.value === `eu:${b.pessoal.id}`, sel.value);
  checar("nome padrao da etapa: a especificacao", (f().querySelector("input[name='nome']") as HTMLInputElement).value === "CAU contrato");
  checar(
    "inicio hoje e 10 dias uteis",
    (f().querySelector("input[name='inicio']") as HTMLInputElement).value === HOJE &&
      (f().querySelector("input[name='duracao']") as HTMLInputElement).value === "10",
  );
  const dur = f().querySelector("input[name='duracao']") as HTMLInputElement;
  dur.value = "0";
  botao(f(), "Adicionar")!.click();
  await tique(20);
  checar(
    "duracao 0: a mensagem, nada gravado",
    (f().querySelector(".pb-erro")?.textContent ?? "").includes("1 a 2600") && (await b.repos.eu.dados()).etapas.length === 1,
  );
  dur.value = "3";
  botao(f(), "Adicionar")!.click();
  await tique(40);
  const novas = (await b.repos.eu.dados()).etapas.filter((e) => e.nome === "CAU contrato");
  checar(
    "nova etapa em 'So eu' com o processo, hoje + 3 dias uteis",
    novas.length === 1 && novas[0]?.processo?.protocolo === CAU && novas[0].inicio === HOJE && novas[0].fim === "2026-10-08",
    novas[0],
  );
  checar("'So eu' nao pede o Entendi", (await consentimento.estado()) === "nao-perguntado");
  checar(
    "o balao se refaz: 2 projetos e a frase do que foi feito",
    (balao.raiz.querySelector(".pb-tit b")?.textContent ?? "") === "Em 2 projetos" &&
      (balao.raiz.querySelector(".pb-ok")?.textContent ?? "").includes("adicionada a “Plano pessoal”"),
  );
  checar("depois de refazer, o foco fica no balao", focados.at(-1) === botao(balao.raiz, "Fechar"));

  secao("caixa: Toda a unidade pede o Entendi no proprio balao (o consentimento da P4)");
  botao(balao.raiz, "Adicionar a outro projeto")!.click();
  escolher(f().querySelector("select[name='projeto']") as HTMLSelectElement, `unidade:${b.apuracao.id}`);
  (f().querySelector("input[name='nome']") as HTMLInputElement).value = "Digitada à mão";
  botao(f(), "Adicionar")!.click();
  await tique(20);
  checar(
    "aviso do Texto Padrao da unidade, sem gravar ainda",
    !!balao.raiz.querySelector(".pb-pergunta") &&
      (balao.raiz.querySelector(".pb-pergunta")?.textContent ?? "").includes("Texto Padrão da TESTE") &&
      (await b.repos.unidade.dados()).etapas.length === 2,
  );
  checar("o foco vai para o Entendi", focados.at(-1) === botao(balao.raiz, "Entendi"));
  botao(balao.raiz, "Agora não")!.click();
  await tique(20);
  checar(
    "Agora nao: nada gravado e o formulario fica como estava (com o que foi digitado)",
    !balao.raiz.querySelector(".pb-pergunta") &&
      (f().querySelector("select[name='projeto']") as HTMLSelectElement).value === `unidade:${b.apuracao.id}` &&
      (f().querySelector("input[name='nome']") as HTMLInputElement).value === "Digitada à mão" &&
      (await b.repos.unidade.dados()).etapas.length === 2 &&
      (await consentimento.estado()) === "nao-perguntado",
  );
  checar(
    "e diz, sem alarme, que nada foi gravado (a frase do balao, sem o “Só eu” da mensagem da P4)",
    (f().querySelector(".pb-nota")?.textContent ?? "") === MENSAGEM_AGORA_NAO &&
      !(f().querySelector(".pb-erro")?.textContent ?? "") &&
      !(balao.raiz.textContent ?? "").includes(MENSAGEM_SEM_ENTENDI),
  );
  checar("o foco volta ao Adicionar", focados.at(-1) === botao(f(), "Adicionar"));
  botao(f(), "Adicionar")!.click();
  await tique(10);
  checar(
    "de novo: o aviso de novo (a mensagem anterior sai)",
    !!balao.raiz.querySelector(".pb-pergunta") &&
      !(f().querySelector(".pb-erro")?.textContent ?? "") &&
      !(f().querySelector(".pb-nota")?.textContent ?? ""),
  );
  botao(balao.raiz, "Entendi")!.click();
  await tique(40);
  checar(
    "Entendi: o consentimento fica e a etapa entra",
    (await consentimento.estado()) === "ligado" &&
      (await b.repos.unidade.dados()).etapas.some((e) => e.projeto === b.apuracao.id && e.nome === "Digitada à mão"),
  );

  secao("caixa: ligar a uma etapa e processo do projeto");
  botao(balao.raiz, "Adicionar a outro projeto")!.click();
  escolher(f().querySelector("select[name='projeto']") as HTMLSelectElement, `eu:${b.pessoal.id}`);
  botao(f(), "Ligar a uma etapa")!.click();
  const selE = f().querySelector("select[name='etapaLigar']") as HTMLSelectElement;
  checar(
    "so etapas abertas que ainda nao sao deste processo",
    [...selE.options].map((o) => o.value).join() === b.ligada.id && (selE.options[0]?.textContent ?? "").includes("já tem outro processo"),
    [...selE.options].map((o) => o.textContent),
  );
  botao(f(), "Adicionar")!.click();
  await tique(40);
  checar("ligada", (await b.repos.eu.obterEtapa(b.ligada.id))?.processo?.protocolo === CAU);
  botao(balao.raiz, "Adicionar a outro projeto")!.click();
  escolher(f().querySelector("select[name='projeto']") as HTMLSelectElement, `eu:${b.pessoal.id}`);
  botao(f(), "Processo do projeto")!.click();
  checar("explica o que muda", (f().querySelector(".pb-dica")?.textContent ?? "").includes("passa a ter este processo"));
  botao(f(), "Adicionar")!.click();
  await tique(40);
  checar("o projeto passa a ter o processo", (await b.repos.eu.obterProjeto(b.pessoal.id))?.processo?.protocolo === CAU);

  secao("caixa: numero de processo com letras (SEI-RJ)");
  const RJ = "SEI-150016/000123/2021";
  balao = await abrirBalaoProcesso(ancora, { protocolo: RJ, sigiloso: false, tipo: "Ofício" }, deps());
  checar(
    "sem projeto: 'Adicionar a um projeto'",
    !!botao(balao.raiz, "Adicionar a um projeto") && (balao.raiz.querySelector(".pb-tit b")?.textContent ?? "") === "Em 0 projetos",
  );
  botao(balao.raiz, "Adicionar a um projeto")!.click();
  escolher(f().querySelector("select[name='projeto']") as HTMLSelectElement, `eu:${b.pessoal.id}`);
  checar("sem especificacao: o nome padrao e o tipo", (f().querySelector("input[name='nome']") as HTMLInputElement).value === "Ofício");
  botao(f(), "Adicionar")!.click();
  await tique(40);
  checar(
    "a etapa entra com o numero de letras",
    (await b.repos.eu.dados()).etapas.some((e) => e.nome === "Ofício" && e.processo?.protocolo === RJ),
  );
  balao.fechar();

  secao("caixa: processo sigiloso e Esc");
  const sig: ProcessoNaTela = { protocolo: SIGILOSO, idProcedimento: "157584", sigiloso: true, tipo: "Expediente" };
  balao = await abrirBalaoProcesso(ancora, sig, deps({ temaEscuro: true, abrirNoPainel: () => undefined }));
  botao(balao.raiz, "Adicionar a outro projeto")!.click();
  checar(
    "sigiloso: sem nome sugerido (o nome vai ao Texto Padrao)",
    (f().querySelector("input[name='nome']") as HTMLInputElement).value === "",
  );
  botao(f(), "Adicionar")!.click();
  await tique(20);
  checar("sem nome: a mensagem, nada gravado", (f().querySelector(".pb-erro")?.textContent ?? "").includes("nome da etapa"));
  checar("o balao segue o tema do SEI", (b.doc.querySelector(".spro-prj-balao") as HTMLElement).getAttribute("data-tema") === "escuro");
  const Ev = (b.doc.defaultView as unknown as { Event: typeof Event }).Event;
  const esc = new Ev("keydown", { bubbles: true });
  Object.defineProperty(esc, "key", { value: "Escape" });
  b.doc.dispatchEvent(esc);
  checar("Esc fecha e o foco volta ao icone", !balaoAberto() && !b.doc.querySelector(".spro-prj-balao") && focados.at(-1) === ancora);
  proto.focus = focoOriginal;
  const deNovo = await abrir();
  disparar(deNovo.raiz.querySelector(".pb") as HTMLElement, "pointerdown");
  checar("clique dentro nao fecha", balaoAberto() === deNovo);
  disparar(ancora, "pointerdown");
  checar("apertar a propria ancora nao fecha (o clique dela alterna)", balaoAberto() === deNovo);
  disparar(b.doc.body, "pointerdown");
  checar("clique fora fecha", !balaoAberto() && !b.doc.querySelector(".spro-prj-balao"));
  const outro = await abrir();
  const terceiro = await abrir();
  checar("um aberto por vez", balaoAberto() === terceiro && b.doc.querySelectorAll(".spro-prj-balao").length === 1 && outro !== terceiro);
  terceiro.fechar();
}

async function verificarIconeAlterna(): Promise<void> {
  secao("caixa: o icone abre o balao e o mesmo icone fecha");
  const t = await cenario();
  const consentimento = consentimentoNaArea({
    area: areaMemoria(),
    chavePreferencias: "projetos/consentimento",
    campo: "textoPadrao",
    chave: "k",
  });
  const caixa = instalarIconesCaixa({
    doc: t.doc,
    repos: t.repos,
    hoje: () => HOJE,
    temaEscuro: false,
    atraso: 1,
    abrir: (ancora, p) =>
      void abrirBalaoProcesso(ancora, p, {
        modo: "caixa",
        repos: t.repos,
        hoje: () => HOJE,
        sigla: "TESTE",
        temaEscuro: false,
        cssBase: "",
        consentimento,
        documentos: () => [],
        abrirNoPainel: () => undefined,
      }),
  });
  await caixa.atualizar();
  const ic = linha(t.doc, "148265").querySelector<HTMLElement>(".spro-prj-ic")!;
  ic.click();
  await tique(30);
  checar("abre", balaoAberto() !== null && ic.getAttribute("aria-expanded") === "true");
  // Como no navegador: o pointerdown no ícone, o foco que sai do balão para ele e o clique.
  const Ev = (t.doc.defaultView as unknown as { Event: typeof Event }).Event;
  disparar(ic, "pointerdown");
  const focusout = new Ev("focusout", { bubbles: true });
  Object.defineProperty(focusout, "relatedTarget", { value: ic });
  balaoAberto()?.raiz.querySelector("button")?.dispatchEvent(focusout);
  checar("o foco que sai do balao para o proprio icone nao fecha", balaoAberto()?.ancora === ic);
  ic.click();
  await tique(30);
  checar("o mesmo icone fecha (e nao reabre)", balaoAberto() === null && ic.getAttribute("aria-expanded") === "false");
  caixa.parar();
}

async function verificarGravacoes(): Promise<void> {
  secao("caixa: o que o balao grava passa pelas regras do repositorio");
  const g = await cenario();
  const invalido = await lanca(() =>
    adicionarAoProjeto(
      g.repos,
      { vis: "eu", projeto: g.pessoal.id, como: "etapa", processo: { protocolo: "<b>1234 5678</b>" }, nome: "X", inicio: HOJE, duracao: 1 },
      HOJE,
    ),
  );
  checar(
    "numero de processo fora da forma: a mensagem, nada gravado",
    invalido instanceof ErroValidacao && (await g.repos.eu.dados()).etapas.length === 1,
    invalido,
  );
  const dataRuim = await lanca(() =>
    adicionarAoProjeto(
      g.repos,
      { vis: "eu", projeto: g.pessoal.id, como: "etapa", processo: { protocolo: CAU }, nome: "X", inicio: "2026-02-30", duracao: 1 },
      HOJE,
    ),
  );
  checar("inicio que nao existe: a mensagem", dataRuim instanceof ErroValidacao && (await g.repos.eu.dados()).etapas.length === 1);
  const docRuim = await lanca(() => concluirComDocumento(g.repos, "eu", g.ligada.id, { numero: "12a" }, HOJE));
  checar(
    "concluir com documento fora da regra (so digitos, 1 a 20): a mensagem, nada gravado",
    docRuim instanceof ErroValidacao && !(await g.repos.eu.obterEtapa(g.ligada.id))?.concluidaEm,
    docRuim,
  );
  const dataConcluir = await lanca(() => concluirComDocumento(g.repos, "eu", g.ligada.id, undefined, "2026-13-40"));
  checar(
    "data da conclusao que nao existe: a mensagem fala da data",
    dataConcluir instanceof ErroValidacao && String((dataConcluir as ErroValidacao).mensagens).includes("data"),
  );
  const ok = await concluirComDocumento(g.repos, "eu", g.ligada.id, { numero: "0104500", titulo: "Parecer 88" }, "2026-10-05");
  const concluida = await g.repos.eu.obterEtapa(g.ligada.id);
  checar(
    "concluida com o documento",
    ok.includes("concluída em 05/10/2026") && concluida?.concluidaEm === "2026-10-05" && concluida.documento?.numero === "0104500",
    { ok, concluida },
  );
  const deNovo = await lanca(() => concluirComDocumento(g.repos, "eu", g.ligada.id, undefined, HOJE));
  checar(
    "ja concluida (por outra tela): nao conclui de novo, a data fica",
    deNovo instanceof ErroValidacao && (await g.repos.eu.obterEtapa(g.ligada.id))?.concluidaEm === "2026-10-05",
  );
}

export async function verificarCaixa(): Promise<void> {
  await verificarIcones();
  await verificarSemLaco();
  await verificarSigiloDaLinha();
  await verificarBalao();
  await verificarIconeAlterna();
  await verificarGravacoes();
}
