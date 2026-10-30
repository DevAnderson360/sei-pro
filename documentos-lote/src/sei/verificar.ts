/**
 * Verificacao do processo de destino de uma linha do lote (spec, secao 5): a coluna do CSV pode trazer qualquer
 * texto de uma palavra, e quem decide se e um processo REAL em que o usuario pode gerar o tipo escolhido e esta
 * verificacao, pelo mesmo caminho do usuario (pesquisa rapida, arvore, tela "Gerar Documento").
 *
 * Nunca lanca: tudo vira um `StatusProcesso`. A arvore e lida com `forcar` (reverificar depois de abrir o processo
 * na unidade nao pode cair no cache de 30 s do `Sei`). O cache `localizados` do `Sei` so guarda SUCESSOS (o
 * `localizar` que lanca nao grava nada), entao um "nao encontrado" que passa a encontrado nao e afetado.
 *
 * `linkArvore` e o link assinado da arvore: fica so na aba (a ponte nao o entrega ao app).
 */

import { acaoNaArvore } from "@nucleo/dominio/arvore";
import { tiposDocumento } from "@nucleo/dominio/documento";
import type { Sei } from "@nucleo/sei";
import { comoErroSei } from "@nucleo/sessao/erros";

export type StatusProcesso = "ok" | "nao-encontrado" | "sigiloso" | "nao-aberto" | "tipo-indisponivel" | "erro-rede";

export interface ResultadoVerificacao {
  numero: string;
  status: StatusProcesso;
  idProcedimento?: string;
  linkArvore?: string;
  mensagem?: string;
}

const CANCELADO = "Verificação cancelada.";

export async function verificarProcesso(sei: Sei, numero: string, tipoId: string, sinal?: AbortSignal): Promise<ResultadoVerificacao> {
  const ref = numero.trim();
  const falha = (status: StatusProcesso, mensagem: string, extra: Partial<ResultadoVerificacao> = {}): ResultadoVerificacao => ({
    numero,
    status,
    mensagem,
    ...extra,
  });
  if (!ref) return falha("nao-encontrado", "Informe o número do processo.");
  if (sinal?.aborted) return falha("erro-rede", CANCELADO);

  // O que já se sabe do processo, para as respostas que o devolvem (abrir em outra aba).
  let achado: { idProcedimento: string; linkArvore: string } | undefined;
  try {
    const loc = await sei.localizar(ref, { sinal });
    if (loc.idDocumento) {
      // O número era de um DOCUMENTO: o processo dele não é o destino que o usuário escreveu.
      return falha("nao-encontrado", `"${ref}" é o número de um documento SEI, não de um processo.`);
    }
    achado = { idProcedimento: loc.idProcedimento, linkArvore: loc.linkArvore };

    const arv = await sei.arvore(ref, { sinal, forcar: true });
    if (arv.nivel === "sigiloso") {
      return falha("sigiloso", "Processo sigiloso: o lote não atua nele.", { idProcedimento: achado.idProcedimento });
    }
    if (!acaoNaArvore(arv, "documento_escolher_tipo")) {
      return falha("nao-aberto", "O processo não está aberto nesta unidade.", achado);
    }
    const tipos = await tiposDocumento(sei, ref, sinal);
    if (!tipos.some((t) => t.id === tipoId)) {
      return falha("tipo-indisponivel", "O tipo de documento do modelo não está disponível neste processo.", achado);
    }
    return { numero, status: "ok", ...achado };
  } catch (e) {
    const erro = comoErroSei(e);
    switch (erro.codigo) {
      case "SEI_NAO_ENCONTRADO":
        return falha("nao-encontrado", erro.message);
      case "SEI_SIGILOSO":
        return falha("sigiloso", erro.message, achado ? { idProcedimento: achado.idProcedimento } : {});
      case "SEI_ACAO_INDISPONIVEL":
        // A tela de tipos disse que não se pode incluir documento: o processo não está aberto aqui.
        return falha("nao-aberto", erro.message, achado ?? {});
      case "CANCELADO":
        return falha("erro-rede", CANCELADO);
      default:
        return falha("erro-rede", erro.message);
    }
  }
}
