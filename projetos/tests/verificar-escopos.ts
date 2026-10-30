import { areaMemoria } from "@comum/armazenamento/area";
import { novoId } from "@comum/id";
import { LIMITES } from "../src/modelo/constantes";
import type { Etapa, Modelo, Projeto, Registro } from "../src/modelo/tipos";
import { idValido } from "../src/modelo/validacao";
import { chaveProtocolo, indiceDeProcessos } from "../src/modelo/vinculos";
import { entidadeValida, indiceDosEscopos, manterNumeroSigiloso, moverEntreEscopos } from "../src/repositorio";
import { ESCOPO_EU, ESCOPO_UN, novoRepo, RELOGIO_INICIAL } from "./apoioRepositorio";
import { etapa, fase, HOJE, projeto } from "./fabrica";
import { checar, secao } from "./util";

const DIA = 86_400_000;

export async function verificarEscopos(): Promise<void> {
  secao("projetos: exportar e importar envelope");
  const area = areaMemoria();
  const navegador = { agora: RELOGIO_INICIAL };
  const { repo: un } = novoRepo(ESCOPO_UN, area, "u", navegador);
  const { repo: eu } = novoRepo(ESCOPO_EU, area, "e", navegador);
  const p = await un.criarProjeto({ nome: "Pregão", processo: { protocolo: "50300.004410/2026-02" } });
  const f = await un.criarFase(p.id, "Planejamento");
  const e1 = await un.criarEtapa({ projeto: p.id, nome: "ETP", inicio: "2026-10-07", fim: "2026-10-20", fase: f.id });
  const e2 = await un.criarEtapa({
    projeto: p.id,
    nome: "TR",
    inicio: "2026-10-21",
    fim: "2026-10-30",
    processo: { protocolo: "50300.009999/2026-01" },
  });
  await un.removerEtapa(e2.id);
  const env = await un.exportar(5_000);
  checar(
    "envelope da unidade sem login",
    env.formato === "seipro-projetos" && env.versao === 1 && env.vis === "unidade" && env.login === undefined,
  );
  checar(
    "envelope leva lapides",
    env.entidades.e.some((e) => e.id === e2.id && e.removidoEm !== undefined),
  );
  checar("envelope do 'eu' leva o login", (await eu.exportar()).login === "ana");
  const { repo: outro } = novoRepo(ESCOPO_UN, areaMemoria(), "o");
  const r1 = await outro.importar(env.entidades);
  checar(
    "importar num repositorio vazio",
    r1.novos === env.entidades.p.length + 1 + 2 + env.entidades.h.length && r1.atualizados === 0,
    r1,
  );
  let avisosImportar = 0;
  const pararImportar = outro.aoMudar(() => avisosImportar++);
  await outro.importar({
    e: [
      { ...e1, id: "z1" },
      { ...e1, id: "z2" },
    ],
  });
  pararImportar();
  checar("importar varias entidades avisa uma vez", avisosImportar === 1, avisosImportar);
  checar(
    "importar de novo nao muda nada (idempotente)",
    (await outro.importar(env.entidades)).novos === 0 && (await outro.importar(env.entidades)).atualizados === 0,
  );
  const maisNova = { ...e1, nome: "ETP revisado", atualizadoEm: e1.atualizadoEm + 100 };
  const maisVelha = { ...e1, nome: "ETP antigo", atualizadoEm: e1.atualizadoEm - 100 };
  checar(
    "versao mais nova vence",
    (await outro.importar({ e: [maisNova] })).atualizados === 1 && (await outro.obterEtapa(e1.id))?.nome === "ETP revisado",
  );
  checar(
    "versao mais velha perde",
    (await outro.importar({ e: [maisVelha] })).atualizados === 0 && (await outro.obterEtapa(e1.id))?.nome === "ETP revisado",
  );
  const lixo = await outro.importar({ e: [{ id: "x" } as never, { ...e1, id: "y", inicio: "2026-02-30" }], p: [null as never] });
  checar("malformado e data impossivel sao ignorados", lixo.ignorados === 3 && lixo.novos === 0, lixo);
  checar(
    "lapide que chega remove",
    (await outro.dados()).etapas.every((e) => e.id !== e2.id),
  );

  secao("projetos: sigiloso que chega sem numero");
  const local = projeto({ id: "s", processo: { protocolo: "50300.000001/2026-11", sigiloso: true, idProcedimento: "77" } });
  const vazio = projeto({ id: "s", nome: "Novo nome", processo: { protocolo: "", sigiloso: true }, atualizadoEm: 9 });
  const r = manterNumeroSigiloso(vazio, local);
  checar(
    "mantem o numero e o id local",
    r.processo?.protocolo === "50300.000001/2026-11" && r.processo.idProcedimento === "77" && r.nome === "Novo nome",
  );
  checar("sem copia local fica vazio", manterNumeroSigiloso(vazio, undefined).processo?.protocolo === "");
  checar(
    "nao sigiloso passa como veio",
    manterNumeroSigiloso(projeto({ id: "s", processo: { protocolo: "" } }), local).processo?.protocolo === "",
  );
  const { repo: rs } = novoRepo(ESCOPO_UN, areaMemoria(), "s");
  await rs.importar({ p: [local] });
  await rs.importar({ p: [vazio] });
  checar("na mesclagem o numero local fica", (await rs.obterProjeto("s"))?.processo?.protocolo === "50300.000001/2026-11");
  const { repo: ro } = novoRepo(ESCOPO_UN, areaMemoria(), "q");
  await ro.importar({ p: [projeto({ id: "torto", ordem: "zz!!" })] });
  checar(
    "chave de ordem invalida importada nao impede criar",
    (await ro.criarProjeto({ nome: "Depois do torto" })).nome === "Depois do torto",
  );
  checar("entidadeValida aceita etapa completa", entidadeValida(etapa({ id: "a" }), "e"));
  checar("entidadeValida recusa etapa de 30 anos", !entidadeValida(etapa({ id: "a", inicio: "2026-01-05", fim: "2056-01-05" }), "e"));
  checar("entidadeValida aceita etapa de 5 anos", entidadeValida(etapa({ id: "a", inicio: "2026-01-05", fim: "2031-01-05" }), "e"));
  const mBase = {
    id: "m",
    nome: "M",
    fases: ["F"],
    etapas: [{ nome: "x", aPartirDe: 0, duracao: 1, marco: false, dependeDe: [], checklist: [] }],
    criadoEm: 1,
    atualizadoEm: 1,
    dispositivo: "d",
  };
  checar("entidadeValida aceita modelo normal", entidadeValida(mBase, "m"));
  checar(
    "entidadeValida recusa modelo hostil (aPartirDe 1e9)",
    !entidadeValida({ ...mBase, etapas: [{ ...mBase.etapas[0], aPartirDe: 1e9 }] }, "m"),
  );
  checar("entidadeValida recusa modelo com fase que nao e texto", !entidadeValida({ ...mBase, fases: [1] }, "m"));
  checar("entidadeValida recusa modelo com etapa que nao e objeto", !entidadeValida({ ...mBase, etapas: [null] }, "m"));
  const hostil = { ...mBase, id: "mh", etapas: [{ ...mBase.etapas[0], duracao: Number.POSITIVE_INFINITY }] };
  const { repo: rh } = novoRepo(ESCOPO_UN, areaMemoria(), "h");
  const rImp = await rh.importar({ m: [mBase, hostil as never], e: [etapa({ id: "trinta", inicio: "2026-01-05", fim: "2056-01-05" })] });
  checar(
    "importar ignora modelo hostil e etapa de 30 anos",
    (await rh.dados()).modelos.length === 1 && (await rh.dados()).etapas.length === 0 && rImp.ignorados === 2,
  );
  checar("entidadeValida recusa etapa sem datas", !entidadeValida({ ...etapa({ id: "a" }), fim: undefined }, "e"));

  secao("projetos: limpeza de lapides");
  const { repo: rl, relogio } = novoRepo(ESCOPO_UN, areaMemoria(), "l");
  const pl = await rl.criarProjeto({ nome: "Velho" });
  await rl.removerProjeto(pl.id);
  const removidoEm = relogio();
  checar("unidade: lapide de 179 dias fica", (await rl.limpar(removidoEm + 179 * DIA)) === 0);
  // Com a lápide saem os 2 registros do projeto (criação e exclusão): órfãos, como no texto (residuais N1).
  checar(
    "unidade: lapide de 181 dias sai (com os registros do projeto)",
    (await rl.limpar(removidoEm + 181 * DIA)) === 3 && !(await rl.projetos.obter(pl.id)) && (await rl.historico()).length === 0,
  );
  const { repo: rle, relogio: relogioEu } = novoRepo(ESCOPO_EU, areaMemoria(), "m");
  const pe = await rle.criarProjeto({ nome: "Meu" });
  await rle.removerProjeto(pe.id);
  checar("so eu: lapide de 91 dias sai (com os registros do projeto)", (await rle.limpar(relogioEu() + 91 * DIA)) === 3);

  secao("projetos: indice de processos");
  checar("chaveProtocolo so digitos", chaveProtocolo("50300.004410/2026-02") === "50300004410202602");
  const pa = projeto({ id: "pa", processo: { protocolo: "50300.004410/2026-02" } });
  const pb = projeto({ id: "pb", arquivadoEm: 5, processo: { protocolo: "50300.004410/2026-02" } });
  const ea = etapa({ id: "ea", projeto: "pa" });
  const eb = etapa({ id: "eb", projeto: "pa", processo: { protocolo: "50300.000777/2026-00" } });
  const ec = etapa({ id: "ec", projeto: "pc", processo: { protocolo: "50300.000777/2026-00" } });
  const pc = projeto({ id: "pc" });
  const idx = indiceDeProcessos([
    { vis: "unidade", projetos: [pa, pb], etapas: [ea, eb] },
    { vis: "eu", projetos: [pc], etapas: [ec, { ...etapa({ id: "ed", projeto: "pc", processo: { protocolo: "1" } }), removidoEm: 1 }] },
  ]);
  const doProjeto = idx.get("50300004410202602");
  checar(
    "processo do projeto: papel projeto com as etapas sem processo proprio",
    doProjeto?.length === 1 && doProjeto[0]?.papel === "projeto" && doProjeto[0]?.etapas.map((e) => e.id).join() === "ea",
  );
  const deEtapa = idx.get("50300000777202600");
  checar(
    "processo de etapa nos dois escopos",
    deEtapa?.map((v) => `${v.vis}:${v.projeto.id}:${v.papel}`).join() === "unidade:pa:etapa,eu:pc:etapa",
  );
  checar("arquivado e lapide ficam fora", !idx.has("1") && !doProjeto?.some((v) => v.projeto.id === "pb"));
  const juntos = await indiceDosEscopos([un, eu]);
  checar(
    "indiceDosEscopos junta os repositorios",
    juntos
      .get("50300004410202602")?.[0]
      ?.etapas.map((e) => e.id)
      .join() === e1.id,
  );

  secao("projetos: mover entre escopos");
  let avisos = 0;
  const parar = eu.aoMudar(() => avisos++);
  const movido = await moverEntreEscopos(un, eu, p.id);
  parar();
  checar("aoMudar avisa as gravacoes", avisos > 0);
  checar("destino do mover recebe tudo numa gravacao so", avisos === 1, avisos);
  checar("mesmo id no destino", movido.id === p.id);
  const de = await eu.dados();
  checar("fases e etapas vivas foram junto", de.fases.length === 1 && de.etapas.length === 1 && de.etapas[0]?.fase === f.id);
  checar("origem ficou sem o projeto", !(await un.dados()).projetos.length && !(await un.dados()).etapas.length);
  const hist = await eu.historico(p.id);
  checar(
    "historico foi junto e registra a visibilidade",
    hist[0]?.campo === "visibilidade" &&
      hist[0]?.antes === "Toda a unidade" &&
      hist[0]?.depois === "Só eu" &&
      hist.some((x) => x.campo === "criacao"),
  );
  checar("historico saiu da origem", !(await un.historico(p.id)).length);
  checar(
    "mover projeto que nao existe e recusado",
    await moverEntreEscopos(un, eu, "nada").then(
      () => false,
      () => true,
    ),
  );
  checar("datas do mover nao mudam", de.etapas[0]?.inicio === "2026-10-07" && HOJE === "2026-10-06");

  secao("projetos: mover com destino hostil e vinculo torto");
  const nav2 = { agora: RELOGIO_INICIAL };
  const { repo: ua } = novoRepo(ESCOPO_UN, areaMemoria(), "a", nav2);
  const { repo: ea2 } = novoRepo(ESCOPO_EU, areaMemoria(), "b", nav2);
  const pm = await ua.criarProjeto({ nome: "Mover" });
  const em = await ua.criarEtapa({ projeto: pm.id, nome: "E", inicio: "2026-10-07", fim: "2026-10-08" });
  // Lápide de outro computador com o relógio 1 hora adiantado (dentro da folga de 1 dia da mesclagem).
  const adiantada = nav2.agora + 3_600_000;
  checar(
    "lapide adiantada entra no destino",
    (await ea2.importar({ p: [{ ...pm, atualizadoEm: adiantada, removidoEm: adiantada }] })).novos === 1 &&
      (await ea2.projetos.obter(pm.id))?.removidoEm === adiantada,
  );
  const mv = await moverEntreEscopos(ua, ea2, pm.id);
  checar("lapide mais nova no destino: projeto fica vivo no destino", mv.removidoEm === undefined && !!(await ea2.obterProjeto(pm.id)));
  checar("lapide mais nova no destino: origem lapidada so depois", !(await ua.dados()).projetos.length);
  checar(
    "etapa foi junto",
    (await ea2.dados()).etapas.some((x) => x.id === em.id),
  );

  {
    // Destino com 300 registros mais novos: os do projeto movido são excedentes, e o mover não é recusado por isso.
    const navH = { agora: RELOGIO_INICIAL };
    const { repo: origemH } = novoRepo(ESCOPO_UN, areaMemoria(), "oh", navH);
    const { repo: destinoH } = novoRepo(ESCOPO_EU, areaMemoria(), "dh", navH);
    const ph = await origemH.criarProjeto({ nome: "Com historico" });
    await origemH.criarEtapa({ projeto: ph.id, nome: "E", inicio: "2026-10-07", fim: "2026-10-08" });
    // Os 300 são de outro projeto do destino (registro de projeto que não existe é órfão e é recusado: revisão final da P4).
    await destinoH.importar({ p: [projeto({ id: "outro", atualizadoEm: navH.agora })] });
    const cheios: Registro[] = Array.from({ length: LIMITES.historico }, (_, i) => ({
      id: `n${i}`,
      alvo: "outro",
      projeto: "outro",
      quando: navH.agora + 10_000 + i,
      por: "ana",
      campo: "nome",
      atualizadoEm: navH.agora + 10_000 + i,
      dispositivo: "d",
    }));
    await destinoH.importar({ h: cheios });
    const movidoH = await moverEntreEscopos(origemH, destinoH, ph.id).then(
      (x) => x,
      (e) => e as Error,
    );
    checar(
      "mover com o historico do destino cheio: projeto e etapa no destino, historico em 300",
      !(movidoH instanceof Error) &&
        (await destinoH.dados()).etapas.length === 1 &&
        (await destinoH.historico()).length === LIMITES.historico,
      movidoH instanceof Error ? movidoH.message : undefined,
    );
  }

  const pn = await ua.criarProjeto({ nome: "Mesmo" });
  const mesmo = await moverEntreEscopos(ua, ua, pn.id).then(
    () => false,
    () => true,
  );
  checar("mover para o mesmo escopo e recusado", mesmo && !!(await ua.obterProjeto(pn.id)));

  const pi = await ua.criarProjeto({ nome: "Invalido" });
  await ua.etapas.gravar("ruim", { ...etapa({ id: "ruim", projeto: pi.id }), inicio: "2026-02-30" });
  const invalido = await moverEntreEscopos(ua, ea2, pi.id).then(
    () => false,
    () => true,
  );
  checar(
    "item invalido: recusa e origem intacta, destino sem o projeto",
    invalido && !!(await ua.obterProjeto(pi.id)) && !(await ea2.projetos.obter(pi.id)),
  );

  const { repo: rv } = novoRepo(ESCOPO_UN, areaMemoria(), "v");
  const torto = await rv.importar({
    p: [
      projeto({ id: "t1", processo: { protocolo: 5.03e16 as never } }),
      projeto({ id: "t2", processo: "x" as never }),
      projeto({ id: "t3", processo: { protocolo: "1", sigiloso: "sim" as never } }),
    ],
    e: [{ ...etapa({ id: "t4", projeto: "t1" }), documento: { numero: 5 as never } }],
  });
  checar("processo/documento tortos sao ignorados", torto.ignorados === 4 && torto.novos === 0, torto);
  await rv.projetos.gravar("t5", projeto({ id: "t5", processo: { protocolo: 123 as never } }));
  checar("vinculos nao lanca com vinculo torto ja gravado", (await rv.vinculos()).size === 0);

  secao("projetos: entidadeValida confere cada item (Texto Padrao editado a mao)");
  {
    const boa = etapa({ id: "e1", fase: "f1" });
    const ruins: Record<string, Partial<Record<keyof Etapa, unknown>>> = {
      "checklist [null]": { checklist: [null] },
      "item de checklist sem feito": { checklist: [{ id: "c", texto: "t" }] },
      "responsavel {}": { responsavel: {} },
      "responsavel com login numero": { responsavel: { nome: "A", login: 5 } },
      "etiqueta numero": { etiquetas: [1] },
      "11 etiquetas": { etiquetas: Array.from({ length: 11 }, (_, i) => `t${i}`) },
      "etiqueta de 41": { etiquetas: ["x".repeat(41)] },
      "base torta": { base: { inicio: "x", fim: "y" } },
      "base sem fim": { base: { inicio: "2026-10-05" } },
      "concluidaEm objeto": { concluidaEm: {} },
      "concluidaEm impossivel": { concluidaEm: "2026-02-30" },
      "dependeDe com objeto": { dependeDe: [{}] },
      "dependeDe com espaco": { dependeDe: ["a b"] },
      "medida fora do enum": { medida: "horas" },
      "progresso 101": { progresso: 101 },
      "progresso NaN": { progresso: Number.NaN },
      "marco texto": { marco: "sim" },
      "fase numero": { fase: 3 },
      "fase com virgula": { fase: "f,1" },
      "projeto com espaco": { projeto: "p 1" },
      "criadoEm texto": { criadoEm: "1" },
      "nome de 201": { nome: "n".repeat(201) },
      "observacoes de 2001": { observacoes: "o".repeat(2001) },
      "51 itens de checklist": { checklist: Array.from({ length: 51 }, (_, i) => ({ id: `c${i}`, texto: "t", feito: false })) },
      "item de checklist de 201": { checklist: [{ id: "c", texto: "t".repeat(201), feito: false }] },
      "ano 2206": { inicio: "2206-10-05", fim: "2206-10-09" },
      "ano 1999": { inicio: "1999-10-04", fim: "1999-10-08" },
    };
    for (const [nome, extra] of Object.entries(ruins))
      checar(`entidadeValida recusa etapa: ${nome}`, !entidadeValida({ ...boa, ...extra }, "e"));
    checar("entidadeValida recusa id com espaco", !entidadeValida(etapa({ id: "a b" }), "e"));
    checar("entidadeValida recusa id com virgula", !entidadeValida(etapa({ id: "a,b" }), "e"));
    checar("entidadeValida recusa id de 65", !entidadeValida(etapa({ id: "i".repeat(65) }), "e"));
    checar(
      "entidadeValida aceita etapa completa com todos os campos",
      entidadeValida(
        {
          ...boa,
          responsavel: { nome: "Ana", login: "ana" },
          checklist: [{ id: "c1", texto: "t", feito: true }],
          etiquetas: ["TI"],
          concluidaEm: "2026-10-09",
          base: { inicio: "2026-10-05", fim: "2026-10-09" },
          observacoes: "o",
          dependeDe: ["e0"],
          alteradoPor: "ana",
          origem: { atividades: 12 },
        },
        "e",
      ),
    );
    checar("entidadeValida recusa projeto com arquivadoEm texto", !entidadeValida(projeto({ id: "p", arquivadoEm: "x" as never }), "p"));
    checar("entidadeValida recusa projeto com etiqueta numero", !entidadeValida(projeto({ id: "p", etiquetas: [1 as never] }), "p"));
    checar(
      "entidadeValida recusa projeto com criadoEm Infinity",
      !entidadeValida(projeto({ id: "p", criadoEm: Number.POSITIVE_INFINITY }), "p"),
    );
    checar("entidadeValida recusa fase de projeto com espaco", !entidadeValida(fase({ id: "f", projeto: "p 1" }), "f"));
    checar("entidadeValida recusa fase de nome gigante", !entidadeValida(fase({ id: "f", nome: "n".repeat(201) }), "f"));
    const reg: Registro = {
      id: "r1",
      alvo: "e1",
      projeto: "p1",
      quando: RELOGIO_INICIAL,
      por: "ana",
      campo: "nome",
      antes: "a",
      depois: "b",
      atualizadoEm: RELOGIO_INICIAL,
      dispositivo: "d",
    };
    checar("entidadeValida aceita registro completo", entidadeValida(reg, "h"));
    checar("entidadeValida recusa registro sem por", !entidadeValida({ ...reg, por: undefined }, "h"));
    checar("entidadeValida recusa registro com antes numero", !entidadeValida({ ...reg, antes: 5 }, "h"));
    checar("entidadeValida recusa registro com quando NaN", !entidadeValida({ ...reg, quando: Number.NaN }, "h"));
    checar("entidadeValida recusa registro com alvo de espaco", !entidadeValida({ ...reg, alvo: "e 1" }, "h"));
    const mod: Modelo = { id: "m", nome: "M", fases: [], etapas: [], criadoEm: 1, atualizadoEm: 1, dispositivo: "d" };
    checar("entidadeValida recusa modelo com criadoEm texto", !entidadeValida({ ...mod, criadoEm: "1" }, "m"));
    checar("entidadeValida recusa modelo de nome gigante", !entidadeValida({ ...mod, nome: "n".repeat(201) }, "m"));
    checar(
      "ids do novoId casam com o padrao",
      idValido(novoId()) && idValido(novoId({ getRandomValues: (b) => crypto.getRandomValues(b) })),
    );

    const { repo: ri } = novoRepo(ESCOPO_UN, areaMemoria(), "i");
    const rImp = await ri.importar({
      p: [projeto({ id: "p1" })],
      f: [fase({ id: "f1" })],
      e: [boa, { ...etapa({ id: "e2", fase: "f1" }), checklist: [null] as never }, { ...etapa({ id: "e3" }), dependeDe: ["e1", "e1"] }],
    });
    checar("importar ignora a etapa torta", rImp.ignorados === 1 && rImp.novos === 4, rImp);
    checar("importar tira dependencia repetida", (await ri.obterEtapa("e3"))?.dependeDe.join() === "e1");
  }

  secao("projetos: tetos de quantidade na importacao");
  {
    const { repo: rt } = novoRepo(ESCOPO_UN, areaMemoria(), "t");
    const projetos: Projeto[] = Array.from({ length: LIMITES.projetosAtivos + 3 }, (_, i) =>
      projeto({ id: `p${String(i).padStart(3, "0")}` }),
    );
    projetos.push(projeto({ id: "arq", arquivadoEm: 5 }), projeto({ id: "rem", removidoEm: 5, atualizadoEm: 5 }));
    const r1 = await rt.importar({ p: projetos });
    const ativos = (await rt.dados()).projetos.filter((x) => x.arquivadoEm === undefined);
    checar(
      "101+ projetos ativos: 100 entram, o excedente e ignorado e contado (arquivado e lapide entram)",
      ativos.length === LIMITES.projetosAtivos &&
        r1.ignorados === 3 &&
        r1.excedentes === 3 &&
        !!(await rt.projetos.obter("arq")) &&
        !!(await rt.projetos.obter("rem")),
      { ...r1, ativos: ativos.length },
    );
    const etapas: Etapa[] = Array.from({ length: LIMITES.etapasPorProjeto + 2 }, (_, i) => etapa({ id: `e${i}`, projeto: "p000" }));
    etapas.push(etapa({ id: "outra", projeto: "p001" }));
    const r2 = await rt.importar({ e: etapas });
    const doP0 = (await rt.dados()).etapas.filter((e) => e.projeto === "p000");
    checar(
      "302 etapas num projeto: 300 entram; a de outro projeto entra",
      doP0.length === LIMITES.etapasPorProjeto && r2.excedentes === 2 && r2.novos === LIMITES.etapasPorProjeto + 1,
      { ...r2, doP0: doP0.length },
    );
    const modelos: Modelo[] = Array.from({ length: LIMITES.modelos + 1 }, (_, i) => ({
      id: `m${String(i).padStart(2, "0")}`,
      nome: `M${i}`,
      fases: [],
      etapas: [],
      criadoEm: 1,
      atualizadoEm: 1,
      dispositivo: "d",
    }));
    const r3 = await rt.importar({ m: modelos });
    checar("51 modelos: 50 entram", (await rt.dados()).modelos.length === LIMITES.modelos && r3.excedentes === 1, r3);
    const regs: Registro[] = Array.from({ length: LIMITES.historico + 10 }, (_, i) => ({
      id: `r${i}`,
      alvo: "p000",
      projeto: "p000",
      quando: RELOGIO_INICIAL + i + 1,
      por: "ana",
      campo: "nome",
      atualizadoEm: RELOGIO_INICIAL + i + 1,
      dispositivo: "d",
    }));
    const r4 = await rt.importar({ h: regs });
    const hist = await rt.historico();
    checar(
      "310 registros: ficam os 300 mais recentes",
      hist.length === LIMITES.historico && r4.excedentes === 10 && !hist.some((r) => r.quando <= RELOGIO_INICIAL + 10),
      { ...r4, hist: hist.length },
    );
  }

  secao("projetos: carimbo do futuro");
  {
    const DIA_MS = 86_400_000;
    const { repo: rf, relogio } = novoRepo(ESCOPO_UN, areaMemoria(), "c");
    const pf = await rf.criarProjeto({ nome: "P" });
    const agora = relogio();
    checar(
      "entidadeValida com agora recusa carimbo alem de 1 dia",
      !entidadeValida({ ...pf, atualizadoEm: agora + 2 * DIA_MS }, "p", agora),
    );
    checar(
      "entidadeValida com agora aceita relogio adiantado ate 1 dia",
      entidadeValida({ ...pf, atualizadoEm: agora + DIA_MS }, "p", agora),
    );
    checar("entidadeValida com agora recusa lapide do futuro", !entidadeValida({ ...pf, removidoEm: agora + 2 * DIA_MS }, "p", agora));
    const rFut = await rf.importar({ p: [{ ...pf, nome: "imortal", atualizadoEm: 9e15 }] });
    checar("importar ignora carimbo 9e15", rFut.ignorados === 1 && (await rf.obterProjeto(pf.id))?.nome === "P", rFut);
    // Relógio de outro computador 1 hora adiantado: a edição local seguinte ainda vence.
    const adiantado = { ...pf, nome: "adiantado", atualizadoEm: relogio() + 3_600_000, dispositivo: "dev-b" };
    await rf.importar({ p: [adiantado] });
    const ed = await rf.editarProjeto(pf.id, { nome: "local" });
    checar("edicao local carimba acima do carimbo adiantado", ed.atualizadoEm > adiantado.atualizadoEm, ed.atualizadoEm);
    const { repo: outroPc } = novoRepo(ESCOPO_UN, areaMemoria(), "o2");
    await outroPc.importar({ p: [adiantado] });
    await outroPc.importar((await rf.exportar()).entidades);
    checar("edicao local depois de carimbo adiantado vence nos outros computadores", (await outroPc.obterProjeto(pf.id))?.nome === "local");
  }

  secao("projetos: sigiloso na mesclagem e no historico");
  {
    const { repo: rs2 } = novoRepo(ESCOPO_UN, areaMemoria(), "g");
    const ps = await rs2.criarProjeto({ nome: "P", processo: { protocolo: "50300.000001/2026-11", idProcedimento: "77" } });
    await rs2.importar({
      p: [{ ...ps, processo: { protocolo: "", sigiloso: true }, atualizadoEm: ps.atualizadoEm + 100, dispositivo: "dev-b" }],
    });
    const depoisMescla = (await rs2.obterProjeto(ps.id))?.processo;
    checar(
      "quem nao sabia do sigilo mantem o numero local (agora sigiloso)",
      depoisMescla?.protocolo === "50300.000001/2026-11" && depoisMescla.sigiloso === true && depoisMescla.idProcedimento === "77",
      depoisMescla,
    );
    const outro = projeto({ id: "s2", processo: { protocolo: "50300.000002/2026-11", idProcedimento: "88" } });
    const vazioOutro = projeto({ id: "s2", processo: { protocolo: "", sigiloso: true, idProcedimento: "99" }, atualizadoEm: 9 });
    checar(
      "idProcedimento diferente: nao e o mesmo processo, fica vazio",
      manterNumeroSigiloso(vazioOutro, outro).processo?.protocolo === "",
    );
    const { repo: rh2 } = novoRepo(ESCOPO_UN, areaMemoria(), "k");
    const ph = await rh2.criarProjeto({ nome: "P" });
    await rh2.editarProjeto(ph.id, { processo: { protocolo: "50300.000001/2026-11" } });
    await rh2.editarProjeto(ph.id, { processo: { protocolo: "50300.000001/2026-11", sigiloso: true } });
    const regs = (await rh2.historico()).filter((r) => r.campo === "processo");
    checar(
      "marcar como sigiloso um vinculo existente nao gera registro com o numero",
      regs.length === 1 && regs[0]?.antes === undefined,
      regs.map((r) => `${r.campo}:${r.antes ?? ""}->${r.depois ?? ""}`),
    );
    const eh = await rh2.criarEtapa({
      projeto: ph.id,
      nome: "E",
      inicio: "2026-10-07",
      fim: "2026-10-08",
      processo: { protocolo: "50300.000003/2026-11" },
    });
    await rh2.editarEtapa(eh.id, { processo: { protocolo: "", sigiloso: true } }, HOJE);
    checar(
      "etapa: vinculo que chega sigiloso e vazio nao leva o numero de antes",
      !(await rh2.historico(ph.id)).some((r) => r.campo === "processo" && r.alvo === eh.id && `${r.antes}${r.depois}`.includes("50300")),
    );
  }
}
