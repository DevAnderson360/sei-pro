/**
 * O que o app das Ações em Lote pede à aba do SEI: contexto, árvore do processo, prévia e execução de cada etapa,
 * listas de apoio (blocos, hipóteses, contatos, assuntos, processo de destino) e downloads. Roda na aba porque
 * usa a sessão dela; o app nunca vê tipos de exceção nem links do SEI (nada com `infra_hash` atravessa a ponte).
 *
 * Tudo volta como JSON simples: `situacao`, `erro`, `parar`, `incerto`. Quem decide repetir ou parar é o app.
 */
import type { Tratador } from "@comum/ponte/rpc";
import { cancelarAssinatura, cancelarDocumento, darCiencia, excluirDocumento } from "@nucleo/dominio/acoesDocumento";
import { type Arvore, abrirArvore } from "@nucleo/dominio/arvore";
import { criarBloco, incluirNoBloco, listarBlocosParaInclusao } from "@nucleo/dominio/blocos";
import {
  type AlteracaoDocumento,
  alterarDocumento,
  duplicarDocumento,
  lerConteudo,
  localizarDocumento,
  pesquisarAssuntos,
  pesquisarContatos,
} from "@nucleo/dominio/documento";
import { hipotesesDoFormulario, type OpcoesEscrita, type ResultadoEscrita } from "@nucleo/dominio/escrita";
import { type Andamento, andamentos } from "@nucleo/dominio/historico";
import { moverDocumento, resolverProcessoDestino } from "@nucleo/dominio/moverDocumento";
import { gerarPdfDocumentos } from "@nucleo/dominio/pdfProcesso";
import { assinarDocumento } from "@nucleo/dominio/tramitacao";
import { Formulario } from "@nucleo/formulario/formulario";
import { linkDaAcao } from "@nucleo/links/links";
import type { Sei } from "@nucleo/sei";
import { ehErroSei } from "@nucleo/sessao/erros";
import type { Arquivo } from "@nucleo/sessao/http";
import { documentoTopo } from "@nucleo/sessao/pagina";
import { ACOES, type AcaoId } from "../modelo/acoes";
import { type LinhaDoc, linhasDaArvore, MOTIVO_SIGILOSO } from "../modelo/documentos";
import { BLOCO_NAO_CONFIRMADO, type ItemLista, type ParamsEtapa } from "../modelo/fila";
import { AcumuladorZip, baixarBytes, extensaoDe, htmlEmUtf8, nomeArquivo } from "../sei/download";
import type { ContextoAcoes } from "./contexto";

/** As chamadas ao SEI, trocáveis nas provas para forçar cada desfecho sem rede. */
export interface ChamadasSei {
  darCiencia: typeof darCiencia;
  excluirDocumento: typeof excluirDocumento;
  cancelarDocumento: typeof cancelarDocumento;
  cancelarAssinatura: typeof cancelarAssinatura;
  assinarDocumento: typeof assinarDocumento;
  alterarDocumento: typeof alterarDocumento;
  duplicarDocumento: typeof duplicarDocumento;
  pesquisarContatos: typeof pesquisarContatos;
  pesquisarAssuntos: typeof pesquisarAssuntos;
  resolverProcessoDestino: typeof resolverProcessoDestino;
  moverDocumento: typeof moverDocumento;
  gerarPdfDocumentos: typeof gerarPdfDocumentos;
  listarBlocosParaInclusao: typeof listarBlocosParaInclusao;
  incluirNoBloco: typeof incluirNoBloco;
  criarBloco: typeof criarBloco;
  andamentos: typeof andamentos;
  /** Árvore do processo aberto, pelo link colhido da página. */
  abrirArvore(sei: Sei, link: string): Promise<Arvore>;
  invalidar(sei: Sei, idProcedimento: string): void;
  /** Conteúdo bruto do documento (arquivo do anexo ou HTML do documento interno), com a recusa de sigiloso. */
  conteudo(sei: Sei, numero: string): Promise<{ titulo: string; numero: string; arquivo?: Arquivo; html?: string }>;
  baixarLink(sei: Sei, link: string): Promise<Arquivo>;
  /** Hipóteses legais, lidas da tela de alteração do documento `numero` (`nivel` "1" restrito). */
  hipoteses(sei: Sei, numero: string, nivel: string): Promise<ItemLista[]>;
}

export const chamadasPadrao: ChamadasSei = {
  darCiencia,
  excluirDocumento,
  cancelarDocumento,
  cancelarAssinatura,
  assinarDocumento,
  alterarDocumento,
  duplicarDocumento,
  pesquisarContatos,
  pesquisarAssuntos,
  resolverProcessoDestino,
  moverDocumento,
  gerarPdfDocumentos,
  listarBlocosParaInclusao,
  incluirNoBloco,
  criarBloco,
  andamentos,
  abrirArvore: (sei, link) => abrirArvore(sei.http, link),
  invalidar: (sei, id) => sei.invalidar(id),
  conteudo: async (sei, numero) => {
    const d = await localizarDocumento(sei, numero);
    const c = await lerConteudo(sei, d);
    const base = { titulo: d.documento.titulo, numero: d.documento.numero };
    return c.forma === "arquivo" ? { ...base, arquivo: c.arquivo } : { ...base, html: c.html };
  },
  baixarLink: (sei, link) => sei.http.baixar(link),
  hipoteses: async (sei, numero, nivel) => {
    const d = await localizarDocumento(sei, numero);
    if (d.documento.nivel === "sigiloso" || d.arvore.nivel === "sigiloso") {
      throw new Error(MOTIVO_SIGILOSO);
    }
    const link =
      linkDaAcao(d.documento.acoes, d.documento.externo ? "documento_alterar_recebido" : "documento_alterar") ??
      linkDaAcao(d.documento.acoes, /^documento_alterar/);
    if (!link) throw new Error(`O SEI não oferece alterar o documento ${d.documento.numero} para você.`);
    const form = await Formulario.abrir(sei.http, link, "#frmDocumentoCadastro");
    return hipotesesDoFormulario(sei, form, nivel);
  },
};

export interface DepsExecutor {
  sei: Sei;
  ctx: ContextoAcoes;
  /** Só no modal: tira o iframe da tela. */
  fechar?: () => void;
  minimizar?: (minimizado: boolean) => void;
  chamadas?: Partial<ChamadasSei>;
  /** Entrega bytes ao usuário (`<a download>`); trocável nas provas. */
  baixar?: (bytes: Uint8Array, nome: string, tipo: string) => void;
  /** Documento de topo da tela do SEI (onde mora o `#ifrArvore`); trocável nas provas. */
  documento?: () => Document;
}

export type RespostaEtapa =
  | { situacao: "ok"; resumo: string; mudancas: ResultadoEscrita["mudancas"]; dados?: Record<string, string>; incerto?: boolean }
  /** `dados.bloco`: o bloco novo foi criado, mas a inclusão falhou; o app regrava a etapa como `{id}` mesmo assim. */
  | { situacao: "pulado" | "erro"; erro: string; parar?: boolean; dados?: Record<string, string> };

export type RespostaDestino =
  | { situacao: "ok"; destino: { protocolo: string; idProcedimento: string; tipo: string } }
  | { situacao: "erro"; erro: string };

export interface RespostaArvore {
  protocolo: string;
  sigiloso: boolean;
  linhas: LinhaDoc[];
  /** O histórico falhou: as linhas vão sem data e o filtro de período fica desligado. */
  datasIndisponiveis?: boolean;
}

export const TEXTO_SENHA = "Senha incorreta: o lote foi pausado para não bloquear sua conta.";
export const TEXTO_INCERTO = "O SEI não confirmou. Confira o documento antes de repetir.";
export const AVISO_DATAS = "Datas indisponíveis neste processo.";
export const ERRO_DESTINO_IGUAL = "O processo de destino é o próprio processo aberto.";

const mensagem = (e: unknown): string => (e instanceof Error ? e.message : String(e));
/** Minúsculas e sem acento, para achar palavras nas mensagens do SEI. */
const plano = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/**
 * Traduz uma falha do núcleo. Mensagens de pulado/erro trazem o motivo por extenso.
 * `aplicou`: o POST pode ter saído; nesse caso falhas que não provam "não gravou" viram `incerto` (nunca `erro`,
 * que o app trataria como repetível e poderia duplicar/aplicar duas vezes).
 */
export function mapearErro(e: unknown, o: { aplicou: boolean; assinatura?: boolean }): RespostaEtapa {
  if (ehErroSei(e)) {
    const texto = plano(`${e.message} ${e.detalhe ?? ""}`);
    if (e.codigo === "SEI_SESSAO_EXPIRADA" || texto.includes("captcha")) return { situacao: "erro", erro: e.message, parar: true };
    if (o.assinatura && texto.includes("senha")) return { situacao: "erro", erro: TEXTO_SENHA, parar: true };
    if (e.codigo === "SEI_SIGILOSO") return { situacao: "pulado", erro: MOTIVO_SIGILOSO };
    if (e.codigo === "SEI_ACAO_INDISPONIVEL") return { situacao: "pulado", erro: e.message };
    if (o.aplicou && (e.codigo === "CANCELADO" || e.codigo === "SEI_REDE" || e.codigo === "SEI_RESPOSTA_INESPERADA")) return incerta();
    return { situacao: "erro", erro: e.message };
  }
  if (o.aplicou) return incerta();
  return { situacao: "erro", erro: mensagem(e) };
}

function incerta(resumo = TEXTO_INCERTO): RespostaEtapa {
  return { situacao: "ok", resumo, mudancas: [], incerto: true };
}

/**
 * Recarrega a árvore visível do processo (`#ifrArvore` da tela de topo) pelo endereço que ela já tem: nunca se
 * monta URL. Se o `reload` for barrado, regrava o próprio `src`. Melhor esforço: sem árvore na tela, nada a fazer.
 */
export function recarregarArvoreVisivel(documento: () => Document): void {
  let ifr: HTMLIFrameElement | null;
  try {
    ifr = documento().querySelector<HTMLIFrameElement>("#ifrArvore");
  } catch {
    return;
  }
  if (!ifr) return;
  try {
    ifr.contentWindow!.location.reload();
  } catch {
    const src = ifr.getAttribute("src");
    if (src) ifr.setAttribute("src", src);
  }
}

function ok(r: ResultadoEscrita): RespostaEtapa {
  const o: RespostaEtapa = { situacao: "ok", resumo: r.resumo, mudancas: r.mudancas };
  if (r.dados && Object.keys(r.dados).length) o.dados = r.dados;
  return o;
}

const ACOES_CONHECIDAS = new Set<string>(ACOES.map((a) => a.id));
const naoVazio = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** "dd/mm/aaaa hh:mm" -> "aaaa-mm-dd" (ou null). */
export function dataIso(dataSei: string): string | null {
  const m = /(\d{2})\/(\d{2})\/(\d{4})/.exec(dataSei);
  return m ? `${m[3]}-${m[2]}-${m[1]}` : null;
}

/**
 * Data de geração por número SEI: a do andamento mais antigo que cita o número como item inteiro (não como parte de
 * um número maior). O histórico vem do mais recente para o mais antigo; ciência, assinatura etc. também citam o
 * número, por isso vale o menor dia entre as citações.
 */
export function datasPorNumero(linhas: LinhaDoc[], historico: Andamento[]): Map<string, string> {
  const r = new Map<string, string>();
  const eventos = historico
    .map((a) => ({ iso: dataIso(a.data), texto: a.descricao }))
    .filter((a): a is { iso: string; texto: string } => a.iso !== null);
  for (const l of linhas) {
    const n = l.numero.replace(/\D/g, "");
    if (!n) continue;
    const re = new RegExp(`(?<!\\d)${n}(?!\\d)`);
    let menor: string | null = null;
    for (const ev of eventos) if (re.test(ev.texto) && (menor === null || ev.iso < menor)) menor = ev.iso;
    if (menor) r.set(l.numero, menor);
  }
  return r;
}

export function tratadoresAcoesLote(d: DepsExecutor): Record<string, Tratador> {
  const c: ChamadasSei = { ...chamadasPadrao, ...d.chamadas };
  const entregar = d.baixar ?? baixarBytes;
  const zip = new AcumuladorZip();
  /** Lote dono dos arquivos hoje no acumulador do ZIP; outro lote começa de um acumulador limpo. */
  let loteDoZip = "";
  /**
   * Árvore já lida nesta aba (a do processo aberto). `recarregarArvore` e `arvore({forcar})` a refazem.
   * Também serve de lista numero -> id para o PDF e de referência (um documento qualquer) para as pesquisas.
   */
  let cache: RespostaArvore | null = null;
  /**
   * Blocos criados pelos lotes: `${loteId}|${descrição}` -> número do bloco. Cria o bloco UMA vez por lote e os
   * documentos seguintes só incluem nele; outro lote com a mesma descrição cria o seu. A prévia nunca cria.
   * `null` marca criação incerta: os documentos seguintes não tentam criar de novo (evita bloco em duplicata).
   * Os tratadores são refeitos a cada abertura do modal, então este mapa NÃO sobrevive a ela: quem retoma o lote
   * deve regravar a etapa como `{id}` com o `dados.bloco` devolvido pelo item que criou (o app faz isso).
   */
  const blocosCriados = new Map<string, string | null>();

  const carregarArvore = async (forcar: boolean): Promise<RespostaArvore> => {
    if (cache && !forcar) return cache;
    if (forcar) c.invalidar(d.sei, d.ctx.idProcedimento);
    const arv = await c.abrirArvore(d.sei, d.ctx.linkArvore);
    const sigiloso = arv.nivel === "sigiloso";
    let linhas = linhasDaArvore(arv);
    let datasIndisponiveis = false;
    if (sigiloso) {
      datasIndisponiveis = true;
    } else {
      try {
        const h = await c.andamentos(d.sei, arv.protocolo, { tipo: "total", limite: 5000 });
        const datas = datasPorNumero(linhas, h.andamentos);
        linhas = linhas.map((l) => (datas.has(l.numero) ? { ...l, data: datas.get(l.numero) } : l));
      } catch {
        datasIndisponiveis = true;
      }
    }
    cache = { protocolo: arv.protocolo, sigiloso, linhas, ...(datasIndisponiveis ? { datasIndisponiveis } : {}) };
    return cache;
  };

  /** Número de um documento qualquer não sigiloso, para as telas que só abrem a partir de um documento. */
  const documentoDeReferencia = async (numero: unknown): Promise<string> => {
    const n = naoVazio(numero);
    if (n) return n;
    const a = await carregarArvore(false);
    const l = a.linhas.find((x) => x.nivel !== "sigiloso" && !x.cancelado) ?? a.linhas[0];
    if (!l) throw new Error("O processo não tem documentos.");
    return l.numero;
  };

  const lerEtapa = (args: unknown): { etapa: ParamsEtapa; numero: string; senha: string; loteId: string } | string => {
    const a = (args ?? {}) as Record<string, unknown>;
    const etapa = a.etapa as ParamsEtapa | undefined;
    if (!etapa || typeof etapa !== "object" || !ACOES_CONHECIDAS.has(etapa.acao)) return "Ação desconhecida.";
    const numero = naoVazio(a.numero);
    if (!numero) return "Documento não informado.";
    return { etapa, numero, senha: typeof a.senha === "string" ? a.senha : "", loteId: naoVazio(a.loteId) };
  };

  /** Um passo de escrita do núcleo, com `aplicar` já resolvido. */
  const passo = async (etapa: ParamsEtapa, numero: string, senha: string, aplicar: boolean, loteId: string): Promise<ResultadoEscrita> => {
    const op: OpcoesEscrita = { aplicar };
    switch (etapa.acao) {
      case "ciencia":
        return c.darCiencia(d.sei, numero, {}, op);
      case "excluir":
        return c.excluirDocumento(d.sei, numero, op);
      case "cancelar-assinatura":
        return c.cancelarAssinatura(d.sei, numero, op);
      case "cancelar-documento":
        return c.cancelarDocumento(d.sei, numero, etapa.motivo, op);
      case "duplicar":
        return c.duplicarDocumento(d.sei, numero, op);
      case "alterar-nivel": {
        const alt: AlteracaoDocumento = { nivel: etapa.nivel };
        if (etapa.nivel === "restrito" && etapa.hipotese) alt.hipotese = etapa.hipotese;
        return c.alterarDocumento(d.sei, numero, alt, op);
      }
      case "alterar-dados": {
        const alt: AlteracaoDocumento = {};
        // Em branco significa "manter o atual": o núcleo trata "" como "esvaziar", por isso vai undefined.
        if (etapa.descricao?.trim()) alt.descricao = etapa.descricao;
        if (etapa.observacao?.trim()) alt.observacao = etapa.observacao;
        if (etapa.nivel) alt.nivel = etapa.nivel;
        if (etapa.nivel === "restrito" && etapa.hipotese) alt.hipotese = etapa.hipotese;
        if (etapa.interessados?.itens.length) alt.interessados = etapa.interessados;
        if (etapa.assuntos?.itens.length) alt.assuntos = etapa.assuntos;
        return c.alterarDocumento(d.sei, numero, alt, op);
      }
      case "assinar":
        return c.assinarDocumento(d.sei, numero, aplicar ? { cargo: etapa.cargo, senha } : { cargo: etapa.cargo }, op);
      case "mover":
        return c.moverDocumento(
          d.sei,
          numero,
          { idProcedimento: etapa.destino.idProcedimento, protocolo: etapa.destino.protocolo },
          etapa.motivo,
          op,
        );
      case "incluir-bloco": {
        if ("id" in etapa.bloco) return c.incluirNoBloco(d.sei, etapa.bloco.id, [numero], {}, op);
        // Só a prévia chega aqui: a execução de `{novo}` vai por `incluirEmBlocoNovo`.
        const desc = etapa.bloco.novo.trim();
        const feito = blocosCriados.get(`${loteId}|${desc}`);
        return {
          alvo: numero,
          mudancas: [{ campo: "Bloco", antes: "", depois: `novo bloco de assinatura "${desc}" (criado uma vez para o lote)` }],
          aplicado: false,
          resumo: feito ? `Vai incluir o documento no bloco ${feito}.` : `Vai criar o bloco "${desc}" e incluir o documento nele.`,
        };
      }
      case "baixar":
      case "pdf":
        return {
          alvo: numero,
          mudancas: [],
          aplicado: false,
          resumo: etapa.acao === "pdf" ? "Vai incluir o documento no PDF único." : "Vai baixar o documento.",
        };
    }
  };

  /**
   * Execução de "incluir em bloco novo". Desfechos:
   * - criação sem confirmação: `incerto` (nunca `erro`, que o app repetiria) e a marca `null` no mapa;
   * - marca `null` já no mapa: `pulado` com BLOCO_NAO_CONFIRMADO (não tenta criar de novo);
   * - bloco criado e inclusão falhou (ou ficou incerta): a resposta leva `dados.bloco` para o app regravar `{id}`.
   */
  const incluirEmBlocoNovo = async (novo: string, numero: string, loteId: string): Promise<RespostaEtapa> => {
    const desc = novo.trim();
    const chave = `${loteId}|${desc}`;
    let bloco = blocosCriados.get(chave);
    if (bloco === null) return { situacao: "pulado", erro: BLOCO_NAO_CONFIRMADO };
    if (bloco === undefined) {
      try {
        bloco = (await c.criarBloco(d.sei, { tipo: "assinatura", descricao: desc }, { aplicar: true })).dados?.bloco;
      } catch (e) {
        const r = mapearErro(e, { aplicou: true });
        if (!(r.situacao === "ok" && r.incerto)) return r;
        bloco = undefined;
      }
      if (!bloco) {
        blocosCriados.set(chave, null);
        return incerta(textoBlocoIncerto(desc));
      }
      blocosCriados.set(chave, bloco);
    }
    try {
      const r = ok(await c.incluirNoBloco(d.sei, bloco, [numero], {}, { aplicar: true }));
      // O app regrava a etapa como `{id}` com este número, para uma retomada não criar outro bloco.
      return { ...r, dados: { ...(r.situacao === "ok" ? r.dados : undefined), bloco } };
    } catch (e) {
      const r = mapearErro(e, { aplicou: true });
      return { ...r, dados: { ...(r.situacao === "ok" ? r.dados : undefined), bloco } };
    }
  };

  const rodar = async (args: unknown, aplicar: boolean): Promise<RespostaEtapa> => {
    const p = lerEtapa(args);
    if (typeof p === "string") return { situacao: "erro", erro: p };
    const { etapa, numero, senha, loteId } = p;
    if (aplicar && !loteId) return { situacao: "erro", erro: "Lote não informado." };
    const assinatura = etapa.acao === "assinar";
    if (aplicar && etapa.acao === "assinar" && !senha) return { situacao: "erro", erro: "Informe a senha para assinar.", parar: true };
    if (aplicar && etapa.acao === "pdf") return { situacao: "erro", erro: "O PDF único é gerado pelo tratador pdf, não por executar." };
    if (aplicar && etapa.acao === "baixar") return etapa.modo === "zip" ? zipAdicionar({ numero, loteId }) : baixarArquivo({ numero });
    if (aplicar && etapa.acao === "incluir-bloco" && "novo" in etapa.bloco) return incluirEmBlocoNovo(etapa.bloco.novo, numero, loteId);
    try {
      return ok(await passo(etapa, numero, senha, aplicar, loteId));
    } catch (e) {
      // O SEI recusa a ciência repetida ("Usuário já deu ciência neste documento."): o estado desejado já existe.
      if (etapa.acao === "ciencia" && ehErroSei(e) && plano(`${e.message} ${e.detalhe ?? ""}`).includes("ja deu ciencia")) {
        return { situacao: "ok", resumo: `Ciência já registrada no documento ${numero}.`, mudancas: [] };
      }
      // Só a escrita de verdade pode ter gravado; a prévia falha sempre como erro comum.
      return mapearErro(e, { aplicou: aplicar && ACOES.find((a) => a.id === etapa.acao)?.escreve === true, assinatura });
    }
  };

  const sanitizarNome = (r: { titulo: string; numero: string; arquivo?: Arquivo; html?: string }) => {
    if (r.arquivo) {
      const ext = extensaoDe(r.arquivo.nome);
      return { nome: nomeArquivo(r.numero, r.titulo, ext), bytes: r.arquivo.bytes, tipo: r.arquivo.tipo || "application/octet-stream" };
    }
    return {
      nome: nomeArquivo(r.numero, r.titulo, "html"),
      bytes: htmlEmUtf8(r.html ?? ""),
      tipo: "text/html;charset=utf-8",
    };
  };

  const baixarArquivo = async (args: unknown): Promise<RespostaEtapa> => {
    const numero = naoVazio((args as { numero?: unknown } | undefined)?.numero);
    if (!numero) return { situacao: "erro", erro: "Documento não informado." };
    try {
      const f = sanitizarNome(await c.conteudo(d.sei, numero));
      entregar(f.bytes, f.nome, f.tipo);
      return { situacao: "ok", resumo: `Arquivo baixado: ${f.nome}`, mudancas: [], dados: { arquivo: f.nome } };
    } catch (e) {
      return mapearErro(e, { aplicou: false });
    }
  };

  const zipAdicionar = async (args: unknown): Promise<RespostaEtapa> => {
    const numero = naoVazio((args as { numero?: unknown } | undefined)?.numero);
    if (!numero) return { situacao: "erro", erro: "Documento não informado." };
    const loteId = naoVazio((args as { loteId?: unknown } | undefined)?.loteId);
    try {
      const f = sanitizarNome(await c.conteudo(d.sei, numero));
      // Um lote cancelado deixa arquivos aqui: outro lote nunca os herda.
      if (loteId !== loteDoZip) {
        zip.descartar();
        loteDoZip = loteId;
      }
      const nome = zip.adicionar(f.nome, f.bytes);
      return { situacao: "ok", resumo: `Guardado para o ZIP: ${nome}`, mudancas: [], dados: { arquivo: nome } };
    } catch (e) {
      return mapearErro(e, { aplicou: false });
    }
  };

  const zipFechar = (args: unknown): RespostaEtapa => {
    const bruto = naoVazio((args as { nome?: unknown } | undefined)?.nome);
    const bytes = zip.fechar();
    loteDoZip = "";
    if (!bytes) return { situacao: "erro", erro: "Nenhum arquivo foi guardado para o ZIP." };
    const nome = nomeArquivo("", (bruto || "documentos").replace(/\.zip$/i, ""), "zip");
    entregar(bytes, nome, "application/zip");
    return { situacao: "ok", resumo: `ZIP baixado: ${nome}`, mudancas: [], dados: { arquivo: nome } };
  };

  const pdf = async (args: unknown): Promise<RespostaEtapa> => {
    const numeros = (Array.isArray((args as { numeros?: unknown } | undefined)?.numeros) ? (args as { numeros: unknown[] }).numeros : [])
      .map(naoVazio)
      .filter(Boolean);
    if (!numeros.length) return { situacao: "erro", erro: "Nenhum documento para o PDF." };
    try {
      const a = await carregarArvore(false);
      const ids: string[] = [];
      const porId = new Map<string, string>();
      for (const n of numeros) {
        const l = a.linhas.find((x) => x.numero === n);
        if (!l) return { situacao: "erro", erro: `O documento ${n} não está na árvore do processo.` };
        ids.push(l.id);
        porId.set(l.id, l.numero);
      }
      const g = await c.gerarPdfDocumentos(d.sei, a.protocolo, ids);
      const arq = await c.baixarLink(d.sei, g.link);
      const nome = nomeArquivo("", g.nome.replace(/\.pdf$/i, "") || `Processo ${a.protocolo}`, "pdf");
      entregar(arq.bytes, nome, "application/pdf");
      const fora = g.foraDoPdf.map((id) => porId.get(id) ?? id);
      const dados: Record<string, string> = { arquivo: nome };
      if (fora.length) dados.foraDoPdf = fora.join(",");
      return {
        situacao: "ok",
        resumo: fora.length ? `PDF baixado: ${nome}. Ficaram de fora: ${fora.join(", ")}.` : `PDF baixado: ${nome}`,
        mudancas: [],
        dados,
      };
    } catch (e) {
      return mapearErro(e, { aplicou: false });
    }
  };

  const destino = async (args: unknown): Promise<RespostaDestino> => {
    const a = (args ?? {}) as Record<string, unknown>;
    const protocolo = naoVazio(a.protocolo);
    const numero = naoVazio(a.numero);
    if (!protocolo) return { situacao: "erro", erro: "Informe o número do processo de destino." };
    try {
      const alvo = await c.resolverProcessoDestino(d.sei, numero || (await documentoDeReferencia(undefined)), protocolo);
      if (alvo.idProcedimento === d.ctx.idProcedimento) return { situacao: "erro", erro: ERRO_DESTINO_IGUAL };
      // De propósito NÃO se confere o sigilo do destino: o `protocolo_RI1023` não devolve o nível de acesso (só id,
      // protocolo e tipo, e já recusa processo que o usuário não pode ver), e abrir a árvore do destino pode registrar
      // "Processo recebido" em nome do usuário (ProcedimentoRN::receber) ou marcá-lo como visualizado. Uma etapa de
      // configuração nunca faz isso; valem as regras do próprio SEI na hora de mover.
      return { situacao: "ok", destino: { protocolo: alvo.protocolo, idProcedimento: alvo.idProcedimento, tipo: alvo.tipo } };
    } catch (e) {
      const r = mapearErro(e, { aplicou: false });
      return { situacao: "erro", erro: r.situacao === "ok" ? TEXTO_INCERTO : r.erro };
    }
  };

  return {
    contexto: () => {
      const { base: _base, linkArvore: _link, ...publico } = d.ctx;
      return publico;
    },
    arvore: (args) => carregarArvore((args as { forcar?: unknown } | undefined)?.forcar === true),
    previa: (args) => rodar(args, false),
    executar: (args) => rodar(args, true),
    cargos: async (args) => {
      const numero = naoVazio((args as { numero?: unknown } | undefined)?.numero);
      if (!numero) throw new Error("Documento não informado.");
      const r = await c.assinarDocumento(d.sei, numero, {}, { aplicar: false });
      return (r.dados?.cargos ?? "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
    },
    blocos: async (): Promise<ItemLista[]> =>
      (await c.listarBlocosParaInclusao(d.sei)).map((b) => ({ id: b.numero, texto: `${b.numero} - ${b.descricao}` })),
    hipoteses: async (args) => {
      const a = (args ?? {}) as Record<string, unknown>;
      const codigo = a.nivel === "restrito" || a.nivel === "1" ? "1" : "";
      if (!codigo) return [];
      return c.hipoteses(d.sei, await documentoDeReferencia(a.numero), codigo);
    },
    contatos: async (args) => {
      const a = (args ?? {}) as Record<string, unknown>;
      return (await c.pesquisarContatos(d.sei, await documentoDeReferencia(a.numero), naoVazio(a.termo))).map(({ id, texto }) => ({
        id,
        texto,
      }));
    },
    assuntos: async (args) => {
      const a = (args ?? {}) as Record<string, unknown>;
      return (await c.pesquisarAssuntos(d.sei, await documentoDeReferencia(a.numero), naoVazio(a.termo))).map(({ id, texto }) => ({
        id,
        texto,
      }));
    },
    destino,
    baixarArquivo,
    zipAdicionar,
    zipFechar,
    zipDescartar: () => {
      zip.descartar();
      loteDoZip = "";
      return true;
    },
    pdf,
    /** Fim do lote: esquece a árvore lida e recarrega, uma vez, a árvore que o usuário vê na tela. */
    recarregarArvore: async () => {
      cache = null;
      c.invalidar(d.sei, d.ctx.idProcedimento);
      recarregarArvoreVisivel(d.documento ?? documentoTopo);
      return true;
    },
    fechar: () => {
      if (!d.fechar) return false;
      d.fechar();
      return true;
    },
    minimizar: (args) => {
      if (!d.minimizar) return false;
      d.minimizar((args as { minimizado?: unknown } | undefined)?.minimizado === true);
      return true;
    },
  };
}

/** Criação do bloco sem confirmação: o documento fica "Confira" e os demais não tentam criar outro bloco. */
const textoBlocoIncerto = (descricao: string): string =>
  `A criação do bloco "${descricao}" não foi confirmada. Confira seus blocos de assinatura no SEI.`;

export type { AcaoId };
