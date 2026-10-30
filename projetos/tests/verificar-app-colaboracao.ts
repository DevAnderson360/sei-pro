/**
 * O estado da sincronia no app (ao lado das abas e na dica), os dois
 * consentimentos (aviso único da unidade, convite do pessoal) e o repositório
 * da unidade que pergunta o "Entendi" antes de gravar.
 */

import { readdir, readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { consentimentoNaArea, definirConsentimento } from "@comum/sincronia/consentimento";
import { MotorTextoPadrao, type StatusSync, textoDoErro } from "@comum/sincronia/motor";
import type { AbrirModal } from "@comum/ui/dialogo";
import { comConsentimento, consentidor, MENSAGEM_SEM_ENTENDI, METODOS_QUE_GRAVAM } from "../src/app/colaboracao/consentir";
import {
  EstadoDaSincronia,
  estadoDaSincronia,
  linhaDoTexto,
  type SituacaoSincronia,
  type SituacaoTexto,
} from "../src/app/colaboracao/estado";
import { indicadorDeSincronia } from "../src/app/componentes/abas";
import { avisoDaUnidade, faixaAguardando, faixaConvite, pedirConsentimentoPessoal } from "../src/app/dialogos/consentimento";
import { ErroMemoriaSigilo } from "../src/modelo/memoriaSigilo";
import { nenhumNumero } from "../src/modelo/sigilo";
import type { EnvelopeProjetos } from "../src/modelo/tipos";
import { moverEntreEscopos, RepositorioProjetos } from "../src/repositorio";
import { CHAVE_CONSENTIMENTO, chaveDoConsentimento } from "../src/sincronia/consentimento";
import { adaptadorProjetos, chaveRelatorio, chaveStatusTexto, MENSAGEM_MUDOU } from "../src/sincronia/textoPadrao";
import { telaDoApp, texto } from "./apoioApp";
import { ESCOPO_EU, ESCOPO_UN, novoRepo } from "./apoioRepositorio";
import { HOSTIL } from "./cenarioGantt";
import { botao, checar, lanca, secao, tique } from "./util";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AGORA = Date.UTC(2026, 9, 6, 12);
const DIA = 86_400_000;
const ESCOPOS = { unidade: ESCOPO_UN, eu: ESCOPO_EU };
const SEM_TEMPORIZADOR = { definir: () => 0, cancelar: () => undefined };

function modais(doc: Document) {
  const abertos: Array<{ titulo: string; conteudo: HTMLElement; fechar(): void }> = [];
  const abrirModal: AbrirModal = (o) => {
    doc.body.append(o.conteudo);
    const m = {
      titulo: o.titulo,
      conteudo: o.conteudo,
      fechar: () => {
        o.conteudo.remove();
        o.aoFechar?.();
      },
    };
    abertos.push(m);
    return m;
  };
  return { abrirModal, abertos };
}

const st = (m: Partial<StatusSync>): StatusSync => ({ estado: "ok", quando: AGORA, ultimoOk: AGORA, pendente: false, ...m });
const texto_ = (vis: "unidade" | "eu", m: Partial<SituacaoTexto> = {}): SituacaoTexto => ({
  vis,
  nome: vis === "unidade" ? "[_SEIPRO_PRJ_UNIDADE]" : "[_SEIPRO_PRJ_ana]",
  consentimento: "nao-perguntado",
  ...m,
});
const situ = (u: Partial<SituacaoTexto> = {}, e: Partial<SituacaoTexto> = {}): SituacaoSincronia => ({
  unidade: texto_("unidade", u),
  eu: texto_("eu", e),
});

/** Área que conta as escritas (gravar e remover). */
function contada(base: Area = areaMemoria()) {
  let escritas = 0;
  const area: Area = {
    ...base,
    gravar: async (i) => {
      escritas++;
      await base.gravar(i);
    },
    remover: async (k) => {
      escritas++;
      await base.remover(k);
    },
  };
  return { area, escritas: () => escritas };
}

async function fontes(pasta: string): Promise<Array<{ nome: string; codigo: string }>> {
  const saida: Array<{ nome: string; codigo: string }> = [];
  for (const e of await readdir(pasta, { withFileTypes: true })) {
    const p = join(pasta, e.name);
    if (e.isDirectory()) saida.push(...(await fontes(p)));
    else if (e.name.endsWith(".ts")) saida.push({ nome: p.slice(RAIZ.length + 1), codigo: await readFile(p, "utf8") });
  }
  return saida;
}

export async function verificarAppColaboracao(): Promise<void> {
  const doc = telaDoApp();

  secao("app: estado da sincronia ao lado das abas");
  const e0 = estadoDaSincronia(situ(), AGORA);
  checar("nada ainda: neste navegador", e0.tom === "local" && e0.rotulo === "neste navegador", e0);
  const e1 = estadoDaSincronia(situ({ status: st({}) }), AGORA + 120_000);
  checar("unidade lida e gravada: sincronizado", e1.tom === "ok" && e1.rotulo === "sincronizado" && /há 2 min/.test(e1.dica), e1);
  checar("o pessoal desligado nao conta", /Só eu: Desligado/.test(e1.dica));
  checar("alteracoes a enviar: pendente", estadoDaSincronia(situ({ status: st({ pendente: true }) }), AGORA).tom === "pendente");
  const e3 = estadoDaSincronia(situ({ status: st({ estado: "nunca", aguardandoPermissao: true }) }), AGORA);
  checar("esperando o Entendi: pendente, com a explicacao", e3.tom === "pendente" && /Entendi/.test(e3.dica), e3);
  const e4 = estadoDaSincronia(situ({ status: st({ estado: "erro", pendente: true, mensagem: MENSAGEM_MUDOU }) }), AGORA);
  checar("desistiu porque um colega gravava junto: brando (pendente, nao erro)", e4.tom === "pendente" && /colega/.test(e4.dica), e4);
  const e5 = estadoDaSincronia(situ({ status: st({ estado: "erro", mensagem: "Sessão do SEI expirada." }) }), AGORA);
  checar("sessao expirada: erro com a mensagem", e5.tom === "erro" && /Sessão do SEI expirada/.test(e5.dica));
  const e6 = estadoDaSincronia(situ({ status: st({}), relatorio: { quando: AGORA, ignorados: 2, excedentes: 0, futuros: 2 } }), AGORA);
  checar(
    "relogio atrasado: erro, com o que fazer",
    e6.tom === "erro" && /relógio deste computador parece atrasado/.test(e6.dica) && /2 alterações/.test(e6.dica),
    e6,
  );
  const e6b = estadoDaSincronia(
    situ(
      { status: st({}) },
      { consentimento: "ligado", status: st({}), relatorio: { quando: AGORA, ignorados: 1, excedentes: 0, futuros: 1 } },
    ),
    AGORA,
  );
  checar(
    "relogio atrasado no pessoal: as alteracoes sao de outro computador (nao de colegas)",
    e6b.tom === "erro" && /Só eu: .*1 alteração feita em outro computador ficou de fora/.test(e6b.dica) && !/colegas/.test(e6b.dica),
    e6b,
  );
  const e7 = estadoDaSincronia(situ({ status: st({ estado: "indisponivel", mensagem: "Indisponível nesta unidade." }) }), AGORA);
  checar("indisponivel (sem Textos Padrao): neste navegador, com o motivo", e7.tom === "local" && /Indisponível/.test(e7.dica), e7);
  const e8 = estadoDaSincronia(situ({ status: st({}) }, { consentimento: "ligado", status: st({ estado: "erro", mensagem: "x" }) }), AGORA);
  checar("o pessoal ligado com erro pesa", e8.tom === "erro");
  const e9 = estadoDaSincronia(
    situ({ status: st({}) }, { consentimento: "ligado", status: st({ estado: "indisponivel", mensagem: "Sem textos." }) }),
    AGORA,
  );
  checar("o pessoal ligado e indisponivel aparece na dica, mesmo calmo", e9.tom === "ok" && /Só eu: Sem textos\./.test(e9.dica), e9);
  checar(
    "linha do pessoal ligado sem rodada ainda",
    linhaDoTexto(texto_("eu", { consentimento: "ligado" }), AGORA) === "Ligado: falta abrir o Controle de Processos.",
  );
  checar("ha dias, no plural", /há 3 dias/.test(linhaDoTexto(texto_("unidade", { status: st({}) }), AGORA + 3 * DIA)));

  secao("app: mensagem do status vai como texto (dica e indicador)");
  const eh = estadoDaSincronia(situ({ status: st({ estado: "erro", mensagem: HOSTIL }) }), AGORA);
  const ih = indicadorDeSincronia(eh);
  checar(
    "mensagem hostil: tom erro, a dica a leva literal e o indicador nao monta nada",
    eh.tom === "erro" &&
      eh.dica.includes(HOSTIL) &&
      ih.getAttribute("title") === eh.dica &&
      !ih.querySelector("img") &&
      texto(ih) === "erro",
    { dica: eh.dica, html: ih.outerHTML },
  );

  secao("app: memoria do sigilo ilegivel aparece como erro (motor de verdade)");
  const baseQ = areaMemoria();
  let quebrada = false;
  const areaQ: Area = {
    ...baseQ,
    chaves: async () => {
      if (quebrada) throw new Error("storage ilegivel");
      return (await baseQ.chaves?.()) ?? [];
    },
  };
  const { repo: repoQ } = novoRepo(ESCOPO_UN, areaQ, "q");
  await repoQ.criarProjeto({ nome: "Qualquer" });
  quebrada = true;
  let gravouQ = false;
  const motorQ = new MotorTextoPadrao<EnvelopeProjetos>({
    adaptador: adaptadorProjetos({ repo: repoQ, area: areaQ, sigla: "SEPRO", nomeUsuario: "Ana Lima" }),
    destino: {
      ler: async () => null,
      gravar: async () => {
        gravouQ = true;
      },
    },
    area: areaQ,
    travar: (_n, fn) => fn(),
    agora: () => AGORA,
    releituras: 0,
    temporizador: SEM_TEMPORIZADOR,
  });
  const stQ = await motorQ.sincronizar({ forcar: true });
  const MSG_MEMORIA = new ErroMemoriaSigilo().message;
  checar("o motor para sem gravar e guarda a mensagem generica", stQ.estado === "erro" && stQ.mensagem === MSG_MEMORIA && !gravouQ, stQ);
  const provQ = new EstadoDaSincronia({ area: areaQ, sync: areaMemoria(), escopos: ESCOPOS, agora: () => AGORA });
  await provQ.iniciar();
  const eQ = provQ.estado();
  const iQ = indicadorDeSincronia(eQ);
  checar(
    "o indicador mostra erro com a mensagem, como texto no title",
    eQ.tom === "erro" &&
      eQ.rotulo === "erro" &&
      eQ.dica.includes(`Toda a unidade: Erro: ${MSG_MEMORIA}`) &&
      iQ.getAttribute("title") === eQ.dica &&
      !iQ.querySelector("img"),
    eQ,
  );
  provQ.parar();

  secao("app: quem so le o texto da unidade ve o recuo calmo (motor de verdade)");
  const noSei = { html: null as string | null };
  const areaB = areaMemoria();
  const { repo: repoB } = novoRepo({ ...ESCOPO_UN, login: "bia" }, areaB, "b");
  const motorB = new MotorTextoPadrao<EnvelopeProjetos>({
    adaptador: adaptadorProjetos({ repo: repoB, area: areaB, sigla: "SEPRO", nomeUsuario: "Bia" }),
    destino: {
      ler: async () => noSei.html,
      gravar: async (html) => {
        noSei.html = html;
      },
    },
    area: areaB,
    travar: (_n, fn) => fn(),
    agora: () => AGORA,
    releituras: 0,
    temporizador: SEM_TEMPORIZADOR,
  });
  await repoB.criarProjeto({ nome: "Do colega" });
  await motorB.sincronizar({ forcar: true });
  const areaA = areaMemoria();
  const { repo: repoA } = novoRepo(ESCOPO_UN, areaA, "a");
  let relogioA = AGORA;
  const motorA = new MotorTextoPadrao<EnvelopeProjetos>({
    adaptador: adaptadorProjetos({ repo: repoA, area: areaA, sigla: "SEPRO", nomeUsuario: "Ana Lima" }),
    destino: {
      ler: async () => noSei.html,
      gravar: async () => {
        throw Object.assign(new Error("sem o link de alterar"), { codigo: "SEI_ACAO_INDISPONIVEL" });
      },
    },
    area: areaA,
    travar: (_n, fn) => fn(),
    agora: () => relogioA,
    releituras: 0,
    lerNoRecuo: true,
    temporizador: SEM_TEMPORIZADOR,
  });
  repoA.aoMudar(() => void motorA.agendarEnvio());
  // Ontem a gravação foi recusada (só o link de consultar): o recuo de um dia está valendo, sem pendência.
  await areaA.gravar({
    [chaveStatusTexto(ESCOPO_UN)]: {
      estado: "indisponivel",
      quando: AGORA - 600_000,
      ultimoPuxar: AGORA - 600_000,
      indisponivelAte: AGORA + DIA,
      pendente: false,
      mensagem: textoDoErro({ codigo: "SEI_ACAO_INDISPONIVEL" }).mensagem,
    } satisfies StatusSync,
  });
  await motorA.sincronizar();
  await tique(10);
  const stA = (await areaA.obter(chaveStatusTexto(ESCOPO_UN)))[chaveStatusTexto(ESCOPO_UN)] as StatusSync;
  checar(
    "no recuo, a puxada traz o projeto do colega e o motor marca pendente so por ter mesclado",
    stA.estado === "indisponivel" && stA.pendente && (await repoA.dados()).projetos.some((p) => p.nome === "Do colega"),
    stA,
  );
  const provA = new EstadoDaSincronia({ area: areaA, sync: areaMemoria(), escopos: ESCOPOS, agora: () => relogioA });
  await provA.iniciar();
  const eA = provA.estado();
  checar(
    "o indicador fica calmo: neste navegador, com o motivo, sem 'pendente', 'enviar' nem 'erro'",
    eA.tom === "local" && eA.rotulo === "neste navegador" && /Indisponível/.test(eA.dica) && !/pendente|enviar|erro/i.test(eA.dica),
    eA,
  );
  relogioA += 3 * 60_000;
  await motorA.sincronizar();
  await tique(10);
  checar("na puxada seguinte, continua calmo", provA.estado().tom === "local", provA.estado());
  provA.parar();

  secao("app: o provedor le o armazenamento e se refaz");
  const area = areaMemoria();
  const sync = areaMemoria();
  const prov = new EstadoDaSincronia({ area, sync, escopos: ESCOPOS, agora: () => AGORA });
  let avisos = 0;
  prov.aoMudar(() => avisos++);
  await prov.iniciar();
  checar("sem nada gravado: neste navegador", prov.estado().tom === "local");
  await area.gravar({ [chaveStatusTexto(ESCOPO_UN)]: st({}) });
  await tique(10);
  checar("o status do content script muda o estado", prov.estado().tom === "ok" && avisos >= 2, { avisos, e: prov.estado() });
  await area.gravar({ [chaveRelatorio(ESCOPO_UN)]: { quando: AGORA, ignorados: 1, excedentes: 0, futuros: 1 } });
  await tique(10);
  checar("o relatorio tambem", prov.estado().tom === "erro");
  await definirConsentimento(sync, CHAVE_CONSENTIMENTO, "textoPadrao", chaveDoConsentimento(ESCOPO_EU.host, "ana", "110", "eu"), "ligado");
  await tique(10);
  checar("o consentimento (storage.sync) tambem", prov.situacao().eu.consentimento === "ligado");
  const antes = avisos;
  await area.gravar({ "projetos/outra/chave": 1 });
  await tique(10);
  checar("chave que nao e da sincronia nao relê", avisos === antes);
  prov.parar();
  const depois = avisos;
  await area.gravar({ [chaveStatusTexto(ESCOPO_UN)]: st({ estado: "erro", mensagem: "x" }) });
  await tique(10);
  checar("parar: nao ouve mais", avisos === depois);

  const areaT = areaMemoria();
  await areaT.gravar({ [chaveStatusTexto(ESCOPO_UN)]: "lixo", [chaveRelatorio(ESCOPO_UN)]: { futuros: "muitos" } });
  const provT = new EstadoDaSincronia({ area: areaT, sync: areaMemoria(), escopos: ESCOPOS, agora: () => AGORA });
  await provT.iniciar();
  checar(
    "status e relatorio tortos no armazenamento: ignorados, sem NaN nem undefined na dica",
    provT.estado().tom === "local" && !/NaN|undefined/.test(provT.estado().dica),
    provT.estado(),
  );
  provT.parar();

  const syncQuebrado: Area = {
    ...areaMemoria(),
    obter: async () => {
      throw new Error("storage.sync fora");
    },
  };
  const areaS = areaMemoria();
  await areaS.gravar({ [chaveStatusTexto(ESCOPO_UN)]: st({}) });
  const provS = new EstadoDaSincronia({ area: areaS, sync: syncQuebrado, escopos: ESCOPOS, agora: () => AGORA });
  const erroS = await lanca(() => provS.iniciar());
  checar(
    "storage.sync que falha nao derruba o indicador (consentimento fica como estava)",
    erroS === null && provS.estado().tom === "ok" && provS.situacao().eu.consentimento === "nao-perguntado",
    { erroS, e: provS.estado() },
  );
  provS.parar();

  const rapida = areaMemoria();
  const atrasos: number[] = [];
  const lenta: Area = {
    ...rapida,
    obter: async (k) => {
      const v = await rapida.obter(k);
      await tique(atrasos.shift() ?? 0);
      return v;
    },
  };
  const provL = new EstadoDaSincronia({ area: lenta, sync: areaMemoria(), escopos: ESCOPOS, agora: () => AGORA });
  await provL.iniciar();
  atrasos.push(30);
  await rapida.gravar({ [chaveStatusTexto(ESCOPO_UN)]: st({ estado: "erro", mensagem: "velho" }) });
  await rapida.gravar({ [chaveStatusTexto(ESCOPO_UN)]: st({}) });
  await tique(80);
  checar("leituras em fila: a leitura lenta e velha nao vence a nova", provL.estado().tom === "ok", provL.estado());
  provL.parar();

  secao("app: aviso unico da unidade e consentimento do pessoal");
  const m = modais(doc);
  const r1 = avisoDaUnidade({ abrirModal: m.abrirModal, sigla: HOSTIL, nomeTexto: "[_SEIPRO_PRJ_UNIDADE]" });
  const aviso = m.abertos.at(-1)!;
  checar(
    "o aviso explica e tem so o Entendi",
    aviso.titulo === "Projetos de toda a unidade" &&
      texto(aviso.conteudo).includes("[_SEIPRO_PRJ_UNIDADE]") &&
      aviso.conteudo.querySelectorAll("button").length === 1 &&
      !aviso.conteudo.querySelector("img"),
    texto(aviso.conteudo),
  );
  checar("a sigla vai como texto", (aviso.conteudo.textContent ?? "").includes(HOSTIL));
  botao(aviso.conteudo, "Entendi")?.click();
  checar("Entendi = sim", (await r1) === true);
  const r2 = avisoDaUnidade({ abrirModal: m.abrirModal, sigla: "SEPRO", nomeTexto: "[_SEIPRO_PRJ_UNIDADE]" });
  m.abertos.at(-1)!.fechar();
  checar("fechar pelo X = nao", (await r2) === false);
  const r3 = pedirConsentimentoPessoal({ abrirModal: m.abrirModal, sigla: "SEPRO", nomeTexto: "[_SEIPRO_PRJ_ana]" });
  checar(
    "o pessoal tem Agora nao e Ligar",
    !!botao(m.abertos.at(-1)!.conteudo, "Agora não") && !!botao(m.abertos.at(-1)!.conteudo, "Ligar"),
  );
  botao(m.abertos.at(-1)!.conteudo, "Ligar")?.click();
  checar("Ligar = sim", (await r3) === true);
  const r4 = pedirConsentimentoPessoal({ abrirModal: m.abrirModal, sigla: "SEPRO", nomeTexto: "[_SEIPRO_PRJ_ana]" });
  botao(m.abertos.at(-1)!.conteudo, "Agora não")?.click();
  checar("Agora nao = nao", (await r4) === false);
  const r5 = pedirConsentimentoPessoal({ abrirModal: m.abrirModal, sigla: "SEPRO", nomeTexto: "[_SEIPRO_PRJ_ana]" });
  m.abertos.at(-1)!.fechar();
  checar("o pessoal fechado pelo X = nao", (await r5) === false);
  const feitos: string[] = [];
  const conv = faixaConvite({ aoLigar: () => feitos.push("ligar"), aoRecusar: () => feitos.push("recusar") });
  botao(conv, "Ligar…")?.click();
  botao(conv, "Agora não")?.click();
  checar("faixa-convite: Ligar… e Agora nao", feitos.join() === "ligar,recusar" && /outro computador/.test(texto(conv)));
  const ag = faixaAguardando({ sigla: HOSTIL, aoEntendi: () => feitos.push("entendi") });
  botao(ag, "Entendi")?.click();
  checar(
    "faixa de alteracoes esperando: Entendi, com a sigla como texto",
    feitos.at(-1) === "entendi" &&
      !ag.querySelector("img") &&
      (ag.textContent ?? "").includes(HOSTIL) &&
      ag.querySelectorAll("button").length === 1,
  );

  secao("app: o repositorio da unidade pergunta o Entendi antes de gravar");
  const { repo } = novoRepo(ESCOPO_UN, areaMemoria(), "c");
  let perguntas = 0;
  let resposta = false;
  const prefs = areaMemoria();
  const porta = consentimentoNaArea({ area: prefs, chavePreferencias: CHAVE_CONSENTIMENTO, campo: "textoPadrao", chave: "k|un" });
  const pode = consentidor(porta, async () => {
    perguntas++;
    await tique(5);
    return resposta;
  });
  const un = comConsentimento(repo, pode);
  checar("continua sendo o repositorio (escopo, instanceof)", un instanceof RepositorioProjetos && un.escopo.vis === "unidade");
  await un.dados();
  checar("ler nao pergunta", perguntas === 0);
  const e = await lanca(() => un.criarProjeto({ nome: "Sem o entendi" }));
  checar(
    "sem o Entendi: nada gravado e a mensagem explica",
    String((e as { mensagens?: string[] })?.mensagens) === MENSAGEM_SEM_ENTENDI && (await repo.dados()).projetos.length === 0,
    e,
  );
  resposta = true;
  const [a, b] = await Promise.all([un.criarProjeto({ nome: "Um" }), un.criarProjeto({ nome: "Dois" })]);
  checar("duas gravacoes juntas: uma pergunta so", perguntas === 2 && !!a.id && !!b.id, perguntas);
  checar("o Entendi fica gravado", (await porta.estado()) === "ligado");
  await un.criarProjeto({ nome: "Três" });
  checar("depois, nao pergunta mais", perguntas === 2 && (await repo.dados()).projetos.length === 3);

  secao("app: nenhum metodo do repositorio que grava escapa do Entendi");
  const nomes = Object.getOwnPropertyNames(RepositorioProjetos.prototype).filter((n) => n !== "constructor");
  // Públicos que só leem (ou só assinam avisos): cada um é chamado abaixo e não pode perguntar nem gravar.
  const LEITURAS: Record<string, (r: RepositorioProjetos, ids: { p: string; e: string }) => unknown> = {
    entidades: (r) => r.entidades(),
    dados: (r) => r.dados(),
    sigilosConhecidos: (r) => r.sigilosConhecidos(),
    exportarComConhecidos: (r) => r.exportarComConhecidos(AGORA),
    carimboAtual: (r) => r.carimboAtual(),
    historico: (r) => r.historico(),
    obterProjeto: (r, ids) => r.obterProjeto(ids.p),
    obterEtapa: (r, ids) => r.obterEtapa(ids.e),
    exportar: (r) => r.exportar(AGORA),
    vinculos: (r) => r.vinculos(),
    aoMudar: (r) => r.aoMudar(() => undefined)(),
  };
  // Gravam, mas nada que dependa do "Entendi" (motivo em `consentir.ts`).
  const FORA_DO_ENTENDI: Record<string, (r: RepositorioProjetos) => unknown> = {
    lapidarMovidos: () => undefined, // o fim de "mover para Só eu": provado na seção seguinte
    limpar: (r) => r.limpar(AGORA),
    registrar: (r) => r.registrar(),
    lembrarSigilo: (r) => r.lembrarSigilo(nenhumNumero(), "aprendida"),
    // A marca do sigilo visto na tela (decisão 10 da P5): a prova de que grava sem perguntar está em
    // `verificar-integracao-modelo.ts`; aqui, um número que nenhum vínculo tem.
    marcarSigiloso: (r) => r.marcarSigiloso("50300.000999/2026-99"),
    marcarSigilosos: (r) => r.marcarSigilosos(["50300.000999/2026-99"]),
  };
  // `private` no TypeScript: só a própria classe chama, com `this` = o repositório cru (sem passar pelo Proxy).
  const PRIVADOS = [
    "prefixoMemoria",
    "lerChaves",
    "memoria",
    "entradasPorOrigem",
    "entradas",
    "salvar",
    "marcasAoGravar",
    "podarHistorico",
    "apoio",
    "exigirVagaDeProjeto",
    "exigirProjeto",
    "etapasDoProjeto",
    "conferirEtapa",
    "gravarConclusao",
    "envelopeDe",
    "mesclarEm",
  ];
  const listas = [[...METODOS_QUE_GRAVAM], Object.keys(LEITURAS), Object.keys(FORA_DO_ENTENDI), PRIVADOS];
  const classificados = listas.flat();
  checar(
    "todo membro do prototipo esta numa lista (metodo novo tem de ser classificado)",
    nomes.every((n) => classificados.includes(n)),
    nomes.filter((n) => !classificados.includes(n)),
  );
  checar(
    "nenhum nome das listas sumiu do prototipo",
    classificados.every((n) => nomes.includes(n)),
    classificados.filter((n) => !nomes.includes(n)),
  );
  checar("as listas nao se cruzam", new Set(classificados).size === classificados.length);
  checar(
    "inclusive os acrescentados depois do plano (duplicar etapa, redefinir plano, restaurar)",
    ["duplicarEtapa", "duplicarProjeto", "redefinirPlanoOriginal", "restaurarProjeto", "restaurarEtapa"].every((n) =>
      METODOS_QUE_GRAVAM.has(n),
    ),
  );
  const fonteRepo = await readFile(join(RAIZ, "src/repositorio.ts"), "utf8");
  checar(
    "os da lista de privados sao private no fonte (o tsc recusa a chamada de fora)",
    PRIVADOS.every((n) => new RegExp(`\\bprivate\\s+(?:async\\s+|get\\s+)?${n}\\s*[(<]`).test(fonteRepo)),
    PRIVADOS.filter((n) => !new RegExp(`\\bprivate\\s+(?:async\\s+|get\\s+)?${n}\\s*[(<]`).test(fonteRepo)),
  );
  checar(
    "e os demais sao publicos (nao ha private escondido nas outras listas)",
    classificados
      .filter((n) => !PRIVADOS.includes(n))
      .every((n) => !new RegExp(`\\bprivate\\s+(?:async\\s+|get\\s+)?${n}\\s*[(<]`).test(fonteRepo)),
  );

  const cont = contada();
  const { repo: cru } = novoRepo(ESCOPO_UN, cont.area, "g");
  const pg = await cru.criarProjeto({ nome: "Gravado" });
  const eg = await cru.criarEtapa({ projeto: pg.id, nome: "Etapa", inicio: "2026-10-07", fim: "2026-10-09" });
  let perguntasG = 0;
  const negado = comConsentimento(cru, async () => {
    perguntasG++;
    return false;
  });
  const escritasAntes = cont.escritas();
  const escaparam: string[] = [];
  for (const nome of METODOS_QUE_GRAVAM) {
    const antesG = perguntasG;
    const err = await lanca(() => (negado as unknown as Record<string, () => Promise<unknown>>)[nome]?.());
    if (perguntasG !== antesG + 1 || String((err as { mensagens?: string[] } | null)?.mensagens) !== MENSAGEM_SEM_ENTENDI)
      escaparam.push(nome);
  }
  checar(
    `os ${METODOS_QUE_GRAVAM.size} metodos que gravam perguntam e, sem o Entendi, recusam sem tocar no armazenamento`,
    escaparam.length === 0 && cont.escritas() === escritasAntes,
    { escaparam, escritas: cont.escritas() - escritasAntes },
  );
  const perguntasAntes = perguntasG;
  for (const ler of Object.values(LEITURAS)) await ler(negado, { p: pg.id, e: eg.id });
  checar(
    "os que so leem passam direto: nenhuma pergunta e nenhuma escrita",
    perguntasG === perguntasAntes && cont.escritas() === escritasAntes,
    { perguntas: perguntasG - perguntasAntes, escritas: cont.escritas() - escritasAntes },
  );
  for (const gravar of Object.values(FORA_DO_ENTENDI)) await gravar(negado);
  checar(
    "limpar, registrar, a memoria do sigilo e marcar sigilo nao perguntam (nada disso poe coisa nova no texto)",
    perguntasG === perguntasAntes,
  );
  const codigo = (await fontes(join(RAIZ, "src"))).filter((f) => f.nome !== join("src", "repositorio.ts"));
  const porColecao = codigo.filter((f) =>
    /\.(projetos|fases|etapas|registros|modelos)\s*\.\s*(gravar|gravarVarios|apagar)\s*\(/.test(f.codigo),
  );
  checar(
    "fora do repositorio, ninguem grava pelas colecoes dele (o Proxy nao as embrulha)",
    porColecao.length === 0,
    porColecao.map((f) => f.nome),
  );

  secao("app: sair da unidade nao fica pela metade");
  const areaM = areaMemoria();
  const { repo: crua } = novoRepo(ESCOPO_UN, areaM, "m");
  const { repo: pessoal } = novoRepo(ESCOPO_EU, areaM, "n");
  const mover = await crua.criarProjeto({ nome: "Vai para Só eu" });
  let perguntou = false;
  const unidade = comConsentimento(crua, async () => {
    perguntou = true;
    return false;
  });
  await moverEntreEscopos(unidade, pessoal, mover.id);
  checar(
    "mover para 'Só eu' sem o Entendi: a copia vai e a unidade fica com a lapide (o texto espera o Entendi)",
    !perguntou && !!(await pessoal.obterProjeto(mover.id)) && !(await crua.obterProjeto(mover.id)),
  );
  const volta = await pessoal.criarProjeto({ nome: "Vai para a unidade" });
  const erroVolta = await lanca(() => moverEntreEscopos(pessoal, unidade, volta.id));
  checar(
    "levar para 'Toda a unidade' sem o Entendi: recusa e nada muda nos dois lados",
    perguntou &&
      String((erroVolta as { mensagens?: string[] } | null)?.mensagens) === MENSAGEM_SEM_ENTENDI &&
      !!(await pessoal.obterProjeto(volta.id)) &&
      !(await crua.obterProjeto(volta.id)),
    erroVolta,
  );
}
