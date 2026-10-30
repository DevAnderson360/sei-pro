/**
 * Provas do teclado e do tema: Esc (fecha; na execucao pausa e pergunta), Ctrl/Cmd+Enter (configuracao e
 * previa), nenhum botao "Cancelar" nas telas e o tema no <html>. DOM do linkedom, RPC falso, area em memoria.
 */

import { aplicarTemaDoContexto } from "@comum/tema/painel";
import { AppAcoesLote, type ContextoApp, type Tela } from "../src/app/app";
import type { LinhaDoc } from "../src/modelo/documentos";
import { checar, igual, instalarDom, secao, tique } from "./util";

const CTX: ContextoApp = {
  host: "sei.x.gov.br",
  login: "ana",
  nomeUsuario: "Ana Silva",
  unidadeSigla: "ANA/SUP",
  temaEscuro: false,
  idProcedimento: "99",
  origem: "https://sei.x.gov.br/sei/controlador.php",
};

const linha = (n: number): LinhaDoc => ({
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
});

/** Tecla no documento, como o navegador a entrega (o evento do proprio linkedom). */
function tecla(doc: Document, key: string, o: { ctrl?: boolean; meta?: boolean; alvo?: Element } = {}): Event {
  const Ev = (doc.defaultView as unknown as { Event: typeof Event }).Event;
  const ev = new Ev("keydown", { bubbles: true, cancelable: true });
  Object.assign(ev, { key, ctrlKey: !!o.ctrl, metaKey: !!o.meta });
  (o.alvo ?? doc.body).dispatchEvent(ev);
  return ev;
}

/** Texto e rotulo de cada botao. "Cancelar documento" e "Cancelar assinatura" sao acoes do SEI, nao o botao de dispensar. */
const rotulosDosBotoes = (raiz: ParentNode): string[] =>
  [...raiz.querySelectorAll("button")].flatMap((b) => [
    (b.textContent ?? "").replace(/\(\d+\)/, "").trim(),
    b.getAttribute("aria-label") ?? "",
  ]);
const eCancelar = (r: string): boolean => /^cancelar$/i.test(r.trim());

async function montar(confirma: (texto: string) => boolean | Promise<boolean> = () => false) {
  const doc = instalarDom('<html><body><div id="r"></div></body></html>');
  const chamadas: string[] = [];
  const textos: string[] = [];
  let fechou = 0;
  const rpc = {
    async chamar<T>(op: string): Promise<T> {
      chamadas.push(op);
      if (op === "arvore") return { protocolo: "00001.000001/2026-11", sigiloso: false, linhas: [linha(1), linha(2)] } as T;
      return { situacao: "ok", resumo: "Feito.", mudancas: [] } as T;
    },
  };
  const app = new AppAcoesLote(doc.getElementById("r")!, {
    rpc,
    ctx: CTX,
    fechar: () => void fechou++,
    confirmar: async (t) => {
      textos.push(t);
      return confirma(t);
    },
    agora: () => 1_000_000,
    esperar: async () => undefined,
  });
  await app.iniciar();
  app.estado!.selecionados = new Set(app.estado!.linhas.map((l) => l.id));
  app.estado!.etapas = [{ acao: "ciencia" }];
  const ir = (t: Tela) => (app as unknown as { mostrar(t: Tela): void }).mostrar(t);
  return { doc, app, ir, chamadas, textos, fechou: () => fechou, raiz: doc.getElementById("r")! };
}

export async function verificarAppTeclado(): Promise<void> {
  secao("Teclado: Esc fecha fora da execucao");
  for (const t of ["selecao", "configuracao", "previa"] as const) {
    const m = await montar();
    m.ir(t);
    const ev = tecla(m.doc, "Escape");
    igual(`Esc em ${t} fecha`, m.fechou(), 1);
    checar(`Esc em ${t} consome o evento`, ev.defaultPrevented);
    m.app.destruir();
  }

  secao("Teclado: Esc na execucao pausa e pergunta");
  {
    const segura: () => void = () => undefined;
    const m = await montar(() => false);
    m.app.estado!.planos = (await import("../src/modelo/fila")).planejar(m.app.estado!.linhas, m.app.estado!.etapas, false);
    void segura;
    m.app.executar();
    await tique(20);
    // Ja concluiu (RPC instantaneo): prova a pergunta numa execucao em voo, com o executar preso.
    m.app.destruir();
  }
  {
    let soltar: () => void = () => undefined;
    const doc = instalarDom('<html><body><div id="r"></div></body></html>');
    let fechou = 0;
    const textos: string[] = [];
    const rotulos: Array<[string?, string?]> = [];
    let resposta = false;
    const rpc = {
      async chamar<T>(op: string): Promise<T> {
        if (op === "arvore") return { protocolo: "00001.000001/2026-11", sigiloso: false, linhas: [linha(1), linha(2)] } as T;
        return (await new Promise<T>((r) => {
          soltar = () => r({ situacao: "ok", resumo: "Feito.", mudancas: [] } as T);
        })) as T;
      },
    };
    const app = new AppAcoesLote(doc.getElementById("r")!, {
      rpc,
      ctx: CTX,
      fechar: () => void fechou++,
      confirmar: async (t, ok, desistir) => {
        textos.push(t);
        rotulos.push([ok, desistir]);
        return resposta;
      },
      agora: () => 1_000_000,
      esperar: async () => undefined,
    });
    await app.iniciar();
    app.estado!.selecionados = new Set(app.estado!.linhas.map((l) => l.id));
    app.estado!.etapas = [{ acao: "ciencia" }];
    app.estado!.planos = (await import("../src/modelo/fila")).planejar(app.estado!.linhas, app.estado!.etapas, false);
    app.executar();
    await tique(10);
    igual("tela de execucao", app.tela, "execucao");
    tecla(doc, "Escape");
    await tique(5);
    igual("pergunta o texto combinado", textos, ["O lote foi pausado. Fechar as Ações em Lote?"]);
    igual("botoes Fechar e Voltar", rotulos, [["Fechar", "Voltar"]]);
    igual("o lote foi pausado", (app as unknown as { controle: { estado: string } }).controle.estado, "pausado");
    igual("dispensar nao fecha", fechou, 0);
    igual("segue na execucao", app.tela, "execucao");
    soltar();
    await tique(10);
    checar(
      "Continuar disponivel",
      [...doc.querySelectorAll("button")].some((b) => b.textContent === "Continuar" && !b.hidden),
    );
    resposta = true;
    tecla(doc, "Escape");
    await tique(5);
    igual("confirmar fecha", fechou, 1);
    soltar();
    app.destruir();
  }

  secao("Teclado: Esc dentro de um dialogo nao fecha o app");
  {
    const m = await montar();
    m.ir("selecao");
    const dlg = m.doc.createElement("dialog");
    m.doc.body.append(dlg);
    tecla(m.doc, "Escape", { alvo: dlg });
    igual("Esc no dialogo de cima", m.fechou(), 0);
    m.app.destruir();
  }

  secao("Teclado: Ctrl+Enter");
  {
    const m = await montar();
    m.ir("selecao");
    tecla(m.doc, "Enter", { ctrl: true });
    igual("selecao: nada", m.app.tela, "selecao");
    m.ir("configuracao");
    tecla(m.doc, "Enter");
    igual("Enter sozinho: nada", m.app.tela, "configuracao");
    tecla(m.doc, "Enter", { ctrl: true });
    igual("configuracao: Ctrl+Enter vai a previa", m.app.tela, "previa");
    await tique(30);
    tecla(m.doc, "Enter", { meta: true });
    await tique(10);
    checar("previa: Cmd+Enter executa", m.app.tela === "execucao" || m.app.tela === "resultado", m.app.tela);
    checar("o executar do SEI foi chamado", m.chamadas.includes("executar"));
    m.app.destruir();
  }
  {
    const m = await montar();
    m.app.estado!.etapas = [{ acao: "assinar", cargo: "" }];
    m.ir("configuracao");
    tecla(m.doc, "Enter", { ctrl: true });
    igual("configuracao invalida: Ctrl+Enter nao avanca", m.app.tela, "configuracao");
    m.app.destruir();
  }

  secao("Executar: uma so vez");
  {
    const caso = async (
      nome: string,
      etapa: "ciencia" | "excluir",
      disparo: (m: Awaited<ReturnType<typeof montar>>) => void,
      esperado: number,
      confirma = true,
    ) => {
      const m = await montar(() => confirma);
      m.app.estado!.etapas = [{ acao: etapa }];
      let n = 0;
      const orig = m.app.executar.bind(m.app);
      m.app.executar = () => {
        n++;
        orig();
      };
      m.ir("previa");
      await tique(30);
      disparo(m);
      await tique(20);
      igual(nome, n, esperado);
      m.app.destruir();
    };
    await caso("um Ctrl+Enter (so ciencia): uma execucao", "ciencia", (m) => void tecla(m.doc, "Enter", { ctrl: true }), 1);
    await caso(
      "dois Ctrl+Enter seguidos: uma execucao",
      "ciencia",
      (m) => {
        tecla(m.doc, "Enter", { ctrl: true });
        tecla(m.doc, "Enter", { ctrl: true });
      },
      1,
    );
    await caso(
      "dois cliques rapidos: uma execucao",
      "ciencia",
      (m) => {
        const b = [...m.raiz.querySelectorAll("button")].find((x) => x.textContent === "Executar")!;
        b.click();
        b.click();
      },
      1,
    );
    await caso(
      "destrutiva, Ctrl+Enter + clique: uma execucao",
      "excluir",
      (m) => {
        tecla(m.doc, "Enter", { ctrl: true });
        [...m.raiz.querySelectorAll("button")].find((x) => x.textContent === "Executar")!.click();
      },
      1,
    );
    {
      const m = await montar(() => false);
      m.app.estado!.etapas = [{ acao: "excluir" }];
      let n = 0;
      const orig = m.app.executar.bind(m.app);
      m.app.executar = () => {
        n++;
        orig();
      };
      m.ir("previa");
      await tique(30);
      const b = [...m.raiz.querySelectorAll("button")].find((x) => x.textContent === "Executar")!;
      b.click();
      await tique(10);
      igual("recusou a confirmacao: nao executou", n, 0);
      checar("Executar volta a ficar habilitado", !b.disabled);
      m.textos.length = 0;
      b.click();
      await tique(10);
      igual("pergunta de novo apos recusar", m.textos.length, 1);
      m.app.destruir();
    }
  }

  secao("Teclado: nenhum botao Cancelar nas telas");
  {
    const m = await montar();
    for (const t of ["selecao", "configuracao", "previa"] as const) {
      m.ir(t);
      await tique(30);
      const rotulos = rotulosDosBotoes(m.raiz);
      checar(`sem Cancelar em ${t}`, !rotulos.some(eCancelar), rotulos);
    }
    m.app.executar();
    await tique(30);
    for (const t of ["execucao", "resultado"] as const) {
      if (m.app.tela !== t) m.ir(t);
      const rotulos = rotulosDosBotoes(m.raiz);
      checar(`sem Cancelar em ${t}`, !rotulos.some(eCancelar), rotulos);
    }
    m.app.destruir();
  }

  secao("Tema: html recebe o tema do contexto");
  {
    const doc = instalarDom("<html><body></body></html>");
    const html = doc.documentElement as HTMLElement;
    aplicarTemaDoContexto(html, { temaEscuro: true });
    igual("escuro", html.dataset.tema, "escuro");
    aplicarTemaDoContexto(html, { temaEscuro: false });
    igual("claro", html.dataset.tema, "claro");
  }
}
