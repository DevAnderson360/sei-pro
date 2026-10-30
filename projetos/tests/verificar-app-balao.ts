import { type AcoesBalao, abrirBalaoEtapa } from "../src/app/componentes/balaoEtapa";
import type { ProjetoNaTela } from "../src/app/dados";
import { resumoDoProjeto } from "../src/modelo/resumo";
import type { Etapa } from "../src/modelo/tipos";
import { digitar, itemDoMenu, itensDoMenu, tecla, telaDoApp, texto } from "./apoioApp";
import { HOSTIL } from "./cenarioGantt";
import { etapa, fase, HOJE, projeto } from "./fabrica";
import { botao, checar, secao } from "./util";

function cena(e: Etapa) {
  const fases = [fase({ id: "f1", nome: "Instrução" }), fase({ id: "f2", nome: "Deliberação" })];
  const p: ProjetoNaTela = {
    projeto: projeto({ id: "p1", processo: { protocolo: "50300.001234/2026-11", idProcedimento: "77" } }),
    vis: "unidade",
    fases,
    etapas: [e],
    resumo: resumoDoProjeto([e], HOJE),
  };
  const feitos: string[] = [];
  const acoes: AcoesBalao = {
    aoConcluir: () => feitos.push("concluir"),
    aoReabrir: () => feitos.push("reabrir"),
    aoEditar: (s) => feitos.push(`editar${s ? `:${s}` : ""}`),
    aoProgresso: (n) => feitos.push(`progresso:${n}`),
    aoAbrirDocumento: (n) => feitos.push(`doc:${n}`),
    aoAbrirProcesso: (v) => feitos.push(`proc:${v.protocolo}`),
    aoDuplicar: () => feitos.push("duplicar"),
    aoMoverFase: (f) => feitos.push(`fase:${f ?? "-"}`),
    aoExcluir: () => feitos.push("excluir"),
  };
  return { p, acoes, feitos };
}

export function verificarAppBalao(): void {
  secao("app: balao da etapa atrasada e replanejada");
  const doc = telaDoApp();
  const ancora = doc.createElement("button");
  doc.getElementById("app")!.append(ancora);
  const e = etapa({
    id: "e1",
    nome: HOSTIL,
    fase: "f1",
    inicio: "2026-09-01",
    fim: "2026-10-02",
    base: { inicio: "2026-09-01", fim: "2026-09-25" },
    responsavel: { nome: "Carla Dias" },
    checklist: [
      { id: "c1", texto: "a", feito: true },
      { id: "c2", texto: "b", feito: false },
    ],
    documento: { numero: "1240001", titulo: "Relatório de AIR 3/2026" },
  });
  const { p, acoes, feitos } = cena(e);
  const b = abrirBalaoEtapa(ancora, { etapa: e, projeto: p, hoje: HOJE }, acoes);
  const el = b.el;
  checar("balao num dialog nao modal", el.tagName.toLowerCase() === "dialog" && el.classList.contains("prj-balao"));
  checar("pilula com dias uteis de atraso", texto(el.querySelector(".spro-pilula")) === "Atrasada · 2 dias úteis");
  checar("nome hostil como texto", texto(el.querySelector("h3")) === HOSTIL && !el.querySelector("img"));
  checar("fase e responsavel", texto(el.querySelector(".prj-balao-sub")) === "Instrução · Carla Dias");
  const linhas = [...el.querySelectorAll(".prj-balao-li")].map((l) => texto(l));
  checar("datas e duracao em dias uteis", linhas[0]?.startsWith("01/09/2026 → 02/10/2026 · 23 dias úteis") === true, linhas);
  checar(
    "aviso de replanejamento",
    linhas[0]?.includes("Replanejada: o plano original terminava em 25/09/2026 (+5 dias úteis)") === true,
    linhas[0],
  );
  checar("checklist X de Y", linhas.includes("Checklist: 1 de 2 itens"));
  checar(
    "documento e processo como links",
    linhas.includes("Relatório de AIR 3/2026 (SEI 1240001)") && linhas.includes("50300.001234/2026-11"),
  );
  const links = [...el.querySelectorAll<HTMLAnchorElement>(".prj-balao-li a")];
  links[0]!.click();
  links[1]!.click();
  checar("abrir documento e processo", feitos.join() === "doc:1240001,proc:50300.001234/2026-11");
  const regua = el.querySelector<HTMLInputElement>("input[type='range']");
  checar("regua de progresso so com medida manual", !!regua && regua.value === "0");
  digitar(regua, "55");
  digitar(regua, "60");
  checar(
    "a regua mostra o valor e ainda nao grava (cada seta e um change)",
    !feitos.some((f) => f.startsWith("progresso")) && texto(el.querySelector(".prj-balao-prog b")) === "60%",
    feitos,
  );
  const abrir = () => abrirBalaoEtapa(ancora, { etapa: e, projeto: p, hoje: HOJE }, acoes).el;
  botao(el, "Concluir etapa")!.click();
  checar(
    "toda acao fecha o balao; o progresso pendente grava antes, uma vez, com o ultimo valor",
    feitos.slice(-2).join() === "progresso:60,concluir" &&
      feitos.filter((f) => f.startsWith("progresso")).length === 1 &&
      !doc.querySelector(".prj-balao"),
    feitos,
  );
  botao(abrir(), "Editar")!.click();
  checar("editar", feitos.at(-1) === "editar");
  const menu = itensDoMenu(abrir(), "Mais ações da etapa");
  checar(
    "menu: duplicar, mover, historico, excluir",
    menu.join("|") === "Duplicar|Mover para “Deliberação”|Mover para “Sem fase”|Histórico|Excluir",
    menu,
  );
  itemDoMenu(doc.querySelector(".prj-balao")!, "Mais ações da etapa", "Mover para “Deliberação”");
  itemDoMenu(abrir(), "Mais ações da etapa", "Histórico");
  itemDoMenu(abrir(), "Mais ações da etapa", "Excluir");
  itemDoMenu(abrir(), "Mais ações da etapa", "Duplicar");
  checar("itens do menu", feitos.slice(-4).join() === "fase:f2,editar:historico,excluir,duplicar", feitos);
  tecla(abrir(), "Escape");
  checar("Esc fecha", !doc.querySelector(".prj-balao"));

  secao("app: balao de marco e de etapa concluida");
  const m = etapa({ id: "m1", marco: true, inicio: "2026-12-03", fim: "2026-12-03" });
  const cm = cena(m);
  const bm = abrirBalaoEtapa(ancora, { etapa: m, projeto: cm.p, hoje: HOJE }, cm.acoes);
  checar(
    "marco: pilula, uma data, sem regua",
    texto(bm.el.querySelector(".spro-pilula")) === "Marco" &&
      texto(bm.el.querySelector(".prj-balao-li")) === "03/12/2026" &&
      !bm.el.querySelector("input[type='range']"),
  );
  checar("sem fase", texto(bm.el.querySelector(".prj-balao-sub")) === "Sem fase");
  botao(bm.el, "Marcar como cumprido")!.click();
  checar("marcar como cumprido", cm.feitos.join() === "concluir");
  bm.fechar();
  const ok = etapa({ id: "ok", inicio: "2026-09-01", fim: "2026-09-10", concluidaEm: "2026-09-09", medida: "tempo" });
  const co = cena(ok);
  const bo = abrirBalaoEtapa(ancora, { etapa: ok, projeto: co.p, hoje: HOJE }, co.acoes);
  checar(
    "concluida: data da conclusao, sem regua nem nota de medida",
    texto(bo.el).includes("Concluída em 09/09/2026") && !bo.el.querySelector("input[type='range']") && !texto(bo.el).includes("pelo tempo"),
  );
  checar(
    "concluida: so Reabrir, sem Concluir nem Marcar como cumprido (nao reconclui)",
    !!botao(bo.el, "Reabrir") && !botao(bo.el, "Concluir etapa") && !botao(bo.el, "Marcar como cumprido"),
  );
  botao(bo.el, "Reabrir")!.click();
  checar("reabrir", co.feitos.join() === "reabrir");
  bo.fechar();
  const tempo = etapa({ id: "t", medida: "checklist", processo: { protocolo: "50300.000001/2026-01", sigiloso: true } });
  const ct = cena(tempo);
  const bt = abrirBalaoEtapa(ancora, { etapa: tempo, projeto: ct.p, hoje: HOJE }, ct.acoes);
  checar(
    "medida automatica: nota, sem regua; processo da etapa vence o do projeto",
    texto(bt.el).includes("Progresso calculado pelo checklist") &&
      !bt.el.querySelector("input[type='range']") &&
      texto(bt.el).includes("50300.000001/2026-01"),
  );
  bt.fechar();

  secao("app: balao do documento de processo sigiloso sem o numero (o marcador do texto)");
  const sig = etapa({ id: "sg", documento: { numero: "", sigiloso: true } });
  const cs = cena(sig);
  const bs = abrirBalaoEtapa(ancora, { etapa: sig, projeto: cs.p, hoje: HOJE }, cs.acoes);
  const linhasSig = [...bs.el.querySelectorAll(".prj-balao-li")].map((l) => texto(l));
  const linksSig = [...bs.el.querySelectorAll<HTMLAnchorElement>(".prj-balao-li a")].map((a) => texto(a));
  checar(
    "mostra 'Documento de processo sigiloso', sem numero e sem link (nada de 'Documento SEI ' vazio)",
    linhasSig.includes("Documento de processo sigiloso") &&
      !linhasSig.some((t) => t.includes("Documento SEI")) &&
      linksSig.join() === "50300.001234/2026-11",
    { linhasSig, linksSig },
  );
  bs.fechar();
  const vazio = etapa({ id: "vz", documento: { numero: "" } });
  const cv = cena(vazio);
  const bv = abrirBalaoEtapa(ancora, { etapa: vazio, projeto: cv.p, hoje: HOJE }, cv.acoes);
  checar(
    "numero vazio SEM a marca: como sem documento (nenhuma linha de documento)",
    ![...bv.el.querySelectorAll(".prj-balao-li")].some((l) => /Documento/.test(texto(l))),
    [...bv.el.querySelectorAll(".prj-balao-li")].map((l) => texto(l)),
  );
  bv.fechar();

  secao("app: balao do processo sigiloso sem o numero (o vinculo vazio do texto)");
  const VV = { protocolo: "", sigiloso: true };
  const proprio = etapa({ id: "pv", processo: VV });
  const cp = cena(proprio);
  const bp = abrirBalaoEtapa(ancora, { etapa: proprio, projeto: cp.p, hoje: HOJE }, cp.acoes);
  const linhasP = [...bp.el.querySelectorAll(".prj-balao-li")].map((l) => texto(l));
  const linksP = [...bp.el.querySelectorAll(".prj-balao-li a")].map((a) => texto(a));
  checar(
    "processo proprio marcador: 'Processo sigiloso', sem link (nada do processo do projeto no lugar)",
    linhasP.includes("Processo sigiloso") && !linhasP.some((t) => t.includes("50300.001234")) && linksP.length === 0,
    { linhasP, linksP },
  );
  bp.fechar();
  const herda = etapa({ id: "hv" });
  const ch = cena(herda);
  const pMarcador: ProjetoNaTela = { ...ch.p, projeto: projeto({ id: "p1", processo: VV }) };
  const bh = abrirBalaoEtapa(ancora, { etapa: herda, projeto: pMarcador, hoje: HOJE }, ch.acoes);
  const linhasH = [...bh.el.querySelectorAll(".prj-balao-li")].map((l) => texto(l));
  checar(
    "sem processo proprio num projeto marcador: 'Processo sigiloso', sem link",
    linhasH.includes("Processo sigiloso") && bh.el.querySelectorAll(".prj-balao-li a").length === 0,
    linhasH,
  );
  bh.fechar();
}
