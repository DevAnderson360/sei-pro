/**
 * A configuração que muda FORA do diálogo aberto (o backup em arquivo trouxe
 * outra, ou outra janela gravou): os campos do diálogo e o motor acompanham.
 *
 * Sem isto, Importar (ou "Usar arquivo existente") dentro do diálogo
 * deixava os campos com a config velha, e o "Salvar" a remontava inteira a
 * partir deles: o hash mudava, o carimbo virava `agora` e a config velha
 * vencia no arquivo e no `storage.sync` — num computador novo sem chave, em
 * que o diálogo é obrigatório, isso desfazia a importação logo no começo.
 */

import type { Config } from "./main";

export interface CampoDaConfig {
  /** O que o campo mostra agora. */
  ler(): string | boolean;
  escrever(v: string | boolean): void;
  /** O que o campo mostraria para esta config. */
  de(c: Config): string | boolean;
}

/**
 * Troca o valor dos campos que o usuário NÃO mexeu — os que ainda mostram a
 * config `mostrada` — pelo da `nova`. O que o usuário digitou fica (é edição
 * dele, e o "Salvar" a grava). Devolve quantos campos trocaram.
 */
export function recarregarIntocados(campos: readonly CampoDaConfig[], mostrada: Config, nova: Config): number {
  let trocados = 0;
  for (const campo of campos) {
    const antes = campo.de(mostrada);
    const depois = campo.de(nova);
    if (antes === depois || campo.ler() !== antes) continue;
    campo.escrever(depois);
    trocados++;
  }
  return trocados;
}

/** O que o motor lê da config: mudou algum, o motor é refeito. */
const DO_MOTOR: ReadonlyArray<keyof Config> = ["servico", "url", "chave", "modelo", "modeloAuxiliar", "auxiliaresMaxParalelo", "auxiliaresMaxPassos", "instrucoes", "ajustes", "cache", "nomes", "cnpj", "limites", "memoria"];

export function mudouParaOMotor(antes: Config, depois: Config): boolean {
  return DO_MOTOR.some((k) => JSON.stringify(antes[k]) !== JSON.stringify(depois[k]));
}
