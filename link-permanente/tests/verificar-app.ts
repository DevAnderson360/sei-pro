/**
 * Provas do app do Link Permanente (a janela dentro do iframe), com DOM do
 * linkedom e RPC falso: o que a aba responde a cada `localizar` é decidido
 * aqui, com atraso por referência para as respostas chegarem fora de ordem.
 */

import { AppLinkPermanente, type DepsApp } from "@lp/app/app";
import type { ResultadoLocalizar } from "@lp/pagina/executor";
import { botao, checar, disparar, instalarDom, secao, tique } from "./util";

const BASE = "https://sei.x.gov.br/sei/controlador.php?acao=procedimento_trabalhar";
const link = (p: string, d?: string) => `${BASE}&id_procedimento=${p}${d ? `&id_documento=${d}` : ""}`;

/** Resposta da aba para uma referência; `vezes` = quantas chamadas já houve para ela (1, 2...). */
type Roteiro = (ref: string, vezes: number) => ResultadoLocalizar | Error;

interface OpcoesMontar {
  roteiro?: Roteiro;
  /** Atraso (ms) de cada referência; o padrão é 0. */
  atrasos?: Record<string, number>;
  selecionados?: string[] | Error;
  pendente?: string | null;
  /** Área de transferência com `write` (cópia rica) ou só `writeText`. */
  rica?: boolean;
}

/** Tecla do linkedom (o KeyboardEvent do Node não serve aos elementos dele). */
function tecla(el: Element, key: string, ctrl = false): void {
  const Ev = (el.ownerDocument.defaultView as unknown as { Event: typeof Event }).Event;
  const ev = new Ev("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "key", { value: key });
  Object.defineProperty(ev, "ctrlKey", { value: ctrl });
  el.dispatchEvent(ev);
}

function montar(o: OpcoesMontar = {}) {
  const doc = instalarDom('<html><body><div id="app"></div></body></html>');
  const raiz = doc.getElementById("app")!;
  const chamadas: Array<[string, unknown]> = [];
  const porRef = new Map<string, number>();
  let emVoo = 0;
  const t = { maxEmVoo: 0, fechou: 0, pausas: [] as number[], avisos: [] as string[] };
  const baixados: Array<{ nome: string; conteudo: string; tipo: string }> = [];
  const copiados: { html?: string; texto?: string }[] = [];
  const roteiro: Roteiro = o.roteiro ?? (() => ({ situacao: "nao-encontrado" }));

  class ItemFalso {
    constructor(readonly partes: Record<string, Blob>) {}
  }
  const clip: DepsApp["clip"] = {
    writeText: async (texto) => void copiados.push({ texto }),
  };
  if (o.rica)
    clip.write = async (itens) => {
      const partes = (itens[0] as unknown as ItemFalso).partes;
      copiados.push({ html: await partes["text/html"]!.text(), texto: await partes["text/plain"]!.text() });
    };

  const deps: DepsApp = {
    rpc: {
      chamar: (async (op: string, args?: unknown) => {
        chamadas.push([op, args]);
        if (op === "selecionados") {
          if (o.selecionados instanceof Error) throw o.selecionados;
          return o.selecionados ?? [];
        }
        if (op !== "localizar") return true;
        const ref = (args as { ref: string }).ref;
        const vezes = (porRef.get(ref) ?? 0) + 1;
        porRef.set(ref, vezes);
        emVoo += 1;
        t.maxEmVoo = Math.max(t.maxEmVoo, emVoo);
        try {
          await tique(o.atrasos?.[ref] ?? 0);
          const r = roteiro(ref, vezes);
          if (r instanceof Error) throw r;
          return r;
        } finally {
          emVoo -= 1;
        }
      }) as DepsApp["rpc"]["chamar"],
    },
    ctx: { host: "sei.x.gov.br", login: "ana", temaEscuro: false },
    abrirModal: () => ({ fechar: () => {} }),
    baixar: (nome, conteudo, tipo) => void baixados.push({ nome, conteudo, tipo }),
    clip,
    ItemClip: o.rica ? (ItemFalso as unknown as typeof ClipboardItem) : undefined,
    fechar: () => {
      t.fechou += 1;
    },
    lerEntradaPendente: async () => o.pendente ?? null,
    // A pausa entre saídas é registrada, não dormida: as provas não esperam 150 ms por item.
    esperar: async (ms) => {
      t.pausas.push(ms);
    },
    avisar: (texto) => void t.avisos.push(texto),
  };
  const app = new AppLinkPermanente(raiz, deps);
  const caixa = () => raiz.querySelector("textarea")!;
  const digitar = (texto: string) => {
    caixa().value = texto;
    disparar(caixa(), "input");
  };
  const quantas = (ref: string) => chamadas.filter(([op, a]) => op === "localizar" && (a as { ref: string }).ref === ref).length;
  const linhas = () =>
    [...raiz.querySelectorAll("table tbody tr")].map((tr) => [...tr.querySelectorAll("td")].map((td) => (td.textContent ?? "").trim()));
  const cabecalho = () => [...raiz.querySelectorAll("table thead th")].map((th) => (th.textContent ?? "").trim());
  const visivel = (texto: string) => {
    const b = botao(raiz, texto);
    return !!b && !b.hidden && !b.closest("[hidden]");
  };
  /** Texto que está na tela: o de elementos ocultos não conta (o aviso da sessão fica montado, só escondido). */
  const textoVisivel = (texto: string) =>
    [...raiz.querySelectorAll("p, span, div")].some((el) => !el.closest("[hidden]") && (el.textContent ?? "").includes(texto));
  return { doc, raiz, app, deps, chamadas, t, baixados, copiados, caixa, digitar, quantas, linhas, cabecalho, visivel, textoVisivel };
}

/** Espera o lote terminar (as respostas falsas usam setTimeout curtos). */
async function ate(cond: () => boolean, limite = 100): Promise<void> {
  for (let i = 0; i < limite && !cond(); i += 1) await tique(5);
}

export async function verificarApp(): Promise<void> {
  secao("App: reconhecidos e botão Pesquisar");
  {
    const m = montar();
    await m.app.iniciar();
    const pesquisar = botao(m.raiz, "Pesquisar")!;
    checar("caixa vazia: Pesquisar desligado", !!pesquisar && pesquisar.disabled);
    m.digitar("Veja o processo 50300.018905/2018-67 e o SEI 12345678.\n00001.000002/2026-22\nContrato-77\n12345678");
    const painel = m.raiz.querySelector(".lp-reconhecidos")!;
    const texto = (painel?.textContent ?? "").replace(/\s+/g, " ");
    checar("painel Reconhecidos com título", /Reconhecidos/.test(texto), texto);
    checar("conta 2 processos", /2 processos/.test(texto), texto);
    checar("conta 1 nº SEI (repetição some)", /1 nº SEI/.test(texto), texto);
    checar("conta 1 outro, que será pesquisado como está", /1 outro/.test(texto) && /será pesquisado como está/.test(texto), texto);
    checar("com reconhecidos: Pesquisar ligado", !pesquisar.disabled);
    m.digitar("Ligue 61 99999-1234 amanhã de manhã");
    const t2 = (m.raiz.querySelector(".lp-reconhecidos")?.textContent ?? "").replace(/\s+/g, " ");
    checar("nada reconhecido: avisa", /Nenhum/.test(t2), t2);
    checar("nada reconhecido: Pesquisar desligado", pesquisar.disabled);
    disparar(pesquisar, "click");
    await tique();
    checar("Pesquisar desligado não chama a aba", m.quantas("61") === 0 && m.chamadas.every(([op]) => op !== "localizar"));
    m.app.destruir();
  }

  secao("App: pré-preenchimento");
  {
    const m = montar({ selecionados: ["00001.000001/2026-11", "00001.000002/2026-22"] });
    await m.app.iniciar();
    checar(
      "pede os selecionados à aba",
      m.chamadas.some(([op]) => op === "selecionados"),
    );
    checar("caixa com os selecionados, um por linha", m.caixa().value === "00001.000001/2026-11\n00001.000002/2026-22", m.caixa().value);
    checar("reconhecidos já contados", /2 processos/.test(m.raiz.querySelector(".lp-reconhecidos")?.textContent ?? ""));
    checar("Pesquisar ligado", !botao(m.raiz, "Pesquisar")!.disabled);
    m.app.destruir();

    const p = montar({ selecionados: ["00001.000001/2026-11"], pendente: "12345678\n87654321" });
    await p.app.iniciar();
    checar("entrada pendente vence os selecionados", p.caixa().value === "12345678\n87654321", p.caixa().value);
    checar(
      "entrada pendente alimenta o painel Reconhecidos",
      /2 n.{1,3} SEI/.test(p.raiz.querySelector(".lp-reconhecidos")?.textContent ?? ""),
    );
    p.app.destruir();

    const e = montar({ pendente: "123\n456" });
    await e.app.iniciar();
    const painelE = (e.raiz.querySelector(".lp-reconhecidos")?.textContent ?? "").replace(/\s+/g, " ");
    checar("entrada 123/456 pré-preenche a caixa", e.caixa().value === "123\n456", e.caixa().value);
    checar("entrada 123/456 aparece em Reconhecidos", /Reconhecidos/.test(painelE) && !/Nenhum/.test(painelE), painelE);
    e.app.destruir();

    const f = montar({ selecionados: new Error("sem tela de controle") });
    await f.app.iniciar();
    checar("falha nos selecionados: caixa vazia, sem quebrar", f.caixa().value === "" && !!botao(f.raiz, "Pesquisar"));
    f.app.destruir();
  }

  secao("App: ponta a ponta (3 ok, 1 não encontrada, 1 erro)");
  {
    const P1 = "00001.000001/2026-11";
    const P2 = "00001.000002/2026-22";
    const S1 = "12345678";
    const NE = "99999.999999/2026-99";
    const ER = "87654321";
    const roteiro: Roteiro = (ref, vezes) => {
      if (ref === P1) return { situacao: "ok", idProcedimento: "10", link: link("10") };
      if (ref === P2) return { situacao: "ok", idProcedimento: "20", link: link("20") };
      if (ref === S1) return { situacao: "ok", idProcedimento: "30", idDocumento: "31", link: link("30", "31") };
      if (ref === NE) return { situacao: "nao-encontrado", erro: "Não encontrado" };
      // A que deu erro funciona na segunda vez.
      if (ref === ER) return vezes === 1 ? new Error("Tempo esgotado") : { situacao: "ok", idProcedimento: "50", link: link("50") };
      return new Error("inesperado");
    };
    // P1 demora mais que as outras: chega por último, mas a linha fica em primeiro.
    const m = montar({ roteiro, atrasos: { [P1]: 40 }, rica: true });
    await m.app.iniciar();
    m.digitar([P1, P2, S1, NE, ER].join("\n"));
    disparar(botao(m.raiz, "Pesquisar")!, "click");
    await tique(15);
    const parciais = m.linhas();
    checar("linhas aparecem enquanto o lote roda", parciais.length >= 3 && parciais.some((l) => l.includes("Encontrado")), parciais);
    checar(
      "a lenta fica no seu lugar (primeira linha), ainda pendente",
      parciais[0]?.includes(P1) === true && parciais[0]?.includes("Pendente") === true,
      parciais,
    );
    await ate(() => m.linhas().every((l) => !l.includes("Pendente")) && m.linhas().length === 5);
    checar("no máximo 3 pesquisas ao mesmo tempo", m.t.maxEmVoo <= 3 && m.t.maxEmVoo >= 2, m.t.maxEmVoo);
    checar("pausa de 150 ms entre saídas", m.t.pausas.length > 0 && m.t.pausas.every((p) => p === 150), m.t.pausas);
    checar(
      "cada item pediu localizar uma vez",
      [P1, P2, S1, NE, ER].every((r) => m.quantas(r) === 1),
    );
    const cab = m.cabecalho();
    checar(
      "colunas: Situação, Protocolo, Tipo, Link Permanente",
      ["Situação", "Protocolo", "Tipo", "Link Permanente"].every((c) => cab.includes(c)) && cab.length === 4,
      cab,
    );
    const L = m.linhas();
    const col = (n: string) => cab.indexOf(n);
    checar(
      "ordem de entrada",
      L.map((l) => l[col("Protocolo")]).join() === [P1, P2, S1, NE, ER].join(),
      L.map((l) => l[col("Protocolo")]),
    );
    checar(
      "situações por linha",
      L.map((l) => l[col("Situação")]).join() === "Encontrado,Encontrado,Encontrado,Não encontrado,Erro",
      L.map((l) => l[col("Situação")]),
    );
    checar(
      "tipo Processo / Documento (com idDocumento)",
      L[0]?.[col("Tipo")] === "Processo" && L[2]?.[col("Tipo")] === "Documento",
      L.map((l) => l[col("Tipo")]),
    );
    const anchors = [...m.raiz.querySelectorAll("table tbody a")].map((a) => a.getAttribute("href"));
    checar("3 links clicáveis, o do documento com id_documento", anchors.length === 3 && anchors[2] === link("30", "31"), anchors);
    checar("link como texto da coluna", L[0]?.[col("Link Permanente")] === link("10"));
    checar("Tentar de novo visível (há falha)", m.visivel("Tentar de novo só as que falharam"));

    disparar(botao(m.raiz, "Baixar CSV")!, "click");
    const csv = m.baixados[0];
    const linhasCsv = (csv?.conteudo ?? "").replace(/^﻿/, "").split("\r\n");
    checar("CSV com o nome links-permanentes.csv", csv?.nome === "links-permanentes.csv", csv?.nome);
    checar("CSV com cabeçalho + 5 linhas", linhasCsv.length === 6, linhasCsv);
    checar("CSV: cabeçalho", linhasCsv[0] === "Situação;Protocolo;Tipo;Link Permanente", linhasCsv[0]);
    checar("CSV: linha do documento", linhasCsv[3] === `Encontrado;${S1};Documento;${link("30", "31")}`, linhasCsv[3]);

    disparar(botao(m.raiz, "Copiar com links")!, "click");
    await tique();
    checar("copia rica com links", (m.copiados[0]?.html ?? "").includes(`<a href="${link("10").replace(/&/g, "&amp;")}">`), m.copiados[0]);
    checar("aviso: Copiado com links clicáveis", m.t.avisos.includes("Copiado com links clicáveis"), m.t.avisos);

    disparar(botao(m.raiz, "Tentar de novo só as que falharam")!, "click");
    await ate(() => m.linhas()[4]?.includes("Encontrado") === true);
    checar("repetiu só a que deu erro", m.quantas(ER) === 2 && [P1, P2, S1, NE].every((r) => m.quantas(r) === 1));
    checar("não encontrada não é repetida", m.quantas(NE) === 1);
    checar("a repetida virou Encontrado", m.linhas()[4]?.[col("Situação")] === "Encontrado", m.linhas()[4]);
    checar("sem falhas: Tentar de novo oculto", !m.visivel("Tentar de novo só as que falharam"));
    m.app.destruir();
  }

  secao("App: sem repetição automática; sem acesso fica de fora");
  {
    const roteiro: Roteiro = (ref) =>
      ref === "11111111"
        ? { situacao: "sem-acesso", erro: "Sigiloso" }
        : ref === "22222222"
          ? new Error("falhou")
          : { situacao: "ok", idProcedimento: "1", link: link("1") };
    const m = montar({ roteiro });
    await m.app.iniciar();
    checar("sem resultado: Tentar de novo oculto", !m.visivel("Tentar de novo só as que falharam"));
    m.digitar("11111111\n22222222");
    disparar(botao(m.raiz, "Pesquisar")!, "click");
    await ate(() => m.linhas().length === 2 && m.linhas().every((l) => !l.includes("Pendente")));
    await tique(20);
    checar("erro não se repete sozinho", m.quantas("22222222") === 1);
    checar(
      "situações Sem acesso e Erro",
      m.linhas()[0]?.includes("Sem acesso") === true && m.linhas()[1]?.includes("Erro") === true,
      m.linhas(),
    );
    disparar(botao(m.raiz, "Tentar de novo só as que falharam")!, "click");
    await ate(() => m.quantas("22222222") === 2);
    await tique(10);
    checar("tentar de novo: só o erro, nunca o sem acesso", m.quantas("22222222") === 2 && m.quantas("11111111") === 1);
    m.app.destruir();
  }

  secao("App: sessão expirada pausa o lote");
  {
    const roteiro: Roteiro = (ref, vezes) =>
      ref === "22222222" && vezes === 1
        ? { situacao: "erro", erro: "Sessão expirada", parar: true }
        : { situacao: "ok", idProcedimento: ref, link: link(ref) };
    // A 1ª demora: quando a 2ª pede para parar, a 4ª e a 5ª ainda não saíram.
    const m = montar({ roteiro, atrasos: { "11111111": 30, "33333333": 30 } });
    await m.app.iniciar();
    m.digitar("11111111\n22222222\n33333333\n44444444\n55555555");
    disparar(botao(m.raiz, "Pesquisar")!, "click");
    checar("antes da pesquisa, sem aviso de sessão", !m.textoVisivel("A sessão do SEI expirou"));
    await ate(() => m.textoVisivel("A sessão do SEI expirou"));
    await tique(50);
    checar("mensagem da sessão expirada", m.textoVisivel("A sessão do SEI expirou. Entre de novo e tente outra vez."));
    checar("as que ainda não tinham saído não foram pesquisadas", m.quantas("44444444") === 0 && m.quantas("55555555") === 0, m.chamadas);
    checar("as que já estavam em voo terminam", m.quantas("11111111") === 1 && m.quantas("33333333") === 1);
    checar("Tentar de novo visível", m.visivel("Tentar de novo só as que falharam"));
    disparar(botao(m.raiz, "Tentar de novo só as que falharam")!, "click");
    await ate(() => m.linhas().length === 5 && m.linhas().every((l) => l.includes("Encontrado")));
    checar(
      "retoma: a que caiu e as que faltavam",
      m.quantas("22222222") === 2 && m.quantas("44444444") === 1 && m.quantas("55555555") === 1,
    );
    checar("retoma: as que já tinham dado certo não repetem", m.quantas("11111111") === 1 && m.quantas("33333333") === 1);
    checar("mensagem da sessão some ao retomar", !m.textoVisivel("A sessão do SEI expirou"));
    m.app.destruir();
  }

  secao("App: copiar como texto, limpar, teclado");
  {
    const m = montar({ roteiro: () => ({ situacao: "ok", idProcedimento: "1", link: link("1") }) });
    await m.app.iniciar();
    m.digitar("12345678");
    tecla(m.caixa(), "Enter", true);
    await ate(() => m.linhas().length === 1 && m.linhas()[0]!.includes("Encontrado"));
    checar("Ctrl+Enter pesquisa", m.quantas("12345678") === 1);
    tecla(m.caixa(), "Enter", false);
    await tique();
    checar("Enter sozinho não pesquisa", m.quantas("12345678") === 1);
    disparar(botao(m.raiz, "Copiar com links")!, "click");
    await tique();
    checar(
      "sem cópia rica: copia texto (TSV)",
      (m.copiados[0]?.texto ?? "").startsWith("Situação\tProtocolo\tTipo\tLink Permanente"),
      m.copiados[0],
    );
    checar("aviso: Copiado como texto", m.t.avisos.includes("Copiado como texto"), m.t.avisos);
    disparar(botao(m.raiz, "Limpar")!, "click");
    checar("Limpar esvazia caixa e tabela", m.caixa().value === "" && m.linhas().length === 0);
    checar("Limpar desliga Pesquisar", botao(m.raiz, "Pesquisar")!.disabled);
    checar("sem resultado: Copiar e CSV ocultos", !m.visivel("Copiar com links") && !m.visivel("Baixar CSV"));
    checar("sem botão Cancelar", !botao(m.raiz, "Cancelar"));
    disparar(botao(m.raiz, "Fechar")!, "click");
    checar("X fecha", m.t.fechou === 1);
    tecla(m.caixa(), "Escape");
    checar("Esc fecha", m.t.fechou === 2);
    m.app.destruir();
    tecla(m.doc.body, "Escape");
    checar("depois de destruir, o teclado não age", m.t.fechou === 2);
  }
}
