/**
 * O que o app do Link Permanente pede à aba do SEI: o contexto, os números dos
 * processos selecionados na tela de controle e a localização de cada referência
 * (que usa a sessão da aba, por isso roda aqui e não no app).
 */
import type { Tratador } from "@comum/ponte/rpc";
import type { Sei } from "@nucleo/sei";
import { ehErroSei } from "@nucleo/sessao/erros";
import { montarLink } from "../modelo/link";
import type { ContextoLink } from "./contexto";

export interface DepsExecutor {
  doc: Document;
  sei: Pick<Sei, "localizar">;
  ctx: ContextoLink;
  /** Só no modal: tira o iframe da tela. */
  fechar?: () => void;
  minimizar?: (minimizado: boolean) => void;
}

export type ResultadoLocalizar =
  | { situacao: "ok"; idProcedimento: string; idDocumento?: string; link: string }
  | { situacao: "nao-encontrado" | "sem-acesso" | "erro"; erro?: string; parar?: boolean };

/** Porta de getProcessoUnidadePro(selected=false): 3ª coluna (fora a de anotação), primeiro link, sem repetição. */
function numerosDaTela(doc: Document): string[] {
  const vistos = new Set<string>();
  for (const tr of doc.querySelectorAll("#tblProcessosRecebidos tr, #tblProcessosGerados tr, #tblProcessosDetalhado tr")) {
    const celulas = [...tr.children].filter((c) => c.localName === "td" && !c.classList.contains("spro-anotacao-coluna"));
    const numero = (celulas[2]?.querySelector("a")?.textContent ?? "").trim();
    if (numero) vistos.add(numero);
  }
  return [...vistos];
}

async function localizar(d: DepsExecutor, ref: string): Promise<ResultadoLocalizar> {
  try {
    const l = await d.sei.localizar(ref);
    const r: ResultadoLocalizar = {
      situacao: "ok",
      idProcedimento: l.idProcedimento,
      link: montarLink(d.ctx.base, l.idProcedimento, l.idDocumento),
    };
    if (l.idDocumento) r.idDocumento = l.idDocumento;
    return r;
  } catch (e) {
    const erro = e instanceof Error ? e.message : String(e);
    if (!ehErroSei(e)) return { situacao: "erro", erro };
    switch (e.codigo) {
      case "SEI_NAO_ENCONTRADO":
        return { situacao: "nao-encontrado", erro };
      case "SEI_SIGILOSO":
      case "SEI_ACAO_INDISPONIVEL":
        return { situacao: "sem-acesso", erro };
      // Sem sessão, todas as próximas também falham: o executor para a fila.
      case "SEI_SESSAO_EXPIRADA":
        return { situacao: "erro", erro, parar: true };
      default:
        return { situacao: "erro", erro };
    }
  }
}

export function tratadoresLinkPermanente(d: DepsExecutor): Record<string, Tratador> {
  return {
    contexto: () => {
      const { base: _base, ...publico } = d.ctx;
      return publico;
    },
    selecionados: () => numerosDaTela(d.doc),
    localizar: (args) => localizar(d, String((args as { ref?: unknown } | undefined)?.ref ?? "")),
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
