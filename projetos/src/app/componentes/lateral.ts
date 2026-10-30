/**
 * O app no painel lateral (tela 3): no estreito o Gantt não cabe, então ele
 * abre na Agenda (o que fazer agora) e, em Projetos, mostra cartões e o
 * mini-Gantt do projeto aberto. Só desenho: quem age é o `AppProjetos`
 * (concluir, editar, o balão da etapa, "Abrir no painel").
 *
 * Cada controle que o redesenho troca leva um `data-foco` estável: o app põe o
 * foco de volta no mesmo controle depois de redesenhar (abrir um cartão pelo
 * teclado não joga o foco para o começo da página).
 */

import { avatar } from "@comum/ui/avatar";
import { h, icone } from "@comum/ui/dom";
import { linhasDoProjeto } from "../../gantt/linhas";
import { type LinhaMini, miniGantt } from "../../gantt/miniGantt";
import { rotuloDaVis } from "../../modelo/escopo";
import type { OrdemEtapas } from "../../modelo/operacoes";
import { ROTULO_MARCO, ROTULO_SITUACAO } from "../../modelo/situacao";
import type { DataISO } from "../../modelo/tipos";
import type { ProjetoNaTela } from "../dados";
import { iconeProjetos, iconeSituacao } from "../icones";
import { type GrupoAgenda, type ItemAgenda, linhaDoCartao } from "../lateral/agenda";
import type { EstadoSincronia } from "../sincronia";
import { indicadorDeSincronia } from "./abas";
import { barraDeProgresso } from "./tabelaEtapas";

export type ModoLateral = "agenda" | "projetos";

/** As chaves de foco que o app pede depois de navegar (o resto é o mesmo controle de antes do redesenho). */
export const FOCO_TITULO = "titulo";
export const focoDoProjeto = (id: string): string => `projeto:${id}`;

export interface OpcoesTopoLateral {
  modo: ModoLateral;
  sigla: string;
  sincronia: EstadoSincronia;
  menu: HTMLElement;
  aoModo(m: ModoLateral): void;
  aoNovo(): void;
}

/** Agenda | Projetos, a unidade, o estado da sincronia, "+" (novo projeto) e o menu. */
export function topoDoLateral(o: OpcoesTopoLateral): HTMLElement {
  const botao = (m: ModoLateral, rotulo: string) =>
    h("button", { type: "button", "aria-pressed": String(o.modo === m), "data-foco": `modo:${m}`, onclick: () => o.aoModo(m) }, rotulo);
  return h(
    "div",
    { class: "prj-lat-topo" },
    h(
      "div",
      { class: "spro-segmentado", role: "group", "aria-label": "Mostrar" },
      botao("agenda", "Agenda"),
      botao("projetos", "Projetos"),
    ),
    h("span", { class: "prj-lat-sigla", title: "Unidade da aba do SEI" }, icone("predio", 14), o.sigla),
    h(
      "span",
      { class: "prj-lat-dir" },
      indicadorDeSincronia(o.sincronia),
      h(
        "button",
        {
          type: "button",
          class: "spro-botao-icone pequeno",
          title: "Novo projeto",
          "aria-label": "Novo projeto",
          "data-foco": "novo",
          onclick: o.aoNovo,
        },
        icone("mais", 16),
      ),
      o.menu,
    ),
  );
}

export interface OpcoesAgenda {
  grupos: readonly GrupoAgenda[];
  soMinhas: boolean;
  /** Etapa com as ações abertas. */
  aberta: string | null;
  aoSoMinhas(v: boolean): void;
  aoAlternar(etapa: string): void;
  aoConcluir(i: ItemAgenda): void;
  aoEditar(i: ItemAgenda): void;
  aoVer(i: ItemAgenda): void;
}

function cartaoDaAgenda(i: ItemAgenda, o: OpcoesAgenda): HTMLElement {
  const e = i.etapa;
  const aberto = o.aberta === e.id;
  return h(
    "div",
    { class: `prj-lat-cartao${aberto ? " prj-lat-aberto" : ""}`, "data-etapa": e.id },
    h(
      "button",
      {
        type: "button",
        class: "prj-lat-alternar",
        "aria-expanded": String(aberto),
        title: aberto ? "Esconder as ações" : "Concluir, editar ou ver no projeto",
        "data-foco": `cartao:${e.id}`,
        onclick: () => o.aoAlternar(e.id),
      },
      h(
        "span",
        { class: "prj-lat-l1" },
        iconeSituacao(i.situacao, e.marco),
        h("span", { class: "prj-lat-nome" }, e.nome),
        e.responsavel ? avatar(e.responsavel.nome, { tamanho: 20 }) : null,
      ),
      h(
        "span",
        { class: "prj-lat-l2" },
        h("span", { class: "prj-lat-projeto" }, i.projeto.projeto.nome),
        h("span", { class: `prj-lat-data${i.situacao === "atrasada" ? " prj-lat-perigo" : ""}` }, i.prazo),
      ),
    ),
    aberto
      ? h(
          "div",
          { class: "prj-lat-acoes" },
          h(
            "button",
            { type: "button", class: "spro-botao primario pequeno", "data-foco": `concluir:${e.id}`, onclick: () => o.aoConcluir(i) },
            icone("check", 13),
            e.marco ? "Cumprido" : "Concluir",
          ),
          h(
            "button",
            { type: "button", class: "spro-botao pequeno", "data-foco": `editar:${e.id}`, onclick: () => o.aoEditar(i) },
            "Editar",
          ),
          h(
            "button",
            { type: "button", class: "spro-botao fantasma pequeno", "data-foco": `ver:${e.id}`, onclick: () => o.aoVer(i) },
            iconeProjetos("abrir", 13),
            "Ver no projeto",
          ),
        )
      : null,
  );
}

/** Todas | Só as minhas e os grupos com os cartões (clique abre as ações do cartão). */
export function montarAgenda(o: OpcoesAgenda): HTMLElement {
  const filtro = h(
    "div",
    { class: "spro-segmentado prj-lat-filtro", role: "group", "aria-label": "Etapas" },
    h(
      "button",
      { type: "button", "aria-pressed": String(!o.soMinhas), "data-foco": "filtro:todas", onclick: () => o.aoSoMinhas(false) },
      "Todas",
    ),
    h(
      "button",
      { type: "button", "aria-pressed": String(o.soMinhas), "data-foco": "filtro:minhas", onclick: () => o.aoSoMinhas(true) },
      "Só as minhas",
    ),
  );
  if (!o.grupos.length)
    return h(
      "div",
      { class: "prj-lat-agenda" },
      filtro,
      h(
        "p",
        { class: "prj-lat-nada" },
        o.soMinhas ? "Nada seu atrasado nem para os próximos 30 dias." : "Nada atrasado nem para os próximos 30 dias.",
      ),
    );
  return h(
    "div",
    { class: "prj-lat-agenda" },
    filtro,
    ...o.grupos.flatMap((g) => [
      h("h3", { class: `prj-lat-grupo prj-lat-grupo-${g.id}` }, g.titulo, h("span", { class: "prj-lat-conta" }, String(g.itens.length))),
      ...g.itens.map((i) => cartaoDaAgenda(i, o)),
    ]),
    h("p", { class: "prj-lat-dica" }, "Clique num cartão para concluir ou editar sem sair daqui."),
  );
}

/** Os cartões dos projetos ativos (escopo, nome, %, barra e a linha de resumo). */
export function montarProjetosLateral(o: { ativos: readonly ProjetoNaTela[]; hoje: DataISO; aoAbrir(id: string): void }): HTMLElement {
  return h(
    "div",
    { class: "prj-lat-projetos" },
    ...o.ativos.map((p) => {
      const linha = linhaDoCartao(p, o.hoje);
      const tom = linha.tom === "perigo" ? "var(--spro-perigo)" : linha.tom === "ok" ? "var(--spro-ok)" : "var(--spro-destaque)";
      return h(
        "button",
        {
          type: "button",
          class: "prj-lat-cartao prj-lat-cartao-projeto",
          "data-projeto": p.projeto.id,
          "data-foco": focoDoProjeto(p.projeto.id),
          onclick: () => o.aoAbrir(p.projeto.id),
        },
        h(
          "span",
          { class: "prj-lat-l1" },
          h("span", { class: "prj-lat-escopo", title: rotuloDaVis(p.vis) }, icone(p.vis === "unidade" ? "predio" : "pessoa", 15)),
          h("span", { class: "prj-lat-nome" }, p.projeto.nome),
          h("b", { class: "prj-lat-pct" }, `${p.resumo.progresso}%`),
        ),
        barraDeProgresso(p.resumo.progresso, tom),
        h("span", { class: `prj-lat-l3${linha.tom === "perigo" ? " prj-lat-perigo" : ""}` }, linha.texto),
      );
    }),
  );
}

export interface OpcoesMiniGantt {
  projeto: ProjetoNaTela;
  hoje: DataISO;
  ordem: OrdemEtapas;
  aoVoltar(): void;
  aoAbrirNoPainel(): void;
  aoEtapa(id: string, ancora: Element): void;
}

/** A situação da linha em palavras (o ícone e a cor da barra não chegam ao leitor de tela). */
function situacaoDaLinha(l: Extract<LinhaMini, { tipo: "etapa" }>): string {
  if (!l.marco) return ROTULO_SITUACAO[l.situacao];
  return ROTULO_MARCO[l.situacao === "concluida" ? "cumprido" : l.situacao === "atrasada" ? "atrasado" : "futuro"];
}

/** O projeto aberto no lateral: voltar, nome, "Abrir no painel" e o mini-Gantt (toque numa etapa = o balão). */
export function montarMiniGantt(o: OpcoesMiniGantt): HTMLElement {
  const p = o.projeto;
  const mg = miniGantt(
    linhasDoProjeto({ projeto: p.projeto.id, fases: p.fases, etapas: p.etapas }, { hoje: o.hoje, ordem: o.ordem, recolhidas: new Set() }),
    o.hoje,
  );
  const hoje = () => (mg.hoje === null ? null : h("span", { class: "prj-mg-hoje", style: `left:${mg.hoje}%` }));
  const eixo = h(
    "div",
    { class: "prj-mg-eixo" },
    ...mg.meses.map((m) => h("span", { class: "prj-mg-mes", style: `left:${m.pos}%` }, m.rotulo)),
    hoje(),
  );
  const linhas = mg.linhas.map((l) => {
    if (l.tipo === "fase") return h("div", { class: "prj-mg-fase" }, l.nome);
    const marca = l.marco
      ? h("b", { class: `prj-mg-marco prj-mg-${l.situacao}`, style: `left:${l.esquerda}%` })
      : h("i", { class: `prj-mg-barra prj-mg-${l.situacao}`, style: `left:${l.esquerda}%;width:${l.largura}%` });
    const linha: HTMLButtonElement = h(
      "button",
      {
        type: "button",
        class: "prj-mg-linha",
        "data-id": l.id,
        "data-foco": `etapa:${l.id}`,
        title: l.nome,
        "aria-label": `${l.nome} (${situacaoDaLinha(l).toLowerCase()})`,
        onclick: () => o.aoEtapa(l.id, linha),
      },
      h("span", { class: "prj-mg-nome" }, iconeSituacao(l.situacao, l.marco), h("span", {}, l.nome)),
      h("span", { class: "prj-mg-trilho" }, hoje(), marca),
    );
    return linha;
  });
  return h(
    "div",
    { class: "prj-lat-mini" },
    h(
      "div",
      { class: "prj-mg-cab" },
      h(
        "button",
        {
          type: "button",
          class: "spro-botao-icone pequeno",
          title: "Voltar aos projetos",
          "aria-label": "Voltar aos projetos",
          "data-foco": "voltar",
          onclick: o.aoVoltar,
        },
        iconeProjetos("voltar", 16),
      ),
      // O título recebe o foco ao abrir o projeto (o leitor de tela anuncia qual abriu); não entra no Tab.
      h("h3", { tabindex: "-1", "data-foco": FOCO_TITULO }, p.projeto.nome),
      h(
        "button",
        {
          type: "button",
          class: "spro-botao pequeno",
          title: "Abre o Gantt completo no Controle de Processos",
          "data-foco": "painel",
          onclick: o.aoAbrirNoPainel,
        },
        iconeProjetos("abrir", 13),
        "Abrir no painel",
      ),
    ),
    p.etapas.length
      ? h("div", { class: "prj-mg" }, h("div", { class: "prj-mg-meses" }, h("span", {}, "Etapa"), eixo), ...linhas)
      : h("p", { class: "prj-lat-nada" }, "Este projeto ainda não tem etapas. Abra no painel para planejar."),
    p.etapas.length
      ? h("p", { class: "prj-lat-dica" }, "Toque numa etapa para o mesmo balão do painel (progresso, concluir, editar).")
      : null,
  );
}
