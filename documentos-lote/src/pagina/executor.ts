/**
 * O que o app dos Documentos em Lote pede à aba do SEI: contexto, modelos, verificação dos processos de destino,
 * tipos de processo, a criação de cada processo (destino novo-processo) e de cada documento, o "Abrir em nova
 * aba" e a recarga da árvore da tela depois do lote. Roda aqui porque usa a sessão da aba; o laço do lote fica no app.
 *
 * Tudo atravessa a ponte como JSON simples: `situacao`, `erro` (só texto), `sessao` (o app pausa o lote),
 * `naoAberto` (a linha fica "não aberto na unidade") e `incerto` (o documento ou o processo pode existir: o app
 * não repete a linha). O app nunca vê `base`, `linkArvore` nem nada com `infra_hash`: a aba guarda o id de cada
 * processo verificado e o "Abrir em nova aba" monta o endereço aqui.
 */
import type { Tratador } from "@comum/ponte/rpc";
import { type Arvore, abrirArvore, acaoNaArvore } from "@nucleo/dominio/arvore";
import type { Sei } from "@nucleo/sei";
import { ehErroSei } from "@nucleo/sessao/erros";
import { criacaoIncerta, criarProcesso } from "@pl/sei/criar";
import { carregarFormTipo, type FormTipo } from "@pl/sei/formularioTipo";
import { listarTipos } from "@pl/sei/tipos";
import { criarDocumentoDaLinha, type DocumentoCriado, ErroDocumentoCriado, type PedidoCriar } from "../sei/criar";
import { type EscolhaModelo, lerModelo, listarModelos, type Modelo } from "../sei/modelo";
import { type StatusProcesso, verificarProcesso } from "../sei/verificar";
import type { ContextoDocumentos } from "./contexto";

/**
 * Evento do content script do Link Permanente (EVENTO_ABRIR em link-permanente/src/modelo/constantes.ts, duplicado
 * aqui como no processos-lote: os pacotes não se importam; a prova compara as duas strings).
 */
export const EVENTO_ABRIR_LINK_PERMANENTE = "spro-link-permanente-abrir";

/** Abre o Pesquisar Link Permanente na página do SEI: ele lê a entrada de `chrome.storage.local` ao abrir. */
export function dispararAbrirLinkPermanente(doc: Document): void {
  const Ev = (doc.defaultView as (Window & typeof globalThis) | null)?.CustomEvent ?? CustomEvent;
  doc.dispatchEvent(new Ev(EVENTO_ABRIR_LINK_PERMANENTE));
}

/**
 * Recarrega a árvore do processo na tela (`#ifrArvore` da página de topo) pelo endereço que ela já tem: nunca se monta
 * URL (molde: `recarregarArvoreVisivel` do acoes-lote; os pacotes não se importam). Se o `reload` for barrado,
 * regrava o próprio `src`. Lança quando não há árvore na tela.
 */
export function recarregarArvoreDe(doc: Document): void {
  const ifr = doc.querySelector<HTMLIFrameElement>("#ifrArvore");
  if (!ifr) throw new Error("A árvore do processo não está nesta tela.");
  try {
    if (!ifr.contentWindow) throw new Error("árvore sem janela");
    ifr.contentWindow.location.reload();
  } catch (e) {
    const src = ifr.getAttribute("src");
    if (!src) throw e;
    ifr.setAttribute("src", src);
  }
}

/** As chamadas ao SEI, trocáveis nas provas para forçar cada desfecho sem rede. */
export interface Chamadas {
  listarModelos: typeof listarModelos;
  lerModelo: typeof lerModelo;
  verificarProcesso: typeof verificarProcesso;
  criarDocumentoDaLinha: typeof criarDocumentoDaLinha;
  listarTipos: typeof listarTipos;
  carregarFormTipo: typeof carregarFormTipo;
  criarProcesso: typeof criarProcesso;
  /** Árvore do processo da tela, pelo link colhido da página. */
  abrirArvore(sei: Sei, link: string): Promise<Arvore>;
}

export const chamadasPadrao: Chamadas = {
  listarModelos,
  lerModelo,
  verificarProcesso,
  criarDocumentoDaLinha,
  listarTipos,
  carregarFormTipo,
  criarProcesso,
  abrirArvore: (sei, link) => abrirArvore(sei.http, link),
};

export interface DepsExecutor {
  sei: Sei;
  ctx: ContextoDocumentos;
  /** Tira o iframe do modal da tela. */
  fechar(): void;
  minimizar(minimizado: boolean): void;
  /** Abre um endereço já validado em outra aba; trocável nas provas. */
  abrirJanela?: (url: string) => void;
  /** Abre o Pesquisar Link Permanente nesta aba (o content script dele ouve o evento); sem isto, o RPC devolve false. */
  abrirLinkPermanente?: () => void;
  /** Recarrega a árvore visível do processo; lança se não conseguir. Trocável nas provas (padrão: `recarregarArvoreDe`). */
  recarregarArvore?: () => void;
  /** A página de topo do SEI (onde está o `#ifrArvore`); padrão: o `document` deste content script (o de topo). */
  documento?: () => Document;
  chamadas?: Partial<Chamadas>;
}

/** Falha de qualquer RPC: só texto, e as marcas que o app usa para decidir. */
export interface Falha {
  situacao: "erro";
  erro: string;
  /** A sessão do SEI caiu: o app pausa o lote. */
  sessao?: true;
}

export type ResultadoCriarDocumento =
  | { situacao: "ok"; criado: DocumentoCriado }
  | (Falha & {
      /** O processo de destino não está (mais) aberto na unidade: nada foi criado. */
      naoAberto?: true;
      /** O documento foi ou pode ter sido criado: NÃO repetir a linha. */
      incerto?: true;
      /** O que se sabe do documento (só os campos não vazios); ausente quando nem o id é conhecido. */
      criado?: Partial<DocumentoCriado>;
    });

/**
 * O destino do documento é o PROTOCOLO do processo: com o número na mão, a linha segue (mesmo sem o id, caso do
 * `ErroProcessoCriado`, que volta como "ok" com aviso). Sem o número o processo existe ou pode existir, mas não
 * serve de destino: erro com `incerto` (NÃO repetir a linha, duplicaria o processo).
 */
export type ResultadoCriarProcesso =
  | { situacao: "ok"; criado: { numero: string; idProcedimento?: string; url?: string }; aviso?: string }
  | (Falha & { incerto?: true; criado?: { idProcedimento: string; url: string } });

/** O resultado da verificação como o app o vê: sem o link assinado da árvore. */
export interface VerificacaoPublica {
  numero: string;
  status: StatusProcesso;
  idProcedimento?: string;
  mensagem?: string;
}

export const ERRO_NAO_ABERTO = "O processo não está aberto nesta unidade.";
export const ERRO_SIGILOSO = "Processo sigiloso: o lote não atua nele.";
export const ERRO_SEM_HIPOTESE = "Processo restrito sem hipótese legal: escolha uma hipótese.";
export const AVISO_PROCESSO_INCERTO =
  "O processo pode ter sido criado, mas o SEI não confirmou. Confira no Controle de Processos antes de repetir esta linha.";
export const AVISO_PROCESSO_SEM_ID =
  "O processo foi criado, mas o SEI não devolveu o identificador dele. O documento segue para o número do processo.";
export const ERRO_PROCESSO_SEM_NUMERO =
  "O processo foi criado, mas o número não pôde ser lido. Confira no Controle de Processos antes de repetir esta linha.";
const ERRO_SEM_TIPO = "Tipo de processo não informado.";
const ERRO_SEM_TELA = "Abra uma tela do SEI";

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));
const sessaoExpirada = (e: unknown): boolean => ehErroSei(e) && e.codigo === "SEI_SESSAO_EXPIRADA";
const texto = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

function falha(e: unknown): Falha {
  return sessaoExpirada(e) ? { situacao: "erro", erro: mensagem(e), sessao: true } : { situacao: "erro", erro: mensagem(e) };
}

/** Onde gravar a linha, como o app pede. */
type Alvo = { tipo: "tela" } | { tipo: "coluna"; numero: string } | { tipo: "novo-processo"; numero: string };

type PedidoApp = Omit<PedidoCriar, "processo" | "origem"> & { alvo: Alvo };

function lerStrings(v: unknown): Record<string, string> | null {
  if (!v || typeof v !== "object" || Array.isArray(v)) return null;
  const r: Record<string, string> = {};
  for (const [k, x] of Object.entries(v)) if (typeof x === "string") r[k] = x;
  return r;
}

function lerPedido(args: unknown): PedidoApp | string {
  const a = (args ?? {}) as Record<string, unknown>;
  const al = (a.alvo ?? {}) as Record<string, unknown>;
  let alvo: Alvo;
  if (al.tipo === "tela") alvo = { tipo: "tela" };
  else if (al.tipo === "coluna" || al.tipo === "novo-processo") {
    const numero = texto(al.numero);
    if (!numero) return "Linha sem o número do processo de destino.";
    alvo = { tipo: al.tipo, numero };
  } else return "Destino da linha não informado.";
  const modelo = a.modelo as Modelo | undefined;
  if (!modelo || typeof modelo !== "object" || (modelo.origem !== "documento" && modelo.origem !== "texto-padrao")) {
    return "Modelo não informado.";
  }
  const linha = lerStrings(a.linha);
  if (!linha) return "Linha sem dados.";
  const camposCruzados = lerStrings(a.camposCruzados) ?? {};
  const p: PedidoApp = {
    alvo,
    modelo,
    linha,
    colunaNome: typeof a.colunaNome === "string" ? a.colunaNome : "",
    modeloDescricao: typeof a.modeloDescricao === "string" ? a.modeloDescricao : "",
    nivel: a.nivel === "restrito" ? "restrito" : "publico",
    camposCruzados,
  };
  if (typeof a.hipotese === "string" && a.hipotese) p.hipotese = a.hipotese;
  return p;
}

function lerEscolha(args: unknown): EscolhaModelo | null {
  const a = (args ?? {}) as Record<string, unknown>;
  if (texto(a.documento)) return { documento: texto(a.documento) };
  if (texto(a.textoPadrao)) {
    const e: EscolhaModelo = { textoPadrao: texto(a.textoPadrao), tipoId: texto(a.tipoId) };
    if (texto(a.tipoNome)) e.tipoNome = texto(a.tipoNome);
    return e;
  }
  return null;
}

/** Só os campos conhecidos do documento criado (vazio não vai). */
function conhecidos(d: DocumentoCriado): Partial<DocumentoCriado> | undefined {
  const r: Partial<DocumentoCriado> = {};
  if (d.idDocumento) r.idDocumento = d.idDocumento;
  if (d.numero) r.numero = d.numero;
  if (d.link) r.link = d.link;
  return r.idDocumento ? r : undefined;
}

/** O processo pode ter sido criado (ver criarProcesso): conta também o que não é `ErroSei` e o `CANCELADO`. */
const processoTalvezCriado = (e: unknown): boolean => criacaoIncerta(e) || !ehErroSei(e) || e.codigo === "CANCELADO";

export function tratadoresDocumentosLote(d: DepsExecutor): Record<string, Tratador> {
  const c: Chamadas = { ...chamadasPadrao, ...d.chamadas };
  const abrirJanela = d.abrirJanela ?? ((url: string) => void window.open(url, "_blank", "noopener"));

  /** Protocolo do processo da tela, resolvido uma vez pela árvore (o link fica aqui). */
  let protocoloTela: Promise<string> | null = null;
  const protocoloDaTela = (): Promise<string> => {
    protocoloTela ??= c.abrirArvore(d.sei, d.ctx.linkArvore).then(
      (a) => a.protocolo,
      (e) => {
        protocoloTela = null;
        throw e;
      },
    );
    return protocoloTela;
  };

  /**
   * Processos achados pela verificação nesta aba: número → id do processo, para o "Abrir em nova aba" (o app manda
   * só o número). O link assinado da árvore não é guardado: a nova aba abre a tela pelo Link Permanente.
   */
  const verificados = new Map<string, string>();
  /** Ids que o "Abrir em nova aba" aceita: só os que `verificar` ou `criarProcesso` devolveram nesta aba. */
  const idsConhecidos = new Set<string>();

  /** Endereço que pode ser aberto em outra aba: http(s) do mesmo host do SEI. */
  const hostSei = (() => {
    try {
      return new URL(d.ctx.origem).host;
    } catch {
      return "";
    }
  })();
  const urlPermitida = (u: string): string | null => {
    try {
      const url = new URL(u);
      if (url.protocol !== "https:" && url.protocol !== "http:") return null;
      if (!hostSei || url.host !== hostSei) return null;
      return url.href;
    } catch {
      return null;
    }
  };

  const processoDoPedido = async (p: PedidoApp): Promise<string> => (p.alvo.tipo === "tela" ? protocoloDaTela() : p.alvo.numero);

  const criar = async (args: unknown): Promise<ResultadoCriarDocumento> => {
    const p = lerPedido(args);
    if (typeof p === "string") return { situacao: "erro", erro: p };

    let processo: string;
    try {
      processo = await processoDoPedido(p);
      // Destino coluna: o processo pode ter sido enviado ou concluído depois da verificação. Relê a árvore sem
      // cache e só cria se a ação de incluir documento ainda está lá.
      if (p.alvo.tipo === "coluna") {
        const arv = await d.sei.arvore(processo, { forcar: true });
        if (arv.nivel === "sigiloso") return { situacao: "erro", erro: ERRO_SIGILOSO };
        if (!acaoNaArvore(arv, "documento_escolher_tipo")) return { situacao: "erro", erro: ERRO_NAO_ABERTO, naoAberto: true };
      }
    } catch (e) {
      return falha(e);
    }

    const { alvo: _alvo, ...resto } = p;
    try {
      const criado = await c.criarDocumentoDaLinha(d.sei, { ...resto, processo, origem: d.ctx.origem });
      return { situacao: "ok", criado };
    } catch (e) {
      if (e instanceof ErroDocumentoCriado) {
        const r: ResultadoCriarDocumento = { ...falha(e), incerto: true };
        const dados = conhecidos(e.documentoCriado);
        if (dados) r.criado = dados;
        return r;
      }
      return falha(e);
    }
  };

  /** Formulários por tipo de processo, só nesta aba (o `action` assinado não atravessa a ponte). */
  const formularios = new Map<string, FormTipo>();
  const buscarForm = async (idTipo: string): Promise<FormTipo> => {
    const f = await c.carregarFormTipo(d.sei, idTipo);
    formularios.set(idTipo, f);
    return f;
  };

  const criarUmProcesso = async (args: unknown): Promise<ResultadoCriarProcesso> => {
    const a = (args ?? {}) as Record<string, unknown>;
    const idTipo = texto(a.idTipo);
    if (!idTipo) return { situacao: "erro", erro: ERRO_SEM_TIPO };
    const dados = {
      especificacao: typeof a.especificacao === "string" ? a.especificacao : "",
      nivelAcesso: a.nivelAcesso === "1" ? ("1" as const) : ("0" as const),
      hipoteseLegal: typeof a.hipoteseLegal === "string" ? a.hipoteseLegal : "",
      ...(typeof a.interessado === "string" ? { interessado: a.interessado } : {}),
      ...(typeof a.observacao === "string" ? { observacao: a.observacao } : {}),
    };
    if (dados.nivelAcesso === "1" && (!dados.hipoteseLegal.trim() || dados.hipoteseLegal.trim() === "null")) {
      return { situacao: "erro", erro: ERRO_SEM_HIPOTESE };
    }
    const incerto = (e: unknown): ResultadoCriarProcesso => {
      const numero = (e as { numero?: unknown } | null)?.numero;
      // ErroProcessoCriado com o protocolo lido do <title>: o processo existe e o número basta de destino.
      if (typeof numero === "string" && numero) return { situacao: "ok", criado: { numero }, aviso: AVISO_PROCESSO_SEM_ID };
      return { situacao: "erro", erro: AVISO_PROCESSO_INCERTO, incerto: true };
    };
    const ok = (x: { numero: string; idProcedimento: string; url: string; aviso?: string }): ResultadoCriarProcesso => {
      if (x.idProcedimento) idsConhecidos.add(x.idProcedimento);
      // Criado, mas sem o protocolo: não há destino para o documento, e repetir duplicaria o processo.
      if (!x.numero)
        return {
          situacao: "erro",
          erro: ERRO_PROCESSO_SEM_NUMERO,
          incerto: true,
          criado: { idProcedimento: x.idProcedimento, url: x.url },
        };
      const r: ResultadoCriarProcesso = { situacao: "ok", criado: { numero: x.numero, idProcedimento: x.idProcedimento, url: x.url } };
      if (x.aviso) r.aviso = x.aviso;
      return r;
    };

    let form = formularios.get(idTipo);
    try {
      form ??= await buscarForm(idTipo);
    } catch (e) {
      return falha(e);
    }
    try {
      return ok(await c.criarProcesso(d.sei, form, dados));
    } catch (e) {
      if (processoTalvezCriado(e)) return incerto(e);
      if (sessaoExpirada(e)) return falha(e);
    }
    // Comprovadamente não criado: a sessão pode ter invalidado o formulário guardado. Refaz UMA vez e repete
    // (como o Processos em Lote); na segunda falha, a linha fica com o erro.
    try {
      form = await buscarForm(idTipo);
    } catch (e) {
      return falha(e);
    }
    try {
      return ok(await c.criarProcesso(d.sei, form, dados));
    } catch (e) {
      return processoTalvezCriado(e) ? incerto(e) : falha(e);
    }
  };

  return {
    contexto: () => {
      const { base: _base, linkArvore: _link, ...publico } = d.ctx;
      return publico;
    },

    listarModelos: async () => {
      try {
        const protocolo = await protocoloDaTela();
        return { situacao: "ok", protocolo, modelos: await c.listarModelos(d.sei, protocolo) };
      } catch (e) {
        return falha(e);
      }
    },

    lerModelo: async (args) => {
      const escolha = lerEscolha(args);
      if (!escolha) return { situacao: "erro", erro: "Escolha um documento ou um Texto Padrão como modelo." };
      try {
        return { situacao: "ok", modelo: await c.lerModelo(d.sei, escolha) };
      } catch (e) {
        if (ehErroSei(e) && e.codigo === "SEI_ACAO_INDISPONIVEL" && "documento" in escolha) {
          // O tipo do documento modelo vem da tela "Alterar Documento"; sem ela, o documento não serve de modelo.
          return {
            situacao: "erro",
            erro: `Não foi possível ler o tipo do documento ${escolha.documento} para usá-lo como modelo: ${e.message} Escolha outro documento ou um Texto Padrão.`,
          };
        }
        return falha(e);
      }
    },

    tiposProcesso: async () => {
      try {
        return { situacao: "ok", tipos: await c.listarTipos(d.sei) };
      } catch (e) {
        return falha(e);
      }
    },

    verificar: async (args): Promise<VerificacaoPublica> => {
      const a = (args ?? {}) as Record<string, unknown>;
      const numero = typeof a.numero === "string" ? a.numero : "";
      const tipoId = texto(a.tipoId);
      const chave = numero.trim();
      if (a.deNovo === true && chave) {
        // Reverificar não pode reaproveitar o link da árvore guardado no `Sei` (o processo pode ter mudado).
        verificados.delete(chave);
        d.sei.esquecer(chave);
      }
      const r = await c.verificarProcesso(d.sei, numero, tipoId);
      if (r.idProcedimento) {
        verificados.set(chave, r.idProcedimento);
        idsConhecidos.add(r.idProcedimento);
      }
      const publico: VerificacaoPublica = { numero: r.numero, status: r.status };
      if (r.idProcedimento) publico.idProcedimento = r.idProcedimento;
      if (r.mensagem) publico.mensagem = r.mensagem;
      // Sem tela base do SEI nesta aba o número não foi procurado: é falha de ambiente (tentar de novo), não
      // "não encontrado".
      if (r.status === "nao-encontrado" && r.mensagem?.startsWith(ERRO_SEM_TELA)) publico.status = "erro-rede";
      return publico;
    },

    criar,
    criarProcesso: criarUmProcesso,

    abrirAba: (args) => {
      const a = (args ?? {}) as Record<string, unknown>;
      let alvo: string | null = null;
      if (typeof a.url === "string") alvo = urlPermitida(a.url);
      else {
        const pedido = texto(a.idProcedimento);
        const id = verificados.get(texto(a.numero)) ?? (idsConhecidos.has(pedido) ? pedido : "");
        // A tela do processo no formato do Link Permanente (sem infra_hash): o link da árvore abriria só o
        // quadro da árvore.
        if (id) alvo = urlPermitida(`${d.ctx.origem}?acao=procedimento_trabalhar&id_procedimento=${encodeURIComponent(id)}`);
      }
      if (!alvo) return { aberto: false, erro: "Endereço não permitido ou processo não verificado." };
      abrirJanela(alvo);
      return { aberto: true };
    },

    fechar: () => {
      d.fechar();
      return true;
    },
    minimizar: (args) => {
      d.minimizar((args as { minimizado?: unknown } | undefined)?.minimizado === true);
      return true;
    },
    abrirLinkPermanente: () => {
      if (!d.abrirLinkPermanente) return false;
      d.abrirLinkPermanente();
      return true;
    },
    /**
     * Depois do lote (D2): a árvore da tela mostra os documentos novos. Melhor esforço; a falha volta em texto e o
     * app a ignora (nunca afeta o lote).
     */
    recarregarArvore: () => {
      try {
        if (d.recarregarArvore) d.recarregarArvore();
        else recarregarArvoreDe((d.documento ?? (() => document))());
        return { situacao: "ok" };
      } catch (e) {
        return { situacao: "erro", erro: mensagem(e) };
      }
    },
  };
}
