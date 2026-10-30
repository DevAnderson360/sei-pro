/**
 * Provas da tela de previa: DOM do linkedom, RPC falso e confirmacao falsa. A previa roda so a primeira etapa
 * pendente de cada documento; as seguintes ficam "a confirmar na execucao".
 */

import { AppAcoesLote, type ContextoApp, type EstadoApp } from "../src/app/app";
import { montarPrevia, resumoConfirmacao } from "../src/app/previa";
import type { LinhaDoc } from "../src/modelo/documentos";
import { type ParamsEtapa, planejar } from "../src/modelo/fila";
import { botao, checar, igual, instalarDom, secao, tique } from "./util";

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

function estado(etapas: ParamsEtapa[], n = 3): EstadoApp {
  const linhas = Array.from({ length: n }, (_, i) => linha(i + 1));
  return {
    ctx: CTX,
    protocolo: "00001.000001/2026-11",
    sigiloso: false,
    linhas,
    selecionados: new Set(linhas.map((l) => l.id)),
    filtro: {},
    etapas,
    planos: [],
  };
}

type Resp = (a: Record<string, unknown>) => unknown;

function rpcFalso(previa: Resp) {
  const chamadas: Array<{ op: string; args: Record<string, unknown> }> = [];
  let emVoo = 0;
  let maxVoo = 0;
  return {
    chamadas,
    get maxVoo() {
      return maxVoo;
    },
    rpc: {
      async chamar<T>(op: string, args?: unknown): Promise<T> {
        const a = (args ?? {}) as Record<string, unknown>;
        chamadas.push({ op, args: a });
        if (op !== "previa") throw new Error(`op ${op} inesperada`);
        emVoo += 1;
        maxVoo = Math.max(maxVoo, emVoo);
        await tique(2);
        emVoo -= 1;
        return previa(a) as T;
      },
    },
  };
}

const ok = (resumo: string, mudancas: unknown[] = []) => ({ situacao: "ok", resumo, mudancas });

function montar(e: EstadoApp, previa: Resp, senha?: string, confirmaCom = true) {
  const doc = instalarDom('<html><body><div id="r"></div></body></html>');
  const f = rpcFalso(previa);
  const ev = { voltou: 0, executou: 0, confirmacoes: [] as string[], rotulos: [] as Array<[string?, string?]> };
  const el = montarPrevia(
    doc,
    e,
    {
      voltar: () => {
        ev.voltou += 1;
      },
      executar: () => {
        ev.executou += 1;
      },
    },
    {
      rpc: f.rpc,
      senha,
      confirmar: async (texto, rotuloOk, rotuloDesistir) => {
        ev.confirmacoes.push(texto);
        ev.rotulos.push([rotuloOk, rotuloDesistir]);
        return confirmaCom;
      },
    },
  );
  doc.getElementById("r")!.append(el);
  return { doc, el, ev, f };
}

const texto = (el: ParentNode, sel: string) => [...el.querySelectorAll(sel)].map((n) => (n.textContent ?? "").trim());
const linhaDe = (el: ParentNode, numero: string) =>
  [...el.querySelectorAll<HTMLElement>(".al-previa-doc")].find((l) => (l.textContent ?? "").includes(numero))!;

export async function verificarAppPrevia(): Promise<void> {
  secao("previa: resumoConfirmacao");
  {
    const e7 = estado([{ acao: "excluir" }], 7);
    const p7 = planejar(e7.linhas, e7.etapas, false);
    igual("excluir 7", resumoConfirmacao(p7, e7.etapas), "Excluir 7 documentos? Isso não pode ser desfeito.");
    const m1 = estado([{ acao: "mover", destino: { protocolo: "1", idProcedimento: "2", tipo: "T" }, motivo: "x" }], 1);
    igual("mover 1", resumoConfirmacao(planejar(m1.linhas, m1.etapas, false), m1.etapas), "Mover 1 documento? Isso não pode ser desfeito.");
    const c = estado([{ acao: "ciencia" }]);
    igual("so ciencia: null", resumoConfirmacao(planejar(c.linhas, c.etapas, false), c.etapas), null);
    const ad = estado([{ acao: "alterar-dados", descricao: "x", interessados: { modo: "substituir", itens: [{ id: "1", texto: "A" }] } }]);
    igual(
      "alterar dados substituindo",
      resumoConfirmacao(planejar(ad.linhas, ad.etapas, false), ad.etapas),
      "Alterar dados de 3 documentos? Interessados serão substituídos.",
    );
    const ad2 = estado([
      {
        acao: "alterar-dados",
        interessados: { modo: "remover", itens: [{ id: "1", texto: "A" }] },
        assuntos: { modo: "remover", itens: [{ id: "2", texto: "B" }] },
      },
      { acao: "excluir" },
    ]);
    igual(
      "excluir + remover",
      resumoConfirmacao(planejar(ad2.linhas, ad2.etapas, false), ad2.etapas),
      "Excluir 3 documentos? Isso não pode ser desfeito. Interessados/assuntos serão removidos.",
    );
    const e = estado([{ acao: "excluir" }]);
    const pl = planejar(e.linhas, e.etapas, false).map((p, i) =>
      i === 0 ? { ...p, etapas: [{ acao: "excluir" as const, situacao: "pulado" as const }] } : p,
    );
    igual("conta so os elegiveis", resumoConfirmacao(pl, e.etapas), "Excluir 2 documentos? Isso não pode ser desfeito.");
  }

  secao("previa: roda so a primeira etapa pendente");
  {
    const e = estado([{ acao: "ciencia" }, { acao: "duplicar" }]);
    const { el, f } = montar(e, (a) => ok(`resumo ${a.numero}`, [{ campo: "Descrição", antes: "a", depois: "b" }]));
    await tique(60);
    igual(
      "3 chamadas, todas da ciencia",
      f.chamadas.map((c) => [c.op, (c.args.etapa as ParamsEtapa).acao, c.args.numero]),
      [
        ["previa", "ciencia", "5001"],
        ["previa", "ciencia", "5002"],
        ["previa", "ciencia", "5003"],
      ],
    );
    checar("concorrencia 3", f.maxVoo === 3, f.maxVoo);
    const l = linhaDe(el, "5001");
    checar("mostra o resumo", (l.textContent ?? "").includes("resumo 5001"));
    checar("segunda etapa a confirmar", texto(l, ".al-previa-etapa")[1]!.includes("a confirmar na execução"));
    checar("mudanca campo a campo", (l.textContent ?? "").includes("Descrição: a → b"));
    igual("rodape", texto(el, ".al-previa-total"), ["3 documentos · 6 etapas · 0 pulados"]);
    igual("titulo: so numero e titulo, sem repetir o tipo", texto(el, ".al-previa-titulo")[0], "5001 · Despacho 1");
    checar(
      "nao cria bloco: so chamou previa",
      f.chamadas.every((c) => c.op === "previa"),
    );
  }

  secao("previa: pulado e erro propagam");
  {
    const e = estado([{ acao: "ciencia" }, { acao: "duplicar" }]);
    const { el } = montar(e, (a) =>
      a.numero === "5001"
        ? { situacao: "pulado", erro: "Já tem ciência." }
        : a.numero === "5002"
          ? { situacao: "erro", erro: "Falhou a leitura." }
          : ok("ok"),
    );
    await tique(60);
    const l1 = texto(linhaDe(el, "5001"), ".al-previa-etapa");
    checar("pulado com a mensagem", l1[0]!.includes("Já tem ciência."), l1);
    checar("segunda pulada em cascata", l1[1]!.includes("Etapa anterior não concluída"), l1);
    const l2 = texto(linhaDe(el, "5002"), ".al-previa-etapa");
    checar("erro com a mensagem", l2[0]!.includes("Falhou a leitura.") && l2[0]!.includes("erro"), l2);
    checar("erro derruba a seguinte", l2[1]!.includes("Etapa anterior não concluída"), l2);
    igual(
      "planos no estado",
      e.planos.map((p) => p.etapas.map((x) => x.situacao)),
      [
        ["pulado", "pulado"],
        ["erro", "pulado"],
        ["pendente", "pendente"],
      ],
    );
    igual("rodape com pulados", texto(el, ".al-previa-total"), ["3 documentos · 6 etapas · 3 pulados"]);
  }

  secao("previa: baixar e pdf sem RPC");
  {
    const e = estado([{ acao: "baixar", modo: "arquivos" }]);
    const { el, f } = montar(e, () => ok("x"));
    await tique(30);
    igual("nenhuma chamada", f.chamadas.length, 0);
    checar(
      "a confirmar na execucao",
      texto(el, ".al-previa-etapa").every((t) => t.includes("a confirmar na execução")),
    );
  }

  secao("previa: parar e tentar de novo");
  {
    const e = estado([{ acao: "ciencia" }], 6);
    let derrubar = true;
    const { el, f } = montar(e, (a) =>
      derrubar && a.numero === "5001" ? { situacao: "erro", erro: "Sessão expirada. Entre no SEI de novo.", parar: true } : ok("ok"),
    );
    await tique(80);
    checar("aviso no topo", (texto(el, ".al-previa-aviso")[0] ?? "").includes("Sessão expirada"), texto(el, ".al-previa-aviso"));
    checar("parou antes de todos", f.chamadas.length < 6, f.chamadas.length);
    checar("Executar desabilitado enquanto parado", botao(el, "Executar")!.hasAttribute("disabled"));
    const antes = f.chamadas.length;
    derrubar = false;
    botao(el, "Tentar de novo")!.click();
    await tique(100);
    checar("rodou de novo", f.chamadas.length > antes);
    igual("sem aviso depois", texto(el, ".al-previa-aviso").filter(Boolean), []);
    checar(
      "todos com resumo",
      texto(el, ".al-previa-etapa").every((t) => t.includes("ok")),
      texto(el, ".al-previa-etapa"),
    );
    checar("Executar habilitado", !botao(el, "Executar")!.hasAttribute("disabled"));
  }

  secao("previa: Executar, confirmacao, senha, Voltar");
  {
    const e = estado([{ acao: "excluir" }], 2);
    const { el, ev } = montar(e, () => ok("ok"));
    await tique(40);
    botao(el, "Executar")!.click();
    await tique(5);
    igual("pediu confirmacao", ev.confirmacoes, ["Excluir 2 documentos? Isso não pode ser desfeito."]);
    igual("botoes Executar e Voltar (nunca Cancelar, ambiguo com Cancelar a assinatura)", ev.rotulos, [["Executar", "Voltar"]]);
    igual("executou", ev.executou, 1);
    botao(el, "Voltar")!.click();
    igual("voltou", ev.voltou, 1);
    checar("sem Cancelar", !botao(el, "Cancelar"));
  }
  {
    const e = estado([{ acao: "excluir" }], 2);
    const { el, ev } = montar(e, () => ok("ok"), undefined, false);
    await tique(40);
    botao(el, "Executar")!.click();
    await tique(5);
    igual("recusou: nao executa", ev.executou, 0);
  }
  {
    const e = estado([{ acao: "ciencia" }], 2);
    const { el, ev } = montar(e, () => ok("ok"));
    await tique(40);
    botao(el, "Executar")!.click();
    await tique(5);
    igual("sem confirmar: executa direto", [ev.confirmacoes.length, ev.executou], [0, 1]);
  }
  {
    const e = estado([{ acao: "assinar", cargo: "Analista" }], 2);
    const { el } = montar(e, () => ok("ok"));
    await tique(40);
    checar("assinar sem senha: desabilitado", botao(el, "Executar")!.hasAttribute("disabled"));
    igual("dica da senha", texto(el, ".al-previa-dica"), ["Digite a senha da assinatura na configuração."]);
    const c = montar(estado([{ acao: "assinar", cargo: "Analista" }], 2), () => ok("ok"), "segredo");
    await tique(40);
    checar("assinar com senha: habilitado", !botao(c.el, "Executar")!.hasAttribute("disabled"));
    igual("sem dica", texto(c.el, ".al-previa-dica").filter(Boolean), []);
  }
  {
    const e = estado([{ acao: "ciencia" }], 2);
    e.linhas[0] = linha(1, { nivel: "sigiloso" });
    const { el } = montar(e, () => ok("ok"));
    await tique(40);
    checar("sigiloso pulado", (linhaDe(el, "5001").textContent ?? "").includes("Sigiloso"));
  }

  secao("previa: prévia atrasada depois do Voltar");
  {
    const e = estado([{ acao: "excluir" }], 3);
    let solta!: () => void;
    const porta = new Promise<void>((r) => {
      solta = r;
    });
    const rpcLento = {
      async chamar<T>(): Promise<T> {
        await porta;
        return { situacao: "pulado", erro: "Atrasado." } as T;
      },
    };
    const doc = instalarDom('<html><body><div id="r"></div></body></html>');
    const antiga = montarPrevia(
      doc,
      e,
      { voltar: () => undefined, executar: () => undefined },
      { rpc: rpcLento, confirmar: async () => true },
    );
    doc.getElementById("r")!.append(antiga);
    await tique(10);
    botao(antiga, "Voltar")!.click();
    e.selecionados = new Set(["1002", "1003"]);
    const nova = montarPrevia(
      doc,
      e,
      { voltar: () => undefined, executar: () => undefined },
      { rpc: rpcFalso(() => ok("ok")).rpc, confirmar: async () => true },
    );
    const planosNovos = e.planos;
    await tique(40);
    solta();
    await tique(40);
    checar("planos novos intactos", e.planos === planosNovos && e.planos.every((p) => p.etapas[0]!.situacao === "pendente"));
    igual("confirmacao conta os 2", resumoConfirmacao(e.planos, e.etapas), "Excluir 2 documentos? Isso não pode ser desfeito.");
    void nova;
  }

  secao("previa: senha no app, fora do estado");
  {
    const doc = instalarDom('<html><body><div id="r"></div></body></html>');
    const raiz = doc.getElementById("r")!;
    const e = estado([{ acao: "assinar", cargo: "Analista" }], 2);
    const rpc = {
      async chamar<T>(op: string): Promise<T> {
        if (op === "arvore") return { protocolo: e.protocolo, sigiloso: false, linhas: e.linhas } as T;
        return ok("ok") as T;
      },
    };
    const app = new AppAcoesLote(raiz, { rpc, ctx: CTX, fechar: () => undefined });
    await app.iniciar();
    app.estado!.selecionados = new Set(e.linhas.map((l) => l.id));
    app.estado!.etapas = e.etapas;
    app.abrirPrevia("segredo");
    igual("tela previa", app.tela, "previa");
    igual("getter da senha", app.senhaAssinatura, "segredo");
    checar(
      "senha fora do estado",
      !JSON.stringify([...Object.entries(app.estado!)].map(([k, v]) => [k, v instanceof Set ? [...v] : v])).includes("segredo"),
    );
    await tique(40);
    botao(raiz, "Executar")!.click();
    await tique(5);
    igual("tela execucao", app.tela, "execucao");
    // A senha passa ao controle da execucao (Task 10) e sai do app.
    igual("senha entregue a execucao e fora do app", app.senhaAssinatura, undefined);
    app.abrirPrevia(undefined);
    botao(raiz, "Voltar")!.click();
    igual("voltar vai a configuracao", app.tela, "configuracao");
    igual("voltar limpa a senha", app.senhaAssinatura, undefined);
  }
}
