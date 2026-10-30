/**
 * A busca no servidor do Atividades, do lado da aba (pagina/atividades.ts), com um fetch falso que devolve
 * respostas de verdade (`Response`). O servidor é de fora: resposta enorme, JSON quebrado, mensagem de erro
 * hostil, chave de outro usuário e servidor que não responde. "Configurado" é a mesma regra do contexto
 * (`atividadesConfigurado`: só a URL_API); sem a chave, nada vai à rede.
 */

import {
  buscarProjetosAtividades,
  corpoDaRequisicao,
  lerConfigAtividades,
  projetosDoAtividades,
  projetosDoCache,
} from "../../src/pagina/atividades";
import { atividadesConfigurado } from "../../src/pagina/contexto";
import { checar, lanca, secao } from "./util";

function armazenamento(v: Record<string, unknown>): Pick<Storage, "getItem"> {
  return { getItem: (k) => (k in v ? JSON.stringify(v[k]) : null) };
}

interface Pedido {
  url: string;
  corpo: string;
  init: RequestInit | undefined;
}

function servidor(resposta: unknown, status = 200, cabecalhos: Record<string, string> = {}) {
  const pedidos: Pedido[] = [];
  const buscar = (async (url: string, init?: RequestInit) => {
    pedidos.push({ url, corpo: String(init?.body ?? ""), init });
    const corpo = typeof resposta === "string" ? resposta : JSON.stringify(resposta);
    return new Response(corpo, { status, headers: cabecalhos });
  }) as unknown as typeof fetch;
  return { buscar, pedidos };
}

/** Servidor que manda o corpo aos pedaços, sem dizer o tamanho (sem Content-Length). */
function servidorEmPedacos(pedacos: number, tamanho: number) {
  let enviados = 0;
  const buscar = (async () =>
    new Response(
      new ReadableStream<Uint8Array>({
        pull(c) {
          if (enviados >= pedacos) {
            c.close();
            return;
          }
          enviados++;
          c.enqueue(new Uint8Array(tamanho).fill(0x20));
        },
      }),
    )) as unknown as typeof fetch;
  return { buscar, enviados: () => enviados };
}

/** Servidor que nunca responde (só desiste quando a busca é abortada). */
function servidorMudo() {
  const buscar = ((_url: string, init?: RequestInit) =>
    new Promise<Response>((_, rejeitar) => {
      init?.signal?.addEventListener("abort", () => rejeitar(new DOMException("abortado", "AbortError")));
    })) as unknown as typeof fetch;
  return { buscar };
}

const BASE = { URL_API: "https://atividades.orgao.gov.br/api/", KEY_USER: "chave-123" };

export async function verificarAtividadesPagina(): Promise<void> {
  secao("pagina: configuracao do servidor do Atividades");
  const cfg = armazenamento({
    configBasePro_atividades: BASE,
    optionsPro: { perfilAtividadesSelected: "SEPRO" },
  });
  const c = lerConfigAtividades(cfg);
  checar(
    "le endereco, chave e perfil",
    c?.url === "https://atividades.orgao.gov.br/api/" && c.chave === "chave-123" && c.perfil === "SEPRO",
    c,
  );
  checar("sem configuracao: null", lerConfigAtividades(armazenamento({})) === null);
  checar(
    "endereco que nao e http(s): null",
    lerConfigAtividades(armazenamento({ configBasePro_atividades: { URL_API: "javascript:alert(1)", KEY_USER: "k" } })) === null,
  );
  const semChave = armazenamento({ configBasePro_atividades: { URL_API: BASE.URL_API, KEY_USER: "" } });
  checar(
    "configurado e a mesma regra do contexto (so a URL_API): sem a chave ainda e configurado, com a chave vazia",
    atividadesConfigurado(semChave) && lerConfigAtividades(semChave)?.chave === "",
  );
  checar(
    "perfil em numero vira texto; perfil de outro tipo fica vazio",
    lerConfigAtividades(armazenamento({ configBasePro_atividades: BASE, optionsPro: { perfilAtividadesSelected: 110 } }))?.perfil ===
      "110" &&
      lerConfigAtividades(armazenamento({ configBasePro_atividades: BASE, optionsPro: { perfilAtividadesSelected: { x: 1 } } }))?.perfil ===
        "",
  );
  const quebrado: Pick<Storage, "getItem"> = {
    getItem: () => {
      throw new Error("armazenamento bloqueado");
    },
  };
  checar(
    "armazenamento que lanca: null (sem derrubar a aba)",
    lerConfigAtividades(quebrado) === null && projetosDoCache(quebrado) === null,
  );
  const corpo = corpoDaRequisicao(c!, "2.6.0");
  checar(
    "a mesma requisicao do painel legado, com os arquivados",
    corpo.get("action") === "demandas" &&
      corpo.get("hash") === "chave-123" &&
      corpo.get("projetos") === '{"vigentes":false}' &&
      corpo.get("version") === "2.6.0",
    corpo.toString(),
  );

  secao("pagina: busca e recuo no guardado");
  const ok = servidor({ status: 1, padrao: { projetos: [{ id_projeto: 1 }] } });
  const lista = await buscarProjetosAtividades(c!, "2.6.0", ok.buscar);
  checar(
    "POST no endereco configurado; devolve padrao.projetos",
    lista.length === 1 && ok.pedidos[0]?.url === c!.url && ok.pedidos[0]?.corpo.includes("hash=chave-123"),
  );
  checar(
    "POST de formulario, sem os cookies do SEI",
    ok.pedidos[0]?.init?.method === "POST" &&
      ok.pedidos[0].init.credentials === "omit" &&
      String((ok.pedidos[0].init.headers as Record<string, string>)["Content-Type"]).startsWith("application/x-www-form-urlencoded"),
    ok.pedidos[0]?.init,
  );
  const negado = servidor({ status: 0, status_txt: "Acesso negado." });
  checar(
    "status 0: o erro do servidor",
    (await lanca(() => buscarProjetosAtividades(c!, "1", negado.buscar)))?.message === "Acesso negado.",
  );
  const feio = servidor({ status: 0, status_txt: `<b>Acesso</b>\n\n negado ${"x".repeat(5000)}` });
  const msgFeia = (await lanca(() => buscarProjetosAtividades(c!, "1", feio.buscar)))?.message ?? "";
  checar(
    "mensagem do servidor: sem marcacao, numa linha e curta (vira texto no dialogo)",
    msgFeia.startsWith("Acesso negado x") && msgFeia.length <= 300 && !msgFeia.includes("<") && !msgFeia.includes("\n"),
    msgFeia.slice(0, 40),
  );
  checar(
    "JSON quebrado: diz que o servidor nao devolveu dados validos",
    /não devolveu dados válidos/.test(
      (await lanca(() => buscarProjetosAtividades(c!, "1", servidor("<html>erro</html>").buscar)))?.message ?? "",
    ),
  );
  checar(
    "resposta que nao e objeto (null, lista): dados invalidos",
    /não devolveu dados válidos/.test((await lanca(() => buscarProjetosAtividades(c!, "1", servidor(null).buscar)))?.message ?? "") &&
      /não devolveu dados válidos/.test((await lanca(() => buscarProjetosAtividades(c!, "1", servidor([]).buscar)))?.message ?? ""),
  );
  checar(
    "sem a capacidade de ver projetos (padrao.projetos nao e lista): lista vazia",
    (await buscarProjetosAtividades(c!, "1", servidor({ status: 1, padrao: { projetos: 0 } }).buscar)).length === 0,
  );
  checar(
    "mais de 1000 projetos: so os 1000 primeiros atravessam",
    (
      await buscarProjetosAtividades(
        c!,
        "1",
        servidor({ status: 1, padrao: { projetos: Array.from({ length: 1500 }, (_, i) => ({ id_projeto: i + 1 })) } }).buscar,
      )
    ).length === 1000,
  );
  const enorme = servidor({ status: 1, padrao: { projetos: [] } }, 200, { "Content-Length": String(50 * 1024 * 1024) });
  checar(
    "resposta que diz ser maior que o teto: recusada sem ler",
    /passa de/.test((await lanca(() => buscarProjetosAtividades(c!, "1", enorme.buscar)))?.message ?? ""),
  );
  const pedacos = servidorEmPedacos(1000, 1024);
  const errPedacos = await lanca(() => buscarProjetosAtividades(c!, "1", pedacos.buscar, { limiteBytes: 10 * 1024 }));
  checar(
    "resposta sem tamanho que passa do teto: para de ler no teto",
    /passa de/.test(errPedacos?.message ?? "") && pedacos.enviados() < 20,
    [errPedacos?.message, pedacos.enviados()],
  );
  const mudo = servidorMudo();
  const errMudo = await lanca(() => buscarProjetosAtividades(c!, "1", mudo.buscar, { limiteMs: 20 }));
  checar("servidor que nao responde: desiste no tempo e diz por que", /não respondeu em/.test(errMudo?.message ?? ""), errMudo?.message);
  const comLogin = servidor({ status: 1, padrao: { perfil: { login: "outro.usuario" }, projetos: [{ id_projeto: 1 }] } });
  checar(
    "chave de outro usuario (o painel antigo confere o login): recusa",
    /outro usuário/.test((await lanca(() => buscarProjetosAtividades(c!, "1", comLogin.buscar, { login: "ana.lima" })))?.message ?? ""),
  );
  const mesmo = servidor({ status: 1, padrao: { perfil: { login: "Ana_Lima" }, projetos: [{ id_projeto: 1 }] } });
  checar(
    "o mesmo login escrito com '_' no lugar do '.' (como o painel antigo): aceita",
    (await buscarProjetosAtividades(c!, "1", mesmo.buscar, { login: "ana.lima" })).length === 1,
  );

  const semLogin = servidor({ status: 1, padrao: { perfil: { unidade: "SEPRO" }, projetos: [{ id_projeto: 1 }] } });
  checar(
    "perfil na resposta sem o login (como o painel antigo): recusa",
    /outro usuário/.test((await lanca(() => buscarProjetosAtividades(c!, "1", semLogin.buscar, { login: "ana.lima" })))?.message ?? ""),
  );
  checar(
    "a chave nao segue redirecionamento para outro endereco",
    ok.pedidos[0]?.init?.redirect === "error",
    ok.pedidos[0]?.init?.redirect,
  );
  const cheio = servidor({
    status: 1,
    padrao: {
      projetos: [
        {
          id_projeto: 1,
          nome_projeto: "P",
          projetos_compartilhados: [{ nome_completo: "Fulano de Tal", id_user: 9 }],
          config: { qualquer: 1 },
          id_cadeia_valor: 3,
          etapas: [
            {
              id_etapa: 2,
              nome_etapa: "E",
              config: [1],
              id_demandas: [5],
              id_demandas_titles: [{ id_demanda: 5, nome_atividade: "A", apelido: "fulano", requisicao_sei: "123", data_entrega: "x" }],
            },
          ],
        },
      ],
    },
  });
  const [so] = (await buscarProjetosAtividades(c!, "1", cheio.buscar)) as Array<Record<string, unknown>>;
  const etapaSo = (so?.etapas as Array<Record<string, unknown>> | undefined)?.[0];
  const demandaSo = (etapaSo?.id_demandas_titles as Array<Record<string, unknown>> | undefined)?.[0];
  checar(
    "a aba devolve ao app so os campos que a importacao usa (sem compartilhamentos, config, apelido)",
    !!so &&
      Object.keys(so).sort().join() === "etapas,id_projeto,nome_projeto" &&
      Object.keys(etapaSo ?? {})
        .sort()
        .join() === "id_demandas_titles,id_etapa,nome_etapa" &&
      Object.keys(demandaSo ?? {})
        .sort()
        .join() === "data_entrega,id_demanda,nome_atividade",
    [so && Object.keys(so), etapaSo && Object.keys(etapaSo), demandaSo && Object.keys(demandaSo)],
  );

  secao("pagina: o guardado pelo painel antigo (so o do mesmo usuario) e o login obrigatorio");
  const LOGIN = { login: "ana.lima" };
  const guardado = (projetos: unknown[], dono?: string, indice: unknown = ["perfil", "projetos"]) => ({
    configDataAtividadesPadraoPro: indice,
    configDataAtividadesPadraoPro_projetos: projetos,
    ...(dono === undefined ? {} : { configDataAtividadesPadraoPro_perfil: { login: dono, unidade: "SEPRO" } }),
  });
  const SERVIDOR_K = { URL_API: "https://atividades.orgao.gov.br/api/", KEY_USER: "k" };
  const comCache = armazenamento({ configBasePro_atividades: SERVIDOR_K, ...guardado([{ id_projeto: 7 }], "ana.lima") });
  const r = await projetosDoAtividades(comCache, "1", servidor(null, 500).buscar, LOGIN);
  checar(
    "servidor falhou: o guardado pelo painel legado, com o motivo",
    r.fonte === "cache" && r.projetos.length === 1 && /500/.test(r.aviso ?? ""),
    r,
  );
  checar("cache le o array", projetosDoCache(comCache)?.length === 1);
  const semIndice = armazenamento({ configBasePro_atividades: SERVIDOR_K, ...guardado([{ id_projeto: 7 }], "ana.lima", ["perfil"]) });
  const errSemIndice = await lanca(() => projetosDoAtividades(semIndice, "1", servidor(null, 500).buscar, LOGIN));
  checar(
    "o indice do painel antigo nao lista 'projetos': o guardado nao vale (fica o erro do servidor)",
    projetosDoCache(semIndice) === null && /500/.test(errSemIndice?.message ?? ""),
    errSemIndice?.message,
  );
  const deOutro = armazenamento({ configBasePro_atividades: SERVIDOR_K, ...guardado([{ id_projeto: 7 }], "bia.souza") });
  const errDeOutro = await lanca(() => projetosDoAtividades(deOutro, "1", servidor(null, 500).buscar, LOGIN));
  checar(
    "servidor falhou e o guardado e de outro usuario: recusa (o guardado nao contorna a conferencia)",
    /500/.test(errDeOutro?.message ?? "") && /outro usuário/.test(errDeOutro?.message ?? ""),
    errDeOutro?.message,
  );
  const semDono = armazenamento({ configBasePro_atividades: SERVIDOR_K, ...guardado([{ id_projeto: 7 }]) });
  const errSemDono = await lanca(() => projetosDoAtividades(semDono, "1", servidor(null, 500).buscar, LOGIN));
  checar("guardado que nao diz de quem e: recusa", /não diz de quem é/.test(errSemDono?.message ?? ""), errSemDono?.message);
  const mesmoDono = armazenamento({ configBasePro_atividades: SERVIDOR_K, ...guardado([{ id_projeto: 7 }], "Ana_Lima") });
  checar(
    "guardado do mesmo login escrito com '_': vale",
    (await projetosDoAtividades(mesmoDono, "1", servidor(null, 500).buscar, LOGIN)).fonte === "cache",
  );
  const semNada = await lanca(() => projetosDoAtividades(cfg, "1", servidor(null, 500).buscar, LOGIN));
  checar("sem servidor e sem guardado: o erro", /500/.test(semNada?.message ?? ""));
  checar(
    "sem configuracao: explica",
    /Não há servidor/.test((await lanca(() => projetosDoAtividades(armazenamento({}), "1", ok.buscar, LOGIN)))?.message ?? ""),
  );
  const rede = servidor({ status: 1, padrao: { projetos: [] } });
  const errSemChave = await lanca(() => projetosDoAtividades(semChave, "1", rede.buscar, LOGIN));
  checar(
    "sem a chave: nada vai a rede e diz como conseguir a chave",
    /chave de acesso/.test(errSemChave?.message ?? "") && rede.pedidos.length === 0,
    errSemChave?.message,
  );
  const semChaveComCache = armazenamento({
    configBasePro_atividades: { URL_API: BASE.URL_API, KEY_USER: "" },
    ...guardado([{ id_projeto: 7 }], "ana.lima"),
  });
  const rSemChave = await projetosDoAtividades(semChaveComCache, "1", rede.buscar, LOGIN);
  checar(
    "sem a chave, com o guardado: o guardado, com o motivo",
    rSemChave.fonte === "cache" && /chave de acesso/.test(rSemChave.aviso ?? "") && rede.pedidos.length === 0,
  );
  const enderecoTorto = armazenamento({ configBasePro_atividades: { URL_API: "javascript:alert(1)", KEY_USER: "k" } });
  const errTorto = await lanca(() => projetosDoAtividades(enderecoTorto, "1", rede.buscar, LOGIN));
  checar(
    "endereco guardado que nao e http(s): explica, sem ir a rede",
    /endereço/.test(errTorto?.message ?? "") && rede.pedidos.length === 0,
    errTorto?.message,
  );
  const outroComCache = armazenamento({ configBasePro_atividades: BASE, ...guardado([{ id_projeto: 7 }], "ana.lima") });
  const errOutro = await lanca(() => projetosDoAtividades(outroComCache, "1", comLogin.buscar, LOGIN));
  checar(
    "chave de outro usuario: nem o guardado (que tambem seria dele)",
    /outro usuário/.test(errOutro?.message ?? ""),
    errOutro?.message,
  );
  const rMudo = await projetosDoAtividades(comCache, "1", servidorMudo().buscar, { ...LOGIN, limiteMs: 20 });
  checar("servidor que nao responde, com o guardado: o guardado", rMudo.fonte === "cache" && /não respondeu/.test(rMudo.aviso ?? ""));
  const muitos = Array.from({ length: 1500 }, (_, i) => ({ id_projeto: i + 1, config: { x: i } }));
  const rMuitos = await projetosDoAtividades(cfg, "1", servidor({ status: 1, padrao: { projetos: muitos } }).buscar, LOGIN);
  const cacheMuitos = armazenamento({ configBasePro_atividades: SERVIDOR_K, ...guardado(muitos.slice(0, 1200), "ana.lima") });
  const rCacheMuitos = await projetosDoAtividades(cacheMuitos, "1", servidor(null, 500).buscar, LOGIN);
  checar(
    "mais de 1000: o resultado diz quantos ficaram de fora (do servidor e do guardado), e o guardado tambem vai sem os campos a mais",
    rMuitos.projetos.length === 1000 &&
      rMuitos.cortados === 500 &&
      rCacheMuitos.projetos.length === 1000 &&
      rCacheMuitos.cortados === 200 &&
      !("config" in ((rCacheMuitos.projetos[0] as Record<string, unknown>) ?? {})),
    [rMuitos.cortados, rCacheMuitos.cortados],
  );
  // @ts-expect-error o login do SEI é obrigatório: sem ele, a chave de outro usuário não seria conferida.
  await lanca(() => projetosDoAtividades(cfg, "1", ok.buscar));
}
