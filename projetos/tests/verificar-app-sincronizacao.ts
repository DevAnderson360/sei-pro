/**
 * O diálogo "Sincronização": as quatro seções, os botões de cada estado, o texto antigo guardado, a cópia que
 * RECUPERA (só o que sumiu volta; o aviso diz o que voltou, por tipo) e os erros como texto (a memória do sigilo
 * ilegível no arquivo e na cópia do dia, a aba do SEI fechada, a cópia danificada, a situação que não lê).
 */

import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import type { StatusArquivo } from "@comum/sincronia/arquivo";
import { criarAbrirModal } from "@comum/ui/dialogo";
import type { SituacaoSincronia } from "../src/app/colaboracao/estado";
import { type DepsSincronizacao, montarSincronizacao } from "../src/app/dialogos/sincronizacao";
import { ErroMemoriaSigilo } from "../src/modelo/memoriaSigilo";
import { ErroValidacao } from "../src/modelo/validacao";
import type { CopiaProjetos, ResultadoRestauracao } from "../src/sincronia/arquivo";
import { rastrearFoco, telaDoApp, texto } from "./apoioApp";
import { HOSTIL } from "./cenarioGantt";
import { botao, checar, secao, tique } from "./util";

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const AGORA = Date.UTC(2026, 9, 6, 12);
const DIA = 86_400_000;
const MEMORIA = new ErroMemoriaSigilo().message;
const NADA: ResultadoRestauracao = { projetos: 0, fases: 0, etapas: 0, modelos: 0, registros: 0, noOutroEscopo: 0, rotulosDoOutro: [] };

function deps(m: Partial<DepsSincronizacao> = {}, situ?: Partial<SituacaoSincronia>) {
  const feitos: string[] = [];
  const baixados: Array<{ nome: string; conteudo: string; tipo: string }> = [];
  const perguntas: string[] = [];
  const resposta = { sim: true };
  let situacao: SituacaoSincronia = {
    unidade: {
      vis: "unidade",
      nome: "[_SEIPRO_PRJ_UNIDADE]",
      consentimento: "ligado",
      status: { estado: "ok", quando: AGORA, ultimoOk: AGORA, pendente: false },
    },
    eu: { vis: "eu", nome: "[_SEIPRO_PRJ_ana]", consentimento: "nao-perguntado" },
    ...situ,
  };
  const d: DepsSincronizacao = {
    sigla: "SEPRO",
    agora: () => AGORA + 60_000 * 3,
    situacao: async () => situacao,
    sincronizar: async () => void feitos.push("sincronizar"),
    pessoal: {
      ligar: async () => {
        feitos.push("ligar");
        situacao = { ...situacao, eu: { ...situacao.eu, consentimento: "ligado" } };
        return true;
      },
      desligar: async () => {
        feitos.push("desligar");
        situacao = { ...situacao, eu: { ...situacao.eu, consentimento: "desligado" } };
      },
      apagar: async () => {
        feitos.push("apagar");
        return true;
      },
    },
    arquivo: null,
    exportar: async () => void feitos.push("exportar"),
    importar: async () => void feitos.push("importar"),
    copias: null,
    baixar: (nome, conteudo, tipo) => baixados.push({ nome, conteudo, tipo }),
    confirmar: async (t) => {
      perguntas.push(t);
      return resposta.sim;
    },
    ...m,
  };
  const definir = (s: Partial<SituacaoSincronia>) => {
    situacao = { ...situacao, ...s };
  };
  return { d, feitos, baixados, perguntas, resposta, definir, situacao: () => situacao };
}

const ARQUIVO_LIGADO = (status: () => StatusArquivo | null, extra: Partial<NonNullable<DepsSincronizacao["arquivo"]>> = {}) => ({
  status: async () => status(),
  configurado: async () => true,
  escolher: async () => undefined,
  reconectar: async () => undefined,
  agora: async () => undefined,
  esquecer: async () => undefined,
  ...extra,
});

const COPIA: CopiaProjetos = {
  id: "x|2026-10-06",
  dono: "x",
  dia: "2026-10-06",
  quando: AGORA,
  quantidade: 3,
  envelope: { formato: "seipro-projetos", versao: 1, tipo: "copia", gerado: 1, escopos: [] },
};

const aviso = (el: Element, s: string) => el.querySelector(`[data-secao='${s}'] .prj-sync-aviso`);

export async function verificarAppSincronizacao(): Promise<void> {
  secao("app: dialogo Sincronizacao");
  const doc = telaDoApp();
  rastrearFoco(doc);
  const a = deps({ sigla: HOSTIL });
  const el = await montarSincronizacao(a.d);
  // Na página (o foco do linkedom só vale para o que está no documento), como dentro do diálogo.
  doc.body.append(el);
  const secoes = [...el.querySelectorAll("section")].map((s) => s.getAttribute("data-secao"));
  checar("as secoes da spec (sem copias quando nao ha banco)", secoes.join() === "unidade,eu,arquivo", secoes);
  checar("a sigla aparece como texto", texto(el.querySelector("h3")).includes(HOSTIL) && !el.querySelector("img"));
  checar("a linha de situacao da unidade", /Sincronizado há 3 min/.test(texto(el.querySelector("[data-texto='unidade']"))));
  checar(
    "o pessoal desligado explica e oferece Ligar…",
    /Desligado/.test(texto(el.querySelector("[data-texto='eu']"))) && !!botao(el, "Ligar…"),
  );
  checar("o texto da unidade nao tem apagar (e de todos)", !texto(el.querySelector("[data-secao='unidade']")).includes("Apagar"));
  checar("quem nunca ligou o pessoal nao ve Apagar o texto do SEI (so Ligar…)", !botao(el, "Apagar o texto do SEI"));
  checar(
    "Sincronizar agora so na secao da unidade (vale para os dois textos)",
    !!botao(el.querySelector("[data-secao='unidade']")!, "Sincronizar agora") &&
      !botao(el.querySelector("[data-secao='eu']")!, "Sincronizar agora"),
  );
  botao(el, "Sincronizar agora")?.click();
  await tique();
  const ligar = botao(el, "Ligar…");
  ligar?.focus();
  ligar?.click();
  await tique();
  checar("ligar repinta com Desligar e Desligar e apagar", !!botao(el, "Desligar") && !!botao(el, "Desligar e apagar do SEI"));
  checar(
    "o foco do teclado fica na linha repintada (o botao clicado sumiu)",
    texto(doc.activeElement) === "Desligar",
    texto(doc.activeElement),
  );
  checar("a linha do pessoal ligado", /falta abrir o Controle de Processos/.test(texto(el.querySelector("[data-texto='eu']"))));
  botao(el, "Desligar e apagar do SEI")?.click();
  await tique();
  checar("acoes chegam a quem faz", a.feitos.join() === "sincronizar,ligar,apagar", a.feitos);
  checar(
    "apagar pergunta antes, com o nome do texto",
    a.perguntas.length === 1 && a.perguntas[0]!.includes("[_SEIPRO_PRJ_ana]") && /continuam neste navegador/.test(a.perguntas[0]!),
    a.perguntas,
  );
  checar("apagar diz o que fez", /foi apagado do SEI/.test(texto(aviso(el, "eu"))), texto(aviso(el, "eu")));
  a.resposta.sim = false;
  botao(el, "Desligar e apagar do SEI")?.click();
  await tique();
  checar("sem confirmar, nada e apagado", a.feitos.filter((f) => f === "apagar").length === 1, a.feitos);
  botao(el, "Desligar")?.click();
  await tique();
  checar("desligar repinta com Ligar…", a.feitos.at(-1) === "desligar" && !!botao(el, "Ligar…") && !!botao(el, "Apagar o texto do SEI"));
  botao(el, "Exportar tudo")?.click();
  botao(el, "Importar de um arquivo…")?.click();
  await tique();
  checar(
    "sem arquivo ligado: exportar e importar a mao",
    a.feitos.slice(-2).join() === "exportar,importar" && /não dá para manter/.test(texto(el)),
  );
  const abrir = criarAbrirModal();
  abrir({ titulo: "Sincronização", icone: "nuvem", conteudo: el });
  checar(
    "aberto no modal, o foco entra no dialogo (botao principal)",
    !!doc.activeElement?.closest("dialog") && texto(doc.activeElement) === "Ligar…",
    texto(doc.activeElement),
  );
  checar(
    "todo botao tem rotulo",
    [...el.querySelectorAll("button")].every((b) => texto(b) !== "" || !!b.getAttribute("aria-label")),
  );
  doc.querySelector("dialog")?.remove();

  secao("app: Sincronizacao com o texto antigo, arquivo e copias");
  telaDoApp();
  const status: StatusArquivo = { estado: "ok", quando: AGORA, nome: "projetos.json" };
  const restaurados: string[] = [];
  let voltam: ResultadoRestauracao = { ...NADA, projetos: 1, fases: 2, etapas: 5, registros: 4 };
  const b = deps(
    {
      arquivo: ARQUIVO_LIGADO(() => status),
      copias: {
        listar: async () => [COPIA],
        restaurar: async (c) => {
          restaurados.push(c.dia);
          return voltam;
        },
      },
    },
    {
      eu: {
        vis: "eu",
        nome: "[_SEIPRO_PRJ_ana]",
        consentimento: "ligado",
        status: { estado: "ok", quando: AGORA, pendente: false },
        substituido: { quando: AGORA, motivo: "o texto foi editado", html: "<p>antigo</p>", cortado: false },
      },
    },
  );
  const el2 = await montarSincronizacao(b.d);
  checar("com banco: a secao das copias", [...el2.querySelectorAll("section")].length === 4);
  checar(
    "arquivo ligado: o nome e a ultima sincronia",
    /Ligado a “projetos.json”/.test(texto(el2.querySelector("[data-secao='arquivo']"))),
  );
  checar("com o arquivo ligado, sem o exportar e importar a mao (um botao a menos)", !botao(el2, "Exportar tudo"));
  // Revisão final da P4, item 6: dois "Sincronizar agora" no mesmo diálogo confundiam; o do arquivo diz o que faz.
  const visiveis = (raiz: ParentNode, t: string) => [...raiz.querySelectorAll("button")].filter((b) => texto(b) === t);
  checar(
    "o do arquivo e 'Sincronizar o arquivo': um 'Sincronizar agora' so no dialogo (o dos textos)",
    visiveis(el2.querySelector("[data-secao='arquivo']")!, "Sincronizar o arquivo").length === 1 &&
      visiveis(el2, "Sincronizar agora").length === 1 &&
      visiveis(el2.querySelector("[data-secao='unidade']")!, "Sincronizar agora").length === 1,
  );
  const subst = el2.querySelector(".prj-sync-substituido");
  checar("o texto pessoal que estava invalido: avisa e oferece baixar o antigo", /estava inválido/.test(texto(subst)));
  checar("sem corte, nao fala de pedaco", !/só o começo/.test(texto(subst)));
  const baixarEu = botao(el2, "Baixar o texto antigo");
  checar("o Baixar diz de qual texto ao leitor de tela", baixarEu?.getAttribute("aria-label") === "Baixar o texto antigo pessoal");
  baixarEu?.click();
  checar(
    "baixa o guardado como texto simples (.txt, nunca uma pagina que o navegador abriria)",
    b.baixados[0]?.conteudo === "<p>antigo</p>" &&
      b.baixados[0]?.nome === "projetos-texto-antigo-2026-10-06.txt" &&
      b.baixados[0]?.tipo === "text/plain;charset=utf-8",
    b.baixados,
  );
  checar("a copia mostra o dia e os projetos", /06\/10\/2026 — 3 projetos/.test(texto(el2.querySelector(".prj-copias"))));
  const dicaCopias = texto(el2.querySelector("[data-secao='copias']"));
  checar(
    "a dica das copias diz que restaurar recupera e nao volta no tempo",
    /excluído ou sumiu/.test(dicaCopias) &&
      /o que existe hoje não muda/i.test(dicaCopias) &&
      !/mantém o que entrou depois/.test(dicaCopias),
    dicaCopias,
  );
  const restaurar = botao(el2.querySelector(".prj-copias")!, "Restaurar");
  checar(
    "o Restaurar de cada copia diz o dia ao leitor de tela",
    restaurar?.getAttribute("aria-label") === "Restaurar a cópia de 06/10/2026",
  );
  checar("o Restaurar e discreto (fantasma pequeno)", restaurar?.className === "spro-botao fantasma pequeno", restaurar?.className);
  b.resposta.sim = false;
  restaurar?.click();
  await tique();
  checar("sem confirmar, nada e restaurado", restaurados.length === 0 && texto(aviso(el2, "copias")) === "");
  checar(
    "a pergunta: o dia, o que volta e o que nao muda",
    b.perguntas.at(-1) ===
      "Restaurar a cópia de 06/10/2026? Traz de volta o que foi excluído ou sumiu desde então. O que existe hoje não muda.",
    b.perguntas,
  );
  b.resposta.sim = true;
  restaurar?.click();
  await tique();
  checar("restaurar (com confirmacao)", restaurados.join() === "2026-10-06");
  const avisoCp = () => texto(aviso(el2, "copias"));
  checar(
    "o aviso do que voltou, por tipo (sem os registros quando volta mais)",
    avisoCp() === "Voltaram 1 projeto, 2 fases e 5 etapas.",
    avisoCp(),
  );
  checar("o aviso e lido pelo leitor de tela", aviso(el2, "copias")?.getAttribute("role") === "status");
  const restaurarCom = async (r: Partial<ResultadoRestauracao>) => {
    voltam = { ...NADA, ...r };
    restaurar?.click();
    await tique();
    return avisoCp();
  };
  checar("uma parte so, com 1: Voltou", (await restaurarCom({ etapas: 1 })) === "Voltou 1 etapa.", avisoCp());
  checar("uma parte so, com mais de 1: Voltaram", (await restaurarCom({ projetos: 2 })) === "Voltaram 2 projetos.", avisoCp());
  checar(
    "duas partes com 1 cada: Voltaram, com e",
    (await restaurarCom({ projetos: 1, modelos: 1 })) === "Voltaram 1 projeto e 1 modelo.",
    avisoCp(),
  );
  checar(
    "so registros: Voltaram N registros do historico",
    (await restaurarCom({ registros: 3 })) === "Voltaram 3 registros do histórico.",
    avisoCp(),
  );
  checar("um registro so: Voltou", (await restaurarCom({ registros: 1 })) === "Voltou 1 registro do histórico.", avisoCp());
  checar(
    "nada voltou: diz que tudo ainda existe",
    (await restaurarCom({})) === "Nada para recuperar: tudo o que estava na cópia ainda existe.",
    avisoCp(),
  );

  checar(
    "nada voltou porque o que faltava esta no outro escopo: diz onde",
    (await restaurarCom({ noOutroEscopo: 2, rotulosDoOutro: ["Toda a unidade"] })) ===
      "Nada voltou: o que faltava está em “Toda a unidade” ou foi excluído lá.",
    avisoCp(),
  );
  checar(
    "e nos dois escopos",
    (await restaurarCom({ noOutroEscopo: 2, rotulosDoOutro: ["Toda a unidade", "Só eu"] })) ===
      "Nada voltou: o que faltava está em “Toda a unidade” e “Só eu” ou foi excluído lá.",
    avisoCp(),
  );

  secao("app: Sincronizacao mostra os erros como texto");
  telaDoApp();
  const ruim: StatusArquivo = { estado: "erro", quando: AGORA, nome: HOSTIL, mensagem: MEMORIA };
  let falhaRestaurar: Error = new ErroMemoriaSigilo();
  const c = deps(
    {
      sigla: "SEPRO",
      sincronizar: async () => {
        throw new Error("A aba do SEI foi fechada.");
      },
      arquivo: ARQUIVO_LIGADO(() => ruim, {
        escolher: async () => {
          throw new Error(HOSTIL);
        },
      }),
      copias: {
        listar: async () => [COPIA],
        restaurar: async () => {
          throw falhaRestaurar;
        },
        falhaDoDia: () => MEMORIA,
      },
    },
    {
      unidade: {
        vis: "unidade",
        nome: "[_SEIPRO_PRJ_UNIDADE]",
        consentimento: "ligado",
        status: { estado: "ok", quando: AGORA, pendente: false },
        substituido: { quando: AGORA, motivo: HOSTIL, html: "<p>x</p>", cortado: true },
      },
    },
  );
  const el3 = await montarSincronizacao(c.d);
  const arq = el3.querySelector("[data-secao='arquivo']");
  checar("arquivo parado pela memoria do sigilo: a mensagem como texto", texto(arq).includes(`Erro no arquivo: ${MEMORIA}`), texto(arq));
  checar("o erro do arquivo em destaque", !!arq?.querySelector(".prj-sync-erro"));
  checar("o texto substituido da unidade: motivo hostil como texto", texto(el3.querySelector(".prj-sync-substituido")).includes(HOSTIL));
  checar(
    "o Baixar da unidade diz de qual texto",
    botao(el3, "Baixar o texto antigo")?.getAttribute("aria-label") === "Baixar o texto antigo da unidade",
  );
  checar("cortado: diz que so o comeco ficou guardado", /só o começo/.test(texto(el3.querySelector(".prj-sync-substituido"))));
  checar("nada de html hostil vira elemento", !el3.querySelector("img"));
  const cps = el3.querySelector("[data-secao='copias']");
  checar(
    "a copia de hoje parada pela memoria: a mensagem como texto",
    texto(cps).includes(`A cópia de hoje não foi feita. ${MEMORIA}`),
    texto(cps),
  );
  const sinc = botao(el3, "Sincronizar agora");
  sinc?.click();
  await tique();
  checar("Sincronizar agora que falha: o erro na secao, como texto", texto(aviso(el3, "unidade")) === "A aba do SEI foi fechada.");
  checar("o botao volta a responder depois do erro", sinc?.getAttribute("aria-disabled") !== "true");
  botao(el3, "Trocar arquivo…")?.click();
  await tique();
  checar("o erro de escolher o arquivo como texto", texto(aviso(el3, "arquivo")) === HOSTIL && !el3.querySelector("img"));
  botao(el3.querySelector(".prj-copias")!, "Restaurar")?.click();
  await tique();
  checar("restaurar parado pela memoria do sigilo: a mensagem", texto(aviso(el3, "copias")) === MEMORIA, texto(aviso(el3, "copias")));
  falhaRestaurar = new ErroValidacao(["Esta cópia está danificada e não pode ser restaurada. Escolha a de outro dia."]);
  botao(el3.querySelector(".prj-copias")!, "Restaurar")?.click();
  await tique();
  checar("copia danificada: a mensagem do repositorio", /danificada/.test(texto(aviso(el3, "copias"))));

  secao("app: Sincronizacao sem arquivo ligado e com as copias ilegiveis");
  telaDoApp();
  const e = deps({
    exportar: async () => {
      throw new ErroMemoriaSigilo();
    },
    importar: async () => "3 projetos novos.",
    copias: {
      listar: async () => {
        throw new Error("IndexedDB fechado");
      },
      restaurar: async () => NADA,
    },
  });
  const el4 = await montarSincronizacao(e.d);
  checar(
    "as copias que nao leem: explica, sem lista",
    /Não foi possível ler as cópias: IndexedDB fechado/.test(texto(el4)) && !el4.querySelector(".prj-copias"),
  );
  checar("sem falha do dia informada, nada sobre a copia de hoje", !/A cópia de hoje/.test(texto(el4)));
  botao(el4, "Exportar tudo")?.click();
  await tique();
  checar("exportar parado pela memoria do sigilo: a mensagem", texto(aviso(el4, "arquivo")) === MEMORIA, texto(aviso(el4, "arquivo")));
  botao(el4, "Importar de um arquivo…")?.click();
  await tique();
  checar("importar: a frase do resultado aparece", texto(aviso(el4, "arquivo")) === "3 projetos novos.");
  const vazio = deps({ copias: { listar: async () => [], restaurar: async () => NADA } });
  checar("sem copias ainda", /Ainda não há cópias/.test(texto(await montarSincronizacao(vazio.d))));

  await verificarRodada1();
}

/** Rodada 1 da revisão: aviso que fica na árvore, ao vivo, apagar que falha, 30 dias, situação que não lê, caminhos sem prova. */
async function verificarRodada1(): Promise<void> {
  secao("app: Sincronizacao, a linha de aviso fica na arvore (o leitor de tela anuncia)");
  const css = await readFile(join(RAIZ, "estatico/projetos.css"), "utf8");
  const regras = [...css.matchAll(/([^{}]+)\{([^}]*)\}/g)].filter((m) => m[1]!.includes("prj-sync-aviso"));
  checar(
    "nenhuma regra esconde o aviso (display: none tira do leitor de tela)",
    regras.length > 0 && regras.every((m) => !/display:\s*none/.test(m[2]!)),
    regras.map((m) => m[0]),
  );
  checar(
    "vazio, o aviso nao ocupa espaco: margem negativa igual ao gap da secao",
    regras.some((m) => /\.prj-sync-aviso:empty/.test(m[1]!) && /margin-top:\s*-8px/.test(m[2]!)) &&
      /\.prj-sync-secao \{[^}]*gap: 8px/.test(css),
  );

  secao("app: Sincronizacao repinta quando a sincronia muda e se desinscreve fechada");
  const doc = telaDoApp();
  let ouvinte: ((s: SituacaoSincronia) => void) | null = null;
  let saidas = 0;
  const a = deps({
    aoMudar: (f) => {
      ouvinte = f;
      return () => {
        saidas++;
        ouvinte = null;
      };
    },
  });
  const el = await montarSincronizacao(a.d);
  doc.body.append(el);
  checar("inscreve ao montar", !!ouvinte);
  const linhaUn = () => texto(el.querySelector("[data-texto='unidade']"));
  const mudou: SituacaoSincronia = {
    unidade: { ...a.situacao().unidade, status: { estado: "erro", quando: AGORA, pendente: false, mensagem: "o SEI recusou" } },
    eu: { ...a.situacao().eu, consentimento: "ligado" },
  };
  (ouvinte as ((s: SituacaoSincronia) => void) | null)?.(mudou);
  await tique();
  checar("a linha da unidade repinta com a situacao nova", linhaUn() === "Erro: o SEI recusou", linhaUn());
  checar("e as acoes do pessoal tambem (ligado em outro lugar)", !!botao(el, "Desligar") && !botao(el, "Ligar…"));
  el.remove();
  (ouvinte as ((s: SituacaoSincronia) => void) | null)?.({ ...mudou, unidade: { ...mudou.unidade, status: undefined } });
  await tique();
  checar("fechado (fora da pagina): desinscreve e nao repinta", saidas === 1 && !ouvinte && linhaUn() === "Erro: o SEI recusou", [
    saidas,
    linhaUn(),
  ]);

  secao("app: Sincronizacao, apagar que falha repinta (o controle ja desligou)");
  telaDoApp();
  const b = deps({}, { eu: { vis: "eu", nome: "[_SEIPRO_PRJ_ana]", consentimento: "ligado" } });
  b.d.pessoal.apagar = async () => {
    b.definir({ eu: { ...b.situacao().eu, consentimento: "desligado" } });
    throw new Error("O SEI não respondeu.");
  };
  const el2 = await montarSincronizacao(b.d);
  botao(el2, "Desligar e apagar do SEI")?.click();
  await tique();
  checar("o erro aparece como texto", texto(aviso(el2, "eu")) === "O SEI não respondeu.", texto(aviso(el2, "eu")));
  checar(
    "e a secao mostra o desligado de verdade",
    !!botao(el2, "Ligar…") && !!botao(el2, "Apagar o texto do SEI") && !botao(el2, "Desligar"),
  );
  b.d.pessoal.apagar = async () => false;
  botao(el2, "Apagar o texto do SEI")?.click();
  await tique();
  checar(
    "sem texto no SEI: diz que nao havia",
    texto(aviso(el2, "eu")) === "Não havia o texto “[_SEIPRO_PRJ_ana]” no SEI.",
    texto(aviso(el2, "eu")),
  );

  secao("app: Sincronizacao, o aviso do texto substituido some depois de 30 dias");
  telaDoApp();
  const subst = (dias: number) =>
    deps(
      {},
      { unidade: { ...deps().situacao().unidade, substituido: { quando: AGORA - dias * DIA, motivo: "x", html: "y", cortado: false } } },
    );
  checar("com 29 dias ainda aparece", !!(await montarSincronizacao(subst(29).d)).querySelector(".prj-sync-substituido"));
  checar("com 31 dias some", !(await montarSincronizacao(subst(31).d)).querySelector(".prj-sync-substituido"));

  secao("app: Sincronizacao abre mesmo com a situacao que nao le");
  telaDoApp();
  let falhar = true;
  const c = deps();
  const situacaoBoa = c.d.situacao;
  c.d.situacao = async () => {
    if (falhar) throw new Error("storage fora do ar");
    return situacaoBoa();
  };
  const el3 = await montarSincronizacao(c.d).catch(() => null);
  checar("o dialogo abre (as secoes todas)", [...(el3?.querySelectorAll("section") ?? [])].length === 3);
  const lnUn = () => texto(el3?.querySelector("[data-texto='unidade']"));
  checar(
    "a linha diz que nao leu, como texto e em destaque",
    lnUn() === "Não foi possível ler a situação da sincronia: storage fora do ar" &&
      !!el3?.querySelector("[data-texto='eu'].prj-sync-erro"),
    lnUn(),
  );
  checar("sem saber o consentimento, sem botoes do pessoal", !botao(el3!, "Ligar…") && !botao(el3!, "Desligar"));
  falhar = false;
  botao(el3!, "Sincronizar agora")?.click();
  await tique();
  checar(
    "lida de novo: repinta a situacao, o nome do texto e os botoes",
    /Sincronizado há 3 min/.test(lnUn()) &&
      !el3?.querySelector("[data-texto='unidade'].prj-sync-erro") &&
      texto(el3?.querySelector("[data-secao='unidade']")).includes("[_SEIPRO_PRJ_UNIDADE]") &&
      !!botao(el3!, "Ligar…"),
    lnUn(),
  );

  secao("app: Sincronizacao, caminhos do arquivo e o segundo clique");
  telaDoApp();
  let solta: () => void = () => undefined;
  let chamadas = 0;
  const e = deps({
    sincronizar: () => {
      chamadas++;
      return new Promise<void>((ok) => {
        solta = ok;
      });
    },
  });
  const el4 = await montarSincronizacao(e.d);
  const sinc = botao(el4, "Sincronizar agora");
  sinc?.click();
  sinc?.click();
  await tique();
  checar("o segundo clique durante a acao e ignorado", chamadas === 1 && sinc?.getAttribute("aria-disabled") === "true", chamadas);
  solta();
  await tique();
  sinc?.click();
  await tique();
  checar("terminada a acao, o botao volta a responder", chamadas === 2, chamadas);
  solta();

  const escolhas: string[] = [];
  let configurado = false;
  let st: StatusArquivo | null = null;
  const f = deps({
    arquivo: ARQUIVO_LIGADO(() => st, {
      configurado: async () => configurado,
      escolher: async (modo) => void escolhas.push(modo),
      reconectar: async () => void escolhas.push("reconectar"),
      esquecer: async () => {
        escolhas.push("esquecer");
        configurado = false;
        st = null;
      },
    }),
  });
  const el5 = await montarSincronizacao(f.d);
  const arq = () => el5.querySelector("[data-secao='arquivo']")!;
  checar(
    "arquivo possivel e nao escolhido: Criar, Usar e o a mao",
    /Escolha um arquivo numa pasta/.test(texto(arq())) &&
      ["Criar arquivo…", "Usar um arquivo existente…", "Exportar tudo", "Importar de um arquivo…"].every((r) => !!botao(arq(), r)) &&
      botao(arq(), "Criar arquivo…")?.className === "spro-botao primario",
  );
  botao(arq(), "Criar arquivo…")?.click();
  await tique();
  botao(arq(), "Usar um arquivo existente…")?.click();
  await tique();
  checar("Criar e Usar chegam ao seletor certo", escolhas.join() === "novo,existente", escolhas);
  configurado = true;
  st = { estado: "permissao", quando: AGORA, nome: "projetos.json" };
  botao(arq(), "Usar um arquivo existente…")?.click();
  await tique();
  checar(
    "sem permissao: explica e oferece Reconectar (principal)",
    /O navegador pede de novo a permissão de “projetos.json”/.test(texto(arq())) &&
      botao(arq(), "Reconectar arquivo")?.className === "spro-botao primario" &&
      !botao(arq(), "Exportar tudo"),
    texto(arq()),
  );
  botao(arq(), "Reconectar arquivo")?.click();
  await tique();
  checar("Reconectar chega a quem faz", escolhas.at(-1) === "reconectar", escolhas);
  botao(arq(), "Parar de usar o arquivo")?.click();
  await tique();
  checar(
    "Parar de usar: esquece e diz como voltar",
    escolhas.at(-1) === "esquecer" &&
      texto(aviso(el5, "arquivo")) === "O arquivo continua na pasta. Para voltar a usá-lo: “Usar um arquivo existente…”." &&
      !!botao(arq(), "Usar um arquivo existente…"),
    texto(aviso(el5, "arquivo")),
  );
  const g = deps({
    arquivo: ARQUIVO_LIGADO(() => null, {
      status: async () => {
        throw new Error("storage recusou");
      },
    }),
  });
  const el6 = await montarSincronizacao(g.d);
  checar(
    "status do arquivo que lanca: explica, sem derrubar o dialogo",
    texto(el6.querySelector("[data-secao='arquivo']")).includes("Não foi possível ler o estado do arquivo: storage recusou"),
  );
}
