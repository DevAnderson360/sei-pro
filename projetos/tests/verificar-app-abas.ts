import { limiteDeAbas, montarAbas } from "../src/app/componentes/abas";
import { criarMenuAjustes, type OpcoesMenuAjustes } from "../src/app/componentes/menuAjustes";
import { montarVazio } from "../src/app/componentes/vazio";
import type { ProjetoNaTela } from "../src/app/dados";
import { iconeProjetos, iconeSituacao } from "../src/app/icones";
import { SEM_SINCRONIA } from "../src/app/sincronia";
import { resumoDoProjeto } from "../src/modelo/resumo";
import type { Vis } from "../src/modelo/tipos";
import { itemDoMenu, itensDoMenu, telaDoApp, texto } from "./apoioApp";
import { HOSTIL } from "./cenarioGantt";
import { etapa, HOJE, projeto } from "./fabrica";
import { botao, checar, secao } from "./util";

const naTela = (id: string, vis: Vis, nome = `Projeto ${id}`, etapas = [etapa({ id: `${id}-e`, projeto: id })]): ProjetoNaTela => ({
  projeto: projeto({ id, nome }),
  vis,
  fases: [],
  etapas,
  resumo: resumoDoProjeto(etapas, HOJE),
});

export async function verificarAppAbas(): Promise<void> {
  secao("app: icones");
  telaDoApp();
  const g = iconeProjetos("modelo", 20);
  checar(
    "icone do modelo em SVG, do tamanho pedido",
    g.tagName.toLowerCase() === "svg" && g.getAttribute("width") === "20" && !!g.querySelector("rect"),
  );
  const st = (s: Parameters<typeof iconeSituacao>[0], m = false) => iconeSituacao(s, m).getAttribute("class") ?? "";
  checar(
    "situacao da etapa pela classe (cor no CSS)",
    st("concluida").includes("prj-st-concluida") && st("atrasada").includes("prj-st-atrasada") && st("futura").includes("prj-st-futura"),
  );
  checar("marco e losango", !!iconeSituacao("andamento", true).querySelector("path") && st("andamento", true).includes("prj-st-marco"));

  secao("app: abas dos projetos");
  const doc = telaDoApp();
  const atrasado = naTela("p1", "unidade", HOSTIL, [etapa({ id: "a", projeto: "p1", inicio: "2026-09-01", fim: "2026-09-30" })]);
  const ativos = [atrasado, naTela("p2", "eu", "Plano 2027"), naTela("p3", "unidade"), naTela("p4", "unidade"), naTela("p5", "eu")];
  const escolhidos: string[] = [];
  let novos = 0;
  const menu = doc.createElement("button");
  const abas = montarAbas({
    ativos,
    aberto: "p5",
    limite: 3,
    sincronia: SEM_SINCRONIA.estado(),
    menu,
    aoEscolher: (id) => escolhidos.push(id),
    aoNovo: () => {
      novos += 1;
    },
  });
  doc.getElementById("app")!.append(abas);
  const tabs = [...abas.querySelectorAll<HTMLButtonElement>("[role='tab']")];
  checar("Todos e 3 projetos visiveis", tabs.length === 4 && texto(tabs[0]).startsWith("Todos") && texto(tabs[0]).endsWith("5"));
  checar(
    "o projeto aberto fica visivel mesmo alem do limite",
    tabs.at(-1)?.getAttribute("data-aba") === "p5" && tabs.at(-1)?.getAttribute("aria-selected") === "true",
  );
  checar(
    "nome hostil como texto, com ponto vermelho de atraso e percentual",
    texto(tabs[1]).includes(HOSTIL) &&
      !abas.querySelector("img") &&
      !!tabs[1]?.querySelector(".prj-aba-alerta") &&
      /\d+%$/.test(texto(tabs[1])),
  );
  checar(
    "icone do escopo: predio ou pessoa",
    tabs[1]?.title.endsWith("Toda a unidade") === true && tabs[3]?.title.endsWith("Só eu") === true,
  );
  checar("excesso no 'Mais N'", itensDoMenu(abas, "Mais 2 projetos").join() === "Projeto p3,Projeto p4");
  const tablist = abas.querySelector("[role='tablist']");
  checar(
    "a11y: no tablist so abas (o 'Mais N' fica fora dele, ao lado)",
    !!tablist && [...tablist.children].every((c) => c.getAttribute("role") === "tab") && !tablist.querySelector("[aria-haspopup='menu']"),
  );
  checar(
    "a11y: o leitor de tela ouve o escopo, o atraso e o percentual da aba",
    /Toda a unidade · com etapa atrasada · \d+%$/.test(tabs[1]?.getAttribute("aria-label") ?? "") &&
      (tabs[3]?.getAttribute("aria-label") ?? "").includes("Só eu") &&
      !(tabs[3]?.getAttribute("aria-label") ?? "").includes("atrasada") &&
      tabs[0]?.getAttribute("aria-label") === "Todos os projetos (5)",
    tabs.map((t) => t.getAttribute("aria-label")),
  );
  itemDoMenu(abas, "Mais 2 projetos", "Projeto p4");
  tabs[0]!.click();
  checar("escolher pelo 'Mais' e pela aba", escolhidos.join() === "p4,todos");
  botao(abas, "Novo projeto")!.click();
  checar("+ Novo projeto", novos === 1);
  checar(
    "estado da sincronia com dica",
    texto(abas.querySelector(".prj-sinc")) === "neste navegador" && !!abas.querySelector(".prj-sinc")?.getAttribute("title"),
  );
  checar("limite de abas pela largura (sem medida: 3)", limiteDeAbas(0) === 3 && limiteDeAbas(1200) === 4 && limiteDeAbas(300) === 1);

  secao("app: menu ajustes");
  const docM = telaDoApp();
  const feitos: string[] = [];
  const op: OpcoesMenuAjustes = {
    mostrarLista: true,
    moverDependentes: false,
    ordemEtapas: "nome",
    arquivados: 2,
    aoMostrarLista: (v) => feitos.push(`lista:${v}`),
    aoMoverDependentes: (v) => feitos.push(`mover:${v}`),
    aoOrdenar: (o) => feitos.push(`ordem:${o}`),
    aoExportar: () => feitos.push("csv"),
    aoImprimir: () => feitos.push("pdf"),
    aoArquivados: () => feitos.push("arq"),
  };
  const bm = criarMenuAjustes(() => op);
  docM.getElementById("app")!.append(bm);
  const itens = itensDoMenu(docM, "Ajustes dos projetos");
  checar(
    "itens do P3 na ordem da spec",
    itens.join("|") ===
      "Projetos arquivados|Mostrar lista de etapas|Mover dependentes ao arrastar|Ordenar etapas|Exportar planilha (CSV)|Imprimir / salvar PDF",
    itens,
  );
  bm.click();
  // P5 (a11y): os marcáveis dizem o estado ao leitor de tela.
  const marcados = [...docM.querySelectorAll(".spro-menu-pop [role='menuitemcheckbox'][aria-checked='true']")].map((i) => texto(i));
  bm.click();
  const dicaDaOrdem = () => {
    bm.click();
    const item = [...docM.querySelectorAll(".spro-menu-pop [role='menuitem']")].find(
      (i) => texto(i.querySelector(".spro-menu-rotulo")) === "Ordenar etapas",
    );
    const dica = texto(item?.querySelector(".spro-menu-dica"));
    bm.click();
    return dica;
  };
  checar(
    "marcaveis com o estado atual (e a ordem num item so, com a de agora na dica)",
    marcados.includes("Mostrar lista de etapas") && !marcados.includes("Mover dependentes ao arrastar") && dicaDaOrdem() === "por nome",
    dicaDaOrdem(),
  );
  itemDoMenu(docM, "Ajustes dos projetos", "Mostrar lista de etapas");
  itemDoMenu(docM, "Ajustes dos projetos", "Mover dependentes ao arrastar");
  itemDoMenu(docM, "Ajustes dos projetos", "Ordenar etapas");
  itemDoMenu(docM, "Ajustes dos projetos", "Exportar planilha (CSV)");
  itemDoMenu(docM, "Ajustes dos projetos", "Imprimir / salvar PDF");
  itemDoMenu(docM, "Ajustes dos projetos", "Projetos arquivados");
  checar("cada item faz o seu", feitos.join() === "lista:false,mover:true,ordem:cadastro,csv,pdf,arq", feitos);
  op.ordemEtapas = "cadastro";
  const dicaCadastro = dicaDaOrdem();
  itemDoMenu(docM, "Ajustes dos projetos", "Ordenar etapas");
  op.ordemEtapas = "inicio";
  const dicaInicio = dicaDaOrdem();
  itemDoMenu(docM, "Ajustes dos projetos", "Ordenar etapas");
  checar(
    "Ordenar etapas passa para a proxima ordem (e volta ao comeco)",
    dicaCadastro === "por cadastro" && dicaInicio === "por início" && feitos.slice(-2).join() === "ordem:inicio,ordem:nome",
    { dicaCadastro, dicaInicio, feitos },
  );
  const comExt = criarMenuAjustes(() => ({
    ...op,
    arquivados: 0,
    extensoes: {
      sincronia: () => [{ rotulo: "Sincronização…", fazer: () => undefined }],
      arquivo: () => [{ rotulo: "Enviar projeto por arquivo…", fazer: () => undefined }],
      fim: () => [{ rotulo: "Histórico de alterações", fazer: () => undefined }],
    },
  }));
  docM.getElementById("app")!.append(comExt);
  comExt.click();
  const rotulosExt = [...docM.querySelectorAll(".spro-menu-pop [role='menuitem']")].map((i) => texto(i.querySelector(".spro-menu-rotulo")));
  comExt.click();
  checar("sem arquivados, o item some", !rotulosExt.includes("Projetos arquivados"));
  checar(
    "extensoes do P4 entram no lugar delas",
    rotulosExt[0] === "Sincronização…" &&
      rotulosExt.at(-2) === "Enviar projeto por arquivo…" &&
      rotulosExt.at(-1) === "Histórico de alterações",
    rotulosExt,
  );

  secao("app: primeiro uso (vazio)");
  const docV = telaDoApp();
  const acoes: string[] = [];
  const vazio = montarVazio({ aoCriar: () => acoes.push("criar"), aoModelo: () => acoes.push("modelo") });
  docV.getElementById("app")!.append(vazio);
  checar(
    "titulo e texto da tela 2",
    texto(vazio.querySelector("h3")) === "Acompanhe um trabalho do começo ao fim" && texto(vazio).includes("plano anual"),
  );
  botao(vazio, "Criar projeto")!.click();
  botao(vazio, "Começar de um modelo")!.click();
  checar("criar e comecar de um modelo", acoes.join() === "criar,modelo");
  checar("sem servidor do Atividades (ou sem importacao), sem o link", !vazio.querySelector("a"));
  const comImportar = montarVazio({ aoCriar: () => undefined, aoModelo: () => undefined, aoImportar: () => acoes.push("importar") });
  (comImportar.querySelector("a") as HTMLAnchorElement).click();
  checar(
    "com importacao (P4), o link aparece e chama",
    acoes.at(-1) === "importar" && texto(comImportar.querySelector("a")) === "Importar meus projetos do servidor do Atividades",
  );
}
