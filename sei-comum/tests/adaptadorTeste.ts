/**
 * Um módulo de mentira para as provas da sincronia genérica: itens
 * versionados num Map (o "repositório"), o envelope
 * `{ formato: "teste", versao: 1, dono, itens }` e a mesclagem de verdade
 * (`vence`) da sei-comum.
 */

import type { AdaptadorArquivo } from "../src/sincronia/arquivo";
import { assinaturaEstavel, porId } from "../src/sincronia/assinatura";
import { purgarLapides, type Versionada, vence } from "../src/sincronia/entidade";
import type { AdaptadorTexto, ConferenciaTexto, ResultadoGravacao } from "../src/sincronia/motor";
import { gerarConteudoTexto, lerConteudoTexto, versaoMaisNova } from "../src/sincronia/textoPadraoCodec";

export interface ItemTeste extends Versionada {
  valor: string;
}

export interface EnvTeste {
  formato: "teste";
  versao: number;
  dono: string;
  itens: ItemTeste[];
}

export interface RepoTeste {
  itens: Map<string, ItemTeste>;
  por(id: string, valor: string, quando: number, dispositivo?: string): void;
  remover(id: string, quando: number): void;
  importar(env: EnvTeste): void;
  aoMudar(cb: () => void): () => void;
}

export function repoTeste(): RepoTeste {
  const itens = new Map<string, ItemTeste>();
  const ouvintes = new Set<() => void>();
  const avisar = () => {
    for (const o of [...ouvintes]) o();
  };
  return {
    itens,
    por(id, valor, quando, dispositivo = "A") {
      itens.set(id, { id, valor, atualizadoEm: quando, dispositivo });
      avisar();
    },
    remover(id, quando) {
      const i = itens.get(id);
      if (!i) return;
      itens.set(id, { ...i, atualizadoEm: quando, removidoEm: quando });
      avisar();
    },
    importar(env) {
      let mudou = false;
      for (const i of env.itens) {
        const atual = itens.get(i.id);
        if (!atual || vence(i, atual)) {
          itens.set(i.id, i);
          mudou = true;
        }
      }
      if (mudou) avisar();
    },
    aoMudar(cb) {
      ouvintes.add(cb);
      return () => {
        ouvintes.delete(cb);
      };
    },
  };
}

/** O que o motor passou a cada `exportar` (as provas conferem o "inválido" x "inexistente"). */
export type ChamadaExportar = Parameters<AdaptadorTexto<EnvTeste>["exportar"]>[0];

export function adaptadorTeste(
  repo: RepoTeste,
  o: {
    dono?: string;
    teto?: number;
    aviso?: number;
    chaveStatus?: string;
    diasLapide?: number;
    antesDeRegravarInvalido?: AdaptadorTexto<EnvTeste>["antesDeRegravarInvalido"];
    aoExportar?: (c: ChamadaExportar) => void;
    /** Ensina ao motor o "nada a guardar" (sem itens): sem texto no SEI, não cria. */
    vazio?: boolean;
    /** Ensina ao motor o texto lido como este adaptador o gravaria (a mesma poda de lápides do `exportar`). */
    normalizar?: boolean;
    mensagens?: AdaptadorTexto<EnvTeste>["mensagens"];
  } = {},
): AdaptadorTexto<EnvTeste> {
  const dono = o.dono ?? "pedro";
  const podar = (itens: ItemTeste[], agora: number) => (o.diasLapide === undefined ? itens : purgarLapides(itens, agora, o.diasLapide));
  return {
    ...(o.antesDeRegravarInvalido ? { antesDeRegravarInvalido: o.antesDeRegravarInvalido } : {}),
    ...(o.vazio ? { vazio: (env: EnvTeste) => env.itens.length === 0 } : {}),
    ...(o.normalizar ? { normalizar: async (lido: EnvTeste, agora: number) => ({ ...lido, itens: podar(lido.itens, agora) }) } : {}),
    ...(o.mensagens ? { mensagens: o.mensagens } : {}),
    modulo: "teste",
    chaveStatus: o.chaveStatus ?? "teste/sync/tp/a",
    teto: o.teto ?? 100 * 1024,
    aviso: o.aviso ?? 80 * 1024,
    legivel: () => "Dados internos do SEI Pro (teste). Não edite.",
    validar(bruto) {
      if (versaoMaisNova(bruto, "teste", 1)) return { maisNovo: true };
      const b = bruto as Partial<EnvTeste> | null;
      if (b?.formato !== "teste" || b.versao !== 1 || !Array.isArray(b.itens)) return { invalido: "não é do módulo de teste" };
      if (b.dono !== dono) return { invalido: "é de outro dono" };
      return { ok: b as EnvTeste };
    },
    async importar(env) {
      repo.importar(env);
    },
    async exportar(c) {
      o.aoExportar?.(c);
      return { formato: "teste", versao: 1, dono, itens: podar([...repo.itens.values()], c.agora) };
    },
    assinatura: (env) => assinaturaEstavel({ dono: env.dono, itens: porId(env.itens) }),
  };
}

/** O texto que outro computador (ou um colega) gravaria com estes itens. */
export function textoDeOutro(itens: ItemTeste[], dono = "pedro", versao = 1): Promise<string> {
  return gerarConteudoTexto("Dados internos do SEI Pro (teste).", { formato: "teste", versao, dono, itens });
}

/** Os itens guardados num texto (vazio se o texto não é do módulo de teste). */
export async function itensDoTexto(html: string | null): Promise<ItemTeste[]> {
  if (html === null) return [];
  const r = await lerConteudoTexto(html);
  return "bruto" in r ? ((r.bruto as EnvTeste).itens ?? []) : [];
}

export const item = (id: string, quando: number, dispositivo = "B", removido = false): ItemTeste => ({
  id,
  valor: id,
  atualizadoEm: quando,
  dispositivo,
  ...(removido ? { removidoEm: quando } : {}),
});

/** O Texto Padrão "no SEI": conta leituras e gravações; `aoLer` muda o texto como outra pessoa faria. */
export function destinoTeste(inicial: string | null = null) {
  const d = {
    html: inicial,
    lidas: 0,
    gravadas: 0,
    aoLer: undefined as ((n: number) => Promise<void> | void) | undefined,
    erro: undefined as { codigo: string; message: string } | undefined,
    async ler(): Promise<string | null> {
      d.lidas++;
      await d.aoLer?.(d.lidas);
      if (d.erro) throw Object.assign(new Error(d.erro.message), { codigo: d.erro.codigo });
      return d.html;
    },
    async gravar(html: string): Promise<void> {
      d.gravadas++;
      d.html = html;
    },
  };
  return d;
}

/**
 * O Texto Padrão "no SEI" que confere na gravação (como o armazém do núcleo): `aoConferir` muda o texto
 * logo antes da n-ésima conferência, como um colega gravando (ou apagando) no meio.
 */
export function destinoConferindo(inicial: string | null = null) {
  const d = {
    html: inicial,
    lidas: 0,
    gravadas: 0,
    conferencias: 0,
    aoConferir: undefined as ((n: number) => Promise<void> | void) | undefined,
    async ler(): Promise<string | null> {
      d.lidas++;
      return d.html;
    },
    async gravar(html: string): Promise<void> {
      d.gravadas++;
      d.html = html;
    },
    async gravarConferindo(html: string, c: ConferenciaTexto): Promise<ResultadoGravacao> {
      d.conferencias++;
      await d.aoConferir?.(d.conferencias);
      if (!c.mesmo(d.html, c.anterior)) return { gravado: false, atual: d.html };
      d.gravadas++;
      d.html = html;
      return { gravado: true };
    },
  };
  return d;
}

/** O arquivo de teste: uma lista por dono (o mesmo arquivo pode ter sido escolhido por outro usuário). */
export interface EnvArquivoTeste {
  formato: "teste";
  versao: number;
  donos: Array<{ dono: string; itens: ItemTeste[] }>;
}

export function adaptadorArquivoTeste(repo: RepoTeste, dono: string): AdaptadorArquivo<EnvArquivoTeste> {
  return {
    formato: "teste",
    versao: 1,
    ler(bruto) {
      const b = bruto as Partial<EnvArquivoTeste> | null;
      return b?.formato === "teste" && b.versao === 1 && Array.isArray(b.donos) ? (b as EnvArquivoTeste) : null;
    },
    async importar(env) {
      for (const d of env.donos) if (d.dono === dono) repo.importar({ formato: "teste", versao: 1, dono, itens: d.itens });
    },
    async exportar(lido) {
      const outros = (lido?.donos ?? []).filter((d) => d.dono !== dono);
      return {
        envelope: { formato: "teste", versao: 1, donos: [{ dono, itens: [...repo.itens.values()] }, ...outros] },
        outros: outros.length,
      };
    },
    assinatura: (env) =>
      assinaturaEstavel(
        env.donos.map((d) => ({ dono: d.dono, itens: porId(d.itens) })).sort((a, b) => (a.dono < b.dono ? -1 : a.dono > b.dono ? 1 : 0)),
      ),
  };
}
