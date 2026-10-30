/** Revisao final: o modo pagina em quadro, a etapa pessoal fora da unidade e o "Concluir tambem a etapa" que diz o que grava. */

import { escoposDaUnidade as escoposProjetos } from "@projetos/modelo/escopo";
import { RepositorioProjetos } from "@projetos/repositorio";
import { naTela } from "../src/app/dados";
import { abrirDialogoConclusao } from "../src/app/dialogos/concluir";
import { abrirDialogoDemanda } from "../src/app/dialogos/demanda";
import { ancestraisDaExtensao, MSG_PAGINA_EM_QUADRO, recusaDoModo } from "../src/app/modo";
import { etapasAbertasDaUnidade } from "../src/integracao/projetos";
import { iniciar } from "../src/modelo/operacoes";
import type { Demanda, EtapaRef } from "../src/modelo/tipos";
import { appDeTeste, dialogoAberto, escolherCombo, marcar, opcoesDoCombo, texto } from "./apoioApp";
import { HOJE } from "./fabrica";
import { botao, checar, secao, tique } from "./util";

const SEP = "␟";
const dlg = (t: ReturnType<typeof appDeTeste>) => dialogoAberto(t.doc) as HTMLElement;

export async function verificarRevisaoApp(): Promise<void> {
  secao("Revisao: o modo pagina recusa abrir dentro de um quadro");
  const topo = { noTopo: true, ancestraisSaoDaExtensao: false };
  const quadroExt = { noTopo: false, ancestraisSaoDaExtensao: true };
  const quadroFora = { noTopo: false, ancestraisSaoDaExtensao: false };
  checar(
    "pagina em quadro: recusa com mensagem curta",
    recusaDoModo("pagina", quadroFora) === MSG_PAGINA_EM_QUADRO && MSG_PAGINA_EM_QUADRO.length < 60,
  );
  checar("pagina em quadro da propria extensao: recusa", recusaDoModo("pagina", quadroExt) === MSG_PAGINA_EM_QUADRO);
  checar("pagina em tela cheia: abre", recusaDoModo("pagina", topo) === null);
  checar("lateral no topo: abre", recusaDoModo("lateral", topo) === null);
  checar("lateral em quadro com ancestrais so da extensao: abre", recusaDoModo("lateral", quadroExt) === null);
  checar("lateral com ancestral de outra origem: recusa", recusaDoModo("lateral", quadroFora) === MSG_PAGINA_EM_QUADRO);
  checar("embutido e livre", recusaDoModo("embutido", quadroFora) === null && recusaDoModo("embutido", topo) === null);
  const O = "chrome-extension://abc";
  checar("ancestorOrigins: so a extensao", ancestraisDaExtensao({ origin: O, ancestorOrigins: [O, O] }));
  checar("ancestorOrigins: um de fora", !ancestraisDaExtensao({ origin: O, ancestorOrigins: [O, "https://sei.exemplo.gov.br"] }));
  checar("sem ancestorOrigins: nao permitido", !ancestraisDaExtensao({ origin: O }));

  const t = appDeTeste();
  const esc = escoposProjetos("sei.exemplo.gov.br", "ana", "110000001");
  let n = 0;
  const carimbo = () => ({ agora: 1_790_000_000_000 + ++n * 1000, dispositivo: "dev-p", por: "ana", nome: "Ana Lima" });
  const un = new RepositorioProjetos(t.area, esc.unidade, carimbo);
  const eu = new RepositorioProjetos(t.area, esc.eu, carimbo);
  const repos = { unidade: un, eu };
  const pu = await un.criarProjeto({ nome: "Projeto da unidade" });
  const eUn = await un.criarEtapa({ projeto: pu.id, nome: "Etapa publica", inicio: "2026-10-01", fim: "2026-10-30" });
  const pe = await eu.criarProjeto({ nome: "PAD Fulano" });
  const eEu = await eu.criarEtapa({ projeto: pe.id, nome: "Instrucao", inicio: "2026-10-01", fim: "2026-10-30" });

  secao("Revisao: etapa de projeto pessoal nao vai para a unidade");
  const lista = await etapasAbertasDaUnidade(repos);
  checar(
    "cada etapa diz o escopo",
    lista.find((e) => e.etapa === eUn.id)?.vis === "unidade" && lista.find((e) => e.etapa === eEu.id)?.vis === "eu",
  );
  {
    const ta = appDeTeste({ etapasDoProjetos: () => etapasAbertasDaUnidade(repos) });
    void abrirDialogoDemanda(ta.deps, { vis: "unidade" });
    await tique(20);
    const ops = opcoesDoCombo(dlg(ta), "Etapa do projeto");
    checar(
      "demanda da unidade: so a etapa de projeto da unidade",
      ops.includes(`${pu.id}${SEP}${eUn.id}`) && !ops.includes(`${pe.id}${SEP}${eEu.id}`),
      ops,
    );
    const tb = appDeTeste({ etapasDoProjetos: () => etapasAbertasDaUnidade(repos) });
    void abrirDialogoDemanda(tb.deps, { vis: "eu" });
    await tique(20);
    marcar(dlg(tb).querySelector("input[value='eu']"));
    const opsEu = opcoesDoCombo(dlg(tb), "Etapa do projeto");
    checar("Só eu: as duas", opsEu.includes(`${pu.id}${SEP}${eUn.id}`) && opsEu.includes(`${pe.id}${SEP}${eEu.id}`), opsEu);
    // Escolhe a pessoal em "Só eu" e troca para a unidade: a etapa sai, com aviso.
    escolherCombo(dlg(tb), "Etapa do projeto", `${pe.id}${SEP}${eEu.id}`);
    marcar(dlg(tb).querySelector("input[value='eu']"), false);
    await tique(5);
    const caixa = dlg(tb).querySelector(".dem-erros") as HTMLElement;
    checar("trocar para a unidade limpa a etapa pessoal e avisa", !caixa.hidden && texto(caixa).includes("etapa"), texto(caixa));
    const botaoCombo = dlg(tb).querySelector('button[role="combobox"][aria-label="Etapa do projeto"]') as HTMLElement;
    checar("o campo volta a Nenhuma", !texto(botaoCombo).includes("Instrucao"), texto(botaoCombo));
    const opsDepois = opcoesDoCombo(dlg(tb), "Etapa do projeto");
    checar("e a pessoal sai da lista", !opsDepois.includes(`${pe.id}${SEP}${eEu.id}`), opsDepois);
  }

  secao("Revisao: Concluir tambem a etapa mostra o rotulo atual e o escopo");
  {
    const forjada: EtapaRef = { projeto: pu.id, etapa: eUn.id, rotulo: "Etapa trivial" };
    const tc = appDeTeste({ etapasDoProjetos: () => etapasAbertasDaUnidade(repos) });
    const d = await tc.repos.unidade.criar({ titulo: "Para concluir", prazo: "2026-10-20", distribuidaEm: "2026-10-05", etapa: forjada });
    await tc.repos.unidade.aplicar(d.id, iniciar);
    const viva = (await tc.repos.unidade.obter(d.id)) as Demanda;
    void abrirDialogoConclusao(tc.deps, viva);
    await tique(20);
    const linha = dlg(tc).querySelector(".dem-concluir-etapa") as HTMLElement;
    checar(
      "mostra o rotulo ATUAL, nao o guardado",
      !linha.hidden && texto(linha).includes("Projeto da unidade > Etapa publica") && !texto(linha).includes("Etapa trivial"),
      texto(linha),
    );
    checar("diz que a gravacao e em Toda a unidade", texto(linha).includes("Toda a unidade"), texto(linha));
    const pessoal: EtapaRef = { projeto: pe.id, etapa: eEu.id, rotulo: "qualquer" };
    const td = appDeTeste({ etapasDoProjetos: () => etapasAbertasDaUnidade(repos) });
    const d2 = await td.repos.eu.criar({ titulo: "Pessoal", prazo: "2026-10-20", distribuidaEm: "2026-10-05", etapa: pessoal });
    await td.repos.eu.aplicar(d2.id, iniciar);
    void abrirDialogoConclusao(td.deps, (await td.repos.eu.obter(d2.id)) as Demanda);
    await tique(20);
    const l2 = dlg(td).querySelector(".dem-concluir-etapa") as HTMLElement;
    checar(
      "etapa pessoal: diz Só eu e o rotulo atual",
      texto(l2).includes("Só eu") && texto(l2).includes("PAD Fulano > Instrucao"),
      texto(l2),
    );
    const te = appDeTeste({ etapasDoProjetos: async () => [] });
    const d3 = await te.repos.unidade.criar({ titulo: "Sumida", prazo: "2026-10-20", distribuidaEm: "2026-10-05", etapa: forjada });
    await te.repos.unidade.aplicar(d3.id, iniciar);
    void abrirDialogoConclusao(te.deps, (await te.repos.unidade.obter(d3.id)) as Demanda);
    await tique(20);
    checar("etapa que nao existe mais: nao oferece", (dlg(te).querySelector(".dem-concluir-etapa") as HTMLElement).hidden);
    void botao;
    void naTela;
    void HOJE;
  }
}
