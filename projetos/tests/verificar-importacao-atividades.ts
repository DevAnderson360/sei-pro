/**
 * Importar do servidor do Atividades (spec 6.3): o mapeamento campo a campo,
 * a idempotência pelos ids (reimportar atualiza só o que ninguém mexeu, não
 * duplica, não ressuscita o excluído), o escopo onde o projeto já está, e o
 * diálogo. O servidor é de FORA: tamanhos, tipos errados, datas impossíveis,
 * ids repetidos, dependência circular e HTML nos nomes; o teto de projetos e de
 * etapas recusa o projeto inteiro (nada fica órfão); o sigilo marcado aqui não
 * se perde na reimportação; o "Entendi" da unidade vale para a importação.
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { jsonEstavel } from "@comum/sincronia/assinatura";
import type { AbrirModal } from "@comum/ui/dialogo";
import { comConsentimento, MENSAGEM_SEM_ENTENDI } from "../src/app/colaboracao/consentir";
import { abrirImportarAtividades, mensagemDaImportacao } from "../src/app/dialogos/importar";
import {
  DISPOSITIVO_ATIVIDADES,
  diaLegado,
  idDoLegado,
  importarAtividades,
  itensParaImportar,
  legadosExcluidos,
  legadosImportados,
  mapearProjeto,
  projetosLegados,
} from "../src/importacao/atividades";
import { LIMITE_DIAS_ETAPA } from "../src/modelo/calendario";
import { LIMITES } from "../src/modelo/constantes";
import { encontrarCiclo } from "../src/modelo/dependencias";
import type { Entidades } from "../src/modelo/tipos";
import { ErroValidacao } from "../src/modelo/validacao";
import { chaveProtocolo } from "../src/modelo/vinculos";
import { entidadeValida, moverEntreEscopos } from "../src/repositorio";
import { paraOTexto } from "../src/sincronia/textoPadrao";
import { marcar, telaDoApp, texto } from "./apoioApp";
import { ESCOPO_EU, ESCOPO_UN, novoRepo } from "./apoioRepositorio";
import { HOSTIL } from "./cenarioGantt";
import { HOJE, projeto } from "./fabrica";
import { etapaLegada, projetoCompleto, projetoLegado, SENTINELA } from "./legadoAtividades";
import { botao, checar, lanca, secao, tique } from "./util";

const C = { agora: Date.UTC(2026, 9, 6, 12), dispositivo: "pc-ana", por: "ana", nome: "Ana" };

/** Todas as entidades passam na validação da sincronia (a mesma do `importar`). */
function todasValidas(m: Pick<Entidades, "p" | "f" | "e">, agora?: number): boolean {
  return [
    ...m.p.map((x) => entidadeValida(x, "p", agora)),
    ...m.f.map((x) => entidadeValida(x, "f", agora)),
    ...m.e.map((x) => entidadeValida(x, "e", agora)),
  ].every(Boolean);
}

/** O projeto completo com etapas a mais no servidor. */
function completoCom(...extras: Record<string, unknown>[]) {
  const p = projetoCompleto();
  return projetosLegados([{ ...p, etapas: [...(p.etapas as unknown[]), ...extras] }]);
}

/** O texto que iria ao Texto Padrão deste escopo agora (o corte com a memória do sigilo, como o adaptador). */
async function textoDoEscopo(repo: ReturnType<typeof novoRepo>["repo"]): Promise<string> {
  const { envelope, conhecidos } = await repo.exportarComConhecidos(C.agora);
  return JSON.stringify(paraOTexto(envelope, C.agora, conhecidos));
}

export async function verificarImportacaoAtividades(): Promise<void> {
  secao("atividades: forma dos dados do servidor");
  const lista = projetosLegados([
    projetoCompleto(),
    { id_projeto: "x" },
    null,
    projetoLegado({ id_projeto: 43, etapas: [{ id_etapa: "nada" }] }),
  ]);
  checar("so os projetos com id numerico; etapa sem id sai", lista.length === 2 && lista[1]?.etapas.length === 0, lista.length);
  checar(
    "data sentinela e vazia",
    diaLegado(SENTINELA) === undefined && diaLegado("2026-03-02 00:00:00") === "2026-03-02" && diaLegado(false) === undefined,
  );
  checar("ano fora do calendario e vazio", diaLegado("1999-12-31 00:00:00") === undefined);
  checar(
    "data impossivel, lixo depois da data ou numero: vazia",
    diaLegado("2026-02-30 00:00:00") === undefined &&
      diaLegado("2026-13-01") === undefined &&
      diaLegado("2026-03-02<b>") === undefined &&
      diaLegado(1772420400000) === undefined,
  );
  checar("lista que nao e lista: nenhum projeto", projetosLegados({ projetos: [projetoCompleto()] }).length === 0);
  const repetidos = projetosLegados([
    projetoLegado({ id_projeto: 60, etapas: [etapaLegada({ id_etapa: 70 })] }),
    projetoLegado({ id_projeto: "60", nome_projeto: "Outro com o mesmo id" }),
    projetoLegado({ id_projeto: 61, etapas: [etapaLegada({ id_etapa: 70 }), etapaLegada({ id_etapa: "75" })] }),
  ]);
  checar(
    "id em texto vale (o PDO devolve texto); projeto repetido: fica o primeiro; etapa repetida noutro projeto sai",
    repetidos.length === 2 && repetidos[0]?.nome_projeto === "Projeto 60" && repetidos[1]?.etapas.map((e) => e.id_etapa).join() === "75",
    repetidos.map((p) => [p.id_projeto, p.nome_projeto, p.etapas.map((e) => e.id_etapa)]),
  );
  checar(
    "mais de 1000 projetos: so os 1000 primeiros",
    projetosLegados(Array.from({ length: 1005 }, (_, i) => projetoLegado({ id_projeto: i + 1 }))).length === 1000,
  );

  secao("atividades: o mapeamento da spec 6.3");
  const m = mapearProjeto(lista[0]!, C, HOJE, "a0");
  const p = m.p[0]!;
  checar(
    "projeto: nome, processo, tipo como etiqueta e origem",
    p.id === "atvp42" &&
      p.nome === "Revisão da Resolução 1" &&
      p.processo?.protocolo === "50300.000123/2026-01" &&
      p.processo?.idProcedimento === "9911" &&
      p.etiquetas.join() === "Normativo" &&
      p.origem?.atividades === 42 &&
      p.arquivadoEm === undefined,
    p,
  );
  checar(
    "o legado nao diz se o processo e sigiloso: entra sem a marca (o usuario marca pela caixa)",
    p.processo?.sigiloso === undefined && m.e.every((e) => e.processo?.sigiloso === undefined),
  );
  const [e1, e2, e3] = [m.e.find((e) => e.id === "atve1")!, m.e.find((e) => e.id === "atve2")!, m.e.find((e) => e.id === "atve3")!];
  checar(
    "executada: inicio e termino da execucao, programado como base, concluida",
    e1.inicio === "2026-03-03" &&
      e1.fim === "2026-03-12" &&
      e1.base?.inicio === "2026-03-02" &&
      e1.base?.fim === "2026-03-13" &&
      e1.concluidaEm === "2026-03-12",
    e1,
  );
  checar("progresso manual do legado", e1.medida === "manual" && e1.progresso === 100);
  checar(
    "macroetapa vira fase (criada pelo nome, uma so para o mesmo nome)",
    m.f.length === 2 && e1.fase === e3.fase && e1.fase === idDoLegado.fase(42, "Instrução"),
    m.f,
  );
  checar("grupo e etiqueta viram etiquetas", e1.etiquetas.join() === "Jurídico,urgente,revisão", e1.etiquetas);
  checar(
    "responsavel, observacoes e documento",
    e1.responsavel?.nome === "Ana Lima" &&
      e1.observacoes === "Ver parecer" &&
      e1.documento?.numero === "1234567" &&
      e1.documento.titulo === "Nota Técnica 5",
  );
  checar(
    "demandas viram checklist (feito com data de entrega)",
    e1.checklist.length === 2 &&
      e1.checklist[0]?.texto === "Demanda: Elaborar minuta" &&
      e1.checklist[0].feito &&
      !e1.checklist[1]?.feito &&
      e1.checklist[1]?.texto === "Demanda: Revisar",
    e1.checklist,
  );
  checar("dependencia dentro do projeto", e2.dependeDe.join() === "atve1");
  checar("dependencia para fora do projeto sai", e3.dependeDe.length === 0);
  checar("periodo de progresso automatico vira medida pelo tempo", e2.medida === "tempo");
  checar("processo da etapa", e2.processo?.protocolo === "50300.000777/2026-02");
  checar("etapa sem datas: o dia do projeto", e3.inicio === "2026-02-20" && e3.fim === "2026-02-20");
  checar("tudo passa na validacao da sincronia", todasValidas(m, C.agora));
  checar(
    "o dispositivo marca o que veio do Atividades",
    m.e.every((e) => e.dispositivo === DISPOSITIVO_ATIVIDADES),
  );
  const arq = mapearProjeto(
    projetosLegados([projetoLegado({ id_projeto: 50, data_fim: "2025-12-31 23:59:59", ativo: false })])[0]!,
    C,
    HOJE,
    "a0",
  );
  checar("data_fim preenchida e passada: arquivado", typeof arq.p[0]?.arquivadoEm === "number");
  const vigente = mapearProjeto(
    projetosLegados([projetoLegado({ id_projeto: 53, data_fim: "2030-12-31 23:59:59", ativo: true })])[0]!,
    C,
    HOJE,
    "a0",
  );
  checar("data_fim no futuro e ativo (o legado diz vigente): nao arquivado", vigente.p[0]?.arquivadoEm === undefined);
  const torta = mapearProjeto(
    projetosLegados([
      projetoLegado({
        id_projeto: 51,
        nome_projeto: HOSTIL,
        etapas: [etapaLegada({ id_etapa: 9, data_inicio_programado: "2026-05-10 00:00:00", data_fim_programado: "2026-05-01 00:00:00" })],
      }),
    ])[0]!,
    C,
    HOJE,
    "a0",
  );
  checar(
    "termino antes do inicio no legado: corrigido para o mesmo dia",
    torta.e[0]?.fim === "2026-05-10" && entidadeValida(torta.e[0], "e"),
  );
  checar("nome hostil fica como texto (dado)", torta.p[0]?.nome === HOSTIL);
  const sujo = mapearProjeto(
    projetosLegados([
      projetoLegado({
        id_projeto: 52,
        processo_sei: "SEI 50300.000123/2026-01",
        etapas: [etapaLegada({ id_etapa: 10, documento_sei: "nº 1234567", processo_sei: "sem numero" })],
      }),
    ])[0]!,
    C,
    HOJE,
    "a0",
  );
  checar(
    "so o numero passa: processo e documento limpos, processo sem numero sai",
    sujo.p[0]?.processo?.protocolo === "50300.000123/2026-01" &&
      sujo.e[0]?.documento?.numero === "1234567" &&
      sujo.e[0]?.processo === undefined &&
      entidadeValida(sujo.p[0], "p") &&
      entidadeValida(sujo.e[0], "e"),
    sujo,
  );
  const itens = itensParaImportar(
    [...lista, ...projetosLegados([projetoLegado({ id_projeto: 50, data_fim: "2025-12-31 23:59:59", ativo: false })])],
    C.agora,
  );
  checar(
    "itens do dialogo: nome, unidade, etapas, arquivado",
    itens[0]?.etapas === 3 && itens[0].unidade === "SEPRO" && itens.at(-1)?.arquivado === true,
    itens,
  );

  secao("atividades: dado de fora (tamanhos, tipos errados, datas impossiveis, numeros ambiguos)");
  const nul = String.fromCharCode(0);
  const hostil = projetosLegados([
    projetoLegado({
      id_projeto: "70",
      nome_projeto: "x".repeat(5000),
      tipo_projeto: { nome: "objeto no lugar do texto" },
      processo_sei: "SEI-150016/000123/2021",
      id_procedimento: "12<script>",
      sigla_unidade: "S".repeat(500),
      etapas: [
        etapaLegada({
          id_etapa: "71",
          nome_etapa: `Antes${nul}Depois`,
          observacoes: `linha 1\r\nlinha 2${"y".repeat(10_000)}`,
          etiqueta: Array.from({ length: 15 }, (_, i) => `e${i}`).join(";"),
          grupo: "g".repeat(100),
          responsavel: ["Ana"],
          progresso_execucao: "abc",
          data_inicio_programado: "2026-02-30 00:00:00",
          data_fim_programado: "2046-01-01 00:00:00",
          documento_sei: "1234567 e 7654321",
          processo_sei: "50300.000001/2026-01 50300.000002/2026-02",
          id_demandas_titles: Array.from({ length: 80 }, (_, i) => ({ id_demanda: i < 3 ? 5 : i, nome_atividade: "z".repeat(1000) })),
        }),
        etapaLegada({ id_etapa: 72, data_inicio_programado: "2026-03-02 00:00:00", data_fim_programado: "2046-03-02 00:00:00" }),
        etapaLegada({ id_etapa: 73, nome_etapa: 12345, progresso_execucao: 1e9, data_inicio_execucao: 1772420400 }),
      ],
    }),
    projetoLegado({ id_projeto: 74, nome_projeto: `${"x".repeat(199)}🙂` }),
  ]);
  const mh = mapearProjeto(hostil[0]!, C, HOJE, "a0");
  const etapaH = (id: string) => mh.e.find((e) => e.id === id);
  const h71 = etapaH("atve71");
  const h72 = etapaH("atve72");
  const h73 = etapaH("atve73");
  checar(
    "projeto: nome cortado em 200, tipo que nao e texto sai, numero com letras (SEI-RJ) inteiro, id interno torto sai",
    mh.p[0]?.id === "atvp70" &&
      mh.p[0].nome.length === LIMITES.nome &&
      mh.p[0].etiquetas.length === 0 &&
      mh.p[0].processo?.protocolo === "SEI-150016/000123/2021" &&
      mh.p[0].processo.idProcedimento === undefined,
    mh.p[0],
  );
  checar(
    "etapa: controle vira espaco, observacoes com a quebra de linha e cortadas em 2000",
    h71?.nome === "Antes Depois" &&
      h71.observacoes?.startsWith("linha 1\nlinha 2") === true &&
      h71.observacoes.length === LIMITES.observacoes,
    h71?.nome,
  );
  checar(
    "etiquetas: ate 10, cada uma ate 40",
    h71?.etiquetas.length === LIMITES.etiquetas && h71.etiquetas.every((t) => t.length <= LIMITES.etiquetaTexto),
    h71?.etiquetas,
  );
  checar(
    "tipo errado (responsavel em lista, progresso em texto): fica de fora / zero",
    !!h71 && h71.responsavel === undefined && h71.progresso === 0,
  );
  checar(
    "dois numeros de documento ou de processo no mesmo campo: nenhum (nada de numero inventado)",
    !!h71 && h71.documento === undefined && h71.processo === undefined,
  );
  checar(
    "demandas: ate 50 itens, texto ate 200, ids sem repetir",
    h71?.checklist.length === LIMITES.checklistItens &&
      h71.checklist.every((i) => i.texto.length <= LIMITES.checklistTexto) &&
      new Set(h71.checklist.map((i) => i.id)).size === h71.checklist.length,
  );
  checar(
    "mais de 50 demandas: o 50o item avisa quantas ficaram no Atividades (80 - 49 = 31)",
    h71?.checklist.at(-1)?.texto === "… e mais 31 demandas no Atividades" && h71.checklist.at(-2)?.texto.startsWith("Demanda: ") === true,
    h71?.checklist.at(-1),
  );
  const demandas = (n: number) =>
    mapearProjeto(
      projetosLegados([
        projetoLegado({
          id_projeto: 75,
          etapas: [
            etapaLegada({
              id_etapa: 76,
              id_demandas_titles: Array.from({ length: n }, (_, i) => ({ id_demanda: i + 1, nome_atividade: `D${i}` })),
            }),
          ],
        }),
      ])[0]!,
      C,
      HOJE,
      "a0",
    ).e[0]?.checklist ?? [];
  checar(
    "exatamente 50 demandas: as 50, sem aviso; 51: o ultimo diz 'mais 2'",
    demandas(50).length === 50 &&
      demandas(50).at(-1)?.texto === "Demanda: D49" &&
      demandas(51).length === 50 &&
      demandas(51).at(-1)?.texto === "… e mais 2 demandas no Atividades",
    [demandas(50).at(-1), demandas(51).at(-1)],
  );
  checar(
    "data impossivel: vale o dia do projeto; etapa de 20 anos: cortada no limite",
    h71?.inicio === "2026-02-20" &&
      h71.base !== undefined &&
      !!h72 &&
      h72.inicio === "2026-03-02" &&
      (Date.parse(h72.fim) - Date.parse(h72.inicio)) / 86_400_000 <= LIMITE_DIAS_ETAPA,
    [h71?.inicio, h72?.inicio, h72?.fim],
  );
  checar(
    "numero no nome vira texto; progresso enorme fica em 100; data em numero e vazia",
    h73?.nome === "12345" && h73.progresso === 100 && h73.inicio === "2026-03-02",
  );
  checar("tudo o que veio torto ainda passa na validacao da sincronia", todasValidas(mh, C.agora));
  const emoji = mapearProjeto(hostil[1]!, C, HOJE, "a0").p[0]!;
  const ultimo = emoji.nome.charCodeAt(emoji.nome.length - 1);
  checar(
    "corte no limite nao parte um emoji ao meio",
    emoji.nome.length <= LIMITES.nome && !(ultimo >= 0xd800 && ultimo <= 0xdbff),
    emoji.nome.length,
  );
  checar("itens do dialogo: a sigla cortada", (itensParaImportar(hostil, C.agora)[0]?.unidade.length ?? 0) <= 40);

  secao("atividades: dependencia circular e fuso do servidor");
  const ciclo = mapearProjeto(
    projetosLegados([
      projetoLegado({
        id_projeto: 80,
        etapas: [
          etapaLegada({ id_etapa: 81, id_dependencia: 82 }),
          etapaLegada({ id_etapa: 82, id_dependencia: 81 }),
          etapaLegada({ id_etapa: 83, id_dependencia: 83 }),
        ],
      }),
    ])[0]!,
    C,
    HOJE,
    "a0",
  );
  checar(
    "dependencia circular no servidor: uma seta sai; ninguem depende de si mesmo",
    encontrarCiclo(ciclo.e) === null &&
      ciclo.e.filter((e) => e.dependeDe.length).length === 1 &&
      ciclo.e.find((e) => e.id === "atve83")?.dependeDe.length === 0,
    ciclo.e.map((e) => [e.id, e.dependeDe]),
  );
  const fusoAntes = process.env.TZ;
  const emBrasilia = mapearProjeto(lista[0]!, C, HOJE, "a0");
  process.env.TZ = "America/Manaus";
  const emManaus = mapearProjeto(lista[0]!, C, HOJE, "a0");
  process.env.TZ = fusoAntes;
  checar(
    "a hora do servidor e a de Brasilia em qualquer computador: importar de Manaus da o mesmo (reimportar nao muda nada)",
    jsonEstavel(emBrasilia) === jsonEstavel(emManaus) && emBrasilia.p[0]?.criadoEm === Date.UTC(2026, 1, 20, 13),
    [emBrasilia.p[0]?.criadoEm, emManaus.p[0]?.criadoEm],
  );

  secao("atividades: importar e reimportar sem duplicar");
  const area = areaMemoria();
  const repos = { unidade: novoRepo(ESCOPO_UN, area, "u").repo, eu: novoRepo(ESCOPO_EU, area, "e").repo };
  const r1 = await importarAtividades(repos, lista, "unidade", HOJE);
  const d1 = await repos.unidade.dados();
  checar(
    "primeira vez: entram os projetos, fases e etapas",
    r1.novos === 2 && d1.projetos.length === 2 && d1.etapas.length === 3 && d1.fases.length === 2,
    r1,
  );
  checar(
    "com o registro de criacao",
    (await repos.unidade.historico("atvp42")).some((r) => r.campo === "criacao"),
  );
  checar("legadosImportados: os ids do legado dos projetos vivos", [...legadosImportados(d1.projetos)].sort().join() === "42,43");
  const r2 = await importarAtividades(repos, lista, "unidade", HOJE);
  checar(
    "reimportar igual: nada gravado, nada duplicado",
    r2.iguais === 2 && r2.novos === 0 && (await repos.unidade.dados()).etapas.length === 3,
    r2,
  );
  await repos.unidade.editarEtapa("atve1", { nome: "Minuta (revisada aqui)" }, HOJE);
  await repos.unidade.removerEtapa("atve3");
  const mudou = projetosLegados([projetoCompleto()]);
  mudou[0]!.etapas[0]!.nome_etapa = "Minuta do servidor";
  mudou[0]!.etapas[1]!.nome_etapa = "Consulta (servidor)";
  const r3 = await importarAtividades(repos, mudou, "unidade", HOJE);
  checar(
    "reimportar: atualiza o que ninguem mexeu; o editado e o excluido aqui ficam",
    r3.atualizados === 1 &&
      (await repos.unidade.obterEtapa("atve2"))?.nome === "Consulta (servidor)" &&
      (await repos.unidade.obterEtapa("atve1"))?.nome === "Minuta (revisada aqui)" &&
      (await repos.unidade.obterEtapa("atve3")) === undefined,
    r3,
  );
  const r4 = await importarAtividades(repos, lista, "eu", HOJE);
  checar(
    "pedir para 'Só eu' o que ja esta na unidade: atualiza la, sem copiar",
    r4.noOutroEscopo === 2 && (await repos.eu.dados()).projetos.length === 0,
    r4,
  );

  secao("atividades: o que foi excluido ou mexido aqui fica (projeto, fase, etapa de outro projeto, dependencia)");
  {
    const a = areaMemoria();
    const rs = { unidade: novoRepo(ESCOPO_UN, a, "u").repo, eu: novoRepo(ESCOPO_EU, a, "e").repo };
    await importarAtividades(rs, lista, "unidade", HOJE);
    await rs.unidade.removerProjeto("atvp43");
    const com43 = projetosLegados([
      projetoLegado({ id_projeto: 43, etapas: [etapaLegada({ id_etapa: 430, nome_etapa: "Nova no servidor" })] }),
    ]);
    const rx = await importarAtividades(rs, com43, "unidade", HOJE);
    const e430 = (await rs.unidade.entidades()).e.find((e) => e.id === "atve430");
    checar(
      "projeto excluido aqui: nao volta e nada dele e gravado (nem etapa nova do servidor)",
      rx.excluidosAqui === 1 && rx.novos === 0 && (await rs.unidade.obterProjeto("atvp43")) === undefined && e430 === undefined,
      rx,
    );
    {
      // A regra: vivo no destino → lá; vivo no outro → lá; lápide em QUALQUER escopo → não volta.
      const a2 = areaMemoria();
      const r2 = { unidade: novoRepo(ESCOPO_UN, a2, "u").repo, eu: novoRepo(ESCOPO_EU, a2, "e").repo };
      await importarAtividades(r2, [lista[0]!], "eu", HOJE);
      await r2.eu.removerProjeto("atvp42");
      const rv = await importarAtividades(r2, [lista[0]!], "unidade", HOJE);
      checar(
        "excluido no 'Só eu' nao volta pela 'Toda a unidade' (nem projeto, nem etapa)",
        rv.excluidosAqui === 1 &&
          rv.novos === 0 &&
          (await r2.unidade.obterProjeto("atvp42")) === undefined &&
          (await r2.unidade.entidades()).e.length === 0,
        rv,
      );
      await importarAtividades(r2, [lista[1]!], "unidade", HOJE);
      await r2.unidade.removerProjeto("atvp43");
      const rw = await importarAtividades(r2, [lista[1]!], "eu", HOJE);
      checar(
        "e o excluido na 'Toda a unidade' nao volta pelo 'Só eu'",
        rw.excluidosAqui === 1 && (await r2.eu.obterProjeto("atvp43")) === undefined,
        rw,
      );
      const movido = projetosLegados([projetoLegado({ id_projeto: 47 })]);
      await importarAtividades(r2, movido, "unidade", HOJE);
      await moverEntreEscopos(r2.unidade, r2.eu, "atvp47");
      const rm = await importarAtividades(r2, movido, "unidade", HOJE);
      checar(
        "movido para o 'Só eu' (lapide na unidade, vivo no Só eu): vale o vivo, nao e excluido",
        rm.excluidosAqui === 0 && rm.noOutroEscopo === 1 && (await r2.unidade.obterProjeto("atvp47")) === undefined,
        rm,
      );
      const todos = [...(await r2.unidade.entidades()).p, ...(await r2.eu.entidades()).p];
      checar(
        "legadosExcluidos: as lapides sem copia viva, dos dois escopos (o movido nao)",
        [...legadosExcluidos(todos)].sort().join() === "42,43",
        [...legadosExcluidos(todos)],
      );
    }
    const faseInstrucao = idDoLegado.fase(42, "Instrução");
    await rs.unidade.removerFase(faseInstrucao);
    const comNova = completoCom(etapaLegada({ id_etapa: 4, nome_etapa: "Nova da Instrução", macroetapa: "Instrução" }));
    await importarAtividades(rs, comNova, "unidade", HOJE);
    const ent = await rs.unidade.entidades();
    checar(
      "fase excluida aqui nao volta; a etapa nova do servidor entra sem fase",
      ent.f.find((f) => f.id === faseInstrucao)?.removidoEm !== undefined &&
        (await rs.unidade.obterEtapa("atve4"))?.fase === undefined &&
        (await rs.unidade.obterEtapa("atve4"))?.nome === "Nova da Instrução",
      await rs.unidade.obterEtapa("atve4"),
    );
    const rouba = projetosLegados([
      projetoLegado({ id_projeto: 44, etapas: [etapaLegada({ id_etapa: 2, nome_etapa: "Etapa 2 de outro projeto" })] }),
    ]);
    await importarAtividades(rs, rouba, "unidade", HOJE);
    checar(
      "etapa que ja e de outro projeto aqui nao muda de projeto",
      (await rs.unidade.obterEtapa("atve2"))?.projeto === "atvp42" && (await rs.unidade.obterProjeto("atvp44")) !== undefined,
    );
    // A etapa 1 passa a depender da 2 aqui; o servidor diz que a 2 depende da 1: a seta do servidor sai.
    await rs.unidade.editarEtapa("atve2", { dependeDe: [] }, HOJE);
    const e2Antes = await rs.unidade.obterEtapa("atve2");
    await rs.unidade.editarEtapa("atve1", { dependeDe: ["atve2"] }, HOJE);
    const dep = completoCom(etapaLegada({ id_etapa: 4, nome_etapa: "Nova da Instrução", macroetapa: "Instrução" }));
    // A 2 foi editada aqui (dependeDe): para provar a seta do servidor, ela volta a ser "do Atividades".
    await rs.unidade.importar({ e: [{ ...e2Antes!, dispositivo: DISPOSITIVO_ATIVIDADES, atualizadoEm: e2Antes!.atualizadoEm + 10 }] });
    const rc = await importarAtividades(rs, dep, "unidade", HOJE);
    const vivas = (await rs.unidade.dados()).etapas;
    checar(
      "dependencia do servidor que fecharia um ciclo com a edicao daqui sai",
      encontrarCiclo(vivas) === null &&
        vivas.find((e) => e.id === "atve1")?.dependeDe.join() === "atve2" &&
        vivas.find((e) => e.id === "atve2")?.dependeDe.length === 0,
      { rc, deps: vivas.map((e) => [e.id, e.dependeDe]) },
    );
    const rc2 = await importarAtividades(rs, dep, "unidade", HOJE);
    checar("e reimportar de novo nao regrava (a seta cortada nao vira 'atualizado' toda vez)", rc2.atualizados === 0, rc2);
    // A versão "do Atividades" que chegou de um computador com o relógio adiantado (dentro da folga de um dia).
    const e4 = (await rs.unidade.obterEtapa("atve4"))!;
    await rs.unidade.importar({ e: [{ ...e4, atualizadoEm: e4.atualizadoEm + 3_600_000 }] });
    const adiantado = completoCom(etapaLegada({ id_etapa: 4, nome_etapa: "Renomeada no servidor", macroetapa: "Instrução" }));
    const ra = await importarAtividades(rs, adiantado, "unidade", HOJE);
    checar(
      "por cima de uma versao do Atividades com o relogio adiantado: a nova vence (carimbo acima do dela)",
      ra.atualizados === 1 && (await rs.unidade.obterEtapa("atve4"))?.nome === "Renomeada no servidor",
      ra,
    );
  }

  secao("atividades: tetos (projeto inteiro de fora; nada orfao)");
  {
    const a = areaMemoria();
    const rs = { unidade: novoRepo(ESCOPO_UN, a, "u").repo, eu: novoRepo(ESCOPO_EU, a, "e").repo };
    const grande = projetosLegados([
      projetoLegado({
        id_projeto: 90,
        etapas: Array.from({ length: LIMITES.etapasPorProjeto + 5 }, (_, i) => etapaLegada({ id_etapa: 9000 + i })),
      }),
    ]);
    checar("mais de 300 etapas: o item do dialogo diz que nao cabe", itensParaImportar(grande, C.agora)[0]?.grande === true);
    const rg = await importarAtividades(rs, grande, "unidade", HOJE);
    const tudo = await rs.unidade.entidades();
    checar(
      "mais de 300 etapas: recusado inteiro (nem projeto, nem fase, nem etapa)",
      rg.ignorados === 1 && tudo.p.length === 0 && tudo.f.length === 0 && tudo.e.length === 0,
      rg,
    );
    checar(
      "o resultado diz o nome do que ficou de fora por ter mais de 300 etapas",
      rg.foraPorEtapas.join() === "Projeto 90" && rg.foraPorProjetos.length === 0,
      rg,
    );
    for (let i = 0; i < LIMITES.projetosAtivos - 1; i++) await rs.unidade.criarProjeto({ nome: `P${i}` });
    const tres = projetosLegados([
      projetoLegado({ id_projeto: 91, etapas: [etapaLegada({ id_etapa: 910 })] }),
      projetoLegado({ id_projeto: 92, etapas: [etapaLegada({ id_etapa: 920 })] }),
      projetoLegado({ id_projeto: 93, etapas: [etapaLegada({ id_etapa: 930, macroetapa: "Fase do 93" })] }),
      projetoLegado({ id_projeto: 94, data_fim: "2025-01-01 00:00:00", ativo: false, etapas: [etapaLegada({ id_etapa: 940 })] }),
    ]);
    const rt = await importarAtividades(rs, tres, "unidade", HOJE);
    const t2 = await rs.unidade.entidades();
    const ids = new Set(t2.p.map((x) => x.id));
    const orfas = [...t2.f, ...t2.e].filter((x) => !ids.has(x.projeto));
    checar(
      "no limite de 100 ativos: entra so o que cabe (e o arquivado, que nao conta); o resto fica de fora inteiro",
      rt.novos === 2 &&
        rt.ignorados === 2 &&
        ids.has("atvp91") &&
        ids.has("atvp94") &&
        !ids.has("atvp92") &&
        !ids.has("atvp93") &&
        orfas.length === 0,
      { rt, orfas: orfas.map((x) => x.id) },
    );
    checar(
      "o resultado diz os nomes do que ficou de fora pelo limite de 100 ativos",
      rt.foraPorProjetos.join() === "Projeto 92,Projeto 93" && rt.foraPorEtapas.length === 0,
      rt,
    );
  }
  {
    // Item daqui que não passa na validação (gravado por fora, com o carimbo 10 dias à frente): a versão nova ficaria
    // acima dele, também fora da folga. O projeto fica de fora sozinho, contado como inválido.
    const a = areaMemoria();
    const rs = { unidade: novoRepo(ESCOPO_UN, a, "u").repo, eu: novoRepo(ESCOPO_EU, a, "e").repo };
    await importarAtividades(rs, lista, "unidade", HOJE);
    const p42 = (await rs.unidade.obterProjeto("atvp42"))!;
    await a.gravar({ [rs.unidade.projetos.chave("atvp42")]: { ...p42, atualizadoEm: p42.atualizadoEm + 10 * 86_400_000 } });
    const outroNome = projetosLegados([
      { ...projetoCompleto(), nome_projeto: "Outro nome" },
      projetoLegado({ id_projeto: 43, nome_projeto: "43 novo" }),
    ]);
    const ri = await importarAtividades(rs, outroNome, "unidade", HOJE);
    checar(
      "projeto que nao passaria na validacao: fica de fora sozinho (o outro entra), contado como invalido",
      ri.invalidos === 1 &&
        ri.ignorados === 1 &&
        ri.atualizados === 1 &&
        (await rs.unidade.obterProjeto("atvp42"))?.nome !== "Outro nome" &&
        (await rs.unidade.obterProjeto("atvp43"))?.nome === "43 novo",
      ri,
    );
  }
  {
    // A unidade grava primeiro; se o "Só eu" falha depois, a mensagem diz que a parte da unidade já entrou.
    const aU = areaMemoria();
    const aE = areaMemoria();
    const quebrada: Area = {
      obter: (k) => aE.obter(k),
      gravar: async () => {
        throw new Error("falha simulada ao gravar");
      },
      remover: (k) => aE.remover(k),
      aoMudar: (cb) => aE.aoMudar(cb),
    };
    const unidade = novoRepo(ESCOPO_UN, aU, "u").repo;
    const eu = novoRepo(ESCOPO_EU, quebrada, "e").repo;
    await importarAtividades({ unidade, eu }, [lista[0]!], "unidade", HOJE);
    const misto = projetosLegados([{ ...projetoCompleto(), nome_projeto: "Mudou no servidor" }, projetoLegado({ id_projeto: 46 })]);
    const errP = await lanca(() => importarAtividades({ unidade, eu }, misto, "eu", HOJE));
    checar(
      "a unidade gravou e o 'Só eu' falhou: a mensagem diz que a parte da unidade ja entrou, e o motivo",
      errP instanceof ErroValidacao &&
        /“Toda a unidade” já/.test(errP.message) &&
        /falha simulada/.test(errP.message) &&
        (await unidade.obterProjeto("atvp42"))?.nome === "Mudou no servidor",
      errP?.message,
    );
  }
  {
    // Corrida: outra aba cria o 100º projeto depois da conta da importação e antes da gravação (o "Entendi" é o
    // ponto do meio). O `importar` com `inteiro` decide na mesma leitura da gravação: nada da importação entra.
    const a = areaMemoria();
    const cru = novoRepo(ESCOPO_UN, a, "u").repo;
    const eu = novoRepo(ESCOPO_EU, a, "e").repo;
    for (let i = 0; i < LIMITES.projetosAtivos - 1; i++) await cru.criarProjeto({ nome: `P${i}` });
    const corrida = comConsentimento(cru, async () => {
      await cru.criarProjeto({ nome: "O centésimo, criado no meio" });
      return true;
    });
    const err = await lanca(() => importarAtividades({ unidade: corrida, eu }, [lista[0]!], "unidade", HOJE));
    const depois = await cru.entidades();
    checar(
      "o 100o criado no meio: erro do limite e nenhuma fase ou etapa sem projeto",
      err instanceof ErroValidacao &&
        /Limite de 100 projetos ativos/.test(err.mensagens.join(" ")) &&
        depois.p.length === LIMITES.projetosAtivos &&
        depois.f.length === 0 &&
        depois.e.length === 0,
      { err, p: depois.p.length, f: depois.f.length, e: depois.e.length },
    );
  }

  secao("atividades: sigilo (a marca daqui nao se perde; o numero nao vai ao texto)");
  {
    const SIG = "50300.000123/2026-01";
    const a = areaMemoria();
    const rs = { unidade: novoRepo(ESCOPO_UN, a, "u").repo, eu: novoRepo(ESCOPO_EU, a, "e").repo };
    await rs.unidade.lembrarSigilo({ processos: [chaveProtocolo(SIG)], documentos: [] }, "local");
    await importarAtividades(rs, lista, "unidade", HOJE);
    const pm = await rs.unidade.obterProjeto("atvp42");
    checar(
      "numero que este computador ja sabe sigiloso: entra marcado e fica fora do texto",
      pm?.processo?.protocolo === SIG && pm.processo.sigiloso === true && !(await textoDoEscopo(rs.unidade)).includes("000123/2026"),
      pm?.processo,
    );
    // A cópia de um colega (que sabia do sigilo) chega pelo texto: vínculo vazio marcado, ainda "do Atividades".
    const b = areaMemoria();
    const rb = { unidade: novoRepo(ESCOPO_UN, b, "b").repo, eu: novoRepo(ESCOPO_EU, b, "c").repo };
    const doColega = mapearProjeto(lista[0]!, { ...rb.unidade.carimboAtual(), dispositivo: "pc-bia", por: "bia" }, HOJE, "a0");
    doColega.p[0]!.processo = { protocolo: "", sigiloso: true };
    const ed2 = doColega.e.find((e) => e.id === "atve2")!;
    ed2.processo = { protocolo: "", sigiloso: true };
    await rb.unidade.importar(doColega);
    const rr = await importarAtividades(rb, lista, "unidade", HOJE);
    const pb = await rb.unidade.obterProjeto("atvp42");
    const eb2 = await rb.unidade.obterEtapa("atve2");
    const textoB = await textoDoEscopo(rb.unidade);
    checar(
      "reimportar sobre o vinculo vazio marcado: o numero volta AQUI, marcado, e nao vai ao texto",
      pb?.processo?.protocolo === SIG &&
        pb.processo.sigiloso === true &&
        eb2?.processo?.protocolo === "50300.000777/2026-02" &&
        eb2.processo.sigiloso === true &&
        !textoB.includes("000123/2026") &&
        !textoB.includes("000777/2026"),
      { rr, p: pb?.processo, e2: eb2?.processo },
    );
    const rr2 = await importarAtividades(rb, lista, "unidade", HOJE);
    checar("e reimportar de novo acha tudo igual (a marca nao vira 'atualizado' toda vez)", rr2.iguais === 2 && rr2.atualizados === 0, rr2);
    await rb.unidade.editarProjeto("atvp42", { processo: { protocolo: "50300.000999/2026-09", sigiloso: true } });
    await importarAtividades(rb, lista, "unidade", HOJE);
    checar(
      "processo marcado pelo usuario (editado aqui): a reimportacao nao mexe",
      (await rb.unidade.obterProjeto("atvp42"))?.processo?.protocolo === "50300.000999/2026-09",
    );
  }

  secao("atividades: o Entendi de 'Toda a unidade' vale para a importacao");
  {
    const a = areaMemoria();
    const cru = novoRepo(ESCOPO_UN, a, "u").repo;
    const eu = novoRepo(ESCOPO_EU, a, "e").repo;
    let perguntas = 0;
    let resposta = false;
    const unidade = comConsentimento(cru, async () => {
      perguntas++;
      return resposta;
    });
    const err = await lanca(() => importarAtividades({ unidade, eu }, lista, "unidade", HOJE));
    checar(
      "sem o Entendi: nada gravado, com a mensagem",
      perguntas === 1 &&
        (err as ErroValidacao | null)?.mensagens?.[0] === MENSAGEM_SEM_ENTENDI &&
        Object.keys(await a.obter(null)).length === 0,
      err,
    );
    resposta = true;
    await importarAtividades({ unidade, eu }, lista, "unidade", HOJE);
    checar(
      "com o Entendi: uma pergunta so para todos os projetos",
      perguntas === 2 && (await cru.dados()).projetos.length === 2,
      perguntas,
    );
    // "Só eu" com um projeto que já está na unidade (e mudou) e outro novo: a unidade vai primeiro.
    resposta = false;
    const mistura = projetosLegados([projetoCompleto(), projetoLegado({ id_projeto: 45 })]);
    mistura[0]!.nome_projeto = "Mudou no servidor";
    const err2 = await lanca(() => importarAtividades({ unidade, eu }, mistura, "eu", HOJE));
    checar(
      "Só eu com parte na unidade e sem o Entendi: nada gravado, nem no Só eu",
      err2 instanceof ErroValidacao &&
        (await eu.dados()).projetos.length === 0 &&
        (await cru.obterProjeto("atvp42"))?.nome !== "Mudou no servidor",
      err2,
    );
  }

  secao("atividades: o dialogo");
  const doc = telaDoApp();
  const pedidos: Array<{ ids: number[]; vis: string }> = [];
  let fechado = false;
  const abrirModal: AbrirModal = (o) => {
    doc.body.append(o.conteudo);
    return {
      fechar: () => {
        fechado = true;
        o.conteudo.remove();
      },
    };
  };
  abrirImportarAtividades({
    abrirModal,
    sigla: "SEPRO",
    itens: [
      { id: 42, nome: HOSTIL, unidade: "SEPRO", etapas: 3, arquivado: false },
      { id: 50, nome: "Antigo", unidade: "SEPRO", etapas: 1, arquivado: true },
      { id: 51, nome: "Excluido", unidade: "SEPRO", etapas: 7, arquivado: false },
    ],
    jaImportados: new Set([42]),
    excluidos: new Set([51]),
    avisoCache: "O servidor do Atividades respondeu 500.",
    cortados: 500,
    importar: async (ids, vis) => void pedidos.push({ ids, vis }),
  });
  const dlg = doc.body.querySelector(".prj-form-importar") as HTMLElement;
  checar(
    "avisa que veio do guardado",
    texto(dlg).includes(
      "Não foi possível buscar no servidor do Atividades (O servidor do Atividades respondeu 500.). Mostrando a última lista guardada neste navegador.",
    ),
    texto(dlg.querySelector(".prj-importar-cache")),
  );
  checar(
    "avisa o corte dos 1000 projetos",
    /1500 projetos/.test(texto(dlg.querySelector(".prj-importar-cortados"))) &&
      /1000 primeiros/.test(texto(dlg.querySelector(".prj-importar-cortados"))),
    texto(dlg.querySelector(".prj-importar-cortados")),
  );
  const linhas = [...dlg.querySelectorAll(".prj-importar-item")];
  const caixaExcluido = linhas[2]?.querySelector<HTMLInputElement>("input");
  checar(
    "excluido aqui: a linha diz que nao volta, desmarcada e desligada",
    /excluído aqui: não volta/.test(texto(linhas[2])) && caixaExcluido?.checked === false && caixaExcluido.disabled === true,
    texto(linhas[2]),
  );
  checar(
    "os ativos ja marcados, o arquivado nao",
    linhas[0]!.querySelector<HTMLInputElement>("input")!.checked && !linhas[1]!.querySelector<HTMLInputElement>("input")!.checked,
  );
  checar("ja importado: atualiza", /já importado: atualiza/.test(texto(linhas[0])) && !linhas[0]?.querySelector("img"));
  checar("o resumo do que vem", /Vêm 1 projeto e 3 etapas/.test(texto(dlg.querySelector(".prj-importar-resumo"))));
  checar(
    "acessivel: o resumo e lido quando muda; os destinos sao um grupo com nome",
    dlg.querySelector(".prj-importar-resumo")?.getAttribute("aria-live") === "polite" &&
      dlg.querySelector("[role='radiogroup']")?.getAttribute("aria-label") === "Importar para",
  );
  marcar(linhas[1]?.querySelector("input"));
  checar("marcar soma", /Vêm 2 projetos e 4 etapas/.test(texto(dlg.querySelector(".prj-importar-resumo"))));
  marcar(dlg.querySelector("input[value='eu']"));
  botao(dlg, "Importar")?.click();
  await tique();
  checar(
    "importa os marcados no destino escolhido e fecha",
    pedidos[0]?.ids.join() === "42,50" && pedidos[0]?.vis === "eu" && fechado,
    pedidos,
  );

  secao("atividades: o dialogo com o que nao cabe, sem nada e com o Entendi recusado");
  {
    const d2 = telaDoApp();
    const abertos: Array<{ aberto: boolean }> = [];
    const modal: AbrirModal = (o) => {
      d2.body.append(o.conteudo);
      const m2 = { aberto: true };
      abertos.push(m2);
      return {
        fechar: () => {
          m2.aberto = false;
          o.conteudo.remove();
        },
      };
    };
    abrirImportarAtividades({
      abrirModal: modal,
      sigla: "SEPRO",
      itens: [
        { id: 90, nome: "Enorme", unidade: "SEPRO", etapas: 301, arquivado: false, grande: true },
        { id: 91, nome: "Normal", unidade: "SEPRO", etapas: 2, arquivado: false },
      ],
      jaImportados: new Set(),
      importar: async () => undefined,
    });
    const dg = d2.body.querySelector(".prj-form-importar") as HTMLElement;
    const caixaGrande = dg.querySelector<HTMLInputElement>(".prj-importar-item input")!;
    checar(
      "mais de 300 etapas: a caixa desligada e desmarcada, com o motivo; nao entra no resumo",
      caixaGrande.disabled &&
        !caixaGrande.checked &&
        /mais de 300 etapas/.test(texto(dg.querySelector(".prj-importar-item"))) &&
        /Vêm 1 projeto e 2 etapas/.test(texto(dg.querySelector(".prj-importar-resumo"))) &&
        !dg.querySelector(".prj-importar-cache"),
    );
    abrirImportarAtividades({ abrirModal: modal, sigla: "SEPRO", itens: [], jaImportados: new Set(), importar: async () => undefined });
    const vazio = d2.body.querySelectorAll(".prj-form-importar")[1] as HTMLElement;
    checar(
      "lista vazia: explica e o Importar fica desligado",
      /não tem projetos para você/.test(texto(vazio)) && botao(vazio, "Importar")?.disabled === true,
    );
    const a = areaMemoria();
    const cru = novoRepo(ESCOPO_UN, a, "u").repo;
    const unidade = comConsentimento(cru, async () => false);
    const eu = novoRepo(ESCOPO_EU, a, "e").repo;
    abrirImportarAtividades({
      abrirModal: modal,
      sigla: "SEPRO",
      itens: itensParaImportar(lista, C.agora),
      jaImportados: new Set(),
      importar: (ids, vis) =>
        importarAtividades(
          { unidade, eu },
          lista.filter((l) => ids.includes(l.id_projeto)),
          vis,
          HOJE,
        ),
    });
    const de = d2.body.querySelectorAll(".prj-form-importar")[2] as HTMLElement;
    botao(de, "Importar")?.click();
    await tique();
    checar(
      "Entendi recusado: a mensagem aparece, o dialogo fica aberto e nada foi gravado",
      texto(de.querySelector(".prj-erros")).includes(MENSAGEM_SEM_ENTENDI) &&
        abertos[2]?.aberto === true &&
        Object.keys(await a.obter(null)).length === 0,
      texto(de.querySelector(".prj-erros")),
    );
  }

  secao("atividades: o que o aviso diz depois de importar");
  const base = {
    novos: 0,
    atualizados: 0,
    iguais: 0,
    noOutroEscopo: 0,
    excluidosAqui: 0,
    ignorados: 0,
    foraPorProjetos: [] as string[],
    foraPorEtapas: [] as string[],
    invalidos: 0,
  };
  checar(
    "novos e atualizados",
    mensagemDaImportacao({ ...base, novos: 2, atualizados: 1 }, "unidade") === "2 projetos importados e 1 atualizado.",
    mensagemDaImportacao({ ...base, novos: 2, atualizados: 1 }, "unidade"),
  );
  checar(
    "nada mudou",
    mensagemDaImportacao({ ...base, iguais: 3 }, "unidade") === "Nada mudou: os projetos escolhidos já estavam como no servidor.",
    mensagemDaImportacao({ ...base, iguais: 3 }, "unidade"),
  );
  const tudoJunto = mensagemDaImportacao(
    {
      ...base,
      novos: 1,
      noOutroEscopo: 1,
      excluidosAqui: 1,
      ignorados: 9,
      foraPorProjetos: ["A", "B", "C", "D", "E", "F", "G"],
      foraPorEtapas: ["Grande"],
      invalidos: 1,
    },
    "eu",
  );
  checar(
    "outro escopo, excluido aqui e o que ficou de fora, pelo nome e pelo motivo (ate 5 nomes)",
    tudoJunto ===
      "1 projeto importado. 1 já estava em “Toda a unidade” e ficou lá. 1 excluído aqui não voltou. Ficaram de fora pelo limite de 100 projetos ativos: “A”, “B”, “C”, “D”, “E” e mais 2 (arquive ou exclua algum e importe de novo). Ficou de fora por ter mais de 300 etapas: “Grande”. Um projeto veio com dados que não dá para usar e ficou de fora.",
    tudoJunto,
  );
  const umSo = mensagemDaImportacao(
    { ...base, ignorados: 3, foraPorProjetos: ["x".repeat(200)], foraPorEtapas: ["P1", "P2"], invalidos: 0 },
    "unidade",
  );
  checar(
    "um so pelo limite (nome longo cortado); dois pelas etapas",
    umSo ===
      `Ficou de fora pelo limite de 100 projetos ativos: “${"x".repeat(59)}…” (arquive ou exclua algum e importe de novo). Ficaram de fora por terem mais de 300 etapas: “P1”, “P2”.`,
    umSo,
  );
  checar(
    "varios invalidos",
    mensagemDaImportacao({ ...base, ignorados: 2, invalidos: 2 }, "unidade") ===
      "2 projetos vieram com dados que não dá para usar e ficaram de fora.",
    mensagemDaImportacao({ ...base, ignorados: 2, invalidos: 2 }, "unidade"),
  );
  checar(
    "legadosImportados ignora lapide e o que nao veio do Atividades",
    legadosImportados([
      projeto({ id: "a", origem: { atividades: 7 } }),
      projeto({ id: "b", origem: { atividades: 8 }, removidoEm: 5 }),
      projeto({ id: "c" }),
    ]).size === 1,
  );
}
