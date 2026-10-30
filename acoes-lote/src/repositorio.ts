import type { Area } from "@comum/armazenamento/area";
import { PREFIXO_STORAGE } from "./modelo/constantes";
import type { LoteAcoes } from "./modelo/fila";

/** Um lote em andamento por processo, para retomar depois de fechar a janela. Nunca guarda senha (o tipo não a tem). */
export class RepositorioAcoes {
  private readonly prefixo: string;
  constructor(
    private readonly area: Area,
    host: string,
    login: string,
  ) {
    this.prefixo = `${PREFIXO_STORAGE}andamento/${host}|${login}/`;
  }

  private chave(idProcedimento: string): string {
    return this.prefixo + idProcedimento;
  }

  salvar(l: LoteAcoes): Promise<void> {
    return this.area.gravar({ [this.chave(l.idProcedimento)]: l });
  }

  async doProcesso(idProcedimento: string): Promise<LoteAcoes | null> {
    const k = this.chave(idProcedimento);
    const v = (await this.area.obter(k))[k];
    // Registro cortado ou de outra versão não pode derrubar quem retoma: vira "sem lote".
    const o = v as Partial<LoteAcoes> | null | undefined;
    return o && typeof o === "object" && typeof o.id === "string" && Array.isArray(o.planos) ? (o as LoteAcoes) : null;
  }

  /** Remove o lote com esse id, onde estiver (a chave é por processo; o id só se acha olhando os registros). */
  async descartar(id: string): Promise<void> {
    const todos = await this.area.obter(null);
    const achadas = Object.entries(todos)
      .filter(([k, v]) => k.startsWith(this.prefixo) && (v as LoteAcoes | null)?.id === id)
      .map(([k]) => k);
    if (achadas.length) await this.area.remover(achadas);
  }
}
