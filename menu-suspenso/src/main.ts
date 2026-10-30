/**
 * Content script isolado, no topo e nos frames: só age onde há menu lateral. A opção `menususpenso` vem do
 * mesmo `dataValues` da página de opções, desligada por padrão, e vale ao vivo sem recarregar o SEI.
 */
import { opcaoLegadaMarcada } from '../../sei-comum/src/opcoes/legadas';
import { iniciar } from './controle';
import css from './style.css';

const OPCAO = 'menususpenso';

function montar() {
  if (!document.getElementById('divInfraAreaTelaE')) return;
  const estilo = document.createElement('style');
  estilo.textContent = css;
  document.head.append(estilo);
  const controle = iniciar(document);
  let mudou = false;
  const configuracao = (mudancas: Record<string, chrome.storage.StorageChange>, area: string) => {
    if (area !== 'sync' || !('dataValues' in mudancas)) return;
    mudou = true;
    controle.configurar(opcaoLegadaMarcada(mudancas.dataValues!.newValue, OPCAO));
  };
  chrome.storage.onChanged.addListener(configuracao);
  chrome.storage.sync
    .get('dataValues')
    .then((itens) => {
      if (!mudou) controle.configurar(opcaoLegadaMarcada(itens.dataValues, OPCAO));
    })
    .catch(() => {
      /* Sem acesso ao storage: o menu fica como o SEI o entrega. */
    });
  window.addEventListener('pagehide', (evento) => {
    if (evento.persisted) return;
    chrome.storage.onChanged.removeListener(configuracao);
    controle.encerrar();
    estilo.remove();
  });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar, { once: true });
else montar();
