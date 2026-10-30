# [![Home](../img/home.png)](../) |  SEI Pro ![Icone](../img/icon-32.png)

## ![SEI Pro Ações em Lote](../img/icon-acoeslote.png) Ações em Lote

Reúne numa única tabela **todos os documentos do processo** e permite **dar ciência, assinar, excluir, baixar, duplicar, mover e alterar vários documentos de uma vez** — em vez de abrir um por um.

> A **nova Ações em Lote** está no **SEI Pro Lab** (Chrome e Edge). Nos demais pacotes continua a janela anterior, descrita mais abaixo em [Janela anterior](#janela-anterior-nos-demais-pacotes).

### Como abrir

Abra o processo e clique em **Ações em Lote**, na barra de botões da árvore, ou use o mesmo item no menu rápido da árvore.

### Escolher os documentos

A janela lista os documentos do processo, com número SEI, nome, quem assinou, datas, unidade e nível de acesso. Marque os que deseja ou use a caixa do cabeçalho para marcar todos. Os **filtros** reduzem a lista e três atalhos marcam grupos de documentos de uma vez: **Não assinados da minha unidade**, **Assinados por mim** e **Externos**.

> **Documentos e processos sigilosos ficam de fora.** Diferente da versão anterior, a ferramenta nunca os altera: eles aparecem na tabela como **pulados**, com o motivo *Sigiloso: fora das Ações em Lote*.

### As 12 ações

| Ação | O que faz |
| ---- | --------- |
| **Dar ciência** | Registra ciência nos documentos marcados |
| **Excluir** | Exclui os documentos marcados (só os que ainda podem ser excluídos) |
| **Cancelar assinatura** | Cancela a sua assinatura nos documentos marcados |
| **Baixar** | Baixa os documentos em arquivos separados ou num único ZIP |
| **Alterar nível de acesso** | Troca o nível de acesso entre Público e Restrito |
| **Assinar** | Assina os documentos marcados de uma vez |
| **Duplicar** | Cria cópias dos documentos marcados — veja [Duplicar documentos](../pages/DUPLICARDOC.md) |
| **Cancelar documento** | Cancela o documento, com o motivo que você informar |
| **Incluir em bloco de assinatura** | Inclui os documentos num bloco já existente ou num bloco novo |
| **Alterar dados** | Muda descrição, observação, interessados, assuntos e nível de acesso. Em interessados e assuntos você escolhe **Acrescentar**, **Remover** ou **Substituir** |
| **Mover para outro processo** | Move os documentos marcados para outro processo |
| **Baixar tudo num PDF** | Gera um só PDF com os documentos marcados, gerado pelo próprio SEI |

### Fila de ações

Você pode combinar **várias ações em ordem**: por exemplo, dar ciência, assinar e depois baixar. As ações que encerram o trabalho com o documento ou mudam a lista (**excluir, cancelar documento, mover, baixar e Baixar tudo num PDF**) só podem ser a **última etapa** da fila.

### Prévia e confirmação

Antes de executar, a **prévia** mostra o que será feito em cada documento. Ações destrutivas pedem uma **confirmação** à parte. Depois de iniciada, a execução não desfaz o que já foi feito.

### Durante a execução

* **Pausar / Continuar** e **Parar lote**: os botões ficam na janela de execução. **Parar lote** encerra a execução, e os documentos que faltavam ficam salvos para você retomar depois;
* **Minimizar**: libera a tela do SEI para você seguir trabalhando;
* **Retomar**: fechar a janela **pausa o lote**, que fica salvo; ao abrir a ferramenta de novo é possível continuar de onde parou;
* **Teclado**: **Ctrl+Enter** (Cmd+Enter no Mac) avança da configuração para a prévia e da prévia para a execução. **Esc** fecha a janela; durante a execução, pausa o lote e pergunta antes de fechar. Com a janela minimizada, o Esc não faz nada.

### Resultado

Ao final, a tabela de resultado mostra o que deu certo e o que falhou, com a mensagem de erro de cada falha. Os botões permitem **Copiar** a tabela, baixar em **CSV** e **Tentar de novo só as falhas**. Os itens em que o SEI não deu resposta clara aparecem com **Confira**: verifique-os no processo antes de repetir.

### Senha

Para assinar, a ferramenta pede a sua senha. Ela **nunca é guardada**: fica só na memória enquanto a execução roda e é **pedida de novo** quando você retoma uma execução interrompida.

### Bom saber

* A ferramenta **não dá permissões novas**: cada ação só é executada nos documentos em que o SEI permitiria fazê-la à mão.
* As ações ficam registradas no SEI exatamente como se tivessem sido feitas uma a uma.

### Como ativar

A função vem **ligada** de fábrica. Ela fica nas [Configurações do SEI Pro](../pages/DESATIVARFUNCOES.md), aba **Geral**, seção **Árvore e Visualização de Documentos**, opção **Ações em Lote**.

### Janela anterior (nos demais pacotes)

Nos pacotes que ainda não têm a nova versão (oficial e Firefox), a ferramenta é a janela anterior, que reúne os documentos numa tabela e permite assinar, dar ciência, excluir, alterar o sigilo, cancelar assinatura, duplicar e baixar.

> ![Tela Ações em Lote](../img/tela-acoeslote.gif)

### Como usar (janela anterior)

1. Abra o processo e, na barra de botões, clique em **Ações em Lote**;
2. A janela **Ações em Lote** lista os documentos, com número SEI, nome, quem assinou, datas, unidade e nível de acesso;
3. Marque os documentos desejados — ou use a caixa do cabeçalho para selecionar todos;
4. Clique no botão da ação, no alto da janela.

Na última coluna, **Ações**, cada documento mostra só as ações que você pode fazer nele — por exemplo, um documento já assinado por você não oferece "Assinar".

### As ações (janela anterior)

| Ação | O que faz |
| ---- | --------- |
| **Ciência** | Registra ciência nos documentos marcados |
| **Baixar documento** | Baixa os documentos marcados |
| **Excluir** | Exclui os documentos marcados (só os que ainda podem ser excluídos) |
| **Assinar** | Assina os documentos marcados de uma vez |
| **Alterar Sigilo** | Troca o nível de acesso dos documentos marcados |
| **Cancelar Assinatura** | Cancela a sua assinatura nos documentos marcados |
| **Duplicar Documento** | Cria cópias dos documentos marcados — veja [Duplicar documentos](../pages/DUPLICARDOC.md) |

No canto direito da janela, **Baixar** e **Copiar** exportam a própria tabela (para planilha ou área de transferência), e **Pesquisar** filtra a lista.

A opção para ligar ou desligar é a mesma descrita em **Como ativar**, acima.

## Próximo item

> [Documentos em Lote: criar vários documentos a partir de um modelo e uma planilha](../pages/DOCUMENTOSEMLOTE.md)
