# Processos em Lote, etapa 2 (modelos salvos e ações depois da criação) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Acrescentar ao Processos em Lote (já validado) modelos de lote salvos e ações opcionais depois da criação (incluir em bloco interno, aplicar marcador, acompanhar).

**Architecture:** Mesmo molde da etapa 1: o laço e a UI ficam no app (`processos-lote/src/app`), tudo que fala com o SEI fica no content script (`src/pagina`) sobre o `sei-nucleo`. A inclusão de processos em bloco interno é código novo no `sei-nucleo` (o núcleo só tinha documentos em bloco de assinatura). Marcador e acompanhamento reaproveitam `definirMarcador` e `definirAcompanhamento` do núcleo.

**Tech Stack:** TypeScript, esbuild, tsx + linkedom (provas sem framework), biome.

**Spec:** `docs/superpowers/specs/2026-10-16-lote-ts-design.md` (seção 8). Etapa 1: `docs/superpowers/plans/2026-10-16-lote-ts.md`. Provas: `docs/superpowers/specs/2026-10-16-lote-ts-provas.md`.

## Global Constraints

- Mesmas restrições globais da etapa 1: JS gerado em `dist/` só ASCII (portão do `build.mjs`), banners, DOM seguro (`h()`), modal sem Cancelar, pt-BR, `dist/manifest.json` só no Lab, nada de `git add -A`, `biome --write` nunca em arquivos com `\uXXXX`.
- **Regra de ouro herdada da etapa 1: nunca duplicar nem corromper dados reais do SEI.** Ação depois da criação roda só sobre processos com número confirmado (`ok` sem `incerto`); nunca em linha incerta.
- Cada ação é opcional, independente das outras, e idempotente quando o SEI permite (marcador: atualiza o texto; acompanhamento: atualiza o grupo; bloco: processo já no bloco é relatado como "já estava", não como erro).
- Resultado por processo e por ação: `ok | ja-estava | erro` com mensagem; falha de uma ação não impede as outras nem desfaz a criação.
- Ações depois da criação NÃO fazem parte do lote persistido para retomada (etapa 1): rodam depois, sobre os processos criados; se o modal fechar no meio, o usuário reabre o resultado e repete (a repetição é segura pela regra acima).

## Fatos do SEI comprovados no MJ 5.0.4 (16/10/2026), não re-derivar

Inclusão de **processos** em bloco interno (não existe link na árvore do processo; é pela tela do Controle de Processos):
- O formulário `#frmProcedimentoControlar` (tela `procedimento_controlar`, link do menu) tem listas `Recebidos` e `Gerados`: campos `hdn{Lista}Itens` (todos os ids da página, separados por vírgula), `hdn{Lista}ItensHash` (assinatura: reenviar SEM mudar), `hdn{Lista}ItensSelecionados` (ids marcados) e uma caixa `chk{Lista}Item<N>` (`value` = id_procedimento) por linha. Também `hdnIdBloco` e `txtBloco` (vazios).
- Os processos recém-criados aparecem em **Gerados** (e, conforme a unidade, em Recebidos). Só entram os que estão na página atual (padrão 100 por página).
- Os blocos para escolher vêm da tela `bloco_selecionar_processo&tipo_selecao=1&id_object=objLupaBlocoPesquisa` (link assinado achado no HTML cru do Controle): formulário `#frmBlocoLista`, tabela com colunas `Número | Tipo | Descrição | Ações`, um `input[type=radio][name=chkInfraItem]` por linha (`value` = id do bloco) — a lista mistura blocos **Interno** e **Reunião**; só `Interno` serve.
- A inclusão é um POST do formulário do Controle, com todos os campos do formulário como estão (menos botões e caixas desmarcadas), mais: `hdn{Lista}ItensSelecionados=<ids, separados por vírgula>`, a caixa `chk{Lista}Item<N>=<id>` de cada processo marcado e `hdnIdBloco=<id do bloco>`, para o link assinado `controlador.php?acao=rel_bloco_protocolo_cadastrar&acao_origem=procedimento_controlar&acao_retorno=procedimento_controlar&...` (achado no HTML cru, dentro de `finalizarSelecao`).
- Prova de sucesso: URL final com `acao=rel_bloco_protocolo_listar` e `acao_origem=rel_bloco_protocolo_cadastrar` e `id_bloco=<id>`; a página (título "Processos do Bloco Interno N") lista o processo.
- Marcador e acompanhamento: links na árvore do processo (`andamento_marcador_gerenciar`, `acompanhamento_gerenciar`), já tratados por `definirMarcador` / `definirAcompanhamento` (`sei-nucleo/src/dominio/acoesProcesso.ts`; `OpcoesEscrita = { aplicar: boolean; sinal? }`; `referencia` = protocolo do processo; `listarOpcoes(sei, "marcadores" | "grupos_acompanhamento", refProcesso)` dá as listas).

## Review Focus

- Processo criado que não aparece na página do Controle (mais de 100 processos, ordem diferente): a inclusão em bloco deve dizer "não está na página do Controle" por processo, sem incluir outro por engano.
- Lista de blocos com blocos Interno e Reunião, estados diferentes e descrições com acento (latin-1).
- Dupla execução do botão da ação, ou ação repetida depois de um fechamento: idempotência (nada duplicado; "já estava").
- Marcador/grupo/bloco que sumiu entre escolher e aplicar: erro por processo, sem derrubar o resto.
- Modelo salvo cujo tipo ou hipótese não existe mais: avisar, não aplicar em silêncio.
- Nome de modelo duplicado, vazio ou enorme.

---

## Task 17: Modelos salvos de lote

**Files:**
- Create: `processos-lote/src/modelos.ts`, `processos-lote/tests/verificar-modelos.ts`
- Modify: `processos-lote/src/app/configuracao.ts`, `processos-lote/src/app/app.ts`, `processos-lote/src/app/main.ts`, `processos-lote/estatico/processos-lote.css`, `processos-lote/tests/verificar-app.ts`, `processos-lote/tests/verificar.ts`

**Interfaces:**
- Produces:
```ts
export interface PosAcoes { marcador?: { id: string; nome: string; texto: string }; acompanhar?: { grupo: string; nomeGrupo: string; observacao: string }; bloco?: { id: string; descricao: string } } // preenchido na Task 21; aqui só o tipo
export interface ModeloLote { id: string; nome: string; criadoEm: number; parametros: Parametros /* de repositorio.ts */; posAcoes?: PosAcoes }
export class RepositorioModelos {
  constructor(area: Area, escopo: string);                    // escopo `${host}|${login}`, mesma validação do RepositorioLote
  listar(): Promise<ModeloLote[]>;                            // por nome, sem acento/caixa
  salvar(nome: string, parametros: Parametros, posAcoes?: PosAcoes): Promise<ModeloLote>; // mesmo nome (sem acento/caixa) substitui; nome 1..80 caracteres após trim, senão lança ErroModelo
  renomear(id: string, nome: string): Promise<ModeloLote | null>;
  apagar(id: string): Promise<boolean>;
}
```
Chaves `lote/modelos/<escopo>/<id>` (uma por modelo); leitura defensiva (dado corrompido é ignorado, nunca lança); gravações serializadas por instância como no `RepositorioLote`.

- [ ] **Step 1: Provas (falham).** Ida e volta; substituir pelo mesmo nome (`"Contratos"` e `"contratos"`); nome vazio/81 caracteres lança; modelo corrompido ignorado; escopos isolados; `renomear` para nome já usado por outro modelo lança; `apagar` devolve `false` para id inexistente; gravações sobrepostas (`Promise.all` de 3 `salvar`) persistem as três.
- [ ] **Step 2:** Rodar; Expected: FALHA. **Step 3:** Implementar `modelos.ts`. **Step 4:** Rodar; Expected: PASS.
- [ ] **Step 5: UI na tela de configuração** (`configuracao.ts`): linha "Modelo" acima do tipo, com combo dos modelos (placeholder "sem modelo"), botões **Salvar como modelo…** (pede o nome num diálogo do app, `abrirModal`), **Renomear** e **Apagar** (confirmação) visíveis só com um modelo escolhido. Aplicar um modelo: escolhe o tipo (carrega o formulário pelo `formTipo`), nível, hipótese e pausa; se o tipo (ou a hipótese) do modelo não existe mais na lista carregada, **não aplica nada daquilo** e mostra "O tipo deste modelo não existe mais nesta unidade." no próprio formulário. O modelo guarda só parâmetros (nunca as linhas). Provas no app: aplicar preenche tipo/nível/hipótese/pausa; tipo ausente avisa e não muda o tipo atual; salvar, renomear e apagar refletem no combo.
- [ ] **Step 6:** `npm run verificar`, `tipos`, `checar` em `processos-lote`. Commit `processos-lote: modelos salvos de lote`.

## Task 18: Núcleo: incluir processos em bloco interno

**Files:**
- Create: `sei-nucleo/src/dominio/blocoProcessos.ts`, `sei-nucleo/tests/verificar-bloco-processos.ts`, `sei-nucleo/tests/fixtures/sei5/controle_gerados.html`, `sei-nucleo/tests/fixtures/sei5/bloco_selecionar_processo.html`, `sei-nucleo/tests/fixtures/sei5/rel_bloco_protocolo_listar.html`
- Modify: `sei-nucleo/src/index.ts` (exportar), `sei-nucleo/tests/verificar.ts` (registrar)

**Interfaces:**
- Produces:
```ts
export interface BlocoInterno { id: string; numero: string; descricao: string }
export type ResultadoInclusao = { idProcedimento: string; situacao: "incluido" | "ja-estava" | "fora-da-pagina" | "erro"; erro?: string };
export async function listarBlocosInternosParaProcessos(sei: Sei, op?: OpcoesHttp): Promise<BlocoInterno[]>;  // só tipo "Interno"; pelo link bloco_selecionar_processo do HTML cru do Controle
export async function incluirProcessosEmBlocoInterno(sei: Sei, idBloco: string, idsProcedimento: string[], op?: OpcoesHttp): Promise<ResultadoInclusao[]>;
```
`incluirProcessosEmBlocoInterno`: busca o Controle uma vez (`sei.linkMenu("procedimento_controlar")`), acha o link `rel_bloco_protocolo_cadastrar` no HTML cru (`linkDaAcao`/regex sobre `html`, decodificando `&amp;`), monta os pares do `#frmProcedimentoControlar` conforme "Fatos do SEI" (todos os campos como estão; caixas só dos ids marcados; `hdn{Lista}ItensSelecionados`; `hdnIdBloco`), POST uma vez com **todos** os ids que estão na página (Gerados e Recebidos; id que não está em nenhuma lista => `fora-da-pagina`, sem POST para ele). Prova de sucesso pela URL final (acima). Antes de postar, confere pela tela do bloco (`rel_bloco_protocolo_listar&id_bloco=<id>`, link assinado em `acaoNaArvore`? não: ache o link no HTML do Controle ou da resposta; se não houver, pule a conferência prévia) quais ids já estão no bloco => `ja-estava`. Falha de rede/validação => todos os ids pendentes viram `erro` com a mensagem (um POST só: nada a repetir). Não lança por causa de um id; lança `ErroSei` só para erros que impedem tudo (sem formulário, bloco inexistente na lista).

- [ ] **Step 1: Fixtures sintéticas** (sem nomes de pessoas nem números reais) seguindo exatamente os fatos acima: Controle com `#frmProcedimentoControlar`, listas Recebidos (2 linhas) e Gerados (3 linhas), campos `hdn*` com hashes falsos, `hdnIdBloco`, e o `<script>` com `finalizarSelecao` contendo o link `rel_bloco_protocolo_cadastrar` com `&amp;`; tela de blocos com 4 linhas (2 Interno, 1 Reunião, 1 Interno de descrição acentuada) e radios `chkInfraItem`; resposta de sucesso (`rel_bloco_protocolo_listar`) listando os ids incluídos.
- [ ] **Step 2: Provas (falham)** com `Http` falso: lista só `Interno`, ids e descrições certos; inclusão de 2 ids da lista Gerados: um POST, pares exatos (campos originais + `hdnGeradosItensSelecionados="id1,id2"` + as duas caixas + `hdnIdBloco`), resultado `incluido` para os dois; id fora das listas => `fora-da-pagina` e não vai no POST; id já no bloco => `ja-estava` e não vai no POST; resposta com URL final diferente => todos `erro`; bloco inexistente => lança; nenhum POST quando todos os ids são `fora-da-pagina`/`ja-estava`.
- [ ] **Step 3:** Implementar. **Step 4:** Rodar `cd sei-nucleo && npm run verificar`, `tipos`, `checar`; Expected: PASS. Commit `sei-nucleo: incluir processos em bloco interno`.

## Task 19: Lado da aba: opções e execução das ações

**Files:**
- Create: `processos-lote/src/pagina/posAcao.ts`, `processos-lote/tests/verificar-pos-acao.ts`
- Modify: `processos-lote/src/pagina/executor.ts` (novas operações), `processos-lote/tests/verificar.ts`

**Interfaces:**
- Consumes: Task 18; `definirMarcador`, `definirAcompanhamento`, `listarOpcoes`, `marcadoresDoProcesso` do núcleo.
- Produces (operações RPC novas, tudo JSON simples):
  - `posAcaoOpcoes({ protocolo })` → `{ marcadores: {id,nome}[], grupos: {id,nome}[], blocos: {id,numero,descricao}[], avisos: string[] }`; cada lista é independente (erro numa vira lista vazia + aviso); `protocolo` = qualquer processo criado.
  - `posAcao({ acao: "marcador"|"acompanhar", protocolo, idProcedimento, marcador?, texto?, grupo?, observacao? })` → `{ situacao: "ok"|"ja-estava"|"erro", mensagem, parar? }` (um processo por chamada; `aplicar: true`; marcador já igual => `ja-estava`; bloco NÃO passa por aqui, tem a operação própria abaixo).
  - `posAcaoBloco({ idBloco, idsProcedimento: string[] })` → `ResultadoInclusao[]` (uma chamada para todos os ids: um POST).
- Regra: nenhuma operação aceita linha incerta (o app só envia processos `ok` com `idProcedimento` e número reais; se `idProcedimento` vier vazio => `erro` sem rede). Erros do núcleo viram `erro` com a mensagem, nunca excecão pela ponte. Sessão expirada => `{situacao:"erro", parar:true}`.

- [ ] **Step 1: Provas (falham)** com `Sei`/funções do núcleo injetados (como `ChamadasSei` da etapa 1): cada operação mapeia sucesso, "já igual", erro e sessão expirada; `posAcaoOpcoes` com uma lista falhando devolve as outras e o aviso; `idProcedimento` vazio => `erro` com zero chamadas de rede.
- [ ] **Step 2–4:** Falha, implementar, passa. Commit `processos-lote: operacoes de pos-acao no content script`.

## Task 20: App: painel "Depois de criar" no resultado

**Files:**
- Create: `processos-lote/src/app/posAcao.ts`
- Modify: `processos-lote/src/app/resultado.ts`, `processos-lote/src/app/app.ts`, `processos-lote/estatico/processos-lote.css`, `processos-lote/tests/verificar-app.ts`

**Interfaces:** consome as operações da Task 19 por `rpc.chamar`.

- [ ] Painel recolhido no resultado, visível só quando há ao menos um processo `ok` com número real: três blocos independentes, cada um com caixa de marcar para ligar: **Incluir em bloco interno** (combo dos blocos), **Aplicar marcador** (combo + texto opcional até 250), **Acompanhar** (combo de grupo + observação até 500). Opções carregadas ao abrir o painel (`posAcaoOpcoes`, uma vez, com aviso por lista que falhou). Botão **Aplicar**, desligado sem nenhuma ação ligada.
- [ ] Execução: marcador e acompanhar, um processo por vez (`ExecutorLote`, concorrência 1, pausa 300 ms); bloco, uma chamada com todos os ids. Resultado por processo e ação na tabela do resultado (coluna "Depois de criar" com o resumo de cada ação: ✔ incluído, ↺ já estava, ✖ mensagem). Linhas incertas ficam de fora e o painel diz quantas ficaram de fora e por quê. **Tentar de novo as falhas** repete só os `erro` de cada ação. `parar:true` (sessão expirada) pausa e mostra a mensagem da etapa 1. Duplo clique em Aplicar inicia uma execução só.
- [ ] Provas (RPC falso): uma ação ligada roda só ela; as três rodam e falha de uma não impede as outras; incertas excluídas das três; retry só dos erros; id fora da página do Controle aparece como "fora da página do Controle: faça pelo Controle de Processos"; duplo clique; painel oculto sem processo `ok`.
- [ ] Commit `processos-lote: painel Depois de criar no resultado`.

## Task 21: Modelos guardam as ações; build, ajuda e provas

**Files:**
- Modify: `processos-lote/src/app/configuracao.ts`, `processos-lote/src/app/posAcao.ts`, `processos-lote/src/modelos.ts` (se preciso), testes; `pages/PROCESSOSEMLOTE.md`; `dist/` gerado

- [ ] Modelo guarda também `posAcoes` (marcador, grupo+observação, bloco): ao aplicar um modelo, o painel "Depois de criar" já vem com as ações marcadas; se o marcador/grupo/bloco do modelo não existir mais nas opções carregadas, a ação vem desligada com o aviso "não existe mais". Provas.
- [ ] `cd processos-lote && npm run build`; `cd ../sei-nucleo && npm run build` se ele gerar artefato em `dist/` (ver `sei-nucleo/package.json`: o núcleo é consumido por alias pelos pacotes, não precisa de bundle próprio); conferir ASCII e banners; commit dos gerados.
- [ ] `pages/PROCESSOSEMLOTE.md`: acrescentar na seção "No SEI Pro Lab: nova versão" (sem tocar no texto antigo) modelos salvos e "Depois de criar".
- [ ] **Validação no navegador (controlador, MJ e SP):** criar 2 processos de teste, aplicar marcador, acompanhar e inclusão em bloco interno de teste; conferir no SEI (marcador na árvore, acompanhamento especial, processo no bloco); repetir a ação e ver "já estava"; salvar, aplicar e apagar um modelo. Registrar em `docs/superpowers/specs/2026-10-16-lote-ts-provas.md`.

---

## Self-review

- **Cobertura da seção 8 do desenho:** modelos (Tasks 17 e 21), ações depois da criação (Tasks 18 a 21); incluir em bloco interno = Task 18 (o desenho supunha reaproveitar o núcleo, que só tinha documentos em bloco de assinatura; corrigido pelos fatos comprovados).
- **Tipos:** `Parametros` (etapa 1, `repositorio.ts`) usado em `ModeloLote`; `ResultadoInclusao` (Task 18) usado na Task 19 e na Task 20; `PosAcoes` definido na Task 17 e preenchido na Task 21.
- **Lacuna assumida:** SEI 4.1.5 (SP) pode ter diferenças na tela de blocos (`bloco_selecionar_processo`) — validar na Task 21; o núcleo lê pelo cabeçalho/formulário, não por posição.
