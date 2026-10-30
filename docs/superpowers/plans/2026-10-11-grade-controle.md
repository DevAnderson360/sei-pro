# Grade do Controle de Processos — plano de implementação

Spec: `docs/superpowers/specs/2026-10-11-grade-controle-design.md`. Branch `feat/grade-controle`. Execução inline,
fase a fase; cada fase termina com `npm run verificar` verde e um commit.

## Fase 0 — Esqueleto do módulo
- [ ] `grade-controle/` com `package.json`, `tsconfig.json`, `build.mjs`, `src/css.d.ts`; `node_modules` reaproveitado.
- [ ] `tests/verificar.ts` com o helper `teste()` e cópia das fixtures reais (`tests/fixtures/sei41`).

## Fase 1 — Modelo e leitura (sem UI)
- [ ] `modelo/tipos.ts`, `leitura/linha.ts`, `leitura/tabela.ts` (resumida + detalhada por cabeçalho), `leitura/barra.ts`.
- [ ] Testes contra `caixa_prazos.html`, `caixa_concluido.html`, `caixa_sem_prazo_nativo.html` e uma detalhada sintética.

## Fase 2 — Regras puras
- [ ] `modelo/busca.ts` (parser + avaliação), `filtro.ts`, `ordem.ts`, `grupos.ts`, `idade.ts`, `visoes.ts`, `quadro.ts`, `exportar.ts`.
- [ ] Testes: operadores, negação, aspas, `prazo:<7d`, `resp:eu/sem`, ordem estável multi-critério, grupos com N marcadores, visões, CSV com injeção de fórmula.

## Fase 3 — Páginas e ações
- [ ] `paginas/carregar.ts` (progressivo, cancelável, volta à página 0), `acoes/selecao.ts`, `acoes/barra.ts`, `acoes/mover.ts`.
- [ ] Testes com `Http` falso e núcleo falso (sucesso, recusa, desfazer, falha no meio da paginação).

## Fase 4 — Ativação sem piscar
- [ ] `ativacao/inicio.ts` (bandeira, CSS de ocultar, esqueleto, fallback), `ativacao/botao.ts`, `persistencia/armazem.ts`.
- [ ] Testes: atributo/CSS, remoção do esqueleto, fallback por erro e por prazo, botão alternador.

## Fase 5 — Interface
- [ ] `ui/app.ts` (Shadow DOM, estado, laço de render), `tabela.ts` (virtualizada), `ferramentas.ts` (busca com chips, agrupar, ordenar, visões),
  `quadro.ts`, `lote.ts`, `colunas.ts`, `atalhos.ts`, `style.css`.
- [ ] Testes de UI no linkedom (render, busca → lista, agrupar, selecionar espelha o nativo, lote repassa o clique).

## Fase 6 — Integração
- [ ] `main.ts` + bundle `dist/js/init_grade_controle.js`; entrada no `dist/manifest.json` (`document_start`).
- [ ] Opção `gradecontrole` em `opcoes-pagina/src/schema-dados.ts` e ajuda; gate do legado (`data-spro-grade`).
- [ ] `pages/HISTORICO.md` (próxima versão) e texto de ajuda.

## Fase 7 — Prova em navegador
- [ ] Servir a fixture, injetar o bundle com `chrome` simulado, capturas (esqueleto → grade), interações, escuro, estreito, 3 000 linhas.
- [ ] Revisão independente do diff (`code-review`) e correções.
- [ ] Relatório final: o que está provado, o que depende de SEI real.
