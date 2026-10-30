/** Canal de mensagens entre a pagina do SEI e o iframe da janela. */
export const CANAL_ACOES_LOTE = "spro-acoes-lote";
/** Evento disparado no documento do SEI para abrir a janela de Acoes em Lote (o legado `getDocumentosActions` o dispara). */
export const EVENTO_ABRIR = "spro-acoes-lote-abrir";
/** Atributo posto no <html> pelo content script, para o legado saber que o pacote novo esta ativo. */
export const ATRIBUTO_ATIVO = "data-seipro-acoes-lote";
/** Prefixo das chaves em chrome.storage.local: uma chave por entidade. */
export const PREFIXO_STORAGE = "acoes-lote/";
