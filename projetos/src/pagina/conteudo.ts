/**
 * O conteúdo do balão dos projetos na caixa e na árvore (tela 3): os projetos
 * em que o processo está ("Projeto · papel" e as etapas abertas com o prazo),
 * "Abrir no painel", na árvore o "Concluir com documento…" (documentos da
 * árvore JÁ aberta) e "Adicionar a um projeto" (Nova etapa | Ligar a uma
 * etapa | Processo do projeto). Na caixa o formulário fica atrás de
 * "Adicionar a outro projeto"; na árvore ele já aparece.
 *
 * Antes da primeira gravação num projeto de "Toda a unidade", o aviso único
 * do Texto Padrão da unidade aparece no próprio balão (`perguntarEntendi`, que
 * o consentimento da P4 chama: pagina/balaoProcesso.ts). O aviso mora num
 * lugar só dele: aparecer e sumir não refaz os formulários (o que foi digitado
 * fica); o "Agora não" deixa uma frase neutra (`MENSAGEM_AGORA_NAO`), não o
 * alerta de erro. Os redesenhos internos (abrir um formulário, "Cancelar")
 * põem o foco no primeiro controle do que apareceu (ou de volta no botão que o
 * abriu), e o segmentado "Como" muda no lugar. Nomes e textos entram como
 * texto (`h()`), nunca como HTML.
 */

import { h, icone } from "@comum/ui/dom";
import { MENSAGEM_SEM_ENTENDI } from "../app/colaboracao/consentir";
import type { ProjetoNaTela } from "../app/dados";
import { mensagemDoErro } from "../app/erros";
import { iconeProjetos, iconeSituacao } from "../app/icones";
import { dataNaFaixa, MAX_DIAS_UTEIS } from "../modelo/calendario";
import { LIMITES } from "../modelo/constantes";
import { rotuloDaVis } from "../modelo/escopo";
import { textoDoPrazo } from "../modelo/prazo";
import { situacaoEtapa } from "../modelo/situacao";
import type { DataISO, DocumentoSei, Etapa, Vinculo, Vis } from "../modelo/tipos";
import { ErroValidacao } from "../modelo/validacao";
import { chaveProtocolo, type VinculoProcesso, vinculoSemProcesso } from "../modelo/vinculos";
import { type ComoAdicionar, JA_E_O_PROCESSO, type PedidoAdicionar } from "./adicionar";

export interface ProcessoNaTela {
  protocolo: string;
  idProcedimento?: string;
  sigiloso: boolean;
  tipo?: string;
  /** Vazia no sigiloso (a caixa não a dá). */
  especificacao?: string;
}

export interface DocumentoDaArvore {
  numero: string;
  titulo: string;
}

export interface DadosConteudo {
  modo: "caixa" | "arvore";
  processo: ProcessoNaTela;
  vinculos: readonly VinculoProcesso[];
  /** Projetos ativos dos dois escopos da unidade (o "Adicionar"). */
  projetos: readonly ProjetoNaTela[];
  /** Árvore: os documentos dos nós já desenhados (o mais recente primeiro). */
  documentos: readonly DocumentoDaArvore[];
  hoje: DataISO;
  /** Frase depois de uma gravação ("Etapa … adicionada"). */
  mensagem?: string;
}

export interface AcoesConteudo {
  fechar(): void;
  abrirNoPainel(projeto: string, etapa?: string): void;
  concluir(vis: Vis, etapa: string, documento: DocumentoSei | undefined, data: string): Promise<string>;
  adicionar(p: PedidoAdicionar): Promise<string>;
}

const MAX_ETAPAS = 4;

/**
 * O "Agora não" no balão: nada foi gravado, sem alarme. A mensagem do app (`MENSAGEM_SEM_ENTENDI`) fala do seletor
 * "Só eu", que o balão não tem.
 */
export const MENSAGEM_AGORA_NAO = "Nada foi gravado: os projetos de “Toda a unidade” só mudam depois do “Entendi”.";

const semEntendi = (e: unknown): boolean =>
  e instanceof ErroValidacao && e.mensagens.length === 1 && e.mensagens[0] === MENSAGEM_SEM_ENTENDI;

/** Onde vai a resposta de uma gravação que não aconteceu: o erro (alerta) ou, no "Agora não", a frase neutra (status). */
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

/** Data que não existe (dado torto que chegou de fora) vai para o fim, sem lançar no `localeCompare`. */
const fimDe = (e: Etapa): string => (dataNaFaixa(e.fim) ? e.fim : "9999-12-31");

const abertas = (v: VinculoProcesso): Etapa[] => v.etapas.filter((e) => !e.concluidaEm).sort((a, b) => fimDe(a).localeCompare(fimDe(b)));

/** O nome sugerido da nova etapa (spec 3.3): a especificação ou o tipo; no sigiloso, nada (o nome vai ao Texto Padrão). */
export function nomePadrao(p: ProcessoNaTela): string {
  if (p.sigiloso) return "";
  return (p.especificacao || p.tipo || "").trim().slice(0, LIMITES.nome);
}

/**
 * O aviso do Texto Padrão da unidade no balão `raiz` (o conteúdo de `montarConteudo`): "Entendi" responde true e
 * "Agora não" false; `cancelar` (o balão fechou) responde false. Depois da resposta, o foco volta ao botão que pediu
 * a gravação. Quem grava o consentimento é quem pergunta (`consentidor`, app/colaboracao/consentir.ts).
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
        `Os projetos de “Toda a unidade” ficam guardados no próprio SEI, num Texto Padrão da ${sigla}: todos da unidade que usam o SEI Pro veem e editam. O número de processo sigiloso não vai.`,
      ),
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

export function montarConteudo(d: DadosConteudo, a: AcoesConteudo): HTMLElement {
  const raiz = h("div", { class: "pb" });
  let concluindo: string | null = null;
  let formAberto = d.modo === "arvore";
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

  const formConcluir = (v: VinculoProcesso, etapas: Etapa[]): HTMLElement => {
    const aviso = avisos();
    const selEtapa = h("select", { class: "spro-campo", name: "etapa" }, ...etapas.map((e, i) => opcao(e.id, e.nome, i === 0)));
    const selDoc = h(
      "select",
      { class: "spro-campo", name: "documento" },
      opcao("", d.documentos.length ? "(sem documento)" : "Nenhum documento na árvore", true),
      ...d.documentos.map((x) => opcao(x.numero, `${x.titulo} (${x.numero})`)),
    );
    const data = h("input", { class: "spro-campo", type: "date", name: "data", value: d.hoje });
    marcarFoco("concluir", etapas.length > 1 ? selEtapa : selDoc);
    const concluir = () => {
      const doc = d.documentos.find((x) => x.numero === selDoc.value);
      aviso.limpar();
      void a.concluir(v.vis, selEtapa.value, doc ? { numero: doc.numero, titulo: doc.titulo } : undefined, data.value).catch(aviso.mostrar);
    };
    return h(
      "div",
      { class: "pb-form" },
      etapas.length > 1 ? campo("Etapa", selEtapa) : h("p", { class: "pb-dica" }, `Concluir “${etapas[0]?.nome ?? ""}”`),
      campo("Documento", selDoc),
      campo("Concluída em", data),
      aviso.erro,
      aviso.nota,
      h(
        "div",
        { class: "pb-rod" },
        botao("Cancelar", "spro-botao pequeno", () => {
          concluindo = null;
          desenhar(`voltar:${v.vis}:${v.projeto.id}`);
        }),
        gravar("Concluir", concluir, icone("check", 13)),
      ),
    );
  };

  const botaoConcluir = (chave: string): HTMLElement => {
    const b = botao(
      "Concluir com documento…",
      "spro-botao primario pequeno",
      () => {
        concluindo = chave;
        desenhar("concluir");
      },
      icone("documento", 13),
    );
    marcarFoco(`voltar:${chave}`, b);
    return b;
  };

  const blocoVinculo = (v: VinculoProcesso, comPainel: boolean): HTMLElement => {
    const lista = abertas(v);
    const papel = v.papel === "projeto" ? "processo do projeto" : v.etapas.length === 1 ? "etapa" : "etapas";
    const chave = `${v.vis}:${v.projeto.id}`;
    return h(
      "div",
      { class: "pb-vinc", "data-projeto": v.projeto.id },
      h(
        "div",
        { class: "pb-proj", title: rotuloDaVis(v.vis) },
        icone(v.vis === "unidade" ? "predio" : "pessoa", 13),
        h("span", {}, `${v.projeto.nome} · ${papel}`),
      ),
      ...lista.slice(0, MAX_ETAPAS).map((e) => {
        const s = situacaoEtapa(e, d.hoje);
        return h(
          "div",
          { class: `pb-etapa${s === "atrasada" ? " pb-atrasada" : ""}`, "data-etapa": e.id },
          iconeSituacao(s, e.marco),
          h("span", { class: "pb-nome" }, e.nome),
          h("span", { class: "pb-data" }, textoDoPrazo(e, d.hoje)),
        );
      }),
      lista.length > MAX_ETAPAS ? h("div", { class: "pb-mais" }, `e mais ${lista.length - MAX_ETAPAS}`) : null,
      lista.length
        ? null
        : h("div", { class: "pb-vazio" }, v.etapas.length ? "Todas as etapas ligadas estão concluídas." : "Nenhuma etapa ligada ainda."),
      concluindo === chave
        ? formConcluir(v, lista)
        : d.modo === "arvore" || comPainel
          ? h(
              "div",
              { class: "pb-botoes" },
              d.modo === "arvore" && lista.length ? botaoConcluir(chave) : null,
              botao("Abrir no painel", "spro-botao pequeno", () => a.abrirNoPainel(v.projeto.id, lista[0]?.id), iconeProjetos("abrir", 13)),
            )
          : null,
    );
  };

  const formAdicionar = (): HTMLElement => {
    if (!d.projetos.length)
      return h(
        "div",
        { class: "pb-form" },
        h("p", { class: "pb-dica" }, "Crie um projeto no painel do Controle de Processos para ligar este processo."),
      );
    const ligado = new Set(d.vinculos.map((v) => `${v.vis}:${v.projeto.id}`));
    const valorDe = (p: ProjetoNaTela) => `${p.vis}:${p.projeto.id}`;
    const primeiro = d.projetos.find((p) => !ligado.has(valorDe(p))) ?? d.projetos[0]!;
    let escolhido = valorDe(primeiro);
    let como: ComoAdicionar = "etapa";
    const aviso = avisos();
    const selProjeto = h(
      "select",
      { class: "spro-campo", name: "projeto" },
      ...d.projetos.map((p) => opcao(valorDe(p), `${p.projeto.nome} (${rotuloDaVis(p.vis)})`, valorDe(p) === escolhido)),
    );
    const nome = h("input", {
      class: "spro-campo",
      name: "nome",
      maxlength: String(LIMITES.nome),
      placeholder: "Nome da etapa",
      value: nomePadrao(d.processo),
    });
    const inicio = h("input", { class: "spro-campo", type: "date", name: "inicio", value: d.hoje });
    const duracao = h("input", {
      class: "spro-campo",
      type: "number",
      name: "duracao",
      min: "1",
      max: String(MAX_DIAS_UTEIS),
      step: "1",
      value: "10",
    });
    marcarFoco("adicionar", selProjeto);
    const selEtapa = h("select", { class: "spro-campo", name: "etapaLigar" });
    const variavel = h("div", { class: "pb-form-como" });
    const projetoEscolhido = () => d.projetos.find((p) => valorDe(p) === escolhido) ?? primeiro;
    const comoBotoes: Array<[ComoAdicionar, string]> = [
      ["etapa", "Nova etapa"],
      ["ligar", "Ligar a uma etapa"],
      ["projeto", "Processo do projeto"],
    ];
    const chaveProc = chaveProtocolo(d.processo.protocolo);
    // Os botões do "Como" nascem uma vez: escolher muda só o aria-pressed (o foco fica no botão tocado).
    const botoesComo = comoBotoes.map(([v, rotulo]) =>
      h(
        "button",
        {
          type: "button",
          "aria-pressed": String(como === v),
          onclick: () => {
            como = v;
            pintarComo();
          },
        },
        rotulo,
      ),
    );
    const segmentado = h("div", { class: "spro-segmentado", role: "group", "aria-label": "Como" }, ...botoesComo);
    const pintarComo = () => {
      botoesComo.forEach((b, i) => {
        const pressionado = String(comoBotoes[i]?.[0] === como);
        if (b.getAttribute("aria-pressed") !== pressionado) b.setAttribute("aria-pressed", pressionado);
      });
      const p = projetoEscolhido();
      if (como === "etapa")
        variavel.replaceChildren(
          campo("Nome da etapa", nome),
          h("div", { class: "pb-linha2" }, campo("Início", inicio), campo("Duração (dias úteis)", duracao)),
        );
      else if (como === "ligar") {
        // Abertas e que ainda não são deste processo (nem pelo processo do projeto, que as sem processo próprio herdam).
        const deste = (v: Vinculo | undefined) =>
          !!chaveProc && typeof v?.protocolo === "string" && chaveProtocolo(v.protocolo) === chaveProc;
        const doProjeto = deste(p.projeto.processo);
        const livres = p.etapas.filter(
          (e) => !e.concluidaEm && (e.processo && !vinculoSemProcesso(e.processo) ? !deste(e.processo) : !doProjeto),
        );
        selEtapa.replaceChildren(
          ...livres.map((e, i) =>
            opcao(e.id, e.processo?.protocolo || e.processo?.sigiloso ? `${e.nome} (já tem outro processo)` : e.nome, i === 0),
          ),
        );
        variavel.replaceChildren(
          livres.length ? campo("Etapa", selEtapa) : h("p", { class: "pb-dica" }, "Este projeto não tem etapa aberta para ligar."),
        );
      } else {
        const atual = p.projeto.processo;
        variavel.replaceChildren(
          h(
            "p",
            { class: "pb-dica" },
            atual?.protocolo || atual?.sigiloso
              ? chaveProtocolo(atual.protocolo) === chaveProc && atual.protocolo
                ? JA_E_O_PROCESSO
                : `O projeto passa a ter este processo no lugar de ${atual.sigiloso ? "um processo sigiloso" : atual.protocolo}.`
              : "O projeto passa a ter este processo (as etapas sem processo próprio vêm junto).",
          ),
        );
      }
    };
    selProjeto.addEventListener("change", () => {
      escolhido = selProjeto.value;
      pintarComo();
    });
    pintarComo();
    const adicionar = () => {
      const p = projetoEscolhido();
      const processo: Vinculo = { protocolo: d.processo.protocolo };
      if (d.processo.idProcedimento) processo.idProcedimento = d.processo.idProcedimento;
      if (d.processo.sigiloso) processo.sigiloso = true;
      const pedido: PedidoAdicionar = { vis: p.vis, projeto: p.projeto.id, como, processo };
      if (como === "etapa") Object.assign(pedido, { nome: nome.value, inicio: inicio.value, duracao: Number(duracao.value) });
      if (como === "ligar") pedido.etapa = selEtapa.value;
      aviso.limpar();
      // Em "Toda a unidade", o repositório pergunta antes de gravar (o aviso no balão); "Agora não" volta como a frase neutra.
      void a.adicionar(pedido).catch(aviso.mostrar);
    };
    return h(
      "div",
      { class: "pb-form" },
      d.modo === "arvore" ? h("b", {}, "Adicionar a um projeto") : null,
      campo("Projeto", selProjeto),
      h("div", { class: "pb-campo" }, h("span", { class: "pb-rotulo" }, "Como"), segmentado),
      variavel,
      aviso.erro,
      aviso.nota,
      h("div", { class: "pb-rod" }, gravar("Adicionar", adicionar, icone("mais", 13))),
    );
  };

  /** `foco`: o redesenho interno que pediu (o foco vai ao que ele marcou; sem `foco`, o balão cuida). */
  function desenhar(foco: string | null = null): void {
    focoPedido = foco;
    alvoFoco = null;
    const n = d.vinculos.length;
    const titulo = d.modo === "arvore" ? "Projetos deste processo" : `Em ${n} ${n === 1 ? "projeto" : "projetos"}`;
    const umSo = d.modo === "caixa" && n === 1;
    const partes: Array<Node | null> = [
      h(
        "div",
        { class: "pb-cab" },
        h("span", { class: "pb-ic" }, icone("gantt", 17)),
        h("span", { class: "pb-tit" }, h("b", {}, titulo), h("small", {}, d.processo.protocolo)),
        h(
          "button",
          { type: "button", class: "spro-botao-icone pequeno", "aria-label": "Fechar", title: "Fechar (Esc)", onclick: () => a.fechar() },
          icone("fechar", 14),
        ),
      ),
      d.mensagem ? h("p", { class: "pb-ok", role: "status" }, d.mensagem) : null,
      slotPergunta,
      ...d.vinculos.map((v) => blocoVinculo(v, d.modo === "caixa" && n > 1)),
      d.modo === "arvore" && !n ? h("p", { class: "pb-dica" }, "Este processo ainda não está em nenhum projeto.") : null,
      formAberto
        ? formAdicionar()
        : h(
            "div",
            { class: "pb-rod" },
            botao(n ? "Adicionar a outro projeto" : "Adicionar a um projeto", "spro-botao pequeno", () => {
              formAberto = true;
              desenhar("adicionar");
            }),
            umSo
              ? botao(
                  "Abrir no painel",
                  "spro-botao primario pequeno",
                  () => a.abrirNoPainel(d.vinculos[0]!.projeto.id, abertas(d.vinculos[0]!)[0]?.id),
                  iconeProjetos("abrir", 13),
                )
              : null,
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
