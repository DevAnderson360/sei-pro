/**
 * Os diálogos "Modelos de projeto" (lista, renomear na própria linha, excluir com confirmação, "Criar
 * projeto" que fecha este diálogo) e "Histórico de alterações" (por dia, do mais recente, filtrável por
 * projeto; campo de versão mais nova pelo nome; os textos de sigilo como texto; tudo de fora cortado).
 */

import type { AbrirModal } from "@comum/ui/dialogo";
import type { ModeloNaTela } from "../src/app/dados";
import { abrirHistorico, linhaDoRegistro, type NomesDoHistorico, type RegistroNaTela } from "../src/app/dialogos/historico";
import { abrirModelos, type ContextoModelos } from "../src/app/dialogos/modelos";
import { quemDoRegistro, resumoDoUltimoRegistro, textoDoRegistro } from "../src/app/formato";
import { SIGILOSO_DOCUMENTO, SIGILOSO_PROCESSO } from "../src/modelo/sigilo";
import { ErroValidacao } from "../src/modelo/validacao";
import { MODELOS_EMBUTIDOS } from "../src/modelos/embutidos";
import { combo, digitar, escolherCombo, rastrearFoco, telaDoApp, texto } from "./apoioApp";
import { HOSTIL } from "./cenarioGantt";
import { botao, checar, secao, tique } from "./util";

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

/** Nenhum meio caractere: todo substituto alto seguido de um baixo, e todo baixo depois de um alto. */
function semMeioCaractere(t: string): boolean {
  for (let i = 0; i < t.length; i++) {
    const c = t.charCodeAt(i);
    const alto = (x: number) => x >= 0xd800 && x <= 0xdbff;
    const baixo = (x: number) => x >= 0xdc00 && x <= 0xdfff;
    if (alto(c) && !baixo(t.charCodeAt(i + 1))) return false;
    if (baixo(c) && !alto(t.charCodeAt(i - 1))) return false;
  }
  return true;
}

/** Tecla que devolve se alguém impediu o padrão (Esc no campo não pode fechar o diálogo). */
function teclaImpedida(el: Element, key: string): boolean {
  const Ev = (el.ownerDocument.defaultView as unknown as { Event: typeof Event }).Event;
  const ev = new Ev("keydown", { bubbles: true, cancelable: true });
  Object.defineProperty(ev, "key", { value: key });
  el.dispatchEvent(ev);
  return ev.defaultPrevented;
}

const salvo: ModeloNaTela = {
  id: "m1",
  nome: HOSTIL,
  fases: ["Fase"],
  etapas: [{ nome: "A", aPartirDe: 0, duracao: 2, marco: false, dependeDe: [], checklist: [] }],
  criadoEm: 1,
  atualizadoEm: 1,
  dispositivo: "d",
  vis: "unidade",
};

const semFases: ModeloNaTela = {
  id: "m2",
  nome: "Rotina",
  fases: [],
  etapas: [
    { nome: "A", aPartirDe: 0, duracao: 2, marco: false, dependeDe: [], checklist: [] },
    { nome: "B", aPartirDe: 2, duracao: 2, marco: false, dependeDe: [], checklist: [] },
  ],
  criadoEm: 1,
  atualizadoEm: 1,
  dispositivo: "d",
  vis: "eu",
};

const reg = (m: Partial<RegistroNaTela> & { id: string }): RegistroNaTela => ({
  alvo: "e1",
  projeto: "p1",
  quando: new Date(2026, 9, 6, 14, 32).getTime(),
  por: "ana",
  nome: "Ana Lima",
  campo: "fim",
  antes: "2026-09-25",
  depois: "2026-10-02",
  atualizadoEm: 1,
  dispositivo: "d",
  vis: "unidade",
  ...m,
});

async function provarModelos(): Promise<void> {
  secao("app: dialogo Modelos de projeto");
  const doc = telaDoApp();
  rastrearFoco(doc);
  const m = modais(doc);
  const feitos: string[] = [];
  const perguntas: string[] = [];
  let recusar = false;
  let responder = true;
  let falharExcluir = false;
  const ctx: ContextoModelos = {
    abrirModal: m.abrirModal,
    modelos: [...MODELOS_EMBUTIDOS, salvo, semFases],
    confirmar: async (t) => {
      perguntas.push(t);
      return responder;
    },
    renomear: async (x, nome) => {
      if (recusar) throw new ErroValidacao(["O nome pode ter até 200 caracteres."]);
      feitos.push(`renomear:${x.id}:${nome}`);
    },
    excluir: async (x) => {
      if (falharExcluir) throw new ErroValidacao(["Sem o Entendi, nada é gravado na unidade."]);
      feitos.push(`excluir:${x.id}`);
    },
    criarProjeto: (x) => feitos.push(`criar:${x.id}`),
  };
  abrirModelos(ctx);
  const dlg = () => m.abertos.at(-1)!.conteudo;
  const linha = (id: string) => dlg().querySelector<HTMLElement>(`.prj-modelo[data-id='${id}']`)!;
  const linhas = [...dlg().querySelectorAll(".prj-modelo")];
  checar("os 3 embutidos e os salvos", linhas.length === 5, linhas.length);
  checar("titulo do dialogo", m.abertos.at(-1)!.titulo === "Modelos de projeto");
  checar(
    "Criar projeto das linhas nao e primario (como no Arquivados)",
    linhas.every((l) => !botao(l, "Criar projeto")?.classList.contains("primario")),
  );
  const filhos = [...dlg().children];
  checar(
    "os erros ficam acima da lista (como no Historico)",
    filhos.indexOf(dlg().querySelector(".prj-erros")!) < filhos.indexOf(dlg().querySelector(".prj-modelos")!),
  );
  const embutido = linhas[0]!;
  checar(
    "embutido: so Criar projeto (nao renomeia nem exclui)",
    embutido.querySelectorAll("button").length === 1 && /exemplo do SEI Pro/.test(texto(embutido)),
  );
  checar("embutido: quantas etapas em quantas fases", /9 etapas em 3 fases/.test(texto(embutido)), texto(embutido));
  const meu = linha("m1");
  checar(
    "o salvo diz onde esta e tem Renomear e Excluir",
    /Toda a unidade/.test(texto(meu)) && !!botao(meu, "Renomear") && !!botao(meu, "Excluir"),
  );
  checar("salvo: 1 etapa em 1 fase", /1 etapa em 1 fase/.test(texto(meu)), texto(meu));
  checar(
    "modelo sem fases nao diz 'em 0 fases'",
    /2 etapas · Só eu/.test(texto(linha("m2"))) && !/0 fases/.test(texto(linha("m2"))),
    texto(linha("m2")),
  );
  checar("nome hostil como texto", texto(meu.querySelector(".prj-modelo-nome")) === HOSTIL && !meu.querySelector("img"));

  // Renomear: o campo na própria linha, com o foco; Esc cancela sem fechar o diálogo.
  botao(meu, "Renomear")?.click();
  const campo = meu.querySelector<HTMLInputElement>("input[aria-label='Nome do modelo']");
  checar("renomear: campo na propria linha, com o nome atual e o foco", campo?.value === HOSTIL && doc.activeElement === campo);
  checar("renomear: o campo respeita o limite do nome", campo?.getAttribute("maxlength") === "200");
  checar("Esc no campo cancela sem fechar o dialogo", teclaImpedida(campo!, "Escape") && !linha("m1").querySelector("input"));
  checar("cancelar volta o foco ao Renomear da linha", doc.activeElement === botao(linha("m1"), "Renomear") && m.abertos.at(-1)!.aberto);

  // Nome vazio e nome igual não gravam.
  botao(linha("m1"), "Renomear")?.click();
  digitar(linha("m1").querySelector("input"), "   ");
  botao(linha("m1"), "Salvar")?.click();
  await tique();
  checar(
    "nome vazio: pede o nome sem chamar o repositorio",
    /Informe o nome do modelo/.test(texto(dlg().querySelector(".prj-erros"))) && feitos.length === 0,
    texto(dlg().querySelector(".prj-erros")),
  );
  digitar(linha("m1").querySelector("input"), ` ${HOSTIL} `);
  botao(linha("m1"), "Salvar")?.click();
  await tique();
  checar(
    "nome igual: sai da edicao sem gravar e limpa o erro",
    feitos.length === 0 && !linha("m1").querySelector("input") && !!dlg().querySelector<HTMLElement>(".prj-erros")?.hidden,
  );

  // Recusado pelo repositório: mostra o erro e continua editando; depois grava (Enter no campo).
  const meu2 = linha("m1");
  botao(meu2, "Renomear")?.click();
  const campo2 = meu2.querySelector<HTMLInputElement>("input[aria-label='Nome do modelo']");
  recusar = true;
  digitar(campo2, "Novo nome");
  botao(meu2, "Salvar")?.click();
  await tique();
  checar(
    "renomear recusado: mostra o erro e fica editando",
    /200 caracteres/.test(texto(dlg().querySelector(".prj-erros"))) && !!meu2.querySelector("input"),
  );
  recusar = false;
  checar("Enter no campo salva", teclaImpedida(campo2!, "Enter"));
  await tique();
  checar(
    "renomear grava e volta a lista com o nome novo",
    feitos.at(-1) === "renomear:m1:Novo nome" && /Novo nome/.test(texto(linha("m1"))),
    feitos,
  );
  checar(
    "depois de gravar: erro limpo e o foco no Renomear da linha",
    !!dlg().querySelector<HTMLElement>(".prj-erros")?.hidden && doc.activeElement === botao(linha("m1"), "Renomear"),
  );

  // Excluir: pergunta (dizendo que é para toda a unidade); "Cancelar" mantém; erro aparece; confirmado tira.
  responder = false;
  botao(linha("m1"), "Excluir")?.click();
  await tique();
  checar(
    "excluir pergunta pelo nome e diz que sai para toda a unidade",
    perguntas.at(-1)?.includes("“Novo nome”") === true && /toda a unidade/.test(perguntas.at(-1) ?? ""),
    perguntas.at(-1),
  );
  checar("excluir cancelado: fica na lista sem gravar", !!linha("m1") && !feitos.includes("excluir:m1"));
  responder = true;
  falharExcluir = true;
  botao(linha("m1"), "Excluir")?.click();
  await tique();
  checar(
    "excluir recusado (sem o Entendi): mostra o erro e fica na lista",
    /Entendi/.test(texto(dlg().querySelector(".prj-erros"))) && !!linha("m1"),
  );
  falharExcluir = false;
  botao(linha("m1"), "Excluir")?.click();
  await tique();
  checar("excluir (confirmado) tira da lista", feitos.at(-1) === "excluir:m1" && !dlg().querySelector(".prj-modelo[data-id='m1']"));
  checar(
    "depois de excluir o foco fica na lista (na linha que tomou o lugar)",
    doc.activeElement !== doc.body && linha("m2").contains(doc.activeElement),
  );
  botao(linha("m2"), "Excluir")?.click();
  await tique();
  checar("o Excluir do modelo pessoal nao fala da unidade", feitos.at(-1) === "excluir:m2" && !/unidade/.test(perguntas.at(-1) ?? ""));

  botao(dlg().querySelector(".prj-modelo")!, "Criar projeto")?.click();
  checar(
    "Criar projeto fecha este dialogo e pede o Novo projeto no modelo",
    feitos.at(-1) === `criar:${MODELOS_EMBUTIDOS[0]!.id}` && !m.abertos.at(-1)!.aberto,
  );
}

async function provarHistorico(): Promise<void> {
  secao("app: dialogo Historico de alteracoes");
  const doc = telaDoApp();
  const m = modais(doc);
  const nomes: NomesDoHistorico = {
    alvo: (id) =>
      id === "e1"
        ? { tipo: "etapa", nome: HOSTIL }
        : id === "p1"
          ? { tipo: "projeto", nome: "Pregão" }
          : id === "p2"
            ? { tipo: "projeto", nome: "Plano" }
            : undefined,
  };
  const ontem = new Date(2026, 9, 5, 9, 5).getTime();
  const registros = [
    reg({ id: "r1" }),
    reg({ id: "r2", alvo: "p1", campo: "criacao", antes: undefined, depois: "Pregão", quando: ontem }),
    reg({
      id: "r3",
      alvo: "p2",
      projeto: "p2",
      campo: "custo" as RegistroNaTela["campo"],
      antes: "10",
      depois: "20",
      por: "bia",
      nome: undefined,
      vis: "eu",
    }),
    reg({ id: "r4", alvo: "sumiu", campo: "nome", antes: "x", depois: "y" }),
  ];
  const projetos = [
    { id: "p1", nome: "Pregão" },
    { id: "p2", nome: "Plano" },
  ];
  await abrirHistorico({ abrirModal: m.abrirModal, projetos, registros: async () => registros, nomes });
  const h = () => m.abertos.at(-1)!.conteudo;
  checar("titulo do dialogo", m.abertos.at(-1)!.titulo === "Histórico de alterações");
  const dias = [...h().querySelectorAll(".prj-historico-dia h3")].map((x) => texto(x));
  checar("agrupado por dia, do mais recente", dias.join() === "06/10/2026,05/10/2026", dias);
  const linhasH = [...h().querySelectorAll(".prj-historico-reg")].map((x) => texto(x));
  checar(
    "hora, quem, onde e o que",
    linhasH.some((l) => l.startsWith("14:32") && l.includes("Ana Lima") && l.includes("término 25/09 → 02/10")),
    linhasH,
  );
  checar("nome hostil do alvo como texto", !h().querySelector("img") && linhasH.some((l) => l.includes(HOSTIL)));
  checar(
    "campo que esta versao nao conhece: pelo nome, generico",
    linhasH.some((l) => l.includes("custo 10 → 20") && l.includes("bia")),
    linhasH,
  );
  checar(
    "alvo que sumiu",
    linhasH.some((l) => l.includes("Item que não existe mais")),
  );
  checar(
    "em Todos, a etapa diz de que projeto e",
    linhasH.some((l) => l.includes(`Etapa “${HOSTIL}” em “Pregão”`)),
    linhasH,
  );
  checar(
    "o projeto nao repete o proprio nome",
    linhasH.some((l) => l.includes("Projeto “Plano” · custo")),
    linhasH,
  );
  const vis = [...h().querySelectorAll(".prj-historico-vis")].map((x) => x.getAttribute("aria-label"));
  checar("onde o registro esta (unidade ou so eu), lido pelo leitor de tela", vis.includes("Toda a unidade") && vis.includes("Só eu"), vis);
  escolherCombo(h(), "Projeto", "p2");
  checar("filtrar por projeto", h().querySelectorAll(".prj-historico-reg").length === 1);
  escolherCombo(h(), "Projeto", "p1");
  checar(
    "filtrado no projeto, a etapa nao repete o projeto",
    [...h().querySelectorAll(".prj-historico-reg")].every((x) => !texto(x).includes("em “Pregão”")),
  );
  escolherCombo(h(), "Projeto", "");
  checar("todos de novo", h().querySelectorAll(".prj-historico-reg").length === 4);

  // Aberto pelo painel de um projeto: já filtrado nele.
  await abrirHistorico({ abrirModal: m.abrirModal, projetos, registros: async () => registros, nomes, projeto: "p2" });
  checar(
    "aberto ja filtrado no projeto",
    h().querySelectorAll(".prj-historico-reg").length === 1 && /Plano/.test(texto(combo(h(), "Projeto"))),
  );

  // Um projeto só: o filtro não aparece (não há o que escolher).
  await abrirHistorico({ abrirModal: m.abrirModal, projetos: [projetos[0]!], registros: async () => registros, nomes });
  checar("um projeto so: sem o filtro", !combo(h(), "Projeto") && h().querySelectorAll(".prj-historico-reg").length === 4);

  await abrirHistorico({ abrirModal: m.abrirModal, projetos: [], registros: async () => [], nomes });
  checar("vazio explica", /Nenhuma alteração registrada/.test(texto(h())));

  // Carimbo finito mas fora do alcance de Date (só por texto forjado): sem "NaN".
  await abrirHistorico({
    abrirModal: m.abrirModal,
    projetos,
    registros: async () => [reg({ id: "q1", quando: 9e15 }), reg({ id: "q2" })],
    nomes,
  });
  const diasQ = [...h().querySelectorAll(".prj-historico-dia h3")].map((x) => texto(x));
  checar(
    "quando invalido: 'data desconhecida', sem NaN",
    diasQ.includes("data desconhecida") && diasQ.includes("06/10/2026") && !texto(h()).includes("NaN"),
    [diasQ, texto(h())],
  );

  // Os textos de sigilo (o processo e o documento que não vão ao texto da unidade) aparecem como texto.
  await abrirHistorico({
    abrirModal: m.abrirModal,
    projetos,
    registros: async () => [
      reg({ id: "s1", campo: "processo", antes: "50300.000001/2026-11", depois: SIGILOSO_PROCESSO }),
      reg({ id: "s2", campo: "documento", antes: undefined, depois: SIGILOSO_DOCUMENTO }),
      reg({ id: "s3", alvo: "p1", campo: "processo", antes: SIGILOSO_PROCESSO, depois: SIGILOSO_PROCESSO }),
      reg({ id: "s4", campo: "documento", antes: SIGILOSO_DOCUMENTO, depois: SIGILOSO_DOCUMENTO }),
      reg({ id: "s5", campo: "processo", antes: SIGILOSO_PROCESSO, depois: "50300.000002/2026-22" }),
    ],
    nomes,
  });
  const sig = [...h().querySelectorAll(".prj-historico-reg")].map((x) => texto(x));
  checar(
    "sigilo: o valor sigiloso aparece como 'sigiloso'",
    sig.some((l) => l.includes("processo 50300.000001/2026-11 → sigiloso")) &&
      sig.some((l) => l.includes("documento — → sigiloso")) &&
      sig.some((l) => l.includes("processo sigiloso → 50300.000002/2026-22")),
    sig,
  );
  checar(
    "sigilo: os dois lados sigilosos viram 'trocou o ... sigiloso'",
    sig.some((l) => l.endsWith("· trocou o processo sigiloso")) && sig.some((l) => l.endsWith("· trocou o documento sigiloso")),
    sig,
  );
  checar(
    "sigilo: so no proprio campo (uma etapa chamada 'processo sigiloso' fica com o nome)",
    textoDoRegistro({ campo: "nome", antes: SIGILOSO_PROCESSO, depois: "Etapa" }) === "nome processo sigiloso → Etapa" &&
      textoDoRegistro({ campo: "processo", antes: SIGILOSO_DOCUMENTO, depois: undefined }) ===
        "processo documento de processo sigiloso → —",
  );
  checar("sigilo: nenhum link montado", !h().querySelector("a") && !h().querySelector("[href]"));

  // A leitura que falha não impede o diálogo: a mensagem aparece como texto.
  await abrirHistorico({
    abrirModal: m.abrirModal,
    projetos,
    registros: async () => {
      throw new Error(HOSTIL);
    },
    nomes,
  });
  checar(
    "registros que nao leem: o dialogo abre com o erro como texto",
    /Não foi possível ler o histórico/.test(texto(h().querySelector(".prj-erros"))) &&
      texto(h()).includes(HOSTIL) &&
      !h().querySelector("img"),
    texto(h()),
  );

  // Tudo o que vem do texto da unidade é cortado (o registro não tem teto de tamanho).
  const longo = linhaDoRegistro(reg({ id: "x", campo: "c".repeat(500) as RegistroNaTela["campo"] }), nomes);
  checar("campo desconhecido enorme e cortado", longo.oque.length < 120, longo.oque.length);
  const valores = linhaDoRegistro(reg({ id: "y", campo: "nome", antes: "a".repeat(5000), depois: "b".repeat(5000) }), nomes);
  checar("antes e depois enormes cortados", valores.oque.length < 450, valores.oque.length);
  const quem = linhaDoRegistro(reg({ id: "z", nome: "N".repeat(5000) }), nomes);
  checar("nome de quem mudou enorme cortado", quem.quem.length <= 101, quem.quem.length);
  const borda = textoDoRegistro({ campo: "nome", antes: `${"a".repeat(199)}🙂zzz`, depois: "b" });
  checar(
    "corte na borda de um emoji nao deixa meio caractere",
    semMeioCaractere(borda) && borda.startsWith(`nome ${"a".repeat(199)}… →`),
    borda.slice(190, 215),
  );
  const nomeBorda = quemDoRegistro(reg({ id: "nb", nome: `${"N".repeat(99)}🙂N` }));
  checar("nome de quem mudou na borda de um emoji", semMeioCaractere(nomeBorda) && nomeBorda === `${"N".repeat(99)}…`, nomeBorda.length);
  const campoBorda = textoDoRegistro({ campo: `${"c".repeat(59)}🙂c` as RegistroNaTela["campo"], antes: "1", depois: "2" });
  checar("campo desconhecido na borda de um emoji", semMeioCaractere(campoBorda) && campoBorda === `${"c".repeat(59)}… 1 → 2`, campoBorda);
  checar(
    "o resumo da etapa corta o nome e o campo",
    resumoDoUltimoRegistro(
      reg({ id: "rq", nome: "N".repeat(5000), campo: "c".repeat(5000) as RegistroNaTela["campo"] }),
      reg({ id: "rq" }).quando,
    ).length < 200,
  );
  const proto = ["constructor", "__proto__", "toString"].map(
    (c) => linhaDoRegistro(reg({ id: c, campo: c as RegistroNaTela["campo"] }), nomes).oque,
  );
  checar(
    "campo com nome de propriedade do objeto: pelo nome, sem codigo",
    proto.join("|") === "constructor 25/09 → 02/10|__proto__ 25/09 → 02/10|toString 25/09 → 02/10",
    proto,
  );
  checar(
    "o resumo da etapa tambem (campo com nome de propriedade)",
    resumoDoUltimoRegistro(reg({ id: "w", campo: "constructor" as RegistroNaTela["campo"] }), reg({ id: "w" }).quando) ===
      "Ana Lima alterou constructor hoje",
  );
}

export async function verificarAppModelosHistorico(): Promise<void> {
  await provarModelos();
  await provarHistorico();
}
