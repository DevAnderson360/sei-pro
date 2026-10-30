/**
 * Contrato do schema das opcoes. Os dados ficam em schema-dados.ts.
 *
 * `nome` e o data-name gravado em dataValues; o id do controle e
 * "itemConfigGeral_" + nome (contrato com o storage e com favoritos/opcoes).
 */
import { OPCOES_COMPLEMENTOS, SECOES_GERAL } from "./schema-dados";

export type TipoControle = "chave" | "texto" | "numero" | "selecao";

export interface Dependencia {
  /** `nome` da chave de que a linha depende. */
  de: string;
  /** Valor da chave pai com que a linha aparece. */
  quando: boolean;
  /** Ao esconder por esta regra, a linha volta ao vazio/desmarcado (o legado fazia isso em 2 casos). */
  limparAoEsconder?: boolean;
}

export interface Escolha {
  valor: string;
  rotulo: string;
}

export interface Opcao {
  nome: string;
  rotulo: string;
  /** Dica curta, mostrada como title do rotulo. */
  ajuda?: string;
  tipo: TipoControle;
  /** Classes do Font Awesome, sem cor (a cor vem do estado ligado/desligado). */
  icone: string;
  /** Slug de /pages/ (ex.: "FAVORITOS") ou URL absoluta. */
  manual?: string;
  padrao?: boolean | string | number;
  dependencias?: Dependencia[];
  /** Escondida sempre, mas ainda coletada e gravada. */
  oculta?: boolean;
  visivelEm?: "lab" | "fora-antaq";
  min?: number;
  max?: number;
  maxLength?: number;
  escolhas?: Escolha[];
}

export interface Secao {
  id: string;
  titulo: string;
  opcoes: Opcao[];
}

export { OPCOES_COMPLEMENTOS, SECOES_GERAL };

/** Geral (na ordem das secoes) e depois Complementos. */
export function todasAsOpcoes(): Opcao[] {
  return [...SECOES_GERAL.flatMap((s) => s.opcoes), ...OPCOES_COMPLEMENTOS];
}
