import { observarAltura } from "../src/painel/altura";
import { avisoNaPagina, emissorDeAvisoPelaPagina } from "../src/painel/aviso";
import { criarSobreposicao, sobreposicaoNoApp } from "../src/painel/sobreposicao";
import type { Rpc } from "../src/ponte/rpc";
import { avisar as avisarNoApp, definirEmissorDeAviso } from "../src/ui/aviso";
import { botao, checar, disparar, instalarDom, lanca, secao, tique } from "./util";

/** Um rpc que só anota o que o app pediu; `responder` decide a resposta de cada operação. */
function rpcFalso(responder: (op: string, args: unknown) => Promise<unknown> = async () => true) {
  const chamadas: Array<{ op: string; args: unknown; prazo?: number }> = [];
  const rpc: Pick<Rpc, "chamar"> = {
    chamar: <T>(op: string, args?: unknown, prazo?: number) => {
      chamadas.push({ op, args, prazo });
      return responder(op, args) as Promise<T>;
    },
  };
  return { rpc, chamadas };
}

export async function verificarPainelApp(): Promise<void> {
  secao("painel (app): altura do iframe");
  const doc = instalarDom('<html><body><div id="app"></div></body></html>');
  const app = doc.getElementById("app") as HTMLElement;
  let alturaApp = 200;
  app.getBoundingClientRect = () => ({ height: alturaApp }) as DOMRect;
  let aoRedimensionar: () => void = () => undefined;
  const g = globalThis as { ResizeObserver?: unknown };
  const roOriginal = g.ResizeObserver;
  g.ResizeObserver = class {
    constructor(cb: () => void) {
      aoRedimensionar = cb;
    }
    observe() {}
  };
  const { rpc, chamadas } = rpcFalso();
  const alt = observarAltura(rpc, app);
  const pxs = () => chamadas.filter((c) => c.op === "altura").map((c) => (c.args as { px: number }).px);
  checar("pede a altura do conteudo (+4) ao montar", pxs().join() === "204");
  aoRedimensionar();
  checar("mesma altura: nao pede de novo", pxs().length === 1);
  alt.minimo(640);
  alt.extra(900);
  alt.extra(0);
  alt.minimo(0);
  checar("minimo do dialogo e fundo da lista aberta valem enquanto ativos", pxs().join() === "204,640,900,640,204", pxs());
  alturaApp = 300;
  alt.medir();
  checar("medir de novo (ResizeObserver suspenso fora da tela)", pxs().at(-1) === 304);
  g.ResizeObserver = roOriginal;

  secao("painel (app): sobreposicao do dialogo");
  const docS = instalarDom();
  const html = docS.documentElement;
  const minimos: number[] = [];
  const s1 = rpcFalso(async () => true);
  const sob = sobreposicaoNoApp(s1.rpc, { minimo: (px) => minimos.push(px) }, { doc: docS });
  sob.abrir();
  checar("abrindo enquanto a aba responde", html.dataset.sobreposto === "abrindo");
  await tique();
  checar("a aba pos o iframe por cima: sim", html.dataset.sobreposto === "sim" && s1.chamadas[0]?.op === "sobrepor");
  sob.abrir();
  sob.fechar();
  checar("dois dialogos, um fechado: continua", html.dataset.sobreposto === "sim" && s1.chamadas.length === 1);
  sob.fechar();
  checar(
    "o ultimo fecha: desliga na aba e tira o minimo",
    html.dataset.sobreposto === undefined &&
      minimos.join() === "0" &&
      (s1.chamadas[1]?.args as { ativo?: boolean } | undefined)?.ativo === false,
  );
  const s2 = rpcFalso(async () => false);
  const sob2 = sobreposicaoNoApp(s2.rpc, { minimo: (px) => minimos.push(px) }, { doc: docS });
  sob2.abrir();
  await tique();
  checar("painel recolhido (a aba nega): o iframe cresce", html.dataset.sobreposto === "falhou" && minimos.at(-1) === 640);
  sob2.fechar();
  const s3 = rpcFalso(() => new Promise(() => undefined));
  const sob3 = sobreposicaoNoApp(s3.rpc, { minimo: (px) => minimos.push(px) }, { doc: docS, espera: 10 });
  sob3.abrir();
  await tique(30);
  checar("aba sem resposta (versao antiga): cresce depois da espera", html.dataset.sobreposto === "falhou" && minimos.at(-1) === 640);
  sob3.fechar();

  secao("painel (aba): sobreposicao");
  const docP = instalarDom(
    '<html><body><div id="corpo"><iframe id="f" style="width: 100%; height: 300px; border: 0;"></iframe></div></body></html>',
  );
  const fr = docP.getElementById("f") as HTMLIFrameElement;
  const corpo = docP.getElementById("corpo") as HTMLElement;
  const sp = criarSobreposicao(docP, fr, corpo);
  checar(
    "liga: iframe cobre a tela e a pagina trava",
    sp.ligar(true) && fr.style.position === "fixed" && docP.documentElement.style.overflow === "hidden",
  );
  sp.altura(500);
  sp.ligar(false);
  checar(
    "desliga e aplica a altura pedida no meio",
    fr.style.position === "" && fr.style.height === "500px" && docP.documentElement.style.overflow === "",
  );
  corpo.hidden = true;
  checar("painel recolhido: nega e nao trava", !sp.ligar(true) && docP.documentElement.style.overflow === "");
  corpo.hidden = false;
  sp.ligar(true);
  disparar(fr, "load");
  checar("app recarregado com dialogo aberto: destrava sozinho", fr.style.position === "" && docP.documentElement.style.overflow === "");

  secao("painel (aba): aviso no rodape da tela");
  const docA = instalarDom();
  const avisar = avisoNaPagina(docA, false, "spro-prj");
  const hostil = '<img src=x onerror="alert(1)">';
  const resposta = avisar(hostil, "Desfazer", 5000);
  const toast = docA.querySelector(".spro-prj-aviso");
  checar(
    "texto hostil como texto, com a animacao do prefixo",
    toast?.textContent?.includes(hostil) === true &&
      !toast.querySelector("img") &&
      (toast.getAttribute("style") ?? "").includes("animation:spro-prj-aviso"),
  );
  botao(docA.body, "Desfazer")!.click();
  checar("a acao volta ao app", (await resposta) === true && !docA.querySelector(".spro-prj-aviso"));
  void avisar("Primeiro", undefined, 5000);
  const ultimo = avisar("Segundo", undefined, 20);
  checar(
    "um aviso por vez",
    docA.querySelectorAll(".spro-prj-aviso").length === 1 && docA.querySelector(".spro-prj-aviso")?.textContent === "Segundo",
  );
  checar("some sozinho e diz que nao houve acao", (await ultimo) === false);
  checar(
    "prefixo que nao e classe simples e recusado",
    (await lanca(() => avisoNaPagina(docA, false, "x;}body{")))?.message?.includes("Prefixo") === true,
  );

  secao("painel (app): emissor de avisos pela pagina");
  const docE = instalarDom();
  let desfez = 0;
  const e1 = rpcFalso(async () => true);
  const emitir = emissorDeAvisoPelaPagina(e1.rpc, docE);
  checar("manda para a aba", emitir("Projeto excluido.", { rotulo: "Desfazer", fazer: () => desfez++ }, 7000) === true);
  await tique();
  checar(
    "com o rotulo da acao e prazo de resposta maior que o aviso",
    e1.chamadas[0]?.op === "aviso" &&
      (e1.chamadas[0]?.args as { acao?: string } | undefined)?.acao === "Desfazer" &&
      e1.chamadas[0]?.prazo === 12000 &&
      desfez === 1,
  );
  docE.documentElement.dataset.sobreposto = "sim";
  checar("com dialogo sobreposto: o app mostra ele mesmo", emitir("x", undefined, 50) === false && e1.chamadas.length === 1);
  delete docE.documentElement.dataset.sobreposto;
  const e2 = rpcFalso(async () => {
    throw new Error("sem aba");
  });
  emissorDeAvisoPelaPagina(e2.rpc, docE)("Copiado.", undefined, 50);
  await tique();
  checar("aba sem resposta: o aviso aparece no app", docE.querySelector(".spro-aviso")?.textContent?.includes("Copiado.") === true);

  secao("painel (app): aviso dado com dialogo aberto vai para a pagina quando ele fecha");
  const docR = instalarDom('<html><body><dialog open id="d"></dialog></body></html>');
  const dR = docR.getElementById("d") as HTMLElement;
  // Como o abrirModal dos apps (o primeiro ouvinte): fechar tira o diálogo da página e desliga a sobreposição.
  docR.documentElement.dataset.sobreposto = "sim";
  dR.addEventListener("close", () => {
    dR.remove();
    delete docR.documentElement.dataset.sobreposto;
  });
  let desfeitoR = 0;
  const r1 = rpcFalso(async () => true);
  definirEmissorDeAviso(emissorDeAvisoPelaPagina(r1.rpc, docR));
  avisarNoApp("Etapa “Nota” excluída.", { rotulo: "Desfazer", fazer: () => desfeitoR++ }, 5000);
  const localR = docR.querySelector(".spro-aviso");
  checar("com o dialogo aberto, o aviso fica no dialogo (clicavel)", !!localR && dR.contains(localR) && r1.chamadas.length === 0);
  dR.removeAttribute("open");
  disparar(dR, "close");
  await tique();
  const pedidoR = r1.chamadas[0]?.args as { texto?: string; acao?: string; ms?: number } | undefined;
  checar(
    "ao fechar, o aviso vai para a pagina com a acao e sai do app",
    r1.chamadas[0]?.op === "aviso" &&
      pedidoR?.texto === "Etapa “Nota” excluída." &&
      pedidoR.acao === "Desfazer" &&
      !localR?.isConnected &&
      !docR.querySelector(".spro-aviso"),
    r1.chamadas,
  );
  checar(
    "com o tempo que faltava, e o Desfazer clicado na pagina volta ao app",
    (pedidoR?.ms ?? 0) <= 5000 && (pedidoR?.ms ?? 0) > 4000 && desfeitoR === 1,
    { ms: pedidoR?.ms, desfeitoR },
  );
  const docR2 = instalarDom('<html><body><dialog open id="d"></dialog></body></html>');
  const dR2 = docR2.getElementById("d") as HTMLElement;
  dR2.addEventListener("close", () => dR2.remove());
  docR2.documentElement.dataset.sobreposto = "sim";
  const r2 = rpcFalso(async () => true);
  definirEmissorDeAviso(emissorDeAvisoPelaPagina(r2.rpc, docR2));
  avisarNoApp("Arquivado.", { rotulo: "Desfazer", fazer: () => undefined }, 5000);
  // Outro diálogo continua aberto (a sobreposição fica): o emissor recusa de novo e o aviso desce para o body do app.
  dR2.removeAttribute("open");
  disparar(dR2, "close");
  await tique();
  checar(
    "emissor que recusa de novo: o aviso continua no app, no body",
    r2.chamadas.length === 0 && docR2.querySelector(".spro-aviso")?.parentElement === docR2.body,
  );
  definirEmissorDeAviso(null);
}
