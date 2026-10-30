import { montarCabecalho } from "../src/app/componentes/cabecalho";
import { abrirCamada } from "../src/app/componentes/camada";
import { criarBotaoFiltro, projetoNoFiltro } from "../src/app/componentes/filtro";
import type { ProjetoNaTela } from "../src/app/dados";
import { FILTRO_VAZIO, type FiltroEtapas } from "../src/modelo/filtro";
import { resumoDoProjeto } from "../src/modelo/resumo";
import { combo, escolherCombo, opcoesDoCombo, tecla, telaDoApp, texto } from "./apoioApp";
import { HOSTIL } from "./cenarioGantt";
import { etapa, fase, HOJE, projeto } from "./fabrica";
import { botao, checar, secao, tique } from "./util";

export async function verificarAppCabecalho(): Promise<void> {
  secao("app: cabecalho do projeto e controles");
  const doc = telaDoApp();
  const etapas = [
    etapa({ id: "e1", inicio: "2026-09-01", fim: "2026-09-10", concluidaEm: "2026-09-10" }),
    etapa({ id: "e2", inicio: "2026-10-01", fim: "2026-12-10" }),
  ];
  const p: ProjetoNaTela = {
    projeto: projeto({ id: "p1", nome: HOSTIL, processo: { protocolo: "50300.001234/2026-11", idProcedimento: "77" } }),
    vis: "unidade",
    fases: [],
    etapas,
    resumo: resumoDoProjeto(etapas, HOJE),
  };
  const feitos: string[] = [];
  const filtroFalso = doc.createElement("button");
  filtroFalso.textContent = "Filtro";
  const cab = montarCabecalho({
    modo: "projeto",
    projeto: p,
    vista: "gantt",
    escala: "Semana",
    filtro: filtroFalso,
    aoVista: (v) => feitos.push(`vista:${v}`),
    aoEscala: (e) => feitos.push(`escala:${e}`),
    aoHoje: () => feitos.push("hoje"),
    aoPrimario: () => feitos.push("etapa"),
    aoEditarProjeto: () => feitos.push("editar"),
    aoAbrirProcesso: () => feitos.push("processo"),
  });
  doc.getElementById("app")!.append(cab);
  const meta = texto(cab.querySelector(".prj-meta"));
  checar(
    "processo, escopo, X de Y concluidas e termino",
    meta.includes("50300.001234/2026-11") &&
      meta.includes("Toda a unidade") &&
      meta.includes("1 de 2 etapas concluídas") &&
      meta.includes("termina em 10/12/2026"),
    meta,
  );
  (cab.querySelector(".prj-processo") as HTMLElement).click();
  botao(cab, "Editar projeto")!.click();
  botao(cab, "Lista")!.click();
  botao(cab, "Mês")!.click();
  botao(cab, "Hoje")!.click();
  botao(cab, "Etapa")!.click();
  checar("os 5 controles e o lapis", feitos.join() === "processo,editar,vista:lista,escala:Mês,hoje,etapa", feitos);
  checar(
    "vista e escala atuais marcadas",
    botao(cab, "Gantt")?.getAttribute("aria-pressed") === "true" && botao(cab, "Semana")?.getAttribute("aria-pressed") === "true",
  );
  const lista = montarCabecalho({
    modo: "projeto",
    projeto: p,
    vista: "lista",
    escala: "Semana",
    filtro: filtroFalso,
    aoVista: () => undefined,
    aoEscala: () => undefined,
    aoHoje: () => undefined,
    aoPrimario: () => undefined,
  });
  checar("na vista Lista: sem escala e sem Hoje", !botao(lista, "Hoje") && !botao(lista, "Semana") && !!botao(lista, "Etapa"));
  const marcador = montarCabecalho({
    modo: "projeto",
    projeto: { ...p, projeto: projeto({ id: "p1", processo: { protocolo: "", sigiloso: true } }) },
    vista: "lista",
    escala: "Semana",
    filtro: filtroFalso,
    aoVista: () => undefined,
    aoEscala: () => undefined,
    aoHoje: () => undefined,
    aoPrimario: () => undefined,
    aoAbrirProcesso: () => feitos.push("processo-marcador"),
  });
  checar(
    "projeto com o vinculo vazio do texto: 'Processo sigiloso', sem link",
    texto(marcador.querySelector(".prj-meta")).startsWith("Processo sigiloso · Toda a unidade") &&
      !marcador.querySelector(".prj-meta a") &&
      !marcador.querySelector(".prj-processo"),
    texto(marcador.querySelector(".prj-meta")),
  );
  const todos = montarCabecalho({
    modo: "todos",
    totais: { ativos: 3, arquivados: 1 },
    vista: "gantt",
    escala: "Mês",
    filtro: filtroFalso,
    aoVista: () => undefined,
    aoEscala: () => undefined,
    aoHoje: () => undefined,
    aoPrimario: () => feitos.push("novo"),
  });
  checar(
    "Todos: totais e dica",
    texto(todos.querySelector(".prj-meta")) === "3 projetos ativos · 1 arquivado · clique num projeto para abrir",
  );
  botao(todos, "Novo projeto")!.click();
  checar("Todos: o primario vira + Novo projeto", feitos.at(-1) === "novo");

  secao("app: filtro (popover com chips e campos)");
  const docF = telaDoApp();
  const lista2 = [
    etapa({
      id: "atr",
      inicio: "2026-09-01",
      fim: "2026-10-02",
      responsavel: { login: "ana", nome: "Ana Lima" },
      fase: "f1",
      etiquetas: ["TI"],
    }),
    etapa({ id: "and", inicio: "2026-10-01", fim: "2026-10-20", responsavel: { nome: HOSTIL } }),
    etapa({ id: "ok", inicio: "2026-09-01", fim: "2026-09-02", concluidaEm: "2026-09-02" }),
  ];
  let atual: FiltroEtapas = FILTRO_VAZIO;
  const f = criarBotaoFiltro({
    filtro: atual,
    etapas: lista2,
    fases: [fase({ id: "f1", nome: "Instrução" })],
    hoje: HOJE,
    aoMudar: (n) => {
      atual = n;
      f.definir(n);
    },
  });
  docF.getElementById("app")!.append(f.el);
  checar("sem criterio: so 'Filtro'", texto(f.el) === "Filtro");
  f.el.click();
  const pop = () => docF.querySelector(".prj-filtro-pop");
  checar("abre o popover num dialog nao modal", pop()?.tagName.toLowerCase() === "dialog" && pop()?.hasAttribute("open") === true);
  const chips = () => [...(pop()?.querySelectorAll(".spro-chip") ?? [])].map((c) => `${texto(c)}=${c.getAttribute("aria-pressed")}`);
  checar(
    "chips com as contagens",
    chips().join("|") ===
      "Atrasadas · 1=false|Em andamento · 1=false|Vence nesta semana · 0=false|Próximos 30 dias · 1=false|Concluídas=true|Só as minhas=false",
    chips(),
  );
  botao(pop()!, "Atrasadas · 1")!.click();
  botao(pop()!, "Concluídas")!.click();
  checar("chip liga e popover continua aberto", atual.situacoes.join() === "atrasadas" && !atual.mostrarConcluidas && !!pop());
  checar("o botao mostra a contagem", texto(f.el) === "Filtro · 2");
  checar(
    "responsavel com nome hostil como texto",
    opcoesDoCombo(pop()!, "Responsável").length === 2 && !pop()?.querySelector("img") && !docF.querySelector(".spro-combo-pop img"),
  );
  escolherCombo(pop()!, "Fase", "f1");
  await tique();
  checar("o combo da fase fica dentro do popover e ele nao fecha", atual.fases.join() === "f1" && !!pop());
  checar("combo de etiqueta", opcoesDoCombo(pop()!, "Etiqueta").join() === "TI");
  {
    const btn = combo(pop()!, "Etiqueta")!;
    btn.click();
    const lista = () => docF.querySelectorAll(".spro-combo-pop");
    const op = docF.querySelector<HTMLElement>('.spro-combo-pop [role="option"][data-valor="TI"]')!;
    op.click();
    await tique();
    checar(
      "escolher direto: popover aberto, lista presa a botao vivo, chips e contagem atualizados",
      atual.etiquetas.join() === "TI" &&
        !!pop() &&
        lista().length === 1 &&
        btn.isConnected &&
        combo(pop()!, "Etiqueta") === btn &&
        btn.getAttribute("aria-expanded") === "true" &&
        texto(f.el) === "Filtro · 4",
      { n: lista().length, viva: btn.isConnected, exp: btn.getAttribute("aria-expanded"), botao: texto(f.el) },
    );
    btn.click();
    checar("fechar a lista pelo mesmo botao", lista().length === 0 && !!pop());
  }
  botao(pop()!, "Limpar filtro")!.click();
  checar("limpar volta ao vazio", JSON.stringify(atual) === JSON.stringify(FILTRO_VAZIO) && texto(f.el) === "Filtro");
  checar(
    "limpar mantem o combo vivo e zerado",
    combo(pop()!, "Etiqueta")?.isConnected === true && !texto(combo(pop()!, "Etiqueta")).includes("TI"),
  );
  tecla(pop()!, "Escape");
  checar("Esc fecha", !pop());
  const semFase = criarBotaoFiltro({ filtro: FILTRO_VAZIO, etapas: lista2, hoje: HOJE, aoMudar: () => undefined });
  docF.getElementById("app")!.append(semFase.el);
  semFase.el.click();
  checar("no Todos (sem fases): sem o campo Fase", !combo(pop()!, "Fase") && !!combo(pop()!, "Responsável"));
  semFase.fechar();

  secao("app: projeto no filtro do Todos");
  const comEtiqueta: ProjetoNaTela = { ...p, projeto: projeto({ id: "px", etiquetas: ["Licitação"] }) };
  checar("sem criterio, todos passam", projetoNoFiltro(p, FILTRO_VAZIO, HOJE, { login: "ana" }));
  checar("com chip, passa quem tem etapa", !projetoNoFiltro(p, { ...FILTRO_VAZIO, situacoes: ["atrasadas"] }, HOJE, { login: "ana" }));
  checar(
    "etiqueta do projeto vale (tipo de projeto do legado)",
    projetoNoFiltro(comEtiqueta, { ...FILTRO_VAZIO, etiquetas: ["licitacao"] }, HOJE, { login: "ana" }),
  );

  secao("app: camada flutuante (balao e popover)");
  const docC = telaDoApp();
  const ancora = docC.createElement("button");
  docC.getElementById("app")!.append(ancora);
  let fechou = 0;
  const c = abrirCamada(ancora, docC.createElement("p"), { classe: "prj-teste", aoFechar: () => (fechou += 1) });
  checar("camada no body, dialog aberto", docC.querySelector("dialog.prj-camada.prj-teste")?.parentElement === docC.body);
  c.fechar();
  c.fechar();
  checar("fechar uma vez so", fechou === 1 && !docC.querySelector(".prj-teste"));
}
