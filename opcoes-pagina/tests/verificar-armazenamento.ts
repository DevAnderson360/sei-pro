import {
  type ApiSync,
  armazemSync,
  interpretar,
  LIMITE_ITEM_SYNC,
  medirEspaco,
  mensagemEstouro,
  normalizarArquivo,
  serializar,
} from "../src/armazenamento";
import { avisar } from "../src/dialogo";
import { checar, disparar, instalarDom, secao, tique } from "./util";

const LEGADO =
  '[{"baseName":"Atividades","baseTipo":"atividades","conexaoTipo":"api","CLIENT_ID":"","API_KEY":"","spreadsheetId":"","URL_API":"https://x/api","KEY_USER":"abc"},{"configGeral":[{"name":"gerenciarfavoritos","value":true},{"name":"qualidadeimagens","value":60}]}]';

function apiFalsa(inicial = "", erro?: string): ApiSync & { mem: { dataValues: string } } {
  const mem = { dataValues: inicial };
  const runtime: { lastError?: { message: string } } = {};
  return {
    mem,
    runtime,
    storage: {
      sync: {
        get: (_k, cb) => cb({ dataValues: mem.dataValues }),
        set: (o, cb) => {
          if (erro) runtime.lastError = { message: erro };
          else Object.assign(mem, o);
          cb();
          runtime.lastError = undefined;
        },
      },
    },
  };
}

export async function verificarArmazenamento(): Promise<void> {
  secao("armazenamento: formato do dataValues");
  const d = interpretar(LEGADO);
  checar(
    "le o dataValues que a versao anterior gravava",
    d.perfis.length === 1 && d.perfis[0].baseName === "Atividades" && d.config.length === 2,
  );
  checar("serializar devolve o mesmo formato", serializar(d) === LEGADO);
  checar(
    "vazio, lixo e nao-array nao lancam",
    ["", "not json", "{}", "null", '"x"', "[1,2]"].every((t) => {
      const x = interpretar(t);
      return x.perfis.length === 0 && x.config.length === 0;
    }),
  );
  checar(
    "sem configGeral: perfis ficam, config vazia",
    (() => {
      const x = interpretar('[{"baseName":"A"}]');
      return x.perfis.length === 1 && x.config.length === 0;
    })(),
  );
  checar(
    "configGeral malformado: so ficam os itens {name: string, value: boolean|string|number}",
    (() => {
      const x = interpretar(
        '[{"configGeral":[null,{"name":"debugpage","value":true},{"name":5,"value":1},{"name":"a"},"x",{"name":"b","value":null},{"name":"c","value":{"k":1}}]}]',
      );
      return x.config.length === 1 && x.config[0].name === "debugpage";
    })(),
  );
  checar("item sem baseName nao e perfil", interpretar('[{"outra":1},{"configGeral":[]}]').perfis.length === 0);

  secao("armazenamento: limite de 8 KB");
  checar("pequeno ok", medirEspaco("abc").estado === "ok");
  checar("acima de 80% avisa", medirEspaco("a".repeat(Math.floor(LIMITE_ITEM_SYNC * 0.85))).estado === "perto");
  checar("acima do limite estoura", medirEspaco("a".repeat(LIMITE_ITEM_SYNC + 1)).estado === "estoura");
  checar("conta bytes, nao caracteres", medirEspaco("ã".repeat(5000)).tamanho === 10000);
  checar("mensagem do legado", mensagemEstouro(9000).includes("9000 de 8192 bytes"));

  secao("armazenamento: armazem do sync");
  const api = apiFalsa(LEGADO);
  const armazem = armazemSync(api);
  checar("obtem", (await armazem.obter()) === LEGADO);
  await armazem.gravar("[]");
  checar("grava", api.mem.dataValues === "[]");
  let msg = "";
  try {
    await armazemSync(apiFalsa("", "QUOTA_BYTES_PER_ITEM quota exceeded")).gravar("x");
  } catch (e) {
    msg = (e as Error).message;
  }
  checar("erro do navegador vira rejeicao com a mensagem", msg.includes("QUOTA_BYTES_PER_ITEM"), msg);

  secao("armazenamento: arquivo importado");
  checar("normaliza JSON valido", normalizarArquivo(' [ {"a":1} ] ') === '[{"a":1}]');
  let invalido = false;
  try {
    normalizarArquivo("isto nao e json");
  } catch (e) {
    invalido = (e as Error).message === "Arquivo invalido";
  }
  checar("rejeita arquivo que nao e JSON", invalido);

  secao("dialogo");
  instalarDom();
  let fechou = false;
  const p = avisar("ok", "Salvo").then(() => {
    fechou = true;
  });
  const dlg = document.querySelector("dialog.aviso-ok") as HTMLDialogElement;
  checar("abre com o texto", !!dlg && (dlg.textContent ?? "").includes("Salvo") && dlg.hasAttribute("open"));
  disparar(dlg.querySelector("button") as Element, "click");
  await p;
  await tique();
  checar("OK fecha, resolve e remove do DOM", fechou && document.querySelector("dialog") === null);
}
