# [![Home](../img/home.png)](../) |  SEI Pro ![Icone](../img/icon-32.png)

## ![SEI Pro Processos em Lote](../img/icon-acoeslote.png) Processos em Lote

Essa ferramenta abre vários processos de um mesmo tipo de uma só vez, a partir de uma lista de especificações colada pelo usuário ou de uma quantidade informada.

> ![Tela Processos em Lote](../img/tela-processosemlote.png)

Serve para quando é preciso abrir dezenas de processos iguais — um por servidor, um por contrato, um por município — e abrir cada um à mão levaria a tarde inteira.

O acesso é feito pelo link **Processos em Lote**, no menu à esquerda do SEI. O link só aparece se a opção correspondente estiver marcada na tela de configurações da extensão.

### ⚠️ Antes de usar

> A abertura de processos em lote gera uma sequência longa de requisições ao servidor. Em alguns órgãos isso deixa o SEI lento **para todos os usuários**, não apenas para quem está executando a ferramenta.
>
> Recomenda-se executá-la **fora do horário comercial**, em blocos menores, aumentando a pausa entre processos caso perceba lentidão. Na dúvida, alinhe previamente com a área de tecnologia do seu órgão.

Os processos são abertos **na unidade que estiver selecionada** no momento da execução.

### Como usar

1. Selecione no SEI a unidade em que os processos devem ser abertos e clique em **Processos em Lote**, no menu à esquerda;

2. Na tela de configuração, informe:

> **Tipo de processo** — o mesmo tipo será usado em todos os processos da rodada;
>
> **Nível de acesso** — Público ou Restrito. Ao escolher Restrito, é obrigatório indicar a hipótese legal, que é carregada a partir do formulário real daquele tipo de processo;
>
> **Especificações** — uma por linha. É possível colar diretamente uma coluna de planilha. Cada linha gera um processo, e o texto é limitado a 100 caracteres, como no formulário do próprio SEI;
>
> **Quantidade** — usada apenas quando a caixa de especificações estiver vazia, para abrir N processos sem especificação;
>
> **Pausa entre um processo e outro** — em milissegundos, com mínimo de 200. Quanto maior a pausa, menor o impacto no servidor.

3. Na tela de confirmação, revise a quantidade, o tipo, o nível de acesso e o tempo estimado. Depois de iniciada, a execução não desfaz os processos já criados;

4. Durante a execução é exibido o progresso, com contagem de falhas e um botão para cancelar. **Não feche a janela nem navegue na aba** enquanto a rodada estiver em andamento;

5. Ao final, é apresentada uma tabela com o número de cada processo criado, a especificação correspondente, um link de acesso e a mensagem de erro das linhas que falharam. A tabela pode ser copiada ou baixada em CSV pelos botões no cabeçalho.

### Observações

> Linhas que falham não interrompem a execução: o erro é registrado na tabela final e a ferramenta segue para a próxima. Assim, basta reprocessar as linhas com erro.
>
> Assuntos e interessados recebem o padrão definido para o tipo de processo escolhido, não sendo possível preenchê-los individualmente por esta ferramenta.
>
> O limite é de 2.000 processos por rodada. Demandas maiores devem ser divididas em blocos.

## No SEI Pro Lab: nova versão

O SEI Pro Lab traz uma versão reescrita desta ferramenta. Nos demais pacotes, continua valendo a descrição acima. A versão nova funciona assim:

### Prévia antes de criar

Ao colar a lista, o SEI Pro mostra uma prévia e só cria os processos depois da sua confirmação. A prévia aponta:

> - linhas **repetidas**, com um botão para remover as repetidas;
> - linhas **vazias**, que são ignoradas;
> - especificações **cortadas em 100 caracteres**, que é o limite do SEI;
> - **caracteres trocados** (por exemplo, aspas e travessões vindos do Word), destacados na linha;
> - **nível de acesso não reconhecido** na coluna de nível (por exemplo, "Sigiloso" ou "R"): é um erro, e o botão **Iniciar** fica travado até a linha ser corrigida ou removida, para que um processo que deveria ser restrito não seja criado como público;
> - **interessado não aplicado**: a coluna de interessado é lida, mas ainda não é aplicada ao processo nesta versão.

### Colunas coladas da planilha

É possível colar direto do Excel ou do Google Planilhas. A tabulação separa as colunas, nesta ordem: **especificação**, **interessado**, **observação** e **nível de acesso**.

> - **Cabeçalho**: é opcional. A primeira linha é tratada como cabeçalho quando alguma das suas células é exatamente um destes nomes (sem diferença de acento ou maiúsculas): Especificação(ões), Descrição(ões), Assunto, Interessado(s), Observação(ões), Nível ou Nível de acesso. Com cabeçalho, a coluna da especificação é a primeira cujo nome começa com "Especificação" ou "Descrição", ou que se chama "Assunto" (sem nenhuma, vale a primeira coluna); as outras são reconhecidas pelo nome, e as de nome desconhecido são ignoradas. Uma primeira linha com outro conteúdo é tratada como dado.
> - **Nível de acesso**: aceita Público (ou Pública, ou 0) e Restrito (ou Restrita, ou 1). Célula vazia usa o nível escolhido para o lote; qualquer outro valor trava o início (veja a prévia).
> - **Interessado**: a coluna é lida, mas **ainda não é aplicada** ao processo nesta versão; o interessado fica o padrão do tipo de processo.

### Retomar de onde parou

O lote fica salvo enquanto é executado. Se a janela for fechada ou a página recarregada, ao reabrir a ferramenta são oferecidas as opções **Continuar de onde parou** ou **Descartar**. Quando o lote parece estar rodando em outra aba, o SEI Pro avisa, para que o mesmo lote não seja executado em duplicidade.

### Ritmo, pausa e minimizar

A pausa entre um processo e outro se adapta sozinha ao tempo de resposta do SEI. Durante a execução há os botões **Pausar**, **Continuar** e **Cancelar**. O botão **Minimizar** recolhe a janela em uma pastilha de progresso no canto da tela e libera a tela do SEI para leitura. **Mudar de página nesta aba interrompe o lote** (abrir um processo, trocar de tela): o lote fica salvo e pode ser retomado depois.

### Resultado

Ao final, a tabela traz o número de cada processo, com os botões **Copiar com links** e **Baixar CSV**.

> - **Tentar de novo as falhas**: reprocessa somente as linhas que, com certeza, não foram criadas.
> - **Processos com situação incerta**: se a rede ou o SEI falhar no meio da criação, não há como saber se o processo foi criado. Para não gerar duplicidade, o SEI Pro **não tenta de novo** essas linhas: elas aparecem como incertas e pedem conferência no Controle de Processos.
> - **Gerar links permanentes destes processos**: abre a ferramenta Pesquisar Link Permanente já preenchida com os números criados.

### Modelos salvos

Na linha **Modelo**, acima do tipo de processo, é possível guardar a configuração de um lote para usar de novo.

> - **Salvar como modelo…**: guarda o tipo de processo, o nível de acesso, a hipótese legal e a pausa com um nome. Salvar com um nome que já existe substitui aquele modelo.
> - **Aplicar**: ao escolher um modelo na lista, o formulário é preenchido com o que ele guardou.
> - **Renomear** e **Apagar**: aparecem quando um modelo está escolhido. Apagar um modelo não muda os campos do formulário.
> - O modelo **nunca guarda as linhas** (especificações, interessados, observações): só a forma do lote.
> - O modelo também guarda as **ações de "Depois de criar"** (veja abaixo).
> - Se o tipo de processo ou a hipótese legal do modelo **não existe mais** na unidade, o SEI Pro avisa e não aplica aquele campo.

### Depois de criar

Na tela de resultado, o painel **Depois de criar** oferece três ações opcionais e independentes sobre os processos criados:

> - **Incluir em bloco interno**: escolha um dos blocos internos da unidade.
> - **Aplicar marcador**: escolha o marcador e, se quiser, um texto.
> - **Acompanhar**: inclui os processos no acompanhamento especial, com grupo e observação opcionais.

Escolha as ações e clique em **Aplicar**. O resultado de cada ação aparece por processo, na coluna **Depois de criar** da tabela (e no CSV).

> - As ações rodam **só nos processos criados com número confirmado**. Processo com situação incerta fica de fora, e o painel informa quantos ficaram de fora e por quê.
> - **Já estava**: o processo já tinha aquele marcador, aquele acompanhamento ou já estava no bloco. Nada é duplicado.
> - **Não confirmado: confira o bloco**: a inclusão em bloco pode ter sido gravada, mas o SEI não confirmou. Confira o bloco antes de tentar de novo; o SEI Pro não reenvia esses processos para o mesmo bloco.
> - **Tentar de novo as falhas**: repete só as ações que falharam. Marcador e acompanhamento podem ser repetidos sem duplicar nada. No bloco, só é repetido o que, com certeza, não foi incluído; processo "não confirmado" nunca é repetido.
> - A **lista de blocos** precisa caber em uma única página, e o **processo** precisa estar na página do **Controle de Processos**. Processo que não aparece ali é informado como fora da página, e a inclusão deve ser feita pelo Controle de Processos.

Quando o lote começou com um modelo escolhido, o botão **Guardar estas ações no modelo** grava no modelo as ações marcadas no painel. Da próxima vez que esse modelo for usado, o painel já abre com essas ações escolhidas, mas **nada é aplicado sem clicar em Aplicar**. Se o marcador, o grupo ou o bloco do modelo não existe mais na unidade, aquela ação vem desligada, com o aviso "não existe mais nesta unidade".

## Próximo item

> [Ferramentas na tela de Pesquisa: visualização rápida, baixar e copiar resultados](../pages/PESQUISA.md)
