/**
 * Barra de filtros (spec 5.1): busca, responsável, situação, prazo, prioridade e etiqueta. OU dentro do campo, E entre
 * campos (`modelo/filtro.ts`). O elemento fica o mesmo enquanto o filtro muda (a busca não perde o foco); o app só
 * chama `definir` e `opcoes`.
 */

import { type Combo, criarCombo, type OpcaoCombo } from "@comum/ui/combobox";
import { h, icone } from "@comum/ui/dom";
import type { UsuarioDaUnidade } from "@projetos/ponte/tipos";
import { chaveResponsavel, EU, type FiltroDemandas, SEM_RESPONSAVEL } from "../../modelo/filtro";
import type { Situacao } from "../../modelo/situacao";
import type { Prioridade } from "../../modelo/tipos";

export interface OpcoesFiltro {
  filtro: FiltroDemandas;
  usuarios: UsuarioDaUnidade[];
  etiquetas: string[];
  aoMudar(f: FiltroDemandas): void;
}

export interface FiltroMontado {
  el: HTMLElement;
  /** Põe o filtro na tela (o app o muda de fora, por exemplo ao limpar). */
  definir(f: FiltroDemandas): void;
  opcoes(usuarios: UsuarioDaUnidade[], etiquetas: string[]): void;
}

const SITUACOES: ReadonlyArray<[Situacao, string, string]> = [
  ["nao_iniciada", "Não iniciadas", "var(--spro-fraco)"],
  ["iniciada", "Iniciadas", "var(--spro-destaque)"],
  ["pausada", "Pausadas", "var(--spro-aviso)"],
  ["concluida", "Concluídas", "var(--spro-ok)"],
  ["avaliada", "Avaliadas", "var(--spro-novidade)"],
];
const PRAZOS: ReadonlyArray<[NonNullable<FiltroDemandas["prazo"]>, string]> = [
  ["atrasadas", "Atrasadas"],
  ["semana", "Esta semana"],
  ["mes", "Este mês"],
];
const PRIORIDADES: ReadonlyArray<[Prioridade, string]> = [
  ["urgente", "Urgente"],
  ["importante", "Importante"],
  ["normal", "Normal"],
];

/** Quantos critérios estão ligados (a busca conta). */
export function criteriosAtivos(f: FiltroDemandas): number {
  return (
    (f.responsaveis?.length ? 1 : 0) +
    (f.situacoes?.length ? 1 : 0) +
    (f.prazo ? 1 : 0) +
    (f.prioridades?.length ? 1 : 0) +
    (f.etiquetas?.length ? 1 : 0) +
    (f.busca?.trim() ? 1 : 0) +
    (f.mostrarArquivadas ? 1 : 0)
  );
}

const alternar = <T>(lista: readonly T[] | undefined, v: T): T[] =>
  (lista ?? []).includes(v) ? (lista ?? []).filter((x) => x !== v) : [...(lista ?? []), v];

function chip(rotulo: string, cor: string, ligado: boolean, aoClicar: () => void): HTMLButtonElement {
  return h(
    "button",
    { type: "button", class: "spro-chip", style: `--cor:${cor}`, "aria-pressed": String(ligado), onclick: aoClicar },
    rotulo,
  );
}

export function montarFiltro(o: OpcoesFiltro): FiltroMontado {
  let filtro = o.filtro;
  let usuarios = o.usuarios;
  let etiquetas = o.etiquetas;
  const mudar = (f: FiltroDemandas) => {
    filtro = f;
    pintar();
    o.aoMudar(f);
  };
  const busca = h("input", {
    type: "search",
    class: "spro-campo dem-busca",
    name: "busca",
    "aria-label": "Buscar demandas",
    placeholder: "Buscar por título, descrição ou processo",
  });
  busca.addEventListener("input", () => mudar({ ...filtro, busca: busca.value }));
  busca.addEventListener("keydown", (ev) => {
    if (ev.key !== "Escape" || !busca.value) return;
    ev.preventDefault();
    ev.stopPropagation();
    busca.value = "";
    mudar({ ...filtro, busca: "" });
  });

  const opcoesResp = (): OpcaoCombo[] => [
    { valor: EU, rotulo: "Só minhas", icone: "pessoa" },
    { valor: SEM_RESPONSAVEL, rotulo: "Sem responsável" },
    ...usuarios.map((u) => ({ valor: chaveResponsavel(u), rotulo: u.nome })),
  ];
  const responsavel: Combo = criarCombo({
    rotulo: "Responsável",
    multiplo: true,
    opcoes: opcoesResp,
    valor: filtro.responsaveis ?? [],
    vazio: "Responsável",
    busca: true,
    larguraLista: 260,
    aoMudar: (v) => mudar({ ...filtro, responsaveis: v }),
  });
  const etiqueta: Combo = criarCombo({
    rotulo: "Etiqueta",
    multiplo: true,
    opcoes: () => etiquetas.map((e) => ({ valor: e, rotulo: e })),
    valor: filtro.etiquetas ?? [],
    vazio: "Etiqueta",
    busca: true,
    larguraLista: 220,
    aoMudar: (v) => mudar({ ...filtro, etiquetas: v }),
  });
  const chips = h("div", { class: "dem-chips" });
  const limpar = h(
    "button",
    { type: "button", class: "spro-botao fantasma pequeno dem-limpar", onclick: () => mudar({}) },
    icone("fechar", 13),
    "Limpar filtros",
  );
  const igual = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x, i) => x === b[i]);
  function pintar(): void {
    chips.replaceChildren(
      ...SITUACOES.map(([s, r, cor]) =>
        chip(r, cor, !!filtro.situacoes?.includes(s), () => mudar({ ...filtro, situacoes: alternar(filtro.situacoes, s) })),
      ),
      h("span", { class: "dem-chips-sep", "aria-hidden": "true" }),
      ...PRAZOS.map(([p, r]) =>
        chip(r, p === "atrasadas" ? "var(--spro-perigo)" : "var(--spro-aviso)", filtro.prazo === p, () => {
          const { prazo: _, ...resto } = filtro;
          mudar(filtro.prazo === p ? resto : { ...resto, prazo: p });
        }),
      ),
      h("span", { class: "dem-chips-sep", "aria-hidden": "true" }),
      ...PRIORIDADES.map(([p, r]) =>
        chip(
          r,
          p === "urgente" ? "var(--spro-perigo)" : p === "importante" ? "var(--spro-aviso)" : "var(--spro-fraco)",
          !!filtro.prioridades?.includes(p),
          () => mudar({ ...filtro, prioridades: alternar(filtro.prioridades, p) }),
        ),
      ),
      h("span", { class: "dem-chips-sep", "aria-hidden": "true" }),
      chip("Arquivadas", "var(--spro-suave)", !!filtro.mostrarArquivadas, () =>
        mudar({ ...filtro, mostrarArquivadas: !filtro.mostrarArquivadas }),
      ),
    );
    limpar.hidden = criteriosAtivos(filtro) === 0;
    if (busca.value !== (filtro.busca ?? "")) busca.value = filtro.busca ?? "";
    if (!igual(responsavel.valor(), filtro.responsaveis ?? [])) responsavel.definir(filtro.responsaveis ?? [], false);
    if (!igual(etiqueta.valor(), filtro.etiquetas ?? [])) etiqueta.definir(filtro.etiquetas ?? [], false);
  }
  const el = h("div", { class: "dem-filtro" }, h("div", { class: "dem-filtro-campos" }, busca, responsavel.el, etiqueta.el, limpar), chips);
  pintar();
  return {
    el,
    definir(f) {
      filtro = f;
      pintar();
    },
    opcoes(u, e) {
      usuarios = u;
      etiquetas = e;
      responsavel.atualizar();
      etiqueta.atualizar();
    },
  };
}
