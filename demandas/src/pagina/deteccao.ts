/**
 * O que a tela do SEI mostra agora (D17), lido SÓ do que o frame da árvore já desenhou: o processo (a mesma leitura da
 * árvore dos Favoritos e do Projetos, `lerArvore` sobre a própria página: nenhuma requisição) e o documento aberto no
 * visualizador (o nó selecionado da árvore; sem nó, o `id_documento` da URL do visualizador). É a mesma lógica do Gestor
 * de Atividades legado (`getIfrArvoreDadosProcesso`): protocolo e tipo do nó do processo, número SEI e rótulo do nó
 * selecionado. Buscar a árvore de um processo aberto na unidade grava "Processo recebido" em nome do usuário: nunca.
 */

import { type Arvore, lerArvore } from "@nucleo/dominio/arvore";
import { parametros } from "@nucleo/links/links";
import { paginaDe } from "@nucleo/sessao/pagina";
import { chaveProtocolo, RE_DOCUMENTO, RE_ID_PROCEDIMENTO } from "@projetos/modelo/vinculos";

export interface ProcessoNaTela {
  protocolo: string;
  idProcedimento?: string;
  sigiloso: boolean;
  /** O texto do nó do processo na árvore (o tipo do processo). A especificação só aparece na capa, que não se lê. */
  tipo?: string;
}

export interface DocumentoAberto {
  /** Número SEI (só dígitos). */
  numero: string;
  /** O nome do documento na árvore, sem o número ("Despacho"). */
  titulo: string;
  /** Documento de nível sigiloso (o processo pode ser público). */
  sigiloso: boolean;
}

export interface Detectado {
  processo: ProcessoNaTela;
  documento: DocumentoAberto | null;
}

/** O rótulo do nó desenhado: "Nome (número)". */
const ROTULO = /^(.*?)\s*\((\d{5,20})\)$/;

const limpo = (t: string | null | undefined) => (t ?? "").replace(/\s+/g, " ").trim();

export function processoDaArvore(a: Arvore): ProcessoNaTela {
  const p: ProcessoNaTela = { protocolo: a.protocolo.trim(), sigiloso: a.nivel === "sigiloso" };
  if (RE_ID_PROCEDIMENTO.test(a.idProcedimento)) p.idProcedimento = a.idProcedimento;
  if (a.tipo.trim()) p.tipo = a.tipo.trim();
  return p;
}

/** O id do documento do nó selecionado (`#anchor<id>`, ou o `id_documento` do endereço do nó). */
function idDoNoSelecionado(arvoreDoc: Document): { id: string; rotulo: string } | null {
  const sel = arvoreDoc.querySelector("#container .infraArvoreNoSelecionado, #divArvore .infraArvoreNoSelecionado");
  if (!sel) return null;
  const a = sel.closest("a") ?? sel;
  const doAnchor = /^anchor(\d+)$/.exec(a.id ?? "")?.[1];
  const doHref = a.getAttribute?.("href") ? parametros(a.getAttribute("href") ?? "").get("id_documento") : null;
  const id = doAnchor ?? doHref ?? "";
  return id ? { id, rotulo: limpo(sel.textContent) } : null;
}

/** O `id_documento` das URLs do visualizador (a do frame da barra e as dos frames aninhados). */
function idDasUrls(urls: readonly string[]): string {
  for (const u of urls) {
    const id = parametros(u).get("id_documento");
    if (id && /^\d+$/.test(id)) return id;
  }
  return "";
}

/**
 * O processo e o documento aberto; null sem os literais da árvore (a árvore ainda não chegou ao frame) ou sem número
 * de processo legível.
 */
export function detectarNaArvore(arvoreDoc: Document, urlArvore: string, urlsDoVisualizador: readonly string[] = []): Detectado | null {
  let arvore: Arvore;
  try {
    arvore = lerArvore(paginaDe(arvoreDoc, urlArvore));
  } catch {
    return null;
  }
  const processo = processoDaArvore(arvore);
  if (!chaveProtocolo(processo.protocolo)) return null;
  const no = idDoNoSelecionado(arvoreDoc);
  const id = no?.id ?? idDasUrls(urlsDoVisualizador);
  if (!id || id === arvore.idProcedimento) return { processo, documento: null };
  const d = arvore.documentos.find((x) => x.id === id);
  if (d) {
    if (d.cancelado || !RE_DOCUMENTO.test(d.numero)) return { processo, documento: null };
    return { processo, documento: { numero: d.numero, titulo: limpo(d.titulo), sigiloso: d.nivel === "sigiloso" } };
  }
  // Pasta ainda não carregada nos literais: o nó desenhado ("Nome (número)").
  const m = ROTULO.exec(no?.rotulo ?? "");
  if (m?.[2] && RE_DOCUMENTO.test(m[2])) return { processo, documento: { numero: m[2], titulo: limpo(m[1]), sigiloso: false } };
  return { processo, documento: null };
}
