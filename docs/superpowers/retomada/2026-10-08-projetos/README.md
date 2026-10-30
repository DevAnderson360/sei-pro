# Retomada — gestor de Projetos em TypeScript (branch `feat/projetos-ts`)

Documento para continuar o trabalho numa sessão nova (nuvem ou local), sem o histórico da conversa
original. Leia inteiro antes de agir. Tudo em português do Brasil.

## 1. Onde parou (09/10/2026)

- Branch `feat/projetos-ts`, já com o `origin/master` (2.6) mesclado (merge `0937081`). Sem push, sem merge no master, sem release.
- Spec: `docs/superpowers/specs/2026-10-06-projetos-design.md` + telas aprovadas em
  `docs/superpowers/specs/2026-10-06-projetos-telas/` (painel, formularios, integracao).
- Plano-mestre: `docs/superpowers/plans/2026-10-06-projetos-00-mapa.md`; planos das fases P1 a P5 na mesma pasta.
- Fases:
  - P1 a P4: **concluídas**, cada uma com revisão final e leva de correção.
  - P5 (painel lateral, caixa, árvore, Agente): **fechada em 09/10/2026** com uma leva MÍNIMA (commit `ae6e892`):
    o Important (shell troca de aba só na própria janela) e os Minors 2 (`lerContexto` sem serializar a página) e 4
    (`ligarCaixa` isolada). **Não houve re-revisão** (decisão do autor: sem revisores); o resto virou pendência, na lista
    da seção 2 abaixo, para a P6 ou uma leva posterior. Roteiro de teste manual: `roteiro-teste.md`.
  - P6 (validação ao vivo e revisão final da branch): **não começou** (seção 3); o roteiro de teste à mão no SEI SP
    4.1.5 é o primeiro passo.
- Suítes no HEAD (todas 0 falha): projetos 2582, sei-comum 502, sei-nucleo 136, favoritos 607, historico 485,
  agente-ia 1138, anotacoes-controle 29.
- Correção dos Favoritos já publicados (tradução `newValue`/`oldValue` + troca de aba por janela) preparada à parte na
  branch local `fix/area-chrome-novo-antigo` (a partir do `origin/master`).

## 2. Pendências da P5 (a leva mínima já fez o Important e os Minors 2 e 4; o resto segue aberto)

Fonte: fim de `ledgers/ledger-p5-integracao.md` (linha "P5 final review" e as linhas `parked`/"leva final").

**Important** — FEITO em `ae6e892` (background grava `{aba, janela, t}`; shell segue só a própria janela; clique do shell numa chave por janela)
1. A correção do `areaChrome` (P5 T5) fez o shell do painel lateral trocar de aba em TODAS as janelas:
   `painelAba` vive no `storage.session`, que é um só para a extensão. Corrigir: o background
   (`dist/background.js`, JS legado, editar à mão sem acento) grava `{ aba, janela: sender.tab.windowId }`; o shell
   (`sei-comum/src/painel/shell.ts:120-123`) só segue a própria janela (`chrome.windows.getCurrent()`, como o
   `iniciarLateral` já faz); o clique do próprio shell grava numa chave por janela. Prova com duas janelas.

**Minors da revisão final**
2. FEITO em `ae6e892` (a `versao` do SEI no contexto fica "", sem uso). `projetos/src/pagina/contexto.ts:12`: `lerContexto(paginaDe(doc))` serializa a página inteira (`outerHTML`) em toda
   janela de topo — passar `{ url, status: 200, html: "", doc }` como o carregador faz; `armazemNaTela`
   (`pagina/armazem.ts:22`) olha só o menu.
3. `pagina/caixa.ts:135-160`: o `pintar` relê todas as linhas a cada mutação — sair cedo sem vínculos e sem sigiloso
   pendente (ou tratar só as linhas acrescentadas).
4. FEITO em `ae6e892` (sem teste: o `principal.ts` não roda fora do Chrome). `pagina/principal.ts:123-125`: isolar `ligarCaixa` com `try` (ou ligar o lateral antes) para uma exceção não deixar a
   aba sem o lado do lateral.
5. `repositorio.ts:832-860` `marcarSigilosos`: reler as chaves logo antes de gravar (não desfazer edição concorrente).
6. `pagina/lateral.ts:48` e `sei-comum/src/ponte/lateral.ts:179-185`: aba órfã depois de atualizar a extensão —
   `try` em volta do `area.obter` ou `parar()` quando `chrome.runtime?.id` some (junto com o item T11(1) abaixo).
7. `favoritos/src/shell/painel.ts:89`: com a opção "Gerenciar Projetos" desligada, esconder a aba Projetos / zerar o
   contador.
8. `sei-comum/tests/chromeFalso.ts:48`: o falso não deve avisar no `set` quando o valor não muda (o Chrome não avisa).
9. (decisão de produto, registrar para a P6) ícone da árvore em toda tela mesmo sem projeto.

**Guardados das tarefas da P5 (fazer na mesma leva)**
- T1: aplicar `semVinculoVazio` também na LEITURA (`entidadesDe`) — dado gravado antes de `906bcd4`.
- T3: `app/lateral/agenda.ts:61` `quando()` com `fim` null lança no `localeCompare`; filtrar etapas com fim fora da
  faixa antes de `alertasDasEtapas`.
- T4: (1) sincronia calma no lateral: ícone próprio para "local" + texto em span visualmente oculto; (2) data null no
  balão (`formatarData(null)`) e data torta no contador da aba — prova de data torta no lateral; (3) escopo do cartão no
  nome acessível; (4) provas: preferência gravada de "Projetos"; foco no balão reaberto no lateral.
  Ruling: navegação implícita (Ver no projeto, foco vindo da caixa/árvore, novo projeto) NÃO grava `modoLateral`.
- T7: (2) número só em registro fica no texto até 5 min — avisar a sincronia depois da marca; (7) gesto perdido no
  "Abrir no painel" se o painel ainda monta (raro).
- T9: bidi misto pela classe do conector (ES/CS/ET) com letra RTL no campo (Minor); custo ~1,9 µs/caractere (linear).
- T10: setas esquerda/direita + tabindex roving no tablist das abas.
- T11: (1) `chrome.runtime?.id` antes do `import()` do balão + aviso "recarregue a página"; (3) prova que amarra os
  `matches` do WAR aos do content script; (4) ajuda: desinstalar apaga projetos e cópias diárias.

Os itens 3, 5, 6, 7, 8 e 9 e todos os "Guardados" acima seguem ABERTOS. O ledger registra "P5 CLOSED (leva mínima)".

## 3. Depois: P6 — validação ao vivo e revisão final da branch

**Recomendado rodar LOCALMENTE** (a nuvem não tem Chrome com extensão, não alcança os SEIs de teste sem liberar
rede, e o login é manual). Ambientes de TESTE (nunca produção):
- SEI SP de treinamento (4.1.5, CK4): `https://treinamento.sei.sp.gov.br/sei/` — credenciais estão na memória local do
  autor (não neste repositório).
- SEI MJ de homologação (5.0.4, CK5): `https://hmlsei.mj.gov.br/...` — **`sei.mj.gov.br` é PRODUÇÃO, nunca usar.**
Harness que funciona: Chrome for Testing + puppeteer-core com `enableExtensions:true` e
`browser.installExtension(dist)`; prova E2E da divisão do content script em
`.superpowers/sdd/2026-10-06-projetos-p5-integracao/e2e-t11.mjs` (só existe na máquina do autor).
O que conferir: lista em `ledgers/notas-fases.md` (seções "P6", "Do escritor do plano P5", "Da P4 executada",
"RECEITA DO PACOTE OFICIAL"). Ao terminar: apagar os Textos Padrão e projetos de teste criados; revisão final da
branch inteira (subagente no modelo mais capaz); NÃO fazer merge/push/release — perguntar ao autor.

## 4. Como trabalhar (o processo usado nas fases 1 a 5)

Sem o plugin "superpowers" na nuvem, siga o mesmo processo à mão:
- Um **implementador** (subagente) por item ou grupo de itens, com um arquivo de requisitos
  (`.superpowers/sdd/<fase>/...findings.md`) e um relatório; ele faz TDD com RED real, roda os portões e comita.
- Um **revisor** (subagente, somente leitura) por entrega, sobre um pacote de diff gerado por `tools/pacote.sh BASE HEAD
  SAIDA`; correções voltam ao mesmo implementador (até 3 rodadas; 4ª e 5ª com implementador novo); depois uma
  re-revisão de escopo restrito.
- **Ledger** em `.superpowers/sdd/2026-10-06-projetos-p5-integracao/progress.md` (crie a pasta a partir de
  `ledgers/ledger-p5-integracao.md`): uma linha por evento; decisões no formato
  `Ruling: <o que decidiu> — <por quê> — <custo se errado>`.
- O próprio controlador confere as suítes antes de fechar cada etapa.

## 5. Preparação do ambiente

```bash
# 1) a pasta de trabalho local (gitignorada) a partir deste pacote
mkdir -p .superpowers/sdd/2026-10-06-projetos-p5-integracao tools
cp docs/superpowers/retomada/2026-10-08-projetos/ledgers/ledger-p5-integracao.md .superpowers/sdd/2026-10-06-projetos-p5-integracao/progress.md
cp docs/superpowers/retomada/2026-10-08-projetos/ledgers/notas-fases.md .superpowers/sdd/notas-fases.md
cp docs/superpowers/retomada/2026-10-08-projetos/tools/*.mjs tools/
cp docs/superpowers/retomada/2026-10-08-projetos/tools/pacote.sh .superpowers/sdd/pacote.sh
# 2) dependências
for p in sei-comum sei-nucleo projetos favoritos historico agente-ia ferramentas-pdf; do (cd $p && npm ci || npm install); done
# 3) conferir a base (todas 0 falha)
for p in projetos sei-comum sei-nucleo favoritos historico agente-ia; do (cd $p && npx tsx tests/verificar.ts | tail -1); done
```

Portões por pacote tocado: `npx tsc --noEmit` (no projetos: `npm run tipos`, dois tsconfig), `npx biome check src
tests` (projetos, sei-comum, favoritos), `node build.mjs` (portões de ASCII, DOM seguro e "content script sem busca de
árvore/atribuição"); na raiz `node tools/check-dom-injection.mjs` e `node tools/patch-manifests.mjs --check`.

## 6. Regras do projeto (a memória local do autor não existe na nuvem)

- Conversar sempre em **português do Brasil**.
- **Nunca buscar a árvore de processo** (`arvore_montar`, `procedimento_visualizar`, `procedimento_atribuicao_cadastrar`):
  isso grava "Processo recebido" em nome do usuário. Na árvore, só ler a página que o frame já tem
  (`pagina/arvore.ts`).
- **Nunca montar URL do SEI**; ir ao Controle de Processos só pelo link do menu (`linkDoMenu`).
- **Processo sigiloso**: o número (e o do documento) nunca vai ao Texto Padrão nem ao Agente; regra única em
  `projetos/src/modelo/sigilo.ts` + memória local `memoriaSigilo.ts` (falha fechada) — reutilize, não reescreva.
- Git: só a branch `feat/projetos-ts`; **nunca `git add -A`** (caminhos explícitos); título de commit sem acento e
  mensagem terminando com `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`; push/merge/release só com o autor.
- Bundles em `dist/js` só ASCII. As ferramentas Write/Edit convertem `\uXXXX` em caractere cru — conferir com
  `git diff`; contar bytes > 0x7f com perl/python (`perl -ne '$c+=()=/[\x80-\xff]/g; END{print $c+0}' arquivo`), o grep
  BSD dá zero falso. Bytes legados aceitos: `dist/js/agente/painel.js` 53, `dist/js/init_agente.js` 4,
  `dist/background.js` 14 — nenhum novo.
- DOM seguro: só `h()`/`textContent`; proibido `innerHTML`/`insertAdjacentHTML`/`on*` em string.
- Manifest: só `dist/manifest.json` (Lab) tem o Projetos; não acrescentar permissão sem o autor.

## 7. O que entregar ao autor no fim (resultado final)

- Resumo do que ficou pronto e como ligar ("Gerenciar Projetos" ligado nas opções).
- **Rulings** de todas as fases (linhas `Ruling` dos cinco ledgers + os novos), com o custo se errados.
- Avisos que dependem dele:
  1. **Defeito no master** (já publicado): `sei-comum/src/armazenamento/area.ts` `areaChrome` não traduzia
     `newValue`/`oldValue` para `novo`/`antigo` — selo das abas do painel, troca de aba ao vivo e progresso do
     "Atualizar" dos Favoritos não funcionavam; corrigido nesta branch (commit `f2bcb0d`), vale levar ao master.
  2. O `caixa_listar` do Agente (já publicado) manda ao modelo o número dos processos sigilosos da caixa
     (`agente-ia/src/ponte/operacoes.ts:306`).
  3. O lateral dos Favoritos publicado desmonta a cada navegação (`favoritos/src/app/main.ts:133-140`); o dos Projetos
     ganhou uma carência — vale aplicar o mesmo lá.
  4. **Receita do pacote oficial e de todo manifest gerado do Lab** (oficial MV3, `manifest_seipro_v2.json`,
     `manifest_v2.json`, whitelabels): tirar `js/init_projetos.js` e as 6 entradas WAR do Projetos; NÃO tirar
     `js/sei-pro-projetos.js` (é o legado).
- Branch local/publicada sem merge; perguntar como integrar.

## 8. Arquivos deste pacote

- `ledgers/ledger-p1-comum.md` … `ledger-p5-integracao.md`: os ledgers completos (a pasta original
  `.superpowers/sdd/` é gitignorada).
- `ledgers/notas-fases.md`: pendências que atravessam fases, inclusive a lista da P6 e a receita do oficial.
- `ledgers/notas-p4-t12-t13.md`: notas da ligação na P4 (histórico).
- `tools/check-dom-injection.mjs`, `tools/patch-manifests.mjs`: portões (gitignorados em `tools/` na raiz).
- `tools/pacote.sh`: gera o pacote de diff para os revisores.
