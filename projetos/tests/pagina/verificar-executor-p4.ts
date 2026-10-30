/**
 * A ligação do P4 do lado da aba e de ponta a ponta:
 * - os pedidos do app à aba (pagina/executor.ts): sincronizar agora, apagar o pessoal e o Atividades;
 * - o armazém do Texto Padrão da aba (pagina/armazem.ts): o do núcleo, só com o HTTP e o link do MENU da tela;
 * - `ligarSincronia` (o que o main.ts do content script chama): lê ao abrir, puxa ao focar e ao voltar a ficar
 *   visível, apaga o pessoal esperando a trava, e nada disso derruba a aba;
 * - o app (`ligarApp`, o mesmo do main.ts do app) e a aba ligados pelo RPC de verdade (par de portas, com cópia
 *   estruturada): o que os colegas gravaram aparece no app; o que entra na unidade sem o "Entendi" espera a faixa;
 *   o número sigiloso não vai ao texto; "Sincronizar agora", "Desligar e apagar do SEI" e "Importar do servidor do
 *   Atividades" (com o login do SEI conferido) passam pela aba. O texto no SEI é um armazém falso de servidor que
 *   confere a gravação; o motor, o adaptador (com a memória do sigilo), a colaboração e o Proxy são os de verdade.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { parDePortas } from "@comum/ponte/parDePortas";
import { criarRpc } from "@comum/ponte/rpc";
import { definirConsentimento } from "@comum/sincronia/consentimento";
import { gerarConteudoTexto } from "@comum/sincronia/textoPadraoCodec";
import { definirEmissorDeAviso } from "@comum/ui/aviso";
import type { AbrirModal } from "@comum/ui/dialogo";
import { ligarApp } from "../../src/app/ligacao";
import { escoposDaUnidade } from "../../src/modelo/escopo";
import type { Vis } from "../../src/modelo/tipos";
import { armazemDoTexto } from "../../src/pagina/armazem";
import { atividadesDaAba } from "../../src/pagina/atividades";
import { tratadoresProjetos } from "../../src/pagina/executor";
import { ligarSincronia } from "../../src/pagina/sincronia";
import type { ContextoProjetos } from "../../src/ponte/tipos";
import { RepositorioProjetos } from "../../src/repositorio";
import { CHAVE_CONSENTIMENTO, chaveDoConsentimento } from "../../src/sincronia/consentimento";
import { chaveStatusTexto } from "../../src/sincronia/textoPadrao";
import { telaDoApp, texto } from "../apoioApp";
import { HOJE } from "../fabrica";
import { ganttFalso } from "../ganttFalso";
import { projetoCompleto } from "../legadoAtividades";
import { botao, checar, instalarDom, lanca, secao, telaSei, tique } from "./util";
import { doColega, envelopeDoTexto, textoNoSei } from "./verificar-sincronia-pagina";

const CTX: ContextoProjetos = {
  host: "sei.x.gov.br",
  login: "ana",
  nome: "Ana",
  unidade: { id: "110", sigla: "TESTE", nome: "Teste" },
  versao: "4.1.5",
  temaEscuro: false,
  atividades: true,
};
const UNIDADE = { id: "110", sigla: "TESTE" };
const SIGILO = "50300.000777/2026-10";
const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "sei-nucleo", "tests", "fixtures", "sei41");

/** Os dois repositórios da aba (o content script tem os seus, na mesma área do app). */
function reposDe(area: Area) {
  const esc = escoposDaUnidade(CTX.host, CTX.login, UNIDADE.id);
  const carimbo = () => ({ agora: Date.now(), dispositivo: "pagina", por: CTX.login, nome: CTX.nome });
  return { unidade: new RepositorioProjetos(area, esc.unidade, carimbo), eu: new RepositorioProjetos(area, esc.eu, carimbo) };
}

/** A aba visível (document) com o `visibilityState` que a prova muda. */
function paginaFalsa() {
  return Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
}

/** O último puxar foi há 3 min: a próxima puxada ao focar lê de novo (o intervalo é 2 min). */
async function envelhecer(area: Area, vis: Vis) {
  const k = chaveStatusTexto(escoposDaUnidade(CTX.host, CTX.login, UNIDADE.id)[vis]);
  const st = (await area.obter(k))[k] as Record<string, unknown>;
  await area.gravar({ [k]: { ...st, ultimoPuxar: Date.now() - 3 * 60_000 } });
}

/** O localStorage do SEI com o servidor do Atividades que o painel legado configurou. */
function localStorageDoSei(): Pick<Storage, "getItem"> {
  const v: Record<string, unknown> = {
    configBasePro_atividades: { URL_API: "https://atividades.orgao.gov.br/api/", KEY_USER: "chave-123" },
    optionsPro: { perfilAtividadesSelected: "TESTE" },
  };
  return { getItem: (k) => (k in v ? JSON.stringify(v[k]) : null) };
}

/** O servidor do Atividades: devolve um projeto; o perfil da resposta diz de quem é a chave. */
function servidorAtividades(login: string) {
  const s = { login, pedidos: 0 };
  const buscar = (async () => {
    s.pedidos++;
    const corpo = { status: 1, padrao: { perfil: { login: s.login }, projetos: [projetoCompleto()] } };
    return new Response(JSON.stringify(corpo), { status: 200 });
  }) as unknown as typeof fetch;
  return { s, buscar };
}

/** A página que o SEI devolve (o http do núcleo decodifica latin-1 do `arrayBuffer`). */
function resposta(url: string, html: string): Response {
  const bytes = new Uint8Array([...html].map((c) => c.charCodeAt(0) & 0xff));
  return { url, status: 200, arrayBuffer: async () => bytes.buffer } as unknown as Response;
}

export async function verificarExecutorP4(): Promise<void> {
  secao("pagina: os pedidos do P4 ao executor");
  const doc = instalarDom();
  const feitos: string[] = [];
  const base = { doc, ctx: CTX, iframe: null, usuarios: async () => [], conferir: async () => null };
  const t = tratadoresProjetos({
    ...base,
    sincronia: {
      agora: async () => {
        feitos.push("agora");
        return { unidade: { estado: "ok", quando: 1, pendente: false }, eu: null };
      },
      apagarPessoal: async () => {
        feitos.push("apagar");
        return true;
      },
    },
    atividades: async () => {
      feitos.push("atividades");
      return { fonte: "servidor", projetos: [] };
    },
  });
  await t.sincronizarAgora?.(undefined);
  await t.apagarDoSei?.(undefined);
  await t.importarAtividades?.(undefined);
  checar("cada pedido chega a quem faz", feitos.join() === "agora,apagar,atividades", feitos);
  const sem = tratadoresProjetos(base);
  const e1 = await lanca(() => sem.sincronizarAgora?.(undefined));
  const e2 = await lanca(() => sem.apagarDoSei?.(undefined));
  const e3 = await lanca(() => sem.importarAtividades?.(undefined));
  checar(
    "sem sincronia ou sem servidor: erro claro (o app mostra)",
    e1?.codigo === "SEM_SINCRONIA" && e2?.codigo === "SEM_SINCRONIA" && e3?.codigo === "SEM_ATIVIDADES",
    [e1, e2, e3],
  );
  const armazem = armazemDoTexto(doc, "https://sei.x.gov.br/sei/controlador.php?acao=procedimento_controlar", "unidade", "ana");
  checar(
    "o armazem do Texto Padrao da aba confere na gravacao (e exclui, para o apagar do pessoal)",
    typeof armazem.gravarConferindo === "function" && typeof armazem.excluir === "function" && typeof armazem.localizar === "function",
  );

  secao("pagina: o armazem do Texto Padrao usa o link do menu da tela (sem URL montada)");
  {
    const { doc: caixa, pagina } = telaSei("sei41/caixa.html");
    const menu = caixa.querySelector("#infraMenu a[href*='acao=texto_padrao_interno_listar']")?.getAttribute("href") ?? "";
    const lista = readFileSync(join(FIXTURES, "texto_padrao_listar.html"), "utf8").replace(/^<!-- url: .*? -->\n/, "");
    const pedidos: string[] = [];
    const original = globalThis.fetch;
    globalThis.fetch = (async (u: string | URL) => {
      pedidos.push(String(u));
      return resposta(String(u), lista);
    }) as typeof fetch;
    try {
      const lido = await armazemDoTexto(caixa, pagina.url, "unidade", "ana").ler();
      checar(
        "le a lista pelo link do MENU da tela e, sem o texto na lista, devolve null",
        !!menu && lido === null && pedidos.length === 1 && pedidos[0] === new URL(menu.replace(/&amp;/g, "&"), pagina.url).href,
        pedidos,
      );
      const semMenu = instalarDom("<html><body><p>Sem menu</p></body></html>");
      const e = await lanca(() => armazemDoTexto(semMenu, pagina.url, "eu", "ana").ler());
      checar(
        "tela sem o item do menu: indisponivel, sem requisicao nenhuma",
        e?.codigo === "SEI_ACAO_INDISPONIVEL" && pedidos.length === 1,
        e,
      );
    } finally {
      globalThis.fetch = original;
    }
  }

  secao("pagina: ligarSincronia le ao abrir, puxa ao focar e ao voltar a ficar visivel");
  {
    const area = areaMemoria();
    const sync = areaMemoria();
    const repos = reposDe(area);
    const un = textoNoSei(await gerarConteudoTexto("Dados", doColega()));
    const eu = textoNoSei(null);
    const janela = new EventTarget();
    const pagina = paginaFalsa();
    const s = ligarSincronia({
      ctx: CTX,
      unidade: UNIDADE,
      area,
      sync,
      repos,
      armazem: (vis) => (vis === "unidade" ? un : eu),
      janela,
      doc: pagina,
      atrasoEnvio: 10,
    });
    await tique(60);
    // A mescla do que o colega gravou avisa o repositório: custa uma leitura a mais, que acha tudo igual (motor).
    checar(
      "le o texto da unidade ao abrir (e mescla o do colega) sem gravar; o pessoal, desligado, nem e lido",
      s !== null &&
        un.lidas >= 1 &&
        un.gravadas === 0 &&
        eu.lidas === 0 &&
        (await repos.unidade.dados()).projetos.some((p) => p.id === "pc1"),
      { lidas: un.lidas, gravadas: un.gravadas },
    );
    const lidas = un.lidas;
    janela.dispatchEvent(new Event("focus"));
    await tique(30);
    checar("ao focar logo depois, respeita os 2 min", un.lidas === lidas, un.lidas - lidas);
    await envelhecer(area, "unidade");
    janela.dispatchEvent(new Event("focus"));
    await tique(60);
    checar("ao focar passados os 2 min, le de novo", un.lidas === lidas + 1, un.lidas - lidas);
    await envelhecer(area, "unidade");
    pagina.visibilityState = "hidden";
    pagina.dispatchEvent(new Event("visibilitychange"));
    await tique(30);
    checar("aba que fica oculta nao le", un.lidas === lidas + 1, un.lidas - lidas);
    pagina.visibilityState = "visible";
    pagina.dispatchEvent(new Event("visibilitychange"));
    await tique(60);
    checar("aba que volta a ficar visivel le", un.lidas === lidas + 2, un.lidas - lidas);

    // O "apagar" espera a vez na trava da rodada (Web Locks quando a página tem): nunca é pulado.
    const travas: Array<{ nome: string; esperando: boolean }> = [];
    const antes = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", {
      configurable: true,
      writable: true,
      value: {
        locks: {
          request: (nome: string, a: unknown, b?: unknown) => {
            const esperando = typeof a === "function";
            travas.push({ nome, esperando });
            const fn = (esperando ? a : b) as (l: unknown) => Promise<unknown>;
            return Promise.resolve(fn({ name: nome }));
          },
        },
      },
    });
    try {
      await definirConsentimento(sync, CHAVE_CONSENTIMENTO, "textoPadrao", chaveDoConsentimento(CTX.host, "ana", "110", "eu"), "ligado");
      await repos.eu.criarProjeto({ nome: "Só meu" });
      await tique(80);
      const apagou = await s?.apagarPessoal();
      const chaveEu = chaveStatusTexto(escoposDaUnidade(CTX.host, CTX.login, UNIDADE.id).eu);
      checar(
        "apagar o pessoal: espera a trava da rodada do texto pessoal (travarEsperando) e exclui so ele",
        apagou === true &&
          eu.excluido &&
          un.html !== null &&
          travas.some((x) => x.esperando && x.nome === `seipro-projetos-sync|${chaveEu}`),
        travas,
      );
    } finally {
      if (antes) Object.defineProperty(globalThis, "navigator", antes);
      else delete (globalThis as { navigator?: unknown }).navigator;
    }
    s?.parar();
  }

  secao("pagina: ligarSincronia nao derruba a aba");
  {
    const area = areaMemoria();
    const repos = reposDe(area);
    const avisosConsole: unknown[] = [];
    const warn = console.warn;
    console.warn = (...a: unknown[]) => void avisosConsole.push(a);
    try {
      const trocados = ligarSincronia({
        ctx: CTX,
        unidade: UNIDADE,
        area,
        sync: areaMemoria(),
        repos: { unidade: repos.eu, eu: repos.unidade },
        armazem: () => textoNoSei(null),
        janela: new EventTarget(),
        doc: paginaFalsa(),
      });
      checar("repositorios de outro escopo: nao liga (o executor responde SEM_SINCRONIA) e nao lanca", trocados === null);
      const base = areaMemoria();
      const syncQueNaoLe: Area = {
        ...base,
        obter: async () => {
          throw new Error("QUOTA_BYTES quota exceeded");
        },
        aoMudar: base.aoMudar.bind(base),
      };
      const s = ligarSincronia({
        ctx: CTX,
        unidade: UNIDADE,
        area,
        sync: syncQueNaoLe,
        repos,
        armazem: () => textoNoSei(null),
        janela: new EventTarget(),
        doc: paginaFalsa(),
      });
      await tique(40);
      checar("storage.sync que nao le: liga sem rejeicao solta (so o console)", s !== null);
      s?.parar();
    } finally {
      console.warn = warn;
    }
  }

  secao("ponta a ponta: o app e a aba ligados pelo RPC");
  {
    const avisos: string[] = [];
    definirEmissorDeAviso((t) => {
      avisos.push(t);
      return true;
    });
    const tela = telaDoApp();
    const area = areaMemoria();
    const sync = areaMemoria();
    const [portaApp, portaAba] = parDePortas();
    // A aba: os seus repositórios, a sincronia e o executor, como o main.ts do content script monta.
    const reposAba = reposDe(area);
    const un = textoNoSei(await gerarConteudoTexto("Dados", doColega()));
    const eu = textoNoSei(null);
    const sinc = ligarSincronia({
      ctx: CTX,
      unidade: UNIDADE,
      area,
      sync,
      repos: reposAba,
      armazem: (vis) => (vis === "unidade" ? un : eu),
      janela: new EventTarget(),
      doc: paginaFalsa(),
      atrasoEnvio: 10,
    });
    const servidor = servidorAtividades("ANA");
    criarRpc(
      portaAba,
      tratadoresProjetos({
        doc: tela,
        ctx: CTX,
        iframe: null,
        usuarios: async () => [],
        conferir: async () => null,
        sincronia: sinc,
        atividades: atividadesDaAba(CTX, localStorageDoSei(), "2.5.1", servidor.buscar),
      }),
    );
    // O app: a mesma montagem do main.ts do app.
    const modais: Array<{ titulo: string; conteudo: HTMLElement; fechar(): void }> = [];
    const abrirModal: AbrirModal = (m) => {
      tela.body.append(m.conteudo);
      const x = {
        titulo: m.titulo,
        conteudo: m.conteudo,
        fechar: () => {
          if (!m.conteudo.isConnected) return;
          m.conteudo.remove();
          m.aoFechar?.();
        },
      };
      modais.push(x);
      return x;
    };
    const raiz = tela.getElementById("app")!;
    const ligado = await ligarApp({
      raiz,
      ctx: CTX,
      area,
      sync,
      rpc: criarRpc(portaApp),
      abrirModal,
      confirmar: async () => true,
      baixar: () => undefined,
      escolherArquivo: async () => null,
      hoje: () => HOJE,
      agora: () => Date.now(),
      carimbo: () => ({ agora: Date.now(), dispositivo: "pc-ana", por: "ana", nome: "Ana" }),
      copias: null,
      arquivo: null,
      montarGantt: ganttFalso().montar,
      largura: () => 1000,
    });
    await tique(120);
    checar("o projeto que o colega gravou no texto da unidade aparece no app", texto(raiz).includes("Do colega"), texto(raiz));

    // Entrou na unidade por um caminho sem a pergunta (ex.: restaurar uma cópia): a aba não grava e marca.
    await reposAba.unidade.criarProjeto({ nome: "Da cópia restaurada" });
    await tique(120);
    checar(
      "sem o Entendi, a aba nao grava e o app mostra a faixa que pede o Entendi",
      un.gravadas === 0 && raiz.querySelector(".prj-faixas [data-faixa='aguardando']") !== null,
      { gravadas: un.gravadas },
    );
    botao(raiz.querySelector(".prj-faixas [data-faixa='aguardando']")!, "Entendi")?.click();
    await tique(150);
    const gravado = await envelopeDoTexto(un.html);
    checar(
      "Entendi na faixa: a aba grava na hora e a faixa some",
      un.gravadas >= 1 &&
        !!gravado?.entidades.p.some((p) => p.nome === "Da cópia restaurada") &&
        raiz.querySelector(".prj-faixas [data-faixa='aguardando']") === null,
      { gravadas: un.gravadas },
    );

    // Pelo app (o repositório com o "Entendi", já dado): o número sigiloso fica aqui e não vai ao texto.
    await ligado.colab.repos.unidade.criarProjeto({ nome: "Pregão sigiloso", processo: { protocolo: SIGILO, sigiloso: true } });
    await tique(150);
    const comSigilo = await envelopeDoTexto(un.html);
    const pregao = comSigilo?.entidades.p.find((p) => p.nome === "Pregão sigiloso");
    checar(
      "o projeto vai ao texto da unidade sem o numero sigiloso",
      !!pregao && pregao.processo?.protocolo === "" && pregao.processo.sigiloso === true && !/000777|50300000777202610/.test(un.html ?? ""),
      pregao,
    );
    const local = (await reposAba.unidade.dados()).projetos.find((p) => p.nome === "Pregão sigiloso");
    checar("e quem tem o numero nao o perde", local?.processo?.protocolo === SIGILO);

    // "Sincronizar agora" no diálogo Sincronização: o pedido atravessa o RPC e a aba responde o status.
    await ligado.colab.abrirSincronizacao();
    const dlg = modais.at(-1)!;
    botao(dlg.conteudo.querySelector("[data-secao='unidade']")!, "Sincronizar agora")?.click();
    await tique(150);
    checar("Sincronizar agora: a aba sincroniza e o app diz Sincronizado", avisos.at(-1) === "Sincronizado.", avisos.at(-1));
    dlg.fechar();

    // O pessoal: ligado no app, gravado pela aba; "Desligar e apagar do SEI" exclui só ele.
    await definirConsentimento(sync, CHAVE_CONSENTIMENTO, "textoPadrao", chaveDoConsentimento(CTX.host, "ana", "110", "eu"), "ligado");
    await ligado.colab.repos.eu.criarProjeto({ nome: "Só meu" });
    await tique(150);
    checar("o pessoal ligado: a aba grava o texto pessoal", eu.gravadas >= 1 && (await envelopeDoTexto(eu.html))?.entidades.p.length === 1);
    await ligado.colab.abrirSincronizacao();
    const dlg2 = modais.at(-1)!;
    botao(dlg2.conteudo, "Desligar e apagar do SEI")?.click();
    await tique(150);
    checar(
      "Desligar e apagar do SEI: a aba exclui o texto pessoal e so ele; o dialogo diz isso",
      eu.excluido &&
        eu.html === null &&
        un.html !== null &&
        /foi apagado do SEI/.test(texto(dlg2.conteudo.querySelector("[data-secao='eu'] .prj-sync-aviso"))),
      texto(dlg2.conteudo.querySelector("[data-secao='eu']")),
    );
    dlg2.fechar();

    // Importar do servidor do Atividades: a aba busca com o login do SEI; o app grava; a aba leva ao texto.
    ligado.colab.importarAtividades();
    await tique(150);
    const dlgAtv = modais.at(-1)!;
    checar(
      "Importar do Atividades: a aba busca (a chave e do usuario do SEI) e o app abre o dialogo",
      servidor.s.pedidos === 1 && dlgAtv.titulo === "Importar do servidor do Atividades",
      { pedidos: servidor.s.pedidos, titulo: dlgAtv.titulo },
    );
    botao(dlgAtv.conteudo, "Importar")?.click();
    await tique(200);
    checar(
      "importado na unidade e levado ao texto pela aba",
      !!(await reposAba.unidade.obterProjeto("atvp42")) && !!(await envelopeDoTexto(un.html))?.entidades.p.some((p) => p.id === "atvp42"),
    );
    servidor.s.login = "bia";
    ligado.colab.importarAtividades();
    await tique(150);
    checar(
      "a chave de outro usuario: o login do SEI e conferido na aba e o app avisa",
      servidor.s.pedidos === 2 && /de outro usu/.test(avisos.at(-1) ?? ""),
      avisos.at(-1),
    );

    ligado.destruir();
    sinc?.parar();
    definirEmissorDeAviso(null);
  }
}
