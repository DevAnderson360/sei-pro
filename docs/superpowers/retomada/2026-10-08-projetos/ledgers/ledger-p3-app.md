# SDD ledger — plan: docs/superpowers/plans/2026-10-06-projetos-p3-app.md

Spec: docs/superpowers/specs/2026-10-06-projetos-design.md (alcançável). Branch feat/projetos-ts. Começa após o fechamento da P2 (ledger ../2026-10-06-projetos-p2-nucleo).
Contagens: o plano supôs projetos = 393 ao fim da P2 ensaiada; a P2 real fecha com 580 (após correções). Todas as contagens do projetos no plano andam +187. sei-comum: 406 → 419 (T1). Demais pacotes não mudam.

## Varredura prévia
| Tarefas | Compartilham | Produz → consome | Achado |
|---|---|---|---|
| T1 → T2..T14 | sei-comum (esperarConexaoDaAba c/ tratadores, ligarPortaDoPainel.rpc, aviso com 2 ações, ícone gantt) | app/pagina consomem | coerente |
| T2 → T3..T11 | app base (ponte, prefs, formato, dados da unidade, chip semana no filtro) | estado/dados | coerente (filtro do P2 agora tem listas readonly — ver ruling) |
| T3..T10 | componentes do app | montados em T11 (AppProjetos) | sequencial |
| T5 | vista do projeto usa montarGantt | validar do Gantt | usar violacoesNovas (P2 final) — ver ruling |
| T11 ↔ T12 | ponte RPC app ↔ content script | tipos em src/ponte/tipos.ts | coerente |
| T12 | content script; usuariosDaUnidade | Decisão 4 (árvore) | ruling: desligada |
| T13 → T14 | build com saídas em dist/ → manifest/WAR, guarda do legado | coerente |

| Tarefa | Coerência interna |
|---|---|
| T1–T14 | plano ensaiado e reconstruído a partir do markdown pelo redator (tsc/biome/build/provas ok na cópia) |

## Rulings
- Ruling: Decisão 4 do plano (lista completa de usuários lendo a árvore de um processo já visualizado) NÃO executada: `buscarCompleta = null` na T12 (lista parcial: atribuídos da caixa + responsáveis já usados + o próprio usuário + texto livre). arvore_montar.php chama ProcedimentoRN::receber (grava "Processo recebido" se há remessa pendente) — efeito invisível em nome do usuário. A P6 investiga ao vivo uma fonte segura. — custo se errado: lista de responsáveis incompleta até a P6.
- Ruling: a P2 mudou a API depois do ensaio do plano P3 — `FiltroEtapas` com listas readonly (o app copia ou parte de `filtroVazio()`), `violacoesNovas(antes, depois, ids)` (o validar do Gantt usa ela depois de `completarComDependentes` com TODAS as etapas), `entidadeValida(..., agora?)`, `encontrarCiclo(..., desde?)`, `importar` devolve `excedentes`. Implementadores adaptam o código do plano à API real e listam as adaptações. — custo se errado: retrabalho local.
- Ruling: Decisão 20 (respeitar a opção antiga "Gerenciar Projetos") mantida por coerência com os Favoritos (gerenciarfavoritos) — o relatório final ao autor menciona que a opção precisa estar ligada. — custo se errado: usuário com a opção desligada não vê o painel novo.

## Progresso
Task 1: dispatched (base c42f9e3, implementer sonnet)
Task 1: complete (commits c42f9e3..e0a75fb, review clean; sei-comum 419)
Task 1: minor (deferred): aviso.ts:441 fazer() que lança mostra o aviso 2x (pré-existente); 2+ ações sem avisarAcoes cai para 1 ação em silêncio
(T2 aguarda a re-revisão final da P2 — evita dois implementadores em projetos/)
Task 2: dispatched (base e0a75fb, implementer sonnet)
Task 2: complete (commits e0a75fb..9ee6093, review clean; projetos 607)
Task 2: minor (deferred): PREFERENCIAS_PADRAO mutável exportado; quandoRelativo com futuro = "hoje"; resumoDoUltimoRegistro sem caso arquivamento/visibilidade
Task 3: dispatched (base 9ee6093, implementer sonnet)
Task 3: done b1889a6 (628) — review dispatched
Task 3: complete (commits 9ee6093..b1889a6, review clean; projetos 628)
Task 3: minor (deferred): a11y — "Mais N" dentro do tablist, ponto vermelho sem texto acessível, menu marcável sem aria-checked; prova de escopo só confere title; limiteDeAbas com larguras fixas (conferir ao vivo)
Task 4: dispatched (base b1889a6, implementer sonnet)
Task 4: done 2e24220 (650) — review dispatched
Task 4: review Needs fixes — 1 Important (definir redesenha os combos e deixa lista órfã; prova mascarada por escolherCombo); ⚠️ CSS da camada vem na T13 (conferido no plano, linhas 9208/9222); fix round 1/5 dispatched (resume, base 2e24220)
Task 4: minor (deferred): Esc em captura fecha o popover com a lista do combo aberta; Esc global fecha mesmo com outro diálogo por cima; mudar sem definir deixa chips velhos (documentar contrato)
Task 4: fix round 1/5 (1 addressed, 0 open; commits 2e24220..dcc4e6b)
Task 4: complete (commits b1889a6..dcc4e6b, 1 fix round; projetos 653 — offset agora +190)
Task 5: dispatched (base dcc4e6b, implementer sonnet)
Task 5: done 2f45ad4 (678) — review dispatched; nota: validar injetado pelo app (T11) deve usar violacoesNovas
Task 5: review Needs fixes — 1 Important (realce perdido após redesenho); fix round 1/5 dispatched (resume, base 2f45ad4)
Task 5: minor (deferred → T11): atualizar ignora `hoje` novo (app deve remontar na virada do dia); aoFalhar síncrono no construtor (controle fica não nulo; T11 trata o contrato); campo "Adicionar etapa" perde texto em qualquer atualizar e é limpo antes de o app aceitar; Enter sem isComposing; lacunas de prova (moverDependentes remonta, fase recolhida com Frappe real, responsável/fase hostis); a11y (ícone de situação sem nome, linhas da tabela sem role/Espaço); vista Lista: app passa linhas sem fases recolhidas
Task 5: fix round 1/5 (1 addressed, 0 open; commits 2f45ad4..f5d0d95)
Task 5: complete (commits dcc4e6b..f5d0d95, 1 fix round; projetos 680 — offset agora +192)
Task 5: minor (deferred): realce pode ficar preso se o redesenho remove o elemento sob o mouse e o mouse saiu
Task 6: dispatched (base f5d0d95, implementer sonnet)
Task 6: done 553dba6 (693; build conferido pelo controlador) — review dispatched
Task 6: complete (commits f5d0d95..553dba6, review clean)
Task 6: minor (deferred → revisão final da P3): comportamento extra sem prova (remontar no hoje, realce reaplicado, coluna = linhas do Gantt com arquivados); reaplicarRealce usa d.itens e não visiveis(); tr da tabela sem role
Task 7: dispatched (base 553dba6, implementer sonnet)
Task 7: done ade40ed (715) — review dispatched
Task 7: complete (commits 553dba6..ade40ed, review clean; projetos 715)
Task 7: minor (deferred → revisão final): prova da régua não garante 1 gravação; faltam provas de clique fora, atraso com feriado, hostis fora do nome; onclick: a.aoConcluir passa o evento (usar arrow); prova de concluída não afirma ausência de "Concluir"
Task 8: dispatched (base ade40ed, implementer sonnet)
Task 8: done 6afe714 (749; offset +199) — review dispatched
Task 8: review Needs fixes — 1 Important (Excluir fecha e engole falha); fix round 1/5 dispatched (resume, base 6afe714)
Task 8: minor (deferred → T11/integração): prova de ciclo usa salvar falso (conferir nome do ciclo com o repositório real); "Carregando…" eterno no histórico sem c.historico; teto do checklist sem aviso; limpar responsável/processo/documento depende de o chamador tratar undefined como limpar (T11 deve mapear para a API real); documento sem validação de formato
Task 8: fix round 1/5 (1 addressed, 0 open; commits 6afe714..8f89204)
Task 8: complete (commits ade40ed..8f89204, 1 fix round; projetos 752 — offset agora +202)
Task 8: minor (deferred): mensagem de erro genérica do excluir diz "Não foi possível salvar"
Task 9: dispatched (base 8f89204, implementer sonnet)
Task 9: done eac6c91 (786; offset +210; implementador pulou o RED; build conferido pelo controlador) — review dispatched
Task 9: review Needs fixes — 1 Important (processo digitado sem prova/validação); fix round 1/5 dispatched (resume, base eac6c91)
Ruling: regra do número de processo digitado = `^[0-9][0-9./-]*[0-9]$` e ≥ 8 dígitos (formatos do SEI variam por órgão) — custo se errado: algum formato exótico recusado (o usuário ainda escolhe da caixa)
Ruling: o minor "sem trava de clique duplo em Salvar como modelo/Informar documento" entra na rodada porque duplica dados — custo: nenhum
Task 9: minor (deferred → T11): Excluir dos arquivados sem confirmação (app); lacunas de prova (reativar falho, sucesso de duplicar/excluir, nome hostil na prévia); erro antigo fica na caixa após sucesso; arquivadoEm ?? 0 mostraria 01/01/1970
Task 9: fix round 1/5 (2 addressed, 0 open; commits eac6c91..8c43e0d)
Task 9: complete (commits 8f89204..8c43e0d, 1 fix round; projetos 792 — offset agora +216)
Task 10: dispatched (base 8c43e0d, implementer sonnet)
Task 10: done cdd34a6 (808) — review dispatched
Task 10: complete (commits 8c43e0d..cdd34a6, review clean; projetos 808 — offset +217)
Task 10: minor (deferred → T13 fiação do main): lerImpressao só exige campos não vazios — rejeitar `|`, `/`, controle, >200 e unidade não numérica; conferir host/login com a sessão; slice deixa hífen duplo no nome; faltam provas de Todos sigiloso e CSV de projeto sigiloso sem etapas; setTimeout(10) palpite
Task 11: dispatched (base cdd34a6, implementer sonnet)
Task 11: done abe3d56, 5c32d89, f2ab3cb (892) — review dispatched (opus)
Task 11: review Needs fixes — 1 Important (aoRedimensionar redesenha tudo e fecha balão/filtro quando o iframe cresce); fix round 1/5 dispatched (resume, base f2ab3cb)
Task 11: minor (deferred → revisão final da P3): provas que passam no vazio (verificar-app.ts:585,592-597,738); fase órfã se a etapa for recusada; erro do recarregar após gravar vira erro da ação (duplica ao repetir); inscrição no aoMudar depois da leitura; projeto duplicado por um ciclo no mover escopo; filtro de fases global entre projetos; régua pelo teclado grava a cada seta e fecha o balão
Task 11: fix round 1/5 (1 addressed, 0 open; commits f2ab3cb..621a7ca)
Task 11: complete (commits cdd34a6..621a7ca, 1 fix round; projetos 895 — offset +264)
Task 12: dispatched (base 621a7ca, implementer sonnet)
Task 12: done fe1bdde (940) — review dispatched (opus)
Task 12: complete (commits 621a7ca..fe1bdde, review clean; projetos 940)
Task 12: minor (deferred): abrirProcesso/abrirDocumento sem validação de tipo/tamanho (P4/P5 quando vier de dado compartilhado); .spro-prj-alertas[hidden] não esconde sem bootstrap; pílulas sem ícones alerta/relogio da tela; ligarAlertas sem parar() (P5); contagens com corrida e virada do dia; guarda contra árvore só regex nas fontes; marca depende de avaliar o pacote inteiro; cache de usuários regravado sem mudança
Task 13: dispatched (base fe1bdde, implementer opus)
Task 13: done 20e796e, 2b771d9, 8f75b79 (960; init_projetos 81 KB) — review dispatched; defeito da T10 (impressão mostrarLista) apontado pelo implementador
Task 13: review Approved; Ruling: corrigir já o defeito da T10 (PDF com barras de fase sem nome: mostrarLista:false na impressão) + print-color-adjust — revisor recomendou não adiar — custo: nenhum; small fix round dispatched (resume, base 8f75b79)
Task 13: minor (deferred): regra morta html[data-theme=dark] no gantt.css; check-dom-injection local pula pacote ausente
Task 13: fix faa2489 (963) — re-review dispatched; Task 14 dispatched em paralelo (base faa2489, arquivos distintos)
Task 13: fix round 1/5 (2 addressed, 0 open; commits 8f75b79..faa2489)
Task 13: complete (commits fe1bdde..faa2489, 1 fix round; projetos 963)
Task 14: done b5da78e (969) — review dispatched
Task 14: review Needs fixes — 1 Important (guarda exige KEY_USER e perde o fluxo de login por host; initProjetos sem proteção quebra); fix round 1/5 dispatched (resume, base b5da78e)
Ruling: decisão 21 refinada — "há servidor do Atividades" = configBasePro_atividades com URL_API não vazio (KEY_USER não exigido; o fluxo por host grava KEY_USER vazio) + typeof initProjetos nas chamadas do sei-pro-atividades.js — custo se errado: legado carregado para quem tem só URL_API sem login válido (inofensivo: o painel legado não abre sem resposta do servidor)
Task 14: fix round 1/5 (1 addressed, 0 open; commits b5da78e..47e1485)
Task 14: complete (commits faa2489..47e1485, 1 fix round; projetos 973; demais suítes conferidas: sei-comum 419, sei-nucleo 110, favoritos 578, historico 485, agente-ia 1054)
Final review: dispatched (c42f9e3..47e1485, opus)
Final review: With fixes — 2 Important (Desfazer preso no iframe após diálogo; filtro de fase global entre projetos) + minors a corrigir agora (régua, foco da camada, sincronia redesenha tudo, definição única de servidor, informar documento não apaga, menu do vazio, cota cheia, aria-live, lacuna "Redefinir plano original", provas endurecidas); achados em final-findings.md
Ruling: "Redefinir plano original" (spec 5.4) entra na leva final da P3 — nenhuma fase o tinha — custo: pequeno
Final fix: dispatched (base 47e1485, opus)
Final fix: commits 68d832b..c247096 (projetos 1039, sei-comum 423) — re-review dispatched
Final fix re-review: all 12 addressed, no new Critical/Important (opus)
Final fix: minor (deferred → P5): balão reaberto mostra o progresso antigo por um instante; progresso pendente perdido se a página navega em < 600 ms (descarregar antes de abrir processo/documento e no pagehide); texto "replanejadas" impreciso
P3: COMPLETE (c42f9e3..c247096). projetos 1039, sei-comum 423.
