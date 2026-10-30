# SDD ledger — plan: docs/superpowers/plans/2026-10-06-projetos-p2-nucleo.md

Spec: docs/superpowers/specs/2026-10-06-projetos-design.md (alcançável). Branch feat/projetos-ts. Começa depois do P1 (ledger próprio em ../2026-10-06-projetos-p1-comum).
Meta: projetos 14 → 373 provas (ensaiado pelo redator, reconstrução do markdown deu igual byte a byte). Demais pacotes não mudam (P2 só cria projetos/).

## Varredura prévia

| Tarefas | Compartilham | Produz → consome | Achado |
|---|---|---|---|
| T1–T12 | projetos/src/api.ts, tests/verificar.ts | cada tarefa reexporta/agrega | sequencial, ok |
| T1 → todas | modelo/tipos.ts, constantes.ts, escopo.ts, tests/{util,fuso,fabrica}.ts | tipos e fábricas de teste | coerente |
| T2 → T3, T4, T5, T9, T11 | calendario.ts | dias úteis/datas locais | coerente |
| T3 → T6, T11, T12 | situacao/progresso/alertas/resumo | derivados | coerente |
| T4 → T7 (moverDatas), T12 (arraste) | dependencias.ts / linhaDeBase.ts | completarComDependentes, violacoesDeDatas | coerente |
| T5 → T7, T8 | operacoes/historico/validacao | editar/remover/restaurar, registros | coerente |
| T7 → T8, T9 | repositorio.ts | T8 e T9 acrescentam seções | sequencial, ok |
| T1 → T10, T12 | build.mjs | T10 silencia aviso do vendor; T12 portão ASCII do CSS | ok |
| T10 → T11, T12 | vendor/frappe-gantt | after_render, custom_class múltipla, view_mode | coerente |
| T11 → T12 | gantt/escalas, linhas, tarefas | montarGantt | coerente |

| Tarefa | Coerência interna |
|---|---|
| T1–T12 | código ensaiado e reconstruído a partir do markdown pelo redator (373 provas) |

Varredura limpa.

## Rulings (decisões do plano P2 que divergem/precisam da spec)
- Ruling: arrastar só nas escalas Dia e Semana (Mês/Ano só leitura) — a Frappe 1.2.2 trunca a data para o dia 1 nessas escalas — custo se errado: usuário não arrasta na escala Mês; a escala padrão do projeto é Semana.
- Ruling: regra de dependência = etapa não começa antes do INÍCIO da predecessora (comportamento da Frappe), sem exigir término-início — evita bloquear quem planeja sobreposição; spec não define — custo se errado: dependências aceitam sobreposição; endurecer depois é local (violacoesDeDatas).
- Ruling: `importar` exige entidades completas (decisão 12 do plano) — o P4 decide se estende para registro mínimo de sigiloso — custo: P4 pode precisar estender entidadeValida.

## Progresso
Task 1: dispatched (base 63f9e28, implementer sonnet)
Task 1: complete (commits 63f9e28..288e91e, review clean)
Task 1: minor (deferred): Registro.campo é união fechada (spec diz string) — alargar se uma tarefa nova precisar
Task 2: dispatched (base 288e91e, implementer sonnet)
Task 2: complete (commits 288e91e..a4004fe, review clean)
Task 2: minor (deferred, P3 deve validar): fimPorDuracao com Infinity entra em laço; strings inválidas lançam em deISO — entradas de formulário precisam de dataValida/Number.isFinite e teto de duração
Task 3: dispatched (base a4004fe, implementer sonnet)
Task 3: complete (commits a4004fe..73f82f5, review clean)
Task 3: minor (deferred): sexta feriado ainda conta como "nesta semana"; resumoDoProjeto recebe feriados sem repassar a alertas
Task 4: dispatched (base 73f82f5, implementer sonnet)
Task 4: complete (commits 73f82f5..eaad173, review clean)
Task 4: minor (deferred): ciclo preexistente fora da etapa editada gera mensagem sobre outro ciclo; dependente escondido herda deslocamento do 1º ancestral na ordem; duplicatas em dependeDe
Task 5: dispatched (base eaad173, implementer sonnet)
Task 5: complete (commits eaad173..66270e7, review clean)
Task 5: minor (deferred, P3/P4): historico.ts nomeFase vira "" quando a fase não resolve (mudança de fase some do histórico) — sempre passar apoio real; documento SEI vai ao histórico mesmo com processo sigiloso (P4 decide); fase sem limite de 200; NaN em progresso só pego pela validação
Task 6: dispatched (base 66270e7, implementer sonnet)
Task 6: complete (commits 66270e7..d9b41fd, review clean)
Task 7: dispatched (base d9b41fd, implementer sonnet)
Task 7: review Needs fixes — 1 Critical (remover etapa trava edição das dependentes, contra a decisão 11), 4 Important (fase morta, órfãs em dados(), gravações não atômicas, undefined em obrigatório); achados em task-7-findings-r1.md. Fix aguardando a leva final da P1 terminar (sem implementadores em paralelo).
Task 7: minor (deferred): renomearFase corta em 200 e aceita duplicata sem acento; restaurar ignora limites 100/300; concluir 2x muda a data (P5 concluir pela árvore!); moverDatas não confere data real; dados() lê histórico; desfazer pelo ms exato
Task 7: fix round 1/5 dispatched (resume implementer; base 9e0124e)
Task 7: fix round 1/5 (5 addressed, 0 open; commits 9e0124e..b1422ff)
Task 7: complete (commits d9b41fd..b1422ff, 1 fix round; projetos 247 — contagens seguintes do plano ficam +18)
Task 7: minor (deferred): poda do histórico >300 é gravação separada (Area sem gravar+remover); etapa viva com fase morta mantém o id salvo — UI deve tratar fase morta como sem fase
Task 8: dispatched (base b1422ff, implementer sonnet)
Ruling: Task 8 aplicada sobre a estrutura corrigida da T7 (gravação única); testes do brief que contradizem a T7 são adaptados à T7 — a revisão da T7 (decisão 11, atomicidade) prevalece sobre o texto do plano — custo se errado: provas do T8 diferentes das do plano
Nota: revisão de segurança automática do commit apontou 'input-validation em projetos/src/repositorio.ts' (sem detalhes) — coberto pela revisão da Task 8 (entidadeValida/importar com dado malformado) e a conferir na revisão final da P2
Task 8: review Needs fixes — 2 Important (mover entre escopos pode sumir com o projeto; processo não validado derruba o índice); fix round 1/5 dispatched (resume, base 0fa5fc1)
Task 8: minor (deferred, P5 caixa/árvore): etapa sigilosa sem número entra no processo do projeto no índice (vinculos.ts:48,50); lacunas de prova na mesclagem; entidadeValida não confere itens de modelo
Task 8: fix round 1/5 (2 addressed, 0 open; commits 0fa5fc1..161e2ad)
Task 8: complete (commits b1422ff..161e2ad, 1 fix round; projetos 288)
Task 9: dispatched (base 161e2ad, implementer sonnet)
Task 9: complete (commits 161e2ad..4e4cedd, review clean; projetos 323)
Task 9: minor (deferred): criarProjetoDeModelo não valida cada etapa gerada nem o limite de 300 etapas
Task 10: dispatched (base 4e4cedd, implementer sonnet)
Ruling: revisão de segurança automática apontou DoS em modelos/aplicar.ts (modelo do Texto Padrão com aPartirDe/duracao enormes ou Infinity → laço de dias úteis congela a página). Load-bearing (dado compartilhado editável à mão). Correção pontual "P2-seg" depois da Task 10 e antes da Task 11: teto de dias úteis (≈ 10 anos) em calendario (somarUteis/fimPorDuracao/duracaoUteis com guarda de finitude e teto), entidadeValida confere itens de `m` (inteiros finitos ≥ 0, teto, fase/dependeDe por índice válido, checklist de strings), aplicarModelo e problemasDoModelo recusam/podam valores fora do teto — custo se errado: um modelo legítimo de mais de 10 anos seria recusado
Task 10: done f24ef4d (353) — review dispatched; P2-seg dispatched em paralelo (arquivos distintos)
Task 10: complete (commits 4e4cedd..f24ef4d, review clean)
Task 10: minor (deferred): bar.refresh() reseta a classe do grupo para bar-wrapper (after_render reaplica)
P2-seg: done a9d9be7 (381) — review dispatched
Task 11: dispatched (base a9d9be7, implementer sonnet) em paralelo à revisão do P2-seg
P2-seg: complete (commits f24ef4d..a9d9be7, review clean)
Ruling: período do Gantt em décadas (etapas válidas em 2000 e 2100) congela a renderização em Dia/Semana — a Task 12 (montarGantt) limita colunas (máx. ~1500: se período/escala exceder, sobe para a escala mais larga que caiba e avisa) e problemasDaEtapa ganha o teto de ~10 anos por etapa — custo se errado: escala trocada sozinha em projeto muito longo
P2-seg: minor (deferred): Infinity/NaN em aPartirDe vira 0 (seguro; validador barra); diferencaDias NaN com data inválida (protegido por dataValida na entrada); provas por relógio
Task 11: review Needs fixes — 1 Important (data malformada lança em tarefasDoGantt e o Gantt inteiro não desenha); fix round 1/5 dispatched (resume, base 66acc5b)
Task 11: minor (deferred): classes st-futura/st-vazia do portfólio sem CSS ainda (T12); etapa com fase inexistente aparece solta (sem prova); ciclo de dependência não guardado no wrapper
Task 11: fix done 3af91ea (407) — re-review dispatched; Task 12 dispatched em paralelo (base 3af91ea)
Task 11: fix round 1/5 (1 addressed, 0 open; commits 66acc5b..3af91ea)
Task 11: complete (commits a9d9be7..3af91ea, 1 fix round; projetos 407)
Task 12: done 180e6b5, a27a5b9 (444) — review dispatched
Task 12: review Needs fixes — 1 Critical (arraste de 1 dia em Semana perdido; armar no mousedown), 2 Important (teto de colunas furado por dado malformado; aoAjustarEscala inconsistente); fix round 1/5 dispatched (resume, base a27a5b9)
Ruling: Critical 1 da Task 12 é código mandado pelo plano — corrigir (spec 3.1 exige arrastar e gravar) — custo se errado: nenhum além de retrabalho do wrapper
Task 12: minor (deferred → P3): prova de idempotência antes do rAF; uso após destruir sem trava; FOLGA_DIAS Mês; notas do app (completarComDependentes antes de validar; atualizar com linhas antigas se gravar falhar; realce reaplicado; destruir antes de remontar; portfólio somenteLeitura; gantt exposto permite change_view_mode direto)
Task 12: fix round 1/5 (3 addressed, 0 open of the originals; 2 NEW from the fix: Critical clique em Mês/Ano/somenteLeitura regrava datas; Important datas presas/saneadas viram "mudança" no clique; commits a27a5b9..535a162)
Task 12: fix round 2/5 dispatched (resume, base 535a162)
Task 12: minor (deferred): botão não primário também armaria (resolvido pelo portão do Critical)
Task 12: fix round 2/5 (2 addressed, 0 open; commits 535a162..7be4340)
Task 12: complete (commits 3af91ea..7be4340, 2 fix rounds; projetos 458)
Task 12: minor (deferred → P3): arraste com botão direito/meio desloca a barra sem salvar até o próximo redesenho; portão de escala só no mousedown (trocarEscala/atualizar durante o clique segurado) — 1 linha: pendente=false em desenhar
Final review: dispatched (projetos/ de 63f9e28..7be4340, opus)
Final review: With fixes — 7 Important (regra de dependência no arraste; linha de base no 2º replanejamento; entidadeValida rasa; carimbo do futuro; sigiloso vaza no histórico e perde número local; moverDatas aceita data impossível; ciclo mesclado trava edição) + 5 minors baratos; achados em final-findings.md
Final fix: dispatched (base 7be4340, opus)
Final fix: commits 5e9fb17, e89ab8a, 0a2b9a6 (580) — re-review dispatched
Final fix re-review: all 12 addressed, no new Critical/Important (opus); 3 minors novos
Final fix: minor (deferred → P4): base com datas invertidas pode ser gravada por arraste de etapa torta (entidadeValida aceita etapa fim<inicio mas não base invertida); criarProjetoDeModelo sem faixa de anos; troca de processo some do histórico quando o antigo era sigiloso vazio
P2: COMPLETE (63f9e28..0a2b9a6). projetos 580.
