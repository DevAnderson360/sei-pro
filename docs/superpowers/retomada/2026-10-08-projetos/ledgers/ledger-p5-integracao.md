# SDD ledger — plan: docs/superpowers/plans/2026-10-06-projetos-p5-integracao.md

Spec: docs/superpowers/specs/2026-10-06-projetos-design.md (+ telas/integracao.html). Plano escrito por agente (commit 1369ec4), ensaiado sobre 04eac50 + P4 do PLANO (não o P4 executado).

## Pré-voo (conflitos com o P4 executado e entre tarefas)
| Linha | Achado | Ruling |
|---|---|---|
| Decisão 16 × P4 T3 | `abrirProcesso` só com `/^[\d./ -]{1,40}$/` recusa número com letras (SEI-RJ) que o P4 aceita (`RE_PROTOCOLO`) | Ruling: usar a forma do vínculo do P4 (`[A-Za-z0-9./-]`, até 40; espaço tolerado só nas pontas) — custo: nenhum |
| T1 `marcarSigiloso` × P4 T4 | o P4 tem a marca que "gruda", a memória local do sigilo (origem local/aprendida) e `marcasAoGravar` | Ruling: `marcarSigiloso` grava pela máquina do P4 (marca no vínculo sem mudar carimbo + memória como LOCAL, falha fechada); não reescrever a regra (`modelo/sigilo.ts`) |
| T1 índice × P4 T4 r5 | etapa com processo próprio vazio marcado (`VINCULO_VAZIO`) | conferir que o índice trata o marcador como "processo próprio sigiloso" (não cai no do projeto) — prova |
| T6 × P4 T13 | o P4 já criou `ligarSincronia` (pagina/sincronia.ts) e mudou `pagina/main.ts`; `SincroniaPagina` confere repos coerentes | Ruling: a T6 reestrutura por tela PARTINDO do `ligarSincronia`/`principal` reais (não do plano); provas do P4 não podem cair |
| T4/T5 × P4 T12/T13 | o P4 criou `ligarApp` (app/ligacao.ts) e a `Colaboracao` real | Ruling: o lateral monta pelo `ligarApp` com `modo: "lateral"` (mesma Colaboracao, Proxy do Entendi, arquivo ligado) |
| T7/T8 × P4 T7 | gravações do balão em "Toda a unidade" pedem o "Entendi" | Ruling: usar a mesma porta/consentidor do P4 (`consentimentoProjetos`, `consentidor`); "Agora não" mantém o formulário |
| T7/T8 × P4 T4 r5 | documento sigiloso = marcador `{numero:"", sigiloso:true}`; número de documento só dígitos (1–20) | concluir com documento da árvore respeita a regra; documento de processo sigiloso marcado |
| T9 × P4 | o Agente lê o storage local; sigiloso pela regra + memória | Ruling: `projetos_listar` usa `sigiloDoEnvelope` + memória para decidir o que omitir (não só `processo.sigiloso`) — custo: nenhum |
| T11 | regera bundles e ajuda | regerar TODOS os bundles tocados; o rascunho de ajuda não é publicado |
| Contagens | plano parte de projetos 1308/sei-comum 451/sei-nucleo 125; real (fim do P4) maior | somar a diferença; o que vale é não cair |
## Execução
Task 1: dispatched (base 0b83a3f, implementer opus); base real: projetos 2059, sei-comum 468, sei-nucleo 136, favoritos 578, historico 485, agente-ia 1054
Task 1: implementer agent a1244146eeca29366
Task 1: implementer DONE (1f8f94d, 1121aeb; projetos 2094). Notas p/ T7/T8: marcarSigiloso uma vez por carga (lê o escopo inteiro).
Task 2: dispatched (base 1121aeb, implementer a491189b399dd062c) em paralelo à revisão só-leitura da T1 (arquivos disjuntos)
Task 1: review Approved (0 Critical/Important); Minor 1 (privacidade, anterior à T1): vínculo vazio SEM marca vindo de fora faz documento de etapa de processo sigiloso ir ao texto — corrigir já (normalizar na importação)
Ruling: vínculo `{protocolo:""}` sem `sigiloso:true` vindo de fora é normalizado para AUSÊNCIA de processo (no `importar`/`vinculoValido`), para índice, balão e regra de sigilo concordarem por construção — custo: nenhum (o diálogo nunca produz esse vínculo)
Nota p/ T7/T8: chamar marcarSigiloso para todo processo sigiloso visto na tela, uma vez por carga; marcarSigiloso deve considerar também os registros "processo" do escopo (número só em registro) — pedir na T7
Nota p/ T6/T7: marca automática sem consentimento deixa a faixa "esperando o Entendi" (defensável: pede para tirar o número do SEI)
Task 1: fix r1 DONE (906bcd4; projetos 2106). Ajuste no importar: não grava item que fica igual depois das marcas (vale para todas as mesclas).
Task 2: implementer DONE (1501f73; favoritos 604, agente-ia 1056). Nota: grep BSD dá 0 falso no background.js (14 bytes legados no cabeçalho, conferir com perl/python).
Task 3: dispatched (base 1501f73, implementer a6382e77e90e112ea, sonnet — código completo no brief) em paralelo às revisões só-leitura da T1 r1 e T2
Task 2: review Approved (0 Critical/Important)
Task 2: complete (commits 906bcd4..1501f73; favoritos 604, agente-ia 1056)
Task 2: minor (deferred P6): teto 60000 do contador duplica LIMITES do projetos (sem teste que amarre); conferir a aba ausente no pacote oficial GERADO (P6)
Task 3: implementer DONE (ba913dd; projetos 2148)
Task 3: review r1 Needs fixes — Important: miniGantt com ano fora da faixa lança; Minors prazo torto e lápide no cartão; task-3-findings-r1.md
Task 1: fix round 1/5 (1 addressed, 0 open; commits 1121aeb..906bcd4)
Task 1: complete (commits 0b83a3f..906bcd4, 1 fix round; projetos 2106)
Task 1: parked (leva final da P5): aplicar semVinculoVazio também na LEITURA (entidadesDe), para dado gravado antes de 906bcd4 (só perfis de teste; sem isso, A/B alternam e o número vai em claro)
Task 3: fix r1 DONE (0c6e1ff; projetos 2169)
Task 4: dispatched (base 0c6e1ff, implementer a020b71af05d799d6) em paralelo à re-revisão só-leitura da T3 r1
Task 3: fix round 1/5 (3 addressed, 0 open; commits ba913dd..0c6e1ff)
Task 3: complete (commits 1501f73..0c6e1ff, 1 fix round; projetos 2169)
Task 3: parked (leva final P5): agenda.ts:61 quando() com fim null lança no localeCompare (só dado mal validado); filtrar etapas com fim fora da faixa antes de alertasDasEtapas (senão caem em grupo inventado)
Task 4: implementer DONE (77733b9; projetos 2224). ligarApp ganhou modo/aoContar (a T5 deve usar o ligarApp, não montar a Colaboracao à mão). Exportar planilha do lateral pelo exportar() real (memória do sigilo). Indicador calmo só ícone no lateral (380 px).
Ruling: no lateral, o estado calmo da sincronia aparece só como ícone (com rótulo acessível), pendente/erro com a palavra — o topo cabe em 380 px — custo: usuário vê só o ícone quando está tudo bem
Task 4: review Approved (0 Critical/Important)
Task 4: complete (commits 0c6e1ff..77733b9; projetos 2224)
Task 4: parked (leva final P5): (1) sincronia calma no lateral: ícone próprio para "local" e texto em span visualmente oculto (não só cor/title); (2) data null no balão (formatarData(null), P3) + data torta entrando no contador da aba — prova de data torta no nível do lateral; (3) escopo do cartão no nome acessível; (4) provas: preferência gravada de "Projetos"; foco no balão reaberto no lateral
Ruling (leva final): navegação implícita (Ver no projeto, foco vindo da caixa/árvore, novo projeto) NÃO grava modoLateral; só o toque explícito no segmentado grava — a tela diz que o lateral abre na Agenda — custo: nenhum
Task 5: dispatched (base 77733b9, implementer opus)
Task 5: implementer agent a9ba80bd1b3b4ee64
Task 5: implementer DONE (164aeab; projetos 2285). modaisDaVez fecha diálogos da montagem antiga; RPC por montagem; pedido de foco validado. Nota p/ T6: apresentar chaveDaAba(ctx) e registrar os tratadores do lateral (lista no task-5-report.md).
Task 5: review r1 Needs fixes — Important: areaChrome não mapeia newValue→novo (defeito de raiz no sei-comum; afeta Favoritos PUBLICADO: selo do painel some, troca de aba ao vivo, progresso da atualização) + Minors; task-5-findings-r1.md
Ruling: corrigir na raiz (areaChrome mapeia newValue/oldValue → novo/antigo) com prova no formato do Chrome e regerar todos os bundles — o defeito também está no master (Favoritos/Histórico publicados) — custo: mexe em comportamento dos Favoritos (agora passa a funcionar como pretendido)
Ruling: aviso único depois da troca de unidade ("Você mudou para a X. O que estava aberto na Y foi fechado sem gravar.") em vez do "Sem o Entendi…"
NOTA P/ RESULTADO FINAL: avisar o usuário do defeito no master (areaChrome sem novo/antigo) — sugerir levar a correção ao master/próxima versão
Task 5: fix r1 DONE (f2bcb0d, 9081ee1, 7c4a977, e294d39; projetos 2298, sei-comum 483, favoritos 607). 9 bundles regerados. Biome com erros pré-existentes em sei-comum/base.css, verificar-armazenamento.ts:53, favoritos/src/arquivo.ts:155.
Task 5: re-review r1 no — item 2 parcial (recarga da mesma aba não avisa) + pré-existente: toda navegação no SEI desmonta o lateral e fecha diálogos em silêncio
Ruling: carência (~8 s) antes de desmontar o lateral quando a aba some; mesma chave volta → nada muda; outra chave → remonta e avisa uma vez — o SEI recarrega a aba a cada navegação — custo: até 8 s mostrando a unidade antiga depois de fechar a última aba
NOTA P/ RESULTADO FINAL: o lateral dos Favoritos publicado tem o mesmo padrão (desmonta a cada navegação; favoritos/src/app/main.ts:133-140) e o storage de sessão troca a aba do painel em todas as janelas — sugerir a mesma carência lá
Task 5: fix r2 DONE (5b095d2, f47313f; projetos 2313)
Task 5: re-review r2 no — Important novo (processosMemo congela com a carência) + Minors; task-5-findings-r3.md; fix r3 dispatched (mesmo implementador)
Task 5: fix r3 DONE (9a74a87, 4caed97; projetos 2320)
Task 6: dispatched (base 4caed97, implementer a6ae7e83fe3ac8a87) em paralelo à re-revisão só-leitura da T5 r3
Task 5: fix round 3/5 (all addressed, 0 open; commits 164aeab..4caed97 — r1 raiz areaChrome + contadores; r2 carência; r3 memo da caixa + timers + mensagem)
Task 5: complete (commits 77733b9..4caed97, 3 fix rounds; projetos 2320, sei-comum 483, favoritos 607)
Task 6: implementer DONE (5c75227, 6be2181; projetos 2377). init_projetos.js 129688→135009. Frames retornam cedo. SEM_PAINEL no Controle filtrado por marcador. Nota P6: conferir se o link do menu (reset=1) traz a lista completa.
Task 6: review r1 Needs fixes — Important: SEM_PAINEL na visão por marcadores (o menu abre a lista completa; navegar); Minors: sincronia só com link de Textos Padrão nas outras telas; isSafeInteger; task-6-findings-r1.md
Ruling: a divisão do content script (carregador mínimo em todo frame + import() do pacote pesado só no topo com unidade e no frame da árvore) fica para a Tarefa 11 — a T8 é a que mais cresce o bundle; a T11 já cuida dos bundles e portões — custo: WAR novo no Lab e passo na receita do oficial (P6)
Nota p/ P6: custo de várias abas em SEI HTTP (rodadas simultâneas; sorteio 0–5 s e pular se o status já mostra rodada ok — vale também para os Favoritos)
Task 6: fix r1 DONE (31c0395, 796d79a; projetos 2381)
Task 7: dispatched (base 796d79a, implementer ae9cfdc6c0befcf80) em paralelo à re-revisão só-leitura da T6 r1; inclui marcarSigiloso lembrar número só em registro (parked da T1)
Task 6: fix round 1/5 (3 addressed, 0 open; commits 6be2181..796d79a)
Task 6: complete (commits 4caed97..796d79a, 1 fix round; projetos 2381)
Task 7: implementer DONE (7c7451b, f077185; projetos 2457). init_projetos.js 135→182 KB (22 KB base.css). Nota T8: abrirLateral(aba,id,etapa); Entendi pelo comConsentimento+consentidor da P4.
Task 9: dispatched (base f077185, implementer af0a363afad05a183) em paralelo à revisão só-leitura da T7 (agente-ia, disjunto); ruling: sigilo do Agente pela regra + memória, falha fechada
Task 7: review Approved (0 Critical/Important)
Task 7: complete (commits 796d79a..f077185; projetos 2457)
Task 7: minors → T8 (mesmos arquivos conteudo/balao/adicionar): (1) marcarSigilosos(lista) com uma leitura por escopo; (3) foco nos redesenhos internos do balão; (4) Tab/Shift+Tab saindo do balão fecha (focusout); (5) mensagem neutra no balão; (6) checar já-concluída e RE_DOCUMENTO ANTES de perguntar o Entendi; (8) MAX_DIAS_UTEIS no max; "Processo do projeto" quando já é o processo não regrava
Task 7: parked (leva final): (2) número só em registro fica no texto até 5 min (avisar a sincronia depois da marca); (7) gesto perdido no Abrir no painel se o painel ainda monta (raro)
Ruling: no balão, "Agora não" mostra "Nada foi gravado: os projetos de “Toda a unidade” só mudam depois do “Entendi”." (neutro, sem vermelho) em vez de MENSAGEM_SEM_ENTENDI — no balão não há o seletor "Só eu" que a mensagem cita — custo: nenhum
Ruling: o carregamento sob demanda do balão (+base.css, ~40 KB) entra na divisão com import() da T11 — custo: WAR novo no Lab
notas-t8.md criado
Task 8: dispatched (base f077185, implementer a9f4fe353a18ae449) EM PARALELO à T9 (agente-ia)
Ruling: T8 e T9 em paralelo (exceção à regra de um implementador por vez) — pacotes disjuntos (projetos/src/pagina × agente-ia), cada um adiciona só os seus caminhos, nenhum build de um escreve as saídas do outro — custo se errado: colisão de commit (index.lock) ou bundle do outro comitado; o controlador confere o git log depois
Task 9: implementer DONE (2d341f6, 1ffb2ed; agente-ia 1086). painel.js 262→319 KB.
Task 9: review r1 Needs fixes — Important: número sigiloso escapa com invisível/espaço; Minors; task-9-findings-r1.md
Ruling: a sugestão de projetos do Agente pode tirar "Pendências da unidade" das 4 visíveis no Lab, só com a opção ligada — quem liga Gerenciar Projetos quer ver projetos — custo: uma sugestão a menos visível
Ruling: o Agente continua sem receber número de processo nem comum dos projetos (decisão 14) — custo: "em que pé está o projeto X" não chega ao processo_consultar
NOTA P/ RESULTADO FINAL: caixa_listar do Agente (já publicado) manda ao modelo o número dos processos sigilosos da caixa (ponte/operacoes.ts:306) — avisar o usuário
Task 8: implementer DONE (6441834, 02891d5; projetos 2530). init_projetos.js 182→193 KB. Nota: agente/painel.js sem marcarSigilosos — regerar na T9 r1 ou T11.
Task 8: review r1 Needs fixes — Important: focusout reabre o balão ao clicar no ícone (caixa e árvore); Minors; task-8-findings-r1.md
Task 9: fix r1 DONE (8d2c346, 7f171e7, 2272b5a; agente-ia 1099)
Task 9: re-review r1 no — regressão: processo conhecido < 15 dígitos colado a outro número por ' - ' vaza (pedaços só conferem documentos); fix r2 dispatched
Task 8: fix r1 DONE (d45fd59, 050b1ae; projetos 2545)
Task 8: fix round 1/5 (5 addressed, 0 open; commits 6441834..050b1ae)
Task 8: complete (commits 6441834~1..050b1ae, 1 fix round; projetos 2545)
Task 10: dispatched (base 050b1ae, implementer a956d354f20e6cfbe, sonnet) em paralelo à T9 r2 (disjuntos)
Task 9: revisão de segurança automática apontou sensitive-data-redaction-bypass em projetos.ts (provável 8d2c346) — enviado ao implementador r2: dígitos Unicode (NFKC), separadores tipográficos, SEI-RJ, campos separados
Task 9: fix r2 DONE (a24b006, 5761b07; agente-ia 1106) — a mensagem da revisão de segurança chegou depois; r3 despachada com as variantes (NFKC, separadores tipográficos, SEI-RJ, campos)
Task 10: implementer DONE (271059a; sei-comum 486, projetos 2547)
Task 10: review Approved (0 Critical/Important)
Task 10: complete (commit 271059a; sei-comum 486, projetos 2547)
Task 10: parked (leva final P5): setas esquerda/direita + tabindex roving no tablist das abas (WAI-ARIA)
Task 9: fix r3 DONE (ae88c82, 951464c; agente-ia 1112). Variantes Unicode/tipográficas/SEI-RJ fechadas.
Ruling: ficam de fora da redação do Agente o número quebrado entre campos e codificações visíveis (HTML, extenso, chinês, letras no meio) — quem lê vê que é codificação; detectar prefixos/sufixos de 40 mil números é inviável e contornável — custo: um usuário que divida de propósito o número sigiloso em dois campos o expõe ao Agente
Task 11: dispatched (base 951464c, implementer aa218ee61c11958fa) — inclui a divisão do content script (carregador + import() do pacote pesado e do balão), WAR novo no Lab, ajuda ajustada à realidade
Task 9: re-review r2-r3 no — regressão (maior por tamanho bruto vs chaveDocumento) + burlas ASCII (vírgula, \, ;, separador repetido) e sósias Unicode
Ruling: redação genérica — normalizar (NFKC, \p{Nd}→ASCII, dingbats, invisíveis), juntar grupos de dígitos por qualquer conector de 1–3 não-letras (espaço simples sozinho separa), conferir trechos pela CHAVE — a lista de separadores é infinita — custo: mais falsos positivos com números conhecidos por coincidência (falha fechada)
Task 9: fix r4 dispatched — implementador NOVO (opus), task-9-findings-r4.md
Task 9: r4 implementer agent a5b6e09fe0e7c6ea4 (paralelo à T11, disjunto)
Task 9: revisão de segurança automática (ae88c82): control regression + parser differential em projetos.ts — enviado ao r4: redigir sobre o texto FINAL que vai ao modelo (depois de varrer/anonimizar/paraModelo) e rodar todas as sondas anteriores
Task 11: implementer DONE (cf8b9ce, dde10f7; projetos 2581). init_projetos 188.6→2.7 KB; pagina.js+pagina-comum 151 KB; balao.js 41 KB; WAR +3 no Lab; use_dynamic_url barrava no Chrome 151. Receita do oficial: tirar init_projetos.js + 6 entradas WAR.
Task 11: review Approved (0 Critical/Important)
Task 11: complete (commits 951464c..dde10f7; projetos 2581)
Task 11: parked (leva final P5): (1) chrome.runtime?.id antes do import() do balão + aviso "recarregue a página" (aba órfã depois de atualizar a extensão); (3) prova que amarra os matches do WAR aos do content script; (4) ajuda: desinstalar apaga projetos e cópias diárias
Task 9: fix r4 DONE (65e7c3f, 0568f6c, 9c1d959, e8b71ec; agente-ia 1126). Motor ganhou ContextoTool.aoModelo (passada final opcional em paraModelo).
Ruling: na regra da FORMA (15+ dígitos de número desconhecido), ", " e "; " cortam a cadeia — listas de datas/horários ("01/10/2026, 15/10/2026") não viram [nº de processo]; números CONHECIDOS continuam sendo juntados por qualquer conector — custo: processo desconhecido escrito "50300, 000001, 2026, 01" passa (não é conhecido aqui; não está marcado sigiloso) — aplicar na leva final da P5 se a re-revisão não pedir antes
Task 9: re-review r4 no — 2 Important de controle (dígito não ASCII colado; espaços tipográficos gastando o limite) + Minors
Ruling: REVOGADA a regra de vírgula/ponto e vírgula cortar a cadeia na forma (custo quadrático e perda da rede do NUP conhecido) — listas por ", " viram [nº de processo] no texto ao Agente (falso positivo aceito, falha fechada)
Task 9: fix r5 (ÚLTIMA) dispatched — implementador NOVO opus, task-9-findings-r5.md
Task 9: fix r5 DONE (29b2d16, e2aa740, ecc0d56, 3936c67, 6799b2b; agente-ia 1138)
Controlador conferiu em 6799b2b: projetos 2581, sei-comum 486, sei-nucleo 136, favoritos 607, historico 485, agente-ia 1138 — 0 falha
ALL P5 TASKS IMPLEMENTED — final review dispatched (a72e045e2cd7f8070, 0b83a3f..6799b2b) em paralelo à re-revisão só-leitura da T9 r5
Task 9: fix round 5/5 (all addressed, 0 open; commits 951464c..6799b2b — r4 redação genérica + passada final; r5 escrita do dígito, espaço tipográfico, bidi, finais por passo)
Task 9: complete (commits f077185..6799b2b, 5 fix rounds; agente-ia 1138)
Task 9: parked (Minor): bidi misto por classe do conector (ES/CS/ET) com letra RTL no campo; pior caso de custo ~1,9 µs/car. (linear)
PAUSA pedida pelo usuário em 08/10/2026 08:19: nada novo é despachado; a revisão final da P5 (a72e045e2cd7f8070, só leitura) segue até terminar. Próximo passo ao voltar: ler o resultado dela, fazer a leva final da P5 (achados + parked), depois a P6 (validação ao vivo SP 4.1.5 e MJ hml 5.0.4 + revisão final da branch).
P5 final review (a72e045e2cd7f8070, 0b83a3f..6799b2b): "with fixes" — 0 Critical; 1 Important: correção do areaChrome faz o shell trocar de aba em TODAS as janelas (painelAba no storage.session é global) — background grava {aba, janela: sender.tab.windowId}, shell só segue a própria janela (chrome.windows.getCurrent), clique do shell grava chave por janela; Minors: (2) lerContexto serializa a página inteira (outerHTML) em todo topo — passar html:"" + doc; armazemNaTela só no menu; (3) pintar da caixa relê todas as linhas a cada mutação — sair cedo sem vínculos/sigiloso pendente; (4) ligarCaixa antes de ligarLateralDaAba — isolar com try/inverter; (5) marcarSigilosos pode desfazer edição concorrente — reler antes de gravar; (6) aba órfã: area.obter síncrono lança no lateral.ts:48/ponte 179-185 — try ou parar() sem chrome.runtime.id; (7) opção Gerenciar Projetos desligada: esconder aba Projetos do shell/zerar contador; (8) chromeFalso avisa no set sem mudança (Chrome não) — ajustar; (9) ícone na árvore em toda tela mesmo sem projeto (decisão de produto P6)
Ruling: o item 1 (shell troca de aba em todas as janelas) entra na leva final da P5 — regressão introduzida pela própria correção do areaChrome em código publicado
Leva final P5 (09/10/2026, ae6e892): FEITOS o Important (shell troca de aba só na própria janela: background grava {aba, janela, t}, shell segue só a própria, clique do shell em painelAba:<janela>, vale o mais recente; prova com duas janelas em sei-comum/tests/verificar-area-chrome.ts) e os Minors 2 (lerContexto com html vazio) e 4 (ligarCaixa em try). Sem re-revisão (decisão do autor).
Ruling: a notificação de rotina do Agente grava janela null (não sabe a janela) e vale para qualquer painel aberto — custo: com duas janelas, o clique na notificação pode trocar a aba do painel de outra janela
Ruling: ContextoProjetos.versao fica "" (html vazio no lerContexto da janela de topo) — nada no código usa — custo: se alguém passar a depender da versão do SEI no contexto, precisa lê-la de outro jeito
Merge origin/master (2.6) em 0937081: conflito só no dist/manifest.json (Projetos e anotações do controle viraram dois content_scripts separados); bundles regerados.
PARKED (abertos após a leva mínima): Minors 3, 5, 6, 7, 8, 9 e os guardados T1, T3, T4(1-4), T7(2,7), T9(bidi), T10, T11(1,3,4) — lista completa na seção 2 do README.
P5 CLOSED (leva mínima, sem re-revisão). Suítes: projetos 2582, sei-comum 502, sei-nucleo 136, favoritos 607, historico 485, agente-ia 1138, anotacoes-controle 29 — 0 falha.
