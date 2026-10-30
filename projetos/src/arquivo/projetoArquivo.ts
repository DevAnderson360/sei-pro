/**
 * "Enviar projeto por arquivo" e "Receber projeto de arquivo" (spec 6.2): um projeto, com as fases e as etapas
 * vivas, em `<nome>.seipro-projeto.json`.
 *
 * O arquivo vai a OUTRA pessoa: o corte de sigilo é pelo menos o do Texto Padrão, pelo mesmo caminho do
 * adaptador (sincronia/textoPadrao.ts): o escopo inteiro e a memória do sigilo lidos numa chamada só
 * (`exportarComConhecidos`), a regra de modelo/sigilo.ts sobre o escopo inteiro (um número marcado noutro projeto
 * do escopo também é sigiloso aqui) somada ao que a memória sabe (`paraOTextoComRaspados`), e o que raspou vai
 * para a memória antes do arquivo sair (o que saiu raspado continua raspado). A memória que não lê
 * (`ErroMemoriaSigilo`), ou que não grava, faz o envio falhar: nenhum arquivo é gerado. Nunca usa o `exportarTudo`
 * (sincronia/arquivo.ts), que é a cópia do próprio usuário e leva os números sigilosos.
 *
 * No arquivo: o vínculo sigiloso vai como `{ protocolo: "", sigiloso: true }` e o documento de etapa sigilosa,
 * marcado ou conhecido pela memória vai como o marcador `{ numero: "", sigiloso: true }` (quem recebe vê
 * "Processo sigiloso" e "Documento de processo sigiloso", sem número e sem link). O `idProcedimento` não vai em
 * vínculo nenhum: é o id interno do SEI de quem envia, e na caixa de quem recebe o mesmo id pode ser outro
 * processo (o número abre pela pesquisa rápida). Do responsável vai só o nome (o login é de um colega de quem
 * envia). Sem histórico, sem carimbos, sem lápides e sem a memória; a ordem das fases e das etapas é a posição na
 * lista. Para fora, só `arquivoDoProjeto` monta o arquivo: o corte puro fica interno (ninguém liga o corte só pela
 * regra, sem a memória).
 *
 * Receber cria uma CÓPIA com ids novos no escopo escolhido (não mescla com o original), numa gravação só, com o
 * registro de criação, tudo ou nada (`importar` com `inteiro`: o teto de projetos é decidido na leitura da
 * própria gravação). Cada item é refeito campo a campo (o que sobra no arquivo não entra, a ordem é refeita, o
 * login do responsável e o `idProcedimento` ficam de fora, e número marcado sigiloso vira o vínculo vazio e o
 * marcador) e o arquivo inteiro é recusado se algum item vier torto (tipo errado, data impossível, id repetido,
 * dependência em ciclo, texto longo). A leitura do arquivo escolhido já ensaia essa montagem: o arquivo torto nem
 * abre o diálogo, e a prévia mostra o que seria gravado (nome limpo, datas validadas).
 */

import { novoId } from "@comum/id";
import { indiceEntre, indiceValido } from "@comum/ordem/indice";
import { versaoMaisNova } from "@comum/sincronia/textoPadraoCodec";
import { LIMITES } from "../modelo/constantes";
import { encontrarCiclo } from "../modelo/dependencias";
import { registrosDeProjeto } from "../modelo/historico";
import { ErroMemoriaSigilo } from "../modelo/memoriaSigilo";
import { novaEtapa, novaFase, novoProjeto, porOrdem, semVazios } from "../modelo/operacoes";
import { DOCUMENTO_VAZIO, type Numeros, type SigilosConhecidos, VINCULO_VAZIO } from "../modelo/sigilo";
import type {
  DataISO,
  DocumentoSei,
  EnvelopeProjetos,
  Etapa,
  Fase,
  ItemChecklist,
  LinhaDeBase,
  Medida,
  Projeto,
  Responsavel,
  Vinculo,
} from "../modelo/tipos";
import { ErroValidacao, problemasDoProjeto } from "../modelo/validacao";
import { entidadeValida, mensagemDoLimite, type RepositorioProjetos } from "../repositorio";
import { FORMATO, paraOTextoComRaspados } from "../sincronia/textoPadrao";

export const FORMATO_PROJETO = "seipro-projeto";
export const VERSAO_PROJETO = 1;
/** Um projeto tem no máximo 300 etapas: mesmo com todos os textos no teto, o arquivo fica abaixo de 5 MB. */
export const LIMITE_ARQUIVO_PROJETO = 5 * 1024 * 1024;
export const TIPO_ARQUIVO_PROJETO = "application/json";

const PARA_ENVIAR = "Peça a quem enviou um arquivo gerado em “Enviar projeto por arquivo…” (o nome termina em .seipro-projeto.json).";
export const MENSAGEM_NAO_E_PROJETO = `Este arquivo não é um projeto enviado pelo SEI Pro. ${PARA_ENVIAR}`;
export const MENSAGEM_GRANDE = `O arquivo passa de 5 MB e não é um projeto enviado pelo SEI Pro. ${PARA_ENVIAR}`;
export const MENSAGEM_COPIA_DE_TUDO =
  "Este arquivo é a cópia de todos os projetos, não um projeto enviado. Para trazê-la, use “Importar de um arquivo…” em Sincronização.";
/** A memória do sigilo ilegível no envio (a genérica do `ErroMemoriaSigilo` fala em "nada foi gravado"). */
export const MENSAGEM_MEMORIA_ENVIO =
  "Não foi possível ler a lista de processos sigilosos deste computador. Nenhum arquivo foi gerado; tente de novo.";
export const MENSAGEM_MAIS_NOVO = "Este projeto foi enviado de uma versão mais nova do SEI Pro. Atualize a extensão e tente de novo.";
export const MENSAGEM_TORTO =
  "O arquivo tem itens inválidos (talvez tenha sido editado); nada foi recebido. Peça a quem enviou um arquivo novo.";

/** A etapa como vai no arquivo: o que importa para recriá-la, sem carimbos, sem ordem (é a posição) e sem origem. */
export type EtapaNoArquivo = Pick<
  Etapa,
  | "id"
  | "fase"
  | "nome"
  | "inicio"
  | "fim"
  | "marco"
  | "dependeDe"
  | "responsavel"
  | "medida"
  | "progresso"
  | "checklist"
  | "processo"
  | "documento"
  | "etiquetas"
  | "observacoes"
  | "concluidaEm"
  | "base"
>;

export interface EnvelopeProjeto {
  formato: typeof FORMATO_PROJETO;
  versao: typeof VERSAO_PROJETO;
  gerado: number;
  projeto: { nome: string; etiquetas: string[]; processo?: Vinculo };
  fases: Array<Pick<Fase, "id" | "nome">>;
  etapas: EtapaNoArquivo[];
}

/** O vínculo no arquivo: sem o `idProcedimento`; o sigiloso, sempre vazio. */
function vinculoNoArquivo(v: Vinculo | undefined): Vinculo | undefined {
  if (!v) return undefined;
  return v.sigiloso ? { ...VINCULO_VAZIO } : { protocolo: v.protocolo };
}

/** O documento no arquivo: o marcado vai como o marcador (o corte já o trocou; aqui é a garantia). */
function documentoNoArquivo(d: DocumentoSei | undefined): DocumentoSei | undefined {
  if (!d) return undefined;
  return d.sigiloso ? { ...DOCUMENTO_VAZIO } : semVazios({ numero: d.numero, titulo: d.titulo });
}

function etapaNoArquivo(e: Etapa): EtapaNoArquivo {
  return semVazios({
    id: e.id,
    fase: e.fase,
    nome: e.nome,
    inicio: e.inicio,
    fim: e.fim,
    marco: e.marco,
    dependeDe: [...e.dependeDe],
    // Só o nome: o login é de um colega de quem envia, e o arquivo vai a outra pessoa.
    responsavel: e.responsavel ? { nome: e.responsavel.nome } : undefined,
    medida: e.medida,
    progresso: e.progresso,
    checklist: e.checklist.map((i) => ({ id: i.id, texto: i.texto, feito: i.feito })),
    processo: vinculoNoArquivo(e.processo),
    documento: documentoNoArquivo(e.documento),
    etiquetas: [...e.etiquetas],
    observacoes: e.observacoes,
    concluidaEm: e.concluidaEm,
    base: e.base ? { inicio: e.base.inicio, fim: e.base.fim } : undefined,
  });
}

/**
 * O projeto `id` do envelope do escopo (com lápides e histórico), como vai no arquivo, e o que o corte raspou.
 * Puro e INTERNO (só `arquivoDoProjeto` o chama, com a memória lida junto do escopo). A regra corre sobre o escopo
 * inteiro e soma `conhecidos` (a memória do sigilo); é o corte do Texto Padrão (`paraOTextoComRaspados`).
 */
function envelopeDoProjeto(
  escopo: EnvelopeProjetos,
  id: string,
  conhecidos: SigilosConhecidos,
  agora: number,
): { envelope: EnvelopeProjeto; raspados: Numeros } {
  const { envelope: cortado, raspados } = paraOTextoComRaspados(escopo, agora, conhecidos);
  const ent = cortado.entidades;
  const p = ent.p.find((x) => x.id === id && x.removidoEm === undefined);
  if (!p) throw new ErroValidacao(["O projeto não existe mais."]);
  const projeto: EnvelopeProjeto["projeto"] = { nome: p.nome, etiquetas: [...p.etiquetas] };
  const processo = vinculoNoArquivo(p.processo);
  if (processo) projeto.processo = processo;
  const vivo = (x: { projeto: string; removidoEm?: number }) => x.projeto === id && x.removidoEm === undefined;
  return {
    envelope: {
      formato: FORMATO_PROJETO,
      versao: VERSAO_PROJETO,
      gerado: agora,
      projeto,
      fases: ent.f
        .filter(vivo)
        .sort(porOrdem)
        .map((f) => ({ id: f.id, nome: f.nome })),
      etapas: ent.e.filter(vivo).sort(porOrdem).map(etapaNoArquivo),
    },
    raspados,
  };
}

/**
 * O arquivo do "Enviar projeto": o nome e o conteúdo (JSON). Escopo e memória do sigilo numa leitura só; o que
 * raspou vai para a memória ANTES (como aprendida, como no Texto Padrão). Lança sem gerar nada: `ErroMemoriaSigilo`
 * com `MENSAGEM_MEMORIA_ENVIO` (a memória não lê), o erro do storage (não grava) ou `ErroValidacao` (o projeto
 * sumiu, grande demais).
 */
export async function arquivoDoProjeto(
  repo: RepositorioProjetos,
  id: string,
  agora: number = Date.now(),
): Promise<{ nome: string; conteudo: string }> {
  let envelope: EnvelopeProjeto;
  try {
    const lido = await repo.exportarComConhecidos(agora);
    const cortado = envelopeDoProjeto(lido.envelope, id, lido.conhecidos, agora);
    await repo.lembrarSigilo(cortado.raspados, "aprendida");
    envelope = cortado.envelope;
  } catch (e) {
    if (e instanceof ErroMemoriaSigilo) throw Object.assign(new ErroMemoriaSigilo(e.cause), { message: MENSAGEM_MEMORIA_ENVIO });
    throw e;
  }
  const conteudo = JSON.stringify(envelope);
  if (conteudo.length > LIMITE_ARQUIVO_PROJETO)
    throw new ErroValidacao(["O projeto passa de 5 MB e não cabe num arquivo. Encurte as observações e os checklists e tente de novo."]);
  return { nome: nomeDoArquivoDoProjeto(envelope.projeto.nome), conteudo };
}

/** "Revisão normativa.seipro-projeto.json", sem os caracteres que os sistemas de arquivo recusam. */
export function nomeDoArquivoDoProjeto(nome: string): string {
  const semControle = [...nome].map((ch) => (ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127 ? " " : ch)).join("");
  const limpo = semControle
    .replace(/[\\/:*?"<>|]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  // Por caractere (não por unidade de UTF-16): o corte não parte um emoji ao meio.
  const base = [...limpo].slice(0, 80).join("").trim() || "projeto";
  return `${base}.seipro-projeto.json`;
}

const objeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** O envelope do arquivo (forma e tetos), ou null se não é um projeto enviado pelo SEI Pro. A forma de cada item é do `receber`. */
export function lerEnvelopeDoProjeto(bruto: unknown): EnvelopeProjeto | null {
  if (!objeto(bruto) || bruto.formato !== FORMATO_PROJETO || bruto.versao !== VERSAO_PROJETO) return null;
  const p = bruto.projeto;
  if (!objeto(p) || typeof p.nome !== "string" || !Array.isArray(p.etiquetas)) return null;
  if (!Array.isArray(bruto.fases) || !Array.isArray(bruto.etapas)) return null;
  if (bruto.etapas.length > LIMITES.etapasPorProjeto || bruto.fases.length > LIMITES.etapasPorProjeto) return null;
  if (!bruto.fases.every(objeto) || !bruto.etapas.every(objeto)) return null;
  return bruto as unknown as EnvelopeProjeto;
}

/**
 * O texto do arquivo escolhido → o envelope, ou `ErroValidacao` com o que fazer: grande demais (antes de ler),
 * JSON quebrado ou de outro formato, a cópia de todos os projetos (essa vai pelo "Importar"), versão mais nova, ou
 * item torto (a montagem do `receber` é ensaiada aqui: o arquivo que não seria recebido nem abre o diálogo).
 */
export function lerArquivoDoProjeto(texto: string): EnvelopeProjeto {
  if (texto.length > LIMITE_ARQUIVO_PROJETO) throw new ErroValidacao([MENSAGEM_GRANDE]);
  let bruto: unknown;
  try {
    bruto = JSON.parse(texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto);
  } catch {
    throw new ErroValidacao([MENSAGEM_NAO_E_PROJETO]);
  }
  if (versaoMaisNova(bruto, FORMATO_PROJETO, VERSAO_PROJETO)) throw new ErroValidacao([MENSAGEM_MAIS_NOVO]);
  if (objeto(bruto) && bruto.formato === FORMATO) throw new ErroValidacao([MENSAGEM_COPIA_DE_TUDO]);
  const env = lerEnvelopeDoProjeto(bruto);
  if (!env) throw new ErroValidacao([MENSAGEM_NAO_E_PROJETO]);
  if (!ensaiar(env)) throw new ErroValidacao([MENSAGEM_TORTO]);
  return env;
}

/** O que o diálogo mostra antes de receber. */
export interface PreviaRecebido {
  nome: string;
  etapas: number;
  fases: number;
  inicio?: DataISO;
  fim?: DataISO;
}

/** A prévia do que seria gravado (a montagem ensaiada: nome limpo, datas validadas); o envelope torto lança. */
export function previaDoRecebido(env: EnvelopeProjeto): PreviaRecebido {
  const m = ensaiar(env);
  if (!m) throw new ErroValidacao([MENSAGEM_TORTO]);
  const inicios = m.etapas.map((e) => e.inicio).sort();
  const fins = m.etapas.map((e) => e.fim).sort();
  return { nome: m.p.nome, etapas: m.etapas.length, fases: m.fases.length, inicio: inicios[0], fim: fins.at(-1) };
}

/** Cria a cópia com ids novos no repositório (escopo) escolhido; o arquivo torto não grava nada. */
export async function receberProjeto(repo: RepositorioProjetos, env: EnvelopeProjeto, gerarId: () => string = novoId): Promise<Projeto> {
  const todos = await repo.projetos.listar();
  const ativos = todos.filter((p) => p.removidoEm === undefined && p.arquivadoEm === undefined);
  // Só para a mensagem vir antes do "Entendi"; quem decide é o `importar` com `inteiro`, na leitura da gravação.
  if (ativos.length >= LIMITES.projetosAtivos) throw new ErroValidacao([mensagemDoLimite(repo.escopo.vis)]);
  const c = repo.carimboAtual();
  const maior = todos
    .map((p) => p.ordem)
    .filter((o) => typeof o === "string" && indiceValido(o))
    .sort()
    .at(-1);
  const pid = gerarId();
  const montado = montar(env, pid, maior ?? null, c, gerarId);
  if (!montado) throw new ErroValidacao([MENSAGEM_TORTO]);
  const { p, fases, etapas } = montado;
  await repo.importar({ p: [p], f: fases, e: etapas }, { registros: registrosDeProjeto(undefined, p), carimbo: c }, { inteiro: true });
  const recebido = await repo.obterProjeto(pid);
  if (!recebido) throw new ErroValidacao(["Não foi possível receber o projeto."]);
  return recebido;
}

/** Item torto no arquivo: interrompe a montagem (vira `null` em `montar`). */
class Torto extends Error {}

function exigir(ok: boolean): void {
  if (!ok) throw new Torto();
}
const umTexto = (x: unknown): string => {
  exigir(typeof x === "string");
  return x as string;
};
const umBooleano = (x: unknown): boolean => {
  exigir(typeof x === "boolean");
  return x as boolean;
};
const umNumero = (x: unknown): number => {
  exigir(typeof x === "number" && Number.isFinite(x));
  return x as number;
};
const umObjeto = (x: unknown): Record<string, unknown> => {
  exigir(objeto(x));
  return x as Record<string, unknown>;
};
const umaLista = (x: unknown): unknown[] => {
  exigir(Array.isArray(x));
  return x as unknown[];
};
const textos = (x: unknown): string[] => umaLista(x).map(umTexto);
/** Ausente = undefined; presente, tem de passar em `ler`. */
const opcional = <T>(x: unknown, ler: (v: unknown) => T): T | undefined => (x === undefined ? undefined : ler(x));

/**
 * O vínculo recebido, campo a campo: sem o `idProcedimento` (o id interno do SEI de quem enviou). O marcado
 * sigiloso vira o vínculo vazio, mesmo com número: um arquivo legítimo nunca o traz.
 */
function vinculoRecebido(x: unknown): Vinculo {
  const o = umObjeto(x);
  const protocolo = umTexto(o.protocolo);
  return opcional(o.sigiloso, umBooleano) ? { ...VINCULO_VAZIO } : { protocolo };
}

/** O documento recebido: o marcado sigiloso vira o marcador (sem número e sem título), como no vínculo. */
function documentoRecebido(x: unknown): DocumentoSei {
  const o = umObjeto(x);
  const numero = umTexto(o.numero);
  const titulo = opcional(o.titulo, umTexto);
  return opcional(o.sigiloso, umBooleano) ? { ...DOCUMENTO_VAZIO } : semVazios({ numero, titulo });
}

/** Do responsável, só o nome (o arquivo não leva o login; o que vier de fora não entra). */
function responsavelRecebido(x: unknown): Responsavel {
  return { nome: umTexto(umObjeto(x).nome) };
}

function baseRecebida(x: unknown): LinhaDeBase {
  const o = umObjeto(x);
  return { inicio: umTexto(o.inicio), fim: umTexto(o.fim) };
}

/** Ids do arquivo → ids novos; id que não é texto ou repetido é torto. */
function idsNovos(itens: readonly Record<string, unknown>[], gerarId: () => string): Map<string, string> {
  const m = new Map<string, string>();
  for (const x of itens) {
    const id = umTexto(x.id);
    exigir(!m.has(id));
    m.set(id, gerarId());
  }
  return m;
}

/** A montagem sem gravar (ids e carimbo de ensaio): a leitura do arquivo e a prévia usam. */
function ensaiar(env: EnvelopeProjeto): Montado | null {
  let n = 0;
  return montar(env, "ensaio", null, { agora: 0, dispositivo: "ensaio" }, () => `ensaio${++n}`);
}

interface Montado {
  p: Projeto;
  fases: Fase[];
  etapas: Etapa[];
}

/** As entidades novas, ou null se algum item do arquivo é torto. A ordem é a posição na lista do arquivo. */
function montar(
  env: EnvelopeProjeto,
  pid: string,
  maior: string | null,
  c: ReturnType<RepositorioProjetos["carimboAtual"]>,
  gerarId: () => string,
): Montado | null {
  try {
    const bruto = env as unknown as {
      projeto: Record<string, unknown>;
      fases: Record<string, unknown>[];
      etapas: Record<string, unknown>[];
    };
    const p = novoProjeto(
      {
        nome: umTexto(bruto.projeto.nome),
        processo: opcional(bruto.projeto.processo, vinculoRecebido),
        etiquetas: textos(bruto.projeto.etiquetas),
      },
      pid,
      indiceEntre(maior, null),
      c,
    );
    const idsFase = idsNovos(bruto.fases, gerarId);
    let ordemFase: string | null = null;
    const fases = bruto.fases.map((f) => {
      ordemFase = indiceEntre(ordemFase, null);
      return novaFase(pid, umTexto(f.nome), idsFase.get(f.id as string) as string, ordemFase, c);
    });
    const idsEtapa = idsNovos(bruto.etapas, gerarId);
    let ordemEtapa: string | null = null;
    const etapas = bruto.etapas.map((e) => {
      ordemEtapa = indiceEntre(ordemEtapa, null);
      const fase = opcional(e.fase, umTexto);
      const checklist: ItemChecklist[] = (opcional(e.checklist, umaLista) ?? []).map((i) => {
        const o = umObjeto(i);
        return { id: gerarId(), texto: umTexto(o.texto), feito: umBooleano(o.feito) };
      });
      return novaEtapa(
        {
          projeto: pid,
          nome: umTexto(e.nome),
          inicio: umTexto(e.inicio),
          fim: umTexto(e.fim),
          fase: fase === undefined ? undefined : idsFase.get(fase),
          marco: opcional(e.marco, umBooleano),
          dependeDe: (opcional(e.dependeDe, textos) ?? []).map((d) => idsEtapa.get(d)).filter((d): d is string => !!d),
          responsavel: opcional(e.responsavel, responsavelRecebido),
          medida: opcional(e.medida, umTexto) as Medida | undefined,
          progresso: opcional(e.progresso, umNumero),
          checklist,
          processo: opcional(e.processo, vinculoRecebido),
          documento: opcional(e.documento, documentoRecebido),
          etiquetas: opcional(e.etiquetas, textos),
          observacoes: opcional(e.observacoes, umTexto),
          concluidaEm: opcional(e.concluidaEm, umTexto),
          base: opcional(e.base, baseRecebida),
        },
        idsEtapa.get(e.id as string) as string,
        ordemEtapa,
        c,
      );
    });
    const ok =
      problemasDoProjeto(p).length === 0 &&
      entidadeValida(p, "p") &&
      fases.every((f) => entidadeValida(f, "f")) &&
      etapas.every((e) => entidadeValida(e, "e")) &&
      encontrarCiclo(etapas) === null;
    return ok ? { p, fases, etapas } : null;
  } catch {
    return null;
  }
}
