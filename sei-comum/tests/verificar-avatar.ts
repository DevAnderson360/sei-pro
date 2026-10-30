import { avatar, corDoAvatar, iniciais, PALETA_AVATAR } from "../src/ui/avatar";
import { checar, instalarDom, secao } from "./util";

/** Luminância relativa e contraste (WCAG 2), contados aqui de novo, sem usar o código provado. */
function luminancia(hex: string): number {
  const c = [1, 3, 5]
    .map((i) => Number.parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * (c[0] ?? 0) + 0.7152 * (c[1] ?? 0) + 0.0722 * (c[2] ?? 0);
}
const contraste = (a: string, b: string) => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p);
  return ((x ?? 0) + 0.05) / ((y ?? 0) + 0.05);
};

export function verificarAvatar(): void {
  secao("avatar: iniciais");
  checar("nome completo: primeira e ultima", iniciais("Pedro Henrique Soares") === "PS");
  checar("particulas nao contam", iniciais("Maria da Silva") === "MS" && iniciais("João dos Santos e Souza") === "JS");
  checar("login: antes do @, partes por ponto", iniciais("pedro.soares@antaq.gov.br") === "PS");
  checar("uma palavra: uma letra", iniciais("ana") === "A");
  checar("acento e emoji inteiros", iniciais("érica luz") === "ÉL" && iniciais("🙂 Teste") === "🙂T");
  checar("vazio: interrogacao", iniciais("   ") === "?" && iniciais("") === "?");

  secao("avatar: cor estavel e paleta legivel");
  checar("mesmo nome, mesma cor (sem caixa, acento ou espaco a mais)", corDoAvatar("Pedro Soares") === corDoAvatar("  PEDRO   soares "));
  checar("acento nao muda a cor", corDoAvatar("João") === corDoAvatar("Joao"));
  const nomes = [
    "Ana",
    "Bruno",
    "Carla",
    "Diego",
    "Elisa",
    "Fabio",
    "Gabriela",
    "Hugo",
    "Iara",
    "Joana",
    "Kleber",
    "Lucia",
    "Marcos",
    "Nadia",
    "Otavio",
    "Paula",
  ];
  const cores = new Set(nomes.map(corDoAvatar));
  checar("nomes diferentes se espalham pela paleta", cores.size >= 6, cores.size);
  checar(
    "branco das iniciais com contraste de texto (4,5:1) em toda cor",
    PALETA_AVATAR.every((c) => contraste(c, "#ffffff") >= 4.5),
    PALETA_AVATAR.map((c) => contraste(c, "#ffffff").toFixed(2)),
  );
  checar(
    "o circulo aparece no tema escuro (2,5:1 sobre #1f2329)",
    PALETA_AVATAR.every((c) => contraste(c, "#1f2329") >= 2.5),
    PALETA_AVATAR.map((c) => contraste(c, "#1f2329").toFixed(2)),
  );

  secao("avatar: elemento");
  instalarDom();
  const hostil = '<img src=x onerror="alert(1)"> Silva';
  const el = avatar(hostil, { tamanho: 24 });
  checar("nome hostil: so texto, nenhum elemento dentro", el.children.length === 0 && el.textContent === "<S", el.textContent);
  checar(
    "rotulo acessivel e title com o nome",
    el.getAttribute("aria-label") === hostil && el.getAttribute("title") === hostil && el.getAttribute("role") === "img",
  );
  checar(
    "cor do nome e tamanho",
    el.style.getPropertyValue("background-color") === corDoAvatar(hostil) && el.style.getPropertyValue("width") === "24px",
  );
  checar("tamanho absurdo fica no limite", avatar("A", { tamanho: 999 }).style.getPropertyValue("width") === "64px");
  checar(
    "rotulo proprio (ex.: 'Responsavel: Ana')",
    avatar("Ana", { rotulo: "Responsável: Ana" }).getAttribute("aria-label") === "Responsável: Ana",
  );
}
