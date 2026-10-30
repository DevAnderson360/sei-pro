/** Evento disparado no documento do SEI para abrir a janela de Processos em Lote. */
export const EVENTO_ABRIR = "spro-processos-lote-abrir";
/** Atributo posto no <html> pelo content script, para o resto do SEI Pro saber que ele esta ativo. */
export const ATRIBUTO_ATIVO = "data-seipro-processos-lote";
/** Canal de mensagens entre a pagina do SEI e o iframe da janela. */
export const CANAL_PROCESSOS_LOTE = "seipro-processos-lote";

/** Maximo de processos por execucao (limite do legado). */
export const TETO = 2000;
/** Pausa entre processos, em ms: padrao e limites (porta de PROCLOTE_PAUSA_* do legado). */
export const PAUSA_PADRAO = 500;
export const PAUSA_MINIMA = 200;
export const PAUSA_MAXIMA = 10000;
/** Custo medio de uma criacao de processo, em ms, somado a pausa na estimativa de duracao. */
export const CUSTO_REQUISICAO_MS = 900;
/** O campo Especificacao do SEI aceita no maximo 100 caracteres. */
export const MAX_ESPECIFICACAO = 100;

/**
 * Chave em chrome.storage.local com a entrada que o Link Permanente le ao abrir (uso unico). E a MESMA string de
 * CHAVE_ENTRADA em link-permanente/src/modelo/constantes.ts, duplicada aqui para os pacotes nao se importarem:
 * mudou la, muda aqui.
 */
export const CHAVE_ENTRADA_LINK = "link-permanente/entrada";
/** Prazo do `criar` pela ponte: a aba pode fazer 2 POSTs (refaz o formulario uma vez) num SEI lento. */
export const PRAZO_CRIAR_MS = 60_000;
/**
 * Lote atualizado ha menos que isto pode estar rodando em outra aba: o maior intervalo entre duas escritas de uma
 * execucao viva e um `criar` no prazo maximo mais a pausa maxima.
 */
export const JANELA_OUTRA_ABA_MS = PRAZO_CRIAR_MS + PAUSA_MAXIMA;

/**
 * Aviso de um processo criado sem o interessado da linha (a coluna e lida mas ainda nao e aplicada). Fica aqui, e
 * nao so em sei/criar.ts, porque o app decide com ele se o registro do lote precisa ser guardado para conferir.
 */
export const AVISO_INTERESSADO = "interessado ignorado";
