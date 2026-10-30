/**
 * A regra de sigilo do envelope (decisão 10 da P4), num lugar só: o que vai ao
 * Texto Padrão (`paraOTexto`) e a mescla que recebe de volta (`importar`) têm de
 * concordar sobre o que é sigiloso, senão quem tem o número o perde na volta.
 *
 * Um número marcado sigiloso em qualquer projeto ou etapa (viva ou lápide) é
 * sigiloso em todos, comparado pelos dígitos (`chaveProtocolo`): "50300.000777/2026-10"
 * sem marca num projeto é sigiloso se outro o marcou. Etapa sigilosa = processo
 * próprio sigiloso, ou nenhum processo próprio num projeto sigiloso. Documento
 * marcado sigiloso não vai, e o número dele é sigiloso nos registros; documento
 * se compara pela `chaveDocumento` (dígitos sem os zeros à esquerda: "01234567"
 * é o mesmo que "1234567"), e a chave vazia nunca é sigilosa por número.
 *
 * O sigilo gruda (rodada 1 da Tarefa 4): o que a regra deduz vira marca GRAVADA
 * no vínculo e no documento daqui (`marcasDeSigilo`), sem mudar o carimbo (todo
 * computador que conhece o número chega à mesma marca), e ela não sai mais. Assim
 * trocar o processo do projeto, perder a lápide na poda ou receber só o vínculo
 * vazio de um colega não solta o número de novo.
 *
 * E o que este computador já soube sigiloso (rodada 2: `memoriaSigilo.ts`, por
 * usuário e para todos os escopos, nunca enviada) soma-se à regra: `conhecidos`.
 * Um número que saiu de todo vínculo (o último processo marcado foi trocado), que
 * foi marcado no outro escopo ou que um colega devolveu raspado num registro de
 * mesmo carimbo (`aprendidoDosRegistros`) continua raspado.
 *
 * O corte (`cortarSigilo`) também devolve o que raspou: tudo o que o envelope
 * raspa, por qualquer regra, entra na memória (rodada 3: o que o texto raspou uma
 * vez continua raspado), e quem grava é o repositório ou o adaptador. A origem
 * (rodada 4) é decidida por quem grava, pela operação, nunca por um campo do item
 * (o `dispositivo` vem no texto e qualquer um o copia): "local" é só o que uma
 * gravação deste dispositivo causou; o resto é "aprendida" (com o teto).
 *
 * O documento de processo sigiloso vai ao texto como o marcador `DOCUMENTO_VAZIO`
 * (`{ numero: "", sigiloso: true }`, como o vínculo vazio do processo), e não sem
 * o campo (rodada 4): quem tem o número o mantém na mescla, quem não tem fica com
 * o marcador, e a etapa que chega SEM o campo `documento` é remoção de verdade
 * (vale a regra normal de versão). Sem isso, a colega que digitou o número numa
 * etapa comum o perdia quando outro computador sabia do sigilo e o tirava do texto.
 */

import type { DocumentoSei, Etapa, Projeto, Registro, Vinculo } from "./tipos";
import { chaveDocumento, chaveProtocolo } from "./vinculos";

/** O que vai no texto no lugar do número de um processo sigiloso (o histórico novo já nasce assim: historico.ts). */
export const SIGILOSO_PROCESSO = "processo sigiloso";
/** O que vai no texto no lugar do número de um documento de processo sigiloso. */
export const SIGILOSO_DOCUMENTO = "documento de processo sigiloso";

/** O que este computador já sabe sigiloso (a memória do sigilo): chaves de processo e de documento (`chaveDocumento`). */
export interface SigilosConhecidos {
  processos: ReadonlySet<string>;
  documentos: ReadonlySet<string>;
}

export const NADA_CONHECIDO: SigilosConhecidos = { processos: new Set(), documentos: new Set() };

/** Chaves de processo e de documento (`chaveDocumento`): o que entra na memória do sigilo. */
export interface Numeros {
  processos: string[];
  documentos: string[];
}

export const nenhumNumero = (): Numeros => ({ processos: [], documentos: [] });

export const juntarNumeros = (...listas: readonly Numeros[]): Numeros => ({
  processos: listas.flatMap((n) => n.processos),
  documentos: listas.flatMap((n) => n.documentos),
});

export interface SigiloDoEnvelope {
  /**
   * Os dígitos (`chaveProtocolo`) de cada número marcado sigiloso, mais os já conhecidos; o vínculo vazio do
   * texto não entra.
   */
  chaves: ReadonlySet<string>;
  /** Ids dos projetos com vínculo sigiloso por esta regra. */
  projetos: ReadonlySet<string>;
  /** Ids das etapas sigilosas por esta regra. */
  etapas: ReadonlySet<string>;
  /** Chaves (`chaveDocumento`) dos documentos marcados sigilosos (em qualquer etapa, viva ou lápide), mais os já conhecidos. */
  documentos: ReadonlySet<string>;
  /** O vínculo é sigiloso: marcado, ou o mesmo número (pelos dígitos) marcado noutro lugar. */
  vinculo(v: Vinculo | undefined): boolean;
}

const objeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);

/** O vínculo de um item qualquer (o de fora pode vir torto): só quando tem a forma de vínculo. */
function vinculoDe(x: unknown): Vinculo | undefined {
  if (!objeto(x)) return undefined;
  const v = x.processo;
  return objeto(v) && typeof v.protocolo === "string" ? (v as unknown as Vinculo) : undefined;
}

/** O documento de um item qualquer: só quando tem a forma de documento. */
function documentoDe(x: unknown): DocumentoSei | undefined {
  if (!objeto(x)) return undefined;
  const d = x.documento;
  return objeto(d) && typeof d.numero === "string" ? (d as unknown as DocumentoSei) : undefined;
}

/**
 * A regra aplicada a `projetos` e `etapas` (com lápides; item torto é ignorado, sem lançar). Todos os
 * itens entram nas chaves; um id que aparece mais de uma vez (a versão daqui e a de fora, na mescla)
 * é sigiloso se qualquer versão for. `conhecidos` (a memória do sigilo) soma-se às chaves e aos documentos.
 */
export function sigiloDoEnvelope(
  projetos: readonly unknown[],
  etapas: readonly unknown[],
  conhecidos: SigilosConhecidos = NADA_CONHECIDO,
): SigiloDoEnvelope {
  const chaves = new Set<string>(conhecidos.processos);
  for (const x of [...projetos, ...etapas]) {
    const v = vinculoDe(x);
    const k = v?.sigiloso === true ? chaveProtocolo(v.protocolo) : "";
    if (k) chaves.add(k);
  }
  // O vínculo pode vir de fora (texto editado à mão) com o número que não é texto: não é sigiloso, salvo marcado.
  const vinculo = (v: Vinculo | undefined): boolean =>
    !!v && (v.sigiloso === true || (typeof v.protocolo === "string" && chaves.has(chaveProtocolo(v.protocolo))));
  const idsProjetos = new Set<string>();
  for (const x of projetos) if (objeto(x) && typeof x.id === "string" && vinculo(vinculoDe(x))) idsProjetos.add(x.id);
  const idsEtapas = new Set<string>();
  const documentos = new Set<string>(conhecidos.documentos);
  for (const x of etapas) {
    const d = documentoDe(x);
    const k = d?.sigiloso === true ? chaveDocumento(d.numero) : "";
    if (k) documentos.add(k);
    if (!objeto(x) || typeof x.id !== "string") continue;
    const v = vinculoDe(x);
    if (v ? vinculo(v) : typeof x.projeto === "string" && idsProjetos.has(x.projeto)) idsEtapas.add(x.id);
  }
  return { chaves, projetos: idsProjetos, etapas: idsEtapas, documentos, vinculo };
}

/**
 * A etapa é sigilosa pela regra `s`: o processo próprio é sigiloso, ou ela não tem processo próprio e o do
 * projeto é (marcado, o mesmo número marcado noutro lugar, ou conhecido pela memória). A mesma conta do envelope,
 * das marcas, do CSV e da impressão.
 */
export function etapaSigilosa(
  e: Pick<Etapa, "processo">,
  projeto: Pick<Projeto, "processo"> | undefined,
  s: Pick<SigiloDoEnvelope, "vinculo">,
): boolean {
  return e.processo ? s.vinculo(e.processo) : !!projeto && s.vinculo(projeto.processo);
}

/** O vínculo sigiloso no texto: sem o número e sem o `idProcedimento`. */
export const VINCULO_VAZIO: Vinculo = { protocolo: "", sigiloso: true };

/**
 * É o vínculo vazio do texto: um processo sigiloso cujo número este computador não tem. A tela o mostra como
 * "Processo sigiloso", sem número e sem link, e o diálogo o mantém ao salvar (tirá-lo é remoção, e a remoção
 * chega a quem tem o número). O protocolo vazio sem a marca é "sem processo".
 */
export const vinculoSemNumero = (v: Vinculo | undefined): boolean => !!v && v.protocolo === "" && v.sigiloso === true;

/** O documento de processo sigiloso no texto (o marcador): sem o número e sem o título. */
export const DOCUMENTO_VAZIO: DocumentoSei = { numero: "", sigiloso: true };

/**
 * É o marcador do texto: um documento de processo sigiloso cujo número este computador não tem. A tela o mostra
 * como "Documento de processo sigiloso", sem número e sem link. O número vazio SEM a marca é "sem documento".
 */
export const documentoSemNumero = (d: DocumentoSei | undefined): boolean => !!d && d.numero === "" && d.sigiloso === true;

const marcarVinculo = (v: Vinculo): Vinculo => ({ ...v, sigiloso: true });
const marcarDocumento = (d: DocumentoSei): DocumentoSei => ({ ...d, sigiloso: true });

/** A outra versão é a MESMA (mesmo instante e dispositivo): é o mesmo item, talvez raspado pelo envelope. */
const mesmaVersao = (x: Projeto | Etapa, o: unknown): boolean =>
  objeto(o) && o.atualizadoEm === x.atualizadoEm && o.dispositivo === x.dispositivo;

/** O vínculo de fora (marcado) fala do mesmo processo que o daqui: vazio (raspado) ou o mesmo número. */
function mesmoProcesso(aqui: Vinculo, fora: Vinculo): boolean {
  if (aqui.idProcedimento && fora.idProcedimento && aqui.idProcedimento !== fora.idProcedimento) return false;
  return !fora.protocolo || chaveProtocolo(fora.protocolo) === chaveProtocolo(aqui.protocolo);
}

/** A marca do vínculo que outra versão igual traz (quem gravou o texto sabia do sigilo; aqui, talvez não). */
function vinculoDaMesmaVersao<T extends Projeto | Etapa>(x: T, outras: readonly unknown[]): T {
  const v = x.processo;
  if (!v || v.sigiloso) return x;
  for (const o of outras) {
    const f = mesmaVersao(x, o) ? vinculoDe(o) : undefined;
    if (f?.sigiloso === true && mesmoProcesso(v, f)) return { ...x, processo: marcarVinculo(v) };
  }
  return x;
}

/**
 * O documento que outra versão igual traz como o marcador do texto (o envelope tirou o número: era sigiloso) ou
 * marcado com o mesmo número. Sem o campo, a outra versão não diz nada do sigilo (rodada 4: ausente é remoção).
 */
function documentoDaMesmaVersao(x: Etapa, outras: readonly unknown[]): Etapa {
  const d = x.documento;
  if (!d || d.sigiloso || !d.numero) return x;
  for (const o of outras) {
    if (!mesmaVersao(x, o)) continue;
    const od = documentoDe(o);
    if (od?.sigiloso === true && (od.numero === "" || chaveDocumento(od.numero) === chaveDocumento(d.numero)))
      return { ...x, documento: marcarDocumento(d) };
  }
  return x;
}

/**
 * As marcas de sigilo que faltam no estado `final` (projetos e etapas daqui, com lápides, depois da
 * gravação ou da mescla), sem mudar o carimbo. `outras` são as outras versões conhecidas dos mesmos
 * itens (as daqui antes de gravar, as que chegaram de fora): os números marcados nelas contam, e a
 * marca de uma versão igual (mesmo carimbo) vale aqui. Marca o vínculo cujo número é sigiloso, o
 * documento de etapa sigilosa e o documento cujo número foi marcado em qualquer lugar. Devolve só os
 * itens que mudaram; nunca tira marca. `conhecidos` (a memória do sigilo) conta como número marcado.
 */
export function marcasDeSigilo(
  final: { p: readonly Projeto[]; e: readonly Etapa[] },
  outras: { p?: readonly unknown[]; e?: readonly unknown[] } = {},
  conhecidos: SigilosConhecidos = NADA_CONHECIDO,
): { p: Projeto[]; e: Etapa[] } {
  const porId = (lista: readonly unknown[] | undefined) => {
    const m = new Map<string, unknown[]>();
    for (const o of lista ?? []) if (objeto(o) && typeof o.id === "string") m.set(o.id, [...(m.get(o.id) ?? []), o]);
    return m;
  };
  const outrasP = porId(outras.p);
  const outrasE = porId(outras.e);
  const p1 = final.p.map((x) => vinculoDaMesmaVersao(x, outrasP.get(x.id) ?? []));
  const e1 = final.e.map((x) => documentoDaMesmaVersao(vinculoDaMesmaVersao(x, outrasE.get(x.id) ?? []), outrasE.get(x.id) ?? []));
  const s = sigiloDoEnvelope([...p1, ...(outras.p ?? [])], [...e1, ...(outras.e ?? [])], conhecidos);
  const p2 = p1.map((x) =>
    x.processo && !x.processo.sigiloso && s.vinculo(x.processo) ? { ...x, processo: marcarVinculo(x.processo) } : x,
  );
  // A etapa herda do projeto como ele fica aqui (uma versão velha de fora não decide).
  const projetos = new Map(p2.map((x) => [x.id, x]));
  const e2 = e1.map((x) => {
    let y = x.processo && !x.processo.sigiloso && s.vinculo(x.processo) ? { ...x, processo: marcarVinculo(x.processo) } : x;
    if (etapaSigilosa(y, projetos.get(y.projeto), s) && y.documento && !y.documento.sigiloso)
      y = { ...y, documento: marcarDocumento(y.documento) };
    return y;
  });
  // A chave vazia (o marcador, o número vazio sem a marca) não marca nada pelo número.
  const documentos = new Set([...s.documentos, ...e2.flatMap((x) => (x.documento?.sigiloso ? [chaveDocumento(x.documento.numero)] : []))]);
  documentos.delete("");
  const e3 = e2.map((x) =>
    x.documento && !x.documento.sigiloso && documentos.has(chaveDocumento(x.documento.numero))
      ? { ...x, documento: marcarDocumento(x.documento) }
      : x,
  );
  return { p: p2.filter((x, i) => x !== final.p[i]), e: e3.filter((x, i) => x !== final.e[i]) };
}

/**
 * O que o estado marca (vínculos e documentos `sigiloso: true`, vivos ou lápides): vai para a memória do sigilo.
 * Com `campos`, só o vínculo dos itens que `campos.processo` aceita e o documento das etapas que `campos.documento`
 * aceita (os campos que uma gravação mudou).
 */
export function marcadosNoEstado(
  projetos: readonly Projeto[],
  etapas: readonly Etapa[],
  campos?: { processo(x: Projeto | Etapa): boolean; documento(x: Etapa): boolean },
): Numeros {
  const saida = nenhumNumero();
  for (const x of [...projetos, ...etapas]) {
    if (campos && !campos.processo(x)) continue;
    const k = x.processo?.sigiloso === true && typeof x.processo.protocolo === "string" ? chaveProtocolo(x.processo.protocolo) : "";
    if (k) saida.processos.push(k);
  }
  for (const x of etapas) {
    if (campos && !campos.documento(x)) continue;
    const k = x.documento?.sigiloso === true ? chaveDocumento(x.documento.numero) : "";
    if (k) saida.documentos.push(k);
  }
  return saida;
}

/**
 * O que um registro de fora com o mesmo id e o mesmo carimbo do daqui ensina: o lado que chegou raspado
 * ("processo sigiloso" / "documento de processo sigiloso") onde o daqui tem um número diz que o número é
 * sigiloso (quem gravou sabia). O registro daqui fica como está (o usuário mantém o próprio histórico).
 */
export function aprendidoDosRegistros(
  locais: readonly Registro[],
  deFora: readonly unknown[],
): { processos: string[]; documentos: string[] } {
  const porId = new Map(locais.map((r) => [r.id, r]));
  const processos: string[] = [];
  const documentos: string[] = [];
  for (const o of deFora) {
    if (!objeto(o) || typeof o.id !== "string") continue;
    const l = porId.get(o.id);
    if (!l || l.atualizadoEm !== o.atualizadoEm || l.dispositivo !== o.dispositivo || l.campo !== o.campo) continue;
    for (const lado of ["antes", "depois"] as const) {
      const aqui = l[lado];
      if (typeof aqui !== "string" || !aqui) continue;
      if (l.campo === "processo" && o[lado] === SIGILOSO_PROCESSO && chaveProtocolo(aqui)) processos.push(chaveProtocolo(aqui));
      if (l.campo === "documento" && o[lado] === SIGILOSO_DOCUMENTO && aqui !== SIGILOSO_DOCUMENTO && chaveDocumento(aqui))
        documentos.push(chaveDocumento(aqui));
    }
  }
  return { processos, documentos };
}

/**
 * O corte do envelope pela regra `s` (sem podar): projeto e etapa sigilosos com o vínculo vazio; o documento de
 * etapa sigilosa, o marcado e o de número sigiloso trocados pelo marcador `DOCUMENTO_VAZIO`; registros raspados
 * (`rasparRegistro`). Número de documento sigiloso é o que `s` conhece (marcado ou na memória) e, nesta mesma
 * montagem, o documento de etapa sigilosa e os números dos registros "documento" dela: o mesmo número sai de
 * qualquer etapa e de qualquer registro já na primeira vez, sem esperar a memória. Devolve também o que raspou
 * (chaves de processo e números de documento), para a memória do sigilo; com `contar`, só o que raspou dos itens
 * e registros que ele aceita (o corte é o mesmo: a gravação daqui separa assim o que é deste dispositivo).
 */
export function cortarSigilo(
  ent: { p: readonly Projeto[]; e: readonly Etapa[]; h: readonly Registro[] },
  s: SigiloDoEnvelope,
  contar: (x: Projeto | Etapa | Registro) => boolean = () => true,
): { p: Projeto[]; e: Etapa[]; h: Registro[]; raspados: Numeros } {
  const raspados = nenhumNumero();
  const doProcesso = (t: string | undefined) => {
    const k = typeof t === "string" ? chaveProtocolo(t) : "";
    if (k) raspados.processos.push(k);
  };
  const documentos = new Set(s.documentos);
  for (const x of ent.e) if (s.etapas.has(x.id) && x.documento?.numero) documentos.add(chaveDocumento(x.documento.numero));
  for (const r of ent.h) {
    if (r.campo !== "documento" || !s.etapas.has(r.alvo)) continue;
    for (const t of [r.antes, r.depois]) if (t && t !== SIGILOSO_DOCUMENTO) documentos.add(chaveDocumento(t));
  }
  documentos.delete("");
  const corte: SigiloDoEnvelope = { ...s, documentos };
  const p = ent.p.map((x): Projeto => {
    if (!corte.projetos.has(x.id)) return x;
    if (contar(x)) doProcesso(x.processo?.protocolo);
    return { ...x, processo: VINCULO_VAZIO };
  });
  const e = ent.e.map((x): Etapa => {
    const sigilosa = corte.etapas.has(x.id);
    const conta = contar(x);
    let y = x;
    const d = y.documento;
    if (d && (sigilosa || d.sigiloso || documentos.has(chaveDocumento(d.numero)))) {
      if (chaveDocumento(d.numero) && conta) raspados.documentos.push(chaveDocumento(d.numero));
      y = { ...y, documento: DOCUMENTO_VAZIO };
    }
    if (sigilosa && y.processo) {
      if (conta) doProcesso(y.processo.protocolo);
      y = { ...y, processo: VINCULO_VAZIO };
    }
    return y;
  });
  const h = ent.h.map((r) => {
    const x = rasparRegistro(r, corte);
    if (x !== r && contar(r)) {
      for (const lado of ["antes", "depois"] as const) {
        const t = r[lado];
        if (!t || x[lado] === t) continue;
        if (r.campo === "processo") doProcesso(t);
        else if (chaveDocumento(t)) raspados.documentos.push(chaveDocumento(t));
      }
    }
    return x;
  });
  return { p, e, h, raspados };
}

/** Cópia sem `antes`/`depois` indefinidos (a forma do registro gravado). */
function semIndefinidos(r: Registro): Registro {
  const x = { ...r } as Record<string, unknown>;
  for (const k of ["antes", "depois"]) if (x[k] === undefined) delete x[k];
  return x as unknown as Registro;
}

/**
 * O registro do histórico como pode ir a outra pessoa, mantendo id e carimbo (na volta, o `importar`
 * reconhece o mesmo registro e fica com o daqui): "processo" com o número sigiloso vira "processo
 * sigiloso"; "documento" de etapa sigilosa, ou com o número de um documento marcado, vira "documento
 * de processo sigiloso". O que não muda volta o próprio objeto.
 */
export function rasparRegistro(r: Registro, s: SigiloDoEnvelope): Registro {
  if (r.campo === "processo") {
    const lado = (t: string | undefined) => (t !== undefined && s.chaves.has(chaveProtocolo(t)) ? SIGILOSO_PROCESSO : t);
    const antes = lado(r.antes);
    const depois = lado(r.depois);
    return antes === r.antes && depois === r.depois ? r : semIndefinidos({ ...r, antes, depois });
  }
  if (r.campo === "documento") {
    const daEtapa = s.etapas.has(r.alvo);
    const lado = (t: string | undefined) => (t && (daEtapa || s.documentos.has(chaveDocumento(t))) ? SIGILOSO_DOCUMENTO : t);
    const antes = lado(r.antes);
    const depois = lado(r.depois);
    return antes === r.antes && depois === r.depois ? r : semIndefinidos({ ...r, antes, depois });
  }
  return r;
}
