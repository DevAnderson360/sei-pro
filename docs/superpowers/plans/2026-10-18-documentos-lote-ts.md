# Documentos em Lote em TypeScript Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reescrever o Documentos em Lote em TypeScript (pacote `documentos-lote/`) com a novidade do processo de destino vindo de uma coluna do CSV, verificado antes de gravar.

**Architecture:** Entrada e ponte copiadas das Ações em Lote (ícone `#iconBatchDocs` na barra da árvore → evento → modal em iframe); laço de execução, retomada, prévia e resultado no molde do Processos em Lote (laço no app, requisições ao SEI pela aba via RPC). Criação do documento pelo `sei-nucleo` (`criarDocumento` com o modelo como texto inicial + troca dos `##campos##` nas seções do editor).

**Tech Stack:** TypeScript, esbuild, tsx + linkedom (provas), biome; `@comum/*` = `sei-comum/src`, `@nucleo/*` = `sei-nucleo/src`, `@dl/*` = `documentos-lote/src`.

**Spec:** `docs/superpowers/specs/2026-10-18-documentos-lote-ts-design.md` (leia antes; as seções citadas abaixo são as dela).

## Global Constraints

- Só `dist/manifest.json` (Lab MV3) recebe o módulo; os outros manifests e o legado ficam intactos (spec §2).
- O legado cede por atributo no `<html>`: `data-seipro-documentos-lote`; o clique em `#iconBatchDocs` dispara o evento `spro-documentos-lote-abrir`; canal `seipro-documentos-lote`; opção do legado `documentosemlote`.
- JS gerado todo ASCII (acentos como `\uXXXX`; o portão de bytes do `build.mjs` falha o build). Ao editar `dist/js/*.js` à mão, conferir por bytes: o Edit converte escapes em caracteres.
- DOM só por `h()` (`@comum/ui/dom`), nunca `innerHTML`; modal sem botão Cancelar (o X e o Esc fecham); tokens `--spro-*`; tema claro e escuro; textos em português com acento.
- Armazenamento: `chrome.storage.local`, chaves com prefixo `docslote/`, uma por entidade, sem sincronizar; lote guardado expira em 7 dias e é apagado ao concluir ou descartar.
- Documentos saem **sem assinatura**. Descrição ≤ 250 caracteres, nome na árvore ≤ 50 caracteres sem acento; trocas para latin-1 (travessão→hífen, aspas curvas→retas, nbsp→espaço) na descrição e no nome.
- Só `##campo##` com coluna correspondente é trocado; o resto fica literal no texto e é apontado na prévia (comportamento do legado).
- Teto de 2000 linhas, pausa padrão 500 ms (mín. 200, máx. 10000), como o Processos em Lote.
- Falha numa linha não para o lote. Nunca enviar nem concluir processo nos testes reais. Não editar `PRIVACY_POLICY.md` (é editado pela web).
- Trabalhar na worktree `../sei-pro-docs-lote` (branch `feat/documentos-lote-ts`); `git add` só dos arquivos da tarefa, nunca `-A`.

## Review Focus

1. **CSV de planilha real:** BOM, aspas com quebra de linha dentro, separador `;` ou `,` ou tab, linha final vazia, cabeçalho vazio ou repetido, Windows-1252 com acento → leitura correta, sem coluna fantasma. (T4)
2. **Mesmo processo em muitas linhas, com formatos diferentes** (`50300.018905/2018-67` com espaços em volta, repetido): uma consulta só por processo; célula vazia ou texto que não é número de processo → linha inválida. (T5, T13)
3. **Processo enviado/fechado depois da verificação:** a linha vira "não aberto na unidade" e o lote segue com as outras. (T8, T14)
4. **Valor de célula com `<`, `&`, aspas, `##` ou HTML:** vai escapado para o corpo do documento (sem virar marcação), acentos preservados. (T7)
5. **Fechar o modal ou cair a sessão no meio da execução:** o lote pausa, fica retomável e nenhuma linha já criada é recriada. (T10, T14)

---

## File Structure

```
documentos-lote/
  package.json biome.json tsconfig.json build.mjs        (copiados do processos-lote, renomeados)
  estatico/documentos-lote.html  estatico/documentos-lote.css
  src/modelo/constantes.ts   eventos, atributo, canal, teto, pausas, prefixo de chave, prazo 7 dias
  src/modelo/campos.ts       extrairCampos, preencherTexto, escaparValor
  src/modelo/nomes.ts        nomeNaArvore, descricaoDoc
  src/modelo/csv.ts          lerCsv
  src/modelo/destinos.ts     tipos de Destino, numeroDeProcesso, agruparPorProcesso, validarLinha
  src/sei/verificar.ts       verificarProcesso
  src/sei/modelo.ts          listarModelos, lerModelo
  src/sei/criar.ts           criarDocumentoDaLinha
  src/pagina/{main,contexto,marca,modal,executor}.ts   content script e ponte
  src/repositorio.ts         lote em andamento (docslote/)
  src/app/{main,app,modelo,planilha,cruzamento,verificacao,previa,execucao,resultado}.ts
  tests/verificar*.ts
sei-comum/src/texto/latin1.ts   (movido de processos-lote/src/modelo/latin1.ts)
sei-nucleo/src/dominio/documento.ts   (+ NovoDocumento.tipoId, + tipoDoDocumento)
```

Provas: `cd documentos-lote && npm run verificar` (tsx + linkedom, helpers `checar/igual/secao/lanca` de `tests/util.ts`, padrão de `processos-lote/tests/verificar-sei.ts` com `Http` falso); `npm run tipos`; `npm run checar`. Cada tarefa termina com os três verdes e um commit.

---

### Task 1: Esqueleto do pacote e build

**Files:**
- Create: `documentos-lote/{package.json,biome.json,tsconfig.json,build.mjs}`, `estatico/documentos-lote.{html,css}`, `src/modelo/constantes.ts`, `tests/{util.ts,verificar.ts}`
- Modify: nada fora do pacote

**Interfaces:**
- Produces (`constantes.ts`): `EVENTO_ABRIR = "spro-documentos-lote-abrir"`, `ATRIBUTO_ATIVO = "data-seipro-documentos-lote"`, `CANAL_DOCUMENTOS_LOTE = "seipro-documentos-lote"`, `TETO = 2000`, `PAUSA_PADRAO/MINIMA/MAXIMA = 500/200/10000`, `PREFIXO_CHAVE = "docslote/"`, `VALIDADE_LOTE_MS = 7*24*3600*1000`, `MAX_DESCRICAO = 250`, `MAX_NOME_ARVORE = 50`.

- [ ] **Step 1:** Copiar a configuração de `processos-lote/` (package.json com nome `sei-pro-documentos-lote`, biome, tsconfig com `@dl/*`), `build.mjs` com as entradas `src/app/main.ts → js/documentos-lote/app.js (esm)` e `src/pagina/main.ts → js/init_documentos_lote.js (iife)`, página `html/documentos-lote.html` e CSS `css/documentos-lote.css` (base.css + lista.css + o do pacote). Rodar `npm install` em `sei-comum`, `sei-nucleo` e `documentos-lote` (a worktree nasce sem `node_modules`).
- [ ] **Step 2:** Teste: `tests/verificar.ts` chama `resumo()` sem seções; `tests/verificar-constantes.ts` afirma que `TETO === 2000` e `EVENTO_ABRIR` casa `/^spro-.*-abrir$/`.
- [ ] **Step 3:** Rodar `npm run verificar && npm run tipos && npm run checar` → verdes; `node build.mjs` pula as entradas inexistentes com aviso.
- [ ] **Step 4:** Commit `Documentos em Lote TS: esqueleto do pacote e build`.

---

### Task 2: Content script, modal, legado cedendo e manifest

**Files:**
- Create: `src/pagina/{main,contexto,marca,modal}.ts`, `src/app/main.ts` (placeholder: monta `h("p","Documentos em Lote")`), `tests/verificar-pagina.ts`
- Modify: `dist/manifest.json` (content script `js/init_documentos_lote.js` com os mesmos `matches` do bloco do `init_acoes_lote.js`; `web_accessible_resources` ganha `html/documentos-lote.html`, `js/documentos-lote/app.js`, `css/documentos-lote.css`); `dist/js/sei-functions-pro.js` (`initDocLoteModalSelecaoDoc`, ~linha 13236)

**Interfaces:**
- Consumes: padrão de `acoes-lote/src/pagina/{main,contexto,modal,marca}.ts` (copiar, trocando constantes e `@al`→`@dl`).
- Produces: `contextoDocumentos(doc, {temaEscuro, corTema?}, url?) -> ContextoDocumentos | null` com `{host, login, nomeUsuario, unidadeSigla, temaEscuro, corTema?, base, linkArvore, idProcedimento, origem, aba}` (mesmos campos do `ContextoAcoes`); `CONFIG_MODAL` com `seletorItemMenu: "#iconBatchDocs"`, `titulo: "Documentos em Lote"`.

- [ ] **Step 1: Teste** (`verificar-pagina.ts`, molde de `acoes-lote/tests/verificar-pagina.ts`): `contextoDocumentos` devolve `null` sem login e sem `#ifrArvore`; com os dois, devolve `idProcedimento` lido do `src` da árvore e `origem` sem query; `marcarAtivo` põe `data-seipro-documentos-lote="1"` no `<html>`.
- [ ] **Step 2:** Rodar → falha (módulos inexistentes).
- [ ] **Step 3:** Implementar os quatro arquivos e `main.ts` (opção lida com `lerOpcaoLegada("documentosemlote")`; guarda `__seiProDocumentosLote`).
- [ ] **Step 4:** Em `initDocLoteModalSelecaoDoc` (sei-functions-pro.js) inserir, antes de tudo, o mesmo padrão do `getDocumentosActions` (linha ~9908): `if (document.documentElement.hasAttribute('data-seipro-documentos-lote')) { document.dispatchEvent(new CustomEvent('spro-documentos-lote-abrir')); return; }`. O ícone é um `onclick="parent.initDocLoteModalSelecaoDoc()"` no iframe de visualização, então a chamada chega à janela de topo, onde o atributo existe. Conferir por bytes que não entrou caractere não-ASCII (`LC_ALL=C grep -nP '[^\x00-\x7F]'` nas linhas alteradas).
- [ ] **Step 5:** `npm run build:rapido`; `npm run verificar && npm run tipos && npm run checar`.
- [ ] **Step 6:** Prova no navegador (SEI SP, ver Task 17 para o login): carregar a extensão da worktree, abrir um processo, clicar `#iconBatchDocs` → abre o modal com o placeholder; Esc fecha. Commit `Documentos em Lote TS: content script, modal e cessao do legado`.

---

### Task 3: `paraLatin1` sobe para o sei-comum

**Files:**
- Move: `processos-lote/src/modelo/latin1.ts` → `sei-comum/src/texto/latin1.ts`; prova correspondente (em `processos-lote/tests/verificar-linhas.ts`) → `sei-comum/tests/`
- Modify: imports de `processos-lote/src/{app/previa,app/resultado,modelo/previa,sei/criar}.ts` e `tests/verificar-linhas.ts` para `@comum/texto/latin1`

**Interfaces:**
- Produces: `paraLatin1(texto: string): string` exatamente como hoje (mesmas exportações do arquivo movido).

- [ ] **Step 1:** Mover o arquivo e as asserções de latin-1 (as de `verificar-linhas.ts` que tratam de `paraLatin1`) para uma prova no `sei-comum` (seguir o formato das outras provas de lá e registrar no seu runner).
- [ ] **Step 2:** Trocar os imports; rodar `npm run verificar && npm run tipos && npm run checar` em `sei-comum` e `processos-lote` → verdes e sem mudar nenhuma asserção.
- [ ] **Step 3:** Commit `sei-comum: paraLatin1 compartilhado entre os lotes`.

---

### Task 4: Campos, nomes e leitura de CSV

**Files:**
- Create: `src/modelo/{campos,nomes,csv}.ts`, `tests/{verificar-campos,verificar-csv}.ts`

**Interfaces:**
- Produces:
  - `extrairCampos(html: string): string[]` — nomes únicos entre `##…##` (sem os `#`), na ordem de aparição; ` ` conta como espaço; não casa `##` vazio.
  - `preencherTexto(texto: string, linha: Record<string,string>, escapar?: (v: string) => string): string` — troca `##col##` pelo valor quando a coluna existe em `linha`; sem coluna, deixa o trecho literal (legado).
  - `escaparValor(v: string): string` — `& < > " '` para entidades HTML, mantém acentos.
  - `nomeNaArvore(valor: string): string` — sem acento (`removeAcentos` equivalente: NFD sem diacríticos, mantendo º ª °), corta em 50, `paraLatin1`, `trim`.
  - `descricaoDoc(modelo: string, linha: Record<string,string>): string` — `preencherTexto` + `paraLatin1` + corte em 250 + `trim`.
  - `lerCsv(bytes: Uint8Array): { colunas: string[]; registros: Record<string,string>[]; codificacao: "utf-8" | "windows-1252" }` — UTF-8 estrito (`TextDecoder(..., {fatal:true})`), senão Windows-1252; remove BOM; separador detectado entre `;` `,` tab pela primeira linha fora de aspas; aspas RFC 4180 com quebra de linha; pula linhas só de células vazias; descarta colunas de cabeçalho vazio; cabeçalho repetido recebe sufixo ` (2)`, ` (3)`; `trim` nos cabeçalhos, valores intactos.

- [ ] **Step 1: Testes.** `verificar-campos.ts`: `extrairCampos("<p>##nome## e ##município##, ##nome##</p>")` igual `["nome","município"]`; `preencherTexto("Oi ##nome## ##x##", {nome:"A"})` igual `"Oi A ##x##"`; `preencherTexto("##v##", {v:"a<b & \"c\""}, escaparValor)` igual `"a&lt;b &amp; &quot;c&quot;"`; `nomeNaArvore("Ofício nº 1ª — José")` começa com `"Oficio nº 1ª"` e não contém `—`; `nomeNaArvore("x".repeat(80)).length === 50`; `descricaoDoc("Termo - ##nome## ##u##", {nome:"José",u:"A—B"})` mantém "José" e troca o travessão por "-". `verificar-csv.ts`: (a) UTF-8 com BOM e `;`; (b) Windows-1252 (bytes `0xE9` para "é") devolve "é" e `codificacao === "windows-1252"`; (c) célula `"linha1\nlinha2"` entre aspas fica numa célula; (d) separador `,` e tab; (e) linha final vazia e linha só de `;;` não viram registro; (f) cabeçalho `a;;a;b` → colunas `["a","a (2)","b"]`; (g) arquivo vazio → `colunas` e `registros` vazios, sem lançar.
- [ ] **Step 2:** Rodar → falham.
- [ ] **Step 3:** Implementar. Parser CSV manual (máquina de estados), sem dependência nova.
- [ ] **Step 4:** Verde nos três comandos. Commit `Documentos em Lote TS: campos, nomes e CSV`.

---

### Task 5: Destinos, número de processo e validação de linhas

**Files:**
- Create: `src/modelo/destinos.ts`, `tests/verificar-destinos.ts`

**Interfaces:**
- Consumes: `extrairProtocolos` de `@comum/texto/protocolos`.
- Produces:
  ```ts
  export type Destino =
    | { tipo: "tela" }
    | { tipo: "novo-processo"; idTipoProcesso: string; especificacao: string }
    | { tipo: "coluna"; coluna: string };
  export interface LinhaDocumento { indice: number; dados: Record<string,string>; destino?: string /* nº do processo normalizado, só no destino coluna */; erroLinha?: string; nivel?: "publico"|"restrito"; hipotese?: string }
  numeroDeProcesso(celula: string): string | null            // 1º protocolo tipo "processo" da célula; null se não houver
  prepararLinhas(registros: Record<string,string>[], cfg: { destino: Destino; colunaNivel?: string; colunaHipotese?: string; colunaNome: string }): LinhaDocumento[]
  agruparPorProcesso(linhas: LinhaDocumento[]): Map<string, number[]>   // nº do processo → índices das linhas
  ```
  `prepararLinhas` preenche `erroLinha` quando: destino coluna e `numeroDeProcesso` é `null` ("Processo inválido ou vazio"); nome da árvore vazio; `nivel` fora de {público, restrito} (aceitar "público"/"publico"/"0"/"restrito"/"1", sem diferenciar caixa); restrito sem hipótese. Sem coluna de nível: `nivel = "publico"`, sem hipótese (padrão do legado). Mais de `TETO` registros → lança `Error` com a mensagem do teto.

- [ ] **Step 1: Testes:** `numeroDeProcesso("  50300.018905/2018-67 ")` igual `"50300.018905/2018-67"`; `numeroDeProcesso("sem numero")` igual `null`; `agruparPorProcesso` com 3 linhas, 2 delas com o mesmo número formatado diferente (espaços), devolve 2 chaves; linha com célula vazia no destino coluna tem `erroLinha`; nível "Restrito" sem hipótese tem `erroLinha`; destino `tela` ignora a coluna de processo; 2001 registros lança.
- [ ] **Step 2:** Rodar → falha. **Step 3:** Implementar. **Step 4:** Verde; commit `Documentos em Lote TS: destinos e validacao de linhas`.

---

### Task 6: sei-nucleo — tipo por id exato e tipo do documento

**Files:**
- Modify: `sei-nucleo/src/dominio/documento.ts` (`NovoDocumento`, `criarDocumento`, `telaAlteracao` hoje privada)
- Test: `sei-nucleo/tests/` (arquivo da prova de documento existente; ver o runner)

**Interfaces:**
- Produces:
  - `NovoDocumento.tipoId?: string` — quando presente, `criarDocumento` chama `prepararCriacao(..., soPorId = true)` com esse id e ignora o casamento por nome (`tipo` vira só rótulo).
  - `tipoDoDocumento(sei: Sei, numero: string, sinal?: AbortSignal): Promise<{ id: string; nome: string }>` — lê `hdnIdSerie` da tela "Alterar Documento" (a mesma de `duplicarDocumento`) e o nome do tipo pela lista de tipos; erro `SEI_VERSAO_NAO_SUPORTADA` se a tela não informar o id.

- [ ] **Step 1: Testes** (fixtures e `Http` falso da prova existente de `duplicarDocumento`): `criarDocumento(sei, ref, {tipo:"Of", tipoId:"26", ...}, {aplicar:false})` resolve o tipo de id 26 mesmo que "Of" casasse com outro nome; `tipoId` inexistente lança `SEI_ACAO_INDISPONIVEL`; `tipoDoDocumento` devolve `{id, nome}` da fixture.
- [ ] **Step 2:** Rodar → falha. **Step 3:** Implementar sem mudar o comportamento de quem não passa `tipoId` (o Agente continua igual); exportar `tipoDoDocumento` pelo `index.ts` se os outros domínios forem exportados lá. **Step 4:** Rodar a prova completa do `sei-nucleo` e do `agente-ia` (`npm run verificar` em ambos) → sem regressão.
- [ ] **Step 5:** Commit `sei-nucleo: criarDocumento por id de tipo e tipoDoDocumento`.

---

### Task 7: Lado do SEI — modelo e criação do documento da linha

**Files:**
- Create: `src/sei/{modelo,criar}.ts`, `tests/verificar-sei.ts` (molde de `processos-lote/tests/verificar-sei.ts`, fixtures sintéticas em `tests/fixtures/` com `LEIAME.txt`)

**Interfaces:**
- Consumes: `criarDocumento`, `tipoDoDocumento`, `abrirEditor`, `localizarDocumento` (`@nucleo/dominio/*`), `extrairCampos`, `preencherTexto`, `escaparValor`, `nomeNaArvore`, `descricaoDoc`.
- Produces:
  ```ts
  export type Modelo =
    | { origem: "documento"; numero: string; titulo: string; tipoId: string; tipoNome: string; campos: string[] }
    | { origem: "texto-padrao"; id: string; nome: string; tipoId?: string; tipoNome?: string; campos: string[] };
  listarModelos(sei: Sei, ref: string): Promise<{ documentos: Array<{numero:string; titulo:string}>; textosPadrao: Array<{id:string; nome:string}>; tipos: Array<{id:string; nome:string}> }>
  lerModelo(sei: Sei, escolha: { documento: string } | { textoPadrao: string; tipoId: string }): Promise<Modelo>   // documento: tipo por tipoDoDocumento (id exato); campos por extrairCampos do HTML de TODAS as seções do editor, sem tocar no documento
  export interface PedidoCriar { processo: string /* ref do destino */; modelo: Modelo; linha: Record<string,string>; colunaNome: string; modeloDescricao: string; nivel: "publico"|"restrito"; hipotese?: string; camposCruzados: Record<string,string> /* campo → coluna */ }
  criarDocumentoDaLinha(sei: Sei, p: PedidoCriar, sinal?: AbortSignal): Promise<{ idDocumento: string; numero: string; link: string }>
  ```
  `criarDocumentoDaLinha`: (1) `criarDocumento` com `tipoId`, `nomeArvore`/`numero` por `nomeNaArvore(linha[colunaNome])` (nome vai em `txtNomeArvore`; em tipo cujo Número é obrigatório, em `numero`, como o legado), `descricao: descricaoDoc(...)`, `documentoModelo` ou `textoPadrao`, `nivel`, `hipotese`, `aplicar: true`; (2) abre o editor do novo documento e, **em cada seção não somente-leitura que contenha `##`**, troca só os campos de `camposCruzados` por `escaparValor(linha[coluna])` e grava com `editarConteudo(..., {secao})`; seção sem `##` não é regravada; (3) devolve `link` = `${origem}?acao=procedimento_trabalhar&id_procedimento=…&id_documento=…` (mesmo formato do Pesquisar Link Permanente: reaproveitar a função que o `acoes-lote` usa para montá-lo).

- [ ] **Step 1: Testes** (Http falso, grava chamadas): `lerModelo` por documento devolve `tipoId` da tela de alteração e `campos` de duas seções sem duplicar; `lerModelo` por texto padrão exige `tipoId`; `criarDocumentoDaLinha` envia `documentoModelo` = número do modelo e `tipoId` do modelo; troca `##nome##` com valor `a<b & "c"` gravando `a&lt;b &amp; &quot;c&quot;`; com acento "José" mantém o acento no corpo; campo sem coluna cruzada permanece `##x##`; seção sem `##` não gera POST de gravação; modelo por texto padrão manda `textoPadrao` e não `documentoModelo`; falha do SEI em `criarDocumento` propaga o `ErroSei` (não cria meio documento sem reportar).
- [ ] **Step 2:** Rodar → falha. **Step 3:** Implementar. **Step 4:** Verde; commit `Documentos em Lote TS: modelo e criacao do documento da linha`.

---

### Task 8: Verificação de processo

**Files:**
- Create: `src/sei/verificar.ts`, `tests/verificar-verificar.ts`

**Interfaces:**
- Consumes: `Sei.localizar`, `Sei.arvore(ref, {forcar})`, `acaoNaArvore`, `tiposDocumento`, `ErroSei`.
- Produces:
  ```ts
  export type StatusProcesso = "ok" | "nao-encontrado" | "sigiloso" | "nao-aberto" | "tipo-indisponivel" | "erro-rede";
  export interface ResultadoVerificacao { numero: string; status: StatusProcesso; idProcedimento?: string; linkArvore?: string; mensagem?: string }
  verificarProcesso(sei: Sei, numero: string, tipoId: string, sinal?: AbortSignal): Promise<ResultadoVerificacao>
  ```
  Regras: `localizar` lançando `SEI_NAO_ENCONTRADO` → `nao-encontrado`; árvore `nivel === "sigiloso"` → `sigiloso`; `acaoNaArvore(arv, "documento_escolher_tipo")` ausente → `nao-aberto`; `tiposDocumento(...)` sem o `tipoId` → `tipo-indisponivel`; erros de rede/timeout/sessão → `erro-rede` (com `mensagem`); lê a árvore com `forcar: true` (a reverificação não pode usar o cache de 30 s). Nunca lança.

- [ ] **Step 1: Testes** (Http falso): cinco fixtures de árvore/pesquisa → um caso por status; processo restrito (não sigiloso) com link de incluir → `ok`; reverificar após a fixture mudar de "sem link" para "com link" devolve `ok` (prova que não usou cache).
- [ ] **Step 2:** Rodar → falha. **Step 3:** Implementar. **Step 4:** Verde; commit `Documentos em Lote TS: verificacao de processo de destino`.

---

### Task 9: Repositório do lote em andamento

**Files:**
- Create: `src/repositorio.ts`, `tests/verificar-repositorio.ts`

**Interfaces:**
- Consumes: `Area` de `@comum/armazenamento/area`; molde de `processos-lote/src/repositorio.ts` (`RepositorioLote`, validação de registro, janela "outra aba").
- Produces:
  ```ts
  export type SituacaoLinha = "pendente" | "criada" | "erro" | "fora";   // "fora" = deixada de fora da execução (processo com problema)
  export interface LoteDocumentos { id: string; host: string; login: string; iniciadoEm: number; atualizadoEm: number; config: ConfigLote; linhas: LinhaDocumento[]; itens: Array<{ situacao: SituacaoLinha; criado?: { numero: string; idDocumento: string; link: string }; erro?: string }>; verificacoes: Record<string, ResultadoVerificacao> }
  class RepositorioLote { constructor(area: Area, agora?: () => number); carregar(host: string, login: string): Promise<LoteDocumentos | null>; gravar(l: LoteDocumentos): Promise<void>; marcar(id: string, indice: number, item: LoteDocumentos["itens"][number]): Promise<void>; apagar(id: string): Promise<void> }
  ```
  `carregar` descarta (e apaga) lote com mais de `VALIDADE_LOTE_MS`, de outro `host`/`login`, ou com forma inválida; item `criada` sem `criado.numero` invalida o lote (uma linha só vale como criada depois da resposta com número).

- [ ] **Step 1: Testes** (área em memória como nas provas existentes): grava e relê; lote de 8 dias é descartado e removido; outro login não carrega; `marcar` não regrava as outras linhas; item `criada` sem número invalida; `apagar` remove a chave.
- [ ] **Step 2:** Rodar → falha. **Step 3:** Implementar (chave `docslote/lote`). **Step 4:** Verde; commit `Documentos em Lote TS: repositorio do lote em andamento`.

---

### Task 10: Ponte da aba (tratadores RPC)

**Files:**
- Create: `src/pagina/executor.ts`, `tests/verificar-executor.ts`
- Modify: `src/pagina/main.ts` (passar `tratadoresDocumentosLote` ao `criarControleModal`)

**Interfaces:**
- Consumes: Tasks 7 e 8; `criarProcesso`/`carregarFormTipo`/`listarTipos` de `processos-lote/src/sei` via alias `@pl/*` → `../processos-lote/src/*` (adicionar ao `tsconfig`); se o esbuild ou o `tsc` reclamarem do import entre pacotes, mover esses três arquivos para `sei-comum/src/sei/` e atualizar o `processos-lote` (uma prova verde antes e depois).
- Produces: `tratadoresDocumentosLote(d: { sei: Sei; ctx: ContextoDocumentos; fechar(): void; minimizar(m: boolean): void; chamadas?: Partial<Chamadas> }): Record<string, Tratador>` com os métodos RPC: `contexto()`, `listarModelos()`, `lerModelo(escolha)`, `tiposProcesso()` (destino novo-processo), `verificar({numero, tipoId})`, `criar(pedido)` → `{ situacao: "ok", criado } | { situacao: "erro", erro, naoAberto?: boolean }` (antes de criar no destino coluna, relê só o link de incluir via `verificarProcesso`; `nao-aberto` volta como `naoAberto: true`, sem lançar), `criarProcesso(args)`, `fechar()`, `minimizar(bool)`, `abrirAba(url)` (só `http(s)` do mesmo host do SEI, para o "Abrir em nova aba").

- [ ] **Step 1: Testes** (molde de `processos-lote/tests/verificar-pagina.ts`, `chamadas` injetadas): `criar` com processo que perdeu o link devolve `naoAberto: true` sem chamar `criarDocumentoDaLinha`; `criar` com `ErroSei` de sessão expirada devolve `erro` com o código para o app pausar; `abrirAba("javascript:…")` e URL de outro host são recusados; `verificar` repassa o `ResultadoVerificacao`.
- [ ] **Step 2:** Rodar → falha. **Step 3:** Implementar. **Step 4:** Verde nos três comandos de `documentos-lote` e de `processos-lote` (se algo foi movido). Commit `Documentos em Lote TS: ponte de requisicoes da aba`.

---

### Task 11: App — etapas 1 e 2 (modelo e planilha)

**Files:**
- Create: `src/app/{main,app,modelo,planilha}.ts`, `tests/verificar-app-modelo.ts`
- Modify: `estatico/documentos-lote.css`

**Interfaces:**
- Consumes: `criarRpc`/porta do app como em `processos-lote/src/app/main.ts`; `lerCsv`; RPC `listarModelos`/`lerModelo`.
- Produces: estado do app `EstadoApp { modelo?: Modelo; registros?: Record<string,string>[]; colunas?: string[]; ... }` e telas: **Modelo** (lista de documentos da árvore e de Textos Padrão; Texto Padrão exige escolher o tipo numa lista; mostra os campos `##…##` encontrados ou o aviso "nenhum campo dinâmico encontrado") → **Planilha** (escolher arquivo CSV; mostra colunas e quantidade de linhas; erro claro para arquivo vazio). Botão **Avançar** desabilitado até a etapa estar completa. Esc fecha; X fecha; nenhum botão Cancelar.

- [ ] **Step 1: Testes** (linkedom + RPC falso, molde de `processos-lote/tests/verificar-app.ts`): sem seleção, Avançar fica desabilitado; escolher documento mostra os campos devolvidos; Texto Padrão sem tipo mantém Avançar desabilitado; CSV de 3 linhas mostra "3 linhas" e as colunas; CSV vazio mostra erro e mantém desabilitado; não há botão com texto "Cancelar".
- [ ] **Step 2:** Rodar → falha. **Step 3:** Implementar com `h()`. **Step 4:** Verde; commit `Documentos em Lote TS: app, modelo e planilha`.

---

### Task 12: App — cruzamento e destino

**Files:**
- Create: `src/app/cruzamento.ts`, `tests/verificar-app-cruzamento.ts`

**Interfaces:**
- Produces: tela **Cruzamento** que produz `ConfigLote { camposCruzados: Record<string,string>; colunaNome: string; modeloDescricao: string; destino: Destino; colunaNivel?: string; colunaHipotese?: string; pausa: number }`. Cada campo do modelo tem um seletor de coluna (pré-selecionado quando o nome coincide exatamente); seletor da coluna do nome na árvore (obrigatório); campo de descrição (≤ 250, aceita `##coluna##`); escolha do destino em três opções exclusivas: processo da tela / novo processo por linha (tipo do processo via RPC `tiposProcesso` + especificação com `##coluna##`) / **processo indicado em uma coluna** (seletor de coluna); seletores opcionais de nível e hipótese; pausa (200–10000, padrão 500); estimativa de duração. Botão **Verificar processos** (destino coluna) ou **Revisar** (demais).

- [ ] **Step 1: Testes:** nomes iguais pré-selecionam; coluna do nome vazia desabilita o avanço; trocar de destino esconde os campos dos outros dois; destino coluna sem coluna escolhida desabilita; pausa 50 vira 200 e 20000 vira 10000; descrição de 300 caracteres é cortada em 250 no valor da config.
- [ ] **Step 2:** Rodar → falha. **Step 3:** Implementar. **Step 4:** Verde; commit `Documentos em Lote TS: tela de cruzamento e destino`.

---

### Task 13: App — verificação dos processos de destino

**Files:**
- Create: `src/app/verificacao.ts`, `tests/verificar-app-verificacao.ts`

**Interfaces:**
- Consumes: `agruparPorProcesso`, RPC `verificar`, `abrirAba`, `ExecutorLote` (concorrência 1, pausa curta) para consultar os processos distintos.
- Produces: tela **Verificação** (só no destino coluna): tabela com processo, nº de linhas que dependem dele, status em texto (não só cor: Ok, Não encontrado ou sem acesso, Sigiloso, Não aberto na unidade, Tipo indisponível, Erro de rede) e, nos problemáticos, **Abrir em nova aba** (usa o link assinado da árvore quando houver, senão a pesquisa do número) e **Verificar de novo** (por linha); **Verificar todos de novo** no topo; resumo "X linhas prontas, Y ficam de fora". Botão **Continuar** habilitado quando há ≥ 1 linha pronta; texto dele mostra quantas linhas serão gravadas e quantas ficam de fora. Linhas `erroLinha` (Task 5) entram na contagem de "fora". As de fora recebem `situacao: "fora"` no lote e podem ser reverificadas e gravadas depois no mesmo lote.

- [ ] **Step 1: Testes** (RPC falso): 3 processos distintos para 5 linhas → 3 chamadas `verificar` (não 5); status `nao-aberto` mostra os dois botões e Continuar mostra "3 linhas prontas, 2 ficam de fora"; **Verificar de novo** num processo que passa a `ok` atualiza a contagem sem refazer os outros; todos problemáticos → Continuar desabilitado; `Abrir em nova aba` chama o RPC `abrirAba`.
- [ ] **Step 2:** Rodar → falha. **Step 3:** Implementar. **Step 4:** Verde; commit `Documentos em Lote TS: verificacao previa dos processos de destino`.

---

### Task 14: App — prévia, execução, resultado e retomada

**Files:**
- Create: `src/app/{previa,execucao,resultado}.ts`, `tests/verificar-app-execucao.ts`
- Modify: `src/app/app.ts` (retomada ao abrir)

**Interfaces:**
- Consumes: `ExecutorLote`/`RitmoAdaptativo` (`@comum/lote/executor`), `RepositorioLote`, `montarTabelaResultado`/`resultadoComoCsv`/`copiarResultado` (`@comum/ui/tabelaResultado`), RPC `criar`/`criarProcesso`/`minimizar`.
- Produces:
  - **Prévia:** documento da linha escolhida (padrão: a primeira pronta) com os campos já trocados (texto, via `preencherTexto`), nome na árvore e descrição finais, campos sem coluna destacados.
  - **Execução:** uma execução sobre a lista fixa de linhas prontas (`situacao: "pendente"`); progresso, **Pausar/Continuar**, **Minimizar**; ritmo adaptativo; cada resultado é gravado no repositório antes da próxima linha; `naoAberto` marca a linha como `erro` com "Processo não está aberto na unidade" e **segue**; sessão expirada pausa o lote; erro numa linha não para as outras. No destino novo-processo, linha com processo criado e documento falho mostra o link do processo (comportamento do legado).
  - **Resultado:** tabela da planilha + processo de destino, documento gerado, número SEI e link; **Baixar CSV**, **Copiar** (com links), **Repetir só as que falharam** (nova execução sobre as linhas `erro`), **Gravar as que ficaram de fora** (reverifica e executa as `fora`), **Gerar links permanentes destes documentos** (grava a entrada em `chrome.storage.local` na chave `link-permanente/entrada` e dispara o evento do Link Permanente, como o Processos em Lote faz).
  - **Retomada:** ao abrir com lote guardado do mesmo host/login, oferece **Continuar de onde parou** ou **Descartar**; lote atualizado há menos de `JANELA_OUTRA_ABA_MS` avisa "pode estar rodando em outra aba"; fechar o modal durante a execução pausa e deixa retomável; lote concluído é apagado do armazenamento.

- [ ] **Step 1: Testes** (RPC falso com `esperar` injetado): 4 linhas, a 2ª devolve `naoAberto` → a 3ª e a 4ª são criadas e o resultado mostra 3 criadas + 1 erro; linha já `criada` no lote guardado não chama `criar` ao retomar (nenhuma duplicata); sessão expirada na 3ª pausa com 2 criadas gravadas; **Repetir só as que falharam** chama `criar` apenas para as linhas `erro`; **Gravar as que ficaram de fora** executa as `fora` que passaram na reverificação; concluir apaga a chave `docslote/lote`; Baixar CSV tem as colunas da planilha + `processo_destino`, `nome_documento_gerado`, `numero_sei_gerado`, `link_documento_gerado`; valor `=cmd()` no CSV sai neutralizado (`gerarCsv`).
- [ ] **Step 2:** Rodar → falha. **Step 3:** Implementar. **Step 4:** Verde; commit `Documentos em Lote TS: previa, execucao, resultado e retomada`.

---

### Task 15: Build completo, ajuda e texto de privacidade

**Files:**
- Modify: `pages/DOCUMENTOSEMLOTE.md`
- Create: `docs/superpowers/plans/2026-10-18-documentos-lote-privacidade.md` (texto para o autor publicar)

- [ ] **Step 1:** `npm run build` (com `verificar`) em `documentos-lote` → gera `dist/js/init_documentos_lote.js`, `dist/js/documentos-lote/app.js`, html e css, sem byte não-ASCII; conferir que nenhum arquivo do legado foi alterado além da linha da Task 2.
- [ ] **Step 2:** Atualizar a página de ajuda: etapa nova "Processo de destino", verificação antes de gravar, gravar só as válidas, retomar, repetir falhas; manter o crédito ao PluriDocs SEI! (tcgontijo). O GIF da ajuda fica para depois do teste real (a tarefa seguinte o regrava só se o autor pedir).
- [ ] **Step 3:** Escrever o texto da linha de privacidade para o inventário (planilha guardada só no navegador, até 7 dias, apagada ao concluir/descartar) no arquivo acima. **Não editar `PRIVACY_POLICY.md`**; avisar o autor de que ele publica pela web.
- [ ] **Step 4:** Commit `Documentos em Lote TS: build, ajuda e texto de privacidade`.

---

### Task 16: Bloco de assinatura depois de criar (opcional, cortável)

**Files:**
- Create: `src/app/posAcao.ts`, `src/pagina/posAcao.ts`, `tests/verificar-pos-acao.ts`

**Interfaces:**
- Consumes: `processos-lote/src/pagina/posAcao.ts` (`tratadoresPosAcao`, `ChamadasPosAcao`) e `src/app/posAcao.ts` como molde; documentos criados (número SEI + processo).
- Produces: seção **Depois de criar** na tela de resultado: "Incluir os documentos num bloco de assinatura" (escolher bloco existente ou criar), com resultado por documento e repetição das falhas. Documentos em processos diferentes entram no mesmo bloco (o bloco é por documento); conferir no molde que nada presume um processo só.

- [ ] **Step 1: Testes:** 3 documentos de 2 processos diferentes → 3 chamadas de inclusão; falha numa não impede as outras; repetir só as falhas.
- [ ] **Step 2–4:** Falhar, implementar, verde; commit `Documentos em Lote TS: depois de criar (bloco de assinatura)`. Se o autor decidir cortar, pular a tarefa sem afetar as demais.

---

### Task 17: Prova no navegador (SEI SP e SEI MJ)

**Files:** nenhum de produto; prints/GIF em `docs/superpowers/specs/` só se o autor pedir.

- [ ] **Step 1:** `npm run build` e carregar a extensão `dist/` da worktree num Chrome de teste (harness e credencial do SEI SP de treinamento: memórias `reference_sei_sp_treinamento` e `reference_mcp_chrome_extensao`; logar sozinho). No SEI MJ de homologação (`hmlsei.mj.gov.br`, 5.0.4, CK5; produção é `sei.mj.gov.br`, **nunca usar**), **pedir ao autor que logue**.
- [ ] **Step 2: Provar os quatro pontos do spec §9** e registrar o resultado de cada um (ok / divergência / ajuste feito) no fim do documento de desenho: (1) falta de `documento_escolher_tipo` na árvore = processo não aberto na unidade, nas duas versões; (2) `criarDocumento` + troca de campos reproduz o documento do legado (campos trocados, estilos), com documento da árvore e com Texto Padrão como modelo, CK4 e CK5; (3) o SEI aceita copiar o modelo de outro processo no destino coluna; (4) conferência de tipo disponível funciona nas duas versões.
- [ ] **Step 3: Casos** (poucas linhas, tipo de teste, nunca enviar nem concluir): processo da tela; novo processo por linha; destino coluna com mistura de ok, número inexistente e processo não aberto → conferir status, **Abrir em nova aba**, **Verificar de novo**, gravar só as válidas, gravar depois as que ficaram de fora; acento no nome e no corpo; fechar o modal no meio e retomar sem duplicar; **Repetir só as que falharam**; legado não carrega nos outros manifests.
- [ ] **Step 4:** Corrigir o que falhar com teste novo antes de cada correção; ao fim, `npm run verificar` verde em todos os pacotes tocados e commit `Documentos em Lote TS: ajustes da validacao em SEI real`. Relatar ao autor o que passou, o que divergiu e o que não foi testado.
