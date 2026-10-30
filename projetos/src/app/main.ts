/**
 * Entrada de html/projetos.html. Liga o app ao navegador: <dialog>, download,
 * janela de impressão e a ponte com a aba do SEI. Modos, pelo hash da URL:
 * - embutido (padrão): iframe abaixo da lista do Controle de Processos, ligado
 *   à PRÓPRIA aba (o content script conecta a cada carga do iframe), com a
 *   sincronia e a colaboração do P4 (`ligarApp`: menu, faixas, "Entendi",
 *   diálogos, cópias diárias e o arquivo ligado onde o navegador deixa);
 * - impressao: página só leitura, aberta pelo menu "Imprimir / salvar PDF"
 *   (o endereço é validado em `lerImpressao`: qualquer um pode abri-lo);
 * - lateral: aba "Projetos" do painel lateral, ligada à aba do SEI da frente nesta
 *   janela pela unidade (host|login|unidade): remonta ao trocar de unidade
 *   (`lateral/montagem.ts`) com o mesmo `ligarApp` (`lateral/criar.ts`). Segue o
 *   tema do sistema, como os Favoritos, e não imprime.
 */

import { areaChrome } from "@comum/armazenamento/area";
import { idDispositivo } from "@comum/armazenamento/dispositivo";
import { hojeISO } from "@comum/datas/dias";
import { novoId } from "@comum/id";
import { lerOpcaoLegada } from "@comum/opcoes/legadas";
import { observarAltura } from "@comum/painel/altura";
import { emissorDeAvisoPelaPagina } from "@comum/painel/aviso";
import { sobreposicaoNoApp } from "@comum/painel/sobreposicao";
import { esperarConexaoDaAba } from "@comum/ponte/conexaoDaAba";
import { PonteLateral } from "@comum/ponte/lateral";
import type { PortaRpc, Rpc } from "@comum/ponte/rpc";
import { temSeletorDeArquivo } from "@comum/sincronia/arquivo";
import { acompanharTemaDoPainel, aplicarTemaDoContexto } from "@comum/tema/painel";
import { definirEmissorDeAviso } from "@comum/ui/aviso";
import { baixar, criarAbrirModal, criarConfirmar } from "@comum/ui/dialogo";
import { h } from "@comum/ui/dom";
import { definirJanelaQueCresce } from "@comum/ui/flutuante";
import { CHAVE_LATERAL } from "../modelo/constantes";
import { escoposDaUnidade } from "../modelo/escopo";
import { CANAL_LATERAL, CANAL_PROJETOS, type ContextoProjetos } from "../ponte/tipos";
import { RepositorioProjetos } from "../repositorio";
import { controleArquivo, copiasDosProjetos } from "../sincronia/arquivo";
import { escolherArquivoLocal } from "./colaboracao/colaboracao";
import { hashDaImpressao, lerImpressao, montarImpressao } from "./impressao";
import { criarAppDoLateral } from "./lateral/criar";
import { MontagemLateral } from "./lateral/montagem";
import { ligarApp } from "./ligacao";
import { pedidosDaAba } from "./pedidos";

const html = document.documentElement;
const modo = new URLSearchParams(location.hash.slice(1)).get("modo") ?? "embutido";
html.dataset.modo = modo;
const raiz = document.getElementById("app")!;

// O que a aba pede ao app (pílula do título, "Abrir no painel" do P5): os tratadores entram na porta
// já; até o app ficar pronto, os pedidos esperam na fila.
const pedidos = pedidosDaAba();
// Embutido: o ouvinte da porta é registrado já, antes do `load` do iframe, que é quando o content script conecta.
const conexao = modo === "embutido" ? esperarConexaoDaAba(CANAL_PROJETOS, pedidos.tratadores) : null;

const erro = (texto: string) => raiz.replaceChildren(h("p", { class: "prj-erro" }, texto));
const mostrarErro = (e: unknown) => erro(`Não foi possível abrir os projetos: ${e instanceof Error ? e.message : String(e)}`);

if (modo === "impressao") void iniciarImpressao().catch(mostrarErro);
else if (modo === "lateral") void iniciarLateral().catch(mostrarErro);
else if (conexao) void iniciarEmbutido(conexao).catch(mostrarErro);
else erro("Este modo do painel ainda não está disponível.");

async function iniciarEmbutido(conectar: Promise<Rpc>): Promise<void> {
  const rpc = await conectar;
  const ctx = await rpc.chamar<ContextoProjetos>("contexto");
  const unidade = ctx.unidade;
  if (!unidade) {
    erro("Abra o SEI numa unidade para ver os projetos.");
    return;
  }
  // Painel abaixo da lista: segue o SEI (modo noturno do SEI Pro e a cor da barra do sistema).
  html.dataset.tema = ctx.temaEscuro ? "escuro" : "claro";
  if (ctx.corTema) {
    html.style.setProperty("--spro-cor-sei", ctx.corTema);
    html.dataset.corSei = "";
  }
  acompanharTemaDoPainel(document, {
    aoDesligar: async () => aplicarTemaDoContexto(html, await rpc.chamar<ContextoProjetos>("contexto")),
  });
  const altura = observarAltura(rpc);
  // A lista de um seletor ou menu aberto perto do fim do painel: o iframe cresce até ela caber.
  addEventListener("spro-popover", (ev) => altura.extra(Number((ev as CustomEvent<{ fundo?: number }>).detail?.fundo) || 0));
  definirJanelaQueCresce(() => html.dataset.sobreposto !== "sim");
  // Diálogo no meio da tela visível: a aba põe o iframe por cima de tudo enquanto há diálogo aberto.
  const sobrepor = sobreposicaoNoApp(rpc, altura);
  // Aviso no rodapé da TELA do SEI (o do iframe ficaria lá embaixo, fora da vista).
  definirEmissorDeAviso(emissorDeAvisoPelaPagina(rpc));
  const area = areaChrome(chrome.storage.local, "local");
  const dispositivo = await idDispositivo(area);
  const carimbo = () => ({ agora: Date.now(), dispositivo, por: ctx.login, nome: ctx.nome });
  const abrirModal = criarAbrirModal({ aoAbrir: sobrepor.abrir, aoFechar: sobrepor.fechar });
  // P4: a colaboração (sincronia, "Entendi", diálogos) e o app com o repositório da unidade que pergunta.
  const { app } = await ligarApp({
    raiz,
    ctx,
    area,
    sync: areaChrome(chrome.storage.sync, "sync"),
    rpc,
    abrirModal,
    confirmar: criarConfirmar(abrirModal),
    baixar,
    // O próprio arquivo (o tamanho é conferido antes de ler o texto).
    escolherArquivo: () => escolherArquivoLocal(),
    hoje: () => hojeISO(),
    agora: () => Date.now(),
    carimbo,
    copias: typeof indexedDB === "undefined" ? null : copiasDosProjetos(),
    // Dentro do iframe o Chrome pode recusar o seletor: o diálogo Sincronização explica.
    arquivo: temSeletorDeArquivo(window) ? controleArquivo(area, { host: ctx.host, login: ctx.login }, carimbo) : null,
    imprimir: (p) => void window.open(chrome.runtime.getURL(`html/projetos.html${hashDaImpressao(p)}`), "_blank"),
    aoRedesenhar: () => altura.medir(),
    janela: window,
  });
  pedidos.pronto(app);
  let espera: ReturnType<typeof setTimeout> | undefined;
  addEventListener("resize", () => {
    clearTimeout(espera);
    espera = setTimeout(() => app.aoRedimensionar(), 200);
  });
}

async function iniciarLateral(): Promise<void> {
  acompanharTemaDoPainel(document);
  // Painel lateral: claro ou escuro conforme o sistema (prefers-color-scheme), sem o `data-tema` do SEI.
  // Como o content script: a opção antiga "Gerenciar Projetos" desligada, nada de projetos (nem anúncio às abas).
  if (!(await lerOpcaoLegada("gerenciarprojetos"))) {
    erro("Os projetos estão desligados nas opções do SEI Pro (Gerenciar Projetos).");
    return;
  }
  const area = areaChrome(chrome.storage.local, "local");
  const dispositivo = await idDispositivo(area);
  let janela = -1;
  try {
    janela = (await chrome.windows.getCurrent()).id ?? -1;
  } catch {
    /* sidebar do Firefox: sem API de janelas, aceita qualquer aba */
  }
  const ponte = new PonteLateral({
    area,
    chave: CHAVE_LATERAL,
    janela,
    novoId: () => novoId(),
    ouvirConexoes: (cb) =>
      chrome.runtime.onConnect.addListener((porta) => {
        // As portas de outros canais (o painel embutido, os Favoritos, o agente) não são deste painel.
        if (porta.name === CANAL_LATERAL) cb(porta as unknown as PortaRpc, porta.sender ?? {});
      }),
  });
  const montagem = new MontagemLateral({
    raiz,
    ponte,
    area,
    agora: () => Date.now(),
    criar: criarAppDoLateral({
      raiz,
      area,
      sync: areaChrome(chrome.storage.sync, "sync"),
      abrirModal: criarAbrirModal(),
      baixar,
      // O próprio arquivo (o tamanho é conferido antes de ler o texto).
      escolherArquivo: () => escolherArquivoLocal(),
      hoje: () => hojeISO(),
      agora: () => Date.now(),
      dispositivo,
      copias: typeof indexedDB === "undefined" ? null : copiasDosProjetos(),
      // No lateral o seletor de arquivo funciona (no iframe do painel embutido o Chrome pode recusar).
      arquivo: (ctx, carimbo) =>
        temSeletorDeArquivo(window) ? controleArquivo(area, { host: ctx.host, login: ctx.login }, carimbo) : null,
    }),
  });
  montagem.iniciar();
  await ponte.iniciar();
  addEventListener("pagehide", () => void ponte.encerrar());
  // O arquivo ligado pode ter sido mudado por outro computador enquanto o painel estava escondido.
  addEventListener("focus", () => montagem.aoGanharFoco());
  document.addEventListener("visibilitychange", () => document.visibilityState === "visible" && montagem.aoGanharFoco());
  // As abas que já estão abertas conectam ao ver o anúncio; se nenhuma vier, avisa.
  setTimeout(() => void montagem.reagir(), 1500);
}

async function iniciarImpressao(): Promise<void> {
  // Papel é claro: os tokens da base valem no tema claro (fundo branco), seja qual for o do sistema.
  html.dataset.tema = "claro";
  const p = lerImpressao(location.hash);
  if (!p) {
    erro("Endereço de impressão incompleto ou inválido.");
    return;
  }
  const area = areaChrome(chrome.storage.local, "local");
  const esc = escoposDaUnidade(p.host, p.login, p.unidade);
  // Só leitura: o carimbo nunca grava nada.
  const leitura = () => ({ agora: Date.now(), dispositivo: "impressao" });
  await montarImpressao(raiz, p, {
    repos: { unidade: new RepositorioProjetos(area, esc.unidade, leitura), eu: new RepositorioProjetos(area, esc.eu, leitura) },
    hoje: hojeISO(),
    imprimir: () => window.print(),
  });
  // O nome do PDF sugerido pelo navegador vem do título.
  document.title = raiz.querySelector("h1")?.textContent || "Projetos";
}
