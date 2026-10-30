import { areaMemoria } from "@comum/armazenamento/area";
import { linhasDoProjeto } from "../src/gantt/linhas";
import { LIMITES } from "../src/modelo/constantes";
import { ErroValidacao } from "../src/modelo/validacao";
import { ESCOPO_EU, novoRepo, RELOGIO_INICIAL } from "./apoioRepositorio";
import { HOJE } from "./fabrica";
import { checar, lanca, secao } from "./util";

const mensagens = (e: unknown) => (e instanceof ErroValidacao ? e.mensagens.join(" | ") : String(e));

export async function verificarRepositorio(): Promise<void> {
  secao("projetos: repositorio - projetos");
  const { repo, area } = novoRepo();
  const p = await repo.criarProjeto({ nome: "  Revisão da Resolução  ", etiquetas: ["Normativo"] });
  checar("chave por escopo e tipo", Object.keys(await area.obter(null)).includes(`projetos/sei.x.gov.br|ana|u:110/un/p/${p.id}`));
  checar("nome limpo e alteradoPor", p.nome === "Revisão da Resolução" && p.alteradoPor === "ana");
  const erroNome = await lanca(() => repo.criarProjeto({ nome: " " }));
  checar("projeto sem nome e recusado", mensagens(erroNome) === "Informe o nome do projeto.");
  const ed = await repo.editarProjeto(p.id, { nome: "Revisão 5.432", processo: { protocolo: "50300.001234/2026-11" } });
  checar("editar projeto", ed.nome === "Revisão 5.432" && ed.processo?.protocolo === "50300.001234/2026-11");
  checar("arquivar", (await repo.arquivarProjeto(p.id)).arquivadoEm !== undefined);
  checar("reativar", (await repo.reativarProjeto(p.id)).arquivadoEm === undefined);

  secao("projetos: repositorio - fases e etapas");
  const f1 = await repo.criarFase(p.id, "Instrução");
  checar("criarFase reusa a de mesmo nome (sem acento/caixa)", (await repo.criarFase(p.id, " instrucao ")).id === f1.id);
  const e1 = await repo.criarEtapa({ projeto: p.id, nome: "Nota técnica", inicio: "2026-10-07", fim: "2026-10-09", fase: f1.id });
  const e2 = await repo.criarEtapa({ projeto: p.id, nome: "Análise", inicio: "2026-10-13", fim: "2026-10-16", dependeDe: [e1.id] });
  checar("etapas ganham ordem crescente", e1.ordem < e2.ordem);
  checar("base nasce com as datas", e1.base?.inicio === "2026-10-07" && e1.base?.fim === "2026-10-09");
  const erroCiclo = await lanca(() => repo.editarEtapa(e1.id, { dependeDe: [e2.id] }, HOJE));
  checar(
    "ciclo recusado com os nomes",
    mensagens(erroCiclo) === "Dependência circular: “Nota técnica” → “Análise” → “Nota técnica”.",
    mensagens(erroCiclo),
  );
  const erroDatas = await lanca(() => repo.editarEtapa(e1.id, { fim: "2026-10-01" }, HOJE));
  checar("termino antes do inicio recusado", mensagens(erroDatas) === "O término não pode ser antes do início.");
  const erroFase = await lanca(() => repo.criarEtapa({ projeto: p.id, nome: "x", inicio: HOJE, fim: HOJE, fase: "nao-existe" }));
  checar("fase inexistente recusada", mensagens(erroFase) === "A fase escolhida não existe mais.");
  const planejada = await repo.editarEtapa(e1.id, { inicio: "2026-10-08", fim: "2026-10-14" }, HOJE);
  checar("em planejamento a base anda junto", planejada.base?.inicio === "2026-10-08" && planejada.base?.fim === "2026-10-14");
  const comResp = await repo.editarEtapa(e1.id, { responsavel: { nome: "Carla Dias" }, observacoes: "obs" }, HOJE);
  checar("responsavel gravado", comResp.responsavel?.nome === "Carla Dias");
  const semResp = await repo.editarEtapa(e1.id, { responsavel: undefined, observacoes: "  " }, HOJE);
  checar("responsavel: undefined apaga; observacao em branco some", !("responsavel" in semResp) && !("observacoes" in semResp));
  const marco = await repo.editarEtapa(e2.id, { marco: true }, HOJE);
  checar("virar marco iguala o termino ao inicio", marco.fim === marco.inicio && marco.marco);
  const andando = await repo.editarEtapa(e1.id, { inicio: "2026-10-01", fim: "2026-10-14" }, "2026-10-07");
  const replan = await repo.editarEtapa(e1.id, { fim: "2026-10-21" }, "2026-10-07");
  checar(
    "depois de comecar a base congela",
    andando.base?.fim === "2026-10-14" && replan.base?.fim === "2026-10-14" && replan.fim === "2026-10-21",
  );
  checar(
    "redefinir plano original",
    (await repo.redefinirPlanoOriginal(p.id)) === 1 && (await repo.obterEtapa(e1.id))?.base?.fim === "2026-10-21",
  );

  secao("projetos: repositorio - concluir, arrastar, remover");
  const conc = await repo.concluirEtapa(e1.id, HOJE, { numero: "1234567" });
  checar("concluir com data de hoje e documento", conc.concluidaEm === HOJE && conc.documento?.numero === "1234567");
  checar("reabrir", (await repo.reabrirEtapa(e1.id)).concluidaEm === undefined);
  const e3 = await repo.criarEtapa({ projeto: p.id, nome: "Minuta", inicio: "2026-11-02", fim: "2026-11-06", dependeDe: [e1.id] });
  const movidas = await repo.moverDatas([{ id: e3.id, inicio: "2026-11-09", fim: "2026-11-13" }], HOJE);
  checar("moverDatas grava e leva a base (planejamento)", movidas[0]?.inicio === "2026-11-09" && movidas[0]?.base?.inicio === "2026-11-09");
  const erroArraste = await lanca(() => repo.moverDatas([{ id: e3.id, inicio: "2026-09-01", fim: "2026-09-05" }], HOJE));
  checar("arraste para antes da dependencia recusado", mensagens(erroArraste).includes("não pode começar antes de “Nota técnica”"));
  checar("arraste recusado nao gravou", (await repo.obterEtapa(e3.id))?.inicio === "2026-11-09");
  const marcoArr = await repo.moverDatas([{ id: e2.id, inicio: "2026-10-20", fim: "2026-10-22" }], HOJE);
  checar("arrastar marco mantem uma data so", marcoArr[0]?.fim === "2026-10-20");
  await repo.removerEtapa(e3.id);
  checar("remover etapa grava lapide (sai dos dados)", !(await repo.dados()).etapas.some((e) => e.id === e3.id));
  checar("restaurar etapa", (await repo.restaurarEtapa(e3.id))?.removidoEm === undefined);
  await repo.removerFase(f1.id);
  checar("remover fase deixa a etapa sem fase", (await repo.obterEtapa(e1.id))?.fase === undefined);
  await repo.removerProjeto(p.id);
  const d0 = await repo.dados();
  checar("remover projeto leva fases e etapas", !d0.projetos.length && !d0.etapas.length);
  await repo.restaurarProjeto(p.id);
  const d1 = await repo.dados();
  checar("desfazer devolve projeto e etapas removidas junto", d1.projetos.length === 1 && d1.etapas.length === 3, d1.etapas.length);
  checar("etapa removida antes nao volta junto", (await repo.etapas.obter(e3.id))?.removidoEm === undefined);

  secao("projetos: repositorio - duplicar e historico");
  const dup = await repo.duplicarProjeto(p.id);
  const dd = await repo.dados();
  const copias = dd.etapas.filter((e) => e.projeto === dup.id);
  checar("duplicar: nome e quantidade de etapas", dup.nome === "Cópia de Revisão 5.432" && copias.length === 3);
  const minuta = copias.find((e) => e.nome === "Minuta");
  const nota = copias.find((e) => e.nome === "Nota técnica");
  checar("duplicar remapeia dependencias", !!nota && minuta?.dependeDe.join() === nota.id);
  checar(
    "duplicar recomeca a execucao",
    copias.every((e) => !e.concluidaEm && !e.documento),
  );
  const hist = await repo.historico(p.id);
  checar("historico do projeto em ordem decrescente", hist.length > 5 && hist[0]!.quando >= hist[hist.length - 1]!.quando);
  checar(
    "historico tem por e nome",
    hist.every((r) => r.por === "ana" && r.nome === "Ana Lima"),
  );
  checar(
    "historico registra a conclusao",
    hist.some((r) => r.campo === "conclusao" && r.depois === HOJE),
  );

  secao("projetos: repositorio - limites");
  const { repo: cheio } = novoRepo(ESCOPO_EU, areaMemoria());
  for (let i = 0; i < LIMITES.projetosAtivos; i++) await cheio.criarProjeto({ nome: `P${i}` });
  const erroLimite = await lanca(() => cheio.criarProjeto({ nome: "mais um" }));
  checar("101o projeto ativo recusado", mensagens(erroLimite) === "Limite de 100 projetos ativos em “Só eu”. Arquive ou exclua algum.");
  const primeiro = (await cheio.dados()).projetos[0]!;
  await cheio.arquivarProjeto(primeiro.id);
  checar("arquivado libera vaga", (await cheio.criarProjeto({ nome: "agora cabe" })).nome === "agora cabe");
  checar("reativar sem vaga e recusado", mensagens(await lanca(() => cheio.reativarProjeto(primeiro.id))).startsWith("Limite de 100"));
  const { repo: r2 } = novoRepo();
  const pp = await r2.criarProjeto({ nome: "Grande" });
  for (let i = 0; i < LIMITES.etapasPorProjeto; i++)
    await r2.etapas.gravar(`x${i}`, {
      id: `x${i}`,
      projeto: pp.id,
      ordem: "a0",
      nome: "x",
      inicio: HOJE,
      fim: HOJE,
      marco: false,
      dependeDe: [],
      medida: "manual",
      progresso: 0,
      checklist: [],
      etiquetas: [],
      criadoEm: 1,
      atualizadoEm: 1,
      dispositivo: "d",
    });
  checar(
    "301a etapa recusada",
    mensagens(await lanca(() => r2.criarEtapa({ projeto: pp.id, nome: "y", inicio: HOJE, fim: HOJE }))) ===
      "Um projeto pode ter até 300 etapas.",
  );
  const { repo: r3 } = novoRepo();
  const p3 = await r3.criarProjeto({ nome: "Hist" });
  for (let i = 0; i < 310; i++) await r3.editarProjeto(p3.id, { nome: `Hist ${i}` });
  checar("historico podado em 300 registros", (await r3.historico()).length === LIMITES.historico);

  secao("projetos: repositorio - dependencia de etapa removida e fase morta");
  {
    const { repo: r } = novoRepo();
    const pr = await r.criarProjeto({ nome: "R" });
    const a = await r.criarEtapa({ projeto: pr.id, nome: "A", inicio: "2026-10-07", fim: "2026-10-08" });
    const b = await r.criarEtapa({ projeto: pr.id, nome: "B", inicio: "2026-10-09", fim: "2026-10-10", dependeDe: [a.id] });
    await r.removerEtapa(a.id);
    const ren = await r.editarEtapa(b.id, { nome: "B2" }, HOJE);
    checar("dependente de etapa removida continua editavel e mantem o id", ren.nome === "B2" && ren.dependeDe.join() === a.id);
    const mantem = await r.editarEtapa(b.id, { dependeDe: [a.id] }, HOJE);
    checar("id ja salvo (removido) pode ser reenviado", mantem.dependeDe.join() === a.id);
    const novoRuim = await lanca(() => r.editarEtapa(b.id, { dependeDe: [a.id, "zzz"] }, HOJE));
    checar(
      "id novo inexistente continua recusado",
      mensagens(novoRuim) === "Uma etapa só pode depender de etapas do mesmo projeto.",
      mensagens(novoRuim),
    );
    await r.restaurarEtapa(a.id);
    const ciclo = await lanca(() => r.editarEtapa(a.id, { dependeDe: [b.id] }, HOJE));
    checar(
      "restaurada, a dependencia volta a valer (ciclo recusado)",
      mensagens(ciclo).startsWith("Dependência circular"),
      mensagens(ciclo),
    );

    const fa = await r.criarFase(pr.id, "Fase");
    const c = await r.criarEtapa({ projeto: pr.id, nome: "C", inicio: "2026-10-12", fim: "2026-10-13", fase: fa.id });
    await r.removerEtapa(c.id);
    await r.removerFase(fa.id);
    const volta = await r.restaurarEtapa(c.id);
    checar("restaurar etapa com fase morta limpa a fase", volta !== undefined && !("fase" in volta));
    const edC = await r.editarEtapa(c.id, { nome: "C2" }, HOJE);
    checar("etapa que apontava para fase morta e editavel", edC.nome === "C2" && edC.fase === undefined);
    const faseMorta = await lanca(() => r.editarEtapa(c.id, { fase: fa.id }, HOJE));
    checar("escolher fase morta continua recusado", mensagens(faseMorta) === "A fase escolhida não existe mais.");

    const d1 = await r.criarEtapa({ projeto: pr.id, nome: "D", inicio: "2026-10-14", fim: "2026-10-15" });
    await r.removerEtapa(d1.id);
    await r.removerProjeto(pr.id);
    const semProjeto = await lanca(() => r.restaurarEtapa(d1.id));
    checar("restaurar etapa de projeto removido e recusado", mensagens(semProjeto) === "O projeto não existe mais.", mensagens(semProjeto));
    await r.etapas.gravar(d1.id, { ...d1, removidoEm: undefined });
    const vivos = await r.dados();
    checar("dados omite etapas e fases de projeto removido", !vivos.projetos.length && !vivos.etapas.length && !vivos.fases.length);
  }

  secao("projetos: repositorio - uma gravacao e um aviso por operacao");
  {
    const memoria = areaMemoria();
    let gravacoes = 0;
    const area = {
      ...memoria,
      gravar: async (i: Record<string, unknown>) => {
        gravacoes++;
        return memoria.gravar(i);
      },
    };
    const { repo: r } = novoRepo(undefined, area);
    let avisos = 0;
    r.aoMudar(() => avisos++);
    const operacao = async (nome: string, f: () => Promise<unknown>) => {
      gravacoes = 0;
      avisos = 0;
      await f();
      checar(`${nome}: 1 gravacao e 1 aviso`, gravacoes === 1 && avisos === 1, `${gravacoes} gravacoes, ${avisos} avisos`);
    };
    let pj = await r.criarProjeto({ nome: "Atomico" });
    await operacao("criarProjeto", async () => {
      pj = await r.criarProjeto({ nome: "Outro" });
    });
    const fz = await r.criarFase(pj.id, "F");
    const ea = await r.criarEtapa({ projeto: pj.id, nome: "A", inicio: "2026-10-07", fim: "2026-10-08", fase: fz.id });
    await r.criarEtapa({ projeto: pj.id, nome: "B", inicio: "2026-10-09", fim: "2026-10-10", dependeDe: [ea.id] });
    await operacao("editarEtapa com historico", () => r.editarEtapa(ea.id, { nome: "A2", progresso: 10, medida: "manual" }, HOJE));
    await operacao("removerProjeto", () => r.removerProjeto(pj.id));
    await operacao("restaurarProjeto", () => r.restaurarProjeto(pj.id));
    await operacao("duplicarProjeto", () => r.duplicarProjeto(pj.id));
    await operacao("removerFase", () => r.removerFase(fz.id));
    await operacao("redefinirPlanoOriginal", async () => {
      await r.editarEtapa(ea.id, { inicio: "2026-10-01", fim: "2026-10-14" }, "2026-10-07");
      gravacoes = 0;
      avisos = 0;
      await r.editarEtapa(ea.id, { fim: "2026-10-21" }, "2026-10-07");
      gravacoes = 0;
      avisos = 0;
      await r.redefinirPlanoOriginal(pj.id);
    });
  }

  secao("projetos: repositorio - undefined so apaga campo opcional");
  {
    const { repo: r } = novoRepo();
    const pr = await r.criarProjeto({ nome: "U", etiquetas: ["x"] });
    const e = await r.criarEtapa({ projeto: pr.id, nome: "E", inicio: "2026-10-07", fim: "2026-10-08", medida: "checklist" });
    const e2 = await r.editarEtapa(e.id, { medida: undefined, nome: undefined, dependeDe: undefined, etiquetas: undefined } as never, HOJE);
    checar(
      "etapa: undefined em campo obrigatorio e ignorado",
      e2.medida === "checklist" && e2.nome === "E" && Array.isArray(e2.dependeDe) && Array.isArray(e2.etiquetas),
    );
    const p2 = await r.editarProjeto(pr.id, { nome: undefined, etiquetas: undefined } as never);
    checar("projeto: undefined em campo obrigatorio e ignorado", p2.nome === "U" && p2.etiquetas.join() === "x");
  }

  secao("projetos: repositorio - arraste confere as sucessoras");
  {
    const { repo: r } = novoRepo();
    const pr = await r.criarProjeto({ nome: "P" });
    const a = await r.criarEtapa({ projeto: pr.id, nome: "A", inicio: "2026-10-12", fim: "2026-10-16" });
    const b = await r.criarEtapa({ projeto: pr.id, nome: "B", inicio: "2026-10-19", fim: "2026-10-23", dependeDe: [a.id] });
    const pulou = await lanca(() => r.moverDatas([{ id: a.id, inicio: "2026-10-26", fim: "2026-10-30" }], HOJE));
    checar(
      "A arrastada por cima de B (sem mover dependentes) e recusada",
      mensagens(pulou) === "“B” não pode começar antes de “A”, da qual depende.",
      mensagens(pulou),
    );
    checar("recusa nao gravou A", (await r.obterEtapa(a.id))?.inicio === "2026-10-12");
    const b2 = await r.editarEtapa(b.id, { inicio: "2026-10-09", fim: "2026-10-20" }, HOJE);
    checar("o dialogo deixa B comecar antes de A", b2.inicio === "2026-10-09");
    const juntas = await lanca(() =>
      r.moverDatas(
        [
          { id: a.id, inicio: "2026-10-15", fim: "2026-10-19" },
          { id: b.id, inicio: "2026-10-12", fim: "2026-10-23" },
        ],
        HOJE,
      ),
    );
    checar("arrastar A +3 com B junto (violacao antiga) e aceito", juntas === null, mensagens(juntas));
  }

  secao("projetos: repositorio - moverDatas recusa data impossivel e etapa de decadas");
  {
    const { repo: r } = novoRepo();
    const pr = await r.criarProjeto({ nome: "P" });
    const f = await r.criarFase(pr.id, "F");
    const a = await r.criarEtapa({ projeto: pr.id, nome: "A", inicio: "2026-10-12", fim: "2026-10-16", fase: f.id, medida: "tempo" });
    const impossivel = await lanca(() => r.moverDatas([{ id: a.id, inicio: "2026-13-45", fim: "2026-13-46" }], HOJE));
    checar("2026-13-45 recusada", mensagens(impossivel) === "Datas inválidas para “A”.", mensagens(impossivel));
    checar("nada gravado", (await r.obterEtapa(a.id))?.inicio === "2026-10-12");
    const vinte = await lanca(() => r.moverDatas([{ id: a.id, inicio: "2026-10-12", fim: "2046-10-12" }], HOJE));
    checar("etapa de 20 anos recusada", mensagens(vinte) === "“A” pode durar no máximo cerca de 10 anos.", mensagens(vinte));
    const fora = await lanca(() => r.moverDatas([{ id: a.id, inicio: "2101-01-03", fim: "2101-01-05" }], HOJE));
    checar("ano 2101 recusado", mensagens(fora) === "“A” só pode ter datas entre 2000 e 2100.", mensagens(fora));
    // Data impossível que já estava gravada (versão antiga, gravação direta): as linhas não lançam.
    await r.etapas.gravar(a.id, { ...(await r.etapas.obter(a.id))!, inicio: "2026-13-45", fim: "2026-13-46" });
    const d = await r.dados();
    let linhas: ReturnType<typeof linhasDoProjeto> = [];
    const erro = await lanca(() => {
      linhas = linhasDoProjeto(
        { projeto: pr.id, fases: d.fases, etapas: d.etapas },
        { hoje: HOJE, ordem: "inicio", recolhidas: new Set() },
      );
    });
    checar("linhasDoProjeto com data impossivel gravada (fase, medida tempo) nao lanca", erro === null, erro?.message);
    const linhaFase = linhas.find((l) => l.tipo === "fase");
    checar(
      "fase com data impossivel ancora em datas validas",
      linhaFase?.tipo === "fase" && linhaFase.inicio === HOJE && linhaFase.fim === HOJE,
      linhaFase,
    );
  }

  secao("projetos: repositorio - ciclo vindo da mescla nao trava outra etapa");
  {
    const { repo: r } = novoRepo();
    const pr = await r.criarProjeto({ nome: "P" });
    const x = await r.criarEtapa({ projeto: pr.id, nome: "X", inicio: "2026-10-13", fim: "2026-10-16" });
    const y = await r.criarEtapa({ projeto: pr.id, nome: "Y", inicio: "2026-10-13", fim: "2026-10-16" });
    const z = await r.criarEtapa({ projeto: pr.id, nome: "Z", inicio: "2026-10-13", fim: "2026-10-16" });
    await r.editarEtapa(x.id, { dependeDe: [y.id] }, HOJE);
    // Uma versão de outro computador, mais nova que a daqui (o relógio de teste começa em 2026).
    await r.importar({
      e: [{ ...(await r.obterEtapa(y.id))!, dependeDe: [x.id], atualizadoEm: RELOGIO_INICIAL + 99_999, dispositivo: "dev-b" }],
    });
    const ren = await lanca(() => r.editarEtapa(z.id, { nome: "Z renomeada" }, HOJE));
    checar("renomear Z (sem relacao com o ciclo) passa", ren === null, mensagens(ren));
    const emX = await lanca(() => r.editarEtapa(x.id, { nome: "X2" }, HOJE));
    checar("editar X (no ciclo) mostra o ciclo", mensagens(emX).startsWith("Dependência circular: “X” → “Y”"), mensagens(emX));
    checar("tirar a dependencia desfaz o ciclo", (await r.editarEtapa(x.id, { dependeDe: [] }, HOJE)).dependeDe.length === 0);
  }

  secao("projetos: repositorio - linha de base no segundo replanejamento");
  {
    const { repo: r } = novoRepo();
    const pr = await r.criarProjeto({ nome: "P" });
    const e = await r.criarEtapa({ projeto: pr.id, nome: "E", inicio: "2026-10-01", fim: "2026-10-09" });
    const e1 = await r.editarEtapa(e.id, { inicio: "2026-10-20", fim: "2026-10-28" }, "2026-10-06");
    const e2 = await r.editarEtapa(e.id, { fim: "2026-10-30" }, "2026-10-07");
    checar(
      "a base continua 01/10 a 09/10 depois da segunda edicao",
      e1.base?.inicio === "2026-10-01" && e2.base?.inicio === "2026-10-01" && e2.base?.fim === "2026-10-09",
      e2.base,
    );
    const m = await r.moverDatas([{ id: e.id, inicio: "2026-10-21", fim: "2026-10-30" }], "2026-10-08");
    checar("arrastar depois tambem mantem a base", m[0]?.base?.inicio === "2026-10-01", m[0]?.base);
  }
}
