# Fixtures do sei-nucleo

`sei41/` traz telas reais do SEI SP Treinamento (4.1.5) e `sei5/` telas reais
do SEI 5, todas com hashes de sessão zerados. A primeira linha de cada arquivo
é `<!-- url: ... -->`, a URL de onde a tela veio.

## Captura do SEI MJ (5.0.4)

| Arquivo | Origem | Anonimização |
|---|---|---|
| `sei5/documento_alterar.html` | Tela `documento_alterar` de um Termo de Compromisso de Manutenção de Sigilo, capturada no SEI MJ de homologação (hmlsei.mj.gov.br, CK5), em 16/10/2026. Mantida em Latin-1, como o servidor entrega. | Todo hash de sessão de 64 hexadecimais virou 64 zeros; o login do usuário (`usuario.teste`, inclusive no prefixo do cookie `MJ_SEI_usuario_teste`) e o nome de pessoa no conteúdo (`Fulano de Tal`) foram trocados. Ids de unidade e de processo ficaram. |

## Fixtures sintéticas (não são captura)

| Arquivo | Origem | Substituir |
|---|---|---|
| `sei41/documento_mover.html` | Montada à mão a partir do HTML de `sei/web/documento_mover.php` do SEI 5.0.0 (formulário `#frmDocumentoMover`, campos, botão `sbmMover` e o `infraAjaxComplementar` de `protocolo_RI1023` no script da tela), com os ids do processo 148265 e do documento 160172 de `sei41/arvore_completa.html`. | Tarefa 13 (Ações em Lote): capturar a tela real no SEI SP (4.1.5) e no SEI MJ (5.0.4). |

Respostas montadas dentro das provas (não há arquivo): o XML do
`protocolo_RI1023` (`InfraAjax::gerarXMLComplementosArray` do SEI 5) e a tela
`documento_selecionar` da lupa do PDF (`documento_selecao.php` do SEI 5, linhas
com `chkInfraItemN`). Também a confirmar com captura real na Tarefa 13.
