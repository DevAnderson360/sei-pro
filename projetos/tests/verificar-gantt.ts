import { readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { diferencaDias, somarDias } from "@comum/datas/dias";
import { planejarRotulos } from "../src/gantt/cabecalho";
import { decorarBarra } from "../src/gantt/decorar";
import { MODOS } from "../src/gantt/escalas";
import { idLinhaFase, linhasDoProjeto } from "../src/gantt/linhas";
import { COR_FERIADO, escalaQueCabe, MAX_COLUNAS, montarGantt, opcoesFrappe } from "../src/gantt/montar";
import { tarefasDoGantt } from "../src/gantt/tarefas";
import { LIMITE_DIAS_ETAPA } from "../src/modelo/calendario";
import type { MudancaDeDatas } from "../src/modelo/tipos";
import { area, esperarQuadro, instalarAmbienteGantt } from "./ambienteGantt";
import { cenario, HOSTIL } from "./cenarioGantt";
import { etapa, HOJE } from "./fabrica";
import { checar, disparar, secao } from "./util";

export async function verificarGantt(): Promise<void> {
  const { fases, etapas } = cenario();
  const todas = linhasDoProjeto({ projeto: "p1", fases, etapas }, { hoje: HOJE, ordem: "inicio", recolhidas: new Set<string>() });

  secao("projetos: rotulos do cabecalho (mes preso x seguinte)");
  {
    const semChoque = planejarRotulos([
      { esquerda: 17, direita: 94, topo: 113, preso: true },
      { esquerda: 192, direita: 242, topo: 119, preso: false },
    ]);
    checar(
      "mes seguinte longe: o preso desce ate a altura dos outros e nada some",
      semChoque.descer === 6 && semChoque.esconder.length === 0,
      semChoque,
    );
    const choque = planejarRotulos([
      { esquerda: 17, direita: 94, topo: 113, preso: true },
      { esquerda: 64, direita: 114, topo: 119, preso: false },
    ]);
    checar("mes seguinte na 2a coluna: o preso some (a data de baixo diz o mes)", choque.esconder.join() === "0", choque);
    const soUm = planejarRotulos([{ esquerda: 0, direita: 60, topo: 113, preso: true }]);
    checar("um rotulo so: nada a alinhar nem esconder", soUm.descer === 0 && soUm.esconder.length === 0, soUm);
    const semPreso = planejarRotulos([
      { esquerda: 0, direita: 60, topo: 119, preso: false },
      { esquerda: 40, direita: 90, topo: 119, preso: false },
    ]);
    checar("sem rotulo preso nunca esconde (so ele pode ser empurrado)", semPreso.esconder.length === 0 && semPreso.descer === 0, semPreso);
    const ordemTroca = planejarRotulos([
      { esquerda: 64, direita: 114, topo: 119, preso: false },
      { esquerda: 17, direita: 94, topo: 113, preso: true },
    ]);
    checar(
      "a ordem recebida nao importa: esconde o indice do preso",
      ordemTroca.esconder.join() === "1" && ordemTroca.descer === 6,
      ordemTroca,
    );
  }

  secao("projetos: opcoes da Frappe");
  const oDia = opcoesFrappe({ escala: "Dia", hoje: HOJE, moverDependentes: true }, todas);
  const feriados = oDia.holidays?.[COR_FERIADO];
  checar(
    "Dia: fim de semana e feriados com nome",
    oDia.holidays?.["var(--g-weekend-highlight-color)"] === "weekend" &&
      Array.isArray(feriados) &&
      feriados.some((f) => f.date === "2026-10-12" && f.name === "Nossa Senhora Aparecida"),
  );
  const oMes = opcoesFrappe({ escala: "Mês", hoje: HOJE, moverDependentes: false, rolarPara: "2026-09-01" }, todas);
  checar(
    "Mês: sem destaque, datas so leitura, escala pedida",
    Object.keys(oMes.holidays ?? {}).length === 0 && oMes.readonly_dates === true && oMes.view_mode === "Mês",
  );
  checar(
    "popup desligado e progresso so leitura",
    oMes.popup === false && oMes.readonly_progress === true && oMes.move_dependencies === false && oMes.scroll_to === "2026-09-01",
  );
  checar("modos copiados (a Frappe altera o objeto)", oMes.view_modes?.[0] !== MODOS[0]);

  secao("projetos: montar o Gantt (linkedom)");
  const doc = instalarAmbienteGantt();
  const a = area(doc);
  const cliques: string[] = [];
  const mudancas: MudancaDeDatas[][] = [];
  const recusas: string[] = [];
  let recusar: string | null = null;
  const ctl = montarGantt(a, todas, {
    escala: "Semana",
    hoje: HOJE,
    mostrarLista: true,
    moverDependentes: true,
    aoClicar: (id) => cliques.push(id),
    validar: () => recusar,
    aoMudarDatas: (m) => mudancas.push(m),
    aoRecusar: (msg) => recusas.push(msg),
  });
  await esperarQuadro();
  const barras = a.querySelectorAll(".bar-wrapper");
  checar("uma barra por linha", barras.length === todas.length);
  checar("area ganha a classe do gantt.css", a.classList.contains("spro-gantt"));
  checar("escala inicial respeitada", ctl.escala === "Semana" && ctl.gantt?.config.view_mode.name === "Semana");
  const g1 = a.querySelector('.bar-wrapper[data-id="e1"]');
  checar("nome hostil aparece como texto no Gantt", g1?.querySelector(".bar-label")?.textContent === HOSTIL && !a.querySelector("img"));
  checar(
    "linha de base com 'plano original'",
    g1?.querySelector(".spro-base") !== null && g1?.querySelector(".spro-base-txt")?.textContent === "plano original",
  );
  checar("sem replanejamento, sem linha de base", !a.querySelector('.bar-wrapper[data-id="e2"] .spro-base'));
  const gm = a.querySelector('.bar-wrapper[data-id="m1"]');
  checar("marco em losango", gm?.querySelector("path.spro-marco") !== null && gm?.classList.contains("st-marco") === true);
  const gf = a.querySelector(`.bar-wrapper[data-id="${idLinhaFase("f1")}"]`);
  checar(
    "fase fina (5 px) e sem rotulo com a lista",
    gf?.querySelector(".bar")?.getAttribute("height") === "5" && gf?.querySelector(".bar-label")?.getAttribute("display") === "none",
  );
  checar(
    "decorar de novo nao duplica",
    (() => {
      ctl.atualizar(todas);
      return a.querySelectorAll('.bar-wrapper[data-id="m1"] .spro-marco').length === 1;
    })(),
  );
  await esperarQuadro();
  ctl.realcar("e2", true);
  checar("realcar liga a classe", a.querySelector('.bar-wrapper[data-id="e2"]')?.classList.contains("realce") === true);
  disparar(a.querySelector('.bar-wrapper[data-id="e2"]')!, "click");
  disparar(a.querySelector(`.bar-wrapper[data-id="${idLinhaFase("f1")}"]`)!, "click");
  checar("clique em etapa avisa; em fase nao", cliques.join() === "e2");

  // Arraste pelo caminho da Frappe: mousedown na barra, mousemove e mouseup no SVG (offsetX à mão).
  const evento = (tipo: string, offsetX: number): Event => {
    const Ev = (doc.defaultView as unknown as { Event: typeof Event }).Event;
    const ev = new Ev(tipo, { bubbles: true });
    Object.defineProperty(ev, "offsetX", { value: offsetX });
    return ev;
  };
  const arrastar = (id: string, dx: number): void => {
    a.querySelector(`.bar-wrapper[data-id="${id}"]`)!.dispatchEvent(evento("mousedown", 100));
    const svg = a.querySelector("svg.gantt")!;
    svg.dispatchEvent(evento("mousemove", 100 + dx));
    svg.dispatchEvent(evento("mouseup", 100 + dx));
  };
  const umDia = (ctl.gantt?.config.column_width ?? 64) / 7;
  arrastar("e2", 3 * umDia + 1);
  const lote = mudancas[0] ?? [];
  checar(
    "arraste: e2 +3 dias corridos e o marco dependente junto",
    lote.map((m) => `${m.id}:${m.inicio}:${m.fim}`).join() === "e2:2026-10-08:2026-10-12,m1:2026-10-23:2026-10-23",
    lote,
  );
  disparar(a.querySelector('.bar-wrapper[data-id="e2"]')!, "click");
  checar("clique logo depois do arraste e ignorado", cliques.join() === "e2");
  // O app grava e redesenha; aqui as linhas continuam as de antes (como se a gravação tivesse falhado).
  ctl.atualizar(todas);
  recusar = "“Análise” não pode começar antes de “Nota”.";
  const xAntes = ctl.gantt?.get_bar("e2")?.$bar.getAttribute("x");
  arrastar("e2", 7 * umDia + 1);
  checar(
    "recusa: avisa e redesenha como estava",
    recusas.join() === recusar && mudancas.length === 1 && ctl.gantt?.get_bar("e2")?.$bar.getAttribute("x") === xAntes,
  );
  disparar(doc.documentElement, "mouseup");
  checar("soltar sem arraste nao faz nada", mudancas.length === 1 && recusas.length === 1);

  ctl.trocarEscala("Mês");
  checar("trocar escala: Mês e datas so leitura", ctl.gantt?.config.view_mode.name === "Mês" && ctl.gantt?.options.readonly_dates === true);
  ctl.trocarEscala("Dia");
  checar("Dia destaca feriado", !!a.querySelector(".holiday-highlight"));
  ctl.rolarParaHoje();
  ctl.destruir();
  checar("destruir esvazia a area", a.children.length === 0 && ctl.gantt === null);

  secao("projetos: gantt.css");
  const css = await readFile(resolve(dirname(fileURLToPath(import.meta.url)), "../estatico/gantt.css"), "utf8");
  checar("traz o CSS da Frappe", css.includes(".gantt-container {") && css.includes(".gantt .bar-label {"));
  checar(
    "traz as regras do SEI Pro",
    [
      ".spro-gantt .gantt-container {",
      ".st-atrasada .bar",
      ".st-vazia .bar",
      ".spro-marco",
      ".spro-base-txt",
      ".bar-wrapper.realce .bar",
    ].every((s) => css.includes(s)),
  );
  checar(
    "cores so por tokens --spro-* nas regras do SEI Pro",
    !css.slice(css.indexOf("SEI Pro: Frappe nas cores")).match(/#[0-9a-f]{3,6}\b/i),
  );
  checar("sem @import e so ASCII", !css.includes("@import") && [...css].every((ch) => ch.charCodeAt(0) <= 0x7f));

  secao("projetos: arraste confirmado pela posicao");
  const dA = "2026-08-24";
  const dB = somarDias(dA, 43);
  const ladoALado = linhasDoProjeto(
    {
      projeto: "p1",
      fases: [],
      etapas: [etapa({ id: "a", inicio: dA, fim: somarDias(dA, 2) }), etapa({ id: "b", inicio: dB, fim: somarDias(dB, 2) })],
    },
    { hoje: HOJE, ordem: "inicio", recolhidas: new Set<string>() },
  );
  const areaD = area(doc);
  const mudD: MudancaDeDatas[][] = [];
  const cliquesD: string[] = [];
  const ctlD = montarGantt(areaD, ladoALado, {
    escala: "Semana",
    hoje: HOJE,
    mostrarLista: true,
    moverDependentes: false,
    aoClicar: (id) => cliquesD.push(id),
    aoMudarDatas: (m) => mudD.push(m),
  });
  await esperarQuadro();
  const evD = (tipo: string, offsetX: number): Event => {
    const Ev = (doc.defaultView as unknown as { Event: typeof Event }).Event;
    const ev = new Ev(tipo, { bubbles: true });
    Object.defineProperty(ev, "offsetX", { value: offsetX });
    return ev;
  };
  const svgD = areaD.querySelector("svg.gantt")!;
  let datasChamadas = 0;
  const aoDatas = ctlD.gantt!.options.on_date_change;
  ctlD.gantt!.options.on_date_change = (...r) => {
    datasChamadas++;
    return aoDatas?.(...r);
  };
  const barraB = areaD.querySelector('.bar-wrapper[data-id="b"]')!;
  barraB.dispatchEvent(evD("mousedown", 100));
  for (let p = 1; p <= 11; p++) svgD.dispatchEvent(evD("mousemove", 100 + p));
  svgD.dispatchEvent(evD("mouseup", 111));
  checar(
    "+1 dia em Semana sem date_change da Frappe e confirmado",
    datasChamadas === 0 && mudD.length === 1 && mudD[0]?.map((m) => `${m.id}:${m.inicio}`).join() === `b:${somarDias(dB, 1)}`,
    { datasChamadas, mudD },
  );
  ctlD.atualizar(ladoALado);
  await new Promise((r) => setTimeout(r, 450));
  const svgAntes = areaD.querySelector("svg.gantt");
  const nMud = mudD.length;
  areaD.querySelector('.bar-wrapper[data-id="a"]')!.dispatchEvent(evD("mousedown", 100));
  areaD.querySelector("svg.gantt")!.dispatchEvent(evD("mousemove", 101));
  areaD.querySelector("svg.gantt")!.dispatchEvent(evD("mouseup", 101));
  disparar(areaD.querySelector('.bar-wrapper[data-id="a"]')!, "click");
  checar(
    "tremor de 1 px: sem mudanca, sem redesenho e o clique abre",
    mudD.length === nMud && areaD.querySelector("svg.gantt") === svgAntes && cliquesD.join() === "a",
  );
  ctlD.atualizar(ladoALado);
  await esperarQuadro();
  const svgAtual = areaD.querySelector("svg.gantt")!;
  areaD.querySelector('.bar-wrapper[data-id="a"]')!.dispatchEvent(evD("mousedown", 100));
  svgAtual.dispatchEvent(evD("mousemove", 101));
  svgAtual.dispatchEvent(evD("mouseup", 101));
  areaD.querySelector('.bar-wrapper[data-id="b"]')!.dispatchEvent(evD("mousedown", 100));
  svgAtual.dispatchEvent(evD("mousemove", 100 + 3 * (64 / 7) + 1));
  svgAtual.dispatchEvent(evD("mouseup", 100 + 3 * (64 / 7) + 1));
  checar(
    "arraste sem mudanca nao pega carona no seguinte",
    mudD.length === nMud + 1 && mudD[nMud]?.length === 1 && mudD[nMud]?.[0]?.id === "b",
    mudD,
  );
  ctlD.destruir();

  secao("projetos: clique nao vira arraste");
  const clicar = async (op: { escala: "Mês" | "Ano" | "Semana"; somenteLeitura?: boolean }, linhas: typeof todas, id: string) => {
    const a2 = area(doc);
    const mud2: MudancaDeDatas[][] = [];
    const cl2: string[] = [];
    const c2 = montarGantt(a2, linhas, {
      ...op,
      hoje: HOJE,
      mostrarLista: true,
      moverDependentes: true,
      aoClicar: (i) => cl2.push(i),
      aoMudarDatas: (m) => mud2.push(m),
    });
    await esperarQuadro();
    const alvo = a2.querySelector(`.bar-wrapper[data-id="${id}"]`)!;
    alvo.dispatchEvent(evD("mousedown", 100));
    a2.querySelector("svg.gantt")!.dispatchEvent(evD("mouseup", 100));
    disparar(alvo, "click");
    c2.destruir();
    return { mud2, cl2 };
  };
  for (const esc of ["Mês", "Ano"] as const) {
    const r = await clicar({ escala: esc }, todas, "e2");
    checar(`clique em ${esc}: nada gravado e o clique chega`, r.mud2.length === 0 && r.cl2.join() === "e2", r);
  }
  const rl = await clicar({ escala: "Semana", somenteLeitura: true }, todas, "e2");
  checar("clique somente leitura: nada gravado e o clique chega", rl.mud2.length === 0 && rl.cl2.join() === "e2", rl);

  secao("projetos: so reporta o que se moveu");
  const distorcidas = linhasDoProjeto(
    {
      projeto: "p1",
      fases: [],
      etapas: [
        etapa({ id: "v", inicio: "1999-03-01", fim: "1999-03-05" }),
        etapa({ id: "mal", inicio: "2026-10-09", fim: "2026-10-01" }),
        etapa({ id: "a", inicio: dA, fim: somarDias(dA, 2) }),
        etapa({ id: "b", inicio: dB, fim: somarDias(dB, 2) }),
      ],
    },
    { hoje: HOJE, ordem: "inicio", recolhidas: new Set<string>() },
  );
  const areaX = area(doc);
  const mudX: MudancaDeDatas[][] = [];
  const clX: string[] = [];
  const ctlX = montarGantt(areaX, distorcidas, {
    escala: "Semana",
    hoje: HOJE,
    mostrarLista: true,
    moverDependentes: false,
    aoClicar: (i) => clX.push(i),
    aoMudarDatas: (m) => mudX.push(m),
  });
  await esperarQuadro();
  const svgX = areaX.querySelector("svg.gantt")!;
  areaX.querySelector('.bar-wrapper[data-id="a"]')!.dispatchEvent(evD("mousedown", 100));
  svgX.dispatchEvent(evD("mouseup", 100));
  disparar(areaX.querySelector('.bar-wrapper[data-id="a"]')!, "click");
  checar("clique com etapas presas/saneadas: nada reportado", mudX.length === 0 && clX.join() === "a", mudX);
  areaX.querySelector('.bar-wrapper[data-id="b"]')!.dispatchEvent(evD("mousedown", 100));
  svgX.dispatchEvent(evD("mousemove", 100 + 3 * (64 / 7) + 1));
  svgX.dispatchEvent(evD("mouseup", 100 + 3 * (64 / 7) + 1));
  checar("arraste: so a barra arrastada e reportada", mudX.length === 1 && mudX[0]?.map((m) => m.id).join() === "b", mudX);
  ctlX.destruir();

  secao("projetos: colunas limitadas");
  const decadas = linhasDoProjeto(
    {
      projeto: "p1",
      fases: [],
      etapas: [etapa({ id: "d1", inicio: "2000-01-03", fim: "2000-01-07" }), etapa({ id: "d2", inicio: "2100-01-03", fim: "2100-01-07" })],
    },
    { hoje: HOJE, ordem: "inicio", recolhidas: new Set<string>() },
  );
  checar("escalaQueCabe: periodo curto mantem a pedida", escalaQueCabe("Dia", todas, HOJE) === "Dia");
  checar("escalaQueCabe: um seculo em Dia vai para Mes", escalaQueCabe("Dia", decadas, HOJE) === "Mês");
  checar("escalaQueCabe: Ano ja e a mais larga", escalaQueCabe("Ano", decadas, HOJE) === "Ano");
  const avisos: string[] = [];
  const areaLonga = area(doc);
  const longo = montarGantt(areaLonga, decadas, {
    escala: "Dia",
    hoje: HOJE,
    mostrarLista: true,
    moverDependentes: true,
    aoAjustarEscala: (real, pedida) => avisos.push(`${real}:${pedida}`),
  });
  await esperarQuadro();
  checar(
    "um seculo em Dia monta em Mes e avisa",
    longo.escala === "Mês" && longo.gantt?.config.view_mode.name === "Mês" && avisos.join() === "Mês:Dia",
  );
  checar(
    "colunas dentro do limite",
    areaLonga.querySelectorAll(".lower-text").length > 0 && areaLonga.querySelectorAll(".lower-text").length <= MAX_COLUNAS,
  );
  longo.trocarEscala("Semana");
  longo.trocarEscala("Semana");
  checar("trocar para Semana (ainda ajustada) avisa com a nova pedida", longo.escala === "Mês" && avisos.join() === "Mês:Dia,Mês:Semana");
  longo.atualizar(todas);
  checar(
    "atualizar com linhas que cabem volta a pedida e avisa",
    longo.escala === "Semana" && avisos.join() === "Mês:Dia,Mês:Semana,Semana:Semana",
  );
  longo.atualizar(todas);
  checar("sem mudanca nao avisa de novo", avisos.length === 3);
  longo.destruir();

  const malformada = linhasDoProjeto(
    { projeto: "p1", fases: [], etapas: [etapa({ id: "x1", inicio: "9999-12-31", fim: "2026-10-09" })] },
    { hoje: HOJE, ordem: "inicio", recolhidas: new Set<string>() },
  );
  checar("inicio em 9999 com fim antes: nao cabe em Dia", escalaQueCabe("Dia", malformada, HOJE) !== "Dia");
  const emSeculos = linhasDoProjeto(
    {
      projeto: "p1",
      fases: [],
      etapas: [etapa({ id: "x1", inicio: "9999-01-01", fim: "9999-01-05" }), etapa({ id: "x2", inicio: "2026-10-01", fim: "2026-10-05" })],
    },
    { hoje: HOJE, ordem: "inicio", recolhidas: new Set<string>() },
  );
  checar("etapa valida em 9999 e outra em 2026: presa a 2100, cabe em Mes", escalaQueCabe("Dia", emSeculos, HOJE) === "Mês");
  checar(
    "tarefas presas ao calendario (2000 a 2100)",
    tarefasDoGantt(emSeculos).every((t) => t.start >= "2000-01-01" && t.end <= "2100-12-31"),
  );
  const areaSeculos = area(doc);
  const seculos = montarGantt(areaSeculos, emSeculos, { escala: "Dia", hoje: HOJE, mostrarLista: true, moverDependentes: true });
  await esperarQuadro();
  checar(
    "9999 + 2026 monta com poucas colunas",
    seculos.gantt !== null &&
      areaSeculos.querySelectorAll(".lower-text").length <= MAX_COLUNAS &&
      areaSeculos.querySelectorAll(".bar-wrapper").length === 2,
  );
  seculos.destruir();

  secao("projetos: falha da Frappe");
  const outra = doc.createElement("div");
  const original = (globalThis as Record<string, unknown>).HTMLElement;
  (globalThis as Record<string, unknown>).HTMLElement = class {};
  let falha: unknown = null;
  const quebrado = montarGantt(outra, todas, {
    escala: "Semana",
    hoje: HOJE,
    mostrarLista: true,
    moverDependentes: true,
    aoFalhar: (e) => (falha = e),
  });
  (globalThis as Record<string, unknown>).HTMLElement = original;
  checar(
    "excecao ao montar chama aoFalhar e deixa a area vazia",
    falha instanceof Error && outra.children.length === 0 && quebrado.gantt === null,
  );
  checar(
    "sem aoFalhar a excecao sobe",
    (() => {
      (globalThis as Record<string, unknown>).HTMLElement = class {};
      try {
        montarGantt(doc.createElement("div"), todas, { escala: "Semana", hoje: HOJE, mostrarLista: true, moverDependentes: true });
        return false;
      } catch {
        return true;
      } finally {
        (globalThis as Record<string, unknown>).HTMLElement = original;
      }
    })(),
  );
  const vazio = montarGantt(doc.createElement("div"), [], { escala: "Semana", hoje: HOJE, mostrarLista: false, moverDependentes: true });
  checar("projeto sem linhas monta sem erro", vazio.gantt !== null);
  vazio.destruir();

  secao("projetos: teto de desenho igual ao da etapa");
  {
    const comprida = linhasDoProjeto(
      { projeto: "p1", fases: [], etapas: [etapa({ id: "c", inicio: "2026-01-05", fim: somarDias("2026-01-05", LIMITE_DIAS_ETAPA + 5) })] },
      { hoje: HOJE, ordem: "inicio", recolhidas: new Set<string>() },
    );
    const t = tarefasDoGantt(comprida)[0]!;
    checar("barra mais longa que o limite da etapa e cortada no limite", diferencaDias(t.start, t.end) === LIMITE_DIAS_ETAPA, t);
  }

  secao("projetos: barra de fase arrastada volta ao lugar");
  {
    const aF = area(doc);
    const mudF: MudancaDeDatas[][] = [];
    const ctlF = montarGantt(aF, todas, {
      escala: "Semana",
      hoje: HOJE,
      mostrarLista: true,
      moverDependentes: true,
      aoMudarDatas: (m) => mudF.push(m),
    });
    await esperarQuadro();
    const idF = idLinhaFase("f1");
    const xAntesF = ctlF.gantt?.get_bar(idF)?.$bar.getAttribute("x");
    aF.querySelector(`.bar-wrapper[data-id="${idF}"]`)!.dispatchEvent(evD("mousedown", 100));
    aF.querySelector("svg.gantt")!.dispatchEvent(evD("mousemove", 200));
    aF.querySelector("svg.gantt")!.dispatchEvent(evD("mouseup", 200));
    await esperarQuadro();
    checar(
      "fase arrastada: nada gravado e a barra volta",
      mudF.length === 0 && ctlF.gantt?.get_bar(idF)?.$bar.getAttribute("x") === xAntesF,
      { antes: xAntesF, depois: ctlF.gantt?.get_bar(idF)?.$bar.getAttribute("x") },
    );

    // Trocar a escala com o botão ainda pressionado: o arraste armado na escala antiga não vale.
    aF.querySelector('.bar-wrapper[data-id="e2"]')!.dispatchEvent(evD("mousedown", 100));
    ctlF.trocarEscala("Ano");
    doc.documentElement.dispatchEvent(evD("mouseup", 100));
    checar("trocar escala com o clique segurado nao grava datas", mudF.length === 0, mudF);
    ctlF.trocarEscala("Semana");
    await esperarQuadro();
    mudF.length = 0;
    aF.querySelector('.bar-wrapper[data-id="e2"]')!.dispatchEvent(evD("mousedown", 100));
    ctlF.atualizar(todas);
    doc.documentElement.dispatchEvent(evD("mouseup", 100));
    checar("atualizar com o clique segurado nao grava datas", mudF.length === 0, mudF);
    ctlF.destruir();
  }

  secao("projetos: linha de base torta nao derruba a decoracao");
  {
    const aB = area(doc);
    const ctlB = montarGantt(aB, todas, { escala: "Semana", hoje: HOJE, mostrarLista: true, moverDependentes: true });
    await esperarQuadro();
    const barra = ctlB.gantt!.get_bar("e2")!;
    const linha = todas.find((l) => l.id === "e2")!;
    const torta = linha.tipo === "etapa" ? { ...linha, etapa: { ...linha.etapa, base: { inicio: "x", fim: "y" } } } : linha;
    let erroBase: unknown = null;
    try {
      decorarBarra(ctlB.gantt!, barra, torta, { mostrarLista: true });
    } catch (e) {
      erroBase = e;
    }
    checar("decorarBarra com base de datas invalidas nao lanca", erroBase === null, String(erroBase));
    ctlB.destruir();
  }
}
