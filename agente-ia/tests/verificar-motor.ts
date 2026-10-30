/**
 * Motor com provedor roteirizado: cada rodada do "modelo" é uma função que
 * olha o histórico e devolve texto ou chamadas de tool. Assim o teste cobre o
 * laço inteiro sem rede e sem aleatoriedade.
 */

import { Pseudonimos } from "@nucleo/privacidade/anonimizar";
import { s, validar } from "../src/motor/esquema";
import { Motor, resolverReferencias } from "../src/motor/motor";
import { promptSistema } from "../src/motor/prompt";
import { Acumulador } from "../src/motor/provedor";
import type { DecisaoPlano, InterfaceMotor, Mensagem, PlanoPrevisto, Provedor, RegistroUsoChamada, RespostaLLM, Uso } from "../src/motor/tipos";
import { acumularUsoAuxiliar, usoVazio } from "../src/motor/uso";
import { TOOLS_MOTOR, toolsMotor } from "../src/tools/motor";
import { definirTool, RegistroTools } from "../src/motor/tools";
import { TOOLS_SEI } from "../src/tools/sei";
import { checar, secao } from "./util";

type Rodada = (historico: Mensagem[]) => RespostaLLM;

function provedor(rodadas: Rodada[], vistos: Mensagem[][]): Provedor {
  let i = 0;
  return {
    modelo: "teste",
    async conversar(p) {
      vistos.push(p.mensagens);
      const f = rodadas[i++];
      if (!f) return { texto: "fim", chamadas: [], fim: "stop" };
      return f(p.mensagens);
    },
  };
}

const chamada = (nome: string, args: unknown, id = nome) => ({ id, type: "function" as const, function: { name: nome, arguments: JSON.stringify(args) } });

function ui(decisao: Partial<DecisaoPlano> = { aprovado: true }): InterfaceMotor & { planos: PlanoPrevisto[]; avisos: string[]; usos: RegistroUsoChamada[]; totais: Uso[] } {
  const planos: PlanoPrevisto[] = [];
  const avisos: string[] = [];
  const usos: RegistroUsoChamada[] = [];
  const totais: Uso[] = [];
  return {
    planos,
    avisos,
    usos,
    totais,
    texto: () => undefined,
    fimDaResposta: () => undefined,
    toolIniciada: () => undefined,
    toolTerminada: () => undefined,
    aprovarPlano: async (p) => (planos.push(p), { aprovado: false, ...decisao }),
    progressoPlano: () => undefined,
    consentir: async () => true,
    perguntar: async () => "sim",
    tarefas: () => undefined,
    uso: (total, chamada) => void (totais.push(total), usos.push(chamada)),
    aviso: (t) => avisos.push(t),
  };
}

/** Uma aba do SEI de mentira: guarda o que foi pedido. */
function seiFalso(log: Array<{ op: string; args: Record<string, unknown> }>) {
  return async (op: string, args: Record<string, unknown>) => {
    log.push({ op, args });
    if (op === "processo.consultar") return { protocolo: args.processo, tipo: "Contrato", interessados: ["Maria Aparecida Souza"], especificacao: "Contrato de Maria Aparecida Souza, CPF 529.982.247-25" };
    if (op === "processo.anotacao") return { alvo: args.processo, mudancas: [{ campo: "Anotação", antes: "", depois: args.texto }], resumo: "ok", aplicado: args.aplicar };
    if (op === "documento.criar") return { alvo: args.processo, mudancas: [], resumo: "criado", aplicado: args.aplicar, dados: { numero: "0200001" } };
    if (op === "documento.assinar") return { alvo: args.numero, mudancas: [{ campo: "Assinatura", antes: "", depois: "assinado" }], resumo: "assinado", aplicado: args.aplicar, dados: { cargos: "Analista|Chefe" } };
    if (op === "documento.editar") return { alvo: args.numero, mudancas: [], resumo: "editado", aplicado: true };
    return {};
  };
}

export async function verificarMotor(): Promise<void> {
  secao("motor: retomada local preserva envelope sem chamar o provedor");
  {
    let chamadas = 0;
    const motor = new Motor({
      provedor: { modelo: "teste", conversar: async () => { chamadas++; return { texto: "ok", chamadas: [], fim: "stop" }; } },
      tools: new RegistroTools([]),
      ui: ui(),
      privacidade: new Pseudonimos(),
      sistema: (_tela, nonce) => `Envelope ${nonce}`,
      sei: async () => ({}),
    });
    const mensagens: Mensagem[] = [{ role: "user", content: "documento guardado" }, { role: "assistant", content: "analise anterior" }];
    motor.restaurar(mensagens, usoVazio(), "a1b2c3d4");
    checar("restaurar nao chama a IA", chamadas === 0);
    checar("mensagens anteriores permanecem", motor.mensagens().length === 2);
    checar("delimitador da conversa permanece", motor.envelope === "a1b2c3d4");
    motor.restaurar(mensagens, usoVazio(), "<invalido>");
    checar("delimitador invalido nao entra no prompt", motor.envelope === "a1b2c3d4");
    await motor.enviar("continuar");
    checar("somente a nova pergunta chama a IA", chamadas === 1);
  }

  secao("esquema");
  const esq = s.objeto({ n: s.inteiro({ min: 1 }), "t?": s.texto({ enum: ["a", "b"] }), l: s.lista(s.texto()) });
  checar("coage numero e lista de um", JSON.stringify(validar(esq, { n: "3", l: "x" }).valor) === JSON.stringify({ n: 3, l: ["x"] }));
  checar("enum invalido e campo desconhecido", validar(esq, { n: 1, l: [], t: "z", w: 1 }).erros.length === 2, validar(esq, { n: 1, l: [], t: "z", w: 1 }).erros);
  checar("obrigatorio", validar(esq, { l: [] }).erros.some((e) => e.includes("args.n")));

  secao("sse");
  const acc = new Acumulador();
  acc.somar({ choices: [{ delta: { content: "Ol" } }] });
  acc.somar({ choices: [{ delta: { content: "á", tool_calls: [{ index: 0, id: "c1", function: { name: "processo_", arguments: '{"proc' } }] } }] });
  acc.somar({ choices: [{ delta: { tool_calls: [{ index: 0, function: { name: "consultar", arguments: 'esso":"1"}' } }] }, finish_reason: "tool_calls" }], usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15, cost: 0.001, prompt_tokens_details: { cached_tokens: 4, cache_write_tokens: 3 }, completion_tokens_details: { reasoning_tokens: 2 } } });
  const r = acc.resposta();
  checar("junta texto e tool call fragmentados", r.texto === "Olá" && r.chamadas[0].function.name === "processo_consultar" && r.chamadas[0].function.arguments === '{"processo":"1"}');
  checar("uso detalhado e custo", r.uso?.custo === 0.001 && r.uso.total === 15 && r.uso.cache === 4 && r.uso.gravacaoCache === 3 && r.uso.raciocinio === 2, r.uso);

  secao("motor: um registro por chamada");
  {
    const u = ui();
    const uso1: Uso = { entrada: 10, cache: 4, gravacaoCache: 0, saida: 5, raciocinio: 2, total: 15, custo: 0.001 };
    const uso2: Uso = { entrada: 20, cache: 0, gravacaoCache: 8, saida: 7, raciocinio: 3, total: 27, custo: 0.002 };
    const m = new Motor({
      provedor: provedor(
        [
          () => ({ texto: "", chamadas: [chamada("processo_consultar", { processo: "1" })], fim: "tool_calls", uso: uso1 }),
          () => ({ texto: "pronto", chamadas: [], fim: "stop", uso: uso2 }),
        ],
        [],
      ),
      tools: new RegistroTools([...TOOLS_SEI, ...TOOLS_MOTOR]),
      ui: u,
      privacidade: new Pseudonimos(),
      sei: seiFalso([]),
      sistema: () => "s",
    });
    await m.enviar("consulte");
    checar("duas chamadas geram dois registros distintos", u.usos.length === 2 && u.usos[0].id !== u.usos[1].id && u.usos.every((x) => x.modelo === "teste"), u.usos);
    checar("total acumula categorias sem duplicar reasoning", u.totais[1]?.entrada === 30 && u.totais[1]?.saida === 12 && u.totais[1]?.raciocinio === 5 && u.totais[1]?.total === 42, u.totais[1]);
  }

  secao("referencias");
  const res = [{ itens: [{ numero: "0200001" }] }];
  checar("valor inteiro", resolverReferencias<unknown>("$1.itens.0.numero", res) === "0200001");
  checar("interpolacao", resolverReferencias({ t: "Ver {$1.itens.0.numero}." }, res).t === "Ver 0200001.");

  const tools = new RegistroTools([...TOOLS_SEI, ...TOOLS_MOTOR]);

  secao("motor: leitura e anonimizacao na fronteira");
  {
    const vistos: Mensagem[][] = [];
    const log: Array<{ op: string; args: Record<string, unknown> }> = [];
    const priv = new Pseudonimos();
    const m = new Motor({
      provedor: provedor([() => ({ texto: "", chamadas: [chamada("processo_consultar", { processo: "50300.018905/2018-67" })], fim: "tool_calls" })], vistos),
      tools,
      ui: ui(),
      privacidade: priv,
      sei: seiFalso(log),
      sistema: () => "sistema",
    });
    await m.enviar("Veja o processo do CPF 111.444.777-35 e me diga.");
    const tudo = JSON.stringify(vistos);
    checar("mensagem do usuario anonimizada", !tudo.includes("111.444.777-35") && tudo.includes("[CPF_1]"));
    checar("resultado da tool anonimizado (cpf e interessado)", !tudo.includes("529.982.247-25") && !tudo.includes("Maria Aparecida Souza"), tudo.slice(-400));
    checar("protocolo preservado", tudo.includes("50300.018905/2018-67"));
  }

  secao("motor: a previa aprovada acompanha a execucao do passo");
  {
    const recebidas: unknown[] = [];
    const gravar = definirTool({
      nome: "teste_gravar",
      descricao: "Grava algo, para o teste.",
      parametros: s.objeto({ alvo: s.texto() }),
      efeito: "escrita",
      rotulo: () => "Gravar",
      previsualizar: async (a) => [{ alvo: String(a.alvo), resumo: "", mudancas: [{ campo: "Destino", antes: "", depois: `pasta/${String(a.alvo)}` }] }],
      executar: async (_a, ctx) => (recebidas.push(ctx.previa), { aplicado: true }),
    });
    const m = new Motor({
      provedor: provedor([() => ({ texto: "", chamadas: [chamada("teste_gravar", { alvo: "a.pdf" })], fim: "tool_calls" })], []),
      tools: new RegistroTools([gravar]),
      ui: ui({ aprovado: true }),
      privacidade: new Pseudonimos(),
      sei: seiFalso([]),
      sistema: () => "sistema",
    });
    await m.enviar("grave");
    const previa = recebidas[0] as Array<{ mudancas: Array<{ depois: string }> }> | undefined;
    checar("a ferramenta recebe a previa que o usuario viu no cartao", previa?.[0]?.mudancas[0]?.depois === "pasta/a.pdf", recebidas);
  }

  secao("motor: escrita vira plano; recusa volta ao modelo");
  {
    const vistos: Mensagem[][] = [];
    const log: Array<{ op: string; args: Record<string, unknown> }> = [];
    const u = ui({ aprovado: false, motivo: "use outro texto" });
    const m = new Motor({
      provedor: provedor([() => ({ texto: "", chamadas: [chamada("processo_anotacao", { processos: ["1", "2"], texto: "revisar" })], fim: "tool_calls" })], vistos),
      tools,
      ui: u,
      privacidade: new Pseudonimos(),
      sei: seiFalso(log),
      sistema: () => "s",
    });
    await m.enviar("anote");
    checar("um plano com previa dos dois processos", u.planos.length === 1 && u.planos[0].passos[0].previa.length === 2);
    checar("previa nao grava", log.every((l) => l.args.aplicar === false));
    checar("motivo da recusa chega ao modelo", JSON.stringify(vistos[1]).includes("use outro texto"));
  }

  secao("motor: plano com referencia e reidratacao");
  {
    const log: Array<{ op: string; args: Record<string, unknown> }> = [];
    const priv = new Pseudonimos();
    priv.registrarPessoas(["Maria Aparecida Souza"]);
    priv.anonimizar("Maria Aparecida Souza"); // cria [PESSOA_1]
    const m = new Motor({
      provedor: provedor(
        [
          () => ({
            texto: "",
            chamadas: [
              chamada("plano_propor", {
                objetivo: "criar e anotar",
                passos: [
                  { tool: "documento_criar", args: { itens: [{ processo: "1", tipo: "Despacho", conteudo_html: "<p>Notifique [PESSOA_1].</p>" }] } },
                  { tool: "processo_anotacao", args: { processos: ["1"], texto: "Despacho {$1.itens.0.numero} criado" } },
                ],
              }),
            ],
            fim: "tool_calls",
          }),
        ],
        [],
      ),
      tools,
      ui: ui({ aprovado: true }),
      privacidade: priv,
      sei: seiFalso(log),
      sistema: () => "s",
    });
    await m.enviar("faça");
    const editar = log.find((l) => l.op === "documento.editar");
    checar("conteudo reidratado ao gravar", String(editar?.args.html).includes("Maria Aparecida Souza"), editar?.args);
    const anot = log.find((l) => l.op === "processo.anotacao" && l.args.aplicar === true);
    checar("referencia ao passo anterior resolvida", anot?.args.texto === "Despacho 0200001 criado", anot?.args);
  }

  secao("motor: argumentos invalidos e sigilo");
  {
    const vistos: Mensagem[][] = [];
    const m = new Motor({
      provedor: provedor([() => ({ texto: "", chamadas: [chamada("processo_anotacao", { texto: "x" })], fim: "tool_calls" })], vistos),
      tools,
      ui: ui(),
      privacidade: new Pseudonimos(),
      sei: seiFalso([]),
      sistema: () => "s",
    });
    await m.enviar("anote");
    checar("erro de argumento volta ao modelo", JSON.stringify(vistos[1]).includes("processos: obrigat"));
    const u = ui();
    let chamouModelo = false;
    const m2 = new Motor({
      provedor: { modelo: "x", conversar: async () => ((chamouModelo = true), { texto: "", chamadas: [], fim: "stop" }) },
      tools,
      ui: u,
      privacidade: new Pseudonimos(),
      sei: seiFalso([]),
      sistema: () => "s",
      tela: async () => ({ sigiloso: true }),
    });
    await m2.enviar("resuma");
    checar("processo sigiloso na tela: nada vai ao modelo", !chamouModelo && u.avisos.some((a) => a.includes("sigiloso")));
  }

  secao("motor: assinatura sem senha no modelo");
  {
    const vistos: Mensagem[][] = [];
    const log: Array<{ op: string; args: Record<string, unknown> }> = [];
    const u = ui({ aprovado: true, assinatura: { cargo: "Chefe", senha: "s3nh4-secreta" } });
    const m = new Motor({
      provedor: provedor([() => ({ texto: "", chamadas: [chamada("documento_assinar", { documentos: ["0104044"] })], fim: "tool_calls" })], vistos),
      tools,
      ui: u,
      privacidade: new Pseudonimos(),
      sei: seiFalso(log),
      sistema: () => "s",
    });
    await m.enviar("assine");
    checar("cargos do SEI chegam ao cartao", JSON.stringify(u.planos[0].passos[0].previa[0].cargos) === '["Analista","Chefe"]');
    const exec = log.find((l) => l.op === "documento.assinar" && l.args.aplicar === true);
    checar("senha chega a operacao na aba", exec?.args.senha === "s3nh4-secreta" && exec?.args.cargo === "Chefe");
    checar("senha nunca vai ao modelo", !JSON.stringify(vistos).includes("s3nh4-secreta"));
  }

  secao("motor: plano sem mudanca nao pede aprovacao");
  {
    const u = ui({ aprovado: true });
    const m = new Motor({
      provedor: provedor([() => ({ texto: "", chamadas: [chamada("processo_anotacao", { processos: ["1"], texto: "" })], fim: "tool_calls" })], []),
      tools,
      ui: u,
      privacidade: new Pseudonimos(),
      sei: async (op, args) => (op === "processo.anotacao" ? { alvo: "1", mudancas: [], resumo: "Nada a alterar", aplicado: false } : seiFalso([])(op, args)),
      sistema: () => "s",
    });
    await m.enviar("tire a anotacao");
    checar("sem cartao quando nada muda", u.planos.length === 0);
  }

  secao("compactacao: conversa longa");
  {
    const vistos: Mensagem[][] = [];
    const gigante = "y".repeat(300_000);
    // 1ª rodada: resposta enorme. 2ª: o começo deve chegar resumido.
    const rodadas: Rodada[] = [
      () => ({ texto: gigante, chamadas: [], fim: "stop" }),
      () => ({ texto: "resumo: o usuario pediu X e foi feito Y", chamadas: [], fim: "stop" }),
      () => ({ texto: "pronto", chamadas: [], fim: "stop" }),
    ];
    const interface_ = ui();
    const m = new Motor({
      provedor: provedor(rodadas, vistos),
      tools: new RegistroTools([]),
      privacidade: new Pseudonimos({ nomes: false, cnpj: false }),
      sei: async () => ({}),
      sistema: () => "sistema",
      ui: interface_,
    });
    await m.enviar("primeiro pedido");
    await m.enviar("segundo pedido");
    const ultimo = vistos[vistos.length - 1];
    const textoDoHistorico = ultimo.map((x) => (typeof x.content === "string" ? x.content : "")).join("\n");
    checar("o gigante nao vai inteiro de novo", !textoDoHistorico.includes(gigante));
    checar("o comeco virou resumo", textoDoHistorico.includes("Resumo da conversa"), textoDoHistorico.slice(0, 200));
    checar("o usuario e avisado do resumo", interface_.avisos.some((a) => /resumi o come\u00E7o/i.test(a)), interface_.avisos);
    checar("o pedido novo continua ali", textoDoHistorico.includes("segundo pedido"));
  }

  secao("delegar: agente auxiliar");
  const delegarTool = [...TOOLS_MOTOR].find((t) => t.nome === "delegar")!;
  checar("e interna: nao escreve no SEI", delegarTool.efeito === "interna");
  const pedidas: string[] = [];
  const ctxComAuxiliar = {
    sinal: new AbortController().signal,
    delegar: async (t: string) => {
      pedidas.push(t);
      return `resposta de ${t}`;
    },
  } as never;
  const r1 = (await delegarTool.executar({ tarefas: ["ler A", "ler B"] }, ctxComAuxiliar)) as { respostas: Array<{ tarefa: string; resultado?: string; erro?: string }> };
  checar("uma resposta por tarefa", r1.respostas.length === 2 && r1.respostas[1].resultado === "resposta de ler B", r1);
  checar("as tarefas vao como escritas", pedidas.join("|") === "ler A|ler B");
  const delegarLimitado = toolsMotor([], { maxParalelo: 2, maxPassos: 5 }).find((t) => t.nome === "delegar")!;
  const r2 = (await delegarLimitado.executar({ tarefas: ["a", "b", "c", "d", "e"] }, ctxComAuxiliar)) as { respostas: unknown[] };
  checar("respeita o maximo configurado", r2.respostas.length === 2);
  const maxDoEsquema = (delegarLimitado.parametros as { properties?: { tarefas?: { maxItems?: number } } }).properties?.tarefas?.maxItems;
  checar("informa o limite configurado ao modelo", maxDoEsquema === 2, maxDoEsquema);
  const semAuxiliar = (await delegarTool.executar({ tarefas: ["x"] }, { sinal: new AbortController().signal } as never)) as { erro?: string };
  checar("sem auxiliar disponivel, avisa em vez de quebrar", Boolean(semAuxiliar.erro));
  const comFalha = (await delegarTool.executar({ tarefas: ["x"] }, {
    sinal: new AbortController().signal,
    delegar: async () => {
      throw new Error("o auxiliar caiu");
    },
  } as never)) as { respostas: Array<{ erro?: string }> };
  checar("falha do auxiliar volta como erro daquela tarefa", comFalha.respostas[0].erro === "o auxiliar caiu");
  const toolsDoAuxiliar = [...TOOLS_SEI, ...toolsMotor()].filter((t) => t.efeito === "leitura" || t.nome === "skill_ler");
  checar("auxiliar so recebe leitura e nao pode delegar", toolsDoAuxiliar.every((t) => t.efeito === "leitura" || t.nome === "skill_ler") && !toolsDoAuxiliar.some((t) => t.nome === "delegar"));
  const usoAuxiliar = acumularUsoAuxiliar(usoVazio(), usoVazio(), { entrada: 8, saida: 2, total: 10, custo: 0.01 });
  checar("usage do auxiliar soma tambem na conversa", usoAuxiliar.execucao.total === 10 && usoAuxiliar.conversa.total === 10 && usoAuxiliar.conversa.custo === 0.01, usoAuxiliar);

  secao("motor: tool externa");
  {
    const externa = definirTool({
      nome: "mcp_chamar",
      descricao: "chama uma ferramenta de conector do usuario, fora do SEI, com o que o modelo mandar",
      parametros: s.objeto({ tool: s.texto() }),
      efeito: "externo",
      rotulo: () => "Conector: buscar",
      executar: async (_a, ctx) => `visto: ${ctx.anonimizar("o CPF 529.982.247-25")}`,
    });
    const vistos: Mensagem[][] = [];
    const painel = ui();
    const m = new Motor({
      provedor: provedor([() => ({ texto: "", chamadas: [chamada("mcp_chamar", { tool: "buscar" })], fim: "tool_calls" })], vistos),
      tools: new RegistroTools([externa]),
      ui: painel,
      privacidade: new Pseudonimos(),
      sei: seiFalso([]),
      sistema: () => "sistema",
    });
    await m.enviar("use o conector");
    checar("tool externa NAO vira plano", painel.planos.length === 0, painel.planos);
    const resultado = m.mensagens().find((x) => x.role === "tool") as { content: string } | undefined;
    checar("executou", Boolean(resultado));
    checar(
      "recebe o anonimizador no contexto",
      Boolean(resultado) && resultado!.content.includes("[CPF_1]") && !resultado!.content.includes("529.982.247-25"),
      resultado?.content,
    );
  }

  secao("motor: consentimento de conector e proprio");
  {
    const tipos: string[] = [];
    const duasVezes = definirTool({
      nome: "mcp_chamar",
      descricao: "chama uma ferramenta de conector do usuario duas vezes, para provar que o consentimento nao e memoizado",
      parametros: s.objeto({}),
      efeito: "externo",
      rotulo: () => "Conector",
      executar: async (_a, ctx) => {
        await ctx.consentirConector("primeiro conector");
        await ctx.consentirConector("segundo conector");
        await ctx.consentirRestrito("documento restrito");
        await ctx.consentirRestrito("outro documento restrito");
        return "ok";
      },
    });
    const painel = { ...ui(), consentir: async (tipo: "restrito" | "conector") => (tipos.push(tipo), true) };
    const m = new Motor({
      provedor: provedor([() => ({ texto: "", chamadas: [chamada("mcp_chamar", {})], fim: "tool_calls" })], []),
      tools: new RegistroTools([duasVezes]),
      ui: painel,
      privacidade: new Pseudonimos(),
      sei: seiFalso([]),
      sistema: () => "sistema",
    });
    await m.enviar("use o conector");
    checar("cada conector pergunta de novo (nao memoiza)", tipos.filter((x) => x === "conector").length === 2, tipos);
    checar("restrito continua perguntando uma vez por conversa", tipos.filter((x) => x === "restrito").length === 1, tipos);
  }

  secao("motor: prompt com conectores");
  {
    const texto = promptSistema(null, new Date(2026, 9, 1), "", [], "", '\n- Conectores do usuário: "Notion"');
    checar("o trecho dos conectores entra no prompt", texto.includes("Conectores do usuário"), texto.slice(-200));
    checar("sem conectores, o prompt nao muda", !promptSistema(null, new Date(2026, 9, 1)).includes("Conectores do usuário"));
  }

  secao("motor: a passada final (aoModelo) vale so para a chamada que a pediu");
  {
    // A passada troca "segredo" por "[x]"; a que lança impede que qualquer coisa do resultado vá ao modelo.
    const trocar = (t: string) => t.replace(/segredo/g, "[x]");
    const lancar = () => {
      throw new Error("falhou");
    };
    const previa = async () => [{ alvo: "a", mudancas: [{ campo: "c", antes: "", depois: "d" }], resumo: "r" }];
    const ferramenta = (nome: string, efeito: "leitura" | "escrita", passada?: (t: string) => string) =>
      definirTool({
        nome,
        descricao: `ferramenta de prova ${nome}: devolve um texto com a palavra segredo e, se for o caso, pede a passada final`,
        parametros: s.objeto({}),
        efeito,
        rotulo: () => nome,
        executar: async (_a, ctx) => {
          if (passada) ctx.aoModelo?.(passada);
          // As leituras rodam em paralelo: a outra roda enquanto esta espera.
          await new Promise((r) => setTimeout(r, 5));
          return { texto: `segredo de ${nome}` };
        },
        ...(efeito === "escrita" ? { previsualizar: previa } : {}),
      });
    const registro = new RegistroTools([
      ferramenta("le_com_passada", "leitura", trocar),
      ferramenta("le_sem_passada", "leitura"),
      ferramenta("le_que_lanca", "leitura", lancar),
      ferramenta("escreve_com_passada", "escrita", trocar),
      ferramenta("escreve_sem_passada", "escrita"),
      ferramenta("escreve_que_lanca", "escrita", lancar),
    ]);
    /** As mensagens de ferramenta que o modelo recebe, por id da chamada, numa rodada com `nomes`. */
    const rodada = async (nomes: string[]): Promise<Map<string, string>> => {
      const m = new Motor({
        provedor: provedor([() => ({ texto: "", chamadas: nomes.map((n) => chamada(n, {})), fim: "tool_calls" })], []),
        tools: registro,
        ui: ui({ aprovado: true }),
        privacidade: new Pseudonimos(),
        sei: seiFalso([]),
        sistema: () => "s",
      });
      await m.enviar("prova");
      return new Map(m.mensagens().flatMap((x) => (x.role === "tool" ? [[x.tool_call_id, x.content] as [string, string]] : [])));
    };
    const puro = (nome: string) => JSON.stringify({ texto: `segredo de ${nome}` });
    const ERRO = "nada dele foi enviado";
    const leituras = await rodada(["le_com_passada", "le_sem_passada", "le_que_lanca"]);
    checar(
      "leituras em paralelo: cada uma com a sua passada (a de uma nao vale para a outra)",
      leituras.get("le_com_passada") === JSON.stringify({ texto: "[x] de le_com_passada" }) && leituras.get("le_sem_passada") === puro("le_sem_passada"),
      [...leituras],
    );
    checar(
      "passada que lanca: so a mensagem de erro vai ao modelo, nada do resultado",
      (leituras.get("le_que_lanca") ?? "").includes(ERRO) && !(leituras.get("le_que_lanca") ?? "").includes("segredo"),
      leituras.get("le_que_lanca"),
    );
    const sozinha = await rodada(["le_sem_passada"]);
    checar("ferramenta sem passada: a saida e identica ao resultado", sozinha.get("le_sem_passada") === puro("le_sem_passada"), sozinha.get("le_sem_passada"));
    const escritas = await rodada(["escreve_com_passada", "escreve_sem_passada"]);
    checar(
      "passos do mesmo plano: a passada de um nao vale para o resultado do outro",
      escritas.get("escreve_com_passada") === JSON.stringify({ texto: "[x] de escreve_com_passada" }) &&
        escritas.get("escreve_sem_passada") === puro("escreve_sem_passada"),
      [...escritas],
    );
    const escritas2 = await rodada(["escreve_que_lanca", "escreve_sem_passada"]);
    checar(
      "passo cuja passada lanca: so ele vira a mensagem de erro; o outro passo do plano chega inteiro",
      (escritas2.get("escreve_que_lanca") ?? "").includes(ERRO) &&
        !(escritas2.get("escreve_que_lanca") ?? "").includes("segredo") &&
        escritas2.get("escreve_sem_passada") === puro("escreve_sem_passada"),
      [...escritas2],
    );
  }

  secao("tools: contrato");
  checar("toda escrita tem previa", tools.todas().every((t) => t.efeito === "leitura" || t.efeito === "interna" || typeof t.previsualizar === "function"));
  checar("todo esquema e objeto", tools.todas().every((t) => t.parametros.type === "object"));
  checar("descricoes longas o bastante", tools.todas().every((t) => t.descricao.length > 60), tools.todas().filter((t) => t.descricao.length <= 60).map((t) => t.nome));
}
