# [![Home](../img/home.png)](../) |  SEI Pro ![Icone](../img/icon-32.png)

## ![SEI Pro Pesquisar link permanente](../img/icon-linkpermanente.png) Pesquisar link permanente

O endereço que aparece no navegador quando você abre um processo no SEI traz uma chave de acesso temporária (o `infra_hash`), que não funciona para outra pessoa. O **link permanente** é o endereço fixo do processo ou documento — ele pode ir num e-mail, numa planilha ou num documento, e funciona para qualquer usuário com acesso.

Esta ferramenta descobre, de uma vez, os links permanentes de uma **lista inteira** de processos ou documentos.

> ![Tela Pesquisar link permanente](../img/tela-linkpermanente.gif)

### Como usar

1. No menu lateral do SEI, clique em **Pesquisar Link Permanente** (fica no fim do menu);
2. A caixa de texto já vem preenchida com os processos que estão na tela (Controle de Processos, blocos internos ou acompanhamento especial). Se preferir, apague e cole a sua própria lista — **um número por linha**. Vale número de processo ou **número SEI** de documento;
3. Clique em **Pesquisar**;
4. A tabela mostra, para cada linha, o protocolo, o tipo e o link permanente;
5. Use **Copiar Tabela** para colar numa planilha ou documento, ou **Baixar CSV** para salvar o arquivo.

O botão **Limpar** esvazia a caixa e a tabela.

### Como ativar

O link **Pesquisar Link Permanente** está sempre disponível no menu lateral quando o SEI Pro está instalado.

### Bom saber

* A pesquisa usa o seu próprio acesso ao SEI: processos sigilosos ou de outras unidades a que você não tem acesso não retornam link.
* Quem abrir o link permanente precisa estar logado no SEI e ter permissão para ver o processo.
* Listas longas levam mais tempo, porque cada número é pesquisado individualmente.

## No SEI Pro Lab: nova versão

Na versão do SEI Pro Lab a ferramenta foi refeita. O link que ela gera não carrega o `infra_hash`, então continua valendo depois que você sai do SEI e funciona no SEI 4 e no SEI 5. As diferenças em relação ao descrito acima:

* **Texto livre.** Você pode colar um e-mail inteiro, uma coluna de planilha ou uma lista solta, sem organizar nada. Números de processo (como `50300.018905/2018-67`) e números SEI de documentos (como `0123456`) são reconhecidos sozinhos, e os repetidos são removidos antes da pesquisa. Uma linha que não seja número, como `Contrato-77`, é pesquisada exatamente como está escrita.
* **A caixa continua vindo preenchida** com os processos que estão na tela.
* **Pesquisar** também pode ser acionado com **Ctrl+Enter**.
* **Coluna Situação**, com o resultado de cada linha:
  * **Encontrado** — o link permanente foi localizado;
  * **Não encontrado** — o SEI não tem processo ou documento com esse número;
  * **Sem acesso** — o item existe, mas o seu usuário ou a unidade atual não pode vê-lo;
  * **Erro** — a consulta falhou (por exemplo, queda de conexão ou sessão expirada).
* **Tentar de novo só as que falharam** — refaz apenas as linhas com erro, sem repetir as que já deram certo.
* **Copiar com links** — copia a tabela com o número de cada item clicável, que aparece como link ao colar no Teams, no Outlook ou no Word. Em destinos que não aceitam texto formatado, a cópia sai como texto simples.
* **Baixar CSV** — baixa a tabela como planilha.

## Próximo item

> [Processos em Lote: abrir vários processos do mesmo tipo de uma só vez](../pages/PROCESSOSEMLOTE.md)
