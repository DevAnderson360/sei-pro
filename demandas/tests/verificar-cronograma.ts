import type { Linha, LinhaEtapa, LinhaFase } from "@projetos/gantt/linhas";
import { naTela } from "../src/app/dados";
import { demandasComoLinhas } from "../src/gantt/demandasComoLinhas";
import { appDeTeste, dialogoAberto, digitar, fecharDialogo, nova, texto } from "./apoioApp";
import { demanda, HOJE } from "./fabrica";
import { ganttFalso } from "./ganttFalso";
import { botao, checar, secao, tique } from "./util";

const soEtapas = (l: readonly Linha[]): LinhaEtapa[] => l.filter((x): x is LinhaEtapa => x.tipo === "etapa");
const soFases = (l: readonly Linha[]): LinhaFase[] => l.filter((x): x is LinhaFase => x.tipo === "fase");

function verificarLinhas(): void {
  const t = (m: Parameters<typeof demanda>[0]) => naTela(demanda(m), "unidade", HOJE);
  const ana = { login: "ana", nome: "Ana Lima" };
  const itens = [
    t({ id: "a", responsavel: ana, distribuidaEm: "2026-10-01", prazo: "2026-10-05" }),
    t({
      id: "b",
      responsavel: ana,
      iniciadaEm: 1,
      distribuidaEm: "2026-10-05",
      prazo: "2026-10-30",
      checklist: [
        { id: "1", texto: "x", feito: true },
        { id: "2", texto: "y", feito: false },
      ],
    }),
    t({
      id: "c",
      responsavel: { nome: "Carla Dias" },
      iniciadaEm: 1,
      concluidaEm: "2026-10-08",
      distribuidaEm: "2026-10-01",
      prazo: "2026-10-10",
    }),
    t({ id: "d", distribuidaEm: "2026-10-15", prazo: "2026-10-20" }),
  ];
  secao("Demandas como linhas do Gantt");
  const linhas = demandasComoLinhas(itens, { hoje: HOJE, agrupar: "responsavel" });
  const etapas = soEtapas(linhas);
  checar("uma linha por demanda", etapas.length === 4);
  checar(
    "o id da linha e o da demanda",
    etapas
      .map((l) => l.id)
      .sort()
      .join() === "a,b,c,d",
  );
  const por = (id: string) => etapas.find((l) => l.id === id) as LinhaEtapa;
  checar("atrasada", por("a").situacao === "atrasada");
  checar("iniciada e andamento, progresso pelo checklist", por("b").situacao === "andamento" && por("b").progresso === 50);
  checar("concluida", por("c").situacao === "concluida" && por("c").progresso === 100);
  checar("nao iniciada e futura", por("d").situacao === "futura" && por("d").progresso === 0);
  checar("datas: da distribuicao ao prazo", por("b").etapa.inicio === "2026-10-05" && por("b").etapa.fim === "2026-10-30");
  checar("a etapa sintetica e do projeto 'demandas', sem marco", por("b").etapa.projeto === "demandas" && !por("b").etapa.marco);
  const fases = soFases(linhas);
  checar(
    "agrupa por responsavel, com 'Sem responsavel' no fim",
    fases.length === 3 && fases[0]?.fase.nome === "Ana Lima" && fases[fases.length - 1]?.fase.nome === "Sem responsável",
  );
  checar("cada linha de grupo vem antes das suas demandas", linhas[0]?.tipo === "fase" && linhas[1]?.tipo === "etapa");
  checar(
    "agrupar por situacao muda os grupos",
    soFases(demandasComoLinhas(itens, { hoje: HOJE, agrupar: "situacao" }))
      .map((l) => l.fase.nome)
      .join("|") === "Não iniciada|Iniciada|Concluída",
  );
  checar(
    "nenhuma linha traz dependencia (R3 e roteiro)",
    etapas.every((l) => l.dependeDe.length === 0 && l.etapa.dependeDe.length === 0),
  );
  checar("ids de grupo distintos dos ids de demanda", new Set(linhas.map((l) => l.id)).size === linhas.length);
  const invertida = demandasComoLinhas([t({ id: "z", distribuidaEm: "2026-10-10", prazo: "2026-10-01" })], {
    hoje: HOJE,
    agrupar: "situacao",
  });
  const z = soEtapas(invertida)[0] as LinhaEtapa;
  checar("prazo antes da distribuicao nao inverte a barra", z.etapa.inicio === "2026-10-10" && z.etapa.fim === "2026-10-10");
}

const aba = (t: ReturnType<typeof appDeTeste>) => (t.raiz.querySelector('[data-aba="cronograma"]') as HTMLElement).click();

async function verificarVista(): Promise<void> {
  secao("cronograma: montagem, clique e escala");
  {
    const g = ganttFalso();
    const t = appDeTeste({ montarGantt: g.montar });
    const a = await nova(t, "unidade", "Alfa", "nao_iniciada", { responsavel: { login: "ana", nome: "Ana Lima" } });
    await nova(t, "unidade", "Beta");
    await nova(t, "eu", "Gama");
    await t.montar();
    aba(t);
    checar("o Gantt e montado uma vez", g.a.montagens === 1);
    const linhas = g.a.linhas[0] ?? [];
    checar("uma barra por demanda e um grupo por responsavel", soEtapas(linhas).length === 3 && soFases(linhas).length === 2);
    checar(
      "a lista a esquerda tem uma linha por linha do Gantt",
      t.raiz.querySelectorAll(".dem-cron-demanda, .dem-cron-fase").length === linhas.length,
    );
    checar("cabecalho da lista", [...t.raiz.querySelectorAll(".dem-cron-lista-cab span")].map((s) => texto(s)).join() === "Demanda,Resp.");
    checar("sem dependencias nem mover dependentes", g.opcoes()?.moverDependentes === false && g.opcoes()?.mostrarLista === true);
    checar(
      "o titulo vai como texto e com title",
      texto(t.raiz.querySelector(`.dem-cron-demanda[data-id="${a}"] .dem-cron-nome`)) === "Alfa",
    );

    g.opcoes()?.aoClicar?.(a, t.raiz);
    await tique(20);
    checar("clicar numa barra abre a demanda certa", texto(dialogoAberto(t.doc)?.querySelector("h2")) === "Editar demanda");
    checar("com o titulo da demanda", (dialogoAberto(t.doc)?.querySelector("[name=titulo]") as HTMLInputElement | null)?.value === "Alfa");
    fecharDialogo(t.doc);
    await tique(10);

    (t.raiz.querySelector('[data-escala="Mês"]') as HTMLElement).click();
    await tique(20);
    checar("trocar a escala remonta com a escala nova", g.opcoes()?.escala === "Mês");
    checar("e persiste a preferencia", (await t.deps.preferencias.ler()).escalaCronograma === "Mês");
    (t.raiz.querySelector('[data-agrupar="situacao"]') as HTMLElement).click();
    await tique(20);
    checar(
      "trocar o agrupamento persiste e regrupa",
      (await t.deps.preferencias.ler()).agrupamentoCronograma === "situacao" && soFases(g.a.linhas.at(-1) ?? []).length === 1,
    );
  }

  secao("cronograma: arrastar datas");
  {
    const g = ganttFalso();
    const t = appDeTeste({ montarGantt: g.montar });
    const a = await nova(t, "unidade", "Alfa");
    const enc = await nova(t, "unidade", "Feita", "concluida");
    await t.montar();
    aba(t);
    const op = () => g.opcoes() as NonNullable<ReturnType<typeof g.opcoes>>;
    const original = await t.repos.unidade.obter(a);
    checar("a demanda de partida", original?.distribuidaEm === "2026-10-01" && original.prazo === "2026-10-20");

    checar("arrastar uma demanda aberta e aceito", op().validar?.([{ id: a, inicio: "2026-10-03", fim: "2026-10-20" }]) === null);
    checar(
      "fim antes do inicio e recusado",
      (op().validar?.([{ id: a, inicio: "2026-10-10", fim: "2026-10-09" }]) ?? "").includes("antes da distribuição"),
    );
    checar("o grupo nao arrasta", (op().validar?.([{ id: "fase-l_ana", inicio: "2026-10-03", fim: "2026-10-04" }]) ?? "") !== "");
    checar(
      "demanda concluida nao arrasta (Demanda encerrada)",
      (op().validar?.([{ id: enc, inicio: "2026-10-03", fim: "2026-10-10" }]) ?? "").startsWith("Demanda encerrada"),
    );

    op().aoMudarDatas?.([{ id: a, inicio: "2026-10-03", fim: "2026-10-20" }]);
    await tique(30);
    const depois = await t.repos.unidade.obter(a);
    checar(
      "arrastar o inicio grava distribuidaEm sem abrir dialogo",
      depois?.distribuidaEm === "2026-10-03" && depois.prazo === "2026-10-20" && !dialogoAberto(t.doc),
    );

    const antes = g.a.montagens;
    op().aoMudarDatas?.([{ id: a, inicio: "2026-10-03", fim: "2026-10-25" }]);
    await tique(30);
    const dlg = dialogoAberto(t.doc);
    checar(
      "arrastar o fim abre a prorrogacao com o novo prazo preenchido",
      texto(dlg?.querySelector("h2")) === "Prorrogar prazo" &&
        (dlg?.querySelector("[name=prazo]") as HTMLInputElement | null)?.value === "2026-10-25",
    );
    checar(
      "o texto de prazo atual segue o da demanda",
      texto(dlg).includes("20 de outubro de 2026") || texto(dlg).includes("20/10"),
      texto(dlg),
    );
    fecharDialogo(t.doc);
    await tique(30);
    checar("cancelar nao grava o prazo", (await t.repos.unidade.obter(a))?.prazo === "2026-10-20");
    checar("e o Gantt e redesenhado como estava", g.a.montagens > antes);

    op().aoMudarDatas?.([{ id: a, inicio: "2026-10-03", fim: "2026-10-25" }]);
    await tique(30);
    const dlg2 = dialogoAberto(t.doc) as HTMLElement;
    botao(dlg2, "Prorrogar")!.click();
    await tique(20);
    checar("sem motivo a prorrogacao nao grava", (await t.repos.unidade.obter(a))?.prazo === "2026-10-20" && !!dialogoAberto(t.doc));
    digitar(dialogoAberto(t.doc)?.querySelector("[name=motivo]"), "Mais tempo");
    botao(dialogoAberto(t.doc) as HTMLElement, "Prorrogar")!.click();
    await tique(40);
    checar("com o motivo, grava o novo prazo", (await t.repos.unidade.obter(a))?.prazo === "2026-10-25");

    op().aoMudarDatas?.([{ id: a, inicio: "2026-10-05", fim: "2026-10-28" }]);
    await tique(30);
    fecharDialogo(t.doc);
    await tique(30);
    const c = await t.repos.unidade.obter(a);
    checar(
      "mover a barra inteira e cancelar o prazo nao grava nem a distribuicao",
      c?.distribuidaEm === "2026-10-03" && c.prazo === "2026-10-25",
    );
  }

  secao("cronograma: falha da Frappe e vazio");
  {
    const g = ganttFalso({ falhar: true });
    const t = appDeTeste({ montarGantt: g.montar });
    await nova(t, "unidade", "Alfa");
    await t.montar();
    aba(t);
    await tique(20);
    checar(
      "a falha cai para a Tabela com o aviso",
      !!t.raiz.querySelector(".dem-tabela") && texto(t.doc.querySelector(".spro-aviso")).includes("Não foi possível desenhar o cronograma"),
    );
    const vazio = appDeTeste({ montarGantt: ganttFalso().montar });
    await vazio.montar();
    aba(vazio);
    checar("sem demandas, mostra o vazio e nao monta o Gantt", !vazio.raiz.querySelector(".dem-cron"));
  }
}

async function verificarLargura(): Promise<void> {
  secao("cronograma: preencher a largura");
  {
    const m = { colunas: 10, largura: 1000 };
    const g = ganttFalso({ medidas: m });
    const t = appDeTeste({ montarGantt: g.montar });
    await nova(t, "unidade", "Alfa");
    const app = await t.montar();
    aba(t);
    await tique(20);
    checar("grade mais estreita que o conteiner: um unico render", g.a.renders === 1);

    // Troca de escala (o app remonta): Mes = 120 x 10 = 1200 > 1000, nada muda.
    (t.raiz.querySelector('[data-escala="Mês"]') as HTMLElement).click();
    await tique(20);
    checar("grade ja mais larga: sem novo render", g.a.renders === 1);

    // Voltar ao Dia (280 < 1000): calcula de novo a partir do valor original da escala.
    (t.raiz.querySelector('[data-escala="Dia"]') as HTMLElement).click();
    await tique(20);
    checar("trocar a escala recalcula", g.a.renders === 2);

    m.largura = 3000;
    app.aoRedimensionar();
    await tique(20);
    checar("aoRedimensionar recalcula", g.a.renders === 3);
  }
  {
    // Valores exatos pelo modulo, sem o app.
    const { preencherLargura } = await import("../src/app/componentes/vistaCronograma");
    const mk = (escala: "Dia" | "Mês", cw: number, colunas: number, larg: number) => {
      let renders = 0;
      const g = {
        dates: new Array(colunas).fill(0),
        config: { column_width: cw },
        $container: { clientWidth: larg, scrollLeft: 7 },
        render: () => (renders += 1),
      };
      const c = { escala, gantt: g } as unknown as Parameters<typeof preencherLargura>[0];
      return { g, c, renders: () => renders };
    };
    const a = mk("Dia", 28, 16, 1000);
    preencherLargura(a.c);
    checar("coluna escalada (floor(1000/16) = 62)", a.g.config.column_width === 62 && a.renders() === 1 && a.g.$container.scrollLeft === 7);
    preencherLargura(a.c);
    checar("idempotente: nada de novo render", a.renders() === 1);
    a.g.$container.clientWidth = 2000;
    preencherLargura(a.c);
    checar("janela maior recalcula do original", a.g.config.column_width === 125 && a.renders() === 2);
    a.g.$container.clientWidth = 300;
    preencherLargura(a.c);
    checar("janela menor volta ao original, nunca abaixo", a.g.config.column_width === 28 && a.renders() === 3);
    const b = mk("Mês", 120, 16, 1000);
    preencherLargura(b.c);
    checar("grade ja larga nao muda", b.g.config.column_width === 120 && b.renders() === 0);
    const d = mk("Dia", 28, 2, 10000);
    preencherLargura(d.c);
    checar("teto de 8x", d.g.config.column_width === 224);
    let lancou = false;
    try {
      preencherLargura({ escala: "Dia", gantt: null } as unknown as Parameters<typeof preencherLargura>[0]);
      preencherLargura(null);
    } catch {
      lancou = true;
    }
    checar("sem gantt (falha da Frappe) nao lanca", !lancou);
  }
}

export async function verificarCronograma(): Promise<void> {
  verificarLinhas();
  await verificarVista();
  await verificarLargura();
}
