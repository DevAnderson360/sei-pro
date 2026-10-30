import { areaMemoria } from "@comum/armazenamento/area";
import { alertasDaUnidade, carregarUnidade, etapasComFaseViva, montarUnidade } from "../src/app/dados";
import { dataCurta, plural, quandoRelativo, resumoDoUltimoRegistro, textoDiasUteis, textoDoRegistro } from "../src/app/formato";
import {
  chaveAberto,
  escalaDoProjeto,
  gravarPreferencias,
  lerPreferencias,
  normalizarPreferencias,
  PREFERENCIAS_PADRAO,
} from "../src/app/preferencias";
import { SEM_SINCRONIA } from "../src/app/sincronia";
import { CHAVE_PREFERENCIAS } from "../src/modelo/constantes";
import { contarChips, FILTRO_VAZIO, filtrarEtapas } from "../src/modelo/filtro";
import type { Registro } from "../src/modelo/tipos";
import { MODELOS_EMBUTIDOS } from "../src/modelos/embutidos";
import { ESCOPO_EU, ESCOPO_UN, novoRepo } from "./apoioRepositorio";
import { etapa, fase, HOJE, projeto } from "./fabrica";
import { checar, secao } from "./util";

const registro = (m: Partial<Registro>): Registro => ({
  id: "r1",
  alvo: "e1",
  projeto: "p1",
  quando: new Date(2026, 9, 4, 10).getTime(),
  por: "carla",
  nome: "Carla Dias",
  campo: "fim",
  atualizadoEm: 1,
  dispositivo: "d",
  ...m,
});

export async function verificarAppBase(): Promise<void> {
  secao("app: preferencias (spec 5.4)");
  const padrao = normalizarPreferencias(undefined);
  checar(
    "padroes: lista ligada, mover dependentes, inicio, Mes no Todos, Gantt",
    padrao.mostrarLista &&
      padrao.moverDependentes &&
      padrao.ordemEtapas === "inicio" &&
      padrao.escalaTodos === "Mês" &&
      padrao.vista === "gantt",
  );
  const lixo = normalizarPreferencias({
    mostrarLista: "sim",
    ordemEtapas: "aleatoria",
    escalas: { p1: "Dia", p2: "Década", p3: 7 },
    escalaTodos: "Semana",
    vista: "kanban",
    recolhidas: ["f1", 3, "f2"],
    filtro: { situacoes: ["atrasadas", "nada"], soMinhas: true, responsaveis: "x", fases: ["f1"] },
  });
  checar(
    "valores estranhos voltam ao padrao, os bons ficam",
    lixo.mostrarLista === true &&
      lixo.ordemEtapas === "inicio" &&
      JSON.stringify(lixo.escalas) === '{"p1":"Dia"}' &&
      lixo.escalaTodos === "Semana" &&
      lixo.vista === "gantt" &&
      lixo.recolhidas.join() === "f1,f2",
    lixo,
  );
  checar(
    "filtro gravado e conferido campo a campo",
    lixo.filtro.situacoes.join() === "atrasadas" &&
      lixo.filtro.soMinhas &&
      lixo.filtro.responsaveis.length === 0 &&
      lixo.filtro.fases.join() === "f1",
  );
  checar("escala do projeto sem registro: Semana", escalaDoProjeto(lixo, "p9") === "Semana" && escalaDoProjeto(lixo, "p1") === "Dia");
  const area = areaMemoria();
  await gravarPreferencias(area, { mostrarLista: false });
  await gravarPreferencias(area, { recolhido: true });
  const lidas = await lerPreferencias(area);
  checar("gravar mescla com o que ja estava", !lidas.mostrarLista && lidas.recolhido && lidas.moverDependentes);
  const grande = Object.fromEntries(Array.from({ length: 260 }, (_, i) => [`p${i}`, "Dia"]));
  await area.gravar({ [CHAVE_PREFERENCIAS]: { ...PREFERENCIAS_PADRAO, escalas: grande } });
  checar("mapa de escalas tem teto (nao cresce para sempre)", Object.keys((await lerPreferencias(area)).escalas).length === 200);
  checar("chave do projeto aberto por unidade", chaveAberto("sei.x.gov.br", "Ana", "110") === "sei.x.gov.br|ana|u:110");

  secao("app: formato");
  checar("data curta", dataCurta("2026-10-06") === "06/10");
  checar("plural", plural(1, "atrasada", "atrasadas") === "1 atrasada" && plural(3, "atrasada", "atrasadas") === "3 atrasadas");
  checar("dias uteis", textoDiasUteis(1) === "1 dia útil" && textoDiasUteis(23) === "23 dias úteis");
  checar("registro de termino", textoDoRegistro(registro({ antes: "2026-09-25", depois: "2026-10-02" })) === "término 25/09 → 02/10");
  checar("registro de criacao da etapa", textoDoRegistro(registro({ campo: "criacao", depois: "AIR" }), "etapa") === "criou a etapa");
  checar(
    "registro de conclusao e de reabertura",
    textoDoRegistro(registro({ campo: "conclusao", depois: "2026-10-06" })) === "concluiu (06/10)" &&
      textoDoRegistro(registro({ campo: "conclusao", antes: "2026-10-06" })) === "reabriu",
  );
  checar("registro de progresso", textoDoRegistro(registro({ campo: "progresso", antes: "20", depois: "60" })) === "progresso 20% → 60%");
  const agora = new Date(2026, 9, 6, 15).getTime();
  checar(
    "quando relativo",
    quandoRelativo(new Date(2026, 9, 6, 8).getTime(), agora) === "hoje" &&
      quandoRelativo(new Date(2026, 9, 5, 23).getTime(), agora) === "ontem" &&
      quandoRelativo(new Date(2026, 9, 4).getTime(), agora) === "há 2 dias" &&
      quandoRelativo(new Date(2026, 6, 1).getTime(), agora) === "em 01/07/2026",
  );
  checar("resumo do ultimo registro (tela 2)", resumoDoUltimoRegistro(registro({}), agora) === "Carla Dias alterou o término há 2 dias");

  secao("app: dados da unidade (dois escopos)");
  const fases = [fase({ id: "f1", projeto: "p1" })];
  const etapas = [etapa({ id: "e1", fase: "f1" }), etapa({ id: "e2", fase: "morta" })];
  checar(
    "fase morta vira sem fase",
    etapasComFaseViva(etapas, fases)
      .map((e) => e.fase ?? "-")
      .join() === "f1,-",
  );
  const u = montarUnidade(
    [
      {
        vis: "unidade",
        dados: {
          projetos: [projeto({ id: "p1", ordem: "a1" }), projeto({ id: "arq", ordem: "a0", arquivadoEm: 5 })],
          fases,
          etapas: [...etapas, etapa({ id: "x", projeto: "arq" })],
          modelos: [],
        },
      },
      {
        vis: "eu",
        dados: {
          projetos: [projeto({ id: "p2", ordem: "a0" })],
          fases: [],
          etapas: [etapa({ id: "e3", projeto: "p2", inicio: "2026-09-01", fim: "2026-09-30" })],
          modelos: [{ id: "m1", nome: "Meu modelo", fases: [], etapas: [], criadoEm: 1, atualizadoEm: 1, dispositivo: "d" }],
        },
      },
    ],
    HOJE,
  );
  checar("abas na ordem manual, misturando os escopos", u.ativos.map((p) => `${p.projeto.id}:${p.vis}`).join() === "p2:eu,p1:unidade");
  checar("arquivado fica de fora das abas", u.arquivados.map((p) => p.projeto.id).join() === "arq");
  checar("cada projeto leva so as suas etapas", u.ativos[1]?.etapas.length === 2 && u.ativos[1]?.etapas[1]?.fase === undefined);
  checar("resumo calculado", u.ativos[0]?.resumo.atrasadas === 1 && u.ativos[0]?.resumo.total === 1);
  checar("modelos: os 3 embutidos e depois os salvos", u.modelos.length === MODELOS_EMBUTIDOS.length + 1 && u.modelos.at(-1)?.vis === "eu");
  const al = alertasDaUnidade(u.ativos, HOJE);
  checar(
    "alertas somam os projetos ativos",
    al.atrasadas === 1 && al.comAtraso.join() === "p2" && al.semana === 2 && al.comSemana.join() === "p1",
  );
  const area2 = areaMemoria();
  const { repo: un } = novoRepo(ESCOPO_UN, area2, "u");
  const { repo: eu } = novoRepo(ESCOPO_EU, area2, "e");
  const p = await un.criarProjeto({ nome: "Da unidade" });
  await eu.criarProjeto({ nome: "Meu" });
  await un.criarEtapa({ projeto: p.id, nome: "Etapa", inicio: "2026-10-05", fim: "2026-10-09" });
  const lida = await carregarUnidade({ unidade: un, eu }, HOJE);
  checar(
    "carregar le os dois escopos do repositorio",
    lida.ativos.length === 2 && lida.ativos.some((x) => x.vis === "eu" && x.projeto.nome === "Meu"),
  );

  secao("app: chip 'vence nesta semana' no filtro");
  const lista = [
    etapa({ id: "sem", inicio: "2026-10-01", fim: "2026-10-09" }),
    etapa({ id: "prox", inicio: "2026-10-20", fim: "2026-10-30" }),
    etapa({ id: "feita", inicio: "2026-10-01", fim: "2026-10-08", concluidaEm: "2026-10-05" }),
  ];
  const so = filtrarEtapas(lista, { ...FILTRO_VAZIO, situacoes: ["semana"] }, HOJE, { login: "ana" });
  checar("filtro 'semana' traz so o que vence ate sexta", so.map((e) => e.id).join() === "sem");
  checar("contagem do chip", contarChips(lista, HOJE).semana === 1);

  secao("app: sincronia (ponto de extensao do P4)");
  checar("sem provedor: 'neste navegador'", SEM_SINCRONIA.estado().rotulo === "neste navegador" && SEM_SINCRONIA.estado().tom === "local");
}
