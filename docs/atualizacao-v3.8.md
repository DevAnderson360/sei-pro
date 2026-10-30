# Atualizacao da extensao para SEI Pro 3.8

Data: 30/10/2026.

## Base e escopo

- Oficial: `SEI-Pro/sei-pro`, tag `v3.8`, commit `af497cbf`.
- Versao personalizada: `3.8.0.1`, Manifest V3.
- Pendencias anteriores preservadas no commit `47be52f7`.
- Integracao por merge na branch `sync/upstream-v3.8`, sem rebase.
- Somente o repositorio da extensao foi alterado. API e painel web sao projetos
  separados e nao fazem parte desta atualizacao.

A base oficial inclui o painel com abas, melhorias de acoes e documentos em
lote, projetos, demandas, backup opcional do agente e anexos PDF com OCR local.
O mecanismo de extracao acompanha o codigo oficial; nao foi reescrito pelo fork.

## Customizacoes preservadas

- Tokens de entrada, cache, gravacao de cache, saida, reasoning e total, com um
  registro por resposta que forneca usage. Reasoning nao e somado de novo.
- Compatibilidade de reasoning com ferramentas e servicos compativeis.
- Retomada de conversas locais, com mensagens, pseudonimos, tarefas, uso e
  identificacao do processo. Conversas antigas sem estado continuam legiveis.
- Copia de respostas em texto simples, inclusive no historico.
- Janela separada opcional, ligada a aba e janela SEI de origem; o painel
  lateral continua sendo o padrao.
- Gerenciamento e limites dos auxiliares, progresso e consumo por execucao.
- Pausa de disparos automaticos de rotinas, preservando o comando manual.
- Resultado completo, erro e proxima janela das rotinas.

As rotinas antigas continuam somente leitura. A base oficial agora oferece
outros alcances, escolhidos explicitamente no cadastro; os auxiliares continuam
somente leitura. A pausa tambem suspende os alarmes criados por este painel.

## Ajustes de integracao

- O backup local em lote preserva o estado retomavel, alem da transcricao.
- O delimitador de seguranca dos documentos e preservado ao retomar ou trocar
  a configuracao da conversa. A restauracao sozinha nao chama a IA.
- O consumo do agente principal soma a chamada atual ao total da conversa,
  preservando o que os auxiliares ja consumiram.
- O seletor de modelos usa o catalogo e mantem o fallback oficial para nomes
  manuais em servicos compativeis.
- O campo de etapa de projetos em Demandas usa a API atual do combobox para
  informar quando nao ha etapas abertas.
- Testes de fixtures e varredura de fontes aceitam CRLF do Windows; mocks de
  navigator funcionam tambem com o Node atual.
- A CI cobre os 21 modulos TypeScript da extensao, incluindo `sei-comum`.

## Validacao automatizada

Em cada modulo: `npm run tipos` e `npm run build` (que executa os testes).
Em `sei-comum`, que nao produz bundle proprio: `npm run tipos` e
`npm run verificar`. A distribuicao em `dist/` e regenerada pelos builds.

Testes de regressao especificos verificam restauracao sem chamada ao provedor,
preservacao do envelope, exportacao/importacao local do estado retomavel e
abertura da janela separada com a origem correta.

O agente passou em **1.731 verificacoes**, sem falhas. O Manifest V3 foi
conferido: **329 referencias a arquivos**, todas presentes no pacote.
`git diff --check upstream/master` nao aponta problemas nas customizacoes;
o diff completo da atualizacao herda espacos finais da base oficial.

Resultado final: tipos, testes e builds aprovados nos **21 modulos**. Entre
as suites: Projetos (2.588), Demandas (1.039), Documentos em Lote (928),
SEI Comum (763), Acoes em Lote (704) e SEI Nucleo (322), sem falhas.

Nao foi criada tag de release nem publicada alteracao no GitHub nesta rodada.
A branch de sincronizacao fica pronta para revisao e teste manual antes de
promover a atualizacao para `homolog`.

## Teste manual no Chrome e no SEI/TJAM

1. Em `chrome://extensions`, recarregar a extensao descompactada apontando para
   `dist/`, preservando o mesmo cadastro da extensao para manter seus dados.
2. Confirmar a versao `3.8.0.1`, abrir um processo e o painel lateral.
3. Configurar o servico/modelo habitual e enviar uma pergunta. Conferir resposta,
   uso e funcionamento das ferramentas de leitura.
4. Recarregar a pagina, abrir o painel e retomar a conversa. No Network do
   painel, confirmar que a restauracao nao faz POST a `chat/completions`.
5. Fechar e abrir o Chrome e retomar a mesma conversa pelo historico. So uma
   nova pergunta deve chamar o provedor.
6. Copiar uma resposta atual e uma arquivada, conferindo o texto simples.
7. Selecionar janela separada nas configuracoes, reabrir pelo menu do SEI e
   conferir a conexao com a aba original. Voltar ao modo painel.
8. Conferir limites de auxiliares e pausar/retomar rotinas. Uma rotina manual
   continua exigindo servico configurado, aba conectada e gasto permitido.
9. Se utilizar backup em arquivo, exportar/importar uma conversa de teste e
   verificar que ela continua retomavel, sem envio automatico ao provedor.

Os testes automatizados usam provedores e paginas simulados. A validacao manual
com sessao real do TJAM e chamada ao provedor permanece necessaria antes de
considerar esta versao homologada ou criar uma tag de release personalizada.
