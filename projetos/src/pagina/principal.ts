/**
 * O pacote da página (`js/projetos/pagina.js`, ESM): o carregador
 * (`pagina/main.ts` + `pagina/carregador.ts`, o `init_projetos.js` de todo
 * frame) já marcou o <html>, tirou os textos internos do seletor, conferiu a
 * opção "Gerenciar Projetos" e decidiu pela tela; ele importa este módulo só
 * onde há trabalho e chama um dos dois pontos de entrada:
 * - `principalTopo`, na janela de topo de qualquer tela do SEI com unidade: os
 *   repositórios com o dispositivo de verdade, a sincronia dos dois Textos
 *   Padrão da unidade (pagina/sincronia.ts: lê só no Controle de Processos; nas
 *   outras telas só envia o que mudou aqui, porque o lateral e a árvore gravam)
 *   e o lado da aba do painel lateral (pagina/lateral.ts, chave
 *   host|login|u:<unidade>); no Controle de Processos, também o painel
 *   embutido, as pílulas (com o contador da aba do lateral), o "Abrir no
 *   painel" que o lateral deixou e o ícone dos projetos na caixa, com o balão
 *   do processo (pagina/caixa.ts);
 * - `principalArvore`, no frame da árvore do processo: o ícone, a faixa e o
 *   balão, lendo só a árvore que o frame já tem (pagina/arvore.ts), com o
 *   contexto (usuário, unidade) do cabeçalho da janela de topo; "Abrir no
 *   painel" abre o lateral.
 * O balão do processo (com o `base.css` como texto) vem sob demanda, na
 * primeira abertura (pagina/sobDemanda.ts → `js/projetos/balao.js`).
 *
 * Nada daqui BUSCA a árvore de um processo nem monta link do SEI: a
 * conferência do número SEI vai pela pesquisa rápida da própria tela, a lista
 * de usuários é a parcial (pagina/usuarios.ts), e o armazém dos Textos Padrão
 * e a ida ao Controle de Processos usam o link do menu da tela.
 */

import { type Area, areaChrome } from "@comum/armazenamento/area";
import { idDispositivo } from "@comum/armazenamento/dispositivo";
import { hojeISO } from "@comum/datas/dias";
import { corDoTemaSei, manterTemaNoContexto, seiEscuro } from "@comum/pagina/tema";
import { avisoComAcoesNaPagina, avisoNaPagina } from "@comum/painel/aviso";
import { ligarPortaDoPainel, type PainelMontado } from "@comum/painel/embutido";
import type { PortaRpc } from "@comum/ponte/rpc";
import { Formulario } from "@nucleo/formulario/formulario";
import { linkDoMenu } from "@nucleo/links/links";
import { criarHttp } from "@nucleo/sessao/http";
import { documentoTopo, paginaDe } from "@nucleo/sessao/pagina";
import { gravadorDoContador } from "../app/contador";
import { carregarUnidade } from "../app/dados";
import { gravarPreferencias, lerPreferencias } from "../app/preferencias";
import { chaveUsuarios } from "../modelo/constantes";
import { escoposDaUnidade } from "../modelo/escopo";
import type { Carimbo, Vis } from "../modelo/tipos";
import { CANAL_LATERAL, CANAL_PROJETOS, type ContextoProjetos, chaveDaAba } from "../ponte/tipos";
import { RepositorioProjetos } from "../repositorio";
import { consentimentoProjetos } from "../sincronia/consentimento";
import { armazemDoTexto, armazemNaTela } from "./armazem";
import { instalarNaArvore } from "./arvore";
import { atividadesDaAba } from "./atividades";
import { instalarIconesCaixa } from "./caixa";
import { atividadesConfigurado, contextoProjetos } from "./contexto";
import { conferirDocumento } from "./documento";
import { tratadoresProjetos } from "./executor";
import { atenderPedidoDoLateral, focarNoPainelDaAba, focoDaAba, type PainelDaAba, pedirLateral } from "./foco";
import { ligarLateralDaAba } from "./lateral";
import { ligarAlertas, montarPainelProjetos, ordemDoPainel } from "./painel";
import { ligarSincronia, type SincroniaPagina } from "./sincronia";
import { abridorDoBalao } from "./sobDemanda";
import { qualTela } from "./tela";
import { responsaveisUsados, usuariosDaCaixa, usuariosDaUnidade } from "./usuarios";

/** O balão do processo: o módulo dele (com o `base.css`) só na primeira abertura, na caixa ou na árvore. */
const abrirBalao = abridorDoBalao(() => import("./pacoteBalao"));

type Repos = Readonly<Record<Vis, RepositorioProjetos>>;

/** O que esta janela de topo tem para o painel embutido e o lateral. */
interface Aba {
  ctx: ContextoProjetos;
  unidade: { id: string; sigla: string; nome: string };
  area: Area;
  repos: Repos;
  sincronia: SincroniaPagina | null;
}

/**
 * Os dois escopos da unidade. O content script também grava (os balões da caixa e da árvore): o carimbo leva o
 * dispositivo de verdade, o mesmo do app (mesclagem e origem do sigilo).
 */
async function reposDaUnidade(ctx: ContextoProjetos, unidade: { id: string }, area: Area): Promise<Repos> {
  const dispositivo = await idDispositivo(area);
  const carimbo = (): Carimbo => ({ agora: Date.now(), dispositivo, por: ctx.login, nome: ctx.nome });
  const escopos = escoposDaUnidade(ctx.host, ctx.login, unidade.id);
  return {
    unidade: new RepositorioProjetos(area, escopos.unidade, carimbo),
    eu: new RepositorioProjetos(area, escopos.eu, carimbo),
  };
}

/** A janela de topo de uma tela do SEI com unidade (o carregador já conferiu a tela e a opção). */
export async function principalTopo(): Promise<void> {
  const ctx = contextoProjetos(
    document,
    { temaEscuro: seiEscuro(document, localStorage), corTema: corDoTemaSei(document), atividades: atividadesConfigurado(localStorage) },
    location.href,
  );
  // Sem unidade no cabeçalho (login, janelas sem a barra do SEI): nem sincronia nem lateral.
  if (!ctx?.unidade) return;
  manterTemaNoContexto(document, localStorage, ctx);
  const unidade = ctx.unidade;
  const naCaixa = qualTela(document) === "caixa";
  const area = areaChrome(chrome.storage.local, "local");
  const repos = await reposDaUnidade(ctx, unidade, area);
  // Os dois Textos Padrão: o Controle de Processos lê ao abrir e ao ganhar foco; as outras telas só enviam, e só se
  // têm o item "Textos Padrão" no menu (senão o status "indisponível" valeria para todas as abas da unidade).
  const sincronia = ligarSincronia({
    ctx,
    unidade,
    area,
    sync: areaChrome(chrome.storage.sync, "sync"),
    repos,
    armazem: (vis) => armazemDoTexto(document, location.href, vis, ctx.login),
    janela: window,
    doc: document,
    puxar: naCaixa,
    temArmazem: naCaixa ? undefined : () => armazemNaTela(document, location.href),
  });
  const aba: Aba = { ctx, unidade, area, repos, sincronia };
  // null: a tela não recebe o painel (as outras telas e a visão por marcadores); rejeitada: a montagem falhou.
  const painel: Promise<PainelDaAba | null> = naCaixa ? montarNaCaixa(aba) : Promise.resolve(null);
  painel.catch((e) => console.warn("[SEI Pro] projetos: painel", e));
  // Isolada: uma excecao da caixa nao pode deixar a aba sem o lado do lateral logo abaixo.
  if (naCaixa) {
    try {
      ligarCaixa(aba, painel);
    } catch (e) {
      console.warn("[SEI Pro] projetos: caixa", e);
    }
  }
  // O lado da aba do lateral já (sem esperar o painel): a página recarregada volta antes do fim da carência.
  ligarLateralDaAba({
    doc: document,
    ctx,
    area,
    conectar: () => chrome.runtime.connect({ name: CANAL_LATERAL }) as unknown as PortaRpc,
    tratadores: tratadores(aba, {
      iframe: null,
      focarNoPainel: focoDaAba({
        painel,
        area,
        chave: chaveDaAba(ctx),
        agora: () => Date.now(),
        link: () => linkDoMenu(paginaDe(document, location.href), "procedimento_controlar"),
        ir: (u) => location.assign(u),
      }),
    }),
  });
}

/**
 * O painel embutido, as pílulas (com o contador do lateral) e o "Abrir no painel" que o lateral deixou. null quando
 * esta lista não recebe o painel (a visão por marcadores); rejeita se a montagem falhar.
 */
async function montarNaCaixa(aba: Aba): Promise<PainelDaAba | null> {
  const { ctx, area, repos } = aba;
  const prefs = await lerPreferencias(area);
  const montado = montarPainelProjetos(document, {
    urlApp: chrome.runtime.getURL("html/projetos.html#modo=embutido"),
    temaEscuro: ctx.temaEscuro,
    recolhido: prefs.recolhido,
    ordem: ordemDoPainel(localStorage),
    aoRecolher: (r) => void gravarPreferencias(area, { recolhido: r }).catch(() => undefined),
  });
  if (!montado) return null;
  // A cada carga do iframe, uma porta nova: o app só aceita a porta da própria aba (@comum/ponte/conexaoDaAba).
  const porta = ligarPortaDoPainel(
    montado,
    () => chrome.runtime.connect({ name: CANAL_PROJETOS }) as unknown as PortaRpc,
    tratadores(aba, { iframe: montado.iframe, montado }),
  );
  // As pílulas contam as atrasadas: o mesmo contador (e a mesma regra) que o app do lateral grava.
  ligarAlertas(montado, { temaEscuro: ctx.temaEscuro, repos, rpc: porta.rpc, hoje: () => hojeISO(), aoContar: gravadorDoContador(area) });
  const painel: PainelDaAba = { painel: montado.painel, corpo: montado.corpo, rpc: porta.rpc };
  void atenderPedidoDoLateral(area, chaveDaAba(ctx), Date.now(), painel).catch(() => undefined);
  return painel;
}

/**
 * P5: o ícone dos projetos na caixa e o balão do processo. "Abrir no painel" vai ao painel desta aba; sem ele (a
 * visão por marcadores, ou a montagem que falhou), ao painel lateral na aba Projetos.
 */
function ligarCaixa(aba: Aba, painel: Promise<PainelDaAba | null>): void {
  const { ctx, unidade, repos } = aba;
  // O painel já resolvido: o clique decide sem esperar (o lateral precisa do gesto do usuário, que não atravessa await).
  let montado: PainelDaAba | null | undefined;
  painel.then(
    (p) => {
      montado = p;
    },
    () => {
      montado = null;
    },
  );
  const abrirNoPainel = (id: string, etapa?: string) => {
    if (montado) focarNoPainelDaAba(montado, id, etapa);
    else if (montado === null) abrirLateral(aba, id, etapa);
    // Ainda montando (o clique veio antes do painel): o desta aba vem já.
    else
      void painel.then(
        (p) => (p ? void focarNoPainelDaAba(p, id, etapa) : abrirLateral(aba, id, etapa)),
        () => abrirLateral(aba, id, etapa),
      );
  };
  const consentimento = consentimentoProjetos(areaChrome(chrome.storage.sync, "sync"), ctx.host, ctx.login, unidade.id, "unidade");
  const caixa = instalarIconesCaixa({
    doc: document,
    repos,
    hoje: () => hojeISO(),
    temaEscuro: ctx.temaEscuro,
    abrir: (ancora, processo) =>
      void abrirBalao(ancora, processo, {
        modo: "caixa",
        repos,
        hoje: () => hojeISO(),
        sigla: unidade.sigla || "unidade",
        temaEscuro: ctx.temaEscuro,
        consentimento,
        documentos: () => [],
        abrirNoPainel,
      }).catch((e) => console.warn("[SEI Pro] projetos: balão da caixa", e)),
  });
  void caixa.atualizar().catch((e) => console.warn("[SEI Pro] projetos: ícones da caixa", e));
}

/**
 * P5: a tela do processo (o frame da árvore): o ícone, a faixa e o balão. O cabeçalho (usuário, unidade) está na
 * janela de topo, da mesma origem; a gravação do balão chega ao Texto Padrão pela sincronia de lá (que envia o que
 * mudou). Nesta aba não há painel: "Abrir no painel" abre o lateral.
 */
export async function principalArvore(): Promise<void> {
  const topo = documentoTopo();
  const temaEscuro = seiEscuro(document, localStorage);
  const ctx = contextoProjetos(topo, { temaEscuro, atividades: atividadesConfigurado(localStorage) }, topo.location?.href);
  if (!ctx?.unidade) return;
  const unidade = ctx.unidade;
  const area = areaChrome(chrome.storage.local, "local");
  const repos = await reposDaUnidade(ctx, unidade, area);
  const consentimento = consentimentoProjetos(areaChrome(chrome.storage.sync, "sync"), ctx.host, ctx.login, unidade.id, "unidade");
  await instalarNaArvore({
    doc: document,
    url: location.href,
    repos,
    hoje: () => hojeISO(),
    temaEscuro,
    abrir: (ancora, processo, documentos) =>
      void abrirBalao(ancora, processo, {
        modo: "arvore",
        repos,
        hoje: () => hojeISO(),
        sigla: unidade.sigla || "unidade",
        temaEscuro,
        consentimento,
        documentos,
        // Ainda dentro do clique: o pedido ao background vai antes de qualquer await (pagina/foco.ts).
        abrirNoPainel: (id, etapa) => abrirLateral({ ctx, area }, id, etapa),
      }).catch((e) => console.warn("[SEI Pro] projetos: balão da árvore", e)),
  });
}

/** O painel lateral na aba Projetos, com o projeto (pagina/foco.ts). Chamado direto do clique: o Chrome exige o gesto. */
function abrirLateral(aba: Pick<Aba, "ctx" | "area">, id: string, etapa?: string): void {
  void pedirLateral(
    {
      area: aba.area,
      chave: chaveDaAba(aba.ctx),
      agora: Date.now(),
      abrir: () => chrome.runtime.sendMessage({ tipo: "abrirPainel", aba: "projetos" }),
      janela: () => void window.open(chrome.runtime.getURL("html/painel.html#aba=projetos"), "seiProPainel", "popup,width=420,height=760"),
    },
    id,
    etapa,
  ).catch(() => undefined);
}

/** O que o app (do painel embutido ou do lateral) pede a esta aba. */
function tratadores(
  aba: Aba,
  o: {
    iframe: HTMLIFrameElement | null;
    montado?: PainelMontado;
    focarNoPainel?: (id: string, etapa?: string) => Promise<"painel" | "navegou">;
  },
) {
  const { ctx, unidade, area, repos } = aba;
  const http = criarHttp(location.href);
  return tratadoresProjetos({
    doc: document,
    ctx,
    iframe: o.iframe,
    sobreposicao: o.montado?.sobreposicao,
    // Os avisos na página são do painel embutido (o lateral mostra os seus).
    avisar: o.montado ? avisoNaPagina(document, ctx.temaEscuro, "spro-prj") : null,
    avisarAcoes: o.montado ? avisoComAcoesNaPagina(document, ctx.temaEscuro, "spro-prj") : null,
    sincronia: aba.sincronia,
    // A mesma requisição do painel legado, com o login do SEI desta tela (a chave de outro usuário é recusada).
    atividades: atividadesDaAba(ctx, localStorage, chrome.runtime.getManifest().version, (u, i) => fetch(u, i)),
    focarNoPainel: o.focarNoPainel ?? null,
    usuarios: async () => {
      const dados = await carregarUnidade(repos, hojeISO()).catch(() => null);
      return usuariosDaUnidade({
        area,
        chave: chaveUsuarios(ctx.host, unidade.id),
        agora: Date.now(),
        daCaixa: usuariosDaCaixa(document),
        usados: dados ? responsaveisUsados([...dados.ativos, ...dados.arquivados]) : [],
        eu: { login: ctx.login, nome: ctx.nome || ctx.login },
        // Decisão do controlador (T12): a única lista completa conhecida exige abrir a árvore de um processo.
        buscarCompleta: null,
      });
    },
    conferir: (n) =>
      conferirDocumento(
        (ref) =>
          Formulario.de(paginaDe(document, location.href), "#frmProtocoloPesquisaRapida", http)
            .definir({ txtPesquisaRapida: ref })
            // Acesso negado ou nada encontrado volta como a tela da pesquisa: vira "não encontrado", não erro.
            .enviar({ aceitarValidacao: true }),
        n,
      ),
  });
}
