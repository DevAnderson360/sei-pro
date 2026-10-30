/**
 * Histórico de alterações (spec 5.4): cada edição local vira registros por
 * campo relevante. Os valores são texto (datas em "AAAA-MM-DD"; a tela formata).
 * Processo sigiloso entra como "processo sigiloso": o registro vai para o
 * Texto Padrão da unidade e o número não pode ir junto. O documento que só
 * tem o marcador do texto (documento de processo sigiloso sem o número) entra
 * como "documento de processo sigiloso", nunca vazio. O registro nasce dentro
 * dos tetos que a importação de um colega aceita (`entidadeValida`): cada lado
 * até `LIMITES.registroValor`, quem gravou até `LIMITES.rotulo`.
 */

import { purgarLapides, type Versionada } from "@comum/sincronia/entidade";
import { LIMITES } from "./constantes";
import { documentoSemNumero, SIGILOSO_DOCUMENTO, SIGILOSO_PROCESSO } from "./sigilo";
import type { CampoHistorico, Carimbo, DocumentoSei, Etapa, Fase, Projeto, Registro, Vinculo } from "./tipos";
import { chaveProtocolo } from "./vinculos";

export interface RegistroNovo {
  alvo: string;
  projeto: string;
  campo: CampoHistorico;
  antes?: string;
  depois?: string;
}

export interface ApoioHistorico {
  nomeDaFase(id: string): string | undefined;
  nomeDaEtapa(id: string): string | undefined;
}

export const SEM_APOIO: ApoioHistorico = { nomeDaFase: () => undefined, nomeDaEtapa: () => undefined };

/** Corta com "…" sem partir um caractere em dois: o par de substitutos de um emoji fica inteiro ou sai. */
export function cortarTexto(t: string, max: number): string {
  if (t.length <= max) return t;
  const c = t.charCodeAt(max - 2);
  const fim = c >= 0xd800 && c <= 0xdbff ? max - 2 : max - 1;
  return `${t.slice(0, fim)}…`;
}

export function textoDoVinculo(v: Vinculo | undefined): string | undefined {
  if (!v) return undefined;
  return v.sigiloso ? SIGILOSO_PROCESSO : v.protocolo || undefined;
}

/** O número do documento; o marcador do texto vira o texto fixo; o número vazio sem a marca é "sem documento". */
const textoDoDocumento = (d: DocumentoSei | undefined): string | undefined =>
  documentoSemNumero(d) ? SIGILOSO_DOCUMENTO : d?.numero || undefined;

const chaveDoVinculo = (v: Vinculo | undefined): string => (v && typeof v.protocolo === "string" ? chaveProtocolo(v.protocolo) : "");

/**
 * Antes e depois do registro "processo". Se um dos lados é sigiloso e os dois são o mesmo processo
 * (mesma `chaveProtocolo`) ou um deles não tem número (chegou vazio, foi tirado), os dois lados viram
 * "processo sigiloso": marcar como sigiloso um vínculo que já existia não pode levar o número no
 * `antes` (nem desmarcar, no `depois`). Iguais, o registro nem nasce. Processos diferentes mostram
 * o número do que não é sigiloso.
 */
export function textosDoVinculo(antes: Vinculo | undefined, depois: Vinculo | undefined): [string | undefined, string | undefined] {
  const textos: [string | undefined, string | undefined] = [textoDoVinculo(antes), textoDoVinculo(depois)];
  if (!antes?.sigiloso && !depois?.sigiloso) return textos;
  const a = chaveDoVinculo(antes);
  const d = chaveDoVinculo(depois);
  if (a !== d && a && d) return textos;
  return [antes ? SIGILOSO_PROCESSO : undefined, depois ? SIGILOSO_PROCESSO : undefined];
}

function ciclo<T extends { removidoEm?: number }>(
  antes: T | undefined,
  depois: T | undefined,
  alvo: string,
  projeto: string,
  nome: (x: T) => string,
): RegistroNovo[] | null {
  if (!antes && depois) return [{ alvo, projeto, campo: "criacao", depois: nome(depois) }];
  if (antes && depois && antes.removidoEm === undefined && depois.removidoEm !== undefined)
    return [{ alvo, projeto, campo: "exclusao", antes: nome(antes) }];
  if (antes && depois && antes.removidoEm !== undefined && depois.removidoEm === undefined)
    return [{ alvo, projeto, campo: "restauracao", depois: nome(depois) }];
  if (!antes || !depois) return [];
  return null;
}

function campo(saida: RegistroNovo[], alvo: string, projeto: string, c: CampoHistorico, antes?: string, depois?: string): void {
  if ((antes ?? "") !== (depois ?? "")) saida.push({ alvo, projeto, campo: c, antes, depois });
}

export function registrosDeEtapa(antes: Etapa | undefined, depois: Etapa | undefined, apoio: ApoioHistorico = SEM_APOIO): RegistroNovo[] {
  const ref = depois ?? antes;
  if (!ref) return [];
  const pronto = ciclo(antes, depois, ref.id, ref.projeto, (e) => e.nome);
  if (pronto) return pronto;
  const a = antes!;
  const d = depois!;
  const saida: RegistroNovo[] = [];
  const reg = (c: CampoHistorico, x?: string, y?: string) => campo(saida, d.id, d.projeto, c, x, y);
  reg("nome", a.nome, d.nome);
  reg("inicio", a.inicio, d.inicio);
  if (!d.marco) reg("fim", a.fim, d.fim);
  reg("responsavel", a.responsavel?.nome, d.responsavel?.nome);
  reg("conclusao", a.concluidaEm, d.concluidaEm);
  if (d.medida === "manual" && a.progresso !== d.progresso) reg("progresso", String(a.progresso), String(d.progresso));
  const nomeFase = (id?: string) => (id ? (apoio.nomeDaFase(id) ?? "") : undefined);
  reg("fase", nomeFase(a.fase), nomeFase(d.fase));
  const deps = (ids: string[]) =>
    ids.length
      ? ids
          .map((id) => apoio.nomeDaEtapa(id) ?? id)
          .sort((x, y) => x.localeCompare(y, "pt-BR"))
          .join("; ")
      : undefined;
  if ([...a.dependeDe].sort().join() !== [...d.dependeDe].sort().join()) reg("dependencias", deps(a.dependeDe), deps(d.dependeDe));
  reg("processo", ...textosDoVinculo(a.processo, d.processo));
  reg("documento", textoDoDocumento(a.documento), textoDoDocumento(d.documento));
  const datasIguais = a.inicio === d.inicio && a.fim === d.fim;
  const textoBase = (e: Etapa) => (e.base ? `${e.base.inicio}/${e.base.fim}` : undefined);
  if (datasIguais) reg("base", textoBase(a), textoBase(d));
  return saida;
}

export function registrosDeProjeto(antes: Projeto | undefined, depois: Projeto | undefined): RegistroNovo[] {
  const ref = depois ?? antes;
  if (!ref) return [];
  const pronto = ciclo(antes, depois, ref.id, ref.id, (p) => p.nome);
  if (pronto) return pronto;
  const a = antes!;
  const d = depois!;
  const saida: RegistroNovo[] = [];
  campo(saida, d.id, d.id, "nome", a.nome, d.nome);
  campo(saida, d.id, d.id, "processo", ...textosDoVinculo(a.processo, d.processo));
  if ((a.arquivadoEm === undefined) !== (d.arquivadoEm === undefined))
    saida.push({ alvo: d.id, projeto: d.id, campo: "arquivamento", depois: d.arquivadoEm === undefined ? "reativado" : "arquivado" });
  return saida;
}

export function registrosDeFase(antes: Fase | undefined, depois: Fase | undefined): RegistroNovo[] {
  const ref = depois ?? antes;
  if (!ref) return [];
  const pronto = ciclo(antes, depois, ref.id, ref.projeto, (f) => f.nome);
  if (pronto) return pronto;
  const saida: RegistroNovo[] = [];
  campo(saida, ref.id, ref.projeto, "nome", antes!.nome, depois!.nome);
  return saida;
}

/** Os registros novos com o carimbo e dentro dos tetos da importação (o lado longo e quem gravou, cortados). */
export function carimbarRegistros(novos: readonly RegistroNovo[], c: Carimbo, novoId: () => string): Registro[] {
  const lado = (t: string | undefined) => (t === undefined ? undefined : cortarTexto(t, LIMITES.registroValor));
  const quem = (t: string) => cortarTexto(t, LIMITES.rotulo);
  return novos.map((r) => {
    const reg: Registro = {
      id: novoId(),
      ...r,
      antes: lado(r.antes),
      depois: lado(r.depois),
      quando: c.agora,
      por: quem(c.por ?? ""),
      atualizadoEm: c.agora,
      dispositivo: c.dispositivo,
    };
    if (c.nome) reg.nome = quem(c.nome);
    if (c.por) reg.alteradoPor = quem(c.por);
    if (reg.antes === undefined) delete reg.antes;
    if (reg.depois === undefined) delete reg.depois;
    return reg;
  });
}

/**
 * Os projetos que dão sentido a fases, etapas e registros: os vivos e os com lápide dentro do prazo (`dias`, a poda
 * do texto). Fora deles, o item é órfão: o texto não o leva, o corte dos 300 registros não o conta e o `limpar` o
 * tira. É um predicado só para o texto e para os cortes daqui: se um contasse o órfão e o outro não, o corte de quem
 * o tem e o de quem chegou depois discordariam, e o texto iria e voltaria.
 */
export function projetosQueFicam(projetos: readonly Versionada[], agora: number, dias: number): ReadonlySet<string> {
  return new Set(purgarLapides([...projetos], agora, dias).map((p) => p.id));
}

/**
 * Além disso, adiante de `agora`, o registro é "do futuro" para o corte: maior que qualquer diferença plausível entre
 * relógios (o de um colega 1,5 dia adiantado, ou o próprio, adiantado e depois corrigido, não pode mudar o corte, ou
 * o de quem tem o registro e o de quem não tem discordam e o texto vai e volta). Só o texto editado à mão passa disso.
 */
const HORIZONTE_FUTURO_MS = 30 * 86_400_000;

/**
 * Os `limite` mais recentes ficam; os ids dos outros saem (sem lápide: o histórico só acrescenta). Com `agora`, o
 * registro "do futuro" (`quando` ou `atualizadoEm` além de `agora` + `HORIZONTE_FUTURO_MS`: um relógio adiantado ou um
 * texto editado à mão) conta como o mais antigo: não empurra os registros de verdade para fora.
 */
export function excedentes(registros: readonly Registro[], limite: number, agora?: number): string[] {
  const vivos = registros.filter((r) => r.removidoEm === undefined);
  if (vivos.length <= limite) return [];
  const teto = agora === undefined ? Number.POSITIVE_INFINITY : agora + HORIZONTE_FUTURO_MS;
  const chave = (r: Registro) => (r.quando > teto || r.atualizadoEm > teto ? Number.NEGATIVE_INFINITY : r.quando);
  const ordenados = [...vivos].sort((x, y) => {
    const a = chave(x);
    const b = chave(y);
    if (a !== b) return a < b ? 1 : -1;
    return x.id < y.id ? -1 : x.id > y.id ? 1 : 0;
  });
  return ordenados.slice(limite).map((r) => r.id);
}
