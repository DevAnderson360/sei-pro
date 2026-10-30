# Agente de IA — anexar PDF: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O botão de anexar do chat aceita PDF; o PDF é lido no computador (texto por página, OCR só nas páginas escaneadas) e só o texto vai ao modelo, inteiro por padrão, com aviso de tamanho e opção de cortar.

**Architecture:** A lógica de decisão (quais páginas vão ao OCR, quando avisar, como montar e cortar o texto) fica pura em `src/painel/anexo.ts` e é testada sem navegador. A leitura do PDF ganha em `src/painel/pdf.ts` uma função nova para o anexo, que reaproveita o pdf.js e o `ocrPdf` das Ferramentas de PDF sem mudar a biblioteca compartilhada. O painel só liga as peças: escolher arquivo, aviso, andamento, chip.

**Tech Stack:** TypeScript, pdf.js e Tesseract já empacotados (`@/lib/ferramentas/pdfjs`, `@/lib/ferramentas/ocr`), testes `tsx tests/verificar.ts`, linkedom.

**Spec:** `docs/superpowers/specs/2026-10-16-agente-anexo-pdf-design.md`

## Global Constraints

- O PDF (bytes/base64) nunca vai ao provedor; só o texto, pelo caminho de anexo que já existe (`varrer` + `envelopar`, `main.ts:2479-2492`).
- Aviso de lentidão quando **mais de 20 páginas** precisarem de OCR (`PAGINAS_AVISO_OCR = 20`).
- Anexo vai **inteiro por padrão**; acima de **60.000** caracteres (`LIMITE_CORTE = 60_000`) o chip oferece "Cortar em 60 mil". Teto duro **200.000** caracteres (`TETO_ANEXO`).
- Teto de leitura de texto `LIMITE_PAGINAS = 200` e de OCR `MAX_PAGINAS_OCR = 100` continuam.
- A ferramenta de leitura de documento do SEI (`tools/sei.ts:426`, `extrairTextoPdf`) não muda: segue com `PAGINAS_OCR = 5`.
- `.txt`/`.csv` seguem a mesma regra de tamanho (deixam de cortar em silêncio em `main.ts:361`).
- Sem dependência nova. Acentos como `\uXXXX` no `dist/js`.
- Verificação de cada tarefa: `cd agente-ia && npm run tipos && npm run verificar` (todas `ok`).

## Review Focus

1. **PDF com senha ou corrompido:** o pdf.js rejeita; o painel mostra "Não foi possível ler este PDF (protegido por senha ou danificado)." e nada é anexado (teste de `mensagemDeErroPdf` na Tarefa 1; prova manual na Tarefa 3).
2. **PDF escaneado num navegador sem OCR** (`ocrDisponivel()` falso): anexa só as páginas com texto e o chip diz "N páginas digitalizadas não foram lidas (este navegador não faz OCR)" — nunca um anexo vazio sem explicação (teste em `montarTexto` na Tarefa 1).
3. **Mais de 100 páginas escaneadas:** o OCR para no `MAX_PAGINAS_OCR`; o texto marca as páginas que ficaram sem leitura (teste em `planejarLeitura` na Tarefa 1).
4. **Trocar de arquivo ou remover o anexo com o OCR rodando:** a leitura em curso é cancelada e o resultado dela não pode reaparecer depois no chip (prova manual na Tarefa 3).
5. **Cortar no meio de uma palavra/página:** o corte acontece no fim da última página que cabe e diz "o modelo leu até a página X de Y" (teste em `aplicarModo` na Tarefa 1).

---

### Task 1: Regras puras do anexo

**Files:**
- Create: `agente-ia/src/painel/anexo.ts`
- Test: `agente-ia/tests/verificar-anexo.ts` (registrar `verificarAnexo()` em `tests/verificar.ts`)

**Interfaces:**
- Produces:

```ts
export const PAGINAS_AVISO_OCR = 20;
export const LIMITE_CORTE = 60_000;
export const TETO_ANEXO = 200_000;
export const MAX_PAGINAS_OCR = 100; // espelha ferramentas-pdf/src/lib/ferramentas/tesseract.ts:57 (importar de lá se o alias permitir)
export interface PaginaLida { n: number; texto: string; ocr?: boolean }
export interface PlanoLeitura { total: number; comTexto: number[]; paraOcr: number[]; foraDoOcr: number[]; avisar: boolean }
export function planejarLeitura(total: number, temTexto: (n: number) => boolean): PlanoLeitura;
export function montarTexto(paginas: PaginaLida[], extra: { total: number; naoLidas: number[]; semOcr?: boolean }): string;
export type ModoAnexo = "inteiro" | "cortado";
export interface Anexo { nome: string; texto: string; paginas?: number; modo: ModoAnexo }
export function aplicarModo(a: Anexo): { texto: string; aviso?: string; podeCortar: boolean };
export function mensagemDeErroPdf(e: unknown): string;
```

Regras:
- `planejarLeitura`: `paraOcr` = páginas sem texto até `MAX_PAGINAS_OCR` (contadas pela posição na página, como `ocrPdf` faz: só páginas `n <= MAX_PAGINAS_OCR`); `foraDoOcr` = páginas sem texto acima disso; `avisar = paraOcr.length > PAGINAS_AVISO_OCR`.
- `montarTexto`: cada página `[página N]\n<texto>`; página com `ocr: true` ganha `[página N — OCR]`; no topo, se houver OCR: `[texto de N página(s) obtido por OCR; pode conter erros de reconhecimento]`; no fim, se `naoLidas` não vazio: `[páginas não lidas: 3, 7, 120–130]` (faixas contíguas com travessão), com `(este navegador não faz OCR)` quando `semOcr`.
- `aplicarModo`: `inteiro` → texto até `TETO_ANEXO`; `cortado` → até `LIMITE_CORTE`. O corte é no fim da última `[página N]` que cabe inteira (se nem a primeira cabe, corta no limite). Quando corta, acrescenta `[o modelo leu até a página X de Y]` e devolve `aviso`. `podeCortar = modo === "inteiro" && texto.length > LIMITE_CORTE`. Sem marcas de página (`.txt`), corta no limite e o aviso diz o número de caracteres.
- Texto do aviso de tamanho no chip (inteiro e > 60 mil): `"<N mil> caracteres (cerca de <N/4 mil> tokens): o texto vai junto em cada resposta desta conversa."`.
- `mensagemDeErroPdf`: `PasswordException` ou nome `"PasswordException"` → "Este PDF é protegido por senha."; `OperacaoCancelada` → "Leitura cancelada."; outro → "Não foi possível ler este PDF (protegido por senha ou danificado)."

- [ ] **Step 1: Testes:**

```ts
const p = planejarLeitura(130, (n) => n <= 5); // 5 com texto, 125 escaneadas
checar("ocr só até 100", p.paraOcr.length === 95 && p.paraOcr[0] === 6 && p.paraOcr.at(-1) === 100);
checar("fora do ocr", p.foraDoOcr.length === 30 && p.foraDoOcr[0] === 101);
checar("avisa acima de 20", p.avisar === true);
checar("não avisa com 20", planejarLeitura(25, (n) => n <= 5).avisar === false);
checar("digital puro não avisa", planejarLeitura(200, () => true).avisar === false);
const t = montarTexto([{ n: 1, texto: "a" }, { n: 2, texto: "b", ocr: true }], { total: 4, naoLidas: [3, 4], semOcr: false });
checar("marca OCR", t.includes("[página 2 — OCR]") && t.includes("obtido por OCR"));
checar("faixa não lida", t.includes("[páginas não lidas: 3–4]"));
const longo = Array.from({ length: 50 }, (_, i) => `[página ${i + 1}]\n${"x".repeat(3000)}`).join("\n\n");
const c = aplicarModo({ nome: "a.pdf", texto: longo, paginas: 50, modo: "cortado" });
checar("corta no fim de página", c.texto.length <= 60_000 + 80 && c.texto.includes("[o modelo leu até a página 19 de 50]"));
checar("inteiro oferece corte", aplicarModo({ nome: "a.pdf", texto: longo, paginas: 50, modo: "inteiro" }).podeCortar === true);
checar("teto duro", aplicarModo({ nome: "a.pdf", texto: "y".repeat(300_000), modo: "inteiro" }).texto.length <= 200_000 + 80);
checar("senha", mensagemDeErroPdf({ name: "PasswordException" }) === "Este PDF é protegido por senha.");
```

(Ajustar o "página 19" ao cálculo real: 19 páginas de ~3.013 caracteres + separadores cabem em 60 mil; o teste deve conferir o número que a regra produz.)

- [ ] **Step 2:** `npx tsx tests/verificar-anexo.ts` → falha.
- [ ] **Step 3:** Implementar `src/painel/anexo.ts`.
- [ ] **Step 4:** `npm run tipos && npm run verificar` → `ok`.
- [ ] **Step 5:** Commit `feat(agente): regras do anexo (plano de OCR, montagem e corte)`.

---

### Task 2: Leitura do PDF para o anexo

**Files:**
- Modify: `agente-ia/src/painel/pdf.ts` — nova função exportada; `extrairTextoPdf` fica como está.

**Interfaces:**
- Consumes: Task 1 (`planejarLeitura`, `montarTexto`, `PaginaLida`, `PlanoLeitura`); `carregarPdfJs`, `opcoesDocumento` (`@/lib/ferramentas/pdfjs`); `ocrPdf`, `ocrDisponivel` (`@/lib/ferramentas/ocr`), `OperacaoCancelada` (`@/lib/ferramentas/juntar`).
- Produces:

```ts
export interface EtapaLeitura { fase: "abrindo" | "texto" | "ocr"; feitas: number; total: number }
export interface OpcoesAnexoPdf {
  aoProgredir?: (e: EtapaLeitura) => void;
  cancelado?: () => boolean;
  /** Chamado com o plano antes do OCR; devolver false cancela (a pessoa escolheu não continuar). */
  confirmarOcr?: (p: PlanoLeitura) => Promise<boolean>;
}
export async function lerPdfParaAnexo(bytes: Uint8Array, o?: OpcoesAnexoPdf): Promise<{ texto: string; paginas: number }>;
```

Fluxo: abrir com pdf.js (cópia dos bytes, como `textoDoPdf`) → ler texto de cada página até `LIMITE_PAGINAS` guardando `PaginaLida` → `planejarLeitura(total, n => texto da página n não vazio)` → se `paraOcr` vazio, `montarTexto` e fim → se `!ocrDisponivel()`, `montarTexto` com `naoLidas = paraOcr ∪ foraDoOcr` e `semOcr: true` → se `plano.avisar` e `confirmarOcr` devolver false, lançar `OperacaoCancelada` → `ocrPdf({ id: "anexo", nome: "anexo.pdf", tamanho, bytes }, { paginas: MAX_PAGINAS_OCR, aoProgredir: (f, t) => o.aoProgredir?.({ fase: "ocr", feitas: f, total: plano.paraOcr.length }), cancelado: o.cancelado })` → reler o texto do PDF devolvido só nas páginas de `paraOcr` (marcar `ocr: true`) → `montarTexto` com `naoLidas = foraDoOcr` + páginas acima de `LIMITE_PAGINAS`. Cancelar descarta tudo (deixa a `OperacaoCancelada` subir).

Refatorar o laço de leitura de texto de `textoDoPdf` numa função interna `paginasDeTexto(doc, ate): Promise<PaginaLida[]>` usada pelas duas; `extrairTextoPdf` precisa devolver exatamente o mesmo texto de antes.

- [ ] **Step 1:** Não há PDF real nos testes do agente; a prova é a Tarefa 3. Conferir que `extrairTextoPdf` não mudou de saída: os testes de `verificar-baixar.ts`/`verificar-arquivo-remoto.ts` continuam `ok`.
- [ ] **Step 2:** Implementar.
- [ ] **Step 3:** `npm run tipos && npm run verificar` → `ok`.
- [ ] **Step 4:** Commit `feat(agente): leitura de PDF por página para o anexo, OCR só nas digitalizadas`.

---

### Task 3: Anexo de PDF no painel

**Files:**
- Modify: `agente-ia/src/painel/main.ts:195` (tipo do `anexo` passa a `Anexo` da Tarefa 1), `:346-368` (seletor e chip), `:2479-2492` (envio usa `aplicarModo(this.anexo).texto`).
- Modify: `agente-ia/estatico/agente.css` (andamento e aviso no chip, se preciso).
- Create: `agente-ia/src/painel/anexo-ui.ts` — `chipDoAnexo(a: Anexo, acoes: { remover(): void; cortar(): void }): HTMLElement` e `andamentoDoAnexo(nome: string, cancelar: () => void): { elemento: HTMLElement; atualizar(e: EtapaLeitura): void }`.
- Test: acrescentar a `tests/verificar-anexo.ts` (linkedom).

Comportamento:
- `accept` passa a `.pdf,.csv,.txt,.md,.json,.tsv`; título do botão: "Anexar PDF, planilha CSV ou texto".
- `.pdf` (por extensão ou `type === "application/pdf"`): mostra o andamento no lugar do chip ("Abrindo…", "Lendo o texto: página 12 de 80", "OCR: página 7 de 32"), com botão "Cancelar leitura". `confirmarOcr` abre o aviso: "Este PDF tem <N> páginas digitalizadas. O reconhecimento de texto (OCR) roda neste computador e pode deixá-lo lento por alguns minutos." com botões "Continuar" e "Não ler as digitalizadas" (o segundo cancela). Fechar pelo X/Esc = cancelar (sem botão "Cancelar" a mais — `feedback_modal_sem_cancelar`).
- Fim: `this.anexo = { nome, texto, paginas, modo: "inteiro" }` e o chip: `<nome> — <P> páginas · <N> caracteres`, mais a linha de aviso de `aplicarModo` e o botão "Cortar em 60 mil" quando `podeCortar` (clique: `modo = "cortado"` e redesenha).
- Erro: `mensagemDeErroPdf(e)` como aviso no chat (`this.adicionar({ tipo: "aviso", texto })`), nada anexado. Cancelado: só some o andamento.
- Uma leitura por vez: escolher outro arquivo ou remover o anexo cancela a leitura em curso (contador de geração; resultado de geração antiga é descartado).
- `.txt`/`.csv`: guardar o texto inteiro (`modo: "inteiro"`), mesmo chip.

- [ ] **Step 1: Testes (linkedom):** chip de PDF com 312.000 caracteres tem o botão "Cortar em 60 mil" e o texto "cerca de 78 mil tokens"; com 10.000 caracteres não tem o botão; clicar "Cortar em 60 mil" chama `cortar`.
- [ ] **Step 2:** rodar → falha.
- [ ] **Step 3:** Implementar `anexo-ui.ts` e a fiação no `main.ts`.
- [ ] **Step 4:** `npm run tipos && npm run verificar` → `ok`; `npm run build` sem erro.
- [ ] **Step 5: Prova no navegador (Chrome, `dist/` descompactado), com GIF:** (a) PDF digital de ~80 páginas: sem aviso, chip com páginas e "Cortar em 60 mil"; a pergunta é respondida citando o conteúdo; (b) PDF escaneado de 3 páginas: sem aviso, OCR, texto marcado; (c) PDF escaneado de 25+ páginas: aviso aparece; "Não ler as digitalizadas" não anexa nada; (d) PDF misto: só as escaneadas passam pelo OCR (contador "OCR: página x de N" com N = escaneadas); (e) PDF com senha: aviso de senha; (f) trocar de arquivo no meio do OCR: o primeiro não aparece. Conferir na aba de rede que nenhum pedido leva o PDF. Anotar o resultado no fim deste plano.
- [ ] **Step 6:** Commit `feat(agente): anexar PDF no chat com leitura local e OCR`.

---

### Task 4: Histórico de versões

**Files:**
- Modify: `pages/HISTORICO.md` — entrada da próxima versão: "Agente de IA: anexe um PDF à pergunta; o arquivo é lido no seu computador (com OCR nas páginas digitalizadas) e só o texto vai ao modelo."

- [ ] **Step 1:** Editar.
- [ ] **Step 2:** Commit `docs: histórico do anexo de PDF no agente`.

---

## Resultado da prova no navegador (16/10/2026)

Chrome for Testing 1234 com o `dist/` instalado e o pedido ao serviço de IA interceptado (resposta 401 de mentira), PDFs gerados para o teste.

Provado:
- PDF digital de 80 páginas: chip "80 páginas · N caracteres" com "Cortar em 60 mil", sem aviso; o pedido ao serviço levou o texto ("DIGITAL pagina 3 linha 1…") e nenhum PDF cru (`%PDF`/`JVBERi0`); o chip some depois do envio.
- PDF escaneado de 25 páginas: aviso "Este PDF tem 25 páginas digitalizadas…", sem botão Cancelar; "Não ler as digitalizadas" não anexa nada.
- Trocar de arquivo com o OCR em andamento: o escaneado de 25 não reaparece; fica só o arquivo novo, inclusive 20 s depois.
- PDF misto: o andamento do OCR contou só as 2 páginas digitalizadas ("de 2").
- PDF com senha: aviso "Este PDF é protegido por senha." e nada anexado.
- Nenhum erro de página.

NÃO provado — o OCR em si: neste Chrome for Testing o `render` do pdf.js sobre `OffscreenCanvas` nunca termina, e isso acontece também com o OCR original das Ferramentas de PDF (chunk `js/ferramentas-pdf/ocr-*.js`, chamado direto na página `html/ferramentas-pdf.html`), em headless e com janela. É do ambiente de teste ou um defeito anterior a esta branch; precisa ser conferido no Chrome do Pedro: (1) Ferramentas de PDF → OCR num escaneado; (2) anexar um escaneado no chat do Agente. Se (1) travar também, é defeito em produção das Ferramentas de PDF, fora deste escopo.
