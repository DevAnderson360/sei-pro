/**
 * A montagem do lateral (Review Focus 5 do plano-mestre): liga-se à aba do SEI
 * da frente pela chave host|login|u:<unidade>, remonta ao trocar de unidade,
 * nunca manda pedido para outra unidade e atende o "Abrir no painel" da árvore
 * (pedido de foco guardado, só da mesma chave e dentro do prazo).
 *
 * No fim, de ponta a ponta: a `PonteLateral` de verdade com abas do SEI
 * ligadas pelo `ligarLadoAba` (portas em memória) e o app montado pelo
 * `ligarApp` real (a mesma Colaboração e o mesmo "Entendi" do painel): trocar
 * de unidade (outra aba na frente, a mesma aba recarregada, outro login) não
 * grava no escopo antigo, fecha o diálogo aberto e nenhum pedido vai para a
 * aba de outra unidade.
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { CHAVE_CONTADOR_PROJETOS, TETO_CONTADOR_PROJETOS } from "@comum/painel/contadores";
import { ligarLadoAba, PonteLateral, type Remetente } from "@comum/ponte/lateral";
import { parDePortas } from "@comum/ponte/parDePortas";
import type { PortaRpc, Rpc } from "@comum/ponte/rpc";
import { definirEmissorDeAviso } from "@comum/ui/aviso";
import { type AbrirModal, criarAbrirModal } from "@comum/ui/dialogo";
import { h } from "@comum/ui/dom";
import { instalarChromeStorage } from "../../sei-comum/tests/chromeFalso";
import { AppProjetos } from "../src/app/app";
import type { ArquivoLigado } from "../src/app/colaboracao/colaboracao";
import { criarAppDoLateral, gravadorDoContador, modaisDaVez } from "../src/app/lateral/criar";
import { type AppDoLateral, MontagemLateral, type PonteDoLateral } from "../src/app/lateral/montagem";
import { CHAVE_CONTADOR_PAINEL, CHAVE_LATERAL, CHAVE_PREFERENCIAS, LIMITES, TETO_CONTADOR_PAINEL } from "../src/modelo/constantes";
import { baseDoEscopo, escoposDaUnidade } from "../src/modelo/escopo";
import { CHAVE_FOCO, type ContextoProjetos, chaveDaAba, lerPedidoDeFoco, VALIDADE_FOCO } from "../src/ponte/tipos";
import { itemDoMenu, itensDoMenu, opcoesDoCombo, telaDoApp, texto } from "./apoioApp";
import { novoRepo } from "./apoioRepositorio";
import { HOJE } from "./fabrica";
import { botao, checar, lanca, secao, tique } from "./util";

const ctx = (unidade: string | null, host = "sei.x.gov.br", login = "Ana"): ContextoProjetos => ({
  host,
  login,
  nome: "Ana Lima",
  unidade: unidade ? { id: unidade, sigla: `U${unidade}`, nome: "" } : null,
  versao: "4.1.5",
  temaEscuro: false,
  atividades: false,
});

/** Uma aba do SEI na ponte: a chave e o RPC que responde o contexto (e anota os pedidos). */
function aba(c: ContextoProjetos, pedidos: string[], chave = chaveDaAba(c)) {
  const rpc: Pick<Rpc, "chamar"> = {
    chamar: async <T>(op: string) => {
      pedidos.push(`${chave}:${op}`);
      return (op === "contexto" ? c : true) as T;
    },
  };
  return { chave, rpc };
}

function cenario(
  o: {
    area?: Area;
    criar?: (c: ContextoProjetos, rpc: Pick<Rpc, "chamar">) => Promise<void>;
    /** Quantos diálogos o app de cada chave tinha abertos ao desmontar. */
    abertos?: Record<string, number>;
    /** A carência quando a aba some (padrão 0: resolve no próximo tique, como as provas do brief esperam). */
    carenciaMs?: number;
  } = {},
) {
  const doc = telaDoApp();
  const raiz = doc.getElementById("app")!;
  const area = o.area ?? areaMemoria();
  const ouvintes = new Set<() => void>();
  const abas: Array<ReturnType<typeof aba>> = [];
  let frente: ReturnType<typeof aba> | null = null;
  const ponte: PonteDoLateral = {
    atual: () => frente,
    daChave: (c) => abas.find((a) => a.chave === c) ?? null,
    aoMudar: (cb) => {
      ouvintes.add(cb);
      return () => ouvintes.delete(cb);
    },
  };
  const criados: string[] = [];
  const destruidos: string[] = [];
  const focos: string[] = [];
  const rpcs: Array<Pick<Rpc, "chamar">> = [];
  const montagem = new MontagemLateral({
    raiz,
    ponte,
    area,
    agora: () => 10_000,
    carenciaMs: o.carenciaMs ?? 0,
    criar: async (c, rpc): Promise<AppDoLateral> => {
      const k = chaveDaAba(c);
      rpcs.push(rpc);
      await o.criar?.(c, rpc);
      criados.push(k);
      raiz.replaceChildren(doc.createTextNode(`app ${k}`));
      return {
        focarProjeto: (id, etapa) => {
          focos.push(`${k}:${id}:${etapa ?? "-"}`);
          return true;
        },
        destruir: () => {
          destruidos.push(k);
          return o.abertos?.[k] ?? 0;
        },
      };
    },
  });
  const mudar = async (nova: ReturnType<typeof aba> | null) => {
    frente = nova;
    if (nova && !abas.includes(nova)) abas.push(nova);
    for (const o of [...ouvintes]) o();
    await tique(10);
  };
  return { raiz, area, montagem, mudar, abas, criados, destruidos, focos, rpcs };
}

const AGORA = new Date(2026, 9, 6, 15).getTime();

/**
 * O painel lateral de verdade: a `PonteLateral` (anúncio, aceitar portas desta janela, a aba da frente) e o app
 * montado pelo `criarAppDoLateral` (o `ligarApp` real, com o `<dialog>` de verdade). As abas do SEI conectam como o
 * content script (`ligarLadoAba`) e anotam cada pedido que recebem.
 */
function painelLateral(o: { carenciaMs?: number } = {}) {
  const doc = telaDoApp();
  definirEmissorDeAviso(null);
  const raiz = doc.getElementById("app")!;
  const area = areaMemoria();
  const sync = areaMemoria();
  const ouvintes: Array<(p: PortaRpc, r: Remetente) => void> = [];
  const ponte = new PonteLateral({
    area,
    chave: CHAVE_LATERAL,
    janela: 1,
    novoId: () => "lateral-1",
    ouvirConexoes: (cb) => void ouvintes.push(cb),
  });
  const relogio = { agora: AGORA };
  const montagem = new MontagemLateral({
    raiz,
    ponte,
    area,
    agora: () => AGORA,
    carenciaMs: o.carenciaMs ?? 60,
    criar: criarAppDoLateral({
      raiz,
      area,
      sync,
      abrirModal: criarAbrirModal(),
      baixar: () => undefined,
      escolherArquivo: async () => null,
      hoje: () => HOJE,
      agora: () => ++relogio.agora,
      dispositivo: "pc-lateral",
      copias: null,
      arquivo: () => null,
    }),
  });
  const pedidos: string[] = [];
  /** Uma aba do SEI desta janela: conecta ao ver o anúncio e se apresenta com a chave do contexto. */
  const abrirAba = (id: number, c: ContextoProjetos, foco: number, caixa: unknown[] = []) => {
    const rotulo = `aba${id}:${chaveDaAba(c)}`;
    const responde = (op: string, valor: unknown) => () => {
      pedidos.push(`${rotulo}:${op}`);
      return valor;
    };
    const lado = ligarLadoAba({
      area,
      chave: CHAVE_LATERAL,
      conectar: () => {
        const [daAba, doApp] = parDePortas();
        for (const o of ouvintes) o(doApp, { tab: { id, windowId: 1 }, frameId: 0 });
        return daAba;
      },
      tratadores: {
        contexto: responde("contexto", c),
        processosDaCaixa: responde("processosDaCaixa", caixa),
        usuariosDaUnidade: responde("usuariosDaUnidade", []),
        focarNoPainel: responde("focarNoPainel", "rolou"),
      },
      estado: () => ({ visivel: true, foco, chave: chaveDaAba(c) }),
    });
    return { rotulo, fechar: () => lado.parar() };
  };
  /** Tudo o que o storage tem nos dois escopos da unidade (para provar que nada mudou). */
  const escopo = async (unidade: string, login = "ana") => {
    const bases = Object.values(escoposDaUnidade("sei.x.gov.br", login, unidade)).map(baseDoEscopo);
    const tudo = await area.obter(null);
    return JSON.stringify(
      Object.keys(tudo)
        .filter((k) => bases.some((b) => k.startsWith(b)))
        .sort()
        .map((k) => [k, tudo[k]]),
    );
  };
  return { doc, raiz, area, sync, ponte, montagem, pedidos, abrirAba, escopo };
}

/**
 * A ponte real (`PonteLateral` + `ligarLadoAba`) com um app falso que anota montar e desmontar: o caminho comum do SEI,
 * que recarrega a MESMA aba a cada navegação (a porta cai e a página nova conecta de novo).
 */
function ponteReal(o: { carenciaMs: number; abertos?: Record<string, number> }) {
  const doc = telaDoApp();
  definirEmissorDeAviso(null);
  const raiz = doc.getElementById("app")!;
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
  const rpcs: Array<Pick<Rpc, "chamar">> = [];
  const pedidos: string[] = [];
  const montagem = new MontagemLateral({
    raiz,
    ponte,
    area,
    agora: () => 1,
    carenciaMs: o.carenciaMs,
    criar: async (c, rpc) => {
      const k = c.unidade?.id ?? "";
      eventos.push(`monta ${k}`);
      rpcs.push(rpc);
      raiz.replaceChildren(doc.createTextNode(`app ${k}`));
      return {
        focarProjeto: () => true,
        aoVoltarAba: () => void voltas.push(k),
        destruir: () => {
          eventos.push(`desmonta ${k}`);
          return o.abertos?.[k] ?? 0;
        },
      };
    },
  });
  const abrirAba = (id: number, c: ContextoProjetos) => {
    const rotulo = `aba${id}:${c.unidade?.id}`;
    const lado = ligarLadoAba({
      area,
      chave: CHAVE_LATERAL,
      conectar: () => {
        const [daAba, doApp] = parDePortas();
        for (const x of ouvintes) x(doApp, { tab: { id, windowId: 1 }, frameId: 0 });
        return daAba;
      },
      tratadores: {
        contexto: () => {
          pedidos.push(`${rotulo}:contexto`);
          return c;
        },
        processosDaCaixa: () => {
          pedidos.push(`${rotulo}:processosDaCaixa`);
          return [];
        },
      },
      estado: () => ({ visivel: true, foco: id, chave: chaveDaAba(c) }),
    });
    return { fechar: () => lado.parar() };
  };
  const avisos = () => [...doc.querySelectorAll(".spro-aviso")].map((x) => texto(x));
  const iniciar = async () => {
    montagem.iniciar();
    await ponte.iniciar();
  };
  const encerrar = async () => {
    montagem.parar();
    await ponte.encerrar();
  };
  return { raiz, montagem, eventos, voltas, rpcs, pedidos, abrirAba, avisos, iniciar, encerrar };
}

/** As ações do cartão da agenda (o clique no cartão alterna). */
function acoes(raiz: HTMLElement, etapa: string): HTMLElement | null {
  const c = raiz.querySelector<HTMLElement>(`.prj-lat-cartao[data-etapa='${etapa}']`);
  if (c && !c.querySelector(".prj-lat-acoes")) c.querySelector<HTMLElement>(".prj-lat-alternar")?.click();
  return raiz.querySelector<HTMLElement>(`.prj-lat-cartao[data-etapa='${etapa}'] .prj-lat-acoes`);
}

export async function verificarAppLateralPonte(): Promise<void> {
  secao("lateral: chave da aba e pedido de foco");
  checar("chave com a unidade, login em minusculas", chaveDaAba(ctx("110")) === "sei.x.gov.br|ana|u:110");
  checar("sem unidade: vazia (nao monta)", chaveDaAba(ctx(null)) === "");
  const ok = { alvo: "lateral", chave: "k", projeto: "p1", etapa: "e1", ate: 20 };
  const lido = lerPedidoDeFoco(ok, "lateral", "k", 10);
  checar("pedido valido", lido?.projeto === "p1" && lido.etapa === "e1" && lido.chave === "k" && lido.ate === 20, lido);
  checar(
    "pedido de outro alvo, outra chave, vencido ou torto: nada",
    lerPedidoDeFoco(ok, "painel", "k", 10) === null &&
      lerPedidoDeFoco(ok, "lateral", "outra", 10) === null &&
      lerPedidoDeFoco(ok, "lateral", "k", 21) === null &&
      lerPedidoDeFoco({ ...ok, projeto: 7 }, "lateral", "k", 10) === null &&
      lerPedidoDeFoco({ ...ok, projeto: "x".repeat(201) }, "lateral", "k", 10) === null &&
      lerPedidoDeFoco(null, "lateral", "k", 10) === null,
  );
  checar("etapa torta vira so o projeto", lerPedidoDeFoco({ ...ok, etapa: 3 }, "lateral", "k", 10)?.etapa === undefined);
  checar(
    "o pedido vale 1 minuto: prazo alem disso (relogio torto ou forjado) e recusado",
    VALIDADE_FOCO === 60_000 &&
      lerPedidoDeFoco({ ...ok, ate: 10 + VALIDADE_FOCO }, "lateral", "k", 10)?.ate === 10 + VALIDADE_FOCO &&
      lerPedidoDeFoco({ ...ok, ate: 11 + VALIDADE_FOCO }, "lateral", "k", 10) === null,
  );
  checar(
    "forma: lista, texto, prazo infinito ou NaN, projeto vazio, chave vazia: nada",
    lerPedidoDeFoco([ok], "lateral", "k", 10) === null &&
      lerPedidoDeFoco(JSON.stringify(ok), "lateral", "k", 10) === null &&
      lerPedidoDeFoco({ ...ok, ate: Number.POSITIVE_INFINITY }, "lateral", "k", 10) === null &&
      lerPedidoDeFoco({ ...ok, ate: Number.NaN }, "lateral", "k", 10) === null &&
      lerPedidoDeFoco({ ...ok, ate: "20" }, "lateral", "k", 10) === null &&
      lerPedidoDeFoco({ ...ok, projeto: "" }, "lateral", "k", 10) === null &&
      lerPedidoDeFoco({ ...ok, chave: "" }, "lateral", "", 10) === null,
  );
  checar(
    "o pedido lido so leva os campos conhecidos",
    JSON.stringify(lerPedidoDeFoco({ ...ok, extra: "<img src=x onerror=alert(1)>" }, "lateral", "k", 10)) ===
      JSON.stringify({ alvo: "lateral", chave: "k", projeto: "p1", ate: 20, etapa: "e1" }),
  );
  checar(
    "chave: login com espacos e maiusculas, e o host entra (dois SEIs com a mesma unidade)",
    chaveDaAba(ctx("110", "sei.x.gov.br", "  ANA ")) === "sei.x.gov.br|ana|u:110" &&
      chaveDaAba(ctx("110", "sei.y.gov.br")) !== chaveDaAba(ctx("110")),
  );

  secao("lateral: monta pela aba da frente e remonta ao trocar de unidade");
  const c = cenario();
  c.montagem.iniciar();
  checar("antes da primeira aba: procurando", texto(c.raiz).includes("Procurando o SEI"));
  await c.montagem.reagir();
  checar("sem aba do SEI: o aviso", texto(c.raiz).includes("Abra o SEI nesta janela para ver seus projetos"));
  const pedidos: string[] = [];
  const a110 = aba(ctx("110"), pedidos);
  await c.mudar(a110);
  checar(
    "aba da unidade 110: le o contexto e monta",
    c.criados.join() === "sei.x.gov.br|ana|u:110" && pedidos.includes(`${a110.chave}:contexto`),
  );
  const outra110 = aba(ctx("110"), pedidos);
  await c.mudar(outra110);
  checar("outra aba da mesma unidade: nao remonta", c.criados.length === 1 && !c.destruidos.length);
  const a220 = aba(ctx("220"), pedidos);
  await c.mudar(a220);
  checar(
    "trocou de unidade: desmonta a 110 e monta a 220",
    c.destruidos.join() === "sei.x.gov.br|ana|u:110" && c.criados.at(-1) === "sei.x.gov.br|ana|u:220",
    { criados: c.criados, destruidos: c.destruidos },
  );
  pedidos.length = 0;
  // O RPC que o app da 220 recebeu (a montagem não expõe outro).
  const rpcDa220 = c.rpcs.at(-1)!;
  await rpcDa220.chamar("processosDaCaixa");
  checar("o RPC vai para a aba da unidade montada", pedidos.join() === `${a220.chave}:processosDaCaixa`, pedidos);
  // A aba da 220 some da ponte (fechada): o pedido não pode ir para a da 110 que ficou aberta.
  c.abas.splice(c.abas.indexOf(a220), 1);
  const erro = await lanca(() => rpcDa220.chamar("processosDaCaixa"));
  checar(
    "sem aba da unidade montada: recusa (nunca manda para outra unidade)",
    erro?.codigo === "SEM_ABA" && !pedidos.some((x) => x.startsWith(a110.chave)),
    erro,
  );
  pedidos.length = 0;
  const semUnidade = aba(ctx(null), pedidos);
  await c.mudar(semUnidade);
  checar(
    "aba sem unidade (sem chave): o aviso de sem aba, sem app e sem pedir o contexto",
    texto(c.raiz).includes("Abra o SEI nesta janela para ver seus projetos") && c.criados.length === 2 && !pedidos.length,
    { texto: texto(c.raiz), pedidos },
  );
  checar("a montagem nao tem RPC publico (so o de cada app)", !("rpc" in c.montagem));

  secao("lateral: contexto que chega de outra aba nao monta");
  const t = cenario();
  t.montagem.iniciar();
  const enganada = aba(ctx("330"), [], "sei.x.gov.br|ana|u:999");
  await t.mudar(enganada);
  checar(
    "chave apresentada difere do contexto: nao monta e mostra o aviso de sem aba (nao fica em branco)",
    t.criados.length === 0 && texto(t.raiz).includes("Abra o SEI nesta janela para ver seus projetos"),
    texto(t.raiz),
  );

  secao("lateral: Abrir no painel vindo da arvore (pedido de foco)");
  const f = cenario();
  f.montagem.iniciar();
  const k = chaveDaAba(ctx("110"));
  await f.area.gravar({ [CHAVE_FOCO]: { alvo: "lateral", chave: k, projeto: "p1", etapa: "e9", ate: 20_000 } });
  await f.mudar(aba(ctx("110"), []));
  checar("pedido guardado antes de montar: atendido ao montar", f.focos.join() === `${k}:p1:e9`, f.focos);
  checar(
    "fica guardado ate vencer (o lateral de outra janela da mesma chave tambem o atende)",
    CHAVE_FOCO in (await f.area.obter(CHAVE_FOCO)),
  );
  await f.area.gravar({ [CHAVE_FOCO]: { alvo: "lateral", chave: k, projeto: "p1", etapa: "e9", ate: 20_000 } });
  await tique(10);
  checar("o mesmo pedido de novo: esta montagem nao o atende outra vez", f.focos.join() === `${k}:p1:e9`, f.focos);
  await f.area.gravar({ [CHAVE_FOCO]: { alvo: "lateral", chave: k, projeto: "p2", ate: 20_000 } });
  await tique(10);
  checar("pedido com o lateral ja montado: atendido na hora", f.focos.at(-1) === `${k}:p2:-`, f.focos);
  await f.area.gravar({ [CHAVE_FOCO]: { alvo: "lateral", chave: "sei.x.gov.br|ana|u:220", projeto: "p3", ate: 20_000 } });
  await tique(10);
  checar("pedido de outra unidade: ignorado e guardado para ela", f.focos.length === 2 && CHAVE_FOCO in (await f.area.obter(CHAVE_FOCO)));
  await f.area.gravar({ [CHAVE_FOCO]: { alvo: "lateral", chave: k, projeto: "p4", ate: 5_000 } });
  await tique(10);
  checar("pedido vencido: ignorado", f.focos.length === 2);
  checar("e o vencido da propria chave sai ao ler (nao fica no storage)", !(CHAVE_FOCO in (await f.area.obter(CHAVE_FOCO))));
  await f.area.gravar({ [CHAVE_FOCO]: { alvo: "lateral", chave: "sei.x.gov.br|ana|u:220", projeto: "p5", ate: 5_000 } });
  await tique(10);
  checar("o vencido de outra chave fica (e dela)", f.focos.length === 2 && CHAVE_FOCO in (await f.area.obter(CHAVE_FOCO)));
  f.montagem.parar();
  checar("parar desmonta", f.destruidos.join() === k);

  secao("lateral: dois laterais na mesma chave (duas janelas) e o pedido de foco");
  const areaDois = areaMemoria();
  const ja = cenario({ area: areaDois });
  ja.montagem.iniciar();
  await ja.mudar(aba(ctx("110"), []));
  // O clique foi na árvore da OUTRA janela: o lateral de lá ainda vai montar; o desta já está aberto.
  await areaDois.gravar({ [CHAVE_FOCO]: { alvo: "lateral", chave: k, projeto: "p8", ate: 20_000 } });
  await tique(10);
  const segundo = cenario({ area: areaDois });
  segundo.montagem.iniciar();
  await segundo.mudar(aba(ctx("110"), []));
  checar(
    "o ja aberto atende e nao apaga: o que monta depois (o da janela do clique) tambem abre o projeto",
    ja.focos.join() === `${k}:p8:-` && segundo.focos.join() === `${k}:p8:-`,
    { ja: ja.focos, segundo: segundo.focos },
  );
  await areaDois.gravar({ [CHAVE_FOCO]: { alvo: "lateral", chave: k, projeto: "p8", ate: 20_000 } });
  await tique(10);
  checar("cada um atende uma vez so", ja.focos.length === 1 && segundo.focos.length === 1, { ja: ja.focos, segundo: segundo.focos });
  await areaDois.gravar({ [CHAVE_FOCO]: { alvo: "lateral", chave: k, projeto: "p9", ate: 20_001 } });
  await tique(10);
  checar("um pedido novo (outro clique): os dois atendem", ja.focos.at(-1) === `${k}:p9:-` && segundo.focos.at(-1) === `${k}:p9:-`);
  ja.montagem.parar();
  segundo.montagem.parar();

  secao("lateral: pedido de foco pelo chrome.storage de verdade (formato do Chrome, areaChrome)");
  const chromeFoco = instalarChromeStorage();
  try {
    const fc = cenario({ area: chromeFoco.local });
    fc.montagem.iniciar();
    await fc.mudar(aba(ctx("110"), []));
    await chromeFoco.local.gravar({ [CHAVE_FOCO]: { alvo: "lateral", chave: k, projeto: "p7", etapa: "e7", ate: 20_000 } });
    await tique(20);
    checar("com o lateral ja montado: atendido", fc.focos.join() === `${k}:p7:e7`, fc.focos);
    checar("e guardado ate vencer", CHAVE_FOCO in (await chromeFoco.local.obter(CHAVE_FOCO)));
    fc.montagem.parar();
  } finally {
    chromeFoco.restaurar();
  }

  secao("lateral: o que a troca fechou vira UM aviso depois de montar a unidade nova");
  definirEmissorDeAviso(null);
  const av = cenario({ abertos: { "sei.x.gov.br|ana|u:110": 2 } });
  const avisoNaTela = () => [...document.querySelectorAll(".spro-aviso")].map((x) => texto(x));
  av.montagem.iniciar();
  await av.mudar(aba(ctx("110"), []));
  await av.mudar(aba(ctx("220"), []));
  checar(
    "com dialogo aberto na 110: o aviso, um so, depois de montar a 220",
    JSON.stringify(avisoNaTela()) === JSON.stringify(["Você mudou para a U220. O que estava aberto na U110 foi fechado sem gravar."]) &&
      av.criados.at(-1) === "sei.x.gov.br|ana|u:220",
    avisoNaTela(),
  );
  for (const x of document.querySelectorAll(".spro-aviso")) x.remove();
  await av.mudar(aba(ctx("330"), []));
  checar("sem nada aberto na 220: nenhum aviso", avisoNaTela().length === 0, avisoNaTela());
  av.montagem.parar();
  const avLogin = cenario({ abertos: { "sei.x.gov.br|ana|u:110": 1 } });
  avLogin.montagem.iniciar();
  await avLogin.mudar(aba(ctx("110"), []));
  await avLogin.mudar(aba(ctx("110", "sei.x.gov.br", "bruno"), []));
  checar(
    "mesma sigla (outro usuario): o aviso sem 'mudou para a mesma'",
    JSON.stringify(avisoNaTela()) === JSON.stringify(["O SEI desta janela mudou. O que estava aberto na U110 foi fechado sem gravar."]),
    avisoNaTela(),
  );
  for (const x of document.querySelectorAll(".spro-aviso")) x.remove();
  avLogin.montagem.parar();
  const avSem = cenario({ abertos: { "sei.x.gov.br|ana|u:110": 1 } });
  avSem.montagem.iniciar();
  await avSem.mudar(aba(ctx("110"), []));
  await avSem.mudar(null);
  checar(
    "dialogo aberto e nenhuma aba depois (fim da carencia): so o aviso de sem aba no painel, sem toast",
    avisoNaTela().length === 0 &&
      texto(avSem.raiz).includes("Abra o SEI nesta janela") &&
      avSem.destruidos.join() === "sei.x.gov.br|ana|u:110",
    avisoNaTela(),
  );
  avSem.montagem.parar();

  secao("lateral: troca de login (mesma unidade) remonta");
  const lg = cenario();
  lg.montagem.iniciar();
  await lg.mudar(aba(ctx("110"), []));
  await lg.mudar(aba(ctx("110", "sei.x.gov.br", "bruno"), []));
  checar(
    "outro usuario na mesma unidade: desmonta o da Ana e monta o do Bruno",
    lg.destruidos.join() === "sei.x.gov.br|ana|u:110" && lg.criados.join() === "sei.x.gov.br|ana|u:110,sei.x.gov.br|bruno|u:110",
    { criados: lg.criados, destruidos: lg.destruidos },
  );
  await lg.mudar(aba(ctx("110", "sei.y.gov.br"), []));
  checar("a mesma unidade em outro SEI: remonta tambem", lg.criados.at(-1) === "sei.y.gov.br|ana|u:110", lg.criados);
  lg.montagem.parar();

  secao("lateral: o RPC de cada montagem fica com a unidade dela");
  const rp: string[] = [];
  const r = cenario();
  r.montagem.iniciar();
  const r110 = aba(ctx("110"), rp);
  await r.mudar(r110);
  const rpc110 = r.rpcs[0]!;
  await rpc110.chamar("processosDaCaixa");
  checar("o app da 110 montado fala com a aba da 110", rp.at(-1) === `${r110.chave}:processosDaCaixa`, rp);
  const r220 = aba(ctx("220"), rp);
  await r.mudar(r220);
  rp.length = 0;
  // Um pedido atrasado do app da 110 (já desmontado), com a 220 montada e as duas abas abertas.
  const velho = await lanca(() => rpc110.chamar("abrirProcesso", { protocolo: "1" }));
  checar(
    "o RPC do app da 110 desmontado (pedido atrasado): recusa, nada vai a aba nenhuma",
    velho?.codigo === "SEM_ABA" && rp.length === 0 && r.criados.length === 2,
    { velho, rp },
  );
  // A aba da 220 fecha e só sobra a da 110 (a ponte ainda não reagiu): o app da 220 não fala com a 110.
  r.abas.splice(r.abas.indexOf(r220), 1);
  const rpc220 = r.rpcs[1]!;
  const fechada = await lanca(() => rpc220.chamar("focarNoPainel", { id: "p" }));
  checar("aba da 220 fechou e sobrou a da 110: o app da 220 recusa", fechada?.codigo === "SEM_ABA" && rp.length === 0, { fechada, rp });
  r.montagem.parar();
  const parado = await lanca(() => rpc220.chamar("focarNoPainel", { id: "p" }));
  r.abas.push(r220);
  const depois = await lanca(() => rpc220.chamar("focarNoPainel", { id: "p" }));
  checar(
    "depois de parar: recusa, mesmo com a aba de volta",
    parado?.codigo === "SEM_ABA" && depois?.codigo === "SEM_ABA" && rp.length === 0,
  );
  const rm: string[] = [];
  const m = cenario({
    // O app pede à aba enquanto monta (antes de a montagem terminar): vai para a aba da unidade que monta.
    criar: async (_c, rpc) => void (await rpc.chamar("usuariosDaUnidade")),
  });
  m.montagem.iniciar();
  const m110 = aba(ctx("110"), rm);
  await m.mudar(m110);
  checar(
    "pedido feito durante a montagem: para a aba da unidade montando (e monta)",
    rm.join() === `${m110.chave}:contexto,${m110.chave}:usuariosDaUnidade` && m.criados.length === 1,
    rm,
  );
  m.montagem.parar();

  secao("lateral: parar ou trocar no meio da montagem");
  let soltar: () => void = () => undefined;
  const lenta = cenario({ criar: () => new Promise<void>((ok) => (soltar = ok)) });
  lenta.montagem.iniciar();
  void lenta.mudar(aba(ctx("110"), []));
  await tique(5);
  lenta.montagem.parar();
  soltar();
  await tique(10);
  checar(
    "parou enquanto montava: o app que terminou de montar e desmontado",
    lenta.criados.join() === "sei.x.gov.br|ana|u:110" && lenta.destruidos.join() === "sei.x.gov.br|ana|u:110",
    { criados: lenta.criados, destruidos: lenta.destruidos },
  );
  const lenta2 = cenario({ criar: () => new Promise<void>((ok) => (soltar = ok)) });
  lenta2.montagem.iniciar();
  void lenta2.mudar(aba(ctx("110"), []));
  await tique(5);
  void lenta2.mudar(aba(ctx("220"), []));
  await tique(5);
  soltar();
  await tique(10);
  soltar();
  await tique(10);
  checar(
    "trocou de unidade enquanto montava: a 110 sai assim que monta e fica a 220",
    lenta2.destruidos.join() === "sei.x.gov.br|ana|u:110" && lenta2.criados.join() === "sei.x.gov.br|ana|u:110,sei.x.gov.br|ana|u:220",
    { criados: lenta2.criados, destruidos: lenta2.destruidos },
  );
  lenta2.montagem.parar();

  secao("lateral: falhas nao travam a montagem");
  const falha = cenario();
  falha.montagem.iniciar();
  const muda: Pick<Rpc, "chamar"> = { chamar: () => Promise.reject(new Error("A conexão com a aba do SEI caiu.")) };
  await falha.mudar({ chave: chaveDaAba(ctx("110")), rpc: muda });
  checar(
    "o contexto nao veio: a mensagem, sem app",
    texto(falha.raiz).includes("A conexão com a aba do SEI caiu") && !falha.criados.length,
  );
  await falha.mudar(aba(ctx("220"), []));
  checar("a proxima aba monta normalmente", falha.criados.join() === "sei.x.gov.br|ana|u:220", falha.criados);
  falha.montagem.parar();

  const areaRuim = areaMemoria();
  const obterBom = areaRuim.obter.bind(areaRuim);
  let quebrar = false;
  areaRuim.obter = async (chaves) => {
    if (quebrar) throw new Error("storage indisponível");
    return obterBom(chaves);
  };
  const ruim = cenario({ area: areaRuim });
  ruim.montagem.iniciar();
  quebrar = true;
  const avisoConsole = console.warn;
  const avisados: unknown[] = [];
  console.warn = (...x: unknown[]) => void avisados.push(x);
  await ruim.mudar(aba(ctx("110"), []));
  console.warn = avisoConsole;
  checar(
    "o pedido de foco nao le: o app monta e fica na tela (sem a mensagem de erro; so o console)",
    ruim.criados.length === 1 && texto(ruim.raiz) === "app sei.x.gov.br|ana|u:110" && avisados.length === 1,
    texto(ruim.raiz),
  );
  quebrar = false;
  await areaRuim.gravar({ [CHAVE_FOCO]: { alvo: "lateral", chave: chaveDaAba(ctx("110")), projeto: "p1", ate: 20_000 } });
  await tique(10);
  checar("e o pedido seguinte ainda e atendido", ruim.focos.join() === "sei.x.gov.br|ana|u:110:p1:-", ruim.focos);
  ruim.montagem.parar();

  secao("lateral: pedido de foco que chega durante a montagem");
  const dur = cenario({ criar: () => new Promise<void>((ok) => (soltar = ok)) });
  dur.montagem.iniciar();
  void dur.mudar(aba(ctx("110"), []));
  await tique(5);
  await dur.area.gravar({ [CHAVE_FOCO]: { alvo: "lateral", chave: chaveDaAba(ctx("110")), projeto: "p1", ate: 20_000 } });
  await tique(5);
  soltar();
  await tique(20);
  checar("atendido uma vez, quando o app ficou de pe", dur.focos.join() === "sei.x.gov.br|ana|u:110:p1:-", dur.focos);
  dur.montagem.parar();

  secao("lateral: contador da aba (projetos/contadorPainel)");
  const gravados: unknown[] = [];
  const areaC = areaMemoria();
  const gravarC = areaC.gravar.bind(areaC);
  areaC.gravar = async (itens) => {
    if (CHAVE_CONTADOR_PAINEL in itens) gravados.push(itens[CHAVE_CONTADOR_PAINEL]);
    return gravarC(itens);
  };
  const contar = gravadorDoContador(areaC);
  for (const n of [3, 3, 2.7, 2, -4, 0, 0, Number.NaN, Number.POSITIVE_INFINITY, 10 ** 9, 10 ** 9]) contar(n);
  await tique();
  checar(
    "so quando muda, inteiro, nao negativo e com teto (NaN e infinito nao gravam)",
    JSON.stringify(gravados) === JSON.stringify([3, 2, 0, TETO_CONTADOR_PAINEL]),
    gravados,
  );
  checar(
    "chave e teto do contrato do sei-comum, e o teto e a conta dos LIMITES (2 escopos x projetos ativos x etapas)",
    TETO_CONTADOR_PAINEL === TETO_CONTADOR_PROJETOS &&
      CHAVE_CONTADOR_PAINEL === CHAVE_CONTADOR_PROJETOS &&
      TETO_CONTADOR_PAINEL === 2 * LIMITES.projetosAtivos * LIMITES.etapasPorProjeto,
  );
  const outro = gravadorDoContador(areaC);
  outro(TETO_CONTADOR_PAINEL);
  await tique();
  checar("cada montagem grava a primeira contagem dela (a da unidade nova vale)", gravados.length === 5, gravados);
  const areaFalha = areaMemoria();
  let recusar = true;
  const tentativas: unknown[] = [];
  areaFalha.gravar = async (itens) => {
    tentativas.push(itens[CHAVE_CONTADOR_PAINEL]);
    if (recusar) throw new Error("cota");
  };
  const teimoso = gravadorDoContador(areaFalha);
  teimoso(4);
  await tique();
  recusar = false;
  teimoso(4);
  await tique();
  checar("gravacao recusada: a mesma contagem tenta de novo", JSON.stringify(tentativas) === "[4,4]", tentativas);

  secao("lateral: os dialogos de uma montagem fecham com ela");
  telaDoApp();
  const fechados: string[] = [];
  const base: AbrirModal = criarAbrirModal();
  const vez = modaisDaVez(base);
  vez.abrirModal({ titulo: "Um", conteudo: h("p", {}, "1"), aoFechar: () => void fechados.push("um") });
  const dois = vez.abrirModal({ titulo: "Dois", conteudo: h("p", {}, "2"), aoFechar: () => void fechados.push("dois") });
  dois.fechar();
  vez.abrirModal({ titulo: "Tres", conteudo: h("p", {}, "3"), aoFechar: () => void fechados.push("tres") });
  vez.fecharTodos();
  checar(
    "fecharTodos fecha os que ficaram abertos (cada um uma vez)",
    fechados.join() === "dois,um,tres" && !document.querySelector("dialog"),
    fechados,
  );
  let tarde = false;
  vez.abrirModal({
    titulo: "Tarde",
    conteudo: h("p", {}, "x"),
    aoFechar: () => {
      tarde = true;
    },
  });
  await tique();
  checar("depois de desmontar nao abre mais nada (e quem esperava a resposta recebe o fechar)", tarde && !document.querySelector("dialog"));

  secao("lateral: o app que nao abre nao deixa a colaboracao ligada");
  telaDoApp();
  const areaQ = areaMemoria();
  const obterQ = areaQ.obter.bind(areaQ);
  areaQ.obter = async (chaves) => {
    if (chaves === CHAVE_PREFERENCIAS) throw new Error("storage indisponível");
    return obterQ(chaves);
  };
  const arq = { parar: 0, agendar: 0 };
  const arquivoFalso = {
    status: async () => null,
    configurado: async () => true,
    escolher: async () => false,
    reconectar: async () => false,
    sincronizar: async () => undefined,
    esquecer: async () => undefined,
    agendar: () => void arq.agendar++,
    parar: () => void arq.parar++,
  } as unknown as ArquivoLigado;
  const quebrado = new MontagemLateral({
    raiz: document.getElementById("app")!,
    ponte: { atual: () => aba(ctx("110"), []), daChave: () => null, aoMudar: () => () => undefined },
    area: areaQ,
    agora: () => AGORA,
    criar: criarAppDoLateral({
      raiz: document.getElementById("app")!,
      area: areaQ,
      sync: areaMemoria(),
      abrirModal: criarAbrirModal(),
      baixar: () => undefined,
      escolherArquivo: async () => null,
      hoje: () => HOJE,
      agora: () => AGORA,
      dispositivo: "pc",
      copias: null,
      arquivo: () => arquivoFalso,
    }),
  });
  quebrado.iniciar();
  await quebrado.reagir();
  await tique(20);
  const { repo: solto } = novoRepo(escoposDaUnidade("sei.x.gov.br", "ana", "110").eu, areaQ, "z");
  await solto.criarProjeto({ nome: "Gravado por outra tela" });
  await tique(20);
  checar(
    "o app nao abriu (a mensagem): a colaboracao desligou o arquivo e nao ouve mais os repositorios",
    texto(document.getElementById("app")).includes("storage indisponível") && arq.parar === 1 && arq.agendar === 0,
    arq,
  );
  quebrado.parar();

  secao("lateral: carencia quando a aba some (o SEI recarrega a mesma aba a cada navegacao) - ponte real");
  const MUDOU = "Você mudou para a U220. O que estava aberto na U110 foi fechado sem gravar.";
  {
    // (a) recarga da mesma aba, mesma unidade, com diálogo aberto
    const r = ponteReal({ carenciaMs: 300, abertos: { "110": 1 } });
    await r.iniciar();
    const a1 = r.abrirAba(1, ctx("110"));
    await tique(40);
    a1.fechar();
    await tique(30);
    const semAbaNoMeio = await lanca(() => r.rpcs[0]!.chamar("processosDaCaixa"));
    checar(
      "a porta caiu (pagina recarregando): o app fica de pe e o RPC dele recusa sem aba",
      r.eventos.join() === "monta 110" && texto(r.raiz) === "app 110" && semAbaNoMeio?.codigo === "SEM_ABA",
      { eventos: r.eventos, tela: texto(r.raiz), semAbaNoMeio },
    );
    checar(
      "e diz que o SEI esta carregando (nao que a aba fechou)",
      semAbaNoMeio?.message === "O SEI está carregando a página; tente de novo em instantes.",
      semAbaNoMeio?.message,
    );
    r.abrirAba(1, ctx("110"));
    await tique(40);
    checar(
      "a mesma aba volta na mesma unidade: nada acontece (o dialogo continua aberto), sem aviso",
      r.eventos.join() === "monta 110" && texto(r.raiz) === "app 110" && r.avisos().length === 0,
      { eventos: r.eventos, avisos: r.avisos() },
    );
    checar("a volta da aba avisa o app (a caixa da pagina nova pode ser outra)", r.voltas.join() === "110", r.voltas);
    const voltou = await lanca(() => r.rpcs[0]!.chamar("processosDaCaixa"));
    checar(
      "o RPC do app passa a ir para a pagina nova da mesma chave",
      voltou === null && r.pedidos.at(-1) === "aba1:110:processosDaCaixa",
      { voltou, pedidos: r.pedidos },
    );
    await tique(350);
    checar("e a carencia acabou sem desmontar nada (foi cancelada pela volta)", r.eventos.join() === "monta 110", r.eventos);
    await r.encerrar();
  }
  {
    // (b) recarga trocando de unidade (110 -> 220) com diálogo aberto, dentro da carência
    const r = ponteReal({ carenciaMs: 300, abertos: { "110": 1 } });
    await r.iniciar();
    const a1 = r.abrirAba(1, ctx("110"));
    await tique(40);
    a1.fechar();
    await tique(30);
    r.abrirAba(1, ctx("220"));
    await tique(60);
    checar(
      "a mesma aba volta na 220: desmonta a 110, monta a 220 e o aviso aparece (um so, depois de montar)",
      r.eventos.join() === "monta 110,desmonta 110,monta 220" && JSON.stringify(r.avisos()) === JSON.stringify([MUDOU]),
      { eventos: r.eventos, avisos: r.avisos() },
    );
    await r.encerrar();
  }
  {
    // (b') a página nova demora mais que a carência
    const r = ponteReal({ carenciaMs: 50, abertos: { "110": 1 } });
    await r.iniciar();
    const a1 = r.abrirAba(1, ctx("110"));
    await tique(40);
    a1.fechar();
    await tique(120);
    checar(
      "a carencia acabou sem aba: desmonta e mostra o aviso de sem aba (sem toast ainda)",
      r.eventos.join() === "monta 110,desmonta 110" && texto(r.raiz).includes("Abra o SEI nesta janela") && r.avisos().length === 0,
      { eventos: r.eventos, tela: texto(r.raiz), avisos: r.avisos() },
    );
    r.abrirAba(1, ctx("220"));
    await tique(60);
    checar(
      "e quando a 220 chega: monta e o aviso guardado aparece depois de montar",
      r.eventos.join() === "monta 110,desmonta 110,monta 220" && JSON.stringify(r.avisos()) === JSON.stringify([MUDOU]),
      { eventos: r.eventos, avisos: r.avisos() },
    );
    await r.encerrar();
  }
  {
    // (c) aba fechada sem voltar
    const r = ponteReal({ carenciaMs: 80 });
    await r.iniciar();
    const a1 = r.abrirAba(1, ctx("110"));
    await tique(40);
    a1.fechar();
    await tique(30);
    const durante = texto(r.raiz);
    await tique(100);
    const depoisDaCarencia = await lanca(() => r.rpcs[0]!.chamar("processosDaCaixa"));
    checar(
      "depois da carencia o app saiu: o RPC dele recusa com a mensagem de aba fechada",
      depoisDaCarencia?.codigo === "SEM_ABA" && /não está mais aberta/.test(depoisDaCarencia.message ?? ""),
      depoisDaCarencia?.message,
    );
    checar(
      "aba fechada: o app fica durante a carencia; depois, o aviso de sem aba (e desmonta), sem toast",
      durante === "app 110" &&
        texto(r.raiz).includes("Abra o SEI nesta janela") &&
        r.eventos.join() === "monta 110,desmonta 110" &&
        !r.avisos().length,
      { durante, eventos: r.eventos },
    );
    await r.encerrar();
  }
  {
    // (d) troca com duas abas: a da 220 conecta antes de a da 110 fechar (como antes, sem esperar)
    const r = ponteReal({ carenciaMs: 300, abertos: { "110": 1 } });
    await r.iniciar();
    const a1 = r.abrirAba(1, ctx("110"));
    await tique(40);
    r.abrirAba(2, ctx("220"));
    await tique(30);
    a1.fechar();
    await tique(60);
    checar(
      "duas abas: monta a 220 na hora e o aviso aparece uma vez",
      r.eventos.join() === "monta 110,desmonta 110,monta 220" && JSON.stringify(r.avisos()) === JSON.stringify([MUDOU]),
      { eventos: r.eventos, avisos: r.avisos() },
    );
    await r.encerrar();
  }
  {
    // parar no meio da carência: desmonta uma vez e esquece o que guardava
    const r = ponteReal({ carenciaMs: 50, abertos: { "110": 1 } });
    await r.iniciar();
    const a1 = r.abrirAba(1, ctx("110"));
    await tique(40);
    a1.fechar();
    await tique(10);
    await r.encerrar();
    await tique(100);
    checar(
      "parar na carencia: desmonta uma vez, sem aviso e sem timer vivo",
      r.eventos.join() === "monta 110,desmonta 110" && !r.avisos().length,
      r.eventos,
    );
  }

  secao("lateral: higiene do timer da carencia (um por queda, nenhum depois da volta, das trocas e do parar)");
  {
    // Só os timers da carência (a duração dela, única nesta prova) entram na conta.
    const CAR = 237;
    const vivos = new Set<unknown>();
    const st = globalThis.setTimeout;
    const ct = globalThis.clearTimeout;
    const g = globalThis as unknown as { setTimeout: unknown; clearTimeout: unknown };
    g.setTimeout = (f: (...a: unknown[]) => void, ms?: number, ...resto: unknown[]) => {
      const t = st(() => {
        vivos.delete(t);
        f(...resto);
      }, ms);
      if (ms === CAR) vivos.add(t);
      return t;
    };
    g.clearTimeout = (t: ReturnType<typeof setTimeout>) => {
      vivos.delete(t);
      ct(t);
    };
    try {
      const r = ponteReal({ carenciaMs: CAR });
      await r.iniciar();
      let a = r.abrirAba(1, ctx("110"));
      await tique(40);
      a.fechar();
      await tique(30);
      const naQueda = vivos.size;
      a = r.abrirAba(1, ctx("110"));
      await tique(40);
      const aposVolta = vivos.size;
      await tique(100);
      // ~170 ms depois da 1a queda: cai de novo; a 2a carência conta do zero (o app fica até o fim dela).
      a.fechar();
      await tique(130);
      const noMeio2 = r.eventos.join();
      const timersNoMeio2 = vivos.size;
      await tique(200);
      checar(
        "volta e cai de novo: um timer por queda, zero na volta, e a 2a carencia conta do zero",
        naQueda === 1 && aposVolta === 0 && timersNoMeio2 === 1 && noMeio2 === "monta 110" && r.eventos.join() === "monta 110,desmonta 110",
        { naQueda, aposVolta, timersNoMeio2, noMeio2, eventos: r.eventos },
      );
      await r.encerrar();

      const t = ponteReal({ carenciaMs: CAR, abertos: { "110": 1, "220": 2 } });
      await t.iniciar();
      let b = t.abrirAba(1, ctx("110"));
      await tique(40);
      b.fechar();
      await tique(20);
      const t1 = vivos.size;
      b = t.abrirAba(1, ctx("220"));
      await tique(40);
      const t2 = vivos.size;
      const av1 = t.avisos();
      b.fechar();
      await tique(20);
      b = t.abrirAba(1, ctx("330"));
      await tique(40);
      const t3 = vivos.size;
      const av2 = t.avisos();
      b.fechar();
      await tique(20);
      const t4 = vivos.size;
      await t.encerrar();
      const t5 = vivos.size;
      await tique(300);
      checar(
        "trocas seguidas na carencia e parar: um timer por queda, zero depois de cada troca e do parar",
        t1 === 1 && t2 === 0 && t3 === 0 && t4 === 1 && t5 === 0,
        { t1, t2, t3, t4, t5 },
      );
      checar(
        "e um aviso por troca, com as siglas certas, e o parar no meio nao desmonta de novo",
        JSON.stringify(av1) === JSON.stringify([MUDOU]) &&
          JSON.stringify(av2) === JSON.stringify(["Você mudou para a U330. O que estava aberto na U220 foi fechado sem gravar."]) &&
          t.eventos.join() === "monta 110,desmonta 110,monta 220,desmonta 220,monta 330,desmonta 330",
        { av1, av2, eventos: t.eventos },
      );
    } finally {
      g.setTimeout = st;
      g.clearTimeout = ct;
    }
  }

  secao("lateral: concluir que termina depois de desmontar nao deixa aviso com acao");
  {
    const doc = telaDoApp();
    definirEmissorDeAviso(null);
    const area = areaMemoria();
    const { repo: eu } = novoRepo(escoposDaUnidade("sei.x.gov.br", "ana", "110").eu, area, "g");
    const { repo: un } = novoRepo(escoposDaUnidade("sei.x.gov.br", "ana", "110").unidade, area, "h");
    const pj = await eu.criarProjeto({ nome: "Lento" });
    const et = await eu.criarEtapa({ projeto: pj.id, nome: "Etapa lenta", inicio: "2026-09-01", fim: "2026-10-01" });
    let liberar: () => void = () => undefined;
    const concluirDeVerdade = eu.concluirEtapa.bind(eu);
    eu.concluirEtapa = async (...args: Parameters<typeof eu.concluirEtapa>) => {
      await new Promise<void>((ok) => {
        liberar = ok;
      });
      return concluirDeVerdade(...args);
    };
    const app = new AppProjetos({
      raiz: doc.getElementById("app")!,
      ctx: ctx("110"),
      area,
      repos: { unidade: un, eu },
      rpc: { chamar: async <T>() => [] as T },
      abrirModal: criarAbrirModal(),
      confirmar: async () => true,
      baixar: () => undefined,
      hoje: () => HOJE,
      agora: () => AGORA,
      modo: "lateral",
    });
    await app.iniciar();
    botao(acoes(doc.getElementById("app")!, et.id)!, "Concluir")!.click();
    await tique(10);
    doc.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"][aria-label="Ajustes dos projetos"]')?.click();
    const menuAberto = !!doc.querySelector(".spro-menu-pop");
    app.destruir();
    checar("o menu de ajustes aberto sai com o app (nada orfao no body)", menuAberto && !doc.querySelector(".spro-menu-pop"));
    liberar();
    await tique(20);
    checar(
      "a etapa conclui (a acao era da unidade dela), mas o app que saiu nao mostra o 'Desfazer'",
      (await eu.obterEtapa(et.id))?.concluidaEm === HOJE && !doc.querySelector(".spro-aviso"),
      [...doc.querySelectorAll(".spro-aviso")].map((x) => texto(x)),
    );
  }

  secao("lateral de ponta a ponta: ponte real, ligarApp e a troca de unidade");
  const p = painelLateral();
  const e110 = escoposDaUnidade("sei.x.gov.br", "ana", "110");
  const e220 = escoposDaUnidade("sei.x.gov.br", "ana", "220");
  const e330 = escoposDaUnidade("sei.x.gov.br", "ana", "330");
  const eBruno = escoposDaUnidade("sei.x.gov.br", "bruno", "330");
  const { repo: un110 } = novoRepo(e110.unidade, p.area, "a");
  const { repo: eu220 } = novoRepo(e220.eu, p.area, "b");
  const { repo: un330 } = novoRepo(e330.unidade, p.area, "c");
  const { repo: unBruno } = novoRepo(eBruno.unidade, p.area, "d");
  const p110 = await un110.criarProjeto({ nome: "Revisão 110" });
  const n110 = await un110.criarEtapa({ projeto: p110.id, nome: "Nota 110", inicio: "2026-09-01", fim: "2026-10-02" });
  const p220 = await eu220.criarProjeto({ nome: "Plano 220" });
  const n220 = await eu220.criarEtapa({ projeto: p220.id, nome: "Parecer 220", inicio: "2026-09-01", fim: "2026-10-01" });
  // Com etapa atrasada: aparecem na Agenda e em Projetos (o modo do lateral é preferência de todas as unidades).
  const p330 = await un330.criarProjeto({ nome: "Projeto da Ana na 330" });
  await un330.criarEtapa({ projeto: p330.id, nome: "Etapa da Ana", inicio: "2026-09-01", fim: "2026-10-01" });
  const pBruno = await unBruno.criarProjeto({ nome: "Projeto do Bruno na 330" });
  await unBruno.criarEtapa({ projeto: pBruno.id, nome: "Etapa do Bruno", inicio: "2026-09-01", fim: "2026-10-01" });
  p.montagem.iniciar();
  await p.ponte.iniciar();
  const aba1 = p.abrirAba(1, ctx("110"), 1);
  await tique(80);
  checar(
    "a aba da 110 se apresenta e o lateral mostra os projetos dela",
    texto(p.raiz).includes("Revisão 110") && texto(p.raiz).includes("U110") && !texto(p.raiz).includes("Plano 220"),
    texto(p.raiz),
  );
  const menu = itensDoMenu(p.raiz, "Ajustes dos projetos");
  checar(
    "o lateral segue o tema do sistema e nao imprime",
    p.doc.documentElement.dataset.tema === undefined &&
      menu.includes("Histórico de alterações") &&
      !menu.some((i) => i.includes("Imprimir")),
    menu,
  );
  checar("contador da aba: a atrasada da 110", (await p.area.obter(CHAVE_CONTADOR_PAINEL))[CHAVE_CONTADOR_PAINEL] === 1);
  const antes110 = await p.escopo("110");
  botao(acoes(p.raiz, n110.id)!, "Concluir")!.click();
  await tique(30);
  const entendi = p.doc.querySelector<HTMLElement>("dialog.spro-dialogo");
  checar("Concluir em 'Toda a unidade' na 110 pede o Entendi", entendi?.getAttribute("aria-label") === "Projetos de toda a unidade");
  // O usuário traz para a frente uma aba do SEI de outra unidade, com o diálogo aberto.
  const aba2 = p.abrirAba(2, ctx("220"), 2);
  await tique(80);
  checar(
    "outra aba na frente (unidade 220): remonta com os projetos da 220",
    texto(p.raiz).includes("Plano 220") && texto(p.raiz).includes("U220") && !texto(p.raiz).includes("Revisão 110"),
    texto(p.raiz),
  );
  checar("o Entendi da 110 fechou com a troca", !p.doc.querySelector("dialog"));
  await tique(20);
  const avisosP = () => [...p.doc.querySelectorAll(".spro-aviso")].map((x) => texto(x));
  checar(
    "sem o aviso do Entendi da 110 (cancelado em silencio); um aviso so: o da troca",
    JSON.stringify(avisosP()) === JSON.stringify(["Você mudou para a U220. O que estava aberto na U110 foi fechado sem gravar."]),
    avisosP(),
  );
  if (entendi) botao(entendi, "Entendi")?.click();
  await tique(30);
  checar(
    "nada foi gravado na 110 (nem com o Entendi clicado depois)",
    (await p.escopo("110")) === antes110 && !(await un110.obterEtapa(n110.id))?.concluidaEm,
  );
  checar("contador: o da 220", (await p.area.obter(CHAVE_CONTADOR_PAINEL))[CHAVE_CONTADOR_PAINEL] === 1);
  botao(acoes(p.raiz, n220.id)!, "Concluir")!.click();
  await tique(80);
  checar(
    "Concluir na 220 grava no escopo da 220 e o da 110 nao muda",
    (await eu220.obterEtapa(n220.id))?.concluidaEm === HOJE && (await p.escopo("110")) === antes110,
  );
  checar("contador: 0 depois de concluir na 220", (await p.area.obter(CHAVE_CONTADOR_PAINEL))[CHAVE_CONTADOR_PAINEL] === 0);
  checar("o aviso da conclusao tem o Desfazer", !!botao(p.doc.body, "Desfazer"));
  p.pedidos.length = 0;
  // A árvore pediu "Abrir no painel" para a 220: o lateral abre o projeto, e o "Abrir no painel" dele vai à aba da 220.
  await p.area.gravar({ [CHAVE_FOCO]: { alvo: "lateral", chave: chaveDaAba(ctx("220")), projeto: p220.id, ate: AGORA + 30_000 } });
  await tique(40);
  botao(p.raiz, "Abrir no painel")?.click();
  await tique(30);
  checar("o pedido do app da 220 vai so para a aba da 220", p.pedidos.join() === `${aba2.rotulo}:focarNoPainel`, p.pedidos);
  p.pedidos.length = 0;
  // O menu de ajustes da 220 fica aberto (camada flutuante no body) quando a aba da 220 fecha.
  p.raiz.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"][aria-label="Ajustes dos projetos"]')?.click();
  checar("menu de ajustes aberto antes da troca", !!p.doc.querySelector(".spro-menu-pop"));
  aba2.fechar();
  await tique(80);
  checar(
    "a troca leva os avisos da 220 (o Desfazer nao age na unidade montada depois) e o menu aberto",
    !p.doc.querySelector(".spro-aviso") && !botao(p.doc.body, "Desfazer") && !p.doc.querySelector(".spro-menu-pop"),
    { avisos: avisosP(), menu: !!p.doc.querySelector(".spro-menu-pop") },
  );
  checar(
    "a aba da 220 fechou e sobrou a da 110: o lateral volta para a 110",
    texto(p.raiz).includes("Revisão 110") && !texto(p.raiz).includes("Plano 220"),
    texto(p.raiz),
  );
  checar("a aba da 110 so recebeu o contexto da montagem dela", p.pedidos.join() === `${aba1.rotulo}:contexto`, p.pedidos);
  checar("e a 110 continua como estava", (await p.escopo("110")) === antes110);
  // O SEI troca de unidade recarregando a página: a mesma aba se reapresenta com outra chave.
  aba1.fechar();
  const aba1b = p.abrirAba(1, ctx("330"), 3);
  await tique(80);
  checar(
    "mesma aba recarregada na 330: remonta com os projetos da 330",
    texto(p.raiz).includes("Projeto da Ana na 330") && texto(p.raiz).includes("U330") && !texto(p.raiz).includes("Revisão 110"),
    texto(p.raiz),
  );
  aba1b.fechar();
  p.abrirAba(1, ctx("330", "sei.x.gov.br", "Bruno"), 4);
  await tique(80);
  checar(
    "outro login na mesma unidade: os projetos do Bruno, nao os da Ana",
    texto(p.raiz).includes("Projeto do Bruno na 330") && !texto(p.raiz).includes("Projeto da Ana na 330"),
    texto(p.raiz),
  );
  p.montagem.parar();
  await p.ponte.encerrar();

  secao("lateral de ponta a ponta: o SEI recarrega a mesma aba com o Entendi aberto (carencia, app real)");
  const q = painelLateral({ carenciaMs: 300 });
  const { repo: un110q } = novoRepo(escoposDaUnidade("sei.x.gov.br", "ana", "110").unidade, q.area, "q");
  const pq = await un110q.criarProjeto({ nome: "Revisão 110" });
  const nq = await un110q.criarEtapa({ projeto: pq.id, nome: "Nota 110", inicio: "2026-09-01", fim: "2026-10-02" });
  q.montagem.iniciar();
  await q.ponte.iniciar();
  const q1 = q.abrirAba(1, ctx("110"), 1);
  await tique(80);
  botao(acoes(q.raiz, nq.id)!, "Concluir")!.click();
  await tique(30);
  const entendiQ = q.doc.querySelector<HTMLElement>("dialog.spro-dialogo");
  checar("o Entendi da 110 aberto", entendiQ?.getAttribute("aria-label") === "Projetos de toda a unidade");
  q1.fechar();
  await tique(30);
  const q1b = q.abrirAba(1, ctx("110"), 2);
  await tique(80);
  checar(
    "o SEI recarregou a mesma aba na mesma unidade: o Entendi continua aberto (nada remontou)",
    !!entendiQ?.isConnected && entendiQ.hasAttribute("open") && q.pedidos.filter((x) => x.endsWith(":contexto")).length === 1,
    q.pedidos,
  );
  botao(entendiQ!, "Entendi")!.click();
  await tique(80);
  checar("o Entendi grava na 110 (a mesma unidade)", (await un110q.obterEtapa(nq.id))?.concluidaEm === HOJE);
  for (const x of q.doc.querySelectorAll(".spro-aviso")) x.remove();
  itemDoMenu(q.raiz, "Ajustes dos projetos", "Histórico de alterações");
  await tique(40);
  const historicoQ = q.doc.querySelector<HTMLElement>("dialog.spro-dialogo");
  checar("o Historico de alteracoes aberto (um dialogo)", !!historicoQ?.hasAttribute("open"));
  q1b.fechar();
  await tique(30);
  q.abrirAba(1, ctx("220"), 3);
  await tique(100);
  const avisosQ = [...q.doc.querySelectorAll(".spro-aviso")].map((x) => texto(x));
  checar(
    "o SEI recarregou a mesma aba na 220: o dialogo da 110 fechou e o aviso da troca aparece, um so",
    !q.doc.querySelector("dialog") && texto(q.raiz).includes("U220") && JSON.stringify(avisosQ) === JSON.stringify([MUDOU]),
    avisosQ,
  );
  q.montagem.parar();
  await q.ponte.encerrar();

  secao("lateral de ponta a ponta: a recarga da mesma chave traz a caixa nova para o proximo dialogo (app real)");
  const P1 = "50300.000001/2026-11";
  const w = painelLateral({ carenciaMs: 300 });
  w.montagem.iniciar();
  await w.ponte.iniciar();
  // A aba está na árvore de um processo: a caixa não está na tela (nenhum processo).
  const w1 = w.abrirAba(1, ctx("110"), 1, []);
  await tique(80);
  const formProjeto = () => w.doc.querySelector<HTMLElement>(".prj-form-projeto");
  w.raiz.querySelector<HTMLElement>("button[aria-label='Novo projeto']")!.click();
  await tique(30);
  const antesW = opcoesDoCombo(formProjeto()!, "Processo SEI");
  botao(w.doc.querySelector("dialog.spro-dialogo")!, "Fechar")!.click();
  await tique(20);
  // O usuário volta ao Controle de Processos: o SEI recarrega a mesma aba, agora com o processo na caixa.
  w1.fechar();
  await tique(30);
  w.abrirAba(1, ctx("110"), 2, [{ protocolo: P1, idProcedimento: "1", sigiloso: false }]);
  await tique(80);
  w.raiz.querySelector<HTMLElement>("button[aria-label='Novo projeto']")!.click();
  await tique(30);
  const depoisW = opcoesDoCombo(formProjeto()!, "Processo SEI");
  checar(
    "antes nao havia processo; depois da recarga o Novo projeto oferece o processo da caixa nova",
    !antesW.includes(P1) && depoisW.includes(P1) && w.pedidos.filter((x) => x.endsWith(":processosDaCaixa")).length === 2,
    { antesW, depoisW, pedidos: w.pedidos },
  );
  w.montagem.parar();
  await w.ponte.encerrar();
}
