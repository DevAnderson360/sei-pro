/**
 * Tela de seleção: filtros, três atalhos, tabela de documentos com caixas (Shift marca faixa), barra com um
 * botão por ação e o menu ⋯ de cada linha. Mexe só em `EstadoApp` (selecionados e filtro) e avisa por `aoMudar`.
 * A seleção só contém documentos visíveis: ao mudar o filtro (qualquer controle, "Limpar filtros" ou uma
 * atualização com filtro ativo), o que o filtro esconde sai da seleção, para os contadores e as ações nunca
 * valerem para linhas que o usuário não vê. Os atalhos são critério de seleção: limpam o filtro e marcam.
 */

import { type Combo, criarCombo, type OpcaoCombo } from "@comum/ui/combobox";
import { h, icone } from "@comum/ui/dom";
import { criarMenu } from "@comum/ui/menu";
import { ACOES, type AcaoId } from "../modelo/acoes";
import { contarPorAcao, elegivel, type LinhaDoc } from "../modelo/documentos";
import { type Atalho, aplicarAtalho, filtrar } from "../modelo/filtros";
import type { EstadoApp } from "./app";

export interface AcoesSelecao {
  aoMudar(): void;
  configurar(acao?: AcaoId): void;
}

const ATALHOS: Array<{ id: Atalho; rotulo: string; dica: string }> = [
  {
    id: "nao-assinados-minha-unidade",
    rotulo: "Não assinados da minha unidade",
    dica: "Documentos internos sem assinatura gerados pela sua unidade",
  },
  { id: "assinados-por-mim", rotulo: "Assinados por mim", dica: "Documentos que você assinou" },
  { id: "externos", rotulo: "Externos", dica: "Documentos externos (arquivos anexados)" },
];

const NIVEL: Record<string, string> = { publico: "Público", restrito: "Restrito", sigiloso: "Sigiloso" };

function dataBr(iso: string | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? "");
  return m ? `${m[3]}/${m[2]}/${m[1]}` : "—";
}

function opcoesDe(linhas: LinhaDoc[], campo: "tipo" | "unidade"): OpcaoCombo[] {
  const cont = new Map<string, number>();
  for (const l of linhas) if (l[campo]) cont.set(l[campo], (cont.get(l[campo]) ?? 0) + 1);
  return [...cont].sort((a, b) => a[0].localeCompare(b[0], "pt-BR")).map(([valor, contagem]) => ({ valor, rotulo: valor, contagem }));
}

export function montarSelecao(_doc: Document, e: EstadoApp, acoes: AcoesSelecao): HTMLElement {
  if (e.sigiloso) {
    return h(
      "section",
      { class: "al-selecao" },
      h("p", { class: "spro-lista-aviso" }, "Este processo é sigiloso: as Ações em Lote não atuam nele."),
    );
  }

  const barra = h("div", { class: "al-barra spro-lista-lote" });
  const resumo = h("span", { class: "spro-lista-resumo", "aria-live": "polite" });
  const tabela = h("div", { class: "al-tabela" });
  let visiveis: LinhaDoc[] = [];

  const mudou = () => {
    acoes.aoMudar();
    desenhar();
  };
  /** Tira da seleção o que o filtro atual esconde; devolve se algo saiu. */
  const podar = (): boolean => {
    const vis = new Set(filtrar(e.linhas, e.filtro).map((l) => l.id));
    let saiu = false;
    for (const id of [...e.selecionados]) {
      if (!vis.has(id)) {
        e.selecionados.delete(id);
        saiu = true;
      }
    }
    if (e.ancora && !vis.has(e.ancora)) e.ancora = null;
    return saiu;
  };
  const filtroMudou = () => {
    if (podar()) acoes.aoMudar();
    desenhar();
  };

  // ---------- Filtros ----------
  const busca = h("input", {
    type: "search",
    class: "spro-lista-busca",
    placeholder: "Buscar por número, nome ou tipo",
    "aria-label": "Buscar documentos",
    oninput: () => {
      const t = busca.value.trim();
      if (t) e.filtro.texto = t;
      else delete e.filtro.texto;
      filtroMudou();
    },
  });
  if (e.filtro.texto) busca.value = e.filtro.texto;

  const simples = (rotulo: string, chave: "assinatura" | "nivel" | "origem", opcoes: OpcaoCombo[]): Combo =>
    criarCombo({
      rotulo,
      opcoes,
      valor: [e.filtro[chave] ?? "todos"],
      busca: false,
      classe: "spro-combo-compacto",
      aoMudar: (v) => {
        const x = v[0] ?? "todos";
        // O valor vem da lista fechada acima.
        (e.filtro as Record<string, string>)[chave] = x;
        filtroMudou();
      },
    });
  const lista = (rotulo: string, chave: "tipos" | "unidades", campo: "tipo" | "unidade"): Combo =>
    criarCombo({
      rotulo,
      opcoes: opcoesDe(e.linhas, campo),
      valor: e.filtro[chave] ?? [],
      multiplo: true,
      vazio: rotulo === "Tipo" ? "Todos os tipos" : "Todas as unidades",
      classe: "spro-combo-compacto",
      aoMudar: (v) => {
        if (v.length) e.filtro[chave] = v;
        else delete e.filtro[chave];
        filtroMudou();
      },
    });
  const comboTipo = lista("Tipo", "tipos", "tipo");
  const comboUnidade = lista("Unidade", "unidades", "unidade");
  const comboAssinatura = simples("Assinatura", "assinatura", [
    { valor: "todos", rotulo: "Todas as assinaturas" },
    { valor: "assinados", rotulo: "Assinados" },
    { valor: "nao-assinados", rotulo: "Não assinados" },
  ]);
  // O nível Sigiloso nunca é oferecido: sigilosos ficam fora das Ações em Lote.
  const comboNivel = simples("Nível", "nivel", [
    { valor: "todos", rotulo: "Todos os níveis" },
    { valor: "publico", rotulo: "Público" },
    { valor: "restrito", rotulo: "Restrito" },
  ]);
  const comboOrigem = simples("Origem", "origem", [
    { valor: "todos", rotulo: "Internos e externos" },
    { valor: "internos", rotulo: "Internos" },
    { valor: "externos", rotulo: "Externos" },
  ]);

  const data = (rotulo: string, chave: "de" | "ate"): HTMLInputElement => {
    const i = h("input", {
      type: "date",
      class: "al-data",
      "aria-label": rotulo,
      disabled: e.datasIndisponiveis,
      onchange: () => {
        if (i.value) e.filtro[chave] = i.value;
        else delete e.filtro[chave];
        filtroMudou();
      },
    });
    if (e.filtro[chave]) i.value = e.filtro[chave]!;
    return i;
  };
  if (e.datasIndisponiveis) {
    delete e.filtro.de;
    delete e.filtro.ate;
  }
  const periodo = h(
    "div",
    { class: "al-periodo" },
    h("label", {}, "De ", data("Data inicial", "de")),
    h("label", {}, "até ", data("Data final", "ate")),
    e.datasIndisponiveis ? h("span", { class: "al-nota" }, "Datas indisponíveis neste processo.") : null,
  );

  const limparFiltros = () => {
    e.filtro = {};
    busca.value = "";
    for (const c of [comboTipo, comboUnidade]) c.definir([]);
    for (const c of [comboAssinatura, comboNivel, comboOrigem]) c.definir(["todos"]);
    for (const i of periodo.querySelectorAll("input")) i.value = "";
  };
  const limpar = h(
    "button",
    {
      type: "button",
      class: "spro-lista-limpar",
      onclick: () => {
        limparFiltros();
        filtroMudou();
      },
    },
    "Limpar filtros",
  );

  const atalhos = h(
    "div",
    { class: "al-atalhos" },
    h("span", { class: "al-rotulo" }, "Atalhos:"),
    ...ATALHOS.map((a) =>
      h(
        "button",
        {
          type: "button",
          class: "spro-botao",
          title: a.dica,
          onclick: () => {
            limparFiltros();
            e.selecionados = new Set(aplicarAtalho(a.id, e.linhas, e.ctx));
            e.ancora = null;
            mudou();
          },
        },
        a.rotulo,
      ),
    ),
  );

  // ---------- Seleção ----------
  const marcar = (ids: string[], valor: boolean) => {
    for (const id of ids) {
      if (valor) e.selecionados.add(id);
      else e.selecionados.delete(id);
    }
  };

  const aoClicarCaixa = (ev: Event, l: LinhaDoc) => {
    const shift = (ev as MouseEvent).shiftKey === true;
    const ids = visiveis.map((v) => v.id);
    const de = e.ancora ? ids.indexOf(e.ancora) : -1;
    if (shift && de >= 0) {
      // A faixa recebe o estado da âncora (o do último clique simples).
      const ate = ids.indexOf(l.id);
      const [a, b] = de <= ate ? [de, ate] : [ate, de];
      marcar(ids.slice(a, b + 1), e.selecionados.has(e.ancora!));
    } else {
      marcar([l.id], !e.selecionados.has(l.id));
      e.ancora = l.id;
    }
    mudou();
  };

  const todos = h("button", {
    type: "button",
    class: "spro-lista-sel-todos",
    role: "checkbox",
    "aria-label": "Selecionar todos",
    title: "Selecionar todos os documentos visíveis",
    onclick: () => {
      const ids = visiveis.map((v) => v.id);
      const todosMarcados = ids.length > 0 && ids.every((id) => e.selecionados.has(id));
      marcar(ids, !todosMarcados);
      mudou();
    },
  });

  const menuDaLinha = (l: LinhaDoc): HTMLButtonElement =>
    criarMenu({
      rotulo: `Ações do documento ${l.numero}`,
      icone: "menu",
      itens: () => {
        const ok = ACOES.filter((a) => elegivel(a.id, l, e.sigiloso).ok);
        if (!ok.length) return [{ rotulo: "Nenhuma ação disponível para este documento", fazer: () => undefined, desativado: true }];
        return ok.map((a) => ({
          rotulo: a.rotulo,
          perigo: a.destrutiva,
          fazer: () => {
            e.selecionados = new Set([l.id]);
            e.ancora = l.id;
            acoes.configurar(a.id);
          },
        }));
      },
    });

  const celula = (...f: Array<Node | string>) => h("td", {}, ...f);

  function desenharTabela(): void {
    const th = (t: string) => h("th", { scope: "col" }, t);
    const cab = h(
      "thead",
      {},
      h(
        "tr",
        {},
        h("th", { scope: "col", class: "al-col-caixa" }, todos),
        ...["Nº SEI", "Documento", "Tipo", "Unidade", "Data", "Assinatura", "Nível", "Pasta"].map(th),
        h("th", { scope: "col", class: "al-col-menu" }),
      ),
    );
    const corpo = h("tbody");
    for (const l of visiveis) {
      const marcada = e.selecionados.has(l.id);
      const caixa = h("input", { type: "checkbox", "aria-label": `Selecionar ${l.numero}`, onclick: (ev) => aoClicarCaixa(ev, l) });
      caixa.checked = marcada;
      const assinatura = l.cancelado ? "Cancelado" : l.assinado ? "Assinado" : l.externo ? "—" : "Sem assinatura";
      corpo.append(
        h(
          "tr",
          { "data-id": l.id, class: marcada ? "al-marcada" : undefined },
          h("td", { class: "al-col-caixa" }, caixa),
          celula(l.numero),
          celula(l.titulo),
          celula(l.tipo),
          celula(l.unidade || "—"),
          celula(dataBr(l.data)),
          celula(assinatura),
          celula(NIVEL[l.nivel] ?? l.nivel),
          celula(l.pasta ?? "—"),
          h("td", { class: "al-col-menu" }, menuDaLinha(l)),
        ),
      );
    }
    if (!visiveis.length) {
      tabela.replaceChildren(
        h("p", { class: "al-nota" }, e.linhas.length ? "Nenhum documento corresponde aos filtros." : "Este processo não tem documentos."),
      );
      return;
    }
    tabela.replaceChildren(h("table", { class: "spro-resultado al-documentos" }, cab, corpo));
  }

  function desenharBarra(): void {
    const sel = e.linhas.filter((l) => e.selecionados.has(l.id));
    const n = contarPorAcao(sel, e.sigiloso);
    barra.replaceChildren(
      h("span", { class: "spro-lista-lote-qtd" }, h("strong", {}, `${sel.length} selecionado${sel.length === 1 ? "" : "s"}`)),
      h(
        "div",
        { class: "spro-lista-lote-acoes" },
        ...ACOES.map((a) => {
          return h(
            "button",
            {
              type: "button",
              class: "spro-botao",
              disabled: n[a.id] === 0,
              onclick: () => {
                if (n[a.id] > 0) acoes.configurar(a.id);
              },
            },
            `${a.rotulo} (${n[a.id]})`,
          );
        }),
        h("button", { type: "button", class: "spro-botao spro-botao-primario", onclick: () => acoes.configurar() }, "Montar fila…"),
      ),
    );
  }

  function desenhar(): void {
    visiveis = filtrar(e.linhas, e.filtro);
    const ids = visiveis.map((v) => v.id);
    const marcadas = ids.filter((id) => e.selecionados.has(id)).length;
    todos.setAttribute("aria-checked", ids.length > 0 && marcadas === ids.length ? "true" : marcadas > 0 ? "mixed" : "false");
    if (ids.length) todos.removeAttribute("disabled");
    else todos.setAttribute("disabled", "");
    // Marcado: o check; misto: um traço (o mesmo ícone diria "todos"); nada: vazio.
    todos.replaceChildren(
      marcadas === ids.length && ids.length > 0 ? icone("check", 14) : marcadas > 0 ? h("span", { class: "al-traco" }, "–") : "",
    );
    resumo.textContent = `${visiveis.length} de ${e.linhas.length} documento${e.linhas.length === 1 ? "" : "s"}`;
    desenharTabela();
    desenharBarra();
    const ativo = Object.keys(e.filtro).some((k) => {
      const v = (e.filtro as Record<string, unknown>)[k];
      return Array.isArray(v) ? v.length > 0 : v !== undefined && v !== "" && v !== "todos";
    });
    limpar.hidden = !ativo;
  }

  const raiz = h(
    "section",
    { class: "al-selecao" },
    h(
      "div",
      { class: "al-filtros" },
      busca,
      comboTipo.el,
      comboUnidade.el,
      comboAssinatura.el,
      comboNivel.el,
      comboOrigem.el,
      periodo,
      limpar,
    ),
    atalhos,
    resumo,
    tabela,
    barra,
  );
  podar();
  desenhar();
  return raiz;
}
