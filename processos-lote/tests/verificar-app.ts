/**
 * Provas do app do Processos em Lote (a janela dentro do iframe), com DOM do linkedom, RPC falso e o
 * repositorio de verdade sobre `areaMemoria`. O que a aba responde a cada `criar` e decidido aqui, por
 * especificacao e pela vez da chamada (1, 2...), e cada resposta pode ser segurada para a prova agir no meio.
 *
 * Toda prova que cria processos confere quantas vezes cada linha foi POSTADA: duplicar processo num SEI real e
 * o defeito que este modulo nao pode ter.
 */

import { readFileSync } from "node:fs";
import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { ErroRpc } from "@comum/ponte/rpc";
import { h } from "@comum/ui/dom";
import { AppProcessosLote, type DepsApp } from "@pl/app/app";
import { criarConfirmarSemCancelar, TelaConfiguracao } from "@pl/app/configuracao";
import { MENSAGEM_ASSUMIDO, MENSAGEM_GRAVAR } from "@pl/app/execucao";
import { partesEnviadas } from "@pl/app/previa";
import { CHAVE_ENTRADA_LINK, JANELA_OUTRA_ABA_MS } from "@pl/modelo/constantes";
import type { LinhaLote } from "@pl/modelo/linhas";
import { montarPrevia } from "@pl/modelo/previa";
import { RepositorioModelos } from "@pl/modelos";
import { NUMERO_INCERTO, type ResultadoCriar } from "@pl/pagina/executor";
import { type LoteEmAndamento, RepositorioLote } from "@pl/repositorio";
import { botao, checar, combo, disparar, escolherCombo, igual, instalarDom, secao, tique } from "./util";

const ESCOPO = "sei.x.gov.br|ana";
const CHAVE_LOTE = `lote/${ESCOPO}/atual`;
const TIPOS = [
  { id: "10", nome: "Contrato: Gestão" },
  { id: "20", nome: "Licitação: Pregão" },
];
const HIPOTESES = [{ id: "7", nome: "Controle Interno (Art. 26, Lei 10.180/2001)" }];
const OPCOES_POS = {
  marcadores: [{ id: "m1", nome: "Urgente" }],
  grupos: [{ id: "g1", nome: "Licitações" }],
  blocos: [{ id: "b7", numero: "12", descricao: "Contratos de 2026" }],
  avisos: [],
};

/** Resposta da aba para o `criar` de uma especificacao; `vezes` = quantas chamadas ja houve para ela. */
type Roteiro = (esp: string, vezes: number, linha: LinhaLote) => ResultadoCriar | Error | Promise<ResultadoCriar | Error>;

const criado = (_esp: string, n: number): ResultadoCriar => ({
  situacao: "ok",
  criado: { numero: `00001.00000${n}/2026-1${n}`, idProcedimento: `${100 + n}`, url: `https://sei.x.gov.br/sei/p?id=${100 + n}` },
});
let numeroSeq = 0;
const okSempre: Roteiro = (esp) => criado(esp, ++numeroSeq);

interface OpcoesMontar {
  roteiro?: Roteiro;
  area?: Area;
  hipoteses?: typeof HIPOTESES;
  /** Chamado quando um `criar` chega a aba, antes da resposta (a prova age "no meio"). */
  aoCriar?: (esp: string, vezes: number) => void;
  /** Relogio compartilhado (repositorio e app); avance `t` para envelhecer o lote gravado. */
  relogio?: { t: number };
}

function montar(o: OpcoesMontar = {}) {
  const doc = instalarDom('<html><body><div id="app"></div></body></html>');
  const raiz = doc.getElementById("app")!;
  const area = o.area ?? areaMemoria();
  const relogio = o.relogio ?? { t: 1_000_000 };
  const repo = new RepositorioLote(area, ESCOPO, () => relogio.t);
  const modelos = new RepositorioModelos(area, ESCOPO, () => relogio.t);
  /** Linha do tempo de tudo o que importa a ordem: gravacoes do lote, POSTs, fechar etc. */
  const eventos: string[] = [];
  const gravarOriginal = repo.gravar.bind(repo);
  repo.gravar = (l: LoteEmAndamento) => {
    eventos.push("repo.gravar");
    return gravarOriginal(l);
  };
  const chamadas: Array<{ op: string; args: unknown; prazo?: number }> = [];
  const porEsp = new Map<string, number>();
  /** Respostas "ok" que a aba de fato devolveu, por especificacao (o que conta como processo criado). */
  const sucessos = new Map<string, number>();
  const roteiro = o.roteiro ?? okSempre;
  const t = {
    fechou: 0,
    minimizou: [] as boolean[],
    entradaLink: [] as string[],
    pausas: [] as number[],
    avisos: [] as string[],
    confirmacoes: [] as string[],
    /** O que o `confirmar` responde. */
    confirma: true,
  };
  const baixados: Array<{ nome: string; conteudo: string }> = [];
  /** O `fechar` de cada dialogo aberto (o X/Esc das provas) e os campos que receberam foco. */
  const dialogosAbertos: Array<() => void> = [];
  const focados: HTMLElement[] = [];
  const copiados: string[] = [];

  const deps: DepsApp = {
    rpc: {
      chamar: (async (op: string, args?: unknown, prazo?: number) => {
        chamadas.push({ op, args, prazo });
        eventos.push(op);
        if (op === "tipos") return TIPOS;
        if (op === "formTipo") {
          const idTipo = (args as { idTipo: string }).idTipo;
          return { idTipo, hipoteses: o.hipoteses ?? HIPOTESES, temAssuntos: true };
        }
        if (op === "criar") {
          const linha = (args as { linha: LinhaLote }).linha;
          const esp = linha.especificacao;
          const vezes = (porEsp.get(esp) ?? 0) + 1;
          porEsp.set(esp, vezes);
          o.aoCriar?.(esp, vezes);
          await tique(1);
          const r = await roteiro(esp, vezes, linha);
          if (r instanceof Error) throw r;
          if (r.situacao === "ok") sucessos.set(esp, (sucessos.get(esp) ?? 0) + 1);
          return r;
        }
        if (op === "posAcaoOpcoes") return OPCOES_POS;
        return true;
      }) as DepsApp["rpc"]["chamar"],
    },
    ctx: { host: "sei.x.gov.br", login: "ana", temaEscuro: false },
    repo,
    modelos,
    area,
    // Os dialogos do app vao para o body (fora da raiz), como o <dialog> de verdade.
    abrirModal: ({ titulo, conteudo, aoFechar }) => {
      const dlg = h("div", { class: "dlg-teste", "aria-label": titulo }, conteudo);
      doc.body.append(dlg);
      for (const el of dlg.querySelectorAll<HTMLElement>("input")) {
        const original = el.focus?.bind(el);
        el.focus = (o?: FocusOptions) => {
          focados.push(el);
          original?.(o);
        };
      }
      const fechar = () => {
        if (!dlg.isConnected) return;
        dlg.remove();
        aoFechar?.();
      };
      dialogosAbertos.push(fechar);
      return { fechar };
    },
    confirmar: async (texto) => {
      t.confirmacoes.push(texto);
      return t.confirma;
    },
    baixar: (nome, conteudo) => void baixados.push({ nome, conteudo }),
    clip: { writeText: async (texto) => void copiados.push(texto) },
    fechar: () => {
      t.fechou += 1;
      eventos.push("fechar-app");
    },
    minimizar: async (m) => {
      t.minimizou.push(m);
    },
    gravarEntradaLink: async (texto) => {
      t.entradaLink.push(texto);
      eventos.push("gravarEntradaLink");
    },
    esperar: async (ms) => {
      t.pausas.push(ms);
    },
    avisar: (texto) => void t.avisos.push(texto),
    agora: () => relogio.t,
  };
  const app = new AppProcessosLote(raiz, deps);

  const caixa = () => raiz.querySelector<HTMLTextAreaElement>("textarea")!;
  const digitar = (texto: string) => {
    caixa().value = texto;
    disparar(caixa(), "input");
  };
  const campo = (id: string) => raiz.querySelector<HTMLInputElement>(`#${id}`)!;
  const preencher = (id: string, valor: string) => {
    campo(id).value = valor;
    disparar(campo(id), "input");
  };
  const nivel = (v: "0" | "1") => {
    const r = raiz.querySelector<HTMLInputElement>(`input[name="pl-nivel"][value="${v}"]`)!;
    for (const x of raiz.querySelectorAll<HTMLInputElement>('input[name="pl-nivel"]')) x.checked = x === r;
    disparar(r, "change");
  };
  const criarDe = (esp: string) => chamadas.filter((c) => c.op === "criar" && (c.args as { linha: LinhaLote }).linha.especificacao === esp);
  const quantas = (esp: string) => criarDe(esp).length;
  const visivel = (texto: string) => {
    const b = botao(raiz, texto);
    return !!b && !b.hidden && !b.closest("[hidden]");
  };
  const clicar = (texto: string) => {
    const b = botao(raiz, texto);
    if (!b) throw new Error(`botao "${texto}" nao encontrado`);
    disparar(b, "click");
  };
  const textoVisivel = (texto: string) =>
    [...raiz.querySelectorAll("p, span, div, strong, h2, td")].some(
      (el) => !el.closest("[hidden]") && (el.textContent ?? "").includes(texto),
    );
  const linhasResultado = () =>
    [...raiz.querySelectorAll(".pl-resultado table tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim()),
    );
  const lote = async () => (await area.obter(CHAVE_LOTE))[CHAVE_LOTE] as LoteEmAndamento | undefined;
  /** Configura e vai ate a previa: tipo, texto e (opcional) restrito com hipotese. */
  const configurar = async (texto: string, opc: { restrito?: boolean; hipotese?: boolean } = {}) => {
    await ate(() => !!combo(raiz, "Tipo de processo"));
    escolherCombo(raiz, "Tipo de processo", "10");
    await ate(() => chamadas.some((c) => c.op === "formTipo") && !botao(raiz, "Ver prévia")?.disabled);
    if (opc.restrito) nivel("1");
    if (opc.hipotese) escolherCombo(raiz, "Hipótese legal", "7");
    digitar(texto);
  };
  return {
    doc,
    raiz,
    app,
    relogio,
    modelos,
    focados,
    /** Fecha o dialogo mais novo como o X ou o Esc. */
    fecharDialogo: () => dialogosAbertos.pop()?.(),
    sucessos,
    deps,
    area,
    repo,
    eventos,
    chamadas,
    t,
    baixados,
    copiados,
    caixa,
    digitar,
    preencher,
    campo,
    nivel,
    criarDe,
    quantas,
    visivel,
    clicar,
    textoVisivel,
    linhasResultado,
    lote,
    configurar,
  };
}

async function ate(cond: () => boolean, limite = 200): Promise<void> {
  for (let i = 0; i < limite && !cond(); i += 1) await tique(2);
}

/** Uma resposta segurada: a prova decide quando a aba "responde". */
function segurar<T>() {
  let soltar!: (v: T) => void;
  const p = new Promise<T>((r) => {
    soltar = r;
  });
  return { p, soltar };
}

export async function verificarApp(): Promise<void> {
  secao("App: ponta a ponta (repetida removida, erro uma vez, cancelar na 3a, fechar, reabrir, continuar)");
  {
    const area = areaMemoria();
    let a: ReturnType<typeof montar> | null = null;
    // Contagem propria: as vezes do `montar` sao por app, e Gamma falha so na 1a chamada somando os dois apps.
    let gamma = 0;
    const roteiro: Roteiro = (esp) => {
      if (esp === "Gamma" && ++gamma === 1) return { situacao: "erro", erro: "O SEI recusou o formulário." };
      return criado(esp, ++numeroSeq);
    };
    // Cancelar quando a 3a linha (Gamma) ja saiu para a aba: ela termina, as outras ficam pendentes.
    a = montar({
      area,
      roteiro,
      aoCriar: (esp) => {
        if (esp === "Gamma") a?.clicar("Cancelar");
      },
    });
    await a.app.iniciar();
    await a.configurar("Alfa\nBeta\nAlfa\nGamma\nDelta");
    a.clicar("Ver prévia");
    checar("prévia mostra as 5 linhas", a.raiz.querySelectorAll(".pl-previa .pl-tabela tbody tr").length === 5);
    checar("prévia diz que a 3a é repetida", a.textoVisivel("repetida"));
    a.clicar("Remover repetidas");
    checar("remover repetidas: sobram 4", a.raiz.querySelectorAll(".pl-previa .pl-tabela tbody tr").length === 4);
    checar("sem repetidas: botão some", !a.visivel("Remover repetidas"));
    a.clicar("Iniciar");
    await ate(() => !!a?.raiz.querySelector(".pl-resultado"));
    checar(
      "o lote foi gravado antes do primeiro POST",
      a.eventos.indexOf("repo.gravar") >= 0 && a.eventos.indexOf("repo.gravar") < a.eventos.indexOf("criar"),
      a.eventos,
    );
    checar("cancelou: Delta nunca saiu", a.quantas("Delta") === 0);
    checar("Alfa, Beta e Gamma uma vez cada", a.quantas("Alfa") === 1 && a.quantas("Beta") === 1 && a.quantas("Gamma") === 1);
    checar("resultado: execução interrompida", a.textoVisivel("Execução interrompida"));
    const gravado = await a.lote();
    checar(
      "registro mantido: ok, ok, erro, pendente",
      gravado?.itens.map((i) => i.situacao).join() === "ok,ok,erro,pendente",
      gravado?.itens,
    );
    checar("registro sem a repetida", gravado?.linhas.map((l) => l.especificacao).join() === "Alfa,Beta,Gamma,Delta");
    // Fechar (X) e reabrir: um app novo sobre a mesma area.
    a.clicar("Fechar");
    a.app.destruir();
    const sucessosA = new Map(a.sucessos);
    // O lote parou ha mais que a janela de outra aba: a retomada nao pede confirmacao extra.
    const relogio = { t: a.relogio.t + JANELA_OUTRA_ABA_MS + 1 };
    const b = montar({ area, roteiro, relogio });
    await b.app.iniciar();
    checar("reaberto: oferece continuar", b.visivel("Continuar de onde parou") && b.visivel("Descartar"));
    checar("lote parado há muito: sem aviso de outra aba", !b.textoVisivel("outra aba do SEI"));
    b.clicar("Continuar de onde parou");
    await ate(() => !!b.raiz.querySelector(".pl-resultado"));
    checar(
      "continuar recarrega o formulário do tipo",
      b.chamadas.some((c) => c.op === "formTipo" && (c.args as { idTipo: string }).idTipo === "10"),
    );
    checar(
      "continuar: formTipo antes do primeiro criar",
      b.eventos.indexOf("formTipo") >= 0 && b.eventos.indexOf("formTipo") < b.eventos.indexOf("criar"),
      b.eventos,
    );
    checar("continuar não recria Alfa nem Beta", b.quantas("Alfa") === 0 && b.quantas("Beta") === 0);
    checar("continuar refaz Gamma e cria Delta, uma vez cada", b.quantas("Gamma") === 1 && b.quantas("Delta") === 1);
    // Sucessos por linha, somando os dois apps: exatamente 1 cada.
    const okPorLinha = (esp: string) => (sucessosA.get(esp) ?? 0) + (b.sucessos.get(esp) ?? 0);
    checar(
      "cada linha com exatamente 1 criar bem-sucedido",
      ["Alfa", "Beta", "Gamma", "Delta"].every((e) => okPorLinha(e) === 1),
      ["Alfa", "Beta", "Gamma", "Delta"].map(okPorLinha),
    );
    checar(
      "resultado: 4 linhas, todas criadas",
      b.linhasResultado().length === 4 && b.linhasResultado().every((l) => l[0] === "Criado"),
      b.linhasResultado(),
    );
    checar("concluído sem falhas: registro descartado", (await b.lote()) === undefined);
    b.app.destruir();
  }

  secao("App: prazo esgotado no criar = incerto, nunca repetido");
  {
    const roteiro: Roteiro = (esp) =>
      esp === "Beta" ? new ErroRpc("PRAZO", "A aba do SEI não respondeu a tempo (criar).") : criado(esp, ++numeroSeq);
    const m = montar({ roteiro });
    await m.app.iniciar();
    await m.configurar("Alfa\nBeta\nGamma");
    m.clicar("Ver prévia");
    m.clicar("Iniciar");
    await ate(() => m.visivel("Continuar"));
    checar(
      "criar com prazo de 60 s",
      m.chamadas.filter((c) => c.op === "criar").every((c) => c.prazo === 60_000),
      m.chamadas.map((c) => c.prazo),
    );
    checar("prazo esgotado pausa o lote", m.quantas("Gamma") === 0 && m.visivel("Continuar"));
    const g = await m.lote();
    const beta = g?.itens[1];
    checar("Beta gravada como ok com número incerto", beta?.situacao === "ok" && beta.criado?.numero === NUMERO_INCERTO, beta);
    m.clicar("Continuar");
    await ate(() => !!m.raiz.querySelector(".pl-resultado"));
    checar("Beta chamada exatamente 1 vez", m.quantas("Beta") === 1);
    checar("Gamma criada depois de continuar", m.quantas("Gamma") === 1);
    const linhaBeta = m.linhasResultado()[1] ?? [];
    checar(
      "tabela: Beta incerta com a dica",
      linhaBeta.join(" ").includes("Incerto") && linhaBeta.join(" ").includes("Controle de Processos"),
      linhaBeta,
    );
    checar("sem falhas: Tentar de novo oculto", !m.visivel("Tentar de novo as falhas"));
    checar("concluído com incerto: registro mantido para conferir", (await m.lote()) !== undefined);
    checar("concluído com incerto: Descartar e começar outro", m.visivel("Descartar e começar outro"));
    m.app.destruir();
  }

  secao("App: Tentar de novo só refaz as falhas (erro), nunca incerto nem ok");
  {
    const roteiro: Roteiro = (esp, vezes) => {
      if (esp === "Alfa" && vezes === 1) return { situacao: "erro", erro: "validação" };
      if (esp === "Beta")
        return {
          situacao: "ok",
          incerto: true,
          criado: { numero: NUMERO_INCERTO, idProcedimento: "", url: "" },
          aviso: "O processo pode ter sido criado",
        };
      return criado(esp, ++numeroSeq);
    };
    const m = montar({ roteiro });
    await m.app.iniciar();
    await m.configurar("Alfa\nBeta\nGamma");
    m.clicar("Ver prévia");
    m.clicar("Iniciar");
    await ate(() => m.visivel("Continuar"));
    checar("incerto da aba pausa o lote", m.quantas("Gamma") === 0 && m.textoVisivel("O SEI não confirmou"));
    m.clicar("Continuar");
    await ate(() => !!m.raiz.querySelector(".pl-resultado"));
    checar("falha: Tentar de novo visível", m.visivel("Tentar de novo as falhas"));
    checar("falha: registro mantido", (await m.lote()) !== undefined);
    m.clicar("Tentar de novo as falhas");
    await ate(() => m.quantas("Alfa") === 2 && !!m.raiz.querySelector(".pl-resultado"));
    await tique(10);
    checar("refez só Alfa", m.quantas("Alfa") === 2 && m.quantas("Beta") === 1 && m.quantas("Gamma") === 1);
    checar("Alfa agora criada", m.linhasResultado()[0]?.[0] === "Criado", m.linhasResultado());
    m.app.destruir();
  }

  secao("App: restrito exige hipótese carregada e escolhida (antes da prévia)");
  {
    const m = montar();
    await m.app.iniciar();
    await m.configurar("Alfa\nBeta", { restrito: true });
    m.clicar("Ver prévia");
    checar("sem hipótese: não abre a prévia", !m.raiz.querySelector(".pl-previa"));
    checar("sem hipótese: erro no formulário", m.textoVisivel("hipótese legal"));
    escolherCombo(m.raiz, "Hipótese legal", "7");
    m.clicar("Ver prévia");
    checar("com hipótese: abre a prévia", !!m.raiz.querySelector(".pl-previa"));
    checar("prévia mostra a hipótese", m.textoVisivel("Controle Interno"));
    m.clicar("Iniciar");
    await ate(() => !!m.raiz.querySelector(".pl-resultado"));
    const pedido = m.criarDe("Alfa")[0]?.args as { nivelAcesso: string; hipoteseLegal: string };
    checar("criar leva restrito e a hipótese", pedido?.nivelAcesso === "1" && pedido.hipoteseLegal === "7", pedido);
    m.app.destruir();

    const v = montar({ hipoteses: [] });
    await v.app.iniciar();
    await v.configurar("Alfa", { restrito: true });
    v.clicar("Ver prévia");
    checar("lista de hipóteses vazia: não abre a prévia", !v.raiz.querySelector(".pl-previa"));
    checar("lista vazia: diz que não carregou", v.textoVisivel("Não foi possível carregar as hipóteses legais"));
    v.app.destruir();

    // Lote público, mas uma linha restrita pela coluna de nível.
    const c = montar();
    await c.app.iniciar();
    await c.configurar("Especificação\tInteressado\tObservação\tNível\nAlfa\t\t\tRestrito\nBeta\t\t\tPúblico");
    c.clicar("Ver prévia");
    checar("linha restrita sem hipótese: bloqueia", !c.raiz.querySelector(".pl-previa") && c.textoVisivel("hipótese legal"));
    c.app.destruir();
  }

  secao("App: sessão expirada pausa o lote");
  {
    const roteiro: Roteiro = (esp) =>
      esp === "Beta" ? { situacao: "erro", erro: "Sessão expirada", parar: true } : criado(esp, ++numeroSeq);
    const m = montar({ roteiro });
    await m.app.iniciar();
    await m.configurar("Alfa\nBeta\nGamma");
    m.clicar("Ver prévia");
    m.clicar("Iniciar");
    await ate(() => m.textoVisivel("A sessão do SEI expirou"));
    await tique(10);
    checar("mensagem da sessão", m.textoVisivel("A sessão do SEI expirou. Entre de novo e tente outra vez."));
    checar("Gamma não saiu", m.quantas("Gamma") === 0);
    checar("pausado: Continuar visível", m.visivel("Continuar"));
    m.app.destruir();
  }

  secao("App: minimizar mostra a pastilha com feitos/total");
  {
    const s = segurar<ResultadoCriar>();
    const roteiro: Roteiro = (esp) => (esp === "Beta" ? s.p : criado(esp, ++numeroSeq));
    const m = montar({ roteiro });
    await m.app.iniciar();
    await m.configurar("Alfa\nBeta\nGamma");
    m.clicar("Ver prévia");
    m.clicar("Iniciar");
    await ate(() => m.quantas("Beta") === 1);
    m.clicar("Minimizar");
    await tique();
    checar("pediu à aba para minimizar", m.t.minimizou.join() === "true");
    const pastilha = m.raiz.querySelector(".pl-pastilha");
    checar("pastilha visível", !!pastilha && !pastilha.closest("[hidden]"));
    checar("pastilha: 1/3", (pastilha?.textContent ?? "").includes("1/3"), pastilha?.textContent);
    checar("minimizado: tela da execução oculta", !m.visivel("Cancelar"));
    s.soltar(criado("Beta", ++numeroSeq));
    await ate(() => (m.raiz.querySelector(".pl-pastilha")?.textContent ?? "").includes("3/3"));
    checar("pastilha acompanha: 3/3", (m.raiz.querySelector(".pl-pastilha")?.textContent ?? "").includes("3/3"));
    m.clicar("Restaurar");
    await tique();
    checar("restaurar pede tela cheia", m.t.minimizou.join() === "true,false");
    checar(
      "restaurado: resultado visível",
      !!m.raiz.querySelector(".pl-resultado") && !m.raiz.querySelector(".pl-resultado")?.closest("[hidden]"),
    );
    m.app.destruir();
  }

  secao("App: a aba restaurou a janela (clique no menu com a pastilha) e o app volta à tela cheia");
  {
    const s = segurar<ResultadoCriar>();
    const m = montar({ roteiro: (esp) => (esp === "Beta" ? s.p : criado(esp, ++numeroSeq)) });
    await m.app.iniciar();
    await m.configurar("Alfa\nBeta");
    m.clicar("Ver prévia");
    m.clicar("Iniciar");
    await ate(() => m.quantas("Beta") === 1);
    m.clicar("Minimizar");
    await tique();
    checar("minimizado", m.doc.documentElement.hasAttribute("data-minimizado"));
    m.app.restaurado();
    checar(
      "restaurado pela aba: sem pastilha, conteúdo visível, sem novo pedido à aba",
      !m.doc.documentElement.hasAttribute("data-minimizado") &&
        !!m.raiz.querySelector(".pl-pastilha[hidden]") &&
        m.visivel("Cancelar") &&
        m.t.minimizou.join() === "true",
      m.t.minimizou,
    );
    m.app.restaurado();
    checar("restaurado de novo: nada muda", !m.doc.documentElement.hasAttribute("data-minimizado"));
    s.soltar(criado("Beta", ++numeroSeq));
    await ate(() => !!m.raiz.querySelector(".pl-resultado"));
    m.app.destruir();
  }

  secao("App: fechar durante a execução pausa e mantém o registro");
  {
    const s = segurar<ResultadoCriar>();
    const roteiro: Roteiro = (esp) => (esp === "Alfa" ? s.p : criado(esp, ++numeroSeq));
    const m = montar({ roteiro });
    await m.app.iniciar();
    await m.configurar("Alfa\nBeta");
    m.clicar("Ver prévia");
    m.clicar("Iniciar");
    await ate(() => m.quantas("Alfa") === 1);
    const emVoo = await m.lote();
    checar("antes da resposta: linha em voo já gravada como incerta", emVoo?.itens[0]?.criado?.numero === NUMERO_INCERTO, emVoo?.itens[0]);
    m.app.destruir();
    s.soltar(criado("Alfa", ++numeroSeq));
    await tique(20);
    const g = await m.lote();
    checar("a resposta em voo ainda é gravada", g?.itens[0]?.situacao === "ok" && g.itens[0].criado?.numero !== NUMERO_INCERTO, g?.itens);
    checar("Beta não saiu depois de fechar", m.quantas("Beta") === 0 && g?.itens[1]?.situacao === "pendente");
  }

  secao("App: resultado (CSV, copiar, links permanentes)");
  {
    const roteiro: Roteiro = (esp) =>
      esp === "Beta"
        ? { situacao: "ok", incerto: true, criado: { numero: NUMERO_INCERTO, idProcedimento: "", url: "" }, aviso: "incerto" }
        : criado(esp, ++numeroSeq);
    const m = montar({ roteiro });
    await m.app.iniciar();
    await m.configurar("Alfa\nBeta\nGamma");
    m.clicar("Ver prévia");
    m.clicar("Iniciar");
    await ate(() => m.visivel("Continuar"));
    m.clicar("Continuar");
    await ate(() => !!m.raiz.querySelector(".pl-resultado"));
    const cab = [...m.raiz.querySelectorAll(".pl-resultado table thead th")].map((th) => (th.textContent ?? "").trim());
    checar(
      "colunas",
      ["Situação", "Nº", "Número SEI", "Especificação", "Link"].every((c) => cab.includes(c)),
      cab,
    );
    checar("links clicáveis só dos criados", m.raiz.querySelectorAll(".pl-resultado table tbody a").length === 2);
    m.clicar("Baixar CSV");
    checar(
      "CSV processos-em-lote.csv",
      m.baixados[0]?.nome === "processos-em-lote.csv" && (m.baixados[0]?.conteudo ?? "").includes("Alfa"),
    );
    m.clicar("Copiar com links");
    await tique();
    checar("copiou o resultado", (m.copiados[0] ?? "").includes("Gamma"));
    m.clicar("Gerar links permanentes destes processos");
    await ate(() => m.t.fechou === 1);
    const numeros = m.t.entradaLink[0]?.split("\n") ?? [];
    checar(
      "entrada do Link Permanente: só os números criados, um por linha",
      numeros.length === 2 && !numeros.includes(NUMERO_INCERTO),
      numeros,
    );
    const i1 = m.eventos.indexOf("gravarEntradaLink");
    const i2 = m.eventos.indexOf("abrirLinkPermanente");
    const i3 = m.eventos.indexOf("fechar-app");
    checar("grava a entrada, abre o Link Permanente e fecha, nessa ordem", i1 >= 0 && i1 < i2 && i2 < i3, m.eventos);
    checar("chave da entrada igual à do Link Permanente", CHAVE_ENTRADA_LINK === "link-permanente/entrada");
    m.app.destruir();
  }

  secao("App: configuração (contador, quantidade, pausa, descartar)");
  {
    const m = montar();
    await m.app.iniciar();
    checar("aviso de cautela", m.textoVisivel("Use com cautela."));
    checar("Ver prévia desligado sem tipo", botao(m.raiz, "Ver prévia")?.disabled === true);
    await m.configurar("");
    m.preencher("pl-quantidade", "3");
    checar("contador da quantidade", m.textoVisivel("serão abertos 3 processos sem especificação"));
    m.digitar("Alfa\nBeta");
    checar("contador das linhas", m.textoVisivel("2 linhas preenchidas — serão abertos 2 processos."));
    checar("com linhas, quantidade desligada", m.campo("pl-quantidade").disabled);
    m.digitar("");
    m.preencher("pl-quantidade", "2001");
    m.clicar("Ver prévia");
    checar("acima do teto: erro", m.textoVisivel("2000") && !m.raiz.querySelector(".pl-previa"));
    m.preencher("pl-quantidade", "2");
    m.preencher("pl-pausa", "50");
    m.clicar("Ver prévia");
    checar("pausa limitada a 200 ms na prévia", m.textoVisivel("200 ms"));
    checar("modo quantidade na prévia", m.textoVisivel("2 processos sem especificação"));
    m.clicar("Voltar");
    checar("voltar mantém a quantidade", m.campo("pl-quantidade").value === "2");
    m.app.destruir();

    // Descartar um lote incompleto.
    const area = areaMemoria();
    const repo = new RepositorioLote(area, ESCOPO);
    await repo.gravar({
      id: "x",
      host: "sei.x.gov.br",
      login: "ana",
      iniciadoEm: 1,
      parametros: { idTipo: "10", nomeTipo: "Contrato", nivelAcesso: "0", hipoteseLegal: "", nomeHipotese: "", pausa: 500 },
      linhas: [{ especificacao: "A" }, { especificacao: "B" }],
      itens: [{ situacao: "ok", criado: { numero: "1", idProcedimento: "1", url: "" } }, { situacao: "pendente" }],
    });
    const d = montar({ area });
    await d.app.iniciar();
    checar("lote incompleto: oferece continuar", d.visivel("Continuar de onde parou"));
    checar("resumo do lote: 1 de 2", d.textoVisivel("1 de 2"));
    d.clicar("Descartar");
    await ate(() => !!combo(d.raiz, "Tipo de processo"));
    checar("descartado: registro removido", (await d.lote()) === undefined);
    checar("descartado: volta à configuração", !!combo(d.raiz, "Tipo de processo"));
    checar("nenhum criar ao descartar", d.quantas("A") + d.quantas("B") === 0);
    d.app.destruir();
  }

  secao("App: prévia com caracteres trocados e corte");
  {
    const m = montar();
    await m.app.iniciar();
    const longa = "x".repeat(120);
    await m.configurar(`Contrato — aditivo\n${longa}`);
    m.clicar("Ver prévia");
    checar("caracteres trocados", m.textoVisivel("caracteres trocados"));
    const marcas = [...m.raiz.querySelectorAll(".pl-previa mark")].map((x) => x.textContent);
    checar("trecho trocado em destaque", marcas.includes("-"), marcas);
    checar("cortada em 100 caracteres", m.textoVisivel("cortada em 100 caracteres"));
    m.app.destruir();
  }

  secao("App: trechos enviados = texto da prévia; modo quantidade cria sem especificação");
  {
    const casos = ["  \u00A0Contrato \u201Cx\u201D \u2014 y\u2026  ", `${"a".repeat(98)}\u2014\u2014\u2014`, "\u00A0\u00A0", "Ação 1"];
    for (const c of casos) {
      const junto = partesEnviadas(c)
        .map((p) => p.texto)
        .join("");
      const esperado = montarPrevia([{ especificacao: c }])[0]?.enviada;
      checar(`trechos juntos = enviada (${JSON.stringify(c).slice(0, 24)})`, junto === esperado, { junto, esperado });
    }
    const m = montar();
    await m.app.iniciar();
    await m.configurar("");
    m.preencher("pl-quantidade", "2");
    m.clicar("Ver prévia");
    m.clicar("Iniciar");
    await ate(() => !!m.raiz.querySelector(".pl-resultado"));
    checar(
      "quantidade 2: dois criar com especificação vazia",
      m.quantas("") === 2,
      m.chamadas.map((c) => c.op),
    );
    m.app.destruir();
  }

  secao("Fix 1: lote recente pode estar em outra aba (aviso, segundo clique, a outra aba para)");
  {
    const area = areaMemoria();
    const relogio = { t: 1_000_000 };
    const s = segurar<ResultadoCriar>();
    const a = montar({ area, relogio, roteiro: (esp) => (esp === "Beta" ? s.p : criado(esp, ++numeroSeq)) });
    await a.app.iniciar();
    await a.configurar("Alfa\nBeta\nGamma\nDelta");
    a.clicar("Ver prévia");
    a.clicar("Iniciar");
    await ate(() => a.quantas("Beta") === 1);
    a.clicar("Minimizar");
    await tique();
    relogio.t += 5000;
    // Outra aba abre o modulo enquanto a primeira (minimizada) espera a resposta de Beta.
    const b = montar({ area, relogio });
    await b.app.iniciar();
    checar(
      "aviso de outra aba, com os segundos",
      b.textoVisivel("Este lote foi atualizado há 5 segundos e pode estar em execução em outra aba do SEI."),
    );
    checar("Descartar continua disponível", b.visivel("Descartar"));
    b.clicar("Continuar de onde parou");
    await tique(10);
    checar(
      "primeiro clique não começa nada",
      b.chamadas.every((c) => c.op !== "formTipo" && c.op !== "criar"),
    );
    checar("pede o segundo clique explícito", b.visivel("Continuar mesmo assim") && !b.visivel("Continuar de onde parou"));
    b.clicar("Continuar mesmo assim");
    await ate(() => !!b.raiz.querySelector(".pl-resultado"));
    checar("a outra aba não repete Alfa nem a Beta em voo", b.quantas("Alfa") === 0 && b.quantas("Beta") === 0);
    checar("a outra aba cria Gamma e Delta", b.quantas("Gamma") === 1 && b.quantas("Delta") === 1);
    s.soltar(criado("Beta", ++numeroSeq));
    await tique(30);
    checar("a primeira aba para: nenhum criar depois de assumida", a.quantas("Gamma") === 0 && a.quantas("Delta") === 0);
    const pastilha = a.raiz.querySelector(".pl-pastilha")?.textContent ?? "";
    checar("a primeira aba mostra a parada na pastilha", pastilha.includes(`Parado: ${MENSAGEM_ASSUMIDO}`), pastilha);
    a.app.destruir();
    b.app.destruir();
  }

  secao("Fix 1: lote descartado por outra aba: a execução para sem POST");
  {
    const area = areaMemoria();
    const relogio = { t: 1_000_000 };
    const s = segurar<ResultadoCriar>();
    const a = montar({ area, relogio, roteiro: (esp) => (esp === "Alfa" ? s.p : criado(esp, ++numeroSeq)) });
    await a.app.iniciar();
    await a.configurar("Alfa\nBeta\nGamma");
    a.clicar("Ver prévia");
    a.clicar("Iniciar");
    await ate(() => a.quantas("Alfa") === 1);
    const b = montar({ area, relogio });
    await b.app.iniciar();
    b.clicar("Descartar");
    await ate(() => !!combo(b.raiz, "Tipo de processo"));
    s.soltar(criado("Alfa", ++numeroSeq));
    await tique(30);
    checar("depois do descarte, zero criar", a.quantas("Beta") === 0 && a.quantas("Gamma") === 0);
    checar("descartado continua descartado", (await a.lote()) === undefined);
    a.app.destruir();
    b.app.destruir();

    // marcar recusado ANTES do POST: nada sai e a mensagem aparece.
    const m = montar();
    await m.app.iniciar();
    await m.configurar("Alfa\nBeta");
    m.repo.marcar = async () => false;
    m.clicar("Ver prévia");
    m.clicar("Iniciar");
    await ate(() => m.textoVisivel(MENSAGEM_ASSUMIDO));
    await tique(10);
    checar(
      "marcar recusado: zero criar e lote parado",
      m.chamadas.filter((c) => c.op === "criar").length === 0 && m.textoVisivel(MENSAGEM_ASSUMIDO),
    );
    m.app.destruir();
  }

  secao("Fix 1: falha ao gravar antes e depois do POST pausa com MENSAGEM_GRAVAR");
  {
    const antes = montar();
    await antes.app.iniciar();
    await antes.configurar("Alfa\nBeta");
    antes.repo.marcar = async () => {
      throw new Error("cota");
    };
    antes.clicar("Ver prévia");
    antes.clicar("Iniciar");
    await ate(() => antes.textoVisivel(MENSAGEM_GRAVAR));
    await tique(10);
    checar(
      "gravar antes falhou: zero criar, pausado",
      antes.chamadas.filter((c) => c.op === "criar").length === 0 && antes.visivel("Continuar"),
    );
    antes.app.destruir();

    const depois = montar();
    await depois.app.iniciar();
    await depois.configurar("Alfa\nBeta");
    const original = depois.repo.marcar.bind(depois.repo);
    let n = 0;
    depois.repo.marcar = async (...args: Parameters<typeof original>) => {
      n += 1;
      if (n === 2) throw new Error("cota");
      return original(...args);
    };
    depois.clicar("Ver prévia");
    depois.clicar("Iniciar");
    await ate(() => depois.textoVisivel(MENSAGEM_GRAVAR));
    await tique(10);
    checar("gravar depois falhou: Alfa uma vez, Beta não saiu", depois.quantas("Alfa") === 1 && depois.quantas("Beta") === 0);
    const g = await depois.lote();
    checar("Alfa fica incerta no registro (gravada antes do POST)", g?.itens[0]?.criado?.numero === NUMERO_INCERTO, g?.itens[0]);
    depois.app.destruir();
  }

  secao("Fix 1: cliques duplos não abrem dois executores");
  {
    const m = montar({
      roteiro: (esp, vezes) => (esp === "Beta" && vezes === 1 ? { situacao: "erro", erro: "x" } : criado(esp, ++numeroSeq)),
    });
    await m.app.iniciar();
    await m.configurar("Alfa\nBeta\nGamma");
    m.clicar("Ver prévia");
    const iniciar = botao(m.raiz, "Iniciar")!;
    disparar(iniciar, "click");
    disparar(iniciar, "click");
    await ate(() => !!m.raiz.querySelector(".pl-resultado"));
    await tique(10);
    checar("Iniciar duplo: cada linha uma vez", m.quantas("Alfa") === 1 && m.quantas("Beta") === 1 && m.quantas("Gamma") === 1);
    checar("Iniciar duplo: um lote gravado", m.eventos.filter((e) => e === "repo.gravar").length === 1);
    const repetir = botao(m.raiz, "Tentar de novo as falhas")!;
    disparar(repetir, "click");
    disparar(repetir, "click");
    await ate(() => m.quantas("Beta") === 2 && !!m.raiz.querySelector(".pl-resultado"));
    await tique(10);
    checar("Tentar de novo duplo: Beta só mais uma vez", m.quantas("Beta") === 2 && m.quantas("Alfa") === 1);
    m.app.destruir();

    const c = montar({ roteiro: (esp) => (esp === "Alfa" ? { situacao: "erro", erro: "Sessão", parar: true } : criado(esp, ++numeroSeq)) });
    await c.app.iniciar();
    await c.configurar("Alfa\nBeta\nGamma");
    c.clicar("Ver prévia");
    c.clicar("Iniciar");
    await ate(() => c.visivel("Continuar"));
    const continuar = botao(c.raiz, "Continuar")!;
    disparar(continuar, "click");
    disparar(continuar, "click");
    await ate(() => !!c.raiz.querySelector(".pl-resultado"));
    await tique(10);
    checar("Continuar duplo: Beta e Gamma uma vez cada", c.quantas("Beta") === 1 && c.quantas("Gamma") === 1);
    c.app.destruir();
  }

  secao("Fix 1: Continuar os que faltam depois de Cancelar");
  {
    let m: ReturnType<typeof montar> | null = null;
    m = montar({
      aoCriar: (esp) => {
        if (esp === "Beta") m?.clicar("Cancelar");
      },
    });
    await m.app.iniciar();
    await m.configurar("Alfa\nBeta\nGamma\nDelta");
    m.clicar("Ver prévia");
    m.clicar("Iniciar");
    await ate(() => !!m?.raiz.querySelector(".pl-resultado"));
    checar("cancelado: Gamma e Delta não saíram", m.quantas("Gamma") === 0 && m.quantas("Delta") === 0);
    checar("cancelado: oferece continuar os que faltam", m.visivel("Continuar os que faltam"));
    m.clicar("Continuar os que faltam");
    await ate(() => m?.quantas("Delta") === 1 && !!m?.raiz.querySelector(".pl-resultado"));
    await tique(10);
    checar(
      "continuar os que faltam: só Gamma e Delta, uma vez",
      ["Alfa", "Beta", "Gamma", "Delta"].every((e) => m?.quantas(e) === 1),
    );
    checar("tudo criado: registro descartado", (await m.lote()) === undefined);
    m.app.destruir();
  }

  secao("Fix 1: reabrir lote concluído com incerto mostra o resumo, não descarta");
  {
    const area = areaMemoria();
    await new RepositorioLote(area, ESCOPO, () => 1).gravar({
      id: "y",
      host: "sei.x.gov.br",
      login: "ana",
      iniciadoEm: 1,
      parametros: { idTipo: "10", nomeTipo: "Contrato", nivelAcesso: "0", hipoteseLegal: "", nomeHipotese: "", pausa: 500 },
      linhas: [{ especificacao: "A" }, { especificacao: "B" }],
      itens: [
        { situacao: "ok", criado: { numero: "00001.000001/2026-11", idProcedimento: "1", url: "u" } },
        { situacao: "ok", criado: { numero: NUMERO_INCERTO, idProcedimento: "", url: "" }, aviso: "sem confirmação", incerto: true },
      ],
    });
    const m = montar({ area });
    await m.app.iniciar();
    await ate(() => !!m.raiz.querySelector(".pl-resultado"));
    checar("mostra o resultado com a linha incerta", m.linhasResultado()[1]?.[0] === "Incerto", m.linhasResultado());
    checar("contagem de incertos e dica", m.textoVisivel("1 linha ficou incerta") && m.textoVisivel("Controle de Processos"));
    checar("registro mantido até o usuário descartar", (await m.lote()) !== undefined);
    m.clicar("Baixar CSV");
    checar("CSV disponível", m.baixados[0]?.nome === "processos-em-lote.csv");
    m.clicar("Descartar e começar outro");
    await ate(() => !!combo(m.raiz, "Tipo de processo"));
    checar("descartado e de volta à configuração", (await m.lote()) === undefined && !!combo(m.raiz, "Tipo de processo"));
    checar(
      "nenhum criar",
      m.chamadas.every((c) => c.op !== "criar"),
    );
    m.app.destruir();

    // Sem incerto nem aviso: descarta em silêncio.
    const area2 = areaMemoria();
    await new RepositorioLote(area2, ESCOPO, () => 1).gravar({
      id: "z",
      host: "sei.x.gov.br",
      login: "ana",
      iniciadoEm: 1,
      parametros: { idTipo: "10", nomeTipo: "Contrato", nivelAcesso: "0", hipoteseLegal: "", nomeHipotese: "", pausa: 500 },
      linhas: [{ especificacao: "A" }],
      itens: [{ situacao: "ok", criado: { numero: "00001.000001/2026-11", idProcedimento: "1", url: "u" } }],
    });
    const z = montar({ area: area2 });
    await z.app.iniciar();
    await ate(() => !!combo(z.raiz, "Tipo de processo"));
    checar("tudo confirmado: descarta e vai à configuração", (await z.lote()) === undefined);
    z.app.destruir();
  }

  secao("Correção: texto do tipo de processo depois de carregar (carregando, selecione, indisponíveis)");
  {
    const m = montar();
    await m.app.iniciar();
    await ate(
      () => m.chamadas.some((c) => c.op === "tipos") && !(combo(m.raiz, "Tipo de processo")?.textContent ?? "").includes("carregando"),
    );
    const texto = combo(m.raiz, "Tipo de processo")?.textContent ?? "";
    checar("tipos carregados: pede a escolha", texto.includes("selecione o tipo de processo") && !texto.includes("carregando"), texto);
    m.app.destruir();

    instalarDom();
    const nunca = new TelaConfiguracao({
      rpc: { chamar: (() => new Promise(() => undefined)) as never },
      cache: { tipos: null, forms: new Map() },
      verPrevia: () => undefined,
    });
    void nunca.iniciar();
    await tique(5);
    checar(
      "enquanto carrega: carregando",
      (combo(nunca.el, "Tipo de processo")?.textContent ?? "").includes("carregando tipos de processo..."),
    );
    nunca.destruir();

    const falha = new TelaConfiguracao({
      rpc: { chamar: (async () => Promise.reject(new Error("caiu"))) as never },
      cache: { tipos: null, forms: new Map() },
      verPrevia: () => undefined,
    });
    await falha.iniciar();
    const tf = combo(falha.el, "Tipo de processo")?.textContent ?? "";
    checar("falhou ao carregar: indisponíveis", tf.includes("tipos indisponíveis") && !tf.includes("carregando"), tf);
    falha.destruir();
  }

  secao("Correção: aviso de cautela num parágrafo só, com o negrito no meio da frase");
  {
    const m = montar();
    await m.app.iniciar();
    const aviso = m.raiz.querySelector(".pl-cautela-forte");
    const ps = aviso ? [...aviso.querySelectorAll("p")] : [];
    checar("um parágrafo só", ps.length === 1, ps.length);
    const p = ps[0];
    const fortes = p ? [...p.children].filter((c) => c.tagName === "STRONG").map((c) => c.textContent) : [];
    checar(
      "negritos são filhos diretos do parágrafo",
      JSON.stringify(fortes) === JSON.stringify(["para todos os usuários", "fora do horário comercial"]),
      fortes,
    );
    const textos = p ? [...p.childNodes].filter((n) => n.nodeType === 3 && (n.textContent ?? "").trim()).length : 0;
    checar("texto corrido entre os negritos (nós de texto no mesmo parágrafo)", textos >= 3, textos);
    checar(
      "nenhum negrito do parágrafo tem classe (fica inline)",
      p ? [...p.querySelectorAll("strong")].every((x) => !x.getAttribute("class")) : false,
    );
    const css = readFileSync(new URL("../estatico/processos-lote.css", import.meta.url), "utf8");
    checar("o CSS não transforma negrito do aviso em bloco", !/\.pl-cautela-forte\s+strong/.test(css));
    m.app.destruir();
  }

  secao("Correção: aba parada por 'assumido' não descarta o lote de outra aba");
  {
    const area = areaMemoria();
    const relogio = { t: 1_000_000 };
    const sa = segurar<ResultadoCriar>();
    const a = montar({ area, relogio, roteiro: (esp) => (esp === "Alfa" ? sa.p : criado(esp, ++numeroSeq)) });
    await a.app.iniciar();
    await a.configurar("Alfa");
    a.clicar("Ver prévia");
    a.clicar("Iniciar");
    await ate(() => a.quantas("Alfa") === 1);
    const idDeA = (await a.lote())?.id;

    // Outra aba: o lote de A aparece para conferir (Alfa em voo); ela descarta e começa o seu.
    const sb = segurar<ResultadoCriar>();
    const b = montar({ area, relogio, roteiro: (esp) => (esp === "Xis" ? sb.p : criado(esp, ++numeroSeq)) });
    const descartes: Array<string | undefined> = [];
    const descartarOriginal = b.repo.descartar.bind(b.repo);
    b.repo.descartar = (id?: string) => {
      descartes.push(id);
      return descartarOriginal(id);
    };
    await b.app.iniciar();
    await ate(() => b.visivel("Descartar e começar outro"));
    b.clicar("Descartar e começar outro");
    await ate(() => !!combo(b.raiz, "Tipo de processo"));
    checar("o app passa o id do próprio lote ao descartar", descartes.length === 1 && descartes[0] === idDeA, { descartes, idDeA });
    await b.configurar("Xis");
    b.clicar("Ver prévia");
    b.clicar("Iniciar");
    await ate(() => b.quantas("Xis") === 1);
    const idDeB = (await b.lote())?.id;
    checar("B gravou um lote novo", !!idDeB && idDeB !== idDeA);

    // A recebe a resposta de Alfa: a regravação é recusada (outro id) e A para como "assumido".
    sa.soltar(criado("Alfa", ++numeroSeq));
    await ate(() => a.textoVisivel(MENSAGEM_ASSUMIDO));
    checar("A parou como assumido", a.textoVisivel(MENSAGEM_ASSUMIDO));
    a.clicar("Cancelar");
    await ate(() => !!a.raiz.querySelector(".pl-resultado"));
    await tique(10);
    checar("o lote de B continua gravado depois do Cancelar de A", (await b.lote())?.id === idDeB, (await b.lote())?.id);
    sb.soltar(criado("Xis", ++numeroSeq));
    await ate(() => !!b.raiz.querySelector(".pl-resultado"));
    a.app.destruir();
    b.app.destruir();
  }

  secao("Modelos: aplicar preenche tipo, nível, hipótese e pausa (nunca as linhas)");
  {
    const area = areaMemoria();
    const repoM = new RepositorioModelos(area, ESCOPO);
    const pregao = await repoM.salvar("Pregões", {
      idTipo: "20",
      nomeTipo: "Licitação: Pregão",
      nivelAcesso: "1",
      hipoteseLegal: "7",
      nomeHipotese: "Controle Interno",
      pausa: 900,
    });
    const m = montar({ area });
    await m.app.iniciar();
    await ate(() => opcoesCombo(m.raiz, ROTULO_MODELO).length > 0);
    checar("combo de modelos lista o salvo", opcoesCombo(m.raiz, ROTULO_MODELO).join() === "Pregões", opcoesCombo(m.raiz, ROTULO_MODELO));
    checar("sem modelo escolhido: placeholder", textoCombo(m.raiz, ROTULO_MODELO).includes("sem modelo"));
    checar("sem modelo: Renomear e Apagar escondidos", !m.visivel("Renomear") && !m.visivel("Apagar"));
    checar("Salvar como modelo… visível", m.visivel("Salvar como modelo…"));
    m.digitar("Alfa\nBeta");
    escolherCombo(m.raiz, ROTULO_MODELO, pregao.id);
    await ate(() => !botao(m.raiz, "Ver prévia")?.disabled);
    checar(
      "aplicar carrega o formulário do tipo pelo formTipo",
      m.chamadas.some((c) => c.op === "formTipo" && (c.args as { idTipo: string }).idTipo === "20"),
    );
    checar("aplicar escolhe o tipo", textoCombo(m.raiz, "Tipo de processo").includes("Licitação: Pregão"));
    checar("aplicar marca restrito", m.raiz.querySelector<HTMLInputElement>('input[name="pl-nivel"][value="1"]')?.checked === true);
    checar("aplicar escolhe a hipótese", textoCombo(m.raiz, "Hipótese legal").includes("Controle Interno"));
    checar("aplicar define a pausa", m.campo("pl-pausa").value === "900");
    checar("aplicar não mexe nas linhas", m.caixa().value === "Alfa\nBeta");
    checar("com modelo: Renomear e Apagar visíveis", m.visivel("Renomear") && m.visivel("Apagar"));
    m.clicar("Ver prévia");
    checar("modelo aplicado vai à prévia com a hipótese", !!m.raiz.querySelector(".pl-previa") && m.textoVisivel("Controle Interno"));
    m.clicar("Voltar");
    await ate(() => textoCombo(m.raiz, ROTULO_MODELO).includes("Pregões"));
    checar("Voltar mantém o modelo escolhido", textoCombo(m.raiz, ROTULO_MODELO).includes("Pregões"));
    m.app.destruir();
  }

  secao("Modelos: tipo ou hipótese que não existe mais avisa e não muda o campo");
  {
    const area = areaMemoria();
    const repoM = new RepositorioModelos(area, ESCOPO);
    const sumiu = await repoM.salvar("Tipo extinto", {
      idTipo: "99",
      nomeTipo: "Extinto",
      nivelAcesso: "1",
      hipoteseLegal: "",
      nomeHipotese: "",
      pausa: 1200,
    });
    const semHip = await repoM.salvar("Hipótese extinta", {
      idTipo: "20",
      nomeTipo: "Licitação: Pregão",
      nivelAcesso: "1",
      hipoteseLegal: "55",
      nomeHipotese: "Revogada",
      pausa: 600,
    });
    const m = montar({ area });
    await m.app.iniciar();
    await m.configurar("Alfa");
    const formsAntes = m.chamadas.filter((c) => c.op === "formTipo").length;
    escolherCombo(m.raiz, ROTULO_MODELO, sumiu.id);
    await ate(() => m.textoVisivel(ERRO_TIPO_MODELO));
    checar("tipo ausente: avisa no formulário", m.textoVisivel(ERRO_TIPO_MODELO));
    checar("tipo ausente: o tipo atual fica", textoCombo(m.raiz, "Tipo de processo").includes("Contrato: Gestão"));
    checar("tipo ausente: nenhum formTipo novo", m.chamadas.filter((c) => c.op === "formTipo").length === formsAntes);
    checar("tipo ausente: Ver prévia segue com o tipo atual", botao(m.raiz, "Ver prévia")?.disabled === false);
    checar("tipo ausente: o nível não muda", m.raiz.querySelector<HTMLInputElement>('input[name="pl-nivel"][value="0"]')?.checked === true);
    checar("tipo ausente: a pausa não muda", m.campo("pl-pausa").value === "500", m.campo("pl-pausa").value);

    escolherCombo(m.raiz, ROTULO_MODELO, semHip.id);
    await ate(() => m.textoVisivel(ERRO_HIPOTESE_MODELO));
    checar("hipótese ausente: avisa no formulário", m.textoVisivel(ERRO_HIPOTESE_MODELO));
    checar("hipótese ausente: o tipo é aplicado", textoCombo(m.raiz, "Tipo de processo").includes("Licitação: Pregão"));
    checar(
      "hipótese ausente: nenhuma hipótese escolhida",
      !textoCombo(m.raiz, "Hipótese legal").includes("Revogada") && textoCombo(m.raiz, "Hipótese legal").includes("selecione"),
    );
    checar("hipótese ausente: tipo de aviso antigo some", !m.textoVisivel(ERRO_TIPO_MODELO));
    checar(
      "hipótese ausente: o nível é aplicado",
      m.raiz.querySelector<HTMLInputElement>('input[name="pl-nivel"][value="1"]')?.checked === true,
    );
    checar("hipótese ausente: a pausa é aplicada", m.campo("pl-pausa").value === "600");
    m.app.destruir();

    // Lista de hipóteses vazia = não carregou: o aviso é o de sempre, não "não existe mais".
    const areaV = areaMemoria();
    const comHip = await new RepositorioModelos(areaV, ESCOPO).salvar("Com hipótese", {
      idTipo: "20",
      nomeTipo: "Licitação: Pregão",
      nivelAcesso: "1",
      hipoteseLegal: "7",
      nomeHipotese: "Controle Interno",
      pausa: 600,
    });
    const v = montar({ area: areaV, hipoteses: [] });
    await v.app.iniciar();
    await ate(() => opcoesCombo(v.raiz, ROTULO_MODELO).length > 0);
    escolherCombo(v.raiz, ROTULO_MODELO, comHip.id);
    await ate(() => v.textoVisivel("Não foi possível carregar as hipóteses legais"));
    checar("hipóteses não carregadas: aviso de não carregou", v.textoVisivel("Não foi possível carregar as hipóteses legais"));
    checar("hipóteses não carregadas: não diz 'não existe mais'", !v.textoVisivel(ERRO_HIPOTESE_MODELO));
    checar("hipóteses não carregadas: tipo aplicado", textoCombo(v.raiz, "Tipo de processo").includes("Licitação: Pregão"));
    v.app.destruir();
  }

  secao("Modelos: salvar, renomear e apagar refletem no combo");
  {
    const m = montar();
    await m.app.iniciar();
    await ate(() => !!combo(m.raiz, ROTULO_MODELO) && m.chamadas.some((c) => c.op === "tipos"));
    m.clicar("Salvar como modelo…");
    checar("salvar sem tipo: erro no formulário, sem diálogo", m.textoVisivel("Selecione um tipo de processo") && !dialogo(m.doc));
    await m.configurar("Linha que não vai para o modelo", { restrito: true, hipotese: true });
    m.preencher("pl-pausa", "700");
    m.clicar("Salvar como modelo…");
    const d1 = dialogo(m.doc);
    checar("salvar abre o diálogo do nome", !!d1);
    checar("diálogo sem Cancelar", !!d1 && !botao(d1, "Cancelar"));
    const nome1 = d1?.querySelector("input") as HTMLInputElement;
    checar("campo do nome limita a 80", nome1?.getAttribute("maxlength") === "80");
    nome1.value = "   ";
    disparar(botao(d1!, "Salvar modelo")!, "click");
    await tique(5);
    checar(
      "nome vazio: erro no diálogo, nada salvo",
      (d1?.textContent ?? "").includes("Informe o nome") && (await m.modelos.listar()).length === 0,
    );
    nome1.value = "Contratos restritos";
    disparar(nome1, "input");
    disparar(botao(d1!, "Salvar modelo")!, "click");
    await ate(() => !dialogo(m.doc));
    const salvos = await m.modelos.listar();
    checar("salvou um modelo", salvos.length === 1 && salvos[0]?.nome === "Contratos restritos", salvos);
    checar(
      "modelo guarda tipo, nível, hipótese e pausa",
      JSON.stringify(salvos[0]?.parametros) ===
        JSON.stringify({
          idTipo: "10",
          nomeTipo: "Contrato: Gestão",
          nivelAcesso: "1",
          hipoteseLegal: "7",
          nomeHipotese: HIPOTESES[0]!.nome,
          pausa: 700,
        }),
      salvos[0]?.parametros,
    );
    checar("modelo não guarda linhas", !JSON.stringify(salvos[0]).includes("Linha que não vai"));
    checar(
      "salvo aparece no combo e fica escolhido",
      opcoesCombo(m.raiz, ROTULO_MODELO).join() === "Contratos restritos" &&
        textoCombo(m.raiz, ROTULO_MODELO).includes("Contratos restritos"),
    );
    checar("salvo: Renomear e Apagar visíveis", m.visivel("Renomear") && m.visivel("Apagar"));

    // Mesmo nome: avisa que substitui.
    m.clicar("Salvar como modelo…");
    const d2 = dialogo(m.doc)!;
    const nome2 = d2.querySelector<HTMLInputElement>("input")!;
    checar("salvar de novo sugere o nome do modelo escolhido", nome2.value === "Contratos restritos");
    disparar(nome2, "input");
    checar("nome existente: avisa que substitui", (d2.textContent ?? "").includes("será substituído"));
    nome2.value = "Outro";
    disparar(nome2, "input");
    checar("nome novo: sem aviso de substituição", !(d2.textContent ?? "").includes("será substituído"));
    disparar(botao(d2, "Salvar modelo")!, "click");
    await ate(() => !dialogo(m.doc));
    checar(
      "dois modelos no combo, por nome",
      opcoesCombo(m.raiz, ROTULO_MODELO).join() === "Contratos restritos,Outro",
      opcoesCombo(m.raiz, ROTULO_MODELO),
    );

    // Renomear para o nome de outro modelo: erro no diálogo.
    m.clicar("Renomear");
    const d3 = dialogo(m.doc)!;
    const nome3 = d3.querySelector<HTMLInputElement>("input")!;
    checar("renomear sugere o nome atual", nome3.value === "Outro");
    nome3.value = "contratos RESTRITOS";
    disparar(botao(d3, "Renomear modelo")!, "click");
    await tique(5);
    checar("renomear para nome de outro: erro no diálogo", !!dialogo(m.doc) && (d3.textContent ?? "").includes("Já existe outro modelo"));
    nome3.value = "Pregões 2026";
    disparar(botao(d3, "Renomear modelo")!, "click");
    await ate(() => !dialogo(m.doc));
    checar(
      "renomeado aparece no combo",
      opcoesCombo(m.raiz, ROTULO_MODELO).join() === "Contratos restritos,Pregões 2026" &&
        textoCombo(m.raiz, ROTULO_MODELO).includes("Pregões 2026"),
    );

    // Renomear um modelo que sumiu (apagado em outra aba): erro no diálogo e o combo relista.
    const sumido = (await m.modelos.listar()).find((x) => x.nome === "Pregões 2026")!;
    await new RepositorioModelos(m.area, ESCOPO).apagar(sumido.id);
    m.clicar("Renomear");
    const d4 = dialogo(m.doc)!;
    (d4.querySelector("input") as HTMLInputElement).value = "Qualquer";
    disparar(botao(d4, "Renomear modelo")!, "click");
    await ate(() => (d4.textContent ?? "").includes("não existe mais"));
    checar("renomear modelo sumido: erro no diálogo", !!dialogo(m.doc) && (d4.textContent ?? "").includes("não existe mais"));
    checar("renomear modelo sumido: combo relistado", opcoesCombo(m.raiz, ROTULO_MODELO).join() === "Contratos restritos");
    m.fecharDialogo();
    // Recria o modelo escolhido para as provas do Apagar (Enter grava).
    m.clicar("Salvar como modelo…");
    const d5 = dialogo(m.doc)!;
    const nome5 = d5.querySelector("input") as HTMLInputElement;
    checar("diálogo do nome: foco no campo", m.doc.activeElement === nome5 || m.focados.includes(nome5));
    nome5.value = "Pregões 2026";
    const Teclado = (m.doc.defaultView as unknown as { Event: typeof Event }).Event;
    const compondo = new Teclado("keydown", { bubbles: true }) as KeyboardEvent;
    Object.assign(compondo, { key: "Enter", isComposing: true });
    nome5.dispatchEvent(compondo);
    await tique(5);
    checar("Enter durante composição não grava", !!dialogo(m.doc) && (await m.modelos.listar()).length === 1);
    const enter = new Teclado("keydown", { bubbles: true }) as KeyboardEvent;
    Object.assign(enter, { key: "Enter", isComposing: false });
    nome5.dispatchEvent(enter);
    await ate(() => !dialogo(m.doc));
    checar(
      "Enter grava o modelo",
      (await m.modelos.listar()).some((x) => x.nome === "Pregões 2026"),
    );
    checar("Enter: modelo escolhido", textoCombo(m.raiz, ROTULO_MODELO).includes("Pregões 2026"));

    // Apagar: confirmação sem Cancelar; fechar (X/Esc) não apaga.
    m.clicar("Apagar");
    await ate(() => !!dialogo(m.doc));
    const dc = dialogo(m.doc)!;
    checar("apagar pede confirmação com o nome", (dc.textContent ?? "").includes("Pregões 2026"));
    checar("confirmação: um só botão, sem Cancelar", dc.querySelectorAll("button").length === 1 && !botao(dc, "Cancelar"));
    m.fecharDialogo();
    await tique(5);
    checar("confirmação fechada: nada apagado", (await m.modelos.listar()).length === 2);
    checar("confirmação fechada: escolha mantida", textoCombo(m.raiz, ROTULO_MODELO).includes("Pregões 2026"));

    // Falha ao apagar: a escolha fica e o erro aparece.
    const apagarOriginal = m.modelos.apagar.bind(m.modelos);
    m.modelos.apagar = async () => {
      throw new Error("cota");
    };
    m.clicar("Apagar");
    await ate(() => !!dialogo(m.doc));
    disparar(botao(dialogo(m.doc)!, "Apagar")!, "click");
    await ate(() => m.textoVisivel("Não foi possível apagar o modelo"));
    checar("falha ao apagar: erro no formulário", m.textoVisivel("Não foi possível apagar o modelo: cota"));
    checar("falha ao apagar: escolha mantida", textoCombo(m.raiz, ROTULO_MODELO).includes("Pregões 2026") && m.visivel("Apagar"));
    m.modelos.apagar = apagarOriginal;

    m.clicar("Apagar");
    await ate(() => !!dialogo(m.doc));
    disparar(botao(dialogo(m.doc)!, "Apagar")!, "click");
    await ate(() => opcoesCombo(m.raiz, ROTULO_MODELO).length === 1);
    checar("apagado some do combo", opcoesCombo(m.raiz, ROTULO_MODELO).join() === "Contratos restritos");
    checar("apagado: volta a sem modelo", textoCombo(m.raiz, ROTULO_MODELO).includes("sem modelo"));
    checar("apagado: Renomear e Apagar escondidos", !m.visivel("Renomear") && !m.visivel("Apagar"));
    checar(
      "apagar não mexe no formulário",
      textoCombo(m.raiz, "Tipo de processo").includes("Contrato: Gestão") && m.campo("pl-pausa").value === "700",
    );
    m.app.destruir();
  }

  secao("Task 21: o modelo aplicado leva as ações ao Depois de criar e guarda as do painel");
  {
    const area = areaMemoria();
    const repoM = new RepositorioModelos(area, ESCOPO);
    const P = { idTipo: "10", nomeTipo: "Contrato: Gestão", nivelAcesso: "0" as const, hipoteseLegal: "", nomeHipotese: "", pausa: 500 };
    const mod = await repoM.salvar("Contratos", P, { marcador: { id: "m1", nome: "Urgente", texto: "t" } });
    const m = montar({ area });
    await m.app.iniciar();
    await ate(() => opcoesCombo(m.raiz, ROTULO_MODELO).length > 0);
    escolherCombo(m.raiz, ROTULO_MODELO, mod.id);
    await ate(() => !botao(m.raiz, "Ver prévia")?.disabled);
    m.digitar("Alfa");
    m.clicar("Ver prévia");
    m.clicar("Iniciar");
    await ate(() => !!m.raiz.querySelector(".pl-resultado"));
    await ate(() => m.chamadas.some((c) => c.op === "posAcaoOpcoes"));
    await tique(10);
    checar(
      "painel aberto com o marcador do modelo ligado",
      m.raiz.querySelector<HTMLInputElement>('input[data-acao="marcador"]')?.checked === true,
    );
    checar("marcador do modelo escolhido", textoCombo(m.raiz, "Marcador").includes("Urgente"));
    checar("nada aplicado sozinho", !m.chamadas.some((c) => c.op === "posAcao" || c.op === "posAcaoBloco"));
    escolherCombo(m.raiz, "Bloco interno", "b7");
    m.clicar("Guardar estas ações no modelo");
    await ate(() => m.textoVisivel("Ações guardadas no modelo"));
    const salvo = (await repoM.listar()).find((x) => x.id === mod.id);
    igual("modelo aplicado recebeu as ações do painel", salvo?.posAcoes, {
      marcador: { id: "m1", nome: "Urgente", texto: "t" },
      bloco: { id: "b7", descricao: "Contratos de 2026" },
    });
    igual("parâmetros do modelo intactos", salvo?.parametros, P);
    m.app.destruir();

    // Salvar como modelo com o mesmo nome (parametros novos) mantém as ações guardadas.
    const n = montar({ area });
    await n.app.iniciar();
    await ate(() => opcoesCombo(n.raiz, ROTULO_MODELO).length > 0);
    escolherCombo(n.raiz, ROTULO_MODELO, mod.id);
    await ate(() => !botao(n.raiz, "Ver prévia")?.disabled);
    n.preencher("pl-pausa", "800");
    n.clicar("Salvar como modelo…");
    const d = dialogo(n.doc)!;
    disparar(botao(d, "Salvar modelo")!, "click");
    await ate(() => !dialogo(n.doc));
    const resalvo = (await repoM.listar()).find((x) => x.id === mod.id);
    checar("salvar de novo: pausa nova", resalvo?.parametros.pausa === 800, resalvo);
    checar("salvar de novo: ações mantidas", JSON.stringify(resalvo?.posAcoes) === JSON.stringify(salvo?.posAcoes), resalvo);
    n.app.destruir();
  }
  {
    const m = montar();
    await m.app.iniciar();
    await m.configurar("Alfa");
    m.clicar("Ver prévia");
    m.clicar("Iniciar");
    await ate(() => !!m.raiz.querySelector(".pl-resultado"));
    await tique(10);
    checar(
      "sem modelo: painel recolhido, nada pedido",
      !!m.raiz.querySelector(".pl-pos-corpo[hidden]") && !m.chamadas.some((c) => c.op === "posAcaoOpcoes"),
    );
    checar("sem modelo: sem o botão de guardar", !botao(m.raiz, "Guardar estas ações no modelo"));
    m.app.destruir();
  }

  secao("Revisão final: nível não reconhecido na planilha trava o Iniciar");
  {
    const m = montar();
    await m.app.iniciar();
    await m.configurar("Alfa\t\t\tSigiloso\nBeta\t\t\tPública\nGama");
    m.clicar("Ver prévia");
    await ate(() => !!m.raiz.querySelector(".pl-previa"));
    checar("Iniciar desabilitado com nível não reconhecido", botao(m.raiz, "Iniciar")?.disabled === true);
    checar("erro por linha visível", m.textoVisivel("nível não reconhecido: use Público ou Restrito (ou 0/1)"));
    const celulas = [...m.raiz.querySelectorAll(".pl-previa .pl-tabela tbody tr")].map((tr) =>
      [...tr.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim()),
    );
    checar("célula do nível mostra o valor recusado", celulas[0]?.includes("Sigiloso") === true, celulas);
    checar("nível reconhecido aparece (não em branco)", celulas[1]?.includes("Público") === true, celulas);
    checar("linha sem nível mostra o nível do lote", celulas[2]?.includes("Público (do lote)") === true, celulas);
    m.clicar("Iniciar");
    await tique(10);
    checar("clicar em Iniciar travado não cria nada", !m.chamadas.some((c) => c.op === "criar"));
    m.clicar("Remover linhas com erro (1)");
    checar("removida a linha com erro: Iniciar liberado", botao(m.raiz, "Iniciar")?.disabled === false);
    checar("sobram 2 linhas", m.raiz.querySelectorAll(".pl-previa .pl-tabela tbody tr").length === 2);
    m.clicar("Iniciar");
    await ate(() => !!m.raiz.querySelector(".pl-resultado"));
    checar("só as linhas válidas foram criadas", m.quantas("Alfa") === 0 && m.quantas("Beta") === 1 && m.quantas("Gama") === 1);
    m.app.destruir();
  }

  secao("Revisão final: interessado avisado na prévia e sem segurar o registro");
  {
    const m = montar({
      roteiro: (esp) => ({ ...criado(esp, ++numeroSeq), aviso: "interessado ignorado" }),
    });
    await m.app.iniciar();
    await m.configurar("Alfa\tFulano");
    checar(
      "ajuda da caixa diz que o interessado ainda não é aplicado",
      (m.caixa().getAttribute("placeholder") ?? "").includes("a coluna interessado é lida, mas ainda não é aplicada"),
    );
    m.clicar("Ver prévia");
    await ate(() => !!m.raiz.querySelector(".pl-previa"));
    checar("prévia avisa que o interessado não é aplicado", m.textoVisivel("interessado: não é aplicado nesta versão"));
    checar("aviso de interessado não trava o Iniciar", botao(m.raiz, "Iniciar")?.disabled === false);
    m.clicar("Iniciar");
    await ate(() => !!m.raiz.querySelector(".pl-resultado"));
    await tique(10);
    checar("só 'interessado ignorado': registro descartado no fim", (await m.lote()) === undefined);
    checar("sem 'Descartar e começar outro'", !m.visivel("Descartar e começar outro"));
    m.app.destruir();

    const gravarCom = async (area: Area, aviso: string, incerto?: boolean) =>
      new RepositorioLote(area, ESCOPO, () => 1).gravar({
        id: "w",
        host: "sei.x.gov.br",
        login: "ana",
        iniciadoEm: 1,
        parametros: { idTipo: "10", nomeTipo: "Contrato", nivelAcesso: "0", hipoteseLegal: "", nomeHipotese: "", pausa: 500 },
        linhas: [{ especificacao: "A", interessado: "Fulano" }],
        itens: [
          {
            situacao: "ok",
            criado: { numero: "00001.000001/2026-11", idProcedimento: "1", url: "u" },
            aviso,
            ...(incerto ? { incerto } : {}),
          },
        ],
      });
    const a1 = areaMemoria();
    await gravarCom(a1, "interessado ignorado");
    const r1 = montar({ area: a1 });
    await r1.app.iniciar();
    await ate(() => !!combo(r1.raiz, "Tipo de processo"));
    checar("reabrir com só 'interessado ignorado': vai à configuração e descarta", (await r1.lote()) === undefined);
    r1.app.destruir();

    const a2 = areaMemoria();
    await gravarCom(a2, "interessado ignorado; numero nao identificado");
    const r2 = montar({ area: a2 });
    await r2.app.iniciar();
    await ate(() => !!r2.raiz.querySelector(".pl-resultado"));
    checar("reabrir com número não identificado: resultado e registro mantidos", (await r2.lote()) !== undefined);
    r2.app.destruir();
  }
}

export async function verificarConfirmarSemCancelar(): Promise<void> {
  secao("Modelos: confirmação sem Cancelar");
  const doc = instalarDom();
  let aberto: { conteudo: HTMLElement; fechar(): void } | null = null;
  const abrir: Parameters<typeof criarConfirmarSemCancelar>[0] = ({ conteudo, aoFechar }) => {
    doc.body.append(conteudo);
    const fechar = () => {
      if (!conteudo.isConnected) return;
      conteudo.remove();
      aoFechar?.();
    };
    aberto = { conteudo, fechar };
    return { fechar };
  };
  const confirmar = criarConfirmarSemCancelar(abrir);
  const sim = confirmar("Apagar o modelo X?", "Apagar");
  const corpo = (aberto as { conteudo: HTMLElement } | null)?.conteudo;
  checar("um só botão", corpo?.querySelectorAll("button").length === 1);
  checar("sem Cancelar", !!corpo && !botao(corpo, "Cancelar"));
  checar("o botão é o rótulo pedido", !!corpo && !!botao(corpo, "Apagar"));
  checar("mostra o texto", (corpo?.textContent ?? "").includes("Apagar o modelo X?"));
  disparar(botao(corpo!, "Apagar")!, "click");
  checar("clique resolve true", (await sim) === true);
  checar("clique fecha o diálogo", !corpo?.isConnected);
  const nao = confirmar("De novo?", "Apagar");
  (aberto as { fechar(): void } | null)?.fechar();
  checar("fechar (X/Esc) resolve false", (await nao) === false);
}

const ROTULO_MODELO = "Modelo do lote";
const ERRO_TIPO_MODELO = "O tipo deste modelo não existe mais nesta unidade.";
const ERRO_HIPOTESE_MODELO = "A hipótese legal deste modelo não existe mais nesta unidade.";

function textoCombo(raiz: ParentNode, rotulo: string): string {
  return combo(raiz, rotulo)?.textContent ?? "";
}

/** Os rotulos das opcoes do seletor (abre, le e fecha). */
function opcoesCombo(raiz: ParentNode, rotulo: string): string[] {
  const b = combo(raiz, rotulo);
  if (!b) return [];
  b.click();
  const ops = [...b.ownerDocument.querySelectorAll(".spro-combo-pop [role='option']")].map((o) => (o.textContent ?? "").trim());
  if (b.getAttribute("aria-expanded") === "true") b.click();
  return ops;
}

/** O dialogo do app aberto agora (o `abrirModal` das provas poe no body). */
function dialogo(doc: Document): HTMLElement | null {
  return doc.querySelector<HTMLElement>(".dlg-teste");
}
