/**
 * Desenhos multicolor dos botões do SEI Pro nas barras de ações. Os ícones nativos do SEI são planos,
 * de cor própria e cantos arredondados; estes seguem a mesma linguagem (corpo cheio, um tom mais escuro
 * para a sombra e um claro para o detalhe), em vez de uma silhueta de uma cor só. Grade de 24 px.
 */
const svg = (corpo: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24">${corpo}</svg>`;

export const ICONES_PROPRIOS: Record<string, string> = {
  // Monitorar: alvo com mira
  alvo: svg(
    `<circle cx="12" cy="12" r="10" fill="#e5484d"/><circle cx="12" cy="12" r="6.8" fill="#fff"/><circle cx="12" cy="12" r="3.9" fill="#e5484d"/><circle cx="12" cy="12" r="1.4" fill="#fff"/><path d="M12 1.5v4M12 18.5v4M1.5 12h4M18.5 12h4" stroke="#9f2a2e" stroke-width="1.6" stroke-linecap="round"/>`,
  ),
  // Ferramentas de PDF: folha com dobra e tarja
  pdf: svg(
    `<path d="M5 3.5A1.5 1.5 0 0 1 6.5 2H14l5 5v13.5A1.5 1.5 0 0 1 17.5 22h-11A1.5 1.5 0 0 1 5 20.5z" fill="#f4f4f5"/><path d="M14 2l5 5h-3.5A1.5 1.5 0 0 1 14 5.5z" fill="#c9ccd1"/><rect x="2.5" y="11.5" width="14" height="7" rx="1.8" fill="#e5484d"/><path d="M5 17v-4h1.6a1.2 1.2 0 0 1 0 2.4H5M9 17v-4h1a2 2 0 0 1 0 4zM13.8 13H12.5v4" fill="none" stroke="#fff" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
  // Ação em lote: três camadas empilhadas
  camadas: svg(
    `<path d="M12 12.8 21.5 17.5 12 22.2 2.5 17.5z" fill="#6d3fd1"/><path d="M12 8.4 21.5 13.1 12 17.8 2.5 13.1z" fill="#8f67ea"/><path d="M12 2 21.5 6.7 12 11.4 2.5 6.7z" fill="#c4b0f7"/><path d="M12 4.9v3.7M10.2 6.8h3.6" stroke="#fff" stroke-width="1.5" stroke-linecap="round"/>`,
  ),
  // Documentos em lote: duas folhas e o sinal de mais
  documentos: svg(
    `<path d="M3.5 5.5A1.5 1.5 0 0 1 5 4h7l3.5 3.5V19A1.5 1.5 0 0 1 14 20.5H5A1.5 1.5 0 0 1 3.5 19z" fill="#2f9e5b"/><path d="M8.5 7.5A1.5 1.5 0 0 1 10 6h7l3.5 3.5V21A1.5 1.5 0 0 1 19 22.5h-9A1.5 1.5 0 0 1 8.5 21z" transform="translate(0 -1)" fill="#5fd38d"/><path d="M14.5 10.2v6.6M11.2 13.5h6.6" stroke="#fff" stroke-width="1.7" stroke-linecap="round"/>`,
  ),
  // Comparar documentos: duas folhas lado a lado com setas
  comparar: svg(
    `<rect x="2" y="4" width="10" height="16" rx="2" fill="#0e8fb0"/><rect x="12" y="4" width="10" height="16" rx="2" fill="#5fd0ea"/><path d="M5 9h4M5 12h4M5 15h4" stroke="#fff" stroke-width="1.4" stroke-linecap="round"/><path d="M15 9h4M15 12h4M15 15h2.5" stroke="#0e6f88" stroke-width="1.4" stroke-linecap="round"/>`,
  ),
  // Histórico de processos visitados: relógio com seta de retorno
  historico: svg(
    `<circle cx="12" cy="12" r="7.6" fill="#dbeafe"/><path d="M6.67 5.64A8.3 8.3 0 1 1 3.88 10.27" fill="none" stroke="#3b82f6" stroke-width="2.3" stroke-linecap="round"/><path d="M12 7.6v4.6l3.2 1.9" fill="none" stroke="#1d4ed8" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.96 7.6 5.45 4.18 7.89 7.1z" fill="#1d4ed8" stroke="#1d4ed8" stroke-width="0.8" stroke-linejoin="round"/>`,
  ),
  // Certidão: folha com selo
  certidao: svg(
    `<path d="M4.5 3.5A1.5 1.5 0 0 1 6 2h9l4.5 4.5V20A1.5 1.5 0 0 1 18 21.5H6A1.5 1.5 0 0 1 4.5 20z" fill="#f4f4f5"/><path d="M15 2l4.5 4.5H16.5A1.5 1.5 0 0 1 15 5z" fill="#c9ccd1"/><path d="M8 8.5h5M8 11.5h8" stroke="#9aa1ab" stroke-width="1.4" stroke-linecap="round"/><path d="m14.2 16.5-1 5 2.3-1.3 2.3 1.3-1-5z" fill="#1f8a4c"/><circle cx="15.5" cy="15" r="3.4" fill="#2fb464"/><path d="m14 15 1 1 2-2.2" fill="none" stroke="#fff" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"/>`,
  ),
};
