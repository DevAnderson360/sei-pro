# Gestor de Projetos em TypeScript — design

Data: 06/10/2026 · Branch: `feat/projetos-ts` (worktree `../sei-pro-projetos`) · Autor das decisões: Pedro Soares

Telas aprovadas (abrir no navegador; usam `/files/base.css` e a Frappe do servidor de brainstorm, então
como arquivo solto perdem o estilo — servem como referência de layout, textos e comportamento):
`docs/superpowers/specs/2026-10-06-projetos-telas/{painel,formularios,integracao}.html`.

## 0. Contexto e objetivo

O gestor de projetos legado (`dist/js/sei-pro-projetos.js`, 2.047 linhas) é um submódulo do módulo
Atividades: guarda tudo no backend PHP/MySQL (`backend/`), só aparece para quem tem servidor do
Atividades configurado e a capacidade `view_projetos`, roda no mundo da página, sem DOM seguro e com
defeitos sérios (arrastar com barras de execução sobrescreve o planejado; projeto sem etapas some;
filtros "30 dias" invertidos; XSS armazenado entre unidades; recarga incremental não traz mudanças de
etapas). A documentação (`pages/PROJETOS*.md`) ainda descreve a versão Google Sheets, removida em 2023.

Objetivo: um **gestor de projetos novo, para todos os usuários do SEI Pro**, sem servidor, no mesmo
padrão técnico e visual dos Favoritos e do Histórico (TypeScript, pacotes compartilhados `sei-comum` e
`sei-nucleo`, painel embutido + aba no painel lateral), com Gantt da Frappe Gantt 1.2.2.

**Princípio de produto (pedido explícito do autor):** ferramenta acessível ao público geral, não a
especialistas em gerenciamento de projetos. O legado era elogiado pela simplicidade. Muitas
funcionalidades, mas **sem poluir**: poucos botões visíveis, poucos passos, o essencial à mostra e o
resto recolhido com resumo; o dia a dia se resolve no balão da etapa, sem abrir formulário.

## 1. Decisões do autor (06/10/2026)

1. **Convivência com o legado:** o novo vale para todos; quem tem servidor do Atividades continua vendo o
   painel legado, que passa a se chamar "Projetos (Atividades)" quando os dois aparecem. O novo ganha
   "Importar do servidor do Atividades" (importação única, repetível sem duplicar).
2. **Escopo por projeto:** "Toda a unidade" (Texto Padrão compartilhado da unidade: todos da unidade com
   SEI Pro veem e editam) ou "Só eu" (Texto Padrão com o login, como nos Favoritos). Dá para mudar depois.
3. **Todas as 16 novidades sugeridas entram** (seção 2.2).
4. **Entrega:** tudo de uma vez (as fases não são publicadas separadamente). Lab MV3 primeiro.
5. **Vista do projeto:** variante **B** — lista de etapas à esquerda alinhada às barras + Gantt à direita;
   opção no menu de ajustes para **esconder a lista** ("Mostrar lista de etapas", ligada por padrão).
6. Formulários (tela 2) aprovados, com as decisões embutidas: "Fase" substitui "Macroetapa"; "Grupo" e
   "Tipo de projeto" do legado viram etiquetas; "Só eu" vale para a unidade em que o projeto foi criado;
   "Iniciar execução" deixa de ser passo (a etapa entra em andamento sozinha na data de início) e as barras
   de execução separadas viram **linha de base**; menu com "Mostrar lista de etapas".
7. Lateral e integração (tela 3) aprovados; o botão de menu do painel usa o ícone **ajustes** (como nos
   Favoritos), não "⋯".
8. **Sincronia:** extrair o motor dos Favoritos para o `sei-comum` (adaptador por módulo); Favoritos
   migram e não podem regredir.
9. **Frappe Gantt:** cópia do fonte 1.2.2 ajustada no pacote (sem `innerHTML`, várias classes por barra,
   gancho pós-desenho, escala inicial respeitada).
10. O autor pediu para executar tudo sem novas aprovações intermediárias e ver só o resultado final.

## 2. Escopo funcional

### 2.1 Paridade com o legado (corrigindo os defeitos)

| Legado | Novo |
|---|---|
| Projeto: nome, processo SEI, tipo; editar, arquivar/reativar, duplicar, excluir | Igual; tipo vira etiqueta; excluir com lápide + "Desfazer"; **projeto sem etapas não some** |
| Etapa: nome, datas programadas, 1 dependência, responsável, macroetapa, grupo, etiquetas, observações, processo, documento | Igual, com **várias dependências**, Fase no lugar de macroetapa, grupo → etiqueta |
| Iniciar/concluir execução com datas e documento; cancelar conclusão | Concluir com 1 clique (data de hoje) + aviso "Informar documento"/"Desfazer"; "Reabrir" no balão |
| Progresso manual (0–100), automático por tempo (nunca chegava a 100, dividia por zero), por demandas | Manual, **pelo tempo** (chega a 100 no término), **pelo checklist** (substitui demandas) |
| Gantt Dia/Semana/Mês, arrastar datas, barra de execução, cores por situação | Dia/Semana/Mês/Ano, arrastar e redimensionar, linha de base, cores por situação |
| Relatório filtrado (aba nova, filtros invertidos/bugados) | Filtros no próprio painel: atrasadas, em andamento, próximos 30 dias, concluídas, só as minhas; responsável, fase, etiqueta |
| Ordenação das etapas; estado do painel lembrado (aba por índice) | Ordenação (início, nome, cadastro); lembra recolhido e projeto aberto **pelo id** |
| Compartilhar com unidades/usuários com "pode editar" | "Toda a unidade" (Texto Padrão) + enviar projeto por arquivo |
| Vínculo com demandas do Atividades | Fora (depende do servidor); a importação traz as demandas como itens de checklist |

### 2.2 Novidades (todas aprovadas)

- **Planejamento:** marcos (losango); várias dependências (dependentes andam juntos ao arrastar,
  preferência ligada por padrão); dias úteis e feriados (fins de semana e feriados nacionais destacados,
  durações em dias úteis); linha de base (traço cinza fino sob a barra, com "plano original" e desvio).
- **Visões:** portfólio ("Todos": um Gantt com uma linha por projeto); lista de etapas (tabela) e, no
  lateral, agenda; alertas no título do painel (atrasadas e "vence nesta semana", visíveis com o painel
  recolhido, clicáveis); exportar (CSV das etapas e impressão/PDF do Gantt).
- **Integração com o SEI:** ícone na caixa do Controle de Processos (só em processo ligado; ponto vermelho
  se há etapa atrasada; balão com projeto › etapas); na tela do processo (ícone junto ao número, faixa
  quando há atraso ou vencimento próximo, balão com "Concluir com documento…" e "Adicionar a um
  projeto"); responsável escolhido entre os usuários da unidade (ou texto livre); ferramenta do Agente.
- **Produtividade:** modelos de projeto (salvar como modelo; criar a partir de modelo com data inicial,
  datas em dias úteis; 3 modelos de exemplo embutidos); checklist na etapa; enviar/receber projeto por
  arquivo e mover entre "Só eu" e "Toda a unidade"; histórico de alterações (quem mudou o quê).

## 3. Telas e comportamento (aprovados)

### 3.1 Painel embutido no Controle de Processos (tela 1, variante B)

- **Título:** ícone gantt + "Projetos" + seta de recolher + pílulas de alerta ("N atrasada(s)",
  "N vence(m) nesta semana"), visíveis também recolhido; clicar aplica o filtro correspondente (abre o
  projeto se só um tem o alerta; senão "Todos" filtrado). Sem alertas, sem pílulas.
- **Abas:** segmentado com "Todos (N)" e uma aba por projeto ativo (ícone prédio = toda a unidade,
  pessoa = só eu; nome curto; ponto vermelho se tem atraso; percentual). Excesso vai para "Mais N ▾".
  À direita: "+ Novo projeto" (fantasma), estado da sincronia ("sincronizado", "pendente", "erro") com
  dica, e botão **ajustes** (menu geral).
- **Menu ajustes:** Sincronização…; Modelos de projeto…; Projetos arquivados (N); — Mostrar lista de
  etapas (marcável); Mover dependentes ao arrastar (marcável); Ordenar etapas por ▸ (início, nome,
  cadastro); — Exportar planilha (CSV); Imprimir / salvar PDF; Enviar projeto por arquivo…; Receber
  projeto de arquivo…; Importar do servidor do Atividades… (só com servidor configurado); — Histórico de
  alterações.
- **Cabeçalho do projeto:** processo (link que abre o processo), "Toda a unidade"/"Só eu", "X de Y
  etapas concluídas", "termina em dd/mm/aaaa", lápis "Editar projeto". Controles (só 5): Gantt|Lista,
  Dia|Semana|Mês|Ano (só no Gantt), Hoje (só no Gantt), Filtro (popover), "+ Etapa" (primário).
- **Vista Gantt:** coluna esquerda (290 px) alinhada às linhas do Gantt (cabeçalho 64 px; linha 36 px):
  linhas de fase (recolhíveis, contagem feitas/total, barra-resumo fina no Gantt) e de etapa (ícone de
  situação, nome, avatar do responsável); passar o mouse realça a barra; clique abre o balão; última linha
  "Adicionar etapa… (Enter)" cria a etapa com 5 dias úteis depois da última etapa (ou hoje). Gantt à
  direita: cores por situação, marcos em losango, dependências com setas, linha de base, hoje marcado,
  fins de semana/feriados destacados (escala Dia). Com "Mostrar lista de etapas" desligado, só o Gantt
  (nome na barra; rótulo de fase acima da barra-resumo).
- **Vista Lista:** tabela agrupada por fase: situação, etapa (pílula "marco"), responsável, início,
  término, situação, progresso.
- **Todos (portfólio):** coluna com projetos (escopo, nome, pílula "N atrasada" ou "feitas/total") e
  Gantt com uma barra por projeto (cor: concluído/atrasado/em andamento), escala padrão Mês, clique abre o
  projeto; vista Lista com projeto, onde, início, término, etapas, progresso. Controle primário vira
  "+ Novo projeto".
- **Balão da etapa:** pílula de situação (com dias úteis de atraso), nome, "Fase · Responsável", datas e
  duração em dias úteis, aviso de replanejamento ("o plano original terminava em …, +N dias úteis"),
  checklist "X de Y", documento (abre a visualização), processo (abre o processo), régua de progresso
  (só com medida manual), notas de medida automática; ações: Concluir etapa / Marcar como cumprido
  (marco) / Reabrir, Editar, menu (duplicar, mover para outra fase, histórico, excluir). Esc ou clique
  fora fecha.
- **Filtro (popover):** chips Atrasadas · N, Em andamento · N, Próximos 30 dias · N, Concluídas
  (mostrar/ocultar), Só as minhas; combos Responsável, Fase, Etiqueta (OU dentro do campo, E entre
  campos, como nos Favoritos). Botão Filtro mostra a contagem ativa.

### 3.2 Formulários (tela 2)

- **Novo projeto (diálogo):** nome; processo SEI opcional (combo com os processos da caixa + qualquer
  número digitado); "Quem vê" em cartões (Toda a unidade (SIGLA) | Só eu, com explicação); "Começar":
  Em branco | De um modelo (modelo + "Começa em" + prévia: N etapas em M fases, datas em dias úteis,
  "termina em …", 3 primeiras etapas). Rodapé: Cancelar | Criar projeto. **Editar projeto** usa o mesmo
  diálogo (sem "Começar") com Arquivar/Reativar, Duplicar, Salvar como modelo, Excluir.
- **Etapa (diálogo):** essenciais à mostra — nome; início, término e "N dias úteis"; "É um marco"
  (esconde término); responsável (combo com usuários da unidade + texto livre); fase (combo que cria);
  "Depende de" (chips + combo). Seções recolhidas com resumo à direita: Checklist; Processo e documento
  (processo padrão = o do projeto; documento por número SEI com conferência do título); Etiquetas;
  Observações; Como medir o progresso (Eu informo | Pelo tempo decorrido | Pelo checklist); Histórico.
  Rodapé: Excluir (esquerda, perigo) | Cancelar | Salvar.
- **Concluir:** 1 clique conclui com a data de hoje; aviso "“X” concluída hoje (dd/mm). [Informar
  documento] [Desfazer]"; "Informar documento" abre mini-balão com número SEI (+ título conferido) e
  "Concluída em". Nada obrigatório.
- **Primeiro uso (vazio):** ilustração, "Acompanhe um trabalho do começo ao fim", texto curto, "Criar
  projeto" (primário), "Começar de um modelo", link "Importar meus projetos do servidor do Atividades"
  (só com servidor configurado).
- **Diálogos de apoio:** Sincronização (seções Texto Padrão da unidade, Texto Padrão pessoal, Arquivo,
  Cópias deste navegador — mesmo desenho do diálogo dos Favoritos); Modelos (lista, renomear, excluir,
  criar projeto); Arquivados (reativar, excluir); Importar do Atividades (lista de projetos com caixas,
  destino "Toda a unidade"/"Só eu", resumo do que vem); Receber projeto (prévia + destino); Histórico de
  alterações (lista por data, filtrável por projeto).

### 3.3 Painel lateral, caixa e árvore (tela 3)

- **Lateral:** aba "Projetos" no shell (Favoritos | Histórico | Projetos | Agente), contador vermelho de
  atrasadas. Topo: Agenda | Projetos, sigla da unidade, "+" (novo projeto), ajustes.
  - **Agenda:** Todas | Só as minhas; grupos Atrasadas (N), Esta semana (N), Próximos 30 dias (N);
    cartões (situação, etapa, avatar, projeto, data relativa); clique expande ações Concluir/Cumprido,
    Editar, Ver no projeto.
  - **Projetos:** cartões (escopo, nome, %, barra de progresso, "N atrasada · termina …"); abrir mostra
    **mini-Gantt** (nome 150 px + eixo de meses posicionados por data, fases, barras/losangos, hoje) e
    "Abrir no painel" (abre/rola o Controle de Processos no projeto). Toque numa etapa = mesmo balão.
- **Caixa:** ícone gantt ao lado da estrela dos Favoritos, só em processo ligado (processo do projeto ou de
  etapa); ponto vermelho se alguma etapa ligada está atrasada; clique abre balão (Shadow DOM, como o dos
  Favoritos): "Em N projeto(s)", processo, por projeto: "Projeto · papel" e etapas com situação e data;
  "Adicionar a outro projeto", "Abrir no painel".
- **Árvore (tela do processo):** ícone junto ao número (realçado se ligado); faixa sob o número só quando
  há etapa atrasada ou vencendo em até 3 dias úteis ("Etapa atrasada · Projeto"); balão "Projetos deste
  processo" com cada vínculo e "Concluir com documento…" (combo com os documentos **da árvore já aberta**,
  sem carregar árvore escondida), "Abrir no painel", e o bloco "Adicionar a um projeto": Projeto (combo),
  Como (Nova etapa | Ligar a uma etapa | Processo do projeto), Nome da etapa (padrão = especificação ou
  tipo do processo), Início (hoje), Duração (dias úteis), Adicionar.

### 3.4 Tema

Embutido e diálogos seguem o SEI (`data-tema` do modo noturno do SEI Pro + cor da barra do SEI como
destaque, como nos Favoritos); lateral segue o sistema. A Frappe usa os tokens `--spro-*` (variáveis
`--g-*` redefinidas no contêiner). Cores por situação: em andamento = destaque; atrasada = perigo;
concluída = ok; a iniciar = fundo-3; marco = novidade (cumprido = ok); fase = borda-forte/suave.

## 4. Arquitetura e pacotes

### 4.1 Pacote `projetos/` (molde: `historico/`)

`package.json`, `build.mjs` (esbuild, `charset: "ascii"`, portão de bytes > 0x7f, banner GERADO),
`tsconfig.json` (aliases `@comum/*`, `@nucleo/*`, `@projetos/*`; `noUncheckedIndexedAccess`),
`biome.json` (ignora `src/vendor/`), `tests/` (tsx + linkedom, `tests/verificar.ts` agrega), `estatico/`
(`projetos.html`, `projetos.css`, `gantt.css`). Saídas versionadas:

| Arquivo | Papel |
|---|---|
| `dist/js/init_projetos.js` | Content script IIFE (`all_frames`, `document_start`, mesmos matches do `init_historico.js`): marca `<html data-seipro-projetos>`, monta o painel embutido no Controle de Processos, ícone/balão na caixa, ícone/faixa/balão na árvore, sincronia por Texto Padrão, ponte com o lateral, executor RPC |
| `dist/js/projetos/app.js` | App ESM: `html/projetos.html#modo=embutido` (iframe do painel), `#modo=lateral` (aba do shell), `#modo=impressao&...` (impressão) |
| `dist/html/projetos.html` | página do app |
| `dist/css/projetos.css` | `base.css` + `lista.css` + `projetos.css` + `gantt.css` (Frappe ajustada + tokens) |

Organização interna:

```
projetos/src/
  modelo/      tipos.ts, constantes.ts, escopo.ts, situacao.ts, progresso.ts, calendario.ts (dias úteis),
               dependencias.ts (ciclo, propagação), linhaDeBase.ts, operacoes.ts, validacao.ts, filtro.ts,
               alertas.ts, historico.ts (registros de alteração)
  repositorio.ts   coleções por escopo (p, f, e, h, m, meta), aoMudar, índice processo→vínculos
  modelos/     embutidos.ts (3 exemplos), aplicar.ts (modelo → projeto com dias úteis), salvar.ts
  sincronia/   adaptador.ts (envelope, nomes dos textos, privacidade de sigilosos), textoPadrao.ts
  arquivo/     projetoArquivo.ts (enviar/receber 1 projeto), csv.ts
  importacao/  atividades.ts (cliente + mapeamento)
  gantt/       montar.ts (wrapper Frappe), escalas.ts (pt-BR), decorar.ts (marcos, base, fases),
               linhas.ts (projeto → linhas da lista/gantt), miniGantt.ts
  app/         main.ts, estado.ts, painel/ (titulo, abas, cabecalho, vistaGantt, vistaLista, vistaTodos,
               balaoEtapa, filtro, menu), dialogos/ (projeto, etapa, concluir, sincronizacao, modelos,
               arquivados, importar, receber, historico), lateral/ (agenda, projetos, miniGantt),
               impressao.ts, vazio.ts
  pagina/      main.ts (content script), marca.ts, painel.ts (usa @comum/painel/embutido),
               caixa.ts, arvore.ts, balao.ts (Shadow DOM), executor.ts (RPC), sincronia.ts, lateral.ts,
               atividades.ts (lê configuração do legado e faz a requisição)
  vendor/frappe-gantt/  fonte 1.2.2 ajustado + LICENSE + AJUSTES.md + tipos.d.ts
```

### 4.2 O que passa para o `sei-comum` (Favoritos e Histórico migram)

- `sincronia/motor.ts` — `MotorTextoPadrao<E>` genérico: trava → ler → validar → importar (mescla) →
  exportar → comparar assinaturas → teto → consentimento → **reler imediatamente antes de gravar** (se o
  remoto mudou, mescla de novo; até 3 tentativas) → gravar. `agendarEnvio` (pendente persistido, 15 s),
  recuo "indisponível" 1 dia, `textoDoErro`. Entra com um **adaptador**:
  `{ nomeDoTexto(escopo), descricao(escopo), exportar(escopo): E, importar(E): Promise<void>,
     validar(conteudo, escopo): {ok:E}|{invalido}|{maisNovo}, assinatura(E), teto, aviso, chaveStatus }`.
- `sincronia/textoPadraoCodec.ts` — envelope ↔ conteúdo do Texto Padrão (parágrafo legível + blocos via
  `codec.ts`), nome curto de login (27 + `~` + 8 hex).
- `sincronia/arquivo.ts` — `SincroniaArquivo` + `ControleArquivo` genéricos (File System Access, handle no
  IndexedDB **por módulo** — banco `seipro-<modulo>`), com adaptador `{exportarTudo, importarEnvelope,
  lerEnvelope, nomeSugerido}`.
- `sincronia/copias.ts` — cópias diárias genéricas (14), banco por módulo.
- `sincronia/assinatura.ts` — JSON estável + hash.
- `sincronia/trava.ts` — `travarComLocks`/`travarEsperando` (Web Locks com recuo sem locks).
- `sincronia/consentimento.ts` — consentimento por `host|login|unidade` em preferência do `storage.sync`.
- `sincronia/controlePagina.ts` — o controle de content script (só topo, com unidade; puxar ao carregar a
  caixa ou com pendência; `aoMudar` agenda envio; liga/desliga com a preferência; apagar com espera da
  trava + conferência por `localizar`; `ocultarTextosInternos` do `selTextoPadrao`).
- `ui/dialogo.ts` — `abrirModal`, `confirmar`, `baixar` (hoje duplicados em favoritos e histórico).
- `painel/embutido.ts` — montagem de painel em `#panelHomePro` (criar contêiner após
  `#frmProcedimentoControlar`, ordem `optionsPro.orderPanelHome`, título com a classe
  `infraBarraLocalizacao` e peso 600 + conferência pós-`load`, recolher lembrado, iframe com
  `color-scheme`), altura (`altura.ts`), sobreposição de diálogo (RPC `sobrepor`) e aviso (RPC `aviso`).
- `ui/avatar.ts` (iniciais + cor estável por nome). Os ícones de situação da etapa ficam no `projetos`.

Regra: a migração de Favoritos/Histórico é **mecânica** (trocar import + adaptador) e as suítes deles
(favoritos 572+, histórico, sei-comum) passam sem alterar expectativas.

### 4.3 Ligações fora dos pacotes

- **Shell do lateral** (`favoritos/src/shell/painel.ts`, `main.ts`): aba `projetos`
  (`html/projetos.html#modo=lateral`, ícone `gantt`, contador pela chave `projetos/contadorPainel`),
  detectada pelo content script `init_projetos.js` no manifest; `#aba=projetos`.
- `dist/js/background.js:104` aceita `projetos` em `abrirPainel`.
- **Agente:** `agente-ia/src/tools/projetos.ts` (`projetos_listar`), registro em `tools/sei.ts`,
  sugestão em `painel/sugestoes.ts`, alias `@projetos/*` no `agente-ia/tsconfig.json`.
- **Legado:** `dist/js/init.js` carrega `sei-pro-projetos.js` só se o `<html>` **não** tem
  `data-seipro-projetos` **ou** há servidor do Atividades configurado (`configBasePro_atividades` com
  `URL_API`); com os dois, o título do legado vira "Projetos (Atividades)" (ajuste em
  `sei-pro-projetos.js`, com acentos em `\uXXXX`). A Frappe antiga (`dist/js/lib/frappe-gantt.js`) fica.
- **Manifest:** só `dist/manifest.json` (Lab MV3): content script `js/init_projetos.js` e WAR
  `html/projetos.html`, `js/projetos/app.js`, `css/projetos.css`. Oficial e Firefox: etapa seguinte.
- `tools/check-dom-injection.mjs` (gitignored): `ARQUIVOS_GERADOS` ganha `init_projetos.js` e
  `projetos/app.js`; atualizar também a cópia do clone principal.

## 5. Modelo de dados

### 5.1 Escopo e chaves

`Escopo = { host, login, unidade: idUnidade, vis: "unidade" | "eu" }`. O painel mostra os dois escopos da
unidade atual juntos. Chaves no `chrome.storage.local` (uma por entidade):
`projetos/<host>|<login>|u:<idUnidade>/<un|eu>/<tipo>/<id>` com tipos `p` (projeto), `f` (fase),
`e` (etapa), `h` (registro de histórico), `m` (modelo), e `…/meta`. Outras chaves:
`projetos/preferencias` (local), `projetos/contadorPainel`, `projetos/sync/tp/<chaveEscopo>`,
`projetos/sync/arquivo/<host>|<login>`, `projetos/lateralAberto`, `projetos/usuarios/<host>|u:<id>`
(cache 1 dia), `projetos/importacao/<host>|<login>` (mapa id legado → id novo).

### 5.2 Entidades (todas `Versionada` + `alteradoPor?: string`)

```ts
interface Projeto { id; nome; processo?: Vinculo; etiquetas: string[]; ordem: string; criadoEm: number;
  arquivadoEm?: number; origem?: { atividades?: number }; }
interface Vinculo { protocolo: string; idProcedimento?: string; sigiloso?: boolean }
interface Fase { id; projeto: string; nome: string; ordem: string }
interface Etapa { id; projeto: string; fase?: string; ordem: string; nome: string;
  inicio: DataISO; fim: DataISO; marco: boolean; dependeDe: string[];
  responsavel?: { login?: string; nome: string };
  medida: "manual" | "tempo" | "checklist"; progresso: number; checklist: ItemChecklist[];
  processo?: Vinculo; documento?: { numero: string; titulo?: string };
  etiquetas: string[]; observacoes?: string; concluidaEm?: DataISO;
  base?: { inicio: DataISO; fim: DataISO }; criadoEm: number; origem?: { atividades?: number } }
interface ItemChecklist { id: string; texto: string; feito: boolean }
interface Registro { id; alvo: string; projeto: string; quando: number; por: string; nome?: string;
  campo: string; antes?: string; depois?: string }      // só acrescenta; mescla = união
interface Modelo { id; nome; descricao?; fases: string[]; etapas: EtapaModelo[]; criadoEm: number }
interface EtapaModelo { nome; fase?: number; aPartirDe: number /*dias úteis do início*/; duracao: number;
  marco: boolean; dependeDe: number[]; checklist: string[] }
```

Ordem fracionária (`@comum/ordem/indice`) para projetos (abas), fases e etapas.

### 5.3 Derivados (calculados, nunca gravados)

- **Situação da etapa:** `concluida` (tem `concluidaEm`), `atrasada` (`fim < hoje`), `andamento`
  (`inicio <= hoje`), `futura`. Marco: `cumprido`, `atrasado`, `futuro`.
- **Progresso:** concluída = 100; manual = `progresso`; tempo = dias úteis decorridos / dias úteis
  totais (0 antes do início, 100 a partir do término; duração 1 dia → 0 ou 100, sem divisão por zero);
  checklist = feitos/total (0 itens → 0).
- **Projeto:** início = menor início; término = maior fim; progresso = média ponderada pela duração em
  dias úteis (marcos peso 0; sem etapas = 0); atrasadas = contagem; situação do projeto = concluído (todas
  concluídas e há etapas), atrasado (alguma atrasada), em andamento, a iniciar, sem etapas.
- **Fase:** início/fim/progresso/feitas/total das suas etapas.
- **Alertas:** atrasadas = etapas não concluídas com `fim < hoje` (marcos incluídos); "vence nesta
  semana" = não concluídas com `hoje <= fim <= sexta-feira desta semana`; "próximos 30 dias" = começam ou
  terminam entre hoje e hoje+30 corridos.
- **Dias úteis:** `@comum/datas/dias` + `feriados.ts` (nacionais, como os prazos dos Favoritos).

### 5.4 Regras

- **Linha de base:** criada com as datas da etapa. Enquanto `inicio > hoje` (planejamento), mudar datas
  move a base junto. Depois de começar, a base fica congelada; desvio = dias úteis entre `base.fim` e
  `fim`. "Redefinir plano original" (menu do projeto) iguala base às datas atuais. A importação usa o
  programado do legado como base.
- **Dependências:** só dentro do projeto; ciclo proibido (validação no diálogo e no arrastar); arrastar
  uma etapa com "mover dependentes" ligado desloca as dependentes pelo mesmo número de dias corridos que a
  Frappe aplica (comportamento nativo `move_dependencies`); desligado, só a etapa.
- **Marco:** `fim = inicio`; arrastar move a data; não redimensiona.
- **Validação:** nome obrigatório (≤ 200); `fim >= inicio`; progresso 0–100; checklist ≤ 50 itens
  (≤ 200 caracteres); etiquetas ≤ 10 (≤ 40); observações ≤ 2.000; 100 projetos ativos por escopo; 300
  etapas por projeto; histórico ≤ 300 registros por escopo (mais recentes); modelos ≤ 50 por escopo.
- **Histórico de alterações:** cada edição local gera registros por campo relevante (nome, datas,
  responsável, situação/conclusão, progresso manual, fase, dependências, processo/documento, exclusão,
  criação, arquivamento) com `por` = login e `nome` = nome do usuário lido do SEI.
- **Privacidade:** processo sigiloso (detectado na caixa/árvore, ou marcado ao vincular) fica `sigiloso:
  true` e **o número nunca vai ao Texto Padrão nem ao Agente** (vai como vínculo vazio, mantido local na
  mesclagem, como o `resumido` dos Favoritos).
- **Modelos embutidos (3):** "Revisão normativa" (Instrução, Consulta pública, Deliberação — 9 etapas
  como na tela 1), "Contratação por pregão eletrônico" (Planejamento, Seleção, Contrato), "Plano anual"
  (trimestres). Textos neutros, sem nome de pessoa.
- **Preferências locais** (`projetos/preferencias`): mostrarLista (true), moverDependentes (true),
  ordemEtapas ("inicio"), escala por projeto ("Semana"), escalaTodos ("Mês"), vista ("gantt"), projeto
  aberto por unidade, fases recolhidas, filtro, modo do lateral ("agenda"), "só as minhas" (false),
  recolhido do painel.

## 6. Sincronia e colaboração

### 6.1 Textos Padrão

- **Toda a unidade:** `[_SEIPRO_PRJ_UNIDADE]`; descrição "Projetos da unidade (SEI Pro). Gerado
  automaticamente; não edite." Lido automaticamente quando o painel abre na unidade (se existir).
  Escrita: ao criar/editar projeto "Toda a unidade". **Na primeira vez por host|login|unidade**, aviso
  único explicando que o projeto fica num Texto Padrão visível para toda a unidade (botão "Entendi") —
  vale como consentimento (gravado como nos Favoritos).
- **Só eu:** `[_SEIPRO_PRJ_<login>]` (login longo encurtado como nos Favoritos). Desligado por padrão;
  faixa-convite no painel ("Guarde seus projetos pessoais no SEI para vê-los em outro computador
  [Ligar…] [Agora não]") e diálogo com os pontos do consentimento (como nos Favoritos).
- Envelope `{ formato: "seipro-projetos", versao: 1, host, unidade, vis, login?, gerado, entidades:
  {p, f, e, h, m} }`, compactado pelo codec (gzip + base64url em parágrafos) com parágrafo legível.
  Validação: host/unidade/vis (e login no "eu") têm de casar; versão maior → `maisNovo` (não grava;
  aviso "atualize o SEI Pro"); editado à mão → inválido → cópia diária garantida e regravação com aviso.
- **Teto:** 100 KB (aviso a 80 KB; acima não grava e sugere arquivar/excluir histórico antigo).
- **Rodada:** ao carregar o Controle de Processos (se o último puxar > 2 min ou há pendência), ao focar
  a aba, e 15 s depois de mudança local; botão "Sincronizar agora". Trava por nome
  `seipro-projetos-sync|<chave>`.
- **Concorrência entre usuários (Toda a unidade):** o SEI não tem versão no Texto Padrão. Mitigação:
  mesclagem por entidade com carimbo (`vence` do `sei-comum`), releitura imediatamente antes de gravar
  (re-mescla se mudou; até 3 tentativas). Janela residual de milissegundos; quem perder a corrida ainda
  tem a cópia local e regrava na próxima rodada (convergência). Lápides duram **180 dias** no escopo da
  unidade (90 no pessoal) para um usuário eventual não ressuscitar exclusões.
- Sem permissão de Texto Padrão (`SEI_ACAO_INDISPONIVEL`) ou sessão expirada → estado "indisponível"
  (recuo 1 dia) e os dados seguem locais; o diálogo explica.

### 6.2 Arquivo JSON, cópias e enviar/receber

- **Arquivo** (File System Access no lateral; handle no IndexedDB `seipro-projetos`): leva todos os
  escopos (todas as unidades, "unidade" e "eu"), inclusive sigilosos (é do próprio usuário). Exportar/
  Importar manual (caminho do Firefox) sempre mescla.
- **Cópias diárias:** 14 mais recentes, restaurar recarimba só os ativos (como nos Favoritos).
- **Enviar projeto por arquivo:** `<nome>.seipro-projeto.json` com projeto + fases + etapas (sem
  histórico, sem número de processo sigiloso). **Receber:** prévia (nome, N etapas, período) + destino
  ("Toda a unidade"/"Só eu") → cria cópia com ids novos (não mescla com o original).
- **Mover entre "Só eu" e "Toda a unidade":** no diálogo Editar projeto ("Quem vê"); move projeto, fases,
  etapas e registros entre escopos (lápide no de origem; aviso do impacto).

### 6.3 Importar do servidor do Atividades

- Disponível só quando a página tem `configBasePro_atividades` com `URL_API` e `KEY_USER` (o legado grava
  essa chave no `localStorage` do SEI). O content script faz a mesma requisição do painel legado
  (`getServerAtividades` no modo `panel`, com `projetos={"vigentes":false}` para trazer arquivados),
  lendo `padrao.projetos` (com `etapas`). Se a requisição falhar, usa o cache do legado
  (`configDataAtividadesPadraoPro_projetos`). (A ação `view_projetos` do servidor está quebrada — devolve
  só o último projeto — e não é usada.)
- Diálogo: lista de projetos com caixas (nome, unidade, N etapas, arquivado?), destino padrão "Toda a
  unidade". Idempotente por `origem.atividades` (reimportar atualiza, não duplica).
- **Mapeamento:** `nome_projeto` → nome; `processo_sei`/`id_procedimento` → processo; `tipo_projeto` →
  etiqueta; `data_fim` ≠ sentinela → arquivado; etapa: `macroetapa` → Fase (criada por nome),
  `grupo` e `etiqueta` → etiquetas; `data_inicio/fim_programado` → base e datas; se há
  `data_inicio_execucao`, início = execução; `data_fim_execucao` → `concluidaEm` e fim;
  `progresso_execucao` → progresso manual; período de progresso automático → medida "tempo";
  `id_dependencia` → `dependeDe`; `responsavel` → responsável (texto); `observacoes`;
  `documento_sei`/`documento_relacionado` → documento; `id_demandas_titles` → itens de checklist
  ("Demanda: <nome_atividade>", feito se `data_entrega` preenchida); `processo_sei` da etapa → processo.
  Datas `0000-00-00…` = vazio. Etapa sem datas programadas recebe início/fim do projeto ou hoje.

## 7. Integração com o SEI e com o Agente

- **Contexto da aba** (`lerContexto` do núcleo): host, login (do título do usuário, minúsculo), unidade
  (id e sigla), nome do usuário. Lateral roteia por `host|login|unidade` (`daChave`), remonta ao trocar de
  unidade.
- **RPC do executor (aba → app)**: `contexto`, `altura`, `sobrepor`, `aviso`, `abrirProcesso`,
  `abrirDocumento` (por número SEI, pela pesquisa rápida, nova aba), `processosDaCaixa` (para o combo do
  diálogo), `usuariosDaUnidade` (núcleo `opcoes.usuarios`, cache 1 dia), `sincronizarAgora`, `apagarDoSei`,
  `atividadesDisponivel`, `importarAtividades`, `focarProjeto` (abrir no painel).
- **Caixa:** observa as tabelas `#tblProcessosRecebidos`, `#tblProcessosGerados`, `#tblProcessosDetalhado`
  (e listas que os Favoritos cobrem) e insere o ícone depois da estrela dos Favoritos (ou do número),
  usando o índice `protocolo → vínculos` do repositório (dois escopos da unidade); atualiza com
  `aoMudar`. Sigilo detectado na linha marca o vínculo como sigiloso.
- **Árvore:** no frame da árvore (`ifrArvore`, SEI 4.1 aninhado e SEI 5), ícone depois do número do
  processo e da estrela; faixa conforme 3.3; documentos para "Concluir com documento" lidos dos nós da
  árvore **já renderizada** (número SEI + nome), nunca carregando a árvore em segundo plano.
- **Balões** em Shadow DOM com o CSS como texto (como `favoritos/src/pagina/balao.ts`); diálogos maiores
  ("Editar") abrem no app do painel (RPC `focarProjeto` + abrir etapa) ou no lateral.
- **Abrir no painel:** se o Controle de Processos está na aba atual, rola até o painel e abre o projeto;
  senão abre o lateral na aba Projetos com o projeto.
- **Agente:** `projetos_listar({ filtro?: "atrasadas"|"semana"|"todos", projeto?: string })` (efeito
  leitura): contadores antes da lista; projetos (nome, vis, progresso, término, atrasadas) e etapas
  (nome, fase, situação, datas, responsável, progresso); sigilosos fora (só contados); responsáveis e
  campos livres (nome, observações, checklist) passam por `ctx.pessoasVistas` + `varrerCamposLivres` +
  `registrarAchados` (como `historico_listar`); corte em 300 etapas. `projetosInstalado()` pelo manifest.

## 8. Frappe Gantt: ajustes no fonte (`projetos/src/vendor/frappe-gantt/AJUSTES.md`)

1. Sem `innerHTML`/`insertAdjacentHTML`/`outerHTML`: `createSVG` aceita `textContent` (rótulos);
   esvaziar com `replaceChildren()`; setas do `$adjust` com `textContent`; padrão `diagonalHatch` criado
   com `createElementNS`; o módulo `popup` sai (usamos `popup: false` e balão próprio).
2. `custom_class` aceita várias classes separadas por espaço.
3. `view_mode` informado é respeitado quando `view_modes` é passado (a 1.2.2 força a primeira).
4. Gancho `after_render(gantt)` chamado ao fim do `render` e depois de `bar.refresh`/arraste, para as
   decorações (marcos, linha de base, fases).
5. `language: "pt-BR"` usa `Intl` (já suportado); escalas próprias em português (Dia, Semana, Mês, Ano).
6. Licença MIT preservada (`LICENSE`), cabeçalho em cada arquivo com a origem e "ajustado para o SEI Pro".
7. Tipos mínimos em `tipos.d.ts` para o que o wrapper usa; `// @ts-nocheck` nos arquivos JS do vendor.
Teste do pacote: o bundle gerado não contém `innerHTML`, `outerHTML`, `insertAdjacentHTML`, nem `on*=`.

## 9. Erros, limites e privacidade

- Diálogo impede: nome vazio, término antes do início, ciclo de dependência (mensagem nomeia o ciclo),
  limites da 5.4.
- Arrastar que cria ciclo/violação é desfeito com aviso.
- Falha da Frappe (exceção na montagem) → cai para a vista Lista com aviso discreto.
- Quotas: se `storage.local` recusar gravação, aviso "espaço do navegador cheio" com sugestão de arquivar.
- Texto Padrão: erros mapeados (sessão expirada, sem permissão, teto, inválido, mais novo) no estado da
  sincronia e no diálogo; nunca bloqueia o uso local.
- SEI em HTTP: `novoId` sem `randomUUID` e trava sem Web Locks (recuos existentes).
- Sessão do SEI: nunca montar URL; abrir processo/documento só por links da página ou pesquisa rápida;
  nada de carregar árvore em segundo plano (marca "recebido").
- Sigilosos: regra da 5.4 — fora do Texto Padrão e do Agente; no CSV e no "Enviar projeto" o número do
  processo sigiloso sai em branco; no painel o próprio usuário continua vendo.
- Strings exibidas sempre por `textContent`/`h()`; nada de HTML vindo de dados.

## 10. Testes, portões, validação e entrega

- **Suítes** (tsx + linkedom; `tests/verificar.ts` de cada pacote):
  - `sei-comum`: motor genérico (rodada, pendência, releitura antes de gravar, teto, maisNovo, inválido,
    indisponível), arquivo, cópias, trava, consentimento, diálogo, painel embutido.
  - `favoritos`, `historico`: sem regressão (mesmas expectativas) após migrar para o comum.
  - `projetos`: modelo (situação, progresso, dias úteis, linha de base, dependências/ciclo, alertas,
    filtro), repositório (escopos, lápides, índice de processos, histórico), modelos (aplicar com
    feriados), adaptador/envelope (privacidade de sigilosos, validação), importação (mapeamento com
    fixtures do legado, idempotência), enviar/receber, CSV, linhas do Gantt e decoração (unidade, sem
    layout), app (montagem das vistas, balão, filtro, diálogos com linkedom), content script (caixa e
    árvore com fixtures `sei-nucleo/tests/fixtures/sei41`), vendor sem `innerHTML`.
  - `agente-ia`: `projetos_listar` (pseudônimos, sigilosos, filtros).
- **Portões:** `tsc --noEmit` e `biome check` em todos os pacotes tocados; portão ASCII do build;
  `node tools/check-dom-injection.mjs`; `node tools/patch-manifests.mjs --check`; nenhum byte > 0x7f nos
  JS legados editados (`init.js`, `sei-pro-projetos.js`, `background.js`).
- **Validação ao vivo** (harness puppeteer com a extensão): SEI SP 4.1.5 (treinamento, unidade TESTE) e
  SEI 5.0.4 MJ **homologação** (`hmlsei`): painel, Gantt, criar projeto (em branco e por modelo), etapa,
  concluir/desfazer, Texto Padrão da unidade e pessoal (criar, ler em outra sessão, apagar), lateral,
  caixa, árvore, Favoritos e Histórico sem regressão, tema escuro. Nunca escrever em produção.
- **Entrega:** commits locais na branch `feat/projetos-ts`; sem push, merge, release ou envio às lojas
  (dependem de autorização do autor). Rascunho da página de ajuda nova em
  `docs/superpowers/specs/2026-10-06-projetos-pagina-ajuda.md` (substitui `pages/PROJETOS*.md` no
  lançamento).

## 11. Fora do escopo

Manifests oficial e Firefox; edição colaborativa em tempo real; notificações do sistema operacional;
feriados locais/da unidade; dependências entre projetos; recursos/custos; caminho crítico; correções do
backend do Atividades.
