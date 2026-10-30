/**
 * O content script do P5 por tela (telas reais do SEI 4.1 nas fixtures do
 * núcleo): qual tela é, as pílulas que param e contam para o lateral, os
 * argumentos do RPC que vêm de dado compartilhado, o "Abrir no painel" do lado
 * da aba (rolar até o painel, ir ao Controle de Processos pelo menu, pedir o
 * lateral), o lado da aba da ponte com o lateral (chave com a unidade, a mesma
 * a cada recarga: a carência do lateral termina sem remontar) e a sincronia nas
 * telas de topo que não são o Controle de Processos (só envia o que mudou aqui).
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { PonteLateral, type Remetente } from "@comum/ponte/lateral";
import { parDePortas } from "@comum/ponte/parDePortas";
import { criarRpc, type PortaRpc, type Rpc } from "@comum/ponte/rpc";
import { definirConsentimento } from "@comum/sincronia/consentimento";
import type { StatusSync } from "@comum/sincronia/motor";
import { gerarConteudoTexto } from "@comum/sincronia/textoPadraoCodec";
import { definirEmissorDeAviso } from "@comum/ui/aviso";
import { linkDoMenu } from "@nucleo/links/links";
import type { Pagina } from "@nucleo/sessao/http";
import { paginaDe } from "@nucleo/sessao/pagina";
import { MontagemLateral } from "../../src/app/lateral/montagem";
import { CHAVE_LATERAL } from "../../src/modelo/constantes";
import { escoposDaUnidade } from "../../src/modelo/escopo";
import { armazemDoTexto, armazemNaTela } from "../../src/pagina/armazem";
import { contextoProjetos } from "../../src/pagina/contexto";
import { tratadoresProjetos } from "../../src/pagina/executor";
import { atenderPedidoDoLateral, focarNoPainelDaAba, focoDaAba, irAoPainel, type PainelDaAba, pedirLateral } from "../../src/pagina/foco";
import { ligarLateralDaAba } from "../../src/pagina/lateral";
import { ligarAlertas, montarPainelProjetos } from "../../src/pagina/painel";
import { ligarSincronia } from "../../src/pagina/sincronia";
import { qualTela } from "../../src/pagina/tela";
import { CHAVE_FOCO, type ContextoProjetos, chaveDaAba, lerPedidoDeFoco } from "../../src/ponte/tipos";
import { RepositorioProjetos } from "../../src/repositorio";
import { CHAVE_CONSENTIMENTO, chaveDoConsentimento } from "../../src/sincronia/consentimento";
import { chaveStatusTexto } from "../../src/sincronia/textoPadrao";
import { HOJE } from "../fabrica";
import { checar, instalarDom, lanca, secao, telaSei, tique } from "./util";
import { doColega, envelopeDoTexto, textoNoSei } from "./verificar-sincronia-pagina";

const CTX: ContextoProjetos = {
  host: "treinamento.sei.sp.gov.br",
  login: "pedro.soares",
  nome: "Pedro Soares",
  unidade: { id: "110000001", sigla: "TESTE", nome: "Teste" },
  versao: "4.1.5",
  temaEscuro: false,
  atividades: false,
};
const PASTA_APP = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "src", "app");

type Chamador = { chamar(op: string, args?: unknown): Promise<unknown> };

/** A janela da página ganha foco (o evento do próprio linkedom: o `Event` do Node não serve a ele). */
function focar(doc: Document): void {
  const janela = doc.defaultView as unknown as { Event: typeof Event; dispatchEvent(e: Event): boolean };
  janela.dispatchEvent(new janela.Event("focus"));
}

/** O app do painel embutido (falso): anota cada pedido da aba. */
function appQueAnota(pedidos: Array<[string, unknown]>): Chamador {
  return {
    chamar: async (op, args) => {
      pedidos.push([op, args]);
      return true;
    },
  };
}

export async function verificarPaginaIntegracao(): Promise<void> {
  secao("pagina P5: qual tela");
  checar("Controle de Processos", qualTela(telaSei("sei41/caixa.html").doc) === "caixa");
  checar("arvore do processo (frame)", qualTela(telaSei("sei41/arvore.html").doc) === "arvore");
  checar("arvore com as pastas abertas (frame)", qualTela(telaSei("sei41/arvore_completa.html").doc) === "arvore");
  checar("tela do processo (topo, sem a arvore): nenhuma das duas", qualTela(telaSei("sei41/trabalhar.html").doc) === null);
  checar("documento visualizado (frame): nenhuma das duas", qualTela(telaSei("sei41/processo_visualizar.html").doc) === null);

  secao("pagina P5: pilulas param e contam para o lateral");
  const { doc: docA } = telaSei("sei41/caixa.html");
  const mA = montarPainelProjetos(docA, { urlApp: "x", recolhido: false, ordem: null, aoRecolher: () => undefined })!;
  const area = areaMemoria();
  const esc = escoposDaUnidade("sei.x", "ana", "1");
  let relogio = 1_000;
  const carimbo = () => ({ agora: ++relogio, dispositivo: "t", por: "ana", nome: "Ana Lima" });
  const un = new RepositorioProjetos(area, esc.unidade, carimbo);
  const eu = new RepositorioProjetos(area, esc.eu, carimbo);
  const p = await un.criarProjeto({ nome: "Da unidade" });
  await un.criarEtapa({ projeto: p.id, nome: "Atrasada", inicio: "2026-09-28", fim: "2026-10-01" });
  const contagens: number[] = [];
  const alertas = ligarAlertas(mA, {
    temaEscuro: false,
    repos: { unidade: un, eu },
    rpc: () => null,
    hoje: () => HOJE,
    atraso: 1,
    aoContar: (n) => void contagens.push(n),
  });
  await tique(30);
  checar("conta as atrasadas para o lateral", contagens.at(-1) === 1, contagens);
  alertas.parar();
  const titulo = mA.painel.querySelector(".spro-prj-titulo") as HTMLElement;
  const antes = titulo.textContent;
  await un.criarEtapa({ projeto: p.id, nome: "Outra", inicio: "2026-09-21", fim: "2026-09-25" });
  await tique(30);
  checar("parado: nao repinta nem conta", titulo.textContent === antes && contagens.length === 1, contagens);
  // O painel sai com uma pintura em curso (a leitura dos repositórios demora) e os ouvintes saem com ele.
  const base = areaMemoria();
  let ouvintes = 0;
  let lenta = false;
  const areaLenta: Area = {
    ...base,
    obter: async (c) => {
      if (lenta) await tique(10);
      return base.obter(c);
    },
    aoMudar: (cb) => {
      ouvintes++;
      const deixar = base.aoMudar(cb);
      return () => {
        ouvintes--;
        deixar();
      };
    },
  };
  const unL = new RepositorioProjetos(areaLenta, esc.unidade, carimbo);
  const euL = new RepositorioProjetos(areaLenta, esc.eu, carimbo);
  const pL = await unL.criarProjeto({ nome: "Lenta" });
  await unL.criarEtapa({ projeto: pL.id, nome: "Atrasada", inicio: "2026-09-28", fim: "2026-10-01" });
  const opcoesL = (aoContar: (n: number) => void) => ({
    temaEscuro: false,
    repos: { unidade: unL, eu: euL },
    rpc: () => null,
    hoje: () => HOJE,
    atraso: 1,
    aoContar,
  });
  const montarL = () =>
    montarPainelProjetos(telaSei("sei41/caixa.html").doc, { urlApp: "x", recolhido: false, ordem: null, aoRecolher: () => undefined })!;
  const mL = montarL();
  const mControle = montarL();
  const antesDeLigar = ouvintes;
  const contagensL: number[] = [];
  const contagensControle: number[] = [];
  lenta = true;
  const alertasL = ligarAlertas(
    mL,
    opcoesL((n) => void contagensL.push(n)),
  );
  const ligados = ouvintes - antesDeLigar;
  const controle = ligarAlertas(
    mControle,
    opcoesL((n) => void contagensControle.push(n)),
  );
  await tique(5);
  alertasL.parar();
  const depoisDeParar = ouvintes;
  for (let i = 0; i < 200 && contagensControle.length === 0; i++) await tique(10);
  await tique(20);
  checar(
    "parado no meio de uma pintura: a leitura volta (o outro painel contou) e ele nao pinta nem conta",
    contagensControle.at(-1) === 1 && contagensL.length === 0 && !mL.painel.querySelector(".spro-prj-alertas"),
    { contagensL, contagensControle },
  );
  controle.parar();
  checar(
    "e os ouvintes dos repositorios saem com o painel",
    ligados === 2 && depoisDeParar === antesDeLigar + 2 && ouvintes === antesDeLigar,
    { ligados, depoisDeParar, ouvintes, antesDeLigar },
  );
  const semTitulo = ligarAlertas(
    { painel: docA.createElement("section"), corpo: docA.createElement("div") },
    { temaEscuro: false, repos: { unidade: un, eu }, rpc: () => null, hoje: () => HOJE },
  );
  checar("painel sem titulo: nada liga e o parar nao lanca", (await lanca(() => semTitulo.parar())) === null);

  secao("pagina P5: argumentos do RPC vindos de dado compartilhado");
  const { doc: docE } = telaSei("sei41/caixa.html");
  const form = docE.querySelector("#frmProtocoloPesquisaRapida") as HTMLFormElement;
  const campo = docE.querySelector("#txtPesquisaRapida") as HTMLInputElement;
  const enviados: string[] = [];
  (form as unknown as { requestSubmit: () => void }).requestSubmit = () => void enviados.push(campo.value);
  const focos: string[] = [];
  const trat = tratadoresProjetos({
    doc: docE,
    ctx: CTX,
    iframe: null,
    usuarios: async () => [],
    conferir: async () => null,
    focarNoPainel: async (id, etapa): Promise<"painel"> => {
      focos.push(`${id}:${etapa ?? "-"}`);
      return "painel";
    },
  });
  const invalido = async (f: () => unknown) => (await lanca(f))?.codigo === "ARGUMENTO_INVALIDO";
  checar(
    "abrir processo recusa protocolo que nao e numero, id torto e tipo errado",
    (await invalido(() => trat.abrirProcesso?.({ protocolo: '<img src=x onerror="alert(1)">' }))) &&
      (await invalido(() => trat.abrirProcesso?.({ protocolo: "x".repeat(41) }))) &&
      (await invalido(() => trat.abrirProcesso?.({ id: "77; drop", protocolo: "50300.001234/2026-11" }))) &&
      (await invalido(() => trat.abrirProcesso?.({ protocolo: { toString: () => "1" } }))) &&
      (await invalido(() => trat.abrirProcesso?.({ protocolo: "" }))) &&
      enviados.length === 0,
  );
  checar(
    "abrir processo (ruling P4): espaco no meio, protocolo que nao e texto, id com mais de 20 digitos ou que nao e texto/numero",
    (await invalido(() => trat.abrirProcesso?.({ protocolo: "50300 001234/2026-11" }))) &&
      (await invalido(() => trat.abrirProcesso?.({ protocolo: 50300001234 }))) &&
      (await invalido(() => trat.abrirProcesso?.({ id: "1".repeat(21), protocolo: "50300.001234/2026-11" }))) &&
      (await invalido(() => trat.abrirProcesso?.({ id: { toString: () => "1" }, protocolo: "50300.001234/2026-11" }))) &&
      (await invalido(() => trat.abrirProcesso?.({ id: -5, protocolo: "50300.001234/2026-11" }))) &&
      (await invalido(() => trat.abrirProcesso?.(null))) &&
      enviados.length === 0,
  );
  const passa = async (f: () => unknown, esperado: string) => (await lanca(f)) === null && enviados.at(-1) === esperado;
  checar(
    "numero do SEI (com ponto, hifen e barra) passa",
    await passa(() => trat.abrirProcesso?.({ id: "", protocolo: "99906.713-630.000032/2025-82" }), "99906.713-630.000032/2025-82"),
    enviados,
  );
  checar(
    "numero com letras (forma do vinculo do P4, SEI-RJ) e id so de digitos passam",
    await passa(() => trat.abrirProcesso?.({ id: "999999999", protocolo: "SEI-150016/000123/2021" }), "SEI-150016/000123/2021"),
    enviados,
  );
  checar(
    "espaco nas pontas sai; id numerico passa",
    await passa(() => trat.abrirProcesso?.({ id: 999999999, protocolo: "  50300.001234/2026-11  " }), "50300.001234/2026-11"),
    enviados,
  );
  checar(
    "abrir documento: no maximo 20 digitos",
    (await invalido(() => trat.abrirDocumento?.({ numero: "1".repeat(21) }))) &&
      (await invalido(() => trat.abrirDocumento?.({ numero: { valueOf: () => 1 } }))) &&
      (await invalido(() => trat.abrirDocumento?.({ numero: "SEI" }))),
  );
  checar(
    "abrir documento com numero (nao texto): so inteiro seguro e nao negativo (1e21 viraria os digitos de '1e+21')",
    (await invalido(() => trat.abrirDocumento?.({ numero: 1e21 }))) &&
      (await invalido(() => trat.abrirDocumento?.({ numero: -5 }))) &&
      (await invalido(() => trat.abrirDocumento?.({ numero: 12.5 }))) &&
      (await passa(() => trat.abrirDocumento?.({ numero: 1240002 }), "1240002")),
    enviados,
  );
  checar(
    "abrir documento: o numero SEI (so os digitos) e 20 digitos passam",
    (await passa(() => trat.abrirDocumento?.({ numero: "SEI 1240001" }), "1240001")) &&
      (await passa(() => trat.abrirDocumento?.({ numero: "9".repeat(20) }), "9".repeat(20))),
    enviados,
  );
  checar(
    "focarNoPainel: id valido passa (etapa torta vira nenhuma); invalido recusa",
    (await trat.focarNoPainel?.({ id: "p1", etapa: "e1" })) === "painel" &&
      (await trat.focarNoPainel?.({ id: "p2", etapa: 9 })) === "painel" &&
      (await trat.focarNoPainel?.({ id: "x".repeat(200) })) === "painel" &&
      focos.join() === `p1:e1,p2:-,${"x".repeat(200)}:-` &&
      (await invalido(() => trat.focarNoPainel?.({ id: "" }))) &&
      (await invalido(() => trat.focarNoPainel?.({ id: "x".repeat(201) }))) &&
      (await invalido(() => trat.focarNoPainel?.({ id: 7 }))),
    focos,
  );
  const semPainel = tratadoresProjetos({ doc: docE, ctx: CTX, iframe: null, usuarios: async () => [], conferir: async () => null });
  checar("sem o Abrir no painel ligado: erro claro", (await lanca(() => semPainel.focarNoPainel?.({ id: "p1" })))?.codigo === "SEM_PAINEL");

  secao("pagina P5: Abrir no painel do lado da aba");
  const { doc: docF } = telaSei("sei41/caixa.html");
  const mF = montarPainelProjetos(docF, { urlApp: "x", recolhido: true, ordem: null, aoRecolher: () => undefined })!;
  const pedidos: Array<[string, unknown]> = [];
  let pronto: Chamador | null = null;
  const painel: PainelDaAba = { painel: mF.painel, corpo: mF.corpo, rpc: () => pronto };
  checar("no Controle de Processos: rola ate o painel", focarNoPainelDaAba(painel, "p1", "e1", { espera: 5 }) === "painel");
  checar("o painel recolhido abre", !mF.corpo.hidden);
  await tique(20);
  pronto = appQueAnota(pedidos);
  await tique(30);
  checar("o app ligou depois: recebe o pedido uma vez", JSON.stringify(pedidos) === '[["focarProjeto",{"id":"p1","etapa":"e1"}]]', pedidos);
  pronto = null;
  pedidos.length = 0;
  focarNoPainelDaAba(painel, "p1", undefined, { espera: 5 });
  focarNoPainelDaAba(painel, "p3", undefined, { espera: 5 });
  await tique(20);
  pronto = appQueAnota(pedidos);
  await tique(30);
  checar(
    "um pedido novo substitui o que esperava o app (so o ultimo chega)",
    JSON.stringify(pedidos) === '[["focarProjeto",{"id":"p3"}]]',
    pedidos,
  );
  pedidos.length = 0;
  const areaF = areaMemoria();
  const chave = chaveDaAba(CTX);
  const { doc: docT, pagina: pT } = telaSei("sei41/trabalhar.html");
  const idas: string[] = [];
  const r = await irAoPainel(
    {
      area: areaF,
      chave,
      agora: 1_000,
      link: () => linkDoMenu(paginaDe(docT, pT.url), "procedimento_controlar"),
      ir: (u) => void idas.push(u),
    },
    "p1",
    "e2",
  );
  const guardado = (await areaF.obter(CHAVE_FOCO))[CHAVE_FOCO] as {
    alvo?: string;
    chave?: string;
    projeto?: string;
    etapa?: string;
    ate?: number;
  };
  checar(
    "na tela do processo: vai ao Controle de Processos pelo link do menu (assinado), com o pedido guardado",
    r === "navegou" &&
      idas.length === 1 &&
      /acao=procedimento_controlar/.test(idas[0] ?? "") &&
      /infra_hash=/.test(idas[0] ?? "") &&
      guardado.alvo === "painel" &&
      guardado.chave === chave &&
      guardado.projeto === "p1" &&
      guardado.etapa === "e2" &&
      guardado.ate === 61_000,
    { idas, guardado },
  );
  const areaG = areaMemoria();
  const semMenu = await lanca(() =>
    irAoPainel(
      {
        area: areaG,
        chave,
        agora: 1_000,
        link: () => {
          throw new Error("sem menu");
        },
        ir: () => undefined,
      },
      "p1",
    ),
  );
  checar(
    "sem menu na tela: erro claro e nada guardado",
    semMenu?.codigo === "SEM_MENU" && !(CHAVE_FOCO in (await areaG.obter(CHAVE_FOCO))),
  );
  checar("pedido de outra chave: ignorado", !(await atenderPedidoDoLateral(areaF, "outra|chave|u:2", 2_000, painel, { espera: 5 })));
  checar("pedido vencido: ignorado", !(await atenderPedidoDoLateral(areaF, chave, 70_000, painel, { espera: 5 })));
  pronto = appQueAnota(pedidos);
  checar(
    "no Controle de Processos, o pedido do lateral: atendido",
    await atenderPedidoDoLateral(areaF, chave, 2_000, painel, { espera: 5 }),
  );
  await tique(10);
  checar(
    "abre o projeto no painel e apaga o pedido",
    JSON.stringify(pedidos) === '[["focarProjeto",{"id":"p1","etapa":"e2"}]]' && !(CHAVE_FOCO in (await areaF.obter(CHAVE_FOCO))),
    pedidos,
  );
  checar("o mesmo pedido nao e atendido de novo", !(await atenderPedidoDoLateral(areaF, chave, 2_500, painel, { espera: 5 })));

  secao("pagina P5: Abrir no painel pedido pelo lateral, conforme a tela");
  pedidos.length = 0;
  const idasFoco: string[] = [];
  const areaFoco = areaMemoria();
  const foco = (o: { painel: Promise<PainelDaAba | null>; link?: () => string; area?: Area }) =>
    focoDaAba({
      painel: o.painel,
      area: o.area ?? areaFoco,
      chave,
      agora: () => 5_000,
      link: o.link ?? (() => linkDoMenu(paginaDe(docT, pT.url), "procedimento_controlar")),
      ir: (u) => void idasFoco.push(u),
    });
  checar(
    "no Controle de Processos com o painel: rola ate ele",
    (await foco({ painel: Promise.resolve(painel) })("p5").catch((e: unknown) => e)) === "painel",
  );
  await tique(10);
  checar(
    "e pede o projeto ao app do painel",
    JSON.stringify(pedidos) === '[["focarProjeto",{"id":"p5"}]]' && idasFoco.length === 0,
    pedidos,
  );
  // A visão por marcadores do Controle de Processos não recebe o painel (#tblMarcadores); ela vem de parâmetro da URL
  // que o link do menu não leva (reset=1): o menu abre a lista completa, onde o painel monta e atende o pedido.
  const { doc: docM, pagina: pM } = telaSei("sei41/caixa.html");
  docM.body.append(docM.createElement("table"));
  docM.body.lastElementChild?.setAttribute("id", "tblMarcadores");
  const semPainelNaVisao = montarPainelProjetos(docM, { urlApp: "x", recolhido: false, ordem: null, aoRecolher: () => undefined }) === null;
  const areaM = areaMemoria();
  const naVisao = await foco({
    painel: Promise.resolve(null),
    area: areaM,
    link: () => linkDoMenu(paginaDe(docM, pM.url), "procedimento_controlar"),
  })("p7", "e7").catch((e: unknown) => e);
  checar(
    "Controle de Processos na visao por marcadores (o painel nao entra): vai pela lista completa do menu e deixa o pedido",
    semPainelNaVisao &&
      naVisao === "navegou" &&
      idasFoco.length === 1 &&
      /acao=procedimento_controlar&reset=1/.test(idasFoco[0] ?? "") &&
      !/tipo_filtro|marcador/.test(idasFoco[0] ?? "") &&
      lerPedidoDeFoco((await areaM.obter(CHAVE_FOCO))[CHAVE_FOCO], "painel", chave, 5_000)?.etapa === "e7",
    { semPainelNaVisao, naVisao, idasFoco },
  );
  const areaFalhou = areaMemoria();
  const falhou = await lanca(() => foco({ painel: Promise.reject(new Error("storage indisponivel")), area: areaFalhou })("p5"));
  checar(
    "o painel falhou ao montar: erro com a mensagem propria, sem navegar e sem pedido guardado",
    falhou?.codigo === "SEM_PAINEL" &&
      falhou.message === "O painel de projetos não pôde ser aberto nesta página. Recarregue o Controle de Processos e tente de novo." &&
      idasFoco.length === 1 &&
      !(CHAVE_FOCO in (await areaFalhou.obter(CHAVE_FOCO))),
    falhou,
  );
  checar(
    "em outra tela de topo: vai pelo link do menu e deixa o pedido",
    (await foco({ painel: Promise.resolve(null) })("p6", "e6").catch((e: unknown) => e)) === "navegou" &&
      idasFoco.length === 2 &&
      lerPedidoDeFoco((await areaFoco.obter(CHAVE_FOCO))[CHAVE_FOCO], "painel", chave, 5_000)?.etapa === "e6",
    idasFoco,
  );

  secao("pagina P5: da arvore, pedir o lateral");
  const ordem: string[] = [];
  const areaL = areaMemoria();
  const gravarOriginal = areaL.gravar.bind(areaL);
  areaL.gravar = (itens) => {
    ordem.push("gravou");
    return gravarOriginal(itens);
  };
  await pedirLateral(
    {
      area: areaL,
      chave,
      agora: 1_000,
      abrir: async () => void ordem.push("abriu"),
      janela: () => void ordem.push("janela"),
    },
    "p9",
  );
  checar(
    "da arvore: pede o lateral ANTES de gravar (o gesto do clique) e deixa o pedido para ele",
    ordem.join() === "abriu,gravou" &&
      lerPedidoDeFoco((await areaL.obter(CHAVE_FOCO))[CHAVE_FOCO], "lateral", chave, 1_000)?.projeto === "p9",
    ordem,
  );
  ordem.length = 0;
  await pedirLateral(
    {
      area: areaMemoria(),
      chave,
      agora: 1_000,
      abrir: async () => {
        throw new Error("sem background");
      },
      janela: () => void ordem.push("janela"),
    },
    "p9",
  );
  checar("sem o background (Firefox): abre o painel numa janela", ordem.join() === "janela", ordem);
  ordem.length = 0;
  const lancouSincrono = await lanca(() =>
    pedirLateral(
      {
        area: areaMemoria(),
        chave,
        agora: 1_000,
        abrir: () => {
          throw new Error("Extension context invalidated.");
        },
        janela: () => void ordem.push("janela"),
      },
      "p9",
    ),
  );
  checar(
    "o pedido ao background que lanca na hora tambem cai na janela (sem rejeicao)",
    lancouSincrono === null && ordem.join() === "janela",
    {
      lancouSincrono,
      ordem,
    },
  );

  secao("pagina P5: lado da aba da ponte com o lateral");
  const areaP = areaMemoria();
  const olas: Array<{ chave?: string }> = [];
  const conexoes: PortaRpc[] = [];
  const { doc: docP } = telaSei("sei41/trabalhar.html");
  const lado = ligarLateralDaAba({
    doc: docP,
    ctx: CTX,
    area: areaP,
    intervalo: 60_000,
    conectar: () => {
      const [daAba, doApp] = parDePortas();
      conexoes.push(doApp);
      criarRpc(doApp, { ola: (e) => void olas.push(e as { chave?: string }) });
      return daAba;
    },
    tratadores: { contexto: () => CTX },
  });
  await tique(10);
  checar("sem o lateral aberto, nenhuma conexao", conexoes.length === 0);
  await areaP.gravar({ [CHAVE_LATERAL]: { id: "lat-1", quando: 1 } });
  await tique(10);
  checar(
    "o lateral anunciou: a aba conecta e se apresenta com host|login|u:<unidade>",
    conexoes.length === 1 && olas[0]?.chave === "treinamento.sei.sp.gov.br|pedro.soares|u:110000001",
    olas,
  );
  const ctxLido = await criarRpc(conexoes[0]!).chamar<ContextoProjetos>("contexto");
  checar("o lateral pede o contexto da aba", ctxLido.unidade?.id === "110000001");
  focar(docP);
  await tique(10);
  checar("a aba ganha foco: se apresenta de novo, com a mesma chave", olas.length === 2 && olas[1]?.chave === olas[0]?.chave, olas);
  lado.parar();
  await areaP.gravar({ [CHAVE_LATERAL]: { id: "lat-2", quando: 2 } });
  focar(docP);
  await tique(10);
  checar("parado: nao conecta mais nem se apresenta", conexoes.length === 1 && olas.length === 2, { conexoes: conexoes.length, olas });
  // A rede de segurança: com o anúncio no storage e a porta que não abre, tenta de novo a cada intervalo; parada, o
  // relógio sai (os relógios de 10 ms criados aqui são anotados; os que sobrarem a prova desliga, para não segurar o
  // processo).
  let tentativas = 0;
  const relogios = new Set<ReturnType<typeof setInterval>>();
  const { setInterval: criarRelogio, clearInterval: limparRelogio } = globalThis;
  globalThis.setInterval = ((f: () => void, ms?: number) => {
    const t = criarRelogio(f, ms);
    if (ms === 10) relogios.add(t);
    return t;
  }) as typeof setInterval;
  globalThis.clearInterval = ((t: ReturnType<typeof setInterval>) => {
    relogios.delete(t);
    limparRelogio(t);
  }) as typeof clearInterval;
  try {
    const comRede = ligarLateralDaAba({
      doc: docP,
      ctx: CTX,
      area: areaMemoria({ [CHAVE_LATERAL]: { id: "lat-3", quando: 3 } }),
      intervalo: 10,
      conectar: () => {
        tentativas++;
        throw new Error("Extension context invalidated.");
      },
      tratadores: {},
    });
    await tique(60);
    const tentadas = tentativas;
    const vivosAntes = relogios.size;
    comRede.parar();
    await tique(40);
    checar(
      "a rede de seguranca tenta conectar de novo (connect que lanca nao derruba a aba) e para com a pagina (sem relogio vivo)",
      tentadas >= 3 && tentativas === tentadas && vivosAntes === 1 && relogios.size === 0,
      { tentadas, depois: tentativas, vivosAntes, vivosDepois: relogios.size },
    );
  } finally {
    for (const t of relogios) limparRelogio(t);
    globalThis.setInterval = criarRelogio;
    globalThis.clearInterval = limparRelogio;
  }

  secao("pagina P5: todo pedido que o app faz a aba tem tratador no lado da aba");
  const ops = new Set<string>();
  const fontesApp = (readdirSync(PASTA_APP, { recursive: true }) as string[]).filter((f) => f.endsWith(".ts"));
  for (const f of fontesApp)
    for (const m of readFileSync(join(PASTA_APP, f), "utf8").matchAll(/\.chamar(?:<[^>("]*>)?\(\s*"([A-Za-z]+)"/g)) ops.add(m[1] ?? "");
  const faltam = [...ops].filter((op) => !(op in trat));
  const doLateral = [
    "contexto",
    "processosDaCaixa",
    "usuariosDaUnidade",
    "conferirDocumento",
    "abrirProcesso",
    "abrirDocumento",
    "focarNoPainel",
    "sincronizarAgora",
    "apagarDoSei",
    "importarAtividades",
  ];
  checar(
    "os pedidos do app (painel e lateral) e a lista da T5 estao todos nos tratadores da aba",
    ops.size >= 10 && faltam.length === 0 && doLateral.every((op) => ops.has(op) && op in trat),
    { ops: [...ops], faltam },
  );

  await pontaAPonta();
  await sincroniaNasOutrasTelas();
}

/**
 * A ponte real (`PonteLateral` + o `MontagemLateral` da T5 com um app falso que anota montar e desmontar) e o lado da
 * aba deste módulo (`ligarLateralDaAba` com os tratadores de verdade) sobre as telas reais do SEI: a mesma aba
 * navega da tela do processo para o Controle de Processos (a porta cai e a página nova conecta) e depois troca de
 * unidade.
 */
async function pontaAPonta(): Promise<void> {
  secao("pagina P5: ponta a ponta com o lateral (ponte real): a aba acompanha a navegacao do SEI");
  const extras = { temaEscuro: false, atividades: false };
  const { doc: docT, pagina: pT } = telaSei("sei41/trabalhar.html");
  const { doc: docC, pagina: pC } = telaSei("sei41/caixa.html");
  const ctxT = contextoProjetos(docT, extras, pT.url);
  const ctxC = contextoProjetos(docC, extras, pC.url);
  checar("as duas telas reais leem o mesmo SEI, usuario e unidade", !!ctxT && !!ctxC && chaveDaAba(ctxT) === chaveDaAba(ctxC), {
    t: ctxT && chaveDaAba(ctxT),
    c: ctxC && chaveDaAba(ctxC),
  });
  if (!ctxT || !ctxC) return;
  // O painel embutido da caixa (o `document` global ainda é o da caixa: o `h()` cria nele).
  const mC = montarPainelProjetos(docC, { urlApp: "x", recolhido: true, ordem: null, aoRecolher: () => undefined })!;
  const pedidosApp: Array<[string, unknown]> = [];
  const painelC: PainelDaAba = { painel: mC.painel, corpo: mC.corpo, rpc: () => appQueAnota(pedidosApp) };

  // O painel lateral (o documento dele passa a ser o global).
  const docL = instalarDom('<html><body><div id="app"></div></body></html>');
  definirEmissorDeAviso(null);
  const raiz = docL.getElementById("app") as HTMLElement;
  const area = areaMemoria();
  const ouvintes: Array<(p: PortaRpc, r: Remetente) => void> = [];
  const ponte = new PonteLateral({
    area,
    chave: CHAVE_LATERAL,
    janela: 1,
    novoId: () => "lat",
    ouvirConexoes: (cb) => void ouvintes.push(cb),
  });
  const eventos: string[] = [];
  const voltas: string[] = [];
  let rpcApp: Pick<Rpc, "chamar"> | null = null;
  const montagem = new MontagemLateral({
    raiz,
    ponte,
    area,
    agora: () => 1_000,
    carenciaMs: 300,
    criar: async (c, rpc) => {
      const k = c.unidade?.id ?? "";
      eventos.push(`monta ${k}`);
      rpcApp = rpc;
      return {
        focarProjeto: () => true,
        aoVoltarAba: () => void voltas.push(k),
        destruir: () => {
          eventos.push(`desmonta ${k}`);
          return 0;
        },
      };
    },
  });
  montagem.iniciar();
  await ponte.iniciar();

  const idas: string[] = [];
  /** Uma página do SEI na aba 7 da janela 1, com o lado da aba como o main.ts liga. */
  const abrirPagina = (doc: Document, pagina: Pagina, ctx: ContextoProjetos, painelDaTela: PainelDaAba | null) =>
    ligarLateralDaAba({
      doc,
      ctx,
      area,
      intervalo: 60_000,
      conectar: () => {
        const [daAba, doApp] = parDePortas();
        for (const x of ouvintes) x(doApp, { tab: { id: 7, windowId: 1 }, frameId: 0 });
        return daAba;
      },
      tratadores: tratadoresProjetos({
        doc,
        ctx,
        iframe: null,
        usuarios: async () => [],
        conferir: async () => null,
        focarNoPainel: focoDaAba({
          painel: Promise.resolve(painelDaTela),
          area,
          chave: chaveDaAba(ctx),
          agora: () => 1_000,
          link: () => linkDoMenu(paginaDe(doc, pagina.url), "procedimento_controlar"),
          ir: (u) => void idas.push(u),
        }),
      }),
    });
  /** O pedido do app montado à aba; o erro volta como valor (a prova segue e diz o que falhou). */
  const chamar = (op: string, args?: unknown): Promise<unknown> =>
    ((rpcApp as Pick<Rpc, "chamar"> | null)?.chamar(op, args) ?? Promise.reject(new Error("sem app"))).catch((e: unknown) => e);
  const quantos = async () => {
    const l = await chamar("processosDaCaixa");
    return Array.isArray(l) ? l.length : -1;
  };

  const naTrabalhar = abrirPagina(docT, pT, ctxT, null);
  await tique(30);
  checar(
    "a tela do processo (topo) se apresenta com host|login|u:<unidade> e o lateral monta a unidade dela",
    eventos.join() === "monta 110000001" && ponte.atual()?.chave === "treinamento.sei.sp.gov.br|pedro.soares|u:110000001",
    { eventos, chave: ponte.atual()?.chave },
  );
  checar("na tela do processo a caixa nao esta na tela: nenhum processo", (await quantos()) === 0);
  const r = await chamar("focarNoPainel", { id: "p1" });
  checar(
    "Abrir no painel pedido pelo lateral na tela do processo: vai ao Controle de Processos pelo link do menu e deixa o pedido",
    r === "navegou" &&
      idas.length === 1 &&
      /acao=procedimento_controlar/.test(idas[0] ?? "") &&
      lerPedidoDeFoco((await area.obter(CHAVE_FOCO))[CHAVE_FOCO], "painel", chaveDaAba(ctxT), 1_000)?.projeto === "p1",
    { r, idas },
  );

  // O SEI navega: a página some (a porta cai) e o Controle de Processos carrega na mesma aba.
  naTrabalhar.parar();
  await tique(30);
  const naCaixa = abrirPagina(docC, pC, ctxC, painelC);
  const atendido = await atenderPedidoDoLateral(area, chaveDaAba(ctxC), 2_000, painelC, { espera: 5 });
  await tique(30);
  checar(
    "o Controle de Processos da mesma unidade: a mesma chave, o lateral nao remonta (a carencia termina na volta)",
    eventos.join() === "monta 110000001" && voltas.join() === "110000001",
    { eventos, voltas },
  );
  checar(
    "e o painel de la abre o projeto pedido (o pedido sai do storage)",
    atendido &&
      !mC.corpo.hidden &&
      JSON.stringify(pedidosApp) === '[["focarProjeto",{"id":"p1"}]]' &&
      !(CHAVE_FOCO in (await area.obter(CHAVE_FOCO))),
    pedidosApp,
  );
  checar("o RPC do lateral agora le a caixa da pagina nova", (await quantos()) > 0);
  pedidosApp.length = 0;
  checar(
    "ali o Abrir no painel rola ate o painel (sem navegar)",
    (await chamar("focarNoPainel", { id: "p2" })) === "painel" && idas.length === 1,
  );
  await tique(10);
  checar("e o app do painel recebe o projeto", JSON.stringify(pedidosApp) === '[["focarProjeto",{"id":"p2"}]]', pedidosApp);

  // Troca de unidade: o SEI recarrega a página com outra unidade no cabeçalho.
  naCaixa.parar();
  await tique(30);
  const ctxOutra: ContextoProjetos = { ...ctxC, unidade: { id: "110000002", sigla: "OUTRA", nome: "Outra" } };
  const naOutra = abrirPagina(docC, pC, ctxOutra, null);
  await tique(40);
  checar(
    "outra unidade na mesma aba: outra chave, o lateral remonta na unidade nova",
    eventos.join() === "monta 110000001,desmonta 110000001,monta 110000002" && ponte.atual()?.chave.endsWith("|u:110000002") === true,
    eventos,
  );
  naOutra.parar();
  montagem.parar();
  await ponte.encerrar();
}

/** Nas telas de topo que não são o Controle de Processos: nada é lido do SEI; o que mudou aqui vai ao texto. */
async function sincroniaNasOutrasTelas(): Promise<void> {
  secao("pagina P5: a sincronia nas outras telas de topo so envia (ler e do Controle de Processos)");
  const host = "sei.x.gov.br";
  const area = areaMemoria();
  const sync = areaMemoria();
  await definirConsentimento(sync, CHAVE_CONSENTIMENTO, "textoPadrao", chaveDoConsentimento(host, "ana", "110", "unidade"), "ligado");
  const esc = escoposDaUnidade(host, "ana", "110");
  const carimbo = () => ({ agora: Date.now(), dispositivo: "d1", por: "ana", nome: "Ana" });
  const repos = { unidade: new RepositorioProjetos(area, esc.unidade, carimbo), eu: new RepositorioProjetos(area, esc.eu, carimbo) };
  const un = textoNoSei(await gerarConteudoTexto("Dados", doColega()));
  const eu = textoNoSei(null);
  const janela = new EventTarget();
  const pagina = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
  const s = ligarSincronia({
    ctx: { host, login: "ana", nome: "Ana" },
    unidade: { id: "110", sigla: "TESTE" },
    area,
    sync,
    repos,
    armazem: (vis) => (vis === "unidade" ? un : eu),
    janela,
    doc: pagina,
    atrasoEnvio: 10,
    puxar: false,
  });
  await tique(60);
  checar("ao abrir, nao le o texto do SEI", s !== null && un.lidas === 0 && eu.lidas === 0, { un: un.lidas, eu: eu.lidas });
  janela.dispatchEvent(new Event("focus"));
  pagina.dispatchEvent(new Event("visibilitychange"));
  await tique(40);
  checar("ao ganhar foco ou voltar a ficar visivel, tambem nao", un.lidas === 0, un.lidas);
  await repos.unidade.criarProjeto({ nome: "Feito no lateral" });
  await tique(150);
  const env = await envelopeDoTexto(un.html);
  checar(
    "o que mudou aqui (lateral, arvore) vai ao texto da unidade (com o que o colega ja tinha)",
    un.gravadas === 1 && !!env?.entidades.p.some((x) => x.nome === "Feito no lateral") && !!env?.entidades.p.some((x) => x.id === "pc1"),
    { gravadas: un.gravadas, nomes: env?.entidades.p.map((x) => x.nome) },
  );
  s?.parar();

  // Uma tela de topo sem o item "Textos Padrão" no menu: a rodada de envio pelo armazém real daria "indisponível", e
  // esse status (com o recuo de 1 dia) é um só para todas as abas da unidade. Ali a sincronia nem liga.
  const { doc: docComMenu, pagina: pComMenu } = telaSei("sei41/trabalhar.html");
  const { doc: docCaixa, pagina: pCaixa } = telaSei("sei41/caixa.html");
  const { doc: docSemMenu, pagina: pSemMenu } = telaSei("sei41/arvore.html");
  checar(
    "o item Textos Padrao no menu: a tela do processo e a caixa tem; uma pagina sem ele nao",
    armazemNaTela(docComMenu, pComMenu.url) && armazemNaTela(docCaixa, pCaixa.url) && !armazemNaTela(docSemMenu, pSemMenu.url),
  );
  const areaSem = areaMemoria();
  const reposSem = {
    unidade: new RepositorioProjetos(areaSem, esc.unidade, carimbo),
    eu: new RepositorioProjetos(areaSem, esc.eu, carimbo),
  };
  const semMenu = ligarSincronia({
    ctx: { host, login: "ana", nome: "Ana" },
    unidade: { id: "110", sigla: "TESTE" },
    area: areaSem,
    sync: areaMemoria(),
    repos: reposSem,
    armazem: (vis) => armazemDoTexto(docSemMenu, pSemMenu.url, vis, "ana"),
    janela: new EventTarget(),
    doc: Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState }),
    atrasoEnvio: 10,
    puxar: false,
    temArmazem: () => armazemNaTela(docSemMenu, pSemMenu.url),
  });
  await reposSem.unidade.criarProjeto({ nome: "Feito no lateral" });
  await tique(150);
  const chaveSt = chaveStatusTexto(esc.unidade);
  const st = (await areaSem.obter(chaveSt))[chaveSt] as StatusSync | undefined;
  checar(
    "tela sem o item Textos Padrao: a sincronia nao liga e o status da unidade fica como estava (nada de 'indisponivel')",
    semMenu === null && st === undefined,
    { ligou: semMenu !== null, st },
  );
  semMenu?.parar();
}
