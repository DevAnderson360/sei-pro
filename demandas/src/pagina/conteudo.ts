/**
 * O conteúdo do balão "Demandas deste processo" (D17): as demandas já ligadas ao processo (situação, prazo e as ações
 * válidas: Iniciar, Concluir com este documento…, Abrir no painel), o formulário "Nova demanda deste processo" já
 * preenchido com o que a tela mostra (título, processo, responsável, prazo, prioridade, quem vê) e o "Concluir com este
 * documento", com o documento aberto no visualizador já nos campos.
 *
 * Antes da primeira gravação em "Toda a unidade", o aviso único do Texto Padrão da unidade aparece no próprio balão
 * (`perguntarEntendi`, que o consentimento chama: pagina/balaoDemandas.ts). Nomes e textos entram como texto (`h()`),
 * nunca como HTML.
 */

import { h, icone } from "@comum/ui/dom";
import type { UsuarioDaUnidade } from "@projetos/ponte/tipos";
import type { DemandaNaTela } from "../app/dados";
import { dataLonga, rotuloDaSituacao, rotuloDoPrazo, tempoParaCampo } from "../app/formato";
import { LIMITES } from "../modelo/constantes";
import { rotuloDaVis } from "../modelo/escopo";
import type { DataISO, Prioridade, Responsavel, Vis } from "../modelo/tipos";
import { type FormConclusao, mensagemDoErro, type PedidoNova, tituloSugerido } from "./acoes";
import { semEntendi } from "./consentir";
import type { DocumentoAberto, ProcessoNaTela } from "./deteccao";

export interface DadosConteudo {
  processo: ProcessoNaTela;
  documento: DocumentoAberto | null;
  /** As demandas não arquivadas dos dois escopos que têm este processo. */
  ligadas: readonly DemandaNaTela[];
  hoje: DataISO;
  eu: Responsavel;
  /** A lista parcial de usuários da unidade (o próprio usuário primeiro). */
  usuarios: readonly UsuarioDaUnidade[];
  /** Frase depois de uma gravação ("Demanda criada"). */
  mensagem?: string;
}

export interface AcoesConteudo {
  fechar(): void;
  abrirNoPainel(id: string): void;
  criar(p: PedidoNova): Promise<string>;
  iniciar(vis: Vis, id: string): Promise<string>;
  concluir(vis: Vis, id: string, f: FormConclusao): Promise<string>;
}

const MAX_LISTA = 5;

/** O "Agora não" no balão: nada foi gravado, sem alarme. */
export const MENSAGEM_AGORA_NAO = "Nada foi gravado: as demandas de “Toda a unidade” só mudam depois do “Entendi”.";

function avisos(): { erro: HTMLElement; nota: HTMLElement; limpar(): void; mostrar(e: unknown): void } {
  const erro = h("p", { class: "pb-erro", role: "alert" });
  const nota = h("p", { class: "pb-nota", role: "status" });
  return {
    erro,
    nota,
    limpar() {
      erro.textContent = "";
      nota.textContent = "";
    },
    mostrar(e) {
      if (semEntendi(e)) nota.textContent = MENSAGEM_AGORA_NAO;
      else erro.textContent = mensagemDoErro(e);
    },
  };
}

const focar = (el: HTMLElement | null | undefined) => el?.focus?.({ preventScroll: true });

/** O botão de cada conteúdo que pediu a última gravação: o foco volta a ele depois da resposta ao aviso. */
const ultimaAcao = new WeakMap<HTMLElement, HTMLElement>();

const botao = (rotulo: string, classe: string, fazer: () => void, ...antes: Node[]) =>
  h("button", { type: "button", class: classe, onclick: fazer }, ...antes, rotulo);

const campo = (rotulo: string, controle: HTMLElement) =>
  h("label", { class: "pb-campo" }, h("span", { class: "pb-rotulo" }, rotulo), controle);

// O atributo (e não a propriedade): é a escolha inicial no navegador e o que o linkedom das provas lê.
const opcao = (valor: string, rotulo: string, escolhida = false) => h("option", { value: valor, selected: escolhida }, rotulo);

/**
 * O aviso do Texto Padrão da unidade no balão `raiz`: "Entendi" responde true e "Agora não" false; `cancelar` (o balão
 * fechou) responde false. Depois da resposta, o foco volta ao botão que pediu a gravação.
 */
export function perguntarEntendi(raiz: HTMLElement, sigla: string): { resposta: Promise<boolean>; cancelar(): void } {
  let responder: (sim: boolean) => void = () => undefined;
  const resposta = new Promise<boolean>((ok) => {
    responder = ok;
  });
  const slot = raiz.querySelector<HTMLElement>(".pb-slot");
  if (!slot) {
    responder(false);
    return { resposta, cancelar: () => undefined };
  }
  let respondida = false;
  const fim = (sim: boolean) => {
    if (respondida) return;
    respondida = true;
    slot.replaceChildren();
    responder(sim);
    const volta = ultimaAcao.get(raiz);
    if (volta?.isConnected) volta.focus?.({ preventScroll: true });
  };
  const entendi = botao("Entendi", "spro-botao primario pequeno", () => fim(true));
  slot.replaceChildren(
    h(
      "div",
      { class: "pb-pergunta", role: "alert" },
      h(
        "p",
        {},
        `As demandas de “Toda a unidade” ficam guardadas no próprio SEI, num Texto Padrão da ${sigla}: todos da unidade que usam o SEI Pro veem e editam. O número de processo sigiloso não vai.`,
      ),
      h("p", {}, AVISO_SIGILO),
      h(
        "div",
        { class: "pb-botoes" },
        entendi,
        botao("Agora não", "spro-botao pequeno", () => fim(false)),
      ),
    ),
  );
  entendi.focus?.({ preventScroll: true });
  return { resposta, cancelar: () => fim(false) };
}

/** O mesmo aviso do app: o título e a descrição vão em claro ao Texto Padrão. */
const AVISO_SIGILO = "Não escreva dados sigilosos no título ou na descrição: ficam no Texto Padrão e todos da unidade os leem.";

/** Os usuários da lista, sem repetir, com o próprio usuário primeiro. */
function responsaveisDaLista(eu: Responsavel, usuarios: readonly UsuarioDaUnidade[]): Responsavel[] {
  const vistos = new Set<string>();
  const saida: Responsavel[] = [];
  for (const u of [eu, ...usuarios]) {
    const k = (u.login ?? u.nome).trim().toLowerCase();
    if (!k || !u.nome.trim() || vistos.has(k)) continue;
    vistos.add(k);
    saida.push(u.login ? { login: u.login, nome: u.nome } : { nome: u.nome });
  }
  return saida;
}

export function montarConteudo(d: DadosConteudo, a: AcoesConteudo): HTMLElement {
  const raiz = h("div", { class: "pb" });
  let concluindo: string | null = null;
  let formAberto = d.ligadas.length === 0;
  const slotPergunta = h("div", { class: "pb-slot" });
  /** O que recebe o foco depois do redesenho interno em curso (o primeiro controle do que abriu, ou a volta). */
  let focoPedido: string | null = null;
  let alvoFoco: HTMLElement | null = null;
  const marcarFoco = (chave: string, el: HTMLElement) => {
    if (focoPedido === chave && !alvoFoco) alvoFoco = el;
  };

  /** Botão que grava: lembra quem pediu (o foco volta a ele depois do aviso da unidade). */
  const gravar = (rotulo: string, fazer: () => void, ...antes: Node[]) => {
    const b: HTMLButtonElement = botao(
      rotulo,
      "spro-botao primario pequeno",
      () => {
        ultimaAcao.set(raiz, b);
        fazer();
      },
      ...antes,
    );
    return b;
  };

  const chaveDe = (x: DemandaNaTela) => `${x.vis}:${x.demanda.id}`;

  const formConcluir = (x: DemandaNaTela): HTMLElement => {
    const aviso = avisos();
    const data = h("input", { class: "spro-campo", type: "date", name: "data", value: d.hoje });
    const tempo = h("input", {
      class: "spro-campo",
      type: "text",
      name: "tempo",
      placeholder: "1h30",
      value: tempoParaCampo(x.demanda.tempoGastoMin),
    });
    const observacao = h("textarea", { class: "spro-campo", name: "observacao", rows: "2", maxlength: String(LIMITES.observacao) });
    const numero = h("input", {
      class: "spro-campo",
      type: "text",
      name: "numero",
      inputmode: "numeric",
      placeholder: "Número SEI",
      maxlength: "30",
      value: d.documento?.numero ?? "",
    });
    // O sigilo não pede o título do documento no formulário (vai ao Texto Padrão da unidade, cortado no sigiloso).
    const titulo = h("input", {
      class: "spro-campo",
      type: "text",
      name: "titulo",
      maxlength: String(LIMITES.titulo),
      placeholder: "Título do documento",
      value: d.documento?.titulo ?? "",
    });
    marcarFoco(`concluir:${chaveDe(x)}`, data);
    const concluir = () => {
      aviso.limpar();
      void a
        .concluir(x.vis, x.demanda.id, {
          data: data.value,
          tempo: tempo.value,
          observacao: observacao.value,
          numero: numero.value,
          titulo: titulo.value,
        })
        .catch(aviso.mostrar);
    };
    return h(
      "div",
      { class: "pb-form", "data-concluir": x.demanda.id },
      h("b", {}, "Concluir com este documento"),
      h("div", { class: "pb-linha2" }, campo("Concluída em", data), campo("Tempo gasto (opcional)", tempo)),
      campo("Número SEI do documento entregue", numero),
      campo("Título do documento (opcional)", titulo),
      campo("Observação (opcional)", observacao),
      d.documento ? null : h("p", { class: "pb-dica" }, "Nenhum documento aberto: informe o número ou deixe em branco."),
      aviso.erro,
      aviso.nota,
      h(
        "div",
        { class: "pb-rod" },
        botao("Voltar", "spro-botao pequeno", () => {
          concluindo = null;
          desenhar(`voltar:${chaveDe(x)}`);
        }),
        gravar("Concluir", concluir, icone("check", 13)),
      ),
    );
  };

  const blocoDemanda = (x: DemandaNaTela): HTMLElement => {
    const chave = chaveDe(x);
    const aviso = avisos();
    const dem = x.demanda;
    const emAndamento = x.situacao === "iniciada" || x.situacao === "pausada";
    const botoes: HTMLElement[] = [];
    if (x.situacao === "nao_iniciada")
      botoes.push(
        gravar("Iniciar", () => {
          aviso.limpar();
          void a.iniciar(x.vis, dem.id).catch(aviso.mostrar);
        }),
      );
    if (emAndamento) {
      const b = botao(
        "Concluir com este documento…",
        "spro-botao primario pequeno",
        () => {
          concluindo = chave;
          desenhar(`concluir:${chave}`);
        },
        icone("documento", 13),
      );
      marcarFoco(`voltar:${chave}`, b);
      botoes.push(b);
    }
    botoes.push(botao("Abrir no painel", "spro-botao pequeno", () => a.abrirNoPainel(dem.id)));
    return h(
      "div",
      { class: `pb-vinc${x.prazo === "atrasada" ? " pb-atrasada" : ""}`, "data-demanda": dem.id },
      h(
        "div",
        { class: "pb-proj", title: rotuloDaVis(x.vis) },
        icone(x.vis === "unidade" ? "predio" : "pessoa", 13),
        h("span", {}, `${rotuloDaSituacao[x.situacao]}${dem.responsavel ? ` · ${dem.responsavel.nome}` : ""}`),
      ),
      h(
        "div",
        { class: "pb-etapa" },
        h("span", { class: "pb-nome" }, dem.titulo),
        h("span", { class: "pb-data" }, `${rotuloDoPrazo(x, d.hoje)} · ${dataLonga(dem.prazo)}`),
      ),
      concluindo === chave ? formConcluir(x) : h("div", { class: "pb-botoes" }, ...botoes),
      concluindo === chave ? null : aviso.erro,
      concluindo === chave ? null : aviso.nota,
    );
  };

  const formNova = (): HTMLElement => {
    const aviso = avisos();
    const responsaveis = responsaveisDaLista(d.eu, d.usuarios);
    const titulo = h("input", {
      class: "spro-campo",
      type: "text",
      name: "titulo",
      maxlength: String(LIMITES.titulo),
      placeholder: "Título da demanda",
      value: tituloSugerido(d.processo, d.documento),
    });
    const selResp = h(
      "select",
      { class: "spro-campo", name: "responsavel" },
      ...responsaveis.map((r, i) => opcao(String(i), i === 0 ? `${r.nome} (eu)` : r.nome, i === 0)),
    );
    const prazo = h("input", { class: "spro-campo", type: "date", name: "prazo", value: d.hoje });
    const selPrio = h(
      "select",
      { class: "spro-campo", name: "prioridade" },
      opcao("normal", "Normal", true),
      opcao("importante", "Importante"),
      opcao("urgente", "Urgente"),
    );
    let vis: Vis = "unidade";
    const comoBotoes: Array<[Vis, string]> = [
      ["unidade", "Toda a unidade"],
      ["eu", "Só eu"],
    ];
    const botoesVis = comoBotoes.map(([v, rotulo]) =>
      h(
        "button",
        {
          type: "button",
          "aria-pressed": String(vis === v),
          onclick: () => {
            vis = v;
            pintarVis();
          },
        },
        rotulo,
      ),
    );
    const pintarVis = () => {
      botoesVis.forEach((b, i) => {
        const pressionado = String(comoBotoes[i]?.[0] === vis);
        if (b.getAttribute("aria-pressed") !== pressionado) b.setAttribute("aria-pressed", pressionado);
      });
      // Só eu: o responsável é o próprio usuário (a escolha é ignorada ao gravar).
      if (vis === "eu") selResp.setAttribute("disabled", "");
      else selResp.removeAttribute("disabled");
    };
    marcarFoco("nova", titulo);
    const criar = () => {
      aviso.limpar();
      const resp = responsaveis[Number(selResp.value)] ?? d.eu;
      void a
        .criar({
          vis,
          titulo: titulo.value,
          prazo: prazo.value,
          prioridade: selPrio.value as Prioridade,
          ...(vis === "unidade" ? { responsavel: resp } : {}),
          processo: d.processo,
        })
        .catch(aviso.mostrar);
    };
    titulo.addEventListener("keydown", (ev) => {
      if (ev.key !== "Enter") return;
      ev.preventDefault();
      criar();
    });
    const forma = h(
      "div",
      { class: "pb-form", "data-nova": "1" },
      h("b", {}, "Nova demanda deste processo"),
      campo("Título", titulo),
      d.processo.sigiloso
        ? h("p", { class: "pb-dica" }, "Processo sigiloso: o número dele não vai ao Texto Padrão da unidade.")
        : h("p", { class: "pb-dica" }, `Processo ${d.processo.protocolo}`),
      h("div", { class: "pb-linha2" }, campo("Responsável", selResp), campo("Prazo", prazo)),
      h("div", { class: "pb-linha2" }, campo("Prioridade", selPrio)),
      h(
        "div",
        { class: "pb-campo" },
        h("span", { class: "pb-rotulo" }, "Quem vê"),
        h("div", { class: "spro-segmentado", role: "group", "aria-label": "Quem vê" }, ...botoesVis),
      ),
      aviso.erro,
      aviso.nota,
      h("div", { class: "pb-rod" }, gravar("Criar demanda", criar, icone("mais", 13))),
    );
    pintarVis();
    return forma;
  };

  /** `foco`: o redesenho interno que pediu (o foco vai ao que ele marcou; sem `foco`, o balão cuida). */
  function desenhar(foco: string | null = null): void {
    focoPedido = foco;
    alvoFoco = null;
    const n = d.ligadas.length;
    const partes: Array<Node | null> = [
      h(
        "div",
        { class: "pb-cab" },
        h("span", { class: "pb-ic" }, icone("demandas", 17)),
        h("span", { class: "pb-tit" }, h("b", {}, "Demandas deste processo"), h("small", {}, d.processo.protocolo)),
        h(
          "button",
          { type: "button", class: "spro-botao-icone pequeno", "aria-label": "Fechar", title: "Fechar (Esc)", onclick: () => a.fechar() },
          icone("fechar", 14),
        ),
      ),
      d.mensagem ? h("p", { class: "pb-ok", role: "status" }, d.mensagem) : null,
      slotPergunta,
      ...d.ligadas.slice(0, MAX_LISTA).map(blocoDemanda),
      n > MAX_LISTA ? h("div", { class: "pb-mais" }, `e mais ${n - MAX_LISTA}`) : null,
      n ? null : h("p", { class: "pb-dica" }, "Este processo ainda não tem demanda."),
      formAberto
        ? formNova()
        : h(
            "div",
            { class: "pb-rod" },
            botao("Nova demanda deste processo", "spro-botao pequeno", () => {
              formAberto = true;
              desenhar("nova");
            }),
          ),
    ];
    raiz.replaceChildren(...partes.filter((x): x is Node => x !== null));
    if (focoPedido) focar(alvoFoco);
    focoPedido = null;
    alvoFoco = null;
  }

  desenhar();
  return raiz;
}
