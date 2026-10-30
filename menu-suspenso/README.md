# Menu suspenso

O menu lateral do SEI como camada por cima do conteúdo, aberta e fechada pelo ☰ da
barra. O conteúdo ocupa a largura inteira da janela.

Content script isolado (`dist/js/init_menu_suspenso.js`, todos os frames; só age onde há
`#divInfraAreaTelaE`). Substitui o código jQuery antigo do `sei-functions-pro.js`
(`infraMenuSistemaEsquemaPro`, `hideMenuSEIPro`, `showMenuSEIPro`, `checkMenuSEIPro`).

- `src/layout.ts` distingue o layout novo (SEI 4.1+ e 5, `ul#infraMenu`) do antigo (SEI 3 e 4.0).
- `src/controle.ts` é o ciclo de vida sem Chrome nem jQuery: um estado (`aberto` ou `fechado`),
  clique no ☰ alterna, clique fora e Esc fecham. A captura no documento consome o clique antes do
  `onclick` inline do SEI.
- `src/style.css` só vale com `html[data-spro-menu-suspenso]`; desligada, a página é a do SEI.
- `src/main.ts` lê a opção `menususpenso` (desligada por padrão) do `dataValues` e reage ao vivo.

Decisões: a tela sempre abre com o menu fechado (nada é guardado entre telas); abaixo de 768 px
o módulo fica inerte e vale o menu de celular do SEI; o módulo só põe atributos no `<html>` e
`aria-*` nas alavancas, e desfaz tudo ao desligar. O layout antigo foi coberto só por teste de
fixture, sem SEI antigo para provar ao vivo.

    npm install
    npm run tipos
    npm run build

O build roda os testes e gera o bundle em ASCII. Não editar o bundle à mão.

## Validação no SEI

Conferido ao vivo no SEI SP (4.1.5) e no SEI MJ (5.0.4): abre e fecha por ☰, clique fora e
Esc; clique dentro do menu e em submenu não fecha; ligar e desligar a opção vale sem recarregar.
