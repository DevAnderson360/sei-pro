# Agente de IA — anexar PDF como contexto (texto extraído no computador)

Data: 16/10/2026. Situação: design aprovado na conversa, falta o plano.

## Por que

A pessoa quer complementar o pedido ao Agente com um PDF que não está no SEI. O arquivo não deve ir ao modelo: o PDF é lido no próprio computador (pdf.js; OCR local quando escaneado) e só o texto vai no prompt. Começa só com PDF; outros formatos depois.

## O que é

O botão de anexar do chat (`painel/main.ts:346-368`, hoje só `.csv,.txt,.md,.json,.tsv`) passa a aceitar `.pdf`. A extensão conta as páginas, extrai o texto página a página, roda o OCR nas páginas escaneadas e anexa o texto do mesmo jeito que já anexa um `.txt` (varrido contra instrução escondida e envelopado — `main.ts:2479-2492`).

## Objetivos

- PDF nunca sai do computador; só o texto vai ao modelo.
- Leitura **por página**: página com camada de texto usa o texto; página sem texto (escaneada) passa pelo OCR. Conserta a limitação atual de `extrairTextoPdf`, que só faz OCR quando o PDF inteiro não tem texto.
- Contar as páginas **antes** de processar.
- Andamento visível ("OCR na página 7 de 32") e botão para cancelar.
- Chip do anexo com nome e número de páginas, como o anexo de texto de hoje.

## Não objetivos

- Outros formatos (DOCX, imagens) — fase seguinte.
- Mudar o comportamento da ferramenta de leitura de documento do SEI (`tools/sei.ts:426`): ali a pessoa não pediu o OCR, e o teto de 5 páginas (`PAGINAS_OCR` em `painel/pdf.ts`) continua.

## Antiobjetivos

- Mandar o PDF (bytes/base64) ao provedor.
- Travar o painel em OCR longo sem a pessoa ter sido avisada.
- Cortar o texto em silêncio.

## Decidido com o Pedro

1. Analisar o número de páginas antes de processar; **acima de 20 páginas, avisar que o processamento pode deixar o computador lento** e deixar escolher continuar ou cancelar.
2. PDF escaneado pode acontecer: aciona o OCR.
3. **Tamanho: mandar o texto inteiro por padrão**; quando passar do limite atual de anexo (60.000 caracteres), mostrar uma mensagem com o tamanho e a opção de a pessoa trocar para cortar.

## Decisões do Claude

- O aviso de lentidão conta **páginas que vão precisar de OCR** (mais de 20), não páginas totais: ler texto de PDF digital é rápido mesmo com 200 páginas. Proposto na conversa; o Pedro não contestou. Se ele preferir, troca-se para páginas totais.
- No anexo, sem o teto de 5 páginas de OCR; o aviso faz o papel do teto. Continua valendo o teto da biblioteca, `MAX_PAGINAS_OCR = 100` (`ferramentas-pdf/src/lib/ferramentas/tesseract.ts:57`), e o `LIMITE_PAGINAS = 200` da leitura de texto — acima disso, a mensagem diz quantas páginas ficaram sem leitura.
- A regra "texto inteiro, com mensagem para cortar" vale também para os anexos de texto (`.txt`, `.csv`), que hoje são cortados em 60 mil em silêncio.

## Decisões do Claude depois da revisão (não discutidas com o Pedro; listadas para ele conferir)

- **Fluxo da mensagem de tamanho:** o anexo entra inteiro e o chip mostra o aviso ("312 mil caracteres, cerca de N tokens; o texto vai junto em cada resposta desta conversa") com o botão **"Cortar em 60 mil"**, que vale até o envio. Não há diálogo que bloqueie. `this.anexo` passa a guardar o texto inteiro e o modo escolhido; `.txt`/`.csv` deixam de cortar em `main.ts:361` e seguem a mesma regra.
- **Teto duro:** "texto inteiro" não pode passar do que a conversa comporta. Teto = metade do `LIMITE_HISTORICO` do motor (`motor/motor.ts:74`, 400 mil caracteres) = **200 mil caracteres** (~50 mil tokens). Acima do teto, o anexo é cortado no teto e o chip diz até qual página o modelo leu. (Ajuste feito no plano: o painel não guarda o `context_length` do modelo escolhido — ele só aparece na lista de modelos da tela de configuração —, então o teto pela janela do modelo fica para depois.)
- **Compactação:** fica como está nesta fase (o anexo pode ser resumido depois de algumas rodadas). Proteger o anexo da compactação é melhoria posterior.
- **Cancelar o OCR descarta tudo**: nada é anexado. Usa `ocrPdf` como está, sem mexer na biblioteca compartilhada das Ferramentas de PDF.
- **Onde o texto fica guardado:** a transcrição salva (histórico e arquivo de sincronia) já registra só `mensagem + 📎 nome`, não o texto do anexo — continua assim. O texto existe só no histórico do motor (`storage.session`), que some ao fechar o navegador.

## Como (o que já existe)

- `agente-ia/src/painel/pdf.ts`: `textoDoPdf` (pdf.js das Ferramentas de PDF, chunk sob demanda) e `extrairTextoPdf` (OCR quando o PDF inteiro está sem texto). Precisa de uma variante por página, que receba os bytes do `File` direto (sem base64), conte as páginas e aceite progresso e cancelamento.
- `ferramentas-pdf/src/lib/ferramentas/ocr.ts`: `ocrPdf` já tem `aoProgredir`, `cancelado`, `pularPaginasComTexto` (ligado por padrão) e `paginas`; `ocrDisponivel()` para navegador sem suporte (mensagem clara e anexa só o que tiver texto).
- Ordem sugerida: abrir com pdf.js → `numPages` e quais páginas têm texto → se páginas sem texto > 20, aviso → OCR só nelas → montar o texto em ordem com `[página N]` e marcar as reconhecidas por OCR ("pode conter erros de reconhecimento", como hoje).
- O texto final entra em `this.anexo = { nome, texto }` e segue o caminho que já existe (varredura `varrer`, `envelopar`, chip).

## Deixado para quem constrói

- Visual do aviso de lentidão, do andamento e da mensagem de tamanho (seguir os avisos do painel e `feedback_modal_sem_cancelar`: o X e o Esc já fecham).
- PDF protegido por senha ou corrompido: mensagem de erro e nada anexado.
- Se o OCR roda num worker o painel não congela por inteiro; conferir e, se travar a tela, mostrar isso no aviso.

## Restrições

- Acentos como `\uXXXX` no `dist/js`.
- Sem dependência nova: pdf.js e Tesseract já estão empacotados.
- Firefox: conferir se `ocrDisponivel()` é verdadeiro; senão, só a camada de texto.
- Registrar no `pages/HISTORICO.md` no release.
