/**
 * Filtro das etapas (tela 1): botão "Filtro" (com a contagem dos critérios
 * ligados) que abre um popover com os chips de situação e os campos
 * Responsável, Fase e Etiqueta (OU dentro do campo, E entre campos). O popover
 * fica aberto enquanto o usuário mexe; o app redesenha só a vista.
 */

import { normalizarTexto } from "@comum/texto";
import { type Combo, criarCombo, type OpcaoCombo } from "@comum/ui/combobox";
import { h, icone } from "@comum/ui/dom";
import { SEM_FASE } from "../../modelo/constantes";
import {
  type ChipSituacao,
  chaveResponsavel,
  contarChips,
  criteriosAtivos,
  type Eu,
  FILTRO_VAZIO,
  type FiltroEtapas,
  filtrarEtapas,
  filtroNoContexto,
} from "../../modelo/filtro";
import type { DataISO, Etapa, Fase } from "../../modelo/tipos";
import type { ProjetoNaTela } from "../dados";
import { abrirCamada, type Camada } from "./camada";

export interface OpcoesFiltro {
  filtro: FiltroEtapas;
  /** Base das contagens e das opções: as etapas do projeto (ou de todos os ativos, no Todos). */
  etapas: readonly Etapa[];
  /** Fases do projeto; sem elas (Todos), o campo Fase não aparece (e só "Sem fase" vale do filtro de fase). */
  fases?: readonly Fase[];
  hoje: DataISO;
  aoMudar(f: FiltroEtapas): void;
}

export interface BotaoFiltro {
  el: HTMLButtonElement;
  /** Atualiza a contagem do botão (e o popover, se aberto). */
  definir(f: FiltroEtapas): void;
  fechar(): void;
}

const CHIPS: ReadonlyArray<[ChipSituacao, string, string]> = [
  ["atrasadas", "Atrasadas", "var(--spro-perigo)"],
  ["andamento", "Em andamento", "var(--spro-destaque)"],
  ["semana", "Vence nesta semana", "var(--spro-aviso)"],
  ["proximos30", "Próximos 30 dias", "var(--spro-aviso)"],
];

function chip(rotulo: string, cor: string, ligado: boolean, aoClicar: () => void): HTMLButtonElement {
  return h(
    "button",
    { type: "button", class: "spro-chip", style: `--cor:${cor}`, "aria-pressed": String(ligado), onclick: aoClicar },
    rotulo,
  );
}

function opcoesResponsavel(etapas: readonly Etapa[]): OpcaoCombo[] {
  const mapa = new Map<string, OpcaoCombo>();
  for (const e of etapas) {
    if (!e.responsavel) continue;
    const k = chaveResponsavel(e.responsavel);
    const o = mapa.get(k) ?? { valor: k, rotulo: e.responsavel.nome, contagem: 0 };
    o.contagem = (o.contagem ?? 0) + 1;
    mapa.set(k, o);
  }
  return [...mapa.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

function opcoesEtiqueta(etapas: readonly Etapa[], extras: readonly string[] = []): OpcaoCombo[] {
  const mapa = new Map<string, OpcaoCombo>();
  for (const t of [...etapas.flatMap((e) => e.etiquetas), ...extras]) {
    const k = normalizarTexto(t);
    const o = mapa.get(k) ?? { valor: t, rotulo: t, contagem: 0 };
    o.contagem = (o.contagem ?? 0) + 1;
    mapa.set(k, o);
  }
  return [...mapa.values()].sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
}

export function criarBotaoFiltro(o: OpcoesFiltro): BotaoFiltro {
  let filtro = o.filtro;
  let camada: Camada | null = null;
  const el = h("button", { type: "button", class: "spro-botao prj-filtro", "aria-haspopup": "dialog", "aria-expanded": "false" });
  // O que vale aqui: fases de outro projeto não contam nem aparecem marcadas (`filtroNoContexto`).
  const efetivo = () => filtroNoContexto(filtro, o.fases);
  const pintarBotao = () => {
    const n = criteriosAtivos(efetivo());
    el.replaceChildren(icone("filtro", 15), n ? `Filtro · ${n}` : "Filtro");
    el.classList.toggle("prj-filtro-ativo", n > 0);
  };
  const mudar = (f: FiltroEtapas) => {
    filtro = f;
    o.aoMudar(f);
  };
  const conteudo = h("div", {});
  const caixaChips = h("div", { class: "prj-chips" });
  const caixaLimpar = h("div", { class: "prj-filtro-limpar-caixa" });
  let combos: Array<{ combo: Combo; valor: () => readonly string[] }> = [];
  /** Só os chips, o "Limpar filtro" e os valores dos combos: os combos ficam (a lista aberta é ancorada neles). */
  const repintar = () => {
    const n = contarChips(o.etapas, o.hoje);
    const alternar = (s: ChipSituacao) =>
      mudar({ ...filtro, situacoes: filtro.situacoes.includes(s) ? filtro.situacoes.filter((x) => x !== s) : [...filtro.situacoes, s] });
    caixaChips.replaceChildren(
      ...CHIPS.map(([s, rotulo, cor]) => chip(`${rotulo} · ${n[s]}`, cor, filtro.situacoes.includes(s), () => alternar(s))),
      chip("Concluídas", "var(--spro-ok)", filtro.mostrarConcluidas, () =>
        mudar({ ...filtro, mostrarConcluidas: !filtro.mostrarConcluidas }),
      ),
      chip("Só as minhas", "var(--spro-novidade)", filtro.soMinhas, () => mudar({ ...filtro, soMinhas: !filtro.soMinhas })),
    );
    caixaLimpar.replaceChildren(
      ...(criteriosAtivos(efetivo())
        ? [
            h(
              "button",
              { type: "button", class: "spro-botao fantasma pequeno prj-filtro-limpar", onclick: () => mudar(FILTRO_VAZIO) },
              "Limpar filtro",
            ),
          ]
        : []),
    );
    for (const c of combos) {
      const v = c.valor();
      const atual = c.combo.valor();
      if (v.length !== atual.length || v.some((x, k) => x !== atual[k])) c.combo.definir([...v], false);
    }
  };
  /** Monta tudo (ao abrir o popover). */
  const desenhar = () => {
    const campo = (rotulo: string, opcoes: OpcaoCombo[], valor: () => readonly string[], aoMudar: (v: string[]) => void) => {
      const combo = criarCombo({ rotulo, opcoes, valor: [...valor()], multiplo: true, vazio: rotulo, aoMudar, larguraLista: 240 });
      combos.push({ combo, valor });
      return combo.el;
    };
    const fases: OpcaoCombo[] | null = o.fases
      ? [...o.fases.map((f) => ({ valor: f.id, rotulo: f.nome })), { valor: SEM_FASE, rotulo: "Sem fase" }]
      : null;
    combos = [];
    conteudo.replaceChildren(
      h("h4", {}, "Mostrar"),
      caixaChips,
      h("h4", {}, "Por campo"),
      h(
        "div",
        { class: "prj-filtro-campos" },
        campo(
          "Responsável",
          opcoesResponsavel(o.etapas),
          () => filtro.responsaveis,
          (v) => mudar({ ...filtro, responsaveis: v }),
        ),
        fases
          ? campo(
              "Fase",
              fases,
              () => efetivo().fases,
              (v) => mudar({ ...filtro, fases: v }),
            )
          : null,
        campo(
          "Etiqueta",
          opcoesEtiqueta(o.etapas),
          () => filtro.etiquetas,
          (v) => mudar({ ...filtro, etiquetas: v }),
        ),
      ),
      caixaLimpar,
    );
    repintar();
  };
  const fechar = () => camada?.fechar();
  el.addEventListener("click", () => {
    if (camada) return fechar();
    desenhar();
    el.setAttribute("aria-expanded", "true");
    camada = abrirCamada(el, conteudo, {
      classe: "prj-filtro-pop",
      largura: 320,
      rotulo: "Filtro das etapas",
      aoFechar: () => {
        camada = null;
        el.setAttribute("aria-expanded", "false");
      },
    });
  });
  pintarBotao();
  return {
    el,
    definir(f) {
      filtro = f;
      pintarBotao();
      if (camada) repintar();
    },
    fechar,
  };
}

/**
 * Portfólio filtrado: o projeto passa se alguma etapa passa. A etiqueta do
 * PROJETO (o "Tipo de projeto" do legado) também vale para o campo Etiqueta.
 */
export function projetoNoFiltro(p: Pick<ProjetoNaTela, "projeto" | "etapas">, f: FiltroEtapas, hoje: DataISO, eu: Eu): boolean {
  if (!criteriosAtivos(f)) return true;
  const alvo = new Set(f.etiquetas.map(normalizarTexto));
  const doProjeto = p.projeto.etiquetas.some((t) => alvo.has(normalizarTexto(t)));
  const resto = doProjeto ? { ...f, etiquetas: [] } : f;
  return !criteriosAtivos(resto) || filtrarEtapas(p.etapas, resto, hoje, eu).length > 0;
}
