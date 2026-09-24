# Manutencao do fork personalizado

Este repositorio usa duas branches permanentes:

- `master`: espelho limpo de `upstream/master`;
- `homolog`: versao personalizada, pronta para validacao e distribuicao.

Mudancas proprias nascem em `feature/*`. Atualizacoes oficiais passam por uma
branch temporaria `sync/upstream-vX.Y.Z`. Nao use rebase nem force-push em
`master` ou `homolog`.

## Atualizar para uma release oficial

Comece com a arvore de trabalho limpa e busque o estado atual dos dois remotos:

```powershell
git fetch upstream --tags
git fetch origin --prune
```

Avance a `master` somente quando for possivel fazer fast-forward:

```powershell
git switch master
git merge --ff-only upstream/master
git push origin master
```

Crie a branch de sincronizacao a partir da versao personalizada e incorpore o
espelho oficial por merge:

```powershell
git switch homolog
git switch -c sync/upstream-vX.Y.Z
git merge --no-ff master
```

Resolva conflitos nos fontes. Para o agente, os pontos mais sensiveis estao em
`agente-ia/src/motor/`, `agente-ia/src/painel/` e
`agente-ia/estatico/agente.css`. Nao tente combinar bundles minificados em
`dist/js`: regenere-os depois de resolver os fontes.

## Validar e revisar

Instale as dependencias e valide os tres modulos:

```powershell
cd sei-nucleo
npm install --no-audit --no-fund
npm run tipos
npm run verificar
npm run build

cd ../ferramentas-pdf
npm install --no-audit --no-fund
npm run tipos
npm run verificar
npm run build

cd ../agente-ia
npm install --no-audit --no-fund
npm run tipos
npm run verificar
npm run build
```

De volta a raiz, confira `git diff --check` e revise todos os arquivos gerados
em `dist/`. Publique a branch de sincronizacao e abra uma revisao para
`homolog`. A CI precisa ficar verde antes do merge.

## Versionar a distribuicao

O manifesto do Chrome aceita quatro componentes numericos. Uma customizacao da
release oficial `2.3.0`, por exemplo, comeca em `2.3.0.1`. Novas entregas sobre
a mesma base incrementam apenas o ultimo numero. Quando a base oficial muda, o
contador volta para `1`.

Depois do merge aprovado em `homolog`:

```powershell
git switch homolog
git tag -a vX.Y.Z-custom.N -m "SEI Pro X.Y.Z custom N"
git push origin homolog
git push origin vX.Y.Z-custom.N
```

Nao crie a tag antes de a CI e os testes manuais passarem. O inventario do que
precisa sobreviver a cada sincronizacao esta em
`docs/customizacao-agente-ia.md`.

## Checklist manual

1. GPT-6 Luna responde a uma chamada com ferramentas e grava o uso detalhado.
2. Uma conversa arquivada pode ser retomada sem chamada automatica a IA.
3. Respostas atuais e arquivadas podem ser copiadas como texto simples.
4. O painel abre no Chrome e continua conectado a aba correta do SEI.
5. Nenhum segredo, chave de API, telemetria ou servidor intermediario foi
   introduzido.
