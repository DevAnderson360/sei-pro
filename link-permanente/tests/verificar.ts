import { resumo } from "./util";
import { verificarApp } from "./verificar-app";
import { verificarEntrada } from "./verificar-entrada";
import { verificarMain } from "./verificar-main";
import { verificarModelo } from "./verificar-modelo";
import { verificarPagina } from "./verificar-pagina";

verificarModelo();
await verificarPagina();
await verificarApp();
await verificarEntrada();
// Por último: troca document, location e chrome globais.
await verificarMain();
resumo();
