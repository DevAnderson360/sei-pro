/** As ações em lote e a tabela de suas propriedades (ordem da seção 5 da spec). */

export type AcaoId =
  | "ciencia"
  | "excluir"
  | "cancelar-assinatura"
  | "baixar"
  | "alterar-nivel"
  | "assinar"
  | "duplicar"
  | "cancelar-documento"
  | "incluir-bloco"
  | "alterar-dados"
  | "mover"
  | "pdf";

export interface DefAcao {
  id: AcaoId;
  rotulo: string;
  /** Grava algo no SEI (baixar e PDF só leem). */
  escreve: boolean;
  /** Não tem volta. */
  destrutiva: boolean;
  /** Só pode ser a última etapa da fila. */
  final: boolean;
  /** Pede confirmação com a contagem depois da prévia. */
  confirmar: boolean;
}

function def(id: AcaoId, rotulo: string, o: Partial<Omit<DefAcao, "id" | "rotulo">> = {}): DefAcao {
  return { id, rotulo, escreve: true, destrutiva: false, final: false, confirmar: false, ...o };
}

export const ACOES: readonly DefAcao[] = [
  def("ciencia", "Dar ciência"),
  def("excluir", "Excluir", { destrutiva: true, final: true, confirmar: true }),
  def("cancelar-assinatura", "Cancelar assinatura", { destrutiva: true, confirmar: true }),
  def("baixar", "Baixar", { escreve: false, final: true }),
  def("alterar-nivel", "Alterar nível de acesso"),
  def("assinar", "Assinar"),
  def("duplicar", "Duplicar"),
  def("cancelar-documento", "Cancelar documento", { destrutiva: true, final: true, confirmar: true }),
  def("incluir-bloco", "Incluir em bloco de assinatura"),
  def("alterar-dados", "Alterar dados"),
  def("mover", "Mover para outro processo", { destrutiva: true, final: true, confirmar: true }),
  def("pdf", "Baixar tudo num PDF", { escreve: false, final: true }),
];
