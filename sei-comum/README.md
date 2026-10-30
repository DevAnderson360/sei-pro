# sei-comum

Peças genéricas do SEI Pro que não sabem nada do SEI: datas e feriados, construção
de DOM sem `innerHTML`, armazenamento uma-chave-por-entidade, mesclagem por
entidade (vence o mais recente), índice fracionário para ordem manual, leitura das
opções antigas (`dataValues`) e RPC sobre portas.

O que fala com o SEI fica no `sei-nucleo`. Os pacotes de funcionalidade
(`favoritos/`, `agente-ia/`) importam daqui pelo alias `@comum/*`.

Também a fundação dos módulos com painel e sincronia (Favoritos, Histórico,
Projetos):

- `sincronia/`: o motor do Texto Padrão (`motor.ts`, um adaptador por módulo,
  releitura antes de gravar), o controle da aba (`controlePagina.ts`), o nome e o
  conteúdo do texto (`textoPadraoCodec.ts`), assinatura, trava, consentimento,
  arquivo sincronizado, cópias diárias e o banco IndexedDB por módulo (`banco.ts`);
- `painel/`: o painel embutido no Controle de Processos (`embutido.ts`), a altura
  do iframe, a sobreposição do diálogo e o aviso no rodapé da tela;
- `ui/dialogo.ts` (modal, confirmar, baixar, escolher arquivo) e `ui/avatar.ts`.

    npm install && npm run tipos && npm run verificar && npm run checar
