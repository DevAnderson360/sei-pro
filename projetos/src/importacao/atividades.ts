/**
 * Importar do servidor do Atividades (spec 6.3): os projetos que o painel
 * legado lista (`padrao.projetos`, com `etapas`) viram projetos novos. O
 * mapeamento é puro; quem busca é o content script (pagina/atividades.ts).
 *
 * O servidor é de FORA: todo campo é conferido (tipo, tamanho, data que existe,
 * número com a forma de número) e o que não serve fica vazio; ids repetidos,
 * dependência circular e etapa de 20 anos não passam. O que sai daqui passa no
 * `entidadeValida` da sincronia por construção (e é conferido antes de gravar).
 *
 * Idempotente pelos ids: projeto `atvp<id>`, etapa `atve<id>`, fase
 * `atvf<id do projeto>-<hash do nome>` (os mesmos em qualquer computador: duas
 * pessoas da unidade importando o mesmo projeto não duplicam) e `origem`
 * guarda o id legado. Reimportar atualiza só o que ninguém mexeu depois (o
 * item continua com o dispositivo "atividades"); o que foi editado ou
 * excluído aqui fica como está (o projeto excluído aqui não volta, nem com
 * etapa nova do servidor). Datas `0000-00-00…` = vazio; a hora do servidor é a
 * de Brasília (o backend fixa `America/Sao_Paulo`).
 *
 * Sigilo: o legado não guarda se o processo é sigiloso, então o vínculo entra
 * sem a marca (o usuário marca pela caixa, e o número que a memória do sigilo
 * deste computador já conhece é marcado pelo `importar`). A marca que o item
 * daqui já tem (posta por um colega que sabia do sigilo, ou pela memória) passa
 * para a versão nova: reimportar nunca desmarca.
 */

import { type DataISO, diferencaDias, somarDias } from "@comum/datas/dias";
import { indiceEntre, indiceValido } from "@comum/ordem/indice";
import { jsonEstavel } from "@comum/sincronia/assinatura";
import { hashCurto, normalizarTexto } from "@comum/texto";
import { mensagemDoErro } from "../app/erros";
import { dataNaFaixa, LIMITE_DIAS_ETAPA } from "../modelo/calendario";
import { LIMITES, MAXIMO_PROJETOS_ATIVIDADES } from "../modelo/constantes";
import { encontrarCiclo } from "../modelo/dependencias";
import type { RegistroNovo } from "../modelo/historico";
import type { Carimbo, DocumentoSei, Entidade, Entidades, Etapa, Fase, ItemChecklist, Projeto, Vinculo, Vis } from "../modelo/tipos";
import { ErroValidacao, etiquetasLimpas, nomeLimpo } from "../modelo/validacao";
import { protocoloNoTexto, RE_DOCUMENTO, RE_ID_PROCEDIMENTO } from "../modelo/vinculos";
import { entidadeValida, type RepositorioProjetos } from "../repositorio";
import { CAMPOS_ETAPA, CAMPOS_PROJETO, escolher } from "./camposLegado";

/** O dispositivo do que veio do Atividades: editado aqui, passa a ser o do computador (e a reimportação não mexe). */
export const DISPOSITIVO_ATIVIDADES = "atividades";

export interface DemandaLegada {
  id_demanda?: unknown;
  nome_atividade?: unknown;
  assunto?: unknown;
  data_entrega?: unknown;
}

export interface EtapaLegada {
  id_etapa: number;
  id_dependencia?: unknown;
  nome_etapa?: unknown;
  processo_sei?: unknown;
  id_procedimento?: unknown;
  responsavel?: unknown;
  data_inicio_programado?: unknown;
  data_fim_programado?: unknown;
  data_inicio_progresso_automatico?: unknown;
  observacoes?: unknown;
  macroetapa?: unknown;
  grupo?: unknown;
  etiqueta?: unknown;
  data_inicio_execucao?: unknown;
  data_fim_execucao?: unknown;
  progresso_execucao?: unknown;
  documento_relacionado?: unknown;
  documento_sei?: unknown;
  id_demandas_titles?: unknown;
  data_inicio?: unknown;
}

export interface ProjetoLegado {
  id_projeto: number;
  nome_projeto?: unknown;
  sigla_unidade?: unknown;
  tipo_projeto?: unknown;
  processo_sei?: unknown;
  id_procedimento?: unknown;
  data_inicio?: unknown;
  data_fim?: unknown;
  ativo?: unknown;
  /** No máximo uma além do teto de 300 (o bastante para saber que o projeto não cabe). */
  etapas: EtapaLegada[];
}

const objeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** Id do legado: inteiro positivo, em número ou em texto (o PDO devolve texto). */
function inteiro(x: unknown): number | null {
  const n = typeof x === "number" ? x : typeof x === "string" && /^\d{1,15}$/.test(x.trim()) ? Number(x.trim()) : Number.NaN;
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** Corta em `max` unidades (é como o `entidadeValida` conta) sem partir um par substituto (emoji) ao meio. */
function cortar(s: string, max: number): string {
  if (s.length <= max) return s;
  const t = s.slice(0, max);
  const ultimo = t.charCodeAt(t.length - 1);
  return ultimo >= 0xd800 && ultimo <= 0xdbff ? t.slice(0, -1) : t;
}

/** Caracteres de controle (0x00 a 0x1f e 0x7f) viram espaço; com `linhas`, a quebra de linha fica. */
function semControles(s: string, linhas = false): string {
  let saida = "";
  for (const ch of s) {
    const c = ch.charCodeAt(0);
    saida += (c < 0x20 || c === 0x7f) && !(linhas && c === 0x0a) ? " " : ch;
  }
  return saida;
}

/**
 * Texto de uma linha: só texto ou número (objeto, lista e o `false` do legado são vazio), sem controles e
 * sem espaços repetidos, cortado em `max`. Antes de limpar, um teto folgado: um nome de megabytes não é
 * percorrido inteiro.
 */
function textoDe(x: unknown, max: number): string {
  if (typeof x !== "string" && !(typeof x === "number" && Number.isFinite(x))) return "";
  const t = nomeLimpo(semControles(String(x).slice(0, max * 4)));
  return t === "false" ? "" : nomeLimpo(cortar(t, max));
}

/** Texto de várias linhas (observações): como `textoDe`, mas as quebras de linha ficam. */
function textoLivre(x: unknown, max: number): string {
  if (typeof x !== "string") return "";
  const t = semControles(x.slice(0, max * 4).replace(/\r\n?/g, "\n"), true).trim();
  return t === "false" ? "" : cortar(t, max).trimEnd();
}

const RE_DATA_HORA = /^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/;

/** "2026-10-06 14:00:00" → "2026-10-06" (vazio, sentinela, lixo ou fora de 2000–2100 → undefined). */
export function diaLegado(x: unknown): DataISO | undefined {
  if (typeof x !== "string") return undefined;
  const d = RE_DATA_HORA.exec(x.trim())?.[1];
  return d !== undefined && dataNaFaixa(d) ? d : undefined;
}

/**
 * "2026-10-06 14:00:00" → ms, lido sempre em -03:00 (Brasília). O motivo é ser o MESMO instante em qualquer
 * computador: lido na hora local, quem importa em Manaus gravaria outro `criadoEm`/`arquivadoEm` e cada um
 * regravaria o que o outro importou. A hora é a que o próprio backend usa para comparar: `functions.php`
 * (listProjetos, o `ativo`) compara `data_fim` com `new DateTime()` no fuso do PHP, que o `index.php` fixa em
 * `America/Sao_Paulo`; o MySQL não fixa `time_zone`, então o valor gravado é o relógio de quem gravou, na prática
 * Brasília. O horário de verão de antes de 2019 desloca em uma hora, sem efeito aqui.
 */
function instanteLegado(x: unknown): number | undefined {
  if (typeof x !== "string") return undefined;
  const m = RE_DATA_HORA.exec(x.trim());
  const dia = m?.[1];
  if (!m || dia === undefined || !dataNaFaixa(dia)) return undefined;
  const ms = Date.parse(`${dia}T${m[2] ?? "00"}:${m[3] ?? "00"}:${m[4] ?? "00"}-03:00`);
  return Number.isFinite(ms) ? ms : undefined;
}

/**
 * Só os projetos com a forma do legado (id numérico), até `MAXIMO_PROJETOS_ATIVIDADES`; projeto repetido fica
 * o primeiro, e etapa sem id ou repetida (no mesmo projeto ou noutro) sai. As etapas de um projeto param uma
 * além do teto (ele não vai caber). Só os campos que o mapeamento lê são copiados.
 */
export function projetosLegados(bruto: unknown): ProjetoLegado[] {
  if (!Array.isArray(bruto)) return [];
  const saida: ProjetoLegado[] = [];
  const projetosVistos = new Set<number>();
  const etapasVistas = new Set<number>();
  for (const x of bruto) {
    if (saida.length >= MAXIMO_PROJETOS_ATIVIDADES) break;
    if (!objeto(x)) continue;
    const id = inteiro(x.id_projeto);
    if (id === null || projetosVistos.has(id)) continue;
    projetosVistos.add(id);
    const etapas: EtapaLegada[] = [];
    for (const e of Array.isArray(x.etapas) ? x.etapas : []) {
      if (etapas.length > LIMITES.etapasPorProjeto) break;
      if (!objeto(e)) continue;
      const ide = inteiro(e.id_etapa);
      if (ide === null || etapasVistas.has(ide)) continue;
      etapasVistas.add(ide);
      etapas.push({ ...escolher(e, CAMPOS_ETAPA), id_demandas_titles: e.id_demandas_titles, id_etapa: ide });
    }
    saida.push({ ...escolher(x, CAMPOS_PROJETO), id_projeto: id, etapas });
  }
  return saida;
}

export const idDoLegado = {
  projeto: (id: number): string => `atvp${id}`,
  etapa: (id: number): string => `atve${id}`,
  fase: (idProjeto: number, nome: string): string => `atvf${idProjeto}-${hashCurto(normalizarTexto(nome)).slice(0, 8)}`,
  item: (idDemanda: unknown, i: number): string => `atvd${inteiro(idDemanda) ?? `x${i}`}`,
};

/**
 * Arquivado: `data_fim` preenchida e já passada (o legado chama de vigente o projeto com fim no futuro), ou
 * o servidor diz que não está ativo. Vale o instante do servidor (o mesmo em todo computador).
 */
function arquivadoEm(l: ProjetoLegado, agora: number): number | undefined {
  const quando = instanteLegado(l.data_fim);
  if (quando === undefined) return undefined;
  return quando <= agora || l.ativo === false ? quando : undefined;
}

/** O id interno do processo, só quando é número. */
function idProcedimentoDe(x: unknown): string | undefined {
  if (typeof x === "number") return Number.isSafeInteger(x) && x > 0 ? String(x) : undefined;
  return typeof x === "string" && RE_ID_PROCEDIMENTO.test(x.trim()) ? x.trim() : undefined;
}

/**
 * O número de processo do campo do legado: o campo inteiro, ou o único pedaço que é número de processo
 * (`protocoloNoTexto`, a regra do diálogo); nada é tirado do meio de um pedaço (com as letras do SEI-RJ, isso
 * inventaria um número). Nenhum ou dois números: sem vínculo.
 */
function vinculoDe(processo: unknown, idProcedimento: unknown): Vinculo | undefined {
  const protocolo = protocoloNoTexto(textoDe(processo, LIMITES.nome));
  if (!protocolo) return undefined;
  const id = idProcedimentoDe(idProcedimento);
  return id ? { protocolo, idProcedimento: id } : { protocolo };
}

/** O número SEI do documento: a única sequência de dígitos do campo (até 20); nenhuma ou duas: sem documento. */
function documentoDe(numero: unknown, titulo: unknown): DocumentoSei | undefined {
  const pedacos = textoDe(numero, LIMITES.nome).match(/\d+/g) ?? [];
  const n = pedacos.length === 1 ? pedacos[0] : undefined;
  if (n === undefined || !RE_DOCUMENTO.test(n)) return undefined;
  const t = textoDe(titulo, LIMITES.nome);
  return t ? { numero: n, titulo: t } : { numero: n };
}

function etiquetasDe(...valores: unknown[]): string[] {
  const brutas = valores
    .flatMap((v) => textoDe(v, LIMITES.observacoes).split(/[,;]/))
    .map((t) => cortar(t.trim(), LIMITES.etiquetaTexto).trim())
    .filter((t) => t !== "false");
  return etiquetasLimpas(brutas).slice(0, LIMITES.etiquetas);
}

/**
 * As demandas viram itens do checklist ("Demanda: <nome>", feito com a data de entrega), ids sem repetir. Até 50
 * (o teto do checklist); com mais, as 49 primeiras e um 50º item que diz quantas ficaram só no Atividades (feito
 * quando todas elas foram entregues): o corte não passa calado.
 */
function checklistDe(x: unknown): ItemChecklist[] {
  if (!Array.isArray(x)) return [];
  const todas = x.filter(objeto);
  const cabem = todas.length > LIMITES.checklistItens ? LIMITES.checklistItens - 1 : todas.length;
  const ids = new Set<string>();
  const saida: ItemChecklist[] = [];
  for (const d of todas.slice(0, cabem)) {
    const nome = textoDe(d.nome_atividade, LIMITES.checklistTexto) || textoDe(d.assunto, LIMITES.checklistTexto) || "sem nome";
    let id = idDoLegado.item(d.id_demanda, saida.length);
    if (ids.has(id)) id = `${id}-${saida.length}`;
    ids.add(id);
    saida.push({ id, texto: cortar(`Demanda: ${nome}`, LIMITES.checklistTexto).trimEnd(), feito: diaLegado(d.data_entrega) !== undefined });
  }
  const resto = todas.slice(cabem);
  if (resto.length) {
    const quantas = resto.length === 1 ? "1 demanda" : `${resto.length} demandas`;
    saida.push({
      id: "atvd-mais",
      texto: `… e mais ${quantas} no Atividades`,
      feito: resto.every((d) => diaLegado(d.data_entrega) !== undefined),
    });
  }
  return saida;
}

function progressoDe(x: unknown): number {
  const n = typeof x === "number" ? x : typeof x === "string" && x.trim() ? Number(x.trim()) : Number.NaN;
  return Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : 0;
}

/** Tira, na ordem, a dependência que fecharia um ciclo (o servidor não confere; a etapa que fecha perde a seta). */
function semCiclos(etapas: readonly Etapa[]): void {
  const vistas: Etapa[] = [];
  for (const e of etapas) {
    vistas.push(e);
    if (e.dependeDe.length && encontrarCiclo(vistas, e.id)) e.dependeDe = [];
  }
}

/** O nome do projeto como entra (e como o diálogo e o aviso o mostram). */
function nomeDoProjeto(l: ProjetoLegado): string {
  return textoDe(l.nome_projeto, LIMITES.nome) || `Projeto ${l.id_projeto}`;
}

/** O projeto legado como entidades novas (carimbo do Atividades), com as etapas em ordem de início. */
export function mapearProjeto(l: ProjetoLegado, c: Carimbo, hoje: DataISO, ordem: string): Pick<Entidades, "p" | "f" | "e"> {
  const pid = idDoLegado.projeto(l.id_projeto);
  const carimbo = { atualizadoEm: c.agora, dispositivo: DISPOSITIVO_ATIVIDADES, ...(c.por ? { alteradoPor: c.por } : {}) };
  const projeto: Projeto = {
    id: pid,
    nome: nomeDoProjeto(l),
    etiquetas: etiquetasDe(l.tipo_projeto),
    ordem,
    criadoEm: instanteLegado(l.data_inicio) ?? 0,
    origem: { atividades: l.id_projeto },
    ...carimbo,
  };
  const processo = vinculoDe(l.processo_sei, l.id_procedimento);
  if (processo) projeto.processo = processo;
  const arquivo = arquivadoEm(l, c.agora);
  if (arquivo !== undefined) projeto.arquivadoEm = arquivo;
  const diaDoProjeto = diaLegado(l.data_inicio) ?? hoje;
  const fases = new Map<string, Fase>();
  let ordemFase: string | null = null;
  const etapasLegadas = [...l.etapas].sort((a, b) => {
    const da = diaLegado(a.data_inicio_programado) ?? "";
    const db = diaLegado(b.data_inicio_programado) ?? "";
    return da < db ? -1 : da > db ? 1 : a.id_etapa - b.id_etapa;
  });
  const ids = new Set(etapasLegadas.map((e) => e.id_etapa));
  let ordemEtapa: string | null = null;
  const etapas = etapasLegadas.map((e): Etapa => {
    const progIni = diaLegado(e.data_inicio_programado);
    const progFim = diaLegado(e.data_fim_programado);
    const execIni = diaLegado(e.data_inicio_execucao);
    const execFim = diaLegado(e.data_fim_execucao);
    const inicio = execIni ?? progIni ?? diaDoProjeto;
    let fim = execFim ?? progFim ?? inicio;
    if (fim < inicio) fim = inicio;
    if (diferencaDias(inicio, fim) > LIMITE_DIAS_ETAPA) fim = somarDias(inicio, LIMITE_DIAS_ETAPA);
    const base =
      progIni && progFim && progFim >= progIni && diferencaDias(progIni, progFim) <= LIMITE_DIAS_ETAPA
        ? { inicio: progIni, fim: progFim }
        : { inicio, fim };
    ordemEtapa = indiceEntre(ordemEtapa, null);
    const etapa: Etapa = {
      id: idDoLegado.etapa(e.id_etapa),
      projeto: pid,
      ordem: ordemEtapa,
      nome: textoDe(e.nome_etapa, LIMITES.nome) || `Etapa ${e.id_etapa}`,
      inicio,
      fim,
      marco: false,
      dependeDe: [],
      medida: diaLegado(e.data_inicio_progresso_automatico) === undefined ? "manual" : "tempo",
      progresso: progressoDe(e.progresso_execucao),
      checklist: checklistDe(e.id_demandas_titles),
      etiquetas: etiquetasDe(e.grupo, e.etiqueta),
      base,
      criadoEm: instanteLegado(e.data_inicio) ?? 0,
      origem: { atividades: e.id_etapa },
      ...carimbo,
    };
    const dep = inteiro(e.id_dependencia);
    if (dep !== null && dep !== e.id_etapa && ids.has(dep)) etapa.dependeDe = [idDoLegado.etapa(dep)];
    // A conclusão é o término já corrigido (nunca antes do início).
    if (execFim) etapa.concluidaEm = fim;
    const nomeFase = textoDe(e.macroetapa, LIMITES.nome);
    if (nomeFase) {
      const fid = idDoLegado.fase(l.id_projeto, nomeFase);
      if (!fases.has(fid)) {
        ordemFase = indiceEntre(ordemFase, null);
        fases.set(fid, { id: fid, projeto: pid, nome: nomeFase, ordem: ordemFase, ...carimbo });
      }
      etapa.fase = fid;
    }
    const responsavel = textoDe(e.responsavel, LIMITES.nome);
    if (responsavel) etapa.responsavel = { nome: responsavel };
    const obs = textoLivre(e.observacoes, LIMITES.observacoes);
    if (obs) etapa.observacoes = obs;
    const doc = documentoDe(e.documento_sei, e.documento_relacionado);
    if (doc) etapa.documento = doc;
    const proc = vinculoDe(e.processo_sei, e.id_procedimento);
    if (proc) etapa.processo = proc;
    return etapa;
  });
  semCiclos(etapas);
  return { p: [projeto], f: [...fases.values()], e: etapas };
}

/** Uma linha do diálogo: o que o usuário escolhe. */
export interface ItemImportavel {
  id: number;
  nome: string;
  unidade: string;
  etapas: number;
  arquivado: boolean;
  /** Mais etapas que o limite de 300 por projeto: não pode ser importado (nada entra pela metade). */
  grande?: boolean;
}

export function itensParaImportar(lista: readonly ProjetoLegado[], agora: number): ItemImportavel[] {
  return lista.map((l) => {
    const item: ItemImportavel = {
      id: l.id_projeto,
      nome: nomeDoProjeto(l),
      unidade: textoDe(l.sigla_unidade, 40),
      etapas: l.etapas.length,
      arquivado: arquivadoEm(l, agora) !== undefined,
    };
    if (l.etapas.length > LIMITES.etapasPorProjeto) item.grande = true;
    return item;
  });
}

/** Os ids do legado dos projetos vivos que já vieram do Atividades (o diálogo os mostra como "atualiza"). */
export function legadosImportados(projetos: readonly Projeto[]): Set<number> {
  const ids = new Set<number>();
  for (const p of projetos) {
    const id = p.origem?.atividades;
    if (p.removidoEm === undefined && typeof id === "number" && Number.isSafeInteger(id)) ids.add(id);
  }
  return ids;
}

/**
 * Os ids do legado que só têm lápide (excluídos aqui, em qualquer escopo, e sem cópia viva em nenhum): a
 * importação não os traz de volta, e o diálogo os mostra como "excluído aqui". `projetos` são os dos dois escopos,
 * com as lápides (`entidades().p`); o projeto movido entre escopos tem lápide num e está vivo no outro: não conta.
 */
export function legadosExcluidos(projetos: readonly Projeto[]): Set<number> {
  const vivos = legadosImportados(projetos);
  const ids = new Set<number>();
  for (const p of projetos) {
    const id = p.origem?.atividades;
    if (p.removidoEm !== undefined && typeof id === "number" && Number.isSafeInteger(id) && !vivos.has(id)) ids.add(id);
  }
  return ids;
}

export interface ResultadoImportacaoAtividades {
  /** Projetos que entraram pela primeira vez. */
  novos: number;
  /** Projetos já importados que tinham algo a atualizar. */
  atualizados: number;
  /** Já importados e sem nada novo (o que foi mexido aqui não conta como novo: não é tocado). */
  iguais: number;
  /** Ficaram no outro escopo ("Só eu" ou "Toda a unidade"), onde já estavam (contam também acima). */
  noOutroEscopo: number;
  /** Excluídos aqui, em qualquer dos dois escopos: não voltam (nem com etapa nova do servidor). */
  excluidosAqui: number;
  /** Ficaram de fora inteiros: a soma dos três abaixo. */
  ignorados: number;
  /** Os nomes dos que passariam do limite de 100 projetos ativos. */
  foraPorProjetos: string[];
  /** Os nomes dos que têm mais de 300 etapas. */
  foraPorEtapas: string[];
  /** Os que viriam com dados que não passam na validação da sincronia (defesa: o mapeamento não os produz). */
  invalidos: number;
}

const conteudo = (x: { atualizadoEm: number; dispositivo: string; alteradoPor?: string }): string => {
  const { atualizadoEm: _a, dispositivo: _d, alteradoPor: _p, ...resto } = x;
  return jsonEstavel(resto);
};

const vivo = (x: { removidoEm?: number } | undefined): boolean => !!x && x.removidoEm === undefined;
const ativo = (p: Projeto | undefined): boolean => vivo(p) && p?.arquivadoEm === undefined;

/** Um escopo durante a importação: o que já está aqui (com lápides) e, por cima, o que esta importação vai gravar. */
interface Escopo {
  repo: RepositorioProjetos;
  c: Carimbo;
  p: Map<string, Projeto>;
  f: Map<string, Fase>;
  e: Map<string, Etapa>;
  maiorOrdem: string | null;
  lote: { p: Projeto[]; f: Fase[]; e: Etapa[] };
  registros: RegistroNovo[];
}

async function escopo(repo: RepositorioProjetos): Promise<Escopo> {
  const ent = await repo.entidades();
  return {
    repo,
    c: repo.carimboAtual(),
    p: new Map(ent.p.map((x) => [x.id, x])),
    f: new Map(ent.f.map((x) => [x.id, x])),
    e: new Map(ent.e.map((x) => [x.id, x])),
    // Chave inválida (dado antigo ou editado à mão) não entra na conta, como no repositório.
    maiorOrdem: ent.p.reduce<string | null>((m, x) => (indiceValido(x.ordem) && (m === null || x.ordem > m) ? x.ordem : m), null),
    lote: { p: [], f: [], e: [] },
    registros: [],
  };
}

/** A marca de sigilo que a versão daqui tem passa para a nova (reimportar nunca desmarca). */
function comAsMarcas<T extends Projeto | Etapa>(x: T, local: T | undefined): T {
  if (local?.processo?.sigiloso && x.processo) x.processo = { ...x.processo, sigiloso: true };
  const docLocal = (local as Etapa | undefined)?.documento;
  const doc = (x as Etapa).documento;
  if (docLocal?.sigiloso && doc) (x as Etapa).documento = { ...doc, sigiloso: true };
  return x;
}

/** Entra o novo e o que ainda está como veio do Atividades (vivo) com conteúdo diferente; o mexido aqui fica. */
function entra<T extends Entidade>(x: T, local: T | undefined): boolean {
  return !local || (local.dispositivo === DISPOSITIVO_ATIVIDADES && vivo(local) && conteudo(local) !== conteudo(x));
}

/**
 * O que um projeto mapeado grava neste escopo: ajustado ao que já está aqui (as marcas de sigilo ficam; fase
 * excluída aqui não volta, e a etapa nova fica sem ela; etapa que aqui é de outro projeto não muda de projeto;
 * a seta do servidor que fecharia um ciclo com uma dependência editada aqui sai) e só com o que entra.
 */
function loteDoProjeto(m: Pick<Entidades, "p" | "f" | "e">, s: Escopo, pid: string): Escopo["lote"] {
  const p = m.p.filter((x) => entra(comAsMarcas(x, s.p.get(x.id)), s.p.get(x.id)));
  const f = m.f.filter((x) => entra(x, s.f.get(x.id)));
  const candidatas = m.e.filter((x) => {
    const local = s.e.get(x.id);
    if (local && local.projeto !== pid) return false;
    comAsMarcas(x, local);
    if (x.fase && s.f.get(x.fase)?.removidoEm !== undefined) delete x.fase;
    return entra(x, local);
  });
  const final = new Map([...s.e.values()].filter((x) => x.projeto === pid && vivo(x)).map((x) => [x.id, x]));
  for (const x of candidatas) final.set(x.id, x);
  for (const x of candidatas) if (x.dependeDe.length && encontrarCiclo([...final.values()], x.id)) x.dependeDe = [];
  // Sem a seta cortada, a etapa pode ter ficado igual à daqui: não regrava.
  const e = candidatas.filter((x) => entra(x, s.e.get(x.id)));
  // Por cima de uma versão daqui, o carimbo fica acima do dela (o relógio de outro computador pode estar adiantado).
  const acima = <T extends Entidade>(x: T, local: T | undefined): T =>
    local && Number.isFinite(local.atualizadoEm) ? { ...x, atualizadoEm: Math.max(x.atualizadoEm, local.atualizadoEm + 1) } : x;
  return {
    p: p.map((x) => acima(x, s.p.get(x.id))),
    f: f.map((x) => acima(x, s.f.get(x.id))),
    e: e.map((x) => acima(x, s.e.get(x.id))),
  };
}

/**
 * Os tetos da spec 5.4 que o `importar` aplicaria, contados aqui (o projeto que não cabe fica de fora inteiro):
 * o que estoura, ou null se cabe.
 */
function foraDoTeto(lote: Escopo["lote"], s: Escopo, pid: string): "projetos" | "etapas" | null {
  const novo = lote.p[0];
  if (novo && ativo(novo) && !ativo(s.p.get(pid))) {
    const ativos = [...s.p.values()].filter(ativo).length;
    if (ativos >= LIMITES.projetosAtivos) return "projetos";
  }
  const vivas = new Set([...s.e.values()].filter((x) => x.projeto === pid && vivo(x)).map((x) => x.id));
  for (const x of lote.e) if (vivo(x)) vivas.add(x.id);
  return vivas.size <= LIMITES.etapasPorProjeto ? null : "etapas";
}

function validos(lote: Escopo["lote"], agora: number): boolean {
  return (
    lote.p.every((x) => entidadeValida(x, "p", agora)) &&
    lote.f.every((x) => entidadeValida(x, "f", agora)) &&
    lote.e.every((x) => entidadeValida(x, "e", agora))
  );
}

/**
 * Grava os escolhidos: no escopo onde o projeto está vivo (o destino primeiro; senão o outro) ou no `destino`. O
 * excluído aqui, em QUALQUER escopo e sem cópia viva, não volta (nem pelo outro escopo). Entra só o que é novo ou
 * mudou no servidor E não foi mexido aqui. O projeto que passaria de um teto (100 ativos, 300 etapas) fica de fora
 * inteiro, sem nada órfão, e o resultado leva o nome dele. Cada escopo grava numa chamada só (`importar` com
 * `inteiro`: tudo ou nada, decidido na mesma leitura da gravação), "Toda a unidade" primeiro: o repositório da
 * unidade com o "Entendi" pergunta uma vez, e sem ele nada é gravado em lugar nenhum. Se a unidade gravou e o
 * "Só eu" falhou, o erro diz que a parte da unidade já entrou (importar de novo completa, sem repetir nada).
 */
export async function importarAtividades(
  repos: Readonly<Record<Vis, RepositorioProjetos>>,
  escolhidos: readonly ProjetoLegado[],
  destino: Vis,
  hoje: DataISO,
): Promise<ResultadoImportacaoAtividades> {
  const r: ResultadoImportacaoAtividades = {
    novos: 0,
    atualizados: 0,
    iguais: 0,
    noOutroEscopo: 0,
    excluidosAqui: 0,
    ignorados: 0,
    foraPorProjetos: [],
    foraPorEtapas: [],
    invalidos: 0,
  };
  const outro: Vis = destino === "unidade" ? "eu" : "unidade";
  const escopos: Record<Vis, Escopo> = { unidade: await escopo(repos.unidade), eu: await escopo(repos.eu) };
  for (const l of escolhidos) {
    const pid = idDoLegado.projeto(l.id_projeto);
    const noDestino = escopos[destino].p.get(pid);
    const noOutro = escopos[outro].p.get(pid);
    let s: Escopo;
    if (vivo(noDestino)) s = escopos[destino];
    else if (vivo(noOutro)) {
      s = escopos[outro];
      r.noOutroEscopo++;
    } else if (noDestino || noOutro) {
      r.excluidosAqui++;
      continue;
    } else s = escopos[destino];
    const nome = nomeDoProjeto(l);
    if (l.etapas.length > LIMITES.etapasPorProjeto) {
      r.ignorados++;
      r.foraPorEtapas.push(nome);
      continue;
    }
    const existente = s.p.get(pid);
    const ordem = existente?.ordem ?? indiceEntre(s.maiorOrdem, null);
    const lote = loteDoProjeto(mapearProjeto(l, s.c, hoje, ordem), s, pid);
    if (!lote.p.length && !lote.f.length && !lote.e.length) {
      r.iguais++;
      continue;
    }
    const teto = foraDoTeto(lote, s, pid);
    if (teto || !validos(lote, s.c.agora)) {
      r.ignorados++;
      if (teto === "projetos") r.foraPorProjetos.push(nome);
      else if (teto === "etapas") r.foraPorEtapas.push(nome);
      else r.invalidos++;
      continue;
    }
    for (const x of lote.p) s.p.set(x.id, x);
    for (const x of lote.f) s.f.set(x.id, x);
    for (const x of lote.e) s.e.set(x.id, x);
    s.lote.p.push(...lote.p);
    s.lote.f.push(...lote.f);
    s.lote.e.push(...lote.e);
    if (existente) r.atualizados++;
    else {
      s.maiorOrdem = ordem;
      s.registros.push({ alvo: pid, projeto: pid, campo: "criacao", depois: lote.p[0]?.nome ?? pid });
      r.novos++;
    }
  }
  let unidadeGravou = false;
  for (const vis of ["unidade", "eu"] as const) {
    const s = escopos[vis];
    if (!s.lote.p.length && !s.lote.f.length && !s.lote.e.length) continue;
    try {
      await s.repo.importar(s.lote, s.registros.length ? { registros: s.registros, carimbo: s.c } : undefined, { inteiro: true });
    } catch (e) {
      if (vis === "eu" && unidadeGravou) {
        const m = mensagemDoErro(e);
        throw new ErroValidacao([
          `Os projetos de “Toda a unidade” já foram importados, mas os de “Só eu” não: ${/[.!?]$/.test(m) ? m : `${m}.`} Importe de novo para completar (o que já entrou não se repete).`,
        ]);
      }
      throw e;
    }
    if (vis === "unidade") unidadeGravou = true;
  }
  return r;
}
