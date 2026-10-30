/**
 * A lista de marcadores da unidade, lida do formulário de marcador que a barra do Controle de
 * Processos abre (mesmo POST do prazo, com um processo na seleção só na cópia). SEI 4+: tela de
 * cadastro; SEI 3: tela de gerenciar. Se algo falhar, o modal segue sem marcador.
 */
import { Formulario } from '../../../sei-nucleo/src/formulario/formulario';
import { paginaDe } from '../../../sei-nucleo/src/sessao/pagina';
import type { Http } from '../../../sei-nucleo/src/sessao/http';
import { grupoDaLinha, hrefDaBarra } from '../nativo/formulario';
import type { MarcadorOpcao } from './modal';

export async function carregarMarcadores(http: Http, doc: Document, url: string, idProcedimento: string): Promise<MarcadorOpcao[]> {
  const href = hrefDaBarra(doc, 'andamento_marcador_cadastrar') ?? hrefDaBarra(doc, 'andamento_marcador_gerenciar');
  const grupo = grupoDaLinha(doc, idProcedimento);
  if (!href || !grupo) return [];
  const tela = Formulario.de(paginaDe(doc, url), '#frmProcedimentoControlar');
  tela.definir({ [`hdn${grupo}ItensSelecionados`]: idProcedimento });
  const pagina = await http.enviar(href, tela.pares(), { aceitarValidacao: true });
  const form = Formulario.de(pagina, '#frmAndamentoMarcadorCadastro, #frmGerenciarMarcador');
  return form
    .opcoes('selMarcador')
    .filter((o) => o.valor && o.valor !== 'null' && o.valor !== '0')
    .map((o) => ({ valor: o.valor, texto: o.texto }));
}
