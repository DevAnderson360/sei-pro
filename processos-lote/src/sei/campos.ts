/**
 * Pares de POST do SEI: nomes podem repetir e a ORDEM e a do formulario (ver `codificarLatin1` no nucleo).
 * Trocar um valor mantem a posicao do campo; campo novo vai para o fim -- o mesmo resultado do
 * `Object.assign` sobre os parametros no legado (procLote_montarPostData).
 */
export type Pares = Array<[string, string]>;

export function comCampos(pares: ReadonlyArray<readonly [string, string]>, valores: ReadonlyArray<readonly [string, string]>): Pares {
  const saida: Pares = pares.map(([n, v]) => [n, v]);
  for (const [nome, valor] of valores) {
    const i = saida.findIndex(([n]) => n === nome);
    if (i < 0) {
      saida.push([nome, valor]);
      continue;
    }
    saida[i] = [nome, valor];
    // Nome repetido (select multiplo) vira um valor so: o que o legado mandava.
    for (let j = saida.length - 1; j > i; j--) if (saida[j][0] === nome) saida.splice(j, 1);
  }
  return saida;
}

/**
 * Ocultos `hdn*` de um formulario, como o legado os colhia (extractFormParams/getFullProcList): so
 * `input[type=hidden]` com `name` e com "hdn" no `id`. O resto da tela (filtro de texto, campos sem id)
 * nunca foi enviado nas telas de escolha de tipo.
 */
export function ocultosHdn(form: Element): Pares {
  const pares: Pares = [];
  for (const el of form.querySelectorAll("input[type=hidden]")) {
    const nome = el.getAttribute("name");
    if (!nome || !(el.getAttribute("id") ?? "").includes("hdn")) continue;
    pares.push([nome, el.getAttribute("value") ?? ""]);
  }
  return pares;
}
