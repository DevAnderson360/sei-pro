/** Limites da spec 5.4 e chaves de armazenamento da spec 5.1. */

export const LIMITES = {
  nome: 200,
  checklistItens: 50,
  checklistTexto: 200,
  etiquetas: 10,
  etiquetaTexto: 40,
  observacoes: 2000,
  projetosAtivos: 100,
  etapasPorProjeto: 300,
  historico: 300,
  modelos: 50,
  /** Cada lado (`antes`/`depois`) de um registro do histórico; o das dependências (os nomes juntos) nasce cortado. */
  registroValor: 400,
  /**
   * Login e nome de quem gravou (no SEI, até 100), o campo do registro, o `alteradoPor`, o login do responsável e o
   * id do dispositivo (um UUID).
   */
  rotulo: 100,
  /** A chave da ordem manual (índice fracionário): cresce um caractere a cada umas seis inserções no mesmo vão. */
  ordem: 1000,
} as const;

/** Registro do histórico com `quando` antes disto (2000-01-01) vem de um relógio quebrado ou é forjado: recusado. */
export const QUANDO_MINIMO = Date.UTC(2000, 0, 1);

/**
 * Relógio de outro computador adiantado que a mesclagem ainda aceita (1 dia). Carimbo além disso é
 * recusado: venceria toda edição até o relógio daqui alcançá-lo, e a lápide nunca seria limpa.
 */
export const FOLGA_RELOGIO_MS = 86_400_000;

/** Lápides: a unidade tem usuários eventuais, que não podem ressuscitar exclusões (spec 6.1). */
export const DIAS_LAPIDE_UNIDADE = 180;
export const DIAS_LAPIDE_EU = 90;
/** O prazo das lápides do escopo (a poda do texto e a do `limpar`). */
export const diasDeLapide = (vis: "unidade" | "eu"): number => (vis === "unidade" ? DIAS_LAPIDE_UNIDADE : DIAS_LAPIDE_EU);

/**
 * Projetos lidos do servidor do Atividades (ou do guardado pelo painel antigo) numa importação: dado de fora,
 * com teto antes de qualquer outra conta (nenhuma unidade do legado chega perto).
 */
export const MAXIMO_PROJETOS_ATIVIDADES = 1000;

/** Etapa nova pela última linha da lista: duração em dias úteis (spec 3.1). */
export const DIAS_ETAPA_NOVA = 5;

/** Valor do filtro de fase para as etapas sem fase (nenhum id real começa com "__"). */
export const SEM_FASE = "__sem__";

export const PREFIXO = "projetos/";
export const CHAVE_PREFERENCIAS = "projetos/preferencias";
/**
 * O contador da aba "Projetos" do painel lateral (etapas atrasadas da unidade) e o teto do selo: o contrato mora no
 * `sei-comum` (`painel/contadores.ts`), que o shell dos Favoritos também lê.
 */
export { CHAVE_CONTADOR_PROJETOS as CHAVE_CONTADOR_PAINEL, TETO_CONTADOR_PROJETOS as TETO_CONTADOR_PAINEL } from "@comum/painel/contadores";
export const CHAVE_LATERAL = "projetos/lateralAberto";
export const chaveSyncTexto = (chaveDoEscopo: string): string => `projetos/sync/tp/${chaveDoEscopo}`;
export const chaveSyncArquivo = (host: string, login: string): string => `projetos/sync/arquivo/${host}|${login.trim().toLowerCase()}`;
export const chaveUsuarios = (host: string, idUnidade: string): string => `projetos/usuarios/${host}|u:${idUnidade}`;
export const chaveImportacao = (host: string, login: string): string => `projetos/importacao/${host}|${login.trim().toLowerCase()}`;
/**
 * Memória local do sigilo do usuário (modelo/memoriaSigilo.ts), para todos os escopos dele: uma chave por
 * número, `projetos/sigilo/<host>|<login>/p/<chave do processo>` e `.../d/<número do documento>`, com a
 * origem no valor. Fora de todo escopo (`baseDoEscopo`): nem a exportação, nem o arquivo, nem a sincronia
 * a leem como dado.
 */
export const prefixoMemoriaSigilo = (host: string, login: string): string => `projetos/sigilo/${host}|${login.trim().toLowerCase()}/`;
