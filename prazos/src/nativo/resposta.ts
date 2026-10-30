/**
 * O que o SEI respondeu a uma gravação de prazo. Sucesso é sair da tela do formulário (o SEI
 * redireciona para a caixa). O erro de validação NÃO vem em `#txaInfraValidacao` no 4.1.5: a tela
 * se reexibe e a mensagem fica em `#divInfraMensagens .alert-danger`.
 */
import { textoDe } from '../../../sei-nucleo/src/sessao/dom';
import type { Pagina } from '../../../sei-nucleo/src/sessao/http';

export interface ResultadoEnvio {
  ok: boolean;
  erro?: string;
  pagina: Pagina;
}

function mensagemDe(doc: Document): string {
  const alerta = doc.querySelector('#divInfraMensagens .alert-danger, #divInfraMensagens .alert-warning');
  if (alerta) {
    const copia = alerta.cloneNode(true) as Element;
    copia.querySelectorAll('button').forEach((b) => b.remove());
    const t = textoDe(copia);
    if (t) return t;
  }
  const area = doc.querySelector<HTMLTextAreaElement>('#txaInfraValidacao');
  return (area?.value ?? area?.textContent ?? '').trim();
}

export function interpretarResposta(pagina: Pagina): ResultadoEnvio {
  const aindaNoFormulario = /[?&]acao=controle_prazo_definir\b/.test(pagina.url) && !!pagina.doc.querySelector('#frmControlePrazoCadastro');
  const erro = mensagemDe(pagina.doc);
  if (erro) return { ok: false, erro, pagina };
  if (aindaNoFormulario) return { ok: false, erro: 'O SEI não confirmou a gravação do prazo.', pagina };
  return { ok: true, pagina };
}
