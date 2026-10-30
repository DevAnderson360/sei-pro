# Gestor de Demandas (SEI Pro): spec de projeto

Data: 10/10/2026. Estado: proposta para revisão. Código: nada ainda.
Documentos irmãos: `2026-10-10-demandas-mapa-gestor-atividades.md` (inventário do legado e roteiro) e `docs/superpowers/plans/2026-10-10-demandas.md` (plano de implementação).

## 1. Propósito e entendimento

O Gestor de Atividades (ANTT e ANTAQ) é poderoso, mas só funciona com backend próprio. O **Gestor de Demandas** leva a mesma filosofia (demanda com responsável e prazo, estado derivado das datas, visões de tabela, quadro e cronograma, painel de números) a **qualquer órgão**, sem servidor, e com a ferramenta simples de usar.

Decidido com o autor:

- Vive na camada TypeScript, em pacote próprio `demandas/`, sobre `sei-comum` e `sei-nucleo`, ao lado de `projetos/`, `favoritos/` e `historico/`. Nome do painel: **Gestor de Demandas** (não "Atividades", para não confundir com o da ANTT).
- **Armazenamento**: `chrome.storage.local` + **Texto Padrão do SEI** (colaboração da unidade e nuvem) + **arquivo JSON local** (a nuvem corporativa do usuário, por escolha dele). **Sem backend.**
- **Cada "tabela" em um Texto Padrão separado**, para escalar além dos 100 KB de um texto só (seção 4).
- **A v1 inclui**: criar demanda, atribuir a um responsável, visões Tabela, Quadro e Cronograma, painel de estatísticas. Campos: processo SEI, etiquetas e prioridade, checklist, tempo estimado e gasto, vínculo com **etapa do Gestor de Projetos**. Ações: iniciar, pausar e retomar, concluir, prorrogar com histórico, arquivar, avaliar com nota de 1 a 5, excluir e restaurar. Visibilidade como no Projetos: **Toda a unidade** ou **Só eu**.
- **Fora da v1** (documentado como roteiro R1 a R13 no mapa): recorrência, multiplicar e clonar, dependência entre demandas, e todo o PGD.
- **Limites pelo tamanho do Texto Padrão**, aviso a 80% e bloqueio de criação a 100%, e alertas de arquivamento.
- Aparece como painel no Controle de Processos (entra na Ordem dos painéis) e aba no painel lateral, com selo de atrasadas.
- Entrega só no **Lab MV3** (Chrome/Edge), como Favoritos, Histórico e Projetos na 2.7. Oficial e Firefox ficam para a etapa seguinte.
- Segue o desenho e os princípios do Projetos e dos Monitorados: DOM seguro (`h()`), modal sem botão Cancelar, tokens `--spro-*`, tema claro e escuro, tudo em português.

Critérios de sucesso: (a) uma unidade nova usa sem configurar nada além de ligar a opção e aceitar o aviso do Texto Padrão; (b) nenhum dado se perde se um Texto Padrão for editado, apagado ou ficar grande demais; (c) a v1 não passa de ~6 telas e nenhum conceito exige manual.

## 2. Abordagem escolhida

Três caminhos foram considerados.

| Caminho | Resumo | Veredito |
|---|---|---|
| **A. Pacote novo `demandas/`, reaproveitando `sei-comum`, com adaptadores por tabela** | Mesmo molde do Projetos e do Histórico. Um motor de Texto Padrão por tabela. Importa do Projetos só código puro, por alias (`@projetos/...`), como o Histórico já faz com `@favoritos/...`. | **Escolhido.** Isolamento (liga e desliga sozinho), sem arriscar o Projetos publicado. |
| B. Estender o pacote `projetos/` com um tipo de entidade `d` | Uma só base e um só Texto Padrão. | Descartado: o Projetos está em P6 (validação final) e o limite de 100 KB seria compartilhado; é o oposto de escalar. |
| C. Módulo mínimo só com arquivo JSON | Sem Texto Padrão. | Descartado: perde a colaboração da unidade, que é o ponto de "atribuir para um responsável". |

Dívida registrada: `gantt/montar.ts` e `modelo/calendario.ts` do Projetos são código genérico que o Demandas importa por alias. Quando o Projetos fechar a P6, promover ambos para `sei-comum` (tarefa fora deste plano).

## 3. Modelo de dados

Toda entidade é `Versionada` (`id`, `atualizadoEm`, `dispositivo`, `removidoEm?`) e leva `alteradoPor` (login). Datas civis são `DataISO` ("AAAA-MM-DD", fuso local; nunca `toISOString()`); instantes são milissegundos.

```ts
type Prioridade = "normal" | "importante" | "urgente";
type Vis = "unidade" | "eu";            // igual ao Projetos

interface Demanda extends Entidade {
  titulo: string;                       // até 200
  descricao?: string;                   // até 2000
  responsavel?: { login?: string; nome: string };
  distribuidaEm: DataISO;               // padrão: hoje
  prazo: DataISO;
  prazoOriginal?: DataISO;              // fixado na primeira prorrogação
  prioridade: Prioridade;
  etiquetas: string[];                  // até 10, 40 caracteres cada
  processos: Vinculo[];                 // até 5; sigiloso vai vazio ao Texto Padrão
  checklist: ItemChecklist[];           // até 50 itens
  tempoEstimadoMin?: number;
  tempoGastoMin?: number;               // informado ao concluir
  etapa?: { projeto: string; etapa: string; rotulo: string }; // rotulo = "Projeto > Etapa" (cópia para exibir sem o Projetos)
  iniciadaEm?: number;
  pausas: { inicio: number; fim?: number }[];   // até 20
  concluidaEm?: DataISO;
  observacaoConclusao?: string;         // até 2000
  documentoEntregue?: DocumentoSei;     // opcional
  avaliacao?: { nota: 1 | 2 | 3 | 4 | 5; comentario?: string; por: string; em: number };
  arquivadoEm?: number;
  ordem: string;                        // índice fracionário (ordem dentro da coluna do quadro)
  criadoEm: number;
}

interface Registro extends Entidade {   // tabela h: só se acrescenta
  demanda: string; quando: number; por: string; nome?: string;
  campo: CampoHistorico;                // criacao, exclusao, restauracao, titulo, responsavel, prazo,
                                        // prioridade, inicio, pausa, retomada, conclusao, reabertura,
                                        // avaliacao, arquivamento, desarquivamento, etapa, visibilidade
  antes?: string; depois?: string;      // até 400 cada
  motivo?: string;                      // até 200; obrigatório na prorrogação
}
```

### 3.1 Estado derivado (não existe campo `status`)

Função pura `situacaoDe(d, hoje)` em `modelo/situacao.ts`, na ordem:

1. `arquivadoEm` presente: **arquivada**.
2. `avaliacao` presente: **avaliada**.
3. `concluidaEm` presente: **concluída**.
4. última pausa sem `fim`: **pausada**.
5. `iniciadaEm` presente: **iniciada**.
6. senão: **não iniciada**.

`prazoDe(d, hoje)` é ortogonal ao estado: `no_prazo`, `atrasada` (`prazo < hoje` e não concluída), `concluida_no_prazo`, `concluida_fora_do_prazo`. Cor e ícone usam as mesmas quatro classes do legado (verde, laranja, vermelho, neutro).

### 3.2 Transições (Quadro e menu)

`modelo/operacoes.ts`, funções puras que devolvem a nova demanda e o `Registro`, ou erro tipado. Matriz do Quadro (espelha o legado, FE:16901-16929):

| De | Para | Efeito |
|---|---|---|
| não iniciada | iniciada | `iniciadaEm = agora` |
| iniciada | não iniciada | zera `iniciadaEm` e as pausas |
| iniciada | pausada | abre pausa |
| pausada | iniciada | fecha pausa (retomar) |
| iniciada ou pausada | concluída | pede data, tempo gasto, observação; fecha pausa aberta |
| concluída | iniciada | reabrir: limpa `concluidaEm`, `tempoGastoMin` e observação (ficam no histórico) |
| concluída | avaliada | pede nota (1 a 5) e comentário |
| avaliada | concluída | cancela a avaliação |
| concluída ou avaliada | arquivada | `arquivadoEm = agora` |
| arquivada | concluída ou avaliada | desarquivar (volta ao estado de antes, derivado das datas) |

Qualquer outro movimento é recusado com mensagem curta. Prorrogar muda `prazo` (nunca para antes de `distribuidaEm`), guarda `prazoOriginal` na primeira vez e exige motivo.

## 4. Armazenamento e sincronização

### 4.1 Local

`chrome.storage.local`, uma chave por entidade (classe `Colecao` do `sei-comum`):

```
demandas/<host>|<login>|u:<idUnidade>/<un|eu>/<d|h>/<id>      + .../meta
demandas/preferencias            (local)
demandas/contadorPainel          (selo da aba lateral)
demandas/sync/tp/<escopo>/<tabela>      (status de cada Texto Padrão)
demandas/sync/arquivo/<host>|<login>
demandas/usuarios/<host>|u:<idUnidade>   (cache de 1 dia dos usuários da unidade)
demandas/lateralAberto
```

Há **duas coleções locais** (`d` demandas, inclusive arquivadas, e `h` registros). As três "tabelas" do Texto Padrão são projeções de `d`.

### 4.2 Texto Padrão: uma tabela por texto

| Tabela | Conteúdo | Nome do texto (unidade) | Nome (pessoal) |
|---|---|---|---|
| `d` | Demandas **não arquivadas** (e lápides delas) | `[_SEIPRO_DEM_UNIDADE_D]` | `[_SEIPRO_DEM_<login>_D]` |
| `a` | Demandas **arquivadas** (e lápides) | `[_SEIPRO_DEM_UNIDADE_A]` | `[_SEIPRO_DEM_<login>_A]` |
| `h` | Registros do histórico | `[_SEIPRO_DEM_UNIDADE_H]` | `[_SEIPRO_DEM_<login>_H]` |

`nomeDeTextoInterno("DEM", "UNIDADE_D")` encurta com hash se passar de 50 caracteres. O texto pessoal fica desligado por padrão, com convite no painel (como no Projetos).

Cada texto tem **o próprio motor** (`MotorTextoPadrao`), o próprio `chaveStatus`, trava, teto, assinatura e mensagens. O orquestrador `sincronia/orquestrador.ts` roda os motores da unidade e do pessoal e agrega o estado; **a falha de uma tabela não bloqueia as outras** (o histórico grande demais não impede as demandas de sincronizarem).

Particionar `d`/`a` por `arquivadoEm`: a mesclagem local é por id e por carimbo, então uma demanda arquivada vence a cópia antiga não arquivada que um colega ainda tenha em `d`, e a exportação passa a pô-la em `a`. Não precisa de lápide para "mover" entre tabelas. Lápide só é gravada na exclusão de verdade e vai para a tabela do estado em que a demanda estava.

Dentro de uma tabela valem as regras do Projetos: JSON, gzip, base64url em parágrafos de 2000 caracteres (`codec.ts`), lápides de 180 dias (unidade) ou 90 (pessoal), reler logo antes de gravar (3 tentativas), envio 15 s depois da última mudança, recuo crescente, consentimento por `host|login|unidade`, texto de versão mais nova nunca é sobrescrito, texto inválido é guardado antes de ser regravado.

Envelope: `{ formato: "seipro-demandas", versao: 1, tabela: "d"|"a"|"h", host, unidade, vis, login?, gerado, entidades: { d: Demanda[] } | { h: Registro[] } }`.

### 4.3 Limites pelo tamanho

O tamanho do **conteúdo do HTML** de cada texto manda (o motor já mede). Por tabela: `AVISO = 80 KB`, `TETO = 100 KB` (o CKEditor 5 baixa o conteúdo dos textos da unidade, razão do teto).

| Faixa de uso da tabela | Comportamento |
|---|---|
| até 80% | Silencioso. Menu de ajustes mostra "Uso do Texto Padrão: 42%". |
| 80% a 99% | Faixa amarela no topo: "As demandas estão perto do limite do Texto Padrão (X de 100 KB)" com ação **Arquivar concluídas antigas…** (seção 4.5). |
| 100% ou mais | **Criação de demanda bloqueada** (e duplicar/restaurar). Editar, concluir e arquivar continuam. O motor não grava o texto grande demais; os dados ficam no local. Faixa vermelha com a mesma ação. |
| Soma das três tabelas acima de 200 KB | Aviso de peso total (risco do CKEditor; seção 10). |

O teto **numérico** de segurança por envelope também existe (como `TETOS_ENVELOPE` do Projetos): `d` 3000, `a` 10.000, `h` 15.000 itens; acima, o texto é tratado como inválido.

**Quantas demandas cabem** (medido na D5, demandas típicas com descrição, 4 itens de checklist, 1 processo e responsável): 100 demandas = 19,1 KB; 250 = 45,3 KB; 500 = 88,6 KB; 1000 = 175,3 KB; 2000 = 349,3 KB. Interpolando, o aviso (80 KB) chega em cerca de 450 demandas e o teto (100 KB) em cerca de 560. A ajuda mostrará "cabem cerca de 500 demandas ativas por unidade", e o limite continua sendo o tamanho, não a contagem. O histórico (1500 registros, o corte de `LIMITES.historicoNoTexto`) pesa cerca de 19,6 KB, folgado frente ao teto, então o corte não mudou. Alerta de desempenho independente do tamanho: acima de **800 demandas ativas** (não arquivadas) no escopo, faixa "Muitas demandas ativas deixam a tela lenta. Arquive as concluídas."

O histórico se poda sozinho: ao exportar, fica o mais recente que cabe em 70 KB (corte por tamanho estimado); o excedente permanece no local e no arquivo, nunca é apagado.

### 4.4 Arquivo JSON local (a nuvem do usuário)

Mesmo desenho da `SincroniaArquivo` do `sei-comum` (File System Access, handle no IndexedDB `seipro-demandas`; no Firefox, Exportar e Importar). Formato `seipro-demandas`, `versao: 1`, todas as tabelas, **todos os escopos do usuário**, inclusive arquivadas e todo o histórico: é a rede de segurança e o arquivo morto. Garantias contra perda de dados:

1. **Mescla ao ler, nunca sobrescreve.** Antes de gravar o arquivo, o módulo lê o que está nele e mescla por entidade; só então grava. Um arquivo alterado por outro computador (OneDrive, Drive) não é sobrescrito às cegas.
2. **Gravação atômica** (`createWritable` troca o arquivo só no `close`).
3. **Cópias diárias**: 14 mais recentes, no IndexedDB (`copias`), restauráveis; restaurar não desfaz edições dos colegas.
4. **Sem teto de 100 KB**, mas com **aviso em 5 MB** (o `storage.local` tem 10 MB divididos entre Favoritos, Histórico, Projetos e Agente): "O arquivo ficou grande; exporte um arquivo morto e remova as arquivadas antigas."
5. **Autonomia**: o arquivo é opcional. Sem ele, o Texto Padrão e o local seguem. O arquivo nunca é pré-requisito para o motor.

### 4.5 Arquivamento e arquivo morto (alertas)

Ação **Arquivar concluídas antigas…** (menu de ajustes e faixas de alerta): diálogo com "concluídas há mais de N dias" (30, 60, 90, 180), mostra quantas são e quanto libera, e arquiva em lote (vão da tabela `d` para `a`; não há perda).

Ação **Exportar arquivo morto e limpar…**, quando a tabela `a` também enche: baixa um `.seipro-demandas-arquivo-AAAA-MM.json` com as arquivadas de antes de uma data; **só depois** de o usuário confirmar que o arquivo foi salvo (botão "Já guardei o arquivo") remove essas demandas do Texto Padrão e do local (viram lápides). Depois do descarte, a lápide vence durante 180 dias (escopo `unidade`) ou 90 dias (escopo `eu`): importar o arquivo morto traz de volta só o que não foi excluído nesse prazo (o diálogo diz isso); passado o prazo, a importação mescla e a demanda volta.

### 4.6 Privacidade

- Número de processo sigiloso nunca vai ao Texto Padrão nem ao arquivo de colega: o vínculo vai vazio com `sigiloso: true`, igual ao Projetos. Reutiliza a memória local do sigilo (`@projetos/modelo/memoriaSigilo`, mesmas chaves `projetos/sigilo/...`) para que o que o Projetos aprendeu valha aqui. O arquivo JSON do próprio usuário leva os números.
- Título e descrição são texto livre do usuário. Aviso único no consentimento: "Não escreva dados sigilosos no título ou na descrição: ficam no Texto Padrão e todos da unidade os leem."
- O Texto Padrão da unidade é editável por todos da unidade com SEI Pro. Aceita-se, como no Projetos: o dado local nunca é apagado por texto alheio, e texto adulterado é recusado pela validação.

## 5. Telas

Um app (`html/demandas.html`, iframe da extensão) com três modos: `#modo=embutido` (painel do Controle), `#modo=lateral` (aba do painel lateral) e `#modo=pagina` (aba inteira, usada pelo "abrir em tela cheia" e pelos testes).

Estrutura, igual ao Projetos: cabeçalho (título, busca, **Nova demanda**, menu de ajustes), abas de visão, barra de filtros, conteúdo.

### 5.1 Cabeçalho e filtros

- Escopo: "Toda a unidade" | "Só eu" | "As duas" (padrão "As duas", com selo do escopo no cartão).
- Filtros (E entre campos, OU dentro do campo, como no Projetos): responsável (inclui "Sem responsável" e "Só minhas"), situação, prazo (atrasadas, esta semana, sem prazo), prioridade, etiqueta, etapa do projeto, busca por texto (título, descrição, processo).
- Menu de ajustes: Importar/exportar arquivo, cópias, **Arquivar concluídas antigas…**, Uso do Texto Padrão, preferências (visão padrão, concluídas dos últimos N dias no Quadro), ajuda.

### 5.2 Visão Tabela

Colunas: prioridade (barra de cor), título (com checklist e etiquetas), processo(s), responsável (avatar), prazo (com semáforo e dias de atraso), situação (pílula), progresso do checklist, tempo (estimado/gasto). Ordenar por coluna. Linha com menu de contexto: iniciar, pausar, concluir, prorrogar, avaliar, arquivar, duplicar, excluir, histórico. Edição inline de título, prazo e etiquetas. Seleção em lote para arquivar e excluir. Reaproveita `pilulaDaSituacao` e `barraDeProgresso` do Projetos.

### 5.3 Visão Quadro (Kanban)

Colunas: **Não iniciadas**, **Iniciadas**, **Pausadas**, **Concluídas**, **Avaliadas**; **Arquivadas** só com o filtro "Mostrar arquivadas". Arrastar o cartão aplica a matriz da seção 3.2; movimento inválido volta com aviso, e os que pedem dados (concluir, avaliar) abrem o diálogo antes de gravar (cancelar o diálogo devolve o cartão). Cartão: prioridade, título, responsável, prazo com semáforo, etiquetas, barra do checklist. Concluídas e Avaliadas mostram os últimos 30 dias (preferência), com "ver mais". Ordem dentro da coluna por `ordem` (índice fracionário, `@comum/ordem/indice`). Arrastar por HTML5 nativo (sem biblioteca). Alternativa por teclado: o menu do cartão tem "Mover para…".

### 5.4 Visão Cronograma (Gantt)

Frappe Gantt vendorizada do Projetos, via `gantt/montar.ts`: uma barra por demanda, da **distribuição ao prazo**; cor pela situação/prazo (fora do prazo, no prazo, iniciada, iniciada em atraso, concluída no prazo, concluída fora do prazo); progresso = checklist ou 50% se iniciada. Escalas Dia, Semana, Mês. Agrupar por responsável (padrão) ou por situação. Arrastar a ponta direita muda o `prazo` (com motivo, é uma prorrogação) e a esquerda muda `distribuidaEm`; mudança recusada pelo repositório volta. Sem setas de dependência na v1 (R3). Se a Frappe falhar, cai para a Tabela com aviso, como no Projetos.

### 5.5 Painel de estatísticas

Cálculo puro em `modelo/estatisticas.ts`, sem biblioteca de gráfico (SVG com `h()`), filtrável por período (30 dias, 90 dias, 12 meses, tudo), responsável, etiqueta e escopo.

1. **Situação geral e atrasadas**: contagem por situação (cartões clicáveis que filtram a Tabela), lista das atrasadas por dias de atraso.
2. **Carga por responsável**: por pessoa, abertas, atrasadas e concluídas no período, em barras empilhadas; "Sem responsável" destacado.
3. **Entregas por mês e prazo médio**: barras de concluídas por mês (no prazo e fora do prazo); prazo médio em dias da distribuição à conclusão; % no prazo.
4. **Estimado x gasto e nota média**: soma de horas estimadas e gastas das concluídas, desvio médio; média das notas e distribuição de 1 a 5.

### 5.6 Diálogos

Todos `<dialog class="spro-dialogo">` (sem Cancelar; X e Esc): **Demanda** (campos obrigatórios no topo: título, responsável, prazo; "Mais campos" recolhido com descrição, prioridade, etiquetas, processos, checklist, tempo estimado, etapa do projeto, escopo), **Concluir** (data, tempo gasto, observação, documento entregue opcional), **Prorrogar** (novo prazo e motivo), **Avaliar** (estrelas e comentário), **Histórico da demanda**, **Consentimento do Texto Padrão**, **Sincronização** (estado das três tabelas, erros e pendências), **Arquivar concluídas antigas**, **Arquivo morto**, **Importar/exportar arquivo**.

### 5.7 Responsável e etapa

- Responsável: **lista parcial e sem requisição**, o mesmo mecanismo e o mesmo cache do Projetos (`usuariosDaUnidade`, chave `projetos/usuarios/<host>|u:<unidade>`): quem aparece com processo atribuído na caixa do Controle de Processos, os responsáveis já usados nas demandas e nas etapas da unidade e o próprio usuário (no topo), e o campo **aceita texto livre**. A lista completa dos usuários da unidade só se alcança abrindo a árvore de um processo, e isso grava "Processo recebido" em nome do usuário (`project_arvore_marca_recebido`), então fica de fora. Consequência para o usuário: "atribuir a um colega" funciona quando o colega já apareceu na caixa ou numa demanda; senão, digita-se o nome. No escopo "Só eu", o responsável é o próprio usuário e o campo some.
- Etapa do projeto: combobox de projetos e etapas abertas do **Gestor de Projetos da mesma unidade**, lidas do `RepositorioProjetos` (somente leitura, via `@projetos/repositorio`). Sem o Projetos ligado, o campo mostra só o `rotulo` guardado. Concluir a demanda **não** conclui a etapa (v1), só oferece "Concluir também a etapa?" com um clique, usando `concluirSeAberta` do Projetos.

## 6. Integração

| Ponto | Decisão |
|---|---|
| Opção ligar/desligar | `gerenciardemandas`, "Gestor de Demandas", **desligada por padrão** (`opcaoLegadaMarcada`; é novo). Linha em `options.html` hoje; vira linha do `schema-dados.ts` quando o redesign das opções (`opcoes-pagina/`) pousar. |
| Content script | `dist/js/init_demandas.js` (IIFE, `document_start`, `all_frames`), marca `<html data-seipro-demandas>`. Só o frame de topo no Controle de Processos monta o painel; carrega o resto por `import()` se passar de 16 KB (padrão carregador do Projetos). |
| Painel embutido | `montarPainelEmbutido`, id `demandasPro`, título "Gestor de Demandas". Entra na Ordem dos painéis (`NOMES` em `ordem-paineis/src/modelo.ts`). |
| Aba lateral | Aba "Demandas" em `favoritos/src/shell/painel.ts` (flag `temDemandas`), mapa de abas do `dist/background.js`, selo = **minhas demandas atrasadas** (`CHAVE_CONTADOR_DEMANDAS` em `sei-comum/src/painel/contadores.ts`). Visão lateral: Agenda (atrasadas, esta semana, sem responsável) e "Nova demanda". |
| Ícone | `demandas` no catálogo `ICONES` de `sei-comum/src/ui/dom.ts`, `_data/icones.yml` e `_includes/icones.svg`. |
| Manifest | Só `dist/manifest.json` (Lab): bloco de `content_scripts` e entradas no WAR (`html/demandas.html`, `js/demandas/app.js`, `css/demandas.css`). Oficial e Firefox sem o módulo (a receita de geração do oficial já tira os módulos TS). |
| Botão no processo (D17) | Um botão "Demandas" na barra de ações do processo (`#divArvoreAcoes` do visualizador: no SEI 4.1 o `ifrConteudoVisualizacao`, com o `ifrVisualizacao` aninhado; no SEI 5 o visualizador único), com a mesma lógica do legado (`getInsertIconAtividade`). O content script roda nesse frame (`principalArvore`); o processo e o documento aberto vêm só da árvore que o frame vizinho já desenhou (nunca se busca a árvore). O clique abre um balão em Shadow DOM, num pacote à parte (`js/demandas/balao.js`, sob demanda; WAR só no manifest Lab), com as demandas já ligadas ao processo (Iniciar, Concluir com este documento…, Abrir no painel), "Nova demanda deste processo" e "Concluir com este documento" preenchidos pela tela. Grava sempre pelo `RepositorioDemandas`; "Entendi" do Texto Padrão antes da 1ª gravação em "Toda a unidade"; sigiloso sem número no texto. |
| Ícone na grade (D18) | Na grade do Controle de Processos (Recebidos e Gerados, visões por detalhes e por marcadores, SEI 4.1 e 5), um ícone colorido (o mesmo desenho do botão da barra, 20 px, na 2ª célula depois do ícone dos Projetos ou da estrela dos Favoritos) em cada linha cujo processo tenha ao menos uma demanda **não arquivada**, nos dois escopos, com selo azul de contagem a partir de 2 e `title`/`aria-label` "N demanda(s) neste processo". O índice `protocolo (só dígitos) -> demandas` sai de uma leitura dos dois escopos e é refeito (um quadro de atraso) quando as chaves `demandas/...` mudam; um observador da grade repinta sem reler o storage (paginação, "Ver todos", clone do legado). O clique abre o mesmo balão da D17 (sob demanda), ancorado ao ícone, com o processo da linha (protocolo, `idProcedimento`, tipo; sem especificação, sem documento aberto); o mesmo ícone fecha. Só a lista que a página já desenhou (`lerLinhaCaixa`); processo sigiloso é marcado (`marcarSigilosos`) e nunca mostra especificação. Só na tela "caixa", com a opção ligada. |
| Convivência com o legado | O Gestor de Atividades (ANTT/ANTAQ) é outro painel (`atividadesPro`) e fica intacto. Nenhuma alteração em `init.js`. |
| Permissões | Nenhuma nova (`storage` basta). |
| Agente de IA | Fora da v1 (R13). |

## 7. Estrutura do pacote

```
demandas/
  package.json  tsconfig.json  tsconfig.pagina.json  biome.json  build.mjs
  estatico/demandas.html  estatico/demandas.css
  src/
    modelo/    tipos constantes escopo validacao situacao operacoes filtro estatisticas
               alertas (tamanho e quantidade) historico sigilo(adaptação) calendario(import)
    repositorio.ts  preferencias.ts
    sincronia/ textoPadrao (3 adaptadores) orquestrador consentimento arquivo morto
    arquivo/   csv(R6) arquivoMorto
    pagina/    main marcar carregador principal painel lateral sincronia usuarios
    app/       main app dados ligacao pedidos contador erros formato icones
               componentes/ cabecalho abas filtro menuAjustes vistaTabela vistaQuadro
                            vistaCronograma vistaPainel cartao pilulas faixas vazio
               dialogos/ demanda concluir prorrogar avaliar historico consentimento
                         sincronizacao arquivarAntigas arquivoMorto importar
               lateral/ agenda montagem
  tests/       verificar.ts + verificar-*.ts (harness caseiro tsx + linkedom, como o Projetos)
```

Build (`demandas/build.mjs`, molde do Projetos): `dist/js/init_demandas.js`, `dist/js/demandas/app.js`, `dist/html/demandas.html`, `dist/css/demandas.css` (base.css + lista.css + estático). Portões: sem não-ASCII; sem `innerHTML`/`outerHTML`/`insertAdjacentHTML`/`on*=`; sem `procedimento_visualizar`/`arvore_montar`/`procedimento_atribuicao_cadastrar` no que roda no SEI; saídas no WAR.

## 8. Permissões e colaboração

Sem servidor para impor regra, vale a do Projetos: **todo usuário da unidade com SEI Pro vê e edita as demandas "Toda a unidade"**. O campo `responsavel` organiza o trabalho, não restringe. `alteradoPor` e o histórico dizem quem fez o quê. A nota de avaliação grava quem avaliou; autoavaliação é permitida (e visível no histórico). Escopo "Só eu" é privado da pessoa naquela unidade.

Conflito: mescla por entidade, vence o carimbo mais recente (empate por dispositivo e conteúdo). Duas pessoas editando a mesma demanda ao mesmo tempo: a última gravação vence, o histórico registra as duas. É a mesma regra aceita no Projetos e está dita na ajuda.

## 9. Testes e validação

- **Unitários** (`tsx tests/verificar.ts`, `linkedom`): modelo puro (situação, transições, estatísticas, alertas de tamanho), repositório com `areaMemoria`, adaptadores de texto com os falsos do `sei-comum`, app com DOM falso. Cada tarefa do plano começa em teste vermelho.
- **Provas de escala**: gerar 500, 1500 e 3000 demandas típicas, medir o tamanho do HTML gerado, **fixar em teste** o comportamento nas faixas 79%, 80%, 99%, 100% de cada tabela.
- **Provas de perda de dados**: texto editado à mão, texto de versão mais nova, texto apagado, arquivo alterado por outro computador entre a leitura e a gravação, histórico grande demais (as demandas seguem sincronizando).
- **Ao vivo** (puppeteer + extensão, como no Projetos): SEI SP de treinamento 4.1.5 (CK4) e SEI MJ de homologação 5.0.4 (CK5), duas janelas, troca de unidade, processo sigiloso, Quadro com arrasto real (o linkedom não simula arrasto nem inércia de `<dialog>`).

## 10. Riscos e perguntas em aberto

1. **Peso para o CKEditor 5.** O teto de 100 KB existe porque o CKEditor 5 baixa o conteúdo de **todos** os textos padrão da unidade. Três textos por escopo multiplicam isso para quem edita documentos. Mitigações: o aviso de peso total (200 KB), os textos `a` e `h` serem os grandes (e raramente úteis fora do módulo), e a medição real na tarefa D2. **Se a medição mostrar lentidão no editor, desligar a sincronização das tabelas `a` e `h` por padrão (ficam local e no arquivo) é uma mudança de uma linha.** A conferir ao vivo no MJ (CK5).
2. **Arquivadas no Texto Padrão.** A conversa decidiu "arquivadas saem do Texto Padrão"; a instrução seguinte (uma tabela por texto, para escalar) pede o contrário. Este spec **mantém a tabela `a` sincronizada, em texto próprio** (a unidade enxerga o histórico de entregas). Se preferir só local e arquivo, é o item 1 acima. Decisão do autor.
3. **Sigilo na página.** A detecção de processo sigiloso ao vincular vem do mesmo mecanismo do Projetos (`pagina/marcar.ts` e `armazem.ts`); a tarefa D7 confere o que dá para reutilizar sem puxar o balão do processo.
4. **Cota do `storage.local`** (10 MB divididos): as três coleções e os registros ocupam espaço. O aviso de 5 MB do arquivo e o arquivo morto mitigam. Medir na D2.
5. **Redesign das opções em curso** (`opcoes-pagina/`): a linha `gerenciardemandas` entra em HTML à mão agora e migra para o schema depois (já previsto na Task 7 daquele plano).
6. **Projetos em P6**: o vínculo com etapa lê o `RepositorioProjetos`; qualquer mudança no formato da chave do Projetos quebra a leitura. Mitigação: teste de contrato no Demandas que cria uma etapa pelo repositório do Projetos e a lê.
7. **Responsável sem lista completa.** Ver seção 5.7: a atribuição a colegas depende de a pessoa já ter aparecido na caixa ou numa demanda, ou de texto livre. Se o autor quiser a lista completa, a P6 do Projetos precisa antes achar uma fonte que não grave "Processo recebido".
8. **Etapa concluída pelo Demandas** muda dado do Projetos: só com clique explícito e registrada no histórico do Projetos.
9. **Ambiguidade de `manterNumerosSigilosos` com 2 ou mais processos sigilosos locais.** Se uma demanda tem, no computador do dono, dois vínculos sigilosos (`[999 sig, 888 sig]`) e um colega remove um deles, o texto só traz vínculos em branco e não identifica qual saiu: o vazio que sobra recebe o número que o dono tinha primeiro, e o outro número deixa de aparecer neste computador (ele continua só no arquivo do dono). Risco conhecido e aceito: o texto não pode carregar a identidade do vínculo sem expor o número.

## 11. Fora de escopo desta entrega

PGD, planos de trabalho, avaliação de plano, recursos, notificações por e-mail, integrações de RH, perfis e capacidades, catálogos de tipos de atividade, recorrência, multiplicar/clonar, dependências, afastamentos, relatórios em tabela e CSV, integração com a árvore do processo (o botão na barra do processo foi entregue como D17; marcador com prazo, anotação do processo e painel de demandas na árvore seguem no R7), Agente de IA, versões oficial e Firefox, migração do legado ANTT/ANTAQ. Tudo isso está no roteiro R1 a R13 do mapa.
