import { adaptarCor, lerCorCss } from "../src/tema/adaptar";
import { contraste, paraOklch } from "../src/tema/paleta";
import { checar, secao } from "./util";

const FUNDO = "#1a1d21";
const difHue = (a: number, b: number) => Math.min(Math.abs(a - b), 360 - Math.abs(a - b));

export function verificarAdaptar(): void {
  secao("tema/adaptar");

  checar(
    "transparent/inherit/rgba(0,0,0,0) -> null",
    ["transparent", "inherit", "rgba(0,0,0,0)", "currentColor", "", "lixo"].every(
      (x) => adaptarCor(x, "texto") === null && adaptarCor(x, "fundo") === null,
    ),
  );
  checar(
    "formatos: #rgb, rgb(), rgba(), nome",
    lerCorCss("#f00") === "#ff0000" &&
      lerCorCss("rgb(255, 0, 0)") === "#ff0000" &&
      lerCorCss("rgba(255,0,0,.5)") === "#ff0000" &&
      lerCorCss("Red") === "#ff0000",
  );

  checar("texto preto -> #e7e9ec", adaptarCor("#000", "texto") === "#e7e9ec");
  checar("fundo branco -> fundo do tema", adaptarCor("#ffffff", "fundo") === FUNDO);

  for (const cor of ["#ff0000", "#0000ff", "#008000", "#800080", "#000080", "#333333", "#c00000", "#1f497d"]) {
    const t = adaptarCor(cor, "texto")!;
    checar(`texto ${cor} -> ${t}: contraste >= 4,5 sobre o fundo escuro`, contraste(t, FUNDO) >= 4.5, contraste(t, FUNDO));
    const o = paraOklch(cor);
    if (o.c > 0.05) checar(`texto ${cor}: matiz preservado (+-6)`, difHue(paraOklch(t).h, o.h) <= 6, [paraOklch(t).h, o.h]);
  }

  const cinza = adaptarCor("#cccccc", "fundo")!;
  const claro = adaptarCor("#eeeeee", "fundo")!;
  const branco = adaptarCor("#ffffff", "fundo")!;
  checar("fundo #ccc e distinto do branco e do #eee", cinza !== branco && cinza !== claro);
  checar("fundo #ccc fica uma camada ACIMA do fundo da pagina", paraOklch(cinza).l > paraOklch(branco).l && paraOklch(cinza).l < 0.4);

  const amarelo = adaptarCor("#ffff00", "fundo")!;
  checar("fundo amarelo continua amarelo (+-8)", difHue(paraOklch(amarelo).h, paraOklch("#ffff00").h) <= 8, amarelo);
  checar("fundo amarelo continua realce (croma >= 0,05)", paraOklch(amarelo).c >= 0.05, paraOklch(amarelo).c);
  checar("texto preto sobre realce amarelo: legivel", contraste(adaptarCor("#000", "texto")!, amarelo) >= 4.5);

  const azulFundo = adaptarCor("#0000ff", "fundo")!;
  checar("texto branco sobre fundo azul: legivel", contraste(adaptarCor("#ffffff", "texto")!, azulFundo) >= 4.5, [
    adaptarCor("#ffffff", "texto"),
    azulFundo,
  ]);
  const vermelhoFundo = adaptarCor("#ff0000", "fundo")!;
  checar("texto preto sobre fundo vermelho: legivel", contraste(adaptarCor("#000", "texto")!, vermelhoFundo) >= 4.5);

  // Nenhuma saida invalida para varias entradas.
  let ruim = 0;
  for (let r = 0; r < 256; r += 51)
    for (let g = 0; g < 256; g += 51)
      for (let b = 0; b < 256; b += 51) {
        for (const papel of ["texto", "fundo"] as const) {
          const s = adaptarCor(`rgb(${r},${g},${b})`, papel);
          if (!s || !/^#[0-9a-f]{6}$/.test(s)) ruim++;
        }
      }
  checar("216 cores x 2 papeis: saida sempre #rrggbb", ruim === 0, ruim);
}
