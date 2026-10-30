# Pendências que as fases seguintes herdam (controlador)

## Para o plano P3 (app embutido)
- Validar entradas de formulário antes do modelo: dataValida, Number.isFinite, teto de duração (fimPorDuracao com Infinity entra em laço; deISO lança com string inválida) [P2 T2].
- Fase morta salva numa etapa viva = tratar como "sem fase" na UI [P2 T7].
- Sempre passar `apoio` real ao gerar histórico (nomeFase vira "" se não resolve) [P2 T5].
- noUncheckedIndexedAccess ligado no projetos e não no sei-nucleo: importar @nucleo pode quebrar o tsc do projetos [plano P2, risco 4].
- Painel embutido: id não pode coincidir com o legado; sem ordem salva entra no fim do #panelHomePro [plano P1, risco 5].
- Concluir duas vezes muda a data (repositorio.concluirEtapa) — o balão/árvore não devem reconcluir; decidir guarda [P2 T7 minor].

## Para o plano P4 (sincronia e colaboração)
- Motor genérico (sei-comum/src/sincronia/motor.ts): AdaptadorTexto ganhou `antesDeRegravarInvalido?(motivo, html)` (usar para cópia diária antes de regravar texto inválido — spec 6.1) e `exportar({ remoto, agora, invalido })`; deps `temporizador?`, `aleatorio?`; releituras com comparação da carga útil; desistência reagenda com recuo + sorteio. Assinaturas exatas em p1-comum/final-fix-report.md.
- Assinatura do adaptador do projetos deve ignorar `gerado`/quem gravou, senão regrava sempre [plano P1, risco 4].
- Fora da P1 (decidir na P4): gravar com conferência do conteúdo anterior antes do POST (corrida residual dura o gravar() inteiro); `ler` do núcleo sem depender do link de alterar (quem só lê vê "inexistente"); leitura sem gravação no recuo "indisponível" do texto da unidade; NÃO ligar "apagar" ao texto "Toda a unidade"; criação simultânea do texto da unidade gera duplicata → conferir duplicata depois de criar.
- Status "erro" após desistência por releituras: mostrar de forma branda.
- `importar` do repositório exige entidades completas (lápide inclusive); se mandar registro mínimo de sigiloso ao Texto Padrão, estender entidadeValida [plano P2 decisão 12].
- Documento SEI vai ao histórico mesmo com processo sigiloso — decidir [P2 T5].
- Poda do histórico >300 é gravação separada [P2 T7].

## Para o plano P5 (integração)
- Concluir pela árvore não pode reconcluir (muda a data) [P2 T7].
- [P2 T8 minor] índice: etapa sigilosa sem número cai no processo do projeto (vinculos.ts:48,50) — corrigir antes do ícone da caixa/árvore.
- [P2 T12 → P3] uso do montarGantt: rodar completarComDependentes (todas as etapas) ANTES de validar/gravar; se gravar falhar, `atualizar` com as linhas antigas; reaplicar realce após redesenho; `destruir` antes de remontar na mesma área (e para mudar hoje/mostrarLista/moverDependentes/somenteLeitura); portfólio com somenteLeitura; nunca chamar `controle.gantt.change_view_mode` direto (fura o teto de colunas).
- [P2 final → P3] API pode ganhar `violacoesNovas(antes, depois, ids)` (usar no validar do Gantt depois de completarComDependentes com TODAS as etapas), `entidadeValida(..., agora?)`; faltam `duplicarEtapa` e reordenação (abas/fases) — P3 deve criar; mostrar campo desconhecido do histórico de forma genérica.
- [P2 final → P4] teto do tamanho DESCOMPACTADO no codec antes do JSON.parse; aplicar tetos de quantidade no importar; adaptador limpa número sigiloso de vínculos p/e E de registros antigos que casam por chaveProtocolo; podarLapides (180/90) e poda do histórico na exportação; aoMudar não diz a origem — o motor não pode tratar a gravação do próprio importar como pendência local (laço); passar `agora` à entidadeValida.
- [P2 final → P5] corrigir índice de etapa sigilosa (vinculos.ts:48,50) e guarda de reconclusão; detecção de sigilo passa pelo histórico já corrigido.
- [P3 plan] Ruling: a Decisão 4 do plano P3 (lista completa de usuários lendo a árvore de um processo "já visualizado") NÃO é executada na P3: `buscarCompleta = null` (lista parcial: atribuídos vistos na caixa + responsáveis já usados + próprio usuário + texto livre). Motivo: arvore_montar.php chama ProcedimentoRN::receber (grava "Processo recebido" se há remessa pendente) — efeito invisível em nome do usuário. P6 investiga ao vivo uma fonte segura (ex.: formulário de atribuição em lote do Controle de Processos) e liga só se provado. Custo se errado: lista de responsáveis incompleta até a P6.
- [P2 final re-review → P4] relógio: computador com relógio >1 dia atrasado recusa tudo dos colegas (só conta `ignorados`) — mostrar no diálogo de sincronização; base invertida por arraste de etapa torta é recusada nos outros computadores (alinhar regra da base com a da etapa); criarProjetoDeModelo sem faixa de anos; excedentes do teto podem divergir entre computadores (desempate por id).
- [P3 T12 → P5] `processoSeguroDaCaixa` e `usuarioDaOpcao` NÃO existem (removidos com a decisão de não ler árvore); `ligarAlertas` precisa devolver `parar()` quando a P5 desmontar; validar tipo/tamanho em `abrirProcesso`/`abrirDocumento` (protocolo `/^[\d.\-\/ ]{1,40}$/`, id só dígitos ≤ 20, número ≤ 20 dígitos) quando os argumentos vierem de dado compartilhado.
- [P3 final → P4] diálogo da etapa sempre manda checklist/etiquetas etc.: com colaboração, mandar só o que mudou em relação à cópia aberta (senão sobrescreve o que chegou de outro computador); decidir número de documento/observações de etapa sigilosa no CSV e no histórico; não refazer mover escopo/arquivados/salvar como modelo (já no P3).
- [P3 final → P5] reestruturar principal() (hoje só age no topo do Controle de Processos); parar() das pílulas; validar argumentos do RPC vindos de dado compartilhado; focarProjeto pronto.
- [P3 final → P6] ao vivo: painel que abre recolhido (Frappe montada em iframe display:none), limiteDeAbas, aviso depois de diálogo, pesquisa rápida no 4.1.5; impressão ignora filtro/ordem (decidir); NA RECEITA DO PACOTE OFICIAL (manifest_seipro.json gerado do Lab): TIRAR js/init_projetos.js e as 3 entradas do WAR, senão a marca no <html> desliga o legado para ~220 mil usuários.
- [P3 final fix → P5] balão: `progresso.descarregar()` antes de abrir processo/documento e no `pagehide` (senão a mudança da régua em < 600 ms se perde); levar o valor atual da régua ao reabrir o balão.
- [P3 final fix → P4] `/quota/i` em `erros.ts` também casa limites de ritmo do storage.sync — não passar erros do sync por `mensagem` sem distinguir.
P5 plan committed 1369ec4 (escrito por agente; ensaiado sobre 04eac50+P4 do plano; contagens de partida do ensaio projetos 1308 / fim 1501)
## Do escritor do plano P5 — validar ao vivo na P6
1. Árvore 4.1.5 e 5.0.4: seletor do nó do processo, "Título (número)" dos documentos, pastas abertas, ícone ao lado da estrela dos Favoritos.
2. "Abrir no painel" do frame da árvore: sendMessage com gesto abre o lateral; pedido em projetos/foco (1 min) atendido; lateral → Controle de Processos pelo linkDoMenu sem derrubar sessão.
3. Troca de unidade com o lateral aberto: remonta, não grava na unidade antiga, pedido na aba certa com duas unidades na mesma janela.
4. Sincronia fora do Controle de Processos (árvore/lateral): depende do item "Textos Padrão" no menu daquela tela.
5. "Entendi" dentro do balão reaproveita consentimento; balão cabe no frame estreito da árvore com tema escuro.
6. Sigilo lido da linha da caixa e da árvore: vínculos marcados; próximo Texto Padrão sem o número.
7. Desempenho do observador da caixa com centenas de linhas e paginação infinita do legado.
8. Decisões a confirmar com o autor: contador da aba mostra a última unidade que gravou; blocos/acompanhamento/sobrestados sem ícone; lateral sem impressão; etapa nova começa hoje com 10 dias úteis.
9. Pacote oficial: tirar init_projetos.js; aba Projetos e projetos_listar não aparecem lá.
## Da P4 executada para P5/P6
- P4 fechada em 0b83a3f. Ver `.superpowers/sdd/2026-10-06-projetos-p4-sincronia/notas-t12-t13.md` (itens 12 pacote oficial) e rulings no ledger da P4.
- P6 ao vivo: CORS do fetch do content script ao servidor do Atividades (ANTT); "Textos Padrão" no menu do 4.1.5/5.0.4; ocultar textos internos no SEI 5; Esc no <dialog>; SEI HTTP sem Web Locks; texto do aviso "Quem vê → Só eu" (lápide fica 180 dias no texto da unidade).
- P5: init_projetos.js já ~125 KB em todo frame — considerar import() sob demanda.
- P6: conferir no pacote oficial gerado que a aba Projetos não aparece (prova por simulação na P5 T2).
- P6: limpar os perfis de teste antes de validar ao vivo (dados de antes de 906bcd4 com vínculo vazio sem marca).
- P6: link do menu (reset=1) no Controle de Processos filtrado por marcador traz a lista completa? (P5 T6 recusa com SEM_PAINEL)
- P6: o SEI deixa anexar processo sigiloso a um não sigiloso? (documentos do anexado entram no Concluir com documento da árvore)
- RECEITA DO PACOTE OFICIAL (P6): tirar `js/init_projetos.js` do content_scripts E as 6 entradas WAR do Projetos (`html/projetos.html`, `js/projetos/app.js`, `css/projetos.css`, `js/projetos/pagina.js`, `js/projetos/balao.js`, `js/projetos/pagina-comum.js`). A aba Projetos do shell e o projetos_listar do Agente se escondem sozinhos sem o init_projetos.js no manifest.
- P6: testar a divisão do content script no Firefox e nos SEIs reais (4.1.5 e 5.0.4); harness em .superpowers/sdd/2026-10-06-projetos-p5-integracao/e2e-t11.mjs
- RECEITA (complemento da revisão P5 T11): NÃO tirar `js/sei-pro-projetos.js` (é o legado "Projetos (Atividades)"); a regra vale para TODO manifest gerado do Lab (oficial MV3, `manifest_seipro_v2.json`, `manifest_v2.json` = Lab Firefox, e os whitelabels antt/antaq/cfq/conab MV3 e v2) — o Projetos novo com import() nunca foi testado no Firefox.
