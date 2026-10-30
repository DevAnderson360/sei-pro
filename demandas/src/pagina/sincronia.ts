/**
 * Sincronia por Texto Padrão do lado da aba do SEI: é o orquestrador da D6 (`sincronia/orquestrador.ts`: os três
 * textos por escopo). Este módulo só o reexporta para a página, que fixa o `puxar` por tela (o Controle de Processos
 * lê; as outras telas só enviam o que mudou).
 */

export {
  type DepsLigarSincronia,
  INTERVALO_PUXAR,
  ligarSincronia,
  type ResultadoSincronizar,
  SincroniaDemandas,
} from "../sincronia/orquestrador";
