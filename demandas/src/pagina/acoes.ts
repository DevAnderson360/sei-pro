/**
 * O que o balão grava (D17): "Nova demanda deste processo", "Iniciar" e "Concluir com este documento…". Tudo passa pelo
 * repositório (que valida, carimba e anota o histórico), com as transições da D2. Quem chama passa os repositórios com o
 * "Entendi" da unidade (`comConsentimento`). O que se sabe de antemão que não vai gravar é dito ANTES do método que grava:
 * o "Entendi" não é pedido à toa.
 */

import { chaveProtocolo, RE_DOCUMENTO, RE_ID_PROCEDIMENTO, RE_PROTOCOLO } from "@projetos/modelo/vinculos";
import { mensagemDoErro } from "../app/erros";
import { dataDeFormulario, dataLonga, lerTempo } from "../app/formato";
import { LIMITES } from "../modelo/constantes";
import { concluir, iniciar } from "../modelo/operacoes";
import { situacaoDe } from "../modelo/situacao";
import type { DocumentoSei, Prioridade, Responsavel, Vinculo, Vis } from "../modelo/tipos";
import { ErroValidacao } from "../modelo/validacao";
import type { RepositorioDemandas } from "../repositorio";
import type { DocumentoAberto, ProcessoNaTela } from "./deteccao";

export { mensagemDoErro };

type Repos = Readonly<Record<Vis, RepositorioDemandas>>;

export interface PedidoNova {
  vis: Vis;
  titulo: string;
  prazo: string;
  prioridade: Prioridade;
  /** Só em "Toda a unidade"; em "Só eu" o responsável é o próprio usuário. */
  responsavel?: Responsavel;
  processo: ProcessoNaTela;
}

export interface FormConclusao {
  data: string;
  tempo: string;
  observacao: string;
  /** Número SEI do documento entregue (vazio: sem documento). */
  numero: string;
  titulo: string;
}

const nomeDoEscopo = (vis: Vis) => (vis === "unidade" ? "Toda a unidade" : "Só eu");

/** O vínculo do processo da tela na forma que os colegas aceitam; o sigilo da tela vai junto (o número fica só aqui). */
export function vinculoDaTela(p: ProcessoNaTela): Vinculo {
  const protocolo = typeof p.protocolo === "string" ? p.protocolo.trim() : "";
  if (!RE_PROTOCOLO.test(protocolo) || !chaveProtocolo(protocolo))
    throw new ErroValidacao("processos", "Não foi possível ler o número deste processo na tela do SEI.");
  const v: Vinculo = { protocolo };
  if (p.idProcedimento && RE_ID_PROCEDIMENTO.test(p.idProcedimento)) v.idProcedimento = p.idProcedimento;
  if (p.sigiloso) v.sigiloso = true;
  return v;
}

/** O nome do documento sem o número: tira "(0104018)" e o número solto no fim ("Despacho 0104018"), qualquer que seja o formato do nó. */
export function tipoSemNumero(titulo: string, numero: string): string {
  let t = (titulo ?? "").replace(/\s*\(\d{5,20}\)\s*$/, "").trim();
  if (numero && t.endsWith(numero) && (t.length === numero.length || /\s/.test(t[t.length - numero.length - 1] ?? "")))
    t = t.slice(0, t.length - numero.length).trim();
  return t;
}

/**
 * O título sugerido: "<nome do documento> <nº SEI>" com documento aberto; senão o texto do nó do processo. Documento
 * sigiloso: vazio. Processo sigiloso: só o tipo do documento, sem o número (o título nunca passa pelo corte do sigilo).
 */
export function tituloSugerido(processo: ProcessoNaTela, documento: DocumentoAberto | null): string {
  if (documento?.sigiloso) return "";
  const nome = documento ? tipoSemNumero(documento.titulo, documento.numero) : "";
  if (processo.sigiloso) return nome.slice(0, LIMITES.titulo);
  const t = documento ? `${nome} ${documento.numero}`.trim() : (processo.tipo ?? "").trim();
  return t.slice(0, LIMITES.titulo);
}

/** O número do documento entregue é sigiloso quando o processo é, ou quando é o documento sigiloso da tela. */
function documentoEntregue(f: FormConclusao, processo: ProcessoNaTela, aberto: DocumentoAberto | null): DocumentoSei | undefined {
  const numero = f.numero.trim();
  if (!numero) return undefined;
  if (!RE_DOCUMENTO.test(numero)) throw new ErroValidacao("documento", "Número de documento inválido (só dígitos, até 20).");
  const doc: DocumentoSei = { numero };
  const titulo = f.titulo.trim().slice(0, LIMITES.titulo);
  if (titulo) doc.titulo = titulo;
  if (processo.sigiloso || (aberto?.numero === numero && aberto.sigiloso)) doc.sigiloso = true;
  return doc;
}

export async function criarDoProcesso(repos: Repos, p: PedidoNova, eu: Responsavel): Promise<string> {
  const prazo = dataDeFormulario(p.prazo);
  if (!prazo) throw new ErroValidacao("prazo", "Informe um prazo válido (dia/mês/ano).");
  const processo = vinculoDaTela(p.processo);
  const repo = repos[p.vis];
  const responsavel = p.vis === "eu" ? eu : p.responsavel;
  const d = await repo.criar({
    titulo: p.titulo,
    ...(responsavel ? { responsavel } : {}),
    prazo,
    prioridade: p.prioridade,
    processos: [processo],
  });
  // O sigilo da tela vale já: a memória do sigilo e a marca no vínculo (o número não vai ao Texto Padrão).
  if (processo.sigiloso) await repo.marcarSigilosos([processo.protocolo]).catch(() => undefined);
  return `Demanda “${d.titulo}” criada (${nomeDoEscopo(p.vis)}), prazo ${dataLonga(d.prazo)}.`;
}

export async function iniciarDemanda(repos: Repos, vis: Vis, id: string): Promise<string> {
  const atual = await repos[vis].obter(id);
  if (!atual) throw new ErroValidacao("id", "Esta demanda não existe mais.");
  if (situacaoDe(atual) !== "nao_iniciada") throw new ErroValidacao("situacao", "Esta demanda já foi iniciada.");
  const d = await repos[vis].aplicar(id, (x, c) => iniciar(x, c));
  return `“${d.titulo}” iniciada.`;
}

export async function concluirComDocumento(
  repos: Repos,
  vis: Vis,
  id: string,
  f: FormConclusao,
  processo: ProcessoNaTela,
  aberto: DocumentoAberto | null,
): Promise<string> {
  const data = dataDeFormulario(f.data);
  if (!data) throw new ErroValidacao("data", "Informe uma data de conclusão válida.");
  const tempo = lerTempo(f.tempo);
  if (tempo === null) throw new ErroValidacao("tempo", "Tempo gasto inválido. Use 1h30, 1:30, 45min ou só os minutos.");
  const documento = documentoEntregue(f, processo, aberto);
  const atual = await repos[vis].obter(id);
  if (!atual) throw new ErroValidacao("id", "Esta demanda não existe mais.");
  const s = situacaoDe(atual);
  if (s !== "iniciada" && s !== "pausada") throw new ErroValidacao("situacao", "Só uma demanda iniciada ou pausada pode ser concluída.");
  if (data < atual.distribuidaEm)
    throw new ErroValidacao("data", `A conclusão não pode ser antes da distribuição (${dataLonga(atual.distribuidaEm)}).`);
  const observacao = f.observacao.trim();
  const d = await repos[vis].aplicar(id, (x, c) =>
    concluir(
      x,
      {
        data,
        ...(tempo !== undefined ? { tempoGastoMin: tempo } : {}),
        ...(observacao ? { observacao } : {}),
        ...(documento ? { documento } : {}),
      },
      c,
    ),
  );
  return `“${d.titulo}” concluída em ${dataLonga(data)}.`;
}
