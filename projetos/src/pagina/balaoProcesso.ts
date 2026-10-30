/**
 * O balão "Em N projetos" (caixa) e "Projetos deste processo" (árvore): lê os
 * dois escopos da unidade (uma leitura de cada), monta o conteúdo
 * (pagina/conteudo.ts) no balão em Shadow DOM (pagina/balao.ts) e, a cada
 * gravação feita nele, relê e redesenha no mesmo lugar, com a frase do que foi
 * feito.
 *
 * Gravar em "Toda a unidade" passa pelo MESMO consentimento da P4: o
 * repositório da unidade vai embrulhado em `comConsentimento` com o
 * `consentidor` (app/colaboracao/consentir.ts), e a pergunta é o aviso no próprio
 * balão (`perguntarEntendi`): "Entendi" grava o consentimento e segue, "Agora
 * não" não grava nada e o formulário fica como estava (com a mensagem da P4).
 * Fechar o balão com a pergunta aberta é "não".
 */

import type { PortaConsentimento } from "@comum/sincronia/consentimento";
import { comConsentimento, consentidor } from "../app/colaboracao/consentir";
import { montarUnidade } from "../app/dados";
import type { DataISO, Vis } from "../modelo/tipos";
import { chaveProtocolo, indiceDeProcessos } from "../modelo/vinculos";
import type { RepositorioProjetos } from "../repositorio";
import { adicionarAoProjeto, concluirComDocumento } from "./adicionar";
import { abrirBalaoNaPagina, type BalaoPagina } from "./balao";
import {
  type AcoesConteudo,
  type DadosConteudo,
  type DocumentoDaArvore,
  montarConteudo,
  type ProcessoNaTela,
  perguntarEntendi,
} from "./conteudo";

export interface DepsBalaoProcesso {
  modo: "caixa" | "arvore";
  repos: Readonly<Record<Vis, RepositorioProjetos>>;
  hoje(): DataISO;
  sigla: string;
  temaEscuro: boolean;
  cssBase: string;
  /** O "Entendi" do Texto Padrão da unidade (`consentimentoProjetos(..., "unidade")`). */
  consentimento: PortaConsentimento;
  /** Árvore: os documentos dos nós já desenhados; caixa: nenhum. */
  documentos(): DocumentoDaArvore[];
  abrirNoPainel(projeto: string, etapa?: string): void;
}

async function dados(processo: ProcessoNaTela, d: DepsBalaoProcesso, mensagem?: string): Promise<DadosConteudo> {
  const hoje = d.hoje();
  const [un, eu] = await Promise.all([d.repos.unidade.dados(), d.repos.eu.dados()]);
  const porVis = [
    { vis: "unidade" as const, dados: un },
    { vis: "eu" as const, dados: eu },
  ];
  const indice = indiceDeProcessos(porVis.map((x) => ({ vis: x.vis, projetos: x.dados.projetos, etapas: x.dados.etapas })));
  const saida: DadosConteudo = {
    modo: d.modo,
    processo,
    vinculos: indice.get(chaveProtocolo(processo.protocolo)) ?? [],
    projetos: montarUnidade(porVis, hoje).ativos,
    documentos: d.modo === "arvore" ? d.documentos() : [],
    hoje,
  };
  if (mensagem) saida.mensagem = mensagem;
  return saida;
}

export async function abrirBalaoProcesso(ancora: HTMLElement, processo: ProcessoNaTela, d: DepsBalaoProcesso): Promise<BalaoPagina> {
  let balao: BalaoPagina | null = null;
  let conteudo: HTMLElement | null = null;
  let pergunta: { cancelar(): void } | null = null;
  let fechado = false;
  // A pergunta do consentimento da P4, no balão: uma só, mesmo com duas gravações esperando (o `consentidor`).
  const perguntar = (): Promise<boolean> => {
    if (fechado || !conteudo) return Promise.resolve(false);
    const p = perguntarEntendi(conteudo, d.sigla);
    pergunta = p;
    return p.resposta.finally(() => {
      if (pergunta === p) pergunta = null;
    });
  };
  const repos: Readonly<Record<Vis, RepositorioProjetos>> = {
    unidade: comConsentimento(d.repos.unidade, consentidor(d.consentimento, perguntar)),
    eu: d.repos.eu,
  };
  const montar = (x: DadosConteudo): HTMLElement => {
    conteudo = montarConteudo(x, acoes);
    return conteudo;
  };
  const redesenhar = async (mensagem: string) => {
    const novos = await dados(processo, d, mensagem);
    if (!fechado) balao?.trocar(montar(novos));
    return mensagem;
  };
  const acoes: AcoesConteudo = {
    fechar: () => balao?.fechar(),
    abrirNoPainel: (projeto, etapa) => {
      balao?.fechar();
      // Ainda dentro do clique: o lateral (na árvore) precisa do gesto do usuário.
      d.abrirNoPainel(projeto, etapa);
    },
    adicionar: async (p) => redesenhar(await adicionarAoProjeto(repos, p, d.hoje())),
    concluir: async (vis, etapa, documento, data) => redesenhar(await concluirComDocumento(repos, vis, etapa, documento, data)),
  };
  balao = abrirBalaoNaPagina(ancora, montar(await dados(processo, d)), {
    cssBase: d.cssBase,
    temaEscuro: d.temaEscuro,
    rotulo: d.modo === "arvore" ? "Projetos deste processo" : `Projetos do processo ${processo.protocolo}`,
    aoFechar: () => {
      fechado = true;
      pergunta?.cancelar();
    },
  });
  return balao;
}
