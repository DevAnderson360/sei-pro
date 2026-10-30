/** As pilulas do titulo do painel embutido: as MINHAS demandas abertas, nos dois escopos da unidade. */

import { areaMemoria } from "@comum/armazenamento/area";
import { contarAlertas } from "../../src/app/alertasDaAba";
import { carregarDados } from "../../src/app/dados";
import { escoposDaUnidade } from "../../src/modelo/escopo";
import { minhasAtrasadas, minhasDaSemana } from "../../src/modelo/minhas";
import { ligarAlertas, montarPainelDemandas, pintarAlertas } from "../../src/pagina/painel";
import { RepositorioDemandas } from "../../src/repositorio";
import { HOJE } from "../fabrica";
import { botao, checar, secao, telaSei, tique } from "./util";

const EU = { login: "pedro.soares", nome: "Pedro Soares" };

export async function verificarPainel(): Promise<void> {
  secao("painel: pilulas do titulo");
  const { doc } = telaSei("sei41/caixa.html");
  const aberto: boolean[] = [];
  const m = montarPainelDemandas(doc, { urlApp: "x", recolhido: true, ordem: null, aoRecolher: (r) => aberto.push(r) })!;
  const titulo = m.painel.querySelector(".spro-dem-titulo") as HTMLElement;
  const tipos: string[] = [];
  pintarAlertas(titulo, { atrasadas: 1, semana: 2 }, false, (t) => tipos.push(t));
  checar(
    "plural certo",
    [...titulo.querySelectorAll(".spro-dem-pilula")].map((p) => p.textContent).join("|") === "1 atrasada|2 vencem nesta semana",
  );
  botao(titulo, "2 vencem nesta semana")!.click();
  botao(titulo, "1 atrasada")!.click();
  checar("clique avisa o tipo", tipos.join() === "semana,atrasadas");
  checar("decorativas: o texto diz tudo", titulo.querySelector(".spro-dem-atrasadas svg")?.getAttribute("aria-hidden") === "true");
  const estilo = doc.getElementById("spro-dem-alertas-estilo")?.textContent ?? "";
  checar(
    "caixa vazia some de verdade (a pagina do SEI nao tem a regra [hidden])",
    /\.spro-dem-alertas\[hidden\]\s*\{\s*display:\s*none/.test(estilo),
  );
  pintarAlertas(titulo, { atrasadas: 0, semana: 0 }, true, () => undefined);
  checar(
    "sem alertas, sem pilulas",
    !titulo.querySelector(".spro-dem-pilula") && (titulo.querySelector(".spro-dem-alertas") as HTMLElement).hidden,
  );

  secao("painel: pilulas ligadas as demandas da unidade (so as minhas)");
  const area = areaMemoria();
  const esc = escoposDaUnidade("sei.x", "pedro.soares", "1");
  let relogio = 1_790_000_000_000;
  const carimbo = () => ({ agora: ++relogio, dispositivo: "t", por: "pedro.soares", nome: "Pedro Soares" });
  const un = new RepositorioDemandas(area, esc.unidade, carimbo);
  const eu = new RepositorioDemandas(area, esc.eu, carimbo);
  // HOJE = segunda 12/10/2026: prazo 05/10 atrasado; 16/10 vence na semana.
  await un.criar({ titulo: "Minha atrasada", prazo: "2026-10-05", distribuidaEm: "2026-10-01", responsavel: EU });
  await un.criar({
    titulo: "De outro, atrasada",
    prazo: "2026-10-05",
    distribuidaEm: "2026-10-01",
    responsavel: { login: "ana", nome: "Ana" },
  });
  await un.criar({ titulo: "Sem responsavel, atrasada", prazo: "2026-10-05", distribuidaEm: "2026-10-01" });
  await eu.criar({ titulo: "Minha da semana", prazo: "2026-10-16", distribuidaEm: "2026-10-01", responsavel: EU });
  const dados = await carregarDados({ unidade: un, eu }, HOJE);
  const lista = dados.map((x) => x.demanda);
  checar("so as minhas contam", minhasAtrasadas(lista, EU, HOJE).length === 1 && minhasDaSemana(lista, EU, HOJE).length === 1);
  checar("contarAlertas", JSON.stringify(contarAlertas(dados, EU, HOJE)) === '{"atrasadas":1,"semana":1}');
  // Sem login na demanda, o nome sem acento e sem caixa vale; concluida e arquivada nao contam.
  const minha = lista.find((d) => d.titulo === "Minha atrasada")!;
  const nomeSo = { nome: "pedro  SOARES" };
  checar(
    "nome igual quando a demanda nao tem login",
    minhasAtrasadas([{ ...minha, responsavel: nomeSo }], { nome: "Pedro Soares" }, HOJE).length === 1,
  );
  checar("concluida nao conta", minhasAtrasadas([{ ...minha, concluidaEm: "2026-10-06" }], EU, HOJE).length === 0);
  checar("arquivada nao conta", minhasAtrasadas([{ ...minha, arquivadoEm: 5 }], EU, HOJE).length === 0);

  const doc2 = telaSei("sei41/caixa.html").doc;
  const m2 = montarPainelDemandas(doc2, { urlApp: "x", recolhido: true, ordem: null, aoRecolher: (r) => aberto.push(r) })!;
  const pedidos: Array<{ op: string; args: unknown }> = [];
  let rpcPronto: { chamar(op: string, args?: unknown): Promise<unknown> } | null = null;
  const contagens: number[] = [];
  const alertas = ligarAlertas(m2, {
    temaEscuro: false,
    repos: { unidade: un, eu },
    eu: EU,
    rpc: () => rpcPronto,
    hoje: () => HOJE,
    atraso: 1,
    espera: 5,
    aoContar: (n) => void contagens.push(n),
  });
  await tique(30);
  const t2 = m2.painel.querySelector(".spro-dem-titulo") as HTMLElement;
  const textos = () => [...t2.querySelectorAll(".spro-dem-pilula")].map((p) => p.textContent).join("|");
  checar("conta as minhas dos dois escopos", textos() === "1 atrasada|1 vence nesta semana" && contagens.at(-1) === 1, textos());
  await eu.criar({ titulo: "Outra minha atrasada", prazo: "2026-10-01", distribuidaEm: "2026-09-20", responsavel: EU });
  await tique(30);
  checar("refaz a cada gravacao", textos() === "2 atrasadas|1 vence nesta semana", textos());
  botao(t2, "2 atrasadas")!.click();
  checar("clique com o painel recolhido abre o painel", !m2.corpo.hidden && aberto.at(-1) === false);
  await tique(20);
  checar("app ainda nao ligou: nao pede nada", pedidos.length === 0);
  rpcPronto = {
    chamar: async (op, args) => {
      pedidos.push({ op, args });
      return true;
    },
  };
  await tique(30);
  checar("quando o app liga, pede o alerta uma vez", JSON.stringify(pedidos) === '[{"op":"alerta","args":{"tipo":"atrasadas"}}]', pedidos);
  alertas.parar();
  const antes = textos();
  await eu.criar({ titulo: "Mais uma", prazo: "2026-10-02", distribuidaEm: "2026-09-20", responsavel: EU });
  await tique(30);
  checar("parado: nao repinta", textos() === antes);
}
