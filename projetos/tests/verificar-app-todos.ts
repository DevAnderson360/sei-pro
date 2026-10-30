import { montarTabelaProjetos, VistaTodos } from "../src/app/componentes/vistaTodos";
import type { ProjetoNaTela } from "../src/app/dados";
import type { LinhaProjeto } from "../src/gantt/linhas";
import { resumoDoProjeto } from "../src/modelo/resumo";
import type { Etapa, Vis } from "../src/modelo/tipos";
import { tecla, telaDoApp, texto } from "./apoioApp";
import { HOSTIL } from "./cenarioGantt";
import { etapa, HOJE, projeto } from "./fabrica";
import { ganttFalso } from "./ganttFalso";
import { checar, secao } from "./util";

const item = (id: string, vis: Vis, etapas: Etapa[], nome = `Projeto ${id}`): ProjetoNaTela => ({
  projeto: projeto({ id, nome }),
  vis,
  fases: [],
  etapas,
  resumo: resumoDoProjeto(etapas, HOJE),
});

export function verificarAppTodos(): void {
  secao("app: Todos (portfolio)");
  const doc = telaDoApp();
  const itens = [
    item("p1", "unidade", [etapa({ id: "a", projeto: "p1", inicio: "2026-09-01", fim: "2026-09-30" })], HOSTIL),
    item("p2", "eu", [
      etapa({ id: "b", projeto: "p2", inicio: "2026-09-01", fim: "2026-09-02", concluidaEm: "2026-09-02" }),
      etapa({ id: "c", projeto: "p2", inicio: "2026-10-01", fim: "2026-11-30" }),
    ]),
    item("p3", "unidade", []),
  ];
  const g = ganttFalso();
  const abertos: string[] = [];
  const v = new VistaTodos(
    { itens, mostrarLista: true, escala: "Mês", hoje: HOJE },
    { montarGantt: g.montar, aoAbrir: (id) => abertos.push(id), aoFalharGantt: () => undefined },
  );
  doc.getElementById("app")!.append(v.el);
  const lin = [...v.el.querySelectorAll<HTMLElement>(".prj-lin-projeto")];
  checar("uma linha por projeto, alinhada ao Gantt", lin.length === 3 && g.a.linhas[0]?.length === 3);
  checar("Gantt so leitura, na escala do Todos", g.opcoes()?.somenteLeitura === true && g.opcoes()?.escala === "Mês");
  const cls = (g.a.linhas[0] as LinhaProjeto[]).map((l) => `${l.id}:${l.resumo.situacao}`);
  checar("cor da barra pela situacao do projeto", cls.join() === "p1:atrasado,p2:andamento,p3:semEtapas", cls);
  checar("nome hostil como texto", texto(lin[0]?.querySelector(".prj-lin-nome")) === HOSTIL && !v.el.querySelector("img"));
  checar(
    "pilula: atrasadas ou feitas/total",
    texto(lin[0]?.querySelector(".spro-pilula")) === "1 atrasada" && texto(lin[1]?.querySelector(".spro-pilula")) === "1/2",
  );
  lin[1]!.click();
  tecla(lin[2]!, "Enter");
  g.opcoes()?.aoClicar?.("p1", v.el);
  checar("clique na linha, Enter ou na barra abre o projeto", abertos.join() === "p2,p3,p1");
  v.atualizar({ itens: itens.slice(0, 1), mostrarLista: true, escala: "Ano", hoje: HOJE });
  checar(
    "atualizar com filtro e escala, sem remontar",
    g.a.montagens === 1 && g.a.escalas.join() === "Ano" && g.a.linhas.at(-1)?.length === 1,
  );
  v.atualizar({ itens, mostrarLista: false, escala: "Ano", hoje: HOJE });
  checar("sem lista: so o Gantt", g.a.montagens === 2 && !v.el.querySelector(".prj-lista"));
  v.rolarParaHoje();
  v.destruir();
  checar("Hoje e destruir", g.a.hoje === 1 && g.a.destruidos === 2);

  secao("app: Todos em Lista");
  const docL = telaDoApp();
  const tab = montarTabelaProjetos(itens, { aoAbrir: (id) => abertos.push(id) });
  docL.getElementById("app")!.append(tab);
  checar("colunas", [...tab.querySelectorAll("th")].map((t) => texto(t)).join("|") === "Projeto|Onde|Início|Término|Etapas|Progresso");
  const l2 = tab.querySelector<HTMLElement>('tr[data-id="p2"]')!;
  checar(
    "linha do projeto",
    [...l2.children]
      .map((c) => texto(c))
      .join("|")
      .startsWith("Projeto p2|Só eu|01/09/2026|30/11/2026|1/2|"),
  );
  checar("projeto sem etapas: datas em branco", texto(tab.querySelector('tr[data-id="p3"]')?.children[2]) === "—");
  l2.click();
  checar("clique abre", abertos.at(-1) === "p2");
}
