import type { Area } from "@comum/armazenamento/area";
import { PREFIXO_CHAVE, TETO, VALIDADE_LOTE_MS } from "./modelo/constantes";
import type { LinhaDocumento } from "./modelo/destinos";
import type { ConfigLote } from "./modelo/lote";
import type { ResultadoVerificacao } from "./sei/verificar";

/** "fora" = deixada de fora da execução (processo com problema). */
export type SituacaoLinha = "pendente" | "criada" | "erro" | "fora";

/**
 * Um item `erro` pode carregar o que se sabe de um documento talvez criado (`incerto`, `idDocumento`, `numero`,
 * `link`): o app não recria o que pode existir no SEI.
 */
export interface ItemLote {
  situacao: SituacaoLinha;
  criado?: { numero: string; idDocumento: string; link: string };
  erro?: string;
  incerto?: boolean;
  idDocumento?: string;
  numero?: string;
  link?: string;
  /**
   * Processo de destino que a própria linha criou (destino "novo processo"): fica mesmo se o documento falhar, para
   * o resultado permitir conferi-lo e para não criar outro processo ao repetir. `linkProcesso` não leva infra_hash.
   */
  processo?: string;
  linkProcesso?: string;
}

/** O lote guardado nunca contém `linkArvore` (traz o infra_hash da sessão). */
export type VerificacaoGuardada = Omit<ResultadoVerificacao, "linkArvore">;

export interface LoteDocumentos {
  id: string;
  host: string;
  login: string;
  iniciadoEm: number;
  /** Última escrita (ms): de `gravar` ou de `marcar`. Serve para o app desconfiar de um lote rodando em outra aba. */
  atualizadoEm: number;
  config: ConfigLote;
  linhas: LinhaDocumento[];
  itens: ItemLote[];
  verificacoes: Record<string, VerificacaoGuardada>;
  /** Protocolo do processo da tela (o destino "processo da tela"), para o resultado mostrar o destino. */
  protocoloTela?: string;
  /**
   * Id do processo da tela em que o lote começou (destino "processo da tela"): o `criar` com alvo "tela" grava no
   * processo da tela ATUAL, então retomar ou repetir só vale com a mesma tela aberta.
   */
  idProcedimentoTela?: string;
  /**
   * As colunas da planilha na ordem do arquivo (D4): o `chrome.storage` devolve as chaves de `linhas[].dados` em
   * ordem alfabética, então o resultado e o CSV seguem esta lista. Ausente nos lotes gravados antes dela.
   */
  colunas?: string[];
}

const CHAVE = `${PREFIXO_CHAVE}lote`;

const ehObjeto = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const ehTexto = (v: unknown): v is string => typeof v === "string";
const opcionalTexto = (v: unknown) => v === undefined || ehTexto(v);

function itemValido(i: unknown): boolean {
  if (!ehObjeto(i)) return false;
  if (i.situacao !== "pendente" && i.situacao !== "criada" && i.situacao !== "erro" && i.situacao !== "fora") return false;
  if (!opcionalTexto(i.erro) || !opcionalTexto(i.idDocumento) || !opcionalTexto(i.numero) || !opcionalTexto(i.link)) return false;
  if (!opcionalTexto(i.processo) || !opcionalTexto(i.linkProcesso)) return false;
  if (i.incerto !== undefined && typeof i.incerto !== "boolean") return false;
  if (i.criado !== undefined) {
    const c = i.criado;
    if (!ehObjeto(c) || !ehTexto(c.numero) || !ehTexto(c.idDocumento) || !ehTexto(c.link)) return false;
  }
  // Uma linha só vale como criada depois da resposta com número: "criada" sem isso refaria ou perderia o documento.
  if (i.situacao === "criada") {
    const c = i.criado as Record<string, unknown> | undefined;
    if (!c?.numero || !c.idDocumento) return false;
  }
  return true;
}

function configValida(c: unknown): boolean {
  if (!ehObjeto(c)) return false;
  if (!ehObjeto(c.camposCruzados) || !Object.values(c.camposCruzados).every(ehTexto)) return false;
  if (!ehTexto(c.colunaNome) || !ehTexto(c.modeloDescricao)) return false;
  if (!opcionalTexto(c.colunaNivel) || !opcionalTexto(c.colunaHipotese)) return false;
  if (typeof c.pausa !== "number" || !Number.isFinite(c.pausa)) return false;
  if (!ehObjeto(c.destino) || !ehTexto(c.destino.tipo)) return false;
  return ehObjeto(c.modelo) && ehTexto(c.modelo.origem);
}

/** Dado gravado por versão antiga, editado ou cortado não pode derrubar o app: o que não fecha vira "sem lote". */
function loteValido(v: unknown): v is LoteDocumentos {
  if (!ehObjeto(v)) return false;
  if (!ehTexto(v.id) || !v.id || !ehTexto(v.host) || !ehTexto(v.login)) return false;
  if (typeof v.iniciadoEm !== "number" || !Number.isFinite(v.iniciadoEm)) return false;
  if (v.atualizadoEm !== undefined && (typeof v.atualizadoEm !== "number" || !Number.isFinite(v.atualizadoEm))) return false;
  if (!configValida(v.config)) return false;
  if (!Array.isArray(v.linhas) || !Array.isArray(v.itens)) return false;
  if (v.linhas.length > TETO || v.itens.length !== v.linhas.length) return false;
  if (!v.linhas.every((l) => ehObjeto(l) && typeof l.indice === "number" && ehObjeto(l.dados))) return false;
  if (!ehObjeto(v.verificacoes)) return false;
  if (!opcionalTexto(v.protocoloTela) || !opcionalTexto(v.idProcedimentoTela)) return false;
  if (v.colunas !== undefined && (!Array.isArray(v.colunas) || !v.colunas.every(ehTexto))) return false;
  return v.itens.every(itemValido);
}

function semLinkArvore(verificacoes: Record<string, VerificacaoGuardada>): Record<string, VerificacaoGuardada> {
  const saida: Record<string, VerificacaoGuardada> = {};
  for (const [k, v] of Object.entries(verificacoes)) {
    const { linkArvore: _descartado, ...resto } = v as VerificacaoGuardada & { linkArvore?: string };
    saida[k] = resto;
  }
  return saida;
}

/** O texto do modelo é só da prévia (pode ser longo e é conteúdo do documento): nunca vai para o storage. */
function semTextoDoModelo(config: ConfigLote): ConfigLote {
  const { texto: _descartado, ...modelo } = config.modelo;
  return { ...config, modelo };
}

/**
 * Um lote em andamento por instalação (chave `docslote/lote`); `carregar` só o entrega ao mesmo host e login.
 * As escritas desta instância são enfileiradas (o read-modify-write do `marcar` não se perde). Outra aba não é
 * serializada: assume-se um único escritor por vez; o app usa `atualizadoEm` e JANELA_OUTRA_ABA_MS para avisar.
 */
export class RepositorioLote {
  private fila: Promise<unknown> = Promise.resolve();
  constructor(
    private readonly area: Area,
    private readonly agora: () => number = Date.now,
  ) {}

  private enfileirar<T>(tarefa: () => Promise<T>): Promise<T> {
    const r = this.fila.then(tarefa, tarefa);
    this.fila = r.catch(() => undefined);
    return r;
  }

  private async ler(): Promise<LoteDocumentos | null> {
    const v = (await this.area.obter(CHAVE))[CHAVE];
    if (v === undefined) return null;
    if (!loteValido(v)) {
      await this.area.remover(CHAVE);
      return null;
    }
    return { ...v, atualizadoEm: v.atualizadoEm ?? 0 };
  }

  /** Descarta (e apaga) o lote vencido (7 dias desde a última escrita), de outro host/login ou de forma inválida. */
  carregar(host: string, login: string): Promise<LoteDocumentos | null> {
    return this.enfileirar(async () => {
      const l = await this.ler();
      if (!l) return null;
      if (l.host !== host || l.login !== login) return null;
      if (this.agora() - Math.max(l.atualizadoEm, l.iniciadoEm) > VALIDADE_LOTE_MS) {
        await this.area.remover(CHAVE);
        return null;
      }
      return l;
    });
  }

  gravar(l: LoteDocumentos): Promise<void> {
    return this.enfileirar(() =>
      this.area.gravar({
        [CHAVE]: { ...l, config: semTextoDoModelo(l.config), verificacoes: semLinkArvore(l.verificacoes), atualizadoEm: this.agora() },
      }),
    );
  }

  /**
   * Relê e muda só o item do índice pedido; sem lote, de outro `id` ou com índice fora, não grava e devolve false
   * (o lote foi descartado ou assumido por outra aba: quem executa para).
   */
  marcar(id: string, indice: number, item: ItemLote): Promise<boolean> {
    return this.enfileirar(async () => {
      const atual = await this.ler();
      if (!atual || atual.id !== id || !Number.isInteger(indice) || indice < 0 || indice >= atual.itens.length) return false;
      const itens = atual.itens.slice();
      itens[indice] = item;
      await this.area.gravar({ [CHAVE]: { ...atual, itens, atualizadoEm: this.agora() } });
      return true;
    });
  }

  /**
   * Retomada: troca o id do lote guardado por `idNovo`, a partir do registro FRESCO, e o devolve. Outra aba que ainda
   * execute o lote com o id antigo perde o `marcar` (false) e para antes do próximo pedido. null: o guardado não é
   * mais `idEsperado` (outra aba o descartou ou assumiu). Entre abas a releitura e a escrita não são atômicas; o
   * aviso de "lote recente" estreita essa janela.
   */
  assumir(idEsperado: string, idNovo: string): Promise<LoteDocumentos | null> {
    return this.enfileirar(async () => {
      const atual = await this.ler();
      if (!atual || atual.id !== idEsperado) return null;
      const novo: LoteDocumentos = { ...atual, id: idNovo, atualizadoEm: this.agora() };
      await this.area.gravar({ [CHAVE]: novo });
      return novo;
    });
  }

  /** Apaga o lote `id`; um lote de outro id (gravado por outra aba depois) fica. */
  apagar(id: string): Promise<void> {
    return this.enfileirar(async () => {
      const atual = (await this.area.obter(CHAVE))[CHAVE];
      if (ehObjeto(atual) && atual.id !== id) return;
      await this.area.remover(CHAVE);
    });
  }
}
