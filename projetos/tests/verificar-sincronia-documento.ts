/**
 * Rodada 4 da Tarefa 4: o documento de processo sigiloso pelo número. O corte deixa no texto o marcador
 * `{ numero: "", sigiloso: true }` (como o vínculo vazio do processo) em vez de tirar o campo: quem tem o
 * número o mantém, quem não tem fica com o marcador, e a etapa que chega SEM o campo `documento` é remoção
 * (vale pela regra normal de versão). Também: o número que a memória conhece não vai ao texto nem na
 * primeira rodada (sem a mescla), a origem na memória é pela procedência do dado, e o `importar` lê
 * entidades e memória numa chamada só. Com o motor de verdade e dois computadores onde cabe.
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { jsonEstavel } from "@comum/sincronia/assinatura";
import { MotorTextoPadrao } from "@comum/sincronia/motor";
import { gerarConteudoTexto, lerConteudoTexto } from "@comum/sincronia/textoPadraoCodec";
import { prefixoMemoriaSigilo } from "../src/modelo/constantes";
import type { Entidades, EnvelopeProjetos, Escopo, Etapa, Registro, Vis } from "../src/modelo/tipos";
import { entidadeValida, manterDocumentoSigiloso, moverEntreEscopos, RepositorioProjetos } from "../src/repositorio";
import { adaptadorProjetos, paraOTexto } from "../src/sincronia/textoPadrao";
import { etapa, projeto } from "./fabrica";
import { checar, secao } from "./util";

const AGORA = Date.UTC(2026, 9, 6, 12);
const HOJE = "2026-10-06";
const X = "50300.000777/2026-10";
const DOC = "1234567";
const MARCADOR = jsonEstavel({ numero: "", sigiloso: true });
const ETAPA = { inicio: "2026-10-06", fim: "2026-10-09" } as const;

/** O Texto Padrão "no SEI" (ler e gravar, sem conferência). */
export function noSei(html: string | null = null) {
  const t = {
    html,
    gravadas: 0,
    async ler() {
      return t.html;
    },
    async gravar(h: string) {
      t.gravadas++;
      t.html = h;
    },
  };
  return t;
}

/** Um computador: os dois escopos da unidade 110 numa área, relógio próprio e o motor de verdade. */
export function computador(login: string, dispositivo: string, inicio = AGORA, area: Area = areaMemoria()) {
  const rel = { agora: inicio };
  let n = 0;
  const repo = (vis: Vis) =>
    new RepositorioProjetos(
      area,
      { host: "sei.x.gov.br", login, unidade: "110", vis } satisfies Escopo,
      () => ({ agora: ++rel.agora, dispositivo, por: login, nome: login }),
      () => `${dispositivo}-${++n}`,
    );
  const un = repo("unidade");
  const eu = repo("eu");
  const rodada = (r: RepositorioProjetos, destino: ReturnType<typeof noSei>) =>
    new MotorTextoPadrao<EnvelopeProjetos>({
      adaptador: adaptadorProjetos({ repo: r, area, sigla: "S", nomeUsuario: login }),
      destino,
      area,
      travar: (_n, fn) => fn(),
      agora: () => rel.agora,
      releituras: 3,
      temporizador: { definir: () => 0, cancelar: () => undefined },
    }).sincronizar({ forcar: true });
  return { area, un, eu, rodada };
}

export async function noTexto(html: string | null): Promise<Entidades> {
  const r = html ? await lerConteudoTexto(html) : null;
  return r && "bruto" in r ? (r.bruto as EnvelopeProjetos).entidades : { p: [], f: [], e: [], h: [], m: [] };
}

export const jsonDe = async (html: string | null) => JSON.stringify(await noTexto(html));

/** A Ana conhece o DOC como documento de processo sigiloso (de três jeitos); a Bia o digita numa etapa comum. */
async function anaSabeBiaDigita(variante: string) {
  const sei = noSei();
  const ana = computador("ana", "pc-ana");
  const bia = computador("bia", "pc-bia", AGORA + 5);
  const pa = await ana.un.criarProjeto({ nome: "Apuração", processo: { protocolo: X, sigiloso: true } });
  const e1 = await ana.un.criarEtapa({ projeto: pa.id, nome: "Oitiva", ...ETAPA });
  if (variante === "a ana conhece o numero so pela memoria") {
    // O DOC foi o documento da etapa antes do sigilo: depois de marcar, ele só está nos registros (e na memória).
    await ana.un.editarProjeto(pa.id, { processo: { protocolo: X } });
    await ana.un.editarEtapa(e1.id, { documento: { numero: DOC } }, HOJE);
    await ana.un.editarEtapa(e1.id, { documento: { numero: "7777009" } }, HOJE);
    await ana.un.editarProjeto(pa.id, { processo: { protocolo: X, sigiloso: true } });
  } else {
    await ana.un.concluirEtapa(e1.id, "2026-10-09", { numero: DOC });
  }
  await ana.rodada(ana.un, sei);
  const pb = await bia.un.criarProjeto({ nome: "Comum" });
  const e3 = await bia.un.criarEtapa({ projeto: pb.id, nome: "Referência", ...ETAPA, documento: { numero: DOC } });
  await bia.rodada(bia.un, sei);
  return { sei, ana, bia, e1, e3 };
}

export async function verificarSincroniaDocumento(): Promise<void> {
  for (const variante of ["a mesma versao", "a ana edita a etapa", "a ana conhece o numero so pela memoria"]) {
    secao(`documento sigiloso pelo numero (${variante}): a colega que o digitou numa etapa comum nao o perde`);
    const { sei, ana, bia, e3 } = await anaSabeBiaDigita(variante);
    checar(
      `${variante}: premissa: a primeira rodada da bia leva o numero (ela nao sabe do sigilo)`,
      (await jsonDe(sei.html)).includes(DOC),
    );
    await ana.rodada(ana.un, sei);
    if (variante === "a ana edita a etapa") {
      await ana.un.editarEtapa(e3.id, { nome: "Referência revisada" }, HOJE);
      await ana.rodada(ana.un, sei);
    }
    const gravadas: number[] = [];
    for (let i = 0; i < 2; i++) {
      for (const c of [bia, ana]) {
        const g = sei.gravadas;
        await c.rodada(c.un, sei);
        gravadas.push(sei.gravadas - g);
      }
    }
    const db = (await bia.un.obterEtapa(e3.id))?.documento;
    const da = (await ana.un.obterEtapa(e3.id))?.documento;
    checar(`${variante}: a bia mantem o documento que digitou, agora marcado sigiloso`, db?.numero === DOC && db.sigiloso === true, db);
    checar(`${variante}: a ana tambem tem o numero, marcado`, da?.numero === DOC && da.sigiloso === true, da);
    const t = await noTexto(sei.html);
    checar(
      `${variante}: o texto leva o marcador no lugar do documento, e o numero nao esta em lugar nenhum`,
      !JSON.stringify(t).includes(DOC) && jsonEstavel(t.e.find((x) => x.id === e3.id)?.documento) === MARCADOR,
      t.e.map((x) => x.documento),
    );
    checar(`${variante}: converge: na segunda rodada de cada uma, ninguem regrava`, gravadas[2] === 0 && gravadas[3] === 0, gravadas);
  }

  secao("documento sigiloso pelo numero: a remocao feita por um colega se propaga");
  {
    const { sei, ana, bia, e1, e3 } = await anaSabeBiaDigita("a mesma versao");
    for (let i = 0; i < 2; i++) for (const c of [ana, bia]) await c.rodada(c.un, sei);
    checar(
      "premissa: na etapa sigilosa a bia so tem o marcador; na comum, as duas tem o numero",
      jsonEstavel((await bia.un.obterEtapa(e1.id))?.documento) === MARCADOR &&
        (await bia.un.obterEtapa(e3.id))?.documento?.numero === DOC &&
        (await ana.un.obterEtapa(e3.id))?.documento?.numero === DOC,
      [(await bia.un.obterEtapa(e1.id))?.documento, (await bia.un.obterEtapa(e3.id))?.documento],
    );
    await ana.un.editarEtapa(e1.id, { documento: undefined }, HOJE);
    await bia.un.editarEtapa(e3.id, { documento: undefined }, HOJE);
    for (let i = 0; i < 2; i++) for (const c of [ana, bia]) await c.rodada(c.un, sei);
    checar(
      "a ana tirou o documento da etapa sigilosa: o marcador sai da bia",
      (await bia.un.obterEtapa(e1.id))?.documento === undefined && (await ana.un.obterEtapa(e1.id))?.documento === undefined,
      (await bia.un.obterEtapa(e1.id))?.documento,
    );
    checar(
      "a bia tirou o documento que tinha digitado: ele sai da ana tambem (nao e restaurado)",
      (await ana.un.obterEtapa(e3.id))?.documento === undefined && (await bia.un.obterEtapa(e3.id))?.documento === undefined,
      (await ana.un.obterEtapa(e3.id))?.documento,
    );
  }

  secao("documento sigiloso pelo numero: a remocao propagada nao solta o numero (memoria e registros)");
  {
    const sei = noSei();
    const ana = computador("ana", "pc-ana");
    const bia = computador("bia", "pc-bia", AGORA + 5);
    const pa = await ana.un.criarProjeto({ nome: "Apuração", processo: { protocolo: X, sigiloso: true } });
    const e1 = await ana.un.criarEtapa({ projeto: pa.id, nome: "Oitiva", ...ETAPA });
    await ana.un.concluirEtapa(e1.id, "2026-10-09", { numero: DOC });
    await ana.rodada(ana.un, sei);
    // A bia digita o DOC numa etapa comum dela (o registro "documento" leva o número, ela não sabe do sigilo).
    const pb = await bia.un.criarProjeto({ nome: "Comum" });
    const e3 = await bia.un.criarEtapa({ projeto: pb.id, nome: "Referência", ...ETAPA });
    await bia.un.editarEtapa(e3.id, { documento: { numero: DOC } }, HOJE);
    await bia.rodada(bia.un, sei);
    for (let i = 0; i < 2; i++) for (const c of [ana, bia]) await c.rodada(c.un, sei);
    await ana.un.editarEtapa(e3.id, { documento: undefined }, HOJE);
    const gravadas: number[] = [];
    for (let i = 0; i < 3; i++) {
      for (const c of [ana, bia]) {
        const g = sei.gravadas;
        await c.rodada(c.un, sei);
        gravadas.push(sei.gravadas - g);
      }
    }
    checar("a remocao chegou: a bia fica sem o documento", (await bia.un.obterEtapa(e3.id))?.documento === undefined);
    checar(
      "o numero segue na memoria das duas, e os registros com ele seguem raspados (nao volta ao texto)",
      (await ana.un.sigilosConhecidos()).documentos.has(DOC) &&
        (await bia.un.sigilosConhecidos()).documentos.has(DOC) &&
        !(await jsonDe(sei.html)).includes(DOC),
    );
    checar(
      "e o historico da bia continua com o numero dela; ninguem regrava depois da primeira volta",
      (await bia.un.historico(pb.id)).some((r) => r.campo === "documento" && r.depois === DOC) && gravadas.slice(2).every((g) => g === 0),
      gravadas,
    );
  }

  secao("documento sigiloso pelo numero: quem so tem o marcador o mantem e nao apaga o numero de quem tem");
  {
    const sei = noSei();
    const ana = computador("ana", "pc-ana");
    const bia = computador("bia", "pc-bia", AGORA + 5);
    const pa = await ana.un.criarProjeto({ nome: "Apuração", processo: { protocolo: X, sigiloso: true } });
    const e1 = await ana.un.criarEtapa({ projeto: pa.id, nome: "Oitiva", ...ETAPA });
    await ana.un.concluirEtapa(e1.id, "2026-10-09", { numero: DOC, titulo: "Termo de oitiva" });
    await ana.rodada(ana.un, sei);
    await bia.rodada(bia.un, sei);
    checar("a bia recebe o marcador (sem o numero e sem o titulo)", jsonEstavel((await bia.un.obterEtapa(e1.id))?.documento) === MARCADOR);
    await bia.un.editarEtapa(e1.id, { nome: "Oitiva das testemunhas" }, HOJE);
    const gravadas: number[] = [];
    for (let i = 0; i < 3; i++) {
      for (const c of [bia, ana]) {
        const g = sei.gravadas;
        await c.rodada(c.un, sei);
        gravadas.push(sei.gravadas - g);
      }
    }
    const da = await ana.un.obterEtapa(e1.id);
    checar(
      "a ana recebe o nome novo da bia e mantem o numero e o titulo, marcados",
      da?.nome === "Oitiva das testemunhas" &&
        da.documento?.numero === DOC &&
        da.documento.titulo === "Termo de oitiva" &&
        da.documento.sigiloso === true,
      da,
    );
    checar("a bia segue com o marcador", jsonEstavel((await bia.un.obterEtapa(e1.id))?.documento) === MARCADOR);
    checar(
      "o numero e o titulo nao vao ao texto",
      !(await jsonDe(sei.html)).includes(DOC) && !(await jsonDe(sei.html)).includes("Termo de"),
    );
    checar(
      "converge: depois da primeira volta, ninguem regrava",
      gravadas.slice(2).every((g) => g === 0),
      gravadas,
    );
  }

  secao("documento sigiloso pelo numero: so o marcador exato guarda o numero daqui");
  {
    const local = etapa({ id: "m1", documento: { numero: DOC, titulo: "Termo" }, atualizadoEm: 10 });
    const chega = (documento?: Etapa["documento"]) =>
      etapa({ id: "m1", atualizadoEm: 20, dispositivo: "dev-b", ...(documento ? { documento } : {}) });
    checar("o marcador e aceito de um colega", entidadeValida(chega({ numero: "", sigiloso: true }), "e"));
    checar("o numero vazio sem a marca tambem e aceito (a tela o trata como sem documento)", entidadeValida(chega({ numero: "" }), "e"));
    checar(
      "chegou o marcador e aqui ha o numero: fica o numero daqui (com o titulo), marcado",
      jsonEstavel(manterDocumentoSigiloso(chega({ numero: "", sigiloso: true }), local).documento) ===
        jsonEstavel({ numero: DOC, titulo: "Termo", sigiloso: true }),
    );
    checar(
      "chegou o marcador e aqui nao ha documento: fica o marcador",
      jsonEstavel(manterDocumentoSigiloso(chega({ numero: "", sigiloso: true }), etapa({ id: "m1" })).documento) === MARCADOR,
    );
    checar(
      "chegou o numero vazio SEM a marca: nao e o marcador, vale o que chegou",
      manterDocumentoSigiloso(chega({ numero: "" }), local).documento?.numero === "",
    );
    checar(
      "chegou sem o campo: e remocao, vale o que chegou (mesmo com o documento daqui marcado)",
      manterDocumentoSigiloso(chega(), { ...local, documento: { numero: DOC, sigiloso: true } }).documento === undefined,
    );
  }

  secao("documento sigiloso pelo numero: o que a memoria conhece nao vai ao texto na primeira rodada");
  {
    // O DOC marcado em "Só eu" e já numa etapa comum da unidade; a primeira rodada da unidade não tem texto (sem mescla).
    const ana = computador("ana", "pc-ana");
    const un = noSei();
    const pu = await ana.un.criarProjeto({ nome: "Comum" });
    const eu1 = await ana.un.criarEtapa({ projeto: pu.id, nome: "Referência", ...ETAPA, documento: { numero: DOC } });
    const pe = await ana.eu.criarProjeto({ nome: "Apuração", processo: { protocolo: X, sigiloso: true } });
    const ee = await ana.eu.criarEtapa({ projeto: pe.id, nome: "Oitiva", ...ETAPA });
    await ana.eu.concluirEtapa(ee.id, "2026-10-09", { numero: DOC });
    checar("premissa: a memoria conhece o DOC", (await ana.un.sigilosConhecidos()).documentos.has(DOC));
    const s = await ana.rodada(ana.un, un);
    const t = await noTexto(un.html);
    checar(
      "a primeira rodada da unidade nao leva o DOC e leva o marcador no lugar",
      s.estado === "ok" &&
        un.gravadas === 1 &&
        !JSON.stringify(t).includes(DOC) &&
        jsonEstavel(t.e.find((x) => x.id === eu1.id)?.documento) === MARCADOR,
      { s, e: t.e.map((x) => x.documento) },
    );
    await ana.rodada(ana.un, un);
    const d = (await ana.un.obterEtapa(eu1.id))?.documento;
    checar(
      "a rodada seguinte nao regrava, e o documento daqui fica com o numero, marcado",
      un.gravadas === 1 && d?.numero === DOC && d.sigiloso === true,
      { gravadas: un.gravadas, d },
    );
  }
  {
    // O 7777001 só nos registros da etapa sigilosa (o documento antes do sigilo) e numa etapa comum do mesmo escopo.
    const ana = computador("ana", "pc-ana");
    const un = noSei();
    const comum = await ana.un.criarProjeto({ nome: "Comum" });
    const e3 = await ana.un.criarEtapa({ projeto: comum.id, nome: "Referência", ...ETAPA, documento: { numero: "7777001" } });
    const p = await ana.un.criarProjeto({ nome: "P1", processo: { protocolo: X } });
    const e1 = await ana.un.criarEtapa({ projeto: p.id, nome: "E1", ...ETAPA });
    await ana.un.editarEtapa(e1.id, { documento: { numero: "7777001" } }, HOJE);
    await ana.un.editarEtapa(e1.id, { documento: { numero: "7777002" } }, HOJE);
    await ana.un.editarProjeto(p.id, { processo: { protocolo: X, sigiloso: true } });
    await ana.rodada(ana.un, un);
    checar(
      "o numero antigo, so de registros, nao vai pela etapa comum ja na primeira rodada",
      un.gravadas === 1 && !(await jsonDe(un.html)).includes("7777001"),
      (await noTexto(un.html)).e.map((x) => x.documento),
    );
    await ana.rodada(ana.un, un);
    checar(
      "e a rodada seguinte nao regrava (a etapa comum fica com o numero daqui, marcado)",
      un.gravadas === 1 && (await ana.un.obterEtapa(e3.id))?.documento?.sigiloso === true,
      un.gravadas,
    );
  }

  secao("documento sigiloso pelo numero: o mesmo corte sem a memoria (o numero do registro da etapa sigilosa)");
  {
    // Sem nada conhecido: o corte sozinho junta os números de documento de etapa sigilosa (do documento e dos
    // registros dela) e os tira de qualquer etapa e de qualquer registro, já nesta montagem.
    const env: EnvelopeProjetos = {
      formato: "seipro-projetos",
      versao: 1,
      host: "sei.x.gov.br",
      unidade: "110",
      vis: "unidade",
      gerado: AGORA,
      entidades: {
        p: [projeto({ id: "p1", processo: { protocolo: X, sigiloso: true } }), projeto({ id: "p2" })],
        f: [],
        e: [
          etapa({ id: "e1", projeto: "p1", documento: { numero: "7777002" } }),
          etapa({ id: "e3", projeto: "p2", documento: { numero: "7777001" } }),
          etapa({ id: "e4", projeto: "p2", documento: { numero: "7777002" } }),
          etapa({ id: "e5", projeto: "p2", documento: { numero: "1111111" } }),
        ],
        h: [
          registroDoc("h1", "e1", "p1", "7777001", "7777002"),
          registroDoc("h2", "e3", "p2", undefined, "7777001"),
          registroDoc("h3", "e5", "p2", undefined, "1111111"),
        ],
        m: [],
      },
    };
    const saida = paraOTexto(env, AGORA);
    const json = JSON.stringify(saida);
    checar(
      "nenhum dos dois numeros vai (documento de outra etapa nem registro)",
      !json.includes("7777001") && !json.includes("7777002"),
      json,
    );
    checar(
      "as etapas comuns com esses numeros levam o marcador",
      ["e3", "e4"].every((id) => jsonEstavel(saida.entidades.e.find((x) => x.id === id)?.documento) === MARCADOR),
    );
    checar(
      "o documento e o registro comuns ficam como estao",
      saida.entidades.e.find((x) => x.id === "e5")?.documento?.numero === "1111111" &&
        saida.entidades.h.find((r) => r.id === "h3")?.depois === "1111111",
    );
  }

  secao("memoria do sigilo: a origem e pela procedencia (o que vem de colega e aprendida)");
  {
    const area = areaMemoria();
    const PREF = prefixoMemoriaSigilo("sei.x.gov.br", "ana");
    const cheia: Record<string, string> = {};
    for (let i = 0; i < 20000; i++) cheia[`${PREF}p/${10_000_000_000 + i}`] = "aprendida";
    await area.gravar(cheia);
    const ana = computador("ana", "pc-ana", AGORA, area);
    // O texto de um colega (editado à mão): 500 lápides de projeto com vínculo marcado e número novo.
    const lapides = Array.from({ length: 500 }, (_, i) => ({
      ...projeto({ id: `z${i}`, processo: { protocolo: String(20_000_000_000 + i), sigiloso: true } }),
      atualizadoEm: AGORA - 1000,
      removidoEm: AGORA - 1000,
      criadoEm: AGORA - 2000,
      dispositivo: "pc-mal",
    }));
    const env: EnvelopeProjetos = {
      formato: "seipro-projetos",
      versao: 1,
      host: "sei.x.gov.br",
      unidade: "110",
      vis: "unidade",
      gerado: AGORA,
      entidades: { p: lapides, f: [], e: [], h: [], m: [] },
    };
    const sei = noSei(await gerarConteudoTexto("x", env));
    const conta = async () => {
      const ks = (await area.chaves?.())?.filter((k) => k.startsWith(PREF)) ?? [];
      const v = Object.values(await area.obter(ks));
      return { total: ks.length, locais: v.filter((x) => x === "local").length };
    };
    const s = await ana.rodada(ana.un, sei);
    const depois = await conta();
    checar(
      "as 500 lapides do colega cortadas na montagem do texto nao viram locais (aprendidas, com o teto cheio, nao entram)",
      s.estado === "ok" && depois.locais === 0 && depois.total === 20000,
      { s: s.estado, depois },
    );
    await ana.un.criarProjeto({ nome: "Daqui", processo: { protocolo: X, sigiloso: true } });
    const daqui = await conta();
    checar(
      "a gravacao daqui que marca guarda como local so o que e daqui (nao as lapides do colega)",
      daqui.locais === 1 && daqui.total === 20001,
      daqui,
    );
  }
  {
    // Memória vazia: o projeto marcado de um colega chega e é cortado na montagem; o daqui é local.
    const area = areaMemoria();
    const PREF = prefixoMemoriaSigilo("sei.x.gov.br", "ana");
    const ana = computador("ana", "pc-ana", AGORA, area);
    const doColega = {
      ...projeto({ id: "c1", processo: { protocolo: X, sigiloso: true } }),
      atualizadoEm: AGORA - 10,
      dispositivo: "pc-bia",
    };
    const etapaDoColega = {
      ...etapa({ id: "c2", projeto: "c1", documento: { numero: "4444444" } }),
      atualizadoEm: AGORA - 10,
      dispositivo: "pc-bia",
    };
    const env: EnvelopeProjetos = {
      formato: "seipro-projetos",
      versao: 1,
      host: "sei.x.gov.br",
      unidade: "110",
      vis: "unidade",
      gerado: AGORA,
      entidades: { p: [doColega], f: [], e: [etapaDoColega], h: [], m: [] },
    };
    const sei = noSei(await gerarConteudoTexto("x", env));
    await ana.un.criarProjeto({ nome: "Daqui", processo: { protocolo: "50300.000002/2026-11", sigiloso: true } });
    await ana.rodada(ana.un, sei);
    const k = (n: string) => `${PREF}${n}`;
    const v = await area.obter([k("p/50300000777202610"), k("d/4444444"), k("p/50300000002202611")]);
    checar(
      "o numero e o documento do colega ficam como aprendidos; o marcado aqui, como local",
      v[k("p/50300000777202610")] === "aprendida" && v[k("d/4444444")] === "aprendida" && v[k("p/50300000002202611")] === "local",
      v,
    );
  }

  secao("memoria do sigilo: local e so o que uma gravacao deste dispositivo causou (o campo dispositivo nao conta)");
  {
    // O texto editado à mão com o `dispositivo` da própria Ana (o id dela está em todo item que ela grava no texto).
    const area = areaMemoria();
    const PREF = prefixoMemoriaSigilo("sei.x.gov.br", "ana");
    const cheia: Record<string, string> = {};
    for (let i = 0; i < 20000; i++) cheia[`${PREF}p/${10_000_000_000 + i}`] = "aprendida";
    await area.gravar(cheia);
    const ana = computador("ana", "pc-ana", AGORA, area);
    const forjadas = Array.from({ length: 500 }, (_, i) => ({
      ...projeto({ id: `f${i}`, processo: { protocolo: String(30_000_000_000 + i), sigiloso: true } }),
      atualizadoEm: AGORA - 1000,
      removidoEm: AGORA - 1000,
      criadoEm: AGORA - 2000,
      dispositivo: "pc-ana",
    }));
    const env: EnvelopeProjetos = {
      formato: "seipro-projetos",
      versao: 1,
      host: "sei.x.gov.br",
      unidade: "110",
      vis: "unidade",
      gerado: AGORA,
      entidades: { p: forjadas, f: [], e: [], h: [], m: [] },
    };
    const sei = noSei(await gerarConteudoTexto("x", env));
    const conta = async () => {
      const ks = (await area.chaves?.())?.filter((k) => k.startsWith(PREF)) ?? [];
      return Object.values(await area.obter(ks)).filter((x) => x === "local").length;
    };
    await ana.rodada(ana.un, sei);
    await ana.rodada(ana.un, sei);
    await ana.un.limpar(AGORA + 365 * 86_400_000);
    checar("500 lapides com o dispositivo da ana forjado: nenhuma vira local (mescla, texto e poda)", (await conta()) === 0, await conta());
    await ana.un.criarProjeto({ nome: "Daqui", processo: { protocolo: X, sigiloso: true } });
    checar("e a gravacao daqui que marca so guarda o numero dela como local", (await conta()) === 1, await conta());
  }
  {
    // O registro da Ana com o número, que fica sigiloso porque um COLEGA marcou o processo: é aprendida.
    const area = areaMemoria();
    const PREF = prefixoMemoriaSigilo("sei.x.gov.br", "ana");
    const ana = computador("ana", "pc-ana", AGORA, area);
    const p = await ana.un.criarProjeto({ nome: "P1" });
    await ana.un.editarProjeto(p.id, { processo: { protocolo: X } });
    const atual = await ana.un.obterProjeto(p.id);
    const marcadoPeloColega = { ...atual!, processo: { protocolo: "", sigiloso: true }, atualizadoEm: AGORA + 50, dispositivo: "pc-bia" };
    await ana.un.importar({ p: [marcadoPeloColega] });
    const k = `${PREF}p/50300000777202610`;
    checar(
      "o colega marcou: o numero do registro da ana entra como aprendida (este dispositivo nao marcou)",
      (await area.obter(k))[k] === "aprendida",
      (await area.obter(k))[k],
    );
    // A própria Ana marca outro número num projeto dela: local.
    const q = await ana.un.criarProjeto({ nome: "P2" });
    await ana.un.editarProjeto(q.id, { processo: { protocolo: "50300.000002/2026-11" } });
    await ana.un.editarProjeto(q.id, { processo: { protocolo: "50300.000002/2026-11", sigiloso: true } });
    const k2 = `${PREF}p/50300000002202611`;
    checar("a ana marcou: local", (await area.obter(k2))[k2] === "local");
  }
  {
    // Dado de colega que chega com o número (o colega não sabia), num projeto que o colega marcou: aprendida.
    const area = areaMemoria();
    const PREF = prefixoMemoriaSigilo("sei.x.gov.br", "ana");
    const ana = computador("ana", "pc-ana", AGORA, area);
    const doColega = {
      ...projeto({ id: "c1", processo: { protocolo: X, sigiloso: true } }),
      atualizadoEm: AGORA - 10,
      dispositivo: "pc-bia",
    };
    const etapaDoColega = {
      ...etapa({ id: "c2", projeto: "c1", documento: { numero: DOC } }),
      atualizadoEm: AGORA - 10,
      dispositivo: "pc-bia",
    };
    await ana.un.importar({ p: [doColega], e: [etapaDoColega] });
    const k = (n: string) => `${PREF}${n}`;
    const origem = async (n: string) => (await area.obter(k(n)))[k(n)];
    checar("premissa: o numero e o documento do colega sao aprendidos", (await origem(`d/${DOC}`)) === "aprendida");
    await ana.un.editarEtapa("c2", { nome: "Oitiva revisada" }, HOJE);
    checar("editar aqui o nome da etapa do colega nao promove o documento dele", (await origem(`d/${DOC}`)) === "aprendida");
    await ana.un.editarEtapa("c2", { documento: { numero: "5555555" } }, HOJE);
    checar(
      "trocar aqui o documento: o numero digitado aqui e local; o antigo, do colega, continua aprendido",
      (await origem("d/5555555")) === "local" && (await origem(`d/${DOC}`)) === "aprendida",
      [await origem("d/5555555"), await origem(`d/${DOC}`)],
    );
    // Duplicar o projeto do colega copia o vínculo marcado dele: não é marcar aqui, e não promove.
    await ana.un.duplicarProjeto("c1");
    checar(
      "duplicar o projeto do colega nao promove o numero dele a local",
      (await origem("p/50300000777202610")) === "aprendida",
      await origem("p/50300000777202610"),
    );
    // "Quem vê": levar o projeto do colega para "Só eu" não promove o que é dele.
    await moverEntreEscopos(ana.un, ana.eu, "c1");
    checar(
      "Quem ve: mover o projeto do colega nao promove o numero dele a local",
      (await origem("p/50300000777202610")) === "aprendida" && (await origem(`d/${DOC}`)) === "aprendida",
      [await origem("p/50300000777202610"), await origem(`d/${DOC}`)],
    );
  }

  secao("memoria do sigilo: o Quem ve com as aprendidas quase cheias nao passa do teto");
  {
    const area = areaMemoria();
    const PREF = prefixoMemoriaSigilo("sei.x.gov.br", "ana");
    const ana = computador("ana", "pc-ana", AGORA, area);
    const doColega = {
      ...projeto({ id: "c1", processo: { protocolo: X, sigiloso: true } }),
      atualizadoEm: AGORA - 10,
      dispositivo: "pc-bia",
    };
    const etapas = ["50300.000011/2026-11", "50300.000012/2026-11", "50300.000013/2026-11"].map((protocolo, i) => ({
      ...etapa({ id: `c${i + 2}`, projeto: "c1", processo: { protocolo, sigiloso: true } }),
      atualizadoEm: AGORA - 10,
      dispositivo: "pc-bia",
    }));
    await ana.un.importar({ p: [doColega], e: etapas });
    // Os números do projeto saem da memória (como se não tivessem cabido) e as aprendidas ficam a 1 do teto.
    const ks = (await area.chaves?.())?.filter((k) => k.startsWith(`${PREF}p/`)) ?? [];
    await area.remover(ks);
    const quase: Record<string, string> = {};
    for (let i = 0; i < 19999; i++) quase[`${PREF}p/${10_000_000_000 + i}`] = "aprendida";
    await area.gravar(quase);
    await moverEntreEscopos(ana.un, ana.eu, "c1");
    const v = Object.values(await area.obter((await area.chaves?.())?.filter((k) => k.startsWith(`${PREF}p/`)) ?? []));
    checar(
      "depois do Quem ve: no maximo 20000 aprendidas e nenhuma local",
      v.filter((x) => x === "aprendida").length <= 20000 && !v.includes("local"),
      { aprendidas: v.filter((x) => x === "aprendida").length, locais: v.filter((x) => x === "local").length },
    );
  }

  secao("importar: entidades e memoria do sigilo numa leitura so");
  {
    const base = areaMemoria();
    const conta = { chaves: 0, obter: 0 };
    const espia: Area = {
      ...base,
      chaves: async () => {
        conta.chaves++;
        return (await base.chaves?.()) ?? [];
      },
      obter: async (c) => {
        conta.obter++;
        return base.obter(c);
      },
      aoMudar: base.aoMudar.bind(base),
    };
    const ana = computador("ana", "pc-ana", AGORA, espia);
    const p = await ana.un.criarProjeto({ nome: "P", processo: { protocolo: X, sigiloso: true } });
    await ana.un.criarEtapa({ projeto: p.id, nome: "E", ...ETAPA, documento: { numero: DOC } });
    const colega = { ...projeto({ id: "c1" }), atualizadoEm: AGORA - 10, dispositivo: "pc-bia" };
    conta.chaves = 0;
    conta.obter = 0;
    const r = await ana.un.importar({ p: [colega], e: [] });
    checar(
      "uma chamada a chaves() e uma a obter(), e o projeto do colega entrou",
      conta.chaves === 1 && conta.obter === 1 && r.novos === 1,
      {
        conta,
        r,
      },
    );
  }
}

function registroDoc(id: string, alvo: string, projetoId: string, antes: string | undefined, depois: string): Registro {
  const r: Registro = {
    id,
    alvo,
    projeto: projetoId,
    quando: AGORA,
    por: "ana",
    campo: "documento",
    depois,
    atualizadoEm: AGORA,
    dispositivo: "dev-a",
  };
  if (antes !== undefined) r.antes = antes;
  return r;
}
