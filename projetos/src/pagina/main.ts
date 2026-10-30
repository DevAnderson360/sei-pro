/**
 * Content script do gestor de projetos (mundo isolado, todos os frames,
 * document_start): só o carregador (T11), porque roda em TODO frame do SEI.
 * Primeiro marca o documento, de forma síncrona, para o legado não carregar o
 * sei-pro-projetos.js: o primeiro import (`./marcar`) é um efeito que roda
 * antes de todo o resto. Em todo frame, os Textos Padrão de dados do SEI Pro
 * saem do seletor de "Texto Padrão" ao gerar documento (cosmético). Depois, com
 * o DOM, decide pela tela (pagina/carregador.ts): só a janela de topo com
 * unidade e o frame da árvore importam o pacote da página
 * (`js/projetos/pagina.js`, pagina/principal.ts); os outros frames param aqui.
 */

// Primeiro de tudo (efeito de importação): a marca do <html> antes de qualquer outro módulo.
import "./marcar";
import { lerOpcaoLegada } from "@comum/opcoes/legadas";
import { ocultarTextosInternos } from "@comum/sincronia/controlePagina";
import { carregarProjetos, type PacotePagina } from "./carregador";

const global = window as unknown as { __seiProProjetos?: boolean };
if (!global.__seiProProjetos) {
  // O mesmo arquivo injetado duas vezes (matches que se sobrepõem) não monta dois painéis.
  global.__seiProProjetos = true;
  const iniciar = () => {
    // Cosmético e barato, em todo frame: os textos de dados do SEI Pro não aparecem como modelo ao gerar documento.
    try {
      ocultarTextosInternos(document);
    } catch (e) {
      console.warn("[SEI Pro] projetos: textos internos", e);
    }
    void carregarProjetos({
      topo: window === window.top,
      doc: document,
      url: location.href,
      opcaoLigada: () => lerOpcaoLegada("gerenciarprojetos"),
      // O módulo importado pelo content script roda no mesmo mundo isolado (com o chrome.*); está no WAR do Lab.
      importar: (caminho) => import(chrome.runtime.getURL(caminho)) as Promise<PacotePagina>,
    }).catch((e) => console.warn("[SEI Pro] projetos:", e));
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  else iniciar();
}
