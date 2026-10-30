/**
 * O lado "Texto Padrão" de toda sincronia do SEI Pro: o nome do texto, o
 * conteúdo gravado (um parágrafo legível + os blocos do codec) e a leitura de
 * volta. O envelope é de quem usa (Favoritos, Projetos): aqui ele só é
 * codificado e decodificado. A validação do envelope é do adaptador (motor.ts).
 */

import { hashCurto } from "../texto";
import { codificar, decodificar, deParagrafos, ErroConteudoGrande, LIMITE_DESCOMPACTADO, paraParagrafos } from "./codec";

/** Todo texto de dados do SEI Pro começa assim (e sai do seletor do SEI: controlePagina.ts). */
export const PREFIXO_TEXTO_INTERNO = "[_SEIPRO_";
/** O limite do campo "Nome" do Texto Padrão no SEI. */
export const LIMITE_NOME_TEXTO = 50;

/** O que o adaptador diz do envelope lido: bom, inválido (com o motivo) ou de versão mais nova do SEI Pro. */
export type ValidacaoTexto<E> = { ok: E } | { invalido: string } | { maisNovo: true };

export type LeituraTexto = { bruto: unknown } | { invalido: string };

/**
 * `[_SEIPRO_<SIGLA>_<chave>]` em até 50 caracteres. Chave longa (login com
 * domínio) fica com o começo, `~` e 8 hexadecimais do hash da chave inteira:
 * logins longos diferentes não colidem. A chave entra como veio: quem chama
 * decide a caixa (login em minúsculas, "UNIDADE" em maiúsculas).
 */
export function nomeDeTextoInterno(sigla: string, chave: string): string {
  const inicio = `${PREFIXO_TEXTO_INTERNO}${sigla}_`;
  const nome = `${inicio}${chave}]`;
  if (nome.length <= LIMITE_NOME_TEXTO) return nome;
  const cabe = LIMITE_NOME_TEXTO - inicio.length - 1 - 8 - 1;
  return `${inicio}${chave.slice(0, cabe)}~${hashCurto(chave).slice(0, 8)}]`;
}

export async function gerarConteudoTexto(legivel: string, envelope: unknown): Promise<string> {
  return paraParagrafos(legivel, await codificar(envelope));
}

/**
 * O JSON guardado no texto, ou o motivo de não haver um (texto editado, vazio, corrompido ou que
 * descompactado passaria de `limite` bytes).
 */
export async function lerConteudoTexto(html: string, limite = LIMITE_DESCOMPACTADO): Promise<LeituraTexto> {
  const b64 = deParagrafos(html);
  if (!b64) return { invalido: "o texto não tem os dados do SEI Pro (foi editado ou está vazio)" };
  try {
    return { bruto: await decodificar(b64, limite) };
  } catch (e) {
    if (e instanceof ErroConteudoGrande) return { invalido: "os dados do texto descompactados passam do limite" };
    return { invalido: "os dados do texto estão corrompidos" };
  }
}

/** Gravado por uma versão mais nova do SEI Pro: esta não entende o formato e não pode regravar por cima. */
export function versaoMaisNova(bruto: unknown, formato: string, versaoAtual: number): boolean {
  const b = bruto as { formato?: unknown; versao?: unknown } | null;
  return b?.formato === formato && typeof b.versao === "number" && b.versao > versaoAtual;
}
