/** Evento disparado no documento do SEI para abrir a janela de Documentos em Lote. */
export const EVENTO_ABRIR = "spro-documentos-lote-abrir";
/** Atributo posto no <html> pelo content script, para o resto do SEI Pro saber que ele está ativo. */
export const ATRIBUTO_ATIVO = "data-seipro-documentos-lote";
/** Canal de mensagens entre a página do SEI e o iframe da janela. */
export const CANAL_DOCUMENTOS_LOTE = "seipro-documentos-lote";

/** Máximo de linhas por execução (limite do legado). */
export const TETO = 2000;
/** Pausa entre documentos, em ms: padrão e limites. */
export const PAUSA_PADRAO = 500;
export const PAUSA_MINIMA = 200;
export const PAUSA_MAXIMA = 10000;

/** Prefixo das chaves em chrome.storage.local (uma por entidade, sem sincronizar). */
export const PREFIXO_CHAVE = "docslote/";
/** Um lote guardado expira em 7 dias. */
export const VALIDADE_LOTE_MS = 7 * 24 * 3600 * 1000;

/** A descrição do documento aceita no máximo 250 caracteres. */
export const MAX_DESCRICAO = 250;
/** A especificação do processo novo aceita no máximo 100 caracteres (como no Processos em Lote). */
export const MAX_ESPECIFICACAO = 100;
/** O nome na árvore aceita no máximo 50 caracteres (sem acento). */
export const MAX_NOME_ARVORE = 50;

/** Prazo do `criar` pela ponte: a aba pode fazer 2 POSTs (refaz o formulário uma vez) num SEI lento. */
export const PRAZO_CRIAR_MS = 60_000;
/**
 * Lote atualizado há menos que isto pode estar rodando em outra aba: o maior intervalo entre duas escritas de uma
 * execução viva é um `criar` no prazo máximo mais a pausa máxima.
 */
export const JANELA_OUTRA_ABA_MS = PRAZO_CRIAR_MS + PAUSA_MAXIMA;

/** Custo aproximado de uma requisição ao SEI, em ms, para a estimativa de duração (criar um documento = 2 a 3). */
export const CUSTO_DOCUMENTO_MS = 1500;
/** Custo a mais de criar um processo novo antes do documento. */
export const CUSTO_PROCESSO_MS = 900;

/** O texto do modelo guardado para a prévia (só a tela o usa) vai até este tamanho. */
export const MAX_TEXTO_PREVIA = 20_000;

/**
 * Chave em chrome.storage.local com a entrada que o Link Permanente lê ao abrir (uso único). É a MESMA string de
 * CHAVE_ENTRADA em link-permanente/src/modelo/constantes.ts (e de CHAVE_ENTRADA_LINK no processos-lote), duplicada
 * aqui para os pacotes não se importarem: mudou lá, muda aqui (a prova compara as duas).
 */
export const CHAVE_ENTRADA_LINK = "link-permanente/entrada";

/**
 * Teto do lote guardado, em bytes (o JSON gravado): a cota do `chrome.storage.local` é dividida com os outros módulos
 * do SEI Pro, e cada `marcar` regrava o lote inteiro. Acima disso o lote não começa (nada vai ao SEI).
 */
export const TETO_BYTES_LOTE = 2 * 1024 * 1024;
