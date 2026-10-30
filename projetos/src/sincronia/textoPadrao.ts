/**
 * Os Textos Padrão do gestor de projetos (spec 6.1): o da unidade
 * `[_SEIPRO_PRJ_UNIDADE]`, de todos da unidade, e o pessoal
 * `[_SEIPRO_PRJ_<login>]`. Aqui fica o adaptador do motor genérico
 * (`@comum/sincronia/motor`): o envelope de UM escopo, a validação (mesmo SEI,
 * unidade e visibilidade e, no pessoal, o login; versão maior = "mais novo"),
 * a privacidade dos sigilosos, a poda e a assinatura.
 *
 * Privacidade (spec 5.4): o número de processo sigiloso nunca vai (o vínculo
 * vai vazio, marcado sigiloso), nem o número do documento de etapa sigilosa
 * (processo próprio sigiloso, ou nenhum processo próprio num projeto sigiloso):
 * o documento vai como o marcador `{ numero: "", sigiloso: true }`; registros
 * antigos do histórico com o número de um processo que hoje é sigiloso vão com
 * "processo sigiloso". O que é sigiloso vem de `sigiloDoEnvelope`, a mesma
 * regra que a mescla de volta usa (`importar`): quem tem os números os mantém
 * (`manterNumeroSigiloso`, `manterDocumentoSigiloso`) e a própria cópia que
 * volta do texto não é regravada. A marca gravada (o sigilo gruda,
 * `marcasDeSigilo`) e a memória do sigilo valem também: documento marcado ou de
 * número conhecido como sigiloso vai como o marcador, em qualquer etapa, e o
 * número dele não vai nos registros, mesmo que a etapa tenha deixado de ser
 * sigilosa.
 *
 * Poda na exportação: lápides de mais de 180 dias (unidade) ou 90 (pessoal) e
 * o histórico além dos 300 registros mais recentes ficam de fora; e, com o
 * projeto que ficou de fora, as fases, as etapas e os registros dele (órfãos,
 * que a importação de um colega recusaria: levá-los faria o texto ir e voltar).
 *
 * Sem o consentimento, o motor compara o envelope daqui com o texto lido como
 * este adaptador o gravaria (`textoComoGravado`): a poda e o que a importação
 * recusa (o texto editado à mão) não fazem aparecer a faixa do "Entendi".
 */

import { type Area, areaMemoria } from "@comum/armazenamento/area";
import { assinaturaEstavel, jsonEstavel, porId } from "@comum/sincronia/assinatura";
import { purgarLapides } from "@comum/sincronia/entidade";
import type { AdaptadorTexto } from "@comum/sincronia/motor";
import { nomeDeTextoInterno, type ValidacaoTexto, versaoMaisNova } from "@comum/sincronia/textoPadraoCodec";
import { chaveSyncTexto, diasDeLapide, FOLGA_RELOGIO_MS, LIMITES } from "../modelo/constantes";
import { chaveEscopo } from "../modelo/escopo";
import { excedentes, projetosQueFicam } from "../modelo/historico";
import { cortarSigilo, NADA_CONHECIDO, type Numeros, type SigilosConhecidos, sigiloDoEnvelope } from "../modelo/sigilo";
import type { Entidades, EnvelopeProjetos, Escopo, Etapa, Projeto, Vis } from "../modelo/tipos";
import { semVinculoVazio } from "../modelo/vinculos";
import { entidadeValida, RepositorioProjetos } from "../repositorio";

/** O CKEditor 5 baixa o conteúdo de todos os textos da unidade (como nos Favoritos). */
export const TETO_TEXTO = 100 * 1024;
export const AVISO_TEXTO = 80 * 1024;
export const FORMATO = "seipro-projetos";
export const VERSAO = 1;

/** Quantidades que nenhum texto legítimo de 100 KB alcança: acima, o texto é tratado como inválido. */
export const TETOS_ENVELOPE: Readonly<Record<keyof Entidades, number>> = { p: 2000, f: 20_000, e: 60_000, h: 5000, m: 500 };

export { SIGILOSO_DOCUMENTO, SIGILOSO_PROCESSO } from "../modelo/sigilo";

/** Quem lê o texto da unidade mas não pode gravá-lo (só o link de consultar): o que muda e o que continua. */
export const MENSAGEM_SO_LEITURA_UNIDADE =
  "O SEI não deixa gravar este Texto Padrão com o seu perfil nesta unidade; os projetos dos colegas continuam chegando.";

/** A desistência depois das releituras: o motor tenta de novo sozinho (o app mostra como "pendente"). */
export const MENSAGEM_MUDOU =
  "O texto mudou enquanto era gravado (um colega sincronizando ao mesmo tempo). O SEI Pro tenta de novo em instantes.";

/** `[_SEIPRO_PRJ_UNIDADE]` ou `[_SEIPRO_PRJ_<login>]` (login longo encurtado como nos Favoritos). */
export function nomeDoTexto(vis: Vis, login: string): string {
  return nomeDeTextoInterno("PRJ", vis === "unidade" ? "UNIDADE" : login.trim().toLowerCase());
}

export function descricaoDoTexto(vis: Vis): string {
  return vis === "unidade"
    ? "Projetos da unidade (SEI Pro). Gerado automaticamente; não edite."
    : "Projetos pessoais (SEI Pro). Gerado automaticamente; não edite.";
}

/**
 * O parágrafo legível que abre o texto. Sigla e nome vêm do SEI e vão sem `<` e `>`: o SEI 5 devolve o
 * conteúdo escapado mais uma vez e a leitura desfaz o escape, então um `</p>` ali partiria o parágrafo e
 * o texto ficaria inválido (e seria regravado a cada rodada).
 */
export function legivelProjetos(vis: Vis, sigla: string, nomeUsuario: string): string {
  const limpo = (t: string) => t.replace(/[<>]/g, "");
  const de = vis === "unidade" ? `da unidade ${limpo(sigla)}` : `de ${limpo(nomeUsuario)}`;
  return `Dados internos do SEI Pro — projetos ${de}. Não use em documentos nem edite: o SEI Pro regrava este texto sozinho.`;
}

/** Chaves (chrome.storage.local) do que a sincronia deste escopo anota além do status. */
export const chaveRelatorio = (e: Escopo): string => `projetos/sync/relatorio/${chaveEscopo(e)}`;
export const chaveSubstituido = (e: Escopo): string => `projetos/sync/substituido/${chaveEscopo(e)}`;
export const chaveStatusTexto = (e: Escopo): string => chaveSyncTexto(chaveEscopo(e));

/** O que a última leitura do texto deixou de fora (o diálogo explica; `futuros` = relógio daqui atrasado). */
export interface RelatorioImportacao {
  quando: number;
  ignorados: number;
  excedentes: number;
  futuros: number;
}

/** O texto que estava inválido e foi regravado: guardado neste navegador (o último, por escopo). */
export interface TextoSubstituido {
  quando: number;
  motivo: string;
  html: string;
  cortado: boolean;
}

/** Até 300 KB do texto inválido ficam guardados (o storage.local tem 10 MB). */
const LIMITE_GUARDADO = 300 * 1024;

const LISTAS = ["p", "f", "e", "h", "m"] as const;

export function validarEnvelope(bruto: unknown, escopo: Escopo): ValidacaoTexto<EnvelopeProjetos> {
  // Gravado por uma versão mais nova do SEI Pro: não é "inválido", e esta versão não pode regravar por cima.
  if (versaoMaisNova(bruto, FORMATO, VERSAO)) return { maisNovo: true };
  const b = bruto as Partial<EnvelopeProjetos> | null;
  if (!b || typeof b !== "object" || b.formato !== FORMATO || b.versao !== VERSAO)
    return { invalido: "o texto não está no formato dos projetos" };
  if (b.host !== escopo.host || String(b.unidade) !== escopo.unidade || b.vis !== escopo.vis)
    return { invalido: "o texto é de outro SEI, de outra unidade ou de outra visibilidade" };
  if (escopo.vis === "eu" && (typeof b.login !== "string" || b.login.trim().toLowerCase() !== escopo.login.trim().toLowerCase()))
    return { invalido: "o texto é de outro usuário" };
  const ent = b.entidades as Partial<Record<keyof Entidades, unknown>> | undefined;
  if (!ent || typeof ent !== "object") return { invalido: "o texto não tem os projetos" };
  const entidades = {} as Record<keyof Entidades, unknown[]>;
  for (const k of LISTAS) {
    const lista = ent[k] ?? [];
    if (!Array.isArray(lista)) return { invalido: "o texto não tem os projetos" };
    if (lista.length > TETOS_ENVELOPE[k]) return { invalido: "o texto tem itens demais" };
    entidades[k] = lista;
  }
  return { ok: { ...(b as EnvelopeProjetos), entidades: entidades as unknown as Entidades } };
}

/**
 * O envelope que vai ao Texto Padrão: sem números sigilosos e podado (lápides e histórico), e tudo o que o
 * corte raspou (chaves de processo e números de documento). `conhecidos` (a memória do sigilo do usuário)
 * soma-se à regra deduzida do envelope. Puro: quem grava o que foi raspado na memória é quem monta o texto
 * para gravar (o adaptador), antes da gravação.
 */
export function paraOTextoComRaspados(
  env: EnvelopeProjetos,
  agora: number,
  conhecidos: SigilosConhecidos = NADA_CONHECIDO,
): { envelope: EnvelopeProjetos; raspados: Numeros } {
  const dias = diasDeLapide(env.vis);
  const ent = env.entidades;
  // A regra sobre tudo, antes da poda: a marca de uma lápide que sai ainda vale para os outros.
  const sigilo = sigiloDoEnvelope(ent.p, ent.e, conhecidos);
  const projetos = purgarLapides(ent.p, agora, dias);
  // Só o que tem o projeto no texto (vivo ou lápide): o órfão seria recusado por quem lê. O mesmo predicado dos
  // cortes daqui (`projetosQueFicam`); o registro do futuro fica atrás dos outros no corte dos 300.
  const ids = projetosQueFicam(ent.p, agora, dias);
  const doProjeto = <T extends { projeto: string }>(lista: T[]): T[] => lista.filter((x) => ids.has(x.projeto));
  const vivosH = doProjeto(purgarLapides(ent.h, agora, dias));
  const fora = new Set(excedentes(vivosH, LIMITES.historico, agora));
  // O raspado mantém id e carimbo: na volta, o `importar` reconhece o mesmo registro e fica com o daqui.
  const corte = cortarSigilo(
    { p: projetos, e: doProjeto(purgarLapides(ent.e, agora, dias)), h: vivosH.filter((r) => !fora.has(r.id)) },
    sigilo,
  );
  return {
    envelope: {
      ...env,
      entidades: {
        p: corte.p,
        f: doProjeto(purgarLapides(ent.f, agora, dias)),
        e: corte.e,
        h: corte.h,
        m: purgarLapides(ent.m, agora, dias),
      },
    },
    raspados: corte.raspados,
  };
}

/** O envelope que vai ao Texto Padrão (sem o que foi raspado: ver `paraOTextoComRaspados`). */
export function paraOTexto(env: EnvelopeProjetos, agora: number, conhecidos: SigilosConhecidos = NADA_CONHECIDO): EnvelopeProjetos {
  return paraOTextoComRaspados(env, agora, conhecidos).envelope;
}

/**
 * O envelope daqui com os itens do texto que o `importar` recusou só por virem do futuro (carimbo além de
 * `agora` + 1 dia: o relógio daqui está atrasado), na versão do texto e no lugar da daqui de mesmo id.
 * Sem isso, a gravação apagaria do texto o trabalho dos colegas até o relógio daqui alcançá-lo, e eles o
 * regravariam a cada rodada. Item torto (que nem sem o relógio passaria) não é levado.
 */
export function comOsDoFuturo(env: EnvelopeProjetos, remoto: EnvelopeProjetos | null, agora: number): EnvelopeProjetos {
  if (!remoto) return env;
  const entidades = { ...env.entidades };
  for (const k of LISTAS) {
    // Como na importação (`semVinculoVazio`): o vínculo que não diz processo nenhum sai, e a etapa herda o do projeto.
    const futuros = ((remoto.entidades[k] ?? []) as unknown[])
      .filter((x) => entidadeValida(x, k) && !entidadeValida(x, k, agora))
      .map((x) => (k === "p" || k === "e" ? semVinculoVazio(x as Projeto | Etapa) : x));
    if (!futuros.length) continue;
    const ids = new Set(futuros.map((x) => (x as { id: string }).id));
    (entidades as Record<string, unknown[]>)[k] = [...entidades[k].filter((x) => !ids.has(x.id)), ...futuros];
  }
  return { ...env, entidades };
}

/**
 * O texto lido como este adaptador o gravaria se só tivesse ele: importado num repositório vazio (em memória, que
 * nada grava: o que a importação recusa fica de fora) e exportado com a poda e o corte do sigilo (o que o próprio
 * envelope marca). É o "exportar(importado(lido))" que o motor compara, sem o consentimento, com o envelope daqui.
 */
export async function textoComoGravado(lido: EnvelopeProjetos, escopo: Escopo, agora: number): Promise<EnvelopeProjetos> {
  const repo = new RepositorioProjetos(areaMemoria(), escopo, () => ({ agora, dispositivo: "normalizar" }));
  await repo.importar(lido.entidades);
  const { envelope, conhecidos } = await repo.exportarComConhecidos(agora);
  return paraOTexto(comOsDoFuturo(envelope, lido, agora), agora, conhecidos);
}

/** Igual para o mesmo conteúdo em qualquer computador: sem `gerado`, listas pelo id. */
export function assinaturaProjetos(env: EnvelopeProjetos): string {
  const e = env.entidades;
  return assinaturaEstavel({ p: porId(e.p), f: porId(e.f), e: porId(e.e), h: porId(e.h), m: porId(e.m) });
}

/** Itens com carimbo mais de 1 dia à frente do relógio daqui: a importação os recusa (relógio atrasado?). */
export function contarFuturos(ent: Partial<Entidades>, agora: number): number {
  const teto = agora + FOLGA_RELOGIO_MS;
  let n = 0;
  for (const k of LISTAS) {
    for (const x of (ent[k] ?? []) as unknown[]) {
      const o = x as { atualizadoEm?: unknown; removidoEm?: unknown } | null;
      if ((typeof o?.atualizadoEm === "number" && o.atualizadoEm > teto) || (typeof o?.removidoEm === "number" && o.removidoEm > teto)) n++;
    }
  }
  return n;
}

export interface DepsAdaptador {
  repo: RepositorioProjetos;
  /** chrome.storage.local: relatório da leitura e cópia do texto inválido. */
  area: Area;
  sigla: string;
  nomeUsuario: string;
}

export function adaptadorProjetos(d: DepsAdaptador): AdaptadorTexto<EnvelopeProjetos> {
  const escopo = d.repo.escopo;
  const unidade = escopo.vis === "unidade";
  return {
    modulo: "projetos",
    chaveStatus: chaveStatusTexto(escopo),
    teto: TETO_TEXTO,
    aviso: AVISO_TEXTO,
    legivel: () => legivelProjetos(escopo.vis, d.sigla, d.nomeUsuario),
    validar: (bruto) => validarEnvelope(bruto, escopo),
    async importar(env) {
      const agora = d.repo.carimboAtual().agora;
      const futuros = contarFuturos(env.entidades, agora);
      const r = await d.repo.importar(env.entidades);
      const k = chaveRelatorio(escopo);
      const anterior = (await d.area.obter(k))[k] as RelatorioImportacao | undefined;
      const novo: RelatorioImportacao = { quando: agora, ignorados: r.ignorados, excedentes: r.excedentes, futuros };
      // Só grava quando muda (o "quando" não conta): uma escrita por rodada à toa acordaria todos os ouvintes.
      const sem = (x?: RelatorioImportacao) => (x ? jsonEstavel({ ...x, quando: 0 }) : "");
      if (sem(anterior) !== sem(novo) && (anterior || r.ignorados || futuros)) await d.area.gravar({ [k]: novo });
    },
    // Os itens do futuro passam pelo mesmo corte (o que já veio cortado sai igual).
    async exportar({ remoto, agora }) {
      // Entidades e memória do sigilo numa leitura só (o que raspa é o estado que vai); se a memória não puder ser
      // lida, lança (falha comum: o texto não é gravado e o motor tenta de novo depois).
      const { envelope: daqui, conhecidos } = await d.repo.exportarComConhecidos(agora);
      const { envelope, raspados } = paraOTextoComRaspados(comOsDoFuturo(daqui, remoto, agora), agora, conhecidos);
      // O que o texto raspou fica raspado: vai para a memória ANTES da gravação; se não puder ser guardado, lança.
      // Como aprendida (com o teto): o que este dispositivo marcou já entrou como local na gravação que o marcou, e
      // o resto é dado de colega (o campo `dispositivo` dos itens vem no texto e não prova nada).
      await d.repo.lembrarSigilo(raspados, "aprendida");
      return envelope;
    },
    assinatura: assinaturaProjetos,
    vazio: (env) => LISTAS.every((k) => env.entidades[k].length === 0),
    normalizar: (lido, agora) => textoComoGravado(lido, escopo, agora),
    async antesDeRegravarInvalido(motivo, html) {
      const guardado: TextoSubstituido = {
        quando: d.repo.carimboAtual().agora,
        motivo,
        html: html.slice(0, LIMITE_GUARDADO),
        cortado: html.length > LIMITE_GUARDADO,
      };
      await d.area.gravar({ [chaveSubstituido(escopo)]: guardado });
    },
    mensagens: {
      maisNovo:
        "Os projetos no SEI foram gravados por uma versão mais nova do SEI Pro. Atualize a extensão neste computador; o texto não foi alterado.",
      grandeDemais: (kb, tetoKb) =>
        unidade
          ? `Os projetos da unidade passaram do limite do Texto Padrão (${kb} KB de ${tetoKb} KB) e não foram gravados. Exclua projetos que não usa mais (os arquivados também ocupam espaço) ou leve alguns para “Só eu”.`
          : `Seus projetos passaram do limite do Texto Padrão (${kb} KB de ${tetoKb} KB) e não foram gravados. Exclua projetos que não usa mais (os arquivados também ocupam espaço).`,
      pertoDoTeto: (kb) => `Os projetos estão perto do limite do Texto Padrão (${kb} KB de ${Math.round(TETO_TEXTO / 1024)} KB).`,
      invalidoRegravado: (motivo) =>
        `O texto no SEI estava inválido (${motivo}) e foi regravado a partir deste computador; o texto antigo ficou guardado neste navegador.`,
      mudouDuranteGravacao: MENSAGEM_MUDOU,
      // No pessoal, a mensagem genérica do motor: não há colegas.
      ...(unidade ? { soLeitura: MENSAGEM_SO_LEITURA_UNIDADE } : {}),
    },
  };
}
