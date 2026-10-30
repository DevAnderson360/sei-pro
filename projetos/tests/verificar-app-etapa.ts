import type { AbrirModal } from "@comum/ui/dialogo";
import type { ProjetoNaTela } from "../src/app/dados";
import { abrirDialogoEtapa, type ContextoDialogoEtapa, type ResultadoEtapa } from "../src/app/dialogos/etapa";
import { chaveResponsavel } from "../src/modelo/filtro";
import { resumoDoProjeto } from "../src/modelo/resumo";
import type { Registro } from "../src/modelo/tipos";
import { ErroValidacao } from "../src/modelo/validacao";
import { combo, criarNoCombo, digitar, escolherCombo, marcar, opcoesDoCombo, tecla, telaDoApp, texto } from "./apoioApp";
import { HOSTIL } from "./cenarioGantt";
import { etapa, fase, HOJE, projeto } from "./fabrica";
import { botao, checar, secao, tique } from "./util";

const fases = [fase({ id: "f1", nome: "Instrução" })];
const nota = etapa({ id: "nt", nome: "Nota técnica", fase: "f1", responsavel: { login: "ana", nome: "Ana Lima" } });
const air = etapa({
  id: "air",
  nome: "Relatório de AIR",
  fase: "f1",
  inicio: "2026-09-01",
  fim: "2026-10-02",
  dependeDe: ["nt"],
  responsavel: { nome: "Carla Dias" },
  medida: "checklist",
  checklist: [
    { id: "c1", texto: "Levantar dados", feito: true },
    { id: "c2", texto: "Matriz de impactos", feito: false },
  ],
  etiquetas: ["AIR"],
});
const p: ProjetoNaTela = {
  projeto: projeto({ id: "p1", processo: { protocolo: "50300.001234/2026-11", idProcedimento: "77" } }),
  vis: "unidade",
  fases,
  etapas: [nota, air],
  resumo: resumoDoProjeto([nota, air], HOJE),
};

function cena(m: Partial<ContextoDialogoEtapa> = {}) {
  const doc = telaDoApp();
  const modais: string[] = [];
  let fechados = 0;
  const abrirModal: AbrirModal = (o) => {
    modais.push(o.titulo);
    doc.body.append(o.conteudo);
    return {
      fechar: () => {
        fechados += 1;
        o.conteudo.remove();
        o.aoFechar?.();
      },
    };
  };
  const salvos: ResultadoEtapa[] = [];
  const t = { recusar: null as string[] | null, excluidos: 0 };
  const c: ContextoDialogoEtapa = {
    abrirModal,
    projeto: p,
    hoje: HOJE,
    agora: new Date(2026, 9, 6, 15).getTime(),
    usuarios: async () => [{ login: "bruno", nome: "Bruno Reis" }, { nome: HOSTIL }],
    processos: async () => [{ protocolo: "50300.009999/2026-01", idProcedimento: "99", sigiloso: true }],
    etiquetas: ["AIR", "Urgente"],
    salvar: async (r) => {
      if (t.recusar) throw new ErroValidacao(t.recusar);
      salvos.push(r);
    },
    ...m,
  };
  const dlg = abrirDialogoEtapa(c);
  return { doc, modais, salvos, t, dlg, fechados: () => fechados };
}

export async function verificarAppEtapa(): Promise<void> {
  secao("app: dialogo da etapa (nova)");
  const n = cena({ inicial: { inicio: "2026-10-12", fim: "2026-10-16" } });
  const corpo = () => n.doc.querySelector(".prj-form-etapa") as HTMLElement;
  checar("titulo Etapa", n.modais.join() === "Etapa");
  const campos = (sel: string) => corpo().querySelector<HTMLInputElement>(sel);
  checar(
    "datas iniciais da etapa nova",
    campos("input[name='inicio']")?.value === "2026-10-12" && campos("input[name='fim']")?.value === "2026-10-16",
  );
  checar("dias uteis ao lado (12/10 e feriado)", texto(corpo().querySelector(".prj-uteis")) === "4 dias úteis");
  checar(
    "secoes recolhidas com resumo; sem historico na nova",
    [...corpo().querySelectorAll(".prj-sec")]
      .map((s) => `${texto(s.querySelector(".prj-sec-tit"))}=${texto(s.querySelector(".prj-sec-res"))}`)
      .join("|") ===
      "Checklist=nenhum|Processo e documento=50300.001234/2026-11 · sem documento|Etiquetas=nenhuma|Observações=—|Como medir o progresso=eu informo",
  );
  checar("sem Excluir na nova", !botao(corpo(), "Excluir"));
  botao(corpo(), "Salvar")!.click();
  await tique();
  checar(
    "nome obrigatorio (nada salvo)",
    texto(corpo().querySelector(".prj-erros")) === "Informe o nome da etapa." && n.salvos.length === 0,
  );
  digitar(campos("input[name='nome']"), "Parecer");
  digitar(campos("input[name='fim']"), "2026-02-30");
  botao(corpo(), "Salvar")!.click();
  await tique();
  checar(
    "data impossivel barrada antes do modelo",
    texto(corpo().querySelector(".prj-erros")).includes("término válida") && n.salvos.length === 0,
  );
  checar("dias uteis com data invalida: travessao", texto(corpo().querySelector(".prj-uteis")) === "—");
  digitar(campos("input[name='fim']"), "2026-10-09");
  botao(corpo(), "Salvar")!.click();
  await tique();
  checar("termino antes do inicio barrado", texto(corpo().querySelector(".prj-erros")) === "O término não pode ser antes do início.");
  digitar(campos("input[name='fim']"), "2026-10-23");
  marcar(campos("input[name='marco']"));
  checar(
    "marco esconde o termino",
    (corpo().querySelector(".prj-campo-fim") as HTMLElement).hidden && (corpo().querySelector(".prj-uteis") as HTMLElement).hidden,
  );
  marcar(campos("input[name='marco']"), false);
  await tique();
  checar(
    "responsavel: usuarios da unidade e os ja usados no projeto",
    opcoesDoCombo(corpo(), "Responsável").join("|") ===
      ["", "login:bruno", chaveResponsavel({ nome: HOSTIL }), "login:ana", "nome:carla dias"].join("|"),
    opcoesDoCombo(corpo(), "Responsável"),
  );
  escolherCombo(corpo(), "Responsável", "login:bruno");
  await criarNoCombo(corpo(), "Fase", "Consulta pública");
  escolherCombo(corpo(), "Adicionar dependência", "nt");
  checar("dependencia vira chip com o nome", texto(corpo().querySelector(".prj-chip-x")) === "Nota técnica");
  (corpo().querySelector(".prj-sec[data-secao='checklist'] > button") as HTMLElement).click();
  const novo = corpo().querySelector<HTMLInputElement>(".prj-sec[data-secao='checklist'] input[type='text']")!;
  novo.value = "Revisão da chefia";
  tecla(novo, "Enter");
  checar(
    "checklist: item novo e resumo",
    texto(corpo().querySelector(".prj-sec[data-secao='checklist'] .prj-sec-res")) === "0 de 1 feitos",
  );
  escolherCombo(corpo(), "Processo da etapa", "50300.009999/2026-01");
  digitar(corpo().querySelector("input[name='documento']"), "SEI 1240001");
  await criarNoCombo(corpo(), "Etiquetas da etapa", "Jurídico");
  digitar(corpo().querySelector("textarea"), "  Ver com a PF  ");
  botao(corpo(), "Pelo tempo decorrido")!.click();
  botao(corpo(), "Salvar")!.click();
  await tique();
  const r = n.salvos[0];
  checar(
    "salva o resultado completo",
    !!r &&
      r.nome === "Parecer" &&
      r.inicio === "2026-10-12" &&
      r.fim === "2026-10-23" &&
      !r.marco &&
      r.responsavel?.login === "bruno" &&
      r.novaFase === "Consulta pública" &&
      r.fase === undefined &&
      r.dependeDe.join() === "nt" &&
      r.checklist.map((i) => i.texto).join() === "Revisão da chefia" &&
      r.processo?.protocolo === "50300.009999/2026-01" &&
      r.processo?.sigiloso === true &&
      r.documento?.numero === "1240001" &&
      r.etiquetas.join() === "Jurídico" &&
      r.observacoes === "Ver com a PF" &&
      r.medida === "tempo",
    r,
  );
  checar("fecha ao salvar", n.fechados() === 1 && !corpo());

  secao("app: dialogo da etapa (limites das datas)");
  const l = cena({ inicial: { inicio: "2026-10-12", fim: "2026-10-16" } });
  const cl = () => l.doc.querySelector(".prj-form-etapa") as HTMLElement;
  digitar(cl().querySelector("input[name='nome']"), "Longa");
  digitar(cl().querySelector("input[name='fim']"), "9999-12-31");
  botao(cl(), "Salvar")!.click();
  await tique();
  checar("ano 9999 barrado", texto(cl().querySelector(".prj-erros")).includes("término válida") && l.salvos.length === 0);
  checar("ano 9999: dias uteis travessao", texto(cl().querySelector(".prj-uteis")) === "—");
  digitar(cl().querySelector("input[name='fim']"), "2100-12-31");
  botao(cl(), "Salvar")!.click();
  await tique();
  checar(
    "mais de 10 anos barrado",
    texto(cl().querySelector(".prj-erros")) === "A etapa pode durar no máximo cerca de 10 anos." && l.salvos.length === 0,
  );
  checar("mais de 10 anos: dias uteis travessao", texto(cl().querySelector(".prj-uteis")) === "—");
  digitar(cl().querySelector("input[name='inicio']"), "1999-12-31");
  botao(cl(), "Salvar")!.click();
  await tique();
  checar("ano 1999 barrado", texto(cl().querySelector(".prj-erros")).includes("início válida") && l.salvos.length === 0);
  digitar(cl().querySelector("input[name='inicio']"), "2026-10-12");
  digitar(cl().querySelector("input[name='fim']"), "2026-10-13");
  marcar(cl().querySelector("input[name='marco']"));
  botao(cl(), "Salvar")!.click();
  await tique();
  checar("marco grava termino = inicio", l.salvos[0]?.marco === true && l.salvos[0]?.fim === "2026-10-12");

  secao("app: dialogo da etapa (fase removida)");
  const morta = cena({ etapa: { ...air, fase: "removida" } });
  await tique();
  morta.doc.querySelector<HTMLButtonElement>(".prj-form-etapa button.primario")!.click();
  await tique();
  checar("fase morta vira sem fase", morta.salvos[0]?.fase === undefined && morta.salvos[0]?.novaFase === undefined);

  secao("app: dialogo da etapa (editar)");
  const historico: Registro[] = [
    {
      id: "r1",
      alvo: "air",
      projeto: "p1",
      quando: new Date(2026, 9, 4, 10).getTime(),
      por: "carla",
      nome: "Carla Dias",
      campo: "fim",
      antes: "2026-09-25",
      depois: "2026-10-02",
      atualizadoEm: 1,
      dispositivo: "d",
    },
    {
      id: "r0",
      alvo: "air",
      projeto: "p1",
      quando: new Date(2026, 7, 28).getTime(),
      por: "ana",
      nome: HOSTIL,
      campo: "criacao",
      depois: "x",
      atualizadoEm: 1,
      dispositivo: "d",
    },
  ];
  let excluiu = 0;
  const e = cena({
    etapa: air,
    historico: async () => historico,
    secaoAberta: "historico",
    conferirDocumento: async (num) => (num === "1240001" ? { numero: num, protocolo: "50300.001234/2026-11" } : null),
    excluir: async () => {
      excluiu += 1;
    },
  });
  await tique();
  const ce = () => e.doc.querySelector(".prj-form-etapa") as HTMLElement;
  checar("campos preenchidos", ce().querySelector<HTMLInputElement>("input[name='nome']")?.value === "Relatório de AIR");
  checar("dias uteis da etapa", texto(ce().querySelector(".prj-uteis")) === "23 dias úteis");
  checar("chip da dependencia", texto(ce().querySelector(".prj-chip-x")) === "Nota técnica");
  checar(
    "resumos preenchidos",
    texto(ce().querySelector(".prj-sec[data-secao='checklist'] .prj-sec-res")) === "1 de 2 feitos" &&
      texto(ce().querySelector(".prj-sec[data-secao='medida'] .prj-sec-res")) === "pelo checklist",
  );
  const hist = ce().querySelector(".prj-sec[data-secao='historico']")!;
  checar(
    "historico aberto com o resumo da tela 2",
    hist.classList.contains("prj-sec-aberta") && texto(hist.querySelector(".prj-sec-res")) === "Carla Dias alterou o término há 2 dias",
  );
  checar(
    "linhas do historico; nome hostil como texto",
    texto(hist.querySelector(".prj-hist div")) === "Carla Dias · 04/10 · término 25/09 → 02/10" &&
      texto(hist).includes(`${HOSTIL} · 28/08 · criou a etapa`) &&
      !hist.querySelector("img"),
  );
  checar("dependencia nao oferece a propria etapa", !opcoesDoCombo(ce(), "Adicionar dependência").includes("air"));
  digitar(ce().querySelector("input[name='documento']"), "1240001");
  await tique();
  checar("conferencia do numero SEI", texto(ce().querySelector(".prj-docok")) === "Documento encontrado no processo 50300.001234/2026-11");
  digitar(ce().querySelector("input[name='documento']"), "999");
  await tique();
  checar("numero nao encontrado", texto(ce().querySelector(".prj-docok")) === "Não encontrado no SEI: confira o número.");
  e.t.recusar = ["Dependência circular: “Relatório de AIR” → “Nota técnica” → “Relatório de AIR”."];
  botao(ce(), "Salvar")!.click();
  await tique();
  checar(
    "erro do repositorio aparece e o dialogo fica",
    texto(ce().querySelector(".prj-erros")).startsWith("Dependência circular") && !!ce(),
  );
  checar(
    "processo: sem escolha, herda o do projeto",
    combo(ce(), "Processo da etapa")?.textContent?.includes("processo do projeto") === true,
  );
  botao(ce(), "Excluir")!.click();
  await tique();
  checar("excluir fecha e chama", excluiu === 1 && !ce());

  secao("app: dialogo da etapa (excluir que falha)");
  const soltas: unknown[] = [];
  const ouvir = (r: unknown) => soltas.push(r);
  process.on("unhandledRejection", ouvir);
  let falha: Error = new ErroValidacao(["A etapa tem dependentes."]);
  let tentativas = 0;
  const x = cena({
    etapa: air,
    excluir: async () => {
      tentativas += 1;
      throw falha;
    },
  });
  const cx = () => x.doc.querySelector(".prj-form-etapa") as HTMLElement;
  botao(cx(), "Excluir")!.click();
  await tique(20);
  checar(
    "excluir recusado (ErroValidacao): dialogo fica com a mensagem",
    tentativas === 1 && !!cx() && texto(cx().querySelector(".prj-erros")) === "A etapa tem dependentes." && x.fechados() === 0,
  );
  falha = new Error("sem rede");
  botao(cx(), "Excluir")!.click();
  await tique(20);
  checar(
    "excluir com erro generico: dialogo fica com a mensagem",
    tentativas === 2 && !!cx() && texto(cx().querySelector(".prj-erros")) === "Não foi possível salvar: sem rede",
  );
  checar("sem rejeicao solta", soltas.length === 0, soltas);
  process.off("unhandledRejection", ouvir);

  secao("app: dialogo da etapa com o documento de processo sigiloso sem o numero (o marcador do texto)");
  const sigilosa = { ...air, documento: { numero: "", sigiloso: true } };
  const sg = cena({ etapa: sigilosa });
  const csg = () => sg.doc.querySelector(".prj-form-etapa") as HTMLElement;
  const resumoProc = () => texto(csg().querySelector(".prj-sec[data-secao='processo'] .prj-sec-res"));
  checar(
    "o resumo diz 'documento de processo sigiloso' (nada de 'SEI ' vazio) e o campo vem vazio",
    resumoProc().endsWith("· documento de processo sigiloso") &&
      csg().querySelector<HTMLInputElement>("input[name='documento']")?.value === "",
    resumoProc(),
  );
  checar(
    "o campo explica que o numero nao esta neste computador",
    texto(csg().querySelector(".prj-sec[data-secao='processo']")).includes("Documento de processo sigiloso"),
  );
  botao(csg(), "Salvar")!.click();
  await tique();
  checar(
    "salvar sem mexer no campo mantem o marcador (nao apaga o numero de quem o tem)",
    JSON.stringify(sg.salvos[0]?.documento) === JSON.stringify({ numero: "", sigiloso: true }),
    sg.salvos[0]?.documento,
  );
  const sg2 = cena({ etapa: sigilosa });
  const csg2 = () => sg2.doc.querySelector(".prj-form-etapa") as HTMLElement;
  digitar(csg2().querySelector("input[name='documento']"), "1240001");
  botao(csg2(), "Salvar")!.click();
  await tique();
  checar(
    "um numero digitado substitui o marcador",
    JSON.stringify(sg2.salvos[0]?.documento) === JSON.stringify({ numero: "1240001" }),
    sg2.salvos[0]?.documento,
  );

  secao("app: dialogo da etapa com o processo sigiloso sem o numero (o vinculo vazio do texto)");
  const VV = { protocolo: "", sigiloso: true };
  const comVV = { ...air, processo: VV, documento: { numero: "", sigiloso: true } };
  const abrirVV = (m: Partial<ContextoDialogoEtapa> = {}) => {
    const x = cena({ etapa: comVV, ...m });
    const f = () => x.doc.querySelector(".prj-form-etapa") as HTMLElement;
    const resumo = () => texto(f().querySelector(".prj-sec[data-secao='processo'] .prj-sec-res"));
    return { ...x, f, resumo };
  };
  const v1 = abrirVV();
  checar(
    "o campo vem com 'Processo sigiloso' escolhido e o resumo diz 'processo sigiloso'",
    texto(combo(v1.f(), "Processo da etapa")) === "Processo sigiloso" &&
      v1.resumo() === "processo sigiloso · documento de processo sigiloso",
    { combo: texto(combo(v1.f(), "Processo da etapa")), resumo: v1.resumo() },
  );
  digitar(v1.f().querySelector("input[name='nome']"), "Relatório de AIR revisado");
  botao(v1.f(), "Salvar")!.click();
  await tique();
  checar(
    "renomear e salvar sem mexer no processo mantem o vinculo vazio marcado (nao apaga o processo de quem tem o numero)",
    JSON.stringify(v1.salvos[0]?.processo) === JSON.stringify(VV) && v1.salvos[0]?.nome === "Relatório de AIR revisado",
    v1.salvos[0]?.processo,
  );
  const v2 = abrirVV();
  escolherCombo(v2.f(), "Processo da etapa", "");
  botao(v2.f(), "Salvar")!.click();
  await tique();
  checar(
    "escolher 'O processo do projeto' (o vazio) tira o vinculo: a etapa volta a herdar",
    !!v2.salvos[0] && v2.salvos[0].processo === undefined,
    v2.salvos[0]?.processo,
  );
  const v3 = abrirVV();
  await criarNoCombo(v3.f(), "Processo da etapa", "50300.000002/2026-11");
  botao(v3.f(), "Salvar")!.click();
  await tique();
  checar(
    "um numero digitado substitui o vinculo vazio",
    JSON.stringify(v3.salvos[0]?.processo) === JSON.stringify({ protocolo: "50300.000002/2026-11" }),
    v3.salvos[0]?.processo,
  );
  const v4 = abrirVV({ etapa: air, projeto: { ...p, projeto: projeto({ id: "p1", processo: VV }) } });
  checar(
    "etapa sem processo proprio num projeto de processo sigiloso: 'O processo do projeto' e o resumo 'processo sigiloso'",
    texto(combo(v4.f(), "Processo da etapa")) === "O processo do projeto" && v4.resumo() === "processo sigiloso · sem documento",
    { combo: texto(combo(v4.f(), "Processo da etapa")), resumo: v4.resumo() },
  );
  botao(v4.f(), "Salvar")!.click();
  await tique();
  checar("e salvar segue herdando (sem processo proprio)", !!v4.salvos[0] && v4.salvos[0].processo === undefined, v4.salvos[0]?.processo);

  secao("app: dialogo da etapa recusa numero de documento invalido");
  const di = cena({ etapa: air });
  const cdi = () => di.doc.querySelector<HTMLElement>(".prj-form-etapa");
  digitar(cdi()?.querySelector("input[name='documento']"), "12a");
  botao(cdi()!, "Salvar")!.click();
  await tique();
  checar(
    "'12a': 'Número de documento inválido.' e nada salvo",
    texto(cdi()?.querySelector(".prj-erros")) === "Número de documento inválido." && di.salvos.length === 0,
    texto(cdi()?.querySelector(".prj-erros")),
  );
  const dj = cena({ etapa: air });
  const cdj = () => dj.doc.querySelector(".prj-form-etapa") as HTMLElement;
  digitar(cdj().querySelector("input[name='documento']"), " 1240001 ");
  botao(cdj(), "Salvar")!.click();
  await tique();
  checar("' 1240001 ': salva o numero sem os espacos", dj.salvos[0]?.documento?.numero === "1240001", dj.salvos[0]?.documento);

  secao("app: dialogo da etapa corta o historico (o registro nao tem teto no texto da unidade)");
  const mega = "x".repeat(1_000_000);
  const regGrande = (id: string, quando: number, extra: Partial<Registro>): Registro => ({
    id,
    alvo: "air",
    projeto: "p1",
    quando,
    por: "carla",
    campo: "nome",
    atualizadoEm: 1,
    dispositivo: "d",
    ...extra,
  });
  const dg = cena({
    etapa: air,
    secaoAberta: "historico",
    historico: async () => [
      regGrande("g1", new Date(2026, 9, 5, 10).getTime(), { nome: mega, antes: mega, depois: mega }),
      regGrande("g2", new Date(2026, 9, 4, 10).getTime(), {
        nome: "Ana",
        campo: "processo",
        antes: "processo sigiloso",
        depois: "processo sigiloso",
      }),
    ],
  });
  await tique();
  const hg = dg.doc.querySelector(".prj-form-etapa .prj-sec[data-secao='historico']")!;
  const linhasG = [...hg.querySelectorAll(".prj-hist > div")].map((x) => texto(x));
  checar(
    "valor e nome de 1 MB cortados nas linhas e no resumo",
    (linhasG[0]?.length ?? 0) < 600 && texto(hg.querySelector(".prj-sec-res")).length < 200,
    [linhasG[0]?.length, texto(hg.querySelector(".prj-sec-res")).length],
  );
  checar("o texto de sigilo do historico vale na etapa tambem", linhasG[1] === "Ana · 04/10 · trocou o processo sigiloso", linhasG[1]);

  // Revisão final da P4, item 12: o carimbo que não vira data (forjado, ou de uma versão de antes do teto) não
  // vira "NaN/NaN" na linha nem no resumo: a mesma guarda do diálogo Histórico.
  const df = cena({
    etapa: air,
    secaoAberta: "historico",
    historico: async () => [regGrande("f1", 1e300, { nome: "Bia", campo: "fim", antes: "2026-10-01", depois: "2026-10-02" })],
  });
  await tique();
  const hf = df.doc.querySelector(".prj-form-etapa .prj-sec[data-secao='historico']")!;
  const linhaF = texto(hf.querySelector(".prj-hist > div"));
  const resumoF = texto(hf.querySelector(".prj-sec-res"));
  checar(
    "carimbo forjado: sem NaN na linha nem no resumo",
    !/NaN/.test(linhaF) && !/NaN/.test(resumoF) && linhaF.startsWith("Bia · --/-- ·"),
    [linhaF, resumoF],
  );
}
