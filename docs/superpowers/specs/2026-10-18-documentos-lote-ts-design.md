# Documentos em Lote (reformulação em TypeScript) — especificação de desenho

Data: 18/10/2026. Branch `feat/documentos-lote-ts` (worktree `../sei-pro-docs-lote`), a partir do master (9b9fde2).
Pedido do autor: refatorar na mesma stack dos módulos Projetos, Demandas e Favoritos (TypeScript, com o `sei-comum` e o `sei-nucleo` compartilhados); acrescentar a coluna do CSV que aponta o **processo de destino**; verificar os processos antes de gravar; validar no SEI SP e no SEI MJ.

## 1. Objetivo

Levar o Documentos em Lote (hoje `dist/js/sei-pro-docs-lote.js`, 1.541 linhas, jQuery UI, globais) para a camada TypeScript, no molde do Processos em Lote: item do menu dispara um evento, um content script abre um modal (iframe) e um app numa página da extensão faz o trabalho. Tema claro e escuro, DOM seguro (`h()`), modal sem botão Cancelar (o X e o Esc fecham), tokens `--spro-*`, português.

Critério de sucesso: paridade total com o legado (modelo por documento ou Texto Padrão, `##campos##`, nome na árvore, descrição, novo processo por linha, acentos, codificação do CSV, tabela de resultado) mais a novidade da seção 5 e as melhorias da seção 6, validado nos dois SEIs.

## 2. Decisões

| Tema | Decisão |
|---|---|
| Pacote | Novo `documentos-lote/`, copiando a estrutura de `processos-lote/`. Peças genéricas que os dois repetirem sobem para o `sei-comum`. |
| Lançamento | Só o `dist/manifest.json` (Lab MV3, Chrome/Edge). Os outros manifests seguem com o legado. |
| Legado | Cede por atributo no `<html>` (`data-seipro-documentos-lote`); o clique no item do menu dispara `spro-documentos-lote-abrir`. O código antigo fica nos manifests que não têm o módulo novo. |
| Opção | A opção atual do Documentos em Lote continua sendo a chave de liga/desliga (descobrir o nome em `dist/html/options.js`). |
| Criação do documento | Pelo `sei-nucleo`: `criarDocumento` (tipo, `nomeArvore`, `descricao`, texto inicial) e depois `editarConteudo` para trocar os `##campos##`, que já cobre CK4 e CK5. Substitui a cadeia de 6 requisições do legado. Texto inicial: como no legado, o SEI copia o modelo para o documento novo (`documentoModelo` ou `textoPadrao`) e depois o conteúdo é reescrito por linha. |
| Tipo do documento | Como no legado. **Modelo = documento da árvore**: o tipo é o do modelo, por **id exato** (sem casar por "contém o texto", que criaria outro tipo em silêncio); o prefixo do nome só serve de recurso quando o id não vem. **Modelo = Texto Padrão**: não há documento de origem, então o usuário **escolhe o tipo numa lista** na etapa do modelo (o legado já fazia assim). Se `criarDocumento` não aceitar tipo por id exato, ganha uma entrada por id (campo opcional, compatível com quem já o usa). *(Chamada do builder, conferida no legado.)* |
| Criação de processo | Reusa `processos-lote/src/sei` (formulário do tipo, POST, número no `<title>`), em vez da quarta cópia do legado. Se o import entre pacotes não for limpo, a peça sobe para o `sei-comum`/`sei-nucleo`. |
| Armazenamento | `chrome.storage.local`, uma chave por entidade, prefixo `docslote/`, sem sincronizar. |
| Falha numa linha | Não para o lote. A linha vira "erro" com o motivo, o lote segue, e há "Repetir só as que falharam". (O legado parava na primeira.) |

## 3. Arquitetura

```
documentos-lote/
  src/modelo/    campos (##x##), CSV (colunas, codificação), cruzamento, destinos, prévia, trocas latin-1
  src/sei/       modelo (documento da árvore ou Texto Padrão), destino (verificação), criar (documento por linha)
  src/pagina/    content script: marca, evento do menu, modal, ponte de requisições
  src/app/       app do modal: seleção do modelo → CSV → cruzamento → verificação → prévia → execução → resultado
  estatico/, tests/
```

Reuso do `sei-comum`: `ui/modalIframe`, `lote/executor` (concorrência 1 aqui, pausa, cancelar, repetir falhas, ritmo adaptativo), `ui/tabelaResultado`, `csv.ts`, `texto/` (trocas para latin-1, se estiverem lá). A ponte segue o Processos em Lote: o app não tem o cookie do SEI, então cada requisição passa pelo content script da aba e o laço fica no app.

## 4. Fatos do legado que não se perdem

- Campos: `##nome##` no modelo, casados com a primeira linha do CSV exatamente (sem acento/espaço nas dicas). Campo sem coluna fica sem preenchimento.
- Modelo: documento da árvore (nº do protocolo) ou Texto Padrão da unidade.
- CSV: codificação UTF-8 ou a do Excel antigo, detectada.
- Acentos saem do **nome na árvore** e do **Número**; o corpo do documento mantém. Símbolos º, ª, ° ficam. No SEI 3, aviso antes de continuar.
- Descrição aceita `##coluna##` misturado a texto, vai até 250 caracteres, e sofre as trocas do latin-1 (travessão→hífen, aspas curvas→retas, nbsp→espaço).
- Documentos saem sem assinatura (assinar é das Ações em Lote).
- Novo processo por linha: se o processo chegou a abrir sem o documento (falha ou cancelamento), o resultado mostra o link para conferir.
- Criar o documento só funciona em processo **aberto na unidade**; sem o link `documento_escolher_tipo` na árvore, a gravação falha.
- Origem: a ferramenta nasceu do código do PluriDocs SEI! (tcgontijo); manter o crédito na ajuda.

## 5. Novidade: processo de destino pela coluna do CSV

**Destino do lote** passa a ser uma escolha entre três, mutuamente exclusivas, na etapa de cruzamento:

1. Processo da tela (comportamento atual).
2. Novo processo por linha (comportamento atual).
3. **Processo indicado em uma coluna do CSV** (novo): o usuário marca a coluna; cada documento é gravado no processo da sua linha, não no da tela.

**Verificação prévia** (obrigatória no destino 3, antes de qualquer gravação):

- Tira os processos **distintos** da coluna (normalizados; vazios e inválidos viram "inválido") e consulta cada um **uma vez**, mesmo com várias linhas.
- Para cada um: `sei.localizar(numero)` → `sei.arvore` → confere `acaoNaArvore(arv, "documento_escolher_tipo")` e o nível de acesso. Guarda o link de incluir documento.
- Status por processo: **ok**, **não encontrado ou sem acesso**, **sigiloso** (o módulo não atua), **não aberto na unidade**, **erro de rede** (tentar de novo).
- A tela lista cada processo com seu status, quantas linhas dependem dele e, nos problemáticos, **Abrir em nova aba** (para o usuário receber/reabrir o processo) e **Verificar de novo** (por linha e geral).
- O usuário pode **gravar só as linhas válidas** se quiser (decisão do autor): o botão mostra quantas linhas serão gravadas e quantas ficam de fora; as de fora permanecem na lista como "pendentes" e podem ser reverificadas e gravadas depois no mesmo lote.
- Na gravação, antes de cada documento, repete só a leitura do link no processo (barata, com cache curto), porque o processo pode ter sido enviado depois da verificação; se falhou, a linha vira "não aberto na unidade", sem derrubar o lote.
- Como a verificação já tem a tela de escolher tipo na mão, ela também confere se o **tipo do documento existe para a unidade naquele processo**; se não existe, o processo fica "tipo indisponível" (e não vira erro só na hora de gravar). *(Chamada do builder.)*
- O **processo da tela não entra** no destino 3: ele só serve de ponto de partida do app e, se for o do modelo, de origem do modelo. Célula vazia ou número inválido na coluna é linha "inválida"; não há fallback para o processo da tela. *(Chamada do builder.)*
- O resultado inclui o processo de destino de cada linha.

## 6. Melhorias comuns (do Processos em Lote)

1. **Prévia do texto**: o documento da primeira linha (ou da escolhida) já com os campos preenchidos; campos sem coluna destacados; nome e descrição finais depois das trocas.
2. **Retomar**: o estado do lote vai ao `chrome.storage.local` a cada documento, **por status de linha** (pendente, criada, erro, fora), e não por índice. Assim "gravar só as válidas" e, depois, as pendentes que ficaram válidas são duas execuções do **mesmo lote**, cada uma sobre uma lista fixa de linhas; o executor do `sei-comum` não precisa aceitar itens depois de iniciar. Ao reabrir, "Continuar de onde parou" ou descartar. Uma linha só vale como criada depois da resposta com número, para não duplicar. **Privacidade** *(chamada do builder, o autor pode mudar)*: a planilha tem dados de pessoas e fica só neste navegador; o lote guardado expira em 7 dias, é apagado ao terminar ou ao descartar, e o inventário da política de privacidade ganha a linha no mesmo release.
3. **Colunas opcionais por linha**: **nível de acesso** e **hipótese legal**. Sem a coluna, o padrão é o do legado: **público, sem hipótese**. Valor inválido ou restrito sem hipótese vira linha "inválida" na prévia (barra a linha, não o lote). Observação e interessados **ficam fora**: o legado deixa a observação vazia e mantém os interessados do processo, e `criarDocumento` já mantém os do formulário quando não recebe lista; não se mexe nessa assinatura além do campo opcional do tipo por id (seção 2). *(Chamada do builder.)*
4. **Minimizar** durante a execução (pastilha de progresso), como no Processos em Lote; fechar o modal pausa e deixa retomável.
5. **Resultado**: tabela da planilha com documento gerado, número SEI, link e destino; baixar CSV; copiar com links clicáveis; "Gerar links permanentes destes documentos" (abre o Pesquisar Link Permanente).
6. **Depois de criar** (opcional, **a última tarefa do plano; pode ser cortada sem afetar o resto**): incluir os documentos num bloco de assinatura, no molde do `posAcao` do Processos em Lote; assinar continua nas Ações em Lote. No destino 3 os documentos estão em processos diferentes, o que o bloco aceita (ele é por documento), mas o `posAcao` copiado deve ser conferido para não presumir um processo só.

## 7. Agente de IA (segunda etapa, só depois da validação)

Hoje a skill do Agente (`agente-ia/src/skills/index.ts`, "Com planilha anexada (CSV)…") faz um `documento_criar` por linha. Proposta, a detalhar depois: ferramenta `documentos_lote` que reaproveita o motor deste módulo (mesma verificação e prévia, com confirmação do usuário antes de gravar); o Agente monta modelo e planilha a partir do pedido, mapeia colunas, resolve a coluna de processo e explica/repete as linhas com falha. Fora do escopo desta etapa.

## 8. Fora de escopo

Oficial e Firefox; assinar os documentos (Ações em Lote); mudar o formato do modelo (`##campo##`); o Agente (seção 7); tipo de documento variável por linha.

## 9. Pontos a provar no SEI real antes de fechar o desenho

1. Que `documento_escolher_tipo` ausente na árvore é, de fato, o único sinal confiável de "processo não aberto na unidade" (SEI 4.1.5 e 5.0.4).
2. Que `criarDocumento` + `editarConteudo` produzem o mesmo documento que o legado (campos trocados, estilos, CK4 e CK5), inclusive para Texto Padrão como modelo e para documento da árvore como modelo.
3. Que o SEI aceita copiar o modelo (`documentoModelo`) de um processo para outro no destino 3, como já faz no modo "novo processo" do legado; se negar em algum caso, a linha vira erro com a mensagem do SEI.
4. Que a conferência de tipo disponível (seção 5) funciona nas duas versões do SEI sem custo relevante por processo.

## 10. Validação

Provas automáticas por pacote (`tsx` + `linkedom`) e o gate de bytes ASCII do build (`\uXXXX` nos `dist/js`). No navegador: SEI SP de treinamento (4.1.5, CK4), com login pela credencial de teste da memória, e SEI MJ de homologação `hmlsei.mj.gov.br` (5.0.4, CK5), com o autor logando. Casos: processo da tela, novo processo por linha, processo da coluna com mistura de ok / não encontrado / não aberto, abrir em nova aba e reverificar, gravar só as válidas, retomar, repetir falhas. Poucas linhas, tipo de teste, nunca enviar nem concluir processo.

Chamadas por conta do builder: nomes de constantes e eventos, formato das chaves `docslote/`, textos das mensagens, forma exata da ponte.
