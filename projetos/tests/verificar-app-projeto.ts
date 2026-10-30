import { areaMemoria } from "@comum/armazenamento/area";
import type { AbrirModal } from "@comum/ui/dialogo";
import type { ProjetoNaTela } from "../src/app/dados";
import { abrirArquivados, abrirInformarDocumento, pedirNomeDoModelo } from "../src/app/dialogos/apoio";
import { protocoloValido } from "../src/app/dialogos/campos";
import { abrirDialogoProjeto, type ContextoDialogoProjeto, type ResultadoProjeto } from "../src/app/dialogos/projeto";
import { resumoDoProjeto } from "../src/modelo/resumo";
import { ErroValidacao } from "../src/modelo/validacao";
import { MODELOS_EMBUTIDOS } from "../src/modelos/embutidos";
import type { ProcessoDaCaixa } from "../src/ponte/tipos";
import { entidadeValida, moverEntreEscopos } from "../src/repositorio";
import { criarNoCombo, digitar, escolherCombo, itemDoMenu, itensDoMenu, marcar, opcoesDoCombo, telaDoApp, texto } from "./apoioApp";
import { ESCOPO_EU, ESCOPO_UN, novoRepo } from "./apoioRepositorio";
import { HOSTIL } from "./cenarioGantt";
import { etapa, HOJE, projeto } from "./fabrica";
import { botao, checar, lanca, secao, tique } from "./util";

function modais(doc: Document) {
  const titulos: string[] = [];
  const abrirModal: AbrirModal = (o) => {
    titulos.push(o.titulo);
    doc.body.append(o.conteudo);
    return {
      fechar: () => {
        o.conteudo.remove();
        o.aoFechar?.();
      },
    };
  };
  return { abrirModal, titulos };
}

const p1: ProjetoNaTela = {
  projeto: projeto({ id: "p1", nome: HOSTIL, processo: { protocolo: "50300.001234/2026-11", idProcedimento: "77" } }),
  vis: "unidade",
  fases: [],
  etapas: [etapa({ id: "e1" })],
  resumo: resumoDoProjeto([etapa({ id: "e1" })], HOJE),
};

export async function verificarAppProjeto(): Promise<void> {
  secao("app: novo projeto (em branco e de um modelo)");
  const doc = telaDoApp();
  const m = modais(doc);
  const salvos: ResultadoProjeto[] = [];
  let recusar: string[] | null = null;
  const base: ContextoDialogoProjeto = {
    abrirModal: m.abrirModal,
    hoje: HOJE,
    sigla: "TESTE",
    modelos: MODELOS_EMBUTIDOS,
    processos: async () => [
      { protocolo: "50300.004410/2026-02", idProcedimento: "44", tipo: "Licitação", especificacao: "Notebooks", sigiloso: false },
    ],
    salvar: async (r) => {
      if (recusar) throw new ErroValidacao(recusar);
      salvos.push(r);
    },
  };
  abrirDialogoProjeto(base);
  await tique();
  const f = () => doc.querySelector(".prj-form-projeto") as HTMLElement;
  checar("titulo e campos", m.titulos.at(-1) === "Novo projeto" && !!f().querySelector("input[name='nome']"));
  const cartoes = [...f().querySelectorAll(".prj-opcao")].map((c) => texto(c));
  checar(
    "Quem ve em cartoes com a sigla e a explicacao",
    cartoes[0] === "Toda a unidade (TESTE) Quem usa o SEI Pro na TESTE vê e edita. Fica no Texto Padrão da unidade." &&
      cartoes[1] === "Só eu Aparece só para você, nesta unidade. Dá para mudar depois.",
    cartoes,
  );
  checar(
    "comeca em branco (sem o bloco do modelo)",
    botao(f(), "Em branco")?.getAttribute("aria-pressed") === "true" && (f().querySelector(".prj-bloco-modelo") as HTMLElement).hidden,
  );
  botao(f(), "Criar projeto")!.click();
  await tique();
  checar("nome obrigatorio", texto(f().querySelector(".prj-erros")) === "Informe o nome do projeto." && !salvos.length);
  digitar(f().querySelector("input[name='nome']"), "  Pregão de notebooks ");
  escolherCombo(f(), "Processo SEI", "50300.004410/2026-02");
  marcar(f().querySelector("input[value='eu']"));
  botao(f(), "Criar projeto")!.click();
  await tique();
  checar(
    "em branco: nome, processo da caixa e Só eu",
    salvos[0]?.nome === "Pregão de notebooks" &&
      salvos[0]?.processo?.idProcedimento === "44" &&
      salvos[0]?.vis === "eu" &&
      !salvos[0]?.modelo,
    salvos[0],
  );
  checar("fecha ao criar", !f());

  abrirDialogoProjeto({ ...base, comecarDeModelo: true });
  await tique();
  checar(
    "pelo 'Comecar de um modelo': ja no modelo",
    botao(f(), "De um modelo")?.getAttribute("aria-pressed") === "true" && !(f().querySelector(".prj-bloco-modelo") as HTMLElement).hidden,
  );
  checar("modelos embutidos no seletor", opcoesDoCombo(f(), "Modelo").join() === MODELOS_EMBUTIDOS.map((x) => x.id).join());
  escolherCombo(f(), "Modelo", MODELOS_EMBUTIDOS[0]!.id);
  digitar(f().querySelector("input[name='comeca']"), "2026-08-03");
  const previa = texto(f().querySelector(".prj-previa"));
  checar(
    "previa: 9 etapas em 3 fases, termino e as 3 primeiras (tela 2)",
    previa.startsWith("9 etapas em 3 fases · datas em dias úteis, pulando feriados termina em 10/12/2026") &&
      previa.includes("Nota técnica preliminar 03/08 → 21/08") &&
      previa.includes("Análise jurídica 24/08 → 11/09") &&
      previa.endsWith("… e mais 6 etapas"),
    previa,
  );
  digitar(f().querySelector("input[name='comeca']"), "2026-13-40");
  checar("data invalida: a previa avisa", texto(f().querySelector(".prj-previa")) === "Informe uma data válida (entre 2000 e 2100).");
  digitar(f().querySelector("input[name='comeca']"), "2026-08-03");
  digitar(f().querySelector("input[name='nome']"), "Revisão da Resolução nº 5.432");
  recusar = ["Limite de 100 projetos ativos em “Toda a unidade”. Arquive ou exclua algum."];
  botao(f(), "Criar projeto")!.click();
  await tique();
  checar("erro do repositorio fica no dialogo", texto(f().querySelector(".prj-erros")).startsWith("Limite de 100") && !!f());
  recusar = null;
  botao(f(), "Criar projeto")!.click();
  await tique();
  checar(
    "de um modelo: leva o modelo e a data",
    salvos[1]?.modelo?.modelo.id === MODELOS_EMBUTIDOS[0]!.id && salvos[1]?.modelo?.inicio === "2026-08-03" && salvos[1]?.vis === "unidade",
  );

  secao("app: editar projeto");
  const feitos: string[] = [];
  abrirDialogoProjeto({
    ...base,
    projeto: p1,
    arquivar: async () => void feitos.push("arquivar"),
    duplicar: async () => void feitos.push("duplicar"),
    salvarComoModelo: () => void feitos.push("modelo"),
    excluir: async () => void feitos.push("excluir"),
  });
  await tique();
  checar(
    "titulo e nome hostil no campo",
    m.titulos.at(-1) === "Editar projeto" && (f().querySelector("input[name='nome']") as HTMLInputElement).value === HOSTIL,
  );
  checar("sem 'Comecar' ao editar", !botao(f(), "Em branco"));
  checar(
    "acoes no menu do rodape",
    itensDoMenu(f(), "Mais ações do projeto").join("|") === "Arquivar|Duplicar|Salvar como modelo…|Excluir",
  );
  itemDoMenu(f(), "Mais ações do projeto", "Salvar como modelo…");
  checar("salvar como modelo", feitos.join() === "modelo");
  marcar(f().querySelector("input[value='eu']"));
  botao(f(), "Salvar")!.click();
  await tique();
  checar(
    "editar: mudar Quem ve vai no resultado",
    salvos.at(-1)?.vis === "eu" && salvos.at(-1)?.processo?.protocolo === "50300.001234/2026-11",
  );
  abrirDialogoProjeto({
    ...base,
    projeto: { ...p1, projeto: { ...p1.projeto, arquivadoEm: 5 } },
    reativar: async () => void feitos.push("reativar"),
  });
  checar("arquivado: Reativar no lugar de Arquivar", itensDoMenu(f(), "Mais ações do projeto")[0] === "Reativar");
  itemDoMenu(f(), "Mais ações do projeto", "Reativar");
  await tique();
  checar("reativar fecha", feitos.at(-1) === "reativar" && !f());

  secao("app: projetos arquivados");
  const docA = telaDoApp();
  const ma = modais(docA);
  const arq: ProjetoNaTela = { ...p1, projeto: { ...p1.projeto, arquivadoEm: new Date(2026, 8, 30, 12).getTime() } };
  const acoes: string[] = [];
  abrirArquivados({
    abrirModal: ma.abrirModal,
    arquivados: [arq],
    reativar: async (id) => void acoes.push(`reativar:${id}`),
    excluir: async (id) => void acoes.push(`excluir:${id}`),
  });
  const lista = docA.querySelector(".prj-arquivados")!;
  checar(
    "lista com nome (texto) e data",
    texto(lista).includes(HOSTIL) && texto(lista).includes("arquivado em 30/09/2026") && !lista.querySelector("img"),
  );
  botao(lista, "Reativar")!.click();
  await tique();
  checar(
    "reativar tira da lista",
    acoes.join() === "reativar:p1" && texto(docA.querySelector(".prj-arquivados")) === "Nenhum projeto arquivado.",
  );

  secao("app: informar documento e nome do modelo");
  const docD = telaDoApp();
  const md = modais(docD);
  const docs: string[] = [];
  abrirInformarDocumento({
    abrirModal: md.abrirModal,
    etapa: etapa({ id: "x", concluidaEm: "2026-10-06" }),
    hoje: HOJE,
    conferirDocumento: async (n) => ({ numero: n, protocolo: "50300.001234/2026-11" }),
    salvar: async (numero, data) => void docs.push(`${numero}:${data}`),
  });
  checar("titulo da tela 2", md.titulos.at(-1) === "Documento que comprova a conclusão");
  const cd = docD.querySelector(".prj-form-documento")!;
  digitar(cd.querySelector("input[name='documento']"), "1240001");
  await tique();
  checar("conferencia", texto(cd.querySelector(".prj-docok")) === "Documento encontrado no processo 50300.001234/2026-11");
  digitar(cd.querySelector("input[name='concluida']"), "2026-10-05");
  botao(cd, "Salvar")!.click();
  await tique();
  checar("salva numero e data da conclusao", docs.join() === "1240001:2026-10-05" && !docD.querySelector(".prj-form-documento"));
  const nomes: string[] = [];
  pedirNomeDoModelo({ abrirModal: md.abrirModal, sugestao: "Revisão normativa", salvar: async (n) => void nomes.push(n) });
  const cm = docD.querySelector(".prj-form-modelo")!;
  checar("sugere o nome do projeto", (cm.querySelector("input") as HTMLInputElement).value === "Revisão normativa");
  botao(cm, "Salvar modelo")!.click();
  await tique();
  checar("salva o modelo com o nome", nomes.join() === "Revisão normativa");

  secao("app: falhas assincronas ficam no dialogo");
  const falha = async () => {
    throw new ErroValidacao(["Não foi possível gravar agora."]);
  };
  abrirDialogoProjeto({ ...base, projeto: p1, arquivar: falha, duplicar: falha, excluir: falha });
  await tique();
  for (const item of ["Arquivar", "Duplicar", "Excluir"]) {
    itemDoMenu(f(), "Mais ações do projeto", item);
    await tique();
    checar(`${item} falho: erro no dialogo e aberto`, texto(f()?.querySelector(".prj-erros")) === "Não foi possível gravar agora.");
  }
  botao(f(), "Cancelar")!.click();
  abrirDialogoProjeto({ ...base, projeto: p1, arquivar: async () => void feitos.push("arquivar-ok") });
  itemDoMenu(f(), "Mais ações do projeto", "Arquivar");
  await tique();
  checar("arquivar com sucesso fecha", feitos.at(-1) === "arquivar-ok" && !f());

  const docF = telaDoApp();
  const mf = modais(docF);
  abrirArquivados({ abrirModal: mf.abrirModal, arquivados: [arq], reativar: falha, excluir: falha });
  botao(docF.querySelector(".prj-arquivados")!, "Excluir")!.click();
  await tique();
  checar(
    "arquivados: falha avisa e mantem o projeto na lista",
    texto(docF.body).includes("Não foi possível gravar agora.") && texto(docF.querySelector(".prj-arquivados")).includes(HOSTIL),
  );
  abrirInformarDocumento({ abrirModal: mf.abrirModal, etapa: etapa({ id: "y" }), hoje: HOJE, salvar: falha });
  botao(docF.querySelector(".prj-form-documento")!, "Salvar")!.click();
  await tique();
  checar(
    "informar documento: falha fica aberto",
    !!docF.querySelector(".prj-form-documento") &&
      texto(docF.querySelector(".prj-form-documento")).includes("Não foi possível gravar agora."),
  );
  digitar(docF.querySelector(".prj-form-documento input[name='concluida']"), "2026-02-30");
  botao(docF.querySelector(".prj-form-documento")!, "Salvar")!.click();
  await tique();
  checar(
    "informar documento: data impossivel nao chega ao salvar",
    texto(docF.querySelector(".prj-form-documento")).includes("Informe uma data válida"),
  );
  pedirNomeDoModelo({ abrirModal: mf.abrirModal, sugestao: "X", salvar: falha });
  botao(docF.querySelector(".prj-form-modelo")!, "Salvar modelo")!.click();
  await tique();
  checar("nome do modelo: falha fica aberto", texto(docF.querySelector(".prj-form-modelo")).includes("Não foi possível gravar agora."));

  secao("app: processo digitado e clique duplo");
  const antes = salvos.length;
  abrirDialogoProjeto(base);
  await tique();
  digitar(f().querySelector("input[name='nome']"), "Com número livre");
  for (const ruim of ["-", "1", "12.34"]) {
    await criarNoCombo(f(), "Processo SEI", ruim);
    botao(f(), "Criar projeto")!.click();
    await tique();
    checar(
      `numero "${ruim}" e recusado`,
      texto(f().querySelector(".prj-erros")) === "Número de processo inválido." && salvos.length === antes,
    );
  }
  await criarNoCombo(f(), "Processo SEI", " 99906.713-630.000032/2025-82 ");
  botao(f(), "Criar projeto")!.click();
  await tique();
  checar("numero livre valido vai no vinculo", salvos[antes]?.processo?.protocolo === "99906.713-630.000032/2025-82", salvos[antes]);
  const docC = telaDoApp();
  const mc = modais(docC);
  let chamadas = 0;
  let solta: () => void = () => undefined;
  const lenta = () =>
    new Promise<void>((r) => {
      chamadas++;
      solta = r;
    });
  pedirNomeDoModelo({ abrirModal: mc.abrirModal, sugestao: "Dup", salvar: lenta });
  const bm = botao(docC.querySelector(".prj-form-modelo")!, "Salvar modelo")!;
  bm.click();
  bm.click();
  await tique();
  solta();
  await tique();
  checar("salvar modelo: dois cliques, uma chamada", chamadas === 1);
  chamadas = 0;
  abrirInformarDocumento({ abrirModal: mc.abrirModal, etapa: etapa({ id: "z" }), hoje: HOJE, salvar: lenta });
  const bd = botao(docC.querySelector(".prj-form-documento")!, "Salvar")!;
  bd.click();
  bd.click();
  await tique();
  solta();
  await tique();
  checar("informar documento: dois cliques, uma chamada", chamadas === 1);

  secao("app: confirmacao cancelada mantem o dialogo (sem erro)");
  const docX = telaDoApp();
  const mx = modais(docX);
  const fx = () => docX.querySelector(".prj-form-projeto") as HTMLElement | null;
  abrirDialogoProjeto({ ...base, abrirModal: mx.abrirModal, projeto: p1, salvar: async () => false, excluir: async () => false });
  botao(fx()!, "Salvar")!.click();
  await tique();
  checar("salvar devolve false: dialogo aberto e sem erro", !!fx() && !!fx()!.querySelector(".prj-erros[hidden]"));
  itemDoMenu(fx()!, "Mais ações do projeto", "Excluir");
  await tique();
  checar("excluir devolve false: dialogo aberto e sem erro", !!fx() && !!fx()!.querySelector(".prj-erros[hidden]"));
  botao(fx()!, "Cancelar")!.click();
  const acoesX: string[] = [];
  abrirArquivados({
    abrirModal: mx.abrirModal,
    arquivados: [arq],
    reativar: async () => false,
    excluir: async (id) => {
      acoesX.push(id);
      return false;
    },
  });
  botao(docX.querySelector(".prj-arquivados")!, "Excluir")!.click();
  await tique();
  checar(
    "arquivados: excluir cancelado mantem o projeto na lista, sem erro",
    acoesX.join() === "p1" && texto(docX.querySelector(".prj-arquivados")).includes(HOSTIL) && !!docX.querySelector(".prj-erros[hidden]"),
  );
  botao(docX.querySelector(".prj-arquivados")!, "Reativar")!.click();
  await tique();
  checar("arquivados: reativar recusado mantem na lista", texto(docX.querySelector(".prj-arquivados")).includes(HOSTIL));
  secao("app: numero de processo com letras (SEI-RJ) e o vinculo vindo da caixa");
  checar(
    "regra do numero digitado: comeca com letra ou digito, termina em digito, ao menos 8 digitos, ate 40",
    protocoloValido("SEI-150016/000123/2021") &&
      protocoloValido("50300.000777/2026-10") &&
      ["<b>12345678", "1234 5678", "SEI-1234567", "-150016/000123/2021", "SEI-150016/000123/2021-", `SEI-${"1".repeat(37)}`].every(
        (t) => !protocoloValido(t),
      ),
  );
  const docR = telaDoApp();
  const mr = modais(docR);
  const salvosR: ResultadoProjeto[] = [];
  const caixaR: ProcessoDaCaixa[] = [
    { protocolo: " 50300.000999/2026-10 ", idProcedimento: "", sigiloso: false },
    { protocolo: "50300.000888/2026-10", idProcedimento: "12a", sigiloso: false },
    { protocolo: "50300 000555/2026-10", idProcedimento: "55", sigiloso: false },
  ];
  const baseR: ContextoDialogoProjeto = {
    ...base,
    abrirModal: mr.abrirModal,
    processos: async () => caixaR,
    salvar: async (r) => {
      salvosR.push(r);
    },
  };
  const fr = () => docR.querySelector<HTMLElement>(".prj-form-projeto");
  /** Um diálogo novo por tentativa: escolhe o processo (`escolher`), clica "Criar projeto" e devolve o erro mostrado. */
  const tentar = async (escolher: (f: HTMLElement) => Promise<unknown>) => {
    // Lista de um seletor que ficou aberta numa tentativa que falhou não pode receber o clique da próxima.
    for (const pop of docR.querySelectorAll(".spro-combo-pop")) pop.remove();
    abrirDialogoProjeto(baseR);
    await tique();
    const f = fr() as HTMLElement;
    digitar(f.querySelector("input[name='nome']"), "Do Rio");
    const falhou = await lanca(() => escolher(f));
    botao(f, "Criar projeto")!.click();
    await tique();
    const erro = falhou ? `escolha: ${falhou.message}` : texto(fr()?.querySelector(".prj-erros"));
    fr()?.remove();
    return erro;
  };
  const ERRO = "Número de processo inválido.";
  for (const ruim of ["<b>12345678", "1234 5678", "50300.000001/2026-11 e 50300.000002/2026-11"]) {
    const n = salvosR.length;
    const erro = await tentar((f) => criarNoCombo(f, "Processo SEI", ruim));
    checar(`digitado "${ruim}": recusado`, erro === ERRO && salvosR.length === n, { erro, salvo: salvosR.at(-1)?.processo });
  }
  // Colado com rótulo: o único pedaço (separado por espaço) que passa na regra é o número.
  for (const [colado, numero] of [
    ["Processo nº 50300.000001/2026-11", "50300.000001/2026-11"],
    ["SEI nº SEI-150016/000123/2021", "SEI-150016/000123/2021"],
  ] as const) {
    const n = salvosR.length;
    const erro = await tentar((f) => criarNoCombo(f, "Processo SEI", colado));
    checar(
      `colado "${colado}": vai so o numero`,
      erro === "" && salvosR.length === n + 1 && salvosR.at(-1)?.processo?.protocolo === numero,
      { erro, salvo: salvosR.at(-1)?.processo },
    );
  }
  const n0 = salvosR.length;
  const erroRJ = await tentar((f) => criarNoCombo(f, "Processo SEI", "SEI-150016/000123/2021"));
  checar(
    "digitado do SEI-RJ vai no vinculo como foi escrito",
    erroRJ === "" && salvosR.length === n0 + 1 && salvosR.at(-1)?.processo?.protocolo === "SEI-150016/000123/2021",
    { erroRJ, salvo: salvosR.at(-1)?.processo },
  );
  const daCaixa = async (valor: string) => {
    const n = salvosR.length;
    const erro = await tentar(async (f) => escolherCombo(f, "Processo SEI", valor));
    return { erro, vinculo: salvosR.length > n ? salvosR.at(-1)?.processo : undefined };
  };
  const c1 = await daCaixa("50300.000999/2026-10");
  const vCaixa = c1.vinculo;
  checar(
    "da caixa: sem os espacos das pontas e sem o idProcedimento vazio",
    c1.erro === "" && JSON.stringify(vCaixa) === '{"protocolo":"50300.000999/2026-10"}',
    c1,
  );
  const c2 = await daCaixa("50300.000888/2026-10");
  checar(
    "da caixa: idProcedimento que nao e numero fica de fora",
    c2.erro === "" && JSON.stringify(c2.vinculo) === '{"protocolo":"50300.000888/2026-10"}',
    c2,
  );
  const c3 = await daCaixa("50300 000555/2026-10");
  checar("da caixa: numero fora da forma (espaco no meio) e recusado em vez de gravado", c3.erro === ERRO && !c3.vinculo, c3);
  const area = areaMemoria();
  const { repo: un } = novoRepo(ESCOPO_UN, area, "k");
  const { repo: eu } = novoRepo(ESCOPO_EU, area, "l");
  const pk = vCaixa ? await un.criarProjeto({ nome: "Da caixa", processo: vCaixa }) : undefined;
  const mov = pk ? await lanca(() => moverEntreEscopos(un, eu, pk.id)) : "sem vinculo";
  checar(
    "o vinculo da caixa passa em entidadeValida e em Quem ve",
    !!pk && entidadeValida(pk, "p") && mov === null && !!(await eu.obterProjeto(pk.id)),
    mov,
  );

  secao("app: editar projeto com o processo sigiloso sem o numero (o vinculo vazio do texto)");
  const VV = { protocolo: "", sigiloso: true };
  const docV = telaDoApp();
  const mv = modais(docV);
  const salvosV: ResultadoProjeto[] = [];
  const pVV: ProjetoNaTela = { ...p1, projeto: projeto({ id: "p1", nome: "Apuração", processo: VV }) };
  const fv = () => docV.querySelector<HTMLElement>(".prj-form-projeto") as HTMLElement;
  const abrirVV = async () => {
    for (const pop of docV.querySelectorAll(".spro-combo-pop")) pop.remove();
    abrirDialogoProjeto({ ...base, abrirModal: mv.abrirModal, projeto: pVV, salvar: async (r) => void salvosV.push(r) });
    await tique();
  };
  await abrirVV();
  checar(
    "o campo vem com 'Processo sigiloso' escolhido (nao 'Nenhum')",
    texto(docV.querySelector("button[role='combobox'][aria-label='Processo SEI']")) === "Processo sigiloso",
    texto(docV.querySelector("button[role='combobox'][aria-label='Processo SEI']")),
  );
  digitar(fv().querySelector("input[name='nome']"), "Apuração renomeada");
  botao(fv(), "Salvar")!.click();
  await tique();
  checar(
    "renomear mantem o vinculo vazio marcado (nao apaga o processo de quem tem o numero)",
    salvosV.at(-1)?.nome === "Apuração renomeada" && JSON.stringify(salvosV.at(-1)?.processo) === JSON.stringify(VV),
    salvosV.at(-1),
  );
  await abrirVV();
  marcar(fv().querySelector("input[value='eu']"));
  botao(fv(), "Salvar")!.click();
  await tique();
  checar(
    "mudar Quem ve mantem o vinculo vazio marcado",
    salvosV.at(-1)?.vis === "eu" && JSON.stringify(salvosV.at(-1)?.processo) === JSON.stringify(VV),
    salvosV.at(-1),
  );
  await abrirVV();
  escolherCombo(fv(), "Processo SEI", "");
  botao(fv(), "Salvar")!.click();
  await tique();
  checar("escolher 'Nenhum' tira o vinculo", salvosV.length === 3 && salvosV.at(-1)?.processo === undefined, salvosV.at(-1));
  await abrirVV();
  await criarNoCombo(fv(), "Processo SEI", "50300.000002/2026-11");
  botao(fv(), "Salvar")!.click();
  await tique();
  checar(
    "um numero digitado substitui o vinculo vazio",
    JSON.stringify(salvosV.at(-1)?.processo) === JSON.stringify({ protocolo: "50300.000002/2026-11" }),
    salvosV.at(-1)?.processo,
  );

  secao("app: numero de documento aceito em Informar documento (vazio, ou so digitos de 1 a 20)");
  const docI = telaDoApp();
  const mi = modais(docI);
  const docsI: string[] = [];
  const informar = async (valor: string) => {
    docI.querySelector(".prj-form-documento")?.remove();
    abrirInformarDocumento({
      abrirModal: mi.abrirModal,
      etapa: etapa({ id: "x", concluidaEm: "2026-10-06" }),
      hoje: HOJE,
      salvar: async (numero, data) => void docsI.push(`${numero}:${data}`),
    });
    const f = docI.querySelector(".prj-form-documento")!;
    digitar(f.querySelector("input[name='documento']"), valor);
    botao(f, "Salvar")!.click();
    await tique();
    return texto(docI.querySelector(".prj-form-documento .prj-erros"));
  };
  for (const ruim of ["abc", "12a", "1.234.567", "1".repeat(21), "SEI 1240001 e 1240002"]) {
    const n = docsI.length;
    const erro = await informar(ruim);
    checar(`"${ruim}": "Número de documento inválido." e nada salvo`, erro === "Número de documento inválido." && docsI.length === n, {
      erro,
      salvo: docsI.at(-1),
    });
  }
  for (const [valor, salvo] of [
    ["  1240001  ", "1240001"],
    ["SEI nº 1240001", "1240001"],
    ["1".repeat(20), "1".repeat(20)],
    ["", "undefined"],
  ] as const) {
    const n = docsI.length;
    const erro = await informar(valor);
    checar(`"${valor}": salva ${salvo}`, erro === "" && docsI.length === n + 1 && docsI.at(-1) === `${salvo}:2026-10-06`, {
      erro,
      salvo: docsI.at(-1),
    });
  }
}
