/**
 * Enviar e receber projeto por arquivo (spec 6.2). O arquivo vai a OUTRA pessoa: o corte de sigilo é o do Texto
 * Padrão com a memória do sigilo deste computador (a regra do escopo inteiro + a memória, numa leitura só), e a
 * memória ilegível não gera arquivo nenhum. O arquivo não leva o histórico nem os carimbos. Receber cria uma cópia
 * com ids novos, numa gravação só, e o arquivo torto não grava nada. E os dois diálogos.
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import type { AbrirModal } from "@comum/ui/dialogo";
import { comConsentimento, MENSAGEM_SEM_ENTENDI } from "../src/app/colaboracao/consentir";
import { montarCabecalho } from "../src/app/componentes/cabecalho";
import type { ProjetoNaTela } from "../src/app/dados";
import { abrirEnviarProjeto, abrirReceberProjeto } from "../src/app/dialogos/arquivoProjeto";
import { abrirDialogoProjeto } from "../src/app/dialogos/projeto";
import * as moduloArquivo from "../src/arquivo/projetoArquivo";
import {
  arquivoDoProjeto,
  type EnvelopeProjeto,
  LIMITE_ARQUIVO_PROJETO,
  lerArquivoDoProjeto,
  lerEnvelopeDoProjeto,
  MENSAGEM_MEMORIA_ENVIO,
  MENSAGEM_NAO_E_PROJETO,
  MENSAGEM_TORTO,
  nomeDoArquivoDoProjeto,
  previaDoRecebido,
  receberProjeto,
} from "../src/arquivo/projetoArquivo";
import { prefixoMemoriaSigilo } from "../src/modelo/constantes";
import { ErroMemoriaSigilo } from "../src/modelo/memoriaSigilo";
import { resumoDoProjeto } from "../src/modelo/resumo";
import { vinculoSemNumero } from "../src/modelo/sigilo";
import type { Entidades, Vis } from "../src/modelo/tipos";
import { ErroValidacao } from "../src/modelo/validacao";
import { chaveProtocolo } from "../src/modelo/vinculos";
import { MODELOS_EMBUTIDOS } from "../src/modelos/embutidos";
import { paraOTexto } from "../src/sincronia/textoPadrao";
import { marcar, telaDoApp, texto } from "./apoioApp";
import { ESCOPO_EU, ESCOPO_UN, novoRepo } from "./apoioRepositorio";
import { HOSTIL } from "./cenarioGantt";
import { etapa, HOJE, projeto } from "./fabrica";
import { botao, checar, lanca, secao, tique } from "./util";

function modais(doc: Document) {
  const abertos: Array<{ titulo: string; conteudo: HTMLElement; aberto: boolean }> = [];
  const abrirModal: AbrirModal = (o) => {
    doc.body.append(o.conteudo);
    const m = { titulo: o.titulo, conteudo: o.conteudo, aberto: true };
    abertos.push(m);
    return {
      fechar: () => {
        m.aberto = false;
        o.conteudo.remove();
        o.aoFechar?.();
      },
    };
  };
  return { abrirModal, abertos };
}

/** Todos os textos (valores) do JSON, em qualquer profundidade. */
function textosDoJson(x: unknown): string[] {
  if (typeof x === "string") return [x];
  if (Array.isArray(x)) return x.flatMap(textosDoJson);
  if (x && typeof x === "object") return Object.entries(x).flatMap(([k, v]) => [k, ...textosDoJson(v)]);
  return typeof x === "number" ? [String(x)] : [];
}

/**
 * O número está no arquivo? Procura no texto cru e nos textos decodificados do JSON (chaves e valores), com e sem
 * a pontuação (só os dígitos de cada texto).
 */
function vazou(conteudo: string, numero: string): boolean {
  const digitos = numero.replace(/\D/g, "");
  const decodificado = textosDoJson(JSON.parse(conteudo));
  return conteudo.includes(numero) || decodificado.some((t) => t.includes(numero) || t.replace(/\D/g, "").includes(digitos));
}

/** Área que falha ao ler (ou ao gravar) a memória do sigilo quando o interruptor está ligado. */
function areaQueFalha(base: Area, falha: { ler: boolean; gravar: boolean }): Area {
  const daMemoria = (ks: string[]) => ks.some((k) => k.startsWith("projetos/sigilo/"));
  return {
    ...base,
    chaves: async () => {
      if (falha.ler) throw new Error("falha simulada ao ler o storage");
      return (await base.chaves?.()) ?? [];
    },
    obter: async (ch) => {
      const ks = ch === null || ch === undefined ? ["projetos/sigilo/"] : typeof ch === "string" ? [ch] : ch;
      if (falha.ler && daMemoria(ks)) throw new Error("falha simulada ao ler o storage");
      return base.obter(ch);
    },
    gravar: async (i) => {
      if (falha.gravar && daMemoria(Object.keys(i))) throw new Error("falha simulada ao gravar o storage");
      return base.gravar(i);
    },
    aoMudar: base.aoMudar.bind(base),
  };
}

export async function verificarArquivoProjeto(): Promise<void> {
  secao("enviar projeto: o que vai no arquivo");
  const { repo } = novoRepo(ESCOPO_UN, areaMemoria(), "o");
  const p = await repo.criarProjeto({
    nome: "Sindicância",
    processo: { protocolo: "50300.000777/2026-10", idProcedimento: "777001", sigiloso: true },
  });
  const f = await repo.criarFase(p.id, "Instrução");
  const e1 = await repo.criarEtapa({
    projeto: p.id,
    nome: "Oitiva",
    inicio: "2026-10-06",
    fim: "2026-10-09",
    fase: f.id,
    documento: { numero: "1234567" },
  });
  await repo.criarEtapa({
    projeto: p.id,
    nome: "Relatório",
    inicio: "2026-10-13",
    fim: "2026-10-16",
    dependeDe: [e1.id],
    checklist: [{ id: "c1", texto: "Revisar", feito: true }],
    responsavel: { nome: "Bia Souza", login: "bia.souza" },
  });
  const morta = await repo.criarEtapa({ projeto: p.id, nome: "Excluída", inicio: "2026-10-06", fim: "2026-10-06" });
  await repo.removerEtapa(morta.id);
  const arq = await arquivoDoProjeto(repo, p.id, 5);
  const json = arq.conteudo;
  const env = JSON.parse(json) as EnvelopeProjeto;
  checar(
    "sem o numero sigiloso, sem o idProcedimento e sem o documento da etapa sigilosa",
    !vazou(json, "50300.000777/2026-10") && !json.includes("777001") && !vazou(json, "1234567"),
    json,
  );
  checar(
    "o vinculo vai marcado e vazio (sem idProcedimento)",
    JSON.stringify(env.projeto.processo) === JSON.stringify({ protocolo: "", sigiloso: true }),
    env.projeto.processo,
  );
  checar(
    "o documento da etapa sigilosa vai como o marcador (sem numero, marcado)",
    JSON.stringify(env.etapas[0]?.documento) === JSON.stringify({ numero: "", sigiloso: true }),
    env.etapas[0],
  );
  checar(
    "sem historico, sem carimbos, sem lapides, sem a memoria",
    !("h" in env) &&
      !("sigilo" in env) &&
      !json.includes("atualizadoEm") &&
      !json.includes("dispositivo") &&
      !json.includes("alteradoPor") &&
      env.etapas.length === 2 &&
      !json.includes("Excluída"),
  );
  checar(
    "fases, dependencias e checklist vao (na ordem do projeto)",
    env.fases.length === 1 &&
      env.etapas[0]?.nome === "Oitiva" &&
      env.etapas[1]?.dependeDe.length === 1 &&
      env.etapas[1]?.checklist[0]?.texto === "Revisar",
  );
  checar(
    "do responsavel vai so o nome: o login nao sai (cru e decodificado)",
    !json.includes("bia.souza") &&
      !textosDoJson(JSON.parse(json)).some((t) => t.includes("bia.souza")) &&
      JSON.stringify(env.etapas[1]?.responsavel) === '{"nome":"Bia Souza"}',
    env.etapas[1]?.responsavel,
  );
  checar(
    "nome do arquivo e formato",
    arq.nome === "Sindicância.seipro-projeto.json" && env.formato === "seipro-projeto" && env.gerado === 5,
  );
  checar(
    "nome do arquivo sem caracteres proibidos",
    nomeDoArquivoDoProjeto('A/B: "x"?') === "A B x.seipro-projeto.json" &&
      nomeDoArquivoDoProjeto("").startsWith("projeto.") &&
      nomeDoArquivoDoProjeto(`a${String.fromCharCode(1)}b`) === "a b.seipro-projeto.json" &&
      !/[<>"]/.test(nomeDoArquivoDoProjeto(HOSTIL)),
    nomeDoArquivoDoProjeto(HOSTIL),
  );
  checar(
    "para fora, so o arquivoDoProjeto: o corte puro nao e exportado (ninguem liga o corte so pela regra)",
    typeof moduloArquivo.arquivoDoProjeto === "function" &&
      !Object.keys(moduloArquivo).some((k) => /^(envelopeDoProjeto|NADA_CONHECIDO|paraTeste)$|conhecidos|corte/i.test(k)),
    Object.keys(moduloArquivo),
  );

  secao("enviar projeto: o sigilo pela memoria e pelo escopo inteiro (o arquivo vai a outra pessoa)");
  {
    const { repo: r } = novoRepo(ESCOPO_UN, areaMemoria(), "s");
    const SO_NA_MEMORIA = "50300.000888/2026-11";
    const DOC_NA_MEMORIA = "7654321";
    const MARCADO_NOUTRO = "50300.000999/2026-12";
    const pm = await r.criarProjeto({ nome: "Fiscalização", processo: { protocolo: SO_NA_MEMORIA, idProcedimento: "888001" } });
    await r.criarEtapa({
      projeto: pm.id,
      nome: "Ofício",
      inicio: "2026-10-06",
      fim: "2026-10-09",
      processo: { protocolo: MARCADO_NOUTRO },
      documento: { numero: "1112223" },
    });
    await r.criarEtapa({
      projeto: pm.id,
      nome: "Despacho",
      inicio: "2026-10-06",
      fim: "2026-10-09",
      documento: { numero: DOC_NA_MEMORIA },
    });
    await r.criarEtapa({
      projeto: pm.id,
      nome: "Nota",
      inicio: "2026-10-06",
      fim: "2026-10-09",
      documento: { numero: "4445556", sigiloso: true },
    });
    // O outro processo é marcado sigiloso noutro projeto do mesmo escopo.
    await r.criarProjeto({ nome: "Outro", processo: { protocolo: MARCADO_NOUTRO, sigiloso: true } });
    // Só a memória sabe destes (o número saiu de todo vínculo marcado; o documento foi raspado uma vez).
    await r.lembrarSigilo({ processos: [chaveProtocolo(SO_NA_MEMORIA)], documentos: [DOC_NA_MEMORIA] }, "local");
    const projetoNoEstado = await r.obterProjeto(pm.id);
    checar(
      "(o vinculo do projeto nao tem a marca no estado: so a memoria sabe)",
      projetoNoEstado?.processo?.sigiloso !== true && projetoNoEstado?.processo?.protocolo === SO_NA_MEMORIA,
      projetoNoEstado,
    );
    const a = await arquivoDoProjeto(r, pm.id, 9);
    const ea = JSON.parse(a.conteudo) as EnvelopeProjeto;
    checar(
      "numero sigiloso so na memoria nao sai (com e sem pontuacao, cru e decodificado) nem o idProcedimento",
      !vazou(a.conteudo, SO_NA_MEMORIA) && !vazou(a.conteudo, "888001") && vinculoSemNumero(ea.projeto.processo),
      a.conteudo,
    );
    checar(
      "numero marcado noutro projeto do escopo nao sai, nem o documento da etapa que ficou sigilosa",
      !vazou(a.conteudo, MARCADO_NOUTRO) &&
        !vazou(a.conteudo, "1112223") &&
        vinculoSemNumero(ea.etapas.find((x) => x.nome === "Ofício")?.processo),
      a.conteudo,
    );
    checar(
      "documento sigiloso (marcado ou so na memoria) nao sai: vai o marcador",
      !vazou(a.conteudo, DOC_NA_MEMORIA) &&
        !vazou(a.conteudo, "4445556") &&
        ["Despacho", "Nota"].every(
          (n) => JSON.stringify(ea.etapas.find((x) => x.nome === n)?.documento) === '{"numero":"","sigiloso":true}',
        ),
      a.conteudo,
    );
    // Pelo menos tão forte quanto o Texto Padrão: todo número que o texto raspa do escopo fica fora do arquivo.
    const { envelope: escopo, conhecidos } = await r.exportarComConhecidos(9);
    const textoPadrao = JSON.stringify(paraOTexto(escopo, 9, conhecidos));
    const numeros = [
      ...escopo.entidades.p.map((x) => x.processo?.protocolo ?? ""),
      ...escopo.entidades.e.flatMap((x) => [x.processo?.protocolo ?? "", x.documento?.numero ?? ""]),
    ].filter(Boolean);
    const raspadosNoTexto = numeros.filter((n) => !textoPadrao.includes(n));
    checar(
      "tudo o que o Texto Padrao raspa tambem fica fora do arquivo",
      raspadosNoTexto.length >= 5 && raspadosNoTexto.every((n) => !vazou(a.conteudo, n)),
      raspadosNoTexto,
    );
    checar("as etapas vao todas (o arquivo nao e cortado a toa)", ea.etapas.length === 3);
    const comum = await r.criarProjeto({ nome: "Comum", processo: { protocolo: "50300.000111/2026-01", idProcedimento: "111001" } });
    await r.criarEtapa({ projeto: comum.id, nome: "Etapa", inicio: "2026-10-06", fim: "2026-10-07", documento: { numero: "9998887" } });
    const ac = await arquivoDoProjeto(r, comum.id, 9);
    const ec = JSON.parse(ac.conteudo) as EnvelopeProjeto;
    checar(
      "processo e documento comuns vao com o numero; o idProcedimento (id interno do SEI de quem envia) nao vai",
      ec.projeto.processo?.protocolo === "50300.000111/2026-01" &&
        ec.projeto.processo.idProcedimento === undefined &&
        !ac.conteudo.includes("111001") &&
        ec.etapas[0]?.documento?.numero === "9998887",
      ac.conteudo,
    );
    checar(
      "o que o arquivo raspou fica na memoria (como no Texto Padrao)",
      (await r.sigilosConhecidos()).processos.has(chaveProtocolo(MARCADO_NOUTRO)),
    );
    checar("projeto que nao existe: erro, sem arquivo", (await lanca(() => arquivoDoProjeto(r, "nao-existe", 9))) instanceof ErroValidacao);
  }

  secao("enviar projeto: memoria do sigilo ilegivel nao gera arquivo");
  const falha = { ler: false, gravar: false };
  const areaF = areaQueFalha(areaMemoria(), falha);
  const { repo: rf } = novoRepo(ESCOPO_UN, areaF, "f");
  const pf = await rf.criarProjeto({ nome: "Apuração", processo: { protocolo: "50300.000555/2026-15", sigiloso: true } });
  // Esquece a memória (como num perfil novo): só a marca do estado diz que é sigiloso, e o arquivo vai gravá-lo nela.
  const prefixo = prefixoMemoriaSigilo(ESCOPO_UN.host, ESCOPO_UN.login);
  await areaF.remover(Object.keys(await areaF.obter(null)).filter((k) => k.startsWith(prefixo)));
  falha.ler = true;
  const erroLer = await lanca(() => arquivoDoProjeto(rf, pf.id, 9));
  checar(
    "memoria que nao le: o envio falha (ErroMemoriaSigilo) dizendo que nenhum arquivo foi gerado",
    erroLer instanceof ErroMemoriaSigilo &&
      erroLer.message === MENSAGEM_MEMORIA_ENVIO &&
      MENSAGEM_MEMORIA_ENVIO ===
        "Não foi possível ler a lista de processos sigilosos deste computador. Nenhum arquivo foi gerado; tente de novo.",
    erroLer,
  );
  checar(
    "a mensagem generica (texto, arquivo, copia) continua a mesma",
    new ErroMemoriaSigilo().message ===
      "Não foi possível ler a lista de processos sigilosos deste computador. Nada foi gravado; tente de novo.",
  );
  falha.ler = false;
  falha.gravar = true;
  checar(
    "memoria que nao grava o que o arquivo raspou: tambem falha",
    (await lanca(() => arquivoDoProjeto(rf, pf.id, 9))) instanceof Error,
  );
  falha.gravar = false;
  falha.ler = true;
  const docF = telaDoApp();
  const mF = modais(docF);
  const baixados: string[] = [];
  const pnF: ProjetoNaTela = { projeto: pf, vis: "unidade", fases: [], etapas: [], resumo: resumoDoProjeto([], HOJE) };
  abrirEnviarProjeto({
    abrirModal: mF.abrirModal,
    projetos: [pnF],
    enviar: async (x) => {
      const a = await arquivoDoProjeto(rf, x.projeto.id, 9);
      baixados.push(a.conteudo);
    },
  });
  const dlgF = mF.abertos.at(-1)!.conteudo;
  botao(dlgF, "Baixar arquivo")?.click();
  await tique();
  checar(
    "no dialogo: nenhum arquivo baixado, a mensagem aparece e o dialogo fica aberto",
    baixados.length === 0 && texto(dlgF.querySelector(".prj-erros")) === MENSAGEM_MEMORIA_ENVIO && mF.abertos.at(-1)!.aberto,
    texto(dlgF.querySelector(".prj-erros")),
  );
  falha.ler = false;
  botao(dlgF, "Baixar arquivo")?.click();
  await tique();
  checar(
    "com a memoria de volta: baixa, sem o numero, e fecha",
    baixados.length === 1 && !vazou(baixados[0]!, "50300.000555/2026-15") && !mF.abertos.at(-1)!.aberto,
    baixados,
  );
  checar(
    "o que o arquivo raspou ficou na memoria (a memoria tinha sido esquecida: so o envio o gravou)",
    (await rf.sigilosConhecidos()).processos.has(chaveProtocolo("50300.000555/2026-15")),
  );

  secao("receber projeto: copia com ids novos");
  const lido = lerEnvelopeDoProjeto(JSON.parse(json));
  checar(
    "le o envelope",
    !!lido &&
      previaDoRecebido(lido).etapas === 2 &&
      previaDoRecebido(lido).inicio === "2026-10-06" &&
      previaDoRecebido(lido).fim === "2026-10-16",
  );
  checar("outro formato nao e projeto enviado", lerEnvelopeDoProjeto({ formato: "seipro-projetos", versao: 1 }) === null);
  checar("etapas demais: recusado", lerEnvelopeDoProjeto({ ...env, etapas: Array.from({ length: 301 }, () => env.etapas[0]) }) === null);
  const { repo: destino } = novoRepo(ESCOPO_EU, areaMemoria(), "n");
  const recebido = await receberProjeto(destino, lido!);
  const dd = await destino.dados();
  checar(
    "cria o projeto, as fases e as etapas com ids novos",
    recebido.id !== p.id && dd.etapas.length === 2 && dd.fases.length === 1 && !dd.etapas.some((e) => e.id === e1.id),
  );
  const rel = dd.etapas.find((e) => e.nome === "Relatório");
  const oit = dd.etapas.find((e) => e.nome === "Oitiva");
  checar("dependencia e fase apontam para os ids novos", rel?.dependeDe[0] === oit?.id && oit?.fase === dd.fases[0]?.id);
  checar(
    "registro de criacao no historico do destino",
    (await destino.historico(recebido.id)).some((r) => r.campo === "criacao"),
  );
  checar(
    "o vinculo vazio marcado vira processo sigiloso sem numero (e o documento, o marcador)",
    vinculoSemNumero(recebido.processo) && JSON.stringify(oit?.documento) === '{"numero":"","sigiloso":true}',
    recebido,
  );
  const naTela: ProjetoNaTela = {
    projeto: recebido,
    vis: "eu",
    fases: dd.fases,
    etapas: dd.etapas,
    resumo: resumoDoProjeto(dd.etapas, HOJE),
  };
  const docR = telaDoApp();
  const filtro = docR.createElement("button");
  const cab = montarCabecalho({
    modo: "projeto",
    projeto: naTela,
    vista: "lista",
    escala: "Semana",
    filtro,
    aoVista: () => undefined,
    aoEscala: () => undefined,
    aoHoje: () => undefined,
    aoPrimario: () => undefined,
    aoAbrirProcesso: () => undefined,
  });
  checar(
    "o cabecalho mostra 'Processo sigiloso', sem link",
    texto(cab.querySelector(".prj-meta")).startsWith("Processo sigiloso") && !cab.querySelector(".prj-meta a"),
    texto(cab.querySelector(".prj-meta")),
  );
  const mR = modais(docR);
  abrirDialogoProjeto({
    abrirModal: mR.abrirModal,
    hoje: HOJE,
    sigla: "SEPRO",
    projeto: naTela,
    modelos: MODELOS_EMBUTIDOS,
    processos: async () => [],
    salvar: async () => undefined,
  });
  await tique();
  checar(
    "o dialogo Editar projeto mostra 'Processo sigiloso' (T4 r5)",
    texto(docR.querySelector("button[role='combobox'][aria-label='Processo SEI']")) === "Processo sigiloso",
  );
  const outra = await receberProjeto(destino, lido!);
  checar("receber de novo cria outra copia (nao mescla)", outra.id !== recebido.id && (await destino.dados()).projetos.length === 2);
  const torto = { ...lido!, etapas: [{ ...lido!.etapas[0]!, inicio: "2026-13-45" }] };
  const { repo: vazio, area: areaVazia } = novoRepo(ESCOPO_UN, areaMemoria(), "t");
  const e = await lanca(() => receberProjeto(vazio, torto));
  checar(
    "arquivo com item torto: nada gravado",
    e instanceof ErroValidacao && (await vazio.dados()).projetos.length === 0 && Object.keys(await areaVazia.obter(null)).length === 0,
    e,
  );
  const tipos = { ...lido!, etapas: [{ ...lido!.etapas[0]!, nome: 42 as unknown as string }] };
  checar("tipo errado tambem (sem lancar TypeError)", (await lanca(() => receberProjeto(vazio, tipos))) instanceof ErroValidacao);

  secao("receber projeto: arquivo hostil");
  const recusa = async (nome: string, env2: unknown) => {
    const err = await lanca(() => receberProjeto(vazio, env2 as EnvelopeProjeto));
    checar(nome, err instanceof ErroValidacao && Object.keys(await areaVazia.obter(null)).length === 0, err);
  };
  const [ea0, ea1] = [lido!.etapas[0]!, lido!.etapas[1]!];
  await recusa("ids de etapa repetidos: recusado", { ...lido!, etapas: [ea0, { ...ea1, id: ea0.id, dependeDe: [] }] });
  await recusa("ids de fase repetidos: recusado", { ...lido!, fases: [lido!.fases[0]!, { ...lido!.fases[0]! }] });
  await recusa("dependencia em ciclo: recusado", {
    ...lido!,
    etapas: [
      { ...ea0, dependeDe: [ea1.id] },
      { ...ea1, dependeDe: [ea0.id] },
    ],
  });
  await recusa("progresso como texto: recusado", { ...lido!, etapas: [{ ...ea0, progresso: "50" }] });
  await recusa("etiqueta que nao e texto: recusado", { ...lido!, projeto: { ...lido!.projeto, etiquetas: [{}] } });
  const enfeitado = {
    ...lido!,
    projeto: { ...lido!.projeto, processo: { protocolo: "50300.000222/2026-02", idProcedimento: "4242", lixo: "x".repeat(1000) } },
    fases: [{ ...lido!.fases[0]!, ordem: "q".repeat(100_000) }],
    etapas: [
      {
        ...ea0,
        ordem: "z".repeat(100_000),
        documento: { numero: "1234", titulo: "Ofício", lixo: "y".repeat(1000) },
        responsavel: { nome: "Ana", login: "x".repeat(5000), lixo: "w" },
        base: { inicio: ea0.inicio, fim: ea0.fim, lixo: "v" },
        origem: { atividades: 7 },
        atualizadoEm: 9e15,
        extra: "u".repeat(1000),
      },
      { ...ea1, checklist: [{ id: "c1", texto: "Revisar", feito: true, lixo: "t" }] },
    ],
  };
  const limpo = await receberProjeto(destino, enfeitado as unknown as EnvelopeProjeto);
  const dl = await destino.dados();
  const etapasL = dl.etapas.filter((x) => x.projeto === limpo.id);
  const brutoL = JSON.stringify([limpo, ...dl.fases.filter((x) => x.projeto === limpo.id), ...etapasL]);
  checar(
    "campos de sobra, login do responsavel e ordem enorme nao entram (refeitos campo a campo; ordem nova)",
    etapasL.length === 2 &&
      !/lixo|extra|origem|xxxx|yyyy|qqqq|zzzz/.test(brutoL) &&
      etapasL.every((x) => x.ordem.length < 20 && x.atualizadoEm < 9e15) &&
      etapasL[0]?.nome === "Oitiva" &&
      JSON.stringify(etapasL[0]?.responsavel) === '{"nome":"Ana"}',
    brutoL,
  );
  checar(
    "o idProcedimento de fora nao entra (abriria outro processo na caixa de quem recebe)",
    limpo.processo?.protocolo === "50300.000222/2026-02" && limpo.processo.idProcedimento === undefined,
    limpo.processo,
  );

  const comNumeroMarcado = {
    ...lido!,
    projeto: { ...lido!.projeto, processo: { protocolo: "50300.000333/2026-03", sigiloso: true } },
    etapas: [
      {
        ...ea0,
        processo: { protocolo: "50300.000444/2026-04", sigiloso: true },
        documento: { numero: "5556667", titulo: "Ofício reservado", sigiloso: true },
      },
      ea1,
    ],
  };
  const normal = await receberProjeto(destino, comNumeroMarcado as EnvelopeProjeto);
  const etapasN = (await destino.dados()).etapas.filter((x) => x.projeto === normal.id);
  const brutoN = JSON.stringify([normal, ...etapasN, ...(await destino.historico(normal.id))]);
  checar(
    "numero marcado sigiloso no arquivo (um legitimo nunca traz) vira o vinculo vazio e o marcador",
    vinculoSemNumero(normal.processo) &&
      vinculoSemNumero(etapasN[0]?.processo) &&
      JSON.stringify(etapasN[0]?.documento) === '{"numero":"","sigiloso":true}' &&
      !/000333|000444|5556667|reservado/.test(brutoN),
    brutoN,
  );

  secao("receber projeto: o teto de projetos decide na mesma leitura da gravacao (corrida)");
  {
    const { repo: cru } = novoRepo(ESCOPO_UN, areaMemoria(), "r");
    for (let i = 0; i < 99; i++) await cru.criarProjeto({ nome: `P${i}` });
    const antes = await cru.entidades();
    // Outra aba cria o 100º entre o pré-teste do receber e a gravação (o "Entendi" é o ponto do meio).
    const corrida = comConsentimento(cru, async () => {
      await cru.criarProjeto({ nome: "O centésimo, criado no meio" });
      return true;
    });
    const err = await lanca(() => receberProjeto(corrida, lido!));
    const depois = await cru.entidades();
    checar(
      "o 100o criado no meio: erro do limite e nenhuma fase, etapa ou registro do recebido",
      err instanceof ErroValidacao &&
        /Limite de 100 projetos ativos/.test(err.mensagens.join(" ")) &&
        depois.p.length === 100 &&
        depois.f.length === 0 &&
        depois.e.length === 0 &&
        depois.h.length === antes.h.length + 1,
      { err, p: depois.p.length, f: depois.f.length, e: depois.e.length, h: depois.h.length - antes.h.length },
    );
    const { repo: r2, area: a2 } = novoRepo(ESCOPO_UN, areaMemoria(), "w");
    const c2 = r2.carimboAtual();
    const meio = {
      p: [
        { id: "bom1", nome: "Bom", etiquetas: [], ordem: "a0", criadoEm: c2.agora, atualizadoEm: c2.agora, dispositivo: "d" },
        { id: "torto1", nome: 42 },
      ],
    } as unknown as Partial<Entidades>;
    const errInteiro = await lanca(() => r2.importar(meio, undefined, { inteiro: true }));
    checar(
      "importar inteiro: um item recusado e nada gravado",
      errInteiro instanceof ErroValidacao && Object.keys(await a2.obter(null)).length === 0,
      errInteiro,
    );
    const solto = await r2.importar(meio);
    checar(
      "sem a opcao, o importar segue como antes (grava o valido e conta o ignorado)",
      solto.ignorados === 1 && (await r2.dados()).projetos.length === 1,
      solto,
    );
  }

  secao("receber projeto: o arquivo escolhido (texto) e as mensagens");
  const bom = lerArquivoDoProjeto(`${String.fromCharCode(0xfeff)}${json}`);
  checar("le o texto (com BOM)", bom.projeto.nome === "Sindicância" && bom.etapas.length === 2);
  const mensagem = (t: string) => {
    try {
      lerArquivoDoProjeto(t);
      return "";
    } catch (err) {
      return err instanceof ErroValidacao ? err.mensagens.join(" ") : `outro: ${String(err)}`;
    }
  };
  const copiaDeTudo = JSON.stringify({ formato: "seipro-projetos", versao: 1, tipo: "copia", gerado: 1, escopos: [] });
  checar("JSON quebrado: diz que nao e um projeto enviado", /não é um projeto enviado/.test(mensagem("{quebrado")), mensagem("{quebrado"));
  checar("a copia de tudo: manda usar o Importar", /Importar de um arquivo/.test(mensagem(copiaDeTudo)), mensagem(copiaDeTudo));
  checar(
    "versao mais nova: manda atualizar",
    /Atualize/.test(mensagem(JSON.stringify({ ...env, versao: 2 }))),
    mensagem(JSON.stringify({ ...env, versao: 2 })),
  );
  checar(
    "a mensagem diz como o arquivo certo e gerado",
    MENSAGEM_NAO_E_PROJETO.endsWith(
      "Peça a quem enviou um arquivo gerado em “Enviar projeto por arquivo…” (o nome termina em .seipro-projeto.json).",
    ),
    MENSAGEM_NAO_E_PROJETO,
  );
  const comData = JSON.stringify({ ...env, etapas: [{ ...env.etapas[0]!, inicio: "45/13/2026" }] });
  checar("data impossivel: recusada ja na leitura (o dialogo nem abre)", mensagem(comData) === MENSAGEM_TORTO, mensagem(comData));
  const nomeEnorme = JSON.stringify({ ...env, projeto: { ...env.projeto, nome: "n".repeat(LIMITE_ARQUIVO_PROJETO - 2000) } });
  checar(
    "nome de quase 5 MB: recusado na leitura (nao chega a previa)",
    nomeEnorme.length <= LIMITE_ARQUIVO_PROJETO && mensagem(nomeEnorme) === MENSAGEM_TORTO,
    mensagem(nomeEnorme).slice(0, 200),
  );
  const espacado = lerArquivoDoProjeto(JSON.stringify({ ...env, projeto: { ...env.projeto, nome: "  Sindicância   nova " } }));
  checar(
    "a previa mostra o nome ja limpo e as datas validadas",
    previaDoRecebido(espacado).nome === "Sindicância nova" &&
      previaDoRecebido(espacado).inicio === "2026-10-06" &&
      previaDoRecebido(espacado).fim === "2026-10-16",
    previaDoRecebido(espacado),
  );
  checar(
    "previa de envelope torto: erro (nunca um nome ou uma data que nao passaria)",
    (await lanca(() => previaDoRecebido(JSON.parse(comData) as EnvelopeProjeto))) instanceof ErroValidacao,
  );
  checar(
    "grande demais: recusado antes de ler",
    /5 MB/.test(mensagem(" ".repeat(LIMITE_ARQUIVO_PROJETO + 1))),
    mensagem(" ".repeat(LIMITE_ARQUIVO_PROJETO + 1)),
  );

  secao("receber em Toda a unidade: o Entendi");
  {
    const { repo: cru, area: areaU } = novoRepo(ESCOPO_UN, areaMemoria(), "u");
    let perguntas = 0;
    let resposta = false;
    const unidade = comConsentimento(cru, async () => {
      perguntas++;
      return resposta;
    });
    const err = await lanca(() => receberProjeto(unidade, lido!));
    checar(
      "sem o Entendi: nada gravado, com a mensagem",
      perguntas === 1 &&
        (err as ErroValidacao | null)?.mensagens?.[0] === MENSAGEM_SEM_ENTENDI &&
        Object.keys(await areaU.obter(null)).length === 0,
      err,
    );
    resposta = true;
    await receberProjeto(unidade, lido!);
    checar("com o Entendi: recebido", perguntas === 2 && (await cru.dados()).projetos.length === 1);
  }

  secao("enviar e receber: os dialogos");
  const doc = telaDoApp();
  const m = modais(doc);
  const pn = (id: string, nome: string): ProjetoNaTela => ({
    projeto: projeto({ id, nome }),
    vis: "unidade",
    fases: [],
    etapas: [etapa({ id: `${id}e`, projeto: id })],
    resumo: resumoDoProjeto([etapa({ id: `${id}e`, projeto: id })], HOJE),
  });
  const enviados: string[] = [];
  abrirEnviarProjeto({
    abrirModal: m.abrirModal,
    projetos: [pn("a", HOSTIL), pn("b", "Plano")],
    enviar: (x) => {
      enviados.push(x.projeto.id);
    },
  });
  const dlg = m.abertos.at(-1)!.conteudo;
  checar("escolher o projeto e a nota de privacidade", /sem o número de processo sigiloso/.test(texto(dlg)) && !dlg.querySelector("img"));
  botao(dlg, "Baixar arquivo")?.click();
  await tique();
  checar("baixar fecha e envia o escolhido (o primeiro)", enviados.join() === "a" && !m.abertos.at(-1)!.aberto);
  const pedidos: Vis[] = [];
  let falhar = false;
  abrirReceberProjeto({
    abrirModal: m.abrirModal,
    sigla: "SEPRO",
    previa: { nome: HOSTIL, etapas: 2, fases: 1, inicio: "2026-10-06", fim: "2026-10-16" },
    receber: async (vis) => {
      pedidos.push(vis);
      if (falhar) throw new ErroValidacao(["Limite de 100 projetos ativos em “Só eu”."]);
    },
  });
  const rec = m.abertos.at(-1)!.conteudo;
  checar(
    "previa: nome, etapas, fases e periodo",
    /2 etapas em 1 fase · de 06\/10\/2026 a 16\/10\/2026/.test(texto(rec)) && texto(rec.querySelector(".prj-previa b")) === HOSTIL,
  );
  checar(
    "destino: Toda a unidade marcada; um grupo de radios com nome",
    rec.querySelector("input[value='unidade']")?.hasAttribute("checked") === true &&
      !rec.querySelector("input[value='eu']")?.hasAttribute("checked") &&
      rec.querySelector("[role='radiogroup']")?.getAttribute("aria-label") === "Receber em" &&
      !rec.querySelector("img"),
  );
  marcar(rec.querySelector("input[value='eu']"));
  falhar = true;
  botao(rec, "Receber projeto")?.click();
  await tique();
  checar(
    "erro: mostra e fica aberto",
    /Limite de 100/.test(texto(rec.querySelector(".prj-erros"))) && m.abertos.at(-1)!.aberto && pedidos.join() === "eu",
  );
  falhar = false;
  botao(rec, "Receber projeto")?.click();
  await tique();
  checar("recebeu: fecha", !m.abertos.at(-1)!.aberto);
  abrirReceberProjeto({
    abrirModal: m.abrirModal,
    sigla: "SEPRO",
    previa: { nome: "Plano simples", etapas: 5, fases: 0, inicio: "2026-10-06", fim: "2026-10-16" },
    receber: async () => undefined,
  });
  const semFases = texto(m.abertos.at(-1)!.conteudo.querySelector(".prj-previa"));
  checar(
    "sem fases: '5 etapas · de ...' (sem 'em 0 fases')",
    /5 etapas · de 06\/10\/2026/.test(semFases) && !/fase/.test(semFases),
    semFases,
  );
}
