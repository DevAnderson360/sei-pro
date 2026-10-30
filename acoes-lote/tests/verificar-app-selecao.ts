/**
 * Provas da tela de selecao das Acoes em Lote: DOM do linkedom, sem RPC (montarSelecao) e com RPC falso (o app).
 */

import { readFileSync } from "node:fs";
import type { Rpc } from "@comum/ponte/rpc";
import { AppAcoesLote, type ContextoApp, type EstadoApp } from "../src/app/app";
import { montarSelecao } from "../src/app/selecao";
import type { AcaoId } from "../src/modelo/acoes";
import type { LinhaDoc } from "../src/modelo/documentos";
import { botao, checar, combo, disparar, escolherCombo, igual, instalarDom, secao, tique } from "./util";

const CTX: ContextoApp = {
  host: "sei.x.gov.br",
  login: "ana",
  nomeUsuario: "Ana Silva",
  unidadeSigla: "ANA/SUP",
  temaEscuro: false,
  idProcedimento: "99",
  origem: "https://sei.x.gov.br/sei/controlador.php",
};

function linha(n: number, o: Partial<LinhaDoc> = {}): LinhaDoc {
  return {
    id: String(1000 + n),
    numero: String(5000 + n),
    titulo: `Despacho ${n}`,
    tipo: "Despacho",
    externo: false,
    formato: "html",
    nivel: "publico",
    assinado: false,
    assinaturas: [],
    cancelado: false,
    unidade: "ANA/SUP",
    pasta: null,
    data: `2026-09-0${n}`,
    ...o,
  };
}

/** Seis documentos: 1-3 Despacho, 4 Oficio assinado por Ana, 5 externo, 6 Oficio de outra unidade. */
function linhas(): LinhaDoc[] {
  return [
    linha(1),
    linha(2),
    linha(3),
    linha(4, { titulo: "Oficio 4", tipo: "Oficio", assinado: true, assinaturas: ["Ana Silva - Analista"], unidade: "OUT/X" }),
    linha(5, { titulo: "Anexo 5", tipo: "Anexo", externo: true, formato: "pdf", pasta: "Pasta A" }),
    linha(6, { titulo: "Oficio 6", tipo: "Oficio", unidade: "OUT/X", nivel: "restrito" }),
  ];
}

function estado(o: Partial<EstadoApp> = {}): EstadoApp {
  return {
    ctx: CTX,
    protocolo: "00001.000001/2026-11",
    sigiloso: false,
    linhas: linhas(),
    selecionados: new Set<string>(),
    filtro: {},
    etapas: [],
    planos: [],
    ...o,
  };
}

function montar(e: EstadoApp) {
  const doc = instalarDom('<html><body><div id="r"></div></body></html>');
  const chamadas = { mudou: 0, configurou: [] as Array<AcaoId | undefined> };
  const el = montarSelecao(doc, e, {
    aoMudar: () => {
      chamadas.mudou += 1;
    },
    configurar: (a) => {
      chamadas.configurou.push(a);
    },
  });
  doc.getElementById("r")!.append(el);
  return { doc, el, chamadas };
}

const caixas = (el: ParentNode) => [...el.querySelectorAll<HTMLInputElement>('tbody input[type="checkbox"]')];
const idsVisiveis = (el: ParentNode) => [...el.querySelectorAll<HTMLElement>("tbody tr")].map((tr) => tr.getAttribute("data-id"));

function clicar(c: HTMLElement, shift = false): void {
  const Ev = (c.ownerDocument.defaultView as unknown as { Event: typeof Event }).Event;
  const ev = new Ev("click", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "shiftKey", { value: shift });
  c.dispatchEvent(ev);
}

export async function verificarAppSelecao(): Promise<void> {
  secao("selecao: layout dos filtros (linha de datas nunca sob os Atalhos)");
  {
    // linkedom nao faz layout: a medida no Chrome esta no relatorio t13-sp-fix-report.md. Aqui, a regra que a garante.
    const css = readFileSync(new URL("../estatico/acoes-lote.css", import.meta.url), "utf8");
    const regra = (sel: string) => new RegExp(`${sel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\{([^}]*)\\}`).exec(css)?.[1] ?? "";
    checar(
      "busca solta nos filtros com altura propria (o height:100% do sei-comum esticava a linha)",
      /height:\s*32px/.test(regra(".al-filtros > .spro-lista-busca")),
      regra(".al-filtros > .spro-lista-busca"),
    );
    checar(
      "itens da selecao sem esticar (altura definida faz % crescer)",
      /align-items:\s*start/.test(regra(".al-selecao")),
      regra(".al-selecao"),
    );
  }

  secao("selecao: tabela e colunas");
  {
    const { el } = montar(estado());
    const cab = [...el.querySelectorAll("thead th")].map((t) => (t.textContent ?? "").trim());
    igual("colunas", cab, ["", "Nº SEI", "Documento", "Tipo", "Unidade", "Data", "Assinatura", "Nível", "Pasta", ""]);
    igual("uma linha por documento", idsVisiveis(el).length, 6);
    const l5 = [...el.querySelectorAll("tbody tr")][4]!;
    checar("pasta e nome do externo na linha", (l5.textContent ?? "").includes("Pasta A") && (l5.textContent ?? "").includes("Anexo 5"));
    checar("data em dd/mm/aaaa", (el.querySelector("tbody tr")!.textContent ?? "").includes("01/09/2026"));
  }

  secao("selecao: Selecionar todos so marca as visiveis");
  {
    const e = estado({ selecionados: new Set(["1006"]) });
    const { el, chamadas } = montar(e);
    escolherCombo(el, "Tipo", "Despacho");
    igual("filtro por tipo deixa 3", idsVisiveis(el), ["1001", "1002", "1003"]);
    const todos = el.querySelector<HTMLElement>('[aria-label="Selecionar todos"]')!;
    clicar(todos);
    igual("filtrar poda a 1006 e marcar todos marca as 3 visiveis", [...e.selecionados].sort(), ["1001", "1002", "1003"]);
    checar("avisou a mudanca", chamadas.mudou > 0);
    checar("caixa de cima fica marcada", el.querySelector('[aria-label="Selecionar todos"]')!.getAttribute("aria-checked") === "true");
    clicar(el.querySelector<HTMLElement>('[aria-label="Selecionar todos"]')!);
    igual("segundo clique desmarca as visiveis", [...e.selecionados], []);
    igual("o filtro fica no estado", e.filtro.tipos, ["Despacho"]);
  }

  secao("selecao: o filtro poda a selecao");
  {
    const e = estado({ selecionados: new Set(["1001", "1002", "1003", "1004", "1005"]) });
    const { el, chamadas } = montar(e);
    checar("antes: Assinar (4)", !!botao(el, "Assinar (4)"));
    escolherCombo(el, "Tipo", "Oficio");
    igual("so os visiveis ficam selecionados", [...e.selecionados], ["1004"]);
    checar("contador reflete 1", !!botao(el, "Assinar (1)") && !!botao(el, "Baixar (1)"));
    checar("avisou a mudanca", chamadas.mudou > 0);
    clicar(caixas(el)[1]!);
    igual("marcar um visivel", [...e.selecionados].sort(), ["1004", "1006"]);
    botao(el, "Limpar filtros")!.click();
    igual("limpar nao devolve o podado", [...e.selecionados].sort(), ["1004", "1006"]);
    igual("tudo visivel de novo", idsVisiveis(el).length, 6);
    const e2 = estado({ selecionados: new Set(["1001", "1004"]), filtro: { tipos: ["Despacho"] } });
    montar(e2);
    igual("filtro ativo na criacao poda (atualizar)", [...e2.selecionados], ["1001"]);
  }

  secao("selecao: atalho limpa o filtro");
  {
    const e = estado();
    const { el } = montar(e);
    escolherCombo(el, "Tipo", "Despacho");
    botao(el, "Externos")!.click();
    igual("filtro limpo", e.filtro, {});
    igual("externo selecionado", [...e.selecionados], ["1005"]);
    checar("todas as linhas visiveis", idsVisiveis(el).length === 6 && idsVisiveis(el).includes("1005"));
    checar("combo de tipo voltou ao vazio", (combo(el, "Tipo")?.textContent ?? "").includes("Todos os tipos"));
  }

  secao("selecao: faixa com Shift");
  {
    const e = estado();
    const { el } = montar(e);
    clicar(caixas(el)[1]!);
    igual("clique simples marca um", [...e.selecionados], ["1002"]);
    clicar(caixas(el)[4]!, true);
    igual("shift marca a faixa 2..5", [...e.selecionados].sort(), ["1002", "1003", "1004", "1005"]);
    clicar(caixas(el)[3]!, true);
    igual("shift de novo a partir do ultimo clique", [...e.selecionados].sort(), ["1002", "1003", "1004", "1005"]);
    clicar(caixas(el)[0]!);
    clicar(caixas(el)[2]!);
    igual("clique em marcada desmarca", [...e.selecionados].sort().includes("1003"), false);
  }

  secao("selecao: faixa respeita o filtro");
  {
    const e = estado();
    const { el } = montar(e);
    escolherCombo(el, "Tipo", "Oficio");
    igual("so oficios", idsVisiveis(el), ["1004", "1006"]);
    clicar(caixas(el)[0]!);
    clicar(caixas(el)[1]!, true);
    igual("faixa so entre as visiveis", [...e.selecionados].sort(), ["1004", "1006"]);
  }

  secao("selecao: contador por acao");
  {
    const e = estado({ selecionados: new Set(["1001", "1002", "1003", "1004", "1005"]) });
    const { el } = montar(e);
    const a = botao(el, "Assinar (4)");
    checar("Assinar (4): todos os internos", !!a);
    checar("Assinar habilitado", !!a && !a.hasAttribute("disabled"));
    checar("Cancelar assinatura (1)", !!botao(el, "Cancelar assinatura (1)"));
    checar("Duplicar (4): externo fora", !!botao(el, "Duplicar (4)"));
    checar("Baixar (5)", !!botao(el, "Baixar (5)"));
  }

  secao("selecao: botao desabilitado com 0");
  {
    const e = estado({ selecionados: new Set(["1005"]) });
    const { el, chamadas } = montar(e);
    const a = botao(el, "Assinar (0)")!;
    checar("Assinar (0) existe e esta desabilitado", !!a && a.hasAttribute("disabled"));
    a.click();
    igual("clique no desabilitado nao configura", chamadas.configurou.length, 0);
    const ok = botao(el, "Baixar (1)")!;
    ok.click();
    igual("clique numa acao abre a configuracao com ela", chamadas.configurou, ["baixar"]);
    botao(el, "Montar fila…")!.click();
    igual("Montar fila abre vazia", chamadas.configurou, ["baixar", undefined]);
  }

  secao("selecao: contador acompanha a selecao");
  {
    const e = estado();
    const { el } = montar(e);
    checar("sem selecao, Assinar (0)", !!botao(el, "Assinar (0)"));
    clicar(caixas(el)[0]!);
    checar("apos marcar um, Assinar (1)", !!botao(el, "Assinar (1)"));
  }

  secao("selecao: menu da linha");
  {
    const e = estado({ selecionados: new Set(["1001", "1002"]) });
    const { doc, el, chamadas } = montar(e);
    const linha4 = el.querySelector('tbody tr[data-id="1004"]')!;
    const menu = linha4.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!;
    checar("a linha tem o menu", !!menu);
    menu.click();
    await tique();
    const itens = [...doc.querySelectorAll('.spro-menu-pop [role="menuitem"]')].map((i) => (i.textContent ?? "").trim());
    checar("lista cancelar assinatura e nao lista assinar (ja assinado ainda assinavel?)", itens.includes("Cancelar assinatura"));
    checar("lista Baixar", itens.includes("Baixar"));
    const cancelar = [...doc.querySelectorAll<HTMLElement>('.spro-menu-pop [role="menuitem"]')].find((i) =>
      (i.textContent ?? "").includes("Cancelar assinatura"),
    )!;
    cancelar.click();
    igual("seleciona so o documento da linha", [...e.selecionados], ["1004"]);
    igual("abre a configuracao com a acao", chamadas.configurou, ["cancelar-assinatura"]);
    const l5 = el.querySelector('tbody tr[data-id="1005"]')!;
    l5.querySelector<HTMLButtonElement>('button[aria-haspopup="menu"]')!.click();
    await tique();
    const it5 = [...doc.querySelectorAll('.spro-menu-pop [role="menuitem"]')].map((i) => (i.textContent ?? "").trim());
    checar("externo: sem Duplicar nem Assinar", !it5.includes("Duplicar") && !it5.includes("Assinar"));
    checar("externo: com Baixar", it5.includes("Baixar"));
  }

  secao("selecao: atalhos");
  {
    const e = estado();
    const { el } = montar(e);
    botao(el, "Não assinados da minha unidade")!.click();
    igual("nao assinados da minha unidade", [...e.selecionados].sort(), ["1001", "1002", "1003"]);
    botao(el, "Assinados por mim")!.click();
    igual("assinados por mim", [...e.selecionados], ["1004"]);
    botao(el, "Externos")!.click();
    igual("externos", [...e.selecionados], ["1005"]);
    checar("os checkboxes refletem", caixas(el)[4]!.hasAttribute("checked") || (caixas(el)[4] as HTMLInputElement).checked === true);
  }

  secao("selecao: filtro de texto e periodo");
  {
    const e = estado();
    const { el } = montar(e);
    const busca = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    busca.value = "oficio";
    disparar(busca, "input");
    igual("texto sem acento nem caixa", idsVisiveis(el), ["1004", "1006"]);
    busca.value = "";
    disparar(busca, "input");
    const de = el.querySelector<HTMLInputElement>('input[aria-label="Data inicial"]')!;
    de.value = "2026-09-05";
    disparar(de, "change");
    igual("a partir de 05/09", idsVisiveis(el), ["1005", "1006"]);
    igual("filtro.de no estado", e.filtro.de, "2026-09-05");
  }

  secao("selecao: datas indisponiveis");
  {
    const e = estado({ datasIndisponiveis: true });
    const { el } = montar(e);
    checar("texto exato", (el.textContent ?? "").includes("Datas indisponíveis neste processo."));
    checar("data inicial desabilitada", el.querySelector('input[aria-label="Data inicial"]')!.hasAttribute("disabled"));
    checar("data final desabilitada", el.querySelector('input[aria-label="Data final"]')!.hasAttribute("disabled"));
  }

  secao("selecao: sem resultado do filtro");
  {
    const { el } = montar(estado());
    const busca = el.querySelector<HTMLInputElement>('input[type="search"]')!;
    busca.value = "zzz";
    disparar(busca, "input");
    checar("mensagem de vazio", (el.textContent ?? "").includes("Nenhum documento corresponde aos filtros."));
  }

  secao("selecao: processo sigiloso");
  {
    const { el } = montar(estado({ sigiloso: true }));
    checar("aviso no lugar da tabela", (el.textContent ?? "").includes("Este processo é sigiloso: as Ações em Lote não atuam nele."));
    checar("sem tabela", !el.querySelector("table"));
    checar("sem barra de acoes", !botao(el, "Montar fila…"));
  }

  secao("app: carrega pela RPC, mostra a selecao e troca de tela");
  {
    const doc = instalarDom('<html><body><div id="app"></div></body></html>');
    const raiz = doc.getElementById("app")!;
    const chamadas: Array<{ op: string; args: unknown }> = [];
    let fechou = 0;
    const rpc = {
      chamar: (async (op: string, args?: unknown) => {
        chamadas.push({ op, args });
        if (op === "arvore") return { protocolo: "00001.000001/2026-11", sigiloso: false, linhas: linhas() };
        throw new Error(`op inesperada ${op}`);
      }) as Rpc["chamar"],
    };
    const app = new AppAcoesLote(raiz, { rpc, ctx: CTX, fechar: () => fechou++ });
    checar("antes de carregar mostra Carregando", (raiz.textContent ?? "").includes("Carregando"));
    await app.iniciar();
    igual(
      "pediu a arvore",
      chamadas.map((c) => c.op),
      ["arvore"],
    );
    igual("tela de selecao", app.tela, "selecao");
    igual("6 linhas", idsVisiveis(raiz).length, 6);
    checar("titulo Ações em Lote", (raiz.querySelector("h1")?.textContent ?? "") === "Ações em Lote");
    checar("processo no cabecalho", (raiz.textContent ?? "").includes("00001.000001/2026-11"));
    clicar(caixas(raiz)[0]!);
    botao(raiz, "Baixar (1)")!.click();
    igual("tela de configuracao", app.tela, "configuracao");
    igual(
      "a acao e a primeira etapa",
      app.estado!.etapas.map((e) => e.acao),
      ["baixar"],
    );
    botao(raiz, "Voltar")!.click();
    igual("voltar devolve a selecao", app.tela, "selecao");
    igual("a selecao sobrevive", [...app.estado!.selecionados], ["1001"]);
    botao(raiz, "Atualizar")!.click();
    await tique();
    igual("atualizar pede com forcar", chamadas[chamadas.length - 1], { op: "arvore", args: { forcar: true } });
    igual("e preserva a selecao", [...app.estado!.selecionados], ["1001"]);
    botao(raiz, "Fechar")!.click();
    igual("fechar", fechou, 1);
  }

  secao("app: erro ao carregar e processo sigiloso");
  {
    const doc = instalarDom('<html><body><div id="app"></div></body></html>');
    const raiz = doc.getElementById("app")!;
    const app = new AppAcoesLote(raiz, {
      rpc: {
        chamar: (async () => {
          throw new Error("A árvore não abriu.");
        }) as Rpc["chamar"],
      },
      ctx: CTX,
      fechar: () => undefined,
    });
    await app.iniciar();
    checar("mostra o motivo por extenso", (raiz.textContent ?? "").includes("A árvore não abriu."));
    const doc2 = instalarDom('<html><body><div id="app"></div></body></html>');
    const raiz2 = doc2.getElementById("app")!;
    const app2 = new AppAcoesLote(raiz2, {
      rpc: { chamar: (async () => ({ protocolo: "p", sigiloso: true, linhas: [] })) as Rpc["chamar"] },
      ctx: CTX,
      fechar: () => undefined,
    });
    await app2.iniciar();
    checar("sigiloso pelo app", (raiz2.textContent ?? "").includes("Este processo é sigiloso"));
  }
}
