/**
 * Rodada 1 da Tarefa 1 (P5): o vínculo vazio SEM a marca de sigilo (`{ protocolo: "" }`), vindo de fora (Texto
 * Padrão editado à mão, arquivo, cópia), é "sem processo". A regra de sigilo (`sigilo.ts`, que não muda) o via
 * como processo próprio nunca sigiloso, e o documento de uma etapa num projeto de processo sigiloso ia em claro ao
 * texto. Normalizado na fronteira: a entidade fica sem o campo `processo` e herda o processo do projeto.
 */

import { areaMemoria } from "@comum/armazenamento/area";
import { arquivoDoProjeto, lerArquivoDoProjeto, receberProjeto } from "../src/arquivo/projetoArquivo";
import { VINCULO_VAZIO } from "../src/modelo/sigilo";
import type { EnvelopeProjetos, Etapa, Projeto } from "../src/modelo/tipos";
import { chaveProtocolo } from "../src/modelo/vinculos";
import type { RepositorioProjetos } from "../src/repositorio";
import { type CopiaProjetos, type EnvelopeArquivo, importarTudo, restaurarCopia } from "../src/sincronia/arquivo";
import { paraOTexto, textoComoGravado } from "../src/sincronia/textoPadrao";
import { ESCOPO_UN, novoRepo, RELOGIO_INICIAL } from "./apoioRepositorio";
import { etapa, projeto } from "./fabrica";
import { checar, secao } from "./util";

const X = "50300.000777/2026-01";
const DOC = "4440001";
const DONO = { host: ESCOPO_UN.host, login: ESCOPO_UN.login };

async function textoDe(repo: RepositorioProjetos, agora: number): Promise<string> {
  const { envelope, conhecidos } = await repo.exportarComConhecidos(agora);
  return JSON.stringify(paraOTexto(envelope, agora, conhecidos));
}

const temProcesso = (x: object | undefined): boolean => !!x && "processo" in x;

/** Itens de fora, como um texto editado à mão os traria (carimbo de outro computador). */
const deFora = { atualizadoEm: RELOGIO_INICIAL, dispositivo: "pc-bia", criadoEm: RELOGIO_INICIAL };

async function verificarTexto(): Promise<void> {
  secao("rodada 1: vinculo vazio sem a marca vindo do texto vira sem processo (o cenario do revisor)");
  const { repo, relogio } = novoRepo(ESCOPO_UN, areaMemoria(), "t");
  const px = await repo.criarProjeto({ nome: "Apuração", processo: { protocolo: X, sigiloso: true } });
  await repo.importar({
    p: [projeto({ id: "pVazio", nome: "Sem processo de verdade", processo: { protocolo: "" }, ...deFora })],
    e: [
      etapa({ id: "vazia", projeto: px.id, processo: { protocolo: "" }, documento: { numero: DOC }, ...deFora }),
      // Sem dígito nenhum (a forma do vínculo aceita letras e pontuação): também não diz processo nenhum.
      etapa({ id: "semDigito", projeto: px.id, processo: { protocolo: "SEI-" }, documento: { numero: "4440002" }, ...deFora }),
      // O marcador da P4 (processo sigiloso sem número) continua processo próprio.
      etapa({ id: "marcada", projeto: px.id, processo: VINCULO_VAZIO, documento: { numero: "4440003" }, ...deFora }),
      etapa({ id: "comNumero", projeto: px.id, processo: { protocolo: "50300.000888/2026-02" }, ...deFora }),
    ],
  });
  const texto = await textoDe(repo, relogio());
  checar(
    "o documento da etapa de processo vazio (e o da sem digito) nao vai ao texto",
    !texto.includes(DOC) && !texto.includes("4440002"),
    texto.match(/444000\d/g),
  );
  const [vazia, semDigito, marcada, comNumero] = await Promise.all(
    ["vazia", "semDigito", "marcada", "comNumero"].map((id) => repo.obterEtapa(id)),
  );
  checar(
    "a etapa fica sem o campo processo (herda o do projeto) e o documento dela, marcado",
    !!vazia && !temProcesso(vazia) && vazia.documento?.sigiloso === true && !!semDigito && !temProcesso(semDigito),
    { vazia: vazia?.processo, semDigito: semDigito?.processo, doc: vazia?.documento },
  );
  checar("o projeto de fora com o vinculo vazio fica sem processo", !temProcesso(await repo.obterProjeto("pVazio")));
  checar(
    "o marcador e o numero de verdade ficam como vieram",
    JSON.stringify(marcada?.processo) === JSON.stringify(VINCULO_VAZIO) && comNumero?.processo?.protocolo === "50300.000888/2026-02",
    { marcada: marcada?.processo, comNumero: comNumero?.processo },
  );
  const doProjeto = (await repo.vinculos()).get(chaveProtocolo(X))?.[0];
  checar(
    "no indice, as duas ficam sob o processo do projeto (papel projeto)",
    doProjeto?.papel === "projeto" &&
      ["vazia", "semDigito"].every((id) => doProjeto.etapas.some((e) => e.id === id)) &&
      !doProjeto.etapas.some((e) => e.id === "marcada" || e.id === "comNumero"),
    doProjeto?.etapas.map((e) => e.id),
  );

  let avisos = 0;
  const parar = repo.aoMudar(() => avisos++);
  const deNovo = await repo.importar({
    p: [projeto({ id: "pVazio", nome: "Sem processo de verdade", processo: { protocolo: "" }, ...deFora })],
    e: [etapa({ id: "vazia", projeto: px.id, processo: { protocolo: "" }, documento: { numero: DOC }, ...deFora })],
  });
  parar();
  checar(
    "o mesmo texto de novo nao regrava nada (sem vai-e-volta)",
    deNovo.novos === 0 && deNovo.atualizados === 0 && deNovo.ignorados === 0 && avisos === 0,
    { deNovo, avisos },
  );

  secao("rodada 1: o texto com o documento em claro numa etapa sigilosa nao regrava a cada rodada");
  const { repo: rc } = novoRepo(ESCOPO_UN, areaMemoria(), "c");
  const emClaro = {
    p: [projeto({ id: "pSig", processo: VINCULO_VAZIO, ...deFora })],
    e: [etapa({ id: "e1", projeto: "pSig", documento: { numero: DOC }, ...deFora })],
  };
  await rc.importar(emClaro);
  let avisosC = 0;
  const pararC = rc.aoMudar(() => avisosC++);
  const [r2, r3] = [await rc.importar(emClaro), await rc.importar(emClaro)];
  pararC();
  checar(
    "a marca daqui fica e as rodadas seguintes nao gravam (a versao de fora so perdia a marca)",
    r2.atualizados === 0 && r3.atualizados === 0 && avisosC === 0 && (await rc.obterEtapa("e1"))?.documento?.sigiloso === true,
    { r2, r3, avisosC },
  );

  secao("rodada 1: concluir com documento (balao da arvore) a etapa que chegou com o vinculo vazio");
  await repo.importar({ e: [etapa({ id: "aConcluir", projeto: px.id, processo: { protocolo: "" }, ...deFora })] });
  await repo.concluirSeAberta("aConcluir", "2026-10-06", { numero: "4440009", titulo: "Ofício" });
  const concluida = await repo.obterEtapa("aConcluir");
  checar(
    "o documento informado depois fica marcado e nao vai ao texto",
    concluida?.documento?.sigiloso === true && !(await textoDe(repo, relogio())).includes("4440009"),
    concluida?.documento,
  );

  secao("rodada 1: a etapa do futuro que volta ao texto (comOsDoFuturo) tambem e normalizada");
  const agora = relogio();
  const lido: EnvelopeProjetos = {
    formato: "seipro-projetos",
    versao: 1,
    host: ESCOPO_UN.host,
    unidade: ESCOPO_UN.unidade,
    vis: "unidade",
    gerado: agora,
    entidades: {
      p: [projeto({ id: "pSig", processo: VINCULO_VAZIO, ...deFora })],
      f: [],
      e: [
        etapa({
          id: "doFuturo",
          projeto: "pSig",
          processo: { protocolo: "" },
          documento: { numero: DOC },
          ...deFora,
          atualizadoEm: agora + 3 * 86_400_000,
        }),
      ],
      h: [],
      m: [],
    },
  };
  const gravado = JSON.stringify(await textoComoGravado(lido, ESCOPO_UN, agora));
  checar(
    "o texto como gravado nao leva o documento da etapa do futuro (ela volta, sem o numero)",
    gravado.includes("doFuturo") && !gravado.includes(DOC),
    gravado.match(/"id":"doFuturo"[^}]*\}[^}]*\}/)?.[0],
  );
}

async function verificarArquivo(): Promise<void> {
  secao("rodada 1: receber projeto por arquivo com o vinculo vazio sem a marca");
  const { repo: origem, relogio: rOrigem } = novoRepo(ESCOPO_UN, areaMemoria(), "o");
  const p = await origem.criarProjeto({ nome: "Apuração", processo: { protocolo: X, sigiloso: true } });
  await origem.criarEtapa({ projeto: p.id, nome: "Ofício", inicio: "2026-10-01", fim: "2026-10-02" });
  const { conteudo } = await arquivoDoProjeto(origem, p.id, rOrigem());
  const bruto = JSON.parse(conteudo) as { etapas: Array<Record<string, unknown>> };
  // Editado à mão: o vínculo vazio sem a marca e um documento.
  bruto.etapas[0] = { ...bruto.etapas[0], processo: { protocolo: "" }, documento: { numero: DOC } };
  const { repo: destino, relogio: rDestino } = novoRepo(ESCOPO_UN, areaMemoria(), "d");
  const recebido = await receberProjeto(destino, lerArquivoDoProjeto(JSON.stringify(bruto)));
  const [ofi] = (await destino.dados()).etapas.filter((e) => e.projeto === recebido.id);
  checar(
    "a etapa recebida fica sem processo, o documento marcado, e o texto nao o leva",
    !!ofi && !temProcesso(ofi) && ofi.documento?.sigiloso === true && !(await textoDe(destino, rDestino())).includes(DOC),
    { processo: ofi?.processo, documento: ofi?.documento },
  );
}

function copiaCom(p: Projeto, e: Etapa): EnvelopeArquivo {
  return {
    formato: "seipro-projetos",
    versao: 1,
    tipo: "copia",
    gerado: RELOGIO_INICIAL,
    escopos: [{ escopo: ESCOPO_UN, entidades: { p: [p], f: [], e: [e], h: [], m: [] } }],
  } as unknown as EnvelopeArquivo;
}

async function verificarCopia(): Promise<void> {
  secao("rodada 1: restaurar a copia do dia e importar a copia de tudo com o vinculo vazio sem a marca");
  const px = projeto({ id: "px", processo: { protocolo: X, sigiloso: true }, ...deFora });
  const ef = etapa({ id: "ef", projeto: "px", processo: { protocolo: "" }, documento: { numero: DOC }, ...deFora });
  const env = copiaCom(px, ef);
  for (const caminho of ["restaurar", "importar"] as const) {
    const { repo, area, relogio } = novoRepo(ESCOPO_UN, areaMemoria(), caminho === "restaurar" ? "r" : "i");
    const carimbo = () => repo.carimboAtual();
    if (caminho === "restaurar") await restaurarCopia(area, { envelope: env } as unknown as CopiaProjetos, DONO, carimbo);
    else await importarTudo(area, env, DONO, carimbo);
    const e = await repo.obterEtapa("ef");
    checar(
      `${caminho}: a etapa fica sem processo, o documento marcado, e o texto nao o leva`,
      !!e && !temProcesso(e) && e.documento?.sigiloso === true && !(await textoDe(repo, relogio())).includes(DOC),
      { processo: e?.processo, documento: e?.documento },
    );
  }
}

export async function verificarVinculoVazioDeFora(): Promise<void> {
  await verificarTexto();
  await verificarArquivo();
  await verificarCopia();
}
