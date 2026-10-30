/**
 * Lê as demais páginas do Controle de Processos em segundo plano. O SEI guarda a página atual na sessão do usuário,
 * então SEMPRE devolvemos para a página 0 no fim (mesmo com erro ou cancelamento): senão o próximo F5 do usuário
 * abriria no meio da lista.
 */
import { Formulario } from '../../../sei-nucleo/src/formulario/formulario';
import type { Http, Pagina } from '../../../sei-nucleo/src/sessao/http';
import { lerTabelas } from '../leitura/tabela';
import type { Grupo, LeituraTabela, Processo, SelecaoDaPagina } from '../modelo/tipos';

export interface Fonte {
  /** Documento da página `n` (a partir de 1) do grupo. */
  pagina(grupo: Grupo, n: number, sinal?: AbortSignal): Promise<Document>;
  /** Volta a página do usuário para a primeira. */
  restaurar(sinal?: AbortSignal): Promise<void>;
  /** Quando a aba fecha ou navega no meio da carga: pedido que sobrevive a descarga da pagina (keepalive). */
  restaurarAoSair?(): void;
}

export interface Progresso {
  grupo: Grupo;
  /** Páginas já lidas e total estimado (a partir do que o SEI informa no caption). */
  paginasLidas: number;
  paginasTotal: number;
  processos: number;
  total: number;
}

export interface ResultadoCarga {
  /** Só os processos das páginas extras (a página 0 já está na leitura inicial). */
  processos: Processo[];
  /** Cobriu tudo que o SEI disse existir. Falso com erro, cancelamento ou teto de páginas. */
  completo: boolean;
  erro?: string;
}

/** Teto de segurança por grupo: 100 por página * 60 = 6 000 processos. */
export const MAX_PAGINAS = 60;

export async function carregarRestante(
  inicial: LeituraTabela,
  fonte: Fonte,
  o: { aoProgresso?: (p: Progresso) => void; aoPagina?: (novos: Processo[]) => void; aoSelecao?: (grupo: Grupo | 'detalhado', pagina: number, s: SelecaoDaPagina) => void; sinal?: AbortSignal; maxPaginas?: number } = {},
): Promise<ResultadoCarga> {
  const max = o.maxPaginas ?? MAX_PAGINAS;
  const novos: Processo[] = [];
  const conhecidos = new Set(inicial.processos.map((p) => p.id));
  let completo = true;
  let erro: string | undefined;
  let paginou = false;

  try {
    for (const grupo of ['recebidos', 'gerados'] as const) {
      const total = inicial.totais[grupo];
      let lidos = inicial.processos.filter((p) => p.grupo === grupo).length;
      const porPagina = inicial.porPagina[grupo] || lidos || 1;
      const paginasTotal = Math.max(1, Math.ceil(total / porPagina));
      for (let n = 1; lidos < total; n += 1) {
        if (o.sinal?.aborted) {
          completo = false;
          return { processos: novos, completo, ...(erro ? { erro } : {}) };
        }
        if (n >= max) {
          completo = false;
          break;
        }
        paginou = true;
        const doc = await fonte.pagina(grupo, n, o.sinal);
        const leitura = lerTabelas(doc, { pagina: n, naPaginaAtual: false });
        const daPagina = leitura.processos.filter((p) => p.grupo === grupo && !conhecidos.has(p.id));
        if (!daPagina.length) break; // página vazia (ou só repetidos): acabou, ou o SEI não pagina mais
        for (const p of daPagina) conhecidos.add(p.id);
        lidos += daPagina.length;
        novos.push(...daPagina);
        if (leitura.visao === 'detalhada') o.aoSelecao?.('detalhado', n, leitura.selecoes.detalhado);
        else o.aoSelecao?.(grupo, n, leitura.selecoes[grupo]);
        o.aoPagina?.(daPagina);
        o.aoProgresso?.({ grupo, paginasLidas: n + 1, paginasTotal, processos: lidos, total });
      }
      if (lidos < total) completo = false;
    }
  } catch (e) {
    completo = false;
    erro = e instanceof Error ? e.message : String(e);
  } finally {
    if (paginou) {
      try {
        await fonte.restaurar();
      } catch (e) {
        erro ??= `Não foi possível voltar à primeira página: ${e instanceof Error ? e.message : String(e)}`;
      }
    }
  }
  return { processos: novos, completo, ...(erro ? { erro } : {}) };
}

const SELECAO = ['hdnRecebidosItensSelecionados', 'hdnGeradosItensSelecionados', 'hdnRecebidosItemId', 'hdnGeradosItemId', 'hdnDetalhadoItensSelecionados', 'hdnDetalhadoItemId'];

/** A fonte de verdade em produção: reaproveita o formulário da própria tela, como o legado e o núcleo. */
export function criarFonteSei(http: Http, viva: Pagina, visao: 'resumida' | 'detalhada' = 'resumida'): Fonte {
  const seletor = '#frmProcedimentoControlar';
  const base = (): Record<string, string> => ({
    hdnRecebidosPaginaAtual: '0',
    hdnGeradosPaginaAtual: '0',
    hdnDetalhadoPaginaAtual: '0',
    ...Object.fromEntries(SELECAO.map((c) => [c, ''])),
  });
  return {
    async pagina(grupo, n, sinal) {
      const campo = visao === 'detalhada' ? 'hdnDetalhadoPaginaAtual' : grupo === 'recebidos' ? 'hdnRecebidosPaginaAtual' : 'hdnGeradosPaginaAtual';
      const p = await Formulario.de(viva, seletor, http)
        .definir({ ...base(), [campo]: String(n) })
        .enviar({ sinal, aceitarValidacao: true });
      return p.doc;
    },
    async restaurar(sinal) {
      await Formulario.de(viva, seletor, http).definir(base()).enviar({ sinal, aceitarValidacao: true });
    },
    restaurarAoSair() {
      try {
        const f = Formulario.de(viva, seletor, http);
        void fetch(http.absoluta(f.action), { method: 'POST', keepalive: true, credentials: 'include', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(f.definir(base()).pares()).toString() }).catch(() => undefined);
      } catch {
        /* sem formulario: nada a restaurar */
      }
    },
  };
}
