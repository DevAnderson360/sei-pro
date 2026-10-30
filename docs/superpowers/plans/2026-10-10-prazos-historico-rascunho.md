# Prazos: texto para o HISTORICO.md (rascunho)

Tirado do `pages/HISTORICO.md` na hora do merge, porque a sessão do rename dos Monitorados tem o rascunho da 2.8
no mesmo lugar, ainda não commitado. Cole este bloco na entrada da versão que levar o novo controle de prazos
e ajuste número e data.

### Próxima versão (rascunho — ajustar número e data no lançamento)

O controle de prazos passa a gravar no controle de prazo do próprio SEI e foi reescrito. Chega primeiro ao SEI Pro Lab (Chrome e Edge).

- **[Controle de Prazos](../pages/PRAZOS.md) grava no controle de prazo do SEI (4.1.5 ou superior).** O vencimento não ocupa mais o marcador do processo, quem não usa a extensão enxerga e altera o prazo pelo próprio SEI, e o prazo em **dias úteis** é calculado pelo SEI com os feriados dele. Dá para **concluir** o prazo, que fica listado sem alerta de atraso
- **Hora, texto e data inicial continuam no marcador**, só quando você os informa (o controle do SEI guarda apenas a data). Datas já vencidas e SEIs anteriores ao 4.1.5 também gravam no marcador, como antes. Os prazos que já estavam em marcadores continuam na coluna
- **Nova janela *Prazo*** no mesmo desenho dos favoritos, do histórico e dos projetos, com o destino do prazo explicado enquanto você preenche, prazo **em N dias** (corridos ou úteis) e gravação para várias linhas de uma vez
- **O painel da árvore mostra o prazo do SEI** junto do marcador
- Atenção na unidade: quem ainda tem uma versão antiga do SEI Pro não vê, na coluna *Prazos*, os prazos gravados só no controle do SEI (o ícone do próprio SEI continua aparecendo)
