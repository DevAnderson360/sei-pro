# Roteiro de teste à mão — gestor de Projetos (SEI SP de treinamento, 4.1.5)

Ambiente de TESTE: `https://treinamento.sei.sp.gov.br/sei/` (credenciais na memória local do autor).
**Nunca** use `sei.mj.gov.br` (produção). Duas abas/janelas do Chrome ajudam nos passos 14 e 17.

## Antes de começar: carregar a extensão

1. Chrome → `chrome://extensions` → ligue "Modo do desenvolvedor" → "Carregar sem compactação" → escolha a pasta
   `dist/` da worktree (`.../SEI Pro/sei-pro-projetos/dist`). Se o SEI Pro da loja estiver instalado, **desligue-o**
   (duas instalações brigam). Depois de qualquer mudança no código: botão de recarregar da extensão + F5 no SEI.
2. Abra o SEI de treinamento, entre e escolha uma unidade. Na barra do Chrome, o ícone do SEI Pro deve aparecer.

## Roteiro (20 passos)

**A. Ligar a opção**
1. Ícone do SEI Pro → Opções → ligue **Gerenciar Projetos** → salve → F5 no SEI.
   *Conferir:* a opção fica ligada ao reabrir; sem ela, nada do Projetos aparece (teste desligando e religando).

**B. Painel no Controle de Processos**
2. Menu → Controle de Processos. *Conferir:* painel "Projetos" (ícone Gantt) acima da lista, sem erro no console (F12).
3. "+ Novo projeto": nome "Teste 1", escopo **Só eu**, vincule a um processo da lista. *Conferir:* aba "Teste 1" criada.
4. "+ Etapa" três vezes (uma com fase, uma marco, uma com término no passado). *Conferir:* a de prazo vencido sai como
   atrasada; as pílulas "N atrasada(s)" aparecem no título, inclusive com o painel recolhido.
5. Alterne Gantt | Lista e Dia/Semana/Mês; arraste uma barra. *Conferir:* datas mudam; "Hoje" centraliza; sem travar.
6. Clique numa barra → balão → **Concluir etapa**. *Conferir:* situação "concluída", percentual do projeto sobe, a
   pílula de atraso diminui. Reabra a etapa e confira que volta.

**C. Caixa**
7. Na lista do Controle de Processos, ache o processo vinculado. *Conferir:* ícone Gantt ao lado da estrela dos
   Favoritos (ponto vermelho se há etapa atrasada). Processo não vinculado: sem ícone.
8. Clique no ícone. *Conferir:* balão "Em 1 projeto" com projeto, papel e etapas; "Abrir no painel" rola até o projeto;
   "Adicionar a outro projeto" funciona. Esc/clique fora fecha.

**D. Árvore do processo**
9. Abra o processo vinculado. *Conferir:* ícone do Projetos junto ao número, realçado; faixa "Etapa atrasada · Teste 1"
   sob o número se houver etapa atrasada/vencendo em 3 dias úteis. Nenhuma ação "Processo recebido" nova no histórico do
   processo (o Projetos não pode buscar a árvore).
10. No ícone da árvore → balão "Projetos deste processo" → **Concluir com documento…** → escolha um documento da árvore
    → confirme. *Conferir:* etapa concluída com o número do documento; o painel do Controle de Processos reflete.

**E. Painel lateral**
11. Ícone da extensão/painel lateral do Chrome → aba **Projetos** (contador vermelho = atrasadas). *Conferir:* a aba existe
    só com a opção ligada.
12. Aba **Agenda**: Todas | Só as minhas; grupos Atrasadas/Esta semana/Próximos 30 dias; expanda um cartão e use
    Concluir, Editar, "Ver no projeto". *Conferir:* nenhum erro; datas relativas corretas (sem "undefined").
13. Aba **Projetos**: abra "Teste 1" → mini-Gantt → "Abrir no painel". *Conferir:* leva ao Controle de Processos no projeto.
14. **Troca de unidade** com o lateral aberto (menu do SEI → trocar unidade). *Conferir:* o lateral remonta na nova
    unidade sem mostrar projetos da anterior; volte e eles reaparecem.
15. **Duas janelas:** abra o painel lateral em duas janelas; clique em "Abrir no painel" numa delas. *Conferir:* só o
    painel da janela que pediu troca de aba.

**F. Sincronia e "Entendi"**
16. Crie "Teste 2" com escopo **Toda a unidade**. *Conferir:* aparece o aviso único (o projeto fica num Texto Padrão
    visível à unidade) com **Entendi**; sem "Entendi" nada é gravado. Depois: menu do SEI → Textos Padrão → deve existir
    `[_SEIPRO_PRJ_UNIDADE]`. Estado da sincronia: "sincronizado".
17. Em outro navegador/perfil (ou outro usuário da mesma unidade), com a extensão: abra o Controle de Processos.
    *Conferir:* "Teste 2" aparece (aviso "Entendi" de novo, é por usuário) e uma edição aqui chega lá em até ~2 min
    ("Sincronizar agora" força).

**G. Processo sigiloso**
18. Vincule um processo **sigiloso** (ou crie um de teste) a uma etapa de "Teste 2". *Conferir:* o ícone mostra o vínculo
    para você; abra `[_SEIPRO_PRJ_UNIDADE]` em Textos Padrão: o número do processo sigiloso **não** pode aparecer
    (nem no texto legível nem na lista de campos).
19. Exporte CSV (ajustes → Exportar planilha) e use "Enviar projeto por arquivo…". *Conferir:* número do sigiloso em
    branco nos arquivos. No Agente de IA, peça "liste meus projetos": o número do sigiloso não deve aparecer.

**H. Limpeza**
20. Apagar os dados de teste (abaixo) e conferir que o painel volta vazio.

## Apagar os dados de teste

- Projetos "Teste 1" e "Teste 2": no painel, ajustes → editar projeto → excluir (ou "Projetos arquivados" → excluir).
- Textos Padrão: SEI → Administração/Textos Padrão → excluir `[_SEIPRO_PRJ_UNIDADE]` e `[_SEIPRO_PRJ_<seu login>]`
  (se existirem), e quaisquer Textos Padrão de teste.
- Local: `chrome://extensions` → SEI Pro → "Limpar dados" não existe; use o console da página de fundo da extensão:
  `chrome.storage.local.clear()` (apaga TUDO do SEI Pro, inclusive Favoritos — só em perfil de teste), ou remova e
  recarregue a extensão.
- Processos de teste: não envie; reabra/conclua o que criou só na unidade de teste.

## Se algo falhar

Anote o passo, F12 → Console (filtre por `[SEI Pro]`) e a versão do SEI. Os defeitos conhecidos e as pendências da fase 5
estão no fim de `ledgers/ledger-p5-integracao.md` e na seção 1 do `README.md` desta pasta.
