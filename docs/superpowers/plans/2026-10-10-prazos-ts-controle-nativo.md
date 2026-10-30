# Prazos em TS com controle nativo — plano de implementação

Spec: `docs/superpowers/specs/2026-10-09-prazos-ts-controle-nativo-design.md` (aprovado em 10/10/2026, com as
decisões 1 a 8 lá registradas). Branch `feat/prazos-ts`, worktree `../sei-pro-prazos`. Execução em sequência,
sem aprovação intermediária; só não se publica (tag, release, lojas, push) sem pedido do autor.

Convenções do repositório que valem aqui: módulo com `package.json`/`tsconfig`/`build.mjs` (esbuild → `dist/js`,
ASCII), testes em `tests/verificar.ts` com `tsx` + `linkedom`, `h()`/`icone()` de `sei-comum/ui/dom` (sem
`innerHTML`), commits por caminho explícito (nunca `git add -A`), em `dist/js/*.js` acentos como `\uXXXX`.

## Fase 1 — Modelo e marcador (sem efeito na tela)

**Arquivos** `prazos/{package.json,tsconfig.json,build.mjs}`, `prazos/src/modelo/{tipos,marcador,situacao,fusao}.ts`,
`prazos/tests/verificar.ts`.

1. Scaffold do módulo (copiar o de `anotacoes-controle`), `npm install`, `npm run tipos`.
2. `marcador.ts`: `lerMarcador(texto)` → `{ data: ISO, hora?: "HH:mm", vencimento: boolean, texto: string } | null`
   (mesmas regras do legado: primeiro `DD/MM/AAAA` válido; "ate" sem acento, caixa indiferente, vira
   vencimento; hora `H:MM` ou `HH:MM`, ausente = 23:59 para vencimento; sobra do texto vira `texto`) e
   `formatarMarcador({vencimento, data, hora, texto})` (`Ate DD/MM/AAAA HH:mm\ntexto`). Teste de paridade
   com os exemplos do PRAZOS.md e com tooltips reais (acentos, `\n`).
3. `situacao.ts`: `resumir(prazo, hoje, feriados)` → `{ situacao: "noPrazo"|"hoje"|"atrasado"|"desde"|"concluido",
   texto, dica, ordem, sorter }` (`sorter` = `YYYY-MM-DD HH:mm:ss`, contrato do agrupamento do legado).
4. `fusao.ts`: `fundir(nativo?, marcador?)` com as regras do spec (nativo vence na data; hora/texto do
   marcador só se a data bater; "desde" só sem nativo; concluído neutro).
5. Testes: marcador, situação (virada de dia, dia útil, feriado), fusão (todas as combinações do spec).
   `npm run build` verde; nada no manifest ainda.

## Fase 2 — Nativo (leitura e escrita, sem efeito na tela)

**Arquivos** `prazos/src/nativo/{leitura,formulario,resposta}.ts`, fixtures em `prazos/tests/fixtures/sei41/`.

1. Fixtures (do SP real, anonimizadas: hash e login zerados): `caixa_prazos.html` (em dia, hoje, dias úteis, atrasado),
   `caixa_concluido.html`, `definir_form.html`, `definir_editar.html` (traz o `acaoExcluir`), `definir_erro_passado.html`.
2. `leitura.ts`: `lerPrazoNativo(tr)` por `a[href*="acao=controle_prazo_definir"]` → `{ idControlePrazo, idProcedimento,
   sigla, data, estado, concluidoEm? }` (data e estado do `aria-label`, ícone `controle_prazo{1,2,3}.svg` como
   confirmação); `lerPrazosDaCaixa(doc)` por `tr[id^=P]`.
3. `resposta.ts`: `interpretarResposta(pagina)` → sucesso pela URL final (`acao=procedimento_controlar`) ou erro lido de
   `#divInfraMensagens .alert-danger` (e `#txaInfraValidacao`, SEI 3/5), sem lançar por `verificarPagina` (`aceitarValidacao`).
4. `formulario.ts`: `obterAcao(http, campos da tela, hrefBarra, ids)` (POST do link da barra com
   `hdn*ItensSelecionados` só na cópia), `definir(...)`, `concluir(...)`, `excluir(...)` (link do `acaoExcluir` da
   página de edição, aberta pelo `href` do ícone). Detecção `temControleNativo(doc)` pela presença do botão da barra.
   Reaproveita `criarHttp` e `Formulario` do núcleo; testes com `fetch` simulado servindo as fixtures.
5. Prova no SEI real (SP, gravação liberada): script de ciclo definir/dias/hoje/alterar/passado/concluir/excluir
   rodando o **código do módulo** (não o experimento), desfazendo tudo. Resultado registrado no spec.

## Fase 3 — Células, modal e ponte com o legado (Lab MV3)

**Arquivos** `prazos/src/pagina/{celulas,modal,servico,ponte,main}.ts`, `prazos/src/{style,modal}.css`,
`dist/manifest.json`, trechos de `dist/js/sei-pro.js`.

1. `servico.ts`: orquestra leitura (nativo + marcador, fusão) e as regras de gravação do spec (tabela do Salvar):
   nativo quando possível; marcador complementar via `definirMarcador` do núcleo por processo (hora/texto/marcador,
   "desde", data vencida, sem nativo); remover = excluir nativo + limpar texto do marcador; concluir só nativo.
   Erros do SEI voltam como mensagem no modal.
2. `celulas.ts`: preenche `td.prazoBoxDisplay` com o contrato legado (`.dateboxDisplay[data-time-sorter]`,
   `tagTableText_date_*`, `data-duesetdate`, `infraTrAtrasada/Alerta`), com texto do `resumir` e `title`
   com a dica; observa as tabelas (MutationObserver) como as Anotações; clique abre o modal da linha.
3. `modal.ts`: `dialog.spro-dialogo` em Shadow DOM (padrão de `ordem-paineis/modal.ts`, `base.css`+`modal.css`,
   tema por `darkModePro`): Controlar vencimento, Data ou Em N dias (+úteis), Hora, Marcador (opcional,
   lista lida de `andamento_marcador_cadastrar` da barra), Texto, Concluir, Remover; aviso quando o
   resultado cai no marcador; progresso e erro por processo no lote.
4. `ponte.ts` + legado: o módulo marca `<html data-spro-prazos="1">`; em `sei-pro.js`, `setControlePrazo` sai
   do preenchimento por linha e `addControlePrazo` delega por `CustomEvent("spro-prazos-abrir")` com
   `data-spro-prazos-alvo`, ambos só quando a marca existe. O botão da barra continua o do legado.
5. `main.ts`: só em `procedimento_controlar`; opção `gerenciarprazos` (`opcaoLegadaLigada`) ao vivo;
   `dist/manifest.json` (entrada como a de `init_anotacoes_controle.js`); `npm run build`.
6. Testes: células (todas as situações, contrato do `data-time-sorter`), modal (regras de habilitação),
   serviço (matriz do spec, com HTTP simulado), ponte. Prova no SEI SP com a extensão carregada
   (harness do puppeteer) e capturas de tela. SEI 5.0.4 (MJ) fica registrado como pendente de sessão.

## Fase 4 — Árvore e documentação

1. Painel de informações da árvore (`sei-pro-arvore.js`): mostrar também o prazo nativo do processo
   (leitura do nó `CONTROLEPRAZO`/ícone da árvore), sem mudar a edição por marcador.
2. `pages/PRAZOS.md` (nativo, hora/texto no marcador, frota mista, SEI 4.1.5+), nota em `pages/HISTORICO.md`
   para a próxima versão, `funcionalidades.json` se houver menção. README e PRIVACY_POLICY não se editam.
3. Revisão final: `npm run build` de `prazos`, `sei-nucleo` e módulos vizinhos que importam `sei-comum`,
   `git status` limpo de lixo, resumo ao autor com o que ficou pendente (MJ 5.0.4, publicação).

## Fora desta entrega

Oficial e Firefox; mover o esqueleto da coluna (th/td, tablesorter, agrupamento) para TS; migração em massa
de prazos de marcador para o nativo; `getDatesPreview`/Atividades.

## Status da execução (10/10/2026)

Fases 1 a 4 feitas na branch `feat/prazos-ts` (sem push, sem tag, sem release), 58 testes em `prazos/tests/verificar.ts`.
Provadas no SEI SP de treinamento 4.1.5: ciclo nativo pelo código do módulo (fase 2) e fluxo completo com a extensão
carregada (coluna, modal, várias linhas pelo botão da barra, complemento no marcador, concluir, remover, seleção
desmarcada ao gravar, painel da árvore), tudo desfeito no fim.

Validado também no MJ de homologação (SEI 5.0.4, sessão aberta pelo autor por causa do 2º fator).

Pendente: decidir número e data da versão (o `HISTORICO.md` tem um rascunho "Próxima versão"); oficial, Firefox e o esqueleto da coluna
em TS ficam para etapas próprias. Limitação conhecida do núcleo: em alguns processos (ex.: `034.00000265/2026-31` no SP)
`Sei.localizar` não acha a árvore e o complemento no marcador falha com mensagem; o vencimento no SEI já foi gravado.
