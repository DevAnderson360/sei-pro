# SDD ledger — plan: docs/superpowers/plans/2026-10-06-projetos-p1-comum.md

Spec: docs/superpowers/specs/2026-10-06-projetos-design.md (alcançável). Branch feat/projetos-ts, worktree ../sei-pro-projetos. Base do plano: 50d5d18.
Linha de base das provas: sei-comum 178, sei-nucleo 110, favoritos 578, historico 485, agente-ia 1054. Meta P1: sei-comum 384, demais iguais.

## Varredura prévia (pares que compartilham arquivo/interface)

| Tarefas | Compartilham | Produz → consome | Achado |
|---|---|---|---|
| T1–T10 | sei-comum/tests/verificar.ts | cada uma acrescenta uma suíte | sequencial, sem conflito (ensaiado) |
| T1 → T3, T4, T6 | assinatura.ts / textoPadraoCodec.ts | T1 produz jsonEstavel/assinaturaEstavel/nomeDeTextoInterno/gerar+lerConteudoTexto → motor (T3), controle (T4), arquivo (T6) | coerente |
| T2 → T3, T4, T9 | trava.ts / consentimento.ts; favoritos/src/pagina/main.ts | T2 produz Travar/travarComLocks/travarEsperando → T3/T4; main.ts também tocado em T9 | linhas de T9 citadas "antes da tarefa" (regra do plano); ok |
| T3 → T4, T6 | motor.ts; tests/adaptadorTeste.ts | T3 cria adaptadorTeste, T6 acrescenta adaptador de arquivo | sequencial, ok |
| T5 → T6 | banco.ts/copias.ts | banco por módulo usado pelos handles do arquivo | ok |
| T6, T7, T8 | favoritos/src/app/main.ts | edições em regiões distintas; números de linha relativos ao estado pós-tarefa anterior | ok (plano manda casar por texto) |
| T7 | historico/src/app/{main,app}.ts | só T7 toca | ok |
| T8 → T9 | painel/altura, sobreposicao, aviso → embutido.tratadoresDoPainel | coerente |
| T1–T9 | dist/js bundles de favoritos/historico | regenerados e comitados por tarefa | ok |

| Tarefa | Coerência interna |
|---|---|
| T1–T10 | código ensaiado pelo redator numa cópia: provas e implementação batem (sei-comum 178→384) |
| T11 | só fechamento (README + portões) |

Varredura limpa; nenhuma regra a decidir.

## Progresso
Task 1: dispatched (base 50d5d18, implementer sonnet)
Task 1: complete (commits 50d5d18..f817c37, review clean; contagens conferidas pelo controlador)
Task 1: minor (deferred): textoPadraoCodec.ts:194-200 sigla longa deixa 'cabe' negativo (inalcançável com FAV/PRJ)
Task 1: minor (deferred): verificar-sincronia-base.ts:379 /editado/ casa também a mensagem de vazio; :84 asserção fraca; sem hash-ouro de assinaturaEstavel
Task 2: dispatched (base f817c37, implementer sonnet)
Task 2: complete (commits f817c37..47e2ffc, review clean; contagens e trailer conferidos)
Task 2: minor (deferred): preferencias.ts JSDoc solto; lerConsentimento não valida valores do mapa
Task 3: dispatched (base 47e2ffc, implementer sonnet)
(nota) plano P2 comitado durante a revisão da Task 3 (só docs; não afeta o diff ae24b2d)
Task 3: complete (commits 47e2ffc..ae24b2d, review clean, opus)
Task 3: minor (deferred): motor.ts:15-19,99 comentário conta re-mesclas errado (N releituras = N-1 re-mesclas)
Task 3: minor (deferred, P4 deve tratar): desistência após releituras marca pendente mas não agenda nova rodada — o controle/rodada seguinte precisa disparar (Review Focus 2 do mapa)
Task 3: minor (deferred, P4): comparação de HTML cru na releitura (motor.ts:216) — conferir no P4 que ler() do Texto Padrão é estável entre leituras (SEI 5 escape duplo)
Task 3: minor (deferred): permitido() depois da releitura alarga a janela; pendente pode ser sobrescrito por gravarStatus no fim da rodada (pré-existente)
Task 3: minor (deferred): favoritos/src/pagina/sincronia.ts:143 nome da trava escrito à mão (usar nomeDaTrava)
Task 4: dispatched (base 2d36811, implementer sonnet)
Task 4: complete (commits 2d36811..271d012, review clean)
Task 4: minor (deferred): iniciar() registra ouvinte de consentimento a cada chamada (pré-existente)
Task 5: dispatched (base 271d012, implementer sonnet)
Task 5: complete (commits 271d012..0b2a359, review clean)
Task 5: minor (deferred): prova do "banco antigo" usa o próprio abrirBanco; caminhos de erro do IndexedDB sem prova
Task 6: dispatched (base 0b2a359, implementer sonnet)
Task 6: complete (commits 0b2a359..3f01e96, review clean)
Task 7: dispatched (base 3f01e96, implementer sonnet)
Task 7: complete (commits 3f01e96..756b40c, review clean)
Task 8: dispatched (base 756b40c, implementer sonnet)
Task 8: complete (commits 756b40c..d67e5fb, review clean; implementador fez amend local antes do push — sem efeito externo)
Task 9: dispatched (base d67e5fb, implementer sonnet)
Task 9: complete (commits d67e5fb..a893d98, review clean)
Task 9: minor (deferred): favoritos/src/pagina/main.ts ~312 cast duplo `as unknown as PortaRpc` em chrome.runtime.connect
Task 10: dispatched (base a893d98, implementer sonnet)
Task 11: dispatched junto com a Task 10 (lote)
Task 10: complete (commits a893d98..258a04f, review clean, lote com T11)
Task 11: complete (commits 258a04f..63f9e28, review clean; suítes conferidas pelo controlador: sei-comum 384, sei-nucleo 110, favoritos 578, historico 485, agente-ia 1054; check-dom-injection 0/0)
Task 10: minor (deferred): limiar frouxo (>=6 cores) na prova de espalhamento do hash do avatar
Final review: dispatched (50d5d18..63f9e28, opus)
Final review: With fixes — 3 Important (motor: mudança local perdida em rodada longa; sem reagendamento após desistência; sem gancho antes de regravar inválido) + 5 minors a corrigir de passagem; achados em final-findings.md
Ruling: itens "fora desta leva" (gravar com conferência do anterior, ler sem link de alterar, leitura no recuo, não apagar o texto da unidade) vão para o plano P4 — são do armazém do núcleo/produto da P4 — custo se errado: corrida residual durante o gravar até a P4
Final fix: dispatched (base 75f54de, opus) — em paralelo só com a revisão (somente leitura) da Task 7 da P2
Final fix: commits 944d869, 9e0124e (8 itens, sei-comum 406; demais iguais) — re-review dispatched
Final fix re-review: all 8 addressed, no new Critical/Important (opus)
Final fix: minor (deferred): parar() não zera pararConsentimento; recuo após desistência substitui o timer de 15 s da mudança local (espera até 7,5 min em texto disputado); teto 5 min antes do sorteio; desistencias não zera em erro; provas g1-g3 dependem de tempo
P1: COMPLETE (50d5d18..9e0124e). Suítes: sei-comum 406, sei-nucleo 110, favoritos 578, historico 485, agente-ia 1054.
