# Ordem e visibilidade dos painéis do Controle de Processos — desenho

Origem: conversa de 09/10/2026 sobre o PR #178 (posição "acima" dos Favoritos). O PR resolve um caso
particular; o conceito geral é o usuário decidir a **ordem e a visibilidade de todos os painéis** da
tela de Controle de Processos.

## Como é hoje

- Os painéis ficam em `#panelHomePro`; cada um é um `.panelHomePro` com `id` e `data-order`:
  `processosSEIPro` (Controle de Processos), `favoritesPro`, `atividadesPro`, `projetosGantt`.
- A ordem está em `optionsPro.orderPanelHome` = `[{name, index}]` (localStorage do SEI, por navegador
  e por órgão). Cada painel lê o índice ao se inserir e se encaixa antes do primeiro de índice maior
  (`orderDivPanel` no legado, `inserirNaOrdem` em `sei-comum/src/painel/embutido.ts`).
- O arrastar antigo é um `sortable` (jQuery UI) ligado por `panelSortPro`, só configurável dentro dos
  diálogos de Atividades e Projetos. Mover o painel no DOM recarrega o iframe dos Favoritos/Projetos.
- `processosSEIPro` entra por `prepend` e ignora a ordem.

## Decisões (confirmadas com o autor)

1. **Sincroniza** no `chrome.storage.sync` (chave `spro_paineis`), para valer em todos os SEIs e computadores.
2. **Ocultar painéis** faz parte (exceto o Controle de Processos, que é a tela).
3. **Lab e oficial** (Chrome/Edge). Firefox fica de fora, como as anotações.
4. O PR #178 foi fechado com agradecimento; "acima/abaixo" vira consequência da ordem.

## Desenho

Módulo novo `ordem-paineis/` (script de conteúdo isolado, esbuild → `dist/js/init_ordem_paineis.js`),
sem depender de nenhum módulo TS: funciona também no oficial, onde só o legado existe.

- **Modelo** (`{ v: 1, ordem: string[], ocultos: string[] }`): ids de painel; ids ausentes na página são
  preservados ao salvar. A ordem final é: os ids da `ordem` que existem, na ordem salva, e depois os que
  não constam, na ordem natural do DOM. Sem configuração salva, usa a ordem antiga do legado
  (`optionsPro.orderPanelHome`) como ponto de partida, e nada muda para quem nunca ordenou.
- **Aplicação sem mover nós**: `#panelHomePro` vira coluna flex (`.spro-paineis-ativo`) e cada painel
  recebe `style.order`; ocultar = atributo `data-spro-oculto` (CSS `display:none !important`). Sem
  mover nós, os iframes não recarregam e a troca é instantânea. A classe só entra quando há personalização,
  então quem nunca usou vê a tela exatamente como hoje.
- **Reconciliação idempotente** com `MutationObserver` no contêiner: painéis que entram depois
  (cada módulo monta no seu tempo) caem no lugar certo; resolve a corrida do `prepend`.
- **Botão** (ícone "ordenar") na barra do Controle de Processos, só quando há 2 ou mais painéis.
  Abre o `dialog.spro-dialogo` do desenho compartilhado (base.css do sei-comum, dentro de um Shadow DOM como o balão dos Favoritos, com o tema do SEI) com a lista: alça de arrastar, nome, caixa "Mostrar", botões subir/descer
  (teclado), "Restaurar padrão", Salvar/Cancelar. Salvar grava no sync e aplica na hora; outras abas
  acompanham por `storage.onChanged`.
- **Aposentadoria do arrastar antigo**: `setSortDivPanel` vira no-op (o `sortable` brigaria com o `order`)
  e a linha "Ordenar painéis arrastando" dos diálogos de Atividades/Projetos passa a apontar para o botão.

## Fora de escopo

Mover painéis para outras telas; ordenar colunas; qualquer mudança em Favoritos (`exibir`).
