/**
 * O vinculo opcional com a etapa do Gestor de Projetos (risco 6 do spec): teste de CONTRATO. Cria projeto e etapa pelo
 * `RepositorioProjetos` REAL (em `areaMemoria`) e confere que o Demandas as enxerga, so le, e so conclui a etapa com o
 * clique do usuario. Se o Projetos mudar o formato, e aqui que quebra.
 */

import { escoposDaUnidade as escoposProjetos } from "@projetos/modelo/escopo";
import { RepositorioProjetos } from "@projetos/repositorio";
import { moverPara } from "../src/app/acoes";
import { montarCampoEtapa, TEXTO_SEM_ETAPAS } from "../src/app/componentes/campoEtapa";
import { montarCartao } from "../src/app/componentes/cartao";
import { montarTabelaDemandas } from "../src/app/componentes/vistaTabela";
import { naTela } from "../src/app/dados";
import { abrirDialogoConclusao } from "../src/app/dialogos/concluir";
import { abrirDialogoDemanda } from "../src/app/dialogos/demanda";
import type { DepsApp } from "../src/app/tipos";
import { concluirEtapaDaDemanda, demandasDaEtapa, etapasAbertasDaUnidade, reposDosProjetos } from "../src/integracao/projetos";
import { iniciar } from "../src/modelo/operacoes";
import type { Demanda, EtapaRef } from "../src/modelo/tipos";
import { appDeTeste, dialogoAberto, escolherCombo, texto } from "./apoioApp";
import { demanda, HOJE } from "./fabrica";
import { botao, checar, secao, tique } from "./util";

const SEP = "␟";
const dlg = (t: ReturnType<typeof appDeTeste>) => dialogoAberto(t.doc) as HTMLElement;

/** Um Projetos com dados, na mesma area do app (as mesmas chaves do storage.local). */
function projetosDe(t: ReturnType<typeof appDeTeste>) {
  const esc = escoposProjetos("sei.exemplo.gov.br", "ana", "110000001");
  let n = 0;
  const carimbo = () => ({ agora: 1_790_000_000_000 + ++n * 1000, dispositivo: "dev-p", por: "ana", nome: "Ana Lima" });
  return { un: new RepositorioProjetos(t.area, esc.unidade, carimbo), eu: new RepositorioProjetos(t.area, esc.eu, carimbo) };
}

export async function verificarIntegracaoProjetos(): Promise<void> {
  secao("projetos: as etapas abertas da unidade (contrato com o RepositorioProjetos real)");
  const t = appDeTeste();
  const p = projetosDe(t);
  const repos = { unidade: p.un, eu: p.eu };
  checar("sem o Projetos (nenhum dado): lista vazia", (await etapasAbertasDaUnidade(repos)).length === 0);
  const projX = await p.un.criarProjeto({ nome: "Projeto X" });
  const etY = await p.un.criarEtapa({ projeto: projX.id, nome: "Etapa Y", inicio: "2026-10-01", fim: "2026-10-30" });
  const etZ = await p.un.criarEtapa({ projeto: projX.id, nome: "Etapa Z", inicio: "2026-10-01", fim: "2026-11-30" });
  const projVelho = await p.un.criarProjeto({ nome: "Projeto velho" });
  await p.un.criarEtapa({ projeto: projVelho.id, nome: "De projeto arquivado", inicio: "2026-10-01", fim: "2026-10-30" });
  const etFeita = await p.un.criarEtapa({ projeto: projX.id, nome: "Ja feita", inicio: "2026-10-01", fim: "2026-10-05" });
  const etRemovida = await p.un.criarEtapa({ projeto: projX.id, nome: "Removida", inicio: "2026-10-01", fim: "2026-10-30" });
  await p.un.concluirEtapa(etFeita.id, "2026-10-05");
  await p.un.removerEtapa(etRemovida.id);
  await p.un.arquivarProjeto(projVelho.id);
  const projEu = await p.eu.criarProjeto({ nome: "So meu" });
  const etEu = await p.eu.criarEtapa({ projeto: projEu.id, nome: "Minha etapa", inicio: "2026-10-01", fim: "2026-10-30" });
  const lista = await etapasAbertasDaUnidade(repos);
  checar(
    "lista a etapa com o rotulo Projeto > Etapa; concluida, de projeto arquivado e excluida nao aparecem; a do escopo eu aparece",
    lista.map((e) => e.rotulo).join("|") === "Projeto X > Etapa Y|Projeto X > Etapa Z|So meu > Minha etapa",
    lista.map((e) => e.rotulo),
  );
  checar(
    "cada uma leva os ids do projeto e da etapa",
    lista[0]?.projeto === projX.id &&
      lista[0]?.etapa === etY.id &&
      lista[2]?.etapa === etEu.id &&
      lista.every((e) => e.concluida === false),
  );
  checar("o Demandas so le: nada novo foi gravado pelo Projetos", (await p.un.dados()).etapas.length === 4);

  secao("projetos: o campo Etapa do projeto");
  {
    const vazio = montarCampoEtapa({ carregar: async () => [] });
    await tique(5);
    checar(
      "sem projeto com etapas abertas: o texto avisa e o campo fica desabilitado",
      vazio.combo.el.disabled && texto(vazio.combo.el).includes(TEXTO_SEM_ETAPAS) && vazio.escolhida() === undefined,
      texto(vazio.combo.el),
    );
    const guardada: EtapaRef = { projeto: projX.id, etapa: etY.id, rotulo: "Projeto antigo > Nome antigo" };
    const semProjetos = montarCampoEtapa({ atual: guardada, carregar: async () => [] });
    await tique(5);
    checar(
      "sem o Projetos mas com etapa guardada: mostra o rotulo guardado, habilitado, e devolve a mesma",
      !semProjetos.combo.el.disabled && texto(semProjetos.combo.el).includes("Nome antigo") && semProjetos.escolhida()?.etapa === etY.id,
      texto(semProjetos.combo.el),
    );
    const falha = montarCampoEtapa({ carregar: () => Promise.reject(new Error("storage")) });
    await tique(5);
    checar("a leitura que falha nao derruba o campo", falha.escolhida() === undefined);
    // A etapa RENOMEADA no Projetos continua ligada pelo id; com o Projetos disponivel, o campo mostra o nome atual.
    await p.un.editarEtapa(etY.id, { nome: "Etapa Y renomeada" }, HOJE);
    const renomeada = montarCampoEtapa({ atual: guardada, carregar: () => etapasAbertasDaUnidade(repos) });
    await tique(10);
    checar(
      "etapa renomeada: ligada pelo id, o campo mostra o nome atual (o guardado so fica velho ate a proxima edicao)",
      renomeada.escolhida()?.etapa === etY.id &&
        renomeada.escolhida()?.rotulo === "Projeto X > Etapa Y renomeada" &&
        guardada.rotulo === "Projeto antigo > Nome antigo",
      renomeada.escolhida(),
    );
  }

  secao("projetos: vincular, trocar e remover no dialogo da demanda");
  {
    const etW = await p.un.criarEtapa({ projeto: projX.id, nome: "Etapa W", inicio: "2026-10-01", fim: "2026-10-30" });
    const ta = appDeTeste({ etapasDoProjetos: () => etapasAbertasDaUnidade(repos) });
    const d = await ta.repos.unidade.criar({ titulo: "Vinculavel", prazo: "2026-10-20", distribuidaEm: "2026-10-05" });
    const viva = naTela((await ta.repos.unidade.obter(d.id)) as Demanda, "unidade", HOJE);
    void abrirDialogoDemanda(ta.deps, { demanda: viva });
    await tique(20);
    const opcoes = [...ta.doc.querySelectorAll(".spro-combo-pop [role='option']")].length;
    void opcoes;
    escolherCombo(dlg(ta), "Etapa do projeto", `${projX.id}${SEP}${etZ.id}`);
    botao(dlg(ta), "Gravar")!.click();
    await tique(20);
    const vinculada = (await ta.repos.unidade.obter(d.id)) as Demanda;
    checar(
      "vincular grava etapa { projeto, etapa, rotulo }",
      vinculada.etapa?.projeto === projX.id && vinculada.etapa.etapa === etZ.id && vinculada.etapa.rotulo === "Projeto X > Etapa Z",
      vinculada.etapa,
    );
    const regs = await ta.repos.unidade.registros.listar();
    checar(
      "o historico registra o campo etapa",
      regs.some((r) => r.demanda === d.id && r.campo === "etapa" && r.depois === "Projeto X > Etapa Z"),
    );
    void abrirDialogoDemanda(ta.deps, { demanda: naTela(vinculada, "unidade", HOJE) });
    await tique(20);
    escolherCombo(dlg(ta), "Etapa do projeto", `${projX.id}${SEP}${etW.id}`);
    botao(dlg(ta), "Gravar")!.click();
    await tique(20);
    const trocada = (await ta.repos.unidade.obter(d.id)) as Demanda;
    checar("trocar grava a nova", trocada.etapa?.etapa === etW.id && trocada.etapa.rotulo === "Projeto X > Etapa W");
    void abrirDialogoDemanda(ta.deps, { demanda: naTela(trocada, "unidade", HOJE) });
    await tique(20);
    escolherCombo(dlg(ta), "Etapa do projeto", "");
    botao(dlg(ta), "Gravar")!.click();
    await tique(20);
    const solta = (await ta.repos.unidade.obter(d.id)) as Demanda;
    const regs2 = await ta.repos.unidade.registros.listar();
    checar(
      "remover tira o vinculo e o historico registra",
      solta.etapa === undefined && regs2.filter((r) => r.demanda === d.id && r.campo === "etapa").length === 3,
    );
  }

  secao("projetos: Concluir tambem a etapa");
  {
    const caixaDeConcluir = async (ref: EtapaRef | undefined, etapas: DepsApp["etapasDoProjetos"]) => {
      const tc = appDeTeste(etapas ? { etapasDoProjetos: etapas } : {});
      const d = await tc.repos.unidade.criar({
        titulo: "Para concluir",
        prazo: "2026-10-20",
        distribuidaEm: "2026-10-05",
        ...(ref ? { etapa: ref } : {}),
      });
      await tc.repos.unidade.aplicar(d.id, iniciar);
      const viva = (await tc.repos.unidade.obter(d.id)) as Demanda;
      return { tc, viva };
    };
    const aberta: EtapaRef = { projeto: projX.id, etapa: etZ.id, rotulo: "Projeto X > Etapa Z" };
    const { tc, viva } = await caixaDeConcluir(aberta, () => etapasAbertasDaUnidade(repos));
    const pr = abrirDialogoConclusao(tc.deps, viva);
    await tique(20);
    const linha = dlg(tc).querySelector(".dem-concluir-etapa") as HTMLElement;
    const marca = linha.querySelector("input") as HTMLInputElement;
    checar(
      "etapa aberta: oferece Concluir tambem a etapa, desmarcado por padrao",
      !linha.hidden && !marca.checked && texto(linha).includes("Concluir também a etapa?"),
      texto(linha),
    );
    botao(dlg(tc), "Concluir")!.click();
    const r = await pr;
    checar("sem marcar: a resposta e so a conclusao", JSON.stringify(r) === JSON.stringify({ data: HOJE }), r);
    const p2 = abrirDialogoConclusao(tc.deps, viva);
    await tique(20);
    const m2 = dlg(tc).querySelector(".dem-concluir-etapa input") as HTMLInputElement;
    m2.checked = true;
    botao(dlg(tc), "Concluir")!.click();
    const r2 = await p2;
    checar("marcado: a resposta pede a etapa", r2?.concluirEtapa === true && r2.data === HOJE, r2);
    const semEtapa = await caixaDeConcluir(undefined, () => etapasAbertasDaUnidade(repos));
    void abrirDialogoConclusao(semEtapa.tc.deps, semEtapa.viva);
    await tique(20);
    checar("demanda sem etapa: nao oferece", (dlg(semEtapa.tc).querySelector(".dem-concluir-etapa") as HTMLElement).hidden);
    const fechada = await caixaDeConcluir({ ...aberta, etapa: etFeita.id }, () => etapasAbertasDaUnidade(repos));
    void abrirDialogoConclusao(fechada.tc.deps, fechada.viva);
    await tique(20);
    checar("etapa ja concluida: nao oferece", (dlg(fechada.tc).querySelector(".dem-concluir-etapa") as HTMLElement).hidden);

    // O fluxo completo (moverPara): marcado, conclui a demanda e a etapa; so avisa o resto.
    const fluxo = await caixaDeConcluir(aberta, () => etapasAbertasDaUnidade(repos));
    const chamadas: EtapaRef[] = [];
    fluxo.tc.deps.concluirEtapa = async (ref) => {
      chamadas.push(ref);
      return concluirEtapaDaDemanda(repos, ref, HOJE);
    };
    const alvo = naTela(fluxo.viva, "unidade", HOJE);
    const feito = moverPara(fluxo.tc.deps, alvo, "concluida");
    await tique(20);
    (dlg(fluxo.tc).querySelector(".dem-concluir-etapa input") as HTMLInputElement).checked = true;
    botao(dlg(fluxo.tc), "Concluir")!.click();
    checar("moverPara conclui", (await feito) === true);
    const depois = (await fluxo.tc.repos.unidade.obter(fluxo.viva.id)) as Demanda;
    checar(
      "a demanda foi concluida e a etapa tambem (concluirSeAberta do Projetos)",
      depois.concluidaEm === HOJE && chamadas.length === 1 && (await p.un.obterEtapa(etZ.id))?.concluidaEm === HOJE,
    );
    const sem = await caixaDeConcluir(aberta, () => etapasAbertasDaUnidade(repos));
    let chamou = 0;
    sem.tc.deps.concluirEtapa = async () => {
      chamou += 1;
      return "concluida";
    };
    const f2 = moverPara(sem.tc.deps, naTela(sem.viva, "unidade", HOJE), "concluida");
    await tique(20);
    botao(dlg(sem.tc), "Concluir")!.click();
    await f2;
    checar("sem marcar a caixa, a etapa nao e tocada", chamou === 0);
  }

  secao("projetos: etapa ja concluida ou removida nao da erro");
  {
    const ref = (e: string): EtapaRef => ({ projeto: projX.id, etapa: e, rotulo: "x" });
    checar(
      "etapa aberta: concluida",
      (await concluirEtapaDaDemanda(repos, ref(etY.id), HOJE)) === "concluida" && (await p.un.obterEtapa(etY.id))?.concluidaEm === HOJE,
    );
    checar(
      "de novo: ja_estava (e a data da conclusao nao muda)",
      (await concluirEtapaDaDemanda(repos, ref(etY.id), "2026-12-01")) === "ja_estava" &&
        (await p.un.obterEtapa(etY.id))?.concluidaEm === HOJE,
    );
    checar(
      "removida ou inexistente: nao_encontrada",
      (await concluirEtapaDaDemanda(repos, ref(etRemovida.id), HOJE)) === "nao_encontrada" &&
        (await concluirEtapaDaDemanda(repos, ref("nao-existe"), HOJE)) === "nao_encontrada",
    );
    checar(
      "projeto trocado no vinculo: nao_encontrada",
      (await concluirEtapaDaDemanda(repos, { projeto: "outro", etapa: etEu.id, rotulo: "x" }, HOJE)) === "nao_encontrada",
    );
    checar(
      "etapa do escopo eu tambem conclui",
      (await concluirEtapaDaDemanda(repos, { projeto: projEu.id, etapa: etEu.id, rotulo: "x" }, HOJE)) === "concluida",
    );
    const reais = reposDosProjetos(t.area, { host: "sei.exemplo.gov.br", login: "ana" }, "110000001", () => ({
      agora: 1,
      dispositivo: "d",
    }));
    checar("reposDosProjetos le as mesmas chaves do Projetos", (await reais.unidade.dados()).projetos.length === 2);
  }

  secao("projetos: demandasDaEtapa e a etapa na tela");
  {
    const a = naTela(demanda({ id: "a", etapa: { projeto: "p", etapa: "e1", rotulo: "P > E1" } }), "unidade", HOJE);
    const b = naTela(demanda({ id: "b", etapa: { projeto: "p", etapa: "e2", rotulo: "P > E2" } }), "unidade", HOJE);
    const c = naTela(demanda({ id: "c" }), "unidade", HOJE);
    checar(
      "devolve so as ligadas a etapa",
      demandasDaEtapa([a, b, c], "e1")
        .map((x) => x.demanda.id)
        .join() === "a" && demandasDaEtapa([a, b, c], "zz").length === 0,
    );
    const cartao = montarCartao(a, { hoje: HOJE, itensDoMenu: () => [] });
    checar(
      "o cartao mostra a etapa (com o rotulo no title)",
      texto(cartao.querySelector(".dem-cartao-etapa")) === "P > E1" &&
        cartao.querySelector(".dem-cartao-etapa")?.getAttribute("title")?.includes("P > E1") === true,
    );
    checar(
      "sem etapa, o cartao nao tem a linha",
      !montarCartao(c, { hoje: HOJE, itensDoMenu: () => [] }).querySelector(".dem-cartao-etapa"),
    );
    const tabela = montarTabelaDemandas({
      itens: [a, c],
      hoje: HOJE,
      ordenar: { coluna: "prazo", sentido: 1 },
      aoOrdenar: () => undefined,
      itensDoMenu: () => [],
      aoEditarInline: async () => undefined,
      selecionadas: new Set(),
      aoSelecionar: () => undefined,
    });
    checar(
      "a Tabela mostra a etapa so na linha que tem",
      [...tabela.querySelectorAll(".dem-etapa")].map((e) => texto(e)).join() === "P > E1",
    );
  }
}
