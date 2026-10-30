# [![Home](../img/home.png)](../) |  SEI Pro ![Icone](../img/icon-32.png)

## ![SEI Pro Agente de IA](../img/icon-agenteia.png) Agente de IA

Um agente de inteligência artificial que trabalha **dentro do SEI**, pela sua própria sessão: pergunte em português e ele consulta processos, lê documentos, resume, pesquisa — e, quando o pedido é para alterar alguma coisa, mostra antes o que vai mudar e só age depois que você aprova.

> ![Tela do Agente de IA](../img/tela-agenteia.gif)

> **Atenção:** as perguntas e os trechos de documentos que o agente precisa entender são enviados ao serviço de IA que **você** escolher, fora do seu órgão. Antes de usar, verifique se o seu órgão permite. O agente **nunca** atua em processos sigilosos, e documentos restritos só são lidos com a sua autorização.

### O que ele faz

| Consulta | Escrita (sempre com aprovação) |
| -------- | ------------------------------ |
| Listar a sua caixa de trabalho | Alterar tipo, especificação, interessados e nível de acesso |
| Consultar processo, árvore e histórico | Anotar, marcar, atribuir e acompanhar |
| Ler documentos, inclusive PDF | Registrar andamento, concluir e reabrir |
| Pesquisar processos e documentos do órgão | Criar documento e escrever o conteúdo |
| Ler o documento aberto no editor | Assinar, enviar para outra unidade, excluir, cancelar, dar ciência |
| Ver blocos de assinatura e internos, com o conteúdo | Criar bloco, incluir e retirar documentos, assinar o bloco inteiro, disponibilizar, retornar, concluir e reabrir |
| Carregar as **skills** da sua unidade (o modelo de despacho, o roteiro da nota técnica) | Seguir essas regras ao escrever |

Alguns exemplos do que dá para pedir:

* *"Resuma este processo: objeto, partes, principais atos e situação atual."*
* *"Quais documentos ainda não foram assinados?"*
* *"Explique em linguagem simples o documento que estou vendo."*
* *"Liste os processos da minha unidade agrupados por marcador e aponte os parados."*
* *"Marque este processo como urgente e anote que aguarda parecer."*
* *"Crie um Despacho encaminhando o processo à unidade X, com o texto abaixo."*
* *"Ponha os despachos que acabei de criar num bloco de assinatura e disponibilize para a unidade X."*

### Como abrir

| Onde | O que acontece |
| ---- | -------------- |
| Barra de ações da tela **Controle de Processos** | Abre o painel lateral do navegador |
| Barra de ações da **árvore do processo** | Idem, já sabendo em que processo você está |
| **Menu lateral** do SEI › Agente de IA | Acesso de qualquer tela |
| Barra do **editor de documentos** › botão de IA | Abre o painel para trabalhar sobre o documento aberto |

O agente vive num **painel lateral**, ao lado do SEI: você continua vendo o processo enquanto conversa.

### Primeiro uso

1. Abra o agente e informe a **chave de API** do serviço de IA (veja abaixo);
2. Escolha o **modelo**;
3. Clique em **Salvar e começar**.

A chave fica guardada **só neste navegador**. As mensagens vão do seu navegador direto para o serviço escolhido, sem passar por nenhum servidor do SEI Pro, e o SEI Pro não as vê. O que é enviado e as proteções aplicadas estão na [Política de Privacidade](../PRIVACY_POLICY.md#42-agente-de-ia).

#### Qual serviço de IA

| Serviço | Quando usar |
| ------- | ----------- |
| **OpenRouter** (padrão) | Caminho recomendado: um cadastro dá acesso aos modelos de vários fabricantes, com preço por modelo e custo por pergunta. O agente ainda exige que o provedor **não guarde nem treine** com o que recebe |
| **OpenAI**, **Google Gemini**, **Anthropic** | Para quem já tem conta direto com o fabricante: escolha o serviço, informe a chave e o modelo — o endereço já vem pronto |
| **Outro serviço compatível** | NVIDIA, Groq, um modelo rodando na própria máquina (Ollama) ou **um servidor do próprio órgão** — nesse caso o conteúdo não sai da rede interna |

**[Como obter a chave de cada serviço, passo a passo](../pages/CHAVEIA.md)** — com o cadastro, onde criar a chave, quanto custa e o que fazer quando a chave não é aceita.

Escolhido o serviço, o **modelo** é selecionado numa lista carregada do próprio fabricante; o botão **Atualizar**, ao lado, refaz a busca. Fora do OpenRouter, o navegador pede a sua autorização para o agente falar com aquele endereço — é esse clique que libera a lista.

> **Nem todo modelo serve.** O agente trabalha chamando ferramentas, e só parte dos modelos sabe fazer isso. No OpenRouter a lista já vem filtrada. Fora dele, se o agente conversar mas não conseguir agir no SEI, troque de modelo.

#### Avançado: controle fino e instruções suas

No fim das configurações há a seção **Avançado**, fechada por padrão — quem não mexer nela continua com os valores que o agente já usa.

| Campo | O que faz |
| ----- | --------- |
| **Temperatura** | 0 dá sempre a mesma resposta; acima de 1, mais criatividade e mais erro |
| **Top P** | Corta a cauda das palavras improváveis. Mexa nisto **ou** na temperatura, não nos dois |
| **Máximo de tokens na resposta** | Teto de tamanho da resposta; curto demais corta o texto no meio |
| **Penalidade de frequência** | Desencoraja repetir as mesmas palavras |
| **Penalidade de presença** | Empurra o modelo para assuntos novos |
| **Instruções adicionais** | Preferências suas ou da sua unidade — estilo, formato, o que sempre citar |

Campo em branco usa o padrão do serviço, e **Restaurar padrões** limpa todos. Se o modelo escolhido não aceitar um desses ajustes, o agente refaz o pedido sem ele em vez de falhar.

As instruções adicionais entram no fim das instruções do agente e valem para estilo e formato. Elas **não** dispensam a sua aprovação antes de qualquer escrita no SEI, não liberam processo sigiloso e não fazem o agente pedir senha na conversa.

### Skills: as regras da sua unidade

O agente já sabe trabalhar no SEI, mas não sabe como **a sua unidade** faz as coisas — o que o despacho de encaminhamento precisa ter, o roteiro da nota técnica, as exigências do parecer. Uma **skill** é esse conhecimento escrito uma vez e carregado **só quando o pedido é daquele assunto**, para não pesar em toda conversa.

Cadastre em **Configuração → Skills**:

| Campo | Para que serve |
| ----- | -------------- |
| **Nome** | Como você chama a skill (livre) |
| **Atalho** | O que você digita na conversa, depois de `/` |
| **Quando usar** | Uma linha; é por ela que o agente decide sozinho se a skill serve ao pedido |
| **Arquivo no GitHub** | Opcional: link de um `.md` em repositório público — o conteúdo é copiado para cá |
| **Manter sincronizada** | Opcional, **desligado** por padrão: com isso ligado, o agente confere o arquivo a cada 6 horas e traz as mudanças sozinho |
| **Conteúdo** | O texto da instrução, escrito como se fosse para um colega novo |

Há duas formas de usar:

* **Você chama**: digite `/` na conversa e escolha na lista (ou `/desp` para filtrar). O conteúdo entra junto com aquele pedido;
* **O agente chama**: quando o assunto bate com o "quando usar", ele carrega a skill sozinho — aparece na conversa como *Ler instruções*.

Guardar o conteúdo, e não só o link, é proposital: a conversa não pode parar porque a rede do órgão não alcançou o GitHub naquele instante.

Para não ter de lembrar de atualizar, ligue **Manter sincronizada com o GitHub** na skill. A conferência é barata — o agente pergunta ao GitHub se o arquivo mudou e, quando não mudou, nada é baixado — e acontece no máximo a cada 6 horas, ao abrir o painel ou as configurações. O botão **Sincronizar agora**, na lista de skills, confere na hora. Se a rede falhar, o texto que já está aqui continua valendo e o motivo aparece embaixo da skill.

> As skills orientam o trabalho, mas **não** revogam as regras do agente: escrita no SEI continua passando pela sua aprovação, processo sigiloso continua fora e senha nunca é pedida na conversa.

#### Skills da equipe

Em vez de cada pessoa cadastrar as suas, a unidade pode manter as skills num **repositório público** e todo mundo apontar para a mesma pasta: **Configuração → Skills → Skills da equipe**, informando o endereço (`github.com/seu-orgao/seu-repo/tree/main/skills`).

Cada arquivo `.md` da pasta vira uma skill — o título (`# Assim`) ou o `name:` do cabeçalho vira o nome, e o `README.md` fica de fora. Quem cuida do padrão edita o repositório; com **Manter sincronizada** ligado, cada pessoa recebe a atualização (a pasta é conferida a cada 12 horas).

A coleção é um **espelho**: skill retirada da pasta sai do painel também, e skill da equipe não se edita no painel — aparece marcada como `equipe`. Suas skills próprias não são tocadas.

Há dois modelos para copiar em [skills-exemplo/](https://github.com/SEI-Pro/sei-pro/tree/master/skills-exemplo): despacho de encaminhamento e nota técnica.

Para preferências curtas que valem para **toda** conversa — tratamento, estilo, o que sempre citar —, use **Instruções adicionais**, na seção Avançado.

### Conectores: ferramentas de fora do SEI

Skill ensina **como** a sua unidade trabalha. Conector dá ao agente **o que fazer fora do SEI**: consultar um sistema do órgão, uma base pública, um serviço que a sua equipe mantém. Tecnicamente é um **servidor MCP** — o mesmo padrão que o Claude e outros assistentes usam para se ligar a serviços.

Cadastre em **Configuração → O que o agente pode → Conectores (MCP)**:

| Campo | Para que serve |
| ----- | -------------- |
| **Nome** | Como você e o agente se referem ao conector |
| **Endereço do servidor** | O endereço HTTP do servidor MCP. Só `https` (`http` vale apenas para `localhost`) |
| **Autenticação** | Opcional: o nome e o valor do cabeçalho que o servidor exige (em geral `Authorization`) |

Ao salvar, o SEI Pro conversa com o servidor, pede a lista de ferramentas e guarda. O navegador vai pedir a sua autorização para acessar aquele endereço — sem ela, nenhuma chamada é feita.

#### A permissão é por ferramenta

Em **Ferramentas**, cada uma tem três estados:

| Estado | O que acontece |
| ------ | -------------- |
| **Sempre permitir** | O agente usa quando precisar, sem perguntar |
| **Requer aprovação** | Aparece um cartão com o conector, a ferramenta e **exatamente o que vai ser enviado**; nada sai antes do seu clique |
| **Bloqueado** | O agente não usa — e nem fica sabendo que a ferramenta existe |

O estado padrão, inclusive para ferramenta que o servidor passar a oferecer depois, é **Requer aprovação**. Dá para desligar o conector inteiro pelo interruptor, sem perder o cadastro, e **excluir** leva embora o token guardado.

#### O que sai do seu navegador

O conteúdo que você mandar a um conector **sai do seu navegador para o endereço dele** — é um serviço de terceiro, fora do SEI e fora do SEI Pro. Por isso:

* **dados pessoais vão mascarados**, como nas conversas: o servidor recebe `[PESSOA_1]`, não o nome;
* na **primeira vez** que o agente usa um conector, ele pede a sua autorização explícita;
* o endereço e o token ficam **só neste navegador**, como a chave do serviço de IA.

Conector não escreve no SEI: para isso continuam valendo o cartão de aprovação e as regras da unidade.

#### Conector no seu próprio computador

O servidor pode rodar na sua máquina, em `http://localhost` ou `http://127.0.0.1` (é o único caso em que `http` vale). Na primeira vez, o navegador pede a sua permissão para o SEI Pro falar com esse endereço.

Como é você quem liga e desliga esse servidor, a lista mostra o estado de cada conector: **conectado** ou **sem resposta**. O estado é conferido de novo toda vez que o painel abre, e o botão **Testar de novo** aparece quando o servidor não responde. Se ele estiver desligado, o agente diz isso na conversa, em vez de um erro de rede.

Quando uma ferramenta do conector devolve um erro (um login que expirou, um dado recusado), o texto chega inteiro a você e ao agente, e o conector continua ligado: basta resolver o que ele pede e repetir o pedido.

#### Quando o conector precisa de um arquivo

Alguns conectores recebem arquivos, por exemplo para anexar um contrato num sistema. Nesse caso o agente **baixa o documento do SEI** para `Downloads/SEI Pro/<número do processo>/`, com um nome legível que ele escolhe a partir do documento (a extensão original e o número SEI são sempre mantidos), e passa ao conector o caminho do arquivo.

* **Você aprova cada download.** O cartão mostra o documento e onde ele será salvo, e não existe "permitir sempre" para isso. Rotina nunca baixa sozinha.
* **A cópia tem os dados reais.** Ela sai do SEI sem máscara e fica no seu computador até você apagar.
* **Só documento externo** (o arquivo anexado), e só **documentos e imagens**: PDF, Word, Excel, imagem, texto. O cartão mostra o nome, o tipo e o tamanho reais do arquivo. Documento escrito no editor do SEI ainda não. Sigiloso, nunca.
* **O caminho real do arquivo só é passado a conector do seu próprio computador.**
* **Conector em outro computador** não lê o seu disco. Se ele aceita receber o arquivo, o SEI Pro relê o documento do SEI, confere se é o mesmo que você aprovou no download (documento, processo, tamanho e uma impressão digital do conteúdo, o SHA-256) e envia o arquivo com o nome aprovado. O agente não vê o conteúdo nem escolhe outro nome.
* **Esse envio pede a sua aprovação toda vez**, mesmo que a ferramenta esteja em "Sempre permitir". O cartão mostra o documento, o arquivo, o tamanho e o endereço do servidor, e avisa que o documento vai com os dados reais. Se o documento mudou no SEI depois do download, nada é enviado: o agente baixa de novo.
* **Para apagar**, vá em **Configuração → O que o agente pode → Arquivos baixados pelo agente**: a tela diz quantos arquivos existem e o botão os remove do computador. Os documentos continuam no SEI.

Na primeira vez, o navegador pede a permissão de **downloads**. Ela é opcional: quem não usa essa função nunca é perguntado.

### Nada é alterado sem a sua aprovação

Quando o pedido implica mexer no processo, o agente **não executa**: ele monta um cartão com o que pretende fazer, item a item, mostrando o valor de antes e o de depois. Nada acontece enquanto você não clicar em **Aprovar e executar**.

> ![Cartão de aprovação](../img/tela-agenteia2.gif)

* Ações **irreversíveis** — enviar processo, excluir ou cancelar documento, cancelar assinatura — exigem, além da aprovação, marcar que você entendeu que não dá para desfazer;
* **Assinar** pede o cargo e a sua senha do SEI no próprio cartão. A senha vai do painel direto para o SEI: ela **não** é enviada ao modelo de IA nem guardada;
* **Recusar** pede, opcionalmente, o que ajustar — e o agente tenta de novo com a sua correção.

### Gerenciar os agentes

Em **Configuração → Agentes** ficam os três perfis operacionais do painel:

* **Agente principal** — conversa com você, lê o SEI e só escreve depois da aprovação;
* **Agentes auxiliares** — recebem leituras grandes, trabalham com contexto próprio e devolvem um resumo ao principal;
* **Rotinas automáticas** — fazem perguntas agendadas quando o painel está aberto e conectado ao SEI.

Cada perfil mostra modelo, permissão, última execução, tokens, custo e falhas recentes. As execuções auxiliares ficam no estado local da conversa com tarefa, modelo, horário, resultado ou erro e consumo. Retomar uma conversa apenas restaura esses dados: não faz uma nova chamada à IA.

O modelo auxiliar pode ser diferente do principal. Também dá para limitar quantas tarefas independentes rodam em paralelo (padrão: **3**) e quantas rodadas de ferramentas cada auxiliar pode fazer (padrão: **14**). Mesmo com limites maiores, auxiliares continuam somente leitura, sem aprovação, assinatura ou nova delegação. As rotinas respeitam o alcance escolhido no cadastro; rotinas antigas continuam somente leitura.

### Rotinas

Há perguntas que valem toda semana e ninguém lembra de fazer: *"processos parados há mais de 30 dias"*, *"documentos sem assinatura na unidade"*. Em **Configuração → Conversas e rotinas** você cadastra a pergunta e quando ela deve rodar (todo dia, toda semana num dia, todo mês num dia, a partir de um horário).

| Campo | O que é |
| ----- | ------- |
| **Nome** | Como a rotina aparece na lista e na notificação |
| **Instruções** | O pedido, escrito como você escreveria na conversa — e/ou **skills** já cadastradas, que entram junto |
| **Quando** | Quando eu mandar, a cada hora, todo dia, dias úteis, toda semana (num dia) ou todo mês (num dia), a partir de um horário |
| **O que ela pode fazer** | Só leitura; pode propor e esperar a sua aprovação; ou alterar sem perguntar |
| **Avisar quando terminar** | Notificação do navegador com o resultado em uma linha |
| **Teto por execução** | Limite de gasto só desta rotina, além dos limites gerais |

**Dias úteis** é de segunda a sexta — **feriado não é considerado**, porque a extensão não tem o calendário de cada órgão. **Quando eu mandar** não tem horário: ela roda no botão **Rodar agora**, que também existe em qualquer rotina.

#### Onde ela roda, e quando

A rotina roda **no seu navegador, com a sua sessão do SEI**, e só com o agente aberto. Não existe servidor do SEI Pro guardando esse acesso para agir de madrugada — e é bom que não exista.

* No **Chrome**, o navegador avisa na hora marcada mesmo com o painel fechado: aparece uma notificação de pendência, e clicar nela abre o agente e roda a rotina. Com o painel já aberto, ela roda sozinha;
* no **Firefox**, ela roda quando a barra lateral do agente está aberta.

Quem ficou uma semana fora volta com **uma** execução pendente, não sete: o que interessa é a foto de agora. As **10 últimas execuções** de cada rotina ficam registradas, com data, custo e o que foi alterado.

**Pausar todas** suspende os disparos automáticos e os alarmes deste painel. **Rodar agora** continua disponível, exigindo chave configurada, aba do SEI conectada e gasto permitido. A lista também mostra o resultado completo, eventuais erros e a próxima janela de execução.

#### O que uma rotina pode alterar no SEI

Por padrão, nada: **só leitura**. Os outros dois alcances existem para quem precisa deles, com cercas:

| Alcance | O que acontece |
| ------- | -------------- |
| **Só leitura** | Ela consulta e responde. Nunca altera nada |
| **Pode propor, eu aprovo** | Ela monta o plano e **para**, esperando o seu clique no cartão de aprovação |
| **Altera sem me perguntar** | Ela executa — apenas as ferramentas que você escolher, uma por uma |

No alcance autônomo:

* **exclusão, cancelamento e assinatura nunca** acontecem, mesmo que você tente autorizá-las: elas não aparecem na lista, e a trava se repete na hora de executar;
* ferramenta fora da lista reprova o plano inteiro, e as **regras da unidade** continuam valendo;
* cada alteração entra na conversa e no **desfazer**, como qualquer escrita;
* o aviso por notificação é **obrigatório** — você tem de saber que algo foi escrito;
* na **primeira falha** ao alterar o SEI a rotina se desliga sozinha, com o motivo na lista. Insistir sem ninguém olhando é pior que parar.

### O que acompanha você em outro computador

A configuração do agente usa a **sincronização do próprio navegador** — a mesma que já leva as opções do SEI Pro. Quem entra na conta do Chrome (ou do Firefox) no computador de casa encontra o agente configurado como no trabalho, sem cadastrar nada de novo.

| Acompanha você | Fica só neste computador |
| -------------- | ------------------------ |
| Serviço de IA escolhido, modelo e ajustes | **A chave do serviço de IA** |
| Suas instruções adicionais | As conversas guardadas |
| Regras da unidade | O gasto do dia |
| Memória da unidade | |
| Rotinas (sem o histórico de execuções) | O histórico de execuções de cada rotina |
| Conectores: endereço, estado e permissão de cada ferramenta | **O token do conector** e a lista de ferramentas (que se refaz com um clique em *Atualizar lista*) |
| Skills: nome, atalho e o **endereço no GitHub** | **O texto das skills coladas à mão** |
| Coleções de skills da equipe | |
| Fluxos do Estúdio de Fluxo | Os processos usados como modelo |

Duas consequências práticas:

* **skill colada à mão não viaja.** O texto de uma skill pode passar de 20 mil caracteres, e o navegador reserva pouco espaço para sincronizar — então viaja o endereço, não o conteúdo. Se você quer que uma skill acompanhe a sua conta, **mantenha o arquivo `.md` num repositório** e cadastre o endereço: o outro computador baixa sozinho;
* **segredo não sincroniza.** A chave do serviço de IA e os tokens dos conectores não vão pela sincronização do navegador: em cada computador você os digita uma vez — a não ser que você os inclua de propósito no [backup em arquivo](#backup-em-arquivo-o-agente-inteiro-em-outro-computador).

Se a configuração passar do espaço que o navegador reserva, o agente avisa na conversa e para de sincronizar o excedente — o que já estava sincronizado continua valendo, e nada se perde neste computador.

### Backup em arquivo: o agente inteiro em outro computador

O que a sincronização do navegador não leva — **as conversas guardadas, o texto das skills coladas à mão, o histórico das rotinas** — pode ir num arquivo `.json` que você guarda numa pasta do **OneDrive** ou do **Google Drive**, como já fazem os Monitorados, os Projetos e as Demandas. Em **Configuração → Backup em arquivo**:

* **Criar arquivo** (ou **Usar arquivo existente**, no segundo computador): a partir daí o agente grava sozinho alguns segundos depois de cada mudança e lê o arquivo ao abrir o painel. Uma conversa feita no trabalho aparece em casa.
* **Sincronizar agora**, **Exportar (.json)** e **Importar arquivo** para controle manual. No Firefox, que não grava direto num arquivo, só Exportar e Importar existem.
* Ler o arquivo **sempre mescla** com o que já está aqui; nunca apaga nada deste computador. Conversa apagada num computador não volta na leitura seguinte.
* **A chave do serviço de IA e os tokens dos conectores só entram no arquivo se você marcar** *Incluir a chave de API e os tokens dos conectores* — desmarcado de fábrica, e a escolha vale só para este computador. Quem tiver acesso à pasta do arquivo poderá usar a chave.
* O arquivo mora numa pasta que outra pessoa pode editar, então o agente o trata com desconfiança: **rotina autônoma chega desligada**, e **conector novo chega desligado, sem consentimento e com as ferramentas restritas**. O arquivo pode desligar ou restringir um conector, nunca ligar nem liberar.
* Se a opção de guardar conversas estiver desligada, as conversas também não vão para o arquivo.

### Anexar PDF na conversa

O botão de anexar aceita **PDF**, além de texto, CSV e JSON. O PDF **é lido neste computador** e só o texto vai ao serviço de IA — o arquivo nunca é enviado.

* A leitura é **página por página**: página com texto usa o texto; página digitalizada passa pelo **reconhecimento de texto (OCR)**, também feito aqui. O andamento aparece (*OCR: página 7 de 32*) e dá para cancelar.
* Antes de começar, o agente conta as páginas digitalizadas e avisa quando o OCR pode deixar o computador lento por alguns minutos.
* O envio da mensagem espera a leitura terminar. O anexo mostra o nome e o número de páginas, e avisa quais páginas não puderam ser lidas.
* O texto vindo de OCR é marcado como tal para o modelo, porque pode ter erros de reconhecimento. E, como todo anexo, é tratado como **conteúdo**, nunca como instrução.

### Memória da unidade

Skills são o que **você escreve**. A memória é o que o agente **aprende** conversando: você corrige uma vez ("aqui o despacho termina com *Respeitosamente*") e ele leva isso para as próximas conversas.

Fica tudo à vista: cada anotação aparece na conversa no momento em que é feita (*Aprendi: …*) e na lista em **Configuração → Memória da unidade**, com a data e quem anotou — o agente ou você. Cada uma se apaga num clique, e o interruptor **Deixar o agente aprender** desliga de vez.

O que **não** entra: dado de processo, conteúdo de documento, número e nome de pessoa. Se o agente tentar anotar algo assim, a própria extensão recusa e mostra o motivo na conversa. Memória é sobre o jeito da unidade trabalhar; o resto se lê no SEI, que muda sem avisar — e, quando a memória contradisser o que o SEI mostra na hora, vale o SEI.

### Tarefas longas: o agente pede ajuda

Quando o pedido exige **ler muito** — trinta documentos de um processo, vários processos da caixa —, o agente entrega essas leituras a **agentes auxiliares**, que trabalham em paralelo com contexto próprio e devolvem só a resposta. Na conversa aparece uma linha *Delegar N tarefas de leitura*.

Isso existe por dois motivos práticos: a conversa principal não fica entupida de texto que ninguém vai reler, e você não paga de novo por esse texto a cada pergunta seguinte.

O auxiliar tem limites rígidos: **só ferramentas de leitura** (ele não escreve no SEI, não pede aprovação e não assina), não vê a conversa, não pode delegar de novo e trabalha por poucos passos. O gasto dele entra no mesmo contador, no topo do painel.

Como a tarefa dele é mecânica — abrir, extrair, resumir —, dá para rodá-la num **modelo mais barato**: em **Configuração → Agentes** há o campo *Modelo das tarefas auxiliares*, que por padrão usa o mesmo da conversa. Escolhendo um modelo econômico (mini, flash, haiku), essa parte costuma custar uma fração. Só precisa ser um modelo que saiba usar ferramentas.

### Regras da unidade

Há coisas que, no seu setor, o agente simplesmente não deve fazer — e isso não pode depender de o modelo lembrar de uma instrução. Em **Configuração → Regras da unidade** você escreve a regra, e quem a aplica é o **próprio SEI Pro**, antes de qualquer alteração:

| Campo | Para que serve |
| ----- | -------------- |
| **O que fazer** | **Bloquear** a ação, ou **deixar passar com aviso** |
| **Ações alcançadas** | Quais ferramentas (enviar, assinar, criar documento…). Nenhuma escolhida = qualquer alteração |
| **Só quando aparecer** | Opcional: palavra que precisa estar no pedido — o tipo do documento, a sigla da unidade de destino |
| **Mensagem** | O que você lê, e o que o agente lê para explicar na conversa |

Uma regra que **bloqueia** barra a ação **antes** de ela ser oferecida para aprovação: o cartão nem aparece, nada vai ao SEI e o agente explica o motivo em vez de tentar outro caminho. Uma regra que **avisa** deixa aprovar, com o alerta à vista no cartão.

Exemplos que costumam fazer sentido: *"o envio de processo é feito por uma pessoa, não pelo agente"*, *"Portaria não é criada pelo agente"*, *"confira o conteúdo antes de assinar"*. O botão **Usar modelos** cria os três primeiros para você ajustar.

### Desfazer

Toda alteração feita pelo agente aparece na conversa como uma linha — e, quando existe volta possível, essa linha traz um botão **Desfazer**. Clicar pergunta o que vai acontecer ("Tirar o marcador X?") e executa a ação inversa no SEI, em seu nome. A linha passa a mostrar *desfeita*, e o agente é avisado, para não seguir raciocinando sobre um processo que voltou atrás.

| Dá para desfazer | Não dá |
| ---------------- | ------ |
| Concluir e reabrir processo | **Enviar processo** — já está na outra unidade |
| Marcador (volta ao anterior, ou sai) | **Assinar** — assinatura não se apaga, só se cancela com justificativa |
| Anotação e atribuição (voltam ao valor anterior) | **Excluir** e **cancelar** documento — são definitivos |
| Incluir e retirar documento de bloco | **Registrar andamento** — o histórico do processo não se apaga |
| Disponibilizar, concluir e reabrir bloco | **Editar conteúdo** — o texto anterior fica na versão do documento |
| Criar bloco e criar documento (ainda não assinado) | |

Onde não há volta, a linha diz *sem desfazer* e, ao passar o mouse, explica por quê. Nada é escondido: o agente continua pedindo aprovação **antes** de cada alteração — o desfazer é a segunda rede, não a primeira.

### Instruções escondidas dentro de documentos

Em outubro de 2026 o STF multou um advogado que escondeu, no cabeçalho de uma petição, um comando dirigido à inteligência artificial que lê os autos — texto que não aparece na tela, mas aparece para quem extrai o conteúdo. O mesmo truque cabe em qualquer processo do SEI, e quem lê o documento aqui é o agente.

O SEI Pro trata isso em quatro frentes, sem que você precise configurar nada.

#### 1. Documento é dado, nunca ordem

Para o agente, só três coisas são instrução: as regras do próprio agente, as **regras da unidade** que você cadastrou e **o seu pedido** na conversa. Tudo o que vem de documento, anexo, metadado, cabeçalho, rodapé ou campo oculto é **conteúdo** — mesmo escrito em forma de ordem.

#### 2. O que está escondido da tela é apontado

Na hora de ler o documento, o SEI Pro examina o HTML antes de virar texto e identifica o que existe no arquivo mas **não aparece para quem assina**: letra branca sobre fundo branco, fonte de tamanho zero, `display:none`, caixa fora da tela. Esse trecho não é apagado — documento é prova —, mas é apontado.

#### 3. O conteúdo vai delimitado

O texto do documento chega ao modelo dentro de uma marcação com um **código sorteado a cada conversa**. Como o documento foi escrito antes, não há como ele "fechar" a marcação e continuar escrevendo como se fosse instrução. Trechos suspeitos chegam marcados: ⟦instrução ignorada: …⟧.

Também são removidos os **caracteres invisíveis** — aqueles que não aparecem em lugar nenhum e servem só para partir palavras e escapar da verificação.

#### 4. Você fica sabendo

Quando algo é encontrado, aparece na conversa uma **verificação de integridade**: em que documento está, o que é e o que foi feito. E se o agente propuser qualquer alteração no SEI depois disso, o **cartão de aprovação** traz o aviso de que um documento lido naquela conversa trazia conteúdo dirigido a IA — porque aprovar sabendo disso é diferente de aprovar sem saber.

> O que isso **não** faz: não impede que um documento contenha instruções, e sim que elas sejam obedecidas em silêncio. A trava que impede qualquer alteração no SEI continua sendo a sua aprovação. E comando escondido dentro de uma imagem só aparece se o reconhecimento de texto estiver ligado.

### Quando dá erro

Todo erro na conversa traz dois botões no canto, só com ícone:

* **copiar** leva a mensagem **e um diagnóstico técnico** juntos, prontos para colar num chamado, num e-mail ou numa conversa com quem mantém a extensão;
* **a seta** abre esse diagnóstico aqui mesmo, se você quiser conferir antes o que está mandando.

O diagnóstico traz o que ajuda a resolver — versão da extensão, navegador, serviço de IA e modelo, o código da resposta, o que o provedor respondeu, o tamanho da conversa, as últimas ferramentas usadas e se o navegador autorizou o acesso ao endereço do serviço.

E traz só isso. **Não vão junto** a chave do serviço de IA, os tokens dos conectores, o conteúdo dos documentos, o texto da conversa, o número do processo nem a sigla da sua unidade. Pode colar sem medo.

### O que o agente não faz

* **Processo sigiloso:** o agente não carrega. Estando você num processo sigiloso, ele se recusa a responder qualquer coisa;
* **Documento restrito:** o conteúdo só é lido depois que você autoriza, uma vez por conversa;
* **Sua senha do SEI** nunca é enviada ao modelo;
* **Números de processo e documento** não são mascarados (o agente precisa deles), mas **dados pessoais são** — veja abaixo.

### Dados pessoais saem mascarados

Antes de qualquer texto sair do navegador, o agente troca por rótulos o que reconhece como dado pessoal: CPF, CNPJ (opcional), e-mail, telefone, CEP, RG, título de eleitor, CNH, cartão, chave PIX, data de nascimento, endereço, filiação, conta bancária e CID. O modelo recebe `[CPF_1]`, `[PESSOA_2]` — e não o dado.

Os nomes dos interessados do processo também são mascarados (dá para desligar nas configurações). Quando o agente precisa escrever algo no SEI, o dado real volta no lugar do rótulo, já dentro do seu navegador.

### Conversas guardadas

O relógio no topo do painel guarda as conversas anteriores: dá para reler, **exportar em Markdown** e apagar (uma ou todas). O prazo de guarda é configurável — 7, 30, 90 dias ou sem limite — e o recurso pode ser desligado.

> ![Conversas guardadas](../img/tela-agenteia3.gif)

Fica guardada **só a transcrição** — o que apareceu na tela. O histórico enviado ao modelo e a tabela que liga os rótulos aos dados reais somem quando o navegador fecha. É por isso que uma conversa guardada abre **só para leitura**: continuar exigiria justamente o que não foi gravado.

### Quanto custa

O SEI Pro é gratuito e não cobra nada pelo agente. O custo é o do serviço de IA que você escolher, cobrado diretamente por ele. O painel mostra, no topo, quanto a conversa em curso consumiu — **em reais**, convertidos pela cotação do dia do dólar (PTAX do Banco Central, com a AwesomeAPI como reserva; passando o mouse, aparece o valor original e a cotação usada). Nas configurações dá para desligar a conversão e ver em dólares. Quando o serviço não informa custo, o painel mostra tokens.

Uma consulta simples costuma custar centavos de dólar. Ler documentos longos custa mais, porque o texto inteiro vai para o modelo.

Três coisas seguram essa conta:

* **Teto de gasto** — em **Configuração → Gasto** dá para definir um limite **por conversa** e outro **por dia**, em reais. Ao chegar perto (80%), o painel avisa; ao bater, ele para de aceitar perguntas e explica o que fazer. O limite diário soma todas as conversas e zera à meia-noite;
* **Cache do serviço** — o trecho que se repete a cada pergunta (instruções, ferramentas, skills) é marcado para o provedor cobrar menos por ele. O medidor do topo mostra, ao passar o mouse, quantos tokens vieram do cache. Alguns modelos fazem isso sozinhos, outros ignoram; nenhum perde qualidade;
* **Resumo automático** — quando a conversa fica muito longa, o agente resume o começo (o que foi feito, com os números, e o que ficou decidido) e segue com o resumo no lugar do texto inteiro. Ele avisa na conversa quando isso acontece. As últimas trocas nunca são resumidas.

### Como ativar

A função vem **ligada** de fábrica. Ela fica nas [Configurações do SEI Pro](../pages/DESATIVARFUNCOES.md), aba **Geral**, seção **Editor de Texto**, opção **Agente de Inteligência Artificial**.

### Bom saber

* **A IA erra** — inclusive com aparência de certeza. Confira toda resposta antes de usar. O conteúdo de um documento assinado é de responsabilidade do agente público que o assina;
* O agente só enxerga o que **você** enxerga: ele usa a sua sessão do SEI e as suas permissões. Não há acesso a processo que você não poderia abrir;
* Toda alteração feita pelo agente entra no SEI **em seu nome**, e aparece no histórico do processo como qualquer outra;
* O agente lê PDF digitalizado com o OCR que vem na extensão, limitado às primeiras páginas. Para documentos longos, use as [Ferramentas de PDF](../pages/FERRAMENTASPDF.md);
* O SEI Pro **não intermedeia** as mensagens e não recebe financiamento de nenhum serviço de IA.

## Próximo item

> [Estúdio de Fluxo](../pages/FLUXOS.md)
