# SDD ledger — plan: docs/superpowers/plans/2026-10-06-projetos-p4-sincronia.md

Spec alcançável. Começa depois do fechamento da P3 (ledger ../2026-10-06-projetos-p3-app). Plano ensaiado e reaplicado do markdown sobre 8f75b79 e 47e1485.
Contagens: base do plano projetos 960 / sei-comum 419; base real após a correção final da P3: projetos 1039 (+79), sei-comum 423 (+4). sei-nucleo 110 → 125 (T2). Favoritos 578, historico 485, agente-ia 1054 não mudam (mas a T2 regera bundles de favoritos/historico/agente).

## Varredura prévia
| Tarefas | Compartilham | Produz → consome | Achado |
|---|---|---|---|
| T1 → T4,T5,T7,T8 | sei-comum motor/codec (gravar conferindo, recuo de leitura, teto descompactado) | adaptador e controle | coerente |
| T2 → T5 | sei-nucleo armazém (ler sem link de alterar, conferir anterior, duplicata, SeiDoTexto/linkDoMenu) | armazemDoTexto | coerente; regera bundles dos 3 apps |
| T3 → T4..T12 | repositório pronto para sincronia | adaptador, arquivo, importação | coerente |
| T4 → T5,T7,T8 | adaptador | sincronia da aba, estado | coerente |
| T6 → T8 | envelope do usuário, arquivo, cópias | diálogo Sincronização | coerente |
| T7..T12 → T13 | componentes da colaboração | ligação no app/content script e dist | coerente |
| P3 final fix ↔ T7/T12/T13 | app.ts (aoMudar só troca o indicador), contexto.ts (atividadesConfigurado = só URL_API), balão (progressoComAtraso), filtro (filtroNoContexto), mostrarAviso 5º parâmetro | a P4 foi ensaiada ANTES disso | ruling: implementadores adaptam ao código real |
| T13 | âncoras do commit 8f75b79 | — | o plano manda rodar `git diff 8f75b79` antes de aplicar |

## Rulings
- Ruling: a P4 foi ensaiada sobre 8f75b79/47e1485; a correção final da P3 (68d832b..c247096) mudou app.ts/contexto.ts/balão/filtro/aviso — implementadores adaptam o código do plano ao código real e listam as adaptações; offsets de contagem +79 (projetos) e +4 (sei-comum) — custo: retrabalho local.
- Ruling: decisões do plano P4 aceitas — documento de processo sigiloso não vai ao Texto Padrão nem ao histórico; sem "apagar" para o texto da unidade; texto inválido substituído guardado em chrome.storage.local (content script não alcança o IndexedDB); ids da importação do Atividades determinísticos; "Entendi" por Proxy no repositório da unidade + faixa. — custo se errado: ajustes de produto pelo autor.

## Progresso
Task 1: dispatched (base 04eac50, implementer opus)
Task 1: done be17fd6 (sei-comum 451) — review dispatched (opus)
Task 1: review Needs fixes — 1 Important (envio agendado forçado fura o recuo e desfaz o lerNoRecuo; provado com o controle real); fix round 1/5 dispatched (resume, base be17fd6) incl. minors 2 e 3 (provas)
Task 1: minor (deferred): catch não grava ultimoPuxar quando só a gravação foi recusada; soLer não atualiza quando/zera tamanho; gravarConferindo redeclarado; mensagem "0 MB"
Task 1: fix round 1/5 (3 addressed, 0 open; commits be17fd6..0893b21)
Task 1: complete (commits 04eac50..0893b21, 1 fix round; sei-comum 456 — offset agora +9)
Task 1: minor (deferred): pendente marcado só por mesclar mudança de colega fica o recuo inteiro (tela "pendente" para quem só lê — P4 T7 deve exibir de forma branda); apagar() grava status fora da fila
Task 2: dispatched (base 0893b21, implementer opus)
Task 2: implementer agent a739443f8cc0fe76c
Task 2: implementer DONE_WITH_CONCERNS (commit b4f4e25; sei-nucleo 128 = brief 125 + 3 provas extras; outras suítes iguais). Concerns: duplicata na virada de página; duplicata sem link de excluir → recuo só leitura; excluir() só o menor id; mudança nos Favoritos (recusa sem link de alterar); dist/js/sei-nucleo.js gerado e não ignorado (apagado).
Task 2: reviewer dispatched (a230ca94219aa32cd, pacote review-t2.diff; pacote.sh agora exclui init_agente.js e sei-nucleo.js)
Task 2: review r1 Needs fixes — 1 Important (duplicata sem excluir trava um dia) + Minors 1-2 a corrigir; findings task-2-findings-r1.md
Task 2: minor (deferred): duplicata na virada de página (atraso de 1 puxada, sem perda); Favoritos só-leitura importam texto que nunca atualizam — lápide de 90 dias pode ressuscitar favorito (backlog)
Ruling: bytes > 0x7f nos bundles do agente (painel.js 53 bytes, init_agente.js 4, em literais de regex) são pré-existentes à P4 — fora do escopo; anotar para a revisão final/P6 — custo se errado: navegador com charset errado leria a regex mal (não visto em produção desde a 2.0)
Task 2: fix r1 DONE (cfc9cc2; sei-nucleo 136). Nota: linha sem id/consultar agora recusa também em ler/localizar (antes null → cadastraria 2º texto)
Task 2: fix round 1/5 (3 addressed, 0 open; commits b4f4e25..cfc9cc2)
Task 2: complete (commits 0893b21..cfc9cc2, 1 fix round; sei-nucleo 136 — offset +11 vs plano 125)
Task 3: dispatched (base cfc9cc2, implementer opus)
Task 3: implementer agent ac84e90ba72bd3e53 (base 1369ec4 — inclui commit do plano P5)
Task 3: implementer DONE_WITH_CONCERNS (057cbe0; projetos 1060 = +21). Concerns: protocolo com letras recusado; base invertida sem teto; bundles comitados antes da T13.
Ruling: número de processo pode ter letras (SEI-RJ "SEI-150016/000123/2021") — a forma do vínculo passa a /^[A-Za-z0-9./-]{0,40}$/ e o número digitado (campos.ts:93) aceita letras no começo, mantendo ≥8 dígitos e terminar em dígito — o SEI Pro é usado em vários órgãos com formatos diferentes — custo se errado: texto livre com letras e 8 dígitos passa como número (só rótulo, a busca do SEI resolve)
Ruling: bundles comitados nas tarefas intermediárias são aceitos (o build é determinístico; T13 regera) — custo: diffs maiores
Task 3: reviewer dispatched (aec328900e81fad7c)
Task 3: review r1 Needs fixes — 2 Important (sigiloso pela regra do envelope; registro "h" raspado) + decisão das letras + Minor do vínculo da caixa; findings task-3-findings-r1.md
Ruling: remoção/troca do documento de etapa sigilosa feita por colega não se propaga (manterDocumentoSigiloso restaura o local) — o número de documento sigiloso nunca vai ao Texto Padrão, então só quem digitou o conhece; marcador {numero:""} mexeria na T4 e na UI — custo se errado: A vê número antigo depois que B tirou/trocou o documento (só em processo sigiloso, editado por duas pessoas)
Task 3: fix r1 DONE (894e5ed; projetos 1085). Extra: número da caixa fora da forma recusado no diálogo; vínculo antigo não revalidado.
Ruling: número colado com rótulo ("Processo nº 50300...") — extrair o único pedaço que passa na regra, em vez de recusar ou limpar caractere a caractere — limpar por caractere com letras aceitas inventaria números — custo: dois números no texto são recusados
Ruling: a regra de sigilo do envelope fica numa função exportada do projetos (T3 r1b) e a T4 a importa no paraOTexto — evita duas cópias da regra divergirem — custo: nenhum
Task 3: r1b dispatched (mesmo implementador)
Task 3: r1b DONE (d27973a; projetos 1092; sigilo.ts sigiloDoEnvelope exportado)
Task 3: fix round 1/5 (4 + 2 extras addressed, 0 open; commits 057cbe0..d27973a)
Task 3: complete (commits 1369ec4..d27973a, 1 fix round + 1b; projetos 1092 — offset agora +132 vs plano 960+20)
Task 3: minor (deferred): sigilo.ts:47 vinculo() lança com protocolo não-texto (T4 põe o guarda); etapa com processo próprio sem dígitos num projeto sigiloso não é sigilosa (só texto forjado); restaurar arquivo não traz o número de volta a registro já raspado (T10 anotar)
Task 4: dispatched (base d27973a, implementer opus) — paraOTexto deve usar sigiloDoEnvelope
Task 4: implementer agent ac8bec17ab7b691c1
Task 4: implementer DONE_WITH_CONCERNS (b669e4a; projetos 1154 = +62). Concern: registro "documento" de etapa sigilosa vaza depois que a lápide é podada localmente (a regra deixa de reconhecer o alvo).
Ruling: ao podar localmente a lápide de etapa/projeto sigiloso pela regra do envelope, o repositório raspa na hora os registros do histórico daquele alvo (e das etapas do projeto podado) para os textos de sigilo, mantendo id e carimbo — raspar no paraOTexto todo registro sem alvo faria computadores com e sem a lápide gravarem textos diferentes (vai-e-volta); raspar na poda é determinístico porque a lápide é a mesma nos dois — custo se errado: o histórico local perde o número de um documento de etapa excluída há 180 (unidade) / 90 (pessoal) dias
Task 4: review r1 Needs fixes — 2 Important (vai-e-volta por sigilo deduzido; vazamento ao trocar processo) + 4 Minors; findings task-4-findings-r1.md
Ruling: "o sigilo gruda" — marca sigiloso de vínculo (por chave) e de documento (Documento.sigiloso) passa a ser GRAVADA no local em toda gravação do repositório, monótona e sem mudar carimbo; paraOTexto tira documento marcado e raspa registros por chave/número marcado; limpar raspa registros antes de podar — a regra deduzida do estado presente gera vai-e-volta e vaza ao trocar processo; não existe "desmarcar" na interface — custo se errado: um número que deixou de ser sigiloso no SEI continua escondido dos colegas para sempre (só aparece "processo sigiloso")
Ruling: relógio atrasado — exportar leva adiante os itens "do futuro" do remoto sem mudar — custo: item com carimbo forjado do futuro persiste no texto até alguém editar (já não é importado por ninguém com relógio certo... só aviso)
Task 4: revisão de segurança automática do commit apontou 'sensitive-data-exposure' em projetos/src/sincronia/textoPadrao.ts (sem detalhe legível) — coincide com os Important 1/2 (número sigiloso indo ao texto) em correção na r1; a re-revisão deve conferir textoPadrao.ts inteiro quanto a vazamento
Task 4: fix r1 NEEDS_CONTEXT com dc4d40c+1bede39 (projetos 1179): furo — marca some quando o último vínculo marcado sai (troca de processo) e registro antigo volta com o número; adaptação: aprendizado de marca pela cópia de mesmo carimbo; limpar raspa só o que perderia a base
Ruling: memória local e monótona do sigilo (chaves de processo + números de documento) por host|login, valendo para todos os escopos, nunca enviada; envelope raspa pela união com a regra deduzida; registro de mesmo carimbo raspado de fora ensina o número e o daqui fica — opções a/b mudariam o histórico do usuário ou dependeriam de todos gravarem igual; a memória converge pelo aprendizado — custo se errado: número que deixou de ser sigiloso fica escondido para sempre neste computador; teto de 5000 por conjunto
Task 4: fix r2 dispatched (mesmo implementador; task-4-decisao-r2.md)
Task 4: fix r2 NEEDS_CONTEXT com 6de9340 (projetos 1201): furo análogo com número de documento antigo só em registro (etapa deixa de ser sigilosa)
Ruling: princípio "o que o texto raspou uma vez continua raspado" — todo número (processo ou documento) que o envelope raspa por qualquer regra entra na memória local no momento da exportação; a poda pode deixar de reescrever se ficar redundante — fecha a família de furos por construção (a memória cobre tudo que já foi escondido) — custo: memória cresce com números de registros; teto 5000
Task 4: fix r3 dispatched (mesmo implementador)
Task 4: revisão de segurança automática do 6de9340 — (1) falha aberta/estado divergente em repositorio.ts; (2) despejo da memória influenciado de fora em memoriaSigilo.ts — enviados ao implementador dentro da r3
Ruling: memória do sigilo nunca despeja; entradas com origem local (sem teto) ou aprendida (teto 20000; cheia → não entra); erro ao ler/gravar a memória impede gravar o texto (falha fechada) — o teto com despejo deixava um colega empurrar números sigilosos reais para fora — custo: com 20000 aprendidas, um número que só um colega sabe sigiloso pode voltar ao texto por esta máquina
Task 4: fix r3 DONE_WITH_CONCERNS (1765b59; projetos 1224). Memória por chave de storage por número; poda não reescreve mais; falha fechada; origem local/aprendida.
Nota p/ T10: "Enviar projeto" deve montar o envelope pelo mesmo caminho do adaptador (mesma raspagem, memória e falha fechada).
Task 4: fix round 1-3/5 (r1+r2+r3: todos os itens do escopo resolvidos; re-revisão achou 2 Important novos no documento sigiloso por número + 2 Minors)
Ruling: documento sigiloso cortado vira marcador {numero:"", sigiloso:true}; ausência do campo = remoção legítima (propaga) — substitui o "restaura quando chega sem" e desfaz o ruling da T3 de não propagar remoção — custo: interface precisa tratar numero "" em todos os lugares
Ruling: origem da memória pela procedência (só este dispositivo = local) — custo: com 20000 aprendidas e colega hostil, vai-e-volta documentado
Ruling: T6/T10 levam a memória do sigilo no arquivo do próprio usuário; T7/T13 tratam erro de memória ilegível
Task 4: fix r4 dispatched — implementador NOVO (opus; o anterior passou de 500k tokens), task-4-findings-r4.md
Task 4: r4 implementer agent afbb8b553a6227195
Task 4: revisão de segurança automática (provavelmente do 1765b59): confidentiality-regression em sigilo.ts + resource-cap-bypass em repositorio.ts — coincidem com Important 1/2 e Minor 3 da r4; pedido ao implementador r4 conferir os dois no código atual (3034e40 já existe)
Task 4: fix r4 DONE_WITH_CONCERNS (3034e40+47aad07; projetos 1290). Origem pela operação (não pelo campo dispositivo, forjável). Concerns: teto cheio → número marcado por colega não guardado; vínculo vazio marcado é apagado ao salvar o diálogo (remoção chega a quem tem o número — perda de dado); troca de documento em etapa sigilosa não chega a quem tem o antigo.
Ruling: teto cheio de aprendidas (20000) aceito como custo documentado — só com colega hostil — custo: vai-e-volta com aquele colega
Ruling: troca de documento em etapa sigilosa não chega a quem tem o número antigo — inerente (o número nunca é transmitido)
restricoes.md item 10 atualizado pelo controlador (marcador, memória, sigilo.ts)
Task 4: re-review r4 dispatched antes da r5 (última) para juntar tudo
Task 4: fix round 4/5 (I1, I2, M3, M4 addressed; re-revisão r4 yes p/ itens, problema conhecido confirmado + 6 Minors/menores); commits 1765b59..47aad07
Ruling: teto da memória é aproximado (documentado, sem trava) — custo: poucas centenas acima de 20000 em corrida
Ruling: CSV deixa em branco o documento de etapa sigilosa/marcado (spec 456: "processo sigiloso sai em branco") — custo: o usuário não vê o próprio número sigiloso na planilha (vê no painel)
Ruling: documentoValido exige só dígitos (1-20) ou vazio — o "Número SEI" do documento é numérico em todos os SEIs — custo: se algum órgão tiver número com letra, o diálogo recusa
Task 4: fix r5 (ÚLTIMA) dispatched — implementador NOVO opus, task-4-findings-r5.md
Task 4: r5 implementer agent ac3cf0fc9705b7735
Task 4: revisão de segurança automática: 'information-disclosure (sigilo regression)' em repositorio.ts (provável 0c4964f da r5) — pedido ao implementador r5 comparar com 47aad07 e provar
Task 4: fix r5 DONE_WITH_CONCERNS (dc2144f, 0c4964f, 092d78f; projetos 1363). Fuzz comparativo 47aad07×0c4964f sem diferença na memória/textos. Concerns: teto cheio + colega troca processo → volta (documentado); doc >20 dígitos local ignorado pelos colegas.
Task 4: fix round 5/5 (7 addressed, 0 open; commits 47aad07..092d78f)
Task 4: complete (commits d27973a..092d78f, 5 fix rounds; projetos 1363)
Task 4: parked (para a leva da revisão final da P4): (1) campo de documento: "Despacho 12 (1234567)" salvo como "12" sem aviso, "(1234567)"/"1234567," recusados — aparar pontuação das pontas, preferir o pedaço entre parênteses, recusar ambíguo; (2) conferirEtapa no repositório deve aplicar RE_DOCUMENTO (o Agente da P5 pode gravar por lá); (3) prova da borda do teto (sonda t4r5rr/quase-cheia) + frase em memoriaSigilo.ts sobre a cascata contar no teto
Task 5: dispatched (base 092d78f, implementer opus)
Task 5: implementer agent a45e03845842f861e
Task 5: implementer DONE (cbc771b; projetos 1379). Notas p/ T13: main.ts captura rejeição de iniciar (storage.sync ao ler consentimento); em "erro" cada foco relê (custo de leitura).
Task 5: review Approved (0 Critical/Important)
Task 5: complete (commits 092d78f..cbc771b; projetos 1379)
Task 5: parked (leva final da P4, antes ou junto da T13): (1) sincronia.ts:87-102 um texto que falha derruba o outro (iniciar em série; agora() perde status da unidade) — isolar por controle; (2) host/login/unidade.id repetidos ao lado de repos[vis].escopo — derivar ou conferir no construtor; (3) provas não derrubam intervaloPuxar/releituras/lerNoRecuo; idProcedimento sem prova; sigilo no texto pessoal sem prova
Nota p/ T13: passar travarEsperando; .catch no iniciar
Task 6: dispatched (base cbc771b, implementer opus)
Task 6: implementer agent a3f1a505185e0051b (com decisão: arquivo leva a memória do sigilo)
Task 6: implementer DONE_WITH_CONCERNS (d2cb97f; projetos 1430). EnvelopeArquivo.sigilo por usuário. Exportação do arquivo falha fechada com memória ilegível (cópia do dia e arquivo param junto — T7/T13 mostram). Nota p/ T10: Enviar projeto NUNCA usa exportarTudo.
Task 6: review r1 Needs fixes — Important: restaurar reverte edições posteriores (spec "como nos Favoritos"); findings task-6-findings-r1.md
Ruling: restaurar cópia RECUPERA (só ausentes/com lápide voltam; vivo fica) — desvia da spec ("como nos Favoritos", recarimbar ativos) porque nos projetos da unidade isso reverteria em silêncio e para todos o que colegas fizeram depois — custo se errado: a cópia não serve para desfazer uma edição errada (só o Desfazer do app e o histórico)
Ruling: retirar a chave legada da memória (só existiu nesta branch) e mensagem genérica de memória ilegível — custo: nenhum para usuários
Ruling: arquivo aceita só a entrada sigilo do dono e no máximo 5000 novas locais por importação (resto aprendida) — custo: arquivo legítimo com >5000 números novos fica com parte como aprendida (sob teto)
Nota p/ T13: Importar manual testa versaoMaisNova antes de lerEnvelopeArquivo
Task 6: fix r1 DONE_WITH_CONCERNS (e437ce8; projetos 1443). Modelo ausente/lápide recarimbado no restaurar; arquivo ligado mantém entradas sigilo de outros logins (sem importar).
Task 6: fix round 1/5 (5 addressed, 0 open; commits d2cb97f..e437ce8)
Task 6: complete (commits cbc771b..e437ce8, 1 fix round; projetos 1443)
Task 7: dispatched (base e437ce8, implementer opus)
Task 7: implementer agent aee0633df4ea14eed
Task 7: implementer DONE_WITH_CONCERNS (a9dc023; projetos 1500). Notas: T12/T13 — salvarProjeto chama editarProjeto antes de mover (pergunta Entendi ao levar para Só eu; pular quando nome/processo não mudaram); T8/T13 — estado do arquivo/cópia usa o texto do ErroMemoriaSigilo; textoDoErro "indisponível" impreciso para quem só lê (sei-comum).
Task 7: review Approved (0 Critical/Important)
Task 7: complete (commits e437ce8..a9dc023; projetos 1500)
Ruling (p/ T12/T13): ao mudar "Quem vê" de "Toda a unidade" para "Só eu", validar antes (problemasDoProjeto), MOVER primeiro e editar no destino "Só eu" — sem "Entendi" à toa — custo: nenhum (a edição vai junto, no destino)
Task 7: parked (leva final ou T12): estado.ts:70-72 envolver aguardandoPermissao/"nunca" em com(...) (rótulo "erro" sem explicação); estado.ts:159-170 registrar ouvintes antes do primeiro ler(); consentidor sem tratar falha do storage.sync (quota do sync traduzida como cota do local; T12); faixa aguardando com role=status (opcional); textoDoErro "indisponível" para quem só consulta (sei-comum)
Task 8: dispatched (base a9dc023, implementer opus)
Task 8: implementer agent a7158383a10270a83
Task 8: implementer DONE_WITH_CONCERNS (a959405; projetos 1550). Nota p/ T13: interface do diálogo — copias.restaurar → Promise<number>, copias.falhaDoDia?(), pessoal.apagar → Promise<boolean>, exportar/importar devolvem frase.
Task 8: review r1 Needs fixes — Important: aviso de restaurar soma tipos; + Minors; findings task-8-findings-r1.md
Ruling: restaurar não ganha texto extra sobre "Toda a unidade" nem o Sincronizar agora explica que vale para os dois — manter a tela curta (pedido do usuário) — custo: usuário pode não perceber que restaurar na unidade vale para todos
Nota p/ T13: tentar a cópia do dia de novo ao abrir o diálogo; passar funções flecha em arquivo
Task 8: fix r1 DONE (656f105; projetos 1582). Nota p/ T13: aoMudar: (f) => provedor.aoMudar(() => f(provedor.situacao())) sem reler
Task 8: fix round 1/5 (12 addressed, 0 open; commits a959405..656f105)
Task 8: complete (commits a9dc023..656f105, 1 fix round; projetos 1582)
Task 8: minor (T13): montarSincronizacao usa sair?.() dentro da const sair (TDZ se o provedor disparar síncrono) — declarar let antes
Task 9: dispatched (base 656f105, implementer opus)
Task 9: implementer agent a1b5415d6faa6e7e1
Task 9: implementer DONE_WITH_CONCERNS (8616368; projetos 1630). Notas p/ T13: NomesDoHistorico.alvo acha lápides dos dois escopos e o projeto pelo id; renomear/excluir modelo da unidade pelo Entendi; lista de modelos estática enquanto aberto.
Task 9: review Approved (0 Critical/Important); Minors baratos a corrigir já: task-9-findings-r1.md
Task 9: parked: aria-describedby nos botões repetidos de Modelos/Arquivados (leva final); Esc no <dialog> real (P6 ao vivo)
Task 9: fix r1 DONE (ac31b1f; projetos 1641). Parked: NaN no diálogo da etapa com carimbo forjado (dataValida) — leva final
Ruling: "Enviar projeto" corta sigilo pelo caminho do adaptador (regra + memória, falha fechada), não pelo paraOTexto puro — o arquivo vai a outra pessoa — custo: com memória ilegível não dá para enviar
Task 10: dispatched (base ac31b1f, implementer a1d958dd6161053bc) — em paralelo à re-revisão só-leitura da T9 r1
Task 9: fix round 1/5 (5 addressed, 0 open; commits 8616368..ac31b1f)
Task 9: complete (commits 656f105..ac31b1f, 1 fix round; projetos 1641)
Task 10: implementer DONE_WITH_CONCERNS (e0a5969; projetos 1696). API: arquivoDoProjeto(repo, id); envelopeDoProjeto recebe escopo/id/memória/data; doc sigiloso como marcador; idProcedimento nunca vai. Nota p/ T13: receber passa por lerArquivoDoProjeto e repo da unidade com Entendi.
Task 10: review r1 Needs fixes — 2 Important (órfãos na corrida do teto; login do responsável no arquivo) + Minors; findings task-10-findings-r1.md
Ruling: "Enviar projeto" leva só o nome do responsável, nunca o login (pode ser CPF) — custo: quem recebe não vê "Só as minhas" casar por login, só por nome
Task 10: fix r1 DONE (1927c72; projetos 1707)
Task 11: dispatched (base 1927c72, implementer ad091bcefc21c5b2a) em paralelo à re-revisão só-leitura da T10 r1
Task 10: fix round 1/5 (7 addressed, 0 open; commits e0a5969..1927c72)
Task 10: complete (commits ac31b1f..1927c72, 1 fix round; projetos 1707)
notas-t12-t13.md criado (requisitos de ligação para T12/T13 + itens da leva final)
Task 11: implementer DONE_WITH_CONCERNS (46bf657; projetos 1814). Legado não tem sigilo (vínculos sem marca; memória marca o conhecido). inteiro por escopo. Nota p/ T13: passar login a projetosDoAtividades; colaboracao.repos; legadosImportados; mensagemDaImportacao. P6: CORS do fetch do content script ao servidor ANTT.
Task 11: review r1 Needs fixes — 2 Important (excluído volta pelo outro escopo; guardado contorna recusa de outro usuário) + Minors; findings task-11-findings-r1.md
Task 11: fix r1 DONE (e0e7ad8; projetos 1836). Nota p/ T13: diálogo recebe excluidos (dois escopos, com lápides) e cortados; login obrigatório
Task 12: dispatched (base e0e7ad8, implementer affe4963de6211018) em paralelo à re-revisão só-leitura da T11 r1
Task 11: fix round 1/5 (10 addressed, 0 open; commits 46bf657..e0e7ad8)
Task 11: complete (commits 1927c72..e0e7ad8, 1 fix round; projetos 1836)
Task 11: minor: guardado de servidor antigo sem perfil é recusado (endurecimento deliberado); redirecionamento cai na mensagem genérica
Task 12: implementer DONE_WITH_CONCERNS (74c965e; projetos 1916). Fez a parte de app dos itens 7-10 e 13 das notas. Nota p/ T13: main.ts passa escolherArquivoLocal() (File, não texto); itens 6 e 11 + login a projetosDoAtividades ficam para a T13.
Task 12: review Approved (0 Critical/Important); Minors baratos a corrigir já: task-12-findings-r1.md
Ruling: os 3 "Ordenar por…" do menu (P3) viram um item "Ordenar etapas" que alterna — o menu completo tinha 14 itens; usuário pediu não poluir — custo: trocar de ordem pode exigir 2 cliques
Ruling: dupla confirmação na 1ª vez de "Só eu" → "Toda a unidade" (confirmar + Entendi) fica — a confirmação nomeia o projeto, o Entendi é o aviso geral de colaboração — custo: um diálogo a mais uma única vez
Task 12: fix r1 DONE (105fbb9 sei-comum + cadd414; projetos 1929, sei-comum 458)
Task 13: dispatched (base cadd414, implementer a9bae90fa8be66aa3) em paralelo à re-revisão só-leitura da T12 r1
Task 12: fix round 1/5 (6 addressed, 0 open; commits 74c965e..cadd414)
Task 12: complete (commits e0e7ad8..cadd414, 1 fix round; projetos 1929, sei-comum 458)
Task 13: implementer DONE_WITH_CONCERNS (d5bb7ff; projetos 1973). ligarApp/ligarSincronia testáveis; init_projetos.js 95→125 KB (todos os frames; sync só no topo do Controle de Processos). Nota P5: SincroniaPagina confere repos coerentes (senão SEM_SINCRONIA).
Task 13: review Approved (0 Critical/Important)
Task 13: complete (commits cadd414..d5bb7ff; projetos 1973)
Task 13: parked (leva final): dupla rodada no foco em SEI HTTP (uma rodada por vez em SincroniaPagina.puxar); texto que não iniciou tenta de novo a cada foco (naoIniciados)
Nota p/ P5: init_projetos.js 125 KB em todo frame — considerar import() do pacote da sincronia/painel só no topo (WAR novo, passo na receita do P6)
ALL TASKS COMPLETE — P4 final review next (04eac50..d5bb7ff)
Controlador conferiu em d5bb7ff: projetos 1973, sei-comum 458, sei-nucleo 136, favoritos 578, historico 485, agente-ia 1054 — todos 0 falha
Final review: with fixes — 3 Important (restaurar devolve "Só eu" à unidade; órfãos; registro sem teto) + Minors; final-findings.md (inclui os itens guardados das tarefas)
Ruling: Minor 6 (lápide de Quem vê → Só eu fica 180 dias com o conteúdo) vai para a P6 como ajuste de texto; Minor 7 (alternância com 100 ativos diferentes) aceito — raros
Final fix: DONE_WITH_CONCERNS (a266d8b, 189ce64, e2dede3, c497262, fe5df17; projetos 2033, sei-comum 468)
Final re-review: no — 11/13 resolvidos; item 3 parcial (N2) + regressão N1 (vai-e-volta por registros órfãos no corte dos 300) + Minors N3-N5
Ruling: residuais N1 (regressão da própria leva, faz recém-chegado ver faixa falsa e dois computadores regravarem) e N2 são load-bearing — uma correção focada a mais, com re-verificação curta; N3-N5 baratos vão junto — custo: mais uma rodada
Residuais: DONE (5153d3c, 26499bd; projetos 2051). Controlador conferiu todas as suítes: projetos 2051, sei-comum 468, sei-nucleo 136, favoritos 578, historico 485, agente-ia 1054 — 0 falha. Verificação dos residuais despachada.
Residuais 2: verificação achou 2 regressões Important (relógios diferentes no corte; restaurar perde item excluído na unidade) com consertos testados pelo verificador; despachado implementador novo (sonnet) com final-residuais-2.md
Residuais 2: DONE (0b83a3f; projetos 2059). b1 "Bia tem R? false" é esperado (R está 1,5 dia no futuro para a Bia; a regra de carimbo do futuro da P2 o leva adiante no texto até o relógio alcançar).
P4 CLOSED at 0b83a3f — final review + leva + residuais + residuais 2. Contagens: projetos 2059, sei-comum 468, sei-nucleo 136, favoritos 578, historico 485, agente-ia 1054.
