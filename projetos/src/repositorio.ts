/**
 * Projetos de UM escopo (host + login + unidade + "unidade"/"eu") no
 * `chrome.storage.local`, uma chave por entidade (molde:
 * `favoritos/src/repositorio.ts`). Remover grava lápide; toda gravação leva o
 * carimbo (quando, dispositivo, quem) e gera os registros do histórico.
 */

import type { Area } from "@comum/armazenamento/area";
import { Colecao, obterPorPrefixo } from "@comum/armazenamento/colecao";
import { diferencaDias } from "@comum/datas/dias";
import { novoId } from "@comum/id";
import { indiceEntre, indiceValido } from "@comum/ordem/indice";
import { jsonEstavel } from "@comum/sincronia/assinatura";
import { mesclar, purgarLapides, type Versionada } from "@comum/sincronia/entidade";
import { normalizarTexto } from "@comum/texto";
import { dataNaFaixa, LIMITE_DIAS_ETAPA } from "./modelo/calendario";
import { diasDeLapide, FOLGA_RELOGIO_MS, LIMITES, prefixoMemoriaSigilo, QUANDO_MINIMO } from "./modelo/constantes";
import { problemasDasMudancas, validarDependencias, violacoesDeDatas } from "./modelo/dependencias";
import { baseDoEscopo, chaveMeta, prefixoDe, rotuloDaVis } from "./modelo/escopo";
import {
  type ApoioHistorico,
  carimbarRegistros,
  excedentes,
  projetosQueFicam,
  type RegistroNovo,
  registrosDeEtapa,
  registrosDeFase,
  registrosDeProjeto,
} from "./modelo/historico";
import { aplicarDatas, baseInicial, planoParaRedefinir, redefinirBase } from "./modelo/linhaDeBase";
import {
  comEntradas,
  conhecidosDe,
  ErroMemoriaSigilo,
  entradasParaGravar,
  lerMemoria,
  type MemoriaSigilo,
  type NumerosSigilosos,
  type OrigemSigilo,
} from "./modelo/memoriaSigilo";
import {
  concluir,
  type DadosNovaEtapa,
  type DadosNovoProjeto,
  editar,
  novaEtapa,
  novaFase,
  novoProjeto,
  porOrdem,
  reabrir,
  remover,
  restaurar,
  semVazios,
} from "./modelo/operacoes";
import {
  aprendidoDosRegistros,
  cortarSigilo,
  documentoSemNumero,
  juntarNumeros,
  marcadosNoEstado,
  marcasDeSigilo,
  type Numeros,
  nenhumNumero,
  type SigilosConhecidos,
  sigiloDoEnvelope,
} from "./modelo/sigilo";
import type {
  Carimbo,
  DataISO,
  DocumentoSei,
  Entidade,
  Entidades,
  EnvelopeProjetos,
  Escopo,
  Etapa,
  Fase,
  Modelo,
  MudancaDeDatas,
  Projeto,
  Registro,
  Vinculo,
} from "./modelo/tipos";
import {
  checklistLimpo,
  ErroValidacao,
  etiquetasLimpas,
  idValido,
  nomeLimpo,
  problemasDaEstruturaDoModelo,
  problemasDaEtapa,
  problemasDoDocumento,
  problemasDoModelo,
  problemasDoProjeto,
} from "./modelo/validacao";
import {
  chaveProtocolo,
  indiceDeProcessos,
  RE_DOCUMENTO,
  RE_ID_PROCEDIMENTO,
  RE_PROTOCOLO,
  semVinculoVazio,
  type VinculoProcesso,
} from "./modelo/vinculos";
import { aplicarModelo } from "./modelos/aplicar";
import { modeloDoProjeto } from "./modelos/salvar";

/** O que está vivo no escopo (sem lápides), numa leitura só. */
export interface Dados {
  projetos: Projeto[];
  fases: Fase[];
  etapas: Etapa[];
  modelos: Modelo[];
}

/**
 * Resultado de `importar`. `ignorados` = tudo o que não entrou (malformado, carimbo do futuro ou
 * além dos tetos da spec 5.4); `excedentes` = a parte dos ignorados que só passou dos tetos.
 */
export interface ResultadoImportacao {
  novos: number;
  atualizados: number;
  ignorados: number;
  excedentes: number;
}

/** Só campo opcional aceita `undefined` (apaga); nos obrigatórios ele é ignorado. */
type Mudanca<T, Obrigatorios extends keyof T, Opcionais extends keyof T> = {
  [K in Obrigatorios]?: Exclude<T[K], undefined>;
} & { [K in Opcionais]?: T[K] };

export type MudancasProjeto = Mudanca<Projeto, "nome" | "etiquetas", "processo">;
export type MudancasEtapa = Mudanca<
  Etapa,
  "nome" | "inicio" | "fim" | "marco" | "dependeDe" | "medida" | "progresso" | "checklist" | "etiquetas",
  "fase" | "responsavel" | "processo" | "documento" | "observacoes"
>;

const OBRIGATORIOS_PROJETO = ["nome", "etiquetas"] as const;
const OBRIGATORIOS_ETAPA = ["nome", "inicio", "fim", "marco", "dependeDe", "medida", "progresso", "checklist", "etiquetas"] as const;

/** Cópia sem as chaves obrigatórias que vieram `undefined` (o contrato "undefined apaga" é só dos opcionais). */
function semObrigatoriosVazios<T extends object>(m: T, obrigatorios: readonly string[]): T {
  const r = { ...m } as Record<string, unknown>;
  for (const k of obrigatorios) if (r[k] === undefined) delete r[k];
  return r as T;
}

// Chave inválida (dado antigo ou editado à mão) não entra na conta: senão nada novo grava.
const maiorOrdem = (itens: ReadonlyArray<{ ordem: string }>): string | null =>
  itens.reduce<string | null>((m, i) => (indiceValido(i.ordem) && (m === null || i.ordem > m) ? i.ordem : m), null);

const vivo = <T extends { removidoEm?: number }>(x: T | undefined): x is T => !!x && x.removidoEm === undefined;

export class RepositorioProjetos {
  readonly projetos: Colecao<Projeto>;
  readonly fases: Colecao<Fase>;
  readonly etapas: Colecao<Etapa>;
  readonly registros: Colecao<Registro>;
  readonly modelos: Colecao<Modelo>;
  private readonly base: string;

  constructor(
    private readonly area: Area,
    readonly escopo: Escopo,
    private readonly carimbo: () => Carimbo,
    private readonly gerarId: () => string = novoId,
  ) {
    this.base = baseDoEscopo(escopo);
    this.projetos = new Colecao<Projeto>(area, prefixoDe(escopo, "p"));
    this.fases = new Colecao<Fase>(area, prefixoDe(escopo, "f"));
    this.etapas = new Colecao<Etapa>(area, prefixoDe(escopo, "e"));
    this.registros = new Colecao<Registro>(area, prefixoDe(escopo, "h"));
    this.modelos = new Colecao<Modelo>(area, prefixoDe(escopo, "m"));
  }

  /** Guarda o escopo por extenso (a exportação e o arquivo usam). */
  async registrar(): Promise<void> {
    await this.area.gravar({ [chaveMeta(this.escopo)]: { escopo: this.escopo } });
  }

  /** Tudo do escopo, com lápides, numa leitura só (sincronia, arquivo). */
  async entidades(): Promise<Entidades> {
    return entidadesDe(await obterPorPrefixo(this.area, this.base), this.base);
  }

  /** O que está vivo: projetos, fases e etapas na ordem manual; modelos pelo nome. */
  async dados(): Promise<Dados> {
    const t = await this.entidades();
    const projetos = t.p.filter(vivo).sort(porOrdem);
    const ativos = new Set(projetos.map((p) => p.id));
    return {
      projetos,
      fases: t.f.filter((f) => vivo(f) && ativos.has(f.projeto)).sort(porOrdem),
      etapas: t.e.filter((e) => vivo(e) && ativos.has(e.projeto)).sort(porOrdem),
      modelos: t.m.filter(vivo).sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR")),
    };
  }

  private get prefixoMemoria(): string {
    return prefixoMemoriaSigilo(this.escopo.host, this.escopo.login);
  }

  /**
   * Numa chamada só ao storage: as chaves da memória do sigilo e, com `escopo`, as do escopo. Falha fechada: o
   * erro do storage vira `ErroMemoriaSigilo` (a mensagem diz que nada foi gravado), e quem lê não grava nada.
   */
  private async lerChaves(escopo: boolean): Promise<Record<string, unknown>> {
    const quer = (k: string) => (escopo && k.startsWith(this.base)) || k.startsWith(this.prefixoMemoria);
    try {
      if (this.area.chaves) {
        const ks = (await this.area.chaves()).filter(quer);
        return ks.length ? await this.area.obter(ks) : {};
      }
      return Object.fromEntries(Object.entries(await this.area.obter(null)).filter(([k]) => quer(k)));
    } catch (e) {
      throw new ErroMemoriaSigilo(e);
    }
  }

  /** A memória do sigilo agora (modelo/memoriaSigilo.ts), de todos os escopos do usuário. Lança `ErroMemoriaSigilo` se não lê. */
  private async memoria(): Promise<MemoriaSigilo> {
    return lerMemoria(await this.lerChaves(false), this.prefixoMemoria);
  }

  /**
   * O que este computador já soube sigiloso, para todos os escopos do usuário: o envelope que vai a outra
   * pessoa raspa por isto também. Nunca é enviada. Lança se a memória não puder ser lida.
   */
  async sigilosConhecidos(): Promise<SigilosConhecidos> {
    return conhecidosDe(await this.memoria());
  }

  /**
   * Guarda `novos` na memória do sigilo com a `origem` (nada sai; as aprendidas têm teto; com `promover`, a
   * aprendida vista aqui vira local). Cada número é uma chave: não reescreve o que outro contexto somou. Erro ao
   * ler ou ao gravar lança.
   */
  async lembrarSigilo(novos: NumerosSigilosos, origem: OrigemSigilo, o: { promover?: boolean } = {}): Promise<void> {
    const e = entradasParaGravar(await this.memoria(), novos, origem, this.prefixoMemoria, o);
    if (Object.keys(e).length) await this.area.gravar(e);
  }

  /**
   * As entradas da memória para `r`: `local` entra como local e promove a aprendida (esta gravação o causou:
   * foi marcado aqui); `aprendida` entra como aprendida, enquanto houver vaga no teto.
   */
  private entradasPorOrigem(memoria: MemoriaSigilo, r: { local: Numeros; aprendida: Numeros }): Record<string, OrigemSigilo> {
    const locais = entradasParaGravar(memoria, r.local, "local", this.prefixoMemoria, { promover: true });
    const aprendidas = entradasParaGravar(comEntradas(memoria, locais, this.prefixoMemoria), r.aprendida, "aprendida", this.prefixoMemoria);
    return { ...locais, ...aprendidas };
  }

  /**
   * O envelope do escopo (o de `exportar`) e o que a memória do sigilo sabe, lidos NUMA chamada ao storage: o
   * que raspa é o estado que vai (uma gravação de outro contexto não cai entre ler a memória e ler as
   * entidades). Lança se a memória não puder ser lida.
   */
  async exportarComConhecidos(agora: number = Date.now()): Promise<{ envelope: EnvelopeProjetos; conhecidos: SigilosConhecidos }> {
    const tudo = await this.lerChaves(true);
    const conhecidos = conhecidosDe(lerMemoria(tudo, this.prefixoMemoria));
    return { envelope: this.envelopeDe(entidadesDe(tudo, this.base), agora), conhecidos };
  }

  /** Carimbo para gravações feitas fora da classe (mover entre escopos). */
  carimboAtual(): Carimbo {
    return this.carimbo();
  }

  /** Registro "visibilidade" (mover entre "Só eu" e "Toda a unidade"). */
  async anotarVisibilidade(p: Projeto, antes: string, depois: string, c: Carimbo): Promise<void> {
    await this.salvar({}, [{ alvo: p.id, projeto: p.id, campo: "visibilidade", antes, depois }], c);
  }

  // ---------- histórico ----------

  /** Registros vivos, do mais recente ao mais antigo (de um projeto, se informado). */
  async historico(projeto?: string): Promise<Registro[]> {
    return (await this.registros.listar())
      .filter((r) => vivo(r) && (!projeto || r.projeto === projeto))
      .sort((a, b) => b.quando - a.quando || (a.id < b.id ? 1 : a.id > b.id ? -1 : 0));
  }

  private entradas<T>(col: Colecao<T>, itens: Array<[string, T]>): Record<string, unknown> {
    return Object.fromEntries(itens.map(([id, v]) => [col.chave(id), v]));
  }

  /**
   * Grava de uma vez as entidades e os registros do histórico (um `area.gravar` só: o
   * `chrome.storage.local.set` é atômico, então nenhum ouvinte nem unload vê meio estado e
   * `aoMudar` avisa uma vez). A poda de excedentes (`Area` só remove em outra chamada) vem depois,
   * e só quando passa do limite.
   */
  private async salvar(itens: Record<string, unknown>, novos: RegistroNovo[], c: Carimbo, copia = false): Promise<void> {
    const regs = carimbarRegistros(novos, c, this.gerarId);
    await this.area.gravar({
      ...itens,
      ...(await this.marcasAoGravar(itens, regs, copia, c.dispositivo)),
      ...this.entradas(
        this.registros,
        regs.map((r) => [r.id, r]),
      ),
    });
    if (regs.length) await this.podarHistorico(c.agora);
  }

  /**
   * O sigilo gruda (modelo/sigilo.ts): as marcas que a gravação faz faltar (o número marcado agora
   * noutro projeto ou etapa, ou já conhecido na memória do sigilo; o documento da etapa que ficou
   * sigilosa) vão na mesma gravação, sem mudar o carimbo dos itens marcados. Na memória entra o que fica
   * marcado e tudo o que o envelope rasparia do estado de agora (a gravação que marca já guarda o que o
   * texto raspará, mesmo que nenhum texto seja montado antes de o processo mudar), como aprendida (com o
   * teto). Local (e promove a aprendida) é só o que ESTA gravação causou, campo a campo (rodada 5):
   * - a marca do campo de vínculo ou de documento que ela mudou (digitar só o documento numa etapa do colega
   *   não promove o processo dela);
   * - o número marcado nesse campo antes, que sai do estado com ela (foi este dispositivo que o tirou: sem isso,
   *   com as aprendidas cheias, os registros daqui com ele voltariam ao texto);
   * - o que passa a ser marcado ou raspado agora e antes não era, nos itens vivos e nos registros deste
   *   `dispositivo` (o documento antigo da própria etapa, quando o usuário marca o processo do projeto). Em lápide
   *   ou em item de colega, essa cascata é aprendida: só o que o usuário marcou é local.
   * Tudo é aprendida quando a gravação só copia (`copia`: o `importar` com anotações, que é o "Quem vê", e os
   * "Duplicar", que copiam o vínculo de outro item). Só lê o escopo quando a gravação mexe em vínculo ou documento.
   */
  private async marcasAoGravar(
    itens: Record<string, unknown>,
    regs: readonly Registro[],
    copia: boolean,
    dispositivo: string,
  ): Promise<Record<string, unknown>> {
    const doTipo = (prefixo: string) => Object.entries(itens).filter(([k]) => k.startsWith(prefixo));
    const ps = doTipo(this.projetos.prefixo);
    const es = doTipo(this.etapas.prefixo);
    if (!ps.length && !es.length) return {};
    const antes = await this.area.obter([...ps, ...es].map(([k]) => k));
    const campo = (x: unknown, k: "processo" | "documento") => jsonEstavel((x as Record<string, unknown> | undefined)?.[k] ?? null);
    const mudou = (k: "processo" | "documento", lista: ReadonlyArray<[string, unknown]>) =>
      new Set(lista.filter(([chave, v]) => campo(antes[chave], k) !== campo(v, k)).map(([, v]) => (v as { id: string }).id));
    const mudouP = mudou("processo", [...ps, ...es]);
    const mudouD = mudou("documento", es);
    if (!mudouP.size && !mudouD.size) return {};
    const [projetos, etapas, registros, lida] = await Promise.all([
      this.projetos.listar(),
      this.etapas.listar(),
      this.registros.listar(),
      this.memoria(),
    ]);
    // O que esta mesma gravação já leva para a memória (o `importar` do "Quem vê" passa as entradas dele em
    // `itens`) conta como se já estivesse lá: no teto das aprendidas e no que já se sabe.
    const pendentes = Object.fromEntries(
      Object.entries(itens).filter(([k, v]) => k.startsWith(this.prefixoMemoria) && (v === "local" || v === "aprendida")),
    ) as Record<string, OrigemSigilo>;
    const memoria = comEntradas(lida, pendentes, this.prefixoMemoria);
    const conhecidos = conhecidosDe(memoria);
    const final = { p: sobrepor(projetos, ps), e: sobrepor(etapas, es) };
    const m = marcasDeSigilo(final, { p: projetos, e: etapas }, conhecidos);
    const p2 = sobrepor(
      final.p,
      m.p.map((x) => [x.id, x]),
    );
    const e2 = sobrepor(
      final.e,
      m.e.map((x) => [x.id, x]),
    );
    const s = sigiloDoEnvelope(p2, e2, conhecidos);
    const ent = { p: p2, e: e2, h: [...registros, ...regs] };
    const depois = juntarNumeros(marcadosNoEstado(p2, e2), cortarSigilo(ent, s).raspados);
    let local = nenhumNumero();
    if (!copia) {
      const corteAntes = cortarSigilo({ p: projetos, e: etapas, h: registros }, sigiloDoEnvelope(projetos, etapas, conhecidos));
      const ja = juntarNumeros(marcadosNoEstado(projetos, etapas), corteAntes.raspados);
      const nosCampos = { processo: (x: { id: string }) => mudouP.has(x.id), documento: (x: { id: string }) => mudouD.has(x.id) };
      const proprio = (x: Versionada) => x.dispositivo === dispositivo && x.removidoEm === undefined;
      const daqui = juntarNumeros(marcadosNoEstado(p2.filter(proprio), e2.filter(proprio)), cortarSigilo(ent, s, proprio).raspados);
      local = juntarNumeros(
        marcadosNoEstado(p2, e2, nosCampos),
        foraDe(marcadosNoEstado(projetos, etapas, nosCampos), depois),
        foraDe(daqui, ja),
      );
    }
    return {
      ...this.entradas(
        this.projetos,
        m.p.map((x) => [x.id, x]),
      ),
      ...this.entradas(
        this.etapas,
        m.e.map((x) => [x.id, x]),
      ),
      ...this.entradasPorOrigem(memoria, { local, aprendida: depois }),
    };
  }

  /**
   * Os 300 registros mais recentes ficam (spec 5.4), contados como no texto: o órfão (de projeto que não fica,
   * `projetosQueFicam`) não ocupa vaga, e o do futuro fica atrás dos outros. `Area` não grava e remove juntos: é
   * outra chamada.
   */
  private async podarHistorico(agora: number): Promise<void> {
    const t = await this.entidades();
    const ficam = projetosQueFicam(t.p, agora, diasDeLapide(this.escopo.vis));
    await this.registros.apagar(
      excedentes(
        t.h.filter((r) => ficam.has(r.projeto)),
        LIMITES.historico,
        agora,
      ),
    );
  }

  private async apoio(projeto: string): Promise<ApoioHistorico> {
    const [fases, etapas] = await Promise.all([this.fases.listar(), this.etapas.listar()]);
    const nf = new Map(fases.filter((f) => f.projeto === projeto).map((f) => [f.id, f.nome]));
    const ne = new Map(etapas.filter((e) => e.projeto === projeto).map((e) => [e.id, e.nome]));
    return { nomeDaFase: (id) => nf.get(id), nomeDaEtapa: (id) => ne.get(id) };
  }

  // ---------- projetos ----------

  private async exigirVagaDeProjeto(): Promise<void> {
    const ativos = (await this.projetos.listar()).filter((p) => vivo(p) && p.arquivadoEm === undefined);
    if (ativos.length >= LIMITES.projetosAtivos) throw new ErroValidacao([mensagemDoLimite(this.escopo.vis)]);
  }

  async obterProjeto(id: string): Promise<Projeto | undefined> {
    const p = await this.projetos.obter(id);
    return vivo(p) ? p : undefined;
  }

  private async exigirProjeto(id: string): Promise<Projeto> {
    const p = await this.obterProjeto(id);
    if (!p) throw new ErroValidacao(["O projeto não existe mais."]);
    return p;
  }

  async criarProjeto(d: DadosNovoProjeto): Promise<Projeto> {
    await this.exigirVagaDeProjeto();
    const c = this.carimbo();
    const p = novoProjeto(d, this.gerarId(), indiceEntre(maiorOrdem(await this.projetos.listar()), null), c);
    const problemas = problemasDoProjeto(p);
    if (problemas.length) throw new ErroValidacao(problemas);
    await this.salvar(this.entradas(this.projetos, [[p.id, p]]), registrosDeProjeto(undefined, p), c);
    return p;
  }

  async editarProjeto(id: string, m: MudancasProjeto): Promise<Projeto> {
    const atual = await this.exigirProjeto(id);
    const mud: MudancasProjeto = semObrigatoriosVazios(m, OBRIGATORIOS_PROJETO);
    if (typeof mud.nome === "string") mud.nome = nomeLimpo(mud.nome);
    if (mud.etiquetas) mud.etiquetas = etiquetasLimpas(mud.etiquetas);
    const problemas = problemasDoProjeto({ ...atual, ...mud });
    if (problemas.length) throw new ErroValidacao(problemas);
    const c = this.carimbo();
    const p = editar(atual, mud, c);
    await this.salvar(this.entradas(this.projetos, [[id, p]]), registrosDeProjeto(atual, p), c);
    return p;
  }

  async arquivarProjeto(id: string): Promise<Projeto> {
    const atual = await this.exigirProjeto(id);
    if (atual.arquivadoEm !== undefined) return atual;
    const c = this.carimbo();
    const p = editar(atual, { arquivadoEm: c.agora }, c);
    await this.salvar(this.entradas(this.projetos, [[id, p]]), registrosDeProjeto(atual, p), c);
    return p;
  }

  async reativarProjeto(id: string): Promise<Projeto> {
    const atual = await this.exigirProjeto(id);
    if (atual.arquivadoEm === undefined) return atual;
    await this.exigirVagaDeProjeto();
    const c = this.carimbo();
    const p = editar(atual, { arquivadoEm: undefined }, c);
    await this.salvar(this.entradas(this.projetos, [[id, p]]), registrosDeProjeto(atual, p), c);
    return p;
  }

  /** Lápide no projeto, nas fases e nas etapas vivas dele, com o MESMO instante (o "Desfazer" usa). */
  async removerProjeto(id: string): Promise<void> {
    const atual = await this.exigirProjeto(id);
    const c = this.carimbo();
    const [fases, etapas] = await Promise.all([this.fases.listar(), this.etapas.listar()]);
    const p = remover(atual, c);
    await this.salvar(
      {
        ...this.entradas(
          this.fases,
          fases.filter((f) => vivo(f) && f.projeto === id).map((f) => [f.id, remover(f, c)]),
        ),
        ...this.entradas(
          this.etapas,
          etapas.filter((e) => vivo(e) && e.projeto === id).map((e) => [e.id, remover(e, c)]),
        ),
        ...this.entradas(this.projetos, [[id, p]]),
      },
      registrosDeProjeto(atual, p),
      c,
    );
  }

  /** Desfaz `removerProjeto`: volta o projeto e o que foi removido junto com ele. */
  async restaurarProjeto(id: string): Promise<Projeto | undefined> {
    const atual = await this.projetos.obter(id);
    if (!atual || atual.removidoEm === undefined) return atual;
    const quando = atual.removidoEm;
    const c = this.carimbo();
    const [fases, etapas] = await Promise.all([this.fases.listar(), this.etapas.listar()]);
    const p = restaurar(atual, c);
    await this.salvar(
      {
        ...this.entradas(
          this.fases,
          fases.filter((f) => f.projeto === id && f.removidoEm === quando).map((f) => [f.id, restaurar(f, c)]),
        ),
        ...this.entradas(
          this.etapas,
          etapas.filter((e) => e.projeto === id && e.removidoEm === quando).map((e) => [e.id, restaurar(e, c)]),
        ),
        ...this.entradas(this.projetos, [[id, p]]),
      },
      registrosDeProjeto(atual, p),
      c,
    );
    return p;
  }

  /**
   * Cópia com ids novos ("Cópia de ..."): mesmas fases, etapas e dependências; a
   * execução recomeça (sem conclusão, progresso manual 0, checklist desmarcado,
   * sem documento, base = datas).
   */
  async duplicarProjeto(id: string): Promise<Projeto> {
    const origem = await this.exigirProjeto(id);
    await this.exigirVagaDeProjeto();
    const c = this.carimbo();
    const { fases, etapas } = await this.dados();
    const p = novoProjeto(
      { nome: `Cópia de ${origem.nome}`.slice(0, LIMITES.nome), processo: origem.processo, etiquetas: origem.etiquetas },
      this.gerarId(),
      indiceEntre(maiorOrdem(await this.projetos.listar()), null),
      c,
    );
    const novasFases = new Map<string, Fase>();
    for (const f of fases.filter((x) => x.projeto === id)) novasFases.set(f.id, novaFase(p.id, f.nome, this.gerarId(), f.ordem, c));
    const doProjeto = etapas.filter((e) => e.projeto === id);
    const novosIds = new Map(doProjeto.map((e) => [e.id, this.gerarId()]));
    const novas = doProjeto.map((e) =>
      novaEtapa(
        {
          projeto: p.id,
          nome: e.nome,
          inicio: e.inicio,
          fim: e.fim,
          fase: e.fase ? novasFases.get(e.fase)?.id : undefined,
          marco: e.marco,
          dependeDe: e.dependeDe.map((d) => novosIds.get(d)).filter((d): d is string => !!d),
          responsavel: e.responsavel,
          medida: e.medida,
          checklist: e.checklist.map((i) => ({ ...i, id: this.gerarId(), feito: false })),
          processo: e.processo,
          etiquetas: e.etiquetas,
          observacoes: e.observacoes,
        },
        novosIds.get(e.id)!,
        e.ordem,
        c,
      ),
    );
    await this.salvar(
      {
        ...this.entradas(this.projetos, [[p.id, p]]),
        ...this.entradas(
          this.fases,
          [...novasFases.values()].map((f) => [f.id, f]),
        ),
        ...this.entradas(
          this.etapas,
          novas.map((e) => [e.id, e]),
        ),
      },
      registrosDeProjeto(undefined, p),
      c,
      // Copia o vínculo (talvez de um colega): não é marcar aqui.
      true,
    );
    return p;
  }

  // ---------- fases ----------

  /** "Combo que cria": se já existe fase viva com o mesmo nome (sem acento e sem caixa), devolve ela. */
  async criarFase(projeto: string, nome: string): Promise<Fase> {
    await this.exigirProjeto(projeto);
    const limpo = nomeLimpo(nome);
    if (!limpo) throw new ErroValidacao(["Informe o nome da fase."]);
    if (limpo.length > LIMITES.nome) throw new ErroValidacao([`O nome pode ter até ${LIMITES.nome} caracteres.`]);
    const todas = await this.fases.listar();
    const igual = todas.find((f) => vivo(f) && f.projeto === projeto && normalizarTexto(f.nome) === normalizarTexto(limpo));
    if (igual) return igual;
    const c = this.carimbo();
    const f = novaFase(projeto, limpo, this.gerarId(), indiceEntre(maiorOrdem(todas.filter((x) => x.projeto === projeto)), null), c);
    await this.salvar(this.entradas(this.fases, [[f.id, f]]), registrosDeFase(undefined, f), c);
    return f;
  }

  async renomearFase(id: string, nome: string): Promise<Fase> {
    const atual = await this.fases.obter(id);
    if (!vivo(atual)) throw new ErroValidacao(["A fase não existe mais."]);
    const limpo = nomeLimpo(nome);
    if (!limpo) throw new ErroValidacao(["Informe o nome da fase."]);
    const c = this.carimbo();
    const f = editar(atual, { nome: limpo.slice(0, LIMITES.nome) }, c);
    await this.salvar(this.entradas(this.fases, [[id, f]]), registrosDeFase(atual, f), c);
    return f;
  }

  /** As etapas da fase ficam sem fase (não somem). */
  async removerFase(id: string): Promise<void> {
    const atual = await this.fases.obter(id);
    if (!vivo(atual)) return;
    const c = this.carimbo();
    const afetadas = (await this.etapas.listar()).filter((e) => vivo(e) && e.fase === id);
    const f = remover(atual, c);
    await this.salvar(
      {
        ...this.entradas(
          this.etapas,
          afetadas.map((e) => [e.id, editar(e, { fase: undefined }, c)]),
        ),
        ...this.entradas(this.fases, [[id, f]]),
      },
      registrosDeFase(atual, f),
      c,
    );
  }

  // ---------- etapas ----------

  async obterEtapa(id: string): Promise<Etapa | undefined> {
    const e = await this.etapas.obter(id);
    return vivo(e) ? e : undefined;
  }

  private async etapasDoProjeto(projeto: string): Promise<Etapa[]> {
    return (await this.etapas.listar()).filter((e) => vivo(e) && e.projeto === projeto);
  }

  /**
   * `antigos`: dependências já salvas. As que apontam para etapa removida ficam (voltam a valer se ela
   * for restaurada) e não são validadas; só id novo precisa estar vivo. A fase só é conferida
   * quando está sendo escolhida agora (`conferirFase`): fase morta já salva conta como "sem fase".
   */
  private async conferirEtapa(e: Etapa, doProjeto: Etapa[], antigos: readonly string[] = [], conferirFase = true): Promise<void> {
    const vivas = new Set(doProjeto.map((x) => x.id));
    const alvo = { ...e, dependeDe: e.dependeDe.filter((d) => vivas.has(d) || !antigos.includes(d)) };
    const problemas = problemasDaEtapa(e);
    const dep = validarDependencias(alvo, doProjeto);
    if (dep) problemas.push(dep);
    if (e.fase && conferirFase) {
      const f = await this.fases.obter(e.fase);
      if (!vivo(f) || f.projeto !== e.projeto) problemas.push("A fase escolhida não existe mais.");
    }
    if (problemas.length) throw new ErroValidacao(problemas);
  }

  async criarEtapa(d: DadosNovaEtapa): Promise<Etapa> {
    await this.exigirProjeto(d.projeto);
    const doProjeto = await this.etapasDoProjeto(d.projeto);
    if (doProjeto.length >= LIMITES.etapasPorProjeto)
      throw new ErroValidacao([`Um projeto pode ter até ${LIMITES.etapasPorProjeto} etapas.`]);
    const c = this.carimbo();
    const e = novaEtapa(d, this.gerarId(), indiceEntre(maiorOrdem(doProjeto), null), c);
    await this.conferirEtapa(e, doProjeto);
    await this.salvar(this.entradas(this.etapas, [[e.id, e]]), registrosDeEtapa(undefined, e), c);
    return e;
  }

  /**
   * "Duplicar" do balão: a cópia da etapa no mesmo projeto ("Cópia de ..."), com as mesmas datas, fase, processo
   * e dependências vivas; a execução recomeça (sem conclusão nem documento, progresso 0, checklist desmarcado).
   * Grava como cópia, como o `duplicarProjeto`: o vínculo copiado (talvez de um colega) não é marcar aqui.
   */
  async duplicarEtapa(id: string): Promise<Etapa> {
    const origem = await this.obterEtapa(id);
    if (!origem) throw new ErroValidacao(["A etapa não existe mais."]);
    await this.exigirProjeto(origem.projeto);
    const doProjeto = await this.etapasDoProjeto(origem.projeto);
    if (doProjeto.length >= LIMITES.etapasPorProjeto)
      throw new ErroValidacao([`Um projeto pode ter até ${LIMITES.etapasPorProjeto} etapas.`]);
    const vivas = new Set(doProjeto.map((x) => x.id));
    const c = this.carimbo();
    const e = novaEtapa(
      {
        projeto: origem.projeto,
        nome: `Cópia de ${origem.nome}`.slice(0, LIMITES.nome),
        inicio: origem.inicio,
        fim: origem.fim,
        marco: origem.marco,
        fase: origem.fase,
        // Dependência de etapa excluída não vale para a etapa nova (a conferência recusaria).
        dependeDe: origem.dependeDe.filter((d) => vivas.has(d)),
        responsavel: origem.responsavel,
        medida: origem.medida,
        checklist: origem.checklist.map((i) => ({ ...i, feito: false })),
        processo: origem.processo,
        etiquetas: origem.etiquetas,
        observacoes: origem.observacoes,
      },
      this.gerarId(),
      indiceEntre(maiorOrdem(doProjeto), null),
      c,
    );
    await this.conferirEtapa(e, doProjeto);
    await this.salvar(this.entradas(this.etapas, [[e.id, e]]), registrosDeEtapa(undefined, e), c, true);
    return e;
  }

  async editarEtapa(id: string, m: MudancasEtapa, hoje: DataISO): Promise<Etapa> {
    const atual = await this.obterEtapa(id);
    if (!atual) throw new ErroValidacao(["A etapa não existe mais."]);
    const mud: MudancasEtapa = semObrigatoriosVazios(m, OBRIGATORIOS_ETAPA);
    if (typeof mud.nome === "string") mud.nome = nomeLimpo(mud.nome);
    if (mud.etiquetas) mud.etiquetas = etiquetasLimpas(mud.etiquetas);
    if (mud.checklist) mud.checklist = checklistLimpo(mud.checklist);
    if (mud.dependeDe) mud.dependeDe = [...new Set(mud.dependeDe)];
    if (typeof mud.progresso === "number") mud.progresso = Math.round(mud.progresso);
    if (typeof mud.observacoes === "string" && !mud.observacoes.trim()) mud.observacoes = undefined;
    const marco = mud.marco ?? atual.marco;
    const inicio = mud.inicio ?? atual.inicio;
    const fim = marco ? inicio : (mud.fim ?? atual.fim);
    const datas = inicio !== atual.inicio || fim !== atual.fim ? aplicarDatas(atual, inicio, fim, hoje) : { inicio, fim, base: atual.base };
    const final: MudancasEtapa & Pick<Etapa, "base"> = { ...mud, ...datas, marco };
    const doProjeto = await this.etapasDoProjeto(atual.projeto);
    await this.conferirEtapa(semVazios({ ...atual, ...final }), doProjeto, atual.dependeDe, mud.fase !== undefined);
    const c = this.carimbo();
    const e = editar(atual, final, c);
    await this.salvar(this.entradas(this.etapas, [[id, e]]), registrosDeEtapa(atual, e, await this.apoio(atual.projeto)), c);
    return e;
  }

  /**
   * Datas de um arraste no Gantt (ou de dependentes deslocadas). Recusa (sem gravar nada) o que
   * `problemasDasMudancas` recusa: data que não existe, fora de 2000 a 2100, etapa de mais de ~10
   * anos, ou violação NOVA de dependência (inclusive a predecessora que passa por cima da sucessora
   * parada); violação que já existia não trava. Aplica a regra da linha de base.
   */
  async moverDatas(mudancas: readonly MudancaDeDatas[], hoje: DataISO): Promise<Etapa[]> {
    const todas = (await this.etapas.listar()).filter(vivo);
    const problemas = problemasDasMudancas(todas, mudancas);
    if (problemas.length) throw new ErroValidacao(problemas);
    const porId = new Map(todas.map((e) => [e.id, e]));
    const novas = new Map<string, Etapa>();
    for (const m of mudancas) {
      const atual = porId.get(m.id);
      if (!atual) continue;
      const fim = atual.marco ? m.inicio : m.fim;
      novas.set(m.id, { ...atual, ...aplicarDatas(atual, m.inicio, fim, hoje) });
    }
    if (!novas.size) return [];
    const c = this.carimbo();
    const gravadas = [...novas.values()].map((e) => editar(porId.get(e.id)!, { inicio: e.inicio, fim: e.fim, base: e.base }, c));
    const registros = gravadas.flatMap((e) => registrosDeEtapa(porId.get(e.id), e));
    await this.salvar(
      this.entradas(
        this.etapas,
        gravadas.map((e) => [e.id, e]),
      ),
      registros,
      c,
    );
    return gravadas;
  }

  /** `documento`: ausente = fica o que a etapa tinha; `null` = tira (ver `concluir`). */
  async concluirEtapa(id: string, hoje: DataISO, documento?: DocumentoSei | null): Promise<Etapa> {
    const atual = await this.obterEtapa(id);
    if (!atual) throw new ErroValidacao(["A etapa não existe mais."]);
    return this.gravarConclusao(atual, hoje, documento);
  }

  /**
   * Concluir pelos balões da caixa, da árvore e do lateral: só a etapa ainda aberta (concluir de novo trocaria a
   * data da conclusão e o documento). Devolve a etapa concluída, ou null se ela já estava concluída ou não existe
   * mais (outro computador, outra aba, o painel), sem gravar nada. O documento segue a regra de sempre
   * (`problemasDoDocumento`; o da etapa sigilosa é marcado pela gravação: `marcasAoGravar`).
   */
  async concluirSeAberta(id: string, hoje: DataISO, documento?: DocumentoSei): Promise<Etapa | null> {
    const atual = await this.obterEtapa(id);
    if (!atual || atual.concluidaEm) return null;
    return this.gravarConclusao(atual, hoje, documento);
  }

  private async gravarConclusao(atual: Etapa, hoje: DataISO, documento?: DocumentoSei | null): Promise<Etapa> {
    // A mesma regra do diálogo e da importação: o Agente (P5) e os balões gravam por aqui, sem passar pelo diálogo.
    const problemas = documento ? problemasDoDocumento(documento) : [];
    if (problemas.length) throw new ErroValidacao(problemas);
    const c = this.carimbo();
    const e = concluir(atual, hoje, c, documento);
    await this.salvar(this.entradas(this.etapas, [[atual.id, e]]), registrosDeEtapa(atual, e), c);
    return e;
  }

  /**
   * O SEI mostrou o processo como sigiloso (a linha da caixa, a árvore): todo vínculo deste escopo com esse
   * número (`chaveProtocolo`: com ou sem pontuação, com letras), do projeto e das etapas, vivo ou lápide, passa a
   * `sigiloso: true` numa gravação só, pela máquina da P4 (modelo/sigilo.ts): a marca gruda sem mudar o carimbo
   * (como as de `marcasDeSigilo`; nenhum registro novo, e o histórico nunca leva o número), a gravação marca junto o
   * que a regra deduz (o documento da etapa que herda o processo) e a memória do sigilo guarda o número como local
   * (`marcasAoGravar`: esta gravação mudou o campo). Já marcado, nada é gravado no escopo, mas a tela promove a
   * memória a local. Sem vínculo nenhum com o número, mas com ele num registro "processo" do histórico (o projeto
   * ou a etapa trocou de processo): nada a marcar, e a memória guarda o número como local (o texto passa a raspar o
   * registro). Falha fechada: memória ilegível lança `ErroMemoriaSigilo` sem gravar nada. Devolve quantos vínculos
   * foram marcados (0: número sem dígito, nenhum vínculo com ele ou todos já marcados). Atalho de um item de
   * `marcarSigilosos`.
   */
  async marcarSigiloso(protocolo: string): Promise<number> {
    return this.marcarSigilosos([protocolo]);
  }

  /**
   * `marcarSigiloso` para todos os sigilosos que a tela mostrou de uma vez (a caixa inteira, a árvore): UMA leitura
   * do escopo decide tudo (o custo não cresce com o número de linhas sigilosas), uma gravação marca os vínculos e
   * outra, só se preciso, guarda na memória os números que não pediram marca (já marcados ou só num registro
   * "processo"). Números repetidos ou sem dígito são ignorados.
   */
  async marcarSigilosos(protocolos: readonly string[]): Promise<number> {
    const ks = new Set<string>();
    for (const p of protocolos) {
      const k = typeof p === "string" ? chaveProtocolo(p) : "";
      if (k) ks.add(k);
    }
    if (!ks.size) return 0;
    const chaveDe = (v: Vinculo | undefined): string => (v && typeof v.protocolo === "string" ? chaveProtocolo(v.protocolo) : "");
    const t = await this.entidades();
    const marcar = <T extends Projeto | Etapa>(x: T): T => ({ ...x, processo: { ...(x.processo as Vinculo), sigiloso: true } });
    const precisa = (x: Projeto | Etapa) => ks.has(chaveDe(x.processo)) && x.processo?.sigiloso !== true;
    const ps = t.p.filter(precisa).map(marcar);
    const es = t.e.filter(precisa).map(marcar);
    // O que esta gravação marca vai à memória por ela (`marcasAoGravar`); o resto dos números da tela que este escopo
    // conhece (no vínculo já marcado ou num registro "processo") vai à memória aqui.
    const marcados = new Set([...ps, ...es].map((x) => chaveDe(x.processo)));
    const conhecidos = new Set([...t.p, ...t.e].map((x) => chaveDe(x.processo)));
    for (const r of t.h)
      if (r.campo === "processo")
        for (const x of [r.antes, r.depois]) if (typeof x === "string" && chaveProtocolo(x)) conhecidos.add(chaveProtocolo(x));
    const lembrar = [...ks].filter((k) => !marcados.has(k) && conhecidos.has(k));
    if (ps.length || es.length)
      await this.salvar(
        {
          ...this.entradas(
            this.projetos,
            ps.map((p) => [p.id, p]),
          ),
          ...this.entradas(
            this.etapas,
            es.map((e) => [e.id, e]),
          ),
        },
        [],
        this.carimbo(),
      );
    if (lembrar.length) await this.lembrarSigilo({ processos: lembrar, documentos: [] }, "local", { promover: true });
    return ps.length + es.length;
  }

  async reabrirEtapa(id: string): Promise<Etapa> {
    const atual = await this.obterEtapa(id);
    if (!atual) throw new ErroValidacao(["A etapa não existe mais."]);
    const c = this.carimbo();
    const e = reabrir(atual, c);
    await this.salvar(this.entradas(this.etapas, [[id, e]]), registrosDeEtapa(atual, e), c);
    return e;
  }

  async removerEtapa(id: string): Promise<void> {
    const atual = await this.obterEtapa(id);
    if (!atual) return;
    const c = this.carimbo();
    const e = remover(atual, c);
    await this.salvar(this.entradas(this.etapas, [[id, e]]), registrosDeEtapa(atual, e), c);
  }

  async restaurarEtapa(id: string): Promise<Etapa | undefined> {
    const atual = await this.etapas.obter(id);
    if (!atual || atual.removidoEm === undefined) return atual;
    if (!(await this.obterProjeto(atual.projeto))) throw new ErroValidacao(["O projeto não existe mais."]);
    const fase = atual.fase ? await this.fases.obter(atual.fase) : undefined;
    const faseViva = vivo(fase) && fase.projeto === atual.projeto;
    const c = this.carimbo();
    const e = restaurar(faseViva ? atual : { ...atual, fase: undefined }, c);
    await this.salvar(this.entradas(this.etapas, [[id, e]]), registrosDeEtapa(atual, e), c);
    return e;
  }

  /** "Redefinir plano original" (menu do projeto): a base de cada etapa replanejada passa a ser as datas atuais. */
  async redefinirPlanoOriginal(projeto: string): Promise<number> {
    const alvos = (await this.etapasDoProjeto(projeto)).filter(planoParaRedefinir);
    if (!alvos.length) return 0;
    const c = this.carimbo();
    const gravadas = alvos.map((e) => editar(e, { base: e.base ? redefinirBase(e) : baseInicial(e.inicio, e.fim) }, c));
    await this.salvar(
      this.entradas(
        this.etapas,
        gravadas.map((e) => [e.id, e]),
      ),
      gravadas.flatMap((e, i) => registrosDeEtapa(alvos[i], e)),
      c,
    );
    return gravadas.length;
  }

  // ---------- modelos ----------

  /**
   * Projeto novo a partir de um modelo (embutido ou salvo), começando em `inicio`. Projeto, fases e
   * etapas vão numa gravação só (um aviso em `aoMudar`); o modelo inválido ou que gere datas em
   * conflito é recusado sem gravar nada.
   */
  async criarProjetoDeModelo(d: DadosNovoProjeto, modelo: Modelo, inicio: DataISO): Promise<Projeto> {
    await this.exigirVagaDeProjeto();
    if (!dataNaFaixa(inicio)) throw new ErroValidacao(["Use datas entre 2000 e 2100."]);
    const c = this.carimbo();
    const p = novoProjeto(d, this.gerarId(), indiceEntre(maiorOrdem(await this.projetos.listar()), null), c);
    const problemas = [...problemasDoProjeto(p), ...problemasDoModelo(modelo)];
    if (problemas.length) throw new ErroValidacao([...new Set(problemas)]);
    const { fases, etapas } = aplicarModelo(modelo, inicio, { projeto: p.id, carimbo: c, novoId: this.gerarId });
    // O modelo empurra as datas em dias úteis: começando perto de 2100, a última etapa pode passar (e seria recusada lá fora).
    if (etapas.some((e) => !dataNaFaixa(e.inicio) || !dataNaFaixa(e.fim)))
      throw new ErroValidacao(["Com esse começo, o projeto passaria de 2100."]);
    const conflitos = violacoesDeDatas(etapas);
    if (conflitos.length) throw new ErroValidacao(conflitos);
    await this.salvar(
      {
        ...this.entradas(this.projetos, [[p.id, p]]),
        ...this.entradas(
          this.fases,
          fases.map((f) => [f.id, f]),
        ),
        ...this.entradas(
          this.etapas,
          etapas.map((e) => [e.id, e]),
        ),
      },
      registrosDeProjeto(undefined, p),
      c,
    );
    return p;
  }

  async salvarComoModelo(projeto: string, nome: string, descricao?: string): Promise<Modelo> {
    await this.exigirProjeto(projeto);
    const vivos = (await this.modelos.listar()).filter(vivo);
    if (vivos.length >= LIMITES.modelos) throw new ErroValidacao([`Limite de ${LIMITES.modelos} modelos. Exclua algum.`]);
    const d = await this.dados();
    const c = this.carimbo();
    const m = modeloDoProjeto(
      { fases: d.fases.filter((f) => f.projeto === projeto), etapas: d.etapas.filter((e) => e.projeto === projeto) },
      nome,
      this.gerarId(),
      c,
      descricao,
    );
    const problemas = problemasDoModelo(m);
    if (problemas.length) throw new ErroValidacao(problemas);
    await this.modelos.gravar(m.id, m);
    return m;
  }

  async renomearModelo(id: string, nome: string): Promise<Modelo> {
    const atual = await this.modelos.obter(id);
    if (!vivo(atual)) throw new ErroValidacao(["O modelo não existe mais."]);
    const proposta = { ...atual, nome: nomeLimpo(nome) };
    const problemas = problemasDoModelo(proposta);
    if (problemas.length) throw new ErroValidacao(problemas);
    const m = editar(atual, { nome: proposta.nome }, this.carimbo());
    await this.modelos.gravar(id, m);
    return m;
  }

  async removerModelo(id: string): Promise<void> {
    const atual = await this.modelos.obter(id);
    if (vivo(atual)) await this.modelos.gravar(id, remover(atual, this.carimbo()));
  }

  // ---------- sincronia, arquivo, limpeza ----------

  /** Envelope do escopo com TUDO (lápides inclusive). A privacidade dos sigilosos é do adaptador da sincronia (P4). */
  async exportar(agora: number = Date.now()): Promise<EnvelopeProjetos> {
    return this.envelopeDe(await this.entidades(), agora);
  }

  private envelopeDe(entidades: Entidades, agora: number): EnvelopeProjetos {
    const env: EnvelopeProjetos = {
      formato: "seipro-projetos",
      versao: 1,
      host: this.escopo.host,
      unidade: this.escopo.unidade,
      vis: this.escopo.vis,
      gerado: agora,
      entidades,
    };
    if (this.escopo.vis === "eu") env.login = this.escopo.login.trim().toLowerCase();
    return env;
  }

  /**
   * Mescla entidades vindas de fora (Texto Padrão, arquivo, outro escopo): por
   * entidade vence a gravação mais recente (`mesclar` do sei-comum). Item
   * malformado (`entidadeValida`) ou com carimbo mais de 1 dia à frente do relógio
   * daqui é ignorado; dependência repetida sai. Tetos da spec 5.4: 100 projetos
   * ativos, 300 etapas vivas por projeto, 50 modelos vivos (o que já contava aqui
   * fica; dos que passariam a contar, entram os primeiros pelo id) e os 300
   * registros mais recentes; o excedente é ignorado e contado em `excedentes`.
   * Vínculo sigiloso que chega vazio (sem número) mantém o número que este
   * computador já tinha, e o documento que chega como o marcador do texto
   * (`DOCUMENTO_VAZIO`) mantém o número daqui, marcado (`manterDocumentoSigiloso`);
   * a etapa que chega sem o documento é remoção e vale como chegou. Registro do
   * histórico com o mesmo carimbo do daqui é o mesmo registro, raspado pelo
   * envelope: fica o daqui. O que a mescla deixaria igual ao que já está aqui não
   * é regravado: a sincronia ouve as gravações, e regravar o mesmo a cada rodada
   * viraria um laço de leituras. O escopo e a memória do sigilo são lidos numa
   * chamada só (o que se mescla e o que se sabe sigiloso são do mesmo instante).
   * Tudo vai num `area.gravar` só (um aviso em `aoMudar`);
   * `anotacoes` (registros do histórico a criar junto, com o carimbo) entram nessa
   * mesma gravação. Registros antigos daqui além dos 300 são podados depois.
   * Com `inteiro` (o "Receber projeto", que é tudo ou nada), qualquer item ignorado
   * (torto ou além de um teto) faz lançar `ErroValidacao` sem gravar nada: o teto é
   * decidido pela mesma leitura que a gravação usa, e uma aba que criou o 100º
   * projeto no meio não deixa fases e etapas sem projeto no escopo.
   */
  async importar(
    ent: Partial<Entidades>,
    anotacoes?: { registros: RegistroNovo[]; carimbo: Carimbo },
    opcoes: { inteiro?: boolean } = {},
  ): Promise<ResultadoImportacao> {
    const agora = this.carimbo().agora;
    const soma: ResultadoImportacao = { novos: 0, atualizados: 0, ignorados: 0, excedentes: 0 };
    let projetosExcedentes = 0;
    let itens: Record<string, unknown> = {};
    let importouRegistros = false;
    // Uma leitura só: o escopo e a memória do sigilo. Falha fechada: sem a memória legível, a mescla não roda (o
    // motor trata como erro comum).
    const tudo = await this.lerChaves(true);
    const memoria = lerMemoria(tudo, this.prefixoMemoria);
    const aqui = entidadesDe(tudo, this.base);
    const mesclarCol = <T extends Versionada>(
      col: Colecao<T>,
      locais: readonly T[],
      lista: readonly unknown[] | undefined,
      tipo: keyof Entidades,
      teto: (locais: ReadonlyMap<string, T>, vencedoras: readonly T[]) => Set<string>,
      combinar?: (vencedor: T, local: T | undefined) => T,
      aceitar?: (vencedor: T) => boolean,
    ) => {
      const r = this.mesclarEm(locais, lista ?? [], tipo, agora, teto, combinar, aceitar);
      soma.novos += r.novos;
      soma.atualizados += r.atualizados;
      soma.ignorados += r.ignorados;
      soma.excedentes += r.excedentes;
      if (tipo === "p") projetosExcedentes += r.excedentes;
      if (tipo === "h" && r.gravar.length) importouRegistros = true;
      itens = { ...itens, ...this.entradas(col, r.gravar) };
      return r.gravar;
    };
    const projetosAqui = aqui.p;
    const etapasAqui = aqui.e;
    const registrosAqui = aqui.h;
    // Memória do sigilo: o registro de mesmo carimbo que chega raspado ensina o número (o daqui fica como está).
    const aprendido = aprendidoDosRegistros(registrosAqui, (ent.h ?? []) as unknown[]);
    const jaSabidos = conhecidosDe(memoria);
    const conhecidos: SigilosConhecidos = {
      processos: new Set([...jaSabidos.processos, ...aprendido.processos]),
      documentos: new Set([...jaSabidos.documentos, ...aprendido.documentos]),
    };
    const projetosNovos = mesclarCol(
      this.projetos,
      projetosAqui,
      ent.p,
      "p",
      (l, v) => alemDoTeto(l, v, (x) => (vivo(x) && x.arquivadoEm === undefined ? "" : null), LIMITES.projetosAtivos),
      manterNumeroSigiloso,
    );
    // Órfão (fase, etapa ou registro de um projeto que não existe aqui nem fica com esta mescla, viva ou lápide):
    // ignorado. Um texto editado à mão não enche o armazenamento de itens que nenhuma tela mostra e que voltariam
    // ao texto a cada rodada; a etapa de uma corrida legítima chega com o projeto (mesmo em lápide). O projeto que
    // vem do futuro (recusado aqui, mas levado de volta ao texto por `comOsDoFuturo`) também conta: a etapa que um
    // colega pôs nele não é órfã, senão este computador a tiraria do texto e o colega a regravaria.
    const doFuturo = ((ent.p ?? []) as unknown[]).filter((x) => entidadeValida(x, "p") && !entidadeValida(x, "p", agora)) as Projeto[];
    const existentes = new Set([...projetosAqui.map((p) => p.id), ...projetosNovos.map(([id]) => id), ...doFuturo.map((p) => p.id)]);
    const comProjeto = (x: { projeto: string }) => existentes.has(x.projeto);
    // O corte dos 300 registros conta como o texto (o mesmo predicado de órfão, com os mesmos projetos).
    const ficam = projetosQueFicam([...sobrepor(projetosAqui, projetosNovos), ...doFuturo], agora, diasDeLapide(this.escopo.vis));
    mesclarCol(this.fases, aqui.f, ent.f, "f", () => new Set(), undefined, comProjeto);
    const etapasNovas = mesclarCol(
      this.etapas,
      etapasAqui,
      ent.e,
      "e",
      (l, v) => alemDoTeto(l, v, (x) => (vivo(x) ? x.projeto : null), LIMITES.etapasPorProjeto),
      (v, l) => manterDocumentoSigiloso(manterNumeroSigiloso(v, l), l),
      comProjeto,
    );
    const registrosNovos = mesclarCol(
      this.registros,
      registrosAqui,
      ent.h,
      "h",
      (l, v) => registrosAlemDoTeto(l, v, ficam, agora),
      registroDaqui,
      comProjeto,
    );
    mesclarCol(this.modelos, aqui.m, ent.m, "m", (l, v) => alemDoTeto(l, v, (x) => (vivo(x) ? "" : null), LIMITES.modelos));
    // Tudo ou nada: decidido antes de qualquer gravação, sobre a mesma leitura.
    if (opcoes.inteiro && soma.ignorados)
      throw new ErroValidacao([
        projetosExcedentes
          ? mensagemDoLimite(this.escopo.vis)
          : "Nada foi gravado: há itens inválidos ou além dos limites (300 etapas por projeto, 50 modelos).",
      ]);
    // O sigilo gruda: as marcas que o estado mesclado pede (o número marcado do lado de fora, a marca que a cópia
    // igual de um colega traz) entram na mesma gravação, sem mudar o carimbo.
    const mesclado = { p: sobrepor(projetosAqui, projetosNovos), e: sobrepor(etapasAqui, etapasNovas) };
    const marcas = marcasDeSigilo(
      mesclado,
      { p: [...projetosAqui, ...((ent.p ?? []) as unknown[])], e: [...etapasAqui, ...((ent.e ?? []) as unknown[])] },
      conhecidos,
    );
    const jaGravados = new Set([...projetosNovos, ...etapasNovas].map(([id]) => id));
    const marcadas = {
      ...this.entradas(
        this.projetos,
        marcas.p.map((x) => [x.id, x]),
      ),
      ...this.entradas(
        this.etapas,
        marcas.e.map((x) => [x.id, x]),
      ),
    };
    soma.atualizados += [...marcas.p, ...marcas.e].filter((x) => !jaGravados.has(x.id)).length;
    // A versão de fora que só difere da daqui pela marca de sigilo que a daqui já tem (mesmo carimbo: a cópia sem a
    // marca vence o desempate do `mesclar`) volta igual depois das marcas: não é regravada nem contada. Sem isso, um
    // texto com o documento em claro numa etapa sigilosa (editado à mão; o vínculo vazio sem a marca, que agora vira
    // "sem processo") regravaria o mesmo a cada rodada, e a sincronia ouve as gravações.
    for (const [k, v] of Object.entries({ ...itens, ...marcadas })) {
      if (!k.startsWith(this.projetos.prefixo) && !k.startsWith(this.etapas.prefixo)) continue;
      if (!(k in tudo) || jsonEstavel(v) !== jsonEstavel(tudo[k])) continue;
      delete itens[k];
      delete (marcadas as Record<string, unknown>)[k];
      soma.atualizados -= 1;
    }
    // A memória ganha, como aprendida (com o teto: a mescla é dado de fora, e nada aqui foi marcado por este
    // dispositivo), o que os registros ensinaram, o que já estava marcado aqui antes da mescla, o que ficou marcado no
    // estado mesclado e o que o envelope rasparia dele (um colega que perca a base depois, antes de algum texto ser
    // montado aqui, não solta o número por este computador). Fora do escopo: não acorda o `aoMudar`.
    const pM = sobrepor(
      mesclado.p,
      marcas.p.map((x) => [x.id, x]),
    );
    const eM = sobrepor(
      mesclado.e,
      marcas.e.map((x) => [x.id, x]),
    );
    const corte = cortarSigilo({ p: pM, e: eM, h: sobrepor(registrosAqui, registrosNovos) }, sigiloDoEnvelope(pM, eM, conhecidos));
    const daMemoria = this.entradasPorOrigem(memoria, {
      local: nenhumNumero(),
      aprendida: juntarNumeros(aprendido, marcadosNoEstado(projetosAqui, etapasAqui), marcadosNoEstado(pM, eM), corte.raspados),
    });
    itens = { ...itens, ...marcadas, ...daMemoria };
    // Com anotações ("Quem vê"), a gravação leva os itens que vieram de fora: nada vira local por ela.
    if (anotacoes) await this.salvar(itens, anotacoes.registros, anotacoes.carimbo, true);
    else if (Object.keys(itens).length) await this.area.gravar(itens);
    if (importouRegistros && !anotacoes?.registros.length) await this.podarHistorico(agora);
    return soma;
  }

  /**
   * `aceitar` recusa uma vencedora que mudaria o estado daqui (o órfão): conta como ignorada e não ocupa vaga de
   * teto. O item igual ao daqui não é vencedora e não conta.
   */
  private mesclarEm<T extends Versionada>(
    locais: readonly T[],
    itens: readonly unknown[],
    tipo: keyof Entidades,
    agora: number,
    teto: (locais: ReadonlyMap<string, T>, vencedoras: readonly T[]) => Set<string>,
    combinar: (vencedor: T, local: T | undefined) => T = (v) => v,
    aceitar: (vencedor: T) => boolean = () => true,
  ): { gravar: Array<[string, T]>; novos: number; atualizados: number; ignorados: number; excedentes: number } {
    const validos = itens.filter((x) => entidadeValida(x, tipo, agora)).map((x) => sanear(x as T, tipo));
    const porId = new Map(locais.map((i) => [i.id, i]));
    // `mesclar` devolve o próprio objeto vencedor: se é o local, nada a gravar.
    const mudam = mesclar([...locais], validos).filter((v) => v !== porId.get(v.id));
    const vencedoras = mudam.filter(aceitar);
    const recusadas = mudam.length - vencedoras.length;
    const fora = teto(porId, vencedoras);
    const gravar: Array<[string, T]> = [];
    let novos = 0;
    let atualizados = 0;
    for (const vencedor of vencedoras) {
      if (fora.has(vencedor.id)) continue;
      const atual = porId.get(vencedor.id);
      const final = combinar(vencedor, atual);
      // A cópia sem os dados sigilosos, com o mesmo carimbo, pode vencer o desempate e voltar igual ao local.
      if (atual && jsonEstavel(final) === jsonEstavel(atual)) continue;
      gravar.push([vencedor.id, final]);
      if (atual) atualizados += 1;
      else novos += 1;
    }
    const invalidos = itens.length - validos.length;
    return { gravar, novos, atualizados, ignorados: invalidos + recusadas + fora.size, excedentes: fora.size };
  }

  /**
   * Lápide, numa gravação só, no projeto, nas fases, nas etapas e nos registros que
   * foram para outro escopo (mover entre escopos), com o carimbo `c`.
   */
  async lapidarMovidos(d: { p: Projeto; f: Fase[]; e: Etapa[]; h: Registro[] }, c: Carimbo): Promise<void> {
    await this.area.gravar({
      ...this.entradas(
        this.etapas,
        d.e.map((e) => [e.id, remover(e, c)]),
      ),
      ...this.entradas(
        this.fases,
        d.f.map((f) => [f.id, remover(f, c)]),
      ),
      ...this.entradas(
        this.registros,
        d.h.map((r) => [r.id, remover(r, c)]),
      ),
      ...this.entradas(this.projetos, [[d.p.id, remover(d.p, c)]]),
    });
  }

  /**
   * Apaga de vez as lápides velhas (180 dias na unidade, 90 no "só eu": um
   * usuário eventual da unidade não pode ressuscitar exclusões), a fase e a
   * etapa vivas e os registros de projeto que não fica (órfãos: o mesmo
   * predicado do texto, `projetosQueFicam`) e poda o histórico em 300
   * registros. Lê o escopo e a memória do sigilo numa chamada só: uma gravação
   * de outra aba no meio não faz uma etapa nova parecer órfã. Devolve quantas
   * chaves saíram. `Area` não tem "gravar e remover" juntos: é uma única
   * `remover` com todas as chaves.
   */
  async limpar(agora: number = Date.now()): Promise<number> {
    const dias = diasDeLapide(this.escopo.vis);
    const chaves: string[] = [];
    const ficam = <T extends Versionada>(col: Colecao<T>, todos: T[]): T[] => {
      const manter = purgarLapides(todos, agora, dias);
      const ids = new Set(manter.map((i) => i.id));
      for (const i of todos) if (!ids.has(i.id)) chaves.push(col.chave(i.id));
      return manter;
    };
    // Falha fechada: sem ler o escopo ou a memória, lança (`ErroMemoriaSigilo`) e nada é podado.
    const tudo = await this.lerChaves(true);
    const memoria = lerMemoria(tudo, this.prefixoMemoria);
    const { p: projetos, f: fases, e: etapas, m: modelos, h: regs } = entidadesDe(tudo, this.base);
    ficam(this.projetos, projetos);
    const projetosFicam = projetosQueFicam(projetos, agora, dias);
    // Fase e etapa vivas de projeto que não existe (a lápide dele saiu agora ou antes; a etapa de uma corrida com
    // a exclusão do projeto): nenhuma tela as mostra e o texto já não as leva.
    const semProjeto = <T extends Versionada & { projeto: string }>(col: Colecao<T>, mantidas: T[]) => {
      for (const x of mantidas) if (x.removidoEm === undefined && !projetosFicam.has(x.projeto)) chaves.push(col.chave(x.id));
    };
    semProjeto(this.fases, ficam(this.fases, fases));
    semProjeto(this.etapas, ficam(this.etapas, etapas));
    ficam(this.modelos, modelos);
    // O registro órfão sai (o texto já não o leva); os outros, além dos 300, também.
    const comProjeto: Registro[] = [];
    for (const r of ficam(this.registros, regs)) {
      if (projetosFicam.has(r.projeto)) comProjeto.push(r);
      else chaves.push(this.registros.chave(r.id));
    }
    for (const id of excedentes(comProjeto, LIMITES.historico, agora)) chaves.push(this.registros.chave(id));
    // Antes de as lápides saírem, tudo o que o envelope rasparia delas (vínculos, documentos e os registros pela
    // etapa sigilosa) vai para a memória do sigilo, que segue raspando sem elas; o histórico daqui fica como está.
    // Como aprendida: o que este dispositivo marcou já entrou como local na gravação que o marcou. Falha fechada:
    // sem gravar a memória, lança e nada é podado.
    const conhecidos = conhecidosDe(memoria);
    const corte = cortarSigilo({ p: projetos, e: etapas, h: regs }, sigiloDoEnvelope(projetos, etapas, conhecidos));
    const entradas = this.entradasPorOrigem(memoria, {
      local: nenhumNumero(),
      aprendida: juntarNumeros(marcadosNoEstado(projetos, etapas), corte.raspados),
    });
    if (Object.keys(entradas).length) await this.area.gravar(entradas);
    if (chaves.length) await this.area.remover(chaves);
    return chaves.length;
  }

  /** Índice protocolo → vínculos deste escopo (para juntar os dois escopos, use `indiceDosEscopos`). */
  async vinculos(): Promise<Map<string, VinculoProcesso[]>> {
    const d = await this.dados();
    return indiceDeProcessos([{ vis: this.escopo.vis, projetos: d.projetos, etapas: d.etapas }]);
  }

  /** Um aviso por gravação no escopo (ouve a base, não cada coleção). */
  aoMudar(cb: () => void): () => void {
    return this.area.aoMudar((m) => {
      if (Object.keys(m).some((k) => k.startsWith(this.base))) cb();
    });
  }
}

/**
 * Vínculo sigiloso que chegou sem número (Texto Padrão) mantém o número deste computador, mesmo que
 * aqui ainda não se soubesse do sigilo (o vínculo local passa a ser sigiloso). Se os dois lados têm
 * `idProcedimento` e eles diferem, não é o mesmo processo: fica o que chegou.
 */
export function manterNumeroSigiloso<T extends { processo?: Vinculo }>(vencedor: T, local: T | undefined): T {
  const v = vencedor.processo;
  const l = local?.processo;
  if (!v?.sigiloso || v.protocolo || !l?.protocolo) return vencedor;
  if (v.idProcedimento && l.idProcedimento && v.idProcedimento !== l.idProcedimento) return vencedor;
  return { ...vencedor, processo: semVazios({ ...v, protocolo: l.protocolo, idProcedimento: v.idProcedimento ?? l.idProcedimento }) };
}

/**
 * O documento de processo sigiloso que chegou como o marcador do texto (`DOCUMENTO_VAZIO`, sem o número: o
 * Texto Padrão não leva o número, sincronia/textoPadrao.ts) fica com o número deste computador, marcado
 * sigiloso (e com o título daqui); sem número aqui, fica o marcador. Só o marcador exato conta: a etapa que
 * chega SEM o campo `documento` é remoção (quem tinha o número tirou o documento) e vale como chegou, pela
 * regra normal de versão; o número vazio sem a marca é "sem documento" e também vale como chegou.
 */
export function manterDocumentoSigiloso(vencedor: Etapa, local: Etapa | undefined): Etapa {
  const l = local?.documento;
  if (!documentoSemNumero(vencedor.documento) || !l?.numero) return vencedor;
  return { ...vencedor, documento: l.sigiloso ? l : { ...l, sigiloso: true } };
}

/**
 * Registro do histórico não muda depois de gravado: com o mesmo carimbo (instante e dispositivo), a cópia
 * de fora é o mesmo registro, só que raspada pelo envelope (sem o número sigiloso). Fica o daqui.
 */
function registroDaqui(vencedor: Registro, local: Registro | undefined): Registro {
  return local && local.atualizadoEm === vencedor.atualizadoEm && local.dispositivo === vencedor.dispositivo ? local : vencedor;
}

/**
 * O item de fora já conferido (`entidadeValida`), como fica aqui: o vínculo que não diz processo nenhum sai
 * (`semVinculoVazio`: senão o documento de uma etapa de projeto sigiloso ia em claro ao texto) e a dependência
 * repetida sai (a Frappe desenharia a seta duas vezes). Só copia quando há o que tirar.
 */
function sanear<T>(x: T, tipo: keyof Entidades): T {
  if (tipo === "p") return semVinculoVazio(x as unknown as Projeto) as unknown as T;
  if (tipo !== "e") return x;
  const e = semVinculoVazio(x as unknown as Etapa);
  const deps = [...new Set(e.dependeDe)];
  return (deps.length === e.dependeDe.length ? e : { ...e, dependeDe: deps }) as unknown as T;
}

const compararIds = (a: { id: string }, b: { id: string }): number => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);

/**
 * Vencedoras da mescla que passariam de um teto (spec 5.4), por grupo (`grupo` devolve null para o
 * que não conta, como lápide e arquivado). O que já contava aqui no mesmo grupo fica; das que passam
 * a contar agora, entram as primeiras pelo id até o teto. Devolve os ids que ficam de fora.
 */
function alemDoTeto<T extends Versionada>(
  locais: ReadonlyMap<string, T>,
  vencedoras: readonly T[],
  grupo: (x: T) => string | null,
  teto: number,
): Set<string> {
  const conta = new Map<string, number>();
  const somar = (g: string) => conta.set(g, (conta.get(g) ?? 0) + 1);
  const trocadas = new Set(vencedoras.map((v) => v.id));
  for (const [id, l] of locais) {
    const g = trocadas.has(id) ? null : grupo(l);
    if (g !== null) somar(g);
  }
  const entrando: T[] = [];
  for (const v of vencedoras) {
    const g = grupo(v);
    if (g === null) continue;
    const l = locais.get(v.id);
    if (l && grupo(l) === g) somar(g);
    else entrando.push(v);
  }
  const fora = new Set<string>();
  for (const v of entrando.sort(compararIds)) {
    const g = grupo(v) as string;
    if ((conta.get(g) ?? 0) >= teto) fora.add(v.id);
    else somar(g);
  }
  return fora;
}

/**
 * Registros: ficam os 300 mais recentes do escopo, contados como na poda e no texto (só os de projeto que fica, o
 * do futuro atrás); os que chegam e não estariam entre eles ficam de fora.
 */
function registrosAlemDoTeto(
  locais: ReadonlyMap<string, Registro>,
  vencedoras: readonly Registro[],
  ficam: ReadonlySet<string>,
  agora: number,
): Set<string> {
  const final = new Map(locais);
  for (const v of vencedoras) final.set(v.id, v);
  const chegando = new Set(vencedoras.map((v) => v.id));
  const contam = [...final.values()].filter((r) => ficam.has(r.projeto));
  return new Set(excedentes(contam, LIMITES.historico, agora).filter((id) => chegando.has(id)));
}

/** As entidades de um escopo a partir das chaves lidas (`base` = `baseDoEscopo`). */
function entidadesDe(tudo: Record<string, unknown>, base: string): Entidades {
  const lista = Object.entries(tudo);
  const de = <T>(t: string) => lista.filter(([k]) => k.startsWith(`${base}${t}/`)).map(([, v]) => v as T);
  return { p: de<Projeto>("p"), f: de<Fase>("f"), e: de<Etapa>("e"), h: de<Registro>("h"), m: de<Modelo>("m") };
}

/** Os números de `n` que não estão em `de`. */
function foraDe(n: Numeros, de: Numeros): Numeros {
  const p = new Set(de.processos);
  const d = new Set(de.documentos);
  return { processos: n.processos.filter((x) => !p.has(x)), documentos: n.documentos.filter((x) => !d.has(x)) };
}

/** A lista com as versões que vão ser gravadas por cima (pelo id). */
function sobrepor<T extends { id: string }>(lista: readonly T[], novas: ReadonlyArray<readonly [string, unknown]>): T[] {
  const m = new Map(lista.map((x) => [x.id, x]));
  for (const [, v] of novas) m.set((v as T).id, v as T);
  return [...m.values()];
}

const texto = (x: unknown): x is string => typeof x === "string";
const textoAte =
  (max: number) =>
  (x: unknown): x is string =>
    texto(x) && x.length <= max;
const finito = (x: unknown): x is number => typeof x === "number" && Number.isFinite(x);
const objeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const opcional = (x: unknown, ok: (v: unknown) => boolean): boolean => x === undefined || ok(x);
const listaDe = (x: unknown, max: number, ok: (v: unknown) => boolean): boolean =>
  Array.isArray(x) && x.length <= max && x.every((v) => ok(v));
const MEDIDAS: ReadonlySet<unknown> = new Set(["manual", "tempo", "checklist"]);

const nomeValido = textoAte(LIMITES.nome);
const rotuloValido = textoAte(LIMITES.rotulo);
const ordemValida = textoAte(LIMITES.ordem);
const valorDoRegistro = textoAte(LIMITES.registroValor);
const etiquetasValidas = (x: unknown): boolean => listaDe(x, LIMITES.etiquetas, textoAte(LIMITES.etiquetaTexto));
const origemValida = (x: unknown): boolean => opcional(x, (o) => objeto(o) && opcional(o.atividades, finito));
const responsavelValido = (x: unknown): boolean => opcional(x, (r) => objeto(r) && nomeValido(r.nome) && opcional(r.login, rotuloValido));
const itemValido = (x: unknown): boolean =>
  objeto(x) && texto(x.id) && textoAte(LIMITES.checklistTexto)(x.texto) && typeof x.feito === "boolean";
const progressoValido = (x: unknown): boolean => finito(x) && x >= 0 && x <= 100;

/** Datas de etapa (ou da base): existem, de 2000 a 2100, até `LIMITE_DIAS_ETAPA` e (`emOrdem`) término >= início. */
function datasValidas(inicio: unknown, fim: unknown, emOrdem: boolean): boolean {
  if (!dataNaFaixa(inicio) || !dataNaFaixa(fim)) return false;
  if (emOrdem && fim < inicio) return false;
  return diferencaDias(inicio, fim) <= LIMITE_DIAS_ETAPA;
}

/** A mesma regra da etapa: término antes do início não recusa (a base acompanha as datas no planejamento). */
const baseValida = (x: unknown): boolean => opcional(x, (b) => objeto(b) && datasValidas(b.inicio, b.fim, false));

/**
 * `processo` opcional: objeto com `protocolo` (forma de número de processo, `RE_PROTOCOLO`), `idProcedimento`
 * só dígitos ou ausente, `sigiloso` booleano ou ausente. Vem do texto da unidade (de qualquer colega) e
 * vai à pesquisa rápida quando alguém clica: nada além de número.
 */
function vinculoValido(v: unknown): boolean {
  if (v === undefined) return true;
  if (!objeto(v)) return false;
  return (
    texto(v.protocolo) &&
    RE_PROTOCOLO.test(v.protocolo) &&
    opcional(v.idProcedimento, (x) => texto(x) && RE_ID_PROCEDIMENTO.test(x)) &&
    opcional(v.sigiloso, (b) => typeof b === "boolean")
  );
}

/**
 * `documento` opcional: `numero` vazio (sem documento, ou o marcador do documento de processo sigiloso) ou só
 * dígitos, de 1 a 20 (`RE_DOCUMENTO`, a regra do diálogo); `titulo` texto de até 200 ou ausente. Vem do texto da
 * unidade: um `{ numero: " " }` editado à mão viraria "Documento SEI  " com link.
 */
function documentoValido(d: unknown): boolean {
  if (d === undefined) return true;
  if (!objeto(d)) return false;
  return (
    texto(d.numero) &&
    (d.numero === "" || RE_DOCUMENTO.test(d.numero)) &&
    opcional(d.titulo, textoAte(LIMITES.nome)) &&
    opcional(d.sigiloso, (b) => typeof b === "boolean")
  );
}

/**
 * Forma completa de cada tipo, campo a campo: o Texto Padrão da unidade é compartilhado e pode ser
 * editado à mão, e um item torto derrubaria o painel de todos (lista, filtro, Gantt). Ids (inclusive
 * os referenciados em `projeto`, `fase`, `dependeDe` e `alvo`) casam com `RE_ID`; textos e listas
 * respeitam os limites da spec 5.4 (os do diálogo, para o item continuar editável); datas existem e
 * ficam de 2000 a 2100. Com `agora`, carimbo (`atualizadoEm`, `removidoEm`) mais de
 * `FOLGA_RELOGIO_MS` à frente é recusado. O registro do histórico também tem teto (um colega não enche o
 * armazenamento de todos nem empurra os registros de verdade para fora dos 300): `quando` de 2000-01-01 até o
 * mesmo teto do carimbo, `antes`/`depois` até `LIMITES.registroValor`, `por`/`nome`/`campo` até `LIMITES.rotulo`;
 * em todo tipo, `alteradoPor` e `dispositivo` até `LIMITES.rotulo`, e a `ordem` até `LIMITES.ordem`.
 */
export function entidadeValida(x: unknown, tipo: keyof Entidades, agora?: number): boolean {
  if (!objeto(x)) return false;
  const o = x;
  const teto = agora === undefined ? Number.POSITIVE_INFINITY : agora + FOLGA_RELOGIO_MS;
  const carimbo = (n: unknown): boolean => finito(n) && n <= teto;
  if (!idValido(o.id) || !carimbo(o.atualizadoEm) || !rotuloValido(o.dispositivo)) return false;
  if (!opcional(o.removidoEm, carimbo) || !opcional(o.alteradoPor, rotuloValido)) return false;
  switch (tipo) {
    case "p":
      return (
        nomeValido(o.nome) &&
        etiquetasValidas(o.etiquetas) &&
        ordemValida(o.ordem) &&
        finito(o.criadoEm) &&
        opcional(o.arquivadoEm, finito) &&
        vinculoValido(o.processo) &&
        origemValida(o.origem)
      );
    case "f":
      return idValido(o.projeto) && nomeValido(o.nome) && ordemValida(o.ordem);
    case "e":
      return (
        idValido(o.projeto) &&
        opcional(o.fase, idValido) &&
        ordemValida(o.ordem) &&
        nomeValido(o.nome) &&
        datasValidas(o.inicio, o.fim, false) &&
        typeof o.marco === "boolean" &&
        listaDe(o.dependeDe, LIMITES.etapasPorProjeto, idValido) &&
        responsavelValido(o.responsavel) &&
        MEDIDAS.has(o.medida) &&
        progressoValido(o.progresso) &&
        listaDe(o.checklist, LIMITES.checklistItens, itemValido) &&
        vinculoValido(o.processo) &&
        documentoValido(o.documento) &&
        etiquetasValidas(o.etiquetas) &&
        opcional(o.observacoes, textoAte(LIMITES.observacoes)) &&
        opcional(o.concluidaEm, dataNaFaixa) &&
        baseValida(o.base) &&
        finito(o.criadoEm) &&
        origemValida(o.origem)
      );
    case "h":
      return (
        idValido(o.alvo) &&
        idValido(o.projeto) &&
        carimbo(o.quando) &&
        (o.quando as number) >= QUANDO_MINIMO &&
        rotuloValido(o.por) &&
        opcional(o.nome, rotuloValido) &&
        rotuloValido(o.campo) &&
        opcional(o.antes, valorDoRegistro) &&
        opcional(o.depois, valorDoRegistro)
      );
    case "m":
      return (
        nomeValido(o.nome) &&
        opcional(o.descricao, textoAte(LIMITES.observacoes)) &&
        finito(o.criadoEm) &&
        problemasDaEstruturaDoModelo(o.fases, o.etapas).length === 0
      );
  }
}

/** O limite de projetos ativos num escopo, com o que fazer. */
export function mensagemDoLimite(vis: Escopo["vis"]): string {
  return `Limite de ${LIMITES.projetosAtivos} projetos ativos em “${rotuloDaVis(vis)}”. Arquive ou exclua algum.`;
}

/** Junta o índice dos escopos da unidade (o painel e a caixa mostram os dois). */
export async function indiceDosEscopos(repos: readonly RepositorioProjetos[]): Promise<Map<string, VinculoProcesso[]>> {
  const dados = await Promise.all(repos.map(async (r) => ({ vis: r.escopo.vis, ...(await r.dados()) })));
  return indiceDeProcessos(dados);
}

/**
 * "Quem vê" mudou: leva projeto, fases, etapas e registros para o outro escopo
 * (mesmos ids, carimbo novo, para vencer na mesclagem) e deixa lápide no de
 * origem. Registra a mudança de visibilidade no histórico do destino. O destino
 * recebe tudo numa gravação só (`importar` com a anotação); a origem, noutra
 * (`lapidarMovidos`), e só depois de confirmar a cópia viva no destino: mesmo escopo,
 * item inválido ou cópia que não ficou viva recusam sem lapidar nada. As cópias levam
 * carimbo acima de qualquer lápide que o destino já tenha desses ids (relógio adiantado
 * de outro computador), para vencerem na mesclagem.
 */
export async function moverEntreEscopos(origem: RepositorioProjetos, destino: RepositorioProjetos, id: string): Promise<Projeto> {
  const p = await origem.obterProjeto(id);
  if (!p) throw new ErroValidacao(["O projeto não existe mais."]);
  if (p.arquivadoEm === undefined) {
    const ativos = (await destino.dados()).projetos.filter((x) => x.arquivadoEm === undefined);
    if (ativos.length >= LIMITES.projetosAtivos) throw new ErroValidacao([mensagemDoLimite(destino.escopo.vis)]);
  }
  const d = await origem.dados();
  const fases = d.fases.filter((f) => f.projeto === id);
  const etapas = d.etapas.filter((e) => e.projeto === id);
  const registros = await origem.historico(id);
  if (baseDoEscopo(origem.escopo) === baseDoEscopo(destino.escopo)) throw new ErroValidacao(["O projeto já está nesse escopo."]);
  const ids = new Set([id, ...fases.map((f) => f.id), ...etapas.map((e) => e.id), ...registros.map((r) => r.id)]);
  const noDestino = await destino.entidades();
  let maisNovo = 0;
  for (const x of [...noDestino.p, ...noDestino.f, ...noDestino.e, ...noDestino.h])
    if (ids.has(x.id)) maisNovo = Math.max(maisNovo, x.atualizadoEm, x.removidoEm ?? 0);
  const c0 = destino.carimboAtual();
  const cDestino = { ...c0, agora: Math.max(c0.agora, maisNovo + 1) };
  const recarimbar = <T extends Entidade>(x: T): T => editar(x, {} as Partial<Omit<T, "id" | "atualizadoEm" | "dispositivo">>, cDestino);
  const copias = { p: [recarimbar(p)], f: fases.map(recarimbar), e: etapas.map(recarimbar), h: registros.map(recarimbar) };
  const invalidas =
    !entidadeValida(copias.p[0], "p") ||
    copias.f.some((x) => !entidadeValida(x, "f")) ||
    copias.e.some((x) => !entidadeValida(x, "e")) ||
    copias.h.some((x) => !entidadeValida(x, "h"));
  if (invalidas) throw new ErroValidacao(["O projeto tem itens inválidos e não foi movido."]);
  const r = await destino.importar(copias, {
    registros: [
      {
        alvo: p.id,
        projeto: p.id,
        campo: "visibilidade",
        antes: rotuloDaVis(origem.escopo.vis),
        depois: rotuloDaVis(destino.escopo.vis),
      },
    ],
    carimbo: cDestino,
  });
  // Registro antigo além dos 300 do destino é excedente (a poda o tiraria de qualquer jeito); o resto tem de estar vivo lá.
  const conferido = await destino.dados();
  const vivosNoDestino = new Set([...conferido.projetos, ...conferido.fases, ...conferido.etapas].map((x) => x.id));
  if (r.ignorados > r.excedentes || [p, ...fases, ...etapas].some((x) => !vivosNoDestino.has(x.id)))
    throw new ErroValidacao(["Não foi possível confirmar a cópia no destino; o projeto continua na origem."]);
  await origem.lapidarMovidos({ p, f: fases, e: etapas, h: registros }, origem.carimboAtual());
  return (await destino.obterProjeto(id)) as Projeto;
}
