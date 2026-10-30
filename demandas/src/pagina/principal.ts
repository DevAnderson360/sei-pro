/**
 * O pacote da página (`js/demandas/pagina.js`, ESM): o carregador (`pagina/main.ts` + `pagina/carregador.ts`, o
 * `init_demandas.js` de todo frame) já marcou o <html>, conferiu a opção "Gestor de Demandas" e decidiu pela tela; ele
 * importa este módulo só onde há trabalho e chama um dos dois pontos de entrada:
 * - `principalArvore` (D17), no frame da barra de ações do processo (`#divArvoreAcoes`): o botão "Demandas", que abre o
 *   balão (sob demanda, `js/demandas/balao.js`) com as demandas do processo e os formulários já preenchidos com o
 *   processo e o documento abertos, lidos só da árvore que o frame vizinho já desenhou (pagina/arvore.ts);
 * - `principalTopo`, na janela de topo de qualquer tela do SEI com unidade:
 * - os repositórios com o dispositivo de verdade e a sincronia dos Textos Padrão da unidade (pagina/sincronia.ts: lê só
 *   no Controle de Processos; nas outras telas só envia o que mudou aqui, porque o app grava no storage);
 * - no Controle de Processos, também o painel embutido (o iframe do app), as pílulas do título (com o contador da aba do
 *   lateral) e o "Abrir no painel" que o lateral deixou;
 * - o ícone das demandas em cada linha da grade que tenha demanda (D18, pagina/caixa.ts), com o balão do processo;
 * - o lado da aba do painel lateral (pagina/lateral.ts, chave host|login|u:<unidade>), em toda tela de topo.
 *
 * Nada daqui BUSCA a árvore de um processo nem monta link do SEI: a lista de usuários é a parcial
 * (pagina/usuarios.ts), e o armazém dos Textos Padrão e a ida ao painel usam o link do menu da tela.
 */

import { type Area, areaChrome } from "@comum/armazenamento/area";
import { idDispositivo } from "@comum/armazenamento/dispositivo";
import { hojeISO } from "@comum/datas/dias";
import { corDoTemaSei, manterTemaNoContexto, seiEscuro } from "@comum/pagina/tema";
import { avisoComAcoesNaPagina, avisoNaPagina } from "@comum/painel/aviso";
import { ligarPortaDoPainel, type PainelMontado } from "@comum/painel/embutido";
import type { PortaRpc } from "@comum/ponte/rpc";
import { linkDoMenu } from "@nucleo/links/links";
import { documentoTopo, paginaDe } from "@nucleo/sessao/pagina";
import { chaveUsuarios } from "@projetos/modelo/constantes";
import { gravadorDoContador } from "../app/contador";
import { carregarDados, responsaveisUsados } from "../app/dados";
import { escoposDaUnidade } from "../modelo/escopo";
import type { Carimbo, Vis } from "../modelo/tipos";
import { CANAL_DEMANDAS, CANAL_LATERAL, type ContextoDemandas, chaveDaAba } from "../ponte/tipos";
import { gravarPreferencias, lerPreferencias } from "../preferencias";
import { RepositorioDemandas } from "../repositorio";
import { consentimentoDemandas } from "../sincronia/consentimento";
import { armazemDoTexto, armazemNaTela } from "./armazem";
import { instalarNaBarra } from "./arvore";
import { instalarIconesCaixa } from "./caixa";
import { contextoDemandas } from "./contexto";
import { tratadoresDemandas } from "./executor";
import { atenderPedidoDoLateral, focoDaAba, irAoPainel, type PainelDaAba } from "./foco";
import { ligarLateralDaAba } from "./lateral";
import { ligarAlertas, montarPainelDemandas, ordemDoPainel } from "./painel";
import { ligarSincronia, type SincroniaDemandas } from "./sincronia";
import { abridorDoBalao } from "./sobDemanda";
import { qualTela } from "./tela";
import { usuariosDaCaixa, usuariosDaUnidade } from "./usuarios";

/** O balão do processo: o módulo dele (com o `base.css`) só na primeira abertura. */
const abrirBalao = abridorDoBalao(() => import("./pacoteBalao"));

type Repos = Readonly<Record<Vis, RepositorioDemandas>>;

/** O que esta janela de topo tem para o painel embutido. */
interface Aba {
  ctx: ContextoDemandas;
  unidade: { id: string; sigla: string; nome: string };
  area: Area;
  repos: Repos;
  sincronia: SincroniaDemandas | null;
}

/** Os dois escopos da unidade. O carimbo leva o dispositivo de verdade, o mesmo do app (mesclagem e origem do sigilo). */
async function reposDaUnidade(ctx: ContextoDemandas, unidade: { id: string }, area: Area): Promise<Repos> {
  const dispositivo = await idDispositivo(area);
  const carimbo = (): Carimbo => ({ agora: Date.now(), dispositivo, por: ctx.login, nome: ctx.nome });
  const escopos = escoposDaUnidade(ctx.host, ctx.login, unidade.id);
  return {
    unidade: new RepositorioDemandas(area, escopos.unidade, carimbo),
    eu: new RepositorioDemandas(area, escopos.eu, carimbo),
  };
}

/** A janela de topo de uma tela do SEI com unidade (o carregador já conferiu a tela e a opção). */
export async function principalTopo(): Promise<void> {
  const ctx = contextoDemandas(document, { temaEscuro: seiEscuro(document, localStorage), corTema: corDoTemaSei(document) }, location.href);
  // Sem unidade no cabeçalho (login, janelas sem a barra do SEI): nem sincronia nem painel.
  if (!ctx?.unidade) return;
  manterTemaNoContexto(document, localStorage, ctx);
  const unidade = ctx.unidade;
  const naCaixa = qualTela(document) === "caixa";
  const area = areaChrome(chrome.storage.local, "local");
  const repos = await reposDaUnidade(ctx, unidade, area);
  // Os textos: o Controle de Processos lê ao abrir e ao ganhar foco; as outras telas só enviam, e só se têm o item
  // "Textos Padrão" no menu (senão o status "indisponível" valeria para todas as abas da unidade).
  const sincronia = ligarSincronia({
    ctx,
    unidade,
    area,
    sync: areaChrome(chrome.storage.sync, "sync"),
    repos,
    armazem: (vis, tabela) => armazemDoTexto(document, location.href, vis, tabela, ctx.login),
    janela: window,
    doc: document,
    puxar: naCaixa,
    temArmazem: naCaixa ? undefined : () => armazemNaTela(document, location.href),
  });
  const aba: Aba = { ctx, unidade, area, repos, sincronia };
  // null: a tela não recebe o painel (as outras telas); rejeitada: a montagem falhou.
  const painel: Promise<PainelDaAba | null> = naCaixa ? montarNaCaixa(aba) : Promise.resolve(null);
  painel.catch((e) => console.warn("[SEI Pro] demandas: painel", e));
  const focarNoPainel = focoDaAba({
    painel,
    area,
    chave: chaveDaAba(ctx),
    agora: () => Date.now(),
    link: () => linkDoMenu(paginaDe(document, location.href), "procedimento_controlar"),
    ir: (u) => location.assign(u),
  });
  // D18: o ícone das demandas na grade e o balão do processo. Isolada: uma exceção aqui não deixa a aba sem o lateral.
  if (naCaixa) {
    try {
      ligarCaixa(aba, focarNoPainel);
    } catch (e) {
      console.warn("[SEI Pro] demandas: grade", e);
    }
  }
  // O lado da aba do lateral já (sem esperar o painel): a página recarregada volta antes do fim da carência.
  ligarLateralDaAba({
    doc: document,
    ctx,
    area,
    conectar: () => chrome.runtime.connect({ name: CANAL_LATERAL }) as unknown as PortaRpc,
    tratadores: tratadores(aba, { iframe: null, focarNoPainel }),
  });
}

/**
 * D18: o ícone das demandas na grade do Controle de Processos. O balão é o da D17 (sob demanda), com o processo da
 * linha e sem documento aberto; "Abrir no painel" é o mesmo pedido de foco do lateral (painel desta aba, ou o
 * Controle de Processos pelo menu na visão que não recebe o painel).
 */
function ligarCaixa(aba: Aba, focarNoPainel: (id: string) => Promise<"painel" | "navegou">): void {
  const { ctx, unidade, area, repos } = aba;
  const consentimento = consentimentoDemandas(areaChrome(chrome.storage.sync, "sync"), ctx.host, ctx.login, unidade.id, "unidade");
  const eu = { login: ctx.login, nome: ctx.nome || ctx.login };
  const caixa = instalarIconesCaixa({
    doc: document,
    repos,
    hoje: () => hojeISO(),
    abrir: (ancora, processo) =>
      void abrirBalao(
        ancora,
        { processo, documento: null },
        {
          repos,
          hoje: () => hojeISO(),
          sigla: unidade.sigla || "unidade",
          temaEscuro: ctx.temaEscuro,
          consentimento,
          eu,
          usuarios: () => listaDeUsuarios({ ctx, unidade, area, repos }, document),
          abrirNoPainel: (id) => void focarNoPainel(id).catch((e) => console.warn("[SEI Pro] demandas: abrir no painel", e)),
        },
      ).catch((e) => console.warn("[SEI Pro] demandas: balão da grade", e)),
  });
  void caixa.atualizar().catch((e) => console.warn("[SEI Pro] demandas: ícones da grade", e));
}

/**
 * O painel embutido, as pílulas (com o contador do lateral) e o "Abrir no painel" que o lateral deixou. null quando
 * esta lista não recebe o painel (a visão por marcadores, que já tem o seu); rejeita se a montagem falhar.
 */
async function montarNaCaixa(aba: Aba): Promise<PainelDaAba | null> {
  const { ctx, area, repos } = aba;
  const prefs = await lerPreferencias(area);
  const montado = montarPainelDemandas(document, {
    urlApp: chrome.runtime.getURL("html/demandas.html#modo=embutido"),
    temaEscuro: ctx.temaEscuro,
    recolhido: prefs.recolhido,
    ordem: ordemDoPainel(localStorage),
    aoRecolher: (r) => void gravarPreferencias(area, { recolhido: r }).catch(() => undefined),
  });
  if (!montado) return null;
  // A cada carga do iframe, uma porta nova: o app só aceita a porta da própria aba (@comum/ponte/conexaoDaAba).
  const porta = ligarPortaDoPainel(
    montado,
    () => chrome.runtime.connect({ name: CANAL_DEMANDAS }) as unknown as PortaRpc,
    tratadores(aba, { iframe: montado.iframe, montado }),
  );
  const contar = gravadorDoContador(area);
  // As pílulas contam as minhas atrasadas: o mesmo contador (e a mesma regra) que o app do lateral grava.
  ligarAlertas(montado, {
    temaEscuro: ctx.temaEscuro,
    repos,
    eu: { login: ctx.login, nome: ctx.nome || ctx.login },
    rpc: porta.rpc,
    hoje: () => hojeISO(),
    aoContar: (n) => void contar(n),
  });
  const painel: PainelDaAba = { painel: montado.painel, corpo: montado.corpo, rpc: porta.rpc };
  void atenderPedidoDoLateral(area, chaveDaAba(ctx), Date.now(), painel).catch(() => undefined);
  return painel;
}

/** A lista parcial de usuários da unidade (a do app e a do balão): nunca abre a árvore de um processo. */
async function listaDeUsuarios(aba: Pick<Aba, "ctx" | "unidade" | "area" | "repos">, doc: Document) {
  const { ctx, unidade, area, repos } = aba;
  const dados = await carregarDados(repos, hojeISO()).catch(() => null);
  return usuariosDaUnidade({
    area,
    chave: chaveUsuarios(ctx.host, unidade.id),
    agora: Date.now(),
    daCaixa: usuariosDaCaixa(doc),
    usados: dados ? responsaveisUsados(dados) : [],
    eu: { login: ctx.login, nome: ctx.nome || ctx.login },
    // A única lista completa conhecida exige abrir a árvore de um processo (grava "Processo recebido"): nunca.
    buscarCompleta: null,
  });
}

/** Os endereços do visualizador (este frame e os aninhados do SEI 4.1): o `id_documento` quando nenhum nó está selecionado. */
function urlsDoVisualizador(doc: Document): string[] {
  const urls = [doc.location?.href ?? ""];
  for (const f of doc.querySelectorAll("iframe")) {
    try {
      const u = (f as HTMLIFrameElement).contentWindow?.location.href;
      if (u) urls.push(u);
    } catch {
      /* outra origem: não interessa */
    }
  }
  return urls;
}

/**
 * D17: o frame da barra de ações do processo. O cabeçalho (usuário, unidade) está na janela de topo, da mesma origem; a
 * gravação do balão chega ao Texto Padrão pela sincronia de lá (que envia o que mudou). Nesta tela não há painel:
 * "Abrir no painel" vai ao Controle de Processos pelo link do menu e deixa o pedido de foco guardado.
 */
export async function principalArvore(): Promise<void> {
  const topo = documentoTopo();
  const temaEscuro = seiEscuro(document, localStorage);
  const ctx = contextoDemandas(topo, { temaEscuro }, topo.location?.href);
  if (!ctx?.unidade) return;
  const unidade = ctx.unidade;
  const area = areaChrome(chrome.storage.local, "local");
  const repos = await reposDaUnidade(ctx, unidade, area);
  const aba = { ctx, unidade, area, repos };
  const consentimento = consentimentoDemandas(areaChrome(chrome.storage.sync, "sync"), ctx.host, ctx.login, unidade.id, "unidade");
  const eu = { login: ctx.login, nome: ctx.nome || ctx.login };
  await instalarNaBarra({
    doc: document,
    repos,
    hoje: () => hojeISO(),
    docArvore: () => {
      const f = topo.getElementById("ifrArvore") as HTMLIFrameElement | null;
      const doc = f?.contentDocument;
      return doc?.documentElement && f?.contentWindow ? { doc, url: f.contentWindow.location.href } : null;
    },
    urls: () => urlsDoVisualizador(document),
    abrir: (ancora, detectar) => {
      const x = detectar();
      if (!x) return;
      void abrirBalao(ancora, x, {
        repos,
        hoje: () => hojeISO(),
        sigla: unidade.sigla || "unidade",
        temaEscuro,
        consentimento,
        eu,
        usuarios: () => listaDeUsuarios(aba, document),
        // Ainda dentro do clique: a ida ao Controle de Processos usa o link do menu da tela.
        abrirNoPainel: (id) =>
          void irAoPainel(
            {
              area,
              chave: chaveDaAba(ctx),
              agora: Date.now(),
              link: () => linkDoMenu(paginaDe(topo, topo.location?.href), "procedimento_controlar"),
              ir: (u) => topo.location.assign(u),
            },
            id,
          ).catch((e) => console.warn("[SEI Pro] demandas: abrir no painel", e)),
      }).catch((e) => console.warn("[SEI Pro] demandas: balão da barra", e));
    },
  });
}

/** O que o app (do painel embutido) pede a esta aba. */
function tratadores(
  aba: Aba,
  o: { iframe: HTMLIFrameElement | null; montado?: PainelMontado; focarNoPainel?: (id: string) => Promise<"painel" | "navegou"> },
) {
  const { ctx } = aba;
  return tratadoresDemandas({
    doc: document,
    ctx,
    iframe: o.iframe,
    sobreposicao: o.montado?.sobreposicao,
    // Os avisos na página são do painel embutido.
    avisar: o.montado ? avisoNaPagina(document, ctx.temaEscuro, "spro-dem") : null,
    avisarAcoes: o.montado ? avisoComAcoesNaPagina(document, ctx.temaEscuro, "spro-dem") : null,
    sincronia: aba.sincronia,
    focarNoPainel: o.focarNoPainel ?? null,
    usuarios: () => listaDeUsuarios(aba, document),
  });
}
