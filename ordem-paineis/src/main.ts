/**
 * Content script isolado: só age no Controle de Processos. A ordem e a visibilidade dos painéis ficam
 * no `chrome.storage.sync` (valem em todos os SEIs e computadores) e mudam ao vivo, também em outras
 * abas. Quem nunca configurou parte da ordem que o arrastar antigo do legado deixou (`optionsPro`).
 */
import { iniciar } from './controle';
import { CHAVE, type Config, configVazia, deLegado, normalizar } from './modelo';
import cssBase from '../../sei-comum/src/ui/base.css';
import cssModal from './modal.css';
import css from './style.css';

function inicial(): Config {
  try {
    return deLegado(localStorage.getItem('optionsPro')) ?? configVazia();
  } catch {
    return configVazia();
  }
}

function montar() {
  if (new URL(location.href).searchParams.get('acao') !== 'procedimento_controlar') return;
  const estilo = document.createElement('style');
  estilo.textContent = css;
  document.head.append(estilo);
  const controle = iniciar(
    document,
    cfg => {
      chrome.storage.sync.set({ [CHAVE]: cfg }).catch(() => { /* sem sincronização: vale nesta aba até recarregar */ });
    },
    `${cssBase}\n${cssModal}`,
  );
  let mudou = false;
  chrome.storage.onChanged.addListener((mudancas, area) => {
    if (area !== 'sync' || !(CHAVE in mudancas)) return;
    mudou = true;
    controle.configurar(normalizar(mudancas[CHAVE]!.newValue));
  });
  chrome.storage.sync
    .get(CHAVE)
    .then(itens => {
      if (!mudou) controle.configurar(itens[CHAVE] === undefined ? inicial() : normalizar(itens[CHAVE]));
    })
    .catch(() => controle.configurar(inicial()));
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', montar, { once: true });
else montar();
