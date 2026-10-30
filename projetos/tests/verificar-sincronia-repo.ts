/**
 * O que a sincronia pede ao repositório (P4): a importação não regrava o que
 * ficaria igual (senão cada rodada ouviria a própria gravação e leria de novo,
 * sem fim), o documento de etapa sigilosa que chega como o marcador (sem o número)
 * fica com o número daqui, a linha de base
 * segue a regra da etapa e o modelo não passa de 2100.
 */

import { areaMemoria } from "@comum/armazenamento/area";
import { LIMITE_DIAS_ETAPA } from "../src/modelo/calendario";
import { sigiloDoEnvelope } from "../src/modelo/sigilo";
import type { DocumentoSei, Entidades, Etapa, Projeto, Registro, Vinculo } from "../src/modelo/tipos";
import { chaveProtocolo } from "../src/modelo/vinculos";
import { MODELOS_EMBUTIDOS } from "../src/modelos/embutidos";
import { entidadeValida, manterDocumentoSigiloso, moverEntreEscopos } from "../src/repositorio";
import { ESCOPO_EU, ESCOPO_UN, novoRepo, RELOGIO_INICIAL } from "./apoioRepositorio";
import { etapa, projeto } from "./fabrica";
import { checar, lanca, secao } from "./util";

/** O que o Texto Padrão leva de um vínculo sigiloso: nada do número. */
const semNumero = <T extends { processo?: { protocolo: string; sigiloso?: boolean } }>(x: T): T =>
  x.processo?.sigiloso ? { ...x, processo: { protocolo: "", sigiloso: true } } : x;

/** O que o Texto Padrão leva do documento de processo sigiloso (rodada 4 da Tarefa 4): o marcador, sem o número. */
const MARCADOR: DocumentoSei = { numero: "", sigiloso: true };
const comMarcador = (x: Etapa): Etapa => (x.documento ? { ...x, documento: MARCADOR } : x);

/**
 * O corte que o envelope da Tarefa 4 faz (decisão 10): um número marcado sigiloso em qualquer projeto ou
 * etapa é sigiloso em todos; o vínculo vai vazio, o documento da etapa sigilosa vai como o marcador (sem o
 * número; rodada 4) e os registros antigos com o número vão com o texto fixo. Mesmos carimbos.
 */
function comoOTexto(ent: Entidades): Entidades {
  const chaves = new Set<string>();
  for (const x of [...ent.p, ...ent.e]) if (x.processo?.sigiloso && x.processo.protocolo) chaves.add(chaveProtocolo(x.processo.protocolo));
  const sigiloso = (v: Vinculo | undefined): boolean => !!v && (v.sigiloso === true || chaves.has(chaveProtocolo(v.protocolo)));
  const vazio: Vinculo = { protocolo: "", sigiloso: true };
  const projetos = new Set(ent.p.filter((x) => sigiloso(x.processo)).map((x) => x.id));
  const etapaSigilosa = (x: Etapa): boolean => (x.processo ? sigiloso(x.processo) : projetos.has(x.projeto));
  const etapas = new Set(ent.e.filter(etapaSigilosa).map((x) => x.id));
  const doProcesso = (t: string | undefined) => (t !== undefined && chaves.has(chaveProtocolo(t)) ? "processo sigiloso" : t);
  return {
    ...ent,
    p: ent.p.map((x) => (sigiloso(x.processo) ? { ...x, processo: vazio } : x)),
    e: ent.e.map((x) => {
      const y = sigiloso(x.processo) ? { ...x, processo: vazio } : x;
      return etapaSigilosa(x) ? comMarcador(y) : y;
    }),
    h: ent.h.map((r): Registro => {
      if (r.campo === "processo") return { ...r, antes: doProcesso(r.antes), depois: doProcesso(r.depois) };
      if (r.campo === "documento" && etapas.has(r.alvo))
        return {
          ...r,
          antes: r.antes ? "documento de processo sigiloso" : undefined,
          depois: r.depois ? "documento de processo sigiloso" : undefined,
        };
      return r;
    }),
  };
}

export async function verificarSincroniaRepo(): Promise<void> {
  secao("sincronia no repositorio: a importacao nao regrava o que ficaria igual");
  const area = areaMemoria();
  const { repo } = novoRepo(ESCOPO_UN, area, "s");
  const p = await repo.criarProjeto({ nome: "Sindicância", processo: { protocolo: "50300.000777/2026-10", sigiloso: true } });
  const e = await repo.criarEtapa({
    projeto: p.id,
    nome: "Oitiva",
    inicio: "2026-10-06",
    fim: "2026-10-09",
    documento: { numero: "1234567", titulo: "Termo" },
  });
  const ent = await repo.entidades();
  let avisos = 0;
  const parar = repo.aoMudar(() => avisos++);
  // A cópia que foi ao Texto Padrão: mesmos carimbos, sem o número do processo e com o marcador no documento.
  const doTexto = { ...ent, p: ent.p.map(semNumero), e: ent.e.map(comMarcador) };
  const r1 = await repo.importar(doTexto);
  checar(
    "a propria copia do Texto Padrao volta: nada gravado e nenhum aviso (sem laco de rodadas)",
    r1.novos === 0 && r1.atualizados === 0 && avisos === 0,
    { r1, avisos },
  );
  const local = await repo.obterEtapa(e.id);
  checar(
    "o numero do processo e o documento continuam aqui",
    (await repo.obterProjeto(p.id))?.processo?.protocolo === "50300.000777/2026-10" && local?.documento?.numero === "1234567",
    local,
  );
  const r2 = await repo.importar(await repo.entidades());
  checar("importar o proprio estado: nada gravado", r2.novos === 0 && r2.atualizados === 0 && avisos === 0);
  parar();

  secao("sincronia no repositorio: documento de etapa sigilosa que chega sem numero");
  const colega = {
    ...(local as Etapa),
    nome: "Oitiva das testemunhas",
    atualizadoEm: (local as Etapa).atualizadoEm + 50,
    dispositivo: "dev-b",
  };
  // O colega só tem o marcador (o texto não levou o número): ele vai junto, e o número daqui fica.
  colega.documento = MARCADOR;
  await repo.importar({ e: [colega] });
  const depois = await repo.obterEtapa(e.id);
  checar(
    "o colega mudou o nome (projeto sigiloso): o nome vem, o documento daqui fica",
    depois?.nome === "Oitiva das testemunhas" && depois.documento?.numero === "1234567",
    depois,
  );
  {
    // Só parte mudou: a cópia de A (com o marcador, mesmo carimbo) vence o desempate e volta igual; B mudou de verdade.
    const base = areaMemoria();
    const gravacoes: string[][] = [];
    const espiao = {
      ...base,
      gravar: async (i: Record<string, unknown>) => {
        gravacoes.push(Object.keys(i));
        return base.gravar(i);
      },
      aoMudar: base.aoMudar.bind(base),
    } as typeof base;
    const { repo: r5 } = novoRepo(ESCOPO_UN, espiao, "q");
    const p5 = await r5.criarProjeto({ nome: "Apuração", processo: { protocolo: "50300.000888/2026-10", sigiloso: true } });
    const a = await r5.criarEtapa({ projeto: p5.id, nome: "A", inicio: "2026-10-06", fim: "2026-10-09", documento: { numero: "111" } });
    const b = await r5.criarEtapa({ projeto: p5.id, nome: "B", inicio: "2026-10-06", fim: "2026-10-09" });
    const ent5 = await r5.entidades();
    gravacoes.length = 0;
    let avisos5 = 0;
    const parar5 = r5.aoMudar(() => avisos5++);
    const copiaA = comMarcador(a);
    const bColega: Etapa = { ...b, nome: "B revisada", atualizadoEm: b.atualizadoEm + 50, dispositivo: "dev-b" };
    const r5r = await r5.importar({ p: ent5.p.map(semNumero), e: [copiaA, bColega], h: ent5.h });
    checar(
      "so parte mudou: grava so ela, numa gravacao, e avisa uma vez",
      r5r.novos === 0 &&
        r5r.atualizados === 1 &&
        avisos5 === 1 &&
        gravacoes.length === 1 &&
        gravacoes[0]?.join() === r5.etapas.chave(b.id) &&
        (await r5.obterEtapa(a.id))?.documento?.numero === "111",
      { r5r, avisos5, gravacoes },
    );
    parar5();
  }
  const comum = etapa({ id: "x1", projeto: "p9", documento: { numero: "999" }, atualizadoEm: 10 });
  const semDoc = etapa({ id: "x1", projeto: "p9", atualizadoEm: 20 });
  checar("etapa comum: o colega tirou o documento e ele sai", manterDocumentoSigiloso(semDoc, comum).documento === undefined);
  const propria = etapa({ id: "x2", processo: { protocolo: "", sigiloso: true }, documento: MARCADOR, atualizadoEm: 20 });
  const propriaLocal = etapa({ id: "x2", processo: { protocolo: "50300.1/2026-1", sigiloso: true }, documento: { numero: "55" } });
  checar(
    "processo proprio sigiloso, o documento chega como o marcador: o documento daqui fica",
    manterDocumentoSigiloso(propria, propriaLocal).documento?.numero === "55",
  );
  const propriaComum = etapa({ id: "x3", processo: { protocolo: "50300.2/2026-1" }, atualizadoEm: 20 });
  checar(
    "processo proprio NAO sigiloso num projeto sigiloso: vale o que chegou",
    manterDocumentoSigiloso(propriaComum, etapa({ id: "x3", documento: { numero: "66" } })).documento === undefined,
  );

  secao("sincronia no repositorio: linha de base com a regra da etapa");
  const torta = etapa({ id: "t1", inicio: "2026-10-10", fim: "2026-10-08", base: { inicio: "2026-10-10", fim: "2026-10-08" } });
  checar("etapa torta com a base torta (arraste do planejamento) e aceita", entidadeValida(torta, "e"));
  checar(
    "base de mais de ~10 anos continua recusada",
    !entidadeValida(etapa({ id: "t2", base: { inicio: "2000-01-01", fim: "2015-01-01" } }), "e") && LIMITE_DIAS_ETAPA < 5000,
  );
  const { repo: r3 } = novoRepo(ESCOPO_UN, areaMemoria(), "t");
  const pt: Projeto = projeto({ id: "pt" });
  const rt = await r3.importar({ p: [pt], e: [{ ...torta, projeto: "pt" }] });
  checar("e a importacao a aceita (os outros computadores tambem)", rt.novos === 2 && rt.ignorados === 0, rt);

  secao("sincronia no repositorio: processo e documento so com forma de numero (dado de colega)");
  const comProcesso = (processo: unknown) => projeto({ id: "pp", processo: processo as Projeto["processo"] });
  checar(
    "numero de processo comum e aceito",
    entidadeValida(comProcesso({ protocolo: "50300.000777/2026-10", idProcedimento: "77" }), "p"),
  );
  checar("vinculo sigiloso vazio (o do texto) e aceito", entidadeValida(comProcesso({ protocolo: "", sigiloso: true }), "p"));
  checar("protocolo com marcacao e recusado", !entidadeValida(comProcesso({ protocolo: "<img src=x onerror=alert(1)>" }), "p"));
  checar("protocolo de 41 caracteres e recusado", !entidadeValida(comProcesso({ protocolo: "1".repeat(41) }), "p"));
  checar("idProcedimento que nao e numero e recusado", !entidadeValida(comProcesso({ protocolo: "123", idProcedimento: "abc" }), "p"));
  checar(
    "documento com numero de 41 caracteres e recusado; titulo longo tambem",
    !entidadeValida(etapa({ id: "d1", documento: { numero: "1".repeat(41) } }), "e") &&
      !entidadeValida(etapa({ id: "d2", documento: { numero: "1", titulo: "t".repeat(201) } }), "e"),
  );

  secao("sincronia no repositorio: modelo nao passa de 2100");
  const modelo = MODELOS_EMBUTIDOS[0]!;
  const { repo: r4 } = novoRepo(ESCOPO_UN, areaMemoria(), "m");
  const fora = await lanca(() => r4.criarProjetoDeModelo({ nome: "Fora" }, modelo, "2101-01-03"));
  checar("comeco depois de 2100: recusado", /2000 e 2100/.test(String((fora as { mensagens?: string[] })?.mensagens)), fora);
  const passa = await lanca(() => r4.criarProjetoDeModelo({ nome: "Quase" }, modelo, "2100-12-20"));
  checar(
    "comeco em 20/12/2100 empurra etapas para 2101: recusado",
    /passaria de 2100/.test(String((passa as { mensagens?: string[] })?.mensagens)),
    passa,
  );
  checar("nada gravado", (await r4.dados()).projetos.length === 0);
  const ok = await r4.criarProjetoDeModelo({ nome: "Dentro" }, modelo, "2026-10-06");
  checar("comeco normal: cria", !!ok.id && (await r4.dados()).etapas.length === modelo.etapas.length);
  secao("sincronia no repositorio: sigilo pela regra do envelope (o numero marcado sigiloso noutro projeto)");
  const X = "50300.000777/2026-10";
  for (const caso of ["propria copia", "colega renomeia as etapas", "so as etapas do colega chegam"]) {
    const { repo: rx } = novoRepo(ESCOPO_UN, areaMemoria(), "x");
    const p1 = await rx.criarProjeto({ nome: "P1 (X sem marca)", processo: { protocolo: X } });
    await rx.criarProjeto({ nome: "P2 (X sigiloso)", processo: { protocolo: X, sigiloso: true } });
    const e1 = await rx.criarEtapa({
      projeto: p1.id,
      nome: "E1",
      inicio: "2026-10-06",
      fim: "2026-10-09",
      documento: { numero: "1234567" },
    });
    const e2 = await rx.criarEtapa({
      projeto: p1.id,
      nome: "E2",
      inicio: "2026-10-06",
      fim: "2026-10-09",
      processo: { protocolo: X },
      documento: { numero: "7654321" },
    });
    const texto = comoOTexto(await rx.entidades());
    const colega = caso !== "propria copia";
    if (colega)
      texto.e = texto.e.map((x) => ({ ...x, nome: `${x.nome} renomeada`, atualizadoEm: x.atualizadoEm + 50, dispositivo: "dev-b" }));
    checar(
      `${caso}: o texto nao leva os documentos, so o marcador (premissa)`,
      texto.e.every((x) => x.documento === MARCADOR) && texto.p.every((x) => x.processo?.protocolo === ""),
    );
    let av = 0;
    const pararX = rx.aoMudar(() => av++);
    // Sem os projetos, só a regra do envelope (X marcado em P2, aqui) diz que E1 é sigilosa.
    const rr = await rx.importar(caso.startsWith("so as etapas") ? { e: texto.e } : texto);
    const [d1, d2, pp] = [await rx.obterEtapa(e1.id), await rx.obterEtapa(e2.id), await rx.obterProjeto(p1.id)];
    checar(
      `${caso}: os documentos daqui ficam (a etapa herdada e a com o processo proprio)`,
      d1?.documento?.numero === "1234567" && d2?.documento?.numero === "7654321" && d2?.processo?.protocolo === X,
      { d1, d2 },
    );
    checar(
      colega ? `${caso}: o nome vem, numa gravacao e um aviso` : `${caso}: nada gravado e nenhum aviso`,
      colega
        ? d1?.nome === "E1 renomeada" && d2?.nome === "E2 renomeada" && rr.atualizados === 2 && av === 1
        : // O sigilo gruda (rodada 1 da Tarefa 4): o P1 ficou marcado aqui quando o P2 marcou o mesmo número.
          rr.novos === 0 && rr.atualizados === 0 && av === 0 && pp?.processo?.protocolo === X && pp.processo.sigiloso === true,
      { rr, av, pp: pp?.processo },
    );
    pararX();
  }
  {
    // Só o colega sabe do sigilo: aqui X não está marcado em lugar nenhum, mas o projeto chega marcado (vazio).
    const { repo: ry } = novoRepo(ESCOPO_UN, areaMemoria(), "y");
    const p1 = await ry.criarProjeto({ nome: "P1", processo: { protocolo: X } });
    const e1 = await ry.criarEtapa({
      projeto: p1.id,
      nome: "E1",
      inicio: "2026-10-06",
      fim: "2026-10-09",
      documento: { numero: "1234567" },
    });
    const ent = await ry.entidades();
    const semDocumento = comMarcador(ent.e[0] as Etapa);
    await ry.importar({
      p: ent.p.map((x) => ({ ...x, processo: { protocolo: "", sigiloso: true } })),
      e: [{ ...semDocumento, nome: "E1 renomeada", atualizadoEm: semDocumento.atualizadoEm + 50, dispositivo: "dev-b" }],
    });
    const d1 = await ry.obterEtapa(e1.id);
    checar(
      "so o colega sabe do sigilo: o projeto chega marcado e o documento daqui fica",
      d1?.nome === "E1 renomeada" && d1.documento?.numero === "1234567",
      d1,
    );
  }

  secao("sincronia no repositorio: registro do historico com o mesmo carimbo fica o daqui");
  {
    const { repo: rh } = novoRepo(ESCOPO_UN, areaMemoria(), "h");
    const p1 = await rh.criarProjeto({ nome: "P1" });
    await rh.editarProjeto(p1.id, { processo: { protocolo: X } });
    const p2 = await rh.criarProjeto({ nome: "P2", processo: { protocolo: X, sigiloso: true } });
    const e = await rh.criarEtapa({ projeto: p2.id, nome: "Oitiva", inicio: "2026-10-06", fim: "2026-10-09" });
    await rh.concluirEtapa(e.id, "2026-10-09", { numero: "1234567" });
    const ent = await rh.entidades();
    const regProc = ent.h.find((r) => r.campo === "processo" && r.depois === X);
    const regDoc = ent.h.find((r) => r.campo === "documento" && r.depois === "1234567");
    const texto = comoOTexto(ent);
    checar(
      "premissa: o texto leva os registros sem os numeros",
      !!regProc &&
        !!regDoc &&
        texto.h.find((r) => r.id === regProc.id)?.depois === "processo sigiloso" &&
        texto.h.find((r) => r.id === regDoc.id)?.depois === "documento de processo sigiloso",
    );
    let av = 0;
    const pararH = rh.aoMudar(() => av++);
    const rr = await rh.importar(texto);
    const h = await rh.entidades();
    checar(
      "a propria copia volta: nada gravado, nenhum aviso, os registros daqui mantem os numeros",
      rr.novos === 0 &&
        rr.atualizados === 0 &&
        av === 0 &&
        h.h.find((r) => r.id === regProc?.id)?.depois === X &&
        h.h.find((r) => r.id === regDoc?.id)?.depois === "1234567",
      { rr, av },
    );
    // Mais nova que a daqui (o relógio de teste começa em 2026).
    const lapide: Registro = {
      ...(regDoc as Registro),
      removidoEm: RELOGIO_INICIAL + 5_000,
      atualizadoEm: RELOGIO_INICIAL + 5_000,
      dispositivo: "dev-b",
    };
    const rl = await rh.importar({ h: [lapide] });
    checar(
      "registro com outro carimbo (lapide de outro computador) ainda entra",
      rl.atualizados === 1 && av === 1 && (await rh.registros.obter(lapide.id))?.removidoEm === RELOGIO_INICIAL + 5_000,
      { rl, av },
    );
    pararH();
  }

  secao("sincronia no repositorio: numero de processo com letras (SEI-RJ)");
  {
    const RJ = "SEI-150016/000123/2021";
    checar(
      "a forma aceita letras; marcacao, espaco, aspas e & continuam recusados",
      entidadeValida(comProcesso({ protocolo: RJ, idProcedimento: "123" }), "p") &&
        entidadeValida(etapa({ id: "rj", processo: { protocolo: RJ } }), "e") &&
        ["<b>12345678", "1234 5678", 'SEI"150016', "SEI'150016", "SEI&150016", "SEI>150016"].every(
          (protocolo) => !entidadeValida(comProcesso({ protocolo }), "p"),
        ),
    );
    const area = areaMemoria();
    const { repo: un } = novoRepo(ESCOPO_UN, area, "r");
    const { repo: eu } = novoRepo(ESCOPO_EU, area, "s");
    const p = await un.criarProjeto({ nome: "RJ", processo: { protocolo: RJ, idProcedimento: "123" } });
    const { repo: colega } = novoRepo(ESCOPO_UN, areaMemoria(), "c");
    const rc = await colega.importar(await un.entidades());
    checar("um colega importa o projeto do SEI-RJ", rc.novos >= 1 && rc.ignorados === 0 && !!(await colega.obterProjeto(p.id)), rc);
    const movido = await lanca(() => moverEntreEscopos(un, eu, p.id));
    checar(
      "e Quem ve move o projeto do SEI-RJ",
      movido === null && (await eu.obterProjeto(p.id))?.processo?.protocolo === RJ && !(await un.obterProjeto(p.id)),
      movido,
    );
  }
  secao("sincronia: a regra de sigilo do envelope (sigiloDoEnvelope, a mesma do paraOTexto)");
  {
    const Y = "50300.000002/2026-11";
    const Z = "50300.000003/2026-12";
    const s = sigiloDoEnvelope(
      [
        projeto({ id: "p1", processo: { protocolo: X } }),
        projeto({ id: "p2", processo: { protocolo: X, sigiloso: true } }),
        projeto({ id: "p3", processo: { protocolo: Y } }),
        projeto({ id: "p4" }),
        projeto({ id: "p5", processo: { protocolo: "", sigiloso: true } }),
        projeto({ id: "p6", processo: { protocolo: Z, sigiloso: true }, removidoEm: 9, atualizadoEm: 9 }),
        null,
        { id: 5, processo: { protocolo: X, sigiloso: true } },
        { id: "torto", processo: "x" },
      ],
      [
        etapa({ id: "e1", projeto: "p1" }),
        etapa({ id: "e2", projeto: "p3", processo: { protocolo: "50300000777202610" } }),
        etapa({ id: "e3", projeto: "p3" }),
        etapa({ id: "e4", projeto: "p4", processo: { protocolo: Z } }),
        etapa({ id: "e5", projeto: "p5" }),
        etapa({ id: "e6", projeto: "p2", processo: { protocolo: Y } }),
        "lixo",
        { id: "e7" },
      ],
    );
    const lista = (c: ReadonlySet<string>) => [...c].sort().join();
    checar(
      "chaves: os digitos dos numeros marcados em projeto ou etapa (lapide inclusive); o vazio do texto nao conta",
      lista(s.chaves) === lista(new Set([chaveProtocolo(X), chaveProtocolo(Z)])),
      [...s.chaves],
    );
    checar("projetos sigilosos: marcados, o mesmo numero sem marca e o vazio marcado do texto", lista(s.projetos) === "p1,p2,p5,p6", [
      ...s.projetos,
    ]);
    checar(
      "etapas sigilosas: processo proprio sigiloso (mesmo sem pontuacao e sem marca) ou herdada do projeto; processo proprio comum nao",
      lista(s.etapas) === "e1,e2,e4,e5",
      [...s.etapas],
    );
    checar(
      "vinculo(): marcado ou pela chave; comum, ausente e sem digitos nao",
      s.vinculo({ protocolo: "50300.000777/2026-10" }) &&
        s.vinculo({ protocolo: "", sigiloso: true }) &&
        !s.vinculo({ protocolo: Y }) &&
        !s.vinculo(undefined) &&
        !s.vinculo({ protocolo: "SEI-" }),
    );
    // Vínculo de fora (texto editado à mão) com o número que não é texto: a regra responde, sem lançar.
    const tortos: unknown[] = [{ protocolo: 50300 }, { protocolo: null }, { protocolo: ["50300.000777/2026-10"] }, {}];
    const respostas: boolean[] = [];
    const erro = await lanca(() => {
      for (const v of tortos) respostas.push(s.vinculo(v as Vinculo));
      respostas.push(s.vinculo({ protocolo: 50300, sigiloso: true } as unknown as Vinculo));
    });
    checar(
      "vinculo(): numero que nao e texto nao lanca; nao e sigiloso, salvo marcado",
      erro === null && respostas.join() === "false,false,false,false,true",
      erro?.message ?? respostas,
    );
  }
}
