/**
 * Conector MCP que roda na máquina do usuário (http://127.0.0.1:porta/mcp).
 *
 * O que muda em relação ao conector remoto: o servidor pode estar desligado
 * (e isso não é "erro de rede" nem "confira o token"), pode ser reiniciado no
 * meio da conversa, e o erro que a FERRAMENTA devolve ("[sessao] ...",
 * "[validacao] ...") é assunto do usuário e do modelo, não defeito do conector.
 */

import { DOMParser } from "linkedom";
import { ClienteMcp, ErroMcp, enderecoLocal } from "../src/mcp/cliente";
import { conferirEndereco, destinoDe, normalizarConector, type Conector } from "../src/mcp/conectores";
import { toolsMcp } from "../src/mcp/tools";
import { retestarLocais, verificarConector } from "../src/mcp/verificacao";
import { erroParaModelo } from "../src/motor/motor";
import type { ContextoTool } from "../src/motor/tools";
import { secaoConectores } from "../src/painel/mcp-ui";
import { checar, lanca, secao } from "./util";

const URL_LOCAL = "http://127.0.0.1:8765/mcp";
const DESLIGADO = "O MCP Arrendamento não está rodando neste computador. Inicie-o e tente de novo.";
const INICIO = { protocolVersion: "2025-06-18", serverInfo: { name: "arrendamento", version: "1.0" }, capabilities: {} };

const sinal = () => new AbortController().signal;
const tool = (nome: string) => ({ nome, descricao: `faz ${nome}`, esquema: { type: "object", properties: {} } });

const conector = (c: Partial<Conector> = {}): Conector => ({
  id: "arr",
  nome: "MCP Arrendamento",
  url: URL_LOCAL,
  ativo: true,
  auth: { tipo: "token", cabecalho: "Authorization", valor: "Bearer segredo" },
  padrao: "sempre",
  permissoes: {},
  tools: [tool("arrendamento_listar"), tool("arrendamento_cadastrar")],
  consentido: true,
  ...c,
});

/** O que o navegador faz com conexão recusada: TypeError, sem status. */
const recusado = (async () => {
  throw new TypeError("Failed to fetch");
}) as unknown as typeof fetch;

const resposta = (status: number, corpo: unknown, sessao?: string) =>
  ({
    ok: status < 400,
    status,
    headers: { get: (k: string) => (k.toLowerCase() === "mcp-session-id" ? (sessao ?? null) : null) },
    text: async () => (typeof corpo === "string" ? corpo : JSON.stringify(corpo)),
  }) as unknown as Response;

/**
 * Servidor que esquece a sessão quando é reiniciado, como o de verdade: a
 * sessão antiga leva 404 e só um `initialize` novo devolve outra.
 */
function servidorComSessao(resultado: unknown) {
  let geracao = 1;
  const pedidos: Array<{ metodo: string; sessao?: string; auth?: string }> = [];
  const f = (async (_u: string, init: RequestInit) => {
    const corpo = JSON.parse(String(init.body)) as { id?: number; method: string };
    const cab = (init.headers ?? {}) as Record<string, string>;
    pedidos.push({ metodo: corpo.method, sessao: cab["Mcp-Session-Id"], auth: cab.Authorization });
    const viva = `s${geracao}`;
    if (corpo.method === "initialize") return resposta(200, { jsonrpc: "2.0", id: corpo.id, result: INICIO }, viva);
    if (cab["Mcp-Session-Id"] !== viva) return resposta(404, "Session not found");
    if (corpo.id === undefined) return resposta(202, "");
    return resposta(200, { jsonrpc: "2.0", id: corpo.id, result: resultado }, viva);
  }) as unknown as typeof fetch;
  return { f, pedidos, reiniciar: () => void (geracao += 1) };
}

const ctx = (): ContextoTool =>
  ({
    sinal: sinal(),
    anonimizar: (x: string) => x,
    consentirConector: async () => true,
    ui: { aprovarExterno: async () => ({ permitido: true, sempre: true }) },
  }) as unknown as ContextoTool;

export async function verificarMcpLocal(): Promise<void> {
  secao("mcp local: endereco e permissao de host");
  {
    checar("127.0.0.1 e local", enderecoLocal(URL_LOCAL));
    checar("localhost e local", enderecoLocal("http://localhost:3000/mcp"));
    checar("servidor de fora nao e local", !enderecoLocal("https://mcp.exemplo.com/mcp"));
    const e = conferirEndereco(URL_LOCAL);
    // O manifest declara "http://127.0.0.1/*": o padrão pedido tem de caber
    // nele, e padrão com porta o Firefox recusa.
    checar("a permissao pedida nao leva a porta", e.ok && e.permissao === "http://127.0.0.1/*", e);
    const l = conferirEndereco("http://localhost:8765/mcp");
    checar("idem em localhost", l.ok && l.permissao === "http://localhost/*", l);
    const r = conferirEndereco("https://mcp.exemplo.com:8443/mcp");
    checar("idem em https com porta", r.ok && r.permissao === "https://mcp.exemplo.com/*", r);
    checar("o destino leva o nome do conector", destinoDe(conector()).nome === "MCP Arrendamento");
  }

  secao("mcp local: servidor desligado");
  {
    const e = (await lanca(() => new ClienteMcp(destinoDe(conector()), recusado).iniciar(sinal()))) as ErroMcp;
    checar("conexao recusada em endereco local vira 'desligado'", e?.codigo === "desligado", e?.codigo);
    checar("a mensagem manda iniciar o servidor", e?.message === DESLIGADO, e?.message);
    checar("e nao fala de token nem de rede", !/token|alcan/i.test(e?.message ?? ""), e?.message);
    const semNome = (await lanca(() => new ClienteMcp({ url: URL_LOCAL }, recusado).iniciar(sinal()))) as ErroMcp;
    checar("sem nome, ainda explica", /^O servidor local não está rodando neste computador/.test(semNome?.message ?? ""), semNome?.message);
    const fora = (await lanca(() => new ClienteMcp({ url: "https://mcp.exemplo.com/mcp", nome: "Compras" }, recusado).iniciar(sinal()))) as ErroMcp;
    checar("servidor de fora continua sendo erro de rede", fora?.codigo === "rede" && !/rodando neste computador/.test(fora.message), fora?.message);
  }

  secao("mcp local: fetch do navegador");
  {
    // O fetch do navegador recusa ser chamado como método de outro objeto
    // ("Illegal invocation"); o do Node aceita, e por isso o defeito passou.
    const original = globalThis.fetch;
    let quem: unknown = "nao chamado";
    globalThis.fetch = function (this: unknown, _u: unknown, init?: RequestInit) {
      quem = this;
      if (this !== undefined && this !== globalThis) throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      const corpo = JSON.parse(String(init?.body)) as { id?: number };
      return Promise.resolve(resposta(200, { jsonrpc: "2.0", id: corpo.id, result: INICIO }));
    } as unknown as typeof fetch;
    try {
      const e = await lanca(() => new ClienteMcp(destinoDe(conector())).iniciar(sinal()));
      checar("o fetch padrao e chamado solto, nao como metodo do cliente", e === null && (quem === undefined || quem === globalThis), e?.message);
    } finally {
      globalThis.fetch = original;
    }
  }

  secao("mcp local: token malformado nao e servidor desligado");
  {
    // Visto no Chrome: aspas curvas ou acento no token fazem o fetch lançar
    // TypeError ANTES de sair qualquer pedido. Não é o servidor que está fora.
    let pedidos = 0;
    const contando = (async () => ((pedidos += 1), resposta(200, {}))) as unknown as typeof fetch;
    const torto = conector({ auth: { tipo: "token", cabecalho: "Authorization", valor: "Bearer \u201Cabc\u201D" } });
    const e = (await lanca(() => new ClienteMcp(destinoDe(torto), contando).iniciar(sinal()))) as ErroMcp;
    checar("caractere invalido no token nao vira 'desligado'", e?.codigo === "http", e?.codigo);
    checar("a mensagem manda corrigir o token", /cole o token de novo/i.test(e?.message ?? ""), e?.message);
    checar("sem repetir o token na mensagem (ela vai ao modelo e fica guardada)", !/abc/.test(e?.message ?? ""), e?.message);
    checar("e nada sai para o servidor", pedidos === 0, pedidos);
    // Engano comum: o token colado no campo do NOME do cabeçalho.
    const nomeRuim = conector({ auth: { tipo: "token", cabecalho: "Authorization: Bearer tokensecreto123", valor: "abc" } });
    const n = (await lanca(() => new ClienteMcp(destinoDe(nomeRuim), contando).iniciar(sinal()))) as ErroMcp;
    checar("nome de cabecalho invalido tambem e explicado", n?.codigo === "http" && /cabeçalho/.test(n.message), n?.message);
    checar("sem repetir o que foi digitado no nome", !/tokensecreto123/.test(`${n?.message} ${n?.detalhe ?? ""}`), n?.message);
    const tokenNoNome = conector({ auth: { tipo: "token", cabecalho: "tokensecreto123", valor: "Bearer \u201Cx\u201D" } });
    const v = (await lanca(() => new ClienteMcp(destinoDe(tokenNoNome), contando).iniciar(sinal()))) as ErroMcp;
    checar("nem quando o nome e valido e o defeito esta no valor", !/tokensecreto123/.test(`${v?.message} ${v?.detalhe ?? ""}`), v?.message);
    const estranho = (async () => {
      throw new TypeError("Failed to execute 'fetch' on 'Window': algo que nao e rede");
    }) as unknown as typeof fetch;
    const x = (await lanca(() => new ClienteMcp(destinoDe(conector()), estranho).iniciar(sinal()))) as ErroMcp;
    checar("falha que nao e de conexao nao vira 'desligado'", x?.codigo === "rede" && /algo que nao e rede/.test(x.message), x?.message);
    const firefox = (async () => {
      throw new TypeError("NetworkError when attempting to fetch resource.");
    }) as unknown as typeof fetch;
    const f = (await lanca(() => new ClienteMcp(destinoDe(conector()), firefox).iniciar(sinal()))) as ErroMcp;
    checar("a falha de conexao do Firefox tambem e 'desligado'", f?.codigo === "desligado", f?.codigo);
  }

  secao("mcp local: erro da ferramenta chega inteiro");
  {
    const longo = `[sessao] A sessão da Microsoft expirou. A janela de login foi aberta neste computador: conclua o login e peça de novo. ${"detalhe ".repeat(400)}FIM`;
    const comErro = (async (_u: string, init: RequestInit) => {
      const corpo = JSON.parse(String(init.body)) as { id?: number; method: string };
      if (corpo.id === undefined) return resposta(202, "");
      const result = corpo.method === "initialize" ? INICIO : { isError: true, content: [{ type: "text", text: longo }, { type: "text", text: "segunda parte" }] };
      return resposta(200, { jsonrpc: "2.0", id: corpo.id, result });
    }) as unknown as typeof fetch;
    const cliente = new ClienteMcp(destinoDe(conector()), comErro);
    await cliente.iniciar(sinal());
    const e = (await lanca(() => cliente.chamar("arrendamento_listar", {}, sinal()))) as ErroMcp;
    checar("isError tem codigo proprio, que nao e de transporte", e?.codigo === "ferramenta", e?.codigo);
    checar("o texto vem sem corte, com todas as partes", e?.message === `${longo}\n\nsegunda parte`, e?.message?.length);
    const aoModelo = erroParaModelo(e);
    checar("o motor entrega o texto inteiro ao modelo", aoModelo.erro === `${longo}\n\nsegunda parte` && aoModelo.erro.startsWith("[sessao]"), aoModelo.erro.length);
    for (const prefixo of ["[validacao]", "[permissao]", "[acesso]", "[api]"]) {
      const f = (async (_u: string, init: RequestInit) => {
        const corpo = JSON.parse(String(init.body)) as { id?: number };
        return resposta(200, { jsonrpc: "2.0", id: corpo.id, result: { isError: true, content: [{ type: "text", text: `${prefixo} motivo completo` }] } });
      }) as unknown as typeof fetch;
      const x = (await lanca(() => new ClienteMcp({ url: URL_LOCAL }, f).chamar("t", {}, sinal()))) as ErroMcp;
      checar(`${prefixo} chega com o prefixo`, x?.message === `${prefixo} motivo completo`, x?.message);
    }
  }

  secao("mcp local: servidor reiniciado");
  {
    const s = servidorComSessao({ content: [{ type: "text", text: "lista" }] });
    const cliente = new ClienteMcp(destinoDe(conector()), s.f);
    await cliente.iniciar(sinal());
    s.reiniciar();
    const r = await cliente.chamar("arrendamento_listar", {}, sinal());
    checar("404 de sessao desconhecida refaz o initialize e repete a chamada", r === "lista", r);
    const metodos = s.pedidos.map((p) => p.metodo).join(",");
    checar("a ordem e: chamada, initialize, chamada", /tools\/call,initialize,notifications\/initialized,tools\/call$/.test(metodos), metodos);
    checar("a repeticao usa a sessao nova", s.pedidos[s.pedidos.length - 1].sessao === "s2", s.pedidos[s.pedidos.length - 1]);
    checar("o token vai em TODA chamada, inclusive nas refeitas", s.pedidos.every((p) => p.auth === "Bearer segredo"), s.pedidos);
  }
  {
    // Entre duas chamadas do agente: cada mcp_chamar abre a própria sessão,
    // então a primeira depois de o servidor voltar não depende da antiga.
    const s = servidorComSessao({ content: [{ type: "text", text: "lista" }] });
    const tools = toolsMcp({ conectores: () => [conector()], guardar: async () => undefined, cliente: (c) => new ClienteMcp(destinoDe(c), s.f), autorizado: async () => true });
    const chamar = tools.find((t) => t.nome === "mcp_chamar")!;
    await chamar.executar({ servidor: "MCP Arrendamento", tool: "arrendamento_listar" }, ctx());
    s.reiniciar();
    const r = await chamar.executar({ servidor: "MCP Arrendamento", tool: "arrendamento_listar" }, ctx());
    checar("a primeira chamada depois do reinicio funciona", r === "lista", r);
    checar("porque abriu sessao nova", s.pedidos.filter((p) => p.metodo === "initialize").length === 2, s.pedidos.map((p) => p.metodo));
  }

  secao("mcp local: verificacao do conector");
  {
    const s = servidorComSessao({ tools: [{ name: "arrendamento_listar", description: "Lista" }] });
    const ok = await verificarConector(conector({ tools: [], erro: "velho", semResposta: true }), { cliente: (c) => new ClienteMcp(destinoDe(c), s.f), autorizado: async () => true, agora: () => 42 });
    checar("servidor no ar: guarda o catalogo", ok.tools?.length === 1 && ok.servidor?.nome === "arrendamento", ok);
    checar("e limpa o estado de falha", !ok.erro && !ok.semResposta && ok.verificadoEm === 42, ok);

    const off = await verificarConector(conector(), { cliente: (c) => new ClienteMcp(destinoDe(c), recusado), autorizado: async () => true, agora: () => 43 });
    checar("servidor desligado: marca sem resposta", off.semResposta === true && off.erro === DESLIGADO, off);
    checar("sem perder o catalogo nem desligar o conector", off.tools?.length === 2 && off.ativo, off);

    let usado = 0;
    const semPermissao = await verificarConector(conector(), { cliente: (c) => ((usado += 1), new ClienteMcp(destinoDe(c), recusado)), autorizado: async () => false });
    checar("sem permissao de host, nao tenta a rede", usado === 0 && /autorizar/.test(semPermissao.erro ?? ""), semPermissao.erro);
    checar("e nao diz que o servidor esta desligado", !semPermissao.semResposta, semPermissao);

    const nao401 = (async () => resposta(401, "unauthorized")) as unknown as typeof fetch;
    const recusa = await verificarConector(conector(), { cliente: (c) => new ClienteMcp(destinoDe(c), nao401), autorizado: async () => true });
    checar("401 e erro de token, nao 'sem resposta'", /token/.test(recusa.erro ?? "") && !recusa.semResposta, recusa);

    checar("o estado sobrevive ao armazenamento", normalizarConector(off)?.semResposta === true);
  }
  {
    const vistos: string[] = [];
    const lista = [conector(), conector({ id: "fora", nome: "Compras", url: "https://mcp.compras.gov.br/mcp" }), conector({ id: "off", nome: "Outro", ativo: false })];
    const depois = await retestarLocais(lista, { cliente: (c) => (vistos.push(c.id), new ClienteMcp(destinoDe(c), recusado)), autorizado: async () => true });
    checar("ao abrir o painel, so o conector local e ligado e retestado", vistos.join() === "arr", vistos);
    checar("e o resultado volta na mesma ordem", depois.map((c) => c.id).join() === "arr,fora,off" && depois[0].semResposta === true && !depois[1].semResposta, depois.map((c) => c.semResposta));
  }

  secao("mcp local: mcp_chamar");
  const monta = (c: Conector, f: typeof fetch, autorizado = true) => {
    const guardados: Conector[] = [];
    let atual = c;
    const tools = toolsMcp({
      conectores: () => [atual],
      guardar: async (x) => void (guardados.push(x), (atual = x)),
      cliente: (x) => new ClienteMcp(destinoDe(x), f),
      autorizado: async () => autorizado,
    });
    return { chamar: tools.find((t) => t.nome === "mcp_chamar")!, guardados, atual: () => atual };
  };
  {
    const { chamar, guardados } = monta(conector(), recusado);
    const e = (await lanca(() => chamar.executar({ servidor: "MCP Arrendamento", tool: "arrendamento_listar" }, ctx()))) as ErroMcp;
    checar("desligado: o modelo e o usuario leem a mensagem certa", e?.message === DESLIGADO && e.codigo === "desligado", e?.message);
    checar("e a tela de conectores passa a mostrar sem resposta", guardados[0]?.semResposta === true && guardados[0].ativo, guardados[0]);
  }
  {
    const login = "[sessao] Sessão expirada. A janela de login da Microsoft foi aberta: conclua o login e peça de novo.";
    const f = (async (_u: string, init: RequestInit) => {
      const corpo = JSON.parse(String(init.body)) as { id?: number; method: string };
      if (corpo.id === undefined) return resposta(202, "");
      return resposta(200, { jsonrpc: "2.0", id: corpo.id, result: corpo.method === "initialize" ? INICIO : { isError: true, content: [{ type: "text", text: login }] } });
    }) as unknown as typeof fetch;
    const { chamar, guardados, atual } = monta(conector(), f);
    const e = (await lanca(() => chamar.executar({ servidor: "MCP Arrendamento", tool: "arrendamento_listar" }, ctx()))) as ErroMcp;
    checar("login pendente: o texto do servidor chega inteiro", e?.message === login, e?.message);
    checar("o conector nao e marcado como quebrado", guardados.length === 0 && !atual().erro && !atual().semResposta && atual().ativo, guardados);
  }
  {
    const s = servidorComSessao({ content: [{ type: "text", text: "lista" }] });
    const { chamar, atual } = monta(conector({ semResposta: true, erro: DESLIGADO }), s.f);
    await chamar.executar({ servidor: "MCP Arrendamento", tool: "arrendamento_listar" }, ctx());
    checar("chamada que deu certo tira o 'sem resposta'", !atual().semResposta && !atual().erro, atual());
  }
  {
    let usado = 0;
    const contando = (async () => ((usado += 1), resposta(200, {}))) as unknown as typeof fetch;
    const { chamar } = monta(conector(), contando, false);
    const r = (await chamar.executar({ servidor: "MCP Arrendamento", tool: "arrendamento_listar" }, ctx())) as { erro: string };
    checar("sem permissao de host, explica onde autorizar", /autoriza/i.test(r.erro) && /Testar/.test(r.erro), r);
    checar("e nao tenta a rede", usado === 0, usado);
  }
  {
    const s = servidorComSessao({ content: [{ type: "text", text: "ok" }] });
    const { chamar, atual } = monta(conector({ consentido: false, padrao: "aprovar" }), s.f);
    await chamar.executar({ servidor: "MCP Arrendamento", tool: "arrendamento_listar" }, ctx());
    checar("consentimento e 'permitir sempre' dados na mesma chamada ficam os dois", atual().consentido === true && atual().permissoes.arrendamento_listar === "sempre", atual());
  }

  secao("mcp local: estado na tela de conectores");
  {
    const doc = new DOMParser().parseFromString("<html><body></body></html>", "text/html") as unknown as Document;
    (globalThis as { document?: Document }).document = doc;
    let guardados: Conector[] = [conector({ semResposta: true, erro: DESLIGADO, verificadoEm: 1 })];
    const ui = secaoConectores({
      conectores: () => guardados,
      definir: async (l) => void (guardados = l),
      abrirModal: () => doc.createElement("div") as unknown as HTMLDialogElement,
      aviso: () => undefined,
      verificar: async (c) => ({ ...c, semResposta: undefined, erro: undefined, verificadoEm: 2 }),
    });
    const estado = () => ui.elemento.querySelector(".skill.conector code")?.textContent;
    checar("mostra 'sem resposta'", estado() === "sem resposta", estado());
    checar("com a orientacao de iniciar o servidor", ui.elemento.textContent?.includes(DESLIGADO) === true);
    const denovo = [...ui.elemento.querySelectorAll("button")].find((b) => b.textContent === "Testar de novo") as HTMLButtonElement | undefined;
    checar("e o botao de testar de novo", Boolean(denovo));
    denovo?.click();
    await new Promise((r) => setTimeout(r, 10));
    checar("depois do teste, mostra 'conectado'", estado() === "conectado · 2 ferramenta(s)", estado());
    checar("e o botao some", ![...ui.elemento.querySelectorAll("button")].some((b) => b.textContent === "Testar de novo"));
  }
}
