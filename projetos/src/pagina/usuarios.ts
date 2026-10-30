/**
 * Usuários sugeridos para o "Responsável" (spec 7), sem nenhuma requisição ao SEI.
 *
 * A lista é PARCIAL: quem aparece com processo atribuído na caixa que está na
 * tela, os responsáveis já usados nas etapas da unidade e o próprio usuário (o
 * diálogo ainda aceita texto livre). A única lista completa conhecida, a do
 * formulário de atribuição, só se alcança abrindo a árvore de um processo, e a
 * montagem da árvore no SEI chama `ProcedimentoRN::receber`, que pode gravar
 * "Processo recebido" em nome do usuário sem ele ver. Por isso, no P3, a fonte
 * completa é `null` (decisão do controlador da T12). O encaixe continua aqui
 * (`buscarCompleta`, com cache de 1 dia) para uma fonte segura que a P6
 * confirmar ao vivo.
 *
 * O que fica guardado em `projetos/usuarios/<host>|u:<id>` é só o que a unidade
 * mostrou (a caixa, ou a lista completa): a chave é da unidade, não do login,
 * então nem o próprio usuário nem os responsáveis dos projetos "Só eu" entram.
 */

import type { Area } from "@comum/armazenamento/area";
import { normalizarTexto } from "@comum/texto";
import { LIMITES } from "../modelo/constantes";
import type { Etapa } from "../modelo/tipos";
import type { UsuarioDaUnidade } from "../ponte/tipos";

const DIA = 86_400_000;
/** Teto do que se guarda e do que se lê do cache (unidade grande, cache adulterado). */
const MAXIMO = 2000;

function usuario(login: unknown, nome: unknown): UsuarioDaUnidade | null {
  const n = typeof nome === "string" ? nome.trim().slice(0, LIMITES.nome) : "";
  if (!n) return null;
  const l = typeof login === "string" ? login.trim().toLowerCase().slice(0, LIMITES.nome) : "";
  return l ? { login: l, nome: n } : { nome: n };
}

/** Quem tem processo atribuído na página da caixa (`a.ancoraSigla` com "Atribuído para <nome>"). */
export function usuariosDaCaixa(doc: Document): UsuarioDaUnidade[] {
  const saida: UsuarioDaUnidade[] = [];
  for (const a of doc.querySelectorAll("a[href*='procedimento_atribuicao_listar']")) {
    const login = (a.textContent ?? "").trim();
    const nome = (a.getAttribute("title") ?? "").replace(/^Atribu\S*\s+para\s+/i, "");
    const u = login ? usuario(login, nome) : null;
    if (u?.login) saida.push(u);
  }
  return saida;
}

/** Responsáveis das etapas (dos dois escopos da unidade, ativos e arquivados). */
export function responsaveisUsados(projetos: ReadonlyArray<{ etapas: ReadonlyArray<Pick<Etapa, "responsavel">> }>): UsuarioDaUnidade[] {
  return projetos.flatMap((p) => p.etapas.flatMap((e) => (e.responsavel ? [e.responsavel] : [])));
}

/**
 * Sem repetir: mesmo login é a mesma pessoa; sem login, o mesmo nome (sem
 * acento e sem caixa) de alguém já listado também (o texto livre de antes não
 * duplica quem a caixa mostra com login).
 */
function semRepetir(lista: readonly UsuarioDaUnidade[]): UsuarioDaUnidade[] {
  const limpos = lista.flatMap((u) => usuario(u.login, u.nome) ?? []);
  const logins = new Set<string>();
  const nomes = new Set<string>();
  const saida: UsuarioDaUnidade[] = [];
  for (const u of limpos.filter((x) => x.login)) {
    if (logins.has(u.login!)) continue;
    logins.add(u.login!);
    nomes.add(normalizarTexto(u.nome));
    saida.push(u);
  }
  for (const u of limpos.filter((x) => !x.login)) {
    const k = normalizarTexto(u.nome);
    if (nomes.has(k)) continue;
    nomes.add(k);
    saida.push(u);
  }
  return saida;
}

/** O usuário atual primeiro, os outros pelo nome. */
function comEuPrimeiro(eu: UsuarioDaUnidade, outros: readonly UsuarioDaUnidade[]): UsuarioDaUnidade[] {
  const todos = semRepetir([eu, ...outros]);
  const limpo = usuario(eu.login, eu.nome);
  const i = limpo
    ? todos.findIndex((u) => (limpo.login ? u.login === limpo.login : normalizarTexto(u.nome) === normalizarTexto(limpo.nome)))
    : -1;
  const primeiro = i >= 0 ? todos.splice(i, 1) : [];
  return [...primeiro, ...todos.sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"))];
}

const doCache = (x: unknown): UsuarioDaUnidade[] =>
  Array.isArray(x)
    ? x.slice(0, MAXIMO).flatMap((u) => {
        if (!u || typeof u !== "object") return [];
        return usuario((u as { login?: unknown }).login, (u as { nome?: unknown }).nome) ?? [];
      })
    : [];

/** Lista completa dos usuários da unidade; null quando a fonte não tem o que dar. */
export type FonteCompleta = () => Promise<UsuarioDaUnidade[] | null>;

export interface DepsUsuarios {
  area: Area;
  /** `chaveUsuarios(host, idUnidade)`. */
  chave: string;
  agora: number;
  /** Atribuições que a caixa na tela mostra (`usuariosDaCaixa`). */
  daCaixa: readonly UsuarioDaUnidade[];
  /** Responsáveis já usados nos projetos da unidade (`responsaveisUsados`); não vão para o cache. */
  usados: readonly UsuarioDaUnidade[];
  eu: UsuarioDaUnidade;
  /** null no P3: nenhuma fonte completa é segura (ver o comentário do arquivo). */
  buscarCompleta: FonteCompleta | null;
}

export async function usuariosDaUnidade(d: DepsUsuarios): Promise<UsuarioDaUnidade[]> {
  const salvo = (await d.area.obter(d.chave))[d.chave] as { quando?: unknown; completa?: unknown; lista?: unknown } | undefined;
  const idade = salvo && typeof salvo.quando === "number" ? d.agora - salvo.quando : Number.NaN;
  const valido = idade >= 0 && idade < DIA;
  const guardada = doCache(salvo?.lista);
  if (valido && salvo?.completa === true) return comEuPrimeiro(d.eu, [...guardada, ...d.daCaixa, ...d.usados]);
  // Lista completa vencida ainda serve se a busca nova falhar; a parcial vencida sai (quem saiu da unidade some).
  let base = valido || salvo?.completa === true ? guardada : [];
  let completa = false;
  if (d.buscarCompleta) {
    try {
      const nova = await d.buscarCompleta();
      if (nova?.length) {
        base = nova;
        completa = true;
      }
    } catch {
      /* sem acesso ou sem fonte: fica o que havia */
    }
  }
  const vistos = semRepetir([...base, ...d.daCaixa]).slice(0, MAXIMO);
  // A parcial vale 1 dia desde que começou a juntar (não se renova a cada abertura).
  const quando = !completa && valido && typeof salvo?.quando === "number" ? salvo.quando : d.agora;
  await d.area.gravar({ [d.chave]: { quando, completa, lista: vistos } });
  return comEuPrimeiro(d.eu, [...vistos, ...d.usados]);
}
