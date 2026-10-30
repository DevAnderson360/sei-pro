/**
 * Tela de prévia: o que cada documento vai sofrer, antes de executar. A prévia pergunta ao SEI (`previa`, sem
 * gravar nada) só pela primeira etapa pendente de cada documento, 3 por vez; as seguintes dependem do efeito da
 * anterior e ficam "a confirmar na execução". Baixar e PDF não têm o que prever no SEI e também ficam assim.
 * `pulado` e `erro` marcam a etapa e derrubam as seguintes (por `registrar`); `parar` (sessão caída) interrompe a
 * rodada e oferece "Tentar de novo". A senha da assinatura chega só para decidir se Executar está liberado.
 */

import { ExecutorLote, type ItemLote } from "@comum/lote/executor";
import type { Rpc } from "@comum/ponte/rpc";
import { h } from "@comum/ui/dom";
import { ACOES, type AcaoId } from "../modelo/acoes";
import { type ParamsEtapa, type PlanoDoc, planejar, proximaEtapa, registrar } from "../modelo/fila";
import type { EstadoApp } from "./app";

export interface AcoesPrevia {
  voltar(): void;
  executar(): void;
}

export interface DepsPrevia {
  rpc: Pick<Rpc, "chamar">;
  /** Só para saber se Assinar pode executar; nunca é exibida nem guardada aqui. */
  senha?: string | undefined;
  confirmar(texto: string, rotuloOk?: string, rotuloDesistir?: string): Promise<boolean>;
}

interface Mudanca {
  campo: string;
  antes: string;
  depois: string;
}

type RespostaPrevia =
  | { situacao: "ok"; resumo: string; mudancas?: Mudanca[] }
  | { situacao: "pulado" | "erro"; erro: string; parar?: boolean };

const A_CONFIRMAR = "a confirmar na execução";
const SEM_PREVIA: ReadonlySet<AcaoId> = new Set(["baixar", "pdf"]);
const plural = (n: number, um: string, varios: string): string => `${n} ${n === 1 ? um : varios}`;
const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const rotulo = (id: AcaoId): string => ACOES.find((a) => a.id === id)!.rotulo;

const VERBO: Partial<Record<AcaoId, string>> = {
  excluir: "Excluir",
  "cancelar-assinatura": "Cancelar a assinatura de",
  "cancelar-documento": "Cancelar",
  mover: "Mover",
};

const efetiva = (s: string): boolean => s !== "pulado" && s !== "erro";

/** O texto do pedido de confirmação, ou null quando nenhuma etapa o pede. Conta só os documentos elegíveis. */
export function resumoConfirmacao(planos: PlanoDoc[], etapas: ParamsEtapa[]): string | null {
  const perguntas: string[] = [];
  const avisos: string[] = [];
  let alterados = 0;
  etapas.forEach((et, i) => {
    const n = planos.filter((p) => p.etapas[i] && efetiva(p.etapas[i]!.situacao)).length;
    if (n === 0) return;
    const def = ACOES.find((a) => a.id === et.acao)!;
    if (def.confirmar) perguntas.push(`${VERBO[et.acao] ?? def.rotulo} ${plural(n, "documento", "documentos")}`);
    if (et.acao === "alterar-dados") {
      alterados = n;
      const por = (modo: "substituir" | "remover") => {
        const nomes: string[] = [];
        if (et.interessados?.modo === modo) nomes.push("interessados");
        if (et.assuntos?.modo === modo) nomes.push("assuntos");
        if (nomes.length === 0) return;
        const junto = nomes.join("/");
        avisos.push(`${junto[0]!.toUpperCase()}${junto.slice(1)} serão ${modo === "substituir" ? "substituídos" : "removidos"}.`);
      };
      por("substituir");
      por("remover");
    }
  });
  if (perguntas.length === 0 && avisos.length === 0) return null;
  const partes: string[] = [];
  if (perguntas.length > 0) {
    const [primeira, ...resto] = perguntas;
    const lista = [primeira!, ...resto.map((p) => p[0]!.toLowerCase() + p.slice(1))];
    partes.push(`${lista.join(" e ")}? Isso não pode ser desfeito.`);
  } else {
    partes.push(`Alterar dados de ${plural(alterados, "documento", "documentos")}?`);
  }
  partes.push(...avisos);
  return partes.join(" ");
}

export function montarPrevia(doc: Document, e: EstadoApp, acoes: AcoesPrevia, deps: DepsPrevia): HTMLElement {
  const sel = e.linhas.filter((l) => e.selecionados.has(l.id));
  // Cópia local: uma prévia atrasada nunca escreve nos planos de outra montagem que reatribuiu `planos`.
  const planos = planejar(sel, e.etapas, e.sigiloso);
  e.planos = planos;
  let executorAtual: { cancelar(): void } | null = null;
  /** Resposta de prévia já recebida, por id do documento. */
  const previas = new Map<string, { resumo: string; mudancas: Mudanca[] }>();
  let rodando = false;
  let parou: string | null = null;
  let vivo = true;

  const aviso = h("p", { class: "al-previa-aviso al-erro", role: "alert" });
  const lista = h("div", { class: "al-previa-lista" });
  const total = h("p", { class: "al-previa-total al-dica" });
  const dica = h("p", { class: "al-previa-dica al-dica" });
  const novamente = h("button", { type: "button", class: "spro-botao" }, "Tentar de novo");
  const executar = h("button", { type: "button", class: "spro-botao primario" }, "Executar");
  const voltar = h("button", { type: "button", class: "spro-botao" }, "Voltar");

  const precisaSenha = e.etapas.some((x) => x.acao === "assinar");
  const semSenha = precisaSenha && !deps.senha;

  function textoEtapa(p: PlanoDoc, i: number): HTMLElement {
    const et = p.etapas[i]!;
    const r = rotulo(et.acao);
    const caixa = h("li", { class: "al-previa-etapa", "data-situacao": et.situacao });
    if (et.situacao === "pulado") {
      caixa.append(`${r}: pulado. ${et.mensagem ?? ""}`.trim());
    } else if (et.situacao === "erro") {
      caixa.append(`${r}: erro. ${et.mensagem ?? ""}`.trim());
    } else if (i === proximaEtapa(p) && !SEM_PREVIA.has(et.acao)) {
      const pv = previas.get(p.doc.id);
      caixa.append(`${r}: ${pv ? pv.resumo : parou ? "sem prévia" : "verificando…"}`);
      if (pv && pv.mudancas.length > 0) {
        caixa.append(
          h(
            "ul",
            { class: "al-previa-mudancas" },
            ...pv.mudancas.map((m) => h("li", {}, `${m.campo}: ${m.antes || "(vazio)"} → ${m.depois || "(vazio)"}`)),
          ),
        );
      }
    } else {
      caixa.append(`${r}: ${A_CONFIRMAR}`);
    }
    return caixa;
  }

  function desenhar(): void {
    lista.replaceChildren(
      ...planos.map((p) =>
        h(
          "section",
          { class: "al-previa-doc" },
          h("h3", { class: "al-previa-titulo" }, `${p.doc.numero} · ${p.doc.titulo || p.doc.tipo}`),
          h("ul", { class: "al-previa-etapas" }, ...p.etapas.map((_, i) => textoEtapa(p, i))),
        ),
      ),
    );
    const etapas = planos.reduce((n, p) => n + p.etapas.length, 0);
    const pulados = planos.reduce((n, p) => n + p.etapas.filter((x) => x.situacao === "pulado").length, 0);
    total.textContent = `${plural(planos.length, "documento", "documentos")} · ${plural(etapas, "etapa", "etapas")} · ${plural(pulados, "pulado", "pulados")}`;
    aviso.textContent = parou ?? "";
    novamente.hidden = !parou;
    const algoParaFazer = planos.some((p) => proximaEtapa(p) !== null);
    executar.disabled = rodando || !!parou || !algoParaFazer || semSenha;
    dica.textContent = semSenha ? "Digite a senha da assinatura na configuração." : "";
  }

  /** Documentos que ainda pedem prévia: primeira etapa pendente com RPC e sem resposta. */
  const faltantes = (): number[] =>
    planos.flatMap((p, k) => {
      const i = proximaEtapa(p);
      return i !== null && !SEM_PREVIA.has(p.etapas[i]!.acao) && !previas.has(p.doc.id) ? [k] : [];
    });

  async function rodar(): Promise<void> {
    if (rodando) return;
    rodando = true;
    parou = null;
    desenhar();
    const itens: ItemLote<number, true>[] = faltantes().map((k, indice) => ({ indice, entrada: k, situacao: "pendente", tentativas: 0 }));
    const executor: ExecutorLote<number, true> = new ExecutorLote<number, true>(itens, {
      concorrencia: 3,
      pausaMs: () => 0,
      aoMudar: () => vivo && desenhar(),
      async processar(k) {
        const p = planos[k]!;
        const i = proximaEtapa(p)!;
        let r: RespostaPrevia;
        try {
          r = await deps.rpc.chamar<RespostaPrevia>("previa", { etapa: e.etapas[i], numero: p.doc.numero });
        } catch (erro) {
          r = { situacao: "erro", erro: mensagem(erro) };
        }
        if (r.situacao === "ok") {
          previas.set(p.doc.id, { resumo: r.resumo, mudancas: r.mudancas ?? [] });
          return { situacao: "ok" };
        }
        if (r.parar) {
          parou = r.erro;
          executor.pausar();
          return { situacao: "erro", erro: r.erro, parar: true };
        }
        if (vivo && e.planos === planos) planos[k] = registrar(p, i, { situacao: r.situacao, mensagem: r.erro });
        return { situacao: r.situacao === "pulado" ? "ok" : "erro", erro: r.erro };
      },
    });
    executorAtual = executor;
    await executor.iniciar();
    rodando = false;
    if (vivo) desenhar();
  }

  novamente.addEventListener("click", () => void rodar());
  voltar.addEventListener("click", () => {
    vivo = false;
    executorAtual?.cancelar();
    acoes.voltar();
  });
  let executando = false;
  async function aoExecutar(): Promise<void> {
    // Sem a trava, dois cliques (ou clique e Ctrl+Enter) rodariam acoes.executar() duas vezes: dois lotes.
    if (executando || executar.disabled) return;
    executando = true;
    executar.disabled = true;
    const texto = resumoConfirmacao(planos, e.etapas);
    if (texto !== null && !(await deps.confirmar(texto, "Executar", "Voltar"))) {
      executando = false;
      desenhar();
      return;
    }
    vivo = false;
    executorAtual?.cancelar();
    acoes.executar();
  }
  executar.addEventListener("click", () => void aoExecutar());

  const raiz = h(
    "div",
    { class: "al-previa" },
    h("h2", { class: "al-titulo" }, "Prévia"),
    aviso,
    novamente,
    lista,
    total,
    dica,
    h("div", { class: "al-rodape" }, voltar, executar),
  );
  void doc;
  desenhar();
  void rodar();
  return raiz;
}
