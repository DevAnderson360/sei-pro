/**
 * Tudo o que o usuário tem num SEI (todas as unidades, "Toda a unidade" e "Só
 * eu", inclusive o número dos sigilosos: é dele), num envelope só (spec 6.2):
 * a cópia diária deste navegador, o arquivo numa pasta da nuvem e o
 * Exportar/Importar manual. Ler sempre MESCLA (vence o mais recente por
 * entidade); o que o arquivo tem de outro SEI ou de outro login fica.
 *
 * Restaurar uma cópia RECUPERA o que sumiu depois dela (o item ausente aqui ou
 * com lápide); não volta no tempo: o que está vivo aqui fica como está, mesmo
 * que difira da cópia (a edição de um colega na unidade não é desfeita). O que
 * mudou de "Quem vê" depois da cópia está vivo no outro escopo da unidade: não
 * volta ao de antes (nenhum id fica vivo nos dois).
 *
 * O arquivo é do próprio usuário: leva também a memória do sigilo dele
 * (`@projetos/modelo/memoriaSigilo`), no campo `sigilo` do envelope (a entrada dele, por
 * host|login, com versão própria). Num perfil novo (outro navegador, a extensão
 * reinstalada), importar ou restaurar a devolve sem tirar nem mudar o que já
 * estava lá: um número que só sobrou nos registros do histórico (o processo
 * trocado, a lápide podada) continua fora do Texto Padrão. Só UMA entrada é
 * aceita, a do dono, e só as primeiras `LIMITE_LOCAIS_ARQUIVO` (5000) novas
 * entram como "local"; o resto entra como "aprendida", sob o teto dela. Sem o
 * campo (arquivo de antes), a importação segue; entrada torta é ignorada; a
 * memória que não lê ou não grava faz a importação e a exportação falharem
 * (falha fechada, como no Texto Padrão).
 *
 * A mecânica do arquivo (File System Access, handle no IndexedDB do módulo,
 * permissão, regravação do ilegível) e a das cópias são as genéricas do
 * sei-comum, no banco `seipro-demandas`; aqui fica o envelope.
 */

import type { Area } from "@comum/armazenamento/area";
import { obterPorPrefixo } from "@comum/armazenamento/colecao";
import type { DataISO } from "@comum/datas/dias";
import { type AdaptadorArquivo, ControleArquivo, escolherArquivoSync, handlesNoIndexedDB } from "@comum/sincronia/arquivo";
import { assinaturaEstavel } from "@comum/sincronia/assinatura";
import {
  type ArmazemCopias,
  type Copia,
  copiasNoIndexedDB,
  type Dono,
  fazerCopiaDoDia as fazerCopiaComum,
  recarimbarAtivos,
} from "@comum/sincronia/copias";
import type { Versionada } from "@comum/sincronia/entidade";
import { prefixoMemoriaSigilo } from "@projetos/modelo/constantes";
import { comEntradas, ErroMemoriaSigilo, entradasParaGravar, lerMemoria, type MemoriaSigilo } from "@projetos/modelo/memoriaSigilo";
import { AVISO_ARQUIVO, chaveSyncArquivo, TETOS_ENVELOPE } from "../modelo/constantes";
import { chaveEscopo } from "../modelo/escopo";
import type { Carimbo, Entidades, Escopo } from "../modelo/tipos";
import { ErroValidacao } from "../modelo/validacao";
import { RepositorioDemandas, type ResultadoImportacao } from "../repositorio";

export const FORMATO_ARQUIVO = "seipro-demandas";
export const VERSAO_ARQUIVO = 1;
/** IndexedDB da extensão: depósitos `copias` e `arquivos` (sei-comum/sincronia/banco.ts). */
export const BANCO = "seipro-demandas";
/** Versão da entrada do campo `sigilo`: a forma da memória pode mudar sem mudar a do envelope. */
export const VERSAO_SIGILO = 1;
/**
 * Números por conjunto (processos, documentos) numa entrada do campo `sigilo`; acima disso a entrada é tratada
 * como torta. Fica acima do que a memória de verdade consegue guardar (uma chave por número no storage.local, de
 * 10 MB: umas 150 mil no total), para a entrada do próprio usuário nunca ser lida como torta (o arquivo seria
 * regravado a cada rodada); só um arquivo forjado passa dele.
 */
export const TETO_SIGILO_ARQUIVO = 200_000;
/** Entradas (usuários) no campo `sigilo`; acima disso o campo é tratado como torto. */
const TETO_DONOS_SIGILO = 100;
/**
 * Números NOVOS que uma importação ou restauração grava como "local" (sem teto); os que passam disso entram como
 * "aprendida", sob o teto de 20000. Um arquivo forjado não enche a memória sem limite.
 */
export const LIMITE_LOCAIS_ARQUIVO = 5000;

export interface EscopoNoArquivo {
  escopo: Escopo;
  entidades: Entidades;
}

/**
 * A memória do sigilo de um usuário no arquivo: as chaves de processo e de documento que a memória dele conhece
 * (as duas origens; a volta é sempre "local"). Nunca vai ao Texto Padrão.
 */
export interface SigiloNoArquivo {
  versao: typeof VERSAO_SIGILO;
  host: string;
  login: string;
  processos: string[];
  documentos: string[];
}

export interface EnvelopeArquivo {
  formato: typeof FORMATO_ARQUIVO;
  versao: typeof VERSAO_ARQUIVO;
  /** Distingue do envelope do Texto Padrão (um escopo) e do arquivo morto. */
  tipo: "copia";
  gerado: number;
  escopos: EscopoNoArquivo[];
  /** A memória do sigilo de cada usuário cujas demandas estão no arquivo. Ausente nos arquivos de antes. */
  sigilo?: SigiloNoArquivo[];
}

export type CopiaDemandas = Copia<EnvelopeArquivo>;
export type ArmazemCopiasDemandas = ArmazemCopias<EnvelopeArquivo>;

const LISTAS = ["d", "h"] as const;
/** O arquivo guarda as ativas e as arquivadas juntas (`a` do texto), por isso o teto da lista `d` é o da `a`. */
const TETOS_LISTA: Record<(typeof LISTAS)[number], number> = { d: TETOS_ENVELOPE.a, h: TETOS_ENVELOPE.h };

/** O aviso de tamanho do arquivo local (5 MB). */
export const AVISO_ARQUIVO_BYTES = AVISO_ARQUIVO;
export const tamanhoDoArquivoAlto = (bytes: number): boolean => bytes >= AVISO_ARQUIVO_BYTES;
const mesmoDono = (x: { host: string; login: string }, d: Dono) =>
  x.host === d.host && x.login.trim().toLowerCase() === d.login.trim().toLowerCase();

export const chaveStatusArquivo = (d: Dono): string => chaveSyncArquivo(d.host, d.login);
export const nomeDoArquivo = (d: Dono): string => `demandas-seipro-${d.login.trim().toLowerCase()}-${d.host}.json`;

const texto = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 300;
/** A unidade entra no nome das chaves (`…|u:<unidade>/un/…`): com barra, os itens cairiam noutro escopo. */
const unidadeValida = (x: unknown): x is string => texto(x) && !x.includes("/");

/** Os escopos que este usuário tem neste SEI (pelas chaves guardadas: `demandas/<host>|<login>|u:<id>/<un|eu>/…`). */
export async function escoposDoUsuario(area: Area, d: Dono): Promise<Escopo[]> {
  const login = d.login.trim().toLowerCase();
  const prefixo = `demandas/${d.host}|${login}|u:`;
  // Só os nomes das chaves (sem os valores), quando o navegador oferece.
  const chaves = area.chaves ? await area.chaves() : Object.keys(await area.obter(null));
  const achados = new Map<string, Escopo>();
  for (const k of chaves) {
    if (!k.startsWith(prefixo)) continue;
    const [unidade, vis] = k.slice(prefixo.length).split("/");
    if (!unidadeValida(unidade) || (vis !== "un" && vis !== "eu")) continue;
    const e: Escopo = { host: d.host, login, unidade, vis: vis === "un" ? "unidade" : "eu" };
    achados.set(chaveEscopo(e), e);
  }
  return [...achados.values()].sort((a, b) => (chaveEscopo(a) < chaveEscopo(b) ? -1 : 1));
}

const repoDe = (area: Area, e: Escopo, carimbo: () => Carimbo) => new RepositorioDemandas(area, e, carimbo);

/** Um número que cabe na memória do sigilo (a mesma regra de memoriaSigilo.ts: texto de 1 a 64 caracteres). */
const numeroDaMemoria = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 64;

/**
 * A memória do sigilo do usuário (de todos os escopos dele), numa leitura. O erro do storage vira
 * `ErroMemoriaSigilo` (falha fechada: quem lê não grava nada).
 */
async function memoriaDoDono(area: Area, d: Dono): Promise<MemoriaSigilo> {
  const prefixo = prefixoMemoriaSigilo(d.host, d.login);
  let itens: Record<string, unknown>;
  try {
    itens = await obterPorPrefixo(area, prefixo);
  } catch (e) {
    throw new ErroMemoriaSigilo(e);
  }
  return lerMemoria(itens, prefixo);
}

/**
 * A entrada do campo `sigilo` deste usuário: tudo o que a memória dele conhece, em ordem, só com os números que a
 * leitura aceita (uma chave do storage editada à mão não faz a entrada inteira ser lida como torta).
 */
function sigiloDoDono(d: Dono, m: MemoriaSigilo): SigiloNoArquivo {
  return {
    versao: VERSAO_SIGILO,
    host: d.host,
    login: d.login.trim().toLowerCase(),
    processos: [...m.processos.keys()].filter(numeroDaMemoria).sort(),
    documentos: [...m.documentos.keys()].filter(numeroDaMemoria).sort(),
  };
}

/**
 * Tudo deste usuário neste SEI, com lápides e números sigilosos, e a memória do sigilo dele. A memória é lida
 * primeiro: ilegível, lança e nada é exportado (o arquivo e a cópia ficam com a memória que já tinham).
 */
export async function exportarTudo(area: Area, d: Dono, carimbo: () => Carimbo): Promise<EnvelopeArquivo> {
  const memoria = await memoriaDoDono(area, d);
  const escopos: EscopoNoArquivo[] = [];
  for (const e of await escoposDoUsuario(area, d)) escopos.push({ escopo: e, entidades: await repoDe(area, e, carimbo).entidades() });
  return {
    formato: FORMATO_ARQUIVO,
    versao: VERSAO_ARQUIVO,
    tipo: "copia",
    gerado: carimbo().agora,
    escopos,
    sigilo: [sigiloDoDono(d, memoria)],
  };
}

const listaDeNumeros = (x: unknown): x is string[] => Array.isArray(x) && x.length <= TETO_SIGILO_ARQUIVO && x.every(numeroDaMemoria);

/**
 * As entradas boas do campo `sigilo`: a torta, a de outra versão e a acima do teto ficam de fora, sem derrubar o
 * resto. Campo ausente ou que não é lista: `undefined` (nenhuma entrada).
 */
function lerSigilo(bruto: unknown): SigiloNoArquivo[] | undefined {
  if (!Array.isArray(bruto) || bruto.length > TETO_DONOS_SIGILO) return undefined;
  const saida: SigiloNoArquivo[] = [];
  for (const x of bruto as unknown[]) {
    const s = x as Partial<Record<keyof SigiloNoArquivo, unknown>> | null;
    if (!s || typeof s !== "object" || s.versao !== VERSAO_SIGILO || !texto(s.host) || !texto(s.login)) continue;
    if (!listaDeNumeros(s.processos) || !listaDeNumeros(s.documentos)) continue;
    saida.push({ versao: VERSAO_SIGILO, host: s.host, login: s.login, processos: [...s.processos], documentos: [...s.documentos] });
  }
  return saida;
}

/**
 * O envelope do JSON lido (forma e tetos), ou null se não é uma cópia de demandas. A forma de cada item é do
 * `importar` (o item torto é ignorado e contado); o campo `sigilo` torto é ignorado sem recusar o envelope.
 */
export function lerEnvelopeArquivo(bruto: unknown): EnvelopeArquivo | null {
  const b = bruto as Partial<Record<keyof EnvelopeArquivo, unknown>> | null;
  if (!b || typeof b !== "object" || b.formato !== FORMATO_ARQUIVO || b.versao !== VERSAO_ARQUIVO || b.tipo !== "copia") return null;
  if (!Array.isArray(b.escopos) || b.escopos.length > 500) return null;
  const escopos: EscopoNoArquivo[] = [];
  for (const x of b.escopos as unknown[]) {
    const s = x as Partial<Record<keyof EscopoNoArquivo, unknown>> | null;
    const e = s?.escopo as Partial<Record<keyof Escopo, unknown>> | undefined;
    if (!e || !texto(e.host) || !texto(e.login) || !unidadeValida(e.unidade) || (e.vis !== "unidade" && e.vis !== "eu")) return null;
    const ent = s?.entidades as Partial<Record<keyof Entidades, unknown>> | undefined;
    if (!ent || typeof ent !== "object") return null;
    const entidades = {} as Record<keyof Entidades, unknown[]>;
    for (const k of LISTAS) {
      const lista = ent[k] ?? [];
      if (!Array.isArray(lista) || lista.length > TETOS_LISTA[k]) return null;
      entidades[k] = lista;
    }
    // O escopo refeito campo a campo: nada além dos quatro passa adiante.
    const escopo: Escopo = { host: e.host, login: e.login, unidade: e.unidade, vis: e.vis };
    escopos.push({ escopo, entidades: entidades as unknown as Entidades });
  }
  const sigilo = lerSigilo(b.sigilo);
  return {
    formato: FORMATO_ARQUIVO,
    versao: VERSAO_ARQUIVO,
    tipo: "copia",
    gerado: Number(b.gerado) || 0,
    escopos,
    ...(sigilo ? { sigilo } : {}),
  };
}

/**
 * Devolve à memória do sigilo deste usuário o que o arquivo traz dele. Uma entrada só: a primeira do dono (a de
 * outro login ou SEI, e uma segunda do dono, ficam de fora). O arquivo é dele: as primeiras
 * `LIMITE_LOCAIS_ARQUIVO` novas entram como "local", e o resto como "aprendida" (sob o teto dela). O que já está
 * (local ou aprendida) fica como está: nada sai e nada é promovido. Lança se a memória não lê ou não grava.
 */
async function devolverSigilo(area: Area, sigilo: unknown, d: Dono): Promise<void> {
  const minha = (lerSigilo(sigilo) ?? []).find((s) => mesmoDono(s, d));
  if (!minha) return;
  const prefixo = prefixoMemoriaSigilo(d.host, d.login);
  const memoria = await memoriaDoDono(area, d);
  // Todas as novas, na ordem do arquivo (processos e depois documentos); as primeiras ficam locais.
  const novas = Object.keys(entradasParaGravar(memoria, minha, "local", prefixo));
  const locais = Object.fromEntries(novas.slice(0, LIMITE_LOCAIS_ARQUIVO).map((k) => [k, "local" as const]));
  const sobra = { processos: [] as string[], documentos: [] as string[] };
  for (const k of novas.slice(LIMITE_LOCAIS_ARQUIVO)) {
    const resto = k.slice(prefixo.length);
    (resto.startsWith("p/") ? sobra.processos : sobra.documentos).push(resto.slice(2));
  }
  const aprendidas = entradasParaGravar(comEntradas(memoria, locais, prefixo), sobra, "aprendida", prefixo);
  const entradas = { ...locais, ...aprendidas };
  if (Object.keys(entradas).length) await area.gravar(entradas);
}

/**
 * Os escopos do envelope que são deste usuário neste SEI, conferidos de novo (quem chama pode não ter passado pela
 * leitura): host e login do dono, unidade sem barra, visibilidade conhecida e entidades num objeto. Refeitos campo
 * a campo, com o login em minúsculas.
 */
function escoposDoDono(
  env: { escopos?: unknown },
  d: Dono,
): Array<{ escopo: Escopo; entidades: Partial<Record<keyof Entidades, unknown>> }> {
  const saida: Array<{ escopo: Escopo; entidades: Partial<Record<keyof Entidades, unknown>> }> = [];
  for (const x of Array.isArray(env.escopos) ? (env.escopos as unknown[]) : []) {
    const s = x as Partial<Record<keyof EscopoNoArquivo, unknown>> | null;
    const e = s?.escopo as Partial<Record<keyof Escopo, unknown>> | undefined;
    const ent = s?.entidades;
    if (!e || !texto(e.host) || !texto(e.login) || !unidadeValida(e.unidade) || (e.vis !== "unidade" && e.vis !== "eu")) continue;
    if (!mesmoDono({ host: e.host, login: e.login }, d) || !ent || typeof ent !== "object") continue;
    saida.push({
      escopo: { host: d.host, login: d.login.trim().toLowerCase(), unidade: e.unidade, vis: e.vis },
      entidades: ent as Partial<Record<keyof Entidades, unknown>>,
    });
  }
  return saida;
}

/** As listas de um escopo como o `importar` as recebe (o que não é lista vira vazia; cada item ele confere). */
const listasDe = (ent: Partial<Record<keyof Entidades, unknown>>): Partial<Entidades> =>
  Object.fromEntries(LISTAS.map((k) => [k, Array.isArray(ent[k]) ? ent[k] : []])) as Partial<Entidades>;

/**
 * Mescla o que é deste usuário neste SEI (o de outros fica no arquivo, intocado). A memória do sigilo vem
 * antes das demandas: se ela falha, nada é gravado; e a mescla das demandas já a conhece (o sigilo gruda).
 */
export async function importarTudo(area: Area, env: EnvelopeArquivo, d: Dono, carimbo: () => Carimbo): Promise<ResultadoImportacao> {
  await devolverSigilo(area, env.sigilo, d);
  const soma: ResultadoImportacao = { novos: 0, atualizados: 0, ignorados: 0, excedentes: 0 };
  for (const s of escoposDoDono(env, d)) {
    const r = await repoDe(area, s.escopo, carimbo).importar(listasDe(s.entidades));
    soma.novos += r.novos;
    soma.atualizados += r.atualizados;
    soma.ignorados += r.ignorados;
    soma.excedentes += r.excedentes;
  }
  return soma;
}

/** O id de um item lido (o do arquivo pode vir torto: `null`, sem id), para ordenar sem lançar. */
const idDe = (x: unknown): string =>
  x && typeof x === "object" && typeof (x as { id?: unknown }).id === "string" ? (x as { id: string }).id : "";
const pelaId = (lista: readonly unknown[]): unknown[] => [...lista].sort((a, b) => (idDe(a) < idDe(b) ? -1 : idDe(a) > idDe(b) ? 1 : 0));
const pelaChave = <T extends { k: string }>(a: T, b: T) => (a.k < b.k ? -1 : a.k > b.k ? 1 : 0);

/**
 * Igual para o mesmo conteúdo em qualquer computador: escopos pela chave, listas pelo id, a memória do sigilo
 * por usuário e com os números em ordem, sem `gerado`. A memória conta: um número que ela ganhou regrava o arquivo.
 */
export function assinaturaArquivo(env: EnvelopeArquivo): string {
  const escopos = env.escopos
    .map((s) => ({
      k: chaveEscopo(s.escopo),
      d: pelaId(s.entidades.d),
      h: pelaId(s.entidades.h),
    }))
    .sort(pelaChave);
  const sigilo = (env.sigilo ?? [])
    .map((s) => ({
      k: `${s.host}|${s.login.trim().toLowerCase()}|${s.versao}`,
      p: [...s.processos].sort(),
      d: [...s.documentos].sort(),
    }))
    .sort(pelaChave);
  return assinaturaEstavel({ escopos, sigilo });
}

export function adaptadorArquivoDemandas(area: Area, d: Dono, carimbo: () => Carimbo): AdaptadorArquivo<EnvelopeArquivo> {
  return {
    formato: FORMATO_ARQUIVO,
    versao: VERSAO_ARQUIVO,
    ler: lerEnvelopeArquivo,
    importar: (env) => importarTudo(area, env, d, carimbo),
    async exportar(lido) {
      const meu = await exportarTudo(area, d, carimbo);
      // Escopos de outro SEI ou login (o mesmo arquivo escolhido em dois lugares): ficam como estão, e a memória do
      // sigilo deles também. A deste usuário é a de agora, que já mesclou a do arquivo (a leitura vem antes).
      const outros = (lido?.escopos ?? []).filter((s) => !mesmoDono(s.escopo, d));
      const sigiloDeOutros = (lido?.sigilo ?? []).filter((s) => !mesmoDono(s, d));
      return {
        envelope: { ...meu, escopos: [...meu.escopos, ...outros], sigilo: [...(meu.sigilo ?? []), ...sigiloDeOutros] },
        outros: outros.length,
      };
    },
    assinatura: assinaturaArquivo,
    mensagens: {
      outros: (n) =>
        `O arquivo também tem ${n === 1 ? "demandas" : `${n} conjuntos de demandas`} de outro usuário ou outro SEI, que foram mantidos.`,
    },
  };
}

/** O arquivo ligado (Chrome/Edge): escolher, reconectar, sincronizar ao abrir e 15 s depois de mudar. */
export function controleArquivo(area: Area, d: Dono, carimbo: () => Carimbo): ControleArquivo<EnvelopeArquivo> {
  return new ControleArquivo<EnvelopeArquivo>({
    area,
    dono: d,
    chaveStatus: chaveStatusArquivo(d),
    handles: handlesNoIndexedDB(BANCO),
    escolher: (modo) => escolherArquivoSync(modo, nomeDoArquivo(d), "Demandas do SEI Pro"),
    adaptador: adaptadorArquivoDemandas(area, d, carimbo),
  });
}

export const copiasDasDemandas = (): ArmazemCopiasDemandas => copiasNoIndexedDB<EnvelopeArquivo>(BANCO);

/** Demandas vivas (sem lápide) numa cópia: é o que o diálogo mostra. */
export function demandasNaCopia(env: EnvelopeArquivo): number {
  return env.escopos.reduce((n, s) => n + s.entidades.d.filter((d) => d.removidoEm === undefined).length, 0);
}

/** A cópia de hoje, se ainda não há; só exporta quando vai mesmo copiar. */
export function fazerCopiaDoDia(
  area: Area,
  d: Dono,
  armazem: ArmazemCopiasDemandas,
  hoje: DataISO,
  carimbo: () => Carimbo,
): Promise<boolean> {
  return fazerCopiaComum(armazem, d, hoje, carimbo().agora, async () => {
    const envelope = await exportarTudo(area, d, carimbo);
    return { envelope, quantidade: demandasNaCopia(envelope) };
  });
}

/** Um item com id (o da cópia ou do arquivo pode vir torto: `null`, número, sem id). */
const comId = (x: unknown): x is Versionada =>
  !!x && typeof x === "object" && !Array.isArray(x) && typeof (x as { id?: unknown }).id === "string";

/**
 * Os itens ATIVOS na cópia que aqui sumiram (ausentes ou com lápide), recarimbados para vencer a lápide. O que está
 * vivo aqui não entra (fica como está, mesmo que difira da cópia), nem o que `doOutro` diz que foi para o outro
 * escopo da unidade.
 */
function sumidos(daCopia: unknown, aqui: readonly Versionada[], c: Carimbo, doOutro: (x: Versionada) => boolean): Versionada[] {
  const vivos = new Set(aqui.filter((x) => x.removidoEm === undefined).map((x) => x.id));
  const lista = Array.isArray(daCopia) ? (daCopia as unknown[]) : [];
  return recarimbarAtivos(
    lista.filter(comId).filter((x) => !vivos.has(x.id) && !doOutro(x)),
    c,
  );
}

/** O que voltou de fato ao restaurar uma cópia (o diálogo diz "Voltaram 3 demandas e 5 registros do histórico."). */
export interface ResultadoRestauracao {
  demandas: number;
  /** Registros do histórico que faltavam aqui. */
  registros: number;
  /** Demandas que estavam na cópia e não voltaram por estarem no outro escopo (vivas ou excluídas lá). */
  noOutroEscopo: number;
  /** O rótulo dos escopos onde elas estão (“Toda a unidade”, “Só eu”). */
  rotulosDoOutro: string[];
}

const TIPO_RESTAURADO: Record<keyof Entidades, "demandas" | "registros"> = { d: "demandas", h: "registros" };

/**
 * Os registros do histórico da cópia que aqui não existem: entram como vieram (registro não muda depois de gravado).
 * O que foi junto com a demanda para o outro escopo pela mudança de visibilidade (`doOutro`) não volta.
 */
function ausentes(daCopia: unknown, aqui: readonly Versionada[], doOutro: (x: Versionada) => boolean): Versionada[] {
  const ids = new Set(aqui.map((x) => x.id));
  return (Array.isArray(daCopia) ? (daCopia as unknown[]) : []).filter(comId).filter((x) => !ids.has(x.id) && !doOutro(x));
}

/** Como cada id (demanda ou registro: o que a visibilidade leva) está num escopo: vivo, ou a lápide de quando. */
type Situacoes = Map<string, { vivo: boolean; removidoEm?: number }>;

async function situacoesDe(repo: RepositorioDemandas): Promise<Situacoes> {
  const t = await repo.entidades();
  return new Map([...t.d, ...t.h].map((x) => [x.id, { vivo: x.removidoEm === undefined, removidoEm: x.removidoEm }]));
}

/**
 * O id foi para o outro escopo da unidade depois de sair deste: não está vivo aqui, e lá está vivo ou tem uma
 * lápide mais nova que a daqui (ou aqui nem existe mais). Lápide lá mais velha que a daqui é o contrário: veio de lá
 * para cá e saiu daqui depois, e é aqui que volta.
 */
function foiParaOOutro(id: string, aqui: Situacoes, outro: Situacoes, privado: boolean): boolean {
  const o = outro.get(id);
  if (!o) return false;
  const a = aqui.get(id);
  if (a?.vivo) return false;
  if (o.vivo) return true;
  // Restaurando para "Só eu", a lápide lá (excluído depois de levado à unidade) não impede de voltar: não fica vivo nos dois.
  if (privado) return false;
  return (o.removidoEm ?? 0) > (a?.removidoEm ?? Number.NEGATIVE_INFINITY);
}

const ROTULO_DO_ESCOPO: Record<Escopo["vis"], string> = { unidade: "Toda a unidade", eu: "Só eu" };

const OUTRA_VIS: Record<Escopo["vis"], Escopo["vis"]> = { unidade: "eu", eu: "unidade" };

/**
 * Restaurar uma cópia RECUPERA, não volta no tempo: entram só as demandas que estavam ativas na cópia e aqui sumiram
 * (ausentes ou excluídas depois dela), recarimbadas para vencer a lápide; os registros do histórico que faltam entram
 * como vieram. O que está vivo aqui fica como está, mesmo que difira da cópia (a edição de um colega depois da cópia
 * não é desfeita) e não é recarimbado. O que foi para o OUTRO escopo da mesma unidade depois da cópia (a demanda que
 * mudou de visibilidade, viva lá ou excluída lá depois, com os registros que foram junto) também não volta: senão
 * ficaria viva nos dois. A memória do sigilo da cópia volta como no `importarTudo`. A cópia vem do IndexedDB e passa
 * pela mesma leitura do arquivo: torta, nada é restaurado (`ErroValidacao`). Devolve o que voltou de fato.
 */
export async function restaurarCopia(area: Area, copia: CopiaDemandas, d: Dono, carimbo: () => Carimbo): Promise<ResultadoRestauracao> {
  const env = lerEnvelopeArquivo((copia as { envelope?: unknown } | null)?.envelope);
  if (!env) throw new ErroValidacao("copia", "Esta cópia está danificada e não pode ser restaurada. Escolha a de outro dia.");
  const c = carimbo();
  await devolverSigilo(area, env.sigilo, d);
  const voltaram: ResultadoRestauracao = { demandas: 0, registros: 0, noOutroEscopo: 0, rotulosDoOutro: [] };
  // A situação de cada escopo, lida antes de restaurar qualquer um; o escopo restaurado é relido (o que ele recuperou
  // conta para o outro).
  const situacoes = new Map<string, Situacoes>();
  const situacaoDe = async (e: Escopo, reler = false): Promise<Situacoes> => {
    const k = chaveEscopo(e);
    let v = situacoes.get(k);
    if (!v || reler) {
      v = await situacoesDe(repoDe(area, e, () => c));
      situacoes.set(k, v);
    }
    return v;
  };
  const outroDe = (e: Escopo): Escopo => ({ ...e, vis: OUTRA_VIS[e.vis] });
  for (const s of escoposDoDono(env, d)) {
    await situacaoDe(s.escopo);
    await situacaoDe(outroDe(s.escopo));
  }
  for (const s of escoposDoDono(env, d)) {
    const repo = repoDe(area, s.escopo, () => c);
    const aqui = await repo.entidades();
    const meu = await situacaoDe(s.escopo);
    const outro = await situacaoDe(outroDe(s.escopo));
    const privado = s.escopo.vis === "eu";
    // O item, ou a demanda dele (registro), foi para o outro escopo.
    const doOutro = (x: Versionada): boolean => {
      const demanda = (x as { demanda?: unknown }).demanda;
      return foiParaOOutro(x.id, meu, outro, privado) || (typeof demanda === "string" && foiParaOOutro(demanda, meu, outro, privado));
    };
    // O que a cópia tinha ativo e ficou de fora por isso (sem os registros, que vêm junto da demanda).
    const puladas = new Set<string>();
    const contando = (x: Versionada): boolean => {
      const foi = doOutro(x);
      if (foi && x.removidoEm === undefined) puladas.add(x.id);
      return foi;
    };
    const escolhidos: Record<keyof Entidades, Versionada[]> = {
      d: sumidos(s.entidades.d, aqui.d, c, contando),
      h: ausentes(s.entidades.h, aqui.h, doOutro),
    };
    if (puladas.size > 0) {
      voltaram.noOutroEscopo += puladas.size;
      const rotulo = ROTULO_DO_ESCOPO[OUTRA_VIS[s.escopo.vis]];
      if (!voltaram.rotulosDoOutro.includes(rotulo)) voltaram.rotulosDoOutro.push(rotulo);
    }
    if (LISTAS.every((k) => escolhidos[k].length === 0)) continue;
    await repo.importar(escolhidos as unknown as Partial<Entidades>);
    const depois = await repo.entidades();
    for (const k of LISTAS) {
      const ids = new Set(escolhidos[k].map((x) => x.id));
      voltaram[TIPO_RESTAURADO[k]] += (depois[k] as Versionada[]).filter((x) => ids.has(x.id) && x.removidoEm === undefined).length;
    }
    await situacaoDe(s.escopo, true);
  }
  return voltaram;
}
