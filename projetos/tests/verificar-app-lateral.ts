/**
 * O app na aba "Projetos" do painel lateral (P5, tela 3): Agenda (Todas | Só
 * as minhas; Atrasadas, Esta semana, Próximos 30 dias; cartões com Concluir,
 * Editar e Ver no projeto), Projetos (cartões e mini-Gantt com "Abrir no
 * painel") e o mesmo balão da etapa do painel embutido. No fim, o lateral
 * montado pelo MESMO `ligarApp` do painel (a Colaboração do P4, o menu dela e o
 * "Entendi" antes de gravar em "Toda a unidade"), o teclado e o foco.
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { definirEmissorDeAviso } from "@comum/ui/aviso";
import type { AbrirModal } from "@comum/ui/dialogo";
import { AppProjetos } from "../src/app/app";
import { MENSAGEM_SEM_ENTENDI } from "../src/app/colaboracao/consentir";
import { ligarApp } from "../src/app/ligacao";
import { lerPreferencias } from "../src/app/preferencias";
import { prefixoMemoriaSigilo } from "../src/modelo/constantes";
import { chaveProtocolo } from "../src/modelo/vinculos";
import type { ContextoProjetos } from "../src/ponte/tipos";
import { chaveStatusTexto } from "../src/sincronia/textoPadrao";
import { digitar, itemDoMenu, itensDoMenu, rastrearFoco, telaDoApp, texto } from "./apoioApp";
import { ESCOPO_EU, ESCOPO_UN, novoRepo } from "./apoioRepositorio";
import { HOSTIL } from "./cenarioGantt";
import { HOJE } from "./fabrica";
import { ganttFalso } from "./ganttFalso";
import { botao, checar, secao, tique } from "./util";

const CTX: ContextoProjetos = {
  host: "sei.x.gov.br",
  login: "ana",
  nome: "Ana Lima",
  unidade: { id: "110", sigla: "TESTE", nome: "Unidade de Teste" },
  versao: "4.1.5",
  temaEscuro: false,
  atividades: false,
};
const AGORA = new Date(2026, 9, 6, 15).getTime();
const PROTOCOLO = "50300.001234/2026-11";

async function montar(o: { vazio?: boolean; resposta?: (op: string) => unknown; modo?: "embutido" | "lateral" } = {}) {
  const doc = telaDoApp();
  const area = areaMemoria();
  const { repo: un } = novoRepo(ESCOPO_UN, area, "u");
  const { repo: eu } = novoRepo(ESCOPO_EU, area, "e");
  const ids = { p: "", a: "", b: "", q: "" };
  if (!o.vazio) {
    const p = await un.criarProjeto({ nome: HOSTIL, processo: { protocolo: PROTOCOLO, idProcedimento: "77" } });
    const f = await un.criarFase(p.id, "Instrução");
    const a = await un.criarEtapa({ projeto: p.id, nome: "Nota técnica", fase: f.id, inicio: "2026-09-01", fim: "2026-10-02" });
    const b = await un.criarEtapa({
      projeto: p.id,
      nome: "Análise",
      fase: f.id,
      inicio: "2026-10-05",
      fim: "2026-10-09",
      responsavel: { login: "ana", nome: "Ana Lima" },
    });
    const q = await eu.criarProjeto({ nome: "Plano 2027" });
    Object.assign(ids, { p: p.id, a: a.id, b: b.id, q: q.id });
  }
  const chamadas: Array<[string, unknown]> = [];
  const rpc = {
    chamar: async <T>(op: string, args?: unknown): Promise<T> => {
      chamadas.push([op, args]);
      if (o.resposta) return o.resposta(op) as T;
      if (op === "processosDaCaixa" || op === "usuariosDaUnidade") return [] as T;
      return true as T;
    },
  };
  const abrirModal: AbrirModal = (m) => {
    doc.body.append(m.conteudo);
    return {
      fechar: () => {
        m.conteudo.remove();
        m.aoFechar?.();
      },
    };
  };
  const contagens: number[] = [];
  const baixados: Array<{ nome: string; conteudo: string }> = [];
  const app = new AppProjetos({
    raiz: doc.getElementById("app")!,
    ctx: CTX,
    area,
    repos: { unidade: un, eu },
    rpc,
    abrirModal,
    confirmar: async () => true,
    baixar: (nome, conteudo) => void baixados.push({ nome, conteudo }),
    hoje: () => HOJE,
    agora: () => AGORA,
    montarGantt: ganttFalso().montar,
    largura: () => 1000,
    modo: o.modo ?? "lateral",
    aoContar: (n) => void contagens.push(n),
  });
  await app.iniciar();
  return { doc, raiz: doc.getElementById("app")!, area, un, eu, ids, app, chamadas, contagens, baixados };
}

type Montado = Awaited<ReturnType<typeof montar>>;

const balao = (m: { doc: Document }) => m.doc.querySelector<HTMLElement>(".prj-balao");
const cartao = (m: { raiz: HTMLElement }, etapa: string) => m.raiz.querySelector<HTMLElement>(`.prj-lat-cartao[data-etapa='${etapa}']`);
const aviso = (m: { doc: Document }) => texto(m.doc.querySelector(".spro-aviso span"));
const naAgenda = (m: Montado) =>
  [...m.raiz.querySelectorAll(".prj-lat-cartao[data-etapa]")].map((c) => c.getAttribute("data-etapa")).join();
/** As ações do cartão (abre se estiver fechado: o clique alterna). */
function acoesDo(m: { raiz: HTMLElement }, etapa: string): HTMLElement {
  const c = cartao(m, etapa);
  if (c && !c.querySelector(".prj-lat-acoes")) c.querySelector<HTMLElement>(".prj-lat-alternar")?.click();
  const a = cartao(m, etapa)?.querySelector<HTMLElement>(".prj-lat-acoes");
  if (!a) throw new Error(`cartão ${etapa} sem ações`);
  return a;
}

/** O lateral como o main.ts vai montar (P5 T5): `ligarApp` com `modo: "lateral"`, o navegador falso. */
async function montarLigado() {
  const doc = telaDoApp();
  const area: Area = areaMemoria();
  const sync: Area = areaMemoria();
  const { repo: un } = novoRepo(ESCOPO_UN, area, "u");
  const p = await un.criarProjeto({ nome: "Revisão da norma" });
  const a = await un.criarEtapa({ projeto: p.id, nome: "Nota técnica", inicio: "2026-09-01", fim: "2026-10-02" });
  const modais: Array<{ titulo: string; conteudo: HTMLElement; fechar(): void }> = [];
  const abrirModal: AbrirModal = (m) => {
    doc.body.append(m.conteudo);
    const controle = {
      fechar: () => {
        m.conteudo.remove();
        m.aoFechar?.();
      },
    };
    modais.push({ titulo: m.titulo, conteudo: m.conteudo, fechar: controle.fechar });
    return controle;
  };
  const relogio = { agora: AGORA };
  const contagens: number[] = [];
  const ligado = await ligarApp({
    raiz: doc.getElementById("app")!,
    ctx: { ...CTX, atividades: true },
    area,
    sync,
    rpc: { chamar: async <T>(): Promise<T> => [] as T },
    abrirModal,
    confirmar: async () => true,
    baixar: () => undefined,
    escolherArquivo: async () => null,
    hoje: () => HOJE,
    agora: () => AGORA,
    carimbo: () => ({ agora: ++relogio.agora, dispositivo: "pc", por: "ana", nome: "Ana Lima" }),
    copias: null,
    arquivo: null,
    modo: "lateral",
    aoContar: (n) => void contagens.push(n),
  });
  return { ...ligado, doc, area, sync, un, modais, contagens, ids: { p: p.id, a: a.id }, raiz: doc.getElementById("app")! };
}

export async function verificarAppLateral(): Promise<void> {
  // O aviso vai para a página (o `.spro-aviso` do documento), não para um emissor que outra prova deixou.
  definirEmissorDeAviso(null);

  secao("lateral: topo e agenda");
  const m = await montar();
  const topo = m.raiz.querySelector(".prj-lat-topo");
  checar(
    "topo: Agenda | Projetos (Agenda primeiro), a unidade, Novo projeto e o menu",
    botao(topo ?? m.raiz, "Agenda")?.getAttribute("aria-pressed") === "true" &&
      texto(topo?.querySelector(".prj-lat-sigla")) === "TESTE" &&
      !!topo?.querySelector("button[aria-label='Novo projeto']") &&
      !!topo?.querySelector("button[aria-label='Ajustes dos projetos']"),
  );
  checar("sem abas nem Gantt no lateral", !m.raiz.querySelector("[role='tab']") && !m.raiz.querySelector(".prj-vista"));
  const menu = itensDoMenu(m.raiz, "Ajustes dos projetos");
  checar(
    "menu do lateral: so o que serve no estreito (sem imprimir nem os marcaveis do Gantt)",
    menu.includes("Exportar planilha (CSV)") &&
      !menu.includes("Mostrar lista de etapas") &&
      !menu.includes("Mover dependentes ao arrastar") &&
      !menu.includes("Ordenar etapas") &&
      !menu.includes("Imprimir / salvar PDF"),
    menu,
  );
  const grupos = [...m.raiz.querySelectorAll(".prj-lat-grupo")].map((g) => texto(g));
  checar("grupos com a contagem", grupos.join() === "Atrasadas1,Esta semana1", grupos);
  checar(
    "cartao: etapa, projeto (como texto) e o prazo",
    texto(cartao(m, m.ids.a)?.querySelector(".prj-lat-nome")) === "Nota técnica" &&
      texto(cartao(m, m.ids.a)?.querySelector(".prj-lat-projeto")) === HOSTIL &&
      texto(cartao(m, m.ids.a)?.querySelector(".prj-lat-data")) === "venceu 02/10" &&
      !m.raiz.querySelector("img"),
  );
  checar("contador da aba: as atrasadas da unidade", m.contagens.at(-1) === 1, m.contagens);
  m.app.aoRedimensionar();
  checar(
    "mudar a largura nao desenha as abas do painel no lateral",
    !!m.raiz.querySelector(".prj-lat-topo") && !m.raiz.querySelector("[role='tab']"),
  );

  secao("lateral: cartao abre as acoes (Concluir, Editar, Ver no projeto)");
  checar("fechado: sem acoes", !cartao(m, m.ids.a)?.querySelector(".prj-lat-acoes"));
  cartao(m, m.ids.a)?.querySelector<HTMLElement>(".prj-lat-alternar")?.click();
  const acoes = cartao(m, m.ids.a)?.querySelector(".prj-lat-acoes");
  checar(
    "clique: as tres acoes (e o cartao diz que esta aberto)",
    !!acoes &&
      !!botao(acoes, "Concluir") &&
      !!botao(acoes, "Editar") &&
      !!botao(acoes, "Ver no projeto") &&
      cartao(m, m.ids.a)?.querySelector(".prj-lat-alternar")?.getAttribute("aria-expanded") === "true",
  );
  botao(acoes!, "Concluir")!.click();
  await tique(60);
  checar(
    "Concluir: conclui hoje e avisa com Desfazer",
    (await m.un.obterEtapa(m.ids.a))?.concluidaEm === HOJE && aviso(m).includes("concluída hoje"),
    aviso(m),
  );
  checar("a etapa sai da agenda e o contador zera", !cartao(m, m.ids.a) && m.contagens.at(-1) === 0, m.contagens);
  botao(acoesDo(m, m.ids.b), "Editar")!.click();
  await tique();
  checar("Editar: o dialogo da etapa", !!m.doc.querySelector(".prj-form-etapa"));
  botao(m.doc.querySelector(".prj-form-etapa")!, "Cancelar")?.click();

  secao("lateral: so as minhas");
  const c = await m.un.criarEtapa({
    projeto: m.ids.p,
    nome: "Parecer",
    inicio: "2026-10-12",
    fim: "2026-10-20",
    responsavel: { login: "bruno", nome: "Bruno Reis" },
  });
  await tique(80);
  checar("Todas: a da Ana e a do Bruno", naAgenda(m) === `${m.ids.b},${c.id}`, naAgenda(m));
  botao(m.raiz, "Só as minhas")!.click();
  await tique(20);
  checar("so a da Ana", naAgenda(m) === m.ids.b, naAgenda(m));
  checar("a escolha fica nas preferencias", (await lerPreferencias(m.area)).soMinhas === true);
  botao(m.raiz, "Todas")!.click();
  await tique(20);
  checar("Todas de novo: as duas", naAgenda(m) === `${m.ids.b},${c.id}`, naAgenda(m));
  await m.un.removerEtapa(c.id);
  await tique(80);

  secao("lateral: Ver no projeto abre o mini-Gantt e o balao da etapa");
  botao(acoesDo(m, m.ids.b), "Ver no projeto")!.click();
  await tique(20);
  checar(
    "mini-Gantt do projeto, com o nome como texto",
    texto(m.raiz.querySelector(".prj-mg-cab h3")) === HOSTIL && m.raiz.querySelectorAll(".prj-mg-linha").length === 2,
    texto(m.raiz.querySelector(".prj-mg-cab h3")),
  );
  checar("Projetos fica marcado e lembrado", botao(m.raiz, "Projetos")?.getAttribute("aria-pressed") === "true");
  checar("o balao da etapa", texto(balao(m)?.querySelector("h3")) === "Análise");
  checar("o app diz qual projeto esta aberto (Colaboracao)", m.app.aberto === m.ids.p);
  await m.un.editarEtapa(m.ids.b, { nome: "Análise jurídica" }, HOJE);
  await tique(80);
  checar("gravacao com o balao aberto: ele volta, com o dado novo", texto(balao(m)?.querySelector("h3")) === "Análise jurídica");
  botao(balao(m)!, "Fechar")?.click();
  await tique();
  await m.un.editarEtapa(m.ids.b, { nome: "Análise final" }, HOJE);
  await tique(80);
  checar("fechado pelo usuario: nao reabre", !balao(m));
  const meses = [...m.raiz.querySelectorAll(".prj-mg-mes")].map((x) => texto(x));
  checar("eixo de meses do projeto", meses.join() === "set,out", meses);
  checar(
    "a linha do mini-Gantt diz a etapa e a situacao (leitor de tela)",
    m.raiz.querySelector(`.prj-mg-linha[data-id='${m.ids.a}']`)?.getAttribute("aria-label") === "Nota técnica (concluída)",
    m.raiz.querySelector(`.prj-mg-linha[data-id='${m.ids.a}']`)?.getAttribute("aria-label"),
  );
  m.raiz.querySelector<HTMLElement>(`.prj-mg-linha[data-id='${m.ids.a}']`)?.click();
  checar("toque numa etapa: o mesmo balao (concluida: Reabrir)", !!balao(m) && !!botao(balao(m)!, "Reabrir"));
  botao(balao(m)!, "Fechar")?.click();

  secao("lateral: Abrir no painel pede a aba do SEI");
  botao(m.raiz, "Abrir no painel")!.click();
  await tique();
  checar("RPC focarNoPainel com o projeto", JSON.stringify(m.chamadas.at(-1)) === JSON.stringify(["focarNoPainel", { id: m.ids.p }]));
  botao(m.raiz, "Voltar aos projetos")!.click();
  const cartoes = [...m.raiz.querySelectorAll<HTMLElement>(".prj-lat-cartao-projeto")];
  const doProjeto = (id: string) => cartoes.find((x) => x.getAttribute("data-projeto") === id);
  checar(
    "cartoes dos dois projetos (unidade e so eu), na ordem das abas",
    cartoes.length === 2,
    cartoes.map((x) => texto(x)),
  );
  checar(
    "cartao: escopo, %, barra e o resumo",
    texto(doProjeto(m.ids.p)?.querySelector(".prj-lat-l3")) === "1 de 2 · termina 09/10" &&
      !!doProjeto(m.ids.p)?.querySelector(".prj-barra") &&
      doProjeto(m.ids.p)?.querySelector(".prj-lat-escopo")?.getAttribute("title") === "Toda a unidade" &&
      doProjeto(m.ids.q)?.querySelector(".prj-lat-escopo")?.getAttribute("title") === "Só eu" &&
      texto(doProjeto(m.ids.q)?.querySelector(".prj-lat-l3")) === "sem etapas" &&
      !m.raiz.querySelector("img"),
    cartoes.map((x) => texto(x)),
  );
  doProjeto(m.ids.q)?.click();
  checar(
    "projeto sem etapas: o convite para planejar no painel",
    texto(m.raiz.querySelector(".prj-lat-nada")).includes("ainda não tem etapas"),
  );
  const navegou = await montar({ resposta: (op) => (op === "focarNoPainel" ? "navegou" : true) });
  navegou.app.focarProjeto(navegou.ids.p);
  await tique();
  botao(navegou.raiz, "Abrir no painel")!.click();
  await tique(10);
  checar("aba em outra tela: ela vai ao Controle de Processos e avisa", aviso(navegou).includes("Abrindo o Controle de Processos"));
  const semAba = await montar({
    resposta: (op) => {
      if (op === "focarNoPainel") throw new Error("A aba do SEI deste painel não está mais aberta nesta janela.");
      return true;
    },
  });
  semAba.app.focarProjeto(semAba.ids.p);
  await tique();
  botao(semAba.raiz, "Abrir no painel")!.click();
  await tique(10);
  checar("sem aba: a mensagem", aviso(semAba).includes("não está mais aberta"));

  secao("lateral: focarProjeto (a caixa e a arvore pedem o lateral)");
  const f = await montar();
  checar("projeto que nao existe: false", f.app.focarProjeto("nao-existe") === false);
  checar("focar com etapa: mini-Gantt e balao", f.app.focarProjeto(f.ids.p, f.ids.b) && texto(balao(f)?.querySelector("h3")) === "Análise");

  secao("lateral: textos hostis (etapa, fase e responsavel) so como texto");
  const hz = await montar();
  const fh = await hz.un.criarFase(hz.ids.p, HOSTIL);
  await hz.un.criarEtapa({
    projeto: hz.ids.p,
    nome: HOSTIL,
    fase: fh.id,
    inicio: "2026-10-05",
    fim: "2026-10-08",
    responsavel: { login: "x", nome: HOSTIL },
  });
  await tique(80);
  const cartaoHostil = [...hz.raiz.querySelectorAll(".prj-lat-cartao[data-etapa]")].find(
    (x) => texto(x.querySelector(".prj-lat-nome")) === HOSTIL,
  );
  checar(
    "agenda: a etapa e o responsavel hostis como texto",
    !!cartaoHostil && cartaoHostil.querySelector(".spro-avatar")?.getAttribute("aria-label") === HOSTIL && !hz.raiz.querySelector("img"),
  );
  hz.app.focarProjeto(hz.ids.p);
  await tique();
  const linhaHostil = [...hz.raiz.querySelectorAll(".prj-mg-linha")].find((x) => x.getAttribute("title") === HOSTIL);
  checar(
    "mini-Gantt: a fase e a etapa hostis como texto (e no rotulo da linha)",
    [...hz.raiz.querySelectorAll(".prj-mg-fase")].some((x) => texto(x) === HOSTIL) &&
      texto(linhaHostil?.querySelector(".prj-mg-nome")) === HOSTIL &&
      linhaHostil?.getAttribute("aria-label")?.startsWith(HOSTIL) === true &&
      !hz.raiz.querySelector("img") &&
      !hz.raiz.querySelector("[onerror]"),
  );
  hz.app.destruir();

  secao("lateral: a planilha de todos os projetos, com o sigilo deste computador");
  // O processo virou sigiloso só na memória deste computador (a tela do SEI mostrou), sem marca no projeto.
  await f.area.gravar({ [`${prefixoMemoriaSigilo(CTX.host, CTX.login)}p/${chaveProtocolo(PROTOCOLO)}`]: "local" });
  await tique(40);
  checar("menu: Exportar planilha (CSV)", itemDoMenu(f.raiz, "Ajustes dos projetos", "Exportar planilha (CSV)"));
  await tique(20);
  const csv = f.baixados.at(-1);
  checar(
    "a planilha leva os dois projetos (nao so o aberto) e o numero sigiloso fica de fora",
    csv?.nome === `projetos-${HOJE}.csv` &&
      csv.conteudo.includes("Plano 2027") &&
      csv.conteudo.includes("Análise") &&
      !csv.conteudo.includes(PROTOCOLO) &&
      !csv.conteudo.includes(chaveProtocolo(PROTOCOLO)),
    csv,
  );

  secao("lateral: novo projeto e vazio");
  const v = await montar({ vazio: true });
  checar("sem projetos: o primeiro uso", !!v.raiz.querySelector(".prj-vazio") && !!v.raiz.querySelector(".prj-lat-topo"));
  checar("sem projetos: o menu nao oferece a planilha", !itensDoMenu(v.raiz, "Ajustes dos projetos").includes("Exportar planilha (CSV)"));
  botao(v.raiz, "Criar projeto")!.click();
  const form = v.doc.querySelector(".prj-form-projeto") as HTMLElement;
  digitar(form.querySelector("input[name='nome']"), "Pregão");
  botao(form, "Criar projeto")!.click();
  await tique(80);
  checar("cria e abre o mini-Gantt do novo", texto(v.raiz.querySelector(".prj-mg-cab h3")) === "Pregão");
  checar("o contador sem atraso", v.contagens.at(-1) === 0);

  secao("painel embutido: o contador tambem a cada leitura");
  const emb = await montar({ modo: "embutido" });
  checar(
    "embutido: as abas do painel e o contador das atrasadas",
    !!emb.raiz.querySelector("[role='tab']") && !emb.raiz.querySelector(".prj-lat-topo") && emb.contagens.at(-1) === 1,
    emb.contagens,
  );

  secao("lateral: teclado e foco (o redesenho nao perde o lugar)");
  const k = await montar();
  rastrearFoco(k.doc);
  const alternar = cartao(k, k.ids.a)!.querySelector<HTMLElement>(".prj-lat-alternar")!;
  alternar.focus();
  alternar.click();
  const ativo = () => k.doc.activeElement as HTMLElement | null;
  checar(
    "abrir o cartao: o foco fica nele (agora aberto)",
    ativo()?.classList.contains("prj-lat-alternar") === true &&
      ativo()?.getAttribute("aria-expanded") === "true" &&
      ativo()?.closest(".prj-lat-cartao")?.getAttribute("data-etapa") === k.ids.a,
  );
  botao(k.raiz, "Projetos")!.focus();
  botao(k.raiz, "Projetos")!.click();
  checar("Agenda | Projetos: o foco fica no botao escolhido", ativo() === botao(k.raiz, "Projetos"));
  const doP = k.raiz.querySelector<HTMLElement>(`.prj-lat-cartao-projeto[data-projeto='${k.ids.p}']`)!;
  doP.focus();
  doP.click();
  checar("abrir o projeto: o foco vai ao titulo dele", ativo() === k.raiz.querySelector(".prj-mg-cab h3"));
  botao(k.raiz, "Voltar aos projetos")!.click();
  checar("voltar: o foco volta ao cartao do projeto", ativo()?.getAttribute("data-projeto") === k.ids.p);

  secao("lateral ligado (ligarApp): a Colaboracao do P4 e o Entendi antes de gravar");
  const l = await montarLigado();
  const menuLigado = itensDoMenu(l.raiz, "Ajustes dos projetos");
  checar(
    "menu curto do lateral com os itens da colaboracao (decisao 17)",
    menuLigado.join("|") ===
      [
        "Sincronização…",
        "Modelos de projeto…",
        "Exportar planilha (CSV)",
        "Enviar projeto por arquivo…",
        "Receber projeto de arquivo…",
        "Importar do servidor do Atividades…",
        "Histórico de alterações",
      ].join("|"),
    menuLigado,
  );
  checar(
    "as faixas da colaboracao acima do topo do lateral",
    l.raiz.querySelector(".prj")?.firstElementChild?.classList.contains("prj-faixas") === true && !!l.raiz.querySelector(".prj-lat-topo"),
  );
  checar("contador ligado: 1 atrasada", l.contagens.at(-1) === 1, l.contagens);
  cartao(l, l.ids.a)?.querySelector<HTMLElement>(".prj-lat-alternar")?.click();
  await l.area.gravar({ [chaveStatusTexto(ESCOPO_UN)]: { estado: "ok", quando: AGORA, ultimoOk: AGORA, pendente: true } });
  await tique(40);
  checar(
    "o estado da sincronia no topo do lateral (sem fechar o cartao aberto)",
    texto(l.raiz.querySelector(".prj-lat-topo .prj-sinc")) === "pendente" && !!cartao(l, l.ids.a)?.querySelector(".prj-lat-acoes"),
    texto(l.raiz.querySelector(".prj-lat-topo .prj-sinc")),
  );
  botao(acoesDo(l, l.ids.a), "Concluir")!.click();
  await tique(20);
  checar(
    "Concluir em 'Toda a unidade' pede o Entendi antes",
    l.modais.at(-1)?.titulo === "Projetos de toda a unidade" && !(await l.un.obterEtapa(l.ids.a))?.concluidaEm,
  );
  l.modais.at(-1)!.fechar();
  await tique(20);
  checar(
    "sem o Entendi: nada muda e o aviso diz por que",
    !(await l.un.obterEtapa(l.ids.a))?.concluidaEm && aviso(l) === MENSAGEM_SEM_ENTENDI && !!cartao(l, l.ids.a),
    aviso(l),
  );
  botao(acoesDo(l, l.ids.a), "Concluir")!.click();
  await tique(20);
  botao(l.modais.at(-1)!.conteudo, "Entendi")!.click();
  await tique(80);
  checar(
    "com o Entendi: conclui e o contador zera",
    (await l.un.obterEtapa(l.ids.a))?.concluidaEm === HOJE && l.contagens.at(-1) === 0,
    l.contagens,
  );
  l.app.focarProjeto(l.ids.p);
  checar("o projeto do mini-Gantt e o 'aberto' que a colaboracao le", l.app.aberto === l.ids.p);
  l.destruir();

  secao("lateral: desmontado no meio de uma leitura (troca de unidade) nao conta mais");
  const t = await montar();
  const antes = t.contagens.length;
  const lendo = t.app.abrirProjeto(t.ids.p);
  t.app.destruir();
  await lendo;
  checar("o contador da unidade velha nao chega depois de desmontar", t.contagens.length === antes, t.contagens);

  // O relógio da virada do dia (setInterval) prenderia o processo das provas.
  for (const x of [m, navegou, semAba, f, v, emb, k]) x.app.destruir();
}
