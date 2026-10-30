# Agente de IA — sincronia por arquivo: plano de implementação

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** O Agente grava e lê sozinho um `.json` (numa pasta do OneDrive/Drive) com tudo o que tem — conversas, memória, instruções, skills, regras, rotinas, conectores, fluxos —, mais Exportar/Importar manuais.

**Architecture:** O núcleo é puro e testável sem navegador: um "retrato" do que o Agente tem, um "diário" local de carimbos por registro (data de alteração e lápide de exclusão, já que os registros de hoje não têm data) e uma função `mesclar` que decide registro a registro quem vence. Em volta, uma camada fina lê/grava o retrato no `chrome.storage.local` e no IndexedDB do histórico, e a mecânica de arquivo é a da `sei-comum` (`ControleArquivo`), com o Agente fornecendo só o adaptador.

**Tech Stack:** TypeScript, esbuild, testes `tsx tests/verificar.ts` (sem framework; `checar`/`secao` de `tests/util.ts`), linkedom para a tela.

**Spec:** `docs/superpowers/specs/2026-10-16-agente-arquivo-sync-design.md`

## Global Constraints

- Strings com acento em `dist/js/*.js` saem como `\uXXXX` (conferir por bytes no build, não com grep BSD).
- Chave de API e tokens dos conectores só vão ao arquivo com a caixa "Incluir chave de API e tokens dos conectores" marcada **neste computador**; a caixa vem desmarcada e não viaja (nem pelo `storage.sync`, nem pelo arquivo).
- Ler o arquivo sempre mescla; nunca apaga nada local exceto por lápide mais nova que a alteração local.
- Firefox (sem File System Access): só Exportar e Importar; tudo continua funcionando.
- O espelho do `storage.sync` (`src/painel/espelho.ts`) não muda de comportamento.
- Conversas: só a transcrição (`ConversaSalva`), nunca o histórico do modelo nem o mapa de pseudônimos.
- Envelope: `formato: "seipro-agente"`, `versao: 1`. Nome sugerido do arquivo: `sei-pro-agente.json`.
- Comando de verificação de cada tarefa: `cd agente-ia && npm run tipos && npm run verificar` (todas as linhas `ok`, nenhuma `FALHA`).

## Review Focus

1. **Laço de gravação:** gravar o status do arquivo ou o diário dispara `storage.onChanged` → `agendar()` → grava status → … O gatilho tem de ignorar as chaves do próprio arquivo (teste na Tarefa 4).
2. **Ida e volta pelo `storage.sync`:** importar do arquivo grava no local, `guardar*` espelha no sync, o sync volta pelo `onChanged`, e o diário vê "mudança" se o `doSync` remontar o registro diferente (ex.: conector sem token). `carimbar` sobre o mesmo retrato duas vezes não pode mudar carimbo (teste na Tarefa 1).
3. **Poda virando exclusão:** `historico.podar` apaga conversa velha; o `carimbar` não pode transformar isso em lápide que apague a conversa do outro computador (teste na Tarefa 1).
4. **Arquivo de outra versão / corrompido / vazio / de outro módulo** (um `favoritos.json` escolhido por engano): `ler` devolve `null` → "ilegível" do módulo comum regrava a partir daqui sem apagar nada local; versão maior não é tocada (teste na Tarefa 2).
5. **Conector importado com token no arquivo e caixa desmarcada aqui:** o token não entra; o conector chega como "sem autenticação" (mesma regra do `doSync` do espelho) e o token continua no arquivo (teste na Tarefa 1).

---

### Task 1: Núcleo puro — envelope, diário e mescla

**Files:**
- Create: `agente-ia/src/arquivo/envelope.ts`
- Test: `agente-ia/tests/verificar-arquivo-agente.ts` (registrar `verificarArquivoAgente()` em `tests/verificar.ts`)

**Interfaces:**
- Consumes: `Config` (`src/painel/main.ts:83`), `configParaSync`/`configDoSync` (`src/painel/espelho.ts`), `ConversaSalva` (`src/painel/historico.ts`), tipos `SkillUsuario`, `ColecaoSkills`, `Regra`, `Lembranca`, `Rotina`, `Conector`, `Fluxo`, `ColecaoFluxos`, `Ignorados`.
- Produces:

```ts
export const FORMATO = "seipro-agente";
export const VERSAO = 1;
export type TipoLista = "skills" | "colecoes" | "regras" | "memoria" | "rotinas" | "conectores" | "fluxos" | "colecoesFluxos" | "conversas";
export const TIPOS: TipoLista[];
export interface Registro { id: string; em: number; apagado?: true; dado?: unknown }
export interface Unico<T> { em: number; dado: T }
export interface Segredos { em: number; chave?: string; tokens?: Record<string, string> }
export interface EnvelopeAgente {
  formato: typeof FORMATO; versao: number; geradoEm: number;
  config?: Unico<Omit<Config, "chave">>;
  ignorados?: Unico<Ignorados>;
  registros: Record<TipoLista, Registro[]>;
  segredos?: Segredos;
}
/** Carimbo local por registro: `h` = hash do dado como vai ao arquivo. */
export interface Marca { em: number; h: string; apagado?: true }
export type Diario = Record<string, Record<string, Marca>>; // tipo ("config", "ignorados", TipoLista) → id → marca
export interface Retrato {
  config: Config;
  ignorados: Ignorados;
  listas: { skills: SkillUsuario[]; colecoes: ColecaoSkills[]; regras: Regra[]; memoria: Lembranca[]; rotinas: Rotina[]; conectores: Conector[]; fluxos: Fluxo[]; colecoesFluxos: ColecaoFluxos[]; conversas: ConversaSalva[] };
}
export interface OpcoesMescla { agora: number; segredos: boolean; removerSegredos?: boolean }
export function carimbar(r: Retrato, d: Diario, agora: number): Diario;
export function mesclar(local: Retrato, d: Diario, lido: EnvelopeAgente | null, o: OpcoesMescla): { retrato: Retrato; diario: Diario; envelope: EnvelopeAgente; mudouLocal: boolean };
export function lerEnvelope(bruto: unknown): EnvelopeAgente | null;
export function assinatura(e: EnvelopeAgente): string;
```

Regras que a implementação segue (do spec, seção "Decisões do Claude depois da revisão"):
- `dado` de cada registro é o registro inteiro, exceto: conector sem `auth.valor` (o token vai para `segredos.tokens[id]`); a config vai por `configParaSync` (sem `chave`; a chave vai para `segredos.chave`).
- `carimbar`: para cada tipo/id, `h = JSON.stringify(dado)`; hash diferente do diário ⇒ `em = agora`; id no diário que sumiu do retrato ⇒ lápide (`apagado`, `em = agora`), **exceto** em `conversas` quando `local.config.guardar` é falso (não carimba nada de conversas) ou quando a marca tem `em < agora - config.dias*86_400_000` com `dias > 0` (poda: a marca sai do diário sem lápide).
- `mesclar`: chama `carimbar`; depois, por tipo/id, vence o de `em` maior (empate: fica o local). Registro do arquivo que vence entra no retrato (ou sai, se lápide) e o diário recebe a marca do arquivo. Conversas: com `guardar` falso não importa nem exporta as daqui — o envelope leva as conversas do arquivo como vieram; com `dias > 0`, conversa do arquivo com `dado.quando` mais velho que o prazo não entra no retrato, mas fica no envelope. Lápides ficam no envelope (sem `dado`).
- Config: vence por `em`; aplicar com `configDoSync(dado, local.config)` (preserva a chave e o serviço daqui). `ignorados`: vence por `em`.
- Segredos: `o.segredos` verdadeiro ⇒ envelope leva `{ em, chave: config.chave, tokens }` deste computador; se o local não tem chave e o arquivo tem, a chave entra no retrato (idem token de conector com `auth.tipo === "token"` e valor vazio, e conector que chegou como `nenhuma` mas cujo id tem token no arquivo volta a `token` com o cabeçalho do registro). `o.segredos` falso ⇒ não importa e copia `lido.segredos` intacto para o envelope. `o.removerSegredos` ⇒ envelope sem `segredos`.
- `assinatura`: `JSON.stringify` do envelope sem `geradoEm`.
- `lerEnvelope`: `null` se `formato` diferente, `registros` ausente ou não-objeto; tipo ausente vira `[]`; registro sem `id` string ou `em` número é descartado.

- [ ] **Step 1: Escrever os testes**

Fábrica `retrato(p?)` com config padrão (`guardar: true, dias: 30, chave: "sk-aqui"`) e listas vazias; fábrica de diário vazio. Casos (cada um um `checar`):

```ts
// a) exportar do zero: envelope tem a skill, sem chave (segredos: false)
const r1 = mesclar(retrato({ skills: [skill()] }), {}, null, { agora: 100, segredos: false });
checar("skill vai ao arquivo", r1.envelope.registros.skills[0].id === "s1");
checar("sem segredos por padrão", r1.envelope.segredos === undefined && !JSON.stringify(r1.envelope).includes("sk-aqui"));
// b) carimbar é idempotente
const d1 = carimbar(retrato({ skills: [skill()] }), {}, 100);
checar("carimbo estável", carimbar(retrato({ skills: [skill()] }), d1, 200).skills.s1.em === 100);
// c) exclusão local vira lápide e o arquivo não ressuscita
const r2 = mesclar(retrato({ skills: [] }), d1, r1.envelope, { agora: 300, segredos: false });
checar("lápide no envelope", r2.envelope.registros.skills[0].apagado === true && r2.retrato.listas.skills.length === 0);
// d) lápide do arquivo mais nova apaga aqui
const r3 = mesclar(retrato({ skills: [skill()] }), d1, r2.envelope, { agora: 400, segredos: false });
checar("lápide remota apaga", r3.retrato.listas.skills.length === 0 && r3.mudouLocal);
// e) edição mais nova do arquivo vence; mais velha perde
// f) poda: conversa com quando=1 e dias=30, agora=40 dias depois, sumida do retrato → sem lápide
// g) guardar=false: conversas do arquivo ficam no envelope e não entram no retrato
// h) conversa do arquivo mais velha que o prazo daqui não entra no retrato e fica no envelope
// i) segredos=true: envelope.segredos.chave === "sk-aqui" e tokens[c1] === "Bearer segredo"
// j) segredos=false com lido.segredos: copia intacto, não importa a chave (retrato.config.chave continua "")
// k) removerSegredos: envelope sem segredos
// l) config: instrucoes mais nova do arquivo entra; chave local preservada
// m) lerEnvelope: favoritos ({formato:"seipro-favoritos"}) → null; registros sem "fluxos" → []; registro sem em → descartado
// n) assinatura ignora geradoEm
```

- [ ] **Step 2:** `cd agente-ia && npx tsx tests/verificar-arquivo-agente.ts` → falha (módulo não existe).
- [ ] **Step 3:** Implementar `src/arquivo/envelope.ts` com as assinaturas e regras acima (puro: sem `chrome`, sem `indexedDB`, sem `Date.now()` — o tempo vem de `o.agora`).
- [ ] **Step 4:** `npm run tipos && npm run verificar` → todas `ok`.
- [ ] **Step 5:** Commit `feat(agente): núcleo da sincronia por arquivo (envelope, diário e mescla)`.

---

### Task 2: Retrato real e adaptador do arquivo

**Files:**
- Modify: `agente-ia/src/painel/historico.ts` — `export async function todas(): Promise<ConversaSalva[]>` (resumos + itens, todas) e `export async function gravarVarias(novas: ConversaSalva[], removidas: string[]): Promise<void>` (uma transação).
- Create: `agente-ia/src/arquivo/retrato.ts`
- Create: `agente-ia/src/arquivo/adaptador.ts`
- Test: acrescentar a `tests/verificar-arquivo-agente.ts`

**Interfaces:**
- Consumes: Task 1 inteira; `listar*`/`guardar*` de cada armazenamento (`listarSkills`/`guardarSkills`, `listarColecoes`/`guardarColecoes`, `listarRegras`/`guardarRegras`, `listarMemoria`/`guardarMemoria`, `listarRotinas`/`guardarRotinas`, `listarConectores`/`guardarConectores`, `listarFluxos`/`guardarFluxos`, `listarColecoesDeFluxos`/`guardarColecoesDeFluxos`, `listarIgnorados`/`guardarIgnorados`), `CHAVE_CONFIG = "agenteIA_config"` (exportar de `main.ts` ou mover para um `src/painel/config.ts` junto do tipo, se o import circular incomodar).
- Produces:

```ts
// retrato.ts
export const CHAVE_DIARIO = "agenteIA_arquivoDiario";
export const CHAVE_SEGREDOS = "agenteIA_arquivoSegredos"; // boolean, só local
export const CHAVE_STATUS = "agenteIA_arquivoStatus";
export interface FontesRetrato { lerRetrato(): Promise<Retrato>; aplicar(antes: Retrato, depois: Retrato): Promise<void>; lerDiario(): Promise<Diario>; gravarDiario(d: Diario): Promise<void>; segredos(): Promise<boolean> }
export function fontesDoNavegador(): FontesRetrato; // chrome.storage.local + historico
// adaptador.ts
export function adaptadorAgente(f: FontesRetrato, agora?: () => number): AdaptadorArquivo<EnvelopeAgente> & { removerSegredosNaProxima(): void };
```

- `aplicar` grava só as listas que mudaram (comparar por `JSON.stringify`), pelas funções `guardar*` (que já espelham no sync), e conversas por `gravarVarias`. A config vai direto a `chrome.storage.local.set({ agenteIA_config })` — o painel relê pelo `onChanged` (Task 4).
- `importar(env)`: lê retrato e diário, `mesclar`, `aplicar` se `mudouLocal`, grava diário. `exportar(lido)`: lê de novo, `mesclar` (o local já está atualizado), devolve `{ envelope, outros: 0 }`. `ler: lerEnvelope`. `formato`/`versao` de Task 1.

- [ ] **Step 1: Testes** com `FontesRetrato` falsa em memória (sem chrome): `SincroniaArquivo` da `@comum/sincronia/arquivo` com `ArquivoSync` em memória e `areaMemoria()`:
  - arquivo vazio → grava envelope com a skill local; status `ok`.
  - arquivo com `{"formato":"seipro-favoritos",...}` → regravado, mensagem "ilegível… regravado", retrato local intacto.
  - arquivo com `versao: 2` → status `erro` com a mensagem `maisNovo`, arquivo não gravado.
  - segunda sincronização sem mudança → `gravar` do arquivo não é chamado de novo.
  - dois "computadores" (duas fontes falsas) e um arquivo: A cria regra, sincroniza; B sincroniza e passa a ter a regra; B apaga, sincroniza; A sincroniza e perde a regra.
- [ ] **Step 2:** rodar → falha.
- [ ] **Step 3:** Implementar `historico.todas`/`gravarVarias`, `retrato.ts`, `adaptador.ts`.
- [ ] **Step 4:** `npm run tipos && npm run verificar` → `ok`.
- [ ] **Step 5:** Commit `feat(agente): retrato do agente e adaptador do arquivo`.

---

### Task 3: Seção "Backup em arquivo" nas configurações

**Files:**
- Create: `agente-ia/src/painel/arquivo-ui.ts`
- Modify: `agente-ia/src/painel/main.ts` — novo `grupo("Backup em arquivo", …)` logo depois de "Conversas e rotinas" (`~:1557`); atualizar a nota de `~:1570` ("Ficam SÓ aqui…") para dizer que isso vai para o arquivo, se ele estiver ligado.
- Modify: `agente-ia/estatico/agente.css` se precisar de estilo novo (reaproveitar `.campo`, `.linha-switch`, `.nota`, `.com-botao`).
- Test: `agente-ia/tests/verificar-arquivo-ui.ts` (linkedom, no molde de `verificar-rotinas-ui.ts`; registrar em `tests/verificar.ts`)

**Interfaces:**
- Produces:

```ts
export interface OpcoesArquivoUi {
  temSeletor: boolean; // temSeletorDeArquivo(window)
  configurado(): Promise<boolean>;
  status(): Promise<StatusArquivo | null>;
  escolher(modo: "novo" | "existente"): Promise<void>;
  reconectar(): Promise<void>;
  agora(): Promise<void>;
  esquecer(): Promise<void>;
  segredos: { ler(): Promise<boolean>; gravar(v: boolean): Promise<void> };
  removerSegredos(): Promise<void>;
  exportar(): Promise<void>;
  importar(arquivo: File): Promise<string>; // devolve a mensagem para o usuário
}
export function secaoArquivo(o: OpcoesArquivoUi): { elemento: HTMLElement; redesenhar: () => void };
```

Textos (exatos):
- Explicação: "Grava tudo do agente — conversas, memória, instruções, skills, regras, rotinas, conectores e fluxos — num arquivo seu. Escolha um arquivo numa pasta do OneDrive ou do Google Drive e ele chega aos seus outros computadores."
- Botões sem arquivo: "Criar arquivo" (`escolher("novo")`), "Usar arquivo existente" (`escolher("existente")`). Com arquivo: nome + situação, "Sincronizar agora", "Esquecer arquivo"; estado `permissao` mostra "Reconectar arquivo".
- Caixa: "Incluir a chave de API e os tokens dos conectores", com `small`: "Vale só neste computador. Quem tiver acesso à pasta do arquivo poderá usar a chave."
- "Remover segredos do arquivo", com aviso: "Se outro computador estiver com a opção marcada, ele os grava de novo."
- Sempre: "Exportar (.json)" e "Importar arquivo". Sem seletor (Firefox): só esses dois e a frase "Este navegador não grava direto num arquivo; use Exportar e Importar."
- Situação: `ok` → "Sincronizado às HH:MM"; `erro` → a `mensagem`; `permissao` → a mensagem do módulo comum.

- [ ] **Step 1: Testes:** sem seletor não há "Criar arquivo"; com seletor e não configurado há "Criar arquivo" e "Usar arquivo existente"; status `permissao` mostra "Reconectar arquivo" e o clique chama `reconectar`; marcar a caixa chama `segredos.gravar(true)`; "Remover segredos do arquivo" chama `removerSegredos`.
- [ ] **Step 2:** rodar → falha.
- [ ] **Step 3:** Implementar `secaoArquivo` com `h`/`icone` de `src/painel/dom.ts`.
- [ ] **Step 4:** `npm run tipos && npm run verificar` → `ok`.
- [ ] **Step 5:** Commit `feat(agente): seção de backup em arquivo nas configurações`.

---

### Task 4: Ligar ao painel — gatilhos, Exportar/Importar

**Files:**
- Create: `agente-ia/src/arquivo/gatilho.ts`
- Modify: `agente-ia/src/painel/main.ts` — criar o controle em `iniciar` (perto de `:300-330`), sincronizar ao abrir e em `window` `focus`, `agendar()` nos gatilhos, passar `OpcoesArquivoUi` para a seção da Task 3; chamar `agendar()` depois de `guardarConversa`, `historico.remover`, `historico.limpar` e `historico.podar` (só quando `podar` devolver > 0 não precisa — a poda é local; pode chamar igual, é inofensivo).
- Test: acrescentar a `tests/verificar-arquivo-agente.ts`

**Interfaces:**
- Consumes: Task 2 (`adaptadorAgente`, `fontesDoNavegador`, `CHAVE_*`), Task 3 (`secaoArquivo`), `ControleArquivo`, `handlesNoIndexedDB`, `escolherArquivoSync`, `temSeletorDeArquivo`, `areaChrome` da `sei-comum`.
- Produces:

```ts
export const CHAVES_DO_AGENTE: string[]; // agenteIA_config, _memoria, _skills, _colecoes, _regras, _mcp, _rotinas, _fluxos, _fluxosIgnorados, _fluxosColecoes
/** A mudança no local deve agendar a gravação do arquivo? Nunca para CHAVE_STATUS, CHAVE_DIARIO, CHAVE_SEGREDOS. */
export function deveAgendar(chavesMudadas: string[]): boolean;
```

Detalhes:
- `ControleArquivo` com `dono: { host: "agente", login: "" }`, `chaveStatus: CHAVE_STATUS`, `handles: handlesNoIndexedDB("agenteIA_arquivo")` (banco próprio: o `agenteIA` já tem versão 1 com outras lojas), `escolher: (m) => escolherArquivoSync(m, "sei-pro-agente.json", "Agente do SEI Pro")`. Só existe quando `temSeletorDeArquivo(window)`.
- No `onChanged` (`main.ts:314`): `area === "local" && deveAgendar(Object.keys(mud))` ⇒ `controle?.agendar()`. Se `mud.agenteIA_config` mudou e o valor difere de `this.config`, recarregar `this.config` (o arquivo pode ter trazido config) e chamar os `redesenharConfig`. Depois de uma sincronização que mudou o local, recarregar as listas do painel (mesma sequência de `listar*` de `:300-306`).
- Exportar: `mesclar(retrato, diario, null, { agora, segredos })` → `Blob` JSON → `<a download="sei-pro-agente.json">` (sem `chrome.downloads`). Importar: `<input type=file accept=".json">` → `JSON.parse` → `lerEnvelope` → `null` dá "Este arquivo não é um backup do Agente do SEI Pro."; senão `adaptador.importar` e "Backup importado: o que era mais novo no arquivo entrou; nada daqui foi apagado sem uma exclusão mais nova."
- `removerSegredos`: `adaptador.removerSegredosNaProxima()` e `controle.sincronizar()`; sem controle (Firefox), não aparece.

- [ ] **Step 1: Testes:** `deveAgendar(["agenteIA_arquivoStatus"]) === false`; `deveAgendar(["agenteIA_arquivoDiario"]) === false`; `deveAgendar(["agenteIA_memoria"]) === true`; `deveAgendar(["agenteIA_cambio"]) === false`.
- [ ] **Step 2:** rodar → falha.
- [ ] **Step 3:** Implementar `gatilho.ts` e a fiação no `main.ts`.
- [ ] **Step 4:** `npm run tipos && npm run verificar` → `ok`; `npm run build` sem erro.
- [ ] **Step 5: Prova no navegador (Chrome, extensão descompactada do `dist/`):** criar arquivo; mandar uma pergunta; conferir no `.json` a conversa e a memória, sem `sk-` nenhum; marcar a caixa e conferir `segredos.chave`; apagar uma regra e conferir a lápide; colar no arquivo (editando à mão) uma regra nova com `em` maior e voltar o foco ao painel → a regra aparece. Exportar e Importar num perfil limpo. Anotar o resultado no fim deste plano.
- [ ] **Step 6:** Commit `feat(agente): sincronia por arquivo ligada ao painel, Exportar e Importar`.

---

### Task 5: Textos de privacidade e histórico de versões

**Files:**
- Modify: `agente-ia/src/painel/espelho.ts:11-13` (comentário "a política de privacidade promete que a chave nunca sai deste navegador") e `agente-ia/README.md` (mesmo trecho) — passam a dizer: "a chave e os tokens só saem deste navegador se o usuário marcar a opção de incluí-los no arquivo de backup".
- Modify: `pages/HISTORICO.md` — entrada da próxima versão: backup do Agente em arquivo.

- [ ] **Step 1:** Editar os textos.
- [ ] **Step 2:** `npm run verificar` → `ok`.
- [ ] **Step 3:** Commit `docs(agente): privacidade e histórico do backup em arquivo`.
- [ ] **Step 4:** Avisar o Pedro: a política de privacidade (`PRIVACY_POLICY`) é editada pela web e precisa do mesmo ajuste lá — não editar o arquivo local.

---

## Resultado da prova no navegador (16/10/2026)

Chrome for Testing 1234 (headless) com o `dist/` instalado; o "arquivo do usuário" foi um arquivo do OPFS guardado no banco `agenteIA_arquivo` como se tivesse sido escolhido (o seletor nativo não é automatizável). 22 de 22 verificações:

- Computador A: o arquivo é gravado ao abrir o painel com memória, regras, conversa e instruções; sem a chave com a caixa desmarcada; status `ok`; caixa marcada leva a chave; regra apagada vira lápide em ~15 s; a chave já gravada é preservada ao desmarcar; regra acrescentada no arquivo com carimbo maior entra ao reabrir, e a apagada não volta; nenhum erro de página.
- Computador B (perfil limpo, Importar pela seção "Backup em arquivo"): regras, memória, instruções e conversa importadas; a chave de B preservada; mensagem "Backup importado…" exibida; nenhum erro de página.
- Não provado no navegador: o seletor nativo ("Criar arquivo"/"Usar arquivo existente") e o pedido de permissão ("Reconectar arquivo") — exigem clique humano.
- Observado na montagem da prova: gravar direto no `chrome.storage.local` sem passar pelos `guardar*` (sem espelhar) faz a sincronia da conta remover o item na abertura seguinte — comportamento anterior do espelho, não desta mudança.
