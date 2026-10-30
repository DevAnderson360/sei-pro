/**
 * O que atravessa a ponte entre a aba do SEI (content script) e o app do
 * painel (página da extensão). Sem DOM e sem `@nucleo`: o app importa daqui
 * sem puxar o núcleo do SEI para o pacote dele.
 */

/** Nome da porta `chrome.runtime.connect` do painel embutido. */
export const CANAL_PROJETOS = "seipro-projetos";

/** Porta do painel lateral: a aba do SEI conecta quando o lateral anuncia que abriu (`projetos/lateralAberto`). */
export const CANAL_LATERAL = "seipro-projetos-lateral";

export interface ContextoProjetos {
  host: string;
  /** Em minúsculas. */
  login: string;
  /** Nome do usuário lido do SEI (vai para o histórico de alterações). */
  nome: string;
  unidade: { id: string; sigla: string; nome: string } | null;
  versao: string;
  /** Modo noturno do SEI Pro (o painel embutido segue o SEI). */
  temaEscuro: boolean;
  /** Cor da barra do SEI (destaque do painel). */
  corTema?: string;
  /** Há servidor do Atividades configurado (o legado convive; a importação é do P4). */
  atividades: boolean;
}

/** Processo da caixa já carregada (combo do diálogo; nenhuma requisição). */
export interface ProcessoDaCaixa {
  protocolo: string;
  idProcedimento: string;
  tipo?: string;
  /** Vazio para processo sigiloso (regra do núcleo). */
  especificacao?: string;
  sigiloso: boolean;
}

/** Responsável sugerido (usuários da unidade). */
export interface UsuarioDaUnidade {
  login?: string;
  nome: string;
}

/** Conferência de um número SEI pela pesquisa rápida (sem abrir a árvore). */
export interface DocumentoConferido {
  numero: string;
  /** Protocolo do processo onde o documento está. */
  protocolo?: string;
}

/** Pílula de alerta do título do painel. */
export type TipoAlerta = "atrasadas" | "semana";

/**
 * Chave de roteamento da aba no painel lateral (spec 7): host|login|u:<id da unidade>. Trocar de
 * unidade (ou de usuário, ou de SEI) troca a chave, e o lateral remonta com os projetos da unidade
 * nova (nunca grava na antiga). Sem unidade, vazia: o lateral não monta.
 */
export function chaveDaAba(ctx: Pick<ContextoProjetos, "host" | "login" | "unidade">): string {
  return ctx.unidade ? `${ctx.host}|${ctx.login.trim().toLowerCase()}|u:${ctx.unidade.id}` : "";
}

/**
 * "Abrir no painel" pedido de uma tela que não é a do painel: a árvore abre o lateral (alvo
 * "lateral"); o lateral leva a aba ao Controle de Processos (alvo "painel"). O pedido fica no
 * `chrome.storage.local` por pouco tempo e vale só para a mesma chave da aba (mesmo SEI, usuário e
 * unidade).
 */
export const CHAVE_FOCO = "projetos/foco";
/** O pedido vale 1 minuto a partir de quando foi feito (`ate` = quando + isto). */
export const VALIDADE_FOCO = 60_000;

export interface PedidoDeFoco {
  alvo: "lateral" | "painel";
  chave: string;
  projeto: string;
  etapa?: string;
  /** Até quando vale (ms). */
  ate: number;
}

const textoCurto = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 200;

/**
 * O pedido guardado, se é para este alvo e esta chave e ainda vale; senão null. O valor vem do storage (qualquer
 * página da extensão ou content script grava ali): a forma é conferida campo a campo e só os campos conhecidos
 * saem daqui. Prazo além de 1 minuto à frente (relógio torto ou valor forjado) não vale: o pedido não pode ficar
 * esperando para sempre.
 */
export function lerPedidoDeFoco(v: unknown, alvo: PedidoDeFoco["alvo"], chave: string, agora: number): PedidoDeFoco | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const p = v as Partial<Record<keyof PedidoDeFoco, unknown>>;
  if (p.alvo !== alvo || !chave || p.chave !== chave || !textoCurto(p.projeto)) return null;
  if (typeof p.ate !== "number" || !Number.isFinite(p.ate) || p.ate < agora || p.ate > agora + VALIDADE_FOCO) return null;
  const saida: PedidoDeFoco = { alvo, chave, projeto: p.projeto, ate: p.ate };
  if (textoCurto(p.etapa)) saida.etapa = p.etapa;
  return saida;
}

/**
 * O valor guardado é um pedido deste alvo e desta chave (valendo ou não): quem o lê e não o atende (vencido, torto)
 * o apaga, porque ninguém mais o atenderia. O de outra chave fica: é de outra aba.
 */
export function pedidoDaChave(v: unknown, alvo: PedidoDeFoco["alvo"], chave: string): boolean {
  if (!v || typeof v !== "object" || Array.isArray(v)) return false;
  const p = v as { alvo?: unknown; chave?: unknown };
  return !!chave && p.alvo === alvo && p.chave === chave;
}
