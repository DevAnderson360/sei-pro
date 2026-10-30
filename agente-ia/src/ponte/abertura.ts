/** Abertura no mundo isolado, sem depender do JavaScript reescrito pelo portal. */
const BOTOES_LEGADOS = "#iconAIActions, .iconPro_agenteia";

export function capturarAberturaAgente(doc: Document, abrir: () => void): void {
  doc.addEventListener("click", (ev) => {
    if ("button" in ev && (ev as MouseEvent).button !== 0) return;
    const alvo = ev.target as Element | null;
    if (!alvo?.closest?.(BOTOES_LEGADOS)) return;
    ev.preventDefault();
    // O onclick antigo usa window.top; nao deve disparar de novo depois daqui.
    ev.stopImmediatePropagation();
    abrir();
  }, true);
}

export const CABECALHO_SEI = "#lnkInfraUnidade, #frmProtocoloPesquisaRapida";

/** Frames de arvore/documento nunca assumem o lugar da tela principal. */
export function podeAtenderNoFrame(url: string, noTopo: boolean, temSeiAcima: boolean): boolean {
  if (noTopo) return true;
  if (temSeiAcima) return false;
  try {
    const u = new URL(url);
    return /^https?:$/.test(u.protocol) && /^\/f5-w-[a-f0-9]+\$\$\//i.test(u.pathname);
  } catch {
    return false;
  }
}

/** O portal pode ter origem diferente; nao e necessario ler o seu documento. */
export function temSeiAncestral(janela: Window): boolean {
  let atual = janela;
  while (atual.parent !== atual) {
    try {
      atual = atual.parent;
      if (atual.document.querySelector(CABECALHO_SEI)) return true;
    } catch {
      return false;
    }
  }
  return false;
}
