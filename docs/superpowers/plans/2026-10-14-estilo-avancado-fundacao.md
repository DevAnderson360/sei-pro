# Estilo Avançado 2: fundação do tema Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (execução nativa, autorizada pelo usuário em 14/10/2026: "me mostre o resultado final apenas, depois de testado no SEI SP e SEI MJ"). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Entregar o Estilo Avançado 2 (opt-in, Lab MV3): tema por tokens com cor de barra personalizável, claro/escuro/automático e remapeamento de cores dos documentos no escuro.

**Architecture:** Núcleo puro em `sei-comum/src/tema/` (paleta OKLCH, config, tokens, adaptação de cor), testado com `tsx`. Pacote `estilo-avancado/` (padrão do Favoritos) gera o content script `init_estilo.js` (todos os frames, `document_start`) e a seção "Aparência" das opções. Config em `chrome.storage.sync` chave `spro_tema`, com espelho em `localStorage` para a primeira pintura.

**Tech Stack:** TypeScript 5.9, esbuild, tsx, linkedom, Biome; CSS com variáveis e `color-mix`/OKLCH.

**Spec:** `docs/superpowers/specs/2026-10-14-estilo-avancado-fundacao-design.md`

## Global Constraints

- Sem recurso externo (fontes, CDN, `@import`, `url(http`).
- Sem `innerHTML` com dados; `<style>` por `textContent`, atributos por `setAttribute`.
- JS em `dist/` só ASCII (`charset: "ascii"` e conferência byte a byte no build).
- Aplicar em `document_start`, sem flash branco.
- SEI 4.1.5 e 5.0.4; todos os frames; documento gravado nunca é alterado.
- Legado (`sei-slim.css`, `seiSlim`, `darkModePro`) intocado.
- Só `dist/manifest.json` (Lab MV3); `manifest_seipro*.json`, `manifest_v2.json` e whitelabels não mudam.
- Contraste mínimo 4,5:1 (texto/barra e destaque/fundo).
- Biome (`npm run checar`) e `tsc --noEmit` limpos; commits sem `git add -A`.

## Review Focus

- Cor de barra sem croma (cinza/preto/branco): contraste e destaque caem no azul padrão, sem NaN.
- `spro_tema` corrompido no storage (string, `null`, versão futura): cai no padrão, não lança.
- Documento com `bgcolor`/`<font color>`/`style` inline e fundo `transparent`/`inherit`: nada some nem fica ilegível.
- Salvar no editor com remapeamento ativo: o HTML gravado não carrega variáveis nem `data-spro-adaptado`.
- Alternar `ativo:false` em runtime: zero rastro no DOM e nos frames já abertos.

---

### Task 1: Paleta e contraste (`sei-comum/src/tema/paleta.ts`)

**Files:**
- Create: `sei-comum/src/tema/paleta.ts`, `sei-comum/tests/verificar-paleta.ts`
- Modify: `sei-comum/tests/verificar.ts` (registrar o teste)

**Interfaces:**
- Produces: `paraOklch(hex): {l,c,h}`, `deOklch({l,c,h}): string` (hex, gamut limitado), `contraste(a,b): number`, `derivarBarra(corBase, esquema: "claro"|"escuro"): {barra,texto,hover,borda,destaque}`, `PALETAS: readonly {id,nome,cor}[]`, `AZUL_PADRAO`.

- [ ] Escrever o teste: round-trip ≤ 1/255; 2.000 cores aleatórias (PRNG semeado) nos dois esquemas com `contraste(texto,barra) ≥ 4,5` e `contraste(destaque, fundo do esquema) ≥ 4,5`; cinza, preto, branco e `#ffff00` sem NaN; as 10 paletas válidas.
- [ ] Rodar e ver falhar; implementar; rodar e ver passar.
- [ ] Commit.

### Task 2: Config e tokens (`config.ts`, `tokens.ts`)

**Files:**
- Create: `sei-comum/src/tema/config.ts`, `sei-comum/src/tema/tokens.ts`, `sei-comum/tests/verificar-tema.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `ConfigTema`, `CONFIG_PADRAO`, `normalizarConfig(valor: unknown): ConfigTema`, `esquemaResolvido(cfg, sistemaEscuro): "claro"|"escuro"`, `gerarFolha(cfg, esquema, baseCss: string): string`.

- [ ] Teste: lixo (`null`, string, número, versão 9, hex inválido) normaliza ao padrão; `gerarFolha` contém todos os tokens (`--spro-barra*`, `--spro-fundo`, `--spro-destaque`…), sem `undefined`, sem `@import`/`url(http`; escuro usa `#141619/#1a1d21/#22262b/#2b3036`.
- [ ] Implementar; passar; commit.

### Task 3: Adaptação de cores (`adaptar.ts`)

**Files:**
- Create: `sei-comum/src/tema/adaptar.ts`, `sei-comum/tests/verificar-adaptar.ts`

**Interfaces:**
- Consumes: Task 1.
- Produces: `adaptarCor(css: string, papel: "texto"|"fundo"): string | null` (null = deixar como está: transparente, inherit, inválida).

- [ ] Teste com cores reais do SEI: texto `#000`→claro; `#ff0000`, `#0000ff` com contraste ≥ 4,5 sobre `#1a1d21` e matiz ± 6°; fundo `#fff`→escuro; `#ccc` distinto de `#fff` e de `#eee` (ordem preservada); `#ffff00` de fundo continua amarelo (matiz ± 8°); `transparent`/`inherit`/`rgba(0,0,0,0)` → null; formatos `rgb()`, `rgba()`, `#rgb`, nome (`red`).
- [ ] Implementar; passar; commit.

### Task 4: Pacote `estilo-avancado` e aplicação no DOM

**Files:**
- Create: `estilo-avancado/{package.json,tsconfig.json,biome.json,build.mjs}`, `estilo-avancado/src/pagina/{main.ts,aplicar.ts,cache.ts}`, `estilo-avancado/estatico/base.css`, `estilo-avancado/tests/{verificar.ts,verificar-aplicar.ts}`
- Modify: `.gitignore` se necessário (node_modules já coberto)

**Interfaces:**
- Consumes: Tasks 1-2.
- Produces: `aplicarTema(doc, cfg, sistemaEscuro): void`, `removerTema(doc): void`, `lerCache(storage): ConfigTema | null`, `gravarCache(storage, cfg): void`; bundle `dist/js/init_estilo.js`.

- [ ] Teste (linkedom): cria um único `<style data-spro-tema>`; reaplicar não duplica; `data-spro-tema="escuro"` e `data-spro-tema-ativo`; `ativo:false` remove tudo; cache corrompido → null.
- [ ] Implementar `aplicar.ts` (`textContent`, sem `innerHTML`), `main.ts` (cache síncrono → `chrome.storage.sync.get` → `onChanged` → `matchMedia`), `build.mjs` (IIFE ASCII, confere bytes).
- [ ] `npm run build`; commit (código-fonte e bundle gerado).

### Task 5: Folha base (`estatico/base.css`)

**Files:**
- Modify: `estilo-avancado/estatico/base.css`

- [ ] Levantar os seletores reais no SEI 4.1.5 / 5.0.4 (fontes locais com `grep -a`) para barra, tabelas infra, campos, botões, diálogos, chosen.
- [ ] Escrever a folha prefixada por `:root[data-spro-tema-ativo]`, só com tokens; sem `!important` espalhado (exceção documentada onde o legado usa inline).
- [ ] Teste estático: nenhum valor de cor literal fora de `var(--spro-*)`; commit.

### Task 6: Remapeamento no DOM e "Ver original" (`documentos.ts`)

**Files:**
- Create: `estilo-avancado/src/pagina/documentos.ts`, `estilo-avancado/tests/verificar-documentos.ts`
- Modify: `estilo-avancado/src/pagina/main.ts`

**Interfaces:**
- Consumes: Task 3.
- Produces: `iniciarRemapeamento(doc, raizes: string[]): () => void` (retorna o desligador), `alternarOriginal(doc): boolean`.

- [ ] Teste (linkedom): `<td style="background:#ccc">`, `<font color="red">`, `bgcolor` ganham `data-spro-adaptado` e variáveis; a cor original fica em `--spro-orig-*`; `img` intacta; desligar remove atributos e variáveis (zero rastro); lote com teto de 400.
- [ ] Implementar com `MutationObserver` e `requestIdleCallback`; botão "Ver original (como será assinado)" por DOM API; integrar ao `main.ts` (raízes: `#divInfraAreaTelaD`, `body` da visualização, corpo do editor).
- [ ] Teste de gravação: a função de limpeza usada no editor (`limparParaGravar`) remove variáveis e atributo; commit.

### Task 7: Seção "Aparência" nas opções

**Files:**
- Create: `estilo-avancado/src/opcoes/main.ts`, `estilo-avancado/estatico/opcoes.css`
- Modify: `dist/html/options.html` (ponto de montagem), `estilo-avancado/build.mjs` (bundle `dist/js/estilo-avancado/opcoes.js`)

- [ ] Montar: toggle, segmentado Claro/Escuro/Automático, grade de 10 paletas (`aria-pressed`) + `<input type="color">`, toggle "Escurecer documentos", prévia ao vivo com `gerarFolha`, "Restaurar padrão", "Usar a cor atual do Estilo Avançado" (lê `colorSlimPro` quando houver).
- [ ] Gravar `spro_tema` no `storage.sync` e o espelho no cache; commit.

### Task 8: Manifest (Lab) e validação estática

**Files:**
- Modify: `dist/manifest.json` (content script `js/init_estilo.js`, `all_frames`, `document_start`, mesmos `matches` de `init_favoritos.js`; `web_accessible_resources` do `js/estilo-avancado/opcoes.js`)

- [ ] JSON válido; `git diff` mostra só `dist/manifest.json`; os demais manifests intactos.
- [ ] `npm run build`, `tsc`, `biome`, todos os `verificar` (sei-comum e estilo-avancado) verdes; commit.

### Task 9: Teste real no SEI SP (4.1.5, CK4) e SEI MJ (5.0.4, CK5)

- [ ] Pedir ao usuário o login em cada SEI (harness Chrome com a extensão carregada; **MJ somente homologação**).
- [ ] Roteiro do spec §8.3: ligar, trocar paleta e cor livre, claro/escuro/auto, barra/tabela/formulário/diálogo/árvore/documento com tabela cinza e texto colorido, "Ver original", editar e salvar (HTML sem cores adaptadas), recarregar sem flash, desligar sem rastro; Network sem terceiros; console sem erros novos; regressão com a opção desligada.
- [ ] Corrigir o que o teste real revelar (novo ciclo teste → correção) e registrar prints/GIF.
- [ ] Commit final e resumo ao usuário.
