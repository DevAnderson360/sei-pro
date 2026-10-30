/**
 * Arquivo, cópias diárias e Exportar/Importar (spec 6.2): todos os escopos do
 * usuário num SEI (inclusive os números sigilosos, que são dele), mescla na
 * leitura, o que é de outro usuário fica, e restaurar RECUPERA o que sumiu
 * depois da cópia (o ausente ou excluído aqui), sem voltar no tempo o que está
 * vivo. E a memória do sigilo do usuário (decisão da Tarefa 6):
 * o arquivo é dele, então ela vai junto num campo próprio e volta como "local"
 * num perfil novo, e um número que só sobrou nos registros não volta ao Texto
 * Padrão depois de importar ou restaurar.
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { SincroniaArquivo } from "@comum/sincronia/arquivo";
import { jsonEstavel } from "@comum/sincronia/assinatura";
import { copiasEmMemoria } from "@comum/sincronia/copias";
import { prefixoMemoriaSigilo } from "../src/modelo/constantes";
import { chaveEscopo } from "../src/modelo/escopo";
import { ErroMemoriaSigilo, lerMemoria, TETO_APRENDIDAS } from "../src/modelo/memoriaSigilo";
import type { Escopo, Projeto } from "../src/modelo/tipos";
import { RepositorioProjetos } from "../src/repositorio";
import {
  adaptadorArquivoProjetos,
  type EnvelopeArquivo,
  escoposDoUsuario,
  exportarTudo,
  fazerCopiaDoDia,
  importarTudo,
  LIMITE_LOCAIS_ARQUIVO,
  lerEnvelopeArquivo,
  nomeDoArquivo,
  restaurarCopia,
  TETO_SIGILO_ARQUIVO,
  VERSAO_SIGILO,
} from "../src/sincronia/arquivo";
import { checar, secao } from "./util";
import { computador, jsonDe, noSei } from "./verificar-sincronia-documento";

const AGORA = Date.UTC(2026, 9, 6, 12);
const HOST = "sei.x.gov.br";
const DONO = { host: HOST, login: "Ana" };
const X = "50300.000777/2026-10";
const CHAVE_X = "50300000777202610";
const OUTRO = "50300.000002/2026-11";
const ETAPA = { inicio: "2026-10-06", fim: "2026-10-09" } as const;
const HOJE = "2026-10-06";
const DOC = "1234567";
/** A mensagem do erro de leitura da memória do sigilo (rodada 1: genérica, para o texto, o arquivo e a cópia). */
const MENSAGEM_MEMORIA = "Não foi possível ler a lista de processos sigilosos deste computador. Nada foi gravado; tente de novo.";

function repos(area: ReturnType<typeof areaMemoria>, relogio = { agora: AGORA }) {
  const carimbo = () => ({ agora: ++relogio.agora, dispositivo: "pc-ana", por: "ana", nome: "Ana" });
  const de = (e: Partial<Escopo>) =>
    new RepositorioProjetos(area, { host: HOST, login: "ana", unidade: "110", vis: "unidade", ...e }, carimbo);
  return { carimbo, de };
}

/** A memória do sigilo da ana na área, número → origem. */
async function memoriaDaAna(area: Area): Promise<{ p: Map<string, string>; d: Map<string, string>; chaves: number }> {
  const tudo = await area.obter(null);
  const m = lerMemoria(tudo, prefixoMemoriaSigilo(HOST, "ana"));
  const chaves = Object.keys(tudo).filter((k) => k.startsWith(prefixoMemoriaSigilo(HOST, "ana"))).length;
  return { p: new Map(m.processos), d: new Map(m.documentos), chaves };
}

/** Área que falha ao gravar a memória do sigilo (o resto grava normalmente). */
function areaQueNaoGravaMemoria(): Area & { gravacoes: number } {
  const base = areaMemoria();
  const a = {
    ...base,
    gravacoes: 0,
    async gravar(itens: Record<string, unknown>) {
      if (Object.keys(itens).some((k) => k.startsWith("projetos/sigilo/"))) throw new Error("cota excedida");
      a.gravacoes++;
      await base.gravar(itens);
    },
  };
  return a;
}

/** Área com uma entrada na memória do sigilo da ana que o storage não consegue ler enquanto `falha.ler`. */
function areaQueNaoLeMemoria(): Area & { falha: { ler: boolean } } {
  const base = areaMemoria({ [`${prefixoMemoriaSigilo(HOST, "ana")}p/111`]: "local" });
  const falha = { ler: true };
  return {
    ...base,
    falha,
    async obter(ch?: string | string[] | null) {
      const ks = ch === null || ch === undefined ? ["projetos/sigilo/"] : typeof ch === "string" ? [ch] : ch;
      if (falha.ler && ks.some((k) => k.startsWith("projetos/sigilo/"))) throw new Error("falha simulada ao ler o storage");
      return base.obter(ch);
    },
  };
}

export async function verificarSincroniaArquivo(): Promise<void> {
  secao("arquivo: todos os escopos do usuario neste SEI");
  const area = areaMemoria();
  const { carimbo, de } = repos(area);
  await de({}).criarProjeto({ nome: "Da unidade 110", processo: { protocolo: X, sigiloso: true } });
  await de({ vis: "eu" }).criarProjeto({ nome: "Meu na 110" });
  await de({ unidade: "220" }).criarProjeto({ nome: "Da unidade 220" });
  await new RepositorioProjetos(area, { host: HOST, login: "bia", unidade: "110", vis: "unidade" }, carimbo).criarProjeto({
    nome: "Da bia",
  });
  await new RepositorioProjetos(area, { host: "outro.gov.br", login: "ana", unidade: "110", vis: "unidade" }, carimbo).criarProjeto({
    nome: "Outro SEI",
  });
  const escopos = await escoposDoUsuario(area, DONO);
  checar(
    "acha os 3 escopos da ana neste SEI (e nao os da bia nem os do outro SEI)",
    escopos.map((e) => `${e.unidade}/${e.vis}`).join() === "110/eu,110/unidade,220/unidade",
    escopos,
  );
  const env = await exportarTudo(area, DONO, carimbo);
  checar("exporta os tres, com o formato da copia", env.tipo === "copia" && env.formato === "seipro-projetos" && env.escopos.length === 3);
  checar("leva o numero do sigiloso (o arquivo e do proprio usuario)", JSON.stringify(env).includes(X));
  checar("nome sugerido por login e SEI", nomeDoArquivo(DONO) === "projetos-seipro-ana-sei.x.gov.br.json");

  secao("arquivo: leitura e mescla");
  checar("le o envelope de volta", lerEnvelopeArquivo(JSON.parse(JSON.stringify(env)))?.escopos.length === 3);
  checar(
    "o do Texto Padrao (um escopo) nao e uma copia",
    lerEnvelopeArquivo({ formato: "seipro-projetos", versao: 1, host: HOST }) === null,
  );
  checar("escopo torto: recusado inteiro", lerEnvelopeArquivo({ ...env, escopos: [{ escopo: { host: HOST }, entidades: {} }] }) === null);
  checar(
    "unidade com barra (sairia do lugar das chaves): recusado inteiro",
    lerEnvelopeArquivo({ ...env, escopos: [{ ...env.escopos[0]!, escopo: { ...env.escopos[0]!.escopo, unidade: "110/un/p" } }] }) === null,
  );
  checar(
    "lista enorme: recusado inteiro",
    lerEnvelopeArquivo({
      ...env,
      escopos: [{ ...env.escopos[0]!, entidades: { ...env.escopos[0]!.entidades, m: Array.from({ length: 501 }, () => ({})) } }],
    }) === null,
  );
  const outraArea = areaMemoria();
  const r = await importarTudo(outraArea, env, DONO, repos(outraArea).carimbo);
  checar("importar mescla os tres escopos noutro navegador", r.novos >= 3 && (await escoposDoUsuario(outraArea, DONO)).length === 3, r);
  const daBia = await importarTudo(
    outraArea,
    { ...env, escopos: env.escopos.map((s) => ({ ...s, escopo: { ...s.escopo, login: "bia" } })) },
    DONO,
    repos(outraArea).carimbo,
  );
  checar(
    "o que e de outro login fica de fora",
    daBia.novos === 0 && (await escoposDoUsuario(outraArea, { host: HOST, login: "bia" })).length === 0,
  );
  {
    const areaH = areaMemoria();
    const deOutroSei = await importarTudo(
      areaH,
      {
        ...env,
        escopos: env.escopos.map((s) => ({ ...s, escopo: { ...s.escopo, host: "outro.gov.br" } })),
        sigilo: env.sigilo?.map((x) => ({ ...x, host: "outro.gov.br" })),
      },
      DONO,
      repos(areaH).carimbo,
    );
    checar(
      "o que e de outro SEI (mesmo login) fica de fora: nem os projetos nem a memoria do sigilo",
      deOutroSei.novos === 0 && (await areaH.chaves!()).length === 0,
      await areaH.chaves!(),
    );
  }
  {
    const areaD = areaMemoria();
    const base = env.escopos.find((s) => s.escopo.vis === "unidade" && s.escopo.unidade === "110")!;
    const torto = {
      ...env,
      sigilo: undefined,
      escopos: [
        { ...base, escopo: { ...base.escopo, unidade: "110/un/p" } },
        { ...base, escopo: { ...base.escopo, vis: "todos" } },
      ],
    } as unknown as EnvelopeArquivo;
    const rD = await importarTudo(areaD, torto, DONO, repos(areaD).carimbo).catch((e: Error) => e.name);
    checar(
      "escopo com barra ou visibilidade torta direto no importarTudo (sem passar pela leitura): ignorado, nada gravado",
      typeof rD === "object" && rD.novos === 0 && (await areaD.chaves!()).length === 0,
      { rD, chaves: await areaD.chaves!() },
    );
  }
  {
    const comTorto = JSON.parse(JSON.stringify(env)) as EnvelopeArquivo;
    (comTorto.escopos[0]!.entidades.p as unknown[]).push(null, { id: "torto", nome: 7 });
    const lido = lerEnvelopeArquivo(comTorto);
    const area3 = areaMemoria();
    const r3 = lido ? await importarTudo(area3, lido, DONO, repos(area3).carimbo) : null;
    checar(
      "item torto numa lista: o envelope e lido, o item e ignorado (contado) e o resto entra",
      !!r3 &&
        r3.ignorados === 2 &&
        r3.novos >= 3 &&
        !(await new RepositorioProjetos(area3, env.escopos[0]!.escopo, carimbo).projetos.obter("torto")),
      r3,
    );
  }

  secao("arquivo: a sincronia generica com o adaptador dos projetos");
  const noDisco = { conteudo: "", gravacoes: 0 };
  const arquivo = {
    ler: async () => noDisco.conteudo,
    gravar: async (c: string) => {
      noDisco.gravacoes++;
      noDisco.conteudo = c;
    },
  };
  const outros: EnvelopeArquivo = {
    ...env,
    escopos: [{ ...env.escopos[0]!, escopo: { ...env.escopos[0]!.escopo, login: "bia" } }],
    sigilo: [{ versao: VERSAO_SIGILO, host: HOST, login: "bia", processos: ["98765"], documentos: [] }],
  };
  noDisco.conteudo = JSON.stringify(outros);
  const sinc = new SincroniaArquivo({
    area,
    chaveStatus: "projetos/sync/arquivo/t",
    arquivo,
    adaptador: adaptadorArquivoProjetos(area, DONO, carimbo),
  });
  const s1 = await sinc.sincronizar();
  const gravado = JSON.parse(noDisco.conteudo) as EnvelopeArquivo;
  checar(
    "grava os escopos da ana e mantem os da bia que ja estavam no arquivo",
    s1.estado === "ok" &&
      gravado.escopos.length === 4 &&
      gravado.escopos.some((s) => s.escopo.login === "bia") &&
      /mantidos/.test(s1.mensagem ?? ""),
    s1,
  );
  checar(
    "a memoria do sigilo da ana vai no arquivo, e a da bia que ja estava fica como estava",
    gravado.sigilo?.length === 2 &&
      gravado.sigilo.some((s) => s.login === "ana" && s.processos.includes(CHAVE_X)) &&
      gravado.sigilo.some((s) => s.login === "bia" && s.processos.join() === "98765"),
    gravado.sigilo,
  );
  checar(
    "e a memoria da bia nao entra na da ana nem vira memoria da bia neste navegador",
    !(await memoriaDaAna(area)).p.has("98765") &&
      !Object.keys(await area.obter(null)).some((k) => k.startsWith(prefixoMemoriaSigilo(HOST, "bia"))),
  );
  const n = noDisco.gravacoes;
  await sinc.sincronizar();
  checar("sem mudanca, nao regrava", noDisco.gravacoes === n);
  await de({}).lembrarSigilo({ processos: ["55555"], documentos: [] }, "local");
  await sinc.sincronizar();
  checar(
    "so a memoria do sigilo mudou: o arquivo e regravado com ela",
    noDisco.gravacoes === n + 1 &&
      !!(JSON.parse(noDisco.conteudo) as EnvelopeArquivo).sigilo?.some((s) => s.login === "ana" && s.processos.includes("55555")),
  );
  noDisco.conteudo = "{ isto nao e json";
  const s3 = await sinc.sincronizar();
  checar(
    "arquivo ilegivel: regravado, sem apagar nada daqui",
    s3.estado === "ok" && (s3.mensagem ?? "").includes("ilegível") && (await escoposDoUsuario(area, DONO)).length === 3,
  );
  const futuro = JSON.stringify({ ...env, versao: 2 });
  noDisco.conteudo = futuro;
  const s4 = await sinc.sincronizar();
  checar("arquivo de versao mais nova: nao e tocado", s4.estado === "erro" && noDisco.conteudo === futuro);
  {
    const comNulo = JSON.parse(JSON.stringify(env)) as EnvelopeArquivo;
    (comNulo.escopos[0]!.entidades.p as unknown[]).push(null);
    noDisco.conteudo = JSON.stringify(comNulo);
    const s5 = await sinc.sincronizar();
    checar(
      "item nulo no arquivo: a sincronia nao quebra e regrava o arquivo limpo",
      s5.estado === "ok" && !noDisco.conteudo.includes("null"),
      s5,
    );
  }

  secao("copias diarias e restaurar");
  const copias = copiasEmMemoria<EnvelopeArquivo>();
  checar("a primeira do dia e feita", await fazerCopiaDoDia(area, DONO, copias, "2026-10-06", carimbo));
  checar("a segunda no mesmo dia nao", !(await fazerCopiaDoDia(area, DONO, copias, "2026-10-06", carimbo)));
  const [copia] = await copias.listar(DONO);
  checar("a copia conta os projetos ativos (os 3)", copia?.quantidade === 3, copia?.quantidade);
  checar("a copia leva a memoria do sigilo", !!copia?.envelope.sigilo?.some((s) => s.login === "ana" && s.processos.includes(CHAVE_X)));
  for (let d = 7; d <= 21; d++) await fazerCopiaDoDia(area, DONO, copias, `2026-10-${String(d).padStart(2, "0")}`, carimbo);
  checar("ficam as 14 mais recentes", (await copias.listar(DONO)).length === 14);
  const un = de({});
  const [alvo] = (await un.dados()).projetos;
  await un.removerProjeto(alvo!.id);
  const novo = await un.criarProjeto({ nome: "Criado depois da copia" });
  const restaurados = await restaurarCopia(area, copia!, DONO, carimbo);
  checar(
    "restaurar traz de volta o excluido depois da copia e mantem o criado depois",
    restaurados.projetos === 1 && !!(await un.obterProjeto(alvo!.id)) && !!(await un.obterProjeto(novo.id)),
    restaurados,
  );

  await verificarRestaurarRecupera();

  await verificarMemoriaNoArquivo();
}

/**
 * Rodada 1: restaurar uma cópia RECUPERA o que sumiu (o item da cópia ausente aqui ou com lápide, recarimbado para
 * vencer a lápide); o que está vivo aqui fica como está, mesmo diferente da cópia (a edição de um colega depois da
 * cópia não é desfeita). O número devolvido é o que voltou de fato.
 */
async function verificarRestaurarRecupera(): Promise<void> {
  secao("restaurar recupera o que sumiu, nao volta no tempo");
  const area = areaMemoria();
  const { carimbo, de } = repos(area);
  const un = de({});
  const p1 = await un.criarProjeto({ nome: "P1" });
  const e1a = await un.criarEtapa({ projeto: p1.id, nome: "E1a", ...ETAPA });
  const e1b = await un.criarEtapa({ projeto: p1.id, nome: "E1b", ...ETAPA });
  const p2 = await un.criarProjeto({ nome: "P2" });
  const f2 = await un.criarFase(p2.id, "Instrução");
  const e2a = await un.criarEtapa({ projeto: p2.id, nome: "E2a", fase: f2.id, ...ETAPA });
  const e2b = await un.criarEtapa({ projeto: p2.id, nome: "E2b", ...ETAPA });
  const modelo = await un.salvarComoModelo(p1.id, "Modelo do P1");
  const copias = copiasEmMemoria<EnvelopeArquivo>();
  await fazerCopiaDoDia(area, DONO, copias, HOJE, carimbo);
  const [copia] = await copias.listar(DONO);
  // Depois da cópia: a Bia renomeia o P1 (chega pelo texto da unidade, com o carimbo dela) ...
  const atualP1 = (await un.obterProjeto(p1.id))!;
  const daBia: Projeto = {
    ...atualP1,
    nome: "P1 (renomeado pela Bia)",
    atualizadoEm: carimbo().agora,
    dispositivo: "pc-bia",
    alteradoPor: "bia",
  };
  await un.importar({ p: [daBia] });
  // ... e a Ana edita uma etapa, exclui o P2 (com a fase e as etapas), uma etapa do P1 e o modelo, e cria o P3.
  await un.editarEtapa(e1a.id, { nome: "E1a revisada" }, HOJE);
  await un.removerProjeto(p2.id);
  await un.removerEtapa(e1b.id);
  await un.removerModelo(modelo.id);
  const p3 = await un.criarProjeto({ nome: "P3" });
  const vivosAntes = jsonEstavel([await un.obterProjeto(p1.id), await un.obterEtapa(e1a.id), await un.obterProjeto(p3.id)]);
  const n = await restaurarCopia(area, copia!, DONO, carimbo);
  const d = await un.dados();
  checar(
    "o P1 fica com o nome que a Bia deu depois da copia, e a etapa editada depois fica editada",
    (await un.obterProjeto(p1.id))?.nome === "P1 (renomeado pela Bia)" && (await un.obterEtapa(e1a.id))?.nome === "E1a revisada",
  );
  checar(
    "nada vivo e recarimbado (P1, a etapa editada e o P3 ficam exatamente como estavam)",
    jsonEstavel([await un.obterProjeto(p1.id), await un.obterEtapa(e1a.id), await un.obterProjeto(p3.id)]) === vivosAntes,
  );
  checar(
    "o P2 volta com a fase e as etapas dele",
    d.projetos.some((x) => x.id === p2.id) &&
      d.fases.some((x) => x.id === f2.id) &&
      d.etapas.some((x) => x.id === e2a.id) &&
      d.etapas.some((x) => x.id === e2b.id),
    d,
  );
  checar(
    "a etapa excluida depois da copia volta (o projeto dela estava vivo)",
    d.etapas.some((x) => x.id === e1b.id),
  );
  checar(
    "o modelo excluido depois da copia volta",
    d.modelos.some((x) => x.id === modelo.id),
  );
  checar(
    "e o criado depois da copia fica",
    d.projetos.some((x) => x.id === p3.id),
  );
  checar(
    "o que voltou de fato, por tipo: P2, a fase, as duas etapas e a do P1, o modelo (registros: nenhum sumiu)",
    jsonEstavel(n) === jsonEstavel({ projetos: 1, fases: 1, etapas: 3, modelos: 1, registros: 0, noOutroEscopo: 0, rotulosDoOutro: [] }),
    n,
  );
  checar(
    "restaurar de novo nao traz mais nada (tudo ja esta vivo)",
    jsonEstavel(await restaurarCopia(area, copia!, DONO, carimbo)) ===
      jsonEstavel({ projetos: 0, fases: 0, etapas: 0, modelos: 0, registros: 0, noOutroEscopo: 0, rotulosDoOutro: [] }),
  );
  {
    // O registro do histórico que sumiu daqui (podado, outro perfil) volta e é contado à parte.
    const areaR = areaMemoria();
    const unR = new RepositorioProjetos(areaR, un.escopo, carimbo);
    const daCopia = copia!.envelope.escopos.find((x) => chaveEscopo(x.escopo) === chaveEscopo(un.escopo))!.entidades;
    await unR.importar({ ...daCopia, h: [] });
    const r = await restaurarCopia(areaR, copia!, DONO, carimbo);
    checar(
      "registros do historico ausentes voltam e sao contados como registros",
      r.registros === daCopia.h.length && r.registros > 0 && r.projetos + r.fases + r.etapas + r.modelos === 0,
      r,
    );
  }

  secao("restaurar: copia torta no IndexedDB nao restaura nada nem lanca TypeError");
  {
    const areaT = areaMemoria();
    const quebrada = { ...copia!, envelope: { formato: "seipro-projetos" } as unknown as EnvelopeArquivo };
    const r1 = await restaurarCopia(areaT, quebrada, DONO, carimbo).then(
      (x) => x,
      (e: Error) => e.name,
    );
    checar(
      "envelope sem escopos: erro que diz o que houve (nao TypeError) e nada gravado",
      r1 === "ErroValidacao" && (await areaT.chaves!()).length === 0,
      r1,
    );
    const comNulo = JSON.parse(JSON.stringify(copia!)) as typeof copia & object;
    for (const s of comNulo.envelope.escopos) (s.entidades.p as unknown[]).unshift(null, 7, { id: 3 });
    const r2 = await restaurarCopia(areaT, comNulo, DONO, carimbo).then(
      (x) => x,
      (e: Error) => `${e.name}: ${e.message}`,
    );
    checar(
      "itens tortos na copia: ficam de fora, sem TypeError, e o resto volta",
      typeof r2 === "object" && r2.projetos >= 1 && (await new RepositorioProjetos(areaT, un.escopo, carimbo).dados()).projetos.length >= 1,
      r2,
    );
  }
}

/**
 * Decisão da Tarefa 6: o arquivo é do próprio usuário e leva também a memória do sigilo dele (campo `sigilo`,
 * versionado); importar e restaurar a devolvem como "local", sem tirar nada do que já está lá.
 */
async function verificarMemoriaNoArquivo(): Promise<void> {
  /** A ana: o X ficou só nos registros (o processo do projeto foi trocado) e o DOC só nos registros da etapa. */
  async function origem() {
    const a = computador("ana", "pc-ana");
    const p = await a.un.criarProjeto({ nome: "Fiscalização" });
    await a.un.editarProjeto(p.id, { processo: { protocolo: X } }); // digitado, sem marca: o registro leva o número
    await a.un.editarProjeto(p.id, { processo: { protocolo: X, sigiloso: true } }); // a caixa marcou
    const e = await a.un.criarEtapa({ projeto: p.id, nome: "Oitiva", ...ETAPA });
    await a.un.editarEtapa(e.id, { documento: { numero: DOC } }, HOJE); // etapa sigilosa: o DOC fica marcado
    await a.un.editarEtapa(e.id, { processo: { protocolo: OUTRO } }, HOJE); // a etapa deixa de ser sigilosa
    await a.un.editarEtapa(e.id, { documento: { numero: "7777009" } }, HOJE); // e o DOC sai do estado
    await a.un.editarProjeto(p.id, { processo: { protocolo: OUTRO } }); // a base do X sumiu
    let n = 0;
    const carimbo = () => ({ agora: AGORA + 500 + ++n, dispositivo: "pc-ana", por: "ana", nome: "ana" });
    return { a, p, e, carimbo };
  }
  /** Um perfil novo da ana (outro navegador), com o relógio adiante; o Texto Padrão da unidade gravado pelo motor de verdade. */
  async function textoNoPerfilNovo(area: Area) {
    const b = computador("ana", "pc-novo", AGORA + 1000, area);
    const sei = noSei();
    await b.rodada(b.un, sei);
    return { b, json: await jsonDe(sei.html) };
  }

  secao("memoria do sigilo no arquivo: vai junto e volta num perfil novo");
  {
    const { a, carimbo } = await origem();
    const memA = await memoriaDaAna(a.area);
    checar(
      "premissa: neste navegador a memoria sabe do X e do DOC (so nos registros)",
      memA.p.get(CHAVE_X) === "local" && memA.d.get(DOC) === "local",
      memA,
    );
    const env = await exportarTudo(a.area, DONO, carimbo);
    const minha = env.sigilo?.find((s) => s.login === "ana");
    checar(
      "o envelope leva a memoria da ana num campo proprio, versionado, por host e login",
      env.sigilo?.length === 1 &&
        minha?.versao === VERSAO_SIGILO &&
        minha.host === HOST &&
        minha.processos.includes(CHAVE_X) &&
        minha.documentos.includes(DOC),
      env.sigilo,
    );
    const iguais = await Promise.all(
      env.escopos.map(
        async (s) =>
          Object.keys(s).sort().join() === "entidades,escopo" &&
          Object.keys(s.escopo).sort().join() === "host,login,unidade,vis" &&
          jsonEstavel(s.entidades) === jsonEstavel(await new RepositorioProjetos(a.area, s.escopo, carimbo).entidades()),
      ),
    );
    checar(
      "a memoria fica so no campo sigilo: cada escopo leva exatamente as entidades do repositorio, sem nada a mais",
      Object.keys(env).sort().join() === "escopos,formato,gerado,sigilo,tipo,versao" && iguais.length === 1 && iguais.every(Boolean),
      { chaves: Object.keys(env), iguais },
    );

    // Sem o campo (um arquivo de antes), o perfil novo não sabe do sigilo: o número dos registros iria ao texto.
    const { sigilo: _sem, ...semCampo } = env;
    const lidoSem = lerEnvelopeArquivo(JSON.parse(JSON.stringify(semCampo)));
    checar("arquivo sem o campo (versao anterior): continua aceito", !!lidoSem && lidoSem.escopos.length === 1 && !lidoSem.sigilo);
    const areaSem = areaMemoria();
    await importarTudo(areaSem, lidoSem!, DONO, carimbo);
    const sem = await textoNoPerfilNovo(areaSem);
    checar(
      "premissa: sem a memoria, o perfil novo levaria o X e o DOC dos registros ao Texto Padrao",
      sem.json.includes("000777") && sem.json.includes(DOC),
    );

    const areaNova = areaMemoria();
    const lido = lerEnvelopeArquivo(JSON.parse(JSON.stringify(env)));
    await importarTudo(areaNova, lido!, DONO, carimbo);
    const memNova = await memoriaDaAna(areaNova);
    checar(
      "importar num perfil novo devolve a memoria, como local",
      memNova.p.get(CHAVE_X) === "local" && memNova.d.get(DOC) === "local",
      memNova,
    );
    const com = await textoNoPerfilNovo(areaNova);
    checar(
      "e o numero que so existe nos registros nao vai ao Texto Padrao (decodificado)",
      !!com.json && !com.json.includes("000777") && !com.json.includes(DOC) && com.json.includes("000002"),
      com.json,
    );
    checar(
      "e o historico do perfil novo tem os numeros (o arquivo e do usuario)",
      (await com.b.un.historico()).some((r) => r.campo === "processo" && r.depois === X),
    );
  }

  secao("memoria do sigilo no arquivo: restaurar uma copia num perfil novo");
  {
    const { a, carimbo } = await origem();
    const copias = copiasEmMemoria<EnvelopeArquivo>();
    await fazerCopiaDoDia(a.area, DONO, copias, HOJE, carimbo);
    const [copia] = await copias.listar(DONO);
    const areaNova = areaMemoria();
    const n = await restaurarCopia(areaNova, copia!, DONO, carimbo);
    const memNova = await memoriaDaAna(areaNova);
    checar(
      "restaurar devolve a memoria, como local",
      n.projetos >= 1 && memNova.p.get(CHAVE_X) === "local" && memNova.d.get(DOC) === "local",
      memNova,
    );
    const com = await textoNoPerfilNovo(areaNova);
    checar(
      "e depois da restauracao o numero dos registros nao volta ao Texto Padrao",
      !!com.json && !com.json.includes("000777") && !com.json.includes(DOC),
      com.json,
    );
  }

  secao("memoria do sigilo no arquivo: nada do que ja esta la sai nem muda; o teto das aprendidas fica como esta");
  {
    const prefixo = prefixoMemoriaSigilo(HOST, "ana");
    const cheias: Record<string, string> = {};
    for (let i = 0; i < 20_000; i++) cheias[`${prefixo}p/9${String(i).padStart(8, "0")}`] = "aprendida";
    const areaM = areaMemoria({ ...cheias, [`${prefixo}p/111`]: "aprendida", [`${prefixo}d/222`]: "local" });
    const antes = await memoriaDaAna(areaM);
    const env: EnvelopeArquivo = {
      formato: "seipro-projetos",
      versao: 1,
      tipo: "copia",
      gerado: AGORA,
      escopos: [],
      sigilo: [{ versao: VERSAO_SIGILO, host: HOST, login: "ana", processos: ["111", "333"], documentos: ["222", "0444"] }],
    };
    await importarTudo(areaM, env, DONO, repos(areaM).carimbo);
    const depois = await memoriaDaAna(areaM);
    const aprendidas = (m: Map<string, string>) => [...m.values()].filter((o) => o === "aprendida").length;
    checar(
      "a aprendida que ja estava fica aprendida (nao e promovida) e a local fica local",
      depois.p.get("111") === "aprendida" && depois.d.get("222") === "local",
    );
    checar(
      "o que faltava entra como local, mesmo com as aprendidas cheias (documento pela chave, sem zero a esquerda)",
      depois.p.get("333") === "local" && depois.d.get("444") === "local",
      [...depois.d],
    );
    checar(
      "nada sai e as aprendidas nao mudam",
      depois.chaves === antes.chaves + 2 && aprendidas(depois.p) === aprendidas(antes.p) && aprendidas(depois.p) === 20_001,
      [antes.chaves, depois.chaves],
    );
  }

  secao("memoria do sigilo no arquivo: uma entrada so, a do dono, e no maximo 5000 locais novas por importacao");
  {
    const vazio = (sigilo: unknown): EnvelopeArquivo =>
      ({ formato: "seipro-projetos", versao: 1, tipo: "copia", gerado: AGORA, escopos: [], sigilo }) as EnvelopeArquivo;
    const entrada = (host: string, login: string, processos: string[], documentos: string[] = []) => ({
      versao: VERSAO_SIGILO,
      host,
      login,
      processos,
      documentos,
    });
    const areaV = areaMemoria();
    const lidoV = lerEnvelopeArquivo(
      JSON.parse(
        JSON.stringify(
          vazio([
            entrada(HOST, "bia", ["30000000001"]),
            entrada("outro.gov.br", "ana", ["30000000002"]),
            entrada(HOST, "ANA", ["30000000003"], ["0444"]),
            entrada(HOST, "ana", ["30000000004"]),
          ]),
        ),
      ),
    );
    await importarTudo(areaV, lidoV!, DONO, repos(areaV).carimbo);
    const memV = await memoriaDaAna(areaV);
    checar(
      "varias entradas: so a primeira do dono (host e login, sem caixa) e devolvida; a de outro login, a de outro SEI e a segunda do dono ficam de fora",
      [...memV.p.keys()].join() === "30000000003" &&
        memV.d.get("444") === "local" &&
        !Object.keys(await areaV.obter(null)).some((k) => k.includes("|bia/") || k.includes("outro.gov.br")),
      { p: [...memV.p.keys()], chaves: await areaV.chaves!() },
    );

    const forjado = vazio([
      entrada(
        HOST,
        "ana",
        Array.from({ length: TETO_SIGILO_ARQUIVO }, (_, i) => String(10_000_000_000 + i)),
      ),
    ]);
    const lidoF = lerEnvelopeArquivo(JSON.parse(JSON.stringify(forjado)));
    const areaF = areaMemoria({ [`${prefixoMemoriaSigilo(HOST, "ana")}p/111`]: "aprendida" });
    await importarTudo(areaF, lidoF!, DONO, repos(areaF).carimbo);
    const memF = await memoriaDaAna(areaF);
    const contar = (o: string) => [...memF.p.values()].filter((x) => x === o).length;
    checar(
      "arquivo forjado de 200000 numeros: entram 5000 como local e o resto como aprendida, so ate o teto de 20000",
      LIMITE_LOCAIS_ARQUIVO === 5000 &&
        lidoF?.sigilo?.[0]?.processos.length === 200_000 &&
        contar("local") === 5000 &&
        contar("aprendida") === TETO_APRENDIDAS &&
        memF.p.get("111") === "aprendida" &&
        memF.chaves === 5000 + TETO_APRENDIDAS,
      { locais: contar("local"), aprendidas: contar("aprendida"), chaves: memF.chaves },
    );
  }

  secao("memoria do sigilo no arquivo: campo torto e ignorado sem derrubar a importacao");
  {
    const { a, carimbo } = await origem();
    const env = await exportarTudo(a.area, DONO, carimbo);
    const valida = env.sigilo![0]!;
    const casos: Array<[string, unknown]> = [
      ["o campo nao e lista", "lixo"],
      ["entrada com numero que nao e texto", [{ ...valida, processos: [...valida.processos, 123] }]],
      ["entrada de versao mais nova", [{ ...valida, versao: VERSAO_SIGILO + 1 }]],
      ["entrada sem login", [{ ...valida, login: undefined }]],
      ["lista de numeros enorme", [{ ...valida, documentos: Array.from({ length: TETO_SIGILO_ARQUIVO + 1 }, (_, i) => String(i + 1)) }]],
    ];
    for (const [caso, sigilo] of casos) {
      const lido = lerEnvelopeArquivo(JSON.parse(JSON.stringify({ ...env, sigilo })));
      const areaT = areaMemoria();
      const r = lido ? await importarTudo(areaT, lido, DONO, carimbo) : null;
      const mem = await memoriaDaAna(areaT);
      checar(
        `${caso}: o envelope e lido, os projetos entram e a entrada torta nao chega a memoria`,
        !!lido && !lido.sigilo?.length && !!r && r.novos >= 1 && !mem.d.has(DOC) && !mem.p.has(CHAVE_X),
        { sigilo: lido?.sigilo, r, p: [...mem.p.keys()] },
      );
    }
    const lido = lerEnvelopeArquivo(
      JSON.parse(
        JSON.stringify({
          ...env,
          sigilo: [{ ...valida, processos: [1] }, valida, { versao: 1, host: HOST, login: "bia", processos: [], documentos: [] }],
        }),
      ),
    );
    checar(
      "so a entrada torta sai: as boas ficam (a da ana e a da bia)",
      lido?.sigilo?.length === 2 && lido.sigilo.some((s) => s.login === "ana") && lido.sigilo.some((s) => s.login === "bia"),
      lido?.sigilo,
    );
  }

  secao("memoria do sigilo no arquivo: a entrada do proprio usuario nunca e lida como torta (sem regravar em laco)");
  {
    const { a, carimbo } = await origem();
    // Uma chave do storage editada à mão, com um "número" maior do que a memória aceita.
    await a.area.gravar({ [`${prefixoMemoriaSigilo(HOST, "ana")}p/${"9".repeat(100)}`]: "local" });
    const env = await exportarTudo(a.area, DONO, carimbo);
    const lido = lerEnvelopeArquivo(JSON.parse(JSON.stringify(env)));
    checar(
      "a exportacao leva so os numeros que a leitura aceita, e a entrada volta inteira",
      lido?.sigilo?.length === 1 && lido.sigilo[0]!.processos.includes(CHAVE_X) && !JSON.stringify(env.sigilo).includes("9".repeat(100)),
      lido?.sigilo,
    );
    const disco = { conteudo: "", gravacoes: 0 };
    const sinc = new SincroniaArquivo({
      area: a.area,
      chaveStatus: "projetos/sync/arquivo/laco",
      arquivo: {
        ler: async () => disco.conteudo,
        gravar: async (c: string) => {
          disco.gravacoes++;
          disco.conteudo = c;
        },
      },
      adaptador: adaptadorArquivoProjetos(a.area, DONO, carimbo),
    });
    await sinc.sincronizar();
    await sinc.sincronizar();
    await sinc.sincronizar();
    checar("e a sincronia do arquivo grava uma vez so", disco.gravacoes === 1, disco.gravacoes);
  }

  secao("memoria do sigilo no arquivo: falha fechada (erro de leitura ou gravacao da memoria)");
  {
    const { a, carimbo } = await origem();
    const env = await exportarTudo(a.area, DONO, carimbo);
    const ilegivel = areaQueNaoLeMemoria();
    const erroLer = await importarTudo(ilegivel, env, DONO, carimbo).then(
      () => null,
      (e: Error) => e,
    );
    checar(
      "memoria ilegivel (erro do storage): a importacao falha com a mensagem generica e nada dos projetos e gravado",
      erroLer instanceof ErroMemoriaSigilo &&
        erroLer.message === MENSAGEM_MEMORIA &&
        new ErroMemoriaSigilo().message === MENSAGEM_MEMORIA &&
        (await escoposDoUsuario(ilegivel, DONO)).length === 0,
      erroLer,
    );
    {
      // A chave única da rodada 2 (só existiu nesta branch) não é mais lida: torta, não impede nada.
      const comAntiga = areaMemoria({ "projetos/sigilo/sei.x.gov.br|ana": { processos: 7 } });
      const r = await importarTudo(comAntiga, env, DONO, carimbo).catch((e: Error) => e.name);
      checar("a chave unica antiga da memoria nao e mais lida (torta, nao impede a importacao)", typeof r === "object" && r.novos >= 1, r);
    }
    const semGravar = areaQueNaoGravaMemoria();
    const erroGravar = await importarTudo(semGravar, env, DONO, carimbo).then(
      () => null,
      (e: Error) => e.message,
    );
    checar(
      "a memoria nao grava: a importacao falha antes de gravar os projetos",
      erroGravar === "cota excedida" && semGravar.gravacoes === 0 && (await escoposDoUsuario(semGravar, DONO)).length === 0,
      erroGravar,
    );
    const semGravarCopia = areaQueNaoGravaMemoria();
    const [copia] = await (async () => {
      const c = copiasEmMemoria<EnvelopeArquivo>();
      await fazerCopiaDoDia(a.area, DONO, c, HOJE, carimbo);
      return c.listar(DONO);
    })();
    const erroRestaurar = await restaurarCopia(semGravarCopia, copia!, DONO, carimbo).then(
      () => null,
      (e: Error) => e.message,
    );
    checar("restaurar tambem falha fechado", erroRestaurar === "cota excedida" && semGravarCopia.gravacoes === 0, erroRestaurar);
    const erroExportar = await exportarTudo(ilegivel, DONO, carimbo).then(
      () => null,
      (e: Error) => e.name,
    );
    const copiasIlegivel = copiasEmMemoria<EnvelopeArquivo>();
    const fez = await fazerCopiaDoDia(ilegivel, DONO, copiasIlegivel, HOJE, carimbo).catch(() => "erro");
    checar(
      "exportar com a memoria ilegivel tambem para (o arquivo nao perde a memoria que ja tinha) e nenhuma copia e gravada",
      erroExportar === "ErroMemoriaSigilo" && fez === "erro" && (await copiasIlegivel.listar(DONO)).length === 0,
      [erroExportar, fez],
    );
  }
}
