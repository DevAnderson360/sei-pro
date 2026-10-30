# Controle de Prazos em TypeScript, com o controle de prazo nativo do SEI — desenho

Origem: comentário do seiproprf no PR #176 (09/10/2026), que propôs integrar o controle de prazo da
extensão ao controle nativo do SEI. Análise e decisão do autor na mesma data: **opção A** (vencimento no
nativo; hora e texto no marcador, só quando preenchidos). Este desenho também refatora a funcionalidade
inteira para TS, no padrão de Favoritos, Histórico e Projetos.

## Como é hoje

- Tudo é legado em `dist/js/sei-pro.js`: `addControlePrazo` (modal jQuery UI), `setPrazoMarcador` (grava),
  `setControlePrazo` (coluna "Prazos" na tabela), `initControlePrazo` (laço de espera até o `moment` carregar).
- O prazo é **texto do marcador**: `Até 25/09/2026 23:59\nResponder ofício`. Com "Até" é vencimento; sem
  "Até" é data inicial (mostra "há 5 dias"). Qualquer `DD/MM/AAAA` no texto de um marcador é reconhecido.
- Leitura: o tooltip do marcador na linha (`andamento_marcador_gerenciar`, `onmouseover`), sem requisição.
  Escrita: abre o formulário do marcador por POST dos `hdn*` da tela, e posta o `txaTexto` em ISO-8859-1.
- Consumidores do resultado, todos legados: `getDatesPreview`/`getDateSemantic` (`sei-functions-pro.js`,
  compartilhadas com Atividades), agrupamento "por prazo" e quadro Kanban (`sei-pro.js:77,133,2107`), painel
  de informações da árvore (`sei-pro-arvore.js:2128-2171`).
- Dores: o prazo **consome o marcador** do processo; contagem só em dias corridos; só quem usa a extensão
  consegue controlar; acento/travessão do Word quebram o marcador (hack `procLote_paraLatin1`).

## O que o controle nativo comporta (fonte SEI 5.0.0; fixture SEI 4.1.5)

| Dado | Nativo | Observação |
|---|---|---|
| Data de vencimento | sim | `dta_prazo`, só data. Data no passado é recusada (`validarDtaPrazo`) |
| Prazo em N dias, corridos ou úteis | sim | O servidor calcula, com os feriados do SEI |
| Concluir | sim | `dta_conclusao`, preserva o histórico |
| Quem definiu | sim | `id_usuario` = quem salvou por último |
| Hora, texto, marcador | **não** | Não há campo livre |
| Data inicial (contar desde) | **não** | O nativo é sempre um vencimento futuro |

Um registro por processo por unidade (`validarDuplicado`); `definir` é "criar ou alterar".
Permissão `controle_prazo_definir` depende do perfil do usuário.

## Decisões (confirmadas com o autor)

1. **Opção A.** Vencimento por data ou por dias vai ao nativo sempre que houver função e permissão. Hora,
   texto e marcador ficam no marcador, **só se preenchidos**. O campo Marcador passa a ser opcional.
2. **Sem nativo** (SEI sem a função, sem permissão, ou data já vencida): grava só no marcador, como hoje.
3. **Refatoração completa para TS** em módulo próprio `prazos/`, no padrão dos módulos recentes.
4. **Distribuição:** Lab MV3 (Chrome/Edge) primeiro, como Favoritos/Histórico/Projetos; oficial e Firefox
   mantêm o legado até uma etapa própria.
5. **Frota mista:** aceito. Prazo só-nativo não aparece na coluna das versões antigas do SEI Pro (o ícone
   do SEI continua visível). Entra no PRAZOS.md e no HISTORICO.md.
6. **Visão detalhada:** as duas colunas ficam (a nossa e a nativa do SEI).
7. **Remover:** como hoje, limpa o texto do marcador (não retira o marcador do processo); no nativo, exclui.
8. **Gravação em SEI real:** só no SEI SP de treinamento e no MJ de homologação (`hmlsei`). Nunca em
   produção.

## Verificação em SEI real (10/10/2026, SEI SP de treinamento 4.1.5)

Ciclo completo executado e desfeito (nada ficou gravado). Capturas viraram fixtures em `prazos/tests/fixtures`.

- **Ícone na linha confirmado.** `<a href="controlador.php?acao=controle_prazo_definir&…&id_controle_prazo=N&id_procedimento=P&…"
  aria-label="Controle de Prazo / SIGLA dd/mm/aaaa (ESTADO)" onmouseover="…infraTooltipMostrar('SIGLA dd/mm/aaaa (ESTADO)','Controle de Prazo')"><img src="svg/controle_prazo{1,2,3}.svg">`.
  `ESTADO` ∈ `N dias` | `até hoje` | `atrasado N dias` | `concluído em dd/mm/aaaa`. Ícone 1 no prazo/hoje,
  2 concluído, 3 atrasado. A sigla pode ser qualquer coisa (no SP é o login numérico): só o primeiro token.
  Retorno programado usa tooltip parecido (`SIGLA data (atrasado…)`), então o discriminador é o
  `href` com `acao=controle_prazo_definir` (ou `controle_prazo\d.svg`), nunca o texto.
- **Formulário sem mexer na seleção da tela.** POST ao link da barra (`acaoControleProcessos('…')`) com os
  campos da `#frmProcedimentoControlar` e `hdnRecebidosItensSelecionados` preenchido **só na cópia**
  devolve `#frmControlePrazoCadastro`. O `action` assinado (`acao_origem=controle_prazo_definir`) **serve
  para qualquer conjunto de ids e para todas as operações**: reutilizado em 5 POSTs de processos diferentes.
- **Gravar:** POST ao `action` com `rdoPrazo`, `txtPrazo`/`txtDias`/`chkSinDiasUteis`, `hdnIdProcedimentos`
  (lista por vírgula), `hdnIdControlePrazo` vazio e `sbmDefinirControlePrazo`. Sucesso = redirecionamento
  para `acao=procedimento_controlar`, e o corpo é a caixa já com os ícones novos. Alterar um existente com
  `hdnIdControlePrazo` vazio mantém o mesmo `id_controle_prazo`. Dias úteis: 5 úteis a partir de sábado
  10/10 = 16/10 (o servidor calcula). Concluir (`rdoPrazo=3`) mantém a data e põe `concluído em`.
- **Erro de validação não vem em `#txaInfraValidacao`.** No 4.1.5 a página reexibe o formulário (sem
  redirecionar) e a mensagem fica em `#divInfraMensagens .alert-danger` ("Data de prazo não pode estar no
  passado."). `verificarPagina` do núcleo não a vê: tratar sucesso pela URL final e ler esse elemento.
- **Excluir:** o `action` de exclusão está no JS da página de edição (`acaoExcluir`: `form.action='…controle_prazo_excluir…id_controle_prazo=N…'`),
  postado com `hdnIdControlePrazo`; a página de edição vem do próprio `href` do ícone. Redireciona à caixa.
- **Prova da fase 2 (10/10/2026):** o próprio código do módulo (`prazos/src/nativo`, empacotado e injetado na
  página do SP) rodou o ciclo inteiro com `criarHttp` do núcleo: ação assinada reaproveitada, data (+10), 2 ids
  em 5 dias úteis, hoje, alterar (mesmo `id_controle_prazo`), data passada (erro lido de `#divInfraMensagens`),
  concluir 2 ids e excluir 4 prazos; a resposta de cada gravação já traz os ícones novos. Nada ficou gravado.
- **SEI 5.0.4 validado (10/10/2026, MJ de homologação, unidade TESTE).** Mesmo formato do ícone e do
  `aria-label`; mesmo `#divInfraMensagens .alert-danger` para o erro de data passada; o módulo (com a extensão
  carregada) definiu por data, concluiu, removeu, gravou várias linhas em 5 dias úteis, fez o complemento no
  marcador e limpou tudo. No SEI 5 o `<input>` da caixa fica sob o rótulo (`label.infraCheckboxLabel`): quem
  testa por automação precisa clicar no rótulo. Dias úteis: o servidor do MJ pulou o feriado de 12/10 (5 úteis a
  partir de 10/10 = 19/10), prova de que o cálculo com feriados é do SEI.

## Desenho

### Modelo (puro, sem DOM)

`PrazoProcesso = { idProcedimento, vencimento?: Data, hora?: Hora, inicio?: Data, texto?: string,
concluidoEm?: Data, origem: "nativo" | "marcador" | "ambos", idControlePrazo?, sigla? }`.
Cálculo da situação (no prazo / hoje / atrasado / desde / concluído) usa direto `sei-comum/datas`
(dias, dias úteis, feriados). **Não** se extrai um núcleo comum com `favoritos/modelo/prazo.ts` e
`projetos/modelo/prazo.ts`: os modelos deles têm outra forma (referência por documento, etapas) e unificar
agora só aumentaria o risco sem ganho para este escopo.

### Fontes e leitura

- **Marcador:** o parser atual, portado com testes de paridade (formatos "Até DD/MM/AAAA HH:mm texto",
  só data, hora ausente = 23:59, texto com acentos).
- **Nativo:** o ícone de prazo da linha do Controle de Processos. O SEI monta o tooltip
  `SIGLA dd/mm/aaaa (N dias | até hoje | atrasado N dias | concluído em dd/mm/aaaa)` e o link do ícone
  traz `id_controle_prazo` (`ControlePrazoINT::montarIconeControlePrazo`). O ícone indica o estado:
  `controle_prazo1.svg` no prazo, `3` atrasado, `2` concluído. **Zero requisições**, no mesmo padrão
  das Anotações no controle. Plano B, se o ícone não for legível em alguma versão: uma requisição a
  `controle_prazo_listar` (paginada por ano).
- **Fusão por processo:** o nativo vence na data. O marcador contribui com hora e texto **se a data do
  marcador for igual à do nativo**; se diferir (alguém alterou o nativo pelo SEI), o marcador é tratado
  como defasado e não entra. Marcador "desde" (sem "Até") só aparece se não houver nativo. Prazo concluído
  no nativo aparece neutro (sem alerta) e não entra em "atrasados".
- **Visão detalhada:** o SEI já tem coluna nativa de Controle de Prazo quando configurada
  (`procedimento_controlar.php:827`). Pergunta aberta: esconder a nossa coluna nessa visão ou manter.

### Escrita

Reaproveita o transporte do núcleo (`sei-nucleo`: `criarHttp`, `Formulario`, conversão ISO-8859-1) e
`definirMarcador` para o complemento no marcador, em vez de repetir `$.ajax`. Detecção por **presença do botão nativo** na barra (`a[onclick*="acao=controle_prazo_definir"]`, presente
na fixture 4.1.5), não por número de versão.

1. Obter o formulário: POST ao link assinado da barra com os `hdn*` da tela (mesmo caminho do marcador).
   A resposta traz `#frmControlePrazoCadastro` com `action` assinado, `hdnIdProcedimentos` e
   `hdnIdControlePrazo`.
2. Gravar: POST ao `action` com `rdoPrazo` (1 data, 2 dias, 3 concluir), `txtPrazo` (`dd/mm/aaaa`),
   `txtDias`, `chkSinDiasUteis`, `hdnIdProcedimentos` (vários ids separados por vírgula),
   `hdnIdControlePrazo` vazio (o servidor acha o registro existente por processo e unidade) e
   `sbmDefinirControlePrazo`. O `action` assinado independe dos ids: um só serve a todos os lotes
   (verificado).
3. Resultado: sucesso é o redirect para `procedimento_controlar`, cujo HTML já traz os ícones novos; as
   linhas afetadas são relidas dali. Erro de validação ("Já existe…", "Data de prazo não pode estar no
   passado") vem na área de validação e é mostrado no modal. Datas ASCII: o hack de ISO-8859-1 só vale
   para o marcador.
4. Remover: `controle_prazo_excluir` (link assinado que vem do formulário com `id_controle_prazo`) e
   limpar o texto do marcador quando ele tiver prazo. Concluir: `rdoPrazo=3`, só no nativo.

Regras do botão Salvar do modal:

| Situação | Nativo | Marcador |
|---|---|---|
| Vencimento (data ou dias), nativo disponível, data de hoje em diante, sem hora/texto/marcador | grava | não toca |
| Idem, mas com hora, texto ou marcador preenchidos | grava | grava `Até dd/mm/aaaa HH:mm\ntexto` (marcador obrigatório) |
| Modo "data inicial" | não | grava (marcador obrigatório) |
| Data já vencida, ou sem nativo/permissão | não | grava (marcador obrigatório) |
| Em dias com marcador também | grava; a data vem **relida do nativo** | grava com essa data |

O marcador complementar mantém o formato atual para que versões antigas do SEI Pro (frota mista, 220 mil
usuários) continuem lendo. Quando o prazo vai **só ao nativo**, as versões antigas não o mostram na coluna
(o ícone do SEI continua visível). Isso entra no PRAZOS.md e no HISTORICO.md.

### Interface

- **Conteúdo da coluna "Prazos"** e **modal**, no desenho dos outros módulos: `dialog.spro-dialogo` do
  `sei-comum/ui` dentro de Shadow DOM, tema do SEI e modo noturno (`.seiSlim.dark-mode *` pinta `<path>`).
- **O esqueleto da coluna (th/td, tablesorter, filtro, agrupamento) continua do legado nesta entrega.**
  `setControlePrazo` segue criando `th/td.prazoBoxDisplay` e o tablesorter depende dela e de
  `data-time-sorter`; reescrever isso junto aumentaria muito o risco. O módulo preenche as células e
  atende ao clique. Mover o esqueleto para TS vira etapa posterior.
- **Ponte entre mundos** (o legado roda no mundo da página, o módulo no isolado): o módulo marca
  `<html data-spro-prazos="1">`; o legado, com a marca, deixa as células vazias e delega
  `addControlePrazo` por `CustomEvent("spro-prazos-abrir")` + `data-spro-prazos-alvo` (strings, que
  atravessam o limite de mundos). Sem a marca (oficial, Firefox, módulo ausente) o legado age como hoje.
- Modal: Controlar vencimento (liga/desliga), Data **ou** Em N dias (+ úteis), Hora (opcional), Marcador
  (opcional), Texto (opcional), Concluir, Remover. Aviso inline quando o resultado cair no marcador.
- **Contrato de DOM mantido** para os consumidores legados enquanto existirem: `td.prazoBoxDisplay`,
  `.dateboxDisplay[data-time-sorter]`, classes `tagTableText_date_*`, `infraTrAtrasada`/`infraTrAlerta`.
  `getDatesPreview` e `getDateSemantic` continuam no legado para Atividades.
- A coluna convive com o tablesorter e com as colunas opcionais das Anotações (`.spro-anotacao-coluna`):
  reaproveitar as lições de `setControlePrazo` (cabeçalho do filtro, contagem de colunas).
- Opção `gerenciarprazos` (ligada por padrão, `opcaoLegadaLigada`). Com o módulo ativo, o legado
  (`initControlePrazo`, `addControlePrazo`) se desliga por aviso do módulo, como nos demais.

### Estrutura

```
prazos/
  src/modelo/    prazo.ts, marcador.ts (parser/formatador), fusao.ts
  src/nativo/    leitura.ts (ícone), formulario.ts (GET/POST), resposta.ts (erros e sucesso)
  src/pagina/    coluna.ts, modal.ts, servico.ts (orquestra nativo + marcador), main.ts
  tests/         verificar.ts + fixtures capturadas
  build.mjs      → dist/js/init_prazos.js (esbuild, ASCII, igual a anotacoes-controle)
```

## Fases (cada uma com seu plano, testes e validação antes da seguinte)

1. **Modelo e marcador:** núcleo de datas comum, parser/formatador do marcador, fusão. Só biblioteca e
   testes de paridade com o legado. Nada publicado.
2. **Nativo:** leitura do ícone e escrita por formulário, com fixtures reais. Só biblioteca e testes.
3. **Células e modal** no Lab MV3, com o legado delegando ao módulo (ver "Ponte entre mundos"). Primeira
   versão publicável; a publicação (tag, release, lojas) é decisão do autor.
4. **Árvore, Informações adicionais e Kanban:** painel da árvore lê o nativo; edição de prazo dentro do
   processo. `pages/PRAZOS.md` e `HISTORICO.md` na mesma versão.
5. **Oficial e Firefox:** decisão e plano próprios.

## Provas e testes

- **Fixtures a capturar** (hoje não há ícone de prazo preenchido na linha): SEI 4.1.5 (treinamento SP) e
  SEI 5.0.4, com prazos em dia, hoje, atrasado e concluído; formulário de definição com vários
  processos; respostas de erro.
- **Testes** (`tsx` + `linkedom`, como nos outros módulos): parser do marcador (golden com os exemplos do
  PRAZOS.md), fusão, leitura do tooltip em português, montagem do POST, interpretação de sucesso e erro,
  situação por data com feriados.
- **Validação em SEI real:** gravação **somente no treinamento SP e em homologação**. Na produção da ANTAQ
  (SEI 5.0.4), só leitura, salvo autorização expressa, porque gravar cria registro real.
- **Regressão:** agrupamento por prazo, quadro Kanban, ordenação da coluna, árvore e Atividades continuam
  funcionando com o legado desligado nas partes migradas.

## Riscos e perguntas em aberto

1. SEI 5.0.4 (MJ de homologação): leitura do ícone e erro de validação podem diferir do 4.1.5.
   Plano B de leitura: `controle_prazo_listar`. Validar na fase 3 com sessão do usuário.
2. Versão mínima: o 4.1.5 tem o controle; abaixo disso não foi verificado. A detecção é pelo botão da
   barra, e a documentação deve dizer "SEI 4.1.5 ou superior" até haver prova de versões anteriores.
3. Mais de um prazo nativo por processo/unidade não existe (`validarDuplicado`); concorrência entre dois
   usuários grava o último (`definir` altera e passa o prazo a ser do usuário atual).

## Fora de escopo

Migração em massa de prazos de marcador para o nativo (pode virar uma ação própria depois); o gerenciador
de Atividades e `getDatesPreview`; mudanças em Favoritos ou no rename para "Monitorados"; Firefox e
oficial nesta primeira entrega.
