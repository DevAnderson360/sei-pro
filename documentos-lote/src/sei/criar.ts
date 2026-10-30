/**
 * Criação do documento de UMA linha do lote (porta de docsLote_formNewDoc, docsLote_confirmDocData,
 * docsLote_editDocContent e docsLote_saveDoc, dist/js/sei-pro-docs-lote.js).
 *
 * 1. `criarDocumento` do núcleo: tipo do modelo por id exato, o modelo como texto inicial (documento →
 *    `txtProtocoloDocumentoTextoBase`; texto padrão → `selTextoPadrao`/`hdnIdTextoPadrao`), nome na árvore (e no
 *    Número, quando o tipo o exige), descrição, nível; observação vazia e os interessados que a tela traz.
 * 2. Uma abertura do editor do documento novo e UMA gravação (`editarSecoes`): em cada seção editável que tem `##`,
 *    só os campos cruzados são trocados pelo valor da linha, escapado (acentos mantidos). Seção sem campo cruzado
 *    não é regravada; nenhum campo cruzado no documento = nenhuma gravação.
 * 3. O link do documento no formato do Link Permanente (sem `infra_hash`).
 *
 * Depois que o POST do cadastro saiu, QUALQUER falha é `ErroDocumentoCriado` (um `ErroSei` com o mesmo código):
 * o documento pode existir, e repetir a linha o duplicaria. `incerto` diz se o id dele é conhecido; sem ele, o app
 * manda conferir a árvore antes de repetir. Antes do POST (tipo ausente, sigilo, texto padrão fora da lista) e
 * quando o SEI recusa o próprio POST (`#txaInfraValidacao`, sessão expirada), nada foi criado: erro simples.
 */

import { descricaoDoc, escaparValor, preencherTexto } from "@dl/modelo/campos";
import { nomeNaArvore } from "@dl/modelo/nomes";
import type { Modelo } from "@dl/sei/modelo";
import { criarDocumento, type DocumentoLocalizado } from "@nucleo/dominio/documento";
import { editarSecoes } from "@nucleo/dominio/editor";
import type { Sei } from "@nucleo/sei";
import { decodificarEntidades } from "@nucleo/sessao/dom";
import { comoErroSei, ErroSei } from "@nucleo/sessao/erros";

export interface PedidoCriar {
  /** Protocolo (ou referência aceita por `sei.arvore`) do processo de destino. */
  processo: string;
  /** Caminho até o `controlador.php` do SEI (como o `origemDoSei` do contexto), para o link do documento. */
  origem: string;
  modelo: Modelo;
  linha: Record<string, string>;
  colunaNome: string;
  /** Descrição com `##coluna##` (vazia = sem descrição). */
  modeloDescricao: string;
  nivel: "publico" | "restrito";
  hipotese?: string;
  /** campo do modelo → coluna do CSV. */
  camposCruzados: Record<string, string>;
}

export interface DocumentoCriado {
  idDocumento: string;
  numero: string;
  link: string;
}

/**
 * O documento foi (ou talvez tenha sido) criado e um passo seguinte falhou: leva o que se sabe dele para o app
 * mostrar e não recriar. `incerto`: não se sabe se ele existe nem qual é (`idDocumento` vazio).
 */
export class ErroDocumentoCriado extends ErroSei {
  readonly documentoCriado: DocumentoCriado;
  readonly incerto: boolean;

  constructor(documento: DocumentoCriado, causa: ErroSei, etapa = "os campos n\u00E3o foram preenchidos") {
    const incerto = !documento.idDocumento;
    super(
      causa.codigo,
      incerto
        ? `O documento talvez tenha sido criado, mas n\u00E3o foi poss\u00EDvel identificar o n\u00FAmero: ${causa.message} Confira a \u00E1rvore do processo antes de repetir a linha.`
        : `O documento ${documento.numero || `(id ${documento.idDocumento})`} foi criado, mas ${etapa}: ${causa.message}`,
      causa.detalhe,
    );
    this.name = "ErroDocumentoCriado";
    this.documentoCriado = documento;
    this.incerto = incerto;
  }
}

/** Link do documento como o Link Permanente: só o caminho até o controlador.php, sem `infra_hash`. */
export function linkDoDocumento(origem: string, idProcedimento: string, idDocumento: string): string {
  return `${origem}?acao=procedimento_trabalhar&id_procedimento=${encodeURIComponent(idProcedimento)}&id_documento=${encodeURIComponent(idDocumento)}`;
}

/** Valores por nome de campo, só dos campos cruzados cuja coluna existe na linha. */
function valoresDosCampos(camposCruzados: Record<string, string>, linha: Record<string, string>): Record<string, string> {
  const valores: Record<string, string> = {};
  for (const [campo, coluna] of Object.entries(camposCruzados)) {
    if (Object.hasOwn(linha, coluna)) valores[nomeDoCampo(campo)] = linha[coluna] as string;
  }
  return valores;
}

/** O nome como o `extrairCampos` do modelo o vê: entidades decodificadas e espaço não separável como espaço. */
const nomeDoCampo = (bruto: string) => decodificarEntidades(bruto).replace(/\u00A0/g, " ");

/**
 * Troca, no HTML de uma seção, só os `##campo##` cruzados, pelo valor escapado. O campo é casado pelo nome
 * normalizado (`##nome&nbsp;completo##` e `##munic&iacute;pio##` no HTML casam "nome completo" e "município");
 * o resto do HTML fica byte a byte como estava.
 */
function trocarCampos(html: string, valores: Record<string, string>): string {
  const daSecao: Record<string, string> = {};
  for (const m of html.matchAll(/##([^#]+?)##/g)) {
    const bruto = m[1] as string;
    const chave = nomeDoCampo(bruto);
    if (Object.hasOwn(valores, chave)) daSecao[bruto] = valores[chave] as string;
  }
  return preencherTexto(html, daSecao, escaparValor);
}

/** Erros com que o SEI recusa o próprio POST: o documento não foi criado. */
const RECUSA_DO_POST = new Set(["SEI_VALIDACAO", "SEI_SESSAO_EXPIRADA"]);

/** Campos mapeados que continuam literais (`##campo##`) no HTML trocado: a troca não pegou (`##` vizinho, etc.). */
function camposSemTroca(htmls: string[], valores: Record<string, string>): string[] {
  const textos = htmls.map(nomeDoCampo);
  return Object.keys(valores).filter((k) => textos.some((t) => t.includes(`##${k}##`)));
}

export async function criarDocumentoDaLinha(sei: Sei, p: PedidoCriar, sinal?: AbortSignal): Promise<DocumentoCriado> {
  const m = p.modelo;
  if (!m.tipoId) throw new ErroSei("ARGUMENTO_INVALIDO", "O modelo n\u00E3o tem o tipo do documento a criar.");
  const nome = nomeNaArvore(p.linha[p.colunaNome] ?? "");

  const cadastro: { fase: "antes" | "enviando" | "enviado"; idDocumento: string; idProcedimento: string } = {
    fase: "antes",
    idDocumento: "",
    idProcedimento: "",
  };
  const conhecido = (numero = ""): DocumentoCriado => ({
    idDocumento: cadastro.idDocumento,
    numero,
    link: cadastro.idDocumento && cadastro.idProcedimento ? linkDoDocumento(p.origem, cadastro.idProcedimento, cadastro.idDocumento) : "",
  });

  let numero = "";
  try {
    const r = await criarDocumento(
      sei,
      p.processo,
      {
        tipo: m.tipoNome ?? m.tipoId,
        tipoId: m.tipoId,
        nomeArvore: nome,
        numeroSeExigido: nome,
        descricao: p.modeloDescricao ? descricaoDoc(p.modeloDescricao, p.linha) : "",
        ...(m.origem === "documento" ? { documentoModelo: m.numero } : { textoPadraoId: m.id }),
        nivel: p.nivel,
        ...(p.hipotese ? { hipotese: p.hipotese } : {}),
        acompanharCadastro: (f) => {
          cadastro.fase = f.fase;
          if (f.fase === "enviado") {
            cadastro.idDocumento = f.idDocumento;
            cadastro.idProcedimento = f.idProcedimento;
          }
        },
      },
      { aplicar: true, sinal },
    );
    numero = String(r.dados?.numero ?? "");
  } catch (e) {
    if (cadastro.fase === "antes") throw e;
    const erro = comoErroSei(e);
    if (cadastro.fase === "enviando" && RECUSA_DO_POST.has(erro.codigo)) throw e;
    throw new ErroDocumentoCriado(conhecido(), erro, "n\u00E3o foi poss\u00EDvel conferi-lo na \u00E1rvore");
  }
  if (!cadastro.idDocumento) {
    throw new ErroDocumentoCriado(
      conhecido(),
      new ErroSei("SEI_RESPOSTA_INESPERADA", "a resposta do SEI n\u00E3o trouxe o id do documento."),
    );
  }

  const documento = conhecido(numero);
  let local: DocumentoLocalizado;
  try {
    const arvore = await sei.arvore(p.processo, { sinal });
    const noNovo = arvore.documentos.find((d) => d.id === cadastro.idDocumento);
    if (!noNovo) throw new ErroSei("SEI_RESPOSTA_INESPERADA", "o documento novo n\u00E3o apareceu na \u00E1rvore do processo.");
    local = { arvore, documento: noNovo };
  } catch (e) {
    throw new ErroDocumentoCriado(documento, comoErroSei(e), "n\u00E3o foi poss\u00EDvel conferi-lo na \u00E1rvore");
  }

  const valores = valoresDosCampos(p.camposCruzados, p.linha);
  if (!Object.keys(valores).length) return documento;
  const trocados: string[] = [];
  try {
    await editarSecoes(
      sei,
      local,
      (s) => {
        if (!s.html.includes("##")) return null;
        const novo = trocarCampos(s.html, valores);
        trocados.push(novo);
        return novo;
      },
      { aplicar: true, sinal },
      { documentoNovo: true },
    );
  } catch (e) {
    throw new ErroDocumentoCriado(documento, comoErroSei(e));
  }
  const sobrando = camposSemTroca(trocados, valores);
  if (sobrando.length) {
    throw new ErroDocumentoCriado(
      documento,
      new ErroSei("SEI_VALIDACAO", `ficaram sem troca: ${sobrando.map((c) => `##${c}##`).join(", ")}. Corrija esses campos no documento.`),
      "nem todos os campos foram preenchidos",
    );
  }
  return documento;
}
