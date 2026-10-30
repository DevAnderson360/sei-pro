# Ordem e visibilidade dos painéis — plano de implementação

> **For agentic workers:** executar tarefa a tarefa (TDD: teste que falha, implementação mínima, teste que passa, commit).

**Goal:** o usuário ordena e oculta os painéis do Controle de Processos por um modal, com a escolha sincronizada e aplicada ao vivo.

**Architecture:** módulo `ordem-paineis/` (script de conteúdo isolado). Lógica pura em `modelo.ts`; DOM em `paineis.ts`; modal em `modal.ts`; orquestração e armazenamento em `controle.ts`/`main.ts`. A ordem é aplicada por CSS `order` num contêiner flex, sem mover nós.

**Tech Stack:** TypeScript, esbuild (iife, ASCII), tsx + linkedom nos testes, `chrome.storage.sync`.

**Spec:** `docs/superpowers/specs/2026-10-09-ordem-paineis-design.md`

## Global Constraints

- Bundle em `dist/js/init_ordem_paineis.js` com 0 bytes não ASCII (`charset: 'ascii'`).
- Em `dist/js/*.js` editados à mão, acentos só como `\uXXXX`.
- Chave de sincronização: `spro_paineis`, valor `{ v: 1, ordem: string[], ocultos: string[] }`.
- O painel `processosSEIPro` nunca pode ser ocultado.
- Sem personalização salva, a tela fica idêntica à de hoje (nenhuma classe, nenhum `order`).
- Nenhum nó de painel é movido no DOM ao reordenar (iframes não recarregam).
- Texto de interface em português do Brasil.

## Review Focus

- Painel que entra depois da reconciliação (módulos montam em tempos diferentes) cai no lugar certo.
- Id salvo que não existe mais/ainda na página não quebra e é preservado ao salvar.
- Dados corrompidos no sync (não-objeto, ids duplicados, tipos errados) são ignorados sem erro.
- Ocultar tudo que dá: o Controle de Processos continua visível; a lista continua mostrando os ocultos para reexibir.
- Duas abas: salvar numa reaplica na outra, sem laço de gravação.
- Reconciliar não gera mutações em laço (observador desconectado durante a própria escrita).

## Tarefas

### Task 1: Modelo puro (`ordem-paineis/src/modelo.ts`)
Produz: `CHAVE`, `PROTEGIDOS`, `type Config`, `normalizar(raw): Config`, `ordenar(presentes, cfg): string[]`,
`salvarConfig(anterior, mostrados, ocultos): Config`, `deLegado(optionsProJson: string | null): Config | null`,
`mover(lista, de, para): string[]`, `nomeConhecido(id): string | null`.
- [ ] Teste: normalizar (lixo, duplicados, tipos), ordenar (salva primeiro, resto no natural, ausentes ignorados), salvarConfig (preserva ausentes, tira protegido de ocultos), deLegado (ordena por index), mover.
- [ ] Implementar, rodar, commit.

### Task 2: Aplicação no DOM (`src/paineis.ts`)
Consome: Task 1. Produz: `listarPaineis(doc): Painel[]` (`{id, nome, el, oculto}`), `aplicar(doc, cfg): void`, `ESTILO` (CSS).
- [ ] Teste: sem cfg nada muda; com cfg põe classe, `order`, `data-order`, `data-spro-oculto`; limpar remove tudo; idempotente; painel protegido não oculta; painel fora da cfg vai ao fim.
- [ ] Implementar, commit.

### Task 3: Modal (`src/modal.ts`, `src/style.css`)
Consome: Tasks 1-2. Produz: `abrirModal(doc, painéis, cfg, aoSalvar): { fechar(): void }`.
- [ ] Teste: lista na ordem; subir/descer; arrastar (eventos `dragstart/dragover/drop`); caixa "Mostrar" (protegido sem caixa); Restaurar padrão; Salvar chama `aoSalvar(cfg)`; Cancelar/Esc não grava.
- [ ] Implementar, commit.

### Task 4: Orquestração (`src/controle.ts`, `src/botao.ts`, `src/main.ts`)
Consome: Tasks 1-3. Produz: `iniciar(doc, deps)` com `configurar(cfg)`, `encerrar()`.
- [ ] Teste: aplica a cfg lida; painel que entra depois é reconciliado; `onChanged` reaplica; botão só com 2+ painéis e idempotente; sem laço de mutações; encerrar limpa.
- [ ] Implementar `main.ts` (só `acao=procedimento_controlar`, ponto de partida pelo legado), build, commit.

### Task 5: Integração (manifestos, legado, docs)
- [ ] `dist/manifest.json` (+ `manifest_seipro.json` fora do git) com `js/init_ordem_paineis.js`.
- [ ] `setSortDivPanel` vira no-op; linhas "Ordenar painéis" de Atividades/Projetos apontam para o botão.
- [ ] `pages/ORDEMPAINEIS.md`.
- [ ] Commit.

### Task 6: Verificação no navegador (SEI SP e MJ)
- [ ] Reordenar, ocultar, restaurar; recarregar; iframe não recarrega; sync gravado; duas abas; claro/escuro; sem personalização = tela idêntica.
