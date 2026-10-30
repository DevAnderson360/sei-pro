import { executarOperacao } from "../src/app/acoes";
import { textoDoSincronizar } from "../src/app/colaboracao";
import { naTela } from "../src/app/dados";
import { TEXTO_CONSENTIMENTO_UNIDADE } from "../src/app/dialogos/consentimento";
import { TEXTO_COTA_CHEIA } from "../src/app/erros";
import { TETO_TEXTO } from "../src/modelo/constantes";
import { dialogoAberto, fecharDialogo, itemDoMenu, nova, texto } from "./apoioApp";
import { arquivoFalso, type Colab, colabDeTeste, ok3 } from "./apoioColaboracao";
import { HOJE } from "./fabrica";
import { botao, checar, secao, tique } from "./util";

const faixa = (c: Colab, nome: string) => c.t.raiz.querySelector(`[data-faixa="${nome}"]`) as HTMLElement | null;
const indicador = (c: Colab) => c.t.raiz.querySelector(".dem-sinc") as HTMLElement | null;
const linhas = (dlg: Element | null) => [...(dlg?.querySelectorAll("li[data-tabela]") ?? [])] as HTMLElement[];
const doEscopo = (dlg: Element | null, escopo: string) => (dlg?.querySelector(`[data-escopo="${escopo}"]`) ?? null) as HTMLElement | null;

async function abrirSincronizacao(c: Colab): Promise<HTMLElement> {
  checarMenu(c);
  await tique(40);
  return dialogoAberto(c.t.doc) as HTMLElement;
}
function checarMenu(c: Colab): void {
  itemDoMenu(c.t.raiz, "Ajustes", "Sincronização…");
}

async function ligado(c: Colab, vis: "unidade" | "eu" = "unidade"): Promise<void> {
  await c.consent(vis).definir("ligado");
}

export async function verificarAppColaboracao(): Promise<void> {
  secao("colaboracao: texto do Sincronizar agora");
  checar("as tres tabelas ok: Sincronizado.", textoDoSincronizar({ unidade: ok3(), eu: null }) === "Sincronizado.");
  checar("resposta torta nao e Sincronizado.", textoDoSincronizar({ unidade: { d: { estado: "ok" } } }).startsWith("Não foi possível"));
  checar(
    "uma tabela com erro diz o motivo",
    textoDoSincronizar({
      unidade: { ...ok3(), h: { estado: "erro", quando: 1, pendente: false, mensagem: "Histórico grande demais" } },
      eu: null,
    }) === "Histórico grande demais",
  );
  checar(
    "esperando o Entendi",
    textoDoSincronizar({
      unidade: { ...ok3(), d: { estado: "ok", quando: 1, pendente: true, aguardandoPermissao: true } },
      eu: null,
    }).includes("Entendi"),
  );

  secao("colaboracao: consentimento unico da unidade (Review Focus 1)");
  {
    const c = colabDeTeste();
    await nova(c.t, "unidade", "A");
    await c.c.iniciar();
    await c.t.montar();
    const f = faixa(c, "consentimento");
    checar("faixa com o aviso exato e o botao Entendi", !!f && texto(f).includes(TEXTO_CONSENTIMENTO_UNIDADE) && !!botao(f, "Entendi"));
    checar(
      "o aviso diz o que a spec manda",
      TEXTO_CONSENTIMENTO_UNIDADE ===
        "Suas demandas da unidade ficam no Texto Padrão do SEI, visível a toda a unidade. Não escreva dados sigilosos no título ou na descrição.",
    );
    checar("antes do Entendi o RPC nao manda gravar", c.chamadas.length === 0 && (await c.consent("unidade").estado()) !== "ligado");
    botao(f as HTMLElement, "Entendi")?.click();
    await tique(60);
    checar("depois do Entendi o consentimento fica ligado", (await c.consent("unidade").estado()) === "ligado");
    checar("e a sincronizacao roda uma vez", c.chamadas.join() === "sincronizarAgora");
    checar("a faixa some", !faixa(c, "consentimento"));
    checar("o aviso do resultado", c.avisos.includes("Sincronizado."));
  }
  {
    const c = colabDeTeste();
    await c.c.iniciar();
    await c.t.montar();
    checar("sem demanda na unidade e sem o que enviar, nao pergunta nada", !faixa(c, "consentimento"));
    await nova(c.t, "unidade", "A");
    await tique(40);
    checar("a primeira demanda da unidade traz o aviso", !!faixa(c, "consentimento"));
  }

  secao("colaboracao: dialogo Sincronizacao, uma tabela em erro (Review Focus 2)");
  {
    const c = colabDeTeste();
    await ligado(c);
    await nova(c.t, "unidade", "A");
    await c.status("unidade", "d", { tamanho: 20 * 1024 });
    await c.status("unidade", "a", { tamanho: 1024 });
    await c.status("unidade", "h", {
      estado: "erro",
      mensagem:
        "O histórico das demandas passou do limite do Texto Padrão (120 KB de 100 KB) e não foi gravado; as demandas seguem sincronizando.",
      tamanho: 120 * 1024,
    });
    await c.c.iniciar();
    await c.t.montar();
    const dlg = await abrirSincronizacao(c);
    checar("o dialogo abre", texto(dlg?.closest("dialog")?.querySelector("h2")) === "Sincronização");
    const un = linhas(doEscopo(dlg, "unidade"));
    checar(
      "tres linhas: Demandas, Arquivadas, Histórico",
      un.map((l) => texto(l.querySelector(".dem-sync-nome"))).join() === "Demandas,Arquivadas,Histórico",
    );
    checar("Demandas e Arquivadas seguem ok", un[0]?.getAttribute("data-estado") === "ok" && un[1]?.getAttribute("data-estado") === "ok");
    checar(
      "o Histórico mostra o erro dele",
      un[2]?.getAttribute("data-estado") === "erro" && texto(un[2]).includes("passou do limite do Texto Padrão"),
    );
    checar("o erro de uma nao contamina as outras", !texto(un[0]).includes("passou do limite"));
    checar(
      "uso em KB e %",
      texto(un[0]?.querySelector(".dem-sync-uso")) === "20 KB · 20%" && texto(un[2]?.querySelector(".dem-sync-uso")).includes("120%"),
    );
    const eu = linhas(doEscopo(dlg, "eu"));
    checar(
      "o pessoal desligado mostra as tres linhas como locais",
      eu.length === 3 && eu.every((l) => l.getAttribute("data-estado") === "local"),
    );
    botao(dlg, "Sincronizar agora")?.click();
    await tique(60);
    checar("Sincronizar agora chama a aba", c.chamadas.includes("sincronizarAgora"));
    fecharDialogo(c.t.doc);
  }
  {
    const c = colabDeTeste();
    await ligado(c);
    await c.status("unidade", "d", { pendente: true });
    await c.status("unidade", "a", {});
    await c.status("unidade", "h", { estado: "nunca" });
    await c.c.iniciar();
    await c.t.montar();
    const dlg = await abrirSincronizacao(c);
    const un = linhas(doEscopo(dlg, "unidade"));
    checar(
      "pendente e nunca lido",
      un[0]?.getAttribute("data-estado") === "pendente" &&
        texto(un[0]).includes("alterações a enviar") &&
        un[2]?.getAttribute("data-estado") === "local",
    );
    await c.status("unidade", "h", { estado: "erro", mensagem: "boom" });
    await tique(30);
    checar(
      "o dialogo aberto se repinta com a mudanca de status",
      linhas(doEscopo(dlg, "unidade"))[2]?.getAttribute("data-estado") === "erro",
    );
    fecharDialogo(c.t.doc);
  }

  secao("colaboracao: texto pessoal (convite, consentimento, apagar)");
  {
    const c = colabDeTeste();
    await nova(c.t, "eu", "Minha");
    await c.c.iniciar();
    await c.t.montar();
    const conv = faixa(c, "convite");
    checar(
      "o convite aparece, desligado por padrao",
      !!conv && texto(conv).includes("Guardar minhas demandas pessoais no SEI") && (await c.consent("eu").estado()) === "nao-perguntado",
    );
    botao(conv as HTMLElement, "Ligar…")?.click();
    await tique(30);
    checar(
      "ligar pede o consentimento (nada vai antes)",
      texto(dialogoAberto(c.t.doc)?.querySelector("h2")) === "Guardar no SEI" &&
        c.chamadas.length === 0 &&
        (await c.consent("eu").estado()) !== "ligado",
    );
    botao(dialogoAberto(c.t.doc) as HTMLElement, "Ligar")?.click();
    await tique(60);
    checar(
      "ligado, com a sincronizacao",
      (await c.consent("eu").estado()) === "ligado" && c.chamadas.includes("sincronizarAgora") && !faixa(c, "convite"),
    );
    const dlg = await abrirSincronizacao(c);
    const eu = linhas(doEscopo(dlg, "eu"));
    checar(
      "o pessoal ligado mostra as tres linhas",
      eu.length === 3 && eu.every((l) => texto(l).includes("Ligado: falta abrir o Controle de Processos.")),
    );
    c.chamadas.length = 0;
    botao(dlg, "Desligar e apagar do SEI")?.click();
    await tique(60);
    checar(
      "Desligar e apagar confirma e chama apagarPessoal",
      c.chamadas.join() === "apagarPessoal" && texto(dlg).includes("foram apagados do SEI"),
    );
    fecharDialogo(c.t.doc);
  }
  {
    const c = colabDeTeste();
    await nova(c.t, "eu", "Minha");
    await c.c.iniciar();
    await c.t.montar();
    botao(faixa(c, "convite") as HTMLElement, "Agora não")?.click();
    await tique(40);
    checar(
      "Agora nao desliga e a faixa some",
      (await c.consent("eu").estado()) === "desligado" && !faixa(c, "convite") && c.chamadas.length === 0,
    );
  }
  {
    const c = colabDeTeste();
    await nova(c.t, "eu", "Minha");
    await c.c.iniciar();
    await c.t.montar();
    botao(faixa(c, "convite") as HTMLElement, "Ligar…")?.click();
    await tique(30);
    fecharDialogo(c.t.doc);
    await tique(30);
    checar("fechar o dialogo pelo X e nao: nada liga", (await c.consent("eu").estado()) !== "ligado" && c.chamadas.length === 0);
  }

  secao("colaboracao: indicador no cabecalho");
  {
    const c = colabDeTeste();
    await nova(c.t, "unidade", "A");
    await c.c.iniciar();
    await c.t.montar();
    checar("local: sem consentimento", indicador(c)?.getAttribute("data-tom") === "local");
    await ligado(c);
    await c.status("unidade", "d", {});
    await c.status("unidade", "a", {});
    await c.status("unidade", "h", {});
    await tique(40);
    checar(
      "ok, com a hora da ultima",
      indicador(c)?.getAttribute("data-tom") === "ok" && /\d{2}:\d{2}/.test(texto(indicador(c))),
      texto(indicador(c)),
    );
    await c.status("unidade", "a", { pendente: true });
    await tique(40);
    checar("pendente", indicador(c)?.getAttribute("data-tom") === "pendente");
    await c.status("unidade", "h", { estado: "erro", mensagem: "O SEI recusou a gravação." });
    await tique(40);
    checar(
      "erro, com o motivo no title",
      indicador(c)?.getAttribute("data-tom") === "erro" &&
        (indicador(c)?.getAttribute("title") ?? "").includes("O SEI recusou a gravação."),
    );
    indicador(c)?.click();
    await tique(40);
    checar("clicar no indicador abre a Sincronizacao", texto(dialogoAberto(c.t.doc)?.querySelector("h2")) === "Sincronização");
    fecharDialogo(c.t.doc);
  }

  secao("colaboracao: limite do texto das demandas (Review Focus 9)");
  {
    const c = colabDeTeste();
    await ligado(c);
    const a = await nova(c.t, "unidade", "A");
    await c.status("unidade", "d", { tamanho: TETO_TEXTO + 1024 });
    await c.c.iniciar();
    await c.t.montar();
    const bloqueada = c.t.raiz.querySelector(".dem-nova") as HTMLButtonElement;
    checar("criar bloqueado a 100%", bloqueada.hasAttribute("disabled") && !!c.t.raiz.querySelector(".dem-faixa.bloqueio"));
    const antes = (await c.t.repos.unidade.obter(a))?.titulo;
    await c.t.repos.unidade.editar(a, { titulo: "A editada" });
    await executarOperacao(c.t.deps, naTela((await c.t.repos.unidade.obter(a)) as never, "unidade", HOJE), "iniciar");
    const depois = await c.t.repos.unidade.obter(a);
    checar("editar e iniciar continuam", antes === "A" && depois?.titulo === "A editada" && depois.iniciadaEm !== undefined);
    botao(c.t.raiz.querySelector(".dem-faixa.bloqueio") as HTMLElement, "Arquivar concluídas antigas…")?.click();
    await tique(40);
    checar(
      "a faixa abre Arquivar concluidas antigas",
      texto(dialogoAberto(c.t.doc)?.querySelector("h2")) === "Arquivar concluídas antigas",
    );
    fecharDialogo(c.t.doc);
  }

  secao("colaboracao: cota cheia do navegador");
  {
    const c = colabDeTeste();
    const a = await nova(c.t, "unidade", "A");
    await c.t.montar();
    const antes = JSON.stringify(await c.t.repos.unidade.entidades());
    const real = c.t.area.gravar.bind(c.t.area);
    c.t.area.gravar = async () => {
      throw new Error("QUOTA_BYTES quota exceeded");
    };
    await executarOperacao(c.t.deps, naTela((await c.t.repos.unidade.obter(a)) as never, "unidade", HOJE), "iniciar");
    const aviso = texto(c.t.doc.querySelector(".spro-aviso"));
    checar(
      "o aviso diz o que fazer",
      aviso === TEXTO_COTA_CHEIA &&
        aviso === "O navegador não tem mais espaço para guardar as demandas. Arquive as concluídas antigas e exporte o arquivo morto.",
      aviso,
    );
    c.t.area.gravar = real;
    checar("nada fica pela metade", JSON.stringify(await c.t.repos.unidade.entidades()) === antes);
    checar("o app segue de pe", !!c.t.raiz.querySelector(".dem"));
  }

  secao("colaboracao: a aba que nao responde vira aviso, nunca excecao");
  {
    const c = colabDeTeste({ falhar: { sincronizarAgora: "A aba do SEI não respondeu." } });
    const r = await c.c.sincronizarAgora();
    checar("devolve null e avisa", r === null && c.avisos.at(-1) === "A aba do SEI não respondeu.");
    const lixo = colabDeTeste({ resposta: "lixo" });
    checar(
      "resposta torta nao e Sincronizado.",
      (await lixo.c.sincronizarAgora()) === null && lixo.avisos.at(-1) === "Não foi possível sincronizar agora.",
    );
  }

  secao("colaboracao: arquivo ligado e sem arquivo");
  {
    const { a, lig } = arquivoFalso({ configurado: false });
    const c = colabDeTeste({ arquivo: lig });
    await c.c.iniciar();
    await c.t.montar();
    checar("iniciar sincroniza o arquivo ligado", a.chamadas.includes("sincronizar"));
    let dlg = await abrirSincronizacao(c);
    const sec = dlg.querySelector('[data-secao="arquivo"]') as HTMLElement;
    checar("sem arquivo escolhido: Escolher arquivo na nuvem…", !!botao(sec, "Escolher arquivo na nuvem…"));
    botao(sec, "Escolher arquivo na nuvem…")?.click();
    await tique(40);
    checar(
      "escolhe pelo seletor",
      a.chamadas.includes("escolher:novo") &&
        texto(dlg.querySelector('[data-secao="arquivo"]')).includes("demandas.json") &&
        texto(dlg.querySelector('[data-secao="arquivo"]')).includes("Último envio"),
    );
    fecharDialogo(c.t.doc);
    a.chamadas.length = 0;
    const perm = arquivoFalso({ configurado: true, status: { estado: "permissao", quando: 1, nome: "x.json" } });
    const c2 = colabDeTeste({ arquivo: perm.lig });
    await c2.c.iniciar();
    await c2.t.montar();
    dlg = await abrirSincronizacao(c2);
    const sec2 = dlg.querySelector('[data-secao="arquivo"]') as HTMLElement;
    checar("permissao expirada oferece Reconectar", !!botao(sec2, "Reconectar"));
    botao(sec2, "Reconectar")?.click();
    await tique(40);
    checar("reconecta", perm.a.chamadas.includes("reconectar"));
    fecharDialogo(c2.t.doc);
  }
  {
    const c = colabDeTeste({ arquivo: null });
    await c.c.iniciar();
    await c.t.montar();
    const dlg = await abrirSincronizacao(c);
    const sec = dlg.querySelector('[data-secao="arquivo"]') as HTMLElement;
    checar(
      "sem File System Access: so Exportar e Importar",
      texto(sec).includes("Neste navegador, use Exportar e Importar") &&
        !!botao(sec, "Exportar arquivo (backup)") &&
        !!botao(sec, "Importar arquivo…") &&
        !botao(sec, "Escolher arquivo na nuvem…"),
    );
    fecharDialogo(c.t.doc);
  }

  secao("colaboracao: menu de ajustes");
  {
    const c = colabDeTeste();
    await c.c.iniciar();
    await c.t.montar();
    const itens = c.c.itensDoMenu().map((i) => (typeof i === "string" ? "-" : i ? i.rotulo : ""));
    checar(
      "os itens da spec, na ordem",
      itens.join("|") ===
        "Sincronização…|Arquivar concluídas antigas…|Exportar arquivo morto e limpar…|-|Exportar arquivo (backup)…|Importar arquivo…|Cópias automáticas…|-|Ajuda",
      itens.join("|"),
    );
    itemDoMenu(c.t.raiz, "Ajustes", "Ajuda");
    await tique(20);
    checar("a Ajuda diz quantas cabem", texto(dialogoAberto(c.t.doc)).includes("cerca de 500 demandas ativas por unidade"));
    fecharDialogo(c.t.doc);
    c.c.destruir();
  }
}
