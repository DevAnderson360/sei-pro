/**
 * Content script do Gestor de Demandas (mundo isolado, todos os frames, document_start): só o carregador, porque roda
 * em TODO frame do SEI. Primeiro marca o documento, de forma síncrona: o primeiro import (`./marcar`) é um efeito que
 * roda antes de todo o resto. Depois, com o DOM, decide pela tela (pagina/carregador.ts): só a janela de topo com
 * unidade importa o pacote da página (`js/demandas/pagina.js`, pagina/principal.ts); os outros frames param aqui. A
 * opção "Gestor de Demandas" é desligada por padrão: sem ela marcada, nada é montado.
 */

// Primeiro de tudo (efeito de importação): a marca do <html> antes de qualquer outro módulo.
import "./marcar";
import { carregarDemandas, type PacotePagina } from "./carregador";
import { lerOpcaoDemandas } from "./opcao";

const global = window as unknown as { __seiProDemandas?: boolean };
if (!global.__seiProDemandas) {
  // O mesmo arquivo injetado duas vezes (matches que se sobrepõem) não monta dois painéis.
  global.__seiProDemandas = true;
  const iniciar = () => {
    void carregarDemandas({
      topo: window === window.top,
      doc: document,
      url: location.href,
      opcaoLigada: () => lerOpcaoDemandas(),
      // O módulo importado pelo content script roda no mesmo mundo isolado (com o chrome.*); está no WAR do Lab.
      importar: (caminho) => import(chrome.runtime.getURL(caminho)) as Promise<PacotePagina>,
    }).catch((e) => console.warn("[SEI Pro] demandas:", e));
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
}
