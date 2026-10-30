/**
 * Sincronia por Texto Padrão, do lado da aba do SEI (o content script tem a
 * sessão). O controle é o genérico da sei-comum (`@comum/sincronia/controlePagina`),
 * com o adaptador dos favoritos e o consentimento DESTA unidade
 * (`estadoTextoPadrao`), que o usuário decide no app:
 * - ao carregar o Controle de Processos, puxa (no máximo a cada 5 min);
 * - qualquer mudança na lista da unidade, feita aqui, no app ou em outra aba,
 *   é enviada 15 s depois;
 * - o app pede "sincronizar agora" e "apagar meus dados do SEI" pela ponte.
 */

import type { Area } from "@comum/armazenamento/area";
import { type ArmazemTexto, ControleTextoPadrao } from "@comum/sincronia/controlePagina";
import type { Envelope } from "../arquivo";
import { CHAVE_PREFERENCIAS } from "../modelo/constantes";
import { chaveEscopo } from "../modelo/escopo";
import type { Carimbo, ContextoAba, Escopo } from "../modelo/tipos";
import { definirTextoPadrao, estadoTextoPadrao, lerPreferencias } from "../preferencias";
import type { RepositorioFavoritos } from "../repositorio";
import { adaptadorFavoritos, type StatusSync } from "../sincronia/motor";

export { ocultarTextosInternos } from "@comum/sincronia/controlePagina";
export type ArmazemDestino = ArmazemTexto;

export const chaveStatusTexto = (e: Escopo): string => `favoritos/sync/tp/${chaveEscopo(e)}`;

export interface DepsControle {
  ctx: ContextoAba;
  area: Area;
  sync: Area;
  repo: RepositorioFavoritos;
  escopo: Escopo;
  armazem: () => ArmazemDestino;
  carimbo: () => Carimbo;
  travar<T>(nome: string, fn: () => Promise<T>): Promise<T | null>;
  /** A mesma trava, mas ESPERANDO a vez (o "apagar" não pode ser pulado). */
  travarEsperando?<T>(nome: string, fn: () => Promise<T>): Promise<T>;
  atrasoEnvio?: number;
}

export class ControleSincronia {
  private readonly controle: ControleTextoPadrao<Envelope>;

  constructor(d: DepsControle) {
    const idUnidade = d.escopo.unidade?.id ?? "";
    this.controle = new ControleTextoPadrao<Envelope>({
      area: d.area,
      adaptador: adaptadorFavoritos({
        repo: d.repo,
        escopo: d.escopo,
        carimbo: d.carimbo,
        nomeUsuario: d.ctx.nome || d.ctx.login,
        chaveStatus: chaveStatusTexto(d.escopo),
      }),
      armazem: d.armazem,
      consentimento: {
        estado: async () => estadoTextoPadrao(await lerPreferencias(d.sync), d.ctx.host, d.ctx.login, idUnidade),
        definir: (valor) => definirTextoPadrao(d.sync, d.ctx.host, d.ctx.login, idUnidade, valor),
        aoMudar: (cb) =>
          d.sync.aoMudar((m) => {
            if (CHAVE_PREFERENCIAS in m) cb();
          }),
      },
      aoMudarLocal: (cb) => d.repo.aoMudar(cb),
      travar: d.travar,
      travarEsperando: d.travarEsperando,
      atrasoEnvio: d.atrasoEnvio,
      // Um texto por pessoa: sem releitura antes de gravar (o comportamento de sempre).
      releituras: 0,
    });
  }

  iniciar(tela: string | null): Promise<void> {
    return this.controle.iniciar({ puxar: tela === "caixa" });
  }

  /** "Sincronizar agora", pedido pelo app. */
  agora(): Promise<StatusSync> {
    return this.controle.agora();
  }

  /** "Apagar meus dados do SEI desta unidade": exclui o texto e desliga a sincronia. */
  apagar(): Promise<boolean> {
    return this.controle.apagar();
  }

  parar(): void {
    this.controle.parar();
  }
}
