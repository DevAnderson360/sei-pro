/**
 * O adaptador do Texto Padrão dos projetos (spec 6.1): nomes, validação,
 * privacidade dos sigilosos, poda, assinatura, relatório da leitura e, com o
 * motor genérico de verdade, o texto editado à mão, de versão mais nova e
 * perto ou acima do teto (Review Focus 1 do plano-mestre).
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { type DestinoTexto, MotorTextoPadrao, type StatusSync } from "@comum/sincronia/motor";
import { gerarConteudoTexto, lerConteudoTexto } from "@comum/sincronia/textoPadraoCodec";
import { prefixoMemoriaSigilo } from "../src/modelo/constantes";
import { baseDoEscopo } from "../src/modelo/escopo";
import { ErroMemoriaSigilo, entradasParaGravar, lerMemoria, TETO_APRENDIDAS } from "../src/modelo/memoriaSigilo";
import type { EnvelopeProjetos, Registro } from "../src/modelo/tipos";
import {
  adaptadorProjetos,
  assinaturaProjetos,
  chaveRelatorio,
  chaveSubstituido,
  contarFuturos,
  descricaoDoTexto,
  legivelProjetos,
  nomeDoTexto,
  paraOTexto,
  type RelatorioImportacao,
  SIGILOSO_DOCUMENTO,
  SIGILOSO_PROCESSO,
  TETO_TEXTO,
  type TextoSubstituido,
  validarEnvelope,
} from "../src/sincronia/textoPadrao";
import { ESCOPO_EU, ESCOPO_UN, novoRepo } from "./apoioRepositorio";
import { etapa, projeto } from "./fabrica";
import { checar, secao } from "./util";

const DIA = 86_400_000;
const AGORA = Date.UTC(2026, 9, 6, 12);
const SIGILO = "50300.000777/2026-10";

function envelope(m: Partial<EnvelopeProjetos> = {}): EnvelopeProjetos {
  return {
    formato: "seipro-projetos",
    versao: 1,
    host: ESCOPO_UN.host,
    unidade: ESCOPO_UN.unidade,
    vis: "unidade",
    gerado: AGORA,
    entidades: { p: [], f: [], e: [], h: [], m: [] },
    ...m,
  };
}

function registro(m: Partial<Registro> & { id: string }): Registro {
  return { alvo: "e1", projeto: "p1", quando: AGORA, por: "ana", campo: "nome", atualizadoEm: AGORA, dispositivo: "dev-a", ...m };
}

/** O Texto Padrão "no SEI", que confere a gravação como o armazém do núcleo. */
function noSei(html: string | null = null) {
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

function motorDe(
  repo: ReturnType<typeof novoRepo>["repo"],
  area: ReturnType<typeof areaMemoria>,
  destino: DestinoTexto,
  ajuste: Partial<ReturnType<typeof adaptadorProjetos>> = {},
  agora?: () => number,
) {
  return new MotorTextoPadrao<EnvelopeProjetos>({
    adaptador: { ...adaptadorProjetos({ repo, area, sigla: "SEPRO", nomeUsuario: "Ana Lima" }), ...ajuste },
    destino,
    area,
    travar: (_n, fn) => fn(),
    agora,
    releituras: 3,
    temporizador: { definir: () => 0, cancelar: () => undefined },
  });
}

/** O envelope gravado no texto, em JSON ("" se não há texto ou ele é inválido). */
async function jsonDoTexto(html: string | null): Promise<string> {
  const r = html ? await lerConteudoTexto(html) : null;
  return r && "bruto" in r ? JSON.stringify(r.bruto) : "";
}

export async function verificarSincroniaTexto(): Promise<void> {
  secao("sincronia: nomes e descricoes dos textos");
  checar("o da unidade", nomeDoTexto("unidade", "Ana") === "[_SEIPRO_PRJ_UNIDADE]");
  checar("o pessoal, com o login em minusculas", nomeDoTexto("eu", " Ana.Lima ") === "[_SEIPRO_PRJ_ana.lima]");
  const longo = nomeDoTexto("eu", "fulano.de.tal.com.um.login.enorme@orgao.gov.br");
  checar("login longo: cabe nos 50 do SEI, com ~ e hash", longo.length <= 50 && longo.includes("~"), longo);
  checar("descricoes ate 300 caracteres", descricaoDoTexto("unidade").length < 300 && /unidade/.test(descricaoDoTexto("unidade")));

  secao("sincronia: validacao do envelope");
  checar("o da unidade casa", "ok" in validarEnvelope(envelope(), ESCOPO_UN));
  checar("outro SEI: invalido", "invalido" in validarEnvelope(envelope({ host: "outro.gov.br" }), ESCOPO_UN));
  checar("outra unidade: invalido", "invalido" in validarEnvelope(envelope({ unidade: "999" }), ESCOPO_UN));
  checar("visibilidade trocada: invalido", "invalido" in validarEnvelope(envelope({ vis: "eu", login: "ana" }), ESCOPO_UN));
  checar("pessoal de outro login: invalido", "invalido" in validarEnvelope(envelope({ vis: "eu", login: "bia" }), ESCOPO_EU));
  checar("pessoal sem login: invalido", "invalido" in validarEnvelope(envelope({ vis: "eu" }), ESCOPO_EU));
  checar("pessoal do proprio login (caixa diferente): ok", "ok" in validarEnvelope(envelope({ vis: "eu", login: "ANA" }), ESCOPO_EU));
  checar("versao 2: mais novo (nao e invalido)", "maisNovo" in validarEnvelope(envelope({ versao: 2 as 1 }), ESCOPO_UN));
  checar("outro formato: invalido", "invalido" in validarEnvelope({ formato: "seipro-favoritos", versao: 1 }, ESCOPO_UN));
  const torto = envelope();
  (torto.entidades as unknown as Record<string, unknown>).e = "nada";
  checar("lista que nao e lista: invalido", "invalido" in validarEnvelope(torto, ESCOPO_UN));
  const lotado = envelope();
  lotado.entidades.h = Array.from({ length: 5001 }, (_, i) => registro({ id: `r${i}` }));
  checar("itens demais (alem do que cabe em 100 KB): invalido", "invalido" in validarEnvelope(lotado, ESCOPO_UN));
  const parcial = validarEnvelope({ ...envelope(), entidades: { p: [] } }, ESCOPO_UN);
  checar("lista que falta vira lista vazia", "ok" in parcial && parcial.ok.entidades.m.length === 0);

  secao("sincronia: privacidade dos sigilosos no texto");
  const env = envelope({
    entidades: {
      p: [
        projeto({ id: "p1", processo: { protocolo: SIGILO, idProcedimento: "777", sigiloso: true } }),
        projeto({ id: "p2", processo: { protocolo: "50300.000001/2026-01" } }),
      ],
      f: [],
      e: [
        etapa({ id: "e1", projeto: "p1", documento: { numero: "1234567", titulo: "Termo" } }),
        etapa({ id: "e2", projeto: "p2", processo: { protocolo: "50300000777202610" }, documento: { numero: "7654321" } }),
        etapa({ id: "e3", projeto: "p2", documento: { numero: "1111111" } }),
      ],
      h: [
        registro({ id: "h1", alvo: "p1", projeto: "p1", campo: "processo", depois: SIGILO }),
        registro({ id: "h2", alvo: "e1", projeto: "p1", campo: "documento", depois: "1234567" }),
        registro({ id: "h3", alvo: "e3", projeto: "p2", campo: "documento", depois: "1111111" }),
        registro({ id: "h4", alvo: "p2", projeto: "p2", campo: "processo", depois: "50300.000001/2026-01" }),
      ],
      m: [],
    },
  });
  const saida = paraOTexto(env, AGORA);
  const json = JSON.stringify(saida);
  checar(
    "o numero sigiloso nao aparece em lugar nenhum (nem sem pontuacao)",
    !json.includes("000777") && !json.includes("777202610"),
    json,
  );
  checar("nem o idProcedimento", !json.includes('"777"'));
  checar(
    "o vinculo vai vazio e marcado",
    saida.entidades.p[0]?.processo?.protocolo === "" && saida.entidades.p[0]?.processo?.sigiloso === true,
    saida.entidades.p[0],
  );
  checar("o mesmo processo noutra etapa (sem a marca) tambem vai vazio", saida.entidades.e[1]?.processo?.protocolo === "");
  // Rodada 4 da Tarefa 4: no lugar do documento vai o marcador, sem o número e sem o título.
  const marcador = (d: unknown) => JSON.stringify(d) === JSON.stringify({ numero: "", sigiloso: true });
  checar(
    "documento de etapa sigilosa (herdada do projeto ou propria) nao vai: vai so o marcador",
    marcador(saida.entidades.e[0]?.documento) && marcador(saida.entidades.e[1]?.documento),
  );
  checar("documento de etapa comum vai", saida.entidades.e[2]?.documento?.numero === "1111111");
  checar(
    "registro antigo com o numero vira 'processo sigiloso'",
    saida.entidades.h.find((r) => r.id === "h1")?.depois === SIGILOSO_PROCESSO,
  );
  checar(
    "registro do documento da etapa sigilosa fica sem o numero",
    saida.entidades.h.find((r) => r.id === "h2")?.depois === SIGILOSO_DOCUMENTO,
  );
  checar(
    "os registros comuns ficam como estao",
    saida.entidades.h.find((r) => r.id === "h3")?.depois === "1111111" &&
      saida.entidades.h.find((r) => r.id === "h4")?.depois === "50300.000001/2026-01",
  );
  checar("o envelope de entrada nao muda", env.entidades.p[0]?.processo?.protocolo === SIGILO && !!env.entidades.e[0]?.documento);
  const h1 = env.entidades.h[0] as Registro;
  const h1Saida = saida.entidades.h.find((r) => r.id === "h1");
  checar(
    "o registro raspado mantem o id e o carimbo do original (na volta, fica o daqui)",
    h1Saida?.atualizadoEm === h1.atualizadoEm && h1Saida.dispositivo === h1.dispositivo && h1Saida.quando === h1.quando,
    h1Saida,
  );

  secao("sincronia: poda na exportacao");
  const velha = (dias: number) => AGORA - dias * DIA;
  // A etapa e os registros são do projeto vivo "p1" (sem o projeto no texto, seriam órfãos: revisão final da P4).
  const comLapides = envelope({
    entidades: {
      p: [projeto({ id: "p1" }), projeto({ id: "p-181", removidoEm: velha(181), atualizadoEm: velha(181) })],
      f: [],
      e: [etapa({ id: "e-100", removidoEm: velha(100), atualizadoEm: velha(100) })],
      h: Array.from({ length: 305 }, (_, i) => registro({ id: `h${String(i).padStart(3, "0")}`, quando: AGORA - i })),
      m: [],
    },
  });
  const podado = paraOTexto(comLapides, AGORA);
  checar(
    "unidade: lapide de 181 dias sai, a de 100 fica",
    !podado.entidades.p.some((x) => x.id === "p-181") && podado.entidades.e.length === 1,
  );
  checar(
    "historico: so os 300 mais recentes",
    podado.entidades.h.length === 300 && !podado.entidades.h.some((r) => r.id === "h304"),
    podado.entidades.h.length,
  );
  const pessoal = paraOTexto({ ...comLapides, vis: "eu", login: "ana" }, AGORA);
  checar("pessoal: lapide de 100 dias sai (prazo de 90)", pessoal.entidades.e.length === 0);
  const sigilosaPodada = paraOTexto(
    envelope({
      entidades: {
        p: [
          projeto({ id: "p-velho", processo: { protocolo: SIGILO, sigiloso: true }, removidoEm: velha(181), atualizadoEm: velha(181) }),
          projeto({ id: "p-vivo", processo: { protocolo: SIGILO } }),
        ],
        f: [],
        e: [],
        h: [],
        m: [],
      },
    }),
    AGORA,
  );
  checar(
    "a marca de sigilo de uma lapide que a poda tira ainda vale para os outros",
    !sigilosaPodada.entidades.p.some((x) => x.id === "p-velho") && sigilosaPodada.entidades.p[0]?.processo?.protocolo === "",
    sigilosaPodada.entidades.p,
  );

  secao("sincronia: assinatura e futuro");
  const a1 = assinaturaProjetos(envelope({ gerado: 1 }));
  checar("sem o 'gerado' (quem gravou e quando nao contam)", a1 === assinaturaProjetos(envelope({ gerado: 999 })));
  const ordemA = envelope({ entidades: { p: [projeto({ id: "a" }), projeto({ id: "b" })], f: [], e: [], h: [], m: [] } });
  const ordemB = envelope({ entidades: { p: [projeto({ id: "b" }), projeto({ id: "a" })], f: [], e: [], h: [], m: [] } });
  checar("a ordem das listas nao conta", assinaturaProjetos(ordemA) === assinaturaProjetos(ordemB));
  checar(
    "conta o que vem de mais de 1 dia no futuro",
    contarFuturos({ p: [projeto({ id: "x", atualizadoEm: AGORA + 2 * DIA })], e: [etapa({ id: "y", atualizadoEm: AGORA })] }, AGORA) === 1,
  );

  secao("sincronia: o adaptador com o motor (editado a mao, versao nova, teto)");
  const area = areaMemoria();
  const relogio = { agora: AGORA };
  const { repo } = novoRepo(ESCOPO_UN, area, "a", relogio);
  const p = await repo.criarProjeto({ nome: "Plano anual" });
  await repo.criarEtapa({ projeto: p.id, nome: "Diagnóstico", inicio: "2026-10-06", fim: "2026-10-09" });
  const editadoAMao = `${await gerarConteudoTexto("Dados", envelope())}\n<p>Colei isto aqui sem querer.</p>`;
  const sei1 = noSei(editadoAMao);
  const s1 = await motorDe(repo, area, sei1).sincronizar();
  const guardado = (await area.obter(chaveSubstituido(ESCOPO_UN)))[chaveSubstituido(ESCOPO_UN)] as TextoSubstituido | undefined;
  checar("editado a mao: o texto antigo fica guardado neste navegador", guardado?.html === editadoAMao && !guardado.cortado, guardado);
  checar(
    "e e regravado a partir do local, com aviso",
    sei1.gravadas === 1 && s1.estado === "ok" && /inválido/.test(s1.mensagem ?? "") && /guardado neste navegador/.test(s1.mensagem ?? ""),
    s1,
  );
  const lido = await lerConteudoTexto(sei1.html ?? "");
  checar(
    "o texto regravado tem os projetos daqui",
    "bruto" in lido && (lido.bruto as EnvelopeProjetos).entidades.p.some((x) => x.id === p.id),
  );
  checar("os dados locais ficaram como estavam", (await repo.dados()).etapas.length === 1);
  const maisNovo = await gerarConteudoTexto("Dados", envelope({ versao: 2 as 1 }));
  const sei2 = noSei(maisNovo);
  const s2 = await motorDe(repo, area, sei2).sincronizar({ forcar: true });
  checar(
    "versao mais nova: nao grava e pede para atualizar o SEI Pro",
    sei2.gravadas === 0 && sei2.html === maisNovo && s2.estado === "erro" && /versão mais nova/.test(s2.mensagem ?? ""),
    s2,
  );
  const sei3 = noSei(null);
  const s3 = await motorDe(repo, area, sei3, { teto: 400, aviso: 200 }).sincronizar({ forcar: true });
  checar(
    "acima do teto: nao grava e explica o que fazer",
    sei3.gravadas === 0 &&
      s3.estado === "erro" &&
      /passaram do limite/.test(s3.mensagem ?? "") &&
      /Exclua projetos/.test(s3.mensagem ?? ""),
    s3,
  );
  const sei4 = noSei(null);
  const s4 = await motorDe(repo, area, sei4, { aviso: 300 }).sincronizar({ forcar: true });
  checar("perto do teto: grava e avisa", sei4.gravadas === 1 && /perto do limite/.test(s4.mensagem ?? ""), s4);
  checar("o teto e de 100 KB", TETO_TEXTO === 102_400);

  secao("sincronia: texto que nao existe e escopo vazio");
  const areaV = areaMemoria();
  const { repo: vazio } = novoRepo(ESCOPO_UN, areaV, "v", { agora: AGORA });
  const sei5 = noSei(null);
  const s5 = await motorDe(vazio, areaV, sei5).sincronizar();
  checar("sem projetos da unidade: le e nao cria o texto", sei5.gravadas === 0 && s5.estado === "ok", s5);

  secao("sincronia: relatorio da leitura (relogio atrasado)");
  const areaR = areaMemoria();
  const { repo: r6 } = novoRepo(ESCOPO_UN, areaR, "r", { agora: AGORA });
  const doColega = envelope({
    entidades: { p: [projeto({ id: "futuro", atualizadoEm: AGORA + 3 * DIA })], f: [], e: [], h: [], m: [] },
  });
  await motorDe(r6, areaR, noSei(await gerarConteudoTexto("Dados", doColega))).sincronizar();
  const rel = (await areaR.obter(chaveRelatorio(ESCOPO_UN)))[chaveRelatorio(ESCOPO_UN)] as RelatorioImportacao | undefined;
  checar("o projeto do colega 3 dias no futuro fica de fora e e contado", rel?.futuros === 1 && rel.ignorados === 1, rel);
  checar("e nao entrou", (await r6.dados()).projetos.length === 0);
  const st = (await areaR.obter("projetos/sync/tp/sei.x.gov.br|ana|u:110/un"))["projetos/sync/tp/sei.x.gov.br|ana|u:110/un"] as
    | StatusSync
    | undefined;
  checar("o status fica na chave da spec (projetos/sync/tp/<escopo>)", !!st, st);

  secao("sincronia: a propria copia sigilosa que volta do texto (com o motor)");
  const areaS = areaMemoria();
  const { repo: rs } = novoRepo(ESCOPO_UN, areaS, "s", { agora: AGORA });
  const ps = await rs.criarProjeto({ nome: "Apuração", processo: { protocolo: SIGILO, idProcedimento: "777", sigiloso: true } });
  const es = await rs.criarEtapa({ projeto: ps.id, nome: "Oitiva", inicio: "2026-10-06", fim: "2026-10-09" });
  await rs.concluirEtapa(es.id, "2026-10-09", { numero: "1234567" });
  // Outro projeto com o mesmo número, sem a marca: o registro "processo" dele leva o número (o envelope raspa).
  const pc = await rs.criarProjeto({ nome: "Acompanhamento" });
  await rs.editarProjeto(pc.id, { processo: { protocolo: SIGILO } });
  const seiS = noSei(null);
  await motorDe(rs, areaS, seiS).sincronizar({ forcar: true });
  const lidoS = await lerConteudoTexto(seiS.html ?? "");
  const jsonS = "bruto" in lidoS ? JSON.stringify(lidoS.bruto) : "";
  checar(
    "o texto gravado nao leva o numero, o idProcedimento nem o documento",
    seiS.gravadas === 1 && !!jsonS && !jsonS.includes("000777") && !jsonS.includes('"777"') && !jsonS.includes("1234567"),
    jsonS,
  );
  let avisos = 0;
  const pararS = rs.aoMudar(() => avisos++);
  const sS = await motorDe(rs, areaS, seiS).sincronizar({ forcar: true });
  checar(
    "na rodada seguinte a copia volta: nada regravado aqui (nenhum aviso) nem no SEI",
    seiS.gravadas === 1 && avisos === 0 && sS.estado === "ok" && !sS.pendente,
    { gravadas: seiS.gravadas, avisos, sS },
  );
  pararS();
  const hS = (await rs.entidades()).h;
  checar(
    "e quem tinha os numeros os mantem (vinculo, documento e registros)",
    (await rs.obterProjeto(ps.id))?.processo?.protocolo === SIGILO &&
      (await rs.obterEtapa(es.id))?.documento?.numero === "1234567" &&
      hS.some((r) => r.campo === "documento" && r.depois === "1234567") &&
      hS.some((r) => r.campo === "processo" && r.depois === SIGILO),
  );

  await verificarSigiloGruda();
  await verificarMenoresRodada1();
  await verificarMemoriaDoSigilo();
  await verificarRaspadoFicaRaspado();
}

/** Área de teste que falha (ler ou gravar) quando a operação toca a memória do sigilo e `falhar` está ligado. */
function areaQueFalha(base: Area, quando: { ler: boolean; gravar: boolean }): Area {
  const daMemoria = (ks: string[]) => ks.some((k) => k.startsWith("projetos/sigilo/"));
  return {
    ...base,
    obter: async (ch) => {
      const ks = ch === null || ch === undefined ? ["projetos/sigilo/"] : typeof ch === "string" ? [ch] : ch;
      if (quando.ler && daMemoria(ks)) throw new Error("falha simulada ao ler o storage");
      return base.obter(ch);
    },
    gravar: async (i) => {
      if (quando.gravar && daMemoria(Object.keys(i))) throw new Error("falha simulada ao gravar o storage");
      return base.gravar(i);
    },
    aoMudar: base.aoMudar.bind(base),
  };
}

/** Rodada 3 da Tarefa 4: o que o texto raspou uma vez continua raspado; a memória falha fechada e nunca despeja. */
async function verificarRaspadoFicaRaspado(): Promise<void> {
  const OUTRO = "50300.000002/2026-11";
  const etapaComDocumentosAntigos = async (repo: ReturnType<typeof novoRepo>["repo"]) => {
    const p = await repo.criarProjeto({ nome: "Fiscalização", processo: { protocolo: SIGILO } });
    const e = await repo.criarEtapa({ projeto: p.id, nome: "Ofício", inicio: "2026-10-06", fim: "2026-10-09" });
    // Os documentos da etapa antes de se saber do sigilo: o 7777001 só fica nos registros.
    await repo.editarEtapa(e.id, { documento: { numero: "7777001" } }, "2026-10-06");
    await repo.editarEtapa(e.id, { documento: { numero: "7777002" } }, "2026-10-06");
    return p;
  };

  for (const escopo of [ESCOPO_UN, ESCOPO_EU]) {
    const qual = escopo.vis === "unidade" ? "unidade" : "pessoal";
    secao(`raspado fica raspado (${qual}, um usuario so): o documento antigo da etapa que deixou de ser sigilosa`);
    const area = areaMemoria();
    const { repo } = novoRepo(escopo, area, "r", { agora: AGORA });
    const p = await etapaComDocumentosAntigos(repo);
    const sei = noSei(null);
    const motor = motorDe(repo, area, sei);
    await motor.sincronizar({ forcar: true });
    checar(`${qual}: premissa: antes do sigilo, o texto leva os documentos`, (await jsonDoTexto(sei.html)).includes("7777001"));
    await repo.editarProjeto(p.id, { processo: { protocolo: SIGILO, sigiloso: true } });
    await motor.sincronizar({ forcar: true });
    const j1 = await jsonDoTexto(sei.html);
    checar(`${qual}: marcado, o texto raspa os dois`, !!j1 && !j1.includes("7777001") && !j1.includes("7777002"), j1);
    await repo.editarProjeto(p.id, { processo: { protocolo: OUTRO } });
    await motor.sincronizar({ forcar: true });
    const j2 = await jsonDoTexto(sei.html);
    checar(
      `${qual}: trocado o processo, o 7777001 nao volta ao texto (nem o 7777002, nem o numero)`,
      !!j2 && !j2.includes("7777001") && !j2.includes("7777002") && !j2.includes("000777") && j2.includes("000002"),
      j2,
    );
    checar(
      `${qual}: e o historico daqui continua com os numeros`,
      (await repo.historico(p.id)).some((r) => r.campo === "documento" && r.depois === "7777001"),
    );
  }

  secao("raspado fica raspado: marcado e trocado entre duas rodadas (nenhum texto montado no meio)");
  {
    const area = areaMemoria();
    const { repo } = novoRepo(ESCOPO_UN, area, "b", { agora: AGORA });
    const p = await etapaComDocumentosAntigos(repo);
    await repo.editarProjeto(p.id, { processo: { protocolo: SIGILO, sigiloso: true } });
    await repo.editarProjeto(p.id, { processo: { protocolo: OUTRO } });
    const sei = noSei(null);
    await motorDe(repo, area, sei).sincronizar({ forcar: true });
    const j = await jsonDoTexto(sei.html);
    checar(
      "a gravacao que marcou ja guardou o que o texto rasparia: nada disso vai ao texto",
      !!j && !j.includes("7777001") && !j.includes("7777002") && !j.includes("000777"),
      j,
    );
  }

  secao("memoria do sigilo falha fechada: erro ao ler");
  {
    const base = areaMemoria();
    const quando = { ler: false, gravar: false };
    const area = areaQueFalha(base, quando);
    const { repo } = novoRepo(ESCOPO_UN, area, "f", { agora: AGORA });
    const p = await repo.criarProjeto({ nome: "Apuração", processo: { protocolo: SIGILO, sigiloso: true } });
    const sei = noSei(null);
    const motor = motorDe(repo, area, sei);
    await motor.sincronizar({ forcar: true });
    await repo.editarProjeto(p.id, { nome: "Apuração (fase 2)" });
    quando.ler = true;
    const s1 = await motor.sincronizar({ forcar: true });
    checar("a rodada falha como falha comum e o texto nao e gravado", s1.estado === "erro" && sei.gravadas === 1, { s1, g: sei.gravadas });
    quando.ler = false;
    const s2 = await motor.sincronizar({ forcar: true });
    checar("e a seguinte, com o storage de volta, grava", s2.estado === "ok" && sei.gravadas === 2, { s2, g: sei.gravadas });
  }

  secao("memoria do sigilo falha fechada: erro ao gravar o que o texto raspou");
  {
    const base = areaMemoria();
    const quando = { ler: false, gravar: false };
    const area = areaQueFalha(base, quando);
    const { repo } = novoRepo(ESCOPO_UN, area, "g", { agora: AGORA });
    await repo.criarProjeto({ nome: "Apuração", processo: { protocolo: SIGILO, sigiloso: true } });
    // A memória se perdeu (outro perfil, limpeza manual): a montagem do texto precisa guardá-la de novo.
    await base.remover(Object.keys(await base.obter(null)).filter((k) => k.startsWith("projetos/sigilo/")));
    quando.gravar = true;
    const sei = noSei(null);
    const s1 = await motorDe(repo, area, sei).sincronizar({ forcar: true });
    checar("sem guardar o que raspou, o texto nao e gravado (erro comum)", s1.estado === "erro" && sei.gravadas === 0, {
      s1,
      g: sei.gravadas,
    });
    quando.gravar = false;
    const s2 = await motorDe(repo, area, sei).sincronizar({ forcar: true });
    checar(
      "e a rodada seguinte grava, sem o numero",
      s2.estado === "ok" && sei.gravadas === 1 && !(await jsonDoTexto(sei.html)).includes("000777"),
    );
  }

  secao("memoria do sigilo: a chave unica da rodada 2 (so existiu nesta branch) nao e mais lida");
  {
    const LEGADA = "projetos/sigilo/sei.x.gov.br|ana";
    const area = areaMemoria();
    const { repo } = novoRepo(ESCOPO_UN, area, "t", { agora: AGORA });
    await repo.criarProjeto({ nome: "P1", processo: { protocolo: SIGILO, sigiloso: true } });
    await area.gravar({ [LEGADA]: { processos: "torta", documentos: 7 } });
    const sei = noSei(null);
    const s1 = await motorDe(repo, area, sei).sincronizar({ forcar: true });
    checar(
      "torta, ela nao impede a rodada (a memoria ilegivel agora e so erro do storage) e o numero continua fora do texto",
      s1.estado === "ok" && sei.gravadas === 1 && !(await jsonDoTexto(sei.html)).includes("000777"),
      s1,
    );
    checar("e ela nao entra na memoria", !(await repo.sigilosConhecidos()).processos.has("torta"));
  }

  secao("memoria do sigilo falha fechada: o erro do storage ao ler vira o erro da memoria, com a mensagem generica");
  {
    const base = areaMemoria();
    const quando = { ler: false, gravar: false };
    const area = areaQueFalha(base, quando);
    const { repo } = novoRepo(ESCOPO_UN, area, "h", { agora: AGORA });
    await repo.criarProjeto({ nome: "Apuração", processo: { protocolo: SIGILO, sigiloso: true } });
    quando.ler = true;
    const sei = noSei(null);
    const s1 = await motorDe(repo, area, sei).sincronizar({ forcar: true });
    const lancado = await repo.sigilosConhecidos().then(
      () => null,
      (e: unknown) => e,
    );
    checar(
      "a rodada para com a mensagem que diz o que fazer, e o texto nao e gravado",
      s1.estado === "erro" &&
        s1.mensagem === "Não foi possível ler a lista de processos sigilosos deste computador. Nada foi gravado; tente de novo." &&
        sei.gravadas === 0 &&
        lancado instanceof ErroMemoriaSigilo,
      { s1, lancado },
    );
  }

  secao("memoria do sigilo: dois contextos guardando ao mesmo tempo nao perdem nada");
  {
    const base = areaMemoria();
    let segurar = false;
    let presos: Array<() => void> = [];
    const soltar = () => {
      for (const f of presos) f();
      presos = [];
    };
    const portao: Area = {
      ...base,
      gravar: async (i) => {
        if (segurar && Object.keys(i).some((k) => k.startsWith("projetos/sigilo/"))) {
          // Segura até as duas gravações chegarem: as duas leram a memória antes de qualquer uma gravar.
          await new Promise<void>((r) => {
            presos.push(r);
            if (presos.length >= 2) soltar();
            else setTimeout(soltar, 100);
          });
        }
        return base.gravar(i);
      },
      aoMudar: base.aoMudar.bind(base),
    };
    const { repo: un } = novoRepo(ESCOPO_UN, portao, "c", { agora: AGORA });
    const { repo: eu } = novoRepo(ESCOPO_EU, portao, "d", { agora: AGORA });
    segurar = true;
    await Promise.all([
      un.criarProjeto({ nome: "Da unidade", processo: { protocolo: SIGILO, sigiloso: true } }),
      eu.criarProjeto({ nome: "Meu", processo: { protocolo: OUTRO, sigiloso: true } }),
    ]);
    segurar = false;
    const k = await un.sigilosConhecidos();
    checar(
      "a memoria tem os dois numeros (uma gravacao nao apagou a outra)",
      k.processos.has("50300000777202610") && k.processos.has("50300000002202611"),
      [...k.processos],
    );
  }
}

/** O prefixo documentado da memória do sigilo do usuário (host|login), fora de todo escopo: uma chave por número. */
const PREFIXO_MEMORIA = "projetos/sigilo/sei.x.gov.br|ana/";

/** Rodada 2 da Tarefa 4: a memória local e monótona do sigilo, por usuário, que nunca é enviada. */
async function verificarMemoriaDoSigilo(): Promise<void> {
  const OUTRO = "50300.000002/2026-11";

  secao("memoria do sigilo: trocar o ultimo processo marcado nao solta o numero dos registros");
  {
    const areaW = areaMemoria();
    const { repo: rw } = novoRepo(ESCOPO_UN, areaW, "w", { agora: AGORA });
    const p1 = await rw.criarProjeto({ nome: "Fiscalização" });
    await rw.editarProjeto(p1.id, { processo: { protocolo: SIGILO } }); // digitado, sem marca: o registro leva o número
    await rw.editarProjeto(p1.id, { processo: { protocolo: SIGILO, sigiloso: true } }); // a caixa marcou
    await rw.editarProjeto(p1.id, { processo: { protocolo: OUTRO } }); // e o processo do projeto mudou
    const seiW = noSei(null);
    await motorDe(rw, areaW, seiW).sincronizar({ forcar: true });
    const jw = await jsonDoTexto(seiW.html);
    checar("o numero nao volta ao texto (o registro antigo vai raspado)", !!jw && !jw.includes("000777") && jw.includes("000002"), jw);
    checar(
      "e o historico daqui continua com o numero",
      (await rw.historico(p1.id)).some((r) => r.campo === "processo" && r.depois === SIGILO),
    );
  }

  secao("memoria do sigilo: o numero marcado em So eu nao vai ao texto da unidade");
  {
    const areaU = areaMemoria();
    const { repo: eu } = novoRepo(ESCOPO_EU, areaU, "u", { agora: AGORA });
    const { repo: un } = novoRepo(ESCOPO_UN, areaU, "v", { agora: AGORA + 100 });
    const pu = await un.criarProjeto({ nome: "Da unidade", processo: { protocolo: SIGILO } });
    const seiU = noSei(null);
    const motorU = motorDe(un, areaU, seiU);
    await motorU.sincronizar({ forcar: true });
    checar("premissa: sem saber do sigilo, o texto da unidade leva o numero", (await jsonDoTexto(seiU.html)).includes("000777"));
    await eu.criarProjeto({ nome: "Meu", processo: { protocolo: SIGILO, sigiloso: true } });
    await motorU.sincronizar({ forcar: true });
    checar("marcado em So eu, a rodada seguinte da unidade tira o numero do texto", !(await jsonDoTexto(seiU.html)).includes("000777"));
    const puDepois = await un.obterProjeto(pu.id);
    checar(
      "e o vinculo da unidade fica marcado aqui, com o numero e o mesmo carimbo",
      puDepois?.processo?.sigiloso === true && puDepois.processo.protocolo === SIGILO && puDepois.atualizadoEm === pu.atualizadoEm,
      puDepois,
    );
    const pu2 = await un.criarProjeto({ nome: "Outro da unidade", processo: { protocolo: "50300000777202610" } });
    checar(
      "digitado sem marca (e sem pontuacao) num projeto novo da unidade: ja nasce marcado",
      pu2.processo?.sigiloso !== true && (await un.obterProjeto(pu2.id))?.processo?.sigiloso === true,
    );
    await motorU.sincronizar({ forcar: true });
    const ju = await jsonDoTexto(seiU.html);
    checar("e o texto da unidade nao o leva", !!ju && !ju.includes("000777") && !ju.includes("777202610"), ju);
  }

  secao("memoria do sigilo: fica so neste computador (nada que vai a outra pessoa a leva)");
  {
    const areaM = areaMemoria();
    const { repo: rm } = novoRepo(ESCOPO_UN, areaM, "m", { agora: AGORA });
    await rm.criarProjeto({ nome: "Apuração", processo: { protocolo: SIGILO, sigiloso: true } });
    const seiM = noSei(null);
    await motorDe(rm, areaM, seiM).sincronizar({ forcar: true });
    const tudo = await areaM.obter(null);
    checar(
      "a memoria fica numa chave propria do usuario, fora de todo escopo (o arquivo e a exportacao leem o escopo)",
      Object.keys(tudo).some((k) => k.startsWith(PREFIXO_MEMORIA)) &&
        !PREFIXO_MEMORIA.startsWith(baseDoEscopo(ESCOPO_UN)) &&
        !PREFIXO_MEMORIA.startsWith(baseDoEscopo(ESCOPO_EU)),
      Object.keys(tudo),
    );
    const env = await rm.exportar(AGORA);
    const doTexto = paraOTexto(env, AGORA);
    const gravado = JSON.parse((await jsonDoTexto(seiM.html)) || "{}") as EnvelopeProjetos;
    const formas = [env, doTexto, gravado].map(
      (x) =>
        `${Object.keys(x).sort().join()}|${Object.keys(x.entidades ?? {})
          .sort()
          .join()}`,
    );
    checar(
      "o envelope do arquivo, o do texto e o texto gravado tem so os campos do envelope",
      formas.every((f) => f === "entidades,formato,gerado,host,unidade,versao,vis|e,f,h,m,p") &&
        !JSON.stringify([env, doTexto, gravado]).includes("projetos/sigilo"),
      formas,
    );
    const daSincronia = Object.entries(tudo).filter(([k]) => k.startsWith("projetos/sync/"));
    checar(
      "e o que a sincronia anota na area (status, relatorio) nao leva o numero",
      daSincronia.length > 0 && daSincronia.every(([, v]) => !JSON.stringify(v).match(/000777|50300000777202610/)),
      daSincronia.map(([k]) => k),
    );
  }

  secao("memoria do sigilo: a forma guardada (uma chave por numero, com a origem)");
  {
    checar(
      "o prefixo documentado: projetos/sigilo/<host>|<login em minusculas>/",
      prefixoMemoriaSigilo("sei.x.gov.br", " Ana ") === PREFIXO_MEMORIA,
    );
    const m = lerMemoria(
      {
        [`${PREFIXO_MEMORIA}p/123`]: "local",
        [`${PREFIXO_MEMORIA}p/456`]: "aprendida",
        [`${PREFIXO_MEMORIA}d/789`]: 42,
        [`${PREFIXO_MEMORIA}p/`]: "local",
        "projetos/sigilo/sei.x.gov.br|ana": { processos: ["555"], documentos: [] },
      },
      PREFIXO_MEMORIA,
    );
    checar(
      "a origem de cada numero; valor torto fica como local (o numero esta na chave: nada se perde); a chave unica antiga nao e lida",
      m.processos.get("123") === "local" &&
        m.processos.get("456") === "aprendida" &&
        m.documentos.get("789") === "local" &&
        !m.processos.has("555") &&
        m.processos.size === 2,
      [...m.processos, ...m.documentos],
    );
    checar(
      "somar o que ja esta: nada a gravar",
      Object.keys(entradasParaGravar(m, { processos: ["123", "456"], documentos: [] }, "aprendida", PREFIXO_MEMORIA)).length === 0,
    );
  }

  secao("memoria do sigilo: nada e despejado; as aprendidas tem teto de 20000");
  {
    const areaT = areaMemoria();
    const { repo: rt } = novoRepo(ESCOPO_UN, areaT, "z", { agora: AGORA });
    // A local antiga: o número sigiloso de verdade, marcado aqui, que um colega tentaria empurrar para fora.
    await rt.lembrarSigilo({ processos: ["50300000777202610"], documentos: [] }, "local");
    await rt.lembrarSigilo(
      { processos: Array.from({ length: TETO_APRENDIDAS }, (_, i) => `9${String(i).padStart(10, "0")}`), documentos: [] },
      "aprendida",
    );
    await rt.lembrarSigilo({ processos: ["88888888888"], documentos: [] }, "aprendida");
    const k = await rt.sigilosConhecidos();
    const doPrefixo = Object.entries(await areaT.obter(null)).filter(([c]) => c.startsWith(`${PREFIXO_MEMORIA}p/`));
    checar(
      "20000 aprendidas: a local antiga continua la, e a 20001a aprendida nao entra",
      TETO_APRENDIDAS === 20000 &&
        k.processos.has("50300000777202610") &&
        !k.processos.has("88888888888") &&
        doPrefixo.filter(([, v]) => v === "aprendida").length === 20000 &&
        doPrefixo.filter(([, v]) => v === "local").length === 1,
      doPrefixo.length,
    );
    await rt.lembrarSigilo({ processos: ["70000000001"], documentos: [] }, "local");
    checar(
      "as locais nao tem teto: uma local nova entra mesmo com as aprendidas cheias",
      (await rt.sigilosConhecidos()).processos.has("70000000001"),
    );
    const p = await rt.criarProjeto({ nome: "Da unidade", processo: { protocolo: SIGILO } });
    const seiT = noSei(null);
    await motorDe(rt, areaT, seiT).sincronizar({ forcar: true });
    checar(
      "e o numero da local continua raspado (digitado sem marca, nao vai ao texto)",
      seiT.gravadas === 1 &&
        !(await jsonDoTexto(seiT.html)).includes("000777") &&
        (await rt.obterProjeto(p.id))?.processo?.sigiloso === true,
    );
    const aprendida = `${PREFIXO_MEMORIA}p/90000000000`;
    checar("premissa: este numero e uma aprendida", (await areaT.obter(aprendida))[aprendida] === "aprendida");
    await rt.criarProjeto({ nome: "Visto aqui", processo: { protocolo: "9.0000000000", sigiloso: true } });
    checar("a aprendida vista aqui (a caixa a marcou num vinculo) vira local", (await areaT.obter(aprendida))[aprendida] === "local");
  }

  secao("memoria do sigilo: a propria copia que volta nao regrava (nem a memoria)");
  {
    const base = areaMemoria();
    const escritas: string[] = [];
    const espiao: Area = {
      ...base,
      gravar: async (i: Record<string, unknown>) => {
        escritas.push(...Object.keys(i));
        return base.gravar(i);
      },
      aoMudar: base.aoMudar.bind(base),
    };
    const { repo: ri } = novoRepo(ESCOPO_UN, espiao, "i", { agora: AGORA });
    const pi = await ri.criarProjeto({ nome: "Apuração", processo: { protocolo: SIGILO, sigiloso: true } });
    const ei = await ri.criarEtapa({ projeto: pi.id, nome: "Oitiva", inicio: "2026-10-06", fim: "2026-10-09" });
    await ri.concluirEtapa(ei.id, "2026-10-09", { numero: "1234567" });
    const seiI = noSei(null);
    await motorDe(ri, espiao, seiI).sincronizar({ forcar: true });
    checar(
      "premissa: a memoria foi gravada",
      escritas.some((k) => k.startsWith(PREFIXO_MEMORIA)),
      escritas,
    );
    escritas.length = 0;
    await motorDe(ri, espiao, seiI).sincronizar({ forcar: true });
    checar(
      "na rodada seguinte: nada do escopo nem a memoria regravados, e o texto tambem nao",
      seiI.gravadas === 1 && escritas.every((k) => k.startsWith("projetos/sync/")),
      { gravadas: seiI.gravadas, escritas },
    );
  }
}

/** Os Minors da rodada 1 da Tarefa 4: relógio atrasado, marcação no parágrafo legível e o teto na mensagem. */
async function verificarMenoresRodada1(): Promise<void> {
  secao("relogio atrasado: os itens do colega, no futuro daqui, ficam no texto");
  {
    const areaF = areaMemoria();
    const relF = { agora: AGORA - 2 * DIA };
    const { repo: rf } = novoRepo(ESCOPO_UN, areaF, "f", relF);
    const doColegaF = envelope({
      entidades: {
        p: [projeto({ id: "colega", nome: "Do colega", atualizadoEm: AGORA, dispositivo: "dev-b" })],
        f: [],
        e: [etapa({ id: "colega-e", projeto: "colega", atualizadoEm: AGORA, dispositivo: "dev-b" })],
        h: [registro({ id: "colega-h", alvo: "colega", projeto: "colega", campo: "criacao", depois: "Do colega", dispositivo: "dev-b" })],
        m: [],
      },
    });
    const seiF = noSei(await gerarConteudoTexto("Dados", doColegaF));
    const motorF = motorDe(rf, areaF, seiF, {}, () => relF.agora);
    const sF1 = await motorF.sincronizar({ forcar: true });
    checar(
      "nada daqui a gravar: o texto do colega fica como estava (nao e regravado sem os itens dele)",
      seiF.gravadas === 0 && sF1.estado === "ok",
      { gravadas: seiF.gravadas, sF1 },
    );
    const pf = await rf.criarProjeto({ nome: "Daqui" });
    await motorF.sincronizar({ forcar: true });
    const tF = JSON.parse((await jsonDoTexto(seiF.html)) || "null") as EnvelopeProjetos | null;
    checar(
      "com algo daqui a gravar: o texto leva os itens do colega como estavam, mais o daqui",
      seiF.gravadas === 1 &&
        !!tF &&
        tF.entidades.p.some((x) => x.id === "colega" && x.atualizadoEm === AGORA && x.nome === "Do colega") &&
        tF.entidades.e.some((x) => x.id === "colega-e") &&
        tF.entidades.h.some((r) => r.id === "colega-h") &&
        tF.entidades.p.some((x) => x.id === pf.id),
      tF?.entidades.p.map((x) => x.id),
    );
    await motorF.sincronizar({ forcar: true });
    checar("e a rodada seguinte nao regrava", seiF.gravadas === 1, seiF.gravadas);
    const relF2 = (await areaF.obter(chaveRelatorio(ESCOPO_UN)))[chaveRelatorio(ESCOPO_UN)] as RelatorioImportacao | undefined;
    checar("o aviso do relogio continua (os itens contados no relatorio)", relF2?.futuros === 3, relF2);
    checar("e eles nao entraram aqui", !(await rf.obterProjeto("colega")));
  }

  secao("paragrafo legivel: marcacao na sigla ou no nome nao quebra o texto");
  {
    checar(
      "sem < nem > no paragrafo",
      !/[<>]/.test(legivelProjetos("unidade", "SE</p><p>PRO", "Ana")) && !/[<>]/.test(legivelProjetos("eu", "SEPRO", "<b>Ana</b>")),
    );
    const areaL = areaMemoria();
    const { repo: rl } = novoRepo(ESCOPO_UN, areaL, "l", { agora: AGORA });
    await rl.criarProjeto({ nome: "Plano" });
    const legivel = adaptadorProjetos({ repo: rl, area: areaL, sigla: "SE</p><p>PRO", nomeUsuario: "Ana" }).legivel;
    const seiL = noSei(null);
    await motorDe(rl, areaL, seiL, { legivel }).sincronizar({ forcar: true });
    const lidoL = await lerConteudoTexto(seiL.html ?? "");
    checar('o texto gravado com a sigla "SE</p><p>PRO" continua valido', "bruto" in lidoL, lidoL);
    const sL = await motorDe(rl, areaL, seiL, { legivel }).sincronizar({ forcar: true });
    checar(
      "e a segunda rodada nao regrava (nem guarda o texto como invalido)",
      seiL.gravadas === 1 && !sL.mensagem && !(await areaL.obter(chaveSubstituido(ESCOPO_UN)))[chaveSubstituido(ESCOPO_UN)],
      { gravadas: seiL.gravadas, sL },
    );
  }

  secao("mensagem de perto do teto: o teto vem de TETO_TEXTO");
  {
    const { repo: rm } = novoRepo(ESCOPO_UN, areaMemoria(), "k", { agora: AGORA });
    const perto = adaptadorProjetos({ repo: rm, area: areaMemoria(), sigla: "SEPRO", nomeUsuario: "Ana" }).mensagens?.pertoDoTeto?.(81);
    checar("perto do teto: (81 KB de <teto> KB)", perto?.includes(`(81 KB de ${TETO_TEXTO / 1024} KB)`) === true, perto);
  }
}

/** Decisão da rodada 1 da Tarefa 4: a marca de sigilo do vínculo e do documento fica gravada aqui, sem mudar o carimbo. */
async function verificarSigiloGruda(): Promise<void> {
  const OUTRO = "50300.000002/2026-11";

  secao("o sigilo gruda: a marca vai para o vinculo e o documento daqui, sem mudar o carimbo");
  {
    const areaN = areaMemoria();
    const { repo: rn } = novoRepo(ESCOPO_UN, areaN, "n", { agora: AGORA });
    const pa = await rn.criarProjeto({ nome: "Acompanhamento", processo: { protocolo: SIGILO } });
    const ea = await rn.criarEtapa({
      projeto: pa.id,
      nome: "Termo",
      inicio: "2026-10-06",
      fim: "2026-10-09",
      documento: { numero: "222" },
    });
    const antesP = await rn.obterProjeto(pa.id);
    const antesE = await rn.obterEtapa(ea.id);
    // A caixa marcou o mesmo número como sigiloso noutro projeto.
    await rn.criarProjeto({ nome: "Apuração", processo: { protocolo: SIGILO, sigiloso: true } });
    const depoisP = await rn.obterProjeto(pa.id);
    const depoisE = await rn.obterEtapa(ea.id);
    checar(
      "o vinculo do outro projeto com o mesmo numero fica marcado aqui, com o numero e o mesmo carimbo",
      depoisP?.processo?.sigiloso === true &&
        depoisP.processo.protocolo === SIGILO &&
        depoisP.atualizadoEm === antesP?.atualizadoEm &&
        depoisP.dispositivo === antesP.dispositivo &&
        depoisP.alteradoPor === antesP.alteradoPor,
      { antesP, depoisP },
    );
    checar(
      "o documento da etapa (agora sigilosa pelo projeto) fica marcado, com o mesmo carimbo",
      depoisE?.documento?.sigiloso === true && depoisE.documento.numero === "222" && depoisE.atualizadoEm === antesE?.atualizadoEm,
      { antesE, depoisE },
    );
    let av = 0;
    const parar = rn.aoMudar(() => av++);
    const r1 = await rn.importar(paraOTexto(await rn.exportar(AGORA), AGORA).entidades);
    const r2 = await rn.importar(await rn.entidades());
    checar(
      "idempotente: a propria copia que volta do texto e o proprio estado nao regravam (nenhum aviso)",
      r1.novos + r1.atualizados + r2.novos + r2.atualizados === 0 && av === 0,
      { r1, r2, av },
    );
    parar();
    await rn.editarEtapa(ea.id, { nome: "Termo de oitiva" }, "2026-10-06");
    checar("editar a etapa nao tira a marca do documento", (await rn.obterEtapa(ea.id))?.documento?.sigiloso === true);
  }

  secao("o sigilo gruda: trocar o processo do projeto sigiloso nao solta o numero nem o documento");
  {
    const areaT = areaMemoria();
    const { repo: rt } = novoRepo(ESCOPO_UN, areaT, "t", { agora: AGORA });
    const p1 = await rt.criarProjeto({ nome: "Apuração", processo: { protocolo: SIGILO, sigiloso: true } });
    const e1 = await rt.criarEtapa({ projeto: p1.id, nome: "Oitiva", inicio: "2026-10-06", fim: "2026-10-09" });
    await rt.concluirEtapa(e1.id, "2026-10-09", { numero: "1234567" });
    const p2 = await rt.criarProjeto({ nome: "Acompanhamento" });
    const e2 = await rt.criarEtapa({ projeto: p2.id, nome: "Ofício", inicio: "2026-10-06", fim: "2026-10-09" });
    await rt.editarEtapa(e2.id, { processo: { protocolo: SIGILO } }, "2026-10-06");
    const seiT = noSei(null);
    const motorT = motorDe(rt, areaT, seiT);
    await motorT.sincronizar({ forcar: true });
    await rt.editarProjeto(p1.id, { processo: { protocolo: OUTRO } });
    await motorT.sincronizar({ forcar: true });
    const jsonT = await jsonDoTexto(seiT.html);
    checar(
      "depois da troca, nem o numero (vinculo da outra etapa, registros) nem o documento vao ao texto",
      !!jsonT && !jsonT.includes("000777") && !jsonT.includes("1234567") && jsonT.includes("000002"),
      jsonT,
    );
    checar(
      "e aqui o numero e o documento continuam",
      (await rt.obterEtapa(e2.id))?.processo?.protocolo === SIGILO && (await rt.obterEtapa(e1.id))?.documento?.numero === "1234567",
    );
  }

  secao("o sigilo gruda: a poda local nao solta o numero dos registros");
  {
    const areaP = areaMemoria();
    const rel = { agora: AGORA };
    const { repo: rp } = novoRepo(ESCOPO_UN, areaP, "z", rel);
    const pz = await rp.criarProjeto({ nome: "Antigo" });
    // Ligado antes de se saber do sigilo (o registro leva o número); depois a caixa marcou.
    await rp.editarProjeto(pz.id, { processo: { protocolo: SIGILO } });
    await rp.editarProjeto(pz.id, { processo: { protocolo: SIGILO, sigiloso: true } });
    const ez = await rp.criarEtapa({ projeto: pz.id, nome: "Oitiva", inicio: "2026-10-06", fim: "2026-10-09" });
    await rp.concluirEtapa(ez.id, "2026-10-09", { numero: "1234567" });
    await rp.criarProjeto({ nome: "Vivo" });
    await rp.removerProjeto(pz.id);
    rel.agora += 181 * DIA;
    const seiP = noSei(null);
    const motorP = motorDe(rp, areaP, seiP, {}, () => rel.agora);
    await motorP.sincronizar({ forcar: true });
    const j1 = await jsonDoTexto(seiP.html);
    const p1Texto = j1 ? (JSON.parse(j1) as EnvelopeProjetos).entidades.p : [];
    checar(
      "premissa: com a lapide ainda aqui, o texto sai sem ela e sem os numeros",
      p1Texto.length === 1 && !p1Texto.some((x) => x.id === pz.id) && !j1.includes("000777") && !j1.includes("1234567"),
      j1,
    );
    const g1 = seiP.gravadas;
    await rp.limpar(rel.agora);
    const local = await rp.entidades();
    checar("a poda local apagou as lapides", !local.p.some((x) => x.id === pz.id) && !local.e.some((x) => x.id === ez.id));
    const regs = local.h.filter((r) => r.projeto === pz.id);
    // Rodada 2: a memória do sigilo guarda o número e o documento marcados antes da poda. Desde os residuais da
    // revisão final (N1), o `limpar` também tira os registros do projeto podado (órfãos, que o texto não leva):
    // o que garante o sigilo é a memória, que segue raspando se esses números voltarem a aparecer.
    const memP = lerMemoria(await areaP.obter(null), prefixoMemoriaSigilo(ESCOPO_UN.host, ESCOPO_UN.login));
    checar(
      "a poda tira os registros do projeto podado, e a memoria do sigilo guarda o numero e o documento",
      regs.length === 0 && memP.processos.has("50300000777202610") && memP.documentos.has("1234567"),
      { regs: regs.length, p: [...memP.processos.keys()], d: [...memP.documentos.keys()] },
    );
    await motorP.sincronizar({ forcar: true });
    const j2 = await jsonDoTexto(seiP.html);
    checar(
      "sem a lapide, os registros continuam sem o numero no texto e a rodada seguinte nao regrava",
      !j2.includes("000777") && !j2.includes("1234567") && seiP.gravadas === g1,
      { gravadas: seiP.gravadas, g1 },
    );
  }

  secao("o sigilo gruda: a poda raspa o numero antigo de documento que nem a memoria conhece");
  {
    const areaQ = areaMemoria();
    const rel = { agora: AGORA };
    const { repo: rq } = novoRepo(ESCOPO_UN, areaQ, "q", rel);
    const pq = await rq.criarProjeto({ nome: "Antigo" });
    const eq = await rq.criarEtapa({ projeto: pq.id, nome: "Ofício", inicio: "2026-10-06", fim: "2026-10-09" });
    // Os documentos da etapa antes de se saber do sigilo: o 7777001 só fica nos registros.
    await rq.editarEtapa(eq.id, { documento: { numero: "7777001" } }, "2026-10-06");
    await rq.editarEtapa(eq.id, { documento: { numero: "7777002" } }, "2026-10-06");
    await rq.editarProjeto(pq.id, { processo: { protocolo: SIGILO, sigiloso: true } });
    await rq.criarProjeto({ nome: "Vivo" });
    await rq.removerProjeto(pq.id);
    rel.agora += 181 * DIA;
    await rq.limpar(rel.agora);
    const hq = (await rq.entidades()).h.filter((r) => r.projeto === pq.id);
    // Rodada 3: o que o envelope rasparia (inclusive o número antigo, pela etapa sigilosa) já está na memória antes
    // da poda. Desde os residuais da revisão final (N1), os registros do projeto podado saem com ele (órfãos).
    const memQ = lerMemoria(await areaQ.obter(null), prefixoMemoriaSigilo(ESCOPO_UN.host, ESCOPO_UN.login));
    checar(
      "a poda tira os registros do projeto podado; a memoria ja tinha os dois numeros antes da poda",
      hq.length === 0 && memQ.documentos.has("7777001") && memQ.documentos.has("7777002"),
      { hq: hq.length, d: [...memQ.documentos.keys()] },
    );
    const seiQ = noSei(null);
    await motorDe(rq, areaQ, seiQ, {}, () => rel.agora).sincronizar({ forcar: true });
    const jq = await jsonDoTexto(seiQ.html);
    checar("e o texto nao leva nenhum dos dois", !!jq && !jq.includes("7777001") && !jq.includes("7777002"), jq);
  }
}
