/**
 * Ponto de extensão da sincronia (P4). O app só mostra o estado ao lado das
 * abas e redesenha quando ele muda; quem sincroniza (Texto Padrão, arquivo) é
 * o provedor. No P3 não há provedor: os projetos ficam neste navegador.
 */

export type TomSincronia = "local" | "ok" | "pendente" | "erro";

export interface EstadoSincronia {
  /** Texto curto ao lado das abas ("sincronizado", "pendente", "erro"). */
  rotulo: string;
  /** Dica (title) com o detalhe. */
  dica: string;
  tom: TomSincronia;
}

export interface ProvedorSincronia {
  estado(): EstadoSincronia;
  /** Avisa quando o estado muda; devolve a função de parar. */
  aoMudar(cb: () => void): () => void;
}

export const SEM_SINCRONIA: ProvedorSincronia = {
  estado: () => ({
    rotulo: "neste navegador",
    dica: "Os projetos ficam guardados neste navegador.",
    tom: "local",
  }),
  aoMudar: () => () => undefined,
};
