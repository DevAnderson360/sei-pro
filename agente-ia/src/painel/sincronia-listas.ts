/**
 * As listas que o painel guarda na memória e espelha no `storage.sync`.
 *
 * Saiu do `main.ts` para a sincronia pelo `storage.sync` e a sincronia pelo
 * arquivo poderem ser provadas juntas nos testes: as duas gravam as mesmas
 * listas, e a do sync parte do que o painel tem NA MEMÓRIA — se ela rodar no
 * meio de uma gravação do arquivo, regrava a lista velha por cima.
 */

import { absorverDoSync, type Diario } from "../arquivo/envelope";
import { CHAVE_DIARIO } from "../arquivo/retrato";
import { validarItem } from "../arquivo/validar";
import { guardarConectores, listarConectores, type Conector } from "../mcp/conectores";
import { guardarFluxos, listarFluxos, type Fluxo } from "../fluxos/modelo";
import { aplicarDoSync, espelhar, ESPELHOS, unirNaPrimeiraVez } from "./espelho";
import { guardarMemoria, listarMemoria, type Lembranca } from "./memoria";
import { guardarRegras, listarRegras, type Regra } from "./regras";
import { guardarRotinas, listarRotinas, type Rotina } from "./rotinas";
import { guardarColecoes, guardarSkills, listarColecoes, listarSkills, type ColecaoSkills, type SkillUsuario } from "./skills";

export interface ListasEspelhadas {
  skills: SkillUsuario[];
  colecoes: ColecaoSkills[];
  regras: Regra[];
  memoria: Lembranca[];
  rotinas: Rotina[];
  conectores: Conector[];
  fluxos: Fluxo[];
}

/** O que está no `local` agora (a mesma leitura da abertura do painel). */
export async function lerListasDoLocal(): Promise<ListasEspelhadas> {
  return {
    skills: await listarSkills(),
    colecoes: await listarColecoes(),
    regras: await listarRegras(),
    memoria: await listarMemoria(),
    rotinas: await listarRotinas(),
    conectores: await listarConectores(),
    fluxos: await listarFluxos(),
  };
}

/**
 * Traz do `storage.sync` o que mudou em outro computador e grava no `local`.
 * Na primeira vez é união; depois o `sync` manda, inclusive na exclusão.
 */
export async function trazerDoSync(l: ListasEspelhadas, primeira: boolean): Promise<ListasEspelhadas> {
  const n = { ...l };
  if (primeira) {
    n.skills = await unirNaPrimeiraVez(ESPELHOS.skills, l.skills);
    n.colecoes = await unirNaPrimeiraVez(ESPELHOS.colecoes, l.colecoes);
    n.regras = await unirNaPrimeiraVez(ESPELHOS.regras, l.regras);
    n.memoria = await unirNaPrimeiraVez(ESPELHOS.memoria, l.memoria);
    n.rotinas = await unirNaPrimeiraVez(ESPELHOS.rotinas, l.rotinas);
    n.conectores = await unirNaPrimeiraVez(ESPELHOS.conectores, l.conectores);
    n.fluxos = await unirNaPrimeiraVez(ESPELHOS.fluxos, l.fluxos);
  } else {
    n.skills = (await aplicarDoSync(ESPELHOS.skills, l.skills)).lista;
    n.colecoes = (await aplicarDoSync(ESPELHOS.colecoes, l.colecoes)).lista;
    n.regras = (await aplicarDoSync(ESPELHOS.regras, l.regras)).lista;
    n.memoria = (await aplicarDoSync(ESPELHOS.memoria, l.memoria)).lista;
    n.rotinas = (await aplicarDoSync(ESPELHOS.rotinas, l.rotinas)).lista;
    n.conectores = (await aplicarDoSync(ESPELHOS.conectores, l.conectores)).lista;
    n.fluxos = (await aplicarDoSync(ESPELHOS.fluxos, l.fluxos)).lista;
  }
  // O que veio de fora tem de ficar gravado aqui também: é do `local` que a conversa lê.
  await Promise.all([
    guardarSkills(n.skills),
    guardarColecoes(n.colecoes),
    guardarRegras(n.regras),
    guardarMemoria(n.memoria),
    guardarRotinas(n.rotinas),
    guardarConectores(n.conectores),
    guardarFluxos(n.fluxos),
  ]);
  // Depois de gravar: o diário passa a conhecer o que veio do sync como
  // "não é edição daqui" (ver `absorverDoSync`).
  await absorverNoDiario(l, n);
  return n;
}

/** O que o sync mudou entra no diário do arquivo sem carimbo novo. */
async function absorverNoDiario(antes: ListasEspelhadas, depois: ListasEspelhadas): Promise<void> {
  const d = (await chrome.storage.local.get(CHAVE_DIARIO))[CHAVE_DIARIO] as Diario | undefined;
  if (!d || typeof d !== "object") return;
  let novo = d;
  for (const tipo of Object.keys(depois) as Array<keyof ListasEspelhadas>) novo = absorverDoSync(novo, tipo, antes[tipo], depois[tipo], validarItem);
  if (novo !== d) await chrome.storage.local.set({ [CHAVE_DIARIO]: novo });
}

/**
 * Espelha as listas no `sync` e ESPERA. Os `guardar*` espelham sem esperar;
 * depois de uma gravação do arquivo, a sincronia do `sync` só pode rodar com
 * o `sync` já em dia, senão o item novo que ainda não subiu é lido como
 * excluído (`aplicarDoSync` remove o ausente).
 */
export async function espelharListas(l: ListasEspelhadas): Promise<void> {
  // Uma por vez: cada uma confere a cota antes de gravar.
  await espelhar(ESPELHOS.skills, l.skills);
  await espelhar(ESPELHOS.colecoes, l.colecoes);
  await espelhar(ESPELHOS.regras, l.regras);
  await espelhar(ESPELHOS.memoria, l.memoria);
  await espelhar(ESPELHOS.rotinas, l.rotinas);
  await espelhar(ESPELHOS.conectores, l.conectores);
  await espelhar(ESPELHOS.fluxos, l.fluxos);
}
