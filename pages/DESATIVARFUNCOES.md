# [![Home](../img/home.png)](../) |  SEI Pro ![Icone](../img/icon-32.png)

## ![SEI Pro Configurações](../img/icon-desativarfuncoes.png) Configurações do SEI Pro: ligar e desligar funções

Quase todas as funções do SEI Pro podem ser **ligadas ou desligadas**. Assim você deixa só o que usa e adapta a extensão ao seu jeito de trabalhar.

> ![Tela Configurações do SEI Pro](../img/opcoes-nova.gif)

### Como abrir as configurações

* Clique no ícone do **SEI Pro** na barra de extensões do navegador (ao lado da barra de endereços). As configurações abrem na hora;
* Se o ícone não estiver visível, clique no ícone de **peça de quebra-cabeça** (Extensões) e depois no **alfinete** ao lado do SEI Pro, para fixá-lo na barra;
* Outra forma: clique com o botão direito no ícone do SEI Pro e escolha **Opções**.

>  <img src="https://github.com/pedrohsoaresadv/sei-pro/raw/master/img/tela-seisheets2.png" data-canonical-src="https://github.com/pedrohsoaresadv/sei-pro/raw/master/img/tela-seisheets2.png" width="473"/>

### Como ligar ou desligar uma função

> ![Aba Geral das configurações](../img/opcoes-geral.png)

1. Na aba **Geral**, abra a seção desejada. São três: **Controle de Processos**, **Editor de Texto** e **Árvore e Visualização de Documentos**. Cada uma tem, ao lado do título, a contagem de funções ligadas (por exemplo, *13 de 25 ativas*) e pode ser **recolhida ou aberta** com um clique no título;
2. Deslize a chave ao lado da função: **azul** é ligada, **cinza** é desligada;
3. Clique em **Salvar**, o botão azul no alto da página, na linha logo abaixo do título. Ele fica sempre à vista, sem precisar rolar até o fim. Uma janela confirma com *Configurações salvas com sucesso!*;
4. **Recarregue a página do SEI** (tecla `F5`) para a mudança valer.

O ícone **(i)** ao lado de cada função abre a página de ajuda correspondente.

Algumas funções têm opções extras, que aparecem logo abaixo delas quando são ligadas — por exemplo, o intervalo da [reabertura programada](../pages/REABRIRPROCESSOS.md) e os [valores padronizados](../pages/VALDEFAULT.md).

### Procurar uma função

Não sabe em que seção está a função? Digite no campo **Buscar nas opções**, logo abaixo das abas. A busca **ignora acentos e maiúsculas**: *anotacao* acha *Mostrar a anotação de cada processo...*. Enquanto você digita, a página mostra só as funções que combinam, com as seções abertas. Para voltar à lista inteira, clique no **X** do campo ou apague o texto.

### As abas

| Aba | Conteúdo |
| --- | -------- |
| **Geral** | As funções do dia a dia, em três seções. Em **Controle de Processos** ficam, entre outras, [Processos Monitorados](../pages/FAVORITOS.md), [Gerenciar Projetos](../pages/PROJETOS.md), [Demandas](../pages/DEMANDAS.md) e [Controlar Prazos](../pages/PRAZOS.md) |
| **Base de Dados** | Conexões com servidores institucionais (módulo Atividades). A chave do [Agente de IA](../pages/AGENTEIA.md) não fica aqui: ela é cadastrada no próprio painel do agente |
| **Complementos** | Funções institucionais e de diagnóstico: [Atividades](https://bit.ly/Guia-SEI-Pro-Atividades), [Prescrições](../pages/PRESCRICOES.md), [Ativar debug](../pages/DEBUGPAGE.md) e [Desativar consultas adicionais](../pages/DESATIVACONSULTAS.md) e **Sincronizar Base de Processos** |

> ![Aba Complementos das configurações](../img/opcoes-complementos.png)

> **Onde está o gerenciador de Projetos?** Na aba **Geral**, seção **Controle de Processos**, com o nome **Gerenciar Projetos**. Antes ficava em *Complementos*. As opções antigas **Gerenciar Formulários** e **Pesquisa NatJus** foram retiradas da página.

> Nas configurações do **SEI Pro Lab** o título da página diz *SEI Pro Lab*. A página também acompanha o tema claro ou escuro do seu computador.

### Guardar e levar suas configurações

No alto da página:

* **Baixar Configurações** salva todas as suas escolhas num arquivo `config.json`;
* **Carregar Configurações** aplica um arquivo salvo antes.

Use para fazer uma cópia de segurança, levar a configuração para outro computador ou distribuir uma configuração padrão para a equipe.

O botão **Salvar** fica ao lado deles, na mesma linha.

> **Cuidado:** o arquivo inclui as chaves de acesso cadastradas na aba **Base de Dados** (por exemplo, a chave de API da inteligência artificial). Não compartilhe um arquivo que contenha chaves pessoais.

O botão **Ferramentas de PDF**, no mesmo grupo, abre as [Ferramentas de PDF](../pages/FERRAMENTASPDF.md).

<a name="hipotese-legal"></a>

### Opções que dependem do SEI

A página de configurações roda separada do SEI e não consegue consultá-lo sozinha. Por isso, a lista de **hipóteses legais** do seu órgão é lida **pelo SEI Pro, de dentro do SEI**, e fica guardada no navegador para a página de configurações usar.

É o caso da **hipótese legal padrão** para novos documentos. Para ela aparecer na caixa **Hipótese legal do documento**:

1. **Abra qualquer processo** no SEI (basta abrir, não precisa mexer em nada). Em segundo plano, o SEI Pro lê as hipóteses legais do órgão; isso se repete no máximo a cada 12 horas;
2. Volte às configurações e marque **Selecionar valores padronizados**, desligando **Marcar nível público**;
3. Escolha a hipótese na caixa **Hipótese legal do documento** e salve.

Se a caixa mostrar *Abra um processo no SEI para carregar a lista*, é porque nenhum processo foi aberto ainda neste navegador. Quem usa mais de um SEI vê as hipóteses separadas por endereço.

A partir daí, os novos documentos já nascem restritos com essa hipótese — veja [Valores padronizados](../pages/VALDEFAULT.md).

### Bom saber

* As configurações ficam guardadas **no navegador**. Se você usa o Chrome sincronizado com a sua conta, elas acompanham você em outros computadores.
* Desinstalar a extensão apaga as configurações. Baixe uma cópia antes.
* O navegador reserva um espaço limitado (8 KB) para sincronizar as configurações entre computadores. Se as suas escolhas passarem disso, a página **avisa antes de salvar**, em vez de dizer "salvo" sem ter salvo. Nesse caso, desligue o que não usa ou guarde uma cópia com **Baixar configurações**.
* Uma função desligada não faz nada: ela não carrega e não consulta o SEI.

## Próximo item

> [Desativar consultas adicionais](../pages/DESATIVACONSULTAS.md)
