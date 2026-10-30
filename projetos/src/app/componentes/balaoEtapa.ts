/**
 * Balão da etapa (tela 1): o dia a dia sem abrir formulário. Situação (com os
 * dias úteis de atraso), nome, "Fase · Responsável", datas e duração em dias
 * úteis, aviso de replanejamento, checklist, documento e processo (links que
 * abrem no SEI; o documento e o processo sigilosos cujo número este computador
 * não tem aparecem só como texto, sem link), régua de progresso (só com medida
 * manual) e as ações: Concluir / Marcar como cumprido / Reabrir, Editar e o
 * menu (duplicar, mover de fase, histórico, excluir). Esc ou clique fora fecha. A régua grava só
 * quando o usuário para de mexer (cada seta do teclado é um `change`) ou
 * quando o balão fecha.
 */

import { h, icone } from "@comum/ui/dom";
import { criarMenu, type EntradaMenu } from "@comum/ui/menu";
import { diasUteisDeAtraso } from "../../modelo/alertas";
import { duracaoUteis } from "../../modelo/calendario";
import { desvioUteis, replanejada } from "../../modelo/linhaDeBase";
import { progressoDaEtapa } from "../../modelo/progresso";
import { documentoSemNumero, vinculoSemNumero } from "../../modelo/sigilo";
import { situacaoEtapa } from "../../modelo/situacao";
import type { DataISO, Etapa, Vinculo } from "../../modelo/tipos";
import type { ProjetoNaTela } from "../dados";
import { dataLonga, textoDiasUteis } from "../formato";
import { iconeProjetos } from "../icones";
import { abrirCamada, type Camada, type OpcoesCamada } from "./camada";
import { pilulaDaSituacao } from "./tabelaEtapas";

export interface DadosBalao {
  etapa: Etapa;
  projeto: ProjetoNaTela;
  hoje: DataISO;
}

export interface AcoesBalao {
  /** Concluir (ou "Marcar como cumprido", no marco). */
  aoConcluir(): void;
  aoReabrir(): void;
  aoEditar(secao?: "historico"): void;
  aoProgresso(pct: number): void;
  aoAbrirDocumento(numero: string): void;
  aoAbrirProcesso(v: Vinculo, ev: MouseEvent): void;
  aoDuplicar(): void;
  aoMoverFase(faseId: string | undefined): void;
  aoExcluir(): void;
}

const linha = (ic: Element, ...conteudo: Array<Node | string | null>) =>
  h("div", { class: "prj-balao-li" }, ic, h("div", {}, ...conteudo.filter((c): c is Node | string => c !== null)));

const link = (texto: string, titulo: string, fazer: (ev: MouseEvent) => void) =>
  h(
    "a",
    {
      href: "#",
      title: titulo,
      onclick: (ev: Event) => {
        ev.preventDefault();
        fazer(ev as MouseEvent);
      },
    },
    texto,
  );

/**
 * O documento da etapa: o número como link; o marcador do texto (documento de processo sigiloso sem o número)
 * só como texto, sem número e sem link; o número vazio sem a marca é "sem documento" e não aparece.
 */
function linhaDoDocumento(e: Etapa, a: AcoesBalao): HTMLElement | null {
  const d = e.documento;
  if (documentoSemNumero(d))
    return linha(
      icone("cadeado", 15),
      h(
        "span",
        { title: "O número deste documento não está neste computador: o SEI Pro não o envia aos colegas." },
        "Documento de processo sigiloso",
      ),
    );
  if (!d?.numero) return null;
  const numero = d.numero;
  return linha(
    icone("documento", 15),
    link(d.titulo ? `${d.titulo} (SEI ${numero})` : `Documento SEI ${numero}`, "Abrir o documento no SEI", () =>
      a.aoAbrirDocumento(numero),
    ),
  );
}

/**
 * O processo da etapa (o próprio ou, sem ele, o do projeto): o número como link; o vínculo vazio do texto
 * (processo sigiloso sem o número) só como texto, sem link. A etapa com o próprio vínculo vazio não mostra o
 * processo do projeto no lugar: ela é de outro processo, que este computador não conhece.
 */
function linhaDoProcesso(e: Etapa, d: DadosBalao, a: AcoesBalao): HTMLElement | null {
  const v = e.processo?.protocolo || vinculoSemNumero(e.processo) ? e.processo : d.projeto.projeto.processo;
  if (vinculoSemNumero(v))
    return linha(
      icone("cadeado", 15),
      h("span", { title: "O número deste processo não está neste computador: o SEI Pro não o envia aos colegas." }, "Processo sigiloso"),
    );
  if (!v?.protocolo) return null;
  const processo = v;
  return linha(
    icone(processo.sigiloso ? "cadeado" : "pasta", 15),
    link(processo.protocolo, "Abrir o processo", (ev) => a.aoAbrirProcesso(processo, ev)),
  );
}

function datas(e: Etapa): HTMLElement {
  if (e.marco) return linha(icone("calendario", 15), dataLonga(e.inicio));
  const desvio = replanejada(e) ? desvioUteis(e) : 0;
  const aviso =
    desvio && e.base
      ? h(
          "small",
          {},
          `Replanejada: o plano original terminava em ${dataLonga(e.base.fim)} (${desvio > 0 ? `+${textoDiasUteis(desvio)}` : `${textoDiasUteis(-desvio)} antes`})`,
        )
      : null;
  return linha(
    icone("calendario", 15),
    `${dataLonga(e.inicio)} → ${dataLonga(e.fim)} · ${textoDiasUteis(duracaoUteis(e.inicio, e.fim))}`,
    aviso,
  );
}

function regua(e: Etapa, aoProgresso: (n: number) => void): HTMLElement {
  const valor = h("b", {}, `${e.progresso}%`);
  const r = h("input", { type: "range", min: "0", max: "100", step: "5", value: String(e.progresso), "aria-label": "Progresso" });
  r.addEventListener("input", () => {
    valor.textContent = `${r.value}%`;
  });
  r.addEventListener("change", () => {
    valor.textContent = `${r.value}%`;
    aoProgresso(Number(r.value));
  });
  return h("div", { class: "prj-balao-prog" }, h("span", {}, "Progresso"), r, valor);
}

function menuDaEtapa(d: DadosBalao, a: AcoesBalao): HTMLButtonElement {
  return criarMenu({
    rotulo: "Mais ações da etapa",
    classe: "spro-botao-icone pequeno",
    largura: 250,
    itens: (): EntradaMenu[] => [
      { rotulo: "Duplicar", icone: "copiar", fazer: a.aoDuplicar },
      ...d.projeto.fases
        .filter((f) => f.id !== d.etapa.fase)
        .map((f) => ({ rotulo: `Mover para “${f.nome}”`, icone: "mover" as const, fazer: () => a.aoMoverFase(f.id) })),
      d.etapa.fase ? { rotulo: "Mover para “Sem fase”", icone: "mover", fazer: () => a.aoMoverFase(undefined) } : null,
      { rotulo: "Histórico", icone: "historico", fazer: () => a.aoEditar("historico") },
      "-",
      { rotulo: "Excluir", icone: "lixeira", perigo: true, fazer: a.aoExcluir },
    ],
  });
}

export function conteudoDoBalao(d: DadosBalao, a: AcoesBalao, fechar: () => void): HTMLElement {
  const e = d.etapa;
  const situacao = situacaoEtapa(e, d.hoje);
  const atraso = situacao === "atrasada" ? diasUteisDeAtraso(e, d.hoje) : 0;
  const fase = d.projeto.fases.find((f) => f.id === e.fase)?.nome ?? "Sem fase";
  const feitos = e.checklist.filter((i) => i.feito).length;
  const aberta = !e.concluidaEm;
  const nota =
    aberta && !e.marco && e.medida === "tempo"
      ? "Progresso automático pelo tempo decorrido"
      : aberta && !e.marco && e.medida === "checklist"
        ? "Progresso calculado pelo checklist"
        : null;
  const principal = aberta
    ? h(
        "button",
        { type: "button", class: "spro-botao primario pequeno", onclick: a.aoConcluir },
        icone("check", 14),
        e.marco ? "Marcar como cumprido" : "Concluir etapa",
      )
    : h("button", { type: "button", class: "spro-botao pequeno", onclick: a.aoReabrir }, "Reabrir");
  return h(
    "div",
    { class: "prj-balao-corpo" },
    h(
      "button",
      {
        type: "button",
        class: "spro-botao-icone pequeno prj-balao-fechar",
        "aria-label": "Fechar",
        title: "Fechar (Esc)",
        onclick: fechar,
      },
      icone("fechar", 14),
    ),
    pilulaDaSituacao({ etapa: e, situacao }, d.hoje, atraso ? ` · ${textoDiasUteis(atraso)}` : ""),
    h("h3", {}, e.nome),
    h("div", { class: "prj-balao-sub" }, e.responsavel ? `${fase} · ${e.responsavel.nome}` : fase),
    datas(e),
    e.concluidaEm ? linha(icone("check", 15), `Concluída em ${dataLonga(e.concluidaEm)}`) : null,
    e.checklist.length ? linha(iconeProjetos("checklist", 15), `Checklist: ${feitos} de ${e.checklist.length} itens`) : null,
    linhaDoDocumento(e, a),
    linhaDoProcesso(e, d, a),
    aberta && !e.marco && e.medida === "manual" ? regua({ ...e, progresso: progressoDaEtapa(e, d.hoje) }, a.aoProgresso) : null,
    nota ? h("div", { class: "prj-balao-nota" }, nota) : null,
    h(
      "div",
      { class: "prj-balao-acoes" },
      principal,
      h("button", { type: "button", class: "spro-botao pequeno", onclick: () => a.aoEditar() }, icone("lapis", 14), "Editar"),
      menuDaEtapa(d, a),
    ),
  );
}

/** Quanto a régua espera depois do último `change` para gravar. */
export const ATRASO_PROGRESSO = 600;

/**
 * Gravação da régua com atraso: só o último valor de uma sequência de mudanças vai para `gravar`,
 * `ms` depois da última; `descarregar` grava já o que ficou pendente (o balão fechou).
 */
export function progressoComAtraso(
  gravar: (pct: number) => void,
  ms = ATRASO_PROGRESSO,
): { mudar(pct: number): void; descarregar(): void } {
  let pendente: number | null = null;
  let espera: ReturnType<typeof setTimeout> | undefined;
  const descarregar = () => {
    clearTimeout(espera);
    if (pendente === null) return;
    const n = pendente;
    pendente = null;
    gravar(n);
  };
  return {
    mudar(pct) {
      pendente = pct;
      clearTimeout(espera);
      espera = setTimeout(descarregar, ms);
    },
    descarregar,
  };
}

export interface OpcoesBalao {
  /** Onde pôr o foco ao abrir (padrão: o primeiro controle); ver `OpcoesCamada.foco`. */
  foco?: OpcoesCamada["foco"];
  /** Atraso da gravação da régua (padrão: `ATRASO_PROGRESSO`). */
  atrasoProgresso?: number;
}

export function abrirBalaoEtapa(ancora: Element, d: DadosBalao, a: AcoesBalao, aoFechar?: () => void, o: OpcoesBalao = {}): Camada {
  let camada: Camada | null = null;
  const fechar = () => camada?.fechar();
  const progresso = progressoComAtraso((n) => a.aoProgresso(n), o.atrasoProgresso);
  // Toda ação fecha o balão antes (o diálogo, o aviso ou o redesenho vêm depois).
  const fechando = <F extends (...args: never[]) => void>(f: F) =>
    ((...args: Parameters<F>) => {
      fechar();
      f(...args);
    }) as F;
  const acoes: AcoesBalao = {
    ...a,
    aoProgresso: progresso.mudar,
    aoConcluir: fechando(a.aoConcluir),
    aoReabrir: fechando(a.aoReabrir),
    aoEditar: fechando(a.aoEditar),
    aoDuplicar: fechando(a.aoDuplicar),
    aoMoverFase: fechando(a.aoMoverFase),
    aoExcluir: fechando(a.aoExcluir),
  };
  camada = abrirCamada(ancora, conteudoDoBalao(d, acoes, fechar), {
    classe: "prj-balao",
    largura: 330,
    rotulo: d.etapa.nome,
    foco: o.foco,
    // O que a régua ainda não gravou vai antes de qualquer outra coisa (ação, diálogo, redesenho).
    aoFechar: () => {
      progresso.descarregar();
      aoFechar?.();
    },
  });
  return camada;
}
