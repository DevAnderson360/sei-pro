# Pesquisar Link Permanente e Processos em Lote (TS): provas no navegador

Data: 16/10/2026. Build do worktree `feat/lote-ts` carregado como extensao descompactada no Chrome for Testing
(porta 9555, perfil isolado, user-agent comum: o SEI SP de treinamento devolve 404 ao user-agent "Chrome for Testing").
Ambientes: SEI SP de treinamento (4.1.5, unidade TESTE) e SEI MJ de homologacao `hmlsei.mj.gov.br` (5.0.4, unidade TESTE).
Nada foi enviado, concluido ou apagado; foram criados processos de teste (listados abaixo).

## Pesquisar Link Permanente

| Prova | SP 4.1.5 | MJ 5.0.4 |
|---|---|---|
| Item do menu abre o modal novo (e nao o dialogo legado) | ok | ok |
| Tema claro, caixa pre-preenchida com os processos da tela | ok (199 linhas) | ok (27 linhas) |
| Pesquisa: processo valido, inexistente, linha solta | ok: Encontrado / Nao encontrado | ok |
| Link sem `infra_hash` (`procedimento_trabalhar&id_procedimento=N`) | ok | ok |
| Esc fecha, devolve a rolagem, remove o iframe (aba em primeiro plano) | ok | ok |
| Copiar com links / Baixar CSV | nao exercitado no navegador (area de transferencia/download) | idem |

Achados: numeros com prefixo de 3 digitos (`026.00000052/2023-47`, comum no SP) caem em "outros" no painel Reconhecidos
(a pesquisa os acha mesmo assim).

## Processos em Lote

| Prova | SP 4.1.5 | MJ 5.0.4 |
|---|---|---|
| Menu abre o modal novo; aviso de cautela do legado | ok | ok |
| Lista de tipos (584 no SP, 921 no MJ) | ok | ok |
| Previa: repetida, travessao trocado por hifen, remover repetidas | nao | ok |
| Criacao de 2 processos com travessao no texto (gravou hifen, sem `%u2014`) | ok (`99906.713-630.000023/2026-72`, `...024/2026-17`) | ok (`00000.000007/2026-79`, `...008/2026-13`) |
| Numero SEI vindo do `<title>`; link do resultado | ok | ok |
| Minimizar (pastilha 320x64 no canto, rolagem destravada, Esc nao fecha) | nao | ok |
| Lote 3 em andamento + Esc fecha no meio + reabrir: oferta "Continuar de onde parou" (1 de 3 criados), aviso de outra aba | nao | ok |
| Continuar mesmo assim: termina 3 de 3 sem duplicar (numeros consecutivos 15, 16, 17) | nao | ok |
| Lote concluido descarta o registro (reabrir mostra a configuracao) | nao | ok |
| "Gerar links permanentes destes processos": chave gravada, modulo abre | nao | chave gravada; o Link Permanente do `dist/` estava desatualizado (build anterior a Task 15) e nao leu a chave |

Processos de teste criados no MJ: 00000.000007/2026-79 a 00000.000017/2026-12 (11, tipo "Defesa do Consumidor: Reunioes ..."),
no SP: 99906.713-630.000023/2026-72 e ...024/2026-17 (tipo "Ata de reuniao"). Podem ser apagados/ignorados.

## Defeitos achados na validacao (corrigidos na rodada seguinte)

1. Combo de tipos do Lote fica com o texto "carregando tipos de processo..." depois de carregar.
2. Aviso de cautela do Lote: trechos em negrito saem em linhas separadas (layout).
3. `dist/js/link-permanente/app.js` gerado antes da Task 15: nao consome a entrada pendente. Rebuild de ambos.
4. Numeros de processo com prefixo de 3 digitos classificados como "outros"; nº SEI seguido de ponto final de frase descartado.
5. Armadilha do harness (nao do produto): a aba em segundo plano (`visibilityState: hidden`) nao dispara o evento `close` do `<dialog>`.

## Etapa 2: modelos salvos e "Depois de criar" (validada em 16/10/2026)

Build do commit `4ff6390` (extensao recarregada no Chrome de teste: o Chrome guarda em cache o content script descompactado, e uma pagina carregada
antes da atualizacao devolve "Operacao desconhecida: posAcaoOpcoes"; um app novo falando com um content script antigo mostra a mensagem em vez de quebrar).

| Prova | SP 4.1.5 | MJ 5.0.4 |
|---|---|---|
| Painel "Depois de criar" aparece so com processo de numero confirmado; listas (blocos internos, marcadores, grupos) carregam | ok | ok |
| Incluir 2 processos em bloco interno (pela tela do Controle: `rel_bloco_protocolo_cadastrar`); conferido por leitura independente da tela do bloco | ok (bloco 16991, ids 161549 e 161550 presentes) | ok (bloco 408164, ids 40051461 e 40051462 presentes) |
| Aplicar marcador (com texto): conferido na tela de marcadores do processo | resultado "aplicado" | ok (marcador Teste + texto "etapa 2") |
| Acompanhar (grupo) | nao exercitado | resultado "aplicado" (nao conferido por leitura independente) |
| Aplicar de novo: marcador e acompanhamento "ja estava", bloco nao reenviado | nao | ok ("2 feitas, 4 ja estavam") |
| Modelos: salvar com nome (dialogo sem Cancelar), recarregar a pagina, aplicar (tipo e pausa voltam) | nao | ok |
| Combo de tipos mostra "selecione o tipo de processo" depois de carregar; aviso de cautela num paragrafo so | ok | ok |

Processos de teste desta etapa: MJ `00000.000018/2026-59` a `00000.000021/2026-72` (4), SP `99906.713-630.000025/2026-61` e `...026/2026-14`.
No MJ, os processos `...020` e `...021` ficaram incluidos no bloco "teste" (408164) e levam o marcador "Teste"; no SP, os dois ficaram no bloco de teste do SP (16991) com o marcador "Marcador Teste 1". Tambem ficou no bloco "teste" do MJ o processo `00000.000007/2026-79` (experimento de reconhecimento do protocolo).

## Menu suspenso (item levado da Task 7)

O legado fecha o menu suspenso antes de abrir o Historico (`getHistoryProcessosPro`, em `dist/js/sei-functions-pro.js`:
`$(infraBarraS+'.barSuspenso').trigger('click')`). Os ganchos novos do Pesquisar Link Permanente e do Processos em Lote
nao fazem esse clique. Estas provas nao registram se o menu suspenso cobre o modal novo no SP nem no MJ: não verificado: conferir antes do release.

## Conferencias finais (build `3d6e7c4`, MJ 5.0.4, 16/10/2026)

- Repasse Lote -> Link Permanente: a chave `link-permanente/entrada` gravada pelo Lote e lida pelo Link Permanente (caixa vem com os 2 numeros, painel "Reconhecidos: 2 processos") e a chave e consumida uma vez (nao sobra nada no storage). O build anterior do Link Permanente (anterior a Task 15) nao fazia isso: bundles regerados.
- Clicar no item "Processos em Lote" do menu com o modal minimizado restaura a janela cheia (iframe em tela cheia, app fora da pastilha).
- Historico (ja publicado) com o controle de modal agora vindo do `sei-comum`: abre pelo item do menu e fecha com Esc (rolagem devolvida).
- Link Permanente e Historico fecham com um Esc, com a aba em primeiro plano e o app ja carregado (10 s). Com 6 s a primeira tecla nao fechou o Historico: o app ainda carregava (nao e regressao: comportamento do legado e do modulo ja publicado).
