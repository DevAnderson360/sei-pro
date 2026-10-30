/**
 * Consulta o andamento de UM processo pelo link assinado da própria linha do Controle de Processos: abre a tela do
 * processo (só para chegar na árvore), acha o link do histórico e percorre o histórico resumido. Só leitura.
 * Não usa a pesquisa rápida nem abre pastas: são 2 requisições mais as páginas do histórico.
 */
import { andamentosDoLink } from '../../../sei-nucleo/src/dominio/historico';
import { linkDaAcao } from '../../../sei-nucleo/src/links/links';
import { ErroSei } from '../../../sei-nucleo/src/sessao/erros';
import type { Sei } from '../../../sei-nucleo/src/sei';
import { extrairDados, type UnidadeAtual } from '../modelo/andamentos';
import type { Processo } from '../modelo/tipos';
import { ErroSessaoColeta, type DadosColeta } from './coletar';

const LIMITE_ANDAMENTOS = 500;

export async function consultarAndamento(sei: Sei, p: Pick<Processo, 'link'>, minhaUnidade: UnidadeAtual, sinal: AbortSignal): Promise<DadosColeta | null> {
  if (!p.link) return null;
  try {
    let pagina = await sei.http.obter(p.link, { sinal });
    if (!/acao=procedimento_visualizar/.test(pagina.url)) {
      const src = pagina.doc.querySelector('#ifrArvore')?.getAttribute('src');
      if (!src) return null;
      pagina = await sei.http.obter(src.replace(/&amp;/g, '&'), { sinal });
    }
    const historico = linkDaAcao(pagina.html, 'procedimento_consultar_historico');
    if (!historico) return null;
    const { andamentos } = await andamentosDoLink(sei, historico, { tipo: 'resumido', limite: LIMITE_ANDAMENTOS, sinal });
    const dados = extrairDados(andamentos, minhaUnidade);
    return Object.keys(dados).length ? dados : null;
  } catch (e) {
    if (e instanceof ErroSei && e.codigo === 'SEI_SESSAO_EXPIRADA') throw new ErroSessaoColeta(e.message);
    if (e instanceof ErroSei && (e.codigo === 'SEI_SIGILOSO' || e.codigo === 'SEI_ACAO_INDISPONIVEL' || e.codigo === 'SEI_NAO_ENCONTRADO')) return null;
    throw e;
  }
}
