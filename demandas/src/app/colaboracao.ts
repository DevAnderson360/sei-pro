/**
 * Sincronização e colaboração no app: o que o `montarApp` recebe em `deps.colaboracao` (o estado dos três Textos Padrão
 * por escopo, as faixas de consentimento, os itens do menu de ajustes) e os diálogos de apoio (Sincronização, Arquivar
 * concluídas antigas, Arquivo morto, Cópias automáticas, Ajuda).
 *
 * Quem grava no SEI é a aba (content script): daqui saem só os pedidos `sincronizarAgora` e `apagarPessoal` pelo RPC. O
 * app lê o status do `storage.local` (`estadoDaSincronia`) e se atualiza por `area.aoMudar`. Erro do RPC vira aviso,
 * nunca exceção solta. O consentimento mora no `storage.sync`: o da unidade nasce do "Entendi" da faixa; o pessoal, do
 * convite. Antes do "Entendi" nada é pedido à aba.
 *
 * Ao abrir: as lápides velhas e o histórico além do corte saem deste navegador (`limpar`), a cópia do dia é feita e o
 * arquivo ligado sincroniza. Nada disso derruba o app.
 */

import type { Area } from "@comum/armazenamento/area";
import type { DataISO } from "@comum/datas/dias";
import type { Rpc } from "@comum/ponte/rpc";
import type { ControleArquivo } from "@comum/sincronia/arquivo";
import type { StatusSync } from "@comum/sincronia/motor";
import { versaoMaisNova } from "@comum/sincronia/textoPadraoCodec";
import type { AbrirModal } from "@comum/ui/dialogo";
import { h } from "@comum/ui/dom";
import type { EntradaMenu } from "@comum/ui/menu";
import { escoposDaUnidade } from "../modelo/escopo";
import type { Carimbo, Tabela, Vis } from "../modelo/tipos";
import { chaveDaAba } from "../ponte/tipos";
import type { RepositorioDemandas } from "../repositorio";
import {
  type ArmazemCopiasDemandas,
  type EnvelopeArquivo,
  exportarTudo,
  FORMATO_ARQUIVO,
  fazerCopiaDoDia,
  importarTudo,
  lerEnvelopeArquivo,
  restaurarCopia,
  tamanhoDoArquivoAlto,
  VERSAO_ARQUIVO,
} from "../sincronia/arquivo";
import { FORMATO_ARQUIVO_MORTO } from "../sincronia/arquivoMorto";
import { consentimentoDemandas } from "../sincronia/consentimento";
import { TABELAS } from "../sincronia/orquestrador";
import { abrirArquivarAntigas } from "./dialogos/arquivarAntigas";
import { abrirCopias } from "./dialogos/arquivo";
import { abrirArquivoMorto, MSG_NAO_E_DO_GESTOR } from "./dialogos/arquivoMorto";
import { faixaConsentimentoUnidade, faixaConvitePessoal, pedirConsentimentoPessoal } from "./dialogos/consentimento";
import { montarSincronizacao } from "./dialogos/sincronizacao";
import { mensagemDoErro } from "./erros";
import { EstadoDaSincronia, type Indicador, indicadorDe, type SituacaoSincronia } from "./estadoSincronia";
import { plural } from "./formato";
import type { ContextoDemandas } from "./tipos";

/** O resultado do `sincronizarAgora` da aba: o status de cada tabela por escopo (o pessoal desligado vem nulo). */
export type RespostaSincronizar = Record<Vis, Record<Tabela, StatusSync> | null>;

/** O arquivo ligado numa pasta da nuvem (o `ControleArquivo` do sei-comum), no que a colaboração usa. */
export type ArquivoLigado = Pick<
  ControleArquivo<EnvelopeArquivo>,
  "status" | "configurado" | "escolher" | "reconectar" | "sincronizar" | "esquecer" | "agendar" | "parar"
>;

export interface DepsColaboracao {
  /** Os repositórios dos dois escopos da unidade. */
  repos: Readonly<Record<Vis, RepositorioDemandas>>;
  /** chrome.storage.local (dados, status) e chrome.storage.sync (consentimentos). */
  area: Area;
  sync: Area;
  rpc: Pick<Rpc, "chamar">;
  contexto: ContextoDemandas;
  hoje(): DataISO;
  agora(): number;
  carimbo(): Carimbo;
  abrirModal: AbrirModal;
  confirmar(texto: string, rotuloOk?: string): Promise<boolean>;
  baixar(nome: string, conteudo: string, tipo: string): void;
  /** O texto do arquivo que o usuário escolheu, ou null se cancelou. */
  escolherArquivo(): Promise<string | null>;
  /** Cópias diárias (IndexedDB `seipro-demandas`); null sem banco. */
  copias: ArmazemCopiasDemandas | null;
  /** O arquivo ligado (File System Access); null onde o navegador não deixa (Firefox, iframe que recusa o seletor). */
  arquivo: ArquivoLigado | null;
  avisar(texto: string): void;
  /** Quanto os diálogos esperam a cópia do dia antes de abrir (padrão 2 s). */
  esperaCopia?: number;
}

/** A cópia de tudo (todas as unidades) pode crescer; acima disto não é uma cópia das demandas. */
const LIMITE_COPIA = 50 * 1024 * 1024;
const ESPERA_COPIA_MS = 2000;

export const MENSAGEM_COPIA_GRANDE = "O arquivo passa de 50 MB: não é uma cópia das demandas do SEI Pro.";
export const MENSAGEM_NAO_E_JSON = "O arquivo não é um JSON válido.";
export const MENSAGEM_COPIA_MAIS_NOVA =
  "Este arquivo foi gravado por uma versão mais nova do SEI Pro. Atualize a extensão neste computador e importe de novo.";
export const MENSAGEM_ARQUIVO_GRANDE = "O arquivo ficou grande; exporte um arquivo morto e remova as arquivadas antigas.";
export const MENSAGEM_SELETOR =
  "O navegador não deixa escolher um arquivo aqui dentro do painel. Use “Exportar arquivo (backup)” e “Importar arquivo…”.";
export const MENSAGEM_CONSENTIMENTO_NAO_GRAVOU = "Não foi possível guardar a sua confirmação. Tente de novo.";
export const AVISO_LIMPEZA = "Não foi possível limpar o que venceu neste computador; a limpeza ficou para depois.";
const NAO_SINCRONIZOU = "Não foi possível sincronizar agora.";

const objeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const ESTADOS: ReadonlySet<unknown> = new Set(["ok", "erro", "indisponivel", "nunca"]);
const comoStatus = (x: unknown): StatusSync | null => (objeto(x) && ESTADOS.has(x.estado) ? (x as unknown as StatusSync) : null);
const mesmoLogin = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Os três status de um escopo, ou null se a forma não confere. */
function tresStatus(x: unknown): StatusSync[] | null {
  if (!objeto(x)) return null;
  const lista = TABELAS.map((t) => comoStatus(x[t]));
  return lista.every((s): s is StatusSync => s !== null) ? lista : null;
}

/**
 * O aviso do "Sincronizar agora", honesto: "Sincronizado." só com as três tabelas lidas e gravadas. A resposta torta
 * não é "Sincronizado."; a primeira tabela com erro ou indisponível diz o motivo; lido mas com alterações esperando o
 * "Entendi", diz isso.
 */
export function textoDoSincronizar(r: unknown): string {
  if (!objeto(r)) return NAO_SINCRONIZOU;
  const unidade = tresStatus(r.unidade);
  const eu = r.eu === null || r.eu === undefined ? null : tresStatus(r.eu);
  if (!unidade || (r.eu !== null && r.eu !== undefined && !eu)) return NAO_SINCRONIZOU;
  const textos = [...unidade, ...(eu ?? [])];
  const ruim = textos.find((s) => s.estado === "erro" || s.estado === "indisponivel");
  if (ruim) return typeof ruim.mensagem === "string" && ruim.mensagem ? ruim.mensagem : NAO_SINCRONIZOU;
  if (textos.some((s) => s.aguardandoPermissao)) return "Lido do SEI; há alterações esperando o seu “Entendi”.";
  return textos.every((s) => s.estado === "ok") ? "Sincronizado." : NAO_SINCRONIZOU;
}

export class Colaboracao {
  readonly provedor: EstadoDaSincronia;
  /** As faixas de consentimento (o app as põe no topo; o conteúdo muda sozinho). */
  readonly faixas: HTMLElement = h("div", { class: "dem-faixas-colab" });
  private readonly portas;
  private readonly sigla: string;
  private paradas: Array<() => void> = [];
  private destruido = false;
  private faixasNaTela = "|";
  /** Uma pintura por vez vale: a mais nova (a leitura das demandas é assíncrona). */
  private vezFaixas = 0;
  private copiaDoDia: Promise<void> = Promise.resolve();
  private falhaCopia: string | null = null;

  constructor(private readonly d: DepsColaboracao) {
    const u = d.contexto.unidade;
    if (!u) throw new Error("Sem unidade: a sincronia das demandas precisa de uma unidade do SEI.");
    this.sigla = u.sigla || "unidade";
    const esc = escoposDaUnidade(d.contexto.host, d.contexto.login, u.id);
    this.provedor = new EstadoDaSincronia({ area: d.area, sync: d.sync, escopos: esc });
    this.portas = {
      unidade: consentimentoDemandas(d.sync, d.contexto.host, d.contexto.login, u.id, "unidade"),
      eu: consentimentoDemandas(d.sync, d.contexto.host, d.contexto.login, u.id, "eu"),
    };
  }

  private get dono() {
    return { host: this.d.contexto.host, login: this.d.contexto.login };
  }

  /** Lê o estado, pinta as faixas, limpa o que venceu, faz a cópia do dia e sincroniza o arquivo ligado. */
  async iniciar(): Promise<void> {
    const repintar = () => void this.pintarFaixas().catch(() => undefined);
    const agendarArquivo = () => this.d.arquivo?.agendar();
    this.paradas.push(
      this.provedor.aoMudar(repintar),
      this.d.repos.unidade.aoMudar(repintar),
      this.d.repos.eu.aoMudar(repintar),
      this.d.repos.unidade.aoMudar(agendarArquivo),
      this.d.repos.eu.aoMudar(agendarArquivo),
    );
    await this.provedor.iniciar();
    if (this.destruido) return;
    await this.pintarFaixas();
    void this.limpar();
    this.copiaDoDia = this.fazerCopiaDoDia();
    void this.d.arquivo?.sincronizar().catch(() => undefined);
  }

  destruir(): void {
    this.destruido = true;
    for (const p of this.paradas.splice(0)) p();
    this.provedor.parar();
    this.d.arquivo?.parar();
  }

  /** O app voltou a ficar visível: o arquivo pode ter sido mudado por outro computador. */
  aoGanharFoco(): void {
    if (this.destruido) return;
    void this.d.arquivo?.sincronizar().catch(() => undefined);
  }

  /** O app se atualiza quando o estado da sincronia muda. */
  aoMudar(cb: () => void): () => void {
    return this.provedor.aoMudar(cb);
  }

  estadoDoIndicador(): Indicador {
    return indicadorDe(this.provedor.situacao(), this.d.agora());
  }

  private async limpar(): Promise<void> {
    let avisou = false;
    for (const r of Object.values(this.d.repos)) {
      try {
        await r.limpar(this.d.agora());
      } catch (e) {
        console.warn("[SEI Pro] demandas: limpeza não feita:", mensagemDoErro(e));
        if (!avisou && !this.destruido) {
          avisou = true;
          this.d.avisar(AVISO_LIMPEZA);
        }
      }
    }
  }

  private fazerCopiaDoDia(): Promise<void> {
    const armazem = this.d.copias;
    if (!armazem) return Promise.resolve();
    return fazerCopiaDoDia(this.d.area, this.dono, armazem, this.d.hoje(), () => this.d.carimbo()).then(
      () => {
        this.falhaCopia = null;
      },
      (e: unknown) => {
        this.falhaCopia = mensagemDoErro(e);
        console.warn("[SEI Pro] demandas: cópia do dia não foi feita:", this.falhaCopia);
      },
    );
  }

  /** O "Entendi" que falta (unidade, com demanda ou alteração esperando) e o convite do pessoal (com demanda "Só eu"). */
  private async pintarFaixas(): Promise<void> {
    const vez = ++this.vezFaixas;
    const s = this.provedor.situacao();
    const aguardando = TABELAS.some((t) => s.unidade.tabelas[t].status?.aguardandoPermissao);
    const tem = async (vis: Vis): Promise<boolean> => {
      try {
        return (await this.d.repos[vis].dados()).length > 0;
      } catch {
        return false;
      }
    };
    const pedirEntendi = s.unidade.consentimento !== "ligado" && (aguardando || (await tem("unidade")));
    const convite = s.eu.consentimento === "nao-perguntado" && (await tem("eu"));
    if (vez !== this.vezFaixas || this.destruido) return;
    const chave = `${pedirEntendi ? "entendi" : ""}|${convite ? "convite" : ""}`;
    if (chave === this.faixasNaTela) return;
    this.faixasNaTela = chave;
    const faixas: HTMLElement[] = [];
    if (pedirEntendi) faixas.push(faixaConsentimentoUnidade({ aoEntendi: () => void this.consentir("unidade") }));
    if (convite)
      faixas.push(
        faixaConvitePessoal({
          aoLigar: () => void this.consentir("eu"),
          aoRecusar: () => void this.gravarConsentimento("eu", "desligado"),
        }),
      );
    this.faixas.replaceChildren(...faixas);
  }

  private async gravarConsentimento(vis: Vis, valor: "ligado" | "desligado"): Promise<boolean> {
    try {
      await this.portas[vis].definir(valor);
      return true;
    } catch (e) {
      console.warn("[SEI Pro] demandas: consentimento não gravado:", e instanceof Error ? e.message : String(e));
      this.d.avisar(MENSAGEM_CONSENTIMENTO_NAO_GRAVOU);
      return false;
    }
  }

  /**
   * O consentimento de um escopo: o da unidade é o "Entendi" da faixa; o pessoal pergunta no diálogo. Gravado o "ligado",
   * a sincronização roda (só então a aba é chamada). Devolve se ficou ligado. Nunca lança.
   */
  async consentir(vis: Vis): Promise<boolean> {
    try {
      if (vis === "eu") {
        const sim = await pedirConsentimentoPessoal({
          abrirModal: this.d.abrirModal,
          sigla: this.sigla,
          nomeTexto: `[_SEIPRO_DEM_${this.d.contexto.login.trim().toLowerCase()}_…]`,
        });
        if (!sim) return false;
      }
      if (!(await this.gravarConsentimento(vis, "ligado"))) return false;
      await this.sincronizarAgora();
      return true;
    } catch (e) {
      this.d.avisar(mensagemDoErro(e));
      return false;
    }
  }

  /**
   * "Sincronizar agora" (os textos, pela aba). A aba que não responde vira aviso e `null`; o resultado vem num aviso
   * (`textoDoSincronizar`).
   */
  async sincronizarAgora(): Promise<RespostaSincronizar | null> {
    try {
      const r = await this.d.rpc.chamar<unknown>("sincronizarAgora", { chave: chaveDaAba(this.d.contexto) }, 120_000);
      this.d.avisar(textoDoSincronizar(r));
      await this.provedor.ler().catch(() => undefined);
      return objeto(r) && tresStatus(r.unidade) ? (r as unknown as RespostaSincronizar) : null;
    } catch (e) {
      this.d.avisar(mensagemDoErro(e) || NAO_SINCRONIZOU);
      return null;
    }
  }

  /** O JSON de um texto escolhido: tamanho conferido, BOM tirado, JSON quebrado lança com o que fazer. */
  private lerJson(texto: string, limite: number, grande: string): unknown {
    if (texto.length > limite) throw new Error(grande);
    try {
      return JSON.parse(texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto);
    } catch {
      throw new Error(MENSAGEM_NAO_E_JSON);
    }
  }

  /** "Exportar arquivo (backup)…": tudo do usuário (todas as unidades, todas as tabelas, com os sigilosos: é dele). */
  async exportarArquivo(): Promise<string> {
    const env = await exportarTudo(this.d.area, this.dono, () => this.d.carimbo());
    const conteudo = JSON.stringify(env, null, 2);
    const nome = `demandas-seipro-${this.d.contexto.login.trim().toLowerCase()}-${this.d.hoje()}.json`;
    this.d.baixar(nome, conteudo, "application/json");
    const alto = tamanhoDoArquivoAlto(new TextEncoder().encode(conteudo).length);
    const msg = `Arquivo “${nome}” baixado.${alto ? ` ${MENSAGEM_ARQUIVO_GRANDE}` : ""}`;
    this.d.avisar(msg);
    return msg;
  }

  /** "Importar arquivo…": junta o arquivo ao que há aqui (nunca apaga). Erros lançam com o que fazer. */
  async importarArquivo(): Promise<string | undefined> {
    const texto = await this.d.escolherArquivo();
    if (texto === null) return undefined;
    const bruto = this.lerJson(texto, LIMITE_COPIA, MENSAGEM_COPIA_GRANDE);
    // Antes de ler o envelope: o de versão mais nova seria só "não é uma cópia".
    if (versaoMaisNova(bruto, FORMATO_ARQUIVO, VERSAO_ARQUIVO) || versaoMaisNova(bruto, FORMATO_ARQUIVO_MORTO, 1))
      throw new Error(MENSAGEM_COPIA_MAIS_NOVA);
    const env = lerEnvelopeArquivo(bruto);
    if (!env)
      throw new Error(
        objeto(bruto) && bruto.formato === FORMATO_ARQUIVO_MORTO
          ? "Este arquivo é um arquivo morto: use “Exportar arquivo morto e limpar…” e, nele, “Importar arquivo morto…”."
          : MSG_NAO_E_DO_GESTOR,
      );
    const dono = this.dono;
    if (!env.escopos.some((s) => s.escopo.host === dono.host && mesmoLogin(s.escopo.login, dono.login)))
      throw new Error("Este arquivo é de outro usuário ou de outro SEI: nada foi importado.");
    const r = await importarTudo(this.d.area, env, dono, () => this.d.carimbo());
    const alto = tamanhoDoArquivoAlto(new TextEncoder().encode(texto).length);
    const msg = `${plural(r.novos, "nova", "novas")}, ${plural(r.atualizados, "atualizada", "atualizadas")}, ${plural(r.ignorados, "ignorada", "ignoradas")}.${alto ? ` ${MENSAGEM_ARQUIVO_GRANDE}` : ""}`;
    this.d.avisar(msg);
    return msg;
  }

  private async tentarCopiaDoDia(): Promise<void> {
    await this.copiaDoDia;
    if (this.falhaCopia === null) return;
    this.copiaDoDia = this.fazerCopiaDoDia();
    await this.copiaDoDia;
  }

  /** A cópia do dia, esperada no máximo `esperaCopia` (o IndexedDB preso não segura o diálogo). Nunca lança. */
  private async esperarCopiaDoDia(): Promise<void> {
    let t: ReturnType<typeof setTimeout> | undefined;
    const limite = new Promise<void>((ok) => {
      t = setTimeout(ok, this.d.esperaCopia ?? ESPERA_COPIA_MS);
    });
    try {
      await Promise.race([this.tentarCopiaDoDia(), limite]);
    } finally {
      clearTimeout(t);
    }
  }

  async abrirDialogoSincronizacao(): Promise<void> {
    await this.esperarCopiaDoDia();
    const a = this.d.arquivo;
    const conteudo = await montarSincronizacao({
      sigla: this.sigla,
      agora: () => this.d.agora(),
      situacao: (): Promise<SituacaoSincronia> => this.provedor.ler(),
      aoMudar: (f) => this.provedor.aoMudar(() => f(this.provedor.situacao())),
      sincronizar: async () => void (await this.sincronizarAgora()),
      pessoal: {
        ligar: () => this.consentir("eu"),
        desligar: async () => {
          if (await this.gravarConsentimento("eu", "desligado"))
            this.d.avisar("Texto pessoal desligado. Ele continua no SEI até você apagá-lo.");
        },
        // A aba grava o "desligado" e exclui os textos pessoais (os da unidade são de todos e não têm "apagar").
        apagar: async () => (await this.d.rpc.chamar<unknown>("apagarPessoal", { chave: chaveDaAba(this.d.contexto) }, 120_000)) === true,
      },
      arquivo: a
        ? {
            status: () => a.status(),
            configurado: () => a.configurado(),
            escolher: async (modo) => {
              try {
                await a.escolher(modo);
              } catch (e) {
                // Seletor cancelado não é erro; o recusado dentro do painel (iframe) ganha a explicação.
                if ((e as { name?: string } | null)?.name === "AbortError") return;
                if ((e as { name?: string } | null)?.name === "SecurityError") throw new Error(MENSAGEM_SELETOR);
                throw e;
              }
            },
            reconectar: async () => void (await a.reconectar()),
            agora: async () => void (await a.sincronizar()),
            esquecer: () => a.esquecer(),
          }
        : null,
      exportar: () => this.exportarArquivo(),
      importar: () => this.importarArquivo(),
      baixar: (nome, c, tipo) => this.d.baixar(nome, c, tipo),
      confirmar: (texto, rotulo) => this.d.confirmar(texto, rotulo),
    });
    this.d.abrirModal({ titulo: "Sincronização", icone: "nuvem", conteudo });
  }

  async abrirCopias(): Promise<void> {
    await this.esperarCopiaDoDia();
    const copias = this.d.copias;
    await abrirCopias({
      abrirModal: this.d.abrirModal,
      confirmar: (t, r) => this.d.confirmar(t, r),
      copias: copias
        ? {
            listar: () => copias.listar(this.dono),
            restaurar: (c) => restaurarCopia(this.d.area, c, this.dono, () => this.d.carimbo()),
            falhaDoDia: () => this.falhaCopia,
          }
        : null,
    });
  }

  abrirArquivarAntigas(): Promise<void> {
    return abrirArquivarAntigas({
      abrirModal: this.d.abrirModal,
      repos: this.d.repos,
      hoje: () => this.d.hoje(),
      avisar: (t) => this.d.avisar(t),
    });
  }

  /** O gancho do app (faixas e menu): o diálogo abre; o erro vira aviso. */
  arquivarAntigas(): void {
    void this.abrirArquivarAntigas().catch((e: unknown) => this.d.avisar(mensagemDoErro(e)));
  }

  abrirArquivoMorto(): void {
    abrirArquivoMorto({
      abrirModal: this.d.abrirModal,
      repos: this.d.repos,
      hoje: () => this.d.hoje(),
      confirmar: (t, r) => this.d.confirmar(t, r),
      contexto: this.d.contexto,
      agora: () => this.d.agora(),
      baixar: (n, c, t) => this.d.baixar(n, c, t),
      escolherArquivo: () => this.d.escolherArquivo(),
      avisar: (t) => this.d.avisar(t),
    });
  }

  abrirAjuda(): void {
    this.d.abrirModal({
      titulo: "Ajuda das Demandas",
      icone: "nota",
      conteudo: h(
        "div",
        { class: "dem-form dem-ajuda" },
        h("h3", {}, "Onde ficam as demandas"),
        h(
          "p",
          {},
          `As demandas ficam neste navegador e, para “Toda a unidade”, também em três Textos Padrão do SEI (demandas, arquivadas e histórico) que todos da ${this.sigla} com SEI Pro leem e gravam. “Só eu” fica neste navegador, e só vai ao SEI se você ligar.`,
        ),
        h("h3", {}, "Quantas cabem"),
        h(
          "p",
          {},
          "Cabem cerca de 500 demandas ativas por unidade. O limite é o tamanho do texto (100 KB), não a contagem: perto dele aparece uma faixa e, no limite, criar fica bloqueado. Arquive as concluídas antigas para liberar espaço.",
        ),
        h("h3", {}, "Cópias e arquivo"),
        h(
          "p",
          {},
          "O arquivo numa pasta da nuvem e as cópias automáticas deste navegador guardam tudo, inclusive o histórico, e nunca apagam o que está aqui. Exportar e importar funcionam em qualquer navegador.",
        ),
        h("h3", {}, "Privacidade"),
        h(
          "p",
          {},
          "Não escreva dados sigilosos no título ou na descrição: ficam no Texto Padrão e todos da unidade os leem. O número de processo sigiloso nunca vai ao SEI.",
        ),
      ),
    });
  }

  /** Os itens do menu de ajustes que a colaboração acrescenta. */
  itensDoMenu(): EntradaMenu[] {
    const fazer = (f: () => unknown) => () => {
      void Promise.resolve()
        .then(f)
        .catch((e: unknown) => this.d.avisar(mensagemDoErro(e)));
    };
    return [
      { rotulo: "Sincronização…", icone: "nuvem", dica: "Texto Padrão · arquivo", fazer: fazer(() => this.abrirDialogoSincronizacao()) },
      { rotulo: "Arquivar concluídas antigas…", icone: "pasta", fazer: () => this.arquivarAntigas() },
      { rotulo: "Exportar arquivo morto e limpar…", icone: "baixar", fazer: () => this.abrirArquivoMorto() },
      "-",
      { rotulo: "Exportar arquivo (backup)…", icone: "baixar", fazer: fazer(() => this.exportarArquivo()) },
      { rotulo: "Importar arquivo…", icone: "subir", fazer: fazer(() => this.importarArquivo()) },
      { rotulo: "Cópias automáticas…", icone: "restaurar", fazer: fazer(() => this.abrirCopias()) },
      "-",
      { rotulo: "Ajuda", icone: "nota", fazer: () => this.abrirAjuda() },
    ];
  }
}
