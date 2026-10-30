# Grade do Controle de Processos (visão nova) — desenho

Origem: pedido do autor (11/10/2026). O legado agrupa, filtra, ordena e monta o Kanban **mexendo no DOM da
tabela nativa** (`sei-pro.js`: `insertGroupTable`, `initUpdateGroupTable`, `addKanbanProc`, `setControlePrazo`,
`getProcessosPaginacao`...). Isso pisca a tela, clona linhas, briga com o tablesorter e quebra a cada versão do SEI.
Esta entrega cria uma **grade independente**, alimentada pela leitura da tabela nativa, no padrão dos módulos TS
recentes (Favoritos, Projetos, Demandas, Prazos).

## Decisões (confirmadas com o autor)

1. **Escopo único e completo:** grade, ordenação, filtro, agrupamento, Kanban com arrastar e soltar, e os recursos
   novos: visões salvas, busca com operadores, lote + envelhecimento + "novos", colunas/densidade/exportar CSV.
   A implementação é faseada (ver plano), a spec é uma só.
2. **Ativação:** a opção `gradecontrole` (página de opções, **desligada por padrão**) faz a visão nova abrir como
   padrão. Com a opção ligada, um botão sem rótulo (só tooltip) aparece ao lado do chevron e da ordenação da grade
   nativa e alterna para a visão nova; na visão nova, um botão equivalente volta à nativa. A troca vale na sessão
   da página; a opção é que decide qual abre.
3. **Paginação:** carregar tudo, progressivo. Renderiza a página atual na hora e lê as demais em segundo plano
   (contador "carregando 2/5"); o cache é por unidade.
4. **Só Lab MV3 (Chrome/Edge)**, como as outras entregas recentes. Oficial e Firefox mantêm o legado.

## Princípios

- **A tabela nativa nunca é removida nem reescrita.** Fica oculta por CSS. Os checkboxes e a barra de ações do SEI
  continuam sendo a fonte da verdade e o executor: selecionar na grade nova = clicar o checkbox nativo; uma ação
  em lote = clicar o botão nativo da barra. Nada de reimplementar Enviar, Atribuir, Concluir...
- **A grade é uma projeção:** só lê o modelo e emite intenções. Nenhuma regra do SEI vive na UI.
- **Nunca deixar o usuário sem tela:** qualquer falha ou atraso devolve a grade nativa.
- DOM seguro (contrato do Firefox): nada de `innerHTML` com texto do SEI; `h()` de `sei-comum/ui/dom`.

## Sem piscar (o ponto central)

O SEI entrega a tabela no HTML, sem AJAX. Então:

1. `document_start`: o content script lê a bandeira `spro_grade` do `localStorage` (síncrono; a opção a espelha a
   cada leitura do `chrome.storage`) e, se ligada, põe `data-spro-grade="1"` no `<html>` e injeta CSS que **oculta
   as tabelas nativas** (`#tblProcessosRecebidos`, `#tblProcessosGerados`, `#tblProcessosDetalhado`) e mostra um
   **esqueleto** (barra, cabeçalho, 8 linhas cinzas pulsando; respeita `prefers-reduced-motion` e o modo escuro).
2. `DOMContentLoaded`: lê a tabela, monta a grade (no Shadow DOM) e remove o esqueleto.
3. **Fallback:** erro de leitura, ou mais de 1,5 s sem montar, remove o atributo e devolve a nativa, com uma faixa
   discreta. O alternador "voltar à nativa" faz o mesmo de propósito.
4. Opção desligada ou fora do Controle de Processos: nada é injetado, nada oculto.

A bandeira em `localStorage` é só dica de primeira pintura; quem decide é `chrome.storage` (se divergir, corrige e
reavalia, no pior caso uma piscada na primeira vez após mudar a opção).

## Modelo (puro, sem DOM)

`Processo = { id, protocolo, grupo: recebidos|gerados, tipo, especificacao, sigiloso, naoVisualizado,
atribuicao?: {sigla, nome}, marcadores: {nome, cor, texto}[], anotacao?, prazo?, retornos[], acompanhamentoEspecial,
documentoNovo, pagina, naPaginaAtual, vistoEm }`.

- **Leitura da linha:** reaproveita `lerLinhaCaixa` (núcleo), `lerAnotacaoDaLinha` (anotações) e `lerPrazoNativo`
  + `fundir`/`resumir` (prazos). Marcadores: `a[href*=andamento_marcador_gerenciar]` (nome no tooltip, cor no nome
  do SVG, texto no `infraTooltipMostrar`). Retorno programado/aguardando: ícones `retorno_*.svg`.
- **Visão detalhada** (`#tblProcessosDetalhado`): colunas mapeadas **pelo texto do cabeçalho** (Tipo, Atribuição,
  Marcador, Data...), nunca pela posição.
- **Sigilosos:** o SEI já não entrega especificação nem sinais deles; a grade não tenta recuperar.
- **"Na caixa há N dias":** o SEI não traz a data na linha. Persistimos o instante em que o SEI Pro viu o processo
  pela primeira vez na unidade (`vistoEm`), e o rótulo diz isso no tooltip. "Novo desde a última visita" compara
  `vistoEm` com o instante da visita anterior. Só poda ids ausentes depois de uma carga **completa**.
- **Datas de recebimento, envio, autuação e último acesso** (agrupamentos do legado) exigem abrir cada processo.
  Ficam **fora desta entrega** (próxima etapa, sob demanda, com `consultarProcesso`/`andamentos` do núcleo).

## Busca com operadores

Uma caixa: `texto livre`, `"frase exata"`, `-negado`, `campo:valor`, `campo:<valor`, `campo:>valor`.
Campos: `resp`/`atribuido` (`resp:eu`, `resp:sem`), `tipo`, `marcador` (`marcador:sem`), `espec`, `anot`, `prazo`
(`prazo:atrasado|hoje|semana|sem|<7d|>30d`), `caixa` (idade: `caixa:>30d`), `novo`, `sigilo`, `grupo`
(`recebidos|gerados`), `retorno`. Sem acento e sem diferenciar caixa. Texto livre casa protocolo, tipo, especificação,
responsável, marcador e anotação. Operador desconhecido vira texto livre (nunca erro). O parser devolve também os
**tokens** para a UI desenhar chips removíveis e sugerir campos.

## Ordenação, agrupamento, visões

- Ordenação multi-critério (clique no cabeçalho; Shift acrescenta): protocolo, tipo, responsável, marcador, prazo,
  idade, novo. Estável. Números do SEI comparam por ano/sequência.
- Agrupar por: responsável, tipo, marcador, faixa de prazo, situação (novo/lido), recebidos/gerados, anotação,
  acompanhamento especial, retorno programado, idade. Processo com N marcadores aparece em cada grupo de marcador.
  Grupos recolhíveis, com contagem e (opcional) rodapé de prazos atrasados.
- **Visão** = `{ nome, busca, filtros, ordem, agrupar, modo: tabela|quadro, colunas, densidade, quadro: {...} }`.
  Visões salvas ficam no `chrome.storage.sync` (poucas e pequenas, por unidade e as globais); estado corrente
  (última visão, colunas, densidade, `vistoEm`, última visita) no `chrome.storage.local`.

## Tabela

Colunas configuráveis e reordenáveis: Processo, Tipo, Especificação, Responsável, Marcadores, Prazo, Anotação,
Na caixa, Sinais. Densidade compacta/confortável. Lista **virtualizada** (altura fixa por densidade; só desenha a
janela visível), checkbox por linha e "marcar todos os filtrados", estado vazio, contadores no cabeçalho
("37 de 212"). Teclado: `/` busca, `j/k` linhas, `x` marca, `Enter` abre, `g t`/`g q` tabela/quadro, `?` ajuda.

## Kanban

Colunas por **marcador** (mover = `definirMarcador`: tira o marcador de origem, põe o de destino), por **responsável**
(mover = `atribuirProcesso`), por **faixa de prazo** e por **tipo** (só leitura: o cartão não arrasta, e a coluna
diz o porquê). Arrastar e soltar com atualização otimista, **desfazer** (aviso com ação, 8 s), reversão e aviso se o
SEI recusar. Limite de itens por coluna (WIP, opcional, com realce), raias por responsável (opcional), coluna "Sem
marcador". Mover de/para grupo de outra página funciona (a gravação é por id, por requisição).

## Lote

Barra flutuante com a contagem. Os botões vêm **da barra nativa** (`#divInfraBarraComandosSuperior a[onclick]`,
ícone e rótulo do próprio SEI) e o clique é repassado ao link nativo. Limite do SEI: só processos da **página nativa
atual** têm checkbox; linhas de outras páginas ficam sem caixa de seleção, com tooltip explicando, e a barra avisa
quando houver filtro escondendo selecionados.

## Exportar CSV

A visão atual (filtrada, ordenada, só colunas visíveis ou todas), com BOM UTF-8 e separador `;` (Excel pt-BR), via
`gerarCsv` e `baixar` de `sei-comum`. Protege contra injeção de fórmula (`=`, `+`, `-`, `@` no início da célula).

## Convivência com o legado

Com `data-spro-grade="1"` o legado **não monta** o que a grade substitui: `insertGroupTable` (filtro, agrupar,
Quadro/Tabela, CSV), `initProcessoPaginacao` (removepaginacao, que clonaria linhas na tabela nativa), kanban e
`#processosProActions`. Prazos e Anotações continuam desenhando nas linhas nativas (ocultas) sem prejuízo: a grade
**lê** os ícones, não as células deles. Painéis abaixo (Monitorados, Demandas, Projetos) não mudam. Sem a marca
(oficial, Firefox, opção desligada) o legado age como hoje.

## Estrutura

```
grade-controle/
  src/modelo/    tipos, busca, filtro, ordem, grupos, idade, visoes, quadro, exportar
  src/leitura/   linha, tabela (resumida/detalhada), barra
  src/paginas/   carregar (progressivo, com retorno à página 0)
  src/acoes/     selecao, barra, mover (marcador/atribuição + desfazer)
  src/ativacao/  inicio (document_start + esqueleto + fallback), botao
  src/ui/        app, tabela, quadro, ferramentas, lote, colunas, visoes, ajuda, atalhos
  src/persistencia/  armazem
  tests/         verificar.ts + fixtures (4.1.5 reais; detalhada e 5.0.4 sintéticas até haver captura)
  build.mjs      -> dist/js/init_grade_controle.js (esbuild, ASCII)
```

## Provas e testes

- Unidade (`tsx` + `linkedom`): leitura contra as fixtures reais do SEI 4.1.5 (as `caixa_*.html` dos Prazos);
  busca/filtro/ordem/grupos/visões/idade/CSV; carregador com `Http` falso (inclui retorno à página 0 e falha no meio);
  mover com núcleo falso (sucesso, recusa, desfazer); ativação (atributo, esqueleto, fallback por erro e por prazo);
  seleção espelhada e lote repassando ao link nativo; UI renderizada no linkedom.
- **Navegador real:** o bundle é injetado numa página servida a partir da fixture (com `chrome` simulado) e
  exercitado por Chrome DevTools: esqueleto → grade, sem piscar (captura de tela sequencial), ordenar, buscar, agrupar,
  arrastar no quadro, lote, modo escuro, largura estreita, desempenho com 3 000 linhas.
- Regressão: o legado continua inteiro com a opção desligada (comparação do HTML da tela).
- Validação em SEI real (SP de treinamento e MJ de homologação): leitura sempre; **gravação (mover no quadro) só
  nesses ambientes**, nunca em produção.

## Riscos e perguntas em aberto

1. Estrutura da **visão detalhada** e do **SEI 5.0.4**: leitor tolerante e testado com fixtures sintéticas; precisa
   de captura real para travar (anotado como pendência).
2. Posição exata do botão "ao lado do chevron e da ordenação": ancora pela barra de título do controle (como
   `ordem-paineis`) e se ajusta na validação em SEI real.
3. Fluxo de lote entre páginas: limitado pelo SEI (ver Lote).
4. Mais de uma instalação do SEI Pro lendo a mesma bandeira: a grade checa `data-spro-grade` antes de montar.

## Fora de escopo

Agrupamentos por datas que exigem abrir cada processo; Firefox e oficial; unificar com o modelo de prazo de
Favoritos/Projetos; remoção do código legado (só é desligado por aviso; a remoção é etapa própria depois de
validado em campo).

## Estado da implementação (11/10/2026)

Implementado em `grade-controle/` (branch `feat/grade-controle`), bundle em `dist/js/init_grade_controle.js`, registrado
no `dist/manifest.json` (`document_start`), opção `gradecontrole` na página de opções (desligada por padrão) e porta no
legado (`sei-pro.js`: `insertGroupTable`, `initProcessoPaginacao`, `initAddKanbanProc`, `addKanbanProc` retornam com
`data-spro-grade`).

Provas: 100+ testes (`npm run verificar`), tipos limpos, e Chrome real servindo a fixture do SEI 4.1.5: tabela nativa
oculta já no primeiro quadro (13 ms), grade pronta em ~30-50 ms, sem piscar; 3 000 processos carregados em ~0,5 s com 21
linhas no DOM; filtro e rolagem em milissegundos; fallback devolve a nativa em ~1,5 s quando a grade trava.

Pendências que dependem de SEI real: gravação do quadro (mover marcador/atribuir), visão detalhada e SEI 5.0.4 com
fixtures reais, e a posição exata do botão ao lado do chevron. Ao voltar à visão nativa na mesma sessão o legado
(que não rodou) só reaparece ao recarregar a página.
