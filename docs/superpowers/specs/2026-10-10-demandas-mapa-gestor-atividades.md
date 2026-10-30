# Mapa do Gestor de Atividades (legado) e roteiro de incorporação ao Gestor de Demandas

Data: 10/10/2026. Documento vivo: cada vez que uma funcionalidade do legado entrar no Gestor de Demandas, a coluna "Situação" muda e a versão em que entrou é anotada.

O **Gestor de Atividades** é o módulo do SEI Pro que só ANTT e ANTAQ usam, porque depende de um backend próprio (PHP 8.2 + MariaDB). O **Gestor de Demandas** é a versão sem servidor, na camada TypeScript (`demandas/`), que guarda os dados no Texto Padrão do SEI e em arquivo JSON local. O spec do Gestor de Demandas está em `2026-10-10-demandas-design.md`.

Fontes lidas para este mapa (caminhos relativos à raiz do repositório; números de linha da data acima):

- Front-end: `dist/js/sei-pro-atividades.js` (27.075 linhas, citado como **FE**).
- Backend: `backend/index.php` (despachante por `action`, citado como **BE**), `backend/functions.php`, `backend/calc_horas.php`, `backend/report.php`, `backend/sync/`.
- Banco: `backend/base_estrutura.sql` (51 tabelas, MariaDB).
- Satélites: `dist/js/sei-pro-projetos.js`, `dist/js/sei-pro-prescricoes.js`.

## Legenda da coluna "Situação"

| Código | Significado |
|---|---|
| **V1** | Entra na primeira versão do Gestor de Demandas. |
| **R1…R12** | Roteiro: incorporar depois, na ordem sugerida da seção 9. |
| **Órgão** | Específico de ANTT/ANTAQ ou de PGD/RH. Não entra no Gestor de Demandas genérico. |
| **Nunca** | Depende de servidor ou de segredo; não cabe na arquitetura sem backend. |
| **Já existe** | O Gestor de Projetos (TS) ou os Monitorados já fazem. |

## 1. Como o legado funciona

- Autenticação por **chave de acesso** do usuário (tabela `usuarios_hash`); toda ação é um `POST` em `index.php` com `action`, `hash` e `perfil` (unidade). O backend confere a **capacidade** de mesmo nome da ação antes de executar (`checkCapacidade`, `functions.php:227`).
- O front só chama o backend se houver servidor e chave configurados (`getServerAtividades`, FE:152-186). Há uma lista fixa de servidores (`serversAtivPro`, FE:26470).
- As **nomenclaturas** são configuráveis por entidade (tabela `nomenclaturas`, `getName`/`__`, FE:100): "demanda", "atividade", "prazo" mudam de nome por órgão.
- O **estado da demanda não é uma coluna**: deriva das datas de `demandas` e das pausas (seção 3).
- Carga incremental por `last_update` (margem de 2 minutos) e cache local de demandas.

## 2. Telas e visões

| Funcionalidade | Onde (FE) | Situação |
|---|---|---|
| Painel na tela inicial do SEI (`#atividadesPro`), recolhível e ordenável | `setPanelAtividades` 2489-2891 | **V1** (painel embutido + ordem dos painéis) |
| Painel na árvore do processo (demandas do processo) | `demandas_processo` | R7 |
| Seletor de perfil/unidade | `changePerfilAtiv` 3351 | **V1** (unidade atual do SEI) |
| Visão **Tabela** com colunas reordenáveis, edição inline, timer, mini-checklist, seleção em lote | `getRowsPanelAtividades` 2913 | **V1** (sem timer; edição inline só do título, prazo e etiquetas) |
| Visão **Quadro/Kanban** com arrastar para mudar de estado, densidade, fixar no topo | `getKanbanAtividades` 16800 | **V1** (sem fixar; densidade em R10) |
| Priorização por usuário no Kanban (numeração e reordenação) | `getKanbanUserPriority` 17563 | R10 |
| Visão **Cronograma/Gantt** (Frappe), dependência entre barras, filtros por legenda | `getGanttAtividades` 17612 | **V1** (sem dependência; ela é R3) |
| Visão **Painel** (gráficos Chart.js): distribuição, entregas, documentos, produtividade | `getChartAtividades` 17817, BE `chart_demandas` | **V1** parcial (seção 6 do spec); documentos e produtividade por mês em R9 |
| Área **Afastamentos** (tabela e Gantt) | FE 14711-16787 | R5 |
| Área **Contatos** (agenda de usuários) | `getTableContatoPanel` 14933 | Órgão (a lista de usuários da unidade já alimenta o seletor de responsável) |
| Área **Relatórios** (tabela por abas, "todos os dados", paginação) | `getTabsRelatorio` 3463 | R6 (CSV por visão no V1 do Projetos serve de molde) |
| Painel de **BI externo** (iframe) | opção `painel_bi` | Nunca |
| **Configurações** (abas ou modal, 25 tabelas de cadastro) | `openModalConfigPanel` 3637 | Parcial: preferências no V1; cadastros em R8 |
| Link para o "Guia de Utilização" configurável | opção `guia_utilizacao` | **V1** (página de ajuda em `pages/DEMANDAS.md`) |

## 3. Ciclo de vida da demanda

Estado derivado no legado:

| Estado | Condição no legado | No Gestor de Demandas |
|---|---|---|
| Não iniciada | `data_inicio` zerada | `iniciadaEm` ausente |
| Iniciada | `data_inicio` e sem entrega | `iniciadaEm` presente |
| Pausada | pausa aberta em `demandas_pausas` (`data_fim` zerada) | último item de `pausas` sem `fim` |
| Concluída/Entregue | `data_entrega` | `concluidaEm` |
| Avaliada | `avaliacoes.datetime` | `avaliacao` presente |
| Arquivada/Enviada | `data_envio` | `arquivadoEm` |

Ações (menu de contexto e arrastar no Kanban):

| Ação | FE / BE | Situação |
|---|---|---|
| Criar (rápido, simples, completo) e editar | `saveAtividade` 18808, `Full` 18874, `Quick` 19592 / `save_atividade`, `save_atividade_rapida`, `edit_atividade` | **V1** (um formulário só, com "mais campos" recolhido) |
| Iniciar e cancelar início (também em lote) | 21194, 21962 / `start_atividade`, `start_cancel_atividade(s)` | **V1** (lote só para arquivar e excluir) |
| Pausar e retomar | 21536 / `pause_atividade*` | **V1** |
| Concluir (documento entregue, tempos, observação técnica), editar conclusão, cancelar conclusão | 20331, 21112 / `complete_atividade`, `complete_edit_atividade`, `complete_cancel_atividade(s)` | **V1** (tempo gasto e observação; o documento entregue é um vínculo SEI opcional) |
| Conclusão parcial | `complete_atividade_parcial` | R12 |
| Prorrogar prazo | 21803 / `extend_atividade` | **V1** (com motivo e histórico) |
| Alterar complexidade ou atividade | 21637 / `variation_atividade`, `type_atividade` | R8 (depende do catálogo de tipos) |
| Arquivar e desarquivar | 22005, 21989 / `send_atividade`, `send_cancel_atividade` | **V1** |
| Excluir (lixeira) e restaurar | 23044, 18766 / `delete_atividade(_all)`, `restory_atividade` | **V1** (lápide, como no Projetos) |
| Histórico de alterações | 22276 / `history_atividade` (`_log`) | **V1** (tabela `h`) |
| Informações da demanda | 22182 | **V1** (balão/diálogo de detalhes) |
| Avaliar com nota 1 a 5 (e lote), cancelar avaliação | 24998, 25159 / `rate_atividade(s)`, `rate_cancel_atividade(s)` | **V1** (nota e comentário; sem justificativas nem recurso) |
| Omissão de demanda (nota padrão e e-mail) | `sendMailOmissaoDemanda` | Nunca (e-mail) |
| Notificar por e-mail | 22927 / `notify_send` | Nunca. Alternativa: selo de atrasadas na aba lateral (V1) |
| Edição inline (assunto, observações, etiquetas, tempos) | 2238 / `edit_field`, `edit_tempos`, `edit_etiqueta` | **V1** parcial |

Indicadores de prazo (`getConfigDateAtiv`, FE:2116): no prazo, atrasado, entregue no prazo (verde), entregue fora do prazo (laranja). **V1**.

## 4. Campos da demanda

| Campo do legado | Situação |
|---|---|
| Processo SEI (um ou vários), requisição SEI, tipo de requisição | **V1** (um ou mais vínculos de processo; tipo de requisição em R8) |
| Assunto | **V1** (vira "título") |
| Atividade (`id_atividade`), macroatividade, cadeia de valor | R8 |
| Grau de complexidade (`fator_complexidade`) e tempo pactuado por atividade | R8 |
| Responsável (`id_user`) e unidade | **V1** (usuários da unidade lidos do SEI) |
| Data de distribuição, prazo de entrega | **V1** |
| Tempo planejado, dias planejados | **V1** (apenas "tempo estimado") |
| Tempo despendido, executado, homologado, produtividade | **V1** (apenas "tempo gasto"); homologado e produtividade são PGD (Órgão) |
| Prazo móvel (`recalcula_prazo`) | R4 |
| Marcador com o prazo no processo SEI | R7 |
| Observação gerencial (e gravar nas anotações do processo) | **V1** (descrição); gravar nas anotações em R7 |
| Observação técnica | **V1** (observação da conclusão) |
| Etiquetas | **V1** |
| Prioridade (importante, urgente) | **V1** |
| Checklist (novo, renomear, remover, ordenar, marcar; exigir antes de concluir) | **V1** (exigir antes de concluir é preferência, R8) |
| Vínculo com projeto/etapa (`id_etapa`) | **V1** |
| Vínculo com outras demandas e dependência (`id_vinculacao`) | R3 |
| Distribuição **recorrente** (semanal a anual, N dias úteis, até fim do plano ou data) com pré-visualização em Gantt | R1 |
| **Multiplicar** a demanda (`fator_multiplicacao`) | R2 |
| **Clonar** nos processos listados em um documento (`ativ_multiprocesso`) | R2 |
| Documento de requisição e documento entregue (links SEI) | **V1** (um vínculo de documento opcional na conclusão) |
| Plano de trabalho e entrega (`ativ_id_plano`, `ativ_id_entrega`) | Órgão |

## 5. Comentários, anexos, notificações, importação

| Item | Legado | Situação |
|---|---|---|
| Comentários | Não há tabela. Há `observacao_gerencial`, `observacao_tecnica` e `avaliacoes.comentarios`; o resto é o `_log` | **V1** (descrição, observação da conclusão e comentário da avaliação) |
| Anexos | Não há upload. Só vínculos com processos e documentos do SEI | **V1** (vínculos) |
| E-mails (boas-vindas, avaliação, não aceite, recurso, omissão) com texto editável por entidade | PHPMailer, tabela `emails` | Nunca |
| Importar demandas | Não existe no legado | R11 (CSV) |
| Exportar | `report.php?action=<tabela>&output=save` (JSON por tabela), dumps SQL | **V1** (arquivo JSON do módulo) e R6 (CSV) |
| Integração com o processo SEI: botão "Demandas" na barra de ações do processo (balão com as demandas do processo, "Nova demanda" e "Concluir com este documento" preenchidos pela tela; legado `getInsertIconAtividade`) | `#divArvoreAcoes` | **Entregue na D17** |
| Integração com o processo SEI: ícones de data no controle, marcador com prazo, anotação do processo | `.atividadeBoxDisplay` FE:3009 | R7 |
| Seleção de vários processos na tela inicial para criar várias demandas | | R2 |

## 6. Cadastros auxiliares (aba Configurações)

| Cadastro | Situação |
|---|---|
| Tipos de atividade (nome, macroatividade, tempo pactuado, complexidade, entregas, vigência) | R8 |
| Tipos de requisição, tipos de documento | R8 |
| Etiquetas por unidade, com cor e ícone | **V1** (etiquetas livres, cor derivada do texto); catálogo com cor escolhida em R8 |
| Tipos de metadados (campos customizados de usuário e unidade, LGPD) | Órgão |
| Nomenclaturas por entidade | R8 |
| Usuários, unidades, entidades, perfis, capacidades (25 tabelas `config_*`) | Nunca (no Gestor de Demandas todos da unidade têm o mesmo poder; ver spec, seção 8) |
| Feriados da unidade (recorrentes, meio período) | R4 (os feriados nacionais já existem em `@comum/datas`) |

## 7. Afastamentos

CRUD de afastamentos, tabela e Gantt, conflito com demandas e planos, integração com RH (`BE:1908-2118`; tabela `afastamentos`). No Gestor de Demandas: **R5** (ausências por pessoa, para o Gantt e a carga por responsável não escalarem demanda em férias). A integração com RH é **Órgão**.

## 8. Permissões e opções

O legado tem perfis, capacidades por ação (~150 nomes) e ~85 opções por entidade e ~30 por unidade. Resumo do que importa:

| Mecanismo | Situação |
|---|---|
| `only_self_atividades` (só demandas próprias) | **V1** pelo escopo "Só eu"; "só minhas" como filtro rápido |
| `select_user_atividade` (escolher o responsável) | **V1** |
| Capacidades por ação, perfis e vigência | Nunca (não há servidor para impor; a regra é a do Projetos: confiança na unidade) |
| Opções de entidade: cadastro rápido/simplificado, `exigir_atribuicao_demandas`, `limitar_demandas_retroativas`, `alerta_tempo_programado`, `limit_paginacao` | Preferências locais em R8 |
| Opções de avaliação (prazo, bloqueio, autoavaliação, recurso) | Órgão |

## 9. Relatórios e estatísticas

| Item | Situação |
|---|---|
| Gráficos de distribuição (demandas por mês e plano) | **V1** parcial (entregas por mês) |
| Estoque, processuais, status das entregas, tempo médio | **V1** (situação geral, entregas por mês, prazo médio) |
| Documentos produzidos (requisições e documentos) | R9 |
| Produtividade e produtividade por mês (agilidade e antecipação) | R9 na parte genérica; o índice produtivo é Órgão |
| Relatórios em tabela por abas (demandas, planos, atividades, afastamentos, e-mail, log) | R6 (demandas e histórico em CSV) |
| Meta proporcional, relatório de entregas do plano | Órgão |

## 10. Planos de trabalho, PGD e integrações (Órgão)

Programas de gestão, planos de trabalho, entregas por mês, dedução e acréscimo de horas, termos de ciência, mapa estratégico (objetivos, ações, entregas, cadeia de valor), avaliação de plano e de programa, recurso, homologação, carga horária proporcional com feriados e afastamentos, pendências e bloqueios do plano, sincronização com a API do PGD (MGI), SFIS/SARH e iCal da ANTAQ. **Fora do escopo do Gestor de Demandas**; continuam no Gestor de Atividades.

## 11. Satélites que já têm correspondente

| Satélite do legado | Correspondente |
|---|---|
| Projetos e etapas (Gantt, dependências, compartilhamento, clonagem, arquivamento) | **Já existe**: Gestor de Projetos TS (`projetos/`). O Gestor de Demandas liga a demanda a uma etapa (V1). |
| Favoritos (`set_favoritos`, `get_favoritos`) | **Já existe**: Monitorados (`favoritos/`). |
| Prescrições (`sei-pro-prescricoes.js`, `prescricoes`, `tipos_prescricoes`) | Órgão (fiscalização) |

## 12. Modelo de dados do legado (para referência de migração)

Tabelas do núcleo (MariaDB, `base_estrutura.sql`; todas têm `data_inicio`/`data_fim` de vigência, quase todas `config` em JSON):

- `demandas` (:258): `id_demanda`, vínculos (`id_atividade`, `id_user`, `id_plano`, `id_entrega`, `id_etapa`, `id_unidade`, `id_tipo_requisicao`, `id_tipo_documento`, `id_avaliacao`), requisição e processo SEI, `assunto`, observações, datas (`data_distribuicao`, `prazo_entrega`, `data_inicio`, `data_entrega`, `data_envio`), tempos, `etiquetas` (JSON), `prioridade`, `recalcula_prazo`, `id_vinculacao`.
- `demandas_excluidas` (:346), `demandas_pausas` (:400), `demandas_checklist` (:327).
- `atividades` (:111), `tipos_requisicoes` (:1211), `tipos_documentos` (:1049), `cadeia_valor` (:218), `nomenclaturas` (:629), `_log` (:27), `emails` (:442).
- `avaliacoes` (:141), `avaliacoes_justificativas` (:170), `avaliacoes_recursos` (:190).
- `projetos` (:911), `etapas` (:526), `projetos_compartilhados` (:934).
- `usuarios` (:1276), `usuarios_hash` (:1306), `perfis` (:673), `capacidades` (:238), `tipos_capacidades` (:1031), `lotacao` (:583), `unidades` (:1229), `entidades` (:462).
- `afastamentos` (:85).

Mapeamento para o Gestor de Demandas (as 3 "tabelas" de Texto Padrão e o que vira campo):

| Legado | Gestor de Demandas |
|---|---|
| `demandas` + `demandas_pausas` + `demandas_checklist` + `avaliacoes` (nota e comentário) | Uma entidade `Demanda` com `pausas[]`, `checklist[]` e `avaliacao` embutidos (tabela `d` ou `a`) |
| `_log` | Entidade `Registro` (tabela `h`) |
| `demandas_excluidas` | Lápide (`removidoEm`) da própria entidade |
| `usuarios`, `lotacao`, `unidades` | Lista **parcial** de responsáveis (caixa, já usados, o próprio usuário, texto livre), com o cache de 1 dia do Projetos; a lista completa não é segura de ler (ver spec, 5.7) |
| `atividades`, tipos, nomenclaturas | R8 |

## 13. Defeitos do legado que o novo não deve repetir

- **Segredos versionados** em `backend/` (`api.php` com token JWT do PGD, `secret_api.php`, `docker-compose.yml` com a senha root do banco). Fora do escopo deste trabalho, mas devem ser rotacionados e retirados do repositório.
- `display_errors` ligado e `Access-Control-Allow-Origin: *` em `report.php`.
- FKs invertidas para `demandas` em `tipos_requisicoes` e `tipos_documentos`; `planos_acrescimo_key2` errada (já registrado em memória do projeto). Não servem de molde.
- O estado derivado de datas sem constraint permite estados impossíveis (entrega sem início). No novo, as transições passam por funções puras com validação (`modelo/operacoes.ts`).

## 14. Roteiro de incorporação (ordem sugerida)

| Id | Funcionalidade | Por quê nesta posição |
|---|---|---|
| R1 | Recorrência (semanal, mensal, N dias úteis, até data) com pré-visualização | A função mais valorizada do legado; muda o modelo (série) e o limite de tamanho |
| R2 | Multiplicar e clonar para vários processos (lista de processos do Controle) | Cria N demandas; precisa do aviso de tamanho |
| R3 | Vincular demandas e dependência (seta no Gantt) | Reaproveita `modelo/dependencias.ts` do Projetos |
| R4 | Prazo móvel e feriados da unidade | Reaproveita `@comum/datas` e `projetos/modelo/calendario` |
| R5 | Afastamentos e ausências | Alimenta carga por responsável e Gantt |
| R6 | Relatórios em tabela e CSV (demandas, histórico) | Molde: `projetos/src/arquivo/csv.ts` |
| R7 | Integração com o processo SEI: demandas na árvore, marcador com prazo, anotação | O botão "Demandas" na barra de ações do processo (balão sob demanda, formulários preenchidos pela tela) foi entregue como **D17**; o que continua aqui: marcador com prazo, anotação do processo e painel de demandas na árvore |
| R8 | Catálogos: tipos de atividade, complexidade, tipos de requisição e de documento, etiquetas com cor, nomenclaturas, preferências de cadastro | Cada catálogo vira uma nova "tabela" de Texto Padrão |
| R9 | Estatísticas avançadas (documentos produzidos, produtividade, produtividade por mês) | |
| R10 | Kanban avançado: densidade do cartão, fixar, priorização por usuário | |
| R11 | Importar demandas por CSV e do legado (Atividades) | Molde: `projetos/src/importacao/atividades.ts` |
| R12 | Conclusão parcial, cronômetro de tempo gasto | |
| R13 | Ferramentas do Agente de IA (listar, criar, concluir demandas) | Passar por pseudônimo de pessoas (`project_historico_ts`) |
