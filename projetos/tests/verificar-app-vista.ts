import { montarTabelaEtapas } from "../src/app/componentes/tabelaEtapas";
import { type DadosVistaProjeto, VistaProjeto } from "../src/app/componentes/vistaProjeto";
import { idLinhaFase, linhasDoProjeto } from "../src/gantt/linhas";
import { area, esperarQuadro, instalarAmbienteGantt } from "./ambienteGantt";
import { tecla, telaDoApp, texto } from "./apoioApp";
import { cenario, HOSTIL } from "./cenarioGantt";
import { HOJE } from "./fabrica";
import { ganttFalso } from "./ganttFalso";
import { checar, disparar, secao, tique } from "./util";

const { fases, etapas } = cenario();
const linhas = (recolhidas: string[] = []) =>
  linhasDoProjeto({ projeto: "p1", fases, etapas }, { hoje: HOJE, ordem: "inicio", recolhidas: new Set(recolhidas) });

function dados(m: Partial<DadosVistaProjeto> = {}): DadosVistaProjeto {
  return { linhas: linhas(), mostrarLista: true, escala: "Semana", hoje: HOJE, moverDependentes: true, ...m };
}

export async function verificarAppVista(): Promise<void> {
  secao("app: vista do projeto (lista a esquerda + Gantt)");
  const doc = telaDoApp();
  const g = ganttFalso();
  const feitos: string[] = [];
  const vista = new VistaProjeto(dados(), {
    montarGantt: g.montar,
    aoClicarEtapa: (id) => feitos.push(`clique:${id}`),
    aoAlternarFase: (id) => feitos.push(`fase:${id}`),
    aoAdicionar: (nome) => void feitos.push(`nova:${nome}`),
    validar: () => null,
    aoMudarDatas: () => undefined,
    aoRecusar: () => undefined,
    aoFalharGantt: () => feitos.push("falhou"),
  });
  doc.getElementById("app")!.append(vista.el);
  const lin = () => [...vista.el.querySelectorAll(".prj-lin:not(.prj-lin-nova)")];
  checar("uma linha da lista por linha do Gantt", lin().length === linhas().length && g.a.linhas[0]?.length === linhas().length);
  checar(
    "cabecalho da lista: Etapa e Resp.",
    [...vista.el.querySelectorAll(".prj-lista-cab span")].map((s) => texto(s)).join() === "Etapa,Resp.",
  );
  const e1 = vista.el.querySelector<HTMLElement>('.prj-lin[data-id="e1"]')!;
  checar(
    "nome hostil como texto e com title",
    texto(e1.querySelector(".prj-lin-nome")) === HOSTIL &&
      e1.querySelector(".prj-lin-nome")?.getAttribute("title") === HOSTIL &&
      !vista.el.querySelector("img"),
  );
  checar("icone de situacao na linha", !!e1.querySelector(".prj-st-atrasada"));
  const f1 = vista.el.querySelector<HTMLElement>('.prj-lin-fase[data-fase="f1"]')!;
  checar(
    "linha de fase com feitas/total",
    texto(f1.querySelector(".prj-lin-nome")) === "Instrução" &&
      texto(f1.querySelector(".prj-lin-conta")) === "0/2" &&
      f1.getAttribute("aria-expanded") === "true",
  );
  disparar(e1, "mouseenter");
  disparar(e1, "mouseleave");
  checar("passar o mouse realca a barra", g.a.realces.join() === "e1:true,e1:false");
  e1.click();
  tecla(e1, "Enter");
  f1.click();
  checar("clique e Enter abrem o balao; fase recolhe", feitos.join() === "clique:e1,clique:e1,fase:f1", feitos);
  const nova = vista.el.querySelector<HTMLInputElement>(".prj-lin-nova input")!;
  checar("ultima linha: 'Adicionar etapa… (Enter)'", nova.getAttribute("placeholder") === "Adicionar etapa… (Enter)");
  nova.value = "  Parecer final  ";
  tecla(nova, "Enter");
  nova.value = "   ";
  tecla(nova, "Enter");
  checar(
    "Enter cria com o nome (vazio nao cria)",
    feitos.at(-1) === "nova:Parecer final" && feitos.filter((f) => f.startsWith("nova:")).length === 1,
  );

  secao("app: campo da etapa nova so limpa quando o app aceita");
  const ga = ganttFalso();
  const pedidos: string[] = [];
  let responder: (aceito: boolean) => void = () => undefined;
  const va = new VistaProjeto(dados(), {
    montarGantt: ga.montar,
    aoClicarEtapa: () => undefined,
    aoAlternarFase: () => undefined,
    aoAdicionar: (nome) => {
      pedidos.push(nome);
      return new Promise<boolean>((r) => {
        responder = r;
      });
    },
    validar: () => null,
    aoMudarDatas: () => undefined,
    aoRecusar: () => undefined,
    aoFalharGantt: () => undefined,
  });
  telaDoApp().getElementById("app")!.append(va.el);
  const campoNovo = () => va.el.querySelector<HTMLInputElement>(".prj-lin-nova input")!;
  campoNovo().value = "Parecer";
  tecla(campoNovo(), "Enter");
  tecla(campoNovo(), "Enter");
  checar(
    "Enter pede ao app e o texto fica ate a resposta (sem pedir duas vezes)",
    pedidos.join() === "Parecer" && campoNovo().value === "Parecer",
    pedidos,
  );
  responder(false);
  await tique();
  checar("recusado: o texto fica para corrigir", campoNovo().value === "Parecer");
  va.atualizar(dados({ escala: "Mês" }));
  checar("redesenho nao apaga o que esta digitado", campoNovo().value === "Parecer");
  tecla(campoNovo(), "Enter");
  va.atualizar(dados());
  responder(true);
  await tique();
  checar("aceito: limpa o campo, mesmo depois de redesenhar", pedidos.length === 2 && campoNovo().value === "", pedidos);
  va.destruir();

  secao("app: vista do projeto atualiza sem remontar o Gantt");
  const recolhida = linhas(["f1"]);
  vista.atualizar(dados({ linhas: recolhida }));
  checar(
    "fase recolhida: some da lista e do Gantt, sem remontar",
    g.a.montagens === 1 &&
      g.a.linhas.at(-1)?.length === recolhida.length &&
      vista.el.querySelector('.prj-lin-fase[data-fase="f1"]')?.getAttribute("aria-expanded") === "false",
  );
  vista.atualizar(dados({ linhas: recolhida, escala: "Mês" }));
  checar("trocar escala", g.a.escalas.join() === "Mês" && g.a.montagens === 1);
  vista.rolarParaHoje();
  checar("Hoje rola o Gantt", g.a.hoje === 1);
  vista.atualizar(dados({ linhas: recolhida, escala: "Mês", mostrarLista: false }));
  checar(
    "esconder a lista remonta o Gantt sem a coluna",
    g.a.montagens === 2 && g.a.destruidos === 1 && !vista.el.querySelector(".prj-lista"),
  );
  checar("o Gantt sabe que a lista sumiu (rotulo da fase volta)", g.opcoes()?.mostrarLista === false);
  vista.destruir();
  checar("destruir", g.a.destruidos === 2);

  secao("app: realce sobrevive ao redesenho");
  const gr = ganttFalso();
  const vr = new VistaProjeto(dados(), {
    montarGantt: gr.montar,
    aoClicarEtapa: () => undefined,
    aoAlternarFase: () => undefined,
    aoAdicionar: () => undefined,
    validar: () => null,
    aoMudarDatas: () => undefined,
    aoRecusar: () => undefined,
    aoFalharGantt: () => undefined,
  });
  telaDoApp().getElementById("app")!.append(vr.el);
  disparar(vr.el.querySelector('.prj-lin[data-id="e1"]')!, "mouseenter");
  gr.a.realces.length = 0;
  vr.atualizar(dados({ escala: "Mês" }));
  checar(
    "redesenho reaplica realce na barra e na linha nova",
    gr.a.realces.at(-1) === "e1:true" && vr.el.querySelector('.prj-lin[data-id="e1"]')?.classList.contains("prj-realce") === true,
    gr.a.realces,
  );
  gr.a.realces.length = 0;
  vr.atualizar(dados({ linhas: linhas().filter((l) => l.id !== "e1") }));
  checar("etapa removida: nada realcado e sem erro", !gr.a.realces.includes("e1:true") && !vr.el.querySelector(".prj-realce"));
  vr.destruir();

  secao("app: falha da Frappe cai para a lista");
  const quebrado = ganttFalso({ falhar: true });
  const falhas: string[] = [];
  new VistaProjeto(dados(), {
    montarGantt: quebrado.montar,
    aoClicarEtapa: () => undefined,
    aoAlternarFase: () => undefined,
    aoAdicionar: () => undefined,
    validar: () => null,
    aoMudarDatas: () => undefined,
    aoRecusar: () => undefined,
    aoFalharGantt: () => falhas.push("falhou"),
  });
  checar("avisa o app", falhas.join() === "falhou");

  secao("app: vista Lista (tabela por fase)");
  const docL = telaDoApp();
  const cliques: string[] = [];
  const tab = montarTabelaEtapas(linhas(), { hoje: HOJE, aoClicar: (id) => cliques.push(id) });
  docL.getElementById("app")!.append(tab);
  const cab = [...tab.querySelectorAll("th")].map((t) => texto(t));
  checar("colunas da tela 1", cab.join("|") === "|Etapa|Responsável|Início|Término|Situação|Progresso", cab);
  const grupos = [...tab.querySelectorAll("tr.prj-tab-grupo")].map((t) => texto(t));
  checar("agrupada por fase", grupos.join("|") === "Instrução 0/2|Deliberação 1/2|Vazia 0/0", grupos);
  const marco = tab.querySelector<HTMLElement>('tr[data-id="m1"]')!;
  checar(
    "marco com pilula e sem termino nem progresso",
    texto(marco).includes("marco") && texto(marco.children[4]) === "—" && texto(marco.children[6]) === "",
  );
  const ok = tab.querySelector<HTMLElement>('tr[data-id="ok"]')!;
  checar("concluida: situacao e 100%", texto(ok.children[5]) === "Concluída" && texto(ok.children[6]) === "100%");
  checar(
    "nome hostil como texto na tabela",
    texto(tab.querySelector('tr[data-id="e1"] .prj-tab-nome')) === HOSTIL && !tab.querySelector("img"),
  );
  marco.click();
  checar("clique na linha abre o balao", cliques.join() === "m1");

  secao("app: vista do projeto com a Frappe de verdade (alinhamento)");
  const docG = instalarAmbienteGantt();
  const vg = new VistaProjeto(dados(), {
    aoClicarEtapa: (id) => cliques.push(`barra:${id}`),
    aoAlternarFase: () => undefined,
    aoAdicionar: () => undefined,
    validar: () => null,
    aoMudarDatas: () => undefined,
    aoRecusar: () => undefined,
    aoFalharGantt: () => undefined,
  });
  area(docG).append(vg.el);
  await esperarQuadro();
  const barras = vg.el.querySelectorAll(".bar-wrapper");
  const linhasLista = vg.el.querySelectorAll(".prj-lin:not(.prj-lin-nova)");
  checar(
    "mesmo numero de barras e de linhas da lista, na mesma ordem",
    barras.length === linhasLista.length &&
      [...barras].every((b, i) => {
        const l = linhasLista[i]!;
        const id = l.getAttribute("data-id") ?? idLinhaFase(l.getAttribute("data-fase") ?? "");
        return b.getAttribute("data-id") === id;
      }),
  );
  const barra = vg.el.querySelector('.bar-wrapper[data-id="e2"]')!;
  disparar(barra, "mouseover");
  checar(
    "passar o mouse na barra realca a linha da lista",
    vg.el.querySelector('.prj-lin[data-id="e2"]')?.classList.contains("prj-realce") === true,
  );
  disparar(barra, "mouseout");
  checar("e tira o realce ao sair", !vg.el.querySelector(".prj-realce"));
  vg.destruir();
}
