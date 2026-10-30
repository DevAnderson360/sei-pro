# Documentos em Lote: texto para a política de privacidade

Texto pronto para publicar. O `PRIVACY_POLICY.md` é editado pela web e **não** foi alterado.

## Linha para o inventário (seção 3.2, tabela "Tipo de dado | Finalidade | Onde fica")

```
| Lote do Documentos em Lote em andamento (as linhas da planilha escolhida e a ordem das colunas, o modelo escolhido, a configuração do lote, o usuário (login) e o endereço do SEI, os números dos processos de destino e a situação de cada documento, com a mensagem de erro de cada linha; o texto do modelo não é guardado) | Retomar um lote interrompido e não duplicar documentos | Navegador, só neste computador (nunca sincronizado nem enviado a servidor); apagado ao fechar o resultado de um lote terminado sem pendência; com pendência, guardado por até 7 dias após o último uso, salvo se o usuário concluir ou descartar antes |
```

## Parágrafo explicativo (para a seção que descreve os dados guardados no navegador)

> **Documentos em Lote.** Para poder retomar um lote que foi interrompido (janela fechada, página recarregada, queda de rede) sem criar documentos em duplicidade, a ferramenta guarda, no armazenamento local da extensão (`chrome.storage.local`) deste navegador:
>
> - as **linhas da planilha** que o usuário escolheu (o conteúdo das células, que pode incluir nomes, números de processo e outros dados que o usuário tenha colocado ali);
> - a **ordem das colunas** da planilha (para o resultado e o CSV saírem na mesma ordem do arquivo);
> - a **identificação do modelo** escolhido (número do documento ou do Texto Padrão e o tipo de documento) e a **configuração** do lote (colunas escolhidas, destino, pausa);
> - o **usuário do SEI (login)** e o **endereço do SEI** (host) em que o lote foi iniciado, para que ele só seja oferecido de volta ao mesmo usuário no mesmo SEI;
> - o **andamento do lote**: a situação de cada linha, a **mensagem de erro** de cada linha que falhou ou ficou de fora, os números e links dos documentos já criados, os **números dos processos de destino** (os da planilha, o processo da tela e os processos novos criados pelo lote) e o resultado da verificação dos processos de destino.
>
> O **texto do modelo não é guardado**: ele é lido de novo do SEI quando necessário. Esses dados ficam **somente neste navegador**: não são sincronizados pela conta do navegador e **não são enviados a nenhum servidor** do SEI Pro nem de terceiros. A ferramenta fala apenas com o próprio SEI do órgão.
>
> Quando o lote termina **sem nada pendente**, o registro é **apagado ao fechar o resultado** (ou ao escolher **Concluir**). Um lote com pendência (linha com erro, incerta, de fora ou ainda não enviada) fica guardado por **até 7 dias após o último uso** (cada retomada renova o prazo), a menos que o usuário escolha **Concluir** ou **Descartar** antes. O usuário também pode apagá-lo a qualquer momento escolhendo **Descartar**, limpando os dados da extensão ou desinstalando-a. Como os demais dados guardados no navegador, ele não é criptografado pela extensão (seção 3.4).

## Registro de versão (tabela de histórico, ao final)

Sugestão de acréscimo à próxima linha do histórico: "inventário em 3.2 inclui o lote em andamento do Documentos em Lote (com o login e o endereço do SEI), guardado só no navegador: apagado ao fechar o resultado de um lote sem pendência, e com pendência por até 7 dias após o último uso".

## Observação para o autor

Publicar pela edição web e atualizar a data/versão da política. A regra dos 7 dias conta do último uso (decisão registrada no ledger, Ruling 14), por isso o texto diz "após o último uso".
