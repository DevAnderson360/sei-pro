import { indicesEntre } from "@comum/ordem/indice";
import { carregarDados, etiquetasUsadas, naTela, responsaveisUsados } from "../src/app/dados";
import { lerTempo, rotuloDoPrazo, tempoHumano, tempoParaCampo } from "../src/app/formato";
import { EU, SEM_RESPONSAVEL } from "../src/modelo/filtro";
import { appDeTeste, digitar, escolherCombo, tecla, texto } from "./apoioApp";
import { demanda, HOJE } from "./fabrica";
import { botao, checar, secao, tique } from "./util";

const ANA = { login: "ana", nome: "Ana Lima" };
const CARLA = { login: "carla", nome: "Carla Dias" };

export async function verificarAppBase(): Promise<void> {
  secao("app: dados da tela");
  {
    const t = appDeTeste();
    await t.repos.unidade.criar({
      titulo: "Primeira",
      prazo: "2026-10-05",
      distribuidaEm: "2026-10-01",
      responsavel: ANA,
      etiquetas: ["Zeta", "alfa"],
    });
    await t.repos.eu.criar({ titulo: "Pessoal", prazo: "2026-10-30", distribuidaEm: "2026-10-01", etiquetas: ["Alfa"] });
    await t.repos.unidade.criar({ titulo: "Terceira", prazo: "2026-10-20", distribuidaEm: "2026-10-01", responsavel: CARLA });
    const dados = await carregarDados(t.repos, HOJE);
    checar("junta os dois escopos", dados.length === 3);
    checar(
      "marca o escopo de cada uma",
      dados.filter((x) => x.vis === "eu").length === 1 && dados.find((x) => x.demanda.titulo === "Pessoal")?.vis === "eu",
    );
    checar(
      "ordena pela ordem",
      dados.map((x) => x.demanda.titulo).join() === "Primeira,Pessoal,Terceira",
      dados.map((x) => x.demanda.titulo),
    );
    const p = dados[0]!;
    checar("calcula situacao, prazo e dias de atraso", p.situacao === "nao_iniciada" && p.prazo === "atrasada" && p.diasAtraso === 7, p);
    checar(
      "responsaveisUsados lista quem tem responsavel",
      responsaveisUsados(dados)
        .map((r) => r.nome)
        .join() === "Ana Lima,Carla Dias",
    );
    checar(
      "etiquetasUsadas junta sem repetir pela caixa",
      etiquetasUsadas(dados).join() === "alfa,Zeta" || etiquetasUsadas(dados).join() === "Alfa,Zeta",
      etiquetasUsadas(dados),
    );
    checar(
      "naTela de concluida no prazo",
      naTela(demanda({ id: "x", iniciadaEm: 1, concluidaEm: "2026-10-10" }), "unidade", HOJE).prazo === "concluida_no_prazo",
    );
  }

  secao("app: formato do tempo e do prazo");
  checar("tempoHumano 0", tempoHumano(0) === "0 min");
  checar("tempoHumano 90", tempoHumano(90) === "1 h 30 min");
  checar("tempoHumano 120", tempoHumano(120) === "2 h");
  checar("tempoHumano 45", tempoHumano(45) === "45 min");
  checar("tempoHumano sem valor", tempoHumano(undefined) === "—");
  checar("lerTempo 1h30", lerTempo("1h30") === 90);
  checar("lerTempo 1:30", lerTempo("1:30") === 90);
  checar("lerTempo 2h", lerTempo("2h") === 120);
  checar("lerTempo 45min", lerTempo("45min") === 45);
  checar("lerTempo 90", lerTempo("90") === 90);
  checar("lerTempo vazio", lerTempo("") === undefined);
  checar("lerTempo abc", lerTempo("abc") === null);
  checar("lerTempo recusa minutos acima de 59", lerTempo("1h75") === null && lerTempo("1:60") === null);
  checar(
    "tempoParaCampo ida e volta",
    [0, 45, 90, 120, 61].every((m) => lerTempo(tempoParaCampo(m)) === m),
  );
  const rot = (m: Parameters<typeof demanda>[0]) => rotuloDoPrazo(naTela(demanda(m), "unidade", HOJE), HOJE);
  checar("atrasada ha 3 dias", rot({ id: "a", prazo: "2026-10-09" }) === "Atrasada há 3 dias");
  checar("atrasada ha 1 dia", rot({ id: "a", prazo: "2026-10-11" }) === "Atrasada há 1 dia");
  checar("vence hoje", rot({ id: "a", prazo: HOJE }) === "Vence hoje");
  checar("vence em 5 dias", rot({ id: "a", prazo: "2026-10-17" }) === "Vence em 5 dias");
  checar("entregue no prazo", rot({ id: "a", iniciadaEm: 1, concluidaEm: "2026-10-10", prazo: "2026-10-12" }) === "Entregue no prazo");
  checar("entregue com atraso", rot({ id: "a", iniciadaEm: 1, concluidaEm: "2026-10-13", prazo: "2026-10-12" }) === "Entregue com atraso");

  secao("app: esqueleto e estado vazio");
  {
    const t = appDeTeste();
    const app = await t.montar();
    checar("titulo do cabecalho", texto(t.raiz.querySelector(".dem-titulo")) === "Demandas");
    checar("botao Nova demanda", !!botao(t.raiz, "Nova demanda"));
    for (const modo of ["lateral", "pagina"] as const) {
      const m = appDeTeste({ modo });
      await m.montar();
      checar(`modo ${modo} mantem o titulo`, texto(m.raiz.querySelector(".dem-titulo")) === "Demandas");
    }
    const emb = appDeTeste({ modo: "embutido" });
    await emb.montar();
    checar("modo embutido nao repete o titulo", !emb.raiz.querySelector(".dem-titulo") && !!botao(emb.raiz, "Nova demanda"));
    const abas = [...t.raiz.querySelectorAll('[role="tab"]')].map((a) => texto(a));
    checar("quatro abas de visao", abas.join() === "Tabela,Quadro,Cronograma,Painel", abas);
    checar(
      "comeca na visao da preferencia",
      t.raiz.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute("data-aba") === "tabela",
    );
    checar(
      "sem demandas: convite para criar a primeira",
      texto(t.raiz.querySelector(".dem-vazio h3")) === "Crie a primeira demanda" && !t.raiz.querySelector("table"),
    );
    checar("o convite tem o botao", !!botao(t.raiz.querySelector(".dem-vazio") as HTMLElement, "Nova demanda"));
    app.destruir();
    checar("destruir limpa a raiz", t.raiz.children.length === 0);
  }

  secao("app: trocar de visao e de escopo grava a preferencia");
  {
    const t = appDeTeste();
    await t.montar();
    await t.repos.unidade.criar({ titulo: "Uma", prazo: "2026-10-20", distribuidaEm: "2026-10-01" });
    await t.repos.eu.criar({ titulo: "Minha", prazo: "2026-10-20", distribuidaEm: "2026-10-01" });
    await tique(20);
    const linhas = () => [...t.raiz.querySelectorAll("tr.dem-tab-linha")].map((l) => texto(l.querySelector(".dem-titulo-texto")));
    checar("As duas mostra as duas", linhas().length === 2, linhas());
    (t.raiz.querySelector('[data-escopo="eu"]') as HTMLElement).click();
    checar("Só eu filtra por escopo", linhas().join() === "Minha", linhas());
    (t.raiz.querySelector('[data-escopo="unidade"]') as HTMLElement).click();
    checar("Toda a unidade filtra por escopo", linhas().join() === "Uma", linhas());
    await tique();
    checar("o escopo foi gravado", (await t.deps.preferencias.ler()).escopo === "unidade");
    (t.raiz.querySelector('[data-aba="painel"]') as HTMLElement).click();
    await tique();
    checar("a visao foi gravada", (await t.deps.preferencias.ler()).visao === "painel");
    checar("a aba muda", t.raiz.querySelector('[role="tab"][aria-selected="true"]')?.getAttribute("data-aba") === "painel");
  }

  secao("app: escopo Só eu no cartao");
  {
    const t = appDeTeste();
    await t.repos.unidade.criar({ titulo: "Uma", prazo: "2026-10-20", distribuidaEm: "2026-10-01" });
    await t.repos.eu.criar({ titulo: "Minha", prazo: "2026-10-20", distribuidaEm: "2026-10-01" });
    await t.montar();
    const linha = (titulo: string) => [...t.raiz.querySelectorAll("tr.dem-tab-linha")].find((l) => texto(l).includes(titulo));
    checar(
      "o escopo eu tem o selo",
      !!linha("Minha")?.querySelector(".dem-selo-eu") && texto(linha("Minha")?.querySelector(".dem-selo-eu")) === "Só eu",
    );
    checar("toda a unidade nao tem o selo", !linha("Uma")?.querySelector(".dem-selo-eu"));
  }

  secao("app: filtros");
  {
    const t = appDeTeste();
    await t.repos.unidade.criar({
      titulo: "Compra de notebooks",
      prazo: "2026-10-20",
      distribuidaEm: "2026-10-01",
      responsavel: ANA,
      etiquetas: ["ti"],
    });
    await t.repos.unidade.criar({
      titulo: "Revisão da norma",
      prazo: "2026-10-20",
      distribuidaEm: "2026-10-01",
      responsavel: CARLA,
      prioridade: "urgente",
    });
    await t.repos.unidade.criar({ titulo: "Sem dono", prazo: "2026-10-05", distribuidaEm: "2026-10-01" });
    await t.montar();
    const titulos = () => [...t.raiz.querySelectorAll("tr.dem-tab-linha")].map((l) => texto(l.querySelector(".dem-titulo-texto")));
    checar("sem filtro, as tres", titulos().length === 3);
    escolherCombo(t.raiz, "Responsável", EU);
    checar("Só minhas reduz a lista", titulos().join() === "Compra de notebooks", titulos());
    checar("o botao Limpar filtros aparece", !(botao(t.raiz, "Limpar filtros") as HTMLElement).hidden);
    botao(t.raiz, "Limpar filtros")!.click();
    checar("Limpar filtros volta a lista", titulos().length === 3);
    checar("e some de novo", (botao(t.raiz, "Limpar filtros") as HTMLElement).hidden);
    escolherCombo(t.raiz, "Responsável", SEM_RESPONSAVEL);
    checar("Sem responsável mostra as sem dono", titulos().join() === "Sem dono", titulos());
    botao(t.raiz, "Limpar filtros")!.click();
    digitar(t.raiz.querySelector("input[name='busca']"), "norma");
    checar("a busca por texto filtra", titulos().join() === "Revisão da norma", titulos());
    tecla(t.raiz.querySelector("input[name='busca']") as HTMLElement, "Escape");
    checar("Esc limpa a busca", titulos().length === 3 && (t.raiz.querySelector("input[name='busca']") as HTMLInputElement).value === "");
    botao(t.raiz, "Atrasadas")!.click();
    checar("o chip Atrasadas filtra", titulos().join() === "Sem dono", titulos());
    botao(t.raiz, "Atrasadas")!.click();
    botao(t.raiz, "Urgente")!.click();
    checar("o chip de prioridade filtra", titulos().join() === "Revisão da norma", titulos());
    botao(t.raiz, "Limpar filtros")!.click();
    escolherCombo(t.raiz, "Etiqueta", "ti");
    checar("a etiqueta filtra", titulos().join() === "Compra de notebooks", titulos());
    botao(t.raiz, "Limpar filtros")!.click();
    botao(t.raiz, "Concluídas")!.click();
    checar(
      "sem nenhuma bater, avisa e oferece limpar",
      texto(t.raiz.querySelector(".dem-nada")).startsWith("Nenhuma demanda com esses filtros"),
    );
    botao(t.raiz.querySelector(".dem-nada") as HTMLElement, "Limpar filtros")!.click();
    checar("o botao do aviso limpa", titulos().length === 3);
  }

  secao("app: faixa de limite do Texto Padrao (Review Focus 9)");
  {
    const aviso = [{ vis: "unidade" as const, tabela: "d" as const, faixa: "aviso" as const, percentual: 85, bytes: 87040 }];
    let t = appDeTeste({ tabelas: async () => aviso });
    await t.repos.unidade.criar({ titulo: "Uma", prazo: "2026-10-20", distribuidaEm: "2026-10-01" });
    await t.montar();
    const faixa = t.raiz.querySelector(".dem-faixa.aviso");
    checar(
      "faixa de aviso com o percentual",
      !!faixa && texto(faixa).includes("85%") && texto(faixa).includes("perto do limite do Texto Padrão"),
      texto(faixa),
    );
    checar("com a acao de arquivar antigas", !!botao(faixa as HTMLElement, "Arquivar concluídas antigas…"));
    checar("em aviso a criacao segue liberada", !(botao(t.raiz, "Nova demanda") as HTMLButtonElement).disabled);

    t = appDeTeste({ tabelas: async () => [{ vis: "unidade", tabela: "d", faixa: "bloqueio", percentual: 100, bytes: 102400 }] });
    await t.repos.unidade.criar({ titulo: "Uma", prazo: "2026-10-20", distribuidaEm: "2026-10-01" });
    await t.montar();
    checar(
      "faixa de bloqueio",
      !!t.raiz.querySelector(".dem-faixa.bloqueio") && texto(t.raiz.querySelector(".dem-faixa.bloqueio")).includes("passaram do limite"),
    );
    const nova = botao(t.raiz, "Nova demanda") as HTMLButtonElement;
    checar(
      "Nova demanda desabilitada com o motivo no title",
      nova.disabled && (nova.getAttribute("title") ?? "").includes("bloqueados"),
      nova.getAttribute("title"),
    );
    (t.raiz.querySelector('[data-escopo="eu"]') as HTMLElement).click();
    checar("em Só eu o limite da unidade nao vale", !(botao(t.raiz, "Nova demanda") as HTMLButtonElement).disabled);
  }

  secao("app: muitas demandas ativas");
  {
    const t = appDeTeste();
    const lote: Record<string, unknown> = {};
    const ordens = indicesEntre(null, null, 801);
    for (let i = 0; i < 801; i++) {
      const d = demanda({ id: `m${i}`, ordem: ordens[i] as string });
      lote[t.repos.unidade.demandas.chave(d.id)] = d;
    }
    await t.area.gravar(lote);
    await t.montar();
    checar(
      "a faixa de desempenho aparece",
      texto(t.raiz.querySelector(".dem-faixas")).includes("Muitas demandas ativas deixam a tela lenta"),
      texto(t.raiz.querySelector(".dem-faixas")),
    );
  }

  secao("app: reage a gravacoes de fora e erro de leitura");
  {
    const t = appDeTeste();
    await t.montar();
    await t.repos.unidade.criar({ titulo: "Veio de fora", prazo: "2026-10-20", distribuidaEm: "2026-10-01" });
    await tique(20);
    checar("redesenha sozinho ao gravar", texto(t.raiz.querySelector(".dem-tab-linha .dem-titulo-texto")) === "Veio de fora");
    let falhas = 1;
    const ruim = appDeTeste();
    const original = ruim.repos.unidade.dados.bind(ruim.repos.unidade);
    ruim.repos.unidade.dados = async () => {
      if (falhas-- > 0) throw new Error("storage fora");
      return original();
    };
    await ruim.montar();
    checar(
      "erro de leitura vira a faixa vermelha",
      texto(ruim.raiz.querySelector(".dem-faixa.bloqueio")).includes("Não foi possível ler as demandas"),
    );
    botao(ruim.raiz, "Tentar de novo")!.click();
    await tique(20);
    checar("Tentar de novo recarrega", !ruim.raiz.querySelector(".dem-faixa.bloqueio"));
  }
}
