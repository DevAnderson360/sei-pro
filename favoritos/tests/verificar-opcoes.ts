import { areaMemoria } from "@comum/armazenamento/area";
import { CHAVE_PREFERENCIAS } from "../src/modelo/constantes";
import { encaixar } from "../src/opcoes/encaixe";
import { montarOpcoesExibicao } from "../src/opcoes/exibicao";
import { checar, disparar, instalarDom, secao, tique } from "./util";

export async function verificarOpcoes(): Promise<void> {
  secao("opcoes: onde mostrar os monitorados");
  instalarDom("<html><body></body></html>");
  const sync = areaMemoria({ [CHAVE_PREFERENCIAS]: { exibir: "ambos", perguntarAoFavoritar: false } });
  const el = await montarOpcoesExibicao({ sync, lateralDisponivel: true });
  const radio = (v: string) => el.querySelector(`input[type="radio"][value="${v}"]`) as HTMLInputElement | null;
  const perguntar = el.querySelector('input[type="checkbox"]') as HTMLInputElement;
  checar("tres opcoes com painel lateral", !!radio("abaixo") && !!radio("lateral") && !!radio("ambos"));
  checar("marca a gravada", radio("ambos")!.checked && !radio("abaixo")!.checked);
  checar("perguntar ao monitorar segue a gravada", perguntar.checked === false);
  radio("lateral")!.checked = true;
  disparar(radio("lateral")!, "change");
  await tique();
  const p = (await sync.obter(CHAVE_PREFERENCIAS))[CHAVE_PREFERENCIAS] as { exibir?: string; perguntarAoFavoritar?: boolean };
  checar("trocar grava", p.exibir === "lateral" && p.perguntarAoFavoritar === false, p);
  perguntar.checked = true;
  disparar(perguntar, "change");
  await tique();
  checar(
    "caixa grava",
    ((await sync.obter(CHAVE_PREFERENCIAS))[CHAVE_PREFERENCIAS] as { perguntarAoFavoritar?: boolean }).perguntarAoFavoritar === true,
  );
  await sync.gravar({ [CHAVE_PREFERENCIAS]: { exibir: "abaixo", perguntarAoFavoritar: true } });
  await tique();
  checar("mudanca feita em outro lugar remarca", radio("abaixo")!.checked);

  const so = await montarOpcoesExibicao({ sync: areaMemoria(), lateralDisponivel: false });
  checar(
    "sem painel lateral, so 'abaixo' e explica",
    !so.querySelector('input[value="lateral"]') && /painel lateral/i.test(so.textContent ?? ""),
  );

  secao("opcoes: encaixe na pagina nova");
  const doc = instalarDom(
    '<html><body><div class="opcao" data-opcao="gerenciarfavoritos"><input type="checkbox" id="itemConfigGeral_gerenciarfavoritos" data-name="gerenciarfavoritos"></div><div class="opcao" data-opcao="gerenciarprojetos"></div></body></html>',
  );
  const chaveDom = doc.getElementById("itemConfigGeral_gerenciarfavoritos") as HTMLInputElement;
  const conteudo = document.createElement("div");
  const wrapper = encaixar(chaveDom, conteudo);
  checar(
    "o painel entra logo depois da linha da chave",
    wrapper !== null &&
      wrapper === doc.querySelector('[data-opcao="gerenciarfavoritos"]')?.nextElementSibling &&
      wrapper.contains(conteudo),
  );
  checar("nao desloca a linha seguinte", wrapper?.nextElementSibling === doc.querySelector('[data-opcao="gerenciarprojetos"]'));
  checar("chave fora de uma .opcao nao encaixa", encaixar(doc.createElement("input"), conteudo) === null);
}
