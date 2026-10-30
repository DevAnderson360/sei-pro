/**
 * A pergunta do "Entendi" antes de qualquer gravação em "Toda a unidade" feita
 * pelo app: o repositório da unidade que o app recebe é este, que pergunta
 * (uma vez; depois do "Entendi" passa direto) antes de cada método que grava.
 * Sem o "Entendi", nada muda e o erro diz por quê (o diálogo e o balão já
 * mostram as mensagens do repositório). Ler nunca pergunta.
 */

import type { EstadoConsentimento, PortaConsentimento } from "@comum/sincronia/consentimento";
import { ErroValidacao } from "../../modelo/validacao";
import type { RepositorioProjetos } from "../../repositorio";

/**
 * Os métodos do repositório que gravam no escopo (ler, listar e exportar passam direto). Ficam de fora:
 * - `lapidarMovidos`: o fim de "mover para Só eu" (a cópia já está no "Só eu", e parar no meio deixaria o
 *   projeto nos dois lugares); a saída da unidade espera o "Entendi" na sincronia, com a faixa;
 * - `limpar`: só apaga deste navegador lápides que a exportação já poda (nada muda no texto);
 * - `registrar`: só anota o escopo por extenso (fora das entidades, não vai ao texto);
 * - `lembrarSigilo`: a memória do sigilo deste navegador, que nunca vai a lugar nenhum;
 * - `marcarSigiloso` e `marcarSigilosos` (a carga inteira da tela): o sigilo que a tela do SEI mostrou é proteção
 *   (decisão 10 da P5): a marca só tira o número do que vai ao texto (o vínculo vai vazio), nunca põe nada, então
 *   grava sem perguntar.
 * Método novo no repositório: a prova `verificar-app-colaboracao.ts` exige que ele entre numa das listas.
 */
export const METODOS_QUE_GRAVAM: ReadonlySet<string> = new Set([
  "criarProjeto",
  "editarProjeto",
  "arquivarProjeto",
  "reativarProjeto",
  "removerProjeto",
  "restaurarProjeto",
  "duplicarProjeto",
  "criarFase",
  "renomearFase",
  "removerFase",
  "criarEtapa",
  "duplicarEtapa",
  "editarEtapa",
  "moverDatas",
  "concluirEtapa",
  "concluirSeAberta",
  "reabrirEtapa",
  "removerEtapa",
  "restaurarEtapa",
  "redefinirPlanoOriginal",
  "criarProjetoDeModelo",
  "salvarComoModelo",
  "renomearModelo",
  "removerModelo",
  "importar",
  "anotarVisibilidade",
]);

export const MENSAGEM_SEM_ENTENDI = "Sem o “Entendi”, os projetos de “Toda a unidade” não mudam. Para um projeto só seu, escolha “Só eu”.";
/**
 * O storage.sync (onde os consentimentos moram) recusou: a mensagem é própria. A do erro cru seria a da cota do
 * sync ("QUOTA_BYTES…"), que `mensagemDoErro` traduziria como a do storage.local cheio, e não é.
 */
export const MENSAGEM_CONSENTIMENTO_NAO_GRAVOU = "Não foi possível guardar a sua confirmação. Tente de novo.";
export const MENSAGEM_ESCOLHA_NAO_GRAVOU = "Não foi possível guardar a sua escolha. Tente de novo.";
export const MENSAGEM_CONSENTIMENTO_NAO_LEU = "Não foi possível ler a sua confirmação. Tente de novo.";

/** Lê o consentimento; a falha do storage.sync vira `ErroValidacao` com a mensagem própria. */
export async function estadoDoConsentimento(porta: PortaConsentimento): Promise<EstadoConsentimento> {
  try {
    return await porta.estado();
  } catch (e) {
    console.warn("[SEI Pro] projetos: consentimento não lido:", e instanceof Error ? e.message : String(e));
    throw new ErroValidacao([MENSAGEM_CONSENTIMENTO_NAO_LEU]);
  }
}

/** Grava o consentimento; a falha do storage.sync vira `ErroValidacao` ("confirmação" no ligar, "escolha" no desligar). */
export async function gravarConsentimento(porta: PortaConsentimento, valor: "ligado" | "desligado"): Promise<void> {
  try {
    await porta.definir(valor);
  } catch (e) {
    console.warn("[SEI Pro] projetos: consentimento não gravado:", e instanceof Error ? e.message : String(e));
    throw new ErroValidacao([valor === "ligado" ? MENSAGEM_CONSENTIMENTO_NAO_GRAVOU : MENSAGEM_ESCOLHA_NAO_GRAVOU]);
  }
}

/** O mesmo repositório, perguntando antes de gravar. `consentir` resolve true quando pode gravar. */
export function comConsentimento(repo: RepositorioProjetos, consentir: () => Promise<boolean>): RepositorioProjetos {
  return new Proxy(repo, {
    get(alvo, nome, receptor) {
      const v = Reflect.get(alvo, nome, receptor) as unknown;
      if (typeof v !== "function") return v;
      // Com `this` = o repositório cru: o que um método chama por dentro não passa de novo pela pergunta.
      const metodo = (v as (...a: unknown[]) => unknown).bind(alvo);
      if (typeof nome !== "string" || !METODOS_QUE_GRAVAM.has(nome)) return metodo;
      return async (...args: unknown[]) => {
        if (!(await consentir())) throw new ErroValidacao([MENSAGEM_SEM_ENTENDI]);
        return metodo(...args);
      };
    },
  });
}

/**
 * O "pode gravar em Toda a unidade?" do app: com o consentimento já "ligado", sim sem perguntar;
 * senão pergunta (uma pergunta só, mesmo com várias gravações esperando juntas, como o arraste de
 * várias barras) e grava o "ligado" no "Entendi". O storage.sync que não lê ou não grava o consentimento lança
 * `ErroValidacao` com a mensagem própria (nada é gravado no escopo).
 */
export function consentidor(porta: PortaConsentimento, perguntar: () => Promise<boolean>): () => Promise<boolean> {
  let pergunta: Promise<boolean> | null = null;
  return async () => {
    if ((await estadoDoConsentimento(porta)) === "ligado") return true;
    pergunta ??= (async () => {
      try {
        const sim = await perguntar();
        if (sim) await gravarConsentimento(porta, "ligado");
        return sim;
      } finally {
        pergunta = null;
      }
    })();
    return pergunta;
  };
}
