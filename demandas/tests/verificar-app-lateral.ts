/**
 * A aba Demandas do painel lateral: a Agenda (grupos, ordem, vazio, "Nova demanda"), a montagem por chave (trocar de
 * unidade remonta e nunca grava na antiga), o app do lateral (selo, clique abre no painel da aba), o pedido da aba ao app
 * (`focarDemanda`) e o lado da aba (`focarNoPainel`: rolar ate o painel ou ir ao Controle de Processos).
 */

import { areaMemoria } from "@comum/armazenamento/area";
import { CHAVE_CONTADOR_DEMANDAS } from "@comum/painel/contadores";
import { ErroRpc, type Rpc } from "@comum/ponte/rpc";
import { criarAbrirModal } from "@comum/ui/dialogo";
import { naTela } from "../src/app/dados";
import { gruposDaAgenda, montarAgenda } from "../src/app/lateral/agenda";
import { criarAppDoLateral, modaisDaVez } from "../src/app/lateral/criar";
import { type AppDoLateral, MontagemLateral, type PonteDoLateral } from "../src/app/lateral/montagem";
import { pedidosDaAba } from "../src/app/pedidos";
import { escoposDaUnidade } from "../src/modelo/escopo";
import { atenderPedidoDoLateral, focarNoPainelDaAba, focoDaAba, irAoPainel, type PainelDaAba } from "../src/pagina/foco";
import { CHAVE_FOCO, type ContextoDemandas, chaveDaAba, lerPedidoDeFoco, VALIDADE_FOCO } from "../src/ponte/tipos";
import { RepositorioDemandas } from "../src/repositorio";
import { appDeTeste, telaDoApp, texto } from "./apoioApp";
import { T0 } from "./apoioRepositorio";
import { demanda, HOJE } from "./fabrica";
import { checar, lanca, secao, tique } from "./util";

const ana = { login: "ana", nome: "Ana Lima" };
const carla = { login: "carla", nome: "Carla Dias" };
const item = (m: Parameters<typeof demanda>[0], vis: "unidade" | "eu" = "unidade") => naTela(demanda(m), vis, HOJE);

const CTX: ContextoDemandas = {
  host: "sei.exemplo.gov.br",
  login: "ana",
  nome: "Ana Lima",
  unidade: { id: "110000001", sigla: "SUPAC", nome: "Superintendencia" },
  versao: "5.0",
  temaEscuro: false,
};

export async function verificarAppLateral(): Promise<void> {
  secao("lateral: a Agenda (grupos e ordem)");
  const lista = [
    item({ id: "a1", titulo: "Atrasada recente", responsavel: ana, prazo: "2026-10-10" }),
    item({ id: "a2", titulo: "Atrasada velha", responsavel: ana, prazo: "2026-10-01" }),
    item({ id: "a3", titulo: "Atrasada da Carla", responsavel: carla, prazo: "2026-10-02" }),
    item({ id: "s1", titulo: "Vence sexta", responsavel: ana, prazo: "2026-10-16" }),
    item({ id: "s2", titulo: "Vence hoje", responsavel: ana, prazo: "2026-10-12" }),
    item({ id: "s3", titulo: "Daqui a 8 dias", responsavel: ana, prazo: "2026-10-20" }),
    item({ id: "s4", titulo: "Daqui a 7 dias", responsavel: ana, prazo: "2026-10-19" }),
    item({ id: "n1", titulo: "Ninguem pegou", prazo: "2026-10-03" }),
    item({ id: "n2", titulo: "Ninguem pegou, longe", prazo: "2026-12-01" }),
    item({ id: "c1", titulo: "Concluida", responsavel: ana, prazo: "2026-10-01", concluidaEm: "2026-10-02" }),
    item({ id: "x1", titulo: "Arquivada", responsavel: ana, prazo: "2026-10-01", arquivadoEm: 5 }),
    item({ id: "f1", titulo: "Longe", responsavel: ana, prazo: "2026-12-31" }),
  ];
  const ids = (id: string, soMinhas = true) =>
    gruposDaAgenda(lista, { hoje: HOJE, eu: ana, soMinhas })
      .find((g) => g.id === id)
      ?.itens.map((x) => x.demanda.id)
      .join();
  checar("Atrasadas: da mais atrasada, so as minhas por padrao", ids("atrasadas") === "a2,a1", ids("atrasadas"));
  checar("Todas: a da Carla entra", ids("atrasadas", false) === "a2,a3,a1", ids("atrasadas", false));
  checar("Esta semana: ate 7 dias (inclusive hoje), pelo prazo", ids("semana") === "s2,s1,s4", ids("semana"));
  checar("Sem responsavel: separado, de qualquer prazo, nao duplica", ids("semResponsavel") === "n1,n2", ids("semResponsavel"));
  checar(
    "concluida, arquivada e a de longe: fora de todos os grupos",
    !gruposDaAgenda(lista, { hoje: HOJE, eu: ana, soMinhas: false }).some((g) =>
      g.itens.some((x) => ["c1", "x1", "f1", "s3"].includes(x.demanda.id)),
    ),
  );
  checar(
    "grupo vazio nao aparece",
    gruposDaAgenda([lista[7]!], { hoje: HOJE, eu: ana })
      .map((g) => g.id)
      .join() === "semResponsavel",
  );

  secao("lateral: a Agenda na tela");
  const doc = telaDoApp();
  const cliques: string[] = [];
  let novas = 0;
  const alternou: boolean[] = [];
  const el = montarAgenda(lista, {
    hoje: HOJE,
    eu: ana,
    aoClicar: (x) => cliques.push(x.demanda.id),
    aoNova: () => {
      novas += 1;
    },
    aoAlternar: (v) => alternou.push(v),
  });
  doc.body.append(el);
  const titulos = [...el.querySelectorAll(".dem-lat-grupo-titulo")].map((t) => t.firstChild?.textContent);
  checar(
    "tres grupos, na ordem: Atrasadas, Esta semana, Sem responsavel",
    titulos.join("|") === "Atrasadas|Esta semana|Sem responsável",
    titulos,
  );
  checar("a contagem de cada grupo", [...el.querySelectorAll(".dem-lat-conta")].map((c) => c.textContent).join() === "2,3,2");
  (el.querySelector('[data-id="a1"]') as HTMLElement).click();
  checar("clicar numa demanda avisa qual", cliques.join() === "a1");
  const botaoNova = [...el.querySelectorAll("button")].find((b) => texto(b) === "Nova demanda") as HTMLElement;
  botaoNova.click();
  checar("o botao Nova demanda", novas === 1);
  checar(
    "atrasadas em vermelho; texto do prazo",
    texto(el.querySelector('[data-id="a2"] .dem-lat-info')).startsWith("Atrasada há 11 dias"),
    texto(el.querySelector('[data-id="a2"] .dem-lat-info')),
  );
  (el.querySelector(".dem-lat-filtro") as HTMLElement).click();
  checar("Solo as minhas / Todas: avisa o novo valor", alternou.join() === "false");
  const vazio = montarAgenda([], { hoje: HOJE, eu: ana, aoClicar: () => undefined, aoNova: () => undefined });
  checar(
    "nada aberto: Tudo em dia (e o botao continua)",
    texto(vazio.querySelector(".dem-lat-nada")) === "Tudo em dia" && !!vazio.querySelector(".dem-nova"),
  );

  secao("lateral: a montagem por chave (trocar de unidade remonta, nunca grava na antiga)");
  {
    const doc2 = telaDoApp();
    const raiz = doc2.getElementById("app") as HTMLElement;
    const ctxB: ContextoDemandas = { ...CTX, unidade: { id: "220000002", sigla: "OUTRA", nome: "Outra" } };
    const chamadas: string[] = [];
    let aba: { chave: string; ctx: ContextoDemandas } | null = { chave: chaveDaAba(CTX), ctx: CTX };
    const mudar: Array<() => void> = [];
    const rpcsDaChave = new Map<string, Pick<Rpc, "chamar">>();
    const ponte: PonteDoLateral = {
      atual: () => (aba ? { chave: aba.chave, rpc: rpcDe(aba.chave, aba.ctx) } : null),
      daChave: (c) => (aba && aba.chave === c ? { rpc: rpcDe(aba.chave, aba.ctx) } : null),
      aoMudar: (cb) => {
        mudar.push(cb);
        return () => undefined;
      },
    };
    function rpcDe(chave: string, ctx: ContextoDemandas): Pick<Rpc, "chamar"> {
      let r = rpcsDaChave.get(chave);
      if (!r) {
        r = {
          chamar: async <T>(op: string): Promise<T> => {
            chamadas.push(`${chave}:${op}`);
            return (op === "contexto" ? ctx : true) as T;
          },
        };
        rpcsDaChave.set(chave, r);
      }
      return r;
    }
    const montados: Array<{ ctx: ContextoDemandas; rpc: Pick<Rpc, "chamar">; destruidos: number; voltas: number }> = [];
    const montagem = new MontagemLateral({
      raiz,
      ponte,
      carenciaMs: 20,
      criar: async (ctx, rpc) => {
        const m = { ctx, rpc, destruidos: 0, voltas: 0 };
        montados.push(m);
        raiz.replaceChildren(doc2.createElement("div"));
        const app: AppDoLateral = {
          aoVoltarAba: () => {
            m.voltas += 1;
          },
          destruir: () => {
            m.destruidos += 1;
            return 0;
          },
        };
        return app;
      },
    });
    montagem.iniciar();
    await montagem.reagir();
    checar("monta o app da unidade da aba da frente", montados.length === 1 && montados[0]!.ctx.unidade?.id === "110000001");
    await montagem.reagir();
    checar("a mesma chave nao remonta (e avisa a volta)", montados.length === 1 && montados[0]!.voltas === 1);
    aba = { chave: chaveDaAba(ctxB), ctx: ctxB };
    await montagem.reagir();
    checar(
      "outra unidade: desmonta a antiga e monta a nova",
      montados.length === 2 && montados[0]!.destruidos === 1 && montados[1]!.ctx.unidade?.id === "220000002",
    );
    const antes = chamadas.length;
    const erroAntigo = await lanca(() => montados[0]!.rpc.chamar("sincronizarAgora"));
    checar(
      "o RPC da montagem antiga recusa tudo (nada chega a aba da unidade nova)",
      erroAntigo instanceof ErroRpc && erroAntigo.codigo === "SEM_ABA" && chamadas.length === antes,
      erroAntigo,
    );
    checar("o RPC da nova vai a aba da chave dela", ((await montados[1]!.rpc.chamar("usuarios")) as unknown) === true);
    aba = null;
    await montagem.reagir();
    checar("a aba some: o app espera a carencia (nao desmonta na hora)", montados[1]!.destruidos === 0);
    await tique(40);
    checar(
      "acabou a carencia sem aba: desmonta e avisa que nao ha aba",
      montados[1]!.destruidos === 1 && texto(raiz).includes("Abra o SEI nesta janela"),
      texto(raiz),
    );
    montagem.parar();
  }

  secao("lateral: o app de uma unidade (selo, clique e Nova demanda)");
  {
    const doc3 = telaDoApp();
    const raiz = doc3.getElementById("app") as HTMLElement;
    const area = areaMemoria();
    const esc = escoposDaUnidade(CTX.host, CTX.login, "110000001");
    let t = T0;
    const carimbo = () => ({ agora: ++t, dispositivo: "dev-a", por: "ana", nome: "Ana Lima" });
    const un = new RepositorioDemandas(area, esc.unidade, carimbo);
    await un.criar({ titulo: "Minha atrasada", prazo: "2026-10-05", distribuidaEm: "2026-10-01", responsavel: ana });
    await un.criar({ titulo: "Da Carla", prazo: "2026-10-05", distribuidaEm: "2026-10-01", responsavel: carla });
    await un.criar({ titulo: "Sem dono", prazo: "2026-11-05", distribuidaEm: "2026-10-01" });
    const chamadas: Array<{ op: string; args: unknown }> = [];
    const rpc: Pick<Rpc, "chamar"> = {
      chamar: async <T>(op: string, args?: unknown): Promise<T> => {
        chamadas.push({ op, args });
        return [] as unknown as T;
      },
    };
    const { abrirModal } = { abrirModal: criarAbrirModal() };
    const app = await criarAppDoLateral({
      raiz,
      area,
      sync: areaMemoria(),
      abrirModal,
      baixar: () => undefined,
      escolherArquivo: async () => null,
      hoje: () => HOJE,
      agora: () => (t += 1),
      dispositivo: "dev-a",
      copias: null,
      arquivo: () => null,
    })(CTX, rpc);
    await tique(20);
    const grupos = [...raiz.querySelectorAll(".dem-lat-grupo")].map((g) => g.getAttribute("data-grupo")).join();
    checar(
      "a Agenda da unidade: so a minha atrasada e a sem dono",
      grupos === "atrasadas,semResponsavel" && !texto(raiz).includes("Da Carla"),
      grupos,
    );
    checar(
      "o selo e gravado (minhas atrasadas = 1)",
      (await area.obter(CHAVE_CONTADOR_DEMANDAS))[CHAVE_CONTADOR_DEMANDAS] === 1,
      await area.obter(CHAVE_CONTADOR_DEMANDAS),
    );
    const minha = [...raiz.querySelectorAll<HTMLElement>(".dem-lat-item")].find((b) => texto(b).startsWith("Minha atrasada"))!;
    minha.click();
    await tique(5);
    checar(
      "clicar abre no painel da aba (RPC focarNoPainel com o id)",
      chamadas.some((c) => c.op === "focarNoPainel" && (c.args as { id?: string }).id === minha.getAttribute("data-id")),
      chamadas,
    );
    await un.criar({ titulo: "Outra minha atrasada", prazo: "2026-10-01", distribuidaEm: "2026-09-20", responsavel: ana });
    await tique(20);
    checar(
      "gravacao de fora: a Agenda e o selo se refazem",
      texto(raiz).includes("Outra minha atrasada") && (await area.obter(CHAVE_CONTADOR_DEMANDAS))[CHAVE_CONTADOR_DEMANDAS] === 2,
    );
    [...raiz.querySelectorAll("button")].find((b) => texto(b) === "Nova demanda")!.click();
    await tique(5);
    checar("Nova demanda abre o dialogo da demanda", !!doc3.querySelector("dialog.spro-dialogo[open]"));
    const fechados = app.destruir();
    checar(
      "destruir fecha o dialogo aberto e devolve quantos fechou",
      fechados === 1 && !doc3.querySelector("dialog.spro-dialogo[open]"),
      fechados,
    );
    const antes = raiz.innerHTML.length;
    await un.criar({ titulo: "Depois de destruido", prazo: "2026-10-01", distribuidaEm: "2026-09-20", responsavel: ana });
    await tique(20);
    checar(
      "depois de destruido nao repinta nem grava o selo",
      raiz.innerHTML.length === antes && (await area.obter(CHAVE_CONTADOR_DEMANDAS))[CHAVE_CONTADOR_DEMANDAS] === 2,
    );
    const vez = modaisDaVez(abrirModal);
    vez.fecharTodos();
    let fechou = false;
    vez.abrirModal({
      titulo: "x",
      conteudo: doc3.createElement("div"),
      aoFechar: () => {
        fechou = true;
      },
    });
    await tique(1);
    checar("depois de encerrada, a vez nao abre mais nada (fecha na hora)", fechou && !doc3.querySelector("dialog.spro-dialogo[open]"));
  }

  secao("lateral: o pedido da aba ao app (focarDemanda)");
  {
    const t = appDeTeste();
    const d = await t.repos.unidade.criar({ titulo: "Para focar", prazo: "2026-10-20", distribuidaEm: "2026-10-01", responsavel: ana });
    const pedidos = pedidosDaAba();
    checar(
      "id invalido e recusado",
      (await pedidos.tratadores.focarDemanda!({ id: "" })) === false &&
        (await pedidos.tratadores.focarDemanda!({ id: 5 })) === false &&
        (await pedidos.tratadores.focarDemanda!(null)) === false,
    );
    checar("antes de o app ficar pronto, o pedido espera na fila", (await pedidos.tratadores.focarDemanda!({ id: d.id })) === true);
    const app = await t.montar();
    pedidos.pronto(app);
    await tique(20);
    const dialogo = t.doc.querySelector("dialog.spro-dialogo[open]");
    checar("o app abre a demanda para editar", !!dialogo && texto(dialogo).includes("Editar demanda"), texto(dialogo));
    t.doc.querySelector<HTMLElement>('dialog.spro-dialogo[open] button[aria-label="Fechar"]')?.click();
    await tique(5);
    checar("id que nao existe mais: avisa e devolve false", (await app.focarDemanda("nao-existe")) === false);
    app.destruir();
    checar("depois de destruido: false", (await app.focarDemanda(d.id)) === false);
  }

  secao("lateral: o lado da aba (focarNoPainel)");
  {
    const doc4 = telaDoApp('<html><body><div id="painel"><div class="spro-dem-corpo" hidden></div></div></body></html>');
    const painelEl = doc4.getElementById("painel") as HTMLElement;
    const corpo = painelEl.querySelector(".spro-dem-corpo") as HTMLElement;
    let abriu = 0;
    const recolher = doc4.createElement("button");
    recolher.className = "spro-dem-recolher";
    recolher.addEventListener("click", () => {
      abriu += 1;
      corpo.hidden = false;
    });
    painelEl.append(recolher);
    const pedidosApp: Array<{ op: string; args: unknown }> = [];
    const montado: PainelDaAba = {
      painel: painelEl,
      corpo,
      rpc: () => ({
        chamar: async (op, args) => {
          pedidosApp.push({ op, args });
          return true;
        },
      }),
    };
    checar(
      "com o painel montado: abre se recolhido e pede a demanda ao app",
      focarNoPainelDaAba(montado, "d1") === "painel" && abriu === 1 && pedidosApp.length === 1 && pedidosApp[0]?.op === "focarDemanda",
    );
    const area = areaMemoria();
    const chave = chaveDaAba(CTX);
    const idas: string[] = [];
    const foco = focoDaAba({
      painel: Promise.resolve(null),
      area,
      chave,
      agora: () => 1_000_000,
      link: () => "https://sei/sei/controlador.php?acao=procedimento_controlar&infra_hash=1",
      ir: (u) => idas.push(u),
    });
    checar("sem painel nesta tela: vai ao Controle de Processos pelo menu", (await foco("d9")) === "navegou" && idas.length === 1);
    const guardado = (await area.obter(CHAVE_FOCO))[CHAVE_FOCO];
    checar(
      "e deixa o pedido guardado (chave, demanda, 1 minuto)",
      lerPedidoDeFoco(guardado, chave, 1_000_000)?.demanda === "d9" && (guardado as { ate: number }).ate === 1_000_000 + VALIDADE_FOCO,
      guardado,
    );
    checar(
      "o pedido de outra chave nao vale",
      lerPedidoDeFoco(guardado, chaveDaAba({ ...CTX, unidade: { id: "9", sigla: "X", nome: "X" } }), 1_000_000) === null,
    );
    checar(
      "vencido, no futuro demais, torto: nao vale",
      lerPedidoDeFoco(guardado, chave, 1_000_000 + VALIDADE_FOCO + 1) === null &&
        lerPedidoDeFoco({ ...(guardado as object), ate: 1_000_000 + VALIDADE_FOCO * 5 }, chave, 1_000_000) === null &&
        lerPedidoDeFoco([1], chave, 1) === null &&
        lerPedidoDeFoco({ chave, demanda: 3, ate: 2e6 }, chave, 1) === null,
    );
    pedidosApp.length = 0;
    corpo.hidden = true;
    checar(
      "no Controle de Processos, o painel atende o pedido do lateral uma vez",
      (await atenderPedidoDoLateral(area, chave, 1_000_100, montado)) === true &&
        pedidosApp.length === 1 &&
        (await atenderPedidoDoLateral(area, chave, 1_000_100, montado)) === false,
    );
    const semMenu = await lanca(() =>
      irAoPainel(
        {
          area,
          chave,
          agora: 1,
          link: () => {
            throw new Error("sem menu");
          },
          ir: () => undefined,
        },
        "d1",
      ),
    );
    checar("tela sem o menu: erro claro", semMenu instanceof ErroRpc && semMenu.codigo === "SEM_MENU");
    const quebrado = focoDaAba({
      painel: Promise.reject(new Error("falhou")),
      area,
      chave,
      agora: () => 1,
      link: () => "x",
      ir: () => undefined,
    });
    const erroPainel = await lanca(() => quebrado("d1"));
    checar(
      "montagem do painel falhou: erro (ir ao Controle cairia na mesma falha)",
      erroPainel instanceof ErroRpc && erroPainel.codigo === "SEM_PAINEL",
    );
  }
}
