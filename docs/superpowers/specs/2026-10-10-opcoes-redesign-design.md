# Redesign da página de opções e reestruturação do código

Data: 2026-10-10 · Escopo: `dist/html/options.*`, `dist/html/page.css`, `favoritos/src/opcoes/main.ts`

## Objetivo

Redesenhar a página de opções da extensão (visual inspirado no site de documentação seipro.app) e trocar a estrutura interna (71 blocos HTML repetidos à mão) por um schema declarativo com renderizador. O comportamento e o formato de armazenamento não mudam.

## Mantém (não negociável)

- Seções colapsáveis, controles toggle switch, link de documentação por opção, ícone azul = ligado / cinza = desligado.
- Abas Geral, Base de Dados e Complementos.
- Contrato com o storage: ids `itemConfigGeral_*`, atributos `data-name`, formato de `dataValues` em `chrome.storage.sync`, bases de dados (perfis), import/export, limite de 8 KB (`checkEspacoSyncPro`/`checkErroSyncPro`).
- A página roda de três jeitos: aba própria, `default_popup` e `<iframe>` de 800 px dentro do SEI (`sei-pro-all.js`). O layout tem de funcionar em ~800 px e em largura estreita.

## 1. Layout e visual

**Cabeçalho.** Faixa com logo e título "Nome | Configurações" em linha própria. Abaixo, uma barra de ações `sticky` em linha separada: `Baixar` e `Carregar` (secundários), `Ferramentas de PDF` (terciário) e `Salvar` (único primário, à direita). Some o `position: absolute` e o `calc(50vw - 480px)` que cobriam o título. Em largura estreita a barra quebra linha e os rótulos longos (`.btn_text`) somem, ficando só o ícone.

**Tokens.** Variáveis CSS em `:root` com a paleta do site: papel `#F5F3EE`, papel-2 `#ECE8DF`, tinta `#0F1E33`, tinta-2 `#3C4A5E`, linha `#DDD7CB`, azul `#0B5F91`, azul-escuro `#073F61`, verde `#7FB539`. Tema escuro via `prefers-color-scheme`. Fontes do sistema (`system-ui`), **sem Google Fonts nem qualquer recurso externo** (política de privacidade e auditoria de rede da 2.2.2). Raio 16 px nos cartões, botões de 44 px com raio 10 px.

**Abas.** Abas sublinhadas, sem a caixa cinza do jQuery UI.

**Seções.** Cada seção é um cartão com cabeçalho clicável: chevron, título e contagem "N de M ativas". Estado aberto/fechado persiste só em `sessionStorage`/memória (nada novo no sync).

**Linha de opção.** Ícone → rótulo → `ⓘ` (manual) → toggle. Ícone azul quando ligada e cinza quando desligada, reagindo ao toggle em tempo real. Sem zebra. Toggle é `<input type="checkbox" role="switch">` nativo estilizado, com foco visível e operação por teclado.

**Sub-opções.** Painel recuado sob a opção pai (ex.: "Onde mostrar os favoritos"), visível só com a pai ligada.

**Busca.** Campo no topo da aba Geral que filtra por rótulo (sem acento, sem caixa). Abre as seções com resultado, esconde as sem resultado e mostra "Nenhuma opção encontrada". `Esc` limpa.

## 2. Estrutura do código

| Arquivo | Responsabilidade |
|---|---|
| `options-schema.js` | Lista declarativa de seções e opções: `id`, `dataName`, ícone, rótulo, URL do manual, padrão, sub-opções. Fonte única da verdade. |
| `options-render.js` | Constrói a interface a partir do schema por DOM seguro (`createElement`/`textContent`, sem `innerHTML` com dados). Cada linha leva `data-opcao="<dataName>"`. |
| `options-storage.js` | Save, restore, import, export, limite do sync e perfis de base de dados. Lógica movida do `options.js` atual **sem mudar comportamento**. |
| `options.js` | Cola: inicializa módulos, abas, busca, botões. |
| `options.html` | Esqueleto pequeno (UTF-8 declarado; hoje é iso-8859-1). |
| `page.css` | Reescrito com variáveis. |

Scripts novos ficam em `dist/html/`, listados em `web_accessible_resources` onde a página já é exposta (conferir `dist/manifest*.json` e `*_v2`). O código novo respeita a regra de acentos `\uXXXX` em `.js` sob `dist/`.

**Acoplamento corrigido.** `favoritos/src/opcoes/main.ts` ancora a seção de exibição em `closest("tr")` do toggle de favoritos. Passa a ancorar no elemento `[data-opcao="gerenciarfavoritos"]` (ou no ponto de extensão que o renderizador expõe para sub-opções). O bundle `dist/js/favoritos/opcoes.js` é regenerado.

## 3. Fora de escopo (anotado para depois)

- **Cópias whitelabel** de `options.html`/`options.js` (`antaq/html`, `whitelabels/antt/antt-pro/html`, `whitelabels/conab/conab/html`) ficam como estão nesta rodada. Depois: portar para o schema compartilhado e adaptar o `getManifestExtension`/`setNamePage` de cada uma. Pendência registrada na memória do projeto.
- Redesenho do conteúdo das abas Base de Dados e Complementos além do que o novo CSS já cobre (mantêm a estrutura funcional).
- Mudar o formato de armazenamento.

## 4. Verificação

1. **Paridade do schema (obrigatório).** Script de teste extrai do `options.html` atual todos os `data-name`/`id`/padrões marcados (`checked`) e compara com o schema: nenhuma opção perdida, duplicada ou com padrão trocado (71 hoje). Um erro de digitação perderia a configuração de alguém em silêncio.
2. **Paridade do save.** Comparar o objeto que o novo `save_options` grava com o do atual para o mesmo estado de entrada; o restore round-trip de um `dataValues` real recompõe os toggles.
3. **Visual no Chrome real**, com a extensão carregada: aba própria, iframe de 800 px e largura estreita (~400 px), claro e escuro, teclado e foco, busca, abrir/fechar seções, sub-opções dos favoritos, fluxo de import/export.
4. Sem requisições externas novas (aba Network vazia de hosts de terceiros).
