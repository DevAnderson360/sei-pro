/**
 * Validação dos dados que o usuário digita (spec 5.4 e 9). Devolve a lista de
 * mensagens; vazia = válido. O repositório lança `ErroValidacao` com ela, e o
 * diálogo mostra as mensagens como vieram.
 */

import { diferencaDias } from "@comum/datas/dias";
import { normalizarTexto } from "@comum/texto";
import { ANO_MAX, ANO_MIN, dataNaFaixa, dataValida, LIMITE_DIAS_ETAPA, MAX_DIAS_UTEIS } from "./calendario";
import { LIMITES } from "./constantes";
import type { Etapa, ItemChecklist, Modelo, Projeto } from "./tipos";
import { RE_DOCUMENTO } from "./vinculos";

export class ErroValidacao extends Error {
  constructor(readonly mensagens: string[]) {
    super(mensagens.join(" "));
    this.name = "ErroValidacao";
  }
}

/**
 * Forma de todo id guardado ou referenciado (etapa, fase, projeto, dependência, alvo do histórico).
 * A Frappe usa o id em seletor CSS e troca o que não casa (espaço vira "_", a linha fica inerte) e
 * junta as dependências por vírgula. `novoId()` (UUID) casa.
 */
export const RE_ID = /^[A-Za-z0-9_-]{1,64}$/;

export function idValido(x: unknown): x is string {
  return typeof x === "string" && RE_ID.test(x);
}

/** Espaços nas pontas fora e espaços repetidos viram um. */
export function nomeLimpo(s: string): string {
  return s.replace(/\s+/g, " ").trim();
}

/** Sem vazias e sem repetidas (comparando sem acento e sem caixa); a primeira grafia fica. */
export function etiquetasLimpas(lista: readonly string[]): string[] {
  const vistas = new Set<string>();
  const saida: string[] = [];
  for (const bruta of lista) {
    const e = nomeLimpo(bruta);
    const chave = normalizarTexto(e);
    if (!e || vistas.has(chave)) continue;
    vistas.add(chave);
    saida.push(e);
  }
  return saida;
}

/** Itens sem texto saem; o texto perde os espaços das pontas. */
export function checklistLimpo(itens: readonly ItemChecklist[]): ItemChecklist[] {
  return itens.map((i) => ({ ...i, texto: nomeLimpo(i.texto) })).filter((i) => i.texto);
}

function problemasDoNome(nome: string, vazio: string): string[] {
  const n = nomeLimpo(nome);
  if (!n) return [vazio];
  if (n.length > LIMITES.nome) return [`O nome pode ter até ${LIMITES.nome} caracteres.`];
  return [];
}

function problemasDasEtiquetas(etiquetas: readonly string[]): string[] {
  const saida: string[] = [];
  if (etiquetas.length > LIMITES.etiquetas) saida.push(`Use até ${LIMITES.etiquetas} etiquetas.`);
  if (etiquetas.some((e) => e.length > LIMITES.etiquetaTexto))
    saida.push(`Cada etiqueta pode ter até ${LIMITES.etiquetaTexto} caracteres.`);
  return saida;
}

export function problemasDoProjeto(p: Pick<Projeto, "nome" | "etiquetas">): string[] {
  return [...problemasDoNome(p.nome, "Informe o nome do projeto."), ...problemasDasEtiquetas(p.etiquetas)];
}

/**
 * Datas de uma etapa (digitação): existem, ficam entre `ANO_MIN` e `ANO_MAX`, o término não vem antes
 * do início e a etapa não passa de `LIMITE_DIAS_ETAPA` dias corridos. Vazia = válidas.
 */
export function problemasDasDatas(inicio: unknown, fim: unknown): string[] {
  if (!dataValida(inicio) || !dataValida(fim)) return ["Informe datas válidas."];
  if (!dataNaFaixa(inicio) || !dataNaFaixa(fim)) return [`Use datas entre ${ANO_MIN} e ${ANO_MAX}.`];
  if (fim < inicio) return ["O término não pode ser antes do início."];
  if (diferencaDias(inicio, fim) > LIMITE_DIAS_ETAPA) return ["A etapa pode durar no máximo cerca de 10 anos."];
  return [];
}

/**
 * O documento que comprova a etapa, com a regra da importação (`entidadeValida`) e do diálogo: número vazio (sem
 * documento, ou o marcador do documento de processo sigiloso) ou só dígitos, de 1 a 20 (`RE_DOCUMENTO`); título
 * de até 200; marca de sigilo booleana. Quem grava pelo repositório sem o diálogo (o Agente) cai aqui.
 */
export function problemasDoDocumento(d: unknown): string[] {
  const o = d as { numero?: unknown; titulo?: unknown; sigiloso?: unknown } | null;
  if (!o || typeof o !== "object" || typeof o.numero !== "string" || (o.numero !== "" && !RE_DOCUMENTO.test(o.numero)))
    return ["Número de documento inválido."];
  if (o.titulo !== undefined && (typeof o.titulo !== "string" || o.titulo.length > LIMITES.nome))
    return [`O título do documento pode ter até ${LIMITES.nome} caracteres.`];
  if (o.sigiloso !== undefined && typeof o.sigiloso !== "boolean") return ["Número de documento inválido."];
  return [];
}

/** Os tetos de texto são os mesmos de `entidadeValida` (importação): o que se grava aqui sincroniza. */
export function problemasDaEtapa(
  e: Pick<Etapa, "nome" | "inicio" | "fim" | "progresso" | "checklist" | "etiquetas" | "observacoes" | "responsavel" | "documento">,
): string[] {
  const saida = problemasDoNome(e.nome, "Informe o nome da etapa.");
  saida.push(...problemasDasDatas(e.inicio, e.fim));
  if (!Number.isFinite(e.progresso) || e.progresso < 0 || e.progresso > 100) saida.push("O progresso vai de 0 a 100.");
  if (e.checklist.length > LIMITES.checklistItens) saida.push(`O checklist pode ter até ${LIMITES.checklistItens} itens.`);
  if (e.checklist.some((i) => i.texto.length > LIMITES.checklistTexto))
    saida.push(`Cada item do checklist pode ter até ${LIMITES.checklistTexto} caracteres.`);
  saida.push(...problemasDasEtiquetas(e.etiquetas));
  if ((e.observacoes ?? "").length > LIMITES.observacoes) saida.push("As observações podem ter até 2.000 caracteres.");
  if ((e.responsavel?.nome ?? "").length > LIMITES.nome) saida.push(`O nome do responsável pode ter até ${LIMITES.nome} caracteres.`);
  if ((e.responsavel?.login ?? "").length > LIMITES.rotulo) saida.push("O login do responsável é longo demais.");
  if (e.documento !== undefined) saida.push(...problemasDoDocumento(e.documento));
  return saida;
}

function inteiroNaFaixa(n: unknown, max: number): boolean {
  return typeof n === "number" && Number.isInteger(n) && n >= 0 && n <= max;
}

/**
 * Forma do conteúdo de um modelo, sem confiar nos tipos: o modelo pode vir de um
 * Texto Padrão da unidade editado à mão. É a mesma regra do cadastro e da importação.
 */
export function problemasDaEstruturaDoModelo(fases: unknown, etapas: unknown): string[] {
  if (!Array.isArray(fases) || !Array.isArray(etapas)) return ["O modelo precisa de lista de fases e de etapas."];
  const saida: string[] = [];
  if (fases.length > LIMITES.etapasPorProjeto) saida.push(`Um modelo pode ter até ${LIMITES.etapasPorProjeto} fases.`);
  if (fases.some((f) => typeof f !== "string")) saida.push("Toda fase do modelo precisa ser um texto.");
  else if (fases.some((f) => (f as string).length > LIMITES.nome)) saida.push(`O nome pode ter até ${LIMITES.nome} caracteres.`);
  if (etapas.length > LIMITES.etapasPorProjeto) {
    saida.push(`Um modelo pode ter até ${LIMITES.etapasPorProjeto} etapas.`);
    return saida;
  }
  etapas.forEach((e: unknown, i) => {
    if (!e || typeof e !== "object") {
      saida.push("Toda etapa do modelo precisa ser um objeto.");
      return;
    }
    const x = e as Record<string, unknown>;
    if (typeof x.nome !== "string" || !nomeLimpo(x.nome)) saida.push("Toda etapa do modelo precisa de nome.");
    else if (x.nome.length > LIMITES.nome) saida.push(`O nome pode ter até ${LIMITES.nome} caracteres.`);
    if (!inteiroNaFaixa(x.aPartirDe, MAX_DIAS_UTEIS) || !inteiroNaFaixa(x.duracao, MAX_DIAS_UTEIS))
      saida.push(`As durações do modelo são números inteiros de 0 a ${MAX_DIAS_UTEIS} dias úteis.`);
    if (x.fase !== undefined && !(typeof x.fase === "number" && Number.isInteger(x.fase) && x.fase >= 0 && x.fase < fases.length))
      saida.push("Etapa do modelo aponta para uma fase que não existe.");
    if (
      !Array.isArray(x.dependeDe) ||
      x.dependeDe.some((d) => typeof d !== "number" || !Number.isInteger(d) || d < 0 || d >= etapas.length || d === i)
    )
      saida.push("Etapa do modelo depende de uma etapa que não existe ou dela mesma.");
    if (!Array.isArray(x.checklist) || x.checklist.some((t) => typeof t !== "string" || t.length > LIMITES.checklistTexto))
      saida.push(`Cada item do checklist do modelo é um texto de até ${LIMITES.checklistTexto} caracteres.`);
    else if (x.checklist.length > LIMITES.checklistItens) saida.push(`O checklist pode ter até ${LIMITES.checklistItens} itens.`);
  });
  return saida;
}

export function problemasDoModelo(m: Pick<Modelo, "nome" | "fases" | "etapas" | "descricao">): string[] {
  const saida = [...problemasDoNome(m.nome, "Informe o nome do modelo."), ...problemasDaEstruturaDoModelo(m.fases, m.etapas)];
  if ((m.descricao ?? "").length > LIMITES.observacoes) saida.push("A descrição pode ter até 2.000 caracteres.");
  return [...new Set(saida)];
}
