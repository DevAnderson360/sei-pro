/**
 * A pergunta do "Entendi" antes de qualquer gravação em "Toda a unidade" feita pelo balão (a mesma regra do app e do
 * balão do Projetos): o repositório da unidade vai embrulhado, e cada método que grava pergunta (uma vez; depois do
 * "Entendi" passa direto). Sem o "Entendi", nada muda. Ler nunca pergunta.
 */

import type { EstadoConsentimento, PortaConsentimento } from "@comum/sincronia/consentimento";
import { ErroValidacao } from "../modelo/validacao";
import type { RepositorioDemandas } from "../repositorio";

/**
 * Os métodos do repositório que gravam no escopo (ler, listar e exportar passam direto). Ficam de fora: `registrar` (só
 * anota o escopo por extenso), `limpar` (só apaga deste navegador lápides que a exportação já poda), `lembrarSigilo` e
 * `marcarSigilosos` (o sigilo que a tela do SEI mostrou é proteção: a marca só tira o número do que vai ao texto, nunca
 * põe nada). Método novo que grava: entra aqui (a prova `verificar-barra.ts` confere).
 */
export const METODOS_QUE_GRAVAM: ReadonlySet<string> = new Set([
  "criar",
  "editar",
  "aplicar",
  "arquivarVarias",
  "descartar",
  "remover",
  "restaurar",
  "duplicar",
  "reordenar",
  "importar",
]);

export const CAMPO_CONSENTIMENTO = "consentimento";
export const MENSAGEM_SEM_ENTENDI = "Sem o “Entendi”, as demandas de “Toda a unidade” não mudam. Para uma demanda só sua, escolha “Só eu”.";
const MENSAGEM_NAO_LEU = "Não foi possível ler a sua confirmação. Tente de novo.";
const MENSAGEM_NAO_GRAVOU = "Não foi possível guardar a sua confirmação. Tente de novo.";

/** O erro do "Agora não" (ou do balão fechado com a pergunta aberta). */
export const semEntendi = (e: unknown): boolean =>
  e instanceof ErroValidacao && e.campo === CAMPO_CONSENTIMENTO && e.message === MENSAGEM_SEM_ENTENDI;

async function estado(porta: PortaConsentimento): Promise<EstadoConsentimento> {
  try {
    return await porta.estado();
  } catch (e) {
    console.warn("[SEI Pro] demandas: consentimento não lido:", e instanceof Error ? e.message : String(e));
    throw new ErroValidacao(CAMPO_CONSENTIMENTO, MENSAGEM_NAO_LEU);
  }
}

/** O mesmo repositório, perguntando antes de gravar. `consentir` resolve true quando pode gravar. */
export function comConsentimento(repo: RepositorioDemandas, consentir: () => Promise<boolean>): RepositorioDemandas {
  return new Proxy(repo, {
    get(alvo, nome, receptor) {
      const v = Reflect.get(alvo, nome, receptor) as unknown;
      if (typeof v !== "function") return v;
      // Com `this` = o repositório cru: o que um método chama por dentro não passa de novo pela pergunta.
      const metodo = (v as (...a: unknown[]) => unknown).bind(alvo);
      if (typeof nome !== "string" || !METODOS_QUE_GRAVAM.has(nome)) return metodo;
      return async (...args: unknown[]) => {
        if (!(await consentir())) throw new ErroValidacao(CAMPO_CONSENTIMENTO, MENSAGEM_SEM_ENTENDI);
        return metodo(...args);
      };
    },
  });
}

/**
 * O "pode gravar em Toda a unidade?": com o consentimento já "ligado", sim sem perguntar; senão pergunta (uma pergunta só,
 * mesmo com várias gravações esperando juntas) e grava o "ligado" no "Entendi".
 */
export function consentidor(porta: PortaConsentimento, perguntar: () => Promise<boolean>): () => Promise<boolean> {
  let pergunta: Promise<boolean> | null = null;
  return async () => {
    if ((await estado(porta)) === "ligado") return true;
    pergunta ??= (async () => {
      try {
        const sim = await perguntar();
        if (sim) {
          try {
            await porta.definir("ligado");
          } catch (e) {
            console.warn("[SEI Pro] demandas: consentimento não gravado:", e instanceof Error ? e.message : String(e));
            throw new ErroValidacao(CAMPO_CONSENTIMENTO, MENSAGEM_NAO_GRAVOU);
          }
        }
        return sim;
      } finally {
        pergunta = null;
      }
    })();
    return pergunta;
  };
}
