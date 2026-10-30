/**
 * Como um prazo aparece na coluna: texto curto, dica e a chave de ordenação. Contas em dias do
 * calendário local (`sei-comum/datas`), porque prazo de servidor se conta em dias de Brasília.
 * Dias úteis não entram aqui: quem calcula o vencimento "em N dias úteis" é o servidor do SEI, e
 * a coluna mostra sempre dias corridos até o vencimento, como o próprio ícone do SEI.
 */
import { diferencaDias, formatarData } from '../../../sei-comum/src/datas/dias';
import type { DataISO, PrazoProcesso, Resumo } from './tipos';

const dias = (n: number) => `${n} ${Math.abs(n) === 1 ? 'dia' : 'dias'}`;
const MAX = Number.MAX_SAFE_INTEGER;

function dicaDe(p: PrazoProcesso, base: string): string {
  const partes = [base];
  if (p.hora && p.vencimento) partes[0] = base.replace(/\.$/, '') + ` às ${p.hora}.`;
  if (p.texto) partes.push(p.texto);
  if (p.sigla) partes.push(`Definido por ${p.sigla} no controle de prazo do SEI.`);
  return partes.join('\n');
}

export function resumir(p: PrazoProcesso, hoje: DataISO): Resumo {
  const venc = p.vencimento;
  if (p.concluidoEm && venc) {
    return {
      situacao: 'concluido',
      texto: `concluído em ${formatarData(p.concluidoEm).slice(0, 5)}`,
      dica: dicaDe(p, `Prazo de ${formatarData(venc)} concluído em ${formatarData(p.concluidoEm)}.`),
      ordem: MAX,
      sorter: `${venc} 23:59:59`,
    };
  }
  if (venc) {
    const falta = diferencaDias(hoje, venc);
    const sorter = `${venc} ${p.hora ?? '23:59'}:00`;
    const dica = dicaDe(p, `Vence em ${formatarData(venc)}.`);
    if (falta === 0) return { situacao: 'hoje', texto: 'vence hoje', dica, ordem: 0, sorter };
    if (falta < 0) return { situacao: 'atrasado', texto: `${dias(-falta)} de atraso`, dica, ordem: falta, sorter };
    return { situacao: 'noPrazo', texto: `vence em ${dias(falta)}`, dica, ordem: falta, sorter };
  }
  const inicio = p.inicio ?? hoje;
  const passou = diferencaDias(inicio, hoje);
  const texto = passou === 0 ? 'hoje' : passou > 0 ? `há ${dias(passou)}` : `em ${dias(-passou)}`;
  return {
    situacao: 'desde',
    texto,
    dica: dicaDe(p, `Contando desde ${formatarData(inicio)}.`),
    ordem: MAX - 1,
    sorter: `${inicio} ${p.hora ?? '23:59'}:00`,
  };
}
