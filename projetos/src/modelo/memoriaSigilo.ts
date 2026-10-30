/**
 * Memória local do sigilo (rodadas 2 e 3 da Tarefa 4): o que este computador já soube sigiloso, por usuário
 * (`host|login`), valendo para TODOS os escopos dele ("Só eu" e "Toda a unidade"). Dois conjuntos: as chaves
 * de processo (`chaveProtocolo`) e os números de documento. O envelope raspa pela união dela com a regra
 * deduzida (`sigiloDoEnvelope`): o que o texto raspou uma vez continua raspado.
 *
 * - Nunca é enviada: fica sob `prefixoMemoriaSigilo(host, login)` = `projetos/sigilo/<host>|<login>/`,
 *   fora de todo escopo, UMA CHAVE POR NÚMERO (`p/<chave do processo>`, `d/<chave do documento>`, a
 *   `chaveDocumento`: sem os zeros à esquerda; a entrada antiga escrita com eles é lida pela chave), com a
 *   origem no valor. Gravar
 *   uma entrada nunca reescreve as outras: dois contextos (o app e a aba) somando ao mesmo tempo não se
 *   apagam (com uma chave só, a última gravação levava o que a outra tinha somado).
 * - Origem (decidida por quem grava, pela operação; nunca por um campo do item, que vem no texto e qualquer um
 *   copia): "local" é só o que uma gravação deste dispositivo causou (`marcasAoGravar` no repositório): a marca
 *   do campo de vínculo ou de documento que ela mudou, o número marcado nesse campo que sai do estado com ela,
 *   e o que passa a ser marcado ou raspado nos itens vivos e nos registros deste dispositivo. Todo o resto é
 *   "aprendida": a mescla, a montagem do texto, a poda, as cópias ("Quem vê", "Duplicar") e a cascata em lápide
 *   ou em item de colega. Uma aprendida que uma gravação daqui marca vira local.
 * - Nada é despejado, nunca: um colega não consegue empurrar para fora um número sigiloso de verdade.
 *   As locais não têm teto. As aprendidas têm teto de `TETO_APRENDIDAS` (20000) por conjunto: com ele cheio,
 *   uma aprendida nova simplesmente não entra. A cascata conta no teto como qualquer aprendida: marcar um
 *   processo que tinha 40 documentos em lápides de um colega, com só 5 vagas, guarda 5 deles (a prova
 *   "memoria do sigilo quase cheia"); os outros seguem raspados pela regra enquanto a marca estiver no estado.
 *   O teto é aproximado: cada gravação conta as aprendidas que leu, sem trava entre elas, e duas gravações
 *   simultâneas de escopos diferentes (o `importar` do "Só eu" e o da unidade, cada um com a sua trava) podem
 *   passar dele: cada uma soma no máximo o que faltava quando leu,
 *   então o excesso é o que a outra somou no meio (nunca o dobro do teto). As entradas são chaves separadas:
 *   nenhuma apaga a outra, e a gravação seguinte, cheia, não soma mais nada.
 * - Custo do teto cheio: este computador não fica sabendo do sigilo de um número pelo colega. Enquanto a
 *   marca está no estado daqui (o sigilo gruda), nada vaza; quando ela sai por uma gravação DESTE dispositivo
 *   (tirar ou trocar o documento ou o processo), o número entra como local e continua raspado. O que sobra é a
 *   saída feita pelo COLEGA: um número que ficou sigiloso aqui só pela marca dele e está num registro escrito
 *   aqui volta a ir no texto gravado daqui quando o colega troca o processo, e os dois regravam o texto a cada
 *   rodada (o vai-e-volta da rodada 1), até o número ser marcado aqui. Fechar isso pediria um índice local dos
 *   registros criados aqui.
 * - Falha fechada: a leitura que não dá (erro do storage) vira `ErroMemoriaSigilo` (quem lê o storage a
 *   embrulha: o repositório e o arquivo), com uma mensagem que serve ao texto, ao arquivo e à cópia, e nada é
 *   gravado. É a única forma de a memória ficar ilegível: numa entrada por número, o valor torto não perde nada
 *   (o número está na chave) e conta como local. A chave única da rodada 2 da Tarefa 4 (`projetos/sigilo/<host>|<login>`,
 *   sem a barra) só existiu na branch de desenvolvimento e não é lida.
 */

import type { SigilosConhecidos } from "./sigilo";
import { chaveDocumento } from "./vinculos";

export const TETO_APRENDIDAS = 20_000;

export type OrigemSigilo = "local" | "aprendida";

export interface MemoriaSigilo {
  processos: ReadonlyMap<string, OrigemSigilo>;
  documentos: ReadonlyMap<string, OrigemSigilo>;
}

export interface NumerosSigilosos {
  processos: Iterable<string>;
  documentos: Iterable<string>;
}

/**
 * A memória do sigilo não pôde ser lida (erro do storage): nada que dependa dela é gravado (o texto, o arquivo, a
 * cópia, a mescla). `causa` é o erro original do storage.
 */
export class ErroMemoriaSigilo extends Error {
  constructor(causa?: unknown) {
    super("Não foi possível ler a lista de processos sigilosos deste computador. Nada foi gravado; tente de novo.", { cause: causa });
    this.name = "ErroMemoriaSigilo";
  }
}

/** Número que cabe numa entrada: texto de 1 a 64 caracteres (os de verdade têm até 40). */
const numeroValido = (x: unknown): x is string => typeof x === "string" && x.length > 0 && x.length <= 64;

/** A memória a partir das chaves lidas do storage (`itens` pode ter outras: são ignoradas). Nunca lança. */
export function lerMemoria(itens: Record<string, unknown>, prefixo: string): MemoriaSigilo {
  const processos = new Map<string, OrigemSigilo>();
  const documentos = new Map<string, OrigemSigilo>();
  const pos = (m: Map<string, OrigemSigilo>, n: string, o: OrigemSigilo) => {
    if (m.get(n) !== "local") m.set(n, o);
  };
  for (const [k, v] of Object.entries(itens)) {
    if (!k.startsWith(prefixo)) continue;
    const resto = k.slice(prefixo.length);
    const conjunto = resto.startsWith("p/") ? processos : resto.startsWith("d/") ? documentos : null;
    const numero = conjunto === documentos ? chaveDocumento(resto.slice(2)) : resto.slice(2);
    // Tipo que esta versão não conhece (de uma versão mais nova) ou número vazio: nada a usar aqui, e nunca é regravado.
    if (!conjunto || !numero) continue;
    pos(conjunto, numero, v === "aprendida" ? "aprendida" : "local");
  }
  return { processos, documentos };
}

/**
 * As entradas a gravar para guardar `novos` com a `origem`, sem nunca tirar nada:
 * - "local": entra o que falta; com `promover`, a aprendida que já estava vira local (vista aqui);
 * - "aprendida": entra o que falta, enquanto as aprendidas daquele conjunto não chegam ao `teto`.
 * Devolve só o que muda (chave completa → origem).
 */
export function entradasParaGravar(
  atual: MemoriaSigilo,
  novos: NumerosSigilosos,
  origem: OrigemSigilo,
  prefixo: string,
  o: { promover?: boolean; teto?: number } = {},
): Record<string, OrigemSigilo> {
  const teto = o.teto ?? TETO_APRENDIDAS;
  const saida: Record<string, OrigemSigilo> = {};
  for (const [letra, campo] of [
    ["p", "processos"],
    ["d", "documentos"],
  ] as const) {
    const m = new Map(atual[campo]);
    let aprendidas = [...m.values()].filter((x) => x === "aprendida").length;
    for (const bruto of novos[campo]) {
      // O documento entra pela chave (o mesmo número escrito com zero à esquerda é a mesma entrada).
      const n = campo === "documentos" && typeof bruto === "string" ? chaveDocumento(bruto) : bruto;
      if (!numeroValido(n)) continue;
      const ja = m.get(n);
      if (origem === "local") {
        if (ja === "local" || (ja === "aprendida" && !o.promover)) continue;
        if (ja === "aprendida") aprendidas--;
        m.set(n, "local");
        saida[`${prefixo}${letra}/${n}`] = "local";
      } else {
        if (ja !== undefined || aprendidas >= teto) continue;
        aprendidas++;
        m.set(n, "aprendida");
        saida[`${prefixo}${letra}/${n}`] = "aprendida";
      }
    }
  }
  return saida;
}

/** A memória com as `entradas` (de `entradasParaGravar`) aplicadas. */
export function comEntradas(atual: MemoriaSigilo, entradas: Record<string, OrigemSigilo>, prefixo: string): MemoriaSigilo {
  const processos = new Map(atual.processos);
  const documentos = new Map(atual.documentos);
  for (const [k, v] of Object.entries(entradas)) {
    const resto = k.slice(prefixo.length);
    (resto.startsWith("p/") ? processos : documentos).set(resto.slice(2), v);
  }
  return { processos, documentos };
}

export function conhecidosDe(m: MemoriaSigilo): SigilosConhecidos {
  return { processos: new Set(m.processos.keys()), documentos: new Set(m.documentos.keys()) };
}
