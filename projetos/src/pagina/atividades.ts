/**
 * A busca dos projetos do servidor do Atividades, do lado da aba (spec 6.3):
 * a MESMA requisição do painel legado (`getServerAtividades` no modo "panel",
 * ação "demandas", com `projetos={"vigentes":false}` para trazer também os
 * arquivados), com o endereço e a chave que o legado gravou no localStorage do
 * SEI (`configBasePro_atividades`). A chave só vai para esse endereço, como no
 * legado, e nunca com os cookies do SEI; nenhum endereço do SEI é montado aqui.
 * "Configurado" é a regra do contexto (`atividadesConfigurado`: a URL_API
 * preenchida, como a guarda do init.js); sem a chave (o login por host deixa
 * KEY_USER vazio), nada vai à rede. Se o servidor não responder, vale o que o
 * painel legado guardou (`configDataAtividadesPadraoPro_projetos`), mas só o do
 * MESMO usuário: o índice do legado (`configDataAtividadesPadraoPro`) tem de
 * listar "projetos" e o perfil guardado junto (`…_perfil.login`) tem de ser o
 * login do SEI; o login é obrigatório. Quando a chave é de outro usuário, nem o
 * guardado vale (também seria dele). A ação `view_projetos` do servidor está
 * quebrada (devolve só o último projeto) e não é usada.
 *
 * A resposta é de fora: tem teto de tamanho (lido aos pedaços, sem esperar o
 * fim), de tempo e de projetos (o resultado diz quantos ficaram de fora); a
 * mensagem de erro do servidor vira uma linha curta de texto; o redirecionamento
 * não é seguido (a chave não vai a outro endereço). Ao app só vão os campos que
 * a importação lê (`soOsCampos`: nada de com quem o projeto é compartilhado,
 * `config` ou apelidos); o que cada um traz é conferido do lado do app
 * (importacao/atividades.ts).
 */

import { soOsCampos } from "../importacao/camposLegado";
import { MAXIMO_PROJETOS_ATIVIDADES } from "../modelo/constantes";
import { atividadesConfigurado } from "./contexto";

export interface ConfigAtividades {
  url: string;
  /** Vazia no login por host (o legado ainda não tem a chave): sem ela, nada vai à rede. */
  chave: string;
  /** Unidade escolhida no painel legado (`optionsPro.perfilAtividadesSelected`). */
  perfil: string;
}

export interface ProjetosDoAtividades {
  fonte: "servidor" | "cache";
  projetos: unknown[];
  /** Por que veio do guardado (o servidor falhou), para o diálogo explicar. */
  aviso?: string;
  /** Quantos projetos passaram de `MAXIMO_PROJETOS_ATIVIDADES` e ficaram de fora (o diálogo avisa). */
  cortados?: number;
}

export interface OpcoesBusca {
  /** Login do SEI: a chave guardada tem de ser deste usuário (o painel legado confere igual). Obrigatório em `projetosDoAtividades`. */
  login?: string;
  /** Quanto esperar o servidor (padrão `LIMITE_ESPERA_MS`). */
  limiteMs?: number;
  /** Teto da resposta, em bytes (padrão `LIMITE_RESPOSTA`). */
  limiteBytes?: number;
}

/** A resposta do painel traz também as demandas da unidade: folga larga, mas com teto. */
export const LIMITE_RESPOSTA = 40 * 1024 * 1024;
export const LIMITE_ESPERA_MS = 60_000;
const MAX_MENSAGEM = 300;

export const MENSAGEM_SEM_SERVIDOR = "Não há servidor do Atividades configurado neste SEI.";
export const MENSAGEM_ENDERECO =
  "O endereço do servidor do Atividades guardado neste SEI não é válido. Abra o painel do Atividades para configurá-lo de novo.";
export const MENSAGEM_SEM_CHAVE =
  "Falta a chave de acesso ao servidor do Atividades. No painel do Atividades, use “Solicitar chave de acesso”.";

type Leitura = Pick<Storage, "getItem">;

/** Erro com uma mensagem nossa (as outras, de rede, viram uma frase genérica). */
class ErroAtividades extends Error {
  override name = "ErroAtividades";
}

/** A chave guardada é de outro usuário: nem o guardado pelo painel legado serve (também seria dele). */
class ErroOutroUsuario extends ErroAtividades {
  override name = "ErroOutroUsuario";
}

const objeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

function json(ls: Leitura, chave: string): unknown {
  try {
    return JSON.parse(ls.getItem(chave) ?? "null");
  } catch {
    return null;
  }
}

/** O endereço e a chave do legado: só se há servidor configurado (a regra do contexto) e o endereço é http(s). */
export function lerConfigAtividades(ls: Leitura): ConfigAtividades | null {
  if (!atividadesConfigurado(ls)) return null;
  const c = json(ls, "configBasePro_atividades");
  if (!objeto(c) || typeof c.URL_API !== "string") return null;
  let url: URL;
  try {
    url = new URL(c.URL_API);
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  const opcoes = json(ls, "optionsPro");
  const p = objeto(opcoes) ? opcoes.perfilAtividadesSelected : undefined;
  const perfil = typeof p === "string" ? p.slice(0, 100) : typeof p === "number" && Number.isFinite(p) ? String(p) : "";
  return { url: url.href, chave: typeof c.KEY_USER === "string" ? c.KEY_USER.trim() : "", perfil };
}

/** Até `MAXIMO_PROJETOS_ATIVIDADES`, só com os campos lidos, e quantos ficaram de fora. */
function cortados(lista: readonly unknown[]): { projetos: unknown[]; cortados: number } {
  return {
    projetos: soOsCampos(lista.slice(0, MAXIMO_PROJETOS_ATIVIDADES)),
    cortados: Math.max(0, lista.length - MAXIMO_PROJETOS_ATIVIDADES),
  };
}

/**
 * O que o painel legado guardou da última carga (pode estar velho): só quando o índice dele
 * (`configDataAtividadesPadraoPro`, a lista das partes guardadas) lista "projetos".
 */
function lerGuardado(ls: Leitura): unknown[] | null {
  const indice = json(ls, "configDataAtividadesPadraoPro");
  if (!Array.isArray(indice) || !indice.includes("projetos")) return null;
  const v = json(ls, "configDataAtividadesPadraoPro_projetos");
  return Array.isArray(v) ? v : null;
}

/** O guardado pelo painel legado (veja `lerGuardado`), até `MAXIMO_PROJETOS_ATIVIDADES` e só com os campos lidos. */
export function projetosDoCache(ls: Leitura): unknown[] | null {
  const v = lerGuardado(ls);
  return v ? cortados(v).projetos : null;
}

/** De quem é o guardado: o login do perfil que o painel legado guardou junto ("" se não diz). */
function donoDoGuardado(ls: Leitura): string {
  const perfil = json(ls, "configDataAtividadesPadraoPro_perfil");
  return objeto(perfil) && typeof perfil.login === "string" ? perfil.login : "";
}

/** Os campos que o legado manda (jQuery serializa `false` como "false"). */
export function corpoDaRequisicao(cfg: ConfigAtividades, versaoSeiPro: string): URLSearchParams {
  return new URLSearchParams({
    action: "demandas",
    status: "ativas",
    lista: "self",
    self: "",
    hash: cfg.chave,
    version: versaoSeiPro,
    perfil: cfg.perfil,
    last_update: "false",
    id_programa: "false",
    projetos: JSON.stringify({ vigentes: false }),
    prescricoes: "false",
  });
}

/** A mensagem do servidor como uma linha curta de texto (sem marcação). */
function mensagemDoServidor(x: unknown): string {
  if (typeof x !== "string") return "";
  const t = x
    .slice(0, MAX_MENSAGEM * 10)
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return t.slice(0, MAX_MENSAGEM).trim();
}

/** Como o painel legado compara logins (`loginsEquivalentesPro`): minúsculas, e o que não é letra ou dígito vira "_". */
function loginsEquivalentes(a: string, b: string): boolean {
  const n = (s: string) =>
    s
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "_");
  return n(a) !== "" && n(a) === n(b);
}

/** O corpo da resposta, lido aos pedaços até `limite` bytes (o tamanho declarado acima do teto nem é lido). */
async function textoComTeto(r: Response, limite: number): Promise<string> {
  const grande = `A resposta do servidor do Atividades passa de ${Math.round(limite / (1024 * 1024)) || 1} MB; nada foi lido.`;
  const declarado = Number(r.headers?.get("content-length") ?? "");
  if (Number.isFinite(declarado) && declarado > limite) throw new ErroAtividades(grande);
  const leitor = r.body?.getReader();
  if (!leitor) {
    const t = await r.text();
    if (t.length > limite) throw new ErroAtividades(grande);
    return t;
  }
  const pedacos: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await leitor.read();
    if (done) break;
    total += value.byteLength;
    if (total > limite) {
      leitor.cancel().catch(() => undefined);
      throw new ErroAtividades(grande);
    }
    pedacos.push(value);
  }
  const tudo = new Uint8Array(total);
  let i = 0;
  for (const p of pedacos) {
    tudo.set(p, i);
    i += p.byteLength;
  }
  return new TextDecoder().decode(tudo);
}

/**
 * POST no servidor do Atividades; devolve `padrao.projetos` (lista vazia sem a capacidade de ver projetos), até
 * `MAXIMO_PROJETOS_ATIVIDADES` e só com os campos lidos. Sem a chave, não vai à rede. Com `o.login`, a chave de
 * outro usuário é recusada.
 */
export async function buscarProjetosAtividades(
  cfg: ConfigAtividades,
  versaoSeiPro: string,
  buscar: typeof fetch,
  o: OpcoesBusca = {},
): Promise<unknown[]> {
  return (await buscarNoServidor(cfg, versaoSeiPro, buscar, o)).projetos;
}

async function buscarNoServidor(
  cfg: ConfigAtividades,
  versaoSeiPro: string,
  buscar: typeof fetch,
  o: OpcoesBusca,
): Promise<{ projetos: unknown[]; cortados: number }> {
  if (!cfg.chave) throw new ErroAtividades(MENSAGEM_SEM_CHAVE);
  const limiteMs = o.limiteMs ?? LIMITE_ESPERA_MS;
  const controle = new AbortController();
  const relogio = setTimeout(() => controle.abort(), limiteMs);
  let texto: string;
  try {
    const r = await buscar(cfg.url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" },
      body: corpoDaRequisicao(cfg, versaoSeiPro).toString(),
      // A chave vai no corpo; os cookies do SEI nunca vão a outro servidor.
      credentials: "omit",
      // Um redirecionamento levaria a chave (no corpo) a outro endereço: não segue.
      redirect: "error",
      signal: controle.signal,
    });
    if (!r.ok) throw new ErroAtividades(`O servidor do Atividades respondeu ${r.status}.`);
    texto = await textoComTeto(r, o.limiteBytes ?? LIMITE_RESPOSTA);
  } catch (e) {
    if (controle.signal.aborted)
      throw new ErroAtividades(`O servidor do Atividades não respondeu em ${Math.max(1, Math.round(limiteMs / 1000))} segundos.`);
    if (e instanceof ErroAtividades) throw e;
    throw new ErroAtividades("Não foi possível falar com o servidor do Atividades (fora do ar ou bloqueado pela rede).");
  } finally {
    clearTimeout(relogio);
  }
  let dados: unknown;
  try {
    dados = JSON.parse(texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto);
  } catch {
    dados = null;
  }
  if (!objeto(dados)) throw new ErroAtividades("O servidor do Atividades não devolveu dados válidos.");
  if (dados.status === 0 || dados.status === "0")
    throw new ErroAtividades(mensagemDoServidor(dados.status_txt) || "O servidor do Atividades recusou o acesso.");
  const padrao = objeto(dados.padrao) ? dados.padrao : {};
  // Como o painel legado: com o perfil na resposta, o login dele tem de ser o do SEI (sem login, também recusa).
  if (o.login !== undefined && objeto(padrao.perfil)) {
    const doServidor = typeof padrao.perfil.login === "string" ? padrao.perfil.login : "";
    if (!loginsEquivalentes(doServidor, o.login)) {
      const dele = mensagemDoServidor(doServidor).slice(0, 60);
      throw new ErroOutroUsuario(
        `A chave do servidor do Atividades guardada neste navegador é de outro usuário${dele ? ` (${dele})` : ""}. No painel do Atividades, peça a sua chave de acesso.`,
      );
    }
  }
  return cortados(Array.isArray(padrao.projetos) ? padrao.projetos : []);
}

/**
 * O servidor; se falhar, o guardado pelo painel legado, só se é do mesmo usuário (o perfil guardado junto diz o
 * login; sem isso, ou de outro login, recusa: o guardado não contorna a conferência da chave); sem nenhum dos dois,
 * o erro do servidor. O login do SEI é obrigatório.
 */
export async function projetosDoAtividades(
  ls: Leitura,
  versaoSeiPro: string,
  buscar: typeof fetch,
  o: OpcoesBusca & { login: string },
): Promise<ProjetosDoAtividades> {
  if (!atividadesConfigurado(ls)) throw new ErroAtividades(MENSAGEM_SEM_SERVIDOR);
  try {
    const cfg = lerConfigAtividades(ls);
    if (!cfg) throw new ErroAtividades(MENSAGEM_ENDERECO);
    const r = await buscarNoServidor(cfg, versaoSeiPro, buscar, o);
    return { fonte: "servidor", projetos: r.projetos, ...(r.cortados ? { cortados: r.cortados } : {}) };
  } catch (e) {
    if (e instanceof ErroOutroUsuario) throw e;
    const guardados = lerGuardado(ls);
    if (!guardados) throw e;
    const motivo = e instanceof Error ? e.message : String(e);
    const dono = donoDoGuardado(ls);
    if (!dono)
      throw new ErroOutroUsuario(`${motivo} A lista guardada neste navegador pelo painel do Atividades não diz de quem é e não foi usada.`);
    if (!loginsEquivalentes(dono, o.login))
      throw new ErroOutroUsuario(
        `${motivo} A lista guardada neste navegador pelo painel do Atividades é de outro usuário e não foi usada.`,
      );
    const c = cortados(guardados);
    return { fonte: "cache", projetos: c.projetos, aviso: motivo, ...(c.cortados ? { cortados: c.cortados } : {}) };
  }
}

/**
 * O pedido `importarAtividades` da aba (P4), com o login do SEI desta tela: a chave guardada (e o guardado pelo
 * painel legado) de outro usuário é recusada. null sem servidor configurado (o executor responde
 * `SEM_ATIVIDADES`).
 */
export function atividadesDaAba(
  ctx: { login: string; atividades: boolean },
  ls: Leitura,
  versaoSeiPro: string,
  buscar: typeof fetch,
): (() => Promise<ProjetosDoAtividades>) | null {
  return ctx.atividades ? () => projetosDoAtividades(ls, versaoSeiPro, buscar, { login: ctx.login }) : null;
}
