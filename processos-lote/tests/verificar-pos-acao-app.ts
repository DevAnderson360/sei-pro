/**
 * Provas do painel "Depois de criar" (app): incluir em bloco interno, aplicar marcador e acompanhar sobre os
 * processos criados, com RPC falso. Cada prova conta as chamadas a aba: o que nao pode acontecer e reenviar uma
 * inclusao em bloco nao confirmada (o POST pode ter entrado) ou tocar uma linha incerta.
 */

import { areaMemoria } from "@comum/armazenamento/area";
import { ErroRpc } from "@comum/ponte/rpc";
import { AppProcessosLote, type DepsApp } from "@pl/app/app";
import { type ItemProc, MENSAGEM_SESSAO } from "@pl/app/execucao";
import {
  MAX_OBSERVACAO,
  MAX_TEXTO_MARCADOR,
  MENSAGEM_RECARREGAR,
  PAUSA_POS_ACAO_MS,
  PainelPosAcao,
  PRAZO_POS_ACAO_BLOCO_MS,
  PRAZO_POS_ACAO_MS,
  TEXTO_FORA_DA_PAGINA,
} from "@pl/app/posAcao";
import { type PosAcoes, RepositorioModelos } from "@pl/modelos";
import { NUMERO_INCERTO, NUMERO_NAO_IDENTIFICADO } from "@pl/pagina/executor";
import type { OpcoesPosAcao } from "@pl/pagina/posAcao";
import { type LoteEmAndamento, RepositorioLote } from "@pl/repositorio";
import { botao, checar, combo, disparar, escolherCombo, igual, instalarDom, secao, tique } from "./util";

const ESCOPO = "sei.x.gov.br|ana";

const OPCOES: OpcoesPosAcao = {
  marcadores: [
    { id: "m1", nome: "Urgente" },
    { id: "m2", nome: "Aguardando" },
  ],
  grupos: [{ id: "g1", nome: "Licitações" }],
  blocos: [
    { id: "b7", numero: "12", descricao: "Contratos de 2026" },
    { id: "b8", numero: "13", descricao: "Pregões" },
  ],
  avisos: [],
  falharam: [],
};

const numero = (n: number) => `00001.00000${n}/2026-1${n}`;
const itemOk = (indice: number, n = indice + 1): ItemProc => ({
  indice,
  entrada: { especificacao: `E${indice}` },
  situacao: "ok",
  tentativas: 0,
  resultado: { criado: { numero: numero(n), idProcedimento: String(100 + n), url: `https://sei.x.gov.br/p?id=${100 + n}` } },
});
const itemIncerto = (indice: number): ItemProc => ({
  indice,
  entrada: { especificacao: `E${indice}` },
  situacao: "ok",
  tentativas: 0,
  resultado: { criado: { numero: NUMERO_INCERTO, idProcedimento: "", url: "" }, aviso: "sem confirmação", incerto: true },
});
const itemNaoIdentificado = (indice: number): ItemProc => ({
  indice,
  entrada: { especificacao: `E${indice}` },
  situacao: "ok",
  tentativas: 0,
  resultado: { criado: { numero: NUMERO_NAO_IDENTIFICADO, idProcedimento: "", url: "" }, aviso: "número não identificado" },
});

type Tratador = (args: Record<string, unknown>, vez: number) => unknown;

interface OpcoesMontar {
  opcoes?: Tratador;
  posAcao?: Tratador;
  bloco?: Tratador;
  /** O modelo aplicado na configuracao (Task 21). */
  modelo?: { nome: string; posAcoes?: PosAcoes; guardar(p: PosAcoes): Promise<boolean> };
}

async function ate(cond: () => boolean, limite = 300): Promise<void> {
  for (let i = 0; i < limite && !cond(); i += 1) await tique(2);
}

function segurar<T>() {
  let soltar!: (v: T) => void;
  const p = new Promise<T>((r) => {
    soltar = r;
  });
  return { p, soltar };
}

/** Bloco: todos incluidos. */
const blocoTodos: Tratador = (a) => ({
  resultados: (a.idsProcedimento as string[]).map((id) => ({ idProcedimento: id, situacao: "incluido" })),
});
const posOk: Tratador = (a) => ({ situacao: "ok", mensagem: `${a.acao} ok` });

function rpcFalso(o: OpcoesMontar) {
  const chamadas: Array<{ op: string; args: Record<string, unknown>; prazo?: number }> = [];
  const vezes = new Map<string, number>();
  const chamar = (async (op: string, args?: unknown, prazo?: number) => {
    const a = (args ?? {}) as Record<string, unknown>;
    chamadas.push({ op, args: a, prazo });
    const v = (vezes.get(op) ?? 0) + 1;
    vezes.set(op, v);
    await tique(1);
    let r: unknown;
    if (op === "posAcaoOpcoes") r = o.opcoes ? await o.opcoes(a, v) : OPCOES;
    else if (op === "posAcao") r = await (o.posAcao ?? posOk)(a, v);
    else if (op === "posAcaoBloco") r = await (o.bloco ?? blocoTodos)(a, v);
    else r = true;
    if (r instanceof Error) throw r;
    return r;
  }) as DepsApp["rpc"]["chamar"];
  const de = (op: string) => chamadas.filter((c) => c.op === op);
  return { chamar, chamadas, de };
}

function montarPainel(itens: ItemProc[], o: OpcoesMontar = {}) {
  const doc = instalarDom('<html><body><div id="r"></div></body></html>');
  const raiz = doc.getElementById("r")!;
  const rpc = rpcFalso(o);
  const pausas: number[] = [];
  let mudancas = 0;
  const p = new PainelPosAcao(itens, {
    rpc: { chamar: rpc.chamar },
    aoMudar: () => {
      mudancas += 1;
    },
    esperar: async (ms) => {
      pausas.push(ms);
    },
    modelo: o.modelo,
  });
  raiz.append(p.el);
  const abrir = async () => {
    disparar(raiz.querySelector(".pl-pos-abrir")!, "click");
    await ate(() => rpc.de("posAcaoOpcoes").length > 0);
    await tique(10);
  };
  const ligar = (acao: string, ligado = true) => {
    const c = raiz.querySelector<HTMLInputElement>(`input[data-acao="${acao}"]`)!;
    c.checked = ligado;
    disparar(c, "change");
  };
  const aplicar = async () => {
    disparar(botao(raiz, "Aplicar")!, "click");
    await ate(() => !p.rodando);
  };
  const repetir = async () => {
    disparar(botao(raiz, "Tentar de novo as falhas")!, "click");
    await ate(() => !p.rodando);
  };
  const visivel = (texto: string) => {
    const b = botao(raiz, texto);
    return !!b && !b.hidden && !b.closest("[hidden]");
  };
  const texto = () => raiz.textContent ?? "";
  const posDe = (acao: string) => rpc.de("posAcao").filter((c) => c.args.acao === acao);
  return { doc, raiz, p, rpc, pausas, abrir, ligar, aplicar, repetir, visivel, texto, posDe, mudancas: () => mudancas };
}

/* ------------------------------------------------------------ app (lote gravado) */

async function montarApp(itens: LoteEmAndamento["itens"], o: OpcoesMontar = {}) {
  const doc = instalarDom('<html><body><div id="app"></div></body></html>');
  const raiz = doc.getElementById("app")!;
  const area = areaMemoria();
  const linhas = itens.map((_, k) => ({ especificacao: `E${k}` }));
  await new RepositorioLote(area, ESCOPO, () => 1).gravar({
    id: "x",
    host: "sei.x.gov.br",
    login: "ana",
    iniciadoEm: 1,
    parametros: { idTipo: "10", nomeTipo: "Contrato", nivelAcesso: "0", hipoteseLegal: "", nomeHipotese: "", pausa: 500 },
    linhas,
    itens,
  });
  const rpc = rpcFalso(o);
  const baixados: Array<{ nome: string; conteudo: string }> = [];
  const deps: DepsApp = {
    rpc: { chamar: rpc.chamar },
    ctx: { host: "sei.x.gov.br", login: "ana", temaEscuro: false },
    repo: new RepositorioLote(area, ESCOPO, () => 1_000_000),
    modelos: new RepositorioModelos(area, ESCOPO, () => 1_000_000),
    area,
    abrirModal: () => ({ fechar: () => {} }),
    confirmar: async () => true,
    baixar: (nome, conteudo) => void baixados.push({ nome, conteudo }),
    clip: { writeText: async () => {} },
    fechar: () => {},
    minimizar: async () => {},
    gravarEntradaLink: async () => {},
    esperar: async () => {},
    avisar: () => {},
    agora: () => 1_000_000,
  };
  const app = new AppProcessosLote(raiz, deps);
  await app.iniciar();
  await ate(() => !!raiz.querySelector(".pl-resultado"));
  return { doc, raiz, app, rpc, baixados };
}

const criadoGravado = (n: number) => ({
  situacao: "ok" as const,
  criado: { numero: numero(n), idProcedimento: String(100 + n), url: `https://sei.x.gov.br/p?id=${100 + n}` },
});
const incertoGravado = {
  situacao: "ok" as const,
  criado: { numero: NUMERO_INCERTO, idProcedimento: "", url: "" },
  aviso: "sem confirmação",
  incerto: true,
};

export async function verificarPosAcaoApp(): Promise<void> {
  secao("Depois de criar: painel recolhido, listas carregadas uma vez ao abrir, avisos por lista");
  {
    const m = montarPainel([itemOk(0), itemOk(1)], {
      opcoes: () => ({ ...OPCOES, grupos: [], avisos: ["Não foi possível listar os grupos de acompanhamento: falhou"] }),
    });
    checar("recolhido de início", !!m.raiz.querySelector(".pl-pos-corpo[hidden]"));
    checar("nada pedido antes de abrir", m.rpc.chamadas.length === 0);
    await m.abrir();
    checar("aberto", !m.raiz.querySelector(".pl-pos-corpo[hidden]"));
    igual("posAcaoOpcoes com o protocolo do primeiro processo", m.rpc.de("posAcaoOpcoes")[0]?.args, { protocolo: numero(1) });
    checar("aviso da lista que falhou aparece", m.texto().includes("Não foi possível listar os grupos de acompanhamento"));
    checar(
      "três blocos em pt-BR",
      ["Incluir em bloco interno", "Aplicar marcador", "Acompanhar"].every((t) => m.texto().includes(t)),
    );
    disparar(m.raiz.querySelector(".pl-pos-abrir")!, "click");
    disparar(m.raiz.querySelector(".pl-pos-abrir")!, "click");
    await tique(10);
    checar("fechar e abrir de novo não recarrega", m.rpc.de("posAcaoOpcoes").length === 1, m.rpc.de("posAcaoOpcoes").length);
    checar("Aplicar desligado sem nenhuma ação ligada", botao(m.raiz, "Aplicar")?.disabled === true);
    m.ligar("marcador");
    checar("marcador ligado sem escolher: ainda desligado", botao(m.raiz, "Aplicar")?.disabled === true);
    escolherCombo(m.doc, "Marcador", "m1");
    checar("com o marcador escolhido: ligado", botao(m.raiz, "Aplicar")?.disabled === false);
    m.ligar("marcador", false);
    checar("desligar a única ação desliga o Aplicar", botao(m.raiz, "Aplicar")?.disabled === true);
  }

  secao("Depois de criar: uma ação ligada roda só ela, um processo por vez");
  {
    const m = montarPainel([itemOk(0), itemOk(1), itemOk(2)]);
    await m.abrir();
    escolherCombo(m.doc, "Marcador", "m1");
    checar("escolher o marcador liga a ação", m.raiz.querySelector<HTMLInputElement>('input[data-acao="marcador"]')?.checked === true);
    await m.aplicar();
    checar("três posAcao de marcador", m.posDe("marcador").length === 3, m.rpc.chamadas);
    checar("nenhum acompanhar", m.posDe("acompanhar").length === 0);
    checar("nenhum bloco", m.rpc.de("posAcaoBloco").length === 0);
    igual("argumentos: nome do marcador, protocolo e id; sem texto vazio", m.posDe("marcador")[0]?.args, {
      acao: "marcador",
      protocolo: numero(1),
      idProcedimento: "101",
      marcador: "Urgente",
    });
    checar(
      "prazo de 30 s por chamada",
      m.posDe("marcador").every((c) => c.prazo === PRAZO_POS_ACAO_MS),
    );
    igual("pausa de 300 ms entre processos", m.pausas, [PAUSA_POS_ACAO_MS, PAUSA_POS_ACAO_MS]);
    checar("coluna diz aplicado", m.p.depois(itemOk(0)) === "Marcador: ✔ aplicado", m.p.depois(itemOk(0)));
    checar("sem falha, sem Tentar de novo", !m.visivel("Tentar de novo as falhas"));
    checar("redesenhou o resultado", m.mudancas() > 0);
  }

  secao("Depois de criar: as três rodam e a falha de uma não impede as outras");
  {
    const m = montarPainel([itemOk(0), itemOk(1)], {
      bloco: (a) => ({
        resultados: (a.idsProcedimento as string[]).map((id) =>
          id === "101" ? { idProcedimento: id, situacao: "erro", mensagem: "Bloco sumiu." } : { idProcedimento: id, situacao: "ja-estava" },
        ),
      }),
      posAcao: (a) =>
        a.acao === "marcador" && a.idProcedimento === "102"
          ? { situacao: "erro", mensagem: "Marcador inexistente." }
          : a.acao === "acompanhar"
            ? { situacao: "ja-estava", mensagem: "Nada a alterar." }
            : { situacao: "ok", mensagem: "ok" },
    });
    await m.abrir();
    escolherCombo(m.doc, "Bloco interno", "b7");
    escolherCombo(m.doc, "Marcador", "m2");
    m.ligar("acompanhar");
    escolherCombo(m.doc, "Grupo de acompanhamento", "g1");
    (m.raiz.querySelector("textarea.pl-pos-observacao") as HTMLTextAreaElement).value = "ver contrato";
    await m.aplicar();
    const bl = m.rpc.de("posAcaoBloco");
    checar("bloco: uma chamada só", bl.length === 1, bl.length);
    igual("bloco: todos os ids juntos", bl[0]?.args, { idBloco: "b7", idsProcedimento: ["101", "102"] });
    checar("bloco: prazo de 60 s", bl[0]?.prazo === PRAZO_POS_ACAO_BLOCO_MS);
    checar("marcador nos dois apesar do erro do bloco", m.posDe("marcador").length === 2);
    checar("acompanhar nos dois apesar do erro do marcador", m.posDe("acompanhar").length === 2);
    igual("acompanhar leva grupo e observação", m.posDe("acompanhar")[0]?.args, {
      acao: "acompanhar",
      protocolo: numero(1),
      idProcedimento: "101",
      grupo: "g1",
      observacao: "ver contrato",
    });
    checar(
      "linha 1: bloco com erro, marcador aplicado, acompanhamento já estava",
      m.p.depois(itemOk(0)) === "Bloco: ✖ Bloco sumiu.; Marcador: ✔ aplicado; Acompanhamento: ↺ já estava",
      m.p.depois(itemOk(0)),
    );
    checar(
      "linha 2: bloco já estava, marcador com erro",
      m.p.depois(itemOk(1)) === "Bloco: ↺ já estava; Marcador: ✖ Marcador inexistente.; Acompanhamento: ↺ já estava",
      m.p.depois(itemOk(1)),
    );
    checar("Tentar de novo as falhas aparece", m.visivel("Tentar de novo as falhas"));

    secao("Depois de criar: Tentar de novo as falhas repete só os erros de cada ação");
    await m.repetir();
    const bl2 = m.rpc.de("posAcaoBloco");
    checar("bloco: mais uma chamada", bl2.length === 2);
    igual("bloco: só o id com erro", bl2[1]?.args, { idBloco: "b7", idsProcedimento: ["101"] });
    checar("marcador: só o processo com erro", m.posDe("marcador").length === 3 && m.posDe("marcador")[2]?.args.idProcedimento === "102");
    checar("acompanhar: nada (já estava)", m.posDe("acompanhar").length === 2);
  }

  secao("Depois de criar: linhas incertas ficam de fora das três ações");
  {
    const m = montarPainel([itemIncerto(0), itemOk(1, 2), itemNaoIdentificado(2), itemOk(3, 4)]);
    checar("dois alvos", m.p.alvos.length === 2);
    checar(
      "o painel diz quantas ficaram de fora e por quê",
      m.texto().includes("2 linhas ficaram de fora") && m.texto().includes("não confirmou"),
    );
    await m.abrir();
    igual("listas pelo primeiro processo confirmado", m.rpc.de("posAcaoOpcoes")[0]?.args, { protocolo: numero(2) });
    escolherCombo(m.doc, "Bloco interno", "b8");
    escolherCombo(m.doc, "Marcador", "m1");
    escolherCombo(m.doc, "Grupo de acompanhamento", "g1");
    await m.aplicar();
    igual("bloco só com os confirmados", m.rpc.de("posAcaoBloco")[0]?.args.idsProcedimento, ["102", "104"]);
    const tocados = m.rpc.de("posAcao").map((c) => c.args.protocolo);
    checar("posAcao nunca num incerto", tocados.length === 4 && tocados.every((p) => p === numero(2) || p === numero(4)), tocados);
    checar("coluna vazia nas incertas", m.p.depois(itemIncerto(0)) === "" && m.p.depois(itemNaoIdentificado(2)) === "");
  }

  secao("Depois de criar: não confirmado nunca é reenviado (nem pelo Tentar de novo, nem por novo Aplicar)");
  {
    const m = montarPainel([itemOk(0), itemOk(1)], {
      bloco: (a, vez) => ({
        resultados: (a.idsProcedimento as string[]).map((id) =>
          id === "101"
            ? { idProcedimento: id, situacao: "nao-confirmado", mensagem: "Não confirmado." }
            : vez === 1
              ? { idProcedimento: id, situacao: "erro", mensagem: "Falhou antes do POST." }
              : { idProcedimento: id, situacao: "incluido" },
        ),
      }),
    });
    await m.abrir();
    escolherCombo(m.doc, "Bloco interno", "b7");
    await m.aplicar();
    checar("mostra confira o bloco 12", m.p.depois(itemOk(0)) === "Bloco: ? não confirmado: confira o bloco 12", m.p.depois(itemOk(0)));
    await m.repetir();
    igual("retry só com o erro", m.rpc.de("posAcaoBloco")[1]?.args.idsProcedimento, ["102"]);
    await m.aplicar();
    const ids = m.rpc.de("posAcaoBloco").flatMap((c) => c.args.idsProcedimento as string[]);
    checar("101 postado uma vez só", ids.filter((x) => x === "101").length === 1, ids);
    checar("continua não confirmado", m.p.estado(0, "bloco")?.situacao === "nao-confirmado");
  }

  secao("Depois de criar: a ponte não responde à inclusão em bloco => não confirmado, sem repostar");
  {
    const m = montarPainel([itemOk(0), itemOk(1)], {
      bloco: () => new ErroRpc("PRAZO", "A aba do SEI não respondeu a tempo."),
    });
    await m.abrir();
    escolherCombo(m.doc, "Bloco interno", "b7");
    escolherCombo(m.doc, "Marcador", "m1");
    await m.aplicar();
    checar(
      "todos não confirmados",
      m.p.estado(0, "bloco")?.situacao === "nao-confirmado" && m.p.estado(1, "bloco")?.situacao === "nao-confirmado",
    );
    checar("confira o bloco na coluna", m.p.depois(itemOk(1)).includes("confira o bloco 12"));
    checar("o marcador seguiu", m.posDe("marcador").length === 2);
    checar("sem erro, sem Tentar de novo", !m.visivel("Tentar de novo as falhas"));
    await m.p.repetirFalhas();
    checar("retry não reposta o bloco", m.rpc.de("posAcaoBloco").length === 1);
  }

  secao("Revisão final: aba com o SEI Pro antigo (operação desconhecida) => recarregar, e o bloco é erro certo");
  {
    const velha = (op: string) => new ErroRpc("OP_DESCONHECIDA", `Operação desconhecida: ${op}`);
    const m = montarPainel([itemOk(0), itemOk(1)], {
      bloco: (_a, vez) => (vez === 1 ? velha("posAcaoBloco") : blocoTodos(_a, vez)),
      posAcao: (a, vez) => (vez === 1 ? velha("posAcao") : posOk(a, vez)),
    });
    await m.abrir();
    escolherCombo(m.doc, "Bloco interno", "b7");
    escolherCombo(m.doc, "Marcador", "m1");
    await m.aplicar();
    checar(
      "bloco: erro (nada foi enviado), não 'não confirmado'",
      m.p.estado(0, "bloco")?.situacao === "erro" && m.p.estado(1, "bloco")?.situacao === "erro",
      m.p.estado(0, "bloco"),
    );
    checar("bloco: mensagem de recarregar", m.p.estado(0, "bloco")?.mensagem === MENSAGEM_RECARREGAR, m.p.estado(0, "bloco"));
    checar(
      "marcador: mensagem de recarregar",
      m.p.estado(0, "marcador")?.situacao === "erro" && m.p.estado(0, "marcador")?.mensagem === MENSAGEM_RECARREGAR,
      m.p.estado(0, "marcador"),
    );
    await m.repetir();
    checar("depois de recarregar, o bloco pode ser repetido", m.rpc.de("posAcaoBloco").length === 2);
    checar("bloco incluído na repetição", m.p.estado(0, "bloco")?.situacao === "ok" && m.p.estado(1, "bloco")?.situacao === "ok");

    const o = montarPainel([itemOk(0)], { opcoes: () => velha("posAcaoOpcoes") });
    await o.abrir();
    checar("listas: mensagem de recarregar", o.texto().includes(MENSAGEM_RECARREGAR), o.texto());
    igual("texto da mensagem", MENSAGEM_RECARREGAR, "O SEI Pro foi atualizado: recarregue a página do SEI (F5) e tente de novo.");
  }

  secao("Depois de criar: rpc do marcador cai => erro (idempotente: repetir é seguro)");
  {
    const m = montarPainel([itemOk(0)], {
      posAcao: (_a, vez) => (vez === 1 ? new ErroRpc("PRAZO", "Sem resposta.") : { situacao: "ja-estava", mensagem: "Nada a alterar." }),
    });
    await m.abrir();
    escolherCombo(m.doc, "Marcador", "m1");
    await m.aplicar();
    checar("erro com a mensagem", m.p.depois(itemOk(0)) === "Marcador: ✖ Sem resposta.", m.p.depois(itemOk(0)));
    await m.repetir();
    checar("repetido, já estava", m.p.depois(itemOk(0)) === "Marcador: ↺ já estava" && m.posDe("marcador").length === 2);
  }

  secao("Depois de criar: fora da página do Controle");
  {
    const m = montarPainel([itemOk(0), itemOk(1)], {
      bloco: (a) => ({
        resultados: (a.idsProcedimento as string[]).map((id) =>
          id === "102"
            ? { idProcedimento: id, situacao: "fora-da-pagina", mensagem: "O processo não está na página do Controle de Processos." }
            : { idProcedimento: id, situacao: "incluido" },
        ),
      }),
    });
    await m.abrir();
    escolherCombo(m.doc, "Bloco interno", "b7");
    await m.aplicar();
    checar("incluído", m.p.depois(itemOk(0)) === "Bloco: ✔ incluído");
    checar(
      "mensagem fora da página",
      m.p.depois(itemOk(1)) === `Bloco: ${TEXTO_FORA_DA_PAGINA}` &&
        TEXTO_FORA_DA_PAGINA === "fora da página do Controle: faça pelo Controle de Processos",
      m.p.depois(itemOk(1)),
    );
    checar("não entra no Tentar de novo", !m.visivel("Tentar de novo as falhas"));
    await m.p.repetirFalhas();
    checar("nenhuma chamada nova", m.rpc.de("posAcaoBloco").length === 1);
  }

  secao("Depois de criar: duplo clique em Aplicar inicia uma execução só");
  {
    const m = montarPainel([itemOk(0), itemOk(1)]);
    await m.abrir();
    escolherCombo(m.doc, "Bloco interno", "b7");
    escolherCombo(m.doc, "Marcador", "m1");
    const b = botao(m.raiz, "Aplicar")!;
    disparar(b, "click");
    disparar(b, "click");
    checar("desligado durante a execução", b.disabled === true);
    await ate(() => !m.p.rodando);
    checar("um bloco", m.rpc.de("posAcaoBloco").length === 1);
    checar("um marcador por processo", m.posDe("marcador").length === 2);
  }

  secao("Depois de criar: limites do texto do marcador (250) e da observação (500)");
  {
    const m = montarPainel([itemOk(0)]);
    await m.abrir();
    const texto = m.raiz.querySelector<HTMLInputElement>('input[aria-label="Texto do marcador"]')!;
    const obs = m.raiz.querySelector<HTMLTextAreaElement>("textarea.pl-pos-observacao")!;
    checar("maxlength 250 no texto", texto.getAttribute("maxlength") === String(MAX_TEXTO_MARCADOR) && MAX_TEXTO_MARCADOR === 250);
    checar("maxlength 500 na observação", obs.getAttribute("maxlength") === String(MAX_OBSERVACAO) && MAX_OBSERVACAO === 500);
    escolherCombo(m.doc, "Marcador", "m1");
    m.ligar("acompanhar");
    texto.value = "a".repeat(300);
    obs.value = "b".repeat(600);
    await m.aplicar();
    checar("texto cortado em 250", (m.posDe("marcador")[0]?.args.texto as string)?.length === 250);
    checar("observação cortada em 500", (m.posDe("acompanhar")[0]?.args.observacao as string)?.length === 500);
    checar("acompanhar sem grupo não manda grupo", !("grupo" in (m.posDe("acompanhar")[0]?.args ?? {})));
  }

  secao("Depois de criar: sessão expirada pausa com a mensagem da etapa 1; Continuar segue de onde parou");
  {
    const m = montarPainel([itemOk(0), itemOk(1)], {
      posAcao: (a, vez) =>
        a.acao === "marcador" && vez === 1
          ? { situacao: "erro", mensagem: "Sessão expirada.", parar: true }
          : { situacao: "ok", mensagem: "ok" },
    });
    await m.abrir();
    escolherCombo(m.doc, "Marcador", "m1");
    m.ligar("acompanhar");
    await m.aplicar();
    checar("parou no primeiro processo", m.rpc.de("posAcao").length === 1, m.rpc.chamadas);
    checar("mensagem da sessão", m.texto().includes(MENSAGEM_SESSAO));
    checar("acompanhar do mesmo processo não foi enviado (erro repetível)", m.p.estado(0, "acompanhar")?.situacao === "erro");
    checar("Continuar visível", m.visivel("Continuar"));
    disparar(botao(m.raiz, "Continuar")!, "click");
    await ate(() => !m.p.rodando);
    checar("segundo processo rodou", m.posDe("marcador").length === 2 && m.posDe("acompanhar").length === 1);
    checar("primeiro não repetido pelo Continuar", m.posDe("marcador").filter((c) => c.args.idProcedimento === "101").length === 1);
    checar("mensagem some", !m.texto().includes(MENSAGEM_SESSAO));
  }

  secao("Depois de criar: sessão expirada na inclusão em bloco pausa antes do marcador");
  {
    const m = montarPainel([itemOk(0)], {
      bloco: (a) => ({
        resultados: (a.idsProcedimento as string[]).map((id) => ({ idProcedimento: id, situacao: "nao-confirmado", mensagem: "x" })),
        parar: true,
      }),
    });
    await m.abrir();
    escolherCombo(m.doc, "Bloco interno", "b7");
    escolherCombo(m.doc, "Marcador", "m1");
    await m.aplicar();
    checar("marcador não enviado", m.posDe("marcador").length === 0);
    checar("mensagem da sessão", m.texto().includes(MENSAGEM_SESSAO));
    disparar(botao(m.raiz, "Continuar")!, "click");
    await ate(() => !m.p.rodando);
    checar("Continuar roda o marcador, não o bloco", m.posDe("marcador").length === 1 && m.rpc.de("posAcaoBloco").length === 1);
  }

  secao("Fix 1: não confirmado no bloco 12 sobrevive a um Aplicar no 13 e nunca é reenviado ao 12");
  {
    const m = montarPainel([itemOk(0), itemOk(1)], {
      bloco: (_a, vez) => (vez === 1 ? new ErroRpc("PRAZO", "A aba do SEI não respondeu a tempo.") : blocoTodos(_a, vez)),
    });
    await m.abrir();
    escolherCombo(m.doc, "Bloco interno", "b7");
    await m.aplicar();
    checar("bloco 12: não confirmado", m.p.estado(0, "bloco")?.situacao === "nao-confirmado");
    escolherCombo(m.doc, "Bloco interno", "b8");
    checar(
      "aviso ao trocar para o 13",
      m.texto().includes("2 processos não confirmados no bloco 12 também serão incluídos no 13."),
      m.raiz.querySelector(".pl-pos-aviso-bloco")?.textContent,
    );
    await m.aplicar();
    igual("bloco 13: os dois ids", m.rpc.de("posAcaoBloco")[1]?.args, { idBloco: "b8", idsProcedimento: ["101", "102"] });
    checar(
      "coluna mantém o 12 e mostra o 13",
      m.p.depois(itemOk(0)) === "Bloco: ✔ incluído; Bloco: ? não confirmado: confira o bloco 12",
      m.p.depois(itemOk(0)),
    );
    checar("status ainda conta os não confirmados", m.texto().includes("2 não confirmadas (confira o bloco)"));
    escolherCombo(m.doc, "Bloco interno", "b7");
    checar("sem aviso com o 12 escolhido", m.raiz.querySelector(".pl-pos-aviso-bloco")?.hasAttribute("hidden") === true);
    await m.aplicar();
    const chamadas12 = m.rpc.de("posAcaoBloco").filter((c) => c.args.idBloco === "b7");
    checar("12 de novo: nenhuma chamada nova", chamadas12.length === 1 && m.rpc.de("posAcaoBloco").length === 2, m.rpc.de("posAcaoBloco"));
    checar(
      "nada a enviar com o motivo",
      m.texto().includes("Nada a enviar: 2 processos têm inclusão não confirmada no bloco 12 (confira o bloco)."),
      m.raiz.querySelector(".pl-pos-status")?.textContent,
    );
    await m.repetir().catch(() => undefined);
    checar("Tentar de novo também não reenvia", m.rpc.de("posAcaoBloco").length === 2);
    escolherCombo(m.doc, "Bloco interno", "b8");
    await m.aplicar();
    checar("13 de novo: já estão no bloco, nada a enviar", m.rpc.de("posAcaoBloco").length === 2);
    checar(
      "motivo: já estão",
      m.texto().includes("Nada a enviar: 2 processos já estão no bloco 13."),
      m.raiz.querySelector(".pl-pos-status")?.textContent,
    );
  }

  secao("Fix 2: Tentar de novo repete cada erro de bloco só no bloco dele, nunca num par não confirmado");
  {
    // A=101, B=102. 12: A não confirmado, B erro. 13: A erro, B ok. 12 de novo: A pulado, B incluído.
    // Tentar de novo: A volta só ao 13 (o bloco do erro), nunca ao 12 (último escolhido, par não confirmado).
    const m = montarPainel([itemOk(0), itemOk(1)], {
      bloco: (a, vez) => ({
        resultados: (a.idsProcedimento as string[]).map((id) => {
          if (vez === 1)
            return id === "101"
              ? { idProcedimento: id, situacao: "nao-confirmado", mensagem: "x" }
              : { idProcedimento: id, situacao: "erro", mensagem: "falhou no 12" };
          if (vez === 2)
            return id === "101"
              ? { idProcedimento: id, situacao: "erro", mensagem: "falhou no 13" }
              : { idProcedimento: id, situacao: "incluido" };
          return { idProcedimento: id, situacao: "incluido" };
        }),
      }),
    });
    await m.abrir();
    escolherCombo(m.doc, "Bloco interno", "b7");
    await m.aplicar();
    escolherCombo(m.doc, "Bloco interno", "b8");
    await m.aplicar();
    escolherCombo(m.doc, "Bloco interno", "b7");
    await m.aplicar();
    const resumo = () => m.rpc.de("posAcaoBloco").map((c) => `${c.args.idBloco}:${(c.args.idsProcedimento as string[]).join(",")}`);
    igual("12, 13, 12 só com B", resumo(), ["b7:101,102", "b8:101,102", "b7:102"]);
    checar("A com erro no 13", m.p.estado(0, "bloco")?.situacao === "erro" && m.p.estado(0, "bloco")?.idBloco === "b8");
    await m.repetir();
    igual("retry: A só no 13", resumo(), ["b7:101,102", "b8:101,102", "b7:102", "b8:101"]);
    const aNo12 = m.rpc.de("posAcaoBloco").filter((c) => c.args.idBloco === "b7" && (c.args.idsProcedimento as string[]).includes("101"));
    checar("A no 12 só a primeira vez", aNo12.length === 1, aNo12.length);
    checar(
      "coluna de A: incluído no 13 e confira o 12",
      m.p.depois(itemOk(0)) === "Bloco: ✔ incluído; Bloco: ? não confirmado: confira o bloco 12",
      m.p.depois(itemOk(0)),
    );
    await m.p.repetirFalhas();
    checar("retry vazio: nenhuma chamada", m.rpc.de("posAcaoBloco").length === 4);
    checar(
      "retry vazio troca a nota (sem Nada a enviar velho)",
      m.texto().includes("Nada a repetir") && !m.texto().includes("Nada a enviar"),
      m.raiz.querySelector(".pl-pos-status")?.textContent,
    );
  }

  secao("Task 21: sessão expirada entre blocos do Tentar de novo: os blocos seguintes ficam para o Continuar");
  {
    // A=101, B=102. b7: A não confirmado, B erro. b8: A erro, B não confirmado. b7 de novo: A pulado, B erro.
    // Tentar de novo: b8 com A (a sessão cai) e b7 com B, que não pode ficar preso em "aguardando".
    const m = montarPainel([itemOk(0), itemOk(1)], {
      bloco: (a, vez) => {
        const ids = a.idsProcedimento as string[];
        const r = (id: string, situacao: string) => ({ idProcedimento: id, situacao, mensagem: `${situacao} ${vez}` });
        if (vez === 1) return { resultados: ids.map((id) => r(id, id === "101" ? "nao-confirmado" : "erro")) };
        if (vez === 2) return { resultados: ids.map((id) => r(id, id === "101" ? "erro" : "nao-confirmado")) };
        if (vez === 3) return { resultados: ids.map((id) => r(id, "erro")) };
        if (vez === 4) return { resultados: ids.map((id) => r(id, "nao-confirmado")), parar: true };
        return { resultados: ids.map((id) => ({ idProcedimento: id, situacao: "incluido" })) };
      },
    });
    await m.abrir();
    escolherCombo(m.doc, "Bloco interno", "b7");
    await m.aplicar();
    escolherCombo(m.doc, "Bloco interno", "b8");
    await m.aplicar();
    escolherCombo(m.doc, "Bloco interno", "b7");
    await m.aplicar();
    const resumo = () => m.rpc.de("posAcaoBloco").map((c) => `${c.args.idBloco}:${(c.args.idsProcedimento as string[]).join(",")}`);
    igual("preparo: b7, b8, b7 só com B", resumo(), ["b7:101,102", "b8:101,102", "b7:102"]);
    await m.repetir();
    igual("a sessão cai no primeiro bloco do retry", resumo(), ["b7:101,102", "b8:101,102", "b7:102", "b8:101"]);
    checar("mensagem da sessão", m.texto().includes(MENSAGEM_SESSAO));
    checar("Continuar visível para o bloco que faltou", m.visivel("Continuar"));
    disparar(botao(m.raiz, "Continuar")!, "click");
    await ate(() => !m.p.rodando);
    igual("Continuar envia só o bloco que faltou", resumo(), ["b7:101,102", "b8:101,102", "b7:102", "b8:101", "b7:102"]);
    checar(
      "B incluído no b7",
      m.p.estado(1, "bloco")?.situacao === "ok" && m.p.estado(1, "bloco")?.idBloco === "b7",
      m.p.estado(1, "bloco"),
    );
    checar("nada fica aguardando", m.p.estado(0, "bloco")?.situacao !== "aguardando" && m.p.estado(1, "bloco")?.situacao !== "aguardando");
    checar(
      "Continuar não diz que algo da pausada deixou de ser enviado",
      !m.texto().includes("execução pausada"),
      m.raiz.querySelector(".pl-pos-status")?.textContent,
    );
    checar("Continuar some", !m.visivel("Continuar"));
  }

  secao("Fix 1: listas com sessão expirada não ficam guardadas");
  {
    const m = montarPainel([itemOk(0)], { opcoes: (_a, vez) => (vez === 1 ? { ...OPCOES, blocos: [], parar: true } : OPCOES) });
    await m.abrir();
    checar("mensagem da sessão", m.texto().includes(MENSAGEM_SESSAO));
    disparar(m.raiz.querySelector(".pl-pos-abrir")!, "click");
    disparar(m.raiz.querySelector(".pl-pos-abrir")!, "click");
    await ate(() => m.rpc.de("posAcaoOpcoes").length === 2);
    await tique(10);
    checar("reabrir carrega de novo", m.rpc.de("posAcaoOpcoes").length === 2);
    escolherCombo(m.doc, "Bloco interno", "b7");
    checar("agora com os blocos", botao(m.raiz, "Aplicar")?.disabled === false);
  }

  secao("Fix 1: rodada nova sobre uma pausada avisa o que não foi enviado");
  {
    const m = montarPainel([itemOk(0), itemOk(1)], {
      posAcao: (_a, vez) =>
        vez === 1 ? { situacao: "erro", mensagem: "Sessão expirada.", parar: true } : { situacao: "ok", mensagem: "ok" },
    });
    await m.abrir();
    escolherCombo(m.doc, "Marcador", "m1");
    await m.aplicar();
    checar("pausado", m.visivel("Continuar"));
    escolherCombo(m.doc, "Bloco interno", "b7");
    m.ligar("marcador", false);
    await m.aplicar();
    checar(
      "status diz quantos da pausada não foram",
      m.texto().includes("1 processo da execução pausada não foi enviado."),
      m.raiz.querySelector(".pl-pos-status")?.textContent,
    );
    checar("o marcador do 2º não foi enviado", m.posDe("marcador").length === 1);
  }

  secao("Fix 1: número real sem id do processo tem o próprio motivo");
  {
    const semId: ItemProc = { ...itemOk(1, 2), resultado: { criado: { numero: numero(2), idProcedimento: " ", url: "" } } };
    const m = montarPainel([itemOk(0), semId]);
    checar("fora dos alvos", m.p.alvos.length === 1 && m.p.semId === 1 && m.p.incertas === 0);
    checar(
      "motivo próprio",
      m.texto().includes("1 linha ficou de fora: o processo foi criado, mas o SEI não informou o identificador interno dele."),
    );
    checar("sem o motivo de incerta", !m.texto().includes("não confirmou o número"));
    await m.abrir();
    escolherCombo(m.doc, "Marcador", "m1");
    await m.aplicar();
    checar("só o processo com id", m.posDe("marcador").length === 1 && m.posDe("marcador")[0]?.args.idProcedimento === "101");
  }

  secao("Fix 1: duplo clique em Tentar de novo e em Continuar");
  {
    const m = montarPainel([itemOk(0), itemOk(1)], {
      posAcao: (a, vez) => (vez === 1 ? { situacao: "erro", mensagem: "falhou" } : { situacao: "ok", mensagem: `${a.acao} ok` }),
    });
    await m.abrir();
    escolherCombo(m.doc, "Marcador", "m1");
    await m.aplicar();
    const r = botao(m.raiz, "Tentar de novo as falhas")!;
    disparar(r, "click");
    disparar(r, "click");
    await ate(() => !m.p.rodando);
    checar("retry uma vez só", m.posDe("marcador").length === 3, m.posDe("marcador").length);

    const c = montarPainel([itemOk(0), itemOk(1)], {
      posAcao: (_a, vez) =>
        vez === 1 ? { situacao: "erro", mensagem: "Sessão expirada.", parar: true } : { situacao: "ok", mensagem: "ok" },
    });
    await c.abrir();
    escolherCombo(c.doc, "Marcador", "m1");
    await c.aplicar();
    const b = botao(c.raiz, "Continuar")!;
    disparar(b, "click");
    disparar(b, "click");
    await ate(() => !c.p.rodando);
    checar(
      "Continuar uma vez só",
      c.posDe("marcador").length === 2 && c.posDe("marcador")[1]?.args.idProcedimento === "102",
      c.posDe("marcador"),
    );
  }

  secao("Task 21: modelo com ações abre o painel com elas ligadas (nada enviado sem Aplicar)");
  {
    const m = montarPainel([itemOk(0), itemOk(1)], {
      modelo: {
        nome: "Contratos",
        posAcoes: {
          bloco: { id: "b8", descricao: "Pregões" },
          marcador: { id: "m2", nome: "Aguardando", texto: "ver" },
          acompanhar: { grupo: "g1", nomeGrupo: "Licitações", observacao: "obs" },
        },
        guardar: async () => true,
      },
    });
    await ate(() => m.rpc.de("posAcaoOpcoes").length > 0);
    await tique(10);
    const caixa = (a: string) => m.raiz.querySelector<HTMLInputElement>(`input[data-acao="${a}"]`)!;
    checar("abre sozinho", !m.raiz.querySelector(".pl-pos-corpo[hidden]"));
    checar(
      "três ações ligadas",
      ["bloco", "marcador", "acompanhar"].every((a) => caixa(a).checked),
    );
    checar(
      "bloco escolhido",
      (combo(m.raiz, "Bloco interno")?.textContent ?? "").includes("13"),
      combo(m.raiz, "Bloco interno")?.textContent,
    );
    checar("marcador escolhido", (combo(m.raiz, "Marcador")?.textContent ?? "").includes("Aguardando"));
    checar("grupo escolhido", (combo(m.raiz, "Grupo de acompanhamento")?.textContent ?? "").includes("Licitações"));
    checar("texto do marcador", m.raiz.querySelector<HTMLInputElement>('input[aria-label="Texto do marcador"]')?.value === "ver");
    checar("observação", m.raiz.querySelector<HTMLTextAreaElement>("textarea.pl-pos-observacao")?.value === "obs");
    checar("sem aviso de opção sumida", !m.texto().includes("não existe mais"));
    checar("nada enviado sem Aplicar", m.rpc.de("posAcao").length === 0 && m.rpc.de("posAcaoBloco").length === 0);
    checar("Aplicar ligado", botao(m.raiz, "Aplicar")?.disabled === false);
    await m.aplicar();
    igual("Aplicar usa o bloco do modelo", m.rpc.de("posAcaoBloco")[0]?.args, { idBloco: "b8", idsProcedimento: ["101", "102"] });
    igual(
      "Aplicar usa o marcador e o texto do modelo",
      [m.posDe("marcador")[0]?.args.marcador, m.posDe("marcador")[0]?.args.texto],
      ["Aguardando", "ver"],
    );
    igual(
      "Aplicar usa o grupo e a observação do modelo",
      [m.posDe("acompanhar")[0]?.args.grupo, m.posDe("acompanhar")[0]?.args.observacao],
      ["g1", "obs"],
    );
  }

  secao("Task 21: ação do modelo cuja opção sumiu vem desligada, com aviso");
  {
    const m = montarPainel([itemOk(0)], {
      modelo: {
        nome: "Antigo",
        posAcoes: {
          bloco: { id: "b99", descricao: "Velho" },
          marcador: { id: "m9", nome: "Extinto", texto: "" },
          acompanhar: { grupo: "g9", nomeGrupo: "Grupo sumido", observacao: "" },
        },
        guardar: async () => true,
      },
    });
    await ate(() => m.rpc.de("posAcaoOpcoes").length > 0);
    await tique(10);
    const caixa = (a: string) => m.raiz.querySelector<HTMLInputElement>(`input[data-acao="${a}"]`)!;
    checar(
      "as três desligadas",
      ["bloco", "marcador", "acompanhar"].every((a) => !caixa(a).checked),
    );
    const avisos = [...m.raiz.querySelectorAll(".pl-pos-aviso-modelo")].map((x) => x.textContent ?? "");
    checar(
      "um aviso por ação, com o nome e 'não existe mais nesta unidade'",
      avisos.length === 3 &&
        avisos.every((a) => a.includes("não existe mais nesta unidade")) &&
        ["Velho", "Extinto", "Grupo sumido"].every((n) => avisos.some((a) => a.includes(n))),
      avisos,
    );
    checar("Aplicar desligado", botao(m.raiz, "Aplicar")?.disabled === true);
    checar("nada enviado", m.rpc.de("posAcao").length === 0 && m.rpc.de("posAcaoBloco").length === 0);
  }
  {
    // Acompanhar sem grupo: nao ha o que sumir.
    const m = montarPainel([itemOk(0)], {
      modelo: { nome: "S", posAcoes: { acompanhar: { grupo: "", nomeGrupo: "", observacao: "x" } }, guardar: async () => true },
    });
    await ate(() => m.rpc.de("posAcaoOpcoes").length > 0);
    await tique(10);
    checar(
      "acompanhar sem grupo: ligado, sem aviso",
      m.raiz.querySelector<HTMLInputElement>('input[data-acao="acompanhar"]')?.checked === true && !m.texto().includes("não existe mais"),
    );
  }

  secao("Fix round 1: lista que não carregou não vira 'não existe mais' e não apaga a ação do modelo");
  {
    const guardadas: PosAcoes[] = [];
    const m = montarPainel([itemOk(0)], {
      opcoes: (_a, vez) =>
        vez === 1
          ? {
              ...OPCOES,
              marcadores: [],
              blocos: [],
              avisos: ["Não foi possível listar os marcadores: falhou", "Não foi possível listar os blocos internos: falhou"],
              falharam: ["marcadores", "blocos"],
            }
          : OPCOES,
      modelo: {
        nome: "Contratos",
        posAcoes: { marcador: { id: "m1", nome: "Urgente", texto: "t" }, bloco: { id: "b7", descricao: "Contratos de 2026" } },
        guardar: async (p) => {
          guardadas.push(p);
          return true;
        },
      },
    });
    await ate(() => m.rpc.de("posAcaoOpcoes").length > 0);
    await tique(10);
    const caixa = (a: string) => m.raiz.querySelector<HTMLInputElement>(`input[data-acao="${a}"]`)!;
    checar("marcador e bloco desligados", !caixa("marcador").checked && !caixa("bloco").checked);
    const avisos = [...m.raiz.querySelectorAll(".pl-pos-aviso-modelo")].map((x) => x.textContent ?? "");
    checar(
      "aviso próprio de lista que não carregou (não o de 'não existe mais')",
      avisos.length === 2 &&
        avisos.every((a) => a.includes("A lista não carregou; a ação do modelo não foi verificada.") && !a.includes("não existe mais")),
      avisos,
    );
    m.ligar("acompanhar");
    disparar(botao(m.raiz, "Guardar estas ações no modelo")!, "click");
    await ate(() => guardadas.length > 0);
    await tique(5);
    igual("Guardar preserva o marcador e o bloco não verificados", guardadas[0], {
      marcador: { id: "m1", nome: "Urgente", texto: "t" },
      acompanhar: { grupo: "", nomeGrupo: "", observacao: "" },
      bloco: { id: "b7", descricao: "Contratos de 2026" },
    });
    disparar(m.raiz.querySelector(".pl-pos-abrir")!, "click");
    disparar(m.raiz.querySelector(".pl-pos-abrir")!, "click");
    await ate(() => m.rpc.de("posAcaoOpcoes").length === 2);
    await tique(10);
    checar("reabrir recarrega as listas", m.rpc.de("posAcaoOpcoes").length === 2);
    checar("depois de carregar: marcador e bloco do modelo ligados", caixa("marcador").checked && caixa("bloco").checked);
    checar("marcador escolhido", (combo(m.raiz, "Marcador")?.textContent ?? "").includes("Urgente"));
    checar("avisos do modelo somem", m.raiz.querySelectorAll(".pl-pos-aviso-modelo").length === 0);
    checar("acompanhar continua como o usuário deixou", caixa("acompanhar").checked);
    disparar(m.raiz.querySelector(".pl-pos-abrir")!, "click");
    disparar(m.raiz.querySelector(".pl-pos-abrir")!, "click");
    await tique(20);
    checar("verificado tudo: reabrir não recarrega mais", m.rpc.de("posAcaoOpcoes").length === 2);
  }

  secao("Task 21: modelo sem ações deixa o painel como antes");
  {
    const m = montarPainel([itemOk(0)], { modelo: { nome: "Vazio", guardar: async () => true } });
    await tique(10);
    checar("recolhido e sem pedir nada", !!m.raiz.querySelector(".pl-pos-corpo[hidden]") && m.rpc.chamadas.length === 0);
    await m.abrir();
    checar(
      "nenhuma ação ligada",
      [...m.raiz.querySelectorAll<HTMLInputElement>("input.pl-pos-liga")].every((c) => !c.checked),
    );
    checar("sem aviso", !m.texto().includes("não existe mais"));
    const s = montarPainel([itemOk(0)]);
    await s.abrir();
    checar("sem modelo: sem o botão de guardar", !botao(s.raiz, "Guardar estas ações no modelo"));
  }

  secao("Task 21: Guardar estas ações no modelo");
  {
    const guardadas: PosAcoes[] = [];
    let existe = true;
    const m = montarPainel([itemOk(0)], {
      modelo: {
        nome: "Contratos",
        guardar: async (p) => {
          guardadas.push(p);
          return existe;
        },
      },
    });
    checar("botão presente", !!botao(m.raiz, "Guardar estas ações no modelo"));
    checar("antes das listas: desligado", botao(m.raiz, "Guardar estas ações no modelo")?.disabled === true);
    await m.abrir();
    escolherCombo(m.doc, "Bloco interno", "b7");
    m.ligar("marcador");
    checar("ação ligada incompleta: desligado", botao(m.raiz, "Guardar estas ações no modelo")?.disabled === true);
    escolherCombo(m.doc, "Marcador", "m1");
    m.raiz.querySelector<HTMLInputElement>('input[aria-label="Texto do marcador"]')!.value = "  oi  ";
    m.ligar("acompanhar");
    m.raiz.querySelector<HTMLTextAreaElement>("textarea.pl-pos-observacao")!.value = "x";
    disparar(botao(m.raiz, "Guardar estas ações no modelo")!, "click");
    await ate(() => guardadas.length > 0);
    await tique(5);
    igual("guarda as três ações com ids e nomes", guardadas[0], {
      marcador: { id: "m1", nome: "Urgente", texto: "oi" },
      acompanhar: { grupo: "", nomeGrupo: "", observacao: "x" },
      bloco: { id: "b7", descricao: "Contratos de 2026" },
    });
    checar(
      "confirma no painel",
      m.texto().includes('Ações guardadas no modelo "Contratos".'),
      m.raiz.querySelector(".pl-pos-status")?.textContent,
    );
    checar("guardar não envia nada ao SEI", m.rpc.de("posAcao").length === 0 && m.rpc.de("posAcaoBloco").length === 0);
    existe = false;
    disparar(botao(m.raiz, "Guardar estas ações no modelo")!, "click");
    await ate(() => guardadas.length > 1);
    await tique(5);
    checar(
      "modelo apagado em outra aba: avisa",
      m.texto().includes('O modelo "Contratos" não existe mais'),
      m.raiz.querySelector(".pl-pos-status")?.textContent,
    );
  }

  secao("Depois de criar (app): painel no resultado só com processo confirmado; coluna na tabela e no CSV");
  {
    const a = await montarApp([criadoGravado(1), incertoGravado]);
    checar("painel presente", !!a.raiz.querySelector(".pl-resultado .pl-pos-acao"));
    checar(
      "sem coluna antes de rodar",
      ![...a.raiz.querySelectorAll(".pl-resultado th")].some((th) => th.textContent === "Depois de criar"),
    );
    disparar(a.raiz.querySelector(".pl-pos-abrir")!, "click");
    await ate(() => a.rpc.de("posAcaoOpcoes").length > 0);
    await tique(10);
    escolherCombo(a.doc, "Marcador", "m1");
    disparar(botao(a.raiz, "Aplicar")!, "click");
    await ate(() => a.rpc.de("posAcao").length === 1);
    await tique(10);
    const ths = [...a.raiz.querySelectorAll(".pl-resultado th")].map((th) => th.textContent);
    checar("coluna Depois de criar", ths.includes("Depois de criar"), ths);
    const celulas = [...a.raiz.querySelectorAll(".pl-resultado tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => td.textContent),
    );
    checar("linha confirmada com o resumo", celulas[0]?.includes("Marcador: ✔ aplicado") === true, celulas);
    checar("linha incerta vazia", celulas[1]?.[celulas[1].length - 1] === "", celulas);
    checar("o painel continua lá", !!a.raiz.querySelector(".pl-resultado .pl-pos-acao"));
    disparar(botao(a.raiz, "Baixar CSV")!, "click");
    checar("CSV com a coluna", a.baixados[0]?.conteudo.includes("Depois de criar") === true);
    a.app.destruir();

    const b = await montarApp([incertoGravado]);
    checar("só incerto: sem painel", !b.raiz.querySelector(".pl-pos-acao"));
    b.app.destruir();
  }

  secao("Depois de criar (app): fechar o modal no meio só para");
  {
    const segura = segurar<unknown>();
    let primeira = true;
    const a = await montarApp([criadoGravado(1), criadoGravado(2), incertoGravado], {
      posAcao: () => {
        if (primeira) {
          primeira = false;
          return segura.p;
        }
        return { situacao: "ok", mensagem: "ok" };
      },
    });
    disparar(a.raiz.querySelector(".pl-pos-abrir")!, "click");
    await ate(() => a.rpc.de("posAcaoOpcoes").length > 0);
    await tique(10);
    escolherCombo(a.doc, "Marcador", "m1");
    disparar(botao(a.raiz, "Aplicar")!, "click");
    await ate(() => a.rpc.de("posAcao").length === 1);
    a.app.destruir();
    segura.soltar({ situacao: "ok", mensagem: "ok" });
    await tique(30);
    checar("nada enviado depois de fechar", a.rpc.de("posAcao").length === 1, a.rpc.de("posAcao").length);
  }
}
