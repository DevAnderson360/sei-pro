/**
 * Os Textos Padrão do Gestor de Demandas (spec 4.2): UM texto por tabela e por escopo.
 *   unidade: [_SEIPRO_DEM_UNIDADE_D], _A, _H     pessoal: [_SEIPRO_DEM_<login>_D], _A, _H
 * Cada texto tem o seu adaptador (e o seu motor, teto, trava e status): o histórico grande demais não impede as
 * demandas de sincronizarem. A mesclagem é por entidade (`repo.importar`); a exportação poda (lápides e histórico) e
 * corta o sigilo (`cortarSigiloDemandas`); itens que colegas gravaram com o relógio adiantado passam adiante
 * (`comOsDoFuturo`), senão a gravação os apagaria do texto até o relógio daqui alcançá-los.
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { assinaturaEstavel, porId } from "@comum/sincronia/assinatura";
import type { AdaptadorTexto } from "@comum/sincronia/motor";
import { nomeDeTextoInterno, type ValidacaoTexto, versaoMaisNova } from "@comum/sincronia/textoPadraoCodec";
import type { Numeros, SigilosConhecidos } from "@projetos/modelo/sigilo";
import { AVISO_TEXTO, chaveSyncTexto, FORMATO, TETO_TEXTO, TETOS_ENVELOPE, VERSAO } from "../modelo/constantes";
import { chaveEscopo } from "../modelo/escopo";
import { cortarSigiloDemandas } from "../modelo/sigilo";
import type { Demanda, EnvelopeDemandas, Escopo, Registro, Tabela, Vis } from "../modelo/tipos";
import { entidadeValida, limparEntidade, RepositorioDemandas } from "../repositorio";

export { AVISO_TEXTO, TETO_TEXTO };

const SUFIXO: Record<Tabela, string> = { d: "D", a: "A", h: "H" };
const NOME_TABELA: Record<Tabela, string> = { d: "demandas", a: "demandas arquivadas", h: "histórico das demandas" };

export function nomeDoTexto(vis: Vis, login: string, tabela: Tabela): string {
  const quem = vis === "unidade" ? "UNIDADE" : login.trim().toLowerCase();
  return nomeDeTextoInterno("DEM", `${quem}_${SUFIXO[tabela]}`);
}

export const descricaoDoTexto = (vis: Vis, tabela: Tabela): string =>
  `${vis === "unidade" ? "Demandas da unidade" : "Demandas pessoais"} (SEI Pro): ${NOME_TABELA[tabela]}. Gerado automaticamente; não edite.`;

/** O parágrafo legível que abre o texto. Sem `<` e `>` (o SEI 5 escapa o conteúdo uma vez a mais). */
export function legivelDemandas(vis: Vis, tabela: Tabela, sigla: string, nomeUsuario: string): string {
  const limpo = (t: string) => t.replace(/[<>]/g, "");
  const de = vis === "unidade" ? `da unidade ${limpo(sigla)}` : `de ${limpo(nomeUsuario)}`;
  return `Dados internos do SEI Pro — ${NOME_TABELA[tabela]} ${de}. Não use em documentos nem edite: o SEI Pro regrava este texto sozinho.`;
}

export const chaveStatusTexto = (e: Escopo, tabela: Tabela): string => chaveSyncTexto(chaveEscopo(e), tabela);

export function validarEnvelope(bruto: unknown, escopo: Escopo, tabela: Tabela): ValidacaoTexto<EnvelopeDemandas> {
  if (versaoMaisNova(bruto, FORMATO, VERSAO)) return { maisNovo: true };
  const b = bruto as Partial<EnvelopeDemandas> | null;
  if (!b || typeof b !== "object" || b.formato !== FORMATO || b.versao !== VERSAO)
    return { invalido: "o texto não está no formato das demandas" };
  if (b.tabela !== tabela) return { invalido: "o texto é de outra tabela" };
  if (b.host !== escopo.host || String(b.unidade) !== escopo.unidade || b.vis !== escopo.vis)
    return { invalido: "o texto é de outro SEI, de outra unidade ou de outra visibilidade" };
  if (escopo.vis === "eu" && (typeof b.login !== "string" || b.login.trim().toLowerCase() !== escopo.login.trim().toLowerCase()))
    return { invalido: "o texto é de outro usuário" };
  const ent = b.entidades as Partial<Record<"d" | "h", unknown>> | undefined;
  if (!ent || typeof ent !== "object") return { invalido: "o texto não tem as demandas" };
  const d = ent.d ?? [];
  const h = ent.h ?? [];
  if (!Array.isArray(d) || !Array.isArray(h)) return { invalido: "o texto não tem as demandas" };
  if ((tabela === "h" ? h : d).length > TETOS_ENVELOPE[tabela]) return { invalido: "o texto tem itens demais" };
  return { ok: { ...(b as EnvelopeDemandas), entidades: { d: d as Demanda[], h: h as Registro[] } } };
}

/** O envelope que vai ao texto: sem números sigilosos. `raspados` é o que o corte tirou (vai para a memória do sigilo). */
export function paraOTexto(env: EnvelopeDemandas, conhecidos: SigilosConhecidos): { envelope: EnvelopeDemandas; raspados: Numeros } {
  const corte = cortarSigiloDemandas(env.entidades.d, conhecidos);
  return { envelope: { ...env, entidades: { ...env.entidades, d: corte.demandas } }, raspados: corte.raspados };
}

const DIA_MS = 86_400_000;

/**
 * Do envelope daqui, os itens do texto que a importação recusou só por virem do futuro (carimbo além de agora + 1
 * dia), no lugar do daqui de mesmo id. Item torto (que nem sem o relógio passaria) não é levado.
 */
export function comOsDoFuturo(env: EnvelopeDemandas, remoto: EnvelopeDemandas | null, agora: number): EnvelopeDemandas {
  if (!remoto) return env;
  const lista = env.tabela === "h" ? "h" : "d";
  // Só o que está até 7 dias à frente (a folga de 1 dia já vem na validação), e limpo pela lista branca.
  const futuros = (remoto.entidades[lista] as unknown[])
    .filter((x) => entidadeValida(x, lista) && !entidadeValida(x, lista, agora) && entidadeValida(x, lista, agora + 6 * DIA_MS))
    .map((x) => limparEntidade(x as Demanda & Registro, lista));
  if (!futuros.length) return env;
  const ids = new Set(futuros.map((x) => (x as { id: string }).id));
  const mantidos = (env.entidades[lista] as Array<{ id: string }>).filter((x) => !ids.has(x.id));
  return { ...env, entidades: { ...env.entidades, [lista]: [...mantidos, ...futuros] } as EnvelopeDemandas["entidades"] };
}

/**
 * O texto lido como este adaptador o gravaria se só tivesse ele (o que a importação recusa fica de fora; a poda e o
 * corte do sigilo valem): o "exportar(importado(lido))" que o motor compara, sem o consentimento, com o daqui.
 */
export async function textoComoGravado(lido: EnvelopeDemandas, escopo: Escopo, agora: number): Promise<EnvelopeDemandas> {
  const repo = new RepositorioDemandas(areaMemoria(), escopo, () => ({ agora, dispositivo: "normalizar" }));
  await repo.importar(lido.entidades, agora);
  const { envelope, conhecidos } = await repo.exportarComConhecidos(lido.tabela, agora);
  return paraOTexto(comOsDoFuturo(envelope, lido, agora), conhecidos).envelope;
}

/** Igual para o mesmo conteúdo em qualquer computador: sem `gerado`, listas pelo id, com a tabela. */
export function assinaturaDemandas(env: EnvelopeDemandas): string {
  return assinaturaEstavel({ t: env.tabela, d: porId(env.entidades.d), h: porId(env.entidades.h) });
}

export interface DepsAdaptador {
  repo: RepositorioDemandas;
  /** chrome.storage.local: a cópia do texto inválido. */
  area: Area;
  tabela: Tabela;
  sigla: string;
  nomeUsuario: string;
}

export const chaveSubstituido = (e: Escopo, tabela: Tabela): string => `demandas/sync/substituido/${chaveEscopo(e)}/${tabela}`;
const LIMITE_GUARDADO = 300 * 1024;
/** O que o motor devolve quando um colega gravou ao mesmo tempo: o app trata como "pendente", não como erro. */
export const MENSAGEM_MUDOU =
  "O texto mudou enquanto era gravado (um colega sincronizando ao mesmo tempo). O SEI Pro tenta de novo em instantes.";

export function adaptadorDemandas(d: DepsAdaptador): AdaptadorTexto<EnvelopeDemandas> {
  const escopo = d.repo.escopo;
  const unidade = escopo.vis === "unidade";
  const nome = NOME_TABELA[d.tabela];
  return {
    modulo: "demandas",
    chaveStatus: chaveStatusTexto(escopo, d.tabela),
    teto: TETO_TEXTO,
    aviso: AVISO_TEXTO,
    legivel: () => legivelDemandas(escopo.vis, d.tabela, d.sigla, d.nomeUsuario),
    validar: (bruto) => validarEnvelope(bruto, escopo, d.tabela),
    async importar(env) {
      await d.repo.importar(env.entidades, d.repo.carimboAtual().agora);
    },
    async exportar({ remoto, agora }) {
      // Entidades e memória do sigilo numa leitura só; se a memória não puder ser lida, lança (o texto não é gravado).
      const { envelope: daqui, conhecidos } = await d.repo.exportarComConhecidos(d.tabela, agora);
      const { envelope, raspados } = paraOTexto(comOsDoFuturo(daqui, remoto, agora), conhecidos);
      // O que o texto raspa fica raspado: vai para a memória ANTES da gravação; se não puder ser guardado, lança.
      await d.repo.lembrarSigilo(raspados, "aprendida");
      return envelope;
    },
    assinatura: assinaturaDemandas,
    vazio: (env) => env.entidades.d.length === 0 && env.entidades.h.length === 0,
    normalizar: (lido, agora) => textoComoGravado(lido, escopo, agora),
    async antesDeRegravarInvalido(motivo, html) {
      await d.area.gravar({
        [chaveSubstituido(escopo, d.tabela)]: {
          quando: d.repo.carimboAtual().agora,
          motivo,
          html: html.slice(0, LIMITE_GUARDADO),
          cortado: html.length > LIMITE_GUARDADO,
        },
      });
    },
    mensagens: {
      maisNovo: `As ${nome} no SEI foram gravadas por uma versão mais nova do SEI Pro. Atualize a extensão neste computador; o texto não foi alterado.`,
      grandeDemais: (kb, tetoKb) =>
        d.tabela === "h"
          ? `O ${nome} passou do limite do Texto Padrão (${kb} KB de ${tetoKb} KB) e não foi gravado; as demandas seguem sincronizando.`
          : `As ${nome} ${unidade ? "da unidade" : "pessoais"} passaram do limite do Texto Padrão (${kb} KB de ${tetoKb} KB) e não foram gravadas. Arquive as concluídas antigas (menu de ajustes) ou exclua as que não usa mais.`,
      pertoDoTeto: (kb) => `As ${nome} estão perto do limite do Texto Padrão (${kb} KB de ${Math.round(TETO_TEXTO / 1024)} KB).`,
      invalidoRegravado: (motivo) =>
        `O texto das ${nome} no SEI estava inválido (${motivo}) e foi regravado a partir deste computador; o texto antigo ficou guardado neste navegador.`,
      mudouDuranteGravacao: MENSAGEM_MUDOU,
      ...(unidade
        ? {
            soLeitura:
              "O SEI não deixa gravar este Texto Padrão com o seu perfil nesta unidade; as demandas dos colegas continuam chegando.",
          }
        : {}),
    },
  };
}
