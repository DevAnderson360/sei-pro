# Notas do controlador para a ligação (T12 e T13) — vindas das tarefas 4 a 11

São requisitos: o brief de cada tarefa foi escrito antes destas decisões. Cada item com prova.

## T12 (colaboração no app)
1. **Mudar "Quem vê" de "Toda a unidade" para "Só eu"** (`app.ts` `salvarProjeto`): validar antes (`problemasDoProjeto`), MOVER
   primeiro e editar no destino "Só eu" — nada de "Entendi" à toa ao sair da unidade. (Hoje `editarProjeto` na origem roda
   antes de mover e, com o Proxy da T7, pediria o "Entendi".)
2. **`consentidor`** (`colaboracao/consentir.ts:77,81`): falha do `storage.sync` ao ler/gravar o consentimento vira mensagem
   própria ("Não foi possível guardar a sua confirmação. Tente de novo.") — não a de cota do `storage.local`.
3. **`estado.ts:70-72`**: envolver os retornos de `aguardandoPermissao` e "nunca" em `com(...)` (hoje relógio atrasado +
   esperando "Entendi" dá rótulo "erro" sem explicação). **`estado.ts:159-170`**: registrar os ouvintes ANTES do primeiro
   `ler()` no `iniciar()`.
4. Usar `NomesDoHistorico.alvo` que acha também lápides dos dois escopos e o projeto pelo id (T9).
5. Renomear/excluir modelo e receber projeto no escopo da unidade passam pelo repositório com "Entendi" (Proxy da T7).

## T13 (ligar no app e no content script; dist)
6. **Sincronia da aba** (`pagina/sincronia.ts`, T5): passar `travarEsperando`; `.catch` no `iniciar` (rejeição do
   `storage.sync` ao ler consentimento); isolar os dois textos — um que falha não derruba o outro (`iniciar` em série e
   `agora()` perdendo o status da unidade, `sincronia.ts:87-102`); derivar `host/login/unidade.id` de `repos[vis].escopo` ou
   conferir no construtor.
7. **Erros de memória do sigilo ilegível** (`ErroMemoriaSigilo`): `limpar` e "Quem vê" ao abrir o app lançam — tratar sem
   derrubar o app (aviso curto). Arquivo e cópia do dia mostram o texto do `ErroMemoriaSigilo`; ao abrir o diálogo
   Sincronização, tentar a cópia do dia de novo.
8. **Diálogo Sincronização** (T8): `copias.restaurar` → contagem por tipo; `copias.falhaDoDia?()`; `pessoal.apagar` →
   boolean; `exportar/importar` → frase; `aoMudar: (f) => provedor.aoMudar(() => f(provedor.situacao()))` sem reler;
   passar funções flecha em `arquivo` (`acao(() => a.reconectar())`); em `montarSincronizacao` declarar `let sair` antes do
   `aoMudar` (TDZ se o provedor disparar síncrono).
9. **Importar manual (arquivo de tudo)**: testar `versaoMaisNova` antes de `lerEnvelopeArquivo` ("arquivo de versão mais
   nova"); conferir `File.size` antes de `text()` (vale também para receber projeto).
10. **Enviar projeto** (T10): `await arquivoDoProjeto(repos[p.vis], id)` com `avisar(mensagemDoErro(e))`; nunca
    `exportarTudo` nem `paraOTexto` puro. **Receber**: passar por `lerArquivoDoProjeto`; repositório da unidade com "Entendi".
11. **Content script**: monta o armazém de Texto Padrão só com `{ http, linkMenu }` (`SeiDoTexto`, T2) — a classe `Sei` não
    entra (o portão do build recusa código de árvore). Rodar o portão.
12. Pacote oficial (P6, não agora): a receita que gera `manifest_seipro.json` tem de tirar `js/init_projetos.js` e as 3
    entradas WAR do Projetos.

## Leva da revisão final da P4 (não fazer na T12/T13; registrado aqui para não perder)
- T4: campo de documento colado ("Despacho 12 (1234567)" → "12"; "(1234567)"/"1234567," recusados); `conferirEtapa` aplicar
  `RE_DOCUMENTO`; prova da borda do teto + frase da cascata em `memoriaSigilo.ts`.
- T5: provas de `intervaloPuxar`/`releituras`/`lerNoRecuo`, `idProcedimento`, sigilo no texto pessoal.
- T9: `aria-describedby` nos botões repetidos de Modelos/Arquivados; NaN no diálogo da etapa com carimbo forjado.
- T7: faixa "aguardando" com `role=status` (opcional); `textoDoErro` "indisponível" para quem só consulta (sei-comum).

## Da T11 (importar do Atividades)
13. **T13:** passar o login do SEI a `projetosDoAtividades` (sem ele a chave de outro usuário não é conferida); usar
    `colaboracao.repos` (unidade pelo Proxy do "Entendi"), `legadosImportados` e `mensagemDaImportacao`.
14. **P6 ao vivo:** CORS do `fetch` do content script ao servidor do Atividades e `credentials: "omit"`.
15. **T13 (T11 Minor 5):** no importar do Atividades, pedir o "Entendi" (ou puxar) ANTES de montar o lote.
16. **T13 (T11):** o diálogo de importar recebe `excluidos` (dos dois escopos, com lápides) e `cortados`; `login` é obrigatório em `projetosDoAtividades`.
17. **T13 (T12):** `DepsColaboracao.escolherArquivo` devolve `File` — passe `escolherArquivoLocal()` (criado na T12), não o `escolherArquivo()` do sei-comum. Os itens 7–10 e 13 já têm a parte de app feita na T12 (confira em `task-12-report.md`).
