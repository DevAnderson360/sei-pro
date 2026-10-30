# Pesquisar Link Permanente e Processos em Lote (reformulação em TypeScript) — especificação de desenho

Data: 16/10/2026. Branch `feat/lote-ts` (worktree `../sei-pro-lote`), a partir do master (54efdb8).
Aprovado pelo autor em conversa: as cinco melhorias de cada módulo, o compartilhamento de código no `sei-comum`, a validação no SEI SP e no SEI MJ e, depois dela, uma segunda etapa (seção 8).

## 1. Objetivo

Levar os dois itens do menu lateral que o SEI Pro injeta, hoje em JavaScript legado com jQuery UI, para a camada TypeScript, no molde do Histórico: item do menu dispara um evento, um content script abre um modal (iframe sobre o SEI) e um app numa página da extensão faz o trabalho. Tema claro e escuro, DOM seguro (`h()`), modal sem botão Cancelar (o X e o Esc fecham), tokens `--spro-*`, tudo em português.

Critério de sucesso: paridade total com o legado (nada que funcionava deixa de funcionar) mais as melhorias da seção 5 e 6, validado nos dois SEIs.

## 2. Decisões

| Tema | Decisão |
|---|---|
| Pacotes | Dois pacotes novos: `link-permanente/` e `processos-lote/`. O que os dois (e o Histórico) dividem sobe para o `sei-comum`. |
| Lançamento | Só o `dist/manifest.json` (Lab MV3, Chrome/Edge). Os outros três manifests seguem com o legado intacto, como nas migrações anteriores. |
| Legado | Cede pelo atributo no `<html>` (`data-seipro-link-permanente`, `data-seipro-processos-lote`), como o Histórico: o clique no item do menu dispara `spro-link-permanente-abrir` / `spro-processos-lote-abrir`. O código antigo fica no lugar para os manifests que não têm o novo. |
| Opções | `proclote` continua sendo a opção do Processos em Lote. O Pesquisar Link Permanente não tem opção hoje (sempre ligado) e segue assim. |
| Link gerado | `controlador.php?acao=procedimento_trabalhar&id_procedimento=N[&id_documento=M]`, **sem** `infra_hash`, como o legado (confirmado pelo autor: funciona no SEI 5; não verificar de novo). |
| Armazenamento | `chrome.storage.local`, uma chave por entidade, sem sincronizar. |

## 3. Arquitetura

```
sei-comum/  + ui/modalIframe.ts   controle do modal (extraído de historico/src/pagina/modal.ts, com seletor do item do menu e textos por parâmetro)
            + lote/executor.ts    fila com concorrência, pausa/continuar, cancelar, repetição só das falhas, ritmo adaptativo
            + lote/resultado.ts   linha de resultado com status (ok | nao-encontrado | sem-acesso | erro | pulado) e totais
            + ui/tabelaResultado.ts  tabela de resultado, copiar (texto simples e HTML com links clicáveis), baixar CSV (usa csv.ts)
            + texto/protocolos.ts extrair números de processo e números SEI de texto livre, sem duplicatas
historico/  passa a importar o controle do modal do sei-comum (sem mudar comportamento; as provas existentes são a guarda)
link-permanente/
   ├─ src/modelo/      entrada (extração), resultado, montagem do link
   ├─ src/pagina/      content script: marca, evento do menu, modal, ponte
   ├─ src/app/         app do modal
   └─ estatico/, tests/
processos-lote/
   ├─ src/modelo/      linhas, colunas, trocas para latin-1, validação/prévia, estimativa, progresso persistido
   ├─ src/sei/         formulário do tipo (uma vez), POST por processo, hipóteses legais, hdnAssuntos
   ├─ src/pagina/, src/app/
   └─ estatico/, tests/
```

O que fala com o SEI usa o `sei-nucleo` (`Sei.localizar`, `Formulario`, `criarHttp`, `paraLatin1Seguro`). A ponte e o modal seguem o Histórico (`CANAL_*` por módulo, porta da própria aba, prazo de contato).

## 4. Fatos do legado que não se perdem (não re-derivar)

Do Processos em Lote (ver memória `project_processos_em_lote`): o `action` do `procedimento_gerar` é reutilizável (o `infra_hash` é assinatura de sessão, não nonce), então o formulário do tipo é buscado uma vez e reusado nos N POSTs; o número SEI vem do `<title>` da resposta; hipóteses legais vêm por AJAX e a opção `value="null"` é descartada; `hdnAssuntos` precisa ser montado a partir de `#selAssuntos`; caracteres fora do ISO-8859-1 (travessão, aspas curvas, nbsp) são trocados pela tabela do legado antes do POST; `rdoNivelAcesso` 0/1/2. Se um POST falha, o formulário é refeito uma vez e a linha repetida. Aviso de cautela e pausa padrão de 500 ms (mín. 200, máx. 10000), teto de 2000 processos, estimativa a 900 ms por requisição.

Do Pesquisar Link Permanente: resolve cada entrada pela pesquisa rápida (`Sei.localizar`), pré-preenche com os processos selecionados na tela (`getProcessoUnidadePro`), tipo Documento/Protocolo conforme haja `id_documento`.

## 5. Pesquisar Link Permanente: melhorias

1. **Status por linha.** Cada entrada vira ok, não encontrado, sem acesso (sigiloso/sem permissão) ou erro. Sem repetição infinita (o legado repetia sem limite); botão "Tentar de novo só as que falharam".
2. **Texto livre.** Aceita parágrafo, e-mail ou tabela colada. Extrai números de processo e números SEI, tira duplicatas, mostra o que reconheceu antes de pesquisar.
3. **Copiar com links clicáveis.** Além de "Copiar tabela" e "Baixar CSV", copia como `text/html` (número como texto, link por baixo) e `text/plain`.
4. **Paralelismo.** 3 pesquisas simultâneas com pausa mínima entre as saídas. Observação: o ganho é de tempo, não de peso por pedido; `localizar` continua abrindo a página do processo, como o legado.
5. **Link.** Mantido como na seção 2.

## 6. Processos em Lote: melhorias

1. **Prévia antes de criar.** Tabela com uma linha por especificação: duplicatas, vazias, excesso de tamanho e o texto depois das trocas para latin-1 (trecho trocado destacado). Substitui a tela de confirmação por uma prévia por linha.
2. **Retomar.** O progresso (lista, parâmetros do tipo, índice, números já criados) vai para o `chrome.storage.local` a cada processo. Ao reabrir o módulo com lote incompleto, oferece "Continuar de onde parou" ou descartar. Não duplica: a linha só entra como criada depois da resposta com número.
3. **Colunas da planilha.** Além da especificação, aceita interessado, observação e nível de acesso por linha (colado do Excel, separado por tabulação; primeira linha pode ser cabeçalho). Sem colunas, comporta-se como hoje.
4. **Tela livre.** O laço roda no app (página da extensão), com pausar/continuar e ritmo adaptativo: se o tempo médio por processo dobra, a pausa sobe sozinha (e volta quando normaliza), sem passar de 10 s. Como o modal cobre a tela do SEI, a execução tem um botão **Minimizar**: o iframe encolhe para uma pastilha de progresso no canto (a rolagem destrava e o usuário volta a usar o SEI) e restaura ao clicar. Fechar o modal durante a execução pausa o lote e o deixa retomável (item 2). Decisão do builder (a ponte das requisições ao SEI): o app não tem cookie do SEI, então cada requisição passa pelo content script da aba (`criarProcesso`, `localizar`, etc.), e o laço fica no app.
5. **Resultado.** CSV, copiar com links e o botão "Gerar links permanentes destes processos", que abre o Pesquisar Link Permanente já com os números criados.

## 7. Compartilhado

Tema claro e escuro herdado do SEI, Esc fecha e Ctrl+Enter executa, estrutura de resultado comum, página de ajuda no padrão dos outros módulos (`pages/PROCESSOSEMLOTE.md` atualizado; `pages/LINKPERMANENTE.md` nova), linha no `pages/HISTORICO.md` no release.

## 8. Segunda etapa (depois da validação nos dois SEIs)

1. **Modelos salvos de lote:** tipo, assuntos, nível de acesso, hipótese legal e interessados; nomear, aplicar, apagar.
2. **Ações depois da criação:** incluir os processos criados em bloco interno, aplicar marcador e acompanhar. Cada ação opcional, com resultado por processo e repetição das falhas.

Detalhar e planejar só depois que a primeira etapa estiver validada.

> **Decisão registrada (revisão final, 16/10/2026):** o modelo salvo guarda tipo, nível de acesso, hipótese legal, pausa e as ações de "Depois de criar"; não guarda assuntos nem interessados, nem as linhas. Assuntos e interessados vêm do formulário do tipo de processo (o padrão que o SEI define para o tipo), e a coluna interessado ainda não é aplicada ao processo; guardá-los no modelo prometeria um efeito que a criação não tem. O item 1 acima fica assim.

## 9. Fora de escopo

Oficial e Firefox; mudar o formato do link; funcionalidades do PGD; migrar o Documentos em Lote (outro módulo).

## 10. Validação

Provas automáticas por pacote (`tsx` + `linkedom`, como o Histórico) e o gate de bytes ASCII do build. No navegador: SEI SP de treinamento (4.1.5, CK4) e SEI MJ de homologação `hmlsei.mj.gov.br` (5.0.4, CK5), com o autor logando. No lote, usar tipo de processo de teste, poucas linhas, e nunca enviar nem concluir. Conferir: modal abre pelo item do menu, Esc fecha e devolve o foco, os dois temas, e que o legado não carrega nos manifests que não têm o módulo novo.

Chamadas por conta do builder: nomes de constantes e eventos, formato das chaves de armazenamento do lote em andamento (prefixo `lote/`), texto das mensagens.
