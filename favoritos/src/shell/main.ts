/** Entrada de html/painel.html (o painel lateral da extensão). */

import { areaChrome } from "@comum/armazenamento/area";
import { abaPedidaNoEndereco, ferramentasDoPacote, montarShell } from "./painel";

void montarShell(document.getElementById("painel")!, {
  // Sem `storage.session` (navegador antigo), a aba pedida só vale pelo endereço.
  sessao: areaChrome(chrome.storage.session ?? chrome.storage.local, chrome.storage.session ? "session" : "local"),
  ...ferramentasDoPacote(chrome.runtime.getManifest()),
  local: areaChrome(chrome.storage.local, "local"),
  url: (c) => chrome.runtime.getURL(c),
  abaDoEndereco: abaPedidaNoEndereco(location.hash),
  // Sidebar do Firefox: sem API de janelas, segue qualquer pedido.
  janela: async () => (await chrome.windows?.getCurrent?.())?.id ?? null,
});
