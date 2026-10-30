# Abertura do agente no portal F5

Versao personalizada: **3.8.0.2**. Data: 30/10/2026.

## Relato e diagnostico

No acesso remoto do TJAM, clicar no agente nao abria o painel. As capturas
mostram um endereco com prefixo `/f5-w-...$$/sei/`, avisos de `F5_Origin` e uma
excecao de foco durante a repeticao do onload nativo pelo legado.

O F5 Portal Access reescreve HTML, JavaScript e URLs. Documentacao oficial:
https://clouddocs.f5.com/portalaccess-alternative/main/intro.html

No codigo da extensao havia duas dependencias frageis nesse ambiente:

- o botao legado chamava JavaScript da pagina e mandava a abertura para
  `window.top`, que pode ser a janela do portal;
- `init_agente.js` so era injetado na janela superior e recusava iniciar em
  qualquer frame, mesmo quando o frame era a tela principal do SEI no portal.

Esses pontos foram corrigidos. Sem acesso ao ambiente F5 do usuario, nao e
possivel afirmar que sao a unica causa do relato. O aviso sobre o cabecalho
`F5_Origin` nao prova que a abertura do painel foi bloqueada por esse cabecalho.
A excecao de foco pertence ao legado; esta correcao nao a mascara nem modifica
a inicializacao nativa do SEI.

## Alteracoes

- O content script captura o clique nos botoes legados da extensao e pede a
  abertura diretamente ao service worker, sem executar o onclick da pagina.
- A captura e sincrona, preservando o gesto necessario a Chrome Side Panel API.
- O script tambem e injetado nos frames que ja correspondem aos enderecos do
  Manifest. Nao foram ampliados hosts nem adicionadas permissoes.
- Uma tela principal com prefixo F5 pode conectar dentro do portal. Frames de
  arvore e documento nao criam outra ponte quando ha uma tela SEI ancestral.
- No acesso normal, a tela superior continua sendo a responsavel pela ponte.
- A extracao do SEI, os cookies, os cabecalhos, o transporte da API e os dados
  locais nao foram alterados.

Arquivos centrais: `agente-ia/src/ponte/abertura.ts`,
`agente-ia/src/ponte/aba.ts`, `agente-ia/tests/verificar-abertura.ts` e
`dist/manifest.json`. O build regenera `dist/js/init_agente.js`.

## Testes

As regressoes simulam acesso direto, F5 no topo, F5 dentro de portal, frames
internos, ancestral inacessivel por origem, clique no icone e em botao criado
depois do carregamento, ausencia de duplicacao e preservacao do prefixo F5 nas
URLs relativas. Nao e feita chamada real a IA nesses testes.

Validacao: tipos aprovados; **1.747 verificacoes do agente** e **620 do painel**
aprovadas, sem falhas; build regenerado e 329 referencias do Manifest presentes.
O ambiente real do TJAM/F5 nao foi acessado nesta validacao.

## Validar no ambiente real

1. Atualizar os arquivos da extensao descompactada no mesmo diretorio usado
   pelo Chrome. Nao desinstalar a extensao: seus dados pertencem ao cadastro
   atual do navegador.
2. Em `chrome://extensions`, clicar em **Recarregar** e confirmar `3.8.0.2`.
3. Recarregar tambem a aba do SEI acessada pelo portal F5, para substituir os
   content scripts antigos.
4. Clicar no botao do agente na barra principal e na barra do processo. O
   painel deve abrir uma unica vez.
5. Confirmar que a aba do SEI aparece conectada e que uma conversa salva abre
   sem nova requisicao a IA. Somente depois testar uma pergunta de leitura.
6. Repetir no acesso direto e, se utilizada, na janela separada.

Se ainda nao abrir, registrar a versao instalada e o erro do **service worker**
da extensao (link em `chrome://extensions`), alem do console da pagina.
Se abrir mas ficar sem aba conectada, registrar esse comportamento: e uma
falha diferente da abertura e pode exigir examinar a estrutura real dos frames.
