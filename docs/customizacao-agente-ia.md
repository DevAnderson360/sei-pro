# Customizacao do agente de IA

## Estado do projeto encontrado

A auditoria inicial mostrou que o repositorio ja estava alem da extensao antiga
descrita no levantamento original. A distribuicao atual e a **SEI Pro Lab
2.2.0.1**, baseada na versao oficial 2.2,
em Manifest V3, e ja possui painel lateral, motor com ferramentas, multiplos
provedores, historico local de leitura, Estudio de Fluxos, regras, memoria,
rotinas e ferramentas de PDF.

O trabalho desta branch preserva essa arquitetura. Nao houve migracao para a
Responses API, troca do mecanismo de extracao do SEI, inclusao de backend ou
customizacao exclusiva para um unico provedor.

## Fase 1A - uso por chamada

Branch: `feature/ampliar-tipos-usage-criar-registro-chamada`

### Alteracoes realizadas

- O tipo `Uso` passou a representar:
  - tokens de entrada;
  - tokens de entrada reutilizados do cache;
  - tokens gravados no cache;
  - tokens de saida;
  - tokens de reasoning;
  - total de tokens;
  - custo informado pelo provedor.
- Foi criado `RegistroUsoChamada`, com identificador, modelo, data e vinculos
  opcionais de conversa e processo.
- Cada resposta bem-sucedida que contenha `usage` produz um registro separado.
- Os registros do chat principal e dos agentes auxiliares sao mantidos em
  `chrome.storage.session` junto da conversa corrente.
- Dados de sessoes anteriores sao normalizados quando nao possuem os novos
  campos.
- O acumulador de chamadas auxiliares foi corrigido para somar a chamada atual,
  evitando duplicacao quando o auxiliar executa varias rodadas de ferramentas.
- A inferencia de fluxos passou a devolver tambem o registro de uso produzido
  pelo provedor.

### Compatibilidade de reasoning e ferramentas

No endpoint `/v1/chat/completions`, GPT-6 Luna e GPT-6 Sol so aceitam function
tools com `reasoning_effort: "none"`. O adaptador agora aplica esse parametro
quando esses modelos recebem ferramentas.

Chamadas sem ferramentas preservam o comportamento padrao do modelo. Para
aliases ou servicos compativeis nao reconhecidos antecipadamente, o adaptador
faz uma unica retentativa com `reasoning_effort: "none"` quando o erro HTTP 400
explica essa incompatibilidade.

### Semantica dos contadores

`reasoning_tokens` e uma subdivisao dos tokens de saida. Ele e registrado para
analise, mas nao e somado novamente ao total ou ao custo da saida.

`cached_tokens` e `cache_write_tokens` permanecem categorias de entrada. O
calculo financeiro detalhado por categoria ainda nao faz parte desta fase.

## Arquivos principais

- `agente-ia/src/motor/tipos.ts`: contratos de uso e registro por chamada.
- `agente-ia/src/motor/uso.ts`: normalizacao, soma e criacao dos registros.
- `agente-ia/src/motor/provedor.ts`: captura do usage e compatibilidade dos
  parametros de reasoning.
- `agente-ia/src/motor/motor.ts`: acumulacao e entrega de cada registro para a
  interface.
- `agente-ia/src/painel/main.ts`: registros da conversa e restauracao da sessao.
- `agente-ia/src/painel/historico.ts`: uso do contrato compartilhado.
- `agente-ia/src/fluxos/inferir.ts`: propagacao do registro da inferencia.
- `agente-ia/tests/verificar-provedor.ts` e
  `agente-ia/tests/verificar-motor.ts`: cobertura do novo comportamento.

## Validacao original da fase 1A

- `npm run tipos`: aprovado.
- `npm run verificar`: 531 testes aprovados, 0 falhas.
- `npm run build`: aprovado; distribuicao atualizada em `dist/`.

## Teste manual

1. Carregar `dist/` como extensao descompactada no Chrome.
2. Abrir um processo do SEI e o painel lateral.
3. Selecionar GPT-6 Luna e enviar uma pergunta que utilize ferramentas.
4. Confirmar que a resposta e recebida sem erro de `reasoning_effort`.
5. No DevTools do painel, consultar `agenteIA_conversa` em
   `chrome.storage.session` e verificar um item em `registrosUso` para cada
   chamada ao modelo.

## Fora do escopo desta fase

- persistencia definitiva dos registros de uso no IndexedDB;
- associacao por identificador estavel do processo;
- painel detalhado de tokens e custos;
- tabela configuravel de precos e estimativa financeira;
- controles visuais de reasoning por capacidade do modelo;
- migracao de Chat Completions para Responses API.

## Fase 1B - retomada de conversas arquivadas

Commit original: `f2f90c3`

### Alteracoes realizadas

- O historico passou a guardar uma versao explicita do estado retomavel da
  conversa, alem da transcricao de leitura.
- Conversas compativeis podem ser retomadas com mensagens, uso, pseudonimos e
  tarefas restaurados.
- Registros antigos ou incompletos continuam abrindo somente para leitura, sem
  tentar reconstruir um estado que nao existe.
- Restaurar ou apenas abrir uma conversa nao chama o provedor de IA.
- Chamadas de ferramenta interrompidas pelo fechamento do navegador voltam
  marcadas como falha, em vez de permanecerem eternamente em execucao.

### Arquivos sensiveis

- `agente-ia/src/painel/historico.ts`: versao e validacao do estado salvo.
- `agente-ia/src/painel/main.ts`: restauracao da conversa e da sessao.
- `agente-ia/tests/verificar-historico.ts`: compatibilidade e retomada.
- `ferramentas-pdf/src/lib/ferramentas/pdfjs.ts`: resolucao compartilhada do
  PDF.js usada pelo build.

## Fase 1C - copia de respostas

Commit original: `eccc518`

### Alteracoes realizadas

- Cada resposta concluida do agente recebe um botao de copiar no rodape.
- O botao tambem aparece em conversas restauradas do historico.
- Respostas ainda em streaming nao exibem o botao, para evitar copia parcial.
- A copia produz texto simples, removendo a marcacao Markdown e preservando
  paragrafos, listas e tabelas legiveis.
- A API moderna de clipboard possui fallback local para Chrome e Firefox.
- O painel informa sucesso ou falha sem incluir controles ou duracao no texto
  copiado.

### Arquivos sensiveis

- `agente-ia/src/painel/dom.ts`: conversao para texto e acesso ao clipboard.
- `agente-ia/src/painel/main.ts`: rodape e estado visual da copia.
- `agente-ia/estatico/agente.css`: apresentacao do rodape.
- `agente-ia/tests/verificar-dom.ts`: conversao e fallbacks.

## Politica de manutencao

- `master` e um espelho sem customizacoes de `upstream/master`.
- `homolog` contem a versao personalizada e recebe merges revisados da
  `master` a cada release oficial.
- As branches permanentes nunca recebem rebase nem force-push.
- Conflitos em arquivos gerados de `dist/js` nao sao resolvidos manualmente:
  primeiro se resolvem os fontes, depois o build regenera a distribuicao.
- A versao do manifesto usa quatro numeros. Para uma base oficial `X.Y.Z`, as
  revisoes proprias sao `X.Y.Z.1`, `X.Y.Z.2` e assim por diante. A tag
  correspondente e `vX.Y.Z-custom.N`.

O procedimento completo esta em [manutencao-fork.md](manutencao-fork.md).

## Validacao atual

- `npm run tipos`: aprovado.
- `npm run verificar`: 541 testes aprovados, 0 falhas.
- `npm run build`: aprovado; distribuicao atualizada em `dist/`.

## Testes manuais obrigatorios apos atualizar o upstream

1. Usar GPT-6 Luna em uma pergunta com ferramentas e confirmar um registro de
   uso por chamada em `chrome.storage.session`.
2. Guardar uma conversa, recarregar o navegador e retoma-la sem nova chamada
   automatica ao provedor.
3. Copiar uma resposta atual e outra arquivada, conferindo que o texto colado
   nao inclui Markdown, duracao nem controles da interface.
