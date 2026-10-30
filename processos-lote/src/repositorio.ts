import type { Area } from "@comum/armazenamento/area";
import { TETO } from "./modelo/constantes";
import type { LinhaLote } from "./modelo/linhas";

export interface Parametros {
  idTipo: string;
  nomeTipo: string;
  nivelAcesso: "0" | "1";
  hipoteseLegal: string;
  nomeHipotese: string;
  pausa: number;
}

export interface Criado {
  numero: string;
  idProcedimento: string;
  url: string;
}

export interface LoteEmAndamento {
  id: string;
  host: string;
  login: string;
  iniciadoEm: number;
  /**
   * Ultima escrita (ms), de `gravar` ou de `marcar`. Registro antigo sem o campo conta como 0 (parado ha muito).
   * Serve para o app desconfiar de um lote que pode estar rodando em OUTRA aba do SEI.
   */
  atualizadoEm?: number;
  parametros: Parametros;
  linhas: LinhaLote[];
  /**
   * `aviso` e `incerto` acompanham um "ok": o SEI pode nao ter confirmado (incerto, com numero provisorio) ou ter
   * criado sem devolver o numero. Os dois sao "ok" de proposito: nada que talvez exista no SEI e repetido.
   */
  itens: Array<{ situacao: "pendente" | "ok" | "erro"; criado?: Criado; erro?: string; aviso?: string; incerto?: boolean }>;
}

type Item = LoteEmAndamento["itens"][number];

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);

function itemValido(i: unknown): boolean {
  if (!ehObjeto(i)) return false;
  if (i.situacao !== "pendente" && i.situacao !== "ok" && i.situacao !== "erro") return false;
  if (i.criado !== undefined) {
    if (!ehObjeto(i.criado) || typeof i.criado.numero !== "string") return false;
  }
  // Uma linha so conta como criada depois da resposta com numero: "ok" sem isso refaria ou perderia o processo.
  if (i.situacao === "ok") {
    const c = i.criado as Record<string, unknown> | undefined;
    if (!c?.numero || typeof c.idProcedimento !== "string") return false;
  }
  return true;
}

/** Dado gravado por versao antiga, editado ou cortado nao pode derrubar o app: o que nao fecha vira "sem lote". */
function loteValido(v: unknown): v is LoteEmAndamento {
  if (!ehObjeto(v)) return false;
  const p = v.parametros;
  if (!ehObjeto(p) || typeof p.idTipo !== "string" || !p.idTipo) return false;
  if (p.nivelAcesso !== "0" && p.nivelAcesso !== "1") return false;
  if (typeof p.pausa !== "number" || !Number.isFinite(p.pausa)) return false;
  if (!Array.isArray(v.itens) || !Array.isArray(v.linhas)) return false;
  if (v.linhas.length > TETO || v.itens.length !== v.linhas.length) return false;
  if (!v.linhas.every((l) => ehObjeto(l) && typeof l.especificacao === "string")) return false;
  return v.itens.every(itemValido);
}

/**
 * Um lote em andamento por `host|login`: e o que o app oferece como "Continuar de onde parou".
 * As escritas desta instancia sao enfileiradas (read-modify-write do `marcar` nao se perde). Escritores de OUTRA
 * instancia ou aba NAO sao serializados: assume-se um unico escritor por escopo; a releitura estreita essa janela,
 * mas nao a fecha.
 */
export class RepositorioLote {
  private readonly chave: string;
  private fila: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly area: Area,
    escopo: string,
    private readonly agora: () => number = Date.now,
  ) {
    const i = escopo.indexOf("|");
    if (!(i > 0 && i < escopo.length - 1)) throw new Error(`escopo invalido (esperado host|login): "${escopo}"`);
    this.chave = `lote/${escopo}/atual`;
  }

  /** Encadeia sem quebrar a fila apos um erro; quem chamou ainda recebe o proprio resultado ou erro. */
  private enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
    const r = this.fila.then(tarefa, tarefa);
    this.fila = r.catch(() => undefined);
    return r;
  }

  gravar(l: LoteEmAndamento): Promise<void> {
    return this.enfileirar(() => this.area.gravar({ [this.chave]: { ...l, atualizadoEm: this.agora() } }));
  }

  /** `atualizadoEm` ausente ou ilegivel volta como 0: o lote nao e recusado, so tido como parado ha muito. */
  async ler(): Promise<LoteEmAndamento | null> {
    const v = (await this.area.obter(this.chave))[this.chave];
    if (!loteValido(v)) return null;
    const t = v.atualizadoEm;
    return { ...v, atualizadoEm: typeof t === "number" && Number.isFinite(t) ? t : 0 };
  }

  /**
   * Rele antes de gravar e muda so o indice pedido; chamadas desta instancia rodam em fila.
   *
   * Devolve `false` (sem gravar) quando o registro sumiu (descartado, talvez por outra aba), o indice nao existe ou,
   * com `idDoLote`, o registro e de OUTRO lote (assumido por outra aba). Quem esta executando trata `false` como
   * "parar ja": sem a gravacao nao ha POST. Erro de armazenamento continua chegando como rejeicao.
   */
  marcar(indice: number, item: Item, idDoLote?: string): Promise<boolean> {
    return this.enfileirar(async () => {
      const atual = await this.ler();
      if (!atual || indice < 0 || indice >= atual.itens.length) return false;
      if (idDoLote !== undefined && atual.id !== idDoLote) return false;
      const itens = atual.itens.slice();
      itens[indice] = item;
      await this.area.gravar({ [this.chave]: { ...atual, itens, atualizadoEm: this.agora() } });
      return true;
    });
  }

  /**
   * Retomada: troca o `id` do lote gravado (se ainda for `idEsperado`) e devolve o registro fresco. Outra aba que
   * ainda execute o lote antigo passa a receber `false` do `marcar` e para antes do proximo POST.
   *
   * Nao e atomico entre abas: o `chrome.storage` nao tem compare-and-set, entao entre a releitura e a gravacao
   * fica uma janela de milissegundos em que um `marcar` da outra aba ainda pode gravar (e postar) sobre o id
   * antigo, ou duas abas assumirem juntas (a ultima gravacao vence). A releitura e o aviso de "lote recente" na
   * tela estreitam essa janela; nao a eliminam.
   */
  assumir(idEsperado: string, idNovo: string): Promise<LoteEmAndamento | null> {
    return this.enfileirar(async () => {
      const atual = await this.ler();
      if (!atual || atual.id !== idEsperado) return null;
      const novo = { ...atual, id: idNovo, atualizadoEm: this.agora() };
      await this.area.gravar({ [this.chave]: novo });
      return novo;
    });
  }

  /**
   * Apaga o registro. Com `idDoLote`, so apaga se o gravado ainda for aquele lote: uma aba que termina ou cancela
   * nao pode apagar o lote NOVO que outra aba gravou depois. Devolve se apagou. (Mesma janela do `assumir`: a
   * releitura e a remocao nao sao atomicas entre abas.)
   */
  descartar(idDoLote?: string): Promise<boolean> {
    return this.enfileirar(async () => {
      if (idDoLote !== undefined) {
        const atual = await this.ler();
        if (!atual || atual.id !== idDoLote) return false;
      }
      await this.area.remover(this.chave);
      return true;
    });
  }

  pendentes(l: LoteEmAndamento): number[] {
    const saida: number[] = [];
    l.itens.forEach((i, k) => {
      if (i.situacao !== "ok") saida.push(k);
    });
    return saida;
  }
}
