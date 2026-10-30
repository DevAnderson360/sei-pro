# Agente de IA — sincronia por arquivo (backup em JSON)

Data: 16/10/2026. Situação: design aprovado na conversa, falta o plano.

## Por que

A conta do Google (`storage.sync`) já leva parte do Agente entre computadores, mas não leva o histórico de conversas, o texto das skills, as coleções de fluxos, o histórico das rotinas nem os segredos. Quem usa o Agente em dois computadores (trabalho e casa, ou troca de máquina) perde tudo isso. Favoritos, Projetos e Demandas já resolvem o mesmo problema com um `.json` numa pasta que o próprio usuário sincroniza (OneDrive, Google Drive). O Agente passa a fazer igual.

## O que é

Um arquivo `.json` escolhido pela pessoa, normalmente numa pasta do OneDrive ou do Google Drive, que a extensão mantém sincronizado **automaticamente a cada mudança**, mais os botões **Exportar** e **Importar** para controle manual.

## Objetivos

- O arquivo é a cópia completa do Agente: tudo o que o `storage.sync` já leva **e** o que ele não leva.
- Gravação automática alguns segundos depois de cada mudança; leitura ao abrir o painel e ao a janela ganhar foco. Uma conversa feita no computador do trabalho aparece no de casa.
- Ler sempre **mescla** com o que já está na extensão; nunca substitui.
- Exportar e Importar manuais, no mesmo formato. No Firefox (sem File System Access) só esses dois existem.

## Não objetivos

- Não substitui o `storage.sync`: ele continua funcionando como hoje.
- Não leva a conversa em andamento para continuar em outro computador (ver "Conteúdo").
- Não é backup da extensão inteira, só do Agente.

## Antiobjetivos (seria fracasso mesmo funcionando)

- Gravar chave de API ou token de MCP no arquivo sem a pessoa ter marcado a opção.
- Uma leitura do arquivo apagar algo do computador local (arquivo ilegível, de versão mais nova ou de outro usuário nunca apaga nada — regra do módulo comum).
- Conversa apagada num computador "ressuscitar" na próxima leitura.

## Decidido com o Pedro

1. **Sincronização automática a cada mudança**; Exportar/Importar são só para controle.
2. **Segredos (chave de API do provedor e tokens dos conectores MCP) só entram no arquivo se a pessoa marcar uma opção**, desmarcada por padrão.
3. Desenho completo aprovado ("tudo certo"), incluindo as três decisões do Claude abaixo.

## Decisões do Claude (aprovadas na conversa)

- Se a opção "guardar conversas" (configurações, `main.ts:~1563`) estiver desligada, as conversas também não vão para o arquivo.
- Conversa apagada num computador some nos outros: precisa de marca de exclusão (lápide) com data, e a mescla respeita a lápide.
- Configuração editada nos dois lados: vale a mais recente (carimbo de tempo por registro).

## Decisões do Claude depois da revisão (não discutidas com o Pedro; listadas para ele conferir)

- **Lápide para todo tipo de registro**, não só conversas (skills, regras, memória, rotinas, conectores, fluxos, coleções). Sem isso, um item apagado volta do arquivo e o espelho o sobe de novo ao `storage.sync`, desfazendo a exclusão que o sync já propaga. Cada registro leva carimbo de alteração; a lápide leva a data da exclusão; a mescla é "mais recente vence", contando a lápide como versão.
- **Dono fixo por navegador**, não `host|login`: os dados do Agente são globais (não separados por SEI) e o painel abre sem aba do SEI. Usar um `Dono` constante (ex.: `{ host: "agente", login: "" }`) no `ControleArquivo`; a contagem de "outros" fica sempre 0.
- **Poda por idade (`config.dias`) é local**: não gera lápide e não propaga. No `importar`, conversas mais velhas que o prazo deste computador são ignoradas (não entram), e o `exportar` mantém as do arquivo que este computador não tem (o arquivo é a união; quem guarda para sempre não perde nada).
- **"Guardar conversas" desligado neste computador**: não exporta as suas, não importa as do arquivo, e preserva no arquivo as que vieram de outros (padrão "outros" do módulo comum). Evita o ciclo de um computador tirar o que o outro põe.
- **A caixa "Incluir chave de API e tokens" é local deste computador**: fica fora de `Config`, não viaja pelo `storage.sync` nem pelo arquivo. Marcada: grava os segredos deste computador e importa os do arquivo quando o local estiver vazio. Desmarcada: não grava os seus, não importa e **preserva** os que já estão no arquivo (sem ciclo de regravação). Para tirar segredos do arquivo, um botão "Remover segredos do arquivo" (só tem efeito duradouro se nenhum outro computador estiver com a caixa marcada; a tela diz isso).
- **Política de privacidade e comentário de `espelho.ts`** prometem que a chave "nunca sai deste navegador": atualizar no release para dizer "só se você marcar a opção de incluí-la no arquivo".

## Como (o que já existe e deve ser reaproveitado)

- **Módulo comum:** `sei-comum/src/sincronia/arquivo.ts` — `SincroniaArquivo`, `ControleArquivo`, `AdaptadorArquivo<E>`, `handlesNoIndexedDB`, `escolherArquivoSync`, `temSeletorDeArquivo`. Já cobre: handle no IndexedDB, permissão por gesto ("Reconectar arquivo"), sincronizar ao abrir/foco/`agendar()` com 15 s, BOM do Bloco de Notas, arquivo de versão mais nova não tocado, dados de outro usuário/SEI mantidos (chave `host|login`). O Agente implementa só o **adaptador** (`formato`, `versao`, `ler`, `importar`, `exportar`, `assinatura`).
- **Exemplos a seguir:** `favoritos/src/sincronia/arquivoSync.ts` e `favoritos/src/app/main.ts:219-227`; `projetos/src/sincronia/arquivo.ts`.
- **Onde está cada dado hoje** (levantado em 16/10/2026):

| Item | Onde | No arquivo |
|---|---|---|
| Histórico de conversas | IndexedDB `agenteIA`, lojas `conversas` + `itens` (`painel/historico.ts`) | Sim (se "guardar conversas" ligado), com lápides |
| Memória | `agenteIA_memoria` | Sim |
| Instruções e config (serviço, URL, modelos) | `agenteIA_config` | Sim |
| Chave de API | `agenteIA_config.chave` | Só com a opção marcada |
| Skills (com o texto completo) | `agenteIA_skills` | Sim |
| Coleções de skills | `agenteIA_colecoes` | Sim |
| Regras | `agenteIA_regras` | Sim |
| Conectores MCP | `agenteIA_mcp` | Sim; token só com a opção marcada |
| Rotinas (com `ultimas`/`falhas`) | `agenteIA_rotinas` | Sim |
| Fluxos e ignorados | `agenteIA_fluxos`, `agenteIA_fluxosIgnorados` | Sim |
| Coleções de fluxos | `agenteIA_fluxosColecoes` | Sim |

- **Conteúdo das conversas:** só a transcrição, como o histórico já guarda hoje. O histórico que vai ao modelo e o mapa de pseudônimos continuam fora, pela mesma razão documentada em `historico.ts` (é a parte mais sensível). A conversa importada abre para ler e exportar, não para continuar — igual às conversas antigas locais.
- **Gatilho de gravação:** chamar `agendar()` em toda gravação dos itens acima (inclusive salvar/apagar conversa). O ouvinte de `storage.onChanged` do painel (`main.ts:~323`) é um ponto natural.
- **Coexistência com o espelho do `storage.sync`** (`painel/espelho.ts`): o que o arquivo importa entra no armazenamento local, e o espelho propaga como faria com qualquer edição. A mescla precisa ser idempotente para os dois caminhos não ficarem regravando um ao outro (a `assinatura` evita gravar arquivo sem mudança).
- **UI:** uma seção nas configurações do Agente (`abrirConfig()`, `painel/main.ts:~872`), no padrão visual da sincronia por arquivo de Favoritos/Projetos: escolher arquivo novo / abrir existente, estado (ok, erro, "Reconectar arquivo"), esquecer arquivo, a caixa "Incluir chave de API e tokens dos conectores", Exportar e Importar.

## Deixado para quem constrói

- Formato exato do envelope (`formato: "seipro-agente"`, `versao: 1` é a sugestão) e os carimbos por registro.
- Nome sugerido do arquivo (ex.: `sei-pro-agente.json`).
- Como o Exportar se comporta com a caixa de segredos (sugestão: o mesmo valor da caixa).
- Import de arquivo com segredos quando a caixa está desmarcada neste computador (sugestão: importa os segredos, não regrava).

## Restrições

- Strings em `dist/js/*.js` com acentos como `\uXXXX` (o TS do `agente-ia` já sai assim; conferir por bytes).
- Firefox: sem File System Access; manter Exportar/Importar funcionando.
- Registrar no `pages/HISTORICO.md` no release.
