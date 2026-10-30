/**
 * Consentimento da sincronia por Texto Padrão: de cada PESSOA em cada UNIDADE
 * de cada SEI (`host|login|idUnidade`), porque o texto fica visível para aquela
 * unidade. Ligar numa unidade não liga nas outras, e outro usuário do SEI no
 * mesmo perfil do navegador não herda o "ligado". Módulo com mais de um texto
 * por unidade (Projetos: o da unidade e o pessoal) acrescenta o texto à chave.
 *
 * O mapa mora num campo do objeto de preferências do módulo (os Favoritos usam
 * `textoPadraoUnidades` em `favoritos/preferencias`, no storage.sync).
 */

import type { Area } from "../armazenamento/area";

export type EstadoConsentimento = "nao-perguntado" | "ligado" | "desligado";
export type MapaConsentimento = Record<string, "ligado" | "desligado">;

/** A porta que o controle da página usa: o módulo decide onde o consentimento mora. */
export interface PortaConsentimento {
  estado(): Promise<EstadoConsentimento>;
  definir(valor: "ligado" | "desligado"): Promise<unknown>;
  /** Avisa quando o consentimento PODE ter mudado (quem ouve relê o estado). */
  aoMudar(cb: () => void): () => void;
}

export function chaveConsentimento(host: string, login: string, idUnidade: string, texto?: string): string {
  const base = `${host}|${login.trim().toLowerCase()}|${idUnidade}`;
  return texto ? `${base}|${texto}` : base;
}

export function estadoConsentimento(mapa: Readonly<MapaConsentimento> | undefined, chave: string): EstadoConsentimento {
  return mapa?.[chave] ?? "nao-perguntado";
}

type Objeto = Record<string, unknown>;
const objeto = (v: unknown): Objeto => (v && typeof v === "object" && !Array.isArray(v) ? (v as Objeto) : {});

export async function lerConsentimento(area: Area, chavePreferencias: string, campo: string, chave: string): Promise<EstadoConsentimento> {
  const prefs = objeto((await area.obter(chavePreferencias))[chavePreferencias]);
  return estadoConsentimento(objeto(prefs[campo]) as MapaConsentimento, chave);
}

/** Grava só esta chave do mapa; o resto das preferências fica como estava. */
export async function definirConsentimento(
  area: Area,
  chavePreferencias: string,
  campo: string,
  chave: string,
  valor: "ligado" | "desligado",
): Promise<void> {
  const prefs = objeto((await area.obter(chavePreferencias))[chavePreferencias]);
  await area.gravar({ [chavePreferencias]: { ...prefs, [campo]: { ...objeto(prefs[campo]), [chave]: valor } } });
}

export function consentimentoNaArea(o: { area: Area; chavePreferencias: string; campo: string; chave: string }): PortaConsentimento {
  return {
    estado: () => lerConsentimento(o.area, o.chavePreferencias, o.campo, o.chave),
    definir: (valor) => definirConsentimento(o.area, o.chavePreferencias, o.campo, o.chave, valor),
    aoMudar: (cb) =>
      o.area.aoMudar((m) => {
        if (o.chavePreferencias in m) cb();
      }),
  };
}
