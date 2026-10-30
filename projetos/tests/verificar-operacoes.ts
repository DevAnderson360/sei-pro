import {
  carimbarRegistros,
  excedentes,
  registrosDeEtapa,
  registrosDeFase,
  registrosDeProjeto,
  textosDoVinculo,
} from "../src/modelo/historico";
import {
  compararEtapas,
  concluir,
  datasDaEtapaNova,
  editar,
  novaEtapa,
  novaFase,
  novoProjeto,
  porOrdem,
  reabrir,
  remover,
  restaurar,
} from "../src/modelo/operacoes";
import type { Registro } from "../src/modelo/tipos";
import {
  checklistLimpo,
  etiquetasLimpas,
  nomeLimpo,
  problemasDaEtapa,
  problemasDoModelo,
  problemasDoProjeto,
} from "../src/modelo/validacao";
import { C, etapa, fase, HOJE, projeto } from "./fabrica";
import { checar, secao } from "./util";

export function verificarOperacoes(): void {
  secao("projetos: validacao");
  const base = { nome: "Etapa", inicio: "2026-10-05", fim: "2026-10-09", progresso: 0, checklist: [], etiquetas: [] };
  checar("etapa valida", problemasDaEtapa(base).length === 0);
  checar("nome vazio", problemasDaEtapa({ ...base, nome: "   " }).join() === "Informe o nome da etapa.");
  checar("etapa de 10 anos passa", problemasDaEtapa({ ...base, inicio: "2026-01-01", fim: "2035-12-01" }).length === 0);
  checar(
    "etapa de decadas e recusada (mesmo teto da importacao)",
    problemasDaEtapa({ ...base, inicio: "2000-01-03", fim: "2100-01-03" }).join() === "A etapa pode durar no máximo cerca de 10 anos.",
  );
  checar("nome com 201 caracteres", problemasDaEtapa({ ...base, nome: "x".repeat(201) }).join() === "O nome pode ter até 200 caracteres.");
  checar("nome com 200 caracteres passa", problemasDaEtapa({ ...base, nome: "x".repeat(200) }).length === 0);
  checar("30 de fevereiro", problemasDaEtapa({ ...base, inicio: "2026-02-30" }).join() === "Informe datas válidas.");
  checar("termino antes do inicio", problemasDaEtapa({ ...base, fim: "2026-10-01" }).join() === "O término não pode ser antes do início.");
  checar("inicio igual ao termino passa", problemasDaEtapa({ ...base, fim: base.inicio }).length === 0);
  checar(
    "ano 2206 recusado (faixa do calendario)",
    problemasDaEtapa({ ...base, inicio: "2206-10-06", fim: "2206-10-07" }).join() === "Use datas entre 2000 e 2100.",
    problemasDaEtapa({ ...base, inicio: "2206-10-06", fim: "2206-10-07" }),
  );
  checar(
    "ano 1999 recusado",
    problemasDaEtapa({ ...base, inicio: "1999-12-27", fim: "2000-01-03" }).join() === "Use datas entre 2000 e 2100.",
  );
  checar(
    "bordas 2000-01-01 e 2100-12-31 passam",
    problemasDaEtapa({ ...base, inicio: "2000-01-01", fim: "2000-01-03" }).length === 0 &&
      problemasDaEtapa({ ...base, inicio: "2100-12-27", fim: "2100-12-31" }).length === 0,
  );
  checar("progresso 101", problemasDaEtapa({ ...base, progresso: 101 }).join() === "O progresso vai de 0 a 100.");
  const itens = (n: number, t = "item") => Array.from({ length: n }, (_, i) => ({ id: String(i), texto: t, feito: false }));
  checar("51 itens de checklist", problemasDaEtapa({ ...base, checklist: itens(51) }).join() === "O checklist pode ter até 50 itens.");
  checar("item com 201 caracteres", problemasDaEtapa({ ...base, checklist: itens(1, "y".repeat(201)) }).length === 1);
  checar(
    "11 etiquetas",
    problemasDaEtapa({ ...base, etiquetas: Array.from({ length: 11 }, (_, i) => `e${i}`) }).join() === "Use até 10 etiquetas.",
  );
  checar(
    "etiqueta com 41",
    problemasDaEtapa({ ...base, etiquetas: ["z".repeat(41)] }).join() === "Cada etiqueta pode ter até 40 caracteres.",
  );
  checar(
    "observacoes com 2001",
    problemasDaEtapa({ ...base, observacoes: "o".repeat(2001) }).join() === "As observações podem ter até 2.000 caracteres.",
  );
  checar(
    "responsavel com nome de 201 (o mesmo teto da importacao)",
    problemasDaEtapa({ ...base, responsavel: { nome: "r".repeat(201) } }).join() === "O nome do responsável pode ter até 200 caracteres.",
    problemasDaEtapa({ ...base, responsavel: { nome: "r".repeat(201) } }),
  );
  checar(
    "modelo com descricao de 2001 (o mesmo teto da importacao)",
    problemasDoModelo({ nome: "M", fases: [], etapas: [], descricao: "d".repeat(2001) }).join() ===
      "A descrição pode ter até 2.000 caracteres.",
  );
  checar("projeto sem nome", problemasDoProjeto({ nome: "", etiquetas: [] }).join() === "Informe o nome do projeto.");
  checar(
    "modelo com fase inexistente",
    problemasDoModelo({
      nome: "M",
      fases: [],
      etapas: [{ nome: "x", fase: 0, aPartirDe: 0, duracao: 1, marco: false, dependeDe: [], checklist: [] }],
    }).join() === "Etapa do modelo aponta para uma fase que não existe.",
  );
  const em = { nome: "x", aPartirDe: 0, duracao: 1, marco: false, dependeDe: [] as number[], checklist: [] as string[] };
  const ruimModelo = (e: object, fases: string[] = []): boolean =>
    problemasDoModelo({ nome: "M", fases, etapas: [{ ...em, ...e }] }).length > 0;
  checar("modelo recusa aPartirDe 1e9", ruimModelo({ aPartirDe: 1e9 }));
  checar("modelo recusa duracao Infinity e NaN", ruimModelo({ duracao: Number.POSITIVE_INFINITY }) && ruimModelo({ duracao: Number.NaN }));
  checar("modelo recusa fracao e texto como numero", ruimModelo({ aPartirDe: 1.5 }) && ruimModelo({ duracao: "3" }));
  checar("modelo aceita o teto (2600) e recusa 2601", !ruimModelo({ duracao: 2600 }) && ruimModelo({ duracao: 2601 }));
  checar(
    "modelo recusa fase fracionaria ou alem do fim",
    ruimModelo({ fase: 1 }, ["a"]) && ruimModelo({ fase: 0.5 }, ["a"]) && !ruimModelo({ fase: 0 }, ["a"]),
  );
  checar(
    "modelo recusa dependeDe fora da faixa e a si mesma",
    ruimModelo({ dependeDe: [5] }) && ruimModelo({ dependeDe: [0] }) && ruimModelo({ dependeDe: [-1] }),
  );
  checar(
    "modelo recusa checklist com nao-texto ou item gigante",
    ruimModelo({ checklist: [1] }) && ruimModelo({ checklist: ["a".repeat(201)] }),
  );
  checar(
    "modelo recusa mais de 300 etapas",
    problemasDoModelo({ nome: "M", fases: [], etapas: Array.from({ length: 301 }, () => ({ ...em })) }).length > 0,
  );
  checar("nomeLimpo junta espacos", nomeLimpo("  Revisão   da  norma ") === "Revisão da norma");
  checar(
    "etiquetasLimpas sem repetidas por acento e caixa",
    etiquetasLimpas(["Licitação", "licitacao", " ", "TI"]).join() === "Licitação,TI",
  );
  checar(
    "checklistLimpo tira item vazio",
    checklistLimpo([
      { id: "1", texto: "  ", feito: false },
      { id: "2", texto: " a ", feito: true },
    ])
      .map((i) => i.texto)
      .join() === "a",
  );

  secao("projetos: operacoes com carimbo");
  const p = novoProjeto({ nome: "  Revisão  ", etiquetas: ["TI", "ti"] }, "p1", "a0", C);
  checar(
    "novo projeto limpo e carimbado",
    p.nome === "Revisão" && p.etiquetas.join() === "TI" && p.alteradoPor === "ana" && p.criadoEm === 1_000,
  );
  checar("novo projeto sem chaves undefined", !("processo" in p) && !("arquivadoEm" in p));
  const e = novaEtapa({ projeto: "p1", nome: "Marco", inicio: "2026-10-07", fim: "2026-10-20", marco: true }, "e1", "a0", C);
  checar("marco: fim = inicio e base de um dia", e.fim === "2026-10-07" && e.base?.fim === "2026-10-07");
  checar(
    "etapa nova: medida manual, progresso 0, base com as datas",
    e.medida === "manual" && e.progresso === 0 && e.base?.inicio === "2026-10-07",
  );
  const e2 = novaEtapa(
    { projeto: "p1", nome: "X", inicio: "2026-10-07", fim: "2026-10-09", dependeDe: ["a", "a"], progresso: 140 },
    "e2",
    "a1",
    C,
  );
  checar("dependencias sem repetir e progresso limitado", e2.dependeDe.join() === "a" && e2.progresso === 100);
  const C2 = { agora: 2_000, dispositivo: "dev-b", por: "bia" };
  const ed = editar(e2, { nome: "Y" }, C2);
  checar(
    "editar recarimba e troca alteradoPor",
    ed.atualizadoEm === 2_000 && ed.dispositivo === "dev-b" && ed.alteradoPor === "bia" && ed.nome === "Y",
  );
  checar("editar sem 'por' mantem o alteradoPor anterior", editar(ed, { nome: "Z" }, { agora: 3, dispositivo: "x" }).alteradoPor === "bia");
  const adiantada = { ...e2, atualizadoEm: 5_000 };
  checar("editar item com carimbo adiantado carimba acima dele", editar(adiantada, { nome: "W" }, C2).atualizadoEm === 5_001);
  checar(
    "remover e restaurar tambem carimbam acima",
    remover(adiantada, C2).atualizadoEm === 5_001 &&
      remover(adiantada, C2).removidoEm === 2_000 &&
      restaurar({ ...adiantada, removidoEm: 4_000 }, C2).atualizadoEm === 5_001,
  );
  checar("editar com undefined apaga o campo", !("observacoes" in editar({ ...e2, observacoes: "o" }, { observacoes: undefined }, C2)));
  const rem = remover(e2, C2);
  checar("remover grava lapide", rem.removidoEm === 2_000);
  checar("restaurar tira a lapide", !("removidoEm" in restaurar(rem, { ...C2, agora: 3_000 })));
  const conc = concluir(e2, HOJE, C2, { numero: "1234567" });
  checar("concluir com a data de hoje e documento", conc.concluidaEm === HOJE && conc.documento?.numero === "1234567");
  checar("reabrir tira a conclusao", !("concluidaEm" in reabrir(conc, C2)));
  checar(
    "concluir sem documento guarda o que havia; com null tira (Informar documento com o campo vazio)",
    concluir(conc, "2026-10-05", C2).documento?.numero === "1234567" && !("documento" in concluir(conc, "2026-10-05", C2, null)),
  );
  checar("nova fase", novaFase("p1", " Instrução ", "f1", "a0", C).nome === "Instrução");
  checar(
    "porOrdem desempata pelo id",
    [fase({ id: "b" }), fase({ id: "a" })]
      .sort(porOrdem)
      .map((x) => x.id)
      .join() === "a,b",
  );
  const x = etapa({ id: "x", nome: "beta", inicio: "2026-10-05", criadoEm: 3 });
  const y = etapa({ id: "y", nome: "Álvaro", inicio: "2026-10-07", criadoEm: 1 });
  const z = etapa({ id: "z", nome: "carta", inicio: "2026-10-05", fim: "2026-10-06", criadoEm: 2 });
  checar(
    "ordenar por inicio (e termino)",
    [x, y, z]
      .sort(compararEtapas("inicio"))
      .map((i) => i.id)
      .join() === "z,x,y",
  );
  checar(
    "ordenar por nome em pt-BR",
    [x, y, z]
      .sort(compararEtapas("nome"))
      .map((i) => i.id)
      .join() === "y,x,z",
  );
  const nova = datasDaEtapaNova([etapa({ id: "a", fim: "2026-10-09" }), etapa({ id: "b", fim: "2026-12-01", removidoEm: 1 })], HOJE);
  checar("etapa nova: depois da ultima (12/10 feriado) com 5 dias uteis", nova.inicio === "2026-10-13" && nova.fim === "2026-10-19", nova);
  const primeira = datasDaEtapaNova([], HOJE);
  checar("etapa nova sem etapas: hoje + 5 dias uteis", primeira.inicio === HOJE && primeira.fim === "2026-10-13", primeira);
  checar("etapa nova num sabado comeca na terca 13/10", datasDaEtapaNova([], "2026-10-10").inicio === "2026-10-13");
  checar(
    "ordenar por cadastro",
    [x, y, z]
      .sort(compararEtapas("cadastro"))
      .map((i) => i.id)
      .join() === "y,z,x",
  );

  secao("projetos: historico de alteracoes");
  const apoio = {
    nomeDaFase: (id: string) => ({ f1: "Instrução", f2: "Deliberação" })[id],
    nomeDaEtapa: (id: string) => ({ a: "Nota" })[id],
  };
  const antes = etapa({ id: "e", nome: "AIR", fim: "2026-10-09", fase: "f1", progresso: 10 });
  const depois = {
    ...antes,
    nome: "Relatório de AIR",
    fim: "2026-10-16",
    fase: "f2",
    progresso: 40,
    dependeDe: ["a"],
    responsavel: { nome: "Carla Dias" },
    processo: { protocolo: "50300.000001/2026-11", sigiloso: true },
    documento: { numero: "1234567" },
    concluidaEm: HOJE,
  };
  const regs = registrosDeEtapa(antes, depois, apoio);
  const campos = regs.map((r) => r.campo).join();
  checar(
    "um registro por campo mudado",
    campos === "nome,fim,responsavel,conclusao,progresso,fase,dependencias,processo,documento",
    campos,
  );
  checar("fase pelo nome", regs.find((r) => r.campo === "fase")?.depois === "Deliberação");
  checar("processo sigiloso nao vaza o numero", regs.find((r) => r.campo === "processo")?.depois === "processo sigiloso");
  {
    const X = "50300.000001/2026-11";
    const comNumero = { ...antes, processo: { protocolo: X } };
    const marcado = { ...antes, processo: { protocolo: X, sigiloso: true } };
    const semNumero = { ...antes, processo: { protocolo: "", sigiloso: true } };
    const vaza = (rs: ReturnType<typeof registrosDeEtapa>) => rs.some((r) => `${r.antes ?? ""}${r.depois ?? ""}`.includes("50300"));
    checar("marcar como sigiloso o mesmo processo nao leva o numero no antes", !vaza(registrosDeEtapa(comNumero, marcado, apoio)));
    checar("vinculo que chega sigiloso e vazio nao leva o numero", !vaza(registrosDeEtapa(comNumero, semNumero, apoio)));
    checar("desmarcar o sigilo do mesmo processo nao leva o numero", !vaza(registrosDeEtapa(marcado, comNumero, apoio)));
    checar(
      "projeto: marcar como sigiloso nao leva o numero",
      !registrosDeProjeto(
        projeto({ id: "p", processo: { protocolo: X } }),
        projeto({ id: "p", processo: { protocolo: "50300000001202611", sigiloso: true } }),
      ).some((r) => `${r.antes ?? ""}${r.depois ?? ""}`.includes("50300")),
    );
    checar(
      "textosDoVinculo: processos diferentes mostram o que nao e sigiloso",
      textosDoVinculo({ protocolo: "1.1" }, { protocolo: X, sigiloso: true }).join() === "1.1,processo sigiloso",
    );
    checar("textosDoVinculo: sem sigilo, os numeros", textosDoVinculo({ protocolo: "1" }, { protocolo: "2" }).join() === "1,2");
    checar(
      "textosDoVinculo: tirar o vinculo sigiloso",
      textosDoVinculo({ protocolo: X, sigiloso: true }, undefined)[0] === "processo sigiloso",
    );
    // O marcador do texto (documento de processo sigiloso sem o número): no histórico, o texto fixo, nunca vazio.
    const marcador = { ...antes, documento: { numero: "", sigiloso: true } };
    const doDoc = (a: typeof antes, d: typeof antes) => registrosDeEtapa(a, d, apoio).find((r) => r.campo === "documento");
    checar(
      "documento: do marcador para um numero, o antes e 'documento de processo sigiloso'",
      doDoc(marcador, { ...antes, documento: { numero: "555" } })?.antes === "documento de processo sigiloso",
      doDoc(marcador, { ...antes, documento: { numero: "555" } }),
    );
    checar(
      "documento: tirar o marcador registra o texto fixo no antes",
      doDoc(marcador, { ...antes, documento: undefined })?.antes === "documento de processo sigiloso",
    );
    checar(
      "documento: numero vazio sem a marca e como sem documento (nenhum registro)",
      doDoc({ ...antes, documento: undefined }, { ...antes, documento: { numero: "" } }) === undefined,
    );
  }
  checar("dependencias pelos nomes", regs.find((r) => r.campo === "dependencias")?.depois === "Nota");
  checar(
    "criacao",
    registrosDeEtapa(undefined, antes)
      .map((r) => `${r.campo}:${r.depois}`)
      .join() === "criacao:AIR",
  );
  checar(
    "exclusao",
    registrosDeEtapa(antes, { ...antes, removidoEm: 5 })
      .map((r) => r.campo)
      .join() === "exclusao",
  );
  checar(
    "restauracao",
    registrosDeEtapa({ ...antes, removidoEm: 5 }, antes)
      .map((r) => r.campo)
      .join() === "restauracao",
  );
  checar("nada mudou, nada registrado", registrosDeEtapa(antes, { ...antes, atualizadoEm: 9 }).length === 0);
  checar(
    "progresso fora do manual nao registra",
    registrosDeEtapa({ ...antes, medida: "tempo" }, { ...antes, medida: "tempo", progresso: 90 }).length === 0,
  );
  checar(
    "redefinir plano original registra a base",
    registrosDeEtapa(
      { ...antes, base: { inicio: "2026-10-05", fim: "2026-10-07" } },
      { ...antes, base: { inicio: "2026-10-05", fim: "2026-10-09" } },
    )
      .map((r) => r.campo)
      .join() === "base",
  );
  checar(
    "arquivar projeto",
    registrosDeProjeto(projeto({ id: "p" }), projeto({ id: "p", arquivadoEm: 5 }))
      .map((r) => `${r.campo}:${r.depois}`)
      .join() === "arquivamento:arquivado",
  );
  checar(
    "renomear fase",
    registrosDeFase(fase({ id: "f", nome: "A" }), fase({ id: "f", nome: "B" }))
      .map((r) => r.depois)
      .join() === "B",
  );
  let n = 0;
  const carimbados = carimbarRegistros(regs.slice(0, 2), C, () => `r${++n}`);
  checar(
    "carimbar: id, quando, por e nome",
    carimbados[0]?.id === "r1" && carimbados[0]?.quando === 1_000 && carimbados[0]?.por === "ana" && carimbados[0]?.nome === "Ana Lima",
  );
  const muitos: Registro[] = Array.from({ length: 5 }, (_, i) => ({ ...carimbados[0]!, id: `h${i}`, quando: i }));
  checar("excedentes: os mais antigos saem", excedentes(muitos, 3).sort().join() === "h0,h1");
  checar("excedentes dentro do limite: nada", excedentes(muitos, 5).length === 0);
}
