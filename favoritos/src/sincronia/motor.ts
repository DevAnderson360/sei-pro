/**
 * Motor da sincronia da lista DA UNIDADE com o Texto Padrão (spec 9.1). O
 * motor é o genérico da sei-comum (`@comum/sincronia/motor`); aqui fica o
 * adaptador dos favoritos: o envelope de um escopo, a mesclagem do
 * repositório, a assinatura e as mensagens de sempre.
 *
 * Sem releitura antes de gravar (`releituras: 0`): o texto é de UMA pessoa, e
 * o comportamento (e as provas) dos Favoritos ficam exatamente como eram.
 */

import type { Area } from "@comum/armazenamento/area";
import { type AdaptadorTexto, type DestinoTexto, MotorTextoPadrao } from "@comum/sincronia/motor";
import type { Envelope } from "../arquivo";
import type { Carimbo, Escopo } from "../modelo/tipos";
import type { RepositorioFavoritos } from "../repositorio";
import { assinaturaEnvelope } from "./assinatura";
import { AVISO_TEXTO, envelopeDaUnidade, legivelFavoritos, TETO_TEXTO, validarEnvelopeDoTexto } from "./textoPadrao";

export { type StatusSync, textoDoErro } from "@comum/sincronia/motor";
export type DestinoSync = DestinoTexto;

export interface DepsMotor {
  repo: RepositorioFavoritos;
  escopo: Escopo;
  destino: DestinoSync;
  area: Area;
  chaveStatus: string;
  carimbo: () => Carimbo;
  nomeUsuario: string;
  /** Roda `fn` com a trava; devolve null se outra aba já está com ela. */
  travar<T>(nome: string, fn: () => Promise<T>): Promise<T | null>;
  agora?: () => number;
  teto?: number;
  atrasoEnvio?: number;
  /** Ainda pode gravar? (O usuário pode ter desligado durante a rodada.) */
  permitido?: () => Promise<boolean>;
}

export function adaptadorFavoritos(
  d: Pick<DepsMotor, "repo" | "escopo" | "carimbo" | "nomeUsuario" | "chaveStatus" | "teto">,
): AdaptadorTexto<Envelope> {
  return {
    modulo: "favoritos",
    chaveStatus: d.chaveStatus,
    teto: d.teto ?? TETO_TEXTO,
    aviso: d.teto ? d.teto * 0.8 : AVISO_TEXTO,
    legivel: () => legivelFavoritos(d.nomeUsuario),
    validar: (bruto) => validarEnvelopeDoTexto(bruto, d.escopo),
    importar: async (env) => {
      await d.repo.importar(env.escopos[0]!);
    },
    // Um sigiloso só vai (como aviso, sem número) se o texto já tinha uma cópia dele: idsRemotos.
    exportar: ({ remoto }) =>
      envelopeDaUnidade(d.repo, d.escopo, d.carimbo(), new Set((remoto?.escopos[0]?.favoritos ?? []).map((f) => f.id))),
    assinatura: assinaturaEnvelope,
    mensagens: {
      maisNovo:
        "Os monitorados no SEI foram gravados por uma versão mais nova do SEI Pro. Atualize a extensão neste computador; o texto não foi alterado.",
      grandeDemais: (kb, tetoKb) =>
        `A lista ficou grande demais para o Texto Padrão (${kb} KB de ${tetoKb} KB). Use a sincronização por arquivo.`,
      pertoDoTeto: (kb) => `A lista está perto do limite do Texto Padrão (${kb} KB).`,
    },
  };
}

export class MotorSincronia extends MotorTextoPadrao<Envelope> {
  constructor(d: DepsMotor) {
    super({
      adaptador: adaptadorFavoritos(d),
      destino: d.destino,
      area: d.area,
      travar: d.travar,
      agora: d.agora,
      atrasoEnvio: d.atrasoEnvio,
      permitido: d.permitido,
      releituras: 0,
    });
  }
}
