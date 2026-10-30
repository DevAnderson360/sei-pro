# Rascunho da entrada do pages/HISTORICO.md (NÃO PUBLICADO)

Para colar acima de "### Versão 2.6" quando o autor decidir o lançamento. Número e data são propostas (2.7, data do
lançamento). Ajuste "primeiro ao Lab" conforme o que for de fato levado ao pacote oficial (receita na seção 7 do README).
Antes de publicar: conferir se `pages/PROJETOS.md` existe/está atualizada (a opção "Gerenciar Projetos" já aponta para
`seipro.app/pages/PROJETOS.html`).

---

### Versão 2.7
DD/10/2026

O gerenciador de projetos foi refeito do zero, por enquanto em versão de teste no SEI Pro Lab, e duas falhas do painel lateral e dos favoritos foram corrigidas.

- **Novo (em teste) — [gerenciador de Projetos](../pages/PROJETOS.md) reescrito, no *SEI Pro Lab* (Chrome e Edge).** Quem usa a versão da loja continua com o gerenciador de sempre e recebe o novo depois dessa validação. Ligue em *Configurações do SEI Pro* a opção *Gerenciar Projetos*.
- **Painel no Controle de Processos.** Projetos com fases, etapas, marcos, dependências e linha de base, em Gantt ou em lista, com filtros, portfólio de todos os projetos, exportação para planilha e impressão. As etapas atrasadas e as que vencem na semana aparecem em pílulas no título do painel.
- **Os projetos acompanham o processo.** Na caixa, um ícone ao lado da estrela dos favoritos abre um balão com os projetos e as etapas ligados ao processo. Na árvore do processo, o ícone mostra uma faixa quando há etapa atrasada e permite concluir a etapa escolhendo um documento da árvore, sem carregar nada em segundo plano.
- **Painel lateral.** Uma aba *Projetos* ao lado de Favoritos, Histórico e Agente de IA, com a *Agenda* (atrasadas, desta semana e dos próximos 30 dias) e um mini-Gantt de cada projeto. O contador vermelho da aba mostra as etapas atrasadas.
- **Em toda a unidade ou só seu.** O projeto da unidade fica num Texto Padrão do SEI e aparece para os colegas que usam o SEI Pro (você confirma com *Entendi* na primeira vez). O projeto só seu fica no navegador, com cópias diárias e arquivo para enviar e receber.
- **O Agente de IA lê os seus projetos** (*"quais etapas minhas estão atrasadas?"*). Processos sigilosos ficam de fora: o número deles não vai ao Texto Padrão, nem aos arquivos, nem ao Agente.
- **Correção:** com o painel lateral aberto em mais de uma janela do navegador, abrir uma aba (por exemplo, pelo botão dos favoritos) trocava a aba do painel de **todas** as janelas. Agora só troca o painel da janela em que você clicou.
- **Correção nos favoritos novos:** o selo de pendências das abas do painel lateral, a troca de aba pedida pelo SEI com o painel aberto e a barra de progresso (com o *Cancelar*) do *Atualizar* não funcionavam, porque a extensão lia errado o aviso de mudança do armazenamento do Chrome. Os três voltam a funcionar.
