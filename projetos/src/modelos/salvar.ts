/**
 * "Salvar como modelo" (spec 3.2): o projeto vira um modelo com datas
 * relativas em dias úteis, contadas do primeiro dia útil da primeira etapa.
 * Aplicar o modelo de volta na mesma data devolve as mesmas datas.
 */

import { duracaoUteis, FERIADOS, proximoUtil, uteisEntre } from "../modelo/calendario";
import { compararEtapas, porOrdem } from "../modelo/operacoes";
import type { Carimbo, DataISO, Etapa, EtapaModelo, Fase, Modelo } from "../modelo/tipos";
import { nomeLimpo } from "../modelo/validacao";

export function modeloDoProjeto(
  dados: { fases: readonly Fase[]; etapas: readonly Etapa[] },
  nome: string,
  id: string,
  c: Carimbo,
  descricao?: string,
  feriados: ReadonlySet<DataISO> = FERIADOS,
): Modelo {
  const fases = dados.fases.filter((f) => f.removidoEm === undefined).sort(porOrdem);
  const indiceFase = new Map(fases.map((f, i) => [f.id, i]));
  const etapas = dados.etapas.filter((e) => e.removidoEm === undefined).sort(compararEtapas("inicio"));
  const indiceEtapa = new Map(etapas.map((e, i) => [e.id, i]));
  const base = etapas.length ? proximoUtil(etapas[0]!.inicio, feriados) : undefined;
  const lista: EtapaModelo[] = etapas.map((e) => {
    const em: EtapaModelo = {
      nome: e.nome,
      aPartirDe: base ? Math.max(0, uteisEntre(base, proximoUtil(e.inicio, feriados), feriados)) : 0,
      duracao: e.marco ? 0 : Math.max(1, duracaoUteis(e.inicio, e.fim, feriados)),
      marco: e.marco,
      dependeDe: e.dependeDe.map((d) => indiceEtapa.get(d)).filter((d): d is number => d !== undefined),
      checklist: e.checklist.map((i) => i.texto),
    };
    const f = e.fase !== undefined ? indiceFase.get(e.fase) : undefined;
    if (f !== undefined) em.fase = f;
    return em;
  });
  const m: Modelo = {
    id,
    nome: nomeLimpo(nome),
    fases: fases.map((f) => f.nome),
    etapas: lista,
    criadoEm: c.agora,
    atualizadoEm: c.agora,
    dispositivo: c.dispositivo,
  };
  if (descricao?.trim()) m.descricao = descricao.trim();
  if (c.por) m.alteradoPor = c.por;
  return m;
}
