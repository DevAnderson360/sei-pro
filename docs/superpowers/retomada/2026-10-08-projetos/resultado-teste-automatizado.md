# Resultado do roteiro automatizado (09/10/2026)

Chrome for Testing 151 + puppeteer-core, extensão carregada de `dist/` (HEAD `0937081`+), opção "Gerenciar Projetos" ligada.
SP = treinamento.sei.sp.gov.br (4.1.5, CK4), unidade TESTE. MJ = **hmlsei.mj.gov.br** (5.0.4, CK5), unidade TESTE.
Os scripts ficaram no scratchpad da sessão (não versionados). Dados de teste apagados nos dois SEIs.

## Passos do `roteiro-teste.md`

| Passo | SP 4.1.5 | MJ 5.0.4 |
|---|---|---|
| 1 Ligar a opção; 2 painel no Controle | OK | OK |
| 3 Criar projeto (Só eu, com processo); 4 etapas (atrasada, marco) + pílula "1 atrasada" | OK | OK |
| 5 Gantt/Lista/Dia/Semana/Mês/Hoje sem erro | OK | OK |
| 6 Concluir e reabrir etapa (percentual e contagem mudam) | OK | OK |
| 7-8 Caixa: ícone só no processo ligado, balão com etapas | OK | OK |
| 9 Árvore: ícone + faixa "Etapa atrasada · projeto" | OK | OK |
| 10 Concluir com documento (combo vem da árvore já aberta) | OK | OK |
| 11 Lateral: aba Projetos com contador | OK | OK (com uma só aba SEI na janela) |
| 12-13 Agenda (Todas/Só as minhas, cartão, ações) e mini-Gantt | OK | Agenda OK; mini-Gantt não repetido |
| 14 Troca de unidade (TESTE → TESTE_1_1 → TESTE): lateral remonta, contador acompanha a unidade | OK | não testado |
| 15 Duas janelas: pedido de aba de uma janela não troca a outra (`painelAba` com `janela`) | OK | não testado |
| 16 "Entendi": nada vai ao Texto Padrão antes; depois cria `[_SEIPRO_PRJ_UNIDADE]` (1 linha) | OK | OK |
| 17 Outro computador (simulado apagando o `storage.local`): "Toda a unidade" volta do Texto Padrão; "Só eu" não | OK | não testado |
| 18 Sigiloso: Texto Padrão leva `protocolo:""`, `sigiloso:true`; na tela outro "computador" mostra "Processo sigiloso" | OK | não testável (sem processo sigiloso na caixa da TESTE) |
| 19 CSV com processo em branco; "Enviar projeto por arquivo" sem o número; Agente omite o projeto sigiloso | OK | não testado |
| 20 Limpeza (local + Texto Padrão) | feita | feita |

## Achados e desfecho (rodada de correção, 09/10/2026)

1. **Rótulos "Setembro"/"Outubro" sobrepostos (escala Semana): CORRIGIDO.** Causa: o rótulo do mês corrente é `position: sticky` (a Frappe o prende à esquerda), fica uns 6 px acima dos demais e, com o mês virando na 2ª coluna, a largura dele passa da coluna. `gantt/cabecalho.ts` desce o preso até a altura dos outros e o esconde só quando encosta no seguinte (a data da linha de baixo diz o mês); roda no desenho, na rolagem e no redimensionamento. Prova ao vivo no MJ (colisão reproduzida: 294–371 contra 358; depois, preso escondido e alinhado) e a função de decisão tem teste (`planejarRotulos`).
2. **3 mensagens `abrirPainel` por clique: NÃO ERA DEFEITO.** Artefato da medição: eu tinha deixado 2 listeners de teste no service worker de rodadas anteriores. Um clique = uma mensagem.
3. **Agente omite o projeto sigiloso inteiro: MANTIDO.** É o que a spec 7 e o ruling de sigilo pedem (sigilosos fora, só contados); mostrar o nome do projeto revelaria o assunto do processo sigiloso. Se quiser mudar, é decisão de produto.
4. **"A conexão com a aba do SEI caiu" no lateral do MJ: NÃO REPRODUZIDO.** Com o lateral aberto e o SEI navegando para outra tela (pelo link do menu), o lateral continua com os dados. O erro apareceu quando a aba do SEI estava na tela de login (meu `Hash inválido`) e com abas de painel duplicadas; a mensagem é a correta nesse caso.
5. **"Abrir no painel" do balão da caixa: FUNCIONA.** O painel foi de 1771 px abaixo da dobra para 525 px (dentro da tela); a rolagem do SEI não é a da janela, por isso `scrollY` ficava 0.
6. **`Hash inválido`: era meu script**, não a extensão.

### Limpeza que eu tinha deixado furada
Apaguei os dados locais e o Texto Padrão com as abas do SEI ainda abertas; a sincronia da aba regravou o `[_SEIPRO_PRJ_UNIDADE]` e o projeto "Teste MJ 2" voltou. Moral: tirar a aba do SEI do ar (memória zerada), apagar o armazenamento e só então excluir o Texto Padrão. Refeito assim em 09/10: SP e MJ sem `[_SEIPRO_PRJ_UNIDADE]`, conferido 40 s depois (não voltou).

## Fora do teste

- Chave do OpenRouter lida do `.env` do Eutropio (a pedido do autor) só para o passo do Agente (custo R$ 0,24); zerada do perfil de teste ao final. O modelo do `.env` do Eutropio NÃO foi usado (ficou o padrão da extensão).
- Não criei processo nenhum no SEI; só abri processos existentes.
