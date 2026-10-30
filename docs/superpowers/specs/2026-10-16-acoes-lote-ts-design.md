# Ações em Lote da árvore (reformulação em TypeScript) — especificação de desenho

Data: 16/10/2026. A partir do master (e75dc26), em worktree própria (`../sei-pro-acoes-lote`, branch `feat/acoes-lote-ts`), porque outra sessão trabalha no mesmo clone.
Aprovado pelo autor em conversa: refatorar o "Iniciar ações em lote" (que passa a se chamar só **"Ações em Lote"**) para a stack TypeScript dos Projetos, Demandas, Favoritos e Processos em Lote, **com todas as melhorias levantadas na análise** ("acrescente tudo"), e validar no SEI SP e no SEI MJ com o autor logando.

## 1. Objetivo

Levar as Ações em Lote (botão `#iconBatchActions` da barra da árvore e item "Ações em lote" do menu flash), hoje cerca de 1.250 linhas de jQuery em `dist/js/sei-functions-pro.js:9318-10215` e auxiliares, para um pacote TypeScript novo, `acoes-lote/`, no molde do `processos-lote/`. O pacote tem content script, modal iframe sobre o SEI e um app numa página da extensão. Tema claro e escuro, DOM seguro (`h()`), modal sem botão Cancelar (o X e o Esc fecham), tokens `--spro-*`, tudo em português.

Critério de sucesso: paridade com as 7 ações do legado (com uma exceção deliberada: sigiloso, ver seção 5), mais as melhorias da seção 6, validadas no SEI SP (4.1.5, CK4) e no SEI MJ de homologação (5.0.4, CK5).

## 2. Decisões

| Tema | Decisão |
|---|---|
| Pacote | Novo `acoes-lote/` (alias `@al/*`), com o mesmo esqueleto, build, biome e provas do `processos-lote/`. O que for genérico sobe para o `sei-comum`. O que fala com o SEI fica no `sei-nucleo`, estendido quando faltar. |
| Lançamento | Só o `dist/manifest.json` (Lab MV3, Chrome/Edge). O oficial e o Firefox seguem com o legado intacto, como nas migrações anteriores. |
| Legado | Cede pelo atributo `data-seipro-acoes-lote` no `<html>`. `getDocumentosActions()` confere o atributo e, se ele existir, só dispara `spro-acoes-lote-abrir` e retorna. O botão vive dentro do iframe da árvore e chama `parent.getDocumentosActions()`; o modal abre na janela de cima, como hoje. O código antigo fica no lugar para os manifests sem o módulo novo. |
| Opção | `acoesemlote` continua sendo a chave que liga o botão e o item do menu. O `checkHostLimit()` continua valendo. |
| Escopo de documentos | Os documentos do processo aberto na árvore, com todas as pastas, lidos por `abrirArvore` do `sei-nucleo` e não pelo DOM da árvore. |
| Armazenamento | `chrome.storage.local`, uma chave por entidade, sem sincronizar, prefixo `acoes-lote/`. A senha **nunca** é gravada. |
| Execução | O laço roda no app. Cada chamada ao SEI passa pela ponte RPC do content script da aba (a sessão do SEI está lá), como no Processos em Lote. Concorrência 1 para escrita, 3 para leitura (prévia e download). Usa o `ExecutorLote` e o `RitmoAdaptativo` do `sei-comum`. |

Nome (decisão do autor): o recurso se chama **"Ações em Lote"** em todo lugar — título do modal, tooltip e `alt` do botão da árvore (hoje "Iniciar ações em lote", trocado também no legado, para todos os pacotes), página de ajuda e histórico.

## 3. Arquitetura

```
acoes-lote/
   ├─ src/modelo/   documentos (linha, elegibilidade por ação, motivos de "pulado"), filtros e seleção, fila de ações, prévia, persistência do lote
   ├─ src/sei/      adaptadores finos sobre o sei-nucleo; ações que o núcleo ainda não tem (duplicar, mover, download)
   ├─ src/pagina/   content script: marca, evento, modal (criarControleModal), executor RPC
   ├─ src/app/      app do modal: seleção, configuração das ações, prévia, execução, resultado
   ├─ estatico/, tests/ (tsx + linkedom, fixtures HTML reais do SEI 4.1.5 e 5.0.4)
sei-nucleo/  + o que faltar (seção 5), sempre com OpcoesEscrita { aplicar } e ResultadoEscrita
sei-comum/   reuso: modalIframe, lote/executor, ui/tabelaResultado, csv, dom, dialogo, combobox, opcoes/legadas
```

Build: `dist/js/init_acoes_lote.js` (IIFE), `dist/js/acoes-lote/app.js` (ESM), `dist/html/acoes-lote.html` e `dist/css/acoes-lote.css`. Content script e `web_accessible_resources` só no `dist/manifest.json`, com o gate de bytes ASCII do build.

## 4. Fatos do legado que não se perdem (não re-derivar)

- Elegibilidade: o legado decide quais documentos aceitam cada ação pelos ícones de ação de cada nó da árvore (`Nos[n].acoes`). O novo usa os links de ação colhidos da árvore e da página do documento pelo `sei-nucleo` (o link se colhe, nunca se monta). Documento sem o link da ação aparece como **pulado, com o motivo**, e não some em silêncio.
- **Cancelar assinatura** no legado é um GET em `editor_montar` de documento assinado, porque abrir o editor cancela as assinaturas. O `sei-nucleo` já tem `cancelarAssinatura`; usar esse e conferir no SEI real que ele não deixa uma sessão de editor aberta.
- **Assinatura**: o formulário (órgão, usuário, contexto, cargo) vem do formulário de assinatura do primeiro documento. A senha é digitada uma vez por lote.
- **Duplicar**: lê os dados do documento (`documento_consultar` / `documento_alterar`: assuntos, interessados, nível de acesso) e faz POST do formulário de inclusão com `rdoTextoInicial="D"` e `txtProtocoloDocumentoTextoBase=<nº SEI>` (`sei-pro-arvore.js:~764-960`). Só vale para documento interno.
- **Baixar**: documento externo pelo link `documento_download_anexo` do nó; interno pelo `documento_visualizar`, salvo como `.html`.
- **Alterar nível de acesso**: Público, Restrito ou Sigiloso, com hipótese legal. O legado permite marcar Sigiloso; o novo, por decisão do autor, não (seção 5).
- Diferenças de versão: nomes de ícones do SEI novo e do antigo; `ifrVisualizacao` aninhado no 4.1 (ver memória `project_bug_sei41_visualizador_aninhado`); no 3.x o submit era `btnSalvar`. O novo fica fora disso por ler HTML pelo núcleo, mas as fixtures têm que cobrir 4.1.5 e 5.0.4.
- Ids de documento: comparar o parâmetro `id_documento` exato, nunca por substring (o legado confundia 123 com 1234).

## 5. Ações (paridade e novas)

Toda ação de escrita tem prévia (`aplicar: false`) e execução (`aplicar: true`) pela mesma função, e devolve uma linha de resultado `ok | pulado | sem-acesso | erro`, com mensagem.

| # | Ação | Origem | No `sei-nucleo` |
|---|---|---|---|
| 1 | Dar ciência | legado | `darCiencia` (existe) |
| 2 | Excluir | legado | `excluirDocumento` (existe) |
| 3 | Cancelar assinatura | legado | `cancelarAssinatura` (existe) |
| 4 | Baixar | legado | download por documento (novo, em `acoes-lote/src/sei`) |
| 5 | Alterar nível de acesso (Público e Restrito) | legado | `alterarDocumento` (existe) |
| 6 | Assinar | legado | `assinarDocumento` (existe, com cargo e senha) |
| 7 | Duplicar | legado | novo: `duplicarDocumento` no núcleo |
| 8 | Cancelar documento, com motivo | nova | `cancelarDocumento` (existe) |
| 9 | Incluir em bloco de assinatura, existente ou novo | nova | `listarBlocosParaInclusao`, `incluirNoBloco`, `criarBloco` (existem, não exportados no `index.ts`; importar pelo caminho) |
| 10 | Alterar dados: descrição, interessados, assuntos, observação, nível e hipótese | nova | estender `alterarDocumento` com interessados, assuntos e observação (semântica abaixo) |
| 11 | Mover para outro processo | nova | novo: `moverDocumento` (ação `documento_mover` do SEI, que existe desde o 3.x) |
| 12 | Baixar tudo num ZIP ou num PDF único | nova | ZIP montado no app com o `fflate` (já usado nas `ferramentas-pdf`); PDF pelo "Gerar Arquivo PDF" nativo do SEI com os documentos selecionados |

Regras por ação:
- **Sigiloso fica totalmente de fora (decisão do autor).** Documento sigiloso e qualquer documento de processo sigiloso aparecem na tabela como **pulados, com o motivo** ("sigiloso: fora das ações em lote"), e nenhuma ação os toca. O nível Sigiloso não é oferecido em "alterar nível". O `sei-nucleo` não muda: a recusa que ele já faz é a regra. É uma perda deliberada de paridade com o legado, registrada na página de ajuda e no histórico. Em processo sigiloso, o modal abre e explica que as ações em lote não atuam ali.
- **Excluir, cancelar documento, cancelar assinatura e mover** pedem confirmação depois da prévia, com a contagem ("Excluir 7 documentos?").
- **Assinar**: a senha só existe na memória do app durante a execução, vai à aba pela ponte por item e é apagada ao terminar, cancelar ou fechar. O lote retomável guarda cargo e índice, nunca a senha: ao retomar, pede de novo. Erro de senha no primeiro item pausa o lote (`parar: true`), para não bloquear a conta tentando N vezes.
- **Mover**: destino informado por número de processo, resolvido e mostrado (tipo e especificação) antes de confirmar.
- **Alterar dados (decisão do autor)**: para interessados e assuntos, o usuário escolhe por campo **Acrescentar** (padrão), **Remover** ou **Substituir a lista**. Descrição e observação em branco significam manter o atual; preenchidas, substituem. A prévia mostra antes e depois de cada documento, e Substituir/Remover entram na confirmação com destaque, porque não há como desfazer.
- **Baixar ZIP**: nomes de arquivo `<nº SEI> - <título>`, sem caracteres inválidos; documento que falha fica marcado no relatório, sem derrubar o lote.
- **PDF único (decisão do autor)**: usa o "Gerar Arquivo PDF" nativo do SEI (`procedimento_gerar_pdf`), marcando no formulário do SEI os documentos selecionados; a conversão é do servidor, fiel e com texto pesquisável. O link se colhe da árvore. Documentos que o formulário do SEI não oferece aparecem como pulados. Conferir no 4.1.5 e no 5.0.4 o nome dos campos e como a resposta entrega o arquivo.

## 6. Melhorias da experiência

1. **Seleção inteligente.** Tabela com nº SEI, documento, tipo, unidade geradora, data, assinatura, nível de acesso e pasta/volume. Filtros por tipo, unidade, assinado/não assinado, nível de acesso, interno/externo e período. Atalhos: "Não assinados da minha unidade", "Assinados por mim", "Externos". Selecionar todos (só os visíveis), faixa com Shift e contador por ação ("Assinar (5)").
2. **Fila de ações (confirmada pelo autor para esta entrega).** O usuário escolhe uma ou mais ações, em ordem, para os mesmos documentos (ex.: alterar nível → incluir em bloco → assinar; assinar → dar ciência). O modelo do lote nasce com **etapas por documento**: cada documento passa pela fila inteira; uma falha numa etapa pula as seguintes daquele documento, com o motivo. A elegibilidade e a prévia consideram o efeito das etapas anteriores (ex.: assinar depois de alterar). A retomada guarda índice de documento e de etapa. O resultado tem uma linha por documento, com a situação de cada etapa. Combinações recusadas na configuração: excluir, cancelar documento ou mover seguidos de qualquer outra etapa; baixar/PDF são etapas finais. Uma ação só (o uso comum) é a fila de tamanho 1.
3. **Prévia por documento.** Antes de executar: o que vai acontecer em cada documento, quem será pulado e por quê, e as mudanças campo a campo (`ResultadoEscrita.mudancas`).
4. **Execução no padrão do Processos em Lote.** Pausar, continuar, cancelar; barra "x de n"; botão Minimizar (pastilha de progresso, o SEI fica usável); ritmo adaptativo; sessão expirada e captcha pausam o lote; item gravado como "incerto" antes do POST e nunca repetido sozinho.
5. **Retomar.** O lote em andamento vai para o `chrome.storage.local` a cada item. Ao reabrir no mesmo processo, oferece "Continuar de onde parou" ou descartar. Detecta lote rodando em outra aba.
6. **Resultado.** Tabela com situação por documento e etapa, copiar (texto e HTML com links), CSV e "Tentar de novo só as falhas". No fim, a árvore do processo é recarregada uma vez.
7. **Atalhos.** Esc fecha e Ctrl+Enter executa. A ação individual por linha (ícone da linha no legado) vira menu da linha, que pré-seleciona só aquele documento.

## 7. Defeitos do legado que deixam de existir

Lote sem cancelamento (fechar a janela não parava nada); `$.ajax` sem tratamento de falha travando o loop; sucesso presumido em resposta de erro do SEI; sigilo marcado como ok antes do submit; iframe oculto compartilhado com outros recursos derrubando o lote; senha em global e concatenada no HTML; `resetDocsActions` indefinida ao baixar documento interno; URL montada de um array; ids casados por prefixo; throttle de 1 s de `getDadosDoc` travando o duplicar. As provas automáticas cobrem cada um deles com um caso.

## 8. Compartilhado e documentação

Página de ajuda `pages/ACOESEMLOTE.md` no padrão das outras, linha no `pages/HISTORICO.md` no release (memória `feedback_release_historico`), e entrada no catálogo de funcionalidades se o recurso já constar dele.

## 9. Fora de escopo

Oficial e Firefox (etapa seguinte, como nos outros módulos); Documentos em Lote (`sei-pro-docs-lote.js`, outro recurso); ações em lote sobre processos (o Controle tem as suas); levar estas ações para o agente.

## 10. Validação

- **Provas automáticas** por pacote (`tsx` + `linkedom`), com fixtures reais do 4.1.5 e do 5.0.4 para árvore, formulário de assinatura, alterar, mover, duplicar e bloco. Mais o gate ASCII do build, `tsc --noEmit` e `biome check`.
- **No navegador**: SEI SP de treinamento (4.1.5, CK4) e SEI MJ de homologação `hmlsei.mj.gov.br` (5.0.4, CK5). Nunca `sei.mj.gov.br`, que é produção. O autor faz o login.
- **Massa de teste**: um processo de teste por SEI, com documentos criados para o teste. Ações destrutivas (excluir, cancelar, mover, cancelar assinatura) só nesses documentos. Nunca enviar nem concluir processo. Assinatura só com a senha digitada pelo autor.
- **Conferir**: abre pelo botão e pelo menu flash; os dois temas; Esc fecha e devolve o foco; cada ação no 4.1.5 e no 5.0.4; pausar, cancelar, retomar e repetir falhas; ZIP e PDF; o legado não carrega no Lab e segue funcionando nos manifests sem o módulo.

## 11. Chamadas do builder e pontos abertos

Do builder: nomes de constantes, eventos e chaves (prefixo `acoes-lote/`); texto das mensagens; layout das telas, seguindo o Processos em Lote; recarregar a árvore só quando necessário (o núcleo já tem cache por processo e `invalidar`); onde a etapa Duplicar grava o novo documento (mesmo processo, logo depois do original, como o legado).

Decididos pelo autor (16/10/2026): sigiloso fora; fila de ações já nesta entrega; PDF pelo recurso nativo do SEI; alterar dados com Acrescentar/Remover/Substituir por campo.
