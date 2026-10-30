/**
 * Sincronia por arquivo (spec 9.3): um .json numa pasta que o próprio usuário
 * já sincroniza (OneDrive, Google Drive, Dropbox, rede). Leva TODAS as listas
 * do usuário, inclusive a Pessoal: é o backup completo e legível.
 *
 * A mecânica (File System Access, handle no IndexedDB, permissão, mescla,
 * regravação do ilegível) é a genérica da sei-comum (`@comum/sincronia/arquivo`);
 * aqui fica o adaptador do envelope dos favoritos.
 */

import type { Area } from "@comum/armazenamento/area";
import {
  type AdaptadorArquivo,
  type ArmazemHandles,
  type ArquivoSync,
  ControleArquivo as ControleArquivoComum,
  type HandleArquivo,
  handlesNoIndexedDB as handlesNoBanco,
  SincroniaArquivo as SincroniaArquivoComum,
} from "@comum/sincronia/arquivo";
import { type Envelope, exportarTudo, importarEnvelope, lerEnvelope } from "../arquivo";
import type { Carimbo } from "../modelo/tipos";
import { assinaturaEnvelope } from "./assinatura";
import type { Dono } from "./copias";

export {
  type ArquivoSync,
  arquivoDoHandle,
  type HandleArquivo,
  permissao,
  type StatusArquivo,
  temSeletorDeArquivo,
} from "@comum/sincronia/arquivo";

export const chaveStatusArquivo = (d: Dono): string => `favoritos/sync/arquivo/${d.host}|${d.login.toLowerCase()}`;

export function adaptadorArquivoFavoritos(area: Area, dono: Dono, carimbo: () => Carimbo): AdaptadorArquivo<Envelope> {
  return {
    formato: "seipro-favoritos",
    versao: 1,
    ler: (bruto) => lerEnvelope(bruto)?.envelope ?? null,
    importar: (env) => importarEnvelope(area, env, carimbo, dono),
    async exportar(lido) {
      const meu = await exportarTudo(area, dono.host, dono.login, carimbo());
      // Listas de outro SEI ou usuário (o mesmo arquivo escolhido em dois lugares): ficam como estão.
      const outros = (lido?.escopos ?? []).filter(
        (e) => e.escopo.host !== dono.host || e.escopo.login.toLowerCase() !== dono.login.toLowerCase(),
      );
      return { envelope: { ...meu, escopos: [...meu.escopos, ...outros] }, outros: outros.length };
    },
    assinatura: assinaturaEnvelope,
    mensagens: {
      outros: (n) => `O arquivo também tem ${n === 1 ? "uma lista" : `${n} listas`} de outro usuário ou outro SEI, que foram mantidas.`,
    },
  };
}

export class SincroniaArquivo extends SincroniaArquivoComum<Envelope> {
  constructor(d: { area: Area; dono: Dono; arquivo: ArquivoSync; carimbo: () => Carimbo; nome?: string }) {
    super({
      area: d.area,
      chaveStatus: chaveStatusArquivo(d.dono),
      arquivo: d.arquivo,
      nome: d.nome,
      adaptador: adaptadorArquivoFavoritos(d.area, d.dono, d.carimbo),
    });
  }
}

/** O handle fica no IndexedDB da extensão, banco "seipro-favoritos" (o mesmo de sempre). */
export const handlesNoIndexedDB = (nome = "seipro-favoritos"): ArmazemHandles => handlesNoBanco(nome);

export interface DepsControleArquivo {
  area: Area;
  dono: Dono;
  handles: ArmazemHandles;
  /** Seletor do navegador (precisa de gesto do usuário): "novo" = Salvar como, "existente" = Abrir. */
  escolher(modo: "novo" | "existente"): Promise<HandleArquivo | null>;
  carimbo: () => Carimbo;
  atraso?: number;
}

/** O arquivo no app: escolher, reconectar, sincronizar ao abrir/ganhar foco e 15 s depois de mudar. */
export class ControleArquivo extends ControleArquivoComum<Envelope> {
  constructor(d: DepsControleArquivo) {
    super({
      area: d.area,
      dono: d.dono,
      chaveStatus: chaveStatusArquivo(d.dono),
      handles: d.handles,
      escolher: d.escolher,
      atraso: d.atraso,
      adaptador: adaptadorArquivoFavoritos(d.area, d.dono, d.carimbo),
    });
  }
}
