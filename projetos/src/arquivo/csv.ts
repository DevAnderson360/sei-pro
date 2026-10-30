/**
 * "Exportar planilha (CSV)" (spec 3.1): uma linha por etapa dos projetos da
 * aba aberta, com o filtro aplicado. Processo sigiloso sai em branco (spec 9),
 * inclusive quando a etapa herdaria o do projeto; o número do documento de
 * etapa sigilosa (processo próprio sigiloso, ou nenhum num projeto sigiloso) ou
 * marcado sigiloso também. "Sigiloso" é a regra do envelope (modelo/sigilo.ts:
 * a marca, o mesmo número marcado noutro item da planilha) somada à memória do
 * sigilo deste computador (`conhecidos`, que quem chama lê pelo repositório):
 * um projeto "Só eu" com o número sem a marca, que a memória conhece, sai em
 * branco. `gerarCsv` (sei-comum) põe o BOM, o separador ";" e neutraliza
 * fórmulas (= + - @).
 */

import { gerarCsv } from "@comum/csv";
import { formatarData } from "@comum/datas/dias";
import { normalizarTexto } from "@comum/texto";
import type { ProjetoNaTela } from "../app/dados";
import { duracaoUteis } from "../modelo/calendario";
import { rotuloDaVis } from "../modelo/escopo";
import { progressoDaEtapa } from "../modelo/progresso";
import { etapaSigilosa, NADA_CONHECIDO, type SigiloDoEnvelope, type SigilosConhecidos, sigiloDoEnvelope } from "../modelo/sigilo";
import { ROTULO_MARCO, ROTULO_SITUACAO, situacaoEtapa, situacaoMarco } from "../modelo/situacao";
import type { DataISO, Etapa, Vinculo } from "../modelo/tipos";
import { chaveDocumento } from "../modelo/vinculos";

const CABECALHO = [
  "Projeto",
  "Quem vê",
  "Processo",
  "Fase",
  "Etapa",
  "Marco",
  "Responsável",
  "Início",
  "Término",
  "Dias úteis",
  "Situação",
  "Progresso (%)",
  "Concluída em",
  "Documento SEI",
  "Etiquetas",
  "Observações",
];

/** O número do processo, ou vazio se é sigiloso pela regra `s`. */
const numero = (v: Vinculo | undefined, s: SigiloDoEnvelope): string => (v && !s.vinculo(v) ? v.protocolo : "");

/** O número do documento, ou vazio se ele está marcado ou é conhecido como sigiloso, ou se a etapa é sigilosa. */
function numeroDoDocumento(p: ProjetoNaTela, e: Etapa, s: SigiloDoEnvelope): string {
  const d = e.documento;
  if (!d || d.sigiloso || etapaSigilosa(e, p.projeto, s) || s.documentos.has(chaveDocumento(d.numero))) return "";
  return d.numero;
}

function linhaDaEtapa(p: ProjetoNaTela, e: Etapa, hoje: DataISO, s: SigiloDoEnvelope): string[] {
  const fase = p.fases.find((f) => f.id === e.fase)?.nome ?? "";
  const situacao = e.marco ? ROTULO_MARCO[situacaoMarco(e, hoje)] : ROTULO_SITUACAO[situacaoEtapa(e, hoje)];
  return [
    p.projeto.nome,
    rotuloDaVis(p.vis),
    numero(e.processo ?? p.projeto.processo, s),
    fase,
    e.nome,
    e.marco ? "sim" : "",
    e.responsavel?.nome ?? "",
    formatarData(e.inicio),
    e.marco ? "" : formatarData(e.fim),
    e.marco ? "0" : String(duracaoUteis(e.inicio, e.fim)),
    situacao,
    String(progressoDaEtapa(e, hoje)),
    e.concluidaEm ? formatarData(e.concluidaEm) : "",
    numeroDoDocumento(p, e, s),
    e.etiquetas.join(", "),
    e.observacoes ?? "",
  ];
}

/**
 * `itens` já vêm com as etapas que passam no filtro. Projeto sem etapas sai numa linha só. `conhecidos`: a memória do
 * sigilo deste computador (`RepositorioProjetos.sigilosConhecidos`).
 */
export function csvDosProjetos(itens: readonly ProjetoNaTela[], hoje: DataISO, conhecidos: SigilosConhecidos = NADA_CONHECIDO): string {
  const s = sigiloDoEnvelope(
    itens.map((p) => p.projeto),
    itens.flatMap((p) => p.etapas),
    conhecidos,
  );
  const linhas: string[][] = [CABECALHO];
  for (const p of itens) {
    if (!p.etapas.length) {
      linhas.push([p.projeto.nome, rotuloDaVis(p.vis), numero(p.projeto.processo, s), ...CABECALHO.slice(3).map(() => "")]);
      continue;
    }
    for (const e of p.etapas) linhas.push(linhaDaEtapa(p, e, hoje, s));
  }
  return gerarCsv(linhas);
}

/** "projeto-<nome>-<data>.csv" (aba de um projeto) ou "projetos-<data>.csv" (Todos). */
export function nomeDoCsv(nomeDoProjeto: string | null, hoje: DataISO): string {
  if (!nomeDoProjeto) return `projetos-${hoje}.csv`;
  const base =
    normalizarTexto(nomeDoProjeto)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 50) || "projeto";
  return `projeto-${base}-${hoje}.csv`;
}
