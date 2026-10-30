/**
 * O convite para avaliar o SEI Pro na loja (`assets/js/avaliacao.js`, no site).
 *
 * O arquivo é um script de página, sem build. Carregado com um `module` falso,
 * ele entrega só a lógica, sem tocar no DOM: o que vale como pedido no
 * endereço, se a pessoa pode ver o convite de novo, e qual texto cai no dia.
 * O modal em si é conferido no navegador.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { checar, secao } from "./util";

const AQUI = dirname(fileURLToPath(import.meta.url));
const FONTE = readFileSync(join(AQUI, "..", "..", "assets", "js", "avaliacao.js"), "utf8");

interface Texto { t: string; d: string; c: string[]; assinatura?: boolean }
interface Convite {
  TEXTOS: Texto[];
  LOJAS: Record<string, { nome: string; botao: string; url: string }>;
  lerPedido(hash: string): { loja: string; versao: string | null } | null;
  podeMostrar(registro: unknown, agora: number): boolean;
  registroDepois(acao: "avaliar" | "adiar", agora: number): unknown;
  sortearTexto(aleatorio?: () => number): number;
}

function carregar(): Convite {
  const modulo = { exports: {} as Convite };
  new Function("module", FONTE)(modulo);
  return modulo.exports;
}

const DIA = 24 * 3600 * 1000;

export function verificarConviteDeAvaliacao(): void {
  const c = carregar();

  secao("convite de avaliacao: o pedido vem no fragmento do endereco");
  checar("chrome com versao", JSON.stringify(c.lerPedido("#avaliar=chrome&versao=2.3")) === '{"loja":"chrome","versao":"2.3"}', c.lerPedido("#avaliar=chrome&versao=2.3"));
  checar("edge com versao de tres numeros", JSON.stringify(c.lerPedido("#avaliar=edge&versao=2.3.1")) === '{"loja":"edge","versao":"2.3.1"}', c.lerPedido("#avaliar=edge&versao=2.3.1"));
  checar("loja desconhecida nao vale", c.lerPedido("#avaliar=firefox&versao=2.3") === null);
  checar("ancora comum do historico nao vale", c.lerPedido("#versão-23") === null);
  checar("sem fragmento nao vale", c.lerPedido("") === null);
  const estranha = c.lerPedido("#avaliar=chrome&versao=<b>2.3</b>");
  checar("versao fora do formato e descartada, o convite continua", estranha?.loja === "chrome" && estranha?.versao === null, estranha);

  secao("convite de avaliacao: quem ja respondeu");
  const agora = Date.UTC(2026, 9, 1, 15, 0);
  checar("quem nunca viu pode ver", c.podeMostrar(null, agora) === true);
  checar("registro ilegivel nao bloqueia", c.podeMostrar("lixo", agora) === true);
  checar("quem clicou em avaliar nunca mais ve", c.podeMostrar(c.registroDepois("avaliar", agora), agora + 400 * DIA) === false);
  const adiado = c.registroDepois("adiar", agora);
  checar("quem disse agora nao, nao ve antes de 60 dias", c.podeMostrar(adiado, agora + 59 * DIA) === false);
  checar("e volta a ver depois de 60 dias", c.podeMostrar(adiado, agora + 60 * DIA) === true);

  secao("convite de avaliacao: texto sorteado a cada abertura");
  const n = c.TEXTOS.length;
  checar("sorteio 0 pega o primeiro texto", c.sortearTexto(() => 0) === 0);
  checar("sorteio perto de 1 pega o ultimo texto", c.sortearTexto(() => 0.9999999) === n - 1);
  checar("sorteio no meio pega o texto do meio", c.sortearTexto(() => 0.5) === Math.floor(n / 2));
  const vistos = new Set<number>();
  for (let i = 0; i < 4000; i++) vistos.add(c.sortearTexto());
  checar("com sorteio de verdade, todos os textos aparecem", vistos.size === n, vistos.size);
  checar("o indice sempre cabe na lista", [...vistos].every((i) => Number.isInteger(i) && i >= 0 && i < n));

  secao("convite de avaliacao: os textos aprovados");
  checar("sao 34", n === 34, n);
  checar("todo texto tem titulo, botao e corpo", c.TEXTOS.every((x) => x.t && x.d && x.c.length > 0));
  checar("todo corpo cita a loja", c.TEXTOS.every((x) => x.c.join(" ").includes("{loja}")), c.TEXTOS.filter((x) => !x.c.join(" ").includes("{loja}")).map((x) => x.t));
  checar("titulos nao se repetem", new Set(c.TEXTOS.map((x) => x.t)).size === n);
  const recusados = ["Senta que lá vem história", "Caneta azul, azul caneta", "Tá tranquilo? Tá favorável?", "Calma, calabreso"];
  checar("os quatro recusados ficaram de fora", c.TEXTOS.every((x) => !recusados.includes(x.t)));
  checar("nenhum pede cinco estrelas", c.TEXTOS.every((x) => !/5 estrelas|cinco estrelas/i.test(x.t + x.c.join(" "))));
  checar("so o primeiro leva o bloco de assinatura", c.TEXTOS.filter((x) => x.assinatura).length === 1 && c.TEXTOS[0].assinatura === true);
  checar("lojas: Chrome Web Store e Edge", Object.keys(c.LOJAS).join() === "chrome,edge");
}
