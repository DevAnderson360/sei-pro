/**
 * Nome e logo do produto no titulo da página.
 *
 * O mesmo pacote sai como "SEI Pro", "SEI Pro Lab", "ANTAQ Pro"..., e a página
 * de opções já mostra o nome e a logo do manifest. Aqui vale a mesma regra, e
 * fora da extensão (testes, pré-visualização) cai em "SEI Pro".
 */

import { identidadeDoProduto } from "../src/ui/identidade";

let passou = 0;
let falhou = 0;

function checar(nome: string, condicao: boolean, detalhe?: unknown) {
  if (condicao) {
    passou += 1;
    console.log(`  ok    ${nome}`);
  } else {
    falhou += 1;
    console.log(`  FALHA ${nome}${detalhe === undefined ? "" : ` -- ${JSON.stringify(detalhe)}`}`);
  }
}

console.log("\n== identidade do produto ==");

const lab = identidadeDoProduto({ short_name: "SEI Pro Lab", name: "SEI Pro Lab | Extensão", icons: { "32": "icons/lab/icon-32.png" } });
checar("usa o short_name do manifest", lab.nome === "SEI Pro Lab", lab);
checar("a logo e o icone de 32px, relativo a html/", lab.logo === "../icons/lab/icon-32.png", lab);

const semShort = identidadeDoProduto({ name: "ANTAQ Pro", icons: { "32": "icons/antaq/icon-32.png" } });
checar("sem short_name, usa o name", semShort.nome === "ANTAQ Pro", semShort);

const semIcone = identidadeDoProduto({ short_name: "SEI Pro" });
checar("sem icone de 32px, usa o icone padrao", semIcone.logo === "../icons/icon-32.png", semIcone);

const fora = identidadeDoProduto(undefined);
checar("fora da extensao (sem manifest): SEI Pro e icone padrao", fora.nome === "SEI Pro" && fora.logo === "../icons/icon-32.png", fora);

const vazio = identidadeDoProduto({ short_name: "   " });
checar("nome em branco nao vira titulo vazio", vazio.nome === "SEI Pro", vazio);

console.log(`\n${passou} ok, ${falhou} falha(s)\n`);
process.exit(falhou ? 1 : 0);
