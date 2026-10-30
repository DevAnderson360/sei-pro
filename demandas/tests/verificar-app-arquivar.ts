import { MENSAGEM_ARQUIVO_GRANDE } from "../src/app/colaboracao";
import type { Demanda } from "../src/modelo/tipos";
import { restaurarCopia } from "../src/sincronia/arquivo";
import { FORMATO_ARQUIVO_MORTO } from "../src/sincronia/arquivoMorto";
import { dialogoAberto, digitar, fecharDialogo, itemDoMenu, marcar, nova, texto } from "./apoioApp";
import { type Colab, colabDeTeste } from "./apoioColaboracao";
import { botao, checar, secao, tique } from "./util";

const ABRIR = {
  antigas: "Arquivar concluídas antigas…",
  morto: "Exportar arquivo morto e limpar…",
  copias: "Cópias automáticas…",
} as const;

/** Uma demanda concluída numa data antiga (e, se pedido, arquivada). */
async function velha(c: Colab, vis: "unidade" | "eu", titulo: string, concluidaEm: string, arquivada = false): Promise<string> {
  const id = await nova(c.t, vis, titulo, "concluida");
  const repo = c.t.repos[vis];
  await repo.aplicar(id, (d: Demanda, car) => ({
    demanda: { ...d, concluidaEm, atualizadoEm: car.agora, dispositivo: car.dispositivo },
    registros: [],
  }));
  if (arquivada) await repo.arquivarVarias([id]);
  return id;
}

async function abrir(c: Colab, item: string): Promise<HTMLElement> {
  itemDoMenu(c.t.raiz, "Ajustes", item);
  await tique(50);
  return dialogoAberto(c.t.doc) as HTMLElement;
}
const vivo = async (c: Colab, vis: "unidade" | "eu", id: string) => {
  const d = (await c.t.repos[vis].entidades()).d.find((x) => x.id === id);
  return !!d && d.removidoEm === undefined;
};
const erros = (dlg: Element) => texto(dlg.querySelector(".dem-erros"));

export async function verificarAppArquivar(): Promise<void> {
  secao("arquivar: concluidas antigas");
  {
    const c = colabDeTeste();
    const a = await velha(c, "unidade", "Velha 1", "2026-05-01");
    const b = await velha(c, "eu", "Velha 2", "2026-04-01");
    const recente = await velha(c, "unidade", "Recente", "2026-10-05");
    await c.c.iniciar();
    await c.t.montar();
    const dlg = await abrir(c, ABRIR.antigas);
    checar(
      "oferece 30, 60, 90 e 180 dias",
      [...dlg.querySelectorAll("[data-dias]")].map((b2) => b2.getAttribute("data-dias")).join() === "30,60,90,180",
    );
    checar("o padrao e 90", dlg.querySelector('[data-dias="90"]')?.getAttribute("aria-pressed") === "true");
    const r = texto(dlg.querySelector(".dem-arquivar-resumo"));
    checar("mostra quantas e quanto libera", /^2 demandas concluídas há mais de 90 dias, cerca de \d+ KB\.$/.test(r), r);
    (dlg.querySelector('[data-dias="30"]') as HTMLElement).click();
    checar(
      "com 30 dias, as 2 velhas e o recente de outubro nao entra",
      /^2 demandas/.test(texto(dlg.querySelector(".dem-arquivar-resumo"))),
    );
    (dlg.querySelector('[data-dias="180"]') as HTMLElement).click();
    checar(
      "com 180 dias, so a de abril",
      /^1 demanda concluída há mais de 180 dias/.test(texto(dlg.querySelector(".dem-arquivar-resumo"))),
    );
    (dlg.querySelector('[data-dias="90"]') as HTMLElement).click();
    botao(dlg, "Arquivar")?.click();
    await tique(60);
    checar("Arquivar chama arquivarVarias e conta", texto(dlg.querySelector(".dem-arquivar-resultado")) === "2 arquivadas");
    const ua = (await c.t.repos.unidade.obter(a))?.arquivadoEm;
    const ub = (await c.t.repos.eu.obter(b))?.arquivadoEm;
    const ur = (await c.t.repos.unidade.obter(recente))?.arquivadoEm;
    checar("as velhas dos dois escopos arquivadas; a recente nao", ua !== undefined && ub !== undefined && ur === undefined);
    checar(
      "depois nao ha mais candidatas e o botao desabilita",
      texto(dlg.querySelector(".dem-arquivar-resumo")) === "Nenhuma demanda concluída há mais de 90 dias." &&
        botao(dlg, "Arquivar")?.disabled === true,
    );
    fecharDialogo(c.t.doc);
  }
  {
    const c = colabDeTeste();
    await nova(c.t, "unidade", "Aberta");
    await c.c.iniciar();
    await c.t.montar();
    const dlg = await abrir(c, ABRIR.antigas);
    checar(
      "zero candidatas: texto e botao desabilitado",
      texto(dlg.querySelector(".dem-arquivar-resumo")) === "Nenhuma demanda concluída há mais de 90 dias." &&
        botao(dlg, "Arquivar")?.disabled === true,
    );
    fecharDialogo(c.t.doc);
  }

  secao("arquivar: exportar arquivo morto e limpar (so descarta depois de guardado)");
  {
    const c = colabDeTeste();
    const velhaId = await velha(c, "unidade", "Velha arquivada", "2026-02-10", true);
    const outra = await velha(c, "unidade", "Mais recente arquivada", "2026-09-01", true);
    await c.c.iniciar();
    await c.t.montar();
    let dlg = await abrir(c, ABRIR.morto);
    const limite = dlg.querySelector("[name=limite]") as HTMLInputElement;
    digitar(limite, "2026-06-01");
    await tique(40);
    const resumo = texto(dlg.querySelector(".dem-arquivo-resumo"));
    checar("mostra quantas arquivadas e o tamanho", /^1 demanda arquivada antes de .*, cerca de \d+ KB\.$/.test(resumo), resumo);
    const guardei = dlg.querySelector("[name=guardei]") as HTMLInputElement;
    const remover = botao(dlg, "Remover do SEI e do computador") as HTMLButtonElement;
    checar("antes de baixar, nada se pode remover", guardei.disabled && remover.disabled);
    botao(dlg, "Baixar arquivo")?.click();
    await tique(50);
    const b = c.baixados.at(-1);
    checar("Baixar arquivo usa o nome da spec", b?.nome === "demandas-arquivo-2026-06-01.json");
    const morto = JSON.parse(b?.conteudo ?? "null");
    checar(
      "o conteudo e parseavel, so com as de antes da data",
      morto.formato === FORMATO_ARQUIVO_MORTO && morto.demandas.length === 1 && morto.demandas[0].id === velhaId,
    );
    checar("depois de baixar, a caixa libera, mas o botao ainda nao", !guardei.disabled && remover.disabled);
    marcar(guardei);
    checar("so com Ja guardei o arquivo o botao habilita", !remover.disabled);
    marcar(guardei, false);
    checar("desmarcar desabilita de novo", remover.disabled);
    marcar(guardei);
    remover.click();
    await tique(80);
    checar(
      "remover chama descartar (lapide) so da que foi no arquivo",
      !(await vivo(c, "unidade", velhaId)) && (await vivo(c, "unidade", outra)),
    );
    checar("e avisa quantas", texto(dlg.querySelector(".dem-arquivo-resultado")).includes("1 demanda removida"));
    fecharDialogo(c.t.doc);

    // Sem baixar, nada e descartado: fecha no meio.
    const c2 = colabDeTeste();
    const x = await velha(c2, "unidade", "Guardada", "2026-02-10", true);
    await c2.c.iniciar();
    await c2.t.montar();
    dlg = await abrir(c2, ABRIR.morto);
    digitar(dlg.querySelector("[name=limite]"), "2026-06-01");
    await tique(40);
    checar("sem baixar, o botao de remover nao age", (botao(dlg, "Remover do SEI e do computador") as HTMLButtonElement).disabled);
    fecharDialogo(c2.t.doc);
    await tique(20);
    checar("fechar no meio nao descarta nada", await vivo(c2, "unidade", x));

    // Baixou mas nao marcou "Ja guardei": nada descartado.
    const c3 = colabDeTeste();
    const y = await velha(c3, "unidade", "Guardada 2", "2026-02-10", true);
    await c3.c.iniciar();
    await c3.t.montar();
    dlg = await abrir(c3, ABRIR.morto);
    digitar(dlg.querySelector("[name=limite]"), "2026-06-01");
    await tique(40);
    botao(dlg, "Baixar arquivo")?.click();
    await tique(40);
    (botao(dlg, "Remover do SEI e do computador") as HTMLButtonElement).click();
    await tique(40);
    checar("baixar sem confirmar que guardou nao descarta", await vivo(c3, "unidade", y));
    fecharDialogo(c3.t.doc);

    // Sem arquivadas antigas.
    const c4 = colabDeTeste();
    await c4.c.iniciar();
    await c4.t.montar();
    dlg = await abrir(c4, ABRIR.morto);
    checar(
      "sem arquivadas antigas, nao ha o que baixar",
      texto(dlg.querySelector(".dem-arquivo-resumo")).startsWith("Nenhuma demanda arquivada antes de") &&
        (botao(dlg, "Baixar arquivo") as HTMLButtonElement).disabled,
    );
    fecharDialogo(c4.t.doc);

    // Importar o arquivo morto (mescla) num computador sem aquelas demandas.
    const c5 = colabDeTeste();
    await c5.c.iniciar();
    await c5.t.montar();
    dlg = await abrir(c5, ABRIR.morto);
    c5.arquivos.push(b?.conteudo ?? "");
    botao(dlg, "Importar arquivo morto…")?.click();
    await tique(60);
    checar(
      "importar o arquivo morto mescla e conta",
      /^\d+ novas?, 0 atualizadas, 0 ignoradas\.$/.test(texto(dlg.querySelector(".dem-arquivo-resultado"))) &&
        (await c5.t.repos.unidade.obter(velhaId))?.arquivadoEm !== undefined,
    );
    c5.arquivos.push(JSON.stringify({ formato: "outra-coisa" }));
    botao(dlg, "Importar arquivo morto…")?.click();
    await tique(40);
    checar("arquivo de outro formato", erros(dlg) === "Esse arquivo não é das Demandas.");
    c5.arquivos.push(JSON.stringify({ formato: FORMATO_ARQUIVO_MORTO, versao: 2, demandas: [], registros: [] }));
    botao(dlg, "Importar arquivo morto…")?.click();
    await tique(40);
    checar("arquivo de versao mais nova pede para atualizar", erros(dlg).includes("Atualize a extensão"));
    c5.arquivos.push("isto nao e json");
    botao(dlg, "Importar arquivo morto…")?.click();
    await tique(40);
    checar("texto que nao e JSON", erros(dlg) === "O arquivo não é um JSON válido.");
    c5.arquivos.push(JSON.stringify({ ...morto, unidade: "999" }));
    botao(dlg, "Importar arquivo morto…")?.click();
    await tique(40);
    checar("arquivo de outra unidade nao entra", erros(dlg).includes("outra unidade"));
    fecharDialogo(c5.t.doc);
  }

  secao("arquivar: exportar e importar o arquivo (backup)");
  {
    const c = colabDeTeste();
    const aberta = await nova(c.t, "unidade", "Aberta");
    const arq = await velha(c, "unidade", "Arquivada", "2026-02-10", true);
    const pessoal = await nova(c.t, "eu", "Pessoal");
    await c.c.iniciar();
    await c.t.montar();
    itemDoMenu(c.t.raiz, "Ajustes", "Exportar arquivo (backup)…");
    await tique(60);
    const b = c.baixados.at(-1);
    checar("o nome tem o login e a data", b?.nome === "demandas-seipro-ana-2026-10-12.json");
    const env = JSON.parse(b?.conteudo ?? "null");
    const ds = env.escopos.flatMap((e: { entidades: { d: Array<{ id: string }> } }) => e.entidades.d.map((d) => d.id));
    const hs = env.escopos.flatMap((e: { entidades: { h: unknown[] } }) => e.entidades.h);
    checar(
      "leva as abertas, as arquivadas e as pessoais",
      [aberta, arq, pessoal].every((id) => ds.includes(id)),
    );
    checar("e o historico completo", hs.length > 0);
    checar("e avisa que baixou", !!c.avisos.at(-1)?.includes("baixado"));

    const c2 = colabDeTeste();
    await c2.c.iniciar();
    await c2.t.montar();
    c2.arquivos.push(b?.conteudo ?? "");
    itemDoMenu(c2.t.raiz, "Ajustes", "Importar arquivo…");
    await tique(80);
    checar("importar mescla e mostra o resumo", /^\d+ novas, 0 atualizadas, 0 ignoradas\.$/.test(c2.avisos.at(-1) ?? ""), c2.avisos.at(-1));
    checar("as demandas chegaram", !!(await c2.t.repos.unidade.obter(arq)) && !!(await c2.t.repos.eu.obter(pessoal)));
    c2.arquivos.push(b?.conteudo ?? "");
    itemDoMenu(c2.t.raiz, "Ajustes", "Importar arquivo…");
    await tique(80);
    checar("importar de novo nao duplica nem desfaz", !!c2.avisos.at(-1)?.startsWith("0 novas, 0 atualizadas"), c2.avisos.at(-1));

    c2.arquivos.push("{}");
    itemDoMenu(c2.t.raiz, "Ajustes", "Importar arquivo…");
    await tique(40);
    checar("arquivo que nao e do Gestor", c2.avisos.at(-1) === "Esse arquivo não é das Demandas.");
    c2.arquivos.push(JSON.stringify({ formato: "seipro-demandas", versao: 9, tipo: "copia", escopos: [] }));
    itemDoMenu(c2.t.raiz, "Ajustes", "Importar arquivo…");
    await tique(40);
    checar("versao mais nova pede para atualizar", !!c2.avisos.at(-1)?.includes("Atualize a extensão"));
    c2.arquivos.push(
      JSON.stringify({
        ...env,
        escopos: env.escopos.map((e: { escopo: object }) => ({ ...e, escopo: { ...e.escopo, host: "outro.gov.br" } })),
      }),
    );
    itemDoMenu(c2.t.raiz, "Ajustes", "Importar arquivo…");
    await tique(40);
    checar("arquivo de outro SEI nao entra", !!c2.avisos.at(-1)?.includes("outro usuário ou de outro SEI"));
    c2.arquivos.push(JSON.stringify({ formato: FORMATO_ARQUIVO_MORTO, versao: 1, demandas: [], registros: [] }));
    itemDoMenu(c2.t.raiz, "Ajustes", "Importar arquivo…");
    await tique(40);
    checar("o arquivo morto aqui e orientado ao lugar certo", !!c2.avisos.at(-1)?.includes("arquivo morto"));

    // Mais de 5 MB: o aviso de tamanho.
    c2.arquivos.push(`${b?.conteudo ?? ""}${" ".repeat(5 * 1024 * 1024)}`);
    itemDoMenu(c2.t.raiz, "Ajustes", "Importar arquivo…");
    await tique(120);
    checar("arquivo acima de 5 MB mostra o aviso de tamanho", !!c2.avisos.at(-1)?.includes(MENSAGEM_ARQUIVO_GRANDE), c2.avisos.at(-1));
    checar(
      "o aviso manda arquivar e exportar o arquivo morto",
      MENSAGEM_ARQUIVO_GRANDE === "O arquivo ficou grande; exporte um arquivo morto e remova as arquivadas antigas.",
    );
  }

  secao("arquivar: copias automaticas (Review Focus 5 e restauracao)");
  {
    const c = colabDeTeste({ copias: true });
    const a = await nova(c.t, "unidade", "A");
    const bId = await nova(c.t, "unidade", "B");
    await c.c.iniciar();
    await tique(40);
    await c.t.repos.unidade.editar(bId, { titulo: "B editada depois" });
    await c.t.repos.unidade.remover(a);
    await c.t.montar();
    const dlg = await abrir(c, ABRIR.copias);
    checar(
      "o dialogo lista a copia do dia com a quantidade",
      texto(dlg.closest("dialog")?.querySelector("h2")) === "Cópias automáticas" &&
        dlg.querySelectorAll(".dem-copias li").length === 1 &&
        texto(dlg.querySelector(".dem-copias li")).includes("2 demandas"),
      texto(dlg),
    );
    botao(dlg, "Restaurar a cópia de 12/10/2026")?.click();
    await tique(80);
    const t = texto(dlg.querySelector(".dem-copias-aviso"));
    checar(
      "restaurar traz de volta o que sumiu e diz quanto",
      t === "Voltou 1 demanda." || t.startsWith("Voltou 1 demanda") || t.startsWith("Voltaram 1 demanda"),
      t,
    );
    checar("a excluida voltou", await vivo(c, "unidade", a));
    checar("a edicao mais nova nao foi desfeita", (await c.t.repos.unidade.obter(bId))?.titulo === "B editada depois");
    fecharDialogo(c.t.doc);
    // Copia danificada: nada e restaurado.
    const lista = await (c.copias as NonNullable<typeof c.copias>).listar({ host: c.t.deps.contexto.host, login: "ana" });
    let erro = "";
    try {
      await restaurarCopia(
        c.t.area,
        { ...(lista[0] as NonNullable<(typeof lista)[0]>), envelope: { lixo: true } as never },
        { host: c.t.deps.contexto.host, login: "ana" },
        () => ({ agora: 1, dispositivo: "x" }),
      );
    } catch (e) {
      erro = (e as Error).message;
    }
    checar("copia danificada nao restaura", erro.includes("danificada"));
  }
  {
    const c = colabDeTeste({ copias: false });
    await c.c.iniciar();
    await c.t.montar();
    const dlg = await abrir(c, ABRIR.copias);
    checar("sem banco de copias, o dialogo explica", texto(dlg).includes("não guarda cópias"));
    fecharDialogo(c.t.doc);
  }
}
