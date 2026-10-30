/**
 * O balão "Demandas deste processo" (D17): lê os dois escopos da unidade (uma leitura de cada), monta o conteúdo
 * (pagina/conteudo.ts) no balão em Shadow DOM do Projetos (`@projetos/pagina/balao`: mesmo desenho, Esc, clique fora e
 * foco) e, a cada gravação feita nele, relê e redesenha no mesmo lugar, com a frase do que foi feito.
 *
 * Gravar em "Toda a unidade" passa pelo "Entendi" do Texto Padrão: o repositório da unidade vai embrulhado em
 * `comConsentimento` e a pergunta é o aviso no próprio balão (`perguntarEntendi`). "Agora não" não grava nada; fechar o
 * balão com a pergunta aberta é "não".
 */

import type { PortaConsentimento } from "@comum/sincronia/consentimento";
import { chaveProtocolo } from "@projetos/modelo/vinculos";
import { abrirBalaoNaPagina, type BalaoPagina } from "@projetos/pagina/balao";
import type { UsuarioDaUnidade } from "@projetos/ponte/tipos";
import { carregarDados } from "../app/dados";
import type { DataISO, Responsavel, Vis } from "../modelo/tipos";
import type { RepositorioDemandas } from "../repositorio";
import { concluirComDocumento, criarDoProcesso, iniciarDemanda } from "./acoes";
import { comConsentimento, consentidor } from "./consentir";
import { type AcoesConteudo, type DadosConteudo, montarConteudo, perguntarEntendi } from "./conteudo";
import type { Detectado } from "./deteccao";

export interface DepsBalaoDemandas {
  repos: Readonly<Record<Vis, RepositorioDemandas>>;
  hoje(): DataISO;
  sigla: string;
  temaEscuro: boolean;
  cssBase: string;
  /** O "Entendi" do Texto Padrão da unidade (`consentimentoDemandas(..., "unidade")`). */
  consentimento: PortaConsentimento;
  eu: Responsavel;
  /** A lista parcial de usuários da unidade (a mesma do app). */
  usuarios(): Promise<UsuarioDaUnidade[]>;
  /** "Abrir no painel": vai ao painel de demandas com esta demanda em foco. */
  abrirNoPainel(id: string): void;
}

async function dados(x: Detectado, d: DepsBalaoDemandas, mensagem?: string): Promise<DadosConteudo> {
  const hoje = d.hoje();
  const chave = chaveProtocolo(x.processo.protocolo);
  const [todas, usuarios] = await Promise.all([carregarDados(d.repos, hoje), d.usuarios().catch((): UsuarioDaUnidade[] => [])]);
  const saida: DadosConteudo = {
    processo: x.processo,
    documento: x.documento,
    ligadas: todas.filter(
      (t) => t.situacao !== "arquivada" && t.demanda.processos.some((p) => !!p.protocolo && chaveProtocolo(p.protocolo) === chave),
    ),
    hoje,
    eu: d.eu,
    usuarios,
  };
  if (mensagem) saida.mensagem = mensagem;
  return saida;
}

export async function abrirBalaoDemandas(ancora: HTMLElement, x: Detectado, d: DepsBalaoDemandas): Promise<BalaoPagina> {
  let balao: BalaoPagina | null = null;
  let conteudo: HTMLElement | null = null;
  let pergunta: { cancelar(): void } | null = null;
  let fechado = false;
  // Uma só pergunta, mesmo com duas gravações esperando (o `consentidor`).
  const perguntar = (): Promise<boolean> => {
    if (fechado || !conteudo) return Promise.resolve(false);
    const p = perguntarEntendi(conteudo, d.sigla);
    pergunta = p;
    return p.resposta.finally(() => {
      if (pergunta === p) pergunta = null;
    });
  };
  const repos: Readonly<Record<Vis, RepositorioDemandas>> = {
    unidade: comConsentimento(d.repos.unidade, consentidor(d.consentimento, perguntar)),
    eu: d.repos.eu,
  };
  const montar = (c: DadosConteudo): HTMLElement => {
    conteudo = montarConteudo(c, acoes);
    return conteudo;
  };
  const redesenhar = async (mensagem: string) => {
    const novos = await dados(x, d, mensagem);
    if (!fechado) balao?.trocar(montar(novos));
    return mensagem;
  };
  const acoes: AcoesConteudo = {
    fechar: () => balao?.fechar(),
    abrirNoPainel: (id) => {
      balao?.fechar();
      d.abrirNoPainel(id);
    },
    criar: async (p) => redesenhar(await criarDoProcesso(repos, p, d.eu)),
    iniciar: async (vis, id) => redesenhar(await iniciarDemanda(repos, vis, id)),
    concluir: async (vis, id, f) => redesenhar(await concluirComDocumento(repos, vis, id, f, x.processo, x.documento)),
  };
  balao = abrirBalaoNaPagina(ancora, montar(await dados(x, d)), {
    cssBase: d.cssBase,
    temaEscuro: d.temaEscuro,
    rotulo: `Demandas do processo ${x.processo.protocolo}`,
    aoFechar: () => {
      fechado = true;
      pergunta?.cancelar();
    },
  });
  return balao;
}
