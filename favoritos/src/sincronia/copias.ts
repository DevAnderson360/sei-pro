/**
 * Cópias diárias (spec 9.4): uma por dia, de todas as listas do usuário, no
 * IndexedDB da extensão (banco "seipro-favoritos"); ficam as 14 mais recentes.
 * A mecânica é a genérica da sei-comum (`@comum/sincronia/copias`); aqui fica
 * o envelope dos favoritos.
 *
 * Restaurar não "volta no tempo" apagando o que veio depois: traz de volta o
 * que estava ATIVO na cópia, com carimbo novo para vencer remoções posteriores,
 * e deixa em paz o que entrou depois dela.
 */

import type { Area } from "@comum/armazenamento/area";
import type { DataISO } from "@comum/datas/dias";
import {
  type ArmazemCopias as ArmazemCopiasComum,
  type Copia as CopiaComum,
  copiasEmMemoria as copiasEmMemoriaComum,
  copiasNoIndexedDB as copiasNoBanco,
  type Dono,
  fazerCopiaDoDia as fazerCopiaComum,
  recarimbarAtivos,
} from "@comum/sincronia/copias";
import { type Envelope, exportarTudo, importarEnvelope } from "../arquivo";
import type { Carimbo } from "../modelo/tipos";

export { type Dono, MAX_COPIAS } from "@comum/sincronia/copias";
export type Copia = CopiaComum<Envelope>;
export type ArmazemCopias = ArmazemCopiasComum<Envelope>;

export function fazerCopiaDoDia(area: Area, dono: Dono, armazem: ArmazemCopias, hoje: DataISO, c: Carimbo): Promise<boolean> {
  return fazerCopiaComum(armazem, dono, hoje, c.agora, async () => {
    const envelope = await exportarTudo(area, dono.host, dono.login, c);
    const quantidade = envelope.escopos.reduce((n, e) => n + e.favoritos.filter((f) => f.removidoEm === undefined).length, 0);
    return { envelope, quantidade };
  });
}

export async function restaurarCopia(area: Area, copia: Copia, carimbo: () => Carimbo, dono: Dono): Promise<{ restaurados: number }> {
  const c = carimbo();
  const env: Envelope = {
    ...copia.envelope,
    escopos: copia.envelope.escopos.map((e) => ({
      ...e,
      favoritos: recarimbarAtivos(e.favoritos, c),
      pastas: recarimbarAtivos(e.pastas, c),
      etiquetas: recarimbarAtivos(e.etiquetas, c),
    })),
  };
  const r = await importarEnvelope(area, env, () => c, dono);
  return { restaurados: r.novos + r.atualizados };
}

/** Para os testes (e como recuo quando o IndexedDB falha). */
export const copiasEmMemoria = (): ArmazemCopias => copiasEmMemoriaComum<Envelope>();

/** IndexedDB da extensão, banco "seipro-favoritos", depósito "copias" (o mesmo de sempre). */
export const copiasNoIndexedDB = (nome = "seipro-favoritos"): ArmazemCopias => copiasNoBanco<Envelope>(nome);
