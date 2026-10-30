import { concluir } from "../src/modelo/operacoes";
import {
  appDeTeste,
  dialogoAberto,
  digitar,
  escolherCombo,
  fecharDialogo,
  itemDoMenu,
  itensDoMenu,
  nova,
  type Teste,
  texto,
} from "./apoioApp";
import { botao, checar, secao, tique } from "./util";

const Ev = (t: Teste) => (t.doc.defaultView as unknown as { Event: typeof Event }).Event;
function disparar(t: Teste, el: Element, tipo: string, extra: Record<string, unknown> = {}): void {
  const e = new (Ev(t))(tipo, { bubbles: true, cancelable: true });
  for (const [k, v] of Object.entries(extra)) Object.defineProperty(e, k, { value: v });
  el.dispatchEvent(e);
}
const cartao = (t: Teste, id: string) => t.raiz.querySelector(`.dem-cartao[data-id="${id}"]`) as HTMLElement;
const corpo = (t: Teste, s: string) => t.raiz.querySelector(`.dem-coluna-corpo[data-coluna="${s}"]`) as HTMLElement;
const naColuna = (t: Teste, s: string) => [...corpo(t, s).querySelectorAll<HTMLElement>(".dem-cartao")].map((c) => c.dataset.id);
const titulos = (t: Teste, s: string) => [...corpo(t, s).querySelectorAll(".dem-cartao-titulo")].map((c) => texto(c));

/** Arrasta o cartão para uma coluna (ou sobre outro cartão). O linkedom não tem DataTransfer. */
async function arrastar(t: Teste, id: string, coluna: string, sobre?: string): Promise<void> {
  const dados: Record<string, string> = {};
  const dataTransfer = {
    setData: (k: string, v: string) => {
      dados[k] = v;
    },
    getData: (k: string) => dados[k] ?? "",
    effectAllowed: "",
  };
  disparar(t, cartao(t, id), "dragstart", { dataTransfer });
  const alvo = sobre ? cartao(t, sobre) : corpo(t, coluna);
  disparar(t, alvo, "dragover", { dataTransfer });
  disparar(t, alvo, "drop", { dataTransfer });
  await tique(30);
}

export async function verificarAppQuadro(): Promise<void> {
  secao("quadro: colunas");
  {
    const t = appDeTeste();
    await nova(t, "unidade", "A");
    await t.montar();
    (t.raiz.querySelector('[data-aba="quadro"]') as HTMLElement).click();
    const cols = [...t.raiz.querySelectorAll(".dem-coluna")].map((c) => texto(c.querySelector("h3")));
    checar("cinco colunas, Pausadas inclusive vazia", cols.join() === "Não iniciadas,Iniciadas,Pausadas,Concluídas,Avaliadas", cols);
    checar(
      "com a contagem",
      texto(corpo(t, "nao_iniciada").parentElement?.querySelector(".dem-conta")) === "1" &&
        texto(corpo(t, "pausada").parentElement?.querySelector(".dem-conta")) === "0",
    );
    botao(t.raiz, "Arquivadas")!.click();
    checar("Mostrar arquivadas acrescenta a coluna", t.raiz.querySelectorAll(".dem-coluna").length === 6 && !!corpo(t, "arquivada"));
  }

  secao("quadro: arrastar e dialogos (Review Focus 7)");
  {
    const t = appDeTeste();
    const a = await nova(t, "unidade", "A");
    const b = await nova(t, "unidade", "B", "iniciada");
    const c = await nova(t, "unidade", "C", "concluida");
    await t.montar();
    (t.raiz.querySelector('[data-aba="quadro"]') as HTMLElement).click();
    await arrastar(t, a, "iniciada");
    checar(
      "nao iniciada para iniciada grava e o cartao muda de coluna",
      !!(await t.repos.unidade.obter(a))?.iniciadaEm && naColuna(t, "iniciada").includes(a) && !naColuna(t, "nao_iniciada").includes(a),
    );

    await arrastar(t, b, "concluida");
    checar("iniciada para concluida abre o dialogo de conclusao", texto(dialogoAberto(t.doc)?.querySelector("h2")) === "Concluir demanda");
    fecharDialogo(t.doc);
    await tique(20);
    checar(
      "cancelar (X/Esc) nao grava nada e o cartao volta",
      !(await t.repos.unidade.obter(b))?.concluidaEm && naColuna(t, "iniciada").includes(b),
    );
    await arrastar(t, b, "concluida");
    digitar(dialogoAberto(t.doc)?.querySelector("[name=data]") as HTMLInputElement, "2026-10-12");
    botao(dialogoAberto(t.doc) as HTMLElement, "Concluir")!.click();
    await tique(40);
    checar(
      "preencher e gravar move o cartao",
      (await t.repos.unidade.obter(b))?.concluidaEm === "2026-10-12" && naColuna(t, "concluida").includes(b),
    );

    await arrastar(t, c, "avaliada");
    checar("concluida para avaliada abre a avaliacao", texto(dialogoAberto(t.doc)?.querySelector("h2")) === "Avaliar demanda");
    fecharDialogo(t.doc);
    await tique(20);
    checar("cancelar a avaliacao nao grava", !(await t.repos.unidade.obter(c))?.avaliacao && naColuna(t, "concluida").includes(c));
    await arrastar(t, c, "avaliada");
    ((dialogoAberto(t.doc) as HTMLElement).querySelectorAll('[role="radio"]')[2] as HTMLElement).click();
    botao(dialogoAberto(t.doc) as HTMLElement, "Avaliar")!.click();
    await tique(40);
    checar("avaliar move para Avaliadas", (await t.repos.unidade.obter(c))?.avaliacao?.nota === 3 && naColuna(t, "avaliada").includes(c));

    const d = await nova(t, "unidade", "D");
    await tique(30);
    await arrastar(t, d, "concluida");
    checar(
      "movimento invalido: aviso e nada gravado",
      texto(t.doc.querySelector(".spro-aviso")).includes("Esse movimento não é permitido") &&
        !dialogoAberto(t.doc) &&
        !(await t.repos.unidade.obter(d))?.concluidaEm &&
        naColuna(t, "nao_iniciada").includes(d),
    );
  }

  secao("quadro: reordenar na coluna");
  {
    const t = appDeTeste();
    const a = await nova(t, "unidade", "A");
    const b = await nova(t, "unidade", "B");
    const c = await nova(t, "unidade", "C");
    await t.montar();
    (t.raiz.querySelector('[data-aba="quadro"]') as HTMLElement).click();
    checar("ordem inicial", titulos(t, "nao_iniciada").join() === "A,B,C");
    await arrastar(t, c, "nao_iniciada", a);
    checar("soltar antes de outro cartao reordena", titulos(t, "nao_iniciada").join() === "C,A,B", titulos(t, "nao_iniciada"));
    await tique(20);
    checar("a ordem persiste no repositorio", (await t.repos.unidade.dados()).map((x) => x.titulo).join() === "C,A,B");
    await arrastar(t, c, "nao_iniciada");
    checar("soltar no vazio da coluna poe no fim", titulos(t, "nao_iniciada").join() === "A,B,C", titulos(t, "nao_iniciada"));
    const alt = (id: string, key: string) => disparar(t, cartao(t, id), "keydown", { key, altKey: true });
    alt(a, "ArrowDown");
    await tique(30);
    checar("Alt+seta para baixo reordena pelo teclado", titulos(t, "nao_iniciada").join() === "B,A,C", titulos(t, "nao_iniciada"));
    alt(c, "ArrowUp");
    await tique(30);
    checar("Alt+seta para cima", titulos(t, "nao_iniciada").join() === "B,C,A", titulos(t, "nao_iniciada"));
    void b;
  }

  secao("quadro: menu do cartao, filtro e concluidas antigas");
  {
    const t = appDeTeste();
    const a = await nova(t, "unidade", "A", "nao_iniciada", { responsavel: { login: "carla", nome: "Carla Dias" } });
    const b = await nova(t, "unidade", "B", "iniciada");
    const velha = await t.repos.unidade.criar({ titulo: "Velha", prazo: "2026-08-05", distribuidaEm: "2026-07-25" });
    await t.repos.unidade.aplicar(velha.id, (x, ca) => ({ demanda: { ...x, iniciadaEm: 1, atualizadoEm: ca.agora }, registros: [] }));
    await t.repos.unidade.aplicar(velha.id, (x, ca) => concluir(x, { data: "2026-08-01" }, ca));
    await t.montar();
    (t.raiz.querySelector('[data-aba="quadro"]') as HTMLElement).click();
    const mover = (id: string) => itensDoMenu(cartao(t, id), "Ações da demanda").filter((i) => i.startsWith("Mover para"));
    checar("menu: so as colunas permitidas (nao iniciada)", mover(a).join() === "Mover para Iniciadas", mover(a));
    checar(
      "menu: so as colunas permitidas (iniciada)",
      mover(b).join() === "Mover para Não iniciadas,Mover para Pausadas,Mover para Concluídas",
      mover(b),
    );
    itemDoMenu(cartao(t, a), "Ações da demanda", "Mover para Iniciadas");
    await tique(40);
    checar("escolher no menu faz o mesmo que arrastar", naColuna(t, "iniciada").includes(a));
    escolherCombo(t.raiz, "Responsável", "l:carla");
    const total = () => t.raiz.querySelectorAll(".dem-cartao").length;
    checar("filtro por responsavel reduz os cartoes de todas as colunas", total() === 1 && naColuna(t, "iniciada").join() === a, total());
    botao(t.raiz, "Limpar filtros")!.click();
    checar("a concluida de 72 dias fica fora (30 dias)", !naColuna(t, "concluida").includes(velha.id));
    const mais = t.raiz.querySelector(".dem-ver-mais") as HTMLElement;
    checar("Ver mais aparece com a contagem", !!mais && texto(mais).includes("1 antiga"), texto(mais));
    mais.click();
    await tique(20);
    checar("Ver mais aumenta para 90 dias e mostra a concluida", naColuna(t, "concluida").includes(velha.id));
    checar("e grava na preferencia", (await t.deps.preferencias.ler()).concluidasNoQuadroDias === 90);
  }
}
