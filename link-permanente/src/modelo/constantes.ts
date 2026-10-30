/** Evento que o content script ouve para abrir a janela do Link Permanente. */
export const EVENTO_ABRIR = "spro-link-permanente-abrir";
/** Marca o elemento da pagina que ja recebeu o botao (evita injetar duas vezes). */
export const ATRIBUTO_ATIVO = "data-seipro-link-permanente";
/** Canal de mensagens entre o content script e o app. */
export const CANAL_LINK_PERMANENTE = "seipro-link-permanente";
/** Chave em chrome.storage.local com os dados de entrada do app (uso unico). */
export const CHAVE_ENTRADA = "link-permanente/entrada";
