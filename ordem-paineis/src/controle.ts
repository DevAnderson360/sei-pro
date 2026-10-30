/**
 * Mantém a página de acordo com a configuração: aplica a ordem e a visibilidade, põe o botão e
 * reconcilia quando um painel monta depois (cada módulo monta no seu tempo) ou quando o legado
 * refaz a barra de título. A escrita é idempotente e o observador fica desligado durante ela:
 * ocioso, o módulo não produz mutação nenhuma.
 */
import { CLASSE_BOTAO, garantirBotao, removerBotao } from './botao';
import { abrirModal, CLASSE_HOST, type OpcoesModal } from './modal';
import { type Config, configVazia } from './modelo';
import { aplicar, listarPaineis } from './paineis';

const ATRASO = 60;

/** Mudança que importa: entrou ou saiu um painel ou a barra de título. */
function relevante(registros: MutationRecord[]): boolean {
  const toca = (no: Node) => {
    if (no.nodeType !== 1) return false;
    const e = no as Element;
    return e.classList.contains('panelHomePro') || e.classList.contains(CLASSE_BOTAO) || e.classList.contains('titlePanelHome') || e.id === 'divInfraBarraLocalizacao' || e.id === 'panelHomePro' || !!e.querySelector?.('.panelHomePro, .titlePanelHome');
  };
  return registros.some(r => [...r.addedNodes].some(toca) || [...r.removedNodes].some(toca));
}

export function iniciar(doc: Document, gravar: (cfg: Config) => void, css = '') {
  const janela = doc.defaultView;
  let cfg = configVazia();
  let encerrado = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let observador: MutationObserver | undefined;

  const abrir = () => {
    const opcoes: OpcoesModal = { css, escuro: !!doc.body?.classList.contains('dark-mode') };
    abrirModal(doc, listarPaineis(doc), cfg, nova => {
      cfg = nova;
      gravar(nova);
      atualizar();
    }, opcoes);
  };

  function observar() {
    if (!janela || !doc.body) return;
    observador ??= new janela.MutationObserver(registros => {
      if (!encerrado && relevante(registros)) agendar();
    });
    observador.observe(doc.body, { childList: true, subtree: true });
  }

  function atualizar() {
    if (encerrado) return;
    observador?.disconnect();
    aplicar(doc, cfg);
    garantirBotao(doc, abrir);
    observar();
  }

  function agendar() {
    clearTimeout(timer);
    timer = setTimeout(atualizar, ATRASO);
  }

  return {
    configurar(nova: Config) {
      if (encerrado) return;
      cfg = nova;
      atualizar();
    },
    encerrar() {
      encerrado = true;
      clearTimeout(timer);
      observador?.disconnect();
      aplicar(doc, configVazia());
      removerBotao(doc);
      doc.querySelectorAll(`.${CLASSE_HOST}`).forEach(d => d.remove());
    },
  };
}
