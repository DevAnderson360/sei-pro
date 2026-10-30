#!/usr/bin/env node
/**
 * Gera opcoes-pagina/.preview/options.html: o options.html real com um `chrome` falso
 * (storage em memoria, manifest do Lab) e <base> apontando para dist/html/. Serve para
 * ver a pagina fora da extensao. Uso:
 *   npm run build:rapido && npm run preview
 *   (na raiz do repo) python3 -m http.server 8765
 *   http://localhost:8765/opcoes-pagina/.preview/options.html?produto=SEI%20Pro%20Lab&seed=<dataValues urlencoded>
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const SAIDA = join(RAIZ, "opcoes-pagina", ".preview");
mkdirSync(SAIDA, { recursive: true });
writeFileSync(
  join(SAIDA, "chrome-stub.js"),
  `(function () {
  var q = new URLSearchParams(location.search);
  var mem = { dataValues: q.get("seed") || "" };
  window.chrome = {
    runtime: {
      lastError: undefined,
      getManifest: function () { return { short_name: q.get("produto") || "SEI Pro Lab", homepage_url: "https://seipro.app", icons: { "32": "icons/lab/icon-32.png" }, content_scripts: [{ js: ["js/init_favoritos.js"] }] }; },
      getURL: function (p) { return "../../dist/" + p; }
    },
    storage: { sync: {
      // Aceita callback (a pagina de opcoes) e Promise (os modulos de sei-comum), como o chrome.storage.
      get: function (k, cb) {
        var r = typeof k === "string" ? (function () { var o = {}; o[k] = mem[k]; return o; })() : Object.assign({}, k, mem);
        if (cb) { cb(r); return undefined; }
        return Promise.resolve(r);
      },
      set: function (o, cb) { Object.assign(mem, o); if (cb) { cb(); return undefined; } return Promise.resolve(); },
      remove: function (k, cb) { delete mem[k]; if (cb) { cb(); return undefined; } return Promise.resolve(); }
    }, onChanged: { addListener: function () {}, removeListener: function () {} } }
  };
})();`,
);
// O CSS do Font Awesome usa chrome-extension://__MSG_@@extension_id__/, que so resolve dentro da extensao.
writeFileSync(
  join(SAIDA, "fontawesome.pro.min.css"),
  readFileSync(join(RAIZ, "dist", "css", "fontawesome.pro.min.css"), "utf8").replaceAll(
    "chrome-extension://__MSG_@@extension_id__/",
    "/dist/",
  ),
);
const html = readFileSync(join(RAIZ, "dist", "html", "options.html"), "utf8")
  .replace("../css/fontawesome.pro.min.css", "../../opcoes-pagina/.preview/fontawesome.pro.min.css")
  .replace("<head>", '<head>\n    <base href="../../dist/html/">\n    <script src="../../opcoes-pagina/.preview/chrome-stub.js"></script>');
writeFileSync(join(SAIDA, "options.html"), html);
console.log("Pre-visualizacao gerada em opcoes-pagina/.preview/options.html");
