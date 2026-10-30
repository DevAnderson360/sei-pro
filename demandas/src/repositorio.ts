/**
 * Repositório local de UM escopo (spec 4.1): `chrome.storage.local`, uma chave por entidade (`Colecao`). Toda
 * gravação carimba (`Carimbo`) e deixa o registro do histórico no mesmo `area.gravar` (atômico). A mesclagem é por
 * entidade, vence o carimbo mais recente (`@comum/sincronia/entidade`); remover é lápide.
 *
 * As três tabelas do Texto Padrão (`d`, `a`, `h`) são projeções: `d` = não arquivadas, `a` = arquivadas
 * (decididas por `arquivadoEm`), `h` = histórico. Não há "mover" entre `d` e `a`: arquivar muda o carimbo e a
 * projeção muda sozinha, e a cópia velha de um colega perde na mescla.
 */

import type { Area } from "@comum/armazenamento/area";
import { Colecao, obterPorPrefixo } from "@comum/armazenamento/colecao";
import { novoId } from "@comum/id";
import { indiceEntre, indiceValido } from "@comum/ordem/indice";
import { purgarLapides, vence } from "@comum/sincronia/entidade";
import { prefixoMemoriaSigilo } from "@projetos/modelo/constantes";
import { conhecidosDe, entradasParaGravar, lerMemoria, type NumerosSigilosos, type OrigemSigilo } from "@projetos/modelo/memoriaSigilo";
import { documentoSemNumero, nenhumNumero, type SigilosConhecidos, vinculoSemNumero } from "@projetos/modelo/sigilo";
import { chaveProtocolo, RE_PROTOCOLO } from "@projetos/modelo/vinculos";
import { diasDeLapide, FOLGA_RELOGIO_MS, LIMITES, QUANDO_MINIMO } from "./modelo/constantes";
import { baseDoEscopo, chaveMeta, prefixoDe } from "./modelo/escopo";
import { arquivar, type RegistroNovo, type Resultado } from "./modelo/operacoes";
import type {
  Carimbo,
  DataISO,
  Demanda,
  Entidades,
  EnvelopeDemandas,
  Escopo,
  EtapaRef,
  ItemChecklist,
  Prioridade,
  Registro,
  Responsavel,
  Tabela,
  Vinculo,
} from "./modelo/tipos";
import {
  checklistLimpo,
  conferirDemanda,
  dataValida,
  ErroValidacao,
  etiquetasLimpas,
  idValido,
  problemasDaDemanda,
  textoAte,
} from "./modelo/validacao";

export interface DadosNovaDemanda {
  titulo: string;
  descricao?: string;
  responsavel?: Responsavel;
  /** Padrão: o prazo não pode ficar antes; sem este, a data de hoje do carimbo. */
  distribuidaEm?: DataISO;
  prazo: DataISO;
  prioridade?: Prioridade;
  etiquetas?: string[];
  processos?: Vinculo[];
  checklist?: ItemChecklist[];
  tempoEstimadoMin?: number;
  etapa?: EtapaRef;
}

/** Só campo opcional aceita `undefined` (apaga). O prazo muda por `prorrogar` (exige motivo), nunca por aqui. */
export interface MudancasDemanda {
  titulo?: string;
  prioridade?: Prioridade;
  etiquetas?: string[];
  processos?: Vinculo[];
  checklist?: ItemChecklist[];
  distribuidaEm?: DataISO;
  descricao?: string | undefined;
  responsavel?: Responsavel | undefined;
  tempoEstimadoMin?: number | undefined;
  tempoGastoMin?: number | undefined;
  etapa?: EtapaRef | undefined;
}

export interface ResultadoImportacao {
  novos: number;
  atualizados: number;
  /** Tudo o que não entrou (malformado, carimbo do futuro, além do teto de ativas). */
  ignorados: number;
  /** A parte dos ignorados que só passou do teto de ativas. */
  excedentes: number;
}

const OBRIGATORIOS = ["titulo", "prioridade", "etiquetas", "processos", "checklist", "distribuidaEm"] as const;
const vivo = <T extends { removidoEm?: number }>(x: T | undefined): x is T => !!x && x.removidoEm === undefined;
const maiorOrdem = (itens: ReadonlyArray<{ ordem: string }>): string | null =>
  itens.reduce<string | null>((m, i) => (indiceValido(i.ordem) && (m === null || i.ordem > m) ? i.ordem : m), null);
const porOrdem = (a: { ordem: string; id: string }, b: { ordem: string; id: string }) =>
  a.ordem < b.ordem ? -1 : a.ordem > b.ordem ? 1 : a.id < b.id ? -1 : 1;
const nomeDe = (r?: Responsavel) => r?.nome ?? "";

export class RepositorioDemandas {
  readonly demandas: Colecao<Demanda>;
  readonly registros: Colecao<Registro>;
  private readonly base: string;

  constructor(
    private readonly area: Area,
    readonly escopo: Escopo,
    private readonly carimbo: () => Carimbo,
    private readonly gerarId: () => string = novoId,
  ) {
    this.base = baseDoEscopo(escopo);
    this.demandas = new Colecao<Demanda>(area, prefixoDe(escopo, "d"));
    this.registros = new Colecao<Registro>(area, prefixoDe(escopo, "h"));
  }

  carimboAtual(): Carimbo {
    return this.carimbo();
  }

  /** Guarda o escopo por extenso (o arquivo e a exportação usam). */
  async registrar(): Promise<void> {
    await this.area.gravar({ [chaveMeta(this.escopo)]: { escopo: this.escopo } });
  }

  aoMudar(cb: () => void): () => void {
    return this.area.aoMudar((m) => {
      if (Object.keys(m).some((k) => k.startsWith(this.base))) cb();
    });
  }

  private entidadesDe(tudo: Record<string, unknown>): Entidades {
    const pd = `${this.base}d/`;
    const ph = `${this.base}h/`;
    const d: Demanda[] = [];
    const h: Registro[] = [];
    for (const [k, v] of Object.entries(tudo)) {
      if (k.startsWith(pd) && entidadeValida(v, "d")) d.push(v as Demanda);
      else if (k.startsWith(ph) && entidadeValida(v, "h")) h.push(v as Registro);
    }
    return { d, h };
  }

  /** Tudo do escopo, com lápides, numa leitura só. */
  async entidades(): Promise<Entidades> {
    return this.entidadesDe(await obterPorPrefixo(this.area, this.base));
  }

  /** As vivas, na ordem manual. */
  async dados(): Promise<Demanda[]> {
    return (await this.entidades()).d.filter(vivo).sort(porOrdem);
  }

  async obter(id: string): Promise<Demanda | undefined> {
    const d = await this.demandas.obter(id);
    return vivo(d) ? d : undefined;
  }

  /** Registros vivos, do mais recente ao mais antigo (de uma demanda, se informada). */
  async historico(demanda?: string): Promise<Registro[]> {
    return (await this.registros.listar())
      .filter((r) => vivo(r) && (!demanda || r.demanda === demanda))
      .sort((a, b) => b.quando - a.quando || (a.id < b.id ? 1 : -1));
  }

  private carimbarRegistro(r: RegistroNovo, c: Carimbo): Registro {
    const cortar = (s: string) => s.slice(0, LIMITES.registroValor);
    return {
      id: this.gerarId(),
      demanda: r.demanda,
      campo: r.campo,
      quando: c.agora,
      por: (c.por ?? "").slice(0, LIMITES.rotulo),
      ...(c.nome ? { nome: c.nome.slice(0, LIMITES.rotulo) } : {}),
      ...(r.antes !== undefined ? { antes: cortar(r.antes) } : {}),
      ...(r.depois !== undefined ? { depois: cortar(r.depois) } : {}),
      ...(r.motivo !== undefined ? { motivo: r.motivo.slice(0, LIMITES.motivo) } : {}),
      atualizadoEm: c.agora,
      dispositivo: c.dispositivo,
    };
  }

  /** Demandas e registros num `area.gravar` só (atômico: ninguém vê meio estado). */
  private async salvar(demandas: readonly Demanda[], novos: readonly RegistroNovo[], c: Carimbo): Promise<void> {
    const regs = novos.map((r) => this.carimbarRegistro(r, c));
    await this.area.gravar({
      ...Object.fromEntries(demandas.map((d) => [this.demandas.chave(d.id), d])),
      ...Object.fromEntries(regs.map((r) => [this.registros.chave(r.id), r])),
    });
    if (regs.length) await this.podarHistorico();
  }

  /** O histórico local não passa de `LIMITES.historicoLocal`: sai o mais antigo (o arquivo JSON leva o que existe). */
  private async podarHistorico(): Promise<void> {
    const todos = await this.registros.listar();
    const sobra = todos.length - LIMITES.historicoLocal;
    if (sobra <= 0) return;
    const antigos = [...todos].sort((a, b) => a.quando - b.quando || (a.id < b.id ? -1 : 1)).slice(0, sobra);
    await this.area.remover(antigos.map((x) => this.registros.chave(x.id)));
  }

  private async ativas(): Promise<Demanda[]> {
    return (await this.dados()).filter((d) => d.arquivadoEm === undefined);
  }

  private async exigirVaga(): Promise<void> {
    if ((await this.ativas()).length >= LIMITES.ativas)
      throw new ErroValidacao("limite", `A unidade chegou a ${LIMITES.ativas} demandas ativas. Arquive as concluídas para criar novas.`);
  }

  async criar(x: DadosNovaDemanda): Promise<Demanda> {
    await this.exigirVaga();
    const c = this.carimbo();
    const todas = (await this.entidades()).d;
    const hoje = new Date(c.agora);
    const dois = (n: number) => String(n).padStart(2, "0");
    const d: Demanda = {
      id: this.gerarId(),
      titulo: x.titulo.trim(),
      ...(x.descricao?.trim() ? { descricao: x.descricao.trim() } : {}),
      ...(x.responsavel ? { responsavel: x.responsavel } : {}),
      distribuidaEm: x.distribuidaEm ?? `${hoje.getFullYear()}-${dois(hoje.getMonth() + 1)}-${dois(hoje.getDate())}`,
      prazo: x.prazo,
      prioridade: x.prioridade ?? "normal",
      etiquetas: etiquetasLimpas(x.etiquetas ?? []),
      processos: x.processos ?? [],
      checklist: checklistLimpo(x.checklist ?? []),
      ...(x.tempoEstimadoMin !== undefined ? { tempoEstimadoMin: x.tempoEstimadoMin } : {}),
      ...(x.etapa ? { etapa: x.etapa } : {}),
      pausas: [],
      ordem: indiceEntre(maiorOrdem(todas), null),
      criadoEm: c.agora,
      atualizadoEm: c.agora,
      dispositivo: c.dispositivo,
      ...(c.por ? { alteradoPor: c.por } : {}),
    };
    conferirDemanda(d);
    await this.salvar([d], [{ demanda: d.id, campo: "criacao", depois: d.titulo }], c);
    return d;
  }

  private async viva(id: string): Promise<Demanda> {
    const d = await this.obter(id);
    if (!d) throw new ErroValidacao("id", "Demanda não encontrada.");
    return d;
  }

  async editar(id: string, m: MudancasDemanda): Promise<Demanda> {
    const antes = await this.viva(id);
    const c = this.carimbo();
    const limpo = { ...m } as Record<string, unknown>;
    for (const k of OBRIGATORIOS) if (limpo[k] === undefined) delete limpo[k];
    if (m.etiquetas) limpo.etiquetas = etiquetasLimpas(m.etiquetas);
    if (m.checklist) limpo.checklist = checklistLimpo(m.checklist);
    if (typeof m.titulo === "string") limpo.titulo = m.titulo.trim();
    const novo = {
      ...antes,
      ...limpo,
      atualizadoEm: c.agora,
      dispositivo: c.dispositivo,
      ...(c.por ? { alteradoPor: c.por } : {}),
    } as Record<string, unknown>;
    // Opcional com `undefined` explícito apaga a chave.
    for (const k of Object.keys(m))
      if ((m as Record<string, unknown>)[k] === undefined && !OBRIGATORIOS.includes(k as never)) delete novo[k];
    const d = novo as unknown as Demanda;
    conferirDemanda(d);
    const regs: RegistroNovo[] = [];
    if (d.titulo !== antes.titulo) regs.push({ demanda: id, campo: "titulo", antes: antes.titulo, depois: d.titulo });
    if (nomeDe(d.responsavel) !== nomeDe(antes.responsavel))
      regs.push({ demanda: id, campo: "responsavel", antes: nomeDe(antes.responsavel), depois: nomeDe(d.responsavel) });
    if (d.prioridade !== antes.prioridade) regs.push({ demanda: id, campo: "prioridade", antes: antes.prioridade, depois: d.prioridade });
    if ((d.etapa?.rotulo ?? "") !== (antes.etapa?.rotulo ?? ""))
      regs.push({ demanda: id, campo: "etapa", antes: antes.etapa?.rotulo ?? "", depois: d.etapa?.rotulo ?? "" });
    await this.salvar([d], regs, c);
    return d;
  }

  /** Aplica uma operação pura da D2 e grava a demanda e os registros dela. */
  async aplicar(id: string, op: (d: Demanda, c: Carimbo) => Resultado): Promise<Demanda> {
    const antes = await this.viva(id);
    const c = this.carimbo();
    const r = op(antes, c);
    conferirDemanda(r.demanda);
    await this.salvar([r.demanda], r.registros, c);
    return r.demanda;
  }

  /** Arquiva em lote (um gravar só). O que não pode ser arquivado (não concluída, não existe) é só contado. */
  async arquivarVarias(ids: readonly string[]): Promise<{ arquivadas: number; ignoradas: number }> {
    const c = this.carimbo();
    const feitas: Demanda[] = [];
    const regs: RegistroNovo[] = [];
    let ignoradas = 0;
    for (const id of ids) {
      const d = await this.obter(id);
      if (!d) {
        ignoradas += 1;
        continue;
      }
      try {
        const r = arquivar(d, c);
        feitas.push(r.demanda);
        regs.push(...r.registros);
      } catch {
        ignoradas += 1;
      }
    }
    if (feitas.length) await this.salvar(feitas, regs, c);
    return { arquivadas: feitas.length, ignoradas };
  }

  /** Vira lápide, em lote (um gravar só): o descarte do arquivo morto, depois de o usuário guardar o arquivo. */
  async descartar(ids: readonly string[]): Promise<number> {
    const c = this.carimbo();
    const feitas: Demanda[] = [];
    const regs: RegistroNovo[] = [];
    for (const id of ids) {
      const d = await this.obter(id);
      if (!d) continue;
      feitas.push({
        ...d,
        removidoEm: c.agora,
        atualizadoEm: c.agora,
        dispositivo: c.dispositivo,
        ...(c.por ? { alteradoPor: c.por } : {}),
      });
      regs.push({ demanda: id, campo: "exclusao", antes: d.titulo });
    }
    if (feitas.length) await this.salvar(feitas, regs, c);
    return feitas.length;
  }

  async remover(id: string): Promise<void> {
    const d = await this.viva(id);
    const c = this.carimbo();
    await this.salvar(
      [{ ...d, removidoEm: c.agora, atualizadoEm: c.agora, dispositivo: c.dispositivo, ...(c.por ? { alteradoPor: c.por } : {}) }],
      [{ demanda: id, campo: "exclusao", antes: d.titulo }],
      c,
    );
  }

  async restaurar(id: string): Promise<Demanda | undefined> {
    const d = await this.demandas.obter(id);
    if (!d || d.removidoEm === undefined) return d;
    await this.exigirVaga();
    const c = this.carimbo();
    const { removidoEm: _, ...resto } = d;
    const nova: Demanda = { ...resto, atualizadoEm: c.agora, dispositivo: c.dispositivo, ...(c.por ? { alteradoPor: c.por } : {}) };
    await this.salvar([nova], [{ demanda: id, campo: "restauracao", depois: d.titulo }], c);
    return nova;
  }

  async duplicar(id: string): Promise<Demanda> {
    const base = await this.viva(id);
    const titulo = `Cópia de ${base.titulo}`.slice(0, LIMITES.titulo);
    return this.criar({
      titulo,
      ...(base.descricao ? { descricao: base.descricao } : {}),
      ...(base.responsavel ? { responsavel: base.responsavel } : {}),
      distribuidaEm: base.distribuidaEm,
      prazo: base.prazo,
      prioridade: base.prioridade,
      etiquetas: base.etiquetas,
      processos: base.processos,
      checklist: base.checklist.map((i) => ({ ...i, feito: false })),
      ...(base.tempoEstimadoMin !== undefined ? { tempoEstimadoMin: base.tempoEstimadoMin } : {}),
      ...(base.etapa ? { etapa: base.etapa } : {}),
    });
  }

  /** Põe a demanda entre os vizinhos (ids; null = ponta). Grava só ela. */
  async reordenar(id: string, antesId: string | null, depoisId: string | null): Promise<Demanda> {
    const d = await this.viva(id);
    const ordem = indiceEntre(
      (antesId && (await this.obter(antesId))?.ordem) || null,
      (depoisId && (await this.obter(depoisId))?.ordem) || null,
    );
    const c = this.carimbo();
    const novo: Demanda = { ...d, ordem, atualizadoEm: c.agora, dispositivo: c.dispositivo, ...(c.por ? { alteradoPor: c.por } : {}) };
    await this.salvar([novo], [], c);
    return novo;
  }

  // ---------- sincronia ----------

  async importar(ent: Partial<Entidades>, agora: number = Date.now()): Promise<ResultadoImportacao> {
    const r: ResultadoImportacao = { novos: 0, atualizados: 0, ignorados: 0, excedentes: 0 };
    const local = await this.entidades();
    const porId = new Map(local.d.map((x) => [x.id, x]));
    let ativas = local.d.filter((x) => vivo(x) && x.arquivadoEm === undefined).length;
    const gravar: Demanda[] = [];
    for (const bruta of ent.d ?? []) {
      if (!entidadeValida(bruta, "d", agora)) {
        r.ignorados += 1;
        continue;
      }
      const x = limparEntidade(bruta, "d");
      const atual = porId.get(x.id);
      if (atual && !vence(x, atual)) continue;
      const ehAtiva = vivo(x) && x.arquivadoEm === undefined;
      const eraAtiva = !!atual && vivo(atual) && atual.arquivadoEm === undefined;
      if (ehAtiva && !eraAtiva && ativas >= LIMITES.ativas) {
        r.ignorados += 1;
        r.excedentes += 1;
        continue;
      }
      if (ehAtiva && !eraAtiva) ativas += 1;
      gravar.push(manterNumerosSigilosos(x, atual));
      if (atual) r.atualizados += 1;
      else r.novos += 1;
    }
    const locaisH = new Map(local.h.map((x) => [x.id, x]));
    const gravarH: Registro[] = [];
    for (const bruto of ent.h ?? []) {
      if (!entidadeValida(bruto, "h", agora)) {
        r.ignorados += 1;
        continue;
      }
      const x = limparEntidade(bruto, "h");
      const atual = locaisH.get(x.id);
      if (!atual || vence(x, atual)) {
        gravarH.push(x);
        if (atual) r.atualizados += 1;
        else {
          r.novos += 1;
          locaisH.set(x.id, x);
        }
      }
    }
    if (gravar.length || gravarH.length)
      await this.area.gravar({
        ...Object.fromEntries(gravar.map((d) => [this.demandas.chave(d.id), d])),
        ...Object.fromEntries(gravarH.map((h) => [this.registros.chave(h.id), h])),
      });
    // O teto vale depois de aceitar: ficam os mais recentes (o que o colega acabou de fazer vence o antigo daqui).
    if (gravarH.length) await this.podarHistorico();
    return r;
  }

  /** O envelope de uma tabela, podado (lápides vencidas; histórico nos mais recentes). Sem o corte do sigilo (adaptador). */
  private envelopeDe(ent: Entidades, tabela: Tabela, agora: number): EnvelopeDemandas {
    const dias = diasDeLapide(this.escopo.vis);
    const entidades: Entidades =
      tabela === "h"
        ? {
            d: [],
            h: purgarLapides(ent.h, agora, dias)
              .sort((a, b) => b.quando - a.quando || (a.id < b.id ? 1 : -1))
              .slice(0, LIMITES.historicoNoTexto),
          }
        : { d: purgarLapides(ent.d, agora, dias).filter((x) => (x.arquivadoEm !== undefined) === (tabela === "a")), h: [] };
    return {
      formato: "seipro-demandas",
      versao: 1,
      tabela,
      host: this.escopo.host,
      unidade: this.escopo.unidade,
      vis: this.escopo.vis,
      ...(this.escopo.vis === "eu" ? { login: this.escopo.login.trim().toLowerCase() } : {}),
      gerado: agora,
      entidades,
    };
  }

  async exportarTabela(tabela: Tabela, agora: number = Date.now()): Promise<EnvelopeDemandas> {
    return this.envelopeDe(await this.entidades(), tabela, agora);
  }

  /** Apaga as lápides vencidas (devolve quantas). */
  async limpar(agora: number = Date.now()): Promise<number> {
    const ent = await this.entidades();
    const dias = diasDeLapide(this.escopo.vis);
    const vencida = (x: { removidoEm?: number }) => x.removidoEm !== undefined && x.removidoEm < agora - dias * 86_400_000;
    const ds = ent.d.filter(vencida).map((x) => this.demandas.chave(x.id));
    const hs = ent.h.filter(vencida).map((x) => this.registros.chave(x.id));
    if (ds.length + hs.length) await this.area.remover([...ds, ...hs]);
    return ds.length + hs.length;
  }

  // ---------- sigilo (a memória é a do Projetos: o que um aprendeu vale para o outro) ----------

  private get prefixoMemoria(): string {
    return prefixoMemoriaSigilo(this.escopo.host, this.escopo.login);
  }

  /** As chaves do escopo (se pedido) e as da memória do sigilo, numa chamada só; lança se o storage falha (falha fechada). */
  private async lerChaves(doEscopo: boolean): Promise<Record<string, unknown>> {
    const quer = (k: string) => (doEscopo && k.startsWith(this.base)) || k.startsWith(this.prefixoMemoria);
    if (this.area.chaves) {
      const ks = (await this.area.chaves()).filter(quer);
      return ks.length ? await this.area.obter(ks) : {};
    }
    return Object.fromEntries(Object.entries(await this.area.obter(null)).filter(([k]) => quer(k)));
  }

  async sigilosConhecidos(): Promise<SigilosConhecidos> {
    return conhecidosDe(lerMemoria(await this.lerChaves(false), this.prefixoMemoria));
  }

  async lembrarSigilo(novos: NumerosSigilosos, origem: OrigemSigilo, o: { promover?: boolean } = {}): Promise<void> {
    const memoria = lerMemoria(await this.lerChaves(false), this.prefixoMemoria);
    const e = entradasParaGravar(memoria, novos, origem, this.prefixoMemoria, o);
    if (Object.keys(e).length) await this.area.gravar(e);
  }

  /**
   * O envelope da tabela e o que a memória do sigilo sabe, numa leitura só: o que raspa é o estado que vai.
   * Lança se a memória não puder ser lida.
   */
  async exportarComConhecidos(
    tabela: Tabela,
    agora: number = Date.now(),
  ): Promise<{ envelope: EnvelopeDemandas; conhecidos: SigilosConhecidos }> {
    const tudo = await this.lerChaves(true);
    return {
      envelope: this.envelopeDe(this.entidadesDe(tudo), tabela, agora),
      conhecidos: conhecidosDe(lerMemoria(tudo, this.prefixoMemoria)),
    };
  }

  /**
   * O processo é sigiloso (a árvore ou a caixa o mostram assim): marca os vínculos locais que o têm (SEM mudar o
   * carimbo: todo computador que conhece o número chega à mesma marca) e o lembra como local. Devolve quantas
   * demandas foram marcadas.
   */
  async marcarSigilosos(protocolos: readonly string[]): Promise<number> {
    const chaves = new Set(protocolos.map(chaveProtocolo).filter(Boolean));
    if (!chaves.size) return 0;
    const marcadas: Demanda[] = [];
    for (const d of (await this.entidades()).d) {
      if (d.processos.some((p) => p.protocolo && chaves.has(chaveProtocolo(p.protocolo)) && !p.sigiloso))
        marcadas.push({
          ...d,
          processos: d.processos.map((p) => (p.protocolo && chaves.has(chaveProtocolo(p.protocolo)) ? { ...p, sigiloso: true } : p)),
        });
    }
    await this.lembrarSigilo({ ...nenhumNumero(), processos: [...chaves] }, "local", { promover: true });
    if (marcadas.length) await this.area.gravar(Object.fromEntries(marcadas.map((d) => [this.demandas.chave(d.id), d])));
    return marcadas.length;
  }
}

/** A edição de um colega chega com o vínculo vazio (sigiloso); quem tem o número o mantém. */
export function manterNumerosSigilosos(vencedor: Demanda, local?: Demanda): Demanda {
  if (!local) return vencedor;
  let mudou = false;
  // Os vinculos em branco do vencedor recebem, EM ORDEM, os sigilosos com numero do local que o vencedor ainda nao
  // traz; so se esses acabam, entram os do local ainda sem marca (o numero que o colega acabou de marcar sigiloso).
  const presentes = new Set(vencedor.processos.map((p) => chaveProtocolo(p.protocolo)).filter(Boolean));
  const livres = local.processos.filter((l) => chaveProtocolo(l.protocolo) && !presentes.has(chaveProtocolo(l.protocolo)));
  const fila = [...livres.filter((l) => l.sigiloso === true), ...livres.filter((l) => l.sigiloso !== true)];
  const processos = vencedor.processos.map((p) => {
    const l = vinculoSemNumero(p) ? fila.shift() : undefined;
    if (l) {
      mudou = true;
      return { ...l, sigiloso: true as const };
    }
    return p;
  });
  let documento = vencedor.documentoEntregue;
  if (documentoSemNumero(documento) && local.documentoEntregue?.numero) {
    documento = { ...local.documentoEntregue, sigiloso: true };
    mudou = true;
  }
  return mudou ? { ...vencedor, processos, ...(documento ? { documentoEntregue: documento } : {}) } : vencedor;
}

const CAMPOS = new Set([
  "criacao",
  "exclusao",
  "restauracao",
  "titulo",
  "responsavel",
  "prazo",
  "prioridade",
  "inicio",
  "pausa",
  "retomada",
  "conclusao",
  "reabertura",
  "avaliacao",
  "arquivamento",
  "desarquivamento",
  "etapa",
  "visibilidade",
]);
const objeto = (x: unknown): x is Record<string, unknown> => typeof x === "object" && x !== null && !Array.isArray(x);

function carimboValido(x: Record<string, unknown>, agora?: number): boolean {
  if (!idValido(x.id)) return false;
  if (typeof x.atualizadoEm !== "number" || !Number.isFinite(x.atualizadoEm) || x.atualizadoEm < 0) return false;
  if (typeof x.dispositivo !== "string" || !x.dispositivo || x.dispositivo.length > LIMITES.rotulo) return false;
  if (x.removidoEm !== undefined && (typeof x.removidoEm !== "number" || !Number.isFinite(x.removidoEm) || x.removidoEm < 0)) return false;
  if (agora !== undefined) {
    const teto = agora + FOLGA_RELOGIO_MS;
    if (x.atualizadoEm > teto || (typeof x.removidoEm === "number" && x.removidoEm > teto)) return false;
  }
  return true;
}

const vinculoOk = (v: unknown): boolean =>
  objeto(v) &&
  typeof v.protocolo === "string" &&
  RE_PROTOCOLO.test(v.protocolo) &&
  (v.idProcedimento === undefined || textoAte(LIMITES.rotulo)(v.idProcedimento)) &&
  (v.sigiloso === undefined || typeof v.sigiloso === "boolean");
const itemOk = (i: unknown): boolean =>
  objeto(i) && idValido(i.id) && textoAte(LIMITES.checklistTexto)(i.texto) && typeof i.feito === "boolean";
const instante = (x: unknown): boolean => typeof x === "number" && Number.isFinite(x) && x >= 0;
const pausaOk = (p: unknown): boolean => objeto(p) && instante(p.inicio) && (p.fim === undefined || instante(p.fim));
const curto = textoAte(LIMITES.rotulo);
const responsavelOk = (r: unknown): boolean => objeto(r) && curto(r.nome) && (r.login === undefined || curto(r.login));
const etapaOk = (e: unknown): boolean => objeto(e) && curto(e.projeto) && curto(e.etapa) && curto(e.rotulo);
const avaliacaoOk = (a: unknown): boolean =>
  objeto(a) &&
  typeof a.nota === "number" &&
  Number.isInteger(a.nota) &&
  a.nota >= 1 &&
  a.nota <= 5 &&
  (a.comentario === undefined || textoAte(LIMITES.comentario)(a.comentario)) &&
  curto(a.por) &&
  instante(a.em);
const documentoOk = (d: unknown): boolean =>
  objeto(d) &&
  textoAte(40)(d.numero) &&
  (d.titulo === undefined || textoAte(LIMITES.titulo)(d.titulo)) &&
  (d.sigiloso === undefined || typeof d.sigiloso === "boolean");
const opcional = (x: unknown, ok: (v: unknown) => boolean): boolean => x === undefined || ok(x);

const CAMPOS_ENTIDADE = ["id", "atualizadoEm", "dispositivo", "removidoEm", "alteradoPor"];
const CAMPOS_DEMANDA = [
  ...CAMPOS_ENTIDADE,
  "titulo",
  "descricao",
  "responsavel",
  "distribuidaEm",
  "prazo",
  "prazoOriginal",
  "prioridade",
  "etiquetas",
  "processos",
  "checklist",
  "tempoEstimadoMin",
  "tempoGastoMin",
  "etapa",
  "iniciadaEm",
  "pausas",
  "concluidaEm",
  "observacaoConclusao",
  "documentoEntregue",
  "avaliacao",
  "arquivadoEm",
  "ordem",
  "criadoEm",
];
const CAMPOS_REGISTRO = [...CAMPOS_ENTIDADE, "demanda", "quando", "por", "nome", "campo", "antes", "depois", "motivo"];

function so(x: unknown, campos: readonly string[]): unknown {
  if (!objeto(x)) return x;
  const y: Record<string, unknown> = {};
  for (const k of campos) if (x[k] !== undefined) y[k] = x[k];
  return y;
}

/**
 * A entidade que passou por `entidadeValida`, so com os campos conhecidos (lista branca, tambem nos objetos de dentro):
 * um campo oculto que chega de fora nao ocupa espaco do texto nem e regravado.
 */
export function limparEntidade<T extends Demanda | Registro>(x: T, tipo: "d" | "h"): T {
  if (tipo === "h") return so(x, CAMPOS_REGISTRO) as T;
  const d = so(x, CAMPOS_DEMANDA) as Record<string, unknown>;
  const lista = (v: unknown, campos: readonly string[]) => (Array.isArray(v) ? v.map((i) => so(i, campos)) : v);
  d.processos = lista(d.processos, ["protocolo", "idProcedimento", "sigiloso"]);
  d.checklist = lista(d.checklist, ["id", "texto", "feito"]);
  d.pausas = lista(d.pausas, ["inicio", "fim"]);
  if (d.responsavel !== undefined) d.responsavel = so(d.responsavel, ["login", "nome"]);
  if (d.etapa !== undefined) d.etapa = so(d.etapa, ["projeto", "etapa", "rotulo"]);
  if (d.avaliacao !== undefined) d.avaliacao = so(d.avaliacao, ["nota", "comentario", "por", "em"]);
  if (d.documentoEntregue !== undefined) d.documentoEntregue = so(d.documentoEntregue, ["numero", "titulo", "sigiloso"]);
  return d as unknown as T;
}

/** Dado de fora (outro computador, arquivo editado à mão): a forma e os tetos; `agora` liga o corte do carimbo no futuro. */
export function entidadeValida(x: unknown, tipo: "d" | "h", agora?: number): boolean {
  if (!objeto(x) || !carimboValido(x, agora)) return false;
  if (!opcional(x.alteradoPor, curto)) return false;
  if (tipo === "h")
    return (
      opcional(x.nome, curto) &&
      idValido(x.demanda) &&
      typeof x.quando === "number" &&
      x.quando >= QUANDO_MINIMO &&
      (agora === undefined || x.quando <= agora + FOLGA_RELOGIO_MS) &&
      textoAte(LIMITES.rotulo)(x.por) &&
      typeof x.campo === "string" &&
      CAMPOS.has(x.campo) &&
      [x.antes, x.depois].every((v) => v === undefined || textoAte(LIMITES.registroValor)(v)) &&
      (x.motivo === undefined || textoAte(LIMITES.motivo)(x.motivo))
    );
  return (
    typeof x.ordem === "string" &&
    x.ordem.length <= LIMITES.ordem &&
    indiceValido(x.ordem) &&
    Array.isArray(x.etiquetas) &&
    x.etiquetas.every(textoAte(LIMITES.etiquetaTexto)) &&
    Array.isArray(x.processos) &&
    x.processos.every(vinculoOk) &&
    Array.isArray(x.checklist) &&
    x.checklist.every(itemOk) &&
    Array.isArray(x.pausas) &&
    x.pausas.every(pausaOk) &&
    typeof x.criadoEm === "number" &&
    opcional(x.responsavel, responsavelOk) &&
    opcional(x.etapa, etapaOk) &&
    opcional(x.avaliacao, avaliacaoOk) &&
    opcional(x.documentoEntregue, documentoOk) &&
    opcional(x.concluidaEm, dataValida) &&
    opcional(x.prazoOriginal, dataValida) &&
    opcional(x.iniciadaEm, instante) &&
    opcional(x.arquivadoEm, instante) &&
    problemasDaDemanda(x as unknown as Demanda).length === 0
  );
}
