/**
 * Criacao de UM processo com o formulario do tipo ja carregado (porta de procLote_criarUm,
 * procLote_montarPostData e procLote_extrairNumero, dist/js/sei-pro-proc-lote.js; createProc/extractProcId,
 * dist/js/sei-pro-docs-lote.js).
 *
 * Os valores vao como texto e quem codifica em ISO-8859-1 e o `http.enviar` do nucleo: nada de `escape()`, que
 * mandava `%u2014` e o SEI gravava o literal. A especificacao e a observacao passam antes por `paraLatin1`
 * (travessao vira hifen, aspas curvas viram retas) para o corte de 100 caracteres valer sobre o texto final.
 */

import { paraLatin1 } from "@comum/texto/latin1";
import { lerLupa } from "@nucleo/formulario/formulario";
import { parametros } from "@nucleo/links/links";
import type { Sei } from "@nucleo/sei";
import { decodificarEntidades, textoDe } from "@nucleo/sessao/dom";
import { ErroSei } from "@nucleo/sessao/erros";
import type { Pagina } from "@nucleo/sessao/http";
import { AVISO_INTERESSADO } from "../modelo/constantes";
import type { Criado } from "../repositorio";
import { comCampos, type Pares } from "./campos";
import type { FormTipo } from "./formularioTipo";

export interface DadosProcesso {
  especificacao: string;
  interessado?: string;
  observacao?: string;
  nivelAcesso: "0" | "1";
  hipoteseLegal: string;
}

/** Prova de sucesso: o SEI so redireciona para a tela do processo quando o criou. */
export const PROVA_CRIACAO = "controlador.php?acao=procedimento_trabalhar&acao_origem=procedimento_gerar";

export { AVISO_INTERESSADO };

/**
 * O interessado da linha so vale se for um nome EXATO que ja esta na lupa do formulario (e entao ja vai no
 * `hdnInteressados`). Qualquer outro nome exigiria o autocompletar de contatos (segunda etapa): a linha segue
 * sem ele, com aviso.
 */
function interessadoAceito(form: FormTipo, interessado: string | undefined): boolean {
  const nome = (interessado ?? "").trim();
  if (!nome) return true;
  const nomes = lerLupa(form.interessados).map((i) => i.texto.replaceAll("+", " "));
  return nomes.includes(nome) || nomes.includes(paraLatin1(nome));
}

export function montarCampos(form: FormTipo, p: DadosProcesso): Pares {
  return comCampos(form.params, [
    ["rdoNivelAcesso", p.nivelAcesso],
    ["selHipoteseLegal", p.nivelAcesso === "1" ? p.hipoteseLegal : ""],
    ["hdnFlagProcedimentoCadastro", "2"],
    ["rdoProtocolo", "M"],
    ["txaObservacoes", paraLatin1(p.observacao ?? "")],
    ["txtDescricao", paraLatin1(p.especificacao).slice(0, 100).trim()],
    ["hdnAssuntos", form.assuntos],
    ["hdnInteressados", form.interessados],
  ]);
}

/**
 * O protocolo formatado vem no `<title>` da resposta do proprio POST (sem requisicao extra). Regex na string
 * CRUA: ultimo trecho depois de " - "; "Processo" sozinho nao e numero.
 */
export function numeroDoTitulo(html: string): string {
  const titulo = decodificarEntidades(/<title>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? "");
  const numero = (titulo.split(" - ").pop() ?? "").trim();
  return numero && numero.toLowerCase() !== "processo" ? numero : "";
}

/** id do processo criado: o `src` do `#ifrArvore` (como o legado), ou a propria URL final. */
function idDoProcesso(resposta: Pagina): string {
  const arvore = resposta.doc.querySelector("#ifrArvore")?.getAttribute("src");
  const doIframe = arvore ? parametros(decodificarEntidades(arvore)).get("id_procedimento") : null;
  return doIframe ?? parametros(resposta.url).get("id_procedimento") ?? "";
}

export const AVISO_SEM_NUMERO = "numero nao identificado";

/**
 * O SEI confirmou a criacao (URL final de `procedimento_trabalhar` vinda de `procedimento_gerar`), mas a resposta
 * nao trouxe o id do processo. O processo EXISTE: quem chama nunca deve repetir a linha (duplicaria). O codigo
 * continua `SEI_RESPOSTA_INESPERADA` para os tratadores genericos; a distincao e por `instanceof`.
 */
export class ErroProcessoCriado extends ErroSei {
  /** Protocolo lido do `<title>` cru ("" se ausente). */
  readonly numero: string;
  readonly criado = true as const;

  constructor(numero: string, detalhe?: string) {
    super("SEI_RESPOSTA_INESPERADA", "Processo criado, mas o SEI n\u00E3o devolveu o identificador.", detalhe);
    this.name = "ErroProcessoCriado";
    this.numero = numero;
  }
}

/**
 * Depois de um erro de `criarProcesso`: o processo PODE ter sido criado? `true` = desfecho desconhecido ou
 * criacao comprovada: NAO repetir a linha. `false` = comprovadamente nao criado (pode repetir/corrigir).
 */
export function criacaoIncerta(e: unknown): boolean {
  if (e instanceof ErroProcessoCriado) return true;
  if (e instanceof ErroSei) return e.codigo === "SEI_REDE" || e.codigo === "SEI_EXCECAO";
  return false;
}

/**
 * Cria UM processo. Contrato de falha (o envio e a primeira coisa que acontece; todo erro e no envio ou depois):
 *
 * Retorno normal = criado. `aviso` pode trazer "interessado ignorado" e/ou "numero nao identificado" (o SEI
 * confirmou e deu o id, mas o `<title>` nao trouxe o protocolo: `numero` vem "", registrar como criado).
 *
 * NAO criado (garantido; `criacaoIncerta` = false):
 * - `SEI_RESPOSTA_INESPERADA` que nao e `ErroProcessoCriado`: a URL final nao e a prova (o SEI devolveu o formulario);
 * - `SEI_VALIDACAO`: o SEI recusou os dados (`#txaInfraValidacao`);
 * - `SEI_SESSAO_EXPIRADA`: a requisicao caiu no login, nada foi gravado.
 *
 * DESCONHECIDO ou criado (NAO repetir; `criacaoIncerta` = true):
 * - `ErroProcessoCriado`: confirmado sem id (traz `numero` quando o `<title>` tem);
 * - `SEI_REDE`: a resposta se perdeu, o servidor pode ter gravado;
 * - `SEI_EXCECAO`: pagina de erro ou HTTP 5xx, o servidor pode ter gravado antes de falhar.
 */
export async function criarProcesso(sei: Sei, form: FormTipo, p: DadosProcesso): Promise<Criado & { aviso?: string }> {
  const aceito = interessadoAceito(form, p.interessado);
  const resposta = await sei.http.enviar(form.action, montarCampos(form, p));
  if (!resposta.url.includes(PROVA_CRIACAO)) {
    throw new ErroSei(
      "SEI_RESPOSTA_INESPERADA",
      "O SEI n\u00E3o confirmou a cria\u00E7\u00E3o do processo.",
      `${textoDe(resposta.doc.querySelector("title"))}, ${resposta.url.replace(/infra_hash=\w+/, "infra_hash=...")}`,
    );
  }
  const numero = numeroDoTitulo(resposta.html);
  const id = idDoProcesso(resposta);
  if (!id) throw new ErroProcessoCriado(numero, resposta.url.replace(/infra_hash=\w+/, "infra_hash=..."));
  const criado: Criado & { aviso?: string } = {
    numero,
    idProcedimento: id,
    // Entrada no processo sem assinatura: a unica que o SEI aceita (links.ts). Um link assinado guardado no
    // lote valeria so nesta sessao, e hash invalido desloga.
    url: sei.http.absoluta(`controlador.php?acao=procedimento_trabalhar&id_procedimento=${id}`),
  };
  const avisos = [!aceito ? AVISO_INTERESSADO : "", !numero ? AVISO_SEM_NUMERO : ""].filter(Boolean);
  if (avisos.length) criado.aviso = avisos.join("; ");
  return criado;
}
