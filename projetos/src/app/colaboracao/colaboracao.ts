/**
 * Sincronia e colaboração no app (P4): o que o `AppProjetos` (P3) recebe pelos
 * pontos de extensão — o estado da sincronia (`provedor`), os itens do menu
 * ajustes (`extensoesMenu`), as faixas (convite do texto pessoal e "Entendi"
 * pendente), o repositório da unidade que pergunta o "Entendi" antes de gravar
 * (`repos`) e a importação do Atividades — e os diálogos de apoio:
 * Sincronização, Modelos, Histórico, Enviar/Receber e Importar. O painel
 * lateral (P5) monta o mesmo objeto.
 *
 * Quem grava no SEI é a aba (content script): daqui saem só os pedidos
 * `sincronizarAgora`, `apagarDoSei` e `importarAtividades` pelo RPC. O app não
 * importa de `src/pagina`: as respostas da aba são conferidas aqui.
 *
 * Ao abrir: as lápides velhas e o histórico além de 300 saem deste navegador
 * (`limpar`), a cópia do dia é feita e o arquivo ligado sincroniza. Nada disso
 * derruba o app: a memória do sigilo ilegível vira um aviso curto na limpeza e,
 * na cópia do dia, a linha "A cópia de hoje não foi feita" do diálogo
 * Sincronização, que tenta a cópia de novo cada vez que abre.
 *
 * Os arquivos que o usuário escolhe (Importar, Receber) têm o tamanho conferido
 * ANTES de o texto ser lido. O "Enviar projeto" corta o sigilo pelo caminho do
 * Texto Padrão com a memória (`arquivoDoProjeto`, falha fechada); a cópia de
 * tudo (`exportarTudo`) é só do próprio usuário (Exportar, cópias, arquivo).
 */

import type { Area } from "@comum/armazenamento/area";
import type { DataISO } from "@comum/datas/dias";
import type { Rpc } from "@comum/ponte/rpc";
import type { ControleArquivo } from "@comum/sincronia/arquivo";
import type { PortaConsentimento } from "@comum/sincronia/consentimento";
import type { StatusSync } from "@comum/sincronia/motor";
import { versaoMaisNova } from "@comum/sincronia/textoPadraoCodec";
import { avisar } from "@comum/ui/aviso";
import type { AbrirModal } from "@comum/ui/dialogo";
import { h } from "@comum/ui/dom";
import type { EntradaMenu } from "@comum/ui/menu";
import {
  arquivoDoProjeto,
  type EnvelopeProjeto,
  FORMATO_PROJETO,
  LIMITE_ARQUIVO_PROJETO,
  lerArquivoDoProjeto,
  MENSAGEM_GRANDE,
  type PreviaRecebido,
  previaDoRecebido,
  receberProjeto,
  TIPO_ARQUIVO_PROJETO,
} from "../../arquivo/projetoArquivo";
import {
  idDoLegado,
  importarAtividades,
  itensParaImportar,
  legadosExcluidos,
  legadosImportados,
  type ProjetoLegado,
  projetosLegados,
} from "../../importacao/atividades";
import { escoposDaUnidade } from "../../modelo/escopo";
import { ErroMemoriaSigilo } from "../../modelo/memoriaSigilo";
import type { Carimbo, Vis } from "../../modelo/tipos";
import { ErroValidacao } from "../../modelo/validacao";
import type { ContextoProjetos } from "../../ponte/tipos";
import type { RepositorioProjetos } from "../../repositorio";
import {
  type ArmazemCopiasProjetos,
  type EnvelopeArquivo,
  exportarTudo,
  FORMATO_ARQUIVO,
  fazerCopiaDoDia,
  importarTudo,
  lerEnvelopeArquivo,
  restaurarCopia,
  VERSAO_ARQUIVO,
} from "../../sincronia/arquivo";
import { consentimentoProjetos } from "../../sincronia/consentimento";
import { nomeDoTexto } from "../../sincronia/textoPadrao";
import type { ExtensoesMenu } from "../componentes/menuAjustes";
import { carregarUnidade, type ProjetoNaTela } from "../dados";
import { abrirEnviarProjeto, abrirReceberProjeto } from "../dialogos/arquivoProjeto";
import { avisoDaUnidade, faixaAguardando, faixaConvite, pedirConsentimentoPessoal } from "../dialogos/consentimento";
import { abrirHistorico, type NomesDoHistorico, type RegistroNaTela } from "../dialogos/historico";
import { abrirImportarAtividades, mensagemDaImportacao } from "../dialogos/importar";
import { abrirModelos } from "../dialogos/modelos";
import { montarSincronizacao } from "../dialogos/sincronizacao";
import { avisarErro, CanceladoNaTroca, mensagemDoErro } from "../erros";
import { plural } from "../formato";
import { comConsentimento, consentidor, gravarConsentimento, MENSAGEM_SEM_ENTENDI } from "./consentir";
import { EstadoDaSincronia } from "./estado";

/** O que a aba devolve no `importarAtividades` (pagina/atividades.ts, `ProjetosDoAtividades`). */
interface RespostaAtividades {
  fonte?: unknown;
  projetos?: unknown;
  aviso?: unknown;
  cortados?: unknown;
}

/** O que o app oferece de volta (o app é criado depois, com o que sai daqui). */
export interface GanchosDoApp {
  /** "todos" ou o id do projeto aberto. */
  readonly aberto: string;
  /** Relê e abre o projeto, se ele está ativo (depois de receber ou importar). */
  abrirProjeto(id: string): Promise<void>;
  /** O "Novo projeto" já no modelo (diálogo Modelos de projeto). */
  novoProjetoDeModelo(id: string): void;
}

/** O arquivo que o usuário escolheu (um `File` serve): o tamanho é conferido antes de o texto ser lido. */
export interface ArquivoEscolhido {
  readonly size: number;
  text(): Promise<string>;
}

/** O arquivo ligado numa pasta da nuvem (o `ControleArquivo` do sei-comum), no que a colaboração usa. */
export type ArquivoLigado = Pick<
  ControleArquivo<EnvelopeArquivo>,
  "status" | "configurado" | "escolher" | "reconectar" | "sincronizar" | "esquecer" | "agendar" | "parar"
>;

export interface DepsColaboracao {
  ctx: ContextoProjetos;
  /** chrome.storage.local (dados, status) e chrome.storage.sync (consentimentos). */
  area: Area;
  sync: Area;
  /** Os repositórios dos dois escopos da unidade, sem a pergunta (a pergunta é daqui). */
  repos: Readonly<Record<Vis, RepositorioProjetos>>;
  rpc: Pick<Rpc, "chamar">;
  abrirModal: AbrirModal;
  confirmar(texto: string, rotuloOk?: string): Promise<boolean>;
  baixar(nome: string, conteudo: string, tipo: string): void;
  /** O arquivo escolhido pelo usuário (sem ler o texto: `escolherArquivoLocal`), ou null se cancelou. */
  escolherArquivo(): Promise<ArquivoEscolhido | null>;
  hoje(): DataISO;
  agora(): number;
  carimbo(): Carimbo;
  /** Cópias diárias (IndexedDB `seipro-projetos`); null sem banco. */
  copias: ArmazemCopiasProjetos | null;
  /** O arquivo ligado (File System Access); null onde o navegador não deixa. */
  arquivo: ArquivoLigado | null;
  app(): GanchosDoApp | null;
  /** A altura do painel mudou (faixa entrou ou saiu). */
  aoRedesenhar?: () => void;
  /** Quanto o diálogo Sincronização espera a cópia do dia antes de abrir (padrão 2 s). */
  esperaCopia?: number;
}

/** O diálogo Sincronização espera a cópia do dia no máximo isto; depois abre com o que houver. */
const ESPERA_COPIA_MS = 2000;

/** A cópia de tudo (todas as unidades) pode crescer; acima disto não é uma cópia dos projetos. */
const LIMITE_COPIA = 50 * 1024 * 1024;

/** A limpeza ao abrir não leu a memória do sigilo (falha fechada: nada foi podado). O app segue. */
export const AVISO_LIMPEZA =
  "Não foi possível ler a lista de processos sigilosos deste computador; a limpeza dos itens excluídos ficou para depois.";

/** O Chrome recusa o seletor de arquivo dentro do iframe do painel (`SecurityError`, com o texto em inglês). */
const MENSAGEM_SELETOR =
  "O navegador não deixa escolher um arquivo aqui dentro do painel. Use “Exportar tudo” e “Importar de um arquivo…”.";

const MENSAGEM_COPIA_GRANDE = "O arquivo passa de 50 MB: não é uma cópia dos projetos do SEI Pro.";
const MENSAGEM_NAO_E_JSON = "O arquivo não é um JSON válido.";
const MENSAGEM_COPIA_MAIS_NOVA =
  "Este arquivo foi gravado por uma versão mais nova do SEI Pro. Atualize a extensão neste computador e importe de novo.";

const objeto = (x: unknown): x is Record<string, unknown> => !!x && typeof x === "object" && !Array.isArray(x);
const ESTADOS: ReadonlySet<unknown> = new Set(["ok", "erro", "indisponivel", "nunca"]);
/** O status de um texto como a aba devolveu, ou null se a forma não confere. */
const comoStatus = (x: unknown): StatusSync | null => (objeto(x) && ESTADOS.has(x.estado) ? (x as unknown as StatusSync) : null);

const NAO_SINCRONIZOU = "Não foi possível sincronizar agora.";

/**
 * O aviso do "Sincronizar agora", honesto: "Sincronizado." só com os textos lidos e gravados. A resposta torta
 * (ou um texto que não chegou a ser lido) não é "Sincronizado."; o primeiro texto com erro ou indisponível diz o
 * motivo; lido mas com alterações esperando o "Entendi", diz isso.
 */
export function textoDoSincronizar(r: unknown): string {
  if (!objeto(r)) return NAO_SINCRONIZOU;
  const unidade = comoStatus(r.unidade);
  // O pessoal desligado vem nulo; o que vem tem de ter a forma de status.
  const eu = r.eu === null || r.eu === undefined ? null : comoStatus(r.eu);
  if (!unidade || (r.eu !== null && r.eu !== undefined && !eu)) return NAO_SINCRONIZOU;
  const textos = eu ? [unidade, eu] : [unidade];
  const ruim = textos.find((s) => s.estado === "erro" || s.estado === "indisponivel");
  if (ruim) return typeof ruim.mensagem === "string" && ruim.mensagem ? ruim.mensagem : NAO_SINCRONIZOU;
  if (textos.some((s) => s.aguardandoPermissao)) return "Lido do SEI; há alterações esperando o seu “Entendi”.";
  return textos.every((s) => s.estado === "ok") ? "Sincronizado." : NAO_SINCRONIZOU;
}
const mesmoLogin = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/**
 * O seletor de arquivo comum (sem File System Access): o próprio arquivo, sem ler o texto (quem lê confere o
 * tamanho antes), ou null se cancelou. É o `escolherArquivo` que o main.ts do app passa à colaboração.
 */
export function escolherArquivoLocal(aceitar = ".json,application/json"): Promise<File | null> {
  return new Promise<File | null>((ok) => {
    const i = h("input", { type: "file", accept: aceitar });
    i.addEventListener("change", () => ok(i.files?.[0] ?? null));
    i.addEventListener("cancel", () => ok(null));
    i.click();
  });
}

export class Colaboracao {
  readonly provedor: EstadoDaSincronia;
  /** O da unidade pergunta o "Entendi" antes de gravar; o "Só eu" é o mesmo. */
  readonly repos: Readonly<Record<Vis, RepositorioProjetos>>;
  readonly faixas: HTMLElement = h("div", { class: "prj-faixas" });
  readonly extensoesMenu: ExtensoesMenu;
  readonly consentirUnidade: () => Promise<boolean>;
  private readonly portas: Record<Vis, PortaConsentimento>;
  private readonly sigla: string;
  private paradas: Array<() => void> = [];
  private destruido = false;
  /** As faixas que estão na tela: repintar as mesmas não troca os botões (o foco do teclado não se perde). */
  private faixasNaTela = "|";
  /** Uma pintura por vez vale: a mais nova (a leitura dos projetos "Só eu" é assíncrona). */
  private vezFaixas = 0;
  /** A cópia do dia em andamento e a mensagem da última que não pôde ser feita (o diálogo mostra). */
  private copiaDoDia: Promise<void> = Promise.resolve();
  private falhaCopia: string | null = null;

  constructor(private readonly d: DepsColaboracao) {
    const u = d.ctx.unidade;
    if (!u) throw new Error("Sem unidade: a sincronia dos projetos precisa de uma unidade do SEI.");
    this.sigla = u.sigla || "unidade";
    const esc = escoposDaUnidade(d.ctx.host, d.ctx.login, u.id);
    this.provedor = new EstadoDaSincronia({ area: d.area, sync: d.sync, escopos: esc, agora: () => d.agora() });
    this.portas = {
      unidade: consentimentoProjetos(d.sync, d.ctx.host, d.ctx.login, u.id, "unidade"),
      eu: consentimentoProjetos(d.sync, d.ctx.host, d.ctx.login, u.id, "eu"),
    };
    const perguntar = consentidor(this.portas.unidade, () =>
      avisoDaUnidade({ abrirModal: d.abrirModal, sigla: this.sigla, nomeTexto: nomeDoTexto("unidade", d.ctx.login) }),
    );
    // Desmontada com a pergunta aberta (o lateral trocou de unidade e fechou o "Entendi"): o "não" é da troca, não
    // do usuário. Nada grava, e o cancelamento é silencioso (`avisarErro`).
    this.consentirUnidade = async () => {
      const sim = await perguntar();
      if (!sim && this.destruido) throw new CanceladoNaTroca();
      return sim;
    };
    this.repos = { unidade: comConsentimento(d.repos.unidade, this.consentirUnidade), eu: d.repos.eu };
    // Como nas telas: o que é da sincronia no começo, o que é de arquivo depois de Exportar/Imprimir, o histórico no fim.
    const fazer = (f: () => Promise<void>) => () => void f().catch((e: unknown) => avisarErro(e));
    this.extensoesMenu = {
      sincronia: (): EntradaMenu[] => [
        { rotulo: "Sincronização…", icone: "nuvem", dica: "Texto Padrão · arquivo", fazer: fazer(() => this.abrirSincronizacao()) },
        { rotulo: "Modelos de projeto…", icone: "camadas", fazer: fazer(() => this.abrirModelos()) },
      ],
      arquivo: (o): EntradaMenu[] => [
        // Sem projeto ativo não há o que enviar (como o CSV e o Imprimir).
        o?.semProjetos ? null : { rotulo: "Enviar projeto por arquivo…", icone: "baixar", fazer: fazer(() => this.enviarProjeto()) },
        { rotulo: "Receber projeto de arquivo…", icone: "subir", fazer: fazer(() => this.receberProjeto()) },
        d.ctx.atividades ? { rotulo: "Importar do servidor do Atividades…", icone: "subir", fazer: () => this.importarAtividades() } : null,
      ],
      fim: (): EntradaMenu[] => [{ rotulo: "Histórico de alterações", icone: "historico", fazer: fazer(() => this.abrirHistorico()) }],
    };
  }

  private get dono() {
    return { host: this.d.ctx.host, login: this.d.ctx.login };
  }

  /** Lê o estado, pinta as faixas, limpa o que venceu, faz a cópia do dia e sincroniza o arquivo ligado. */
  async iniciar(): Promise<void> {
    const repintar = () => void this.pintarFaixas().catch(() => undefined);
    const agendarArquivo = () => this.d.arquivo?.agendar();
    this.paradas.push(
      this.provedor.aoMudar(repintar),
      this.d.repos.eu.aoMudar(repintar),
      this.d.repos.unidade.aoMudar(agendarArquivo),
      this.d.repos.eu.aoMudar(agendarArquivo),
    );
    await this.provedor.iniciar();
    // Fechado enquanto lia: nada de limpeza, cópia nem arquivo (os ouvintes já saíram no `destruir`).
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

  /**
   * Lápides velhas (180 dias na unidade, 90 no "Só eu") e o histórico além de 300 saem deste navegador. Com a
   * memória do sigilo ilegível, nada é podado (falha fechada) e um aviso curto, um só, diz isso; o app segue.
   */
  private async limpar(): Promise<void> {
    let avisou = false;
    for (const r of Object.values(this.d.repos)) {
      try {
        await r.limpar(this.d.agora());
      } catch (e) {
        console.warn("[SEI Pro] projetos: limpeza não feita:", mensagemDoErro(e));
        if (e instanceof ErroMemoriaSigilo && !avisou && !this.destruido) {
          avisou = true;
          avisar(AVISO_LIMPEZA);
        }
      }
    }
  }

  /** A cópia de hoje (se ainda não há). A falha (a memória do sigilo ilegível) fica para o diálogo mostrar. */
  private fazerCopiaDoDia(): Promise<void> {
    const armazem = this.d.copias;
    if (!armazem) return Promise.resolve();
    return fazerCopiaDoDia(this.d.area, this.dono, armazem, this.d.hoje(), () => this.d.carimbo()).then(
      () => {
        this.falhaCopia = null;
      },
      (e: unknown) => {
        this.falhaCopia = mensagemDoErro(e);
        console.warn("[SEI Pro] projetos: cópia do dia não foi feita:", this.falhaCopia);
      },
    );
  }

  /** Convite do pessoal (com projeto "Só eu" e sem resposta) e o "Entendi" que falta (alterações esperando). */
  private async pintarFaixas(): Promise<void> {
    const vez = ++this.vezFaixas;
    const s = this.provedor.situacao();
    const aguardando = !!s.unidade.status?.aguardandoPermissao && s.unidade.consentimento !== "ligado";
    let convite = false;
    if (s.eu.consentimento === "nao-perguntado") {
      try {
        convite = (await this.d.repos.eu.dados()).projetos.length > 0;
      } catch {
        // Sem ler os projetos "Só eu", o convite fica de fora; a faixa do "Entendi" não depende deles.
        convite = false;
      }
    }
    if (vez !== this.vezFaixas || this.destruido) return;
    const chave = `${aguardando ? "aguardando" : ""}|${convite ? "convite" : ""}`;
    if (chave === this.faixasNaTela) return;
    this.faixasNaTela = chave;
    const faixas: HTMLElement[] = [];
    if (aguardando) {
      faixas.push(
        faixaAguardando({
          sigla: this.sigla,
          aoEntendi: () => void gravarConsentimento(this.portas.unidade, "ligado").catch((e: unknown) => avisarErro(e)),
        }),
      );
    }
    if (convite) {
      faixas.push(
        faixaConvite({
          aoLigar: () => void this.ligarPessoal().catch((e: unknown) => avisarErro(e)),
          aoRecusar: () => void gravarConsentimento(this.portas.eu, "desligado").catch((e: unknown) => avisarErro(e)),
        }),
      );
    }
    this.faixas.replaceChildren(...faixas);
    this.d.aoRedesenhar?.();
  }

  /** O diálogo "Guardar no SEI"; true = ligado. */
  private async ligarPessoal(): Promise<boolean> {
    const sim = await pedirConsentimentoPessoal({
      abrirModal: this.d.abrirModal,
      sigla: this.sigla,
      nomeTexto: nomeDoTexto("eu", this.d.ctx.login),
    });
    if (sim) await gravarConsentimento(this.portas.eu, "ligado");
    return sim;
  }

  /**
   * "Sincronizar agora" (os dois textos, pela aba). A aba que não responde lança (o diálogo mostra na seção); o
   * resultado vem num aviso (`textoDoSincronizar`).
   */
  private async sincronizarAgora(): Promise<void> {
    avisar(textoDoSincronizar(await this.d.rpc.chamar<unknown>("sincronizarAgora", undefined, 120_000)));
  }

  /** O JSON do arquivo escolhido: o tamanho é conferido antes de ler; JSON quebrado lança com o que fazer. */
  private async lerJson(a: ArquivoEscolhido, limite: number, grande: string): Promise<unknown> {
    if (!(a.size <= limite)) throw new ErroValidacao([grande]);
    const texto = await a.text();
    try {
      return JSON.parse(texto.charCodeAt(0) === 0xfeff ? texto.slice(1) : texto);
    } catch {
      throw new ErroValidacao([MENSAGEM_NAO_E_JSON]);
    }
  }

  /** "Exportar tudo": a cópia de tudo do usuário (todas as unidades, com os sigilosos: é dele). */
  private async exportar(): Promise<string> {
    const env = await exportarTudo(this.d.area, this.dono, () => this.d.carimbo());
    const nome = `projetos-seipro-${this.d.ctx.login.trim().toLowerCase()}-${this.d.hoje()}.json`;
    this.d.baixar(nome, JSON.stringify(env, null, 2), "application/json");
    return `Arquivo “${nome}” baixado.`;
  }

  /** "Importar de um arquivo…": junta a cópia de tudo deste usuário (nunca apaga). Erros lançam com o que fazer. */
  private async importarArquivo(): Promise<string | undefined> {
    const a = await this.d.escolherArquivo();
    if (!a) return undefined;
    const bruto = await this.lerJson(a, LIMITE_COPIA, MENSAGEM_COPIA_GRANDE);
    // Antes de ler o envelope: o de versão mais nova seria só "não é uma cópia".
    if (versaoMaisNova(bruto, FORMATO_ARQUIVO, VERSAO_ARQUIVO)) throw new ErroValidacao([MENSAGEM_COPIA_MAIS_NOVA]);
    const env = lerEnvelopeArquivo(bruto);
    if (!env)
      throw new ErroValidacao([
        objeto(bruto) && bruto.formato === FORMATO_PROJETO
          ? "Este arquivo é de um projeto enviado: use “Receber projeto de arquivo…” no menu."
          : "Este arquivo não é uma cópia dos projetos do SEI Pro.",
      ]);
    const dono = this.dono;
    if (!env.escopos.some((s) => s.escopo.host === dono.host && mesmoLogin(s.escopo.login, dono.login)))
      throw new ErroValidacao(["Este arquivo é de outro usuário ou de outro SEI: nada foi importado."]);
    const r = await importarTudo(this.d.area, env, dono, () => this.d.carimbo());
    const n = r.novos + r.atualizados;
    const invalidos = r.ignorados - r.excedentes;
    return [
      n ? `${plural(n, "item importado", "itens importados")}.` : "Nada novo: o que está no arquivo já está aqui.",
      invalidos > 0 ? `${plural(invalidos, "item inválido ficou", "itens inválidos ficaram")} de fora.` : "",
    ]
      .filter(Boolean)
      .join(" ");
  }

  /** Antes do diálogo: a cópia do dia em andamento termina e, se a última falhou, é tentada de novo. */
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

  async abrirSincronizacao(): Promise<void> {
    await this.esperarCopiaDoDia();
    const a = this.d.arquivo;
    const copias = this.d.copias;
    const conteudo = await montarSincronizacao({
      sigla: this.sigla,
      agora: () => this.d.agora(),
      situacao: () => this.provedor.ler(),
      // Sem reler: a mudança que o provedor já leu repinta as linhas do diálogo aberto.
      aoMudar: (f) => this.provedor.aoMudar(() => f(this.provedor.situacao())),
      sincronizar: () => this.sincronizarAgora(),
      pessoal: {
        ligar: () => this.ligarPessoal(),
        desligar: async () => {
          await gravarConsentimento(this.portas.eu, "desligado");
          avisar("Texto pessoal desligado. Ele continua no SEI até você apagá-lo.");
        },
        // A aba grava o "desligado" e exclui o texto pessoal (o da unidade é de todos e não tem "apagar").
        apagar: async () => (await this.d.rpc.chamar<unknown>("apagarDoSei", undefined, 120_000)) === true,
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
      exportar: () => this.exportar(),
      importar: () => this.importarArquivo(),
      copias: copias
        ? {
            listar: () => copias.listar(this.dono),
            restaurar: (c) => restaurarCopia(this.d.area, c, this.dono, () => this.d.carimbo()),
            falhaDoDia: () => this.falhaCopia,
          }
        : null,
      baixar: (nome, conteudo, tipo) => this.d.baixar(nome, conteudo, tipo),
      confirmar: (texto, rotulo) => this.d.confirmar(texto, rotulo),
    });
    this.d.abrirModal({ titulo: "Sincronização", icone: "nuvem", conteudo });
  }

  async abrirModelos(): Promise<void> {
    const dados = await carregarUnidade(this.d.repos, this.d.hoje());
    // Renomear e excluir um modelo de "Toda a unidade" passam pelo "Entendi" (o repositório com o consentimento).
    const repoDo = (vis: Vis | undefined) => {
      if (!vis) throw new ErroValidacao(["Os exemplos do SEI Pro não mudam."]);
      return this.repos[vis];
    };
    abrirModelos({
      abrirModal: this.d.abrirModal,
      modelos: dados.modelos,
      confirmar: (texto, rotulo) => this.d.confirmar(texto, rotulo),
      renomear: async (m, nome) => repoDo(m.vis).renomearModelo(m.id, nome),
      excluir: async (m) => repoDo(m.vis).removerModelo(m.id),
      criarProjeto: (m) => this.d.app()?.novoProjetoDeModelo(m.id),
    });
  }

  async abrirHistorico(): Promise<void> {
    const dados = await carregarUnidade(this.d.repos, this.d.hoje());
    const projetos = [...dados.ativos, ...dados.arquivados].map((p) => ({ id: p.projeto.id, nome: p.projeto.nome }));
    // Os nomes vêm de tudo dos dois escopos, com as lápides: o registro de um item excluído ainda diz o que era.
    const alvos = new Map<string, { tipo: "projeto" | "fase" | "etapa"; nome: string }>();
    for (const vis of ["unidade", "eu"] as const) {
      const ent = await this.d.repos[vis].entidades();
      for (const p of ent.p) alvos.set(p.id, { tipo: "projeto", nome: p.nome });
      for (const f of ent.f) alvos.set(f.id, { tipo: "fase", nome: f.nome });
      for (const e of ent.e) alvos.set(e.id, { tipo: "etapa", nome: e.nome });
    }
    const nomes: NomesDoHistorico = { alvo: (id) => alvos.get(id) };
    const aberto = this.d.app()?.aberto;
    await abrirHistorico({
      abrirModal: this.d.abrirModal,
      projetos,
      nomes,
      projeto: aberto && aberto !== "todos" && projetos.some((p) => p.id === aberto) ? aberto : undefined,
      registros: async () => {
        const de = async (vis: Vis): Promise<RegistroNaTela[]> => (await this.d.repos[vis].historico()).map((r) => ({ ...r, vis }));
        return [...(await de("unidade")), ...(await de("eu"))];
      },
    });
  }

  /**
   * "Enviar projeto por arquivo…": com um projeto aberto, baixa direto; no Todos, escolhe. O arquivo vai a outra
   * pessoa: sem o número sigiloso (regra + memória), e com a memória ilegível nenhum arquivo sai.
   */
  async enviarProjeto(): Promise<void> {
    const dados = await carregarUnidade(this.d.repos, this.d.hoje());
    const enviar = async (p: ProjetoNaTela) => {
      const a = await arquivoDoProjeto(this.d.repos[p.vis], p.projeto.id, this.d.agora());
      this.d.baixar(a.nome, a.conteudo, TIPO_ARQUIVO_PROJETO);
      avisar(`Arquivo “${a.nome}” baixado. Envie para quem vai receber o projeto.`);
    };
    const aberto = this.d.app()?.aberto;
    const atual = dados.ativos.find((p) => p.projeto.id === aberto);
    if (atual) {
      try {
        await enviar(atual);
      } catch (e) {
        avisarErro(e);
      }
      return;
    }
    if (!dados.ativos.length) {
      avisar("Não há projeto para enviar.");
      return;
    }
    // O diálogo mostra o erro (a memória ilegível, a cota) e fica aberto.
    abrirEnviarProjeto({ abrirModal: this.d.abrirModal, projetos: dados.ativos, enviar });
  }

  /**
   * "Receber projeto de arquivo…": o arquivo torto, grande ou de outro tipo nem abre o diálogo (o aviso diz o que
   * fazer). Receber em "Toda a unidade" pergunta o "Entendi" (o repositório com o consentimento).
   */
  async receberProjeto(): Promise<void> {
    const a = await this.d.escolherArquivo();
    if (!a) return;
    let previa: PreviaRecebido;
    let env: EnvelopeProjeto;
    try {
      if (!(a.size <= LIMITE_ARQUIVO_PROJETO)) throw new ErroValidacao([MENSAGEM_GRANDE]);
      env = lerArquivoDoProjeto(await a.text());
      previa = previaDoRecebido(env);
    } catch (e) {
      avisarErro(e);
      return;
    }
    const recebido = env;
    abrirReceberProjeto({
      abrirModal: this.d.abrirModal,
      sigla: this.sigla,
      previa,
      receber: async (vis) => {
        const p = await receberProjeto(this.repos[vis], recebido);
        avisar(`Projeto “${p.nome}” recebido.`);
        await this.d.app()?.abrirProjeto(p.id);
      },
    });
  }

  /**
   * Vai gravar em "Toda a unidade"? O destino escolhido, ou um escolhido que já está vivo lá (a importação o
   * atualiza onde está).
   */
  private async tocaAUnidade(escolhidos: readonly ProjetoLegado[], destino: Vis): Promise<boolean> {
    if (destino === "unidade") return true;
    const vivos = new Set((await this.d.repos.unidade.dados()).projetos.map((p) => p.id));
    return escolhidos.some((l) => vivos.has(idDoLegado.projeto(l.id_projeto)));
  }

  /** "Importar do servidor do Atividades…" (menu e primeiro uso): a aba busca, o diálogo escolhe, o app grava. */
  importarAtividades(): void {
    void (async () => {
      const r = await this.d.rpc.chamar<RespostaAtividades | null>("importarAtividades", undefined, 120_000);
      const lista = projetosLegados(r?.projetos);
      const todos = [...(await this.d.repos.unidade.entidades()).p, ...(await this.d.repos.eu.entidades()).p];
      const cortados = typeof r?.cortados === "number" && r.cortados > 0 ? r.cortados : undefined;
      abrirImportarAtividades({
        abrirModal: this.d.abrirModal,
        sigla: this.sigla,
        itens: itensParaImportar(lista, this.d.agora()),
        jaImportados: legadosImportados(todos),
        excluidos: legadosExcluidos(todos),
        avisoCache: r?.fonte === "cache" ? (typeof r.aviso === "string" && r.aviso ? r.aviso : "sem resposta") : undefined,
        cortados,
        importar: async (ids, vis) => {
          const escolhidos = lista.filter((l) => ids.includes(l.id_projeto));
          // O "Entendi" vem ANTES de montar o lote: o lote é do estado depois da resposta (o que chegou de um
          // colega enquanto o aviso esperava não é sobrescrito pelo que foi lido antes).
          if ((await this.tocaAUnidade(escolhidos, vis)) && !(await this.consentirUnidade()))
            throw new ErroValidacao([MENSAGEM_SEM_ENTENDI]);
          const res = await importarAtividades(this.repos, escolhidos, vis, this.d.hoje());
          avisar(mensagemDaImportacao(res, vis) || "Nada a importar.");
          const primeiro = escolhidos[0];
          if (res.novos && primeiro) await this.d.app()?.abrirProjeto(idDoLegado.projeto(primeiro.id_projeto));
        },
      });
    })().catch((e: unknown) => avisarErro(e));
  }
}
