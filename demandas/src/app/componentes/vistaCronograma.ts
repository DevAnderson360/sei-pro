/**
 * Vista Cronograma: a lista de demandas à esquerda, alinhada às barras (cabeçalho 64 px, linha 36 px: `MEDIDAS`), e o
 * Gantt do Projetos à direita (`montarGantt`, sem alterá-lo). Barra de ferramentas: escala, agrupamento e "Hoje".
 * O arraste só decide datas; quem grava (e pede o motivo do prazo) é o app. Se a Frappe não monta, `aoFalhar`.
 */

import type { DataISO } from "@comum/datas/dias";
import { avatar } from "@comum/ui/avatar";
import { h, icone } from "@comum/ui/dom";
import { ESCALAS, type Escala, MODOS } from "@projetos/gantt/escalas";
import type { Linha, LinhaEtapa, LinhaFase } from "@projetos/gantt/linhas";
import { type ControleGantt, montarGantt } from "@projetos/gantt/montar";
import type { MudancaDeDatas } from "@projetos/modelo/tipos";
import { demandasComoLinhas } from "../../gantt/demandasComoLinhas";
import { mudancasDasDemandas, validarMudancas } from "../../gantt/montarCronograma";
import type { DemandaNaTela } from "../dados";

export interface OpcoesCronograma {
  itens: readonly DemandaNaTela[];
  hoje: DataISO;
  escala: Escala;
  agrupar: "responsavel" | "situacao";
  aoClicar(alvo: DemandaNaTela, ancora: Element): void;
  /**
   * O arraste mudou datas de uma demanda: o app decide (distribuição direto; prazo pede o motivo) e redesenha o
   * cronograma se não gravou nada (o Gantt já mostra a barra no lugar novo). Nunca lança.
   */
  aoMudarDatas(alvo: DemandaNaTela, inicio: DataISO, fim: DataISO): Promise<void>;
  aoEscala(e: Escala): void;
  aoAgrupar(a: "responsavel" | "situacao"): void;
  /** O arraste foi recusado (demanda encerrada, grupo): a mensagem. */
  aoRecusar(mensagem: string): void;
  aoFalhar(erro: unknown): void;
  /** Injetável nas provas (a Frappe de verdade precisa de medidas). */
  montarGantt?: typeof montarGantt;
}

const ativar = (el: HTMLElement, fazer: () => void): HTMLElement => {
  el.addEventListener("click", fazer);
  el.addEventListener("keydown", (ev) => {
    if (ev.key !== "Enter" && ev.key !== " ") return;
    ev.preventDefault();
    fazer();
  });
  return el;
};

/** Teto do esticamento: 8 vezes a coluna original da escala. */
const FATOR_MAXIMO = 8;

/** O que a Frappe expõe além do tipo do Projetos (`dates` e `render`). */
interface FrappeLargura {
  dates?: unknown[];
  config: { column_width: number };
  $container: HTMLElement;
  render?: () => void;
}

/**
 * Faz a grade do Gantt ocupar toda a largura útil da área: se `dates * column_width` é menor que o contêiner, escala a
 * coluna (nunca encolhe) a partir do valor ORIGINAL da escala e redesenha uma vez, preservando a rolagem. É idempotente
 * (a base vem de `MODOS`, não do valor já esticado) e o `render` não volta a chamá-la. Nunca lança.
 */
export function preencherLargura(controle: ControleGantt | null): void {
  try {
    const g = controle?.gantt as unknown as FrappeLargura | null | undefined;
    if (!controle || !g || typeof g.render !== "function") return;
    const colunas = g.dates?.length ?? 0;
    const largura = g.$container.clientWidth;
    const base = MODOS.find((m) => m.name === controle.escala)?.column_width ?? g.config.column_width;
    if (colunas <= 0 || largura <= 0 || base <= 0) return;
    const alvo = colunas * base < largura ? Math.min(Math.floor(largura / colunas), base * FATOR_MAXIMO) : base;
    if (alvo === g.config.column_width) return;
    const rolagem = g.$container.scrollLeft;
    g.config.column_width = alvo;
    g.render();
    g.$container.scrollLeft = rolagem;
  } catch {
    // Só estética: a grade estreita continua utilizável.
  }
}

export function montarVistaCronograma(area: HTMLElement, o: OpcoesCronograma): ControleGantt | null {
  const linhas: Linha[] = demandasComoLinhas(o.itens, { hoje: o.hoje, agrupar: o.agrupar });
  const porId = new Map(o.itens.map((x) => [x.demanda.id, x]));
  let controle: ControleGantt | null = null;
  let falhou = false;

  const areaGantt = h("div", { class: "dem-cron-gantt" });
  const linhaFase = (l: LinhaFase): HTMLElement =>
    h(
      "div",
      { class: "dem-cron-lin dem-cron-fase", "data-fase": l.fase.id },
      h("span", { class: "dem-cron-nome", title: l.fase.nome }, l.fase.nome),
      h("span", { class: "dem-cron-conta" }, `${l.resumo.feitas}/${l.resumo.total}`),
    );
  const linhaEtapa = (l: LinhaEtapa): HTMLElement => {
    const alvo = porId.get(l.id);
    const el = h(
      "div",
      {
        class: `dem-cron-lin dem-cron-demanda${l.situacao === "concluida" ? " dem-cron-encerrada" : ""}`,
        "data-id": l.id,
        role: "button",
        tabindex: "0",
        "aria-haspopup": "menu",
      },
      h("span", { class: "dem-cron-nome", title: l.etapa.nome }, l.etapa.nome),
      l.etapa.responsavel ? avatar(l.etapa.responsavel.nome, { tamanho: 22 }) : h("span", { class: "dem-cron-av-vazio" }),
    );
    el.addEventListener("mouseenter", () => controle?.realcar(l.id, true));
    el.addEventListener("mouseleave", () => controle?.realcar(l.id, false));
    return ativar(el, () => {
      if (alvo) o.aoClicar(alvo, el);
    });
  };
  const lista = h(
    "div",
    { class: "dem-cron-lista" },
    h("div", { class: "dem-cron-lista-cab" }, h("span", {}, "Demanda"), h("span", {}, "Resp.")),
    ...linhas.map((l) => (l.tipo === "fase" ? linhaFase(l) : l.tipo === "etapa" ? linhaEtapa(l) : h("div", { class: "dem-cron-lin" }))),
  );

  const barra = h(
    "div",
    { class: "dem-cron-barra" },
    h(
      "div",
      { class: "spro-segmentado", role: "group", "aria-label": "Escala" },
      ...ESCALAS.map((e) =>
        h("button", { type: "button", "data-escala": e, "aria-pressed": String(e === o.escala), onclick: () => o.aoEscala(e) }, e),
      ),
    ),
    h(
      "div",
      { class: "spro-segmentado", role: "group", "aria-label": "Agrupar por" },
      ...(
        [
          ["responsavel", "Responsável"],
          ["situacao", "Situação"],
        ] as const
      ).map(([id, rotulo]) =>
        h(
          "button",
          { type: "button", "data-agrupar": id, "aria-pressed": String(id === o.agrupar), onclick: () => o.aoAgrupar(id) },
          rotulo,
        ),
      ),
    ),
    h(
      "button",
      { type: "button", class: "spro-botao pequeno", "data-acao": "hoje", onclick: () => controle?.rolarParaHoje() },
      icone("calendario", 14),
      "Hoje",
    ),
  );

  area.replaceChildren(barra, h("div", { class: "dem-cron" }, lista, areaGantt));

  const montar = o.montarGantt ?? montarGantt;
  const mudar = async (mudancas: MudancaDeDatas[]): Promise<void> => {
    for (const m of mudancasDasDemandas(porId, mudancas)) await o.aoMudarDatas(m.alvo, m.inicio, m.fim);
  };
  controle = montar(areaGantt, linhas, {
    escala: o.escala,
    hoje: o.hoje,
    mostrarLista: true,
    moverDependentes: false,
    aoClicar: (id, ancora) => {
      const alvo = porId.get(id);
      if (alvo) o.aoClicar(alvo, ancora);
    },
    validar: (m) => validarMudancas(porId, m),
    // O app avisa os próprios erros; aqui nada pode virar "falha do Gantt".
    aoMudarDatas: (m) => void mudar(m).catch(() => undefined),
    aoRecusar: o.aoRecusar,
    aoFalhar: (erro) => {
      falhou = true;
      o.aoFalhar(erro);
    },
  });
  if (falhou || !controle) return null;
  const real = controle;
  preencherLargura(real);
  // Janela redimensionada ou aba que estava oculta (largura 0 ao montar): estica de novo, no máximo uma vez por quadro.
  let quadro: ReturnType<typeof setTimeout> | null = null;
  let vivo = true;
  const observador =
    typeof ResizeObserver === "function"
      ? new ResizeObserver(() => {
          if (quadro !== null || !vivo) return;
          quadro = setTimeout(() => {
            quadro = null;
            if (vivo) preencherLargura(real);
          }, 16);
        })
      : null;
  observador?.observe(areaGantt);
  // Trocar a escala ou atualizar refaz a Frappe com a coluna original: estica de novo.
  return {
    get escala() {
      return real.escala;
    },
    get gantt() {
      return real.gantt;
    },
    trocarEscala(e) {
      real.trocarEscala(e);
      preencherLargura(real);
    },
    atualizar(l) {
      real.atualizar(l);
      preencherLargura(real);
    },
    rolarParaHoje: () => real.rolarParaHoje(),
    realcar: (id, ligado) => real.realcar(id, ligado),
    destruir: () => {
      vivo = false;
      if (quadro !== null) clearTimeout(quadro);
      observador?.disconnect();
      real.destruir();
    },
  };
}
